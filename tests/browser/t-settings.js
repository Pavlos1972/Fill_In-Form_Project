const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const draft = () => p.evaluate(() => ({ json: localStorage.getItem('wr-fact-find-draft'), dirty: localStorage.getItem('wr-fact-find-draft-dirty') }));
  const typeName = async n => { await p.fill('[data-f="fname"]', n); await p.press('[data-f="fname"]', 'Tab'); await p.waitForTimeout(200); };
  // a fake place to save to: a file handle that keeps what is written in memory
  const fakePicker = mode => p.evaluate(mode => {
    window.__file = { text: '' };
    const handle = { name: 'Thandi.json', requestPermission: () => Promise.resolve('granted'),
      createWritable: () => Promise.resolve({ write: blob => blob.text().then(t => { window.__file.pending = t; }), close: () => { window.__file.text = window.__file.pending; return Promise.resolve(); } }),
      getFile: () => mode === 'different' ? Promise.resolve({ text: () => Promise.resolve(window.__file.text + ' ') }) : mode === 'unreadable' ? Promise.reject(new Error('no')) : Promise.resolve({ text: () => Promise.resolve(window.__file.text) }) };
    window.showSaveFilePicker = () => Promise.resolve(handle);
  }, mode);

  // 1. work that is not saved is in the browser's draft
  await typeName('Thandi');
  let d = await draft(); ok(d.dirty === '1' && /Thandi/.test(d.json || ''), 'unsaved work is kept as a draft in the browser');

  // 2. a save that is read back and matches clears the draft, and the file holds the work
  await fakePicker('same'); await p.click('#btnSave'); await p.waitForTimeout(600);
  d = await draft(); ok(d.json === null && d.dirty === '0', 'after a verified save the draft (and the client\'s details) are gone from the browser: ' + JSON.stringify({ json: d.json && d.json.slice(0, 20), dirty: d.dirty }));
  ok(await p.evaluate(() => /Thandi/.test(window.__file.text)), 'the saved file holds the client\'s details');
  ok(await p.evaluate(() => FF.app.state.f.fname.v === 'Thandi'), 'the form on the screen is untouched');
  // 3. more typing makes a draft again
  await typeName('Thandi Z'); d = await draft(); ok(d.dirty === '1' && /Thandi Z/.test(d.json || ''), 'typing again keeps a draft again');

  // 4. a save whose file does not match: the draft stays, and the form says so
  await fakePicker('different'); await p.click('#btnSaveAs'); await p.waitForTimeout(600);                                   // Save as: a new file, so the (fake) picker is asked
  d = await draft(); ok(d.dirty === '1' && /Thandi Z/.test(d.json || ''), 'if the saved file does not match, the draft stays');
  ok(/does not match the form/.test(await p.evaluate(() => document.querySelector('#toast').textContent)), 'and the adviser is told');
  // 5. a file that cannot be read back: saved, but the draft stays (nothing was checked)
  await fakePicker('unreadable'); await p.click('#btnSaveAs'); await p.waitForTimeout(600);
  d = await draft(); ok(/Thandi Z/.test(d.json || ''), 'if the file cannot be checked, the draft stays');
  // 6. a plain download (a browser with no save window): the draft stays too
  await p.evaluate(() => { window.showSaveFilePicker = undefined; }); await typeName('Thandi Zulu');
  const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await p.click('#btnSave'); await dl; await p.waitForTimeout(400);
  d = await draft(); ok(/Thandi Zulu/.test(d.json || ''), 'after a plain download the draft stays (the download cannot be checked)');

  // 7. New: nothing is left; and after a verified save a reload offers nothing back
  await fakePicker('same'); await typeName('Sipho'); await p.click('#btnSaveAs'); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('restoreDraft') && FF.app.state.f.fname.v === ''), 'after a verified save, reopening the page offers nothing back and shows a blank form');
  d = await draft(); ok(d.json === null, 'and nothing of the client is left in the browser');

  // 8. two keys, two labels, two dates
  await p.evaluate(() => { const t = new Date(), add = n => { const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    FF.lookup.saveSettings({ apiKey: 'sk-ant-test', expires: add(27), openaiKey: 'sk-test', openaiExpires: add(9), voiceModel: 'claude-sonnet-5-5', model: 'claude-sonnet-5-5', openaiModel: 'gpt-4o-transcribe' }); FF.app.redraw(); });
  const chips = await p.evaluate(() => ['#keyState', '#keyState2'].map(s => { const e = document.querySelector(s); return { text: e.textContent, hidden: e.hidden, color: e.style.color }; }));
  ok(chips[0].text === 'Anthropic key: 27 days left' && !chips[0].hidden && chips[1].text === 'OpenAI key: 9 days left' && /warn/.test(chips[1].color), 'the top bar shows each key with its own label and days: ' + JSON.stringify(chips));
  await p.click('#btnSettings'); await p.waitForTimeout(250);
  const labels = await p.evaluate(() => ['setExpires', 'setOpenaiExpires', 'setOpenaiPrice'].map(id => { const e = document.getElementById(id); return e && e.closest('label').innerText.trim().split('\n')[0]; }));
  ok(labels.join('|') === 'Anthropic key expires on|OpenAI key expires on|OpenAI speech price (US$ per minute)', 'Settings has both expiry dates, each labelled: ' + labels.join(' | '));
  ok(await p.evaluate(() => document.getElementById('setExpires').value !== '' && document.getElementById('setOpenaiExpires').value !== ''), 'both dates are filled in from what was saved');
  await p.click('#setForget'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById('setExpires').value === '' && document.getElementById('setOpenaiExpires').value === '' && document.querySelector('#keyState').hidden && document.querySelector('#keyState2').hidden), 'Remove saved keys clears both dates and both chips');
  await p.click('#setCancel');

  // 9. the OpenAI speech cost
  await p.evaluate(() => { FF.lookup.saveSettings({ apiKey: '', openaiKey: 'sk-test', openaiModel: 'gpt-4o-transcribe', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }); FF.app.redraw(); FF.app.spendSpeech(60, 'gpt-4o-transcribe'); FF.app.spendSpeech(30, 'gpt-4o-transcribe'); });
  const cost = await p.evaluate(() => { const e = document.querySelector('#speechCostState'); return { text: e.textContent, hidden: e.hidden, title: e.title, claudeHidden: document.querySelector('#costState').hidden }; });
  ok(!cost.hidden && cost.text === 'OpenAI: US$0.0090 this fact find' && /2 spoken lines/.test(cost.title) && /1\.5 minutes/.test(cost.title), 'the OpenAI speech cost is shown, apart from Claude\'s: ' + cost.text + ' | ' + cost.title.slice(0, 70));
  await p.evaluate(() => { FF.lookup.saveSettings({ apiKey: '', openaiKey: 'sk-test', openaiModel: 'gpt-4o-transcribe', openaiPrice: '0.01', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }); FF.app.spendSpeech(60, 'gpt-4o-transcribe'); });
  ok((await p.evaluate(() => document.querySelector('#speechCostState').textContent)) === 'OpenAI: US$0.019 this fact find', 'a price typed in Settings is used for the next lines');
  const back = await p.evaluate(() => { const s = FF.store.fromJSON(FF.store.toJSON(FF.app.state)); return s.openai; });
  ok(back.calls === 3 && Math.round(back.seconds) === 150, 'the cost is saved with the Fact Find: ' + JSON.stringify(back));
  await p.evaluate(() => { FF.lookup.saveSettings({ apiKey: '', openaiKey: '', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }); FF.app.setState(FF.store.blank()); });
  ok(await p.evaluate(() => document.querySelector('#speechCostState').hidden), 'with no OpenAI key and no spending, the chip is not shown');

  // the top bar still fits at a working width
  await p.evaluate(() => { FF.lookup.saveSettings({ apiKey: 'sk-ant-test', expires: '2027-01-01', openaiKey: 'sk-test', openaiExpires: '2027-01-01', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }); FF.app.setState(Object.assign(FF.store.blank(), { openai: { usd: 0.0123, seconds: 120, calls: 4 }, claude: Object.assign(FF.store.blankTally(), { usd: 0.05, calls: 3 }) })); });
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no sideways scrolling with all four chips at 1280 wide');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
