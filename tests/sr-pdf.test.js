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
    const f = schema.fieldsById[id]; let v = 'Sample' + id.replace(/_/g, ''); if (f.calc) return;                  // a box worked out from another is not typed
    if (f.o) v = f.o[0]; if (f.t === 'money') v = '1234'; if (f.t === 'date') v = '14/03/2026'; if (f.t === 'time') v = '14:30'; if (id === 'debit_date') v = '25';
    store.setField(s, id, v);
  });
  store.setField(s, 'replace', 'Yes'); store.setField(s, 'old_company', 'Samplecompany'); store.setField(s, 'old_policy', 'Samplepolicy');
  store.setField(s, 'product', 'Other'); store.setField(s, 'other', 'Sampleother');                        // the boxes that count only for Other, and for an owner who is not the client
  store.setField(s, 'owner', schema.owners[1]); ['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].forEach(id => store.setField(s, id, 'Sample' + id.replace(/_/g, '')));
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

test('the Other box is in the PDF only for the Other product, and the owner\u2019s boxes only when the owner is not the client', () => {
  const s = store.blank();
  let out = pdf(s);
  assert.ok(!out.includes(norm('Owner\u2019s full names')) && !out.includes(norm('Owner\u2019s cell number')), 'the client owns it');
  assert.ok(out.includes(norm('Owner of the policy')) && out.includes(norm('The client')));
  store.setField(s, 'owner', 'Another person'); store.setField(s, 'ow_fn', 'Hendrik'); store.setField(s, 'ow_sn', 'Visser'); store.setField(s, 'ow_id', '5203150123081'); store.setField(s, 'ow_cell', '083 555 0202');
  out = pdf(s);
  ['Owner\u2019s full names', 'Owner\u2019s surname', 'Owner\u2019s ID number', 'Owner\u2019s cell number'].forEach(l => assert.ok(out.includes(norm(l)), l));
  ['hendrik', 'visser', '5203150123081', '0835550202', 'anotherperson'].forEach(x => assert.ok(out.includes(x), x));
  store.setField(s, 'owner', 'The client');
  assert.ok(!pdf(s).includes('hendrik'), 'back to the client: the old owner is not printed');
  store.setField(s, 'product', 'Other'); store.setField(s, 'other', 'Funeral Plan');
  out = pdf(s);
  assert.ok(out.includes(norm('Funeral Plan')), 'the Other product is printed, also on the first page header');
});

test('Confirmation of Cover Call | Tele-underwriting Call: the heading, then Day, Date and Time, are in the PDF', () => {
  const s = store.blank(); store.setField(s, 'call_date', '25/11/2026'); store.setField(s, 'call_time', '14:30');
  const out = pdf(s);
  [norm('Confirmation of Cover Call | Tele-underwriting Call'), norm('Day of call'), norm('Date of call'), norm('Time of call'), 'wednesday', '25112026', '1430'].forEach(x => assert.ok(out.includes(x), x));
  assert.ok(!out.includes(norm('Best time for us to phone you')) && !out.includes(norm('Best work day')), 'the old boxes are gone');
});
