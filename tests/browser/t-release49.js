/* (5.0 corrected 4.9's diagnosis: NotFoundError is the Windows path limit and is not retried: t-release50.js. This file pins the rest of 4.9 with an error that IS retried.)
   Release 4.9 on the real pages (Fact Find, Short Risk Application, Investment Capture Sheet): a file written into the adviser's folder is proved to have been written, tried again when OneDrive is in the way,
   and when it still fails the work is kept (a copy is downloaded) and the page says so in plain words, for long enough to read. The Save window and the folder are pretend ("a flaky OneDrive folder"):
   a handle whose close() fails with NotFoundError and leaves the file EMPTY, or "succeeds" and leaves it empty, exactly as in Paul's screenshots. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };

const PAGES = [
  { file: 'index.html', label: 'Fact Find', pdfBase: 'Fact Find (Audio to Text)', jsonKey: 'wr-fact-find' },
  { file: 'short-risk.html', label: 'Short Risk Application', pdfBase: ' Application - ', jsonKey: null },
  { file: 'capture-sheet.html', label: 'Investment Capture Sheet', pdfBase: ' Application - ', jsonKey: null }
];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  for (const pg of PAGES) {
    console.log('--- ' + pg.label);
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
    await p.goto('file://' + dir + '/' + pg.file); await p.waitForTimeout(500);
    /* the pretend folder: plan = what each write does ('ok', 'busy' = close() fails with a retryable error and the file is left empty, 'empty' = close() "succeeds" and the file is left empty) */
    await p.evaluate(() => {
      FF.util.WRITE_PAUSES = [20, 20];
      window.__picks = []; window.__abort = false; window.__plan = [];
      const nf = () => { const e = new Error('The object can not be modified in this way.'); e.name = 'InvalidModificationError'; return e; };
      const h = window.__h = { name: 'folder-file.x', bytes: new Uint8Array(0), attempts: 0 };
      h.requestPermission = () => Promise.resolve('granted');
      h.createWritable = () => {
        h.attempts++; const step = window.__plan.shift() || 'ok'; let pend = null;
        return Promise.resolve({ write: bl => bl.arrayBuffer().then(ab => { pend = new Uint8Array(ab); }), close: () => { if (step === 'busy') { h.bytes = new Uint8Array(0); return Promise.reject(nf()); } if (step === 'empty') { h.bytes = new Uint8Array(0); return Promise.resolve(); } h.bytes = pend; return Promise.resolve(); } });
      };
      h.getFile = () => Promise.resolve(new File([h.bytes], h.name));
      window.showSaveFilePicker = o => { window.__picks.push(o && o.suggestedName); if (window.__abort) { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; return Promise.reject(e); } if (/\.json$/i.test(o.suggestedName)) h.name = o.suggestedName; return Promise.resolve(h); };
    });
    const plan = (...a) => p.evaluate(a => { window.__plan = a.slice(); window.__h.attempts = 0; }, a);
    const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
    const head = () => p.evaluate(() => new TextDecoder('latin1').decode(window.__h.bytes.slice(0, 5)));
    const state = () => p.evaluate(() => ({ attempts: window.__h.attempts, len: window.__h.bytes.length, picks: window.__picks.length, name: window.__h.name }));
    const click = async id => { await p.click(id); await p.waitForTimeout(450); };

    /* 1. Save, OneDrive in the way on the first try: it is tried again and the file is whole */
    await plan('busy', 'ok');
    await click('#btnSave');
    let s = await state();
    ok(s.attempts === 2 && s.len > 50, 'Save: the first write failed, the second wrote the whole file (' + s.attempts + ' tries, ' + s.len + ' bytes)');
    ok((await toast()) === 'Saved.', 'Save: the page says Saved. only after that: "' + await toast() + '"');
    ok(downloads.length === 0, 'Save: no download copy was needed');
    const text = await p.evaluate(() => new TextDecoder().decode(window.__h.bytes));
    let parsed = null; try { parsed = JSON.parse(text); } catch (e) { }
    ok(!!parsed && !!parsed.app, 'Save: the file in the folder is the real saved file (' + (parsed && parsed.app) + ')');

    /* 2. Save PDF: "succeeds" but leaves an EMPTY file (the screenshot's damaged PDF), caught by the read-back and tried again */
    await plan('empty', 'ok');
    await click('#btnPdf'); await p.waitForTimeout(900);
    s = await state();
    ok(s.attempts === 2 && s.len > 1000 && (await head()) === '%PDF-', 'Save PDF: the empty file was caught and the PDF written on the second try (' + s.len + ' bytes, starts "' + await head() + '")');
    ok(/^PDF saved and checked \(\d/.test(await toast()), 'Save PDF: the page says it was checked, with the size: "' + await toast() + '"');
    ok(downloads.length === 0, 'Save PDF: no download copy was needed');

    /* 3. Save PDF: it never works: the work is kept (a copy is downloaded) and the page says plainly what happened, and keeps saying it */
    await plan('busy', 'busy', 'busy', 'ok');
    await click('#btnPdf'); await p.waitForTimeout(1100);
    s = await state();
    ok(s.attempts === 3, 'Save PDF: it tried three times and stopped (' + s.attempts + ')');
    ok(downloads.length === 1 && /\.pdf$/.test(downloads[0]), 'Save PDF: a copy was downloaded instead: ' + downloads.join(' | '));
    const t3 = await toast();
    ok(/^Could not save /.test(t3) && /OneDrive was busy syncing/.test(t3) && /downloaded to your Downloads folder/.test(t3) && /may now be EMPTY/.test(t3), 'Save PDF: the message says what happened and what to do');
    ok(/Chrome said: The object can not be modified/.test(t3), 'Save PDF: and shows what Chrome said, for whoever has to look into it');
    await p.screenshot({ path: out + '/r49-' + pg.file.replace('.html', '') + '-failtoast.png' });
    await p.waitForTimeout(4000);
    ok((await toast()) === t3, 'Save PDF: the message is still there after 5 seconds (it used to vanish after 3.5)');
    ok(!/Saved\./.test(t3) && !/checked/.test(t3), 'Save PDF: and it never says saved or checked');

    /* 4. Save, the folder file goes stale: the next Save does not keep failing on it, it asks where to save */
    await plan('ok');
    await click('#btnSave');
    s = await state(); const picksAfterOk = s.picks;
    ok(picksAfterOk === 3, 'Save: the first Save asked where to save, each PDF asked, and this second Save used the remembered file without a window (' + picksAfterOk + ' windows so far: 1 Save + 2 PDFs)');
    const before = (await state()).picks;
    await plan('busy', 'busy', 'busy', 'ok');
    await p.evaluate(() => { document.querySelector('#toast').hidden = true; });
    await click('#btnSave'); await p.waitForTimeout(600);
    ok(downloads.length === 2 && /\.json$/.test(downloads[1]) && !/\.pdf\.json$/.test(downloads[1]), 'Save: the failed Save downloaded a copy of the file, named like the saved file: ' + downloads[1]);
    ok(/^Could not save /.test(await toast()), 'Save: and says so');
    ok((await state()).picks === before, 'Save: that Save reused the remembered file (no window)');
    await plan('ok');
    await click('#btnSave'); await p.waitForTimeout(300);
    s = await state();
    ok(s.picks === before + 1, 'Save: the next Save let go of the failed file and opened the Save window again (' + before + ' -> ' + s.picks + ')');
    ok((await toast()) === 'Saved.' && s.len > 50, 'Save: and it saved');

    /* 5. Cancel in the Save window is silent: no message, no download */
    await p.evaluate(() => { window.__abort = true; document.querySelector('#toast').hidden = true; });
    const dl = downloads.length;
    await click('#btnSaveAs');
    ok(downloads.length === dl && !/Could not/.test(await toast()), 'Save as: Cancel in the Save window says nothing and downloads nothing: "' + await toast() + '"');
    await click('#btnPdf'); await p.waitForTimeout(500);
    ok(downloads.length === dl && !/Could not|saved/.test(await toast()), 'Save PDF: the same for the PDF');
    await p.evaluate(() => { window.__abort = false; });

    /* 6. A Chrome that gives no way to read the file back (no size) is trusted as before: the page still saves */
    await p.evaluate(() => { window.__h.getFile = () => Promise.resolve({ text: () => Promise.resolve(new TextDecoder().decode(window.__h.bytes)) }); });
    await plan('ok'); await click('#btnPdf'); await p.waitForTimeout(700);
    ok((await toast()) === 'PDF saved.', 'a handle that cannot be read back: the plain "PDF saved." as before: "' + await toast() + '"');

    ok(errs.length === 0, pg.label + ': no page errors ' + errs.join('|'));
    await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
