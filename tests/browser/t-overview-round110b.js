/* Client Overview Studio 1.1, the combinations Paul's real client will hit (invented client "Scene, Sam"): ONE Astute report filling several rows (two policies, one of them Wealth Revolution BrightRock, and a group item) with the schedule of a third
   policy beside it and an older Astute report in the folder: Load reads only the newest Astute report, every View button opens its own page, a schedule is not overridden, a figure the adviser corrected is kept when the report is applied again;
   then a full-size FNA quote (9 lines, a pay-out table, 3 loadings, 3 exclusions) replacing two policies, one of them filled from Astute with a long product name: the PDF page, the Presentation and the entry screen are looked at.
   Screenshots (deviceScaleFactor 2): r14-policies, r14-group, r14-big-quote, r14-pdf-quote, r14-pdf-policies, r14-pres-quote, r14-pres-policies. */
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
const TREE = {
  NB: { 'Scene, Sam': { '1. Overview': {}, '2. Fact Find': {}, '3. Quotes': { 'BR FNA - 400500600 - 19.11.26.pdf': pdf(many('BrightRock FNA quote CP 400500600', 2)) },
    '5. Astute': { '2026': { 'Astute Report - 20.08.26.pdf': pdf(many('Astute report 20.08.26', 6)), 'Astute Report - 20.11.26.pdf': pdf(many('Astute report 20.11.26', 6)) } },
    '6. Policy Schedules': { 'Liberty Schedule L-900.pdf': pdf(many('Liberty policy schedule L-900', 2)) } }, '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sam'), sname: v('Scene'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Budget Insurance', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'BrightRock', spend: 'R 2 000.00', broker: 'Paul K' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } };
const LONGP = 'Budget Life Plus Premier Protector Whole of Life Extended Cover';
const READ = {
  'Astute report 20.08.26': { reportDate: '20/08/2026', policies: [{ insurer: 'Budget Insurance', product: 'Old Plan', policyNo: '100200300', premium: 800, life: 100000, page: 2 }], group: [], investments: [] },
  'Astute report 20.11.26': { reportDate: '20/11/2026', investments: [],
    policies: [{ insurer: 'Budget Insurance', product: LONGP, policyNo: '100200300', doc: '01/03/2019', premium: 900, life: 750000, sev: 250000, lsd: 0, ip: 12000, waiting: '1 month', aci: 7, abi: 5, ipAge: 65, page: 4 },
      { insurer: 'BrightRock', product: 'Lifestyle', policyNo: '700800900', doc: '01/06/2022', premium: 2000, life: 2000000, sev: 500000, lsd: 0, ip: 30000, waiting: '1 month', aci: 7.5, abi: 5, ipAge: 65, page: 5 },
      { insurer: 'Liberty', product: 'Should not win', policyNo: 'L-900', premium: 500, life: 1, page: 3 }],
    group: [{ provider: 'Test Group Scheme', kind: 'risk', life: { amount: 1200000, endAge: '65' }, sev: { amount: 300000, endAge: '65' }, page: 6 }] },
  'Liberty policy schedule L-900': { insurer: 'Liberty', product: 'Liberty Life Plan', policyNo: 'L-900', premium: 500, lines: [{ type: 'other', label: 'Cover', life: { lump: 2000000 } }] }
};
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = ({ read: READ_ARG }) => {
    window.__api = []; window.__read = READ_ARG;
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
    async function png() { const c = document.createElement('canvas'); c.width = 600; c.height = 380; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 380); g.fillStyle = '#146c9c'; g.fillRect(30, 30, 540, 70); g.fillStyle = '#000'; g.font = '28px sans-serif'; g.fillText('Test Provider statement (picture)', 40, 160); return new Promise(r => c.toBlob(r, 'image/png')); }
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string' || (x && x.png)) { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(typeof x === 'string' ? x : await png()); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), x); } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  await p.evaluate(ff => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    s.blocks.group.items.push({ id: 'g-1', kind: 'risk', provider: 'Test Group Scheme', statementDate: null, paidBy: null, monthlyCost: null, life: { amount: null, endAge: null }, sev: { amount: null, endAge: null }, lsd: { amount: null, endAge: null }, ip: { amount: null, endAge: null }, ipWaiting: '', aci: null, abi: null, st: 'ff', src: { kind: 'factfind' }, by: 'page', removed: false });
    OV.app.setState(s); OV.app.openAll();
  }, FFJ);
  const waitDone = () => p.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  const st = () => p.evaluate(() => OV.app.state);

  /* ---- 1. Load from client folder: a schedule, an older and a newer Astute report ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const list = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => ({ t: l.textContent.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked })));
  const lf = n => list.filter(x => x.t.indexOf(n) >= 0)[0];
  ok(lf('20.08.26') && lf('20.11.26') && lf('Liberty Schedule'), '1. the folder lists both Astute reports (in the newest year folder) and the schedule: ' + list.map(x => x.t.slice(0, 40)).join(' | '));
  ok(lf('20.11.26') && lf('20.11.26').on && lf('20.08.26') && !lf('20.08.26').on, '1. only the NEWEST Astute report is ticked in the list: 2026 ' + (lf('20.11.26') || {}).on + ', 2025 ' + (lf('20.08.26') || {}).on);
  await p.evaluate(() => { [...document.querySelectorAll('dialog.fdlg .flist label')].forEach(l => { if (/20\.08\.26/.test(l.textContent)) l.querySelector('input').checked = true; }); });          // the adviser ticks the old one too
  await p.click('dialog.fdlg [data-yes]'); await waitDone(); await p.waitForTimeout(800);
  const api = await p.evaluate(() => window.__api.map(t => (/Astute report (\d\d\.\d\d\.\d\d)/.exec(t) || [])[1] || (/Liberty policy schedule/.test(t) ? 'liberty' : '?')));
  ok(api.indexOf('20.11.26') >= 0 && api.indexOf('20.08.26') < 0 && api.indexOf('liberty') >= 0, '1. even with the old report ticked only the newest is read (and the schedule): ' + api.join(', '));
  ok(await p.evaluate(() => OV.app.lastLog().some(l => /20\.08\.26.* was not read: a newer Astute report \(.*20\.11\.26.*\) was read instead/.test(l.msg))), '1. and the load says so for the old one');
  const S = await st(), pols = S.blocks.policies.items, bud = pols.filter(i => i.insurer === 'Budget Insurance')[0], br = pols.filter(i => i.insurer === 'BrightRock')[0], lib = pols.filter(i => i.insurer === 'Liberty')[0], grp = S.blocks.group.items[0];
  ok(bud.product === LONGP && bud.src.kind === 'astute' && bud.src.page === 4 && bud.lines.length === 1 && bud.lines[0].life.lump === 750000, '1. Budget Insurance came from the 2026 report (page 4), not the 2025 one: ' + bud.product.slice(0, 30) + ', life ' + bud.lines[0].life.lump);
  ok(br.wr && br.src.kind === 'astute' && br.src.page === 5 && br.policyNo === '700800900' && br.lines[0].life.lump === 2000000, '1. the Wealth Revolution BrightRock policy was filled too (page 5): ' + br.policyNo);
  ok(lib.src.kind === 'schedule' && lib.product === 'Liberty Life Plan' && lib.lines[0].life.lump === 2000000, '1. the Liberty policy keeps its SCHEDULE: Astute\'s "Should not win" did not touch it (' + lib.product + ', ' + lib.src.kind + ')');
  ok(grp.src.kind === 'astute' && grp.src.page === 6 && grp.life.amount === 1200000 && grp.sev.amount === 300000, '1. the group item was filled from the same report (page 6)');
  ok(S.blocks.policies.items.length === 3, '1. nothing was added to the policies');

  /* ---- 2. every View button opens its own page ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.evaluate(() => OV.view.warm()); await p.waitForTimeout(1500);
  const idx = ins => p.evaluate(n => OV.app.state.blocks.policies.items.findIndex(i => i.insurer === n), ins);
  const btn = path => p.$eval('[data-vw="' + path + '"]', e => ({ dis: e.disabled, t: e.title, text: e.textContent.trim() })).catch(() => null);
  const iB = await idx('Budget Insurance'), iR = await idx('BrightRock'), iL = await idx('Liberty');
  const bB = await btn('blocks.policies.items.' + iB), bR = await btn('blocks.policies.items.' + iR), bL = await btn('blocks.policies.items.' + iL);
  ok(bB && !bB.dis && bB.text === 'View Astute report' && bR && !bR.dis && bR.text === 'View Astute report', '2. both Astute-filled policies have an enabled "View Astute report" although they share ONE file: ' + JSON.stringify([bB && bB.dis, bR && bR.dis]));
  ok(bL && !bL.dis && bL.text === 'View policy schedule' && /Liberty Schedule L-900/.test(bL.t), '2. the Liberty policy has its schedule: ' + (bL && bL.t));
  await p.screenshot({ path: out + '/r14-policies.png' });
  const openAt = async (path, page, label) => {
    await p.evaluate(pth => document.querySelector('[data-vw="' + pth + '"]').scrollIntoView({ block: 'center' }), path); await p.click('[data-vw="' + path + '"]');
    await p.waitForSelector('.dvo .dvpage canvas', { timeout: 20000 }); await p.waitForTimeout(800);
    const w = await p.evaluate(() => { const paper = document.querySelector('.dvo .dvpaper'), pr = paper.getBoundingClientRect(), pg = [...document.querySelectorAll('.dvo .dvpage')]; return { title: document.querySelector('.dvo .dvt').textContent, sub: document.querySelector('.dvo .dvs').textContent, tops: pg.map(x => Math.round(x.getBoundingClientRect().top - pr.top)) }; });
    ok(/^Astute report: Astute Report - 20\.11\.26\.pdf$/.test(w.title) && new RegExp('page ' + page).test(w.sub) && Math.abs(w.tops[page - 1]) <= 20, '2. ' + label + ' opens the 2026 report at page ' + page + ': "' + w.title + '", "' + w.sub + '", page tops ' + JSON.stringify(w.tops));
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  };
  await openAt('blocks.policies.items.' + iB, 4, 'Budget Insurance'); await openAt('blocks.policies.items.' + iR, 5, 'the BrightRock policy');
  await p.evaluate(() => OV.app.go('group')); await p.waitForTimeout(500);
  const bG = await btn('blocks.group.items.0'); ok(bG && !bG.dis && bG.text === 'View Astute report', '2. the group item has its "View Astute report": ' + JSON.stringify(bG));
  await p.screenshot({ path: out + '/r14-group.png' }); await openAt('blocks.group.items.0', 6, 'the group item');

  /* ---- 3. a figure the adviser corrected is kept when the report is applied again ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(400);
  const lumpSel = '[data-p="blocks.policies.items.' + iB + '.lines.0.life.lump"]';
  await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), lumpSel); await p.fill(lumpSel, '900000'); await p.dispatchEvent(lumpSel, 'change'); await p.waitForTimeout(300);
  ok((await st()).blocks.policies.items[iB].lines[0].life.lump === 900000 && (await st()).blocks.policies.items[iB].lines[0].by === 'person', '3. the adviser corrected Budget Insurance\'s life cover to R900,000');
  await p.evaluate(() => { window.__api = []; }); await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist'); await p.click('dialog.fdlg [data-yes]'); await waitDone(); await p.waitForTimeout(800);
  const after = (await st()).blocks.policies.items[iB];
  ok(after.lines[0].life.lump === 900000 && after.lines[0].by === 'person', '3. loading the same Astute report again keeps his correction: ' + after.lines[0].life.lump);
  ok(after.src.kind === 'astute' && after.product === LONGP, '3. and the rest of the row is still the Astute row');

  /* ---- 4. a full-size quote that replaces two policies, one filled from Astute with a long product name ---- */
  await p.evaluate(() => {
    const s = OV.app.state, D = OV.docs;
    const lines = [{ type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 }, { type: 'child', name: 'Ann', sname: 'Scene', life: { lump: 100000, monthly: 3000 }, abi: 5 }, { type: 'child', name: 'Ben', sname: 'Scene', life: { lump: 100000, monthly: 3000 }, abi: 5 },
      { type: 'debt', debt: 'Home loan', life: { lump: 1000000, monthly: 14000 }, abi: 0 }, { type: 'debt', debt: 'Vehicle finance', life: { lump: 300000, monthly: 5000 }, abi: 0 }, { type: 'debt', debt: 'Credit card', life: { lump: 20000, monthly: 900 }, abi: 0 },
      { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 }, { type: 'dread', sev: { lump: 500000 }, abi: 3 }];
    const q = D.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500600', date: '19/11/2026', premium: 9000, aciText: 'Premiums rise with the age adjuster', lines }, 'BR FNA - 400500600 - 19.11.26.pdf').quote;
    D.applyCmp(s, { number: '400500600', rows: [{ key: 'total', today: 1000000, projected: 2000000 }, { key: 'retirement', today: 500000, projected: 900000 }, { key: 'child', name: 'Ann', today: 100000, projected: 150000 }, { key: 'child', name: 'Ben', today: 100000, projected: 150000 }] }, 'BR CMPO - 400500600.pdf');
    const p0 = 'blocks.fna.quotes.0'; OV.store.setStatus(s, p0, 'accepted'); OV.store.setUw(s, p0, 'both');
    for (let i = 0; i < 3; i++) { OV.store.addTerm(s, p0, 'loadings'); OV.store.addTerm(s, p0, 'exclusions'); }
    q.terms.loadings.forEach((l, i) => { l.pct = 25 + 25 * i; l.kind = ['medical', 'occupational', 'other'][i]; l.benefit = ['Life cover', 'Severe illness', 'All benefits'][i]; l.reason = 'Raised blood pressure at the medical in March, reviewed again after six months, the insurer asks for a loading for the first five years ' + i; });
    q.terms.exclusions.forEach((e, i) => { e.benefit = ['Income protector', 'Lump sum disability', 'Severe illness'][i]; e.what = 'A back injury and any related condition ' + i; e.why = 'A claim for a slipped disc in 2023 that the client reported on the form and that is still being treated ' + i; });
    OV.store.setRepl(s, p0, 'yes'); const ids = s.blocks.policies.items.filter(i => /Budget|Liberty/.test(i.insurer)).map(i => i.id); ids.forEach(id => OV.store.toggleReplaced(s, p0, id, true));
    s.blocks.policies.items.filter(i => i.insurer === 'Liberty')[0].brokerRecord = null;
    OV.app.redraw();
  });
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#main .uwblock').scrollIntoView({ block: 'start' })); await p.waitForTimeout(200); await p.screenshot({ path: out + '/r14-big-quote.png' });
  const noOverflow = await p.evaluate(() => { const m = document.querySelector('#main'); return m.scrollWidth <= m.clientWidth + 1; }); ok(noOverflow, '4. the entry screen does not scroll sideways with the full quote');
  const pdfFile = out + '/r14-overview.pdf', bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const pages = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdfFile]).toString())[1], 10), raw = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-raw', pdfFile, '-']).toString();
  let qp = 0, pp = 0; for (let i = 1; i <= pages; i++) { const t = raw(i); if (!qp && /Underwriting outcome/.test(t)) qp = i; if (!pp && /Will not be replaced|will be replaced by/.test(t) && /Current policies/.test(t)) pp = i; }
  ok(qp > 0 && /Replacing your existing policies/.test(raw(qp)) && /Change moment/i.test(raw(qp)) && /Raised blood pressure/.test(raw(qp)), '4. the PDF quote page holds the lines, the pay-out table, the terms and the replacements (page ' + qp + ')');
  const info = cp.execFileSync('pdfinfo', ['-f', String(qp), '-l', String(qp), pdfFile]).toString(); const size = /Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  ok(!!size && parseFloat(size[2]) > parseFloat(size[1]), '4. that PDF page is a tall page made to fit the content: ' + (size ? size[1] + ' x ' + size[2] + ' pt' : 'unknown'));
  const polTxt = pp ? raw(pp) : ''; ok(pp > 0 && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600/.test(polTxt.replace(/\s+/g, ' ')) && new RegExp(LONGP.slice(0, 30)).test(polTxt.replace(/\s+/g, ' ')) && /Astute 20\/11\/2026/.test(polTxt.replace(/\s+/g, ' ')), '4. the PDF policies page keeps the long product line, the Astute date and the red note apart (page ' + pp + ')');
  for (const [pg, name] of [[qp, 'quote'], [pp, 'policies']]) if (pg) cp.execFileSync('pdftoppm', ['-f', String(pg), '-l', String(pg), '-r', '80', '-png', '-singlefile', pdfFile, out + '/r14-pdf-' + name]);
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(400); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(600);
  const qScale = await p.evaluate(() => { const t = document.querySelector('#pres .ptbl'), e = document.querySelector('#pres'); return { th: Math.round(t.getBoundingClientRect().height), tw: Math.round(t.getBoundingClientRect().width), vh: innerHeight, sh: e.scrollHeight, ch: e.clientHeight }; });
  ok(qScale.sh <= qScale.ch + 1, '4. the full quote page ("The quote" sub-tab) fits the screen (' + qScale.sh + ' of ' + qScale.ch + ' px) with its table ' + qScale.tw + ' px wide');
  await p.screenshot({ path: out + '/r14-pres-quote.png' });
  await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(500);
  const ps = await p.evaluate(() => { const e = document.querySelector('#pres'), body = e.querySelector('.pmain') || e; return { sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, text: e.innerText.replace(/\s+/g, ' '), fs: parseFloat(getComputedStyle(document.querySelector('#pres .ptbl td') || e).fontSize) }; });
  ok(ps.sw <= ps.cw + 1 && /Underwriting outcome/.test(ps.text) && /Replacing your existing policies/.test(ps.text), '4. the Presentation shows the full quote with its terms and replacements without scrolling sideways (' + ps.sw + '/' + ps.cw + ', height ' + ps.sh + '/' + ps.ch + ', table text ' + ps.fs + ' px)');
  await p.screenshot({ path: out + '/r14-pres-uw.png' });
  await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(500); await p.screenshot({ path: out + '/r14-pres-policies.png' }); await p.evaluate(() => OV.present.close());

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
