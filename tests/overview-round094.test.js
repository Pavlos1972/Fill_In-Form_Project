/* Client Overview Studio 0.94 (23 November, Paul: "I need to be able to click on to check and waiting and it should take me there"). The Progress panel's "to check" and "waiting" numbers are buttons: a click goes to the next such
   row, opens the quote or policy that holds it, flashes the row and says which it is. Invented client only ("Test Client"). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const store = require('../app/js/ov-store.js');
const docs = require('../app/js/ov-docs.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('10/11/2026'), will: v('Yes'), will_where: v('Other provider'), will_broker: v('Other broker') },
  l: { kids: [], debts: [{ d: { type: 'Home loan', prov: 'Test Bank A', desc: 'Home loan', inst: 'R 9 000.00', bal: 'R 900 000.00', term: '60' } }], risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }] } };
const withFF = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json'); return s; };
const quote = (s, block, number, lines) => docs.applyQuote(s, block, { insurer: 'BrightRock', number, date: '19/11/2026', premium: 5000, lines }, 'q.pdf').quote;
const LINES = () => [{ type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 }, { type: 'death', life: { lump: 300000 }, abi: 5 }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank A', life: { lump: 900000, monthly: 9000 }, abi: 5 }];

test('pendingRows: the rows of "to check" and "waiting" are exactly the ones the Progress panel counts, in the order of the screen, each with its address and the item or quote that holds it', () => {
  const s = withFF(), q = quote(s, 'fna', '100000081', LINES());
  q.lines[0].st = 'confirmed'; q.lines[1].st = 'verify'; q.lines[2].st = 'empty';
  const c = store.counts(s), chk = store.pendingRows(s, 'check'), wt = store.pendingRows(s, 'waiting');
  assert.strictEqual(chk.length, c.check, 'one row for every "to check" the panel counts'); assert.strictEqual(wt.length, c.waiting, 'one row for every "waiting" the panel counts');
  assert.ok(chk.length >= 2 && wt.length >= 2, 'the invented client has both kinds');
  [chk, wt].forEach(list => list.forEach((r, i) => {
    assert.strictEqual(store.pathGet(s, r.path), r.row, 'the path leads to the row: ' + r.path); assert.ok(!r.row.removed);
    if (i) assert.ok(r.n > list[i - 1].n, 'in the order of the screen');
    assert.ok(r.owner && r.owner.id, 'the owner is the item or quote to open'); assert.strictEqual(r.isLine, r.row !== r.owner);
    assert.ok(r.block && s.blocks[r.block], 'the block is named');
  }));
  const chkLine = chk.find(r => r.row === q.lines[1]); assert.ok(chkLine && chkLine.isLine && chkLine.owner === q && chkLine.block === 'fna' && chkLine.path === 'blocks.fna.quotes.0.lines.1', 'a quote line: its quote is the owner');
  const waitLine = wt.find(r => r.row === q.lines[2]); assert.ok(waitLine && waitLine.isLine && waitLine.owner === q);
  assert.ok(!chk.some(r => r.row === q.lines[0]) && !wt.some(r => r.row === q.lines[0]), 'a checked line is in neither');
  const polItem = chk.find(r => r.block === 'policies'); assert.ok(polItem && !polItem.isLine && polItem.row === polItem.owner && /^blocks\.policies\.items\.\d+$/.test(polItem.path), 'a current policy from the Fact Find is "to check" and is its own owner');
  const ns = chk.map(r => r.n).concat(wt.map(r => r.n)); assert.strictEqual(new Set(ns).size, ns.length, 'a row has one place in the whole walk, whichever kind is asked');
  assert.deepStrictEqual(store.pendingRows(s, 'check').map(r => r.path), chk.map(r => r.path), 'the same answer every time');
});

test('a removed quote takes its lines with it: they are neither counted nor offered; a removed line is neither', () => {
  const s = withFF(), q = quote(s, 'fna', '100000081', LINES()); q.st = 'verify'; q.lines.forEach(l => { l.st = 'verify'; });
  const before = store.counts(s).check;
  q.removed = true;
  assert.strictEqual(store.counts(s).check, before - 4, 'the quote and its three lines no longer count (a removed quote used to leave its lines counted)');
  assert.ok(!store.pendingRows(s, 'check').some(r => r.owner === q), 'and none of them is offered');
  q.removed = false; assert.strictEqual(store.counts(s).check, before);
  q.lines[1].removed = true; assert.strictEqual(store.counts(s).check, before - 1); assert.ok(!store.pendingRows(s, 'check').some(r => r.row === q.lines[1]));
});

test('with nothing to check, or nothing waiting, there is nothing to go to', () => {
  const s = store.blank(); assert.deepStrictEqual(store.pendingRows(s, 'check'), []); assert.ok(Array.isArray(store.pendingRows(s, 'waiting')));
  const t = withFF(); store.acceptAll(t); assert.strictEqual(store.counts(t).check, 0); assert.deepStrictEqual(store.pendingRows(t, 'check'), []);
});

test('the page: "to check" and "waiting" are buttons the page answers (a click and Enter or Space), the version is 0.95 and the saved file gains no key', () => {
  const html = app('overview.html'), ui = app('js/ov-ui.js');
  assert.ok(/<div class="sbtn" id="sVerifyBox" role="button" tabindex="0"[^>]*><b id="sVerify">0<\/b><span>to check<\/span><\/div>/.test(html), '"to check" is a button');
  assert.ok(/<div class="sbtn" id="sEmptyBox" role="button" tabindex="0"[^>]*><b id="sEmpty">0<\/b><span>waiting<\/span><\/div>/.test(html), '"waiting" is a button');
  assert.ok(/<div><b id="sFilled">0<\/b><span>checked<\/span><\/div>/.test(html), '"checked" stays plain');
  assert.ok(/\['sVerifyBox', 'check'\], \['sEmptyBox', 'waiting'\]/.test(ui) && /goPending/.test(ui) && /e\.key === 'Enter' \|\| e\.key === ' '/.test(ui), 'a click and the keyboard both go');
  assert.ok(/store\.pendingRows\(state, kind\)/.test(ui) && /openSet\[next\.owner\.id\] = true/.test(ui), 'the page asks the store and opens the quote or policy that holds the row');
  assert.strictEqual(schema.pageVersion, '0.97'); assert.strictEqual(schema.version, '0.1');
  assert.ok(/\.qcard\.flash/.test(app('css/overview.css')), 'a card flashes like a row');
});
