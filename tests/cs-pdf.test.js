/* The Investment Capture Sheet's two PDFs.
   1. The application's PDF mirrors the page: every box, heading and list column of the screen is in it under the same words, the client's answers are in it, the questionnaire's 24 boxes are not, and it ends with the
      Declaration, the three result boxes and the client's signature and date line. jsPDF is replaced by a recorder that keeps every piece of text it would draw.
   2. The questionnaire's own PDF is the firm's own fillable form filled in with the real pdf-lib: every answer, the score and the profile are set, the client's signature, place and date are NOT, and it is a separate file. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/cs-schema.js');
const store = require('../app/js/cs-store.js');
const RT = require('../app/js/cs-rt-data.js');
const PDFLib = require('../app/vendor/pdf-lib.min.js');

let rec = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage'].forEach(n => { doc[n] = () => doc; });
  doc.text = s => { [].concat(s).forEach(x => rec.push(String(x))); return doc; };
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
global.window = { FF: { util, logo: { data: '', w: 1, h: 1 } }, CS: { schema, store }, jspdf: { jsPDF: function () { return makeDoc(); } }, PDFLib };
require('../app/assets/rt-form.js');
require('../app/js/cs-pdf.js');
require('../app/js/cs-rt-pdf.js');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const pdfText = state => { rec = []; global.window.CS.pdf.build(state); return rec.join(' \n '); };
const pdf = state => norm(pdfText(state));

function filled() {
  const s = store.blank();
  schema.fieldIds.forEach(id => {
    const f = schema.fieldsById[id]; if (f.calc || f.rt) return;
    let v = 'Sample' + id.replace(/_/g, '');
    if (f.o && f.o.length) v = f.o[0]; if (f.t === 'money') v = '1234'; if (f.t === 'date') v = '14/03/2026';
    store.setField(s, id, v);
  });
  store.setField(s, 'replace', 'Yes'); store.setField(s, 'old_policy', 'Samplepolicy'); store.setField(s, 'foreign_tax', 'Yes'); store.setField(s, 'foreign_tax_no', 'Sampleforeign');
  store.setField(s, 'marital', 'Married'); store.setField(s, 'marital_date', '14/03/2008'); store.setField(s, 'marital_contract', 'In Community of Property'); store.setField(s, 'own_knowledge', 'No'); store.setField(s, 'origin', 'Sampleorigin');
  store.addRow(s, 'benef', { name: 'BenefOne', sname: 'Name', cell: '0821111111', id: '3333333333333', relation: 'Spouse', pct: '60' }); store.addRow(s, 'benef', { name: 'BenefTwo', sname: 'Name', cell: '0822222222', id: '4444444444444', relation: 'Child', pct: '40' });
  return s;
}
function answered(s) {
  for (let i = 1; i <= 18; i++) store.setField(s, 'rt_s' + i, RT.SCALE[(i - 1) % 3 + 1]);
  RT.CAPACITY.forEach((c, i) => store.setField(s, 'rt_c' + (i + 1), c.options[1]));
  store.setField(s, 'rt_understand', 'Confirmed'); store.rtSync(s, true);
  return s;
}

/* ---------- the application's PDF ---------- */
test('every section heading, box label and list column of the application is in its PDF', () => {
  const out = pdf(answered(filled()));
  schema.sections.filter(s => !s.rtq).forEach(s => assert.ok(out.includes(norm(s.title)), 'heading missing: ' + s.title));
  schema.fieldIds.filter(id => !schema.fieldsById[id].rt).forEach(id => assert.ok(out.includes(norm(schema.fieldsById[id].l)), 'label missing: ' + schema.fieldsById[id].l));
  Object.keys(schema.lists).forEach(k => schema.lists[k].cols.forEach(c => assert.ok(out.includes(norm(c.l)), 'column missing: ' + c.l)));
  assert.ok(out.includes(norm('Total of the shares')) && out.includes('100'), 'the total of the beneficiaries’ shares');
});
test('every answer is in the PDF, as it is on the screen', () => {
  const s = answered(filled()), out = pdf(s);
  schema.fieldIds.filter(id => !schema.fieldsById[id].rt).forEach(id => assert.ok(out.includes(norm(s.f[id].v)), 'answer missing for ' + id + ': ' + s.f[id].v));
  s.l.benef.forEach(r => Object.keys(r.d).forEach(c => assert.ok(out.includes(norm(r.d[c])), 'benef ' + c + ' missing: ' + r.d[c])));
  assert.ok(out.includes(norm('R 1 234.00')), 'the amount as Rand');
});
test('the title, the client and the signature block are on it, and the file’s own name rule is on the page footer', () => {
  const s = filled(); store.setField(s, 'fname', 'Anna'); store.setField(s, 'sname', 'Kuiper');
  const out = pdf(s);
  ['investmentcapturesheet', 'annakuiper', 'clientssignature', 'date', 'wrinvestmentcapturesheetv1.0'.replace('.', '')].forEach(x => assert.ok(out.includes(x), x));
});
test('the questionnaire’s 24 boxes are not in the application’s PDF: it has its own PDF; only the worked-out result is', () => {
  const s = answered(filled()), out = pdf(s);
  RT.STATEMENTS.forEach(q => assert.ok(!out.includes(norm(q)), 'a statement is in the application PDF: ' + q));
  RT.CAPACITY.forEach(c => assert.ok(!out.includes(norm(c.question)), 'a capacity question is in the application PDF'));
  assert.ok(!out.includes(norm('Client Risk Assessment Questionnaire')) && !out.includes(norm('Risk tolerance questionnaire')));
  assert.ok(out.includes(norm('Result of the questionnaire')) && out.includes(norm(s.f.risk_profile.v)) && out.includes(norm(s.f.risk_ref.v)) && out.includes(norm('Total score (out of 90)')) && out.includes(norm(s.f.risk_score.v)));
});
test('without a result there is no result block; with one it sits after the Declaration and before the signature', () => {
  assert.ok(!pdf(filled()).includes(norm('Result of the questionnaire')), 'nothing to print: no block');
  const text = pdfText(answered(filled())), at = x => text.indexOf(x);
  assert.ok(at('Source of funds'.toUpperCase()) >= 0 || at('SOURCE OF FUNDS') >= 0);
  assert.ok(at('DECLARATION') > at('SOURCE OF FUNDS') && at('RESULT OF THE QUESTIONNAIRE') > at('DECLARATION') && at('CLIENT’S SIGNATURE') > at('RESULT OF THE QUESTIONNAIRE'), 'Source of funds, Declaration, result, signature');
});
test('a blank application still makes a PDF, with every box empty to be written in by hand', () => {
  const out = pdf(store.blank());
  schema.fieldIds.forEach(id => { const f = schema.fieldsById[id]; if (!f.cond && !f.rt && !f.calc) assert.ok(out.includes(norm(f.l)), id); });
  assert.ok(out.includes(norm('None recorded.')));
});
test('beneficiaries added on the screen all go in the PDF, however many', () => {
  const s = filled();
  for (let i = 0; i < 6; i++) store.addRow(s, 'benef', { name: 'ExtraBen' + i, pct: '0' });
  const out = pdf(s);
  for (let i = 0; i < 6; i++) assert.ok(out.includes('extraben' + i));
});
test('characters the PDF font has no shape for are replaced, not lost or broken', () => {
  const s = store.blank(); store.setField(s, 'postal', 'Anna – “the” address… → 中');
  pdf(s);
  assert.ok(rec.join('\n').includes('Anna - "the" address... -> ?'), rec.join('\n'));
});

/* ---------- the questionnaire's own PDF ---------- */
function spyLib() {
  const sets = {};
  const lib = Object.assign({}, PDFLib, {
    PDFDocument: {
      load: async bytes => {
        const pdf = await PDFLib.PDFDocument.load(bytes), getForm = pdf.getForm.bind(pdf);
        pdf.getForm = () => {
          const f = getForm(), tf = f.getTextField.bind(f), rg = f.getRadioGroup.bind(f);
          f.getTextField = n => { const x = tf(n), st = x.setText.bind(x); x.setText = t => { sets[n] = t; return st(t); }; return x; };
          f.getRadioGroup = n => { const x = rg(n), sel = x.select.bind(x); x.select = v => { sets[n] = v; return sel(v); }; return x; };
          return f;
        };
        return pdf;
      }
    }
  });
  return { lib, sets };
}
test('the questionnaire’s PDF is the firm’s own form, filled with the client, the planner, every answer, the score and the profile', async () => {
  const s = answered(named()); const { lib, sets } = spyLib(); global.window.PDFLib = lib;
  const res = await global.window.CS.rtpdf.build(s); global.window.PDFLib = PDFLib;
  assert.strictEqual(sets.client_name, 'Sample Client'); assert.strictEqual(sets.planner_name, schema.planner); assert.strictEqual(sets.assessment_date, s.f.date.v);
  assert.strictEqual(sets.signature_client_name, 'Sample Client'); assert.strictEqual(sets.signature_planner_name, schema.planner);
  for (let i = 1; i <= 18; i++) assert.strictEqual(sets['q' + i], String(RT.scoreFor(i, RT.SCALE.indexOf(s.f['rt_s' + i].v))), 'statement ' + i);
  RT.CAPACITY.forEach((c, i) => assert.strictEqual(sets[c.field], String(c.options.indexOf(s.f['rt_c' + (i + 1)].v) + 1), c.field));
  assert.strictEqual(sets.total_score, String(s.f.risk_score.v)); assert.strictEqual(sets.risk_category, s.f.risk_profile.v);
  assert.strictEqual(String(sets.selected_profile).toLowerCase(), s.f.risk_profile.v.toLowerCase());
  assert.strictEqual(res.reference, s.f.risk_ref.v); assert.strictEqual(res.fileName, store.rtFileName(s));
});
test('the questionnaire’s PDF leaves the client’s signature, the place and the date of signing BLANK, to be signed later', async () => {
  const s = answered(named()); const { lib, sets } = spyLib(); global.window.PDFLib = lib;
  await global.window.CS.rtpdf.build(s); global.window.PDFLib = PDFLib;
  ['client_signature', 'signed_at', 'signed_date'].forEach(n => assert.ok(!(n in sets), n + ' must not be filled in'));
  const t = await PDFLib.PDFDocument.load(Buffer.from(global.window.CS_RT_FORM, 'base64')), names = t.getForm().getFields().map(f => f.getName());
  ['client_signature', 'signed_at', 'signed_date'].forEach(n => assert.ok(names.includes(n), 'the firm’s form has the box ' + n + ' to be signed and dated'));
});
test('the questionnaire’s PDF is a real, flattened, four-page PDF that carries the reference and the client’s name', async () => {
  const s = answered(named()), res = await global.window.CS.rtpdf.build(s);
  assert.strictEqual(Buffer.from(res.bytes.slice(0, 5)).toString(), '%PDF-'); assert.strictEqual(res.blob.type, 'application/pdf');
  const out = await PDFLib.PDFDocument.load(res.bytes);
  assert.strictEqual(out.getPageCount(), 4); assert.strictEqual(out.getForm().getFields().length, 0, 'flattened: the answers cannot be changed by mistake');
  assert.strictEqual(out.getTitle(), 'Risk Tolerance Assessment - Sample Client'); assert.ok(out.getSubject().includes(s.f.risk_ref.v));
});
test('the questionnaire’s PDF is refused, with the reason, until it is answered and the client has a name', async () => {
  const s = named(); await assert.rejects(global.window.CS.rtpdf.build(s), /Answer all 18 statements and the 5 capacity questions first \(0 of 23 so far\)/);
  for (let i = 1; i <= 18; i++) store.setField(s, 'rt_s' + i, 'Agree');
  await assert.rejects(global.window.CS.rtpdf.build(s), /\(18 of 23 so far\)/);
  const noName = answered(store.blank()); await assert.rejects(global.window.CS.rtpdf.build(noName), /Enter the client.s name on the first page/);
});
function named() { const s = store.blank(); store.setField(s, 'fname', 'Sample'); store.setField(s, 'sname', 'Client'); store.setField(s, 'date', '12/11/2026'); return s; }
