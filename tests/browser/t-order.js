const { chromium } = require(process.argv[2] + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[3] + '/index.html');
  const nav = await p.evaluate(() => [...document.querySelectorAll('#nav button')].map(b => b.firstChild.textContent + ' ' + b.querySelector('.n').textContent));
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const seen = [];
  for (const l of ['next section', 'next section']) { await p.evaluate(x => FF.app.voiceHear(x), l); await p.waitForTimeout(150); seen.push(await p.evaluate(() => document.querySelector('#nav button[aria-current]').firstChild.textContent)); }
  const pdf = await p.evaluate(() => { const d = FF.app.makePdf(); return d.getNumberOfPages(); });
  console.log(JSON.stringify({ nav: nav.slice(0, 5), afterTwoNext: seen, pdfPages: pdf, errs }));
  await b.close();
})();
