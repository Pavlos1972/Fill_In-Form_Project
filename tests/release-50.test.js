/* Release 5.0 (the Fix Skills chat asked for "4.10"; the form compares versions as decimals, so the number after 4.9 is 5.0).
   The failed saves of 17 and 18 November were measured on the adviser's computer: it is the WINDOWS PATH LIMIT, not OneDrive. Chrome writes "<file>.crswap" (7 characters longer than the file) beside the file; when the
   folders + the file name + ".crswap" come to more than 259 characters, close() fails with NotFoundError every time, and the file in the folder (the good one, or the one the Save window just made) is left EMPTY.
   (Real example: 160 characters of folders + "\\BR - Personal Covers Application - 17.11.26 - R 2,507.64 p.m. - (<name>).json" = 254, with ".crswap" = 261.)
   Pinned here: (1) the message tells the truth and does not blame OneDrive for NotFoundError, (2) NotFoundError is never retried, (3) the message says the folder copy may be EMPTY and a failed Save counts as unsaved,
   (4) the same on all three pages. The browser side is tests/browser/t-release50.js. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');

const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const named = (name, msg) => { const e = new Error(msg || name); e.name = name; return e; };
const MSG = 'A requested file or directory could not be found at the time an operation was processed.';
const nf = () => named('NotFoundError', MSG);
const sleeper = () => { const s = []; return { calls: s, sleep: ms => { s.push(ms); return Promise.resolve(); } }; };
const pdfBlob = () => new Blob(['%PDF-1.3\nsample\n%%EOF'], { type: 'application/pdf' });
const jsonBlob = () => new Blob(['{"app":"wr-fact-find"}'], { type: 'application/json' });
/* Chrome's handle when the swap file cannot be made: close() throws NotFoundError and the file is left with 0 bytes (and, as the screenshots showed, a good file that was there is emptied too) */
function longPathHandle(o) {
  o = o || {};
  const h = { attempts: 0, bytes: new Uint8Array(o.before || 0) };
  h.createWritable = () => { h.attempts++; return Promise.resolve({ write: () => Promise.resolve(), close: () => { h.bytes = new Uint8Array(0); return Promise.reject(nf()); } }); };
  h.getFile = () => Promise.resolve({ size: h.bytes.length, slice: () => ({ text: () => Promise.resolve('') }) });
  return h;
}

test('the version is 5.0 or later (not 4.10: the form compares versions as decimals), and every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 5.0, schema.version);
  assert.ok(parseFloat('4.10') < parseFloat('4.9'), 'why 4.10 cannot be used');
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('point 2: NotFoundError is NOT retried: one try, no pause, rejects at once with .failed', async () => {
  const s = sleeper(), h = longPathHandle({ before: 2000 });
  const t0 = Date.now();
  await assert.rejects(() => util.writeVerified(h, jsonBlob(), { sleep: s.sleep }), e => { assert.strictEqual(e.failed, true); assert.strictEqual(e.name, 'NotFoundError'); assert.strictEqual(e.tries, 1); assert.strictEqual(e.message, MSG); return true; });
  assert.strictEqual(h.attempts, 1, 'written once');
  assert.deepStrictEqual(s.calls, [], 'no pause at all: the pauses would only delay the message');
  assert.ok(Date.now() - t0 < 500, 'and no real waiting either');
  assert.strictEqual(h.bytes.length, 0, 'the stand-in leaves the file empty, as Chrome did');
  await assert.rejects(() => util.writeVerified(longPathHandle(), pdfBlob(), { pdf: true, sleep: s.sleep }), e => e.failed === true && e.tries === 1, 'a PDF too');
});

test('every OTHER failure is still retried (three tries), and Cancel / refused permission still go straight up', async () => {
  let n = 0; const s = sleeper();
  const h = { createWritable: () => { n++; return Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.reject(named('InvalidModificationError', 'The object can not be modified in this way.')) }); } };
  await assert.rejects(() => util.writeVerified(h, jsonBlob(), { sleep: s.sleep }), e => e.failed === true && e.tries === 3 && e.name === 'InvalidModificationError');
  assert.strictEqual(n, 3); assert.deepStrictEqual(s.calls, [800, 2000]);
  for (const name of ['AbortError', 'NotAllowedError', 'SecurityError']) {
    const g = { createWritable: () => Promise.reject(named(name)) };
    await assert.rejects(() => util.writeVerified(g, jsonBlob(), { sleep: s.sleep }), e => e.name === name && !e.failed, name);
  }
});

test('a read-back that finds 0 bytes is marked .zero (and is tried again, like any other unproven write); a partly written file is not', async () => {
  const mk = bytes => ({ createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }), getFile: () => Promise.resolve({ size: bytes, slice: () => ({ text: () => Promise.resolve('') }) }) });
  await assert.rejects(() => util.writeVerified(mk(0), jsonBlob(), { sleep: sleeper().sleep }), e => e.failed === true && e.tries === 3 && e.zero === true && /0 bytes/.test(e.message));
  await assert.rejects(() => util.writeVerified(mk(5), jsonBlob(), { sleep: sleeper().sleep }), e => e.failed === true && !e.zero);
});

test('point 1: for NotFoundError (and a 0-byte read-back) the message tells the truth: the path is too long for Windows, the work is kept, and OneDrive is NOT blamed', () => {
  const name = 'BR - Personal Covers Application - 17.11.26 - R 2,507.64 p.m. - (Annabel Kuiper van Wyk).json';
  const zero = Object.assign(named('VerifyError', 'The file in the folder is 0 bytes, not the 22 that were written.'), { zero: true });
  [nf(), zero].forEach(err => {
    assert.strictEqual(util.saveFailKind(err), 'path');
    const t = util.saveFailText(name, err, true);
    assert.ok(t.startsWith('Windows could not save ' + name + ': '), t);
    assert.match(t, /the folder path and file name together are too long \(Windows allows 260 characters\)/);
    assert.match(t, /or the folder was moved or renamed/, 'the other thing NotFoundError can mean');
    assert.match(t, /Your work is kept: a copy is in your Downloads folder\./);
    assert.match(t, /Ask Claude to put it in the client’s folder, or save it in a folder with a shorter name\./);
    assert.ok(!/OneDrive|syncing/i.test(t), 'OneDrive is not blamed: ' + t);
    assert.ok(!/delete it/.test(t) && !/Could not save /.test(t), 'none of the 4.9 wording');
  });
  assert.match(util.saveFailText(name, nf(), true), /\(File name: 93 characters\. Chrome said: A requested file or directory could not be found at the time an operation was processed\.\)$/, 'the length of the file name, and what Chrome said, for whoever looks into it');
  const noCopy = util.saveFailText(name, nf(), false);
  assert.ok(!/Downloads/.test(noCopy) && /Your work is kept in this page: do not close it/.test(noCopy), 'no claim of a download when there was none');
});

test('point 1: the OneDrive wording is kept only for other errors, and says "can mean", not "usually means"', () => {
  const t = util.saveFailText('x.json', named('InvalidModificationError', 'The object can not be modified in this way.'), true);
  assert.strictEqual(util.saveFailKind(named('InvalidModificationError')), 'other'); assert.strictEqual(util.saveFailKind(null), 'other'); assert.strictEqual(util.saveFailKind(named('VerifyError', 'short')), 'other');
  assert.match(t, /^Could not save x\.json into that folder\. This can mean OneDrive was busy syncing it\./);
  assert.match(t, /A copy was downloaded to your Downloads folder instead: move it into the client’s folder\./);
  assert.ok(!/260|too long|Windows could not/.test(t), 'and none of the path wording');
});

test('point 3: BOTH messages say the file in the folder may now be EMPTY and not to use it', () => {
  [nf(), named('InvalidModificationError', 'x'), null].forEach(err => assert.match(util.saveFailText('a.pdf', err, true), /The file in the folder may now be EMPTY: do not use it\./));
});

test('point 3 and 4: all three pages mark a failed Save as UNSAVED with the draft kept, forget the failed file, and use the one message', () => {
  ['ui.js', 'sr-ui.js', 'cs-ui.js'].forEach(f => {
    const s = app('js/' + f);
    assert.ok(/if \(saveFailed\(e, blob, currentBase\(\) \+ '\.json'\)\) \{ if \(!forceAs && fileHandle\) \{ fileHandle = null; (lastFolder = null; )?rememberHandle\(null\); \} dirty = true; onDisk = false; saveDraft\(\); \} refreshChrome\(\);/.test(s), f + ': a failed Save is unsaved, its draft is kept, the failed file is let go');
    assert.ok(/function saveFailed\(e, blob, name\)[\s\S]{0,200}download\(blob, name\); toast\(util\.saveFailText\(name, e, true\), 20000\)/.test(s), f + ': the copy is downloaded and the message stays 20 seconds');
    assert.ok(/util\.writeVerified\((h|x\.handle), blob, \{ pdf: ext === '\.pdf' \}\)/.test(s), f + ': written through util.writeVerified');
    assert.ok(!/OneDrive/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), f + ': no OneDrive wording in the page code itself');
  });
});

test('the path limit in numbers (so the next session need not ask): the three pages\' longest names and the characters left for the folders', () => {
  const SR = require('../app/js/sr-store.js'), CS = require('../app/js/cs-store.js'), FF = require('../app/js/store.js');
  const s = SR.blank(); SR.setField(s, 'insurer', 'BrightRock'); SR.setField(s, 'product', 'Personal Covers'); SR.setField(s, 'premium', '2507.64'); SR.setField(s, 'fname', 'Annabel'); SR.setField(s, 'sname', 'Kuiper van Wyk'); SR.setField(s, 'date', '17/11/2026');
  const sr = SR.pdfFileName(s) + '.json';
  const c = CS.blank(); [['fname', 'Annabel'], ['sname', 'Kuiper van Wyk'], ['date', '17/11/2026'], ['provider', 'Old Mutual'], ['product', 'Retirement Annuity'], ['product_name', 'OM RA - Xtra Max 8.5%'], ['contrib_type', 'Lump sum'], ['amount', '1250000']].forEach(([k, v]) => CS.setField(c, k, v));
  const cs = CS.pdfFileName(c) + '.json';
  const f = FF.blank(); FF.setField(f, 'fname', 'Annabel'); FF.setField(f, 'sname', 'Kuiper van Wyk');
  const ff = FF.pdfFileName(f) + '.json';
  assert.ok(sr.length > ff.length + 20 && cs.length > ff.length + 15, 'the Short Risk and Capture Sheet names are much longer than the Fact Find\'s: ' + [sr.length, cs.length, ff.length]);
  const LIMIT = 259, SWAP = '.crswap'.length;
  assert.strictEqual(LIMIT - SWAP - sr.length - 1 < 160, true, 'with a 160-character folder the Short Risk file for this client no longer fits (' + (160 + 1 + sr.length + SWAP) + ' > ' + LIMIT + ')');
});
