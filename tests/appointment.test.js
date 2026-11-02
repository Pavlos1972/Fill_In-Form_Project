/* The next appointment has a day and a time: the day follows the date by itself, the time is read in the ways it is typed or said, and both are in the checks, the action point, the PDF and voice. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const util = require('../app/js/util.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const A = require('../app/js/actions.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const ctx = s => store.ctxFor(s);
const at = (s, id) => validate.check(ctx(s)).filter(w => w.id === id);
const idx = V.buildIndex(schema);
const time = x => { const t = util.parseTime(x); return t ? util.formatTime(t) : null; };

test('a time is read the ways it is typed, in the 24-hour clock', () => {
  const ok = { '14:30': '14:30', '14h30': '14:30', '14.30': '14:30', '1430': '14:30', '9h': '09:00', '2pm': '14:00', '2 pm': '14:00', '2:30 pm': '14:30', '9.30 a.m.': '09:30', '10 am': '10:00', '12am': '00:00', '12 pm': '12:00', 'at 9:15': '09:15', '7:15': '07:15', '5 p.m.': '17:00', '0:30': '00:30' };
  Object.keys(ok).forEach(k => assert.strictEqual(time(k), ok[k], k));
  assert.strictEqual(time('2:30'), '14:30', 'an hour from 1 to 6 with no am or pm is the afternoon');
  assert.strictEqual(time('02:30'), '02:30', 'a leading zero is kept as typed');
  ['', 'abc', '9', '25:00', '14:75', '13:00 pm', '0 pm'].forEach(k => assert.strictEqual(util.parseTime(k), null, JSON.stringify(k)));
});

test('the day of the week follows the date', () => {
  assert.strictEqual(util.weekdayName(util.parseDate('06/11/2026')), 'Friday');
  assert.strictEqual(util.weekdayName(util.parseDate('29/02/2028')), 'Tuesday');
  const s = fresh();
  assert.strictEqual(calc.field('weekday', ctx(s)), '');
  set(s, 'next_appt', '06/11/2026'); assert.strictEqual(calc.field('weekday', ctx(s)), 'Friday');
  set(s, 'next_appt', '07/11/2026'); assert.strictEqual(calc.field('weekday', ctx(s)), 'Saturday');
  set(s, 'next_appt', 'soon'); assert.strictEqual(calc.field('weekday', ctx(s)), '');
});

test('the Next appointment block has the date on a row of its own, then the day (calculated) and the time side by side', () => {
  const admin = schema.sections.find(x => x.id === 'admin'), b = admin.blocks.find(x => x.title === 'Next appointment');
  assert.deepStrictEqual(b.fields.map(f => f.id), ['next_appt', 'next_day', 'next_time']);
  assert.strictEqual(b.layout, 'g12');
  assert.ok(schema.fieldsById.next_day.calc === 'weekday');
  assert.ok(schema.fieldsById.next_time.time && !schema.fieldsById.next_time.calc);
  assert.deepStrictEqual(b.fields.map(f => f.s), [12, 5, 7]);
  assert.deepStrictEqual([schema.fieldsById.next_day.sl, schema.fieldsById.next_time.sl], ['Day', 'Time'], 'short labels on the screen and the PDF; the full ones stay for voice and the checks');
});

test('a time is kept as 24-hour wherever it comes from, and a file without one opens blank', () => {
  const s = fresh();
  set(s, 'next_time', '2pm'); assert.strictEqual(s.f.next_time.v, '14:00');
  set(s, 'next_time', '9h30'); assert.strictEqual(s.f.next_time.v, '09:30');
  set(s, 'next_time', 'after lunch'); assert.strictEqual(s.f.next_time.v, 'after lunch', 'what cannot be read is left as typed (and flagged by the checks)');
  const round = store.fromJSON(store.toJSON(s)); assert.strictEqual(round.f.next_time.v, 'after lunch');
  const old = JSON.parse(store.toJSON(fresh())); delete old.f.next_time; delete old.f.next_day;
  assert.strictEqual(store.fromJSON(JSON.stringify(old)).f.next_time.v, '');
});

test('Checks: a date with no time, a time that cannot be read, and a time with no date', () => {
  const s = fresh();
  assert.deepStrictEqual([at(s, 'next_appt').length, at(s, 'next_time').length], [0, 0], 'nothing set, nothing said');
  set(s, 'next_appt', '05/11/2099'); assert.match(at(s, 'next_time')[0].msg, /Add the time of the next appointment/);
  set(s, 'next_time', '14:30'); assert.strictEqual(at(s, 'next_time').length, 0);
  set(s, 'next_time', 'after lunch'); assert.match(at(s, 'next_time')[0].msg, /Time not recognised\. Use, for example, 14:30 or 2:30 pm/);
  set(s, 'next_appt', ''); set(s, 'next_time', '14:30'); assert.match(at(s, 'next_appt')[0].msg, /Add the date of the next appointment/);
});

test('the action point names the day, the date and the time, and says what is still to be agreed', () => {
  const s = fresh(); set(s, 'fname', 'Thandi');
  const last = () => A.local(s).pop();
  set(s, 'next_appt', '06/11/2026'); set(s, 'next_time', '2:30 pm');
  assert.strictEqual(last(), 'Set up a follow-up appointment with the client Thandi for Friday 06/11/2026 at 14:30.');
  assert.strictEqual(A.facts(s).appointment, 'Friday 06/11/2026 at 14:30');
  set(s, 'next_time', ''); assert.strictEqual(last(), 'Set up a follow-up appointment with the client Thandi for Friday 06/11/2026 (time to be agreed).');
  set(s, 'next_appt', ''); set(s, 'next_time', '10 am'); assert.strictEqual(last(), 'Set up a follow-up appointment with the client Thandi at 10:00 (date to be agreed).');
  set(s, 'next_time', ''); assert.strictEqual(last(), 'Set up a follow-up appointment with the client Thandi (date and time to be agreed).');
});

test('voice reads a spoken time', () => {
  const t = x => { const r = V.spokenTime(x, false); return r && r.value; };
  const said = { 'half past two': '14:30', 'quarter to ten': '09:45', "ten o'clock": '10:00', 'two thirty': '14:30', 'at 14:30': '14:30', '2pm': '14:00', 'ten in the morning': '10:00', noon: '12:00', 'two thirty in the afternoon': '14:30', '9.30 am': '09:30', 'quarter past three': '15:15', 'twelve thirty': '12:30', 'at half past eleven': '11:30', 'eight forty five': '08:45' };
  Object.keys(said).forEach(k => assert.strictEqual(t(k), said[k], k));
  assert.strictEqual(V.spokenTime('blah', false), null);
});

test('voice: the time box, a date and a time said together, and a time said to the date box', () => {
  const r = (id, text) => V.interpret(idx.byId[id], text);
  assert.deepStrictEqual(r('next_time', 'half past two'), { value: '14:30', status: 'verify' });
  assert.deepStrictEqual(r('next_time', 'blah'), { error: 'no-time' });
  assert.deepStrictEqual(r('next_appt', 'Friday the sixth of November 2026 at 14:30'), { value: '06/11/2026', status: 'verify', extra: [{ id: 'next_time', value: '14:30', status: 'verify' }] });
  assert.deepStrictEqual(r('next_appt', '06/11/2026 at 2:30 pm'), { value: '06/11/2026', status: 'verify', extra: [{ id: 'next_time', value: '14:30', status: 'verify' }] });
  assert.deepStrictEqual(r('next_appt', 'the sixth of November 2026'), { value: '06/11/2026', status: 'verify' });
  const st = o => Object.assign({ cur: 'admin', target: null, answered: false, isEmpty: () => true }, o || {});
  const acts = (text, o) => V.plan(text, idx, st(o)).actions.filter(a => a.do === 'fill').map(a => [a.field, a.res.value]);
  assert.deepStrictEqual(acts('my next appointment is half past two'), [['next_time', '14:30']], 'only a time said: the time box is filled');
  assert.deepStrictEqual(acts('half past two', { target: 'next_appt' }), [['next_time', '14:30']]);
  assert.deepStrictEqual(acts('the next appointment time is 14:30'), [['next_time', '14:30']]);
  assert.deepStrictEqual(acts('my next appointment is the sixth of November 2026'), [['next_appt', '06/11/2026']]);
  assert.strictEqual(V.plan('what time shall we meet', idx, st()).actions.find(a => a.do === 'ask').field, 'next_time');
});
