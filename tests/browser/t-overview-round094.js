/* The Client Overview Studio 0.94 on the real page (Paul, 23 November: "I need to be able to click on to check and waiting and it should take me there"): the Progress panel's "to check" and "waiting" are buttons; a click goes to the next such
   row (the page of its block, the folded quote or policy that holds it opened, the row flashing, in view), says which it is and how many there are, the next click goes on, after the last it starts again, Enter does the same, and with nothing
   to go to it says so. Invented client ("Test, Dora"). Screenshot (deviceScaleFactor 2): r5-click. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('10/11/2026'), will: v('Yes'), will_where: v('Other provider'), will_broker: v('Other broker') },
  l: { kids: [], debts: [{ d: { type: 'Home loan', prov: 'Test Bank A', desc: 'Home loan', inst: 'R 9 000.00', bal: 'R 900 000.00', term: '60' } }], risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }] } };
const LINES = [{ type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 }, { type: 'death', life: { lump: 300000 }, abi: 5 }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank A', life: { lump: 900000, monthly: 9000 }, abi: 5 }];
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(600);
  await p.evaluate(({ ff, lines }) => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    const q1 = OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000081', date: '19/11/2026', premium: 5000, lines }, 'q1.pdf').quote;
    const q2 = OV.docs.applyQuote(s, 'reduced', { insurer: 'BrightRock', number: '100000083', date: '19/11/2026', premium: 3000, lines: lines.slice(0, 2) }, 'q2.pdf').quote;
    q1.st = 'verify'; q1.lines[0].st = 'confirmed'; q1.lines[1].st = 'verify'; q1.lines[2].st = 'empty'; q2.st = 'verify'; q2.lines[0].st = 'verify'; q2.lines[1].st = 'empty';
    OV.app.setState(s);
  }, { ff: FFJ, lines: LINES });
  await p.waitForTimeout(400);

  const info = () => p.evaluate(() => {
    const c = OV.store.counts(OV.app.state), toast = document.querySelector('#toast');
    return { shown: { check: +document.querySelector('#sVerify').textContent, waiting: +document.querySelector('#sEmpty').textContent }, c,
      chk: OV.store.pendingRows(OV.app.state, 'check').map(r => r.path), wt: OV.store.pendingRows(OV.app.state, 'waiting').map(r => r.path), toast: toast && !toast.hidden ? toast.textContent : '' };
  });
  const where = path => p.evaluate(pth => {
    const el = document.querySelector('[data-row="' + pth + '"]'), r = el && el.getBoundingClientRect(), card = el && el.closest('.qcard');
    return { found: !!el, flash: !!el && el.classList.contains('flash'), inView: !!r && r.bottom > 0 && r.top < innerHeight, folded: !!card && card.classList.contains('folded'), h2: (document.querySelector('#main header h2') || {}).textContent };
  }, path);

  const i0 = await info();
  ok(i0.shown.check === i0.c.check && i0.shown.waiting === i0.c.waiting && i0.chk.length === i0.c.check && i0.wt.length === i0.c.waiting && i0.chk.length >= 4 && i0.wt.length >= 2, '1. the panel shows ' + i0.shown.check + ' to check and ' + i0.shown.waiting + ' waiting, and the page can go to every one of them');
  const roles = await p.evaluate(() => ['#sVerifyBox', '#sEmptyBox'].map(s => { const e = document.querySelector(s); return e && e.getAttribute('role') === 'button' && e.tabIndex === 0 && getComputedStyle(e).cursor === 'pointer'; }));
  ok(roles[0] && roles[1], '2. "to check" and "waiting" are buttons (role, keyboard stop, pointer); "checked" is not: ' + (await p.evaluate(() => getComputedStyle(document.querySelector('#sFilled').parentElement).cursor)));

  /* ---- "to check": every row once, then round again ---- */
  const seen = [];
  for (let n = 0; n < i0.chk.length; n++) {
    await p.click('#sVerifyBox'); await p.waitForTimeout(120);
    const w = await where(i0.chk[n]), t = (await info()).toast;
    seen.push(i0.chk[n]);
    ok(w.found && w.flash && w.inView && !w.folded && new RegExp('^To check: .+ \\(' + (n + 1) + ' of ' + i0.chk.length + '\\)$').test(t), '3.' + (n + 1) + ' "to check" goes to ' + i0.chk[n] + ': page "' + w.h2 + '", the row is there, flashing, in view, nothing folded; the toast says "' + t + '"');
  }
  await p.click('#sVerifyBox'); await p.waitForTimeout(120);
  ok(new RegExp('\\(1 of ' + i0.chk.length + '\\)$').test((await info()).toast) && (await where(i0.chk[0])).found, '4. after the last one the next click starts again at the first');
  ok(await p.evaluate(() => !OV.app.isOpen(OV.app.state.blocks.policies.items[0].id) && !document.querySelector('#main .qcard')), '4. a current policy\'s own row is shown without opening its detail (it stays closed)');
  await p.screenshot({ path: out + '/r5-click.png' });

  /* ---- "waiting" ---- */
  await p.click('#sEmptyBox'); await p.waitForTimeout(120);
  const w1 = await where(i0.wt[0]), t1 = (await info()).toast;
  ok(w1.found && w1.flash && w1.inView && /^Waiting: .+ \(1 of \d+\)$/.test(t1), '5. "waiting" goes to the first waiting row (' + i0.wt[0] + '): "' + t1 + '"');
  await p.click('#sEmptyBox'); await p.waitForTimeout(120);
  const t2 = (await info()).toast; ok(/\(2 of \d+\)$/.test(t2) && (await where(i0.wt[1])).found, '6. and the next click goes on to the second: "' + t2 + '"');

  /* ---- a folded quote is opened for its line ---- */
  const folded = await p.evaluate(() => { OV.app.openAll(false); OV.app.go('fna'); const c = document.querySelector('#main .qcard'); return !!c && c.classList.contains('folded'); });
  ok(folded, '7. (set-up) the quote on the FNA page is folded');
  const target = i0.chk.find(x => /^blocks\.fna\.quotes\.0\.lines\./.test(x));
  await p.evaluate(() => { OV.app.go('policies'); });
  await p.evaluate(pth => { OV.app.redraw(); }, target); // fresh page; the click below must open the folded quote itself
  await p.evaluate(() => { document.querySelector('#sVerifyBox').click(); });
  for (let n = 0; n < 12 && !(await where(target)).flash; n++) { await p.click('#sVerifyBox'); await p.waitForTimeout(100); }
  const wf = await where(target);
  ok(wf.found && wf.flash && !wf.folded, '7. a line of a folded quote: the click opens the quote and flashes the line (found ' + wf.found + ', folded ' + wf.folded + ')');

  /* ---- the keyboard ---- */
  const before = (await info()).toast;
  await p.focus('#sEmptyBox'); await p.keyboard.press('Enter'); await p.waitForTimeout(120);
  const kt = (await info()).toast; ok(/^Waiting: /.test(kt), '8. Enter on "waiting" goes too: "' + kt + '"');
  await p.keyboard.press(' '); await p.waitForTimeout(120); ok(/^Waiting: /.test((await info()).toast), '8. and so does the space bar');

  /* ---- nothing to go to ---- */
  await p.evaluate(() => { OV.store.acceptAll(OV.app.state); OV.app.redraw(); });
  const none = await info();
  ok(none.c.check === 0 && none.shown.check === 0, '9. (set-up) everything is checked: the panel shows 0 to check');
  await p.click('#sVerifyBox'); await p.waitForTimeout(120);
  ok((await info()).toast === 'Nothing is waiting to be checked.', '9. "to check" with nothing to check says so: "' + (await info()).toast + '"');

  /* ---- a new client starts the round again at the first ---- */
  await p.evaluate(({ ff }) => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); OV.app.setState(s); }, { ff: FFJ });
  await p.waitForTimeout(200);
  await p.click('#sVerifyBox'); await p.waitForTimeout(120);
  ok(/\(1 of \d+\)$/.test((await info()).toast), '10. another client: the first click goes to the first row again: "' + (await info()).toast + '"');
  ok(!errs.length, '11. no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
