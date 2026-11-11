/* Release 3.1, the voice fixes found in the Warren Bleksley log: a rounder figure never replaces an agreed exact one; a bank or provider is only filled when the line names one; figures in "heard but not placed"
   must have been said; the catch-up check must quote the words each value came from (a marital status was invented); and Claude is told about the spouse on the call, the spouse's medical aid, take-home and expenses. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

test('a rounder figure within reach of an agreed exact figure is not a correction', () => {
  const keep = (held, val, line, explicit) => V.keepExact(held, val, line, explicit);
  assert.ok(keep('R 33 288.36', 'R 33 000.00', 'about 33,000 odd', true), '"33,000 odd" never replaces R 33 288.36, even said as a correction');
  assert.ok(keep('R 33 288.36', 'R 33 000.00', 'around 33 thousand'), 'around');
  assert.ok(keep('R 33 288.36', 'R 33 000.00', 'the take home is 33 000', false), 'a rounder figure that is not given as a correction');
  assert.ok(!keep('R 33 288.36', 'R 31 000.00', 'no, it is 31 000', true), 'a correction to a different figure goes through');
  assert.ok(!keep('R 33 288.36', 'R 80 000.00', '80 000', false), 'a far figure is another fact, not a rounder one');
  assert.ok(!keep('R 10 000.00', 'R 12 000.00', '12 000', false), 'as round as before: not rounder');
  assert.ok(!keep('R 33 288.00', 'R 33 288.00', '33288', false), 'the same figure is not a change');
  assert.ok(!keep('', 'R 33 000.00', 'about 33,000'), 'an empty box takes whatever is said');
});

test('a bank or provider is only filled when the line holds its name, or a word that sounds like it', () => {
  const names = (v, l) => V.namesProvider(v, l);
  assert.ok(!names('Nedbank', 'That is with me'), '"That’s with me" named nobody (it became Nedbank in the log)');
  assert.ok(!names('Standard Bank', 'that is with them'));
  assert.ok(!names('Nedbank', 'the same one'));
  assert.ok(names('Nedbank', 'it is with Nedbank'));
  assert.ok(names('ABSA', 'it is with absent'), 'speech recognition: "absent" for Absa');
  assert.ok(names('Old Mutual', 'OM'));
  assert.ok(names('Old Mutual', 'an old mutual policy'));
  assert.ok(names('FNB', 'FNB'));
  assert.ok(names('Discovery Bank', 'with discovery'));
});

test('an amount in "heard but not placed" must be a number that was said', () => {
  assert.ok(AI.ungroundedAmount('Spends about R 6 000 a month', 'about even a month'), '"about even a month" became R 6 000 in the log');
  assert.ok(!AI.ungroundedAmount('Spends R 6 000 a month', 'we spend six thousand rand a month'));
  assert.ok(!AI.ungroundedAmount('Owes R 450 000', 'it is about 450,000 outstanding'));
  assert.ok(!AI.ungroundedAmount('Owes R 450 000', 'four hundred and fifty thousand'));
  assert.ok(!AI.ungroundedAmount('Has 3 children aged 12 and 9', 'three kids'), 'small numbers (ages, counts) are not amounts');
  assert.ok(!AI.ungroundedAmount('Wants to retire early', 'nothing said'), 'no figure, nothing to check');
  assert.deepStrictEqual(AI.numbersSaid('R33,000 odd, six thousand five hundred, 85k, R1.2 million, forty two'), [33000, 6500, 85000, 1200000, 42]);
});

const idx = V.buildIndex(schema);
const reply = o => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(o) }], usage: { input_tokens: 1, output_tokens: 1 } }) });
test('the catch-up check drops a value whose quoted words are not in the conversation, and a figure nobody said', async () => {
  const transcript = [{ who: 'adviser', text: 'Are you married?' }, { who: 'client', text: 'I am a nurse at the hospital.' }, { who: 'client', text: 'We spend about even a month on groceries.' }];
  const fetchImpl = reply({ actions: [
    { do: 'fill', field: 'occ', value: 'Nurse', said: 'I am a nurse at the hospital' },
    { do: 'fill', field: 'marital', value: 'Married in community of property', said: 'we are married in community of property' },
    { do: 'fill', field: 'employer', value: 'Netcare' },
    { do: 'fill', field: 'dob', value: '1980-01-01', said: 'ok' }
  ], unplaced: [{ text: 'Spends about R 6 000 a month on groceries', section: 'income' }, { text: 'Wants to retire early', section: 'income' }] });
  const r = await AI.sweep({ apiKey: 'k', fetchImpl, idx, model: 'claude-sonnet-5-5', transcript, filled: {}, listRows: () => [] });
  assert.deepStrictEqual(r.actions.map(a => a.field), ['occ'], 'only what was quoted from the conversation is kept');
  assert.strictEqual(r.dropped.length, 4);
  assert.ok(r.dropped.some(d => /marital/.test(d)) && r.dropped.some(d => /employer/.test(d)) && r.dropped.some(d => /amount was not said/.test(d)));
  assert.deepStrictEqual(r.unplaced.map(u => u.text), ['Wants to retire early'], 'the figure nobody said is left out');
});

test('a catch-up reply with nothing quotable is no action at all', async () => {
  const r = await AI.sweep({ apiKey: 'k', fetchImpl: reply({ actions: [{ do: 'fill', field: 'occ', value: 'Nurse' }] }), idx, model: 'claude-sonnet-5-5', transcript: [{ who: 'client', text: 'I am a nurse' }], filled: {}, listRows: () => [] });
  assert.strictEqual(r.kind, 'none'); assert.strictEqual(r.dropped.length, 1);
});

test('Claude is told about each of these in the live prompt and in the catch-up prompt', () => {
  const live = AI.SYSTEM, sweep = AI.SWEEP_SYSTEM;
  assert.match(live, /never replaced by a rounder version/); assert.match(live, /33 288/);
  assert.match(live, /never more than the gross income/); assert.match(live, /"Overheads", "obligations"[\s\S]*expenses \(exp\)/);
  assert.match(live, /that is with me/); assert.match(live, /Never carry a name over/);
  assert.match(live, /Amounts in an "unplaced" point are figures that were actually said/);
  assert.match(live, /Two people can be on the client's side of the call/); assert.match(live, /fill "on_call"/); assert.match(live, /for the client's spouse Marie-Louise/);
  assert.match(live, /SPOUSE's medical aid[\s\S]*never "None"/);
  assert.match(live, /only for a loan secured on a property/); assert.match(live, /Vehicle finance, a credit card/);
  assert.match(sweep, /EVERY action carries "said"/); assert.match(sweep, /thrown away/); assert.match(sweep, /a marital status/);
  assert.match(sweep, /never more than the gross income/); assert.match(sweep, /Two people can be on the client's side/); assert.match(sweep, /never "None"/);
  assert.ok(schema.fieldsById.on_call && schema.fieldsById.on_call.opt, 'the box that holds who is on the call');
});
