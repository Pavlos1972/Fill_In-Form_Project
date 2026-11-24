/* The Client Overview Studio 0.95 on the real page (Paul, 23 November: a View button on every document-backed item, in the entry screen and in the Presentation, that opens the source PDF from the client's folder INSIDE the page,
   a large window with zoom and Close, Esc closes, back to exactly where he was), over a REAL directory tree in the browser's private file system with real (generated) PDFs and a picture: the BrightRock policy is shown by its policy
   SUMMARY schedule, never by the long owner's manual; a quote, a pay-out guide, a statement, a goal report and the legacy plan each have their button; a file that cannot be found greys the button with its reason (Studio) or hides it
   (Presentation); nothing is added to the saved file. Invented client ("View, Vera"). Screenshots (deviceScaleFactor 2): r6-studio, r6-window, r6-greyed, r6-quote, r6-pres, r6-pres-window. */
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
  NB: { 'View, Vera': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Vera View).json': '{}' },
    '3. Quotes': { 'BR FNA - 100000091 - 19.11.26.pdf': pdf(many('BrightRock FNA quote CP 100000091', 3)), 'Reduced 100000093 (renamed).pdf': pdf(many('BrightRock reduced quote CP 100000093', 2)), 'BR CMPO - 100000091.pdf': pdf(many('Change moment pay-out guide CP 100000091', 2)) },
    '4. Proposals': { 'Proposed Q-555.pdf': 'THIS IS NOT A PDF' },
    '5. Investments': { 'Test Provider Statement.png': { png: true } },
    '6. Policy Schedules': { 'BR Policy Summary Schedule - 8844.pdf': pdf(many('BrightRock policy summary schedule 8844', 2)), 'BR Owners Manual 8844.pdf': pdf(many('BrightRock owners manual 8844', 40)), 'BR Owners Manual 7777.pdf': pdf(many('BrightRock owners manual 7777', 40)),
      'BR Policy Summary Schedule - 5555.pdf': pdf(many('BrightRock policy summary schedule 5555', 40)), 'Liberty Schedule L-900.pdf': pdf(many('Liberty policy schedule L-900', 2)), 'Test Group Statement 2026.pdf': pdf(many('Test Group Co benefit statement', 1)),
      'Legacy Plan Schedule LP-1.pdf': pdf(many('Legacy plan schedule LP-1', 1)) },
    '7. Reports': { 'RGAR - 20.11.26.pdf': pdf(many('Retirement goal analysis report', 2)) } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Vera'), sname: v('View'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [['BrightRock', 'BR-8844'], ['Liberty', 'L-900'], ['BrightRock', 'BR-7777'], ['BrightRock', 'BR-5555'], ['Old Mutual', 'OM-1234']].map(r => ({ d: { prov: r[0], spend: 'R 900.00', broker: 'Other broker' } })), grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = () => {
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init);
  const errs = [];

  /* the invented client's overview: every kind of item that has a document */
  const setup = pg => pg.evaluate(ff => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    const pols = s.blocks.policies.items, one = n => pols.filter(i => i.insurer === n);
    const [br1, lib, br2, br3, om] = [one('BrightRock')[0], one('Liberty')[0], one('BrightRock')[1], one('BrightRock')[2], one('Old Mutual')[0]];
    const D = OV.docs, line = { type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 };
    D.applyPolicy(s, br1, { insurer: 'BrightRock', policyNo: '8844', product: 'Lifestyle', premium: 900, lines: [line] }, 'BR Policy Summary Schedule - 8844.pdf');
    D.applyPolicy(s, lib, { insurer: 'Liberty', policyNo: 'L-900', product: 'Liberty Life Plan', premium: 1371.68, benefits: { life: 'Whole of life' }, lines: [{ type: 'other', label: 'Cover', life: { lump: 2000000 } }] }, 'Liberty Schedule L-900.pdf');
    br2.policyNo = '7777'; br2.product = 'Lifestyle'; br3.policyNo = '5555'; br3.product = 'Lifestyle'; om.policyNo = 'OM-1234'; om.product = 'Test product';
    D.applyPolicy(s, br3, { insurer: 'BrightRock', policyNo: '5555', product: 'Lifestyle', premium: 700, lines: [line] }, 'BR Policy Summary Schedule - 5555.pdf');
    const q1 = D.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000091', date: '19/11/2026', premium: 5000, lines: [line] }, 'BR FNA - 100000091 - 19.11.26.pdf').quote;
    D.applyQuote(s, 'reduced', { insurer: 'BrightRock', number: '100000093', date: '19/11/2026', premium: 3000, lines: [line] }, 'BR Reduced Quote - 100000093 - 19.11.26.pdf');
    D.applyCmp(s, { number: '100000091', rows: [{ key: 'total', today: 100000, projected: 200000 }] }, 'BR CMPO - 100000091.pdf');
    s.blocks.group.items.push({ id: 'g-1', kind: 'risk', provider: 'Test Group Co', statementDate: '01/11/2026', paidBy: 'employer', monthlyCost: 900, life: { amount: 600000, endAge: 65 }, sev: { amount: null, endAge: null }, lsd: { amount: null, endAge: null }, ip: { amount: null, endAge: null }, ipWaiting: '', aci: null, abi: null, st: 'verify', by: 'page', src: { kind: 'group', file: 'Test Group Statement 2026.pdf', page: null, date: '01/11/2026' }, removed: false });
    const inv = s.blocks.investments.items; ['Test Provider', 'Test Other Provider', 'Test Lost Provider'].forEach((n, i) => { const it = OV.store.newInvestment ? OV.store.newInvestment() : { id: 'inv-' + i, wr: true, provider: '', product: '', st: 'empty', removed: false }; it.provider = n; it.product = 'RA'; it.id = it.id || 'inv-' + i; inv.push(it); });
    D.applyInvestment(s, inv[0], { product: 'RA', valueDate: '01/11/2026', gross: 100000, monthly: 0 }, 'Test Provider Statement.png', { kind: 'schedule' });
    D.applyInvestment(s, inv[2], { product: 'RA', valueDate: '01/11/2026', gross: 50000, monthly: 0 }, 'Gone Statement.pdf', { kind: 'schedule' });
    D.applyProposed(s, { provider: 'Test Provider', type: OV.schema.PROPOSED_TYPES[0], number: 'Q-555', lump: 100000 }, 'Proposed Q-555.pdf');
    D.applyGoal(s, { kind: 'rgar', currentValuePm: 20000, futureValuePm: 30000 }, 'RGAR - 20.11.26.pdf');
    D.applyOther(s, s.blocks.other.items.filter(i => i.key === 'legacy')[0], { insurer: 'Test Life', product: 'Legacy', policyNo: 'LP-1' }, 'Legacy Plan Schedule LP-1.pdf');
    s.blocks.fna.quotes.forEach(q => { q.status = 'proposed'; });
    OV.app.setState(s); OV.app.openAll();
  }, FFJ);

  /* ---- 0. folders NOT connected: the buttons are there, greyed with the reason (Studio) and not there at all (Presentation) ---- */
  const p0 = await ctx.newPage(); p0.on('pageerror', e => errs.push(String(e))); p0.on('dialog', d => d.accept());
  await p0.goto(addr + 'overview.html'); await p0.waitForTimeout(700); if (await p0.$('#restoreDraft')) await p0.click('#restoreNew');
  await setup(p0); await p0.waitForTimeout(300); await p0.evaluate(() => OV.app.go('policies')); await p0.waitForTimeout(300);
  const d0 = await p0.$$eval('#main .dvbtn', es => es.map(e => ({ dis: e.disabled, off: e.classList.contains('off'), t: e.title })));
  ok(d0.length >= 5 && d0.every(x => x.dis && x.off && /not connected/i.test(x.t)), '0. with no folder connected every View button on Current policies is greyed and says why on hover (' + d0.length + ' buttons): ' + (d0[0] || {}).t);
  await p0.evaluate(() => OV.present.open()); await p0.waitForTimeout(300); await p0.evaluate(() => OV.present.go('policies')); await p0.waitForTimeout(400);
  ok(await p0.evaluate(() => document.querySelectorAll('#pres .dvbtn').length > 0 && [...document.querySelectorAll('#pres .dvbtn')].every(e => e.hidden)), '0. in the Presentation a button that cannot open its file is not shown at all (nothing greyed in front of a client)');
  await p0.evaluate(() => OV.present.close()); await p0.close();

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
  await setup(p); await p.waitForTimeout(500); await p.evaluate(() => OV.app.go('policies')); await p.evaluate(() => OV.view.warm()); await p.waitForTimeout(1200);          // 0.96: the page never lists the folder by itself; the Presentation or a View click does, here the call it makes
  const polIdx = no => p.evaluate(n => OV.app.state.blocks.policies.items.findIndex(i => i.policyNo === n), no);
  const bt = async path => p.$eval('[data-vw="' + path + '"]', e => ({ dis: e.disabled, off: e.classList.contains('off'), hidden: e.hidden, t: e.title, text: e.textContent.trim() })).catch(() => null);

  /* ---- 1. the policies: a button each; the BrightRock one opens the SUMMARY schedule, never the manual ---- */
  const i8844 = await polIdx('8844'), i7777 = await polIdx('7777'), i5555 = await polIdx('5555'), iLib = await polIdx('L-900'), iOm = await polIdx('OM-1234');
  const pa = i => 'blocks.policies.items.' + i;
  await p.waitForTimeout(600);
  const b8844 = await bt(pa(i8844)), b7777 = await bt(pa(i7777)), bLib = await bt(pa(iLib)), bOm = await bt(pa(iOm));
  ok(b8844 && !b8844.dis && b8844.text === 'View policy schedule' && /BR Policy Summary Schedule - 8844\.pdf/.test(b8844.t), '1. the BrightRock policy 8844 has "View policy schedule" and says on hover which file it opens: ' + (b8844 || {}).t);
  ok(bLib && !bLib.dis && /Liberty Schedule L-900\.pdf/.test(bLib.t), '1. the Liberty policy has its own schedule');
  ok(b7777 && b7777.dis && b7777.off && /owner.s manual/.test(b7777.t) && !/Owners Manual 7777\.pdf'?\)? opens/.test(b7777.t), '1. a BrightRock policy with only the owner\'s manual in the folder (7777) gets NO file and the button says why: ' + (b7777 || {}).t);
  ok(bOm && bOm.dis && /No policy schedule for Old Mutual/.test(bOm.t), '1. a policy with no schedule anywhere is greyed with the reason: ' + (bOm || {}).t);
  await p.screenshot({ path: out + '/r6-studio.png' });
  await p.evaluate(() => { const e = document.querySelector('[data-vw].off'); if (e) e.scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: out + '/r6-greyed.png' });

  /* ---- 2. a click opens the window inside the page ---- */
  await p.evaluate(path => { const e = document.querySelector('[data-vw="' + path + '"]'); e.scrollIntoView({ block: 'center' }); document.getElementById('main').scrollTop += 30; }, pa(i8844)); await p.waitForTimeout(150);
  const before = await p.evaluate(() => ({ y: window.scrollY, m: document.getElementById('main').scrollTop }));
  await p.click('[data-vw="' + pa(i8844) + '"]');
  await p.waitForSelector('.dvo .dvpage canvas', { timeout: 20000 }); await p.waitForTimeout(400);
  const w1 = await p.evaluate(() => ({ n: document.querySelectorAll('.dvo .dvpage').length, title: document.querySelector('.dvo .dvt').textContent, pct: document.querySelector('.dvpct').textContent, role: document.querySelector('.dvo').getAttribute('role'), modal: document.querySelector('.dvo').getAttribute('aria-modal'), pages: window.open === undefined ? 0 : 1, tabs: 1, sub: document.querySelector('.dvs').textContent }));
  ok(w1.n === 2 && w1.title === 'Policy schedule: BR Policy Summary Schedule - 8844.pdf' && w1.pct === '100%' && w1.role === 'dialog' && w1.modal === 'true', '2. the window opens over the screen with the 2 pages of the SUMMARY schedule (not the 40-page manual): "' + w1.title + '", ' + w1.n + ' pages, ' + w1.pct);
  ok(!(await p.evaluate(() => document.querySelector('.dvwin .dvb, .dvwin a[href]'))), '2. there is no link in the window and no new tab (everything stays in this page)');
  const paintOk = await p.evaluate(() => { const c = document.querySelector('.dvpage canvas'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let blue = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 150 && d[i] < 80) blue++; return { w: c.width, h: c.height, blue }; });
  ok(paintOk.w > 800 && paintOk.blue > 2000, '2. the page is really drawn (pdf.js painted its blue bar): canvas ' + paintOk.w + 'x' + paintOk.h + ', ' + paintOk.blue + ' blue pixels');
  await p.screenshot({ path: out + '/r6-window.png' });
  /* zoom */
  const wd = () => p.evaluate(() => Math.round(document.querySelector('.dvpage').getBoundingClientRect().width));
  const w100 = await wd(); await p.click('.dvo [data-z="in"]'); await p.waitForTimeout(250); const w125 = await wd(), t125 = await p.evaluate(() => document.querySelector('.dvpct').textContent);
  ok(t125 === '125%' && Math.abs(w125 / w100 - 1.25) < 0.02, '3. the + button zooms to 125% (page ' + w100 + ' -> ' + w125 + ' px)');
  await p.keyboard.press('-'); await p.waitForTimeout(200); await p.keyboard.press('-'); await p.waitForTimeout(250); const t80 = await p.evaluate(() => document.querySelector('.dvpct').textContent);
  ok(t80 === '80%', '3. the minus key zooms out (' + t80 + ')');
  await p.click('.dvo [data-z="fit"]'); await p.waitForTimeout(200); ok((await p.evaluate(() => document.querySelector('.dvpct').textContent)) === '100%', '3. the % button fits the window again');
  const crisp = await p.evaluate(() => { const c = document.querySelector('.dvpage canvas'); return c && c.width >= document.querySelector('.dvpage').getBoundingClientRect().width * 1.5; });
  ok(crisp, '3. the page is drawn at the screen\'s own sharpness (canvas at least 1.5 x its width)');
  /* Esc closes and the screen is exactly where it was */
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const after = await p.evaluate(() => ({ y: window.scrollY, m: document.getElementById('main').scrollTop, open: !!document.querySelector('.dvo'), focus: document.activeElement && document.activeElement.getAttribute('data-vw') }));
  ok(!after.open && after.y === before.y && after.m === before.m, '4. Esc closes the window and the screen is exactly where it was (scroll ' + before.m + ' -> ' + after.m + ')');
  ok(after.focus === pa(i8844), '4. the focus goes back to the button that opened it');
  /* the Close button, and a click on the dark edge */
  await p.click('[data-vw="' + pa(i8844) + '"]'); await p.waitForSelector('.dvo .dvpage canvas'); await p.click('.dvo .dvclose'); await p.waitForTimeout(200);
  ok(!(await p.$('.dvo')), '4. the Close button closes it too');
  /* the 40-page "summary schedule" warns that it may be the manual */
  await p.click('[data-vw="' + pa(i5555) + '"]'); await p.waitForSelector('.dvo .dvpage'); await p.waitForTimeout(500);
  const warn = await p.evaluate(() => document.querySelector('.dvs').textContent); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(/40 pages.*owner.s manual/.test(warn), '5. a BrightRock schedule file of 40 pages says it may be the owner\'s manual: "' + warn + '"');
  /* a greyed button does nothing */
  const dis = await p.$eval('[data-vw="' + pa(i7777) + '"]', e => e.disabled); ok(dis, '5. a greyed button cannot be clicked');

  /* ---- 3. quotes, the pay-out guide, the renamed file ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(600);
  const fq = await bt('blocks.fna.quotes.0'); ok(fq && !fq.dis && fq.text === 'View quote' && /BR FNA - 100000091/.test(fq.t), '6. the FNA quote has "View quote" beside its name: ' + (fq || {}).t);
  const gd = await bt('blocks.fna.quotes.0.cmp'); ok(gd && !gd.dis && gd.text === 'View guide' && /BR CMPO - 100000091/.test(gd.t), '6. its change moment pay-out has "View guide"');
  await p.screenshot({ path: out + '/r6-quote.png' });
  await p.click('[data-vw="blocks.fna.quotes.0.cmp"]'); await p.waitForSelector('.dvo .dvpage canvas'); const gt = await p.evaluate(() => document.querySelector('.dvt').textContent); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(gt === 'Change moment pay-out guide: BR CMPO - 100000091.pdf', '6. the guide opens: "' + gt + '"');
  await p.evaluate(() => OV.app.go('reduced')); await p.waitForTimeout(500);
  const rq = await bt('blocks.reduced.quotes.0'); ok(rq && !rq.dis && /Reduced 100000093 \(renamed\)\.pdf/.test(rq.t), '7. a quote whose file was renamed is still found by its CP number: ' + (rq || {}).t);
  await p.click('[data-vw="blocks.reduced.quotes.0"]'); await p.waitForSelector('.dvo .dvpage canvas'); const rt = await p.evaluate(() => document.querySelector('.dvt').textContent); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(/Quote: Reduced 100000093/.test(rt), '7. and opens: "' + rt + '"');

  /* ---- 4. statements, a picture, a broken file, a goal report, the legacy plan ---- */
  await p.evaluate(() => OV.app.go('group')); await p.waitForTimeout(500);
  ok((await bt('blocks.group.items.0')).text === 'View statement' && !(await bt('blocks.group.items.0')).dis, '8. a group benefit statement has "View statement"');
  await p.evaluate(() => OV.app.go('investments')); await p.waitForTimeout(500);
  const i0 = await bt('blocks.investments.items.0'), i1 = await bt('blocks.investments.items.1'), i2 = await bt('blocks.investments.items.2');
  ok(i0 && !i0.dis && i1 === null && i2 && i2.dis && /not in the client.s folder any more/.test(i2.t), '8. an investment that was read from a statement has a button, one with no statement has none, one whose file is gone is greyed with the reason: ' + (i2 || {}).t);
  await p.click('[data-vw="blocks.investments.items.0"]'); await p.waitForSelector('.dvo .dvimg', { timeout: 15000 }); await p.waitForTimeout(300);
  const im = await p.evaluate(() => { const i = document.querySelector('.dvimg'); return { w: i.naturalWidth, shown: Math.round(i.getBoundingClientRect().width), t: document.querySelector('.dvt').textContent }; });
  ok(im.w === 600 && im.shown > 600 && /Statement: Test Provider Statement\.png/.test(im.t), '9. a picture opens in the same window, fitted to the width (natural ' + im.w + ' px, shown ' + im.shown + ' px)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.evaluate(() => OV.app.go('proposed')); await p.waitForTimeout(500);
  const pp = await bt('blocks.proposed.items.0'); ok(pp && !pp.dis && pp.text === 'View quote', '10. a proposed investment has "View quote"');
  await p.click('[data-vw="blocks.proposed.items.0"]'); await p.waitForSelector('.dvo.native .dvframe, .dvo .dvmsg.bad', { timeout: 15000 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('.dvo.native .dvframe') && !document.querySelector('.dvo .dvpage')), '10. a file pdf.js cannot read falls back to the browser\'s own viewer in the same window (no error page)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.evaluate(() => OV.app.go('goals')); await p.waitForTimeout(500);
  ok((await bt('blocks.goals.items.0')).text === 'View report' && !(await bt('blocks.goals.items.0')).dis, '11. a goal analysis report has "View report"');
  await p.evaluate(() => OV.app.go('other')); await p.waitForTimeout(500);
  const li = await p.evaluate(() => OV.app.state.blocks.other.items.findIndex(i => i.key === 'legacy'));
  ok((await bt('blocks.other.items.' + li)).text === 'View policy schedule' && (await p.$$('[data-vw]')).length === 1, '12. only the legacy protection plan has a button in block 11 (the other covers have no document)');
  const strip = j => { const o = JSON.parse(j); delete o.modified; return JSON.stringify(o); };
  const snap = () => p.evaluate(() => OV.store.toJSON(OV.app.state)), s1 = await snap();
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('[data-vw].dvbtn:not(.off)').click()); await p.waitForSelector('.dvo .dvpage canvas'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const s2 = await snap(); ok(strip(s1) === strip(s2) && !/"(view|viewed|files)"/.test(s2), '13. nothing is added to the saved file by looking at a document (the same file apart from its saved time)');

  /* ---- 5. the Presentation: clean, inside the full-screen element, a click never opens the row behind it ---- */
  await p.evaluate(() => OV.present.open(true)); await p.waitForTimeout(500); await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(700);
  const pv = await p.$$eval('#pres .dvbtn', es => es.map(e => ({ hidden: e.hidden, t: e.textContent.trim(), cls: e.className })));
  ok(pv.length >= 5 && pv.filter(x => !x.hidden).length === 3 && pv.every(x => /dvp/.test(x.cls)), '14. on the Presentation\'s policy list the 3 policies that can be opened have a button and the others have none (shown ' + pv.filter(x => !x.hidden).length + ' of ' + pv.length + ')');
  await p.screenshot({ path: out + '/r6-pres.png' });
  const first = await p.evaluate(() => { const e = [...document.querySelectorAll('#pres .dvbtn')].filter(x => !x.hidden)[0]; return e.getAttribute('data-vw'); });
  await p.click('#pres [data-vw="' + first + '"]'); await p.waitForSelector('.dvo.dvpres .dvpage canvas', { timeout: 20000 }); await p.waitForTimeout(500);
  const pw = await p.evaluate(() => { const o = document.querySelector('.dvo'); return { inside: !!o.closest('#pres'), fs: !!document.fullscreenElement, parent: o.parentElement.id || o.parentElement.tagName, still: OV.present.ps.pol, h: Math.round(o.querySelector('.dvwin').getBoundingClientRect().height), vh: innerHeight, title: o.querySelector('.dvt').textContent }; });
  ok(pw.still === null && /^Policy schedule: /.test(pw.title), '15. clicking View never opens the policy row behind it: "' + pw.title + '"');
  ok(pw.h >= pw.vh * 0.9, '15. in the Presentation the window uses nearly the whole screen (' + pw.h + ' of ' + pw.vh + ' px)');
  ok(pw.fs ? pw.inside : true, '15. when the Presentation is full screen the window is inside the full-screen element (parent ' + pw.parent + ', full screen ' + pw.fs + ')');
  await p.screenshot({ path: out + '/r6-pres-window.png' });
  const tab0 = await p.evaluate(() => OV.present.ps.tab); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok(await p.evaluate(t => OV.present.ps.tab === t, tab0), '16. the arrow keys do not move the Presentation while the window is open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok(!(await p.$('.dvo')) && await p.evaluate(() => OV.present.isOpen), '16. Esc closes only the window: the Presentation stays open');
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(500);
  const pq = await p.$$eval('#pres .dvbtn:not([hidden])', es => es.map(e => e.textContent.trim())); ok(pq.indexOf('View quote') >= 0, '17. the quote page has "View quote": ' + pq.join(', '));
  await p.click('#pres .dvbtn:not([hidden])'); await p.waitForSelector('.dvo.dvpres .dvpage canvas', { timeout: 20000 }); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.evaluate(() => OV.present.close()); await p.waitForTimeout(200);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
