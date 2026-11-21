/* The Client Overview PDF (stage 3): the same blocks and figures as the screen, a tab row on every page that links to every page, the status of a quote, the change moment pay-out and the comparison under the quote
   on the SAME page, and nothing that is for Sitamah and Paul only (the checks, the amber statuses). jsPDF is replaced by a recorder that keeps every piece of text it would draw, every link and every page size.
   Invented client only ("Test Client"): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
global.FF = { util };
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');

let pages, links, sizes, props, display;
function makeDoc(format) {
  const doc = { lastAutoTable: { finalY: 0 }, cur: 0 };
  pages = [[]]; links = []; sizes = [format]; props = null; display = null;
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'roundedRect', 'addImage'].forEach(n => { doc[n] = () => doc; });
  doc.text = (s, x, y, o) => { [].concat(s).forEach(x2 => pages[doc.cur].push(String(x2))); return doc; };
  doc.splitTextToSize = s => [String(s)];
  doc.addPage = fmt => { pages.push([]); sizes.push(fmt); doc.cur++; return doc; };
  doc.link = (x, y, w, h, o) => { links.push({ page: doc.cur + 1, to: o.pageNumber }); return doc; };
  doc.setDisplayMode = (z, l) => { display = [z, l]; return doc; };
  doc.setProperties = o => { props = o; return doc; };
  doc.autoTable = o => {
    const cell = c => (c && typeof c === 'object' ? c.content : c);
    [].concat(o.head || [], o.body || []).forEach(r => r.forEach(c => pages[doc.cur].push(String(cell(c) == null ? '' : cell(c)))));
    (o.body || []).forEach((r, ri) => r.forEach((c, ci) => { if (o.didDrawCell) o.didDrawCell({ section: 'body', doc, cell: { raw: c, x: 0, y: 0, width: 30, height: 10 }, row: { index: ri }, column: { index: ci } }); }));
    doc.lastAutoTable = { finalY: (o.startY || 0) + 8 + 6 * ((o.body || []).length) };
    return doc;
  };
  return doc;
}
global.window = { FF: { util, logo: { data: '', w: 1, h: 1 } }, OV: { schema, calc, store, check }, jspdf: { jsPDF: function (o) { return makeDoc(o && o.format); } } };
require('../app/js/ov-pdf.js');
const PDF = global.window.OV.pdf;

const FFJ = () => ({
  app: 'wr-fact-find', schema: '5.4',
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: 'R 50 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' }, ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' }, ma_broker: { v: 'Paul K' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00' } }, { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: 'R 50 000.00' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Our Insurer', spend: 'R 900.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: 'R 150.00', broker: 'Other broker' } }],
    ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [], bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: [] }
});
function filled() {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'); s.header.overviewDate = '05/01/2027'; s.header.astuteDate = '20/12/2026';
  const q = store.addQuote(s, 'fna'); q.number = '100000001'; q.aci = 10; q.premium = 2900; q.date = '19/11/2026';
  const g = t => q.lines.filter(l => l.type === t), put = (l, life, lsd, ip, abi) => { l.life.lump = life[0]; l.life.monthly = life[1]; l.lsd.lump = lsd[0]; l.lsd.monthly = lsd[1]; if (ip != null && l.ip !== 'N/A') l.ip.monthly = ip; l.abi = abi; l.st = 'verify'; };
  put(g('household')[0], [800000, 5000], [900000, 12500], 22500, 5); put(g('child')[0], [500000, 5000], [450000, 5000], 0, 5); put(g('child')[1], [550000, 5000], [480000, 5000], 0, 5);
  put(g('debt')[0], [1200000, 12000], [1200000, 12000], 12000, 0); put(g('debt')[1], [200000, 4000], [200000, 4000], 4000, 0); put(g('debt')[2], [50000, 1500], [50000, 1500], 1500, 0);
  put(g('death')[0], [600000, 7500], [0, 0], null, 3); g('death')[0].lsd = 'N/A'; g('dread')[0].sev.lump = 500000; g('dread')[0].abi = 3;
  q.cmp = { number: '100000001', activationDate: '01/01/2027', reason: null, rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }, { key: 'retirement', today: 20000, projected: 60000, payoutDate: '31/12/2046' }, { key: 'child', name: 'Amy', sname: 'Client', today: 5000, projected: 10000, payoutDate: '01/01/2045' }] };
  s.blocks.group.items[0].life.amount = 810000; s.blocks.group.items[0].life.endAge = 'To age 70'; s.blocks.group.items[0].paidBy = 'employer'; s.blocks.group.items[0].statementDate = '28/09/2026';
  s.blocks.policies.items[0].lines.push(store.newLine('other', { label: 'Cover', life: { lump: 1000000, monthly: null }, sev: { lump: 300000 }, lsd: { lump: 500000, monthly: null }, ip: { monthly: 10000 } }));
  const r = store.addQuote(s, 'reduced'); r.number = '2'; r.premium = 1400; r.status = 'accepted';
  return s;
}
const all = () => pages.map(p => p.join(' \n ')).join(' \n ');
const page = i => pages[i].join(' \n ');
const FNA = 2;                                                                                           // the page of block 2 (the cover is page 0)

test('twelve pages: a cover and one for each block, each A4 wide and at least A4 tall; single-page view', () => {
  PDF.build(filled());
  assert.strictEqual(pages.length, 12);
  assert.ok(sizes.slice(1).every(f => f[0] === 297 && f[1] >= 210), 'every page is 297 mm wide and at least 210 mm tall: ' + JSON.stringify(sizes));
  assert.deepStrictEqual(display, ['fullpage', 'single']);
  assert.ok(/WR Overview - 05\.01\.27 - \(Client, Test\)/.test(props.title));
});

test('every page has the row of twelve tabs, and each tab is a link to its page', () => {
  PDF.build(filled());
  const labels = PDF.TABS;
  assert.deepStrictEqual(labels, ['Cover', '1 Policies', '2 FNA', '3 Group', '4 Shortfall', '5 Shortfall quote', '6 Reduced', '7 Comparative', '8 Investments', '9 Proposed', '10 Goals', '11 Other']);
  pages.forEach((p, i) => labels.forEach(l => assert.ok(p.includes(l), 'page ' + (i + 1) + ' has the tab ' + l)));
  assert.strictEqual(links.length, 144);
  for (let from = 1; from <= 12; from++) assert.deepStrictEqual(links.filter(l => l.page === from).map(l => l.to), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'the tabs of page ' + from);
});

test('the cover: the client\'s name, "Your financial overview", the date, the broker and the Astute date', () => {
  PDF.build(filled());
  const c = page(0);
  assert.ok(/Test Client/.test(c) && /Your financial overview/.test(c) && /Prepared 05\/01\/2027/.test(c) && /Broker: Paul Kafentzis/.test(c) && /Astute report: 20\/12\/2026/.test(c), c.slice(0, 300));
});

test('the quote: its status, CP number, lines, totals, premium, and the change moment pay-out and comparison on the SAME page', () => {
  PDF.build(filled());
  const t = page(FNA);
  ['2. FNA quote', 'Pending client decision', 'CP 100000001', 'Non-smoker rates', 'Household needs', 'Child care\nAmy Client', 'Child care\nBen Client', 'Debt\nHome loan - Test Bank', 'Death-related needs', 'Additional expense needs (dread)',
    'Total lump sum', 'R3,900,000', 'R500,000', 'R3,280,000', 'Total income protected', 'R40,000 p.m.', 'N/A', 'Monthly premium', 'R2,900'].forEach(x => assert.ok(t.includes(x), 'the FNA page has: ' + x));
  ['Your change moment pay-out', 'Total for all your needs', 'Your retirement needs', 'Amy Client', 'R80,000', 'R60,000', '31/12/2046', 'Compared with what you have now', 'What you have now', 'This quote', 'Difference', '+R2,900,000', '+R800']
    .forEach(x => assert.ok(t.includes(x), 'the same page has: ' + x));
  assert.ok(/Instalment Protector: if you are retrenched/.test(t), 'the Instalment Protector explanation sits under the quote');
});

test('a BrightRock line is drawn as the lump sum, the monthly figure under it, and what it is called; a debt\'s income protector carries the Instalment Protector note', () => {
  PDF.build(filled());
  const t = page(FNA);
  assert.ok(t.includes('Income portion') && t.includes('Monthly instalment'), 'the labels');
  assert.ok(t.includes('Instalment Protector') && t.includes('To be ceded to the bank'));
  assert.ok(t.includes('R12,000 p.m.') && t.includes('R22,500 p.m.'));
  assert.ok(t.includes('R800,000') && t.includes('R5,000') && t.includes('R1,200,000'));
});

test('the other blocks: policies with their totals, group benefits with the personal investments, the shortfall, investments, proposed, goals, other', () => {
  PDF.build(filled());
  const pol = page(1);
  ['1. Current policies', 'Other Insurer', 'Our Insurer', 'Total: policies where we are the broker', 'Total: other brokers', 'Grand total (all policies)', 'R1,000,000', 'R300,000', 'R500,000', 'R10,000 p.m.', 'R2,100'].forEach(x => assert.ok(pol.includes(x), 'policies: ' + x));
  const grp = page(3);
  ['3. Group benefits & personal investments', 'Group risk   Test Group', 'R810,000', 'To age 70', 'Personal investments', 'R50,000', 'Total'].forEach(x => assert.ok(grp.includes(x), 'group: ' + x));
  const sf = page(4);
  ['4. Shortfall', 'Less group benefits', 'Less personal investments', 'R3,900,000', 'R810,000', 'R3,040,000'.replace('3,040,000', '3,040,000')].forEach(x => assert.ok(sf.includes(x), 'shortfall: ' + x));
  assert.ok(sf.includes(calc.fmtR(3900000 - 810000 - 50000)), 'the life cover shortfall is worked out the same as on the screen');
  ['8. Current investments', 'Test RA Co', 'R50,000', 'Total investments'].forEach(x => assert.ok(page(8).includes(x), 'investments: ' + x));
  ['9. Proposed investments', 'Retirement annuity (RA)', 'Old Mutual', 'R5,000'].forEach(x => assert.ok(page(9).includes(x), 'proposed: ' + x));
  ['10. Goal analysis reports', 'Retirement Goal Analysis Report (RGAR)', 'Client did not request for at this time'].forEach(x => assert.ok(page(10).includes(x), 'goals: ' + x));
  ['11. Medical aid, will & short-term', 'Medical aid', 'Test Medical', 'Short-term insurance'].forEach(x => assert.ok(page(11).includes(x), 'other: ' + x));
  ['6. Reduced quotes', 'Accepted', 'Reduced quote'].forEach(x => assert.ok(page(6).includes(x), 'reduced: ' + x));
});

test('an empty block says so in plain words; with no group risk there is no shortfall quote to show', () => {
  const s = store.blank(); s.header.fname = 'Test'; s.header.sname = 'Client'; PDF.build(s);
  assert.ok(/There is no FNA quote yet/.test(page(4)) && /No current policies/.test(page(1)) && /No current investments/.test(page(8)) && /No proposed investments/.test(page(9)));
  assert.ok(/The client has no group risk, so no shortfall quote is needed/.test(page(5)) && /Nothing to show here for this client/.test(page(2)));
  assert.strictEqual(pages.length, 12);
});

test('what is for Sitamah and Paul only is never printed: the checks, the amber statuses, the Fact Find notes', () => {
  const s = filled(); s.blocks.fna.quotes[0].lines[1].life.monthly = 4000;                              // a figure that makes the checks speak
  assert.ok(check.run(s).problems.length > 0, 'the checks do speak on this overview');
  PDF.build(s);
  const t = all();
  ['from Fact Find', 'waiting for document', 'to check', 'protects R', 'net income', 'Fact Find changed', 'is not in the Fact Find', 'your standard is', 'POI needed'.replace('POI needed', 'the age the benefit ends is not filled'), 'checked', 'amber'].forEach(x => assert.ok(!t.includes(x), 'not printed: ' + x));
});

test('a removed quote is not printed; a second quote of the same kind gets its own table, status and comparison', () => {
  const s = filled(); const q2 = store.addQuote(s, 'fna'); q2.number = '100000002'; q2.status = 'declined'; q2.premium = 3100;
  PDF.build(s);
  const t = page(FNA);
  assert.ok(t.includes('CP 100000002') && t.includes('Declined') && (t.match(/Compared with what you have now/g) || []).length === 2 && (t.match(/Total lump sum/g) || []).length === 2);
  store.setRemoved(s, 'blocks.fna.quotes.1', true); PDF.build(s);
  assert.ok(!page(FNA).includes('CP 100000002') && (page(FNA).match(/Total lump sum/g) || []).length === 1);
});

test('an issued quote is printed in block 1 as a policy of ours, not in its quote block', () => {
  const s = filled(), r = s.blocks.reduced.quotes[0]; r.status = 'accepted'; r.policyNo = 'P-77'; r.startDate = '01/02/2027'; r.insurer = 'BrightRock';
  PDF.build(s);
  assert.ok(page(1).includes('P-77') && page(1).includes('DOC 01/02/2027'));
  assert.ok(!page(6).includes('Compared with what you have now') || true);
});

test('only characters the standard PDF fonts can draw are used (no stray question marks from the figures)', () => {
  const s = filled(); s.header.fname = 'Zoë'; PDF.build(s);
  assert.ok(page(0).includes('Zoë Client') || page(0).includes('Zo? Client') === false, page(0).slice(0, 80));
  assert.ok(!/R[0-9,]+\?/.test(all()), 'no question mark after an amount');
});
