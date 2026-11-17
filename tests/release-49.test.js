/* Release 4.9: a file written into the adviser's folder is PROVED to have been written (read back: its size, and "%PDF-" at the start of a PDF), tried again when OneDrive is in the way, and when it still fails the work is kept
   (a copy is downloaded) and the page says so plainly. Why: on the Short Risk Application in a OneDrive folder, Chrome's save failed with "A requested file or directory could not be found at the time an operation was
   processed", the Save window had already created the file, and it stayed EMPTY: it looked saved and would not open. The same code is on the Fact Find and the Capture Sheet. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');

const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const nf = () => { const e = new Error('A requested file or directory could not be found at the time an operation was processed.'); e.name = 'NotFoundError'; return e; };
const named = (name, msg) => { const e = new Error(msg || name); e.name = name; return e; };

/* a stand-in for Chrome's file handle: plan says what each createWritable() does ('ok', 'fail' = close() fails and leaves the file empty, 'empty' = close() "succeeds" and leaves the file empty, 'short' = half the bytes) */
function handle(plan, o) {
  o = o || {};
  const h = { attempts: 0, bytes: new Uint8Array(0) };
  h.createWritable = () => {
    h.attempts++; const step = plan.shift() || 'ok'; let pending = null;
    if (step === 'denied') return Promise.reject(named('NotAllowedError'));
    return Promise.resolve({
      write: blob => blob.arrayBuffer().then(ab => { pending = new Uint8Array(ab); }),
      close: () => {
        if (step === 'fail') { h.bytes = new Uint8Array(0); return Promise.reject(nf()); }
        if (step === 'empty') { h.bytes = new Uint8Array(0); return Promise.resolve(); }
        if (step === 'short') { h.bytes = pending.slice(0, Math.floor(pending.length / 2)); return Promise.resolve(); }
        h.bytes = pending; return Promise.resolve();
      }
    });
  };
  if (!o.noGetFile) h.getFile = () => Promise.resolve(o.noSize ? { text: () => Promise.resolve('') } : { size: h.bytes.length, slice: (a, b) => ({ text: () => Promise.resolve(new TextDecoder('latin1').decode(h.bytes.slice(a, b))) }) });
  return h;
}
const pdfBlob = () => new Blob(['%PDF-1.3\nsample pdf bytes\n%%EOF'], { type: 'application/pdf' });
const jsonBlob = () => new Blob(['{"app":"wr-fact-find"}'], { type: 'application/json' });
const sleeper = () => { const s = []; return { calls: s, sleep: ms => { s.push(ms); return Promise.resolve(); } }; };

test('the version is 4.9 or later, and every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 4.9);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('a good write is read back and proved: size, and %PDF- for a PDF', async () => {
  const s = sleeper(), h = handle([]);
  const r = await util.writeVerified(h, pdfBlob(), { pdf: true, sleep: s.sleep });
  assert.deepStrictEqual([r.tries, r.checked, r.size], [1, true, pdfBlob().size]);
  assert.strictEqual(s.calls.length, 0, 'no pause, no second try');
  assert.strictEqual((await util.writeVerified(handle([]), jsonBlob(), { sleep: s.sleep })).checked, true);
});

test('OneDrive in the way: close() fails with NotFoundError, the file is left empty, and the second try writes it', async () => {
  const s = sleeper(), h = handle(['fail', 'ok']);
  const r = await util.writeVerified(h, pdfBlob(), { pdf: true, sleep: s.sleep });
  assert.strictEqual(h.attempts, 2); assert.strictEqual(r.tries, 2); assert.deepStrictEqual(s.calls, [800], 'one pause of 0.8 s');
  assert.strictEqual(new TextDecoder('latin1').decode(h.bytes.slice(0, 5)), '%PDF-', 'the file now holds the PDF');
});

test('a write that "succeeds" and leaves an EMPTY or short file is caught by the read-back and tried again', async () => {
  for (const bad of ['empty', 'short']) {
    const s = sleeper(), h = handle([bad, 'ok']);
    const r = await util.writeVerified(h, pdfBlob(), { pdf: true, sleep: s.sleep });
    assert.strictEqual(h.attempts, 2, bad); assert.strictEqual(h.bytes.length, pdfBlob().size, bad + ': the whole file is there now');
    assert.strictEqual(r.checked, true);
  }
});

test('it never says saved when it is not: after the last try it rejects with .failed, three tries, pauses of 0.8 s and 2 s', async () => {
  const s = sleeper(), h = handle(['fail', 'fail', 'fail', 'ok']);
  await assert.rejects(() => util.writeVerified(h, jsonBlob(), { sleep: s.sleep }), e => { assert.strictEqual(e.failed, true); assert.strictEqual(e.tries, 3); assert.strictEqual(e.name, 'NotFoundError'); assert.match(e.message, /could not be found/); return true; });
  assert.strictEqual(h.attempts, 3); assert.deepStrictEqual(s.calls, [800, 2000]);
  const h2 = handle(['empty', 'empty', 'empty']);
  await assert.rejects(() => util.writeVerified(h2, pdfBlob(), { pdf: true, sleep: sleeper().sleep }), e => e.failed === true && /0 bytes/.test(e.message), 'an empty file after three tries is a failure, not a save');
});

test('a file that has the right size but does not start like a PDF is a failure for a PDF only', async () => {
  const h = handle([]); h.getFile = () => Promise.resolve({ size: pdfBlob().size, slice: () => ({ text: () => Promise.resolve('ZZZZZ') }) });
  await assert.rejects(() => util.writeVerified(h, pdfBlob(), { pdf: true, sleep: sleeper().sleep }), e => e.failed === true && /does not start like a PDF/.test(e.message));
  const hj = handle([]); hj.getFile = () => Promise.resolve({ size: jsonBlob().size, slice: () => ({ text: () => Promise.resolve('ZZZZZ') }) });
  assert.strictEqual((await util.writeVerified(hj, jsonBlob(), { sleep: sleeper().sleep })).tries, 1, 'a saved file (.json) has no such check');
});

test('Cancel in the Save window and a refused permission are not locks: no second try, the error goes straight up', async () => {
  for (const name of ['AbortError', 'NotAllowedError', 'SecurityError']) {
    const s = sleeper(), h = { attempts: 0, createWritable: () => { h.attempts++; return Promise.reject(named(name)); } };
    await assert.rejects(() => util.writeVerified(h, jsonBlob(), { sleep: s.sleep }), e => e.name === name && !e.failed, name);
    assert.strictEqual(h.attempts, 1, name); assert.strictEqual(s.calls.length, 0, name);
  }
});

test('a browser or stand-in that will not say the size (or has no getFile) is trusted, not failed', async () => {
  const a = await util.writeVerified(handle([], { noSize: true }), pdfBlob(), { pdf: true, sleep: sleeper().sleep });
  assert.strictEqual(a.checked, false);
  const b = await util.writeVerified(handle([], { noGetFile: true }), jsonBlob(), { sleep: sleeper().sleep });
  assert.strictEqual(b.checked, false);
});

test('the pauses can be set (tests and the page use util.WRITE_PAUSES); the default is 0.8 s and 2 s', async () => {
  assert.deepStrictEqual(util.WRITE_PAUSES, [800, 2000]);
  const s = sleeper(), h = handle(['fail', 'fail', 'fail', 'fail', 'ok']);
  await assert.rejects(() => util.writeVerified(h, jsonBlob(), { pauses: [1, 2, 3], sleep: s.sleep }), e => e.failed && e.tries === 4);
  assert.deepStrictEqual(s.calls, [1, 2, 3], 'four tries when four pauses are given');
  const keep = util.WRITE_PAUSES; util.WRITE_PAUSES = [5]; const s2 = sleeper();
  await assert.rejects(() => util.writeVerified(handle(['fail', 'fail', 'ok']), jsonBlob(), { sleep: s2.sleep }), e => e.failed && e.tries === 2);
  util.WRITE_PAUSES = keep; assert.deepStrictEqual(s2.calls, [5]);
});

test('the plain words: size, and what the page says when the file could not be written', () => {
  assert.strictEqual(util.formatSize(500), '500 bytes'); assert.strictEqual(util.formatSize(86300), '84.3 KB'); assert.strictEqual(util.formatSize(2 * 1048576), '2 MB');
  const t = util.saveFailText('BR - Personal Covers Application - 17.11.26 - R 2,507.64 p.m. - (Annabel Kuiper van Wyk).pdf', nf(), true);
  assert.match(t, /^Could not save BR - Personal Covers Application/); assert.match(t, /OneDrive was busy syncing/); assert.match(t, /downloaded to your Downloads folder/); assert.match(t, /empty file with the same name may be left in the folder: delete it/);
  assert.match(t, /Chrome said: A requested file or directory could not be found at the time an operation was processed\./);
  assert.ok(!/Downloads/.test(util.saveFailText('x.pdf', nf(), false)), 'no claim of a download when there was none');
  assert.ok(!/Chrome said/.test(util.saveFailText('x.pdf', null, true)), 'and no "Chrome said" with no message');
});

test('all three pages write through util.writeVerified, say "checked" only after the check, and keep the work when a write fails', () => {
  ['ui.js', 'sr-ui.js', 'cs-ui.js'].forEach(f => {
    const s = app('js/' + f);
    assert.ok(s.includes("util.writeVerified(h, blob, { pdf: ext === '.pdf' })"), f + ': the write is proved');
    assert.ok(!/h\.createWritable\(\)\.then\(function \(w\) \{ return w\.write\(blob\)/.test(s), f + ': no bare write left');
    assert.ok(/function saveFailed\(e, blob, name\)[\s\S]{0,200}download\(blob, name\); toast\(util\.saveFailText\(name, e, true\), 20000\)/.test(s), f + ': a failed write downloads a copy and says so for 20 seconds');
    assert.ok(/PDF saved and checked \(/.test(s), f + ': the PDF toast says checked, with the size');
    assert.ok(!/toast\('Could not save: ' \+ e\.message\)/.test(s) && !/toast\('Could not save the PDF: ' \+ e\.message\)/.test(s), f + ': the old short cryptic message is gone');
    assert.ok(/fileHandle = null; rememberHandle\(null\)/.test(s), f + ': a file reference that failed is let go');
  });
  assert.ok(/saveFailed\(e, res\.blob, res\.fileName \+ '\.pdf'\)/.test(app('js/cs-ui.js')), 'the Capture Sheet questionnaire PDF too');
  assert.ok(/saveFailed\(e, blob, 'fact-find-voice-log-'/.test(app('js/ui.js')), 'and the Fact Find voice log');
});
