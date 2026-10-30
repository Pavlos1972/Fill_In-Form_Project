const { chromium } = require((process.argv[2]) + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async (script) => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + process.argv[3] + '/index.html');
    await p.evaluate(script => { window.__calls = []; const fn = eval('(' + script + ')'); FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { const body = JSON.parse(u); window.__calls.push(body.newest.text.slice(0, 30)); const r = fn(body); return r === 'fail' ? Promise.reject(new Error('offline')) : Promise.resolve(JSON.stringify({ actions: r })); } }; }, script);
    await p.click('#btnVoice'); await p.evaluate(() => document.querySelector('[data-sec=other]').click()); return p; };
  const say = (p, t) => p.evaluate(t => FF.app.voiceHear(t), t).then(() => p.waitForTimeout(250));
  const st = p => p.evaluate(() => ({ sec: document.querySelector('.main header h2').textContent, noting: !!FF.app.voice.noteMode, btn: document.querySelectorAll('.vm-stopnotes').length, target: FF.app.voice.target, gap: FF.app.state.f.gap.v, note: FF.app.state.f.n_ma.v, calls: window.__calls.length }));
  const startNotes = async p => { await say(p, 'let me take some notes'); await say(p, 'the company pays half'); };

  console.log('1 notes on, then "Do you have any investments?" (Claude ends the notes and moves)');
  let p = await fresh(`b => { if (!/notes now/.test(b.note||'')) return []; return /investments/.test(b.newest.text) ? [{do:'cmd',cmd:'notesOff'},{do:'section',section:'inv'}] : []; }`);
  await startNotes(p); await say(p, 'Do you have any investments?'); console.log('  ', JSON.stringify(await st(p)));

  console.log('2 notes on, then "Gap cover with Stratum" (a fact for another box)');
  p = await fresh(`b => /Gap cover with/.test(b.newest.text) && /notes now/.test(b.note||'') ? [{do:'cmd',cmd:'notesOff'},{do:'fill',field:'gap',value:'Yes'}] : []`);
  await startNotes(p); await say(p, 'Gap cover with Stratum'); console.log('  ', JSON.stringify(await st(p)));

  console.log('3 more to note: no call to Claude');
  p = await fresh(`b => []`); await startNotes(p); const c0 = (await st(p)).calls; await say(p, 'he pays two thousand five hundred a month'); console.log('  ', JSON.stringify(await st(p)), 'calls before', c0);

  console.log('4 a clear question is placed on this computer: no call to Claude');
  p = await fresh(`b => []`); await startNotes(p); const c1 = (await st(p)).calls; await say(p, 'Do you have gap cover?'); console.log('  ', JSON.stringify(await st(p)), 'calls before', c1);

  console.log('5 Claude cannot be reached: nothing breaks, notes stay on');
  p = await fresh(`b => 'fail'`); await startNotes(p); await say(p, 'What about the will?'); console.log('  ', JSON.stringify(await st(p)));

  console.log('6 a question that is part of the notes: Claude writes the note, notes stay on');
  p = await fresh(`b => /notes now/.test(b.note||'') ? [{do:'note',text:'- Pays R2 500 a month for the medical aid'}] : []`);
  await startNotes(p); await say(p, 'How much does he pay for it?'); console.log('  ', JSON.stringify(await st(p)));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
