/* Version 3.2: the Current Client section at the bottom of Admin. One large box, "Current Client File Summary Notes" (id cc_notes), active only when Referral from is Current client. A skill that reads the client's file
   in AdviceTech will write the summary, in points, into the saved file; the box is typed by hand too, never filled by voice, printed in the PDF only when active, and never read for the action points. */
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
const NOTES = '- Client since 2019\n- Has a risk policy with Old Mutual\n- Prefers contact by WhatsApp';

test('the section is the last block of Admin, full width, with one large optional box', () => {
  const admin = schema.sections.find(s => s.id === 'admin'), b = admin.blocks[admin.blocks.length - 1], f = b.fields[0];
  assert.strictEqual(b.title, 'Current Client'); assert.ok(b.full && b.grey && !b.left, 'full width, greyed when not active');
  assert.deepStrictEqual([f.id, f.l, f.t, !!f.opt, !!f.wide, f.rows], ['cc_notes', 'Current Client File Summary Notes', 'area', true, true, 12]);
  assert.strictEqual(admin.blocks[admin.blocks.length - 2].title, 'Action Points for Personal Assistant', 'after Action Points, which keep their place');
  assert.strictEqual(schema.version, '3.4');
});

test('it is active only when Referral from is Current client', () => {
  const b = schema.fieldsById.cc_notes, blk = schema.sections.find(s => s.id === 'admin').blocks.find(x => x.title === 'Current Client');
  const on = v => { const s = store.blank(); if (v) set(s, 'ref', v); return calc.showIf(blk.cond, store.ctxFor(s)); };
  assert.ok(on('Current client'));
  ['D&R Marketing', 'Referral prospect', 'Spouse', 'Other', ''].forEach(v => assert.ok(!on(v), 'not active for "' + v + '"'));
  assert.ok(schema.fieldsById.ref.o.includes('Current client'), 'the choice the section waits for exists in Referral from');
  assert.ok(b && /current client/i.test(blk.condMsg), 'the greyed section says why');
});

test('what is typed is kept in the file and comes back, whatever Referral from says later; an older file opens with the box empty', () => {
  const s = store.blank(); set(s, 'ref', 'Current client'); set(s, 'cc_notes', NOTES);
  set(s, 'ref', 'Other');
  const o = store.fromJSON(store.toJSON(s));
  assert.strictEqual(o.f.cc_notes.v, NOTES); assert.strictEqual(o.f.ref.v, 'Other');
  const old = JSON.parse(store.toJSON(s)); delete old.f.cc_notes;
  assert.strictEqual(store.fromJSON(JSON.stringify(old)).f.cc_notes.v, '', 'a file saved before the box existed');
});

test('a skill can write the summary into the saved file: the points and the amber status are kept', () => {
  const s = store.blank(); set(s, 'ref', 'Current client');
  const j = JSON.parse(store.toJSON(s)); j.f.cc_notes = { v: NOTES, st: 'verify' };
  const o = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual(o.f.cc_notes, { v: NOTES, st: 'verify' });
});

test('the PDF prints the heading and the points when the section is active, and nothing for any other referral', () => {
  const s = store.blank(); set(s, 'fname', 'Sample'); set(s, 'cc_notes', NOTES);
  const text = cells => cells.join('\n');
  set(s, 'ref', 'Current client');
  const on = pdfCells(s);
  assert.ok(on.includes('Current Client'), 'the section heading'); assert.ok(on.some(c => c === 'Current Client File Summary Notes'), 'the label');
  assert.ok(on.some(c => c.indexOf('Has a risk policy with Old Mutual') >= 0), 'the points');
  set(s, 'ref', 'Referral prospect');
  const off = pdfCells(s);
  assert.ok(!off.includes('Current Client') && !off.some(c => c === 'Current Client File Summary Notes') && !/Old Mutual/.test(text(off)), 'a held text is not printed for another referral');
  set(s, 'ref', '');
  assert.ok(!pdfCells(s).includes('Current Client'), 'nothing before Referral from is answered');
});

test('voice never fills the box, it is not a notes box, and the action points never read it', () => {
  const idx = V.buildIndex(schema);
  assert.ok(!idx.byId.cc_notes && !idx.notes.some(n => n.id === 'cc_notes'));
  const s = store.blank(); set(s, 'fname', 'Sample'); set(s, 'ref', 'Current client'); set(s, 'cc_notes', '- Send her the old policy schedule again');
  const f = actions.facts(s);
  assert.ok(!f.notes.some(n => n.id === 'cc_notes') && !JSON.stringify(f).includes('old policy schedule'), 'background from an old file is not an instruction to Sitamah');
  assert.ok(!actions.local(s).some(p => /old policy schedule/.test(p)));
});

test('the box is optional: it is not counted as a question still to ask and does not make a Check', () => {
  const validate = require('../app/js/validate.js'), admin = schema.sections.find(x => x.id === 'admin');
  const s = store.blank(); set(s, 'ref', 'Current client');
  const empty = store.counts(s, admin);
  set(s, 'cc_notes', NOTES);
  const filled = store.counts(s, admin);
  assert.deepStrictEqual(filled, empty, 'filling it changes no count');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)).filter(w => w.id === 'cc_notes'), [], 'no Check names it');
});
