const test = require('node:test');
const assert = require('node:assert');
const L = require('../app/js/lookup.js');

const reply = (status, body) => () => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const textReply = text => ({ stop_reason: 'end_turn', content: [{ type: 'server_tool_use', name: 'web_search' }, { type: 'web_search_tool_result', content: [] }, { type: 'text', text }] });

test('the request uses web search, a low effort and the chosen model', () => {
  const r = L.buildRequest('Sample Primary School', 'company', 'claude-opus-5-5');
  assert.strictEqual(r.model, 'claude-opus-5-5');
  assert.strictEqual(r.tools[0].type, 'web_search_20260209');
  assert.strictEqual(r.tools[0].name, 'web_search');
  assert.strictEqual(r.output_config.effort, 'low');
  assert.ok(r.messages[0].content.includes('Sample Primary School'));
  assert.ok(!('temperature' in r) && !JSON.stringify(r).includes('budget_tokens'));
});
test('only the written answer is used, not the search steps', () => {
  assert.strictEqual(L.extractText(textReply('  A public school.  ')), 'A public school.');
});
test('a lookup sends the key and headers and returns the description', async () => {
  let seen;
  const fetchImpl = (url, opts) => { seen = { url, opts }; return reply(200, textReply('Public primary school for Grade R to 7.'))(); };
  const out = await L.run({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', name: 'Sample Primary School', kind: 'company', fetchImpl });
  assert.strictEqual(out, 'Public primary school for Grade R to 7.');
  assert.strictEqual(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(seen.opts.headers['x-api-key'], 'sk-ant-test');
  assert.strictEqual(seen.opts.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(seen.opts.headers['anthropic-dangerous-direct-browser-access'], 'true');
});
test('a paused search is continued', async () => {
  let calls = 0;
  const fetchImpl = (url, opts) => {
    calls++;
    if (calls === 1) return reply(200, { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search' }] })();
    assert.strictEqual(JSON.parse(opts.body).messages.length, 2);
    return reply(200, textReply('Done.'))();
  };
  assert.strictEqual(await L.run({ apiKey: 'k', name: 'X', kind: 'company', fetchImpl }), 'Done.');
  assert.strictEqual(calls, 2);
});
test('problems are explained in plain words', async () => {
  await assert.rejects(L.run({ apiKey: '', name: 'X', fetchImpl: reply(200, {}) }), /API key/);
  await assert.rejects(L.run({ apiKey: 'k', name: 'X', fetchImpl: reply(401, { error: { message: 'invalid x-api-key' } }) }), /not accepted/);
  await assert.rejects(L.run({ apiKey: 'k', name: 'X', fetchImpl: reply(400, { error: { message: 'The web search tool is not enabled for this organization' } }) }), /Web search is not switched on/);
  await assert.rejects(L.run({ apiKey: 'k', name: 'X', fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) }), /Could not reach Anthropic/);
});
