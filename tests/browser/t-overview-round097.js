/* The Client Overview Studio 0.97 on the real page (24 November, Paul: on the website copy of 0.96 one click on "Load from client folder…" showed only "Waiting for Chrome's permission question… 7 s", every block "Waiting to search the client folder",
   no question from Chrome to click; before 0.95 the same click opened the list of the client's documents, all ticked, at once).
   Found by running 0.94 and 0.96 side by side against handles that behave like Chrome's (a permission that is "prompt" until answered, a request that needs the page's fresh click): the calls after the click are the same in both, and BOTH wait for every
   connected folder to answer, so one folder Chrome leaves unanswered holds the whole list back even when the other is open. 0.97: the list opens as soon as ONE connected folder is open, every folder is asked about at once, the screen says what Chrome
   answered for each, and after a few seconds the adviser can ask Chrome again, choose the client's own folder in the browser's folder window (that is the permission), or use the normal file window.
   Run against 0.96 the "one folder never answered" checks FAIL. Invented client ("View, Vera"). Screenshots (deviceScaleFactor 1): r8-list (the list after ONE click with permission not yet granted), r8-waiting (the wait with its three buttons). */
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
    FileSystemDirectoryHandle.prototype.queryPermission = async function () { const e = window.__perm[this.name]; const r = e ? e.state : 'granted'; stamp('query:' + r, this.name); return r; };
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
    window.showDirectoryPicker = async o => { window.__picks.push(JSON.stringify({ id: o && o.id, mode: o && o.mode, hasStart: !!(o && o.startIn) })); if (window.__pickNext === 'cancel') { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } if (window.__pickNext) return window.__pickNext; return picker(o); };
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
  const waitWin = (pg, ms) => pg.waitForSelector('dialog[data-ask][open]', { timeout: ms }).then(() => true, () => false);
  const waitToast = (p, re, ms) => p.waitForFunction(r => { const t = document.querySelector('#toast'); return t && !t.hidden && new RegExp(r).test(t.textContent); }, re, { timeout: ms }).then(() => true, () => false);
  const waitList = (p, ms) => p.waitForSelector('dialog.fdlg[open] .flist', { timeout: ms }).then(() => true, () => false);
  const ticked = p => p.evaluate(() => [...document.querySelectorAll('dialog.fdlg[open] .flist input')].filter(i => i.checked).length);
  const calls = p => p.evaluate(() => window.__calls.slice());
  const NB_PROMPT = { NB: { state: 'prompt', answer: 600 }, CF: { state: 'prompt', answer: 'never' } };

  /* ---- 0. the version ---- */
  let p = await fresh({});
  ok(/Version (0\.9[789]|1\.[0123456])/.test(await p.evaluate(() => document.body.innerText)), '0. the header says Version 0.97 or later');
  await p.close();

  /* ---- 1. permission already granted: ONE click, the list at once (0.94's behaviour), nothing asked of Chrome ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'granted' } });
  let t0 = Date.now(); await click(p);
  ok(await waitList(p, 4000), '1. permission already given: one click opens the list (' + (Date.now() - t0) + ' ms)');
  ok(!(await calls(p)).some(c => c.what === 'request'), '1. and Chrome is not asked anything');
  await p.close();

  /* ---- 2. Paul's morning: permission NOT given yet; ONE click, Chrome is asked at once with the click behind it, and the list opens when the adviser says Allow ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 700 }, CF: { state: 'prompt', answer: 700 } });
  t0 = Date.now(); await click(p);
  const listed2 = await waitList(p, 8000); const ms2 = Date.now() - t0;
  const c2 = await calls(p), req2 = c2.filter(c => c.what === 'request');
  ok(req2.length >= 1 && req2[0].active === true && req2[0].ms < 300, '2. the first question to Chrome is asked in the click’s own turn, with the click behind it (after ' + (req2[0] && req2[0].ms) + ' ms, activation ' + (req2[0] && req2[0].active) + ')');
  ok(c2.filter(c => c.what.indexOf('query') === 0).length >= 2 && c2.filter(c => c.what.indexOf('query') === 0).every(c => c.ms < 300), '2. both connected folders are asked about at the same moment');
  ok(listed2 && ms2 < 4000, '2. ONE click opens the list once the adviser has said Allow (' + ms2 + ' ms), without a second click');
  const tk2 = await ticked(p);
  ok(tk2 >= 2 && await p.$('dialog.fdlg[open] [data-yes]') !== null, '2. the client’s documents are listed and the ones the page can sort are ticked (' + tk2 + ' ticked) with “Load the ticked ones”');
  await p.screenshot({ path: out + '/r8-list.png' });
  ok(await p.evaluate(() => /Documents in View, Vera/.test(document.querySelector('dialog.fdlg[open] h3').textContent)), '2. the list is headed with the client’s folder (screenshot r8-list)');
  await p.close();

  /* ---- 3. New Business open, Client Files never answered (a question Chrome does not show): the list opens at once ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'prompt', answer: 'never' } });
  t0 = Date.now(); await click(p);
  const listed3 = await waitList(p, 4000);
  ok(listed3 && Date.now() - t0 < 3000, '3. one folder open and the other never answered: the list opens at once (' + (Date.now() - t0) + ' ms; 0.96 waited for ever)');
  ok(await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); return !!d && /Client Files was not open to this page yet/.test(d.textContent); }), '3. and the list says that Client Files was not open to the page, so only the other folder was searched');
  await p.close();

  /* ---- 4. the open folder does not hold the client and the other never answers: the screen says which folder was not open ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'granted' } }, { permission: 1500, stopLink: 60000, askAgain: 60000 });
  await click(p);
  ok(await waitToast(p, 'New Business was not open to this page', 8000), '4. the client is not in the open folder and the other never answered: "' + (await toastText(p)).slice(0, 170) + '"');
  ok(await barsWaiting(p) === 0, '4. no block is left waiting');
  await p.close();

  /* ---- 5. nothing answers: Chrome’s answer for each folder is on the screen, then three ways on ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'prompt', answer: 'never' } }, { stopLink: 60000, permission: 60000 });
  await click(p);
  ok(await waitToast(p, 'New Business: waiting for your answer', 3000), '5. the wait names each folder and what Chrome has said: "' + (await toastText(p)).slice(0, 190) + '"');
  ok(await waitWin(p, 7000), '5. after 4 seconds (the real limit) the page\'s own window offers another try (0.99: it was a message with buttons before)');
  const btns = await p.$$eval('dialog[data-ask][open] button', els => els.map(e => e.textContent));
  ok(btns.length === 3 && /Stop/.test(btns[0]) && /Ask Chrome again/.test(btns[1]) && /Choose the client.s folder myself/.test(btns[2]), '5. three buttons: ' + btns.join(' | '));
  await p.screenshot({ path: out + '/r8-waiting.png' });
  /* "Ask Chrome again": a fresh click; Chrome answers this time */
  await p.evaluate(() => { window.__perm.NB.answer = 400; window.__perm.CF.answer = 400; window.__calls = []; window.__t0 = performance.now(); });
  await p.click('dialog[data-ask][open] >> text=Ask Chrome again');
  ok(await waitList(p, 8000), '5. “Ask Chrome again” asks again with a fresh click and the list opens when Chrome answers');
  const req5 = (await calls(p)).filter(c => c.what === 'request');
  ok(req5.length >= 1 && req5[0].active === true, '5. the second question had the click behind it (activation ' + (req5[0] && req5[0].active) + ')');
  await p.close();

  /* ---- 6. nothing answers: “Choose the client’s folder myself” opens the same ticked list from the folder picked, with no question to Chrome ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'prompt', answer: 'never' } }, { askAgain: 900, stopLink: 60000, permission: 60000 });
  await p.evaluate(async () => { const root = await navigator.storage.getDirectory(); const nb = await root.getDirectoryHandle('NB'); window.__pickNext = await nb.getDirectoryHandle('View, Vera'); });
  await click(p);
  ok(await waitWin(p, 4000), '6. the button is offered (in the page\'s own window)');
  await p.evaluate(() => { window.__calls = []; });
  await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself');
  ok(await waitList(p, 6000), '6. choosing the client’s folder opens the list of its documents');
  const tk6 = await ticked(p), titles6 = await p.$$eval('dialog.fdlg[open] .flist span', els => els.map(e => e.textContent));
  ok(tk6 >= 2 && titles6.some(t => /BR FNA - 100000091/.test(t)) && titles6.some(t => /Policy Summary Schedule - 8844/.test(t)) && !titles6.some(t => /Old note/.test(t)), '6. the same documents are listed and ticked as with the connected folders (' + tk6 + ' ticked): ' + titles6.map(t => t.slice(0, 38)).join(' | '));
  ok(!(await calls(p)).some(c => c.what === 'request'), '6. and Chrome is not asked a second time');
  const picks6 = await p.evaluate(() => window.__picks.slice());
  ok(picks6.length === 1 && /"mode":"read"/.test(picks6[0]) && /"hasStart":false/.test(picks6[0]), '6. the folder window asks for read access only and passes no stored folder as its start: ' + picks6[0]);
  ok(await p.evaluate(() => !!OV.view.state.idx && OV.view.state.idx.seeded === true), '6. the list serves the View buttons too');
  await p.close();

  /* ---- 7. the folder window is cancelled: said, and no block is left waiting ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'prompt', answer: 'never' } }, { askAgain: 900, stopLink: 60000, permission: 60000 });
  await p.evaluate(() => { window.__pickNext = 'cancel'; });
  await click(p); await waitWin(p, 4000);
  await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself');
  ok(await waitToast(p, 'Nothing was chosen', 3000) && await barsWaiting(p) === 0, '7. cancelling the folder window says so and releases every block');
  await p.close();

  /* ---- 8. Chrome refuses outright: what Chrome said is on the screen ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 'error' }, CF: { state: 'prompt', answer: 'error' } }, { stopLink: 60000 });
  const chooser8 = p.waitForEvent('filechooser', { timeout: 8000 }).then(() => true, () => false);
  await click(p);
  ok(await waitToast(p, 'Chrome said: NotAllowedError', 6000), '8. a refusal is shown with Chrome’s own words: "' + (await toastText(p)).slice(0, 200) + '"');
  ok(await chooser8 && await barsWaiting(p) === 0, '8. and the normal file window opens, no block left waiting');
  await p.close();

  /* ---- 9. a late Allow for a folder after the list is open changes nothing (the stopped search is ignored) ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'prompt', answer: 2500 } });
  await click(p);
  ok(await waitList(p, 3000), '9. the list is open while Client Files is still being asked about');
  await p.waitForTimeout(3200);
  ok(await p.evaluate(() => !!document.querySelector('dialog.fdlg[open] .flist')) && errs.length === 0, '9. the late Allow changes nothing and breaks nothing');
  await p.close();

  /* ---- 10. Upload from client folder: one folder open, the other never answered: the file window opens in the client's folder ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'prompt', answer: 'never' } });
  await p.evaluate(() => { window.__opened = []; window.showOpenFilePicker = async o => { window.__opened.push(!!(o && o.startIn)); const e = new Error('cancelled'); e.name = 'AbortError'; throw e; }; OV.app.go('fna'); });
  await p.waitForTimeout(300);
  const up = await p.$('[data-upc]');
  if (up) { await up.click(); await p.waitForTimeout(1500); ok(await p.evaluate(() => window.__opened.length) === 1, '10. Upload from client folder opens the file window in the client’s folder although Client Files never answered'); }
  else ok(false, '10. there is an Upload from client folder button on the FNA page');
  await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
