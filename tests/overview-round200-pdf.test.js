/* Client Overview Studio 2.0 (25 November): the PDF follows the same four headings as the menu and carries a servicing quote: the ONE policy it is about, the old and the new side by side, the premium before and after, the reason. A page with nothing in it is not in
   the document; the page numbers follow what is printed. jsPDF is replaced by a recorder. Invented client only ("Test, Sia"); invented numbers. */
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

function filled() {
  const s = store.blank(); s.header.fname = 'Sia'; s.header.sname = 'Test'; s.header.overviewDate = '05/01/2027';
  const L = (type, life, o) => store.newLine(type, Object.assign({ life: { lump: life, monthly: 0 }, sev: { lump: null }, lsd: { lump: null, monthly: null }, ip: { monthly: null } }, o || {}));
  s.blocks.policies.items.push({ id: 'p1', insurer: 'BrightRock', product: 'Personal covers', policyNo: '900100200', premium: 1000, lines: [L('household', 500000), L('debt', 900000, { debt: 'Home loan', bank: 'Test Bank' })], st: 'confirmed', wr: true, benefits: {} });
  return s;
}
const page = i => pages[i].join(' \n ');
function withServicing(s) {
  const q = store.addQuote(s, 'svincrease'); q.number = '300000001'; q.premium = 1450; q.date = '05/11/2026'; q.reason = 'A new bond on a second property';
  q.lines = [store.newLine('household', { life: { lump: 700000, monthly: 0 } }), store.newLine('debt', { debt: 'Home loan', bank: 'Test Bank', life: { lump: 900000, monthly: 0 } }), store.newLine('debt', { debt: 'New bond', bank: 'Test Bank', life: { lump: 300000, monthly: 0 } })];
  store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', 'p1');
  return q;
}

test('with no servicing quote the PDF has no servicing page, no servicing heading; with one, the page sits between the shortfall and the new business pages under its own heading', () => {
  const s = filled(); PDF.build(s);
  assert.ok(!PDF.pagesOf(s).ids.includes('svIncrease')); assert.ok(!pages.some(p => p.includes('Servicing your current policies')));
  withServicing(s); PDF.build(s);
  const ids = PDF.pagesOf(s).ids; assert.deepStrictEqual(ids, ['cover', 'policies', 'group', 'investments', 'other', 'shortfall', 'svIncrease', 'fna', 'reduced']);
  const names = PDF.pagesOf(s).tabs.map(t => t.name); assert.deepStrictEqual(names, ['Cover', '1 Policies', '2 Group', '3 Investments', '4 Other', '5 Shortfall', '6 Increase', '7 FNA', '8 Reduced']);
  pages.forEach((p, i) => { assert.ok(p.includes('Where you are now') && p.includes('Servicing your current policies') && p.includes('New business quotes'), 'the headings on page ' + (i + 1)); assert.ok(!p.includes('Investments & goals'), 'a heading with no page under it is not drawn'); });
  assert.strictEqual(links.length, ids.length * ids.length, 'every page links to every page that exists'); assert.strictEqual(PDF.pagesOf(s).tabs[6].group, 'servicing');
});

test('the servicing page: the policy, the reason, every line old to new, the totals, the premium before and after and the difference; no comparison and no replacement lines', () => {
  const s = filled(); withServicing(s); PDF.build(s);
  const t = page(PDF.pagesOf(s).ids.indexOf('svIncrease'));
  ['6. Straight increase', 'Straight increase', 'CP 300000001', 'One line added or raised: no FNA and no shortfall.', 'On: BrightRock 900100200 (Personal covers).', 'Reason: A new bond on a second property',
    'Need', 'Life cover\nnow to new', 'Household needs', 'R500,000 to R700,000', 'Changed: Life cover +R200,000', 'Debt\nHome loan', 'No change', 'Debt\nNew bond', 'New',
    'Total lump sum', 'R1,400,000 to R1,900,000', 'Monthly premium', 'R1,000 to R1,450', '+R450 a month (+45%)'].forEach(x => assert.ok(t.includes(x), 'the servicing page has: ' + x));
  assert.ok(!t.includes('Compared with what you have now') && !t.includes('Replacing your existing policies'), 'a servicing quote compares nothing with the whole of what the client has and replaces nothing');
  assert.ok(t.includes('Total income protected'), 'the quote\'s own table follows');
});

test('a servicing quote that is not tied to a policy says so and shows every line as new; the page numbers in the titles follow the pages that are there', () => {
  const s = filled(), q = withServicing(s); q.onPolicy = null; PDF.build(s);
  const t = page(PDF.pagesOf(s).ids.indexOf('svIncrease'));
  assert.ok(t.includes('On: No current policy chosen.') && (t.match(/\nNew\b|New \n/g) || []).length >= 1, t.slice(0, 400));
  const s2 = filled(); store.addQuote(s2, 'svreduction').lines = [store.newLine('household', { life: { lump: 1, monthly: 0 } })]; PDF.build(s2);
  assert.ok(page(PDF.pagesOf(s2).ids.indexOf('svReduction')).includes('6. Straight reduction'), 'numbered 6: the first page after the five of "where you are now"');
});
