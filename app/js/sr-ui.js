/* The Short Risk Application screen: draws the form from sr-schema.js, keeps the answers in sr-store.js, saves and reopens files, loads the client from a Fact Find, makes the PDF. */
(function () {
  var FF = window.FF, SR = window.SR, util = FF.util, schema = SR.schema, store = SR.store, check = SR.check;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DRAFT_KEY = 'wr-short-risk-draft';

  var state, cur = schema.pages[0].id, fileHandle = null, fileBase = '', dirty = false, onDisk = true, lastSaved = null, toastTimer = null, draftHold = false, last = { missing: [], problems: [] };

  /* ---------- drafts and saving (the Fact Find's way: a safety copy in the browser while work is unsaved, removed once a file is saved and read back) ---------- */
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
        var rq = indexedDB.open('wr-short-risk', 1);
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

  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function pickerOptions(name, type, accept, id, startIn) {
    var o = { suggestedName: name, types: [{ description: type, accept: accept }] };
    if (startIn) o.startIn = startIn; else o.id = id;
    return o;
  }
  /* Chrome's "Save as" window where there is one, otherwise a plain download. With a remembered file it writes straight back to it. */
  function writeFile(blob, name, type, ext, handle, id, startIn) {
    if (!window.showSaveFilePicker) { download(blob, name); return Promise.resolve(null); }
    var accept = {}; accept[blob.type] = [ext];
    var open = handle
      ? Promise.resolve(handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : 'granted').then(function (p) { if (p !== 'granted') throw new Error('Chrome did not allow changes to that file.'); return handle; })
      : window.showSaveFilePicker(pickerOptions(name, type, accept, id, startIn));
    return open.then(function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(function () { return h; }); });
  }
  function currentBase() { return fileBase || store.baseFileName(state); }
  function readBack(h, text) {
    if (!h || !h.getFile) return Promise.resolve('unchecked');
    return h.getFile().then(function (f) { return f.text(); }).then(function (t) { return t === text ? 'ok' : 'different'; }, function () { return 'unchecked'; });
  }
  /* The draft in the browser is removed only once the file is on disk, read back and the same as what was written. */
  function saveJson(forceAs) {
    var text = store.toJSON(state), blob = new Blob([text], { type: 'application/json' });
    writeFile(blob, currentBase() + '.json', 'Short Risk Application', '.json', forceAs ? null : fileHandle, 'short-risk-data', fileHandle).then(function (h) {
      if (h) { fileHandle = h; fileBase = h.name.replace(/\.json$/i, ''); rememberHandle(h); }
      else if (!fileBase) fileBase = currentBase();
      return readBack(h, text).then(function (v) {
        if (v === 'different') { refreshChrome(); toast('The saved file does not match the form, so your work is still kept here. Try Save again.', 7000); return; }
        dirty = false; onDisk = v === 'ok'; lastSaved = new Date(); saveDraft(); refreshChrome(); toast('Saved.');
      });
    }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save: ' + e.message); });
  }
  function makePdf() { return SR.pdf.build(state); }
  function savePdf() {
    var blob = makePdf().output('blob');
    writeFile(blob, store.pdfFileName(state) + '.pdf', 'PDF document', '.pdf', null, 'short-risk-pdf', fileHandle)
      .then(function () { toast('PDF saved.'); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save the PDF: ' + e.message); });
  }
  function previewPdf() {
    var blob = makePdf().output('blob'), url = URL.createObjectURL(blob), w = window.open(url, '_blank');
    if (!w) download(blob, store.pdfFileName(state) + '.pdf');
  }
  function openFile(file, handle) {
    var r = new FileReader();
    r.onload = function () {
      try {
        state = store.fromJSON(r.result); fileHandle = handle || null; fileBase = file.name.replace(/\.json$/i, '');
        dirty = false; onDisk = true; cur = schema.pages[0].id; rememberHandle(handle || null); saveDraft(); redraw(); toast('Opened ' + file.name);
      } catch (e) { toast(e.message || 'Could not open that file.', 6000); }
    };
    r.readAsText(file);
  }
  function chooseFile() {
    if (!window.showOpenFilePicker) { $('#fileIn').click(); return; }
    window.showOpenFilePicker({ id: 'short-risk-data', types: [{ description: 'Short Risk Application', accept: { 'application/json': ['.json'] } }] })
      .then(function (hs) { return hs[0].getFile().then(function (f) { openFile(f, hs[0]); }); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open: ' + e.message); });
  }
  /* Load from Fact Find: the client's saved Fact Find file is read, never changed. */
  function loadFactFind(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var rep = store.loadFromFactFind(state, r.result, file.name);
        touch(); redraw();
        var bits = [];
        if (rep.loaded.length) bits.push(rep.loaded.length + (rep.loaded.length === 1 ? ' box' : ' boxes'));
        if (rep.children) bits.push(rep.children + (rep.children === 1 ? ' child' : ' children'));
        toast((bits.length ? 'Loaded ' + bits.join(' and ') + ' from the Fact Find. Check them with the client.' : 'Nothing new to load from that Fact Find.') + (rep.kept.length ? ' Left as typed: ' + rep.kept.join(', ') + '.' : ''), 8000);
      } catch (e) { toast(e.message || 'Could not read that Fact Find.', 6000); }
    };
    r.readAsText(file);
  }
  function chooseFactFind() {
    if (!window.showOpenFilePicker) { $('#ffIn').click(); return; }
    window.showOpenFilePicker({ id: 'fact-find-data', types: [{ description: 'Fact Find', accept: { 'application/json': ['.json'] } }] })
      .then(function (hs) { return hs[0].getFile().then(function (f) { loadFactFind(f); }); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open: ' + e.message); });
  }
  function newApp() {
    if (dirty && !window.confirm('Start a new application? Changes you have not saved will be lost.')) return;
    state = store.blank(); fileHandle = null; fileBase = ''; rememberHandle(null); dirty = false; onDisk = true; lastSaved = null; cur = schema.pages[0].id; saveDraft(); redraw();
  }

  /* ---------- drawing ---------- */
  function badge(st, target, opt) {
    var t = { empty: opt ? '' : 'to answer', preset: 'preset', confirmed: 'confirmed', verify: 'verify' }[st];
    if (!t) return '';
    var act = st === 'verify' ? ' data-accept="' + esc(target) + '" title="Click when the client has agreed"' : '';
    return '<button type="button" class="badge ' + st + '"' + act + ' tabindex="-1">' + t + '</button>';
  }
  function optionsHTML(o, v) {
    var list = o.slice(); if (v && list.indexOf(v) < 0) list.push(v);
    return '<option value="">&nbsp;</option>' + list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
  }
  function inputHTML(attr, c, v, dl) {
    if (c.t === 'sel' && !c.free) return '<select ' + attr + '>' + optionsHTML(c.o, v) + '</select>';
    return '<input type="text" ' + attr + ' value="' + esc(v) + '"' + (c.o ? ' list="' + dl + '"' : '') + (c.hint ? ' placeholder="' + esc(c.hint) + '"' : (c.t === 'date' ? ' placeholder="dd/mm/yyyy"' : '')) + ' autocomplete="off">' +
      (c.o ? '<datalist id="' + dl + '">' + c.o.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' : '');
  }
  function fieldClass(f) {
    var b = state.f[f.id], bad = problemsFor(f.id).some(function (p) { return p.level === 'bad'; });
    return 'f s-' + b.st + (f.opt ? ' is-opt' : '') + (f.wide ? ' wide' : '') + (store.shown(state, f.id) ? '' : ' off') + (bad ? ' has-bad' : '');
  }
  function noteHTML(id) {
    var p = problemsFor(id)[0];
    return p ? '<div class="note-line ' + p.level + '" data-note="' + id + '">' + esc(p.text) + '</div>' : '<div class="note-line" data-note="' + id + '" hidden></div>';
  }
  function fieldHTML(f) {
    var b = state.f[f.id];
    return '<label class="' + fieldClass(f) + '" data-field="' + f.id + '"><span class="l"><span>' + esc(f.l) + '</span>' + (f.opt ? '<span class="opt">optional</span>' : '') + '</span>' +
      '<div class="box">' + inputHTML('data-f="' + f.id + '"' + (store.shown(state, f.id) ? '' : ' disabled'), f, b.v, 'dl-' + f.id) + '<span class="st">' + badge(b.st, 'f:' + f.id, f.opt) + '</span></div>' + noteHTML(f.id) + '</label>';
  }
  function rowHTML(key, r, i) {
    var L = schema.lists[key], bad = problemsOfRow(key, i).some(function (p) { return p.level === 'bad'; }) || problemsOfRow(key, i).length;
    return '<div class="rowcard s-' + r.st + (bad ? ' has-bad' : '') + '" data-row="' + key + '|' + i + '"><div class="rowhead"><b>' + esc(L.one) + ' ' + (i + 1) + '</b>' +
      (r.st === 'verify' ? badge('verify', 'l:' + key + ':' + i) : '') + '<span class="grow"></span><button type="button" class="x" data-del="' + key + '|' + i + '">Remove</button></div><div class="grid">' +
      L.cols.map(function (c) {
        return '<label class="f"><span class="l"><span>' + esc(c.l) + '</span></span><div class="box">' + inputHTML('data-l="' + key + '|' + i + '|' + c.k + '"', { o: c.o }, r.d[c.k], 'dl-' + key + '-' + c.k) + '</div></label>';
      }).join('') + '</div></div>';
  }
  function sumHTML(key) {
    var L = schema.lists[key]; if (!L.sum || !state.l[key].length) return '';
    var total = state.l[key].reduce(function (a, r) { return a + store.pctNum(r.d[L.sum]); }, 0), t = Math.round(total * 100) / 100, ok = Math.abs(t - 100) < 0.001;
    return '<div class="sumstrip ' + (ok ? 'ok' : 'bad') + '" data-sum="' + key + '"><span>Total of the shares<b>' + t + '%</b></span><span>' + (ok ? 'Adds up to 100%.' : 'Must add up to 100%.') + '</span></div>';
  }
  function listHTML(key) {
    var L = schema.lists[key], rows = state.l[key];
    return (rows.length ? rows.map(function (r, i) { return rowHTML(key, r, i); }).join('') : '<div class="empty-list">No ' + L.title.toLowerCase() + ' added. Leave it empty when there are none.</div>') +
      '<div data-sumwrap="' + key + '">' + sumHTML(key) + '</div><button type="button" class="addrow" data-add="' + key + '">+ ' + esc(L.add) + '</button>';
  }
  function sectionHTML(s) {
    return '<section class="sec" data-sec="' + s.id + '"><div class="block-title">' + esc(s.title) + '</div>' + (s.note ? '<p class="sub">' + esc(s.note) + '</p>' : '') +
      (s.list ? listHTML(s.list) : '<div class="grid">' + s.fields.map(fieldHTML).join('') + '</div>') + '</section>';
  }
  function pageLeft(p) { return p.sections.reduce(function (a, id) { return a + store.leftIn(state, schema.sectionsById[id]); }, 0); }
  function drawPage() {
    var p = schema.pages.filter(function (x) { return x.id === cur; })[0] || schema.pages[0], i = schema.pages.indexOf(p), left = pageLeft(p);
    $('#main').innerHTML = '<header><h2>' + esc(p.title) + '</h2><span class="tier' + (left ? '' : ' c') + '" data-tier>' + (left ? left + ' to answer' : 'complete') + '</span></header>' +
      p.sections.map(function (id) { return sectionHTML(schema.sectionsById[id]); }).join('') +
      '<div class="pagenav"><span>' + (i > 0 ? '<button type="button" class="btn ghost small" data-go="' + schema.pages[i - 1].id + '">&lsaquo; ' + esc(schema.pages[i - 1].title) + '</button>' : '') + '</span>' +
      '<span>' + (i < schema.pages.length - 1 ? '<button type="button" class="btn small" data-go="' + schema.pages[i + 1].id + '">' + esc(schema.pages[i + 1].title) + ' &rsaquo;</button>' : '') + '</span></div>';
    $('#main').scrollTop = 0;
  }
  function drawNav() {
    $('#nav').innerHTML = schema.pages.map(function (p) {
      var left = pageLeft(p);
      return '<button type="button" data-page="' + p.id + '"' + (p.id === cur ? ' aria-current="true"' : '') + '><span>' + esc(p.title) + '</span>' + (left ? '<span class="n" data-count="' + p.id + '">' + left + '</span>' : '<span class="ck" data-count="' + p.id + '">&#10003;</span>') + '</button>';
    }).join('');
  }
  function redraw() { last = check.run(state); drawNav(); drawPage(); refreshChrome(); }

  /* ---------- keeping the screen in step without redrawing it (so the cursor stays where it is) ---------- */
  function problemsFor(id) { return last.problems.filter(function (p) { return p.f === id; }); }
  function problemsOfRow(key, i) { return last.problems.filter(function (p) { return p.l === key && p.i === i; }); }
  function paintField(id) {
    var el = document.querySelector('[data-f="' + id + '"]'); if (!el) return;
    var f = schema.fieldsById[id], c = state.f[id], wrap = el.closest('.f'), on = store.shown(state, id);
    if (el.tagName === 'SELECT' && c.v && ![].some.call(el.options, function (o) { return o.value === c.v; })) el.insertAdjacentHTML('beforeend', '<option>' + esc(c.v) + '</option>');
    if (el.value !== c.v) el.value = c.v;
    el.disabled = !on;
    wrap.className = fieldClass(f);
    var st = wrap.querySelector('.st'); if (st) st.innerHTML = badge(c.st, 'f:' + id, f.opt);
    var note = wrap.querySelector('.note-line'), p = problemsFor(id)[0];
    if (note) { note.hidden = !p; note.textContent = p ? p.text : ''; note.className = 'note-line' + (p ? ' ' + p.level : ''); }
  }
  function paintAll() {
    var p = schema.pages.filter(function (x) { return x.id === cur; })[0];
    p.sections.forEach(function (sid) {
      var s = schema.sectionsById[sid];
      (s.fields || []).forEach(function (f) { paintField(f.id); });
      if (s.list) {
        document.querySelectorAll('[data-row^="' + s.list + '|"]').forEach(function (card) {
          var i = +card.getAttribute('data-row').split('|')[1], r = state.l[s.list][i]; if (!r) return;
          var pr = problemsOfRow(s.list, i);
          card.className = 'rowcard s-' + r.st + (pr.length ? ' has-bad' : '');
          var head = card.querySelector('.rowhead'), old = head.querySelector('.badge');
          if (old) old.remove();
          if (r.st === 'verify') head.querySelector('b').insertAdjacentHTML('afterend', badge('verify', 'l:' + s.list + ':' + i));
        });
        var sw = document.querySelector('[data-sumwrap="' + s.list + '"]'); if (sw) sw.innerHTML = sumHTML(s.list);
      }
    });
  }
  function refreshChrome() {
    last = check.run(state);
    var name = store.clientName(state), c = store.counts(state);
    $('#clientName').textContent = name || 'New client';
    document.title = 'Short Risk Application' + (name ? ' - ' + name : '');
    $('#saveState').textContent = (fileBase ? fileBase + ' · ' : '') + (dirty ? 'unsaved changes' : (lastSaved ? 'saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no changes'));
    $('#sFilled').textContent = c.filled; $('#sVerify').textContent = c.verify; $('#sEmpty').textContent = c.left;
    $('#btnAgree').hidden = !c.verify;
    $('#verLine').textContent = 'Version ' + schema.version + ', ' + schema.released;
    schema.pages.forEach(function (p) {
      var el = document.querySelector('[data-count="' + p.id + '"]'), left = pageLeft(p); if (!el) return;
      el.className = left ? 'n' : 'ck'; el.innerHTML = left ? String(left) : '&#10003;';
    });
    var tier = document.querySelector('[data-tier]'), page = schema.pages.filter(function (x) { return x.id === cur; })[0];
    if (tier && page) { var l = pageLeft(page); tier.textContent = l ? l + ' to answer' : 'complete'; tier.className = 'tier' + (l ? '' : ' c'); }
    drawChecks(); drawMeta();
  }
  function jumpTo(page, id, row) {
    if (cur !== page) { cur = page; drawNav(); drawPage(); refreshChrome(); }
    var el = id ? document.querySelector('[data-f="' + id + '"]') : document.querySelector('[data-row="' + row + '"] input');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
  }
  function drawChecks() {
    var h = '', byPage = {};
    last.missing.forEach(function (m) { var pg = schema.pageOf[m.section]; (byPage[pg] = byPage[pg] || []).push(m); });
    schema.pages.forEach(function (p) {
      var list = byPage[p.id]; if (!list) return;
      h += '<button type="button" data-jump="' + p.id + '|' + list[0].id + '">' + esc(p.title) + ': ' + list.length + (list.length === 1 ? ' box' : ' boxes') + ' to answer</button>';
    });
    last.problems.forEach(function (p) {
      var pg = p.f ? schema.pageOf[schema.sectionOf[p.f]] : schema.pageOf[p.l];
      h += '<button type="button" class="' + p.level + '" data-jump="' + pg + '|' + (p.f || '') + '|' + (p.l ? p.l + '|' + p.i : '') + '">' + esc(p.text) + '</button>';
    });
    if (!h) h = '<div class="ok">&#10003; Complete. Nothing is missing or looks wrong.</div>';
    $('#checks').innerHTML = h;
  }
  function drawMeta() {
    var from = state.from && state.from.name ? '<div>Details loaded from <b>' + esc(state.from.name) + '</b></div>' : '';
    $('#meta').innerHTML = '<div>It saves as</div><div class="fn">' + esc(currentBase()) + '</div>' + from;
  }

  /* ---------- events ---------- */
  function pathOf(attr) { return String(attr).split('|'); }
  $('#main').addEventListener('input', function (e) {                                              // typing is kept at once; the box is tidied and the linked boxes follow when it is left
    var el = e.target, id = el.getAttribute('data-f'), lp = el.getAttribute('data-l');
    if (id && state.f[id]) { state.f[id].v = el.value; state.f[id].st = el.value.trim() === '' ? 'empty' : 'confirmed'; dirty = true; onDisk = false; }
    else if (lp) { var q = pathOf(lp), row = state.l[q[0]][+q[1]]; if (row) { row.d[q[2]] = el.value; row.st = 'confirmed'; dirty = true; onDisk = false; } }
  });
  $('#main').addEventListener('change', function (e) {
    var el = e.target, id = el.getAttribute('data-f'), lp = el.getAttribute('data-l');
    if (id) { store.setField(state, id, el.value); touch(); paintAll(); }
    else if (lp) { var q = pathOf(lp); store.setCell(state, q[0], +q[1], q[2], el.value); touch(); el.value = state.l[q[0]][+q[1]].d[q[2]]; paintAll(); }
  });
  $('#main').addEventListener('click', function (e) {
    var t = e.target.closest('[data-accept],[data-add],[data-del],[data-go]'); if (!t) return;
    if (t.hasAttribute('data-accept')) { store.accept(state, t.getAttribute('data-accept')); touch(); paintAll(); return; }
    if (t.hasAttribute('data-go')) { cur = t.getAttribute('data-go'); drawNav(); drawPage(); refreshChrome(); window.scrollTo({ top: 0 }); return; }
    if (t.hasAttribute('data-add')) {
      var key = t.getAttribute('data-add'); store.addRow(state, key); touch(); drawPage();
      var cards = document.querySelectorAll('[data-row^="' + key + '|"]'), inp = cards.length ? cards[cards.length - 1].querySelector('input') : null;
      if (inp) { inp.scrollIntoView({ block: 'center' }); inp.focus(); }
      return;
    }
    if (t.hasAttribute('data-del')) {
      var q = pathOf(t.getAttribute('data-del')), row = state.l[q[0]][+q[1]], L = schema.lists[q[0]];
      if (row && Object.keys(row.d).some(function (k) { return row.d[k]; }) && !window.confirm('Remove ' + L.one.toLowerCase() + ' ' + (+q[1] + 1) + (row.d.name ? ' (' + row.d.name + ')' : '') + '?')) return;
      store.delRow(state, q[0], +q[1]); touch(); drawPage();
    }
  });
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) { cur = b.getAttribute('data-page'); drawNav(); drawPage(); refreshChrome(); } });
  $('#checks').addEventListener('click', function (e) {
    var b = e.target.closest('[data-jump]'); if (!b) return;
    var q = pathOf(b.getAttribute('data-jump')); jumpTo(q[0], q[1], q[2] ? q[2] + '|' + q[3] : '');
  });
  $('#btnAgree').addEventListener('click', function () { store.acceptAll(state); touch(); redraw(); toast('Everything loaded from the Fact Find is agreed.'); });
  $('#btnSave').addEventListener('click', function () { saveJson(false); });
  $('#btnSaveAs').addEventListener('click', function () { saveJson(true); });
  $('#btnPdf').addEventListener('click', savePdf);
  $('#btnPreview').addEventListener('click', previewPdf);
  $('#btnNew').addEventListener('click', newApp);
  $('#btnOpen').addEventListener('click', chooseFile);
  $('#btnLoad').addEventListener('click', chooseFactFind);
  $('#fileIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) openFile(f, null); });
  $('#ffIn').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) loadFactFind(f); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start: a blank application. Unsaved work from last time is offered back, so one client's details are never shown on the next client's form until the adviser chooses. ---------- */
  var restored = null, restoredBase = '';
  try { if (localStorage.getItem(DRAFT_KEY + '-dirty') === '1') restored = loadDraft(); } catch (e) { restored = null; }
  try { restoredBase = restored ? (localStorage.getItem(DRAFT_KEY + '-file') || '') : ''; } catch (e) { restoredBase = ''; }
  state = store.blank();
  if (restored) draftHold = true; else rememberHandle(null);
  window.SR.app = { get state() { return state; }, redraw: redraw, setState: function (s) { state = s; redraw(); }, makePdf: makePdf, loadFactFindText: function (t, n) { var rep = store.loadFromFactFind(state, t, n); touch(); redraw(); return rep; } };
  redraw();
  if (restored) {
    var who = store.clientName(restored) || 'the last client', rd = document.createElement('dialog'); rd.id = 'restoreDraft';
    rd.innerHTML = '<h2>Unsaved changes found</h2><p class="help">The last application, for ' + esc(who) + ', had changes that were not saved. Restore them, or start a new application? Starting a new one throws those changes away.</p>' +
      '<div class="dlg-actions"><button class="btn ghost small" id="restoreNew" type="button">Start a new application</button><span class="grow"></span><button class="btn small" id="restoreYes" type="button">Restore ' + esc(who) + '</button></div>';
    document.body.appendChild(rd);
    rd.addEventListener('cancel', function (e) { e.preventDefault(); });                            // a choice is needed: Escape does not close it
    rd.querySelector('#restoreYes').addEventListener('click', function () {
      state = restored; fileBase = restoredBase; dirty = true; onDisk = false; draftHold = false; rd.close(); rd.remove();
      recallHandle().then(function (h) { if (h && fileBase) fileHandle = h; });
      redraw(); toast('Restored your unsaved changes for ' + who + '.');
    });
    rd.querySelector('#restoreNew').addEventListener('click', function () { draftHold = false; rd.close(); rd.remove(); rememberHandle(null); saveDraft(); redraw(); });
    rd.showModal(); rd.querySelector('#restoreYes').focus();
  }
})();
