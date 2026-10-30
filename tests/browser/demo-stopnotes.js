const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async () => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + dir + '/index.html');
    await p.evaluate(() => { FF.voiceBackend = { available: false }; }); await p.click('#btnVoice'); await p.evaluate(() => document.querySelector('[data-sec=other]').click()); return p; };
  const say = (p, t) => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(200));
  const st = p => p.evaluate(() => ({ noting: !!FF.app.voice.noteMode, btn: document.querySelectorAll('.vm-stopnotes').length, notes: FF.app.state.f.n_ma ? FF.app.state.f.n_ma.v : null }));

  let p = await fresh();
  await say(p, 'let me take some notes about the medical aid');
  console.log('1 notes on:', JSON.stringify(await st(p)));
  await say(p, 'he pays half and the company pays half');
  console.log('2 a note:', JSON.stringify(await st(p)));
  await p.screenshot({ path: out + '/stopnotes-on.png' });
  await p.click('.vm-stopnotes'); await p.waitForTimeout(200);
  console.log('3 after tapping the button:', JSON.stringify(await st(p)), 'toast:', await p.textContent('#toast'));
  await p.screenshot({ path: out + '/stopnotes-off.png' });
  for (const phrase of ["Okay, that's all for the notes.", "let's end the notes", "I'm done with the notes", 'stop taking notes']) {
    await say(p, 'let me take some notes'); const on = (await st(p)).noting; await say(p, 'something he said'); await say(p, phrase);
    console.log('4 ' + JSON.stringify(phrase) + ': on=' + on + ' -> ' + JSON.stringify(await st(p)));
  }
  console.log('5 voice off clears the button:'); await p.click('#btnVoice'); console.log('  ', JSON.stringify(await st(p)));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
