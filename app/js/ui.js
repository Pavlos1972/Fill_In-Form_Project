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
  function touch() { dirty = true; saveDraft(); refreshChrome(); if (cur === 'admin' && typeof paSoon === 'function') paSoon(); }
  /* A South African ID number holds the date of birth (YYMMDD), and the date of birth always follows it: when the ID number is entered or changed,
     the date goes into the date of birth box, replacing whatever was there (a date entered before the ID, or the date of the previous ID), and a note says so.
     A date typed or said after the ID is left as it is (the Checks panel warns when it does not match). The date takes the status of the ID number:
     amber "verify" while the ID is, confirmed once the ID is (typed, clicked or agreed to by the client). Returns what the box held before (so it can be
     undone), or null when nothing changed. This happens on this computer: the ID number is never sent anywhere. */
  /* The gender follows a valid South African ID number, only while the gender box is empty (a gender that is there is left alone). */
  function autoGender() {
    var id = String(state.f.idno.v || '').replace(/\s/g, ''), g = state.f.gender;
    if (!g || state.f.idtype.v === 'Passport' || !util.saIdValid(id) || g.v !== '') return null;
    var was = { v: g.v, st: g.st };
    store.setField(state, 'gender', util.sexFromSaId(id), state.f.idno.st === 'confirmed' ? 'confirmed' : 'verify');
    return was;
  }
  /* An ID number can be on the form once. Says where it already is, or returns null. where: { id: 'idno' } or { list: 'shares', i }. */
  function idClashMsg(value, where) {
    var c = store.idClash(state, value, where);
    return c ? 'That ID number is already used for ' + c.who + '. An ID number can only be on the Fact Find once.' : null;
  }
  /* A child's name given as "Anna Kuiper" in the Name box: the surname goes to the Surname box. If the Surname box already holds that surname (the father's, put there by itself) it is just taken off the name.
     Said aloud, a two-word name is first name and surname. Typed (strict), only a surname that is the one already there, or the father's, is split off, so "Anna Maria" stays a first name. */
  function kidsNameFix(row, strict) {
    if (!row || !row.d.name) return;
    var name = String(row.d.name).trim(), have = String(row.d.sname || '').trim(), dad = store.fatherSurname(state), sp;
    if (have) {
      if (name.length > have.length + 1 && name.toLowerCase().slice(-(have.length + 1)) === (' ' + have).toLowerCase()) row.d.name = name.slice(0, name.length - have.length).trim();
      return;
    }
    sp = util.splitFullName(name, dad);
    if (!sp.last) return;
    if ((strict || dad) && sp.last.toLowerCase() !== dad.toLowerCase()) return;           // not the father's surname: more likely two first names
    row.d.name = sp.first; row.d.sname = sp.last;
  }
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
  /* The layout is adjusted from here, so index.html does not change: the version and tax tables sit small under the heading (the "This Fact Find" card is gone), and the right-hand pane
     can keep the live conversation in view (the pane is as tall as the page, so a card in it can stay put while the form scrolls). */
  function layoutSetup() {
    var meta = $('#meta'), card = meta && meta.closest('.card'), h1 = document.querySelector('.top h1');
    if (card) card.remove();
    if (h1 && !$('#verLine')) {
      var w = document.createElement('div'); w.className = 'ttl';
      h1.parentNode.insertBefore(w, h1); w.appendChild(h1);
      var sm = document.createElement('small'); sm.id = 'verLine'; w.appendChild(sm);
    }
    var st = document.createElement('style');
    st.textContent = '.top .ttl{display:flex;flex-direction:column;justify-content:center;padding-left:20px;border-left:1px solid var(--line)}.top .ttl h1{padding-left:0;border-left:0;line-height:22px}' +
      '.top .ttl small{font-size:11px;line-height:1.3;color:var(--muted)}@media (max-width:720px){.top .ttl{padding-left:0;border-left:0}}.side{align-self:stretch}';
    document.head.appendChild(st);
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
    writeFile(blob, store.pdfFileName(state) + '.pdf', 'PDF document', '.pdf', null, 'fact-find-pdf', fileHandle)
      .then(function () { toast('PDF saved.'); })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save the PDF: ' + e.message); });
  }
  function previewPdf() {
    var url = URL.createObjectURL(makePdf().output('blob'));
    var w = window.open(url, '_blank');
    if (!w) download(makePdf().output('blob'), store.pdfFileName(state) + '.pdf');
  }
  /* Opens a saved client. With Chrome's file picker the file is remembered, so Save writes back to it. */
  function openFile(file, handle) {
    var r = new FileReader();
    r.onload = function () {
      try {
        state = store.fromJSON(r.result); vmFreshForm(); fileHandle = handle || null; fileBase = file.name.replace(/\.json$/i, '');
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
    var timed = meeting.ms() >= 60000;                                                              // a meeting that has run for a minute is not thrown away by a stray click
    if ((dirty || timed) && !window.confirm('Start a new Fact Find?' + (dirty ? ' Changes you have not saved will be lost.' : '') + (timed ? ' The meeting timer goes back to zero.' : ''))) return;
    meeting.reset(); meetingRender();
    state = store.blank(); vmFreshForm(); fileHandle = null; fileBase = ''; rememberHandle(null); dirty = false; lastSaved = null; cur = 'info'; saveDraft(); redraw();
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
  /* A tick-box dropdown (the policy schedule lists): the choices ticked are kept as one text joined with "; ", and an empty box is "(not asked yet)". "(not asked yet)" is ticked and the choices are greyed out
     until it is unticked; ticking a choice unticks it; unticking every choice goes back to it (once the list is closed). */
  var msOpen = '', msFree = {};
  function msParts(v) { return String(v == null ? '' : v).split(';').map(function (x) { return x.trim(); }).filter(Boolean); }
  /* def.nona: a list with no "(not asked yet)" row (the insurers of a standard quote: nothing ticked is just "not chosen yet"); a value that is not one of the choices (an insurer typed in an older file, or said) is kept and listed ticked. */
  function msExtra(def, sel) { return sel.filter(function (x) { return def.o.indexOf(x) < 0; }); }
  function multiHTML(def, v, disabled) {
    var sel = msParts(v), open = msOpen === def.id, na = !def.nona && !sel.length && !msFree[def.id], extra = msExtra(def, sel);
    var rows = (def.nona ? '' : '<label' + (disabled ? ' class="dis"' : '') + '><input type="checkbox" data-ck="' + def.id + '|na"' + (na ? ' checked' : '') + (disabled ? ' disabled' : '') + '> (not asked yet)</label><hr>') +
      def.o.map(function (o, i) { var dis = disabled || na; return '<label' + (dis ? ' class="dis"' : '') + '><input type="checkbox" data-ck="' + def.id + '|' + i + '"' + (sel.indexOf(o) >= 0 ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + esc(o) + '</label>'; }).join('') +
      extra.map(function (o, i) { return '<label><input type="checkbox" data-ck="' + def.id + '|x' + i + '" checked> ' + esc(o) + '</label>'; }).join('');
    return '<div class="ms" data-ms="' + def.id + '"><button type="button" class="msb' + (open ? ' open' : '') + (def.nona && !sel.length ? ' ph' : '') + '" data-msb="' + def.id + '" aria-expanded="' + open + '"' + (disabled ? ' disabled' : '') + '>' + esc(sel.length ? sel.join(def.nona ? ', ' : ' + ') : def.nona ? 'Choose insurer(s)' : '(not asked yet)') + '</button>' + (open ? '<div class="msp">' + rows + '</div>' : '') + '</div>';
  }
  function control(attrs, def, v, disabled) {
    if (def.t === 'multi') return multiHTML(def, v, disabled);
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
    if (f.cal) rt += '<button type="button" class="calbtn" data-cal="' + f.id + '" aria-label="Pick ' + esc(f.l.toLowerCase()) + ' from a calendar">📅 Calendar</button>';
    if (f.none) rt += '<label class="nonebox"><input type="checkbox" data-none="' + f.id + '"' + (isNone ? ' checked' : '') + '> ' + esc(f.none) + '</label>';
    if (f.t === 'area' && !f.opt) rt += badge(st, 'f:' + f.id);
    var attrs = 'data-f="' + f.id + '"' + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '');
    var style = g12 ? ' style="--s:' + (f.wide ? 12 : (f.s || 4)) + '"' : '';
    var tag = f.t === 'multi' ? 'div' : 'label';
    return '<' + tag + ' class="f s-' + st + (f.wide ? ' wide' : '') + '" data-field="' + f.id + '"' + style + '><span class="l"><span>' + esc(f.sl || f.l) + '</span>' + (rt ? '<span class="rt">' + rt + '</span>' : '') + '</span>' +
      '<span class="box">' + control(attrs, f, v, !!f.calc || isNone) + (f.cal ? '<input type="date" class="calpick" data-calpick="' + f.id + '" tabindex="-1" aria-hidden="true">' : '') + (f.t === 'area' ? '' : '<span class="st">' + badge(st, 'f:' + f.id) + '</span>') + '</span>' +
      (f.len ? lenChip(f.id) : '') + '<span class="warn" data-warn="' + f.id + '" hidden></span></' + tag + '>';
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
    if (L.dense) {                                                                                  // one short row for each quote: its boxes side by side, wrapping when the space is narrow
      if (!rows.length) return '<div class="dempty"><span>None recorded yet.</span><button type="button" class="addrow" data-add="' + key + '">+ ' + esc(L.add) + '</button></div>';
      rows.forEach(function (r, i) {
        h += '<div class="rowcard drow rc-' + key + ' s-' + r.st + '"><div class="dcells">' + L.cols.map(function (c) { return cellHTML(key, i, c, r, true); }).join('') + '</div><div class="dtools">' +
          ((r.st === 'heard' || r.st === 'verify') ? badge(r.st, 'r:' + key + ':' + i) : '') + '<button type="button" class="x" data-del="' + key + ':' + i + '" aria-label="Remove ' + esc(L.cards.toLowerCase()) + ' ' + (i + 1) + '">✕</button></div></div>';
      });
      return h + '<button type="button" class="addrow" data-add="' + key + '">+ ' + esc(L.add) + '</button>';
    }
    if (L.cards) {
      if (!rows.length) h += '<div class="empty-list">None recorded yet.</div>';
      rows.forEach(function (r, i) {
        h += '<div class="rowcard rc-' + key + ' s-' + r.st + '"><div class="rowhead"><b>' + esc(L.cards) + ' ' + (i + 1) + '</b>' +
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
  /* A greyed-out box or block (its rule is not met) stays on screen, but nothing in it can be used until the rule is met. */
  function greyed(html) { return html.replace(/^<(label|div) class="f /, '<$1 inert class="f off '); }
  function gridHTML(b, c) {
    var g12 = b.layout === 'g12';
    var cells = b.fields.map(function (f) {
      var ok = calc.showIf(f.cond, c);
      if (!ok && !f.grey) return '';
      var x = fieldHTML(f, g12);
      return ok ? x : greyed(x);
    }).join('');
    return cells ? '<div class="grid' + (g12 ? ' g12' : '') + '">' + cells + '</div>' : '';
  }
  /* Income protection (fractured cover): the age and the insured amount down the left; on the right the instalment protector (one box for each debt with an instalment, from the Debts page: nothing is typed here)
     and, under it, household needs. A message under household needs says so when the instalments are more than the insured amount. */
  function protectorHTML(b, c) {
    var f = {}; b.fields.forEach(function (x) { f[x.id] = x; });
    var sp = calc.ipSplit(c), plain = function (n) { return util.money(n).replace(/^R /, '').replace(/\.00$/, ''); };
    var rows = sp.rows.map(function (r) {
      return '<label class="f s-calc"><span class="l"><span>' + esc(r.label) + '</span>' + (r.prov ? '<span class="rt">' + esc(r.prov) + '</span>' : '') + '</span><span class="box"><input value="' + esc(util.money(r.inst) + ' p.m.') + '" readonly tabindex="-1" autocomplete="off"><span class="st">' + badge('calc', '') + '</span></span></label>';
    }).join('');
    var hh = fieldHTML(f.ip_hh, false);
    if (sp.over) hh = hh.replace('class="f ', 'class="f neg ');
    var quote = sp.insured != null && !sp.over ? '<div class="ipcheck">In the quote: <b>' + sp.rows.map(function (r) { return plain(r.inst); }).concat([plain(sp.rest)]).join(' + ') + ' = ' + plain(sp.insured) + ' p.m.</b> (the instalments to the bank, then household needs, add up to the insured amount)</div>' : '';
    return '<div class="ipgrid"><div class="ipleft">' + fieldHTML(f.ip_age, false) + fieldHTML(f.ip_amt, false) + '</div>' +
      '<div class="protector"><h5>Instalment Protector</h5>' + (rows ? '<div class="prows">' + rows + '</div><div class="sumline"><span>Total instalments</span><b>' + esc(util.money(sp.total)) + ' p.m.</b></div>' : '<p class="help">No debt with an instalment on the Debts page yet.</p>') +
      '<div class="household"><h5>Household needs</h5>' + hh + '</div></div></div>' + quote +
      gridHTML({ layout: b.layout, fields: b.fields.filter(function (x) { return !/^ip_(?:age|amt|hh)$/.test(x.id); }) }, c);
  }
  /* The top of the BrightRock Risk Calculation page: which BrightRock Fractured quotes were asked for on Client priorities and quotes needed. */
  function stripHTML() {
    var a = FF.actions.brightRockAsked(state);
    return '<div class="brstrip"><b>Asked for on Client priorities and quotes needed</b><span>' + (a.length ? 'BrightRock Fractured: ' + esc(a.join(', ')) : 'No BrightRock Fractured quote asked for yet.') + '</span><span class="grow"></span><button type="button" class="btn ghost" data-sec="prio">&larr; Back to Client priorities and quotes needed</button></div>';
  }
  function blockHTML(b, sec, c, notitle) {
    if (b.strip) return stripHTML();
    if (b.part) return '<div class="partband"><h3>' + esc(b.part) + '</h3>' + (b.sub ? '<span class="sub">' + esc(b.sub) + '</span>' : '') + '</div>';
    var ok = calc.showIf(b.cond, c), own = calc.showIf('own' in b ? b.own : b.cond, c), h = '';
    if (!ok && !b.grey && !('own' in b && own)) return '<div class="block-title">' + esc(b.title) + '</div><div class="note">' + esc(b.condMsg) + '</div>';      // a block whose rule is not met says so and goes away (unless it is only its area that is off)
    if (b.title && !notitle) h += '<div class="block-title">' + esc(b.title) + '</div>';
    if (!ok && !own && b.condMsg && !b.nomsg) h += '<div class="note">' + esc(b.condMsg) + '</div>';
    var inner = '';
    if (b.help) inner += '<p class="help">' + esc(b.help) + '</p>';
    if (b.protector) inner += protectorHTML(b, c); else if (b.actions) inner += paHTML(b, c); else if (b.fields) inner += gridHTML(b, c);
    if (b.list) { if (!b.title && !notitle && schema.lists[b.list].title !== sec.title) inner += '<div class="block-title">' + esc(schema.lists[b.list].title) + '</div>'; inner += listHTML(b.list); }
    return h + (ok ? inner : '<div class="off" inert>' + inner + '</div>');
  }
  /* The Life area's quotes: BrightRock Fractured and Standard side by side, the same three rows (FNA, Shortfall, Reduced) in each. A row whose rule is not met in both (no group, for the shortfall) says so once across the two. */
  function lanesHTML(blocks, sec, c) {
    var pick = function (lane, row) { return blocks.filter(function (b) { return b.lane === lane && b.row === row; })[0]; };
    var gone = function (x) { return x && x.condMsg && !calc.showIf(x.cond, c) && !calc.showIf('own' in x ? x.own : x.cond, c); };
    var h = '<div class="lanes"><div class="lh br"><b>BrightRock: Fractured</b><span>built on the BrightRock Risk Calculation page</span><button type="button" class="btn ghost" data-sec="calc">Open BrightRock Risk Calculation &rarr;</button></div>' +
      '<div class="lh std"><b>Standard</b><span>every other insurer (BrightRock too, when it is a standard quote)</span></div>';
    ['fna', 'sf', 'red'].forEach(function (row) {
      var a = pick('br', row), b = pick('std', row);
      if (gone(a) && gone(b)) { h += '<div class="lc both"><div class="block-title">' + esc(a.title) + '</div><div class="note">' + esc(a.condMsg) + '</div></div>'; return; }
      h += '<div class="lc br">' + blockHTML(a, sec, c) + '</div><div class="lc std">' + blockHTML(b, sec, c) + '</div>';
    });
    return h + '</div>';
  }
  /* What to ask for in a standard quote: one table, a row for each cover (Life cover, Permanent disability, Income protection, Dread disease). The boxes are the boxes of the four standard blocks, under their own ids. */
  var SQ = { lc: { amt: 'lc_sa', term: ['lc_term', 'lc_termv'], aci: ['lc_aci', 'lc_aciv'], abi: 'lc_abiv', cmt: 'lc_cmt', name: 'Life cover' },
    pd: { amt: 'pd_sa', term: ['pd_term', 'pd_termv'], aci: ['pd_aci', 'pd_aciv'], abi: 'pd_abiv', cmt: 'pd_cmt', name: 'Permanent disability' },
    ip: { amt: 'ips_amt', term: ['ips_age'], aci: ['ips_aci', 'ips_aciv'], abi: 'ips_abiv', wait: 'ips_wait', cmt: 'ips_cmt', name: 'Income protection / sickness benefit' },
    dd: { amt: 'dds_cover', term: ['dds_term', 'dds_termv'], aci: ['dds_aci', 'dds_aciv'], abi: 'dds_abiv', cmt: 'dds_cmt', name: 'Dread disease' } };
  var sqdOpen = null;
  function sqCell(id) {
    var f = schema.fieldsById[id], st = state.f[id].st, attrs = 'data-f="' + id + '" aria-label="' + esc(f.l) + '"';
    return '<span class="f s-' + st + '" data-field="' + id + '"><span class="box">' + control(attrs, f.t === 'area' ? { t: 'txt' } : f, state.f[id].v, false) + '</span><span class="warn" data-warn="' + id + '" hidden></span></span>';
  }
  function sqdHTML(blocks, c) {
    var on = blocks.every(function (b) { return calc.showIf(b.cond, c); }), asked = state.f.fna_req.v === 'Request a quote' || state.f.sf_req.v === 'Request a quote' || state.l.redq.some(function (r) { return r.d.req === 'Request a quote'; });
    var open = sqdOpen === null ? asked : sqdOpen, r = blocks.map(function (b) {
      var m = SQ[b.sqd];
      return '<tr><th scope="row">' + esc(m.name) + '</th><td>' + sqCell(m.amt) + '</td><td><div class="pair">' + m.term.map(sqCell).join('') + '</div></td><td><div class="pair">' + m.aci.map(sqCell).join('') + '</div></td><td>' + sqCell(m.abi) + '</td><td>' + (m.wait ? sqCell(m.wait) : '<span class="dash">-</span>') + '</td><td>' + sqCell(m.cmt) + '</td></tr>';
    }).join('');
    return '<details class="sqd"' + (open ? ' open' : '') + '><summary>Standard quote details: what to quote</summary><div class="' + (on ? '' : 'off') + '"' + (on ? '' : ' inert') + '><div class="tablewrap"><table class="sqt"><thead><tr><th>Cover</th><th>Amount (R)</th><th>Term / age</th><th>ACI</th><th>ABI</th><th>Waiting</th><th>Comments</th></tr></thead><tbody>' + r + '</tbody></table></div></div></details>';
  }
  function spanned(f, n, extra) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = f[k]; }); o.s = n; Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; }); return o; }
  /* One area of the Client priorities and quotes needed page: the client's decision and the comments box (with, in a short area, its referral or request in the same row), a short summary beside them, and below the quotes that belong to it.
     The whole area takes a green haze when it is a priority, a red haze when it is not (its quotes are then greyed out; the comments box stays) and a yellow haze while the client is not sure or must check the budget (the quotes stay open).
     Business assurance is one grey line until the client is a business owner. */
  function panelHTML(sec, id) {
    var P = schema.panelsById[id], c = ctx(), v = P.dec ? state.f[P.dec].v : '', cls = v === schema.PRIORITY ? ' p1' : v === schema.NOT_PRIORITY ? ' p2' : (v === schema.UNSURE || v === schema.BUDGET) ? ' p3' : '';
    var applies = calc.showIf(P.cond, c);
    var chip = !P.dec ? (applies ? 'Business owner' : 'Not applicable') : cls === ' p1' ? 'Priority' : cls === ' p2' ? 'Not a priority' : cls === ' p3' ? (v === schema.BUDGET ? 'Needs to check budget' : 'Needs to think about it') : 'Not yet discussed';
    var blocks = sec.blocks.filter(function (b) { return b.pri === id; }), head = blocks.filter(function (b) { return b.head; })[0], rest = blocks.filter(function (b) { return !b.head; });
    var h = '<section class="prio' + cls + (applies ? '' : ' na') + '" data-prio="' + id + '"><header><h3>' + esc(P.title) + '</h3><span class="sub">' + esc(applies ? P.sub : P.condMsg) + '</span>' +
      (applies ? '' : '<button type="button" class="btn ghost" data-sec="occ">Go to Occupation</button>') + '<span class="chip">' + chip + '</span></header>';
    if (!applies) return h + '</section>';
    var hb = head;
    if (head && P.inline) {                                                                          // a short area: decision, referral or request and comments in one row
      var inl = []; rest.forEach(function (b) { (b.fields || []).forEach(function (f) { inl.push(spanned(f, 4, { cond: b.cond, grey: 1 })); }); });
      hb = { pri: id, head: 1, layout: 'g12', fields: [spanned(head.fields[0], 4)].concat(inl, [spanned(head.fields[1], 4)]) };       // the decision, the referral or request, the comments
    }
    h += '<div class="pbody' + (rest.some(function (b) { return b.lane; }) ? ' wideq' : '') + '"><div class="pl">' + (hb ? gridHTML(hb, c) : '');
    if (cls === ' p2') h += '<div class="note warn">The client said this is not a priority. The quote boxes are switched off. Use the comments box for the reason or your instructions.</div>';
    h += '</div>' + (P.sum ? '<div class="sum" data-sum="' + id + '">' + sumInner(id) + '</div>' : '');
    if (!P.inline && rest.length) {
      var doneL = false, doneS = false;
      h += '<div class="area' + (rest.length === 1 ? ' flat' : '') + '">';
      rest.forEach(function (b) {
        if (b.lane) { if (!doneL) { doneL = true; h += lanesHTML(rest.filter(function (x) { return x.lane; }), sec, c); } return; }
        if (b.sqd) { if (!doneS) { doneS = true; h += sqdHTML(rest.filter(function (x) { return x.sqd; }), c); } return; }
        h += blockHTML(b, sec, c, rest.length === 1);
      });
      h += '</div>';
    }
    return h + '</div></section>';
  }
  function sectionHTML(sec) {
    var c = ctx();
    var h = '<header><h2>' + esc(sec.title) + '</h2>' + (sec.adv ? '' : '<span class="tier">Client answers</span>') + '</header>';
    if (!calc.showIf(sec.cond, c)) return h + '<div class="note">' + esc(sec.condMsg) + '</div>';
    if (sec.intro) h += '<p class="help">' + esc(sec.intro) + '</p>';
    var seen = {}, cols = sec.layout === 'admin', pair = '';
    var flush = function () { if (pair) { h += '<div class="halves">' + pair + '</div>'; pair = ''; } };           // blocks marked half sit two to a row
    if (cols) h += '<div class="admin">';
    sec.blocks.forEach(function (b) {
      if (b.pri) { if (!seen[b.pri]) { seen[b.pri] = 1; h += panelHTML(sec, b.pri); } return; }
      if (b.half) { pair += '<div class="half">' + blockHTML(b, sec, c) + '</div>'; return; }
      flush();
      h += cols ? '<div class="admcol">' + blockHTML(b, sec, c) + '</div>' : blockHTML(b, sec, c);
    });
    flush();
    return h + (cols ? '</div>' : '');
  }

  /* ---------- the action points on the Admin page ----------
     The box holds the points for the personal assistant. They are written from the rest of the form (actions.js): at once as plain points, then by Claude when it can be reached, for as long as the adviser has not typed in the box.
     Typing in it makes the points the adviser's own: they no longer follow the form, until Refresh writes them again (a second tap, as that replaces what was typed). */
  var paBusy = false, paTimer = null, paSure = false;
  function paStatus() {
    var pa = state.pa || {}, ready = vmAIReady();
    if (paBusy) return 'Claude is writing these points…';
    if (pa.edited) return 'Edited by you: these points no longer follow the form. Refresh writes them again.';
    if (pa.by === 'claude') return 'Written by Claude' + (pa.at ? ', ' + new Date(pa.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') + ', from the form. They follow the form until you type in the box.';
    return ready ? 'Plain points from the form. Refresh for Claude to write them.' : 'Plain points from the form. Claude writes these when the Anthropic key is in Settings.';
  }
  function paHTML(b, c) {
    var f = b.fields[0];
    return fieldHTML(f, false) + '<div class="apstatus"><span id="paStatus">' + esc(paStatus()) + '</span><button type="button" class="link-btn" id="paRefresh"' + (paBusy ? ' disabled' : '') + '>' + (paSure ? 'Replace what I typed' : 'Refresh') + '</button></div>';
  }
  function paPaint() {
    var st = document.getElementById('paStatus'), ta = document.querySelector('[data-f="pa_actions"]'), bt = document.getElementById('paRefresh');
    if (st) st.textContent = paStatus(); if (bt) { bt.disabled = paBusy; bt.textContent = paSure ? 'Replace what I typed' : 'Refresh'; }
    if (ta && ta.value !== state.f.pa_actions.v && !(document.activeElement === ta && state.pa.edited)) ta.value = state.f.pa_actions.v;     // never over what is being typed
  }
  function paWrite(lines, key, by) {
    store.setField(state, 'pa_actions', FF.actions.text(lines)); store.setPa(state, key, by);
    touch(); paPaint();
  }
  /* manual: the Refresh button. Otherwise only while the points are the form's own (not typed over) and the form has changed since they were written. */
  function paRefresh(manual) {
    if (!FF.actions) return;
    var f = FF.actions.facts(state), key = FF.actions.key(f);
    if (!manual && (state.pa.edited || (state.pa.key === key && state.f.pa_actions.v))) return;
    paWrite(FF.actions.local(state), key, 'form');
    if (!VAI || !VAI.actionPoints || !vmAIReady()) { if (manual) toast('Claude writes these points: put the Anthropic key in Settings. Plain points were written from the form.'); return; }
    paBusy = true; paPaint();
    var set = FF.lookup.getSettings();
    VAI.actionPoints({ apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, facts: f, fetchImpl: meteredFetch }).then(function (lines) {
      paBusy = false;
      if (lines.length && (manual || (!state.pa.edited && state.pa.key === key))) paWrite(lines, key, 'claude'); else paPaint();
    }, function (e) { paBusy = false; paPaint(); if (manual) toast('Claude could not write the points (' + ((e && e.message) || 'no answer') + '). Plain points were written from the form.'); });
  }
  function paSoon() { clearTimeout(paTimer); paTimer = setTimeout(function () { if (cur === 'admin') paRefresh(false); }, 600); }

  /* ---------- the summaries on the Client priorities page ---------- */
  var sumBusy = {}, sumTimer = null;
  function sumInner(id) {
    var P = schema.panelsById[id], r = FF.summary.linesFor(state, id), busy = sumBusy[id], ready = vmAIReady();
    var when = r.by === 'claude' ? 'Written by Claude' + (r.at ? ', ' + new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
      : busy ? 'Claude is writing this…' : ready ? 'Plain points from the form. Press Refresh for Claude to write them.' : 'Plain points from the form. Claude writes these when the Anthropic key is in Settings.';
    return '<div class="sh">Summary<span class="info" tabindex="0" title="' + esc('Drawn from: ' + P.src + '. ' + when) + '">i</span><button type="button" class="link-btn" data-sumrefresh="' + id + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Refreshing…' : 'Refresh') + '</button></div>' +
      '<ul>' + (r.lines.length ? r.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') : '<li class="none">Nothing recorded yet</li>') + '</ul>';
  }
  function sumPaint(ids) { ids.forEach(function (id) { var el = document.querySelector('[data-sum="' + id + '"]'); if (el) el.innerHTML = sumInner(id); }); }
  /* Claude writes the points for every area that has none yet or whose facts have changed (all eight in one request). manual: the Refresh button, which rewrites the area. */
  function sumRefresh(only, manual) {
    if (!VAI || !VAI.summarise || !vmAIReady()) { if (manual) toast('Claude writes these summaries: put the Anthropic key in Settings.'); return; }
    var todo = FF.summary.stale(state, only, !!manual);
    Object.keys(todo).forEach(function (id) { if (sumBusy[id]) delete todo[id]; });
    var ids = Object.keys(todo); if (!ids.length) return;
    ids.forEach(function (id) { sumBusy[id] = 1; }); sumPaint(ids);
    var set = FF.lookup.getSettings();
    VAI.summarise({ apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, areas: todo, fetchImpl: meteredFetch }).then(function (res) {
      ids.forEach(function (id) { delete sumBusy[id]; if (res[id] && res[id].length) store.setSum(state, id, res[id], todo[id].key); });
      saveDraft(); sumPaint(ids);
    }, function (e) { ids.forEach(function (id) { delete sumBusy[id]; }); sumPaint(ids); if (manual) toast('Claude could not write the summary (' + ((e && e.message) || 'no answer') + ').'); });
  }
  function sumSoon() { clearTimeout(sumTimer); sumTimer = setTimeout(function () { if (cur === 'prio') sumRefresh(null, false); }, 700); }

  /* Redrawing the section replaces its boxes, so the box the cursor is in (and anything typed there but not yet kept) is found again afterwards: an answer filled in the background does not take the cursor away. */
  function boxSelector(el) {
    if (!el || !el.dataset || !el.closest || !el.closest('#main')) return '';
    return el.dataset.f ? '[data-f="' + el.dataset.f + '"]' : el.dataset.l ? '[data-l="' + el.dataset.l + '"][data-i="' + el.dataset.i + '"][data-k="' + el.dataset.k + '"]' : '';
  }
  var drawn = '';
  function redraw() {
    renderNav();
    var sec = schema.sections.filter(function (x) { return x.id === cur; })[0], main = $('#main');
    var ae = document.activeElement, sel = ae && ae !== document.body ? boxSelector(ae) : '', field = sel && /^(?:INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.type !== 'checkbox';
    var text = field && ae.tagName !== 'SELECT', keep = field ? { sel: sel, was: ae.defaultValue, typed: text && ae.value !== ae.defaultValue ? ae.value : null, a: text ? ae.selectionStart : null, b: text ? ae.selectionEnd : null } : null;
    main.className = 'main' + (sec.roomy ? ' roomy' : '') + (sec.fit ? ' fit' : '') + (sec.adv ? ' priorities' : '');
    main.innerHTML = sectionHTML(sec);
    if (cur === 'prio' && drawn !== 'prio') sumSoon();                                       // Claude writes the summaries when the page is opened
    if (cur === 'admin') paSoon();                                                           // and the action points, while the box is not the adviser's own
    drawn = cur;
    refreshChrome(); refreshWarnings();
    if (vm.on) vmMarkWait();
    var back = keep && document.querySelector(keep.sel);
    if (back && document.activeElement !== back && !back.disabled && !back.readOnly) {
      if (keep.typed != null && back.defaultValue === keep.was) back.value = keep.typed;           // what was being typed stays, unless the box itself was just filled
      back.focus({ preventScroll: true });
      try { if (back.selectionStart != null && keep.a != null) back.setSelectionRange(keep.a, keep.b); } catch (e) { /* a box with no caret */ }
    }
  }
  function renderNav() {
    var nav = '<div class="sep">Client answers</div>';
    schema.sections.forEach(function (s) {
      var c = store.counts(state, s);
      nav += '<button type="button" data-sec="' + s.id + '"' + (s.id === cur ? ' aria-current="true"' : '') + '><span>' + esc(s.title) + (vm.done[s.id] ? ' <span class="ck" title="Finished: said in the conversation">✓</span>' : '') + '</span><span class="n" data-count="' + s.id + '">' + (s.adv ? '' : c.fill + '/' + c.tot) + '</span></button>';
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
    var tax = FF.tax.taxYearFor(calc.meetingDate(ctx())), ver = $('#verLine');
    refreshKey(); refreshCost();
    if ((state.unplaced && state.unplaced.length) || document.getElementById('convo')) convoSoon();
    if (ver) ver.textContent = 'Version ' + schema.version + ', ' + schema.released + ' · Tax tables ' + tax;
  }
  /* The top bar counts down to the day the Anthropic key stops working. */
  function refreshKey() {
    var el = $('#keyState'), st = FF.lookup.keyStatus(FF.lookup.getSettings());
    el.textContent = st.text; el.hidden = !st.text;
    el.style.color = st.level === 'expired' ? 'var(--bad)' : (st.level === 'soon' || st.level === 'unset') ? 'var(--warn)' : '';
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
  /* The tick-box dropdown opens and closes with its button, and closes on a tap anywhere else. */
  function msClose() { if (msOpen) { msOpen = ''; msFree = {}; redraw(); } }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-msb]');
    if (b) { var id = b.dataset.msb; msOpen = msOpen === id ? '' : id; msFree = {}; redraw(); return; }
    if (msOpen && !(e.composedPath ? e.composedPath() : []).some(function (n) { return n.classList && n.classList.contains('ms'); })) msClose();       // the path was taken before the list was redrawn
    if (e.target.id === 'paRefresh') {
      if (state.pa.edited && !paSure) { paSure = true; paPaint(); setTimeout(function () { if (paSure) { paSure = false; paPaint(); } }, 4000); return; }
      paSure = false; paRefresh(true);
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') msClose(); });
  document.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('sqd')) sqdOpen = e.target.open; }, true);
  document.addEventListener('input', function (e) {                                                       // the first key typed in the action points makes them the adviser's own
    var t = e.target; if (!t.dataset || t.dataset.f !== 'pa_actions') return;
    state.pa.edited = t.value !== ''; paSure = false; var st = document.getElementById('paStatus'); if (st) st.textContent = paStatus();
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ck) return;
    var at = t.dataset.ck.lastIndexOf('|'), id = t.dataset.ck.slice(0, at), which = t.dataset.ck.slice(at + 1), def = schema.fieldsById[id], have = msParts(state.f[id].v), val;
    if (which === 'na') { if (t.checked) { val = ''; msFree[id] = false; } else { msFree[id] = true; val = state.f[id].v; } }
    else { msToggle(id, which.charAt(0) === 'x' ? msExtra(def, have)[+which.slice(1)] : def.o[+which], t.checked); return; }
    store.setField(state, id, val); vm.noSweep[id] = 1; touch(); redraw();
  });
  /* Tick or untick one choice of a tick-box list (by hand, or from the list the voice mode opens). */
  function msToggle(id, o, on) {
    var def = schema.fieldsById[id], have = msParts(state.f[id].v), i = have.indexOf(o);
    if (on && i < 0) have.push(o); else if (!on && i >= 0) have.splice(i, 1);
    var val = def.o.filter(function (x) { return have.indexOf(x) >= 0; }).concat(msExtra(def, have)).join('; '); msFree[id] = !val;                  // everything unticked: the list stays open for another choice
    store.setField(state, id, val); vm.noSweep[id] = 1; touch(); redraw();
  }
  /* The calendar button: a hidden date picker opens on the date already typed (or today); the date chosen is written into the text box as day/month/year and saved like a typed one. */
  function openCalendar(id) {
    var pick = document.querySelector('[data-calpick="' + id + '"]'), box = document.querySelector('[data-f="' + id + '"]'); if (!pick || !box) return;
    var d = util.parseDate(box.value) || util.parseDate(util.isoToday());
    pick.value = d.y + '-' + (d.m < 10 ? '0' : '') + d.m + '-' + (d.d < 10 ? '0' : '') + d.d;
    try { pick.showPicker(); } catch (e) { box.focus(); toast('Your browser cannot open the calendar here. Type the date as day/month/year.'); }
  }
  function calendarPicked(pick) {
    var box = document.querySelector('[data-f="' + pick.dataset.calpick + '"]'), d = util.parseDate(pick.value); if (!box || !d) return;
    box.value = util.formatDate(d);
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }
  var condIds = {};
  schema.sections.forEach(function (s) { calc.condFields(s.cond).concat([].concat.apply([], s.blocks.map(function (b) { return calc.condFields(b.cond).concat([].concat.apply([], (b.fields || []).map(function (f) { return calc.condFields(f.cond); }))); }))).forEach(function (id) { condIds[id] = 1; }); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-sec],[data-accept],[data-add],[data-del],[data-goto],[data-usedob],[data-lookup],[data-cal],[data-sumrefresh]');
    if (!t) return;
    if (t.dataset.sumrefresh) { sumRefresh([t.dataset.sumrefresh], true); return; }
    if (t.dataset.cal) { openCalendar(t.dataset.cal); return; }
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
    if (t.dataset.calpick) { calendarPicked(t); return; }
    if (t.dataset.none) {
      store.setField(state, t.dataset.none, t.checked ? 'None' : '');
      var wrapN = t.closest('.f'); if (wrapN) wrapN.outerHTML = fieldHTML(schema.fieldsById[t.dataset.none], !!document.querySelector('.g12'));
      touch(); refreshLive();
      if (!t.checked) { var back = document.querySelector('[data-f="' + t.dataset.none + '"]'); if (back) back.focus(); }
      return;
    }
    if (t.dataset.f) {
      var def = schema.fieldsById[t.dataset.f], val = t.value.trim() === '' ? '' : t.value;
      if (val === '') vm.noSweep[t.dataset.f] = 1;                                  // cleared by hand: the catch-up check does not fill it again
      if (t.dataset.f === 'idno' && val) { var clashMsg = idClashMsg(val, { id: 'idno' }); if (clashMsg) { t.value = state.f.idno.v; toast(clashMsg); return; } }     // the box goes back to what it held
      if (def && def.money) { val = util.formatMoney(val); t.value = val; }
      if (def && def.date) { var pd = util.parseDate(val); if (pd) { val = util.formatDate(pd); t.value = val; } }
      if (t.dataset.f === 'pa_actions') { state.pa.edited = val !== ''; paSure = false; }                  // typed over: the points are the adviser's own until Refresh
      store.setField(state, t.dataset.f, val);
      var dobSet = (t.dataset.f === 'idno' || t.dataset.f === 'idtype') && autoDob();        // the date of birth follows the ID number (and the ID type going back to ID)
      var sexSet = (t.dataset.f === 'idno' || t.dataset.f === 'idtype') && autoGender();      // and so does an empty gender box
      var wrap = t.closest('.f'); if (wrap) { wrap.className = wrap.className.replace(/\bs-\w+/, 's-' + state.f[t.dataset.f].st); var b = wrap.querySelector('.st'); if (b) b.innerHTML = badge(state.f[t.dataset.f].st, 'f:' + t.dataset.f); }
      touch();
      if (t.dataset.f === 'employer' || t.dataset.f === 'biz_name') autoCompanyLookup(t.dataset.f);
      if (PROFILE_SRC.indexOf(t.dataset.f) >= 0) autoProfileLookup();
      if (dobSet) paintField('dob');
      if (sexSet) paintField('gender');
      if (condIds[t.dataset.f]) { redraw(); var again = document.querySelector('[data-f="' + t.dataset.f + '"]'); if (again) again.focus(); if ((state.unplaced || []).length && vmRetryUnplaced) vmRetryUnplaced(); } else refreshLive();
    } else if (t.dataset.l) {
      var key = t.dataset.l, i = +t.dataset.i, k = t.dataset.k, col = schema.lists[key].cols.filter(function (c) { return c.k === k; })[0], row0 = state.l[key][i];
      var v2 = t.value;
      if (v2.trim() === '') vm.noSweep[key + ':' + i + ':' + k] = 1;
      if (key === 'shares' && k === 'id' && v2.trim()) { var clashMsg2 = idClashMsg(v2, { list: 'shares', i: i }); if (clashMsg2) { t.value = row0.d.id; toast(clashMsg2); return; } }
      if (col && col.money) { v2 = util.formatMoney(v2); t.value = v2; }
      if (col && col.date) { var pd2 = util.parseDate(v2); if (pd2) { v2 = util.formatDate(pd2); t.value = v2; } }
      /* A child's education stage follows the date of birth until it is set by hand. */
      var autoStage = key === 'kids' && k === 'dob' && (row0.d.stage === '' || row0.d.stage === FF.calc.rowCalc('stage', row0, ctx()));
      store.setCell(state, key, i, k, v2);
      if (key === 'kids' && k === 'name' && /\s/.test(v2.trim())) {                          // "Anna Kuiper" typed in the Name box: the surname goes to its own box
        kidsNameFix(row0, true);
        var sn = document.querySelector('[data-l="kids"][data-i="' + i + '"][data-k="sname"]'); if (sn) sn.value = row0.d.sname || ''; t.value = row0.d.name;
      }
      if (autoStage) {
        row0.d.stage = FF.calc.rowCalc('stage', row0, ctx());
        var sel = document.querySelector('[data-l="kids"][data-i="' + i + '"][data-k="stage"]'); if (sel) sel.value = row0.d.stage;
      }
      var row = t.closest('.rowcard, tr'); if (row) row.className = row.className.replace(/\bs-(heard|verify)\b/, 's-confirmed');
      touch(); refreshLive();
    }
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
    if (set.apiKey) return FF.lookup.run({ apiKey: set.apiKey, model: set.model, name: job.name, kind: job.kind, org: job.org, role: job.role, fetchImpl: meteredFetch }).then(function (t) { return { text: t, st: job.kind === 'person' ? 'verify' : 'heard' }; });
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
    if (!FF.autoProfile) return;                                       // off: every change of a name, employer or occupation started a web search of its own, and the searches add up (tap the LinkedIn search button when one is wanted)
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
    $('#setOpenaiKey').value = set.openaiKey;
    $('#setOpenaiModel').innerHTML = FF.lookup.TRANSCRIBE_MODELS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === set.openaiModel ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
    $('#setVoiceModel').innerHTML = FF.lookup.VOICE_MODELS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === set.voiceModel ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
    $('#setModel').innerHTML = FF.lookup.MODELS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === set.model ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
    $('#setResult').textContent = '';
    if ($('#setSpeech')) { var sp = speechPrefs(); speechChoices(); $('#setSpeech').value = sp.engine; $('#setWhisper').value = sp.model; if ($('#setCall')) $('#setCall').value = sp.call ? '1' : '0'; }
    creditSettings(); var left = creditLeft(); $('#setCredit').value = left == null ? '' : left.toFixed(2);
    quickSettings(); $('#setQuick').value = vmQuickOn() ? '1' : '0';
    sweepSettings(); $('#setSweep').value = vmSweepMode();
    shareSettings(); $('#setShare').value = vmShareOn() ? '1' : '0';
    dlg.showModal();
  }
  $('#btnSettings').addEventListener('click', openSettings);
  $('#keyState').addEventListener('click', openSettings);
  $('#keyState').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSettings(); } });
  $('#setCancel').addEventListener('click', function () { $('#settings').close(); });
  $('#setSave').addEventListener('click', function () {
    FF.lookup.saveSettings({ apiKey: $('#setKey').value, model: $('#setModel').value, voiceModel: $('#setVoiceModel').value, expires: $('#setExpires').value, openaiKey: $('#setOpenaiKey').value, openaiModel: $('#setOpenaiModel').value });
    if ($('#setSpeech')) { try { localStorage.setItem(SPEECH_KEY, JSON.stringify({ engine: $('#setSpeech').value, model: $('#setWhisper').value, call: !!$('#setCall') && $('#setCall').value === '1' })); } catch (e) { /* storage unavailable */ } }
    saveCreditBox();
    if ($('#setQuick')) { try { localStorage.setItem(QUICK_KEY, $('#setQuick').value); } catch (e) { /* storage unavailable */ } }
    if ($('#setSweep')) { try { localStorage.setItem(SWEEP_KEY, $('#setSweep').value); } catch (e) { /* storage unavailable */ } }
    if ($('#setShare')) { try { localStorage.setItem(SHARE_KEY, $('#setShare').value); } catch (e) { /* storage unavailable */ } vmShareApply(); convoRender(); }
    $('#settings').close(); refreshKey(); refreshCost(); toast('Settings saved.');
  });
  $('#setTest').addEventListener('click', function () {
    var out = $('#setResult'); out.textContent = 'Testing…';
    FF.lookup.run({ apiKey: $('#setKey').value.trim(), model: $('#setModel').value, name: 'Old Mutual', kind: 'company', fetchImpl: meteredFetch }).then(function (t) { out.textContent = 'Working. Example: ' + t; }, function (e) { out.textContent = e.message; });
  });

  /* ---------- what Claude costs: the running total for this fact find, and what is left of the credit ---------- */
  /* Every answer from Claude says how many tokens it used; the page prices them (FF.lookup.costOf, from the published prices) and keeps the total with the fact find.
     What is left comes from the balance typed in Settings, less what has been used since: an estimate, as the Console alone knows the real figure. */
  var CREDIT_KEY = 'wr-fact-find-credit', lowWarned = 0;
  function loadCredit() {
    try { var c = JSON.parse(localStorage.getItem(CREDIT_KEY) || '{}'); return { balance: c.balance != null && isFinite(+c.balance) ? +c.balance : null, spent: +c.spent > 0 ? +c.spent : 0 }; }
    catch (e) { return { balance: null, spent: 0 }; }
  }
  var credit = loadCredit();
  function saveCredit() { try { localStorage.setItem(CREDIT_KEY, JSON.stringify(credit)); } catch (e) { /* storage unavailable */ } }
  function creditLeft() { return credit.balance == null ? null : credit.balance - credit.spent; }
  function usd(x) { return 'US$' + (x < 0.01 ? x.toFixed(4) : x < 0.1 ? x.toFixed(3) : x.toFixed(2)); }
  /* fetch that notes what each answer cost. Used for every call to Claude. */
  function meteredFetch(url, init) {
    return window.fetch(url, init).then(function (res) {
      try { var model = JSON.parse(init.body).model; res.clone().json().then(function (b) { if (b && b.usage) spendAdd(model, b.usage); }, function () { /* not JSON: nothing to count */ }); } catch (e) { /* nothing to count */ }
      return res;
    });
  }
  function spendAdd(model, usage) {
    if (!state.claude) state.claude = store.blankTally();
    credit.spent += FF.lookup.addUsage(state.claude, model, usage); saveCredit(); saveDraft(); refreshCost();
    var left = creditLeft();
    if (left != null && left < 1 && lowWarned < 2) { lowWarned = 2; toast('Claude credit is nearly finished: about ' + usd(left) + ' left. Top it up in the Anthropic Console.'); }
    else if (left != null && left < 5 && lowWarned < 1) { lowWarned = 1; toast('Claude credit is getting low: about ' + usd(left) + ' left.'); }
  }
  function costChip() {
    var el = $('#costState');
    if (el) return el;
    el = document.createElement('span'); el.id = 'costState'; el.className = 'savestate'; el.setAttribute('role', 'button'); el.tabIndex = 0; el.style.cssText = 'cursor:pointer;margin-left:12px'; el.hidden = true;
    $('#keyState').parentNode.insertBefore(el, $('#keyState').nextSibling);
    el.addEventListener('click', openSettings);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSettings(); } });
    return el;
  }
  function refreshCost() {
    var el = costChip(), t = state.claude || store.blankTally(), left = creditLeft(), tok = function (n) { return Math.round(n).toLocaleString('en-US').replace(/,/g, ' '); };
    el.hidden = !FF.lookup.getSettings().apiKey && !(t.usd > 0);
    el.textContent = 'Claude: ' + usd(t.usd) + ' this fact find' + (left != null ? ' · about ' + usd(left) + ' left' : '');
    el.title = t.calls + ' requests to Claude for this fact find: ' + tok(t.input + t.read + t.write) + ' tokens read (' + tok(t.read) + ' of them from memory, which costs a tenth or less), ' + tok(t.output) + ' written' + (t.searches ? ', ' + t.searches + ' web searches' : '') +
      '. An estimate from the published prices; the Anthropic Console has the real figure.' + (left == null ? ' Click to type the credit you have left, and it is counted down here.' : ' Click to change the credit.');
    el.style.color = left == null ? '' : left < 1 ? 'var(--bad)' : left < 5 ? 'var(--warn)' : '';
  }
  /* The "fill at once" choice is added to Settings from here too. */
  function quickSettings() {
    if ($('#setQuick') || !$('#setSpeech')) return;
    $('#setSpeech').closest('.f').insertAdjacentHTML('beforebegin',
      '<label class="f"><span class="l"><span>Fill clear answers at once</span></span><select id="setQuick"><option value="0">Off: Claude reads every line first (recommended)</option><option value="1">On: the form fills at once, then Claude checks it</option></select></label>' +
      '<p class="help">Off means Claude reads every line, with the lines before it, and decides what goes where (about a second a line). On means an answer the page itself understands with confidence (a name, a yes, a number) goes into the form straight away and Claude checks it afterwards: quicker, but the page\'s own reading can be wrong (it once filled a surname with the word "spelled").</p>');
  }
  /* The choice to let Claude see private numbers is added to Settings from here too. */
  function shareSettings() {
    var helps = Array.prototype.slice.call(document.querySelectorAll('#settings p.help'));      // two older notes in index.html no longer say what is true
    helps.forEach(function (h) {
      if (/never sent/.test(h.textContent) && /marker/.test(h.textContent)) h.textContent = 'Voice mode asks this model what was said and which box each fact belongs in. Only the last few sentences are sent, as text. ID numbers, phone numbers and email addresses stay on this computer (the model sees a marker such as [N1], and the real number is put back here) unless "Let Claude see ID, tax and phone numbers and email addresses" below is switched on.';
      if (/Chrome's own recognition is instant/.test(h.textContent)) h.textContent = 'The Listen button in the top bar uses the microphone. "On this computer" keeps the sound here: the speech model is downloaded once (Moonshine Tiny roughly 50 to 100 MB, the others more) and kept in this browser. Chrome\'s own recognition is instant and accurate, but Google hears the audio, so use it for practice talk only, never with a client. A change here applies the next time Listen is pressed.';
    });
    if ($('#setShare') || !$('#setSpeech')) return;
    $('#setSpeech').closest('.f').insertAdjacentHTML('beforebegin',
      '<label class="f"><span class="l"><span>Let Claude see ID, tax and phone numbers and email addresses</span></span><select id="setShare"><option value="0">Off: they are replaced by markers before anything is sent</option><option value="1">On: they are sent to Claude with the line</option></select></label>' +
      '<p class="help">Off keeps those details on this computer: Claude only sees a marker such as [N1], and the page fills the box itself. On sends them to Anthropic along with the line, so Claude can fill, check and correct them itself. Turn it on only when the Anthropic account behind the key in Settings is covered by the agreement your firm needs for client details (for example a business plan with a data processing addendum). Names, dates and amounts are always sent.</p>');
  }
  /* The credit box is added to Settings from here, so index.html does not change. */
  function creditSettings() {
    if ($('#setCredit')) return;
    $('#setExpires').closest('.f').insertAdjacentHTML('beforebegin',
      '<label class="f"><span class="l"><span>Credit left in the Anthropic Console (US$)</span></span><input id="setCredit" type="text" inputmode="decimal" autocomplete="off" placeholder="for example 25.00"></label>' +
      '<p class="help">Type the balance shown under Billing in the Console. The top bar then counts it down as Claude is used. It is an estimate (it does not know of anything else paid from the same credit), so type the Console\'s figure in again now and then. Leave it empty to show only the cost of this fact find.</p>');
  }
  function saveCreditBox() {
    var box = $('#setCredit'); if (!box) return;
    var raw = box.value.replace(',', '.').replace(/[^\d.]/g, ''), left = creditLeft();
    if (raw === '') credit = { balance: null, spent: 0 };
    else if (isFinite(+raw) && (left == null || Math.abs(+raw - left) >= 0.005)) credit = { balance: +raw, spent: 0 };      // a new figure from the Console starts the count again; the same figure leaves it running
    saveCredit(); lowWarned = 0;
  }

  /* ---------- voice mode ---------- */
  /* Voice mode follows the conversation. The form is the only display: the section heading glows red-amber when a topic is
     opened, the box glows red-amber when the adviser's question points at it, and it glows green for a moment once the
     client's answer is in or confirmed. Simple wording is understood on this computer; looser wording goes to Claude (voice-ai.js).
     Whatever listens calls FF.app.voiceHear(text, who), who being 'me' (the adviser) or 'client'. Typing works as always when voice is off. */
  var V = FF.voice, VAI = FF.voiceAI, vidx = V.buildIndex(schema);
  try { if (VAI && VAI.setShare) VAI.setShare(localStorage.getItem('wr-fact-find-share') === '1'); } catch (e) { /* storage unavailable: sharing stays off */ }
  var vm = { on: false, done: {}, target: null, answered: false, secGlow: false, noteMode: null, rowCur: {}, undo: [], recent: [], flashes: {}, queue: Promise.resolve(), slow: 0, epoch: 0, busy: 0, seq: 0, moveSeq: 0, calls: 0, laneTarget: null, unplacedSeen: {}, noSweep: {}, sweeping: false, sweepNext: [], sweepSecs: {}, sweepT: 0, secAt: {}, sweptAll: 0, lastFail: 0, wipe: null, digits: null, run: null, erun: null, eann: null, paused: false, pointed: null, lastNum: null };
  /* ---------- "Live Client Conversation": a text box in the right-hand pane under Checks, kept in view while the page scrolls. The lines heard, oldest at the top and the latest at the bottom, each with what was done on the form because of it. ---------- */
  var vmCur = null;                                              // the line being dealt with now, so what is done on the form is listed under it
  var cv = { rows: [], all: [], live: '' }, convoT = 0;
  function vmLog(s) { if (vmCur) { vmCur.did.push(s); convoSoon(); } }
  /* Lines are put on the form in the order they were said, but the highlight follows the talk as it happens: when a question is heard, the box it is about is marked at once (vmPointNow), before the answers
     to the lines before it have come back from Claude. Such an earlier line then fills its box in the background and leaves the highlight alone (it is "late"). */
  var vmQuiet = false;                                          // true while an action of a late line is done
  function vmLate() { return !!(vmCur && vmCur.seq != null && vmCur.seq < vm.moveSeq); }
  function vmMoved() { if (vmCur && vmCur.seq != null && vmCur.seq > vm.moveSeq) vm.moveSeq = vmCur.seq; }
  function cvAdd(entry) {  // the box shows the latest 200 lines; the saved log keeps the whole session
    cv.rows.push(entry); if (cv.rows.length > 200) cv.rows.shift();
    cv.all.push(entry); if (cv.all.length > 5000) cv.all.shift();
  }
  /* What the microphone side did (listening on, speech heard, recognition ended or restarted, an error): always in the saved log, and in the box too when it matters, so a gap in the conversation can be explained. */
  function vmEngineLog(name, detail, show) {
    var t = '(listening) ' + name + (detail ? ': ' + detail : ''), entry = { who: 'engine', text: t, shown: t, at: Date.now(), did: [], done: true, m: null, engine: true };
    cv.all.push(entry); if (cv.all.length > 5000) cv.all.shift();
    if (show) { cv.rows.push(entry); if (cv.rows.length > 200) cv.rows.shift(); convoSoon(); }
  }
  function convoSoon() { if (!convoT) convoT = setTimeout(function () { convoT = 0; convoRender(); }, 30); }
  function convoCard() {
    var c = document.getElementById('convo'), side = document.querySelector('.side');
    if (c || !side) return c;
    var st = document.createElement('style');
    st.textContent = '#convo{border-color:var(--brand);position:sticky;top:12px;z-index:5;max-height:calc(100vh - 24px);display:flex;flex-direction:column}#convo h3{flex:none}' +
      '#convo .cv-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 8px;flex:none;margin-bottom:6px}#convo .cv-head h3{margin-bottom:0;min-width:0}#convo .cv-head button{font-size:12px;white-space:nowrap}#convo .cv-btns{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:2px 12px;flex:0 1 auto;min-width:0}' +
      '#convo .cv-share{flex:none;font-size:12px;color:var(--muted);margin:-4px 0 6px}' +
      '#cvBox{flex:1 1 300px;min-height:120px;overflow-y:auto;border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:8px 10px}' +
      '#cvBox .cv-empty{color:var(--muted);font-size:13px}#cvBox .cv-live{font-size:15px;font-style:italic;color:var(--muted);overflow-wrap:anywhere;padding-top:6px}' +
      '.cv-row{padding:7px 0;border-top:1px solid var(--line)}.cv-row:first-child{border-top:0;padding-top:0}' +
      '.cv-top{display:flex;gap:8px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}.cv-who{font-weight:600}' +
      '.cv-adviser .cv-who{color:var(--brand)}.cv-client .cv-who{color:var(--accent)}' +
      '.cv-text{font-size:15px;line-height:1.35;color:var(--ink);overflow-wrap:anywhere}' +
      '.cv-did{font-size:12px;color:var(--muted);margin-top:2px}' +
      '#cvUnplaced{flex:none;max-height:190px;overflow-y:auto;border:1px solid var(--warn);background:var(--surface);border-radius:6px;padding:6px 10px;margin-bottom:8px}' +
      '.cv-unp-head{font-size:11px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;color:var(--warn)}.cv-unp{padding:6px 0;border-top:1px solid var(--line)}.cv-unp:first-of-type{border-top:0}' +
      '.cv-unp-text{font-size:14px;line-height:1.3;overflow-wrap:anywhere}.cv-unp-why{font-size:12px;color:var(--muted)}.cv-unp-btns{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:3px}.cv-unp-btns button{font-size:12px}' +
      '.cv-sweep .cv-who{color:var(--warn)}';
    document.head.appendChild(st);
    c = document.createElement('div'); c.className = 'card'; c.id = 'convo';
    c.innerHTML = '<div class="cv-head"><h3>Live Client Conversation</h3><span class="cv-btns"><button type="button" class="link-btn" id="cvPause" hidden title="Stops reading what is said (a remark to yourself, a side conversation) until Resume. The lines still show here, marked as not read.">Pause</button><button type="button" class="link-btn" id="cvSweep" title="Reads the whole conversation again against the form and fills, in amber, any empty box whose answer was said but never reached it. What it cannot place goes to the list \'Heard but not placed\'.">Check for missed answers</button><button type="button" class="link-btn" id="cvSave" title="Saves a file of what was heard, what was sent to Claude, what Claude answered and what the form did, so a problem can be found. Numbers and email addresses are hidden in it unless Claude is allowed to see them.">Save log</button></span></div><div class="cv-share" id="cvShare" hidden>Claude sees ID, tax and phone numbers</div><div id="cvUnplaced" hidden></div><div id="cvBox" role="log" aria-live="polite" tabindex="0"></div>';
    var chk = document.getElementById('checks'), under = chk && chk.closest('.card');
    if (under) under.insertAdjacentElement('afterend', c); else side.insertBefore(c, side.firstChild);
    return c;
  }
  function convoMeta(e) {
    var s = function (ms) { return (ms / 1000).toFixed(1) + ' s'; }, bits = [];
    if (e.m && e.m.took != null) bits.push('read in ' + s(e.m.took * 1000));
    if (e.quick && e.quickMs != null) bits.push('filled in ' + s(e.quickMs));
    if (e.claudeMs != null) bits.push('Claude ' + s(e.claudeMs));
    if (e.doneAt) bits.push('on the form ' + s(e.doneAt - e.at));
    return bits.join(' · ');
  }
  function convoRender() {
    var c = convoCard(); if (!c) return;
    var sh = document.getElementById('cvShare'); sh.hidden = !vmShareOn();
    var pb = document.getElementById('cvPause'); if (pb) { pb.hidden = !vm.on; pb.textContent = vm.paused ? 'Resume' : 'Pause'; }
    var sb = document.getElementById('cvSweep'); if (sb) { sb.disabled = vm.sweeping; sb.textContent = vm.sweeping ? 'Checking…' : 'Check for missed answers'; }
    unplacedRender();
    var box = document.getElementById('cvBox'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40;   // stays on the latest line unless it has been scrolled back to read
    var html = cv.rows.map(function (e) {
      var who = e.who === 'adviser' ? 'Planner' : e.who === 'client' ? 'Client' : e.who === 'sweep' ? 'Catch-up' : '', ms = convoMeta(e),
        did = e.engine ? '' : e.did.length ? e.did.map(esc).join(' · ') + (e.done ? '' : (e.sweep ? ' · checking' : ' · Claude is checking')) : (e.done ? 'nothing to fill' : e.sweep ? 'reading the conversation again…' : 'working on it…');
      return '<div class="cv-row' + (e.who === 'adviser' ? ' cv-adviser' : e.who === 'client' ? ' cv-client' : e.who === 'sweep' ? ' cv-sweep' : '') + '"><div class="cv-top"><span class="cv-who">' + who + '</span><span>' + new Date(e.at).toTimeString().slice(0, 8) + '</span></div>' +
        '<div class="cv-text">' + esc(e.shown || e.text) + '</div><div class="cv-did">' + did + (ms ? ' <span>· ' + ms + '</span>' : '') + '</div></div>';
    }).join('');
    if (cv.live) html += '<div class="cv-live">' + esc(cv.live) + '</div>';
    if (!html) html = '<div class="cv-empty">' + (vm.on ? 'Listening. What is said appears here, with what was filled in because of it.' : 'Press Voice to start. What is said appears here, with what was filled in because of it.') + '</div>';
    box.innerHTML = html;
    if (stick) box.scrollTop = box.scrollHeight;
  }
  /* The voice log: for each line, what was heard, what Claude was shown and answered, and what the page did. A fetch that notes the request and the reply with the line being dealt with. */
  function loggedFetch(entry) {
    return function (url, init) {
      var rec = { at: new Date().toISOString() };
      try {
        var req = JSON.parse(init.body), parts = req.messages[0].content;
        rec.model = req.model;
        rec.sent = req.max_tokens === 0 ? 'warm-up' : JSON.parse(Array.isArray(parts) ? parts[1].text : parts);  // everything but the unchanging instructions and form map
      } catch (e) { rec.sent = String(init && init.body).slice(0, 2000); }
      (entry.ai = entry.ai || []).push(rec);
      return meteredFetch(url, init).then(function (res) {
        rec.status = res.status;
        res.clone().json().then(function (b) { rec.reply = (b.content || []).filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(' '); if (b.error) rec.error = b.error.message; }, function () { /* not JSON */ });
        return res;
      }, function (err) { rec.error = String(err && err.message || err); throw err; });
    };
  }
  function convoLog() {
    var set = FF.lookup.getSettings(), hide = function (t) { return vmShareOn() || !VAI ? t : VAI.scrub(t); };
    return {
      saved: new Date().toISOString(), app: { version: schema.version, released: schema.released },
      meeting: meeting.snapshot(),
      not_placed_open: (state.unplaced || []).map(function (u) { return { text: hide(u.text), why: u.why, section: u.sec }; }),
      settings: { claude_model: set.voiceModel, fill_at_once: vmQuickOn(), claude_sees_numbers: vmShareOn(), speech: speechPrefs() },
      lines: cv.all.map(function (e) {
        return { at: new Date(e.at).toISOString(), who: e.who, heard: hide(e.shown || e.text), read_as: e.text !== e.shown ? hide(e.text) : undefined, page_did: e.did.map(hide), filled_at_once: e.quick ? true : undefined, taken_back: e.changed || undefined, claude_ms: e.claudeMs, read_at_once: e.early || undefined, read_again: e.reread || undefined, pointed_when_heard: e.prov || undefined, on_form_ms: e.doneAt ? e.doneAt - e.at : undefined, speech: e.m || undefined, claude: e.ai };
      })
    };
  }
  function convoSave() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; }, stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()),
      blob = new Blob([JSON.stringify(convoLog(), null, 2)], { type: 'application/json' });
    writeFile(blob, 'fact-find-voice-log-' + stamp + '.json', 'Voice log', '.json', null, 'fact-find-voice-log', null)
      .then(function () { toast('Voice log saved.'); }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not save the log: ' + e.message); });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#cvSave')) { e.preventDefault(); convoSave(); } });
  document.addEventListener('click', function (e) { if (e.target.closest('#cvSweep')) { e.preventDefault(); vmSweep({ sec: null, from: 0, why: 'button' }); } });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#cvPause')) return;
    e.preventDefault(); vm.paused = !vm.paused; convoRender();
    toast(vm.paused ? 'Paused: nothing said is read until you press Resume.' : 'Reading what is said again.');
  });
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
    vmNotesButton();
    vmSyncPick(vm.on && vm.target && !vm.answered && !vm.noteMode ? vmEl(vm.target) : null);
    if (!vm.on) return;
    var el = vm.target && !vm.answered ? vmEl(vm.target) : (vm.secGlow ? document.querySelector('.main header h2') : null);
    if (el) el.classList.add('voice-wait');
    vmShowFlashes();
  }
  /* A dropdown (or a box with a list of choices, like Insurer) that the form is waiting on opens by itself, so the choices are in front of you while the question is being asked and answered, and closes
     when the box is filled or the form moves on. A page cannot open the browser's own list without a click, so this is a list of its own, under the box: it scrolls when it is long, a click on a choice fills
     the box like any change by hand, and a click anywhere else sends it away (until the form moves to another box). It is drawn from the same moment as the red-amber glow, so it is open exactly while the glow is on. */
  var vmPick = null, vmPickCtl = null, vmPickGone = null;
  function vmPickClose() { if (vmPick && vmPick.parentNode) vmPick.parentNode.removeChild(vmPick); vmPick = null; vmPickCtl = null; }
  function vmPickPlace() {
    if (!vmPick || !vmPickCtl) return;
    if (!document.body.contains(vmPickCtl)) { vmPickClose(); return; }
    var r = vmPickCtl.getBoundingClientRect(), vh = window.innerHeight, below = vh - r.bottom - 12, above = r.top - 12, want = Math.min(vmPick.scrollHeight, 240), up = below < Math.min(want, 150) && above > below;
    vmPick.style.display = r.bottom < 0 || r.top > vh ? 'none' : '';                                    // the box has scrolled out of view
    vmPick.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 200)) + 'px'; vmPick.style.minWidth = Math.max(r.width, 180) + 'px';
    vmPick.style.maxHeight = Math.max(90, Math.min(240, up ? above : below)) + 'px';
    if (up) { vmPick.style.top = ''; vmPick.style.bottom = (vh - r.top + 3) + 'px'; } else { vmPick.style.bottom = ''; vmPick.style.top = (r.bottom + 3) + 'px'; }
  }
  function vmPickChoices(ctl) {
    if (ctl.dataset && ctl.dataset.msb) return schema.fieldsById[ctl.dataset.msb].o.slice();
    if (ctl.tagName === 'SELECT') return [].map.call(ctl.options, function (o) { return o.value; }).filter(function (v) { return String(v).trim() !== ''; });
    var dl = ctl.getAttribute('list') && document.getElementById(ctl.getAttribute('list'));
    return dl ? [].map.call(dl.options, function (o) { return o.value; }) : [];
  }
  function vmSyncPick(el) {
    var ctl = el && el.querySelector ? el.querySelector('select, input[list]') : null, key = vm.target;
    if (!ctl && el && el.querySelector) { var mb = el.querySelector('.msb[data-msb]'); if (mb && schema.fieldsById[mb.dataset.msb] && schema.fieldsById[mb.dataset.msb].nona) ctl = mb; }       // the insurers of a standard quote: a tick-box list opens too
    if (vmPickGone && vmPickGone !== key) vmPickGone = null;
    if (!ctl || ctl.disabled || ctl.readOnly || vmPickGone === key) { vmPickClose(); return; }
    var choices = vmPickChoices(ctl);
    if (!choices.length) { vmPickClose(); return; }
    if (vmPick && vmPickCtl === ctl && document.body.contains(ctl)) { vmPickMark(); vmPickPlace(); return; }     // already open for this box
    vmPickClose();
    vmPickCtl = ctl; vmPick = document.createElement('div'); vmPick.className = 'vm-pick'; vmPick.setAttribute('role', 'listbox'); vmPick.setAttribute('aria-label', 'Choices');
    vmPick.innerHTML = choices.map(function (c) { return '<button type="button" role="option" data-v="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    document.body.appendChild(vmPick); vmPickMark(); vmPickPlace();
    var on = vmPick.querySelector('.on'); if (on) vmPick.scrollTop = Math.max(0, on.offsetTop - 40);
  }
  function vmPickMark() {
    if (!vmPick || !vmPickCtl) return;
    var ticked = vmPickCtl.dataset && vmPickCtl.dataset.msb ? msParts(state.f[vmPickCtl.dataset.msb].v) : [vmPickCtl.value];
    [].forEach.call(vmPick.querySelectorAll('button'), function (b) { b.classList.toggle('on', ticked.indexOf(b.getAttribute('data-v')) >= 0); });
  }
  document.addEventListener('mousedown', function (e) {                                                  // a click on a choice keeps the focus where it is; a click anywhere else sends the list away
    if (!vmPick) return;
    if (vmPick.contains(e.target)) { e.preventDefault(); return; }
    vmPickGone = vm.target; vmPickClose();
  });
  document.addEventListener('click', function (e) {
    var b = vmPick && e.target.closest ? e.target.closest('.vm-pick button') : null;
    if (!b || !vmPickCtl) return;
    var ctl = vmPickCtl;
    if (ctl.dataset && ctl.dataset.msb) { var id = ctl.dataset.msb, c = b.getAttribute('data-v'); msToggle(id, c, msParts(state.f[id].v).indexOf(c) < 0); return; }       // a tick-box list: the choice is ticked or unticked
    ctl.value = b.getAttribute('data-v');
    ctl.dispatchEvent(new Event('input', { bubbles: true })); ctl.dispatchEvent(new Event('change', { bubbles: true }));   // the same path as a change by hand
  });
  document.addEventListener('change', function (e) {                                                      // a box filled by hand counts as answered: the glow and the list go
    var t = e.target, key = t && t.dataset ? (t.dataset.f || (t.dataset.l ? t.dataset.l + ':' + t.dataset.i + ':' + t.dataset.k : '')) : '';
    if (vm.on && key && key === vm.target && !vm.answered) { vm.answered = true; vmMarkWait(); } else if (vmPick && t === vmPickCtl) { vmPickMark(); }
  });
  window.addEventListener('scroll', vmPickPlace, true); window.addEventListener('resize', vmPickPlace);
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
  /* While notes are being taken, a "Stop notes" button sits in the notes box's label: a tap ends the notes, for when the words are not heard or the line is typed. */
  function vmNotesButton() {
    document.querySelectorAll('.vm-stopnotes').forEach(function (e) { e.remove(); });
    var el = vm.on && vm.noteMode ? vmEl(vm.noteMode.id) : null, lab = el && el.querySelector('.l');
    if (!lab) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'vm-stopnotes'; b.textContent = 'Stop notes'; b.title = 'Or say "that\'s all for the notes"';
    lab.appendChild(b);
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.vm-stopnotes')) return;
    e.preventDefault(); vmStopNotes(); toast('Notes ended. What is said now goes back into the form.');
  });
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
    convoRender();
  }
  /* A row added only because it was pointed at ("any other properties?") that is still empty when the talk moves on is taken away again: otherwise empty rows pile up. */
  function vmDropPointed(nextId) {
    var p = vm.pointed; if (!p) return;
    var nc = nextId ? vmCellRef(nextId) : null;
    if (nc && nc.list === p.list && nc.i === p.i) return;                    // still on that row
    vm.pointed = null;
    var rows = state.l[p.list], r = rows && rows[p.i];
    if (!r || p.i !== rows.length - 1 || !Object.keys(r.d).every(function (k) { return r.d[k] === '' || r.d[k] == null; })) return;
    store.delRow(state, p.list, p.i);
    if (vm.rowCur[p.list] === p.i) vm.rowCur[p.list] = Math.max(p.i - 1, 0);
    touch(); redraw();
  }
  /* Move to a field: open its section if needed, glow, scroll to it and put the cursor in it. */
  function vmShow(id) {
    if (vmQuiet) return;                                         // a late line fills its box without taking the highlight back
    vmMoved(); vmDropPointed(id);
    var cm = /^count:(\w+)$/.exec(id);
    if (cm) {                                                    // waiting to hear how many: the Add button glows
      var L = vidx.lists[cm[1]];
      if (cur !== L.sec) { var fromC = cur; cur = L.sec; redraw(); vmPulseNav(); vmEnter(fromC); }
      vm.target = id; vm.answered = false; vm.secGlow = false; vmMarkWait();
      var ab = vmEl(id); if (ab) ab.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    var f = vmField(id), cr = vmCellRef(id);
    if (f && vm.done[f.sec]) delete vm.done[f.sec];                           // a question or an answer in a finished section opens it again ("oh, there is one more debt")
    if (cr) while (state.l[cr.list].length <= cr.i) { store.addRow(state, cr.list, {}, 'heard'); vm.pointed = { list: cr.list, i: state.l[cr.list].length - 1 }; }   // the row is there before it is pointed at
    if (cur !== f.sec) { var fromF = cur; cur = f.sec; redraw(); vmPulseNav(); vmEnter(fromF); }
    if (cr) { vm.rowCur[cr.list] = cr.i; if (!vmEl(id)) redraw(); }
    vm.target = id; vm.answered = false; vm.secGlow = false; vmMarkWait();
    if (vm.run && vm.run.box !== id) vm.run = null;  // a number being said belongs to its own box
    if (vm.erun && vm.erun.box !== id) vmEmailGiveUp();
    if (isNumBox(id)) vm.lastNum = id;
    var el = vmEl(id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var inp = el.querySelector('input:not([type=checkbox]),select,textarea');
      if (inp && !inp.disabled && !inp.readOnly && document.activeElement !== $('#vdText')) inp.focus({ preventScroll: true });
    } else vmMarkWait();
  }
  function vmOpenSection(secId) {
    if (vmQuiet) { vmLog('did not move to the section: the page is already on a later question'); return; }
    vmMoved(); vmDropPointed(null);
    vm.undo.push({ kind: 'nav', sec: cur, target: vm.target, answered: vm.answered });
    delete vm.done[secId];                                                    // going back to a finished section opens it again
    var fromS = cur; cur = secId; vm.target = null; vm.answered = false; vm.secGlow = true; vmEnter(fromS);
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
  /* A section is finished: "that concludes the debts", or "no" to "do you have any more debts?". It is marked in the list, the catch-up check looks at it, and the page moves on to the next section
     (not when the same line goes somewhere itself, not for a late line, and not when it is not the section being talked about). "scratch that" goes back. One list of a section that holds several lists has no more: only the list is finished. */
  function vmDone(a) {
    var L = a.list && vidx.lists[a.list], secId = a.section || (!a.list && !a.part ? cur : null);
    vmDropPointed(null);                                                       // a row only pointed at ("any more debts?") that stayed empty is taken away
    if (!secId) {
      if (vm.target && /^count:/.test(vm.target)) { vm.target = null; vm.answered = false; }
      vmLog(L ? 'no more ' + L.title.toLowerCase() : 'that part of the page is finished'); vmMarkWait(); return;
    }
    var sec = schema.sections.filter(function (x) { return x.id === secId; })[0];
    if (!sec) return;
    var was = !!vm.done[secId], from = cur;
    vm.done[secId] = Date.now();
    if (vm.target && /^count:/.test(vm.target)) { vm.target = null; vm.answered = false; }
    redraw();
    if (!was) { vmLog('section finished: ' + sec.title); toast(sec.title + ': finished. Say "scratch that" to take it back.'); }
    if (!a.stay && !vmQuiet && secId === cur) vmStepSection(1); else vmMarkWait();
    if (!was) vm.undo.push({ kind: 'done', sec: secId, moved: cur !== from });                  // after the move, so one "scratch that" takes back both
  }
  function vmUndo() {
    var e = vm.undo.pop();
    if (!e) return;
    if (e.kind === 'nav') { cur = e.sec; vm.target = e.target; vm.answered = e.answered; vm.secGlow = false; redraw(); vmPulseNav(); return; }
    if (e.kind === 'done') { delete vm.done[e.sec]; if (e.moved && vm.undo.length && vm.undo[vm.undo.length - 1].kind === 'nav') return vmUndo(); redraw(); return; }      // taking back "finished" also goes back to the page it moved on from
    if (e.kind === 'bulk') { e.fields.forEach(function (x) { if (state.f[x.id]) state.f[x.id].st = x.st; }); e.rows.forEach(function (x) { var r = state.l[x.list] && state.l[x.list][x.i]; if (r) r.st = x.st; }); touch(); redraw(); return; }
    if (e.kind === 'wipe') {
      e.snap.claude = state.claude; state = e.snap; fileBase = e.base; fileHandle = e.handle; rememberHandle(e.handle); dirty = e.dirty; cur = e.sec;
      vm.target = null; vm.answered = false; vm.secGlow = true; saveDraft(); redraw(); vmMarkWait(); toast('Everything is back as it was.'); return;
    }
    if (e.kind === 'addrow') { store.delRow(state, e.list, e.i); vm.rowCur[e.list] = Math.min(vm.rowCur[e.list] == null ? 0 : vm.rowCur[e.list], state.l[e.list].length - 1); touch(); redraw(); return; }
    if (e.kind === 'cell') { var ur = state.l[e.list][e.i]; if (e.prev.v === '' || e.prev.v == null) vm.noSweep[e.list + ':' + e.i + ':' + e.k] = 1; if (ur) { ur.d[e.k] = e.prev.v; ur.st = e.prev.st; } touch(); redraw(); return; }
    if (e.prev.v === '') vm.noSweep[e.id] = 1;                                  // taken back to empty: the catch-up check leaves it
    state.f[e.id] = { v: e.prev.v, st: e.prev.st };
    (e.extras || []).forEach(function (x) { state.f[x.id] = { v: x.prev.v, st: x.prev.st }; });
    touch(); vmShow(e.id); redraw(); vmMarkWait();
  }
  /* "Everything is fine, all the answers are verified": every answer still amber (heard or to verify) becomes agreed, in every section. "Scratch that" puts them back. */
  function vmConfirmAll() {
    var undo = { kind: 'bulk', fields: [], rows: [] };
    Object.keys(state.f).forEach(function (id) {
      var c = state.f[id], d = schema.fieldsById[id];
      if (c && c.v !== '' && (c.st === 'heard' || c.st === 'verify') && d && !d.calc) { undo.fields.push({ id: id, st: c.st }); c.st = 'confirmed'; }
    });
    Object.keys(state.l).forEach(function (k) { state.l[k].forEach(function (r, i) { if (r.st === 'heard' || r.st === 'verify') { undo.rows.push({ list: k, i: i, st: r.st }); r.st = 'confirmed'; } }); });
    var n = undo.fields.length + undo.rows.length;
    if (!n) { vmLog('nothing was waiting to be confirmed'); return; }
    vm.undo.push(undo); touch(); redraw(); vmLog('confirmed ' + n + ' answers on the whole form');
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
      case 'confirmAll': return vmConfirmAll();
      case 'clearAll': return vmWipeAsk();
      case 'clear':
        if (!vm.target) return;
        vm.noSweep[vm.target] = 1;
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
    var cost = state.claude; state = store.blank(); state.claude = cost; vmFreshForm();                                  // what Claude has cost stays, however much of the form is cleared
    fileHandle = null; fileBase = ''; rememberHandle(null); dirty = false; saveDraft();
    cur = 'info'; vm.target = null; vm.answered = false; vm.noteMode = null; vm.rowCur = {}; vm.recent = []; vm.flashes = {}; vm.secGlow = true; vm.run = null; vm.erun = null; vm.eann = null; vm.pointed = null; vm.digits = null;
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
      if (!V.parseCommand(t, vidx) && !V.looksLikeQuestion(t) && !V.isChatter(t) && !V.wrapUp(t, vidx, { cur: cur })) return t;
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
  function vmAddNote(text, ready) {
    var id = vm.noteMode && vm.noteMode.id;
    if (!id || !text) return null;
    var local = ready ? String(text).split(/\n+/).map(function (x) { return x.replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean) : V.pointForm(text);     // ready: Claude already wrote the points
    if (!local.length) return null;
    var set = FF.lookup.getSettings(), secret = !VAI || VAI.scrub(text) !== text;
    var pts = Promise.resolve(local);
    if (!ready && vmAIReady() && !secret) {
      vm.busy++; vmRender();
      pts = VAI.points({ apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, text: text, topic: vmSecTitle(cur), fetchImpl: meteredFetch })
        .then(function (r) { vm.busy--; vmRender(); return r.length ? r : local; }, function () { vm.busy--; vmRender(); return local; });
    }
    return pts.then(function (list) {
      var cell = state.f[id], add = list.map(function (x) { return '- ' + x; }).join('\n');
      vmLog('noted: ' + list.join('; '));
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
    if (res.kind === 'fill' && vmIdClash(id, res.value)) return false;
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
      if (c.list === 'kids' && c.k === 'name') kidsNameFix(row);                  // "Anna Kuiper" heard in the Name box: Anna, and Kuiper in Surname
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
    if (L && !vmVisible(L) && values) { var shown = Object.keys(values).filter(function (k) { return !vmPrivate(list + '.' + k); }).map(function (k) { return values[k]; }).join(', '); if (shown) vmUnplace({ text: L.title + ': ' + shown, why: 'that list is not shown for this client', sec: L.sec }); }
    if (!L || !vmVisible(L)) return -1;
    delete vm.done[L.sec];
    if (cur !== L.sec && !vmQuiet) { var fromR = cur; cur = L.sec; vm.secGlow = false; vmPulseNav(); vmMoved(); vmEnter(fromR); }
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
    if (list === 'kids') { kidsNameFix(row); if (row.d.dob && row.d.stage === '') row.d.stage = FF.calc.rowCalc('stage', row, ctx()); }
    touch(); redraw(); if (!vmQuiet) vmPulseNav();
    if (last && !vmQuiet) { vm.target = list + ':' + i + ':' + last; vm.answered = true; }
    flashed.forEach(vmFlash); vmMarkWait();
    return i;
  }
  /* The voice fill of an ID number that is already on the form is declined, with a word under the box. */
  function vmIdClash(id, value) {
    var cr = vmCellRef(id), where = cr ? (cr.list === 'shares' && cr.k === 'id' ? { list: 'shares', i: cr.i } : null) : (id === 'idno' ? { id: 'idno' } : null);
    var msg = where ? idClashMsg(value, where) : null;
    if (msg) { vmNote(id, msg); vmLog('did not fill the ID number: ' + msg); }
    return !!msg;
  }
  /* The name is spelled as it was said in this line: Claude changed "Sitamah" (said twice by the client) to "Sithemba", the spelling in the adviser's lines, which come from another microphone.
     A name Claude gives that is not in this line, but is a few letters from a word that is, becomes that word (unless the box already holds it: a garbled name put right from the form). */
  function vmOwnSpelling(id, value) {
    var e = vmCur;
    if ((id !== 'fname' && id !== 'sname') || !e || (e.who !== 'client' && e.who !== 'unclear' && e.who !== 'adviser') || e.done || /[\d@]/.test(String(value))) return value;
    var line = String(e.text || '').toLowerCase(), v = String(value).toLowerCase().trim();
    if (!v || line.indexOf(v) >= 0 || String(state.f[id].v).toLowerCase() === v) return value;                      // the line has it, or the box already has it (a garbled name put right from the form)
    var best = null, bd = 99;
    line.split(/[^a-z'\-]+/).filter(function (w) { return w.length >= 3 && !/^(?:its|it's|my|name|surname|first|last|and|the|sure|yes|okay|spell|spelled|called|i'm|am|is)$/.test(w); }).forEach(function (w) {
      var d = lev(w, v); if (d < bd) { bd = d; best = w; }
    });
    return best && bd <= Math.max(3, Math.ceil(v.length * 0.5)) ? V.titleCase(best) : value;
  }
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) m[i] = [i];
    for (j = 1; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return m[a.length][b.length];
  }
  function vmApply(id, res) {
    var cr = vmCellRef(id);
    if (cr) return vmApplyCell(cr, id, res);
    if (res.kind === 'fill' && res.value != null) res = Object.assign({}, res, { value: vmOwnSpelling(id, res.value) });
    if (res.kind === 'fill' && vmIdClash(id, res.value)) return false;
    var cell = state.f[id], entry = { kind: 'fill', id: id, prev: { v: cell.v, st: cell.st }, extras: [] }, extraIds = [];
    if (res.kind === 'confirm') {
      if (cell.v === '') return false;
      store.setField(state, id, cell.v, 'confirmed');
      if (id === 'idno') { var dobAgreed = autoDob(); if (dobAgreed) { entry.extras.push({ id: 'dob', prev: dobAgreed }); extraIds.push('dob'); } }   // the date of birth that came from this ID is agreed to with it
    } else {
      var value = res.value;
      var multi = schema.fieldsById[id] && schema.fieldsById[id].t === 'multi';
      if (multi) { if (res.append && cell.v) value = V.mergeMulti(cell.v, value, schema.fieldsById[id].o); }                 // "and through Astute as well" adds to the ticks
      else if (res.append && cell.v && (cell.st === 'heard' || cell.st === 'verify')) value = cell.v + ' ' + value;
      store.setField(state, id, value, res.status);
      (res.extra || []).forEach(function (x) { var c2 = state.f[x.id]; entry.extras.push({ id: x.id, prev: { v: c2.v, st: c2.st } }); store.setField(state, x.id, x.value, x.status); extraIds.push(x.id); });
      if (id === 'idno') { var dobWas = autoDob(); if (dobWas) { entry.extras.push({ id: 'dob', prev: dobWas }); extraIds.push('dob'); } var sexWas = autoGender(); if (sexWas) { entry.extras.push({ id: 'gender', prev: sexWas }); extraIds.push('gender'); } }   // the date of birth and an empty gender come from the ID number
    }
    vm.undo.push(entry);
    if (isNumBox(id)) vm.lastNum = id;
    if (id === vm.target) vm.answered = true;
    touch(); redraw(); vmFlash(id); extraIds.forEach(vmFlash);
    if (condIds[id] && (state.unplaced || []).length) vmRetryUnplaced();
    /* Employer or business name filled: look up what the company does. Only the company name is sent. */
    if (res.kind === 'fill') { autoCompanyLookup(id); if (PROFILE_SRC.indexOf(id) >= 0) autoProfileLookup(); }
    return true;
  }
  /* The boxes and lists that are switched off on the form now (the quotes of an area that is not a priority, boxes that do not apply to this client): Claude is told, so it does not offer values for them. */
  function vmHiddenMap() {
    var h = {};
    vidx.fields.forEach(function (f) { if (!f.list && !vmVisible(f)) h[f.id] = 1; });
    Object.keys(vidx.lists).forEach(function (k) { if (!vmVisible(vidx.lists[k])) h['list:' + k] = 1; });
    return h;
  }
  /* What is already in the boxes of the form, so Claude can tell a new fact from a correction, in whichever section the line ends up. Private boxes are only said to be filled, never their values. */
  function vmFilled() {
    var filled = {}, priv = [];
    vidx.fields.forEach(function (f) {
      if (f.list || !vmVisible(f)) return;
      var c = state.f[f.id];
      if (!c || c.v === '') return;
      if (V.PRIVATE_IDS.indexOf(f.id) >= 0 && !vmShareOn()) priv.push(f.id); else filled[f.id] = String(c.v);
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
      var priv = V.PRIVATE_IDS.indexOf(f.id) >= 0 && !vmShareOn();
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
  /* Claude reads several lines at once (a line is sent the moment it is heard), but at most this many answers are awaited together. */
  var MAX_CALLS = 4, callWait = [];
  function vmSlot() { return new Promise(function (go) { if (vm.calls < MAX_CALLS) { vm.calls++; go(); } else callWait.push(go); }); }
  function vmSlotFree() { var next = callWait.shift(); if (next) next(); else vm.calls--; }
  /* How many rows each list has: a line read before another one added a row (or took one away) is read again, so a child is not added twice. */
  function vmRowsSig() { return Object.keys(state.l).map(function (k) { return k + ':' + state.l[k].length; }).join(','); }
  /* keep (optional) receives what Claude was shown, so a reply that arrives later can be checked against the form as it is by then. */
  function vmAsk(who, text, note, entry, keep) {
    var t0 = Date.now(), set = FF.lookup.getSettings(), tcr = vm.target ? vmCellRef(vm.target) : null, tid = !vm.noteMode && vm.target && !/^count:/.test(vm.target) && vmField(vm.target) ? (tcr ? tcr.list + '.' + tcr.k : vm.target) : null, fl = vmFilled(), aw = vmAwaiting(), tgt = vm.target;
    var rows = {}, sec = cur; Object.keys(state.l).forEach(function (k) { rows[k] = state.l[k].map(function (r) { return JSON.parse(JSON.stringify(r.d)); }); });    // the rows and the section as they are now, whenever the request is made
    var ri = entry ? vm.recent.indexOf(entry) : -1, recent = ri >= 0 ? vm.recent.slice(Math.max(0, ri - 6), ri) : vm.recent.slice(-7, -1);                    // the lines just before this one, not those heard after it
    if (keep) { keep.filled = fl.filled; keep.priv = fl.filledPrivate; keep.rows = vmRowsSig(); keep.target = vm.target || null; keep.noteMode = !!vm.noteMode; keep.wipe = !!vm.wipe; }
    var tv = tid && (!vmPrivate(tgt) || vmShareOn()) ? vmValue(tgt) : '', tfilled = !!(tid && vmValue(tgt) !== '');                 // the box the talk is on, as it is now
    vm.busy++; vmRender();
    return vmSlot().then(function () {
      return VAI.decide({
        apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, hedgeMs: 3500, idx: vidx, who: who, text: text, fetchImpl: entry || vmCur ? loggedFetch(entry || vmCur) : meteredFetch,
        ctx: { sectionId: sec, targetId: tid, targetRow: tcr ? tcr.i + 1 : null, targetValue: tv, targetFilled: tfilled, alternatives: entry && entry.m && entry.shown === entry.text ? entry.m.also : null, filled: fl.filled, filledPrivate: fl.filledPrivate, hidden: vmHiddenMap(), awaiting: aw.awaiting, privateHeld: aw.held, note: note, concluded: Object.keys(vm.done),
          listRows: function (key) { return rows[key] || []; }, recent: recent }
      }).then(function (r) { vmSlotFree(); return r; }, function (e) { vmSlotFree(); throw e; });
    }).then(function (r) { vm.busy--; vmRender(); if (entry) entry.claudeMs = Date.now() - t0; return r; }, function (err) {
      vm.busy--; vmRender();
      if (Date.now() - vm.lastFail > 60000) { vm.lastFail = Date.now(); toast('Voice: could not reach Claude (' + err.message + '). Using only what this computer can understand.'); }
      return null;
    });
  }
  /* ---------- reading several lines at once ----------
     Every line that Claude has to read is sent to it the moment it is heard, not when the lines before it have been put on the form. The answers are put on the form in the order the lines were said
     (a correction after a value, "yes" after a read-back, "scratch that" after a fill all depend on that), but nobody waits for a slow line before the next one is being read.
     A reply is used only if the form is still as Claude saw it where the reply touches it (a box it fills, a list it adds to, the box the talk was on); otherwise that line is read again, now. */
  var AGREE_LINE = function (text) { return V.isConfirm(text, true); };
  /* Would this line be read by Claude as it is heard? Not while a "remove everything" question waits, notes are on, a number or an email address is being said, or for a line this page handles itself. */
  function vmReadsEarly(text, pl) {
    if (!vmAIReady() || vm.wipe || vm.noteMode || vm.paused || vm.run || vm.erun) return false;
    if (vmEditParse(text) || (text.split(/\s+/).length <= 16 && CLEAR_NAMED.test(text.replace(/[.!?]+$/, '')))) return false;
    var words = text.split(/\s+/).length;
    if (AGREE_LINE(text) && words <= 9) return false;                                             // a plain yes agrees to what was read back by the lines before it: read after them
    var startsNotes = pl.actions.some(function (a) { return a.do === 'cmd' && a.cmd && a.cmd.type === 'notes'; });
    var onlyCommand = pl.actions.length > 0 && pl.actions.every(function (a) { return (a.do === 'cmd' && !(/^(?:undo|clear|clearAll)$/.test(a.cmd && a.cmd.type))) || (a.do === 'done' && a.via === 'said'); }) && words <= 10 && !startsNotes;
    return !startsNotes && !onlyCommand;
  }
  var ACK_WORDS = {};
  'okay ok alright all right excellent perfect great fantastic wonderful wow um uh umm mm mhm hmm hey hi hello sure thanks thank you sorry well so and anyway good nice lovely brilliant awesome oh ah ha interesting ja righto fine cool'.split(' ').forEach(function (w) { ACK_WORDS[w] = 1; });
  function vmStartCall(text, entry) {
    var keep = {}, nw = text.split(/\s+/).length; keep.short = !entry.quick && nw <= 8;           // a short answer means what the box the talk was on says (a line already filled by the quick path is checked by that)
    keep.answerish = !V.norm(text).split(' ').filter(Boolean).every(function (w) { return ACK_WORDS[w]; });   // "Excellent.", "Um", "All right" are not answers to anything, so nothing is lost when Claude finds nothing in them; "Absa Bank." and "Old Mutual" are
    var call = { keep: keep, promise: vmAsk('auto', text, null, entry, keep) };
    entry.call = call; entry.early = true;
    return call;
  }
  /* Does Claude's reply still fit the form as it is now? '' when it does, else why not.
     The box the talk was on matters to a short answer ("forty two thousand") only if the reply uses that box, or says nothing at all (an answer to a question Claude could not see). */
  function vmFits(keep, r) {
    if (keep.noteMode !== !!vm.noteMode) return 'the notes were switched on or off';
    if (keep.wipe !== !!vm.wipe) return 'a question about removing everything is open';
    var acts = r && r.kind === 'actions' ? r.actions : [], was = keep.target || null, now = vm.laneTarget || null;
    var named = function (a) { return a.field || (a.list && typeof a.row === 'number' ? a.list + ':' + (a.row - 1) + ':' + a.col : null); };
    var real = acts.filter(function (a) { return /^(?:fill|confirm|cell|empty|row|addrow|note|section|cmd|done)$/.test(a.do); });
    var usesIt = acts.some(function (a) {                                                       // the reply names the box Claude was told the talk was on (or "the last row" of its list)
      var n = named(a); if (n) return n === was;
      return !!(a.list && was && was.indexOf(a.list + ':') === 0 && a.do !== 'row' && a.do !== 'addrow');
    });
    if (keep.short && was !== now && ((!real.length && keep.answerish) || usesIt)) return 'the box the talk was on changed';
    var rowsNow = keep.rows !== vmRowsSig(), moved = '';
    acts.forEach(function (a) {
      if (moved) return;
      if (a.list || a.do === 'row' || a.do === 'addrow') { if (rowsNow) moved = 'a list changed'; return; }                       // a list that grew or shrank since: read again
      if (!a.field || !/^(?:fill|confirm|empty|cell)$/.test(a.do)) return;
      var c = state.f[a.field]; if (!c) return;
      var seen = a.field in keep.filled ? keep.filled[a.field] : keep.priv.indexOf(a.field) >= 0 ? null : '';
      if (seen === null ? c.v === '' : String(c.v) !== seen) moved = '"' + (vmField(a.field) ? vmField(a.field).label : a.field) + '" changed';   // the box holds what Claude saw (so it is a correction or an addition to that, not to something newer)
    });
    return moved;
  }
  /* What Claude makes of the line: the answer already on its way (if it still fits), else a fresh question. */
  function vmDecide(text, entry, note) {
    var call = entry && entry.call; if (entry) entry.call = null;
    if (!call || note) return vmAsk('auto', text, note || null, entry);
    return call.promise.then(function (r) {
      var why = vmFits(call.keep, r);
      if (!why) return r;
      entry.reread = true; vmLog('read the line again: ' + why);
      return vmAsk('auto', text, null, entry);
    });
  }
  /* Do what a line of conversation says, in order. Actions come from V.plan (on this computer) or from Claude. */
  var SAID_UNDO = /\b(?:undo|scratch|take (?:that|it|those|them) back|cancel|never ?mind|revert|forget (?:that|it)|ignore (?:that|it))\b/i, SAID_CLEAR = /\b(?:clear|delete|remove|erase|wipe|empty|scratch|get rid of|take out|cancel|forget|(?:cleared|deleted|removed|erased|wiped)(?: up)?|(?:must|should|has to|have to|needs? to|got to) go)\b/i, SAID_ALL_OK = /\b(?:all|every|everything)\b[^.?!]{0,50}\b(?:verified|correct|confirmed|good|fine|right|accurate|agreed)\b|\b(?:verify|confirm)\s+(?:all|everything|every)\b/i;
  function vmAskId(a) {
    if (a.list) { var n = state.l[a.list].length, i = a.row === 'new' ? n : a.row === 'last' ? Math.max(n - 1, 0) : a.row - 1; return a.list + ':' + i + ':' + a.col; }
    return a.field || null;
  }
  /* The page's pointer is where the lines applied so far left the talk, unless a later question has already moved it (then the lines are followed in vmDo). At the start of a line its own guess is left out. */
  function vmLaneSync(entry, start) {
    if (vm.moveSeq > entry.seq) return;
    if (start && entry.prov && vm.target === entry.prov) return;
    vm.laneTarget = vm.target || null;
  }
  function vmDo(a) {
    var was = vmQuiet; vmQuiet = vmLate();
    try {
      var r = vmDoNow(a);
      /* where the talk is, as far as the lines applied so far are concerned: what a later short answer is read against */
      if (!vmQuiet) { if (a.do === 'ask' || a.do === 'fill' || a.do === 'cell' || a.do === 'section' || a.do === 'cmd' || a.do === 'row' || a.do === 'addrow') vm.laneTarget = vm.target; }
      else if (a.do === 'ask') { var aid = vmAskId(a), af = aid && !/^count:/.test(aid) ? vmField(aid) : null; if (aid && (/^count:/.test(aid) || (af && vmVisible(af)))) vm.laneTarget = aid; }     // the line would have pointed here, but the page is already on a later question
      else if ((a.do === 'fill' || a.do === 'cell') && a.field) vm.laneTarget = a.field;
      else if (a.do === 'section') vm.laneTarget = null;
      return r;
    } finally { vmQuiet = was; }
  }
  function vmDoNow(a) {
    var f = a.field ? vmField(a.field) : null;
    if (vm.noteMode && /^(?:section|ask|fill|cell|row|addrow|confirm|done)$/.test(a.do)) vmStopNotes();       // going to another box or section, or finishing the section, ends the notes
    switch (a.do) {
      case 'cmd':
        if (a.cmd && vmCur && ((a.cmd.type === 'undo' && !SAID_UNDO.test(vmCur.text)) || (a.cmd.type === 'clear' && !SAID_CLEAR.test(vmCur.text)))) { vmLog('did not ' + a.cmd.type + ': the words were not said'); return; }   // undo and clear destroy work, so the line has to ask for them
        if (a.cmd && a.cmd.type === 'confirmAll' && vmCur && !SAID_ALL_OK.test(vmCur.text)) { vmLog('did not confirm everything: the words were not said'); return; }
        vmLog('command: ' + (a.cmd && a.cmd.type)); return vmCommand(a.cmd);
      case 'section': return vmOpenSection(a.section);
      case 'done': return vmDone(a);
      case 'empty':
        if (vmCur && !SAID_CLEAR.test(vmCur.text)) { vmLog('did not empty a box: the words were not said'); return; }
        return vmEmpty(a);
      case 'note':
        if (!vm.noteMode) vmStartNotes({});                                     // a note with no "let me take some notes" before it starts them
        return vmAddNote(a.text, a.ready);
      case 'addrow': return void vmAddRow(a.list, null);
      case 'row': return void vmAddRow(a.list, a.values);
      case 'ask':
        if (vm.noteMode) vmStopNotes();
        if (vmCur && vmCur.prov && vmCur.prov === vmAskId(a)) { if (vm.target === vmCur.prov) return null; }   // this line pointed there as it was heard
        if (a.list) {                                                           // Claude: a box of a row ("row": 2, "last" or "new")
          return vmPoint(vmAskId(a));
        }
        if (/^count:/.test(a.field)) return vmPoint(a.field);
        if (f && vmVisible(f)) { vmLog('pointed at ' + f.label); return vmPoint(a.field); }
        return null;
      case 'cell':                                                              // Claude: a value for a box of a row that is there
        var rn = state.l[a.list].length, ri = a.row === 'last' ? Math.max(rn - 1, 0) : a.row - 1;
        return vmDo({ do: 'fill', field: a.list + ':' + ri + ':' + a.col, value: a.value, explicit: a.explicit });
      case 'wait': return vm.target ? vmNote(vm.target, a.dangling ? 'Listening for the rest' : 'Waiting for the correct answer') : null;
      case 'confirm': case 'fill':
        if (a.do === 'confirm' && a.list) {                                     // Claude: the client agrees to a row of a list; its first filled box carries the status
          var cl = state.l[a.list] || [], ci = a.row === 'last' ? Math.max(cl.length - 1, 0) : a.row - 1, crow = cl[ci], ck = crow && vidx.lists[a.list].cols.map(function (id) { return id.split('.')[1]; }).filter(function (k) { return crow.d[k] !== '' && crow.d[k] != null; })[0];
          return ck ? vmDo({ do: 'confirm', field: a.list + ':' + ci + ':' + ck }) : null;
        }
        if (!f) return;
        if (!vmVisible(f)) { if (a.do === 'fill' && !a.res && a.value != null && String(a.value).trim()) vmUnplace(Object.assign({ text: f.label + ': ' + vmShown(a.field, a.value), why: 'that box is not shown for this client', sec: f.sec }, vmPrivate(a.field) ? {} : { field: a.field, value: String(a.value) })); return; }
        var cell = vmCellRef(a.field) ? { v: vmValue(a.field), st: (state.l[vmCellRef(a.field).list][vmCellRef(a.field).i] || { st: 'heard' }).st } : state.f[a.field], res = a.res;
        if (!res && a.do === 'confirm') res = { kind: 'confirm' };
        if (!res) { var x = V.interpret(f, a.value); if (x && !x.error) res = { kind: 'fill', value: x.value, status: x.status, extra: x.extra, append: x.append && !a.explicit }; }   // a correction replaces the text; only a new fact is added to it
        if (!res) { if (a.do === 'fill' && a.value != null && String(a.value).trim()) vmUnplace({ text: f.label + ': ' + vmShown(a.field, a.value), why: 'could not be read as an answer for that box', field: vmPrivate(a.field) ? undefined : a.field, value: vmPrivate(a.field) ? undefined : String(a.value), sec: f.sec }); return; }
        if (res.kind === 'fill' && !res.extra && cell.v !== '' && String(res.value).trim().toLowerCase() === String(cell.v).trim().toLowerCase()) { if (a.field === vm.target && !vm.answered) { vm.answered = true; vmMarkWait(); } return; }   // the box already holds it, so it is answered; the same value again is not agreement (the adviser echoes what the client said: "950,000. Perfect."): the box stays as it is until the client says yes
        if (a.field !== vm.target && a.do !== 'confirm') {                  // agreeing to a box does not move the cursor: it turns green where it is
          if (!a.explicit && res.kind === 'fill' && cell.v !== '' && cell.st === 'confirmed') { if (!vmCellRef(a.field)) vmUnplace({ text: f.label + ': ' + vmShown(a.field, res.value), why: 'the box already holds a confirmed answer' + (vmPrivate(a.field) && !vmShareOn() ? '' : ' (' + cell.v + ')'), field: vmPrivate(a.field) ? undefined : a.field, value: vmPrivate(a.field) ? undefined : String(res.value), sec: f.sec }); return; }   // Claude's volunteered fact never overwrites a confirmed value: it is kept for the adviser
          vmShow(a.field);                                                                              // the screen follows the conversation to that box
        }
        if (res.kind === 'fill' && isNumBox(a.field) && vmHoldPartial(a.field, res.value)) return;
        if (vmApply(a.field, res)) vmLog((res.kind === 'confirm' ? 'confirmed ' : 'filled ') + [f.label || a.field].concat((res.extra || []).map(function (x) { var xf = vmField(x.id); return xf ? xf.label : x.id; })).join(', '));
    }
  }
  /* One named box is emptied ("delete his name"), whatever its status; "scratch that" brings it back. */
  function vmEmpty(a) {
    var id = a.list ? a.list + ':' + (a.row === 'last' ? Math.max(state.l[a.list].length - 1, 0) : a.row - 1) + ':' + a.col : a.field, cr = vmCellRef(id), f = vmField(id);
    if (!f || !vmVisible(f)) return;
    vm.noSweep[id] = 1;                                                       // emptied on purpose: the catch-up check leaves it empty
    if (cr) {
      var r0 = state.l[cr.list][cr.i];
      if (!r0 || r0.d[cr.k] === '' || r0.d[cr.k] == null) return;
      vm.undo.push({ kind: 'cell', list: cr.list, i: cr.i, k: cr.k, prev: { v: r0.d[cr.k], st: r0.st } }); r0.d[cr.k] = '';
    } else {
      var c0 = state.f[id];
      if (!c0 || c0.v === '') return;
      vm.undo.push({ kind: 'fill', id: id, prev: { v: c0.v, st: c0.st }, extras: [] }); store.setField(state, id, '', 'empty');
    }
    if (vm.run && vm.run.box === id) vm.run = null;
    if (vm.erun && vm.erun.box === id) vm.erun = null;
    touch(); redraw(); vmShow(id); vmLog('emptied ' + (f.label || id));
  }
  /* One after another, so a note written by Claude lands before the next thing in the line. */
  function vmRun(actions) {
    if (vm.run) actions = actions.filter(function (a) { return !(/^(?:fill|confirm|cell)$/.test(a.do) && a.field === vm.run.box); });   // the number being said owns its box until it is complete
    if (vm.erun) actions = actions.filter(function (a) { return !(/^(?:fill|confirm|cell)$/.test(a.do) && a.field === vm.erun.box); });   // and so does an email address
    actions.forEach(function (a, i) {                            // a section that is finished is followed by the next one, unless the same line goes somewhere else itself
      if (a.do === 'done') a.stay = actions.slice(i + 1).some(function (b) { return /^(?:section|ask|fill|cell|row|addrow|confirm)$/.test(b.do) || (b.do === 'cmd' && b.cmd && /^(?:goto|nextSection|prevSection)$/.test(b.cmd.type)); });
    });
    var k = -1;                                                  // "remove everything" ends the line for now: the rest waits for the answer
    actions.forEach(function (a, i) { if (k < 0 && a.do === 'cmd' && a.cmd && a.cmd.type === 'clearAll') k = i; });
    var now = k < 0 ? actions : actions.slice(0, k + 1);
    return now.reduce(function (p, a) { return p.then(function () { return vmDo(a); }); }, Promise.resolve()).then(function () { if (k >= 0 && vm.wipe) vm.wipe.after = actions.slice(k + 1); });
  }
  /* While notes are on, what is said is noted, but a line that asks something, or names a box of the form that is not what the notes are about (notes on the
     medical aid, then "do you have gap cover?" or "gap cover with Stratum"), may be leaving the notes. Questions this computer can place itself are dealt with here; the rest Claude decides. */
  function vmMayLeaveNotes(text) {
    var box = vidx.noteById[vm.noteMode.id], hit = V.matchQuestion(text, vidx, { cur: cur }), f = hit && hit.score >= 4 ? vmField(hit.id) : null;
    var asks = V.clauses(text).some(function (c) { return /\?\s*$/.test(c) || V.looksLikeQuestion(c); });
    return asks || !!(f && box && (f.sec !== box.sec || f.blk !== box.blk));
  }
  function vmAskInNotes(text, pl) {
    var nb = vidx.noteById[vm.noteMode.id];
    return vmAsk('auto', text, 'The page is taking notes now: what is said goes into the notes box "' + (nb.blkTitle || nb.label) + '" of the section "' + vmSecTitle(nb.sec) + '" until the notes end. Decide for this line: ' +
      '(1) it is more to note about that topic, or small talk: answer with "note" actions in point form and nothing else. ' +
      '(2) it asks about another part of the form, moves on to it, or states a fact that belongs in another box (for example notes about the medical aid, then "do you have gap cover?" or "gap cover with Stratum"): the notes end, so answer {"do":"cmd","cmd":"notesOff"} followed by what the line asks (section, ask, fill, row ...). ' +
      '(3) it says the notes are finished, in any words ("I\'ve noted that, I\'ve completed those notes", "that\'s everything I wanted to note", "okay, that\'s the notes done"): answer {"do":"cmd","cmd":"notesOff"} and note nothing (what was said to end them is never itself noted). ' +
      'A line with both a thing to note and something that leaves the notes: the "note" actions first, then notesOff, then the rest. Never switch the notes on again.').then(function (r) {
      return vmRun(r && r.kind === 'actions' && r.actions.length ? r.actions : pl.actions);
    });
  }
  /* ---------- a read-back is a question, not the client's answer ---------- */
  /* "Your ID number is 7212095268086, is that correct?" and "can you confirm your tax number" ask the client to agree. The number said back by the adviser must not count as the client
     agreeing: a box that already holds the number would turn green at once, before the client has answered. Speech recognition does not always write the question mark, so the words decide. */
  var READBACK_TAG = /\b(?:(?:is|are) (?:that|this|it|those|these) (?:all |still |also )?(?:correct|right|accurate)|(?:am i|have i got (?:it|that|this)|do i have (?:it|that|this)) (?:right|correct)|isn'?t (?:that|it) (?:right|correct|so)|is (?:that|this) your [a-z ]{0,25}|(?:correct|right)\s*\?)\s*[?.!]*\s*$/i;
  var READBACK_ASK = /\b(?:(?:can|could|would|will) you (?:please |just |also )?(?:confirm|verify|check)|(?:please|just to|do you|can i|let me) confirm|to (?:just )?(?:confirm|verify|double.?check)|you (?:said|told me|mentioned|gave me|just said))\b/i;
  /* A line of five words or more that ends in "correct" or "right" and does not open with an agreement is the adviser asking ("so your wife's cell number is ... correct"): the client's own "yes that's correct" opens with one. */
  var READBACK_END = /\b(?:correct|right)\s*[?.!]*\s*$/i;
  var AGREE_OPEN = /^(?:(?:and|so|well|okay|ok|oh)\s+)?(?:yes|yeah|yep|yup|ya|sure|perfect|exactly|absolutely|definitely|indeed|great|fine|good|right|correct|that'?s|thats|that is|it'?s|its|it is|i think|i believe|i agree|i guess|i reckon|i'?m sure|im sure|i am sure|we agree|thank)\b/i;
  /* "My personal email address is also correct", "the cell number is right": the client agreeing, in a statement with no value in it. An adviser reading back says the value (and asks). */
  var AGREE_STMT = /^(?:(?:and|so|well|okay|ok|oh|yes|yeah|yep|ja)[,\s]+)*(?:i|we|my|our|the|that|this|it|these|those|everything|all)\b[^?]{0,70}\b(?:is|are|was|were|looks|look|seems)\s+(?:also\s+|all\s+|both\s+|still\s+|totally\s+|absolutely\s+|quite\s+)?(?:correct|right|accurate|fine|good)\s*[.!]*$/i;
  function vmAgreeStmt(text) { var t = String(text == null ? '' : text).replace(/[‘’]/g, "'").trim(); return t.split(/\s+/).length <= 14 && AGREE_STMT.test(t) && !/\d{3,}|@/.test(t); }
  function vmReadBack(text) {
    var t = String(text == null ? '' : text).replace(/[‘’]/g, "'").trim();
    if (vmAgreeStmt(t)) return false;
    return READBACK_TAG.test(t) || READBACK_ASK.test(t) || ((t.split(/\s+/).length >= 5 || t.replace(/\D/g, '').length >= 7) && READBACK_END.test(t) && !AGREE_OPEN.test(t));
  }
  function vmSame(a, b) { var n = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/[\s,]+/g, ''); }; return n(a) !== '' && n(a) === n(b); }
  /* On a read-back line nothing is confirmed, and a box that already holds the value said is only pointed at (it stays amber until the client says yes). */
  function vmGuardReadBack(actions, text) {
    if (!vmReadBack(text)) return actions;
    return actions.filter(function (a) { return !(a.do === 'cmd' && a.cmd && /^(?:undo|clear|clearAll)$/.test(a.cmd.type)); }).map(function (a) {   // nothing is undone or cleared on a read-back ("can you confirm that" was heard as "cancel that")
      if (a.do === 'confirm' || (a.res && a.res.kind === 'confirm')) return a.field && !a.list ? { do: 'ask', field: a.field } : null;
      if (a.do === 'fill' && a.field) {
        var f = vmField(a.field), x = !a.res && f ? V.interpret(f, a.value) : null, v = a.res ? a.res.value : (x && !x.error ? x.value : a.value);
        if (vmSame(vmValue(a.field), v)) return { do: 'ask', field: a.field };
      }
      return a;
    }).filter(Boolean);
  }
  /* "My personal email address is also correct": the box it names, when it holds a value that still waits for the client to agree. */
  function vmAgreedBox(text) {
    if (!vmAgreeStmt(text)) return null;
    var hit = V.matchQuestion(text, vidx, { cur: cur }), f = hit && hit.score >= 3 ? vmField(hit.id) : null, c = f && !f.list ? state.f[hit.id] : null;
    return c && vmVisible(f) && c.v !== '' && (c.st === 'heard' || c.st === 'verify') ? hit.id : null;
  }
  function vmAgreeActions(actions, text) {
    var id = vmAgreedBox(text);
    return id ? actions.filter(function (a) { return !(a.field === id && (a.do === 'ask' || a.do === 'confirm')); }).concat([{ do: 'confirm', field: id }]) : actions;
  }
  /* What the page itself makes of a line, in the state the form is in now. */
  function vmPlanFor(text, entry) {
    var ri = entry ? vm.recent.indexOf(entry) : -1, prev = ri > 0 ? vm.recent[ri - 1].text : (!entry && vm.recent.length > 1 ? vm.recent[vm.recent.length - 2].text : '');       // the line before this one: "no" answers it
    var pl = V.plan(text, vidx, { cur: cur, prev: prev, noting: !!vm.noteMode, target: vm.target, answered: vm.answered, rows: function (key) { return state.l[key].map(function (r) { return r.d; }); }, curRow: vm.rowCur, value: function (id) { return state.f[id].v; }, visible: function (id) { var f = vmField(id); return !!f && vmVisible(f); } });
    pl.actions = vmGuardReadBack(pl.actions, text);
    return pl;
  }
  /* A number said in pieces ("082 454", then "1751") arrives as separate lines, from a pause or from the speech recogniser. Lines that are only digits, one after another within 12 seconds,
     are joined until there are enough digits for a number (10 for a phone or tax number, 13 for an ID). One that starts while a phone, ID or tax box is waiting, or with a 0, starts the run. */
  var DIGIT_WORD = /^(?:\d+|oh|zero|one|two|three|four|five|six|seven|eight|nine|double|triple)$/, NUMBER_BOXES = ['idno', 'tax', 'cell', 'work', 'home', 'sp_tel'];
  /* The ID and cell number of a partner or shareholder (a row of the "shares" list) are said in pieces just like the client's own. */
  var PARTNER_NUM = /^shares:\d+:(id|cell)$/;
  function isNumBox(id) { return !!id && (NUMBER_BOXES.indexOf(id) >= 0 || PARTNER_NUM.test(id)); }
  function numLen(id) { var m = PARTNER_NUM.exec(id || ''); return m ? (m[1] === 'id' ? 13 : 10) : NUM_LEN[id]; }
  function idLike(id) { return id === 'idno' || id === 'tax' || /^shares:\d+:id$/.test(id || ''); }                    // a number that is not grouped like a phone number
  function vmJoinDigits(text) {
    var tk = V.norm(text).split(' ').filter(Boolean), d = V.spokenDigits(text), now = Date.now(), b = vm.digits;
    var dateLike = function (x) { return /^\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/.test(x); };
    if (!tk.length || d.length < 2 || !tk.every(function (w) { return DIGIT_WORD.test(w); })) { vm.digits = null; return text; }
    var join = !!b && now - b.t < 12000 && b.d.length + d.length <= 13 && (b.d.length < 10 || dateLike(b.d));
    if (join && vm.target && isNumBox(vm.target)) vm.answered = false;                  // the rest of the number is an answer to the same box, not a new line about a finished one
    if (!join && !((vm.target && !vm.answered && isNumBox(vm.target)) || d.charAt(0) === '0')) { vm.digits = null; return text; }
    var all = join ? b.d + d : d, shown = join ? b.text + ' ' + text : text;
    vm.digits = all.length >= 13 || (all.length >= 10 && !dateLike(all)) ? null : { d: all, text: shown, t: now };
    return shown;
  }
  /* A number said slowly, in pieces, with words in between ("yes I do, it's 011", "let me see, 312", "3789"): while an ID, tax or phone box is waiting, the digits are kept, nothing is filled
     and nothing waits on a clock, until there are enough (13 for an ID, 10 for a tax or phone number, 11 for a phone number given as 27...). Then the whole number is read as one line.
     Only filler words ("let me see", "um", "it's", "one moment") may sit between the pieces. Saying it is wrong, or "let's start again" / "let me give that again", drops what was kept.
     The kept digits stay on this computer. -> null (not part of a number: read as usual), { hold: true, note } (kept) or { text } (complete: this line is read in place of what was said). */
  var RUN_NAMES = { cell: 'cell', mobile: 'cell', work: 'work', office: 'work', business: 'work', home: 'home', tax: 'tax', id: 'idno', identity: 'idno' };
  var RUN_FILLER = {};
  ('yes yeah yep yup ok okay alright right so um uh er erm ah hm hmm well let lets me see is it its the that thats this a an of in number numbers my mine your cell work home phone mobile telephone tax id sorry hold on moment second sec minute just give you again please then and next hang think check checking looking look sure i im ill am was do does did have has got can could will we us to for at from digits digit about like starts start begins begin with thank thanks wait').split(' ').forEach(function (w) { RUN_FILLER[w] = 1; });
  var RUN_CANCEL = /\b(?:wrong|incorrect|not (?:right|correct)|(?:correct|fix|redo|change) (?:that|it|this)|from the (?:top|start|beginning)|(?:scratch|clear|forget|ignore|cancel|delete|discard) (?:that|it|those|these|all that|what i (?:said|gave))|(?:give|say|read|do|redo|try|start|begin|go|repeat)\b[^.?!]{0,25}\b(?:again|over|afresh))\b/;
  function vmGroup(box, s) { return !idLike(box) && !/^27/.test(s) ? s.slice(0, 3) + (s.length > 3 ? ' ' + s.slice(3, 6) : '') + (s.length > 6 ? ' ' + s.slice(6) : '') : s; }
  var RUN_UNITS = /\b(?:rands?|percent|per|months?|years?|days?|weeks?|kids?|children|aged?|old|thousand|million|hundred|k)\b/;
  function vmNumberRun(text) {
    var raw = String(text == null ? '' : text).toLowerCase().replace(/[‘’`]/g, "'").replace(/\bone (?:moment|second|sec|minute)\b/g, 'moment'), named = null;
    raw.split(/[^a-z]+/).forEach(function (w) { if (RUN_NAMES[w]) named = RUN_NAMES[w]; });  // "my work number is 011" names its box
    var tgt = vm.target && isNumBox(vm.target) ? vm.target : null, run = vm.run;
    var kindOf = function (b) { var m = PARTNER_NUM.exec(b || ''); return m ? (m[1] === 'id' ? 'idno' : 'cell') : b; };               // a partner's ID box is named like the client's own
    if (run && (run.box !== tgt || (named && named !== kindOf(run.box)))) run = vm.run = null;  // the talk has moved on to another box
    var sameKind = tgt && named && ((named === 'cell' && /:cell$/.test(tgt)) || (named === 'idno' && /:id$/.test(tgt)));       // "his cell number is ..." while the partner's cell box waits is that box
    var box = run ? run.box : (sameKind ? tgt : (named || tgt)), fd = box && vmField(box);
    if (!box || !fd || !vmVisible(fd) || (box === 'idno' && state.f.idtype.v === 'Passport')) return null;
    if (/\?/.test(raw) || vmReadBack(text) || vmEditParse(text)) return null;
    if (run && RUN_CANCEL.test(raw)) { var gone = run.d; vm.run = null; vm.answered = false; vmMarkWait(); return { hold: true, note: 'dropped ' + vmGroup(box, gone) + ': ready for the number again' }; }
    var tk = V.norm(raw).split(' ').filter(Boolean), dt = tk.filter(function (w) { return DIGIT_WORD.test(w); }), d = V.spokenDigits(dt.join(' '));
    /* Starting a number: only filler words may come with the digits, so nothing else said in the line is lost. Once one is held, any short line with three or more digits goes into it. */
    var strict = tk.every(function (w) { return DIGIT_WORD.test(w) || RUN_FILLER[w]; });
    /* The first piece of a long number may come with chatter in front of it ("but if I look it up, it is 720926"): when the box is waiting and the line ends in the digits, it starts the number. */
    var tail = !run && !!tgt && !vm.answered && tk.length <= 16 && d.length >= 5 && DIGIT_WORD.test(tk[tk.length - 1]) && !RUN_UNITS.test(raw) && !/\?/.test(raw);
    if (!strict && !tail && !(run && tk.length <= 14 && d.length >= 3 && !RUN_UNITS.test(raw))) return null;
    if (!d) return run ? { hold: true, note: 'still holding ' + vmGroup(box, run.d) + ' (' + run.d.length + ' of ' + run.want + ' digits): waiting for the rest' } : null;
    var len = numLen(box), phone = !idLike(box), want = function (x) { return phone && /^27/.test(x) ? 11 : len; };
    if (!run && (d.length < 2 || !(named || !vm.answered || vmValue(box) === '' || d.charAt(0) === '0'))) return null;
    if (!run && d.length >= want(d)) return null;  // the whole number in one line: read as usual
    var all = (run ? run.d : '') + d;
    if (run && all.length > want(all)) all = d;  // too long to be the rest of it: the number is being said again from the start
    if (all.length >= want(all)) { vm.run = null; vm.answered = false; if (box !== vm.target) vmShow(box); return { text: vmGroup(box, all) }; }
    if (box !== vm.target) vmShow(box);  // the number was named while another box was being asked about: the screen goes to it
    vm.answered = false; vm.run = { box: box, d: all, want: want(all) }; vmMarkWait();
    var note = all.length + ' of ' + want(all) + ' digits so far';
    vmNote(box, note + ': waiting for the rest');
    return { hold: true, note: 'holding ' + vmGroup(box, all) + ' (' + note + '): waiting for the rest' };
  }
  /* An email address said in pieces ("it's pool one", "dot kafentzis", "at gmail dot com") is kept here, the way a number is, and never sent to Claude: the email boxes take only a finished address,
     and what Claude is shown of an address is a marker. While an email box is waiting, or one is named ("my work email address is Paul k"), or the line before said an address is coming
     ("my personal email address is"), short lines are joined until the address ends in a domain (.com, .co.za ...) and is then read as one line. "At", "dot" and spelled letters are part of the
     address, never filler. A restart ("let's try that again") drops what was kept; a line that is not a piece of it ends it, and what was heard is put in the box, amber, so nothing said is lost. */
  var EMAIL_BOXES = ['pemail', 'wemail'], EMAIL_LEAD = {}, EMAIL_SKIP = {};
  'email emails mail address addresses personal private office business e-mail'.split(' ').forEach(function (w) { EMAIL_LEAD[w] = 1; });
  ('yes yeah yep yup ok okay alright right so um uh er erm ah hm hmm well let lets me see is it its the that thats this sorry hold on moment second sec minute just give you again please then and next sure my mine your i im ill a am was do does did have has got can could will we us to for from thank thanks wait like with about check checking looking look think hang work perfect great lovely fantastic excellent good fine nice cool awesome wonderful brilliant need needs needed want wanted should must going gonna').split(' ').forEach(function (w) { EMAIL_SKIP[w] = 1; });
  var EMAIL_END = /^[a-z0-9][^@\s]*@[^@\s]+\.(?:com|org|net|edu|gov|biz|info|io|me|app|dev|africa|za|uk|us)$/i;
  var EMAIL_PIECE = /(?:^|\s)(?:dot|period|full ?stop|at|underscore|dash|hyphen|gmail|yahoo|outlook|hotmail|icloud|live|zero|one|two|three|four|five|six|seven|eight|nine)(?=\s|$)|[@.\d]/i;
  var EMAIL_CHATTER = /\b(?:correct|right|problem|problems|error|errors|wrong|there|theres|not|nothing|enter|entering|entered|why|because|program|software|computer|page|form|system|test|testing|try|again|actually|already|really|maybe|definite|different|issue|bug|fix)\b/;
  /* "Delete that", "the personal email address is incorrect": the address is turned down, so the pieces kept are dropped and an address already in the box is emptied. ("Scratch that" stays an undo.) */
  var EMAIL_WIPE = /\b(?:delete|deleted|deleting|remove|removed|clear|cleared|erase|erased|wipe|wiped|get rid of|take out)\b/, EMAIL_BAD = /\b(?:incorrect|wrong|mistake|not (?:right|correct))\b/;
  /* What a word sounds like: its first letter and its consonants, with c, tz, z and so on written alike, so that "cafences" and "Kafentzis" come out the same. */
  function vmNameKey(w) {
    w = String(w).toLowerCase().replace(/[^a-z]/g, '').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/tz/g, 's').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's').replace(/x/g, 'ks').replace(/q/g, 'k').replace(/w/g, 'v');
    return w ? w.charAt(0) + w.slice(1).replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1') : '';
  }
  /* How many letters differ between two words (insert, delete, change). */
  function vmEdit(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return d[a.length][b.length];
  }
  /* Domains that are common, and the firm's own: a heard domain that is a letter or two off one of them ("liferest.co.za") is written as it. */
  var EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'live.com', 'mail.com', 'webmail.co.za', 'mweb.co.za', 'telkomsa.net', 'vodamail.co.za', 'absamail.co.za', 'liferisk.co.za', 'discovery.co.za', 'sanlam.co.za', 'oldmutual.co.za', 'momentum.co.za', 'liberty.co.za', 'absa.co.za', 'fnb.co.za', 'nedbank.co.za', 'standardbank.co.za', 'capitecbank.co.za'];
  /* Speech recognition writes a name the way it sounds ("cafences" for Kafentzis, "heaul" for Paul). A word of the address that sounds like, or is a letter or two off, the first name or the surname already on the form is written as the form has it,
     and a domain that is a letter or two off a common one is written as that one. Whatever is changed is said, and the box stays amber. */
  function vmEmailNames(addr) {
    var at = addr.lastIndexOf('@');
    if (at < 1) return { value: addr, said: '' };
    var names = [String(state.f.fname.v), String(state.f.sname.v)].join(' ').split(/[\s-]+/).concat(String(state.f.sname.v).replace(/[^a-z]/gi, '')).map(function (n) { return n.replace(/[^a-z]/gi, '').toLowerCase(); }).filter(function (n) { return n.length >= 4 && vmNameKey(n).length >= 3; });
    var close = [String(state.f.fname.v), String(state.f.sname.v)].join(' ').split(/[\s-]+/).concat(String(state.f.sname.v).replace(/[^a-z]/gi, '')).map(function (n) { return n.replace(/[^a-z]/gi, '').toLowerCase(); }).filter(function (n, i, all) { return n.length >= 4 && all.indexOf(n) === i; });   // short names such as Paul count here: only the sound-alike test above needs three consonants
    var said = [], local = addr.slice(0, at).replace(/[a-z]{4,}/gi, function (w) {
      var lw = w.toLowerCase(), k = vmNameKey(lw), j, best = null, bd = 99, tie = false;
      if (close.indexOf(lw) >= 0) return w;
      for (j = 0; j < names.length; j++) {
        var nk = vmNameKey(names[j]);
        if (k.length >= 3 && (k === nk || (/^[aeiou]/.test(lw) && k.length >= 4 && k.slice(1) === nk.slice(1) && nk.length >= 4))) { said.push('"' + lw + '" to "' + names[j] + '"'); return names[j]; }   // a vowel added in front ("offenses" for Kafentzis) does not change how it sounds
      }
      if (close.some(function (n) { return lw.indexOf(n) >= 0; })) return w;                    // "paulk", "pkafentzis": a name with something added is how an address is made
      close.forEach(function (n) {
        var d = Math.min(vmEdit(lw, n), vmEdit(lw, n.slice(0, lw.length)), vmEdit(lw, n.slice(0, lw.length + 1)));   // the whole name, or its beginning ("aafem" for "kafen" of Kafentzis)
        if (d < bd) { bd = d; best = n; tie = false; } else if (d === bd && best !== n) tie = true;
      });
      if (best && !tie && bd <= 2 && bd < lw.length / 2) { said.push('"' + lw + '" to "' + best + '"'); return best; }
      return w;
    });
    var dom = addr.slice(at + 1).toLowerCase(), fixed = dom;
    if (EMAIL_DOMAINS.indexOf(dom) < 0) {
      var bestD = null, bdd = 99, tied = false;
      EMAIL_DOMAINS.forEach(function (d) { var e = vmEdit(dom, d); if (e < bdd) { bdd = e; bestD = d; tied = false; } else if (e === bdd) tied = true; });
      if (bestD && !tied && bdd <= Math.max(1, Math.floor(dom.length * 0.2)) && bdd <= 2) { fixed = bestD; said.push('"' + dom + '" to "' + bestD + '"'); }
    }
    return { value: local + '@' + fixed, said: said.length ? 'changed ' + said.join(', ') + ' in the email address (matched to the name on the form, or to a common domain)' : '' };
  }
  /* Spoken digits in the name part of an address are digits ("paul k one" is paulk1): only that part, up to the "at". */
  function vmEmailText(t) {
    t = String(t);
    if (!/\bat\b|@/i.test(t)) t = t.replace(/\b(?:with|add|and|app)\b(?=(?:(?!\b(?:with|add|and|app)\b).)*(?:\.|\bdot\b|gmail|yahoo|outlook|hotmail|icloud)\S*)(?!(?:(?!\b(?:with|add|and|app)\b).)*\b(?:with|add|and|app)\b)/i, 'at');   // "with" heard for "at": the last such word, when a domain follows it
    var m = /^(.*?)(\s+at\s+.*|@.*)?$/i.exec(t), DIG = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
    return m[1].replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi, function (w) { return DIG[w.toLowerCase()]; }) + (m[2] || '');
  }
  /* The pieces end here: what was heard is put in the box (amber) when it already looks like an address, so nothing said is lost. */
  function vmEmailGiveUp() {
    var r = vm.erun; vm.erun = null;
    if (!r) return;
    var part = V.spokenEmail(vmEmailText(r.t));
    if (/^[^@\s]+@[^@\s]+$/.test(part) && vmApply(r.box, { kind: 'fill', value: vmEmailNames(part).value, status: 'verify' })) { vmLog('the email address was not finished: put in the box as heard, check it'); toast('The email address was not finished. Check it, or say it again.'); }
    else vmLog('the email address was not finished: nothing was filled');
  }
  /* The address in what was said, or '' when it is not yet one. Not V.interpret: for an email box that reads "no" or "not" anywhere in the words as "I have no email address" ("full one, not defenses, at gmail.com" came out as None). */
  function vmEmailParse(t) { var em = V.spokenEmail(vmEmailText(t)); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? em : ''; }
  function vmEmailRun(text) {
    var raw = String(text == null ? '' : text), low = raw.toLowerCase().replace(/[‘’`]/g, "'"), run = vm.erun, hasWord = /\be-?mail\b/.test(low), named = null;
    if (hasWord) named = /\b(?:work|office|business)\b/.test(low) ? 'wemail' : 'pemail';
    var tgt = vm.target && EMAIL_BOXES.indexOf(vm.target) >= 0 ? vm.target : null;
    var giveUp = function () { vmEmailGiveUp(); vm.answered = false; vmMarkWait(); };
    var done = function (box, value) {
      var fx = vmEmailNames(value);
      vm.erun = null; vm.eann = null; vm.answered = false; if (box !== vm.target) vmShow(box);
      if (fx.said) toast('Email address: ' + fx.said + '. Check it.');
      return { text: fx.value, said: fx.said };
    };
    if (run && (run.box !== tgt || (hasWord && named !== run.box))) { giveUp(); run = null; }  // the talk has moved on to another box
    var box = run ? run.box : (named || tgt), fd = box && vmField(box);
    if (!box || !fd || !vmVisible(fd) || vmValue(box) === 'None') return null;
    var armedNow = !!vm.eann && vm.eann.box === box && Date.now() - vm.eann.at < 20000;
    var voided = !/\?/.test(raw) && raw.split(/\s+/).length <= 14 && ((EMAIL_WIPE.test(low) && (hasWord || /\b(?:that|it|this|those|them)\b/.test(low))) || (hasWord && EMAIL_BAD.test(low)));
    if (voided) {                                                                                     // only when little else is said: "I will remove it from my mailing list later" is not a request
      var left = low.replace(new RegExp(RUN_CANCEL.source + '|' + EMAIL_WIPE.source + '|' + EMAIL_BAD.source, 'ig'), ' ').split(/\s+/).map(function (w) { return w.replace(/[^a-z0-9@.]/g, ''); }).filter(function (w) { return w && !EMAIL_SKIP[w] && !EMAIL_LEAD[w]; });
      voided = left.length <= 2 || (left.length <= 8 && EMAIL_PIECE.test(left.join(' ')));
    }
    if (voided && !run && vmValue(box) === '') return armedNow ? { hold: true, note: 'the email box is already empty: ready for the address again' } : null;   // nothing here to delete: the line is for Claude
    var restart = voided || (!!run && RUN_CANCEL.test(low)), body = restart ? raw.replace(new RegExp(RUN_CANCEL.source + '|' + EMAIL_WIPE.source + '|' + EMAIL_BAD.source, 'ig'), ' ') : raw;
    if (!restart && (/\?/.test(raw) || vmReadBack(raw) || vmAgreeStmt(raw) || V.looksLikeQuestion(raw) || /\b(?:tell|ask|asking|wondering|whether|if|what|which|how|why|when|where|who)\b/.test(low))) return null;
    var clean = function (w) { return w.toLowerCase().replace(/[.,!?;:'‘’`"]/g, ''); }, single = function (w) { return /^[a-z0-9][.,]?$/i.test(w); };
    var toks = body.split(/\s+/).filter(Boolean), i = 0;
    while (i < toks.length && (EMAIL_SKIP[clean(toks[i])] || EMAIL_LEAD[clean(toks[i])]) && !(single(toks[i]) && i + 1 < toks.length && single(toks[i + 1])) && !(/^(?:with|and)$/.test(clean(toks[i])) && /\.|\bdot\b|gmail|yahoo|outlook|hotmail|icloud/i.test(toks.slice(i + 1).join(' ')))) i++;   // "Okay." and "Yes." are filler, however the speech recogniser punctuated them; a run of single letters is a spelled word, never filler
    var pay = toks.slice(i), payText = pay.join(' '), spelled = pay.length >= 3 && pay.filter(single).length >= pay.length * 0.7;
    if (run && !restart && !(pay.length <= 2 || spelled || (pay.length <= 7 && EMAIL_PIECE.test(low)))) { giveUp(); return null; }   // something else was said: the pieces end here
    if (restart) {
      run = vm.erun = null; vm.answered = false; vm.eann = { box: box, at: Date.now() };
      var gone = voided && vmEmptyBox(box);
      if (gone) { touch(); redraw(); vmLog('cleared ' + fd.label); toast('Cleared: ' + fd.label + '. Say "scratch that" to bring it back.'); }
      if (voided) vmShow(box); else vmMarkWait();
      if (!pay.length || (voided && !spelled && !EMAIL_PIECE.test(payText))) return { hold: true, note: gone ? 'cleared the email address: ready for it again' : 'dropped the email heard so far: ready for it again' };
    }
    var armed = !!vm.eann && vm.eann.box === box && Date.now() - vm.eann.at < 20000, cue = !!named || armed;   // "my personal email address is" says the next line is the address
    if (!run) {
      if (!pay.length) { if (hasWord) vm.eann = { box: box, at: Date.now() }; return null; }
      var denied = /\b(?:no|not|none|nothing|dont|don't|do not|havent|haven't|neither|never|nope|nah|without)\b/.test(low);
      if (SAID_UNDO.test(low)) return null;                                                      // "scratch that" is a request, not a piece of an address, even right after the address was asked for
      if (denied || !(cue || !vm.answered || vmValue(box) === '')) return null;
      var whole = vmEmailParse(payText);
      if (whole && EMAIL_END.test(whole)) return done(box, whole);   // the whole address in one line, however it was dictated or spelled: written plainly, so that only a marker goes to Claude
      if (pay.length > (cue ? 4 : /\bat\s+\S/i.test(payText) ? 5 : 3) && !spelled) return null;
      if (!cue && EMAIL_CHATTER.test(low.replace(/'/g, ''))) return null;                        // other chatter may not start one
      if (!cue && pay.length > 1 && !EMAIL_PIECE.test(payText) && !(vm.target === box && !vm.answered)) return null;   // a lone name, or words with a sign of an address in them, may start one
    }
    var all = (run ? run.t + ' ' : '') + payText, x = vmEmailParse(all);
    if (x && EMAIL_END.test(x)) return done(box, x);
    if (box !== vm.target) vmShow(box);
    vm.answered = false; vm.erun = { box: box, t: all.trim() }; vmMarkWait();
    vmNote(box, 'email so far: ' + all.trim() + ' (waiting for the rest)');
    return { hold: true, note: 'holding the email address heard so far: waiting for the rest' };
  }
  /* An answer for an ID, tax or phone box with too few digits (however it got here: this computer's reading, the quick fill or Claude) is kept, not filled: the rest of the number is waited for. */
  function vmHoldPartial(box, value) {
    var v = String(value == null ? '' : value), d = v.replace(/\D/g, '');
    if (/[a-z]/i.test(v) || d.length < 2 || (box === 'idno' && state.f.idtype.v === 'Passport')) return false;
    var want = !idLike(box) && /^27/.test(d) ? 11 : numLen(box);
    if (d.length >= want) return false;
    vm.run = { box: box, d: d, want: want }; vm.answered = false; vmMarkWait();
    vmNote(box, d.length + ' of ' + want + ' digits so far: waiting for the rest');
    vmLog('holding ' + vmGroup(box, d) + ' (' + d.length + ' of ' + want + ' digits): waiting for the rest');
    return true;
  }
  /* A line kept for a number still being said: shown in the conversation box, not sent to Claude, nothing filled. */
  function vmKeepLine(text, who, meta, note) {
    var entry = { who: who === 'me' ? 'adviser' : who === 'client' ? 'client' : 'unclear', text: text, shown: text, at: Date.now(), did: [note], done: true, m: meta || null, skip: /^(?:paused|ignored)/.test(note) };
    cvAdd(entry); cv.live = ''; convoSoon();
    var p = Promise.resolve(entry); p.entry = entry; return p;
  }
  /* A number held in a private box can be edited by speaking: "add an 8 to the end", "put a zero in front", "the last digit is 8", "it ends in 98", "change the last digit to 5", "remove the last digit".
     These boxes are never shown to Claude, so it is done here. The box goes amber again: the client agrees to the new number. */
  var NUM_LEN = { idno: 13, tax: 10, cell: 10, work: 10, home: 10, sp_tel: 10 };
  var DWS = '(?:\\d+|oh|zero|one|two|three|four|five|six|seven|eight|nine|double|triple)', DWSEQ = DWS + '(?:[\\s,.-]+' + DWS + ')*';
  var E_ADD = new RegExp('\\b(?:add|put|stick|tack|attach|append)(?:ing)?\\s+(?:in\\s+)?(?:an?\\s+|the\\s+|another\\s+)?(?:digit\\s+|number\\s+)?(' + DWSEQ + ')\\s+(?:to|at|on|onto|in)\\s+(?:the\\s+)?(end|back|start|front|beginning)\\b', 'i');
  var E_END = new RegExp('\\b(?:(?:it\\s+|that\\s+|which\\s+)?ends?|ending)\\s+(?:in|with|on)\\s+(?:an?\\s+)?(' + DWSEQ + ')', 'i');
  var E_LAST = new RegExp('\\blast\\s+(?:(?:one|two|three|four|\\d)\\s+)?(?:digit|digits|number|numbers)\\s+(?:is|are|should be|must be|was|were|will be)\\s+(?:an?\\s+)?(' + DWSEQ + ')', 'i');
  var E_SET = new RegExp('\\b(?:change|make|replace|correct)\\s+(?:the\\s+)?last\\s+(?:digit|number)\\s+(?:to|with|into|a|an)\\s+(?:an?\\s+)?(' + DWSEQ + ')', 'i');
  var E_CUT = /\b(?:remove|delete|drop|take off|cut|scratch)\s+(?:the\s+)?last\s+(?:(one|two|three|\d)\s+)?(?:digit|digits|number|numbers)\b/i;
  /* -> { op: 'add' | 'ends' | 'set' | 'cut', d: digits, pos, n } or null when the line is not an edit of a number. */
  function vmEditParse(text) {
    var t = String(text == null ? '' : text), m;
    if (t.split(/\s+/).length > 20) return null;
    if ((m = E_CUT.exec(t))) return { op: 'cut', n: ({ one: 1, two: 2, three: 3 })[(m[1] || '').toLowerCase()] || (m[1] ? +m[1] : 1) };
    if ((m = E_SET.exec(t)) && V.spokenDigits(m[1])) return { op: 'set', d: V.spokenDigits(m[1]) };
    if ((m = E_ADD.exec(t)) && V.spokenDigits(m[1])) return { op: 'add', d: V.spokenDigits(m[1]), pos: /start|front|beginning/i.test(m[2]) ? 'start' : 'end' };
    if ((m = E_LAST.exec(t) || E_END.exec(t)) && V.spokenDigits(m[1])) return { op: 'ends', d: V.spokenDigits(m[1]) };
    return null;
  }
  function vmEditDigits(text) {
    var ed = vmEditParse(text);
    if (!ed) return false;
    var id = isNumBox(vm.target) ? vm.target : vm.lastNum, held = vm.run && vm.run.box === id ? vm.run : null, cur = held ? held.d : (id ? vmValue(id).replace(/\D/g, '') : '');
    if (!id || !cur) return false;                                               // no number is held to edit: the line is read as usual
    var f = vmField(id), len = held ? held.want : numLen(id), next, what;
    if (ed.op === 'add') { next = ed.pos === 'start' ? ed.d + cur : cur + ed.d; what = 'added ' + ed.d + ' to the ' + ed.pos + ' of'; }
    else if (ed.op === 'cut') { next = cur.slice(0, Math.max(0, cur.length - ed.n)); what = 'removed the last ' + (ed.n > 1 ? ed.n + ' digits' : 'digit') + ' of'; }
    else if (ed.op === 'set') { next = cur.slice(0, Math.max(0, cur.length - ed.d.length)) + ed.d; what = 'changed the end to ' + ed.d + ' in'; }
    else {
      if (cur.slice(-ed.d.length) === ed.d) { vmLog(f.label + ' already ends in ' + ed.d); return true; }
      next = cur.length + ed.d.length <= len ? cur + ed.d : cur.slice(0, Math.max(0, len - ed.d.length)) + ed.d; what = 'set the end to ' + ed.d + ' in';
    }
    if (held && next.length < len) {  // a number still being said: the digits kept are edited, and it goes on waiting
      held.d = next; vmNote(id, next.length + ' of ' + len + ' digits so far: waiting for the rest');
      vmLog(what + ' ' + f.label + ': now holding ' + vmGroup(id, next) + ' (' + next.length + ' of ' + len + ' digits)');
      return true;
    }
    if (held) { vm.run = null; vm.answered = false; }  // the edit completed it
    var x = V.interpret(f, next);
    if (vmApply(id, { kind: 'fill', value: x && !x.error ? x.value : next, status: 'verify' })) vmLog(what + ' ' + f.label);
    return true;
  }
  /* Empties one box, keeping what was in it so that "scratch that" brings it back. False when it was empty already. */
  function vmEmptyBox(id) {
    var cell = state.f[id]; if (!cell || cell.v === '') return false;
    vm.noSweep[id] = 1;
    vm.undo.push({ kind: 'fill', id: id, prev: { v: cell.v, st: cell.st }, extras: [] });
    store.setField(state, id, '', 'empty'); return true;
  }
  /* "Scratch the first name and the surname", "clear his cell number": the boxes named are emptied. (The page's own "scratch that" only undoes the last change.) */
  var CLEAR_NAMED = /\b(?:scratch|clear|delete|remove|erase|wipe|forget|empty)(?:ed|ing)?\s+(?:out\s+)?(?:(?:the|my|his|her|their|our)\s+)?(.+)$/i;
  function vmClearNamed(text) {
    var m = text.split(/\s+/).length <= 16 && CLEAR_NAMED.exec(text.replace(/[.!?]+$/, '')), cmd = m && V.parseCommand(text, vidx);
    if (!m || (cmd && cmd.type === 'clearAll')) return false;
    var ids = [], ok = m[1].split(/\s*(?:,|\band\b|\bas well as\b|\bplus\b)\s*/i).filter(function (x) { return /\w/.test(x); }).every(function (part) {
      var hit = V.matchQuestion(part.replace(/^(?:the|my|his|her|their|our)\s+/i, '').replace(/\s+(?:please|again|now)$/i, ''), vidx, { cur: cur }), f = hit && hit.score >= 3 ? vmField(hit.id) : null;
      if (!f || f.list || !vmVisible(f)) return false;
      if (ids.indexOf(hit.id) < 0) ids.push(hit.id);
      return true;
    });
    if (!ok || !ids.length) return false;
    var gone = [];
    ids.forEach(function (id) {
      if (vmEmptyBox(id)) gone.push(vmField(id).label);
    });
    vm.digits = null; vm.run = null; vm.erun = null; touch(); redraw();
    vmShow(ids[0]);                                                              // the first box glows, waiting for the new answer
    vmLog(gone.length ? 'cleared ' + gone.join(', ') : 'nothing to clear in ' + ids.map(function (id) { return vmField(id).label; }).join(', '));
    if (gone.length) toast('Cleared: ' + gone.join(', ') + '. Say "scratch that" to bring ' + (gone.length > 1 ? 'them' : 'it') + ' back.');
    return true;
  }
  /* ---------- fill at once, then Claude checks ---------- */
  /* Waiting for Claude takes seconds, so a clear answer (a name, a yes, a number: what the page itself understands with confidence) goes into the form straight away, and Claude then reads
     the line as well. If Claude reads it the same way nothing changes, and anything more it heard is added; if it reads it differently the box is put back (unless it has been changed
     since) and Claude's reading is used. A line the page is not sure of, or any line while an earlier one is still waiting for Claude, waits for Claude as before. */
  /* Whether Claude may see ID, tax and phone numbers and email addresses (Settings). Off unless switched on; see voice-ai.js. */
  var SHARE_KEY = 'wr-fact-find-share';
  function vmShareOn() { try { return localStorage.getItem(SHARE_KEY) === '1'; } catch (e) { return false; } }
  function vmShareApply() { if (VAI && VAI.setShare) VAI.setShare(vmShareOn()); }
  var QUICK_KEY = 'wr-fact-find-quick-2';
  function vmQuickOn() { try { return localStorage.getItem(QUICK_KEY) === '1'; } catch (e) { return false; } }
  function vmQuickTry(text, entry) {
    if (vmEditParse(text) || vm.run || vm.erun) return null;
    if (!vmQuickOn() || !vmAIReady() || vm.wipe || vm.noteMode || vm.slow > 0 || text.split(/\s+/).length > 16) return null;
    var acts = vmPlanFor(text, entry).actions;
    if (!acts.length || acts.length > 4 || !acts.some(function (a) { return a.do === 'fill'; })) return null;
    if (!acts.every(function (a) { var f = a.field && !vmCellRef(a.field) ? vmField(a.field) : null; return (a.do === 'fill' || a.do === 'ask') && !a.tentative && !!f && vmVisible(f); })) return null;
    var mark = vm.undo.length, was = vmCur;
    vmCur = entry || null;
    try { acts.forEach(function (a) { vmDo(a); }); } finally { vmCur = was; }
    var entries = vm.undo.slice(mark).filter(function (e) { return e.kind === 'fill'; });
    entries.forEach(function (e) { e.applied = {}; [e.id].concat((e.extras || []).map(function (x) { return x.id; })).forEach(function (id) { e.applied[id] = state.f[id].v; }); });
    return { actions: acts, entries: entries };
  }
  /* Puts back what a quick fill wrote, for each box that still holds exactly that (one that has been typed in or corrected since is left alone). */
  function vmTakeBack(entries) {
    entries.forEach(function (e) {
      var ids = [e.id].concat((e.extras || []).map(function (x) { return x.id; }));
      if (!ids.every(function (id) { return state.f[id] && state.f[id].v === e.applied[id]; })) return;
      state.f[e.id] = { v: e.prev.v, st: e.prev.st };
      (e.extras || []).forEach(function (x) { state.f[x.id] = { v: x.prev.v, st: x.prev.st }; });
      var i = vm.undo.indexOf(e); if (i >= 0) vm.undo.splice(i, 1);
    });
    vmLog('took back ' + entries.map(function (e) { var f = vmField(e.id); return f ? f.label : e.id; }).join(', '));
    touch(); redraw(); vmMarkWait();
  }
  function vmCheckQuick(text, entry) {
    return vmDecide(text, entry).then(function (r) {
      if (!r) return;                                                                // Claude could not be reached: what was filled stands
      vmTakeUnplaced(r);
      var acts = r.kind === 'actions' ? r.actions : [], rc = VAI.reconcile(entry.quick.actions, acts, vidx);
      if (!rc.agree) { vmTakeBack(entry.quick.entries); entry.changed = true; }
      var put = {}; entry.quick.entries.forEach(function (e) { put[e.id] = 1; (e.extras || []).forEach(function (x) { put[x.id] = 1; }); });
      var rest = rc.rest.filter(function (a) { return !(a.do === 'confirm' && a.field && put[a.field]); });             // saying a value is not agreeing to it: the client agrees in a later line
      return vmRun(rest).then(function () { return vmRestOfLine(acts, text, text.split(/\s+/).length); });
    });
  }
  /* Claude is asked to read the unchanging part of its instructions as soon as voice mode is on, so the first line is not slowed by it. */
  var warmedAt = 0, warmedModel = '';
  function vmWarm() {
    var set = FF.lookup.getSettings();
    if (!set.apiKey || !VAI || !VAI.warm || (warmedModel === set.voiceModel + vmShareOn() && Date.now() - warmedAt < 50 * 60000)) return;
    warmedModel = set.voiceModel + vmShareOn(); warmedAt = Date.now();
    VAI.warm({ apiKey: set.apiKey, model: set.voiceModel, idx: vidx, fetchImpl: meteredFetch });
  }
  /* A line whose speaker is not known. It may hold the adviser and the client together, in any order, with corrections and things they do not have.
     Claude reads it and says what to do on the form; this computer's own reading is used only for a bare command word, while notes are being taken,
     for a one or two word answer, and when Claude cannot be reached. */
  var NOTES_LEADIN = /^\s*(?:(?:okay|ok|right|so|and|alright|now|well|yes|yeah)[ ,]+)*(?:that(?:'s|s| is)?|this is|we are|we're|i am|i'm) (?:the end of|done with|finished with|finished|done)(?: with)?(?: the)? (?:noting|notes|note[- ]?taking|taking notes|making notes)(?: that| there| now| for now)?[.,!]?\s*/i;
  function vmProcessAuto(text, entry) {
    if (vm.wipe) {                                                       // "Delete all data from the entire form?" is waiting: only yes or no counts, and nothing goes to Claude
      var ans = V.wipeAnswer(text);
      if (ans) return vmWipeEnd(ans === 'yes');
      toast('Waiting for a yes or no: delete all data from the entire form?');
      return Promise.resolve();
    }
    if (vm.noteMode) {                                                   // "He wants it for school fees. I've noted that, I've completed those notes. Let's talk about the children.": what comes before is the last of the notes, then the notes end, and the rest is read as a line
      var endN = V.splitNotesEnd(text) || (NOTES_LEADIN.test(text) ? { before: [], rest: [text.replace(NOTES_LEADIN, '')] } : null);
      if (endN) {
        var lastNote = endN.before.join('. ').trim(), rest = endN.rest.join(' ').trim(), more = rest.split(/\s+/).filter(function (w) { return /\w/.test(w); }).length >= 2;
        var closing = Promise.resolve(lastNote && V.pointForm(lastNote).length ? vmAddNote(lastNote) : null).then(function () { vmStopNotes(); vmLog('notes ended'); });
        if (!more) return closing;
        if (entry) entry.call = null;
        return closing.then(function () { return vmProcessAuto(rest, entry); });
      }
    }
    if (entry && entry.quick) return vmCheckQuick(text, entry);
    if (vmEditDigits(text)) return Promise.resolve();                    // "add an 8 to the end"
    if (vmClearNamed(text)) return Promise.resolve();                    // "scratch the first name and the surname"
    var pl = vmPlanFor(text, entry);
    var startsNotes = pl.actions.some(function (a) { return a.do === 'cmd' && a.cmd && a.cmd.type === 'notes'; });   // this computer's guess that the notes begin is not trusted: "in the notes", "scratch all notes" and "deleting so stop notes" all looked like it, and the notes then took the next ten lines
    var words = text.split(/\s+/).length, onlyCommand = pl.actions.length > 0 && pl.actions.every(function (a) { return (a.do === 'cmd' && !(vmAIReady() && /^(?:undo|clear|clearAll)$/.test(a.cmd && a.cmd.type))) || (a.do === 'done' && a.via === 'said'); }) && words <= 10 && !startsNotes;   // an adviser's "that concludes the debts" is plain enough to follow without asking Claude; undo and clear destroy work: with Claude available it decides, from the lines before, whether they were really asked for
    /* A bare "yes" or "correct" may agree to several boxes that were just read back: Claude decides which, from the lines before it. */
    var agree = words <= 2 && V.isConfirm(text, true) && !pl.actions.some(function (a) { return a.do === 'fill'; }) && vmAwaiting().awaiting.length > 0;
    if (vm.noteMode && vmAIReady() && (startsNotes || (pl.actions.every(function (a) { return a.do === 'note'; }) && (vmMayLeaveNotes(text) || V.mentionsNotes(text) || V.mayEndNotes(text))))) return vmAskInNotes(text, pl);       // a line that talks about the notes may be ending them, in words this computer does not know
    if (vm.noteMode || onlyCommand || !vmAIReady()) return vmRun(pl.actions);  // every other line, however short, is read by Claude with the lines before it
    return vmDecide(text, entry).then(function (r) {
      vmTakeUnplaced(r);
      if (r && r.kind === 'actions') return vmRun(vmAgreeActions(vmGuardReadBack(r.actions, text), text)).then(function () { return vmRestOfLine(r.actions, text, words); });
      if (vmAgreedBox(text)) return vmRun(vmAgreeActions([], text));                  // Claude had nothing to say about a plain statement that a box is correct
      if (!r || agree) return vmRun(pl.actions);                         // Claude could not be reached, or had nothing to add to a plain yes: this computer's best reading
    });
  }
  /* A long line that only moved to another section, or only switched the notes on, may have more in it ("let's talk about your investments. Do you have a tax free? Yes, Old Mutual, R3400 a month";
     "I'd like to make some notes about the tax free. The client told me it is for his son's fees").
     Safety net: ask Claude once more, with a note saying what the page already did, for the rest of the line. Nothing was filled or written by the first answer, so nothing is done twice. */
  var vmRest = false;
  function vmRestOfLine(actions, text, words) {
    var cmdIs = function (a, re) { return a.do === 'cmd' && a.cmd && re.test(a.cmd.type); }, moveRe = /^(goto|nextSection|prevSection)$/;
    var moved = actions.some(function (a) { return a.do === 'section' || cmdIs(a, moveRe); });
    var did = actions.some(function (a) { return a.do === 'fill' || a.do === 'row' || a.do === 'cell' || a.do === 'confirm' || a.do === 'note'; });
    var noted = actions.some(function (a) { return cmdIs(a, /^notes$/) && !a.cmd.retro; }) && !actions.some(function (a) { return a.do === 'note'; });   // "note that down" takes the line before, so it is not asked again
    var why = noted && words >= 10 ? 'The page has already switched the notes on for this line. Do not switch them on again: write what was said in the notes with "note" actions, and do anything else the line asks.'
      : moved && !did && !vm.noteMode && words >= 14 ? 'The page has already moved to the section "' + vmSecTitle(cur) + '" because of this line. Do not move again: do the rest of the line that belongs here.' : null;
    if (!why || vmRest) return null;
    vmRest = true;
    return vmAsk('auto', text, why).then(function (r) {
      vmRest = false; vmTakeUnplaced(r);
      if (r && r.kind === 'actions') return vmRun(vmGuardReadBack(r.actions.filter(function (a) { return a.do !== 'section' && !cmdIs(a, moveRe) && !cmdIs(a, /^notes$/); }), text));
    }, function () { vmRest = false; });
  }
  /* ---------- heard but not placed, and the catch-up check ----------
     A fact that was said but never reached a box is kept in a list ("Heard but not placed") with the Fact Find until the adviser puts it in a box, adds it to the notes or dismisses it. Facts get there from Claude
     (it names facts it had no box for), from the page (a box that is not shown, a value that cannot be read as that box's answer, a volunteered fact that would overwrite a confirmed one) and from the catch-up check:
     the conversation read again against the form, when the talk leaves a section and when voice is switched off. The check fills only boxes that are empty, as amber "to verify", and never a box that was emptied on purpose. */
  function vmFreshForm() { vm.done = {}; vm.unplacedSeen = {}; vm.noSweep = {}; vm.secAt = {}; vm.sweptAll = cv.all.length; clearTimeout(vm.sweepT); vm.sweepSecs = {}; }
  function vmUnplace(item) {
    var it = store.addUnplaced(state, Object.assign({ sec: cur }, item), vm.unplacedSeen);
    if (!it) return null;
    vmLog('not placed: ' + it.text);
    touch(); convoSoon();
    return it;
  }
  /* A fact kept in "Heard but not placed" only because its box was switched off (the area was not a priority yet) is put in, as amber "verify", as soon as the box shows and is still empty. */
  function vmRetryUnplaced() {
    (state.unplaced || []).slice().forEach(function (u) {
      if (!u.field || u.value == null || !/not shown/.test(u.why || '')) return;
      var f = vmField(u.field); if (!f || !vmVisible(f) || state.f[u.field].v !== '') return;
      var x = V.interpret(f, u.value); if (!x || x.error) return;
      store.closeUnplaced(state, u.id, vm.unplacedSeen);
      vmApply(u.field, { kind: 'fill', value: x.value, status: 'verify', extra: x.extra });
      vmLog('put in ' + f.label + ' now that the box shows: ' + vmShown(u.field, x.value));
    });
    unplacedRender();
  }
  function vmTakeUnplaced(r) { if (r && r.unplaced) r.unplaced.forEach(function (u) { vmUnplace({ text: u.text, sec: u.section || cur }); }); }
  /* What a value is shown as in the list: never a private one. */
  function vmShown(id, value) { return vmPrivate(id) && !vmShareOn() ? '(a value was said)' : String(value); }
  function unplacedNotesBox(it) {
    var pick = function (sec) { var b = vidx.notes.filter(function (n) { return n.sec === sec && vmVisible(n); }); return b.length ? b[0].id : null; };
    return (it.sec && pick(it.sec)) || pick(cur);
  }
  function unplacedRender() {
    var box = document.getElementById('cvUnplaced'); if (!box) return;
    var list = state.unplaced || [];
    box.hidden = !list.length;
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="cv-unp-head">Heard but not placed (' + list.length + ')</div>' + list.map(function (u) {
      var f = u.field ? schema.fieldsById[u.field] : null, btns = '';
      if (f) btns += '<button type="button" class="link-btn" data-up="' + u.id + ':put">Put in ' + esc(f.l) + '</button>';
      if (u.list && schema.lists[u.list]) btns += '<button type="button" class="link-btn" data-up="' + u.id + ':row">Add to ' + esc(schema.lists[u.list].title) + '</button>';
      if (unplacedNotesBox(u)) btns += '<button type="button" class="link-btn" data-up="' + u.id + ':note">Add to notes</button>';
      btns += '<button type="button" class="link-btn" data-up="' + u.id + ':no">Dismiss</button>';
      var where = u.sec ? 'Section: ' + vmSecTitle(u.sec) : '';
      return '<div class="cv-unp"><div class="cv-unp-text">' + esc(u.text) + '</div>' + (u.why || where ? '<div class="cv-unp-why">' + esc([u.why, where].filter(Boolean).join(' · ')) + '</div>' : '') + '<div class="cv-unp-btns">' + btns + '</div></div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-up]'); if (!b) return;
    var p = b.dataset.up.split(':'), it = (state.unplaced || []).filter(function (x) { return x.id === p[0]; })[0]; if (!it) return;
    var ok = true;
    if (p[1] === 'put') ok = unplacedPut(it); else if (p[1] === 'row') ok = unplacedRow(it); else if (p[1] === 'note') ok = unplacedNote(it);
    if (ok) { store.closeUnplaced(state, it.id, vm.unplacedSeen); touch(); unplacedRender(); refreshChrome(); }
  });
  function unplacedPut(it) {
    var f = vmField(it.field), x = f ? V.interpret(f, it.value) : null;
    if (!f || !x || x.error) { toast('That could not be read as an answer for ' + (f ? f.label : 'the box') + '. Type it in.'); return false; }
    if (cur !== f.sec) { cur = f.sec; redraw(); }
    vmApply(it.field, { kind: 'fill', value: x.value, status: 'verify', extra: x.extra });
    toast('Put in ' + f.label + '.'); return true;
  }
  function unplacedRow(it) {
    if (!vidx.lists[it.list]) return false;
    vmAddRow(it.list, it.values); toast('Added to ' + vidx.lists[it.list].title + '.'); return true;
  }
  function unplacedNote(it) {
    var id = unplacedNotesBox(it); if (!id) { toast('There is no notes box for this section.'); return false; }
    var c = state.f[id];
    vm.undo.push({ kind: 'fill', id: id, prev: { v: c.v, st: c.st }, extras: [] });
    store.setField(state, id, c.v ? c.v.replace(/\s+$/, '') + '\n- ' + it.text : '- ' + it.text, 'heard');
    touch(); redraw(); toast('Added to the notes.'); return true;
  }

  /* ---- the catch-up check ---- */
  var SWEEP_KEY = 'wr-fact-find-sweep';
  function vmSweepMode() { try { var v = localStorage.getItem(SWEEP_KEY); return v === '0' || v === '1' ? v : '2'; } catch (e) { return '2'; } }        // 2: at each section and at the end, 1: at the end only, 0: only the button
  /* The talk has moved to another section: the one it left is checked, after a short pause for the lines still being read. */
  function vmEnter(from) {
    if (from === cur) return;
    vm.secAt[cur] = cv.all.length;
    if (!vm.on || vmSweepMode() !== '2' || !from) return;
    var since = vm.secAt[from] == null ? 0 : vm.secAt[from];
    if (cv.all.length - since < 5) return;                                                    // hardly anything was said there
    var empty = vidx.fields.some(function (f) { return f.sec === from && !f.list && vmVisible(f) && !vmPrivate(f.id) && state.f[f.id].v === ''; }), lists = Object.keys(vidx.lists).some(function (k) { return vidx.lists[k].sec === from; });
    if (!empty && !lists) return;
    vm.sweepSecs[from] = Math.max(0, since - 3);
    clearTimeout(vm.sweepT);
    vm.sweepT = setTimeout(function () { var secs = vm.sweepSecs; vm.sweepSecs = {}; Object.keys(secs).forEach(function (sec) { vmSweep({ sec: sec, from: secs[sec], why: 'section' }); }); }, 2500);
  }
  function vmSweepLines(from) {
    return cv.all.slice(Math.max(0, from || 0)).filter(function (e) { return !e.engine && !e.sweep && !e.skip && e.text; }).slice(-400).map(function (e) { return { who: e.who, text: e.text }; });
  }
  function vmSweep(o) {
    var manual = o.why === 'button';
    if (!VAI || !VAI.sweep || !vmAIReady()) { if (manual) toast('The check needs Claude: put the Anthropic key in Settings.'); return Promise.resolve(); }
    if (vm.sweeping) { vm.sweepNext.push(o); return Promise.resolve(); }
    var lines = vmSweepLines(o.from);
    if (lines.length < (manual ? 1 : 3)) { if (manual) toast('Nothing has been said yet.'); return Promise.resolve(); }
    if (!o.sec) vm.sweptAll = cv.all.length;
    var title = o.sec ? vmSecTitle(o.sec) : 'the whole meeting', set = FF.lookup.getSettings();
    var entry = { who: 'sweep', text: 'Catch-up check: ' + title, shown: 'Catch-up check: ' + title, at: Date.now(), did: [], done: false, m: null, sweep: true };
    vm.sweeping = true; vm.busy++; vmRender();
    if (manual) toast('Checking ' + title + ' for answers that were missed…');
    return vm.queue.then(function () {                                                        // every line heard so far is on the form first
      cvAdd(entry); convoSoon();
      var fl = vmFilled(), notes = {};
      vidx.notes.forEach(function (n) { var v = state.f[n.id] && String(state.f[n.id].v || '').trim(); if (v) notes[n.sec] = (notes[n.sec] ? notes[n.sec] + '\n' : '') + v.slice(0, 600); });
      return VAI.sweep({ notes: notes, listed: (state.unplaced || []).map(function (u) { return u.text; }),  apiKey: set.apiKey, ask: !set.apiKey && FF.voiceBackend && FF.voiceBackend.available ? FF.voiceBackend.ask : null, model: set.voiceModel, idx: vidx, transcript: lines, filled: fl.filled, hidden: vmHiddenMap(),
        listRows: function (key) { return state.l[key].map(function (r) { return r.d; }); }, focus: o.sec || null, fetchImpl: meteredFetch });
    }).then(function (r) { vmSweepApply(entry, r, o, manual); }, function (err) {
      entry.did.push('could not check: ' + ((err && err.message) || 'no answer'));
      if (manual) toast('The check could not be done (' + ((err && err.message) || 'no answer') + ').');
    }).then(function () {
      entry.done = true; entry.doneAt = Date.now(); vm.sweeping = false; vm.busy--; vmRender(); convoSoon();
      var next = vm.sweepNext.shift(); if (next) vmSweep(next);
    });
  }
  function vmSweepApply(entry, r, o, manual) {
    var acts = r && r.kind === 'actions' ? r.actions : [], n = 0, was = vmCur, wasQuiet = vmQuiet, before = (state.unplaced || []).length;
    vmCur = entry; vmQuiet = true;                                                           // nothing moves the highlight or the cursor
    try {
      acts.forEach(function (a) {
        if (a.do === 'fill') n += vmSweepFill(a);
        else if (a.do === 'cell') n += vmSweepCell(a);
        else if (a.do === 'row') vmSweepRow(a);
      });
      ((r && r.unplaced) || []).forEach(function (u) { vmUnplace({ text: u.text, sec: u.section || o.sec || cur }); });
    } finally { vmCur = was; vmQuiet = wasQuiet; }
    var found = (state.unplaced || []).length - before;
    if (!n && !found) entry.did.push('nothing was missed');
    if (n || found) { touch(); redraw(); }
    if (n || found || manual) toast(n || found ? 'Catch-up check: ' + (n ? n + ' missed answer' + (n > 1 ? 's' : '') + ' filled in amber to verify' : '') + (n && found ? ', ' : '') + (found ? found + ' fact' + (found > 1 ? 's' : '') + ' heard but not placed' : '') + '.' : 'Catch-up check: nothing was missed.');
  }
  function vmSweepFill(a) {
    var id = a.field, f = vmField(id);
    if (!f || f.list || vmPrivate(id) || vm.noSweep[id]) return 0;
    if (!vmVisible(f)) { vmUnplace({ text: f.label + ': ' + a.value, why: 'that box is not shown for this client', field: id, value: String(a.value), sec: f.sec }); return 0; }
    var c = state.f[id], x = V.interpret(f, a.value);
    if (/^pr_\w+_cm$/.test(id) && String(x && x.value || '').trim().split(/\s+/).length < 3) { vmUnplace({ text: f.label + ': ' + a.value, why: 'too short to be a reason', sec: f.sec }); return 0; }       // a comment is a reason or an instruction, never a fragment ("Not right")
    if (!x || x.error) { vmUnplace({ text: f.label + ': ' + a.value, why: 'could not be read as an answer for that box', sec: f.sec }); return 0; }
    if (c.v === '') { if (vmApply(id, { kind: 'fill', value: x.value, status: 'verify', extra: x.extra })) { vmLog('filled (missed earlier) ' + f.label + ': ' + vmShown(id, x.value)); return 1; } return 0; }
    if (vmSame(c.v, x.value)) return 0;
    vmUnplace({ text: f.label + ': the conversation says ' + x.value, why: 'the box holds "' + c.v + '"', field: id, value: x.value, sec: f.sec });
    return 0;
  }
  function vmSweepCell(a) {
    var L = vidx.lists[a.list], rows = state.l[a.list], ri = a.row === 'last' ? rows.length - 1 : a.row - 1, id = a.list + ':' + ri + ':' + a.col, def = vidx.byId[a.list + '.' + a.col];
    if (!L || !def || vmPrivate(a.list + '.' + a.col) || vm.noSweep[id]) return 0;
    var row = rows[ri], x = V.interpret(def, a.value);
    if (!row) { vmUnplace({ text: L.title + ': ' + def.label + ' ' + a.value, why: 'there is no such row on the form', sec: L.sec }); return 0; }
    if (!x || x.error) { vmUnplace({ text: L.title + ' ' + (ri + 1) + ': ' + def.label + ' ' + a.value, why: 'could not be read as an answer for that box', sec: L.sec }); return 0; }
    var cur0 = row.d[a.col] == null ? '' : String(row.d[a.col]);
    if (!Object.keys(row.d).some(function (k) { return row.d[k] !== '' && row.d[k] != null; })) { vmUnplace({ text: L.title + ': ' + def.label + ' ' + x.value, why: 'the row is still empty (it was only pointed at)', sec: L.sec }); return 0; }
    if (cur0 === '') { var rc = vm.rowCur[a.list]; var ok = vmApplyCell({ list: a.list, i: ri, k: a.col }, id, { kind: 'fill', value: x.value, status: 'verify' }); vm.rowCur[a.list] = rc; if (ok) vmLog('filled (missed earlier) ' + L.title + ' ' + (ri + 1) + ': ' + def.label + ': ' + x.value); return ok ? 1 : 0; }
    if (!vmSame(cur0, x.value)) vmUnplace({ text: L.title + ' ' + (ri + 1) + ': the conversation says ' + def.label + ' ' + x.value, why: 'the box holds "' + cur0 + '"', sec: L.sec });
    return 0;
  }
  function vmSweepRow(a) {
    var L = vidx.lists[a.list]; if (!L) return;
    var vals = {}, bits = [];
    Object.keys(a.values || {}).forEach(function (k) { var d = vidx.byId[a.list + '.' + k]; if (d && !vmPrivate(a.list + '.' + k)) { var x = V.interpret(d, a.values[k]), v = x && !x.error ? x.value : a.values[k]; vals[k] = v; bits.push(d.label + ' ' + v); } });     // dates and amounts as they are written on the form
    if (!bits.length) return;
    var first = vals[L.first] != null ? V.norm(vals[L.first]) : '';
    if (first && state.l[a.list].some(function (r) { return V.norm(r.d[L.first]) === first; })) return;           // already there under that name
    vmUnplace({ text: L.title + ': ' + bits.slice(0, 5).join(', '), why: 'there is no such row on the form', list: a.list, values: vals, sec: L.sec });
  }
  /* The catch-up choice is added to Settings from here too. */
  function sweepSettings() {
    if ($('#setSweep') || !$('#setSpeech')) return;
    $('#setSpeech').closest('.f').insertAdjacentHTML('beforebegin',
      '<label class="f"><span class="l"><span>Catch-up check for missed answers</span></span><select id="setSweep"><option value="2">At each section change and when Voice is switched off</option><option value="1">Only when Voice is switched off</option><option value="0">Only when I press the button</option></select></label>' +
      '<p class="help">Claude reads the conversation again against the form and fills (amber, to verify) any empty box whose answer was said but never reached it. Anything it cannot place goes to the list "Heard but not placed". A box that was filled is never changed, and a box you emptied is left empty. The button "Check for missed answers" in the conversation box does the whole meeting at any time.</p>');
  }
  /* A question the page can place itself ("What is your gross income?") marks its box as it is heard, without waiting for Claude or for the lines before it to be put on the form.
     Claude's answer for the line points at the same box (and corrects it if this computer guessed wrong). */
  function vmPointNow(entry, pl) {
    if (entry.who === 'client' || !pl.sure || !pl.actions.length || !pl.actions.every(function (a) { return a.do === 'ask'; })) return;
    if (!vmAIReady() || vm.wipe || vm.noteMode || vm.paused || vm.run || vm.erun) return;
    var id = vmAskId(pl.actions[pl.actions.length - 1]), f = id && !/^count:/.test(id) ? vmField(id) : null, cr = id ? vmCellRef(id) : null;
    if (!id || (!/^count:/.test(id) && (!f || !vmVisible(f)))) return;
    /* This computer's guess is only trusted inside the section that is open, and at a box that exists (not a new row): a wrong guess in another section moved the screen there and back ("And the balance?" opened Debts). */
    if (/^count:/.test(id) ? !vidx.lists[id.slice(6)] || vidx.lists[id.slice(6)].sec !== cur : f.sec !== cur || (cr && !(state.l[cr.list] && state.l[cr.list][cr.i]))) return;
    var was = vmCur; vmCur = entry;
    try { vmShow(id); entry.prov = id; vmLog('pointed at ' + (f ? f.label : id) + ' as the question was heard'); } finally { vmCur = was; }
  }
  /* Called for every line heard. who is 'me' (the adviser), 'client', or left out when the source cannot tell and the words decide.
     Lines are put on the form in the order they were said, but each is sent to Claude as soon as it is heard (see "reading several lines at once"). */
  /* "Paul Kafentzis" on its own, the whole name: the speech service gives back the names it was told to listen for when the sound is not speech, and in a meeting it filled the client's first name and surname with the adviser's.
     The surname alone is not ignored (it can be a piece of an email address being said), and nothing is ignored while an address or a number is being collected. */
  function vmOwnNameOnly(text) {
    var n = String(text).toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim(), a = String(schema.advisor || '').toLowerCase().trim();
    return !!a && n === a && !vm.erun && !vm.run;
  }
  function vmHear(text, who, meta) {
    text = String(text == null ? '' : text).trim();
    if (!vm.on || !text) return Promise.resolve();
    if (vm.paused) return vmKeepLine(text, who, meta, 'paused: not read');
    if (vmOwnNameOnly(text)) return vmKeepLine(text, who, meta, 'ignored: only the adviser\'s own name, which the speech service repeats when it hears no clear words');
    var shown = text, run = vmEmailRun(text) || vmNumberRun(text);
    if (run && run.hold) return vmKeepLine(text, who, meta, run.note);  // part of a number or an email address: kept until it is complete
    text = run ? run.text : vmJoinDigits(text);  // a number said in pieces is one line
    var entry = { who: who === 'me' ? 'adviser' : who === 'client' ? 'client' : 'unclear', text: text, shown: shown, at: Date.now(), did: run && run.said ? [run.said] : [], done: false, m: meta || null }, t0 = Date.now(), epoch = vm.epoch, quick = null, p;
    entry.seq = ++vm.seq;
    vm.recent.push(entry); if (vm.recent.length > 12) vm.recent.shift();
    cvAdd(entry); cv.live = '';
    var pl0 = null; try { pl0 = vmPlanFor(text, entry); } catch (e) { pl0 = null; }
    try { quick = vmQuickTry(text, entry); } catch (e) { quick = null; }          // a clear answer is on the form already; Claude checks it in its turn below
    if (quick) { entry.quick = quick; entry.quickMs = Date.now() - t0; } else vm.slow++;
    try {
      if (quick ? vmAIReady() : pl0 && vmReadsEarly(text, pl0)) vmStartCall(text, entry);       // Claude starts reading the line now, with the form as it is before this line
      if (pl0 && !quick) vmPointNow(entry, pl0);                                  // and the box a question is about is marked now
    } catch (e) { entry.call = null; }
    convoSoon();
    vm.queue = vm.queue.then(function () { entry.waited = Date.now() - t0; vmCur = entry; vmLaneSync(entry, true); return vmProcessAuto(text, entry); }).catch(function () { /* one bad line never stops the next */ }).then(function () { vmLaneSync(entry, false); vmCur = null; entry.done = true; entry.doneAt = Date.now(); convoSoon(); if (!quick && epoch === vm.epoch) vm.slow--; });
    p = vm.queue.then(function () { return entry; }); p.entry = entry;
    return p;
  }
  function vmToggle(on) {
    var drained = vm.queue;                                                                                    // lines still being put on the form finish before the final check
    vm.done = {}; vm.on = on; vm.target = null; vm.answered = false; vm.secGlow = on; vm.noteMode = null; vm.rowCur = {}; vm.queue = Promise.resolve(); vm.slow = 0; vm.epoch++; vm.digits = null; vm.run = null; vm.erun = null; vm.eann = null; vm.paused = false; vm.pointed = null; vm.moveSeq = 0; vm.laneTarget = null; cv.live = ''; vmCur = null;
    if (vm.wipe) { vm.wipe = null; var wd = document.getElementById('wipe'); if (wd && wd.open) wd.close(); }   // switching Voice on or off never leaves the question hanging
    if (!on) listenStop();                                                                                       // no voice mode, nothing to listen for
    clearTimeout(vm.sweepT); vm.sweepSecs = {};
    if (!on && vmSweepMode() !== '0' && vmAIReady() && cv.all.length - vm.sweptAll >= 6) drained.then(function () { vmSweep({ sec: null, from: 0, why: 'end' }); });     // the end of the meeting: nothing said is left unchecked
    if (!on) { document.querySelectorAll('.voice-wait,.voice-ok').forEach(function (e) { e.classList.remove('voice-wait', 'voice-ok'); }); $('#vdText').hidden = true; vmPickClose(); }
    vmRender(); vmMarkWait();
    if (on) vmWarm();
    if (on && FF.voiceBackend && FF.voiceBackend.warm) {   // ask permission now, so it never interrupts a conversation later
      vm.busy++; vmRender();
      FF.voiceBackend.warm().then(function () { vm.busy--; vmRender(); }, function (e) { vm.busy--; vmRender(); toast('Voice could not use Claude (' + ((e && (e.message || e.code)) || 'not allowed') + '). Only the simple on-page rules will work. Reload the page and tap Allow to try again.'); });
    }
  }
  /* ---------- listening: the microphone as the source of the words (js/listen.js) ---------- */
  var SPEECH_KEY = 'wr-fact-find-speech-2', lsn = null, lsnState = 'off';
  function speechPrefs() {
    var p = { engine: 'whisper', model: FF.listen ? FF.listen.DEFAULT_MODEL : 'moonshine-tiny', call: false };
    try { var sv = JSON.parse(localStorage.getItem(SPEECH_KEY) || '{}'); if (sv.engine) p.engine = sv.engine; if (sv.model) p.model = sv.model; p.call = sv.call === true; } catch (e) { /* the defaults */ }
    return p;
  }
  /* The speech models on offer come from js/listen.js, so a new one needs no change to index.html. */
  function speechChoices() {
    var sel = $('#setWhisper'), L = FF.listen, lab = sel && sel.closest('.f'), on = $('#setSpeech').options[0];
    if (!sel || !L) return;
    sel.innerHTML = Object.keys(L.MODELS).map(function (id) { return '<option value="' + id + '">' + esc(L.MODELS[id].menu) + '</option>'; }).join('');
    lab = lab && lab.querySelector('.l span'); if (lab) lab.textContent = 'Speech model';
    if (on) on.textContent = 'On this computer (private)';
  }
  /* The line under the top bar: status says what is going on, heard is the last thing the microphone picked up. kind: '' | 'warn' | 'bad'. */
  function listenShow(status, heard, kind) {
    var el = $('#heard'); if (!el) return;
    el.hidden = !status && !heard && lsnState !== 'on' && lsnState !== 'loading'; el.className = 'heard' + (kind ? ' heard-' + kind : '');
    $('#heardStatus').textContent = status || ''; $('#heardText').textContent = heard || '';
  }
  function listenRender() {
    var b = $('#btnListen'); if (!b) return;
    b.classList.toggle('on', lsnState === 'on'); b.classList.toggle('busy', lsnState === 'loading'); b.setAttribute('aria-pressed', lsnState === 'on' ? 'true' : 'false');
    $('#lnLabel').textContent = lsnState === 'on' ? 'Listen: On' : lsnState === 'loading' ? 'Listen: Starting…' : 'Listen: Off';
  }
  /* What the OpenAI speech service is told to listen for: the names on the form (never an ID, phone number or address), the firm and the terms of the trade, so that "Kafentzis" is not heard as "offensive". */
  var SPEECH_TERMS = 'Wealth Revolution, Sanlam, Discovery, Momentum, Old Mutual, Liberty, Absa, Nedbank, FNB, Standard Bank, Capitec, BrightRock, Allan Gray, Coronation, Investec, Outsurance, Hollard, Santam, (Pty) Ltd, close corporation, retirement annuity, living annuity, tax-free savings account, endowment, broker on record, shareholding, married in community of property, accrual, gap cover, rand, SARS';
  function vmSpeechHints(last) {
    var seen = {}, names = [];
    function add(v) { v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (v && v.length <= 40 && !/\d{3,}|@/.test(v) && !seen[v.toLowerCase()]) { seen[v.toLowerCase()] = 1; names.push(v); } }
    add(schema.advisor);
    ['fname', 'sname', 'sp_name', 'employer', 'biz_name'].forEach(function (id) { if (state.f[id]) add(state.f[id].v); });
    ['shares', 'kids'].forEach(function (key) { (state.l[key] || []).forEach(function (r) { add(r.d.name); add(r.d.sname); }); });
    return 'A South African financial adviser and a client are filling in a Fact Find. Names and terms that may be said: ' + names.slice(0, 20).join(', ') + (names.length ? ', ' : '') + SPEECH_TERMS + '.' + (last ? ' The line before: ' + last : '');
  }
  function listenStart() {
    if (!FF.listen || lsn) return;
    if (meeting.fresh()) { meeting.start(); meetingRender(); }                                        // the meeting starts when Listen is first pressed
    if (!vm.on) vmToggle(true);
    var p = speechPrefs(), set = FF.lookup.getSettings(), status = '', kind = p.engine === 'chrome' ? 'warn' : '';
    lsn = FF.listen.create({
      engine: p.engine, model: p.model, openaiKey: set.openaiKey, openaiModel: set.openaiModel, prompt: vmSpeechHints, call: p.call && p.engine === 'openai',
      state: function (st, d) {
        lsnState = st; listenRender();
        if (st === 'loading') { status = p.engine === 'chrome' || p.engine === 'openai' ? '' : 'Getting the speech model ready on this computer' + (d.percent != null ? ' (' + d.percent + '%, only the first time)' : '…'); listenShow(status, ''); }
        else if (st === 'on') {
          status = p.engine === 'chrome' || p.engine === 'openai' ? ''                              // Chrome's recognition and OpenAI: no banner (the Listen button and the sound bars say it is on); only a problem is shown
            : 'Listening' + (d.mic ? ' on ' + d.mic : '') + ' with ' + d.model + ' on the ' + d.where + (d.why ? ' (' + d.why + ')' : '') + '. The sound stays on this computer.';
          listenShow(status + (p.call && p.engine !== 'openai' ? ' The client on a call is heard only with the OpenAI speech source (Settings).' : ''), '', kind);
        } else if (st === 'error') { lsn = null; lsnState = 'off'; listenRender(); listenShow(d.message, '', 'bad'); var lv0 = $('#lvl'); if (lv0) lv0.style.width = '0'; }
        else listenShow('', '');
      },
      interim: function (t) { cv.live = t ? '… ' + t : ''; convoSoon(); },
      text: function (t, m) { cv.live = ''; vmHear(t, m && m.who, m); },                  // the box in the right-hand pane shows the line and what became of it
      reading: function () { cv.live = '… reading what was just said'; convoSoon(); clearTimeout(cv.t); cv.t = setTimeout(function () { cv.live = ''; convoSoon(); }, 10000); },   // a line that came to nothing leaves no note behind
      note: function (msg) { listenShow(status, msg, 'warn'); },
      event: vmEngineLog,
      level: function (v) { var el = $('#lvl'); if (el) el.style.width = Math.round(v * 100) + '%'; },
      callLevel: function (v) { var el = $('#lvlc'), w = $('#lvlcWrap'); if (w) w.hidden = false; if (el) el.style.width = Math.round(v * 100) + '%'; }
    });
    lsn.start();
  }
  function listenStop() {
    if (lsn) { var l = lsn; lsn = null; l.stop(); }
    lsnState = 'off'; listenRender(); listenShow('', '');
    var lv = $('#lvl'); if (lv) lv.style.width = '0';
    var lc = $('#lvlc'), lw = $('#lvlcWrap'); if (lc) lc.style.width = '0'; if (lw) lw.hidden = true;
  }
  if ($('#btnListen')) $('#btnListen').addEventListener('click', function () { if (lsn) listenStop(); else listenStart(); });

  /* The meeting timer in the top bar: click to start or pause (it also starts by itself the first time Listen is pressed), Reset when it is paused. It is kept in the browser, so a reload does not lose it,
     and the time is written into the saved voice log. A new Fact Find starts it again from zero. */
  var MEETING_KEY = 'wr-fact-find-meeting';
  var meeting = FF.timer.create({
    load: function () { try { return JSON.parse(localStorage.getItem(MEETING_KEY)); } catch (e) { return null; } },
    save: function (o) { try { localStorage.setItem(MEETING_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable: the timer still runs on this page */ } }
  });
  function meetingRender() {
    var b = $('#btnTimer'), r = $('#btnTimerReset'); if (!b) return;
    var run = meeting.running(), ms = meeting.ms();
    $('#tmText').textContent = meeting.text() + (!run && ms > 0 ? ' (paused)' : '');
    b.classList.toggle('on', run); b.classList.toggle('paused', !run && ms > 0); b.setAttribute('aria-pressed', run ? 'true' : 'false');
    b.title = run ? 'Meeting timer, running. Click to pause.' : ms > 0 ? 'Meeting timer, paused. Click to carry on.' : 'Meeting timer. Click to start; it also starts by itself when you press Listen.';
    if (r) r.hidden = run || ms === 0;
  }
  if ($('#btnTimer')) {
    $('#btnTimer').addEventListener('click', function () { meeting.toggle(); meetingRender(); });
    $('#btnTimerReset').addEventListener('click', function () { if (window.confirm('Set the meeting timer back to zero? It is at ' + meeting.text() + '.')) { meeting.reset(); meetingRender(); } });
    setInterval(function () { meeting.tick(); meetingRender(); }, 250);                  // often enough that the seconds never lag behind the clock
    meetingRender();
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
  layoutSetup(); convoRender();
  window.FF.app = { get state() { return state; }, redraw: redraw, setState: function (s) { state = s; redraw(); }, makePdf: makePdf, voiceHear: vmHear, voice: vm, voiceLog: convoLog };
  redraw();
  if (restored) toast('Restored your unsaved changes for ' + (store.clientName(state) || 'the last client') + '.');
})();
