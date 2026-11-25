/* Client Overview Studio 1.8 (25 November, Paul's answers relayed in the Fix Skills chat, his "1 yes, 2 yes, 3 leave, 4 each" to my four questions about the Review and Servicing folders and about proposals and goal reports):
   (1) a schedule or statement left in a policy folder's Review folder is the policy's schedule candidate, like one in Servicing; a "Review Summary" is not one;
   (2) a signed quote in a review folder is listed and NOT ticked (kept as it is: pinned here);
   (3) the paperwork and quote words stay as they are;
   (4) proposals of different products, and goal reports of different kinds, are one group each: the newest of EACH is ticked (folders.js `quoteSub`, `ageQuotes`).
   What the real pick list shows is looked at in tests/browser/t-overview-round160.js. Invented names and numbers only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const F = require('../app/js/folders.js');
const D = require('../app/js/ov-docs.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

let n = 0;
const q = (kind, o) => Object.assign({ id: 'f' + (++n), kind, sub: '', y: 0, fy: 0, ex: 0, no: '' }, o || {});
const date = (y, m, d) => y * 10000 + (m || 0) * 100 + (d || 0);
const state = (list, older) => list.map(x => x.id + (older.has(x.id) ? ':old' : ':ok'));

/* ---------- 4. the newest of EACH product and report type ---------- */
test('quoteSub: the product of a proposal and the kind of a goal report as the NAME says it; an unclear name has none; the other kinds have none', () => {
  const p = x => F.quoteSub('proposed', x);
  assert.strictEqual(p('Retirement Annuity Proposal A.pdf'), 'ra'); assert.strictEqual(p('Optimal RA Proposal 12.01.26.pdf'), 'ra'); assert.strictEqual(p('Xtra Max RA quote.pdf'), 'ra');
  assert.strictEqual(p('Tax Free Proposal B.pdf'), 'tfsa'); assert.strictEqual(p('Tax-Free Investment Account Proposal.pdf'), 'tfsa'); assert.strictEqual(p('TFSA proposal 2026.pdf'), 'tfsa');
  assert.strictEqual(p('Living Annuity Proposal.pdf'), 'la'); assert.strictEqual(p('Endowment Proposal 2025.pdf'), 'endowment'); assert.strictEqual(p('Unit Trust Proposal.pdf'), 'ut'); assert.strictEqual(p('Flexi Investment Proposal.pdf'), 'ut');
  assert.strictEqual(p('Proposal A.pdf'), '', 'a name that does not say the product has none'); assert.strictEqual(p('Tax Free Retirement Annuity Proposal.pdf'), 'tfsa', 'two product words: the first of the table');
  assert.strictEqual(p('Living Annuity.pdf'), 'la', 'a living annuity is not a retirement annuity');
  const g = x => F.quoteSub('goals', x);
  assert.strictEqual(g('RGAR Report 2024.pdf'), 'rgar'); assert.strictEqual(g('Retirement Goal Analysis.pdf'), 'rgar'); assert.strictEqual(g('EGAR Report 2025.pdf'), 'egar'); assert.strictEqual(g('Education Goal Report.pdf'), 'egar'); assert.strictEqual(g('Goal Analysis Report.pdf'), '');
  ['fna', 'shortfallQuote', 'reduced', 'comparative', 'cmp'].forEach(k => assert.strictEqual(F.quoteSub(k, 'Retirement Annuity Tax Free Quote.pdf'), '', k + ' has no sub-kind'));
});
test('ageQuotes: proposals of two products with no year folder: the newest of EACH is ticked, an older one of the same product says so and names the product', () => {
  const ra25 = q('proposed', { sub: 'ra', ex: date(2025, 3, 3), y: 2025 }), ra26 = q('proposed', { sub: 'ra', ex: date(2026, 1, 10), y: 2026 }), tf26 = q('proposed', { sub: 'tfsa', ex: date(2026, 2, 10), y: 2026 }), la24 = q('proposed', { sub: 'la', ex: date(2024, 5, 5), y: 2024 });
  const older = F.ageQuotes([ra25, ra26, tf26, la24]);
  assert.deepStrictEqual(state([ra25, ra26, tf26, la24], older), [ra25.id + ':old', ra26.id + ':ok', tf26.id + ':ok', la24.id + ':ok'], 'the 2024 living annuity proposal is the only one of its product: ticked although 2026 exists for others');
  assert.ok(/older date \(03\/03\/2025\): not ticked, the newest is 10\/01\/2026 \(retirement annuity\)/.test(older.get(ra25.id)), older.get(ra25.id));
});
test('ageQuotes: two products of one day are both ticked; an undated proposal of an unclear product is a group of its own (alone: ticked)', () => {
  const a = q('proposed', { sub: 'ra', ex: date(2026, 1, 10), y: 2026 }), b = q('proposed', { sub: 'tfsa', ex: date(2026, 1, 10), y: 2026 }), u = q('proposed', { sub: '' }), u2 = q('proposed', { sub: '' });
  assert.strictEqual(F.ageQuotes([a, b, u, u2]).size, 0, 'no group has an older or an undated-beside-dated member');
  const d = q('proposed', { sub: 'ra', ex: date(2026, 1, 10), y: 2026 }), un = q('proposed', { sub: 'ra' });
  const o = F.ageQuotes([d, un]); assert.ok(o.has(un.id) && !o.has(d.id), 'inside one product an undated one still loses to a dated one'); assert.ok(/no date in its name, and a dated one exists: not ticked \(retirement annuity\)/.test(o.get(un.id)));
  assert.strictEqual(F.ageQuotes([q('proposed', { sub: 'ra' }), q('proposed', { sub: 'tfsa', ex: date(2026, 1, 1), y: 2026 })]).size, 0, 'an undated RA proposal is not made old by a dated Tax-Free one');
});
test('ageQuotes: the year rule is also per product: a product with a year folder is ruled by year, another product with none by the date', () => {
  const ra24 = q('proposed', { sub: 'ra', y: 2024, fy: 2024 }), ra26 = q('proposed', { sub: 'ra', y: 2026, fy: 2026 }), tf25 = q('proposed', { sub: 'tfsa', ex: date(2025, 6, 1), y: 2025 }), tf26 = q('proposed', { sub: 'tfsa', ex: date(2026, 6, 1), y: 2026 });
  const older = F.ageQuotes([ra24, ra26, tf25, tf26]);
  assert.deepStrictEqual(state([ra24, ra26, tf25, tf26], older), [ra24.id + ':old', ra26.id + ':ok', tf25.id + ':old', tf26.id + ':ok']);
  assert.ok(/older year \(2024\): not ticked, the newest is 2026 \(retirement annuity\)/.test(older.get(ra24.id)));
});
test('ageQuotes: goal reports: the newest retirement report and the newest education report are both ticked; the others are unchanged', () => {
  const r24 = q('goals', { sub: 'rgar', y: 2024, fy: 2024 }), e25 = q('goals', { sub: 'egar', ex: date(2025, 1, 1), y: 2025 }), r26 = q('goals', { sub: 'rgar', y: 2026, fy: 2026 });
  const o1 = F.ageQuotes([r24, e25]); assert.strictEqual(o1.size, 0, 'a 2024 retirement report and a 2025 education report are different kinds: both ticked (1.7 would have unticked the 2024 one)');
  const o2 = F.ageQuotes([r24, e25, r26]); assert.ok(o2.has(r24.id) && !o2.has(e25.id) && !o2.has(r26.id), 'a newer retirement report makes the 2024 retirement report old, not the education report');
  const f1 = q('fna', { y: 2024, fy: 2024 }), f2 = q('fna', { y: 2026, fy: 2026 }), s1 = q('shortfallQuote', { ex: date(2024, 1, 1), y: 2024 }), s2 = q('shortfallQuote', { ex: date(2026, 1, 1), y: 2026 });
  const o3 = F.ageQuotes([f1, f2, s1, s2]); assert.ok(o3.has(f1.id) && !o3.has(f2.id) && o3.has(s1.id) && !o3.has(s2.id), 'FNA and shortfall quotes are one group each, as before'); assert.ok(!/\(/.test(o3.get(s1.id).replace(/\(\d\d\/\d\d\/\d{4}\)/, '')), 'and their reasons carry no product');
});
test('ageQuotes: a pay-out guide still follows its quote whatever the products', () => {
  const qa = q('comparative', { y: 2024, fy: 2024, no: '400500601' }), qb = q('comparative', { y: 2026, fy: 2026, no: '400500602' }), ga = q('cmp', { no: '400500601' }), gb = q('cmp', { no: '400500602' });
  const o = F.ageQuotes([qa, qb, ga, gb]); assert.ok(o.has(ga.id) && !o.has(gb.id));
});

/* ---------- 1. a schedule or statement in a Review folder is the policy's schedule candidate ---------- */
const calls = { write: 0 };
const names = list => list.map(x => x.name);
class FileH { constructor(name) { this.kind = 'file'; this.name = name; } async createWritable() { calls.write++; throw new Error('read only'); } }
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  async *entries() { for (const [k, h] of this.kids) yield [k, h]; }
  add(...x) { let d = this; for (const y of x) d = d.kids.get(y) || (d.kids.set(y, new Dir(y, d)), d.kids.get(y)); return d; }
  file(...x) { x.forEach(y => this.kids.set(y, new FileH(y))); return this; }
  async getDirectoryHandle() { calls.write++; throw new Error('read only'); }
  async getFileHandle() { calls.write++; throw new Error('read only'); }
  async removeEntry() { calls.write++; throw new Error('read only'); }
}
const client = d => ({ rootKey: 'A', parts: ['Test, Dora'], handle: d });
test('walkPolicy: a schedule, a statement or a PS in a Review folder is the policy\'s candidate; a Review Summary, a letter, a quote, a signed or accepted copy, the owner\'s manual and another insurer\'s file are not', async () => {
  calls.write = 0;
  const c = new Dir('Test, Dora'), pf = c.add('NinetyOne Invest - 449900'), rv = pf.add('2026 - Review');
  rv.file('Policy Schedule 15.02.26.pdf', 'Invest IS 30.06.26.pdf', 'Investment Statement 30.06.26.pdf', 'UT PS 01.03.26.pdf', 'Review Summary 2026.pdf', 'Premium Increase Letter 2026.pdf', 'Quote 2026.pdf', 'Signed Policy Schedule 2026.pdf', 'Accepted Schedule.pdf', "Owner's Manual.pdf", 'Liberty Policy Schedule 2026.pdf', 'Review Notes.pdf', 'Change of details form.pdf');
  rv.add('Charts').file('Statement 31.03.26.pdf', 'Chart Summary.pdf');
  pf.add('Policy Schedules', '2025').file('Invest PS 31.12.25.pdf');
  const scan = await F.policyScan(client(c), { ms: 5000, cap: 500 }), g = scan.groups[0];
  assert.deepStrictEqual(names(g.files).sort(), ['Invest IS 30.06.26.pdf', 'Invest PS 31.12.25.pdf', 'Investment Statement 30.06.26.pdf', 'Policy Schedule 15.02.26.pdf', 'Statement 31.03.26.pdf', 'UT PS 01.03.26.pdf'], 'schedule, statement and PS names are candidates, one folder down too');
  assert.deepStrictEqual(names(g.quotes).sort(), ['Accepted Schedule.pdf', 'Change of details form.pdf', 'Chart Summary.pdf', 'Liberty Policy Schedule 2026.pdf', 'Premium Increase Letter 2026.pdf', 'Quote 2026.pdf', 'Review Notes.pdf', 'Review Summary 2026.pdf', 'Signed Policy Schedule 2026.pdf'], 'everything else is listed as a review document; the manual is neither');
  assert.ok(g.files.every(f => f.role === 'schedule') && g.files.every(f => f.handle && f.rel && f.key), 'a candidate carries what any candidate carries');
  assert.ok(!names(g.quotes).some(x => names(g.files).includes(x)), 'no document is in both lists');
  const pick = F.newestOf(g.files); assert.strictEqual(pick.file && pick.file.name, 'Investment Statement 30.06.26.pdf', 'the newest by its date wins across the Review folder and the Policy Schedules folder; on one date the name that says statement beats "IS"'); assert.strictEqual(pick.tie, false);
  assert.strictEqual(calls.write, 0, 'nothing was written, created or removed');
});
test('walkPolicy: an older schedule in a Review folder does not beat a newer one in Policy Schedules (the folder\'s year ranks it)', async () => {
  const c = new Dir('Test, Dora'), pf = c.add('NinetyOne Invest - 449900');
  pf.add('2024 - Review').file('Policy Schedule.pdf'); pf.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf');
  const g = (await F.policyScan(client(c), { ms: 5000, cap: 500 })).groups[0], pick = F.newestOf(g.files);
  assert.strictEqual(g.files.length, 2); assert.strictEqual(pick.file.name, 'Invest PS 31.03.26.pdf');
});
test('walkPolicy: a Review folder named for its statements or schedules was already entered as a schedule folder and still is', async () => {
  const c = new Dir('Test, Dora'), pf = c.add('Coronation RA - 458899');
  pf.add('Annual Review Statements').file('Statement 31.12.25.pdf', 'Review Summary.pdf');
  const g = (await F.policyScan(client(c), { ms: 5000, cap: 500 })).groups[0];
  assert.deepStrictEqual(names(g.files).sort(), ['Review Summary.pdf', 'Statement 31.12.25.pdf'], 'unchanged 1.5 / 1.6 behaviour: a statements folder\'s own PDFs are candidates'); assert.deepStrictEqual(names(g.quotes), []);
});

/* ---------- 2. a signed quote in a review folder is not ticked (kept as it is) ---------- */
test('classify: a signed or accepted quote in Comparative Quotes\\2026 - Review or in a policy folder\'s Review folder is never a quote; a quote there is', () => {
  const cls = (n, d) => { const c = D.classify(n, d); return c ? c.block + (c.viaReview ? '*' : '') : null; };
  const CQ = 'Coronation RA - 458899 \\ Comparative Quotes \\ 2026 - Review', RV = 'Coronation RA - 458899 \\ 2026 - Review';
  ['Signed Coronation Quote.pdf', 'Coronation Quote - signed.pdf', 'Accepted Coronation Quote 2026.pdf'].forEach(x => { assert.strictEqual(cls(x, CQ), null, x); assert.strictEqual(cls(x, RV), null, x); assert.ok(D.reviewPaperwork(x, CQ), x); });
  assert.strictEqual(cls('Coronation RA Quote 2026.pdf', CQ), 'comparative'); assert.strictEqual(cls('Quote 2026.pdf', RV), 'comparative');
});

/* ---------- 3. the words are left as they are; the wiring ---------- */
test('the page is 1.8, no key is added, the entries carry the product, the walk takes a Review schedule, and the tags are new', () => {
  assert.ok(/^1\.[89]$/.test(schema.pageVersion), 'page 1.8, or 1.9 which came after it'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.7'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fo = app('js/folders.js'), html = app('overview.html');
  assert.ok(/sub: F\.quoteSub \? F\.quoteSub\(kd, f\.name\) : ''/.test(ui), 'tickPlan gives every entry its product or report kind');
  assert.ok(/REVIEW_SCHEDULE\.test\(low\)/.test(fo) && /var REVIEW_SCHEDULE = \/schedule\|s\(a\)\?tatement\|\(\^\|\[\^a-z\]\)\(ps\|is\)\(\[\^a-z\]\|\$\)\//.test(fo), 'the walk takes a schedule, a statement or a PS from a Review folder');
  assert.ok(/!\/signed\/\.test\(low\)/.test(fo) && /!NOT_SCHEDULE\.test\(low\)/.test(fo), 'never a signed copy, a letter, a quote or a form');
  assert.ok(/quoteSub: quoteSub/.test(fo), 'quoteSub is exported');
  const D2 = app('js/ov-docs.js'); assert.ok(/PAPERWORK = \/signed\|accept\|letter\|sroa/.test(D2) && /QUOTEISH = \/quote\|proposal\|illustration/.test(D2), 'Paul: "3 leave": the paperwork and quote words are as they were');
  ['ov-schema', 'ov-docs', 'ov-ui', 'folders'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[vw]').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=20261124[vw]/.test(app(f)), f));
});

/* ---------- the ranking of a Review folder's schedule against the policy's other schedules (pinned, whatever it is) ---------- */
const pickOf = async build => { const c = new Dir('Test, Dora'), pf = c.add('NinetyOne Invest - 449900'); build(pf); const g = (await F.policyScan(client(c), { ms: 5000, cap: 500 })).groups[0]; return { g, p: F.newestOf(g.files) }; };
test('ranking: a Review folder\'s schedule with a LATER date than the schedule of the same year is the pick; with an EARLIER date it is not', async () => {
  let r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule 15.06.26.pdf'); pf.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf'); });
  assert.strictEqual(r.p.file.name, 'Policy Schedule 15.06.26.pdf');
  r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule 15.02.26.pdf'); pf.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf'); });
  assert.strictEqual(r.p.file.name, 'Invest PS 31.03.26.pdf');
});
test('ranking (PINNED, to tell Paul): a Review folder\'s schedule with NO date in its name loses to a DATED schedule of the same year in Policy Schedules (an undated file ranks below a dated one of its year); two undated ones of one year tick none and say so; the same file name in both places is one document', async () => {
  let r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule.pdf'); pf.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf'); });
  assert.strictEqual(r.g.files.length, 2); assert.strictEqual(r.p.file.name, 'Invest PS 31.03.26.pdf', 'the dated one is the pick: the undated Review schedule is not ticked');
  r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule 2026.pdf'); pf.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf'); });
  assert.strictEqual(r.p.file.name, 'Invest PS 31.03.26.pdf', 'a bare year in the name is not a date either');
  r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule.pdf'); pf.add('Policy Schedules', '2026').file('Policy Schedule Summary.pdf'); });
  assert.strictEqual(r.p.tie, true); assert.strictEqual(r.p.file, null, 'both undated in one year: nothing is picked, the tie is said');
  r = await pickOf(pf => { pf.add('2026 - Review').file('Policy Schedule.pdf'); pf.add('Policy Schedules', '2026').file('Policy Schedule.pdf'); });
  assert.strictEqual(r.g.files.length, 2); assert.strictEqual(r.p.tie, false); assert.ok(r.p.file, 'the same name in both places is one document, not a tie');
});
test('IS (an investment statement) in a Review folder is a candidate like a statement; a word that merely contains the letters is not', async () => {
  let r = await pickOf(pf => { pf.add('2026 - Review').file('Invest IS 30.06.26.pdf', 'This Quote.pdf', 'Analysis.pdf'); });
  assert.deepStrictEqual(names(r.g.files), ['Invest IS 30.06.26.pdf']); assert.deepStrictEqual(names(r.g.quotes).sort(), ['Analysis.pdf', 'This Quote.pdf']);
});
