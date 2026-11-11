/* Release 3.1: the action points for Sitamah read ALL the notes on the form (every Notes box, the Health notes, the comments of the quote tables and of the BrightRock calculation, the notes on a debt or a policy,
   what the voice heard but could not place, the priority comments), give each a verdict (action, covered, info), never write the same point twice, and say which notes could not be checked. */
const test = require('node:test');
const assert = require('node:assert');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const AI = require('../app/js/voice-ai.js');
const schema = require('../app/js/schema.js');

const fresh = () => { const s = store.blank(); store.setField(s, 'fname', 'Warren'); return s; };
const set = (s, id, v) => store.setField(s, id, v);
const ids = f => A.noteIds(f).sort();

test('the facts hold every kind of note, each with an id and where it is on the form', () => {
  const s = fresh();
  set(s, 'n_cover', 'Client already sent the Liberty schedule.');
  set(s, 'h_notes', 'Has gout.\nAsk her to send the cholesterol results.');
  set(s, 'lc_cmt', 'Wants the premium to stop at 65.');
  set(s, 'ip_cmt', 'Check the waiting period with the insurer.');
  store.addRow(s, 'debts', { type: 'Credit card', prov: 'FNB' }); store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', notes: 'Bond is in both names.' });
  store.setCell(s, 'debts', 0, 'notes', 'Cancel the card once the balance is paid.');
  store.addUnplaced(s, { id: 'u1', text: 'Mentioned a plan to buy a rental flat next year', sec: 'inv' });
  set(s, 'pr_life', schema.PRIORITY); set(s, 'pr_life_cm', 'Send the quotes before the next call.');
  const f = A.facts(s), by = {}; f.notes.forEach(n => { by[n.id] = n; });
  assert.deepStrictEqual(ids(f), ['debts:1:notes', 'debts:2:notes', 'h_notes', 'ip_cmt', 'lc_cmt', 'n_cover', 'pr_life_cm', 'unplaced:u1']);
  assert.ok(by.n_cover.page && by.n_cover.page !== 'n_cover', 'the page is named');
  assert.match(by.lc_cmt.page, /Client priorities and quotes needed \/ Life cover: standard/);
  assert.match(by.ip_cmt.page, /BrightRock Risk Calculation \/ Income protection/);
  assert.match(by['debts:1:notes'].page, /^Debts, row 1 \(Credit card, FNB\)$/);
  assert.match(by['debts:2:notes'].page, /^Debts, row 2 \(Home loan, Nedbank\)$/);
  assert.match(by['unplaced:u1'].page, /^Heard but not placed/);
  assert.strictEqual(by['unplaced:u1'].note, 'Mentioned a plan to buy a rental flat next year');
  assert.deepStrictEqual(f.instructions, [{ id: 'pr_life_cm', area: schema.panelsById.life.title, comment: 'Send the quotes before the next call.' }]);
});

test('an empty note, the action points box and the public profile are not sent; the Focus box only when the adviser typed in it', () => {
  const s = fresh();
  set(s, 'n_cover', '   '); set(s, 'profile', 'Public profile text'); set(s, 'pa_actions', '- Something'); set(s, 'focus', '1. Personal Risk Covers\n- Request an FNA quote');
  assert.deepStrictEqual(ids(A.facts(s)), [], 'nothing to read');
  store.setField(s, 'focus', '1. Personal Risk Covers\n- Request an FNA quote\n- Ring his brother about the buy and sell');
  s.focus.edited = true;
  const f = A.facts(s);
  assert.deepStrictEqual(ids(f), ['focus']);
  assert.match(f.notes[0].page, /typed by the adviser/);
});

test('who else is on the call goes to Claude when it is filled, and not when it is empty', () => {
  const s = fresh();
  assert.ok(!('people_on_the_call' in A.facts(s)));
  set(s, 'on_call', 'Marie-Louise (the client’s spouse)');
  assert.strictEqual(A.facts(s).people_on_the_call, 'Marie-Louise (the client’s spouse)');
});

const withNotes = () => {
  const s = fresh();
  set(s, 'n_income', 'Ask her for the last three payslips.'); set(s, 'n_debts', 'Needs the settlement letter for the car.'); set(s, 'h_notes', 'Has gout.');
  set(s, 'pr_ra', schema.UNSURE); set(s, 'pr_ra_cm', 'Check the budget first.');
  return s;
};

test('Claude is asked for a verdict on every note; a note it skipped is asked about once more and the points are merged without repeats', async () => {
  const s = withNotes(), f = A.facts(s), calls = [];
  assert.deepStrictEqual(ids(f), ['h_notes', 'n_debts', 'n_income', 'pr_ra_cm']);
  const ask = (system, content) => {
    const body = JSON.parse(content); calls.push(body);
    if (calls.length === 1) return Promise.resolve(JSON.stringify({ points: ['Ask the client Warren for his last three payslips.', 'Set up a follow-up appointment with the client Warren.'], notes: [{ id: 'n_income', status: 'action' }, { id: 'h_notes', status: 'info' }] }));
    return Promise.resolve(JSON.stringify({ points: ['Ask the client Warren for the car settlement letter.', 'ask the client warren for his last three payslips!'], notes: [{ id: 'n_debts', status: 'action' }, { id: 'pr_ra_cm', status: 'covered' }] }));
  };
  const r = await AI.actionPointsFull({ ask, model: 'm', facts: f });
  assert.strictEqual(calls.length, 2, 'one more look for the notes it skipped');
  assert.deepStrictEqual(calls[1].still_to_judge.sort(), ['n_debts', 'pr_ra_cm']);
  assert.deepStrictEqual(calls[1].points_already_written, ['Ask the client Warren for his last three payslips.', 'Set up a follow-up appointment with the client Warren.']);
  assert.deepStrictEqual(r.points, ['Ask the client Warren for his last three payslips.', 'Set up a follow-up appointment with the client Warren.', 'Ask the client Warren for the car settlement letter.'], 'the same point in other letters is dropped');
  assert.deepStrictEqual(r.notes, { n_income: 'action', h_notes: 'info', n_debts: 'action', pr_ra_cm: 'covered' });
  assert.deepStrictEqual(r.unchecked, []);
  const all = () => Promise.resolve(JSON.stringify({ points: ['Ask the client Warren for his last three payslips.'], notes: ids(f).map(id => ({ id, status: 'info' })) }));
  assert.deepStrictEqual(await AI.actionPoints({ ask: all, model: 'm', facts: f }), ['Ask the client Warren for his last three payslips.'], 'actionPoints still answers with the points alone');
});

test('a note Claude never gave a verdict on, even asked again, is reported as not checked; a failed second look keeps the first answer', async () => {
  const s = withNotes(), f = A.facts(s);
  let n = 0;
  const ask = () => { n++; return Promise.resolve(JSON.stringify({ points: ['Ask the client Warren for his payslips.'], notes: [{ id: 'n_income', status: 'action' }, { id: 'nonsense', status: 'action' }, { id: 'h_notes', status: 'maybe' }] })); };
  const r = await AI.actionPointsFull({ ask, model: 'm', facts: f });
  assert.strictEqual(n, 2);
  assert.deepStrictEqual(r.unchecked.sort(), ['h_notes', 'n_debts', 'pr_ra_cm'], 'an unknown id and an unknown status count for nothing');
  assert.deepStrictEqual(r.points, ['Ask the client Warren for his payslips.']);
  let m = 0;
  const failing = () => { m++; return m === 1 ? Promise.resolve('{"points": ["Send the client Warren the LOA."], "notes": []}') : Promise.reject(new Error('lost')); };
  const q = await AI.actionPointsFull({ ask: failing, model: 'm', facts: f });
  assert.deepStrictEqual(q.points, ['Send the client Warren the LOA.']);
  assert.strictEqual(q.unchecked.length, 4);
});

test('with no notes there is one request, and nothing to check', async () => {
  let n = 0;
  const r = await AI.actionPointsFull({ ask: () => { n++; return Promise.resolve('{"points": ["Set up a follow-up appointment with the client Warren."]}'); }, model: 'm', facts: A.facts(fresh()) });
  assert.strictEqual(n, 1); assert.deepStrictEqual(r.unchecked, []); assert.deepStrictEqual(r.notes, {});
});

test('Claude is told to read every note, to keep the adviser’s own tasks as something Sitamah can do, to name the spouse, and how to answer', () => {
  const sys = AI.ACTIONS_SYSTEM;
  assert.match(sys, /Read EVERY note/); assert.match(sys, /Nothing is missed and nothing is written twice/);
  assert.match(sys, /A task for the adviser himself[\s\S]*is NOT left off/); assert.match(sys, /book it in the adviser's diary/);
  assert.match(sys, /Set up a separate meeting with the client's spouse Marie-Louise about the Liberty policy/);
  assert.match(sys, /people_on_the_call/);
  assert.match(sys, /"status": "action"/); assert.match(sys, /"covered"/); assert.match(sys, /"info"/);
  assert.match(sys, /Heard but not placed/);
});

test('a phone number in a list note is scrubbed before it is sent', async () => {
  const s = fresh(); store.addRow(s, 'debts', { type: 'Credit card', prov: 'FNB', notes: 'Call 082 454 1751 for the settlement' });
  let sent = null;
  await AI.actionPointsFull({ ask: (sys, c) => { sent = c; return Promise.resolve('{"points": []}'); }, model: 'm', facts: A.facts(s) });
  assert.ok(!/082 454 1751/.test(sent));
});
