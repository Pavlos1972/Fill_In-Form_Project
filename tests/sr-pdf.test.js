/* The Short Risk Application PDF mirrors the form: every box, heading and column of the screen is in it, under the same words, and the client's answers are in it.
   jsPDF is replaced here by a recorder that keeps every piece of text the PDF would draw, and the pages it would add. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/sr-schema.js');
const store = require('../app/js/sr-store.js');

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
global.window = { FF: { util, logo: { data: '', w: 1, h: 1 } }, SR: { schema, store }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/sr-pdf.js');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const pdf = state => { rec = []; global.window.SR.pdf.build(state); return norm(rec.join(' ')); };

function filled() {
  const s = store.blank();
  schema.fieldIds.forEach(id => {
    const f = schema.fieldsById[id]; let v = 'Sample' + id.replace(/_/g, '');
    if (f.o) v = f.o[0]; if (f.t === 'money') v = '1234'; if (f.t === 'date') v = '14/03/2026'; if (id === 'debit_date') v = '25';
    store.setField(s, id, v);
  });
  store.setField(s, 'replace', 'Yes'); store.setField(s, 'old_company', 'Samplecompany'); store.setField(s, 'old_policy', 'Samplepolicy');
  store.addRow(s, 'kids', { name: 'KidOne Name', id: '1111111111111' }); store.addRow(s, 'kids', { name: 'KidTwo Name', id: '2222222222222' });
  store.addRow(s, 'benef', { name: 'BenefOne Name', id: '3333333333333', relation: 'Spouse', pct: '60' }); store.addRow(s, 'benef', { name: 'BenefTwo Name', id: '4444444444444', relation: 'Child', pct: '40' });
  return s;
}

test('every section heading, box label and list column of the form is in the PDF', () => {
  const out = pdf(filled());
  schema.sections.forEach(s => assert.ok(out.includes(norm(s.title)), 'heading missing: ' + s.title));
  schema.fieldIds.forEach(id => assert.ok(out.includes(norm(schema.fieldsById[id].l)), 'label missing: ' + schema.fieldsById[id].l));
  Object.keys(schema.lists).forEach(k => schema.lists[k].cols.forEach(c => assert.ok(out.includes(norm(c.l)), 'column missing: ' + c.l)));
  assert.ok(out.includes(norm('Total of the shares')) && out.includes('100'), 'the total of the beneficiaries’ shares');
});

test('every answer is in the PDF, as it is on the screen', () => {
  const s = filled(), out = pdf(s);
  schema.fieldIds.forEach(id => assert.ok(out.includes(norm(s.f[id].v)), 'answer missing for ' + id + ': ' + s.f[id].v));
  ['kids', 'benef'].forEach(k => s.l[k].forEach(r => Object.keys(r.d).forEach(c => assert.ok(out.includes(norm(r.d[c])), k + ' ' + c + ' missing: ' + r.d[c]))));
  assert.ok(out.includes(norm('R 1 234.00')), 'the premium as Rand');
});

test('the title, the client, the insurer and the signature block are on it', () => {
  const s = filled(); store.setField(s, 'fname', 'Anna'); store.setField(s, 'sname', 'Kuiper');
  const out = pdf(s);
  ['shortriskapplication', 'annakuiper', 'clientssignature', 'date'].forEach(x => assert.ok(out.includes(x), x));
  assert.ok(out.includes(norm(s.f.insurer.v)) && out.includes(norm(s.f.product.v)));
});

test('a blank application still makes a PDF, with every box empty to be written in by hand, and says None recorded for the lists', () => {
  const out = pdf(store.blank());
  assert.ok(out.includes('norecorded') || out.includes(norm('None recorded.')));
  schema.fieldIds.forEach(id => { if (!schema.fieldsById[id].cond) assert.ok(out.includes(norm(schema.fieldsById[id].l)), id); });
});

test('the old policy’s company and number are in the PDF only when the policy is replaced', () => {
  const s = store.blank(); store.setField(s, 'replace', 'No');
  let out = pdf(s);
  assert.ok(!out.includes(norm('Policy number')), 'not replaced: the old policy boxes are left off');
  store.setField(s, 'replace', 'Yes'); store.setField(s, 'old_company', 'Momentum'); store.setField(s, 'old_policy', 'P-1');
  out = pdf(s);
  assert.ok(out.includes(norm('Policy number')) && out.includes('momentum') && out.includes('p1'));
});

test('children and beneficiaries added on the screen all go in the PDF, however many', () => {
  const s = filled();
  for (let i = 0; i < 6; i++) store.addRow(s, 'kids', { name: 'ExtraKid' + i, id: '' });
  for (let i = 0; i < 4; i++) store.addRow(s, 'benef', { name: 'ExtraBen' + i, id: '', relation: 'Other', pct: '0' });
  const out = pdf(s);
  for (let i = 0; i < 6; i++) assert.ok(out.includes('extrakid' + i));
  for (let i = 0; i < 4; i++) assert.ok(out.includes('extraben' + i));
});

test('characters the PDF font has no shape for are replaced, not lost or broken', () => {
  const s = store.blank(); store.setField(s, 'owner', 'Anna – “the” owner… → 中');
  pdf(s);
  const t = rec.join('\n');
  assert.ok(t.includes('Anna - "the" owner... -> ?'), t);
});
