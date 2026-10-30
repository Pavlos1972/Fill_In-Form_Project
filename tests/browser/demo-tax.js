const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { window.__sent = []; FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => {
    window.__sent.push(u);
    const body = JSON.parse(u), n = body.newest.text;
    const acts = [];
    if (/ID number is \[N1\]/.test(n)) acts.push({ do: 'fill', field: 'idno', value: '[N1]' }, { do: 'fill', field: 'tax', value: '[N2]' });
    return Promise.resolve(JSON.stringify({ kind: 'actions', actions: acts }));
  } }; });
  await p.click('#btnVoice');
  await p.evaluate(() => FF.app.voiceHear('Can you tell me what your ID number is and your tax number? Yeah sure no problem. My ID number is 721209-5268086 and my tax number is 554-7259.'));
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const f = FF.app.state.f; return { id: f.idno.v, idst: f.idno.st, tax: f.tax.v, taxst: f.tax.st, dob: f.dob.v, age: document.querySelector('[data-f=age]') ? document.querySelector('[data-f=age]').value : null, sentCount: window.__sent.length, leaked: window.__sent.some(s => /7212095268086|721209|5268086|554|7259/.test(s)), sent: window.__sent.map(s => JSON.parse(s).newest.text) }; });
  console.log(JSON.stringify(r, null, 1));
  await p.screenshot({ path: 'demo-tax.png' });
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
