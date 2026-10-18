/* The Fact Find screen: renders the form from the schema, keeps answers in the store, saves and reopens files. */
(function () {
  var FF = window.FF, util = FF.util, schema = FF.schema, calc = FF.calc, store = FF.store, validate = FF.validate;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DRAFT_KEY = 'wr-fact-find-draft';

  var state, cur = 'info', fileHandle = null, fileBase = '', dirty = false, lastSaved = null, toastTimer = null;
  var ctx = function () { return store.ctxFor(state); };

  /* ---------- drafts and saving ---------- */
  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, store.toJSON(state)); localStorage.setItem(DRAFT_KEY + '-file', fileBase); localStorage.setItem(DRAFT_KEY + '-dirty', dirty ? '1' : '0'); } catch (e) { /* storage unavailable */ } }
  /* The file a client was last opened from or saved to is remembered, so Save writes back to it even after Chrome is closed. */
  function idb(fn) {
    return new Promise(function (resolve) {
      try {
        var rq = indexedDB.open('wr-fact-find', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('h'); };
        rq.onsuccess = function () { try { fn(rq.result.transaction('h', 'readwrite').objectStore('h'), resolve); } catch (e) { resolve(null); } };
        rq.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function rememberHandle(h) { return idb(function (st, done) { var r = h ? st.put(h, 'current') : st.delete('current'); r.onsuccess = function () { done(true); }; r.onerror = function () { done(null); }; }); }
  function recallHandle() { return idb(function (st, done) { var r = st.get('current'); r.onsuccess = function () { done(r.result || null); }; r.onerror = function () { done(null); }; }); }
  function loadDraft() { try { var t = localStorage.getItem(DRAFT_KEY); return t ? store.fromJSON(t) : null; } catch (e) { return null; } }
  function touch() { dirty = true; saveDraft(); refreshChrome(); }
  /* A South African ID number holds the date of birth (YYMMDD), and the date of birth always follows it: when the ID number is entered or changed,
     the date goes into the date of birth box, replacing whatever was there (a date entered before the ID, or the date of the previous ID), and a note says so.
     A date typed or said after the ID is left as it is (the Checks panel warns when it does not match). The date takes the status of the ID number:
     amber "verify" while the ID is, confirmed once the ID is (typed, clicked or agreed to by the client). Returns what the box held before (so it can be
     undone), or null when nothing changed. This happens on this computer: the ID number is never sent anywhere. */
  function autoDob() {
    var id = String(state.f.idno.v || '').replace(/\s/g, ''), d = state.f.dob;
    if (state.f.idtype.v === 'Passport' || !/^\d{13}$/.test(id)) return null;
    var dob = util.dobFromSaId(id);
    if (!dob) return null;
    var txt = util.formatDate(dob), idOk = state.f.idno.st === 'confirmed', was = { v: d.v, st: d.st };
    if (d.v === txt) {                                                       // already the date of this ID number: it follows the ID's status
      if (!idOk || (d.st !== 'verify' && d.st !== 'heard')) return null;
      store.setField(state, 'dob', txt, 'confirmed');
      return was;
    }
    store.setField(state, 'dob', txt, idOk ? 'confirmed' : 'verify');
    if (was.v !== '') toast('Date of birth changed to ' + txt + ' to match the ID number.');
    return was;
  }
  /* Show a box's value and status in place (used when a box changes without the screen being redrawn). */
  function paintField(id) {
    var el = document.querySelector('[data-f="' + id + '"]'); if (!el) return;
    var c = state.f[id]; el.value = c.v;
    var wrap = el.closest('.f'); if (wrap) { wrap.className = wrap.className.replace(/\bs-\w+/, 's-' + c.st); var b = wrap.querySelector('.st'), ab = wrap.querySelector('.rt > .badge'); if (b) b.innerHTML = badge(c.st, 'f:' + id); if (ab) ab.outerHTML = badge(c.st, 'f:' + id); }
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  /* Uses the Windows "Save as" dialog where the browser offers it (Chrome, Edge), otherwise a normal download.
     With a remembered file it writes straight back to that file. The dialog remembers the last folder for each kind of file. */
  function writeFile(blob, name, type, ext, handle, id, startIn) {
    if (!window.showSaveFilePicker) { download(blob, name); return Promise.resolve(null); }
    var accept = {}; accept[blob.type] = [ext];
    var open = handle
      ? Promise.resolve(handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : 'granted').then(function (p) { if (p !== 'granted') throw new Error('Chrome did not allow changes to that file.'); return handle; })
      : window.showSaveFilePicker(pickerOptions(name, type, accept, id, startIn));
    return open.then(function (h) { return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(function () { return h; }); });
  }
  /* The picker opens beside the client's saved file when there is one, otherwise in the folder it last used for this kind of file. */
  function pickerOptions(name, type, accept, id, startIn) {
    var o = { suggestedName: name, types: [{ description: type, accept: accept }] };
    if (startIn) o.startIn = startIn; else o.id = id;
    return o;
  }
  function currentBase() { return fileBase || store.baseFileName(state); }
  function saveJson(forceAs) {
    var blob = new Blob([store.toJSON(state)], { type: 'application/json' });
    writeFile(blob, currentBase() + '.json', 'Fact Find', '.json', forceAs ? null : fileHandle, 'fact-find-data', fileHandle).then(function (h) {
      if (h) { fileHandle = h; fileBase = h.name.replace(/\.json$/i, ''); rememberHandle(h); }
      else if (!fileBase) fileBase = currentBase();
      dirty = false; lastSaved = new Date(); saveDraft(); refreshChrome(); toast('Saved.');
    }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save: ' + e.message); });
  }
  function makePdf() { return FF.pdf.build(state); }
  function savePdf() {
    var blob = makePdf().output('blob');
    writeFile(blob, currentBase() + '.pdf', 'PDF document', '.pdf', null, 'fact-find-pdf', fileHandle)
      .then(function () { toast('PDF saved.'); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save the PDF: ' + e.message); });
  }
  function previewPdf() {
    var url = URL.createObjectURL(makePdf().output('blob'));
    var w = window.open(url, '_blank');
    if (!w) download(makePdf().output('blob'), currentBase() + '.pdf');
  }
  /* Opens a saved client. With Chrome's file picker the file is remembered, so Save writes back to it. */
  function openFile(file, handle) {
    var r = new FileReader();
    r.onload = function () {
      try {
        state = store.fromJSON(r.result); fileHandle = handle || null; fileBase = file.name.replace(/\.json$/i, '');
        dirty = false; cur = 'info'; rememberHandle(handle || null); saveDraft(); redraw(); toast('Opened ' + file.name);
      } catch (e) { toast(e.message || 'Could not open that file.'); }
    };
    r.readAsText(file);
  }
  function chooseFile() {
    if (!window.showOpenFilePicker) { $('#fileIn').click(); return; }
    window.showOpenFilePicker({ id: 'fact-find-data', types: [{ description: 'Fact Find', accept: { 'application/json': ['.json'] } }] })
      .then(function (hs) { return hs[0].getFile().then(function (f) { openFile(f, hs[0]); }); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open: ' + e.message); });
  }
  function newClient() {
    if (dirty && !window.confirm('Start a new Fact Find? Changes you have not saved will be lost.')) return;
    state = store.blank(); fileHandle = null; fileBase = ''; rememberHandle(null); dirty = false; lastSaved = null; cur = 'info'; saveDraft(); redraw();
  }

  /* ---------- rendering ---------- */
  function badge(st, target) {
    var t = { empty: 'not asked', heard: 'heard', verify: 'verify', confirmed: 'confirmed', calc: 'calc', preset: 'preset', suggest: 'accept' }[st] || st;
    var act = (st === 'heard' || st === 'verify' || st === 'suggest') ? ' data-accept="' + esc(target) + '" title="Click to confirm"' : '';
    return '<button type="button" class="badge ' + st + '"' + act + ' tabindex="-1">' + t + '</button>';
  }
  function optionsHTML(o, v) {
    return '<option value="">&nbsp;</option>' + o.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
  }
  function control(attrs, def, v, disabled) {
    if ((def.t === 'sel' || def.o) && def.free) {
      var lid = 'dl-' + (attrs.replace(/[^a-z0-9]+/gi, '-'));
      return '<input ' + attrs + ' list="' + lid + '" value="' + esc(v) + '" autocomplete="off"><datalist id="' + lid + '">' + def.o.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
    }
    if (def.t === 'sel' || def.o) return '<select ' + attrs + (disabled ? ' disabled' : '') + '>' + optionsHTML(def.o, v) + '</select>';
    if (def.t === 'area') return '<textarea ' + attrs + (def.rows ? ' rows="' + def.rows + '" style="height:' + (def.rows * 21 + 14) + 'px"' : '') + '>' + esc(v) + '</textarea>';
    return '<input ' + attrs + ' value="' + esc(v) + '"' + (disabled ? ' readonly' : '') + ' autocomplete="off">';
  }
  /* The live digit count under the ID and tax number boxes: grey when empty, amber while short, green when right, red when too long or not valid. */
  function lenChip(id) {
    var s = validate.lengthState(id, state.f[id].v, state.f.idtype.v);
    return '<span class="len' + (s ? ' ' + s.level : '') + '" data-len="' + id + '"' + (s ? '' : ' hidden') + '>' + (s ? esc(s.text) : '') + '</span>';
  }
  function showLen(id, value) {
    var el = document.querySelector('[data-len="' + id + '"]'); if (!el) return;
    var s = validate.lengthState(id, value, state.f.idtype.v);
    el.hidden = !s; el.className = 'len' + (s ? ' ' + s.level : ''); el.textContent = s ? s.text : '';
  }
  function fieldHTML(f, g12) {
    var c = state.f[f.id], st = c.st, v = c.v, isNone = !!f.none && v === 'None';
    if (f.calc) { v = FF.calc.field(f.calc, ctx()); st = 'calc'; }
    var rt = f.link ? '<a class="lnk" href="' + f.link[1] + '" target="_blank" rel="noopener">' + esc(f.link[0]) + ' ↗</a>' : '';
    if (f.lookup) rt += '<button type="button" class="lookup" data-lookup="' + f.id + '">' + esc(f.lookupBtn || 'Look up online') + '</button>';
    if (f.none) rt += '<label class="nonebox"><input type="checkbox" data-none="' + f.id + '"' + (isNone ? ' checked' : '') + '> ' + esc(f.none) + '</label>';
    if (f.t === 'area' && !f.opt) rt += badge(st, 'f:' + f.id);
    var attrs = 'data-f="' + f.id + '"' + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '');
    var style = g12 ? ' style="--s:' + (f.wide ? 12 : (f.s || 4)) + '"' : '';
    return '<label class="f s-' + st + (f.wide ? ' wide' : '') + '" data-field="' + f.id + '"' + style + '><span class="l"><span>' + esc(f.l) + '</span>' + (rt ? '<span class="rt">' + rt + '</span>' : '') + '</span>' +
      '<span class="box">' + control(attrs, f, v, !!f.calc || isNone) + (f.t === 'area' ? '' : '<span class="st">' + badge(st, 'f:' + f.id) + '</span>') + '</span>' +
      (f.len ? lenChip(f.id) : '') + '<span class="warn" data-warn="' + f.id + '" hidden></span></label>';
  }
  function cellHTML(key, i, c, r, card) {
    var L = schema.lists[key], v = c.calc ? FF.calc.rowCalc(c.calc, r, ctx()) : r.d[c.k];
    var at = 'data-l="' + key + '" data-i="' + i + '" data-k="' + c.k + '"';
    var ctl = control(at, c, v, !!c.calc);
    var cid = key + ':' + i + ':' + c.k;
    if (card) return '<label class="f' + (c.wide ? ' wide' : '') + '" data-cell="' + cid + '"><span class="l"><span>' + esc(c.l) + '</span></span><span class="box">' + ctl + '</span><span class="warn" data-rwarn="' + key + ':' + i + '" hidden></span></label>';
    return '<td' + (c.num ? ' class="num"' : '') + ' data-cell="' + cid + '">' + ctl + '</td>';
  }
  function sumHTML(key) {
    var L = schema.lists[key];
    return Object.keys(L.sum).map(function (k) { return '<span>' + esc(L.sum[k]) + '<b data-sum="' + key + ':' + k + '">' + util.money(listSum(key, k)) + '</b></span>'; }).join('');
  }
  function listSum(key, col) { return state.l[key].reduce(function (a, r) { return a + util.num(r.d[col]); }, 0); }
  function listHTML(key, hideTitle) {
    var L = schema.lists[key], rows = state.l[key], h = '';
    var hasSum = Object.keys(L.sum).length > 0;
    if (L.cards) {
      if (!rows.length) h += '<div class="empty-list">None recorded yet.</div>';
      rows.forEach(function (r, i) {
        h += '<div class="rowcard s-' + r.st + '"><div class="rowhead"><b>' + esc(L.cards) + ' ' + (i + 1) + '</b>' +
          ((r.st === 'heard' || r.st === 'verify') ? badge(r.st, 'r:' + key + ':' + i) : '') +
          '<span class="grow"></span><button type="button" class="x" data-del="' + key + ':' + i + '">✕ Remove</button></div><div class="grid">' +
          L.cols.map(function (c) { return cellHTML(key, i, c, r, true); }).join('') + '</div></div>';
      });
      if (hasSum) h += '<div class="sumstrip" data-sumstrip="' + key + '"' + (rows.length ? '' : ' hidden') + '>' + sumHTML(key) + '</div>';
      return h + '<button type="button" class="addrow" data-add="' + key + '">+ ' + esc(L.add) + '</button>';
    }
    h = '<div class="tablewrap"><table><thead><tr>' + L.cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr class="s-' + r.st + '">' + L.cols.map(function (c) { return cellHTML(key, i, c, r, false); }).join('') +
        '<td>' + ((r.st === 'heard' || r.st === 'verify') ? badge(r.st, 'r:' + key + ':' + i) : '') + '<button type="button" class="x" data-del="' + key + ':' + i + '" aria-label="Remove row">✕</button></td></tr>';
      if (key === 'shares') h += '<tr class="warnrow" hidden data-rwarnrow="' + key + ':' + i + '"><td colspan="' + (L.cols.length + 1) + '"><span class="warn" data-rwarn="' + key + ':' + i + '"></span></td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="' + (L.cols.length + 1) + '" style="padding:14px;color:var(--muted)">None recorded yet.</td></tr>';
    h += '</tbody>';
    if (hasSum && rows.length) {
      h += '<tfoot><tr>' + L.cols.map(function (c) { return '<td' + (c.num ? ' class="num"' : '') + '>' + (L.sum[c.k] ? '<span data-sum="' + key + ':' + c.k + '">' + util.money(listSum(key, c.k)) + '</span>' : '') + '</td>'; }).join('') + '<td><span class="badge calc">calc</span></td></tr></tfoot>';
    }
    return h + '</table></div><button type="button" class="addrow" data-add="' + key + '">+ ' + esc(L.add) + '</button>';
  }
  function docsHTML() {
    return schema.docs.map(function (d) { return '<label class="check"><input type="checkbox" data-doc="' + esc(d) + '"' + (state.docs[d] ? ' checked' : '') + '> ' + esc(d) + '</label>'; }).join('');
  }
  function sectionHTML(sec) {
    var c = ctx();
    var h = '<header><h2>' + esc(sec.title) + '</h2><span class="tier ' + (sec.adv ? 'c' : '') + '">' + (sec.adv ? 'Advisor only' : 'Client answers') + '</span></header>';
    if (!calc.showIf(sec.cond, c)) return h + '<div class="note">' + esc(sec.condMsg) + '</div>';
    sec.blocks.forEach(function (b) {
      if (!calc.showIf(b.cond, c)) { h += '<div class="block-title">' + esc(b.title) + '</div><div class="note">' + esc(b.condMsg) + '</div>'; return; }
      if (b.title) h += '<div class="block-title">' + esc(b.title) + '</div>';
      if (b.help) h += '<p class="help">' + esc(b.help) + '</p>';
      if (b.fields) h += '<div class="grid' + (b.layout === 'g12' ? ' g12' : '') + '">' + b.fields.map(function (f) { return fieldHTML(f, b.layout === 'g12'); }).join('') + '</div>';
      if (b.docs) h += docsHTML();
      if (b.list) { if (!b.title && schema.lists[b.list].title !== sec.title) h += '<div class="block-title">' + esc(schema.lists[b.list].title) + '</div>'; h += listHTML(b.list); }
    });
    return h;
  }

  function redraw() {
    renderNav();
    var sec = schema.sections.filter(function (x) { return x.id === cur; })[0], main = $('#main');
    main.className = 'main' + (sec.roomy ? ' roomy' : '') + (sec.fit ? ' fit' : '') + (sec.adv ? ' advisor' : '');
    main.innerHTML = sectionHTML(sec);
    refreshChrome(); refreshWarnings();
    if (vm.on) vmMarkWait();
  }
  function renderNav() {
    var nav = '<div class="sep">Client answers</div>', adv = false;
    schema.sections.forEach(function (s) {
      if (s.adv && !adv) { nav += '<div class="sep">Advisor</div>'; adv = true; }
      var c = store.counts(state, s);
      nav += '<button type="button" data-sec="' + s.id + '"' + (s.id === cur ? ' aria-current="true"' : '') + '><span>' + esc(s.title) + '</span><span class="n" data-count="' + s.id + '">' + (s.adv ? '' : c.fill + '/' + c.tot) + '</span></button>';
    });
    $('#nav').innerHTML = nav;
  }
  function refreshChrome() {
    var name = store.clientName(state);
    $('#clientName').textContent = name || 'New client';
    document.title = 'Fact Find' + (name ? ' - ' + name : '');
    $('#saveState').textContent = (fileBase ? fileBase + ' · ' : '') + (dirty ? 'unsaved changes' : (lastSaved ? 'saved ' + lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no changes'));
    var A = 0, V = 0, E = 0;
    schema.sections.forEach(function (s) {
      var c = store.counts(state, s);
      var el = document.querySelector('[data-count="' + s.id + '"]'); if (el && !s.adv) el.textContent = c.fill + '/' + c.tot;
      if (!s.adv) { A += c.fill; V += c.ver; E += c.tot - c.fill; }
    });
    $('#sFilled').textContent = A; $('#sVerify').textContent = V; $('#sEmpty').textContent = E;
    var dtext = '<span>Version <b>' + schema.version + '</b>, ' + schema.released + '</span>';
    var tax = FF.tax.taxYearFor(calc.meetingDate(ctx()));
    refreshKey();
    $('#meta').innerHTML = dtext + '<span>Tax tables <b>' + tax + '</b></span><span>Advisor <b>' + esc(state.f.advisor.v) + '</b></span>';
  }
  /* The top bar counts down to the day the Anthropic key stops working. */
  function refreshKey() {
    var el = $('#keyState'), st = FF.lookup.keyStatus(FF.lookup.getSettings());
    el.textContent = st.text; el.hidden = !st.text;
    el.style.color = st.level === 'expired' ? '#ff8a80' : (st.level === 'soon' || st.level === 'unset') ? '#f5c451' : '';
  }
  /* Update calculated boxes, totals and warnings in place so the cursor never jumps. */
  function refreshLive() {
    schema.sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) {
      if (!f.calc) return;
      var el = document.querySelector('[data-f="' + f.id + '"]'); if (el) el.value = FF.calc.field(f.calc, ctx());
    }); }); });
    Object.keys(schema.lists).forEach(function (key) {
      var L = schema.lists[key];
      Object.keys(L.sum).forEach(function (k) { document.querySelectorAll('[data-sum="' + key + ':' + k + '"]').forEach(function (el) { el.textContent = util.money(listSum(key, k)); }); });
      L.cols.forEach(function (c) { if (c.calc) state.l[key].forEach(function (r, i) {
        var el = document.querySelector('[data-l="' + key + '"][data-i="' + i + '"][data-k="' + c.k + '"]'); if (el) el.value = FF.calc.rowCalc(c.calc, r, ctx());
      }); });
    });
    ['idno', 'tax'].forEach(function (id) { showLen(id, state.f[id].v); });
    refreshWarnings(); refreshChrome();
  }
  document.addEventListener('input', function (e) { var t = e.target; if (t.dataset && (t.dataset.f === 'idno' || t.dataset.f === 'tax')) showLen(t.dataset.f, t.value); });
  function refreshWarnings() {
    var warns = validate.check(ctx()), box = $('#checks'), html = '';
    document.querySelectorAll('[data-warn],[data-rwarn]').forEach(function (el) { el.hidden = true; el.textContent = ''; });
    document.querySelectorAll('.has-warn').forEach(function (el) { el.classList.remove('has-warn'); });
    document.querySelectorAll('[data-rwarnrow]').forEach(function (el) { el.hidden = true; });
    warns.forEach(function (w) {
      var label = w.id ? schema.fieldsById[w.id].l : schema.lists[w.list].title + ' ' + (w.i + 1);
      var sec = w.id ? sectionOfField(w.id) : sectionOfList(w.list);
      html += '<button type="button" data-goto="' + sec + '" data-gofield="' + (w.id || '') + '"><b>' + esc(label) + ':</b> ' + esc(w.msg) + '</button>';
      var el = w.id ? document.querySelector('[data-warn="' + w.id + '"]') : document.querySelector('[data-rwarn="' + w.list + ':' + w.i + '"]');
      if (el) { el.hidden = false; el.textContent = w.msg; var row = el.closest('[data-rwarnrow]'); if (row) row.hidden = false; var f = el.closest('.f'); if (f) f.classList.add('has-warn'); }
    });
    var sug = validate.dobFromIdSuggestion(ctx());
    if (sug) html += '<div>Date of birth from the ID number: <button type="button" class="link-btn" data-usedob="' + util.formatDate(sug) + '">use ' + util.longDate(sug) + '</button></div>';
    box.innerHTML = html || '<span class="ok">No problems found.</span>';
  }
  function sectionOfField(id) { var r = ''; schema.sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) { if (f.id === id) r = s.id; }); }); }); return r; }
  function sectionOfList(key) { var r = ''; schema.sections.forEach(function (s) { s.blocks.forEach(function (b) { if (b.list === key) r = s.id; }); }); return r; }

  /* ---------- events ---------- */
  var condIds = {};
  schema.sections.forEach(function (s) { calc.condFields(s.cond).concat([].concat.apply([], s.blocks.map(function (b) { return calc.condFields(b.cond); }))).forEach(function (id) { condIds[id] = 1; }); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-sec],[data-accept],[data-add],[data-del],[data-goto],[data-usedob],[data-lookup]');
    if (!t) return;
    if (t.dataset.sec) { cur = t.dataset.sec; redraw(); window.scrollTo(0, 0); return; }
    if (t.dataset.lookup) { doLookup(t); return; }
    if (t.dataset.goto) {
      cur = t.dataset.goto; redraw();
      if (t.dataset.gofield) { var el = document.querySelector('[data-f="' + t.dataset.gofield + '"]'); if (el) el.focus(); }
      return;
    }
    if (t.dataset.usedob) { store.setField(state, 'dob', t.dataset.usedob); touch(); redraw(); return; }
    if (t.dataset.accept) {
      var p = t.dataset.accept.split(':');
      store.accept(state, p[0] === 'r' ? { list: p[1], i: +p[2] } : { id: p[1] });
      if (p[0] === 'f' && p[1] === 'idno') autoDob();                  // the ID is agreed to, so is the date of birth that came from it
      touch(); redraw(); return;
    }
    if (t.dataset.add) { store.addRow(state, t.dataset.add); touch(); redraw(); var last = document.querySelectorAll('[data-l="' + t.dataset.add + '"][data-i="' + (state.l[t.dataset.add].length - 1) + '"]')[0]; if (last) last.focus(); return; }
    if (t.dataset.del) { var q = t.dataset.del.split(':'); store.delRow(state, q[0], +q[1]); touch(); redraw(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.none) {
      store.setField(state, t.dataset.none, t.checked ? 'None' : '');
      var wrapN = t.closest('.f'); if (wrapN) wrapN.outerHTML = fieldHTML(schema.fieldsById[t.dataset.none], !!document.querySelector('.g12'));
      touch(); refreshLive();
      if (!t.checked) { var back = document.querySelector('[data-f="' + t.dataset.none + '"]'); if (back) back.focus(); }
      return;
    }
    if (t.dataset.f) {
      var def = schema.fieldsById[t.dataset.f], val = t.value.trim() === '' ? '' : t.value;
      if (def && def.money) { val = util.formatMoney(val); t.value = val; }
      if (def && def.date) { var pd = util.parseDate(val); if (pd) { val = util.formatDate(pd); t.value = val; } }
      store.setField(state, t.dataset.f, val);
      var dobSet = (t.dataset.f === 'idno' || t.dataset.f === 'idtype') && autoDob();        // the date of birth follows the ID number (and the ID type going back to ID)
      var wrap = t.closest('.f'); if (wrap) { wrap.className = wrap.className.replace(/\bs-\w+/, 's-' + state.f[t.dataset.f].st); var b = wrap.querySelector('.st'); if (b) b.innerHTML = badge(state.f[t.dataset.f].st, 'f:' + t.dataset.f); }
      touch();
      if (t.dataset.f === 'employer' || t.dataset.f === 'biz_name') autoCompanyLookup(t.dataset.f);
      if (PROFILE_SRC.indexOf(t.dataset.f) >= 0) autoProfileLookup();
      if (dobSet) paintField('dob');
      if (condIds[t.dataset.f]) { redraw(); var again = document.querySelector('[data-f="' + t.dataset.f + '"]'); if (again) again.focus(); } else refreshLive();
    } else if (t.dataset.l) {
      var key = t.dataset.l, i = +t.dataset.i, k = t.dataset.k, col = schema.lists[key].cols.filter(function (c) { return c.k === k; })[0], row0 = state.l[key][i];
      var v2 = t.value;
      if (col && col.money) { v2 = util.formatMoney(v2); t.value = v2; }
      if (col && col.date) { var pd2 = util.parseDate(v2); if (pd2) { v2 = util.formatDate(pd2); t.value = v2; } }
      /* A child's education stage follows the date of birth until it is set by hand. */
      var autoStage = key === 'kids' && k === 'dob' && (row0.d.stage === '' || row0.d.stage === FF.calc.rowCalc('stage', row0, ctx()));
      store.setCell(state, key, i, k, v2);
      if (autoStage) {
        row0.d.stage = FF.calc.rowCalc('stage', row0, ctx());
        var sel = document.querySelector('[data-l="kids"][data-i="' + i + '"][data-k="stage"]'); if (sel) sel.value = row0.d.stage;
      }
      var row = t.closest('.rowcard, tr'); if (row) row.className = row.className.replace(/\bs-(heard|verify)\b/, 's-confirmed');
      touch(); refreshLive();
    } else if (t.dataset.doc) { state.docs[t.dataset.doc] = t.checked ? 1 : 0; touch(); }
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  $('#btnNew').addEventListener('click', newClient);
  $('#btnOpen').addEventListener('click', chooseFile);
  $('#fileIn').addEventListener('change', function (e) { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
  $('#btnSave').addEventListener('click', function () { saveJson(false); });
  $('#btnSaveAs').addEventListener('click', function () { saveJson(true); });
  $('#btnPreview').addEventListener('click', previewPdf);
  $('#btnPdf').addEventListener('click', savePdf);
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveJson(false); } });

  /* ---------- online look-up: what a company does (done by itself when the name is entered), and the client's public profile (on a tap) ---------- */
  var autoLook = {};     // box id -> { name, text }: what a look-up last wrote there, so a new name can replace it but a typed answer never is
  var looking = {};      // box id -> the name being looked up now
  var lookFail = 0;
  function lookupReady() { return !!(FF.lookup.getSettings().apiKey || (FF.voiceBackend && FF.voiceBackend.available)); }
  /* What to ask about for a look-up box: a company or business (named in another box), or the client (name, with the employer and occupation so the right person is found). */
  function lookupJob(id) {
    var def = schema.fieldsById[id], f = function (k) { return String(state.f[k].v || '').trim(); };
    if (def.lookup === 'client') {
      var orgs = [f('employer')].concat(f('bizowner') === 'Yes' ? [f('biz_name')] : []).filter(Boolean);
      return { kind: 'person', name: store.clientName(state), org: orgs.join(' and '), role: f('occ') };
    }
    return { kind: id === 'biz_does' ? 'business' : 'company', name: f(def.lookup) };
  }
  /* The description: web search with the key from Settings or, on the practice page with no key, what Claude itself knows (companies only, shown as "verify"). */
  function lookupText(job) {
    var set = FF.lookup.getSettings();
    if (set.apiKey) return FF.lookup.run({ apiKey: set.apiKey, model: set.model, name: job.name, kind: job.kind, org: job.org, role: job.role }).then(function (t) { return { text: t, st: job.kind === 'person' ? 'verify' : 'heard' }; });
    if (job.kind !== 'person' && FF.voiceBackend && FF.voiceBackend.available) return FF.lookup.runAsk({ ask: FF.voiceBackend.ask, name: job.name, kind: job.kind }).then(function (t) { return { text: t, st: 'verify' }; });
    return Promise.reject(new Error(job.kind === 'person' ? 'The LinkedIn search needs the Anthropic key in Settings, because it uses web search.' : 'Add your Anthropic API key in Settings first.'));
  }
  var NOT_FOUND = /^(?:Could not (?:identify|find)|No public profile found)/;
  /* Fills box id with the answer. auto: the page started it, so an answer typed in the box meanwhile is never replaced and "not found" is a note, not text in the box. */
  function runLookup(id, job, auto) {
    looking[id] = job.name;
    var el = document.querySelector('[data-f="' + id + '"]'), hint = el ? el.placeholder : ''; if (el) el.placeholder = 'Searching online…';
    function done() { delete looking[id]; var e2 = document.querySelector('[data-f="' + id + '"]'); if (e2) e2.placeholder = hint; }
    return lookupText(job).then(function (r) {
      done();
      if (JSON.stringify(lookupJob(id)) !== JSON.stringify(job)) return;                         // the name changed while searching: this answer is for something else
      var box = state.f[id], miss = NOT_FOUND.test(r.text);
      if (auto) {
        if (box.v !== '' && !(autoLook[id] && box.v === autoLook[id].text)) return;               // something was typed or said there meanwhile
        if (miss && job.kind !== 'person') { toast('Could not find what ' + job.name + ' does online.'); return; }     // for a person, "no match" is written in the box, so it is clear the search was done
      }
      store.setField(state, id, r.text, miss ? 'empty' : r.st);
      autoLook[id] = { name: job.name, sig: JSON.stringify(job), text: r.text };
      touch(); paintField(id); if (vm.on) vmFlash(id);
    }, function (err) { done(); throw err; });
  }
  /* The company or business name was just entered (typed, or heard): look up what it does, without being asked, unless something is already written there. */
  function autoCompanyLookup(srcId) {
    var target = { employer: 'co_does', biz_name: 'biz_does' }[srcId];
    if (!target || !lookupReady()) return;
    var job = lookupJob(target), box = state.f[target], prev = autoLook[target];
    if (!job.name || looking[target] === job.name) return;
    if (prev && prev.name === job.name && box.v === prev.text) return;                          // already done for this name
    if (prev && box.v === prev.text) { store.setField(state, target, '', 'empty'); delete autoLook[target]; touch(); paintField(target); box = state.f[target]; }   // the name changed: the old description no longer applies
    if (box.v !== '') return;                                                                   // written by hand: leave it
    runLookup(target, job, true).catch(function (e) { if (Date.now() - lookFail > 60000) { lookFail = Date.now(); toast('Could not look up ' + job.name + ' (' + e.message + ').'); } });
  }
  /* The client's name and employer or occupation are known: search for their public profile by itself, a few seconds after the last of them was entered
     (so a name, an employer and an occupation said one after the other are one search). Only with the Anthropic key: it needs web search. */
  var profileTimer = null, PROFILE_SRC = ['fname', 'sname', 'employer', 'biz_name', 'bizowner', 'occ'];
  function autoProfileLookup() {
    clearTimeout(profileTimer);
    if (!FF.lookup.getSettings().apiKey) return;
    profileTimer = setTimeout(function () {
      var job = lookupJob('profile'), box = state.f.profile, prev = autoLook.profile;
      if (!String(state.f.fname.v).trim() || !String(state.f.sname.v).trim() || !(job.org || job.role)) return;
      if (prev && prev.sig === JSON.stringify(job) && box.v === prev.text) return;                 // already searched for exactly this
      if (prev && box.v === prev.text) { store.setField(state, 'profile', '', 'empty'); delete autoLook.profile; touch(); paintField('profile'); box = state.f.profile; }   // something changed: the old summary may be about someone else
      if (box.v !== '' || looking.profile) return;                                                  // written by hand, or already searching
      runLookup('profile', job, true).catch(function (e) { if (Date.now() - lookFail > 60000) { lookFail = Date.now(); toast('Could not search for the profile (' + e.message + ').'); } });
    }, FF.profileDelay != null ? FF.profileDelay : 4000);
  }
  function doLookup(btn) {
    var id = btn.dataset.lookup, job = lookupJob(id), set = FF.lookup.getSettings();
    if (!job.name) { toast(job.kind === 'person' ? "Enter the client's first name and surname first." : 'Enter the ' + schema.fieldsById[schema.fieldsById[id].lookup].l.toLowerCase() + ' first.'); return; }
    if (job.kind === 'person' && !job.org && !job.role) { toast('Enter the employer or occupation first, so the right person is found.'); return; }
    if (!set.apiKey && !(job.kind !== 'person' && FF.voiceBackend && FF.voiceBackend.available)) { if (job.kind !== 'person') openSettings(); toast(job.kind === 'person' ? 'The LinkedIn search needs the Anthropic key in Settings, because it uses web search.' : 'Add your Anthropic API key first.'); return; }
    var old = btn.textContent; btn.textContent = 'Searching…'; btn.disabled = true;
    runLookup(id, job, false).then(function () { btn.textContent = old; btn.disabled = false; }, function (err) { btn.textContent = old; btn.disabled = false; toast(err.message); });
  }
  function openSettings() {
    var set = FF.lookup.getSettings(), dlg = $('#settings');
    $('#setKey').value = set.apiKey; $('#setExpires').value = set.expires;
    $('#setVoiceModel').innerHTML = FF.lookup.MODELS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === set.voiceModel ? ' selected' : '') + '>' + esc(m.label.replace(' (recommended)', '')) + '</option>'; }).join('');
    $('#setModel').innerHTML = FF.lookup.MODELS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === set.model ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
    $('#setResult').textContent = '';
    dlg.showModal();
  }
  $('#btnSettings').addEventListener('click', openSettings);
  $('#keyState').addEventListener('click', openSettings);
  $('#keyState').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSettings(); } });
  $('#setCancel').addEventListener('click', function () { $('#settings').close(); });
  $('#setSave').addEventListener('click', function () {
    FF.lookup.saveSettings({ apiKey: $('#setKey').value, model: $('#setModel').value, voiceModel: $('#setVoiceModel').value, expires: $('#setExpires').value }); $('#settings').close(); refreshKey(); toast('Settings saved.');
  });
  $('#setTest').addEventListener('click', function () {
    var out = $('#setResult'); out.textContent = 'Testing…';
    FF.lookup.run({ apiKey: $('#setKey').value.trim(), model: $('#setModel').value, name: 'Old Mutual', kind: 'company' }).then(function (t) { out.textContent = 'Working. Example: ' + t; }, function (e) { out.textContent = e.message; });
  });

  /* ---------- voice mode ---------- */
  /* Voice mode follows the conversation. The form is the only display: the section heading glows red-amber when a topic is
     opened, the box glows red-amber when the adviser's question points at it, and it glows green for a moment once the
     client's answer is in or confirmed. Simple wording is understood on this computer; looser wording goes to Claude (voice-ai.js).
     Whatever listens calls FF.app.voiceHear(text, who), who being 'me' (the adviser) or 'client'. Typing works as always when voice is off. */
  var V = FF.voice, VAI = FF.voiceAI, vidx = V.buildIndex(schema);
  var vm = { on: false, target: null, answered: false, secGlow: false, noteMode: null, rowCur: {}, undo: [], recent: [], flashes: {}, queue: Promise.resolve(), busy: 0, lastFail: 0, wipe: null };
  /* A box in a list is named list:row:column (kids:0:dob). "count:kids" is the Add button, waiting for how many there are. */
  function vmCellRef(id) { var m = /^(\w+):(\d+):(\w+)$/.exec(String(id)); return m ? { list: m[1], i: +m[2], k: m[3] } : null; }
  function vmField(id) { var c = vmCellRef(id); if (c) return vidx.byId[c.list + '.' + c.k]; return vidx.byId[id] || vidx.noteById[id]; }
  function vmValue(id) {
    var c = vmCellRef(id);
    if (c) { var r = state.l[c.list][c.i]; return r && r.d[c.k] != null ? String(r.d[c.k]) : ''; }
    return state.f[id] ? String(state.f[id].v) : '';
  }
  function vmVisible(f) { return calc.showIf(f.secCond, ctx()) && calc.showIf(f.cond, ctx()); }
  function vmSecTitle(id) { return schema.sections.filter(function (s) { return s.id === id; })[0].title; }
  function vmEl(id) {
    var m = /^count:(\w+)$/.exec(String(id));
    if (m) return document.querySelector('[data-add="' + m[1] + '"]');
    if (vmCellRef(id)) return document.querySelector('[data-cell="' + id + '"]');
    return document.querySelector('[data-field="' + id + '"]');
  }
  function vmKey(e) { return e.dataset.field || e.dataset.cell || (e.dataset.add ? 'count:' + e.dataset.add : ''); }
  function vmAIReady() { return !!(VAI && (FF.lookup.getSettings().apiKey || (FF.voiceBackend && FF.voiceBackend.available))); }
  function vmPrivate(id) { var c = vmCellRef(id); return V.PRIVATE_IDS.indexOf(c ? c.list + '.' + c.k : id) >= 0; }
  /* The red-amber glow: on the box being asked about, else on the section heading. */
  function vmMarkWait() {
    document.querySelectorAll('.voice-wait').forEach(function (e) { e.classList.remove('voice-wait'); });
    if (!vm.on) return;
    var el = vm.target && !vm.answered ? vmEl(vm.target) : (vm.secGlow ? document.querySelector('.main header h2') : null);
    if (el) el.classList.add('voice-wait');
    vmShowFlashes();
  }
  /* The green flash lasts 1.5 seconds and survives a redraw (the company look-up redraws the screen when it finishes). */
  function vmFlash(id) { vm.flashes[id] = Date.now(); vmShowFlashes(); setTimeout(vmShowFlashes, 1600); }
  function vmShowFlashes() {
    document.querySelectorAll('.voice-ok').forEach(function (e) { if (!vm.flashes[vmKey(e)] || Date.now() - vm.flashes[vmKey(e)] > 1500) { e.classList.remove('voice-ok'); e.style.animationDelay = ''; } });
    Object.keys(vm.flashes).forEach(function (id) {
      var age = Date.now() - vm.flashes[id];
      if (age > 1500) { delete vm.flashes[id]; return; }
      var el = vmEl(id);
      if (el && !el.classList.contains('voice-ok')) { el.style.animationDelay = '-' + age + 'ms'; el.classList.add('voice-ok'); }
    });
  }
  function vmNote(id, text) {
    var el = vmEl(id); if (!el) return;
    var n = el.querySelector('.vm-note');
    if (!n) { n = document.createElement('span'); n.className = 'vm-note'; el.appendChild(n); }
    n.textContent = text; clearTimeout(n._t); n._t = setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 3500);
  }
  function vmPulseNav() {
    var b = document.querySelector('.nav button[data-sec="' + cur + '"]');
    if (b) { b.classList.add('voice-hit'); setTimeout(function () { b.classList.remove('voice-hit'); }, 1600); }
  }
  function vmRender() {
    var btn = $('#btnVoice');
    btn.classList.toggle('on', vm.on); btn.classList.toggle('busy', vm.busy > 0); btn.setAttribute('aria-pressed', vm.on ? 'true' : 'false');
    $('#vmLabel').textContent = vm.on ? 'Voice: On' : 'Voice: Off';
  }
  /* Move to a field: open its section if needed, glow, scroll to it and put the cursor in it. */
  function vmShow(id) {
    var cm = /^count:(\w+)$/.exec(id);
    if (cm) {                                                    // waiting to hear how many: the Add button glows
      var L = vidx.lists[cm[1]];
      if (cur !== L.sec) { cur = L.sec; redraw(); vmPulseNav(); }
      vm.target = id; vm.answered = false; vm.secGlow = false; vmMarkWait();
      var ab = vmEl(id); if (ab) ab.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    var f = vmField(id), cr = vmCellRef(id);
    if (cr) while (state.l[cr.list].length <= cr.i) store.addRow(state, cr.list, {}, 'heard');   // the row is there before it is pointed at
    if (cur !== f.sec) { cur = f.sec; redraw(); vmPulseNav(); }
    if (cr) { vm.rowCur[cr.list] = cr.i; if (!vmEl(id)) redraw(); }
    vm.target = id; vm.answered = false; vm.secGlow = false; vmMarkWait();
    var el = vmEl(id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var inp = el.querySelector('input:not([type=checkbox]),select,textarea');
      if (inp && !inp.disabled && !inp.readOnly && document.activeElement !== $('#vdText')) inp.focus({ preventScroll: true });
    } else vmMarkWait();
  }
  function vmOpenSection(secId) {
    vm.undo.push({ kind: 'nav', sec: cur, target: vm.target, answered: vm.answered });
    cur = secId; vm.target = null; vm.answered = false; vm.secGlow = true;
    if (document.activeElement && document.activeElement.blur && document.activeElement !== $('#vdText')) document.activeElement.blur();
    redraw(); vmPulseNav(); window.scrollTo(0, 0);
  }
  function vmStep(dir) {
    var list = vidx.fields.filter(function (f) { return f.sec === cur && !f.list && vmVisible(f); });
    if (!list.length) return;
    var i = vm.target ? list.map(function (f) { return f.id; }).indexOf(vm.target) : -1, n = i < 0 ? (dir > 0 ? 0 : list.length - 1) : i + dir;
    if (n >= 0 && n < list.length) vmShow(list[n].id);
  }
  function vmStepSection(dir) {
    var secs = schema.sections.filter(function (s) { return calc.showIf(s.cond, ctx()); }), i = secs.map(function (s) { return s.id; }).indexOf(cur), n = i + dir;
    if (n >= 0 && n < secs.length) vmOpenSection(secs[n].id);
  }
  function vmUndo() {
    var e = vm.undo.pop();
    if (!e) return;
    if (e.kind === 'nav') { cur = e.sec; vm.target = e.target; vm.answered = e.answered; vm.secGlow = false; redraw(); vmPulseNav(); return; }
    if (e.kind === 'wipe') {
      state = e.snap; fileBase = e.base; fileHandle = e.handle; rememberHandle(e.handle); dirty = e.dirty; cur = e.sec;
      vm.target = null; vm.answered = false; vm.secGlow = true; saveDraft(); redraw(); vmMarkWait(); toast('Everything is back as it was.'); return;
    }
    if (e.kind === 'addrow') { store.delRow(state, e.list, e.i); vm.rowCur[e.list] = Math.min(vm.rowCur[e.list] == null ? 0 : vm.rowCur[e.list], state.l[e.list].length - 1); touch(); redraw(); return; }
    if (e.kind === 'cell') { var ur = state.l[e.list][e.i]; if (ur) { ur.d[e.k] = e.prev.v; ur.st = e.prev.st; } touch(); redraw(); return; }
    state.f[e.id] = { v: e.prev.v, st: e.prev.st };
    (e.extras || []).forEach(function (x) { state.f[x.id] = { v: x.prev.v, st: x.prev.st }; });
    touch(); vmShow(e.id); redraw(); vmMarkWait();
  }
  function vmCommand(c) {
    if (vm.noteMode && /^(goto|next|prev|nextSection|prevSection|notesOff)$/.test(c.type)) vmStopNotes();   // moving on ends the notes
    switch (c.type) {
      case 'notes': return vmStartNotes(c);
      case 'notesOff': return;
      case 'goto': return vmOpenSection(c.sec);
      case 'next': return vmStep(1);
      case 'prev': return vmStep(-1);
      case 'nextSection': return vmStepSection(1);
      case 'prevSection': return vmStepSection(-1);
      case 'undo': return vmUndo();
      case 'clearAll': return vmWipeAsk();
      case 'clear':
        if (!vm.target) return;
        var ccr = vmCellRef(vm.target);
        if (ccr) { var cr0 = state.l[ccr.list][ccr.i]; if (!cr0 || cr0.d[ccr.k] === '') return; vm.undo.push({ kind: 'cell', list: ccr.list, i: ccr.i, k: ccr.k, prev: { v: cr0.d[ccr.k], st: cr0.st } }); cr0.d[ccr.k] = ''; vm.answered = false; touch(); redraw(); vmMarkWait(); return; }
        var cell = state.f[vm.target];
        if (cell.v === '' || cell.st === 'confirmed') return;
        vm.undo.push({ kind: 'fill', id: vm.target, prev: { v: cell.v, st: cell.st }, extras: [] });
        store.setField(state, vm.target, '', 'empty'); vm.answered = false; touch(); redraw(); vmMarkWait();
    }
  }
  /* ---------- "remove everything": nothing is cleared until the window over the form is answered ("yes" / "no" said, or a button tapped) ---------- */
  function vmWipeDialog() {
    var d = document.getElementById('wipe');
    if (d) return d;
    d = document.createElement('dialog'); d.id = 'wipe';
    d.innerHTML = '<h2>Delete all data from the entire form?</h2><p class="help">Are you sure? Everything on this form will be cleared. A file you have already saved is not changed. Say "yes" or "no", or tap a button.</p>' +
      '<div class="dlg-actions"><button class="btn ghost small" id="wipeNo" type="button">No, keep it</button><span class="grow"></span><button class="btn small" id="wipeYes" type="button">Yes, delete everything</button></div>';
    document.body.appendChild(d);
    d.querySelector('#wipeNo').addEventListener('click', function () { vmWipeEnd(false); });
    d.querySelector('#wipeYes').addEventListener('click', function () { vmWipeEnd(true); });
    return d;
  }
  function vmWipeAsk() {
    if (vm.wipe) return;
    vm.wipe = { after: [] };
    var d = vmWipeDialog();
    d.show();                                                    // not modal: the line for dictation stays usable, so "yes" can be said
    d.querySelector('#wipeNo').focus();
  }
  /* The window closes; yes empties the form, then whatever else was said in the same line is done. */
  function vmWipeEnd(yes) {
    var w = vm.wipe;
    if (!w) return Promise.resolve();
    vm.wipe = null;
    var d = document.getElementById('wipe'); if (d && d.open) d.close();
    if (yes) vmWipe();
    return vmRun(w.after || []);
  }
  function vmWipe() {
    vm.undo.push({ kind: 'wipe', snap: JSON.parse(JSON.stringify(state)), base: fileBase, handle: fileHandle, dirty: dirty, sec: cur });
    state = store.blank(); fileHandle = null; fileBase = ''; rememberHandle(null); dirty = false; saveDraft();
    cur = 'info'; vm.target = null; vm.answered = false; vm.noteMode = null; vm.rowCur = {}; vm.recent = []; vm.flashes = {}; vm.secGlow = true;
    redraw(); vmMarkWait(); window.scrollTo(0, 0);
    toast('The whole form is empty. Say "undo" to bring everything back.');
  }
  /* ---------- notes: \"let me take some notes\", \"note that down\" ---------- */
  /* The notes box of this section; where there are several (Medical, will & short-term), the one in the block being discussed. */
  function vmNotesBoxFor() {
    var boxes = vidx.notes.filter(function (n) { return n.sec === cur && vmVisible(n); });
    if (!boxes.length) return null;
    if (boxes.length === 1) return boxes[0].id;
    var tid = vm.noteMode && vm.noteMode.prev ? vm.noteMode.prev.target : vm.target, tf = tid ? vmField(tid) : null;
    if (tf && tf.sec === cur) {
      var best = boxes[0], d0 = Math.abs(boxes[0].blk - tf.blk);
      boxes.forEach(function (n) { var d = Math.abs(n.blk - tf.blk); if (d < d0) { best = n; d0 = d; } });
      return best.id;
    }
    return boxes[0].id;
  }
  /* "Note that down": the last thing said that was not a question or small talk. */
  function vmPreviousStatement() {
    for (var i = vm.recent.length - 2; i >= 0 && i >= vm.recent.length - 4; i--) {
      var t = vm.recent[i].text;
      if (!V.parseCommand(t, vidx) && !V.looksLikeQuestion(t) && !V.isChatter(t)) return t;
    }
    return '';
  }
  function vmStartNotes(c) {
    var box = c.box && vidx.noteById[c.box] && vmVisible(vidx.noteById[c.box]) ? c.box : vmNotesBoxFor();
    if (!box) { toast('There is no notes box in this section.'); return; }
    if (!vm.noteMode) vm.noteMode = { id: box, prev: { target: vm.target, answered: vm.answered } }; else vm.noteMode.id = box;
    vmShow(box); vm.answered = false; vmMarkWait();
    return c.retro ? vmAddNote(vmPreviousStatement()) : null;
  }
  function vmStopNotes() {
    if (!vm.noteMode) return;
    var prev = vm.noteMode.prev; vm.noteMode = null; vm.target = prev.target; vm.answered = prev.answered; vmMarkWait();
  }
  /* Add what was said to the notes box as short points (Claude writes them when it can; otherwise they are tidied here). */
  function vmAddNote(text) {
    var id = vm.noteMode && vm.noteMode.id;
    if (!id || !text) return null;
    var local = V.pointForm(text);
    if (!local.length) return null;
    var set = FF.lookup.getSettings(), secret = !VAI || VAI.scrub(text) !== text;
    var pts = Promise.resolve(local);
    if (vmAIReady() && !secret) {
      vm.busy++; vmRender();
      pts = VAI.points({ apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, text: text, topic: vmSecTitle(cur) })
        .then(function (r) { vm.busy--; vmRender(); return r.length ? r : local; }, function () { vm.busy--; vmRender(); return local; });
    }
    return pts.then(function (list) {
      var cell = state.f[id], add = list.map(function (x) { return '- ' + x; }).join('\n');
      vm.undo.push({ kind: 'fill', id: id, prev: { v: cell.v, st: cell.st }, extras: [] });
      store.setField(state, id, cell.v ? cell.v.replace(/\s+$/, '') + '\n' + add : add, 'heard');
      touch(); redraw(); vmFlash(id);
      if (vm.noteMode) { vm.target = id; vm.answered = false; vmMarkWait(); }
    });
  }
  /* The adviser's question points at a field. */
  function vmPoint(id) { vmShow(id); }
  /* Put one answer into the form. res: { kind: 'confirm' } or { kind: 'fill', value, status, extra?, append? }. */
  /* A box in a list: row i, column k. The row is added first if it is not there yet. */
  function vmApplyCell(c, id, res) {
    var rows = state.l[c.list];
    while (rows.length <= c.i) store.addRow(state, c.list, {}, 'heard');
    var row = rows[c.i], prev = row.d[c.k] == null ? '' : String(row.d[c.k]);
    if (res.kind === 'confirm') {
      if (prev === '') return false;
      vm.undo.push({ kind: 'cell', list: c.list, i: c.i, k: c.k, prev: { v: prev, st: row.st } });
      row.st = 'confirmed';                                                    // the status belongs to the whole row
    } else {
      var value = res.value;
      if (res.append && prev) value = prev.replace(/\s+$/, '') + '\n' + value;
      var auto = c.list === 'kids' && c.k === 'dob' && (row.d.stage === '' || row.d.stage === FF.calc.rowCalc('stage', row, ctx()));   // a child's stage follows the date of birth until set by hand
      vm.undo.push({ kind: 'cell', list: c.list, i: c.i, k: c.k, prev: { v: prev, st: row.st } });
      store.setCell(state, c.list, c.i, c.k, value, res.status === 'verify' ? 'verify' : 'heard');
      if (auto) row.d.stage = FF.calc.rowCalc('stage', row, ctx());
    }
    vm.rowCur[c.list] = c.i;
    if (id === vm.target) vm.answered = true;
    touch(); redraw(); vmFlash(id);
    return true;
  }
  /* Add a row, with the values Claude heard for it (a child: name and date of birth). A row that is still empty is filled before a new one is added. */
  function vmAddRow(list, values) {
    var L = vidx.lists[list];
    if (!L || !vmVisible(L)) return -1;
    if (cur !== L.sec) { cur = L.sec; vm.secGlow = false; vmPulseNav(); }
    var rows = state.l[list], i = -1, r;
    if (values) for (r = 0; r < rows.length; r++) if (!Object.keys(rows[r].d).some(function (k) { return rows[r].d[k] !== ''; })) { i = r; break; }
    if (i < 0) { store.addRow(state, list, {}, 'heard'); i = rows.length - 1; vm.undo.push({ kind: 'addrow', list: list, i: i }); }
    var row = rows[i], flashed = [], last = null;
    vm.rowCur[list] = i;
    Object.keys(values || {}).forEach(function (k) {
      var def = vidx.byId[list + '.' + k], x = def ? V.interpret(def, values[k]) : null;
      if (!x || x.error) return;
      vm.undo.push({ kind: 'cell', list: list, i: i, k: k, prev: { v: row.d[k] == null ? '' : row.d[k], st: row.st } });
      row.d[k] = x.value; row.st = x.status === 'verify' ? 'verify' : (row.st === 'verify' ? 'verify' : 'heard');
      flashed.push(list + ':' + i + ':' + k); last = k;
    });
    if (list === 'kids' && row.d.dob && row.d.stage === '') row.d.stage = FF.calc.rowCalc('stage', row, ctx());
    touch(); redraw(); vmPulseNav();
    if (last) { vm.target = list + ':' + i + ':' + last; vm.answered = true; }
    flashed.forEach(vmFlash); vmMarkWait();
    return i;
  }
  function vmApply(id, res) {
    var cr = vmCellRef(id);
    if (cr) return vmApplyCell(cr, id, res);
    var cell = state.f[id], entry = { kind: 'fill', id: id, prev: { v: cell.v, st: cell.st }, extras: [] }, extraIds = [];
    if (res.kind === 'confirm') {
      if (cell.v === '') return false;
      store.setField(state, id, cell.v, 'confirmed');
      if (id === 'idno') { var dobAgreed = autoDob(); if (dobAgreed) { entry.extras.push({ id: 'dob', prev: dobAgreed }); extraIds.push('dob'); } }   // the date of birth that came from this ID is agreed to with it
    } else {
      var value = res.value;
      if (res.append && cell.v && (cell.st === 'heard' || cell.st === 'verify')) value = cell.v + ' ' + value;
      store.setField(state, id, value, res.status);
      (res.extra || []).forEach(function (x) { var c2 = state.f[x.id]; entry.extras.push({ id: x.id, prev: { v: c2.v, st: c2.st } }); store.setField(state, x.id, x.value, x.status); extraIds.push(x.id); });
      if (id === 'idno') { var dobWas = autoDob(); if (dobWas) { entry.extras.push({ id: 'dob', prev: dobWas }); extraIds.push('dob'); } }   // the date of birth comes from the ID number
    }
    vm.undo.push(entry);
    if (id === vm.target) vm.answered = true;
    touch(); redraw(); vmFlash(id); extraIds.forEach(vmFlash);
    /* Employer or business name filled: look up what the company does. Only the company name is sent. */
    if (res.kind === 'fill') { autoCompanyLookup(id); if (PROFILE_SRC.indexOf(id) >= 0) autoProfileLookup(); }
    return true;
  }
  /* What is already in the boxes of the current section, so Claude can tell a new fact from a correction. Private boxes are only said to be filled, never their values. */
  function vmFilled() {
    var filled = {}, priv = [];
    vidx.fields.forEach(function (f) {
      if (f.list || f.sec !== cur || !vmVisible(f)) return;
      var c = state.f[f.id];
      if (!c || c.v === '') return;
      if (V.PRIVATE_IDS.indexOf(f.id) >= 0) priv.push(f.id); else filled[f.id] = String(c.v);
    });
    return { filled: filled, filledPrivate: priv };
  }
  /* The boxes and rows of this section that were filled by voice and still wait for the client to agree (amber "verify" or "heard"). Private boxes are listed without their values; the values stay here, to check a read-back against. */
  function vmAwaiting() {
    var out = [], held = {};
    vidx.fields.forEach(function (f) {
      if (f.list || f.sec !== cur || !vmVisible(f)) return;
      var c = state.f[f.id];
      if (!c || c.v === '' || (c.st !== 'heard' && c.st !== 'verify')) return;
      var priv = V.PRIVATE_IDS.indexOf(f.id) >= 0;
      out.push({ id: f.id, label: f.label, private: priv, value: priv ? null : String(c.v) });
      if (priv) held[f.id] = String(c.v);
    });
    Object.keys(vidx.lists).forEach(function (key) {
      if (vidx.lists[key].sec !== cur) return;
      state.l[key].forEach(function (r, i) {
        if (r.st !== 'heard' && r.st !== 'verify') return;
        if (Object.keys(r.d).some(function (k) { return r.d[k] !== '' && r.d[k] != null; })) out.push({ list: key, row: i + 1, label: vidx.lists[key].title + ' ' + (i + 1) });
      });
    });
    return { awaiting: out, held: held };
  }
  function vmAsk(who, text) {
    var set = FF.lookup.getSettings(), tcr = vm.target ? vmCellRef(vm.target) : null, tid = vm.target && !/^count:/.test(vm.target) && vmField(vm.target) ? (tcr ? tcr.list + '.' + tcr.k : vm.target) : null, fl = vmFilled(), aw = vmAwaiting();
    vm.busy++; vmRender();
    return VAI.decide({
      apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, idx: vidx, who: who, text: text,
      ctx: { sectionId: cur, targetId: tid, targetRow: tcr ? tcr.i + 1 : null, targetValue: tid && !vmPrivate(vm.target) ? vmValue(vm.target) : '', targetFilled: !!(tid && vmValue(vm.target) !== ''), filled: fl.filled, filledPrivate: fl.filledPrivate, awaiting: aw.awaiting, privateHeld: aw.held,
        listRows: function (key) { return state.l[key].map(function (r) { return r.d; }); }, recent: vm.recent.slice(-7, -1) }
    }).then(function (r) { vm.busy--; vmRender(); return r; }, function (err) {
      vm.busy--; vmRender();
      if (Date.now() - vm.lastFail > 60000) { vm.lastFail = Date.now(); toast('Voice: could not reach Claude (' + err.message + '). Using only what this computer can understand.'); }
      return null;
    });
  }
  /* Do what a line of conversation says, in order. Actions come from V.plan (on this computer) or from Claude. */
  function vmDo(a) {
    var f = a.field ? vmField(a.field) : null;
    switch (a.do) {
      case 'cmd': return vmCommand(a.cmd);
      case 'section': return vmOpenSection(a.section);
      case 'note': return vmAddNote(a.text);
      case 'addrow': return void vmAddRow(a.list, null);
      case 'row': return void vmAddRow(a.list, a.values);
      case 'ask':
        if (vm.noteMode) vmStopNotes();
        if (a.list) {                                                           // Claude: a box of a row ("row": 2, "last" or "new")
          var n = state.l[a.list].length, i = a.row === 'new' ? n : a.row === 'last' ? Math.max(n - 1, 0) : a.row - 1;
          return vmPoint(a.list + ':' + i + ':' + a.col);
        }
        if (/^count:/.test(a.field)) return vmPoint(a.field);
        return f && vmVisible(f) ? vmPoint(a.field) : null;
      case 'cell':                                                              // Claude: a value for a box of a row that is there
        var rn = state.l[a.list].length, ri = a.row === 'last' ? Math.max(rn - 1, 0) : a.row - 1;
        return vmDo({ do: 'fill', field: a.list + ':' + ri + ':' + a.col, value: a.value, explicit: a.explicit });
      case 'wait': return vm.target ? vmNote(vm.target, a.dangling ? 'Listening for the rest' : 'Waiting for the correct answer') : null;
      case 'confirm': case 'fill':
        if (a.do === 'confirm' && a.list) {                                     // Claude: the client agrees to a row of a list; its first filled box carries the status
          var cl = state.l[a.list] || [], ci = a.row === 'last' ? Math.max(cl.length - 1, 0) : a.row - 1, crow = cl[ci], ck = crow && vidx.lists[a.list].cols.map(function (id) { return id.split('.')[1]; }).filter(function (k) { return crow.d[k] !== '' && crow.d[k] != null; })[0];
          return ck ? vmDo({ do: 'confirm', field: a.list + ':' + ci + ':' + ck }) : null;
        }
        if (!f || !vmVisible(f)) return;
        var cell = vmCellRef(a.field) ? { v: vmValue(a.field), st: (state.l[vmCellRef(a.field).list][vmCellRef(a.field).i] || { st: 'heard' }).st } : state.f[a.field], res = a.res;
        if (!res && a.do === 'confirm') res = { kind: 'confirm' };
        if (!res) { var x = V.interpret(f, a.value); if (x && !x.error) res = { kind: 'fill', value: x.value, status: x.status, extra: x.extra, append: x.append }; }
        if (!res) return;
        if (res.kind === 'fill' && !res.extra && cell.v !== '' && String(res.value).trim().toLowerCase() === String(cell.v).trim().toLowerCase()) res = { kind: 'confirm' };   // saying the same thing again agrees with it
        if (a.field !== vm.target && a.do !== 'confirm') {                  // agreeing to a box does not move the cursor: it turns green where it is
          if (!a.explicit && res.kind === 'fill' && cell.v !== '' && cell.st === 'confirmed') return;   // Claude's volunteered fact never overwrites a confirmed value
          vmShow(a.field);                                                                              // the screen follows the conversation to that box
        }
        vmApply(a.field, res);
    }
  }
  /* One after another, so a note written by Claude lands before the next thing in the line. */
  function vmRun(actions) {
    var k = -1;                                                  // "remove everything" ends the line for now: the rest waits for the answer
    actions.forEach(function (a, i) { if (k < 0 && a.do === 'cmd' && a.cmd && a.cmd.type === 'clearAll') k = i; });
    var now = k < 0 ? actions : actions.slice(0, k + 1);
    return now.reduce(function (p, a) { return p.then(function () { return vmDo(a); }); }, Promise.resolve()).then(function () { if (k >= 0 && vm.wipe) vm.wipe.after = actions.slice(k + 1); });
  }
  /* A line whose speaker is not known. It may hold the adviser and the client together, in any order, with corrections and things they do not have.
     Claude reads it and says what to do on the form; this computer's own reading is used only for a bare command word, while notes are being taken,
     for a one or two word answer, and when Claude cannot be reached. */
  function vmProcessAuto(text, entry) {
    if (vm.wipe) {                                                       // "Delete all data from the entire form?" is waiting: only yes or no counts, and nothing goes to Claude
      var ans = V.wipeAnswer(text);
      if (ans) return vmWipeEnd(ans === 'yes');
      toast('Waiting for a yes or no: delete all data from the entire form?');
      return Promise.resolve();
    }
    var pl = V.plan(text, vidx, { cur: cur, noting: !!vm.noteMode, target: vm.target, answered: vm.answered, rows: function (key) { return state.l[key].map(function (r) { return r.d; }); }, curRow: vm.rowCur, value: function (id) { return state.f[id].v; }, visible: function (id) { var f = vmField(id); return !!f && vmVisible(f); } });
    var words = text.split(/\s+/).length, onlyCommand = pl.actions.length > 0 && pl.actions.every(function (a) { return a.do === 'cmd'; }) && words <= 8;
    /* A bare "yes" or "correct" may agree to several boxes that were just read back: Claude decides which, from the lines before it. */
    var agree = words <= 2 && V.isConfirm(text, true) && !pl.actions.some(function (a) { return a.do === 'fill'; }) && vmAwaiting().awaiting.length > 0;
    if (vm.noteMode || onlyCommand || (words <= 2 && !agree) || !vmAIReady()) return vmRun(pl.actions);
    return vmAsk('auto', text).then(function (r) {
      if (r && r.kind === 'actions') return vmRun(r.actions);
      if (!r || agree) return vmRun(pl.actions);                         // Claude could not be reached, or had nothing to add to a plain yes: this computer's best reading
    });
  }
  /* Called for every line heard. who is 'me' (the adviser), 'client', or left out when the source cannot tell and the words decide.
     Lines are handled one after another, in order. */
  function vmHear(text, who) {
    text = String(text == null ? '' : text).trim();
    if (!vm.on || !text) return Promise.resolve();
    var w = 'auto', entry = { who: who === 'me' ? 'adviser' : who === 'client' ? 'client' : 'unclear', text: text };
    vm.recent.push(entry); if (vm.recent.length > 12) vm.recent.shift();
    vm.queue = vm.queue.then(function () { return vmProcessAuto(text, entry); }).catch(function () { /* one bad line never stops the next */ });
    return vm.queue;
  }
  function vmToggle(on) {
    vm.on = on; vm.target = null; vm.answered = false; vm.secGlow = on; vm.noteMode = null; vm.rowCur = {}; vm.queue = Promise.resolve();
    if (vm.wipe) { vm.wipe = null; var wd = document.getElementById('wipe'); if (wd && wd.open) wd.close(); }   // switching Voice on or off never leaves the question hanging
    if (!on) { document.querySelectorAll('.voice-wait,.voice-ok').forEach(function (e) { e.classList.remove('voice-wait', 'voice-ok'); }); $('#vdText').hidden = true; }
    vmRender(); vmMarkWait();
    if (on && FF.voiceBackend && FF.voiceBackend.warm) {   // ask permission now, so it never interrupts a conversation later
      vm.busy++; vmRender();
      FF.voiceBackend.warm().then(function () { vm.busy--; vmRender(); }, function (e) { vm.busy--; vmRender(); toast('Voice could not use Claude (' + ((e && (e.message || e.code)) || 'not allowed') + '). Only the simple on-page rules will work. Reload the page and tap Allow to try again.'); });
    }
  }
  /* Press and hold the Voice button to show a hidden test line. Just type or dictate; the words decide who is speaking ("client: ..." or "me: ..." force it). For testing only. */
  var vmHold = null, vmHeld = false;
  $('#btnVoice').addEventListener('pointerdown', function () { vmHeld = false; vmHold = setTimeout(function () { vmHeld = true; if (vm.on) { var t = $('#vdText'); t.hidden = !t.hidden; if (!t.hidden) t.focus(); } }, 800); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { $('#btnVoice').addEventListener(ev, function () { clearTimeout(vmHold); }); });
  $('#btnVoice').addEventListener('click', function () { if (vmHeld) { vmHeld = false; return; } vmToggle(!vm.on); });
  $('#vdText').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    /* Dictation may still be finishing its last word when Return is tapped, so read the line a moment later. */
    var el = this;
    setTimeout(function () {
      var raw = el.value, c = /^\s*(?:c\s*:|clients?\s*:)\s*(.*)$/i.exec(raw), a = /^\s*(?:m|me|adviser|advisor)\s*:\s*(.*)$/i.exec(raw);
      el.value = ''; vmHear(c ? c[1] : a ? a[1] : raw, c ? 'client' : a ? 'me' : undefined);
    }, 350);
  });

  /* Open on a fresh page. The last client comes back only if it had unsaved changes. */
  var restored = null;
  try { if (localStorage.getItem(DRAFT_KEY + '-dirty') === '1') restored = loadDraft(); } catch (e) { restored = null; }
  state = restored || store.blank();
  try { fileBase = restored ? (localStorage.getItem(DRAFT_KEY + '-file') || '') : ''; } catch (e) { fileBase = ''; }
  if (restored) recallHandle().then(function (h) { if (h && fileBase) { fileHandle = h; } });
  else rememberHandle(null);
  dirty = !!restored;
  window.FF.app = { get state() { return state; }, redraw: redraw, setState: function (s) { state = s; redraw(); }, makePdf: makePdf, voiceHear: vmHear, voice: vm };
  redraw();
  if (restored) toast('Restored your unsaved changes for ' + (store.clientName(state) || 'the last client') + '.');
})();
