/* The Client Overview saves into `1. Overview\<year>` inside the client's folder (stage 3). The logic in app/js/folders.js on a pretend folder tree (the real folder calls are in tests/browser/t-overview-folders.js).
   This is the ONE place a page makes folders (Paul, 21 November): `1. Overview` and the year, only inside a client folder that exists; nothing else is ever created. Invented names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../app/js/folders.js');

const nf = () => { const e = new Error('not found'); e.name = 'NotFoundError'; return e; };
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); this.made = []; }
  async *entries() { for (const [n, h] of this.kids) yield [n, h]; }
  async getDirectoryHandle(n, o) { const h = this.kids.get(n); if (h && h.kind === 'directory') return h; if (o && o.create) { const d = new Dir(n, this); this.kids.set(n, d); root(this).made.push(this.path() + '/' + n); return d; } throw nf(); }
  async getFileHandle(n) { throw nf(); }
  async resolve(d) { const parts = []; let c = d; while (c && c !== this) { parts.unshift(c.name); c = c.parent; } return c === this ? parts : null; }
  path() { return this.parent ? this.parent.path() + '/' + this.name : this.name; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n, d)), d.kids.get(n)); return d; }
}
const root = d => { while (d.parent) d = d.parent; return d; };
const names = d => { const out = []; (function walk(x, p) { for (const [n, h] of x.kids) { out.push(p + n); if (h.kind === 'directory') walk(h, p + n + '/'); } })(d, ''); return out.sort(); };
const roots = (A, B) => { const r = {}; if (A) r.A = { handle: A, path: 'C:\\Users\\tester\\NewBusiness' }; if (B) r.B = { handle: B, path: 'C:\\Users\\tester\\ClientFiles' }; return r; };
const INFO = (s, f, y) => ({ kind: 'overview', sname: s, fname: f, year: y });

test('the rule: the client\'s "1. Overview" folder, however it is spaced or capitalised; and a year is four digits', () => {
  ['1. Overview', '1.Overview', '1.  OVERVIEW', '1. overview'].forEach(n => assert.ok(F.RULES.overview.test(F.norm(n)), n));
  ['Overview', '1. Overview Old', '2. Fact Find', '1. Overviews'].forEach(n => assert.ok(!F.RULES.overview.test(F.norm(n)), n));
  assert.ok(F.RULES.year.test('2027') && !F.RULES.year.test('27') && !F.RULES.year.test('2027 old'));
});

test('finding the target reads only: nothing is made, however much is missing', async () => {
  const A = new Dir('NB'); A.add('Client, Test', '1. Overview'); A.add('Fresh, Frank', '2. Fact Find'); A.add('Done, Dora', '1. Overview', '2027');
  const before = names(A);
  let r = await F.resolveOverview(roots(A), INFO('Client', 'Test', 2027));
  assert.strictEqual(r.reason, 'only'); assert.deepStrictEqual(r.pick.rel, ['Client, Test', '1. Overview', '2027']); assert.strictEqual(r.pick.apps, null); assert.strictEqual(r.pick.make, true); assert.ok(r.pick.ovHandle);
  r = await F.resolveOverview(roots(A), INFO('Fresh', 'Frank', 2027));
  assert.deepStrictEqual(r.pick.rel, ['Fresh, Frank', '1. Overview', '2027']); assert.strictEqual(r.pick.ovHandle, null); assert.strictEqual(r.pick.make, true);
  r = await F.resolveOverview(roots(A), INFO('Done', 'Dora', 2027));
  assert.ok(r.pick.apps && r.pick.make === false && r.pick.apps.name === '2027', 'an existing year folder is used');
  assert.deepStrictEqual(names(A), before); assert.deepStrictEqual(root(A).made, [], 'nothing was made while looking');
});

test('no names, or no client folder: the reason, and no folder is made (the page never makes a client folder)', async () => {
  const A = new Dir('NB'); A.add('Client, Test', '1. Overview'); const before = names(A);
  assert.strictEqual((await F.resolveOverview(roots(A), INFO('', '', 2027))).reason, 'names');
  const r = await F.resolveOverview(roots(A), INFO('Nobody', 'Nina', 2027));
  assert.strictEqual(r.reason, 'client'); assert.ok(r.deepest, 'the Save window can open in the connected folder');
  assert.deepStrictEqual(names(A), before);
});

test('the same client in both places: a list, with both targets (the one that exists and the one that would be made)', async () => {
  const A = new Dir('NB'), B = new Dir('CF'); A.add('Both, Betty', '1. Overview'); B.add('B - Files', 'Both, Betty', '1. Overview', '2027');
  const r = await F.resolveOverview(roots(A, B), INFO('Both', 'Betty', 2027));
  assert.ok(r.ask && r.ask.length === 2, 'two candidates'); assert.deepStrictEqual(r.ask.map(c => c.make), [true, false]);
  assert.deepStrictEqual(r.ask.map(c => F.labelOf(c)), ['Both, Betty \\ 1. Overview \\ 2027', 'B - Files \\ Both, Betty \\ 1. Overview \\ 2027']);
});

test('making the folders: 1. Overview and the year, inside the client\'s folder, and only those; a second save makes nothing more', async () => {
  const A = new Dir('NB'); A.add('Fresh, Frank', '2. Fact Find'); A.add('Client, Test', '1. Overview');
  let r = await F.resolveOverview(roots(A), INFO('Fresh', 'Frank', 2027)), year = await F.ensureOverview(r.pick);
  assert.strictEqual(year.name, '2027'); assert.deepStrictEqual(root(A).made, ['NB/Fresh, Frank/1. Overview', 'NB/Fresh, Frank/1. Overview/2027']);
  r = await F.resolveOverview(roots(A), INFO('Client', 'Test', 2027)); await F.ensureOverview(r.pick);
  assert.deepStrictEqual(root(A).made.slice(2), ['NB/Client, Test/1. Overview/2027'], 'only the year was missing');
  const n = root(A).made.length;
  r = await F.resolveOverview(roots(A), INFO('Fresh', 'Frank', 2027)); assert.strictEqual(r.pick.make, false); assert.strictEqual(await F.ensureOverview(r.pick), r.pick.apps); assert.strictEqual(root(A).made.length, n, 'a year that exists is used, not made again');
  assert.ok(!names(A).some(x => /^Frank|^Test/.test(x)), 'no client folder was made');
});

test('a folder for another year is made beside the first; the older year is untouched', async () => {
  const A = new Dir('NB'); A.add('Done, Dora', '1. Overview', '2026');
  const r = await F.resolveOverview(roots(A), INFO('Done', 'Dora', 2027)); await F.ensureOverview(r.pick);
  assert.deepStrictEqual(names(A), ['Done, Dora', 'Done, Dora/1. Overview', 'Done, Dora/1. Overview/2026', 'Done, Dora/1. Overview/2027']);
});

test('a PDF goes beside the saved file when that file lies in a year folder', async () => {
  const A = new Dir('NB'); const y = A.add('Client, Test', '1. Overview', '2027'); const file = { kind: 'file', name: 'x.json', parent: y };
  const got = await F.dirOfFile(roots(A), file, F.RULES.year); assert.ok(got && got.handle === y && got.parts.join('/') === 'Client, Test/1. Overview/2027');
  const other = { kind: 'file', name: 'y.json', parent: A.add('Client, Test', '2. Fact Find') };
  assert.strictEqual(await F.dirOfFile(roots(A), other, F.RULES.year), null, 'a file in another folder is not "beside the overview"');
});

test('the shipped code: the only place a folder is made is ensureOverview; no real path', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'folders.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.strictEqual((code.match(/getDirectoryHandle\([^)]*create\s*:\s*true/g) || []).length, 2, 'two creations, both inside ensureOverview (1. Overview and the year)');
  const i = code.indexOf('async function ensureOverview'), body = code.slice(i, code.indexOf('async function', i + 10) > 0 ? code.indexOf('async function', i + 10) : code.length);
  assert.ok((body.match(/create\s*:\s*true/g) || []).length === 2, 'both are in ensureOverview');
  assert.ok(!/removeEntry/.test(code.slice(0, code.indexOf('async function discardEmpty'))), 'nothing is removed outside discardEmpty (an empty file this save made)');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'folders-ui.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/ensureOverview/.test(ui) && !/getDirectoryHandle\([^)]*create/.test(ui), 'the screens only call ensureOverview; they make no folder themselves');
});
