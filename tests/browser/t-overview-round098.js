/* The Client Overview Studio 0.98 on the real page (24 November, Paul's screenshot of 0.97 on the website: after one click on "Load from client folder…" the wait said "New Business: checking, Client Files: checking… 19 s" and nothing else).
   "Checking" means Chrome had not answered even the first question ("is this folder open to the page?"), so 0.97, which asked its permission question only AFTER that answer, never asked it; and 0.97's own "choose the client's folder" button
   was only offered, not used. 0.98: the permission question is asked after 1.2 seconds even when Chrome has not answered the first one, and when no connected folder has said anything after 2.5 seconds the browser's folder window opens
   by itself (the click is still fresh), so the adviser chooses the client's folder and the same ticked list opens. Invented client ("View, Vera"). Screenshot (deviceScaleFactor 1): r9-auto (the list after the folder window opened by itself).
   Run against 0.97 the checks of section 2 FAIL. (0.99 took out the folder window that 0.98 opened by itself: its sections 1 and 4 moved to t-overview-round099.js and now say the opposite.) */
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
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
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
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    window.__stall = { names: [] }; window.__count = 0; window.__t0 = 0; window.__calls = []; window.__perm = {}; window.__picks = [];
    const stamp = (what, name) => window.__calls.push({ ms: window.__t0 ? Math.round(performance.now() - window.__t0) : -1, what, name, active: navigator.userActivation.isActive });
    const real = FileSystemDirectoryHandle.prototype.entries;
    FileSystemDirectoryHandle.prototype.entries = function () { window.__count++; if (window.__stall.names.indexOf(this.name) >= 0) return { [Symbol.asyncIterator]() { return this; }, next() { return new Promise(() => {}); } }; return real.call(this); };
    FileSystemDirectoryHandle.prototype.queryPermission = function () { const e = window.__perm[this.name]; if (e && e.queryHang) { stamp('query-never-answered', this.name); return new Promise(() => {}); } const r = e ? e.state : 'granted'; stamp('query:' + r, this.name); return Promise.resolve(r); };
    FileSystemDirectoryHandle.prototype.requestPermission = function () {
      const e = window.__perm[this.name]; stamp('request', this.name);
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
  /* a fresh overview page for the invented client, the folders connected, the permissions set as the check needs */
  const fresh = async (perm, limits) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
    await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
    await p.evaluate(({ ff, perm, limits }) => {
      Object.assign(FF.foldersUI.timeouts, limits || {}); window.__perm = perm || {};
      const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
      OV.app.setState(s); OV.app.openAll(); OV.app.go('policies');
    }, { ff: FFJ, perm, limits });
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

  /* ---- 0. the version ---- */
  let p = await fresh({});
  ok(/Version (0\.9[89]|1\.[01234567])/.test(await p.evaluate(() => document.body.innerText)), '0. the header says Version 0.98 or later');
  await p.close();

  /* ---- 2. Chrome does not answer the first question but WOULD answer the permission question: it is asked after 1.2 seconds and the list opens when the adviser says Allow ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 600, queryHang: true }, CF: { state: 'prompt', answer: 'never', queryHang: true } });
  t0 = Date.now(); await click(p);
  const listed2 = await waitList(p, 6000), c2 = await calls(p), req2 = c2.filter(c => c.what === 'request');
  ok(req2.length >= 1 && req2[0].active === true && req2[0].ms >= 1000 && req2[0].ms < 2000, '2. the permission question is asked after about 1.2 s although the first answer never came (after ' + (req2[0] && req2[0].ms) + ' ms, activation ' + (req2[0] && req2[0].active) + ')');
  ok(listed2 && Date.now() - t0 < 4000, '2. the list opens once Chrome says Allow (' + (Date.now() - t0) + ' ms), and the folder window did not have to open (' + (await p.evaluate(() => window.__picks.length)) + ' times)');
  await p.close();

  /* ---- 3. the old picture, 0.97: nothing answers and the window must not open while Chrome is still being asked a question the adviser can answer ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'prompt', answer: 'never' } }, { stopLink: 60000, permission: 60000 });
  await click(p); await p.waitForTimeout(4200);
  ok(await p.evaluate(() => window.__picks.length) === 0, '3. when Chrome HAS answered "not yet" (a question is waiting for the adviser) the folder window does not open over it');
  await p.close();

  /* ---- 5. the old Load with everything answering still opens at once ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'granted' } });
  t0 = Date.now(); await click(p);
  ok(await waitList(p, 3000) && await p.evaluate(() => window.__picks.length) === 0, '5. permission given: the list opens at once (' + (Date.now() - t0) + ' ms) and the folder window stays shut');
  await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
