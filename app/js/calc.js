/* Calculations and show/hide rules. Everything works from a "ctx" object:
   ctx.v(id) text of a field, ctx.n(id) number of a field, ctx.rows(key) rows of a list, each { d: {...} }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./tax.js'));
  else { root.FF = root.FF || {}; root.FF.calc = factory(root.FF.util, root.FF.tax); }
})(typeof self !== 'undefined' ? self : this, function (util, tax) {
  var DUTY_IDS = ['d_desk', 'd_supo', 'd_trav', 'd_sups', 'd_light', 'd_mod', 'd_heavy'];

  function meetingDate(ctx) { return util.parseDate(ctx.v('date')) || util.parseDate(util.isoToday()); }
  /* Age from the typed date of birth, else from a South African ID number. */
  function clientDob(ctx) { return util.parseDate(ctx.v('dob')) || (ctx.v('idtype') === 'Passport' ? null : util.dobFromSaId(ctx.v('idno'))); }
  function clientAge(ctx) { var dob = clientDob(ctx); return dob ? util.ageAt(dob, meetingDate(ctx)) : null; }
  /* SARS gives the age rebates (65, 75) by the age on the last day of the tax year (the end of February), not on the day of the meeting. */
  function taxAge(ctx) {
    var dob = clientDob(ctx); if (!dob) return null;
    return util.ageAt(dob, { y: +tax.taxYearFor(meetingDate(ctx)).slice(0, 4) + 1, m: 2, d: 28 });
  }
  /* Words in an amount box (about twenty five thousand) cannot be added up: a figure that depends on one stays blank instead of counting it as R 0. */
  function amountsOk(ctx, ids) { return ids.every(function (id) { return util.isAmount(ctx.v(id)); }); }
  /* A column that only some rows show (Spouse instalment: when the Payer is Joint or Spouse): c.rowCond { k, in }. */
  function colShown(c, r) { if (!c.rowCond) return true; var d = r.d || r; return c.rowCond.in.indexOf(String(d[c.rowCond.k] || '')) >= 0; }
  /* A total of a column only some rows show (Total spouse monthly) is shown only when a row shows that column. */
  function sumShown(L, k, rows) { var c = L.cols.filter(function (x) { return x.k === k; })[0]; return !c || !c.rowCond || rows.some(function (r) { return colShown(c, r); }); }
  function sumRows(ctx, key, col) { return ctx.rows(key).reduce(function (a, r) { return a + util.num(r.d[col]); }, 0); }

  /* A debt comes off the client's take-home income when the client pays it: the Payer is Client, or not set yet. Debts paid by the spouse, jointly, by the business or by an ex-spouse or partner are somebody
     else's repayments: they are left out of the household needs and of the instalment protector. */
  function paidByClient(r) { var p = String(r.d.payer || '').trim(); return p === '' || p === 'Client' || p === 'Joint'; }      // a Joint debt: the Instalment box holds the client's own half (the spouse's half is in Spouse instalment)
  function debtSum(ctx, others) { return ctx.rows('debts').reduce(function (a, r) { return a + (paidByClient(r) !== !!others ? util.num(r.d.inst) : 0); }, 0); }
  /* The income protection insured amount split for the quote: the take-home income (Insured amount), the debts the client is paying off (one line each, from the Debts page: what each instalment is) that get an
     instalment protector ceded to the bank, and what is left for the household. Each debt can be switched off (row.off on the debt, see store.setProtect): it is then not protected and not in the total.
     -> { insured (null until the take-home income is known), rows: [{ i (the debt's place in the Debts list), label, prov, inst, on }], total (of the debts switched on), all (of every debt the client pays), on (how many are on), count, rest, over,
        elsewhere (how many debts with an instalment are paid by someone else: left out), elsewhereTotal }. */
  var IP_NAMES = { 'Home loan': 'Bond repayments', 'Vehicle finance': 'Car', 'Credit card': 'Credit card', 'Personal loan': 'Personal loan', 'Revolving credit': 'Revolving credit' };
  function ipSplit(ctx) {
    var insured = ctx.v('net') ? ctx.n('net') : null, rows = [], total = 0, all = 0, on = 0, elsewhere = 0, elsewhereTotal = 0;
    ctx.rows('debts').forEach(function (r, i) {
      var inst = util.num(String(r.d.payer || '') === 'Spouse' ? r.d.sinst : r.d.inst); if (!(inst > 0)) return;          // a spouse's debt carries the instalment in Spouse instalment
      if (!paidByClient(r)) { elsewhere++; elsewhereTotal += inst; return; }
      var prot = r.off !== true;
      rows.push({ i: i, label: IP_NAMES[r.d.type] || (r.d.type === 'Other' && r.d.desc) || r.d.desc || (r.d.type === 'Other' ? 'Other debt' : r.d.type) || 'Debt', prov: r.d.prov || '', inst: inst, on: prot });
      all += inst; if (prot) { total += inst; on++; }
    });
    return { insured: insured, rows: rows, total: total, all: all, on: on, count: rows.length, rest: insured == null ? null : insured - total, over: insured != null && total > insured + 0.004, elsewhere: elsewhere, elsewhereTotal: elsewhereTotal };
  }

  var OTHER_INCOME = ['rent', 'spmaint', 'spinc', 'maint'];                                          // spinc is the earlier Spousal Income box, still added up when an old file holds an answer
  function totalIncome(ctx) {
    var any = !!ctx.v('net'), t = ctx.v('net') ? ctx.n('net') : 0;
    OTHER_INCOME.forEach(function (k) { if (ctx.v(k)) { any = true; t += ctx.n(k); } });
    return any ? t : null;
  }

  var fieldCalcs = {
    /* The day of the week of the next appointment's date: Friday. */
    weekday: function (ctx) { var d = util.parseDate(ctx.v('next_appt')); return d ? util.weekdayName(d) : ''; },
    /* The client's age on the date of the form (Date completed), from the date of birth. */
    age: function (ctx) {
      var a = clientAge(ctx);
      return a == null || a < 0 || a > 130 ? '' : a + (a === 1 ? ' year' : ' years');
    },
    /* Gross less PAYE and UIF: the figure TaxTim shows as "Take-home pay". */
    dnet: function (ctx) {
      var g = ctx.n('gross');
      if (!g) return '';
      var r = tax.monthlyNet(g, taxAge(ctx), tax.taxYearFor(meetingDate(ctx)));
      return util.money2(r.net);
    },
    /* Total Income: the take-home net income plus the rental income, spousal maintenance and child maintenance (and the earlier Spousal Income box, when an old file holds an answer) (a box left empty counts as nothing). Blank until there is something to add up. */
    tinc: function (ctx) { return totalIncome(ctx) == null || !amountsOk(ctx, ['net'].concat(OTHER_INCOME)) ? '' : util.money(totalIncome(ctx)); },
    /* Disposable income: Total Income less the monthly expenses. The BrightRock Insured amount is not touched by this: it stays the take-home net income alone. */
    disp: function (ctx) { var t = totalIncome(ctx); return t != null && ctx.v('exp') && amountsOk(ctx, ['net', 'exp'].concat(OTHER_INCOME)) ? util.money(t - ctx.n('exp')) : ''; },
    d_tot: function (ctx) {
      var any = false, t = 0;
      DUTY_IDS.forEach(function (k) { if (ctx.v(k) !== '') { any = true; t += ctx.n(k); } });
      return any ? t + '%' : '';
    },
    /* Household net income for the risk calculation is the client's own take-home income. */
    hh: function (ctx) { return ctx.v('net') ? util.money(ctx.n('net')) : ''; },
    /* The income protection insured amount is always the take-home net income (Income & household), worked out and never typed. */
    ip_amt: function (ctx) { return ctx.v('net') ? util.money(ctx.n('net')) : ''; },
    /* Household needs: the insured amount less the debt instalments that are protected for the bank (negative when the instalments are more, which the checks flag). */
    ip_hh: function (ctx) { var sp = ipSplit(ctx); return sp.rest == null ? '' : util.money(sp.rest); },
    cc: function (ctx) { return ctx.rows('kids').length ? util.money(sumRows(ctx, 'kids', 'cost')) : ''; },
    dr: function (ctx) { return ctx.rows('debts').length ? util.money(debtSum(ctx)) : ''; },
    need: function (ctx) { return ctx.v('net') ? util.money(ctx.n('net') - sumRows(ctx, 'kids', 'cost') - debtSum(ctx)) : ''; }
  };

  var rowCalcs = {
    /* A child's age on the date of the form (Date completed), from the date of birth: whole years, or months under a year. */
    age: function (row, ctx) {
      var dob = util.parseDate(row.d.dob), at = meetingDate(ctx);
      if (!dob || !at) return '';
      var y = util.ageAt(dob, at);
      if (y == null || y < 0 || y > 130) return '';
      if (y >= 1) return y + (y === 1 ? ' year' : ' years');
      var m = (at.y - dob.y) * 12 + (at.m - dob.m) - (at.d < dob.d ? 1 : 0);
      return m + (m === 1 ? ' month' : ' months');
    },
    stage: function (row, ctx) {
      var dob = util.parseDate(row.d.dob);
      if (!dob) return '';
      var age = util.ageAt(dob, meetingDate(ctx));
      if (age == null || age < 0 || age > 130) return '';                                         // a birth date still to come (a typo) is no stage
      return age < 3 ? 'Not Yet in School' : age < 6 ? 'Pre-school' : age < 13 ? 'Primary' : age < 19 ? 'High School' : 'Tertiary';      // spelled as the choices in the dropdown, or the box stays blank
    }
  };

  function field(name, ctx) { return fieldCalcs[name](ctx); }
  function rowCalc(name, row, ctx) { return rowCalcs[name](row, ctx); }

  /* cond: { f, eq } | { f, in } | { f, nin } | { f, has } (a tick-box box holds that choice) | { rows: list } (the list has a row) | { all: [cond, ...] } */
  function showIf(cond, ctx) {
    if (!cond) return true;
    if (cond.all) return cond.all.every(function (c) { return showIf(c, ctx); });
    if ('rows' in cond) return ctx.rows(cond.rows).length > 0;                                          // a list has at least one row
    var v = ctx.v(cond.f);
    if ('has' in cond) return v.split(';').map(function (x) { return x.trim(); }).indexOf(cond.has) >= 0;     // a tick-box box holds this choice
    if ('eq' in cond) return v === cond.eq;
    if ('in' in cond) return cond.in.indexOf(v) !== -1;
    if ('nin' in cond) return cond.nin.indexOf(v) === -1;
    return true;
  }
  function condFields(cond) {
    if (!cond) return [];
    if (cond.all) return cond.all.reduce(function (a, c) { return a.concat(condFields(c)); }, []);
    return cond.f ? [cond.f] : [];
  }

  return { sumShown: sumShown, colShown: colShown, paidByClient: paidByClient, ipSplit: ipSplit, field: field, rowCalc: rowCalc, showIf: showIf, condFields: condFields, clientAge: clientAge, meetingDate: meetingDate, DUTY_IDS: DUTY_IDS, totalIncome: totalIncome };
});
