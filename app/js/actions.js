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
  /* The notes box of the page each policy schedule belongs to: what the adviser noted there is sent with the schedule, so a note such as "No need to send through" or "she says she emailed it" is read against it. */
  var SCHED_NOTE = { ps_risk: 'n_cover', ps_grp: 'n_cover', ps_ra: 'n_retire', ps_pp: 'n_retire', ps_inv: 'n_inv' };
  /* Every box the adviser writes free text in that is not an answer: the Notes box of each page, the Health notes, the comments boxes of the quote tables and of the BrightRock calculation. (Not the action points box itself, not the "Priorities to be Focused on" box (see focusNote), not the Current Client File Summary Notes (background from an old file, never an instruction to Sitamah), not a box kept off the PDF, and not the priority comments, which go with the areas as "instructions".) */
  schema.sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) { if (f.opt && f.t === 'area' && !f.nopdf && f.id !== 'pa_actions' && f.id !== 'focus' && f.id !== 'cc_notes') NOTE_BOXES.push({ id: f.id, page: s.title + (b.title ? ' / ' + b.title : ''), sec: s, block: b }); }); }); });
  var NOTE_COLS = [];                                                                                     // the notes columns of the lists (a debt's Notes, a policy's Notes ...): list, column, what the list is
  Object.keys(schema.lists).forEach(function (k) { schema.lists[k].cols.forEach(function (c) { if (c.t === 'area' || c.k === 'notes') NOTE_COLS.push({ list: k, col: c.k, title: schema.lists[k].title || k, one: schema.lists[k].one || 'row' }); }); });
  var CLIENT = 'Requested from client in meeting', ASTUTE = 'Draw from Astute (with signed LOA)', OTHER = 'Other';
  /* the policy schedule lists: box, its "Other" box, what to call the policies, and the list they are in */
  var SCHEDS = [['ps_risk', 'ps_risk_ot', 'personal risk policies', 'risk'], ['ps_grp', 'ps_grp_ot', 'group risk benefits', 'grp'], ['ps_ra', 'ps_ra_ot', 'retirement annuities', 'ret_ra'],
    ['ps_pp', 'ps_pp_ot', 'pension and provident funds', 'ret_pp'], ['ps_inv', 'ps_inv_ot', 'investments', 'inv']];

  function clean(o) { var r = {}; Object.keys(o).forEach(function (k) { if (o[k] != null && String(o[k]).trim() !== '') r[k] = o[k]; }); return r; }
  function amt(v) { return String(v == null ? '' : v).replace(/\.00$/, '').trim(); }
  function parts(v) { return String(v == null ? '' : v).split(';').map(function (x) { return x.trim(); }).filter(Boolean); }
  function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  var CREDIT_LIFE_TYPES = ['Home loan', 'Vehicle finance', 'Personal loan'];
  var BR = 'BrightRock Fractured', STD = 'Standard';                                                    // the two kinds of life quote

  /* The next appointment as one phrase: "Friday 06/11/2026 at 14:30". Whatever part is missing is said to be still to be agreed. */
  function appointmentText(v) {
    var raw = String(v('next_appt') || '').trim(), bare = raw.replace(/^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i, '');       // a weekday typed in front is dropped: the weekday said is always the one the digits give (a "Friday" on a Thursday date would send the assistant to the wrong day)
    var d = util.parseDate(raw) || util.parseDate(bare), t = util.parseTime(v('next_time')),
      ds = d ? util.weekdayName(d) + ' ' + util.formatDate(d) : raw, ts = t ? util.formatTime(t) : String(v('next_time') || '').trim();
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
    var out = { client: v('fname') || 'the client', letter_of_authority: v('loa') || 'not asked yet', schedules: [], credit_life: [], quotes: [], referrals: [], undecided: [], instructions: [], appointment: appointmentText(v), preferred_monthly_spend: shows('pref_spend') ? v('pref_spend') : '', notes: [] };

    SCHEDS.forEach(function (c) {
      if (!shows(c[0])) return;
      var rows = [].concat(c[3]).reduce(function (a, k) { return listOn(k) ? a.concat((state.l[k] || []).filter(function (r) { return store.rowFilled(k, r); })) : a; }, []), held = rows.map(function (r) { return String(r.d.prov || '').trim(); }).filter(Boolean), choice = v(c[0]).split(';').map(function (x) { x = x.trim(); return x === schema.psClient[c[0].slice(3)] ? CLIENT : x; }).filter(Boolean);       // the area's own wording ("Requested Personal Risk Covers in meeting, await client response") is the "requested from client" choice
      var onFile = function (x) { return x === schema.psSaved || x === schema.psNoSend; };                // Policy Schedules saved in Client File (and the choice it replaced): nothing for the assistant to chase
      if (choice.length && choice.every(onFile)) return;
      choice = choice.filter(function (x) { return !onFile(x); });
      var known = rows.length || (c[0] === 'ps_risk' && v('has_risk') === 'Yes') || (c[0] === 'ps_grp' && v('has_group') === 'Yes');
      if (!choice.length && !known) return;                                                      // a choice that was made always counts; "not asked yet" is chased only where the client is known to have the policies (a Yes, or a policy recorded)
      var sch = { what: c[2], held: held, requested: choice.length ? choice : ['not asked yet'], other: choice.indexOf(OTHER) >= 0 ? v(c[1]) : '' }, nt = v(SCHED_NOTE[c[0]]).replace(/\s+\n/g, '\n').slice(0, 1200);
      /* The page's note goes with a schedule only when the page has that one schedule. Where two schedules share the page (the RA and the pension and provident funds on Retirement funding; the personal risk and
         group risk on the cover page) the note could be about either: it is not attached to both (it would make Claude drop a chase that the note is not about); it is read once, in notes[] (page_note_id), and each
         schedule says which other schedule shares the page (shared_with). */
      var mates = SCHEDS.filter(function (o) {                                                         // the other schedule of the page counts when it is in play: ticked (even "saved in file") or the client is known to have those policies
        return o[0] !== c[0] && SCHED_NOTE[o[0]] === SCHED_NOTE[c[0]] && shows(o[0]) && (v(o[0]) !== '' || [].concat(o[3]).some(function (k) { return listOn(k) && (state.l[k] || []).some(function (r) { return store.rowFilled(k, r); }); }) || (o[0] === 'ps_grp' && v('has_group') === 'Yes') || (o[0] === 'ps_risk' && v('has_risk') === 'Yes'));
      });
      if (nt && !mates.length) sch.note_on_this_page = nt;
      else if (nt) { sch.shared_with = mates.map(function (o) { return o[2]; }).join(' and '); sch.page_note_id = SCHED_NOTE[c[0]]; }
      out.schedules.push(sch);
    });
    NOTE_BOXES.forEach(function (n) { var t = v(n.id).replace(/\s+\n/g, '\n').slice(0, 2000); if (t && shows(n.id) && calc.showIf(n.sec.cond, ctx)) out.notes.push({ id: n.id, page: n.page, note: t }); });
    /* the notes written on a row of a list (a debt, a policy, a business policy): which row is said in the page, so a note on "Debt 2" is read against that debt */
    NOTE_COLS.forEach(function (c) {
      if (!listOn(c.list)) return;
      (state.l[c.list] || []).forEach(function (r, i) {
        var t = String(r.d[c.col] || '').replace(/\s+\n/g, '\n').trim().slice(0, 800); if (!t) return;
        var who = [r.d.type, r.d.prov || r.d.desc || r.d.name].filter(function (x) { return x && String(x).trim(); }).map(function (x) { return String(x).trim(); }).join(', ');
        out.notes.push({ id: c.list + ':' + (i + 1) + ':' + c.col, page: c.title + ', ' + c.one.toLowerCase() + ' ' + (i + 1) + (who ? ' (' + who + ')' : ''), note: t });
      });
    });
    /* what the voice heard and could not place on the form, still open: it may well be something to do */
    (state.unplaced || []).forEach(function (u) {
      var t = String(u.text || '').trim(); if (!t) return;
      var sec = u.sec ? (schema.sections.filter(function (x) { return x.id === u.sec; })[0] || {}).title : '';
      out.notes.push({ id: 'unplaced:' + (u.id || out.notes.length), page: 'Heard but not placed' + (sec ? ' (' + sec + ')' : ''), note: t.slice(0, 300) });
    });
    /* the "Priorities to be Focused on" box is written from the rest of the form, so what is in it is already in these facts: it is read only when the adviser has typed in it himself */
    if (state.focus && state.focus.edited && v('focus')) out.notes.push({ id: 'focus', page: 'Priorities to be Focused on (typed by the adviser)', note: v('focus').replace(/\s+\n/g, '\n').slice(0, 2000) });
    if (v('on_call')) out.people_on_the_call = v('on_call');
    var lifeOff = v(schema.panelsById.life.dec) === schema.NOT_PRIORITY;                          // credit life is part of the Life area: when it is not a priority, nothing is chased
    /* Credit life is asked only about a debt that can carry it: a Home loan, Vehicle finance or Personal loan with a lender, that the client pays (the client, or jointly), and that is not paid up. A cell phone, stock, a loan from a
       person, or a credit card is never chased; it is only listed when the client says there is credit life on it (Yes). "Not sure" is asked again. */
    (state.l.debts || []).forEach(function (r) {
      var d = r.d, cl = String(d.cl || '').trim(), type = String(d.type || ''), lender = String(d.prov || '').trim(), payer = String(d.payer || '').trim();
      if (lifeOff || !listOn('debts') || (!d.type && !d.prov && !d.desc) || cl === 'No') return;
      if (payer && payer !== 'Client' && payer !== 'Joint') return;                                    // somebody else's debt
      if (String(d.bal || '').trim() !== '' && util.isAmount(d.bal) && util.num(d.bal) === 0) return;       // paid up
      if (!(CREDIT_LIFE_TYPES.indexOf(type) >= 0 && lender) && cl !== 'Yes') return;
      out.credit_life.push({ debt: String(d.type === 'Other' || !d.type ? d.desc || 'debt' : d.type).toLowerCase(), lender: lender, credit_life: cl === 'Yes' ? 'Yes' : cl === 'Not sure' ? 'not sure' : 'not asked yet' });
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
    if (shows('egar_req') && v('egar_req') === 'Request an EGAR') out.quotes.push(clean({ quote: 'Education goal analysis (EGAR)', children: listOn('kids') ? (state.l.kids || []).filter(function (r) { return Object.keys(r.d).some(function (k) { return String(r.d[k] || '').trim() !== ''; }); }).length || '' : '' }));
    if (shows('bs_req') && v('bs_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Buy & sell quote', insurer: v('bs_ins'), cover_amount: amt(v('bs_value')) }));
    if (shows('cl_req') && v('cl_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Contingent liability quote', lender: v('cl_lender'), loan_balance: amt(v('cl_bal')) }));
    if (shows('km_req') && v('km_req') === 'Request a quote') out.quotes.push(clean({ quote: 'Keyman quote', keyman: v('km_name'), cover_amount: amt(v('km_amt')) }));

    /* A referral for cover that is now with another broker is a take-over: the point for Sitamah says so, so the partner knows what the call is about (version 3.4). */
    var other = function (id) { return v(id) === 'Other broker' && !(state.f[id] && state.f[id].st === 'preset'); };       // the Broker on record boxes start as Other broker (preset): only an answered one means the cover is with another broker
    if (shows('ref_med') && /^Valerie/.test(v('ref_med'))) {
      var mAbout = /both/.test(v('ref_med')) ? 'medical aid and gap cover' : /gap/.test(v('ref_med')) ? 'gap cover' : 'medical aid';
      var mMed = /medical aid/.test(mAbout) && (v('ma') === 'Medical aid' || v('ma') === 'Hospital plan') && other('ma_broker'), mGap = /gap/.test(mAbout) && v('gap') === 'Yes' && other('gap_broker');
      out.referrals.push(mMed || mGap ? { who: 'Valerie', about: mAbout, takeover: true, takeover_of: mMed && mGap ? 'medical aid and gap cover' : mMed ? 'medical aid' : 'gap cover' } : { who: 'Valerie', about: mAbout });
    }
    if (shows('ref_will') && /^Capital Legacy/.test(v('ref_will'))) out.referrals.push(v('will') === 'Yes' && v('will_where') === 'Capital Legacy' && other('will_broker') ? { who: 'Capital Legacy', about: 'the will', takeover: true } : { who: 'Capital Legacy', about: 'the will' });
    if (shows('ref_sti') && /^Cameron/.test(v('ref_sti'))) out.referrals.push((v('sti') === 'Yes' && other('sti_broker')) ? { who: 'Cameron', about: 'short-term insurance', takeover: true } : { who: 'Cameron', about: 'short-term insurance' });

    schema.panels.forEach(function (P) {
      if (!P.dec) return;
      var d = v(P.dec), cm = v(P.cm);
      if (d === schema.UNSURE || d === schema.BUDGET) out.undecided.push(clean({ id: cm ? P.cm : '', area: P.title, answer: d === schema.BUDGET ? 'needs to check the budget' : 'needs to think about it', comment: cm }));
      else if (d !== schema.NOT_PRIORITY && cm) out.instructions.push({ id: P.cm, area: P.title, comment: cm });
      /* The reason an area is not a priority lives in its Comments (3.4), and it may hold something to do ("client asked to revisit life cover in March: diarise a reminder"). It is not an instruction (the area is declined),
         so it goes with the notes, tagged as a declined-area comment, for Claude to give a verdict (action, covered or info). What the form wrote itself (the preset comment, the earlier-version migration sentence) is left out:
         nothing automatic is chased. */
      else if (d === schema.NOT_PRIORITY && cm && calc.showIf(P.cond, ctx) && !(state.f[P.cm] && state.f[P.cm].st === 'preset') && cm.replace(store.NO_CONTACT_NOTE, '').trim() !== '') out.notes.push({ id: P.cm, page: 'Declined area: ' + P.title, note: cm.replace(store.NO_CONTACT_NOTE, '').replace(/\s+\n/g, '\n').trim().slice(0, 1200), declined_area: true });
    });
    return out;
  }
  /* ---------- Priorities to be Focused on (top of Client priorities and quotes needed) ----------
     Only the GREEN priorities (the client's decision is "Priority: client agrees"), in the order of their numbers 1 to 8, each with a point form summary of what is needed for it: the quotes and analyses to ask for, the
     information still to get from the client, the referral, and the adviser's own comment for the area. A yellow, a red or an undecided area is never in it; with no green area the box is empty and fills as the client agrees.
     focusFacts() is what Claude is sent; focusLocal() writes the same points plainly (used with no Anthropic key and until Claude's version arrives); focusText() puts the headings in, always from the form, never from Claude. */
  var AREA_SCHEDS = { life: ['personal risk policies', 'group risk benefits'], ra: ['retirement annuities', 'pension and provident funds'], inv: ['investments'] };
  var AREA_REFERRAL = { med: 'Valerie', will: 'Capital Legacy', st: 'Cameron' };
  var AREA_NOTES = { life: ['n_cover', 'n_debts'], ra: ['n_retire'], rgar: ['n_retire'], inv: ['n_inv'], egar: ['n_kids'], med: ['n_ma', 'n_gap'], will: ['n_will'], st: ['n_sti'] };       // the notes boxes of the pages an area is about
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
      if (P.id === 'life' && f.preferred_monthly_spend && quotes.length) a.preferred_monthly_spend = f.preferred_monthly_spend;       // credit life stays with the action points for Sitamah
      var ref = f.referrals.filter(function (r) { return r.who === AREA_REFERRAL[P.id]; });
      if (ref.length) a.referral = ref;
      var nts = (AREA_NOTES[P.id] || []).map(function (id) { return v(id).replace(/\s+\n/g, '\n').slice(0, 1200); }).filter(Boolean);
      if (nts.length) a.notes = nts;
      var held = summary.local(state, P.id).slice(0, 8);
      if (held.length) a.on_the_form = held;
      out.areas.push(a);
    });
    return out;
  }
  /* One green area as three short parts (3.6): Recommend (one line: what Paul recommends, from the quotes asked for or the referral), Client (one line: the client's response, from the comment), Come back with (up to three
     short lines, only if something is still to come). This is the plain version, from the form (focusFacts()' entry for the area); Claude's version has the same shape. */
  var ONE = 200;
  function oneLine(x) { var t = String(x == null ? '' : x).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > ONE ? t.slice(0, ONE - 1).replace(/\s+\S*$/, '') + '\u2026' : t; }
  function focusAreaLocal(a) {
    var sentence1 = function (x) { return /[.?!)\u2026]$/.test(x) ? x : x + '.'; }, back = [], recommend = '';
    var quotes = a.quotes_to_request || [], refs = a.referral || [];
    if (quotes.length) { recommend = quotes[0]; back = quotes.slice(1); }
    else if (refs.length) recommend = 'Referral: ' + refs[0].who + ' to contact the client about ' + refs[0].about + oppText(refs[0]) + '.';
    else recommend = 'Nothing asked for yet: decide what to quote or refer.';
    if (quotes.length) refs.forEach(function (r) { back.push('Referral: ' + r.who + ' to contact the client about ' + r.about + oppText(r) + '.'); });
    else refs.slice(1).forEach(function (r) { back.push('Referral: ' + r.who + ' to contact the client about ' + r.about + oppText(r) + '.'); });
    (a.schedules || []).forEach(function (sc) {
      var r = sc.requested, how = [];                                                                 // one clause for each arrangement ticked, as local() has one point for each
      if (r.indexOf('not asked yet') >= 0) how.push('how they will come is still to be asked');
      else {
        if (r.indexOf(CLIENT) >= 0) how.push('asked for from the client, awaiting the client');
        if (r.indexOf(ASTUTE) >= 0) how.push('to be drawn from Astute with the signed LOA');
        if (r.indexOf(OTHER) >= 0) how.push(sc.other ? sc.other.replace(/[.\s]+$/, '') : 'other arrangement');
        if (!how.length) how.push('other arrangement');
      }
      back.push('Current policy schedules for the ' + sc.what + ': ' + how.join('; ') + '.');
    });
    return { recommend: oneLine(recommend), client: a.comment ? sentence1(oneLine(a.comment.replace(/[.\s]+$/, ''))) : 'Agrees.', back: back.slice(0, 3).map(oneLine) };
  }
  /* A set of parts as Claude or the form gives them ({ recommend, client, back: [] }, or an older plain list of points, which are the "come back with" lines). */
  function focusParts(x) {
    if (Array.isArray(x)) return { recommend: '', client: '', back: x.map(oneLine).filter(Boolean).slice(0, 3) };
    if (!x || typeof x !== 'object') return null;
    var o = { recommend: oneLine(x.recommend), client: oneLine(x.client), back: (Array.isArray(x.back) ? x.back : x.back ? [x.back] : []).map(oneLine).filter(Boolean).slice(0, 3) };
    return o.recommend || o.client || o.back.length ? o : null;
  }
  /* The box's text: a heading "1. Personal Risk Covers" for each green area, then Recommend, Client and Come back with. byArea ({ number: parts }, Claude's) replaces the plain version of an area it has parts for. */
  function focusText(f, byArea) {
    return f.areas.map(function (a) {
      var p = focusParts(byArea && byArea[a.number]) || focusAreaLocal(a), out = [a.number + '. ' + a.area];
      if (p.recommend) out.push('Recommend: ' + p.recommend);
      if (p.client) out.push('Client: ' + p.client);
      if (p.back.length) { out.push('Come back with:'); p.back.forEach(function (x) { out.push('- ' + String(x).replace(/^[\s\-\u2022*]+/, '')); }); }
      return out.join('\n');
    }).join('\n\n');
  }
  function focusLocal(state) { return focusText(focusFacts(state)); }
  /* Every note the facts hold that Claude has to give a verdict on (action, covered, info): the ids of the notes, of the priority comments (instructions) and of the comments of the undecided areas. */
  function noteIds(f) {
    return [].concat(f && f.notes || [], f && f.instructions || [], (f && f.undecided || []).filter(function (u) { return u.comment; })).map(function (x) { return x.id; }).filter(Boolean);
  }
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
  /* A referral for cover that is with another broker is an opportunity to quote, never a take-over done: the client decides afterwards. */
  var OPPORTUNITY = 'currently with another broker: an opportunity to quote; the client will decide';
  function oppText(r) { return !r.takeover ? '' : ' (' + (r.takeover_of && r.takeover_of !== r.about ? 'the ' + r.takeover_of + ' is ' : '') + OPPORTUNITY + ')'; }
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
      pts.push(c.credit_life === 'Yes' ? 'Ask ' + who + ' for the credit life details' + (c.lender ? ' with ' + c.lender : '') + ' on the ' + c.debt + '.' : 'Ask ' + who + ' whether there is credit life' + (c.lender ? ' with ' + c.lender : '') + ' on the ' + c.debt + (c.credit_life === 'not sure' ? ' (the client was not sure)' : '') + '.');
    });
    f.quotes.forEach(function (q) { pts.push(quotePoint(q)); });
    if (f.preferred_monthly_spend && f.quotes.some(function (q) { return q.kind === BR || q.kind === STD; })) pts.push('Note for the life quotes that ' + who + ' prefers to spend ' + amt(f.preferred_monthly_spend) + ' p.m.');
    f.referrals.forEach(function (r) { pts.push('Ask ' + r.who + ' to contact ' + who + ' about ' + r.about + oppText(r) + '.'); });
    f.undecided.forEach(function (u) { pts.push('Follow up with ' + who + ' on ' + u.area + ': ' + u.answer + ' before deciding' + (u.comment ? ' (' + u.comment.replace(/[.\s]+$/, '') + ')' : '') + '.'); });
    pts.push(f.appointment ? 'Set up a follow-up appointment with ' + who + (/^at /.test(f.appointment) ? ' ' : ' for ') + f.appointment + '.' : 'Set up a follow-up appointment with ' + who + ' (date and time to be agreed).');
    return pts;
  }
  /* The line that opens the box, put in by the form (never written by Claude): the points are for the assistant. */
  function header(state) {
    var v = function (id) { return String((state.f[id] && state.f[id].v) || '').trim(); }, nm = (v('fname') + ' ' + v('sname')).trim();
    return ASSISTANT + ', please action these for ' + clientRef(nm) + ':';
  }
  /* A last look at every point before it is shown (whoever wrote it, the form or Claude): a point that chases something the form says does not exist is dropped. Group risk is not asked when there is none; pension and
     provident fund schedules are not chased unless the client has them; credit life is not asked about a debt that cannot carry it. (Quotes are never touched: a Shortfall quote's basis names group risk.) */
  function checkPoints(state, lines) {
    var v = function (id) { return String(state.f[id] && state.f[id].v != null ? state.f[id].v : '').trim(); }, f = facts(state);
    return lines.filter(function (l) {
      var t = String(l).toLowerCase();
      if (/^request\b/.test(t)) return true;
      if (/group risk/.test(t) && v('has_group') !== 'Yes' && !(state.l.grp || []).length) return false;
      if (/pension|provident/.test(t) && /schedule/.test(t) && v('has_pp') !== 'Yes' && !(state.l.ret_pp || []).length) return false;
      if (/credit life/.test(t) && !f.credit_life.length) return false;
      return true;
    });
  }
  /* The points as the box holds them: with a state, the opening line to the assistant first. */
  function text(lines, state) { return (state ? header(state) + '\n' : '') + (state ? checkPoints(state, lines) : lines).map(function (l) { return '- ' + l; }).join('\n'); }
  /* The BrightRock Fractured quotes asked for, short: ["FNA (New Business)", "Shortfall", "Reduced R 2 500 p.m."] (shown at the top of the BrightRock Risk Calculation page). */
  function brightRockAsked(state) {
    return facts(state).quotes.filter(function (q) { return q.kind === BR; }).map(function (q) {
      return q.quote.replace(/ quote$/, '') + (q.type ? ' (' + q.type + ')' : '') + (q.monthly_amount ? ' ' + q.monthly_amount + ' p.m.' : '');
    });
  }

  return { checkPoints: checkPoints, OPPORTUNITY: OPPORTUNITY, facts: facts, noteIds: noteIds, key: key, local: local, focusFacts: focusFacts, focusLocal: focusLocal, focusText: focusText, text: text, header: header, clientRef: clientRef, ASSISTANT: ASSISTANT, brightRockAsked: brightRockAsked };
});
