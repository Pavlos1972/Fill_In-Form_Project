const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const fresh = async () => { const c = await b.newContext({ viewport: { width: 1400, height: 1100 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + dir + '/index.html'); return p; };
  const errs = [];
  const st = p => p.evaluate(() => { const f = FF.app.state.f; return 'idno=' + f.idno.st + ' dob=' + f.dob.v + '[' + f.dob.st + '] counts=' + document.getElementById('sVerify').textContent + ' to verify'; });
  const voice = async p => { await p.evaluate(() => { window.__reqs = []; FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { const body = JSON.parse(u), n = body.newest.text; let acts = [];
    if (/my ID is \[N1\]/.test(n)) acts = [{ do: 'fill', field: 'idno', value: '[N1]' }];
    else if (/is that right/.test(n)) acts = [{ do: 'confirm', field: 'idno' }];
    else if (/born on 5 March/.test(n)) acts = [{ do: 'fill', field: 'dob', value: '1980-03-05' }];
    return Promise.resolve(JSON.stringify({ actions: acts })); } }; }); await p.click('#btnVoice'); return t => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(150)); };

  console.log('1 typed ID (typed counts as confirmed)');
  let p = await fresh(); await p.click('[data-f=idno]', { position: { x: 15, y: 20 } }); await p.keyboard.type('7212095268086'); await p.dispatchEvent('[data-f=idno]', 'change');
  console.log('  ', await st(p));

  console.log('2 said by voice (amber), then click the ID tag');
  p = await fresh(); let say = await voice(p); await say('my ID is 7212095268086');
  console.log('   said:   ', await st(p));
  await p.click('[data-field=idno] .badge');
  console.log('   clicked:', await st(p));

  console.log('3 said by voice, then the client agrees to the read-back');
  p = await fresh(); say = await voice(p); await say('my ID is 7212095268086');
  console.log('   said:   ', await st(p));
  await say('so your ID is 7212095268086, is that right? yes');
  console.log('   agreed: ', await st(p));
  await say('scratch that');
  console.log('   undo:   ', await st(p));

  console.log('4 a date of birth that is NOT the one in the ID stays as it is');
  p = await fresh(); say = await voice(p); await say('I was born on 5 March 1980'); await say('my ID is 7212095268086');
  console.log('   said:   ', await st(p));
  await p.click('[data-field=idno] .badge');
  console.log('   clicked:', await st(p), '(a different date typed or said is left alone)');

  console.log('5 ID corrected after it was confirmed: the date follows, with the ID new status');
  p = await fresh(); await p.click('[data-f=idno]', { position: { x: 15, y: 20 } }); await p.keyboard.type('7212095268086'); await p.dispatchEvent('[data-f=idno]', 'change');
  await p.fill('[data-f=idno]', '8003155800082'); await p.dispatchEvent('[data-f=idno]', 'change');
  console.log('  ', await st(p));
  console.log('6 passport: nothing derived');
  p = await fresh(); await p.selectOption('[data-f=idtype]', 'Passport'); await p.fill('[data-f=idno]', 'A1234567'); await p.dispatchEvent('[data-f=idno]', 'change');
  console.log('  ', await st(p));
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
