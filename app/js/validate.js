/* Checks that catch typing slips and, later, misheard words. They only warn; nothing is blocked. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./calc.js'), require('./schema.js'));
  else { root.FF = root.FF || {}; root.FF.validate = factory(root.FF.util, root.FF.calc, root.FF.schema); }
})(typeof self !== 'undefined' ? self : this, function (util, calc, schema) {
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var AMOUNT = /^[Rr]?[\s\d.,\-]*\d[\s\d.,]*$/;                                                    // what an amount box may hold (the same test util.formatMoney uses)
  var REQUEST = 'Request a quote';
  /* How many digits the boxes with a length rule need: a South African ID number has 13, an income tax reference number 10. */
  var LEN = { idno: 13, tax: 10 };
  /* The live indicator beside those boxes -> null when there is nothing to show (no rule, or a passport), else { level: 'hint' | 'short' | 'ok' | 'bad', text }. */
  function lengthState(id, value, idtype) {
    var n = LEN[id], raw = String(value == null ? '' : value).trim();
    if (!n || (id === 'idno' && idtype === 'Passport')) return null;
    if (raw === '' || raw === 'None') return { level: 'hint', text: n + ' digits' };
    if (/[^\d\s\-]/.test(raw)) return { level: 'bad', text: 'digits only' };
    var d = raw.replace(/\D/g, '');
    if (d.length < n) return { level: 'short', text: d.length + ' of ' + n + ' digits' };
    if (d.length > n) return { level: 'bad', text: d.length + ' digits, ' + (d.length - n) + ' too many' };
    if (id === 'idno' && !util.saIdValid(d)) return { level: 'bad', text: n + ' digits, ' + (util.dobFromSaId(d) ? 'check digit wrong' : 'date part wrong') };
    return { level: 'ok', text: n + ' digits ✓' };
  }
  function phoneOk(v) { var d = String(v).replace(/[\s()\-]/g, ''); return /^0\d{9}$/.test(d) || /^\+?27\d{9}$/.test(d); }
  function ymd(d) { return d.y * 10000 + d.m * 100 + d.d; }
  function filled(r) { return Object.keys(r.d || {}).some(function (k) { return String(r.d[k] == null ? '' : r.d[k]).trim() !== ''; }); }

  /* Where each box and list sits, so a check can tell whether it is on show. A check never speaks about a box that is hidden or greyed out: the adviser cannot see it to put it right. */
  var boxBlock = {}, boxSection = {}, listBlock = {}, listSection = {}, moneyIds = [], moneyCols = [];
  schema.sections.forEach(function (s) {
    s.blocks.forEach(function (b) {
      (b.fields || []).forEach(function (f) { boxBlock[f.id] = b; boxSection[f.id] = s; if (f.money && !f.calc) moneyIds.push(f.id); });
      if (b.list && !listBlock[b.list]) { listBlock[b.list] = b; listSection[b.list] = s; }
    });
  });
  Object.keys(schema.lists).forEach(function (k) { schema.lists[k].cols.forEach(function (c) { if (c.money) moneyCols.push({ list: k, k: c.k, l: c.l }); }); });
  function shown(ctx, id) {
    var f = schema.fieldsById[id];
    return !!f && calc.showIf(boxSection[id] && boxSection[id].cond, ctx) && calc.showIf(boxBlock[id] && boxBlock[id].cond, ctx) && calc.showIf(f.cond, ctx);
  }
  function listShown(ctx, key) { return calc.showIf(listSection[key] && listSection[key].cond, ctx) && calc.showIf(listBlock[key] && listBlock[key].cond, ctx); }

  /* A Yes/No answer that switches boxes off, and what can still be sitting under it: [box, answers that switch it off, what is under it (boxes, lists), what to call it]. */
  var GATES = [
    ['has_risk', ['No'], { lists: ['risk'] }, 'personal risk policies'],
    ['has_group', ['No'], { lists: ['grp'] }, 'group risk policies'],
    ['biz_assur', ['No'], { lists: ['bizpol'] }, 'business assurance policies'],
    ['ma', ['None'], { ids: ['ma_prov', 'ma_plan', 'ma_broker'] }, 'medical aid details'],
    ['gap', ['No'], { ids: ['gap_prov', 'gap_broker'] }, 'gap cover details'],
    ['will', ['No'], { ids: ['will_up', 'will_where', 'will_where_other', 'will_broker', 'will_date'] }, 'will details'],
    ['sti', ['No'], { ids: ['sti_broker', 'sti_car', 'sti_house', 'sti_struct', 'sti_personal', 'sti_biz', 'sti_biz_spend'] }, 'short-term insurance details']
  ];
  var SCHEDULE_BOXES = ['ps_risk', 'ps_grp', 'ps_ra', 'ps_pp', 'ps_inv'];

  /* Returns [{ id, msg }] for a field, or [{ list, i, msg }] for a list row. */
  function check(ctx) {
    var out = [], v = function (id) { var x = ctx.v(id).trim(); return x === 'None' ? '' : x; };
    function warn(id, msg) { if (shown(ctx, id)) out.push({ id: id, msg: msg }); }              // about a box that is on show
    function warnAnyway(id, msg) { out.push({ id: id, msg: msg }); }                               // about the answer that switched other boxes off, which stays on show
    function rowWarn(list, i, msg) { if (listShown(ctx, list)) out.push({ list: list, i: i, msg: msg }); }
    var now = calc.meetingDate(ctx);

    var idno = v('idno').replace(/\s/g, '');
    if (idno && v('idtype') !== 'Passport') {
      if (!/^\d{13}$/.test(idno)) warn('idno', 'A South African ID number has 13 digits.');
      else if (!util.saIdValid(idno)) warn('idno', 'This is not a valid South African ID number. Check each digit.');
    }
    var tax = v('tax').replace(/[\s\-]/g, '');
    if (tax && !/^\d{10}$/.test(tax)) warn('tax', /^\d+$/.test(tax) ? 'A tax number has 10 digits.' : 'A tax number has digits only (10 of them).');
    if (v('date') && !util.parseDate(v('date'))) warn('date', 'Date not recognised. Use day/month/year, such as ' + util.todayDMY() + '. Until it is put right, today\'s date is used for the age and the tax year.');
    if (v('dob') && !util.parseDate(v('dob'))) warn('dob', 'Date not recognised. Use day/month/year, such as 14/03/1986.');
    else if (v('dob') && ymd(util.parseDate(v('dob'))) > ymd(now)) warn('dob', 'This date is after the date of the form.');
    if (/^(Married|Customary marriage|Civil union)/.test(v('marital')) && v('marr_date')) {                                          // the date of marriage only counts for a marriage type
      var md = util.parseDate(v('marr_date')), cd = util.parseDate(v('dob')) || (util.saIdValid(idno) ? util.dobFromSaId(idno) : null);
      if (!md && /^(?:19|20)\d\d$/.test(v('marr_date'))) { if (+v('marr_date') > now.y) warn('marr_date', 'This year is after the date of the form.'); }       // only the year is known: that is enough
      else if (!md) warn('marr_date', 'Date not recognised. Use day/month/year, such as 14/03/2010.');
      else if (ymd(md) > ymd(now)) warn('marr_date', 'This date is after the date of the form.');
      else if (cd && util.ageAt(cd, md) < 16) warn('marr_date', 'The client would have been under 16 on this date. Check the date.');
    }
    var fromId = util.saIdValid(idno) ? util.dobFromSaId(idno) : null, typed = util.parseDate(v('dob'));
    if (fromId && typed && (fromId.y !== typed.y || fromId.m !== typed.m || fromId.d !== typed.d)) warn('dob', 'Does not match the date of birth in the ID number (' + util.longDate(fromId) + ').');
    var sex = fromId && v('idtype') !== 'Passport' ? util.sexFromSaId(idno) : null;
    if (sex && v('gender') && v('gender') !== sex) warn('gender', 'The ID number is for a ' + sex.toLowerCase() + '. Check the gender or the ID number.');
    if (v('will_date')) {                                                                           // a will was last updated on a date, or only in a year
      var wd = util.parseDate(v('will_date'));
      if (!wd && !/^(?:19|20)\d\d$/.test(v('will_date'))) warn('will_date', 'Date not recognised. Use day/month/year, such as 14/03/2022.');
      else if ((wd ? ymd(wd) > ymd(now) : +v('will_date') > now.y)) warn('will_date', 'This date is after the date of the form.');
    }
    if (v('next_appt')) {
      var na = util.parseDate(v('next_appt'));
      if (!na) warn('next_appt', 'Date not recognised. Use day/month/year, such as 05/11/2026.');
      else if (ymd(na) < ymd(now)) warn('next_appt', 'This date is before the date of the form.');
    }

    ['pemail', 'wemail'].forEach(function (id) { if (v(id) && !EMAIL.test(v(id))) warn(id, 'This does not look like an email address.'); });
    ['cell', 'work', 'home', 'sp_tel'].forEach(function (id) { if (v(id) && !phoneOk(v(id))) warn(id, 'Expected 10 digits, for example 082 555 0148.'); });

    if (v('gross') && v('net') && ctx.n('net') > ctx.n('gross')) warn('net', 'Take-home income is higher than gross income.');

    /* An amount box holds an amount: words are read as nothing, and a negative amount is never right. */
    moneyIds.forEach(function (id) {
      var s = v(id);
      if (!s) return;
      if (!AMOUNT.test(s)) warn(id, 'This is not an amount. Type the digits only, such as 25000.');
      else if (util.num(s) < 0) warn(id, 'An amount cannot be less than nothing.');
    });
    moneyCols.forEach(function (c) {
      ctx.rows(c.list).forEach(function (r, i) {
        var s = String(r.d[c.k] == null ? '' : r.d[c.k]).trim();
        if (!s) return;
        if (!AMOUNT.test(s)) rowWarn(c.list, i, c.l + ': this is not an amount. Type the digits only.');
        else if (util.num(s) < 0) rowWarn(c.list, i, c.l + ': an amount cannot be less than nothing.');
      });
    });

    var anyDuty = false;
    calc.DUTY_IDS.forEach(function (id) {
      if (v(id) !== '') { anyDuty = true; if (ctx.n(id) < 0 || ctx.n(id) > 100) warn(id, 'A percentage must be between 0 and 100.'); }
    });
    if (anyDuty) {
      var t = calc.DUTY_IDS.reduce(function (a, id) { return a + ctx.n(id); }, 0);
      if (Math.abs(t - 100) > 0.001) warn('d_tot', 'The duties split adds to ' + t + '%. It must be 100%.');
    }
    var ip = calc.ipSplit(ctx);                                                                  // the instalments protected for the bank cannot be more than the income protection insured amount
    if (ip.over) warn('ip_hh', 'The debt instalments (' + util.money(ip.total) + ' p.m.) are more than the Insured amount (' + util.money(ip.insured) + ' p.m.) by ' + util.money(ip.total - ip.insured) + '. Household needs cannot be less than nothing: check the instalments on the Debts page.');
    var need = calc.field('need', ctx);                                                          // household income needed (Life and Permanent disability)
    if (/^-/.test(need)) warn('lc_need', 'Total household income needed is ' + need + ': the childcare costs and the debt repayments are more than the take-home income. Check the Children and Debts pages.');
    if (v('biz_pct') !== '' && (ctx.n('biz_pct') < 0 || ctx.n('biz_pct') > 100)) warn('biz_pct', 'A shareholding must be between 0 and 100.');

    /* An ID number can be on the form once. Every box that repeats one says where the other is. */
    var idKey = function (x) { return String(x == null ? '' : x).replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }, owners = [];
    if (idKey(ctx.v('idno')).length >= 6) owners.push({ k: idKey(ctx.v('idno')), who: 'the client', at: { id: 'idno' } });
    if (listShown(ctx, 'shares')) ctx.rows('shares').forEach(function (r, i) { if (idKey(r.d.id).length >= 6) owners.push({ k: idKey(r.d.id), who: 'partner / shareholder ' + (i + 1) + (r.d.name ? ' (' + r.d.name + ')' : ''), at: { list: 'shares', i: i } }); });
    owners.forEach(function (o, n) {
      var first = owners.filter(function (p, m) { return m < n && p.k === o.k; })[0];
      if (!first) return;
      var msg = 'This ID number is already used for ' + first.who + '. An ID number can only be on the Fact Find once.';
      if (o.at.id) warn(o.at.id, msg); else rowWarn(o.at.list, o.at.i, msg);
    });
    ctx.rows('shares').forEach(function (r, i) {
      if (r.d.id && !util.saIdValid(r.d.id)) rowWarn('shares', i, 'ID number looks wrong. Check each digit.');
      if (r.d.cell && !phoneOk(r.d.cell)) rowWarn('shares', i, 'Cell number should have 10 digits.');
    });
    var pctTotal = (listShown(ctx, 'shares') ? ctx.rows('shares').reduce(function (a, r) { return a + util.num(r.d.pct); }, 0) : 0) + ctx.n('biz_pct');
    if (pctTotal > 100.001) warn('biz_pct', 'Your shareholding and the partners\' shareholdings add to ' + pctTotal + '%, which is over 100%.');
    ctx.rows('kids').forEach(function (r, i) {
      if (!r.d.dob) return;
      var kd = util.parseDate(r.d.dob);
      if (!kd) rowWarn('kids', i, 'Date not recognised. Use day/month/year, such as 22/08/2019.');
      else if (ymd(kd) > ymd(now)) rowWarn('kids', i, 'This date is after the date of the form.');
    });

    gateChecks(ctx, warnAnyway);
    quoteChecks(ctx, v, warn, rowWarn);
    priorityChecks(ctx, v, warnAnyway);
    return out;
  }

  /* A Yes/No answer that switches boxes off while what is under it is still filled in: the rows go quiet on screen and drop out of the PDF, the summary and the action points, with nothing to say so. */
  function gateChecks(ctx, warnAnyway) {
    var v = function (id) { var x = ctx.v(id).trim(); return x === 'None' ? '' : x; };
    GATES.forEach(function (g) {
      if (g[1].indexOf(ctx.v(g[0]).trim()) < 0) return;
      var left = [], under = g[2];
      (under.lists || []).forEach(function (k) { var n = ctx.rows(k).filter(filled).length; if (n) left.push(n + (n === 1 ? ' row' : ' rows') + ' in the list'); });
      (under.ids || []).forEach(function (id) { if (v(id)) left.push(schema.fieldsById[id].l); });
      if (left.length) warnAnyway(g[0], schema.fieldsById[g[0]].l + ' is ' + ctx.v(g[0]).trim() + ', but the ' + g[3] + ' are still filled in (' + left.join(', ') + '). Change the answer, or clear them.');
    });
    var loa = ctx.v('loa').trim();                                                                // "Draw from Astute" needs a signed LOA
    if (loa === 'No' || loa === 'Not now') {
      if (SCHEDULE_BOXES.some(function (id) { return /Draw from Astute/.test(ctx.v(id)); })) warnAnyway('loa', 'Draw from Astute is ticked for the policy schedules, but the LOA is ' + loa + '. Ask the client to send the schedules, or change the LOA answer.');
    }
  }

  /* A quote that is asked for needs what it is made from. Each rule points at the box that is missing. */
  function quoteChecks(ctx, v, warn, rowWarn) {
    function asked(id, val) { return shown(ctx, id) && v(id) === (val || REQUEST); }
    function rows(key) { return listShown(ctx, key) ? ctx.rows(key) : []; }
    var noPolicy = !rows('risk').length && !v('ps_risk');                                          // no personal policy recorded, and no schedule asked for
    var bfFna = asked('bf_fna_req'), bfSf = asked('bf_sf_req');
    if ((bfFna || bfSf) && !v('net')) warn('net', 'A BrightRock Fractured ' + (bfFna ? 'FNA' : 'Shortfall') + ' quote is asked for, but the take-home income is empty: the Risk Calculation page stays blank without it.');
    ['fna', 'sf'].forEach(function (k) {
      if (asked(k + '_req') && shown(ctx, k + '_ins') && !v(k + '_ins')) warn(k + '_ins', 'Which insurers should the standard ' + (k === 'fna' ? 'FNA' : 'Shortfall') + ' quote be asked of?');
    });
    [['bf_sf_req', bfSf], ['sf_req', asked('sf_req')]].forEach(function (p) {
      if (p[1] && !rows('grp').length && !v('ps_grp')) warn(p[0], 'A Shortfall quote needs the group risk benefits: record the group policy on the Personal & group risk cover page, or ask for the group policy schedule.');
    });
    [['bf_fna_req', 'bf_fna_type'], ['fna_req', 'fna_type']].forEach(function (p) {
      if (asked(p[0]) && v(p[1]) === 'Servicing' && noPolicy) warn(p[1], 'A Servicing quote is made from the current policy: record it on the Personal & group risk cover page, or ask for the policy schedule.');
    });
    [['bfred', false], ['redq', true]].forEach(function (p) {
      rows(p[0]).forEach(function (r, i) {
        if (r.d.req !== REQUEST) return;
        if (!String(r.d.amt || '').trim()) rowWarn(p[0], i, 'Reduced quote: the monthly amount is missing.');
        if (p[1] && !String(r.d.ins || '').trim()) rowWarn(p[0], i, 'Reduced quote: which insurer should it be asked of?');
        if (r.d.type === 'Servicing' && noPolicy) rowWarn(p[0], i, 'A Servicing quote is made from the current policy: record it, or ask for the policy schedule.');
      });
    });
    rows('raq').forEach(function (r, i) {
      if (r.d.req !== REQUEST) return;
      if (!String(r.d.monthly || '').trim() && !String(r.d.lump || '').trim()) rowWarn('raq', i, 'RA quote: enter a monthly amount or a lump sum.');
      if (!String(r.d.ins || '').trim()) rowWarn('raq', i, 'RA quote: which insurer should it be asked of?');
    });
    rows('invq').forEach(function (r, i) {
      if (!filled(r)) return;                                                                      // any row with something in it counts as a request
      if (!String(r.d.monthly || '').trim() && !String(r.d.lump || '').trim()) rowWarn('invq', i, 'Investment quote: enter a monthly amount or a lump sum.');
      if (!String(r.d.ins || '').trim()) rowWarn('invq', i, 'Investment quote: which insurer should it be asked of?');
    });
    if (asked('rgar_req', 'Request an RGAR')) {
      if (!v('ret_age')) warn('ret_age', 'An RGAR is asked for: the retirement age is needed.');
      if (!v('ret_net')) warn('ret_net', 'An RGAR is asked for: the net income wanted at retirement is needed.');
      if (!ctx.rows('ret_ra').length && !ctx.rows('ret_pp').length) warn('rgar_req', 'An RGAR is asked for, but no retirement annuity, pension or provident fund is recorded on the Retirement funding page.');
    }
    if (asked('egar_req', 'Request an EGAR')) {
      if (!ctx.rows('kids').length) warn('egar_req', 'An EGAR is asked for, but no children are listed on the Children page.');
      else ctx.rows('kids').forEach(function (r, i) { if (!String(r.d.dob || '').trim()) rowWarn('kids', i, 'An EGAR is asked for: this child\'s date of birth is needed.'); });
    }
    if (asked('bs_req') && !ctx.rows('shares').length) warn('bs_req', 'A Buy & Sell quote needs the partners: add them to the Partners and shareholders list on the Occupation page.');
    if (asked('cl_req')) {
      if (!v('cl_lender')) warn('cl_lender', 'A Contingent liability quote is asked for: the lender is needed.');
      if (!v('cl_bal')) warn('cl_bal', 'A Contingent liability quote is asked for: the loan balance is needed.');
    }
    if (asked('km_req')) {
      if (!v('km_name')) warn('km_name', 'A Keyman quote is asked for: the keyman\'s name is needed.');
      if (!v('km_amt')) warn('km_amt', 'A Keyman quote is asked for: the cover amount is needed.');
    }
  }

  /* An area marked as a priority with nothing asked for and nothing written: the personal assistant has nothing to do for it. */
  function priorityChecks(ctx, v, warnAnyway) {
    function asked(id, val) { return shown(ctx, id) && v(id) === (val || REQUEST); }
    function reqRows(key) { return listShown(ctx, key) && ctx.rows(key).some(function (r) { return r.d.req === REQUEST; }); }
    var TODO = {
      life: function () { return ['bf_fna_req', 'bf_sf_req', 'fna_req', 'sf_req'].some(function (id) { return asked(id); }) || reqRows('bfred') || reqRows('redq'); },
      ra: function () { return reqRows('raq'); },
      rgar: function () { return asked('rgar_req', 'Request an RGAR'); },
      inv: function () { return listShown(ctx, 'invq') && ctx.rows('invq').some(filled); },
      egar: function () { return asked('egar_req', 'Request an EGAR'); },
      med: function () { return shown(ctx, 'ref_med') && /^Valerie/.test(v('ref_med')); },
      will: function () { return shown(ctx, 'ref_will') && /^Capital Legacy/.test(v('ref_will')); },
      st: function () { return shown(ctx, 'ref_sti') && /^Cameron/.test(v('ref_sti')); }
    };
    schema.panels.forEach(function (P) {
      if (!P.dec || v(P.dec) !== schema.PRIORITY || v(P.cm) || !TODO[P.id] || TODO[P.id]()) return;
      warnAnyway(P.dec, P.title + ' is a priority, but nothing is asked for and no comment is written. Request a quote, make a referral or write what is to be done.');
    });
  }

  /* If a valid ID number is entered and the date of birth is empty, offer the date from the ID. */
  function dobFromIdSuggestion(ctx) {
    var id = ctx.v('idno').replace(/\s/g, '');
    if (ctx.v('dob').trim() || !util.saIdValid(id)) return null;
    return util.dobFromSaId(id);
  }
  return { check: check, dobFromIdSuggestion: dobFromIdSuggestion, lengthState: lengthState };
});
