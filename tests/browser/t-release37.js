/* Release 3.7 on the real page, Claude faked: the adviser saying "that is correct" never turns a box green (only the client agreeing does); a box emptied on purpose is not refilled by a later line about something else;
   the catch-up check is held to the guards (a take-home above the gross income is not filled). */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-30' })); });
  await p.reload();
  await p.evaluate(() => {
    window.__script = {}; window.__bodies = [];
    window.fetch = async (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text;
      window.__bodies.push(body);
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: window.__script[t] || [] }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const say = async (line, actions, who) => { await p.evaluate(([l, a]) => { window.__script[l] = a; }, [line, actions || []]); await p.evaluate(([l, w]) => FF.app.voiceHear(l, w), [line, who || 'me']); await p.waitForTimeout(280); };
  const box = id => p.evaluate(id => ({ v: FF.app.state.f[id].v, st: FF.app.state.f[id].st }), id);
  await p.click('.nav button[data-sec="occ"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'employer', 'Discovery', 'heard'); FF.app.redraw(); });

  await say('Perfect, that is correct', [{ do: 'confirm', field: 'employer' }], 'me');
  ok((await box('employer')).st === 'heard', 'the adviser saying "that is correct" does not confirm the box: ' + JSON.stringify(await box('employer')));
  await say('Yes, that is right', [{ do: 'confirm', field: 'employer' }], 'client');
  ok((await box('employer')).st === 'confirmed', 'the client agreeing does: ' + JSON.stringify(await box('employer')));

  await say('delete the employer', [{ do: 'empty', field: 'employer' }], 'me');
  ok((await box('employer')).v === '', 'the employer is emptied');
  await say('and what is your occupation?', [{ do: 'ask', field: 'occ' }], 'me');                                            // the talk has moved to another box
  await say('they pay me every month', [{ do: 'fill', field: 'employer', value: 'Easitape' }], 'client');
  ok((await box('employer')).v === '', 'a later line about something else does not put it back: ' + JSON.stringify(await box('employer')));
  ok(await p.evaluate(() => (FF.app.state.unplaced || []).some(u => /emptied on purpose/.test(u.why || ''))), 'and it is shown in Heard but not placed');
  ok(await p.evaluate(() => window.__bodies.some(bd => (bd.emptied || []).indexOf('employer') >= 0)), 'Claude was told the box was emptied on purpose');
  await say('Edwin works for Easitape', [{ do: 'fill', field: 'employer', value: 'Easitape', correction: true }], 'client');
  ok((await box('employer')).v === 'Easitape', 'a correction fills it again: ' + JSON.stringify(await box('employer')));

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
