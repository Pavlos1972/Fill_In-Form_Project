const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async (script, sec) => { const c = await b.newContext({ viewport: { width: 1400, height: 1100 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + dir + '/index.html');
    if (script) await p.evaluate(script => { window.__calls = []; const fn = eval('(' + script + ')'); FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { const body = JSON.parse(u); window.__calls.push((body.note ? 'note:' : '') + body.position.section); return Promise.resolve(JSON.stringify({ actions: fn(body) })); } }; }, script);
    if (sec) await p.evaluate(s => document.querySelector('[data-sec=' + s + ']').click(), sec);
    await p.click('#btnVoice'); return p; };
  const say = (p, t) => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(250));
  const show = p => p.evaluate(() => ({ section: document.querySelector('.main header h2').textContent, notes: { n_inv: FF.app.state.f.n_inv.v, h_notes: FF.app.state.f.h_notes.v, n_ma: FF.app.state.f.n_ma.v }, mode: !!FF.app.voice.noteMode, calls: (window.__calls || []).join(' > ') }));
  const LINE = "I wanted to make a couple of notes regarding the clients Old Mutual tax-free investment. The client told me that the Old Mutual tax-free investment was for his son's education when he turns 18 for his university fees.";

  console.log('1 Claude gives the notes command and the points together');
  let p = await fresh(`b => [{do:'cmd',cmd:'notes'},{do:'note',text:"- Old Mutual tax free: for his son's university fees\\n- To be used when the son turns 18"}]`, 'inv');
  await say(p, LINE); console.log('  ', JSON.stringify(await show(p)));
  await say(p, 'and he said he would like to add to it next year'); console.log('   next line noted locally:', JSON.stringify((await show(p)).notes.n_inv));
  await say(p, "that's all for the notes"); console.log('   notes off:', (await show(p)).mode);

  console.log('2 Claude only switches the notes on: the page asks again for the points');
  p = await fresh(`b => !b.note ? [{do:'cmd',cmd:'notes'}] : [{do:'cmd',cmd:'notes'},{do:'note',text:"- Old Mutual tax free: for his son's university fees"}]`, 'inv');
  await say(p, LINE); console.log('  ', JSON.stringify(await show(p)));

  console.log('3 a note with no notes command before it starts the notes itself');
  p = await fresh(`b => [{do:'note',text:'- Thinking of downgrading next year'}]`, 'other');
  await say(p, 'He has a medical aid, make a note that he is thinking of downgrading next year'); console.log('  ', JSON.stringify(await show(p)));

  console.log('4 a section move, then notes, then the points');
  p = await fresh(`b => [{do:'section',section:'health'},{do:'cmd',cmd:'notes'},{do:'note',text:'- On tablets for blood pressure\\n- Father had a heart attack at 55'}]`, 'inv');
  await say(p, "Let's go to health. I want to note that he's on tablets for blood pressure and his father had a heart attack at 55."); console.log('  ', JSON.stringify(await show(p)));

  console.log('5 no Claude at all: this computer reads the same line');
  p = await fresh(null, 'inv'); await say(p, LINE); console.log('  ', JSON.stringify(await show(p)));

  console.log('6 a short "let me take some notes" is one command, and "note that down" takes the line before');
  p = await fresh(`b => []`, 'inv'); await say(p, 'let me take some notes'); console.log('  ', JSON.stringify(await show(p)));
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
