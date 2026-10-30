const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); localStorage.setItem('wr-fact-find-quick', '1'); });
  await p.reload();
  /* a stand-in that answers like a sensible reader: it checks the plumbing (what Claude is sent), not Claude's own judgement */
  await p.evaluate(() => {
    window.__sent = [];
    window.fetch = (url, init) => {
      const req = JSON.parse(init.body); if (req.max_tokens === 0) return Promise.resolve(new Response('{"content":[],"usage":{}}', { status: 200 }));
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text;
      window.__sent.push({ newest: t, recent: (body.recent || []).map(r => r.text), field: body.position.field, sname: (body.filled || {}).sname });
      let acts = [];
      if (/what is your surname/i.test(t)) acts = [{ do: 'ask', field: 'sname' }];
      else if (/spelled/i.test(t)) acts = [{ do: 'wait' }];
      else if (/^kafentzis$/i.test(t)) acts = [{ do: 'fill', field: 'sname', value: 'Kafentzis', correction: true }];
      return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: acts }) }], usage: {} }), { status: 200 })), 200));
    };
  });
  await p.click('#btnVoice'); await p.waitForTimeout(300);
  const say = async t => { await p.evaluate(x => FF.app.voiceHear(x), t); await p.waitForTimeout(700); };
  const sname = () => p.evaluate(() => FF.app.state.f.sname.v + ' [' + FF.app.state.f.sname.st + ']');
  const rows = () => p.evaluate(() => Array.from(document.querySelectorAll('#cvBox .cv-row')).map(r => r.querySelector('.cv-text').textContent + '  ->  ' + r.querySelector('.cv-did').textContent));
  for (const mode of ['1', '']) {
    await p.evaluate(m => { if (m) localStorage.setItem('wr-fact-find-quick-2', '1'); else localStorage.removeItem('wr-fact-find-quick-2'); FF.app.setState(FF.store ? FF.store.blank() : FF.app.state); }, mode);
    console.log(mode ? 'quick fill ON (an old habit, still possible)' : 'DEFAULT: quick fill off, Claude reads every line');
    await say('what is your surname please');
    await say('and my surname is spelled');
    console.log('   after "my surname is spelled": surname =', JSON.stringify(await sname()));
    await say('Kafentzis');
    console.log('   after "Kafentzis":             surname =', JSON.stringify(await sname()));
    (await rows()).slice(-3).forEach(r => console.log('     ' + r));
  }
  const sent = await p.evaluate(() => window.__sent);
  console.log('what Claude was sent for the one-word line:', JSON.stringify(sent.filter(s => s.newest === 'Kafentzis')[0]));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
