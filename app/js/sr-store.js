/* The Short Risk Application's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each box holds { v, st }; st is empty, preset (set by the form itself), confirmed (typed, or agreed with the client) or verify (loaded from the Fact Find: to be checked with the client).
   Each row of a list holds { d: { column: text }, st }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./sr-schema.js'));
  else { root.SR = root.SR || {}; root.SR.store = factory(root.FF.util, root.SR.schema); }
})(typeof self !== 'undefined' ? self : this, function (util, schema) {
  var APP_ID = 'wr-short-risk', FF_APP_ID = 'wr-fact-find';

  var OWNER_BOXES = ['ow_fn', 'ow_sn', 'ow_id', 'ow_cell'];
  function safeName(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function two(n) { return (n < 10 ? '0' : '') + n; }

  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, from: null, ff: null };
    schema.fieldIds.forEach(function (id) {
      var f = schema.fieldsById[id];
      s.f[id] = f.preset === '@today' ? { v: util.todayDMY(), st: 'preset' } : f.preset ? { v: f.preset, st: 'preset' } : { v: '', st: 'empty' };
    });
    Object.keys(schema.lists).forEach(function (k) { s.l[k] = []; });
    return s;
  }

  /* ---------- what a box holds ---------- */
  function tidy(id, v) {
    var f = schema.fieldsById[id], s = String(v == null ? '' : v).trim();
    if (!f || s === '') return '';
    if (f.t === 'money') return util.formatMoney(s);
    if (f.t === 'date') { var d = util.parseDate(s); return d ? util.formatDate(d) : s; }
    if (f.t === 'time') { var tm = util.parseTime(s); return tm ? util.formatTime(tm) : s; }
    if (id === 'idno' || id === 'ow_id') return s.replace(/\s+/g, '');
    return s;
  }
  function tidyCell(listKey, col, v) {
    var c = null, s = String(v == null ? '' : v).trim();
    schema.lists[listKey].cols.forEach(function (x) { if (x.k === col) c = x; });
    if (!c || s === '') return '';
    if (c.id) return s.replace(/\s+/g, '');
    if (c.pct) { var n = util.num(s); return /[0-9]/.test(s) ? (Math.round(n * 100) / 100) + '%' : s; }
    return s;
  }
  function pctNum(v) { return util.num(String(v == null ? '' : v).replace('%', '')); }

  /* A box that only counts while another box holds a value (the old policy's company and number, while the policy is replaced). */
  function shown(state, id) {
    var f = schema.fieldsById[id];
    if (!f) return false;
    if (!f.cond) return true;
    var cur = String(state.f[f.cond.f].v);
    return f.cond.eq !== undefined ? cur === f.cond.eq : cur !== f.cond.ne;
  }

  /* ---------- changing a box ---------- */
  /* Day of call is worked out from the Date of call (it cannot be typed over). */
  function dayFrom(state) {
    var d = util.parseDate(state.f.call_date.v);
    state.f.call_day = d ? { v: util.weekdayName(d), st: 'preset' } : { v: '', st: 'empty' };
  }
  /* Boxes that follow another box: Other is cleared when the Product type is not Other; the old policy's boxes are cleared when the policy is not replaced; the owner's own boxes belong to the owner chosen,
     so they are cleared when the choice changes (and filled from the Fact Find when it has that person). */
  function links(state, id) {
    if (id === 'product' && state.f.product.v !== 'Other') state.f.other = { v: '', st: 'empty' };
    if (id === 'replace' && state.f.replace.v !== 'Yes') {
      state.f.old_company = { v: '', st: 'empty' }; state.f.old_policy = { v: '', st: 'empty' };
    }
    if (id === 'call_date') dayFrom(state);
    if (id === 'owner') { OWNER_BOXES.forEach(function (b) { state.f[b] = { v: '', st: 'empty' }; }); autoOwner(state); }
  }
  function setField(state, id, v, st) {
    if (!state.f[id]) return;
    var val = tidy(id, v);
    state.f[id] = { v: val, st: val === '' ? (st === 'preset' ? 'preset' : 'empty') : (st || 'confirmed') };
    links(state, id);
  }
  function addRow(state, key, d, st) {
    var row = { d: {}, st: st || 'confirmed' };
    schema.lists[key].cols.forEach(function (c) { row.d[c.k] = tidyCell(key, c.k, d && d[c.k]); });
    state.l[key].push(row);
    return row;
  }
  function delRow(state, key, i) { state.l[key].splice(i, 1); }
  function setCell(state, key, i, col, v) {
    var row = state.l[key][i]; if (!row) return;
    row.d[col] = tidyCell(key, col, v); row.st = 'confirmed';
  }
  /* Agree a box or a row that was loaded from the Fact Find: target is 'f:<id>' or 'l:<key>:<i>'. */
  function accept(state, target) {
    var p = String(target).split(':');
    if (p[0] === 'f' && state.f[p[1]] && state.f[p[1]].st === 'verify') state.f[p[1]].st = 'confirmed';
    if (p[0] === 'l' && state.l[p[1]] && state.l[p[1]][+p[2]]) state.l[p[1]][+p[2]].st = 'confirmed';
  }
  /* Agree everything loaded from the Fact Find at once (the client has been through it). */
  function acceptAll(state) {
    schema.fieldIds.forEach(function (id) { if (state.f[id].st === 'verify') state.f[id].st = 'confirmed'; });
    Object.keys(state.l).forEach(function (k) { state.l[k].forEach(function (r) { if (r.st === 'verify') r.st = 'confirmed'; }); });
  }

  /* ---------- progress ---------- */
  /* filled: boxes with an answer; verify: loaded from the Fact Find and not yet agreed (boxes and rows); left: boxes still to answer (those not marked optional, while they count). */
  function counts(state) {
    var c = { filled: 0, verify: 0, left: 0 };
    schema.fieldIds.forEach(function (id) {
      var f = schema.fieldsById[id], b = state.f[id];
      if (!shown(state, id)) return;
      if (b.v !== '') { c.filled++; if (b.st === 'verify') c.verify++; }
      else if (!f.opt) c.left++;
    });
    Object.keys(state.l).forEach(function (k) { state.l[k].forEach(function (r) { if (r.st === 'verify') c.verify++; }); });
    return c;
  }
  /* Per section: how many boxes are still to answer. */
  function leftIn(state, section) {
    var n = 0;
    (section.fields || []).forEach(function (f) { if (shown(state, f.id) && !f.opt && state.f[f.id].v === '') n++; });
    return n;
  }

  /* ---------- names ---------- */
  function clientName(state) {
    return [state.f.fname.v, state.f.sname.v].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
  }
  /* The insurer as it is written in the file name: the short name where there is one (OM, BR), otherwise as it is. */
  function insurerShort(name) { return schema.abbr[name] || name; }
  /* What the premium reads in the file name: "R 1,000.00 p.m." (the same figures as on the skill's application file names, with a comma between thousands). */
  function premiumLabel(v) {
    var n = util.num(v); if (!(n > 0)) return '';
    var s = n.toFixed(2).split('.');
    return 'R ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1] + ' p.m.';
  }
  /* The product as it is written in the file name and on the PDF's first page: for Other, what was typed in the Other box. */
  function productName(state) { return state.f.product.v === 'Other' ? (String(state.f.other.v).trim() || 'Other') : state.f.product.v; }
  /* "OM - Personal Covers Application - 20.11.26 - R 1,000.00 p.m. - (First Last)": the application file name rule. The PDF and the saved file (.json) have the same name; only the ending differs.
     Until the boxes it is made from are filled, the missing parts read as what they are, so the name is never silently wrong. */
  function pdfFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday());
    var parts = [
      (insurerShort(state.f.insurer.v) || 'Insurer') + ' - ' + (safeName(productName(state)) || 'Risk') + ' Application',
      two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100),
      premiumLabel(state.f.premium.v) || 'R amount p.m.',
      '(' + (safeName(clientName(state)) || 'New client') + ')'
    ];
    return parts.join(' - ');
  }
  function baseFileName(state) { return pdfFileName(state); }

  /* ---------- saving and opening ---------- */
  /* A file saved by version 1.0 had Owner of the policy as a box to type in. It opens with the owner as the client (empty, or the client's own name), or as Another person with the typed name put in Owner's full names
     (to verify), so nothing typed is lost and the four owner boxes are not left asking for an answer the file never had. */
  function oldOwner(s, typed) {
    typed = String(typed == null ? '' : typed).trim();
    var me = clientName(s).toLowerCase().replace(/\s+/g, ' '), t = typed.toLowerCase().replace(/\s+/g, ' ');
    if (t === '' || t === me || /^(?:the )?client$|^same$|^self$|^himself$|^herself$|^myself$/.test(t) || (t && me && (me.indexOf(t) === 0 || t.indexOf(me) === 0))) { s.f.owner = { v: schema.owners[0], st: 'preset' }; return; }
    s.f.owner = { v: schema.owners[3], st: 'confirmed' };
    s.f.ow_fn = { v: typed, st: 'verify' };
  }
  function toJSON(state) { state.modified = new Date().toISOString(); return JSON.stringify(state, null, 2); }
  function fromJSON(text) {
    var j = JSON.parse(text);
    if (!j || j.app !== APP_ID) throw new Error('This file is not a Wealth Revolution Short Risk Application.');
    var s = blank();
    s.created = j.created || s.created; s.modified = j.modified || null;
    Object.keys(j.f || {}).forEach(function (id) {
      if (!s.f[id] || !j.f[id]) return;
      var v = tidy(id, j.f[id].v), st = j.f[id].st;
      s.f[id] = { v: v, st: v === '' ? (schema.fieldsById[id].preset && st === 'preset' ? 'preset' : 'empty') : (st === 'verify' || st === 'preset' ? st : 'confirmed') };
    });
    if (String(j.schema || '') === '1.0') oldOwner(s, j.f && j.f.owner && j.f.owner.v);
    Object.keys(j.l || {}).forEach(function (k) {
      if (!schema.lists[k]) return;
      s.l[k] = (j.l[k] || []).map(function (r) {
        var d = {}; schema.lists[k].cols.forEach(function (c) { d[c.k] = tidyCell(k, c.k, r && r.d && r.d[c.k]); });
        return { d: d, st: r && r.st === 'verify' ? 'verify' : 'confirmed' };
      });
    });
    dayFrom(s);
    s.from = j.from && typeof j.from === 'object' ? { name: String(j.from.name || ''), at: String(j.from.at || '') } : null;
    s.ff = cleanFF(j.ff);
    return s;
  }

  /* ---------- the owner, from the Fact Find ---------- */
  /* What the Fact Find knew about the people who could own the policy, kept in the file so the owner's boxes can be filled whenever the owner is chosen: the spouse (name, phone) and the business partners (name, ID, cell). */
  function cleanFF(x) {
    if (!x || typeof x !== 'object') return null;
    var one = function (r) { return r && String(r.name || '').trim() ? { name: String(r.name).trim(), id: String(r.id || '').replace(/\s+/g, ''), cell: String(r.cell || '').trim() } : null; };
    return { spouse: one(x.spouse), partners: (Array.isArray(x.partners) ? x.partners : []).map(one).filter(Boolean) };
  }
  /* Who in the Fact Find the chosen owner could be: the spouse, or the business partners; nobody for the client or another person. */
  function ownerCandidates(state) {
    var o = state.f.owner.v, ff = state.ff;
    if (!ff) return [];
    if (o === schema.owners[1]) return ff.spouse ? [ff.spouse] : [];
    if (o === schema.owners[2]) return ff.partners;
    return [];
  }
  /* Fill the owner's boxes from candidate i (amber "verify" until agreed with the client). The Fact Find has no spouse ID number, so that box stays as it is. */
  function fillOwnerFrom(state, i) {
    var c = ownerCandidates(state)[i]; if (!c) return false;
    var sp = util.splitFullName(c.name);
    [['ow_fn', sp.first], ['ow_sn', sp.last], ['ow_id', c.id], ['ow_cell', c.cell]].forEach(function (x) {
      var v = tidy(x[0], x[1]); if (v !== '') state.f[x[0]] = { v: v, st: 'verify' };
    });
    return true;
  }
  /* When there is exactly one person it could be and the owner's boxes are all empty, they are filled by themselves. */
  function autoOwner(state) {
    if (ownerCandidates(state).length === 1 && OWNER_BOXES.every(function (b) { return state.f[b].v === ''; })) fillOwnerFrom(state, 0);
  }

  /* ---------- Load from Fact Find ---------- */
  /* Reads a saved Fact Find file (text) and fills what the Short Risk Application shares with it: the client's first names, surname, ID number, cell and work numbers, e-mail address and the children.
     Only empty boxes are filled, and what is loaded is marked "verify" (amber) until it is agreed with the client; what has already been typed is never overwritten. A child already on the list is not added again.
     Returns { loaded: [labels], kept: [labels left alone because they already held something else], children: n, error } and changes the state. fileName is only recorded, to show where the details came from. */
  function loadFromFactFind(state, text, fileName) {
    var j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('That file cannot be read as a Fact Find.'); }
    if (!j || j.app !== FF_APP_ID) throw new Error('This file is not a Wealth Revolution Fact Find.');
    var ff = function (id) { var c = j.f && j.f[id]; return c && c.v != null ? String(c.v).trim() : ''; };
    var rep = { loaded: [], kept: [], children: 0 };
    function put(id, v) {
      var f = schema.fieldsById[id], b = state.f[id], val = tidy(id, v);
      if (val === '') return;
      if (b.v === val) return;
      if (b.v !== '') { rep.kept.push(f.l); return; }
      state.f[id] = { v: val, st: 'verify' }; links(state, id); rep.loaded.push(f.l);
    }
    put('fname', ff('fname'));
    put('sname', ff('sname'));
    put('idno', ff('idno'));
    put('cell', ff('cell'));
    put('work', ff('work'));
    put('email', ff('pemail') || ff('wemail'));
    var have = state.l.kids.map(function (r) { return String(r.d.name).toLowerCase(); });
    ((j.l && j.l.kids) || []).forEach(function (r) {
      var d = (r && r.d) || {}, nm = [d.name, d.sname].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
      if (!nm || have.indexOf(nm.toLowerCase()) >= 0) return;
      addRow(state, 'kids', { name: nm, id: '' }, 'verify'); have.push(nm.toLowerCase()); rep.children++;
    });
    state.ff = cleanFF({ spouse: { name: ff('sp_name'), cell: ff('sp_tel') }, partners: ((j.l && j.l.shares) || []).map(function (r) { return r && r.d; }) });
    autoOwner(state);
    state.from = { name: String(fileName || ''), at: new Date().toISOString() };
    return rep;
  }

  return { blank: blank, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, acceptAll: acceptAll, shown: shown, counts: counts, leftIn: leftIn,
    clientName: clientName, pdfFileName: pdfFileName, baseFileName: baseFileName, premiumLabel: premiumLabel, insurerShort: insurerShort, toJSON: toJSON, fromJSON: fromJSON, loadFromFactFind: loadFromFactFind,
    pctNum: pctNum, tidy: tidy, productName: productName, ownerCandidates: ownerCandidates, fillOwnerFrom: fillOwnerFrom, autoOwner: autoOwner, APP_ID: APP_ID };
});
