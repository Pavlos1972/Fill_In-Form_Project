const { chromium } = require(process.argv[2] + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  // [name, box, lines, wanted value]
  const S = [
    ['Chrome heard heaul1.aafem (the screenshot)', 'pemail', ['what is your personal email address?', 'heaul1.aafem@gmail.com'], 'paul1.kafentzis@gmail.com'],
    ['said as words, misheard', 'pemail', ['what is your personal email address?', 'heaul one dot aafem at gmail dot com'], 'paul1.kafentzis@gmail.com'],
    ['work, "with" for "at", "life rest" (the screenshot)', 'wemail', ['my work email address', 'is', 'okay', 'paul k', 'with life rest.co.za'], 'paulk@liferisk.co.za'],
    ['work, "with" in one line', 'wemail', ['what is your work email address?', 'paul k with liferest dot co dot za'], 'paulk@liferisk.co.za'],
    ['correct address is left alone', 'pemail', ['what is your personal email address?', 'paulk1.kafentzis@gmail.com'], 'paulk1.kafentzis@gmail.com'],
    ['initial + surname is left alone', 'pemail', ['what is your personal email address?', 'pkafentzis@gmail.com'], 'pkafentzis@gmail.com'],
    ['"not" among the pieces does not make it None (the 14:27 log)', 'pemail', ['what is your personal email address?', "it's", 'paul one', 'not defenses', '@gmail.com'], 'paul1notdefenses@gmail.com'],
    ['"I need to correct that" drops what was held', 'pemail', ['what is your personal email address?', 'paul one', 'I need to correct that', 'paul one dot kafentzis at gmail dot com'], 'paul1.kafentzis@gmail.com'],
    ['another person\'s name is left alone', 'pemail', ['what is your personal email address?', 'john.smith@mail.com'], 'john.smith@mail.com'],
    ['a typo in gmail', 'pemail', ['what is your personal email address?', 'paul1.kafentzis@gmal.com'], 'paul1.kafentzis@gmail.com'],
    ['an unknown company domain is left alone', 'wemail', ['what is your work email address?', 'info@acmetools.co.za'], 'info@acmetools.co.za'],
  ];
  let bad = 0;
  for (const [name, box, lines, want] of S) {
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
        else if (/work email address/.test(t)) a = [{ do: 'ask', field: 'wemail' }];
        else if (/\[E1\]/.test(t) && body.position && body.position.field) a = [{ do: 'fill', field: body.position.field, value: '[E1]', correction: true }];
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
    });
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    await p.evaluate(() => { FF.app.state.f.fname.v = 'Paul'; FF.app.state.f.sname.v = 'Kafentzis'; });
    let notes = [];
    for (const l of lines) { const d = await p.evaluate(x => FF.app.voiceHear(x).then(en => en ? en.did : []), l); notes = notes.concat(d || []); await p.waitForTimeout(120); }
    await p.waitForTimeout(200);
    const got = await p.evaluate(id => FF.app.state.f[id].v + ' | ' + FF.app.state.f[id].st, box), val = got.split(' | ')[0], ok = val === want;
    if (!ok || errs.length) bad++;
    console.log((ok && !errs.length ? 'PASS ' : 'FAIL ') + name + ' => ' + got + (ok ? '' : '   (wanted ' + want + ')') + (errs.length ? ' ERR ' + errs.join(';') : '') + (process.argv[4] ? '  ' + JSON.stringify(notes.filter(n => /changed/.test(n))) : ''));
    await p.context().close();
  }
  console.log(bad ? bad + ' failing' : 'all pass');
  await b.close();
})();
