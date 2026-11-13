/* Release 3.8 on the real page (Claude faked): a "heard but not placed" note the form now covers is closed; the Admin page lists the notes Claude read, with a button to close a loose one; a point with no
   source is removed and named; small talk and a broken-off sentence are not noted, and life-cover words said in the Will notes go to Client priorities; a copy whose scripts come from another folder shows the red bar. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const dir = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  /* Claude is faked: the action points come back with sources (one good, one with words that are not in the note, one with none); a voice line is answered from a table */
  const reply = { points: [
    { text: 'Send the client Sam the letter of authority to sign.', from: 'loa' },
    { text: 'Offer to arrange a will review for the client Sam.', from: 'n_will', said: 'Offer a will review' },
    { text: 'Send the client Sam the two quotes and await his reply.', from: 'n_will', said: 'send both quotes and wait for the reply' },
    { text: 'Ask the client Sam to send the details of his two remaining children.' },
    { text: 'Set up a follow-up appointment with the client Sam (date and time to be agreed).', from: 'appointment' }], notes: [{ id: 'n_will', status: 'action' }] };
  await ctx.route('https://api.anthropic.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }) }));
  await p.goto('file://' + dir + '/index.html');
  ok(await p.evaluate(() => !document.getElementById('buildBanner') && FF.build.result && FF.build.result.ok), 'a whole copy shows no red bar and the check passed: ' + JSON.stringify(await p.evaluate(() => FF.build.result)));
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }));

  /* 1. a stale note is closed when the form catches up */
  await p.evaluate(() => {
    const S = FF.app.state, st = FF.store; st.setField(S, 'fname', 'Sam'); st.setField(S, 'loa', 'Yes');
    for (let i = 0; i < 3; i++) st.addRow(S, 'kids', { name: 'Child' + i, sname: 'Test', gender: 'Female', dob: '01/01/2018' });
    st.addUnplaced(S, { text: 'The client has five children in total; only three are on the form so far', sec: 'kids' });
    st.addUnplaced(S, { text: 'Client will send his policy schedule next week', sec: 'prio' });
    st.setField(S, 'n_will', 'Offer a will review');
    FF.app.redraw();
  });
  await p.click('.nav button[data-sec="income"]'); await p.waitForTimeout(300);
  await p.fill('[data-f="n_income"]', 'x'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.unplaced.length === 2), 'three of five children on the form: the note stays');
  await p.evaluate(() => { const S = FF.app.state; for (let i = 3; i < 5; i++) FF.store.addRow(S, 'kids', { name: 'Child' + i, sname: 'Test', gender: 'Female', dob: '01/01/2016' }); FF.app.redraw(); });
  await p.fill('[data-f="n_income"]', 'xy'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.unplaced.length === 1 && !/five children/.test(FF.app.state.unplaced[0].text)), 'five children on the form: the note is closed by itself');

  /* 2. the Admin page: notes read, the sources, what was removed */
  await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => /^Notes read for these points \(\d+\)/.test(document.querySelector('#paRead summary').textContent)), 'the Admin page lists the notes read: ' + await p.evaluate(() => document.querySelector('#paRead summary').textContent));
  await p.click('#paRefresh'); await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.querySelector('[data-f="pa_actions"]').value);
  ok(/will review/.test(t) && /letter of authority/.test(t), 'the points with a good source are in the box: ' + JSON.stringify(t));
  ok(!/two quotes|remaining children/.test(t), 'the point whose quoted words are not in the note, and the point with no source, are not in the box');
  const sm = await p.evaluate(() => document.querySelector('#paRead summary').textContent);
  ok(/2 points removed/.test(sm), 'the panel says two points were removed: ' + sm);
  await p.evaluate(() => { document.getElementById('paRead').open = true; });
  const body = await p.evaluate(() => document.querySelector('#paRead .paread-body').textContent);
  ok(/Removed: the words it quotes are not in that note/.test(body) && /Removed: it names no source/.test(body), 'each removed point says why');
  ok(/Offer a will review/.test(body) && /a point was written/.test(body), 'the note and what became of it are shown');
  ok(await p.evaluate(() => !!document.querySelector('#paRead [data-up$=":no"]')), 'the loose note from the voice has a button to close it');
  await p.click('#paRead [data-up$=":no"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.unplaced.length === 0 && !document.querySelector('#paRead [data-up$=":no"]')), 'closing it removes it from the list and from the panel');

  /* 3. notes: small talk and a broken-off sentence are not noted; life cover said in the Will notes goes to Client priorities */
  await p.evaluate(() => {
    window.__script = {};
    window.fetch = async (url, init) => {
      const req = JSON.parse(init.body); if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), tt = body.newest ? body.newest.text : '';
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: window.__script[tt] || [] }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  await p.click('.nav button[data-sec="other"]'); await p.waitForTimeout(300);
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const line = 'Let me make a couple of notes about the will';
  await p.evaluate(l => { window.__script[l] = [{ do: 'cmd', cmd: 'notes' }, { do: 'note', text: 'All right then, fantastic' }, { do: 'note', text: 'Alex, when can you' }, { do: 'note', text: 'Client will reply by email when the two life insurance quotes are sent' }, { do: 'note', text: 'Offer to arrange a will review' }]; return FF.app.voiceHear(l, 'me'); }, line);
  await p.waitForTimeout(900);
  const n = await p.evaluate(() => ({ will: FF.app.state.f.n_ma.v + '\n' + FF.app.state.f.n_will.v, prio: FF.app.state.f.n_prio.v }));       // with no box in view the notes open in the first notes box of the page
  ok(/Offer to arrange a will review/.test(n.will) && !/fantastic|when can you|life insurance/.test(n.will), 'the notes of the page keep the will remark and lose the small talk, the broken-off sentence and the life cover line: ' + JSON.stringify(n.will));
  ok(/life insurance quotes are sent/.test(n.prio), 'the life insurance line is in the notes of Client priorities and quotes needed: ' + JSON.stringify(n.prio));

  /* 4. a copy whose scripts come from another folder shows the red bar, with the problem */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wrcopy-'));
  fs.cpSync(dir, path.join(tmp, 'WR Fact Find'), { recursive: true }); fs.cpSync(path.join(dir, 'js'), path.join(tmp, 'WR Fact Find - before 3.6 (13 Nov 2026)', 'js'), { recursive: true });
  const idx = path.join(tmp, 'WR Fact Find', 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('src="js/calc.js', 'src="../WR Fact Find - before 3.6 (13 Nov 2026)/js/calc.js'));
  const q = await (await b.newContext()).newPage(); await q.goto('file://' + idx);
  const bar = await q.evaluate(() => (document.getElementById('buildBanner') || {}).textContent || '');
  ok(/Mixed versions/.test(bar) && /another folder/.test(bar) && /before 3\.6/.test(bar), 'a page that loads a script from the backup folder shows the red bar: ' + bar.slice(0, 200));
  fs.writeFileSync(idx, fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('content="3.8"', 'content="3.7"'));
  await q.goto('file://' + idx); const bar2 = await q.evaluate(() => (document.getElementById('buildBanner') || {}).textContent || '');
  ok(/page is build 3\.7 but its scripts are build 3\.8/.test(bar2), 'a page of another build shows it: ' + bar2.slice(0, 200));
  fs.rmSync(path.join(tmp, 'WR Fact Find', 'js', 'build.js')); fs.writeFileSync(idx, fs.readFileSync(path.join(dir, 'index.html'), 'utf8'));
  await q.goto('file://' + idx); const bar3 = await q.evaluate(() => (document.getElementById('buildBanner') || {}).textContent || '');
  ok(/js\/build\.js is missing/.test(bar3), 'an old copy with no build.js shows the bar too: ' + bar3.slice(0, 120));
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
