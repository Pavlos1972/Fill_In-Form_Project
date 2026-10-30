const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const nav = sec => p.click('.nav button[data-sec="' + sec + '"]');
  const set = (id, v) => p.evaluate(([id, v]) => FF.store.setField(FF.app.state, id, v), [id, v]);
  const checks = async () => (await p.evaluate(() => { FF.app.redraw(); return document.querySelector('#checks').innerText; }));

  // 1. a blank form asking for quotes: the Checks panel speaks
  for (const [id, v] of [['bf_fna_req', 'Request a quote'], ['fna_req', 'Request a quote'], ['rgar_req', 'Request an RGAR'], ['egar_req', 'Request an EGAR'], ['pr_life', 'Priority: client agrees'], ['pr_rgar', 'Priority: client agrees'], ['pr_egar', 'Priority: client agrees']]) await set(id, v);
  let t = await checks();
  ok(/BrightRock Fractured FNA quote is asked for/.test(t) && /Which insurers/.test(t) && /RGAR is asked for/.test(t) && /EGAR is asked for/.test(t), 'the Checks panel names what the asked-for quotes are missing: ' + t.replace(/\s+/g, ' ').slice(0, 200));
  // clicking a check goes to the box
  await p.click('#checks button:has-text("Which insurers")'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('.nav button.on, .nav button.active, .nav button[aria-current]') && /prio/.test((document.querySelector('.nav button.on, .nav button.active, .nav button[aria-current]') || {}).dataset.sec || '')), 'a check about the standard FNA insurer jumps to Client priorities');

  // 2. hidden boxes are quiet; shown again they speak
  await set('marital', 'Single'); await set('sp_tel', '12'); await set('bizowner', 'No'); await set('biz_pct', '150');
  t = await checks(); ok(!/Spouse telephone|shareholding/i.test(t), 'a hidden spouse phone and shareholding do not warn');
  await set('marital', 'Civil union'); t = await checks(); ok(/Spouse telephone number/.test(t), 'the spouse phone warns once a spouse is asked about');

  // 3. joint life and Buy & Sell are greyed without a spouse / partners
  await set('has_risk', 'Yes'); await set('marital', 'Single'); await p.evaluate(() => FF.app.redraw()); await nav('cover');
  const joint = () => p.evaluate(() => { const e = document.querySelector('[data-f="joint"]'); return e ? { dis: e.disabled, grey: !!e.closest('.f.off, .f.grey, .off, [data-grey]') } : null; });
  let j = await joint(); ok(j && (j.dis || j.grey), 'Joint life with spouse is greyed for a single client: ' + JSON.stringify(j));
  await set('marital', 'Married in community of property'); await p.evaluate(() => FF.app.redraw()); await nav('cover'); j = await joint(); ok(j && !j.dis && !j.grey, 'and open for a married client: ' + JSON.stringify(j));
  await set('bizowner', 'Yes'); await set('biz_partners', 'No'); await p.evaluate(() => FF.app.redraw()); await nav('prio');
  const bs = () => p.evaluate(() => { const e = document.querySelector('[data-f="bs_req"]'); return e ? { dis: e.disabled, grey: !!e.closest('.off, .grey, [data-grey]') } : 'absent'; });
  let x = await bs(); ok(x === 'absent' || x.dis || x.grey, 'Buy & Sell is greyed or away without partners: ' + JSON.stringify(x));
  await set('biz_partners', 'Yes'); await p.evaluate(() => FF.app.redraw()); await nav('prio'); x = await bs(); ok(x !== 'absent' && !x.dis && !x.grey, 'and open with partners: ' + JSON.stringify(x));

  // 4. the protector instalment boxes are named
  await set('net', 'R 40 000.00');
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'debts', { type: 'Home loan', prov: 'Nedbank', inst: 'R 12 000.00' }, 'confirmed'); FF.app.redraw(); }); await nav('calc'); await p.waitForTimeout(200);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.prow input')].map(e => e.getAttribute('aria-label')));
  ok(labels.length === 1 && /Instalment \(R p\.m\.\): Bond repayments \(Nedbank\)/.test(labels[0]), 'the instalment box has a name: ' + JSON.stringify(labels));

  // 5. an amount typed with a dot as thousands separator is read as thousands
  await nav('income'); await p.fill('[data-f="gross"]', 'R1.000,00'); await p.press('[data-f="gross"]', 'Tab'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('[data-f="gross"]').value) === 'R 1 000.00', 'R1.000,00 becomes R 1 000.00');
  await p.fill('[data-f="exp"]', 'lots'); await p.press('[data-f="exp"]', 'Tab'); await p.waitForTimeout(200);
  ok(/not an amount/.test(await p.evaluate(() => document.querySelector('#checks').innerText)), 'words in an amount box are flagged in the Checks panel');

  // 6. consent: Voice says so when the client has not agreed
  await set('consent', ''); await p.click('#btnVoice'); await p.waitForTimeout(300);
  const toast = await p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  ok(/Consent to record and transcribe is not answered/.test(toast), 'Voice on without consent: ' + toast);
  await p.click('#btnVoice'); await set('consent', 'Yes'); await p.evaluate(() => { document.querySelector('#toast').hidden = true; }); await p.click('#btnVoice'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#toast').hidden), 'no notice when consent is Yes');
  await p.click('#btnVoice');

  // 7. voice: a bare yes/no on a quote request, and the nationality
  await set('consent', 'Yes'); await set('bf_fna_req', ''); await p.click('#btnVoice'); await nav('prio');
  await p.evaluate(() => FF.app.voiceHear('do you want an fna quote?')); await p.waitForTimeout(400);
  await p.evaluate(() => FF.app.voiceHear('yes please')); await p.waitForTimeout(800);
  const fna = await p.evaluate(() => ['bf_fna_req', 'fna_req'].map(id => FF.app.state.f[id].v));
  console.log('INFO after yes please:', JSON.stringify(fna));
  await p.click('#btnVoice');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await p.screenshot({ path: shots + '/batcha.png' }).catch(() => {});
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
