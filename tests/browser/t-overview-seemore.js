/* The Client Overview Studio 0.7 on the real page (Paul's changes of 22 November after using 0.6): See more / See less under each row or heading, a quote's lines without the remove column and the add buttons, ABI with its %,
   the ACI as the quote words it ("7.5% + age rater" / "10% fixed"), child care waiting N/A, the R in every box, one Checks line for each document read, the Undo notice that goes after about 10 seconds, block 11 "from Fact Find"
   with no upload (except the legacy plan), the PDF without the pages that have nothing to say (grey tabs) and a cover that is white with a blue strip, and the white Presentation with the logo and the same pages left out.
   Invented client ("See, Sam"): no real client data. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Sam' }, sname: { v: 'See' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' }, bf_sf_req: { v: 'Request a quote' }, fna_req: { v: 'Request a quote' }, rgar_req: { v: 'Request a quote' }, egar_req: { v: 'Not required' },
  ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' }, ma_broker: { v: 'Paul K' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'See', cost: 'R 5 000.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Our Insurer', spend: 'R 900.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: [], bfred: [] } };

srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.goto(base + 'overview.html'); await pg.waitForTimeout(500);
  await pg.evaluate(ff => {
    const S = OV.store, D = OV.docs, st = S.blank(); S.fillFromFactFind(st, JSON.stringify(ff), 'ff.json');
    D.applyPolicy(st, st.blocks.policies.items[0], { insurer: 'Other Insurer', policyNo: 'P-100', premium: 1200, aci: 10, aciText: 'CPI + 2%', abi: 5, lines: [{ type: 'other', label: 'Cover', life: { lump: 1000000 }, ip: { monthly: 10000 } }] }, 'sched.pdf');
    const fna = D.applyQuote(st, 'fna', { insurer: 'BrightRock', number: '100000001', date: '19/11/2026', aci: 7.5, aciText: '7.5% + age rater', premium: 2900, lines: [
      { type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 }, { type: 'child', name: 'Amy', sname: 'See', life: { lump: 500000, monthly: 5000 }, abi: 5 }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1200000, monthly: 12000 }, ip: { monthly: 12000 }, abi: 0 },
      { type: 'death', life: { lump: 600000, monthly: 7500 }, abi: 3 }, { type: 'dread', sev: { lump: 500000 }, abi: 3 }] }, 'fna.pdf').quote;
    D.applyQuote(st, 'reduced', { insurer: 'BrightRock', number: '100000002', aci: 10, premium: 1400, lines: [{ type: 'household', life: { lump: 300000, monthly: 2000 }, abi: 5 }] }, 'red.pdf');
    const cmp = S.addQuote(st, 'comparative'); cmp.insurer = 'Other Co'; cmp.number = '555';
    const bare = S.addQuote(st, 'shortfall'); bare.number = '777'; bare.lines = [];
    OV.app.setState(st);
  }, FFJ);
  const go = async id => { await pg.evaluate(i => OV.app.go(i), id); await pg.waitForTimeout(150); };

  /* ---- 1. block 1: the summary at the top, the detail cards hidden, See more opens a policy's detail directly under its row ---- */
  await go('policies');
  ok(await pg.evaluate(() => document.querySelectorAll('table.pols button.see').length === 2 && !document.querySelector('#main .qcard')), '1. the summary table has a See more button on each policy row and no detail card is showing');
  await pg.click('table.pols button.see >> nth=0'); await pg.waitForTimeout(150);
  const geo = await pg.evaluate(() => { const rows = [...document.querySelectorAll('table.pols tr.pol')], dtl = document.querySelector('table.pols tbody.dtl'), r0 = rows[0].getBoundingClientRect(), r1 = rows[1].getBoundingClientRect(), d = dtl.getBoundingClientRect(); return { under: d.top >= r0.bottom - 1, pushed: r1.top >= d.bottom - 1, text: document.querySelector('table.pols button.see').textContent, card: !!dtl.querySelector('.qcard') }; });
  ok(geo.card && geo.under && geo.pushed && geo.text === 'See less', '1. See more opens that policy\'s whole detail directly under its row and pushes the next row down; the button then says See less: ' + JSON.stringify(geo));
  await pg.fill('#main table.pols tbody.dtl [data-p$=".premium"]', '1500'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.activeElement && /\.premium$/.test(document.activeElement.getAttribute('data-p') || '') && /R1,500/.test(document.querySelector('table.pols tr.pol').textContent)), '1. typing in the open detail updates the summary row and keeps the cursor in the box');
  await pg.evaluate(() => document.activeElement.blur()); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.querySelector('table.pols tbody.dtl [data-p$=".premium"]').value === 'R1,500' && document.querySelector('table.pols tbody.dtl [data-p$=".aci"]').value === '10%'), '1. an amount box shows its R and a percentage its % when the box is left (R1,500, 10%)');
  await pg.screenshot({ path: out + '/seemore-policies.png' });
  await pg.click('table.pols button.see.open'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !document.querySelector('table.pols tbody.dtl') && document.querySelector('table.pols button.see').textContent === 'See more'), '1. See less folds it again');
  ok(await pg.evaluate(() => /CPI \+ 2%/.test(document.querySelector('table.pols tr.pol').textContent)), '1. the policy\'s ACI shows the schedule\'s own words');

  /* ---- 2. a quote: heading only when folded; open: no remove column, no add buttons, ABI with %, ACI words, child waiting N/A, R in every box ---- */
  await go('fna');
  const f = await pg.evaluate(() => { const c = document.querySelector('#main .qcard'); return { folded: c.classList.contains('folded'), title: c.querySelector('h3').textContent, table: !!c.querySelector('table'), see: c.querySelector('.see').textContent }; });
  ok(f.folded && !f.table && /^BrightRock FNA CP 100000001/.test(f.title) && f.see === 'See more', '2. a folded quote shows only its heading: ' + JSON.stringify(f));
  await pg.click('#main .qcard .see'); await pg.waitForTimeout(150);
  const q = await pg.evaluate(() => {
    const c = document.querySelector('#main .qcard'), t = c.querySelector('table.lines'), heads = [...t.querySelectorAll('thead th')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const abi = [...t.querySelectorAll('[data-p$=".abi"]')].map(i => i.value), money = [...t.querySelectorAll('input.amt[data-k="money"]')].map(i => i.value).filter(Boolean);
    const kid = [...t.querySelectorAll('tr.ln')].find(r => /Child care/.test(r.textContent));
    return { heads, xbtn: t.querySelectorAll('.xbtn').length, adders: c.querySelectorAll('.adders .addrow').length, abi, moneyOk: money.length > 5 && money.every(v => /^R[\d,.]+$/.test(v)), aci: t.querySelector('tbody td .aci').textContent, kidWait: kid.cells[6].textContent.trim(),
      totals: t.querySelector('tr.tot.lump').textContent, cols: t.querySelectorAll('colgroup col').length };
  });
  ok(q.heads.length === 9 && q.heads[8] === 'ABI' && q.xbtn === 0 && q.cols === 9, '2. a quote\'s lines have nine columns: no remove (X) column to the right of ABI: ' + JSON.stringify(q.heads));
  ok(q.adders === 0, '2. no + Household needs / + Child care / + Debt / + Death-related needs / + Additional expense needs / + Other line buttons under a filled quote');
  ok(q.abi.length >= 5 && q.abi.every(v => /%$/.test(v)) && q.abi.includes('3%') && q.abi.includes('0%'), '2. ABI always shows its % sign: ' + JSON.stringify(q.abi));
  ok(q.aci === '7.5% + age rater', '2. the ACI copies the quote\'s own words: ' + q.aci);
  ok(q.kidWait === 'N/A', '2. a child care line\'s waiting period is N/A by default: ' + q.kidWait);
  ok(q.moneyOk, '2. every rand amount in the boxes shows the R in front');
  ok(await pg.evaluate(() => { const l = [...document.querySelectorAll('#main .qcard table.lines tr.ln small.sm')].map(x => x.textContent); return l.includes('Income portion p.m.') && l.includes('Monthly instalment'); }), '2. the monthly figure under a lump sum says "Income portion p.m." (per month)');
  await pg.screenshot({ path: out + '/seemore-fna.png' });
  await go('reduced'); await pg.click('#main .qcard .see'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => document.querySelector('#main .qcard table.lines tbody td .aci').textContent === '10% fixed' && /^BrightRock Reduced Quote CP 100000002/.test(document.querySelector('#main .qcard h3').textContent)), '2. a quote that gives only a figure shows 10% fixed, under the heading BrightRock Reduced Quote CP …');
  await go('shortfallQuote'); await pg.click('#main .qcard .see'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => document.querySelectorAll('#main .qcard .adders .addrow').length === 0 && !document.querySelector('#main .qcard .xbtn') && /Nothing was read into this quote yet/.test(document.querySelector('#main .qcard').textContent)), '2. a quote with nothing in it yet has no add-line buttons either (round 2.0): it says to load its document');
  await go('comparative'); await pg.click('#main .qcard .see'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => document.querySelectorAll('#main .qcard .adders .addrow').length === 0 && !document.querySelector('#main .qcard .xbtn')), '2. a comparative quote with its Cover line has no add buttons and no remove column either');

  /* ---- 3. the other blocks: See more on investments, proposed investments, goal reports; block 11 ---- */
  await go('investments');
  ok(await pg.evaluate(() => document.querySelectorAll('table.inv button.see').length === 1 && !document.querySelector('#main .qcard')), '3. current investments: a See more on the row, no card showing');
  await pg.click('table.inv button.see'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !!document.querySelector('table.inv tbody.dtl .qcard') && /R50,000/.test(document.querySelector('table.inv tbody.dtl [data-p$=".gross"]').value)), '3. it opens the investment\'s detail under its row (amounts with their R)');
  await go('proposed');
  ok(await pg.evaluate(() => document.querySelectorAll('table.prop button.see').length === 1 && !document.querySelector('table.prop input')), '3. proposed investments: a read-only summary with a See more on each row');
  await pg.click('table.prop button.see'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !!document.querySelector('table.prop tbody.dtl .qcard [data-p$=".monthly"]') && /^R5,000/.test(document.querySelector('table.prop tbody.dtl [data-p$=".monthly"]').value)), '3. it opens the proposal\'s boxes under its row');
  await go('goals');
  ok(await pg.evaluate(() => { const c = [...document.querySelectorAll('#main .qcard')]; return c.length === 2 && c.every(x => x.classList.contains('folded') && !x.querySelector('.grid')) && /Retirement Goal Analysis Report/.test(c[0].querySelector('h3').textContent); }), '3. goal analysis reports: folded, only the heading shows');
  await pg.click('#main .qcard .see'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !!document.querySelector('#main .qcard .grid [data-p$=".currentValuePm"]')), '3. See more opens the report\'s boxes');
  await go('other');
  const o = await pg.evaluate(() => ({ text: document.querySelector('#main').textContent, badges: [...document.querySelectorAll('#main .badge.ff')].map(x => x.textContent), ups: [...document.querySelectorAll('#main [data-upi]')].map(x => x.getAttribute('data-upi')), cards: document.querySelectorAll('#main .qcard').length }));
  ok(!/waiting for document/.test(o.text) && o.badges.length >= 1 && o.badges.every(t => t === 'from Fact Find'), '4. block 11 says "from Fact Find" and never "waiting for document": ' + JSON.stringify(o.badges));
  ok(o.ups.length === 1 && /\|other$/.test(o.ups[0]) && /items\.3\|other/.test(o.ups[0]), '4. only the legacy protection plan has an upload: ' + JSON.stringify(o.ups));
  await pg.click('#main .badge.ff >> nth=0'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => OV.app.state.blocks.other.items.filter(i => i.st === 'confirmed').length === 1), '4. a click on "from Fact Find" confirms it');

  /* ---- 5. the Checks panel: one line per document read; the Undo notice goes after about 10 seconds ---- */
  await go('fna');
  const ck = await pg.evaluate(() => ({ lines: [...document.querySelectorAll('#checks .docline')].map(x => x.textContent.trim()), all: !!document.querySelector('#checks details.allchecks'), open: !!document.querySelector('#checks details.allchecks[open]') }));
  ok(ck.lines.some(t => /^BrightRock FNA CP 100000001: \d+ to check/.test(t)) && ck.lines.some(t => /^BrightRock Reduced Quote CP 100000002/.test(t)) && ck.lines.some(t => /Other Insurer P-100/.test(t)), '5. one Checks line for each document read: ' + JSON.stringify(ck.lines));
  ok(ck.all && !ck.open, '5. the long list of individual checks is folded, one click away');
  await pg.evaluate(() => { const s = OV.app.state; s.settings.tolerance = 1e9; OV.store.acceptAll(s); const q = s.blocks.fna.quotes[0]; q.aci = 10; q.cmp = { number: q.number, activationDate: null, reason: null, rows: [{ key: 'total', today: 1, projected: 2 }], st: 'confirmed', by: 'person', src: { kind: 'typed' } }; OV.app.redraw(); });
  await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#checks .docline.ok')].some(x => /BrightRock FNA CP 100000001 checked/.test(x.textContent)) && [...document.querySelectorAll('#checks .docline.ok')].some(x => /BrightRock FNA CP 100000001 change moment pay-out checked/.test(x.textContent))), '5. "BrightRock FNA CP 100000001 checked" and one for its change moment pay-out');
  if (!await pg.evaluate(() => !!document.querySelector('#main .qcard [data-del]'))) { await pg.click('#main .qcard .see'); await pg.waitForTimeout(100); }
  await pg.click('#main .qcard [data-del]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => /BrightRock FNA CP 100000001 removed\./.test(document.querySelector('#main .gone').textContent) && !!document.querySelector('#main .gone [data-undo]')), '6. "BrightRock FNA … removed. Undo" shows after removing a quote');
  await pg.waitForTimeout(10500);
  ok(await pg.evaluate(() => !document.querySelector('#main .gone')), '6. the notice has gone after about 10 seconds');

  /* ---- 7. the PDF: the pages that have nothing to say are left out and their tab is greyed; a white cover with a blue strip ---- */
  const pdfInfo = await pg.evaluate(() => { const st = OV.app.state; st.blocks.fna.quotes[0].removed = false; OV.app.setState(st); const d = OV.app.makePdf(); return { pages: d.internal.getNumberOfPages(), ids: OV.pdf.pagesOf(st).ids }; });
  ok(pdfInfo.pages === pdfInfo.ids.length && pdfInfo.ids.length === 12, '7. with a shortfall quote, a comparative quote, a proposal and a goal report asked for, the PDF has all twelve pages');
  const lean = await pg.evaluate(() => { const st = OV.store.blank(); st.header.fname = 'Lean'; st.header.sname = 'Client'; OV.app.setState(st); const d = OV.app.makePdf(); const pdf = d.output('datauristring'); return { pages: d.internal.getNumberOfPages(), ids: OV.pdf.pagesOf(st).ids, pdf }; });
  ok(lean.pages === 6 && lean.ids.join(',') === 'cover,policies,group,investments,other,shortfall', '7. with none of those (round 2.1: no quote, no proposal, no goal report) only the cover and the five pages of Where the client is now are printed: ' + lean.ids.join(', '));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seemore-')), pf = path.join(tmp, 'lean.pdf'); fs.writeFileSync(pf, Buffer.from(lean.pdf.split(',')[1], 'base64'));
  const txt = cp.execFileSync('pdftotext', ['-layout', pf, '-'], { encoding: 'utf8' });
  ok(/There are no group benefits in place\./.test(txt) && /There are no personal investments in place\./.test(txt) && /There are no current investments in place\./.test(txt), '7. the empty group page and the empty investments page say so');
  ok(/by Broker Paul Kafentzis/.test(txt), '7. the cover says "Prepared … by Broker Paul Kafentzis"');
  cp.execFileSync('pdftoppm', ['-r', '30', '-png', '-f', '1', '-l', '1', pf, path.join(tmp, 'cover')]);
  const png = fs.readdirSync(tmp).filter(n => /^cover.*\.png$/.test(n))[0], data = fs.readFileSync(path.join(tmp, png)).toString('base64');
  const px = await pg.evaluate(async d => {
    const img = new Image(); await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const at = (fx, fy) => [...g.getImageData(Math.floor(img.width * fx), Math.floor(img.height * fy), 1, 1).data].slice(0, 3);
    let blue = 0, white = 0; for (let y = 0; y < img.height; y++) { const p = g.getImageData(Math.floor(img.width * 0.05), y, 1, 1).data; if (p[2] > 200 && p[0] < 90) blue++; else if (p[0] > 245 && p[1] > 245 && p[2] > 245) white++; }
    return { top: at(0.5, 0.2), strip: at(0.05, 0.5), bottom: at(0.5, 0.9), blueFrac: blue / img.height, whiteFrac: white / img.height };
  }, data);
  const isW = p => p.every(v => v > 245), isB = p => p[2] > 200 && p[0] < 90;
  ok(isW(px.top) && isB(px.strip) && isW(px.bottom) && px.blueFrac > 0.15 && px.blueFrac < 0.45 && px.whiteFrac > 0.5, '7. the cover is white with a blue strip across the middle, not blue all over: ' + JSON.stringify(px));
  fs.copyFileSync(path.join(tmp, png), out + '/seemore-cover.png');

  /* ---- 8. the Presentation: white, the logo, the same pages left out ---- */
  await pg.evaluate(() => { OV.app.setState(OV.store.blank()); const st = OV.app.state; st.header.fname = 'Lean'; st.header.sname = 'Client'; OV.app.setState(st); });
  await pg.click('#btnPresent'); await pg.waitForTimeout(500);
  const pr = await pg.evaluate(() => {
    const root = document.querySelector('#pres'), cs = getComputedStyle(root), logo = root.querySelector('img.plogo'), tabs = [...root.querySelectorAll('.ptab')], cards = [...root.querySelectorAll('.pcard')];
    return { bg: cs.backgroundColor, logo: !!logo && logo.complete && logo.naturalWidth > 0 && logo.getBoundingClientRect().width > 20, tabs: tabs.map(t => t.textContent).join(), off: root.querySelectorAll('.ptab.off, .ptab:disabled, .pcard.off, .pcard:disabled').length, cards: cards.length };
  });
  ok(pr.bg === 'rgb(255, 255, 255)', '8. the Presentation has a white background: ' + pr.bg);
  ok(pr.logo, '8. the Wealth Revolution logo is in the bar');
  ok(pr.tabs === 'Overview,Current policies,Group benefits,Investments,Other,Shortfall' && pr.off === 0 && pr.cards === 11, '8. with nothing in the overview the Overview tab and the five tabs of Where the client is now are there and open (round 2.1; the quote and investment headings are not shown), and the Overview still shows its eleven cards: ' + JSON.stringify(pr));
  await pg.screenshot({ path: out + '/seemore-present-map.png' });
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => OV.present.ps.tab === 'policies'), '8. next goes to Current policies: the five pages of Where the client is now are always open (round 2.1)');
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => OV.present.ps.tab === 'map' && document.querySelectorAll('.pcard.bright').length === 2), '8. back returns to the Overview, where only the two cards of pages that can be opened (Current policies and Shortfall) are bright: no quote, no card for a quote');
  await pg.keyboard.press('Escape');
  await pg.evaluate(ff => { const S = OV.store, D = OV.docs, st = S.blank(); S.fillFromFactFind(st, JSON.stringify(ff), 'ff.json');
    D.applyQuote(st, 'fna', { insurer: 'BrightRock', number: '100000001', aci: 7.5, aciText: '7.5% + age rater', premium: 2900, lines: [{ type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 }, { type: 'child', name: 'Amy', sname: 'See', life: { lump: 500000, monthly: 5000 }, abi: 5 }] }, 'fna.pdf'); OV.app.setState(st); }, FFJ);
  await pg.click('#btnPresent'); await pg.waitForTimeout(400);
  await pg.evaluate(() => OV.present.go('fna')); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /7\.5% \+ age rater/.test(document.querySelector('#pSlide').textContent) && /R800,000/.test(document.querySelector('#pSlide').textContent)), '8. the Presentation shows the full quote with the ACI in the quote\'s words');
  await pg.screenshot({ path: out + '/seemore-present-quote.png' });
  await pg.keyboard.press('Escape');
  ok(errs.length === 0, '9. no script error on the page' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
