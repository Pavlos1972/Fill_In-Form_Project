/* Checks that catch typing slips and, later, misheard words. They only warn; nothing is blocked. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./calc.js'));
  else { root.FF = root.FF || {}; root.FF.validate = factory(root.FF.util, root.FF.calc); }
})(typeof self !== 'undefined' ? self : this, function (util, calc) {
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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

  /* Returns [{ id, msg }] for a field, or [{ list, i, msg }] for a list row. */
  function check(ctx) {
    var out = [], v = function (id) { var x = ctx.v(id).trim(); return x === 'None' ? '' : x; };
    function warn(id, msg) { out.push({ id: id, msg: msg }); }

    var idno = v('idno').replace(/\s/g, '');
    if (idno && v('idtype') !== 'Passport') {
      if (!/^\d{13}$/.test(idno)) warn('idno', 'A South African ID number has 13 digits.');
      else if (!util.saIdValid(idno)) warn('idno', 'This is not a valid South African ID number. Check each digit.');
    }
    var tax = v('tax').replace(/[\s\-]/g, '');
    if (tax && !/^\d{10}$/.test(tax)) warn('tax', /^\d+$/.test(tax) ? 'A tax number has 10 digits.' : 'A tax number has digits only (10 of them).');
    if (v('dob') && !util.parseDate(v('dob'))) warn('dob', 'Date not recognised. Use day/month/year, such as 14/03/1986.');
    if (/^(Married|Customary marriage|Civil union)/.test(v('marital')) && v('marr_date')) {                                          // the date of marriage only counts for a marriage type
      var md = util.parseDate(v('marr_date')), now = calc.meetingDate(ctx), cd = util.parseDate(v('dob')) || (util.saIdValid(idno) ? util.dobFromSaId(idno) : null);
      if (!md && /^(?:19|20)\d\d$/.test(v('marr_date'))) { if (+v('marr_date') > now.y) warn('marr_date', 'This year is after the date of the form.'); }       // only the year is known: that is enough
      else if (!md) warn('marr_date', 'Date not recognised. Use day/month/year, such as 14/03/2010.');
      else if (md.y * 10000 + md.m * 100 + md.d > now.y * 10000 + now.m * 100 + now.d) warn('marr_date', 'This date is after the date of the form.');
      else if (cd && util.ageAt(cd, md) < 16) warn('marr_date', 'The client would have been under 16 on this date. Check the date.');
    }
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

    /* An ID number can be on the form once. Every box that repeats one says where the other is. */
    var idKey = function (x) { return String(x == null ? '' : x).replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }, owners = [];
    if (idKey(ctx.v('idno')).length >= 6) owners.push({ k: idKey(ctx.v('idno')), who: 'the client', at: { id: 'idno' } });
    ctx.rows('shares').forEach(function (r, i) { if (idKey(r.d.id).length >= 6) owners.push({ k: idKey(r.d.id), who: 'partner / shareholder ' + (i + 1) + (r.d.name ? ' (' + r.d.name + ')' : ''), at: { list: 'shares', i: i } }); });
    owners.forEach(function (o, n) {
      var first = owners.filter(function (p, m) { return m < n && p.k === o.k; })[0];
      if (!first) return;
      var msg = 'This ID number is already used for ' + first.who + '. An ID number can only be on the Fact Find once.';
      if (o.at.id) warn(o.at.id, msg); else out.push({ list: o.at.list, i: o.at.i, msg: msg });
    });
    ctx.rows('shares').forEach(function (r, i) {
      if (r.d.id && !util.saIdValid(r.d.id)) out.push({ list: 'shares', i: i, msg: 'ID number looks wrong. Check each digit.' });
      if (r.d.cell && !phoneOk(r.d.cell)) out.push({ list: 'shares', i: i, msg: 'Cell number should have 10 digits.' });
    });
    var pctTotal = ctx.rows('shares').reduce(function (a, r) { return a + util.num(r.d.pct); }, 0) + ctx.n('biz_pct');
    if (pctTotal > 100.001) warn('biz_pct', 'Your shareholding and the partners\' shareholdings add to ' + pctTotal + '%, which is over 100%.');
    ctx.rows('kids').forEach(function (r, i) { if (r.d.dob && !util.parseDate(r.d.dob)) out.push({ list: 'kids', i: i, msg: 'Date not recognised. Use day/month/year, such as 22/08/2019.' }); });
    return out;
  }

  /* If a valid ID number is entered and the date of birth is empty, offer the date from the ID. */
  function dobFromIdSuggestion(ctx) {
    var id = ctx.v('idno').replace(/\s/g, '');
    if (ctx.v('dob').trim() || !util.saIdValid(id)) return null;
    return util.dobFromSaId(id);
  }
  return { check: check, dobFromIdSuggestion: dobFromIdSuggestion, lengthState: lengthState };
});
