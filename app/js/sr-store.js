/* The Short Risk Application's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each box holds { v, st }; st is empty, preset (set by the form itself), confirmed (typed, or agreed with the client) or verify (loaded from the Fact Find: to be checked with the client).
   Each row of a list holds { d: { column: text }, st }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./sr-schema.js'));
  else { root.SR = root.SR || {}; root.SR.store = factory(root.FF.util, root.SR.schema); }
})(typeof self !== 'undefined' ? self : this, function (util, schema) {
  var APP_ID = 'wr-short-risk', FF_APP_ID = 'wr-fact-find';

  function safeName(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function two(n) { return (n < 10 ? '0' : '') + n; }

  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, from: null };
    schema.fieldIds.forEach(function (id) {
      var f = schema.fieldsById[id];
      s.f[id] = f.preset === '@today' ? { v: util.todayDMY(), st: 'preset' } : { v: '', st: 'empty' };
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
    if (id === 'idno') return s.replace(/\s+/g, '');
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
    return String(state.f[f.cond.f].v) === f.cond.eq;
  }

  /* ---------- changing a box ---------- */
  /* Boxes that follow another box: Cover lines follows the Product type (until someone chooses it themselves); the old policy's boxes are cleared when the policy is not replaced. */
  function links(state, id) {
    if (id === 'product') {
      var ln = state.f.lines, want = schema.linesOf[state.f.product.v];
      if (want && (ln.v === '' || ln.st === 'preset')) state.f.lines = { v: want, st: 'preset' };
    }
    if (id === 'replace' && state.f.replace.v !== 'Yes') {
      state.f.old_company = { v: '', st: 'empty' }; state.f.old_policy = { v: '', st: 'empty' };
    }
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
  /* "OM - Personal Covers Application - 20.11.26 - R 1,000.00 p.m. - (First Last)": the application file name rule. The PDF and the saved file (.json) have the same name; only the ending differs.
     Until the boxes it is made from are filled, the missing parts read as what they are, so the name is never silently wrong. */
  function pdfFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday());
    var parts = [
      (insurerShort(state.f.insurer.v) || 'Insurer') + ' - ' + (safeName(state.f.product.v) || 'Risk') + ' Application',
      two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100),
      premiumLabel(state.f.premium.v) || 'R amount p.m.',
      '(' + (safeName(clientName(state)) || 'New client') + ')'
    ];
    return parts.join(' - ');
  }
  function baseFileName(state) { return pdfFileName(state); }

  /* ---------- saving and opening ---------- */
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
    Object.keys(j.l || {}).forEach(function (k) {
      if (!schema.lists[k]) return;
      s.l[k] = (j.l[k] || []).map(function (r) {
        var d = {}; schema.lists[k].cols.forEach(function (c) { d[c.k] = tidyCell(k, c.k, r && r.d && r.d[c.k]); });
        return { d: d, st: r && r.st === 'verify' ? 'verify' : 'confirmed' };
      });
    });
    s.from = j.from && typeof j.from === 'object' ? { name: String(j.from.name || ''), at: String(j.from.at || '') } : null;
    return s;
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
    state.from = { name: String(fileName || ''), at: new Date().toISOString() };
    return rep;
  }

  return { blank: blank, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, acceptAll: acceptAll, shown: shown, counts: counts, leftIn: leftIn,
    clientName: clientName, pdfFileName: pdfFileName, baseFileName: baseFileName, premiumLabel: premiumLabel, insurerShort: insurerShort, toJSON: toJSON, fromJSON: fromJSON, loadFromFactFind: loadFromFactFind,
    pctNum: pctNum, tidy: tidy, APP_ID: APP_ID };
});
