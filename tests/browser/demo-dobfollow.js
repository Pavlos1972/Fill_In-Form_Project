const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async () => { const c = await b.newContext({ viewport: { width: 1400, height: 1100 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + dir + '/index.html'); return p; };
  const st = p => p.evaluate(() => { const f = FF.app.state.f; return 'id=' + f.idno.v + '[' + f.idno.st + '] dob=' + f.dob.v + '[' + f.dob.st + '] | box shows ' + document.querySelector('[data-f=dob]').value + ' | toast: ' + (document.getElementById('toast').hidden ? '-' : document.getElementById('toast').textContent) + ' | checks: ' + document.getElementById('checks').innerText.replace(/\n/g, ' ').slice(0, 90); });
  const type = async (p, id, v) => { await p.fill('[data-f=' + id + ']', v); await p.dispatchEvent('[data-f=' + id + ']', 'change'); };
  const voice = async p => { await p.evaluate(() => { FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { const n = JSON.parse(u).newest.text; let acts = [];
    if (/born on 5 March/.test(n)) acts = [{ do: 'fill', field: 'dob', value: '1980-03-05' }];
    else if (/ID is \[N1\]/.test(n)) acts = [{ do: 'fill', field: 'idno', value: '[N1]', correction: /sorry/.test(n) }];
    return Promise.resolve(JSON.stringify({ actions: acts })); } }; }); await p.click('#btnVoice'); return t => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(150)); };

  console.log('1 date of birth typed first, then a contrary ID typed');
  let p = await fresh(); await type(p, 'dob', '05/03/1980'); console.log('   dob only :', await st(p));
  await type(p, 'idno', '7212095268086'); console.log('   then ID  :', await st(p));
  console.log('2 ID typed, then changed to another ID: the date changes immediately');
  await type(p, 'idno', '8003155800082'); console.log('   new ID   :', await st(p));
  console.log('3 an incomplete ID leaves the date alone');
  await type(p, 'idno', '80031558'); console.log('   short ID :', await st(p));
  console.log('4 a date typed AFTER the ID is left as typed, and the Checks warn');
  await type(p, 'idno', '7212095268086'); await type(p, 'dob', '01/01/1990'); console.log('   dob after:', await st(p));

  console.log('5 by voice: born 5 March 1980, then the ID, then undo');
  p = await fresh(); let say = await voice(p);
  await say('I was born on 5 March 1980'); console.log('   dob said :', await st(p));
  await say('my ID is 7212095268086'); console.log('   ID said  :', await st(p));
  await say('sorry my ID is 8003155800082'); console.log('   ID fixed :', await st(p));
  await say('scratch that'); console.log('   undo     :', await st(p));

  console.log('6 Passport and back to ID');
  p = await fresh(); await type(p, 'idno', '7212095268086'); await p.selectOption('[data-f=idtype]', 'Passport'); await type(p, 'dob', '05/03/1980'); console.log('   passport :', await st(p));
  await p.selectOption('[data-f=idtype]', 'ID'); console.log('   back: ID :', await st(p));
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
