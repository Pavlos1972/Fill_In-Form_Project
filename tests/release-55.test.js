/* Release 5.5 (24 November 2026, from the Fix Skills chat for Paul: on a real review client's Fact Find the Progress card said 58 filled, 30 to verify, 20 not asked, but every pill Paul looked at said CONFIRMED).
   What the code did: "to verify" counted every amber box and row on every page, including (1) the optional notes boxes, which never draw a pill, and (2) boxes, blocks and pages that a rule hides, which are not drawn at all.
   5.5: only what is SHOWN is counted; a notes box that waits to be verified draws its pill (and an amber border); each page button says how many are on it; the walk names the page.
   An invented client only: no real client data in this repository. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const ids = s => store.pending(s, 'verify').map(x => x.id || x.list + ':' + x.i);

test('the version is 5.5 and the build matches in all four pages', () => {
  assert.strictEqual(schema.version, '5.5');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'build.js'), 'utf8'), /var BUILD = '5\.5'/);
  ['index.html', 'short-risk.html', 'capture-sheet.html', 'overview.html'].forEach(f => assert.match(fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'), /<meta name="wr-build" content="5\.5">/, f));
});

test('a box hidden by a rule is not counted as "to verify" while it is hidden, and is counted again when it is shown', () => {
  const s = fresh();
  set(s, 'nat_other', 'Elbonian', 'verify');                          // shown only when the nationality is Other
  assert.deepStrictEqual(ids(s), [], 'hidden: nothing to confirm on the screen');
  set(s, 'nat', 'Other', 'confirmed');
  assert.deepStrictEqual(ids(s), ['nat_other'], 'shown now: counted');
});

test('a list row in a block that is hidden is not counted; in a block that is shown it is', () => {
  const s = fresh();
  store.addRow(s, 'debts', { type: 'Home loan' }, 'verify');                                       // adding a row says the client has debts
  set(s, 'has_debts', 'No', 'confirmed');
  assert.deepStrictEqual(ids(s), [], 'no debts: the Debts list is not shown');
  set(s, 'has_debts', 'Yes', 'confirmed');
  assert.deepStrictEqual(ids(s), ['debts:0']);
});

test('an amber optional notes box, an advisor-page box and a plain box are all counted when shown, in the order of the pages, and the per-page counts add up to the Progress number', () => {
  const s = fresh();
  set(s, 'ref', 'Current client', 'confirmed');
  set(s, 'n_info', 'A note', 'verify'); set(s, 'n_income', 'Another note', 'verify'); set(s, 'pr_life', 'Priority: client agrees', 'verify'); set(s, 'cc_notes', 'Summary', 'verify'); set(s, 'fname', 'Test', 'verify');
  const list = store.pending(s, 'verify'), secs = list.map(x => schema.sections.findIndex(y => y.id === x.sec));
  assert.deepStrictEqual(ids(s).sort(), ['cc_notes', 'fname', 'n_income', 'n_info', 'pr_life'].sort());
  assert.deepStrictEqual(secs, secs.slice().sort((a, b) => a - b), 'in the order of the pages');
  const by = store.verifyBySection(s);
  assert.deepStrictEqual(by, { info: 2, income: 1, prio: 1, admin: 1 });
  assert.strictEqual(Object.keys(by).reduce((a, k) => a + by[k], 0), list.length, 'the pages add up to the Progress number');
});

test('a hidden amber box is left alone by "Verify All" (it only confirms what is counted)', () => {
  const s = fresh(); set(s, 'nat_other', 'Elbonian', 'verify'); set(s, 'n_info', 'A note', 'verify');
  store.pending(s, 'verify').forEach(it => { if (it.id) s.f[it.id].st = 'confirmed'; });                 // what Verify All does with the list
  assert.strictEqual(s.f.n_info.st, 'confirmed'); assert.strictEqual(s.f.nat_other.st, 'verify', 'never shown, never confirmed');
});

test('the notes box draws a pill while it waits (ui.js) and the amber border covers a notes box (app.css); the page buttons carry the per-page count; the walk names the page', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'ui.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'app', 'css', 'app.css'), 'utf8');
  assert.match(ui, /if \(f\.t === 'area' && \(!f\.opt \|\| st === 'verify'\)\) rt \+= badge\(st, 'f:' \+ f\.id\);/);
  assert.match(ui, /function syncBadge\(wrap, id\)/);
  assert.match(ui, /data-vcount="' \+ s\.id \+ '" hidden/);
  assert.match(ui, /store\.verifyBySection\(state\)/);
  assert.match(ui, /\(page: ' \+ pg\.title \+ '\)/);
  assert.match(css, /\.f\.s-verify input, \.f\.s-verify select, \.f\.s-verify textarea \{/);
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no name twice in ui.js');
});
