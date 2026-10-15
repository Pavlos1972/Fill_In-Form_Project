/* Small shared helpers. Loads in the browser (window.FF.util) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.util = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  /* Parse "32 138,50", "R 32,138.50", "1200000" into a number. Empty or unreadable gives 0. */
  function num(v) {
    if (v == null) return 0;
    var s = String(v).replace(/[R\s ]/gi, '');
    if (/,\d{1,2}$/.test(s) && s.indexOf('.') === -1) s = s.replace(/,(\d{1,2})$/, '.$1');
    s = s.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function money(n) { return 'R ' + group(String(Math.round(n))); }
  function money2(n) {
    var neg = n < 0, s = Math.abs(n).toFixed(2).split('.');
    return (neg ? '-' : '') + 'R ' + group(s[0]) + '.' + s[1];
  }

  /* Parse a date typed in any common form. Returns {y,m,d} or null. */
  function parseDate(v) {
    if (!v) return null;
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(s))) return mk(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s))) return mk(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i.exec(s))) { var mi = month(m[2]); return mi ? mk(+m[3], mi, +m[1]) : null; }
    if ((m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s))) { var mj = month(m[1]); return mj ? mk(+m[3], mj, +m[2]) : null; }
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return mk(+m[1], +m[2], +m[3]);
    return null;
  }
  function month(name) {
    var n = name.toLowerCase();
    if (n.length < 3) return 0;
    for (var i = 0; i < 12; i++) if (MONTHS[i].indexOf(n) === 0) return i + 1;
    return 0;
  }
  function mk(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return { y: y, m: m, d: d };
  }
  function ageAt(dob, asOf) {
    if (!dob || !asOf) return null;
    var a = asOf.y - dob.y;
    if (asOf.m < dob.m || (asOf.m === dob.m && asOf.d < dob.d)) a--;
    return a;
  }
  function isoToday() { var t = new Date(); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function longDate(d) { return d ? d.d + ' ' + MONTHS[d.m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + d.y : ''; }

  /* Date of birth encoded in a South African ID number (YYMMDD...). */
  function dobFromSaId(id) {
    var s = String(id || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(s)) return null;
    var yy = +s.slice(0, 2), t = new Date().getFullYear() % 100;
    return mk(yy > t ? 1900 + yy : 2000 + yy, +s.slice(2, 4), +s.slice(4, 6));
  }
  /* Luhn check used by South African ID numbers. */
  function saIdValid(id) {
    var s = String(id || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(s) || !dobFromSaId(s)) return false;
    var sum = 0, alt = false;
    for (var i = 12; i >= 0; i--) { var n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
    return sum % 10 === 0;
  }
  return { num: num, money: money, money2: money2, parseDate: parseDate, ageAt: ageAt, isoToday: isoToday, longDate: longDate, dobFromSaId: dobFromSaId, saIdValid: saIdValid };
});
