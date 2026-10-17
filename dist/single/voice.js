/* Voice mode: turns what is said (by you or by the client) into actions on the Fact Find.
   Pure logic only. No microphone and no network. Whatever listens (typed practice lines now, Whisper or Deepgram later)
   just calls FF.app.voiceHear(text, who), where who is 'me' (the advisor) or 'client'.
   Everything here runs on this computer, so nothing leaves it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'));
  else { root.FF = root.FF || {}; root.FF.voice = factory(root.FF.util); }
})(typeof self !== 'undefined' ? self : this, function (util) {

  /* ---------- plain text helpers ---------- */
  var CONTRACT = { let: 'lets', what: 'what', who: 'who', that: 'that', it: 'it', there: 'there', here: 'here', he: 'he', she: 'she', where: 'where', how: 'how' };
  /* Lower case, punctuation gone, possessives dropped, "&" read as "and". Used for matching only, never for stored values. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[‘’`]/g, "'")
      .replace(/\b([a-z]+)'s\b/g, function (m, w) { return CONTRACT[w] || w; })
      .replace(/[^a-z0-9'@%\/.\s]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/(^|\s)\.+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toks(s) { var n = norm(s); return n ? n.split(' ') : []; }
  function has(textNorm, phraseNorm) { return (' ' + textNorm + ' ').indexOf(' ' + phraseNorm + ' ') >= 0; }
  var STOP = {};
  ('a an the do does did you your yours have has had any is are was were what which how much many long can could i me my to of and or for with on in at it its that this please so now okay ok right then tell us about there be been would like just kindly may ask want need know give we our they them he she his her am will shall if when where who whom whose than too very also').split(' ').forEach(function (w) { STOP[w] = 1; });
  function content(s) { return toks(s).filter(function (w) { return !STOP[w]; }); }

  var SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  var TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

  /* "eighty five thousand two hundred", "R85 000", "85k", "1.5 million" -> number, or null. */
  function wordsToNumber(text) {
    var t = norm(text).replace(/\br\s*(?=\d)/g, '').replace(/\b(\d{1,3})((?: \d{3})+)\b/g, function (m, a, rest) { return a + rest.replace(/ /g, ''); });
    var tk = t.split(' '), total = 0, cur = 0, found = false, i, w, m;
    for (i = 0; i < tk.length; i++) {
      w = tk[i];
      if ((m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(w))) {
        var v = parseFloat(m[1]); if (m[2] === 'k') v *= 1000; if (m[2] === 'm') v *= 1e6;
        cur += v; found = true;
      } else if (SMALL.hasOwnProperty(w)) { cur += SMALL[w]; found = true; }
      else if (TENS.hasOwnProperty(w)) { cur += TENS[w]; found = true; }
      else if (w === 'hundred') { cur = (cur || 1) * 100; found = true; }
      else if (w === 'thousand' || w === 'k') { total += (cur || 1) * 1000; cur = 0; found = true; }
      else if (w === 'million' || w === 'm') { total += (cur || 1) * 1e6; cur = 0; found = true; }
      else if (w === 'point' && found) {
        var frac = '', j = i + 1;
        while (j < tk.length && SMALL.hasOwnProperty(tk[j]) && SMALL[tk[j]] < 10) { frac += SMALL[tk[j]]; j++; }
        if (frac) { cur += parseFloat('0.' + frac); i = j - 1; } else break;
      } else if ((w === 'and' || w === 'a') && (found || tk[i + 1] === 'hundred' || tk[i + 1] === 'thousand' || tk[i + 1] === 'million')) {
        if (w === 'a' && !found) { /* "a hundred" */ }
        continue;
      } else if (found) break;
    }
    return found ? total + cur : null;
  }

  /* "zero eight two five five five oh one four eight", "double five" -> "0825555014 8" digits only. */
  function spokenDigits(text) {
    var tk = norm(text).split(' '), out = '', i, w;
    for (i = 0; i < tk.length; i++) {
      w = tk[i];
      if (/^\d+$/.test(w)) out += w;
      else if (w === 'oh' || w === 'zero') out += '0';
      else if (SMALL.hasOwnProperty(w) && SMALL[w] < 10) out += SMALL[w];
      else if ((w === 'double' || w === 'triple') && i + 1 < tk.length) {
        var nx = tk[i + 1], d = /^\d$/.test(nx) ? nx : (SMALL.hasOwnProperty(nx) && SMALL[nx] < 10 ? String(SMALL[nx]) : nx === 'oh' ? '0' : '');
        out += new Array((w === 'double' ? 2 : 3) + 1).join(d); i++;
      }
    }
    return out;
  }
  function formatPhone(d) {
    if (/^27\d{9}$/.test(d)) return '+27 ' + d.slice(2, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
    if (/^0\d{9}$/.test(d)) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    return d;
  }

  var ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function monthOf(w) {
    if (!w || w.length < 3) return 0;
    if (w === 'sept') return 9;
    for (var i = 0; i < 12; i++) if (MONTHS[i] === w || (w.length === 3 && MONTHS[i].indexOf(w) === 0)) return i + 1;
    return 0;
  }
  function dayWord(w) {
    var m = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(w);
    if (m) { var n = +m[1]; return n >= 1 && n <= 31 ? n : null; }
    if (ORD.hasOwnProperty(w)) return ORD[w];
    if (SMALL.hasOwnProperty(w) && SMALL[w] >= 1) return SMALL[w];
    return null;
  }
  /* "fourteenth of March nineteen eighty six", "14 March 1986", "14/03/1986" -> "1986-03-14", or null. */
  function spokenDate(raw) {
    var p = util.parseDate(String(raw).trim().replace(/[.,]$/, ''));
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    if (p) return p.y + '-' + pad(p.m) + '-' + pad(p.d);
    var tk = norm(raw).split(' ').filter(function (w) { return w !== 'the' && w !== 'of' && w !== 'on'; }), mi = -1, i;
    for (i = 0; i < tk.length; i++) if (monthOf(tk[i])) { mi = i; break; }
    if (mi < 0) return null;
    var month = monthOf(tk[mi]), day = null, rest = [];
    var before = tk.slice(0, mi), after = tk.slice(mi + 1);
    if (before.length) {
      /* day words come before the month: "twenty third of march ..." */
      var dtxt = before.join(' ');
      day = before.length >= 2 && ORD.hasOwnProperty(before[before.length - 1]) && TENS.hasOwnProperty(before[before.length - 2]) ? TENS[before[before.length - 2]] + ORD[before[before.length - 1]] : dayWord(before[before.length - 1]);
      if (day == null) { var wn = wordsToNumber(dtxt); day = wn >= 1 && wn <= 31 ? wn : null; }
      rest = after;
    } else {
      /* month first: "March fourteenth ..." */
      if (after.length >= 2 && TENS.hasOwnProperty(after[0]) && ORD.hasOwnProperty(after[1])) { day = TENS[after[0]] + ORD[after[1]]; rest = after.slice(2); }
      else if (after.length >= 2 && TENS.hasOwnProperty(after[0]) && SMALL.hasOwnProperty(after[1]) && SMALL[after[1]] < 10 && TENS[after[0]] + SMALL[after[1]] <= 31) { day = TENS[after[0]] + SMALL[after[1]]; rest = after.slice(2); }
      else { day = after.length ? dayWord(after[0]) : null; rest = after.slice(1); }
    }
    if (day == null) return null;
    var year = null, ytxt = rest.join(' ');
    var y4 = /\b(1[89]\d\d|20\d\d)\b/.exec(ytxt);
    if (y4) year = +y4[1];
    else if (/^(nineteen|twenty)\b/.test(ytxt) && !/hundred|thousand/.test(ytxt)) {
      var head = rest[0] === 'nineteen' ? 1900 : 2000, tail = wordsToNumber(rest.slice(1).join(' '));
      year = tail == null ? (rest[0] === 'nineteen' ? null : null) : head + tail;
      if (year != null && tail > 99) year = null;
    } else {
      var wy = wordsToNumber(ytxt);
      if (wy != null && wy >= 1900 && wy <= 2100) year = Math.round(wy);
      else if (wy != null && wy >= 0 && wy <= 99) year = (wy <= 30 ? 2000 : 1900) + Math.round(wy);
    }
    if (year == null) return null;
    var chk = util.parseDate(year + '-' + month + '-' + day);
    return chk ? chk.y + '-' + pad(chk.m) + '-' + pad(chk.d) : null;
  }

  /* "paul at liferisk dot co dot za" -> paul@liferisk.co.za */
  function spokenEmail(raw) {
    var s = String(raw).trim().toLowerCase().replace(/[,;!?]+$/, '');
    if (s.indexOf('@') < 0) s = s.replace(/\s+at\s+/, '@');
    s = s.replace(/\s+dot\s+/g, '.').replace(/\s+underscore\s+/g, '_').replace(/\s+(?:dash|hyphen)\s+/g, '-').replace(/\s+/g, '').replace(/\.$/, '');
    return s;
  }

  function yesNo(t) {
    var s = ' ' + t + ' ';
    if (/ (not sure|unsure|don't know|dont know|no idea|not certain|maybe|perhaps) /.test(s)) return 'unsure';
    s = s.replace(/ (do|does|did|have|has|am|is|are) not /g, " don't ");
    var neg = / (no|nope|nah|never|none|negative|don't|dont|doesn't|doesnt|didn't|didnt|haven't|havent|hasn't|hasnt|isn't|isnt|aren't|arent|won't|wont|nothing|neither|not) /.test(s);
    var pos = / (yes|yeah|yep|yup|yebo|ja|correct|definitely|absolutely|certainly|affirmative|sure|indeed|true) /.test(s) || / (i|we) (do|have|am|are|did) /.test(s);
    if (neg && !pos) return 'no';
    if (pos && !neg) return 'yes';
    return null;
  }

  /* ---------- the form, as the voice layer sees it ---------- */
  var SECTION_WORDS = {
    info: ['client info', 'client information', 'client details', 'personal details', 'personal info', 'about you', 'contact details', 'the client'],
    income: ['income and household', 'income', 'household', 'salary', 'earnings', 'finances'],
    occ: ['occupation', 'work', 'job', 'employment', 'your work'],
    cover: ['existing cover and retirement', 'existing cover', 'existing risk cover', 'risk cover', 'existing policies', 'retirement', 'cover'],
    inv: ['investments', 'investment', 'savings'],
    other: ['medical will and short term', 'medical aid', 'medical', 'gap cover', 'will', 'wills', 'short term insurance', 'short term', 'insurance'],
    health: ['health', 'health questions', 'medical history'],
    debts: ['debts', 'debt', 'loans', 'liabilities'],
    kids: ['children', 'kids', 'dependants', 'dependents'],
    q_risk: ['personal risk quotes', 'risk quotes', 'personal risk'],
    q_ret: ['retirement and investment quotes', 'retirement quotes', 'investment quotes', 'retirement and investment'],
    q_ref: ['referrals and documents', 'referrals', 'documents'],
    q_calc: ['risk calculation', 'calculation', 'needs calculation'],
    q_biz: ['business assurance', 'buy and sell', 'buy and sell agreement', 'key man', 'keyman', 'contingent liability']
  };

  /* What you might say when asking about each field. Fields without an entry are matched on their on-screen label. */
  var ALIASES = {
    consent: ['consent', 'okay to record', 'record this', 'record the call', 'recording', 'transcribe'],
    ref: ['referred', 'referral', 'who referred', 'how did you hear', 'where did you hear'],
    fname: ['first name', 'full name', 'your name', 'my name', 'christian name', 'given name', 'name and surname'],
    sname: ['surname', 'last name', 'family name', 'second name'],
    dob: ['date of birth', 'birthday', 'birth date', 'when were you born', 'born'],
    idtype: ['id or passport', 'passport or id'],
    idno: ['id number', 'identity number', 'id no', 'passport number', 'your id'],
    nat: ['nationality', 'citizen', 'citizenship', 'south african citizen'],
    tax: ['tax number', 'income tax number', 'tax reference', 'sars number', 'tax reference number'],
    cell: ['cell', 'cell number', 'mobile', 'mobile number', 'cellphone', 'cell phone', 'contact number', 'phone number', 'number to reach'],
    work: ['work number', 'work phone', 'office number', 'work telephone'],
    home: ['home number', 'home phone', 'landline', 'home telephone'],
    pemail: ['personal email', 'email', 'email address', 'e mail'],
    wemail: ['work email', 'work email address', 'office email'],
    smoker: ['smoke', 'smoker', 'smoking', 'cigarettes'],
    edu: ['highest education', 'education', 'qualification', 'qualified', 'what did you study', 'studied', 'matric', 'degree'],
    edu_notes: ['qualification details', 'what are your qualifications'],
    gross: ['gross', 'gross income', 'gross salary', 'before tax', 'salary before', 'how much do you earn', 'earn', 'earning'],
    net: ['take home', 'net income', 'net salary', 'nett', 'paid into your account', 'hits your account', 'in your pocket'],
    exp: ['expenses', 'monthly expenses', 'budget', 'how much do you spend', 'living expenses', 'spend a month', 'monthly spend'],
    marital: ['marital status', 'married', 'single', 'relationship status', 'are you married'],
    sp_name: ['spouse name', 'partner name', 'name of your spouse', 'name of your partner', 'wife', 'husband'],
    sp_tel: ['spouse number', 'partner number', 'spouse cell', 'spouse telephone', 'spouse phone'],
    sp_occ: ['spouse occupation', 'what does your wife do', 'what does your husband do', 'spouse work', 'what does your partner do', 'partner work'],
    employed: ['employed', 'do you work', 'are you working', 'self employed', 'work for a company', 'work for someone', 'in employment'],
    employer: ['employer', 'who do you work for', 'company name', 'name of the company', 'name of your employer', 'what company', 'where do you work'],
    co_does: ['what does the company do', 'what does the company do', 'what do they do'],
    bizowner: ['own a business', 'business owner', 'own your own business', 'own business', 'run a business', 'business of your own'],
    occ: ['occupation', 'job title', 'what do you do', 'what is your job', 'role', 'position', 'profession', 'what do you do for a living'],
    ft: ['full time', 'contract', 'permanent', 'full time or contract'],
    years: ['how long', 'how many years', 'years in', 'tenure', 'in this occupation', 'in this job', 'in this position'],
    biz_name: ['business name', 'name of the business', 'what is the business called', 'business called'],
    biz_struct: ['type of ownership', 'structure', 'registered', 'registered as', 'how is it registered', 'legal structure', 'sole proprietor', 'partnership', 'close corporation'],
    biz_does: ['what does the business do', 'what does your business do'],
    biz_partners: ['partners', 'co owners', 'business partners', 'any partners'],
    biz_pct: ['shareholding', 'your share', 'what percentage', 'percentage do you own', 'what is your interest'],
    biz_loans: ['business loans', 'surety', 'suretyship', 'signed surety', 'loans in the business'],
    d_desk: ['deskbound', 'behind a desk', 'desk', 'office work'],
    d_supo: ['supervising staff in the office', 'supervise in the office', 'supervising in the office'],
    d_trav: ['travel', 'travelling', 'on the road', 'driving for work'],
    d_sups: ['supervising staff on site', 'supervise on site', 'supervising on site', 'on site'],
    d_light: ['light manual', 'light physical'],
    d_mod: ['moderate manual', 'moderate'],
    d_heavy: ['heavy manual', 'heavy'],
    d_desc: ['duties', 'describe your duties', 'what do you do all day'],
    has_risk: ['personal risk cover', 'life cover', 'risk cover', 'life insurance', 'any cover', 'cover in place', 'existing cover'],
    joint: ['joint cover', 'joint with spouse', 'joint with your spouse'],
    has_group: ['group risk', 'group cover', 'cover through your employer', 'employer cover', 'group life', 'death benefit through work'],
    ma: ['medical aid', 'hospital plan', 'medical scheme'],
    ma_prov: ['medical aid provider', 'which medical aid', 'which scheme', 'who is your medical aid', 'medical scheme'],
    ma_plan: ['which plan', 'medical aid plan', 'what plan', 'plan option', 'which option'],
    ma_broker: ['medical aid broker', 'who is your medical aid broker', 'who looks after your medical aid'],
    gap: ['gap cover', 'gap'],
    gap_prov: ['gap cover provider', 'who is your gap cover with', 'who is your gap provider'],
    gap_broker: ['gap cover broker', 'who is your gap broker'],
    will: ['do you have a will', 'have a will', 'a will'],
    will_up: ['up to date', 'is it current', 'updated'],
    will_where: ['held with', 'where is your will', 'who holds', 'where is the will kept'],
    will_broker: ['will broker', 'who drew up', 'who did your will'],
    will_date: ['last updated', 'when last', 'when was it updated', 'last update'],
    sti: ['short term', 'short term insurance', 'car insurance', 'household insurance'],
    sti_broker: ['short term broker', 'who is your short term broker', 'broker for short term'],
    sti_car: ['car', 'vehicle', 'car insured'],
    sti_house: ['household contents', 'contents'],
    sti_struct: ['structural', 'buildings', 'house structure'],
    sti_personal: ['total personal spend', 'personal premiums', 'what do you pay for short term', 'personal short term spend'],
    sti_biz: ['business insurance', 'business short term'],
    sti_biz_spend: ['total business spend', 'business premiums'],
    h_gen: ['general health', 'health good', 'how is your health', 'in good health', 'are you healthy'],
    h_dia: ['diabetes', 'diabetic', 'sugar'],
    h_chol: ['cholesterol'],
    h_bp: ['blood pressure', 'hypertension'],
    h_bmi: ['bmi', 'body mass', 'weight'],
    h_oth: ['other health', 'any other health', 'health issues', 'other conditions']
  };
  var ALIASES_N = {};
  Object.keys(ALIASES).forEach(function (id) { ALIASES_N[id] = ALIASES[id].map(function (p) { var n = norm(p); return { p: n, n: n.split(' ').length }; }); });

  var NAME_IDS = ['fname', 'sname', 'sp_name', 'km_name'];
  var COMPANY_IDS = ['employer', 'biz_name', 'cl_lender'];
  var OCC_IDS = ['occ', 'sp_occ', 'km_role'];
  var DATE_IDS = ['dob', 'will_date'];
  var PHONE_IDS = ['cell', 'work', 'home', 'sp_tel'];
  var EMAIL_IDS = ['pemail', 'wemail'];
  var DIGIT_IDS = ['idno', 'tax'];
  var PCT_IDS = ['d_desk', 'd_supo', 'd_trav', 'd_sups', 'd_light', 'd_mod', 'd_heavy', 'biz_pct'];

  /* A list of the fields voice can fill and the sections it can open. */
  function buildIndex(schema) {
    var sections = schema.sections.map(function (s) { return { id: s.id, title: s.title, adv: !!s.adv, cond: s.cond }; });
    var fields = [], byId = {};
    schema.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b) {
        (b.fields || []).forEach(function (f) {
          if (f.calc || f.preset || f.opt) return;
          var e = { id: f.id, label: f.l, sec: sec.id, cond: b.cond, secCond: sec.cond, t: f.t === 'area' ? 'area' : (f.o ? 'sel' : 'txt'), options: f.o || null, free: !!f.free, money: !!f.money, none: !!f.none, lt: content(f.l), order: fields.length };
          fields.push(e); byId[f.id] = e;
        });
      });
    });
    return { sections: sections, fields: fields, byId: byId };
  }

  /* ---------- what the advisor says: commands ---------- */
  var NAV_RE = /\b(?:go to|go back to|jump to|move on to|move to|switch to|take me to|show me|open up|open|lets (?:do|deal with|look at|go to|move to|talk about|discuss|start with|begin with|have a look at|move on to)|let us (?:do|deal with|look at|go to|talk about)|i want to (?:deal with|do|look at|go to|talk about|discuss|move to|move on to)|i would like to (?:deal with|do|look at|go to|talk about|discuss)|i'?d like to (?:deal with|do|look at|go to|talk about|discuss)|we(?:'ll| will| are going to| can| should) (?:deal with|do|look at|go to|talk about|discuss|move to|move on to)|moving on to|move onto|on to|onto|turn to|next up(?: is)?|now for|now the)\b/;

  function sectionIn(textNorm, idx) {
    var best = null, bl = 0;
    idx.sections.forEach(function (s) {
      (SECTION_WORDS[s.id] || []).concat([s.title]).forEach(function (w) {
        var wn = norm(w);
        if (wn && has(textNorm, wn) && wn.length > bl) { best = s.id; bl = wn.length; }
      });
    });
    return best;
  }
  function isSectionName(textNorm, idx) {
    return idx.sections.some(function (s) { return (SECTION_WORDS[s.id] || []).concat([s.title]).some(function (w) { return norm(w) === textNorm; }); });
  }

  /* -> { type: 'goto', sec } | next | prev | nextSection | prevSection | undo | clear, or null when it is not a command. */
  function parseCommand(text, idx) {
    var t = norm(text);
    if (!t) return null;
    if (/\b(scratch that|undo that|undo|never mind|nevermind|ignore that|cancel that|forget that)\b/.test(t)) return { type: 'undo' };
    if (/^(clear that|clear this|clear it|delete that|empty that)$/.test(t)) return { type: 'clear' };
    if (/^(next section|go to the next section|move on to the next section|next screen)$/.test(t)) return { type: 'nextSection' };
    if (/^(previous section|go to the previous section|go back a section|previous screen)$/.test(t)) return { type: 'prevSection' };
    if (/^(next|next one|next question|skip|skip that|skip this one|skip it|move on|carry on)$/.test(t)) return { type: 'next' };
    if (/^(previous|previous one|go back|back|previous question)$/.test(t)) return { type: 'prev' };
    var m = NAV_RE.exec(t);
    if (m) {
      var sec = sectionIn(t.slice(m.index + m[0].length), idx);
      if (sec) return { type: 'goto', sec: sec };
    }
    var bare = t.replace(/\b(the|section|screen|page|please|ok|okay|now|lets|go)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (bare && bare.split(' ').length <= 4 && isSectionName(bare, idx)) return { type: 'goto', sec: sectionIn(bare, idx) };
    return null;
  }

  /* ---------- what the advisor says: a question points at a field ---------- */
  function scoreField(f, textNorm, textToks) {
    var best = 0, al = ALIASES_N[f.id] || [], i;
    for (i = 0; i < al.length; i++) if (has(textNorm, al[i].p)) best = Math.max(best, 3 + al[i].n);
    if (f.lt.length) {
      var hit = 0;
      f.lt.forEach(function (w) { if (textToks.indexOf(w) >= 0 || textToks.indexOf(w.replace(/s$/, '')) >= 0 || textToks.indexOf(w + 's') >= 0) hit++; });
      if (hit) best = Math.max(best, 2 * hit / f.lt.length + (hit === f.lt.length ? 0.5 : 0));
    }
    return best;
  }
  /* opts: { cur: current section id, isEmpty(id) } -> { id, score } or null. */
  function matchQuestion(text, idx, opts) {
    opts = opts || {};
    var tn = norm(text), tk = tn ? tn.split(' ') : [], best = null;
    if (!tn) return null;
    idx.fields.forEach(function (f) {
      var s = scoreField(f, tn, tk);
      if (s < 2) return;
      var total = s + (f.sec === opts.cur ? 1.5 : 0) + (!opts.isEmpty || opts.isEmpty(f.id) ? 0.4 : 0);
      if (!best || total > best.total) best = { id: f.id, score: s, total: total };
    });
    return best ? { id: best.id, score: best.score } : null;
  }

  /* Is this the adviser asking or steering, rather than the client answering? A question mark, a question word, a request to talk
     about something ("let's talk about your employer", "tell me about ...") or a check back ("you work for a company, right?"). */
  var ASK_LEAD = new RegExp('^(?:(?:and|so|okay|ok|right|now|alright|then|um+|uh+|well|great|perfect|lovely|thanks|thank you|sorry)[,.\\s]+)*(?:' + [
    "what|what's|whats|who|who's|whose|where|where's|when|when's|why|how|which",
    "(?:do|did|does) (?:you|your|the|he|she|they|we|it)",
    "(?:are|were|is|was) (?:you|your|there|it|the|he|she|they)",
    "(?:have|has|had) (?:you|your|any|the|he|she|they)",
    "(?:can|could|would|will|shall|should|may|might) (?:you|i|we)",
    "tell me|let me|let's|lets|let us|moving on|on to|turning to|talking about|speaking of|please|if you|how about|what about",
    "next[,.]?\\s+(?:question|section|one|up|is|please|we|let|your|thing)",
    "i(?:'d| would) like to (?:ask|know|talk|discuss|move|go|start|look|cover|turn)",
    "your|you(?:'re|re| are| work| worked| have| had| live| lived| own| earn| said| mentioned| told| stay| do| did)"
  ].join('|') + ')\\b', 'i');
  /* Acknowledgements and small talk ("okay great", "thanks", "I see"): they ask nothing and answer nothing, so the form ignores them. */
  var CHATTER = /^(?:(?:okay|ok|great|perfect|lovely|thanks|thank you|alright|right|good|sure|cool|nice|wonderful|excellent|fine|super|got it|i see|understood|noted|mm+|hm+|uh huh|yes|yeah|yep|no|sorry|pardon|and|so|well|um+|uh+|that is|that's|that is fine|that is great|very much|so much|very helpful|helpful)[,.!\s]*)+$/i;
  function isChatter(text) { var s = String(text == null ? '' : text).trim(); return !s || CHATTER.test(s); }
  function looksLikeQuestion(text) {
    var s = String(text == null ? '' : text).trim();
    return !!s && (/\?\s*["')]*$/.test(s) || ASK_LEAD.test(s));
  }

  /* ---------- what the client says: an answer fills the field ---------- */
  function titleCase(s) {
    var PART = { van: 1, der: 1, den: 1, de: 1, du: 1, le: 1, la: 1, von: 1, bin: 1, al: 1 };
    return String(s).trim().split(/\s+/).map(function (w, i) {
      if (/^[A-Z0-9&.]{2,}$/.test(w)) return w;
      if (i > 0 && PART[w.toLowerCase()]) return w.toLowerCase();
      return w.toLowerCase().replace(/(^|['\-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    }).join(' ');
  }
  var FILLER = /^\s*(?:(?:um+|uh+|er+|erm|ah+|hmm+|well|so|okay|ok|yes|yeah|yep|alright|ja|right)[,.\s]+)+/i;
  var LEAD_NAME = /^(?:my (?:first |full |sur)?name is |my (?:first |sur)?name's |i am |i'm |it's |it is |that's |that is |the name is |name is |it's called |called |surname is |first name is |my surname is |this is )/i;
  var LEAD_COMPANY = /^(?:i (?:currently )?(?:work|am working|'m working|am employed|'m employed)\s+(?:at|for|with|in)\s+|i'?m (?:at|with|employed (?:at|by|with))\s+|i am (?:at|with|employed (?:at|by|with))\s+|it'?s |it is |the company is |company is |we are |for |at |with |it's called |called |the name is |name is |my company is |my employer is |employer is )/i;
  var LEAD_OCC = /^(?:i(?:'m| am) (?:now |currently |still |just )?(?:a |an |the )?|i work as (?:a |an |the )?|i'm working as (?:a |an |the )?|my (?:job|occupation|role|position|title) is (?:a |an |the )?|i do |i'm doing |i am doing |it's |it is )/i;
  /* The words around an answer are not part of it: "my second name my surname is Snow" means Snow. A leading run of such words (possessives,
     "is", "called", the box's own name) is dropped when it holds a marker word; if nothing is left, no answer has been given yet. */
  var NAMEVOC = ['name', 'names', 'first', 'second', 'last', 'sur', 'surname', 'family', 'given', 'christian', 'full'];
  var GENVOC = ['my', 'your', 'his', 'her', 'their', 'our', 'the', 'is', 'are', 'was', 'were', "it's", 'its', "that's", 'thats', 'it', 'that', 'called', 'named', 'um', 'uh', 'er', 'oh', 'well', 'so', 'and', 'but', 'okay', 'ok', 'yes', 'yeah', 'no', 'right', 'actually', 'then', 'now'];
  var MARKERS = ['is', 'are', 'was', 'were', "it's", "that's", 'thats', 'called', 'named'];
  function stripLead(f, s) {
    var isName = NAME_IDS.indexOf(f.id) >= 0, own = norm(f.label || '').split(' ').filter(Boolean);
    var voc = GENVOC.concat(own, isName ? NAMEVOC : []), mark = MARKERS.concat(own, isName ? NAMEVOC : []);
    var toks = String(s).trim().split(/\s+/), i = 0, hasMark = false;
    while (i < toks.length) {
      var w = toks[i].toLowerCase().replace(/[.,;:!?]+$/, '');
      if (voc.indexOf(w) < 0) break;
      if (mark.indexOf(w) >= 0) hasMark = true;
      i++;
    }
    return hasMark ? toks.slice(i).join(' ') : toks.join(' ');
  }
  /* Does what is left look like an answer rather than a sentence fragment? */
  function looksLikeValue(f, c) {
    if (!c || /(?:^|\s)(?:is|are|was|were|am|and|but|the|a|an|of|my|your)[.,;:!?]*\s*$/i.test(c)) return false;
    if (/^(?:my|your)\s/i.test(c)) return false;
    if (NAME_IDS.indexOf(f.id) >= 0) {
      var t = c.split(/\s+/);
      if (t.length > 5 || !/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(c)) return false;
      return !t.some(function (w) { w = w.toLowerCase().replace(/[.,]+$/, ''); return GENVOC.indexOf(w) >= 0 || NAMEVOC.indexOf(w) >= 0 || w === 'i' || w === "i'm" || w === 'am'; });
    }
    return true;
  }
  function cleanText(f, raw) {
    var s = stripLead(f, String(raw).trim().replace(FILLER, '').trim()).trim();
    var id = f.id;
    if (NAME_IDS.indexOf(id) >= 0) s = s.replace(LEAD_NAME, '');
    else if (COMPANY_IDS.indexOf(id) >= 0) s = s.replace(LEAD_COMPANY, '');
    else if (OCC_IDS.indexOf(id) >= 0) s = s.replace(LEAD_OCC, '');
    return s.replace(/[\s,;.!?]+$/, '').replace(/\s+(?:now|at the moment|currently)$/i, '').trim();
  }
  var ok = function (v) { return { value: v, status: 'heard' }; };

  /* Per-field rules where plain option matching is not enough. Return an option, an object, or null to fall through. */
  var SPECIAL = {
    smoker: function (t) {
      var s = ' ' + t + ' ';
      if (/ (non smoker|nonsmoker|don't smoke|dont smoke|do not smoke|never smoked|not a smoker) /.test(s)) return 'Non-smoker';
      if (/ (smoker|smoke|smokes) /.test(s)) return 'Smoker';
      var yn = yesNo(t); return yn === 'yes' ? 'Smoker' : yn === 'no' ? 'Non-smoker' : null;
    },
    ft: function (t) {
      var s = ' ' + t + ' ';
      if (/ (full time|permanent|permanently) /.test(s)) return 'Full time';
      if (/ (contract|contractor|fixed term) /.test(s)) return 'Contract';
      return null;
    },
    ma: function (t) {
      var s = ' ' + t + ' ';
      if (/ hospital plan /.test(s)) return 'Hospital plan';
      var yn = yesNo(t);
      if (/ (medical aid|medical scheme) /.test(s) && yn !== 'no') return 'Medical aid';
      if (yn === 'no' || / none /.test(s)) return 'None';
      if (yn === 'yes') return 'Medical aid';
      return null;
    },
    nat: function (t, raw) {
      var s = ' ' + t + ' ';
      if (/ (south african|south africa|saffer|sa|local) /.test(s)) return 'South African';
      if (yesNo(t) === 'yes') return 'South African';
      var c = String(raw).trim().replace(FILLER, '').replace(/^(?:i(?:'m| am) |i'm a |i am a |from |i come from |i was born in )/i, '').replace(/[\s,;.!?]+$/, '');
      return c ? { value: 'Other', status: 'heard', extra: [{ id: 'nat_other', value: titleCase(c), status: 'verify' }] } : null;
    },
    sti: function (t) {
      return / (spouse|wife|husband|partner|handled by|handles|handle) /.test(' ' + t + ' ') ? 'Handled by spouse' : null;
    },
    edu: function (t) {
      var s = ' ' + t + ' ';
      if (/ matric/.test(s) && / diploma /.test(s)) return 'Matric & diploma';
      if (/ (4 year|four year) /.test(s) && / diploma /.test(s)) return '4-year diploma';
      if (/ (postgrad|post graduate|honours|masters|mba|doctorate|phd|postgraduate) /.test(s)) return 'Postgraduate';
      if (/ (degree|bachelor|bcom|bsc|ba) /.test(s)) return '3-year degree';
      if (/ (matric|grade 12|school) /.test(s)) return 'Matric';
      return null;
    },
    marital: function (t) {
      var s = ' ' + t + ' ';
      if (/ single /.test(s)) return 'Single';
      if (/ divorced /.test(s)) return 'Divorced';
      if (/ (widow|widowed|widower) /.test(s)) return 'Widowed';
      if (/ customary /.test(s)) return 'Customary marriage';
      if (/ civil union /.test(s)) return 'Civil union';
      if (/ life partner /.test(s)) return 'Life partner';
      if (/ in community /.test(s)) return 'Married in community of property';
      if (/ (no accrual|without accrual) /.test(s)) return 'Married out of community (no accrual)';
      if (/ with accrual /.test(s)) return 'Married out of community (with accrual)';
      if (/ out of community /.test(s)) return { error: 'ambiguous', note: 'out of community: with or without accrual?' };
      if (/ married /.test(s) || / marriage /.test(s)) return { error: 'ambiguous', note: 'married: in or out of community?' };
      return null;
    },
    biz_struct: function (t) {
      var s = ' ' + t + ' ';
      if (/ (pty|private company|company|ltd) /.test(s)) return 'Private company (Pty) Ltd';
      if (/ (cc|close corporation) /.test(s)) return 'Close corporation';
      if (/ (sole proprietor|sole prop|self employed|freelance|freelancer) /.test(s)) return 'Sole proprietor';
      if (/ partnership /.test(s)) return 'Partnership';
      if (/ trust /.test(s)) return 'Trust';
      return null;
    },
    sti_broker: function (t) { return / (cameron|maritz) /.test(' ' + t + ' ') ? 'Cameron Maritz' : null; }
  };
  ['ma_broker', 'gap_broker', 'will_broker'].forEach(function (id) {
    SPECIAL[id] = function (t) {
      var s = ' ' + t + ' ';
      if (/ (through|via) (my |the )?(company|employer|work) /.test(s) || / through company /.test(s)) return 'Through company';
      if (/ no broker /.test(s)) return 'Privately paid, no broker';
      if (/ (paul|paul k) /.test(s)) return 'Paul K';
      return null;
    };
  });

  function pickOption(f, t, raw) {
    var opts = f.options, low = opts.map(function (o) { return o.toLowerCase(); }), res;
    var sp = SPECIAL[f.id];
    if (sp) {
      var v = sp(t, raw);
      if (v && v.error) return v;
      if (v && typeof v === 'object') return v;
      if (v) return ok(v);
    }
    var iy = low.indexOf('yes'), ino = low.indexOf('no');
    if (iy >= 0 && ino >= 0) {
      var yn = yesNo(t);
      if (yn === 'yes') return ok(opts[iy]);
      if (yn === 'no') return ok(opts[ino]);
      if (yn === 'unsure') {
        var iu = -1; low.forEach(function (o, i) { if (/unsure|not sure/.test(o)) iu = i; });
        return iu >= 0 ? ok(opts[iu]) : { error: 'unsure', note: 'not sure: left empty' };
      }
    }
    if (opts.every(function (o) { return /^\d+$/.test(o); })) {
      var n = wordsToNumber(raw);
      if (n != null && opts.indexOf(String(Math.round(n))) >= 0) return ok(String(Math.round(n)));
      return { error: 'no-match' };
    }
    var tk = toks(t), scored = [];
    opts.forEach(function (o) {
      var on = norm(o.replace(/\(.*?\)/g, ' ')), ot = content(on), sc = 0;
      if (!on) return;
      if (has(t, on)) sc = 10 + on.length / 100;
      else if (ot.length) {
        var hit = ot.filter(function (w) { return tk.indexOf(w) >= 0; }).length;
        sc = hit / ot.length * 5;
        if (tk.indexOf(ot[0]) >= 0) sc = Math.max(sc, 3);
        if (hit === ot.length) sc = Math.max(sc, 6 + hit);
      }
      if (sc > 0) scored.push({ o: o, sc: sc });
    });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var need = f.free ? 3 : 6;
    if (scored.length && scored[0].sc >= need) {
      if (scored.length > 1 && scored[1].sc === scored[0].sc) res = { error: 'ambiguous', note: 'could be ' + scored[0].o + ' or ' + scored[1].o };
      else res = ok(scored[0].o);
      return res;
    }
    if (f.free) {
      var txt = cleanText(f, raw);
      return txt ? { value: titleCase(txt), status: 'verify' } : { error: 'no-match' };
    }
    return { error: 'no-match' };
  }

  /* One answer for one field -> { value, status, extra?, append? } | { error, note? } | null. */
  function interpret(f, raw) {
    var t = norm(raw);
    if (!t) return null;
    if (f.none && yesNo(t) === 'no') return ok('None');
    if (f.options) return pickOption(f, t, raw);
    if (f.money) {
      var amt = wordsToNumber(raw);
      return amt == null ? { error: 'no-number' } : { value: util.formatMoney(String(amt)), status: 'verify' };
    }
    var id = f.id;
    if (DATE_IDS.indexOf(id) >= 0) { var d = spokenDate(raw); return d ? { value: d, status: 'verify' } : { error: 'no-date' }; }
    if (EMAIL_IDS.indexOf(id) >= 0) {
      var em = spokenEmail(raw);
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? { value: em, status: 'verify' } : { error: 'no-email', note: 'heard "' + em + '"' };
    }
    if (PHONE_IDS.indexOf(id) >= 0) {
      var ph = spokenDigits(raw);
      return ph ? { value: formatPhone(ph), status: 'verify', note: ph.length < 10 ? 'only ' + ph.length + ' digits heard' : '' } : { error: 'no-digits' };
    }
    if (DIGIT_IDS.indexOf(id) >= 0) {
      var dg = spokenDigits(raw);
      return dg ? { value: dg, status: 'verify', note: id === 'idno' && dg.length !== 13 ? dg.length + ' digits heard, an ID has 13' : '' } : { error: 'no-digits' };
    }
    if (PCT_IDS.indexOf(id) >= 0) {
      var p = wordsToNumber(raw);
      return p == null ? { error: 'no-number' } : { value: String(Math.round(p * 10) / 10), status: 'heard' };
    }
    if (id === 'years') {
      var y = wordsToNumber(raw);
      if (y == null) return { error: 'no-number' };
      if (/month/.test(t) && !/year/.test(t)) y = Math.round(y / 12 * 10) / 10;
      return { value: String(y), status: 'heard' };
    }
    var c = cleanText(f, raw);
    if (!c) return { error: 'lead-in-only' };
    if (!looksLikeValue(f, c)) return { error: 'unclear', note: 'not a clear answer: "' + c + '"' };
    if (NAME_IDS.indexOf(id) >= 0) return { value: titleCase(c), status: 'verify' };
    if (f.t === 'area') return { value: c.charAt(0).toUpperCase() + c.slice(1), status: 'heard', append: true };
    if (COMPANY_IDS.indexOf(id) >= 0 && c === c.toLowerCase()) c = titleCase(c);
    return { value: c.charAt(0).toUpperCase() + c.slice(1), status: 'heard' };
  }

  /* ---------- the client's answer meets what is already in the box ---------- */
  /* ---------- a stretch of conversation, in order ---------- */
  /* Real talk is fluid: one line can hold the adviser stating a fact ("your first name is John"), asking ("and your second name?") and the client
     jumping in ("oh, my second name is Peters"). Facts count whoever says them. plan() splits the line into clauses, works through them in
     order and returns the things to do: { do: 'cmd' | 'ask' | 'fill' | 'confirm' | 'wait', ... }. sure is false when some part was not understood
     with certainty, so the caller can have Claude read the line. st: { cur, target, answered, value(id), visible(id) }. */
  var LEADWORDS = /^(?:(?:oh|well|okay|ok|so|and|but|um+|uh+|yes|yeah|no|right|sorry|actually|ja|hi|hello|then|now)[,.!\s]+)+/i;
  var ASSERT = /^((?:your|my|his|her|their|our|the)\s+)?(.{2,60}?)\s+(?:is|are|was|were|will be|would be)\s+(.+?)[.!]*$/i;
  var WH = /^(?:what|what's|whats|who|who's|whose|where|when|why|how|which)\b/i;
  function clauses(text) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    t = t.replace(/([.?!])\s+/g, '$1\u0001').replace(/\s+(?:and|but|so)\s+(?=(?:your|my|his|her|their)\b)/gi, '\u0001');
    return t.split('\u0001').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function plan(text, idx, st) {
    st = st || {};
    var actions = [], sure = true, target = st.target || null, answered = !!st.answered;
    var visible = st.visible || function () { return true; }, valueOf = st.value || function () { return ''; };
    var near = { cur: st.cur, isEmpty: function (id) { return valueOf(id) === ''; } };
    clauses(text).forEach(function (seg) {
      var core = seg.replace(LEADWORDS, '').trim(), isQ = /\?\s*["')]*$/.test(core), words = seg.split(/\s+/).length;
      if (!core) return;
      var cmd = parseCommand(core, idx);
      if (cmd) { actions.push({ do: 'cmd', cmd: cmd }); return; }
      if (!isQ && !WH.test(core) && /\b(?:is|are|was|were)[.,;:!]*\s*$/i.test(core)) {   // "my surname is" ... and then nothing yet: glow that box and keep listening
        var dh = matchQuestion(core, idx, near);
        if (dh && dh.score >= 2.5 && visible(dh.id)) { actions.push({ do: 'ask', field: dh.id }); target = dh.id; answered = false; return; }
      }
      var m = !isQ && !WH.test(core) ? ASSERT.exec(core) : null;           // "your first name is John", "my surname is Peters"
      if (m) {
        var hit = matchQuestion((m[1] || '') + m[2], idx, near);
        if (hit && hit.score >= 2.5 && visible(hit.id)) {
          var r = answerFor(idx.byId[hit.id], m[3].replace(/[,\s]+(?:right|correct|okay|ok|yes|isn't it|is that right|is that correct|not so)\s*$/i, ''), valueOf(hit.id));
          if (r.kind === 'fill' || r.kind === 'confirm') { actions.push({ do: r.kind, field: hit.id, res: r, explicit: true }); target = hit.id; answered = true; if (hit.score < 3) sure = false; return; }
        }
      }
      if (isQ || WH.test(core) || looksLikeQuestion(core)) {               // someone asks about a field
        var q = matchQuestion(core, idx, near);
        if (q && visible(q.id)) { actions.push({ do: 'ask', field: q.id }); target = q.id; answered = false; if (q.score < 4) sure = false; }
        else if (!isChatter(core)) sure = false;
        return;
      }
      if (target && !answered) {                                           // a plain statement while a box is waiting answers it
        var a = answerFor(idx.byId[target], seg, valueOf(target));
        if (a.kind === 'fill' || a.kind === 'confirm') { actions.push({ do: a.kind, field: target, res: a }); answered = true; if (words >= 6) sure = false; return; }
        if (a.kind === 'wait') { actions.push({ do: 'wait', field: target, dangling: !!a.dangling }); return; }
        sure = false; return;
      }
      if (!isChatter(seg)) sure = false;
    });
    return { actions: actions, sure: sure };
  }

  var PRIVATE_IDS = ['idno', 'tax', 'cell', 'work', 'home', 'sp_tel', 'pemail', 'wemail'];
  var AGREE = { correct: 1, right: 1, exactly: 1, same: 1, unchanged: 1, still: 1, yes: 1, yeah: 1, yep: 1, yup: 1, ja: 1, sure: 1, indeed: 1, definitely: 1, absolutely: 1, true: 1, thanks: 1, thank: 1, changed: 1, nothing: 1, change: 1 };
  var NEGATE = { no: 1, nope: 1, nah: 1, not: 1, never: 1, none: 1, really: 1, quite: 1 };
  /* Does the client simply agree with what is there? A bare "yes" counts only for plain text boxes (bare = true). */
  function isConfirm(raw, bare) {
    var t = norm(raw), n = t ? t.split(' ').length : 0;
    if (!t || n > 9) return false;
    if (/\b(nothing has changed|no change|not changed|hasn t changed|has not changed)\b/.test(t)) return true;
    var yn = yesNo(t);
    if (yn === 'no' || yn === 'unsure') return false;
    var rest = content(t).filter(function (w) { return !AGREE[w]; });
    if (rest.length) return false;
    if (/\b(correct|right|exactly|same|unchanged|still|true)\b/.test(t)) return true;
    return !!bare && yn === 'yes';
  }
  /* -> { kind: 'confirm' } | { kind: 'wait' } (the client said no and the new value is still to come) |
        { kind: 'fill', value, status, extra?, append?, note? } | { kind: 'error', error, note? } | { kind: 'none' } */
  function answerFor(f, raw, existing) {
    existing = existing == null ? '' : String(existing);
    var t = norm(raw);
    if (!t) return { kind: 'none' };
    var hasYN = !!f.options && f.options.some(function (o) { return o.toLowerCase() === 'yes'; }) && f.options.some(function (o) { return o.toLowerCase() === 'no'; });
    var plain = !f.options, correction = false, m;
    if (plain && existing && (m = /^\s*(?:no|nope|nah|not really|not quite|actually)[,.\s]+(.+)$/i.exec(String(raw)))) { raw = m[1]; t = norm(raw); correction = true; }
    if (existing && !correction && isConfirm(raw, plain)) return { kind: 'confirm' };
    if (plain && !correction && t.split(' ').length <= 3 && yesNo(t) && !content(t).filter(function (w) { return !AGREE[w] && !NEGATE[w]; }).length) {
      return yesNo(t) === 'no' && existing ? { kind: 'wait' } : { kind: 'none' };
    }
    var r = interpret(f, raw);
    if (!r) return { kind: 'none' };
    if (r.error === 'lead-in-only') return { kind: 'wait', dangling: true };
    if (r.error) return { kind: 'error', error: r.error, note: r.note };
    if (existing && norm(r.value) === norm(existing)) return { kind: 'confirm' };
    return { kind: 'fill', value: r.value, status: r.status, extra: r.extra, append: r.append, note: r.note };
  }

  return {
    norm: norm, wordsToNumber: wordsToNumber, spokenDigits: spokenDigits, spokenDate: spokenDate, spokenEmail: spokenEmail, yesNo: yesNo,
    buildIndex: buildIndex, parseCommand: parseCommand, looksLikeQuestion: looksLikeQuestion, isChatter: isChatter, plan: plan, matchQuestion: matchQuestion, interpret: interpret, titleCase: titleCase,
    isConfirm: isConfirm, answerFor: answerFor, PRIVATE_IDS: PRIVATE_IDS
  };
});
