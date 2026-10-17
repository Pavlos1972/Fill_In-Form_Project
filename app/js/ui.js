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
    var act = (st === 'heard' || st === 'verify' || st === 'suggest') ? ' data-accept="' + esc(target) + '" title="Click to accept"' : '';
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
    if (def.t === 'area') return '<textarea ' + attrs + '>' + esc(v) + '</textarea>';
    return '<input ' + attrs + ' value="' + esc(v) + '"' + (disabled ? ' readonly' : '') + ' autocomplete="off">';
  }
  function fieldHTML(f, g12) {
    var c = state.f[f.id], st = c.st, v = c.v, isNone = !!f.none && v === 'None';
    if (f.calc) { v = FF.calc.field(f.calc, ctx()); st = 'calc'; }
    var rt = f.link ? '<a class="lnk" href="' + f.link[1] + '" target="_blank" rel="noopener">' + esc(f.link[0]) + ' ↗</a>' : '';
    if (f.lookup) rt += '<button type="button" class="lookup" data-lookup="' + f.id + '">Look up online</button>';
    if (f.none) rt += '<label class="nonebox"><input type="checkbox" data-none="' + f.id + '"' + (isNone ? ' checked' : '') + '> ' + esc(f.none) + '</label>';
    if (f.t === 'area' && !f.opt) rt += badge(st, 'f:' + f.id);
    var attrs = 'data-f="' + f.id + '"' + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '');
    var style = g12 ? ' style="--s:' + (f.wide ? 12 : (f.s || 4)) + '"' : '';
    return '<label class="f s-' + st + (f.wide ? ' wide' : '') + '" data-field="' + f.id + '"' + style + '><span class="l"><span>' + esc(f.l) + '</span>' + (rt ? '<span class="rt">' + rt + '</span>' : '') + '</span>' +
      '<span class="box">' + control(attrs, f, v, !!f.calc || isNone) + (f.t === 'area' ? '' : '<span class="st">' + badge(st, 'f:' + f.id) + '</span>') + '</span>' +
      '<span class="warn" data-warn="' + f.id + '" hidden></span></label>';
  }
  function cellHTML(key, i, c, r, card) {
    var L = schema.lists[key], v = c.calc ? FF.calc.rowCalc(c.calc, r, ctx()) : r.d[c.k];
    var at = 'data-l="' + key + '" data-i="' + i + '" data-k="' + c.k + '"';
    var ctl = control(at, c, v, !!c.calc);
    if (card) return '<label class="f' + (c.wide ? ' wide' : '') + '"><span class="l"><span>' + esc(c.l) + '</span></span><span class="box">' + ctl + '</span><span class="warn" data-rwarn="' + key + ':' + i + '" hidden></span></label>';
    return '<td' + (c.num ? ' class="num"' : '') + '>' + ctl + '</td>';
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
    refreshWarnings(); refreshChrome();
  }
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
    if (sug) html += '<div>Date of birth from the ID number: <button type="button" class="link-btn" data-usedob="' + iso(sug) + '">use ' + util.longDate(sug) + '</button></div>';
    box.innerHTML = html || '<span class="ok">No problems found.</span>';
  }
  function iso(d) { return d.y + '-' + (d.m < 10 ? '0' : '') + d.m + '-' + (d.d < 10 ? '0' : '') + d.d; }
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
      store.setField(state, t.dataset.f, val);
      var wrap = t.closest('.f'); if (wrap) { wrap.className = wrap.className.replace(/\bs-\w+/, 's-' + state.f[t.dataset.f].st); var b = wrap.querySelector('.st'); if (b) b.innerHTML = badge(state.f[t.dataset.f].st, 'f:' + t.dataset.f); }
      touch();
      if (condIds[t.dataset.f]) { redraw(); var again = document.querySelector('[data-f="' + t.dataset.f + '"]'); if (again) again.focus(); } else refreshLive();
    } else if (t.dataset.l) {
      var key = t.dataset.l, i = +t.dataset.i, k = t.dataset.k, col = schema.lists[key].cols.filter(function (c) { return c.k === k; })[0], row0 = state.l[key][i];
      var v2 = t.value;
      if (col && col.money) { v2 = util.formatMoney(v2); t.value = v2; }
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

  /* ---------- online look-up of what a company does ---------- */
  function doLookup(btn) {
    var id = btn.dataset.lookup, def = schema.fieldsById[id], nameId = def.lookup, name = String(state.f[nameId].v || '').trim();
    var set = FF.lookup.getSettings();
    if (!name) { toast('Enter the ' + schema.fieldsById[nameId].l.toLowerCase() + ' first.'); return; }
    if (!set.apiKey) { openSettings(); toast('Add your Anthropic API key first.'); return; }
    var old = btn.textContent; btn.textContent = 'Searching…'; btn.disabled = true;
    FF.lookup.run({ apiKey: set.apiKey, model: set.model, name: name, kind: id === 'biz_does' ? 'business' : 'company' }).then(function (text) {
      store.setField(state, id, text, text.indexOf('Could not identify') === 0 ? 'empty' : 'heard');
      touch(); redraw();
    }, function (err) { btn.textContent = old; btn.disabled = false; toast(err.message); });
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
  var vm = { on: false, target: null, answered: false, secGlow: false, undo: [], recent: [], flashes: {}, queue: Promise.resolve(), busy: 0, lastFail: 0 };
  function vmField(id) { return vidx.byId[id]; }
  function vmVisible(f) { return calc.showIf(f.secCond, ctx()) && calc.showIf(f.cond, ctx()); }
  function vmSecTitle(id) { return schema.sections.filter(function (s) { return s.id === id; })[0].title; }
  function vmEl(id) { return document.querySelector('[data-field="' + id + '"]'); }
  function vmAIReady() { return !!(VAI && FF.lookup.getSettings().apiKey); }
  function vmPrivate(id) { return V.PRIVATE_IDS.indexOf(id) >= 0; }
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
    document.querySelectorAll('.voice-ok').forEach(function (e) { if (!vm.flashes[e.dataset.field] || Date.now() - vm.flashes[e.dataset.field] > 1500) { e.classList.remove('voice-ok'); e.style.animationDelay = ''; } });
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
    var f = vmField(id);
    if (cur !== f.sec) { cur = f.sec; redraw(); vmPulseNav(); }
    vm.target = id; vm.answered = false; vm.secGlow = false; vmMarkWait();
    var el = vmEl(id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var inp = el.querySelector('input:not([type=checkbox]),select,textarea');
      if (inp && !inp.disabled && !inp.readOnly) inp.focus({ preventScroll: true });
    } else vmMarkWait();
  }
  function vmOpenSection(secId) {
    vm.undo.push({ kind: 'nav', sec: cur, target: vm.target, answered: vm.answered });
    cur = secId; vm.target = null; vm.answered = false; vm.secGlow = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    redraw(); vmPulseNav(); window.scrollTo(0, 0);
  }
  function vmStep(dir) {
    var list = vidx.fields.filter(function (f) { return f.sec === cur && vmVisible(f); });
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
    state.f[e.id] = { v: e.prev.v, st: e.prev.st };
    (e.extras || []).forEach(function (x) { state.f[x.id] = { v: x.prev.v, st: x.prev.st }; });
    touch(); vmShow(e.id); redraw(); vmMarkWait();
  }
  function vmCommand(c) {
    switch (c.type) {
      case 'goto': return vmOpenSection(c.sec);
      case 'next': return vmStep(1);
      case 'prev': return vmStep(-1);
      case 'nextSection': return vmStepSection(1);
      case 'prevSection': return vmStepSection(-1);
      case 'undo': return vmUndo();
      case 'clear':
        if (!vm.target) return;
        var cell = state.f[vm.target];
        if (cell.v === '' || cell.st === 'confirmed') return;
        vm.undo.push({ kind: 'fill', id: vm.target, prev: { v: cell.v, st: cell.st }, extras: [] });
        store.setField(state, vm.target, '', 'empty'); vm.answered = false; touch(); redraw(); vmMarkWait();
    }
  }
  /* The adviser's question points at a field. */
  function vmPoint(id) { vmShow(id); }
  /* Put one answer into the form. res: { kind: 'confirm' } or { kind: 'fill', value, status, extra?, append? }. */
  function vmApply(id, res) {
    var cell = state.f[id], entry = { kind: 'fill', id: id, prev: { v: cell.v, st: cell.st }, extras: [] }, extraIds = [];
    if (res.kind === 'confirm') {
      if (cell.v === '') return false;
      store.setField(state, id, cell.v, 'confirmed');
    } else {
      var value = res.value;
      if (res.append && cell.v && (cell.st === 'heard' || cell.st === 'verify')) value = cell.v + ' ' + value;
      store.setField(state, id, value, res.status);
      (res.extra || []).forEach(function (x) { var c2 = state.f[x.id]; entry.extras.push({ id: x.id, prev: { v: c2.v, st: c2.st } }); store.setField(state, x.id, x.value, x.status); extraIds.push(x.id); });
    }
    vm.undo.push(entry);
    if (id === vm.target) vm.answered = true;
    touch(); redraw(); vmFlash(id); extraIds.forEach(vmFlash);
    /* Employer or business name filled: look up what the company does. Only the company name is sent. */
    var lk = res.kind === 'fill' ? { employer: 'co_does', biz_name: 'biz_does' }[id] : null;
    if (lk && state.f[lk].v === '' && FF.lookup.getSettings().apiKey) { var btn = document.querySelector('[data-lookup="' + lk + '"]'); if (btn) doLookup(btn); }
    return true;
  }
  function vmAsk(who, text) {
    var set = FF.lookup.getSettings(), tid = vm.target && !vmPrivate(vm.target) ? vm.target : null;
    vm.busy++; vmRender();
    return VAI.decide({
      apiKey: set.apiKey, model: set.voiceModel, idx: vidx, who: who, text: text,
      ctx: { sectionId: cur, targetId: tid, targetValue: tid ? state.f[tid].v : '', recent: vm.recent.slice(-7, -1) }
    }).then(function (r) { vm.busy--; vmRender(); return r; }, function (err) {
      vm.busy--; vmRender();
      if (Date.now() - vm.lastFail > 60000) { vm.lastFail = Date.now(); toast('Voice: could not reach Claude (' + err.message + '). Using only what this computer can understand.'); }
      return null;
    });
  }
  function vmProcessMe(text) {
    var c = V.parseCommand(text, vidx);
    if (c) { vmCommand(c); return null; }
    var m = V.matchQuestion(text, vidx, { cur: cur, isEmpty: function (id) { return state.f[id].v === ''; } });
    if (m && (m.score >= 5 || !vmAIReady())) { vmPoint(m.id); return null; }
    if (!vmAIReady()) return null;
    return vmAsk('me', text).then(function (r) {
      if (r && r.kind === 'point') { if (r.field) vmPoint(r.field); else if (r.section) vmOpenSection(r.section); }
      else if (m) vmPoint(m.id);
    });
  }
  function vmApplyAI(r) {
    if (!r || r.kind !== 'answers') return;
    var any = false;
    r.answers.forEach(function (a) {
      var f = vmField(a.field), cell = state.f[a.field], isT = a.field === vm.target;
      if (!f || !vmVisible(f)) return;
      if (!isT && cell.v !== '' && cell.st === 'confirmed') return;          // a volunteered fact never overwrites something already confirmed
      var res = null;
      if (a.confirm) res = { kind: 'confirm' };
      else { var x = V.interpret(f, a.value); if (x && !x.error) res = { kind: 'fill', value: x.value, status: x.status, extra: x.extra, append: x.append }; }
      if (res && vmApply(a.field, res)) any = true;
    });
    if (!any && r.waiting && vm.target) vmNote(vm.target, 'Waiting for the correct answer');
  }
  function vmProcessClient(text) {
    var words = text.split(/\s+/).length, local = null;
    if (vm.target && !vm.answered) {
      var id = vm.target, f = vmField(id), r = V.answerFor(f, text, state.f[id].v);
      if (r.kind === 'wait') { vmNote(id, 'Waiting for the correct answer'); return null; }
      var canAsk = vmAIReady() && !vmPrivate(id);
      /* A long answer usually holds several facts, so Claude reads it first; short answers are understood here, instantly. */
      if ((r.kind === 'confirm' || r.kind === 'fill') && !(canAsk && words >= 6)) {
        if (r.kind === 'fill' && words > 8 && f.t === 'txt') r.status = 'verify';
        vmApply(id, r); return null;
      }
      if (!canAsk) { if (r.kind === 'error') vmNote(id, 'Did not catch that'); return null; }
      local = r;
    } else if (!vmAIReady() || words < 4) return null;        // after an answer, only longer remarks are checked for extra facts
    return vmAsk('client', text).then(function (res) {
      if (res === null && local && local.kind === 'fill') { local.status = 'verify'; vmApply(vm.target, local); return; }   // Claude unreachable: use what this computer understood
      vmApplyAI(res);
    });
  }
  /* Called for every line heard. Lines are handled one after another, in order. */
  function vmHear(text, who) {
    text = String(text == null ? '' : text).trim();
    if (!vm.on || !text) return Promise.resolve();
    var w = who === 'client' ? 'client' : 'me';
    vm.recent.push({ who: w === 'me' ? 'adviser' : 'client', text: text }); if (vm.recent.length > 12) vm.recent.shift();
    vm.queue = vm.queue.then(function () { return w === 'me' ? vmProcessMe(text) : vmProcessClient(text); }).catch(function () { /* one bad line never stops the next */ });
    return vm.queue;
  }
  function vmToggle(on) {
    vm.on = on; vm.target = null; vm.answered = false; vm.secGlow = on; vm.queue = Promise.resolve();
    if (!on) { document.querySelectorAll('.voice-wait,.voice-ok').forEach(function (e) { e.classList.remove('voice-wait', 'voice-ok'); }); $('#vdText').hidden = true; }
    vmRender(); vmMarkWait();
  }
  /* Press and hold the Voice button to show a hidden test line (type "client: ..." for the client's side). For testing only. */
  var vmHold = null, vmHeld = false;
  $('#btnVoice').addEventListener('pointerdown', function () { vmHeld = false; vmHold = setTimeout(function () { vmHeld = true; if (vm.on) { var t = $('#vdText'); t.hidden = !t.hidden; if (!t.hidden) t.focus(); } }, 800); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { $('#btnVoice').addEventListener(ev, function () { clearTimeout(vmHold); }); });
  $('#btnVoice').addEventListener('click', function () { if (vmHeld) { vmHeld = false; return; } vmToggle(!vm.on); });
  $('#vdText').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var raw = this.value, m = /^\s*(?:c|client)\s*:\s*(.*)$/i.exec(raw);
    vmHear(m ? m[1] : raw.replace(/^\s*(?:me|m)\s*:\s*/i, ''), m ? 'client' : 'me'); this.value = '';
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
