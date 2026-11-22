/* The Client Overview, stage 6 (page 0.5): the change moment pay-out that can be typed (under a BrightRock quote or one of our BrightRock policies), a comparative quote tailored to what the insurer prints,
   and a review year started from the last overview (what is carried over, what starts empty, what the checks say, and that the old overview is not touched).
   Invented client only ("Test Client"): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const FFJ = () => ({
  app: 'wr-fact-find', schema: '5.4',
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, dob: { v: '14/03/1985' }, net: { v: 'R 40 000.00' }, gross: { v: 'R 50 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' }, dd_cover: { v: 'R 500 000.00' } },
  l: {
    kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [], invq: []
  }
});
function sample() {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'); s.header.overviewDate = '05/01/2027'; s.header.astuteDate = '20/12/2026'; s.header.meetingDate = '04/01/2027';
  const q = store.addQuote(s, 'fna'); q.insurer = 'BrightRock'; q.number = '100000001'; q.premium = 2900; q.aci = 10; q.status = 'accepted'; q.policyNo = 'P-555'; q.startDate = '01/02/2027';
  q.lines.filter(l => l.type === 'household')[0].life.lump = 800000;
  store.addCmp(s, 'blocks.fna.quotes.0'); s.blocks.fna.quotes[0].cmp.rows[0].today = 30000;
  const r = store.addQuote(s, 'reduced'); r.insurer = 'Old Mutual'; r.number = '7'; r.premium = 1400;
  s.blocks.policies.items[0].premium = 1200; s.blocks.policies.items[0].st = 'confirmed';
  s.blocks.group.items[0].life.amount = 810000; s.blocks.group.items[0].st = 'confirmed';
  s.blocks.proposed.items.push(store.newProposed()); s.blocks.goals.items[0].currentValuePm = 31000; s.blocks.goals.items[0].premium = 1200;
  s.blocks.other.items[0].company = 'Test Medical'; s.blocks.other.items[0].st = 'confirmed';
  return s;
}

test('the change moment pay-out: rows total, retirement, childcare and one for each child; added once; removed; a row added or taken out', () => {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json');
  const q = store.addQuote(s, 'fna'), p = 'blocks.fna.quotes.0';
  const c = store.addCmp(s, p);
  assert.deepStrictEqual(c.rows.map(r => r.key + (r.name ? ':' + r.name : '')), ['total', 'retirement', 'childcare', 'child:Amy', 'child:Ben'], 'the children come from the quote\'s child lines');
  assert.strictEqual(c.st, 'empty'); assert.deepStrictEqual(c.src, { kind: 'typed' }); assert.strictEqual(q.cmp, c);
  assert.strictEqual(store.addCmp(s, p), null, 'one table only');
  const r = store.addCmpChild(s, p); assert.strictEqual(c.rows.length, 6); assert.strictEqual(r.key, 'child');
  assert.strictEqual(store.removeCmpRow(s, p, 5), true); assert.strictEqual(c.rows.length, 5); assert.strictEqual(store.removeCmpRow(s, p, 9), false);
  assert.strictEqual(store.removeCmp(s, p), true); assert.strictEqual(q.cmp, null); assert.strictEqual(store.removeCmp(s, p), false);
  assert.strictEqual(store.addCmp(s, 'blocks.fna.quotes.5'), null, 'nothing at a wrong path');
  const empty = store.blank(), c2 = store.addQuote(empty, 'comparative'); assert.deepStrictEqual(store.newCmp(empty, c2).rows.map(r => r.key), ['total', 'retirement', 'childcare'], 'no children known: no child rows');
});

test('typing in the pay-out checks the pay-out, not the quote; the file keeps it', () => {
  const s = store.blank(); const q = store.addQuote(s, 'fna'); q.st = 'verify'; store.addCmp(s, 'blocks.fna.quotes.0');
  store.setPath(s, 'blocks.fna.quotes.0.cmp.rows.0.today', 'R 30 000.00', 'money'); store.setPath(s, 'blocks.fna.quotes.0.cmp.rows.0.projected', '80000', 'money'); store.setPath(s, 'blocks.fna.quotes.0.cmp.rows.0.payoutDate', '31/12/2046', 'date');
  const cmp = s.blocks.fna.quotes[0].cmp;
  assert.deepStrictEqual([cmp.rows[0].today, cmp.rows[0].projected, cmp.rows[0].payoutDate], [30000, 80000, '31/12/2046']); assert.strictEqual(cmp.st, 'confirmed'); assert.strictEqual(cmp.by, 'person'); assert.strictEqual(q.st, 'verify', 'the quote itself is not checked by typing in its pay-out');
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(back.blocks.fna.quotes[0].cmp, cmp);
});

test('a comparative quote starts with one whole-of-life line and the other kinds are unchanged', () => {
  const s = store.blank(); const c = store.addQuote(s, 'comparative');
  assert.deepStrictEqual(c.lines.map(l => [l.type, l.label, l.term]), [['other', 'Cover', 'Whole of life']]);
  assert.ok(c.lines[0].life.lump === null && c.lines[0].st === 'empty');
  assert.deepStrictEqual(calc.totals(c).life, { lump: 0, monthly: 0 });
  c.lines[0].life.lump = 450000; c.lines[0].sev.lump = 100000; assert.strictEqual(calc.totals(c).life.lump, 450000); assert.strictEqual(calc.totals(c).sev.lump, 100000);
  assert.strictEqual(store.addQuote(s, 'fna').lines.length, 3, 'an FNA still starts with household, death-related and dread (no Fact Find here)');
  const ui = app('js/ov-ui.js'); assert.ok(/c\.kind === 'comparative' \? \['other'/.test(ui), 'a comparative quote offers "Other line" first'); assert.ok(/what the other insurer\\'s quote prints/.test(ui), 'and a note says what it is');
});

test('a review year: the client, policies, group, investments, goals and other cover carry over to be checked; the quotes, proposals and documents start empty; the old overview is not touched', () => {
  const old = sample(), before = JSON.stringify(old);
  const r = store.startReview(old, '21/11/2027'), s = r.state;
  assert.strictEqual(JSON.stringify(old), before, 'the old overview is unchanged');
  assert.strictEqual(s.header.fname, 'Test'); assert.strictEqual(s.header.sname, 'Client'); assert.strictEqual(s.header.broker, old.header.broker); assert.strictEqual(s.header.netIncome, old.header.netIncome);
  assert.strictEqual(s.header.overviewDate, '21/11/2027'); assert.strictEqual(s.header.meetingDate, null, 'a new meeting'); assert.strictEqual(s.header.astuteDate, null, 'a new Astute report');
  assert.deepStrictEqual(s.header.previous, { date: '05/01/2027', file: 'WR Overview - 05.01.27 - (Client, Test)' });
  assert.notStrictEqual(schema.fileName(s), schema.fileName(old), 'a new date is a new file: last year\'s file is kept'); assert.strictEqual(schema.yearOf(s), '2027');
  assert.ok(s.factFind && s.factFind.file === 'ff.json', 'the link to the Fact Find is kept'); assert.deepStrictEqual(s.settings, old.settings);
  ['fna', 'shortfallQuote', 'reduced', 'comparative'].forEach(b => assert.deepStrictEqual(s.blocks[b].quotes, [], b + ' starts empty: the new FNA replaces last year\'s'));
  assert.deepStrictEqual(s.blocks.proposed.items, []); assert.deepStrictEqual(s.documents, []);
  const pol = s.blocks.policies.items; assert.strictEqual(pol.length, 2, 'the other insurer\'s policy and our issued quote as a policy');
  const issued = pol.filter(p => p.policyNo === 'P-555')[0]; assert.ok(issued && issued.wr === true, 'an issued quote of ours is now a plain policy');
  pol.forEach(p => { assert.ok(!('derived' in p) && !('fromQuote' in p)); assert.strictEqual(p.cmp, null, 'last year\'s pay-out is out of date'); assert.strictEqual(p.src.kind, 'previous'); assert.strictEqual(p.src.date, '05/01/2027'); assert.strictEqual(p.st, 'verify'); p.lines.forEach(l => assert.ok(l.st === 'verify' || l.st === 'empty')); });
  assert.ok(pol.some(p => p.ffKey), 'the Fact Find links are kept so the policy still follows the Fact Find');
  assert.strictEqual(s.blocks.group.items[0].life.amount, 810000); assert.strictEqual(s.blocks.group.items[0].st, 'verify');
  assert.strictEqual(s.blocks.investments.items.length, old.blocks.investments.items.length);
  assert.strictEqual(s.blocks.goals.items[0].currentValuePm, null, 'the goal report\'s figures are last year\'s'); assert.strictEqual(s.blocks.goals.items[0].requested, old.blocks.goals.items[0].requested);
  assert.deepStrictEqual(s.blocks.other.items.map(i => i.key), schema.OTHER_KEYS.map(k => k.key)); assert.strictEqual(s.blocks.other.items[0].company, 'Test Medical');
  assert.ok(r.carried.policies >= 2 && r.carried.group === 1 && r.carried.other >= 1, JSON.stringify(r.carried));
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(back.header.previous, s.header.previous, 'the link to last year\'s overview is in the saved file');
});

test('the checks of a review year: what was carried over still waits for a document, then goes; a pay-out for another quote is flagged', () => {
  const s = store.startReview(sample(), '21/11/2027').state;
  const waiting = () => (check.run(s).problems.filter(p => p.id === 'review.carried')[0] || {}).message;
  assert.match(waiting(), /items were carried over from last year's overview and still wait/);
  s.blocks.policies.items.forEach(p => { p.st = 'confirmed'; p.src = { kind: 'schedule', file: 'x.pdf' }; });
  const m = waiting(); assert.match(m, /item/, 'the group benefit, the other cover and the goal still wait'); s.blocks.group.items.forEach(g => { g.st = 'confirmed'; });
  s.blocks.other.items.forEach(o => { if (o.st !== 'empty') o.st = 'confirmed'; }); s.blocks.goals.items.forEach(g => { g.st = 'confirmed'; }); s.blocks.investments.items.forEach(i => { i.st = 'confirmed'; });
  assert.strictEqual(waiting(), undefined, 'nothing waits: no check');
  assert.ok(!check.run(sample()).problems.some(p => p.id === 'review.carried'), 'an ordinary overview has no such check');
  const o = sample(), q = o.blocks.fna.quotes[0]; q.cmp.number = '999'; assert.ok(check.run(o).problems.some(p => p.id === 'cmp.match' && /CP 999/.test(p.message)), 'the pay-out is for another CP number');
  q.cmp.number = '100000001'; assert.ok(!check.run(o).problems.some(p => p.id === 'cmp.match'));
  const g = store.blank(); const bq = store.addQuote(g, 'fna'); bq.number = '5'; bq.lines[0].life.lump = 1; assert.ok(check.run(g).problems.some(p => p.id === 'gaps' && /pay-out guide is not loaded/.test(p.message)), 'no pay-out yet: the old gap check still asks for it');
  store.addCmp(g, 'blocks.fna.quotes.0'); assert.ok(!check.run(g).problems.some(p => p.id === 'gaps' && /pay-out guide is not loaded/.test(p.message)), 'a typed pay-out answers it');
});

test('the page: New review year asks first, refuses while there are unsaved changes, never changes last year\'s file', () => {
  const ui = app('js/ov-ui.js'), html = app('overview.html');
  assert.ok(/id="btnReview"/.test(html) && /New review year/.test(html));
  assert.ok(/if \(dirty\) \{ toast\('Save this overview first/.test(ui) && /window\.confirm\('Start the next review from this overview\?/.test(ui), 'it refuses when unsaved and asks before it starts');
  assert.ok(/fileHandle = null; ffHandle = null; fileBase = ''/.test(ui.slice(ui.indexOf('function newReview'))), 'the new review is not tied to last year\'s file');
});
