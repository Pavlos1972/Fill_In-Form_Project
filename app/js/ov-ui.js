/* The Client Overview screen (stage 2: the entry page). A left menu of the eleven blocks with a dot each (green complete, amber needs a look, grey waiting for a document), one block at a time, the figures the page
   works out (totals, the shortfall, "compared with what you have now") drawn from ov-calc.js, the checks from ov-check.js, saving and opening the overview's own file, and the pre-fill from the Fact Find.
   Amounts never wrap and there is no sideways scroll bar: the tables use fixed columns. Typing is kept at once; the figures and the dots follow without redrawing the boxes (so the cursor stays where it is). */
(function () {
  var FF = window.FF, OV = window.OV, util = FF.util, schema = OV.schema, calc = OV.calc, store = OV.store, check = OV.check;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DRAFT_KEY = 'wr-overview-draft', CLIENT = '_client';

  var state, cur = CLIENT, fileHandle = null, ffHandle = null, fileBase = '', dirty = false, onDisk = true, lastSaved = null, toastTimer = null, draftHold = false, last = { problems: [], dots: {}, byBlock: {} };

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
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  var lastWritten = null;
  /* Chrome's "Save as" window where there is one, otherwise a plain download; with a remembered file it writes straight back to it. Written, read back and proved (util.writeVerified). */
  function writeFile(blob, name, type, ext, handle, id, startIn) {
    lastWritten = null;
    if (!window.showSaveFilePicker) { download(blob, name); return Promise.resolve(null); }
    var accept = {}, open; accept[blob.type] = [ext];
    var picker = function () { var o = { suggestedName: name, types: [{ description: type, accept: accept }] }; if (startIn) o.startIn = startIn; else o.id = id; return window.showSaveFilePicker(o); };
    if (handle) open = Promise.resolve(handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : 'granted').then(function (p) { if (p !== 'granted') throw new Error('Chrome did not allow changes to that file.'); return handle; });
    else open = picker();
    return open.then(function (h) { return util.writeVerified(h, blob, { pdf: ext === '.pdf' }).then(function (r) { lastWritten = r; return h; }); });
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
    writeFile(blob, currentBase() + '.json', 'Client Overview', '.json', forceAs ? null : fileHandle, 'overview-data', fileHandle).then(function (h) {
      if (h) { fileHandle = h; fileBase = h.name.replace(/\.json$/i, ''); rememberHandle(h); } else if (!fileBase) fileBase = currentBase();
      return readBack(h, text).then(function (v) {
        if (v === 'different') { refreshChrome(); toast('The saved file does not match the overview, so your work is still kept here. Try Save again.', 7000); return; }
        dirty = false; onDisk = v === 'ok'; lastSaved = new Date(); saveDraft(); refreshChrome(); toast('Saved.');
      });
    }).catch(function (e) { if (saveFailed(e, blob, currentBase() + '.json')) { if (!forceAs && fileHandle) { fileHandle = null; rememberHandle(null); } dirty = true; onDisk = false; saveDraft(); } refreshChrome(); });
  }
  function openFile(file, handle) {
    var r = new FileReader();
    r.onload = function () {
      try {
        state = store.fromJSON(r.result); fileHandle = handle || null; fileBase = file.name.replace(/\.json$/i, ''); dirty = false; onDisk = true; cur = CLIENT; rememberHandle(handle || null); saveDraft(); redraw();
        toast(state.newer ? 'Opened ' + file.name + ' read-only: it was made by a newer version.' : 'Opened ' + file.name, state.newer ? 7000 : 3500);
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
      var rep = store.fillFromFactFind(state, text, name); touch(); redraw();
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
    state = store.blank(); fileHandle = null; ffHandle = null; fileBase = ''; rememberHandle(null); dirty = false; onDisk = true; lastSaved = null; cur = CLIENT; saveDraft(); redraw();
  }

  /* ---------- small drawing helpers ---------- */
  function fmtIn(v) {
    if (v === 'N/A' || v === 'Not found') return v;
    if (!calc.isNum(v)) return '';
    var whole = Math.abs(v - Math.round(v)) < 0.005, s = whole ? String(Math.round(v)) : v.toFixed(2), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.');
  }
  function dispIn(v, kind) { return kind === 'money' || kind === 'pct' || kind === 'num' ? fmtIn(v) : (v == null ? '' : String(v)); }
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
  function badgeHTML(path, st, short) {
    var b = STB[st] || STB.empty; if (!b[0]) return '';
    var text = short ? STB_SHORT[st] : b[0], cls = b[1] + (short ? ' short' : ''), tip = b[0];
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
  function lineHTML(cpath, c, l, i, isPolicy) {
    var p = cpath + '.lines.' + i, t = schema.lineTypesById[l.type] || schema.lineTypesById.other, tt = t.monthly;
    if (l.removed) return '<tr class="removed" data-row="' + p + '"><td colspan="10"><span class="gone">' + esc((l.label || t.l) + (l.name ? ' · ' + l.name + ' ' + (l.sname || '') : '') + (l.debt ? ' · ' + l.debt : '')) + ' removed.</span> <button type="button" class="lnk" data-undo="' + p + '">Undo</button></td></tr>';
    var need = '<b>' + esc(l.type === 'other' ? '' : t.l) + '</b>';
    if (l.type === 'child') need = '<b>Child care</b><div class="two">' + inp(p + '.name', 'text', '', 'Name') + inp(p + '.sname', 'text', '', 'Surname') + '</div>';
    else if (l.type === 'debt') need = '<b>Debt</b><div class="two">' + inp(p + '.debt', 'text', '', 'Debt') + inp(p + '.bank', 'text', '', 'Bank') + '</div>';
    else if (l.type === 'other') need = inp(p + '.label', 'text', '', 'Description');
    function pillar(pid, hasLump, hasMonthly) {
      if (l[pid] === 'N/A') return '<td class="c"><span class="na">N/A</span></td>';
      var s = '';
      if (hasLump) s += inp(p + '.' + pid + '.lump', 'money');
      if (hasMonthly) s += inp(p + '.' + pid + '.monthly', 'money') + (pid === 'ip' ? '<small class="pm">p.m.</small>' : '<small class="sm">' + esc(tt) + '</small>');
      if (pid === 'ip' && l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0) s += '<small class="ip">Instalment Protector</small><small class="ced">To be ceded to the bank</small>';
      return '<td class="c">' + s + '</td>';
    }
    return '<tr data-row="' + p + '" class="ln"><td class="need">' + stb(p) + need + '</td><td>' + inp(p + '.term', 'text', 'term', t.term || 'Term') + '</td>' + pillar('life', true, true) + pillar('sev', true, false) + pillar('lsd', true, true) + pillar('ip', false, true) +
      (l.waiting === 'N/A' ? '<td class="c"><span class="na">N/A</span></td>' : '<td>' + inp(p + '.waiting', 'text', 'wait') + '</td>') + '<td class="c"><span class="a" data-aci="' + (isPolicy ? '' : c.id) + '">' + (isPolicy ? '' : calc.fmtPct(c.aci)) + '</span></td><td>' + inp(p + '.abi', 'pct') +
      '</td><td class="x"><button type="button" class="xbtn" data-del="' + p + '" title="Remove this line">&times;</button></td></tr>';
  }
  function linesTable(cpath, c, isPolicy) {
    var ages = (c.disabilityAge || c.ipAge || (state.header.disabilityAge)) || '', age = ages ? 'Age ' + ages : '';
    var head = '<thead><tr><th class="need">Need</th><th>Term</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability<small>' + esc(age) + '</small></th><th>Income protector / sickness benefit<small>' + esc(age) + '</small></th><th>Waiting period</th><th>ACI</th><th>ABI</th><th></th></tr></thead>';
    var body = (c.lines || []).map(function (l, i) { return lineHTML(cpath, c, l, i, isPolicy); }).join('') || '<tr><td colspan="10" class="empty">No lines yet.</td></tr>';
    var types = (isPolicy ? ['other', 'household', 'child', 'debt', 'death', 'dread'] : ['household', 'child', 'debt', 'death', 'dread', 'other']).map(function (t) { return '<button type="button" class="addrow" data-addl="' + cpath + '|' + t + '">+ ' + esc(schema.lineTypesById[t].l) + '</button>'; }).join('');
    var ced = (c.lines || []).some(function (l) { return !l.removed && l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; });
    return '<table class="ovt lines"><colgroup><col class="c-need"><col class="c-term"><col class="c-life"><col class="c-sev"><col class="c-lsd"><col class="c-ip"><col class="c-wait"><col class="c-aci"><col class="c-abi"><col class="c-x"></colgroup>' + head + '<tbody>' + body + '</tbody>' +
      (isPolicy ? '' : '<tbody data-comp="qtot|' + c.id + '">' + compHTML('qtot', c.id) + '</tbody>') + '</table>' +
      (ced ? '<p class="foot">Instalment Protector: if the client is retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.</p>' : '') + '<div class="adders">' + types + '</div>';
  }

  /* ---------- the figures the page works out ---------- */
  function totRows(t, premium, rates, ageText) {
    return '<tr class="tot lump"><td colspan="2">Total lump sum</td><td class="c">' + amt(t.life.lump) + '</td><td class="c">' + amt(t.sev.lump) + '</td><td class="c">' + amt(t.lsd.lump) + '</td><td class="c"></td><td colspan="4"></td></tr>' +
      '<tr class="tot inc"><td colspan="2">Total income protected</td><td class="c">' + pm(t.life.monthly) + '</td><td class="c"><span class="na">N/A</span></td><td class="c">' + pm(t.lsd.monthly) + '</td><td class="c">' + pm(t.ip.monthly) + '</td><td colspan="4"></td></tr>' +
      '<tr class="tot prem"><td colspan="2">Monthly premium' + (rates ? ' <small>' + esc(rates) + '</small>' : '') + '</td><td colspan="2" class="c">' + (calc.isNum(premium) ? '<span class="a">' + R(premium) + '</span>' : '<span class="none">&ndash;</span>') + '</td><td colspan="6"></td></tr>';
  }
  function compHTML(name, id) {
    var q;
    if (name === 'qtot') { q = store.findQuote(state, id); return q ? totRows(calc.totals(q), q.premium, q.rates) : ''; }
    if (name === 'cmp') { q = store.findQuote(state, id); return q ? compareHTML(q) : ''; }
    if (name === 'poltab') return policyTable();
    if (name === 'grouptab') return groupTable();
    if (name === 'invtab') return invTable();
    if (name === 'sf') return shortfallHTML();
    return '';
  }
  function compareHTML(q) {
    var c = calc.compare(state, q), rows = [['What you have now', c.now, false], ['This quote', c.quote, false], ['Difference', c.diff, true]];
    return '<table class="ovt cmp"><thead><tr><th></th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability</th><th>Income protector <small>p.m.</small></th><th>Monthly premium</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var f = function (v) { return r[2] ? '<span class="a ' + (v > 0.004 ? 'up' : v < -0.004 ? 'down' : '') + '">' + calc.fmtDiff(v) + '</span>' : amt(v); };
        return '<tr class="' + (r[2] ? 'diff' : '') + '"><td>' + r[0] + '</td><td class="c">' + f(r[1].life) + '</td><td class="c">' + f(r[1].sev) + '</td><td class="c">' + f(r[1].lsd) + '</td><td class="c">' + f(r[1].ip) + '</td><td class="c">' + f(r[1].premium) + '</td></tr>';
      }).join('') + '</tbody></table>' + (c.nowCount ? '' : '<p class="foot">There are no current policies in block 1 yet, so "what you have now" is nothing.</p>');
  }
  function cmpHTML(q) {
    var m = q.cmp; if (!m) return '';
    var lbl = { total: 'Total for all your needs', retirement: 'Your retirement needs', childcare: 'Your childcare needs' };
    return '<h4>Your change moment pay-out</h4>' + (m.rows && m.rows.length ? '<table class="ovt cmp"><thead><tr><th></th><th>Today</th><th>Projected value at your change moment date</th><th>Pay-out date</th></tr></thead><tbody>' +
      m.rows.map(function (r) { return '<tr><td>' + esc(r.key === 'child' ? ((r.name || '') + ' ' + (r.sname || '')).trim() : (lbl[r.key] || r.key)) + '</td><td class="c">' + amt(r.today) + '</td><td class="c">' + amt(r.projected) + '</td><td class="c">' + esc(r.payoutDate || '') + '</td></tr>'; }).join('') + '</tbody></table>' :
      '<p class="foot">' + esc(m.reason || 'The insurer gave no change moment pay-out for this quote.') + '</p>');
  }

  /* ---------- quotes ---------- */
  function quoteCard(q, i, bid) {
    var p = 'blocks.' + bid + '.quotes.' + i, title = check.qLabel(q) + (q.date ? ' · ' + q.date : '') + (q.rates ? ' · ' + q.rates : '');
    return '<article class="qcard" data-row="' + p + '"><header><span class="statusbadge s-' + esc(q.status) + '" data-statusfor="' + p + '">' + esc(schema.statusLabel[q.status]) + '</span><h3 data-titlefor="' + p + '">' + esc(title) + '</h3>' + stb(p) +
      '<span class="grow"></span><button type="button" class="x" data-del="' + p + '">Remove quote</button></header>' +
      '<div class="grid qh">' + lab('Insurer', inp(p + '.insurer', 'text', '', 'e.g. BrightRock')) + lab(/bright/i.test(q.insurer) ? 'CP number' : 'Quote number', inp(p + '.number', 'text')) + lab('Quote date', inp(p + '.date', 'date')) +
      lab('Rates', inp(p + '.rates', 'text')) + lab('Kind of quote', boolSel(p + '.servicing', 'Servicing', 'New business')) + lab('Status', sel(p + '.status', schema.STATUS, 'text', false)) +
      lab('Disability to age', sel(p + '.disabilityAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      (q.status === 'accepted' ? lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Start date', inp(p + '.startDate', 'date')) : '') + '</div>' +
      (q.status === 'accepted' && q.policyNo && q.startDate ? '<p class="blue">This quote has been issued as a policy, so it is also shown in block 1 as a current policy of ours.</p>' : '') +
      linesTable(p, q, false) + '<div class="under">' + cmpHTML(q) + '<h4>Compared with what you have now</h4><div data-comp="cmp|' + q.id + '">' + compareHTML(q) + '</div></div></article>';
  }
  function quotesBlock(b) {
    var list = (state.blocks[b.id].quotes || []), live = list.filter(function (q) { return !q.removed; }), gone = list.filter(function (q) { return q.removed; });
    var note = b.id === 'shortfallQuote' && !calc.hasGroupRisk(state) ? '<p class="blue">A shortfall quote is only needed when the client has group risk (block 3). There is none yet.</p>' : '';
    var cards = live.map(function (q) { var i = list.indexOf(q); return quoteCard(q, i, b.id); }).join('');
    var removed = gone.map(function (q) { var i = list.indexOf(q); return '<p class="gone">' + esc(check.qLabel(q)) + ' removed. <button type="button" class="lnk" data-undo="blocks.' + b.id + '.quotes.' + i + '">Undo</button></p>'; }).join('');
    return note + (cards || '<p class="empty-list">No ' + esc(b.one) + ' yet.</p>') + removed + '<button type="button" class="addrow big" data-addq="' + b.qkind + '">+ ' + (live.length ? 'Add another ' : 'Add new ') + esc(b.one) + '</button>';
  }

  /* ---------- block 1: current policies ---------- */
  function ageOf(it) { return it.ipAge || state.header.disabilityAge || ''; }
  function policyTable() {
    var ps = calc.policies(state), pt = calc.policyTotals(state), age = ageOf({}) ? ' (Age ' + ageOf({}) + ')' : '';
    function tr(label, t, prem, cls, extra) {
      return '<tr class="' + cls + '"><td>' + label + '</td><td class="c">' + amt(t.life.lump) + '</td><td class="c">' + amt(t.sev.lump) + '</td><td class="c">' + amt(t.lsd.lump) + '</td><td class="c">' + pm(t.ip.monthly) + '</td>' + (extra || '<td></td><td></td><td></td>') + '<td class="c">' + (calc.isNum(prem) ? '<span class="a">' + R(prem) + '</span>' : '') + '</td></tr>';
    }
    var rows = ps.map(function (e) {
      var it = e.item, t = calc.totals(it), has = calc.activeLines(it).length, tick = it.wr ? '<span class="tick">&#10003;</span>' : '<span class="cross">&#10007;</span>', w = (calc.activeLines(it).filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
      var b = it.benefits || {}, notes = [b.life, b.lsd, b.ip].filter(Boolean).join(' · ');
      return '<tr class="pol"><td>' + tick + ' <b>' + esc(it.insurer || 'Policy') + '</b>' + (it.policyNo ? ' <small>' + esc(it.policyNo) + '</small>' : '') + '<small class="d">' + esc([it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join(' · ')) + (notes ? ' · ' + esc(notes) : '') + (e.derived ? ' · from the accepted quote' : '') + '</small></td>' +
        '<td class="c">' + (has ? amt(t.life.lump) : amt(null)) + '</td><td class="c">' + (has ? amt(t.sev.lump) : amt(null)) + '</td><td class="c">' + (has ? amt(t.lsd.lump) : amt(null)) + '</td><td class="c">' + (has ? pm(t.ip.monthly) : amt(null)) + '</td>' +
        '<td class="c">' + esc(w || '') + '</td><td class="c">' + pctShow(it.aci) + '</td><td class="c">' + pctShow(it.abi) + '</td><td class="c">' + (calc.isNum(it.premium) ? '<span class="a">' + R(it.premium) + '</span>' : amt(null)) + '</td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty">No policies in the Fact Find yet.</td></tr>';
    return '<table class="ovt pols"><colgroup><col class="p-name"><col><col><col><col><col class="p-w"><col class="p-s"><col class="p-s"><col></colgroup><thead><tr><th>Policy</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability' + age + '</th><th>Income protector / sickness benefit' + age + '</th><th>Waiting period</th><th>ACI</th><th>ABI</th><th>Premium</th></tr></thead><tbody>' + rows +
      (pt.count.wr ? tr('Total policies where we are the broker', pt.wr, pt.premium.wr, 'tot') : '') + (pt.count.other ? tr('Total other brokers', pt.other, pt.premium.other, 'tot') : '') + tr('Grand total (all policies)', pt.all, pt.premium.all, 'tot grand') + '</tbody></table>';
  }
  function policyCard(it, i) {
    var p = 'blocks.policies.items.' + i;
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.insurer || 'Policy') + (it.policyNo ? ' · ' + esc(it.policyNo) : '') + '</h3>' + stb(p) +
      '<span class="grow"></span><span class="src">' + (it.wr ? 'We are the broker' : 'Another broker: ' + esc(it.broker || '')) + '</span></header><div class="grid qh">' +
      lab('Insurer', inp(p + '.insurer', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Date of commencement', inp(p + '.doc', 'date')) + lab('Monthly premium (R)', inp(p + '.premium', 'money')) +
      lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('ABI (%)', inp(p + '.abi', 'pct')) + lab('Disability to age', sel(p + '.ipAge', [{ id: 65, l: '65' }, { id: 70, l: '70' }], 'num')) +
      lab('Life cover note', inp(p + '.benefits.life', 'text', '', 'e.g. Whole of life')) + lab('Disability note', inp(p + '.benefits.lsd', 'text')) + lab('Income protector note', inp(p + '.benefits.ip', 'text')) +
      lab('Cession', sel(p + '.cession', [{ id: 'true', l: 'Ceded' }, { id: 'false', l: 'Not ceded' }], 'tri')) + '</div>' + linesTable(p, it, true) + '</article>';
  }
  function policiesBlock() {
    var items = state.blocks.policies.items;
    return '<p class="blue">Current policies are added and removed in the Fact Find; this page follows it. Details from a schedule are filled in here (an upload fills them in later).</p><div data-comp="poltab|">' + policyTable() + '</div>' +
      items.map(function (it, i) { return it.removed ? '' : policyCard(it, i); }).join('');
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
    return '<table class="ovt grp"><colgroup><col class="p-name"><col><col><col><col><col class="p-w"><col class="p-s"><col class="p-s"><col></colgroup><thead><tr><th>Item</th><th>Life cover</th><th>Severe illness</th><th>Lump sum disability' + age + '</th><th>Income protector / sickness benefit' + age + '</th><th>Waiting period</th><th>ACI</th><th>ABI</th><th>Total monthly premium</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">Nothing in the Fact Find yet.</td></tr>') +
      '<tr class="pol"><td><b>Personal investments</b><small class="d">The total of block 8 (' + pi.count + (pi.count === 1 ? ' investment' : ' investments') + ')</small></td><td class="c">' + (pi.count ? amt(pi.gross) : amt(null)) + '</td><td class="c"></td><td class="c"></td><td class="c"></td><td class="c"><span class="na">N/A</span></td><td class="c"><span class="na">N/A</span></td><td class="c"><span class="na">N/A</span></td><td class="c">' + (pi.count ? '<span class="a">' + R(pi.monthly) + '</span>' : amt(null)) + '</td></tr>' +
      '<tr class="tot grand"><td>Total</td><td class="c">' + amt(calc.r2(gt.life + pi.gross)) + '</td><td class="c">' + amt(gt.sev) + '</td><td class="c">' + amt(gt.lsd) + '</td><td class="c">' + pm(gt.ip) + '</td><td colspan="3"></td><td class="c"><span class="a">' + R(totalPrem) + '</span></td></tr></tbody></table>';
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
    return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(schema.GROUP_KINDS[it.kind] || it.kind) + ' · ' + esc(it.provider || '') + '</h3>' + stb(p) + '</header>' + body + '</article>';
  }
  function groupBlock() {
    var items = state.blocks.group.items;
    return '<p class="blue">Group risk, pension and provident funds are added and removed in the Fact Find; this page follows it. The ending age of every benefit is read from the statement.</p><div data-comp="grouptab|">' + groupTable() + '</div>' +
      items.map(function (it, i) { return it.removed ? '' : groupCard(it, i); }).join('');
  }

  /* ---------- block 4: shortfall ---------- */
  function shortfallHTML() {
    var s = calc.shortfall(state);
    if (!s.has) return '<p class="empty-list">There is no FNA quote yet (block 2). The shortfall is the FNA less what the client already has through group benefits and personal investments.</p>';
    var rows = [['life', 'Life cover', R], ['sev', 'Severe illness', R], ['lsd', 'Lump sum disability', R], ['ip', 'Income protector (R p.m.)', R]];
    return '<table class="ovt sf"><thead><tr><th></th><th>FNA</th><th>Less group benefits</th><th>Less personal investments</th><th>Shortfall</th></tr></thead><tbody>' + rows.map(function (r) {
      var pi = r[0] === 'life' ? s.pi.gross : null;
      return '<tr><td>' + r[1] + '</td><td class="c">' + amt(s.fna[r[0]]) + '</td><td class="c">' + (s.group[r[0]] ? amt(s.group[r[0]]) : '<span class="none">none</span>') + '</td><td class="c">' + (pi ? amt(pi) : '<span class="none">none</span>') + '</td><td class="c"><b class="a">' + R(s.short[r[0]]) + '</b></td></tr>';
    }).join('') + '</tbody></table><p class="foot">Worked out from ' + esc(check.qLabel(s.quote)) + '. Personal investments (block 8, retirement annuities included) reduce the life cover shortfall only.</p>';
  }
  function shortfallBlock() { return '<div data-comp="sf|">' + shortfallHTML() + '</div>'; }

  /* ---------- block 8: current investments ---------- */
  function invTable() {
    var items = calc.investments(state), pi = calc.personalInvestments(state);
    var rows = items.map(function (i) {
      var vs = i.valueSource || {}, srcTxt = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? ' ' + vs.date : '') : '';
      return '<tr class="pol"><td>' + (i.wr ? '<span class="tick">&#10003;</span>' : '<span class="cross">&#10007;</span>') + ' <b>' + esc(i.provider || 'Investment') + '</b><small class="d">' + esc(i.product || '') + '</small></td><td class="c">' + esc(i.valueDate || '') + '</td><td class="c">' + esc(srcTxt) + '</td><td class="c">' + amt(i.gross) +
        '</td><td class="c">' + amt(i.penalty) + '</td><td class="c">' + (calc.isNum(i.gross) ? amt(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : amt(null)) + '</td><td class="c">' + pctShow(i.returnRate) + '</td><td class="c">' + pctShow(i.aci) + '</td><td class="c">' + (calc.isNum(i.monthly) ? '<span class="a">' + R(i.monthly) + '</span>' : amt(null)) + '</td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty">No investments in the Fact Find yet.</td></tr>';
    return '<table class="ovt inv"><colgroup><col class="p-name"><col class="p-w"><col><col><col><col><col class="p-s"><col class="p-s"><col></colgroup><thead><tr><th>Investment</th><th>Values at</th><th>Source</th><th>Gross fund value</th><th>Penalties</th><th>Net fund value</th><th>Rate of return</th><th>ACI</th><th>Premium</th></tr></thead><tbody>' + rows +
      '<tr class="tot grand"><td>Total investments</td><td></td><td></td><td class="c">' + amt(pi.gross) + '</td><td class="c">' + amt(pi.penalty) + '</td><td class="c">' + amt(pi.net) + '</td><td></td><td></td><td class="c"><span class="a">' + R(pi.monthly) + '</span></td></tr></tbody></table>';
  }
  function invCard(it, i) {
    var p = 'blocks.investments.items.' + i; if (!it.valueSource) it.valueSource = { kind: null, date: null, file: null };
    return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(it.provider || 'Investment') + ' · ' + esc(it.product || '') + '</h3>' + stb(p) + '</header><div class="grid qh">' +
      lab('Provider', inp(p + '.provider', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Values at (date)', inp(p + '.valueDate', 'date')) +
      lab('Source', sel(p + '.valueSource.kind', [{ id: 'schedule', l: 'Investment schedule' }, { id: 'astute', l: 'Astute report' }], 'text')) + lab('Source date', inp(p + '.valueSource.date', 'date')) + lab('Source file', inp(p + '.valueSource.file', 'text')) +
      lab('Gross fund value (R)', inp(p + '.gross', 'money')) + lab('Section 14 transfer penalty (R)', inp(p + '.penalty', 'money')) + lab('Rate of return (%)', inp(p + '.returnRate', 'pct')) +
      lab('Annual contribution increase (%)', inp(p + '.aci', 'pct', '', 'Not found')) + lab('Total monthly premium (R)', inp(p + '.monthly', 'money')) + '</div></article>';
  }
  function investmentsBlock() {
    var items = state.blocks.investments.items;
    return '<p class="blue">Investments are added and removed in the Fact Find; this page follows it. Every value shows when and where it came from: an investment schedule first, the Astute report only where there is none.</p><div data-comp="invtab|">' + invTable() + '</div>' +
      items.map(function (it, i) { return it.removed ? '' : invCard(it, i); }).join('');
  }

  /* ---------- blocks 9, 10, 11 ---------- */
  function proposedBlock() {
    var items = state.blocks.proposed.items, rows = items.map(function (it, i) {
      var p = 'blocks.proposed.items.' + i;
      if (it.removed) return '<tr class="removed" data-row="' + p + '"><td colspan="10"><span class="gone">' + esc(it.type) + ' removed.</span> <button type="button" class="lnk" data-undo="' + p + '">Undo</button></td></tr>';
      return '<tr data-row="' + p + '"><td>' + stb(p) + sel(p + '.type', schema.PROPOSED_TYPES, 'text', false) + '</td><td>' + inp(p + '.provider', 'text', '', 'Provider') + inp(p + '.quote', 'text', '', 'Quote number') + '</td><td>' + sel(p + '.contribution', schema.CONTRIBUTIONS, 'text', false) + '</td><td>' + inp(p + '.lump', 'money') + '</td><td>' + inp(p + '.monthly', 'money') +
        '</td><td>' + inp(p + '.boostPct', 'pct') + '</td><td>' + inp(p + '.netInvested', 'money') + '</td><td>' + inp(p + '.aci', 'pct') + '</td><td class="x"><button type="button" class="xbtn" data-del="' + p + '" title="Remove">&times;</button></td></tr>';
    }).join('') || '<tr><td colspan="10" class="empty">No proposed investments yet.</td></tr>';
    return '<table class="ovt prop"><thead><tr><th>Investment type</th><th>Provider &amp; quote</th><th>Contribution</th><th>Lump sum</th><th>Monthly premium</th><th>Boost %</th><th>Net amount invested</th><th>ACI %</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="foot">The boost and the net amount are read from the quote; they are not worked out here.</p><button type="button" class="addrow big" data-addp="1">+ Add a proposed investment</button>';
  }
  function goalsBlock() {
    var items = state.blocks.goals.items;
    return items.map(function (it, i) {
      var p = 'blocks.goals.items.' + i, name = it.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)';
      if (it.removed) return '<p class="gone">' + esc(name) + ' removed. <button type="button" class="lnk" data-undo="' + p + '">Undo</button></p>';
      return '<article class="qcard" data-row="' + p + '"><header><h3>' + esc(name) + '</h3>' + stb(p) + '<span class="grow"></span><button type="button" class="x" data-del="' + p + '">Remove</button></header><div class="grid qh">' +
        lab('Requested', boolSel(p + '.requested', 'Requested', 'Not requested')) + lab('Note', inp(p + '.note', 'text', '', 'Client did not request for at this time')) + lab('Current value (R p.m. gross)', inp(p + '.currentValuePm', 'money')) +
        lab('Future value (R p.m. gross)', inp(p + '.futureValuePm', 'money')) + lab('ACI (%)', inp(p + '.aci', 'pct')) + lab('Premium (R p.m.)', inp(p + '.premium', 'money')) + '</div></article>';
    }).join('') || '<p class="empty-list">No goal analysis reports yet. Fill from the Fact Find to add the retirement and education lines.</p>';
  }
  function otherBlock() {
    return '<p class="blue">Medical aid, will and short-term come from the Fact Find, plus later updates (for example the referral company called the client): put those in the note.</p>' +
      state.blocks.other.items.map(function (it, i) {
        var p = 'blocks.other.items.' + i, nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === it.key; })[0] || { l: it.key }).l;
        return '<article class="qcard" data-row="' + p + '"><header><span class="' + (it.wr ? 'tick' : 'cross') + '" data-tickfor="' + p + '">' + (it.wr ? '&#10003;' : '&#10007;') + '</span><h3>' + esc(nm) + '</h3>' + stb(p) + '</header><div class="grid qh">' +
          lab('Company', inp(p + '.company', 'text')) + lab('Product', inp(p + '.product', 'text')) + lab('Policy number', inp(p + '.policyNo', 'text')) + lab('Broker', boolSel(p + '.wr', 'We are the broker', 'Another broker')) + lab('Premium (R p.m.)', inp(p + '.premium', 'money')) + lab('Note', inp(p + '.note', 'text'), 'wide') + '</div></article>';
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
    h += schema.BLOCKS.map(function (b) { return '<button type="button" data-block="' + b.id + '"' + (b.id === cur ? ' aria-current="true"' : '') + '><span><i class="dot ' + (last.dots[b.id] || 'grey') + '" data-dot="' + b.id + '"></i>' + b.n + ' ' + esc(b.title) + '</span></button>'; }).join('');
    $('#nav').innerHTML = h;
  }
  function drawMain() {
    var b = schema.blocksById[cur], title = cur === CLIENT ? 'Client details' : b.n + '. ' + b.title;
    $('#main').innerHTML = (state.newer ? '<p class="bad-note">This file was made by a newer version of the Overview, so it is open read-only: nothing can be changed or saved here.</p>' : '') +
      '<header><h2>' + esc(title) + '</h2></header>' + blockHTML(cur) +
      '<div class="pagenav"><span></span><span>' + (function () { var i = schema.BLOCKS.indexOf(b), n = cur === CLIENT ? schema.BLOCKS[0] : schema.BLOCKS[i + 1]; return n ? '<button type="button" class="btn small" data-block="' + n.id + '">' + n.n + ' ' + esc(n.title) + ' &rsaquo;</button>' : ''; })() + '</span></div>';
    paintStatuses(); $('#main').scrollTop = 0;
  }
  function redraw() { last = check.run(state); drawNav(); drawMain(); refreshChrome(); }
  function paintComputed() {
    document.querySelectorAll('[data-comp]').forEach(function (el) { var q = el.getAttribute('data-comp').split('|'); el.innerHTML = compHTML(q[0], q[1]); });
    document.querySelectorAll('[data-aci]').forEach(function (el) { var q = el.getAttribute('data-aci') && store.findQuote(state, el.getAttribute('data-aci')); el.textContent = q ? calc.fmtPct(q.aci) : ''; });
  }
  function paintStatuses() {
    document.querySelectorAll('[data-row]').forEach(function (el) {
      var o = store.pathGet(state, el.getAttribute('data-row')); if (!o) return;
      el.classList.remove('s-empty', 's-ff', 's-verify', 's-confirmed'); el.classList.add('s-' + (o.st || 'empty'));
      var b = el.querySelector('[data-stfor="' + el.getAttribute('data-row') + '"]'); if (b) b.innerHTML = badgeHTML(el.getAttribute('data-row'), o.st, el.tagName === 'TR');
    });
    document.querySelectorAll('[data-statusfor]').forEach(function (el) { var q = store.pathGet(state, el.getAttribute('data-statusfor')); if (q) { el.textContent = schema.statusLabel[q.status] || ''; el.className = 'statusbadge s-' + q.status; } });
    document.querySelectorAll('[data-titlefor]').forEach(function (el) { var q = store.pathGet(state, el.getAttribute('data-titlefor')); if (q) el.textContent = check.qLabel(q) + (q.date ? ' \u00b7 ' + q.date : '') + (q.rates ? ' \u00b7 ' + q.rates : ''); });
    document.querySelectorAll('[data-tickfor]').forEach(function (el) { var o = store.pathGet(state, el.getAttribute('data-tickfor')); if (o) { el.className = o.wr ? 'tick' : 'cross'; el.innerHTML = o.wr ? '&#10003;' : '&#10007;'; } });
  }
  function drawChecks() {
    var h = '', p = last.problems;
    p.forEach(function (x) { h += '<button type="button" class="amber" data-jump="' + (x.block || CLIENT) + '"><b>' + esc(x.where) + '</b> ' + esc(x.message) + '</button>'; });
    $('#checks').innerHTML = h || '<div class="ok">&#10003; Nothing to look at.</div>';
  }
  function refreshChrome() {
    last = check.run(state);
    var name = store.clientName(state), c = store.counts(state);
    $('#clientName').textContent = name || 'New client';
    document.title = 'Client Overview' + (name ? ' - ' + name : '');
    $('#saveState').textContent = (fileBase ? fileBase + ' · ' : '') + (dirty ? 'unsaved changes' : (lastSaved ? 'saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no changes'));
    $('#sFilled').textContent = c.confirmed; $('#sVerify').textContent = c.check; $('#sEmpty').textContent = c.waiting;
    $('#btnAgree').hidden = !c.check;
    $('#verLine').textContent = 'Version ' + schema.version + ', ' + schema.released;
    schema.BLOCKS.forEach(function (b) { var d = document.querySelector('[data-dot="' + b.id + '"]'); if (d) d.className = 'dot ' + (last.dots[b.id] || 'grey'); });
    drawChecks(); drawMeta();
  }
  function drawMeta() {
    var ff = state.factFind, from = ff && ff.file ? '<div>Filled from the Fact Find <b>' + esc(ff.file) + '</b>' + (ff.changed ? ' <span class="chg">(' + ff.changed + ' changed since)</span>' : '') + '</div>' : '<div>Not filled from a Fact Find yet.</div>';
    $('#meta').innerHTML = '<div>It saves as</div><div class="fn">' + esc(currentBase()) + '</div><div>in the folder <span class="fn">1. Overview\\' + esc(schema.yearOf(state)) + '</span></div>' + from;
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
    var t = e.target.closest('[data-accept],[data-addq],[data-addl],[data-addp],[data-del],[data-undo],[data-block]'); if (!t) return;
    if (t.hasAttribute('data-block')) { cur = t.getAttribute('data-block'); drawNav(); drawMain(); refreshChrome(); window.scrollTo({ top: 0 }); return; }
    if (state.newer) return;
    if (t.hasAttribute('data-accept')) { store.accept(state, t.getAttribute('data-accept')); touch(); paintStatuses(); return; }
    if (t.hasAttribute('data-addq')) { store.addQuote(state, t.getAttribute('data-addq')); touch(); drawMain(); var cards = document.querySelectorAll('.qcard'); if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'start' }); return; }
    if (t.hasAttribute('data-addp')) { state.blocks.proposed.items.push(store.newProposed()); touch(); drawMain(); return; }
    if (t.hasAttribute('data-addl')) { var q = pathOf(t.getAttribute('data-addl')); store.addLine(state, q[0], q[1]); touch(); drawMain(); return; }
    if (t.hasAttribute('data-del')) {
      var path = t.getAttribute('data-del'), o = store.pathGet(state, path);
      if (o && /\.quotes\.\d+$/.test(path) && !window.confirm('Remove this quote? It can be brought back with Undo.')) return;
      store.setRemoved(state, path, true); touch(); drawMain(); return;
    }
    if (t.hasAttribute('data-undo')) { store.setRemoved(state, t.getAttribute('data-undo'), false); touch(); drawMain(); }
  });
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('[data-block]'); if (b) { cur = b.getAttribute('data-block'); drawNav(); drawMain(); refreshChrome(); } });
  $('#checks').addEventListener('click', function (e) { var b = e.target.closest('[data-jump]'); if (b) { cur = b.getAttribute('data-jump'); drawNav(); drawMain(); refreshChrome(); } });
  $('#btnAgree').addEventListener('click', function () { var n = store.acceptAll(state); touch(); redraw(); toast(n + (n === 1 ? ' row' : ' rows') + ' marked as checked.'); });
  $('#btnSave').addEventListener('click', function () { saveJson(false); });
  $('#btnSaveAs').addEventListener('click', function () { saveJson(true); });
  $('#btnNew').addEventListener('click', newOverview);
  $('#btnOpen').addEventListener('click', chooseFile);
  $('#btnLoad').addEventListener('click', chooseFactFind);
  $('#fileIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) openFile(f, null); });
  $('#ffIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) { var r = new FileReader(); r.onload = function () { fillFactFind(r.result, f.name); }; r.readAsText(f); } });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start: a blank overview. Unsaved work from last time is offered back; the client the adviser came from (the Fact Find's hand-over) fills it, as for the two applications. ---------- */
  var restored = null, restoredBase = '';
  try { if (localStorage.getItem(DRAFT_KEY + '-dirty') === '1') restored = loadDraft(); } catch (e) { restored = null; }
  try { restoredBase = restored ? (localStorage.getItem(DRAFT_KEY + '-file') || '') : ''; } catch (e) { restoredBase = ''; }
  state = store.blank();
  if (restored) draftHold = true; else rememberHandle(null);
  window.OV.app = { get state() { return state; }, redraw: redraw, setState: function (s) { state = s; redraw(); }, fillFactFindText: function (t, n) { var rep = store.fillFromFactFind(state, t, n); touch(); redraw(); return rep; }, go: function (b) { cur = b; drawNav(); drawMain(); refreshChrome(); } };
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
