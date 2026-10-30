const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const T = undefined;
  // [line, expected value of the box after it (undefined = do not check)]
  const scenarios = [
    ['the real log (12:50)', 'pemail', [
      ['perfect I want to get your personal email address what is your personal email address', ''],
      ["it's pool one period", ''],
      ['@gmail.com', 'pool1.@gmail.com'.replace('.@', '@') && T],
      ["okay we need to correct that so let's try again let's delete the personal email address", ''],
      ['can personal email addresses pull one', ''],
      ['dot offenses', ''],
      ['@gmail.com', 'pull1.kafentzis@gmail.com'],
      ['can you hear me', 'pull1.kafentzis@gmail.com'],
      ['yes the personal email address is incorrect', ''],
      ['we need to delete that', ''],
      ['my personal email address is', ''],
      ['pool one', ''],
      ['dot kafentzis', ''],
      ['at gmail.com', 'pool1.kafentzis@gmail.com'],
    ]],
    ['delete that while pieces are held', 'pemail', [
      ['what is your personal email address?', ''],
      ['paul k one', ''],
      ['delete that', ''],
      ['paul k one', ''],
      ['dot kafentzis', ''],
      ['at gmail dot com', 'paulk1.kafentzis@gmail.com'],
    ]],
    ['remove it, then the box stays empty', 'pemail', [
      ['what is your personal email address?', ''],
      ['paul k one dot kafentzis at gmail dot com', 'paulk1.kafentzis@gmail.com'],
      ['please remove it', ''],
      ['scratch that', 'paulk1.kafentzis@gmail.com'],
    ]],
    ['other talk does not delete', 'pemail', [
      ['what is your personal email address?', ''],
      ['paul k one dot kafentzis at gmail dot com', 'paulk1.kafentzis@gmail.com'],
      ["I will remove it from my mailing list later on today when I get home", 'paulk1.kafentzis@gmail.com'],
      ['is the email address incorrect?', 'paulk1.kafentzis@gmail.com'],
    ]],
    ['work email wrong, said again in one go', 'wemail', [
      ['what is your work email address?', ''],
      ['paul k at life risk dot co dot za', 'paulk@liferisk.co.za'],
      ['the work email address is wrong', ''],
      ['paul k at liferisk dot co dot za', 'paulk@liferisk.co.za'],
    ]],
  ];
  let bad = 0;
  for (const [name, box, lines] of scenarios) {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + dir + '/index.html');
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
    await p.reload();
    await p.evaluate(() => {
      window.__sent = [];
      window.fetch = async (url, init) => {
        const req = JSON.parse(init.body);
        if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
        const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text; let a = [];
        window.__sent.push(t);
        if (/personal email address\?/.test(t)) a = [{ do: 'ask', field: 'pemail' }];
        else if (/work email address\?/.test(t)) a = [{ do: 'ask', field: 'wemail' }];
        else if (/\[E1\]/.test(t) && body.position && body.position.field) a = [{ do: 'fill', field: body.position.field, value: '[E1]', correction: true }];
        else if (/scratch that/.test(t)) a = [{ do: 'cmd', cmd: 'undo' }];
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
    });
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    await p.evaluate(() => { FF.app.state.f.fname.v = 'Paul'; FF.app.state.f.sname.v = 'Kafentzis'; });
    let fails = [];
    for (const [l, want] of lines) {
      const e = await p.evaluate(x => FF.app.voiceHear(x).then(en => en && en.entry ? en.entry.did : []), l).catch(() => []);
      await p.waitForTimeout(150);
      const v = await p.evaluate(id => FF.app.state.f[id].v, box);
      if (want !== undefined && v !== want) fails.push(JSON.stringify(l) + ' -> ' + JSON.stringify(v) + ' (wanted ' + JSON.stringify(want) + ')');
      if (process.argv[4]) console.log('   ', JSON.stringify(l), '=>', JSON.stringify(v), JSON.stringify(e));
    }
    const sent = await p.evaluate(() => window.__sent);
    if (process.argv[4]) console.log('   sent to Claude:', JSON.stringify(sent));
    if (fails.length || errs.length) bad++;
    console.log((fails.length || errs.length ? 'FAIL ' : 'PASS ') + name + (fails.length ? '\n     ' + fails.join('\n     ') : '') + (errs.length ? ' ERR ' + errs.join(';') : ''));
    await p.context().close();
  }
  console.log(bad ? bad + ' failing' : 'all pass');
  await b.close();
})();
