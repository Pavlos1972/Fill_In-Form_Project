/* The Checks panel of the Short Risk Application: what is still to answer, and what looks wrong. Nothing here stops a save; it tells the adviser before the application goes to the insurer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./sr-schema.js'), require('./sr-store.js'));
  else { root.SR = root.SR || {}; root.SR.check = factory(root.FF.util, root.SR.schema, root.SR.store); }
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

    if (v('idno') && !util.saIdValid(v('idno'))) warn('The client’s ID number is not a valid South African ID number. Check each digit.', { f: 'idno' });
    ['cell', 'work', 'dr_tel', 'bank_contact'].forEach(function (id) {
      if (v(id) && !phoneOk(v(id))) warn(schema.fieldsById[id].l + ': ' + v(id) + ' does not look like a phone number (10 digits, starting 0).', { f: id });
    });
    ['email', 'bank_email'].forEach(function (id) { if (v(id) && !emailOk(v(id))) warn(schema.fieldsById[id].l + ' does not look like an e-mail address.', { f: id }); });
    if (v('postal') && digits(v('postal')).length !== 4) warn('The postal code is four digits.', { f: 'postal' });
    if (v('branch_code') && digits(v('branch_code')).length !== 6) warn('A branch code is six digits.', { f: 'branch_code' });
    if (v('acc_no') && (!/^[\d\s-]+$/.test(v('acc_no')) || digits(v('acc_no')).length < 6 || digits(v('acc_no')).length > 16)) warn('The account number should be 6 to 16 digits.', { f: 'acc_no' });
    if (v('debit_date')) {
      var dd = debitDay(v('debit_date'));
      if (!(dd >= 1 && dd <= 31)) bad('The debit date must be a day of the month, 1 to 31.', { f: 'debit_date' });
      else if (dd >= 10 && dd <= 14) bad('The debit date cannot be the 10th to the 14th. Choose another day.', { f: 'debit_date' });
    }
    if (v('premium') && !(util.num(v('premium')) > 0)) bad('The monthly premium must be more than R 0.00.', { f: 'premium' });
    if (v('date') && !util.parseDate(v('date'))) bad('The application date is not a date (day/month/year).', { f: 'date' });
    if (v('product') && v('lines') && schema.linesOf[v('product')] && schema.linesOf[v('product')] !== v('lines')) warn('Cover lines is ' + v('lines') + ', but ' + v('product') + ' is normally ' + schema.linesOf[v('product')] + '.', { f: 'lines' });
    if (v('ownerpays') === 'No') warn('The policy owner is not paying: the banking details must be those of the person who pays the premium.', { f: 'ownerpays' });
    if (v('insolvent') === 'Yes' || v('debt_review') === 'Yes' || v('debt_help') === 'Yes') warn('An insolvency or debt answer is Yes. The insurer will ask for the details; write them in the client’s notes.', { f: v('insolvent') === 'Yes' ? 'insolvent' : v('debt_review') === 'Yes' ? 'debt_review' : 'debt_help' });

    ['kids', 'benef'].forEach(function (k) {
      var L = schema.lists[k];
      state.l[k].forEach(function (r, i) {
        var n = i + 1;
        if (!String(r.d.name || '').trim()) warn(L.one + ' ' + n + ' has no name.', { l: k, i: i });
        if (r.d.id && !util.saIdValid(r.d.id)) warn(L.one + ' ' + n + ': the ID number is not a valid South African ID number.', { l: k, i: i });
      });
    });
    if (state.l.benef.length) {
      var total = state.l.benef.reduce(function (a, r) { return a + store.pctNum(r.d.pct); }, 0), blanks = state.l.benef.some(function (r) { return String(r.d.pct || '').trim() === ''; });
      if (blanks) warn('Every beneficiary needs a % of the benefit.', { l: 'benef', i: 0 });
      else if (Math.abs(total - 100) > 0.001) bad('The beneficiaries’ shares add up to ' + (Math.round(total * 100) / 100) + '%, not 100%.', { l: 'benef', i: 0 });
    }
    return { missing: missing, problems: problems };
  }

  return { run: run, phoneOk: phoneOk, emailOk: emailOk, debitDay: debitDay };
});
