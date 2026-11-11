/* Release 3.1: Term left on a debt is always a number of months. "20 years" is 240; "until my age 65" is worked out from the date of birth and the date of the form; digits alone are months;
   "Max term" (the default for a credit card and revolving credit) stays; older files open with their terms in months. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

const WARREN = { dob: { y: 1974, m: 1, d: 7 }, on: { y: 2026, m: 11, d: 11 } };
const months = (t, o) => { const r = util.termMonths(t, o === undefined ? WARREN : o); return r && r.months != null ? r.months : r; };

test('years and months are worked out as months', () => {
  assert.strictEqual(months('20 years'), 240); assert.strictEqual(months('twenty years'), 240); assert.strictEqual(months('5 years 6 months'), 66); assert.strictEqual(months('5 years and 6 months'), 66);
  assert.strictEqual(months('18 months'), 18); assert.strictEqual(months('eighteen months'), 18); assert.strictEqual(months('two and a half years'), 30); assert.strictEqual(months('2 and a half years'), 30);
  assert.strictEqual(months('a year and a half'), 18); assert.strictEqual(months('a year'), 12); assert.strictEqual(months('about 12 yrs'), 144); assert.strictEqual(months('forty five years'), 540);
  assert.strictEqual(months('the term is twenty years left'), 240); assert.strictEqual(months('a hundred and twenty months'), 120); assert.strictEqual(months('14 years 3 months'), 171);
});
test('digits alone are months; "Max term" stays; anything that is not a term is left alone', () => {
  assert.strictEqual(months('240'), 240); assert.strictEqual(months('20'), 20, 'a bare number is months');
  assert.deepStrictEqual(util.termMonths('Max term', WARREN), { keep: true });
  assert.strictEqual(months('R 3 000'), null); assert.strictEqual(months('till retirement'), null); assert.strictEqual(months(''), null); assert.strictEqual(months('twenty'), null, 'number words with no unit are not a term');
});
test('"until my age 65" is counted from the date of birth to the date of the form', () => {
  ['up until my age 65', 'until I am 65', 'until I turn sixty five', 'until age 65', 'until 65', 'to age 65', 'until my 65th birthday'].forEach(t => assert.strictEqual(months(t), 146, t));       // 11/11/2026 to 07/01/2039 = 145.9 months
  assert.deepStrictEqual(util.termMonths('until my age 65', { on: WARREN.on }), { needs: 'dob', age: 65 }, 'no date of birth yet');
  assert.strictEqual(months('until age 60', { dob: { y: 1960, m: 3, d: 1 }, on: { y: 2026, m: 11, d: 11 } }), null, 'an age already passed is not a term');
  assert.strictEqual(months('up to 20 years'), 240, 'a number with a unit is a length, not an age');
  assert.strictEqual(months('until I am 17'), null);
});

test('the stored term is months, however it gets in: typed, added, read from a file', () => {
  const s = store.blank(); store.setField(s, 'date', '11/11/2026');
  assert.strictEqual(store.addRow(s, 'debts', { type: 'Home loan', term: '20 years' }).d.term, '240');
  store.setCell(s, 'debts', 0, 'term', '5 years 6 months'); assert.strictEqual(s.l.debts[0].d.term, '66');
  store.setCell(s, 'debts', 0, 'term', '144'); assert.strictEqual(s.l.debts[0].d.term, '144');
  store.setCell(s, 'debts', 0, 'term', 'to be agreed'); assert.strictEqual(s.l.debts[0].d.term, 'to be agreed', 'text that is not a term is kept as typed');
  const j = JSON.parse(store.toJSON(s)); j.l.debts[0].d.term = '15 years'; j.l.debts.push({ d: { type: 'Vehicle finance', term: '144 months' }, st: 'confirmed' }); j.l.debts.push({ d: { type: 'Personal loan', term: 'Max term?' }, st: 'confirmed' });
  const o = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual(o.l.debts.map(r => r.d.term), ['180', '144', 'Max term?'], 'an older file opens with its clear terms in months and the unclear one untouched');
});
test('a term said as an age keeps its words until the date of birth is on the form, then becomes months', () => {
  const s = store.blank(); store.setField(s, 'date', '11/11/2026');
  store.addRow(s, 'debts', { type: 'Home loan' }); store.setCell(s, 'debts', 0, 'term', 'up until my age 65');
  assert.strictEqual(s.l.debts[0].d.term, 'up until my age 65');
  store.setField(s, 'dob', '07/01/1974'); assert.strictEqual(s.l.debts[0].d.term, '146');
  store.setField(s, 'date', '11/12/2026'); assert.strictEqual(s.l.debts[0].d.term, '146', 'months once worked out do not move');
});
test('"Max term" comes whenever a credit card or revolving credit is chosen, and goes when the type is another', () => {
  const s = store.blank(), r = store.addRow(s, 'debts', { type: 'Credit card' });
  assert.strictEqual(r.d.term, 'Max term');
  store.setCell(s, 'debts', 0, 'type', 'Home loan'); assert.strictEqual(r.d.term, '', 'a home loan has a term to ask for');
  store.setCell(s, 'debts', 0, 'type', 'Revolving credit'); assert.strictEqual(r.d.term, 'Max term');
  store.setCell(s, 'debts', 0, 'term', '36'); store.setCell(s, 'debts', 0, 'type', 'Credit card'); assert.strictEqual(r.d.term, '36', 'a typed term is never replaced');
  store.setCell(s, 'debts', 0, 'type', 'Home loan'); assert.strictEqual(r.d.term, '36');
});

test('the box is Term left (months), with the same id', () => {
  const col = schema.lists.debts.cols.filter(c => c.k === 'term')[0];
  assert.strictEqual(col.l, 'Term left (months)');
});

test('voice reads the term in years, months or an age and fills months; without a date of birth it keeps the words, in amber', () => {
  let form = { dob: '07/01/1974', date: '11/11/2026' };
  V.setTermSource(() => form); V.setLineSource(() => '');
  const idx = V.buildIndex(schema), def = idx.byId['debts.term'];
  assert.ok(def, 'the box is in the voice index');
  const fill = t => V.interpret(def, t);
  assert.deepStrictEqual(fill('twenty years left'), { value: '240', status: 'verify' });
  assert.deepStrictEqual(fill('18 months'), { value: '18', status: 'verify' });
  assert.deepStrictEqual(fill('up until my age 65'), { value: '146', status: 'verify' });
  assert.strictEqual(fill('twenty').error, 'no-term', 'a number with no unit is asked again');
  assert.strictEqual(fill('max term').value, 'Max term');
  form = { dob: '', date: '11/11/2026' };
  const w = fill('up until my age 65'); assert.deepStrictEqual([w.value, w.status], ['Up until my age 65', 'verify']); assert.match(w.note, /date of birth is needed/);
  V.setTermSource(null);
});
test('a bare number from Claude is read against the words of the line: "20" for "twenty years" is 240, "20" for "20 months" stays', () => {
  V.setTermSource(() => ({ dob: '07/01/1974', date: '11/11/2026' }));
  const idx = V.buildIndex(schema), def = idx.byId['debts.term'];
  const say = (line, value) => { V.setLineSource(() => line); return V.interpret(def, value).value; };
  assert.strictEqual(say('he has twenty years left on the bond', '20'), '240');
  assert.strictEqual(say('he has 20 years left on the bond', '20'), '240');
  assert.strictEqual(say('twenty months left', '20'), '20');
  assert.strictEqual(say('twenty years left', '240'), '240', 'Claude already gave the months');
  assert.strictEqual(say('been here 5 years, the term is 20 years', '20'), '240', 'the figure is found in the clause it belongs to');
  assert.strictEqual(say('five years and six months left', '5.5'), '66');
  V.setLineSource(null); V.setTermSource(null);
});

test('Claude is told to give the term with its unit and not to convert it', () => {
  assert.match(AI.SYSTEM, /Term left \(debts\.term\) is a NUMBER OF MONTHS/); assert.match(AI.SYSTEM, /"until my age 65"/); assert.match(AI.SYSTEM, /never give a bare number without its unit/);
  assert.match(AI.SYSTEM, /fill nothing in Term left for them/);
});
