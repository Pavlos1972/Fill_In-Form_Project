/* Fact Find 5.2: Save and Save PDF go straight into the client's "2. Fact Find" folder, on the real Fact Find page, over a REAL directory tree made in the browser's private file system (the real folder calls run: listing,
   resolve, creating and removing a file, reading it back). The folder windows and the Save window are stand-ins (the first two hand out that tree; the third records where it was asked to open and what the page said when it did).
   The ONE other stand-in is the browser's storage of the connected folders: this headless Chromium dies when a handle of its private file system is read back out of IndexedDB, so saveHandle / loadHandle keep the handle's
   path in localStorage (shared by the pages of one address, like IndexedDB). Names are invented.
   Covers: the connection made on the Risk Application is reused (nothing to connect again), a client in New Business, in Client Files, under 1. ON HOLD, the client's folder missing (a first meeting), "2. Fact Find" missing,
   no names, the same client in both places (a list), a path that is too long, an existing file (asked), a failed write (the empty file the save created is removed), a loaded Fact Find (Save writes back, the PDF goes beside it),
   Save as (the normal window), and that no folder is ever created. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FFNAME = 'Fact Find (Audio to Text) - 12.11.26 - (Annabel Kuiper).json';
const TREE = {
  NB: {
    'Kuiper, Annabel': { '1. Overview': {}, '2. Fact Find': { [FFNAME]: '{"app":"wr-fact-find","schema":"5.1","f":{},"l":{}}' }, '3. Quotes': {}, 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)': { Applications: {} } },
    '1. ON HOLD': { 'Jansen, Piet': { '1. Overview': {}, '2. Fact Find': {} } },
    '2. Awaiting compliance from client': {},
    'Pienaar, Sarel': { '1. Overview': {}, '3. Quotes': {} },                                   // the client's folder, but no "2. Fact Find" yet
    'Zulu, Zandile': { '2. Fact Find': {} },
    'Failme, Test': { '2. Fact Find': {} },
    'Both, Betty': { '2. Fact Find': {} }
  },
  CF: {
    'V - Files': { 'Van der Merwe, Marlene': { '1. Overview': {}, '2. Fact Find': {} } },
    'B - Files': { 'Both, Betty': { '2. Fact Find': {} } }
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
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(v) {
      fo = v;
      v.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      v.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  });

  /* the Risk Application first: the connection is made THERE */
  const rp = await ctx.newPage(); const rerrs = []; rp.on('pageerror', e => rerrs.push(e.message)); rp.on('dialog', d => d.accept());
  await rp.goto(base + 'short-risk.html'); await rp.waitForTimeout(500);
  const build = () => rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, v] of Object.entries(s)) { if (typeof v === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(v); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), v); } }
    await mk(root, spec); await root.getDirectoryHandle('SaveWindow', { create: true });
  }, TREE);
  const wireOn = pg => pg.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') };
    window.__saveTo = await root.getDirectoryHandle('SaveWindow'); window.__calls = [];
  });
  await build(); await wireOn(rp);
  await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);
  ok(/Folders connected: New Business, Client Files/.test(await rp.evaluate(() => document.querySelector('#meta').innerText)), 'the Risk Application is connected (the connection is made once, there)');

  /* now the Fact Find page, in the same browser profile: nothing is connected again */
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
  await p.goto(base + 'index.html'); await p.waitForTimeout(900); await wireOn(p);
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  const title = () => p.evaluate(() => document.querySelector('#btnFolders').title);
  ok(await p.evaluate(() => !!document.querySelector('#btnFolders') && /Folders/.test(document.querySelector('#btnFolders').textContent)), 'the Fact Find has a Folders… button');
  ok(/Folders connected: New Business, Client Files/.test(await title()), 'the existing connection is reused on the Fact Find: ' + (await title()).slice(0, 110));
  await p.click('#btnFolders'); await p.waitForSelector('dialog.fdlg[open]');
  const d0 = await p.evaluate(() => document.querySelector('dialog.fdlg[open]').innerText.replace(/\s+/g, ' '));
  ok(/Connected: NB/.test(d0) && /Connected: CF/.test(d0) && /Fact Find into the client.s 2\. Fact Find folder/.test(d0), 'Folders… shows both as connected, with the typed paths, and says where a Fact Find goes: ' + d0.slice(0, 200));
  ok(await p.evaluate(() => document.querySelector('dialog.fdlg [data-key="A"] [data-path]').value.endsWith('New Business')), 'the Windows paths typed on the other page are there');
  await p.click('dialog.fdlg [data-done]'); await p.waitForTimeout(200);

  /* ---- helpers on the Fact Find ---- */
  const peek = (parts, kind) => p.evaluate(async ([parts, kind]) => {
    let d = await navigator.storage.getDirectory();
    try { for (let i = 0; i < parts.length - (kind === 'file' ? 1 : 0); i++) d = await d.getDirectoryHandle(parts[i]); if (kind === 'file') { const f = await d.getFileHandle(parts[parts.length - 1]); return await (await f.getFile()).text(); } const n = []; for await (const [k] of d.entries()) n.push(k); return n.sort(); } catch (e) { return null; }
  }, [parts, kind]);
  const names = async parts => (await peek(parts, 'dir')) || [];
  const tree = () => p.evaluate(async () => { const out = []; async function walk(d, pre) { for await (const [n, h] of d.entries()) { out.push(pre + n + (h.kind === 'directory' ? '/' : '')); if (h.kind === 'directory') await walk(h, pre + n + '/'); } } await walk(await navigator.storage.getDirectory(), ''); return out.filter(x => !x.startsWith('SaveWindow/')).sort().join('|'); });
  const client = (f, s) => p.evaluate(([f, s]) => { FF.store.setField(FF.app.state, 'fname', f); FF.store.setField(FF.app.state, 'sname', s); }, [f, s]);
  const clearToast = () => p.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = true; t.textContent = ''; });
  const settle = () => p.waitForFunction(() => document.querySelector('dialog.fdlg[open]') || (document.querySelector('#toast') && !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.trim()), null, { timeout: 9000 });
  const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  const dlg = () => p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); return d ? d.innerText : ''; });
  const press = async sel => { await p.click('dialog.fdlg[open] ' + sel); await p.waitForTimeout(150); };
  const act = async sel => { await clearToast(); await p.click(sel); await settle(); };
  const finish = async () => { await p.waitForFunction(() => !document.querySelector('dialog.fdlg[open]'), null, { timeout: 9000 }); await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim(); }, null, { timeout: 9000 }); };
  const calls = () => p.evaluate(() => window.__calls);
  const base1 = () => p.evaluate(() => FF.store.baseFileName(FF.app.state));
  const pdf1 = () => p.evaluate(() => FF.store.pdfFileName(FF.app.state));
  const fresh = async () => { await p.evaluate(() => document.querySelector('#btnNew').click()); await p.waitForTimeout(300); await wireOn(p); };

  /* ---- 1. a client in New Business with a "2. Fact Find": no question, the file goes there; the old Fact Find is untouched ---- */
  await client('Annabel Maria', 'Kuiper');
  const t0 = await tree();
  await act('#btnSave'); await finish();
  const jn = (await base1()) + '.json', FFDIR = ['NB', 'Kuiper, Annabel', '2. Fact Find'];
  const body = await peek(FFDIR.concat([jn]), 'file');
  ok(body && JSON.parse(body).app === 'wr-fact-find' && JSON.parse(body).f.sname.v === 'Kuiper', 'the Fact Find is in the client\'s 2. Fact Find folder: ' + jn);
  ok(!/Save to this folder|Which folder/.test(await dlg()) && (await calls()).length === 0, 'no question and no Save window (one 2. Fact Find, nothing to choose)');
  ok(/^Saved to Kuiper, Annabel \\ 2\. Fact Find\. Wrong folder\? Use Save as/.test(await toast()), 'the message says where it went: ' + (await toast()).slice(0, 110));
  ok((await peek(FFDIR.concat([FFNAME]), 'file')).includes('wr-fact-find') && (await names(FFDIR)).length === 2, 'the older Fact Find in that folder is untouched');
  ok((await tree()).split('|').filter(x => !t0.split('|').includes(x)).join() === 'NB/Kuiper, Annabel/2. Fact Find/' + jn, 'the only change in the whole tree is that one new file: no folder was created');
  ok(/Last saved in Kuiper, Annabel \\ 2\. Fact Find/.test(await title()), 'the Folders… button remembers where the file went');
  await p.screenshot({ path: out + '/ff-saved-to-folder.png' });

  /* the PDF goes beside the saved file */
  await act('#btnPdf'); await finish();
  const pn = (await pdf1()) + '.pdf', pbody = await peek(FFDIR.concat([pn]), 'file');
  ok(pbody && pbody.startsWith('%PDF-'), 'the PDF is beside the saved Fact Find, and is a PDF: ' + pn);
  ok(/PDF saved and checked/.test(await toast()) && /Saved in Kuiper, Annabel \\ 2\. Fact Find/.test(await toast()) && (await calls()).length === 0, 'the PDF message says checked and where; no window');
  /* a second Save writes straight back to the same file (no search) */
  await client('Annabel Maria', 'Kuiper'); await p.evaluate(() => { FF.store.setField(FF.app.state, 'cell', '082 555 0101'); });
  await act('#btnSave'); await finish();
  ok(/^Saved to Kuiper, Annabel \\ 2\. Fact Find/.test(await toast()) && (await calls()).length === 0 && !(await dlg()) && JSON.parse(await peek(FFDIR.concat([jn]), 'file')).f.cell.v === '082 555 0101', 'a second Save writes straight back to the same file');

  /* ---- 2. a client in Client Files (V - Files) ---- */
  await fresh(); await client('Marlene', 'Van der Merwe');
  await act('#btnSave'); await finish();
  const vn = (await base1()) + '.json';
  ok(JSON.parse(await peek(['CF', 'V - Files', 'Van der Merwe, Marlene', '2. Fact Find', vn], 'file')).app === 'wr-fact-find' && /^Saved to V - Files \\ Van der Merwe, Marlene \\ 2\. Fact Find/.test(await toast()), 'a client in Client Files (V - Files, the letter of the surname as written): ' + (await toast()).slice(0, 90));
  ok((await calls()).length === 0, 'no window');

  /* ---- 3. a client under 1. ON HOLD in New Business ---- */
  await fresh(); await client('Piet', 'Jansen');
  await act('#btnSave'); await finish();
  ok(/^Saved to 1\. ON HOLD \\ Jansen, Piet \\ 2\. Fact Find/.test(await toast()) && (await names(['NB', '1. ON HOLD', 'Jansen, Piet', '2. Fact Find'])).length === 1, 'a client under 1. ON HOLD');

  /* ---- 4. a first meeting: the client's folder is not there yet: the Save window opens in the New Business root, with the reason; no folder is created ---- */
  await fresh(); await client('Nomsa', 'Newcomer');
  const t4 = await tree();
  await act('#btnSave'); await p.waitForTimeout(600);
  const c4 = await calls();
  ok(c4.length === 1 && /No folder named .Newcomer, Nomsa. was found in your connected folders\. Choose where to save instead\./.test(c4[0].toast), 'client folder missing: the reason is shown when the Save window opens: ' + (c4[0] ? c4[0].toast : '').slice(0, 130));
  ok(c4.length === 1 && await p.evaluate(() => { const c = window.__calls[0]; return !!(c.startIn && c.startIn.kind === 'directory' && c.startIn.name === 'NB'); }), 'and it opens in the New Business folder (the deepest folder found)');
  ok(c4.length === 1 && /\.json$/.test(c4[0].name), 'with the usual file name suggested: ' + (c4[0] ? c4[0].name : ''));
  ok((await tree()).replace(/\|SaveWindow.*$/, '') === t4.replace(/\|SaveWindow.*$/, '') || (await tree()).split('|').filter(x => !t4.split('|').includes(x)).every(x => !x.endsWith('/')), 'no folder was created anywhere');

  /* ---- 5. the client's folder is there, "2. Fact Find" is not: the Save window opens in the client's folder, with the reason ---- */
  await fresh(); await client('Sarel', 'Pienaar');
  const t5 = await names(['NB', 'Pienaar, Sarel']);
  await act('#btnSave'); await p.waitForTimeout(600);
  const c5 = await calls();
  ok(c5.length === 1 && /no .2\. Fact Find. folder yet/.test(c5[0].toast) && /never creates a folder/.test(c5[0].toast), 'no 2. Fact Find: the reason is shown: ' + (c5[0] ? c5[0].toast : '').slice(0, 140));
  ok(c5.length === 1 && await p.evaluate(() => { const c = window.__calls[0]; return !!(c.startIn && c.startIn.kind === 'directory' && c.startIn.name === 'Pienaar, Sarel'); }), 'and it opens in the client\'s folder');
  ok((await names(['NB', 'Pienaar, Sarel'])).join() === t5.join(), 'the client\'s folder is as it was: "2. Fact Find" was not made');

  /* ---- 6. no names yet ---- */
  await fresh();
  await act('#btnSave'); await p.waitForTimeout(500);
  const c6 = await calls();
  ok(c6.length === 1 && /Fill in the client.s names first/.test(c6[0].toast), 'no names: the reason, and the Save window: ' + (c6[0] ? c6[0].toast : '').slice(0, 100));

  /* ---- 7. the same client in both places: a list; pick one ---- */
  await fresh(); await client('Betty', 'Both');
  await act('#btnSave');
  const dl7 = await dlg();
  ok(/Which folder\?/.test(dl7) && dl7.includes('Both, Betty \\ 2. Fact Find') && dl7.includes('B - Files \\ Both, Betty \\ 2. Fact Find'), 'in both places: the list: ' + dl7.replace(/\s+/g, ' ').slice(0, 170));
  await p.click('dialog.fdlg[open] input[name="fpick"][value="1"]'); await press('[data-yes]'); await finish();
  ok(/^Saved to B - Files \\ Both, Betty \\ 2\. Fact Find/.test(await toast()) && (await names(['CF', 'B - Files', 'Both, Betty', '2. Fact Find'])).length === 1 && (await names(['NB', 'Both, Betty', '2. Fact Find'])).length === 0, 'saved in the folder that was picked, and only there');
  await fresh(); await client('Betty', 'Both'); await act('#btnSave'); await press('[data-no]'); await p.waitForTimeout(500);
  ok((await calls()).length === 1, '"Choose where to save instead" opens the normal Save window');

  /* ---- 8. a path that is too long: nothing is written ---- */
  await fresh(); await client('Zandile', 'Zulu');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('wr-folders-paths')); o.A = 'C:\\' + 'x'.repeat(190); localStorage.setItem('wr-folders-paths', JSON.stringify(o)); });
  const z0 = await names(['NB', 'Zulu, Zandile', '2. Fact Find']);
  await act('#btnSave'); await p.waitForTimeout(600);
  const c8 = await calls(), t8 = c8[0] ? c8[0].toast : '';
  ok(c8.length === 1 && /characters too long for Windows/.test(t8) && /Nothing was written there/.test(t8) && /longest folder name is \d+/.test(t8), 'a path over the limit is refused with the reason, and the Save window opens: ' + t8.slice(0, 150));
  ok((await names(['NB', 'Zulu, Zandile', '2. Fact Find'])).join() === z0.join(), 'nothing was written into the folder');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('wr-folders-paths')); o.A = 'C:\\Users\\tester\\Company\\New Business'; localStorage.setItem('wr-folders-paths', JSON.stringify(o)); });

  /* ---- 9. a file with that name is already there (and is not the one opened): asked, kept or replaced ---- */
  await fresh(); await client('Zandile', 'Zulu');
  const jn9 = (await base1()) + '.json';
  await p.evaluate(async jn => { const r = await navigator.storage.getDirectory(); const a = await (await (await r.getDirectoryHandle('NB')).getDirectoryHandle('Zulu, Zandile')).getDirectoryHandle('2. Fact Find'); const f = await a.getFileHandle(jn, { create: true }), w = await f.createWritable(); await w.write('OLD CONTENT'); await w.close(); }, jn9);
  await act('#btnSave');
  ok(/Replace the existing file\?/.test(await dlg()), 'an existing file with the same name (not the one opened): asked');
  await press('[data-no]'); await p.waitForTimeout(600);
  ok((await peek(['NB', 'Zulu, Zandile', '2. Fact Find', jn9], 'file')) === 'OLD CONTENT' && (await calls()).length === 1, '"Keep it": the file is untouched and the Save window opens');
  await fresh(); await client('Zandile', 'Zulu'); await act('#btnSave'); await press('[data-yes]'); await finish();
  ok(JSON.parse(await peek(['NB', 'Zulu, Zandile', '2. Fact Find', jn9], 'file')).app === 'wr-fact-find', '"Replace it": the file is replaced');

  /* ---- 10. a failed write: the plain message (5.0), the empty file this save created is removed, a copy is downloaded; a file with content is not removed ---- */
  await p.evaluate(() => { window.__origCW = FileSystemFileHandle.prototype.createWritable; FileSystemFileHandle.prototype.createWritable = function (o) { if (/Failme/.test(this.name)) { const e = new Error('A requested file or directory could not be found at the time an operation was processed.'); e.name = 'NotFoundError'; return window.__origCW.call(this, o).then(w => ({ write: x => w.write(x), close: () => w.abort().then(() => { throw e; }) })); } return window.__origCW.call(this, o); }; });
  await fresh(); await client('Test', 'Failme');
  const f10 = ['NB', 'Failme, Test', '2. Fact Find'];
  await act('#btnSave'); await p.waitForTimeout(900);
  ok(/Windows could not save/.test(await toast()) && /EMPTY/.test(await toast()), 'the write failed: the plain message is shown');
  ok((await names(f10)).length === 0, 'the empty file this save created was removed from the client\'s folder');
  ok(downloads.length >= 1 && /Failme/.test(downloads[downloads.length - 1]), 'and a copy was downloaded: ' + downloads[downloads.length - 1]);
  ok(await p.evaluate(() => /unsaved/.test(document.querySelector('#saveState').textContent)), 'a failed Save counts as unsaved: ' + (await p.evaluate(() => document.querySelector('#saveState').textContent)));
  const fn10 = (await base1()) + '.json';
  await p.evaluate(async ([f10, fn]) => { let d = await navigator.storage.getDirectory(); for (const n of f10) d = await d.getDirectoryHandle(n); const f = await d.getFileHandle(fn, { create: true }); const w = await window.__origCW.call(f); await w.write('KEEP ME'); await w.close(); }, [f10, fn10]);
  await fresh(); await client('Test', 'Failme');
  await act('#btnSave'); await press('[data-yes]'); await p.waitForTimeout(900);
  ok(/Windows could not save/.test(await toast()) && (await peek(f10.concat([fn10]), 'file')) === 'KEEP ME', 'replacing an existing file fails too, and a file that has content is never removed by the clean-up');
  await p.evaluate(() => { FileSystemFileHandle.prototype.createWritable = window.__origCW; });

  /* ---- 11. a loaded Fact Find: Save writes straight back to it, the PDF goes beside it, Save as opens the normal window ---- */
  await fresh();
  const old = await peek(FFDIR.concat([FFNAME]), 'file');
  await p.evaluate(async n => { const r = await navigator.storage.getDirectory(); window.__open = await (await (await (await r.getDirectoryHandle('NB')).getDirectoryHandle('Kuiper, Annabel')).getDirectoryHandle('2. Fact Find')).getFileHandle(n); }, FFNAME);
  await p.click('#btnOpen'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => /Opened/.test(document.querySelector('#toast').textContent)), 'a Fact Find was opened from the client\'s 2. Fact Find folder');
  await client('Annabel', 'Kuiper'); await p.evaluate(() => { FF.store.setField(FF.app.state, 'cell', '082 111 2222'); });
  await act('#btnSave'); await p.waitForTimeout(500);
  const after = await peek(FFDIR.concat([FFNAME]), 'file');
  ok(after !== old && /082 111 2222/.test(after) && (await calls()).length === 0 && !(await dlg()), 'Save writes straight back to the file that was opened (no search, no window)');
  const pn11 = (await pdf1()) + '.pdf';
  await act('#btnPdf'); await finish();
  ok((await peek(FFDIR.concat([pn11]), 'file') || '').startsWith('%PDF-') && /Saved in Kuiper, Annabel \\ 2\. Fact Find/.test(await toast()), 'the PDF goes beside it, in the same 2. Fact Find folder: ' + pn11);
  await clearToast(); await p.click('#btnSaveAs'); await p.waitForTimeout(600);
  ok((await calls()).length === 1 && await p.evaluate(n => window.__calls[0].startIn && window.__calls[0].startIn.kind === 'file' && window.__calls[0].startIn.name === n, FFNAME), 'Save as… opens the normal Save window (started beside the file that was opened, so in that same folder), not the automatic save');

  /* ---- phone width: the Folders… button is still on the screen and the dialog fits ---- */
  await p.setViewportSize({ width: 390, height: 800 });
  const box = await p.evaluate(() => { const r = document.querySelector('#btnFolders').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
  ok(box.l >= 0 && box.r <= box.w + 1 && box.sw <= box.w + 1, 'at 390 wide the Folders… button is on the screen and the page does not scroll sideways ' + JSON.stringify(box));
  await p.click('#btnFolders'); await p.waitForSelector('dialog.fdlg[open]');
  const dbox = await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]').getBoundingClientRect(); return { l: d.left, r: d.right, w: innerWidth }; });
  ok(dbox.l >= 0 && dbox.r <= dbox.w + 1, 'and the dialog fits ' + JSON.stringify(dbox));
  await p.screenshot({ path: out + '/ff-folders-phone.png' }); await press('[data-done]');

  ok(errs.length === 0, 'Fact Find: no page errors ' + errs.join('|'));
  ok(rerrs.length === 0, 'Risk Application: no page errors ' + rerrs.join('|'));
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
