const { chromium } = require(process.argv[2] + '/playwright');
const dir = process.argv[3], withKey = process.argv[4] === 'key';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  if (withKey) {
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
    await p.reload();
    await p.evaluate(() => { window.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{"actions":[]}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }); });
  }
  await p.click('#btnVoice'); await p.waitForTimeout(300);
  const lines = process.argv.slice(5).length ? process.argv.slice(5) : ["I'd like to let you know that we will be recording this conversation.", 'are you happy for us to go ahead and record that', "yes I'm happy to do that"];
  for (const l of lines) {
    const e = await p.evaluate(x => FF.app.voiceHear(x).then(en => en ? en.did : null), l);
    const v = await p.evaluate(() => ({ target: FF.app.voice.target, consent: FF.app.state.f.consent.v + '|' + FF.app.state.f.consent.st }));
    console.log(JSON.stringify(l), '=>', JSON.stringify(e), JSON.stringify(v));
  }
  console.log('errors', errs);
  await b.close();
})();
