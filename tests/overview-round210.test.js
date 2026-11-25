/* Client Overview Studio 2.1 (25 November, Paul's answers relayed by the Fix Skills chat at 18:36): (1) the five blocks of "Where the client is now" ALWAYS print (an empty one says so in ONE line); every quote page (the five servicing pages and FNA,
   Shortfall, Reduced and Comparative quotes) prints only when it holds a quote; (2) the new BrightRock quote naming guide:  BR <Type> - <quote no> - R<premium> - dd.mm.yy - (<Initials Surname>)  with the types FNA, Shortfall, Reduced, Quote, Serv FNA, Serv Shortfall,
   Serv Reduced, Serv Increase, Serv Decrease, CMPO (the same quote number as its quote) and  - SIGNED  at the end of a signed copy. Without a screen: the printing rules (calc.pageShown, the Presentation's blockOn), the name table (docs.classify) and the signed-copy
   rule (folders.js signedTwins, which the pick list's tickPlan calls). The PDF and the pick list on a real folder tree are looked at in tests/browser/t-overview-round210.js. Invented clients and numbers only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const docs = require('../app/js/ov-docs.js');
const pres = require('../app/js/ov-pres.js');
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const NOW = ['policies', 'group', 'investments', 'other', 'shortfall'];
const QUOTE_PAGES = ['svFna', 'svShortfall', 'svReduced', 'svIncrease', 'svReduction', 'fna', 'shortfallQuote', 'reduced', 'comparative'];

/* ---------- 1. what prints ---------- */
test('where the client is now always has a page, and an empty overview still opens all five in the Presentation', () => {
  const s = store.blank();
  NOW.forEach(id => assert.ok(calc.pageShown(s, id), id + ' prints'));
  QUOTE_PAGES.forEach(id => assert.ok(!calc.pageShown(s, id), id + ' has no quote, so no page'));
  NOW.forEach(id => assert.ok(pres.blockOn(s, id), id + ' opens in the Presentation'));
  QUOTE_PAGES.forEach(id => assert.ok(!pres.blockOn(s, id), id + ' does not open without a quote'));
  assert.deepStrictEqual(pres.shownOrder(s), ['map'].concat(NOW));
  ['policies', 'group', 'investments', 'other', 'shortfall'].forEach(t => assert.ok(pres.tabOn(s, t), t + ' tab is on'));
  ['servicing', 'fna', 'reduced', 'proposed', 'goals'].forEach(t => assert.ok(!pres.tabOn(s, t), t + ' tab is greyed'));
});

test('a quote brings its page; the Fact Find asking for one does not; a removed quote takes its page away again', () => {
  const s = store.blank(); s.factFind = { facts: { asked: { sf: true, comparative: true } } };
  s.header.fname = 'Test'; s.header.sname = 'Client';
  ['shortfallQuote', 'comparative'].forEach(id => assert.ok(!calc.pageShown(s, id), id + ': asked for in the Fact Find but no quote there: left out'));
  const kinds = { fna: 'fna', shortfallQuote: 'shortfall', reduced: 'reduced', comparative: 'comparative', svFna: 'svfna', svShortfall: 'svshortfall', svReduced: 'svreduced', svIncrease: 'svincrease', svReduction: 'svreduction' };
  Object.keys(kinds).forEach(id => {
    const q = store.addQuote(s, kinds[id]); q.number = '10020' + Object.keys(kinds).indexOf(id);
    assert.ok(calc.pageShown(s, id) && pres.blockOn(s, id), id + ' has a quote, so it prints and opens');
    q.removed = true; assert.ok(!calc.pageShown(s, id) && !pres.blockOn(s, id), id + ' removed: gone again');
  });
});

test('proposed investments and goal reports keep the earlier rule: only when they hold something', () => {
  const s = store.blank();
  assert.ok(!calc.pageShown(s, 'proposed') && !calc.pageShown(s, 'goals'));
  const src = app('js/ov-calc.js');
  assert.ok(/id === 'proposed'\) return active/.test(src) && /id === 'goals'\) return active/.test(src), 'both are still decided by their own items');
});

test('every empty page of Where the client is now says so in ONE line, on the page and in the Presentation', () => {
  const pdf = app('js/ov-pdf.js'), pv = app('js/ov-present.js');
  ['There are no current policies in place.', 'There are no current investments in place.'].forEach(t => {
    assert.ok(pv.includes(t), 'the Presentation says: ' + t);
    assert.ok(pdf.includes(t), 'the PDF says: ' + t);
  });
  assert.ok(pdf.includes('No medical aid, gap cover, will, legacy plan or short-term insurance is recorded.'), 'the PDF says so for the Medical aid, will & short-term page (the Presentation\'s page has a card for each cover that says it was not discussed)');
  assert.ok(pdf.includes('There are no group benefits in place.') && pdf.includes('There are no personal investments in place.'), 'group: one line each');
  assert.ok(pdf.includes('There is no FNA quote yet, so the shortfall cannot be worked out.') && pv.includes('There is no FNA quote yet, so the shortfall cannot be worked out.'), 'shortfall');
});

/* ---------- 2. the BrightRock naming guide ---------- */
const NAME = (type, no, prem, date, who, signed) => 'BR ' + type + ' - ' + no + ' - R' + prem + ' - ' + date + ' - (' + who + ')' + (signed ? ' - SIGNED' : '') + '.pdf';
const cls = (name, dir) => docs.classify(name, dir || '');

test('the naming guide: every type of the guide goes to its block, with the quote number and the date read from the name', () => {
  const t = [
    ['FNA', 'fna', 'fna'], ['Shortfall', 'shortfallQuote'], ['Reduced', 'reduced'], ['Quote', 'comparative'],
    ['Serv FNA', 'svFna'], ['Serv Shortfall', 'svShortfall'], ['Serv Reduced', 'svReduced'], ['Serv Increase', 'svIncrease'], ['Serv Decrease', 'svReduction'], ['CMPO', 'cmp']];
  t.forEach(([type, block], i) => {
    const no = '10077000' + i, c = cls(NAME(type, no, '1,450.00', '05.01.27', 'A Tester'), '3. Quotes');
    assert.ok(c, type + ' is told');
    assert.strictEqual(c.block, block, type + ' -> ' + block);
    assert.strictEqual(c.number, no); assert.strictEqual(c.date, '05/01/2027'); assert.strictEqual(c.signed, false);
  });
});

test('a Serv type is a servicing quote wherever the file sits (loose, in a quotes folder, in a policy folder, in a Review or Servicing folder)', () => {
  ['', '3. Quotes', 'Quotes (Accepted)', 'BR Personal Covers - 900100200', 'BR Personal Covers - 900100200\\Comparative Quotes\\2027 - Review', 'BR Personal Covers - 900100200\\Servicing', 'Some other folder'].forEach(d => {
    assert.strictEqual(cls(NAME('Serv Increase', '100770001', '1,450.00', '05.01.27', 'A Tester'), d).block, 'svIncrease', 'increase in: ' + d);
    assert.strictEqual(cls(NAME('Serv Decrease', '100770002', '950.00', '05.01.27', 'A Tester'), d).block, 'svReduction', 'decrease in: ' + d);
    assert.strictEqual(cls(NAME('Serv FNA', '100770003', '3,100.00', '05.01.27', 'A Tester'), d).block, 'svFna', 'FNA in: ' + d);
  });
  assert.strictEqual(cls('BR Servicing Reduction - 100770004 - R900.00 - 05.01.27.pdf', '').block, 'svReduction', 'older spellings still work: Servicing, Reduction');
  assert.strictEqual(cls('BR Service Shortfall - 100770005 - R900.00 - 05.01.27.pdf', '').block, 'svShortfall');
});

test('a plain FNA, Shortfall or Reduced is still new business loose, and still servicing inside a numbered policy folder (Paul\'s 25 November rule); BR Quote is a comparative quote everywhere', () => {
  assert.strictEqual(cls(NAME('FNA', '100770010', '2,900.00', '05.01.27', 'A Tester'), '3. Quotes').block, 'fna');
  assert.strictEqual(cls(NAME('FNA', '100770010', '2,900.00', '05.01.27', 'A Tester'), 'BR Personal Covers - 900100200\\Comparative Quotes\\2027 - Review').block, 'svFna');
  assert.strictEqual(cls(NAME('Reduced', '100770011', '1,400.00', '05.01.27', 'A Tester'), '').block, 'reduced');
  ['', '3. Quotes', 'BR Personal Covers - 900100200\\Comparative Quotes\\2027 - Review', 'BR Personal Covers - 900100200\\Servicing'].forEach(d => assert.strictEqual(cls(NAME('Quote', '100770012', '1,900.00', '05.01.27', 'A Tester'), d).block, 'comparative', 'BR Quote in: ' + d));
  assert.strictEqual(cls('Brochure quote.pdf', '3. Quotes'), null, 'only a name that starts with BR and the word Quote: a brochure is nothing');
});

test('the pay-out guide has the same quote number as its quote, whatever the quote\'s type', () => {
  ['FNA', 'Shortfall', 'Reduced', 'Quote', 'Serv FNA', 'Serv Increase'].forEach((type, i) => {
    const no = '10088000' + i, q = cls(NAME(type, no, '1,000.00', '05.01.27', 'A Tester'), ''), g = cls(NAME('CMPO', no, '1,000.00', '05.01.27', 'A Tester'), '');
    assert.strictEqual(g.block, 'cmp'); assert.strictEqual(g.number, q.number, type + ': the guide carries the quote number');
  });
});

test('a signed copy is told by the word SIGNED at the end of its name (and nowhere else); in a Review or Servicing folder it stays paperwork', () => {
  const c = cls(NAME('FNA', '100770020', '2,900.00', '05.01.27', 'A Tester', true), '3. Quotes');
  assert.strictEqual(c.block, 'fna'); assert.strictEqual(c.signed, true);
  assert.strictEqual(cls(NAME('FNA', '100770020', '2,900.00', '05.01.27', 'A Tester'), '3. Quotes').signed, false);
  assert.strictEqual(cls('BR FNA - 100770021 - R1.00 - 05.01.27 - (Design Signedoff).pdf', '3. Quotes').signed, false, 'a name that only contains the letters is not a signed copy');
  assert.strictEqual(cls(NAME('Serv Decrease', '100770022', '950.00', '05.01.27', 'A Tester', true), 'BR Personal Covers - 900100200\\Servicing'), null, 'in a Servicing folder a signed copy is paperwork (Paul, 25 November 14:55)');
  assert.strictEqual(cls(NAME('FNA', '100770023', '2,900.00', '05.01.27', 'A Tester', true), 'BR Personal Covers - 900100200\\Comparative Quotes\\2027 - Review'), null, 'and in a Review folder (Paul, 25 November: a signed quote there stays unticked)');
});

/* ---------- 3. the signed-copy rule ---------- */
let n = 0;
const e = (kind, o) => Object.assign({ id: 'f' + (++n), kind, signed: false, no: '', base: 'x' + n }, o || {});

test('signedTwins: a signed copy beside its unsigned quote is not ticked; the only copy is', () => {
  const unsigned = e('fna', { no: '100770030', base: 'br fna' }), signed = e('fna', { no: '100770030', base: 'br fna', signed: true });
  let m = F.signedTwins([unsigned, signed]); assert.strictEqual(m.get(signed.id), true); assert.ok(!m.has(unsigned.id), 'only signed entries are in the answer');
  m = F.signedTwins([signed]); assert.strictEqual(m.get(signed.id), false, 'the only copy');
});

test('signedTwins: the twin must be the same quote of the same kind; with no number the name decides', () => {
  const a = e('fna', { no: '100770031', signed: true }), other = e('fna', { no: '100770032' }), otherKind = e('shortfallQuote', { no: '100770031' });
  assert.strictEqual(F.signedTwins([a, other, otherKind]).get(a.id), false, 'another quote number or another kind is not its twin');
  const b = e('comparative', { signed: true, base: 'br quote - a tester' }), twin = e('comparative', { base: 'br quote - a tester' }), different = e('comparative', { base: 'br quote - b tester' });
  assert.strictEqual(F.signedTwins([b, different]).get(b.id), false); assert.strictEqual(F.signedTwins([b, twin]).get(b.id), true, 'no number: the same name without signed');
});

test('signedTwins: two signed copies of one quote with no unsigned one are both the only copies; a signed copy is never the twin of another signed copy', () => {
  const a = e('fna', { no: '100770033', signed: true }), b = e('fna', { no: '100770033', signed: true });
  const m = F.signedTwins([a, b]); assert.strictEqual(m.get(a.id), false); assert.strictEqual(m.get(b.id), false);
  assert.strictEqual(F.signedTwins().size, 0); assert.strictEqual(F.signedTwins([]).size, 0);
});

test('the pick list asks signedTwins, groups a quote with no policy folder by itself, and says why a signed copy is not ticked', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/F\.signedTwins\(/.test(ui) && /signedTwin\.get\(f\) === true\) return false/.test(ui), 'tickPlan leaves a signed copy beside its quote unticked');
  assert.ok(/signed copy: the quote itself is in the list and is the one read, so this is not ticked/.test(ui), 'and the list says so');
  assert.ok(/signed copy, and the only copy of this quote: read as the quote/.test(ui), 'and says when it is the only copy');
  assert.ok(/D\.servicingFolder\(/.test(ui) && /'loose:'/.test(ui), 'a servicing quote that sits in no policy folder stands alone: it is never put out by another policy\'s newer quote');
});

test('the page is 2.1 (the decimal after 2.0), the layout stays 0.1, no key is added (contract revision p), and the changed scripts carry new tags', () => {
  assert.strictEqual(schema.pageVersion, '2.1'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('2.0'), 'compared as decimals');
  const html = app('overview.html');
  ['ov-schema', 'ov-calc', 'ov-docs', 'ov-pdf', 'ov-pres', 'ov-ui', 'ov-present', 'folders'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261125b').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=20261125b/.test(app(f)), f));
  const contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8');
  assert.ok(/revision p/i.test(contract) && !/revision q/i.test(contract), 'the contract is still at revision p: 2.1 adds no key');
});

/* ---------- 4. the client at the end of the name ---------- */
test('the client\'s surname at the end of the name is never read as a word of the name (Vergara, Margaritis, Egarton, Shortfalls, Letterman, Ownership, May, September)', () => {
  const who = ['A Vergara', 'A Margaritis', 'Z Egarton', 'K Shortfalls', 'L Letterman', 'D Ownership', 'T May', 'P September', 'R Reduced', 'M Terms'];
  const want = { FNA: 'fna', Shortfall: 'shortfallQuote', Reduced: 'reduced', Quote: 'comparative', 'Serv FNA': 'svFna', 'Serv Increase': 'svIncrease', 'Serv Decrease': 'svReduction', CMPO: 'cmp' };
  Object.keys(want).forEach(type => who.forEach(w => ['2,900.00', '2026.00', '2,026.00'].forEach(prem => {
    const n = NAME(type, '100770040', prem, '05.01.27', w), c = cls(n, '3. Quotes');
    assert.ok(c && c.block === want[type] && c.number === '100770040' && c.date === '05/01/2027' && c.signed === false, n + ' -> ' + JSON.stringify(c));
    assert.strictEqual(F.nameDate(n), 20270105, 'the date of ' + n);
    assert.ok(!F.isManual(n), 'not an owner\'s manual: ' + n);
    const sg = cls(NAME(type, '100770040', prem, '05.01.27', w, true), '3. Quotes');
    assert.ok(sg && sg.block === want[type] && sg.signed === true, 'the signed copy: ' + n);
  })));
  assert.ok(F.isManual('BR Owner Manual - 100770041 - R1.00 - 05.01.27 - (A Test).pdf') && F.isManual('Policy Wording.pdf'), 'a real manual is still one');
});

test('the cut that takes the client out of a name only takes the guide\'s bracket, and ov-docs.js and folders.js cut the same', () => {
  const t = ['br fna - 100770050 - r1.00 - 05.01.27 - (a vergara)', 'br fna - 100770050 - r1.00 - 05.01.27 - (a vergara) - signed', 'br fna - 100770050 - r1.00 - 05.01.27 - (signed copy)', 'br fna - 100770050 - (accepted)', 'fna quote 100770050 (signed)', 'br fna - 100770050 - r1.00 - 05.01.27 - (van der merwe)', 'br fna (a vergara) - 100770050'];
  t.forEach(x => assert.strictEqual(docs.withoutClient(x), F.withoutClient(x), x));
  assert.strictEqual(docs.withoutClient(t[0]), 'br fna - 100770050 - r1.00 - 05.01.27'); assert.strictEqual(docs.withoutClient(t[1]), 'br fna - 100770050 - r1.00 - 05.01.27 - signed');
  assert.strictEqual(docs.withoutClient(t[2]), t[2], 'a bracket that says signed, accepted or copy is not the client'); assert.strictEqual(docs.withoutClient(t[3]), t[3]); assert.strictEqual(docs.withoutClient(t[4]), t[4]);
  assert.strictEqual(docs.withoutClient(t[5]), 'br fna - 100770050 - r1.00 - 05.01.27'); assert.strictEqual(docs.withoutClient(t[6]), t[6], 'only at the end of the name');
});

/* ---------- 5. newest only, in the new naming ---------- */
test('two Serv Increase quotes of one policy: only the newest by the date in the name is ticked; loose ones (no policy known) stand alone', () => {
  const folder = 'br personal covers - 900100200';
  const a = { id: 'a', kind: 'svIncrease', sub: folder, y: 2026, fy: 2026, ex: 20261220, no: '100770061' }, b = { id: 'b', kind: 'svIncrease', sub: folder, y: 2027, fy: 2027, ex: 20270105, no: '100770062' };
  const o = F.ageQuotes([a, b]); assert.ok(o.has('a') && !o.has('b'), 'the older one of the same policy folder is not ticked');
  const x = { id: 'x', kind: 'svIncrease', sub: 'loose:100770063', y: 0, fy: 0, ex: 20261101, no: '100770063' }, y = { id: 'y', kind: 'svIncrease', sub: 'loose:100770064', y: 0, fy: 0, ex: 20270105, no: '100770064' };
  assert.strictEqual(F.ageQuotes([x, y]).size, 0, 'two loose quotes (the policy is not known) are both ticked: each is its own group');
  const c = { id: 'c', kind: 'svIncrease', sub: folder, y: 2027, fy: 2027, ex: 20261220, no: '100770066' }, d2 = { id: 'd2', kind: 'svIncrease', sub: folder, y: 2027, fy: 2027, ex: 20270105, no: '100770067' }, d3 = { id: 'd3', kind: 'svIncrease', sub: folder, y: 2027, fy: 2027, ex: 20270105, no: '100770068' }, u = { id: 'u', kind: 'svIncrease', sub: folder, y: 2027, fy: 2027, ex: 0, no: '100770069' };
  const same = F.ageQuotes([c, d2]); assert.ok(same.has('c') && !same.has('d2') && /older date \(20\/12\/2026\): not ticked, the newest is 05\/01\/2027/.test(same.get('c')), 'the same year folder: the older date in the name is not ticked and says why');
  assert.strictEqual(F.ageQuotes([d2, d3]).size, 0, 'two on the newest date: both ticked');
  assert.ok(F.ageQuotes([d2, u]).has('u') && !F.ageQuotes([d2, u]).has('d2'), 'an undated one loses to a dated one of the same year');
  const fnaA = { id: 'fa', kind: 'fna', sub: '', y: 2027, fy: 2027, ex: 20261220, no: '100770070' }, fnaB = { id: 'fb', kind: 'fna', sub: '', y: 2027, fy: 2027, ex: 20270105, no: '100770071' };
  assert.strictEqual(F.ageQuotes([fnaA, fnaB]).size, 0, 'a new business quote keeps the earlier rule: inside one year folder every quote is ticked (the date rule is the servicing quotes\' only)');
  const dec = { id: 'd', kind: 'svReduction', sub: folder, y: 2027, fy: 2027, ex: 20270105, no: '100770065' };
  assert.strictEqual(F.ageQuotes([a, b, dec]).has('d'), false, 'a servicing quote of another kind is its own group');
});
