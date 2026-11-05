/* The action points for the personal assistant (Admin page): what is still to be asked of the client, which quotes are to be requested, who must contact the client, the follow-up appointment, and anything else that has to be done.
   facts() collects, from the rest of the form, only what those points are made from (nothing private: no ID, tax or phone numbers). Claude writes the points from the facts (voice-ai.js, actionPoints). Until it has, or when it cannot be reached,
   local() writes plain points from the same facts. The points are in point form, addressed to the assistant, use the client's first name and no pronouns. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./schema.js'), require('./calc.js'), require('./store.js'), require('./summary.js'));
  else { root.FF = root.FF || {}; root.FF.actions = factory(root.FF.util, root.FF.schema, root.FF.calc, root.FF.store, root.FF.summary); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc, store, summary) {
  var blockOfField = {}, blockOfList = {};
  schema.sections.forEach(function (s) { s.blocks.forEach(function (b) {
    (b.fields || []).forEach(function (f) { blockOfField[f.id] = b; });
    if (b.list && !blockOfList[b.list]) blockOfList[b.list] = b;
  }); });
  /* the notes boxes (Notes at the foot of a page): id and the page they are on. Claude reads them for the action points and decides what is something to do and what is only information. */
  var NOTE_BOXES = [];
  schema.sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) { if (f.opt && f.t === 'area' && /^n_/.test(f.id)) NOTE_BOXES.push({ id: f.id, page: s.title, sec: s }); }); }); });
  var CLIENT = 'Requested from client in meeting', ASTUTE = 'Draw from Astute (with signed LOA)', OTHER = 'Other';
  /* the policy schedule lists: box, its "Other" box, what to call the policies, and the list they are in */
  var SCHEDS = [['ps_risk', 'ps_risk_ot', 'personal risk policies', 'risk'], ['ps_grp', 'ps_grp_ot', 'group risk benefits', 'grp'], ['ps_ra', 'ps_ra_ot', 'retirement annuities', 'ret_ra'],
    ['ps_pp', 'ps_pp_ot', 'pension and provident funds', 'ret_pp'], ['ps_inv', 'ps_inv_ot', 'investments', 'inv']];

  function clean(o) { var r = {}; Object.keys(o).forEach(function (k) { if (o[k] != null && String(o[k]).trim() !== '') r[k] = o[k]; }); return r; }
  function amt(v) { return String(v == null ? '' : v).replace(/\.00$/, '').trim(); }
  function parts(v) { return String(v == null ? '' : v).split(';').map(function (x) { return x.trim(); }).filter(Boolean); }
  function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  var BR = 'BrightRock Fractured', STD = 'Standard';                                                    // the two kinds of life quote

  /* The next appointment as one phrase: "Friday 06/11/2026 at 14:30". Whatever part is missing is said to be still to be agreed. */
  function appointmentText(v) {
    var d = util.parseDate(v('next_appt')), t = util.parseTime(v('next_time')),
      ds = d ? util.weekdayName(d) + ' ' + util.formatDate(d) : String(v('next_appt') || '').trim(), ts = t ? util.formatTime(t) : String(v('next_time') || '').trim();
    if (ds && ts) return ds + ' at ' + ts;
    if (ds) return ds + ' (time to be agreed)';
    if (ts) return 'at ' + ts + ' (date to be agreed)';
    return '';
  }
  /* What the form holds for the action points: { client, letter_of_authority, schedules, credit_life, quotes, preferred_monthly_spend, referrals, undecided, instructions, appointment, notes }.
     A life quote (FNA, Shortfall, Reduced) says which kind it is: "BrightRock Fractured" (insurer BrightRock, built on the calculation page) or "Standard" (one or more insurers). */
  function facts(state) {
    var ctx = store.ctxFor(state), v = function (id) { return String(state.f[id] && state.f[id].v != null ? state.f[id].v : '').trim(); };
    var shows = function (id) { var f = schema.fieldsById[id], b = blockOfField[id]; return !!f && (!b || calc.showIf(b.cond, ctx)) && calc.showIf(f.cond, ctx); };
    var listOn = function (key) { var b = blockOfList[key]; return !b || calc.showIf(b.cond, ctx); };
    var out = { client: v('fname') || 'the client', letter_of_authority: v('loa') || 'not asked yet', schedules: [], credit_life: [], quotes: [], referrals: [], undecided: [], instructions: [], appointment: appointmentText(v), preferred_monthly_spend: v('pref_spend'), notes: [] };

    SCHEDS.forEach(function (c) {
      if (!shows(c[0])) return;
      var rows = [].concat(c[3]).reduce(function (a, k) { return a.concat(state.l[k] || []); }, []), held = rows.map(function (r) { return String(r.d.prov || '').trim(); }).filter(Boolean), choice = v(c[0]).split(';').map(function (x) { x = x.trim(); return x === schema.psClient[c[0].slice(3)] ? CLIENT : x; }).filter(Boolean);       // the area's own wording ("Requested Personal Risk Covers in meeting, await client response") is the "requested from client" choice
      if (choice.length && choice.every(function (x) { return x === schema.psNoSend; })) return;       // "Client does not need to send through": nothing for the assistant to chase
      choice = choice.filter(function (x) { return x !== schema.psNoSend; });
      var known = rows.length || (c[0] === 'ps_risk' && v('has_risk') === 'Yes') || (c[0] === 'ps_grp' && v('has_group') === 'Yes');
      if (!choice.length && !known) return;                                                      // a choice that was made always counts; "not asked yet" is chased only where the client is known to have the policies (a Yes, or a policy recorded)
      out.schedules.push({ what: c[2], held: held, requested: choice.length ? choice : ['not asked yet'], other: choice.indexOf(OTHER) >= 0 ? v(c[1]) : '' });
    });
    NOTE_BOXES.forEach(function (n) { var t = v(n.id).replace(/\s+\n/g, '\n').slice(0, 2000); if (t && shows(n.id) && calc.showIf(n.sec.cond, ctx)) out.notes.push({ page: n.page, note: t }); });
    var lifeOff = v(schema.panelsById.life.dec) === schema.NOT_PRIORITY;                          // credit life is part of the Life area: when it is not a priority, nothing is chased
    (state.l.debts || []).forEach(function (r) {
      var d = r.d, cl = String(d.cl || '').trim();
      if (lifeOff || !listOn('debts') || (!d.type && !d.prov && !d.desc) || cl === 'No') return;
      out.credit_life.push({ debt: String(d.type === 'Other' || !d.type ? d.desc || 'debt' : d.type).toLowerCase(), lender: d.prov || '', credit_life: cl === 'Yes' ? 'Yes' : 'not asked yet' });
    });

    if (shows('bf_fna_req') && v('bf_fna_req') === 'Request a quote') out.quotes.push(clean({ quote: 'FNA quote', kind: BR, type: shows('bf_fna_type') ? v('bf_fna_type') : '', basis: schema.brBasis.fna }));
    if (shows('bf_sf_req') && v('bf_sf_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Shortfall quote', kind: BR, type: shows('bf_sf_type') ? v('bf_sf_type') : '', basis: schema.brBasis.sf }));
    if (listOn('bfred')) (state.l.bfred || []).forEach(function (r) { if (r.d.req === 'Request a quote') out.quotes.push(clean({ quote: 'Reduced quote', kind: BR, type: r.d.type, monthly_amount: amt(r.d.amt), basis: schema.brBasis.red })); });
    if (shows('fna_req') && v('fna_req') === 'Request a quote') out.quotes.push(clean({ quote: 'FNA quote', kind: STD, type: shows('fna_type') ? v('fna_type') : '', insurers: shows('fna_ins') ? parts(v('fna_ins')) : [] }));
    if (shows('sf_req') && v('sf_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Shortfall quote', kind: STD, type: shows('sf_type') ? v('sf_type') : '', insurers: shows('sf_ins') ? parts(v('sf_ins')) : [] }));
    if (listOn('redq')) (state.l.redq || []).forEach(function (r) { if (r.d.req === 'Request a quote') out.quotes.push(clean({ quote: 'Reduced quote', kind: STD, type: r.d.type, insurers: parts(r.d.ins), monthly_amount: amt(r.d.amt) })); });
    if (listOn('raq')) (state.l.raq || []).forEach(function (r) { if (r.d.req === 'Request a quote') out.quotes.push(clean({ quote: 'Retirement annuity quote', insurer: r.d.ins, monthly_amount: amt(r.d.monthly), lump_sum: amt(r.d.lump) })); });
    if (shows('rgar_req') && v('rgar_req') === 'Request an RGAR') out.quotes.push(clean({ quote: 'Retirement goal analysis (RGAR)', retire_at: v('ret_age'), net_income_wanted_per_month: amt(v('ret_net')) }));
    if (listOn('invq')) (state.l.invq || []).forEach(function (r) { if (r.d.req === 'Request a quote') out.quotes.push(clean({ quote: 'Investment quote', purpose: r.d.purpose, product: r.d.product, insurer: r.d.ins, monthly_amount: amt(r.d.monthly), lump_sum: amt(r.d.lump) })); });
    if (shows('egar_req') && v('egar_req') === 'Request an EGAR') out.quotes.push(clean({ quote: 'Education goal analysis (EGAR)', children: (state.l.kids || []).length || '' }));
    if (shows('bs_req') && v('bs_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Buy & sell quote', insurer: v('bs_ins'), cover_amount: amt(v('bs_value')) }));
    if (shows('cl_req') && v('cl_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Contingent liability quote', lender: v('cl_lender'), loan_balance: amt(v('cl_bal')) }));
    if (shows('km_req') && v('km_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Keyman quote', keyman: v('km_name'), cover_amount: amt(v('km_amt')) }));

    if (shows('ref_med') && /^Valerie/.test(v('ref_med'))) out.referrals.push({ who: 'Valerie', about: /both/.test(v('ref_med')) ? 'medical aid and gap cover' : /gap/.test(v('ref_med')) ? 'gap cover' : 'medical aid' });
    if (shows('ref_will') && /^Capital Legacy/.test(v('ref_will'))) out.referrals.push({ who: 'Capital Legacy', about: 'the will' });
    if (shows('ref_sti') && /^Cameron/.test(v('ref_sti'))) out.referrals.push({ who: 'Cameron', about: 'short-term insurance' });

    schema.panels.forEach(function (P) {
      if (!P.dec) return;
      var d = v(P.dec), cm = v(P.cm);
      if (d === schema.UNSURE || d === schema.BUDGET) out.undecided.push(clean({ area: P.title, answer: d === schema.BUDGET ? 'needs to check the budget' : 'needs to think about it', comment: cm }));
      else if (d !== schema.NOT_PRIORITY && cm) out.instructions.push({ area: P.title, comment: cm });
    });
    return out;
  }
  /* ---------- Priorities to be Focused on (top of Client priorities and quotes needed) ----------
     Only the GREEN priorities (the client's decision is "Priority: client agrees"), in the order of their numbers 1 to 8, each with a point form summary of what is needed for it: the quotes and analyses to ask for, the
     information still to get from the client, the referral, and the adviser's own comment for the area. A yellow, a red or an undecided area is never in it; with no green area the box is empty and fills as the client agrees.
     focusFacts() is what Claude is sent; focusLocal() writes the same points plainly (used with no Anthropic key and until Claude's version arrives); focusText() puts the headings in, always from the form, never from Claude. */
  var AREA_SCHEDS = { life: ['personal risk policies', 'group risk benefits'], ra: ['retirement annuities', 'pension and provident funds'], inv: ['investments'] };
  var AREA_REFERRAL = { med: 'Valerie', will: 'Capital Legacy', st: 'Cameron' };
  function quoteArea(q) {
    if (q.kind === BR || q.kind === STD) return 'life';
    var n = String(q.quote || '');
    return /^Retirement annuity/.test(n) ? 'ra' : /^Retirement goal/.test(n) ? 'rgar' : /^Investment/.test(n) ? 'inv' : /^Education goal/.test(n) ? 'egar' : null;      // the business assurance quotes are not one of the eight priorities
  }
  function focusFacts(state) {
    var f = facts(state), v = function (id) { return String(state.f[id] && state.f[id].v != null ? state.f[id].v : '').trim(); }, out = { client: f.client, areas: [] };
    schema.panels.forEach(function (P) {
      if (!P.dec || !P.n || v(P.dec) !== schema.PRIORITY) return;
      var a = { number: P.n, area: P.title, about: P.sub }, cm = v(P.cm);
      if (cm) a.comment = cm;
      var quotes = f.quotes.filter(function (q) { return quoteArea(q) === P.id; });
      if (quotes.length) a.quotes_to_request = quotes.map(quotePoint);
      var sch = f.schedules.filter(function (x) { return (AREA_SCHEDS[P.id] || []).indexOf(x.what) >= 0; });
      if (sch.length) a.schedules = sch;
      if (P.id === 'life') {
        if (f.credit_life.length) a.credit_life = f.credit_life;
        if (f.preferred_monthly_spend && quotes.length) a.preferred_monthly_spend = f.preferred_monthly_spend;
      }
      var ref = f.referrals.filter(function (r) { return r.who === AREA_REFERRAL[P.id]; });
      if (ref.length) a.referral = ref;
      var held = summary.local(state, P.id).slice(0, 8);
      if (held.length) a.on_the_form = held;
      out.areas.push(a);
    });
    return out;
  }
  /* The plain points of one green area (focusFacts()' entry for it). */
  function focusAreaLocal(a) {
    var pts = [], sentence1 = function (x) { return /[.?!)]$/.test(x) ? x : x + '.'; };
    (a.quotes_to_request || []).forEach(function (q) { pts.push(q); });
    (a.schedules || []).forEach(function (s) {
      var r = s.requested, how = r.indexOf('not asked yet') >= 0 ? 'how they will come is still to be asked' : r.indexOf(OTHER) >= 0 && s.other ? s.other.replace(/[.\s]+$/, '') : r.indexOf(ASTUTE) >= 0 && r.indexOf(CLIENT) < 0 ? 'to be drawn from Astute with the signed LOA' : r.indexOf(CLIENT) >= 0 ? 'asked for from the client, awaiting the client' : 'other arrangement';
      pts.push('Current policy schedules for the ' + s.what + ': ' + how + '.');
    });
    (a.credit_life || []).forEach(function (c) { pts.push(c.credit_life === 'Yes' ? 'Credit life on the ' + c.debt + (c.lender ? ' with ' + c.lender : '') + ': get the details.' : 'Credit life on the ' + c.debt + (c.lender ? ' with ' + c.lender : '') + ': find out whether there is any.'); });
    if (a.preferred_monthly_spend) pts.push('Client prefers to spend ' + amt(a.preferred_monthly_spend) + ' p.m. on the life cover.');
    (a.referral || []).forEach(function (r) { pts.push('Referral: ' + r.who + ' to contact the client about ' + r.about + '.'); });
    if (a.comment) pts.push(sentence1('Your note: ' + a.comment.replace(/\s*\n\s*/g, ' ').replace(/[.\s]+$/, '')));
    if (!pts.length) pts.push('Nothing asked for yet: decide what to quote or refer.');
    return pts;
  }
  /* The box's text: a heading "1. Personal Risk Covers" for each green area and its points under it. byArea ({ number: [points] }, Claude's) replaces the plain points of an area it has points for. */
  function focusText(f, byArea) {
    return f.areas.map(function (a) {
      var pts = byArea && byArea[a.number] && byArea[a.number].length ? byArea[a.number] : focusAreaLocal(a);
      return a.number + '. ' + a.area + '\n' + pts.map(function (p) { return '- ' + String(p).replace(/^[\s\-•*]+/, ''); }).join('\n');
    }).join('\n\n');
  }
  function focusLocal(state) { return focusText(focusFacts(state)); }
  /* What the points were written from: they are out of date when this has changed. */
  function key(f) {
    var s = JSON.stringify(f), h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  }

  /* ---------- plain points, from the facts, for when Claude has not written them (yet) ---------- */
  function fin(s) { return /[.?!]$/.test(s) ? s : s + '.'; }                                              // a full stop, even after a bracket
  function sentence(s) { return /[.?!)]$/.test(s) ? s : s + '.'; }
  function an(w) { return /^(?:FNA|[aeiou])/i.test(w) ? 'an ' : 'a '; }
  function names(held) { return held.length ? ' (' + held.join(', ') + ')' : ''; }
  /* The points are orders to the assistant, so the client is always "the client Thandi", never the first name alone: the name could be taken for the assistant's own (a test with her name, or one like it). */
  var ASSISTANT = 'Sitamah';
  function clientRef(name) { return !name || name === 'the client' ? 'the client' : 'the client ' + name; }
  /* One quote or analysis asked for, as a point: "Request a BrightRock Fractured FNA quote (New Business): BR FNA Quote based on Fact Find." */
  function quotePoint(q) {
      var n = q.quote, bits = [];
      if (q.kind === BR || q.kind === STD) {                                                         // a life quote: which kind it is comes first
        var what = n === 'FNA quote' ? 'FNA' : n.replace(/ quote$/, '').toLowerCase(), ins = q.insurers || [], extra = [];
        if (q.type) extra.push(q.type);
        var tail = (extra.length ? ' (' + extra.join(', ') + ')' : '') + (q.monthly_amount ? ' for ' + q.monthly_amount + ' p.m.' : '');
        if (q.kind === BR) return fin('Request a BrightRock Fractured ' + what + ' quote' + tail + (q.basis ? ': ' + q.basis : ''));
        return fin('Request ' + (ins.length > 1 ? 'standard ' + what + ' quotes' : 'a standard ' + what + ' quote') + (ins.length ? ' from ' + andList(ins) : '') + (extra.length ? ' (' + extra.join(', ') + ')' : '') + (ins.length ? '' : ' (insurer still to be chosen)') + (q.monthly_amount ? ' for ' + q.monthly_amount + ' p.m.' : ''));
      }
      if (/^Retirement goal/.test(n)) { return ('Request a retirement goal analysis (RGAR)' + (q.retire_at || q.net_income_wanted_per_month ? ': retire' + (q.retire_at ? ' at ' + q.retire_at : '') + (q.net_income_wanted_per_month ? ' on ' + q.net_income_wanted_per_month + ' p.m. net in today\'s terms' : '') : '') + '.'); }
      if (/^Education goal/.test(n)) { return ('Request an education goal analysis (EGAR)' + (q.children ? ' for ' + (q.children === 1 ? 'the child' : 'the ' + q.children + ' children') : '') + '.'); }
      var line = 'Request ' + an(n) + (/^(?:FNA|Buy)/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1));
      if (q.type) bits.push(q.type); if (q.product) bits.push(q.product.toLowerCase()); if (q.purpose) bits.push(q.purpose.toLowerCase());
      if (bits.length) line += ' (' + bits.join(', ') + ')';
      if (q.insurer || q.lender || q.keyman) line += ' from ' + (q.insurer || q.lender || q.keyman);
      if (q.monthly_amount) line += ' for ' + q.monthly_amount + ' p.m.'; else if (q.lump_sum) line += ' for a lump sum of ' + q.lump_sum; else if (q.cover_amount) line += ' for cover of ' + q.cover_amount;
      return sentence(line.replace(/\.$/, ''));
  }
  function local(state) {
    var f = facts(state), who = clientRef(f.client), pts = [], loa = f.letter_of_authority;
    var astute = f.schedules.some(function (s) { return s.requested.indexOf(ASTUTE) >= 0; });
    if (loa === 'Yes') pts.push('Send ' + who + ' the LOA to sign' + (astute ? ', so the policy schedules can be drawn from Astute.' : '.'));
    else if (loa === 'Not now') pts.push('Do not send the LOA to ' + who + ' yet: not ready to sign. Raise it again at the follow-up appointment.');
    else if (loa === 'not asked yet' && astute) pts.push('Ask ' + who + ' whether the LOA can be sent for signing: it is needed to draw the policy schedules from Astute.');
    f.schedules.forEach(function (s) {
      var what = s.what + names(s.held), r = s.requested;
      if (r.indexOf('not asked yet') >= 0) { pts.push('Ask ' + who + ' how the current policy schedules for the ' + what + ' will be provided.'); return; }
      if (r.indexOf(CLIENT) >= 0) pts.push('Follow up with ' + who + ' for the current policy schedules, asked for in the meeting, for the ' + what + ': await client response.');
      if (r.indexOf(ASTUTE) >= 0) {
        if (loa === 'No') { if (r.indexOf(CLIENT) < 0) pts.push('Ask ' + who + ' to send the current policy schedules for the ' + what + ' directly: there is no signed LOA.'); }
        else pts.push('Draw the current policy schedules for the ' + what + ' from Astute once the signed LOA is back.');
      }
      if (r.indexOf(OTHER) >= 0) pts.push('Await the current policy schedules for the ' + what + ': ' + (s.other ? s.other.replace(/[.\s]+$/, '') : 'other arrangement (to be confirmed)') + '.');
    });
    f.credit_life.forEach(function (c) {
      pts.push(c.credit_life === 'Yes' ? 'Ask ' + who + ' for the credit life details' + (c.lender ? ' with ' + c.lender : '') + ' on the ' + c.debt + '.' : 'Ask ' + who + ' whether there is credit life' + (c.lender ? ' with ' + c.lender : '') + ' on the ' + c.debt + '.');
    });
    f.quotes.forEach(function (q) { pts.push(quotePoint(q)); });
    if (f.preferred_monthly_spend && f.quotes.some(function (q) { return q.kind === BR || q.kind === STD; })) pts.push('Note for the life quotes that ' + who + ' prefers to spend ' + amt(f.preferred_monthly_spend) + ' p.m.');
    f.referrals.forEach(function (r) { pts.push('Ask ' + r.who + ' to contact ' + who + ' about ' + r.about + '.'); });
    f.undecided.forEach(function (u) { pts.push('Follow up with ' + who + ' on ' + u.area + ': ' + u.answer + ' before deciding' + (u.comment ? ' (' + u.comment.replace(/[.\s]+$/, '') + ')' : '') + '.'); });
    pts.push(f.appointment ? 'Set up a follow-up appointment with ' + who + (/^at /.test(f.appointment) ? ' ' : ' for ') + f.appointment + '.' : 'Set up a follow-up appointment with ' + who + ' (date and time to be agreed).');
    return pts;
  }
  /* The line that opens the box, put in by the form (never written by Claude): the points are for the assistant. */
  function header(state) {
    var v = function (id) { return String((state.f[id] && state.f[id].v) || '').trim(); }, nm = (v('fname') + ' ' + v('sname')).trim();
    return ASSISTANT + ', please action these for ' + clientRef(nm) + ':';
  }
  /* The points as the box holds them: with a state, the opening line to the assistant first. */
  function text(lines, state) { return (state ? header(state) + '\n' : '') + lines.map(function (l) { return '- ' + l; }).join('\n'); }
  /* The BrightRock Fractured quotes asked for, short: ["FNA (New Business)", "Shortfall", "Reduced R 2 500 p.m."] (shown at the top of the BrightRock Risk Calculation page). */
  function brightRockAsked(state) {
    return facts(state).quotes.filter(function (q) { return q.kind === BR; }).map(function (q) {
      return q.quote.replace(/ quote$/, '') + (q.type ? ' (' + q.type + ')' : '') + (q.monthly_amount ? ' ' + q.monthly_amount + ' p.m.' : '');
    });
  }

  return { facts: facts, key: key, local: local, focusFacts: focusFacts, focusLocal: focusLocal, focusText: focusText, text: text, header: header, clientRef: clientRef, ASSISTANT: ASSISTANT, brightRockAsked: brightRockAsked };
});
