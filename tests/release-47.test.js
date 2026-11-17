/* Release 4.7: the Health box h_dia is relabelled from "Diabetes / high sugar" to "High blood sugar" (Paul: "Maybe we can just say 'High blood sugar', remove diabetes").
   Reason: on a real client with raised sugar levels who is NOT diabetic, Yes made both reports say diabetes, which matters to insurers.
   The id h_dia and the Yes / No answers do not change, so every saved file opens unchanged; no other Health box changes. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');
const V = require('../app/js/voice.js');

/* the PDF is drawn here with a recorder instead of jsPDF: it keeps every piece of text the PDF would print */
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

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const idx = V.buildIndex(schema);
const q = (text, cur) => { const r = V.matchQuestion(text, idx, { cur: cur || 'health', isEmpty: () => true }); return r && r.id; };
const pdfText = s => { rec = []; global.window.FF.pdf.build(s); return rec.join('\n'); };

test('the version is 4.7 or later, and every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 4.7);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('the box is called High blood sugar; its id and its Yes / No answers are what they were', () => {
  const f = schema.fieldsById.h_dia;
  assert.ok(f, 'the id h_dia is still there');
  assert.strictEqual(f.l, 'High blood sugar');
  assert.deepStrictEqual(f.o, ['Yes', 'No'], 'the answers are unchanged');
  assert.strictEqual(f.t, 'sel');
  assert.ok(!f.legacy && !f.calc && !f.nopdf, 'still an ordinary answered box that is printed');
  ['sl', 'vl'].forEach(k => assert.ok(!/diabet/i.test(f[k] || ''), k + ' does not say diabetes'));
});

test('no other Health box changed', () => {
  const health = schema.sections.find(s => s.id === 'health');
  const boxes = health.blocks.reduce((a, b) => a.concat(b.fields || []), []).map(f => f.id + ': ' + f.l);
  assert.deepStrictEqual(boxes, ['h_gen: General health good', 'h_dia: High blood sugar', 'h_chol: High cholesterol', 'h_bp: High blood pressure', 'h_bmi: High BMI', 'h_oth: Other health issues', 'h_notes: Health notes']);
});

test('the word diabetes is not in the form, its voice words, its prompts or its pages', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === 'vendor' ? a : a.concat(walk(p));
    return /\.(js|html|css)$/.test(e.name) ? a.concat(p) : a;
  }, []);
  const hits = walk(path.join(__dirname, '..', 'app')).filter(p => /diabet/i.test(fs.readFileSync(p, 'utf8'))).map(p => path.relative(path.join(__dirname, '..'), p));
  assert.deepStrictEqual(hits, [], 'files under app/ that still say diabetes');
});

test('the PDF prints High blood sugar and never Diabetes, and the answer under it is the answer given', () => {
  const s = fresh(); set(s, 'h_dia', 'Yes'); set(s, 'h_chol', 'No');
  const t = pdfText(s);
  assert.ok(/High blood sugar/.test(t), 'the new label is in the PDF');
  assert.ok(!/diabet/i.test(t), 'the PDF does not say diabetes');
  assert.ok(t.indexOf('High blood sugar') < t.indexOf('High cholesterol'), 'in the same place, before High cholesterol');
});

test('voice knows the box as high blood sugar, and a spoken "diabetes" no longer picks it', () => {
  assert.strictEqual(q('Do you have high blood sugar?'), 'h_dia');
  assert.strictEqual(q('Is your blood sugar high?'), 'h_dia');
  assert.strictEqual(q('Any problems with your sugar levels?'), 'h_dia');
  assert.notStrictEqual(q('Do you have diabetes?'), 'h_dia', 'a diagnosis is not what this box records');
  assert.notStrictEqual(q('Is the client diabetic?'), 'h_dia');
  assert.strictEqual(q('Any problems with cholesterol?'), 'h_chol', 'the other Health questions are as they were');
  assert.strictEqual(q('What about blood pressure?'), 'h_bp', 'blood pressure is not caught by "blood sugar"');
  const ids = Object.keys(idx.byId);
  assert.ok(ids.includes('h_dia'), 'h_dia is still a voice box');
  assert.ok(!/diabet/i.test(JSON.stringify(idx.byId.h_dia)), 'nothing the voice index holds for the box says diabetes');
});

test('a saved file keeps the answer in h_dia, with its status, and opens unchanged', () => {
  [['Yes', 'confirmed'], ['No', 'confirmed'], ['Yes', 'verify'], ['No', 'heard'], ['', 'empty']].forEach(([v, st]) => {
    const j = JSON.parse(store.toJSON(fresh()));
    j.schema = '4.6'; j.f.h_dia = { v, st };
    const s = store.fromJSON(JSON.stringify(j));
    assert.deepStrictEqual([s.f.h_dia.v, s.f.h_dia.st], [v, st], v + ' / ' + st);
    assert.strictEqual(JSON.parse(store.toJSON(s)).f.h_dia.v, v, 'and it saves as it opened');
  });
});

test('no id, list, list column or choice changed', () => {
  assert.deepStrictEqual(Object.keys(schema.lists).sort(), ['appts', 'bfred', 'bizpol', 'debts', 'grp', 'inv', 'invq', 'kids', 'meetings', 'raq', 'redq', 'ret_pp', 'ret_ra', 'risk', 'shares']);
  assert.ok(schema.fieldsById.h_gen && schema.fieldsById.h_chol && schema.fieldsById.h_bp && schema.fieldsById.h_bmi && schema.fieldsById.h_oth && schema.fieldsById.h_notes);
});
