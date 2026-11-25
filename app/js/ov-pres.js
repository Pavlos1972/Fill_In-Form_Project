/* The Client Overview Studio's Presentation, the part that needs no screen: the nine tabs and which page each holds, which pages have something to show, the ONE wording table for the sentences on the Overview page
   (chosen from the Fact Find's answers and the Studio's blocks, never guessed), and the private key-points library (what is loaded, which cards show for what is highlighted, in which sections).
   The screen itself is js/ov-present.js; this file is tested on its own (tests/overview-present.test.js).
   The Presentation has NO voice (Paul, 22 November: too volatile, removed altogether): everything is done by clicking. Rules that are built in here and must not be undone (docs/PROJECT-CLIENT-OVERVIEW.md section 8):
   - the key-points library is private: only a point with an approval (who and when) AND a source (the page of the client's own quote, checked against brightrock.co.za) is ever kept; none of it is in the repository;
   - what a click asks the library for is decided by plain code from a closed list of benefit keys, never by a guess; the ACI card is built from the client's own quote, not from the library;
   - a sentence on the Overview page is only ever one of the sentences in WORDING, chosen by a rule; an area the Fact Find has no answer for says "This was not discussed in our last meeting."
   Loads in the browser (window.OV.pres) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.pres = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  /* ---------- the tabs, under the FOUR headings (Paul, 25 November, round 2.0): Where you are now, Servicing your current policies, New business quotes, Investments & goals. A tab can hold several of the Studio's blocks, chosen by a small button on the page.
     A tab with nothing to show is greyed and cannot be clicked; a heading none of whose tabs has anything is not shown. ---------- */
  var TABS = [
    { id: 'map', l: 'Overview', blocks: ['map'] },
    { id: 'policies', l: 'Current policies', group: 'now', blocks: ['policies'] },
    { id: 'group', l: 'Group benefits', group: 'now', blocks: ['group'] },
    { id: 'investments', l: 'Investments', group: 'now', blocks: ['investments'] },
    { id: 'other', l: 'Other', group: 'now', blocks: ['other'] },
    { id: 'shortfall', l: 'Shortfall', group: 'now', blocks: ['shortfall'] },
    { id: 'servicing', l: 'Servicing quotes', group: 'servicing', blocks: ['svFna', 'svShortfall', 'svReduced', 'svIncrease', 'svReduction'] },
    { id: 'fna', l: 'FNA quote', group: 'newbiz', blocks: ['fna', 'shortfallQuote'] },
    { id: 'reduced', l: 'Reduced quotes', group: 'newbiz', blocks: ['reduced', 'comparative'] },
    { id: 'proposed', l: 'Proposed investments', group: 'inv', blocks: ['proposed'] },
    { id: 'goals', l: 'Goal analysis', group: 'inv', blocks: ['goals'] }
  ];
  var ORDER = ['map'].concat(schema.BLOCKS.map(function (b) { return b.id; }));
  var TAB_OF = {}; TABS.forEach(function (t) { t.blocks.forEach(function (b) { TAB_OF[b] = t.id; }); });
  var KP_FILE = 'wr-keypoints.json', KP_MAX = 8, KP_LONG = 200, KP_SOURCE_LONG = 120;

  /* The line keys a row answers to: its type, and for a child or a debt its own name, so one line can be found. The last key is the most specific one. */
  function lineKeys(l) {
    var keys = ['type:' + (l && l.type || 'other')];
    if (l && l.type === 'child' && l.name) keys.push('child:' + calc.norm(l.name));
    if (l && l.type === 'debt' && (l.debt || l.bank)) keys.push('debt:' + calc.norm(l.debt || l.bank));
    return keys;
  }

  /* ---------- which pages have something to show: a tab with nothing to show is greyed and cannot be clicked ---------- */
  function facts(state) { return (state && state.factFind && state.factFind.facts) || null; }
  function answers(state) { var f = facts(state); return (f && f.answers) || {}; }
  function hasContent(state, id) {
    var B = (state && state.blocks) || {};
    if (id === 'map') return true;
    if (id === 'policies') return calc.policies(state).length > 0;
    if (id === 'fna' || id === 'shortfallQuote' || id === 'reduced' || id === 'comparative') return calc.quotes(state, id).length > 0;
    if (schema.blocksById[id] && schema.blocksById[id].servicing) return calc.quotes(state, id).length > 0;
    if (id === 'group') return calc.groupItems(state).length > 0 || calc.personalInvestments(state).count > 0 || answers(state).hasGroup === 'No';      // "no group benefits" is something to show (three red lines)
    if (id === 'shortfall') return !!calc.shortfall(state).has;
    if (id === 'investments') return calc.investments(state).length > 0;
    if (id === 'proposed') return calc.active(B.proposed && B.proposed.items).length > 0;
    if (id === 'goals') return calc.active(B.goals && B.goals.items).length > 0;
    if (id === 'other') return ((B.other && B.other.items) || []).some(function (i) { return !i.removed && (i.company || i.product || i.note || i.policyNo || calc.isNum(i.premium)); });
    return false;
  }
  /* A block can be opened when the PDF has a page for it (calc.pageShown) and there is something on it. Round 2.1 (Paul, 25 November): the five blocks of Where the client is now are ALWAYS open (an empty one says so in one line);
     a quote page opens only when it holds a quote. */
  function blockOn(state, id) { var bd = schema.blocksById[id]; return id === 'map' || !!(bd && bd.group === 'now') || (calc.pageShown(state, id) && hasContent(state, id)); }
  function tabOn(state, tabId) { var t = TABS.filter(function (x) { return x.id === tabId; })[0]; return !!t && t.blocks.some(function (b) { return blockOn(state, b); }); }
  function firstBlock(state, tabId) { var t = TABS.filter(function (x) { return x.id === tabId; })[0]; return t ? (t.blocks.filter(function (b) { return blockOn(state, b); })[0] || null) : null; }
  function tabBlocks(state, blockId) { var t = TABS.filter(function (x) { return x.id === TAB_OF[blockId]; })[0]; return t ? t.blocks.filter(function (b) { return blockOn(state, b); }) : []; }
  /* The blocks that can be reached, in order, for next / back and the arrow keys: the Overview and every block that can be opened. */
  function shownOrder(state) { return ORDER.filter(function (id) { return blockOn(state, id); }); }

  /* ---------- the Overview page: ONE wording table (Paul, 22 November) so he can approve and change the sentences once ---------- */
  var WORDING = {
    notDiscussed: 'This was not discussed in our last meeting.',
    heading: '{name}, here’s what we’ll cover today',
    headingNoName: 'Here’s what we’ll cover today',
    policies: { none: 'You have no personal policies in place right now.', one: 'You have one policy with {insurers} right now. We’ll show you what it covers.', many: 'You have {count} policies with {insurers} right now. We’ll show you what they cover.',
      oneNoName: 'You have one policy in place right now. We’ll show you what it covers.', manyNoName: 'You have {count} policies in place right now. We’ll show you what they cover.' },
    fna: { some: 'Based on our last meeting, we’ll show you what you ideally need to take out.', accepted: 'You accepted this cover. The insurer is now assessing your application.', standard: 'You accepted this cover and the insurer approved it at standard rates.',
      terms: 'You accepted this cover. The insurer has come back with its terms, and we’ll go through them with you.', counter: 'The insurer has sent a counter offer for this cover, and we’ll go through it with you.', counteraccepted: 'You accepted the insurer’s counter offer for this cover.',
      counterrefused: 'You decided not to take up the insurer’s counter offer for this cover.', declined: 'The insurer was not able to offer this cover.', notaccepted: 'You decided not to take out this cover.' },
    shortfall: { some: 'We’ll show you the gap between what you have and what you need.' },
    reduced: { some: 'A more affordable way to close that gap.', accepted: 'You accepted this more affordable cover. The insurer is now assessing your application.', standard: 'You accepted this more affordable cover and the insurer approved it at standard rates.',
      terms: 'You accepted this more affordable cover. The insurer has come back with its terms, and we’ll go through them with you.', counter: 'The insurer has sent a counter offer for this more affordable cover, and we’ll go through it with you.', counteraccepted: 'You accepted the insurer’s counter offer for this more affordable cover.',
      counterrefused: 'You decided not to take up the insurer’s counter offer for this more affordable cover.', declined: 'The insurer was not able to offer this more affordable cover.', notaccepted: 'You decided not to take out this more affordable cover.' },
    group: { none: 'You have no group benefits in place. Your employer doesn’t cover you for anything.', some: 'Your employer covers you for {cover}.', someNoAmounts: 'You have group benefits through your employer.', fundOnly: 'Your employer provides a retirement fund, but no group risk cover.' },
    groupCover: { life: 'life cover', sev: 'severe illness cover', lsd: 'disability cover', ip: 'income protection' },
    retirement: { has: 'You already have a retirement annuity.', cannotAfford: 'You can’t afford an RA right now.', asked: 'We’ll show you what a retirement annuity could do for you.', none: 'You don’t have a retirement annuity.' },
    investments: { none: 'You don’t have any investments right now.', one: 'You have one investment with {providers} right now.', many: 'You have {count} investments with {providers} right now.', oneNoName: 'You have one investment right now.', manyNoName: 'You have {count} investments right now.' },
    goals: { none: 'You didn’t ask us for a goal analysis at this time.', done: 'A goal analysis was done for you.', asked: 'You asked us for a goal analysis. We’ll go through it once it is back.' },
    medical: { medical: 'You have medical aid in place.', hospital: 'You have a hospital plan in place.', none: 'You don’t have medical aid.' },
    will: { upToDate: 'Your will is in place and up to date.', needsUpdate: 'Your will is in place but needs updating.', has: 'You have a will.', none: 'You don’t have a will.' },
    shortterm: { review: 'Your short-term insurance is being reviewed, and we’re waiting for feedback.', has: 'You have short-term insurance in place.', none: 'You don’t have short-term insurance.', spouse: 'Your spouse looks after your short-term insurance.' }
  };
  var NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function words(n) { return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n); }
  function listOf(a) { a = a.filter(Boolean); return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function unique(a) { var seen = {}, out = []; a.forEach(function (x) { var k = calc.norm(x); if (x && !seen[k]) { seen[k] = 1; out.push(String(x).trim()); } }); return out; }

  /* The eleven cards: a card with a page behind it (opens) is bright and opens that tab; the others show their sentence only. */
  var AREAS = [
    { id: 'policies', head: 'Current policies', icon: 'policies', opens: 'policies' },
    { id: 'fna', head: 'Life cover: FNA quote', icon: 'fna', opens: 'fna' },
    { id: 'shortfall', head: 'Shortfall', icon: 'shortfall', opens: 'shortfall' },
    { id: 'reduced', head: 'Reduced quote', icon: 'reduced', opens: 'reduced' },
    { id: 'group', head: 'Group benefits', icon: 'group', opens: null },
    { id: 'retirement', head: 'Retirement planning', icon: 'retire', opens: null },
    { id: 'investments', head: 'Investments', icon: 'investments', opens: null },
    { id: 'goals', head: 'Goal analysis', icon: 'goals', opens: null },
    { id: 'medical', head: 'Medical aid', icon: 'medical', opens: null },
    { id: 'will', head: 'Will', icon: 'will', opens: null },
    { id: 'shortterm', head: 'Short-term insurance', icon: 'home', opens: null }
  ];
  var W = WORDING;
  /* Where the client's decision on a quote has got to, from the Studio's own state (round 1.2): the card for a quote block says what was decided, not the first-meeting wording. The most advanced quote of the block counts. */
  var DECISION_RANK = ['counteraccepted', 'standard', 'counter', 'terms', 'accepted', 'some', 'declined', 'counterrefused', 'notaccepted'];
  function decisionOf(state, q) {
    if (q.status === 'notaccepted') return 'notaccepted';
    if (q.status !== 'accepted') return 'some';
    var u = calc.uwOf(q); if (u === 'declinedHealth' || u === 'declinedOther') return 'declined';
    var c = calc.liveCounter(state, q); if (c) return c.status === 'accepted' ? 'counteraccepted' : c.status === 'notaccepted' ? 'counterrefused' : 'counter';
    return u === 'standard' ? 'standard' : u === 'loadings' || u === 'exclusions' || u === 'both' ? 'terms' : 'accepted';
  }
  function decisionState(state, blockId) {
    var ds = calc.mainQuotes(state, blockId).map(function (q) { return decisionOf(state, q); }), best = null;
    DECISION_RANK.forEach(function (k) { if (!best && ds.indexOf(k) >= 0) best = k; });
    return best;
  }
  function sentenceFor(state, id) {
    var f = facts(state), a = answers(state), B = (state && state.blocks) || {}, o = (f && f.other) || {}, none = W.notDiscussed;
    if (id === 'policies') {
      var ps = calc.policies(state), ins = unique(ps.map(function (e) { return e.item.insurer; }));
      if (!ps.length) return a.hasRisk === 'No' ? W.policies.none : none;
      if (ps.length === 1) return ins.length ? fill(W.policies.one, { insurers: listOf(ins) }) : W.policies.oneNoName;
      return ins.length ? fill(W.policies.many, { count: words(ps.length), insurers: listOf(ins) }) : fill(W.policies.manyNoName, { count: words(ps.length) });
    }
    if (id === 'fna') { var fd = decisionState(state, 'fna'); return fd ? W.fna[fd] : none; }
    if (id === 'shortfall') return calc.shortfall(state).has ? W.shortfall.some : none;
    if (id === 'reduced') { var rd = decisionState(state, 'reduced'); return rd ? W.reduced[rd] : none; }
    if (id === 'group') {
      var gi = calc.groupItems(state), risk = gi.filter(function (g) { return g.kind === 'risk'; });
      if (risk.length) {
        var gt = calc.groupTotals(state), cover = ['life', 'sev', 'lsd', 'ip'].filter(function (k) { return calc.isNum(gt[k]) && gt[k] > 0; }).map(function (k) { return W.groupCover[k]; });
        return cover.length ? fill(W.group.some, { cover: listOf(cover) }) : W.group.someNoAmounts;
      }
      if (gi.length) return W.group.fundOnly;
      return a.hasGroup === 'No' ? W.group.none : none;
    }
    if (id === 'retirement') {
      if ((f && f.ret_ra && f.ret_ra.length) || a.hasRa === 'Yes') return W.retirement.has;
      if ((a.raqReqs || []).some(function (r) { return /afford/i.test(r); })) return W.retirement.cannotAfford;
      if (f && f.raq && f.raq.length) return W.retirement.asked;
      return a.hasRa === 'No' ? W.retirement.none : none;
    }
    if (id === 'investments') {
      var iv = calc.investments(state), prov = unique(iv.map(function (i) { return i.provider; }));
      if (!iv.length) return a.hasInv === 'No' ? W.investments.none : none;
      if (iv.length === 1) return prov.length ? fill(W.investments.one, { providers: listOf(prov) }) : W.investments.oneNoName;
      return prov.length ? fill(W.investments.many, { count: words(iv.length), providers: listOf(prov) }) : fill(W.investments.manyNoName, { count: words(iv.length) });
    }
    if (id === 'goals') {
      var gs = calc.active(B.goals && B.goals.items), figures = gs.some(function (g) { return ['currentValuePm', 'futureValuePm', 'aci', 'premium'].some(function (k) { return calc.isNum(g[k]); }); });
      if (figures) return W.goals.done;
      if (gs.some(function (g) { return g.requested === true; }) || (f && (f.rgar || f.egar))) return W.goals.asked;
      return f ? W.goals.none : none;
    }
    if (id === 'medical') return o.ma && o.ma.value === 'Medical aid' ? W.medical.medical : o.ma && o.ma.value === 'Hospital plan' ? W.medical.hospital : o.ma && o.ma.value === 'None' ? W.medical.none : none;
    if (id === 'will') {
      var w = o.will || {};
      if (w.value === 'Yes') return w.up === 'Yes' ? W.will.upToDate : w.up === 'No' ? W.will.needsUpdate : W.will.has;
      return w.value === 'No' ? W.will.none : none;
    }
    if (id === 'shortterm') {
      var s = o.shortterm || {};
      if (a.refSti === 'Cameron to contact client') return W.shortterm.review;
      return s.value === 'Yes' ? W.shortterm.has : s.value === 'No' ? W.shortterm.none : s.value === 'Handled by spouse' ? W.shortterm.spouse : none;
    }
    return none;
  }
  /* The Overview page's cards: [{ id, head, icon, text, opens, bright }]. A card opens its tab only when that tab can be opened (a tab with nothing to show is greyed). */
  function cover(state) {
    return AREAS.map(function (ar) {
      var opens = ar.opens && tabOn(state, ar.opens) ? ar.opens : null;
      return { id: ar.id, head: ar.head, icon: ar.icon, text: sentenceFor(state, ar.id), opens: opens, bright: !!opens };
    });
  }
  function heading(state) {
    var n = String((state && state.header && state.header.fname) || '').trim();
    return n ? fill(W.heading, { name: n }) : W.headingNoName;
  }

  /* ---------- the key-points library (private: found by the page, kept in the browser, never in the repository) ---------- */
  /* The benefit keys a point can carry (the file's "benefit"). The columns: life, sev, lsd, ip, aci, abi. Extra topics shown with a column or a line: see PIL_EXTRA and lineBenefits. Older keys stay valid. */
  var KP_BENEFITS = {
    life: 'Life cover', sev: 'Severe illness', lsd: 'Lump sum disability', ip: 'Income protector', aci: 'ACI (yearly premium increase)', abi: 'ABI (annual benefit increase)',
    sevUpTo200: 'Severe illness: the up to 200% extender', sevAdvanced: 'Severe illness: the advanced option', traumaIQ: 'Trauma IQ', sevChild: 'Severe illness for the children (10% doubling to 20% with child care cover)', sevChildExtra: 'Extra conditions for the children', sevChildClaim: 'What a child’s claim also pays',
    rareChildhood: 'Children’s rare childhood diseases', ipClaimRoutes: 'Income protector: the two ways to claim', ipWaiting: 'Income protector: the waiting period',
    childCare: 'Child care cover', debt: 'Debts', debtAccelerated: 'Accelerated debt cover', debtStandalone: 'Standalone debt cover', household: 'Household needs', death: 'Death-related needs', dread: 'Additional expense needs (dread)',
    instalmentProtector: 'Instalment Protector', childCover: 'Child care cover (older key)', conversion: 'Conversion'
  };
  var KP_SECTIONS = { insured: 'The life insured', children: 'The children' };
  var PIL_EXTRA = { sev: ['sevUpTo200', 'sevAdvanced', 'traumaIQ', 'sevChild', 'sevChildExtra', 'sevChildClaim'], ip: ['ipClaimRoutes', 'ipWaiting'] };
  function bkey(b) { return String(b == null ? '' : b).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function sectionOf(p) {
    var s = bkey(p.section);
    if (s === 'children' || s === 'child' || s === 'kids') return 'children';
    if (s === 'insured' || s === 'lifeinsured' || s === 'life') return 'insured';
    return /^(sevchild|rarechildhood|childcare|childcover)/.test(bkey(p.benefit)) ? 'children' : 'insured';
  }

  /* The file as Paul keeps it ({app:"wr-keypoints", schema:"0.x", points:[...]}). Only a point with an approval (who and when) and a source (the page of the client's own quote) is ever kept: an unapproved one, or
     one with no source, is dropped here and never shows; so is one too long to be a short card (it is counted, so the page can say so). */
  function parseKeyPoints(text) {
    var j; try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'This is not a readable key-points file.' }; }
    if (!j || j.app !== 'wr-keypoints' || !Array.isArray(j.points)) return { ok: false, error: 'This is not a key-points file (it should say "wr-keypoints").' };
    if (!/^0\./.test(String(j.schema || ''))) return { ok: false, error: 'This key-points file has a layout this page does not know (' + String(j.schema || 'none') + ').' };
    var good = [], dropped = 0, tooLong = 0, noSource = 0;
    j.points.forEach(function (p) {
      var okp = p && typeof p.text === 'string' && p.text.trim() && typeof p.insurer === 'string' && typeof p.benefit === 'string' && p.approved && typeof p.approved === 'object' && p.approved.by && p.approved.date;
      if (!okp) { dropped++; return; }
      var src = typeof p.source === 'string' ? p.source.trim() : '';
      if (!src) { noSource++; return; }
      if (String(p.text).trim().length > KP_LONG || src.length > KP_SOURCE_LONG) { tooLong++; return; }
      good.push({ id: String(p.id || ''), insurer: String(p.insurer), product: String(p.product || ''), benefit: String(p.benefit), section: sectionOf(p), text: String(p.text).trim(), source: src });
    });
    return { ok: true, points: good, total: j.points.length, dropped: dropped, noSource: noSource, tooLong: tooLong };
  }
  function sameInsurer(a, b) { a = calc.norm(a); b = calc.norm(b); return !!a && !!b && (a === b || a.indexOf(b + ' ') === 0 || b.indexOf(a + ' ') === 0); }
  function anyInsurer(a) { return !calc.norm(a) || /^(all|any|every)( insurers?)?$/.test(calc.norm(a)); }
  /* The benefit keys a highlighted LINE asks about, most specific first. */
  function lineBenefits(l) {
    if (!l) return [];
    if (l.type === 'child') return ['childCare', 'traumaIQ', 'rareChildhood', 'childCover'];
    if (l.type === 'debt') return ['debt'].concat(l.accelerated === true ? ['debtAccelerated'] : l.accelerated === false ? ['debtStandalone'] : [], calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0 ? ['instalmentProtector'] : []);
    if (l.type === 'household') return ['household'];
    if (l.type === 'death') return ['death'];
    if (l.type === 'dread') return ['dread'];
    return [];
  }
  function benefitsFor(pil, extra) {
    var out = [];
    function add(k) { if (k && out.indexOf(k) < 0) out.push(k); }
    (extra || []).forEach(add);
    if (pil) { add(pil); (PIL_EXTRA[pil] || []).forEach(add); }
    return out;
  }
  /* The approved points for the insurer (and the product, when the point names one; a point with no insurer is for every insurer) and the benefits asked about, at most KP_MAX: one point of each benefit in turn,
     so that a column with several topics shows a little of each, then the next of each, each in the file's order. */
  function pointsFor(points, insurer, benefits, product, max) {
    var out = [], cap = max || KP_MAX, byKey = (benefits || []).map(function (b) {
      var k = bkey(b);
      return (points || []).filter(function (p) {
        if (bkey(p.benefit) !== k) return false;
        if (!anyInsurer(p.insurer) && !sameInsurer(p.insurer, insurer)) return false;
        if (p.product && product && calc.norm(product).indexOf(calc.norm(p.product)) < 0 && calc.norm(p.product).indexOf(calc.norm(product)) < 0) return false;
        return true;
      });
    }), seen = {};
    for (var round = 0; out.length < cap && round < 20; round++) {
      var any = false;
      byKey.forEach(function (list) {
        var p = list[round]; if (p) any = true;
        if (p && out.length < cap && !seen[p.id || p.text]) { seen[p.id || p.text] = 1; out.push(p); }
      });
      if (!any) break;
    }
    return out;
  }

  /* The ACI card is built from the client's own quote, not from the library (Paul: "Premiums rise <x>% a year, plus the age adjuster."): the figure is the quote's, and the age adjuster is named only when the quote's own words name one. */
  function aciCard(q) {
    if (!q) return null;
    var t = typeof q.aciText === 'string' ? q.aciText.trim() : '', m = /(\d+(?:[.,]\d+)?)\s*%/.exec(t), x = m ? m[1].replace(',', '.') : (calc.isNum(q.aci) ? String(q.aci) : null);
    if (x == null) return null;
    return { id: 'aci', section: 'insured', text: 'Premiums rise ' + x + '% a year' + (/age/i.test(t) ? ', plus the age adjuster.' : '.'), source: 'This quote' + (q.number ? ', ' + (/bright/i.test(q.insurer || '') ? 'CP ' : 'quote ') + q.number : ''), generated: true };
  }

  /* Placeholder cards (same layout) shown for a BrightRock quote until the checked library is found; they state no fact. Paul's switch (Key points: on / off) hides them like any card. */
  var PLACEHOLDER_SOURCE = 'BrightRock quote, page to come';
  var PLACEHOLDERS = {
    life: [['insured', 'Placeholder: what the life cover pays, and when.'], ['insured', 'Placeholder: how the cover follows the client’s needs.']],
    sev: [['insured', 'Placeholder: severe illness cover for the life insured.'], ['insured', 'Placeholder: the severe illness extender.'], ['insured', 'Placeholder: the advanced option.'], ['insured', 'Placeholder: Trauma IQ.'],
      ['children', 'Placeholder: severe illness cover for the children, with child care cover.'], ['children', 'Placeholder: the extra conditions for the children.'], ['children', 'Placeholder: what a child’s claim also pays.']],
    lsd: [['insured', 'Placeholder: what lump sum disability pays, and when.']],
    ip: [['insured', 'Placeholder: what the income protector pays.'], ['insured', 'Placeholder: the ways to claim, and the waiting period.']],
    abi: [['insured', 'Placeholder: how the benefits increase each year.']]
  };
  function placeholdersFor(pil) {
    return (PLACEHOLDERS[pil] || []).map(function (p, i) { return { id: 'ph-' + pil + '-' + i, section: p[0], text: p[1], source: PLACEHOLDER_SOURCE, placeholder: true }; });
  }

  /* What shows on the right for what is highlighted: sections of cards. o = { kp, insurer, product, pil, extra (the highlighted lines' benefit keys), quote }.
     The ACI column shows only the ACI card. Severe illness (and any highlight that has both) is in two sections with banners: the life insured, the children. Returns { sections: [{ key, label, cards }], total }. */
  function keyCards(o) {
    o = o || {}; var cards = [];
    if (o.pil === 'aci') { var a = aciCard(o.quote); if (a) cards = [a]; }
    else if (o.pil || (o.extra && o.extra.length)) {
      var bens = benefitsFor(o.pil, o.extra);
      if (o.kp) cards = pointsFor(o.kp.points, o.insurer, bens, o.product);
      else if (/bright/i.test(o.insurer || '') && o.pil && o.placeholders !== false) cards = placeholdersFor(o.pil).slice(0, KP_MAX);
    }
    var sections = [], by = {};
    cards.forEach(function (c) { var k = c.section || 'insured'; if (!by[k]) { by[k] = { key: k, label: null, cards: [] }; sections.push(by[k]); } by[k].cards.push(c); });
    sections.sort(function (x, y) { return (x.key === 'insured' ? 0 : 1) - (y.key === 'insured' ? 0 : 1); });
    var banners = o.pil === 'sev' || sections.length > 1;
    sections.forEach(function (s) { s.label = banners ? KP_SECTIONS[s.key] : null; });
    return { sections: sections, total: cards.length };
  }

  return { TABS: TABS, ORDER: ORDER, TAB_OF: TAB_OF, hasContent: hasContent, blockOn: blockOn, tabOn: tabOn, firstBlock: firstBlock, tabBlocks: tabBlocks, shownOrder: shownOrder, lineKeys: lineKeys,
    WORDING: WORDING, AREAS: AREAS, decisionOf: decisionOf, decisionState: decisionState, sentenceFor: sentenceFor, cover: cover, heading: heading, parseKeyPoints: parseKeyPoints, pointsFor: pointsFor, lineBenefits: lineBenefits, benefitsFor: benefitsFor, aciCard: aciCard, placeholdersFor: placeholdersFor, keyCards: keyCards,
    KP_BENEFITS: KP_BENEFITS, KP_SECTIONS: KP_SECTIONS, KP_FILE: KP_FILE, KP_MAX: KP_MAX, KP_LONG: KP_LONG, PLACEHOLDERS: PLACEHOLDERS, PLACEHOLDER_SOURCE: PLACEHOLDER_SOURCE };
});
