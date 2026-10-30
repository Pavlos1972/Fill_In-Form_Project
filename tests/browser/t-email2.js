const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const scenarios = [
    ['whole, spelled', 'pemail', ['what is your personal email address?', 'P A U L K 1 dot K A F E N T Z I S at gmail dot com'], 'paulk1.kafentzis@gmail.com'],
    ['whole, dictated, misheard surname', 'pemail', ['what is your personal email address?', 'Paul K one dot cafences at gmail dot com'], 'paulk1.kafentzis@gmail.com'],
    ['whole, typed by Chrome', 'pemail', ['what is your personal email address?', 'paulk1.kafentzis@gmail.com'], 'paulk1.kafentzis@gmail.com'],
    ['pieces, misheard', 'pemail', ['what is your personal email address?', 'yes my personal email address is Paul K1', 'Dot cafences', '@gmail.com'], 'paulk1.kafentzis@gmail.com'],
    ['pieces, with at/dot words', 'pemail', ['what is your personal email address?', 'Paul k one', 'dot kafentzis', 'at gmail dot com'], 'paulk1.kafentzis@gmail.com'],
    ['work, pieces (the log)', 'wemail', ['Paul can we talk about your work email address please', 'my work email address is Paul k', 'at life risk', '.co.za'], 'paulk@liferisk.co.za'],
    ['work, pieces, no lead-in (the log, second go)', 'wemail', ['please give me your work email address', 'Paul k', 'at liferisk', '.co.za'], 'paulk@liferisk.co.za'],
    ['work, whole', 'wemail', ['what is your work email address?', 'paul k at life risk dot co dot za'], 'paulk@liferisk.co.za'],
    ['spelled in pieces', 'pemail', ['what is your personal email address?', 'P A U L K 1', 'dot K A F E N T Z I S', 'at gmail dot com'], 'paulk1.kafentzis@gmail.com'],
    ['redo of a wrong address', 'pemail', ['what is your personal email address?', 'paul k1 dot cafences at gmail dot com', 'okay that is a problem the spelling is wrong', 'my personal email address is', 'Paul K1', '.Kafentzis', 'at gmail.com'], 'paulk1.kafentzis@gmail.com'],
    ['chatter does not start one', 'wemail', ['what is your work email address?', 'there is a problem with the program', 'yes I do', 'okay let me think'], ''],
    ['unfinished address is kept as heard', 'wemail', ['what is your work email address?', 'Paul k at liferisk', 'now what is your smoker status'], 'paulk@liferisk'],
  ];
  let bad = 0;
  for (const [name, box, lines, want] of scenarios) {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + dir + '/index.html');
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
    await p.reload();
    await p.evaluate(() => {
      window.fetch = async (url, init) => {
        const req = JSON.parse(init.body);
        if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
        const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text; let a = [];
        if (/personal email address\?/.test(t)) a = [{ do: 'ask', field: 'pemail' }];
        else if (/work email address/.test(t) && /(?:talk about|give me|what is)/.test(t)) a = [{ do: 'ask', field: 'wemail' }];
        else if (/smoker status/.test(t)) a = [{ do: 'ask', field: 'smoker' }];
        else if (/\[E1\]/.test(t) && body.position && body.position.field) a = [{ do: 'fill', field: body.position.field, value: '[E1]', correction: true }];
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
    });
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    await p.evaluate(() => { FF.app.state.f.fname.v = 'Paul'; FF.app.state.f.sname.v = 'Kafentzis'; });
    for (const l of lines) { await p.evaluate(x => FF.app.voiceHear(x), l); await p.waitForTimeout(120); }
    await p.waitForTimeout(200);
    const got = await p.evaluate(id => FF.app.state.f[id].v + ' | ' + FF.app.state.f[id].st, box);
    const val = got.split(' | ')[0], ok = val === want;
    if (!ok) bad++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + ' => ' + JSON.stringify(got) + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')') + (errs.length ? ' ERR ' + errs.join(';') : ''));
    await p.context().close();
  }
  console.log(bad ? bad + ' failing' : 'all pass');
  await b.close();
})();
