/* The last three audit findings: the child cost is childcare (the EGAR is not touched), each fact is asked once, and the pages are in the order the work goes. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const sec = id => schema.sections.find(x => x.id === id);
const ids = b => (b.fields || []).map(f => f.id);
const reopen = (mutate) => { const j = JSON.parse(store.toJSON(fresh())); mutate(j); return store.fromJSON(JSON.stringify(j)); };

/* ---- #10 ---- */
test('the child cost box is childcare, says so, and the EGAR panel is left exactly as it was', () => {
  const col = schema.lists.kids.cols.find(c => c.k === 'cost');
  assert.strictEqual(col.l, 'Childcare (R p.m.)');
  assert.match(sec('kids').blocks.find(b => b.list === 'kids').help, /whatever amount is agreed on the call/);
  assert.deepStrictEqual(schema.panelsById.egar.sum, { f: ['egar_req'], l: { kids: ['age', 'stage', 'cost'] } });      // nothing about the EGAR was changed
  const s = fresh(); set(s, 'net', 'R 40 000.00'); store.addRow(s, 'kids', { name: 'A', cost: 'R 3 000.00' });
  assert.strictEqual(calc.field('cc', store.ctxFor(s)), 'R 3 000.00'); assert.strictEqual(calc.field('need', store.ctxFor(s)), 'R 37 000.00');
});

/* ---- #19 ---- */
test('the referral boxes no longer have the choices that restate a box above them', () => {
  assert.deepStrictEqual(schema.fieldsById.ref_will.o, ['Capital Legacy to contact client', 'Not required']);
  assert.deepStrictEqual(schema.fieldsById.ref_sti.o, ['Cameron to contact client', 'Not required']);
});

test('an older file that held "Client has own broker" or "Has updated will" keeps the fact in its own box', () => {
  const s = reopen(j => { j.f.ref_sti = { v: 'Client has own broker', st: 'confirmed' }; j.f.ref_will = { v: 'Has updated will', st: 'confirmed' }; });
  assert.deepStrictEqual([s.f.ref_sti.v, s.f.sti.v, s.f.sti_broker.v], ['Not required', 'Yes', 'Other broker']);
  assert.deepStrictEqual([s.f.ref_will.v, s.f.will.v, s.f.will_up.v], ['Not required', 'Yes', 'Yes']);
  const kept = reopen(j => { j.f.ref_sti = { v: 'Client has own broker', st: 'confirmed' }; j.f.sti = { v: 'Yes', st: 'confirmed' }; j.f.sti_broker = { v: 'Cameron Maritz', st: 'confirmed' }; });
  assert.strictEqual(kept.f.sti_broker.v, 'Other broker');                                                            // what was in the box is kept (the old choice "Cameron Maritz" is Other broker now)
  assert.ok(!A.facts(s).referrals.length);
});

/* ---- #25 ---- */
test('the pages are in the order the work goes: debts and children come straight after income', () => {
  assert.deepStrictEqual(schema.sections.map(s => s.id), ['info', 'occ', 'income', 'debts', 'kids', 'cover', 'retire', 'inv', 'other', 'health', 'prio', 'calc', 'admin']);
});

test('Smoker is back on Client info (Background, next to Highest education), not on Health', () => {
  const bg = sec('info').blocks.find(b => b.title === 'Background');
  assert.deepStrictEqual(ids(bg), ['smoker', 'edu', 'edu_notes']);
  assert.deepStrictEqual(bg.fields.map(f => f.s), [3, 3, 6]);
  assert.ok(!sec('health').blocks.some(b => ids(b).includes('smoker')));
  assert.strictEqual(fresh().f.smoker.v, '');
  const old = reopen(j => { j.f.smoker = { v: 'Smoker', st: 'confirmed' }; }); assert.strictEqual(old.f.smoker.v, 'Smoker');        // same box, so older files keep the answer
});

test('the Letter of Authority is on the Admin page, in the narrow column with the next appointment', () => {
  const admin = sec('admin');
  assert.deepStrictEqual(admin.blocks.map(b => b.title), ['Letter of Authority', 'Next appointment', 'Action Points for Personal Assistant', 'Current Client']);
  assert.deepStrictEqual(admin.blocks.map(b => !!b.left), [true, true, false, false]);
  assert.ok(!sec('cover').blocks.some(b => ids(b).includes('loa')));
  const s = fresh(); set(s, 'loa', 'Yes'); set(s, 'fname', 'Thandi'); set(s, 'ps_inv', 'Draw from Astute (with signed LOA)');
  assert.ok(A.local(s).some(l => /Send the client Thandi the LOA to sign/.test(l)));                                           // the action points read the same box
});

test('the retirement annuities and the pension and provident funds each keep their own schedule request, under their own list', () => {
  const blocks = sec('retire').blocks, at = id => blocks.findIndex(b => ids(b).includes(id));
  assert.ok(schema.fieldsById.ps_ra && schema.fieldsById.ps_pp && schema.fieldsById.ps_ra_ot && schema.fieldsById.ps_pp_ot);
  assert.strictEqual(at('ps_ra'), blocks.findIndex(b => b.list === 'ret_ra') + 1);
  assert.strictEqual(at('ps_pp'), blocks.findIndex(b => b.list === 'ret_pp') + 1);
  const s = fresh(); set(s, 'ps_ra', schema.psClient.ra); set(s, 'ps_pp', 'Draw from Astute (with signed LOA)');
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual([back.f.ps_ra.v, back.f.ps_pp.v], [schema.psClient.ra, 'Draw from Astute (with signed LOA)']);   // opening a file does not join them
});

/* ---- version 3.5: Must not contact client is gone ---- */
test('the Short-term referral box is Cameron to contact client or Not required; an older file that held "Must not contact client" opens with Not required and the fact kept in the Short Term comments', () => {
  assert.ok(!schema.fieldsById.ref_sti.o.includes('Must not contact client'));
  const s = reopen(j => { j.f.ref_sti = { v: 'Must not contact client', st: 'confirmed' }; });
  assert.strictEqual(s.f.ref_sti.v, 'Not required'); assert.strictEqual(s.f.ref_sti.st, 'confirmed');
  assert.strictEqual(s.f.pr_st_cm.v, 'Marked "Must not contact client" in an earlier version of the form.'); assert.strictEqual(s.f.pr_st_cm.st, 'confirmed');
  const kept = reopen(j => { j.f.ref_sti = { v: 'Must not contact client', st: 'confirmed' }; j.f.pr_st_cm = { v: 'Client asked us to leave him alone', st: 'confirmed' }; });
  assert.strictEqual(kept.f.pr_st_cm.v, 'Client asked us to leave him alone\nMarked "Must not contact client" in an earlier version of the form.', 'what the adviser wrote stays, the note follows it');
  const again = store.fromJSON(store.toJSON(kept)); assert.strictEqual(again.f.pr_st_cm.v, kept.f.pr_st_cm.v, 'opened again, it is not added twice'); assert.strictEqual(again.f.ref_sti.v, 'Not required');
  const lines = require('../app/js/actions.js').local(s); assert.ok(!lines.some(l => /Cameron/.test(l)), 'no referral to Cameron comes from it, as before');
});
