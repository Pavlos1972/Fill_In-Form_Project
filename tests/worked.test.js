/* The "worked" block of the saved file: every figure the form works out, as the PDF prints it. It equals the PDF's text; it is never read back as an answer; it is rebuilt at every save; an older file opens and a file
   with the block opens (an older copy of the form ignores keys it does not know, as this one does). */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const tax = require('../app/js/tax.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');
const worked = require('../app/js/worked.js');

/* the PDF, drawn with a recorder in place of jsPDF: every piece of text it would print, one entry each (a table cell is one entry) */
let rec = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage'].forEach(n => { doc[n] = () => doc; });
  doc.text = s => { [].concat(s).forEach(x => rec.push(String(x))); return doc; };
  doc.getTextWidth = s => String(s).length * 1.8;
  doc.splitTextToSize = s => [String(s)];
  doc.addPage = () => { doc.pages++; return doc; };
  doc.getNumberOfPages = () => doc.pages;
  doc.autoTable = o => {
    const cell = c => (c && typeof c === 'object' ? c.content : c);
    [].concat(o.head || [], o.body || [], o.foot || []).forEach(r => r.forEach(c => rec.push(String(cell(c) == null ? '' : cell(c)))));
    doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 10 };
    return doc;
  };
  return doc;
}
global.window = { FF: { util, schema, calc, store, summary, actions, logo: { data: '', w: 1, h: 1 } }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/pdf.js');
const pdfCells = state => { rec = []; global.window.FF.pdf.build(state); return rec.slice(); };

const set = (s, id, v) => store.setField(s, id, v);
/* a client with income, debts (one paid by someone else, one switched off), children, policies: so every worked figure has something to work on */
function client() {
  const s = store.blank();
  set(s, 'fname', 'Warren'); set(s, 'sname', 'Bleksley'); set(s, 'date', '11/11/2026'); set(s, 'dob', '07/01/1974'); set(s, 'idtype', 'ID'); set(s, 'idno', '7401075075088');
  set(s, 'gross', 'R 41 667.00'); set(s, 'net', 'R 33 288.00'); set(s, 'rent', 'R 1 000.00'); set(s, 'exp', 'R 80 000.00'); set(s, 'next_appt', '16/11/2026');
  set(s, 'd_desk', '70'); set(s, 'd_trav', '30'); set(s, 'has_debts', 'Yes'); set(s, 'has_kids', 'Yes'); set(s, 'has_risk', 'Yes');
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'ABSA', desc: 'House', owner: 'Client', payer: 'Client', term: '144 months', inst: 'R 13 500.00', bal: 'R 1 500 000.00', asset: 'R 2 500 000.00' });
  store.addRow(s, 'debts', { type: 'Credit card', prov: 'ABSA', owner: 'Client', payer: 'Client', inst: 'R 3 500.00', bal: 'R 80 000.00' });
  store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'WesBank', desc: 'Spouse car', owner: 'Spouse', payer: 'Spouse', inst: 'R 4 000.00', bal: 'R 90 000.00' });
  store.setProtect(s, 1, false);
  store.addRow(s, 'kids', { name: 'Keira', sname: 'Bleksley', dob: '31/08/2006', cost: 'R 2 500.00' }); store.addRow(s, 'kids', { name: 'Ryan', sname: 'Bleksley', dob: '14/10/2009', cost: 'R 10 000.00' });
  store.addRow(s, 'risk', { prov: 'Old Mutual', spend: 'R 1 336.00' }); store.addRow(s, 'risk', { prov: 'BrightRock', spend: 'R 6 635.20' });
  store.addRow(s, 'ret_ra', { prov: 'Liberty', status: 'Paid-up', val: 'R 1 029 520.20' });
  return s;
}
const block = s => JSON.parse(store.toJSON(s)).worked;

test('the saved file carries the worked block beside the answers; the form’s own state never holds it', () => {
  const s = client(), j = JSON.parse(store.toJSON(s));
  assert.ok(j.worked && j.f && j.l, 'worked sits beside f and l');
  assert.ok(!('worked' in s), 'not in the state');
  assert.ok(!('worked' in j.f) && !('worked' in j.l));
  assert.strictEqual(j.worked.version, 1);
  assert.strictEqual(j.worked.form, schema.version);
  assert.strictEqual(j.schema, schema.version, 'the file says which version of the form wrote it');
  assert.strictEqual(j.worked.taxYear, '2026/27');
  assert.ok(Math.abs(Date.parse(j.worked.at) - Date.now()) < 60000);
  assert.ok(/not answers/i.test(j.worked.note));
  assert.strictEqual(schema.version, '3.6');
});

test('the figures are the form’s own: Warren’s case (take-home, expenses, debts, children) gives the figures the screen shows, the disposable income with its minus sign', () => {
  const w = block(client());
  assert.strictEqual(w.f.age, '52 years');
  assert.strictEqual(w.f.d_tot, '100%');
  assert.strictEqual(w.f.dnet, 'R 33 288.36');
  assert.strictEqual(w.f.tinc, 'R 34 288.00');
  assert.strictEqual(w.f.disp, '-R 45 712.00');
  assert.strictEqual(w.f.next_day, 'Monday');
  assert.deepStrictEqual([w.f.lc_hh, w.f.lc_cc, w.f.lc_dr, w.f.lc_need], ['R 33 288.00', 'R 12 500.00', 'R 17 000.00', 'R 3 788.00'], 'only the debts the client pays count');
  assert.deepStrictEqual([w.f.pd_hh, w.f.pd_cc, w.f.pd_dr, w.f.pd_need], [w.f.lc_hh, w.f.lc_cc, w.f.lc_dr, w.f.lc_need]);
  assert.strictEqual(w.f.ip_amt, 'R 33 288.00');
  assert.strictEqual(w.f.ip_hh, 'R 19 788.00', 'household needs: the insured amount less the instalments protected (the card is switched off)');
  assert.deepStrictEqual(w.l.kids, [{ age: '20 years' }, { age: '17 years' }]);
});

test('the instalment protector: one entry for each debt the client pays (label as printed, provider, instalment, protected), the total, what is switched off, what someone else pays, household needs', () => {
  const p = block(client()).protector;
  assert.deepStrictEqual(p.rows, [
    { label: 'Bond repayments (ABSA)', provider: 'ABSA', instalment: 'R 13 500.00', protected: true },
    { label: 'Credit card (ABSA)', provider: 'ABSA', instalment: 'R 3 500.00', protected: false }]);
  assert.strictEqual(p.insured, 'R 33 288.00'); assert.strictEqual(p.total, 'R 13 500.00'); assert.strictEqual(p.notProtected, 'R 3 500.00');
  assert.deepStrictEqual(p.elsewhere, { debts: 1, total: 'R 4 000.00' }); assert.strictEqual(p.householdNeeds, 'R 19 788.00');
  assert.strictEqual(p.note, 'Instalment protector: 1 of 2 debts protected.');
});

test('list totals and area totals with the labels the PDF prints', () => {
  const w = block(client());
  assert.deepStrictEqual(w.totals.lists.risk, [{ col: 'spend', column: 'Spend (R p.m.)', label: 'Total spend', value: 'R 7 971.20' }]);
  assert.deepStrictEqual(w.totals.lists.debts.map(x => [x.label, x.value]), [['Total monthly', 'R 17 000.00'], ['Total spouse monthly', 'R 4 000.00'], ['Total liabilities', 'R 1 670 000.00'], ['Total assets', 'R 2 500 000.00']]);
  assert.deepStrictEqual(w.totals.lists.kids, [{ col: 'cost', column: 'Childcare (R p.m.)', label: 'Total childcare', value: 'R 12 500.00' }]);
  assert.ok(w.totals.areas.life.some(x => x.label === 'Total debt to be covered (balances)'));
  assert.ok(!('shares' in w.totals.lists), 'a list with no rows has no total');
});

test('everything in the block is in the PDF, as the PDF prints it', () => {
  const s = client(), w = block(s), cells = pdfCells(s), has = v => cells.some(c => c === v || c.includes(v));
  const misses = [];
  Object.keys(w.f).forEach(id => { if (w.f[id] !== '' && !has(w.f[id])) misses.push('f.' + id + ' ' + w.f[id]); });
  Object.keys(w.l).forEach(k => w.l[k].forEach((row, i) => Object.keys(row).forEach(c => { if (row[c] && !has(row[c])) misses.push('l.' + k + '[' + i + '].' + c + ' ' + row[c]); })));
  Object.keys(w.totals.lists).forEach(k => w.totals.lists[k].forEach(x => { if (!cells.includes(x.value)) misses.push('total ' + k + '.' + x.col + ' ' + x.value); const shown = schema.lists[k].cards ? x.label : x.column; if (!has(shown)) misses.push('label ' + shown); }));
  const p = w.protector;
  p.rows.forEach(r => { if (!has(r.label)) misses.push('protector label ' + r.label); if (!has(r.instalment + ' p.m.')) misses.push('protector instalment ' + r.instalment); if (!has(r.protected ? 'Protected' : 'Not protected')) misses.push('protected flag'); });
  [p.total + ' p.m.', p.notProtected + ' p.m.', p.elsewhere.total + ' p.m.', p.note].forEach(x => { if (!has(x)) misses.push('protector ' + x); });
  if (!has(p.householdNeeds) || !has(p.insured)) misses.push('protector household needs / insured');
  Object.keys(w.totals.areas).forEach(id => w.totals.areas[id].forEach(x => { if (!has(x.value)) misses.push('area ' + id + ' ' + x.label + ' ' + x.value); }));
  assert.deepStrictEqual(misses, []);
});

test('nothing the form works out and prints is left out: every calculated box, list total and area total of the schema is in the block', () => {
  const s = client(), w = block(s), ctx = store.ctxFor(s), missing = [];
  schema.sections.forEach(sec => { if (!calc.showIf(sec.cond, ctx)) return; sec.blocks.forEach(b => {
    if (!calc.showIf(b.cond, ctx)) return;
    (b.fields || []).forEach(f => { if (f.calc && !f.nopdf && calc.showIf(f.cond, ctx) && !(f.id in w.f)) missing.push('f.' + f.id); });
    if (b.protector && !w.protector) missing.push('protector');
    if (b.list && s.l[b.list].length) {
      const L = schema.lists[b.list];
      if (Object.keys(L.sum || {}).length && !w.totals.lists[b.list]) missing.push('totals.lists.' + b.list);
      if (L.cols.some(c => c.calc) && !w.l[b.list]) missing.push('l.' + b.list);
    }
  }); });
  schema.panels.forEach(P => { if (P.sum && P.sum.t && summary.areaData(s, P.id) && Object.keys(summary.areaData(s, P.id).totals).length && !w.totals.areas[P.id]) missing.push('areas.' + P.id); });
  assert.deepStrictEqual(missing, []);
});

test('a box that is switched off is left out of the block, as it is left out of the PDF', () => {
  const s = client(), f = schema.fieldsById.age, was = f.cond;
  try {
    f.cond = { f: 'idtype', eq: 'Passport' };
    assert.ok(!('age' in block(s).f), 'switched off: not in the block');
    assert.ok(!pdfCells(s).includes('52 years'), 'and not in the PDF');
    set(s, 'idtype', 'Passport'); assert.ok('age' in block(s).f, 'switched on again');
  } finally { f.cond = was; }
});

test('a file with no block opens (an older file), and a file with the block opens: the block is never read back as an answer', () => {
  const s = client(), j = JSON.parse(store.toJSON(s));
  const older = JSON.parse(JSON.stringify(j)); delete older.worked;
  const a = store.fromJSON(JSON.stringify(older)), b = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual(b.f, a.f); assert.deepStrictEqual(b.l, a.l);
  assert.ok(!('worked' in a) && !('worked' in b), 'nothing of it in the state');
  ['lc_hh', 'lc_need', 'ip_hh', 'tinc', 'disp', 'age', 'd_tot', 'next_day', 'dnet'].forEach(id => assert.strictEqual(b.f[id].v, '', id + ' is still an empty box: a worked figure is not an answer'));
});

test('a tampered block is ignored and recomputed at the next save; an older copy of the form (which only reads the keys it knows) loses nothing', () => {
  const s = client(), j = JSON.parse(store.toJSON(s));
  j.worked.f.lc_need = 'R 999.00'; j.worked.f.disp = 'R 1.00'; j.worked.protector.total = 'R 0.00'; j.worked.totals.lists.debts[0].value = 'R 1.00';
  const o = store.fromJSON(JSON.stringify(j)), again = JSON.parse(store.toJSON(o)).worked, honest = block(s);
  assert.strictEqual(again.f.lc_need, honest.f.lc_need); assert.strictEqual(again.f.disp, honest.f.disp);
  assert.strictEqual(again.protector.total, honest.protector.total); assert.strictEqual(again.totals.lists.debts[0].value, honest.totals.lists.debts[0].value);
  const keysKnownToTheOldCopy = ['app', 'schema', 'created', 'modified', 'f', 'l', 'sum', 'auto', 'pa', 'focus', 'unplaced', 'claude', 'openai'];       // auto (3.4) is the form's own record of which priority areas the adviser took over
  const extra = Object.keys(j).filter(k => keysKnownToTheOldCopy.indexOf(k) < 0);
  assert.deepStrictEqual(extra, ['worked'], 'the only new key is worked');
});

test('the typed answers are saved exactly as before: f and l are the same with or without the block', () => {
  const s = client(), j = JSON.parse(store.toJSON(s));
  assert.deepStrictEqual(j.f, JSON.parse(JSON.stringify(s.f)));
  assert.deepStrictEqual(j.l, JSON.parse(JSON.stringify(s.l)));
});
