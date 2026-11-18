/* Investment Capture Sheet 1.1: its files (the saved .json and the application PDF) are named by the same application file name rule as the Short Risk Application (Paul: "I recommend investments follow - agreed"):
   <Insurer> - <Product> Application - dd.mm.yy - <R amount p.m. | R amount - Lump Sum> - (<First Last>). The questionnaire PDF keeps its own name; older saved files open as before. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/cs-schema.js');
const store = require('../app/js/cs-store.js');
const SR = require('../app/js/sr-store.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
/* a Capture Sheet with the parts of the name filled in */
function sheet(o) {
  const s = fresh(); o = Object.assign({ fname: 'Anna', sname: 'Kuiper', date: '20/11/2026', provider: 'Old Mutual' }, o);
  Object.keys(o).forEach(k => set(s, k, o[k]));
  return s;
}
const name = o => store.pdfFileName(sheet(o));
const OM = (product_name, contrib_type, amount, product) => ({ provider: 'Old Mutual', product_name, contrib_type, amount, product: product || '' });

test('Paul’s two examples, word for word', () => {
  assert.strictEqual(name(OM('OM Optimal RA - Recurring', 'Recurring (monthly)', '2800', 'Retirement Annuity')), 'OM - Optimal RA Application - 20.11.26 - R 2,800.00 p.m. - (Anna Kuiper)');
  assert.strictEqual(name(OM('OM Tax Free Lumpsum', 'Lump sum', '50000', 'Tax-Free Investment')), 'OM - Tax-Free Application - 20.11.26 - R 50,000.00 - Lump Sum - (Anna Kuiper)');
});

test('Old Mutual’s own product names: Optimal RA, Tax-Free, Flexi, Xtra Max RA (any), Wealth RA', () => {
  const P = n => name(OM(n, 'Recurring (monthly)', '1000')).split(' - ')[1];
  assert.strictEqual(P('OM Optimal RA - Recurring'), 'Optimal RA Application');
  assert.strictEqual(P('OM Tax Free recurring'), 'Tax-Free Application');
  assert.strictEqual(P('OM Tax Free Lumpsum'), 'Tax-Free Application');
  assert.strictEqual(P('OM Flexi Investment Plan'), 'Flexi Application');
  assert.strictEqual(P('OM RA - Xtra Max 8.5% - section 14 transfer'), 'Xtra Max RA Application');
  assert.strictEqual(P('OM RA - Xtra Max 8.5%'), 'Xtra Max RA Application');
  assert.strictEqual(P('OM RA - Xtra Max 5%'), 'Xtra Max RA Application');
  assert.strictEqual(P('OM RA - Xtra Max 7%'), 'Xtra Max RA Application', 'any Xtra Max name, also one typed that the list does not have');
  assert.strictEqual(P('OM RA - Wealth recurring'), 'Wealth RA Application');
  assert.strictEqual(P('  om tax free recurring '), 'Tax-Free Application', 'spaces and capital letters do not matter');
});

test('a name from the table wins over the Product type; the type is used when the name is not in the table', () => {
  assert.strictEqual(name(OM('OM Flexi Investment Plan', 'Lump sum', '1000', 'Tax-Free Investment')).split(' - ')[1], 'Flexi Application', 'the product name first');
  const T = { 'Retirement Annuity': 'RA', 'Tax-Free Investment': 'Tax-Free', 'Endowment / Flexible Investment Plan': 'Endowment', 'Living Annuity': 'Living Annuity' };
  Object.keys(T).forEach(t => assert.strictEqual(name({ provider: 'Allan Gray', product: t, product_name: 'Some own plan', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], T[t] + ' Application', t));
  assert.strictEqual(name({ provider: 'Allan Gray', product: 'Retirement Annuity', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], 'RA Application', 'with no product name typed');
});

test('Other: the Product typed stands in, else the word Other; with nothing chosen the part reads Product', () => {
  assert.strictEqual(name({ provider: 'Allan Gray', product: 'Other', product_name: 'Offshore Fund', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], 'Offshore Fund Application');
  assert.strictEqual(name({ provider: 'Allan Gray', product: 'Other', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], 'Other Application');
  assert.strictEqual(name({ provider: 'Allan Gray', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], 'Product Application');
  assert.strictEqual(name({ provider: 'Allan Gray', product: 'Other', product_name: 'Fund: A/B <1>', contrib_type: 'Lump sum', amount: '1000' }).split(' - ')[1], 'Fund AB 1 Application', 'characters a file name cannot hold are left out');
});

test('the amount: R with thousands commas and two decimals; p.m. for recurring, Lump Sum for a lump sum and a Section 14 transfer', () => {
  const A = (kind, amount) => name({ provider: 'Allan Gray', product: 'Living Annuity', contrib_type: kind, amount }).split(' - ').slice(3, -1).join(' - ');
  assert.strictEqual(A('Recurring (monthly)', '2800'), 'R 2,800.00 p.m.');
  assert.strictEqual(A('Recurring (monthly)', 'R 2 500.00'), 'R 2,500.00 p.m.', 'the way the box shows it');
  assert.strictEqual(A('Recurring (monthly)', '350.5'), 'R 350.50 p.m.');
  assert.strictEqual(A('Lump sum', '50000'), 'R 50,000.00 - Lump Sum');
  assert.strictEqual(A('Section 14 transfer', '1234567.5'), 'R 1,234,567.50 - Lump Sum');
  assert.strictEqual(A('Lump sum', '999'), 'R 999.00 - Lump Sum');
});

test('until the boxes are filled the missing parts read as what they are, and the name is never silently wrong', () => {
  assert.ok(/^Provider - Product Application - \d\d\.\d\d\.\d\d - R amount - p\.m\. or Lump Sum - \(New client\)$/.test(store.pdfFileName(fresh())), store.pdfFileName(fresh()));
  assert.strictEqual(name({ provider: 'Old Mutual', product: 'Retirement Annuity', amount: '2800' }), 'OM - RA Application - 20.11.26 - R 2,800.00 - p.m. or Lump Sum - (Anna Kuiper)', 'an amount with no kind: the kind is asked, not guessed');
  assert.strictEqual(name({ provider: 'Old Mutual', product: 'Retirement Annuity', contrib_type: 'Lump sum' }), 'OM - RA Application - 20.11.26 - R amount - Lump Sum - (Anna Kuiper)');
  assert.strictEqual(name({ fname: '', sname: '', provider: 'Old Mutual', product: 'Retirement Annuity', contrib_type: 'Recurring (monthly)', amount: '2800' }), 'OM - RA Application - 20.11.26 - R 2,800.00 p.m. - (New client)');
});

test('the insurer: Old Mutual is OM, the others are written out; the date is the Date of application; the client is First Last', () => {
  const base = { product: 'Endowment / Flexible Investment Plan', contrib_type: 'Recurring (monthly)', amount: '500' };
  assert.strictEqual(name(Object.assign({ provider: 'Old Mutual' }, base)).split(' - ')[0], 'OM');
  ['Momentum', 'Sanlam', 'Liberty', 'Discovery', 'Allan Gray', 'Stanlib'].forEach(p => assert.strictEqual(name(Object.assign({ provider: p }, base)).split(' - ')[0], p));
  assert.strictEqual(name(Object.assign({ provider: 'Old Mutual', date: '05/12/2026' }, base)).split(' - ')[2], '05.12.26');
  assert.strictEqual(name(Object.assign({ provider: 'Old Mutual', fname: 'Piet', sname: 'van der Merwe' }, base)).split(' - ').pop(), '(Piet van der Merwe)');
  assert.strictEqual(name(Object.assign({ provider: 'Liberty' }, base)), 'Liberty - Endowment Application - 20.11.26 - R 500.00 p.m. - (Anna Kuiper)');
});

test('the PDF and the saved file share one name; the questionnaire PDF keeps its own name', () => {
  const s = sheet(OM('OM Optimal RA - Recurring', 'Recurring (monthly)', '2800', 'Retirement Annuity'));
  assert.strictEqual(store.baseFileName(s), store.pdfFileName(s));
  assert.strictEqual(store.rtFileName(s), 'Risk Tolerance - 20.11.26 - (Anna Kuiper)');
});

test('the same shape as the Short Risk Application’s name: insurer, product Application, date, amount, (client)', () => {
  const SHAPE = /^[^-]+? - .+ Application - \d\d\.\d\d\.\d\d - R [\d,]+\.\d\d( p\.m\.| - Lump Sum) - \(.+\)$/;
  const sr = SR.blank(); SR.setField(sr, 'insurer', 'Old Mutual'); SR.setField(sr, 'product', 'Personal Covers'); SR.setField(sr, 'premium', '1500'); SR.setField(sr, 'fname', 'Anna'); SR.setField(sr, 'sname', 'Kuiper'); SR.setField(sr, 'date', '20/11/2026');
  assert.strictEqual(SR.pdfFileName(sr), 'OM - Personal Covers Application - 20.11.26 - R 1,500.00 p.m. - (Anna Kuiper)', 'the Short Risk Application’s rule is as it was');
  [name(OM('OM Optimal RA - Recurring', 'Recurring (monthly)', '2800', 'Retirement Annuity')), name(OM('OM Tax Free Lumpsum', 'Lump sum', '50000', 'Tax-Free Investment')), SR.pdfFileName(sr)].forEach(n => assert.ok(SHAPE.test(n), n));
});

test('the table is in cs-schema.js, covers every Old Mutual name the page suggests, every product type and every kind of contribution', () => {
  const T = schema.fileName;
  assert.ok(T && T.names && T.prefixes && T.types && T.kinds && T.other === 'Other');
  schema.suggestions['Old Mutual'].forEach(n => assert.ok(T.names[n], 'a short name for ' + n));
  assert.deepStrictEqual(Object.keys(T.names).sort(), schema.suggestions['Old Mutual'].slice().sort(), 'nothing in the table that the page does not suggest');
  schema.products.filter(p => p !== 'Other').forEach(p => assert.ok(T.types[p], 'a short name for the type ' + p));
  schema.fieldsById.contrib_type.o.forEach(k => assert.ok(T.kinds[k], 'an ending for ' + k));
  assert.deepStrictEqual(T.prefixes, { 'OM RA - Xtra Max': 'Xtra Max RA' });
  assert.strictEqual(schema.abbr['Old Mutual'], 'OM');
});

test('an older saved file (1.0) opens as before, with every answer; the name follows the new rule from then on', () => {
  const s = sheet(OM('OM Tax Free recurring', 'Recurring (monthly)', '2500', 'Tax-Free Investment')); set(s, 'rt_understand', 'Confirmed');
  const j = JSON.parse(store.toJSON(s)); j.schema = '1.0';
  const back = store.fromJSON(JSON.stringify(j));
  ['fname', 'sname', 'date', 'provider', 'product', 'product_name', 'contrib_type', 'amount', 'rt_understand'].forEach(id => assert.deepStrictEqual(back.f[id], s.f[id], id));
  assert.strictEqual(store.pdfFileName(back), 'OM - Tax-Free Application - 20.11.26 - R 2,500.00 p.m. - (Anna Kuiper)');
  assert.strictEqual(JSON.parse(store.toJSON(back)).schema, schema.version, 'saved again it carries the new version');
});

test('the version is 1.1 or later (1.2 now), and the page fetches the new scripts', () => {
  assert.ok(parseFloat(schema.version) >= 1.1);
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'capture-sheet.html'), 'utf8');
  assert.ok(/js\/cs-schema\.js\?v=20261118b/.test(html) && /js\/cs-store\.js\?v=20261118b/.test(html), 'the page fetches the new scripts');
});
