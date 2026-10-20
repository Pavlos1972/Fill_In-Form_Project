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

test('what a response cost: tokens at the published prices, the cache at its own prices, web searches at a cent each', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
  close(L.costOf('claude-haiku-5-5', { input_tokens: 1500, output_tokens: 100, cache_read_input_tokens: 5900 }), (1500 * 0.1 + 100 * 0.5 + 5900 * 0.01) / 1e6);
  close(L.costOf('claude-sonnet-5-5', { input_tokens: 1500, output_tokens: 100, cache_read_input_tokens: 5900, cache_creation_input_tokens: 4000 }), (1500 * 2 + 100 * 10 + 5900 * 0.1 + 4000 * 2.5) / 1e6);
  close(L.costOf('claude-opus-5-5', { input_tokens: 10000, output_tokens: 300, server_tool_use: { web_search_requests: 3 } }), (10000 * 4 + 300 * 20) / 1e6 + 0.03);
  close(L.costOf('claude-opus-5-5', undefined), 0);
  close(L.costOf('claude-opus-5-5', { input_tokens: 'x', output_tokens: -5 }), 0);
  assert.strictEqual(L.costOf('some-new-model', { input_tokens: 1e6 }), L.costOf('claude-opus-5-5', { input_tokens: 1e6 }), 'a model not in the list is priced as the dearest, so the meter never reads low');
});
test('a tally adds up responses and tokens', () => {
  const t = { usd: 0, calls: 0, input: 0, output: 0, read: 0, write: 0, searches: 0 };
  const a = L.addUsage(t, 'claude-haiku-5-5', { input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 5000 });
  const b = L.addUsage(t, 'claude-opus-5-5', { input_tokens: 2000, output_tokens: 100, server_tool_use: { web_search_requests: 2 } });
  assert.strictEqual(t.calls, 2);
  assert.ok(Math.abs(t.usd - (a + b)) < 1e-12);
  assert.deepStrictEqual([t.input, t.output, t.read, t.write, t.searches], [3000, 150, 5000, 0, 2]);
  assert.ok(L.addUsage({}, 'claude-haiku-5-5', {}) === 0, 'a tally without its fields still works');
});
test('every price on offer in Settings has a price', () => {
  L.MODELS.forEach(m => assert.ok(L.PRICES[m.id] && L.PRICES[m.id].input > 0 && L.PRICES[m.id].output > L.PRICES[m.id].input && L.PRICES[m.id].read < L.PRICES[m.id].input, m.id));
});
test('the voice model defaults to Sonnet, which is the one marked recommended; an older saved voice model is replaced once', () => {
  const store = {};
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try {
    assert.strictEqual(L.DEFAULT_VOICE_MODEL, 'claude-sonnet-5-5');
    assert.deepStrictEqual(L.VOICE_MODELS.filter(m => /recommended/.test(m.label)).map(m => m.id), ['claude-sonnet-5-5']);
    L.VOICE_MODELS.forEach(m => assert.ok(L.PRICES[m.id], 'priced: ' + m.id));
    store['wr-fact-find-settings'] = JSON.stringify({ apiKey: 'k', voiceModel: 'claude-haiku-5-5' });   // saved by an earlier version
    assert.strictEqual(L.getSettings().voiceModel, 'claude-sonnet-5-5');
    L.saveSettings({ apiKey: 'k', model: 'claude-opus-5-5', voiceModel: 'claude-haiku-5-5', expires: '' });   // a choice made now is kept
    assert.strictEqual(L.getSettings().voiceModel, 'claude-haiku-5-5');
  } finally { delete global.localStorage; }
});
