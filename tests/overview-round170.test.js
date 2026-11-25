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

/* ---------- 4. the wiring ---------- */
test('the page is 1.7, no key is added, tickPlan asks the one function, and the tags are new', () => {
  assert.strictEqual(schema.pageVersion, '1.7'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.6'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fo = app('js/folders.js'), html = app('overview.html');
  assert.ok(/F\.ageQuotes \? F\.ageQuotes\(entries\)/.test(ui) && !/var ruled = function/.test(ui) && !/var oldNo/.test(ui), 'tickPlan has no copy of the rule');
  assert.ok(/function ageQuotes\(entries\)/.test(fo) && /ageQuotes: ageQuotes/.test(fo));
  ['ov-schema', 'ov-docs', 'ov-ui', 'folders', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124u').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=20261124u/.test(app(f)) && /folders-ui\.js\?v=20261124u/.test(app(f)), f));
  assert.ok(!/ageQuotes/.test(app('js/ov-store.js') + app('js/ov-calc.js')), 'the saved file and its sums are untouched');
});
