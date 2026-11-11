/* The Short Risk Application: its form definition, its answers (saving, reopening, the linked boxes), Load from Fact Find and the Checks panel. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/sr-schema.js');
const store = require('../app/js/sr-store.js');
const check = require('../app/js/sr-check.js');
const ffStore = require('../app/js/store.js');

const set = (s, id, v, st) => store.setField(s, id, v, st);
const VALID_ID = '8001015009087';                 // passes the South African ID check (Luhn) and holds a real date

test('the form definition: unique box ids, every list and condition exists, every choice list is filled', () => {
  const ids = schema.fieldIds;
  assert.strictEqual(new Set(ids).size, ids.length, 'a box id is used twice');
  schema.sections.forEach(s => {
    assert.ok(s.id && s.title);
    assert.ok(s.fields || schema.lists[s.list], s.id + ' has neither boxes nor a list');
  });
  ids.forEach(id => {
    const f = schema.fieldsById[id];
    assert.ok(f.l, id + ' has no label');
    if (f.t === 'sel') assert.ok(Array.isArray(f.o) && f.o.length, id + ' is a list without choices');
    if (f.cond) assert.ok(schema.fieldsById[f.cond.f], id + ' depends on a box that does not exist');
  });
  Object.keys(schema.lists).forEach(k => assert.ok(schema.lists[k].cols.length && schema.lists[k].add, k));
});

test('every section is on exactly one page, and every page section exists', () => {
  const seen = [];
  schema.pages.forEach(p => p.sections.forEach(id => { assert.ok(schema.sectionsById[id], id); seen.push(id); }));
  assert.deepStrictEqual(seen.slice().sort(), schema.sections.map(s => s.id).sort());
  assert.strictEqual(new Set(seen).size, seen.length);
});

test('a blank application: today’s date is set, everything else is empty, both lists are empty', () => {
  const s = store.blank();
  assert.strictEqual(s.app, 'wr-short-risk');
  assert.strictEqual(s.f.date.v, util.todayDMY());
  assert.strictEqual(s.f.date.st, 'preset');
  assert.strictEqual(s.f.fname.v, '');
  assert.deepStrictEqual(s.l, { kids: [], benef: [] });
});

test('boxes are tidied as they are entered: premium as Rand, dates as day/month/year, the ID number without spaces', () => {
  const s = store.blank();
  set(s, 'premium', '1250');
  assert.strictEqual(s.f.premium.v, 'R 1 250.00');
  set(s, 'date', '2026-11-04');
  assert.strictEqual(s.f.date.v, '04/11/2026');
  set(s, 'idno', '800101 5009 087');
  assert.strictEqual(s.f.idno.v, '8001015009087');
  assert.strictEqual(s.f.idno.st, 'confirmed');
  set(s, 'idno', '');
  assert.strictEqual(s.f.idno.st, 'empty');
});

test('Product type: Personal Covers, Joint-Life, Buy & Sell, Contingent Liability, Keyman Cover and Other (Business Covers is gone); Cover lines is gone', () => {
  assert.deepStrictEqual(schema.products, ['Personal Covers', 'Joint-Life', 'Buy & Sell', 'Contingent Liability', 'Keyman Cover', 'Other']);
  assert.ok(!schema.fieldsById.lines, 'no Cover lines box');
  assert.strictEqual(schema.fieldsById.product.t, 'sel');
  assert.ok(!schema.fieldsById.product.free, 'a closed list');
});

test('Other counts only while Product type is Other, is asked for then, and is cleared when the product changes', () => {
  const s = store.blank();
  assert.strictEqual(store.shown(s, 'other'), false);
  set(s, 'product', 'Other');
  assert.strictEqual(store.shown(s, 'other'), true);
  assert.ok(check.run(s).missing.some(m => m.id === 'other'), 'Other must be filled in');
  set(s, 'other', 'Funeral Plan');
  assert.ok(check.run(s).missing.every(m => m.id !== 'other'));
  set(s, 'product', 'Joint-Life');
  assert.strictEqual(s.f.other.v, '');
  assert.strictEqual(store.shown(s, 'other'), false);
  assert.ok(check.run(s).missing.every(m => m.id !== 'other'));
});

test('Owner of the policy starts as The client (preset); the owner’s own boxes count only for someone else, and are asked for then', () => {
  const s = store.blank();
  assert.deepStrictEqual(s.f.owner, { v: 'The client', st: 'preset' });
  assert.deepStrictEqual(schema.owners, ['The client', 'The client’s spouse', 'The client’s business partner', 'Another person']);
  ['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].forEach(id => assert.strictEqual(store.shown(s, id), false, id));
  assert.ok(check.run(s).missing.every(m => !/^ow_/.test(m.id)));
  set(s, 'owner', 'Another person');
  ['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].forEach(id => { assert.strictEqual(store.shown(s, id), true, id); assert.ok(check.run(s).missing.some(m => m.id === id), id); });
  set(s, 'ow_fn', 'Hendrik'); set(s, 'ow_sn', 'Visser'); set(s, 'ow_cell', '0835550202');
  set(s, 'owner', schema.owners[1]);                                  // another choice: the last owner’s details are cleared
  ['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].forEach(id => assert.strictEqual(s.f[id].v, '', id));
  set(s, 'ow_fn', 'Maria'); set(s, 'owner', 'The client');
  assert.strictEqual(s.f.ow_fn.v, '', 'the client owns it: nothing else is kept');
});

test('the owner’s ID number is checked like the client’s, and the cell number like the other phone boxes, but only while they count', () => {
  const s = store.blank();
  set(s, 'ow_id', '1234567890123'); set(s, 'ow_cell', '12');
  assert.deepStrictEqual(check.run(s).problems.filter(p => /^ow_/.test(p.f)), [], 'the client owns it: the boxes do not count');
  set(s, 'owner', 'Another person'); set(s, 'ow_id', '1234567890123'); set(s, 'ow_cell', '12');
  assert.deepStrictEqual(check.run(s).problems.filter(p => /^ow_/.test(p.f)).map(p => p.f).sort(), ['ow_cell', 'ow_id']);
  set(s, 'ow_id', VALID_ID); set(s, 'ow_cell', '083 555 0202');
  assert.deepStrictEqual(check.run(s).problems.filter(p => /^ow_/.test(p.f)), []);
  assert.strictEqual(s.f.ow_id.v, VALID_ID);
});

test('the owner from the Fact Find: the spouse fills by itself (one candidate), business partners are chosen from, the ID is never taken from a spouse', () => {
  const f = ffStore.blank();
  ffStore.setField(f, 'fname', 'Johan'); ffStore.setField(f, 'sname', 'Kuiper'); ffStore.setField(f, 'sp_name', 'Maria Kuiper'); ffStore.setField(f, 'sp_tel', '082 555 0101');
  ffStore.addRow(f, 'shares'); ffStore.setCell(f, 'shares', 0, 'name', 'Pieter Venter'); ffStore.setCell(f, 'shares', 0, 'id', '7001015800087'); ffStore.setCell(f, 'shares', 0, 'cell', '082 111 2222');
  ffStore.addRow(f, 'shares'); ffStore.setCell(f, 'shares', 1, 'name', 'Sarel Smit'); ffStore.setCell(f, 'shares', 1, 'cell', '083 333 4444');
  const text = ffStore.toJSON(f), s = store.blank();
  store.loadFromFactFind(s, text, 'x.json');
  assert.strictEqual(s.f.ow_fn.v, '', 'the client owns it: nothing is filled');
  assert.deepStrictEqual(store.ownerCandidates(s), []);
  set(s, 'owner', schema.owners[1]);
  assert.deepStrictEqual(store.ownerCandidates(s).map(c => c.name), ['Maria Kuiper']);
  assert.deepStrictEqual(['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].map(id => s.f[id].v), ['Maria', 'Kuiper', '', '082 555 0101']);
  assert.deepStrictEqual(['ow_fn', 'ow_sn', 'ow_cell'].map(id => s.f[id].st), ['verify', 'verify', 'verify']);
  assert.strictEqual(s.f.ow_id.st, 'empty', 'the Fact Find has no spouse ID number: it is typed');
  set(s, 'owner', schema.owners[2]);
  assert.deepStrictEqual(store.ownerCandidates(s).map(c => c.name), ['Pieter Venter', 'Sarel Smit']);
  assert.strictEqual(s.f.ow_fn.v, '', 'two partners: nothing is filled until one is chosen');
  assert.ok(store.fillOwnerFrom(s, 1));
  assert.deepStrictEqual(['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].map(id => s.f[id].v), ['Sarel', 'Smit', '', '083 333 4444']);
  assert.ok(store.fillOwnerFrom(s, 0));
  assert.deepStrictEqual(['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'].map(id => s.f[id].v), ['Pieter', 'Venter', '7001015800087', '082 111 2222']);
  set(s, 'owner', 'Another person');
  assert.deepStrictEqual(store.ownerCandidates(s), []);
  assert.strictEqual(store.fillOwnerFrom(s, 0), false);
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual(back.ff, s.ff, 'what the Fact Find knew is kept in the file');
});

test('with exactly one partner in the Fact Find, choosing business partner fills the owner’s boxes at once; a Fact Find with nobody fills nothing', () => {
  const f = ffStore.blank(); ffStore.addRow(f, 'shares'); ffStore.setCell(f, 'shares', 0, 'name', 'Pieter van der Merwe'); ffStore.setCell(f, 'shares', 0, 'cell', '082 111 2222');
  const s = store.blank(); store.loadFromFactFind(s, ffStore.toJSON(f), 'x.json'); set(s, 'owner', schema.owners[2]);
  assert.deepStrictEqual(['ow_fn', 'ow_sn'].map(id => s.f[id].v), ['Pieter', 'van der Merwe'], 'a surname with particles stays together');
  assert.strictEqual(s.f.ow_fn.v, 'Pieter'); assert.strictEqual(s.f.ow_cell.v, '082 111 2222'); assert.strictEqual(s.f.ow_fn.st, 'verify');
  const none = store.blank(); store.loadFromFactFind(none, ffStore.toJSON(ffStore.blank()), 'x.json'); set(none, 'owner', schema.owners[1]);
  assert.strictEqual(none.f.ow_fn.v, '');
  assert.deepStrictEqual(store.ownerCandidates(none), []);
});

test('Confirmation of Cover Call: Day follows the Date and cannot be typed, Time is tidied to 24 hours, all three are optional', () => {
  const s = store.blank(), sec = schema.sectionsById.call;
  assert.strictEqual(sec.title, 'Confirmation of Cover Call | Tele-underwriting Call');
  assert.deepStrictEqual(sec.fields.map(f => f.l), ['Day of call', 'Date of call', 'Time of call']);
  assert.ok(sec.fields.every(f => f.opt), 'optional');
  assert.ok(!schema.fieldsById.best_time && !schema.fieldsById.best_day, 'the old two boxes are gone');
  assert.deepStrictEqual(check.run(s).missing.filter(m => /^call_/.test(m.id)), []);
  set(s, 'call_date', '2026-11-25'); set(s, 'call_time', '2:30 pm');
  assert.strictEqual(s.f.call_date.v, '25/11/2026'); assert.strictEqual(s.f.call_day.v, 'Wednesday'); assert.strictEqual(s.f.call_time.v, '14:30');
  set(s, 'call_date', '26/11/2026'); assert.strictEqual(s.f.call_day.v, 'Thursday');
  set(s, 'call_date', ''); assert.strictEqual(s.f.call_day.v, '');
  set(s, 'call_date', '25/11/2026');
  assert.strictEqual(store.fromJSON(store.toJSON(s)).f.call_day.v, 'Wednesday', 'the Day is worked out again when a file is opened');
  set(s, 'call_time', 'tomorrow'); set(s, 'call_date', '31/02/2026');
  assert.deepStrictEqual(check.run(s).problems.map(p => p.f).sort(), ['call_date', 'call_time']);
});

test('the old policy boxes count only while the policy is replaced, and are cleared when it is not', () => {
  const s = store.blank();
  assert.strictEqual(store.shown(s, 'old_company'), false);
  set(s, 'replace', 'Yes'); set(s, 'old_company', 'Momentum'); set(s, 'old_policy', 'P-123');
  assert.strictEqual(store.shown(s, 'old_company'), true);
  assert.ok(check.run(s).missing.every(m => m.id !== 'old_company'));
  set(s, 'replace', 'No');
  assert.strictEqual(s.f.old_company.v, '');
  assert.strictEqual(s.f.old_policy.v, '');
  assert.ok(check.run(s).missing.every(m => m.id !== 'old_company' && m.id !== 'old_policy'));
  set(s, 'replace', 'Yes');
  assert.ok(check.run(s).missing.some(m => m.id === 'old_company'));
});

test('children and beneficiaries can be added and taken away, any number of them', () => {
  const s = store.blank();
  store.addRow(s, 'kids', { name: 'Anna Kuiper', id: '' });
  store.addRow(s, 'kids', { name: 'Piet Kuiper', id: '' });
  store.addRow(s, 'kids', { name: 'Mia Kuiper', id: '' });
  store.addRow(s, 'benef', { name: 'Jan Kuiper', relation: 'Spouse', pct: '60' });
  store.addRow(s, 'benef', { name: 'Anna Kuiper', relation: 'Child', pct: '40' });
  assert.strictEqual(s.l.kids.length, 3);
  store.delRow(s, 'kids', 1);
  assert.deepStrictEqual(s.l.kids.map(r => r.d.name), ['Anna Kuiper', 'Mia Kuiper']);
  store.setCell(s, 'benef', 0, 'pct', '55.5');
  assert.strictEqual(s.l.benef[0].d.pct, '55.5%');
  store.delRow(s, 'benef', 0); store.delRow(s, 'benef', 0);
  assert.strictEqual(s.l.benef.length, 0);
  assert.ok(check.run(s).problems.every(p => p.l !== 'benef'), 'no beneficiaries is allowed');
});

test('file name: Insurer - Product Application - dd.mm.yy - R amount p.m. - (First Last), the same for the PDF and the saved file', () => {
  const s = store.blank();
  set(s, 'insurer', 'Brightrock'); set(s, 'product', 'Personal Covers'); set(s, 'date', '20/11/2026'); set(s, 'premium', '1000');
  set(s, 'fname', 'Sitamah'); set(s, 'sname', 'Nathoo');
  assert.strictEqual(store.pdfFileName(s), 'BR - Personal Covers Application - 20.11.26 - R 1,000.00 p.m. - (Sitamah Nathoo)');
  assert.strictEqual(store.baseFileName(s), store.pdfFileName(s));
  set(s, 'insurer', 'Old Mutual'); set(s, 'product', 'Buy & Sell'); set(s, 'premium', '12345.5');
  assert.strictEqual(store.pdfFileName(s), 'OM - Buy & Sell Application - 20.11.26 - R 12,345.50 p.m. - (Sitamah Nathoo)');
  set(s, 'insurer', 'Momentum');
  assert.ok(store.pdfFileName(s).startsWith('Momentum - Buy & Sell Application'), 'an insurer with no short name is written out');
});

test('file name: for the Other product the file is named with what is typed in the Other box', () => {
  const s = store.blank();
  set(s, 'insurer', 'Old Mutual'); set(s, 'date', '20/11/2026'); set(s, 'premium', '300'); set(s, 'fname', 'Anna'); set(s, 'sname', 'Kuiper'); set(s, 'product', 'Other');
  assert.strictEqual(store.pdfFileName(s), 'OM - Other Application - 20.11.26 - R 300.00 p.m. - (Anna Kuiper)');
  set(s, 'other', 'Funeral Plan');
  assert.strictEqual(store.pdfFileName(s), 'OM - Funeral Plan Application - 20.11.26 - R 300.00 p.m. - (Anna Kuiper)');
  assert.strictEqual(store.productName(s), 'Funeral Plan');
  set(s, 'product', 'Joint-Life');
  assert.strictEqual(store.pdfFileName(s), 'OM - Joint-Life Application - 20.11.26 - R 300.00 p.m. - (Anna Kuiper)');
});

test('file name before the boxes are filled: nothing is invented, and characters Windows refuses are left out', () => {
  const s = store.blank();
  assert.strictEqual(store.pdfFileName(s), 'Insurer - Risk Application - ' + util.todayDMY().split('/').map((x, i) => i === 2 ? x.slice(2) : x).join('.') + ' - R amount p.m. - (New client)');
  set(s, 'fname', 'Ann/e'); set(s, 'sname', 'O’Brien: "Jr"');
  assert.ok(!/[\\/:*?"<>|]/.test(store.pdfFileName(s)));
});

test('save and reopen: every box, both lists, the statuses and the Fact Find source come back the same', () => {
  const s = store.blank();
  schema.fieldIds.forEach(id => { const f = schema.fieldsById[id]; set(s, id, f.o ? f.o[0] : f.t === 'money' ? '900' : f.t === 'date' ? '01/02/2026' : 'Sample ' + id); });
  set(s, 'cell', '0821234567', 'verify');
  store.addRow(s, 'kids', { name: 'Anna', id: VALID_ID }, 'verify');
  store.addRow(s, 'benef', { name: 'Jan', id: '', relation: 'Spouse', pct: '100' });
  s.from = { name: 'Fact Find - x.json', at: '2026-11-10T08:00:00.000Z' };
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual(back.f, s.f);
  assert.deepStrictEqual(back.l, s.l);
  assert.deepStrictEqual(back.from, s.from);
  assert.strictEqual(back.f.cell.st, 'verify');
  assert.strictEqual(back.l.kids[0].st, 'verify');
});

test('a file that is not a Short Risk Application is refused, also a Fact Find', () => {
  assert.throws(() => store.fromJSON('{"app":"other"}'), /Short Risk Application/);
  assert.throws(() => store.fromJSON(ffStore.toJSON(ffStore.blank())), /Short Risk Application/);
  assert.throws(() => store.fromJSON('not json'));
});

test('an older or damaged file opens: unknown boxes are ignored, missing ones are blank', () => {
  const s = store.fromJSON(JSON.stringify({ app: 'wr-short-risk', f: { fname: { v: 'Anna' }, nonsense: { v: 'x' } }, l: { kids: [{ d: { name: 'Mia', extra: 'x' } }], other: [] } }));
  assert.strictEqual(s.f.fname.v, 'Anna');
  assert.strictEqual(s.f.fname.st, 'confirmed');
  assert.strictEqual(s.f.sname.v, '');
  assert.deepStrictEqual(s.l.kids[0].d, { name: 'Mia', id: '' });
  assert.deepStrictEqual(s.l.benef, []);
  assert.ok(!('nonsense' in s.f));
});

/* ---------- Load from Fact Find ---------- */
function factFind() {
  const f = ffStore.blank();
  ffStore.setField(f, 'fname', 'Anna Maria'); ffStore.setField(f, 'sname', 'Kuiper'); ffStore.setField(f, 'idno', VALID_ID);
  ffStore.setField(f, 'cell', '082 123 4567'); ffStore.setField(f, 'work', '011 555 0000'); ffStore.setField(f, 'pemail', 'anna@example.com'); ffStore.setField(f, 'wemail', 'anna@work.example.com');
  ffStore.addRow(f, 'kids'); ffStore.setCell(f, 'kids', 0, 'name', 'Mia'); ffStore.setCell(f, 'kids', 0, 'sname', 'Kuiper');
  ffStore.addRow(f, 'kids'); ffStore.setCell(f, 'kids', 1, 'name', 'Piet'); ffStore.setCell(f, 'kids', 1, 'sname', 'Kuiper');
  return ffStore.toJSON(f);
}

test('Load from Fact Find fills the client, the contact details and the children, all marked to verify', () => {
  const s = store.blank(), rep = store.loadFromFactFind(s, factFind(), 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json');
  assert.deepStrictEqual([s.f.fname.v, s.f.sname.v, s.f.idno.v, s.f.cell.v, s.f.work.v, s.f.email.v], ['Anna Maria', 'Kuiper', VALID_ID, '082 123 4567', '011 555 0000', 'anna@example.com']);
  ['fname', 'sname', 'idno', 'cell', 'work', 'email'].forEach(id => assert.strictEqual(s.f[id].st, 'verify', id));
  assert.deepStrictEqual(s.l.kids.map(r => [r.d.name, r.st]), [['Mia Kuiper', 'verify'], ['Piet Kuiper', 'verify']]);
  assert.strictEqual(rep.children, 2);
  assert.strictEqual(rep.loaded.length, 6);
  assert.strictEqual(s.from.name, 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json');
  assert.strictEqual(store.counts(s).verify, 8);
  store.accept(s, 'f:fname'); store.accept(s, 'l:kids:0');
  assert.strictEqual(s.f.fname.st, 'confirmed'); assert.strictEqual(s.l.kids[0].st, 'confirmed');
  assert.strictEqual(store.counts(s).verify, 6);
  store.acceptAll(s);
  assert.strictEqual(store.counts(s).verify, 0);
});

test('Load from Fact Find uses the work e-mail when there is no personal one, and never overwrites what was typed', () => {
  const f = ffStore.blank(); ffStore.setField(f, 'fname', 'Anna'); ffStore.setField(f, 'wemail', 'anna@work.example.com'); ffStore.setField(f, 'cell', '0821234567');
  const s = store.blank(); set(s, 'cell', '0831111111'); set(s, 'fname', 'Annette');
  const rep = store.loadFromFactFind(s, ffStore.toJSON(f), 'x.json');
  assert.strictEqual(s.f.email.v, 'anna@work.example.com');
  assert.strictEqual(s.f.cell.v, '0831111111');
  assert.strictEqual(s.f.fname.v, 'Annette');
  assert.deepStrictEqual(rep.kept.sort(), ['Cell', 'Full names']);
  assert.strictEqual(s.f.cell.st, 'confirmed');
});

test('Load from Fact Find twice does not repeat the children', () => {
  const s = store.blank(), ff = factFind();
  store.loadFromFactFind(s, ff, 'x.json'); const again = store.loadFromFactFind(s, ff, 'x.json');
  assert.strictEqual(s.l.kids.length, 2);
  assert.strictEqual(again.children, 0);
  store.addRow(s, 'kids', { name: 'Third Child', id: '' });
  store.loadFromFactFind(s, ff, 'x.json');
  assert.strictEqual(s.l.kids.length, 3);
});

test('Load from Fact Find refuses a file that is not a Fact Find, and leaves the application as it was', () => {
  const s = store.blank(); set(s, 'fname', 'Anna');
  const before = JSON.stringify(s.f);
  assert.throws(() => store.loadFromFactFind(s, store.toJSON(store.blank()), 'x.json'), /not a Wealth Revolution Fact Find/);
  assert.throws(() => store.loadFromFactFind(s, 'nonsense', 'x.json'), /cannot be read/);
  assert.strictEqual(JSON.stringify(s.f), before);
  assert.strictEqual(s.from, null);
});

/* ---------- progress and checks ---------- */
test('progress: filled, to verify, and what is still to answer (optional boxes do not count as to answer)', () => {
  const s = store.blank();
  const c0 = store.counts(s), required = schema.fieldIds.filter(id => !schema.fieldsById[id].opt && store.shown(s, id) && s.f[id].v === '').length;   // the date is already there
  assert.strictEqual(c0.left, required);
  assert.strictEqual(c0.filled, 2);                          // the date and the owner (The client)
  set(s, 'work', '0115550000');
  assert.strictEqual(store.counts(s).left, required);       // Work is optional
  assert.strictEqual(store.counts(s).filled, 3);
  set(s, 'fname', 'Anna');
  assert.strictEqual(store.counts(s).left, required - 1);
  assert.strictEqual(store.leftIn(s, schema.sections.find(x => x.id === 'client')), 3);
});

test('checks: a filled, correct application has nothing missing and no problem', () => {
  const s = store.blank();
  const v = { insurer: 'Brightrock', quote: 'Q-1', product: 'Personal Covers', premium: '1500', ownerpays: 'Yes', title: 'Mrs', fname: 'Anna', sname: 'Kuiper', idno: VALID_ID,
    cell: '0821234567', email: 'anna@example.com', street_no: '5', street: 'Main Road', suburb: 'Sandton', city: 'Johannesburg', postal: '2196',
    acc_holder: 'A Kuiper', bank: 'FNB', branch_code: '250655', acc_type: 'Cheque', debit_date: '25', acc_no: '62012345678', insolvent: 'No', debt_review: 'No', debt_help: 'No', replace: 'No' };
  Object.keys(v).forEach(id => set(s, id, v[id]));
  const r = check.run(s);
  assert.deepStrictEqual(r.missing, []);
  assert.deepStrictEqual(r.problems, []);
  assert.strictEqual(store.counts(s).left, 0);
});

test('checks: wrong ID, phone, e-mail, postal code, branch code and account number are flagged against their box', () => {
  const s = store.blank();
  set(s, 'idno', '1234567890123'); set(s, 'cell', '082 123'); set(s, 'email', 'anna.example.com'); set(s, 'postal', '21'); set(s, 'branch_code', '2506'); set(s, 'acc_no', '12ab');
  const ids = check.run(s).problems.map(p => p.f).sort();
  assert.deepStrictEqual(ids, ['acc_no', 'branch_code', 'cell', 'email', 'idno', 'postal']);
});

test('checks: the debit date cannot be the 10th to the 14th, and must be a day of the month', () => {
  const s = store.blank(), msg = () => check.run(s).problems.filter(p => p.f === 'debit_date').map(p => p.level);
  ['10', '12', '14', '14th', '12/05/2026'].forEach(d => { set(s, 'debit_date', d); assert.deepStrictEqual(msg(), ['bad'], d); });
  ['1', '9', '15', '25', '31', '25th'].forEach(d => { set(s, 'debit_date', d); assert.deepStrictEqual(msg(), [], d); });
  ['0', '32', 'monthly'].forEach(d => { set(s, 'debit_date', d); assert.deepStrictEqual(msg(), ['bad'], d); });
});

test('checks: beneficiary shares must add up to 100%, and every beneficiary needs a share', () => {
  const s = store.blank(), pr = () => check.run(s).problems.filter(p => p.l === 'benef');
  store.addRow(s, 'benef', { name: 'Jan', pct: '60' }); store.addRow(s, 'benef', { name: 'Anna', pct: '30' });
  assert.strictEqual(pr().length, 1); assert.strictEqual(pr()[0].level, 'bad'); assert.ok(/90%/.test(pr()[0].text));
  store.setCell(s, 'benef', 1, 'pct', '40');
  assert.deepStrictEqual(pr(), []);
  store.addRow(s, 'benef', { name: 'Third', pct: '' });
  assert.strictEqual(pr()[0].level, 'warn');
});

test('checks: a child or beneficiary without a name, or with a wrong ID number, is flagged on its row', () => {
  const s = store.blank();
  store.addRow(s, 'kids', { name: '', id: VALID_ID }); store.addRow(s, 'kids', { name: 'Mia', id: '1111' });
  const p = check.run(s).problems.filter(x => x.l === 'kids');
  assert.deepStrictEqual(p.map(x => x.i), [0, 1]);
});

test('checks: a policy owner who does not pay is flagged', () => {
  const s = store.blank();
  set(s, 'ownerpays', 'No');
  assert.deepStrictEqual(check.run(s).problems.map(p => p.f), ['ownerpays']);
});

test('a file saved by version 1.0 opens with the owner as the client (empty or the client\u2019s own name) or as Another person with the typed name to verify; newer files are left as they are', () => {
  const base = (owner, extra) => JSON.stringify(Object.assign({ app: 'wr-short-risk', schema: '1.0', f: { fname: { v: 'Anna', st: 'confirmed' }, sname: { v: 'Kuiper', st: 'confirmed' }, owner: { v: owner, st: owner ? 'confirmed' : 'empty' }, lines: { v: 'Personal', st: 'preset' }, best_time: { v: '9am', st: 'confirmed' } }, l: {} }, extra));
  let s = store.fromJSON(base(''));
  assert.deepStrictEqual(s.f.owner, { v: 'The client', st: 'preset' }); assert.strictEqual(store.shown(s, 'ow_fn'), false);
  s = store.fromJSON(base('Anna Kuiper')); assert.strictEqual(s.f.owner.v, 'The client'); assert.strictEqual(s.f.ow_fn.v, '');
  s = store.fromJSON(base('client')); assert.strictEqual(s.f.owner.v, 'The client');
  s = store.fromJSON(base('Maria Kuiper'));
  assert.strictEqual(s.f.owner.v, 'Another person'); assert.deepStrictEqual(s.f.ow_fn, { v: 'Maria Kuiper', st: 'verify' }); assert.strictEqual(store.shown(s, 'ow_fn'), true);
  assert.ok(!('lines' in s.f) && !('best_time' in s.f), 'the boxes that no longer exist are dropped');
  const newer = store.fromJSON(JSON.stringify({ app: 'wr-short-risk', schema: '1.1', f: { owner: { v: '', st: 'empty' } }, l: {} }));
  assert.strictEqual(newer.f.owner.v, '', 'a file saved by 1.1 or later is not migrated');
  assert.strictEqual(schema.version, '1.2');
});
