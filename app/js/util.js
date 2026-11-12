/* Small shared helpers. Loads in the browser (window.FF.util) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.util = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  /* Parse "32 138,50", "R 32,138.50", "1200000" into a number. Empty or unreadable gives 0. */
  function num(v) {
    if (v == null) return 0;
    var s = String(v).replace(/[R\s\xa0]/gi, '');
    if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s) || /^-?\d{1,3}(?:\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');        // "1.000,00" and "1.000.000": dots between thousands, a comma for the cents
    if (/,\d{1,2}$/.test(s) && s.indexOf('.') === -1) s = s.replace(/,(\d{1,2})$/, '.$1');
    s = s.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  /* Rand amounts are always shown with a Rand sign and two decimals, e.g. R 80 200.00 */
  function money2(n) {
    var neg = n < 0, s = Math.abs(n).toFixed(2).split('.');
    return (neg ? '-' : '') + 'R ' + group(s[0]) + '.' + s[1];
  }
  var money = money2;
  /* Tidy what was typed in an amount box: "80200" -> "R 80 200.00". Text that is not an amount is left alone. */
  function formatMoney(v) {
    var s = String(v == null ? '' : v).trim();
    if (s === '') return '';
    if (!/^[Rr]?[\s\d.,\-]*\d[\s\d.,]*$/.test(s)) return v;
    return money2(num(s));
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
  /* The form shows every date as day/month/year. */
  function formatDate(d) { return d ? pad(d.d) + '/' + pad(d.m) + '/' + d.y : ''; }
  function todayDMY() { return formatDate(parseDate(isoToday())); }
  /* The day of the week of a date ({ y, m, d }): "Friday". */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function weekdayName(d) { return d ? DAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()] : ''; }
  /* A time of day, typed or said: "14:30", "14h30", "14.30", "1430", "9h", "2pm", "2:30 pm". Gives { h, m } (24-hour) or null. An hour from 1 to 6 with no am or pm and no leading zero is the afternoon
     ("2:30" is 14:30): an appointment is not at half past two in the night. "02:30" is kept as typed. */
  function parseTime(v) {
    var s = String(v == null ? '' : v).toLowerCase().replace(/\u00a0/g, ' ').replace(/^\s*(?:at|@)\s*/, '').replace(/\s*(?:hrs?|hours)\.?\s*$/, '').trim();
    var m = /^(\d{1,2})\s*[:h.]\s*(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/.exec(s) || /^(\d{1,2})\s*h?\s*(a\.?\s?m\.?|p\.?\s?m\.?)$/.exec(s), h, mi, mer;
    if (m) { h = +m[1]; mi = m.length === 4 ? +m[2] : 0; mer = (m.length === 4 ? m[3] : m[2]) || ''; }
    else if ((m = /^(\d{1,2})\s*h$/.exec(s))) { h = +m[1]; mi = 0; mer = ''; }
    else if ((m = /^(\d{2})(\d{2})$/.exec(s))) { h = +m[1]; mi = +m[2]; mer = ''; }
    else return null;
    mer = mer.replace(/[.\s]/g, '');
    if (mi > 59) return null;
    if (mer) { if (h < 1 || h > 12) return null; if (mer === 'pm' && h < 12) h += 12; if (mer === 'am' && h === 12) h = 0; }
    else { if (h > 23) return null; if (h >= 1 && h <= 6 && !/^0/.test(m[1])) h += 12; }
    return { h: h, m: mi };
  }
  /* 24-hour, as the form shows it: 14:30 */
  function formatTime(t) { return t ? pad(t.h) + ':' + pad(t.m) : ''; }
  function longDate(d) { return d ? d.d + ' ' + MONTHS[d.m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + d.y : ''; }

  /* Date of birth encoded in a South African ID number (YYMMDD...). */
  function dobFromSaId(id) {
    var s = String(id || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(s)) return null;
    var yy = +s.slice(0, 2), t = new Date().getFullYear() % 100;
    return mk(yy > t ? 1900 + yy : 2000 + yy, +s.slice(2, 4), +s.slice(4, 6));
  }
  /* Luhn check used by South African ID numbers. */
  /* The four digits after the date of birth in a South African ID number say the sex: 5000 and over is male, below that female. */
  function sexFromSaId(id) {
    var s = String(id || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(s)) return null;
    return +s.slice(6, 10) >= 5000 ? 'Male' : 'Female';
  }
  /* "Anna Maria Kuiper" -> { first: 'Anna Maria', last: 'Kuiper' }; "Jan van der Merwe" -> { first: 'Jan', last: 'van der Merwe' }. A surname given as hint (the father's) is split off when the name ends with it. */
  var NAME_PARTICLES = ['van', 'der', 'den', 'de', 'du', 'le', 'la', 'von', 'bin', 'al', 'da', 'di', 'ten', 'ter', 'te'];
  function splitFullName(full, hint) {
    var w = String(full == null ? '' : full).trim().split(/\s+/).filter(Boolean), h = String(hint == null ? '' : hint).trim().toLowerCase().split(/\s+/).filter(Boolean), i;
    if (w.length < 2) return { first: w[0] || '', last: '' };
    if (h.length && w.length > h.length && w.slice(-h.length).join(' ').toLowerCase() === h.join(' ')) return { first: w.slice(0, w.length - h.length).join(' '), last: w.slice(-h.length).join(' ') };
    i = w.length - 1;
    while (i > 1 && NAME_PARTICLES.indexOf(w[i - 1].toLowerCase()) >= 0) i--;
    return { first: w.slice(0, i).join(' '), last: w.slice(i).join(' ') };
  }
  function saIdValid(id) {
    var s = String(id || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(s) || !dobFromSaId(s)) return false;
    var sum = 0, alt = false;
    for (var i = 12; i >= 0; i--) { var n = +s[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
    return sum % 10 === 0;
  }
  /* ---------- Term left on a debt: always a number of months ----------
     "20 years" is 240, "5 years 6 months" is 66, "18 months" is 18, "two and a half years" is 30, "until my age 65" is the months from the meeting date to the client's 65th birthday (needs the date of birth).
     A bare number is months. "Max term" (the default for a credit card and revolving credit, which have no term) is left as it is.
     raw: what was said or typed. opts: { dob: {y,m,d}, on: {y,m,d} (the meeting date; today when missing) }.
     -> { months: n } | { needs: 'dob', age: n } (an age was given and the date of birth is not on the form yet) | { keep: true } (Max term) | null (not a term: left as typed). */
  var TERM_SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  var TERM_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  /* Number words in a stretch of text become digits: "twenty five years" -> "25 years", "a hundred and twenty months" -> "120 months". */
  function termDigits(t) {
    var tk = t.split(/\s+/), out = [], i = 0;
    var isW = function (w) { return TERM_SMALL.hasOwnProperty(w) || TERM_TENS.hasOwnProperty(w) || w === 'hundred'; };
    while (i < tk.length) {
      if (isW(tk[i]) || (tk[i] === 'a' && tk[i + 1] === 'hundred')) {
        var cur = 0, any = false;
        while (i < tk.length) {
          var w = tk[i];
          if (TERM_SMALL.hasOwnProperty(w)) { cur += TERM_SMALL[w]; any = true; }
          else if (TERM_TENS.hasOwnProperty(w)) { cur += TERM_TENS[w]; any = true; }
          else if (w === 'hundred') { cur = (cur || 1) * 100; any = true; }
          else if (w === 'a' && tk[i + 1] === 'hundred') { /* "a hundred" */ }
          else if (w === 'and' && any && isW(tk[i + 1] || '') && /hundred/.test(tk[i - 1] || '')) { /* "a hundred and twenty" */ }
          else break;
          i++;
        }
        out.push(String(cur));
      } else { out.push(tk[i]); i++; }
    }
    return out.join(' ');
  }
  function monthsBetween(a, b) { return (b.y - a.y) * 12 + (b.m - a.m) + (b.d - a.d) / 30.4375; }
  function termMonths(raw, opts) {
    var t = String(raw == null ? '' : raw).toLowerCase().replace(/[‘’`]/g, "'").replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim(), m;
    if (!t) return null;
    if (/^max(?:imum)?\s+term$/.test(t)) return { keep: true };
    if (/^\d+(?:\.\d+)?$/.test(t)) return { months: Math.round(parseFloat(t)) };                          // typed digits alone: months
    t = t.replace(/\ba year and a half\b/g, '1.5 years').replace(/\bhalf a year\b/g, '0.5 years').replace(/\ba year\b/g, '1 year').replace(/\ba month\b/g, '1 month');
    t = termDigits(t).replace(/(\d+(?:\.\d+)?) and a half\b/g, function (x, n) { return (parseFloat(n) + 0.5) + ''; });
    var re = /(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mths?)\b/g, total = 0, found = false;
    while ((m = re.exec(t))) { total += parseFloat(m[1]) * (/^y/.test(m[2]) ? 12 : 1); found = true; }
    if (found) { var mo = Math.round(total); return mo >= 0 && mo <= 1200 ? { months: mo } : null; }
    var age = /\b(?:until|till|til|up until|up to|to|by)\b([^0-9]{0,30}?)\b(\d{2,3})(?:st|nd|rd|th)?\b/.exec(t);
    if (age && +age[2] >= 18 && +age[2] <= 100 && !/\b(?:year|month|years|months)\b/.test(age[1])) {
      var a = +age[2], dob = opts && opts.dob;
      if (!dob) return { needs: 'dob', age: a };
      var on = (opts && opts.on) || parseDate(isoToday()), mo2 = Math.round(monthsBetween(on, { y: dob.y + a, m: dob.m, d: dob.d }));
      return mo2 >= 0 && mo2 <= 1200 ? { months: mo2 } : null;
    }
    return null;
  }
  /* A heading line in a box of notes written by a skill (Current Client File Summary Notes): no lower-case letters, at least four characters, and not a point ("- ..."). The text itself stays plain;
     the screen's read view and the PDF show such a line in bold. */
  function isHeadingLine(line) {
    var s = String(line == null ? '' : line).trim();
    return s.length >= 4 && s === s.toUpperCase() && s.indexOf('- ') !== 0;
  }
  return { isHeadingLine: isHeadingLine, sexFromSaId: sexFromSaId, splitFullName: splitFullName, num: num, money: money, money2: money2, formatMoney: formatMoney, parseDate: parseDate, weekdayName: weekdayName, parseTime: parseTime, formatTime: formatTime, ageAt: ageAt, isoToday: isoToday, termMonths: termMonths, formatDate: formatDate, todayDMY: todayDMY, longDate: longDate, dobFromSaId: dobFromSaId, saIdValid: saIdValid };
});
