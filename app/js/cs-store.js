/* The Investment Capture Sheet's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each box holds { v, st }; st is empty, preset (set by the form itself), confirmed (typed, or agreed with the client) or verify (loaded from the Fact Find: to be checked with the client).
   Each row of a list holds { d: { column: text }, st }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./cs-schema.js'));
  else { root.CS = root.CS || {}; root.CS.store = factory(root.FF.util, root.CS.schema); }
})(typeof self !== 'undefined' ? self : this, function (util, schema) {
  var APP_ID = 'wr-capture-sheet', FF_APP_ID = 'wr-fact-find', SR_APP_ID = 'wr-short-risk';

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
    var cur = String(state.f[f.cond.f].v);
    if (f.cond.in) return f.cond.in.indexOf(cur) >= 0;
    return f.cond.eq !== undefined ? cur === f.cond.eq : cur !== f.cond.ne;
  }

  /* ---------- changing a box ---------- */
  /* Boxes that follow another box: the old policy's number is cleared when the policy is not replaced; the foreign tax number when there is no foreign tax obligation; where the money came from when the information was from the
     adviser's own knowledge; the marriage boxes when the client is not married (or in a partnership). */
  function links(state, id) {
    if (id === 'replace' && state.f.replace.v !== 'Yes') state.f.old_policy = { v: '', st: 'empty' };
    if (id === 'foreign_tax' && state.f.foreign_tax.v !== 'Yes') state.f.foreign_tax_no = { v: '', st: 'empty' };
    if (id === 'own_knowledge' && state.f.own_knowledge.v !== 'No') state.f.origin = { v: '', st: 'empty' };
    if (id === 'marital' && !shown(state, 'marital_contract')) { state.f.marital_date = { v: '', st: 'empty' }; state.f.marital_contract = { v: '', st: 'empty' }; }
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
  /* The provider as it is written in the file name: the short name where there is one (OM), otherwise as it is. */
  function insurerShort(name) { return schema.abbr[name] || name; }
  function productName(state) { return state.f.product.v; }
  /* "OM Capture Sheet - 12.11.26 - (First Last)": the PDF and the saved file (.json) have the same name; only the ending differs. Until the boxes it is made from are filled, the missing parts read as what they are. */
  function pdfFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday());
    return [(insurerShort(state.f.provider.v) || 'Provider') + ' Capture Sheet', two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100), '(' + (safeName(clientName(state)) || 'New client') + ')'].join(' - ');
  }
  function baseFileName(state) { return pdfFileName(state); }

  /* ---------- the Risk Tolerance questionnaire ---------- */
  /* What has been answered: each statement 0 (Strongly disagree) to 4 (Strongly agree), each capacity question the number of the choice, -1 when not answered. */
  function rtChoices(state) {
    var RT = schema.rt;
    return {
      statements: RT.STATEMENTS.map(function (q, i) { return RT.choiceOf(state.f['rt_s' + (i + 1)].v); }),
      capacity: RT.CAPACITY.map(function (c, i) { return RT.capacityOf(i, state.f['rt_c' + (i + 1)].v); }),
      confirmed: state.f.rt_understand.v !== ''
    };
  }
  function rtStatus(state) {
    var RT = schema.rt, c = rtChoices(state), st = c.statements.filter(function (x) { return x >= 0; }).length, cap = c.capacity.filter(function (x) { return x >= 0; }).length;
    var scoreReady = st === RT.STATEMENTS.length, done = scoreReady && cap === RT.CAPACITY.length;
    return { choices: c, statements: st, capacity: cap, answered: st + cap + (c.confirmed ? 1 : 0), total: RT.STATEMENTS.length + RT.CAPACITY.length + 1, scoreReady: scoreReady, complete: done,
      score: scoreReady ? RT.totalScore(c.statements) : null, category: scoreReady ? RT.categoryFor(RT.totalScore(c.statements)) : null };
  }
  /* The three result boxes follow the answers: the score and profile once all 18 statements are answered, the reference once the questionnaire is complete (a new one when an answer is changed afterwards). */
  function rtSync(state, changed) {
    var r = rtStatus(state), put = function (id, v) { state.f[id] = { v: v, st: v === '' ? 'empty' : 'confirmed' }; };
    put('risk_score', r.scoreReady ? String(r.score) : ''); put('risk_profile', r.scoreReady && r.category ? r.category.name : '');
    if (!r.complete) put('risk_ref', ''); else if (changed || !state.f.risk_ref.v) put('risk_ref', schema.rt.makeReference(new Date()));
    return r;
  }
  /* "Risk Tolerance - 12.11.26 - (First Last)": its own file, named like the application's */
  function rtFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday());
    return ['Risk Tolerance', two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100), '(' + (safeName(clientName(state)) || 'New client') + ')'].join(' - ');
  }

  /* ---------- saving and opening ---------- */
  function toJSON(state) { state.modified = new Date().toISOString(); return JSON.stringify(state, null, 2); }
  function fromJSON(text) {
    var j = JSON.parse(text);
    if (!j || j.app !== APP_ID) throw new Error('This file is not a Wealth Revolution Investment Capture Sheet.');
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
  /* What the Fact Find's choices are called here. */
  var MARITAL_FF = { 'Single': ['Single'], 'Married in community of property': ['Married', 'In Community of Property'], 'Married out of community (with accrual)': ['Married', 'Out of Community of Property - with Accrual'],
    'Married out of community (no accrual)': ['Married', 'Out of Community of Property - without Accrual'], 'Customary marriage': ['Customary Marriage', 'Customary Marriage'], 'Civil union': ['Civil Union', 'Civil Union'],
    'Life partner': ['Life Partner / Cohabiting'], 'Divorced': ['Divorced'], 'Widowed': ['Widowed'] };
  var EDU_FF = { 'Matric': 'Matric', 'Matric & diploma': 'Matric & Diploma', '4-year diploma': '4-Year Diploma', '3-year degree': '3-Year Degree', 'Postgraduate': 'Postgraduate' };
  /* Reads a saved Fact Find file (text) and fills what the capture sheet shares with it: names, ID number, nationality, marital status (with the marriage date and contract), tax number, telephone numbers, e-mail address,
     occupation and highest education. Only empty boxes are filled, and what is loaded is marked "verify" (amber) until it is agreed with the client; what has already been typed is never overwritten.
     Returns { loaded: [labels], kept: [labels left alone because they already held something else], children: 0 } and changes the state. */
  /* A box of the load: only an empty box is filled, and what is loaded is amber (verify) until it is agreed with the client; a different answer already typed is kept and named. */
  function putter(state, rep) {
    return function (id, v) {
      var f = schema.fieldsById[id], b = state.f[id], val = tidy(id, v);
      if (val === '') return;
      if (b.v === val) return;
      if (b.v !== '') { rep.kept.push(f.l); return; }
      state.f[id] = { v: val, st: 'verify' }; rep.loaded.push(f.l);
    };
  }
  function readSaved(text, appId, what) {
    var j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('That file cannot be read as ' + what + '.'); }
    if (!j || j.app !== appId) throw new Error('This file is not ' + what + '.');
    return j;
  }
  function loadFromFactFind(state, text, fileName) {
    var j = readSaved(text, FF_APP_ID, 'a Wealth Revolution Fact Find');
    var ff = function (id) { var c = j.f && j.f[id]; return c && c.v != null ? String(c.v).trim() : ''; };
    var rep = { loaded: [], kept: [], children: 0, rows: 0 }, put = putter(state, rep);
    put('fname', ff('fname')); put('sname', ff('sname')); put('idno', ff('idno'));
    if (ff('nat') === 'South African') put('nationality', 'South African');
    var m = MARITAL_FF[ff('marital')];
    if (m) { put('marital', m[0]); if (m[1]) put('marital_contract', m[1]); put('marital_date', ff('marr_date')); }
    put('tax_no', ff('tax')); put('cell', ff('cell')); put('tel_w', ff('work')); put('tel_h', ff('home')); put('email', ff('pemail') || ff('wemail'));
    put('occupation', ff('occ')); if (EDU_FF[ff('edu')]) put('qualification', EDU_FF[ff('edu')]);
    state.from = { name: String(fileName || ''), at: new Date().toISOString() };
    return rep;
  }
  /* "Anna Maria Kuiper" -> name "Anna Maria", surname "Kuiper"; "Piet van der Merwe" -> "Piet" and "van der Merwe" (the Short Risk page has one box for both) */
  var SURNAME_PARTS = ['van', 'von', 'der', 'den', 'de', 'du', 'la', 'le', 'ter', 'te', 'ten', 'di', 'da', 'dos', 'del'];
  function splitName(full) {
    var w = String(full || '').trim().split(/\s+/).filter(Boolean), i = w.length - 1;
    if (w.length < 2) return { name: w.join(' '), sname: '' };
    while (i > 1 && SURNAME_PARTS.indexOf(w[i - 1].toLowerCase()) >= 0) i--;
    return { name: w.slice(0, i).join(' '), sname: w.slice(i).join(' ') };
  }
  var SR_ACC_TYPE = { Cheque: 'Cheque', Savings: 'Savings', Transmission: 'Other' };
  /* Load from Short Risk file: what the client already gave on a saved Short Risk Application (contact details, home address, bank and beneficiaries), read and never changed. The beneficiaries come only when this application has none yet. */
  function loadFromShortRisk(state, text, fileName) {
    var j = readSaved(text, SR_APP_ID, 'a Wealth Revolution Short Risk Application');
    var sr = function (id) { var c = j.f && j.f[id]; return c && c.v != null ? String(c.v).trim() : ''; };
    var rep = { loaded: [], kept: [], children: 0, rows: 0 }, put = putter(state, rep);
    put('title', sr('title')); put('fname', sr('fname')); put('sname', sr('sname')); put('idno', sr('idno'));
    put('cell', sr('cell')); put('tel_w', sr('work')); put('email', sr('email'));
    var street = [sr('street_no'), sr('street')].filter(Boolean).join(' '), home = [sr('unit') && 'Unit ' + sr('unit'), sr('complex'), street, sr('suburb'), sr('city'), sr('region')].filter(Boolean).join(', ');
    put('residential', home); put('residential_code', sr('postal'));
    put('acc_holder', sr('acc_holder')); put('bank', sr('bank')); put('branch_code', sr('branch_code')); put('acc_type', SR_ACC_TYPE[sr('acc_type')] || sr('acc_type')); put('acc_no', sr('acc_no'));
    var rows = j.l && j.l.benef || [];
    if (!state.l.benef.length) rows.forEach(function (r) {
      var d = r && r.d || {}, n = splitName(d.name);
      if (!n.name && !d.id) return;
      addRow(state, 'benef', { name: n.name, sname: n.sname, id: d.id, relation: d.relation, pct: d.pct }, 'verify'); rep.rows++;
    });
    state.from = { name: String(fileName || ''), at: new Date().toISOString() };
    return rep;
  }

  return { blank: blank, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, acceptAll: acceptAll, shown: shown, counts: counts, leftIn: leftIn,
    clientName: clientName, rtChoices: rtChoices, rtStatus: rtStatus, rtSync: rtSync, rtFileName: rtFileName, pdfFileName: pdfFileName, baseFileName: baseFileName, insurerShort: insurerShort, toJSON: toJSON, fromJSON: fromJSON, loadFromFactFind: loadFromFactFind, loadFromShortRisk: loadFromShortRisk, splitName: splitName,
    pctNum: pctNum, tidy: tidy, productName: productName, APP_ID: APP_ID };
});
