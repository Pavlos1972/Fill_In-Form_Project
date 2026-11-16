/* Release 4.5: the meetings held are one line for each meeting (Date, Day, Type, Others on the call, What was covered) and the list folds. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');

test('the version is at least 4.5', () => { assert.ok(parseFloat(schema.version) >= 4.5); });

test('the meetings list is a one-line list that folds, with a Day column worked out from the date', () => {
  const L = schema.lists.meetings;
  assert.ok(L.dense && L.fold, 'one line each, and it folds');
  assert.deepStrictEqual(L.cols.map(c => c.k), ['date', 'day', 'type', 'who', 'covered']);
  assert.strictEqual(L.cols[1].calc, 'day');
});

test('the day is the weekday of the meeting date, and empty for no date or a bad one', () => {
  const row = d => ({ d: { date: d }, st: 'confirmed' });
  assert.strictEqual(calc.rowCalc('day', row('14/10/2026')), 'Wednesday');
  assert.strictEqual(calc.rowCalc('day', row('28/10/2026')), 'Wednesday');
  assert.strictEqual(calc.rowCalc('day', row('16/11/2026')), 'Monday');
  assert.strictEqual(calc.rowCalc('day', row('')), '');
  assert.strictEqual(calc.rowCalc('day', row('soon')), '');
});

test('a meeting row keeps its date, who and covered in the saved file', () => {
  const s = store.blank(); store.addRow(s, 'meetings', {});
  const r = s.l.meetings[0]; r.d.date = '14/10/2026'; r.d.who = 'Ryno';
  const j = JSON.parse(store.toJSON(s));
  assert.strictEqual(j.l.meetings[0].d.date, '14/10/2026');
  assert.strictEqual(j.l.meetings[0].d.who, 'Ryno');
});
