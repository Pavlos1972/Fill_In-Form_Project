const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const cases = [
    // [name, lines, expected status of pemail, claude stub answer for the agreement line]
    ['client: "and my personal email address is also correct" (Claude only points)', ['and my personal email address is also correct'], 'confirmed', 'ask'],
    ['client: same, Claude says nothing', ['my personal email address is also correct'], 'confirmed', 'none'],
    ['client: same, Claude unreachable', ['my personal email address is also correct'], 'confirmed', 'fail'],
    ['client: "yes my personal email address is correct"', ['yes my personal email address is correct'], 'confirmed', 'ask'],
    ['adviser read-back with the address is NOT agreement', ['so your personal email address is paul1.kafentzis@gmail.com is that correct'], 'verify', 'confirm'],
    ['adviser: "your personal email address is correct?" is a question', ['is your personal email address correct?'], 'verify', 'confirm'],
    ['client: "I confirm my personal email address is correct"', ['I confirm my personal email address is correct'], 'confirmed', 'ask'],
    ['work email statement does not confirm the personal one', ['my work email address is correct'], 'verify', 'none'],
  ];
  let bad = 0;
  for (const [name, lines, want, mode] of cases) {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + dir + '/index.html');
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
    await p.reload();
    await p.evaluate(m => {
      window.fetch = async (url, init) => {
        const req = JSON.parse(init.body);
        if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
        if (m === 'fail') return new Response('{"error":{"message":"down"}}', { status: 500 });
        const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text; let a = [];
        if (m === 'ask' && /correct/.test(t)) a = [{ do: 'ask', field: 'pemail' }];
        if (m === 'confirm' && /correct/.test(t)) a = [{ do: 'confirm', field: 'pemail' }];
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
    }, mode);
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    await p.evaluate(() => { const s = FF.app.state; s.f.fname.v = 'Paul'; s.f.sname.v = 'Kafentzis'; s.f.pemail.v = 'paul1.kafentzis@gmail.com'; s.f.pemail.st = 'verify'; s.f.wemail.v = 'paulk@liferisk.co.za'; s.f.wemail.st = 'confirmed'; FF.app.redraw(); });
    for (const l of lines) { await p.evaluate(x => FF.app.voiceHear(x), l); await p.waitForTimeout(250); }
    const st = await p.evaluate(() => FF.app.state.f.pemail.st);
    const ok = st === want; if (!ok) bad++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + ' => ' + st + (ok ? '' : ' (wanted ' + want + ')') + (errs.length ? ' ERR ' + errs.join(';') : ''));
    await p.context().close();
  }
  console.log(bad ? bad + ' failing' : 'all pass');
  await b.close();
})();
