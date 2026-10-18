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

test('the top bar counts down the days to the key expiry date', () => {
  const now = new Date(2026, 9, 16);
  assert.strictEqual(L.keyStatus({ apiKey: '' }, now).text, '');
  assert.strictEqual(L.keyStatus({ apiKey: 'k', expires: '' }, now).level, 'unset');
  const a = L.keyStatus({ apiKey: 'k', expires: '2026-11-15' }, now);
  assert.deepStrictEqual([a.level, a.days, a.text], ['ok', 30, 'Key: 30 days left']);
  assert.strictEqual(L.keyStatus({ apiKey: 'k', expires: '2026-10-30' }, now).level, 'soon');
  assert.strictEqual(L.keyStatus({ apiKey: 'k', expires: '2026-10-17' }, now).text, 'Key: 1 day left');
  assert.strictEqual(L.keyStatus({ apiKey: 'k', expires: '2026-10-16' }, now).text, 'Key expires today');
  assert.strictEqual(L.keyStatus({ apiKey: 'k', expires: '2026-10-15' }, now).level, 'expired');
});

test('a client look-up names only the person, the employer and the occupation, and keeps to what matches', () => {
  const r = L.buildRequest('Jane Doe', 'person', 'claude-opus-5-5', null, { org: 'Acme (Pty) Ltd', role: 'Financial planner' });
  const ask = r.messages[0].content;
  assert.ok(ask.includes('"Jane Doe"') && ask.includes('Acme (Pty) Ltd') && ask.includes('Financial planner') && ask.includes('LinkedIn'));
  assert.ok(/never mix two people up/.test(ask) && /No public profile found that clearly matches/.test(ask) && /Likely match:/.test(ask) && /Possible match, check it:/.test(ask));
  assert.ok(/family, health, money, age, address/.test(ask));                                       // nothing personal is asked for
  assert.strictEqual(r.tools[0].name, 'web_search');
  assert.ok(!/\d{6,}|@/.test(ask));                                                                  // no number or address in it
});
test('a person look-up through run() sends the employer and occupation too', async () => {
  let sent;
  const fetchImpl = (url, opts) => { sent = JSON.parse(opts.body); return reply(200, textReply('A planner at Acme.'))(); };
  assert.strictEqual(await L.run({ apiKey: 'k', name: 'Jane Doe', kind: 'person', org: 'Acme', role: 'Planner', fetchImpl }), 'A planner at Acme.');
  assert.ok(sent.messages[0].content.includes('Acme') && sent.messages[0].content.includes('Planner'));
});
test('without web search, Claude says what it knows about a company, or that it could not identify it', async () => {
  const ask = out => () => Promise.resolve(out);
  assert.strictEqual(await L.runAsk({ ask: ask('{"description": "A health insurer."}'), name: 'Discovery', kind: 'company' }), 'A health insurer.');
  assert.strictEqual(await L.runAsk({ ask: ask('{"description": null}'), name: 'Zzyzx', kind: 'company' }), 'Could not identify this company.');
  assert.strictEqual(await L.runAsk({ ask: ask('not json at all'), name: 'Zzyzx', kind: 'business' }), 'Could not identify this company.');
  await assert.rejects(L.runAsk({ ask: () => Promise.reject({ code: 'not_granted' }), name: 'X', kind: 'company' }), /Could not reach Claude/);
});
