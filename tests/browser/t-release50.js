/* Release 5.0 on the real pages (Fact Find, Short Risk Application, Investment Capture Sheet): the failed saves were the WINDOWS PATH LIMIT (folders + file name + ".crswap" over 259 characters), not OneDrive.
   The pretend folder is Chrome's handle when the swap file cannot be made: close() throws NotFoundError ("A requested file or directory could not be found ...") and the file in the folder is left with 0 bytes.
   Checked on each page: (2) NotFoundError is tried ONCE, no waiting; (1) the message says the path is too long for Windows (260), that the work is kept in Downloads, and never blames OneDrive;
   (3) it says the file in the folder may now be EMPTY, the page counts the work as unsaved (the bar says so, the browser draft is kept) even when nothing had changed since the file was opened, and the next Save
   asks where to save; the same for Save as and for the PDF; a 0-byte read-back says the same; any OTHER error is still tried three times and keeps the OneDrive wording. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };

const PAGES = [{ file: 'index.html', label: 'Fact Find' }, { file: 'short-risk.html', label: 'Short Risk Application' }, { file: 'capture-sheet.html', label: 'Investment Capture Sheet' }];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  for (const pg of PAGES) {
    console.log('--- ' + pg.label);
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
    await p.goto('file://' + dir + '/' + pg.file); await p.waitForTimeout(500);
    /* plan = what each write does: 'ok'; 'fail' = close() throws NotFoundError and leaves the file EMPTY; 'empty' = close() "succeeds" and leaves it empty; 'short' = half the bytes;
       'busy' = close() throws another error (InvalidModificationError) and leaves it empty. Real default pauses (0.8 s, 2 s) stay on, so a needless retry would show as waiting. */
    await p.evaluate(() => {
      window.__picks = []; window.__plan = [];
      const err = (n, m) => { const e = new Error(m); e.name = n; return e; };
      const h = window.__h = { name: 'folder-file.json', bytes: new Uint8Array(0), attempts: 0 };
      h.requestPermission = () => Promise.resolve('granted');
      h.createWritable = () => {
        h.attempts++; const step = window.__plan.shift() || 'ok'; let pend = null;
        return Promise.resolve({
          write: bl => bl.arrayBuffer().then(ab => { pend = new Uint8Array(ab); }),
          close: () => {
            if (step === 'fail') { h.bytes = new Uint8Array(0); return Promise.reject(err('NotFoundError', 'A requested file or directory could not be found at the time an operation was processed.')); }
            if (step === 'busy') { h.bytes = new Uint8Array(0); return Promise.reject(err('InvalidModificationError', 'The object can not be modified in this way.')); }
            if (step === 'empty') { h.bytes = new Uint8Array(0); return Promise.resolve(); }
            if (step === 'short') { h.bytes = pend.slice(0, Math.floor(pend.length / 2)); return Promise.resolve(); }
            h.bytes = pend; return Promise.resolve();
          }
        });
      };
      h.getFile = () => Promise.resolve(new File([h.bytes], h.name));
      window.showSaveFilePicker = o => { window.__picks.push(o && o.suggestedName); if (/\.json$/i.test(o.suggestedName)) h.name = o.suggestedName; return Promise.resolve(h); };
    });
    const plan = (...a) => p.evaluate(a => { window.__plan = a.slice(); window.__h.attempts = 0; }, a);
    const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
    const st = () => p.evaluate(() => ({ attempts: window.__h.attempts, len: window.__h.bytes.length, picks: window.__picks.length, bar: document.querySelector('#saveState').textContent,
      draftDirty: Object.keys(localStorage).filter(k => /-draft-dirty$/.test(k)).map(k => localStorage.getItem(k)) }));
    const fast = async (id, ms) => { const t0 = Date.now(); await p.click(id); await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim(); }, null, { timeout: 8000 }).catch(() => { }); return Date.now() - t0; };
    const clear = () => p.evaluate(() => { const t = document.querySelector('#toast'); t.hidden = true; t.textContent = ''; });

    /* a good Save first, so the folder holds a good, remembered file and the page says nothing is unsaved (as when Paul has just opened a good file) */
    await plan('ok'); await p.click('#btnSave'); await p.waitForTimeout(500);
    let s = await st();
    ok(s.len > 50 && !/unsaved/.test(s.bar) && (await toast()) === 'Saved.', 'start: a good file is in the folder (' + s.len + ' bytes), remembered, the bar says: "' + s.bar + '"');
    const good = s.len; const picksBefore = s.picks;

    /* 1. Save again with NOTHING changed: the folder is the Windows path limit: close() throws NotFoundError and the good file is emptied */
    await clear(); await plan('fail');
    const ms = await fast('#btnSave'); await p.waitForTimeout(150);
    s = await st(); const t1 = await toast();
    ok(s.attempts === 1, 'Save: NotFoundError is tried ONCE (' + s.attempts + ')');
    ok(ms < 700, 'Save: and the message came at once, not after the 0.8 s and 2 s pauses (' + ms + ' ms)');
    ok(s.len === 0, 'Save: the stand-in has emptied the good file in the folder (' + good + ' -> ' + s.len + ' bytes), as Chrome did');
    ok(/^Windows could not save /.test(t1) && /the folder path and file name together are too long \(Windows allows 260 characters\)/.test(t1), 'Save: the message tells the truth: the path is too long for Windows: "' + t1.slice(0, 150) + '..."');
    ok(/Your work is kept: a copy is in your Downloads folder\./.test(t1) && /Ask Claude to put it in the client’s folder, or save it in a folder with a shorter name/.test(t1), 'Save: the work is kept and what to do is said');
    ok(/The file in the folder may now be EMPTY: do not use it\./.test(t1), 'Save: and that the file in the folder may now be EMPTY');
    ok(!/OneDrive|syncing/i.test(t1), 'Save: OneDrive is not blamed');
    ok(/Chrome said: A requested file or directory could not be found/.test(t1) && /File name: \d+ characters/.test(t1), 'Save: what Chrome said and the length of the file name are shown for whoever looks into it');
    ok(downloads.length === 1 && /\.json$/.test(downloads[0]), 'Save: a copy of the file was downloaded: ' + downloads[0]);
    ok(/unsaved changes/.test(s.bar), 'Save: the bar says unsaved changes although nothing had changed since the last save: "' + s.bar + '"');
    ok(s.draftDirty.length === 1 && s.draftDirty[0] === '1', 'Save: the browser draft is kept (' + JSON.stringify(s.draftDirty) + ')');
    await p.screenshot({ path: out + '/r50-' + pg.file.replace('.html', '') + '-pathtoast.png' });

    /* the next Save does not fail on the same file again: it asks where to save, and then the page is saved */
    await clear(); await plan('ok');
    await p.click('#btnSave'); await p.waitForTimeout(500);
    s = await st();
    ok(s.picks === picksBefore + 1, 'the next Save let the failed file go and opened the Save window (' + picksBefore + ' -> ' + s.picks + ')');
    ok((await toast()) === 'Saved.' && s.len > 50 && !/unsaved/.test(s.bar) && s.draftDirty.every(v => v === '0'), 'and it saved: "' + await toast() + '", ' + s.len + ' bytes, bar "' + s.bar + '", draft ' + JSON.stringify(s.draftDirty));

    /* 2. Save as, same failure: same message, a copy downloaded, unsaved */
    await clear(); await plan('fail');
    await p.click('#btnSaveAs'); await p.waitForTimeout(600);
    s = await st(); const t2 = await toast();
    ok(s.attempts === 1 && /^Windows could not save .*too long/.test(t2) && /EMPTY/.test(t2) && !/OneDrive/.test(t2), 'Save as: one try, the path message, EMPTY, no OneDrive');
    ok(downloads.length === 2 && /unsaved changes/.test(s.bar), 'Save as: a copy downloaded, and the bar says unsaved: "' + s.bar + '"');

    /* 3. Save PDF, same failure */
    await clear(); await plan('fail');
    const msPdf = await fast('#btnPdf'); await p.waitForTimeout(200);
    s = await st(); const t3 = await toast();
    ok(s.attempts === 1 && msPdf < 1500, 'Save PDF: NotFoundError is tried once and the message comes at once (' + s.attempts + ' try, ' + msPdf + ' ms)');
    ok(/^Windows could not save .*\.pdf: the folder path and file name together are too long/.test(t3) && /may now be EMPTY/.test(t3) && !/OneDrive|checked/.test(t3), 'Save PDF: the path message for the .pdf, EMPTY, no OneDrive, not "checked"');
    ok(downloads.length === 3 && /\.pdf$/.test(downloads[2]), 'Save PDF: the PDF was downloaded as a copy: ' + downloads[2]);

    /* 4. a read-back that finds 0 bytes (the write "worked" and the file is empty): the same message, after three tries */
    await p.evaluate(() => { FF.util.WRITE_PAUSES = [20, 20]; });
    await clear(); await plan('empty', 'empty', 'empty');
    await p.click('#btnPdf'); await p.waitForTimeout(1000);
    s = await st(); const t4 = await toast();
    ok(s.attempts === 3 && /^Windows could not save .*too long/.test(t4) && /may now be EMPTY/.test(t4) && !/OneDrive/.test(t4), 'a 0-byte read-back: three tries, then the path message (' + s.attempts + ')');

    /* 5. a file that is only partly written (not empty) is NOT the path message: it keeps the OneDrive wording */
    await clear(); await plan('short', 'short', 'short');
    await p.click('#btnPdf'); await p.waitForTimeout(1000);
    s = await st(); const t5 = await toast();
    ok(s.attempts === 3 && /^Could not save .* into that folder\. This can mean OneDrive was busy syncing it\./.test(t5) && /may now be EMPTY/.test(t5) && !/260|too long/.test(t5), 'a partly written file: three tries, the OneDrive wording, no path wording');

    /* 6. any OTHER error is still tried three times, with the OneDrive wording */
    await clear(); await plan('busy', 'busy', 'busy', 'ok');
    await p.click('#btnPdf'); await p.waitForTimeout(1000);
    s = await st(); const t6 = await toast();
    ok(s.attempts === 3 && /^Could not save .* into that folder\. This can mean OneDrive was busy syncing it\./.test(t6) && /Chrome said: The object can not be modified/.test(t6) && !/Windows could not|260/.test(t6), 'another error: three tries and the OneDrive wording only here');
    await clear(); await plan('busy', 'ok');
    await p.click('#btnPdf'); await p.waitForTimeout(700);
    s = await st();
    ok(s.attempts === 2 && /^PDF saved and checked \(/.test(await toast()), 'another error that clears on the second try: the PDF is saved and checked');

    /* 7. on a phone the long message stays inside the screen */
    await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
    await clear(); await plan('fail');
    await fast('#btnPdf'); await p.waitForTimeout(200);
    const box = await p.evaluate(() => { const t = document.querySelector('#toast'), r = t.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth }; });
    ok(box.l >= -1 && box.r <= box.w + 1 && box.t >= 0 && box.b <= box.h + 1 && box.sw <= box.w + 1, 'at 390 wide the whole message is on the screen (' + JSON.stringify(box) + ')');
    await p.screenshot({ path: out + '/r50-' + pg.file.replace('.html', '') + '-pathtoast-phone.png' });

    ok(errs.length === 0, pg.label + ': no page errors ' + errs.join('|'));
    await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
