/* Client Overview (stage 3): Save and Save PDF go straight into the client's `1. Overview\<year>` folder, on the real Overview page, over a REAL directory tree made in the browser's private file system (the real folder
   calls run: listing, resolve, creating folders and files, reading them back). The folder windows and the Save window are stand-ins (as in t-folders-ff.js, which says why the connection is stored the way it is here).
   This is the ONE place a page makes folders (Paul, 21 November): `1. Overview` and the year folder, only inside a client folder that exists. Covered: a client with `1. Overview` but no year (the year is made), a client
   with no `1. Overview` (both are made), a year that exists (reused, an older file untouched), the PDF beside the saved file, an existing file of the same name (asked), a client with no folder (the normal Save window,
   nothing made), the same client in both places (a list, nothing made until one is picked), a path that is too long (nothing made), and that nothing else in the whole tree ever changes. Names are invented. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const TREE = {
  NB: {
    'Client, Test': { '1. Overview': {}, '2. Fact Find': {} },                                  // has 1. Overview, no year folder yet
    'Fresh, Frank': { '2. Fact Find': {} },                                                      // has no 1. Overview at all
    'Done, Dora': { '1. Overview': { '2027': { 'WR Overview - 01.01.27 - (Done, Dora).json': '{"app":"wr-overview","old":true}' } } },   // has 1. Overview and its year, with an older file in it
    'Both, Betty': { '1. Overview': {} },
    'Docs, Dina': { '1. Overview': {}, '3. Quotes': { 'ignored.pdf': 'x' }, '6. Policy Schedules': { 'Test Insurer PS - 123456789.pdf': '%PDF-1.4 a', 'Test Group FundsAtWork Schedule - 28.09.26.pdf': '%PDF-1.4 b', 'readme.txt': 'x' },
      '5. Astute': { '2025': { 'Astute - 20.11.25.pdf': '%PDF-1.4 old' }, '2026': { 'Astute - 20.11.26.pdf': '%PDF-1.4 c' } },
      'Docs, Dina - (Risk Covers)': { 'Comparative Quotes': { 'BR FNA - 100000011 - R2900.00 - 19.11.26.pdf': '%PDF-1.4 d', 'BR CMPO - 100000011.pdf': '%PDF-1.4 e', 'scan0001.pdf': '%PDF-1.4 f' } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {}
  },
  CF: { 'B - Files': { 'Both, Betty': { '1. Overview': { '2027': {} } } } }
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
  /* the Client Overview, in the same browser profile: nothing is connected again */
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(base + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); await p.evaluate(() => OV.app.openAll());
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  ok(/Folders connected: New Business, Client Files/.test(await p.evaluate(() => document.querySelector('#meta').innerText)), 'the Overview reuses the connection made on the Risk Application');
  ok(await p.evaluate(() => !!document.querySelector('#btnFolders') && !!document.querySelector('#btnPdf') && !!document.querySelector('#btnPreview')), 'the Overview has Folders…, Preview PDF and Save PDF');

  const peek = (parts, kind) => p.evaluate(async ([parts, kind]) => {
    let d = await navigator.storage.getDirectory();
    try { for (let i = 0; i < parts.length - (kind === 'file' ? 1 : 0); i++) d = await d.getDirectoryHandle(parts[i]); if (kind === 'file') { const f = await d.getFileHandle(parts[parts.length - 1]); return await (await f.getFile()).text(); } const n = []; for await (const [k] of d.entries()) n.push(k); return n.sort(); } catch (e) { return null; }
  }, [parts, kind]);
  const tree = () => p.evaluate(async () => { const out = []; async function walk(d, pre) { for await (const [n, h] of d.entries()) { out.push(pre + n + (h.kind === 'directory' ? '/' : '')); if (h.kind === 'directory') await walk(h, pre + n + '/'); } } await walk(await navigator.storage.getDirectory(), ''); return out.filter(x => !/^SaveWindow/.test(x)).sort(); });
  const diff = (a, b) => b.filter(x => !a.includes(x)).concat(a.filter(x => !b.includes(x)).map(x => '-' + x));
  const client = (f, s, d) => p.evaluate(([f, s, d]) => { const h = OV.app.state.header; h.fname = f; h.sname = s; h.overviewDate = d; }, [f, s, d]);
  const clearToast = () => p.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = true; t.textContent = ''; });
  const settle = () => p.waitForFunction(() => document.querySelector('dialog.fdlg[open]') || (document.querySelector('#toast') && !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.trim()), null, { timeout: 9000 });
  const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  const dlg = () => p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); return d ? d.innerText : ''; });
  const act = async sel => { await clearToast(); await p.click(sel); await settle(); };
  const press = async sel => { await p.click('dialog.fdlg[open] ' + sel); await p.waitForTimeout(150); };
  const finish = async () => { await p.waitForFunction(() => !document.querySelector('dialog.fdlg[open]'), null, { timeout: 9000 }); await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim(); }, null, { timeout: 9000 }); };
  const calls = () => p.evaluate(() => window.__calls);
  const base1 = () => p.evaluate(() => OV.store.fileName(OV.app.state));
  const fresh = async () => { await p.evaluate(() => document.querySelector('#btnNew').click()); await p.waitForTimeout(300); await wireOn(p); };

  /* ---- 1. a client with "1. Overview" but no year folder: the year folder is made, the file goes in it ---- */
  await client('Test', 'Client', '05/01/2027');
  const t0 = await tree();
  await act('#btnSave'); await finish();
  const name = await base1(), YEAR = ['NB', 'Client, Test', '1. Overview', '2027'];
  ok(name === 'WR Overview - 05.01.27 - (Client, Test)', '1. the file name: ' + name);
  const body = await peek(YEAR.concat([name + '.json']), 'file');
  ok(body && JSON.parse(body).app === 'wr-overview' && JSON.parse(body).header.sname === 'Client', '1. the overview is in the client\'s 1. Overview\\2027 folder, which was made');
  ok(/^Saved to Client, Test \\ 1\. Overview \\ 2027 \(the folder was made\)\. Wrong folder\? Use Save as/.test(await toast()), '1. the message says where it went and that the folder was made: ' + (await toast()).slice(0, 130));
  ok(diff(t0, await tree()).join('|') === 'NB/Client, Test/1. Overview/2027/|NB/Client, Test/1. Overview/2027/' + name + '.json', '1. the only changes in the whole tree: the year folder and the file: ' + diff(t0, await tree()).join(' | '));
  ok((await calls()).length === 0, '1. no Save window and no question');
  await p.screenshot({ path: out + '/overview-saved-to-folder.png' });

  /* the PDF goes beside it, in the same year folder */
  const t1 = await tree();
  await act('#btnPdf'); await finish();
  const pbody = await peek(YEAR.concat([name + '.pdf']), 'file');
  ok(pbody && pbody.startsWith('%PDF-'), '1. the PDF is beside the saved file, and is a PDF');
  ok(/PDF saved and checked/.test(await toast()) && /Saved in Client, Test \\ 1\. Overview \\ 2027/.test(await toast()) && (await calls()).length === 0, '1. the PDF message says checked and where; no window');
  ok(diff(t1, await tree()).join('|') === 'NB/Client, Test/1. Overview/2027/' + name + '.pdf', '1. only the PDF was added');

  /* ---- 2. a client with no "1. Overview" at all: both folders are made, inside the client's folder ---- */
  await fresh(); await client('Frank', 'Fresh', '05/01/2027');
  const t2 = await tree();
  await act('#btnSave'); await finish();
  const n2 = await base1();
  ok(diff(t2, await tree()).join('|') === 'NB/Fresh, Frank/1. Overview/|NB/Fresh, Frank/1. Overview/2027/|NB/Fresh, Frank/1. Overview/2027/' + n2 + '.json', '2. 1. Overview and 2027 were both made inside the client\'s folder, and the file is in the year folder: ' + diff(t2, await tree()).join(' | '));

  /* ---- 3. the year exists: it is used, the older file in it is untouched, nothing is made ---- */
  await fresh(); await client('Dora', 'Done', '05/01/2027');
  const t3 = await tree();
  await act('#btnSave'); await finish();
  const n3 = await base1();
  ok(diff(t3, await tree()).join('|') === 'NB/Done, Dora/1. Overview/2027/' + n3 + '.json', '3. only a new file, beside the older version: ' + diff(t3, await tree()).join(' | '));
  ok((await peek(['NB', 'Done, Dora', '1. Overview', '2027', 'WR Overview - 01.01.27 - (Done, Dora).json'], 'file')).includes('"old":true'), '3. the older version is untouched (versions are kept)');

  /* ---- 4. a file of the same name that this page did not open is asked about; keeping it opens the normal Save window ---- */
  await fresh(); await client('Dora', 'Done', '01/01/2027');
  await act('#btnSave');
  ok(/Replace the existing file\?/.test(await dlg()) && /WR Overview - 01\.01\.27 - \(Done, Dora\)\.json/.test(await dlg()), '4. an existing file of that name: the page asks before replacing it');
  await press('[data-no]'); await p.waitForTimeout(500);
  const c4 = await calls(); ok(c4.length === 1 && /The existing file was kept/.test(c4[0].toast), '4. Keep it: the normal Save window opens, with the reason: ' + (c4[0] && c4[0].toast || '').slice(0, 80));
  ok((await peek(['NB', 'Done, Dora', '1. Overview', '2027', 'WR Overview - 01.01.27 - (Done, Dora).json'], 'file')).includes('"old":true'), '4. the existing file was not replaced');

  /* ---- 5. no folder for the client: the normal Save window, and nothing is made ---- */
  await fresh(); await client('Nina', 'Nobody', '05/01/2027');
  const t5 = await tree();
  await act('#btnSave'); await p.waitForTimeout(500);
  const c5 = await calls(); ok(c5.length === 1 && /No folder named .Nobody, Nina. was found/.test(c5[0].toast), '5. no client folder: the normal Save window opens, with the reason: ' + (c5[0] && c5[0].toast || '').slice(0, 90));
  ok(diff(t5, await tree()).length === 0 || diff(t5, await tree()).every(x => /Nobody-Nina|WR Overview/.test(x) && !/Nobody, Nina/.test(x)) && !(await tree()).some(x => /Nobody, Nina/.test(x)), '5. no client folder was made (the page never makes one)');

  /* ---- 6. the same client in both places: a list; nothing is made until one is picked ---- */
  await fresh(); await client('Betty', 'Both', '05/01/2027');
  const t6 = await tree();
  await act('#btnSave');
  const d6 = await dlg();
  ok(/Which folder\?/.test(d6) && /Both, Betty \\ 1\. Overview \\ 2027/.test(d6) && /B - Files \\ Both, Betty \\ 1\. Overview \\ 2027/.test(d6), '6. two places: the list shows both: ' + d6.replace(/\s+/g, ' ').slice(0, 170));
  ok(diff(t6, await tree()).length === 0, '6. nothing is made while the list is open');
  await press('[data-yes]'); await finish();
  const n6 = await base1();
  ok(diff(t6, await tree()).join('|') === 'NB/Both, Betty/1. Overview/2027/|NB/Both, Betty/1. Overview/2027/' + n6 + '.json', '6. the first was picked: its year folder (missing) was made and the file saved: ' + diff(t6, await tree()).join(' | '));

  /* ---- 7. a path that is too long: nothing is made, the normal Save window opens ---- */
  await p.evaluate(() => FF.folders.setPath('A', 'C:\\' + 'x'.repeat(240)));
  await fresh(); await client('Test', 'Client', '05/01/2028');
  const t7 = await tree();
  await act('#btnSave'); await p.waitForTimeout(500);
  const c7 = await calls(); ok(c7.length === 1 && /too long for Windows/.test(c7[0].toast), '7. a path too long for Windows: the normal Save window opens, with the reason: ' + (c7[0] && c7[0].toast || '').slice(0, 90));
  ok(diff(t7, await tree()).length === 0, '7. nothing was made (not even the year folder)');
  await p.evaluate(() => FF.folders.setPath('A', 'C:\\Users\\tester\\Company\\New Business'));

  /* ---- 8. Read client folder: the documents of the client's folder are listed (the ones the page can sort are ticked) and loaded; the folders are only read ---- */
  await fresh(); await client('Dina', 'Docs', '05/01/2027');
  const t8 = await tree();
  await p.evaluate(() => document.querySelector('#btnReadFolder').click()); await p.waitForSelector('dialog.fdlg[open] input[type=checkbox]', { timeout: 9000 });
  const list = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg[open] label')].map(l => ({ text: l.innerText.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked })));
  ok(list.length === 7, '8. seven documents were found: the schedules, the latest Astute, the Comparative Quotes files and the files of the numbered 3. Quotes folder (not readme.txt, not the 2025 Astute): ' + list.map(x => x.text).join(' | ').slice(0, 300));
  ok(list.filter(x => x.on).length === 5 && !list.filter(x => /scan0001/.test(x.text))[0].on && !list.filter(x => /ignored\.pdf/.test(x.text))[0].on && /Comparative Quotes \\ BR FNA - 100000011/.test(list.map(x => x.text).join('|')), '8. the five the page can sort by name are ticked, the scan is not');
  await p.click('dialog.fdlg[open] [data-yes]'); await p.waitForTimeout(800);
  const st8 = await p.evaluate(() => ({ fna: OV.app.state.blocks.fna.quotes.map(q => q.number + '|' + q.src.file), docs: OV.app.state.documents.map(d => d.block).sort().join(',') }));
  ok(st8.fna.join() === '100000011|BR FNA - 100000011 - R2900.00 - 19.11.26.pdf' && st8.docs === 'astute,cmp,fna,group,policies', '8. the ticked documents were loaded (round 2.0: a folder with no policy number is not a servicing folder, so its FNA quote stays a new business FNA quote): the quote started from its file name, the others recorded: ' + JSON.stringify(st8));
  ok(diff(t8, await tree()).length === 0, '8. the client\'s folders were only read: nothing was written or made');
  await fresh(); await client('Nina', 'Nobody', '05/01/2027');
  await p.evaluate(() => document.querySelector('#btnReadFolder').click()); await p.waitForTimeout(600);
  ok(/No folder for this client was found/.test(await toast()), '8. a client with no folder: said in plain words');

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); srv.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
