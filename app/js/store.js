/* The client's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each field holds { v, st }. st is one of: empty, preset, confirmed (typed or accepted), heard, verify, suggest.
   The last three are used when answers come from a live call. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./schema.js'), require('./calc.js'));
  else { root.FF = root.FF || {}; root.FF.store = factory(root.FF.util, root.FF.schema, root.FF.calc); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc) {
  var APP_ID = 'wr-fact-find';

  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, docs: {} };
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
  function setField(state, id, v, st) { state.f[id] = { v: v, st: st || (v === '' ? 'empty' : 'confirmed') }; }
  function addRow(state, key, data, st) {
    var d = {};
    schema.lists[key].cols.forEach(function (c) { d[c.k] = (data && data[c.k]) || ''; });
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
        return { d: d, st: r.st || 'confirmed' };
      });
    });
    s.docs = j.docs || {};
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
        if (f.calc || f.opt || f.preset) return;
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

  return { blank: blank, ctxFor: ctxFor, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, clientName: clientName, baseFileName: baseFileName, fromJSON: fromJSON, toJSON: toJSON, counts: counts };
});
