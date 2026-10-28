/* The client's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each field holds { v, st }. st is one of: empty, preset, confirmed (typed or accepted), heard, verify, suggest.
   The last three are used when answers come from a live call. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./schema.js'), require('./calc.js'));
  else { root.FF = root.FF || {}; root.FF.store = factory(root.FF.util, root.FF.schema, root.FF.calc); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc) {
  var APP_ID = 'wr-fact-find';

  /* What Claude has cost for this fact find (an estimate from the published prices, see lookup.js): dollars and the tokens behind them. It travels with the saved file. */
  function blankTally() { return { usd: 0, calls: 0, input: 0, output: 0, read: 0, write: 0, searches: 0 }; }
  function tallyFrom(t) {
    var o = blankTally();
    Object.keys(o).forEach(function (k) { if (t && +t[k] > 0 && isFinite(+t[k])) o[k] = +t[k]; });
    return o;
  }
  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, docs: {}, claude: blankTally() };
    Object.keys(schema.fieldsById).forEach(function (id) {
      var d = schema.fieldsById[id], p = d.preset === '@today' ? util.todayDMY() : d.preset;
      s.f[id] = p ? { v: p, st: 'preset' } : { v: '', st: 'empty' };
    });
    Object.keys(schema.lists).forEach(function (k) { s.l[k] = []; });
    return s;
  }
  function ctxFor(state) {
    return {
      v: function (id) { var c = state.f[id]; return c ? String(c.v == null ? '' : c.v) : ''; },
      n: function (id) { var c = state.f[id]; return c ? util.num(c.v) : 0; },
      rows: function (k) { return state.l[k] || []; }
    };
  }
  /* The children of a male client carry his surname: it is put in a child's Surname box when it is empty, or when it still holds his old surname (the client's surname or gender was
     changed since). A surname the adviser typed for a child is never touched. */
  function fatherSurname(state) { return state.f.gender && state.f.gender.v === 'Male' && state.f.sname ? String(state.f.sname.v || '').trim() : ''; }
  function followFather(state, was) {
    var now = fatherSurname(state);
    if (!now) return;
    (state.l.kids || []).forEach(function (r) { if (!r.d.sname || (was && r.d.sname === was)) r.d.sname = now; });
  }
  function setField(state, id, v, st) {
    var was = id === 'sname' || id === 'gender' ? fatherSurname(state) : null;
    state.f[id] = { v: v, st: st || (v === '' ? 'empty' : 'confirmed') };
    if (id === 'sname' || id === 'gender') followFather(state, was);
  }
  function addRow(state, key, data, st) {
    var d = {};
    schema.lists[key].cols.forEach(function (c) { d[c.k] = (data && data[c.k]) || ''; });
    if (key === 'kids' && !d.sname) d.sname = fatherSurname(state);
    var r = { d: d, st: st || 'confirmed' };
    state.l[key].push(r);
    return r;
  }
  function delRow(state, key, i) { state.l[key].splice(i, 1); }
  function setCell(state, key, i, k, v, st) { var r = state.l[key][i]; r.d[k] = v; r.st = st || 'confirmed'; }
  function accept(state, target) {
    if (target.list) state.l[target.list][target.i].st = 'confirmed';
    else if (state.f[target.id]) state.f[target.id].st = 'confirmed';
  }

  /* An ID or passport number can be on the form once: for the client, or for one partner or shareholder. 721209 5268086 and 7212095268086 are the same number. */
  function idKey(v) { return String(v == null ? '' : v).replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
  /* Who already has this number? where is the box being written: { id: 'idno' } or { list: 'shares', i } (that box is not counted). -> { who: 'the client' } or null. */
  function idClash(state, value, where) {
    var k = idKey(value), hit = null;
    if (k.length < 6) return null;                                                       // a few digits are not an ID number yet
    if (!(where && where.id === 'idno') && state.f.idno && idKey(state.f.idno.v) === k) return { who: 'the client' };
    (state.l.shares || []).forEach(function (r, i) {
      if (hit || (where && where.list === 'shares' && where.i === i)) return;
      if (idKey(r.d.id) === k) hit = { who: 'partner / shareholder ' + (i + 1) + (r.d.name ? ' (' + r.d.name + ')' : '') };
    });
    return hit;
  }
  function clientName(state) {
    return [state.f.fname.v, state.f.sname.v].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
  }
  function safeName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function baseFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday()), date = (d.d < 10 ? '0' : '') + d.d + '.' + (d.m < 10 ? '0' : '') + d.m + '.' + d.y;
    return 'Fact Find - ' + date + ' - ' + (safeName(clientName(state)) || 'New client');
  }

  /* Reopen a saved file. Unknown ids are ignored and missing ones start blank, so older files keep working. */
  function fromJSON(text) {
    var j = JSON.parse(text);
    if (!j || j.app !== APP_ID) throw new Error('This file is not a Wealth Revolution Fact Find.');
    var s = blank();
    s.created = j.created || s.created; s.modified = j.modified || null;
    Object.keys(j.f || {}).forEach(function (id) { if (s.f[id]) s.f[id] = { v: String(j.f[id].v == null ? '' : j.f[id].v), st: j.f[id].st || 'confirmed' }; });
    Object.keys(j.l || {}).forEach(function (k) {
      if (!schema.lists[k]) return;
      s.l[k] = (j.l[k] || []).map(function (r) {
        var d = {}; schema.lists[k].cols.forEach(function (c) { d[c.k] = (r.d && r.d[c.k]) || ''; });
        if (k === 'kids' && r.d && r.d.sname === undefined && d.name) {                         // saved when a child had one "Name & surname" box: split it
          var sp = util.splitFullName(d.name, j.f && j.f.sname && j.f.sname.v);
          d.name = sp.first; d.sname = sp.last;
        }
        return { d: d, st: r.st || 'confirmed' };
      });
    });
    s.docs = j.docs || {};
    s.claude = tallyFrom(j.claude);
    tidyAmounts(s);
    tidyDates(s);
    return s;
  }
  /* Older drafts and files may hold amounts typed as plain numbers. Show them all as Rand with two decimals. */
  function tidyAmounts(s) {
    Object.keys(schema.fieldsById).forEach(function (id) { var d = schema.fieldsById[id]; if (d.money && s.f[id]) s.f[id].v = util.formatMoney(s.f[id].v); });
    Object.keys(schema.lists).forEach(function (k) {
      schema.lists[k].cols.forEach(function (c) { if (c.money) s.l[k].forEach(function (r) { r.d[c.k] = util.formatMoney(r.d[c.k]); }); });
    });
  }
  /* Dates are shown as day/month/year. Older drafts and files may hold them in another form (such as 2026-10-17): show them the same way. */
  function tidyDates(s) {
    var fix = function (v) { var p = util.parseDate(v); return p ? util.formatDate(p) : v; };
    Object.keys(schema.fieldsById).forEach(function (id) { var d = schema.fieldsById[id]; if (d.date && s.f[id]) s.f[id].v = fix(s.f[id].v); });
    Object.keys(schema.lists).forEach(function (k) {
      schema.lists[k].cols.forEach(function (c) { if (c.date) s.l[k].forEach(function (r) { r.d[c.k] = fix(r.d[c.k]); }); });
    });
  }
  function toJSON(state) { state.modified = new Date().toISOString(); return JSON.stringify(state, null, 2); }

  /* Progress for a section: how many answers are filled out of those that count. */
  function counts(state, sec) {
    var ctx = ctxFor(state), tot = 0, fill = 0, ver = 0;
    if (!calc.showIf(sec.cond, ctx)) return { tot: 0, fill: 0, ver: 0 };
    sec.blocks.forEach(function (b) {
      if (!calc.showIf(b.cond, ctx)) return;
      (b.fields || []).forEach(function (f) {
        if (f.calc || f.opt || f.preset || !calc.showIf(f.cond, ctx)) return;
        var c = state.f[f.id];
        tot++; if (c.v !== '') fill++; if (c.st === 'verify') ver++;
      });
      if (b.list) {
        var rows = state.l[b.list]; fill += rows.length; tot += rows.length;
        rows.forEach(function (r) { if (r.st === 'verify') ver++; });
      }
    });
    return { tot: tot, fill: fill, ver: ver };
  }

  return { blank: blank, blankTally: blankTally, ctxFor: ctxFor, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, clientName: clientName, idClash: idClash, idKey: idKey, fatherSurname: fatherSurname, baseFileName: baseFileName, fromJSON: fromJSON, toJSON: toJSON, counts: counts };
});
