/* The Client Overview PDF made by the real page with the real jsPDF (stage 3), read back with poppler: twelve pages (a cover and a page for each block), each A4 wide and as tall as its content, the row of
   twelve tabs on every page with a link to each page, single-page view, a quote's change moment pay-out and comparison on the SAME page as the quote, every figure the screen's tables show also in the PDF
   (one set of figures), no amount split over two lines, and nothing of the checks or the amber statuses. Invented client ("Test Client"): no real client data. */
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
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/overview.html'); await p.waitForTimeout(400);
  await p.evaluate(t => {
    const A = OV.app, s = A.state; A.fillFactFindText(t, 'ff.json'); s.header.overviewDate = '05/01/2027';
    const q = OV.store.addQuote(s, 'fna'); q.number = '100000001'; q.aci = 10; q.premium = 2900; q.date = '19/11/2026';
    const g = ty => q.lines.filter(l => l.type === ty), put = (l, life, lsd, ip, abi) => { l.life.lump = life[0]; l.life.monthly = life[1]; l.lsd.lump = lsd[0]; l.lsd.monthly = lsd[1]; if (ip != null && l.ip !== 'N/A') l.ip.monthly = ip; l.abi = abi; l.st = 'confirmed'; };
    put(g('household')[0], [800000, 5000], [900000, 12500], 22500, 5); put(g('child')[0], [500000, 5000], [450000, 5000], 0, 5); put(g('child')[1], [550000, 5000], [480000, 5000], 0, 5);
    put(g('debt')[0], [1200000, 12000], [1200000, 12000], 12000, 0); put(g('debt')[1], [200000, 4000], [200000, 4000], 4000, 0); put(g('debt')[2], [50000, 1500], [50000, 1500], 1500, 0);
    put(g('death')[0], [600000, 7500], [0, 0], null, 3); g('death')[0].lsd = 'N/A'; g('dread')[0].sev.lump = 500000; g('dread')[0].abi = 3;
    q.cmp = { number: '100000001', activationDate: '01/01/2027', reason: null, rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }, { key: 'retirement', today: 20000, projected: 60000, payoutDate: '31/12/2046' }, { key: 'child', name: 'Amy', sname: 'Client', today: 5000, projected: 10000, payoutDate: '01/01/2045' }] };
    s.blocks.group.items[0].life.amount = 810000; s.blocks.group.items[0].life.endAge = 'To age 70'; s.blocks.group.items[0].paidBy = 'employer'; s.blocks.group.items[0].statementDate = '28/09/2026';
    s.blocks.policies.items[0].lines.push(OV.store.newLine('other', { label: 'Cover', life: { lump: 1000000, monthly: null }, sev: { lump: 300000 }, lsd: { lump: 500000, monthly: null }, ip: { monthly: 10000 } }));
    const r = OV.store.addQuote(s, 'reduced'); r.number = '2'; r.premium = 1400; r.status = 'accepted'; r.lines[1].life.lump = 500000; r.lines[1].life.monthly = 5000;
    A.redraw();
  }, JSON.stringify(FFJ));
  /* what the screen shows in its worked-out tables, block by block */
  const screen = {};
  for (const id of ['policies', 'fna', 'group', 'shortfall', 'investments']) { await p.evaluate(i => OV.app.go(i), id); screen[id] = await p.evaluate(() => [...document.querySelectorAll('[data-comp]')].map(e => e.innerText).join(' ')); }
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const raw = Buffer.from(bytes).toString('latin1');
  const info = cp.execFileSync('pdfinfo', ['-f', '1', '-l', '12', file]).toString();
  ok(/Pages:\s+12/.test(info), '1. twelve pages: a cover and one for each block');
  const sizes = [...info.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts/g)].map(m => [+m[1], +m[2], +m[3]]);
  ok(sizes.length === 12 && sizes.every(s => Math.abs(s[1] - 841.89) < 0.5 && s[2] >= 595), '1. each page is A4 wide and at least A4 tall: ' + sizes.map(s => Math.round(s[2])).join(','));
  ok(sizes[2][2] > 595.5, '1. the FNA page is taller than A4: its change moment pay-out and comparison are not pushed onto another page (' + Math.round(sizes[2][2]) + ' pt)');
  ok(/\/PageLayout \/SinglePage/.test(raw) || /\/PageLayout\s*\/SinglePage/.test(raw), '2. the PDF opens in single-page view');
  ok((raw.match(/\/Subtype\s*\/Link/g) || []).length === 144, '2. twelve tabs on each of twelve pages are links: ' + (raw.match(/\/Subtype\s*\/Link/g) || []).length);
  const text = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']).toString();
  const T = [0].concat([...Array(12).keys()].map(i => text(i + 1)));
  const tabs = ['Cover', '1 Policies', '2 FNA', '3 Group', '4 Shortfall', '5 Shortfall quote', '6 Reduced', '7 Comparative', '8 Investments', '9 Proposed', '10 Goals', '11 Other'];
  ok([...Array(12).keys()].every(i => tabs.every(t => T[i + 1].includes(t))), '2. every page shows all twelve tabs');
  ok(/Test Client/.test(T[1]) && /Your financial overview/.test(T[1]), '3. the cover has the client\'s name and "Your financial overview"');
  ok(/2\. FNA quote/.test(T[3]) && /Your change moment pay-out/.test(T[3]) && /Compared with what you have now/.test(T[3]) && /Total income protected/.test(T[3]), '4. the quote, its change moment pay-out and its comparison are on the SAME page (page 3)');
  ok(/To be ceded to the bank/.test(T[3]) && /Instalment Protector/.test(T[3]) && /Income portion/.test(T[3]) && /Monthly instalment/.test(T[3]), '4. the Instalment Protector note and the labels under the monthly figures');
  const money = s => (s.match(/R\d[\d,]*(?:\.\d\d)?/g) || []);
  const miss = (id, page) => { const t = T[page].replace(/\s+/g, ''); return [...new Set(money(screen[id]))].filter(x => !t.includes(x)); };
  const miss1 = miss('policies', 2), miss2 = miss('fna', 3), miss3 = miss('group', 4), miss4 = miss('shortfall', 5), miss5 = miss('investments', 9);
  ok(miss1.length === 0, '5. every figure of the policies table on the screen is in the PDF page 2' + (miss1.length ? ': missing ' + miss1 : ''));
  ok(miss2.length === 0, '5. every figure of the FNA totals and comparison on the screen is in the PDF page 3' + (miss2.length ? ': missing ' + miss2 : ''));
  ok(miss3.length === 0, '5. every figure of the group table is in the PDF page 4' + (miss3.length ? ': missing ' + miss3 : ''));
  ok(miss4.length === 0, '5. every figure of the shortfall is in the PDF page 5' + (miss4.length ? ': missing ' + miss4 : ''));
  ok(miss5.length === 0, '5. every figure of the investments table is in the PDF page 9' + (miss5.length ? ': missing ' + miss5 : ''));
  const flat = T.slice(1).join('\n');
  ok(!/R\d[\d,]*,\s/.test(flat.replace(/p\.m\./g, '')) && !/R\d{1,3}\n\s*,\d{3}/.test(flat), '6. no amount is split over two lines');
  ok(!/from Fact Find|waiting for document|to check|Fact Find changed|protects R|net income/.test(flat), '7. nothing for Sitamah and Paul only is printed: no checks, no amber statuses');
  ok(/6\. Reduced quotes/.test(T[7]) && /Accepted/.test(T[7]), '8. the reduced quote page shows its status');
  for (const n of [1, 2, 3, 5, 7]) cp.execFileSync('pdftoppm', ['-r', '60', '-f', String(n), '-l', String(n), '-png', file, out + '/overview-pdf-p' + n]);
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
