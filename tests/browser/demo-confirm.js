const { chromium } = require((process.argv[2] || require('child_process').execSync('npm root -g').toString().trim()) + '/playwright');
const dir = process.argv[3] || '/home/user/Fill_In-Form_Project/app';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  let p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  const chip = id => p.evaluate(id => { const e = document.querySelector('[data-len="' + id + '"]'); return e.hidden ? '(hidden)' : e.textContent + ' [' + e.className.replace('len', '').trim() + ']'; }, id);
  console.log('--- 1 length indicator');
  console.log('empty        :', await chip('idno'), '|', await chip('tax'));
  await p.click('[data-f=idno]', { position: { x: 15, y: 20 } }); await p.keyboard.type('72120');
  console.log('typing 72120 :', await chip('idno'));
  await p.keyboard.type('95268086'); console.log('13 valid     :', await chip('idno'));
  await p.keyboard.press('Backspace'); await p.keyboard.type('7'); console.log('bad check    :', await chip('idno'));
  await p.keyboard.type('0'); console.log('14 digits    :', await chip('idno'));
  await p.click('[data-f=tax]', { position: { x: 15, y: 20 } }); await p.keyboard.type('554-7259'); console.log('tax 7        :', await chip('tax'));
  await p.keyboard.type('123'); console.log('tax 10       :', await chip('tax'));
  await p.keyboard.type('4'); console.log('tax 11       :', await chip('tax'));
  await p.dispatchEvent('[data-f=tax]', 'change');
  console.log('checks panel :', (await p.innerText('#checks')).replace(/\n/g, ' | '));
  await p.screenshot({ path: 'demo-confirm-len.png', clip: { x: 0, y: 0, width: 1400, height: 700 } });
  await p.selectOption('[data-f=idtype]', 'Passport'); console.log('passport     :', await chip('idno'));
  await p.selectOption('[data-f=idtype]', 'ID'); console.log('back to ID   :', await chip('idno'));

  console.log('--- 2 click verify to confirm');
  await p.close(); const ctx2 = await b.newContext({ viewport: { width: 1400, height: 1100 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('file://' + dir + '/index.html'); const pp = p; p = p2;
  await p.evaluate(() => { window.__reqs = []; FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => {
    const body = JSON.parse(u); window.__reqs.push(body); const n = body.newest.text; let acts = [];
    if (/My name is John Snow and my ID is \[N1\]/.test(n)) acts = [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'fill', field: 'sname', value: 'Snow' }, { do: 'fill', field: 'idno', value: '[N1]' }];
    else if (/^So that's John Snow/.test(n)) acts = [{ do: 'confirm', field: 'fname' }, { do: 'confirm', field: 'sname' }, { do: 'confirm', field: 'idno' }];
    else if (/cell is \[N1\]/.test(n)) acts = [{ do: 'fill', field: 'cell', value: '[N1]' }];
    else if (n === 'yes' && body.awaiting_confirmation.some(a => a.id === 'cell')) acts = [{ do: 'confirm', field: 'cell' }];
    else if (/daughter Thandi/.test(n)) acts = [{ do: 'row', list: 'kids', values: { name: 'Thandi Snow', dob: '2019-08-22' } }];
    else if (n === 'yes' && body.awaiting_confirmation.some(a => a.list === 'kids')) acts = [{ do: 'confirm', list: 'kids', row: 1 }];
    return Promise.resolve(JSON.stringify({ actions: acts }));
  } }; });
  await p.click('#btnVoice');
  const say = t => p.evaluate(t => FF.app.voiceHear(t), t);
  const st = () => p.evaluate(() => { const f = FF.app.state.f; return ['fname', 'sname', 'idno', 'cell'].map(k => k + '=' + f[k].st).join(' '); });
  await say('My name is John Snow and my ID is 7212095268086'); await p.waitForTimeout(150);
  console.log('after fill   :', await st());
  console.log('badge title  :', await p.evaluate(() => document.querySelector('[data-field=idno] .badge').title), '| text:', await p.evaluate(() => document.querySelector('[data-field=idno] .badge').textContent));
  await p.click('[data-field=idno] .badge'); await p.waitForTimeout(100);
  console.log('clicked idno :', await st());

  console.log('--- 3 the client says yes');
  await say('my cell is 083 454 1751'); await p.waitForTimeout(150);
  console.log('cell filled  :', await st());
  await say("So that's John Snow, ID 7212095268086, right? Yes."); await p.waitForTimeout(150);
  console.log('read back    :', await st());
  await say('yes'); await p.waitForTimeout(150);
  const last = await p.evaluate(() => window.__reqs[window.__reqs.length - 1]);
  console.log('bare yes     :', await st(), '| awaiting sent:', JSON.stringify(last.awaiting_confirmation), '| digits leaked:', await p.evaluate(() => window.__reqs.some(r => /7212095268086|0834541751|083 454/.test(JSON.stringify(r)))));
  await p.screenshot({ path: 'demo-confirm-yes.png', clip: { x: 0, y: 0, width: 1400, height: 760 } });
  await say('scratch that'); await p.waitForTimeout(100);
  console.log('undo         :', await st());

  console.log('--- 4 a row of a list');
  await say('we have a daughter Thandi born 22 August 2019'); await p.waitForTimeout(200);
  console.log('row added    :', await p.evaluate(() => FF.app.state.l.kids.map(r => r.d.name + ' ' + r.st).join(',') + ' (section ' + document.querySelector('.main header h2').textContent + ')'));
  await say('yes'); await p.waitForTimeout(200);
  console.log('yes -> row   :', await p.evaluate(() => FF.app.state.l.kids.map(r => r.d.name + ' ' + r.st).join(',')));
  await say('scratch that'); await p.waitForTimeout(100);
  console.log('undo row     :', await p.evaluate(() => FF.app.state.l.kids.map(r => r.d.name + ' ' + r.st).join(',')));

  console.log('--- 5 no Claude: this computer confirms the box being asked about');
  await p.evaluate(() => { FF.voiceBackend = null; });
  await p.evaluate(() => { const s = FF.app.state; s.f.fname = { v: 'Pieter', st: 'heard' }; FF.app.redraw(); });
  await p.click('#btnVoice'); await p.click('#btnVoice');   // off, on
  await p.evaluate(() => FF.app.voiceHear('what is your first name'));
  await p.evaluate(() => FF.app.voiceHear('yes'));
  console.log('offline yes  :', await p.evaluate(() => FF.app.state.f.fname.st));
  console.log('errors:', errs.join('|') || 'none');
  await b.close();
})();
