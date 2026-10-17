const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');
const idx = V.buildIndex(schema);

const reply = body => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }) });

test('nothing private is sent: not the fields, not numbers or emails in the text', () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: 'fname', targetValue: 'Vicky', recent: [{ who: 'client', text: 'my cell is 082 555 0148 and my email is vicky@example.com' }] }, 'client', 'my ID is 8104120195088', 'claude-sonnet-5-5');
  const s = JSON.stringify(req);
  ['idno', 'cell', 'work', 'home', 'pemail', 'wemail', 'sp_tel', '"tax"'].forEach(id => assert.ok(!s.includes('"id":' + (id.startsWith('"') ? id : '"' + id + '"')), id));
  assert.ok(!/0825550148|082 555|8104120195088|vicky@example/.test(s));
  assert.ok(s.includes('[number]') && s.includes('[email]'));
  assert.strictEqual(req.model, 'claude-sonnet-5-5');
});
test('amounts of six or seven digits are not mistaken for private numbers', () => {
  assert.ok(AI.scrub('I earn 120000 and 1 250 000').includes('120000'));
  assert.ok(AI.scrub('I earn 120000 and 1 250 000').includes('1 250 000'));
});
test('only the fields of the current section carry their option lists', () => {
  const req = AI.buildRequest(idx, { sectionId: 'occ', targetId: 'employer', targetValue: '', recent: [] }, 'me', 'so who do you work for', 'm');
  const body = JSON.parse(req.messages[0].content);
  assert.ok(body.fields.find(x => x.id === 'employed').options);
  assert.ok(!body.fields.find(x => x.id === 'smoker').options);
  assert.strictEqual(body.position.field, 'employer');
  assert.strictEqual(body.newest.who, 'adviser');
});
test("the adviser's line points at a section or a field", async () => {
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: "let's chat about your job", ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply({ section: 'occ', field: null }) });
  assert.deepStrictEqual(r, { kind: 'point', field: null, section: 'occ' });
  const r2 = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'so what do you do', ctx: { sectionId: 'occ', recent: [] }, fetchImpl: reply('Sure! {"section":"occ","field":"occ"}') });
  assert.deepStrictEqual(r2, { kind: 'point', field: 'occ', section: 'occ' });
});
test('the client\'s line gives answers; private and unknown fields are dropped', async () => {
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: "I'm an underwriter at Discovery", ctx: { sectionId: 'occ', targetId: 'occ', recent: [] },
    fetchImpl: reply({ answers: [{ field: 'occ', value: 'Underwriter', confirm: false }, { field: 'employer', value: 'Discovery' }, { field: 'idno', value: '8104120195088' }, { field: 'nope', value: 'x' }, { field: 'years', value: '' }] }) });
  assert.deepStrictEqual(r.answers.map(a => a.field), ['occ', 'employer']);
  const c = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'yes that is right', ctx: { sectionId: 'occ', targetId: 'occ', targetValue: 'Underwriter', recent: [] }, fetchImpl: reply({ answers: [{ field: 'occ', confirm: true }] }) });
  assert.deepStrictEqual(c.answers, [{ field: 'occ', confirm: true, value: null }]);
  const w = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'no', ctx: { sectionId: 'occ', targetId: 'occ', targetValue: 'Underwriter', recent: [] }, fetchImpl: reply({ answers: [], waiting: true }) });
  assert.strictEqual(w.waiting, true);
});
test('rubbish or errors from the service never reach the form', async () => {
  const none = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'x', ctx: {}, fetchImpl: reply('I am not sure what you mean') });
  assert.deepStrictEqual(none, { kind: 'none' });
  await assert.rejects(() => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'x', ctx: {}, fetchImpl: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }) }), /not accepted/);
  await assert.rejects(() => AI.decide({ apiKey: '', model: 'm', idx, who: 'me', text: 'x', ctx: {} }), /no API key/);
  await assert.rejects(() => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'x', ctx: {}, fetchImpl: () => Promise.reject(new Error('offline')) }), /no connection/);
});
