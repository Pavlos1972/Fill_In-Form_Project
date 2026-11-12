/* The Checks panel of the Investment Capture Sheet: what is still to answer, and what looks wrong. Nothing here stops a save; it tells the adviser before the application goes to the insurer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./cs-schema.js'), require('./cs-store.js'));
  else { root.CS = root.CS || {}; root.CS.check = factory(root.FF.util, root.CS.schema, root.CS.store); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, store) {
  var digits = function (s) { return String(s || '').replace(/\D/g, ''); };

  /* A South African phone number: ten digits starting 0, or +27 / 27 and nine digits. */
  function phoneOk(v) {
    var d = digits(v), plus = /^\s*\+/.test(String(v));
    if (d.length === 10 && d[0] === '0') return true;
    if (d.length === 11 && d.slice(0, 2) === '27') return true;
    return plus && d.length >= 10 && d.length <= 15;
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); }

  /* The debit day: 1 to 31, and not the 10th to the 14th (the insurers' debit run). Accepts "25", "25th" or a whole date. */
  function debitDay(v) {
    var s = String(v == null ? '' : v).trim(), m, d;
    if (!s) return null;
    if ((d = util.parseDate(s))) return d.d;
    m = /^(\d{1,2})\s*(?:st|nd|rd|th)?(?:\s+of\s+(?:the\s+)?month)?$/i.exec(s);
    return m ? +m[1] : NaN;
  }

  /* run(state) gives { missing: [{ id, l, section }], problems: [{ level: 'bad'|'warn', text, f | l, i }] }. */
  function run(state) {
    var v = function (id) { return String(state.f[id].v || '').trim(); }, missing = [], problems = [];
    function bad(text, where) { problems.push(Object.assign({ level: 'bad', text: text }, where)); }
    function warn(text, where) { problems.push(Object.assign({ level: 'warn', text: text }, where)); }

    schema.fieldIds.forEach(function (id) {
      var f = schema.fieldsById[id];
      if (store.shown(state, id) && !f.opt && v(id) === '') missing.push({ id: id, l: f.l, section: schema.sectionOf[id] });
    });

    if (v('idno') && !util.saIdValid(v('idno'))) warn('The client\u2019s ID number is not a valid South African ID number. Check each digit.', { f: 'idno' });
    ['cell', 'tel_h', 'tel_w'].forEach(function (id) {
      if (store.shown(state, id) && v(id) && !phoneOk(v(id))) warn(schema.fieldsById[id].l + ': ' + v(id) + ' does not look like a phone number (10 digits, starting 0).', { f: id });
    });
    if (v('email') && !emailOk(v('email'))) warn(schema.fieldsById.email.l + ' does not look like an e-mail address.', { f: 'email' });
    ['postal_code', 'residential_code'].forEach(function (id) { if (v(id) && digits(v(id)).length !== 4) warn(schema.fieldsById[id].l + ' is four digits.', { f: id }); });
    if (v('branch_code') && digits(v('branch_code')).length !== 6) warn('A branch code is six digits.', { f: 'branch_code' });
    if (v('acc_no') && (!/^[\d\s-]+$/.test(v('acc_no')) || digits(v('acc_no')).length < 6 || digits(v('acc_no')).length > 16)) warn('The account number should be 6 to 16 digits.', { f: 'acc_no' });
    if (v('amount') && !(util.num(v('amount')) > 0)) bad('The contribution or lump sum must be more than R 0.00.', { f: 'amount' });
    ['date', 'start_date', 'marital_date'].forEach(function (id) { if (store.shown(state, id) && v(id) && !util.parseDate(v(id))) bad(schema.fieldsById[id].l + ' is not a date (day/month/year).', { f: id }); });

    ['benef'].forEach(function (k) {
      var L = schema.lists[k];
      state.l[k].forEach(function (r, i) {
        var n = i + 1;
        if (!String(r.d.name || '').trim()) warn(L.one + ' ' + n + ' has no name.', { l: k, i: i });
        if (r.d.id && !util.saIdValid(r.d.id)) warn(L.one + ' ' + n + ': the ID number is not a valid South African ID number.', { l: k, i: i });
        if (r.d.cell && !phoneOk(r.d.cell)) warn(L.one + ' ' + n + ': the cell number does not look like a phone number.', { l: k, i: i });
      });
    });
    if (state.l.benef.length) {
      var total = state.l.benef.reduce(function (a, r) { return a + store.pctNum(r.d.pct); }, 0), blanks = state.l.benef.some(function (r) { return String(r.d.pct || '').trim() === ''; });
      if (blanks) warn('Every beneficiary needs a % of the benefit.', { l: 'benef', i: 0 });
      else if (Math.abs(total - 100) > 0.001) bad('The beneficiaries\u2019 shares add up to ' + (Math.round(total * 100) / 100) + '%, not 100%.', { l: 'benef', i: 0 });
    }
    return { missing: missing, problems: problems };
  }

  return { run: run, phoneOk: phoneOk, emailOk: emailOk, debitDay: debitDay };
});
