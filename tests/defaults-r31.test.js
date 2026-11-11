/* Release 3.1 defaults: Term left "Max term" for a credit card or revolving credit; Asset value R 0.00 for every debt that is not on a property; Qualification details N/A for Matric; Employer N/A when not employed. */
const test = require('node:test');
const assert = require('node:assert');
const store = require('../app/js/store.js');

const set = (s, id, v, st) => store.setField(s, id, v, st);
const debt = (s, d) => { const r = store.addRow(s, 'debts', d); return r; };

test('a credit card or revolving credit starts with the Term left "Max term"; other types and a typed term are left alone', () => {
  const s = store.blank();
  assert.strictEqual(debt(s, { type: 'Credit card' }).d.term, 'Max term');
  assert.strictEqual(debt(s, { type: 'Revolving credit' }).d.term, 'Max term');
  assert.strictEqual(debt(s, { type: 'Personal loan' }).d.term, '');
  assert.strictEqual(debt(s, { type: 'Home loan' }).d.term, '');
  assert.strictEqual(debt(s, { type: 'Credit card', term: '24 months' }).d.term, '24', 'what was typed stays (as months)');
  const r = debt(s, {}); assert.strictEqual(r.d.term, '', 'no type yet, no default');
  store.setCell(s, 'debts', s.l.debts.length - 1, 'type', 'Credit card'); assert.strictEqual(r.d.term, 'Max term', 'the default comes when the type is chosen');
});

test('every debt that is not on a property starts with the Asset value R 0.00, also a car; a home loan starts empty', () => {
  const s = store.blank();
  ['Credit card', 'Revolving credit', 'Personal loan', 'Vehicle finance', 'Other'].forEach(t => assert.strictEqual(debt(s, { type: t }).d.asset, 'R 0.00', t));
  assert.strictEqual(debt(s, { type: 'Home loan' }).d.asset, '');
  assert.strictEqual(debt(s, { type: 'Credit card', asset: 'R 5 000.00' }).d.asset, 'R 5 000.00', 'a typed value is never replaced');
});

test('when the type changes, the R 0.00 default goes from a property loan and comes to a debt that is not one; an Other debt that says house is a property', () => {
  const s = store.blank(), r = debt(s, { type: 'Credit card' }), i = 0;
  store.setCell(s, 'debts', i, 'type', 'Home loan'); assert.strictEqual(r.d.asset, '', 'a home loan needs a value');
  store.setCell(s, 'debts', i, 'type', 'Vehicle finance'); assert.strictEqual(r.d.asset, 'R 0.00');
  store.setCell(s, 'debts', i, 'type', 'Other'); store.setCell(s, 'debts', i, 'desc', 'Townhouse in Fourways'); assert.strictEqual(r.d.asset, '', 'Other on a townhouse is a property');
  assert.ok(store.isPropertyDebt({ type: 'Other', desc: 'flat in Sandton' }) && !store.isPropertyDebt({ type: 'Other', desc: 'staff loan' }) && !store.isPropertyDebt({ type: 'Vehicle finance', desc: 'house' }));
});

test('a file opened from before gets the defaults for empty boxes and keeps every typed answer', () => {
  const s = store.blank(); set(s, 'edu', 'Matric'); set(s, 'employed', 'No');
  debt(s, { type: 'Credit card' }); debt(s, { type: 'Home loan', asset: 'R 2 000 000.00' });
  const j = JSON.parse(store.toJSON(s)); j.l.debts[0].d.term = ''; j.l.debts[0].d.asset = ''; j.f.edu_notes = { v: '', st: 'empty' }; j.f.employer = { v: '', st: 'empty' };
  const o = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual([o.l.debts[0].d.term, o.l.debts[0].d.asset, o.l.debts[1].d.asset], ['Max term', 'R 0.00', 'R 2 000 000.00']);
  assert.deepStrictEqual([o.f.edu_notes.v, o.f.employer.v], ['N/A', 'N/A']);
  j.f.edu_notes = { v: 'Matric 1991, Parktown Boys', st: 'confirmed' }; j.f.employer = { v: 'Acme', st: 'confirmed' };
  const t = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual([t.f.edu_notes.v, t.f.employer.v], ['Matric 1991, Parktown Boys', 'Acme']);
});

test('Qualification details starts as N/A for Matric (a default, not counted as answered), and goes again when the education changes; a typed answer stays', () => {
  const s = store.blank();
  set(s, 'edu', 'Matric'); assert.deepStrictEqual(s.f.edu_notes, { v: 'N/A', st: 'preset' });
  set(s, 'edu', 'Postgraduate'); assert.deepStrictEqual(s.f.edu_notes, { v: '', st: 'empty' });
  set(s, 'edu', 'Matric & diploma'); assert.strictEqual(s.f.edu_notes.v, '', 'Matric & diploma is not Matric');
  set(s, 'edu', 'Matric'); set(s, 'edu_notes', 'Matric only'); set(s, 'edu', 'Postgraduate'); assert.strictEqual(s.f.edu_notes.v, 'Matric only');
});

test('Employer starts as N/A when the client is not employed, and goes again when Employed changes; a typed employer stays', () => {
  const s = store.blank();
  set(s, 'employed', 'No'); assert.deepStrictEqual(s.f.employer, { v: 'N/A', st: 'preset' });
  set(s, 'employed', 'Yes'); assert.deepStrictEqual(s.f.employer, { v: '', st: 'empty' });
  set(s, 'employer', 'Acme'); set(s, 'employed', 'No'); assert.strictEqual(s.f.employer.v, 'Acme', 'a typed employer is never replaced');
});
