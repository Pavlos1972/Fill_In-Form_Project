/* Client Overview Studio 2.2 (25 November, Paul's next round relayed at 18:48): every quote line of the menu has a "needed" tick box, pre-ticked from what the Fact Find asks for, which the adviser can tick or untick; Load from client folder looks only for the needed quotes and lists
   any other quote once, collapsed, as "found but not asked for"; the menu reads as a checklist (asked for / loaded / outstanding). A real folder tree of an invented client ("Test, Sia") named the BrightRock way, a Fact Find that asks for a New Business FNA quote and a Servicing
   shortfall quote. Checked on the real page: the ten tick boxes and their states and the summary line; the pick list ticks the two needed quotes and lists four others in a collapsed group; Load fills only what was needed; ticking a line in the menu (and the real check box on the
   block's page) changes what Load looks for; a file ticked in the collapsed group is loaded and ticks its block; the adviser's tick survives Save and Open; nothing is written to the folders. Screenshots (deviceScaleFactor 2): r22-*. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(t) {
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const one = t => pdf('READ:' + t);
const TREE = {
  NB: { 'Test, Sia': {
      '1. Overview': {}, '2. Fact Find': {}, '6. Policy Schedules': {},
      '3. Quotes': {
        'BR FNA - 100000401 - R2,900.00 - 05.01.27 - (S Test).pdf': one('fna'),
        'BR Serv Shortfall - 100000404 - R800.00 - 05.01.27 - (S Test).pdf': one('svsf'),
        'BR Reduced - 100000402 - R1,400.00 - 05.01.27 - (S Test).pdf': one('red'),
        'BR CMPO - 100000402 - R1,400.00 - 05.01.27 - (S Test).pdf': one('cmpo'),
        'BR Quote - 100000403 - R1,900.00 - 05.01.27 - (S Test).pdf': one('cq'),
        'BR Serv Increase - 100000405 - R1,450.00 - 05.01.27 - (S Test).pdf': one('svinc') },
      'BR Personal Covers - 900100200': { 'Policy Schedules': { '2026': { 'BR Policy Summary 01.06.26.pdf': one('sched') } },
        'Comparative Quotes': { '2027 - Review': { 'BR Serv Quote - 100000406 - R900.00 - 05.01.27 - (S Test).pdf': one('bare') } } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'T - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sia'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026'), bf_fna_req: v('Request a quote'), bf_fna_type: v('New Business'), bf_sf_req: v('Request a quote'), bf_sf_type: v('Servicing') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'BrightRock', spend: 'R 1 000.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: 'R 150.00', broker: 'Other broker' } }], ret_pp: [], ret_ra: [], inv: [] } };
const L = (type, lump, monthly, o) => Object.assign({ type, life: { lump, monthly }, abi: type === 'household' ? 5 : 0 }, o || {});
const base = (no, prem, lines) => ({ insurer: 'BrightRock', number: no, date: '05/01/2027', rates: 'Non-smoker rates', aci: 10, premium: prem, lines });
const READS = {
  sched: { insurer: 'BrightRock', product: 'Personal covers', policyNo: '900100200', doc: '01/06/2026', premium: 1000, aci: 10, lines: [L('household', 500000, 0)] },
  fna: base('100000401', 2900, [L('household', 800000, 0)]), svsf: base('100000404', 800, [L('household', 600000, 0)]), red: base('100000402', 1400, [L('household', 400000, 0)]),
  cq: base('100000403', 1900, [L('household', 600000, 0)]), svinc: base('100000405', 1450, [L('household', 700000, 0)]), bare: base('100000406', 900, [L('household', 400000, 0)]),
  cmpo: { number: '100000402', activationDate: '01/01/2027', rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }] }
};

srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = reads => {
    window.__api = []; window.__writes = 0; window.__reads = reads;
    const DP = FileSystemDirectoryHandle.prototype, FP = FileSystemFileHandle.prototype, gd = DP.getDirectoryHandle, gf = DP.getFileHandle, re = DP.removeEntry, cw = FP.createWritable;
    DP.getDirectoryHandle = function (n, o) { if (o && o.create) window.__writes++; return gd.call(this, n, o); }; DP.getFileHandle = function (n, o) { if (o && o.create) window.__writes++; return gf.call(this, n, o); };
    DP.removeEntry = function (n, o) { if (window.__tracking) window.__writes++; return re.call(this, n, o); }; FP.createWritable = function (o) { if (window.__tracking) window.__writes++; return cw.call(this, o); };
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let txt = '';
      if (c0.source && c0.source.data) { txt = atob(c0.source.data); window.__api.push(txt); }
      const m = /READ:(\w+)/.exec(txt), reply = m && window.__reads[m[1]] ? window.__reads[m[1]] : {};
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
    };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, READS);
  const errs = [];
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(x); await w.close(); } else { const sub = await d.getDirectoryHandle(n, { create: true }); await mk(sub, x); } } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const waitDone = pg => pg.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  const text = (file, n) => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']).toString();

  /* ---- 1. the Fact Find is read: the ten tick boxes are pre-ticked and the menu reads as a checklist ---- */
  await p.evaluate(ff => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); OV.app.setState(s); OV.app.openAll(); window.__tracking = true; window.__writes = 0; window.__api = []; }, FFJ);
  await p.evaluate(() => OV.app.checkPass()); await waitDone(p); await p.waitForTimeout(400);          // Fill from Fact Find runs the checks by itself; this script filled the state directly
  const menu = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#nav [data-need]')].map(e => { const id = e.getAttribute('data-need'), st = document.querySelector('[data-state="' + id + '"]'); return [id, { on: e.classList.contains('on'), aria: e.getAttribute('aria-checked'), state: st && !st.hidden ? st.textContent : '', dot: document.querySelector('[data-dot="' + id + '"]').className.replace('dot ', '') }]; })));
  const sum = () => p.evaluate(() => { const e = document.querySelector('[data-navsum]'); return e && !e.hidden ? e.textContent : ''; });
  let M = await menu();
  ok(Object.keys(M).join(',') === 'svFna,svShortfall,svReduced,svIncrease,svReduction,fna,shortfallQuote,reduced,comparative,proposed', '1. a tick box on each of the ten quote lines of the menu, and on no other: ' + Object.keys(M).join(','));
  ok(M.fna.on && M.fna.aria === 'true' && M.svShortfall.on && !M.svFna.on && !M.svReduced.on && !M.svIncrease.on && !M.svReduction.on && !M.shortfallQuote.on && !M.reduced.on && !M.comparative.on && !M.proposed.on, '1. pre-ticked from the Fact Find: the New Business FNA and the Servicing shortfall, nothing else: ' + JSON.stringify(Object.fromEntries(Object.entries(M).map(([k, x]) => [k, x.on]))));
  ok(M.fna.state === 'Asked for \u00b7 outstanding' && M.svShortfall.state === 'Asked for \u00b7 outstanding' && M.reduced.state === 'Not asked for' && M.svIncrease.state === 'Not asked for', '1. the lines read: asked for, outstanding / not asked for: ' + JSON.stringify([M.fna.state, M.reduced.state]));
  ok(M.reduced.dot === 'na' && M.fna.dot !== 'red', '1. a line nobody asked for is dashed, never red; an asked-for line is not red before the folder was searched: ' + JSON.stringify([M.reduced.dot, M.fna.dot]));
  ok(await sum() === 'Quotes: asked for 2 \u00b7 loaded 0 \u00b7 outstanding 2', '1. the summary line: ' + await sum());
  await p.screenshot({ path: out + '/r22-menu.png', clip: { x: 0, y: 0, width: 330, height: 1100 } });

  /* ---- 2. Load: only the needed quotes are ticked, the others are listed once, collapsed ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  const pick = () => p.evaluate(() => {
    const d = document.querySelector('dialog.fdlg[open]'), rows = [...d.querySelectorAll('.flist label')].map(e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), on: e.querySelector('input').checked, inNot: !!e.closest('details.pknot') }));
    const det = d.querySelector('details.pknot'); return { rows, summary: det ? det.querySelector('summary').textContent : '', open: det ? det.open : null };
  });
  let L1 = await pick(); const row = re => L1.rows.filter(r => re.test(r.t))[0] || null;
  const fna = row(/BR FNA - 100000401/), svsf = row(/BR Serv Shortfall - 100000404/), red = row(/BR Reduced - 100000402/), cmpo = row(/BR CMPO - 100000402/), cq = row(/BR Quote - 100000403/), inc = row(/BR Serv Increase - 100000405/), bare = row(/BR Serv Quote - 100000406/);
  ok(fna && fna.on && !fna.inNot && svsf && svsf.on && !svsf.inNot, '2. the two needed quotes are ticked and listed in the main list: ' + JSON.stringify([fna && fna.on, svsf && svsf.on]));
  ok([red, cmpo, cq, inc, bare].every(r => r && !r.on && r.inNot), '2. the five others (a bare Serv quote too: neither straight line is needed) are unticked and sit in the collapsed group: ' + JSON.stringify([red, cmpo, cq, inc, bare].map(r => r && [r.on, r.inNot])));
  ok(L1.summary === 'Found but not asked for (5)' && L1.open === false, '2. the group says how many and is collapsed: ' + L1.summary + ' / open ' + L1.open);
  ok(red && /not asked for \(Reduced quotes is not ticked as needed\)/.test(red.t) && cmpo && /not asked for \(Reduced quotes/.test(cmpo.t), '2. each says why, and the pay-out guide goes with its quote (Reduced quotes): ' + (cmpo && cmpo.t));
  await p.screenshot({ path: out + '/r22-list.png' });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(900);
  const S = await p.evaluate(() => { const s = OV.app.state, q = b => s.blocks[b].quotes.filter(x => !x.removed).map(x => x.number); return { fna: q('fna'), svsf: q('svShortfall'), red: q('reduced'), cq: q('comparative'), inc: q('svIncrease'), reads: window.__api.map(t => /READ:(\w+)/.exec(t)[1]).sort().join(','), w: window.__writes }; });
  ok(S.fna.join() === '100000401' && S.svsf.join() === '100000404' && !S.red.length && !S.cq.length && !S.inc.length, '2. Load filled the two needed blocks and nothing else: ' + JSON.stringify(S));
  ok(!/red|cq|svinc|cmpo/.test(S.reads) && /fna/.test(S.reads) && /svsf/.test(S.reads), '2. the unticked ones were never sent to the reading: ' + S.reads);
  M = await menu();
  ok(M.fna.state === 'Asked for \u00b7 loaded (1)' && M.svShortfall.state === 'Asked for \u00b7 loaded (1)' && M.reduced.state === 'Not asked for' && await sum() === 'Quotes: asked for 2 \u00b7 loaded 2 \u00b7 outstanding 0', '2. the checklist after the load: ' + JSON.stringify([M.fna.state, M.svShortfall.state]) + ' / ' + await sum());
  await p.screenshot({ path: out + '/r22-menu-loaded.png', clip: { x: 0, y: 0, width: 330, height: 1100 } });

  /* ---- 3. the adviser ticks a line himself: in the menu and with the real check box on the block's page ---- */
  await p.click('#nav [data-need="svIncrease"]'); await p.waitForTimeout(200);
  M = await menu();
  ok(M.svIncrease.on && M.svIncrease.state === 'Asked for \u00b7 outstanding' && await sum() === 'Quotes: asked for 3 \u00b7 loaded 2 \u00b7 outstanding 1', '3. a click on the tick box of Straight increase ticks it: asked for, outstanding; the summary follows: ' + await sum());
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.needed === true && document.querySelector('#main h2') && !/Straight increase/.test(document.querySelector('#main h2').textContent)), '3. the choice is kept in the file (blocks.svIncrease.needed), and the click did not open the page');
  await p.evaluate(() => OV.app.go('svIncrease')); await p.waitForTimeout(150);
  const nb = await p.evaluate(() => { const c = document.querySelector('#main [data-needblock]'); return c ? { on: c.checked, text: c.closest('.needbox').textContent.replace(/\s+/g, ' ') } : null; });
  ok(nb && nb.on && /your choice/.test(nb.text), '3. the block\'s own page has the real check box, ticked, and says it is the adviser\'s choice: ' + (nb && nb.text));
  await p.screenshot({ path: out + '/r22-block.png', clip: { x: 330, y: 0, width: 1110, height: 360 } });
  await p.click('#main [data-needblock]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.needed === false) && (await menu()).svIncrease.state === 'Not asked for', '3. unticking it on the page: not needed again, "Not asked for"');
  await p.click('#nav [data-need="svIncrease"]'); await p.waitForTimeout(150);

  /* ---- 4. a second Load now looks for what he ticked; a file ticked in the collapsed group is loaded and ticks its block ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  L1 = await pick(); const inc2 = row(/BR Serv Increase - 100000405/), fna2 = row(/BR FNA - 100000401/), bare2 = row(/BR Serv Quote - 100000406/);
  ok(inc2 && inc2.on && !inc2.inNot && L1.summary === 'Found but not asked for (3)' && fna2 && !fna2.inNot, '4. Straight increase is now looked for (ticked, in the main list) and the group has three: ' + JSON.stringify([inc2 && [inc2.on, inc2.inNot], L1.summary]));
  ok(bare2 && bare2.on && !bare2.inNot, '4. a bare Serv quote is asked for as soon as EITHER straight line is needed (it lands in increase or reduction by its premium): ' + JSON.stringify(bare2 && [bare2.on, bare2.inNot]));
  await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); d.querySelector('details.pknot').open = true; [...d.querySelectorAll('.flist label')].forEach(l => { if (/BR Reduced - 100000402/.test(l.textContent)) l.querySelector('input').checked = true; }); });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(900);
  const T = await p.evaluate(() => { const s = OV.app.state, q = b => s.blocks[b].quotes.filter(x => !x.removed).map(x => x.number); return { fnaN: q('fna').length, dec: q('svReduction'), needDec: s.blocks.svReduction.needed, needInc: s.blocks.svIncrease.needed, inc: q('svIncrease'), red: q('reduced'), cmp: s.blocks.reduced.quotes.length ? (s.blocks.reduced.quotes[0].cmp ? s.blocks.reduced.quotes[0].cmp.rows.length : 0) : -1, needRed: s.blocks.reduced.needed, w: window.__writes }; });
  ok(T.inc.join() === '100000405' && T.red.join() === '100000402' && T.needRed === true, '4. the Straight increase was loaded, and the Reduced quote the adviser ticked in the collapsed group was loaded and ticked its block: ' + JSON.stringify(T));
  ok(T.dec.join() === '100000406' && T.needDec === true && T.needInc === true && T.inc.join() === '100000405', '4. the bare quote (R900, below the policy\'s R1,000) landed in Straight REDUCTION and ticked THAT block, not the one its name was filed under: ' + JSON.stringify([T.dec, T.needDec, T.needInc, T.inc]));
  ok(T.fnaN === 1, '4. the FNA that was already loaded was not loaded a second time: ' + T.fnaN);
  ok(T.cmp === 1, '4. the pay-out guide of that reduced quote (not asked for until then) was read with it: ' + T.cmp);
  M = await menu(); ok(M.reduced.on && M.reduced.state === 'Asked for \u00b7 loaded (1)', '4. and the line now reads asked for, loaded: ' + JSON.stringify(M.reduced));

  /* ---- 5. a loaded block the adviser unticks says so; the choice survives Save and Open; nothing was written ---- */
  await p.click('#nav [data-need="fna"]'); await p.waitForTimeout(200); M = await menu();
  ok(!M.fna.on && M.fna.state === 'Loaded (1) \u00b7 not asked for', '5. an unticked line that holds a quote reads "Loaded (1) \u00b7 not asked for": ' + M.fna.state);
  const back = await p.evaluate(() => { const o = OV.store.fromJSON(OV.store.toJSON(OV.app.state)); return { fna: o.blocks.fna.needed, red: o.blocks.reduced.needed, inc: o.blocks.svIncrease.needed, shortfall: o.blocks.shortfallQuote.needed, blocks: o.factFind.facts.asked.blocks }; });
  ok(back.fna === false && back.red === true && back.inc === true && back.shortfall === undefined && JSON.stringify(back.blocks) === JSON.stringify({ fna: true, svShortfall: true }), '5. the adviser\'s ticks survive Save and Open, a line he never touched stores nothing, and the Fact Find\'s answer is kept: ' + JSON.stringify(back));
  ok(await p.evaluate(() => window.__writes) === 0, '5. nothing was created, written or removed in any folder');
  /* ---- 6. a Fact Find that asks for NO quote: nothing is needed, so every quote is listed in the open group, unticked, with a sentence ---- */
  await p.evaluate(ff => { const f = JSON.parse(JSON.stringify(ff)); ['bf_fna_req', 'bf_fna_type', 'bf_sf_req', 'bf_sf_type'].forEach(k => { delete f.f[k]; }); const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(f), 'ff.json'); OV.app.setState(s); window.__api = []; }, FFJ);
  await p.evaluate(() => OV.app.checkPass()); await waitDone(p); await p.waitForTimeout(300);
  M = await menu(); ok(Object.values(M).every(x => !x.on && x.state === 'Not asked for') && await sum() === 'Quotes: asked for 0 \u00b7 loaded 0 \u00b7 outstanding 0', '6. nothing is asked for: every line is unticked and says Not asked for: ' + await sum());
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  L1 = await pick(); const quoteRows = L1.rows.filter(r => /BR (FNA|Serv|Reduced|Quote|CMPO)/.test(r.t));
  ok(L1.open === true && /\(7\)/.test(L1.summary) && quoteRows.length === 7 && quoteRows.every(r => r.inNot && !r.on), '6. the group is OPEN and holds all seven quotes found, none ticked: ' + JSON.stringify([L1.open, L1.summary, quoteRows.length]));
  ok(await p.evaluate(() => /No quote line is ticked as needed \(the Fact Find asks for none\)/.test(document.querySelector('dialog.fdlg[open] details.pknot').textContent)), '6. and the dialog says why');
  await p.screenshot({ path: out + '/r22-list-none.png' });
  await p.click('dialog.fdlg [data-no]'); await p.waitForTimeout(200);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
