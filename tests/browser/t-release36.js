/* Release 3.6 on the real page, with Claude faked from a table: the faults of a recorded meeting, replayed with invented names.
   The screen stays on Client priorities; a narration fills no debt; "debt three, we remove that, and debt four" removes the rows and the catch-up check cannot put them back; a date said about something else is not the
   appointment; credit life offers Not sure; a joint debt is split 50/50 and shows the Spouse instalment box; a spouse who pays outright is not the client's monthly. */
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
    window.__script = {};
    window.fetch = async (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text;
      const a = window.__script[t] || [];
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const say = async (line, actions, who) => { await p.evaluate(([l, a]) => { window.__script[l] = a; }, [line, actions || []]); await p.evaluate(([l, w]) => FF.app.voiceHear(l, w), [line, who || 'me']); await p.waitForTimeout(280); };
  const sec = () => p.evaluate(() => (document.querySelector('.nav button[aria-current="true"]') || {}).dataset.sec);
  const nav = async s => { await p.click('.nav button[data-sec="' + s + '"]'); await p.waitForTimeout(250); };
  const st = () => p.evaluate(() => FF.app.state);
  const debts = () => p.evaluate(() => FF.app.state.l.debts.map(r => ({ type: r.d.type, prov: r.d.prov, desc: r.d.desc, bal: r.d.bal, inst: r.d.inst, sinst: r.d.sinst, payer: r.d.payer })));
  const f = id => p.evaluate(id => FF.app.state.f[id].v, id);

  /* 1. the screen stays on Client priorities */
  await nav('prio');
  await say('I would like prices on medical aid for myself', [{ do: 'section', section: 'other' }, { do: 'fill', field: 'pr_med', value: 'Priority: client agrees' }], 'client');
  ok(await sec() === 'prio', 'the client says medical aid and Claude moves the page: the screen stays on Client priorities (' + await sec() + ')');
  await say('The will.', [{ do: 'cmd', cmd: 'goto' }], 'me');
  await say("Okay, and then I want to talk a little bit about short-term insurance", [{ do: 'section', section: 'other' }], 'me');
  ok(await sec() === 'prio', 'the adviser names short-term insurance, a priority area on this page: the screen stays (' + await sec() + ')');
  await say('Alright, let us go to Admin', [{ do: 'section', section: 'admin' }], 'me');
  ok(await sec() === 'admin', 'an explicit "go to Admin" does move it (' + await sec() + ')');

  /* 2. a narration on Client priorities fills no debt */
  await nav('prio');
  await say("We're going to look at Lily, we're going to look at your debts, we're going to look at all of that stuff", [], 'me');
  ok((await debts()).length === 0, 'the adviser\'s narration about the debts makes no debt row: ' + JSON.stringify(await debts()));
  await say('I have never had a credit card', [], 'client');
  ok((await debts()).length === 0, '"I have never had a credit card" makes no debt');

  /* 3. debts: removed for real, and the catch-up cannot refill them */
  await nav('debts');
  await p.evaluate(() => {
    const S = FF.app.state, s = FF.store;
    s.setField(S, 'has_debts', 'Yes');
    s.addRow(S, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', desc: 'Car', payer: 'Client', bal: 'R 550 000.00', inst: 'R 6 500.00', cl: 'Not sure' });
    s.addRow(S, 'debts', { type: 'Other', desc: 'Stock', payer: 'Business', bal: 'R 20 000.00', inst: 'R 10 000.00' });
    s.addRow(S, 'debts', { type: 'Personal loan', desc: 'Loan from the owner', inst: 'R 5 000.00' });
    s.addRow(S, 'debts', { type: 'Credit card', payer: 'Client', bal: 'R 0.00' });
    FF.app.redraw();
  });
  await say("Alright, so debt three, we remove that, and debt four. Okay, perfect. So let's move on to children.", [{ do: 'empty', list: 'debts', row: 3, col: 'inst' }, { do: 'section', section: 'kids' }], 'me');
  let d = await debts();
  ok(d.length === 2 && d[0].prov === 'Wesbank' && d[1].desc === 'Stock', 'debts three and four are removed, not emptied: ' + JSON.stringify(d.map(x => x.desc)));
  await say('you should get rid of the vehicle finance', [], 'me');
  ok((await debts()).length === 2, 'advice ("you should get rid of...") removes nothing');
  await say('remove debt two', [], 'me');
  d = await debts(); ok(d.length === 1 && d[0].prov === 'Wesbank', 'remove debt two removes it: ' + JSON.stringify(d.map(x => x.desc)));
  ok(await p.evaluate(() => FF.app.voice.removed.length === 3), 'the three removed debts are remembered as taken away on purpose');

  /* 4. a date said about something else is not the appointment */
  await nav('prio');
  await say('Give me a call again on the 21st', [{ do: 'fill', field: 'next_appt', value: '2026-11-21' }], 'client');
  ok((await f('next_appt')) === '', 'the next appointment is not filled by "give me a call again on the 21st": ' + await f('next_appt'));
  await say('Can we set up the next appointment, please? Maybe the same time next week?', [{ do: 'fill', field: 'next_appt', value: '2026-11-20' }, { do: 'fill', field: 'next_time', value: '10:00' }], 'me');
  ok((await f('next_appt')) === '20/11/2026' && (await f('next_time')) === '10:00', 'said about the next appointment it is filled: ' + await f('next_appt') + ' ' + await f('next_time'));

  /* 5. credit life has Not sure; a joint debt is split; the spouse who pays is not the client's monthly */
  await nav('debts');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-l="debts"][data-k="cl"] option')].map(o => o.textContent.trim()).filter(Boolean).join('|') === 'Yes|No|Not sure'), 'Credit life with lender offers Yes, No and Not sure');
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'debts', { type: 'Home loan', prov: 'ABSA', inst: 'R 8 000.00' }); FF.app.redraw(); });
  const i2 = (await debts()).length - 1;
  ok(await p.evaluate(i => !document.querySelector('[data-l="debts"][data-i="' + i + '"][data-k="sinst"]'), i2), 'no Spouse instalment box while the Payer is not Joint or Spouse');
  await p.selectOption('[data-l="debts"][data-i="' + i2 + '"][data-k="payer"]', 'Joint'); await p.waitForTimeout(300);
  d = await debts();
  ok(d[i2].inst === 'R 4 000.00' && d[i2].sinst === 'R 4 000.00', 'Joint: R 8 000 is split 50/50 into the two boxes: ' + d[i2].inst + ' / ' + d[i2].sinst);
  ok(await p.evaluate(i => !!document.querySelector('[data-l="debts"][data-i="' + i + '"][data-k="sinst"]'), i2), 'the Spouse instalment box appears');
  await p.selectOption('[data-l="debts"][data-i="' + i2 + '"][data-k="payer"]', 'Spouse'); await p.waitForTimeout(300);
  d = await debts();
  ok(d[i2].inst === '' && d[i2].sinst === 'R 8 000.00', 'Spouse: the whole instalment is the spouse\'s and the client\'s box is empty: ' + d[i2].inst + ' / ' + d[i2].sinst);
  ok(await p.evaluate(() => /R 6 500\.00/.test(document.querySelector('[data-sum="debts:inst"]').textContent) && /R 8 000\.00/.test(document.querySelector('[data-sum="debts:sinst"]').textContent)), 'Total monthly is the client\'s own and Total spouse monthly is shown separately');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
