/* Version 3.3: the headings in Current Client File Summary Notes (cc_notes) are bold, in the box (a read view) and in the PDF. The rule: a line with no lower-case letters, at least 4 characters, not starting with "- ".
   The text in the saved file stays plain; the skill writes plain text only. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');

/* the PDF, drawn with a recorder in place of jsPDF: every cell with its text and whether it was set bold */
let rec = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage'].forEach(n => { doc[n] = () => doc; });
  doc.text = s => { [].concat(s).forEach(x => rec.push({ c: String(x), bold: false })); return doc; };
  doc.getTextWidth = s => String(s).length * 1.8; doc.splitTextToSize = s => [String(s)];
  doc.addPage = () => { doc.pages++; return doc; }; doc.getNumberOfPages = () => doc.pages;
  doc.autoTable = o => {
    [].concat(o.head || [], o.body || [], o.foot || []).forEach(r => r.forEach(c => rec.push({ c: String(c && typeof c === 'object' ? (c.content == null ? '' : c.content) : (c == null ? '' : c)), bold: !!(c && typeof c === 'object' && c.styles && c.styles.fontStyle === 'bold') })));
    doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 10 };
    return doc;
  };
  return doc;
}
global.window = { FF: { util, schema, calc, store, summary, actions, logo: { data: '', w: 1, h: 1 } }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/pdf.js');
const pdfCells = state => { rec = []; global.window.FF.pdf.build(state); return rec.slice(); };
const set = (s, id, v) => store.setField(s, id, v);

const NOTES = ['STILL OPEN', '- Sep 2026 - Open: client to send Old Mutual RA statement', '', '2026 (REVIEW DONE: MAR 2026)', '- Oct 2026 - COL: Discovery, +50% loading on life cover (hypertension); client accepted', '',
  '2023 (FROM NOV; NO REVIEW DONE)', '- Nothing recorded', '', 'EARLIER, STILL IMPORTANT', 'CHECK AGAINST THE CLIENT FILE'].join('\n');

test('the heading rule: no lower-case letters, four or more characters, not a point', () => {
  const heads = ['STILL OPEN', '2026 (REVIEW DONE: MAR 2026)', '2023 (FROM NOV; NO REVIEW DONE)', 'EARLIER, STILL IMPORTANT', 'CHECK AGAINST THE CLIENT FILE', '  STILL OPEN  ', 'NOTE', '2026'];
  const plain = ['- Sep 2026 - Open: client to send Old Mutual RA statement', '- COL: Discovery, +50% loading', '- Nothing recorded', 'Still open', 'Still OPEN', 'OK', 'ABC', '', '   ', '  - A POINT IN CAPITALS', '- ', 'x STILL'];
  heads.forEach(l => assert.ok(util.isHeadingLine(l), '"' + l + '" is a heading'));
  plain.forEach(l => assert.ok(!util.isHeadingLine(l), '"' + l + '" is not'));
});

test('the box asks for bold headings, and the form is at the version of its day (3.3 added this; 3.4 followed) with no id added or relabelled', () => {
  assert.ok(schema.fieldsById.cc_notes.heads); assert.strictEqual(schema.version, '3.6');
  assert.ok(!Object.keys(schema.fieldsById).some(id => schema.fieldsById[id].heads && id !== 'cc_notes'), 'only the Current Client notes box has bold headings');
});

test('the saved file keeps the text plain: nothing about bold is added', () => {
  const s = store.blank(); set(s, 'ref', 'Current client'); set(s, 'cc_notes', NOTES);
  const j = JSON.parse(store.toJSON(s));
  assert.strictEqual(j.f.cc_notes.v, NOTES);
  assert.ok(!/<b>|\*\*|\\u001b/.test(j.f.cc_notes.v));
  assert.strictEqual(store.fromJSON(store.toJSON(s)).f.cc_notes.v, NOTES, 'and it opens as it was');
});

test('the PDF prints the heading lines in bold and the points in plain, one line to a row, with the label above', () => {
  const s = store.blank(); set(s, 'fname', 'Sample'); set(s, 'ref', 'Current client'); set(s, 'cc_notes', NOTES);
  const cells = pdfCells(s);
  const label = cells.findIndex(x => x.c === 'Current Client File Summary Notes');
  assert.ok(label >= 0, 'the label');
  const after = cells.slice(label + 1);
  const bold = after.filter(x => x.bold).map(x => x.c), plain = after.filter(x => !x.bold && x.c.trim()).map(x => x.c);
  ['STILL OPEN', '2026 (REVIEW DONE: MAR 2026)', '2023 (FROM NOV; NO REVIEW DONE)', 'EARLIER, STILL IMPORTANT', 'CHECK AGAINST THE CLIENT FILE'].forEach(h => assert.ok(bold.includes(h), 'bold: ' + h));
  ['- Sep 2026 - Open: client to send Old Mutual RA statement', '- Oct 2026 - COL: Discovery, +50% loading on life cover (hypertension); client accepted', '- Nothing recorded'].forEach(p => assert.ok(plain.some(x => x === p), 'plain: ' + p));
  assert.ok(!bold.some(x => /^- /.test(x)), 'a point is never bold');
  assert.strictEqual(cells.filter(x => x.c === 'STILL OPEN').length, 1, 'each line once');
});

test('the PDF with no text, and for another referral, is as before', () => {
  const s = store.blank(); set(s, 'ref', 'Current client');
  const empty = pdfCells(s);
  assert.ok(empty.some(x => x.c === 'Current Client File Summary Notes'), 'the label even when empty');
  set(s, 'cc_notes', NOTES); set(s, 'ref', 'Other');
  assert.ok(!pdfCells(s).some(x => x.c === 'STILL OPEN' || x.c === 'Current Client File Summary Notes'), 'nothing for another referral');
});
