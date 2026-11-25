/* The Client Overview Studio 0.99 on the real page (24 November, Paul's screenshot of 0.98: the browser's folder window opened by itself, at ANOTHER client's folder: "It shouldn't be opening up the file explorer ... I want you to reproduce
   exactly that" (the page's own list of the client's documents, all ticked)). 0.99 takes the automatic window out: when Chrome is silent the page's OWN window opens (after 4 seconds) and says what Chrome has been asked, which client folder
   it is looking for, and offers Ask Chrome again, Choose the client's folder myself and Stop; a question Chrome HAS been asked is never covered; the folder chosen by hand is checked against the client (another client's folder is refused,
   a folder that is not a client's name is asked about). Invented clients ("View, Vera", "Other, Olive"). Screenshots (deviceScaleFactor 1): r10-silent (the page's own window), r10-wrong (another client's folder refused).
   Run against 0.98 the checks of sections 1 to 3 FAIL. */
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
  const fresh = async (perm, limits, ffx) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
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

  /* ---- 0. the version ---- */
  let p = await fresh({});
  ok(/Version (0\.99|1\.[0123456])/.test(await p.evaluate(() => document.body.innerText)), '0. the header says Version 0.99');
  await p.close();

  /* ---- 1. Chrome says nothing at all: the browser's folder window does NOT open by itself; the page's own window does, with the client's folder named and the three actions ---- */
  p = await fresh(SILENT);
  await vera(p); await click(p); await p.waitForTimeout(3600);
  ok((await picksOf(p)).length === 0 && !(await askWin(p)), '1. after 3.6 s the browser\'s folder window has not opened by itself and the page\'s own window is not there yet');
  ok(await waitWin(p, 6000), '1. the page\'s own window opens once Chrome has had 4 seconds');
  let win1 = await askWin(p);
  ok(win1 && /look out of date/.test(win1.title) && /View, Vera/.test(win1.text) && /look out of date/.test(win1.text) && !/Edit files/.test(win1.text) && /Reconnect my folders/.test(win1.text), '1. (1.0) Chrome answered nothing about either folder: the window says the saved links look out of date, names the folder it is looking for (View, Vera) and does not send the adviser looking for a question');
  ok(win1 && win1.buttons.join('|') === 'Stop|Choose the client’s folder myself|Reconnect my folders', '1. (1.0) and offers Stop, Choose the client\'s folder myself and Reconnect my folders, not Ask Chrome again (' + (win1 && win1.buttons.join(' | ')) + ')');
  ok((await picksOf(p)).length === 0, '1. still no browser folder window');
  await p.screenshot({ path: out + '/r10-silent.png' });
  await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself');
  ok(await waitList(p, 6000), '1. Choose the client\'s folder myself opens the same list of the client\'s documents');
  const pk1 = await picksOf(p), tk1 = await ticked(p);
  ok(pk1.length === 1 && pk1[0].active === true && pk1[0].id === 'wr-client-folder' && !pk1[0].hasStart && tk1 >= 2, '1. the browser window had the click behind it, no stored folder as its start, and the documents are ticked (' + tk1 + ')');
  ok(!(await askWin(p)) || (await p.evaluate(() => document.querySelectorAll('dialog[data-ask][open]').length)) === 0, '1. the page\'s own question window is gone');
  await p.close();

  /* ---- 2. Chrome HAS been asked and the adviser takes 5 seconds to answer: nothing covers the question, and the list opens when Allow is clicked ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 5000, queryHang: true }, CF: { state: 'prompt', answer: 'never', queryHang: true } });
  let t0 = Date.now(); await click(p);
  await p.waitForTimeout(2800);
  ok((await picksOf(p)).length === 0, '2. 2.8 s after the click, with Chrome\'s question on the screen, no browser folder window opened over it (0.98 opened it at 2.5 s)');
  ok(await waitWin(p, 3500), '2. the page\'s own window opens at 4 s');
  const win2 = await askWin(p);
  ok(win2 && /look out of date/.test(win2.title) && /New Business: waiting for your answer/.test(win2.text), '2. (1.0) the first answer never came, so the window says the links look out of date, and the folder is shown as asked ("waiting for your answer"), not as "checking"');
  const listed2 = await waitList(p, 6000);
  ok(listed2 && Date.now() - t0 < 9000, '2. the list opens by itself when Allow is clicked (' + (Date.now() - t0) + ' ms), the question window is gone, and the folder window never opened (' + (await picksOf(p)).length + ' times)');
  ok((await picksOf(p)).length === 0 && (await p.evaluate(() => document.querySelectorAll('dialog[data-ask]').length)) === 0, '2. no browser window and no leftover question window');
  await p.close();

  /* ---- 2b. Chrome answers "not yet" and the adviser takes 5 seconds: the window says Chrome has been asked and where to look (the three buttons of 0.99) ---- */
  p = await fresh({ NB: { state: 'prompt', answer: 5000 }, CF: { state: 'prompt', answer: 'never' } });
  t0 = Date.now(); await click(p);
  ok(await waitWin(p, 6000), '2b. the page\'s own window opens at 4 s');
  const win2b = await askWin(p);
  ok(win2b && /cannot open your client folders/.test(win2b.title) && /waiting for you/.test(win2b.text) && /Edit files\?/.test(win2b.text) && win2b.buttons.join('|') === 'Stop|Ask Chrome again|Choose the client’s folder myself', '2b. Chrome has been asked: it says so and where to look, and offers Stop, Ask Chrome again and Choose the client\'s folder myself');
  ok(await waitList(p, 6000) && (await picksOf(p)).length === 0, '2b. the list opens by itself when Allow is clicked and the folder window never opened');
  await p.close();

  /* ---- 3. a folder chosen by hand is checked against the client ---- */
  p = await fresh(SILENT);
  await p.evaluate(async () => { const root = await navigator.storage.getDirectory(); const nb = await root.getDirectoryHandle('NB'); window.__pickNext = await nb.getDirectoryHandle('Other, Olive'); });
  await click(p); await waitWin(p, 8000);
  await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself'); await p.waitForTimeout(600);
  const wrong = await askWin(p);
  ok(wrong && /another client/.test(wrong.title) && /Other, Olive/.test(wrong.text) && /View, Vera/.test(wrong.text) && /Nothing was loaded/.test(wrong.text), '3. another client\'s folder is refused and says whose folder it is and whose overview this is');
  ok(!(await waitList(p, 600)) && wrong && wrong.buttons.join('|') === 'Cancel|Choose again', '3. no list was opened, and there are two buttons: Cancel and Choose again');
  await p.screenshot({ path: out + '/r10-wrong.png' });
  await vera(p); await p.click('dialog[data-ask][open] >> text=Choose again');
  ok(await waitList(p, 6000) && (await picksOf(p)).length === 2 && (await picksOf(p))[1].active === true, '3. Choose again opens the folder window with a fresh click, and the client\'s own folder goes straight to the list');
  await p.close();
  p = await fresh(SILENT);
  await p.evaluate(async () => { const root = await navigator.storage.getDirectory(); const nb = await root.getDirectoryHandle('NB'); window.__pickNext = await nb.getDirectoryHandle('Other, Olive'); });
  await click(p); await waitWin(p, 8000); await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself'); await p.waitForTimeout(600);
  await p.click('dialog[data-ask][open] >> text=Cancel'); await p.waitForTimeout(400);
  ok(await barsWaiting(p) === 0 && !(await waitList(p, 300)), '3. Cancel releases every block and loads nothing');
  await p.close();
  p = await fresh(SILENT);
  await p.evaluate(async () => { const root = await navigator.storage.getDirectory(); const nb = await root.getDirectoryHandle('NB'); window.__pickNext = await nb.getDirectoryHandle('View Family'); });
  await click(p); await waitWin(p, 8000); await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself'); await p.waitForTimeout(600);
  const sub = await askWin(p);
  ok(sub && /Is this the client/.test(sub.title) && /View Family/.test(sub.text) && sub.buttons.join('|') === 'Cancel|Choose again|Load them anyway', '3. a folder whose name is not a client\'s name (View Family) is asked about, with Load them anyway');
  await p.click('dialog[data-ask][open] >> text=Load them anyway');
  ok(await waitList(p, 4000) && /Documents in View Family/.test(await p.evaluate(() => document.querySelector('dialog.fdlg[open] h3').textContent)), '3. Load them anyway lists that folder\'s documents (a client folder with an unusual name still works)');
  await p.close();

  /* ---- 4. Stop opens the normal file window with the click; Ask Chrome again starts a fresh search ---- */
  p = await fresh(SILENT);
  await click(p); await waitWin(p, 8000);
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }).then(() => true, () => false), p.click('dialog[data-ask][open] >> text=Stop')]);
  ok(fc, '4. Stop opens the normal file window at once (the button\'s click is behind it)');
  ok(await barsWaiting(p) === 0, '4. and every block is released');
  await p.close();
  p = await fresh({ NB: { state: 'prompt', answer: 'never' }, CF: { state: 'prompt', answer: 'never' } });
  await click(p); await waitWin(p, 8000);
  await p.evaluate(() => { window.__perm = { NB: { state: 'granted' }, CF: { state: 'granted' } }; });
  await p.click('dialog[data-ask][open] >> text=Ask Chrome again');
  ok(await waitList(p, 5000), '4. Ask Chrome again, once Chrome answers, opens the list');
  await p.close();

  /* ---- 5. permission given: the list opens at once, no window of any kind ---- */
  p = await fresh({ NB: { state: 'granted' }, CF: { state: 'granted' } });
  t0 = Date.now(); await click(p);
  ok(await waitList(p, 3000) && (await picksOf(p)).length === 0 && (await p.evaluate(() => document.querySelectorAll('dialog[data-ask]').length)) === 0, '5. permission given: the list opens at once (' + (Date.now() - t0) + ' ms), no folder window and no question window');
  await p.close();

  /* ---- 6. the overview has no client name yet: the window names no folder, and Choose myself says so instead of refusing every folder ---- */
  const NONAME = JSON.parse(JSON.stringify(FFJ)); NONAME.f.fname = v(''); NONAME.f.sname = v('');
  p = await fresh(SILENT, null, NONAME);
  await click(p); await waitWin(p, 8000);
  const w6 = await askWin(p);
  ok(w6 && !/looking for the folder named/.test(w6.text) && !/, \./.test(w6.text), '6. with no client name the window does not claim to look for a folder named ", "');
  await p.click('dialog[data-ask][open] >> text=Choose the client’s folder myself'); await p.waitForTimeout(500);
  ok(/Fill in the client.s names first/.test(await toastText(p)) && (await picksOf(p)).length === 0 && await barsWaiting(p) === 0, '6. Choose myself says to fill in the names first, opens no folder window and releases every block');
  await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
