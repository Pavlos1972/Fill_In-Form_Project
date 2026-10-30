const { chromium } = require((process.argv[2]) + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = []; const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[3] + '/index.html');
  await p.evaluate(() => { FF.voiceBackend = { available: false }; }); await p.click('#btnVoice'); await p.evaluate(() => document.querySelector('[data-sec=other]').click());
  const say = t => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(200));
  const st = () => p.evaluate(() => ({ noting: !!FF.app.voice.noteMode, btn: document.querySelectorAll('.vm-stopnotes').length, target: FF.app.voice.target, notes: FF.app.state.f.n_ma.v }));
  await say('what medical aid do you have?'); console.log('asked:', JSON.stringify(await st()));
  await say('let me take some notes'); console.log('notes on:', JSON.stringify(await st()));
  await say('the company pays half'); await say("Okay, let's move on."); console.log("after let's move on:", JSON.stringify(await st()));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
