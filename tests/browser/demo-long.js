const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
  await p.reload();
  await p.evaluate(() => {
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ content: [{ type: 'text', text: '{"actions":[]}' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  await p.click('#btnVoice'); await p.waitForTimeout(300);
  for (let i = 1; i <= 260; i++) await p.evaluate(x => FF.app.voiceHear(x), 'line number ' + i);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ box: document.querySelectorAll('#cvBox .cv-row').length, log: FF.app.voiceLog().lines.length, first: FF.app.voiceLog().lines[0].heard, last: FF.app.voiceLog().lines.slice(-1)[0].heard }));
  console.log(JSON.stringify(r), 'errors', JSON.stringify(errs));
  await b.close();
})();
