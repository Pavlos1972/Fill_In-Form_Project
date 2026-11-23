/* The Client Overview screen (stages 2 to 4: the entry page, the PDF and saving into the client's folder, the documents). A left menu of the eleven blocks with a dot each (green complete, amber needs a look, grey waiting for a document), one block at a time, the figures the page
   works out (totals, the shortfall, "compared with what you have now") drawn from ov-calc.js, the checks from ov-check.js, saving and opening the overview's own file, and the pre-fill from the Fact Find.
   Amounts never wrap and there is no sideways scroll bar: the tables use fixed columns. Typing is kept at once; the figures and the dots follow without redrawing the boxes (so the cursor stays where it is). */
(function () {
  var FF = window.FF, OV = window.OV, util = FF.util, schema = OV.schema, calc = OV.calc, store = OV.store, check = OV.check;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DRAFT_KEY = 'wr-overview-draft', CLIENT = '_client';

  var openSet = {}, openDefault = false, recent = {}, checksOpen = false, NOTICE_MS = 10000;      // See more (the items that are open) and the removed notices: only for this visit, never in the saved file
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
  var toastAct = null;
  function toast(msg, ms) { var t = $('#toast'); toastAct = null; t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); }
  /* A message with a link in it (reading needs the key: "Add the key in Settings"). */
  function toastLink(msg, linkText, fn, ms) { var t = $('#toast'); t.innerHTML = esc(msg) + ' <button type="button" class="lnk" data-toastlink>' + esc(linkText) + '</button>'; toastAct = fn; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 8000); }
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
        state = store.fromJSON(r.result); fileHandle = handle || null; lastFolder = null; fileBase = file.name.replace(/\.json$/i, ''); dirty = false; onDisk = true; cur = CLIENT; progClear(); rememberHandle(handle || null); saveDraft(); redraw();
        var tidy = [state.dups ? state.dups + (state.dups === 1 ? ' extra copy of a quote was' : ' extra copies of a quote were') + ' removed (each quote is kept once)' : '', state.flattened ? state.flattened + (state.flattened === 1 ? ' policy of another insurer was' : ' policies of other insurers were') + ' put into one row with its benefits' : ''].filter(Boolean).join('; ');
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
      var rep = store.fillFromFactFind(state, text, name); touch(); redraw(); checkPass();
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
  function isOpen(key) { return openSet[key] === undefined ? openDefault : !!openSet[key]; }                 // folded unless the adviser (or a document just read) opened it
  function seeBtn(key) { var o = isOpen(key); return '<button type="button" class="see' + (o ? ' open' : '') + '" data-see="' + esc(key) + '" aria-expanded="' + o + '">' + (o ? 'See less' : 'See more') + '</button>'; }
  function aciShow(x) { var t = calc.fmtAci(x); return t ? '<span class="aci">' + esc(t) + '</span>' : '<span class="none">&ndash;</span>'; }
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
    var s = state.settings.standards, A = [['household', 'Household'], ['child', 'Children'], ['debt', 'Debts'], ['death', 'Death-related needs'], ['dread', 'Additional expense (dread)']];
    return '<section class="sec"><div class="block-title">The client</div><div class="grid">' +
      lab('First names', inp('header.fname', 'text')) + lab('Surname', inp('header.sname', 'text')) + lab('Date of birth', inp('header.dob', 'date')) + lab('Broker', inp('header.broker', 'text')) +
      lab('Overview date', inp('header.overviewDate', 'date')) + lab('Date of the meeting', inp('header.meetingDate', 'date')) + lab('Astute report date', inp('header.astuteDate', 'date')) +
      lab('Net income (R p.m.)', inp('header.netIncome', 'money')) + lab('Gross income (R p.m.)', inp('header.grossIncome', 'money')) +
      lab('Disability and income protector to age', sel('header.disabilityAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) + lab('Severe illness requested (R)', inp('header.sevRequest', 'money')) +
      lab('Premium budget for the reduced quote (R p.m.)', inp('header.premiumBudget', 'money')) + '</div>' +
      '<p class="sub">These start from the Fact Find. A figure a document gives wins over the Fact Find.</p></section>' +
      '<section class="sec"><div class="block-title">Paul\'s standard settings</div><p class="sub">A line that differs from these is flagged in amber (never printed).</p><div class="grid">' +
      lab('Annual contribution increase (%)', inp('settings.standards.aci', 'pct')) + A.map(function (a) { return lab('Annual benefit increase: ' + a[1] + ' (%)', inp('settings.standards.abi.' + a[0], 'pct')); }).join('') +
      lab('Difference allowed in a check (R)', inp('settings.tolerance', 'money')) + '</div></section>';
  }

  /* ---------- the lines of a quote or a policy ---------- */
  /* A line the checks flag (it differs from the Fact Find): the problems about it, as one text for the hover and the amber mark. */
  /* The reasons a line is to be checked, in the words for the line (the missing bank, the debt that is only in the quote ...). */
  function lineWhy(id) { return ((last && last.problems) || []).filter(function (p) { return p.line === id; }).map(function (p) { return p.short || p.message; }).join(' '); }
  function lineFlag(id) { return ((last && last.problems) || []).filter(function (p) { return p.line === id; }).map(function (p) { return p.message; }).join(' '); }
  function lineHTML(cpath, c, l, i, isPolicy) {
    var p = cpath + '.lines.' + i, t = schema.lineTypesById[l.type] || schema.lineTypesById.other, tt = t.monthly, cols = isPolicy ? 10 : 9;
    if (l.removed) return fresh(p) ? '<tr class="removed" data-row="' + p + '" data-notice="' + p + '"><td colspan="' + cols + '"><span class="gone">' + esc((l.label || t.l) + (l.name ? ' · ' + l.name + ' ' + (l.sname || '') : '') + (l.debt ? ' · ' + l.debt : '')) + ' removed.</span> <button type="button" class="lnk" data-undo="' + p + '">Undo</button></td></tr>' : '';
    var need = '<b>' + esc(l.type === 'other' ? '' : t.l) + '</b>';
    if (l.type === 'child') need = '<b>Child care</b><div class="two">' + inp(p + '.name', 'text', '', 'Name') + inp(p + '.sname', 'text', '', 'Surname') + '</div>';
    else if (l.type === 'debt') need = '<b>Debt</b><div class="two">' + inp(p + '.debt', 'text', '', 'Debt') + inp(p + '.bank', 'text', '', 'Bank') + '</div><div class="accsel">' + sel(p + '.accelerated', [{ id: 'true', l: 'Accelerated' }, { id: 'false', l: 'Standalone' }], 'tri') + '</div>';
    else if (l.type === 'other') need = inp(p + '.label', 'text', '', 'Description');
    function pillar(pid, hasLump, hasMonthly) {
      if (l[pid] === 'N/A') return '<td class="c"><span class="na">N/A</span></td>';
      var s = '';
      if (hasLump) s += inp(p + '.' + pid + '.lump', 'money');
      if (hasMonthly) s += inp(p + '.' + pid + '.monthly', 'money') + (pid === 'ip' ? '<small class="pm">p.m.</small>' : '<small class="sm">' + esc(tt) + '</small>');
      if (pid === 'ip' && l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0) s += '<small class="ip">Instalment Protector</small><small class="ced">To be ceded to the bank</small>';
      return '<td class="c">' + s + '</td>';
    }
    var flag = lineFlag(l.id);
    return '<tr data-row="' + p + '" class="ln' + (flag ? ' ffdiff' : '') + '"' + (flag ? ' title="' + esc(flag) + '"' : '') + '><td class="need">' + stb(p) + need + '<small class="why" data-why="' + l.id + '">' + esc(lineWhy(l.id)) + '</small></td><td>' + inp(p + '.term', 'text', 'term', t.term || 'Term') + '</td>' + pillar('life', true, true) + pillar('sev', true, false) + pillar('lsd', true, true) + pillar('ip', false, true) +
      (l.waiting === 'N/A' ? '<td class="c"><span class="na">N/A</span></td>' : '<td>' + inp(p + '.waiting', 'text', 'wait') + '</td>') + '<td class="c"><span class="aci" data-aci="' + (isPolicy ? '' : c.id) + '">' + (isPolicy ? '' : esc(calc.fmtAci(c) || '\u2013')) + '</span></td><td>' + inp(p + '.abi', 'pct') + '</td>' +
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
  function totRows(t, premium, rates) {
    return '<tr class="tot lump"><td colspan="2">Total lump sum</td><td class="c">' + amt(t.life.lump) + '</td><td class="c">' + amt(t.sev.lump) + '</td><td class="c">' + amt(t.lsd.lump) + '</td><td class="c"></td><td colspan="3"></td></tr>' +
      '<tr class="tot inc"><td colspan="2">Total income protected</td><td class="c">' + pm(t.life.monthly) + '</td><td class="c"><span class="na">N/A</span></td><td class="c">' + pm(t.lsd.monthly) + '</td><td class="c">' + pm(t.ip.monthly) + '</td><td colspan="3"></td></tr>' +
      '<tr class="tot prem"><td colspan="2">Monthly premium' + (rates ? ' <small>' + esc(rates) + '</small>' : '') + '</td><td colspan="2" class="c">' + (calc.isNum(premium) ? '<span class="a">' + R(premium) + '</span>' : '<span class="none">&ndash;</span>') + '</td><td colspan="5"></td></tr>';
  }
  function compHTML(name, id) {
    var q;
    if (name === 'qtot') { q = store.findQuote(state, id); return q ? totRows(calc.totals(q), q.premium, q.rates) : ''; }
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
    return '<h4>Your change moment pay-out <button type="button" class="lnk" data-delcmp="' + p + '">Remove</button></h4>' +
      '<div class="ovw"><table class="ovt cmp payout"><thead><tr><th></th><th>Today</th><th>Projected value at your change moment date</th><th>Pay-out date</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="empty">No rows: the insurer gave no pay-out.</td></tr>') + '</tbody></table></div>' +
      '<p class="foot">The rows come from the change moment pay-out guide (BR CMPO) of this quote: a new or replacement quote brings a new table.</p>' +
      '<div class="grid qh">' + lab('CP number of the guide', inp(p + '.cmp.number', 'text')) + lab('Change moment date', inp(p + '.cmp.activationDate', 'date')) + lab('If the insurer gave no pay-out, why', inp(p + '.cmp.reason', 'text'), 'wide') + '</div>' +
      (m.st === 'verify' ? '<p class="foot">Read from ' + esc((m.src && m.src.file) || 'a document') + ': check the figures.</p>' : '');
  }

  /* ---------- quotes ---------- */
  function quoteCard(q, i, bid) {
    var p = 'blocks.' + bid + '.quotes.' + i, title = check.qTitle(q) + (q.date ? ' · ' + q.date : '') + (q.rates ? ' · ' + q.rates : ''), open = isOpen(q.id);
    var head = '<header><span class="statusbadge s-' + esc(q.status) + '" data-statusfor="' + p + '">' + esc(schema.statusLabel[q.status]) + '</span><h3 data-titlefor="' + p + '">' + esc(title) + '</h3>' + stb(p) +
      '<span class="grow"></span>' + (open ? '<button type="button" class="x" data-replace="' + bid + '|' + q.id + '">Replace quote&hellip;</button><button type="button" class="x" data-del="' + p + '">Remove quote</button>' : '') + seeBtn(q.id) + '</header>';
    if (!open) return '<article class="qcard folded" data-row="' + p + '">' + head + '</article>';
    return '<article class="qcard" data-row="' + p + '">' + head +
      '<div class="grid qh">' + lab('Insurer', inp(p + '.insurer', 'text', '', 'e.g. BrightRock')) + lab(/bright/i.test(q.insurer) ? 'CP number' : 'Quote number', inp(p + '.number', 'text')) + lab('Quote date', inp(p + '.date', 'date')) +
      lab('Rates', inp(p + '.rates', 'text')) + lab('Kind of quote', boolSel(p + '.servicing', 'Servicing', 'New business')) + lab('Status', sel(p + '.status', schema.STATUS, 'text', false)) +
      lab('Disability to age', sel(p + '.disabilityAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ACI as the quote words it', inp(p + '.aciText', 'text', '', 'e.g. 7.5% + age rater')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      (q.status === 'accepted' ? lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Start date', inp(p + '.startDate', 'date')) : '') + '</div>' +
      (q.status === 'accepted' && q.policyNo && q.startDate ? '<p class="blue">This quote has been issued as a policy, so it is also shown under Current policies as a current policy of ours.</p>' : '') +
      (q.status === 'accepted' && !(q.policyNo && q.startDate) ? '<p class="blue">Accepted. When the insurer has issued the policy, type its policy number and start date above: the quote then moves to Current policies as a current policy of ours.</p>' : '') +
      (q.kind === 'comparative' ? '<p class="blue">This is what the other insurer\'s quote prints, read from the document: often one whole-of-life amount for each benefit. The four benefit columns, the totals and the comparison follow it.</p>' : '') + linesTable(p, q, false) + '<div class="under">' + cmpHTML(q, p) + '<h4>Compared with what you have now</h4><div data-comp="cmp|' + q.id + '">' + compareHTML(q) + '</div></div></article>';
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
    return '<tr class="pol"' + (at >= 0 ? ' data-row="' + p + '"' : '') + '><td>' + (at >= 0 ? stb(p) : '') + tick + ' <b>' + esc(it.insurer || 'Policy') + '</b>' + (it.policyNo ? ' <small>' + esc(it.policyNo) + '</small>' : '') + '<small class="d">' + esc([it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join(' · ')) + (e.derived ? ' · from the accepted quote' : '') + '</small>' + (at >= 0 ? seeBtn(it.id) : '') + '</td>' +
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
    var ps = calc.policies(state), age = ageOf({}) ? ' (Age ' + ageOf({}) + ')' : '';
    var rows = ps.map(function (e, i) {
      var at = state.blocks.policies.items.indexOf(e.item);
      return '<tbody data-comp="polrow|' + i + '">' + policyRow(e, i) + '</tbody>' + (at >= 0 && isOpen(e.item.id) ? '<tbody class="dtl"><tr><td colspan="9">' + policyCard(e.item, at) + '</td></tr></tbody>' : '');
    }).join('') || '<tbody><tr><td colspan="9" class="empty">No policies in the Fact Find yet.</td></tr></tbody>';
    return '<div class="ovw"><table class="ovt pols"><colgroup><col class="p-name"><col><col><col><col><col class="p-w"><col class="p-aci"><col class="p-s"><col></colgroup><thead><tr><th>Policy</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability' + age + '</th><th>Income protector / sickness benefit' + age + '</th><th>Waiting period</th><th>ACI</th><th>ABI</th><th>Premium</th></tr></thead>' + rows +
      '<tbody data-comp="poltot|">' + policyTots() + '</tbody></table></div>';
  }
  function policyCard(it, i) {
    var p = 'blocks.policies.items.' + i;
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.insurer || 'Policy') + (it.policyNo ? ' · ' + esc(it.policyNo) : '') + '</h3>' + stb(p) +
      '<span class="grow"></span><span class="src">' + (it.wr ? 'We are the broker' : 'Another broker: ' + esc(it.broker || '')) + '</span><button type="button" class="x" data-upi="' + p + '|policies">Upload policy schedule&hellip;</button></header><div class="grid qh">' +
      lab('Insurer', inp(p + '.insurer', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Date of commencement', inp(p + '.doc', 'date')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ACI as the schedule words it', inp(p + '.aciText', 'text', '', 'e.g. 7.5% + age rater')) + lab('ABI (%)', inp(p + '.abi', 'pct')) + lab('Disability to age', sel(p + '.ipAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) +
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
      var label = '<b>' + esc(schema.GROUP_KINDS[g.kind] || g.kind) + '</b> ' + esc(g.provider || '') + (g.statementDate ? '<small class="d">Statement ' + esc(g.statementDate) + (g.paidBy ? ' · paid by ' + esc(g.paidBy) : '') + '</small>' : (g.paidBy ? '<small class="d">Paid by ' + esc(g.paidBy) + '</small>' : ''));
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
    return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(schema.GROUP_KINDS[it.kind] || it.kind) + ' · ' + esc(it.provider || '') + '</h3>' + stb(p) + '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|group">Upload statement&hellip;</button></header>' + body + '</article>';
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
    return '<tr class="pol" data-row="' + p + '"><td>' + stb(p) + (i.wr ? '<span class="tick">&#10003;</span>' : '<span class="cross">&#10007;</span>') + ' <b>' + esc(i.provider || 'Investment') + '</b><small class="d">' + esc(i.product || '') + '</small>' + seeBtn(i.id) + '</td><td class="c">' + esc(i.valueDate || '') + '</td><td class="c">' + esc(srcTxt) + '</td><td class="c">' + amt(i.gross) +
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
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.provider || 'Investment') + ' · ' + esc(it.product || '') + '</h3>' + stb(p) + '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|investments">Upload statement&hellip;</button></header><div class="grid qh">' +
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
    return '<tr class="pol" data-row="' + p + '"><td>' + stb(p) + '<b>' + esc(it.type) + '</b>' + seeBtn(it.id) + '</td><td>' + esc([it.provider, it.quote ? 'Quote ' + it.quote : ''].filter(Boolean).join('   ')) + '</td><td>' + esc(schema.contributionLabel[it.contribution] || '') + '</td><td class="c">' + amt(it.lump) + '</td><td class="c">' + amt(it.monthly) +
      '</td><td class="c">' + pctShow(it.boostPct) + '</td><td class="c">' + amt(it.netInvested) + '</td><td class="c">' + pctShow(it.aci) + '</td></tr>';
  }
  function proposedCard(it, i) {
    var p = 'blocks.proposed.items.' + i;
    return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(it.type) + ' · ' + esc(it.provider || '') + '</h3>' + stb(p) + '<span class="grow"></span><button type="button" class="x" data-del="' + p + '" title="Remove">Remove</button></header><div class="grid qh">' +
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
      var head = '<header><h3>' + esc(name) + '</h3>' + stb(p) + '<span class="grow"></span>' + (open ? '<button type="button" class="x" data-del="' + p + '">Remove</button>' : '') + seeBtn(it.id) + '</header>';
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
    return '<p class="blue">Each cover is filled from what the Fact Find asked and answered (company, product, broker, premium and the Fact Find\'s own notes). <b>Load from client folder</b> then reads the client\'s newest Follow-Up Appointment Summary Notes in <b>2. Fact Find</b> (after the Fact Find) and adds what has progressed to the note. Every part of a note says where it came from: <i>(Fact Find dd/mm)</i> or <i>(Summary Notes dd/mm)</i>. Click <b>from Fact Find</b> on an item when it has been checked. Only the legacy protection plan takes a schedule.</p>' +
      state.blocks.other.items.map(function (it, i) {
        var p = 'blocks.other.items.' + i, nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === it.key; })[0] || { l: it.key }).l;
        return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '" data-tickfor="' + p + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(nm) + '</h3>' + stb(p) + (it.key === 'legacy' ? '<span class="grow"></span><button type="button" class="x" data-upi="' + p + '|other">Upload policy schedule&hellip;</button>' : '') + '</header><div class="grid qh">' +
          lab('Company', inp(p + '.company', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Broker', boolSel(p + '.wr', 'We are the broker', 'Another broker')) + lab('Premium (R p.m.)', inp(p + '.premium', 'money')) + lab('Note', area(p + '.note', 3), 'wide') + '</div></article>';
      }).join('');
  }

  function blockHTML(id) {
    if (id === CLIENT) return clientHTML();
    var b = schema.blocksById[id];
    var draw = { policies: policiesBlock, group: groupBlock, shortfall: shortfallBlock, investments: investmentsBlock, proposed: proposedBlock, goals: goalsBlock, other: otherBlock }[b.kind];
    return draw ? draw() : quotesBlock(b);
  }

  /* ---------- the screen ---------- */
  function drawNav() {
    var h = '<button type="button" data-block="' + CLIENT + '"' + (cur === CLIENT ? ' aria-current="true"' : '') + '><span>Client details</span></button><div class="sep">Blocks</div>';
    h += schema.BLOCKS.map(function (b) { return '<button type="button" data-block="' + b.id + '"' + (b.id === cur ? ' aria-current="true"' : '') + ' title="' + esc(check.dotText(state, b.id, last.dots[b.id] || 'grey', last.problems, (last.notes || {})[b.id])) + '"><span><i class="dot ' + (last.dots[b.id] || 'grey') + '" data-dot="' + b.id + '"></i>' + esc(b.title) + '</span>' + progHTML(b.id) + noteHTML(b.id) + '</button>'; }).join('');
    h += '<div class="legend" id="legend"><div class="sep">The dots</div>' + check.LEGEND.map(function (l) { return '<div><i class="dot ' + l[0] + '"></i>' + (l[0] === 'na' ? 'Dashed: not needed (for example, no shortfall quote without group risk)' : { grey: 'Grey: nothing yet', amber: 'Amber: to check', green: 'Green: checked', red: 'Red: checked, nothing there' }[l[0]]) + '</div>'; }).join('') + '</div>';
    $('#nav').innerHTML = h;
  }
  /* The page before and the page after this one, skipping a page that does not apply (no shortfall quote page without group risk). */
  function pageName(id) { return id === CLIENT ? 'Client details' : schema.blocksById[id].title; }
  function pagerHTML() {
    var order = [CLIENT].concat(schema.BLOCKS.map(function (b) { return b.id; })), i = order.indexOf(cur), ok = function (id) { return id === CLIENT || (last.dots || {})[id] !== 'na'; }, prev = null, next = null, j;
    for (j = i - 1; j >= 0 && !prev; j--) if (ok(order[j])) prev = order[j];
    for (j = i + 1; j < order.length && !next; j++) if (ok(order[j])) next = order[j];
    return '<div class="pagenav"><span>' + (prev ? '<button type="button" class="btn small" data-block="' + prev + '">&lsaquo; Back: ' + esc(pageName(prev)) + '</button>' : '') + '</span><span>' + (next ? '<button type="button" class="btn small" data-block="' + next + '">Next: ' + esc(pageName(next)) + ' &rsaquo;</button>' : '') + '</span></div>';
  }
  function drawMain(toTop) {
    var keepTop = $('#main').scrollTop, keepY = window.scrollY, title = pageName(cur);
    $('#main').innerHTML = (state.newer ? '<p class="bad-note">This file was made by a newer version of the Overview, so it is open read-only: nothing can be changed or saved here.</p>' : '') +
      '<header><h2>' + esc(title) + '</h2></header>' + blockHTML(cur) + pagerHTML();
    paintStatuses(); fitTables();
    if (toTop) $('#main').scrollTop = 0; else { $('#main').scrollTop = keepTop; window.scrollTo(0, keepY); }
  }
  function redraw() { last = check.run(state, runOpts()); drawNav(); drawMain(true); refreshChrome(); }
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
    document.querySelectorAll('[data-aci]').forEach(function (el) { var q = el.getAttribute('data-aci') && store.findQuote(state, el.getAttribute('data-aci')); el.textContent = q ? (calc.fmtAci(q) || '\u2013') : ''; });
    fitTables();
  }
  function paintStatuses() {
    document.querySelectorAll('[data-row]').forEach(function (el) {
      var o = store.pathGet(state, el.getAttribute('data-row')); if (!o) return;
      el.classList.remove('s-empty', 's-ff', 's-verify', 's-confirmed'); el.classList.add('s-' + (o.st || 'empty'));
      var b = el.querySelector('[data-stfor="' + el.getAttribute('data-row') + '"]'); if (b) b.innerHTML = badgeHTML(el.getAttribute('data-row'), o.st, el.tagName === 'TR', o);
    });
    document.querySelectorAll('[data-statusfor]').forEach(function (el) { var q = store.pathGet(state, el.getAttribute('data-statusfor')); if (q) { el.textContent = schema.statusLabel[q.status] || ''; el.className = 'statusbadge s-' + q.status; } });
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
    if (warned.length) h += '<details class="allchecks loadlog"><summary>What the last load said: ' + warned.length + ' to look at</summary>' + warned.map(function (x) { return '<div class="amber">' + esc(x.msg) + '</div>'; }).join('') + '</details>';
    if (p.length) h += '<details class="allchecks"' + (checksOpen ? ' open' : '') + '><summary>All ' + p.length + (p.length === 1 ? ' individual check' : ' individual checks') + '</summary>' + p.map(function (x) { return '<button type="button" class="amber" data-jump="' + (x.block || CLIENT) + '"><b>' + esc(x.where) + '</b> ' + esc(x.message) + '</button>'; }).join('') + '</details>';
    $('#checks').innerHTML = h;
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
  var REASONS = { connect: 'Your client folders are not connected yet (More, then Folders…).', access: 'Chrome has not given this page access to your client folders (More, then Folders…, then choose them again and Allow).', names: 'Fill in the client’s names first, so the folder can be found.', client: 'No folder for this client was found in your connected folders.' };
  function aiOn() { try { return localStorage.getItem(AI_KEY) !== '0'; } catch (e) { return true; } }          // ON unless the adviser switched it off (Paul, 22 November: reading is the default); the switch is in Settings
  function aiSet(v) { try { localStorage.setItem(AI_KEY, v ? '1' : '0'); } catch (e) { /* kept for this visit only */ } }
  function aiKey() { var s = window.FF && FF.lookup && FF.lookup.getSettings ? FF.lookup.getSettings() : {}; return { apiKey: s.apiKey || '', model: s.model || (FF.lookup && FF.lookup.DEFAULT_MODEL) || '' }; }
  function toBase64(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(new Error('Could not read that file.')); }; r.readAsDataURL(file); }); }
  function listOf(block) { return state.blocks[block].items; }
  function nameOf(block) { return function (x) { return block === 'policies' ? x.insurer : x.provider; }; }

  /* ---------- the bar under a block's name in the menu: a document is downloaded and read (Paul, 22 November) ---------- */
  var prog = {}, progT = null;
  function navBlockOf(block, q) { return block === 'astute' ? 'investments' : block === 'followup' ? 'other' : block === 'cmp' ? (q && schema.blockOfQuote[q.kind]) || null : block; }
  function progHTML(id) {
    var p = prog[id], st = p ? p.st : '';
    return '<span class="prog' + (st ? ' ' + st : '') + '" data-prog="' + id + '"' + (st ? '' : ' hidden') + '><i style="width:' + (p ? Math.round(p.pct) : 0) + '%"></i><em>' + esc(p ? p.text : '') + '</em></span>';
  }
  function paintProg(id) {
    var el = document.querySelector('[data-prog="' + id + '"]'), p = prog[id]; if (!el || !p) return;
    el.hidden = !p.st; el.className = 'prog ' + p.st; el.querySelector('i').style.width = Math.round(p.pct) + '%'; el.querySelector('em').textContent = p.text;
  }
  function tick() {
    var any = false;
    Object.keys(prog).forEach(function (k) { var q = prog[k]; if (q.st === 'reading' || q.st === 'searching') { any = true; q.pct += ((q.st === 'searching' ? 55 : 92) - q.pct) * 0.07; paintProg(k); } });
    if (!any) { clearInterval(progT); progT = null; }
  }
  function startTicker() { if (!progT) progT = setInterval(tick, 350); }
  function progStart(id) {
    if (!id) return; var p = prog[id] || (prog[id] = { pct: 0, busy: 0, errs: 0, recorded: 0 });
    if (!p.busy) { p.errs = 0; p.recorded = 0; p.pct = 6; }
    p.busy = (p.busy || 0) + 1; p.st = 'reading'; p.text = 'Reading the document…'; paintProg(id);
    startTicker();
  }
  function progStep(id, pct, text) { var p = prog[id]; if (!p || p.st !== 'reading') return; if (pct > p.pct) p.pct = pct; if (text) p.text = text; paintProg(id); }
  function progEnd(id, how) {                                                                           // how: done | recorded | error
    var p = prog[id]; if (!p) return;
    if (how === 'error') p.errs++; else if (how === 'recorded') p.recorded++;
    p.busy = Math.max(0, p.busy - 1); if (p.busy) return;
    p.pct = 100; p.st = p.errs ? 'error' : p.recorded ? 'recorded' : 'done';
    p.text = p.errs ? 'Could not read it: see the message' : p.recorded ? 'Recorded, not read (add your key in Settings)' : 'Downloaded and populated'; paintProg(id);
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
    ids = ids || allIds(); loading++; checkTimers.forEach(clearTimeout); checkTimers = [];
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
    var name = file.name, res = { msg: '' }, lower = (D.BLOCK_LABEL[block] || block).toLowerCase();
    if (D.QUOTE_OF[block]) {
      var r = D.applyQuote(state, block, data || { number: cls.number, date: cls.date }, name, { replaces: o.replaces, nameOnly: !data });
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
    } else if (!data) {
      res.msg = name + ': recorded. Use the Upload button on the item it is for, and type its details (or switch reading on in Settings).';
    } else if (block === 'other') {
      if (!o.target) { res.msg = name + ': use the Upload button on the legacy protection plan.'; res.warn = true; }
      else { D.applyOther(state, o.target, data, name); openSet[o.target.id] = true; res.msg = name + ': the legacy protection plan is filled in; amber until it is checked.'; }
    } else if (block === 'astute') {
      var a = D.applyAstute(state, data, name);
      res.msg = name + ': Astute values filled in for ' + a.filled + (a.filled === 1 ? ' investment' : ' investments') + (a.unmatched.length ? '; not in the Fact Find: ' + a.unmatched.join(', ') + '.' : '.'); if (a.unmatched.length) res.warn = true;
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
    o = o || {};
    var cls = D.classify(file.name), block = o.block || (cls && cls.block);
    if (!block) return Promise.resolve({ unknown: true, file: file });
    cls = cls || { number: '', date: '' };
    if (D.QUOTE_OF[block] && !o.replaces && cls.number) {                                                    // its number says it is a quote that is already loaded and read: it is not read (or paid for) twice
      var have = D.quoteIn(state, block, cls.number);
      if (have && D.quoteRead(have)) return Promise.resolve({ msg: file.name + ': already loaded as ' + check.qTitle(have) + '; not read again (to read it again, use Replace quote on it).', dupe: true });
    }
    var want = aiOn(), key = aiKey(), read = want && !!key.apiKey, failure = '', nb = navBlockOf(block, o.quote), ctx = D.QUOTE_OF[block] && block !== 'comparative' ? { clientNote: D.factNote(state) } : undefined;
    progStart(nb); progStep(nb, 12, 'Downloading the document…');
    var get = read ? toBase64(file).then(function (b64) { progStep(nb, 28, 'Reading the document…'); return D.readWithClaude({ apiKey: key.apiKey, model: key.model, mediaType: file.type || 'application/pdf', base64: b64, block: block, ctx: ctx }); }).then(function (r) { return r.data; })
      .catch(function (e) { failure = e && e.message ? e.message : 'It could not be read.'; return null; }) : Promise.resolve(null);
    return get.then(function (data) {
      if (data && D.isEmptyRead(block, data)) { failure = 'Claude read the document but found no figures in it (a scan it could not read, or not the kind of document it was said to be).'; data = null; }
      progStep(nb, 80, 'Filling it in…');
      var r = put(file, block, cls, data, o);
      if (failure) { r.msg = file.name + ': ' + failure + ' It was recorded; type the figures from it.'; r.warn = true; }
      var then = r.quote && data ? autoGuide(r.quote, o).then(function (m) { if (m) { r.msg += ' ' + m.msg; if (m.warn) r.warn = true; } }) : Promise.resolve();
      return then.then(function () { progEnd(nb, failure ? 'error' : data ? 'done' : 'recorded'); return r; });
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
  /* Documents, one after the other (each may be read by Claude, which takes a moment): QUOTES FIRST, then the pay-out guides (a guide needs its quote), then the ones the adviser had to sort. */
  function ingest(files, o) {
    o = Object.assign({}, o || {}); files = uniqueFiles([].slice.call(files)); unmatchedGuides = {}; o.guides = {};
    var unknown = [], count = 0, warns = 0, log = [], same = 0; lastLog = log;
    if (o.counted) delete o.counted; else beginSearch(o.block ? [navBlockOf(o.block)].filter(Boolean) : null, o.block ? 'Waiting for the document' : 'Waiting for the documents');          // a load that started with the folder search has counted already
    var ended = false, finish = function () { if (ended) return; ended = true; return endSearch(); };
    var isGuide = function (f) { var c = D.classify(f.name); return o.block === 'cmp' || (!o.block && c && c.block === 'cmp'); };
    function one(f, oo) {
      var num = (D.classify(f.name) || {}).number;
      if (oo.block === 'cmp' || (!oo.block && isGuide(f))) { if (num && o.guides[num]) { count++; return Promise.resolve(); } }          // its quote has read it already
      return intakeOne(f, oo).then(function (r) { if (r.unknown) { unknown.push(f); return; } if (r.skip) return; if (r.dupe) same++; else count++; if (r.warn) warns++; log.push({ msg: r.msg, warn: !!r.warn }); });
    }
    function chain(list, mk) { return list.reduce(function (p, f) { return p.then(function () { return one(f, mk(f)); }); }, Promise.resolve()); }
    return chain(files.filter(function (f) { return !isGuide(f); }), function () { return o; })
      .then(function () { return chain(files.filter(isGuide), function () { return o; }); })
      .then(function () {
        if (!unknown.length) return null;
        return askBlocks(unknown).then(function (picked) {
          var first = picked.filter(function (x) { return x.block !== 'cmp'; }), last2 = picked.filter(function (x) { return x.block === 'cmp'; });
          return chain(first.map(function (x) { return x.file; }), function (f) { return Object.assign({}, o, { block: first.filter(function (x) { return x.file === f; })[0].block }); })
            .then(function () { return chain(last2.map(function (x) { return x.file; }), function () { return Object.assign({}, o, { block: 'cmp' }); }); });
        });
      }).then(function () {
        touch(); redraw(); finish();
        if (count && aiOn() && !aiKey().apiKey) toastLink(count + (count === 1 ? ' document was' : ' documents were') + ' recorded, not read: reading needs your Anthropic key.', 'Add the key in Settings', openSettings, 20000);
        else toast((count ? count + (count === 1 ? ' document' : ' documents') + ' loaded' + (warns ? ', ' + warns + ' to look at' : '') + '.' : same ? 'Nothing new was loaded.' : 'Nothing was loaded.') + (same ? ' ' + same + (same === 1 ? ' was' : ' were') + ' already there (each quote is kept once).' : ''), 7000);
        refreshChrome();                                                                                 // the Checks panel lists what needs a look; there is no pop-up
      }).then(null, function (e) { finish(); toast('Loading stopped: ' + ((e && e.message) || 'an error') + '.', 8000); });
  }
  /* The same file seen twice (a client folder found in two places, a copy in two folders) is listed and read ONCE: the first one stays. */
  function uniqueFiles(list) {
    var seen = {};
    return list.filter(function (f) { var k = String((f && f.name) || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  /* dd/mm/yyyy (or a name's date) as a number that sorts. */
  function dkey(v) { var m = /(\d{1,2})\D(\d{1,2})\D(\d{2,4})/.exec(String(v || '')); if (!m) return 0; var y = +m[3]; if (y < 100) y += 2000; return y * 10000 + (+m[2]) * 100 + (+m[1]); }
  /* Of the Follow-Up Summary Notes in the list, the NEWEST one dated after the Fact Find (the Fact Find's date); only that one is ticked (the adviser can tick others). */
  function newestFollowUp(files) {
    var ff = state.factFind && state.factFind.facts && state.factFind.facts.header && state.factFind.facts.header.date, base = dkey(ff), best = null, bk = 0;
    files.forEach(function (f) { var c = D.classify(f.name); if (!c || c.block !== 'followup') return; var k = dkey(c.date); if (k && k > base && k > bk) { best = f; bk = k; } });
    return best;
  }
  function pickList(res) {
    var tickFu = newestFollowUp(res.files);
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>Documents in ' + esc(res.label) + '</h3><p>Choose what to load into the overview. Ones the page can sort by their name are ticked; the others will ask you what they are. The quotes are read first, then their change moment pay-out guides.</p><div class="flist">' + res.files.map(function (f, i) {
        var c = D.classify(f.name);
        return '<label><input type="checkbox" data-i="' + i + '"' + (c && (c.block !== 'followup' || f === tickFu) ? ' checked' : '') + '><span>' + esc(f.rel.concat([f.name]).join(' \\ ')) + (c ? ' <i>(' + esc(c.label) + ')</i>' : '') + '</span></label>';
      }).join('') + '</div><div class="fbtns"><button type="button" class="btn ghost small" data-no>Cancel</button><button type="button" class="btn small" data-yes>Load the ticked ones</button></div>';
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
  /* The ONE top button: the client's folder is found, what it holds is listed, and what is ticked is read and sorted. When the folder cannot be found or the browser has no folder access, the normal file window opens by itself (several files). */
  function loadFromClientFolder() {
    if (state.newer) return;
    var FU = window.FF && FF.foldersUI;
    if (!FU || !FU.clientFiles) { $('#docIn').click(); return; }
    beginSearch();                                                                                       // every block waits: none says "nothing found" before its search is over
    toast('Looking for the client’s folder…', 30000);
    function normal(why) { abandonSearch(); toast((why ? why + ' ' : '') + 'The normal file window is opening instead.', 8000); $('#docIn').click(); }
    FU.clientFiles({ sname: state.header.sname, fname: state.header.fname }).then(function (res) {
      if (res.reason) { normal(REASONS[res.reason] || 'The folder could not be read.'); return; }
      res.files = uniqueFiles(res.files);
      if (!res.files.length) { normal('No documents were found in ' + res.label + '.'); return; }
      $('#toast').hidden = true; searching();
      pickList(res).then(function (picked) {
        if (!picked.length) { abandonSearch(); return; }
        Promise.all(picked.map(function (f) { return f.handle.getFile(); })).then(function (fs) { ingest(fs, { pool: res.files, counted: true }); }, function (e) { abandonSearch(); toast('Could not open a file: ' + (e && e.message), 8000); });
      });
    }, function (e) { normal('Could not look through the folders (' + (e && e.message) + ').'); });
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
    toast('Looking for the client’s folder…', 30000);
    FU.clientFolder({ sname: state.header.sname, fname: state.header.fname }, CLIENT_KIND[block]).then(function (res) {
      if (res.reason) { toast((REASONS[res.reason] || 'Could not read the folder.') + ' The normal file window is opening instead.', 8000); pickAny(block); return null; }
      $('#toast').hidden = true;
      var go = function (file) { if (file) ingest([file], { block: block, dir: res.handle }); };
      return pickIn(res.handle).then(go, function (e) {
        if (e && e.name === 'AbortError') { toast('Nothing was chosen.', 3000); return; }
        return askToChoose(res.label).then(function (yes) { if (yes) return pickIn(res.handle).then(go, function (e2) { if (!(e2 && e2.name === 'AbortError')) toast('Could not open the file window: ' + (e2 && e2.message), 8000); }); });
      });
    }, function (e) { toast('Could not look through the folders (' + (e && e.message) + '). The normal file window is opening instead.', 8000); pickAny(block); });
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
    var el = e.target, p = el.getAttribute('data-p'); if (!p) return;
    if (el.tagName === 'SELECT') { typed(el); if (/\.status$|\.requested$|\.wr$/.test(p)) { touch(); redraw(); return; } }
    var k = el.getAttribute('data-k'), v = store.pathGet(state, p);
    if (el.tagName === 'INPUT') { el.value = dispIn(v, k); el.classList.toggle('isna', v === 'N/A' || v === 'Not found'); }
    touch(); paintComputed(); paintStatuses();
  });
  $('#main').addEventListener('click', function (e) {
    var t = e.target.closest('[data-see],[data-accept],[data-addq],[data-addl],[data-addp],[data-del],[data-undo],[data-block],[data-replace],[data-upi],[data-addcmp],[data-delcmp],[data-upc]'); if (!t) return;
    if (t.hasAttribute('data-block')) { cur = t.getAttribute('data-block'); drawNav(); drawMain(true); refreshChrome(); window.scrollTo({ top: 0 }); return; }
    if (t.hasAttribute('data-see')) { var sk = t.getAttribute('data-see'); openSet[sk] = !isOpen(sk); drawMain(); return; }
    if (state.newer) return;
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
  $('#checks').addEventListener('toggle', function (e) { if (e.target && e.target.matches && e.target.matches('details.allchecks')) checksOpen = e.target.open; }, true);
  $('#btnAgree').addEventListener('click', function () { var n = store.acceptAll(state); touch(); redraw(); toast(n + (n === 1 ? ' row' : ' rows') + ' marked as checked.'); });
  $('#btnSave').addEventListener('click', function () { saveJson(false); });
  $('#btnSaveAs').addEventListener('click', function () { saveJson(true); });
  $('#btnPdf').addEventListener('click', savePdf);
  $('#btnPreview').addEventListener('click', previewPdf);
  $('#btnFolders').addEventListener('click', function () { FF.foldersUI.connect().then(drawMeta); });
  if (window.FF && FF.foldersUI) FF.foldersUI.init(drawMeta);
  $('#btnNew').addEventListener('click', newOverview);
  $('#btnReview').addEventListener('click', newReview);
  $('#btnOpen').addEventListener('click', chooseFile);
  $('#btnLoad').addEventListener('click', chooseFactFind);
  $('#btnReadFolder').addEventListener('click', loadFromClientFolder);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnCheck').addEventListener('click', function () { checkPass({ explicit: true }); });
  $('#docIn').addEventListener('change', function (e) { var fs = [].slice.call(e.target.files); e.target.value = ''; if (fs.length) ingest(fs, {}); });
  $('#docOne').addEventListener('change', function (e) { var f = e.target.files[0], o = pending || {}; e.target.value = ''; pending = null; if (f) ingest([f], o); });
  /* the More menu closes after a click on one of its buttons, on a click outside it and on Escape; the toast's link opens Settings */
  var more = $('#moreMenu');
  document.addEventListener('click', function (e) { if (more.open && (!more.contains(e.target) || (e.target.closest && e.target.closest('.ofmenu button')))) more.open = false; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && more.open) more.open = false; });
  $('#toast').addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-toastlink]') && toastAct) { var f = toastAct; $('#toast').hidden = true; f(); } });
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
    openAll: function (yes) { openDefault = yes !== false; openSet = {}; drawMain(); }, isOpen: isOpen, aiOn: aiOn, lastLog: function () { return lastLog.slice(); }, checkPass: checkPass, get last() { return last; }, uniqueFiles: uniqueFiles };           // every item open (or folded) at once: for the tests of the older layout; the page itself starts folded
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
      state = restored; fileBase = restoredBase; dirty = true; onDisk = false; draftHold = false; rd.close(); rd.remove(); recallHandle().then(function (h) { if (h && fileBase) fileHandle = h; });
      redraw(); toast('Restored your unsaved changes for ' + who + '.'); if (HO && !other) fillFactFind(HO.text, HO.name || 'the Fact Find on screen', true);
    });
    rd.querySelector('#restoreNew').addEventListener('click', function () { draftHold = false; rd.close(); rd.remove(); rememberHandle(null); saveDraft(); redraw(); if (HO) fillFactFind(HO.text, HO.name || 'the Fact Find on screen', true); });
    rd.showModal(); rd.querySelector('#restoreYes').focus();
  }
})();
