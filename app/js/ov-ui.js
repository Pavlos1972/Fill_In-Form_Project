/* The Client Overview screen (stages 2 to 4: the entry page, the PDF and saving into the client's folder, the documents). A left menu of the eleven blocks with a dot each (green complete, amber needs a look, grey waiting for a document), one block at a time, the figures the page
   works out (totals, the shortfall, "compared with what you have now") drawn from ov-calc.js, the checks from ov-check.js, saving and opening the overview's own file, and the pre-fill from the Fact Find.
   Amounts never wrap and there is no sideways scroll bar: the tables use fixed columns. Typing is kept at once; the figures and the dots follow without redrawing the boxes (so the cursor stays where it is). */
(function () {
  var FF = window.FF, OV = window.OV, util = FF.util, schema = OV.schema, calc = OV.calc, store = OV.store, check = OV.check;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DRAFT_KEY = 'wr-overview-draft', CLIENT = '_client';
  /* The View buttons (0.95): a document-backed item's button, or nothing where it has no document; painted after every draw so a greyed one says why. */
  function vb(path) { return OV.view ? OV.view.button(state, path, 'studio') : ''; }
  function paintView() { if (OV.view) OV.view.paint(); }

  var openSet = {}, openDefault = false, recent = {}, checksOpen = false, checksInner = false, NOTICE_MS = 10000;      // See more (the items that are open) and the removed notices: only for this visit, never in the saved file
  var state, cur = CLIENT, fileHandle = null, ffHandle = null, forceNormal = false, lastFolder = null, fileBase = '', dirty = false, onDisk = true, lastSaved = null, toastTimer = null, draftHold = false, last = { problems: [], dots: {}, byBlock: {} };

  /* ---------- drafts, saving and opening (the Fact Find's way: a safety copy in the browser while work is unsaved, removed once a file is saved and read back) ---------- */
  function saveDraft() {
    if (draftHold) return;
    try {
      if (!dirty && onDisk) { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_KEY + '-file'); localStorage.setItem(DRAFT_KEY + '-dirty', '0'); return; }
      localStorage.setItem(DRAFT_KEY, store.toJSON(state)); localStorage.setItem(DRAFT_KEY + '-file', fileBase); localStorage.setItem(DRAFT_KEY + '-dirty', dirty ? '1' : '0');
    } catch (e) { /* storage unavailable */ }
  }
  function idb(fn) {
    return new Promise(function (resolve) {
      try {
        var rq = indexedDB.open('wr-overview', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('h'); };
        rq.onsuccess = function () { try { fn(rq.result.transaction('h', 'readwrite').objectStore('h'), resolve); } catch (e) { resolve(null); } };
        rq.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function rememberHandle(h) { return idb(function (st, done) { var r = h ? st.put(h, 'current') : st.delete('current'); r.onsuccess = function () { done(true); }; r.onerror = function () { done(null); }; }); }
  function recallHandle() { return idb(function (st, done) { var r = st.get('current'); r.onsuccess = function () { done(r.result || null); }; r.onerror = function () { done(null); }; }); }
  function loadDraft() { try { var t = localStorage.getItem(DRAFT_KEY); return t ? store.fromJSON(t) : null; } catch (e) { return null; } }
  function touch() { dirty = true; onDisk = false; saveDraft(); refreshChrome(); }
  var toastAct = null, toastActs = [];
  function toast(msg, ms) { var t = $('#toast'); toastAct = null; toastActs = []; t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); }
  /* A message with a link in it (reading needs the key: "Add the key in Settings"). */
  function toastLinks(msg, links, ms) { var t = $('#toast'); t.innerHTML = esc(msg) + links.map(function (l, i) { return ' <button type="button" class="lnk" data-toastlink="' + i + '">' + esc(l.text) + '</button>'; }).join(''); toastAct = null; toastActs = links.map(function (l) { return l.fn; }); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 8000); }
  function toastLink(msg, linkText, fn, ms) { toastLinks(msg, [{ text: linkText, fn: fn }], ms); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  var lastWritten = null;
  /* What the folder search needs to know (folders.js): the client, and the year the overview goes under (1. Overview\<year>). */
  function folderInfo() { return { kind: 'overview', sname: state.header.sname, fname: state.header.fname, year: schema.yearOf(state), kinds: [schema.yearOf(state)] }; }
  /* Chrome's "Save as" window where there is one, otherwise a plain download; with a remembered file it writes straight back to it. For a first Save (o.auto) the client's folder is looked for first (Folders…): the file goes
     into 1. Overview\<year> (made if it is missing), or the normal Save window opens with the reason. Written, read back and proved (util.writeVerified). */
  function writeFile(blob, name, type, ext, handle, id, startIn, o) {
    o = o || {}; lastWritten = null; if (!handle) lastFolder = null;
    if (!window.showSaveFilePicker) { download(blob, name); return Promise.resolve(null); }
    var accept = {}, open, FU = window.FF && FF.foldersUI; accept[blob.type] = [ext];
    var picker = function (start) { var po = { suggestedName: name, types: [{ description: type, accept: accept }] }; if (start || startIn) po.startIn = start || startIn; else po.id = id; return window.showSaveFilePicker(po); };
    if (handle) open = Promise.resolve(handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : 'granted').then(function (p) { if (p !== 'granted') throw new Error('Chrome did not allow changes to that file.'); return { handle: handle }; });
    else if (o.auto && FU && !forceNormal) open = FU.open({ kind: 'overview', info: folderInfo(), name: name, hints: [ffHandle].filter(Boolean), sibling: o.sibling || null, openedHandle: fileHandle, picker: picker, toast: toast, startedAt: Date.now(),
      retry: function () { forceNormal = true; $(ext === '.pdf' ? '#btnPdf' : '#btnSave').click(); } });
    else { forceNormal = false; open = picker().then(function (h) { return { handle: h }; }); }
    return open.then(function (x) {
      return util.writeVerified(x.handle, blob, { pdf: ext === '.pdf' }).then(function (r) { lastWritten = r; lastFolder = x.folder ? x.folder.label : (handle ? lastFolder : null); return x.handle; }, function (e) { if (x.folder) FU.failed(x.folder); throw e; });
    });
  }
  function saveFailed(e, blob, name) {
    if (!e || e.name === 'AbortError') return false;
    download(blob, name); toast(util.saveFailText(name, e, true), 20000);
    return true;
  }
  function currentBase() { return fileBase || store.fileName(state); }
  function readBack(h, text) {
    if (!h || !h.getFile) return Promise.resolve('unchecked');
    return h.getFile().then(function (f) { return f.text(); }).then(function (t) { return t === text ? 'ok' : 'different'; }, function () { return 'unchecked'; });
  }
  function saveJson(forceAs) {
    if (state.newer) { toast('This file was made by a newer version, so it is read-only here.', 6000); return; }
    var text = store.toJSON(state), blob = new Blob([text], { type: 'application/json' });
    writeFile(blob, currentBase() + '.json', 'Client Overview', '.json', forceAs ? null : fileHandle, 'overview-data', fileHandle, { auto: !forceAs }).then(function (h) {
      if (h) { fileHandle = h; fileBase = h.name.replace(/\.json$/i, ''); rememberHandle(h); } else if (!fileBase) fileBase = currentBase();
      return readBack(h, text).then(function (v) {
        if (v === 'different') { refreshChrome(); toast('The saved file does not match the overview, so your work is still kept here. Try Save again.', 7000); return; }
        dirty = false; onDisk = v === 'ok'; lastSaved = new Date(); saveDraft(); refreshChrome(); toast(lastFolder ? 'Saved to ' + lastFolder + '. Wrong folder? Use Save as\u2026' : 'Saved.', lastFolder ? 9000 : 0);
      });
    }).catch(function (e) { if (saveFailed(e, blob, currentBase() + '.json')) { if (!forceAs && fileHandle) { fileHandle = null; lastFolder = null; rememberHandle(null); } dirty = true; onDisk = false; saveDraft(); } refreshChrome(); });
  }
  function pdfName() { return schema.fileName(state) + '.pdf'; }
  function makePdf() { return OV.pdf.build(state); }
  /* The PDF goes beside the saved file (the same year folder); a first PDF finds the client's folder like a first Save. */
  function savePdf() {
    var blob = makePdf().output('blob');
    writeFile(blob, pdfName(), 'PDF document', '.pdf', null, 'overview-pdf', fileHandle, { auto: true, sibling: fileHandle })
      .then(function () { toast((lastWritten && lastWritten.checked ? 'PDF saved and checked (' + util.formatSize(lastWritten.size) + ').' : 'PDF saved.') + (lastFolder ? ' Saved in ' + lastFolder + '.' : ''), lastFolder ? 9000 : 0); drawMeta(); })
      .catch(function (e) { saveFailed(e, blob, pdfName()); });
  }
  function previewPdf() {
    var blob = makePdf().output('blob'), url = URL.createObjectURL(blob), w = window.open(url, '_blank');
    if (!w) download(blob, pdfName());
  }
  function openFile(file, handle) {
    var r = new FileReader();
    r.onload = function () {
      try {
        state = store.fromJSON(r.result); var healed = check.settleAll(state); fileHandle = handle || null; lastFolder = null; fileBase = file.name.replace(/\.json$/i, ''); dirty = false; onDisk = true; cur = CLIENT; progClear(); rememberHandle(handle || null); saveDraft(); redraw();
        var tidy = [state.dups ? state.dups + (state.dups === 1 ? ' extra copy of a quote was' : ' extra copies of a quote were') + ' removed (each quote is kept once)' : '', state.flattened ? state.flattened + (state.flattened === 1 ? ' policy of another insurer was' : ' policies of other insurers were') + ' put into one row with its benefits' : '', healed ? 'older quote lines were brought up to date (checked by the quote, no empty income portions, no life cover on the additional expense line)' : ''].filter(Boolean).join('; ');
        if (tidy) { dirty = true; onDisk = false; saveDraft(); refreshChrome(); }
        toast(state.newer ? 'Opened ' + file.name + ' read-only: it was made by a newer version.' : 'Opened ' + file.name + (tidy ? '. ' + tidy.charAt(0).toUpperCase() + tidy.slice(1) + '; save to keep it.' : ''), state.newer ? 7000 : tidy ? 9000 : 3500);
      } catch (e) { toast(e.message || 'Could not open that file.', 6000); }
    };
    r.readAsText(file);
  }
  function chooseFile() {
    if (!window.showOpenFilePicker) { $('#fileIn').click(); return; }
    window.showOpenFilePicker({ id: 'overview-data', types: [{ description: 'Client Overview', accept: { 'application/json': ['.json'] } }] })
      .then(function (hs) { return hs[0].getFile().then(function (f) { openFile(f, hs[0]); }); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open: ' + e.message); });
  }
  /* Fill from Fact Find: the client's saved Fact Find (or the one on screen, through the hand-over) is read, never changed. */
  function fillFactFind(text, name, quiet) {
    try {
      checksOpen = false; checksInner = false; var rep = store.fillFromFactFind(state, text, name); check.settleAll(state); touch(); redraw(); checkPass(); readFactNotes();
      var bits = [];
      if (rep.added) bits.push(rep.added + (rep.added === 1 ? ' item' : ' items') + ' added');
      if (rep.updated) bits.push(rep.updated + ' brought up to date');
      toast((bits.length ? 'From the Fact Find: ' + bits.join(', ') + '. Each waits for its document.' : 'Nothing new to fill from the Fact Find.') + (!rep.first && rep.changed ? ' The Fact Find changed: ' + rep.changed + (rep.changed === 1 ? ' item.' : ' items.') : '') +
        (rep.kept.length ? ' Left as typed: ' + rep.kept.join(', ') + '.' : ''), 9000);
      return rep;
    } catch (e) { if (!quiet) toast(e.message || 'Could not read that Fact Find.', 6000); return null; }
  }
  function chooseFactFind() {
    if (!window.showOpenFilePicker) { $('#ffIn').click(); return; }
    window.showOpenFilePicker({ id: 'fact-find-data', types: [{ description: 'Fact Find', accept: { 'application/json': ['.json'] } }] })
      .then(function (hs) { return hs[0].getFile().then(function (f) { ffHandle = hs[0]; var r = new FileReader(); r.onload = function () { fillFactFind(r.result, f.name); }; r.readAsText(f); }); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open: ' + e.message); });
  }
  function newOverview() {
    if (dirty && !window.confirm('Start a new overview? Changes you have not saved will be lost.')) return;
    state = store.blank(); fileHandle = null; ffHandle = null; fileBase = ''; rememberHandle(null); lastFolder = null; dirty = false; onDisk = true; lastSaved = null; cur = CLIENT; progClear(); saveDraft(); redraw();
  }

  /* The next review: this overview's client, policies, group benefits, investments and other cover carry over (each to be checked); the quotes start empty. Last year's file is not touched, so it must be saved first. */
  function newReview() {
    if (state.newer) { toast('This overview was made by a newer version of the page: a review cannot be started from it here.', 6000); return; }
    if (dirty) { toast('Save this overview first, so that last year\'s file is kept as it is.', 6000); return; }
    if (!window.confirm('Start the next review from this overview?\n\nThis overview stays as it is. The new one carries over the client, the policies, group benefits, investments and other cover (each marked to be checked against the latest schedule or statement); the quotes (the new FNA replaces last year\'s), the proposals and the documents start empty. Its date is today.')) return;
    var r = store.startReview(state, schema.todayDMY()), c = r.carried;
    state = r.state; fileHandle = null; ffHandle = null; fileBase = ''; rememberHandle(null); lastFolder = null; dirty = true; onDisk = false; lastSaved = null; cur = CLIENT; saveDraft(); redraw();
    toast('A new review is started: ' + (c.policies + c.group + c.investments + c.other + c.goals) + ' items carried over from the overview of ' + (state.header.previous.date || 'last year') + ', waiting for the latest documents. Save it to make its own file.', 8000);
  }

  /* ---------- small drawing helpers ---------- */
  function fmtIn(v) {
    if (v === 'N/A' || v === 'Not found') return v;
    if (!calc.isNum(v)) return '';
    var whole = Math.abs(v - Math.round(v)) < 0.005, s = whole ? String(Math.round(v)) : v.toFixed(2), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.');
  }
  /* Every rand amount shows its R and every percentage its % (Paul, 22 November); typing "1000" or "3" is fine, the box tidies it when it is left. */
  function dispIn(v, kind) {
    if (kind === 'money') return calc.isNum(v) ? (v < 0 ? '-R' + fmtIn(-v) : 'R' + fmtIn(v)) : fmtIn(v);
    if (kind === 'pct') return calc.isNum(v) ? fmtIn(v) + '%' : fmtIn(v);
    return kind === 'num' ? fmtIn(v) : (v == null ? '' : String(v));
  }
  /* A removed row says so, with Undo, for about 10 seconds (Paul, 22 November); after that the notice goes. */
  function fresh(path) { return !!recent[path] && Date.now() - recent[path] < NOTICE_MS; }
  function sweepNotices() { document.querySelectorAll('[data-notice]').forEach(function (el) { if (!fresh(el.getAttribute('data-notice'))) el.remove(); }); }
  function markRemoved(path) { recent[path] = Date.now(); setTimeout(sweepNotices, NOTICE_MS + 150); }
  function isOpen(key) { return openSet[key] === undefined ? openDefault : !!openSet[key]; }
  /* A fold inside a card (Correct by hand, Add the underwriter's e-mail) keeps the way the adviser left it across a redraw (typing in it redraws the page); `dflt` is what it does until he has touched it. */
  var keepOpen = {}, allOpen = false, uwText = {}, uwMsg = {}, uwPending = null;
  function foldOpen(key, dflt) { return keepOpen[key] !== undefined ? keepOpen[key] : (allOpen || !!dflt); }                 // folded unless the adviser (or a document just read) opened it
  function seeBtn(key) { var o = isOpen(key); return '<button type="button" class="see' + (o ? ' open' : '') + '" data-see="' + esc(key) + '" aria-expanded="' + o + '">' + (o ? 'See less' : 'See more') + '</button>'; }
  /* The ACI as 1 to 3 short points (round 4): the whole wording is the hover text. */
  function aciHTML(x) {
    var pts = calc.aciPoints(x), full = calc.fmtAci(x); if (!pts.length) return '';
    return pts.length > 1 || pts[0] !== full ? '<ul class="aciu" title="' + esc(full) + '">' + pts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : esc(full);
  }
  function aciShow(x) { var h = aciHTML(x); return h ? '<span class="aci">' + h + '</span>' : '<span class="none">&ndash;</span>'; }
  function viaNote(l, pid) { var t = l.via && l.via[pid + '.monthly']; return t ? '<small class="via">' + esc(t) + '</small>' : ''; }                    // where a figure the quote did not print came from
  function taLines(path, rows) { var v = store.pathGet(state, path); return '<textarea data-p="' + path + '" data-k="lines" rows="' + (rows || 3) + '" placeholder="One short point on each line (up to three)"' + (state.newer ? ' disabled' : '') + '>' + esc(Array.isArray(v) ? v.join('\n') : (v || '')) + '</textarea>'; }
  function inp(path, kind, cls, ph) {
    var v = store.pathGet(state, path), ro = state.newer ? ' disabled' : '';
    return '<input type="text" data-p="' + path + '" data-k="' + kind + '" class="' + (cls || '') + (kind === 'money' || kind === 'pct' || kind === 'num' ? ' amt' : '') + (v === 'N/A' || v === 'Not found' ? ' isna' : '') + '" value="' + esc(dispIn(v, kind)) + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : (kind === 'date' ? ' placeholder="dd/mm/yyyy"' : '')) + ' autocomplete="off"' + ro + '>';
  }
  function sel(path, opts, kind, blank) {
    var v = store.pathGet(state, path), list = opts.map(function (o) { return typeof o === 'string' ? { id: o, l: o } : o; });
    if (v && !list.some(function (o) { return String(o.id) === String(v); })) list.push({ id: v, l: String(v) });
    return '<select data-p="' + path + '" data-k="' + (kind || 'text') + '"' + (state.newer ? ' disabled' : '') + '>' + (blank === false ? '' : '<option value="">&nbsp;</option>') +
      list.map(function (o) { return '<option value="' + esc(o.id) + '"' + (String(o.id) === String(v == null ? '' : v) ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select>';
  }
  function boolSel(path, yes, no) { var v = store.pathGet(state, path); return '<select data-p="' + path + '" data-k="bool"' + (state.newer ? ' disabled' : '') + '><option value="0"' + (!v ? ' selected' : '') + '>' + esc(no) + '</option><option value="1"' + (v ? ' selected' : '') + '>' + esc(yes) + '</option></select>'; }
  function lab(text, inner, cls) { return '<label class="f' + (cls ? ' ' + cls : '') + '"><span class="l">' + esc(text) + '</span><div class="box">' + inner + '</div></label>'; }
  function stb(path) { return '<span class="stb" data-stfor="' + path + '"></span>'; }
  var STB = { empty: ['', ''], ff: ['from Fact Find, waiting for document', 'ff'], verify: ['to check', 'verify'], confirmed: ['checked', 'confirmed'] };
  var STB_SHORT = { ff: 'Fact Find', verify: 'to check', confirmed: '\u2713' };
  function badgeHTML(path, st, short, o) {
    var b = STB[st] || STB.empty; if (!b[0]) return '';
    if (st === 'confirmed' && o && o.match === 'factfind') return '<span class="tickok" title="The Fact Find and the quote agree: checked by the page">&#10003;</span>';
    if (st === 'confirmed' && o && o.match === 'quote') return '<span class="tickok" title="This line is in the quote, and the quote is the document: checked by the page">&#10003;</span>';
    var own = /^blocks\.other\./.test(path) && st === 'ff', label = own ? 'from Fact Find' : b[0], text = short ? STB_SHORT[st] : label, cls = b[1] + (short ? ' short' : ''), tip = own ? 'From the Fact Find (there is no document for this)' : b[0];
    return st === 'verify' || st === 'ff' ? '<button type="button" class="badge ' + cls + '" data-accept="' + path + '" title="' + esc(tip) + '. Click when this has been checked.">' + text + '</button>' : '<span class="badge ' + cls + '" title="' + esc(tip) + '">' + text + '</span>';
  }
  function R(n) { return calc.fmtR(n); }
  function amt(v) { return v === 'N/A' || v === 'Not found' ? '<span class="na">' + v + '</span>' : (calc.isNum(v) ? '<span class="a">' + R(v) + '</span>' : '<span class="none">&ndash;</span>'); }
  function pm(v) { return calc.isNum(v) ? '<span class="a">' + R(v) + '</span><small class="pm">p.m.</small>' : amt(v); }
  function pctShow(v) { return calc.isNum(v) ? '<span class="a">' + calc.fmtPct(v) + '</span>' : (v === 'N/A' || v === 'Not found' ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'); }
  var PIL = schema.PILLARS;

  /* ---------- client details ---------- */
  function clientHTML() {
    /* Paul's standard settings (the ACI and the ABI of each need, the difference allowed in a check) are NOT shown any more (Paul, 23 November: they serve no purpose on the screen). They stay in the state and in the saved file
       (state.settings), and the checks still use them: a line that differs is flagged amber. */
    return '<section class="sec"><div class="block-title">The client</div><div class="grid">' +
      lab('First names', inp('header.fname', 'text')) + lab('Surname', inp('header.sname', 'text')) + lab('Date of birth', inp('header.dob', 'date')) + lab('Broker', inp('header.broker', 'text')) +
      lab('Overview date', inp('header.overviewDate', 'date')) + lab('Date of the meeting', inp('header.meetingDate', 'date')) + lab('Astute report date', inp('header.astuteDate', 'date')) +
      lab('Net income (R p.m.)', inp('header.netIncome', 'money')) + lab('Gross income (R p.m.)', inp('header.grossIncome', 'money')) +
      lab('Disability and income protector to age', sel('header.disabilityAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) + lab('Severe illness requested (R)', inp('header.sevRequest', 'money')) +
      lab('Premium budget for the reduced quote (R p.m.)', inp('header.premiumBudget', 'money')) + '</div>' +
      '<p class="sub">These start from the Fact Find. A figure a document gives wins over the Fact Find.</p></section>';
  }

  /* ---------- the lines of a quote or a policy ---------- */
  /* A line the checks flag (it differs from the Fact Find): the problems about it, as one text for the hover and the amber mark. */
  /* The reasons a line is to be checked, in the words for the line (the missing bank, the debt that is only in the quote ...). */
  function lineWhy(id) { return ((last && last.problems) || []).filter(function (p) { return p.line === id; }).map(function (p) { return p.short || p.message; }).join(' '); }
  function lineFlag(id) { return ((last && last.problems) || []).filter(function (p) { return p.line === id; }).map(function (p) { return p.message; }).join(' '); }
  /* The red references a quote's terms put on a PILLAR (derived from the terms: +10% loading, Exclusion 3*): in the Loadings and exclusions row under the totals, never on a line (Paul, 25 November). */
  function refSmall(r) { return '<small class="rednote ref" title="' + (r.kind === 'loading' ? 'A premium loading from the insurer' : 'An exclusion from the insurer') + '">' + esc(r.text) + '</small>'; }
  function lineHTML(cpath, c, l, i, isPolicy) {
    var p = cpath + '.lines.' + i, t = schema.lineTypesById[l.type] || schema.lineTypesById.other, tt = t.monthly, cols = isPolicy ? 10 : 9;
    if (l.removed) return fresh(p) ? '<tr class="removed" data-row="' + p + '" data-notice="' + p + '"><td colspan="' + cols + '"><span class="gone">' + esc((l.label || t.l) + (l.name ? ' · ' + l.name + ' ' + (l.sname || '') : '') + (l.debt ? ' · ' + l.debt : '')) + ' removed.</span> <button type="button" class="lnk" data-undo="' + p + '">Undo</button></td></tr>' : '';
    var need = '<b>' + esc(l.type === 'other' ? '' : t.l) + '</b>';
    if (l.type === 'child') need = '<b>Child care</b><div class="two">' + inp(p + '.name', 'text', '', 'Name') + inp(p + '.sname', 'text', '', 'Surname') + '</div>';
    else if (l.type === 'debt') need = '<b>Debt</b><div class="two">' + inp(p + '.debt', 'text', '', 'Debt') + inp(p + '.bank', 'text', '', 'Bank') + '</div><div class="accsel">' + sel(p + '.accelerated', [{ id: 'true', l: 'Accelerated' }, { id: 'false', l: 'Standalone' }], 'tri') + '</div>';
    else if (l.type === 'other') need = inp(p + '.label', 'text', '', 'Description');
    if (l.type === 'household' || l.type === 'child' || l.type === 'death' || l.type === 'dread') need += '<div class="accsel">' + sel(p + '.accelerated', [{ id: 'true', l: 'Accelerated' }, { id: 'false', l: 'Standalone' }], 'tri') + '</div>';          // every need line says Accelerated or Standalone, like a debt
    function pillar(pid, hasLump, hasMonthly) {
      if (l[pid] === 'N/A') return '<td class="c"><span class="na">N/A</span></td>';
      var s = '';
      if (hasLump) s += inp(p + '.' + pid + '.lump', 'money');
      if (hasMonthly) s += inp(p + '.' + pid + '.monthly', 'money') + (pid === 'ip' ? '<small class="pm">p.m.</small>' : '<small class="sm">' + esc(tt) + '</small>') + viaNote(l, pid);
      if (pid === 'ip' && l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0) s += '<small class="ip">Instalment Protector</small><small class="ced">To be ceded to the bank</small>';
      return '<td class="c">' + s + '</td>';
    }
    var flag = lineFlag(l.id);
    return '<tr data-row="' + p + '" class="ln' + (flag ? ' ffdiff' : '') + '"' + (flag ? ' title="' + esc(flag) + '"' : '') + '><td class="need">' + stb(p) + need + '<small class="why" data-why="' + l.id + '">' + esc(lineWhy(l.id)) + '</small></td><td>' + inp(p + '.term', 'text', 'term', t.term || 'Term') + '</td>' + pillar('life', true, true) + pillar('sev', true, false) + pillar('lsd', true, true) + pillar('ip', false, true) +
      (l.waiting === 'N/A' ? '<td class="c"><span class="na">N/A</span></td>' : '<td>' + inp(p + '.waiting', 'text', 'wait') + '</td>') + '<td class="c"><span class="aci" data-aci="' + (isPolicy ? '' : c.id) + '">' + (isPolicy ? '' : (aciHTML(c) || '\u2013')) + '</span></td><td>' + inp(p + '.abi', 'pct') + '</td>' +
      (isPolicy ? '<td class="x"><button type="button" class="xbtn" data-del="' + p + '" title="Remove this line">&times;</button></td>' : '') + '</tr>';
  }
  /* The lines of a quote come only from the quote (read from the document): no remove column and no add buttons. A quote with nothing in it yet (a quote started by hand) may still be given its lines. A policy keeps both. */
  function linesTable(cpath, c, isPolicy) {
    var ages = (c.disabilityAge || c.ipAge || (state.header.disabilityAge)) || '', age = ages ? 'Age ' + ages : '', cols = isPolicy ? 10 : 9, flat = isPolicy && !!String(c.insurer || '').trim() && !store.isBright(c.insurer);
    var head = '<thead><tr><th class="need">' + (flat ? 'Benefits' : 'Need') + '</th><th>Term</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability<small>' + esc(age) + '</small></th><th>Income protector / sickness benefit<small>' + esc(age) + '</small></th><th>Waiting period</th><th>ACI</th><th>ABI</th>' + (isPolicy ? '<th></th>' : '') + '</tr></thead>';
    var body = (c.lines || []).map(function (l, i) { return lineHTML(cpath, c, l, i, isPolicy); }).join('') || '<tr><td colspan="' + cols + '" class="empty">No lines yet.</td></tr>';
    var bare = !calc.activeLines(c).length;
    var kinds = flat ? ['other'] : (isPolicy || c.kind === 'comparative' ? ['other', 'household', 'child', 'debt', 'death', 'dread'] : ['household', 'child', 'debt', 'death', 'dread', 'other']);          // the need-by-need lines are for a BrightRock policy only
    var types = isPolicy || bare ? kinds.map(function (t) { return '<button type="button" class="addrow" data-addl="' + cpath + '|' + t + '">+ ' + esc(flat ? 'A benefit' : schema.lineTypesById[t].l) + '</button>'; }).join('') : '';
    var ced = (c.lines || []).some(function (l) { return !l.removed && l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; });
    return '<div class="ovw"><table class="ovt lines' + (isPolicy ? '' : ' qlines') + '"><colgroup><col class="c-need"><col class="c-term"><col class="c-life"><col class="c-sev"><col class="c-lsd"><col class="c-ip"><col class="c-wait"><col class="c-aci"><col class="c-abi">' + (isPolicy ? '<col class="c-x">' : '') + '</colgroup>' + head + '<tbody>' + body + '</tbody>' +
      (isPolicy ? '' : '<tbody data-comp="qtot|' + c.id + '">' + compHTML('qtot', c.id) + '</tbody>') + '</table></div>' +
      (ced ? '<p class="foot">Instalment Protector: if the client is retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.</p>' : '') + (types ? '<div class="adders">' + (isPolicy ? '' : '<small class="foot">Nothing was read into this quote yet: upload it, or add its lines by hand.</small> ') + types + '</div>' : '');
  }

  /* ---------- the figures the page works out ---------- */
  function totRows(t, premium, rates, q) {
    var refs = q && q.terms ? ['life', 'sev', 'lsd', 'ip'].map(function (pid) { return calc.refsTotal(q, pid).map(refSmall).join(''); }) : [];
    return (refs.some(Boolean) ? '<tr class="tot refs"><td colspan="2">Loadings and exclusions</td><td class="c">' + refs[0] + '</td><td class="c">' + refs[1] + '</td><td class="c">' + refs[2] + '</td><td class="c">' + refs[3] + '</td><td colspan="3"></td></tr>' : '') + '<tr class="tot lump"><td colspan="2">Total lump sum</td><td class="c">' + amt(t.life.lump) + '</td><td class="c">' + amt(t.sev.lump) + '</td><td class="c">' + amt(t.lsd.lump) + '</td><td class="c"></td><td colspan="3"></td></tr>' +
      '<tr class="tot inc"><td colspan="2">Total income protected</td><td class="c">' + pm(t.life.monthly) + '</td><td class="c"><span class="na">N/A</span></td><td class="c">' + pm(t.lsd.monthly) + '</td><td class="c">' + pm(t.ip.monthly) + '</td><td colspan="3"></td></tr>' +
      '<tr class="tot prem"><td colspan="2">Monthly premium' + (rates ? ' <small>' + esc(rates) + '</small>' : '') + '</td><td colspan="2" class="c">' + (calc.isNum(premium) ? '<span class="a">' + R(premium) + '</span>' : '<span class="none">&ndash;</span>') + '</td><td colspan="5"></td></tr>';
  }
  function compHTML(name, id) {
    var q;
    if (name === 'qtot') { q = store.findQuote(state, id); return q ? totRows(calc.totals(q), q.premium, q.rates, q) : ''; }
    if (name === 'cmp') { q = store.findQuote(state, id); return q ? compareHTML(q) : ''; }
    if (name === 'polrow') { var pe = calc.policies(state)[+id]; return pe ? policyRow(pe, +id) : ''; }
    if (name === 'poltot') return policyTots();
    if (name === 'invrow') { var ie = calc.investments(state)[+id]; return ie ? invRow(ie, +id) : ''; }
    if (name === 'invtot') return invTots();
    if (name === 'proprow') { var pr = state.blocks.proposed.items[+id]; return pr && !pr.removed ? proposedRow(pr, +id) : ''; }
    if (name === 'grouptab') return groupTable();
    if (name === 'sf') return shortfallHTML();
    return '';
  }
  function compareHTML(q) {
    var c = calc.compare(state, q), rows = [['What you have now', c.now, false], ['This quote', c.quote, false], ['Difference', c.diff, true]];
    return '<div class="ovw"><table class="ovt cmp"><thead><tr><th></th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability</th><th>Income protector <small>p.m.</small></th><th>Monthly premium</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var f = function (v) { return r[2] ? '<span class="a ' + (v > 0.004 ? 'up' : v < -0.004 ? 'down' : '') + '">' + calc.fmtDiff(v) + '</span>' : amt(v); };
        return '<tr class="' + (r[2] ? 'diff' : '') + '"><td>' + r[0] + '</td><td class="c">' + f(r[1].life) + '</td><td class="c">' + f(r[1].sev) + '</td><td class="c">' + f(r[1].lsd) + '</td><td class="c">' + f(r[1].ip) + '</td><td class="c">' + f(r[1].premium) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (c.nowCount ? '' : '<p class="foot">There are no current policies yet, so "what you have now" is nothing.</p>');
  }
  function cmpHTML(o, p) {
    var m = o.cmp, bright = /bright/i.test(o.insurer || '');
    if (!m) return bright && !state.newer ? '<div class="cmpadd"><small class="foot">' + (o.kind ? 'No change moment pay-out yet: it is read by itself from the guide &ldquo;BR CMPO - ' + esc(o.number || 'CP number') + '&rdquo; in the client&rsquo;s folder when the quote is loaded. ' : 'The change moment pay-out of this policy is typed from its &ldquo;BR CMPO&rdquo; guide. ') + '<button type="button" class="lnk" data-addcmp="' + p + '">Type it in by hand</button></small></div>' : '';
    var lbl = { total: 'Total for all your needs', retirement: 'Your retirement needs', childcare: 'Your childcare needs' };
    var rows = (m.rows || []).map(function (r, i) {
      var rp = p + '.cmp.rows.' + i, nm = r.key === 'child' ? '<div class="two">' + inp(rp + '.name', 'text', '', 'Name') + inp(rp + '.sname', 'text', '', 'Surname') + '</div>' : '<b>' + esc(lbl[r.key] || r.key) + '</b>';
      return '<tr data-row="' + rp + '"><td>' + nm + '</td><td class="c">' + inp(rp + '.today', 'money') + '</td><td class="c">' + inp(rp + '.projected', 'money') + '</td><td class="c">' + inp(rp + '.payoutDate', 'date') + '</td></tr>';
    }).join('');
    return '<h4>Your change moment pay-out ' + vb(p + '.cmp') + ' <button type="button" class="lnk" data-delcmp="' + p + '">Remove</button></h4>' +
      '<div class="ovw"><table class="ovt cmp payout"><thead><tr><th></th><th>Today</th><th>Projected value at your change moment date</th><th>Pay-out date</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="empty">No rows: the insurer gave no pay-out.</td></tr>') + '</tbody></table></div>' +
      '<p class="foot">The rows come from the change moment pay-out guide (BR CMPO) of this quote: a new or replacement quote brings a new table.</p>' +
      '<div class="grid qh">' + lab('CP number of the guide', inp(p + '.cmp.number', 'text')) + lab('Change moment date', inp(p + '.cmp.activationDate', 'date')) + lab('If the insurer gave no pay-out, why', inp(p + '.cmp.reason', 'text'), 'wide') + '</div>' +
      (m.st === 'verify' ? '<p class="foot">Read from ' + esc((m.src && m.src.file) || 'a document') + ': check the figures.</p>' : '');
  }

  /* ---------- what happens to a quote: acceptance, underwriting terms, replacements (round 1.1) ---------- */
  function conflictOf(q) { return calc.acceptanceConflicts(state).filter(function (c) { return c.quote === q; })[0] || null; }
  function acceptWarn(q, p) {
    var c = conflictOf(q);
    if (!c && !q.second) return '';
    var names = c ? c.others.map(check.qLabel).join(' and ') : '';
    return '<div class="acceptbox' + (c ? ' bad' : '') + '">' + (c ? '<p class="rednote">Another quote is also accepted (' + esc(names) + '). Only one quote can be accepted at a time, unless this is a deliberate second policy alongside the first.</p>' : '') +
      '<label class="chk"><input type="checkbox" data-second="' + p + '"' + (q.second ? ' checked' : '') + (state.newer ? ' disabled' : '') + '> Second policy alongside the first (a deliberate two-policy case)</label></div>';
  }
  /* The typed tables of an insurer's terms (round 1.1). On a counter offer they are only the CORRECT BY HAND fold (round 1.3): the letter fills the terms, the loadings carry ONE reason for all of them (terms.reason), so the table has no reason columns. */
  function termTables(q, p, u, counter) {
    var t = q.terms || {}, dis = state.newer ? ' disabled' : '', h = '';
    if (u === 'loadings' || u === 'both') {
      var ls = Array.isArray(t.loadings) ? t.loadings : [];
      h += '<div class="ovw"><table class="ovt terms ld' + (counter ? ' cnt' : '') + '"><thead><tr><th>Loading on</th><th>Percentage added</th>' + (counter ? '' : '<th>Reason</th><th>The reason in words</th>') + '<th></th></tr></thead><tbody>' +
        (ls.map(function (r, i) { var rp = p + '.terms.loadings.' + i; return '<tr' + (r && r.st === 'verify' ? ' class="tocheck" title="Read from the letter: to check"' : '') + '><td>' + (r && r.column ? '<b class="tbenefit">' + esc(calc.termBenefit(r)) + '</b>' : sel(rp + '.benefit', schema.TERM_BENEFITS, 'text', false)) + termCell(r) + '</td><td>' + inp(rp + '.pct', 'pct') + '</td>' + (counter ? '' : '<td>' + sel(rp + '.kind', schema.LOADING_KINDS, 'text', !(r && r.kind)) + '</td><td>' + inp(rp + '.reason', 'text', '', 'e.g. raised blood pressure') + '</td>') + '<td><button type="button" class="x" data-delterm="' + p + '|loadings|' + i + '"' + dis + '>Remove</button></td></tr>'; }).join('') || '<tr><td colspan="' + (counter ? 3 : 5) + '" class="empty">No loading typed yet.</td></tr>') +
        '</tbody></table></div><div class="adders"><button type="button" class="addrow" data-addterm="' + p + '|loadings"' + dis + '>+ A loading</button></div>';
    }
    if (u === 'exclusions' || u === 'both') {
      var es = Array.isArray(t.exclusions) ? t.exclusions : [];
      var hasNo = counter || es.some(function (r) { return r && r.no; });
      h += '<div class="ovw"><table class="ovt terms ex' + (hasNo ? ' withno' : '') + '"><thead><tr>' + (hasNo ? '<th>No.</th>' : '') + '<th>Benefit</th><th>What is excluded</th><th>' + (hasNo ? 'Type' : 'Why') + '</th><th></th></tr></thead><tbody>' +
        (es.map(function (r, i) { var rp = p + '.terms.exclusions.' + i; return '<tr' + (r && r.st === 'verify' ? ' class="tocheck" title="Read from the letter: to check"' : '') + '>' + (hasNo ? '<td>' + inp(rp + '.no', 'text') + '</td>' : '') + '<td>' + (r && r.applies && r.applies.length ? '<b class="tbenefit">' + esc(calc.termBenefit(r)) + '</b>' : hasNo ? inp(rp + '.benefit', 'text') : sel(rp + '.benefit', schema.TERM_BENEFITS, 'text', true)) + (r && r.page ? '<small class="foot">page ' + esc(r.page) + '</small>' : '') + '</td><td>' + inp(rp + '.what', 'text', '', 'the condition or benefit excluded') + '</td><td>' + inp(rp + '.why', 'text', '', hasNo ? 'e.g. Medical' : 'e.g. a back injury in 2023') + '</td><td><button type="button" class="x" data-delterm="' + p + '|exclusions|' + i + '"' + dis + '>Remove</button></td></tr>'; }).join('') || '<tr><td colspan="' + (hasNo ? 5 : 4) + '" class="empty">No exclusion typed yet.</td></tr>') +
        '</tbody></table></div><div class="adders"><button type="button" class="addrow" data-addterm="' + p + '|exclusions"' + dis + '>+ An exclusion</button></div>';
    }
    return h;
  }
  /* The insurer's terms of an ordinary quote, once the client has accepted and the insurer has answered: standard rates say just that; loadings and exclusions are typed here. A counter offer has its own, plainer block. */
  function termsBlock(q, p) {
    if (q.counterOf) return counterTermsBlock(q, p);
    var u = calc.uwOf(q); if (!u || u === 'pending' || schema.UW_DECLINED.indexOf(u) >= 0) return '';
    if (u !== 'standard' && calc.counterOffers(state, q).length && !((q.terms && q.terms.loadings || []).length + (q.terms && q.terms.exclusions || []).length)) return '<div class="uwblock"><h4>Underwriting outcome: ' + esc(schema.uwLabel[u]) + '</h4><p class="foot">The insurer’s terms are on the counter offer below.</p></div>';
    if (u === 'standard') return '<div class="uwblock"><h4>Underwriting outcome</h4><p class="uwline">Accepted at standard rates.</p></div>';
    return '<div class="uwblock"><h4>Underwriting outcome: ' + esc(schema.uwLabel[u]) + '</h4>' + termTables(q, p, u, false) + '</div>';
  }
  /* Where the one reason for the loadings came from, in a few words. */
  function reasonSrcText(r) {
    if (!r) return '';
    if (r.src && r.src.kind === 'uwemail') return 'underwriter’s e-mail' + (r.src.date ? ', ' + r.src.date : '');
    return r.by === 'person' ? 'typed in' : '';
  }
  function reasonTitle(r) { var x = r && r.src; return x && x.kind === 'uwemail' ? [x.subject && 'Subject: ' + x.subject, x.sender && 'From: ' + x.sender, x.date && 'Date: ' + x.date, x.file && 'File: ' + x.file].filter(Boolean).join(' · ') : ''; }
  /* The underwriting decision of a counter offer (round 1.3, Paul 25 November): the decision, then ONE plain summary, "Underwriting terms of the counter offer letter": the loadings of the pillars that carry one, the ONE reason for them
     (from the underwriters' e-mail), and every exclusion once with the pillars it covers and the insurer's own wording. The tables that type them are a closed Correct by hand fold. */
  function counterTermsBlock(q, p) {
    var sm = calc.termsSummary(q), dis = state.newer ? ' disabled' : '', n = calc.termsToCheck(q), has = sm.loadings.length + sm.exclusions.length > 0, rs = sm.reason, hk = 'hand|' + q.id, t = q.terms || {};
    var h = '<div class="uwblock uwdecision" data-uwdecision="' + esc(q.id) + '"><h4>Underwriting decision</h4>';
    if (sm.decision) h += '<p class="uwpill"><span>Decision:</span> <b>' + esc(sm.decision) + '</b></p>';
    h += '<div class="uwterms"><h5 class="uwh">Underwriting terms of the counter offer letter' + (sm.heading ? ': ' + esc(sm.heading) : '') + '</h5>';
    if (!has) h += '<p class="foot">No loadings or exclusions have been read from the letter yet: use Add counter offer&hellip; on the original quote and tick the letter, or open Correct by hand.</p>';
    if (sm.loadings.length) h += '<h6>Loadings</h6><ul class="uwld">' + sm.loadings.map(function (l) { return '<li data-pillar="' + l.pillar + '"><b>' + esc(l.label) + '</b><span class="rednote">' + esc(l.texts.join(', ')) + '</span></li>'; }).join('') + '</ul>';
    if (rs) h += '<p class="uwreason' + (rs.st === 'verify' ? ' tocheck' : '') + '" data-uwreason-line' + (reasonTitle(rs) ? ' title="' + esc(reasonTitle(rs)) + '"' : '') + '><b>Reason</b> ' + esc(rs.text) + (reasonSrcText(rs) ? ' <small class="foot">(' + esc(reasonSrcText(rs)) + ')</small>' : '') + '</p>';
    else if (sm.loadings.length) h += '<p class="amberline uwnoreason">Reason not found yet: the letter gives none. Add the underwriter’s e-mail, or type the reason in Correct by hand.</p>';
    if (sm.exclusions.length) h += '<h6>Exclusions</h6>' + sm.exclusions.map(function (ex) { return '<div class="uwex"><span class="redno">' + esc(ex.no) + '</span> <span class="pil">' + esc(ex.benefit) + '</span>' + (ex.page ? ' <small class="foot">page ' + esc(ex.page) + '</small>' : '') + (ex.what ? '<p>' + esc(ex.what) + '</p>' : '') + '</div>'; }).join('');
    if (n) h += '<p class="amberline">' + n + (n === 1 ? ' item was' : ' items were') + ' read from the letter or the e-mail and ' + (n === 1 ? 'is' : 'are') + ' to check. <button type="button" class="x" data-confirmterms="' + p + '"' + dis + '>Terms checked</button></p>';
    var mk = 'mail|' + q.id, m = uwMsg[q.id] || {};
    h += '<details class="bre uwmail" data-keep="' + mk + '"' + (foldOpen(mk, false) ? ' open' : '') + '><summary>Add the underwriter’s e-mail&hellip;</summary><p class="sub">The reason for the loadings comes from the e-mail the underwriters sent about this quote. Choose the saved e-mail (or a PDF of it), or paste its text. It is read for the reason' + (q.number ? ' and must name this quote (CP ' + esc(q.number) + ')' : '') + '.</p>' +
      '<div class="fbtns"><button type="button" class="btn small" data-uwfile="' + esc(q.id) + '"' + dis + '>Choose the e-mail file&hellip;</button></div>' +
      '<textarea rows="6" placeholder="&hellip;or paste the e-mail here" data-uw-text="' + esc(q.id) + '"' + dis + '>' + esc(uwText[q.id] || '') + '</textarea><div class="fbtns"><button type="button" class="btn small" data-uw-read="' + esc(q.id) + '"' + dis + '>Read it</button> <span class="breMsg' + (m.bad ? ' bad' : '') + '" data-uw-msg="' + esc(q.id) + '">' + esc(m.t || '') + '</span></div></details>';
    h += '<details class="uwhand" data-keep="' + hk + '"' + (foldOpen(hk, !has) ? ' open' : '') + '><summary>Correct by hand</summary>' + termTables(q, p, 'both', true) +
      '<label class="f uwreasonbox"><span class="l">The reason for the loadings (one reason for all of them)</span><div class="box"><textarea rows="2" data-uwreason="' + p + '"' + dis + ' placeholder="e.g. raised blood pressure">' + esc(t.reason && typeof t.reason === 'object' ? t.reason.text || '' : (rs && !rs.own ? rs.text : '')) + '</textarea></div></label></details>';
    return h + '</div></div>';
  }
  /* Under a loading read from a letter: which need group and column group it belongs to. */
  function termCell(r) {
    if (!r || (!r.need && !r.column)) return '';
    var ng = schema.needGroupById[r.need], cg = schema.columnGroupById[r.column];
    return '<small class="foot">' + esc([ng && ng.l, cg && !(ng && ng.only) && cg.l].filter(Boolean).join(' · ')) + '</small>';          // the additional expense row is severe illness whatever column the letter prints it under
  }
  /* Premium before, after and the difference of a counter offer (derived: the quote before it and the counter offer's own premium, else the letter's two premiums). */
  function premText(pr) {
    if (!pr || !calc.isNum(pr.before) || !calc.isNum(pr.after)) return '';
    return 'Premium: before ' + R(pr.before) + ' p.m. · after ' + R(pr.after) + ' p.m. · difference ' + calc.fmtDiff(pr.diff) + (calc.isNum(pr.pct) ? ' (' + (pr.pct > 0 ? '+' : pr.pct < 0 ? '\u2212' : '') + Math.abs(pr.pct) + '%)' : '');
  }
  /* The head of a counter offer: what it is, its letter, its expiry, the premium, a signed copy, what the letter says beyond the terms, and the terms still to check. */
  function counterBlock(q, p) {
    var root = calc.parentOf(state, q); if (!root) return '';
    var off = q.offer || {}, pr = calc.counterPremium(state, q);
    var meta = [off.letter ? 'Letter: ' + off.letter : 'The letter is not loaded yet', off.expires ? 'The revised proposal expires ' + off.expires : '', off.startDate ? 'The letter proposes the start date ' + off.startDate : ''].filter(Boolean).join(' \u00b7 ');
    var h = '<div class="uwblock counterblock" data-counter="' + esc(q.id) + '"><h4>Counter offer to ' + esc(calc.quoteRef(root)) + '</h4><p class="uwline">' + esc(meta) + ' ' + vb(p + '.letter') + '</p>';
    var pt = premText(pr); if (pt) h += '<p class="uwline premline">' + esc(pt) + '</p>';
    var pw = calc.premiumWarning(state, q); if (pw) h += '<p class="amberline premwarn">' + esc(pw) + '</p>';          // the revised Cover Proposal must match the letter exactly: any difference, even a cent, is named
    if (off.signed && q.status === 'pending') h += '<p class="blue">A signed copy of the letter (' + esc(off.signed) + ') is in the folder. That usually means the client accepted: set the client decision above if so. It was not read.</p>';
    if (off.notes) h += '<p class="rednote">' + esc('The letter also says: ' + off.notes) + '</p>';
    if (!calc.activeLines(q).length) h += '<p class="blue">The counter offer quote is not loaded yet: use Add counter offer&hellip; on the original quote and tick the revised proposal.</p>';
    return h + '</div>';
  }
  /* Under the quote the client accepted: its counter offers and the button that adds one (only where underwriting came back with loadings, exclusions or both). */
  function counterList(q, p) {
    var cs = calc.counterOffers(state, q), can = calc.canCounter(state, q), dis = state.newer ? ' disabled' : '';
    if (!cs.length && !can) return '';
    var h = '<div class="uwblock counterlist"><h4>Counter offers</h4>';
    cs.forEach(function (c) { var pt = premText(calc.counterPremium(state, c)); h += '<p class="uwline">' + esc(check.qTitle(c) + ' \u00b7 ' + (schema.statusLabel[c.status] || '')) + (pt ? ' \u00b7 ' + esc(pt) : '') + '</p>'; });
    if (can) h += '<p class="foot">The insurer\u2019s counter offer letter and counter offer quote are in the policy folder\u2019s Counter Offer Letter folder.</p><div class="adders"><button type="button" class="addrow" data-addcounter="' + p + '"' + dis + '>+ Add counter offer&hellip;</button></div>';
    return h + '</div>';
  }
  /* Will this quote replace any of the client's existing policies? The answer and the picks are the adviser's. */
  function replBlock(q, p) {
    if (q.counterOf) { var rt = calc.parentOf(state, q); return '<div class="replblock"><h4>Replacing existing policies</h4><p class="foot">The same as the original quote' + (rt ? ' (' + esc(calc.quoteRef(rt)) + ')' : '') + ': answer it there.</p></div>'; }
    var r = calc.replOf(q), list = calc.replaceable(state, q), dis = state.newer ? ' disabled' : '';
    var h = '<div class="replblock"><h4>Replacing existing policies</h4><label class="f"><span class="l">Will this quote replace any of the client&rsquo;s existing policies?</span><div class="box"><select data-replans="' + p + '"' + dis + '><option value="">&nbsp;</option><option value="yes"' + (r.answer === 'yes' ? ' selected' : '') + '>Yes</option><option value="no"' + (r.answer === 'no' ? ' selected' : '') + '>No</option></select></div></label>';
    if (r.answer === 'yes') {
      h += '<p class="foot">Tick every current policy this quote replaces. Each gets a red note on Current policies, in the PDF and in the Presentation.</p><div class="picks">' +
        (list.map(function (e) { var it = e.item; return '<label class="chk"><input type="checkbox" data-replpick="' + p + '|' + esc(it.id) + '"' + (r.policies.indexOf(it.id) >= 0 ? ' checked' : '') + dis + '> ' + esc(calc.policyRef(it)) + (it.product ? ' <small>' + esc(it.product) + '</small>' : '') + '</label>'; }).join('') || '<small class="foot">There are no current policies to pick from yet.</small>') + '</div>';
    }
    return h + '</div>';
  }
  function quoteStates(q, p) { return q.counterOf ? counterBlock(q, p) + termsBlock(q, p) + replBlock(q, p) : acceptWarn(q, p) + termsBlock(q, p) + counterList(q, p) + replBlock(q, p); }
  /* The red note under a current policy: replaced by a quote, or "will not be replaced" with the question about the broker on record. */
  function polNote(e, ri) {
    var n = calc.policyNote(state, e, ri); if (!n) return '';
    var at = state.blocks.policies.items.indexOf(e.item), p = 'blocks.policies.items.' + at, h = '<span class="rednote">' + esc(n.text) + '</span>';
    if (n.kind === 'not' && n.broker && at >= 0) {
      h += ' <span class="brk"><label>Broker on record: ' + sel(p + '.brokerRecord', schema.BROKER_RECORD, 'text', true) + '</label>' + (n.record === 'moves' ? ' <label>Broker changed on ' + inp(p + '.brokerChangedDate', 'date') + '</label>' : '') + '</span>' +
        (n.record === 'moves' && !n.date ? ' <span class="brknote rednote">' + esc(n.brokerText) + '</span>' : '');                                   // the choice and the date boxes already say the rest
    }
    return '<tbody class="rnote"><tr><td colspan="9">' + h + '</td></tr></tbody>';
  }
  /* A warning the moment a second quote is marked accepted (the card keeps showing it until it is resolved). */
  function warnAcceptance(qpath) {
    var q = store.pathGet(state, qpath), c = q && conflictOf(q);
    if (c) toast('Another quote is already accepted (' + c.others.map(check.qLabel).join(' and ') + '). Only one quote can be accepted, unless you tick “Second policy alongside the first” on this one.', 12000);
  }

  /* ---------- quotes ---------- */
  /* What a quote's acceptance means for Current policies: issued (shown there), waiting for its counter offer, or waiting for the policy number and start date. */
  function issuedNotes(q) {
    if (!calc.accepted(q)) return '';
    var root = calc.parentOf(state, q) || q, ci = calc.chainIssued(state, root);
    if (!q.counterOf && calc.counterOffers(state, q).length) {
      var lv = calc.liveCounter(state, q);
      if (lv.status === 'notaccepted') return '<p class="bad-note">The client did not accept the counter offer, so no policy comes from this quote.</p>';
      if (lv.status === 'accepted') return ci && ci.id === lv.id ? '' : '<p class="blue">The client accepted the counter offer. Type the policy number and the start date on the counter offer below: it then moves to Current policies as a current policy of ours.</p>';
      return '<p class="blue">The insurer sent a counter offer: the policy comes from the counter offer once the client has accepted it (see Counter offers below).</p>';
    }
    if (ci && ci.id === q.id) return '<p class="blue">This ' + (q.counterOf ? 'counter offer' : 'quote') + ' has been issued as a policy, so it is also shown under Current policies as a current policy of ours.</p>';
    return '<p class="blue">Accepted. When the insurer has issued the policy, type its policy number and start date above: the ' + (q.counterOf ? 'counter offer' : 'quote') + ' then moves to Current policies as a current policy of ours.</p>';
  }
  function quoteCard(q, i, bid) {
    var p = 'blocks.' + bid + '.quotes.' + i, title = check.qTitle(q) + (q.date ? ' · ' + q.date : '') + (q.rates ? ' · ' + q.rates : ''), open = isOpen(q.id);
    var head = '<header><span class="statusbadge s-' + esc(calc.statusClass(q, state)) + '" data-statusfor="' + p + '">' + esc(calc.statusText(q, state)) + '</span><h3 data-titlefor="' + p + '">' + esc(title) + '</h3>' + stb(p) + vb(p) +
      '<span class="grow"></span>' + (open ? '<button type="button" class="x" data-replace="' + bid + '|' + q.id + '">Replace quote&hellip;</button><button type="button" class="x" data-del="' + p + '">Remove quote</button>' : '') + seeBtn(q.id) + '</header>';
    if (!open) return '<article class="qcard folded" data-row="' + p + '">' + head + '</article>';
    return '<article class="qcard" data-row="' + p + '">' + head +
      '<div class="grid qh">' + lab('Insurer', inp(p + '.insurer', 'text', '', 'e.g. BrightRock')) + lab(/bright/i.test(q.insurer) ? 'CP number' : 'Quote number', inp(p + '.number', 'text')) + lab('Quote date', inp(p + '.date', 'date')) +
      lab('Rates', inp(p + '.rates', 'text')) + lab('Kind of quote', boolSel(p + '.servicing', 'Servicing', 'New business')) + lab('Client decision', sel(p + '.status', schema.STATUS, 'text', false)) + (q.status === 'accepted' && !q.counterOf ? lab('Underwriting', sel(p + '.uw', schema.UW, 'text', false)) : '') +
      lab('Disability to age', sel(p + '.disabilityAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ACI as the quote words it', inp(p + '.aciText', 'text', '', 'e.g. 7.5% + age rater')) + lab('ACI in short points', taLines(p + '.aciPoints')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      (calc.accepted(q) ? lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Start date', inp(p + '.startDate', 'date')) : '') + '</div>' +
      issuedNotes(q) +
      (q.kind === 'comparative' ? '<p class="blue">This is what the other insurer\'s quote prints, read from the document: often one whole-of-life amount for each benefit. The four benefit columns, the totals and the comparison follow it.</p>' : '') + linesTable(p, q, false) + breBox(q) + quoteStates(q, p) + '<div class="under">' + cmpHTML(q, p) + (q.counterOf && !calc.activeLines(q).length ? '' : '<h4>Compared with what you have now</h4><div data-comp="cmp|' + q.id + '">' + compareHTML(q) + '</div>') + '</div></article>';
  }
  function quotesBlock(b) {
    var list = (state.blocks[b.id].quotes || []), live = list.filter(function (q) { return !q.removed; }), gone = list.filter(function (q) { return q.removed; });
    var note = b.id === 'shortfallQuote' && !calc.hasGroupRisk(state) ? '<p class="blue">A shortfall quote is only needed when the client has group risk (see Group benefits & personal investments). There is none yet.</p>' : '';
    var cards = live.map(function (q) { var i = list.indexOf(q); return quoteCard(q, i, b.id); }).join('');
    var removed = gone.map(function (q) { var i = list.indexOf(q), path = 'blocks.' + b.id + '.quotes.' + i; return fresh(path) ? '<p class="gone" data-notice="' + path + '">' + esc(check.qTitle(q)) + ' removed. <button type="button" class="lnk" data-undo="' + path + '">Undo</button></p>' : ''; }).join('');
    return note + (cards || '<p class="empty-list">No ' + esc(b.one) + ' yet.</p>') + removed + '<div class="blockacts"><button type="button" class="addrow big" data-upc="' + b.id + '" title="Opens the client\'s own folder (the quotes folder where there is one): pick the document and the page reads it. If the folder is not found, the normal file window opens.">Upload from client folder&hellip;</button> <button type="button" class="lnk small" data-addq="' + b.qkind + '">type in by hand</button></div>';
  }

  /* ---------- block 1: current policies ---------- */
  function ageOf(it) { return it.ipAge || state.header.disabilityAge || ''; }
  function policyRow(e, idx) {
    var it = e.item, t = calc.totals(it), has = calc.activeLines(it).length, tick = it.wr ? '<span class="tick">&#10003;</span>' : '<span class="cross">&#10007;</span>', w = (calc.activeLines(it).filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
    var b = it.benefits || {}, bd = function (k) { return b[k] ? '<small class="d bd">' + esc(b[k]) + '</small>' : ''; }, at = state.blocks.policies.items.indexOf(it), p = 'blocks.policies.items.' + at;
    return '<tr class="pol"' + (at >= 0 ? ' data-row="' + p + '"' : '') + '><td>' + (at >= 0 ? stb(p) : '') + tick + ' <b>' + esc(it.insurer || 'Policy') + '</b>' + (it.policyNo ? ' <small>' + esc(it.policyNo) + '</small>' : '') + '<small class="d">' + esc([it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join(' · ')) + (e.derived ? ' · from the accepted quote' : '') + (it.src && it.src.kind === 'astute' ? ' · Astute' + (it.src.date ? ' ' + esc(it.src.date) : '') : '') + '</small>' + (at >= 0 ? '<span class="dvrow">' + vb(p) + seeBtn(it.id) + '</span>' : '') + '</td>' +
      '<td class="c">' + (has ? amt(t.life.lump) : amt(null)) + bd('life') + '</td><td class="c">' + (has ? amt(t.sev.lump) : amt(null)) + bd('sev') + '</td><td class="c">' + (has ? amt(t.lsd.lump) : amt(null)) + bd('lsd') + '</td><td class="c">' + (has ? pm(t.ip.monthly) : amt(null)) + bd('ip') + '</td>' +
      '<td class="c">' + esc(w || '') + '</td><td class="c">' + aciShow(it) + '</td><td class="c">' + pctShow(it.abi) + '</td><td class="c">' + (calc.isNum(it.premium) ? '<span class="a">' + R(it.premium) + '</span>' : amt(null)) + '</td></tr>';
  }
  function policyTots() {
    var pt = calc.policyTotals(state);
    function tr(label, t, prem, cls) {
      return '<tr class="' + cls + '"><td>' + label + '</td><td class="c">' + amt(t.life.lump) + '</td><td class="c">' + amt(t.sev.lump) + '</td><td class="c">' + amt(t.lsd.lump) + '</td><td class="c">' + pm(t.ip.monthly) + '</td><td></td><td></td><td></td><td class="c">' + (calc.isNum(prem) ? '<span class="a">' + R(prem) + '</span>' : '') + '</td></tr>';
    }
    return (pt.count.wr ? tr('Total policies where we are the broker', pt.wr, pt.premium.wr, 'tot') : '') + (pt.count.other ? tr('Total other brokers', pt.other, pt.premium.other, 'tot') : '') + tr('Grand total (all policies)', pt.all, pt.premium.all, 'tot grand');
  }
  /* The summary stays at the top; a row's See more opens that policy's whole detail directly under it. Each row and the totals are redrawn as you type; the detail you are typing in is not. */
  function policyTable() {
    var ps = calc.policies(state), age = ageOf({}) ? ' (Age ' + ageOf({}) + ')' : '', ri = calc.replacementInfo(state);
    var rows = ps.map(function (e, i) {
      var at = state.blocks.policies.items.indexOf(e.item);
      return '<tbody data-comp="polrow|' + i + '">' + policyRow(e, i) + '</tbody>' + polNote(e, ri) + (at >= 0 && isOpen(e.item.id) ? '<tbody class="dtl"><tr><td colspan="9">' + policyCard(e.item, at) + '</td></tr></tbody>' : '');
    }).join('') || '<tbody><tr><td colspan="9" class="empty">No policies in the Fact Find yet.</td></tr></tbody>';
    return '<div class="ovw"><table class="ovt pols"><colgroup><col class="p-name"><col><col><col><col><col class="p-w"><col class="p-aci"><col class="p-s"><col></colgroup><thead><tr><th>Policy</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability' + age + '</th><th>Income protector / sickness benefit' + age + '</th><th>Waiting period</th><th>ACI</th><th>ABI</th><th>Premium</th></tr></thead>' + rows +
      '<tbody data-comp="poltot|">' + policyTots() + '</tbody></table></div>';
  }
  function policyCard(it, i) {
    var p = 'blocks.policies.items.' + i;
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.insurer || 'Policy') + (it.policyNo ? ' · ' + esc(it.policyNo) : '') + '</h3>' + stb(p) + vb(p) +
      '<span class="grow"></span><span class="src">' + (it.wr ? 'We are the broker' : 'Another broker: ' + esc(it.broker || '')) + (it.src && it.src.kind === 'astute' ? ' · figures from the Astute report' + (it.src.date ? ' ' + esc(it.src.date) : '') : '') + '</span><button type="button" class="x" data-upi="' + p + '|policies">Upload policy schedule&hellip;</button></header><div class="grid qh">' +
      lab('Insurer', inp(p + '.insurer', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Date of commencement', inp(p + '.doc', 'date')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ACI as the schedule words it', inp(p + '.aciText', 'text', '', 'e.g. 7.5% + age rater')) + lab('ACI in short points', taLines(p + '.aciPoints')) + lab('ABI (%)', inp(p + '.abi', 'pct')) + lab('Disability to age', sel(p + '.ipAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) +
      lab('Life cover description', inp(p + '.benefits.life', 'text', '', 'e.g. Whole of life')) + lab('Severe illness description', inp(p + '.benefits.sev', 'text', '', 'e.g. Living Lifestyle Plus, standalone')) + lab('Lump sum disability description', inp(p + '.benefits.lsd', 'text', '', 'e.g. Absolute Protector Plus, OOD, to age 65')) + lab('Income protector description', inp(p + '.benefits.ip', 'text', '', 'e.g. after 24 months, to age 65')) +
      lab('Cession', sel(p + '.cession', [{ id: 'true', l: 'Ceded' }, { id: 'false', l: 'Not ceded' }], 'tri')) + '</div>' + linesTable(p, it, true) + (it.cmp || (it.wr && /bright/i.test(it.insurer || '')) ? '<div class="under">' + cmpHTML(it, p) + '</div>' : '') + '</article>';
  }
  function policiesBlock() {
    return '<p class="blue">Current policies are added and removed in the Fact Find; this page follows it. Each row\'s <b>See more</b> opens that policy\'s whole detail (from its schedule) directly under it. A BrightRock policy shows its needs line by line; a policy of any other insurer is one row with its benefits.</p>' + policyTable();
  }

  /* ---------- block 3: group benefits and personal investments ---------- */
  function groupTable() {
    var items = calc.groupItems(state), pi = calc.personalInvestments(state), gt = calc.groupTotals(state), totalPrem = 0;
    var age = state.header.disabilityAge ? ' (Age ' + state.header.disabilityAge + ')' : '';
    function pcell(g, p) { var c = g[p]; return '<td class="c">' + (c && calc.isNum(c.amount) ? (p === 'ip' ? pm(c.amount) : amt(c.amount)) + '<small class="d">' + esc(c.endAge == null || c.endAge === '' ? '' : (/^\d+$/.test(String(c.endAge)) ? 'To age ' + c.endAge : c.endAge)) + '</small>' : amt(c && c.amount === 'Not found' ? 'Not found' : null)) + '</td>'; }
    var rows = items.map(function (g) {
      var prem = g.kind === 'risk' ? g.monthlyCost : (calc.isNum(g.employer) || calc.isNum(g.employee) ? calc.r2((g.employer || 0) + (g.employee || 0)) : g.contribTotal);
      if (calc.isNum(prem)) totalPrem = calc.r2(totalPrem + prem);
      var label = '<b>' + esc(schema.GROUP_KINDS[g.kind] || g.kind) + '</b> ' + esc(g.provider || '') + (g.statementDate ? '<small class="d">Statement ' + esc(g.statementDate) + (g.paidBy ? ' · paid by ' + esc(g.paidBy) : '') + '</small>' : (g.paidBy ? '<small class="d">Paid by ' + esc(g.paidBy) + '</small>' : '')) + (g.src && g.src.kind === 'astute' ? '<small class="d">Astute ' + esc(g.src.date || '') + '</small>' : '');
      if (g.kind === 'risk') return '<tr><td>' + label + '</td>' + pcell(g, 'life') + pcell(g, 'sev') + pcell(g, 'lsd') + pcell(g, 'ip') + '<td class="c">' + esc(g.ipWaiting || '') + '</td><td class="c">' + pctShow(g.aci) + '</td><td class="c">' + pctShow(g.abi) + '</td><td class="c">' + (calc.isNum(prem) ? '<span class="a">' + R(prem) + '</span>' : amt(null)) + '</td></tr>';
      return '<tr><td>' + label + '<small class="d">' + (calc.isNum(g.value) ? 'Fund value ' + R(g.value) + ' · ' : '') + (calc.isNum(g.employer) || calc.isNum(g.employee) ? 'employer ' + R(g.employer || 0) + ', employee ' + R(g.employee || 0) : 'POI needed') + '</small></td><td class="c">' + amt(null) + '</td><td class="c">' + amt(null) + '</td><td class="c">' + amt(null) + '</td><td class="c">' + amt(null) +
        '</td><td class="c"><span class="na">N/A</span></td><td class="c">' + pctShow(g.aci) + '</td><td class="c"><span class="na">N/A</span></td><td class="c">' + (calc.isNum(prem) ? '<span class="a">' + R(prem) + '</span>' : amt(null)) + '</td></tr>';
    }).join('');
    totalPrem = calc.r2(totalPrem + pi.monthly);
    return '<div class="ovw"><table class="ovt grp"><colgroup><col class="p-name"><col><col><col><col><col class="p-w"><col class="p-s"><col class="p-s"><col></colgroup><thead><tr><th>Item</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability' + age + '</th><th>Income protector / sickness benefit' + age + '</th><th>Waiting period</th><th>ACI</th><th>ABI</th><th>Total monthly premium</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">Nothing in the Fact Find yet.</td></tr>') +
      '<tr class="pol"><td><b>Personal investments</b><small class="d">The total of Current investments (' + pi.count + (pi.count === 1 ? ' investment' : ' investments') + ')</small></td><td class="c">' + (pi.count ? amt(pi.gross) : amt(null)) + '</td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c"><span class="na">N/A</span></td><td class="c"><span class="na">N/A</span></td><td class="c"><span class="na">N/A</span></td><td class="c">' + (pi.count ? '<span class="a">' + R(pi.monthly) + '</span>' : amt(null)) + '</td></tr>' +
      '<tr class="tot grand"><td>Total</td><td class="c">' + amt(calc.r2(gt.life + pi.gross)) + '</td><td class="c">' + amt(gt.sev) + '</td><td class="c">' + amt(gt.lsd) + '</td><td class="c">' + pm(gt.ip) + '</td><td colspan="3"></td><td class="c"><span class="a">' + R(totalPrem) + '</span></td></tr></tbody></table></div>';
  }
  function groupCard(it, i) {
    var p = 'blocks.group.items.' + i, body;
    if (it.kind === 'risk') {
      body = '<div class="grid qh">' + lab('Provider', inp(p + '.provider', 'text')) + lab('Statement date', inp(p + '.statementDate', 'date')) + lab('Basis (e.g. 1.5 × insurance salary)', inp(p + '.basis', 'text')) +
        lab('Paid by', sel(p + '.paidBy', schema.PAID_BY, 'text')) + lab('Monthly cost (R)', inp(p + '.monthlyCost', 'money')) + lab('Income protector waiting period', inp(p + '.ipWaiting', 'text')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ABI (%)', inp(p + '.abi', 'pct')) + '</div>' +
        '<div class="grid qh pg">' + PIL.map(function (pl) { return lab(pl.l + (pl.id === 'ip' ? ' (R p.m.)' : ' (R)'), inp(p + '.' + pl.id + '.amount', 'money')) + lab(pl.l + ': benefit ends', inp(p + '.' + pl.id + '.endAge', 'text', '', 'e.g. 65 or Whole of life')); }).join('') + '</div>';
    } else {
      body = '<div class="grid qh">' + lab('Provider', inp(p + '.provider', 'text')) + lab('Fund value (R)', inp(p + '.value', 'money')) + lab('Employer contribution (R p.m.)', inp(p + '.employer', 'money')) + lab('Employee contribution (R p.m.)', inp(p + '.employee', 'money')) +
        lab('Annual contribution increase (%)', inp(p + '.aci', 'pct')) + lab('Note', inp(p + '.note', 'text', '', 'e.g. POI needed')) + '</div>';
    }
    return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(schema.GROUP_KINDS[it.kind] || it.kind) + ' · ' + esc(it.provider || '') + '</h3>' + stb(p) + vb(p) + '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|group">Upload statement&hellip;</button></header>' + body + '</article>';
  }
  function groupBlock() {
    var items = state.blocks.group.items;
    return '<p class="blue">Group risk, pension and provident funds are added and removed in the Fact Find; this page follows it. The ending age of every benefit is read from the statement.</p><div data-comp="grouptab|">' + groupTable() + '</div>' +
      items.map(function (it, i) { return it.removed ? '' : groupCard(it, i); }).join('');
  }

  /* ---------- block 4: shortfall ---------- */
  function shortfallHTML() {
    var s = calc.shortfall(state);
    if (!s.has) return '<p class="empty-list">There is no FNA quote yet. The shortfall is the FNA less what the client already has through group benefits and personal investments.</p>';
    var rows = [['life', 'Life cover', R], ['sev', 'Severe illness', R], ['lsd', 'Lump sum disability', R], ['ip', 'Income protector (R p.m.)', R]];
    return '<div class="ovw"><table class="ovt sf"><thead><tr><th></th><th>FNA</th><th>Less group benefits</th><th>Less personal investments</th><th>Shortfall</th></tr></thead><tbody>' + rows.map(function (r) {
      var pi = r[0] === 'life' ? s.pi.gross : null;
      return '<tr><td>' + r[1] + '</td><td class="c">' + amt(s.fna[r[0]]) + '</td><td class="c">' + (s.group[r[0]] ? amt(s.group[r[0]]) : '<span class="none">none</span>') + '</td><td class="c">' + (pi ? amt(pi) : '<span class="none">none</span>') + '</td><td class="c"><b class="a">' + R(s.short[r[0]]) + '</b></td></tr>';
    }).join('') + '</tbody></table></div><p class="foot">Worked out from ' + esc(check.qLabel(s.quote)) + '. Personal investments (current investments, retirement annuities included) reduce the life cover shortfall only.</p>';
  }
  function shortfallBlock() { return '<div data-comp="sf|">' + shortfallHTML() + '</div>'; }

  /* ---------- block 8: current investments ---------- */
  function invRow(i, idx) {
    var vs = i.valueSource || {}, srcTxt = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? ' ' + vs.date : '') : '', at = state.blocks.investments.items.indexOf(i), p = 'blocks.investments.items.' + at;
    return '<tr class="pol" data-row="' + p + '"><td>' + stb(p) + (i.wr ? '<span class="tick">&#10003;</span>' : '<span class="cross">&#10007;</span>') + ' <b>' + esc(i.provider || 'Investment') + '</b><small class="d">' + esc(i.product || '') + '</small><span class="dvrow">' + vb(p) + seeBtn(i.id) + '</span></td><td class="c">' + esc(i.valueDate || '') + '</td><td class="c">' + esc(srcTxt) + '</td><td class="c">' + amt(i.gross) +
      '</td><td class="c">' + amt(i.penalty) + '</td><td class="c">' + (calc.isNum(i.gross) ? amt(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : amt(null)) + '</td><td class="c">' + pctShow(i.returnRate) + '</td><td class="c">' + pctShow(i.aci) + '</td><td class="c">' + (calc.isNum(i.monthly) ? '<span class="a">' + R(i.monthly) + '</span>' : amt(null)) + '</td></tr>';
  }
  function invTots() {
    var pi = calc.personalInvestments(state);
    return '<tr class="tot grand"><td>Total investments</td><td></td><td></td><td class="c">' + amt(pi.gross) + '</td><td class="c">' + amt(pi.penalty) + '</td><td class="c">' + amt(pi.net) + '</td><td></td><td></td><td class="c"><span class="a">' + R(pi.monthly) + '</span></td></tr>';
  }
  function invTable() {
    var items = calc.investments(state);
    var rows = items.map(function (i, n) {
      return '<tbody data-comp="invrow|' + n + '">' + invRow(i, n) + '</tbody>' + (isOpen(i.id) ? '<tbody class="dtl"><tr><td colspan="9">' + invCard(i, state.blocks.investments.items.indexOf(i)) + '</td></tr></tbody>' : '');
    }).join('') || '<tbody><tr><td colspan="9" class="empty">No investments in the Fact Find yet.</td></tr></tbody>';
    return '<div class="ovw"><table class="ovt inv"><colgroup><col class="p-name"><col class="p-w"><col><col><col><col><col class="p-s"><col class="p-s"><col></colgroup><thead><tr><th>Investment</th><th>Values at</th><th>Source</th><th>Gross fund value</th><th>Penalties</th><th>Net fund value</th><th>Rate of return</th><th>ACI</th><th>Premium</th></tr></thead>' + rows +
      '<tbody data-comp="invtot|">' + invTots() + '</tbody></table></div>';
  }
  function invCard(it, i) {
    var p = 'blocks.investments.items.' + i; if (!it.valueSource) it.valueSource = { kind: null, date: null, file: null };
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.provider || 'Investment') + ' · ' + esc(it.product || '') + '</h3>' + stb(p) + vb(p) + '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|investments">Upload statement&hellip;</button></header><div class="grid qh">' +
      lab('Provider', inp(p + '.provider', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Values at (date)', inp(p + '.valueDate', 'date')) +
      lab('Source', sel(p + '.valueSource.kind', [{ id: 'schedule', l: 'Investment schedule' }, { id: 'astute', l: 'Astute report' }], 'text')) + lab('Source date', inp(p + '.valueSource.date', 'date')) + lab('Source file', inp(p + '.valueSource.file', 'text')) +
      lab('Gross fund value (R)', inp(p + '.gross', 'money')) + lab('Section 14 transfer penalty (R)', inp(p + '.penalty', 'money')) + lab('Rate of return (%)', inp(p + '.returnRate', 'pct')) +
      lab('Annual contribution increase (%)', inp(p + '.aci', 'pct', '', 'Not found')) + lab('Total monthly premium (R)', inp(p + '.monthly', 'money')) + '</div></article>';
  }
  function investmentsBlock() {
    return '<p class="blue">Investments are added and removed in the Fact Find; this page follows it. Every value shows when and where it came from: an investment schedule first, the Astute report only where there is none. <b>See more</b> opens an investment\'s detail under its row.</p>' + invTable();
  }

  /* ---------- blocks 9, 10, 11 ---------- */
  function proposedRow(it, i) {
    var p = 'blocks.proposed.items.' + i;
    return '<tr class="pol" data-row="' + p + '"><td>' + stb(p) + '<b>' + esc(it.type) + '</b><span class="dvrow">' + vb(p) + seeBtn(it.id) + '</span></td><td>' + esc([it.provider, it.quote ? 'Quote ' + it.quote : ''].filter(Boolean).join('   ')) + '</td><td>' + esc(schema.contributionLabel[it.contribution] || '') + '</td><td class="c">' + amt(it.lump) + '</td><td class="c">' + amt(it.monthly) +
      '</td><td class="c">' + pctShow(it.boostPct) + '</td><td class="c">' + amt(it.netInvested) + '</td><td class="c">' + pctShow(it.aci) + '</td></tr>';
  }
  function proposedCard(it, i) {
    var p = 'blocks.proposed.items.' + i;
    return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(it.type) + ' · ' + esc(it.provider || '') + '</h3>' + stb(p) + vb(p) + '<span class="grow"></span><button type="button" class="x" data-del="' + p + '" title="Remove">Remove</button></header><div class="grid qh">' +
      lab('Investment type', sel(p + '.type', schema.PROPOSED_TYPES, 'text', false)) + lab('Provider', inp(p + '.provider', 'text')) + lab('Quote number', inp(p + '.quote', 'text')) + lab('Contribution', sel(p + '.contribution', schema.CONTRIBUTIONS, 'text', false)) +
      lab('Lump sum (R)', inp(p + '.lump', 'money')) + lab('Monthly premium (R)', inp(p + '.monthly', 'money')) + lab('Boost (%)', inp(p + '.boostPct', 'pct')) + lab('Net amount invested (R)', inp(p + '.netInvested', 'money')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + '</div></article>';
  }
  function proposedBlock() {
    var items = state.blocks.proposed.items, any = items.some(function (it) { return !it.removed; });
    var rows = items.map(function (it, i) {
      var p = 'blocks.proposed.items.' + i;
      if (it.removed) return fresh(p) ? '<tbody data-notice="' + p + '"><tr class="removed"><td colspan="8"><span class="gone">' + esc(it.type) + ' removed.</span> <button type="button" class="lnk" data-undo="' + p + '">Undo</button></td></tr></tbody>' : '';
      return '<tbody data-comp="proprow|' + i + '">' + proposedRow(it, i) + '</tbody>' + (isOpen(it.id) ? '<tbody class="dtl"><tr><td colspan="8">' + proposedCard(it, i) + '</td></tr></tbody>' : '');
    }).join('') + (any ? '' : '<tbody><tr><td colspan="8" class="empty">No proposed investments yet.</td></tr></tbody>');
    return '<div class="ovw"><table class="ovt prop"><colgroup><col class="q-type"><col class="q-prov"><col class="q-contrib"><col><col><col class="p-s"><col><col class="p-s"></colgroup><thead><tr><th>Investment type</th><th>Provider &amp; quote</th><th>Contribution</th><th>Lump sum</th><th>Monthly premium</th><th>Boost %</th><th>Net amount invested</th><th>ACI %</th></tr></thead>' + rows + '</table></div>' +
      '<p class="foot">The boost and the net amount are read from the quote; they are not worked out here.</p><div class="blockacts"><button type="button" class="addrow big" data-upc="proposed" title="Opens the client\'s own folder: pick the quote and the page reads it. If the folder is not found, the normal file window opens.">Upload from client folder&hellip;</button> <button type="button" class="lnk small" data-addp="1">type in by hand</button></div>';
  }
  function goalsBlock() {
    var items = state.blocks.goals.items;
    return '<div class="adders"><button type="button" class="addrow big" data-upc="goals" title="Opens the client\'s own folder: pick the report and the page reads it">Upload from client folder&hellip;</button></div>' + (items.map(function (it, i) {
      var p = 'blocks.goals.items.' + i, name = it.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)', open = isOpen(it.id);
      if (it.removed) return fresh(p) ? '<p class="gone" data-notice="' + p + '">' + esc(name) + ' removed. <button type="button" class="lnk" data-undo="' + p + '">Undo</button></p>' : '';
      var head = '<header><h3>' + esc(name) + '</h3>' + stb(p) + vb(p) + '<span class="grow"></span>' + (open ? '<button type="button" class="x" data-del="' + p + '">Remove</button>' : '') + seeBtn(it.id) + '</header>';
      if (!open) return '<article class="qcard folded" data-row="' + p + '">' + head + '</article>';
      return '<article class="qcard" data-row="' + p + '">' + head + '<div class="grid qh">' +
        lab('Requested', boolSel(p + '.requested', 'Requested', 'Not requested')) + lab('Note', inp(p + '.note', 'text', '', 'Client did not request for at this time')) + lab('Current value (R p.m. gross)', inp(p + '.currentValuePm', 'money')) +
        lab('Future value (R p.m. gross)', inp(p + '.futureValuePm', 'money')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('Premium (R p.m.)', inp(p + '.premium', 'money')) + '</div></article>';
    }).join('') || '<p class="empty-list">No goal analysis reports yet. Fill from the Fact Find to add the retirement and education lines.</p>');
  }
  function area(path, rows) {
    var v = store.pathGet(state, path);
    return '<textarea data-p="' + path + '" data-k="text" rows="' + (rows || 3) + '"' + (state.newer ? ' disabled' : '') + '>' + esc(v == null ? '' : v) + '</textarea>';
  }
  function otherBlock() {
    return '<p class="blue">Each cover is filled from what the Fact Find asked and answered (company, product, broker, premium and the Fact Find\'s own notes). <b>Load from client folder</b> then reads the client\'s newest Follow-Up Appointment Summary Notes in <b>2. Fact Find</b> (after the Fact Find) and adds what has progressed to the note. Every part of a note says where it came from: <i>(Fact Find dd/mm)</i> or <i>(Summary Notes dd/mm)</i>. When reading is on, the company, product and premium that those notes mention are read out of them too. Click <b>from Fact Find</b> on an item when it has been checked. Only the legacy protection plan takes a schedule.</p>' +
      state.blocks.other.items.map(function (it, i) {
        var p = 'blocks.other.items.' + i, nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === it.key; })[0] || { l: it.key }).l;
        return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '" data-tickfor="' + p + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(nm) + '</h3>' + stb(p) + (it.key === 'legacy' ? vb(p) + '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|other">Upload policy schedule&hellip;</button>' : '') + '</header><div class="grid qh">' +
          lab('Company', inp(p + '.company', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Broker', boolSel(p + '.wr', 'We are the broker', 'Another broker')) + lab('Premium (R p.m.)', inp(p + '.premium', 'money')) + lab('Note', area(p + '.note', 3), 'wide') + '</div></article>';
      }).join('');
  }

  /* The Counter offers page (round 1.2): every counter offer of the client with the block its quote is in. A derived list: nothing of its own is saved. */
  var COUNTERS = 'counters';
  function counterRows() { var out = []; calc.mainQuotes(state).forEach(function (root) { calc.counterOffers(state, root).forEach(function (c) { out.push({ root: root, c: c, block: schema.blockOfQuote[root.kind] }); }); }); return out; }
  function countersHTML() {
    var rows = counterRows();
    if (!rows.length) return '<p class="sub">There are no counter offers yet. When the client has accepted a quote and the insurer comes back with loadings or exclusions, use Add counter offer&hellip; under that quote.</p>';
    return '<p class="sub">Every counter offer of this client, with the block its quote is in. The client decides on each one; accepting one is the same policy, so it is not a second acceptance.</p><div class="ovw"><table class="ovt cnt"><thead><tr><th>Counter offer</th><th>Block</th><th>Counter offer to</th><th>Client decision</th><th>Premium</th><th>Terms</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
      var c = r.c, pr = calc.counterPremium(state, c), t = c.terms || {}, nl = (t.loadings || []).length, ne = (t.exclusions || []).length, chk = calc.termsToCheck(c), pm = pr && calc.isNum(pr.before) && calc.isNum(pr.after) ? R(pr.before) + ' \u2192 ' + R(pr.after) + ' (' + calc.fmtDiff(pr.diff) + ')' : '\u2013';
      return '<tr><td>' + esc(check.qTitle(c)) + '</td><td>' + esc(schema.blocksById[r.block].title) + '</td><td>' + esc(calc.quoteRef(r.root)) + '</td><td>' + esc(schema.statusLabel[c.status] || '') + '</td><td>' + pm + '</td><td>' + nl + (nl === 1 ? ' loading' : ' loadings') + ', ' + ne + (ne === 1 ? ' exclusion' : ' exclusions') + (chk ? ' \u00b7 ' + chk + ' to check' : '') + '</td><td><button type="button" class="x" data-gocounter="' + r.block + '|' + esc(c.id) + '">Open</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function blockHTML(id) {
    if (id === CLIENT) return clientHTML();
    if (id === COUNTERS) return countersHTML();
    var b = schema.blocksById[id];
    var draw = { policies: policiesBlock, group: groupBlock, shortfall: shortfallBlock, investments: investmentsBlock, proposed: proposedBlock, goals: goalsBlock, other: otherBlock }[b.kind];
    return draw ? draw() : quotesBlock(b);
  }

  /* ---------- the screen ---------- */
  function drawNav() {
    var h = '<button type="button" data-block="' + CLIENT + '"' + (cur === CLIENT ? ' aria-current="true"' : '') + '><span>Client details</span></button><div class="sep">Blocks</div>';
    h += schema.BLOCKS.map(function (b) { return '<button type="button" data-block="' + b.id + '"' + (b.id === cur ? ' aria-current="true"' : '') + ' title="' + esc(check.dotText(state, b.id, last.dots[b.id] || 'grey', last.problems, (last.notes || {})[b.id])) + '"><span><i class="dot ' + (last.dots[b.id] || 'grey') + '" data-dot="' + b.id + '"></i>' + esc(b.title) + '</span>' + progHTML(b.id) + noteHTML(b.id) + '</button>'; }).join('');
    var nc = counterRows().length; if (nc) h += '<button type="button" data-block="' + COUNTERS + '"' + (cur === COUNTERS ? ' aria-current="true"' : '') + ' title="Every counter offer of this client"><span><i class="dot ' + (counterRows().some(function (r) { return calc.termsToCheck(r.c) > 0 || !calc.activeLines(r.c).length || r.c.st !== 'confirmed'; }) ? 'amber' : 'green') + '"></i>Counter offers <small>&nbsp;(' + nc + ')</small></span></button>';
    h += '<div class="legend" id="legend"><div class="sep">The dots</div>' + check.LEGEND.map(function (l) { return '<div><i class="dot ' + l[0] + '"></i>' + (l[0] === 'na' ? 'Dashed: not needed (for example, no shortfall quote without group risk)' : { grey: 'Grey: nothing yet', amber: 'Amber: to check', green: 'Green: checked', red: 'Red: checked, nothing there' }[l[0]]) + '</div>'; }).join('') + '</div>';
    $('#nav').innerHTML = h;
  }
  /* The page before and the page after this one, skipping a page that does not apply (no shortfall quote page without group risk). */
  function pageName(id) { return id === CLIENT ? 'Client details' : id === COUNTERS ? 'Counter offers' : schema.blocksById[id].title; }
  function pagerHTML() {
    var order = [CLIENT].concat(schema.BLOCKS.map(function (b) { return b.id; })).concat(counterRows().length ? [COUNTERS] : []), i = order.indexOf(cur), ok = function (id) { return id === CLIENT || (last.dots || {})[id] !== 'na'; }, prev = null, next = null, j;
    for (j = i - 1; j >= 0 && !prev; j--) if (ok(order[j])) prev = order[j];
    for (j = i + 1; j < order.length && !next; j++) if (ok(order[j])) next = order[j];
    return '<div class="pagenav"><span>' + (prev ? '<button type="button" class="btn small" data-block="' + prev + '">&lsaquo; Back: ' + esc(pageName(prev)) + '</button>' : '') + '</span><span>' + (next ? '<button type="button" class="btn small" data-block="' + next + '">Next: ' + esc(pageName(next)) + ' &rsaquo;</button>' : '') + '</span></div>';
  }
  function drawMain(toTop) {
    var keepTop = $('#main').scrollTop, keepY = window.scrollY, title = pageName(cur);
    $('#main').innerHTML = (state.newer ? '<p class="bad-note">This file was made by a newer version of the Overview, so it is open read-only: nothing can be changed or saved here.</p>' : '') +
      '<header><h2>' + esc(title) + '</h2></header>' + blockHTML(cur) + pagerHTML();
    paintStatuses(); fitTables(); paintView();
    if (toTop) $('#main').scrollTop = 0; else { $('#main').scrollTop = keepTop; window.scrollTo(0, keepY); }
  }
  function redraw() { last = check.run(state, runOpts()); if (OV.view) OV.view.invalidate(); drawNav(); drawMain(true); refreshChrome(); }
  /* An amount never touches or runs into the next column (round 2, 23 November): where a figure of a table is wider than its cell, its type is made smaller (down to 9px) until it fits. */
  function fitTables() {
    [].forEach.call(document.querySelectorAll('#main .ovt td.c'), function (td) {
      var nums = [].slice.call(td.querySelectorAll('.a')); if (!nums.length) return;
      nums.forEach(function (n) { n.style.fontSize = ''; });
      var cs = getComputedStyle(td), room = td.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), fs = parseFloat(getComputedStyle(nums[0]).fontSize) || 13;
      var wide = function (n) { var w = n.getBoundingClientRect().width, pm = n.nextElementSibling; if (pm && pm.classList.contains('pm')) w += pm.getBoundingClientRect().width + 3; return w > room + 0.5; };
      while (fs > 9 && nums.some(wide)) { fs -= 0.5; nums.forEach(function (n) { n.style.fontSize = fs + 'px'; }); }
    });
  }
  window.addEventListener('resize', function () { clearTimeout(fitT); fitT = setTimeout(fitTables, 150); });
  var fitT = null;
  function paintComputed() {
    document.querySelectorAll('[data-comp]').forEach(function (el) { var q = el.getAttribute('data-comp').split('|'); el.innerHTML = compHTML(q[0], q[1]); });
    document.querySelectorAll('[data-aci]').forEach(function (el) { var q = el.getAttribute('data-aci') && store.findQuote(state, el.getAttribute('data-aci')); el.innerHTML = q ? (aciHTML(q) || '\u2013') : ''; });
    fitTables(); paintView();
  }
  function paintStatuses() {
    document.querySelectorAll('[data-row]').forEach(function (el) {
      var o = store.pathGet(state, el.getAttribute('data-row')); if (!o) return;
      el.classList.remove('s-empty', 's-ff', 's-verify', 's-confirmed'); el.classList.add('s-' + (o.st || 'empty'));
      var b = el.querySelector('[data-stfor="' + el.getAttribute('data-row') + '"]'); if (b) b.innerHTML = badgeHTML(el.getAttribute('data-row'), o.st, el.tagName === 'TR', o);
    });
    document.querySelectorAll('[data-statusfor]').forEach(function (el) { var q = store.pathGet(state, el.getAttribute('data-statusfor')); if (q) { el.textContent = calc.statusText(q, state); el.className = 'statusbadge s-' + calc.statusClass(q, state); } });
    document.querySelectorAll('[data-titlefor]').forEach(function (el) { var q = store.pathGet(state, el.getAttribute('data-titlefor')); if (q) el.textContent = check.qTitle(q) + (q.date ? ' \u00b7 ' + q.date : '') + (q.rates ? ' \u00b7 ' + q.rates : ''); });
    document.querySelectorAll('[data-tickfor]').forEach(function (el) { var o = store.pathGet(state, el.getAttribute('data-tickfor')); if (o) { el.className = o.wr ? 'tick' : 'cross'; el.innerHTML = o.wr ? '&#10003;' : '&#10007;'; } });
  }
  /* One line for each document read ("BrightRock FNA CP 100000031 checked") and one for its change moment pay-out; every individual check is still there, folded, one click away. */
  function drawChecks() {
    var h = '', p = last.problems, lines = check.docLines(state, p);
    lines.forEach(function (l) {
      h += '<button type="button" class="docline ' + (l.state === 'checked' ? 'ok' : l.state === 'waiting' ? 'wait' : 'amber') + '" data-jump="' + (l.block || CLIENT) + '"' + (l.tip ? ' title="' + esc(l.tip) + '"' : '') + '><i>' + (l.state === 'checked' ? '&#10003;' : '') + '</i>' + esc(l.text) + '</button>';
    });
    if (!lines.length && !p.length) h = '<div class="ok">&#10003; Nothing to look at.</div>';
    else if (!lines.length) h = '<div class="none">No document has been read yet.</div>';
    var warned = lastLog.filter(function (x) { return x.warn; });
    var look = lines.filter(function (l) { return l.state === 'tocheck'; }).length + warned.length;
    if (warned.length) h += '<details class="allchecks loadlog"><summary>What the last load said: ' + warned.length + ' to look at</summary>' + warned.map(function (x) { return '<div class="amber">' + esc(x.msg) + '</div>'; }).join('') + '</details>';
    if (p.length) h += '<details class="allchecks"' + (checksInner ? ' open' : '') + '><summary>All ' + p.length + (p.length === 1 ? ' individual check' : ' individual checks') + '</summary>' + p.map(function (x) { return '<button type="button" class="amber" data-jump="' + (x.block || CLIENT) + '"><b>' + esc(x.where) + '</b> ' + esc(x.message) + '</button>'; }).join('') + '</details>';
    /* The whole list is folded (Paul, 23 November: he does not want to see it open); it is closed again after every load, fill and check. */
    $('#checks').innerHTML = '<details class="chkall"' + (checksOpen ? ' open' : '') + '><summary>' + (look ? look + (look === 1 ? ' thing' : ' things') + ' to look at' : (lines.length ? 'All checked' : 'Nothing read yet')) + '</summary>' + h + '</details>';
  }
  /* The Progress panel (round 5, Paul 23 November): a click on "to check" or "waiting" goes to the next such row, opens the item or quote that holds it, flashes the row and says which it is and how many there are; the next click goes on to the next one, and after the last it starts again. */
  var pend = { state: null, check: 0, waiting: 0 };
  function itemTitle(o, b) {
    if (b === 'policies') return [o.insurer || 'Policy', o.product].filter(Boolean).join(' ');
    if (b === 'group') return (schema.GROUP_KINDS[o.kind] || o.kind || 'Group') + (o.provider ? ' ' + o.provider : '');
    if (b === 'investments') return [o.provider || 'Investment', o.product].filter(Boolean).join(' ');
    if (b === 'proposed') return [o.type || 'Proposed investment', o.provider].filter(Boolean).join(' ');
    if (b === 'goals') return o.kind === 'rgar' ? 'RGAR' : 'EGAR';
    if (b === 'other') return (schema.OTHER_KEYS.filter(function (k) { return k.key === o.key; })[0] || { l: o.key || 'Other cover' }).l;
    return o.insurer || o.provider || o.type || 'Item';
  }
  function pendTitle(r) {
    var own = /\.quotes\./.test(r.path) ? check.qTitle(r.owner) : itemTitle(r.owner, r.block);
    if (!r.isLine) return own;
    var l = r.row, t = schema.lineTypesById[l.type] || {};
    return [l.label || t.l || 'Line', l.name || '', l.debt || ''].filter(Boolean).join(' ') + ' in ' + own;
  }
  function goPending(kind) {
    var rows = store.pendingRows(state, kind), word = kind === 'check' ? 'To check' : 'Waiting';
    if (pend.state !== state) pend = { state: state, check: 0, waiting: 0 };
    if (!rows.length) { toast(kind === 'check' ? 'Nothing is waiting to be checked.' : 'Nothing is waiting for a document.', 3000); return; }
    var next = rows.filter(function (r) { return r.n > pend[kind]; })[0] || rows[0];
    pend[kind] = next.n;
    cur = next.block;
    if (next.isLine || !/^(policies|investments|proposed)$/.test(next.block)) openSet[next.owner.id] = true;      // what hides the row is opened (a folded quote, a policy for one of its lines); a policy's own row is on the screen already and its detail stays closed
    drawNav(); drawMain(true); refreshChrome();
    var el = document.querySelector('[data-row="' + next.path + '"]') || document.querySelector('[data-row="' + next.path.replace(/\.lines\.\d+$/, '') + '"]');
    if (el) { el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1700); if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
    toast(word + ': ' + pageName(next.block) + ', ' + pendTitle(next) + ' (' + (rows.indexOf(next) + 1) + ' of ' + rows.length + ')', 3500);
  }
  function refreshChrome() {
    last = check.run(state, runOpts());
    var name = store.clientName(state), c = store.counts(state);
    $('#clientName').textContent = name || 'New client';
    document.title = 'Client Overview Studio' + (name ? ' - ' + name : '');
    $('#saveState').textContent = (fileBase ? fileBase + ' · ' : '') + (dirty ? 'unsaved changes' : (lastSaved ? 'saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no changes'));
    $('#sFilled').textContent = c.confirmed; $('#sVerify').textContent = c.check; $('#sEmpty').textContent = c.waiting;
    $('#btnAgree').hidden = !c.check;
    $('#verLine').textContent = 'Version ' + schema.pageVersion + ', ' + schema.released;
    paintDots();
    drawChecks(); drawMeta(); paintWhy();
  }
  function paintWhy() {
    document.querySelectorAll('[data-why]').forEach(function (el) { var t = lineWhy(el.getAttribute('data-why')), tr = el.closest('tr'); el.textContent = t; if (tr) tr.classList.toggle('ffdiff', !!t); });
  }
  function drawMeta() {
    var ff = state.factFind, from = ff && ff.file ? '<div>Filled from the Fact Find <b>' + esc(ff.file) + '</b>' + (ff.changed ? ' <span class="chg">(' + ff.changed + ' changed since)</span>' : '') + '</div>' : '<div>Not filled from a Fact Find yet.</div>';
    if (state.header.previous) from += '<div>A review of the overview of <b>' + esc(state.header.previous.date || '') + '</b> <span class="fn">' + esc(state.header.previous.file || '') + '</span> (last year\'s file is kept as it is).</div>';
    $('#meta').innerHTML = '<div>It saves as</div><div class="fn">' + esc(currentBase()) + '</div><div>in the folder <span class="fn">1. Overview\\' + esc(schema.yearOf(state)) + '</span></div>' + from + (window.FF && FF.foldersUI ? FF.foldersUI.metaHTML(lastFolder) : '');
  }


  /* ---------- documents ---------- */
  var D = OV.docs, AI_KEY = 'wr-overview-read', pending = null, unmatchedGuides = {}, lastLog = [];
  var REASONS = { connect: 'Your client folders are not connected yet (More, then Folders…).', access: 'Chrome has not given this page access to your client folders (More, then Folders…, then choose them again and Allow).', names: 'Fill in the client’s names first, so the folder can be found.', client: 'No folder for this client was found in your connected folders.',
    'slow-permission': 'Chrome did not get an answer to its permission question in time (look next to the address bar for “Edit files?” and click Allow).',
    'slow-find': 'Looking through your client folders took too long (OneDrive may still be fetching the folder lists).',
    'slow-list': 'Reading the client’s folders took too long (OneDrive may still be fetching them).' };
  /* The sentence for a failed search: the reason, which connected folder Chrome did not open, and what Chrome itself said (Client Overview Studio 0.97). */
  function reasonText(res) {
    var t = REASONS[res.reason] || 'The folder could not be read.', why = res.why && Object.keys(res.why).map(function (k) { return res.why[k]; }).filter(Boolean)[0];
    if (res.reason === 'client' && res.skipped && res.skipped.length) t += ' (' + res.skipped.join(' and ') + (res.skipped.length > 1 ? ' were' : ' was') + ' not open to this page, so not searched.)';
    if ((res.reason === 'access' || res.reason === 'slow-permission') && why) t += ' Chrome said: ' + why + '.';
    return t;
  }
  function aiOn() { try { return localStorage.getItem(AI_KEY) !== '0'; } catch (e) { return true; } }          // ON unless the adviser switched it off (Paul, 22 November: reading is the default); the switch is in Settings
  function aiSet(v) { try { localStorage.setItem(AI_KEY, v ? '1' : '0'); } catch (e) { /* kept for this visit only */ } }
  function aiKey() { var s = window.FF && FF.lookup && FF.lookup.getSettings ? FF.lookup.getSettings() : {}; return { apiKey: s.apiKey || '', model: s.model || (FF.lookup && FF.lookup.DEFAULT_MODEL) || '' }; }
  function toBase64(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(new Error('Could not read that file.')); }; r.readAsDataURL(file); }); }
  function listOf(block) { return state.blocks[block].items; }
  function nameOf(block) { return function (x) { return block === 'policies' ? x.insurer : x.provider; }; }

  /* ---------- the bar under a block's name in the menu: a document is downloaded and read (Paul, 22 November) ---------- */
  var prog = {}, progT = null;
  function navBlockOf(block, q) { return block === 'astute' ? 'investments' : block === 'followup' ? 'other' : block === 'cmp' || block === 'counterletter' ? (q && schema.blockOfQuote[q.kind]) || null : block; }
  function progHTML(id) {
    var p = prog[id], st = p ? p.st : '';
    return '<span class="prog' + (st ? ' ' + st : '') + '" data-prog="' + id + '"' + (st ? '' : ' hidden') + (p && p.title ? ' title="' + esc(p.title) + '"' : '') + '><i style="width:' + (p ? Math.round(p.pct) : 0) + '%"></i><em>' + esc(p ? p.text : '') + '</em></span>';
  }
  function paintProg(id) {
    var el = document.querySelector('[data-prog="' + id + '"]'), p = prog[id]; if (!el || !p) return;
    el.hidden = !p.st; el.className = 'prog ' + p.st; el.querySelector('i').style.width = Math.round(p.pct) + '%'; el.querySelector('em').textContent = p.text; if (p.title) el.title = p.title; else el.removeAttribute('title');
  }
  function tick() {
    var any = false;
    Object.keys(prog).forEach(function (k) { var q = prog[k]; if (q.st === 'reading' || q.st === 'searching') { any = true; q.pct += ((q.st === 'searching' ? 55 : 92) - q.pct) * 0.07; paintProg(k); } });
    if (!any) { clearInterval(progT); progT = null; }
  }
  function startTicker() { if (!progT) progT = setInterval(tick, 350); }
  function progStart(id) {
    if (!id) return; var p = prog[id] || (prog[id] = { pct: 0, busy: 0, errs: 0, recorded: 0 });
    if (!p.busy) { p.errs = 0; p.recorded = 0; p.pct = 6; p.err = ''; p.ok = ''; p.title = ''; }
    p.busy = (p.busy || 0) + 1; p.st = 'reading'; p.text = 'Reading the document…'; paintProg(id);
    startTicker();
  }
  function progStep(id, pct, text) { var p = prog[id]; if (!p || p.st !== 'reading') return; if (pct > p.pct) p.pct = pct; if (text) p.text = text; paintProg(id); }
  function progEnd(id, how, text) {                                                                     // how: done | recorded | error; text: what the bar says instead of the usual (the real message of a failure)
    var p = prog[id]; if (!p) return;
    if (how === 'error') { p.errs++; if (text) p.err = text; } else if (how === 'recorded') p.recorded++; else if (text) p.ok = text;
    p.busy = Math.max(0, p.busy - 1); if (p.busy) return;
    p.pct = 100; p.st = p.errs ? 'error' : p.recorded ? 'recorded' : 'done'; p.title = p.errs ? (p.err || '') : '';
    p.text = p.errs ? (p.err || 'Could not read it: see the Checks panel') : p.recorded ? 'Recorded, not read (add your key in Settings)' : (p.ok || 'Downloaded and populated'); paintProg(id);
  }
  function progClear() { prog = {}; ran = false; finished = {}; loading = 0; deferred = false; searchedAll = false; checkTimers.forEach(clearTimeout); checkTimers = []; if (progT) { clearInterval(progT); progT = null; } document.querySelectorAll('[data-prog]').forEach(function (el) { el.hidden = true; }); }

  /* ---------- what a block says when it was checked and nothing is there, and the check that runs on EVERY block (Paul, 23 November) ---------- */
  var ran = false, finished = {}, loading = 0, deferred = false, searchedAll = false, checkTimers = [], STAGGER = 110;         // ran: the page has looked through a folder or a document, or run its checks, in this visit; finished: the blocks whose search or check is over (a block says "nothing found" only then); loading: folder searches and document readings in progress
  function runOpts() { return { ran: ran, done: finished }; }
  function noteOf(id) { return ((last && last.notes) || {})[id] || null; }
  function busy(id) { var p = prog[id]; return !!p && (p.st === 'reading' || p.st === 'checking' || p.st === 'waiting' || p.st === 'searching'); }
  /* The search of the client's folder (round 2, 23 November): until a block's search has finished it says nothing about what it found. Every block shows a neutral bar, "Waiting to search the client folder", then
     "Searching the client folder…" once the folder is being looked through, and only when the search is over does it show its dot (green: found, red: nothing there, with its comment). beginSearch(ids, text) starts it
     for those blocks (default all); endSearch() ends one search and, when the last one has ended, every block finishes with its check; abandonSearch() ends it with no verdict (the normal file window took over). */
  function allIds() { return schema.BLOCKS.map(function (b) { return b.id; }); }
  function setBar(ids, st, text, pct) {
    ids.forEach(function (id) { var p = prog[id]; if (p && p.busy) return; prog[id] = { pct: pct, busy: 0, errs: 0, recorded: 0, st: st, text: text }; paintProg(id); });
  }
  function beginSearch(ids, text) {
    if (!ids) searchedAll = true;                                                                        // a single block's upload does not search the whole folder: the other blocks keep what they said
    ids = ids || allIds(); loading++; checkTimers.forEach(clearTimeout); checkTimers = []; checksOpen = false; checksInner = false;
    ids.forEach(function (id) { delete finished[id]; if (prog[id] && !prog[id].busy) delete prog[id]; });
    setBar(ids, 'waiting', text || 'Waiting to search the client folder', 0); last = check.run(state, runOpts()); paintDots();
  }
  function searching(ids) { setBar(ids || allIds(), 'searching', 'Searching the client folder…', 10); startTicker(); }
  function clearBars(ids) { ids.forEach(function (id) { var p = prog[id]; if (p && (p.st === 'waiting' || p.st === 'searching')) { delete prog[id]; var el = document.querySelector('[data-prog="' + id + '"]'); if (el) el.hidden = true; } }); }
  function abandonSearch() { loading = Math.max(0, loading - 1); if (!loading) { clearBars(allIds()); deferred = false; searchedAll = false; last = check.run(state, runOpts()); paintDots(); } }
  function endSearch() { loading = Math.max(0, loading - 1); if (loading) return Promise.resolve(); deferred = false; var all = searchedAll; searchedAll = false; return checkPass({ search: all }); }
  function noteHTML(id) { var n = busy(id) ? null : noteOf(id); return '<small class="navnote' + (n ? ' ' + n.kind : '') + '" data-note="' + id + '"' + (n ? '' : ' hidden') + '>' + esc(n ? n.text : '') + '</small>'; }
  /* The dot, its hover text and the comment under the name of every block, brought up to date without drawing the menu again. */
  function paintDots() {
    schema.BLOCKS.forEach(function (b) {
      var d = document.querySelector('[data-dot="' + b.id + '"]'), n = busy(b.id) ? null : noteOf(b.id), el = document.querySelector('[data-note="' + b.id + '"]'), btn = d && d.closest('button');
      if (d) d.className = 'dot ' + (last.dots[b.id] || 'grey');
      if (btn) btn.title = check.dotText(state, b.id, last.dots[b.id] || 'grey', last.problems, noteOf(b.id));
      if (el) { el.hidden = !n; el.className = 'navnote' + (n ? ' ' + n.kind : ''); el.textContent = n ? n.text : ''; }
    });
  }
  /* Every block runs its check, one after the other, with a bar under its name while it looks (not only the blocks a document was read for); then the bar goes and the block says what it found: its dot, and, where nothing is there,
     the comment under its name. A block that shows a document read keeps that bar. Resolves when the last block has finished. */
  function checkPass(o) {
    o = o || {};
    if (loading) { deferred = true; return Promise.resolve(); }                                            // a search is running: the blocks finish when it has ended, never before
    checkTimers.forEach(clearTimeout); checkTimers = []; if (o.search || o.explicit) ran = true;
    var all = allIds(), shows = function (id) { var p = prog[id]; return !!p && (p.st === 'reading' || p.st === 'done' || p.st === 'recorded' || p.st === 'error'); };
    all.forEach(function (id) { if (shows(id)) finished[id] = true; });                                    // a block that shows a document read has searched: it keeps its bar
    last = check.run(state, runOpts()); paintDots();
    var ids = all.filter(function (id) { return !shows(id); });
    return new Promise(function (resolve) {
      if (!ids.length) { resolve(); return; }
      var left = ids.length, at = function (ms, fn) { checkTimers.push(setTimeout(fn, ms)); };
      ids.forEach(function (id, i) {
        var t0 = i * STAGGER, step = function (pct) { if (prog[id] && prog[id].st === 'checking') { prog[id].pct = pct; paintProg(id); } };
        at(t0, function () { prog[id] = { pct: 8, busy: 0, errs: 0, recorded: 0, st: 'checking', text: 'Checking…' }; paintProg(id); paintDots(); });
        at(t0 + 150, function () { step(45); }); at(t0 + 300, function () { step(80); });
        at(t0 + 450, function () {
          finished[id] = true; last = check.run(state, runOpts()); var n = noteOf(id), d = last.dots[id];
          if (n && n.all) delete prog[id];
          else prog[id] = { pct: 100, busy: 0, errs: 0, recorded: 0, st: 'checked', text: d === 'green' ? 'Checked' : d === 'amber' ? 'Checked: to look at' : d === 'na' ? 'Not needed' : n ? n.text : 'Checked: waiting for a document' };
          paintProg(id); var el = document.querySelector('[data-prog="' + id + '"]'); if (el && !prog[id]) el.hidden = true;
          paintDots(); if (--left === 0) resolve();
          at(t0 + 450 + 1800, function () { if (prog[id] && prog[id].st === 'checked') { delete prog[id]; var e2 = document.querySelector('[data-prog="' + id + '"]'); if (e2) e2.hidden = true; } });
        });
      });
    });
  }

  /* ---------- Settings: the Anthropic key (the same one the Fact Find keeps) and the reading switch ---------- */
  function keyTail(k) { return k && k.length > 8 ? '…' + k.slice(-4) : ''; }
  function openSettings() {
    var cur = aiKey(), dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg'; dlg.id = 'settingsDlg';
    dlg.innerHTML = '<h3>Settings</h3><p class="help">Reading a document needs your <b>Anthropic key</b>. It is the same key the Fact Find uses (kept in this browser only: each person enters their own once, on their own computer). Nothing is sent to Anthropic while reading is off.</p>' +
      '<label class="f"><span class="l">Anthropic key' + (cur.apiKey ? ' (a key is saved here, ending ' + esc(keyTail(cur.apiKey)) + '; type a new one to replace it)' : ' (none saved yet)') + '</span><div class="box"><input type="password" id="setKey" autocomplete="off" placeholder="' + (cur.apiKey ? 'leave empty to keep the saved key' : 'paste the key here') + '"></div></label>' +
      '<label class="aiswitch"><input type="checkbox" id="setRead"' + (aiOn() ? ' checked' : '') + '> Let Anthropic read the documents I load (a quote is sent together with the Fact Find\'s debts and children, so the debts can be named; what it gives is checked by the page and by you)</label>' +
      '<div class="fbtns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn ghost small" data-clear' + (cur.apiKey ? '' : ' hidden') + '>Remove the saved key</button><button type="button" class="btn small" data-yes>Save</button></div>';
    document.body.appendChild(dlg);
    function end() { if (done) return; done = true; dlg.close(); dlg.remove(); }
    function keep(key) { var s = FF.lookup.getSettings(); FF.lookup.saveSettings(Object.assign({}, s, { apiKey: key })); }
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-yes]')) {
        var v = dlg.querySelector('#setKey').value.trim(); if (v) keep(v);
        aiSet(dlg.querySelector('#setRead').checked); end(); toast(v ? 'Settings saved: the key is kept in this browser.' : 'Settings saved.', 4000); refreshChrome();
      }
      if (e.target.closest('[data-clear]')) { keep(''); end(); toast('The saved key was removed from this browser.', 4000); }
      if (e.target.closest('[data-no]')) end();
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); end(); });
    dlg.showModal(); dlg.querySelector('#setKey').focus();
  }
  /* What a document becomes in the overview. data: what was read (null: only recorded). */
  function put(file, block, cls, data, o) {
    var name = file.name, res = { msg: '' }, lower = (D.BLOCK_LABEL[block] || block).toLowerCase(), astuteSet = block === 'astute' ? D.setAstuteDate(state, data, cls.date) : null;                   // the Astute report's date goes into Client details, whether or not an investment matches
    if (block === 'counterletter') {
      var nums = D.counterRole(name).numbers, ld = Object.assign({}, data || {}); if (!ld.revisedNumber && nums.length) ld.revisedNumber = nums[nums.length - 1];
      var cr = D.applyCounterLetter(state, o.root, ld, name, { signed: o.signedFor ? o.signedFor(name) : null });
      openSet[cr.quote.id] = true; openSet[o.root.id] = true; res.counter = cr.quote;
      res.msg = name + ': ' + (data ? 'read into the counter offer ' + (cr.quote.number ? 'CP ' + cr.quote.number : '') + ': ' + cr.loadings + (cr.loadings === 1 ? ' loading' : ' loadings') + ' and ' + cr.exclusions + (cr.exclusions === 1 ? ' exclusion' : ' exclusions') + ' for you to check (amber)' + (cr.updated ? ' and ' + cr.updated + (cr.updated === 1 ? ' row that was already there was updated' : ' rows that were already there were updated') : '') + '.' : 'recorded, not read (reading needs your Anthropic key): a counter offer was started from the numbers in the file name; type its terms.');
      if (data && !cr.loadings && !cr.exclusions) { res.msg += ' The letter shows no loading or exclusion.'; res.warn = true; }
    } else if (D.QUOTE_OF[block]) {
      var r = D.applyQuote(state, block, data || { number: cls.number, date: cls.date }, name, { replaces: o.replaces, nameOnly: !data, counterOf: o.counterOf });
      if (o.replaces) { var oq = store.findQuote(state, o.replaces), ol = state.blocks[block].quotes; if (oq && ol.indexOf(oq) >= 0) markRemoved('blocks.' + block + '.quotes.' + ol.indexOf(oq)); }          // the quote that was replaced can be brought back for a few seconds
      res.msg = name + ': ' + (data ? 'read into a new ' + lower + '.' : 'a new ' + lower + ' was started from the number and date in the file name; type the figures from the document.');
      if (r.merged === 'kept') { res.msg = name + ': the quote with this number is already there with its figures read, so nothing was changed (no second copy).'; res.dupe = true; }
      else if (r.merged === 'again') { res.msg = name + ': this quote (' + (r.quote.number ? (/bright/i.test(r.quote.insurer) ? 'CP ' : 'Quote ') + r.quote.number : 'no number') + ') was already there: it was read again into the same quote, so there is still only one.'; res.dupe = true; }
      else if (r.duplicate) { res.msg += ' A quote with this number is already there.'; res.warn = true; }
      res.quote = r.quote; openSet[r.quote.id] = true;
      if (data) {
        var rc = reconcile(r.quote), nm = check.autoMatch(state, r.quote);
        res.msg += rc.text + (nm ? ' ' + nm + (nm === 1 ? ' line matches' : ' lines match') + ' the Fact Find and ' + (nm === 1 ? 'is' : 'are') + ' checked.' : ''); if (rc.diffs) res.warn = true;
      }
    } else if (block === 'cmp') {
      if (data) {
        var q = D.applyCmp(state, data, name), num = String((data && data.number) || cls.number || '');
        if (q) { openSet[q.id] = true; res.msg = name + ': the change moment pay-out is filled in under ' + check.qLabel(q) + '.'; }
        else if (unmatchedGuides[num]) res.skip = true;                                                    // listed once: the same guide is not told twice
        else { unmatchedGuides[num] = true; res.msg = name + ': the change moment pay-out guide for CP ' + (num || '?') + ' matches no quote that is loaded.'; res.warn = true; }
      } else res.msg = name + ': recorded. Its table is filled in when reading is on.';
    } else if (block === 'proposed') {
      if (!data) res.msg = name + ': recorded. Use “type in by hand” and type it from the document (or switch reading on in Settings).';
      else { var pr = D.applyProposed(state, data, name); openSet[pr.item.id] = true; res.msg = name + ': ' + (pr.matched ? 'filled into the ' + pr.item.type.toLowerCase() + ' of ' + (pr.item.provider || 'the Fact Find') + ' that the Fact Find asked for' : 'added as a new proposed investment') + '; amber until it is checked.'; if (!pr.matched) res.warn = true; }
    } else if (block === 'goals') {
      if (!data) res.msg = name + ': recorded. Type the figures from the report (or switch reading on in Settings).';
      else { var gl = D.applyGoal(state, data, name); openSet[gl.item.id] = true; res.msg = name + ': the ' + (gl.item.kind === 'rgar' ? 'RGAR' : 'EGAR') + ' is filled in; amber until it is checked.' + (gl.wasRequested ? '' : ' The Fact Find said it was not requested: it is now marked requested.'); if (!gl.wasRequested) res.warn = true; }
    } else if (block === 'followup') {
      if (!data) res.msg = name + ': recorded, not read (switch reading on in Settings). Its progress belongs in the notes of block 11.';
      else {
        var fu = D.applyFollowUp(state, data, name, cls.date), nameOf2 = function (k) { return (schema.OTHER_KEYS.filter(function (x) { return x.key === k; })[0] || { l: k }).l.toLowerCase(); };
        res.msg = name + ': ' + (fu.filled.length ? 'progress added to the note of ' + fu.filled.map(nameOf2).join(', ') + ' (Summary Notes' + (fu.date ? ' ' + D.dm(fu.date) : '') + '); amber until it is checked.' : 'nothing new for medical aid, gap cover, will, legacy plan or short-term.');
      }
    } else if (block === 'bremail') {
      if (!data) res.msg = name + ': a BrightRock email, recorded, not read (reading needs your Anthropic key).';
      else {
        var be = D.applyBrEmail(state, data, name, { date: cls.date, quote: o.quote }); be.filled.forEach(function (x) { check.autoMatch(state, x); openSet[x.id] = true; }); res.filled = be.filled.length;
        res.msg = name + ': ' + (be.filled.length ? 'the death-related income portion was filled into ' + be.filled.map(check.qTitle).join(', ') : 'no death-related income portion was filled in (the quotes have it already, or none is named)') + (be.unmatched.length ? '; the email names ' + be.unmatched.join(', ') + ', which is not a quote that is loaded' : '') + '.'; if (!be.filled.length) res.warn = true;
      }
    } else if (!data) {
      res.msg = name + ': recorded. Use the Upload button on the item it is for, and type its details (or switch reading on in Settings).';
    } else if (block === 'other') {
      if (!o.target) { res.msg = name + ': use the Upload button on the legacy protection plan.'; res.warn = true; }
      else { D.applyOther(state, o.target, data, name); openSet[o.target.id] = true; res.msg = name + ': the legacy protection plan is filled in; amber until it is checked.'; }
    } else if (block === 'astute') {
      var a = D.applyAstute(state, data, name);
      res.msg = name + ': Astute values filled in for ' + a.filled + (a.filled === 1 ? ' investment' : ' investments') + (a.unmatched.length ? '; not in the Fact Find: ' + a.unmatched.join(', ') + '.' : '.') + (astuteSet ? ' The Astute report date ' + astuteSet + ' was filled into Client details.' : ''); if (a.unmatched.length) res.warn = true;
      [[a.policies, 'current policies'], [a.group, 'group benefits']].forEach(function (g) {                          // round 1.1: the fallback for what has no schedule or statement
        var r = g[0]; if (!r) return;
        if (r.filled.length) res.msg += ' Filled from this Astute report (no ' + (g[1] === 'current policies' ? 'schedule' : 'statement') + ' was read for them): ' + r.filled.join(', ') + '.';
        if (r.skipped.length) res.msg += ' Left as they are: ' + r.skipped.join('; ') + '.';
        if (r.unmatched.length) { res.msg += ' In Astute but not in the Fact Find\u2019s ' + g[1] + ': ' + r.unmatched.join(', ') + '.'; res.warn = true; }
      });
    } else {
      var item = o.target || D.matchItem(listOf(block), data, nameOf(block));
      if (item && item.ambiguous) { res.msg = name + ': more than one item could be this one (' + item.ambiguous.map(function (x) { return (x.insurer || x.provider || 'item') + (x.policyNo ? ' ' + x.policyNo : '') + (calc.isNum(x.premium) ? ' R' + x.premium : ''); }).join(', ') + '). Use the Upload button on the right item.'; res.warn = true; }
      else if (!item) { res.msg = name + ': this document is for ' + (data.insurer || data.provider || 'an item') + ', which is not in the Fact Find. Add it in the Fact Find first (this page follows the Fact Find).'; res.warn = true; }
      else {
        if (block === 'policies') D.applyPolicy(state, item, data, name); else if (block === 'group') D.applyGroup(state, item, data, name); else D.applyInvestment(state, item, data, name);
        if (block !== 'policies') openSet[item.id] = true;                                                   // a current policy stays closed (See more): the adviser opens it himself
        res.msg = name + ': the details of ' + (item.insurer || item.provider || 'the item') + ' are filled in; amber until they are checked.';
      }
    }
    D.logDoc(state, name, block, data ? 'read' : 'name');
    return res;
  }
  /* One document into the overview. o: { block (forced), target (an item), replaces (a quote id), dir (the folder it was picked in), pool (the files of the client's folder: where a guide may be), guides }.
     Resolves { msg, warn } or { unknown: true, file }. A BrightRock quote that was read gets its change moment pay-out by itself (the guide "BR CMPO - <CP number>" is looked for and read). */
  function intakeOne(file, o) {
    o = o || {}; if (file.wrTarget && !o.target) o = Object.assign({}, o, { target: file.wrTarget });                 // the legacy plan's own item is the target of a statement found in its policy folder
    var cls = D.classify(file.name, dirOf(file, o)), block = o.block || file.wrBlock || (cls && cls.block);          // round 1.5: a file picked from a policy folder is in the block its FOLDER says (investments or policies), whatever its name
    if (!block) return Promise.resolve({ unknown: true, file: file });
    cls = cls || { number: '', date: '' };
    if (block === 'bremail') return intakeEmail(file, o, cls);
    if (D.QUOTE_OF[block] && !o.replaces && cls.number) {                                                    // its number says it is a quote that is already loaded and read: it is not read (or paid for) twice
      var have = D.quoteIn(state, block, cls.number);
      if (have && D.quoteRead(have)) {                                                                       // not read again, but not forgotten: it is checked again by the current rules and its bar says so
        var nb0 = navBlockOf(block, o.quote), ticked = check.autoMatch(state, have);
        if (!(prog[nb0] && prog[nb0].st === 'done')) { progStart(nb0); progEnd(nb0, 'done', 'Already loaded' + (ticked ? ', ' + ticked + (ticked === 1 ? ' line' : ' lines') + ' checked again' : '')); }
        return Promise.resolve({ msg: file.name + ': already loaded as ' + check.qTitle(have) + '; not read again (to read it again, use Replace quote on it).' + (ticked ? ' ' + ticked + (ticked === 1 ? ' line was' : ' lines were') + ' checked against the quote.' : ''), dupe: true });
      }
    }
    var want = aiOn(), key = aiKey(), read = want && !!key.apiKey, failure = '', nb = navBlockOf(block, o.quote), ctx = D.QUOTE_OF[block] && block !== 'comparative' ? { clientNote: D.factNote(state) } : undefined;
    progStart(nb); progStep(nb, 12, 'Downloading the document…');
    var get = read ? toBase64(file).then(function (b64) { progStep(nb, 28, 'Reading the document…'); return D.readWithClaude({ apiKey: key.apiKey, model: key.model, mediaType: file.type || 'application/pdf', base64: b64, block: block, ctx: ctx }); }).then(function (r) { return r.data; })
      .catch(function (e) { failure = e && e.message ? e.message : 'It could not be read.'; return null; }) : Promise.resolve(null);
    return get.then(function (data) {
      var notice = '';
      if (data && D.isEmptyRead(block, data)) {
        if (block === 'followup') { notice = 'Read: nothing new for these covers'; data = { items: {} }; }          // the notes were read; they say nothing about medical aid, gap cover, will, legacy plan or short-term: not an error
        else { failure = 'Claude read the document but found no figures in it (a scan it could not read, or not the kind of document it was said to be).'; data = null; }
      }
      progStep(nb, 80, 'Filling it in…');
      var r = put(file, block, cls, data, o);
      if (failure) { r.msg = file.name + ': ' + failure + ' It was recorded; type the figures from it.'; r.warn = true; }
      var then = r.quote && data ? autoGuide(r.quote, o).then(function (m) { if (m) { r.msg += ' ' + m.msg; if (m.warn) r.warn = true; } }) : Promise.resolve();
      return then.then(function () { progEnd(nb, failure ? 'error' : data ? 'done' : 'recorded', failure ? 'Could not read it: ' + failure : notice); return r; });
    });
  }
  /* A quote read from the client's folder is compared with the Fact Find's rows the checks already know (each child by name and surname and her childcare amount; each debt by name, bank and instalment): what differs is flagged amber
     (on the line and in the Checks); nothing the document says is changed to match. */
  function reconcile(q) {
    var facts = state.factFind && state.factFind.facts; if (!facts) return { text: '', diffs: 0 };
    var where = check.qLabel(q), probs = check.run(state).problems.filter(function (p) { return (p.id === 'quote.children' || p.id === 'quote.debts') && p.where === where; });
    var head = ' Compared with the Fact Find (' + (facts.children || []).length + ' children, ' + (facts.debts || []).length + ' debts): ';
    return { diffs: probs.length, text: head + (probs.length ? probs.length + (probs.length === 1 ? ' difference is' : ' differences are') + ' flagged amber: ' + probs.slice(0, 3).map(function (p) { return p.short || p.message; }).join(' ') + (probs.length > 3 ? ' (more in the Checks)' : '') : 'everything matches.') };
  }
  /* The change moment pay-out guide of a BrightRock quote (FNA, shortfall, reduced; servicing or new business): "BR CMPO - <CP number>" is looked for among the files of the client's folder that were listed, beside the quote that was picked,
     or in the client's quotes folder, and read like any document. Resolves { msg, warn } or null (not a BrightRock quote, one that has its pay-out already, or reading is off). */
  var GUIDE_RE = /cmpo|change[ _-]?moment/i, DOC_RE = /\.(pdf|png|jpe?g)$/i;
  function guideIn(files, num) { return files.filter(function (f) { return GUIDE_RE.test(f.name) && (f.name.match(/\d{6,12}/g) || []).indexOf(num) >= 0; })[0]; }
  function autoGuide(q, o) {
    var num = String(q.number || '').replace(/\D/g, '');
    if (q.kind === 'comparative' || !/bright/i.test(q.insurer || '') || q.cmp) return Promise.resolve(null);
    if (!num) return Promise.resolve({ msg: 'The quote has no CP number, so its change moment pay-out guide cannot be looked for.', warn: true });
    if (!aiOn() || !aiKey().apiKey) return Promise.resolve(null);                                           // nothing is read: the notice about the key was given already
    var none = { msg: 'No change moment pay-out guide found for CP ' + q.number + '.', warn: true }, FU = window.FF && FF.foldersUI, FL = window.FF && FF.folders;
    function read(hit) {
      if (o.guides) o.guides[num] = true;
      return hit.handle.getFile().then(function (f) { return intakeOne(f, { block: 'cmp', quote: q }); }).then(function (r) { return { msg: r.msg, warn: r.warn }; }, function () { return none; });
    }
    var pool = (o.pool || []).filter(function (f) { return DOC_RE.test(f.name); }), hit = guideIn(pool, num);
    if (hit) return read(hit);
    function search(dir) { return FL && FL.findFiles && dir ? FL.findFiles(dir, DOC_RE).then(function (fs) { var h = guideIn(fs, num); return h ? read(h) : none; }, function () { return none; }) : Promise.resolve(none); }
    if (o.dir) return search(o.dir);
    if (!FU || !FU.clientFolder) return Promise.resolve(none);
    return FU.clientFolder({ sname: state.header.sname, fname: state.header.fname }, 'quote').then(function (res) { return res.reason ? { msg: 'No change moment pay-out guide was looked for: ' + (REASONS[res.reason] || 'the client’s folder could not be opened.'), warn: true } : search(res.handle); }, function () { return none; });
  }
  function blockChoices() { return [['followup', 'Follow-Up Summary Notes'], ['fna', 'FNA quote'], ['shortfallQuote', 'Shortfall quote'], ['reduced', 'Reduced quote'], ['comparative', 'Comparative quote'], ['policies', 'Current policy schedule'], ['group', 'Group or fund statement'], ['investments', 'Investment statement'], ['proposed', 'Proposed investment'], ['goals', 'Goal analysis report'], ['astute', 'Astute report'], ['cmp', 'Change moment pay-out guide'], ['', 'Skip it']]; }
  /* Documents whose name does not say what they are: the adviser says, one by one. Resolves [{ file, block }] for the ones chosen. */
  function askBlocks(files) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>What are these documents?</h3><p>Their names do not say which block they belong in. Choose for each one (or skip it).</p><div class="flist">' + files.map(function (f, i) {
        return '<label><span>' + esc(f.name) + '</span><select data-i="' + i + '">' + blockChoices().map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div><div class="fbtns"><button type="button" class="btn ghost small" data-no>Skip all</button><button type="button" class="btn small" data-yes>Load</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-yes]')) end([].map.call(dlg.querySelectorAll('select'), function (s) { return { file: files[+s.getAttribute('data-i')], block: s.value }; }).filter(function (x) { return x.block; }));
        if (e.target.closest('[data-no]')) end([]);
      });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end([]); });
      dlg.showModal();
    });
  }
  /* The company, product and premium that the Fact Find's own notes of the four covers mention are read out of those notes (round 3, 23 November), into the boxes that are still empty. Only the text of the four notes boxes is sent
     (no ID, phone or e-mail). Once for the same notes; only while reading is on and a key is saved. */
  var notesSig = '', notesBusy = false;
  function readFactNotes() {
    var txt = D.factNotesText(state), key = aiKey();
    if (!txt || !aiOn() || !key.apiKey || notesBusy || txt === notesSig || state.newer) return Promise.resolve();
    if (!state.blocks.other.items.some(function (it) { return !String(it.company || '').trim() || !String(it.product || '').trim() || !calc.isNum(it.premium); })) return Promise.resolve();
    notesBusy = true; notesSig = txt; progStart('other'); progStep('other', 20, 'Reading the Fact Find\u2019s notes\u2026');
    var ended = false;                                                                                     // whatever goes wrong (a refusal, no network, even a throw before the call starts) the bar ends and the next fill may try again
    function fail(e) {
      if (ended) return; ended = true; notesSig = ''; var why = e && e.message ? e.message : 'an error';
      lastLog.push({ msg: 'The Fact Find\u2019s notes could not be read: ' + why, warn: true }); progEnd('other', 'error', 'Could not read the notes: ' + why);
    }
    return Promise.resolve().then(function () { return D.readWithClaude({ apiKey: key.apiKey, model: key.model, block: 'ffnotes', text: txt }); }).then(function (r) {
      var filled = D.isEmptyRead('ffnotes', r.data) ? [] : D.applyNotesRead(state, r.data);
      lastLog.push({ msg: 'The Fact Find\u2019s notes: ' + (filled.length ? 'company, product or premium filled for ' + filled.join(', ') + '.' : 'they do not name a company, product or premium that is still missing.'), warn: false });
      ended = true; progEnd('other', 'done', filled.length ? 'Notes read: company / product filled' : 'Notes read: nothing new');
      if (filled.length) { touch(); redraw(); }
    }).catch(fail).then(function () { notesBusy = false; refreshChrome(); });
  }

  /* A BrightRock e-mail found in the client's folder (or forced into a block): its text is read after the quotes, and the death-related income portion it states goes into the quote it names (round 4, 23 November).
     A text e-mail (.eml, .msg, .txt) that does not mention the CP number of a quote that is loaded is left alone and not sent anywhere. */
  function intakeEmail(file, o, cls) {
    var key = aiKey(), read = aiOn() && !!key.apiKey, bq = D.brightQuotes(state), isText = /\.(eml|msg|txt|html?)$/i.test(file.name), failure = '';
    var nbs = bq.map(function (q) { return schema.blockOfQuote[q.kind]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!bq.length) return Promise.resolve({ msg: file.name + ': a BrightRock email, but no BrightRock quote is loaded yet, so it was not read.', warn: !!o.block });
    var textP = isText ? (/\.msg$/i.test(file.name) ? file.arrayBuffer().then(function (b) { return D.msgText(new Uint8Array(b)); }) : file.text().then(D.emailText)) : Promise.resolve(null);
    return textP.then(function (t) {
      if (isText && !o.block) {                                                                                // found by the listing: only an e-mail that names the CP number of a quote that is here
        var nums = bq.map(function (q) { return String(q.number || '').replace(/\D/g, ''); }).filter(Boolean);
        if (!nums.some(function (n) { return new RegExp('(^|\\D)' + n + '(\\D|$)').test(t || ''); })) return { skip: true };
      }
      nbs.forEach(function (nb) { progStart(nb); progStep(nb, 15, 'Reading the BrightRock email…'); });
      var end = function (how, text) { nbs.forEach(function (nb) { progEnd(nb, how, text); }); };
      if (!read) { end('recorded'); D.logDoc(state, file.name, 'bremail', 'name'); return { msg: file.name + ': a BrightRock email, recorded, not read (reading needs your Anthropic key).', warn: true }; }
      var call = isText ? D.readWithClaude({ apiKey: key.apiKey, model: key.model, block: 'bremail', text: t, textLabel: 'THE E-MAIL' })
        : toBase64(file).then(function (b64) { return D.readWithClaude({ apiKey: key.apiKey, model: key.model, mediaType: file.type || 'application/pdf', base64: b64, block: 'bremail' }); });
      return Promise.resolve(call).then(function (r) { return r.data; }).catch(function (e) { failure = e && e.message ? e.message : 'It could not be read.'; return null; }).then(function (data) {
        if (data && D.isEmptyRead('bremail', data)) { failure = 'it gives no death-related income portion for a quote.'; data = null; }
        var r = put(file, 'bremail', cls, data, o);
        if (failure) { r.msg = file.name + ': ' + failure; r.warn = true; }
        end(failure ? 'error' : 'done', failure ? 'Email: ' + failure : (r.filled ? 'Email read: income portion filled' : 'Email read: nothing new'));
        return r;
      });
    });
  }
  /* "Paste BrightRock email" on a quote: the text pasted in is read for the CP numbers it names, and the death-related income portion goes into the death-related line (the quote it was pasted into takes an unnumbered figure). */
  var breText = {};
  function readPastedEmail(qid) {
    var q = store.findQuote(state, qid), txt = String(breText[qid] || '').trim();
    function say(t, bad) { var m = document.querySelector('[data-bre-msg="' + qid + '"]'); if (m) { m.textContent = t; m.className = 'breMsg' + (bad ? ' bad' : ''); } }
    if (!q) return Promise.resolve();
    if (!txt) { say('Paste the email first.', true); return Promise.resolve(); }
    var key = aiKey();
    if (!aiOn() || !key.apiKey) { toastLink('Reading the email needs your Anthropic key.', 'Add the key in Settings', openSettings, 20000); say('Reading needs your key (More → Settings).', true); return Promise.resolve(); }
    var nb = schema.blockOfQuote[q.kind]; progStart(nb); progStep(nb, 30, 'Reading the BrightRock email…'); say('Reading…');
    return Promise.resolve().then(function () { return D.readWithClaude({ apiKey: key.apiKey, model: key.model, block: 'bremail', text: D.emailText(txt), textLabel: 'THE E-MAIL' }); }).then(function (r) {
      if (D.isEmptyRead('bremail', r.data)) { progEnd(nb, 'done', 'Email read: no income portion in it'); say('The email gives no death-related income portion.', true); return; }
      var a = D.applyBrEmail(state, r.data, 'pasted email', { quote: q });
      a.filled.forEach(function (x) { check.autoMatch(state, x); openSet[x.id] = true; }); check.settleAll(state); D.logDoc(state, 'pasted BrightRock email', 'bremail', 'read');
      lastLog.push({ msg: 'The pasted BrightRock email: ' + (a.filled.length ? 'the death-related income portion was filled into ' + a.filled.map(check.qTitle).join(', ') + '.' : 'nothing new' + (a.unmatched.length ? '; it names ' + a.unmatched.join(', ') + ', which is not a quote that is loaded' : '') + '.'), warn: !a.filled.length });
      touch(); redraw(); progEnd(nb, 'done', a.filled.length ? 'Email read: income portion filled' : 'Email read: nothing new');
      say(a.filled.length ? 'Filled into the death-related line' + (a.filled.length > 1 ? ' of ' + a.filled.length + ' quotes' : '') + '.' : (a.unmatched.length ? 'The email names ' + a.unmatched.join(', ') + ', which is not a quote that is loaded here.' : 'Nothing new: the quote has the figure already.'), !a.filled.length);
    }).catch(function (e) { progEnd(nb, 'error', 'Could not read the email: ' + (e && e.message || 'an error')); say('Could not read it: ' + (e && e.message || 'an error'), true); });
  }
  function breBox(q) {
    if (state.newer || q.kind === 'comparative' || !/bright/i.test(q.insurer || '')) return '';
    return '<details class="bre"><summary>Paste BrightRock email</summary><p class="sub">Paste the email BrightRock sent about this quote (the death-related income portion is often only there). It is read for CP ' + esc(q.number || '') + ', and the figure goes into the death-related line.</p>' +
      '<textarea rows="6" placeholder="Paste the BrightRock email here…" data-bre-text="' + q.id + '">' + esc(breText[q.id] || '') + '</textarea><div class="fbtns"><button type="button" class="btn small" data-bre-read="' + q.id + '">Read it</button> <span class="breMsg" data-bre-msg="' + q.id + '"></span></div></details>';
  }
  /* The underwriters' e-mail (round 1.3, contract revision o): a saved e-mail (.eml, .msg, .txt, a PDF of it) or pasted text is read for the ONE reason for the loadings, which goes into the counter offer's terms.reason with the e-mail's subject, sender and date,
     amber until Terms checked. An e-mail that names only other quotes fills nothing; a reason typed or checked is never replaced. */
  function uwSay(qid, t, bad) { uwMsg[qid] = { t: t, bad: !!bad }; var m = document.querySelector('[data-uw-msg="' + qid + '"]'); if (m) { m.textContent = t; m.className = 'breMsg' + (bad ? ' bad' : ''); } }
  function readUwEmail(qid, file) {
    var q = store.findQuote(state, qid), txt = String(uwText[qid] || '').trim();
    if (!q || !q.counterOf) return Promise.resolve();
    if (!file && !txt) { uwSay(qid, 'Paste the e-mail first, or choose its file.', true); return Promise.resolve(); }
    var key = aiKey(); keepOpen['mail|' + qid] = true;
    var nb = schema.blockOfQuote[q.kind], label = file ? file.name : 'pasted e-mail', isText = !file || /\.(eml|msg|txt|html?)$/i.test(file.name);
    progStart(nb); progStep(nb, 30, 'Reading the underwriter’s e-mail…'); uwSay(qid, 'Reading…');
    var textP = !file ? Promise.resolve({ t: D.emailText(txt), raw: txt }) : !isText ? Promise.resolve(null) : /\.msg$/i.test(file.name) ? file.arrayBuffer().then(function (b) { var m = D.msgText(new Uint8Array(b)); return { t: m, raw: m }; }) : file.text().then(function (raw) { return { t: D.emailText(raw), raw: raw }; });
    return textP.then(function (x) {
      if (x) {                                                                                                  // round 1.4 (Paul): an e-mail as text is read from the exact wording of a real BrightRock reply, on this computer: nothing is sent and no key is needed
        var local = D.uwReasonLocal(x.t, x.raw);
        if (local) return { data: local, local: true };
        var e1 = new Error('No “Our decision is based on the information we received” paragraph was found in it, so no reason was filled in (an older reply may give none). You can type the reason in Correct by hand.'); e1.soft = true; throw e1;
      }
      if (!aiOn() || !key.apiKey) { toastLink('Reading a PDF or a picture of the e-mail needs your Anthropic key.', 'Add the key in Settings', openSettings, 20000); var e0 = new Error('Reading a PDF or a picture of the e-mail needs your Anthropic key (More → Settings).'); e0.soft = true; throw e0; }
      return toBase64(file).then(function (b64) { return D.readWithClaude({ apiKey: key.apiKey, model: key.model, mediaType: file.type || 'application/pdf', base64: b64, block: 'uwemail' }); }).then(function (r) { return { data: r.data, local: false }; });
    }).then(function (r) {
      if (D.isEmptyRead('uwemail', r.data)) { progEnd(nb, 'done', 'E-mail read: no reason in it'); uwSay(qid, 'The e-mail gives no reason for the loadings.', true); return; }
      var a = D.applyUwEmail(state, r.data, label, { quote: q }); if (a.set || a.kept) D.logDoc(state, label, 'uwemail', 'read');          // an e-mail that is not about this quote is not recorded against this client
      var nums = a.mismatch ? a.mismatch.map(function (x) { return 'CP ' + x; }).join(', ') : '';
      var msg = a.set ? 'The reason was filled in from the e-mail' + (r.local ? ' (read on this computer: nothing was sent anywhere)' : '') + ': amber until you tick Terms checked.' : a.kept ? 'The reason was typed or checked already: kept.' : a.mismatch ? 'The e-mail names ' + nums + ', not this quote (CP ' + (q.number || 'no number yet') + '): nothing was filled in.' : 'Nothing was filled in.';
      lastLog.push({ msg: label + ': ' + msg, warn: !a.set }); uwSay(qid, msg, !a.set);
      if (a.set) { check.settleAll(state); touch(); }
      redraw(); progEnd(nb, 'done', a.set ? 'E-mail read: reason filled' : 'E-mail read: nothing filled');
    }).catch(function (e) { var m = e && e.message || 'an error'; progEnd(nb, e && e.soft ? 'done' : 'error', e && e.soft ? 'E-mail: no reason found' : 'Could not read the e-mail: ' + m); uwSay(qid, e && e.soft ? m : 'Could not read it: ' + m, true); });
  }
  /* Documents, one after the other (each may be read by Claude, which takes a moment): QUOTES FIRST, then the pay-out guides (a guide needs its quote), then the ones the adviser had to sort. */
  function ingest(files, o) {
    o = Object.assign({}, o || {}); files = uniqueFiles([].slice.call(files)); unmatchedGuides = {}; o.guides = {};
    var unknown = [], count = 0, warns = 0, log = [], same = 0; lastLog = log;
    (o.notes || []).forEach(function (n) { log.push(n); });                                                 // what the policy folders said about the Fact Find (round 1.5): kept with the last load's messages
    if (o.counted) delete o.counted; else beginSearch(o.block ? [navBlockOf(o.block)].filter(Boolean) : null, o.block ? 'Waiting for the document' : 'Waiting for the documents');          // a load that started with the folder search has counted already
    var ended = false, finish = function () { if (ended) return; ended = true; return endSearch(); };
    var isGuide = function (f) { if (f.wrBlock) return false; var c = D.classify(f.name); return o.block === 'cmp' || (!o.block && c && c.block === 'cmp'); };
    var isEmail = function (f) { if (f.wrBlock) return false; var c = D.classify(f.name, dirOf(f, o)); return o.block === 'bremail' || (!o.block && c && c.block === 'bremail'); };
    var astuteOf = function (f) { return D.classify(f.name, dirOf(f, o) || (f.rel || []).join(' \\ ')); };
    var isAstute = function (f) { if (f.wrBlock) return false; var c = astuteOf(f); return o.block === 'astute' || (!o.block && c && c.block === 'astute'); };          // Astute is the FALLBACK: it is read after the schedules and statements, the newest report last (round 1.1)
    function one(f, oo) {
      var num = (D.classify(f.name) || {}).number;
      if (oo.block === 'cmp' || (!oo.block && isGuide(f))) { if (num && o.guides[num]) { count++; return Promise.resolve(); } }          // its quote has read it already
      return intakeOne(f, oo).then(function (r) { if (r.unknown) { unknown.push(f); return; } if (r.skip) return; if (r.dupe) same++; else count++; if (r.warn) warns++; log.push({ msg: r.msg, warn: !!r.warn }); });
    }
    function chain(list, mk) { return list.reduce(function (p, f) { return p.then(function () { return one(f, mk(f)); }); }, Promise.resolve()); }
    return chain(files.filter(function (f) { return !isGuide(f) && !isEmail(f) && !isAstute(f); }), function () { return o; })
      .then(function () { return chain(files.filter(isGuide), function () { return o; }); })
      .then(function () { return chain(files.filter(isEmail), function () { return o; }); })
      .then(function () {                                                                                // only the NEWEST Astute report is read: an older one would fill boxes the newer one then could not change
        var as = files.filter(isAstute).map(function (f, i) { return { f: f, i: i, k: dkey((astuteOf(f) || {}).date) }; }).sort(function (a, b) { return a.k - b.k || a.i - b.i; }).map(function (x) { return x.f; });
        as.slice(0, -1).forEach(function (f) { log.push({ msg: 'Astute report ' + f.name + ' was not read: a newer Astute report (' + as[as.length - 1].name + ') was read instead.', warn: false }); });
        return chain(as.slice(-1), function () { return o; });
      })
      .then(function () {
        if (!unknown.length) return null;
        return askBlocks(unknown).then(function (picked) {
          var first = picked.filter(function (x) { return x.block !== 'cmp'; }), last2 = picked.filter(function (x) { return x.block === 'cmp'; });
          return chain(first.map(function (x) { return x.file; }), function (f) { return Object.assign({}, o, { block: first.filter(function (x) { return x.file === f; })[0].block }); })
            .then(function () { return chain(last2.map(function (x) { return x.file; }), function () { return Object.assign({}, o, { block: 'cmp' }); }); });
        });
      }).then(function () {
        check.settleAll(state); touch(); redraw(); finish(); readFactNotes();
        if (count && aiOn() && !aiKey().apiKey) toastLink(count + (count === 1 ? ' document was' : ' documents were') + ' recorded, not read: reading needs your Anthropic key.', 'Add the key in Settings', openSettings, 20000);
        else toast((count ? count + (count === 1 ? ' document' : ' documents') + ' loaded' + (warns ? ', ' + warns + ' to look at' : '') + '.' : same ? 'Nothing new was loaded.' : 'Nothing was loaded.') + (same ? ' ' + same + (same === 1 ? ' was' : ' were') + ' already there (each quote is kept once).' : ''), 7000);
        refreshChrome();                                                                                 // the Checks panel lists what needs a look; there is no pop-up
      }).then(null, function (e) { finish(); toast('Loading stopped: ' + ((e && e.message) || 'an error') + '.', 8000); });
  }
  /* The same file seen twice (a client folder found in two places, a copy in two folders) is listed and read ONCE: the first one stays. */
  function uniqueFiles(list) {
    var seen = {};                                                                                       // round 1.5: two policy folders may both hold "Policy Schedule.pdf": a file of a policy folder is told apart by its folder too (a File carries wrDir and wrGroup)
    return list.filter(function (f) {
      var grp = f && (f.group != null || f.wrGroup != null), dir = f && f.wrDir != null ? f.wrDir : ((f && f.rel) || []).join(' \\ ');
      var k = ((grp ? dir + ' \\ ' : '') + String((f && f.name) || '')).toLowerCase().replace(/\s+/g, ' ').trim(); if (seen[k]) return false; seen[k] = 1; return true;
    });
  }
  /* The folder a file was picked in: the File itself knows (round 1.5), else the table made when the list was shown. */
  function dirOf(f, o) { return f && f.wrDir != null ? f.wrDir : (o && o.dirs && o.dirs[String(f && f.name).toLowerCase()]); }
  /* dd/mm/yyyy (or a name's date) as a number that sorts. */
  function dkey(v) { var m = /(\d{1,2})\D(\d{1,2})\D(\d{2,4})/.exec(String(v || '')); if (!m) return 0; var y = +m[3]; if (y < 100) y += 2000; return y * 10000 + (+m[2]) * 100 + (+m[1]); }
  /* Of the Follow-Up Summary Notes in the list, the NEWEST one dated after the Fact Find (the Fact Find's date); only that one is ticked (the adviser can tick others). */
  function newestFollowUp(files) {
    var ff = state.factFind && state.factFind.facts && state.factFind.facts.header && state.factFind.facts.header.date, base = dkey(ff), best = null, bk = 0;
    files.forEach(function (f) { var c = D.classify(f.name); if (!c || c.block !== 'followup') return; var k = dkey(c.date); if (k && k > base && k > bk) { best = f; bk = k; } });
    return best;
  }
  /* Of the Astute reports in the list, the NEWEST (by the date in its name) is the one that is ticked; with no dates to tell them apart every one is ticked. */
  function newestAstute(files) {
    var best = null, bk = 0, any = 0;
    files.forEach(function (f) { var c = D.classify(f.name, (f.rel || []).join(' \\ ')); if (!c || c.block !== 'astute') return; any++; var k = dkey(c.date); if (k && k > bk) { best = f; bk = k; } });
    return { best: best, any: any };
  }
  /* Which files are ticked (round 1.5). A policy folder's NEWEST schedule or statement is ticked (a tie, or a folder whose product the page cannot tell, ticks none and says so); an owner's manual never. Every other document is ticked by what its name says, as before,
     and of several schedules or statements of one policy (the same number in the name, else the same name with its dates taken out) only the newest. Returns { tick: [bool per file], tied: [[files]] }. */
  function tickPlan(res, plan) {
    var F = window.FF && FF.folders, tickFu = newestFollowUp(res.files), tickAs = newestAstute(res.files), groups = res.groups || [];
    var others = res.files.filter(function (f) { return f.group == null; });
    var keyOf = function (f) { var c = D.classify(f.name, (f.rel || []).join(' \\ ')); if (!c || (c.block !== 'policies' && c.block !== 'investments' && c.block !== 'group')) return null; var nk = F && F.numKey ? F.numKey(c.number) : c.number; return c.block + ':' + (nk && nk.length >= 5 ? nk : String(f.name).toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/[^a-z]+/g, ' ').trim()); };
    var kn = F && F.keyedNewest ? F.keyedNewest(others, keyOf) : { tick: new Map(), tied: [] };
    var cyear = new Map(), maxY = 0, older = new Set();                                                       // comparative quotes: only the newest year's (the latest review folder, "2026 - Review") are ticked, older years are listed (Paul, 25 November); a quote with no year anywhere stays as it was
    var inCq = function (f) { return (f.rel || []).some(function (r) { return /comparative quotes?/.test(F.norm(r)); }); };                  // the rule is about the FOLDER too: a file under Comparative Quotes whose name says "RA quote" is a proposal by its name and a comparative quote by its place
    others.forEach(function (f) { var c = D.classify(f.name, (f.rel || []).join(' \\ ')); if (!(c && c.block === 'comparative') && !(c && inCq(f)) || !F || !F.dateKey) return; var k = F.dateKey(f.name, f.rel), y = k.year || (k.exact ? Math.floor(k.exact / 10000) : 0); cyear.set(f, y); if (y > maxY) maxY = y; });
    var tick = res.files.map(function (f) {
      if (f.group != null) { var g = groups[f.group], pr = plan && plan.live ? plan.live[f.group] : null; return !!(g && g.block && f.role !== 'manual' && g.pick && g.pick.file === f && !(pr && pr.ff === 'none')); }          // a policy the Fact Find does not list would be read and then refused (this page follows the Fact Find), so it is not ticked: the chip says why
      var c = D.classify(f.name, (f.rel || []).join(' \\ '));
      var base = !!(c && (c.block !== 'followup' || f === tickFu) && (c.block !== 'astute' || !tickAs.best || f === tickAs.best));
      if (base && F && F.isManual && F.isManual(f.name)) return false;                                         // the owner's manual is never ticked, wherever it is found
      if (base && cyear.has(f) && maxY && cyear.get(f) && cyear.get(f) < maxY) { older.add(f); return false; }
      return base && (!kn.tick.has(f) || kn.tick.get(f));
    });
    var tied = kn.tied.slice(); groups.forEach(function (g) { if (g.pick && g.pick.tie) tied.push(g.pick.tied); });
    return { tick: tick, tied: tied, older: older };
  }
  /* The sentences of the comparison: what the three sources say about each policy folder, and what no folder explains. */
  function ffChip(row, g) {
    if (!row) return null;
    if (row.ff === 'number') return { cls: 'ok', text: 'In the Fact Find (policy number matches)' };
    if (row.ff === 'name') return { cls: 'ok', text: 'In the Fact Find' };
    if (row.ff === 'maybe') return { cls: '', text: 'The Fact Find lists ' + row.n + ' of this insurer: the page cannot tell which this is' };
    if (row.ff === 'none') return { cls: 'warn', text: 'In a folder, but not in the Fact Find' };
    if (row.ff === 'unclear') return { cls: '', text: 'The page cannot tell which insurer this folder is' };
    return { cls: '', text: 'The Fact Find has not been read into this overview yet, so nothing is compared with it' };
  }
  function pickList(res, plan) {
    var F = window.FF && FF.folders, groups = res.groups || [], tp = tickPlan(res, plan), tick = tp.tick, prior = res.priorRead, rowOf = function (i) { return plan && plan.live ? plan.live[i] : null; };
    var fileRow = function (f, i, label, cls, warn) {
      var shown = f.group != null ? (f.rel || []).slice(1).concat([f.name]).join(' \\ ') : (f.rel || []).concat([f.name]).join(' \\ ');
      return '<label' + (cls ? ' class="' + cls + '"' : '') + '><input type="checkbox" data-i="' + i + '"' + (tick[i] ? ' checked' : '') + '><span>' + esc(shown) + (label ? ' <i>(' + esc(label) + ')</i>' : '') + (warn ? ' <em class="pkw">' + esc(warn) + '</em>' : '') + '</span></label>';
    };
    var html = '', idx = function (f) { return res.files.indexOf(f); };
    groups.forEach(function (g, gi) {
      var row = rowOf(gi), chips = [], p = g.p, label = D.BLOCK_LABEL[g.block] || '';
      if (p.linked) chips.push({ cls: '', text: 'Linked to PK: Paul is the broker on record' });
      if (p.unknownStatus) chips.push({ cls: '', text: 'Status “' + p.unknownStatus + '” is not one the page knows: treated as live' });
      var fc = ffChip(row, g); if (fc) chips.push(fc);
      if (row && row.prior === 'number') chips.push({ cls: 'ok', text: 'In the last overview' }); else if (row && row.prior === 'name') chips.push({ cls: 'ok', text: 'In the last overview' });
      if (prior && row && !row.prior) chips.push({ cls: '', text: 'Not in the last overview' });
      var sched = g.files.filter(function (f) { return f.role !== 'manual'; }), manual = g.files.filter(function (f) { return f.role === 'manual'; });
      if (!g.done) chips.push({ cls: 'warn', text: 'Not (fully) read: the search ran out of time' });
      else if (!sched.length) chips.push({ cls: 'warn', text: manual.length ? 'Only the owner’s manual was found' : 'No schedule or statement found' });
      if (!g.block && !g.special) chips.push({ cls: '', text: 'The page cannot tell if this is a policy or an investment: it will ask you what each file is' });
      html += '<div class="pkh"><b>' + esc(g.name) + '</b>' + (g.block ? ' <span class="pkt">' + esc(label) + '</span>' : '') + chips.map(function (c) { return '<span class="pkc ' + c.cls + '">' + esc(c.text) + '</span>'; }).join('') + '</div>';
      var top = g.pick && g.pick.file;
      sched.slice().sort(function (a, b) { return (b.key ? b.key.sort : 0) - (a.key ? a.key.sort : 0) || (b.name < a.name ? -1 : 1); }).forEach(function (f) {
        var tied = g.pick && g.pick.tie && g.pick.tied.indexOf(f) >= 0;
        var why = f === top && row && row.ff === 'none' ? 'not ticked: the Fact Find does not list this policy, so the page would not fill it in' : f === top && !g.block ? 'not ticked: tick it and the page will ask what it is' : '';
        html += fileRow(f, idx(f), f === top ? 'newest' + (label ? ': ' + label : '') + (why ? '; ' + why : '') : tied ? 'as recent as another file here: tick the one you want' : 'older', '', f.from ? 'found in ' + f.from : '');
      });
      if (!sched.length && g.done) manual.forEach(function (f) { html += fileRow(f, idx(f), 'owner’s manual: last resort', 'pkm', 'This is the owner’s manual, not the policy schedule. Load it only if there is nothing else.'); });
    });
    var rest = res.files.map(function (f, i) { return { f: f, i: i }; }).filter(function (x) { return x.f.group == null; });
    if (groups.length && rest.length) html += '<div class="pkh"><b>Other documents</b><span class="pkt">Astute reports, quotes, the schedules of the Policy Schedules folder, notes</span></div>';
    rest.forEach(function (x) {
      var c = D.classify(x.f.name, (x.f.rel || []).join(' \\ '));
      html += fileRow(x.f, x.i, (c ? c.label : '') + (tp.older.has(x.f) ? '; older year: not ticked' : '') + (F && F.isManual && F.isManual(x.f.name) ? '; owner’s manual: never ticked' : ''), '', '');
    });
    var notes = [];
    if (plan && plan.ffOnly && plan.ffOnly.length) notes.push({ cls: 'warn', text: 'In the Fact Find, but no policy folder was found for: ' + plan.ffOnly.map(function (it) { return [it.who, it.product].filter(Boolean).join(' '); }).join('; ') + '.' });
    if (plan && plan.ffNotLive && plan.ffNotLive.length) notes.push({ cls: 'warn', text: 'The Fact Find lists ' + plan.ffNotLive.map(function (x) { return [x.item.who, x.item.product].filter(Boolean).join(' ') + ' (its folder “' + x.folder.name + '” is not live)'; }).join('; ') + '.' });
    if (plan && plan.priorOnly && plan.priorOnly.length) notes.push({ cls: '', text: 'In the last overview only (no folder, not in the Fact Find): ' + plan.priorOnly.map(function (it) { return [it.who, it.product].filter(Boolean).join(' '); }).join('; ') + '.' });
    if (res.notLive && res.notLive.length) notes.push({ cls: '', text: 'Not live, so not looked into: ' + res.notLive.map(function (x) { return x.name; }).join('; ') + '.' });
    if (res.other && res.other.length) notes.push({ cls: '', text: 'Folders that are not policy folders, not looked into: ' + res.other.join('; ') + '.' });
    if (res.overview && !res.overview.json && res.overview.pdf) notes.push({ cls: '', text: 'The last overview (' + res.overview.pdf.name + ') was found as a PDF only, so it was not compared.' });
    groups.forEach(function (g) { if (g.foreign && g.foreign.length) notes.push({ cls: '', text: 'Left out of ' + g.name + ' because their names are another insurer’s, not this policy’s: ' + g.foreign.join('; ') + '.' }); });
    if (res.docsPartial) notes.push({ cls: 'warn', text: 'The search of the client’s other folders stopped at its time limit, so some documents may be missing from this list.' });
    if (res.partial) notes.push({ cls: 'warn', text: 'The search of the policy folders did not finish' + (res.unfinished && res.unfinished.length ? ': not (fully) read: ' + res.unfinished.join('; ') : '') + '. Load what is here and use the buttons on each block for the rest.' });
    if (tp.tied.length) notes.push({ cls: 'warn', text: 'Some files are as recent as each other, so none of them is ticked: ' + tp.tied.map(function (l) { return l.map(function (f) { return f.name; }).join(' and '); }).join('; ') + '.' });
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg wide';
      dlg.innerHTML = '<h3>Documents in ' + esc(res.label) + '</h3><p>' + (groups.length ? 'Each policy folder of the client is listed with its newest schedule or statement ticked. ' : '') + 'Choose what to load into the overview. Ones the page can sort by their name are ticked; the others will ask you what they are. The quotes are read first, then their change moment pay-out guides.</p>' + (res.skipped && res.skipped.length ? '<p class="fnote">' + esc(res.skipped.join(' and ')) + (res.skipped.length > 1 ? ' were' : ' was') + ' not open to this page yet, so only the other connected folder was searched.</p>' : '') + '<div class="flist">' + html + '</div>' + (notes.length ? '<div class="pknotes">' + notes.map(function (n) { return '<p class="' + n.cls + '">' + esc(n.text) + '</p>'; }).join('') + '</div>' : '') + '<div class="fbtns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn small" data-yes>Load the ticked ones</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-yes]')) end([].filter.call(dlg.querySelectorAll('input[type=checkbox]'), function (c) { return c.checked; }).map(function (c) { return res.files[+c.getAttribute('data-i')]; }));
        if (e.target.closest('[data-no]')) end([]);
      });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end([]); });
      dlg.showModal();
    });
  }
  /* The last overview of the client, read for the comparison: only a .json that is a Client Overview file, within a few seconds; anything else is no overview. Resolves the parsed file or null. */
  function loadPrior(res) {
    var h = res.overview && res.overview.json && res.overview.json.handle; if (!h) return Promise.resolve(null);
    var slow = new Promise(function (r) { setTimeout(function () { r(null); }, 4000); });
    return Promise.race([h.getFile().then(function (f) { return f.text(); }).then(function (t) { return JSON.parse(t); }), slow]).then(function (j) { return j && j.app === 'wr-overview' && j.blocks ? j : null; }, function () { return null; });
  }
  /* The ONE top button: the client's folder is found, what it holds is listed, and what is ticked is read and sorted. When the folder cannot be found or the browser has no folder access, the normal file window opens by itself (several files). */
  /* A folder search that waits for something (Chrome's permission question, a slow OneDrive folder) says where it is and for how long, offers to stop, and always ends (Client Overview Studio 0.96: 0.95 had no limit, and "Looking for the
     client's folder…" could stay on the screen for good, every block "Waiting to search"). The limits are in FF.foldersUI.timeouts. */
  var STAGE_TEXT = { permission: 'Waiting for Chrome’s permission question: look next to the address bar and click Allow', find: 'Looking for the client’s folder in New Business and Client Files', list: 'Reading the client’s folders', walk: 'Looking through the client’s folder' };
  var searchTok = 0;
  /* act: { stop(why), again(), choose(), auto() }. auto (Client Overview Studio 0.98) runs by itself when Chrome has not answered even the first question about the connected folders after a few seconds, while the click is still fresh: it is the folder window. After a few seconds of waiting for Chrome the adviser is offered another try (a fresh click, so Chrome counts it), the client's own folder in the browser's folder window, or the normal file window. */
  /* A question the page asks in a window of its own (Client Overview Studio 0.99: Paul asked for the page's own pop-up, not a message that sits behind things, and not the browser's file window opening by itself).
     buttons: [{ text, cls, fn, key }]; a click closes the window and calls fn inside the same click, so a browser window the button opens still has the click behind it. Returns { el, set(html), close() }. */
  function askWindow(title, html, buttons) {
    var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg'; dlg.setAttribute('data-ask', '1');
    dlg.innerHTML = '<h3>' + esc(title) + '</h3><div data-body>' + html + '</div><div class="fbtns">' + buttons.map(function (b, i) { return '<button type="button" class="btn ' + (b.cls == null ? 'ghost' : b.cls) + ' small" data-b="' + i + '">' + esc(b.text) + '</button>'; }).join('') + '</div>';
    var h = { el: dlg, set: function (x) { var d = dlg.querySelector('[data-body]'); if (d) d.innerHTML = x; }, close: function () { if (done) return; done = true; try { dlg.close(); } catch (e) { /* not open */ } dlg.remove(); } };
    dlg.addEventListener('click', function (e) { var b = e.target.closest('[data-b]'); if (!b || done) return; var x = buttons[+b.getAttribute('data-b')]; h.close(); if (x.fn) x.fn(); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); if (done) return; var x = buttons.filter(function (b) { return b.key === 'cancel'; })[0]; h.close(); if (x && x.fn) x.fn(); });
    document.body.appendChild(dlg); dlg.showModal();
    return h;
  }
  function watchSearch(act) {
    var tok = ++searchTok, t0 = Date.now(), stage = 'permission', timer = null, linked = '', perm = '', seen = {}, qans = {}, w = {}, win = null;
    var lim = function () { return (window.FF && FF.foldersUI && FF.foldersUI.timeouts) || {}; };
    w.stale = function () { return tok !== searchTok; };
    w.since = function () { return Date.now() - t0; };
    function closeWin() { if (win) { win.close(); win = null; } }
    w.end = function () { clearInterval(timer); closeWin(); };
    w.stage = function (st) { stage = st; show(); };
    w.perm = function (states, why, qa) { seen = states; qans = qa || {}; perm = Object.keys(states).map(function (k) { return k + ': ' + states[k]; }).join(', '); show(); };
    function go(fn) { return function () { searchTok++; clearInterval(timer); closeWin(); fn(); }; }
    function wanted() { var F = window.FF && FF.folders; return F && F.clientFolderName && F.norm(state.header.sname) !== '' ? F.clientFolderName(state.header.sname, state.header.fname) : ''; }          // no surname yet: no folder to name
    function asked() { return Object.keys(seen).some(function (k) { return seen[k] === 'waiting for your answer'; }); }
    /* Has Chrome answered the FIRST question ("is this connected folder open?") for ANY folder? None: the saved links to the folders look out of date (Client Overview Studio 1.0: measured on Paul's laptop, both stored folders loaded
       at once and Chrome never answered about either, also after a restart of Chrome; choosing them again made them answer at once). */
    function stale() { var k = Object.keys(qans); return k.length > 0 && k.every(function (x) { return !qans[x]; }); }
    /* What the window says: what Chrome has been asked and has answered, and which folder is being looked for. */
    function winHTML(ms, mode) {
      var who = wanted() ? '<p>The page is looking for the folder named <b>' + esc(wanted()) + '</b>.</p>' : '', sec = ' ' + Math.round(ms / 1000) + ' s';
      if (mode === 'stale') return '<p>Chrome has not answered the page’s question about whether your connected folders are open' + (perm ? ' (' + esc(perm) + ')' : '') + '.' + sec + ' The saved links to those folders look out of date.</p>' +
        '<p>Press <b>Reconnect my folders</b>, choose <b>New Business</b> and <b>Client Files</b> again, and the list opens by itself. This is done once.</p>' + who;
      return '<p>' + (asked() ? 'Chrome has been asked and is waiting for you: look next to the address bar for <b>Edit files?</b> and click <b>Allow</b>.' : 'Chrome has not answered the page’s question about your connected folders.') + (perm ? ' (' + esc(perm) + ')' : '') + sec + '</p>' +
        (asked() ? '<p>If no question shows, Chrome is not showing it: ask again, or choose the client’s folder yourself.</p>' : '') + who + '<p>If this keeps happening, go to <b>More</b>, then <b>Folders…</b>, and choose both folders again.</p>';
    }
    function show() {
      if (w.stale()) { clearInterval(timer); closeWin(); return; }
      var ms = Date.now() - t0, T = lim(), t = $('#toast');
      var msg = (STAGE_TEXT[stage] || 'Looking for the client’s folder') + (stage === 'permission' && perm ? ' (' + perm + ')' : '') + '… ' + Math.round(ms / 1000) + ' s';
      var again = stage === 'permission' && !!act.again && ms >= (T.askAgain || 4000), want = again ? 'a' : ms >= (T.stopLink || 8000) ? 's' : '';
      if (again) {                                                                                         // Chrome has had a few seconds: the page's own window, with what it can do (never the browser's file window by itself)
        var mode = stale() && act.reconnect ? 'stale' : 'ask';
        if (win && win.mode !== mode) closeWin();
        if (!win) {
          var bs = [{ text: 'Stop', fn: function () { act.stop('Stopped.'); }, key: 'cancel' }];
          if (mode === 'stale') {                                                                          // the saved links look out of date: Ask Chrome again changes nothing here (a restart of Chrome did not either), so it is not offered
            if (act.choose) bs.push({ text: 'Choose the client’s folder myself', fn: act.choose });
            bs.push({ text: 'Reconnect my folders', cls: '', fn: act.reconnect });
          } else {
            bs.push({ text: 'Ask Chrome again', fn: act.again });
            if (act.choose) bs.push({ text: 'Choose the client’s folder myself', cls: '', fn: act.choose });
          }
          win = askWindow(mode === 'stale' ? 'Your connected folders look out of date' : 'The page cannot open your client folders yet', winHTML(ms, mode), bs.map(function (b) { var f = b.fn; return Object.assign({}, b, { fn: function () { searchTok++; clearInterval(timer); win = null; f(); } }); }));
          win.mode = mode;
        } else win.set(winHTML(ms, mode));
        toast(msg, 600000); return;
      }
      closeWin();
      if (!want) { linked = ''; toast(msg, 600000); return; }
      if (linked !== want) {
        linked = want;
        toastLinks(msg, [{ text: 'Stop and use the normal file window', fn: go(function () { act.stop('Stopped.'); }) }], 600000);
      } else if (t.firstChild && t.firstChild.nodeType === 3) t.firstChild.nodeValue = msg;                      // the button stays where it is, so a click on it is never lost to a redraw
    }
    show(); timer = setInterval(show, 1000);
    return w;
  }
  function loadFromClientFolder() {
    if (state.newer) return;
    var FU = window.FF && FF.foldersUI;
    if (!FU || !FU.clientFiles) { $('#docIn').click(); return; }
    beginSearch();                                                                                       // every block waits: none says "nothing found" before its search is over
    var w = null;
    /* The normal file window opens at once when a click is still fresh; after a long wait the browser would refuse it, so the message carries a button for the click that is needed. click false: never (the folder window just used the click). */
    function normal(why, click) {
      w.end(); searchTok++; abandonSearch();
      if (click === true || (click !== false && w.since() < 4000)) { toast((why ? why + ' ' : '') + 'The normal file window is opening instead.', 8000); $('#docIn').click(); }
      else toastLink((why ? why + ' ' : '') + 'Nothing was loaded.', 'Open the normal file window', function () { $('#docIn').click(); }, 60000);
    }
    function showList(res, click) {
      res.files = uniqueFiles(res.files);
      (res.groups || []).forEach(function (g) { g.files = g.files.filter(function (f) { return res.files.indexOf(f) >= 0; }); if (window.FF && FF.folders) g.pick = FF.folders.newestOf(g.files); });          // a copy that was dropped as a duplicate is not in its group either
      if (!res.files.length) { normal('No documents were found in ' + res.label + '.', click); return; }
      $('#toast').hidden = true; searching();
      if (OV.view && OV.view.seed) OV.view.seed(res.label, res.files);                                    // the View buttons use this list: no second walk of the folder
      var FFs = window.FF && FF.folders;
      loadPrior(res).then(function (pj) {
        res.priorRead = pj;
        var plan = FFs && FFs.comparePolicies ? FFs.comparePolicies(res.groups || [], res.notLive || [], { read: !!(state.factFind && state.factFind.facts), items: D.comparableItems(state) }, pj ? { items: D.comparableItems(pj) } : null) : null;
        return pickList(res, plan).then(function (picked) { return { picked: picked, plan: plan }; });
      }).then(function (pp) {
        var picked = pp.picked, plan = pp.plan;
        if (!picked.length) { abandonSearch(); return; }
        Promise.all(picked.map(function (f) {
          return f.handle.getFile().then(function (file) {                                                  // the file carries where it was found and the block its policy folder says, so two files with one name are never mixed up
            file.wrDir = (f.rel || []).join(' \\ '); if (f.group != null) { file.wrGroup = f.group; var g = (res.groups || [])[f.group]; if (g && g.block && f.role !== 'manual') { file.wrBlock = g.block; if (g.special === 'legacy') file.wrTarget = state.blocks.other.items.filter(function (i) { return i.key === 'legacy'; })[0] || null; } }
            return file;
          });
        })).then(function (fs) {
          var dirs = {}; res.files.forEach(function (f) { if (f.group == null) dirs[String(f.name).toLowerCase()] = (f.rel || []).join(' \\ '); });
          var notes = [];
          if (plan) {
            plan.ffOnly.forEach(function (it) { notes.push({ msg: 'In the Fact Find, but no policy folder was found: ' + [it.who, it.product].filter(Boolean).join(' ') + '.', warn: true }); });
            plan.ffNotLive.forEach(function (x) { notes.push({ msg: 'The Fact Find lists ' + [x.item.who, x.item.product].filter(Boolean).join(' ') + ', but its policy folder (' + x.folder.name + ') is not live.', warn: true }); });
            (res.groups || []).forEach(function (g, i) { var r = plan.live[i]; if (r && r.ff === 'none') notes.push({ msg: 'In a folder but not in the Fact Find: ' + g.name + '.', warn: true }); });
          }
          (res.groups || []).forEach(function (g) { if (g.foreign && g.foreign.length) notes.push({ msg: g.name + ': left out because the names are another insurer\u2019s, not this policy\u2019s: ' + g.foreign.join('; ') + '.', warn: false }); });
          (res.groups || []).forEach(function (g) { if (g.done && !g.files.some(function (f) { return f.role !== 'manual'; })) notes.push({ msg: g.name + ': ' + (g.files.length ? 'only the owner’s manual was found, no schedule.' : 'no schedule or statement was found in the folder.'), warn: true }); });
          if (res.docsPartial) notes.push({ msg: 'The search of the client’s other folders stopped at its time limit, so some documents may be missing.', warn: true });
          if (res.partial) notes.push({ msg: 'The search of the policy folders did not finish' + (res.unfinished && res.unfinished.length ? ' (not fully read: ' + res.unfinished.join('; ') + ')' : '') + '.', warn: true });
          ingest(fs, { pool: res.files, counted: true, dirs: dirs, notes: notes });
        }, function (e) { abandonSearch(); toast('Could not open a file: ' + (e && e.message), 8000); });
      }).catch(function (e) { abandonSearch(); toast('Something went wrong while listing the documents (' + ((e && e.message) || e) + ').', 8000); });
    }
    /* Chrome would not say yes to the connected folders (or the adviser would rather not wait): the client's own folder is chosen in the browser's folder window (only when the adviser presses the button), which is the permission,
       and the same list opens. The folder chosen is checked against the client (0.99: the window opens where it was last used, which may be another client's folder, and whatever was chosen was loaded): the folder of ANOTHER
       client is refused with a button to choose again, a folder whose name is not a client's (a subfolder, say) is asked about, and the client's own folder goes straight through. */
    function chooseFolder() {
      if (FF.folders.norm(state.header.sname) === '') { abandonSearch(); toast(REASONS.names + ' The folder window was not opened.', 8000); return; }          // with no client name there is nothing to check a chosen folder against (0.99)
      FU.pickClientFolder().then(function (res) {
        if (res.reason === 'cancelled') { abandonSearch(); toast('Nothing was chosen.', 3000); return; }
        if (res.reason) { normal(res.reason === 'unsupported' ? 'This browser cannot open a folder window.' : res.reason === 'slow-list' ? REASONS['slow-list'] : 'The folder could not be read' + (res.why ? ' (' + res.why + ')' : '') + '.', false); return; }
        var F = window.FF && FF.folders, sn = state.header.sname, fn = state.header.fname, want = F.clientFolderName(sn, fn), same = F.clientMatches(res.label, sn, fn), other = !same && !!F.parseClient(res.label);
        if (same) { showList(res, false); return; }
        $('#toast').hidden = true;                                                                                          // the old "waiting for Chrome" message must not sit under the question
        var stop = { text: 'Cancel', fn: function () { abandonSearch(); toast('Nothing was loaded.', 3000); }, key: 'cancel' }, again = { text: 'Choose again', cls: '', fn: chooseFolder };
        if (other) askWindow('That is another client’s folder', '<p>You chose <b>' + esc(res.label) + '</b>, but this overview is for <b>' + esc(want) + '</b>. Nothing was loaded.</p>', [stop, again]);
        else askWindow('Is this the client’s folder?', '<p>You chose <b>' + esc(res.label) + '</b>. This overview is for <b>' + esc(want) + '</b>, and that folder’s name is not a client’s name. Load its documents anyway?</p>', [stop, again, { text: 'Load them anyway', cls: '', fn: function () { showList(res, false); } }]);
      }).catch(function (e) { normal('Something went wrong while reading the folder (' + ((e && e.message) || e) + ').', false); });
    }
    /* The saved links to the connected folders look out of date: the Folders… dialog opens, and when a folder was chosen again the search starts over by itself (the new links answer at once); when none was, nothing is loaded and nothing loops (Studio 1.0). */
    function reconnect() {
      FU.connect().then(function (r) {
        drawMeta(); if (OV.view) OV.view.forget();
        if (r && r.chosen && r.chosen.length) run();
        else { abandonSearch(); toast('No folder was chosen again, so nothing was loaded.', 6000); }
      });
    }
    function run() {
      var me = watchSearch({ stop: function (why) { normal(why, true); }, again: run, choose: FU.pickClientFolder ? chooseFolder : null, reconnect: reconnect });
      w = me;
      FU.clientFiles({ sname: state.header.sname, fname: state.header.fname }, { onStage: me.stage, onPerm: me.perm }).then(function (res) {
        if (me.stale()) return; me.end();
        if (res.reason) { normal(reasonText(res)); return; }
        showList(res);
      }).catch(function (e) { if (me.stale()) return; normal('Something went wrong while looking for the client’s folder (' + ((e && e.message) || e) + ').'); });
    }
    run();
  }

  /* ---------- Add counter offer (round 1.2) ---------- */
  function baseOf(name) { return String(name || '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '').replace(/[ _-]*signed\s*$/, '').replace(/\s+/g, ' ').trim(); }
  /* The files of the Counter Offer Letter folders: the letter and the revised proposal for THIS quote are ticked (by the quote's number, and the revised number the letter names); the consent form and a signed copy never are. */
  function pickCounter(res, root) {
    var key = String(root.number || '').replace(/\D/g, ''), info = res.files.map(function (f) { return D.counterRole(f.name); }), tick = info.map(function (c) { return false; });
    var cs = calc.counterOffers(state, root);
    var twin = res.files.map(function (f, i) { return info[i].role === 'signed' && res.files.some(function (g, j) { return info[j].role !== 'signed' && info[j].role !== 'consent' && baseOf(g.name) === baseOf(f.name); }); });          // a signed copy is only noticed when the unsigned letter is there; on its own it is the letter
    var loaded = res.files.map(function (f, i) { var c = info[i]; return twin[i] ? false : (c.role === 'letter' || c.role === 'signed' || c.role === 'other') ? cs.some(function (x) { return x.offer && x.offer.letter && baseOf(x.offer.letter) === baseOf(f.name); }) : c.role === 'quote' ? cs.some(function (x) { return c.numbers[0] && String(x.number || '').replace(/\D/g, '') === c.numbers[0] && D.quoteRead(x); }) : false; });
    info.forEach(function (c, i) { if (loaded[i] || twin[i]) return; if ((c.role === 'letter' || c.role === 'signed') && (!key || c.numbers.indexOf(key) >= 0)) tick[i] = true; if (c.role === 'other' && key && c.numbers.indexOf(key) >= 0) tick[i] = true; });
    var revised = {}; info.forEach(function (c, i) { if ((tick[i] || loaded[i]) && (c.role === 'letter' || c.role === 'signed') && c.numbers.length > 1 && (!key || c.numbers.indexOf(key) >= 0)) revised[c.numbers[c.numbers.length - 1]] = 1; });
    info.forEach(function (c, i) { if (c.role === 'quote' && !loaded[i] && ((c.numbers[0] && revised[c.numbers[0]]) || (!key && !Object.keys(revised).length))) tick[i] = true; });
    var WORD = { letter: 'counter offer letter', quote: 'counter offer quote', consent: 'consent form: not read', signed: 'signed copy: it tells you the client accepted', other: 'not sure what this is' };
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>Counter offer files in ' + esc(res.label) + '</h3><p>The counter offer letter and the counter offer quote of <b>' + esc(calc.quoteRef(root)) + '</b> are ticked. Untick what you do not want to load.</p><div class="flist">' + res.files.map(function (f, i) {
        return '<label><input type="checkbox" data-i="' + i + '"' + (tick[i] ? ' checked' : '') + (info[i].role === 'consent' || twin[i] ? ' disabled' : '') + '><span>' + esc(f.rel.concat([f.name]).join(' \\ ')) + ' <i>(' + esc(WORD[info[i].role] + (twin[i] ? ': not read, only noticed' : '') + (loaded[i] ? '; already loaded, tick it to read it again' : '')) + ')</i></span></label>';
      }).join('') + '</div><div class="fbtns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn small" data-yes>Load the ticked ones</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-yes]')) end([].filter.call(dlg.querySelectorAll('input[type=checkbox]'), function (c) { return c.checked && !c.disabled; }).map(function (c) { return res.files[+c.getAttribute('data-i')]; }));
        if (e.target.closest('[data-no]')) end([]);
      });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end([]); });
      dlg.showModal();
    });
  }
  /* The letters are read first (they make the counter offer and its terms), then the revised proposals (read like any quote, into the counter offer with the same number). pool: every file of the folder (a signed copy is only noticed). */
  function ingestCounter(files, root, pool) {
    files = uniqueFiles([].slice.call(files)); unmatchedGuides = {};
    var bid = schema.blockOfQuote[root.kind], log = [], count = 0, warns = 0, same = 0; lastLog = log;
    var signed = {}; (pool || files).forEach(function (f) { if (D.counterRole(f.name).role === 'signed') signed[baseOf(f.name)] = f.name; });
    var opts = { root: root, quote: root, pool: pool || files, signedFor: function (n) { return signed[baseOf(n)] || null; } };
    beginSearch([bid], 'Waiting for the counter offer files');
    var role = function (f) { return D.counterRole(f.name).role; };
    var letters = files.filter(function (f) { var r = role(f); return r === 'letter' || r === 'other' || r === 'signed'; }), quotes = files.filter(function (f) { return role(f) === 'quote'; });
    function seq(list, mk) { return list.reduce(function (p, f) { return p.then(function () { return intakeOne(f, mk(f)).then(function (r) { if (r.unknown || r.skip) return; if (r.dupe) same++; else count++; if (r.warn) warns++; log.push({ msg: r.msg, warn: !!r.warn }); }); }); }, Promise.resolve()); }
    return seq(letters, function () { return Object.assign({}, opts, { block: 'counterletter' }); })
      .then(function () { return seq(quotes, function () { return Object.assign({}, opts, { block: bid, counterOf: root.id }); }); })
      .then(function () {
        check.settleAll(state); touch(); redraw(); endSearch(); readFactNotes();
        var cs = calc.counterOffers(state, root), last = cs[cs.length - 1];
        if (count && aiOn() && !aiKey().apiKey) toastLink(count + (count === 1 ? ' file was' : ' files were') + ' recorded, not read: reading needs your Anthropic key.', 'Add the key in Settings', openSettings, 20000);
        else toast((count ? count + (count === 1 ? ' counter offer file' : ' counter offer files') + ' loaded' + (warns ? ', ' + warns + ' to look at' : '') + (last ? ' into ' + check.qTitle(last) : '') + '.' : same ? 'Nothing new was loaded.' : 'Nothing was loaded.'), 8000);
        refreshChrome();
        if (last) { var el = document.querySelector('[data-counter="' + last.id + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
      }).then(null, function (e) { endSearch(); toast('Loading stopped: ' + ((e && e.message) || 'an error') + '.', 8000); });
  }
  function addCounter(qpath) {
    if (state.newer) return;
    var root = store.pathGet(state, qpath); if (!root || !calc.canCounter(state, root)) return;
    var FU = window.FF && FF.foldersUI;
    function normalWindow() {
      if (typeof window.showOpenFilePicker !== 'function') { toast('This browser cannot open files this way. Use Chrome or Edge.', 8000); return; }
      window.showOpenFilePicker({ multiple: true, types: FILE_TYPES, id: 'overview-docs' }).then(function (hs) { return Promise.all(hs.map(function (h) { return h.getFile(); })); })
        .then(function (fs) { if (fs.length) ingestCounter(fs, root, fs); }, function (e) { if (e && e.name === 'AbortError') { toast('Nothing was chosen.', 3000); return; } toast('Could not open the file window: ' + ((e && e.message) || e), 8000); });
    }
    if (!FU || !FU.counterFiles) { normalWindow(); return; }
    var w = watchSearch({ stop: function (why) { counterGiveUp(why); }, again: function () { addCounter(qpath); }, reconnect: function () {
      FU.connect().then(function (r) { drawMeta(); if (OV.view) OV.view.forget(); if (r && r.chosen && r.chosen.length) addCounter(qpath); else { w.end(); searchTok++; toast('No folder was chosen again, so nothing was loaded.', 6000); } });
    } });
    function counterGiveUp(why) { w.end(); searchTok++; toastLink((why ? why + ' ' : '') + 'Nothing was loaded.', 'Open the normal file window', normalWindow, 60000); }
    FU.counterFiles({ sname: state.header.sname, fname: state.header.fname }, { onStage: w.stage, onPerm: w.perm }).then(function (res) {
      if (w.stale()) return; w.end();
      if (res.reason) { counterGiveUp(reasonText(res)); return; }
      $('#toast').hidden = true;
      if (!res.files.length) { toastLink('No counter offer files were found for this client (they are in a folder named Counter Offer Letter inside the policy folder).', 'Open the normal file window', normalWindow, 60000); return; }
      pickCounter(res, root).then(function (picked) {
        if (!picked.length) return;
        Promise.all(picked.map(function (f) { return f.handle.getFile(); })).then(function (fs) { ingestCounter(fs, root, res.files); }, function (e) { toast('Could not open a file: ' + ((e && e.message) || e), 8000); });
      });
    }).catch(function (e) { if (w.stale()) return; counterGiveUp('Could not look through the folders (' + ((e && e.message) || e) + ').'); });
  }

  /* "Upload from client folder": the client's own folder (the quotes folder where there is one) is found in the connected folders and the file window opens in it; the document picked is read and filled in.
     When the folder is not found (or not connected) the normal file window opens by itself. */
  var CLIENT_KIND = { fna: 'quote', shortfallQuote: 'quote', reduced: 'quote', comparative: 'comparative', proposed: 'proposal', goals: 'goal' };
  var FILE_TYPES = [{ description: 'Documents', accept: { 'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] } }];
  function pickIn(handle) { return window.showOpenFilePicker({ startIn: handle || undefined, multiple: false, types: FILE_TYPES, id: handle ? undefined : 'overview-docs' }).then(function (hs) { return hs[0].getFile(); }); }
  /* The browser wants a fresh click to open its file window: when the search for the folder took too long, one more click is asked for. */
  function askToChoose(label) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>Choose the document</h3><p>' + (label ? 'The client’s folder <b>' + esc(label) + '</b> is ready.' : 'The file window is ready.') + ' Click Choose to open it.</p><div class="fbtns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn small" data-yes>Choose&hellip;</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) { if (e.target.closest('[data-yes]')) end(true); if (e.target.closest('[data-no]')) end(false); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end(false); });
      dlg.showModal();
    });
  }
  /* The normal file window for one document of a block (no client folder to start in). */
  function pickAny(block, dir) {
    if (typeof window.showOpenFilePicker !== 'function') { pending = { block: block }; $('#docOne').click(); return; }
    var go = function (file) { if (file) ingest([file], { block: block, dir: dir || null }); };
    pickIn(null).then(go, function (e) {
      if (e && e.name === 'AbortError') { toast('Nothing was chosen.', 3000); return; }
      return askToChoose('').then(function (yes) { if (yes) return pickIn(null).then(go, function (e2) { if (!(e2 && e2.name === 'AbortError')) toast('Could not open the file window: ' + (e2 && e2.message), 8000); }); });
    });
  }
  function fromClientFolder(block) {
    if (state.newer) return;
    var FU = window.FF && FF.foldersUI;
    if (!FU || !FU.clientFolder || typeof window.showOpenFilePicker !== 'function') { pickAny(block); return; }
    var w = watchSearch({ stop: function (why) { giveUp(why, true); }, again: function () { fromClientFolder(block); }, reconnect: function () {
      FU.connect().then(function (r) {
        drawMeta(); if (OV.view) OV.view.forget();
        if (r && r.chosen && r.chosen.length) fromClientFolder(block); else { w.end(); searchTok++; toast('No folder was chosen again, so nothing was loaded.', 6000); }
      });
    } });
    function giveUp(why, click) {                                                                           // the same as Load: a fresh click opens the normal window at once, a late one is asked for
      w.end(); searchTok++;
      if (click || w.since() < 4000) { toast((why ? why + ' ' : '') + 'The normal file window is opening instead.', 8000); pickAny(block); }
      else toastLink((why ? why + ' ' : '') + 'Nothing was loaded.', 'Open the normal file window', function () { pickAny(block); }, 60000);
    }
    FU.clientFolder({ sname: state.header.sname, fname: state.header.fname }, CLIENT_KIND[block], { onStage: w.stage, onPerm: w.perm }).then(function (res) {
      if (w.stale()) return null; w.end();
      if (res.reason) { giveUp(reasonText(res)); return null; }
      $('#toast').hidden = true;
      var go = function (file) { if (file) ingest([file], { block: block, dir: res.handle }); };
      return pickIn(res.handle).then(go, function (e) {
        if (e && e.name === 'AbortError') { toast('Nothing was chosen.', 3000); return; }
        return askToChoose(res.label).then(function (yes) { if (yes) return pickIn(res.handle).then(go, function (e2) { if (!(e2 && e2.name === 'AbortError')) toast('Could not open the file window: ' + (e2 && e2.message), 8000); }); });
      });
    }).catch(function (e) { if (w.stale()) return; giveUp('Could not look through the folders (' + ((e && e.message) || e) + ').'); });
  }

  /* ---------- events ---------- */
  function pathOf(attr) { return String(attr).split('|'); }
  function typed(el) {
    var p = el.getAttribute('data-p'), k = el.getAttribute('data-k');
    if (!p) return false;
    store.setPath(state, p, el.tagName === 'SELECT' && k === 'bool' ? el.value === '1' : el.value, k);
    dirty = true; onDisk = false; return true;
  }
  $('#main').addEventListener('input', function (e) {
    var el = e.target; if (el.tagName === 'SELECT' || !typed(el)) return;
    paintComputed(); paintStatuses(); saveDraft(); refreshChromeSoft();
  });
  var softT = null;
  function refreshChromeSoft() { clearTimeout(softT); softT = setTimeout(refreshChrome, 250); }
  $('#main').addEventListener('change', function (e) {
    var el = e.target;
    var uwr = el.getAttribute && el.getAttribute('data-uwreason');
    if (uwr) { if (state.newer) return; store.setUwReason(state, uwr, el.value); check.settleAll(state); dirty = true; onDisk = false; touch(); redraw(); return; }          // the adviser's own reason for the loadings: it is his word, a later e-mail never replaces it
    var pick = el.getAttribute && el.getAttribute('data-replpick'), sec = el.getAttribute && el.getAttribute('data-second'), ans = el.getAttribute && el.getAttribute('data-replans');
    if (pick || sec || ans) {                                                                                  // the adviser's answers about a quote (round 1.1): never a check of the quote's figures
      if (state.newer) return;
      if (pick) { var pp = pathOf(pick); store.toggleReplaced(state, pp[0], pp[1], el.checked); } else if (sec) store.setSecond(state, sec, el.checked); else store.setRepl(state, ans, el.value);
      dirty = true; onDisk = false; touch(); redraw(); return;
    }
    var p = el.getAttribute('data-p'); if (!p) return;
    var sm = el.tagName === 'SELECT' && /^(blocks\.\w+\.quotes\.\d+)\.status$/.exec(p);
    if (sm) { store.setStatus(state, sm[1], el.value); dirty = true; onDisk = false; touch(); redraw(); warnAcceptance(sm[1]); return; }          // Accepted goes to underwriting by itself
    var bm = el.tagName === 'SELECT' && /^(blocks\.policies\.items\.\d+)\.brokerRecord$/.exec(p);
    if (bm) { store.setBrokerRecord(state, bm[1], el.value); dirty = true; onDisk = false; touch(); redraw(); return; }
    if (el.tagName === 'SELECT') { typed(el); if (/\.status$|\.requested$|\.wr$|\.uw$|\.terms\.loadings\.\d+\.kind$/.test(p)) { touch(); redraw(); if (/\.uw$/.test(p)) warnAcceptance(p.replace(/\.uw$/, '')); return; } }
    if (el.tagName === 'INPUT' && /\.brokerChangedDate$/.test(p)) { typed(el); touch(); redraw(); return; }
    if (el.tagName === 'INPUT' && /\.terms\.(loadings|exclusions)\.\d+\./.test(p)) { touch(); redraw(); return; }
    if (el.tagName === 'INPUT' && /\.quotes\.\d+\.premium$/.test(p) && (store.pathGet(state, p.replace(/\.premium$/, '')) || {}).counterOf) { check.settleAll(state); touch(); redraw(); return; }          // a premium typed on a counter offer quote is the adviser's check of the figure (the letter's figure follows it): the warning and the premium line are drawn again
    var k = el.getAttribute('data-k'), v = store.pathGet(state, p);
    if (el.tagName === 'INPUT') { el.value = dispIn(v, k); el.classList.toggle('isna', v === 'N/A' || v === 'Not found'); }
    touch(); paintComputed(); paintStatuses();
  });
  $('#main').addEventListener('click', function (e) {                                                      // a View button opens the document inside the page (also in a read-only file)
    var vbn = e.target.closest && e.target.closest('[data-vw]'); if (!vbn) return;
    e.preventDefault(); e.stopPropagation(); if (!vbn.disabled && OV.view) OV.view.open(vbn.getAttribute('data-vw'), vbn, 'studio');
  }, true);
  $('#main').addEventListener('click', function (e) {
    var t = e.target.closest('[data-see],[data-accept],[data-addq],[data-addl],[data-addp],[data-del],[data-undo],[data-block],[data-replace],[data-upi],[data-addcmp],[data-delcmp],[data-upc],[data-addterm],[data-delterm],[data-addcounter],[data-confirmterms],[data-gocounter]'); if (!t) return;
    if (t.hasAttribute('data-block')) { cur = t.getAttribute('data-block'); drawNav(); drawMain(true); refreshChrome(); window.scrollTo({ top: 0 }); return; }
    if (t.hasAttribute('data-see')) { var sk = t.getAttribute('data-see'); openSet[sk] = !isOpen(sk); drawMain(); return; }
    if (t.hasAttribute('data-gocounter')) { var gc = pathOf(t.getAttribute('data-gocounter')); cur = gc[0]; openSet[gc[1]] = true; drawNav(); drawMain(true); refreshChrome(); var gel = document.querySelector('[data-counter="' + gc[1] + '"]'); if (gel && gel.scrollIntoView) gel.scrollIntoView({ block: 'center' }); return; }
    if (state.newer) return;
    if (t.hasAttribute('data-addcounter')) { addCounter(t.getAttribute('data-addcounter')); return; }
    if (t.hasAttribute('data-confirmterms')) { if (store.confirmTerms(state, t.getAttribute('data-confirmterms'))) { check.settleAll(state); touch(); redraw(); } return; }
    if (t.hasAttribute('data-addterm')) { var at2 = pathOf(t.getAttribute('data-addterm')); store.addTerm(state, at2[0], at2[1]); touch(); redraw(); return; }
    if (t.hasAttribute('data-delterm')) { var dt = pathOf(t.getAttribute('data-delterm')); store.removeTerm(state, dt[0], dt[1], +dt[2]); touch(); redraw(); return; }
    if (t.hasAttribute('data-accept')) { store.accept(state, t.getAttribute('data-accept')); touch(); paintStatuses(); return; }
    if (t.hasAttribute('data-upc')) { fromClientFolder(t.getAttribute('data-upc')); return; }
    if (t.hasAttribute('data-replace')) { var rp = pathOf(t.getAttribute('data-replace')); pending = { block: rp[0], replaces: rp[1] }; $('#docOne').click(); return; }
    if (t.hasAttribute('data-upi')) { var ui = pathOf(t.getAttribute('data-upi')); pending = { block: ui[1], target: store.pathGet(state, ui[0]) }; $('#docOne').click(); return; }
    if (t.hasAttribute('data-addcmp')) { store.addCmp(state, t.getAttribute('data-addcmp')); touch(); drawMain(); return; }
    if (t.hasAttribute('data-delcmp')) { if (!window.confirm('Remove this change moment pay-out table?')) return; store.removeCmp(state, t.getAttribute('data-delcmp')); touch(); drawMain(); return; }
    if (t.hasAttribute('data-addq')) { var nq = store.addQuote(state, t.getAttribute('data-addq')); openSet[nq.id] = true; touch(); drawMain(); var cards = document.querySelectorAll('.qcard'); if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'start' }); return; }
    if (t.hasAttribute('data-addp')) { var np = store.newProposed(); state.blocks.proposed.items.push(np); openSet[np.id] = true; touch(); drawMain(); return; }
    if (t.hasAttribute('data-addl')) { var q = pathOf(t.getAttribute('data-addl')); store.addLine(state, q[0], q[1]); touch(); drawMain(); return; }
    if (t.hasAttribute('data-del')) {
      var path = t.getAttribute('data-del'), o = store.pathGet(state, path);
      if (o && /\.quotes\.\d+$/.test(path) && !window.confirm('Remove this quote? You can bring it back with Undo for about 10 seconds.')) return;
      store.setRemoved(state, path, true); markRemoved(path); touch(); drawMain(); return;
    }
    if (t.hasAttribute('data-undo')) { var up = t.getAttribute('data-undo'); store.setRemoved(state, up, false); delete recent[up]; touch(); drawMain(); }
  });
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('[data-block]'); if (b) { cur = b.getAttribute('data-block'); drawNav(); drawMain(true); refreshChrome(); } });
  $('#checks').addEventListener('click', function (e) { var b = e.target.closest('[data-jump]'); if (b) { cur = b.getAttribute('data-jump'); drawNav(); drawMain(true); refreshChrome(); } });
  $('#checks').addEventListener('toggle', function (e) { if (e.target && e.target.matches && e.target.matches('details')) { if (e.target.matches('.chkall')) checksOpen = e.target.open; else if (e.target.matches('details.allchecks')) checksInner = e.target.open; } }, true);
  $('#btnAgree').addEventListener('click', function () { var n = store.acceptAll(state); touch(); redraw(); toast(n + (n === 1 ? ' row' : ' rows') + ' marked as checked.'); });
  [['sVerifyBox', 'check'], ['sEmptyBox', 'waiting']].forEach(function (p) {
    var el = document.getElementById(p[0]); if (!el) return;
    el.addEventListener('click', function () { goPending(p[1]); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPending(p[1]); } });
  });
  $('#btnSave').addEventListener('click', function () { saveJson(false); });
  $('#btnSaveAs').addEventListener('click', function () { saveJson(true); });
  $('#btnPdf').addEventListener('click', savePdf);
  $('#btnPreview').addEventListener('click', previewPdf);
  $('#btnFolders').addEventListener('click', function () { FF.foldersUI.connect().then(function () { drawMeta(); if (OV.view) { OV.view.forget(); OV.view.paint(); } }); });
  if (window.FF && FF.foldersUI) FF.foldersUI.init(function () { drawMeta(); paintView(); });                // when the connected folders are known the View buttons say so
  $('#btnNew').addEventListener('click', newOverview);
  $('#btnReview').addEventListener('click', newReview);
  $('#btnOpen').addEventListener('click', chooseFile);
  $('#btnLoad').addEventListener('click', chooseFactFind);
  $('#btnReadFolder').addEventListener('click', loadFromClientFolder);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnCheck').addEventListener('click', function () { checksOpen = false; checksInner = false; check.settleAll(state); checkPass({ explicit: true }); });
  $('#main').addEventListener('input', function (e) { var t = e.target; if (t && t.getAttribute && t.getAttribute('data-bre-text')) breText[t.getAttribute('data-bre-text')] = t.value; if (t && t.getAttribute && t.getAttribute('data-uw-text')) uwText[t.getAttribute('data-uw-text')] = t.value; });
  $('#main').addEventListener('toggle', function (e) { var d = e.target; if (d && d.getAttribute && d.getAttribute('data-keep')) keepOpen[d.getAttribute('data-keep')] = d.open; }, true);          // a fold stays the way it was left when the page is drawn again
  $('#main').addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-uw-read]'); if (b && !state.newer) readUwEmail(b.getAttribute('data-uw-read'), null); var f = e.target.closest && e.target.closest('[data-uwfile]'); if (f && !state.newer) { uwPending = f.getAttribute('data-uwfile'); $('#docMail').click(); } });
  $('#docMail').addEventListener('change', function (e) { var f = e.target.files[0], id = uwPending; e.target.value = ''; uwPending = null; if (f && id) readUwEmail(id, f); });
  $('#main').addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-bre-read]'); if (b) readPastedEmail(b.getAttribute('data-bre-read')); });
  $('#docIn').addEventListener('change', function (e) { var fs = [].slice.call(e.target.files); e.target.value = ''; if (fs.length) ingest(fs, {}); });
  $('#docOne').addEventListener('change', function (e) { var f = e.target.files[0], o = pending || {}; e.target.value = ''; pending = null; if (f) ingest([f], o); });
  /* the More menu closes after a click on one of its buttons, on a click outside it and on Escape; the toast's link opens Settings */
  var more = $('#moreMenu');
  document.addEventListener('click', function (e) { if (more.open && (!more.contains(e.target) || (e.target.closest && e.target.closest('.ofmenu button')))) more.open = false; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && more.open) more.open = false; });
  $('#toast').addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-toastlink]'); if (!b) return; var f = toastActs[+b.getAttribute('data-toastlink') || 0]; if (f) { $('#toast').hidden = true; f(); } });
  $('#fileIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) openFile(f, null); });
  $('#ffIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) { var r = new FileReader(); r.onload = function () { fillFactFind(r.result, f.name); }; r.readAsText(f); } });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start: a blank overview. Unsaved work from last time is offered back; the client the adviser came from (the Fact Find's hand-over) fills it, as for the two applications. ---------- */
  var restored = null, restoredBase = '';
  try { if (localStorage.getItem(DRAFT_KEY + '-dirty') === '1') restored = loadDraft(); } catch (e) { restored = null; }
  try { restoredBase = restored ? (localStorage.getItem(DRAFT_KEY + '-file') || '') : ''; } catch (e) { restoredBase = ''; }
  state = store.blank();
  if (restored) draftHold = true; else rememberHandle(null);
  window.OV.app = { get state() { return state; }, makePdf: makePdf, ingest: ingest, redraw: redraw, setState: function (s) { state = s; redraw(); }, fillFactFindText: function (t, n) { var rep = store.fillFromFactFind(state, t, n); touch(); redraw(); return rep; }, go: function (b) { cur = b; drawNav(); drawMain(true); refreshChrome(); },
    openAll: function (yes) { openDefault = yes !== false; allOpen = yes !== false; keepOpen = {}; openSet = {}; drawMain(); }, isOpen: isOpen, aiOn: aiOn, lastLog: function () { return lastLog.slice(); }, checkPass: checkPass, get last() { return last; }, uniqueFiles: uniqueFiles };           // every item open (or folded) at once: for the tests of the older layout; the page itself starts folded
  redraw();
  var HO = null, HF = window.FF && FF.handover;
  if (HF) { HF.bindMenu(document); HO = HF.wants(window) ? HF.peek() : null; HF.stripFlag(window); }
  ['#linkSR', '#linkCS'].forEach(function (sel) {
    var a = HF && $(sel);
    if (a) a.addEventListener('click', function () { var h = HF.peek(); a.href = a.getAttribute('data-base') + (h && HF.sameClient(h.who, state.header.fname, state.header.sname) ? '?from=factfind' : ''); });
  });
  function hoWho(ho) { return [ho.who && ho.who.fname, ho.who && ho.who.sname].filter(Boolean).join(' ') || 'the client'; }
  if (HO && !restored) fillFactFind(HO.text, HO.name || 'the Fact Find on screen', true);
  if (restored) {
    var who = store.clientName(restored) || 'the last client', rd = document.createElement('dialog'), ffWho = HO ? hoWho(HO) : '', other = !!HO && !HF.sameClient(HO.who, restored.header.fname, restored.header.sname);
    rd.id = 'restoreDraft';
    rd.innerHTML = '<h2>Unsaved changes found</h2><p class="help">' + (other ? 'You came here from the Fact Find for ' + esc(ffWho) + ', but the last overview, for ' + esc(who) + ', had changes that were not saved. Which do you want? Starting a new overview for ' + esc(ffWho) + ' throws those changes away.' :
      'The last overview, for ' + esc(who) + ', had changes that were not saved. Restore them, or start a new overview? Starting a new one throws those changes away.') + '</p><div class="dlg-actions"><button class="btn ghost small" id="restoreNew" type="button">' +
      (other ? 'Start a new overview for ' + esc(ffWho) : 'Start a new overview') + '</button><span class="grow"></span><button class="btn small" id="restoreYes" type="button">Restore ' + esc(who) + '</button></div>';
    document.body.appendChild(rd);
    rd.addEventListener('cancel', function (e) { e.preventDefault(); });
    rd.querySelector('#restoreYes').addEventListener('click', function () {
      state = restored; check.settleAll(state); fileBase = restoredBase; dirty = true; onDisk = false; draftHold = false; rd.close(); rd.remove(); recallHandle().then(function (h) { if (h && fileBase) fileHandle = h; });
      redraw(); toast('Restored your unsaved changes for ' + who + '.'); if (HO && !other) fillFactFind(HO.text, HO.name || 'the Fact Find on screen', true);
    });
    rd.querySelector('#restoreNew').addEventListener('click', function () { draftHold = false; rd.close(); rd.remove(); rememberHandle(null); saveDraft(); redraw(); if (HO) fillFactFind(HO.text, HO.name || 'the Fact Find on screen', true); });
    rd.showModal(); rd.querySelector('#restoreYes').focus();
  }
})();
