/* Client Overview Studio 1.7 (25 November, Paul's answer relayed by the Fix Skills chat at 14:52): "a kind with NO year folder anywhere (for example two loose shortfall quotes of different years): tick only the NEWEST BY THE DATE IN ITS NAME (not both);
   if there is no date at all, keep both ticked." The age rule of the quotes is ONE pure function, folders.js `ageQuotes`, which `tickPlan` calls: tested here without a screen (the year rule of 1.6 is pinned with it, so a change to one cannot break the other).
   What is ticked in the real pick list is looked at in tests/browser/t-overview-round160.js. Invented numbers only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

let n = 0;
const q = (kind, o) => Object.assign({ id: 'f' + (++n), kind, y: 0, fy: 0, ex: 0, no: '' }, o || {});
const date = (y, m, d) => y * 10000 + (m || 0) * 100 + (d || 0);
const named = (list, older) => list.map(x => x.id + (older.has(x.id) ? ':old' : ':ok'));

/* ---------- 1. a kind with no year folder: the newest date in the name ---------- */
test('a kind with no year folder anywhere: only the newest by the date in its name is ticked; the older one says why', () => {
  const a = q('shortfallQuote', { y: 2024, ex: date(2024, 3, 3) }), b = q('shortfallQuote', { y: 2026, ex: date(2026, 1, 10) });
  const older = F.ageQuotes([a, b]);
  assert.ok(older.has(a.id) && !older.has(b.id), 'the 2024 one is older, the 2026 one is the newest');
  assert.match(older.get(a.id), /older date \(03\/03\/2024\): not ticked, the newest is 10\/01\/2026/, 'the reason names both dates');
});

test('the same date on two documents: both are ticked (two quotes of one day are both the newest)', () => {
  const a = q('proposed', { y: 2026, ex: date(2026, 2, 5) }), b = q('proposed', { y: 2026, ex: date(2026, 2, 5) }), c = q('proposed', { y: 2025, ex: date(2025, 12, 1) });
  const older = F.ageQuotes([a, b, c]);
  assert.deepStrictEqual(named([a, b, c], older), [a.id + ':ok', b.id + ':ok', c.id + ':old']);
});

test('no date at all in a kind with no year folder: every one stays ticked (the old behaviour, Paul: "if no date at all, keep both ticked")', () => {
  const a = q('proposed'), b = q('proposed');
  assert.strictEqual(F.ageQuotes([a, b]).size, 0);
  assert.strictEqual(F.ageQuotes([q('goals')]).size, 0, 'one document alone is never older');
});

test('one dated and one undated in a kind with no year folder: the dated one is ticked, the undated one is not (an undated quote loses, as against a year folder)', () => {
  const dated = q('shortfallQuote', { y: 2026, ex: date(2026, 1, 10) }), none = q('shortfallQuote');
  const older = F.ageQuotes([dated, none]);
  assert.ok(!older.has(dated.id) && older.has(none.id));
  assert.match(older.get(none.id), /no date in its name, and a dated one exists: not ticked/);
});

test('a month with no day ("Mar \'25", yyyymm00) is a date: it is told apart from a full date and printed as month and year', () => {
  const a = q('reduced', { y: 2025, ex: date(2025, 3, 0) }), b = q('reduced', { y: 2026, ex: date(2026, 4, 0) }), older = F.ageQuotes([a, b]);
  assert.match(older.get(a.id), /older date \(03\/2025\): not ticked, the newest is 04\/2026/);
});

test('each kind is ruled on its own: an old FNA quote is not older because a reduced quote is newer', () => {
  const fna = q('fna', { y: 2024, ex: date(2024, 5, 1) }), red = q('reduced', { y: 2026, ex: date(2026, 5, 1) });
  assert.strictEqual(F.ageQuotes([fna, red]).size, 0);
});

/* ---------- 1b. a month or a bare year in the name is a date too, compared at the coarser precision ---------- */
test('nameDate: a date, a month or a bare year in a FILE NAME is read (never the folder); a number that merely contains a year is not', () => {
  const nd = F.nameDate;
  assert.strictEqual(nd('Shortfall Quote 03.03.24.pdf'), 20240303);
  assert.strictEqual(nd('Quote Mar 2026.pdf'), 20260300); assert.strictEqual(nd('Quote March 2026.pdf'), 20260300); assert.strictEqual(nd('Quote 03.2026.pdf'), 20260300); assert.strictEqual(nd('Quote 2026-03.pdf'), 20260300); assert.strictEqual(nd("Quote Mar '26.pdf"), 20260300);
  assert.strictEqual(nd('Shortfall Quote 2026.pdf'), 20260000, 'a bare year');
  assert.strictEqual(nd('FNA CP 400500602.pdf'), 0, 'a CP number holds no year'); assert.strictEqual(nd('Policy 20264455.pdf'), 0); assert.strictEqual(nd('Quote 2026-5566.pdf'), 0, 'a year that starts a longer figure is not a year'); assert.strictEqual(nd('Quote.pdf'), 0);
  assert.strictEqual(nd('2026 - Review'), 20260000 /* a bare name; the caller passes FILE names, the folder's year is dateKey's .year */);
});

test('a year or a month in the name is not older than a full date of the same year or month, and beats an older full date: nothing loses to a coarser date that it is not older than', () => {
  const old = q('shortfallQuote', { y: 2024, ex: date(2024, 3, 3) }), year = q('shortfallQuote', { y: 2026, ex: date(2026, 0, 0) }), day = q('shortfallQuote', { y: 2026, ex: date(2026, 1, 10) });
  const older = F.ageQuotes([old, year, day]);
  assert.deepStrictEqual(named([old, year, day], older), [old.id + ':old', year.id + ':ok', day.id + ':ok'], 'a bare 2026 and 10/01/2026 are both the newest; the 2024 one is older than both');
  assert.match(older.get(old.id), /older date \(03\/03\/2024\): not ticked, the newest is 10\/01\/2026/);
  const lone = q('shortfallQuote', { y: 2026, ex: date(2026, 0, 0) }), older2 = F.ageQuotes([q('shortfallQuote', { y: 2024, ex: date(2024, 3, 3) }), lone]);
  assert.ok(!older2.has(lone.id) && older2.size === 1, 'a bare year beside an older full date is the newest');
  const mar = q('reduced', { y: 2026, ex: date(2026, 3, 0) }), mar3 = q('reduced', { y: 2026, ex: date(2026, 3, 3) }), jan = q('reduced', { y: 2026, ex: date(2026, 1, 10) });
  const o3 = F.ageQuotes([mar, mar3, jan]);
  assert.deepStrictEqual(named([mar, mar3, jan], o3), [mar.id + ':ok', mar3.id + ':ok', jan.id + ':old'], '"Mar 2026" and 03/03/2026 are the same month: both are the newest; January is older');
  assert.match(o3.get(jan.id), /the newest is 03\/03\/2026/, 'the reason names the newest full date');
});

/* ---------- 2. the year rule of 1.6 is untouched ---------- */
test('a kind with a year folder is still ruled by the YEAR, not by the date: two quotes of one year folder are both ticked, an older year and a loose undated one are not', () => {
  const y26a = q('fna', { y: 2026, fy: 2026, ex: date(2026, 1, 5) }), y26b = q('fna', { y: 2026, fy: 2026, ex: date(2026, 11, 20) }), y24 = q('fna', { y: 2024, fy: 2024 }), loose = q('fna');
  const older = F.ageQuotes([y26a, y26b, y24, loose]);
  assert.deepStrictEqual(named([y26a, y26b, y24, loose], older), [y26a.id + ':ok', y26b.id + ':ok', y24.id + ':old', loose.id + ':old']);
  assert.match(older.get(y24.id), /older year \(2024\): not ticked, the newest is 2026/);
  assert.match(older.get(loose.id), /no year found in its folder or name, and 2026 exists: not ticked/);
});

test('a loose file with only a year in its name (a bare 2026) beside a 2024 year folder is the newest year: it is not "no year found"', () => {
  const folder = q('fna', { y: 2024, fy: 2024 }), loose = q('fna', { y: 2026, ex: date(2026, 0, 0) });
  const older = F.ageQuotes([folder, loose]);
  assert.ok(older.has(folder.id) && !older.has(loose.id));
});

test('a loose file dated 2026 beside a 2025 year folder is the newest year too (its name year counts when it sits in no year folder)', () => {
  const folder = q('reduced', { y: 2025, fy: 2025 }), loose = q('reduced', { y: 2026, ex: date(2026, 2, 2) });
  const older = F.ageQuotes([folder, loose]);
  assert.ok(older.has(folder.id) && !older.has(loose.id));
});

test('comparative quotes are always ruled by year (the 1.5 rule), never by the date: two of one year are both ticked even with no year folder', () => {
  const a = q('comparative', { y: 2026, ex: date(2026, 1, 3) }), b = q('comparative', { y: 2026, ex: date(2026, 9, 9) }), c = q('comparative', { y: 2024, ex: date(2024, 1, 1) });
  const older = F.ageQuotes([a, b, c]);
  assert.deepStrictEqual(named([a, b, c], older), [a.id + ':ok', b.id + ':ok', c.id + ':old']);
  assert.strictEqual(F.ageQuotes([q('comparative'), q('comparative')]).size, 0, 'no year anywhere: both stay ticked');
});

/* ---------- 3. a pay-out guide follows its quote ---------- */
test('a pay-out guide follows its quote: the guide of a quote that is not ticked (by date or by year) is not ticked; a guide with no matching quote is ticked', () => {
  const oldQ = q('shortfallQuote', { y: 2024, ex: date(2024, 3, 3), no: '400500601' }), newQ = q('shortfallQuote', { y: 2026, ex: date(2026, 1, 10), no: '400500602' });
  const gOld = q('cmp', { no: '400500601' }), gNew = q('cmp', { no: '400500602' }), gNone = q('cmp', { no: '400500999' }), gNoNumber = q('cmp');
  const older = F.ageQuotes([oldQ, newQ, gOld, gNew, gNone, gNoNumber]);
  assert.ok(older.has(oldQ.id) && !older.has(newQ.id));
  assert.ok(older.has(gOld.id) && /guide of an older quote/.test(older.get(gOld.id)));
  assert.ok(!older.has(gNew.id) && !older.has(gNone.id) && !older.has(gNoNumber.id));
  const same = q('fna', { y: 2024, fy: 2024, no: '777000111' }), same2 = q('reduced', { y: 2026, fy: 2026, no: '777000111' }), g = q('cmp', { no: '777000111' });
  assert.ok(!F.ageQuotes([same, same2, g]).has(g.id), 'a ticked quote carries the number, so the guide is ticked');
});

/* ---------- 3b. a Review or Servicing folder inside a policy folder: a mix of new quotes and paperwork (Paul, 25 November 14:55) ---------- */
const D = require('../app/js/ov-docs.js');
const calls = { write: 0 };
const names = list => list.map(x => x.name);
class FileH { constructor(name) { this.kind = 'file'; this.name = name; } async createWritable() { calls.write++; throw new Error('read only'); } }
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  async *entries() { for (const [k, h] of this.kids) yield [k, h]; }
  add(...names) { let d = this; for (const x of names) d = d.kids.get(x) || (d.kids.set(x, new Dir(x, d)), d.kids.get(x)); return d; }
  file(...x) { x.forEach(y => this.kids.set(y, new FileH(y))); return this; }
  async getDirectoryHandle() { calls.write++; throw new Error('read only'); }
  async getFileHandle() { calls.write++; throw new Error('read only'); }
  async removeEntry() { calls.write++; throw new Error('read only'); }
}
test('classify, a Review or Servicing folder directly inside a policy folder: a document is a quote only when its NAME says so; never a letter, a signed or accepted copy, an SROA, a schedule or the owner\'s manual', () => {
  const cls = (n, d) => { const c = D.classify(n, d); return c ? c.block + (c.viaReview ? '*' : '') : null; };
  const V = 'NinetyOne Invest - 449900 \\ 2026 - Review', S = 'NinetyOne Invest - 449900 \\ Servicing', Y = 'NinetyOne Invest - 449900 \\ Servicing \\ 2026';
  ['NinetyOne RA Premium Increase 2026.pdf', 'Signed FNA Quote 2026.pdf', 'Quote - accepted.pdf', 'SROA 2026.pdf', 'ROA.pdf', 'Review Letter 2026.pdf', "Owner's Manual.pdf", 'Policy Schedule 2026.pdf', 'Change of details form.pdf', 'Signed Reduced Quote.pdf'].forEach(n => {
    assert.strictEqual(cls(n, V), null, n + ' in a Review folder is not a quote'); assert.strictEqual(cls(n, S), null, n + ' in Servicing is not a quote'); assert.ok(D.reviewPaperwork(n, V), n + ' is paperwork');
  });
  [['Quote.pdf', 'comparative'], ['Quote 2026.pdf', 'comparative'], ['Coronation Proposal 2026.pdf', 'comparative'], ['Cover Proposal 400500777.pdf', 'comparative'], ['CP 400500777.pdf', 'comparative'], ['FNA Quote 2026.pdf', 'fna'], ['Reduced Quote.pdf', 'reduced'], ['Shortfall.pdf', 'shortfallQuote']].forEach(([n, b]) => {
    assert.strictEqual(cls(n, V), b, n + ' in a Review folder'); assert.strictEqual(cls(n, S), b, n + ' in Servicing'); assert.strictEqual(cls(n, Y), b, n + ' in a year folder of Servicing'); assert.ok(!D.reviewPaperwork(n, V));
  });
  assert.strictEqual(cls('RA Review 2026.pdf', V), 'comparative*', 'an investment by its name and nothing says quote: listed as a comparative quote by its folder, not ticked');
  assert.strictEqual(cls('Review Summary 2026.pdf', V), null, 'a name that says nothing stays unclassified');
  assert.strictEqual(cls('Quote.pdf', '3. Quotes \\ 2026 - Review'), null, 'in a numbered quotes folder a bare Quote is not guessed (the kind is unknown)');
  assert.strictEqual(cls('Signed FNA Quote.pdf', '3. Quotes \\ 2026 - Review'), null, 'but a signed copy is never a quote, wherever the Review folder is');
  assert.strictEqual(cls('FNA Quote.pdf', '3. Quotes \\ 2026 - Review'), 'fna');
  assert.strictEqual(cls('Statement 31.03.26.pdf', 'NinetyOne Invest - 449900 \\ Policy Schedules \\ 2026'), 'investments', 'a statement in Policy Schedules is untouched');
  assert.ok(!D.reviewPaperwork('Signed Quote.pdf', 'NinetyOne Invest - 449900 \\ Policy Schedules'), 'outside a Review or Servicing folder the paperwork rule does not apply');
});
test('classify, the paperwork rule touches only what could be taken for a quote: an e-mail, a pay-out guide, an Astute report, a goal report, follow-up notes and a group statement keep their block in a Review or Servicing path, and a schedule folder is never ruled by it', () => {
  const cls = (n, d) => { const c = D.classify(n, d); return c ? c.block + (c.viaReview ? '*' : '') : null; };
  const V = '3. Quotes \\ 2026 - Review', P = 'NinetyOne Invest - 449900 \\ Servicing';
  assert.strictEqual(cls('BrightRock reply.eml', V), 'bremail'); assert.strictEqual(cls('Email from BrightRock 400500777.txt', P), 'bremail');
  assert.strictEqual(cls('BR CMPO - 400500777.pdf', V), 'cmp'); assert.strictEqual(cls('Astute Report 2026.pdf', P), 'astute');
  assert.strictEqual(cls('RGAR Report 2026.pdf', V), 'goals'); assert.strictEqual(cls('Follow-Up Summary Notes 2026.pdf', V), 'followup');
  assert.strictEqual(cls('Provident Fund Statement 2026.pdf', P), 'group', 'a group statement is a group statement wherever it sits');
  const S = '6. Policy Schedules \\ 2026 - Review';
  assert.strictEqual(cls('Policy Schedule 2026.pdf', S), 'policies', 'a schedule in a schedule folder stays a schedule: the folder says what it is');
  assert.strictEqual(cls('Investment Statement 30.06.26.pdf', S), 'investments');
  assert.ok(!D.reviewPaperwork('Policy Schedule 2026.pdf', S), 'and it is not called paperwork');
  assert.strictEqual(cls('Premium Letter 2026.pdf', S), 'policies', 'a schedule folder is not ruled by the paperwork rule at all (its name still says policy)');
});
test('walkPolicy: Servicing\'s schedules are candidates, its other documents are listed (g.quotes), its manual is the last resort, and nothing is written', async () => {
  calls.write = 0;
  const c = new Dir('Test, Dora'), pf = c.add('NinetyOne Invest - 449900'), sv = pf.add('Servicing');
  sv.file('Policy Schedule 31.03.26.pdf', 'NinetyOne RA Premium Increase 2026.pdf', 'Quote 2026.pdf', "Owner's Manual.pdf", 'Signed FNA Quote 2026.pdf');
  sv.add('2026').file('Premium Letter.pdf', 'Investment Statement 30.06.26.pdf');
  pf.file('Letter.pdf', 'Loose Statement 2025.pdf'); pf.add('Applications').file('Application.pdf');
  const scan = await F.policyScan({ rootKey: 'A', parts: ['Test, Dora'], handle: c }, { ms: 5000, cap: 500 }), g = scan.groups[0];
  assert.deepStrictEqual(names(g.files).filter(x => !/Manual/.test(x)).sort(), ['Investment Statement 30.06.26.pdf', 'Loose Statement 2025.pdf', 'Policy Schedule 31.03.26.pdf'], 'schedule-like names are candidates (a loose one in the policy folder as before)');
  assert.ok(g.files.some(x => /Manual/.test(x.name) && x.role === 'manual'), 'the owner\'s manual is kept as the last resort');
  assert.deepStrictEqual(names(g.quotes).sort(), ['NinetyOne RA Premium Increase 2026.pdf', 'Premium Letter.pdf', 'Quote 2026.pdf', 'Signed FNA Quote 2026.pdf'], 'the rest of Servicing is listed, also one folder down; the manual and a loose letter of the policy folder are not');
  assert.ok(!names(g.quotes).includes('Letter.pdf') && !names(g.quotes).includes('Application.pdf'), 'the policy folder\'s own loose files and Applications are not listed');
  assert.strictEqual(calls.write, 0);
});

/* ---------- 4. the wiring ---------- */
test('the page is 1.7, no key is added, tickPlan asks the one function, and the tags are new', () => {
  assert.ok(/^(1\.[789]|2\.[01])$/.test(schema.pageVersion), 'page 1.7, or 1.8 which came after it'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.6'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fo = app('js/folders.js'), html = app('overview.html');
  assert.ok(/F\.ageQuotes \? F\.ageQuotes\(entries\)/.test(ui) && !/var ruled = function/.test(ui) && !/var oldNo/.test(ui), 'tickPlan has no copy of the rule');
  assert.ok(/function ageQuotes\(entries\)/.test(fo) && /ageQuotes: ageQuotes/.test(fo));
  ['ov-schema', 'ov-docs', 'ov-ui', 'folders', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=(?:20261124[uvw]|20261125[a-z])').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=(?:20261124[uvw]|20261125[a-z])/.test(app(f)) && /folders-ui\.js\?v=(?:20261124[uvw]|20261125[a-z])/.test(app(f)), f));
  assert.ok(!/ageQuotes/.test(app('js/ov-store.js') + app('js/ov-calc.js')), 'the saved file and its sums are untouched');
});
