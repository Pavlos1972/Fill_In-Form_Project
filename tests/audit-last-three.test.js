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
  assert.match(sec('kids').blocks.find(b => b.list === 'kids').help, /Childcare costs only/);
  assert.deepStrictEqual(schema.panelsById.egar.sum, { f: ['egar_req'], l: { kids: ['age', 'stage', 'cost'] } });      // nothing about the EGAR was changed
  const s = fresh(); set(s, 'net', 'R 40 000.00'); store.addRow(s, 'kids', { name: 'A', cost: 'R 3 000.00' });
  assert.strictEqual(calc.field('cc', store.ctxFor(s)), 'R 3 000.00'); assert.strictEqual(calc.field('need', store.ctxFor(s)), 'R 37 000.00');
});

/* ---- #19 ---- */
test('the referral boxes no longer have the choices that restate a box above them', () => {
  assert.deepStrictEqual(schema.fieldsById.ref_will.o, ['Capital Legacy to contact client', 'Not interested']);
  assert.deepStrictEqual(schema.fieldsById.ref_sti.o, ['Cameron to contact client', 'Must not contact client', 'Not interested']);
});

test('an older file that held "Client has own broker" or "Has updated will" keeps the fact in its own box', () => {
  const s = reopen(j => { j.f.ref_sti = { v: 'Client has own broker', st: 'confirmed' }; j.f.ref_will = { v: 'Has updated will', st: 'confirmed' }; });
  assert.deepStrictEqual([s.f.ref_sti.v, s.f.sti.v, s.f.sti_broker.v], ['Not interested', 'Yes', 'Other broker']);
  assert.deepStrictEqual([s.f.ref_will.v, s.f.will.v, s.f.will_up.v], ['Not interested', 'Yes', 'Yes']);
  const kept = reopen(j => { j.f.ref_sti = { v: 'Client has own broker', st: 'confirmed' }; j.f.sti = { v: 'Yes', st: 'confirmed' }; j.f.sti_broker = { v: 'Cameron Maritz', st: 'confirmed' }; });
  assert.strictEqual(kept.f.sti_broker.v, 'Cameron Maritz');                                                          // what was already in the box is not overwritten
  assert.ok(!A.facts(s).referrals.length);
});

/* ---- #25 ---- */
test('the pages are in the order the work goes: debts and children come straight after income', () => {
  assert.deepStrictEqual(schema.sections.map(s => s.id), ['info', 'occ', 'income', 'debts', 'kids', 'cover', 'retire', 'inv', 'other', 'health', 'prio', 'calc', 'admin']);
});

test('Smoker is with the health questions, not on Client info', () => {
  assert.ok(ids(sec('health').blocks[0]).includes('smoker') && ids(sec('health').blocks[0])[0] === 'smoker');
  assert.ok(!sec('info').blocks.some(b => ids(b).includes('smoker')));
  assert.strictEqual(fresh().f.smoker.v, '');
  const old = reopen(j => { j.f.smoker = { v: 'Smoker', st: 'confirmed' }; }); assert.strictEqual(old.f.smoker.v, 'Smoker');        // same box, so older files keep the answer
});

test('the Letter of Authority is on the Admin page, in the narrow column with the next appointment', () => {
  const admin = sec('admin');
  assert.deepStrictEqual(admin.blocks.map(b => b.title), ['Letter of Authority', 'Next appointment', 'Action Points for Personal Assistant']);
  assert.deepStrictEqual(admin.blocks.map(b => !!b.left), [true, true, false]);
  assert.ok(!sec('cover').blocks.some(b => ids(b).includes('loa')));
  const s = fresh(); set(s, 'loa', 'Yes'); set(s, 'fname', 'Thandi'); set(s, 'ps_inv', 'Draw from Astute (with signed LOA)');
  assert.ok(A.local(s).some(l => /Send Thandi the LOA to sign/.test(l)));                                           // the action points read the same box
});

test('the retirement annuities and the pension and provident funds have one schedule request', () => {
  assert.ok(!schema.fieldsById.ps_pp && !schema.fieldsById.ps_pp_ot);
  assert.strictEqual(sec('retire').blocks.filter(b => b.title === 'Request Current Policy Schedule(s)').length, 1);
  const blocks = sec('retire').blocks, at = blocks.findIndex(b => ids(b).includes('ps_ra'));
  assert.ok(at > blocks.findIndex(b => b.list === 'ret_pp'));                                                        // after both lists
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'ps_ra', 'Requested from client in meeting'); store.addRow(s, 'ret_ra', { prov: 'Allan Gray' }); store.addRow(s, 'ret_pp', { prov: 'Sanlam', type: 'Pension fund' });
  const sched = A.facts(s).schedules; assert.strictEqual(sched.length, 1);
  assert.deepStrictEqual([sched[0].what, sched[0].held], ['retirement annuities and pension and provident funds', ['Allan Gray', 'Sanlam']]);
});

test('an older file with a request for each retirement list opens with one request holding both', () => {
  const s = reopen(j => {
    j.f.ps_ra = { v: 'Draw from Astute (with signed LOA); Other', st: 'confirmed' }; j.f.ps_ra_ot = { v: 'Bring the RA letter', st: 'confirmed' };
    j.f.ps_pp = { v: 'Requested from client in meeting; Other', st: 'confirmed' }; j.f.ps_pp_ot = { v: 'Employer HR sends it', st: 'confirmed' };
  });
  assert.strictEqual(s.f.ps_ra.v, 'Draw from Astute (with signed LOA); Other; Requested from client in meeting');
  assert.strictEqual(s.f.ps_ra_ot.v, 'Bring the RA letter; Employer HR sends it');
  const only = reopen(j => { j.f.ps_pp = { v: 'Requested from client in meeting', st: 'heard' }; });
  assert.deepStrictEqual([only.f.ps_ra.v, only.f.ps_ra.st], ['Requested from client in meeting', 'heard']);
  const none = reopen(j => { j.f.ps_pp = { v: '(not asked yet)', st: 'empty' }; });
  assert.strictEqual(none.f.ps_ra.v, '');
  assert.ok(!('ps_pp' in JSON.parse(store.toJSON(s)).f));                                                            // saved again, the old box is gone
});

test('the retirement schedule request is not counted only when there is neither a retirement annuity nor a pension or provident fund', () => {
  const s = fresh(), t0 = store.counts(s, sec('retire')).tot;
  set(s, 'has_ra', 'No'); const a = store.counts(s, sec('retire')).tot;                                              // the annuity list goes; the pension list and the request stay
  set(s, 'has_pp', 'No'); const b = store.counts(s, sec('retire')).tot;
  assert.deepStrictEqual([t0 - a, a - b], [1, 2]);                                                                   // the second No takes the pension list and the schedule request
});
