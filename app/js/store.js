/* The client's answers, and saving them. State is plain data so it can be saved as a file and reopened.
   Each field holds { v, st }. st is one of: empty, preset, confirmed (typed or accepted), heard, verify, suggest.
   The last three are used when answers come from a live call. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./schema.js'), require('./calc.js'), require('./autoprio.js'));
  else { root.FF = root.FF || {}; root.FF.store = factory(root.FF.util, root.FF.schema, root.FF.calc, root.FF.autoprio); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc, autoprio) {
  var APP_ID = 'wr-fact-find';

  /* What Claude has cost for this fact find (an estimate from the published prices, see lookup.js): dollars and the tokens behind them. It travels with the saved file. */
  function blankTally() { return { usd: 0, calls: 0, input: 0, output: 0, read: 0, write: 0, searches: 0 }; }
  function tallyFrom(t) {
    var o = blankTally();
    Object.keys(o).forEach(function (k) { if (t && +t[k] > 0 && isFinite(+t[k])) o[k] = +t[k]; });
    return o;
  }
  /* What the spoken lines sent to OpenAI for transcription cost, kept with the Fact Find the same way: { usd, seconds of sound, lines sent }. */
  function blankSpeech() { return { usd: 0, seconds: 0, calls: 0 }; }
  function speechFrom(t) {
    var o = blankSpeech();
    Object.keys(o).forEach(function (k) { if (t && +t[k] > 0 && isFinite(+t[k])) o[k] = +t[k]; });
    return o;
  }
  /* The action points on the Admin page: what they were written from (key), when (at), by what ('claude' or 'form'), and whether the adviser has typed in the box since (edited): after that they no longer follow the form until Refresh. */
  function blankPa() { return { key: '', at: '', by: '', edited: false }; }
  /* Which priority areas the adviser has taken over from the form: once the decision of an area that the form had set (autoprio.js) is changed by hand, the form never sets it again. */
  function blankAuto() { return { skip: {} }; }
  function cleanAuto(a) { var o = blankAuto(); if (a && a.skip && typeof a.skip === 'object') Object.keys(a.skip).forEach(function (k) { if (a.skip[k] === true && autoprio.AREAS[k]) o.skip[k] = true; }); return o; }
  function cleanPa(x) {
    var o = blankPa(); if (!x || typeof x !== 'object') return o;
    o.key = String(x.key || '').slice(0, 40); o.at = String(x.at || '').slice(0, 40); o.by = x.by === 'claude' || x.by === 'form' ? x.by : ''; o.edited = x.edited === true;
    return o;
  }
  function setPa(state, key, by) { state.pa = { key: String(key || ''), at: new Date().toISOString(), by: by === 'claude' ? 'claude' : 'form', edited: false }; }
  /* The Priorities to be Focused on box (top of Client priorities and quotes needed) is kept the same way as the action points: what it was written from, when, by what, and whether the adviser has typed in it since. */
  function setFocus(state, key, by) { state.focus = { key: String(key || ''), at: new Date().toISOString(), by: by === 'claude' ? 'claude' : 'form', edited: false }; }
  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null, f: {}, l: {}, sum: {}, auto: blankAuto(), pa: blankPa(), focus: blankPa(), unplaced: [], claude: blankTally(), openai: blankSpeech() };
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
    bf_fna_req: { vals: ['Not required', 'No FNA done'], clear: ['bf_fna_type'] }, bf_sf_req: { vals: ['Not required'], clear: ['bf_sf_type'] },
    has_risk: { vals: ['No'], clear: ['ps_risk', 'ps_risk_ot'] }, has_group: { vals: ['No'], clear: ['ps_grp', 'ps_grp_ot'] }, has_ra: { vals: ['No'], clear: ['ps_ra', 'ps_ra_ot'] },       // nothing there, so no policy schedules to request
    has_pp: { vals: ['No'], clear: ['ps_pp', 'ps_pp_ot'] }, has_inv: { vals: ['No'], clear: ['ps_inv', 'ps_inv_ot'] } };
  /* "Other" in a policy schedule list opens its small box: when Other is not ticked any more, what was typed there goes. */
  var PS_OTHER_BOX = { ps_risk: 'ps_risk_ot', ps_grp: 'ps_grp_ot', ps_ra: 'ps_ra_ot', ps_pp: 'ps_pp_ot', ps_inv: 'ps_inv_ot' };
  function setField(state, id, v, st) {
    var def = schema.fieldsById[id];
    if (def && def.time) { var pt = util.parseTime(v); if (pt) v = util.formatTime(pt); }                  // "2pm" and "2:30 pm" are kept as 14:30, however they got here
    var was = id === 'sname' || id === 'gender' ? fatherSurname(state) : null, prevBox = state.f[id];
    state.f[id] = { v: v, st: st || (v === '' ? 'empty' : 'confirmed') };
    autoprio.touched(state, id, prevBox);                                                                    // the adviser changing a decision the form had set takes the area over
    if (PS_OTHER_BOX[id] && state.f[PS_OTHER_BOX[id]] && String(v).split(';').map(function (x) { return x.trim(); }).indexOf('Other') < 0) state.f[PS_OTHER_BOX[id]] = { v: '', st: 'empty' };
    if (NOT_REQUIRED[id] && NOT_REQUIRED[id].vals.indexOf(v) >= 0) NOT_REQUIRED[id].clear.forEach(function (d) { if (state.f[d]) state.f[d] = { v: '', st: 'empty' }; });
    if (id === 'sname' || id === 'gender') followFather(state, was);
    if (calc.DUTY_IDS.indexOf(id) >= 0) settleDuties(state);
    if (BROKER_OF[id]) brokerDefault(state, id);
    if (id === 'edu') eduDefault(state);
    if (id === 'employed') employerDefault(state);
    if (id === 'dob' || id === 'date') termsFollow(state);                                                   // a term said as an age becomes months once the date of birth is known
    autoprio.apply(state);                                                                                   // the outcomes the facts give (autoprio.js)
  }
  /* Defaults that follow another answer, shown as defaults (status "preset") and never put over an answer that was typed or said: Qualification details starts as N/A when the highest education is Matric,
     and Employer as N/A when the client is not employed. When the answer above changes, a default that was not touched goes again. */
  var NA = 'N/A', MAX_TERM = 'Max term', NO_ASSET = 'R 0.00';
  function followDefault(state, id, gateOn, value) {
    var box = state.f[id]; if (!box) return;
    if (gateOn) { if (box.v === '') state.f[id] = { v: value, st: 'preset' }; }
    else if (box.st === 'preset' && box.v === value) state.f[id] = { v: '', st: 'empty' };
  }
  function eduDefault(state) { followDefault(state, 'edu_notes', state.f.edu.v === 'Matric', NA); }
  function employerDefault(state) { followDefault(state, 'employer', state.f.employed.v === 'No', NA); }
  /* A debt on a property (a Home loan, or an Other debt that says house, flat, townhouse and the like) has an Asset value. Every other debt has none. */
  function isPropertyDebt(d) {
    var t = String(d.type || '');
    return t === 'Home loan' || (t === 'Other' && /\b(?:house|home|flat|apartment|townhouse|property|farm|erf|stand|land|cottage|bond)\b/i.test(String(d.desc || '') + ' ' + String(d.notes || '')));
  }
  /* Term left on a debt is always a number of months: "20 years" is kept as 240, "5 years 6 months" as 66, "until age 65" as the months from the date of the form to the client's 65th birthday (from the date of birth;
     until that is on the form the words stay, and they become months when it is). Digits alone are months; "Max term" stays; anything else is left as typed. */
  function termOpts(state) { return { dob: util.parseDate(state.f.dob && state.f.dob.v), on: util.parseDate(state.f.date && state.f.date.v) || undefined }; }
  function termValue(state, raw) {
    var r = util.termMonths(raw, termOpts(state));
    return r && r.months != null ? String(r.months) : raw;
  }
  function termsFollow(state) { (state.l.debts || []).forEach(function (r) { var t = String(r.d.term || ''); if (t && !/^\d+$/.test(t)) r.d.term = termValue(state, t); }); }
  /* Debts: a credit card or revolving credit starts with the Term left "Max term"; a debt that is not on a property starts with the Asset value R 0.00 (there is no asset). Only empty boxes are filled, a typed answer is
     never changed, and an R 0.00 left by this rule goes again when the debt turns out to be on a property. */
  function debtDefaults(r) {
    var d = r.d, t = String(d.type || ''); if (!t) return;
    var card = t === 'Credit card' || t === 'Revolving credit';                                      // these two have no term: "Max term" is the default whenever one of them is chosen, and goes again when the type is another
    if (card && String(d.term || '').trim() === '') d.term = MAX_TERM; else if (!card && d.term === MAX_TERM) d.term = '';
    if (isPropertyDebt(d)) { if (d.asset === NO_ASSET) d.asset = ''; }
    else if (String(d.asset || '').trim() === '') d.asset = NO_ASSET;
  }
  /* "Broker on record" in Medical aid, Gap cover, Will and Short-term insurance starts as Other broker, shown as a default (status "preset"): on a new form, and again whenever the answer above it does not close the boxes
     (Medical aid not None, Gap cover not No, and so on; an answer not given yet does not close them). When the answer closes them (None, No), a default that was not touched goes, so nothing is left under a No.
     A broker the adviser or the client chose is never changed. */
  var BROKER_OF = { ma: ['ma_broker', ['None']], gap: ['gap_broker', ['No']], will: ['will_broker', ['No']], sti: ['sti_broker', ['No', 'Handled by spouse']] };
  function brokerDefault(state, id) {
    var b = BROKER_OF[id], gate = state.f[id].v, box = state.f[b[0]];
    if (!box) return;
    if (b[1].indexOf(gate) < 0) { if (box.v === '') state.f[b[0]] = { v: schema.defaultBroker, st: 'preset' }; }               // an answer not given yet ('') does not close the boxes
    else if (box.st === 'preset' && box.v === schema.defaultBroker) state.f[b[0]] = { v: '', st: 'empty' };
  }
  /* Duties split: once the boxes that are filled add up to 100%, the boxes still empty are set to 0 (shown as a default, status "preset": nothing was heard). When the total moves off 100% again, those automatic
     zeros are taken away, so a box the adviser or the client really answered (typed, said, or a 0 typed by hand) is never touched. */
  function settleDuties(state) {
    var ids = calc.DUTY_IDS, total = ids.reduce(function (a, id) { return a + util.num(state.f[id].v); }, 0), full = Math.abs(total - 100) < 0.001;
    ids.forEach(function (id) {
      var c = state.f[id];
      if (full && c.v === '') state.f[id] = { v: '0', st: 'preset' };
      else if (!full && c.st === 'preset' && c.v === '0') state.f[id] = { v: '', st: 'empty' };
    });
  }
  function addRow(state, key, data, st) {
    var d = {};
    schema.lists[key].cols.forEach(function (c) { d[c.k] = (data && data[c.k]) || c.def || ''; });         // a column can have a value a new row starts with (Broker on record: Other broker)
    if (key === 'kids' && !d.sname) d.sname = fatherSurname(state);
    if (key === 'invq' && !d.req) d.req = 'Request a quote';                                         // a row in the investment quotes is a quote asked for until it says otherwise
    if ((key === 'bfred' || key === 'redq') && !d.type) d.type = autoprio.typeStartValue(state);          // Type of quote starts as New Business (no personal risk cover) or Servicing (a policy with Paul K)
    var r = { d: d, st: st || 'confirmed' };
    if (key === 'debts') { if (r.d.term) r.d.term = termValue(state, r.d.term); debtDefaults(r); }
    state.l[key].push(r);
    if (key === 'debts' && state.f.debts_end && state.f.debts_end.v) state.f.debts_end = { v: '', st: 'empty' };      // a debt added: it was not the last, so "No more debts" goes
    LIST_GATES.forEach(function (g) { if (g[1] === key && state.f[g[0]] && state.f[g[0]].v !== 'Yes') state.f[g[0]] = { v: 'Yes', st: 'confirmed' }; });      // a row added is a Yes to "Has debts", "Has children" and the like
    autoprio.apply(state);
    return r;
  }
  function delRow(state, key, i) {
    state.l[key].splice(i, 1);
    if (key === 'debts' && !state.l.debts.length && state.f.debts_end && state.f.debts_end.v) state.f.debts_end = { v: '', st: 'empty' };      // no debt left: nothing for the line to be under
    autoprio.apply(state);
  }
  /* The instalment protector (BrightRock Risk Calculation): a debt is protected unless it is switched off (row.off). The switch is kept on the debt itself, so it goes with the row; a status such as "verify" is not touched. */
  function setProtect(state, i, on) { var r = state.l.debts[i]; if (!r) return; if (on) delete r.off; else r.off = true; }
  function setProtectAll(state, on) { (state.l.debts || []).forEach(function (r, i) { setProtect(state, i, on); }); }
  function setCell(state, key, i, k, v, st) {
    var r = state.l[key][i]; if (key === 'debts' && k === 'term') v = termValue(state, v); r.d[k] = v; r.st = st || 'confirmed';
    if (key === 'debts' && (k === 'type' || k === 'desc' || k === 'notes')) debtDefaults(r);
    if ((key === 'redq' || key === 'bfred') && k === 'req' && v === 'Not required') { r.d.type = ''; r.d.amt = ''; if ('ins' in r.d) r.d.ins = ''; }        // a reduced quote that is not required keeps nothing
    autoprio.apply(state);
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
  /* The name of the Fact Find saved as a PDF, and of the saved Fact Find file (.json), is the same: "Fact Find (Audio to Text) - dd.mm.yy - (Name Surname)", the date being Date completed (two-digit year),
     e.g. "Fact Find (Audio to Text) - 29.10.26 - (Sitamah Nathoo)"; only the ending (.pdf or .json) differs. */
  function pdfFileName(state) {
    var d = util.parseDate(state.f.date.v) || util.parseDate(util.isoToday()), two = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'Fact Find (Audio to Text) - ' + two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100) + ' - (' + (safeName(clientName(state)) || 'New client') + ')';
  }
  function baseFileName(state) { return pdfFileName(state); }

  /* Reopen a saved file. Unknown ids are ignored and missing ones start blank, so older files keep working. */
  function fromJSON(text) {
    var j = JSON.parse(text);
    if (!j || j.app !== APP_ID) throw new Error('This file is not a Wealth Revolution Fact Find.');
    var s = blank();
    s.created = j.created || s.created; s.modified = j.modified || null;
    Object.keys(j.f || {}).forEach(function (id) { if (s.f[id]) s.f[id] = { v: String(j.f[id].v == null ? '' : j.f[id].v), st: j.f[id].st || 'confirmed' }; });
    s.auto = cleanAuto(j.auto);
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
    scheduleWording(s);
    referralFacts(s);
    priorityWording(s);
    brokerChoices(s);
    openDefaults(s);
    autoprio.apply(s);                                                                               // an older file with an empty decision gets the outcomes the facts already give
    s.sum = cleanSum(j.sum);
    s.pa = cleanPa(j.pa);
    s.focus = cleanPa(j.focus);
    legacyNotes(s, j);
    s.unplaced = (Array.isArray(j.unplaced) ? j.unplaced : []).map(cleanUnplaced).filter(Boolean).slice(0, 60);
    s.claude = tallyFrom(j.claude);
    s.openai = speechFrom(j.openai);
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
    LIST_GATES.forEach(function (g) { if (s.f[g[0]] && s.f[g[0]].v === '' && s.l[g[1]].some(function (r) { return rowFilled(g[1], r); })) s.f[g[0]] = { v: 'Yes', st: 'confirmed' }; });
  }
  /* Files saved when every schedule box said "Requested from client in meeting": each box now says it in the words of its own area (Requested Personal Risk Covers in meeting, await client response, ...). */
  function scheduleWording(s) {
    Object.keys(schema.psClient).forEach(function (area) {
      var c = s.f['ps_' + area]; if (!c || (String(c.v).indexOf(schema.psClientOld) < 0 && String(c.v).indexOf(schema.psNoSend) < 0)) return;
      var seen = {};
      c.v = String(c.v).split(';').map(function (x) { x = x.trim(); return x === schema.psClientOld ? schema.psClient[area] : x === schema.psNoSend ? schema.psSaved : x; }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).join('; ');      // "Client does not need to send through" is gone: it opens as Policy Schedules saved in Client File
    });
  }
  /* The referral boxes no longer have the choices that only said what is asked elsewhere on the page: "Client has own broker" is the short-term broker box (Other broker) and "Has updated will" is the will boxes. A file that holds
     one of them keeps the fact in its own box (when that box is empty) and the referral says Not interested, which is what the action points already did with it. */
  function referralFacts(s) {
    var put = function (id, v) { if (s.f[id] && s.f[id].v === '') s.f[id] = { v: v, st: 'confirmed' }; };
    if (s.f.ref_sti && s.f.ref_sti.v === 'Client has own broker') { put('sti', 'Yes'); put('sti_broker', 'Other broker'); s.f.ref_sti = { v: 'Not required', st: s.f.ref_sti.st }; }
    if (s.f.ref_will && s.f.ref_will.v === 'Has updated will') { put('will', 'Yes'); put('will_up', 'Yes'); s.f.ref_will = { v: 'Not required', st: s.f.ref_will.st }; }
  }
  /* Version 3.4: the one no of a priority area's decision is plain "Not a priority" (it was "Not a priority: client not interested"), and the Will and Short-term referral boxes say "Not required" where they said
     "Not interested". An older file opens with the new words in the same places, so the page colours, the quote boxes and the action points follow as before. */
  function priorityWording(s) {
    schema.panels.forEach(function (P) { if (P.dec && s.f[P.dec] && s.f[P.dec].v === schema.NOT_PRIORITY_OLD) s.f[P.dec] = { v: schema.NOT_PRIORITY, st: s.f[P.dec].st }; });
    ['ref_will', 'ref_sti'].forEach(function (id) { if (s.f[id] && s.f[id].v === 'Not interested') s.f[id] = { v: 'Not required', st: s.f[id].st }; });
  }
  /* "Broker on record" is the same four choices everywhere. A file saved with the older medical aid, gap cover and short-term choices keeps the fact: "Privately paid, no broker" is None, "Privately paid, other
     broker" and "Cameron Maritz" are Other broker. */
  function brokerChoices(s) {
    var old = { 'Privately paid, no broker': 'None', 'Privately paid, other broker': 'Other broker', 'Cameron Maritz': 'Other broker' };
    ['ma_broker', 'gap_broker', 'will_broker', 'sti_broker'].forEach(function (id) { var c = s.f[id]; if (c && old.hasOwnProperty(c.v)) c.v = old[c.v]; });
  }
  /* The rules that start a box off by itself (the Duties zeros, Broker on record: Other broker) also apply to a file that is opened, because it may have been saved before they existed: a Duties split that adds up to
     100% gets 0 in the empty boxes; every policy row that has something in it and no broker gets Other broker; and the broker box of Medical aid, Gap cover, Will and Short-term insurance gets it unless its answer closes it.
     Nothing that is there is changed, and a second opening changes nothing more. */
  function openDefaults(s) {
    settleDuties(s);
    Object.keys(schema.lists).forEach(function (key) {
      var defs = schema.lists[key].cols.filter(function (c) { return c.def != null; });
      if (!defs.length || !s.l[key]) return;
      s.l[key].forEach(function (r) {
        if (rowBlank(key, r)) return;                                                       // a row with nothing in it stays empty
        defs.forEach(function (c) { if (r.d[c.k] == null || String(r.d[c.k]).trim() === '') r.d[c.k] = c.def; });
      });
    });
    Object.keys(BROKER_OF).forEach(function (id) { if (s.f[id]) brokerDefault(s, id); });
    eduDefault(s); employerDefault(s);
    (s.l.debts || []).forEach(function (r) { if (!rowBlank('debts', r)) { if (r.d.term) r.d.term = termValue(s, r.d.term); debtDefaults(r); } });      // a file saved with "20 years" opens with 240
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
  /* The worked-out figures (worked.js) are written beside the answers in the saved file, under "worked", on a copy of the state: the form's own state never holds them, and opening a file never reads them back. */
  var workedBuilder = null;
  function useWorked(fn) { workedBuilder = fn; }
  function toJSON(state) {
    state.modified = new Date().toISOString();
    var out = state, w = null;
    if (workedBuilder) { try { w = workedBuilder(state); } catch (e) { w = null; } }
    if (w) { out = Object.assign({}, state); out.worked = w; }
    return JSON.stringify(out, null, 2);
  }

  /* A policy schedule request is not an answer to count when the Yes/No above it says there is nothing to ask for. */
  var PS_GATE = { ps_risk: [['has_risk', 'No']], ps_grp: [['has_group', 'No']], ps_ra: [['has_ra', 'No']], ps_pp: [['has_pp', 'No']], ps_inv: [['has_inv', 'No']] };      // every Yes/No listed says No
  /* A row is empty when every box is empty or holds only the value a new row starts with (the default Broker on record). */
  function cellBlank(key, k, v) {
    v = v == null ? '' : String(v).trim();
    if (v === '') return true;
    var L = schema.lists[key], col = L && L.cols.filter(function (c) { return c.k === k; })[0];
    return !!(col && col.def != null && v === col.def);
  }
  function rowBlank(key, r) { return Object.keys(r.d || {}).every(function (k) { return cellBlank(key, k, r.d[k]); }); }
  function rowFilled(key, r) { return !rowBlank(key, r); }
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
        if (g && g.every(function (x) { return ctx.v(x[0]).trim() === x[1]; })) return;
        if (calc.DUTY_IDS.indexOf(f.id) >= 0) {
          if (f.id === calc.DUTY_IDS[0]) { tot++; if (Math.abs(calc.DUTY_IDS.reduce(function (a, id) { return a + ctx.n(id); }, 0) - 100) < 0.001) fill++; }
          if (c.st === 'verify') ver++;
          return;
        }
        tot++; if (c.v !== '') fill++; if (c.st === 'verify') ver++;
      });
      if (b.list) {
        var rows = state.l[b.list];
        rows.forEach(function (r) { tot++; if (rowFilled(b.list, r)) fill++; if (r.st === 'verify') ver++; });
        if (!rows.length && schema.lists[b.list].need) tot++;
      }
    });
    return { tot: tot, fill: fill, ver: ver };
  }

  return { termValue: termValue, useWorked: useWorked, isPropertyDebt: isPropertyDebt, debtDefaults: debtDefaults, rowBlank: rowBlank, rowFilled: rowFilled, setProtect: setProtect, setProtectAll: setProtectAll, setPa: setPa, setFocus: setFocus, blankPa: blankPa, cleanPa: cleanPa, setSum: setSum, cleanSum: cleanSum, addUnplaced: addUnplaced, closeUnplaced: closeUnplaced, unplacedKey: unplacedKey, blank: blank, blankTally: blankTally, blankSpeech: blankSpeech, ctxFor: ctxFor, setField: setField, addRow: addRow, delRow: delRow, setCell: setCell, accept: accept, clientName: clientName, idClash: idClash, idKey: idKey, fatherSurname: fatherSurname, baseFileName: baseFileName, pdfFileName: pdfFileName, fromJSON: fromJSON, toJSON: toJSON, counts: counts };
});
