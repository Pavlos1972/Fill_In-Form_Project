/* Client Overview Studio 1.9 (25 November, found by the Fix Skills chat in its own folder scan of the same fault and relayed at 16:00): "(Not linked to PK)" was read as linked to Paul. `folders.js` had the same test (`/linked to pk/` also matches "not linked to pk"), and the
   status words (`transferred`, `cancelled`, `lapsed`) had the same weakness, so "(Not Transferred)" would have made a LIVE folder not live and skipped it. A negated word is not the status. One function, `wordIn`, serves them all. Invented names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const P = n => F.parsePolicyFolder(n);

test('a folder (Linked to PK) is linked; (Not linked to PK), "Not linked to PK", (Unlinked to PK) and (Never linked to PK) are NOT, and stay live with their product intact', () => {
  assert.ok(P('Sanlam Invest - 889977 - (Linked to PK)').linked && !P('Sanlam Invest - 889977 - (Linked to PK)').notLinked);
  ['Sanlam Invest - 889977 - (Not linked to PK)', 'Sanlam Invest - 889977 - (NOT Linked to PK)', 'Sanlam Invest - 889977 - Not linked to PK', 'Sanlam Invest - 889977 - (Unlinked to PK)', 'Sanlam Invest - 889977 - (Un-linked to PK)', 'Sanlam Invest - 889977 - (Never linked to PK)', 'Sanlam Invest - 889977 - (No longer linked to PK)'].forEach(n => {
    const p = P(n); assert.strictEqual(p.linked, false, n); assert.strictEqual(p.notLinked, true, n); assert.strictEqual(p.status, 'live', n); assert.strictEqual(p.unknownStatus, '', n + ': a recognised phrase is not an unknown status'); assert.strictEqual(p.product, 'Invest', n + ': the word Not does not stay in the product'); assert.strictEqual(p.number, '889977', n);
  });
  assert.strictEqual(P('Sanlam Invest - 889977').linked, false); assert.strictEqual(P('Sanlam Invest - 889977').notLinked, false);
});
test('a negated status word is not the status: (Not Transferred), (Not cancelled), (Not lapsed) are live folders (the odd bracket word is shown, not hidden); (Transferred), (Transfered), (Cancelled), (Lapsed) still are not live', () => {
  ['Not Transferred', 'Not cancelled', 'Not lapsed', 'Never transferred'].forEach(w => { const p = P('Sanlam Invest - 889977 - (' + w + ')'); assert.strictEqual(p.status, 'live', w); assert.strictEqual(p.unknownStatus, w, w + ' is shown to the adviser'); });
  [['Transferred', 'transferred'], ['Transfered', 'transferred'], ['Cancelled', 'cancelled'], ['Canceled', 'cancelled'], ['Lapsed', 'lapsed']].forEach(([w, st]) => assert.strictEqual(P('Sanlam Invest - 889977 - (' + w + ')').status, st, w));
  assert.strictEqual(P('Sanlam Invest - 889977 - (Linked to PK) Not Transferred').status, 'live'); assert.strictEqual(P('Sanlam Invest - 889977 - (Linked to PK) Not Transferred').linked, true);
  assert.strictEqual(P('Sanlam Invest - 889977 - (Transferred) (Not linked to PK)').status, 'transferred', 'both words in one name: each is read for what it says');
});
test('wordIn: 1 when the word is there and not negated, -1 only negated, 0 absent; one positive occurrence beats a negated one', () => {
  assert.ok(typeof F.wordIn === 'function', 'exported');
  assert.strictEqual(F.wordIn('Linked to PK', 'linked to pk'), 1); assert.strictEqual(F.wordIn('not linked to pk', 'linked to pk'), -1); assert.strictEqual(F.wordIn('Sanlam', 'linked to pk'), 0);
  assert.strictEqual(F.wordIn('not linked to pk, linked to pk', 'linked to pk'), 1); assert.strictEqual(F.wordIn('unlinked to pk', 'linked to pk'), -1);
  assert.strictEqual(F.wordIn('delinked to pk', 'linked to pk'), 0, 'a longer word is not the word');
});
test('the page is 1.9, no key is added, the heading chip says Not linked to PK, and the tags are new', () => {
  assert.ok(/^(1\.9|2\.[01])$/.test(schema.pageVersion)); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.8'), 'compared as decimals');
  const ui = app('js/ov-ui.js'), fo = app('js/folders.js'), html = app('overview.html');
  assert.ok(/if \(p\.notLinked\) chips\.push\(\{ cls: '', text: 'Not linked to PK' \}\)/.test(ui), 'the heading says it');
  assert.ok(!/\/linked to pk\/\.test/.test(fo), 'no bare test for "linked to pk" is left in folders.js (it also matches "not linked to pk")');
  assert.ok(/wordIn: wordIn/.test(fo));
  ['ov-schema', 'ov-ui', 'folders'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=(?:20261124w|20261125[a-z])').test(html), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=(?:20261124w|20261125[a-z])/.test(app(f)), f));
});
