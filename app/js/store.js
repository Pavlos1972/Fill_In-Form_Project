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
  /* The action points on the Admin page: what they were written from (key), when (at), by what ('claude' or 'form'), and whether the adviser has typed in the box since (edited): after that they no longer follow the form until Refresh. */
  function blankPa() { return { key: '', at: '', by: '', edited: false }; }
  function cleanPa(x) {
    var o = blankPa(); if (!x || typeof x !== 'object') return o;
    o.key = String(x.key || '').slice(0, 40); o.at = String(x.at || '').slice(0, 40); o.by = x.by === 'claude' || x.by === 'form' ? x.by : ''; o.edited = x.edited === true;
    return o;
  }
  function setPa(state, key, by) { state.pa = { key: String(key || ''), at: new Date().toISOString(), by: by === 'claude' ? 'claude' : 'form', edited: false }; }
  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, sum: {}, pa: blankPa(), unplaced: [], claude: blankTally() };
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
  /* A quote that is not required has no type and no insurer: when it is set to not required they are cleared, so nothing is left behind (the boxes themselves go away, see schema.js). */
  var NOT_REQUIRED = { fna_req: { vals: ['Not required', 'No FNA done'], clear: ['fna_type', 'fna_ins'] }, sf_req: { vals: ['Not required'], clear: ['sf_type', 'sf_ins'] },
    bf_fna_req: { vals: ['Not required', 'No FNA done'], clear: ['bf_fna_type'] }, bf_sf_req: { vals: ['Not required'], clear: ['bf_sf_type'] } };
  /* "Other" in a policy schedule list opens its small box: when Other is not ticked any more, what was typed there goes. */
  var PS_OTHER_BOX = { ps_risk: 'ps_risk_ot', ps_grp: 'ps_grp_ot', ps_ra: 'ps_ra_ot', ps_pp: 'ps_pp_ot', ps_inv: 'ps_inv_ot' };
  function setField(state, id, v, st) {
    var was = id === 'sname' || id === 'gender' ? fatherSurname(state) : null;
    state.f[id] = { v: v, st: st || (v === '' ? 'empty' : 'confirmed') };
    if (PS_OTHER_BOX[id] && state.f[PS_OTHER_BOX[id]] && String(v).split(';').map(function (x) { return x.trim(); }).indexOf('Other') < 0) state.f[PS_OTHER_BOX[id]] = { v: '', st: 'empty' };
    if (NOT_REQUIRED[id] && NOT_REQUIRED[id].vals.indexOf(v) >= 0) NOT_REQUIRED[id].clear.forEach(function (d) { if (state.f[d]) state.f[d] = { v: '', st: 'empty' }; });
    if (id === 'sname' || id === 'gender') followFather(state, was);
  }
  function addRow(state, key, data, st) {
    var d = {};
    schema.lists[key].cols.forEach(function (c) { d[c.k] = (data && data[c.k]) || ''; });
    if (key === 'kids' && !d.sname) d.sname = fatherSurname(state);
    if (key === 'invq' && !d.req) d.req = 'Request a quote';                                         // a row in the investment quotes is a quote asked for until it says otherwise
    var r = { d: d, st: st || 'confirmed' };
    state.l[key].push(r);
    LIST_GATES.forEach(function (g) { if (g[1] === key && state.f[g[0]] && state.f[g[0]].v !== 'Yes') state.f[g[0]] = { v: 'Yes', st: 'confirmed' }; });      // a row added is a Yes to "Has debts", "Has children" and the like
    return r;
  }
  function delRow(state, key, i) { state.l[key].splice(i, 1); }
  /* The instalment protector (BrightRock Risk Calculation): a debt is protected unless it is switched off (row.off). The switch is kept on the debt itself, so it goes with the row; a status such as "verify" is not touched. */
  function setProtect(state, i, on) { var r = state.l.debts[i]; if (!r) return; if (on) delete r.off; else r.off = true; }
  function setProtectAll(state, on) { (state.l.debts || []).forEach(function (r, i) { setProtect(state, i, on); }); }
  function setCell(state, key, i, k, v, st) {
    var r = state.l[key][i]; r.d[k] = v; r.st = st || 'confirmed';
    if ((key === 'redq' || key === 'bfred') && k === 'req' && v === 'Not required') { r.d.type = ''; r.d.amt = ''; if ('ins' in r.d) r.d.ins = ''; }        // a reduced quote that is not required keeps nothing
  }
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
  /* The name of the Fact Find saved as a PDF: "Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)", the date being Date completed (two-digit year), e.g. "Fact Find (Voice to Text) - 29.10.26 - (Sitamah Nathoo)". */
  function pdfFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday()), two = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'Fact Find (Voice to Text) - ' + two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100) + ' - (' + (safeName(clientName(state)) || 'New client') + ')';
  }
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
        if (k === 'debts' && r.d && r.d.prov_other && (!d.prov || d.prov === 'Other')) d.prov = r.d.prov_other;        // the bank used to be a pick-list with an "Other" box beside it: now one box, pick or type
        else if (k === 'debts' && d.prov === 'Other') d.prov = '';
        if (k === 'invq' && !d.req && Object.keys(d).some(function (c) { return d[c]; })) d.req = 'Request a quote';        // before the Request column, any investment quote with something in it was a request
        if (k === 'kids' && r.d && r.d.sname === undefined && d.name) {                         // saved when a child had one "Name & surname" box: split it
          var sp = util.splitFullName(d.name, j.f && j.f.sname && j.f.sname.v);
          d.name = sp.first; d.sname = sp.last;
        }
        var row = { d: d, st: r.st || 'confirmed' };
        if (k === 'debts' && r.off === true) row.off = true;                                    // a debt the instalment protector was switched off for
        return row;
      });
    });
    splitRetirement(s, j);
    brightRockLane(s, j);
    listGates(s);
    s.sum = cleanSum(j.sum);
    s.pa = cleanPa(j.pa);
    legacyNotes(s, j);
    s.unplaced = (Array.isArray(j.unplaced) ? j.unplaced : []).map(cleanUnplaced).filter(Boolean).slice(0, 60);
    s.claude = tallyFrom(j.claude);
    tidyAmounts(s);
    tidyDates(s);
    return s;
  }
  /* Files saved when retirement annuities, pension funds and provident funds were one list ("ret"): each fund goes into the list of its own kind (a fund with no type is taken as a retirement annuity). */
  function splitRetirement(s, j) {
    var old = j.l && j.l.ret;
    if (!Array.isArray(old) || (j.l.ret_ra || j.l.ret_pp)) return;
    old.forEach(function (r) {
      var d = r && r.d || {}, k = /pension|provident/i.test(d.type || '') ? 'ret_pp' : 'ret_ra', n = {};
      schema.lists[k].cols.forEach(function (c) { n[c.k] = d[c.k] || ''; });
      if (Object.keys(n).some(function (x) { return n[x]; })) s.l[k].push({ d: n, st: r.st || 'confirmed' });
    });
  }
  /* Files saved before the BrightRock Fractured quotes had their own boxes: every FNA, Shortfall and Reduced quote the client was to get from BrightRock (the insurer box says BrightRock) moves to the BrightRock Fractured
     boxes; the rest are the Standard quotes and stay where they were. A file saved since (it holds the BrightRock boxes) is left as it is. */
  function brightRockLane(s, j) {
    if (j.f && 'bf_fna_req' in j.f) return;
    var isBR = function (v) { return /^\s*brightrock\s*$/i.test(String(v == null ? '' : v)); };
    [['fna_req', 'fna_type', 'fna_ins', 'bf_fna_req', 'bf_fna_type'], ['sf_req', 'sf_type', 'sf_ins', 'bf_sf_req', 'bf_sf_type']].forEach(function (m) {
      if (!isBR(s.f[m[2]].v) || !s.f[m[0]].v) return;
      s.f[m[3]] = s.f[m[0]]; s.f[m[4]] = s.f[m[1]];
      s.f[m[0]] = { v: '', st: 'empty' }; s.f[m[1]] = { v: '', st: 'empty' }; s.f[m[2]] = { v: '', st: 'empty' };
    });
    s.l.redq = s.l.redq.filter(function (r) {
      if (!isBR(r.d.ins)) return true;
      s.l.bfred.push({ d: { req: r.d.req, type: r.d.type, amt: r.d.amt }, st: r.st });
      return false;
    });
  }
  /* Files saved before a list had its Yes/No answer (has debts, has children, has investments, has retirement annuities, has a pension or provident fund): a list with rows in it was a Yes. */
  var LIST_GATES = [['has_debts', 'debts'], ['has_kids', 'kids'], ['has_inv', 'inv'], ['has_ra', 'ret_ra'], ['has_pp', 'ret_pp']];
  function listGates(s) {
    LIST_GATES.forEach(function (g) { if (s.f[g[0]] && s.f[g[0]].v === '' && s.l[g[1]].some(rowFilled)) s.f[g[0]] = { v: 'Yes', st: 'confirmed' }; });
  }
  /* The notes boxes of the old advisor pages (quotes, referrals, buy & sell) are now one notes box on the Client priorities page (the Risk calculation page keeps its own): what was written in them is kept there, each under its old heading. */
  var LEGACY_NOTES = [['n_q_risk', 'Personal risk quotes'], ['n_q_ret', 'Retirement & investment quotes'], ['n_ref', 'Referrals'], ['n_bs', 'Buy & Sell']];
  function legacyNotes(s, j) {
    var add = [];
    LEGACY_NOTES.forEach(function (n) { var c = j.f && j.f[n[0]], v = c && String(c.v == null ? '' : c.v).trim(); if (v) add.push(n[1] + ': ' + v); });
    if (add.length && s.f.n_prio && !String(s.f.n_prio.v).trim()) s.f.n_prio = { v: add.join('\n'), st: 'confirmed' };
  }
  /* The summaries on the Client priorities page, as Claude last wrote them: per area { lines: [short points], key (what the area held when it was written), at (when) }. */
  function cleanSum(x) {
    var out = {};
    if (!x || typeof x !== 'object') return out;
    Object.keys(schema.panelsById).forEach(function (id) {
      var e = x[id]; if (!e || !Array.isArray(e.lines)) return;
      var lines = e.lines.map(function (l) { return String(l == null ? '' : l).replace(/\s+/g, ' ').trim().slice(0, 200); }).filter(Boolean).slice(0, 10);
      if (lines.length) out[id] = { lines: lines, key: String(e.key || ''), at: String(e.at || '') };
    });
    return out;
  }
  function setSum(state, id, lines, key) {
    state.sum = state.sum || {};
    state.sum[id] = { lines: lines.slice(0, 10), key: String(key || ''), at: new Date().toISOString() };
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
  /* Facts heard in the conversation that did not reach a box ("Heard but not placed"). They are kept with the Fact Find until the adviser deals with each one.
     item: { text, why?, sec?, field?, value? (a box and the value to put in it), list?, values? (a list and the row to add) } */
  function unplacedKey(it) { return String(it.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '|' + (it.field || it.list || ''); }
  /* The same fact in other words ("Has gout" / "Health: client also has gout"; "blood pressure 140 over 180" said twice): most of the words of the shorter one are in the other, in the same section. */
  var FACT_FILLER = { the: 1, a: 1, an: 1, of: 1, is: 1, was: 1, are: 1, has: 1, have: 1, had: 1, that: 1, and: 1, to: 1, for: 1, in: 1, on: 1, her: 1, his: 1, she: 1, he: 1, client: 1, says: 1, said: 1, also: 1, about: 1, with: 1, from: 1, it: 1, its: 1, mentioned: 1, health: 1, note: 1 };
  function factWords(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9% ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !FACT_FILLER[w]; }); }
  function sameFact(a, b) {
    if (a.sec && b.sec && a.sec !== b.sec) return false;
    if ((a.field || a.list || '') !== (b.field || b.list || '')) return false;
    var x = factWords(a.text), y = factWords(b.text), small = x.length <= y.length ? x : y, big = x.length <= y.length ? y : x;
    if (small.length < 1 || (small.length < 2 && big.length > 2)) return false;                 // one word is enough only when the other has hardly any more ("gout")
    var hit = small.filter(function (w) { return big.indexOf(w) >= 0; }).length;
    return hit / small.length >= 0.7;
  }
  function cleanUnplaced(it) {
    if (!it || typeof it !== 'object' || typeof it.text !== 'string' || it.text.trim().length < 3) return null;
    var o = { id: String(it.id || ''), text: it.text.trim().slice(0, 240) };
    if (typeof it.why === 'string' && it.why) o.why = it.why.slice(0, 240);
    if (typeof it.sec === 'string' && schema.sections.some(function (x) { return x.id === it.sec; })) o.sec = it.sec;
    if (typeof it.field === 'string' && schema.fieldsById[it.field] && typeof it.value === 'string') { o.field = it.field; o.value = it.value; }
    if (typeof it.list === 'string' && schema.lists[it.list] && it.values && typeof it.values === 'object') {
      o.list = it.list; o.values = {};
      Object.keys(it.values).forEach(function (k) { if (schema.lists[it.list].cols.some(function (c) { return c.k === k; })) o.values[k] = String(it.values[k]); });
    }
    if (!o.id) o.id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return o;
  }
  /* seen (optional): keys already dealt with this session, so a fact that was dismissed does not come back. -> the stored item, or null when it is a repeat. */
  function addUnplaced(state, item, seen) {
    var it = cleanUnplaced(item); if (!it) return null;
    var k = unplacedKey(it);
    if ((seen && seen[k]) || (state.unplaced || []).some(function (x) { return unplacedKey(x) === k || sameFact(x, it); })) return null;
    (state.unplaced = state.unplaced || []).push(it);
    return it;
  }
  function closeUnplaced(state, id, seen) {
    var list = state.unplaced || [], i = -1;
    list.forEach(function (x, n) { if (x.id === id) i = n; });
    if (i < 0) return null;
    var it = list.splice(i, 1)[0]; if (seen) seen[unplacedKey(it)] = 1;
    return it;
  }
  function toJSON(state) { state.modified = new Date().toISOString(); return JSON.stringify(state, null, 2); }

  /* A policy schedule request is not an answer to count when the Yes/No above it says there is nothing to ask for. */
  var PS_GATE = { ps_risk: ['has_risk', 'No'], ps_grp: ['has_group', 'No'], ps_ra: ['has_ra', 'No'], ps_pp: ['has_pp', 'No'], ps_inv: ['has_inv', 'No'] };
  function rowFilled(r) { return Object.keys(r.d || {}).some(function (k) { return String(r.d[k] == null ? '' : r.d[k]).trim() !== ''; }); }
  /* Progress for a section: how many answers are filled out of those that count. A row of a list counts when something is in it; a list that is on show and empty is one answer still to give; the seven duties boxes
     are one answer (they add up to 100%). */
  function counts(state, sec) {
    var ctx = ctxFor(state), tot = 0, fill = 0, ver = 0;
    if (!calc.showIf(sec.cond, ctx)) return { tot: 0, fill: 0, ver: 0 };
    sec.blocks.forEach(function (b) {
      if (!calc.showIf(b.cond, ctx)) return;
      (b.fields || []).forEach(function (f) {
        if (f.calc || f.opt || f.preset || !calc.showIf(f.cond, ctx)) return;
        var g = PS_GATE[f.id], c = state.f[f.id];
        if (g && ctx.v(g[0]).trim() === g[1]) return;
        if (calc.DUTY_IDS.indexOf(f.id) >= 0) {
          if (f.id === calc.DUTY_IDS[0]) { tot++; if (Math.abs(calc.DUTY_IDS.reduce(function (a, id) { return a + ctx.n(id); }, 0) - 100) < 0.001) fill++; }
          if (c.st === 'verify') ver++;
          return;
        }
        tot++; if (c.v !== '') fill++; if (c.st === 'verify') ver++;
      });
      if (b.list) {
        var rows = state.l[b.list];
        rows.forEach(function (r) { tot++; if (rowFilled(r)) fill++; if (r.st === 'verify') ver++; });
        if (!rows.length && schema.lists[b.list].need) tot++;
      }
    });
    return { tot: tot, fill: fill, ver: ver };
  }

  return { setProtect: setProtect, setProtectAll: setProtectAll, setPa: setPa, blankPa: blankPa, cleanPa: cleanPa, setSum: setSum, cleanSum: cleanSum, addUnplaced: addUnplaced, closeUnplaced: closeUnplaced, unplacedKey: unplacedKey, blank: blank, blankTally: blankTally, ctxFor: ctxFor, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, clientName: clientName, idClash: idClash, idKey: idKey, fatherSurname: fatherSurname, baseFileName: baseFileName, pdfFileName: pdfFileName, fromJSON: fromJSON, toJSON: toJSON, counts: counts };
});
