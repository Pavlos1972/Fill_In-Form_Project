/* Checks that catch typing slips and, later, misheard words. They only warn; nothing is blocked. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./calc.js'));
  else { root.FF = root.FF || {}; root.FF.validate = factory(root.FF.util, root.FF.calc); }
})(typeof self !== 'undefined' ? self : this, function (util, calc) {
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function phoneOk(v) { var d = String(v).replace(/[\s()\-]/g, ''); return /^0\d{9}$/.test(d) || /^\+?27\d{9}$/.test(d); }

  /* Returns [{ id, msg }] for a field, or [{ list, i, msg }] for a list row. */
  function check(ctx) {
    var out = [], v = function (id) { return ctx.v(id).trim(); };
    function warn(id, msg) { out.push({ id: id, msg: msg }); }

    var idno = v('idno').replace(/\s/g, '');
    if (idno && v('idtype') !== 'Passport') {
      if (!/^\d{13}$/.test(idno)) warn('idno', 'A South African ID number has 13 digits.');
      else if (!util.saIdValid(idno)) warn('idno', 'This is not a valid South African ID number. Check each digit.');
    }
    if (v('dob') && !util.parseDate(v('dob'))) warn('dob', 'Date not recognised. Use a form such as 1986-03-14.');
    var fromId = util.saIdValid(idno) ? util.dobFromSaId(idno) : null, typed = util.parseDate(v('dob'));
    if (fromId && typed && (fromId.y !== typed.y || fromId.m !== typed.m || fromId.d !== typed.d)) warn('dob', 'Does not match the date of birth in the ID number (' + util.longDate(fromId) + ').');

    ['pemail', 'wemail'].forEach(function (id) { if (v(id) && !EMAIL.test(v(id))) warn(id, 'This does not look like an email address.'); });
    ['cell', 'work', 'sp_tel'].forEach(function (id) { if (v(id) && !phoneOk(v(id))) warn(id, 'Expected 10 digits, for example 082 555 0148.'); });

    if (v('gross') && v('net') && ctx.n('net') > ctx.n('gross')) warn('net', 'Take-home income is higher than gross income.');

    var anyDuty = false;
    calc.DUTY_IDS.forEach(function (id) {
      if (v(id) !== '') { anyDuty = true; if (ctx.n(id) < 0 || ctx.n(id) > 100) warn(id, 'A percentage must be between 0 and 100.'); }
    });
    if (anyDuty) {
      var t = calc.DUTY_IDS.reduce(function (a, id) { return a + ctx.n(id); }, 0);
      if (Math.abs(t - 100) > 0.001) warn('d_tot', 'The duties split adds to ' + t + '%. It must be 100%.');
    }
    if (v('biz_pct') !== '' && (ctx.n('biz_pct') < 0 || ctx.n('biz_pct') > 100)) warn('biz_pct', 'A shareholding must be between 0 and 100.');

    ctx.rows('shares').forEach(function (r, i) {
      if (r.d.id && !util.saIdValid(r.d.id)) out.push({ list: 'shares', i: i, msg: 'ID number looks wrong. Check each digit.' });
      if (r.d.cell && !phoneOk(r.d.cell)) out.push({ list: 'shares', i: i, msg: 'Cell number should have 10 digits.' });
    });
    var pctTotal = ctx.rows('shares').reduce(function (a, r) { return a + util.num(r.d.pct); }, 0) + ctx.n('biz_pct');
    if (pctTotal > 100.001) warn('biz_pct', 'Your shareholding and the partners\' shareholdings add to ' + pctTotal + '%, which is over 100%.');
    ctx.rows('kids').forEach(function (r, i) { if (r.d.dob && !util.parseDate(r.d.dob)) out.push({ list: 'kids', i: i, msg: 'Date not recognised. Use a form such as 2015-03-10.' }); });
    return out;
  }

  /* If a valid ID number is entered and the date of birth is empty, offer the date from the ID. */
  function dobFromIdSuggestion(ctx) {
    var id = ctx.v('idno').replace(/\s/g, '');
    if (ctx.v('dob').trim() || !util.saIdValid(id)) return null;
    return util.dobFromSaId(id);
  }
  return { check: check, dobFromIdSuggestion: dobFromIdSuggestion };
});
