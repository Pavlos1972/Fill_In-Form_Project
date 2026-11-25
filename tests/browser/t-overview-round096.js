/* The Client Overview Studio 0.96 on the real page (24 November: "Load from client folder" stuck on "Looking for the client's folder…" with every block "Waiting to search the client folder", Studio 0.95 on the website, folders connected).
   The search had no time limit anywhere, so a permission question Chrome was still waiting on, or a slow OneDrive folder, left the screen like that for good; 0.95 also started a walk of the client's whole folder tree by itself as soon as
   a View button was on the screen. These checks stall the folders on purpose (a permission question that is never answered, a folder listing that never ends) and must END with a message that says where the search is stuck; they also
   check that nothing walks the folders by itself, that a Load's list serves the View buttons, that a walk has a time limit, that an error inside the load shows a message, and that a page of View buttons draws fast.
   Run against Studio 0.95 the stall checks FAIL (the toast stays "Looking for the client's folder…"). Invented client ("View, Vera"). Screenshot (deviceScaleFactor 1): r7-stuck. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(t) { let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; }; add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body; }
const TREE = {
  NB: { 'View, Vera': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Vera View).json': '{}' },
    '3. Quotes': { 'BR FNA - 100000091 - 19.11.26.pdf': pdf('FNA quote 100000091') },
    '5. Investments': { 'Test Provider Statement.png': 'PNG' },
    '6. Policy Schedules': { 'BR Policy Summary Schedule - 8844.pdf': pdf('BrightRock summary schedule 8844') },
    'Archive': { '2019': { 'Old note.pdf': pdf('old') } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Vera'), sname: v('View'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [['BrightRock', 'a'], ['Liberty', 'b']].map(r => ({ d: { prov: r[0], spend: 'R 900.00', broker: 'Other broker' } })), grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = () => {
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    window.__stall = { perm: false, names: [] }; window.__count = 0;
    const real = FileSystemDirectoryHandle.prototype.entries;
    FileSystemDirectoryHandle.prototype.entries = function () { window.__count++; if (window.__stall.names.indexOf(this.name) >= 0) return { [Symbol.asyncIterator]() { return this; }, next() { return new Promise(() => {}); } }; return real.call(this); };
    FileSystemDirectoryHandle.prototype.queryPermission = async function () { return window.__stall.perm ? 'prompt' : 'granted'; };
    FileSystemDirectoryHandle.prototype.requestPermission = function () { return window.__stall.perm ? new Promise(() => {}) : Promise.resolve('granted'); };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await ctx.addInitScript(init);
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(x); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), x); } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const errs = [];
  /* a fresh overview page for the invented client: every check starts from the same place */
  const fresh = async (setup) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
    await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
    await p.evaluate(({ ff, lim }) => {
      const T = FF.foldersUI.timeouts || (FF.foldersUI.timeouts = {}); Object.assign(T, lim);
      const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
      const br = s.blocks.policies.items.filter(i => i.insurer === 'BrightRock')[0]; OV.docs.applyPolicy(s, br, { insurer: 'BrightRock', policyNo: '8844', product: 'Lifestyle', premium: 900, lines: [{ type: 'household', life: { lump: 500000 } }] }, 'BR Policy Summary Schedule - 8844.pdf');
      const inv = { id: 'i1', wr: true, provider: 'Test Provider', product: 'RA', st: 'empty', removed: false }; s.blocks.investments.items.push(inv); OV.docs.applyInvestment(s, inv, { gross: 1 }, 'Test Provider Statement.png', { kind: 'schedule' });
      OV.app.setState(s); OV.app.openAll(); OV.app.go('policies');
    }, { ff: FFJ, lim: setup || {} });
    await p.waitForTimeout(500);
    return p;
  };
  const toastText = p => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  const barsWaiting = p => p.evaluate(() => [...document.querySelectorAll('#nav .prog:not([hidden])')].filter(e => /waiting|searching/.test(e.className)).length);
  const waitToast = (p, re, ms) => p.waitForFunction(r => { const t = document.querySelector('#toast'); return t && !t.hidden && new RegExp(r).test(t.textContent); }, re, { timeout: ms }).then(() => true, () => false);

  /* ---- 0. the version ---- */
  let p = await fresh({});
  ok(/Version (0\.9[6-9]|1\.[0123456789]|2\.[012])/.test(await p.evaluate(() => document.body.innerText)), '0. the header says Version 0.96 or later');

  /* ---- 1. nothing walks the folders by itself (0.95 did, as soon as a View button was on the screen) ---- */
  await p.evaluate(() => { window.__count = 0; OV.app.go('fna'); OV.app.go('policies'); OV.app.go('investments'); });
  await p.waitForTimeout(2500);
  ok(await p.evaluate(() => window.__count) === 0, '1. with the folders allowed and View buttons on the screen, no folder is listed by the page itself (listings so far: ' + await p.evaluate(() => window.__count) + ')');
  ok(await p.evaluate(() => !OV.view.state.idx && !OV.view.state.loading), '1. and no list for the buttons is being made');
  const btn0 = await p.$eval('[data-vw]', e => ({ dis: e.disabled, t: e.title }));
  ok(!btn0.dis && /Opens/.test(btn0.t), '1. the buttons are plainly there and say what a click does: ' + btn0.t);
  await p.close();

  /* ---- 2. a permission question that is never answered: the search says so, and ends ---- */
  p = await fresh({ permission: 1500, stopLink: 60000 });
  await p.evaluate(() => { window.__stall.perm = true; });
  const chooser = p.waitForEvent('filechooser', { timeout: 8000 }).then(() => true, () => false);
  await p.click('#btnReadFolder'); const t0 = Date.now();
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav .prog:not([hidden])')].some(e => /waiting/.test(e.className))), '2. the blocks wait while the search runs');
  const said = await waitToast(p, 'Chrome did not get an answer', 8000);
  const ended = Date.now() - t0;
  ok(said && ended < 7000, '2. after the time limit the screen SAYS what is wrong instead of "Looking for the client’s folder…": "' + (await toastText(p)).slice(0, 140) + '" (' + ended + ' ms)');
  ok(await chooser, '2. a fresh click is still behind it, so the normal file window opens by itself');
  ok(await barsWaiting(p) === 0, '2. no block is left "Waiting to search the client folder"');
  await p.screenshot({ path: out + '/r7-stuck.png' });
  await p.close();

  /* ---- 3. the same question, but the limit passes after the click has gone stale: the message carries a button ---- */
  p = await fresh({ permission: 4600, stopLink: 60000 });
  await p.evaluate(() => { window.__stall.perm = true; });
  await p.click('#btnReadFolder');
  ok(await waitToast(p, 'Chrome did not get an answer', 9000) && await p.$('#toast [data-toastlink]') !== null, '3. a late failure says so with an “Open the normal file window” button: "' + (await toastText(p)).slice(0, 120) + '"');
  const chooser3 = p.waitForEvent('filechooser', { timeout: 4000 }).then(() => true, () => false);
  await p.click('#toast [data-toastlink]'); ok(await chooser3, '3. the button opens the normal file window');
  ok(await barsWaiting(p) === 0, '3. no block is left waiting');
  await p.close();

  /* ---- 4. a folder listing that never ends (a slow OneDrive folder) ---- */
  p = await fresh({ find: 1500, stopLink: 60000 });
  await p.evaluate(() => { window.__stall.names = ['NB']; });
  await p.click('#btnReadFolder');
  const slow = await waitToast(p, 'took too long', 8000);
  ok(slow, '4. a folder listing that never ends is reported: "' + (await toastText(p)).slice(0, 140) + '"');
  ok(await barsWaiting(p) === 0, '4. no block is left waiting');
  await p.close();

  /* ---- 5. while it waits the screen says where it is and how long, and the adviser can stop it ---- */
  p = await fresh({ permission: 60000, stopLink: 600 });
  await p.evaluate(() => { window.__stall.perm = true; });
  await p.click('#btnReadFolder');
  ok(await waitToast(p, 'Waiting for Chrome.s permission question.* \\d+ s', 4000), '5. the wait says it is Chrome’s question and counts the seconds: "' + (await toastText(p)).slice(0, 130) + '"');
  ok(await waitToast(p, 'Stop and use the normal file window', 4000), '5. after a few seconds a Stop link appears');
  const chooser5 = p.waitForEvent('filechooser', { timeout: 4000 }).then(() => true, () => false);
  await p.click('#toast [data-toastlink]');
  ok(await chooser5 && await barsWaiting(p) === 0, '5. Stop opens the normal file window and the blocks stop waiting');
  await p.evaluate(() => { window.__stall.perm = false; });
  await p.waitForTimeout(1500);
  ok(await barsWaiting(p) === 0 && !/Looking for|Waiting for Chrome/.test(await toastText(p)), '5. a late answer to the stopped search changes nothing');
  await p.close();

  /* ---- 6. an error inside the load shows a message (the success handler had no catch) ---- */
  p = await fresh({ stopLink: 60000 });
  await p.evaluate(() => { FF.foldersUI.clientFiles = () => Promise.resolve({ label: 'x', files: 5 }); });
  const chooser6 = p.waitForEvent('filechooser', { timeout: 6000 }).then(() => true, () => false);
  await p.click('#btnReadFolder');
  ok(await waitToast(p, 'Something went wrong while looking', 4000), '6. an error inside the load is told: "' + (await toastText(p)).slice(0, 120) + '"');
  ok(await chooser6 && await barsWaiting(p) === 0, '6. and the screen is released');
  await p.close();

  /* ---- 7. a Load's own list serves the View buttons: no second walk ---- */
  p = await fresh({ stopLink: 60000 });
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist', { timeout: 15000 });
  const seeded = await p.evaluate(() => ({ s: !!OV.view.state.idx && OV.view.state.idx.seeded === true, n: OV.view.state.idx ? OV.view.state.idx.files.length : 0 }));
  ok(seeded.s && seeded.n >= 2, '7. the list of the Load serves the View buttons (' + seeded.n + ' files, partial: the folders the page reads)');
  await p.click('dialog.fdlg [data-no]').catch(() => {}); await p.waitForTimeout(400);
  const c0 = await p.evaluate(() => window.__count);
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(500);
  const pol = await p.$eval('[data-vw^="blocks.policies.items."]', e => ({ t: e.title, dis: e.disabled }));
  ok(/BR Policy Summary Schedule - 8844\.pdf/.test(pol.t) && !pol.dis, '7. the BrightRock policy’s button names its file from that list: ' + pol.t);
  await p.click('[data-vw^="blocks.policies.items."]'); await p.waitForSelector('.dvo .dvpage canvas', { timeout: 15000 });
  ok(await p.evaluate(() => window.__count) === c0, '7. opening it did not list any folder again (' + c0 + ' listings before, ' + await p.evaluate(() => window.__count) + ' after)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  /* a file that is not in the Load's list is looked for in the whole client folder, with a time limit */
  await p.evaluate(() => { OV.app.go('investments'); }); await p.waitForTimeout(400);
  await p.evaluate(() => { FF.foldersUI.timeouts.walk = 1500; window.__stall.names = ['Archive']; });
  const w0 = Date.now(); await p.click('[data-vw^="blocks.investments.items."]');
  const settled = await p.waitForFunction(() => { const o = document.querySelector('.dvo'); return o && (o.querySelector('.dvimg') || o.querySelector('.dvmsg.bad') || o.querySelector('.dvframe')); }, null, { timeout: 12000 }).then(() => true, () => false);
  ok(settled && Date.now() - w0 < 9000, '7. a walk through a folder that never answers ends within its time limit (' + (Date.now() - w0) + ' ms): "' + (await p.evaluate(() => { const m = document.querySelector('.dvo .dvmsg'); return m ? m.textContent.slice(0, 110) : 'the document opened'; })) + '"');
  await p.keyboard.press('Escape'); await p.close();

  /* ---- 8. the Presentation lists the client's files itself, with the question to Chrome left out ---- */
  p = await fresh({});
  await p.evaluate(() => { window.__count = 0; OV.present.open(); });
  await p.waitForFunction(() => OV.view.state.idx && !OV.view.state.idx.seeded, null, { timeout: 12000 }).catch(() => {});
  const warm = await p.evaluate(() => ({ idx: !!OV.view.state.idx, partial: OV.view.state.idx && OV.view.state.idx.partial, n: window.__count }));
  ok(warm.idx && warm.partial === false && warm.n > 0, '8. opening the Presentation (a click) lists the client’s files once, completely (' + (warm.n) + ' listings)');
  await p.evaluate(() => OV.present.close()); await p.close();

  /* ---- 9. a page of buttons draws fast, and a burst of redraws is one ---- */
  p = await fresh({});
  const perf = await p.evaluate(() => {
    const files = []; for (let i = 0; i < 4000; i++) files.push({ name: ['BR', 'Liberty', 'Old Mutual', 'Discovery'][i % 4] + ' statement ' + (100000 + i) + ' - ' + (i % 28 + 1) + '.11.26.pdf', rel: ['3. Quotes', '2026'], handle: {} });
    OV.view.seed('x', files); OV.view.invalidate();
    const s = OV.app.state; for (let i = 0; i < 25; i++) { const it = JSON.parse(JSON.stringify(s.blocks.policies.items[0])); it.id = 'p' + i; it.policyNo = String(9000 + i); s.blocks.policies.items.push(it); }
    OV.app.go('policies'); OV.view.paintNow();
    const t0 = performance.now(); OV.view.invalidate(); OV.view.paintNow(); const first = performance.now() - t0;
    const n0 = OV.view.state.paints || 0; for (let i = 0; i < 50; i++) OV.view.paint();
    return { first: Math.round(first), buttons: document.querySelectorAll('.dvbtn').length };
  });
  await p.waitForTimeout(400);
  const paints = await p.evaluate(() => OV.view.state.paints || 0);
  ok(perf.buttons >= 20 && perf.first < 250, '9. ' + perf.buttons + ' View buttons over 4,000 files are brought up to date in ' + perf.first + ' ms (0.95 took about 280 ms for 40)');
  ok(paints > 0 && paints < 60, '9. fifty redraw requests in a burst are folded together (' + paints + ' paints in all so far)');
  await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
