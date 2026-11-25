/* Client Overview Studio 1.5 (25 November, Paul's folder change): "Load from client folder" finds EVERY live policy folder of the client (invented client "Test, Dora"), lists ONE group per policy folder with its NEWEST schedule or statement ticked and the older ones
   unticked, compares the three sources (the folders, the Fact Find, the latest overview) in chips and notes, never lists the owner's manual while a schedule exists, never enters Applications, Claims or Comparative Quotes, names a transferred folder instead of
   reading it, reads the ticked files with the block their FOLDER says (a schedule in a retirement annuity's folder is an investment), keeps two files that share a name, reads only (a write counter on the browser's folder calls), and, when one folder never answers,
   opens the list with what it found and names the folder it did not read. Screenshots (deviceScaleFactor 2): r15-list, r15-partial. */
const cp = require('child_process');
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(pages) {                                                                                        // a small valid PDF: one line of big text on every page
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [' + pages.map((_, i) => (4 + i * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((t, i) => { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET\nBT /F1 13 Tf 50 725 Td (Invented document for the View window test) Tj ET\n0.15 0.55 0.8 rg 50 600 495 90 re f'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); });
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const many = (label, n) => Array.from({ length: n }, (_, i) => label + ' - page ' + (i + 1) + ' of ' + n);

const J = o => JSON.stringify(o);
const PRIOR = { app: 'wr-overview', schema: '0.1', blocks: { policies: { items: [{ id: 'p1', insurer: 'BrightRock', product: 'Personal Covers', policyNo: '811234567', removed: false }] }, investments: { items: [{ id: 'i1', provider: 'Sygnia', product: 'RA', policyNo: '', removed: false }] } } };
const one = t => pdf([t]);
const TREE = {
  NB: { 'Test, Dora': {
      '1. Overview': { '2026': { 'WR Overview - 10.03.26 - Test, Dora.json': J(PRIOR), 'WR Overview - 10.03.26 - Test, Dora.pdf': one('Overview pdf') } }, '2. Fact Find': {}, '3. Quotes': {},
      '5. Astute': { '2026': { 'Astute Report - 20.11.26.pdf': one('Astute report 20.11.26') } },
      '6. Policy Schedules': { '2025': { 'BR Policy Summary 811234567 - 2025.pdf': one('BrightRock policy summary 811234567 dated 2025') } } ,
      'BR Personal Covers - 811234567': { 'Policy Schedules': { '2025': { 'Policy Schedule.pdf': one('BrightRock policy schedule 811234567 dated 2025') }, '2026': { 'Policy Schedule.pdf': one('BrightRock policy schedule 811234567 dated 2026'), "Owner's Manual.pdf": one('BrightRock owners manual') } },
        'Acceptance Letter.pdf': one('Acceptance letter'), 'Applications': { 'BR Application.pdf': one('Application') }, 'Claims': { 'Claim 1.pdf': one('Claim') } },
      'Coronation RA - 458899': { '2025': { 'Statement 31.12.25.pdf': one('Coronation statement 31.12.25') }, '2026': { 'Statement 31.03.26.pdf': one('Coronation statement 31.03.26'), 'Policy Schedule.pdf': one('Coronation policy schedule 458899') }, 'Comparative Quotes': { '2024 Investment.pdf': one('Comparative investment 2024') } },
      'Mom Endowment - 03112233445 - (Linked to PK)': { 'Policy Schedules': { '2026': { 'Mom Schedule.pdf': one('Momentum schedule 03112233445') } } },
      'San Invest - 0556677 - (Transfered)': { 'Policy Schedules': { 'San Schedule.pdf': one('Sanlam schedule transferred') } },
      'Old Mutual TFSA - 5544332': { 'Applications': { 'TFSA Application.pdf': one('TFSA application') } },
      'View Family': { 'Photo.pdf': one('Photo') } }, '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'T - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'BrightRock', spend: 'R 2 000.00', broker: 'Paul K' } }],
    ret_ra: [{ d: { prov: 'Momentum', status: 'Current', val: 'R 200 000.00', contrib: 'R 1 000.00', broker: 'Paul K' } }, { d: { prov: 'Sanlam', status: 'Current', val: 'R 50 000.00', contrib: 'R 500.00', broker: 'Other broker' } }],
    inv: [{ d: { type: 'Tax-free investment', prov: 'Allan Gray', val: 'R 80 000.00', prem: 'R 1 000.00', broker: 'Paul K' } }] } };
const READ = {
  'BrightRock policy schedule 811234567 dated 2026': { insurer: 'BrightRock', product: 'Personal Covers', policyNo: '811234567', premium: 2000, lines: [{ type: 'household', life: { lump: 2000000 } }] },
  'Momentum schedule 03112233445': { provider: 'Momentum', product: 'Retirement annuity', policyNo: '03112233445', gross: 250000, valueDate: '31/03/2026', valueKind: 'schedule' },
  'Coronation statement 31.03.26': { provider: 'Coronation', product: 'RA', policyNo: '458899', gross: 100000, valueDate: '31/03/2026', valueKind: 'schedule' },
  'Coronation policy schedule 458899': { provider: 'Coronation', product: 'RA', policyNo: '458899', gross: 99000, valueDate: '01/01/2026', valueKind: 'schedule' },
  'Astute report 20.11.26': { reportDate: '20/11/2026', policies: [], investments: [], group: [] }
};

srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = ({ read: READ_ARG }) => {
    window.__api = []; window.__read = READ_ARG; window.__writes = 0;
    const DP = FileSystemDirectoryHandle.prototype, FP = FileSystemFileHandle.prototype, gd = DP.getDirectoryHandle, gf = DP.getFileHandle, re = DP.removeEntry, cw = FP.createWritable;           // the page may only READ the client's folders
    DP.getDirectoryHandle = function (n, o) { if (o && o.create) window.__writes++; return gd.call(this, n, o); }; DP.getFileHandle = function (n, o) { if (o && o.create) window.__writes++; return gf.call(this, n, o); };
    DP.removeEntry = function (n, o) { if (window.__tracking) window.__writes++; return re.call(this, n, o); }; FP.createWritable = function (o) { if (window.__tracking) window.__writes++; return cw.call(this, o); };
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let answer = {};
      if (c0.type === 'document' || (c0.source && c0.source.data)) { const text = atob(c0.source.data); window.__api.push(text); const k = Object.keys(window.__read).filter(x => text.indexOf(x) >= 0)[0]; answer = k ? window.__read[k] : {}; }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
    };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, { read: READ });
  const errs = [];
  /* ---- connect the folders the way the adviser does (on the Risk Application page, shared storage) ---- */
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string' || (x && x.png)) { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(x); await w.close(); } else { const sub = await d.getDirectoryHandle(n, { create: true }); await mk(sub, x); } } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const fresh = async () => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
    await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
    await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
    await p.evaluate(ff => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); OV.app.setState(s); OV.app.openAll(); window.__tracking = true; window.__writes = 0; }, FFJ);
    return p;
  };
  const waitDone = p => p.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  const dialog = p => p.evaluate(() => {
    const d = document.querySelector('dialog.fdlg[open]'), out = { heads: [], rows: [], notes: [], chips: {} };
    [...d.querySelectorAll('.flist > *')].forEach(e => { if (e.classList.contains('pkh')) { out.heads.push(e.querySelector('b').textContent); out.chips[e.querySelector('b').textContent] = [...e.querySelectorAll('.pkc')].map(c => c.textContent); out.cur = e.querySelector('b').textContent; }
      else if (e.tagName === 'LABEL') out.rows.push({ g: out.cur || '', t: e.textContent.replace(/\s+/g, ' ').trim(), on: e.querySelector('input').checked, i: e.querySelector('input').getAttribute('data-i') }); });
    out.notes = [...d.querySelectorAll('.pknotes p')].map(x => x.textContent); out.intro = d.querySelector('p').textContent; return out;
  });

  /* ---- 1. the list: one group per live policy folder ---- */
  let p = await fresh();
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  const L = await dialog(p), G = n => L.rows.filter(r => L.heads.indexOf(r.g) >= 0 && r.g.indexOf(n) === 0), onOf = (rows, s) => rows.filter(r => r.t.indexOf(s) >= 0)[0];
  ok(['BR Personal Covers - 811234567', 'Coronation RA - 458899', 'Mom Endowment - 03112233445 - (Linked to PK)', 'Old Mutual TFSA - 5544332', 'Other documents'].every(h => L.heads.indexOf(h) >= 0) && L.heads.length === 5, '1. one heading per live policy folder, and "Other documents": ' + L.heads.join(' | '));
  ok(!L.heads.some(h => /San Invest|View Family/.test(h)) && !L.rows.some(r => /San Schedule|Photo|Application|Claim|Acceptance|Manual/.test(r.t)), '1. a transferred folder, a folder that is not a policy folder, Applications, Claims, an Acceptance Letter and the owner\'s manual are not in the list');
  const br = G('BR Personal Covers');
  ok(br.length === 3 && br.filter(r => /Policy Schedule\.pdf/.test(r.t)).length === 2, '1. the BrightRock folder lists BOTH files named Policy Schedule.pdf (2025 and 2026) and the 2025 summary of 6. Policy Schedules: ' + br.map(r => r.t.slice(0, 60)).join(' | '));
  ok(br.filter(r => r.on).length === 1 && /2026 \\ Policy Schedule\.pdf \(newest: Current policies\)/.test(br.filter(r => r.on)[0].t) && br.filter(r => !r.on).every(r => /older/.test(r.t)), '1. only the NEWEST one (the 2026 schedule) is ticked, the others say older: ' + br.map(r => (r.on ? '[x] ' : '[ ] ') + r.t.slice(0, 70)).join(' | '));
  const n91 = G('Coronation RA');
  ok(onOf(n91, 'Statement 31.03.26') && onOf(n91, 'Statement 31.03.26').on && /newest: Current investments/.test(onOf(n91, 'Statement 31.03.26').t) && !onOf(n91, 'Statement 31.12.25').on && !onOf(n91, 'Policy Schedule.pdf').on, '1. Coronation: the 2026 statement is ticked and labelled Current investments (its folder says RA), the 2025 one and the other 2026 file are not');
  ok(G('Mom Endowment').length === 1 && G('Mom Endowment')[0].on && /newest: Current investments/.test(G('Mom Endowment')[0].t), '1. Momentum (Linked to PK) is live: its schedule is ticked and is a CURRENT INVESTMENT because the folder is an RA, whatever the file\'s name says');
  ok(G('Old Mutual TFSA').length === 0, '1. the folder with only Applications has no file');
  const oth = L.rows.filter(r => L.heads.indexOf(r.g) >= 0 && r.g === 'Other documents'), cq = onOf(oth, '2024 Investment.pdf');
  ok(cq && /Comparative quote/.test(cq.t) && !/Current investments/.test(cq.t), '1. the 2024 comparative quote inside the Coronation folder is a COMPARATIVE QUOTE, not Current investments: ' + (cq && cq.t));
  ok(onOf(oth, 'Astute Report - 20.11.26') && onOf(oth, 'Astute Report - 20.11.26').on, '1. the Astute report is still listed and ticked, as before');
  ok(L.chips['BR Personal Covers - 811234567'].some(c => /In the Fact Find$/.test(c)) && L.chips['BR Personal Covers - 811234567'].some(c => /In the last overview/.test(c)), '1. chips for the BrightRock folder: ' + L.chips['BR Personal Covers - 811234567'].join(' / '));
  ok(L.chips['Coronation RA - 458899'].some(c => /In a folder, but not in the Fact Find/.test(c)) && L.chips['Coronation RA - 458899'].some(c => /Not in the last overview/.test(c)), '1. Coronation is in a folder but not in the Fact Find: ' + L.chips['Coronation RA - 458899'].join(' / '));
  ok(L.chips['Mom Endowment - 03112233445 - (Linked to PK)'].some(c => /Linked to PK/.test(c)) && L.chips['Mom Endowment - 03112233445 - (Linked to PK)'].some(c => /In the Fact Find$/.test(c)), '1. Momentum: Linked to PK, in the Fact Find');
  ok(L.chips['Old Mutual TFSA - 5544332'].some(c => /No schedule or statement found/.test(c)), '1. the TFSA folder says no schedule or statement was found');
  const N = L.notes.join(' || ');
  ok(/In the Fact Find, but no policy folder was found for: Allan Gray/.test(N) && /Sanlam.*its folder .San Invest - 0556677 - \(Transfered\). is not live/.test(N) && /In the last overview only.*Sygnia/.test(N) && /Not live, so not looked into: San Invest - 0556677 - \(Transfered\)/.test(N) && /not policy folders, not looked into: View Family/.test(N), '1. the notes: ' + N);
  await p.screenshot({ path: out + '/r15-list.png' });
  /* ---- 2. load: the ticked ones are read, with the block their folder says; two files with one name are both read ---- */
  await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); [...d.querySelectorAll('label')].forEach(l => { if (/Coronation RA - 458899|Policy Schedule\.pdf/.test(l.textContent) && /Policy Schedule\.pdf/.test(l.textContent) && l.closest('.flist') && /2026 \\ Policy Schedule\.pdf \(older/.test(l.textContent.replace(/\s+/g, ' '))) l.querySelector('input').checked = true; }); });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(800);
  const api = await p.evaluate(() => window.__api.map(t => (/(BrightRock policy schedule 811234567 dated \d+|BrightRock policy summary|Coronation statement [\d.]+|Coronation policy schedule|Momentum schedule|Astute report [\d.]+|Sanlam schedule|owners manual|Acceptance letter|Comparative investment)/.exec(t) || ['?'])[0]));
  ok(['BrightRock policy schedule 811234567 dated 2026', 'Coronation statement 31.03.26', 'Momentum schedule', 'Astute report 20.11.26'].every(x => api.indexOf(x) >= 0), '2. the ticked files were read: ' + api.join(', '));
  ok(api.indexOf('Coronation policy schedule') >= 0, '2. the second file named Policy Schedule.pdf (in the Coronation folder, ticked by hand) was read too, not dropped as a copy of the BrightRock one');
  ok(!api.some(x => /dated 2025|summary|owners manual|Acceptance|Sanlam|statement 31\.12/.test(x)), '2. the older files, the owner\'s manual, the acceptance letter and the transferred folder were NOT read: ' + api.join(', '));
  const S = await p.evaluate(() => OV.app.state), pols = S.blocks.policies.items, invs = S.blocks.investments.items;
  const mom = invs.filter(i => i.provider === 'Momentum')[0], brp = pols.filter(i => i.insurer === 'BrightRock')[0];
  ok(mom && mom.gross === 250000 && mom.src && mom.src.file === 'Mom Schedule.pdf' && pols.every(i => i.insurer !== 'Momentum'), '2. Momentum\'s "Mom Schedule.pdf" went into CURRENT INVESTMENTS (the RA folder), not into current policies, although its name says schedule: gross ' + (mom && mom.gross));
  ok(brp && brp.policyNo === '811234567' && brp.product === 'Personal Covers' && brp.src.file === 'Policy Schedule.pdf', '2. the BrightRock policy was filled from its 2026 schedule: ' + (brp && [brp.policyNo, brp.product, brp.src && brp.src.file].join(', ')));
  ok(api.indexOf('Comparative investment') >= 0 && !invs.some(i => /Comparative/.test(JSON.stringify(i))) && S.blocks.comparative.quotes.length === 1, '2. the 2024 comparative quote is ticked as before and went into COMPARATIVE QUOTES, not into Current investments: ' + S.blocks.comparative.quotes.length + ' comparative quote(s)');
  const log = await p.evaluate(() => OV.app.lastLog().map(l => l.msg));
  ok(log.some(m => /In the Fact Find, but no policy folder was found: Allan Gray/.test(m)) && log.some(m => /The Fact Find lists Sanlam.*is not live/.test(m)) && log.some(m => /In a folder but not in the Fact Find: Coronation RA - 458899/.test(m)) && log.some(m => /Old Mutual TFSA - 5544332: no schedule or statement was found/.test(m)), '2. what the folders said about the Fact Find is kept with the last load\'s messages: ' + log.filter(m => /Fact Find|folder|schedule or statement/.test(m)).map(m => m.slice(0, 60)).join(' | '));
  ok(await p.evaluate(() => window.__writes) === 0, '2. nothing was created, written or removed in any folder (a counter on the browser\'s folder calls: ' + (await p.evaluate(() => window.__writes)) + ')');
  await p.close();

  /* ---- 3. one folder never answers: the list opens with what was found and names the folder it did not read ---- */
  p = await fresh();
  await p.evaluate(() => {
    FF.foldersUI.timeouts.walk = 6000; FF.foldersUI.timeouts.policyFolder = 1000; FF.foldersUI.timeouts.list = 3000;
    const DP = FileSystemDirectoryHandle.prototype, ent = DP.entries;
    DP.entries = function () { if (this.name.indexOf('Mom Endowment') === 0) return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; return ent.call(this); };
  });
  const t0 = Date.now(); await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh', { timeout: 20000 }); const took = Date.now() - t0;
  const P = await dialog(p), PN = P.notes.join(' || ');
  ok(took < 6000, '3. the list opened although one folder never answered, after ' + took + ' ms');
  ok(P.heads.indexOf('BR Personal Covers - 811234567') >= 0 && P.heads.indexOf('Mom Endowment - 03112233445 - (Linked to PK)') >= 0 && P.heads.indexOf('Old Mutual TFSA - 5544332') >= 0, '3. every live folder is still named, also the ones not reached: ' + P.heads.join(' | '));
  ok(P.chips['Mom Endowment - 03112233445 - (Linked to PK)'].some(c => /Not \(fully\) read: the search ran out of time/.test(c)) && !P.chips['Mom Endowment - 03112233445 - (Linked to PK)'].some(c => /No schedule or statement found/.test(c)), '3. the folder that did not answer says it was not read, not "no schedule found": ' + P.chips['Mom Endowment - 03112233445 - (Linked to PK)'].join(' / '));
  ok(/The search of the policy folders did not finish.*not \(fully\) read: .*Mom Endowment - 03112233445 - \(Linked to PK\)/.test(PN), '3. a note names it: ' + PN.slice(0, 200));
  ok(P.rows.some(r => /BR Personal Covers/.test(r.g) && r.on) && P.rows.some(r => /Coronation/.test(r.g) && r.on) && !/Not \(fully\) read/.test(P.chips['BR Personal Covers - 811234567'].join('/')), '3. the folders on both sides of the one that never answered were read, and their newest files are ticked: ' + P.rows.filter(r => r.on).map(r => r.g.slice(0, 12)).join(', '));
  await p.screenshot({ path: out + '/r15-partial.png' });
  await p.click('dialog.fdlg [data-no]'); await p.waitForTimeout(300); await p.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
