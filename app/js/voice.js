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
  /* "A 1 2 3 4 5 6 7", "A1234567", "my passport number is A one two three..." -> A1234567, or null when it is not a passport number. */
  function spokenPassport(raw) {
    var t = String(raw), m = /\b([A-Za-z]{1,2})[\s-]?(\d[\d\s-]{4,18}\d)\b/.exec(t);
    if (m && !/^(?:id|is|no|at|in|on|to|or|my|it|as|am|an|be|by|do|go|he|if|me|of|so|up|us|we)$/i.test(m[1])) return (m[1] + m[2].replace(/[\s-]/g, '')).toUpperCase();   // not a plain word before the number ("my ID is 7212...")
    var sp = /^\s*([A-Za-z]{1,2})[\s,-]+((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)[\s,-]*){6,})$/i.exec(t);      // "A one two three four five six seven"
    if (sp && spokenDigits(sp[2]).length >= 6) return (sp[1] + spokenDigits(sp[2])).toUpperCase();
    if (!/passport/i.test(t)) return null;
    var out = '';
    norm(t.replace(/^.*passport(?:\s+number)?\s*(?:is|:)?/i, '')).split(' ').forEach(function (w) {
      if (/^[a-z]$/.test(w)) out += w.toUpperCase();
      else if (/^\d+$/.test(w)) out += w;
      else if (w === 'oh' || w === 'zero') out += '0';
      else if (SMALL.hasOwnProperty(w) && SMALL[w] < 10) out += SMALL[w];
      else if (/^[a-z0-9]{5,}$/i.test(w) && /\d/.test(w)) out += w.toUpperCase();
    });
    return out.length >= 6 && /[A-Z]/.test(out) ? out : null;
  }
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
    if (p) return pad(p.d) + '/' + pad(p.m) + '/' + p.y;
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
    return chk ? pad(chk.d) + '/' + pad(chk.m) + '/' + chk.y : null;
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
    cover: ['personal and group risk cover', 'personal risk cover', 'group risk cover', 'existing risk cover', 'existing cover', 'risk cover', 'existing policies', 'group risk', 'group cover', 'cover'],
    retire: ['retirement funding', 'retirement funds', 'retirement', 'pension and provident', 'pension fund', 'provident fund', 'retirement annuities'],
    inv: ['investments', 'investment', 'savings'],
    other: ['medical will and short term', 'medical aid', 'medical', 'gap cover', 'will', 'wills', 'short term insurance', 'short term', 'insurance'],
    health: ['health', 'health questions', 'medical history'],
    debts: ['debts', 'debt', 'loans', 'liabilities'],
    kids: ['children', 'kids', 'dependants', 'dependents'],
    calc: ['risk calculation', 'calculation', 'needs calculation'],
    prio: ['client priorities identified', 'client priorities', 'priorities', 'what we recommend', 'recommendations', 'personal risk quotes', 'risk quotes', 'retirement and investment quotes', 'retirement quotes', 'investment quotes', 'referrals', 'business assurance', 'buy and sell', 'buy and sell agreement', 'key man', 'keyman', 'contingent liability']
  };

  /* What you might say when asking about each field. Fields without an entry are matched on their on-screen label. */
  /* "What type of quote is the shortfall?": the Type of quote box of the FNA, shortfall or reduced quote. The plain "type of quote" fits all three and the first one still empty is taken. */
  function TYPE_Q(w) {
    return ['type of ' + w, w + ' type', w + ' quote type', 'type of ' + w + ' quote', 'type of quote for the ' + w, 'type of quote for ' + w, 'type of quote is the ' + w, 'type of quote is ' + w,
      'type of quote', 'kind of quote', 'new business or servicing', 'servicing or new business', 'new business or a servicing', 'new or servicing'];
  }
  var ALIASES = {
    consent: ['consent', 'okay to record', 'record this', 'record that', 'record it', 'record the call', 'record our', 'record the conversation', 'recording', 'recorded', 'transcribe', 'go ahead and record', 'happy for us to record', 'happy for me to record', 'happy to be recorded', 'permission to record', 'mind if we record'],
    ref: ['referred', 'referral', 'who referred', 'how did you hear', 'where did you hear'],
    fna_type: TYPE_Q('fna'), sf_type: TYPE_Q('shortfall'), 'redq.type': TYPE_Q('reduced'),
    fname: ['first name', 'full name', 'your name', 'my name', 'christian name', 'given name', 'name and surname'],
    sname: ['surname', 'last name', 'family name', 'second name'],
    dob: ['date of birth', 'birthday', 'birth date', 'when were you born', 'born'],
    'kids.name': ['child name', 'name of the child', 'kid name', 'name of the kid', 'son name', 'daughter name'],
    'kids.sname': ['child surname', 'surname of the child', 'kid surname', 'son surname', 'daughter surname', 'last name of the child', 'child last name'],
    gender: ['gender', 'male or female', 'are you male', 'are you female', 'are you a man', 'are you a woman'],
    'kids.gender': ['boy or girl', 'gender', 'is it a boy', 'is it a girl', 'is he a boy', 'is she a girl'],
    'kids.dob': ['born', 'birthday', 'birth date', 'when was he born', 'when was she born', 'how old is', 'date of birth'],
    'kids.stage': ['which grade', 'what grade', 'education stage', 'what stage', 'at school', 'in school'],
    'kids.cost': ['monthly cost', 'school fees', 'cost per month', 'how much does he cost', 'how much does she cost', 'childcare'],
    'debts.prov': ['who is the loan with', 'which bank', 'loan provider', 'who is it with', 'who is the lender'],
    'debts.type': ['type of loan', 'what kind of loan', 'what type of debt', 'kind of debt'],
    'debts.desc': ['what is it for', 'what was it for', 'description'],
    'debts.owner': ['who owns', 'whose name is it in', 'who is the owner'],
    'debts.payer': ['who pays', 'who is paying', 'who is the payer'],
    'debts.term': ['term left', 'how long is left', 'years left', 'how long left', 'how many years left'],
    'debts.inst': ['instalment', 'installment', 'monthly payment', 'repayment', 'pay per month', 'how much do you pay'],
    'debts.bal': ['balance', 'outstanding', 'how much is outstanding', 'how much do you owe', 'owe'],
    'debts.asset': ['asset value', 'value of the asset', 'what is it worth', 'what is the car worth', 'what is the house worth'],
    'debts.cl': ['credit life', 'credit life cover'],
    'debts.surety': ['surety', 'signed surety'],
    'risk.prov': ['which insurer', 'who is the policy with', 'policy provider', 'insurer'],
    'risk.spend': ['premium', 'monthly premium', 'how much do you pay', 'pay per month'],
    'risk.broker': ['broker on record', 'who is your broker', 'broker'],
    'grp.prov': ['which insurer', 'who is the group policy with', 'group policy provider', 'who administers the group cover', 'group administrator'],
    'grp.spend': ['group premium', 'group risk premium', 'how much is the group risk', 'what does the group cover cost', 'what does your employer pay for group risk'],
    'grp.broker': ['group broker', 'who is the group broker', 'who looks after the group cover'],
    'ret.type': ['type of fund', 'kind of fund', 'pension or provident'],
    'ret.prov': ['fund administrator', 'administrator', 'who is the fund with'],
    'ret.val': ['fund value', 'value of the fund', 'how much is in the fund'],
    'ret.contrib': ['contribution', 'monthly contribution', 'how much do you contribute', 'contribute'],
    'ret.broker': ['broker on record', 'who is your broker', 'broker'],
    'inv.type': ['type of investment', 'kind of investment'],
    'inv.prov': ['who is the investment with', 'investment provider'],
    'inv.val': ['current value', 'how much is it worth', 'worth now'],
    'inv.prem': ['monthly premium', 'monthly contribution', 'how much do you invest', 'invest per month'],
    'inv.broker': ['broker on record', 'who is your broker', 'broker'],
    'shares.name': ['partner name', 'name of the partner', 'shareholder name', 'name of the shareholder'],
    'shares.id': ['partner id', 'partner id number'],
    'shares.cell': ['partner cell', 'partner cell number'],
    'shares.pct': ['shareholding', 'percentage', 'how much of the business', 'what percentage'],
    ref_will: ['will referral', 'referral for the will', 'capital legacy', 'about your will', 'your will', 'wills'],
    idtype: ['id or passport', 'passport or id', 'do you have an id', 'identity document', 'id document', 'id book', 'id card', 'smart card', 'green id book', 'passport'],
    idno: ['id number', 'identity number', 'id no', 'passport number', 'your id', 'my id', 'id', 'identity', 'sa id'],
    nat: ['nationality', 'citizen', 'citizenship', 'south african citizen', 'what nationality', 'are you south african', 'where are you from'],
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
    joint: ['joint life', 'joint cover', 'joint with spouse', 'joint with your spouse'],
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
    pr_life: ['life cover a priority', 'life cover is a priority', 'life cover priority', 'life priority', 'risk cover a priority', 'recommend life cover', 'priority life cover'],
    pr_ra: ['ra a priority', 'ra priority', 'retirement annuity a priority', 'retirement annuity priority', 'recommend an ra', 'recommend a retirement annuity'],
    pr_rgar: ['rgar a priority', 'rgar priority', 'retirement goal analysis a priority', 'retirement goal priority', 'recommend an rgar'],
    pr_inv: ['investing a priority', 'invest a priority', 'investment a priority', 'investments a priority', 'invest priority', 'recommend investing', 'recommend an investment', 'tax free a priority'],
    pr_egar: ['egar a priority', 'egar priority', 'education goal analysis a priority', 'education a priority', 'education planning a priority', 'school fees a priority', 'recommend an egar'],
    pr_med: ['medical aid a priority', 'medical aid priority', 'gap cover a priority', 'medical a priority', 'recommend medical aid', 'recommend gap cover'],
    pr_will: ['will a priority', 'will priority', 'a will a priority', 'estate planning a priority', 'recommend a will', 'update your will a priority'],
    pr_st: ['short term a priority', 'short term priority', 'short term insurance a priority', 'insurance a priority', 'recommend short term'],
    pr_life_cm: ['life comments', 'life cover comments', 'reason for life', 'life instructions'],
    pr_ra_cm: ['ra comments', 'retirement annuity comments', 'reason for the ra', 'ra instructions'],
    pr_rgar_cm: ['rgar comments', 'reason for the rgar', 'rgar instructions'],
    pr_inv_cm: ['invest comments', 'investment comments', 'reason for investing', 'invest instructions'],
    pr_egar_cm: ['egar comments', 'education comments', 'reason for the egar', 'egar instructions'],
    pr_med_cm: ['medical aid comments', 'medical comments', 'reason for medical aid', 'medical aid instructions'],
    pr_will_cm: ['will comments', 'reason for the will', 'will instructions'],
    pr_st_cm: ['short term comments', 'reason for short term', 'short term instructions'],
    marr_date: ['date of marriage', 'marriage date', 'wedding date', 'date of your wedding', 'wedding day', 'when did you get married', 'when were you married', 'when did you marry', 'married on', 'got married on', 'were married on', 'married since', 'wedding anniversary'],
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
  var NAME_PARTS = { van: 1, der: 1, den: 1, de: 1, du: 1, le: 1, la: 1, von: 1, bin: 1, al: 1 };
  var COMPANY_IDS = ['employer', 'biz_name', 'cl_lender'];
  var OCC_IDS = ['occ', 'sp_occ', 'km_role'];
  var DATE_IDS = ['dob', 'will_date', 'marr_date'];
  var APPROX_DATE_IDS = ['will_date', 'marr_date'];                         // boxes where "in 2023" or "about two years ago" is a good enough answer
  /* "2023", "in 2023", "about two years ago", "last year", "six months ago" -> the year, as text; null when it is not a loose date. */
  function looseYear(raw, now) {
    var t = ' ' + norm(raw) + ' ', y = (now || new Date()).getFullYear(), m, n;
    if ((m = /\b((?:19|20)\d\d)\b/.exec(t)) && !monthOf(t.split(' ').filter(function (w) { return monthOf(w); })[0] || '')) return m[1];
    if ((m = / two thousand(?: and)? ([a-z]+(?: [a-z]+)?) /.exec(t)) && (n = wordsToNumber(m[1])) != null && n > 0 && n < 100) return String(2000 + n);
    if ((m = / (nineteen|twenty) ((?:oh |zero )?[a-z]+(?: [a-z]+)?) /.exec(t)) && (n = wordsToNumber(m[2].replace(/^(?:oh|zero) /, ''))) != null && n >= 0 && n < 100 && !/hundred|thousand/.test(m[2])) return String((m[1] === 'nineteen' ? 1900 : 2000) + n);   // "twenty twenty three"
    if (/ last year /.test(t)) return String(y - 1);
    if (/ this year /.test(t)) return String(y);
    if ((m = / (?:about |around |roughly |maybe |nearly |almost |over |more than |just over )?(\w+(?: \w+)?) (years?|months?) (?:ago|back) /.exec(t))) {
      n = /^\d+$/.test(m[1]) ? +m[1] : wordsToNumber(m[1]);
      if (n != null && n >= 0 && n <= 80) return String(/^month/.test(m[2]) ? new Date(y, (now || new Date()).getMonth() - n, 1).getFullYear() : y - n);
    }
    return null;
  }
  var PHONE_IDS = ['cell', 'work', 'home', 'sp_tel'];
  var EMAIL_IDS = ['pemail', 'wemail'];
  var DIGIT_IDS = ['idno', 'tax'];
  var TYPED_IDS = PHONE_IDS.concat(EMAIL_IDS, DIGIT_IDS, DATE_IDS);
  var PCT_IDS = ['d_desk', 'd_supo', 'd_trav', 'd_sups', 'd_light', 'd_mod', 'd_heavy', 'biz_pct'];

  /* Names in brackets in a label ("Short-term (Cameron)") are things people say; units and notes ("(R)", "(today's terms)") are not. */
  var BRACKET_SKIP = { r: 1, p: 1, m: 1, pm: 1, today: 1, todays: 1, terms: 1, if: 1, per: 1, month: 1, year: 1, optional: 1 };
  function bracketWords(label) {
    var m = (String(label).match(/\(([^)]*)\)/g) || []).filter(function (b) { return /^\(\s*[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?\s*\)$/.test(b); });   // "(Cameron)", "(Capital Legacy)"; not "(if the bank is not in the list)"
    return content(m.join(' ')).filter(function (w) { return !BRACKET_SKIP[w]; });
  }
  /* A box in a list behaves like the same kind of box elsewhere: a child's name is a name, a partner's cell is a phone number. */
  var LIST_VID = { 'kids.name': 'sp_name', 'kids.sname': 'sname', 'shares.name': 'sp_name', 'kids.dob': 'dob', 'shares.cell': 'cell', 'shares.id': 'idno', 'shares.pct': 'biz_pct' };
  function vid(f) { return f.vid || f.id; }
  /* The words that say which list is meant ("the child's date of birth", "the loan balance", "the second policy"). */
  var LIST_NOUNS = {
    kids: ['child', 'children', 'kid', 'kids', 'son', 'sons', 'daughter', 'daughters', 'dependant', 'dependants', 'dependent', 'dependents'],
    debts: ['debt', 'debts', 'loan', 'loans', 'bond', 'bonds', 'mortgage', 'home loan', 'credit card', 'vehicle finance', 'car finance', 'car loan', 'overdraft', 'liability', 'liabilities', 'finance'],
    grp: ['group policy', 'group policies', 'group risk policy', 'group risk policies', 'group cover policy', 'group life policy', 'group risk cover policy'],
    risk: ['policy', 'policies', 'risk policy', 'risk policies', 'life policy', 'life policies', 'existing cover', 'existing policy', 'existing policies'],
    ret: ['retirement fund', 'retirement funds', 'pension', 'pensions', 'pension fund', 'provident', 'provident fund', 'retirement annuity', 'retirement annuities', 'retirement product'],
    inv: ['investment', 'investments', 'unit trust', 'unit trusts', 'tax free', 'tax free investment', 'endowment', 'endowments'],
    shares: ['partner', 'partners', 'shareholder', 'shareholders', 'co owner', 'co owners', 'co director', 'co directors'],
    redq: ['reduced quote', 'reduced quotes'],
    raq: ['ra quote', 'ra quotes', 'retirement annuity quote', 'retirement annuity quotes'],
    invq: ['investment quote', 'investment quotes']
  };
  var LIST_NOUNS_N = {};
  Object.keys(LIST_NOUNS).forEach(function (k) { LIST_NOUNS_N[k] = LIST_NOUNS[k].map(function (p) { return norm(p); }); });
  /* -> { listKey: wordsMatched } for the list(s) whose noun is longest in the text ("investment quote" beats "investment"). */
  function listsNamed(tn) {
    var found = {}, max = 0;
    Object.keys(LIST_NOUNS_N).forEach(function (k) {
      LIST_NOUNS_N[k].forEach(function (p) { if (has(tn, p)) { var n = p.split(' ').length; if (n > (found[k] || 0)) found[k] = n; if (n > max) max = n; } });
    });
    Object.keys(found).forEach(function (k) { if (found[k] < max) delete found[k]; });
    return found;
  }
  /* A list of the fields voice can fill and the sections it can open. */
  function buildIndex(schema) {
    var sections = schema.sections.map(function (s) { return { id: s.id, title: s.title, adv: !!s.adv, cond: s.cond }; });
    var fields = [], byId = {}, notes = [], noteById = {};
    schema.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b, bi) {
        (b.fields || []).forEach(function (f) {
          if (f.opt && f.t === 'area' && !f.lookup) {            // a notes box: not asked about, but "let me take some notes" goes there (a box with a look-up button is not one)
            var ne = { id: f.id, label: f.l, sec: sec.id, blk: bi, blkTitle: b.title || '', cond: b.cond, secCond: sec.cond, t: 'area', options: null, notes: true, lt: [] };
            notes.push(ne); noteById[f.id] = ne; return;
          }
          if (f.calc || f.opt || (f.preset && !f.voice)) return;
          var e = { id: f.id, label: f.l, sec: sec.id, blk: bi, blkTitle: b.title || '', cond: f.cond ? (b.cond ? { all: [b.cond, f.cond] } : f.cond) : b.cond, secCond: sec.cond, t: f.t === 'area' ? 'area' : (f.o ? 'sel' : 'txt'), options: f.o || null, free: !!f.free, money: !!f.money, none: !!f.none, lt: content(String(f.l).replace(/\([^)]*\)/g, ' ')), lx: bracketWords(f.l), bt: content(b.title || ''), order: fields.length };
          fields.push(e); byId[f.id] = e;
        });
      });
    });
    var lists = {};
    schema.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b, bi) {
        if (!b.list) return;
        var L = schema.lists[b.list];
        lists[b.list] = { key: b.list, title: L.title, add: L.add, cards: !!L.cards, sec: sec.id, blk: bi, cond: b.cond, secCond: sec.cond, first: L.cols[0].k, cols: [] };
        L.cols.forEach(function (c) {
          if (c.calc) return;
          var id = b.list + '.' + c.k;
          var e = { id: id, list: b.list, k: c.k, label: c.l, sec: sec.id, blk: bi, blkTitle: b.title || '', cond: b.cond, secCond: sec.cond, t: c.t === 'area' ? 'area' : (c.o ? 'sel' : 'txt'),
            options: c.o || null, free: !!c.free, money: !!c.money, date: !!c.date, none: false, vid: LIST_VID[id] || null, lt: content(String(c.l).replace(/\([^)]*\)/g, ' ')), lx: bracketWords(c.l), bt: content(L.title), order: fields.length };
          fields.push(e); byId[id] = e; lists[b.list].cols.push(id);
        });
      });
    });
    Object.keys(lists).forEach(function (k) { if (!SECTION_LISTS[lists[k].sec]) SECTION_LISTS[lists[k].sec] = k; });
    return { sections: sections, fields: fields, byId: byId, notes: notes, noteById: noteById, lists: lists };
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

  /* "let me take some notes", "note that down", "I'll make a note": the glow moves to the section's notes box and what follows is noted in point form. */
  var NOTES_ON = /\b(?:(?:let me|let's|lets|let us|i'll|i will|i'm going to|im going to|i am going to|i want to|i wanted to|i need to|i'd like to|id like to|i would like to|we'd like to|we want to|we need to|we're going to|going to|can i|could i|can we|could we|just|quickly|now)\s+(?:just\s+)?(?:take|make|jot|write|add|put|do|start|record|capture|log)\s+(?:down\s+)?(?:a\s+|some\s+|a few\s+|a quick\s+|a couple of\s+)?(?:quick\s+)?notes?|notes? (?:on|about|for) (?:that|this)|(?:for|in|to|into) the notes)\b|^(?:please\s+)?(?:take|make|add|put|jot|start)\s+(?:a\s+|some\s+)?notes?\b|^(?:(?:go to|open|show|move to)\s+)?(?:the\s+)?(?:[a-z]+\s+){0,3}notes(?:\s+box)?$/;
  var NOTES_RETRO = /\b(?:(?:note|write|jot|put|log|record|capture)\s+(?:that|this|it)\s+(?:down|in|into|to)|make a note of (?:that|this)|note (?:that|this) down|note that|note this)\b/;
  /* "let's move on", "okay, we can move on", "time to carry on": the same as "next". While notes are being taken it also ends them. */
  var NEXT_ON = /^(?:(?:okay|ok|right|so|alright|now|well|please|and)\s+)*(?:(?:lets|let us|we can|we should|we could|time to)\s+)?(?:move on|carry on)(?:\s+(?:then|now|please))?$/;
  var ADD_ROW = /\b(?:add|another|one more|a new|new|next|additional|a second|a third|the other)\b/;
  var NOTES_OFF = /^(?:that(?:'s|s| is)? all (?:for|the) (?:the )?notes|that(?:'s|s| is)? it for the notes|end (?:of )?(?:the )?notes|stop (?:the |taking )?notes|no more notes|done with (?:the )?notes|finished with (?:the )?notes|close (?:the )?notes|back to the (?:form|questions))\b/;
  /* Ending the notes can be said many ways ("let's end the notes", "I'm done with the notes", "that's enough notes", "okay, back to the form"): a short line that opens like a wrap-up, names the notes and says they are over. */
  var NOTES_END_LEAD = /^(?:(?:okay|ok|right|so|and|alright|now|well|yes|yeah|please)\s+)*(?:lets|let us|let me|i'm|i am|i'll|i will|we're|we are|we'll|we will|we can|you can|that|this|it|stop|end|finish|finished|done|enough|no more|close|quit)\b/;
  var NOTES_END_WORD = /\b(?:end|ended|stop|finish|finished|done|enough|close|quit|over|complete|completed|no more|that all|that it|that the end)\b/;
  var NOTES_BACK = /^(?:(?:okay|ok|right|so|and|alright|now|well|please|lets|let us|go|get|come)\s+)*back to (?:the )?(?:form|questions?|fact find)\b/;
  function endsNotes(t) {
    return NOTES_BACK.test(t) || /^notes (?:are |is )?(?:done|finished|over|complete|completed)$/.test(t) ||
      (t.split(' ').length <= 9 && /\bnotes?\b/.test(t) && NOTES_END_LEAD.test(t) && NOTES_END_WORD.test(t) && !/\b(?:take|make|write|jot|add|start|begin|new)\b/.test(t));
  }
  /* "remove them all", "delete everything on the form", "wipe the entire form", "start again from scratch": the whole form, not one box. */
  var WIPE_VERB = '(?:remove|delete|clear|wipe|erase|empty|reset|scrap|get rid of|throw away)';
  var WIPE_ALL = new RegExp('\\b' + WIPE_VERB + '\\s+(?:(?:all|every)\\s+(?:of\\s+)?)?(?:(?:the|my|his|her|their|these|those|our)\\s+)?(?:(?:entire|whole|full)\\s+)?' +
    '(?:everything|form|fact find|details|data|answers|information|info|entries|fields|boxes|them all|it all|all of it|all)(?:\\s+(?:on|from|in|of)\\s+(?:the|this)\\s+(?:(?:entire|whole|full)\\s+)?(?:form|fact find))?(?:\\s+(?:clean|out))?(?:\\s+(?:please|now|again))?$');
  var WIPE_NOT = new RegExp('\\b(?:dont|don\'t|do not|never|not to|no need to|without)\\s+(?:\\w+\\s+){0,2}' + WIPE_VERB + '\\b');
  var WIPE_START = /\bstart (?:again|over) (?:from )?(?:scratch|the beginning)\b|\bstart (?:with )?a (?:blank|fresh|clean) form\b/;
  function wipeAsked(t) { return !WIPE_NOT.test(t) && (WIPE_ALL.test(t) || WIPE_START.test(t)); }
  /* The answer to "Delete all data from the entire form?": 'yes', 'no', or null when it is neither (then nothing happens).
     Only a plain yes counts: repeating the request ("delete everything") is not a yes. */
  function wipeAnswer(text) {
    var t = norm(text), w = t ? t.split(' ') : [];
    if (!t || w.length > 8) return null;
    var no = /^(?:(?:oh|ok|okay|actually|please|sorry|hmm|um|uh)\s+)*(?:no|nope|nah|cancel|stop|wait|dont|don't|do not|keep|leave|never mind|nevermind|hang on|hold on|not yet|abort|forget it|negative|undo|scratch that)\b/.test(t);
    if (no) return 'no';
    var yes = /^(?:(?:oh|ok|okay|please|um|uh)\s+)*(?:yes|yeah|yep|yup|yip|sure|correct|confirm|confirmed|absolutely|definitely|affirmative|do it|go ahead|im sure|i'm sure|i am sure)\b/.test(t);
    return yes && !/\b(?:no|not|dont|don't|cancel|keep|except|but|wait|stop|only)\b/.test(t) ? 'yes' : null;
  }
  /* -> { type: 'goto', sec } | next | prev | nextSection | prevSection | undo | clear | clearAll | notes | notesOff, or null when it is not a command. */
  function parseCommand(text, idx) {
    var t = norm(text);
    if (!t) return null;
    if (wipeAsked(t)) return { type: 'clearAll' };
    if (/\b(scratch that|undo that|undo|never mind|nevermind|ignore that|cancel that|forget that)\b/.test(t)) return { type: 'undo' };
    if (/^(clear that|clear this|clear it|delete that|empty that)$/.test(t)) return { type: 'clear' };
    if (NOTES_OFF.test(t) || endsNotes(t)) return { type: 'notesOff' };
    if (!/^(?:what|who|where|when|why|how|which)\b/.test(t) && !/\?$/.test(String(text).trim())) {          // "add another child", "one more policy", "another one"
      var ln = listsNamed(t), lk = Object.keys(ln)[0] || null;
      if ((lk && ADD_ROW.test(t)) || (!lk && /^(?:(?:and|okay|ok|now|please)\s+)*(?:add\s+)?(?:another(?:\s+one)?|one more|a new one|add one|add another(?:\s+one)?|add a row|next one please)$/.test(t))) return { type: 'addrow', list: lk };
    }
    if (NOTES_ON.test(t) || NOTES_RETRO.test(t)) {
      var box = null;
      (idx && idx.notes || []).forEach(function (n) {           // "notes on the will", "medical aid notes"
        var w = norm(n.blkTitle).split(' ').filter(function (x) { return x.length > 2 && x !== 'the'; });
        if (w.length && w.every(function (x) { return t.indexOf(x) >= 0; })) box = n.id;
      });
      return { type: 'notes', retro: NOTES_RETRO.test(t) && /\b(that|this|it)\b/.test(t), box: box };
    }
    if (/^(next section|go to the next section|move on to the next section|next screen)$/.test(t)) return { type: 'nextSection' };
    if (/^(previous section|go to the previous section|go back a section|previous screen)$/.test(t)) return { type: 'prevSection' };
    if (/^(next|next one|next question|skip|skip that|skip this one|skip it|move on|carry on)$/.test(t) || NEXT_ON.test(t)) return { type: 'next' };
    if (/^(previous|previous one|go back|back|previous question)$/.test(t)) return { type: 'prev' };
    var m = NAV_RE.exec(t);
    if (m) {
      var sec = sectionIn(t.slice(m.index + m[0].length), idx);
      if (sec) return { type: 'goto', sec: sec };
    }
    var bare = t.replace(/\b(the|section|screen|page|please|ok|okay|now|lets|go)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (bare && bare.split(' ').length <= 4 && isSectionName(bare, idx)) return { type: 'goto', sec: sectionIn(bare, idx), bare: true };
    return null;
  }

  /* ---------- what the advisor says: a question points at a field ---------- */
  function scoreField(f, textNorm, textToks) {
    var best = 0, al = ALIASES_N[f.id] || [], i;
    for (i = 0; i < al.length; i++) if (has(textNorm, al[i].p)) best = Math.max(best, 3 + al[i].n);
    if (f.lt.length) {
      var hit = 0;
      f.lt.forEach(function (w) { if (textToks.indexOf(w) >= 0 || textToks.indexOf(w.replace(/s$/, '')) >= 0 || textToks.indexOf(w + 's') >= 0) hit++; });
      if (hit) best = Math.max(best, hit === f.lt.length && f.lt.length >= 2 ? 3 + f.lt.length : 2 * hit / f.lt.length + (hit === f.lt.length ? 0.5 : 0));
    }
    if (f.lx && f.lx.some(function (w) { return textToks.indexOf(w) >= 0; })) best = Math.max(best, 4);
    return best;
  }
  /* opts: { cur: current section id, isEmpty(id) } -> { id, score } or null. */
  function matchQuestion(text, idx, opts) {
    opts = opts || {};
    var tn = norm(text), tk = tn ? tn.split(' ') : [], best = null, named = listsNamed(tn);
    if (!tn) return null;
    idx.fields.forEach(function (f) {
      var s = scoreField(f, tn, tk);
      if (f.list && s > 0) { if (opts.boost && opts.boost[f.list]) s += 2; if (named[f.list]) s += 2; else if (/\b(?:your|my)\b/.test(tn)) s -= 1.5; }   // "the child's name" is the list; "your name" is the client
      if (s < 2) return;
      var total = s + (f.sec === opts.cur ? 1.5 : 0) + (!opts.isEmpty || opts.isEmpty(f.id) ? 0.4 : 0) + (f.bt && f.bt.some(function (w) { return tk.indexOf(w) >= 0; }) ? 1 : 0);
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
  /* A correction in the same breath: "082 454 1750, no sorry, it is 083 454 1751" means the last one. Only clear markers count. */
  var CORRECT = /(?:^|[\s,.;:])(?:no(?:[,.\s]+no)?[,.\s]+(?:sorry|wait|i mean|make that|it(?:'s| is)|that(?:'s| is))|sorry|oops|i mean|make that|correction|my mistake|my bad|scratch that|hang on|let me correct|that(?:'s| is) (?:wrong|not right|incorrect))(?=[\s,.;:]|$)[,.;:\s]*(?:(?:it(?:'s| is| was)?|that(?:'s| is)?|should be|the (?:number|correct (?:one|number)) is)\s+)?/gi;
  function afterCorrection(raw) {
    var s = String(raw), m, last = null;
    CORRECT.lastIndex = 0;
    while ((m = CORRECT.exec(s))) { last = m; if (!m[0]) CORRECT.lastIndex++; }
    var rest = last ? s.slice(last.index + last[0].length).trim() : '';
    return rest ? rest : s;
  }
  /* Two whole numbers said one after the other (a correction without a marker): the last one counts. */
  function lastOf(digits, n) { return digits.length === 2 * n ? digits.slice(n) : digits; }
  var LEAD_NAME = /^(?:my (?:first |full |sur)?name is |my (?:first |sur)?name's |i am |i'm |it's |it is |that's |that is |the name is |name is |it's called |called |surname is |first name is |my surname is |this is )/i;
  var LEAD_COMPANY = /^(?:i (?:currently )?(?:work|am working|'m working|am employed|'m employed)\s+(?:at|for|with|in)\s+|i'?m (?:at|with|employed (?:at|by|with))\s+|i am (?:at|with|employed (?:at|by|with))\s+|it'?s |it is |the company is |company is |we are |for |at |with |it's called |called |the name is |name is |my company is |my employer is |employer is )/i;
  var LEAD_OCC = /^(?:i(?:'m| am) (?:now |currently |still |just )?(?:a |an |the )?|i work as (?:a |an |the )?|i'm working as (?:a |an |the )?|my (?:job|occupation|role|position|title) is (?:a |an |the )?|i do |i'm doing |i am doing |it's |it is )/i;
  /* The words around an answer are not part of it: "my second name my surname is Snow" means Snow. A leading run of such words (possessives,
     "is", "called", the box's own name) is dropped when it holds a marker word; if nothing is left, no answer has been given yet. */
  var NAMEVOC = ['name', 'names', 'first', 'second', 'last', 'sur', 'surname', 'family', 'given', 'christian', 'full'];
  var GENVOC = ['my', 'your', 'his', 'her', 'their', 'our', 'the', 'is', 'are', 'was', 'were', "it's", 'its', "that's", 'thats', 'it', 'that', 'called', 'named', 'um', 'uh', 'er', 'oh', 'well', 'so', 'and', 'but', 'okay', 'ok', 'yes', 'yeah', 'no', 'right', 'actually', 'then', 'now'];
  var MARKERS = ['is', 'are', 'was', 'were', "it's", "that's", 'thats', 'called', 'named'];
  function stripLead(f, s) {
    var isName = NAME_IDS.indexOf(vid(f)) >= 0, own = norm(f.label || '').split(' ').filter(Boolean);
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
    if (NAME_IDS.indexOf(vid(f)) >= 0) {
      var t = c.split(/\s+/);
      if (t.length > 5 || !/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(c)) return false;
      return !t.some(function (w) { w = w.toLowerCase().replace(/[.,]+$/, ''); return GENVOC.indexOf(w) >= 0 || NAMEVOC.indexOf(w) >= 0 || w === 'i' || w === "i'm" || w === 'am'; });
    }
    return true;
  }
  function cleanText(f, raw) {
    var s = stripLead(f, String(raw).trim().replace(FILLER, '').trim()).trim();
    var id = vid(f);
    if (NAME_IDS.indexOf(id) >= 0) s = s.replace(LEAD_NAME, '');
    else if (COMPANY_IDS.indexOf(id) >= 0) s = s.replace(LEAD_COMPANY, '');
    else if (OCC_IDS.indexOf(id) >= 0) s = s.replace(LEAD_OCC, '');
    return s.replace(/[\s,;.!?]+$/, '').replace(/\s+(?:now|at the moment|currently)$/i, '').trim();
  }
  var ok = function (v) { return { value: v, status: 'heard' }; };

  /* Per-field rules where plain option matching is not enough. Return an option, an object, or null to fall through. */
  var EX_PARTNER = / (?:ex|former|previous|late ex) (?:spouse|wife|husband|partner|girlfriend|boyfriend|fiance|fiancee|man|woman)s? | (?:ex spouse|ex wife|ex husband|ex partner|exwife|exhusband|expartner)s? | ex spouse partner /;
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
      var s = ' ' + t + ' ', saWord = / (south african|south africa|saffer|sa|local) /.test(s);
      var notSa = / (not|isn't|never) (a |from )?(south african|south africa|saffer|sa) /.test(s) || / (am not|aren't|i'm not) /.test(s);
      if (saWord && !notSa) return 'South African';
      /* "no, I'm Zimbabwean", "I'm not South African, I'm British", "from Namibia": what is left after the lead-in is the nationality */
      var tail = String(raw).replace(FILLER, '').replace(/^(?:(?:no|nope|nah|actually|not really|well|oh|sorry|um+|uh+)[,.\s]+)+/i, '').split(/[,;]|\bbut\b/i).pop();
      var c = tail.replace(/^\s*(?:i(?:'m| am) (?:a |an )?|it'?s |it is |from |i come from |i was born in |my nationality is |nationality is |citizen of |a |an )/i, '').replace(/[\s,;.!?]+$/, '').trim();
      c = c.replace(/\s+(?:citizen|national|by birth)$/i, '');
      if (/^(?:yes|yeah|yep|yup|ja|correct|right|sure|definitely)$/i.test(c)) c = '';
      if (/^not\b/i.test(c)) return { error: 'ambiguous', note: 'not South African: which nationality?' };
      if (!c) return yesNo(t) === 'yes' ? 'South African' : null;
      if (/^(?:south african|south africa|saffer|sa)$/i.test(c)) return 'South African';
      return { value: 'Other', status: 'heard', extra: [{ id: 'nat_other', value: titleCase(c), status: 'verify' }] };
    },
    idtype: function (t) {
      var s = ' ' + t + ' ', hasId = / (id|identity|id book|id card|smart card|green id|identity document) /.test(s), hasPass = / passport /.test(s);
      var noId = / (no|not|don't have|dont have|do not have|haven't got|havent got|have not got|without|lost my|never had) (an |a |my |any |the |got )?(sa |south african )?(id|identity)/.test(s);
      var noPass = / (no|not|don't have|dont have|do not have|haven't got|havent got|have not got|without) (an |a |my |any |the |got )?passport/.test(s);
      if (hasPass && (!hasId || noId) && !noPass) return 'Passport';
      if (hasId && !noId) return 'ID';
      if (noId) return 'Passport';
      var yn = yesNo(t); return yn === 'yes' ? 'ID' : yn === 'no' ? 'Passport' : null;
    },
    'kids.gender': function (t) {
      var s = ' ' + t + ' ';
      if (/ (girl|daughter|female|she|her|lady) /.test(s)) return 'Female';
      if (/ (boy|son|male|he|him|his) /.test(s)) return 'Male';
      return null;
    },
    gender: function (t) {                                                                  // the client's own gender
      var s = ' ' + t + ' ';
      if (/ (female|woman|lady) /.test(s)) return 'Female';
      if (/ (male|man|gentleman) /.test(s)) return 'Male';
      return null;
    },
    'debts.owner': function (t) { return EX_PARTNER.test(' ' + t + ' ') ? 'Ex-Spouse/Partner' : null; },        // "my ex-wife", "his former husband": a plain "spouse" still means the current one
    'debts.payer': function (t) { return EX_PARTNER.test(' ' + t + ' ') ? 'Ex-Spouse/Partner' : null; },
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

  /* Type of quote: "it's new business", "servicing", "not applicable" / "N/A". */
  ['fna_type', 'sf_type', 'redq.type'].forEach(function (id) {
    SPECIAL[id] = function (t, raw) {
      var s = ' ' + t + ' ', r = ' ' + String(raw || '').toLowerCase() + ' ';
      var nb = / (new business|new policy|new quote|new) /.test(s), sv = / (servicing|serviced|service) /.test(s), na = / (n a|na|not applicable|none) /.test(s) || /\bn\s*\/\s*a\b/.test(r);
      if (nb + sv + na > 1) return { error: 'ambiguous', note: 'new business, servicing or N/A?' };
      return nb ? 'New Business' : sv ? 'Servicing' : na ? 'N/A' : null;
    };
  });

  /* Client priorities: a plain "yes", "definitely", "go ahead" makes the area a priority; "not now", "not interested", "I can't afford it", "I already have that" make it not a priority. */
  var PRI_NO = / (not interested|not a priority|not priority|not now|no thanks|no thank you|not at the moment|not at this stage|not for now|not right now|cannot afford|can not afford|cant afford|can t afford|already have|already covered|dont need|do not need|don t need|not needed|no need|rather not|not necessary|no) /;
  var PRI_YES = / (yes|yeah|yep|yup|ja|definitely|absolutely|certainly|agree|agreed|please do|go ahead|sounds good|makes sense|sure|priority|of course) /;
  ['pr_life', 'pr_ra', 'pr_rgar', 'pr_inv', 'pr_egar', 'pr_med', 'pr_will', 'pr_st'].forEach(function (id) {
    SPECIAL[id] = function (t) {
      var s = ' ' + t + ' ', unsure = / (not sure|unsure|maybe|perhaps|don t know|do not know) /.test(s), no = PRI_NO.test(s), yes = PRI_YES.test(s.replace(/ not (?:a )?priority /g, ' ').replace(/ (?:not sure|unsure) /g, ' '));
      if (no && yes) return { error: 'ambiguous', note: 'priority or not a priority?' };
      if (unsure && !no) return { error: 'unsure', note: 'not sure: left empty' };
      return no ? 'Not a priority: client not interested' : yes ? 'Priority: client agrees' : null;
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
    var id = vid(f);
    if (TYPED_IDS.indexOf(id) >= 0 || NAME_IDS.indexOf(id) >= 0 || f.date) raw = afterCorrection(raw);      // "011 555 1234, no sorry, 011 555 4321" is the last number, not a "no"
    var t = norm(raw);
    if (!t) return null;
    if (f.none && yesNo(t) === 'no') return ok('None');
    if (f.options) return pickOption(f, t, raw);
    if (f.money) {
      var amt = wordsToNumber(raw);
      return amt == null ? { error: 'no-number' } : { value: util.formatMoney(String(amt)), status: 'verify' };
    }
    if (DATE_IDS.indexOf(id) >= 0 || f.date) {
      var d = spokenDate(raw);
      if (!d && APPROX_DATE_IDS.indexOf(id) >= 0) { var yr = looseYear(raw); if (yr) return { value: yr, status: 'verify' }; }       // a year is what the client remembers
      return d ? { value: d, status: 'verify' } : { error: 'no-date' };
    }
    if (EMAIL_IDS.indexOf(id) >= 0) {
      var em = spokenEmail(raw);
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? { value: em, status: 'verify' } : { error: 'no-email', note: 'heard "' + em + '"' };
    }
    if (PHONE_IDS.indexOf(id) >= 0) {
      var ph = lastOf(spokenDigits(raw), 10);
      return ph ? { value: formatPhone(ph), status: 'verify', note: ph.length < 10 ? 'only ' + ph.length + ' digits heard' : (ph.length > 10 && !/^27\d{9}$/.test(ph) ? ph.length + ' digits heard, a number has 10' : '') } : { error: 'no-digits' };
    }
    if (id === 'idno') {            // a passport number has letters; an ID number never does
      var pp = spokenPassport(raw);
      if (pp) return { value: pp, status: 'verify', extra: [{ id: 'idtype', value: 'Passport', status: 'heard' }] };
    }
    if (DIGIT_IDS.indexOf(id) >= 0) {
      var dg = lastOf(spokenDigits(raw), id === 'idno' ? 13 : 10);
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
  var NEGATE_HAVE = /\b(?:(?:don'?t|do not|dont|doesn'?t|haven'?t|have not|havent|hasn'?t|never)\s+(?:have|had|got|use)|have no|got no|no|without|none|not got|neither|nor)\b/i;
  var TYPED = TYPED_IDS;
  var ALL_NOUNS = (function () { var a = []; Object.keys(LIST_NOUNS).forEach(function (k) { LIST_NOUNS[k].forEach(function (n) { a.push(n.replace(/\s+/g, '\\s+')); }); }); return a.sort(function (x, y) { return y.length - x.length; }).join('|'); })();
  var SPLIT_ITEMS = new RegExp('\\s+(?:and|plus|also|then)\\s+(?=(?:a|an|another|one more)\\s+(?:[a-z]+\\s+){0,2}?(?:' + ALL_NOUNS + ')\\b)', 'gi');
  var LEAD_ONLY = /^(?:oh|well|okay|ok|so|and|but|um+|uh+|yes|yeah|no|right|sorry|actually|ja|then|now|hi|hello)[,.!]*$/i;
  function clauses(text) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    t = t.replace(SPLIT_ITEMS, '\x01');                                  // two items in one breath: "a home loan ... and a car loan ..."
    t = t.replace(/([.?!])\s+/g, '$1\x01').replace(/\s+(?:and|but|so)\s+(?=(?:your|my|his|her|their|i|i'm|i've|we|he|she|they|it's|that's|there's)\b)/gi, '\x01');
    t = t.replace(/([^\s,;\x01]*)[,;]\s*(?=(?:my|your|his|her|their|our)\s+(?:[a-z']+\s+){1,4}?(?:is|are|was|were)\b)/gi, function (m, w) { return LEAD_ONLY.test(w) ? m : w + '\x01'; });   // "my name is John Snow, my ID is ..."
    t = t.replace(/(?:[,;]\s*(?:and\s+)?|\s+and\s+)(?=(?:born|id|identity|cell|mobile|email|e-?mail|tax|passport|work number|home number)\b)/gi, '\x01');   // "John Snow, born 9 December 1972, ID 7212..."
    t = t.replace(/\s+(?:and|but)\s+(?=(?:no|neither|without)\s+(?!sorry\b|wait\b|it\b|that\b)|(?:don'?t|do not|dont|haven'?t)\s+have\b)|[,;]\s*(?=no\s+(?:home|work|personal|private|landline|email|e-?mail|phone|telephone)\b)/gi, '\x01');   // "my work number is 011 555 1234 and no home number"
    var first = /\b(?:is|are|was|were|have|has|had|got|no|not|don't|dont|haven't|neither)\b/i.exec(t);
    if (first) t = t.slice(0, first.index + first[0].length) + t.slice(first.index + first[0].length).replace(/(\S+)\s+(?=(?:my|your|his|her|their|our)\s+(?:[a-z']+\s+){1,3}?(?:is|are|was|were)\s)/gi, function (m, w) { return LEAD_ONLY.test(w.split('\x01').pop()) ? m : w + '\x01'; });   // no punctuation at all: "my name is John Snow my ID is ..."
    return t.split('\x01').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  /* A long free-text answer may hold several facts, so Claude reads it; dates, numbers, phone numbers and lists of options are read precisely here. */
  function isFreeText(f) { return !!f && f.t === 'txt' && !f.options && !f.money && TYPED.indexOf(vid(f)) < 0 && PCT_IDS.indexOf(vid(f)) < 0 && vid(f) !== 'years'; }
  /* What a sentence that introduces a row says about it: "a home loan with ABSA bank" -> type Home loan, provider ABSA; "a daughter called Thandi, born
     22 August 2019" -> name, gender, date of birth. Only what is clear is taken; leftover says how many words were not understood, so Claude can read the rest. */
  var INTERVIEW = { debts: ['type', 'prov', 'desc', 'inst', 'bal'], risk: ['prov', 'spend', 'broker'], grp: ['prov', 'spend', 'broker'], ret: ['type', 'prov', 'val', 'contrib'], inv: ['type', 'prov', 'val', 'prem'],
    kids: ['name', 'sname', 'gender', 'dob', 'cost'], shares: ['name', 'pct'], redq: ['req', 'ins', 'amt'], raq: ['req', 'ins', 'monthly', 'lump'], invq: ['purpose', 'product', 'ins', 'monthly', 'lump'] };
  var ROW_COLS = { debts: ['type', 'prov'], risk: ['prov'], grp: ['prov'], ret: ['type', 'prov'], inv: ['type', 'prov'] };
  var ROW_SYN = {
    'debts.type': { 'Home loan': ['bond', 'mortgage', 'house loan', 'home bond', 'property loan'], 'Vehicle finance': ['car finance', 'vehicle loan', 'car loan', 'car payment', 'vehicle'], 'Credit card': ['card'], 'Revolving credit': ['overdraft', 'revolving'] },
    'ret.type': { 'Retirement annuity': ['ra', 'retirement annuity'], 'Pension fund': ['pension'], 'Provident fund': ['provident'] },
    'inv.type': { 'Unit trust': ['unit trusts'], 'Tax-free savings': ['tax free', 'tax free investment', 'tfsa', 'tax free savings account'], 'Endowment': ['endowments'], 'Offshore': ['offshore investment'], 'Share portfolio': ['shares', 'share portfolio'], 'Living annuity': ['la'] }
  };
  var MONEY_CUES = {
    debts: [['bal', /\b(?:outstanding|balance|owe|owing)\b/], ['inst', /\b(?:instal?ments?|repayments?|a month|per month|monthly|pm)\b/], ['asset', /\b(?:worth|asset)\b/]],
    risk: [['spend', /\b(?:month|premium|paying|pay)\b/]], grp: [['spend', /\b(?:month|premium|paying|pay)\b/]], ret: [['contrib', /\b(?:month|contribut\w*)\b/], ['val', /\b(?:worth|value|balance|in it)\b/]],
    inv: [['prem', /\b(?:month|premium|invest)\b/], ['val', /\b(?:worth|value|balance)\b/]], kids: [['cost', /\b(?:month|fees|cost|costs)\b/]]
  };
  var GENERIC_WORD = { bank: 1, finance: 1, loan: 1, loans: 1, card: 1, account: 1, policy: 1, policies: 1, fund: 1, funds: 1, limited: 1, ltd: 1, group: 1, life: 1, cover: 1, insurance: 1, with: 1, invest: 1, investment: 1, investments: 1, named: 1, called: 1, born: 1, month: 1, months: 1, per: 1, paying: 1, pay: 1, rand: 1, r: 1 };
  function rowFacts(idx, key, core) {
    var tn = norm(core), vals = {}, used = {}, toks = tn.split(' ');
    function use(phrase) { norm(phrase).split(' ').forEach(function (w) { used[w] = 1; }); }
    (ROW_COLS[key] || []).forEach(function (k) {                          // a choice named in the sentence: the type, the bank or insurer
      var e = idx.byId[key + '.' + k], best = null;
      if (!e || !e.options) return;
      e.options.forEach(function (o) {
        if (/^other$/i.test(o)) return;
        [o].concat((ROW_SYN[e.id] && ROW_SYN[e.id][o]) || []).forEach(function (ph) {
          var n = norm(ph), t0 = n.split(' ')[0], sc = 0, matched = n;
          if (has(tn, n)) sc = n.split(' ').length * 2;
          else if (t0.length >= 4 && !GENERIC_WORD[t0] && toks.indexOf(t0) >= 0) { sc = 1.5; matched = t0; }
          if (sc && (!best || sc > best.sc)) best = { sc: sc, value: o, phrase: matched };
        });
      });
      if (best) { vals[k] = { value: best.value, status: 'heard' }; use(best.phrase); }
    });
    if (ROW_COLS[key] && ROW_COLS[key].indexOf('prov') >= 0 && !vals.prov) {
      var pn = /\b(?:with|at|from)\s+([A-Z][\w&.'-]*(?:\s+(?:of|and|&)?\s*[A-Z][\w&.'-]*){0,3})/.exec(core), pe = idx.byId[key + '.prov'];
      if (pn && !/^(?:a|an|the|my|our)$/i.test(pn[1]) && !has(norm(pn[1]), 'bank loan')) {
        if (pe.free) vals.prov = { value: pn[1], status: 'verify' };
        else if (pe.options.indexOf('Other') >= 0 && idx.byId[key + '.prov_other']) { vals.prov = { value: 'Other', status: 'heard' }; vals.prov_other = { value: pn[1], status: 'verify' }; }
        if (vals.prov) use(pn[1]);
      }
    }
    if (key === 'kids') {
      var g = SPECIAL['kids.gender'](tn);
      if (g) { vals.gender = { value: g, status: 'heard' }; ['son', 'daughter', 'boy', 'girl'].forEach(use); }
      var nm = /\b(?:called|named|name is)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?)/.exec(core) || /\b(?:son|daughter|child|kid|boy|girl)\s*,?\s+([A-Z][a-z'-]+)/.exec(core);
      if (nm) { var sp = util.splitFullName(nm[1]); vals.name = { value: titleCase(sp.first), status: 'verify' }; if (sp.last) vals.sname = { value: titleCase(sp.last), status: 'verify' }; use(nm[1]); }       // "called Anna Kuiper": Anna, and Kuiper in Surname
      if (/\b(?:born|birthday)\b/.test(tn)) { var d = spokenDate(core); if (d) { vals.dob = { value: d, status: 'verify' }; toks.forEach(function (w) { if (/^\d/.test(w) || monthOf(w) || /^(?:st|nd|rd|th|of)$/.test(w)) used[w] = 1; }); } }
    }
    var amts = core.match(/\bR\s?\d[\d\s,]*(?:\.\d+)?/g) || [];            // one amount with a clear cue ("R4 200 a month") is taken; more than one is left to Claude
    if (amts.length === 1 && MONEY_CUES[key]) {
      MONEY_CUES[key].some(function (c) {
        var def = idx.byId[key + '.' + c[0]];
        if (!c[1].test(tn) || !def) return false;
        var x = interpret(def, amts[0]);
        if (x && !x.error) { vals[c[0]] = { value: x.value, status: 'verify' }; use(amts[0]); toks.forEach(function (w) { if (c[1].test(w) || /^\d+$/.test(w)) used[w] = 1; }); return true; }
        return false;
      });
    }
    var noun = {}; LIST_NOUNS_N[key].forEach(function (ph) { ph.split(' ').forEach(function (w) { noun[w] = 1; }); });
    var left = content(tn).filter(function (w) { return !used[w] && !noun[w] && !GENERIC_WORD[w] && !/^\d/.test(w) && !/^(?:one|two|three|four|five|six|seven|eight|nine|ten)$/.test(w); });
    return { vals: vals, leftover: left.length };
  }
  /* "I don't have a home number or a work number", "no work or home phone", "no landline and no work email": every box named gets its "No ..." tick.
     A word like work / home / personal belongs to the next word for phone or email (or the last one seen, when it is left out: "work or home number"). */
  var NONE_HEAD = { number: 'p', numbers: 'p', phone: 'p', phones: 'p', telephone: 'p', line: 'p', email: 'e', emails: 'e', mail: 'e', address: 'e' };
  var NONE_QUAL = { work: 'w', office: 'w', business: 'w', home: 'h', house: 'h', landline: 'h', personal: 'p', private: 'p', own: 'p' };
  function noneTargets(core) {
    var tk = norm(core).split(' '), out = [], heads = [], i, j, q, k, hd, quals = 0;
    tk.forEach(function (w, n) { if (NONE_HEAD[w]) heads.push(n); });
    function add(id) { if (out.indexOf(id) < 0) out.push(id); }
    for (i = 0; i < tk.length; i++) {
      q = NONE_QUAL[tk[i]];
      if (!q) continue;
      quals++;
      if (tk[i] === 'landline') { add('home'); continue; }
      hd = null;
      for (j = 0; j < heads.length; j++) if (heads[j] > i && heads[j] - i <= 4) { hd = NONE_HEAD[tk[heads[j]]]; break; }
      if (!hd) for (j = heads.length - 1; j >= 0; j--) if (heads[j] < i) { hd = NONE_HEAD[tk[heads[j]]]; break; }
      if (hd === 'p') { if (q === 'w') add('work'); else if (q === 'h') add('home'); }
      else if (hd === 'e') add(q === 'w' ? 'wemail' : 'pemail');
    }
    if (!quals && heads.some(function (n) { return NONE_HEAD[tk[n]] === 'e'; })) add('pemail');       // "I have no email address"
    return out;
  }
  /* A typed address, with the name in front of it when the dictation split it off ("Jonathan snow@discovery.co.ZA" is jonathansnow@discovery.co.za). */
  var EMAIL_LEAD = /^(?:is|are|it|its|it's|my|our|email|e-mail|mail|address|at|on|me|to|and|or|the|a|an|work|personal|private|office|business|use|using|via|send|sent|contact|reach|for|from)$/i;
  function typedEmail(core) {
    var m = /(?:^|\s)([A-Za-z][A-Za-z.-]*)\s+([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/.exec(core), plain = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(core);
    return m && !EMAIL_LEAD.test(m[1]) ? [m[1] + ' ' + m[2]] : plain;
  }
  var ORD_IDX = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 };
  var NO_WORDS = /^(?:no|none|nope|nah|nothing|not any|zero|we don'?t|i don'?t|don'?t have any)\b/i;
  function rowName(d) { return d ? String(d.name || d.desc || '') : ''; }
  function plan(text, idx, st) {
    st = st || {};
    var actions = [], sure = true, target = st.target || null, answered = !!st.answered, noting = !!st.noting, selfAsk = false;   // selfAsk: the page itself moved to the next box, nobody asked it
    var visible = st.visible || function () { return true; }, valueOf0 = st.value || function () { return ''; };
    /* Boxes in a list belong to a row, so they are named list:row:column (kids:0:dob). Rows the line itself adds are counted as it goes. */
    var lc = {};
    function Ls(key) {
      if (!lc[key]) { var rows = st.rows ? st.rows(key).slice() : [], cur = st.curRow && st.curRow[key] != null && st.curRow[key] < rows.length ? st.curRow[key] : (rows.length ? rows.length - 1 : -1); lc[key] = { n: rows.length, rows: rows, cur: cur }; }
      return lc[key];
    }
    function cellParts(id) { var m = /^(\w+):(\d+):(\w+)$/.exec(String(id)); return m ? { list: m[1], i: +m[2], k: m[3] } : null; }
    function defOf(id) { var c = cellParts(id); return c ? idx.byId[c.list + '.' + c.k] : idx.byId[id]; }
    function valueOf(id) { var c = cellParts(id); if (!c) return valueOf0(id); var r = Ls(c.list).rows[c.i]; return r && r[c.k] != null ? String(r[c.k]) : ''; }
    function emptyDef(id) { var e = idx.byId[id]; if (e && e.list) { var l = Ls(e.list), r = l.rows[l.cur]; return !r || !r[e.k]; } return valueOf0(id) === ''; }
    var near = { cur: st.cur, isEmpty: emptyDef, boost: null };
    function namedRows(core) {                                              // "When was Thandi born?": Thandi is in the Children list, so that list is meant
      var out = null, t = ' ' + norm(core) + ' ';
      Object.keys(idx.lists).forEach(function (key) {
        (st.rows ? st.rows(key) : []).forEach(function (d) {
          var nm = norm(rowName(d)).split(' ').filter(function (w) { return w.length > 2; });
          if (nm.some(function (w) { return t.indexOf(' ' + w + ' ') >= 0; })) { out = out || {}; out[key] = 1; }
        });
      });
      return out;
    }
    function rowFor(key, text, forceNew) {                               // which row of the list is being talked about
      var l = Ls(key), t = norm(text), o = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\b/.exec(t), r;
      if (forceNew) return l.n;
      if (o) return ORD_IDX[o[1]];
      if (/\b(last|latest|final)\b/.test(t) && l.n) return l.n - 1;
      if (/\b(another|new|additional|one more)\b/.test(t)) return l.n;
      if (/\bother\b/.test(t)) return l.n > 1 && l.cur === 0 ? 1 : l.n;
      if (/\bnext\b/.test(t)) return l.cur + 1 < l.n ? l.cur + 1 : l.n;
      var tf = ROW_COLS[key] ? rowFacts(idx, key, text).vals.type : null;
      if (tf) for (r = 0; r < l.rows.length; r++) if (l.rows[r].type === tf.value) return r;     // "the home loan"
      for (r = 0; r < l.rows.length; r++) {                              // a name already in the list
        var nm = norm(rowName(l.rows[r])).split(' ').filter(function (w) { return w.length > 2; });
        if (nm.length && nm.some(function (w) { return (' ' + t + ' ').indexOf(' ' + w + ' ') >= 0; })) return r;
      }
      return l.cur >= 0 ? l.cur : (l.n ? l.n - 1 : 0);
    }
    function commitRow(key, i) { var l = Ls(key); while (l.n <= i) { actions.push({ do: 'addrow', list: key }); l.n++; l.rows.push({}); } l.cur = i; }
    /* A matched box as something to act on: a plain field, or (for a list box) the cell in the right row, added only when the action is made. */
    function aim(hit, text, forceNew) {
      var e = idx.byId[hit.id];
      if (!e.list) return { id: hit.id, def: e, existing: valueOf0(hit.id), commit: function () { return hit.id; } };
      var i = rowFor(e.list, text, forceNew), cid = e.list + ':' + i + ':' + e.k;
      return { id: cid, def: e, existing: valueOf(cid), commit: function () { commitRow(e.list, i); return cid; } };
    }
    function firstCell(key, i) { var e = idx.byId[key + '.' + ((INTERVIEW[key] || [])[0] || idx.byId[idx.lists[key].cols[0]].k)]; return { id: key + ':' + i + ':' + e.k, def: e, commit: function () { commitRow(key, i); return key + ':' + i + ':' + e.k; } }; }
    function listFirst(core) { var k = Object.keys(listsNamed(norm(core)))[0]; return k && idx.lists[k] && visible(idx.lists[k].cols[0]) ? k : null; }
    function countIn(core, key) {                                          // "two children", "a loan", "3 kids"
      var t = norm(core), nouns = LIST_NOUNS_N[key].slice().sort(function (a, b) { return b.length - a.length; }).join('|');
      var m = new RegExp('\\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d{1,2})\\s+(?:[a-z]+\\s+){0,2}?(?:' + nouns + ')\\b').exec(t);
      if (!m) return null;
      var n = /^\d+$/.test(m[1]) ? +m[1] : (m[1] === 'a' || m[1] === 'an' ? 1 : wordsToNumber(m[1]));
      return n != null && n >= 1 && n <= 10 ? n : null;
    }
    function addRows(key, count, why) {                                    // make sure there are at least `count` rows, then ask the first new one
      var l = Ls(key), first = l.n;
      if (l.n >= count) { var fc0 = firstCell(key, l.cur >= 0 ? l.cur : 0); var id0 = fc0.commit(); actions.push({ do: 'ask', field: id0 }); target = id0; answered = false; return; }
      var fc = firstCell(key, first); commitRow(key, count - 1); l.cur = first;
      actions.push({ do: 'ask', field: fc.id }); target = fc.id; answered = false; selfAsk = true;
    }
    /* One row introduced in a sentence: use the row it is about (same type, or a blank one), else add one; fill what was said; then ask the next thing. */
    function introRow(key, rf) {
      var l = Ls(key), i = -1, r, t = rf.vals.type && rf.vals.type.value;
      for (r = 0; r < l.rows.length && i < 0; r++) if (t && l.rows[r].type === t) i = r;                                       // the same kind of loan is already there
      for (r = 0; r < l.rows.length && i < 0; r++) if (!Object.keys(l.rows[r]).some(function (k) { return l.rows[r][k] !== ''; })) i = r;   // a blank row
      if (i < 0) i = l.n;
      commitRow(key, i);
      var order = INTERVIEW[key] || [], filled = {};
      Object.keys(rf.vals).forEach(function (k) {
        var cid = key + ':' + i + ':' + k;
        actions.push({ do: 'fill', field: cid, res: { kind: 'fill', value: rf.vals[k].value, status: rf.vals[k].status }, explicit: true });
        l.rows[i][k] = rf.vals[k].value; filled[k] = 1;
      });
      var next = order.filter(function (k) { return !filled[k] && (l.rows[i][k] == null || l.rows[i][k] === ''); })[0];
      if (next) { var nid = key + ':' + i + ':' + next; actions.push({ do: 'ask', field: nid }); target = nid; answered = false; selfAsk = true; }
      else { target = key + ':' + i + ':' + Object.keys(filled).pop(); answered = true; }
    }
    function askCell(p) { var id = p.commit(); actions.push({ do: 'ask', field: id }); target = id; answered = false; selfAsk = false; return id; }
    /* "My name is John Snow": the whole name was said, so the first name and the surname are both filled ("Pieter van der Merwe" keeps the surname together).
       "My first name is John Peter" stays whole. A plain answer to the first-name box ("John Snow") leaves a surname that is already there alone. */
    function fullName(def, r, subject) {
      if (!r || r.kind !== 'fill' || !def || def.id !== 'fname' || r.extra || !visible('sname') || /\b(?:first|christian|given)\b/i.test(subject || '') || (!subject && valueOf0('sname') !== '')) return r;
      var w = String(r.value).split(/\s+/), i = w.length - 1;
      if (w.length < 2) return r;
      while (i > 1 && NAME_PARTS[w[i - 1].toLowerCase()]) i--;
      return { kind: 'fill', value: w.slice(0, i).join(' '), status: r.status, extra: [{ id: 'sname', value: w.slice(i).join(' '), status: r.status }] };
    }
    /* A South African cell number said without a label ("you can reach me on 082 555 0148"). Spouse, work and home numbers need their label. */
    function cellIn(core) {
      core = afterCorrection(core);
      var dg = lastOf(spokenDigits(core), 10), tdef = target && !answered ? defOf(target) : null;
      if (!/^(?:0[6-8]\d{8}|27[6-8]\d{8})$/.test(dg) || /\b(?:spouse|wife|husband|partner|work|office|home|landline|business|company|her|his|their|id|tax)\b/i.test(core) || (tdef && PHONE_IDS.indexOf(vid(tdef)) >= 0)) return null;
      return { kind: 'fill', value: formatPhone(dg), status: 'verify', note: '' };
    }
    /* An ID number (13 digits starting with a date) or a passport number, said with or without the word "ID": these are never sent to Claude, so they are read here. */
    function idNumberIn(core) {
      core = afterCorrection(core);
      var pp = /\bpassport\b/i.test(core) ? spokenPassport(core) : null;
      if (pp) return { kind: 'fill', value: pp, status: 'verify', extra: [{ id: 'idtype', value: 'Passport', status: 'heard' }] };
      var dg = lastOf(spokenDigits(core), 13);
      return /^\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{7}$/.test(dg) ? { kind: 'fill', value: dg, status: 'verify' } : null;
    }

    clauses(text).forEach(function (seg) {
      var core = seg.replace(LEADWORDS, '').trim(), isQ = /\?\s*["')]*$/.test(core), words = seg.split(/\s+/).length;
      if (!core) return;
      near.boost = namedRows(core);
      var cmd = parseCommand(core, idx);
      if (cmd && cmd.bare && target && !answered) cmd = null;              // "Medical aid", said while that box waits, is the answer, not a move
      if (cmd && cmd.type === 'addrow') {                                  // "add another child", "one more policy"
        var lk = cmd.list || (cellParts(target) && cellParts(target).list) || sectionList(st.cur);
        if (lk && idx.lists[lk]) {
          noting = false;
          var ch = matchQuestion(core, idx, near), p0 = ch && idx.byId[ch.id].list === lk && ch.score >= 4 ? aim(ch, core, true) : firstCell(lk, Ls(lk).n);
          askCell(p0); return;
        }
        cmd = null;
      }
      if (cmd) {
        if (cmd.type === 'notes') noting = true; else if (cmd.type !== 'undo' && cmd.type !== 'clear') noting = false;   // moving on ends the notes
        actions.push({ do: 'cmd', cmd: cmd }); return;
      }
      if (noting) {                                                        // while notes are being taken, what is said is noted, not filled in
        if (isChatter(seg)) return;
        var askish = isQ || WH.test(core) || looksLikeQuestion(core), strong = askish ? matchQuestion(core, idx, near) : null;
        if (strong && strong.score >= 4 && visible(strong.id)) { noting = false; askCell(aim(strong, core)); return; }
        if (!askish) { var last = actions[actions.length - 1]; if (last && last.do === 'note') last.text += '. ' + seg; else actions.push({ do: 'note', text: seg }); }   // the adviser's own questions are not noted
        return;
      }
      /* waiting for a count: "how many children do you have?" ... "two" */
      var ct = /^count:(\w+)$/.exec(String(target || ''));
      if (ct && !answered && !isQ && !(NEGATE_HAVE.test(seg) && !NO_WORDS.test(core))) {
        var cn = wordsToNumber(core) != null && words <= 3 ? Math.round(wordsToNumber(core)) : (/^(?:yes|yeah|yep|yup|ja|i do|we do|i have|we have)\b/i.test(core) ? 1 : null);
        if (NO_WORDS.test(core)) { answered = true; return; }             // none: nothing to record
        var crf = rowFacts(idx, ct[1], core);
        if (cn === 1 || (cn == null && Object.keys(crf.vals).length)) {                                      // "yes, a home loan with ABSA": the row, and what was said about it
          if (Object.keys(crf.vals).length) { answered = true; introRow(ct[1], crf); if (crf.leftover > 1) sure = false; return; }
        }
        if (cn != null && cn >= 1 && cn <= 10) { answered = true; addRows(ct[1], cn); return; }
      }
      /* "I have two children", "we have a loan": make the rows, then ask about the first. "I have a home loan with ABSA bank": the row is made and what is said about it goes in. */
      if (!isQ && !WH.test(core)) {
        var lkc = listFirst(core), cc = lkc ? countIn(core, lkc) : null;
        var colHit = lkc ? matchQuestion(core, idx, near) : null, namesColumn = colHit && idx.byId[colHit.id].list === lkc && colHit.score >= 4;
        var rf = lkc ? rowFacts(idx, lkc, core) : null, MONEY_KEYS = { bal: 1, inst: 1, asset: 1, spend: 1, val: 1, contrib: 1, prem: 1, cost: 1 };
        var nFacts = rf ? Object.keys(rf.vals).filter(function (k) { return !MONEY_KEYS[k]; }).length : 0;
        if (colHit && !idx.byId[colHit.id].list && colHit.score >= 4 && !cc) lkc = null;      // the clause is about a specific box elsewhere ("the loan account balance" of a business loan)
        var tcp = cellParts(target), waitingHere = false;
        if (lkc && tcp && !answered) {                                                                        // a plain answer to the box being asked is an answer, not a new row
          var probe = answerFor(defOf(target), seg, valueOf(target));
          waitingHere = (tcp.list === lkc || words <= 4 || probe.kind === 'fill' || probe.kind === 'confirm') && nFacts <= 1;
        }
        var explicitIntro = !!(cc && /\b(?:have|has|got|had|there are|there is|with|we've|i've|three|two|one|four|five)\b/i.test(core));
        if (lkc && !waitingHere && (explicitIntro || (nFacts && !namesColumn))) {
          if (cc && cc > 1) { addRows(lkc, cc); if (rf.leftover > 1) sure = false; return; }
          introRow(lkc, rf); if (rf.leftover > 1) sure = false; return;
        }
        if (lkc && NEGATE_HAVE.test(seg) && !Object.keys(idx.byId).some(function (id) { return idx.byId[id].none && matchQuestion(core, idx, near) && matchQuestion(core, idx, near).id === id; })) { answered = true; return; }   // "no children": nothing to record
      }
      if (!isQ && !WH.test(core) && /\b(?:is|are|was|were)[.,;:!]*\s*$/i.test(core)) {   // "my surname is" ... and then nothing yet: glow that box and keep listening
        var dh = matchQuestion(core, idx, near);
        if (dh && dh.score >= 2.5 && visible(dh.id)) { askCell(aim(dh, core)); return; }
      }
      var negSeg = seg.replace(CORRECT, ' '), negAt = NEGATE_HAVE.exec(negSeg);       // the "no" of "no sorry, it is ..." is a correction, not a negation
      if (!isQ && negAt) {                                                // "I don't have a home number or a work number", "no work email"
        var negCore = negSeg.slice(negAt.index), ns = noneTargets(negCore), nh = ns.length ? null : matchQuestion(core, idx, near);
        if (nh && nh.score >= 2.5) ns = [nh.id];
        ns = ns.filter(function (id) { return idx.byId[id] && idx.byId[id].none && visible(id); });
        if (ns.length) { ns.forEach(function (id) { actions.push({ do: 'fill', field: id, res: { kind: 'fill', value: 'None', status: 'heard' }, explicit: true }); }); target = ns[ns.length - 1]; answered = true; return; }
      }
      if (!isQ && !WH.test(core)) {                                        // a value of a typed box, found in the clause however it is phrased
        var th = matchQuestion(core, idx, near);
        if (th && th.score >= 2.5 && visible(th.id) && TYPED.indexOf(vid(idx.byId[th.id])) >= 0) {
          var tp = aim(th, core), tv = EMAIL_IDS.indexOf(vid(tp.def)) >= 0 ? (typedEmail(core) || [core.replace(/^.*\b(?:is|are|it's|its|address|email|e-mail)\b[,:\s]*(?:me\s+)?(?:(?:at|on)\s+)?/i, '')])[0] : core;   // an email is what follows "is" / "it's"
          var tr = answerFor(tp.def, tv, tp.existing);
          if (tr.kind === 'fill') { var tid = tp.commit(); actions.push({ do: 'fill', field: tid, res: tr, explicit: true }); target = tid; answered = true; return; }
        }
      }
      if (!isQ && !WH.test(core) && visible('idno')) {                    // "my ID is 7212...", or just the number
        var idr = idNumberIn(core);
        if (idr) { actions.push({ do: 'fill', field: 'idno', res: idr, explicit: true }); target = 'idno'; answered = true; return; }
      }
      if (!isQ && !WH.test(core) && visible('cell')) {                    // "you can reach me on 082 555 0148"
        var cr = cellIn(core);
        if (cr) { actions.push({ do: 'fill', field: 'cell', res: cr, explicit: true }); target = 'cell'; answered = true; return; }
      }
      var m = !isQ && !WH.test(core) ? ASSERT.exec(core) : null;           // "your first name is John", "my surname is Peters"
      if (m) {
        var hit = matchQuestion((m[1] || '') + m[2], idx, near);
        if (hit && hit.score >= 2.5 && visible(hit.id)) {
          var ap = aim(hit, core), r = answerFor(ap.def, m[3].replace(/[,\s]+(?:right|correct|okay|ok|yes|isn't it|is that right|is that correct|not so)\s*$/i, ''), ap.existing);
          r = fullName(ap.def, r, m[2]);
          if (r.kind === 'fill' || r.kind === 'confirm') { var aid = ap.commit(); actions.push({ do: r.kind, field: aid, res: r, explicit: true, tentative: hit.score < 3 }); target = aid; answered = true; if (hit.score < 3) sure = false; return; }
        }
      }
      if (isQ || WH.test(core) || looksLikeQuestion(core)) {               // someone asks about a field
        var q = matchQuestion(core, idx, near);
        if (q && visible(q.id)) { var qid = askCell(aim(q, core)); actions[actions.length - 1].tentative = q.score < 4; if (q.score < 4) sure = false; return; }
        var lq = listFirst(core);                                          // "do you have any children?", "how many loans?", "tell me about the policies"
        if (lq) {
          var lq0 = Ls(lq);
          if (lq0.n === 0) { actions.push({ do: 'ask', field: 'count:' + lq }); target = 'count:' + lq; answered = false; }
          else askCell(firstCell(lq, rowFor(lq, core)));
          return;
        }
        if (!isChatter(core)) sure = false;
        return;
      }
      if (selfAsk && target && !answered && !isChatter(seg)) { sure = false; return; }                  // the rest of the same sentence is not an answer to a box the page moved to itself: Claude reads it
      if (target && !answered && !/^count:/.test(target)) {                // a plain statement while a box is waiting answers it
        var a = fullName(defOf(target), answerFor(defOf(target), seg, valueOf(target)), '');
        if (a.kind === 'fill' || a.kind === 'confirm') { var longText = words >= 6 && isFreeText(defOf(target)); actions.push({ do: a.kind, field: target, res: a, tentative: longText }); answered = true; if (longText) sure = false; return; }
        if (a.kind === 'wait') { actions.push({ do: 'wait', field: target, dangling: !!a.dangling }); return; }
        sure = false; return;
      }
      if (!isChatter(seg)) sure = false;
    });
    return { actions: actions, sure: sure };
  }
  /* The list shown in a section, if it has one. */
  function sectionList(secId) { return secId && SECTION_LISTS[secId] || null; }
  var SECTION_LISTS = {};

  /* Notes in point form, not full sentences: "so he said that he would like to retire at sixty" -> ["Would like to retire at 60"] */
  var NOTE_FILLER = /\b(?:um+|uh+|er+|erm|you know|i mean|sort of|kind of|basically|actually|obviously|honestly|like i said|as i said)\b[,\s]*/gi;
  var NOTE_LEAD = /^(?:(?:so|well|okay|ok|and|but|oh|yes|yeah|no|right|then|now|also|anyway)[,.\s]+)+|^(?:he|she|they|the client|client)\s+(?:(?:is|are|was|were)\s+|(?:says|said|mentioned|told me|tells me)\s+(?:that\s+)?)?/i;
  function pointForm(text) {
    return clauses(text).map(function (c) {
      if (isChatter(c)) return '';
      var t = c.replace(NOTE_FILLER, '').replace(NOTE_LEAD, '').replace(NOTE_LEAD, '').replace(/\s+/g, ' ').replace(/[\s,;.!?]+$/, '').trim();
      t = t.replace(/^i(?:'m| am) /i, '').replace(/^i(?:'ve| have)(?: got)? /i, 'Has ').replace(/^i(?:'d| would) like to /i, 'Would like to ').replace(/^i want to /i, 'Wants to ').replace(/^i (?:don't|do not) /i, 'Does not ').replace(/^we (?:don't|do not) /i, 'Does not ').replace(/^my /i, '');
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    }).filter(Boolean);
  }

  var PRIVATE_IDS = ['idno', 'tax', 'cell', 'work', 'home', 'sp_tel', 'pemail', 'wemail', 'shares.id', 'shares.cell'];
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
    if (plain && existing && (m = /^\s*(?:(?:no|nope|nah|not really|not quite|actually|sorry|well|oh)[,.\s]+)+(.+)$/i.exec(String(raw)))) { raw = m[1]; t = norm(raw); correction = true; }
    if (existing && !correction && isConfirm(raw, plain)) return { kind: 'confirm' };
    if (plain && !correction && !(f.none && yesNo(t) === 'no') && t.split(' ').length <= 3 && yesNo(t) && !content(t).filter(function (w) { return !AGREE[w] && !NEGATE[w]; }).length) {
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
    buildIndex: buildIndex, parseCommand: parseCommand, wipeAnswer: wipeAnswer, looksLikeQuestion: looksLikeQuestion, isChatter: isChatter, plan: plan, pointForm: pointForm, LIST_NOUNS: LIST_NOUNS, matchQuestion: matchQuestion, interpret: interpret, titleCase: titleCase,
    isConfirm: isConfirm, answerFor: answerFor, clauses: clauses, PRIVATE_IDS: PRIVATE_IDS
  };
});
