/* The Client Overview's Presentation, the part that needs no screen (stage 5): the tabs, the short figures on the map, the closed list of things Paul can ask for by voice, the fixed command grammar, the engine
   that decides whether a spoken line moves the screen, and the private key-points library. The screen itself is js/ov-present.js; this file is tested on its own (tests/overview-present.test.js).
   Rules that are built in here and must not be undone (docs/PROJECT-CLIENT-OVERVIEW.md section 8):
   - only the adviser's own microphone is ever acted on: a line tagged as the client's (or any other tag) is dropped before anything reads it, and no spoken line is kept;
   - a line moves the screen only when it STARTS with a command phrase ("let's talk about ...", "go to ...", "show me ...", "next", "back", "back to the main page"); everything else is ignored, so ordinary talk never moves it;
   - after a move there is a short cool-down, and after a click the voice is paused for a while; clicking always works;
   - what is asked for must be on the closed list built from this overview; a name that fits two things moves nothing and offers buttons;
   - the voice never calls Claude: the grammar and the list are plain code.
   Loads in the browser (window.OV.pres) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.pres = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  var TABS = ['Main', '1 Policies', '2 FNA', '3 Group', '4 Shortfall', '5 Shortfall quote', '6 Reduced', '7 Comparative', '8 Investments', '9 Proposed', '10 Goals', '11 Other'];
  var ORDER = ['map'].concat(schema.BLOCKS.map(function (b) { return b.id; }));
  var COOL_MS = 2500, PAUSE_MS = 8000, CHOICE_MS = 12000;

  /* ---------- words ---------- */
  /* What speech gives and what the closed list holds are both brought to plain lower-case words: "Let's" is "lets", "pay-out" is "pay out", accents and punctuation are gone. */
  function words(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/-/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toks(s) { var w = words(s); return w ? w.split(' ') : []; }
  function hasSeq(tk, seq) {
    if (!seq.length || seq.length > tk.length) return false;
    for (var i = 0; i + seq.length <= tk.length; i++) { var j = 0; while (j < seq.length && tk[i + j] === seq[j]) j++; if (j === seq.length) return true; }
    return false;
  }
  function set(s) { var o = {}; s.split(' ').forEach(function (w) { o[w] = 1; }); return o; }

  /* ---------- the command grammar ---------- */
  var FILLER = set('ok okay so now right alright then and well please yes great good perfect sure');
  var NAVNOISE = set('the to one page block section tab slide lets let us go move on please show we can shall me our a an');
  var LEADWORDS = set('back go lets let show take return get come can');
  var LEADS = ['lets talk about', 'let us talk about', 'lets look at', 'let us look at', 'lets have a look at', 'let us have a look at', 'lets go to', 'let us go to', 'lets move to', 'let us move to', 'can we talk about', 'can we look at', 'can we go to',
    'shall we talk about', 'shall we look at', 'go to', 'show me', 'take us to', 'take me to', 'move to', 'turn to'].sort(function (a, b) { return b.length - a.length; });

  /* One spoken line -> a command or null. cmd: main | next | back | clear | goto (with topic: the words after the command phrase). */
  function parse(text) {
    var tk = toks(text);
    while (tk.length && FILLER[tk[0]]) tk.shift();
    while (tk.length && FILLER[tk[tk.length - 1]]) tk.pop();
    if (!tk.length || tk.length > 24) return null;
    var core = tk.filter(function (w) { return !NAVNOISE[w]; });
    if (core.length === 2 && (core[0] === 'clear' || core[0] === 'remove') && /^highlight/.test(core[1]) && tk.length <= 5) return { cmd: 'clear' };
    var noBack = core.filter(function (w) { return w !== 'back' && w !== 'return'; });
    if (tk.length <= 8 && LEADWORDS[tk[0]] && noBack.length === 1 && (noBack[0] === 'main' || (/^(map|home|overview|menu|start)$/.test(noBack[0]) && tk.indexOf('back') >= 0))) return { cmd: 'main' };
    if (tk.length <= 7 && core.length === 1 && core[0] === 'next') return { cmd: 'next' };
    if (tk.length <= 7 && core.length === 1 && (core[0] === 'back' || core[0] === 'previous')) return { cmd: 'back' };
    var str = tk.join(' ');
    for (var i = 0; i < LEADS.length; i++) {
      var lead = LEADS[i];
      if (str.indexOf(lead + ' ') === 0) return { cmd: 'goto', lead: lead, topic: str.slice(lead.length + 1) };
    }
    return null;
  }

  /* ---------- the closed list of topics, built from this overview ---------- */
  var BLOCK_ALIASES = {
    policies: ['current policies', 'existing policies', 'policies', 'current cover', 'what you have in place'],
    fna: ['fna quote', 'fna', 'financial needs analysis', 'needs analysis'],
    group: ['group benefits', 'group risk', 'group', 'personal investments', 'benefits through work', 'employer benefits'],
    shortfall: ['shortfall'],
    shortfallQuote: ['shortfall quote', 'shortfall quotes'],
    reduced: ['reduced quotes', 'reduced quote', 'reduced', 'budget quote'],
    comparative: ['comparative quotes', 'comparative quote', 'comparative'],
    investments: ['current investments', 'existing investments', 'investments'],
    proposed: ['proposed investments', 'proposed investment', 'investment proposal', 'investment proposals', 'investments'],
    goals: ['goal analysis reports', 'goal analysis report', 'goal analysis', 'goals', 'retirement goal', 'education goal', 'rgar', 'egar'],
    other: ['medical aid', 'gap cover', 'will', 'short term', 'short term insurance', 'legacy protection', 'legacy protection plan']
  };
  var BLOCK_NOUN = { fna: ['fna quote', 'fna'], shortfallQuote: ['shortfall quote', 'shortfall'], reduced: ['reduced quote', 'reduced'], comparative: ['comparative quote', 'comparative'] };
  var SUB_ALIASES = {
    quote: ['the quote', 'this quote'],
    cmp: ['your change moment pay out', 'change moment pay out', 'change moment payout', 'change moment', 'pay out', 'payout'],
    cmpr: ['compared with what you have now', 'compared with what you have', 'compare with what you have now', 'compared with', 'compare with', 'comparison', 'compare']
  };
  var PILLAR_ALIASES = {
    life: ['life cover', 'life'],
    sev: ['severe illness', 'severe', 'critical illness'],
    lsd: ['lump sum disability', 'disability', 'permanent disability'],
    ip: ['income protector sickness benefit', 'income protector', 'income protection', 'sickness benefit', 'sickness']
  };
  var TYPE_ALIASES = {
    household: ['household needs', 'household', 'the house', 'house', 'living expenses'],
    child: ['child care', 'childcare', 'children', 'kids'],
    debt: ['debts', 'debt', 'loans'],
    death: ['death related needs', 'death related', 'death needs', 'funeral', 'death'],
    dread: ['additional expense needs', 'additional expenses', 'additional expense', 'dread']
  };
  var ROW_ALIASES = { 'total-ip': ['total income protected', 'income protected'], 'total-lump': ['total lump sum'], 'total-premium': ['monthly premium', 'the premium', 'premium'] };
  var ORD = ['first', 'second', 'third', 'fourth', 'fifth'], NUM = ['one', 'two', 'three', 'four', 'five'];

  /* The line keys a row answers to: its type, and for a child or a debt its own name, so "Amy" or "the car loan" finds the one line. */
  function lineKeys(l) {
    var keys = ['type:' + (l && l.type || 'other')];
    if (l && l.type === 'child' && l.name) keys.push('child:' + calc.norm(l.name));
    if (l && l.type === 'debt' && (l.debt || l.bank)) keys.push('debt:' + calc.norm(l.debt || l.bank));
    return keys;
  }
  function linesOf(state) {
    var out = [];
    schema.QUOTE_KINDS.forEach(function (k) { calc.quotes(state, schema.blockOfQuote[k]).forEach(function (q) { out = out.concat(calc.activeLines(q)); }); });
    calc.policies(state).forEach(function (e) { out = out.concat(calc.activeLines(e.item)); });
    return out;
  }
  function alias(list) { return list.map(toks).filter(function (t) { return t.length; }); }
  function topic(dim, label, target, aliases, specific) { return { dim: dim, label: label, target: target, aliases: alias(aliases), specific: specific ? 2 : 0 }; }
  var GENERIC = set('loan loans finance account the and of');

  function topics(state) {
    var out = [], b;
    schema.BLOCKS.forEach(function (bl) { if (calc.pageShown(state, bl.id)) out.push(topic('nav', bl.n + ' ' + bl.title, { tab: bl.id }, BLOCK_ALIASES[bl.id] || [bl.title])); });          // a page that is left out cannot be asked for
    /* a block with several quotes: the first, the second ... one, and each insurer */
    schema.QUOTE_KINDS.forEach(function (k) {
      var id = schema.blockOfQuote[k], qs = calc.quotes(state, id), bl = schema.blocksById[id];
      if (!qs.length || !calc.pageShown(state, id)) return;
      qs.forEach(function (q, i) {
        var tg = { tab: id, qi: i }, lab = bl.n + ' ' + bl.title + (qs.length > 1 ? ' (' + (i + 1) + ')' : '') + (q.insurer ? ', ' + q.insurer : ''), al = [];
        if (qs.length > 1) BLOCK_NOUN[id].forEach(function (nn) { al.push(ORD[i] + ' ' + nn, nn + ' ' + (i + 1), nn + ' ' + NUM[i]); });
        if (q.insurer) { al.push(q.insurer); BLOCK_NOUN[id].forEach(function (nn) { al.push(q.insurer + ' ' + nn); }); }
        if (al.length) out.push(topic('nav', lab, tg, al, true));
      });
    });
    /* a current policy: by its insurer */
    calc.policies(state).forEach(function (e, i) {
      if (!calc.activeLines(e.item).length || !e.item.insurer) return;
      out.push(topic('nav', '1 Current policies, ' + e.item.insurer + (e.item.policyNo ? ' ' + e.item.policyNo : ''), { tab: 'policies', pol: i }, [e.item.insurer, e.item.insurer + ' policy'].concat(e.item.policyNo ? [e.item.policyNo] : []), true));
    });
    Object.keys(SUB_ALIASES).forEach(function (k) { out.push(topic('sub', { quote: 'The quote', cmp: 'Your change moment pay-out', cmpr: 'Compared with what you have now' }[k], { sub: k }, SUB_ALIASES[k])); });
    schema.PILLARS.forEach(function (p) { out.push(topic('pillar', p.l, { pil: p.id }, PILLAR_ALIASES[p.id])); });
    schema.LINE_TYPES.forEach(function (t) { if (TYPE_ALIASES[t.id]) out.push(topic('line', t.l, { line: 'type:' + t.id }, TYPE_ALIASES[t.id])); });
    Object.keys(ROW_ALIASES).forEach(function (k) { out.push(topic('line', { 'total-ip': 'Total income protected', 'total-lump': 'Total lump sum', 'total-premium': 'Monthly premium' }[k], { line: k }, ROW_ALIASES[k])); });
    var seen = {};
    linesOf(state).forEach(function (l) {
      if (l.type === 'child' && l.name && !seen['c' + calc.norm(l.name)]) {
        seen['c' + calc.norm(l.name)] = 1;
        out.push(topic('line', ((l.name || '') + ' ' + (l.sname || '')).trim(), { line: 'child:' + calc.norm(l.name) }, [l.name, ((l.name || '') + ' ' + (l.sname || '')).trim()], true));
      }
      if (l.type === 'debt' && (l.debt || l.bank) && !seen['d' + calc.norm(l.debt || l.bank)]) {
        var key = calc.norm(l.debt || l.bank); seen['d' + key] = 1;
        var al = [l.debt, l.bank].filter(Boolean); toks(l.debt || '').forEach(function (w) { if (w.length > 2 && !/^(the|and|of)$/.test(w)) al.push(w); });
        out.push(topic('line', [l.debt, l.bank].filter(Boolean).join(' - '), { line: 'debt:' + key }, al, true));
      }
    });
    return out;
  }

  /* What a topic text asks for: the best topic of each kind (screen page, tab, benefit, line). Two topics of one kind with the same best score, and different targets, are an unclear request. */
  function match(topicText, list) {
    var tk = toks(topicText), best = { nav: [], sub: [], pillar: [], line: [] }, top = { nav: 0, sub: 0, pillar: 0, line: 0 };
    list.forEach(function (t) {
      var sc = 0; t.aliases.forEach(function (a) { if (hasSeq(tk, a) && a.length + t.specific > sc) sc = a.length + t.specific; });
      if (!sc) return;
      if (sc > top[t.dim]) { top[t.dim] = sc; best[t.dim] = [t]; } else if (sc === top[t.dim] && !best[t.dim].some(function (x) { return JSON.stringify(x.target) === JSON.stringify(t.target); })) best[t.dim].push(t);
    });
    return best;
  }
  /* One spoken line -> { status, moves, label, choices }. status: none (not a command) | unknown (a command about something not on the list) | move | choose (unclear: nothing moves, buttons are offered). */
  function decide(text, list) {
    var c = parse(text);
    if (!c) return { status: 'none' };
    if (c.cmd === 'main') return { status: 'move', moves: [{ tab: 'map' }], label: 'Main page' };
    if (c.cmd === 'next') return { status: 'move', moves: [{ step: 1 }], label: 'Next' };
    if (c.cmd === 'back') return { status: 'move', moves: [{ step: -1 }], label: 'Back' };
    if (c.cmd === 'clear') return { status: 'move', moves: [{ clear: true }], label: 'Highlights cleared' };
    var best = match(c.topic, list), dims = ['nav', 'sub', 'pillar', 'line'], moves = [], labels = [], unclear = null;
    dims.forEach(function (d) {
      if (!best[d].length) return;
      if (best[d].length === 1) { moves.push(best[d][0].target); labels.push(best[d][0].label); } else if (!unclear) unclear = best[d];
    });
    if (unclear) {
      return { status: 'choose', choices: unclear.slice(0, 4).map(function (t) { return { label: t.label, moves: [t.target].concat(moves) }; }) };
    }
    if (!moves.length) return { status: 'unknown', topic: c.topic };
    return { status: 'move', moves: moves, label: labels.join(' · ') };
  }

  /* ---------- the engine: locked until a command phrase, cool-down after a move, paused after a click, only the adviser's microphone ---------- */
  function isAdviser(who) { return who === 'me' || who == null || who === ''; }   // the listener is started on the microphone alone; only the call's sound is tagged 'client'
  function createEngine(o) {
    var now = o.now || Date.now, on = false, cool = 0, paused = 0, choiceUntil = 0, choices = null;
    function status() {
      if (!on) return 'off';
      var t = now();
      if (t < paused) return 'paused';
      if (t < cool) return 'cooling';
      if (choices && t < choiceUntil) return 'choose';
      return 'locked';
    }
    return {
      status: status,
      get on() { return on; },
      setOn: function (v) { on = !!v; cool = 0; paused = 0; choices = null; },
      pause: function (ms) { if (on) paused = now() + (ms || o.pauseMs || PAUSE_MS); choices = null; },
      choices: function () { return choices && now() < choiceUntil ? choices : null; },
      clearChoices: function () { choices = null; },
      /* One line from the listener. The text is read here and kept nowhere. */
      hear: function (text, who) {
        if (!on) return { status: 'off' };
        if (!isAdviser(who)) return { status: 'ignored' };
        var s = status();
        if (s === 'paused' || s === 'cooling') return { status: s };
        var d = decide(text, o.topics());
        if (d.status === 'move') { choices = null; cool = now() + (o.coolMs || COOL_MS); if (o.onMove) o.onMove(d.moves, d.label); } else if (d.status === 'choose') { choices = d.choices; choiceUntil = now() + CHOICE_MS; if (o.onChoices) o.onChoices(d.choices); } else if (d.status === 'unknown' && o.onUnknown) o.onUnknown(d.topic);
        return { status: d.status, label: d.label };
      },
      /* A button of an unclear request was clicked: the moves are done, the voice waits as after any click. */
      choose: function (i) { var c = choices && choices[i]; if (!c) return false; choices = null; paused = on ? now() + (o.pauseMs || PAUSE_MS) : 0; if (o.onMove) o.onMove(c.moves, c.label); return true; }
    };
  }

  /* ---------- the map: a short figure for each block (no income figure, ever) ---------- */
  function short(n) {
    if (!calc.isNum(n)) return '';
    var a = Math.abs(n);
    if (a >= 1000000) return 'R' + (Math.round(a / 100000) / 10).toString().replace(/\.0$/, '') + 'm';
    if (a >= 10000) return 'R' + Math.round(a / 1000) + 'k';
    return calc.fmtR(a);
  }
  function qCount(n, one) { return n + ' ' + one + (n === 1 ? '' : 's'); }
  function mapFigures(state) {
    var f = {}, pt = calc.policyTotals(state), sf = calc.shortfall(state), pi = calc.personalInvestments(state), gt = calc.groupTotals(state), items;
    f.policies = pt.count.all ? qCount(pt.count.all, 'policy').replace('policys', 'policies') + ' · ' + short(pt.premium.all) + ' p.m.' : 'None yet';
    var fna = calc.quotes(state, 'fna')[0]; f.fna = fna ? (calc.isNum(fna.premium) ? short(fna.premium) + ' p.m.' : 'Quote loaded') : 'Waiting';
    var gi = calc.groupItems(state); f.group = gi.length || pi.count ? [gt.life ? short(gt.life) + ' group life' : '', pi.count ? short(pi.gross) + ' invested' : ''].filter(Boolean).join(' · ') || qCount(gi.length, 'item') : 'None';
    f.shortfall = sf.has ? short(sf.short.life) + ' life shortfall' : 'Waiting';
    ['shortfallQuote', 'reduced', 'comparative'].forEach(function (id) {
      var qs = calc.quotes(state, id), prem = qs.filter(function (q) { return calc.isNum(q.premium); }).map(function (q) { return q.premium; });
      f[id] = !qs.length ? (id === 'shortfallQuote' && !calc.hasGroupRisk(state) ? 'Not needed' : 'None yet') : qCount(qs.length, 'quote') + (prem.length ? ' · from ' + short(Math.min.apply(null, prem)) + ' p.m.' : '');
    });
    f.investments = pi.count ? qCount(pi.count, 'investment') + ' · ' + short(pi.gross) : 'None';
    items = calc.active(state.blocks.proposed.items); f.proposed = items.length ? qCount(items.length, 'proposal') : 'None';
    items = calc.active(state.blocks.goals.items); f.goals = items.length ? qCount(items.length, 'report') : 'None';
    items = calc.active(state.blocks.other.items); f.other = items.length ? qCount(items.length, 'item') : 'None';
    schema.BLOCKS.forEach(function (b) { if (!calc.pageShown(state, b.id)) f[b.id] = 'Not included'; });                 // the same pages are left out as in the PDF
    return f;
  }

  /* ---------- the key-points library (private: kept in the browser, never in the repository) ---------- */
  var KP_BENEFITS = { life: 'Life cover', sev: 'Severe illness', lsd: 'Lump sum disability', ip: 'Income protector / sickness benefit', instalmentProtector: 'Instalment Protector', childCover: 'Child care cover', conversion: 'Conversion' };
  /* The file as Paul keeps it ({app:"wr-keypoints", schema:"0.x", points:[...]}). Only a point with an approval (who and when) is ever kept: an unapproved one is dropped here and never shows. */
  function parseKeyPoints(text) {
    var j; try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'This is not a readable key-points file.' }; }
    if (!j || j.app !== 'wr-keypoints' || !Array.isArray(j.points)) return { ok: false, error: 'This is not a key-points file (it should say "wr-keypoints").' };
    if (!/^0\./.test(String(j.schema || ''))) return { ok: false, error: 'This key-points file has a layout this page does not know (' + String(j.schema || 'none') + ').' };
    var good = [], dropped = 0;
    j.points.forEach(function (p) {
      var okp = p && typeof p.text === 'string' && p.text.trim() && typeof p.insurer === 'string' && typeof p.benefit === 'string' && p.approved && typeof p.approved === 'object' && p.approved.by && p.approved.date;
      if (okp) good.push({ id: String(p.id || ''), insurer: String(p.insurer), product: String(p.product || ''), benefit: String(p.benefit), text: String(p.text).trim() }); else dropped++;
    });
    return { ok: true, points: good, total: j.points.length, dropped: dropped };
  }
  function sameInsurer(a, b) { a = calc.norm(a); b = calc.norm(b); return !!a && !!b && (a === b || a.indexOf(b + ' ') === 0 || b.indexOf(a + ' ') === 0); }
  /* At most four approved points for the insurer (and product, when the point names one) and the benefits being discussed, in the file's order. */
  function pointsFor(points, insurer, benefits, product) {
    var out = [];
    (points || []).forEach(function (p) {
      if (out.length >= 4 || benefits.indexOf(p.benefit) < 0 || !sameInsurer(p.insurer, insurer)) return;
      if (p.product && product && calc.norm(product).indexOf(calc.norm(p.product)) < 0 && calc.norm(p.product).indexOf(calc.norm(product)) < 0) return;
      out.push(p);
    });
    return out;
  }
  /* The benefits a pillar button (and a highlighted line) asks about: an income-protector debt line is also the Instalment Protector; a child line is also the child care cover. */
  function benefitsFor(pil, rows) {
    if (!pil) return [];
    var b = [pil], r = rows || [];
    if (pil === 'ip' && r.some(function (k) { return /^(type|debt):debt|^debt:/.test(k); })) b.push('instalmentProtector');
    if ((pil === 'life' || pil === 'lsd') && r.some(function (k) { return /^(type:child|child:)/.test(k); })) b.push('childCover');
    return b;
  }

  /* The tabs that can be opened: the map and every page the PDF has too (a page with nothing to say is left out). */
  function shownOrder(state) { return ORDER.filter(function (id) { return id === 'map' || calc.pageShown(state, id); }); }

  return { TABS: TABS, ORDER: ORDER, shownOrder: shownOrder, COOL_MS: COOL_MS, PAUSE_MS: PAUSE_MS, words: words, parse: parse, topics: topics, match: match, decide: decide, createEngine: createEngine, isAdviser: isAdviser, lineKeys: lineKeys,
    mapFigures: mapFigures, short: short, parseKeyPoints: parseKeyPoints, pointsFor: pointsFor, benefitsFor: benefitsFor, KP_BENEFITS: KP_BENEFITS };
});
