/* Client Overview Studio 1.3 on the real page: Paul's FOUR PILLARS (24 November, 22:15 to 22:30). One invented client ("Pillar, Pia"), an accepted FNA quote with a counter offer whose letter has a loading under each of the four pillars and two
   exclusions, every line type with real amounts (household, child care, a debt with an instalment protector, death-related, additional expense). What it proves, on the Studio's screen, in the Presentation and in the PDF:
   (1) a red reference sits under its PILLAR on EVERY need line that has an amount there: permanent on household, child care and debt; caused by death on household, child care, debt AND death-related; recover from under the INCOME PROTECTOR
       only; the additional expense row's loading and exclusion only under ITS severe illness; (2) never a red reference in a cell that is N/A, "-" or R0; (3) the totals row carries each pillar's references; (4) the terms table says one pillar
       for each loading (Income protector, Lump sum disability, Life cover, Severe illness), an exclusion printed in two cells lists its two pillars, and the words "severe illness and income protector" appear nowhere.
   Screenshots r16-pillars-studio, r16-pillars-pres, r16-pillars-terms, r16-pillars-pdf. */
const cp = require('child_process');
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Pia'), sname: v('Pillar'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') }, l: { kids: [], debts: [], risk: [] } };
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 };
const CHILD = { type: 'child', name: 'Ann', sname: 'Pillar', life: { lump: 100000, monthly: 3000 }, abi: 5 };
const DEBT = { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1000000, monthly: 14000 }, ip: { monthly: 14000 }, abi: 0, accelerated: false };
const DEATH = { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 };
const DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
const LETTER = { originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 3, exclusionsPage: 4, cells: [
  { need: 'needs', column: 'recover', loading: 9, exclusions: ['4*'] }, { need: 'needs', column: 'permanent', loading: 14, exclusions: ['5*'] }, { need: 'needs', column: 'death', loading: 6, exclusions: [] }, { need: 'dread', column: 'recover', loading: 11, exclusions: ['4*'] }],
  exclusions: [{ no: '4*', type: 'Medical', what: 'No cover for conditions of the lower back', page: 4 }, { no: '5*', type: 'Occupational', what: 'No cover for a hazardous pursuit', page: 4 }], notes: null };
/* what each line must show under life, severe illness, lump sum disability, income protector (a reference joins its parts with a bar) */
const WANT = {
  household: ['+6% loading', '', '+14% loading|Exclusion 5*', '+9% loading|Exclusion 4*'],
  child: ['+6% loading', '', '', ''],
  debt: ['+6% loading', '', '+14% loading|Exclusion 5*', '+9% loading|Exclusion 4*'],
  death: ['+6% loading', '', '', ''],
  dread: ['', '+11% loading|Exclusion 4*', '', '']
};
const ORDER = ['household', 'child', 'debt', 'death', 'dread'];
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); }); p.on('pageerror', e => { errs.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 400)); }); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(({ ff, LINE, CHILD, DEBT, DEATH, DREAD, LETTER }) => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    const lines = () => [LINE, CHILD, DEBT, DEATH, DREAD].map(l => JSON.parse(JSON.stringify(l)));
    const q = OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500600', date: '19/11/2026', premium: 5000, lines: lines() }, 'BR FNA - 400500600.pdf').quote;
    OV.store.setStatus(s, 'blocks.fna.quotes.0', 'accepted'); OV.store.setUw(s, 'blocks.fna.quotes.0', 'both');
    OV.docs.applyCounterLetter(s, q, LETTER, 'Pia cover terms (Cover Proposal 400500600 400500777).pdf');
    OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', date: '28/11/2026', premium: 5420, aciText: 'Premiums rise with the age adjuster', lines: lines() }, 'Pia Cover Proposal 400500777.pdf', { counterOf: q.id });
    OV.app.setState(s); OV.app.openAll();
  }, { ff: FFJ, LINE, CHILD, DEBT, DEATH, DREAD, LETTER });
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(600);
  const S = await p.evaluate(() => OV.app.state), cnt = S.blocks.fna.quotes[1];
  ok(S.blocks.fna.quotes.length === 2 && cnt.counterOf === S.blocks.fna.quotes[0].id && cnt.lines.length === 5 && cnt.terms.loadings.length === 4 && cnt.terms.exclusions.length === 2, '0. the counter offer has its five lines, four loadings (one under each pillar) and two exclusions');

  /* ---- 1 and 2. the Studio's table ---- */
  const grid = await p.evaluate(() => [...document.querySelectorAll('[data-row="blocks.fna.quotes.1"] table.qlines tr.ln')].map(r => ({ label: r.querySelector('td').textContent.replace(/\s+/g, ' ').trim(), cells: [...r.querySelectorAll('td.c')].slice(0, 4).map(td => ({ refs: [...td.querySelectorAll('small.rednote.ref')].map(x => x.textContent).join('|'), main: ([...td.querySelectorAll('input')].map(i => i.value).join(' ') + ' ' + [...td.childNodes].filter(n => !(n.nodeType === 1 && /ref|foot|bd|via|rednote/.test(n.className || ''))).map(n => n.textContent).join(' ')).replace(/\s+/g, ' ').trim() })) })));
  ok(grid.length === 5, '1. the Studio draws the five lines: ' + grid.map(g => g.label.slice(0, 18)).join(' / '));
  ORDER.forEach((t, i) => { const g = grid[i]; ok(!!g && JSON.stringify(g.cells.map(c => c.refs)) === JSON.stringify(WANT[t]), '1. ' + t + ': the red references sit under life / severe illness / lump sum disability / income protector as ' + JSON.stringify(WANT[t]) + (g ? ' (got ' + JSON.stringify(g.cells.map(c => c.refs)) + ')' : '')); });
  const empty = grid.flatMap(g => g.cells.filter(c => c.refs && !/R\s?[1-9]\d*/.test(c.main)));          // a cell with a reference must hold a positive rand amount
  ok(empty.length === 0, '2. never a red reference in a cell that is N/A, "-" or R0: ' + (empty.length ? JSON.stringify(empty) : 'none found'));
  const tot = await p.evaluate(() => [...document.querySelectorAll('[data-row="blocks.fna.quotes.1"] tr.tot.refs td.c')].map(td => [...td.querySelectorAll('small.rednote.ref')].map(x => x.textContent).join('|')));
  ok(JSON.stringify(tot) === JSON.stringify(['+6% loading', '+11% loading|Exclusion 4*', '+14% loading|Exclusion 5*', '+9% loading|Exclusion 4*']), '3. the totals row carries each pillar’s references: ' + JSON.stringify(tot));
  const terms = await p.evaluate(() => ({ ld: [...document.querySelectorAll('[data-row="blocks.fna.quotes.1"] table.terms.ld tbody tr')].map(r => r.querySelector('td').textContent.replace(/\s+/g, ' ').trim()), ex: [...document.querySelectorAll('[data-row="blocks.fna.quotes.1"] table.terms.ex tbody tr')].map(r => r.querySelectorAll('td')[1].textContent.replace(/\s+/g, ' ').trim()) }));
  ok(terms.ld.length === 4 && /^Income protector/.test(terms.ld[0]) && /^Lump sum disability/.test(terms.ld[1]) && /^Life cover/.test(terms.ld[2]) && /^Severe illness/.test(terms.ld[3]), '4. each loading names ONE pillar: ' + terms.ld.map(t => t.slice(0, 40)).join(' | '));
  ok(/Additional expense needs$/.test(terms.ld[3]) && !/recover from/.test(terms.ld[3]) && /recover from$/.test(terms.ld[0]), '4. the additional expense row is not said to be "recover from": "' + terms.ld[3] + '"');
  ok(terms.ex.length === 2 && /^Severe illness, income protector/.test(terms.ex[0]) && /^Lump sum disability/.test(terms.ex[1]), '4. an exclusion printed in two cells lists its two pillars, one in one: ' + terms.ex.join(' | '));
  const all = await p.evaluate(() => document.body.innerText + ' ' + document.body.textContent);
  ok(!/severe illness and income protector/i.test(all), '4. the combined label is nowhere on the screen');
  await p.locator('[data-row="blocks.fna.quotes.1"]').screenshot({ path: out + '/r16-pillars-studio.png' });

  /* ---- the Presentation ---- */
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(700);
  const card = await p.evaluate(() => [...document.querySelectorAll('#pSlide .pcard')].map(c => c.querySelector('.ct').textContent + ' | ' + c.querySelector('.cs').textContent).filter(t => /FNA/.test(t))[0] || '');
  ok(/The insurer has sent a counter offer for this cover, and we.ll go through it with you\./.test(card), '4b. the Overview page\u2019s FNA card says what stands: "' + card + '"');
  await p.screenshot({ path: out + '/r16-overview-cards.png' });
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(500);
  await p.click('#pres .pchip[data-act=q][data-i="1"]'); await p.waitForTimeout(600);
  const pg = await p.evaluate(() => [...document.querySelectorAll('#pres .ptbl tr[data-label]')].map(r => ({ label: r.getAttribute('data-label'), cells: [...r.children].slice(2, 6).map(td => ({ refs: [...td.querySelectorAll('small.rednote.ref')].map(x => x.textContent).join('|'), main: [...td.childNodes].filter(n => !(n.nodeType === 1 && /ref|foot|bd|via|rednote|bdesc/.test(n.className || ''))).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim() })) })));
  ok(pg.length === 5, '5. the Presentation draws the five lines: ' + pg.map(g => g.label).join(' / '));
  ORDER.forEach((t, i) => { const g = pg[i]; ok(!!g && JSON.stringify(g.cells.map(c => c.refs)) === JSON.stringify(WANT[t]), '5. Presentation, ' + t + ': the same references under the same pillars' + (g ? ' (got ' + JSON.stringify(g.cells.map(c => c.refs)) + ')' : '')); });
  const pEmpty = pg.flatMap(g => g.cells.filter(c => c.refs && !/R\s?[1-9]\d*/.test(c.main)));
  ok(pEmpty.length === 0, '5. and never one in an N/A, "-" or R0 cell: ' + (pEmpty.length ? JSON.stringify(pEmpty) : 'none found'));
  await p.screenshot({ path: out + '/r16-pillars-pres.png' });
  await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(500);
  const pu = await p.evaluate(() => document.querySelector('#pres').innerText.replace(/\s+/g, ' '));
  ok(/Income protector/.test(pu) && /Lump sum disability/.test(pu) && /Life cover/.test(pu) && /Severe illness/.test(pu) && /Severe illness, income protector/.test(pu) && !/severe illness and income protector/i.test(pu), '5. the Presentation’s terms tab names one pillar for each loading and lists the two pillars of the exclusion');
  await p.screenshot({ path: out + '/r16-pillars-terms.png' }); await p.evaluate(() => OV.present.close());

  /* ---- the PDF ---- */
  const pdfFile = out + '/r16-pillars.pdf', bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const pages = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdfFile]).toString())[1], 10), raw = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-raw', pdfFile, '-']).toString().replace(/\s+/g, ' ');
  let qp = 0; for (let i = 1; i <= pages; i++) { if (!qp && /Counter offer to BrightRock quote CP 400500600/.test(raw(i))) qp = i; }
  const qt = qp ? raw(qp) : '', after = qt.indexOf('Counter offer'), cq = after >= 0 ? qt.slice(qt.indexOf('CP 400500777')) : '';
  ok(qp > 0 && ['+6% loading', '+14% loading', '+9% loading', '+11% loading', 'Exclusion 4*', 'Exclusion 5*'].every(t => cq.indexOf(t) >= 0), '6. the PDF carries every reference of the four pillars (page ' + qp + ')');
  ok(/Loadings and exclusions/.test(cq) && /Income protector\s+Household/.test(qt) && /Life cover\s+Household/.test(qt) && /Severe illness\s+Additional expense needs/.test(qt) && /Lump sum disability\s+Household/.test(qt), '6. the PDF’s terms table has one pillar for each loading');
  ok(/4\* Severe illness, income protector No cover for conditions of the lower back Medical/.test(qt) && /5\* Lump sum disability No cover for a hazardous pursuit Occupational/.test(qt), '6. and its exclusions: the two pillars of one, the one pillar of the other');
  ok(!/severe illness and income protector/i.test(qt), '6. the combined label is not in the PDF');
  if (qp) cp.execFileSync('pdftoppm', ['-f', String(qp), '-l', String(qp), '-r', '80', '-png', '-singlefile', pdfFile, out + '/r16-pillars-pdf']);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
