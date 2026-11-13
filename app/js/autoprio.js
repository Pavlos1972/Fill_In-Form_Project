/* Client priorities and quotes needed: what the earlier pages already say about the client (version 3.4).
   Three things, none of them ever green and none of them an approach to the client:
   1. AUTOMATIC "Not a priority", only where a fact makes the area untouchable or pointless: medical aid paid through the client's company, a will up to date with another provider (or with Capital Legacy and
      Paul K already the broker), short-term insurance paid through the company, no children. The form fills an EMPTY decision, writes the comment from the facts and sets the area's referral or request box to
      Not required; all of it is marked "preset". It goes again if the fact changes and nobody touched it. Once the adviser changes the decision of an area, the area is his (state.auto.skip) and the form never sets it again.
   2. SUGGESTIONS, shown on screen as one line with a button, for a take-over chance (privately paid medical aid or short-term with another broker, a will with Capital Legacy under another broker) and for two
      "does not apply" cases (all children at tertiary level, no retirement funds for an RGAR). The button is for when the client has said yes. Nothing is stored until it is pressed.
   3. The starting value of Type of quote: New Business when the client has no personal risk cover, Servicing when a policy has Paul K as its broker.
   The rules read plain answers (state.f / state.l), so they can be tested without a screen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./schema.js'));
  else { root.FF = root.FF || {}; root.FF.autoprio = factory(root.FF.schema); }
})(typeof self !== 'undefined' ? self : this, function (schema) {
  var NO = schema.NOT_PRIORITY, YES = schema.PRIORITY, NOT_REQUIRED = 'Not required';
  function v(state, id) { var c = state.f[id]; return c ? String(c.v == null ? '' : c.v).trim() : ''; }
  function rows(state, key) { return (state.l && state.l[key]) || []; }

  /* The areas the form can decide, and the box in each area that is set to Not required with it. */
  var AREAS = { egar: { ref: 'egar_req' }, med: { ref: 'ref_med' }, will: { ref: 'ref_will' }, st: { ref: 'ref_sti' } };

  /* ---------- 1. the outcomes the facts give: the comment, or '' for none ---------- */
  function outcome(state, id) {
    if (id === 'med') {
      if ((v(state, 'ma') === 'Medical aid' || v(state, 'ma') === 'Hospital plan') && v(state, 'ma_broker') === 'Through company') return 'Medical aid is paid through the client\'s company (company broker) and cannot be touched, so gap cover is not pursued either.';
    } else if (id === 'will') {
      if (v(state, 'will') === 'Yes' && v(state, 'will_up') === 'Yes') {
        if (v(state, 'will_where') === 'Other provider') {
          var when = v(state, 'will_date'), who = v(state, 'will_where_other');
          return 'Will is up to date' + (when ? ' (last updated ' + when + ')' : '') + ' and held with ' + (who || 'another provider') + ', not Capital Legacy.';
        }
        if (v(state, 'will_where') === 'Capital Legacy' && v(state, 'will_broker') === 'Paul K') return 'Will is up to date with Capital Legacy and we are the broker.';
      }
    } else if (id === 'st') {
      if (v(state, 'sti') === 'Yes' && v(state, 'sti_broker') === 'Through company') return 'Short-term insurance is paid through the client\'s company.';
    } else if (id === 'egar') {
      if (v(state, 'has_kids') === 'No') return 'No children recorded, so there is no education goal to analyse.';
    }
    return '';
  }

  /* Fill the empty decisions the facts decide, and take back the ones the form set that the facts no longer decide. Safe to run any number of times. */
  function apply(state) {
    if (!state.auto || typeof state.auto !== 'object') state.auto = { skip: {} };
    if (!state.auto.skip) state.auto.skip = {};
    Object.keys(AREAS).forEach(function (id) {
      var P = schema.panelsById[id]; if (!P || !P.dec || state.auto.skip[id]) return;
      var a = AREAS[id], note = outcome(state, id), dec = state.f[P.dec], cm = state.f[P.cm], ref = state.f[a.ref];
      if (!dec || !cm || !ref) return;
      var mine = dec.st === 'preset' && dec.v === NO;                                            // set by the form earlier and not touched since
      if (note) {
        if (dec.v === '' || mine) {
          state.f[P.dec] = { v: NO, st: 'preset' };
          if (cm.v === '' || cm.st === 'preset') state.f[P.cm] = { v: note, st: 'preset' };
          if (ref.v === '' || ref.st === 'preset') state.f[a.ref] = { v: NOT_REQUIRED, st: 'preset' };
        }
      } else if (mine) {
        state.f[P.dec] = { v: '', st: 'empty' };
        if (cm.st === 'preset') state.f[P.cm] = { v: '', st: 'empty' };
        if (ref.st === 'preset' && ref.v === NOT_REQUIRED) state.f[a.ref] = { v: '', st: 'empty' };
      }
    });
    typeStart(state);
  }

  /* The adviser changes the decision of an area that the form had set: the area is his from now on. Called by the store before the new value goes in. */
  function touched(state, id, prev) {
    if (!state.auto || !state.auto.skip) return;
    Object.keys(AREAS).forEach(function (area) {
      var P = schema.panelsById[area];
      if (P && P.dec === id && prev && prev.st === 'preset' && prev.v === NO) state.auto.skip[area] = true;
    });
  }

  /* ---------- 2. suggestions: one line and a button, only while the decision is empty ---------- */
  function referral(who, label, text, comment, ref, refValue, dec) {
    return { text: text, label: label, set: [[dec.dec, dec.value], [dec.cm, comment], [ref, refValue]] };
  }
  function suggestion(state, id) {
    var P = schema.panelsById[id]; if (!P || !P.dec) return null;
    if (v(state, P.dec) !== '' || (state.auto && state.auto.skip && state.auto.skip[id])) return null;
    var yes = { dec: P.dec, cm: P.cm, value: YES }, no = { dec: P.dec, cm: P.cm, value: NO };
    if (id === 'med' && (v(state, 'ma') === 'Medical aid' || v(state, 'ma') === 'Hospital plan') && v(state, 'ma_broker') === 'Other broker')
      return referral('Valerie', 'Valerie to contact for medical aid', 'Medical aid is privately paid and with another broker. The client may be open to Valerie taking it over.',
        'Medical aid is with another broker. The client is open to Valerie taking it over.', 'ref_med', 'Valerie to contact for medical aid', yes);
    if (id === 'st') {
      if (v(state, 'sti') === 'Yes' && v(state, 'sti_broker') === 'Other broker')
        return referral('Cameron', 'Cameron to contact client', 'Short-term is with the client\'s own broker. If the client is open to a quote, Cameron can be asked.',
          'Short-term is with the client\'s own broker. The client is open to a quote from Cameron.', 'ref_sti', 'Cameron to contact client', yes);
      if (v(state, 'sti') === 'Handled by spouse')
        return referral('Cameron', 'Cameron to contact client', 'Short-term is paid by the spouse. If the client is open to a quote, Cameron can be asked.',
          'Short-term is paid by the spouse. The client is open to a quote from Cameron.', 'ref_sti', 'Cameron to contact client', yes);
    }
    if (id === 'will' && v(state, 'will') === 'Yes' && v(state, 'will_up') === 'Yes' && v(state, 'will_where') === 'Capital Legacy' && v(state, 'will_broker') === 'Other broker')
      return referral('Capital Legacy', 'Capital Legacy to contact client', 'Will is up to date with Capital Legacy under another broker. We have a code with Capital Legacy and can take over as brokers.',
        'Will is up to date with Capital Legacy under another broker. Capital Legacy to take over as brokers.', 'ref_will', 'Capital Legacy to contact client', yes);
    if (id === 'egar') {
      var kids = rows(state, 'kids').filter(function (r) { return r.d.stage || r.d.name || r.d.dob; });
      if (v(state, 'has_kids') !== 'No' && kids.length && kids.every(function (r) { return r.d.stage === 'Tertiary'; }))
        return referral('', 'Not a priority', 'All children are at tertiary level.', 'All children are at tertiary level.', 'egar_req', NOT_REQUIRED, no);
    }
    if (id === 'rgar' && v(state, 'has_ra') === 'No' && v(state, 'has_pp') === 'No' && !rows(state, 'ret_ra').some(rowHas) && !rows(state, 'ret_pp').some(rowHas) && !rows(state, 'inv').some(function (r) { return r.d.type === 'Living annuity'; }))
      return referral('', 'Not a priority', 'No retirement funds are recorded, so there is nothing to analyse.', 'No retirement funds are recorded, so there is nothing to analyse.', 'rgar_req', NOT_REQUIRED, no);
    return null;
  }
  function rowHas(r) { return Object.keys(r.d || {}).some(function (k) { return r.d[k]; }); }
  /* The button: the decision, the referral or request box and (only when it is empty) the comment, each as the adviser's own answer. The area is his from now on. */
  function take(state, id) {
    var s = suggestion(state, id); if (!s) return false;
    s.set.forEach(function (x) {
      var box = state.f[x[0]]; if (!box) return;
      if (x[0] === schema.panelsById[id].cm && box.v !== '') return;                              // a comment already written is kept
      state.f[x[0]] = { v: x[1], st: 'confirmed' };
    });
    if (!state.auto) state.auto = { skip: {} };
    state.auto.skip[id] = true;
    return true;
  }

  /* ---------- 3. the starting value of Type of quote ---------- */
  /* It starts only for a quote that is asked for (its Request says Request a quote), and goes again when that is taken back, unless the adviser has chosen a type himself. */
  var TYPE_OF = { bf_fna_type: 'bf_fna_req', fna_type: 'fna_req', bf_sf_type: 'bf_sf_req', sf_type: 'sf_req' };
  function typeStartValue(state) {
    var risk = v(state, 'has_risk');
    if (risk === 'No') return 'New Business';
    if (risk === 'Yes' && rows(state, 'risk').some(function (r) { return r.d.broker === 'Paul K'; })) return 'Servicing';
    return '';
  }
  function typeStart(state) {
    var want = typeStartValue(state);
    Object.keys(TYPE_OF).forEach(function (id) {
      var c = state.f[id]; if (!c) return;
      var asked = v(state, TYPE_OF[id]) === 'Request a quote', target = asked ? want : '';
      if (c.v === '') { if (target) state.f[id] = { v: target, st: 'preset' }; }
      else if (c.st === 'preset' && c.v !== target) state.f[id] = target ? { v: target, st: 'preset' } : { v: '', st: 'empty' };
    });
  }

  return { apply: apply, outcome: outcome, touched: touched, suggestion: suggestion, take: take, typeStartValue: typeStartValue, AREAS: AREAS };
});
