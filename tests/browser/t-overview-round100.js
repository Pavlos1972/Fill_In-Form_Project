/* The Client Overview Studio 1.0 on the real page (24 November: the Fix Skills chat measured Paul's own Chrome on the website: both stored folders LOAD at once and queryPermission gets no answer for either, also after Chrome was fully restarted;
   choosing both folders again in Folders... made them answer at once). So 1.0 says so: when Chrome has answered nothing about any connected folder the page's own window says the saved links look out of date and its main button is
   "Reconnect my folders" (the Folders... dialog; when a folder was chosen again the search starts over by itself); the Folders... dialog no longer shows such a folder as "Connected"; and Save, which waited for ever on such a folder, now says
   so after a few seconds. The stand-in models a stored link as STALE (queryPermission and requestPermission never answer) until it is saved again, and a freshly chosen folder answers at once. Invented clients. Screenshots
   (deviceScaleFactor 1): r11-stale (the window), r11-folders (the Folders... dialog on stale links). Run against 0.99 the checks of sections 1 to 3 FAIL. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(t) { let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; }; add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>'); const c = 'BT /F1 14 Tf 20 60 Td (' + t + ') Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body; }
const TREE = {
  NB: { 'View, Vera': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Vera View).json': '{}' },
    '3. Quotes': { 'BR FNA - 100000091 - 19.11.26.pdf': pdf('FNA quote 100000091') },
    '6. Policy Schedules': { 'BR Policy Summary Schedule - 8844.pdf': pdf('BrightRock summary schedule 8844') },
    'Archive': { '2019': { 'Old note.pdf': pdf('old') } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {},
    'Other, Olive': { '3. Quotes': { 'BR FNA - 100000077 - 19.11.26.pdf': pdf('FNA quote 100000077') } },
    'View Family': { '3. Quotes': { 'BR FNA - 100000066 - 19.11.26.pdf': pdf('FNA quote 100000066') } } },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Vera'), sname: v('View'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [['BrightRock', 'a'], ['Liberty', 'b']].map(r => ({ d: { prov: r[0], spend: 'R 900.00', broker: 'Other broker' } })), grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  /* Chrome-like permissions, per connected folder (the OPFS folders are called NB = New Business and CF = Client Files; every other folder is open):
     __perm[name] = { state: 'granted' | 'prompt', answer: 'allow' | 'never' | 'error' | number (ms until the adviser says Allow) }.
     queryPermission says the state; requestPermission needs the page's fresh user activation (SecurityError without it), then answers as the entry says. Every call is logged with the time since the click and whether the page had activation. */
  const init = () => {
    window.showDirectoryPicker = async o => { const nm = window.__rootNames && window.__rootNames[o.id]; if (!nm) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } const root = await navigator.storage.getDirectory(); return root.getDirectoryHandle(nm); };
    window.__stall = { names: [] }; window.__staleKeys = new Set(JSON.parse(localStorage.getItem('tf-stale') || '[]')); window.__count = 0; window.__t0 = 0; window.__calls = []; window.__perm = {}; window.__picks = [];
    const stamp = (what, name) => window.__calls.push({ ms: window.__t0 ? Math.round(performance.now() - window.__t0) : -1, what, name, active: navigator.userActivation.isActive });
    const real = FileSystemDirectoryHandle.prototype.entries;
    FileSystemDirectoryHandle.prototype.entries = function () { window.__count++; if (window.__stall.names.indexOf(this.name) >= 0) return { [Symbol.asyncIterator]() { return this; }, next() { return new Promise(() => {}); } }; return real.call(this); };
    FileSystemDirectoryHandle.prototype.queryPermission = function () { if (this.__stale) { stamp('query-never-answered', this.name); return new Promise(() => {}); } const e = window.__perm[this.name]; if (e && e.queryHang) { stamp('query-never-answered', this.name); return new Promise(() => {}); } const r = e ? e.state : 'granted'; stamp('query:' + r, this.name); return Promise.resolve(r); };
    FileSystemDirectoryHandle.prototype.requestPermission = function () {
      if (this.__stale) { stamp('request-pending', this.name); return new Promise(() => {}); } const e = window.__perm[this.name]; stamp('request', this.name);
      if (!e || e.state === 'granted') return Promise.resolve('granted');
      if (!navigator.userActivation.isActive) { stamp('request-SecurityError', this.name); return Promise.reject(Object.assign(new Error('User activation is required to request permissions.'), { name: 'SecurityError' })); }
      if (e.answer === 'never') return new Promise(() => {});
      if (e.answer === 'error') return Promise.reject(Object.assign(new Error('The request was blocked.'), { name: 'NotAllowedError' }));
      return new Promise(res => setTimeout(() => { e.state = 'granted'; stamp('answered-allow', this.name); res('granted'); }, typeof e.answer === 'number' ? e.answer : 500));
    };
    const picker = window.showDirectoryPicker;
    window.__pickNext = null;
    window.showDirectoryPicker = async o => { window.__picks.push(JSON.stringify({ id: o && o.id, mode: o && o.mode, hasStart: !!(o && o.startIn), active: navigator.userActivation.isActive, ms: window.__t0 ? Math.round(performance.now() - window.__t0) : -1 })); if (window.__pickNext === 'cancel') { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } if (window.__pickNext) return window.__pickNext; return picker(o); };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); localStorage.setItem('tf-stale', JSON.stringify(JSON.parse(localStorage.getItem('tf-stale') || '[]').filter(x => x !== key))); window.__saved = (window.__saved || []).concat([key]); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); d.__stale = JSON.parse(localStorage.getItem('tf-stale') || '[]').indexOf(key) >= 0; return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootNames = { 'wr-folder-a': 'NB', 'wr-folder-b': 'CF' }; });
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
  /* a fresh overview page for the invented client, the folders connected, the permissions set as the check needs */
  const fresh = async (perm, limits, ffx, stale) => {
    const p = await ctx.newPage();
    await p.addInitScript(s => { try { if (!sessionStorage.getItem('tf-stale-set')) { localStorage.setItem('tf-stale', s); sessionStorage.setItem('tf-stale-set', '1'); } } catch (e) { /* none */ } }, JSON.stringify(stale || [])); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
    await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
    await p.evaluate(({ ff, perm, limits }) => {
      Object.assign(FF.foldersUI.timeouts, limits || {}); window.__perm = perm || {};
      const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
      OV.app.setState(s); OV.app.openAll(); OV.app.go('policies');
    }, { ff: ffx || FFJ, perm, limits });
    await p.waitForTimeout(500);
    return p;
  };
  const click = async p => { await p.evaluate(() => { window.__t0 = performance.now(); window.__calls = []; }); await p.click('#btnReadFolder'); };
  const toastText = p => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  const barsWaiting = p => p.evaluate(() => [...document.querySelectorAll('#nav .prog:not([hidden])')].filter(e => /waiting|searching/.test(e.className)).length);
  const waitToast = (p, re, ms) => p.waitForFunction(r => { const t = document.querySelector('#toast'); return t && !t.hidden && new RegExp(r).test(t.textContent); }, re, { timeout: ms }).then(() => true, () => false);
  const waitList = (p, ms) => p.waitForSelector('dialog.fdlg[open] .flist', { timeout: ms }).then(() => true, () => false);
  const ticked = p => p.evaluate(() => [...document.querySelectorAll('dialog.fdlg[open] .flist input')].filter(i => i.checked).length);
  const calls = p => p.evaluate(() => window.__calls.slice());
  const NB_PROMPT = { NB: { state: 'prompt', answer: 600 }, CF: { state: 'prompt', answer: 'never' } };

  const picksOf = p => p.evaluate(() => window.__picks.map(x => JSON.parse(x)));
  const askWin = p => p.evaluate(() => { const d = document.querySelector('dialog[data-ask][open]'); return d ? { title: d.querySelector('h3').textContent, text: d.textContent, buttons: [...d.querySelectorAll('button')].map(b => b.textContent) } : null; });
  const waitWin = (p, ms) => p.waitForSelector('dialog[data-ask][open]', { timeout: ms }).then(() => true, () => false);
  const SILENT = { NB: { state: 'prompt', answer: 'never', queryHang: true }, CF: { state: 'prompt', answer: 'never', queryHang: true } };
  const vera = p => p.evaluate(async () => { const root = await navigator.storage.getDirectory(); const nb = await root.getDirectoryHandle('NB'); window.__pickNext = await nb.getDirectoryHandle('View, Vera'); });

  const STALE = ['A', 'B'];
  const foldersDlg = p => p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open] [data-key]'); return d ? [...document.querySelectorAll('dialog.fdlg[open] [data-key] [data-stat]')].map(s => s.textContent) : null; });
  const waitFolders = (p, ms) => p.waitForSelector('dialog.fdlg[open] [data-key]', { timeout: ms }).then(() => true, () => false);
  const picks100 = p => p.evaluate(() => window.__picks.map(x => JSON.parse(x)));

  /* ---- 0. the version ---- */
  let p = await fresh({});
  ok(/Version 1\.[012345678]/.test(await p.evaluate(() => document.body.innerText)), '0. the header says Version 1.0');
  await p.close();

  /* ---- 1. both saved links are stale (Chrome never answers about them): the window says so and offers Reconnect my folders ---- */
  p = await fresh({}, null, null, STALE);
  await click(p);
  ok(await waitWin(p, 8000), '1. the page\'s own window opens after 4 seconds');
  const w1 = await askWin(p);
  ok(w1 && /look out of date/.test(w1.title) && /look out of date/.test(w1.text) && !/Edit files/.test(w1.text) && /View, Vera/.test(w1.text), '1. it says the saved links look out of date, names the client folder wanted and does not send the adviser looking for a question: "' + (w1 && w1.text.slice(0, 160)) + '"');
  ok(w1 && w1.buttons.join('|') === 'Stop|Choose the client’s folder myself|Reconnect my folders', '1. three buttons, Ask Chrome again is not one of them (' + (w1 && w1.buttons.join(' | ')) + ')');
  await p.screenshot({ path: out + '/r11-stale.png' });

  /* ---- 2. Reconnect my folders: the Folders... dialog opens and does NOT show the stale links as Connected; choosing both again opens the list by itself ---- */
  await p.click('dialog[data-ask][open] button:has-text("Reconnect my folders")');
  ok(await waitFolders(p, 4000), '2. the Folders... dialog opens');
  await p.waitForTimeout(3300);
  const st2 = await foldersDlg(p);
  ok(st2 && st2.length === 2 && st2.every(t => /Chrome is not answering about this folder/.test(t)) && !st2.some(t => /^Connected/.test(t)), '2. both saved folders are shown as not answering, not as Connected: ' + JSON.stringify(st2));
  await p.screenshot({ path: out + '/r11-folders.png' });
  await p.click('dialog.fdlg[open] [data-key="A"] [data-pick]'); await p.waitForTimeout(250);
  const mid = await foldersDlg(p);
  ok(mid && /^Connected/.test(mid[0]) && /not answering/.test(mid[1]), '2. a folder chosen again is Connected at once, the other still says it is not answering');
  await p.click('dialog.fdlg[open] [data-key="B"] [data-pick]'); await p.waitForTimeout(250);
  await p.click('dialog.fdlg[open] [data-done]');
  ok(await waitList(p, 8000), '2. Done: the search starts over by itself and the list of the client\'s documents opens');
  const tk2 = await ticked(p), pk2 = await picks100(p);
  ok(tk2 >= 2 && !pk2.some(x => x.id === 'wr-client-folder'), '2. the documents are ticked (' + tk2 + ') and the folder window for the client\'s own folder was not needed');
  ok(await p.evaluate(() => window.__saved.sort().join('') === 'AB') && await p.evaluate(() => JSON.parse(localStorage.getItem('tf-stale')).length === 0), '2. both folders were saved again');
  ok(await p.evaluate(() => document.querySelectorAll('dialog[data-ask]').length) === 0, '2. no question window is left');
  await p.close();

  /* ---- 3. a page opened later uses the saved-again links: the list opens at once ---- */
  p = await fresh({});
  const t3 = Date.now(); await click(p);
  ok(await waitList(p, 4000), '3. a new page after the reconnect: the list opens at once (' + (Date.now() - t3) + ' ms), no window of any kind');
  await p.close();

  /* ---- 4. Reconnect and then Done (or Esc) with nothing chosen: said once, every block released, no loop ---- */
  for (const how of ['Done', 'Esc']) {
    p = await fresh({}, null, null, STALE);
    await click(p); await waitWin(p, 8000);
    await p.click('dialog[data-ask][open] button:has-text("Reconnect my folders")'); await waitFolders(p, 4000);
    if (how === 'Done') await p.click('dialog.fdlg[open] [data-done]'); else await p.keyboard.press('Escape');
    ok(await waitToast(p, 'No folder was chosen again', 3000) && await barsWaiting(p) === 0, '4. ' + how + ' with nothing chosen: it says so and releases every block');
    await p.waitForTimeout(5200);
    ok(!(await askWin(p)) && !(await waitFolders(p, 300)), '4. ' + how + ': the window does not come back by itself (no loop)');
    await p.close();
  }

  /* ---- 5. Folders... on healthy links shows them as Connected ---- */
  p = await fresh({});
  await p.evaluate(() => { FF.foldersUI.connect(); });
  await waitFolders(p, 3000); await p.waitForTimeout(3300);
  const st5 = await foldersDlg(p);
  ok(st5 && st5.length === 2 && st5.every(t => /^Connected/.test(t)), '5. healthy links: both Connected, nothing about not answering: ' + JSON.stringify(st5));
  await p.close();

  /* ---- 6. Save (the open() of every page) with stale links no longer waits for ever: it names the folders after a few seconds and falls back ---- */
  p = await fresh({}, null, null, STALE);
  const r6 = await p.evaluate(async () => {
    const t0 = performance.now(), ctx = { kind: 'overview', info: { sname: 'View', fname: 'Vera' }, name: 'x.json', hints: [], toast: t => { window.__t6 = t; }, picker: async () => { window.__picker6 = true; return null; }, retry: () => {}, startedAt: Date.now() };
    let r = 'returned'; try { await FF.foldersUI.open(ctx); } catch (e) { r = e.name; }
    return { r, ms: Math.round(performance.now() - t0), t: window.__t6 || '', picker: !!window.__picker6 };
  });
  ok(r6.r === 'AbortError' && r6.ms < 6500 && /Chrome is not answering about New Business and Client Files/.test(r6.t) && /Click Folders/.test(r6.t), '6. Save with stale links: after ' + r6.ms + ' ms it says "' + r6.t.slice(0, 150) + '" (0.99 and before waited for ever)');
  await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
