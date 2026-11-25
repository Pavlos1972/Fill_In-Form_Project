/* The Client Overview, stage 6, on the real page (page 0.5): the change moment pay-out typed under a BrightRock quote and under one of our BrightRock policies (and then in the PDF and the Presentation), a comparative
   quote tailored to what the insurer prints, and a review year started from a saved overview (what carries over, the checks, last year's file untouched, unsaved changes refused). Invented client ("Test Client"): no real client data. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: '50000' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' }, ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: '200000', term: '60' } }, { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: '50000' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Our Insurer', spend: 'R 900.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [{ d: { type: 'Unit trust', prov: 'Test Funds', val: 'R 20 000.00', prem: 'R 500.00', broker: 'Other broker' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: '5000', lump: '' } }], invq: [] } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + dir + '/overview.html'); await p.waitForTimeout(400); await p.evaluate(() => OV.app.openAll());          // the page starts folded (See more); this test is about what is inside
  await p.evaluate(t => {
    const A = OV.app, s = A.state; A.fillFactFindText(t, 'ff.json'); s.header.overviewDate = '05/01/2027'; s.header.astuteDate = '20/12/2026';
    const q = OV.store.addQuote(s, 'fna'); q.number = '100000001'; q.aci = 10; q.premium = 2900; q.date = '19/11/2026'; q.lines.filter(l => l.type === 'household')[0].life.lump = 800000; q.lines.filter(l => l.type === 'household')[0].life.monthly = 5000;
    const mine = s.blocks.policies.items.filter(i => i.wr)[0]; mine.insurer = 'BrightRock'; mine.policyNo = 'P-555'; mine.premium = 900; mine.lines.push(OV.store.newLine('household', { life: { lump: 600000, monthly: 4000 } }));
    A.redraw();
  }, JSON.stringify(FFJ));
  const text = sel => p.evaluate(s => document.querySelector(s).innerText, sel);
  const checks = () => p.evaluate(() => document.querySelector('#checks').textContent);                 // the folded list of every individual check is in it too

  /* ---- 1. a pay-out typed under a BrightRock quote ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(60);
  ok(await p.evaluate(() => !!document.querySelector('.cmpadd [data-addcmp]')), '1. a BrightRock quote without a pay-out offers "+ Add the change moment pay-out"');
  ok(/No change moment pay-out guide found for CP/.test(await checks()), '1. and the checks ask for the guide');
  await p.click('[data-addcmp]'); await p.waitForTimeout(60);
  const labels = await p.evaluate(() => [...document.querySelectorAll('table.payout tbody tr')].map(r => r.querySelector('td').innerText.trim().replace(/\s+/g, ' ')));
  ok(labels.length === 5 && /Total for all your needs/.test(labels[0]) && /retirement/.test(labels[1]) && /childcare/.test(labels[2]), '1. the rows: total, retirement, childcare and a row for each child (' + labels.join(' | ') + ')');
  ok(await p.evaluate(() => [...document.querySelectorAll('table.payout tbody tr')].slice(3).every(r => r.querySelectorAll('input[data-p$=".name"]').length === 1)) && await p.evaluate(() => document.querySelector('table.payout tbody tr:nth-child(4) input[data-p$=".name"]').value) === 'Amy', '1. the child rows carry the children\'s names');
  const fill = async (suffix, v) => { await p.fill('table.payout tbody tr:nth-child(1) input[data-p$="' + suffix + '"]', v); };
  await fill('.today', '30000'); await fill('.projected', '80000'); await fill('.payoutDate', '31/12/2046');
  const row = await p.evaluate(() => { const c = OV.app.state.blocks.fna.quotes[0].cmp; return [c.rows[0].today, c.rows[0].projected, c.rows[0].payoutDate, c.st, c.by]; });
  ok(JSON.stringify(row) === JSON.stringify([30000, 80000, '31/12/2046', 'confirmed', 'person']), '1. what is typed is kept as numbers and a date, and checks the pay-out: ' + JSON.stringify(row));
  await p.fill('table.payout tbody tr:nth-child(2) input[data-p$=".today"]', '20000'); await p.fill('table.payout tbody tr:nth-child(2) input[data-p$=".projected"]', '60000'); await p.fill('table.payout tbody tr:nth-child(2) input[data-p$=".payoutDate"]', '31/12/2046');
  await p.evaluate(() => OV.app.redraw()); await p.waitForTimeout(60);
  ok(!/No change moment pay-out guide found for CP/.test(await checks()), '1. a typed pay-out answers the check');
  ok(await p.evaluate(() => !document.querySelector('[data-addcmpchild]') && !document.querySelector('[data-delcmprow]') && !document.querySelector('table.payout .xbtn') && document.querySelectorAll('table.payout thead th').length === 4), '1. the pay-out table has no x on a row and no "+ A child row" (rows come only from the guide), four columns');
  await p.fill('input[data-p$=".cmp.number"]', '999'); await p.evaluate(() => OV.app.redraw()); ok(/CP 999/.test(await checks()) && /not for this quote/.test(await checks()), '1. a pay-out for another CP number is flagged');
  await p.fill('input[data-p$=".cmp.number"]', '100000001'); await p.evaluate(() => OV.app.redraw());
  await p.click('[data-delcmp]'); await p.waitForTimeout(40); ok(await p.evaluate(() => OV.app.state.blocks.fna.quotes[0].cmp === null && !!document.querySelector('[data-addcmp]')), '1. Remove takes the table out (after asking) and the Add button is back');
  await p.click('[data-addcmp]'); await fill('.today', '30000'); await fill('.projected', '80000'); await fill('.payoutDate', '31/12/2046');
  await p.fill('table.payout tbody tr:nth-child(2) input[data-p$=".today"]', '20000'); await p.fill('table.payout tbody tr:nth-child(2) input[data-p$=".projected"]', '60000');

  /* ---- 2. a comparative quote tailored to what the insurer prints ---- */
  await p.evaluate(() => { OV.app.go('comparative'); OV.store.addQuote(OV.app.state, 'comparative'); OV.app.redraw(); OV.app.openAll(); }); await p.waitForTimeout(60);          // round 2.0: a quote is added whole, from its document
  ok(/what the other insurer.s quote prints/.test(await text('.qcard')) && /whole-of-life amount/.test(await text('.qcard')), '2. a comparative quote says what to type');
  ok(await p.evaluate(() => document.querySelectorAll('.qcard .adders .addrow').length === 0 && !document.querySelector('.qcard .xbtn')), '2. no add buttons and no remove column: its lines come only from the quote');
  ok(await p.evaluate(() => { const l = OV.app.state.blocks.comparative.quotes[0].lines; return l.length === 1 && l[0].label === 'Cover' && l[0].term === 'Whole of life'; }) && await p.evaluate(() => document.querySelector('.qcard tr.ln input[data-p$=".label"]').value) === 'Cover', '2. it starts with one "Cover" line, whole of life');
  await p.fill('.qcard tr.ln input[data-p$=".life.lump"]', '450000'); await p.fill('.qcard tr.ln input[data-p$=".sev.lump"]', '100000'); await p.fill('.qcard input[data-p$=".insurer"]', 'Old Mutual'); await p.fill('.qcard input[data-p$=".premium"]', '1700');
  const tot = await p.evaluate(() => document.querySelector('.qcard [data-comp^="qtot"]').innerText.replace(/\s+/g, ' '));
  ok(/R450,000/.test(tot) && /R100,000/.test(tot) && /R1,700/.test(tot), '2. the totals follow: ' + tot.slice(0, 120));
  ok(await p.evaluate(() => OV.app.state.blocks.comparative.quotes[0].lines.length) === 1, '2. and it still has its one Cover line (nothing can be added by hand to a quote that has lines)');

  /* ---- 3. one of our BrightRock policies ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(60);
  ok(await p.evaluate(() => [...document.querySelectorAll('.qcard')].filter(c => /BrightRock/.test(c.querySelector('h3').textContent) && c.querySelector('[data-addcmp]')).length) === 1, '3. one of our BrightRock policies offers the pay-out; another broker\'s policy does not');
  await p.click('.qcard [data-addcmp]'); await p.fill('.qcard table.payout tbody tr:nth-child(1) input[data-p$=".today"]', '12000'); await p.fill('.qcard table.payout tbody tr:nth-child(1) input[data-p$=".projected"]', '33000');

  /* ---- 4. the PDF and the Presentation show them, with the same figures ---- */
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/review-overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const page = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']).toString();
  const fnaPg = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids.indexOf('fna') + 1), polPg = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids.indexOf('policies') + 1);          // round 2.0: the pages follow the four headings, so their numbers are looked up
  ok(/Your change moment pay-out/.test(page(fnaPg)) && /R30,000/.test(page(fnaPg)) && /R80,000/.test(page(fnaPg)) && /R20,000/.test(page(fnaPg)) && /31\/12\/2046/.test(page(fnaPg)), '4. the PDF prints the typed pay-out under the quote');
  ok(/Your change moment pay-out/.test(page(polPg)) && /R12,000/.test(page(polPg)) && /R33,000/.test(page(polPg)), '4. and under our BrightRock policy on the policies page');
  const cmpPage = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids.indexOf('comparative') + 1);                       // a page with nothing to say is left out, so the number is looked up
  ok(cmpPage > 0 && /Whole of life/.test(page(cmpPage)) && /R450,000/.test(page(cmpPage)) && /Cover/.test(page(cmpPage)), '4. a comparative quote with its own line is on the comparative page (page ' + cmpPage + ')');
  await p.click('#btnPresent'); await p.waitForTimeout(150);
  await p.evaluate(() => { OV.present.go('fna'); OV.present.applyMoves([{ sub: 'cmp' }]); });
  const pv = await text('#pSlide'); ok(/Total for all your needs/.test(pv) && /R30,000/.test(pv) && /R80,000/.test(pv) && /R20,000/.test(pv), '4. the Presentation shows the typed pay-out in its tab');
  const money = s => (s.match(/R\d[\d,]*(?:\.\d\d)?/g) || []);
  const got = new Set();
  for (const [id, pol] of [['policies', undefined], ['policies', 0], ['policies', 1]]) { await p.evaluate(a => OV.present.go(a[0], undefined, a[1]), [id, pol]); await p.waitForTimeout(40); money(await text('#pSlide')).forEach(x => got.add(x)); }
  const pdfSet = new Set(money(page(2).replace(/\s+/g, ' '))), onlyP = [...got].filter(x => !pdfSet.has(x)), onlyF = [...pdfSet].filter(x => !got.has(x));
  ok(onlyP.length === 0 && onlyF.length === 0, '4. the policies page and the Presentation hold the same figures, the policy\'s pay-out included' + (onlyP.length ? ' (only in the Presentation: ' + onlyP + ')' : '') + (onlyF.length ? ' (only in the PDF: ' + onlyF + ')' : ''));
  await p.evaluate(() => { OV.present.go('policies', undefined, 1); });
  ok(/Your change moment pay-out/.test(await text('#pSlide')) || /Your change moment pay-out/.test(await p.evaluate(() => { OV.present.go('policies', undefined, 0); return document.querySelector('#pSlide').innerText; })), '4. a policy\'s lines in the Presentation are followed by its pay-out');
  await p.click('#pBtnClose'); await p.waitForTimeout(40);

  /* ---- 5. a review year ---- */
  const savedJson = await p.evaluate(() => OV.store.toJSON(OV.app.state));
  await p.evaluate(() => OV.app.redraw());
  await p.click('#moreMenu summary'); await p.click('#btnReview'); await p.waitForTimeout(60);
  ok(/Save this overview first/.test(await text('#toast')) && await p.evaluate(() => !OV.app.state.header.previous), '5. with unsaved changes a review is refused: "Save this overview first"');
  await p.setInputFiles('#fileIn', { name: 'WR Overview - 05.01.27 - (Client, Test).json', mimeType: 'application/json', buffer: Buffer.from(savedJson) }); await p.waitForTimeout(300);
  const oldBefore = await p.evaluate(() => { window.__old = OV.app.state; return JSON.stringify(OV.app.state); });
  await p.click('#moreMenu summary'); await p.click('#btnReview'); await p.waitForTimeout(150);
  const rv = await p.evaluate(() => { const s = OV.app.state; return { prev: s.header.previous, date: s.header.overviewDate, meet: s.header.meetingDate, astute: s.header.astuteDate, quotes: ['fna', 'shortfallQuote', 'reduced', 'comparative'].map(k => s.blocks[k].quotes.length).join(), pol: s.blocks.policies.items.length, grp: s.blocks.group.items.length, same: s === window.__old, name: document.querySelector('#meta .fn').innerText }; });
  ok(rv.prev && rv.prev.date === '05/01/2027' && /WR Overview - 05\.01\.27 - \(Client, Test\)/.test(rv.prev.file) && !rv.same, '5. the new review is linked to last year\'s overview: ' + JSON.stringify(rv.prev));
  ok(rv.quotes === '0,0,0,0' && rv.meet === null && rv.astute === null && rv.pol === 2 && rv.grp === 1, '5. the quotes, the meeting date and the Astute date start empty; the policies and the group benefit are carried (' + rv.pol + ' policies)');
  ok(rv.date !== '05/01/2027' && !rv.name.includes('05.01.27'), '5. it has today\'s date and so a file name of its own: ' + rv.name);
  ok(/A review of the overview of 05\/01\/2027/.test(await text('#meta')) && /carried over from last year/.test(await checks()), '5. the side cards say it is a review and that items still wait for a document');
  ok(/items carried over from the overview of 05\/01\/2027/.test(await text('#toast')), '5. the message says how many items were carried over');
  ok(await p.evaluate(s => JSON.stringify(window.__old) === s, oldBefore), '5. last year\'s overview is exactly as it was');
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(40);
  const before = (await checks()).match(/(\d+) items? w/)[1];
  await p.fill('.qcard:nth-of-type(1) input[data-p$=".premium"]', '1250'); await p.evaluate(() => OV.app.redraw());
  const after = (await checks()).match(/(\d+) items? w/);
  ok(!after || +after[1] === +before - 1, '5. typing a figure checks that item: ' + before + ' waiting, then ' + (after ? after[1] : 'none'));
  const rtrip = await p.evaluate(() => { const s = OV.store.fromJSON(OV.store.toJSON(OV.app.state)); return s.header.previous && s.header.previous.date; });
  ok(rtrip === '05/01/2027', '5. the link survives saving and opening');
  ok(errs.length === 0, '6. no page error: ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
