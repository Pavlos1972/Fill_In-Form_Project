/* Client Overview Studio 1.5 (25 November, Paul's folder change relayed by the Fix Skills chat at 11:06): "Load from client folder" finds EVERY live policy folder of the client, reads the insurer, product, policy number and status out of the folder's name,
   walks each live folder for its schedules and statements (Policy Schedules, year folders, Servicing's schedules), picks the NEWEST one per policy (the owner's manual never, a tie is said), compares the three sources (policy folders, the Fact Find, the latest
   overview) and lists ONE group per policy folder. Without a screen here: the name parser, the walk (read only, within a limit), the newest rule, the joining of 6. Policy Schedules, the comparison, the quotes-folder classification, two files with one name in
   two policy folders. The pick list and the load are looked at in tests/browser/t-overview-round150.js. Invented client only ("Test, Dora"): none of the names or numbers below is a real client's. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const store = require('../app/js/ov-store.js');
const docs = require('../app/js/ov-docs.js');
const V = require('../app/js/ov-view.js');
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

/* ---------- a pretend folder tree that counts every call that could change something ---------- */
const calls = { write: 0, listed: {} };
class FileH { constructor(name) { this.kind = 'file'; this.name = name; } async createWritable() { calls.write++; throw new Error('read only'); } }
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  get path() { return (this.parent ? this.parent.path + '/' : '') + this.name; }
  async *entries() { calls.listed[this.path] = (calls.listed[this.path] || 0) + 1; for (const [n, h] of this.kids) yield [n, h]; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n, d)), d.kids.get(n)); return d; }
  file(...n) { n.forEach(x => this.kids.set(x, new FileH(x))); return this; }
  async getDirectoryHandle() { calls.write++; throw new Error('read only'); }
  async getFileHandle() { calls.write++; throw new Error('read only'); }
  async removeEntry() { calls.write++; throw new Error('read only'); }
}
const client = d => ({ rootKey: 'A', parts: ['Test, Dora'], handle: d });
function tree() {
  const c = new Dir('Test, Dora');
  c.add('1. Overview', '2026').file('WR Overview - 10.03.26 - Test, Dora.json', 'WR Overview - 10.03.26 - Test, Dora.pdf'); c.add('1. Overview', '2025').file('WR Overview - 11.03.25 - Test, Dora.json');
  c.add('2. Fact Find'); c.add('3. Quotes'); c.add('7. All in one Compliance').file('Should Not Be Looked Into.pdf');
  c.add('5. Astute', '2026').file('Astute Report - 20.11.26.pdf');
  const ps = c.add('6. Policy Schedules'); ps.file('Loose Schedule Z-1.pdf'); ps.add('2025').file('BR Policy Summary 811234567 - 2025.pdf'); ps.add('2026').file('BR Policy Summary 811234567 - 2026.pdf', 'Lifestyle Plan 9988776.pdf');
  const br = c.add('BR Personal Covers - 811234567');
  br.add('Policy Schedules', '2025').file('Policy Schedule.pdf'); br.add('Policy Schedules', '2026').file('Policy Schedule.pdf', 'Owner\'s Manual.pdf'); br.file('Acceptance Letter.pdf');
  br.add('Applications').file('BR Application.pdf'); br.add('Claims').file('Claim 1.pdf'); br.add('Comparative Quotes').file('Old Mutual Quote 2024.pdf'); br.add('Medical Reports').file('Report.pdf'); br.add('Notes & Emails').file('Note.pdf');
  const n1 = c.add('Coronation RA - 458899'); n1.add('2025').file('Statement 31.12.25.pdf'); n1.add('2026').file('Statement 31.03.26.pdf'); n1.add('Comparative Quotes').file('2024 Investment.pdf');
  const mom = c.add('Mom Endowment - 03112233445 - (Linked to PK)'); mom.add('Policy Schedules', '2026').file('Mom Schedule.pdf');
  c.add('San Invest - 0556677 - (Transfered)').add('Policy Schedules').file('San Schedule.pdf');
  c.add('OM Optimal RA - 99001122 - (Cancelled)').file('OM Schedule.pdf');
  c.add('Old Mutual TFSA - 5544332').add('Applications').file('TFSA Application.pdf');
  const disc = c.add('Discovery Life - 8877665 - (Paid up)'); disc.file('Cover Summary 12.05.26.pdf', 'Cover Letter.pdf'); disc.add('Servicing', '2026').file('Schedule 01.02.26.pdf', 'Letter.pdf'); disc.add('Servicing').file('Servicing Schedule 2025.pdf');
  c.add('BR Legacy Plan - 3322110').file('Owner\'s Manual.pdf');
  c.add('View Family').file('Photo.pdf');
  return c;
}
const names = list => list.map(x => x.name);

/* ---------- 1. the name ---------- */
test('a policy folder\'s name says the insurer, product, number and status: Transferred, Transfered, Cancelled and Lapsed are not live, Linked to PK is live', () => {
  const P = F.parsePolicyFolder, pick = n => { const p = P(n); return [p.insurer, p.product, p.number, p.status, p.linked, p.kind]; };
  assert.deepStrictEqual(pick('BR Personal Covers - 811234567'), ['brightrock', 'Personal Covers', '811234567', 'live', false, 'policies']);
  assert.deepStrictEqual(pick('NinetyOne Invest - 449900'), ['ninety one', 'Invest', '449900', 'live', false, 'investments']); assert.deepStrictEqual(pick('Coronation RA - 458899'), ['coronation', 'RA', '458899', 'live', false, 'investments']);
  assert.deepStrictEqual(pick('Mom Endowment - 03112233445 - (Linked to PK)'), ['momentum', 'Endowment', '03112233445', 'live', true, 'investments'], 'Linked to PK is live, and says so');
  assert.strictEqual(P('San Invest - 0556677 - (Transfered)').status, 'transferred'); assert.strictEqual(P('San Invest - 0556677 - (Transferred)').status, 'transferred');
  assert.strictEqual(P('OM Optimal RA - 99001122 - (Cancelled)').status, 'cancelled'); assert.strictEqual(P('OM Optimal RA - 99001122 - (Canceled)').status, 'cancelled');
  assert.strictEqual(P('Allan Gray Tax Free - 7788990 - (Lapsed)').status, 'lapsed'); assert.strictEqual(P('Mom Life - 123456 - Transferred').status, 'transferred', 'also without brackets');
  assert.ok(!/transfer/i.test(P('Mom Life - 123456 - Transferred').product), 'the status word is not part of the product');
  assert.strictEqual(P('BR Personal Covers - 811234567').status, 'live', 'no status is live');
  const odd = P('Disc Life Plan - 99887766 - (Paid up)'); assert.deepStrictEqual([odd.status, odd.unknownStatus, odd.insurer, odd.kind], ['live', 'Paid up', 'discovery', 'policies'], 'an unknown word in brackets is shown and the policy is treated as live');
  assert.strictEqual(P('BR Personal Covers - 811234567 - (2024)').unknownStatus, '', 'a year in brackets is not a status');
  const deal = P('Test, Dora - (BR - Personal - R 2,507.64 p.m.)'); assert.deepStrictEqual([deal.dealStyle, deal.insurer, deal.product, deal.number, deal.kind], [true, 'brightrock', 'Personal', '', 'policies'], 'the older shape: the bracket holds the policy and an amount is not a number');
  assert.strictEqual(P('Test, Dora - (Risk Covers)').kind, 'policies');
  assert.deepStrictEqual([P('Old Mutual Optimal RA - 12345678').insurer, P('OM Living Annuity - 1234567').kind, P('Momentum Wealth - 55555').kind], ['old mutual', 'investments', ''], 'a product the page cannot tell is left blank, for the adviser');
  assert.deepStrictEqual([P('Capital Legacy Plan - 6677889').special, P('Sanlam Provident - 9911223').special, P('OM Preservation Fund - 1122334').special, P('BR Personal Covers - 811234567').special, P('Mom Endowment - 03112233445').special], ['legacy', 'group', 'group', '', ''], 'legacy plans and provident, pension and preservation funds are kept in other blocks');
  assert.strictEqual(P('View Family').policy, false, 'a folder with no insurer, product or number is not a policy folder'); assert.strictEqual(P('Momentum Wealth - 55555').policy, true);
  assert.strictEqual(P('Momentum Wealth - 55555').insurer, 'momentum', 'Momentum is Momentum, not Mom');
  assert.strictEqual(F.canonInsurer('Old Mutual Life Assurance'), 'old mutual'); assert.strictEqual(F.canonInsurer('Ninety One'), 'ninety one'); assert.strictEqual(F.canonInsurer('Some Unknown House'), '');
});

/* ---------- 2. newest ---------- */
test('the newest schedule is told by the date in its name, else its year folder; a tie is said and nothing is picked; the owner\'s manual is never one', () => {
  const D = F.dateKey;
  assert.deepStrictEqual([D('Schedule 10.03.26.pdf', []).exact, D('Schedule 10-03-2026.pdf', []).exact, D('Schedule 2026-03-10.pdf', []).exact, D('Schedule 20260310.pdf', []).exact, D('Schedule 10 Mar 2026.pdf', []).exact], Array(5).fill(20260310));
  assert.deepStrictEqual([D('Cover Summary.pdf', ['x', '2026']).sort, D('Cover Summary.pdf', ['x', '2025', 'sub']).sort], [20260000, 20250000], 'the year folder is the date when the name has none');
  assert.strictEqual(D('BR 811234567.pdf', []).exact, 0, 'a policy number is not a date');
  const mk = (name, rel, role) => ({ name, rel, role: role || 'schedule', key: D(name, rel) });
  const a = mk('Policy Schedule.pdf', ['P', 'Policy Schedules', '2025']), b = mk('Policy Schedule.pdf', ['P', 'Policy Schedules', '2026']), m = mk('Owner\'s Manual.pdf', ['P', 'Policy Schedules', '2026'], 'manual');
  assert.strictEqual(F.newestOf([a, b, m]).file, b, 'the 2026 one, not the 2025 one, and not the manual');
  assert.strictEqual(F.newestOf([mk('Statement 31.12.25.pdf', ['P']), mk('Statement 31.03.26.pdf', ['P'])]).file.name, 'Statement 31.03.26.pdf', 'a date in the name beats the older date');
  const x = mk('Schedule.pdf', ['P', '2026']), y = mk('Other Schedule.pdf', ['P', '2026']), t = F.newestOf([x, y]);
  assert.deepStrictEqual([t.file, t.tie, t.tied.length], [null, true, 2], 'two files as recent as each other: none is picked, and it is said');
  assert.strictEqual(F.newestOf([mk('Letter.pdf', ['P', '2026']), mk('Cover Summary.pdf', ['P', '2026'])]).file.name, 'Cover Summary.pdf', 'on the same date a summary, schedule or statement wins');
  assert.deepStrictEqual(F.newestOf([m]).file, null, 'only the manual: nothing is picked'); assert.deepStrictEqual(F.newestOf([]).file, null);
  assert.strictEqual(F.newestOf([mk('Cover Letter.pdf', ['P', '2026']), mk('Policy Schedule.pdf', ['P', 'Policy Schedules', '2025'])]).file.name, 'Policy Schedule.pdf', 'a file whose name says schedule is chosen before one that says nothing: a letter of 2026 is not a newer schedule than the schedule of 2025');
  assert.strictEqual(F.newestOf([mk('Cover Letter.pdf', ['P', '2025']), mk('Notice.pdf', ['P', '2026'])]).file.name, 'Notice.pdf', 'with no schedule-like name at all the newest is taken');
  assert.ok(F.isManual('Owner\'s Manual.pdf') && F.isManual('BR Policy Document.pdf') && !F.isManual('BR Policy Schedule and Terms Summary.pdf') && !F.isManual('Cover Summary.pdf'));
});

/* ---------- 3. the walk ---------- */
test('the policy folders are found, the live ones walked for schedules and statements, nothing else is entered, and nothing is written', async () => {
  const c = tree(); calls.write = 0; calls.listed = {};
  const pf = await F.policyFolders(client(c));
  assert.deepStrictEqual(pf.live.map(x => x.name).sort(), ['BR Legacy Plan - 3322110', 'BR Personal Covers - 811234567', 'Coronation RA - 458899', 'Discovery Life - 8877665 - (Paid up)', 'Mom Endowment - 03112233445 - (Linked to PK)', 'Old Mutual TFSA - 5544332']);
  assert.deepStrictEqual(pf.notLive.map(x => x.name).sort(), ['OM Optimal RA - 99001122 - (Cancelled)', 'San Invest - 0556677 - (Transfered)']);
  assert.deepStrictEqual(pf.other.map(x => x.name), ['View Family'], 'a folder that is not a policy folder is named, not looked into');
  const scan = await F.policyScan(client(c)), g = n => scan.groups.filter(x => x.name === n)[0], fnames = x => x.files.map(f => f.rel.slice(1).concat([f.name]).join('/')).sort();
  assert.deepStrictEqual(fnames(g('BR Personal Covers - 811234567')), ['Policy Schedules/2025/Policy Schedule.pdf', 'Policy Schedules/2026/Owner\'s Manual.pdf', 'Policy Schedules/2026/Policy Schedule.pdf'], 'two files of ONE name in two year folders, the manual too; Acceptance Letter, Applications, Claims, Comparative Quotes, Medical Reports and Notes & Emails are not read');
  assert.deepStrictEqual(fnames(g('Coronation RA - 458899')), ['2025/Statement 31.12.25.pdf', '2026/Statement 31.03.26.pdf'], 'year folders directly in the policy folder; its Comparative Quotes folder is not a statement');
  assert.deepStrictEqual(fnames(g('Mom Endowment - 03112233445 - (Linked to PK)')), ['Policy Schedules/2026/Mom Schedule.pdf'], 'Linked to PK is live and read');
  assert.deepStrictEqual(fnames(g('Discovery Life - 8877665 - (Paid up)')), ['Cover Summary 12.05.26.pdf', 'Servicing/2026/Schedule 01.02.26.pdf', 'Servicing/Servicing Schedule 2025.pdf'], 'loose files only when their names say schedule or summary, Servicing only its schedules');
  assert.deepStrictEqual(fnames(g('Old Mutual TFSA - 5544332')), [], 'only an Applications folder: nothing found');
  assert.strictEqual(g('BR Legacy Plan - 3322110').files[0].role, 'manual');
  const dirs = Object.keys(calls.listed);
  assert.ok(!dirs.some(d => /San Invest|OM Optimal/.test(d)), 'a policy that is not live is never looked into'); assert.ok(!dirs.some(d => /Applications|Claims|Medical Reports|Notes & Emails|Comparative Quotes|7\. All in one/.test(d)), 'the ignored folders are never entered');
  assert.strictEqual(calls.write, 0, 'nothing is created, written or removed');
  assert.strictEqual(scan.partial, false); assert.deepStrictEqual(scan.unfinished, []); assert.ok(scan.groups.every(x => x.done));
});

test('the walk stops at its limit with what it found, and names the folders it did not finish', async () => {
  const c = tree(); let mixed = false;
  for (let cap = 3; cap <= 40; cap++) {
    const sink = {}; await F.policyScan(client(c), { cap, sink });
    if (sink.partial) {
      assert.ok(sink.unfinished.length >= 1 && sink.unfinished.every(n => sink.groups.some(g => g.name === n)), 'cap ' + cap + ': the folders not finished are named');
      assert.strictEqual(sink.groups.length, 6, 'cap ' + cap + ': every live folder is still named'); if (sink.groups.some(g => g.done)) mixed = true;
    } else assert.deepStrictEqual(sink.unfinished, [], 'cap ' + cap + ': nothing left unfinished');
  }
  assert.ok(mixed, 'with some limit the first folders are read and the rest are named as not reached');
  const full = {}; await F.policyScan(client(c), { cap: 5000, sink: full }); assert.strictEqual(full.partial, false);
  const t2 = {}; await F.policyScan(client(c), { ms: -1, sink: t2 }); assert.strictEqual(t2.partial, true, 'a time limit already past: nothing is read, and it is said'); assert.strictEqual(t2.groups.length, 6);
});

test('a folder that never answers costs its own slice of the time, not the folders after it', async () => {
  const c = tree(), hung = c.kids.get('Mom Endowment - 03112233445 - (Linked to PK)');
  hung.entries = function () { return { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } }; };
  const sink = {}, t0 = Date.now(); await F.policyScan(client(c), { perFolder: 80, ms: 20000, sink });
  assert.ok(Date.now() - t0 < 2000, 'the scan did not wait for ever: ' + (Date.now() - t0) + ' ms');
  assert.deepStrictEqual(sink.unfinished, ['Mom Endowment - 03112233445 - (Linked to PK)'], 'only the folder that did not answer is unfinished'); assert.strictEqual(sink.partial, true);
  const done = sink.groups.filter(g => g.done).map(g => g.name).sort(); assert.deepStrictEqual(done, ['BR Legacy Plan - 3322110', 'BR Personal Covers - 811234567', 'Coronation RA - 458899', 'Discovery Life - 8877665 - (Paid up)', 'Old Mutual TFSA - 5544332'], 'the folders before and after it were read');
  assert.ok(sink.groups.filter(g => g.name === 'BR Personal Covers - 811234567')[0].files.length === 3);
});

/* ---------- 4. 6. Policy Schedules and its year folders ---------- */
test('the files of 6. Policy Schedules include its year folders; those that carry a policy\'s number join that policy\'s group, the others stay among the other documents', async () => {
  const c = tree(), docsList = await F.clientDocuments(client(c));
  const dn = docsList.map(f => f.rel.concat([f.name]).join('/'));
  assert.ok(dn.includes('6. Policy Schedules/Loose Schedule Z-1.pdf') && dn.includes('6. Policy Schedules/2025/BR Policy Summary 811234567 - 2025.pdf') && dn.includes('6. Policy Schedules/2026/BR Policy Summary 811234567 - 2026.pdf') && dn.includes('6. Policy Schedules/2026/Lifestyle Plan 9988776.pdf'), 'the loose files and the year folders: ' + dn.join(' | '));
  assert.ok(dn.includes('5. Astute/2026/Astute Report - 20.11.26.pdf'), 'the newest Astute report is still listed'); assert.ok(!dn.some(x => /7\. All in one|Policy Schedules\/Policy Schedule/.test(x)));
  const scan = await F.policyScan(client(c)); F.joinSchedules(docsList, scan.groups);
  const br = scan.groups.filter(x => x.name === 'BR Personal Covers - 811234567')[0], joined = br.files.filter(f => f.from === 'Policy Schedules').map(f => f.name).sort();
  assert.deepStrictEqual(joined, ['BR Policy Summary 811234567 - 2025.pdf', 'BR Policy Summary 811234567 - 2026.pdf'], 'both years of the number-bearing file joined the BrightRock group');
  const nb = F.newestOf(br.files); assert.deepStrictEqual([nb.tie, nb.tied.map(f => f.name).sort()], [true, ['BR Policy Summary 811234567 - 2026.pdf', 'Policy Schedule.pdf']], 'two different files of the year 2026 are as recent as each other: said, not guessed');
  const twin = F.newestOf([{ name: 'Cover Summary.pdf', rel: ['P', '2026'] }, { name: 'cover summary.pdf', rel: ['6. Policy Schedules', '2026'], from: 'Policy Schedules' }]);
  assert.deepStrictEqual([twin.tie, twin.file.from], [false, undefined], 'the same file name kept in two places is ONE document, not a tie: the copy in the policy folder is taken');
  const left = docsList.filter(f => f.group == null && /Policy Schedules/.test(f.rel[0])).map(f => f.name).sort(); assert.deepStrictEqual(left, ['Lifestyle Plan 9988776.pdf', 'Loose Schedule Z-1.pdf'], 'a number no folder has stays where it is');
});

/* ---------- 5. several of one: per-policy newest among the other documents ---------- */
test('of several schedules or statements of ONE policy among the other documents only the newest is ticked; a tie ticks none', () => {
  const mk = (name, rel) => ({ name, rel });
  const a = mk('Lifestyle Plan 9988776 - 2025.pdf', ['6. Policy Schedules', '2025']), b = mk('Lifestyle Plan 9988776 - 2026.pdf', ['6. Policy Schedules', '2026']), c = mk('Other Plan 1122334.pdf', ['6. Policy Schedules']);
  const keyOf = f => { const c = docs.classify(f.name, f.rel.join(' \\ ')); return c && c.block === 'policies' ? c.block + ':' + F.numKey(c.number) : null; };
  const r = F.keyedNewest([a, b, c, mk('Astute Report.pdf', ['5. Astute'])], keyOf);
  assert.deepStrictEqual([r.tick.get(a), r.tick.get(b), r.tick.get(c), r.tick.size, r.tied.length], [false, true, true, 3, 0]);
  const t = F.keyedNewest([mk('Plan Schedule 9988776 a.pdf', ['S', '2026']), mk('Plan Schedule 9988776 b.pdf', ['S', '2026'])], keyOf); assert.deepStrictEqual([[...t.tick.values()], t.tied.length], [[false, false], 1]);
});

/* ---------- 5b. the same client in two connected folders ---------- */
test('the same client in New Business and in Client Files: a policy folder of the same name is listed once, with its files, and no group is left empty', async () => {
  const a = tree(), b = new Dir('Test, Dora'); b.add('BR Personal Covers - 811234567', 'Policy Schedules', '2026').file('Policy Schedule.pdf'); b.add('Mom Endowment - 03112233445 - (Linked to PK)', '2026').file('Mom Statement.pdf'); b.add('Zed Invest - 1122334').add('2026').file('Zed Statement.pdf');
  const part = async c => { const sink = {}, sc = await F.policyScan(client(c), { sink }), fs = await F.clientDocuments(client(c)); F.joinSchedules(fs, sc.groups); const flat = fs.slice(); sc.groups.forEach((g, i) => g.files.forEach(f => { if (f.group == null) { f.group = i; flat.push(f); } })); return { files: flat, groups: sc.groups, notLive: sc.notLive, other: sc.other, partial: sc.partial, unfinished: sc.unfinished, overview: null }; };
  const m = F.mergeClientLists([await part(a), await part(b)]);
  assert.deepStrictEqual(m.groups.map(g => g.name).sort(), ['BR Legacy Plan - 3322110', 'BR Personal Covers - 811234567', 'Coronation RA - 458899', 'Discovery Life - 8877665 - (Paid up)', 'Mom Endowment - 03112233445 - (Linked to PK)', 'Old Mutual TFSA - 5544332', 'Zed Invest - 1122334'], 'each folder once; the one only the second place has is added');
  m.groups.forEach((g, i) => g.files.forEach(f => assert.strictEqual(m.files.indexOf(f) >= 0 && f.group, i, g.name + ': ' + f.name + ' is in the list and its group index points at its own group')));
  assert.ok(m.files.every(f => f.group == null || (f.group >= 0 && f.group < m.groups.length)), 'no file points at a group that is not there');
  const br = m.groups.filter(g => g.name.indexOf('BR Personal') === 0)[0]; assert.strictEqual(br.files.filter(f => f.name === 'Policy Schedule.pdf').length, 2, 'the first place\'s files (2025 and 2026), not doubled by the second');
  assert.ok(m.groups.filter(g => g.name.indexOf('Zed') === 0)[0].files.length === 1);
  assert.deepStrictEqual(m.notLive.map(x => x.name).sort(), ['OM Optimal RA - 99001122 - (Cancelled)', 'San Invest - 0556677 - (Transfered)']); assert.deepStrictEqual(m.other, ['View Family']);
});

/* ---------- 6. the three sources ---------- */
test('the comparison: matched by number, matched by insurer, the page does not guess between several, a folder with no Fact Find item, a Fact Find item with no folder, a not-live folder', () => {
  const it = (kind, who, product, no, extra) => Object.assign({ kind, who, product: product || '', no: no || '' }, extra || {});
  const G = n => ({ name: n, p: F.parsePolicyFolder(n) });
  const live = [G('BR Personal Covers - 811234567'), G('Coronation RA - 458899'), G('Mom Endowment - 03112233445 - (Linked to PK)'), G('OM Optimal RA - 11111111'), G('OM Tax Free - 22222222'), G('Disc Life - 33333333')];
  const dead = [G('San Invest - 0556677 - (Transfered)')];
  const ff = { read: true, items: [it('policies', 'BrightRock'), it('investments', 'Momentum', 'Retirement annuity'), it('investments', 'Old Mutual', 'RA'), it('investments', 'Old Mutual', 'Tax-free investment'), it('investments', 'Sanlam', 'Retirement annuity'), it('investments', 'Allan Gray', 'Unit trust'), it('policies', 'Discovery', '', '33333333')] };
  const prior = { items: [it('policies', 'BrightRock', 'Lifestyle', '811234567'), it('investments', 'Sygnia', 'RA')] };
  const r = F.comparePolicies(live, dead, ff, prior), hows = r.live.map(x => x.ff);
  assert.deepStrictEqual(hows, ['name', 'none', 'name', 'maybe', 'maybe', 'number'], 'BrightRock by insurer; Coronation is in no Fact Find row; Momentum by insurer; two Old Mutual items and two Old Mutual folders are NOT paired by guesswork; Discovery by its number');
  assert.deepStrictEqual([r.live[3].n, r.live[4].n], [2, 2]);
  assert.strictEqual(r.live[0].prior, 'number', 'the last overview matched the BrightRock policy by its number'); assert.strictEqual(r.live[1].prior, '', 'Coronation is not in the last overview');
  assert.deepStrictEqual(r.ffOnly.map(x => x.who), ['Allan Gray'], 'in the Fact Find, no folder at all');
  assert.deepStrictEqual(r.ffNotLive.map(x => [x.item.who, x.folder.name]), [['Sanlam', 'San Invest - 0556677 - (Transfered)']], 'the Fact Find lists a policy whose only folder says Transferred: shown, not hidden');
  assert.deepStrictEqual(r.priorOnly.map(x => x.who), ['Sygnia'], 'in the last overview only');
  const unread = F.comparePolicies(live, dead, { read: false, items: [] }, null); assert.ok(unread.live.every(x => x.ff === 'unknown') && unread.ffOnly.length === 0, 'with no Fact Find read into this overview nothing is claimed about it');
  const withBoth = { read: true, items: [it('policies', 'Sanlam', 'Life'), it('investments', 'Sanlam', 'RA'), it('group', 'Sanlam', 'provident'), it('legacy', 'Capital Legacy', 'legacy')] };
  const leg = F.comparePolicies([G('Capital Legacy Plan - 44444444'), G('Sanlam Provident - 5566778')], [], withBoth, null);
  assert.deepStrictEqual(leg.live.map(x => x.ff), ['name', 'name'], 'a legacy plan is compared with the legacy plan of block 11, a provident fund with the group block\'s funds (not with Sanlam\'s policy or RA)'); assert.deepStrictEqual(leg.ffOnly.map(x => x.kind).sort(), ['investments', 'policies'], 'the Sanlam policy and RA have no folder, which is true');
  const noLeg = F.comparePolicies([G('Capital Legacy Plan - 44444444')], [], { read: true, items: [it('policies', 'Sanlam', 'Life')] }, null); assert.deepStrictEqual([noLeg.live[0].ff], ['none'], 'no legacy plan in the Fact Find: the folder says so');
  const noGrp = F.comparePolicies([G('Alex Forbes Provident - 7788991')], [], { read: true, items: [it('group', 'Alex Forbes', 'provident')] }, null); assert.deepStrictEqual([noGrp.live[0].ff], ['name'], 'Alex Forbes is an insurer the page knows');
  const nums = F.comparePolicies([G('Mom Endowment - 03112233445')], [], { read: true, items: [it('investments', 'Momentum', 'RA', '3112233445'), it('investments', 'Momentum', 'Tax Free', '')] }, null); assert.deepStrictEqual([nums.live[0].ff], ['number'], 'a number matches whatever the leading zeros and spaces');
});

test('the items an overview offers the comparison: blocks 1 and 6, the provident funds of the group block and the legacy plan of block 11 (once there is one); a removed one never', () => {
  const s = store.blank(); const B = s.blocks;
  B.policies.items.push({ id: 'p1', insurer: 'BrightRock', product: 'Lifestyle', policyNo: '811234567', removed: false }, { id: 'p2', insurer: 'Gone', removed: true });
  B.investments.items.push({ id: 'i1', provider: 'Momentum', product: 'RA', policyNo: '', removed: false });
  B.group.items.push({ id: 'g1', kind: 'risk', provider: 'Risk Co', removed: false }, { id: 'g2', kind: 'provident', provider: 'Test Provident', removed: false });
  const leg = B.other.items.filter(x => x.key === 'legacy')[0]; if (leg) { leg.company = 'Capital Legacy'; leg.wr = true; }
  const items = docs.comparableItems(s);
  assert.deepStrictEqual(items.map(x => [x.kind, x.who]), [['policies', 'BrightRock'], ['investments', 'Momentum'], ['group', 'Test Provident'], ...(leg ? [['legacy', 'Capital Legacy']] : [])], 'block 1, block 6, the provident and pension funds of the group block, and the legacy plan of block 11 once the Fact Find says there is one; never a risk group item');
  assert.deepStrictEqual(docs.comparableItems(null), []);
});

test('the review folders ("2026 - Review") inside Comparative Quotes and inside a numbered Quotes folder are listed', async () => {
  const c = new Dir('Doe, Dora'); c.add('3. Quotes').file('Loose Quote 01.01.24.pdf'); c.add('3. Quotes', '2026 - Review').file('BR FNA 100000001 - 19.11.26.pdf'); c.add('3. Quotes', '2024 - Review').file('BR FNA 100000000 - 19.11.24.pdf');
  c.add('Coronation RA - 458899', 'Comparative Quotes', '2026 - Review').file('Discovery Quote 08.03.26.pdf'); c.add('Coronation RA - 458899', 'Comparative Quotes', '2024 - Review').file('Old Mutual Quote 12.03.24.pdf'); c.add('Coronation RA - 458899', 'Comparative Quotes').file('Loose Comparative 2025.pdf');
  const d = (await F.clientDocuments(client(c))).map(f => f.rel.concat([f.name]).join('/')).sort();
  assert.deepStrictEqual(d, ['3. Quotes/2024 - Review/BR FNA 100000000 - 19.11.24.pdf', '3. Quotes/2026 - Review/BR FNA 100000001 - 19.11.26.pdf', '3. Quotes/Loose Quote 01.01.24.pdf', 'Coronation RA - 458899/Comparative Quotes/2024 - Review/Old Mutual Quote 12.03.24.pdf', 'Coronation RA - 458899/Comparative Quotes/2026 - Review/Discovery Quote 08.03.26.pdf', 'Coronation RA - 458899/Comparative Quotes/Loose Comparative 2025.pdf']);
});

/* ---------- 6b. the shapes Paul's real folders have (relayed 25 November, structure only; invented numbers and names here) ---------- */
test('a file that names ANOTHER insurer is not this policy\'s document; forms, letters and change-of-details are never the schedule; PS, IS and IRR are schedules; Acceptance Letter & Policy Schedules is entered', async () => {
  const c = new Dir('Doe, Dora');
  const br = c.add('BR Personal Covers - 811234567');
  br.add('Policy Schedules', '2024').file('Lib PS - 0556677 - 01.02.24 - (D Doe).pdf', 'Doe, Dora - Liberty - 48876543210.pdf', 'Momentum Group Life Statement - 03.04.24 (Doe, Dora).pdf', 'Dora Doe, Alex Forbes Pension Statement.pdf');
  br.add('Acceptance Letter', '2026').file('Dora Doe\u2019s Owner\u2019s Manual \u2013 Policy number 811234567.pdf');
  br.add('Servicing', '2025', 'Acceptance Letter & Policy Schedules').file('Dora Doe\u2019s Owner\u2019s Manual \u2013 Policy number 811234567 -PDF.pdf');
  const g1 = (await F.policyScan(client(c))).groups[0], names = g1.files.map(f => f.name);
  assert.deepStrictEqual(g1.foreign.sort(), ['Doe, Dora - Liberty - 48876543210.pdf', 'Dora Doe, Alex Forbes Pension Statement.pdf', 'Lib PS - 0556677 - 01.02.24 - (D Doe).pdf', 'Momentum Group Life Statement - 03.04.24 (Doe, Dora).pdf'], 'four other insurers\' files left out of the BrightRock folder and named');
  assert.deepStrictEqual(names, ['Dora Doe\u2019s Owner\u2019s Manual \u2013 Policy number 811234567 -PDF.pdf'], 'only the owner\'s manual of Servicing / 2025 / Acceptance Letter & Policy Schedules (a folder with "schedules" in its name is entered); Acceptance Letter / 2026 is not');
  assert.ok(g1.files.every(f => f.role === 'manual') && F.newestOf(g1.files).file === null, 'BrightRock has only the owner\'s manual: no schedule, and it is a last resort');
  const st = c.add('Stanlib Invest - 2755001'); st.add('2024').file('Stanlib Invest PS - 2755001 - 05.03.24 - (D Doe).pdf', 'Stanlib UT PS - 2755001 - 06.03.24 - (D Doe).pdf'); st.add('2026').file('ChangeofdetailsUT (4) - Dora Doe - 2755001 - completed.pdf', 'ChangeofdetailsUT (4) - Dora Doe - 2755001 - signed.pdf');
  const g2 = (await F.policyScan(client(c))).groups.filter(g => g.name.indexOf('Stanlib') === 0)[0];
  assert.deepStrictEqual(g2.files.map(f => f.name).sort(), ['Stanlib Invest PS - 2755001 - 05.03.24 - (D Doe).pdf', 'Stanlib UT PS - 2755001 - 06.03.24 - (D Doe).pdf'], 'a change of details form, completed or signed, is never a schedule');
  assert.strictEqual(F.newestOf(g2.files).file.name, 'Stanlib UT PS - 2755001 - 06.03.24 - (D Doe).pdf', 'the newest PS is told by the date in its name');
  const weak = F.newestOf([{ name: 'Notice.pdf', rel: ['P', '2026'] }, { name: 'Stanlib Invest PS - 2755001.pdf', rel: ['P', '2024'] }]); assert.strictEqual(weak.file.name, 'Stanlib Invest PS - 2755001.pdf', 'a PS of 2024 is chosen before a file of 2026 whose name says nothing');
  const lg = c.add('Capital Legacy - PN4455667'); lg.file('Capital Legacy - Plan Details Change Form 01.02.26 - signed.pdf');
  const g3 = (await F.policyScan(client(c))).groups.filter(g => g.name.indexOf('Capital Legacy') === 0)[0]; assert.deepStrictEqual([g3.files.length, g3.p.special], [0, 'legacy'], 'a legacy plan folder with only a change form: no schedule, and it says so');
  const nn = c.add('NinetyOne Invest - 449900'); nn.add('Policy Schedules', '2026').file('NinteyOne IS - 861234_INVRA - 12.03.26 - (D Doe).pdf'); nn.add('Servicing - 2025', '2025').file('NinetyOne RA Premium Increase - INVRA861234 - 20.02.25 - (D Doe).pdf');
  const g4 = (await F.policyScan(client(c))).groups.filter(g => g.name.indexOf('NinetyOne') === 0)[0];
  assert.deepStrictEqual(g4.files.map(f => f.name), ['NinteyOne IS - 861234_INVRA - 12.03.26 - (D Doe).pdf'], 'the investment statement (IS), though the provider is misspelt and its number is the investor\'s, not the folder\'s; a premium increase notice in Servicing is not a schedule');
  const tf = c.add('NinetyOne TF - 449911'); tf.add('Policy Schedules').file('NinteyOne IS - 861235_INVTF - 12.03.26 - (D Doe).pdf'); assert.strictEqual((await F.policyScan(client(c))).groups.filter(g => g.name.indexOf('NinetyOne TF') === 0)[0].files.length, 1, 'a statement loose in Policy Schedules (no year folder)');
});
test('the dates real file names carry: dd.mm.yy, dd.mm.yyyy, a month and year with an apostrophe, yyyy-mm-ddThhmmss; none is the year folder', () => {
  const D = F.dateKey;
  assert.strictEqual(D('Alex Forbes Provident satatement - Mar \'25 - (D Doe).pdf', []).exact, 20250300, 'Mar \'25');
  assert.strictEqual(D('D DOE_statement - 2025-12-15T155359.881.pdf', []).exact, 20251215, 'an ISO date and time');
  assert.strictEqual(D('Mom RA PS - 0311223 - 04.07.24 - (D Doe).pdf', []).exact, 20240704); assert.strictEqual(D('Stanlib UT PS - 2755001 - 06.03.2024.pdf', []).exact, 20240306);
  assert.strictEqual(D('IRR - 2755001 - DORA DOE.pdf', ['6. Policy Schedules', '2025']).sort, 20250000, 'none: the year folder');
  assert.ok(D('Statement Mar \'25.pdf', []).exact < D('Statement Apr \'25.pdf', []).exact && D('Statement Dec \'24.pdf', []).exact < D('Statement Jan \'25.pdf', []).exact, 'months sort');
  ['Mom RA PS - 0311223 - 04.07.24', 'NinteyOne IS - 861234_INVRA - 12.03.26', 'IRR - 2755001 - DORA DOE', 'Alex Forbes Provident satatement - Mar \'25', 'D DOE_statement - 2025-12-15T155359.881', 'Policy Schedule', 'Cover Summary'].forEach(n => assert.strictEqual(F.newestOf([{ name: n + '.pdf', rel: ['P'] }, { name: 'Notice.pdf', rel: ['P'] }]).file.name, n + '.pdf', n + ' is a schedule-like name'));
});

test('the real names of 6. Policy schedules: a provident statement (spelt satatement) is a group document, IRR and IS are investments, a PS is a policy schedule, the owner\'s manual is never a schedule', () => {
  const c = (n, d) => (docs.classify(n, d) || {}).block, ps = '6. Policy Schedules \\ 2025';
  assert.strictEqual(c('Alex Forbes Provident satatement - Mar \'25 - (D Doe).pdf', ps), 'group'); assert.strictEqual(c('Sanlam Provident Statement 31.03.26.pdf', ps), 'group'); assert.strictEqual(c('OM Preservation Fund Statement.pdf', ps), 'group');
  assert.strictEqual(c('IRR - 2755001 - DORA DOE.pdf', ps), 'investments'); assert.strictEqual(c('D DOE_statement - 2025-12-15T155359.881.pdf', ps), 'investments'); assert.strictEqual(c('NinteyOne IS - 861234_INVRA - 12.03.26 - (D Doe).pdf', ps), 'investments');
  assert.strictEqual(c('Mom RA PS - 0311223 - 04.07.24 - (D Doe).pdf', ps), 'policies', 'a PS is a policy schedule by its name; in a policy folder the FOLDER decides the block');
  assert.ok(F.isManual('Dora Doe\u2019s Owner\u2019s Manual \u2013 Policy number 811234567 -PDF.pdf') && F.isManual('Dora Doe\u2019s Owner\u2019s Manual.pdf'), 'the owner\'s manual, with the en dash, with or without the number');
});

/* ---------- 7. the latest overview ---------- */
test('the latest overview is the newest .json of 1. Overview and its newest year folders; a PDF alone is only noticed', async () => {
  const c = tree(), o = await F.latestOverview(client(c));
  assert.strictEqual(o.json.name, 'WR Overview - 10.03.26 - Test, Dora.json'); assert.strictEqual(o.pdf.name, 'WR Overview - 10.03.26 - Test, Dora.pdf');
  const only = new Dir('Pdf, Pat'); only.add('1. Overview', '2026').file('WR Overview - 01.01.26.pdf'); const p = await F.latestOverview({ rootKey: 'A', parts: ['Pdf, Pat'], handle: only });
  assert.deepStrictEqual([p.json, p.pdf && p.pdf.name], [null, 'WR Overview - 01.01.26.pdf']);
  assert.strictEqual(await F.latestOverview({ rootKey: 'A', parts: ['None, Nina'], handle: new Dir('None, Nina') }), null, 'no overview folder, no overview');
});

/* ---------- 8. quotes stay quotes ---------- */
test('a file inside a Comparative Quotes or Quotes folder is never a CURRENT investment or policy, whatever its name', () => {
  const c = (n, d) => (docs.classify(n, d) || {}).block;
  assert.strictEqual(c('2024 Investment.pdf', 'Coronation RA - 458899 \\ Comparative Quotes'), 'comparative', 'the slip Paul saw: 2024 comparative quotes labelled Current investments');
  assert.strictEqual(c('Old Mutual Investment 2024.pdf', 'Comparative Quotes'), 'comparative'); assert.strictEqual(c('Policy Cover 2024.pdf', '3. Quotes'), 'comparative');
  assert.strictEqual(c('Optimal RA Statement.pdf', 'Quotes (Accepted)'), 'proposed', 'an accepted investment proposal is a proposed investment');
  assert.strictEqual(c('Statement 31.03.26.pdf', 'Mom Endowment - 03112233445 \\ 2026'), 'investments', 'a statement in a policy folder\'s year folder is still a statement');
  assert.strictEqual(c('Lifestyle Plan 9988776.pdf', '6. Policy Schedules \\ 2026'), 'policies');
  assert.strictEqual(c('Statement.pdf', 'Old Mutual Quotes RA - 123456 \\ 2026'), 'investments', 'a policy folder whose NAME has the word quotes is not a quotes folder');
  assert.strictEqual(c('BR FNA 100000001.pdf', 'Comparative Quotes'), 'fna', 'a name that says what it is still wins');
});

/* ---------- 9. two files with one name ---------- */
test('two policy folders may both hold "Policy Schedule.pdf": the View button of each policy opens its OWN file', () => {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify({ app: 'wr-fact-find', schema: '5.5', f: { fname: { v: 'Dora' }, sname: { v: 'Test' }, net: { v: 'R 90 000.00' }, ip_age: { v: '65' }, date: { v: '10/11/2026' } },
    l: { kids: [], debts: [], risk: [{ d: { prov: 'BrightRock', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'Discovery', spend: 'R 800.00', broker: 'Other broker' } }] } }), 'ff.json');
  const [a, b] = s.blocks.policies.items; docs.applyPolicy(s, a, { insurer: 'BrightRock', policyNo: '811234567', product: 'Lifestyle', premium: 900, lines: [{ type: 'household', life: { lump: 500000 } }] }, 'Policy Schedule.pdf');
  docs.applyPolicy(s, b, { insurer: 'Discovery', policyNo: '8877665', product: 'Life', premium: 800, lines: [{ type: 'other', label: 'Cover', life: { lump: 100000 } }] }, 'Policy Schedule.pdf');
  const F1 = (name, rel) => ({ name, rel, handle: { name } }), pool = [F1('Policy Schedule.pdf', ['Discovery Life - 8877665', 'Policy Schedules']), F1('Policy Schedule.pdf', ['BR Personal Covers - 811234567', 'Policy Schedules', '2026'])];
  const pa = V.pick(V.refFor(s, 'blocks.policies.items.0'), pool), pb = V.pick(V.refFor(s, 'blocks.policies.items.1'), pool);
  assert.strictEqual(pa.file.rel[0], 'BR Personal Covers - 811234567', 'the BrightRock policy opens the file in ITS folder (its policy number)'); assert.strictEqual(pb.file.rel[0], 'Discovery Life - 8877665', 'the Discovery policy opens the one in its folder');
});

/* ---------- 10. wiring and the record ---------- */
test('the page is 1.5 or later, the layout stays 0.1, no key is added, the pick list is grouped per policy folder, a file carries its folder and block, and the changed scripts have new tags', () => {
  assert.ok(/^(1\.[56789]|2\.[01])$/.test(schema.pageVersion), 'page 1.5, or 1.6 which came after it'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.4'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fu = app('js/folders-ui.js'), html = app('overview.html');
  assert.ok(/function pickList\(res, plan\)/.test(ui) && /class="pkh"/.test(ui) && /function tickPlan\(res, plan\)/.test(ui) && /F\.keyedNewest|FF\.folders/.test(ui), 'the grouped list and what is ticked');
  assert.ok(/file\.wrDir = /.test(ui) && /file\.wrBlock = g\.block/.test(ui) && /wrGroup/.test(ui) && /o\.block \|\| file\.wrBlock \|\| \(cls && cls\.block\)/.test(ui), 'a file carries where it was found and the block its policy folder says');
  assert.ok(/function uniqueFiles/.test(ui) && /dir \+ ' \\\\ '/.test(ui), 'two files with one name in two policy folders are not one file');
  assert.ok(/async function listClient\(client, T\)/.test(fu) && /F\.policyScan\(client, \{ sink: sink, ms: T\.walk, perFolder: T\.policyFolder \}\)/.test(fu) && /race\(F\.policyScan/.test(fu) && /F\.latestOverview/.test(fu), 'the policy scan runs within the walk limit and hands back what it found');
  ['ov-schema', 'ov-docs', 'ov-ui', 'ov-view', 'folders', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=(?:20261124[stuvw]|20261125[a-z])').test(html), f)); assert.ok(/overview\.css\?v=(?:20261124[stuvw]|20261125[a-z])/.test(html));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=(?:20261124[stuvw]|20261125[a-z])/.test(app(f)) && /folders-ui\.js\?v=(?:20261124[stuvw]|20261125[a-z])/.test(app(f)), f));
  assert.ok(!/policyFolders|policyScan|latestOverview/.test(app('js/ov-store.js') + app('js/ov-calc.js')), 'the saved file and its sums are untouched');
  const src = app('js/folders.js').slice(app('js/folders.js').indexOf('the client\'s POLICY FOLDERS'), app('js/folders.js').indexOf('The folder of a client\'s own folder where a kind of document'));
  assert.ok(!/createWritable|getFileHandle|getDirectoryHandle|removeEntry|\{ create:/.test(src), 'the policy-folder code only reads');
});
