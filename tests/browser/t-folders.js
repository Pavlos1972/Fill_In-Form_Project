/* Saving into the client's Applications folder (Risk Application 1.4, Investment Application 1.3) on the real pages, over a REAL directory tree made in the browser's private file system (so the real folder calls run:
   listing, resolve, creating and removing a file, reading it back). The two folder windows and the Save window are stand-ins (the first two hand out that tree; the third records where it was asked to open).
   Names are invented. Covers: Folders… (connect, paths, remembered after a reload and on the other page), one deal folder, a tie (list), a clear winner (one question), a client under 1. ON HOLD and under V - Files,
   the same client in both places, no deal folder / no Applications / not found / no name (fallback with a reason, the Save window opened in the deepest folder), a path that is too long (nothing written),
   an existing file (asked), a failed write (the empty file the save created is removed, a file with content is not), the PDF beside the saved file, a loaded Fact Find, and the Investment Application. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'short-risk.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const BR = 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', OMRA = 'Kuiper, Annabel - (OM - Optimal RA - Recurring - R 2,800.00 p.m.)';
const FFJSON = JSON.stringify({ app: 'wr-fact-find', schema: '5.1', f: { fname: { v: 'Annabel Maria', st: 'confirmed' }, sname: { v: 'Kuiper', st: 'confirmed' }, cell: { v: '082 555 0101', st: 'confirmed' } }, l: {} });
const TREE = {
  NB: {
    'Kuiper, Annabel': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 12.11.26 - (Annabel Kuiper).json': FFJSON }, 'Kuiper, Annabel': { Applications: {} }, [BR]: { Applications: {} }, [OMRA]: { Applications: {} } },
    '1. ON HOLD': { 'Jansen, Piet': { 'Jansen, Piet - (OM - Personal - R 900.00 p.m.)': { Applications: {} } } },
    '2. Awaiting compliance from client': {},
    'Zulu, Zandile': { 'Zulu, Zandile - (BR - Personal - R 2,000.00 p.m.)': { Applications: {} }, 'Zulu, Zandile - (BR - Personal - R 3,000.00 p.m.)': { Applications: {} } },
    'Dlamini, Thandi': { '1. Overview': {}, 'Dlamini, Thandi - (BR - Personal)': { Notes: {} } },
    'Failme, Test': { 'Failme, Test - (OM - Personal - R 500.00 p.m.)': { Applications: {} } },
    'Pienaar, Sarel': { 'Pienaar, Sarel - (BR - Personal)': { Applications: {} } }
  },
  CF: {
    'K - Files': { 'Kuiper, Annabel': { '1. Overview': {}, 'Kuiper, Annabel - (OM - Optimal RA - Recurring)': {} } },
    'V - Files': { 'Van der Merwe, Marlene': { 'Van der Merwe, Marlene - (OM - Personal - R 1,200.00 p.m.)': { Applications: {} } }, 'Van der Merwe, Andries': { 'x': { Applications: {} } } },
    'Pienaar, Sarel': { 'Pienaar, Sarel - (BR - Personal)': { Applications: {} } }
  }
};

srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    window.__calls = []; window.__saveTo = null; window.__open = null;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    window.showSaveFilePicker = async o => { const tt = document.querySelector('#toast'); window.__calls.push({ name: o.suggestedName, startIn: o.startIn || null, toast: tt && !tt.hidden ? tt.textContent : '' }); if (!window.__saveTo) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return window.__saveTo.getFileHandle(o.suggestedName, { create: true }); };
    window.showOpenFilePicker = async () => [window.__open];
    /* THE ONE STAND-IN FOR THE BROWSER'S OWN STORAGE: the page keeps a connected folder's handle in IndexedDB (folders.js saveHandle / loadHandle). This headless Chromium dies when a handle of its private file system is READ
       BACK out of IndexedDB (strings read fine; checked in isolation), so here the two functions keep the handle's PATH in localStorage and walk it again, which survives a reload and is shared with the other page just as
       IndexedDB is. Everything else in folders.js and folders-ui.js is the real code. What this cannot show: the real IndexedDB round trip of a handle from showDirectoryPicker (a normal Chrome feature, not tried here). */
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(v) {
      fo = v;
      v.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      v.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
  await p.goto(base); await p.waitForTimeout(500);

  /* the real tree, in the browser's private file system, and the stand-ins pointed at it */
  const build = () => p.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, v] of Object.entries(s)) { if (typeof v === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(v); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), v); } }
    await mk(root, spec); await root.getDirectoryHandle('SaveWindow', { create: true });
  }, TREE);
  const wire = () => p.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') };
    window.__saveTo = await root.getDirectoryHandle('SaveWindow'); window.__calls = [];
  });
  /* what is in the tree: a file's text, whether it exists, the names in a folder */
  const peek = (parts, kind) => p.evaluate(async ([parts, kind]) => {
    let d = await navigator.storage.getDirectory();
    try { for (let i = 0; i < parts.length - (kind === 'file' ? 1 : 0); i++) d = await d.getDirectoryHandle(parts[i]); if (kind === 'file') { const f = await d.getFileHandle(parts[parts.length - 1]); return await (await f.getFile()).text(); } const n = []; for await (const [k] of d.entries()) n.push(k); return n.sort(); } catch (e) { return null; }
  }, [parts, kind]);
  const names = async parts => (await peek(parts, 'dir')) || [];
  const set = (ns, id, v) => p.evaluate(([ns, id, v]) => window[ns].store.setField(window[ns].app.state, id, v), [ns, id, v]);
  const client = async (ns, f, s) => { await set(ns, 'fname', f); await set(ns, 'sname', s); };
  const clearToast = () => p.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = true; t.textContent = ''; });
  const settle = () => p.waitForFunction(() => document.querySelector('dialog.fdlg[open]') || (document.querySelector('#toast') && !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.trim()), null, { timeout: 9000 });
  const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  const dlg = () => p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); return d ? d.innerText : ''; });
  const press = async sel => { await p.click('dialog.fdlg[open] ' + sel); await p.waitForTimeout(150); };
  const act = async sel => { await clearToast(); await p.click(sel); await settle(); };           // click Save / Save PDF, wait for a dialog or the message
  const finish = async () => { await p.waitForFunction(() => !document.querySelector('dialog.fdlg[open]'), null, { timeout: 9000 }); await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim(); }, null, { timeout: 9000 }); };
  const calls = () => p.evaluate(() => window.__calls);
  const fresh = async () => { await p.evaluate(() => document.querySelector('#btnNew').click()); await p.waitForTimeout(250); await wire(); };

  await build(); await wire();

  /* ---- Folders…: connect both, type the two paths ---- */
  ok(/Folders not connected/.test(await p.evaluate(() => document.querySelector('#meta').innerText)), 'before anything: the card says the folders are not connected');
  await p.click('#btnFolders'); await p.waitForSelector('dialog.fdlg[open]');
  ok(/Connect your client folders/.test(await dlg()) && /New Business/.test(await dlg()) && /Client Files/.test(await dlg()), 'Folders… opens the dialog for the two folders');
  ok(/Not connected/.test(await dlg()) && /Not typed yet/.test(await dlg()), 'both start not connected, no path typed');
  await p.click('dialog.fdlg [data-key="A"] [data-pick]'); await p.waitForTimeout(250); await p.click('dialog.fdlg [data-key="B"] [data-pick]'); await p.waitForTimeout(250);
  await p.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await p.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  ok(/Connected: NB/.test(await dlg()) && /Connected: CF/.test(await dlg()), 'both are connected: ' + (await dlg()).replace(/\s+/g, ' ').slice(0, 260));
  ok(/36 characters/.test(await dlg()) || /\d+ characters\./.test(await dlg()), 'the length of each typed path is shown');
  await p.screenshot({ path: out + '/folders-dialog.png' });
  await press('[data-done]');
  ok(/Folders connected: New Business, Client Files/.test(await p.evaluate(() => document.querySelector('#meta').innerText)), 'the card now says which are connected');

  /* ---- they are remembered: a reload, and the other page ---- */
  await p.reload(); await p.waitForTimeout(600); await wire();
  ok(/Folders connected: New Business, Client Files/.test(await p.evaluate(() => document.querySelector('#meta').innerText)), 'after a reload they are still connected');
  const paths = await p.evaluate(() => JSON.parse(localStorage.getItem('wr-folders-paths') || '{}'));
  ok(paths.A === 'C:\\Users\\tester\\Company\\New Business' && paths.B.endsWith('Client Files'), 'the typed paths are kept in this browser');

  /* ---- 1. Annabel Kuiper: three deal folders, one clear winner (BR + Personal + premium), one question; then the PDF beside the file ---- */
  await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2507.64'); await client('SR', 'Annabel Maria', 'Kuiper');
  await act('#btnSave');
  ok(/Save to this folder\?/.test(await dlg()) && (await dlg()).includes(BR), 'a clear winner among several is confirmed once: ' + (await dlg()).replace(/\s+/g, ' ').slice(0, 160));
  await press('[data-yes]'); await finish();
  const jname = await p.evaluate(() => SR.store.baseFileName(SR.app.state) + '.json');
  const body = await peek(['NB', 'Kuiper, Annabel', BR, 'Applications', jname], 'file');
  ok(body && JSON.parse(body).app === 'wr-short-risk' && JSON.parse(body).f.sname.v === 'Kuiper', 'the saved file is in the BrightRock deal folder\'s Applications folder: ' + jname);
  ok(/^Saved to Kuiper, Annabel \\ Kuiper, Annabel - \(BR - Personal - R 2,507\.64 p\.m\.\) \\ Applications\./.test(await toast()), 'the message says where it went: ' + (await toast()).slice(0, 150));
  ok((await names(['NB', 'Kuiper, Annabel', OMRA, 'Applications'])).length === 0 && (await names(['NB', 'Kuiper, Annabel', 'Kuiper, Annabel', 'Applications'])).length === 0, 'nothing went into the other deal folders');
  ok((await calls()).length === 0, 'no Save window was opened');
  ok(/Saved in .*Applications/.test(await p.evaluate(() => document.querySelector('#meta').innerText)), 'the card says where the file is');
  await act('#btnPdf'); await finish();
  const pdfName = await p.evaluate(() => SR.store.pdfFileName(SR.app.state) + '.pdf');
  const pdf = await peek(['NB', 'Kuiper, Annabel', BR, 'Applications', pdfName], 'file');
  ok(pdf && pdf.startsWith('%PDF-'), 'the PDF is beside the saved file, and is a PDF: ' + pdfName);
  ok(/PDF saved and checked/.test(await toast()) && (await calls()).length === 0 && !(await dlg()), 'the PDF needed no question and no window');
  await set('SR', 'premium', '2600'); await act('#btnSave'); await finish();
  ok(/Saved to /.test(await toast()) && !(await dlg()) && (await calls()).length === 0, 'a second Save writes straight back to the same file');

  /* ---- 2. a tie: the list; the adviser picks ---- */
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2500'); await client('SR', 'Zandile', 'Zulu');
  await act('#btnSave');
  ok(/Which folder\?/.test(await dlg()) && (await dlg()).includes('R 2,000.00') && (await dlg()).includes('R 3,000.00'), 'two folders that fit equally: the list is shown');
  await p.screenshot({ path: out + '/folders-which.png' });
  await p.click('dialog.fdlg[open] input[value="1"]'); await press('[data-yes]'); await finish();
  ok(/R 3,000\.00/.test(await toast()) || /R 2,000\.00/.test(await toast()), 'saved in the folder that was picked: ' + (await toast()).slice(0, 110));
  const zn = await p.evaluate(() => SR.store.baseFileName(SR.app.state) + '.json');
  const inA = await peek(['NB', 'Zulu, Zandile', 'Zulu, Zandile - (BR - Personal - R 2,000.00 p.m.)', 'Applications', zn], 'file'), inB = await peek(['NB', 'Zulu, Zandile', 'Zulu, Zandile - (BR - Personal - R 3,000.00 p.m.)', 'Applications', zn], 'file');
  ok((inA === null) !== (inB === null), 'in exactly one of the two');
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2500'); await client('SR', 'Zandile', 'Zulu');
  await act('#btnSave'); await press('[data-no]'); await p.waitForTimeout(400);
  ok((await calls()).length === 1, '"Choose where to save instead" opens the normal Save window');

  /* ---- 3. a client under 1. ON HOLD, one folder, no question ---- */
  await fresh(); await set('SR', 'insurer', 'Old Mutual'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '900'); await client('SR', 'Piet', 'Jansen');
  await act('#btnSave'); await finish();
  ok(/^Saved to 1\. ON HOLD \\ Jansen, Piet \\ /.test(await toast()) && (await calls()).length === 0, 'a client under 1. ON HOLD is found, one folder, no question');

  /* ---- 4. a client in Client Files under V - Files (the letter as written), the right Van der Merwe ---- */
  await fresh(); await set('SR', 'insurer', 'Old Mutual'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '1200'); await client('SR', 'Marlene', 'Van der Merwe');
  await act('#btnSave'); await finish();
  ok(/^Saved to V - Files \\ Van der Merwe, Marlene \\ /.test(await toast()) && (await calls()).length === 0, 'V - Files \\ Van der Merwe, Marlene (not Anton)');

  /* ---- 5. the same client in both places: only New Business has a deal folder with Applications that matches ---- */
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2507.64'); await client('SR', 'Annabel', 'Kuiper');
  await act('#btnSave'); await press('[data-yes]'); await finish();
  ok(/^Saved to Kuiper, Annabel \\ /.test(await toast()) && !/K - Files/.test(await toast()), 'Client Files has the history only (no Applications folder): New Business wins');
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '300'); await client('SR', 'Sarel', 'Pienaar');
  await act('#btnSave');
  ok(/Which folder\?/.test(await dlg()) && (await dlg()).includes('Pienaar, Sarel'), 'the same client with the same deal in both places: the list');
  await press('[data-no]'); await p.waitForTimeout(300);

  /* ---- 6. fallbacks, each with a reason and the Save window opened in the deepest folder found ---- */
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await client('SR', 'Thandi', 'Dlamini');
  await act('#btnSave'); await p.waitForTimeout(500);
  const c1 = await calls();
  ok(c1.length === 1 && /no deal folder with an Applications folder/.test(c1[0].toast), 'no Applications folder: the reason is shown when the Save window opens: ' + (c1[0] ? c1[0].toast : '').slice(0, 140));
  ok(c1.length === 1 && await p.evaluate(async () => { const c = window.__calls[0]; return !!(c.startIn && c.startIn.kind === 'directory' && c.startIn.name === 'Dlamini, Thandi'); }), 'the Save window opened in the client\'s folder');
  ok(!(await names(['NB', 'Dlamini, Thandi'])).includes('Applications') && (await names(['NB', 'Dlamini, Thandi', 'Dlamini, Thandi - (BR - Personal)'])).join() === 'Notes', 'no folder was created anywhere');
  await fresh(); await client('SR', 'Nobody', 'Here'); await act('#btnSave'); await p.waitForTimeout(500);
  const c2 = await calls(); ok(c2.length === 1 && /No folder named .Here, Nobody. was found/.test(c2[0].toast), 'a client who is not there: the reason, and the Save window: ' + (c2[0] ? c2[0].toast : '').slice(0, 140));
  await fresh(); await client('SR', '', ''); await act('#btnSave'); await p.waitForTimeout(500);
  const c3 = await calls(); ok(c3.length === 1 && /Fill in the client.s names first/.test(c3[0].toast), 'no name filled in: the reason, and the Save window: ' + (c3[0] ? c3[0].toast : '').slice(0, 140));

  /* ---- 7. the Windows path limit: nothing is written ---- */
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2507.64'); await client('SR', 'Annabel', 'Kuiper');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('wr-folders-paths')); o.A = 'C:\\' + 'x'.repeat(140); localStorage.setItem('wr-folders-paths', JSON.stringify(o)); });
  const before7 = (await names(['NB', 'Kuiper, Annabel', BR, 'Applications'])).join('|');            // the same client was saved here in section 5: compare before and after, not the name
  await act('#btnSave'); await p.waitForTimeout(600);
  const c4 = await calls(); const t4 = c4[0] ? c4[0].toast : '';
  ok(c4.length === 1, 'the Save window opened instead');
  ok(/characters too long for Windows/.test(t4) && /Nothing was written there/.test(t4), 'a path over the limit is refused with the reason: ' + t4.slice(0, 170));
  ok(/longest folder name is \d+/.test(t4), 'and it names the longest folder');
  ok((await names(['NB', 'Kuiper, Annabel', BR, 'Applications'])).join('|') === before7, 'no file was written into the folder (its contents are as before)');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('wr-folders-paths')); o.A = 'C:\\Users\\tester\\Company\\New Business'; localStorage.setItem('wr-folders-paths', JSON.stringify(o)); });

  /* ---- 8. a file with that name is already there: asked, and kept or replaced ---- */
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2507.64'); await client('SR', 'Annabel', 'Kuiper');
  const jn8 = await p.evaluate(() => SR.store.baseFileName(SR.app.state) + '.json');
  await p.evaluate(async ([BR, jn]) => { const r = await navigator.storage.getDirectory(); const a = await (await (await (await r.getDirectoryHandle('NB')).getDirectoryHandle('Kuiper, Annabel')).getDirectoryHandle(BR)).getDirectoryHandle('Applications'); const f = await a.getFileHandle(jn, { create: true }), w = await f.createWritable(); await w.write('OLD CONTENT'); await w.close(); }, [BR, jn8]);
  await act('#btnSave');
  if (/Save to this folder\?/.test(await dlg())) { await press('[data-yes]'); await p.waitForTimeout(200); }
  ok(/Replace the existing file\?/.test(await dlg()), 'an existing file with the same name (not the one opened): asked');
  await press('[data-no]'); await p.waitForTimeout(600);
  ok((await peek(['NB', 'Kuiper, Annabel', BR, 'Applications', jn8], 'file')) === 'OLD CONTENT' && (await calls()).length === 1, '"Keep it": the file is untouched and the Save window opens');
  await fresh(); await set('SR', 'insurer', 'Brightrock'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '2507.64'); await client('SR', 'Annabel', 'Kuiper');
  await act('#btnSave');
  if (/Save to this folder\?/.test(await dlg())) { await press('[data-yes]'); await p.waitForTimeout(200); }
  await press('[data-yes]'); await finish();
  ok(JSON.parse(await peek(['NB', 'Kuiper, Annabel', BR, 'Applications', jn8], 'file')).app === 'wr-short-risk', '"Replace it": the file is replaced');

  /* ---- 9. a failed write: an empty file this save created is removed; a file with content is not ---- */
  await p.evaluate(() => { window.__origCW = FileSystemFileHandle.prototype.createWritable; FileSystemFileHandle.prototype.createWritable = function (o) { if (/Failme/.test(this.name)) { const e = new Error('A requested file or directory could not be found at the time an operation was processed.'); e.name = 'NotFoundError'; return Promise.reject(e); } return window.__origCW.call(this, o); }; });
  await fresh(); await set('SR', 'insurer', 'Old Mutual'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '500'); await client('SR', 'Test', 'Failme');
  const fdeal = ['NB', 'Failme, Test', 'Failme, Test - (OM - Personal - R 500.00 p.m.)', 'Applications'];
  await act('#btnSave'); await p.waitForTimeout(900);
  ok(/Windows could not save/.test(await toast()) && /EMPTY/.test(await toast()), 'the write failed: the plain message (5.0) is shown');
  ok((await names(fdeal)).length === 0, 'the empty file this save created was removed from the client\'s folder');
  ok(downloads.length >= 1 && /Failme/.test(downloads[downloads.length - 1]), 'and a copy was downloaded: ' + downloads[downloads.length - 1]);
  const fn9 = await p.evaluate(() => SR.store.baseFileName(SR.app.state) + '.json');
  await p.evaluate(async ([fdeal, fn]) => { let d = await navigator.storage.getDirectory(); for (const n of fdeal) d = await d.getDirectoryHandle(n); const f = await d.getFileHandle(fn, { create: true }); const w = await window.__origCW.call(f); await w.write('KEEP ME'); await w.close(); }, [fdeal, fn9]);
  await fresh(); await set('SR', 'insurer', 'Old Mutual'); await set('SR', 'product', 'Personal Covers'); await set('SR', 'premium', '500'); await client('SR', 'Test', 'Failme');
  await act('#btnSave'); await press('[data-yes]'); await p.waitForTimeout(900);
  ok(/Windows could not save/.test(await toast()), 'replacing an existing file fails too: the same message');
  ok((await peek(fdeal.concat([fn9]), 'file')) === 'KEEP ME', 'a file that has content is never removed by the clean-up');
  await p.evaluate(() => { FileSystemFileHandle.prototype.createWritable = window.__origCW; });

  /* ---- 10. a loaded Fact Find inside a connected folder gives the client's folder ---- */
  await p.reload(); await p.waitForTimeout(600); await wire();
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');                                   // the failed saves above left an unsaved draft: start a new application
  await p.evaluate(async () => { const r = await navigator.storage.getDirectory(); window.__open = await (await (await (await r.getDirectoryHandle('NB')).getDirectoryHandle('Kuiper, Annabel')).getDirectoryHandle('2. Fact Find')).getFileHandle('Fact Find (Audio to Text) - 12.11.26 - (Annabel Kuiper).json'); });
  await p.click('#btnLoad'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => SR.app.state.f.fname.v === 'Annabel Maria' && SR.app.state.f.sname.v === 'Kuiper'), 'Load from Fact Find filled the names (Annabel Maria Kuiper)');
  await set('SR', 'insurer', 'Old Mutual'); await set('SR', 'product', 'Other'); await set('SR', 'other', 'Optimal RA'); await set('SR', 'premium', '2800');
  const viaHint = await p.evaluate(async () => { const r = await navigator.storage.getDirectory(), NB = await r.getDirectoryHandle('NB'); const x = await FF.folders.clientFromFile({ A: { handle: NB, path: '' } }, window.__open, 'Kuiper', 'Annabel Maria'); return x.map(c => c.parts.join('/')); });
  ok(viaHint.join() === 'Kuiper, Annabel', 'the Fact Find\'s own place gives the client\'s folder exactly: ' + viaHint.join());
  await act('#btnSave');
  if (/Save to this folder\?/.test(await dlg())) { ok((await dlg()).includes('OM - Optimal RA - Recurring'), 'the Optimal RA deal folder wins (OM, the product words, the amount)'); await press('[data-yes]'); }
  await finish();
  ok(/^Saved to Kuiper, Annabel \\ Kuiper, Annabel - \(OM - Optimal RA/.test(await toast()), 'saved in it: ' + (await toast()).slice(0, 120));

  /* ---- 11. the Investment Application: shares the connected folders, matches the provider and the kind ---- */
  const cp = await ctx.newPage(); const cerrs = []; cp.on('pageerror', e => cerrs.push(e.message)); cp.on('dialog', d => d.accept());
  await cp.goto(base + 'capture-sheet.html'); await cp.waitForTimeout(700);
  await cp.evaluate(async () => { const r = await navigator.storage.getDirectory(); window.__saveTo = await r.getDirectoryHandle('SaveWindow'); window.__calls = []; });
  ok(/Folders connected: New Business, Client Files/.test(await cp.evaluate(() => document.querySelector('#meta').innerText)), 'the Investment Application sees the same connected folders (nothing to connect again)');
  const cset = (id, v) => cp.evaluate(([id, v]) => CS.store.setField(CS.app.state, id, v), [id, v]);
  await cset('fname', 'Annabel'); await cset('sname', 'Kuiper'); await cset('provider', 'Old Mutual'); await cset('product', 'Retirement Annuity'); await cset('product_name', 'OM Optimal RA - Recurring'); await cset('contrib_type', 'Recurring (monthly)'); await cset('amount', '2800');
  await cp.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = true; t.textContent = ''; });
  await cp.click('#btnSave'); await cp.waitForFunction(() => document.querySelector('dialog.fdlg[open]') || (document.querySelector('#toast') && !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.trim()), null, { timeout: 9000 });
  if (await cp.evaluate(() => !!document.querySelector('dialog.fdlg[open]'))) { ok(/Save to this folder\?/.test(await cp.evaluate(() => document.querySelector('dialog.fdlg[open]').innerText)) && (await cp.evaluate(() => document.querySelector('dialog.fdlg[open]').innerText)).includes('OM - Optimal RA - Recurring'), 'the Optimal RA deal folder is the clear winner (provider, product, Recurring and the amount)'); await cp.click('dialog.fdlg[open] [data-yes]'); }
  await cp.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && /Saved/.test(t.textContent); }, null, { timeout: 9000 });
  const cname = await cp.evaluate(() => CS.store.baseFileName(CS.app.state) + '.json');
  const cbody = await peek(['NB', 'Kuiper, Annabel', OMRA, 'Applications', cname], 'file');
  ok(cbody && JSON.parse(cbody).app === 'wr-capture-sheet', 'the Investment Application\'s file is in the OM Optimal RA deal folder: ' + cname);

  /* ---- phone width: the dialogs fit ---- */
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#btnFolders'); await p.waitForSelector('dialog.fdlg[open]');
  const box = await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]').getBoundingClientRect(); return { l: d.left, r: d.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
  ok(box.l >= 0 && box.r <= box.w + 1 && box.sw <= box.w + 1, 'at 390 wide the Folders… dialog fits the screen ' + JSON.stringify(box));
  await p.screenshot({ path: out + '/folders-dialog-phone.png' }); await press('[data-done]');

  ok(errs.length === 0, 'Risk Application: no page errors ' + errs.join('|'));
  ok(cerrs.length === 0, 'Investment Application: no page errors ' + cerrs.join('|'));
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
