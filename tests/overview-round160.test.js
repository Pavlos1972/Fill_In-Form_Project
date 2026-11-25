/* Client Overview Studio 1.6 (25 November, Paul's answers relayed by the Fix Skills chat at 13:02): "look in the latest year folder as the first port of call. If that's not present, then look at what is the latest review documents" and
   "only latest for the same policy number / schedule". Without a screen here: a folder named Review inside a policy folder is read BY FOLDER (its documents are listed as review documents, never as schedules), a document in a Review folder is never a CURRENT
   investment or policy, one schedule is picked per policy folder (the newest), and the wiring of the year rule. What is ticked in the list is looked at in tests/browser/t-overview-round160.js. Invented client only ("Test, Dora"). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const docs = require('../app/js/ov-docs.js');
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const calls = { write: 0 };
class FileH { constructor(name) { this.kind = 'file'; this.name = name; } async createWritable() { calls.write++; throw new Error('read only'); } }
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  async *entries() { for (const [n, h] of this.kids) yield [n, h]; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n, d)), d.kids.get(n)); return d; }
  file(...n) { n.forEach(x => this.kids.set(x, new FileH(x))); return this; }
  async getDirectoryHandle() { calls.write++; throw new Error('read only'); }
  async getFileHandle() { calls.write++; throw new Error('read only'); }
  async removeEntry() { calls.write++; throw new Error('read only'); }
}
const client = d => ({ rootKey: 'A', parts: ['Test, Dora'], handle: d });
const names = list => list.map(x => x.name);

function tree() {
  const c = new Dir('Test, Dora');
  const st = c.add('Stanlib Invest - 7766554');
  st.add('Policy Schedules', '2025').file('Invest PS 31.12.25.pdf'); st.add('Policy Schedules', '2026').file('UT PS 31.03.26.pdf');
  st.add('2026 - Review').file('Review Summary 2026.pdf', 'RA Review Valuation 2026.pdf', 'Owner\'s Manual.pdf'); st.add('2026 - Review', 'Charts').file('Policy Review Notes.pdf');
  st.add('Comparative Quotes', '2026 - Review').file('Coronation RA Quote 2026.pdf');
  st.add('Applications').file('Application.pdf');
  const cr = c.add('Coronation RA - 458899'); cr.add('Annual Review Statements').file('Statement 31.12.25.pdf'); cr.add('2024 - Review').file('Statement Review 2024.pdf'); cr.add('Policy Schedules', '2026').file('Statement 31.03.26.pdf');
  return c;
}

/* ---------- 1. a Review folder inside a policy folder is read by its folder ---------- */
test('a folder named Review inside a policy folder: its documents are listed as review documents (g.quotes); only one whose name says schedule, statement, IS or PS is the policy\'s schedule candidate (1.8)', async () => {
  calls.write = 0;
  const scan = await F.policyScan(client(tree()), { ms: 5000, cap: 500 });
  const st = scan.groups.find(g => /Stanlib/.test(g.name)), cr = scan.groups.find(g => /Coronation/.test(g.name));
  assert.deepStrictEqual(names(st.files).sort(), ['Invest PS 31.12.25.pdf', 'UT PS 31.03.26.pdf'], 'only the schedules are candidates: a "Review Summary" is not a policy summary schedule');
  assert.deepStrictEqual(names(st.quotes).sort(), ['Policy Review Notes.pdf', 'RA Review Valuation 2026.pdf', 'Review Summary 2026.pdf'], 'the review documents, also one folder down; the owner\'s manual is not one');
  assert.ok(st.quotes.every(f => f.rel[0] === st.name && /review/i.test(f.rel.join(' '))), 'each carries the folder it was found in');
  assert.ok(!names(st.quotes).includes('Coronation RA Quote 2026.pdf'), 'Comparative Quotes is still not walked here (its own listing reads it): no document twice');
  assert.deepStrictEqual(names(cr.files).sort(), ['Statement 31.03.26.pdf', 'Statement 31.12.25.pdf', 'Statement Review 2024.pdf'], '1.8 (Paul: a schedule or statement in a Review folder is the policy\'s own): the statement left in 2024 - Review is a candidate too, like the one in Annual Review Statements (a folder that says statement)');
  assert.deepStrictEqual(names(cr.quotes), [], 'and it is not listed as a review document');
  assert.ok(cr.files.find(f => /Review 2024/.test(f.name)).key.year === 2024 && st.quotes.every(f => f.key.year === 2026 || f.key.exact === 0), 'its key carries the year of its folder, so the newest is told apart from it');
  assert.strictEqual(F.newestOf(cr.files).file.name, 'Statement 31.03.26.pdf', 'the 2026 statement is still the newest, the 2024 one in the Review folder is older');
  assert.strictEqual(calls.write, 0, 'nothing was written, created or removed');
  assert.ok(scan.groups.every(g => Array.isArray(g.quotes)), 'every group has the list, empty when there is no review folder');
});

/* ---------- 2. one schedule is picked per policy folder: the newest ---------- */
test('two schedules in one policy folder (an Invest schedule and a Unit Trust schedule): only the newest is the pick; the same date ticks none and says so', async () => {
  const scan = await F.policyScan(client(tree()), { ms: 5000, cap: 500 });
  const st = scan.groups.find(g => /Stanlib/.test(g.name)), pick = F.newestOf(st.files);
  assert.strictEqual(pick.file.name, 'UT PS 31.03.26.pdf', 'the newest by its date');
  assert.strictEqual(pick.tie, false);
  const d = new Dir('Test, Dora'), g = d.add('Stanlib Invest - 7766554'); g.add('Policy Schedules', '2026').file('Invest PS 31.03.26.pdf', 'UT PS 31.03.26.pdf');
  const same = await F.policyScan(client(d), { ms: 5000, cap: 500 }), tied = F.newestOf(same.groups[0].files);
  assert.strictEqual(tied.file, null, 'two different files on one date: none is picked (the adviser chooses)'); assert.strictEqual(tied.tie, true); assert.strictEqual(tied.tied.length, 2);
});

/* ---------- 3. a Review folder never makes a document a CURRENT investment or policy ---------- */
test('classify: a document in a folder named Review is a review document, never a current investment or policy because its name has RA or policy in it; the others keep their kind', () => {
  const cls = (n, d) => { const c = docs.classify(n, d); return c ? c.block : null; };
  assert.strictEqual(cls('RA Review Valuation 2026.pdf', 'Stanlib Invest - 7766554 \\ 2026 - Review'), 'comparative', 'an investment by its name, a review document by its folder');
  assert.strictEqual(cls('RA Review Valuation 2026.pdf', ''), 'investments', 'the same name with no folder says investments, as before');
  assert.strictEqual(cls('Policy Review Notes.pdf', 'BR Personal Covers - 811234567 \\ 2026 - Review \\ Charts'), 'comparative');
  assert.strictEqual(cls('Policy Review Notes.pdf', 'BR Personal Covers - 811234567'), 'policies');
  assert.strictEqual(cls('Quote FNA 2026.pdf', '3. Quotes \\ 2026 - Review'), 'fna', 'a document that says what it is keeps it');
  assert.strictEqual(cls('Reduced Quote.pdf', '3. Quotes \\ 2026 - Review'), 'reduced');
  assert.strictEqual(cls('Photo.pdf', 'Stanlib Invest - 7766554 \\ 2026 - Review'), null, 'a document that says nothing stays unclassified (listed, not ticked)');
  assert.strictEqual(cls('Statement.pdf', 'Stanlib Invest - 7766554 \\ Policy Schedules \\ 2026'), 'investments', 'a statement in the Policy Schedules year folder is still a statement');
  assert.strictEqual(cls('Policy Schedule 2026.pdf', 'Acceptance Letter & Policy Schedules'), 'policies', 'a folder with schedule in its name is not a review folder');
  assert.strictEqual(cls('Statement 31.12.25.pdf', 'Coronation RA - 458899 \\ Annual Review Statements'), 'investments', 'nor is one with statement or valuation in its name');
  const via = (n, d) => { const c = docs.classify(n, d); return !!(c && c.viaReview); };
  assert.strictEqual(via('RA Review Valuation 2026.pdf', 'Stanlib Invest - 7766554 \\ 2026 - Review'), true, 'a comparative quote ONLY because of its Review folder says so (the list leaves it unticked)');
  assert.strictEqual(via('Coronation RA Quote 2026.pdf', 'Coronation RA - 458899 \\ Comparative Quotes \\ 2026 - Review'), false, 'a quote by its Comparative Quotes folder is a quote, ticked');
  assert.strictEqual(via('FNA Quote.pdf', '3. Quotes \\ 2026 - Review'), false);
});

/* ---------- 4. the wiring ---------- */
test('the page is 1.6, no key is added, the year rule covers every kind of quote, a file is told apart by its folder, and the review documents reach the list', () => {
  assert.ok(/^(1\.[6789]|2\.[012])$/.test(schema.pageVersion), 'page 1.6, or 1.7 or 1.8 which came after it'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.5'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fu = app('js/folders-ui.js'), fo = app('js/folders.js'), html = app('overview.html');
  assert.ok(/QKIND = \{ fna: 1, shortfallQuote: 1, reduced: 1, comparative: 1, proposed: 1, cmp: 1, goals: 1, svFna: 1, svShortfall: 1, svReduced: 1, svIncrease: 1, svReduction: 1 \}/.test(ui), 'every kind of quote');
  assert.ok(/var ruled = function \(x\)/.test(fo) && /x\.kind === 'comparative' \|\| byFolder\[g\]/.test(fo), 'a kind is ruled by year when one of its files sits in a year folder (comparative quotes always)');
  assert.ok(/the guide of an older quote: not ticked/.test(fo) && /if \(x\.kind === 'cmp'\) return;/.test(fo), 'a pay-out guide only follows its quote: it is not ruled by year');
  assert.ok(/c\.viaReview/.test(ui) && /in a Review or Servicing folder: not ticked, tick it if it is a quote/.test(ui), 'a document that is a quote only because of its Review folder is not ticked');
  assert.ok(/older: older/.test(ui) && !/older = new Set/.test(ui), 'the list says why a file is not ticked');
  assert.ok(/function uniqueFiles/.test(ui) && /dir \+ ' \\\\ '/.test(ui) && !/grp \? dir/.test(ui), 'every file is told apart by its folder');
  assert.ok(/\(g\.quotes \|\| \[\]\)\.forEach\(function \(f\) \{ flat\.push\(f\); \}\)/.test(fu), 'the review documents of a policy folder reach the flat list, in no group');
  assert.ok(/REVIEW_DIR\.test\(low\) && !\/schedule\|statement\|valuation\/\.test\(low\)/.test(fo) && /quotes: \[\]/.test(fo), 'the walk reads a Review folder by its folder');
  ['ov-schema', 'ov-docs', 'ov-ui', 'folders', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=(?:20261124[tuvw]|20261125[a-z])').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=(?:20261124[tuvw]|20261125[a-z])/.test(app(f)) && /folders-ui\.js\?v=(?:20261124[tuvw]|20261125[a-z])/.test(app(f)), f));
  assert.ok(!/policyFolders|policyScan|latestOverview|g\.quotes/.test(app('js/ov-store.js') + app('js/ov-calc.js')), 'the saved file and its sums are untouched');
});

/* ---------- 5. the View button: one name in two year folders ---------- */
test('View: when one file name is in two year folders the newest year\'s is the one the item was loaded from (the saved file holds the name only)', () => {
  const V = require('../app/js/ov-view.js'), pool = [{ name: 'FNA Quote.pdf', rel: ['3. Quotes', '2024 - Review'] }, { name: 'FNA Quote.pdf', rel: ['3. Quotes', '2026 - Review'] }, { name: 'Other.pdf', rel: ['3. Quotes'] }];
  const r = V.pick({ name: 'FNA Quote.pdf', role: 'quote', insurer: '', policyNo: '' }, pool, {});
  assert.ok(r.file && r.file.rel.join('/') === '3. Quotes/2026 - Review', 'the 2026 - Review file: ' + JSON.stringify(r.file && r.file.rel));
  const r2 = V.pick({ name: 'FNA Quote.pdf', role: 'quote', insurer: '', policyNo: '' }, pool.slice().reverse(), {});
  assert.ok(r2.file && r2.file.rel.join('/') === '3. Quotes/2026 - Review', 'whatever the order of the listing');
  const r3 = V.pick({ name: 'Policy Schedule.pdf', role: 'schedule', insurer: '', policyNo: '811234567' }, [{ name: 'Policy Schedule.pdf', rel: ['BR Personal Covers - 811234567', 'Policy Schedules', '2025'] }, { name: 'Policy Schedule.pdf', rel: ['BR Personal Covers - 811234567', 'Policy Schedules', '2026'] }], {});
  assert.ok(r3.file && /2026$/.test(r3.file.rel.join('/')), 'two years of one policy: the newest');
});
