/* The action points on the Admin page are orders to Sitamah, the personal assistant: the box opens with a line to her, the client is always "the client <name>" (never the first name alone, which could be taken for hers),
   no point is addressed to her, and Claude is told the same. Whatever Claude writes is straightened by the form. */
const test = require('node:test');
const assert = require('node:assert');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const AI = require('../app/js/voice-ai.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);

test('the box opens with a line to Sitamah, naming the client in full with the role', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  assert.strictEqual(A.header(s), 'Sitamah, please action these for the client Thandi Dlamini:');
  assert.strictEqual(A.text(['Send the LOA.'], s), 'Sitamah, please action these for the client Thandi Dlamini:\n- Send the LOA.');
  assert.strictEqual(A.text(['Send the LOA.']), '- Send the LOA.', 'with no form, only the points');
  assert.strictEqual(A.header(fresh()), 'Sitamah, please action these for the client:');
  const t = fresh(); set(t, 'fname', 'Thandi'); assert.strictEqual(A.header(t), 'Sitamah, please action these for the client Thandi:');
});

test('the client is never named without the role, even when the name is the assistant\'s own', () => {
  const s = fresh(); set(s, 'fname', 'Sitimah'); set(s, 'sname', 'Nathoo'); set(s, 'loa', 'Yes'); set(s, 'next_appt', '06/11/2026'); set(s, 'next_time', '14:30');
  set(s, 'ref_med', 'Valerie to contact for both');
  const pts = A.local(s);
  assert.ok(pts.length >= 3);
  pts.forEach(p => assert.ok(!/(?<!the client )\bSitimah\b/.test(p), 'bare name in: ' + p));
  assert.ok(pts.every(p => !/^\s*Sitamah\b/i.test(p)), 'no point is addressed to Sitamah');
  assert.ok(pts.every(p => /^[A-Z]/.test(p)), 'every point is a sentence');
  assert.ok(pts.includes('Send the client Sitimah the LOA to sign.') || pts.some(p => /^Send the client Sitimah the LOA to sign/.test(p)));
  assert.ok(pts.includes('Set up a follow-up appointment with the client Sitimah for Friday 06/11/2026 at 14:30.'));
});

test('every point is an order: it starts with a verb, not with a report about the client', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'loa', 'Not now'); set(s, 'pref_spend', 'R 1 000.00'); set(s, 'fna_req', 'Request a quote'); set(s, 'ps_grp', 'Other'); set(s, 'ps_grp_ot', 'Employer will send'); set(s, 'has_group', 'Yes'); store.addRow(s, 'grp', { prov: 'Old Mutual' });
  const lines = A.local(s);
  assert.ok(lines.some(l => /^Do not send the LOA to the client Thandi yet: not ready to sign\./.test(l)));
  assert.ok(lines.some(l => /^Await the current policy schedules for the group risk benefits \(Old Mutual\): Employer will send\./.test(l)));
  assert.ok(lines.some(l => /^Note for the life quotes that the client Thandi prefers to spend R 1 000 p\.m\./.test(l)));
  const firstWords = lines.map(l => l.split(' ')[0]);
  const verbs = ['Send', 'Do', 'Ask', 'Follow', 'Draw', 'Await', 'Request', 'Note', 'Set'];
  firstWords.forEach(w => assert.ok(verbs.includes(w), 'not an order: ' + w));
});

test('Claude is told the points are orders to Sitamah, to name the client with the role, and not to write her name', () => {
  assert.match(AI.ACTIONS_SYSTEM, /every point is an instruction TO her/);
  assert.match(AI.ACTIONS_SYSTEM, /"the client" followed by the first name, for example "the client Thandi"/);
  assert.match(AI.ACTIONS_SYSTEM, /Never write "Sitamah" in a point/);
  assert.match(AI.ACTIONS_SYSTEM, /do not write one/, 'the line that addresses her is added by the form');
});

test('whatever Claude writes is straightened: no point addressed to Sitamah, and the client always with the role', async () => {
  const d = (p, c) => AI.directToSitamah(p, c);
  assert.strictEqual(d('Follow up with Thandi for the schedules: await client response.', 'Thandi'), 'Follow up with the client Thandi for the schedules: await client response.');
  assert.strictEqual(d('Sitamah, please send Thandi the LOA to sign.', 'Thandi'), 'Send the client Thandi the LOA to sign.');
  assert.strictEqual(d('Sitamah to ask Sitimah about credit life', 'Sitimah'), 'Ask the client Sitimah about credit life');
  assert.strictEqual(d('Ask Sitamah whether there is credit life', 'Sitamah'), 'Ask the client Sitamah whether there is credit life', 'a client who really is called Sitamah is still "the client Sitamah"');
  assert.strictEqual(d('Send the LOA to the client Thandi', 'Thandi'), 'Send the LOA to the client Thandi', 'already right: left alone');
  assert.strictEqual(d('Request an RGAR.', 'the client'), 'Request an RGAR.', 'no first name on the form: nothing to add');
  const out = await AI.actionPoints({ ask: () => Promise.resolve('{"points": ["- Sitamah: follow up with Thandi for the schedules.", "Ask Valerie to contact Thandi about medical aid."]}'), model: 'm', facts: { client: 'Thandi' } });
  assert.deepStrictEqual(out, ['Follow up with the client Thandi for the schedules.', 'Ask Valerie to contact the client Thandi about medical aid.']);
});
