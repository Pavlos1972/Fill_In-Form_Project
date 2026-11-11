/* Release 3.1 on the page: what Claude is not allowed to fill (a rounder figure over an agreed exact one, take-home above gross, a provider nobody named, an amount nobody said) and the bar that says
   "Nothing is being heard. Press Listen." when the meeting timer has run for more than a minute with Listen off. Claude is faked. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); localStorage.removeItem('wr-fact-find-meeting'); });
  await p.reload();
  await p.evaluate(() => {
    window.__script = {};
    window.fetch = async (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text;
      const r = window.__script[t] || { actions: [] };
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(r) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const say = async (line, reply) => { await p.evaluate(([l, r]) => { window.__script[l] = r; }, [line, reply || { actions: [] }]); await p.evaluate(l => FF.app.voiceHear(l), line); await p.waitForTimeout(250); };
  const val = id => p.evaluate(id => FF.app.state.f[id].v, id);

  // 1. a rounder figure never replaces an agreed exact one
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'gross', 'R 41 667.00', 'confirmed'); FF.store.setField(FF.app.state, 'net', 'R 33 288.36', 'confirmed'); FF.app.redraw(); });
  await say('so the take home is 33,000 odd', { actions: [{ do: 'fill', field: 'net', value: 'R 33 000', correction: true }] });
  ok(await val('net') === 'R 33 288.36', 'the agreed R 33 288.36 stays when "33,000 odd" is said: ' + await val('net'));
  await say('no it is 31 000 a month', { actions: [{ do: 'fill', field: 'net', value: 'R 31 000', correction: true }] });
  ok(await val('net') === 'R 31 000.00', 'a real correction goes through: ' + await val('net'));

  // 2. take-home above gross
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'net', '', 'empty'); FF.app.redraw(); });
  await say('our take home is 80 000 a month', { actions: [{ do: 'fill', field: 'net', value: 'R 80 000' }] });
  ok(await val('net') === '', 'take-home above the gross income is refused: ' + await val('net'));
  ok(await p.evaluate(() => (FF.app.state.unplaced || []).some(u => /more than the gross income/.test(u.text))), 'and it is kept in Heard but not placed');
  await say('our take home is 30 000 a month', { actions: [{ do: 'fill', field: 'net', value: 'R 30 000' }] });
  ok(await val('net') === 'R 30 000.00', 'a take-home below the gross is filled: ' + await val('net'));

  // 3. a provider nobody named
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'has_debts', 'Yes'); FF.store.addRow(FF.app.state, 'debts', { type: 'Home loan' }, 'heard'); FF.app.redraw(); const n = [...document.querySelectorAll('.nav button')].find(x => /Debts/.test(x.innerText)); if (n) n.click(); });
  await say("that's with me", { actions: [{ do: 'cell', list: 'debts', row: 1, col: 'prov', value: 'Nedbank' }] });
  ok(await p.evaluate(() => FF.app.state.l.debts[0].d.prov) === '', 'the bank is not filled from a line that names none');
  await say('it is with Nedbank', { actions: [{ do: 'cell', list: 'debts', row: 1, col: 'prov', value: 'Nedbank' }] });
  ok(await p.evaluate(() => FF.app.state.l.debts[0].d.prov) === 'Nedbank', 'and is filled when the line names it');

  // 4. an amount nobody said
  await say('about even a month on groceries', { actions: [], unplaced: [{ text: 'Spends about R 6 000 a month on groceries', section: 'income' }, { text: 'Groceries are a big cost', section: 'income' }] });
  const un = await p.evaluate(() => (FF.app.state.unplaced || []).map(u => u.text));
  ok(!un.some(t => /6 000/.test(t)) && un.some(t => /Groceries are a big cost/.test(t)), 'an invented amount is not kept, a plain point is: ' + JSON.stringify(un));
  await say('we spend six thousand a month on the car', { actions: [], unplaced: [{ text: 'Spends R 6 000 a month on the car', section: 'income' }] });
  ok(await p.evaluate(() => (FF.app.state.unplaced || []).some(u => /car/.test(u.text) && /6 000/.test(u.text))), 'an amount that was said is kept');

  // 5. the Listen-off bar
  await p.click('#btnVoice'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.getElementById('nolisten').hidden), 'no bar before the timer runs');
  await p.click('#btnTimer'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('nolisten').hidden), 'no bar in the first minute');
  await p.evaluate(() => { const real = Date.now; window.__skew = 61000; Date.now = () => real() + window.__skew; });
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => !document.getElementById('nolisten').hidden && /Nothing is being heard\. Press Listen\./.test(document.getElementById('nolisten').innerText)), 'after a minute of the timer with Listen off: "Nothing is being heard. Press Listen."');
  await p.click('#btnTimer'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('nolisten').hidden), 'the bar goes when the timer is paused');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close();
  process.exit(bad ? 1 : 0);
})();
