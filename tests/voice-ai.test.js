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

test('when the page cannot tell who is speaking, Claude returns what to do, in order', async () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: null, targetValue: '', recent: [] }, 'auto', 'your first name is John and your second name? oh my second name is Peters', 'm');
  assert.strictEqual(JSON.parse(req.messages[0].content).newest.who, 'unclear');
  assert.ok(/unclear/.test(req.system) && /WHOEVER/.test(req.system) && /actions/.test(req.system));
  const ctx = { sectionId: 'info', targetId: null, targetValue: '', recent: [] };
  const run = body => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', ctx, fetchImpl: reply(body) });
  const many = await run({ actions: [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'ask', field: 'sname' }, { do: 'fill', field: 'sname', value: 'Peters' }] });
  assert.deepStrictEqual(many, { kind: 'actions', actions: [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'ask', field: 'sname' }, { do: 'fill', field: 'sname', value: 'Peters' }] });
  const mix = await run({ actions: [{ do: 'section', section: 'occ' }, { do: 'confirm', field: 'occ' }, { do: 'wait' }] });
  assert.deepStrictEqual(mix.actions.map(a => a.do), ['section', 'confirm', 'wait']);
  assert.deepStrictEqual(await run({ actions: [] }), { kind: 'none' });
  assert.deepStrictEqual(await run({ actions: [{ do: 'fill', field: 'idno', value: '1' }, { do: 'ask', field: 'cell' }, { do: 'fill', field: 'nope', value: 'x' }, { do: 'fill', field: 'occ', value: '  ' }, { do: 'section', section: 'zzz' }] }), { kind: 'none' });
  const old = await run({ role: 'client', answers: [{ field: 'employer', value: 'Discovery' }] });
  assert.deepStrictEqual(old.actions, [{ do: 'fill', field: 'employer', value: 'Discovery' }]);
  const oldAsk = await run({ role: 'adviser', section: 'occ', field: 'occ' });
  assert.deepStrictEqual(oldAsk.actions, [{ do: 'ask', field: 'occ' }]);
});
test('a host that can reach Claude without a key can be used in place of the key', async () => {
  const calls = [];
  const ask = (system, user) => { calls.push({ system, user }); return Promise.resolve('Sure. {"actions":[{"do":"fill","field":"employer","value":"Discovery"}]}'); };
  const r = await AI.decide({ model: 'm', idx, who: 'auto', text: 'my employer is Discovery', ctx: { sectionId: 'occ', targetId: 'employer', recent: [] }, ask });
  assert.strictEqual(r.actions[0].value, 'Discovery');
  assert.ok(calls[0].system.includes('Fact Find') && JSON.parse(calls[0].user).newest.text === 'my employer is Discovery');
  await assert.rejects(() => AI.decide({ model: 'm', idx, who: 'me', text: 'x', ctx: {}, ask: () => Promise.reject({ code: 'not_granted' }) }), /not allowed/);
  await assert.rejects(() => AI.decide({ model: 'm', idx, who: 'me', text: 'x', ctx: {} }), /no API key/);
});
