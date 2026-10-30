const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async (script) => { const c = await b.newContext({ viewport: { width: 1400, height: 1100 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + dir + '/index.html');
    await p.evaluate(script => { window.__calls = []; const fn = eval('(' + script + ')'); FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { const body = JSON.parse(u); window.__calls.push({ sec: body.position.section, note: body.note || null, text: body.newest.text.slice(0, 40), lists: body.lists.length }); return Promise.resolve(JSON.stringify({ actions: fn(body) })); } }; }, script);
    await p.click('#btnVoice'); return p; };
  const say = (p, t) => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(250));
  const show = p => p.evaluate(() => ({ section: document.querySelector('.main header h2').textContent, inv: FF.app.state.l.inv.map(r => JSON.stringify(Object.fromEntries(Object.entries(r.d).filter(([, v]) => v)))), debts: FF.app.state.l.debts.map(r => JSON.stringify(Object.fromEntries(Object.entries(r.d).filter(([, v]) => v)))), kids: FF.app.state.l.kids.map(r => r.d.name + ' ' + r.d.dob), health: ['h_dia', 'h_bp'].map(k => k + '=' + FF.app.state.f[k].v).join(' '), calls: window.__calls.map(c => c.sec + (c.note ? ' +note' : '')).join(' > ') }));
  const PAUL = "I'd like to talk about your investment planning. Do you have any investments in place like a tax free? Yes I do. I have an Old Mutual tax free which I'm contributing R3400 per month towards and I've had it for the last 10 years.";

  console.log('1 Claude does it all in one answer (from Existing cover)');
  let p = await fresh(`b => /tax free/.test(b.newest.text) ? [{do:'section',section:'inv'},{do:'ask',list:'inv',row:'new',col:'type'},{do:'row',list:'inv',values:{type:'Tax-free savings',prov:'Old Mutual',prem:'3400'}}] : []`);
  await p.evaluate(() => document.querySelector('[data-sec=cover]').click()); await say(p, PAUL); console.log('  ', JSON.stringify(await show(p)));

  console.log('2 Claude only moves; the safety net asks again from inside the section');
  p = await fresh(`b => !b.note ? [{do:'section',section:'inv'}] : (/Investments/.test(b.note) && b.position.section === 'inv' ? [{do:'section',section:'inv'},{do:'row',list:'inv',values:{type:'Tax-free savings',prov:'Old Mutual',prem:'3400'}}] : [])`);
  await p.evaluate(() => document.querySelector('[data-sec=cover]').click()); await say(p, PAUL); console.log('  ', JSON.stringify(await show(p)));

  console.log('3 a short move is one call only');
  p = await fresh(`b => [{do:'section',section:'inv'}]`); await say(p, "let's talk about your investments please sir"); console.log('  ', JSON.stringify(await show(p)));

  console.log('4 a long line where Claude did fill something is not asked twice');
  p = await fresh(`b => [{do:'section',section:'health'},{do:'ask',field:'h_dia'},{do:'fill',field:'h_dia',value:'No'},{do:'fill',field:'h_bp',value:'Yes'}]`);
  await say(p, "Now your health. Do you have diabetes? No. High blood pressure? Yes, I'm on tablets for it."); console.log('  ', JSON.stringify(await show(p)));

  console.log('5 debts, children: a move and then rows');
  p = await fresh(`b => /home loan/.test(b.newest.text) ? [{do:'section',section:'debts'},{do:'row',list:'debts',values:{type:'Home loan',prov:'ABSA',inst:'6200',bal:'450000'}}] : [{do:'section',section:'kids'},{do:'row',list:'kids',values:{name:'Thandi',dob:'2019-08-22'}},{do:'row',list:'kids',values:{name:'Sipho',dob:'2021-03-03'}}]`);
  await say(p, "Let's move on to debts. Do you have a home loan? Yes with ABSA, R6200 a month, balance about R450000.");
  await say(p, "Moving on to your children. We have a daughter Thandi born 22 August 2019 and a son Sipho born 3 March 2021.");
  console.log('  ', JSON.stringify(await show(p)));
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
