/* Release 3.1, the Debts page: which debt a spoken line is about, removing a debt, and the "No more debts" line (saved, in the PDF, taken away by a new debt). The page's own behaviour is checked in tests/browser/t-debts.js. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');
const V = require('../app/js/voice.js');

let rec = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage'].forEach(n => { doc[n] = () => doc; });
  doc.text = s => { [].concat(s).forEach(x => rec.push(String(x))); return doc; };
  doc.getTextWidth = s => String(s).length * 1.8; doc.splitTextToSize = s => [String(s)];
  doc.addPage = () => { doc.pages++; return doc; }; doc.getNumberOfPages = () => doc.pages;
  doc.autoTable = o => { const cell = c => (c && typeof c === 'object' ? c.content : c); [].concat(o.head || [], o.body || [], o.foot || []).forEach(r => r.forEach(c => rec.push(String(cell(c) == null ? '' : cell(c))))); doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 10 }; return doc; };
  return doc;
}
global.window = { FF: { util, schema, calc, store, summary, actions, logo: { data: '', w: 1, h: 1 } }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/pdf.js');
const pdfCells = state => { rec = []; global.window.FF.pdf.build(state); return rec.slice(); };

const set = (s, id, v) => store.setField(s, id, v);
const two = () => { const s = store.blank(); set(s, 'has_debts', 'Yes'); store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank' }); store.addRow(s, 'debts', { type: 'Credit card', prov: 'FNB' }); return s; };

test('"No more debts" is a box of the form that is empty until said, saved with the file and read back', () => {
  const s = two();
  assert.strictEqual(s.f.debts_end.v, '');
  set(s, 'debts_end', 'No more debts');
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.f.debts_end.v, 'No more debts');
  const f = schema.fieldsById.debts_end;
  assert.ok(f.opt && f.line, 'the form is not held back by it');
  assert.ok(!calc.showIf(f.cond, store.ctxFor(store.blank())), 'it is not a box until it holds the words');
});

test('a debt added takes the line away; the last debt removed leaves it under the new last; no debt left, no line', () => {
  const s = two(); set(s, 'debts_end', 'No more debts');
  store.addRow(s, 'debts', { type: 'Personal loan' });
  assert.strictEqual(s.f.debts_end.v, '', 'a debt added: it was not the last');
  set(s, 'debts_end', 'No more debts');
  store.delRow(s, 'debts', 2);
  assert.strictEqual(s.f.debts_end.v, 'No more debts', 'removing the last debt keeps the line, now under the debt that is last');
  store.delRow(s, 'debts', 1); store.delRow(s, 'debts', 0);
  assert.strictEqual(s.f.debts_end.v, '', 'nothing is left for the line to be under');
});

test('the PDF prints the line on its own under the debts, and only when it has been said', () => {
  const s = two();
  const none = pdfCells(s); assert.ok(!none.some(c => /No more debts/.test(c)), 'not said, not printed');
  set(s, 'debts_end', 'No more debts');
  const cells = pdfCells(s), at = cells.indexOf('No more debts');
  assert.ok(at > cells.indexOf('Nedbank') && at > cells.indexOf('FNB'), 'under the last debt');
  assert.strictEqual(cells.filter(c => c === 'No more debts').length, 1, 'once, as a line of its own (not inside the Notes box)');
  const t = store.blank(); set(t, 'debts_end', 'No more debts');
  assert.ok(!pdfCells(t).some(c => c === 'No more debts'), 'no debt, no line');
});

test('which debt a line is about: it stays on the one it is on unless the line says to move', () => {
  const rows = [{ type: 'Home loan', prov: 'Nedbank' }, { type: 'Vehicle finance', prov: 'Wesbank' }, { type: 'Credit card', prov: 'FNB' }];
  const ref = (t, cur) => V.debtRef(t, rows, cur);
  ['the balance is 450 000', 'it is with Nedbank', 'the bond is with Nedbank', 'yes, the credit life is on it', 'and the term is twenty years'].forEach(t => assert.deepStrictEqual(ref(t, 0), { kind: 'same' }, t));
  assert.deepStrictEqual(ref('debt two', 0), { kind: 'goto', i: 1 }); assert.deepStrictEqual(ref('Debt number 3', 0), { kind: 'goto', i: 2 });
  assert.deepStrictEqual(ref('the second debt', 0), { kind: 'goto', i: 1 }); assert.deepStrictEqual(ref('debt 1 again', 2), { kind: 'goto', i: 0 });
  assert.deepStrictEqual(ref('let us do the next debt', 0), { kind: 'goto', i: 1 }); assert.deepStrictEqual(ref('the next debt', 2), { kind: 'new' }, 'after the last there is a new one');
  assert.deepStrictEqual(ref('add debt four', 2), { kind: 'new' }); assert.deepStrictEqual(ref('another debt', 0), { kind: 'new' }); assert.deepStrictEqual(ref('there is also a loan with Capitec', 0), { kind: 'new' });
  assert.deepStrictEqual(ref('the credit card', 0), { kind: 'goto', i: 2 }, 'a debt named by what it is');
  assert.deepStrictEqual(ref('and the car loan', 0), { kind: 'goto', i: 1 });
  assert.deepStrictEqual(ref('the personal loan', 0), { kind: 'new' }, 'no personal loan on the form yet');
  assert.deepStrictEqual(ref('it is a credit card with FNB', 2), { kind: 'same' }, 'the debt the talk is on is that kind already');
  assert.deepStrictEqual(V.debtRef('the credit card', [{ type: '', prov: '' }], 0), { kind: 'same' }, 'a debt with no type yet takes what is said');
});

test('remove a debt: by number, by what it is, this one, the last one; never by a plan, a question or "everything"', () => {
  const rows = [{ type: 'Home loan', prov: 'Nedbank' }, { type: 'Vehicle finance', prov: 'Wesbank' }, { type: 'Credit card', prov: 'FNB' }, { type: 'Other', desc: 'Car repairs' }];
  const rm = (t, cur) => { const r = V.removeDebtRef(t, rows, cur == null ? 1 : cur); return r && r.is ? { i: r.i } : r; };       // 3.6: { i, is: [every debt named] }
  assert.deepStrictEqual(rm('remove debt 2'), { i: 1 }); assert.deepStrictEqual(rm('Remove debt number two'), { i: 1 }); assert.deepStrictEqual(rm('Okay, delete the third debt'), { i: 2 });
  assert.deepStrictEqual(rm('take out the car debt'), { i: 1 }); assert.deepStrictEqual(rm('remove the debt for the car'), { i: 1 });
  assert.deepStrictEqual(rm('Please remove the credit card'), { i: 2 }); assert.deepStrictEqual(rm('remove the home loan'), { i: 0 });
  assert.deepStrictEqual(rm('get rid of this debt'), { i: 1 }); assert.deepStrictEqual(rm('remove the last debt'), { i: 3 });
  assert.strictEqual(rm('remove debt 9').error, 'there is no debt 9');
  assert.match(rm('remove the loan').error, /say which debt/);
  assert.match(V.removeDebtRef('remove the personal loan', rows, 0).error, /no personal loan/);
  ['scratch that', 'cancel that', 'delete that', 'remove it', 'remove all the debts', 'delete everything', 'once the card is paid we will remove the credit card', 'I want to remove the debt next year', 'remove the credit card, because it is closed'].forEach(t => assert.strictEqual(rm(t), null, t));
  assert.strictEqual(V.removeDebtRef('remove the debt', [rows[0]], 0).i, 0, 'one debt, and the words say "the debt"');
  assert.strictEqual(V.parseCommand('scratch that', null).type, 'undo', 'scratch that is still the undo');
});

test('"No more debts" is a statement, never a question', () => {
  ['No more debts', 'There are no more debts.', 'no other debts', 'he has no other loans', "That's all the debts", 'that is it for the debts', 'Okay, no more debts', 'No, no more debts.', 'she does not have any more debts'].forEach(t => assert.ok(V.noMoreDebts(t), t));
  ['Any more debts?', 'Is that all the debts?', 'Do you have any more debts', 'what about more debts', 'He has more debts', 'no debts on the car'].forEach(t => assert.ok(!V.noMoreDebts(t), t));
});
