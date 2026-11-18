/* Saving into the client's Applications folder (Risk Application 1.4, Investment Application 1.3): the logic in app/js/folders.js on a pretend folder tree that behaves like the browser's folder handles.
   (The real folder calls are tested in the browser by tests/browser/t-folders.js, on a real directory tree in the browser's private file system.) All names here are invented. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../app/js/folders.js');
const SRS = require('../app/js/sr-schema.js');
const CSS = require('../app/js/cs-schema.js');

/* ---- a pretend directory tree: the same calls as FileSystemDirectoryHandle / FileSystemFileHandle ---- */
const nf = () => { const e = new Error('A requested file or directory could not be found at the time an operation was processed.'); e.name = 'NotFoundError'; return e; };
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  async *entries() { for (const [n, h] of this.kids) yield [n, h]; }
  async getDirectoryHandle(n, o) { const h = this.kids.get(n); if (h && h.kind === 'directory') return h; if (o && o.create) { const d = new Dir(n, this); this.kids.set(n, d); return d; } throw nf(); }
  async getFileHandle(n, o) { const h = this.kids.get(n); if (h && h.kind === 'file') return h; if (o && o.create) { const f = new File_(n, this); this.kids.set(n, f); return f; } throw nf(); }
  async removeEntry(n) { if (!this.kids.has(n)) throw nf(); this.kids.delete(n); }
  async isSameEntry(o) { return this === o; }
  async resolve(d) { const parts = []; let c = d; while (c && c !== this) { parts.unshift(c.name); c = c.parent; } return c === this ? parts : null; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n, d)), d.kids.get(n)); return d; }
  addFile(n, bytes) { const f = new File_(n, this); f.bytes = bytes || 0; this.kids.set(n, f); return f; }
}
class File_ {
  constructor(name, parent) { this.kind = 'file'; this.name = name; this.parent = parent; this.bytes = 0; }
  async isSameEntry(o) { return this === o; }
  async getFile() { return { size: this.bytes }; }
}
const roots = (A, B) => { const r = {}; if (A) r.A = { handle: A, path: 'C:\\Users\\tester\\NewBusiness' }; if (B) r.B = { handle: B, path: 'C:\\Users\\tester\\ClientFiles' }; return r; };
const STD = ['1. Overview', '2. Fact Find', '3. Quotes', '4. Applications Sent', '5. Policy Schedules', '6. Correspondence', '7. All in one Compliance'];
const std = d => STD.forEach(n => d.add(n));
const info = (o) => Object.assign({ sname: 'Kuiper', fname: 'Annabel', insurers: F.insurerWords('Brightrock', SRS.abbr), products: F.productWords('Personal'), kinds: [], premium: 2507.64 }, o || {});

test('names: case, accents, apostrophes and spaces do not matter; the first names match by prefix, whole words only', () => {
  assert.ok(F.clientMatches('Kuiper, Annabel', 'kuiper', 'ANNABEL'));
  assert.ok(F.clientMatches('Kuiper, Annabel', 'Kuiper', 'Annabel Maria'), 'the folder has one first name, the form has two');
  assert.ok(F.clientMatches('Kuiper, Annabel Maria', 'Kuiper', 'Annabel'), 'and the other way round');
  assert.ok(F.clientMatches('van der Merwe, Mary', 'Van der Merwe', 'Mary'), 'Van / van');
  assert.ok(F.clientMatches('Du Plessis,  Zoë', 'du plessis', 'Zoe'), 'accents and repeated spaces');
  assert.ok(F.clientMatches('O’Brien, Sean', "O'Brien", 'Sean'), 'a curly and a straight apostrophe');
  assert.ok(!F.clientMatches('Kuiper, Anna', 'Kuiper', 'Annabel'), 'Anna is not Annabel');
  assert.ok(!F.clientMatches('Kuiper, Annabel', 'Kuiperman', 'Annabel'), 'another surname');
  assert.ok(!F.clientMatches('2. Fact Find', 'Kuiper', 'Annabel') && !F.clientMatches('Kuiper', 'Kuiper', 'Annabel'), 'a folder that is not "Surname, First"');
  assert.ok(!F.clientMatches('Kuiper, Annabel', '', ''), 'nothing to look for');
  assert.strictEqual(F.clientFolderName('Kuiper', 'Annabel'), 'Kuiper, Annabel');
});

test('the letter folder uses the first letter of the surname AS WRITTEN, the prefix included (V - Files for Van der Merwe)', () => {
  assert.strictEqual(F.letterFolder('Van der Merwe'), 'V - Files'); assert.strictEqual(F.letterFolder('Kuiper'), 'K - Files');
  assert.strictEqual(F.letterFolder('Éloff'), 'E - Files'); assert.strictEqual(F.letterFolder('’t Hart'), 'T - Files'); assert.strictEqual(F.letterFolder(''), '');
  assert.ok(F.isLetterFolder('J - Files') && F.isLetterFolder('j - files') && !F.isLetterFolder('Jansen - Files'));
});

test('the standard folders are recognised by their number; the insurer is matched on the page’s own abbr plus the aliases', () => {
  STD.forEach(n => assert.ok(F.isStandard(n), n)); assert.ok(!F.isStandard('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)'));
  assert.deepStrictEqual(F.insurerWords('Brightrock', SRS.abbr).slice(0, 2), ['BR', 'BrightRock']); assert.ok(F.insurerWords('Discovery', SRS.abbr).map(F.norm).indexOf('disc') >= 0, 'DISC and Disc are one spelling: matching ignores capitals');
  assert.strictEqual(SRS.abbr['Old Mutual'], 'OM', 'the page’s abbr is the first spelling, and it is not changed here');
  assert.deepStrictEqual(F.productWords('Personal Covers'), ['personal'], 'cover / covers / life are not product words');
  assert.deepStrictEqual(F.productWords('Optimal RA'), ['optimal', 'ra']);
});

test('scoring: insurer 3, product 3, premium 2, kind 1; another insurer’s name and not ours is a conflict', () => {
  const s = F.scoreDeal('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', info());
  assert.deepStrictEqual([s.insurer, s.product, s.premium, s.score, s.conflict], [true, true, true, 8, false]);
  assert.strictEqual(F.scoreDeal('Kuiper, Annabel - (BR - Personal Covers)', info()).score, 6, 'the older "Personal Covers" spelling');
  assert.strictEqual(F.scoreDeal('Kuiper, Annabel - (Fact Find)', info()).score, 0);
  const c = F.scoreDeal('Kuiper, Annabel - (DISC - Personal - R 900.00 p.m.)', info());
  assert.ok(c.conflict && !c.insurer, 'Discovery is not BrightRock');
  assert.ok(F.scoreDeal('Kuiper, Annabel - (Disc - Personal)', info({ insurers: F.insurerWords('Discovery', SRS.abbr) })).insurer, 'an older spelling of Discovery');
  const inv = info({ insurers: F.insurerWords('Old Mutual', CSS.abbr), products: F.productWords('Optimal RA'), kinds: ['recurring'], premium: 2800 });
  assert.strictEqual(F.scoreDeal('Kuiper, Annabel - (OM - Optimal RA - Recurring - R 2,800.00 p.m.)', inv).score, 3 + 3 + 1 + 2);
  assert.deepStrictEqual(F.numbersIn('x (BR - Personal - R 2 507.64 p.m.) R 10,000'), [2507.64, 10000]);
});

test('choosing the deal folder: one is used, a clear winner is used, a tie or a conflict is asked', () => {
  const c = n => ({ name: n });
  assert.deepStrictEqual(F.chooseDeal([], info()), { none: true });
  let r = F.chooseDeal([c('Kuiper, Annabel - (Fact Find)')], info()); assert.ok(r.pick && r.reason === 'only', 'one folder, even "- (Fact Find)"');
  r = F.chooseDeal([c('Kuiper, Annabel - (DISC - Personal - R 900.00 p.m.)')], info()); assert.ok(r.ask && r.ask.length === 1, 'one folder that names another insurer is asked about');
  r = F.chooseDeal([c('Kuiper, Annabel - (DISC - Personal - R 900.00 p.m.)'), c('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)')], info()); assert.ok(r.pick && r.pick.name.includes('BR') && r.reason === 'best');
  r = F.chooseDeal([c('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)'), c('Kuiper, Annabel - (BR - Personal - R 3,100.00 p.m.)')], info());
  assert.ok(r.pick && r.pick.name.includes('2,507.64'), 'two BrightRock folders: the premium decides (a clear 2 points)');
  r = F.chooseDeal([c('Kuiper, Annabel - (BR - Personal - R 2,000.00 p.m.)'), c('Kuiper, Annabel - (BR - Personal - R 3,100.00 p.m.)')], info());
  assert.ok(r.ask && r.ask.length === 2, 'a tie is a list');
  r = F.chooseDeal([c('Kuiper, Annabel - (Fact Find)'), c('Kuiper, Annabel - (Other)')], info()); assert.ok(r.ask, 'nothing matches: a list');
});

test('the Windows path limit: root + folders + file name + 7 for .crswap must be 259 or fewer; the 260th character refuses', () => {
  const rel = ['Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications'], file = 'BR - Personal Application - 20.11.26 - R 2,507.64 p.m. - (Annabel Kuiper).json';
  const base = F.pathCheck('C:\\a', rel, file); assert.strictEqual(base.known, true);
  const fit = 259 - 7 - (base.length - 'C:\\a'.length) - 0;                      // the root length that makes the swap path exactly 259
  const rootAt = n => 'C:\\' + 'x'.repeat(n - 3);
  let ok = F.pathCheck(rootAt(fit), rel, file); assert.strictEqual(ok.swap, 259); assert.ok(ok.ok && ok.over === 0, 'exactly 259 is allowed');
  let bad = F.pathCheck(rootAt(fit + 1), rel, file); assert.strictEqual(bad.swap, 260); assert.ok(!bad.ok && bad.over === 1, 'one more is refused');
  assert.strictEqual(bad.longest.name, rel[1], 'the longest folder name is named');
  assert.match(F.tooLongText(bad, file), /1 characters too long for Windows .*Nothing was written there/);
  assert.deepStrictEqual(F.pathCheck('', rel, file), { known: false, ok: true }, 'no root path typed: not checked');
  assert.strictEqual(F.pathCheck('C:\\a\\', rel, file).length, F.pathCheck('C:\\a', rel, file).length, 'a trailing backslash is ignored');
  // the case that failed on 17 and 18 November: 254 + 7 > 259 (invented names of the same lengths)
  assert.ok(!F.pathCheck(rootAt(160), ['x'.repeat(0)].slice(0, 0), 'y'.repeat(94)).ok, '160 + 1 + 94 = 255, +7 = 262: refused');
});

test('finding the client and the deal folder: one deal folder, in New Business', async () => {
  const A = new Dir('NewBusiness'), B = new Dir('ClientFiles');
  const k = A.add('Kuiper, Annabel'); std(k); k.add('Kuiper, Annabel'); k.add('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications'); A.add('Other, Client', 'x');
  const r = await F.resolveTarget(roots(A, B), info());
  assert.ok(r.pick && r.reason === 'only'); assert.strictEqual(F.labelOf(r.pick), 'Kuiper, Annabel \\ Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.) \\ Applications');
  assert.deepStrictEqual(F.relOf(r.pick), ['Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications']);
  assert.strictEqual(r.pick.apps, k.kids.get('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)').kids.get('Applications'));
});

test('the standard folders and the older unnamed folder are never deal folders, even when they hold an Applications folder', async () => {
  const A = new Dir('NewBusiness'), k = A.add('Kuiper, Annabel');
  STD.forEach(n => k.add(n, 'Applications')); k.add('Kuiper, Annabel', 'Applications');
  const r = await F.resolveTarget(roots(A), info());
  assert.strictEqual(r.reason, 'deal', 'no deal folder: the client’s folder is the deepest found'); assert.strictEqual(r.deepest, k);
});

test('two deal folders: a clear winner is used, a tie is a list', async () => {
  const A = new Dir('NewBusiness'), k = A.add('Kuiper, Annabel');
  k.add('Kuiper, Annabel - (OM - Optimal RA - Recurring - R 2,800.00 p.m.)', 'Applications'); k.add('Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications');
  let r = await F.resolveTarget(roots(A), info()); assert.ok(r.pick && r.pick.name.includes('BR - Personal') && r.reason === 'best');
  r = await F.resolveTarget(roots(A), info({ premium: 0 }));
  assert.ok(r.pick && r.pick.name.includes('BR - Personal'), 'insurer and product (6) still beat the other folder (0)');
  const B2 = new Dir('x'), k2 = B2.add('Kuiper, Annabel'); k2.add('Kuiper, Annabel - (BR - Personal - R 2,000.00 p.m.)', 'Applications'); k2.add('Kuiper, Annabel - (BR - Personal - R 3,000.00 p.m.)', 'Applications');
  r = await F.resolveTarget(roots(B2), info({ premium: 2507.64 })); assert.ok(r.ask && r.ask.length === 2, 'a tie');
});

test('a client under 1. ON HOLD or 2. Awaiting compliance in New Business, and under "J - Files" in Client Files', async () => {
  const A = new Dir('NewBusiness'), hold = A.add('1. ON HOLD'); hold.add('Kuiper, Annabel', 'Kuiper, Annabel - (Fact Find)', 'Applications'); A.add('2. Awaiting compliance from client').add('Jansen, Piet');
  let r = await F.resolveTarget(roots(A), info()); assert.ok(r.pick); assert.deepStrictEqual(F.relOf(r.pick).slice(0, 2), ['1. ON HOLD', 'Kuiper, Annabel']);
  const A2 = new Dir('NewBusiness'); A2.add('2. Awaiting compliance from client', 'Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal)', 'Applications');
  r = await F.resolveTarget(roots(A2), info()); assert.ok(r.pick, 'in the second folder');
  const B = new Dir('ClientFiles'); B.add('J - Files', 'Jansen, Edwin', 'Jansen, Edwin - (OM - Personal)', 'Applications'); B.add('K - Files', 'Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal)', 'Applications');
  r = await F.resolveTarget(roots(null, B), info()); assert.ok(r.pick); assert.deepStrictEqual(F.relOf(r.pick).slice(0, 2), ['K - Files', 'Kuiper, Annabel']);
  const B3 = new Dir('ClientFiles'); B3.add('V - Files', 'Van der Merwe, Mary', 'Van der Merwe, Mary - (OM - Personal)', 'Applications'); B3.add('V - Files', 'Van der Merwe, Anton', 'x', 'Applications');
  r = await F.resolveTarget(roots(null, B3), info({ sname: 'Van der Merwe', fname: 'Mary', insurers: F.insurerWords('Old Mutual', SRS.abbr), premium: 0 })); assert.ok(r.pick && r.pick.client.parts[1] === 'Van der Merwe, Mary', 'V - Files, and Mary not Anton');
  const B4 = new Dir('ClientFiles'); B4.add('M - Files', 'Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal)', 'Applications'); B4.add('K - Files', 'Someone, Else');
  r = await F.resolveTarget(roots(null, B4), info()); assert.ok(r.pick, 'last resort: the other letter folders');
  r = await F.resolveTarget(roots(A, B), info({ sname: 'Nobody', fname: 'Here' })); assert.strictEqual(r.reason, 'client', 'not found anywhere');
  r = await F.resolveTarget(roots(A, B), info({ sname: '', fname: '' })); assert.strictEqual(r.reason, 'names', 'no name filled in');
});

test('the same client in both places: the one whose deal folder matches wins; an unclear case is a list', async () => {
  const A = new Dir('NewBusiness'), B = new Dir('ClientFiles');
  A.add('Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications');
  B.add('K - Files', 'Kuiper, Annabel', 'Kuiper, Annabel - (OM - Optimal RA - Recurring - R 2,800.00 p.m.)', 'Applications');
  let r = await F.resolveTarget(roots(A, B), info()); assert.ok(r.pick && r.pick.client.rootKey === 'A' && r.reason === 'best', 'New Business: it matches');
  const B2 = new Dir('ClientFiles'); B2.add('K - Files', 'Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal - R 2,507.64 p.m.)', 'Applications');
  r = await F.resolveTarget(roots(A, B2), info()); assert.ok(r.ask && r.ask.length === 2, 'both match equally: the adviser picks');
  const B3 = new Dir('ClientFiles'); B3.add('K - Files', 'Kuiper, Annabel', 'Kuiper, Annabel - (BR - Personal)'); B3.add('K - Files', 'Kuiper, Annabel', '1. Overview');
  r = await F.resolveTarget(roots(A, B3), info()); assert.ok(r.pick && r.pick.client.rootKey === 'A', 'the history folder has no Applications folder: only New Business counts');
});

test('a loaded Fact Find inside a connected folder gives the client’s folder exactly (root.resolve), with no name matching', async () => {
  const A = new Dir('NewBusiness'), k = A.add('Kuiper, Annabel'); std(k); const ff = k.kids.get('2. Fact Find').addFile('Fact Find (Audio to Text) - 12.11.26 - (Annabel Kuiper).json', 100);
  k.add('Kuiper, Annabel - (BR - Personal)', 'Applications');
  const decoy = A.add('Zulu, Zandile'); decoy.add('Zulu, Zandile - (BR - Personal)', 'Applications');
  let r = await F.resolveTarget(roots(A), info({ sname: 'Kuiper-Botha', fname: 'Annabel Maria' }), { hints: [ff] });
  assert.ok(r.reason === 'client', 'the surname on the form differs and the file’s folder does not match it either: no folder');
  r = await F.resolveTarget(roots(A), info({ sname: 'Kuiper', fname: 'Annabel Maria' }), { hints: [ff] }); assert.ok(r.pick, 'from the file');
  const outside = new Dir('Elsewhere').addFile('x.json', 1);
  r = await F.resolveTarget(roots(A), info(), { hints: [outside] }); assert.ok(r.pick, 'a file outside the connected folders is ignored: the names are used');
  assert.deepStrictEqual(await F.clientFromFile(roots(A), ff, 'Kuiper', 'Annabel').then(x => x.map(c => c.parts)), [['Kuiper, Annabel']]);
});

test('the file: an existing file is found (and told apart from the one that was opened), a new one is created, an empty one the page created is removed after a failed write', async () => {
  const apps = new Dir('Applications'); const old = apps.addFile('a.json', 50);
  let p = await F.probeFile(apps, 'a.json', null); assert.deepStrictEqual([p.exists, p.same], [true, false]);
  p = await F.probeFile(apps, 'a.json', old); assert.deepStrictEqual([p.exists, p.same], [true, true], 'the file that was opened');
  p = await F.probeFile(apps, 'b.pdf', null); assert.deepStrictEqual([p.exists, p.same], [false, false]);
  const h = await F.makeFile(apps, 'b.pdf'); assert.ok(apps.kids.has('b.pdf') && h.bytes === 0);
  assert.strictEqual(await F.discardEmpty(apps, 'b.pdf'), true); assert.ok(!apps.kids.has('b.pdf'), 'the empty file this save created is removed');
  assert.strictEqual(await F.discardEmpty(apps, 'a.json'), false); assert.ok(apps.kids.has('a.json'), 'a file with content is never removed');
  assert.strictEqual(await F.discardEmpty(apps, 'missing.json'), false, 'nor does a missing one matter');
  const sub = apps.add('Sub'); assert.strictEqual(await F.discardEmpty(apps, 'Sub'), false); assert.ok(apps.kids.has('Sub'), 'a folder is never removed');
});

test('permission: granted is used, prompt is asked only when asked, denied and a refusal are reported', async () => {
  const mk = (q, r) => ({ queryPermission: async () => q, requestPermission: async () => { if (r === 'throw') throw new Error('no click'); return r; } });
  assert.strictEqual(await F.permission(mk('granted', 'denied'), true), 'granted');
  assert.strictEqual(await F.permission(mk('prompt', 'granted'), false), 'prompt', 'not asked without a click');
  assert.strictEqual(await F.permission(mk('prompt', 'granted'), true), 'granted');
  assert.strictEqual(await F.permission(mk('prompt', 'denied'), true), 'denied');
  assert.strictEqual(await F.permission(mk('prompt', 'throw'), true), 'denied', 'the browser refused to ask (no click): treated as not granted');
  assert.strictEqual(await F.permission({}, true), 'granted', 'a handle that cannot say (a test stand-in)');
});

test('what is kept in the browser holds no real path: the code has no Windows path of the adviser’s, and the settings start empty', () => {
  ['app/js/folders.js', 'app/js/folders-ui.js', 'app/js/sr-ui.js', 'app/js/cs-ui.js', 'app/short-risk.html', 'app/capture-sheet.html'].forEach(f => {
    const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/C:\\\\Users\\\\(Paul|[A-Za-z]+)\\\\[A-Za-z.]+/.test(s.replace(/C:\\\\Users\\\\<[^>]*>/g, '')), f + ' must not hold a real Windows path');
    assert.ok(!/liferisk/i.test(s), f + ' must not hold the adviser’s company domain');
  });
  assert.deepStrictEqual(F.getPaths(), {}, 'no localStorage in Node: nothing stored');
});
