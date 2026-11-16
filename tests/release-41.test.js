/* Release 4.1: an appointment that has come and gone is recorded and the date is open again; the Progress numbers lead to the boxes; Verify All; personal and work cell numbers. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');
const validate = require('../app/js/validate.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const NOW = { y: 2026, m: 11, d: 16, mins: 10 * 60 };                                   // 16/11/2026, 10:00

test('the version is at least 4.1', () => { assert.ok(parseFloat(schema.version) >= 4.1); });

/* ---------- 1. the next appointment has come and gone ---------- */
test('an appointment on an earlier day has passed; on today it has passed once its time has; a later one has not', () => {
  const s = fresh(), at = (d, t) => { set(s, 'next_appt', d); set(s, 'next_time', t || ''); return calc.apptPassed(store.ctxFor(s), NOW); };
  const p = at('13/11/2026', '14:30'); assert.deepStrictEqual([p.date, p.time, p.text], ['13/11/2026', '14:30', 'Friday 13/11/2026 at 14:30']);
  assert.strictEqual(at('16/11/2026', '09:00').text, 'Monday 16/11/2026 at 09:00', 'today, the time has passed');
  assert.strictEqual(at('16/11/2026', '15:00'), null, 'today, still to come');
  assert.strictEqual(at('16/11/2026', ''), null, 'today with no time: not passed');
  assert.strictEqual(at('20/11/2026', '10:00'), null); assert.strictEqual(at('', ''), null); assert.strictEqual(at('soon', ''), null);
  assert.strictEqual(at('13/11/2026', '').text, 'Friday 13/11/2026');
});
test('what happened is recorded under Previous appointments and the date, day and time are open again', () => {
  const s = fresh(); set(s, 'next_appt', '13/11/2026'); set(s, 'next_time', '14:30');
  const row = store.recordAppt(s, 'Did not meet with the client');
  assert.deepStrictEqual(s.l.appts.map(r => r.d), [{ date: '13/11/2026', time: '14:30', outcome: 'Did not meet with the client' }]);
  assert.deepStrictEqual([s.f.next_appt.v, s.f.next_time.v, s.f.next_appt.st], ['', '', 'empty']);
  assert.strictEqual(calc.field('weekday', store.ctxFor(s)), '', 'the day is open too');
  set(s, 'next_appt', '20/11/2026'); set(s, 'next_time', '13:00'); store.recordAppt(s, 'Completed');
  assert.deepStrictEqual(s.l.appts.map(r => r.d.outcome), ['Did not meet with the client', 'Completed']);
  assert.strictEqual(store.recordAppt(fresh(), 'Completed'), null, 'no date, nothing to record');
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(back.l.appts.map(r => r.d), s.l.appts.map(r => r.d));
});
test('the outcomes are Completed, Did not meet with the client, Cancelled by the client and Rescheduled; the list is on Admin, not read by voice', () => {
  assert.deepStrictEqual(schema.lists.appts.cols[2].o, ['Completed', 'Did not meet with the client', 'Cancelled by the client', 'Rescheduled']);
  const admin = schema.sections.find(x => x.id === 'admin'), i = admin.blocks.findIndex(b => b.list === 'appts');
  assert.ok(i === 2 && admin.blocks[1].title === 'Next appointment' && admin.blocks[i].left, 'right under the Next appointment box');
  assert.ok(!V.buildIndex(schema).lists.appts, 'voice does not fill it');
});
test('the Checks say the appointment has passed; the action points ask for a new date once the date is open', () => {
  const s = fresh(); set(s, 'next_appt', '01/01/2020');
  assert.ok(validate.check(store.ctxFor(s)).some(w => w.id === 'next_appt'), 'an old date is flagged (before the form date, or passed)');
  const A = require('../app/js/actions.js'); store.recordAppt(s, 'Completed');
  assert.ok(A.local(s).some(l => /Set up a follow-up appointment with the client \(date and time to be agreed\)/.test(l)), A.local(s).join('|'));
});

/* ---------- 2. the Progress numbers lead to the boxes ---------- */
const progress = s => schema.sections.reduce((a, sec) => { if (sec.adv) return a; const c = store.counts(s, sec); return { verify: a.verify + c.ver, empty: a.empty + c.tot - c.fill }; }, { verify: 0, empty: 0 });
test('the boxes behind "to verify" and "not asked" are the numbers on the Progress card, in the order of the pages', () => {
  const s = fresh(); set(s, 'fname', 'Sam', 'verify'); set(s, 'gross', 'R 1.00', 'verify'); set(s, 'has_kids', 'Yes', 'verify'); store.addRow(s, 'debts', { type: 'Home loan' }, 'verify');
  const v = store.pending(s, 'verify'), e = store.pending(s, 'empty');
  assert.strictEqual(v.length, 4); assert.strictEqual(e.length, progress(s).empty, '"not asked" is exactly the counted boxes');
  assert.deepStrictEqual(v.map(x => x.id || x.list + ':' + x.i), ['fname', 'gross', 'debts:0', 'has_kids'], 'in the order of the pages, top to bottom');
  const order = v.map(x => x.sec); assert.deepStrictEqual(order, order.slice().sort((a, b) => schema.sections.findIndex(x => x.id === a) - schema.sections.findIndex(x => x.id === b)), 'page by page');
  assert.ok(v.every((x, i) => i === 0 || x.n > v[i - 1].n), 'each has its place in the order');
  assert.ok(!e.some(x => x.id === 'fname'), 'a box that is filled is not "not asked"');
  assert.ok(!e.some(x => ['pr_life', 'lc_hh', 'n_income', 'meet'].includes(x.id)), 'advisor pages, calculated, optional and preset boxes are not in it');
});
test('a row that is empty is "not asked"; a list that needs a first row says so; a verified box leaves the list', () => {
  const s = fresh(); const e0 = store.pending(s, 'empty'); assert.ok(e0.some(x => x.list && x.i === -1), 'a list that needs a first row');
  store.addRow(s, 'kids', {}, 'confirmed'); assert.ok(store.pending(s, 'empty').some(x => x.list === 'kids' && x.i === 0), 'an empty row');
  set(s, 'fname', 'Sam', 'verify'); assert.strictEqual(store.pending(s, 'verify').length, 1); s.f.fname.st = 'confirmed'; assert.strictEqual(store.pending(s, 'verify').length, 0);
});

/* ---------- 4. personal and work cell numbers ---------- */
test('Cell number is the Personal cell number (same id) and there is a new Work cell number; the landlines stay', () => {
  assert.strictEqual(schema.fieldsById.cell.l, 'Personal cell number'); assert.strictEqual(schema.fieldsById.work_cell.l, 'Work cell number');
  assert.strictEqual(schema.fieldsById.work.l, 'Work number'); assert.strictEqual(schema.fieldsById.home.l, 'Home number');
  const ids = schema.sections[0].blocks.find(b => (b.fields || []).some(f => f.id === 'cell')).fields.map(f => f.id);
  assert.deepStrictEqual(ids.slice(ids.indexOf('cell'), ids.indexOf('cell') + 4), ['cell', 'work_cell', 'work', 'home']);
  assert.ok(schema.fieldsById.work_cell.risky && schema.fieldsById.work_cell.none === 'No work cell number');
  const s = fresh(); set(s, 'work_cell', '123'); assert.ok(validate.check(store.ctxFor(s)).some(w => w.id === 'work_cell'), 'checked like the other numbers');
  set(s, 'work_cell', '082 555 0148'); assert.ok(!validate.check(store.ctxFor(s)).some(w => w.id === 'work_cell'));
  assert.ok(V.PRIVATE_IDS.includes('work_cell'), 'private: never sent to Claude');
});
test('the Short Risk and Capture Sheet pages copy the personal cell number, as before (the work number is the landline)', () => {
  const sr = require('../app/js/sr-store.js'), cs = require('../app/js/cs-store.js');
  const ff = fresh(); set(ff, 'cell', '082 555 0148'); set(ff, 'work_cell', '083 555 0000'); set(ff, 'work', '011 555 0000'); set(ff, 'fname', 'Sam');
  const a = sr.blank(); sr.loadFromFactFind(a, store.toJSON(ff), 'x.json'); assert.strictEqual(a.f.cell.v, '082 555 0148'); assert.strictEqual(a.f.work.v, '011 555 0000');
  const b = cs.blank(); cs.loadFromFactFind(b, store.toJSON(ff), 'x.json'); assert.strictEqual(b.f.cell.v, '082 555 0148'); assert.strictEqual(b.f.tel_w.v, '011 555 0000');
});

/* ---------- Verify All and "to verify" work on every page ---------- */
test('"to verify" is every amber box on every page: the boxes with a starting value, the optional boxes and the advisor pages too, but not an empty box, a calculated box or the online profile', () => {
  const s = fresh();
  set(s, 'ma_broker', 'Other broker', 'verify');                       // Broker on record: a box with a starting value (left out of the "not asked" count)
  set(s, 'n_income', 'Some note', 'verify');                          // an optional notes box
  set(s, 'pr_life', 'Priority: client agrees', 'verify');             // an advisor page (Client priorities)
  set(s, 'br_aci', '10%', 'verify');                                   // the BrightRock page
  set(s, 'cc_notes', 'Summary', 'verify');                            // Admin
  set(s, 'profile', 'Possible match', 'verify');                      // looked up on the internet: verified by hand
  s.f.gender = { v: '', st: 'verify' };                               // amber with nothing in it
  store.addRow(s, 'risk', { prov: 'BrightRock' }, 'verify');
  const ids = store.pending(s, 'verify').map(x => x.id || x.list + ':' + x.i);
  assert.deepStrictEqual(ids.slice().sort(), ['br_aci', 'cc_notes', 'ma_broker', 'n_income', 'pr_life', 'risk:0'].sort(), ids.join(','));
  const secs = store.pending(s, 'verify').map(x => schema.sections.findIndex(y => y.id === x.sec)); assert.deepStrictEqual(secs, secs.slice().sort((a, b) => a - b), 'in the order of the pages');
  assert.ok(!progress(s).verify || progress(s).verify < ids.length, 'the old per-page count missed most of them');
});
test('when nothing is amber nothing is waiting', () => { assert.strictEqual(store.pending(fresh(), 'verify').length, 0); });

/* ---------- the calendar in the list rows ---------- */
test('the date of a previous appointment and of a meeting has the calendar, like the next appointment', () => {
  assert.ok(schema.lists.appts.cols[0].cal && schema.lists.meetings.cols[0].cal && schema.fieldsById.next_appt.cal);
});
