/* The Client Overview Studio's Presentation, the part that needs no screen: the tabs, the short figures on the main page, and the private key-points library (what is loaded, what shows for what is highlighted).
   The screen itself is js/ov-present.js; this file is tested on its own (tests/overview-present.test.js).
   The Presentation has NO voice (Paul, 22 November: too volatile, removed altogether): everything is done by clicking. Rules that are built in here and must not be undone (docs/PROJECT-CLIENT-OVERVIEW.md section 8):
   - the key-points library is private: only a point with an approval (who and when) is ever kept, at most three show at once, and none of it is ever in the repository;
   - what is asked for by a click is on the closed list of benefit keys below (a column, a line), so the points that show are decided by plain code, never by a guess.
   Loads in the browser (window.OV.pres) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.pres = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  /* The tabs carry no block numbers (Paul, 22 November: none on the screen); the PDF keeps its own. */
  var TABS = ['Main', 'Policies', 'FNA', 'Group', 'Shortfall', 'Shortfall quote', 'Reduced', 'Comparative', 'Investments', 'Proposed', 'Goals', 'Other'];
  var ORDER = ['map'].concat(schema.BLOCKS.map(function (b) { return b.id; }));
  var KP_FILE = 'wr-keypoints.json', KP_MAX = 3, KP_LONG = 200;

  /* The line keys a row answers to: its type, and for a child or a debt its own name, so one line can be found. The last key is the most specific one. */
  function lineKeys(l) {
    var keys = ['type:' + (l && l.type || 'other')];
    if (l && l.type === 'child' && l.name) keys.push('child:' + calc.norm(l.name));
    if (l && l.type === 'debt' && (l.debt || l.bank)) keys.push('debt:' + calc.norm(l.debt || l.bank));
    return keys;
  }

  /* ---------- the main page: a short figure for each block, the key one first (no income figure, ever) ---------- */
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
    f.policies = pt.count.all ? short(pt.premium.all) + ' p.m. · ' + qCount(pt.count.all, 'policy').replace('policys', 'policies') : 'None yet';
    var fna = calc.quotes(state, 'fna')[0]; f.fna = fna ? (calc.isNum(fna.premium) ? short(fna.premium) + ' p.m.' : 'Quote loaded') : 'Waiting';
    var gi = calc.groupItems(state); f.group = gi.length || pi.count ? [gt.life ? short(gt.life) + ' group life' : '', pi.count ? short(pi.gross) + ' invested' : ''].filter(Boolean).join(' · ') || qCount(gi.length, 'item') : 'None';
    f.shortfall = sf.has ? short(sf.short.life) + ' life shortfall' : 'Waiting';
    ['shortfallQuote', 'reduced', 'comparative'].forEach(function (id) {
      var qs = calc.quotes(state, id), prem = qs.filter(function (q) { return calc.isNum(q.premium); }).map(function (q) { return q.premium; });
      f[id] = !qs.length ? (id === 'shortfallQuote' && !calc.hasGroupRisk(state) ? 'Not needed' : 'None yet') : (prem.length ? 'from ' + short(Math.min.apply(null, prem)) + ' p.m. · ' : '') + qCount(qs.length, 'quote');
    });
    f.investments = pi.count ? short(pi.gross) + ' · ' + qCount(pi.count, 'investment') : 'None';
    items = calc.active(state.blocks.proposed.items); f.proposed = items.length ? qCount(items.length, 'proposal') : 'None';
    items = calc.active(state.blocks.goals.items); f.goals = items.length ? qCount(items.length, 'report') : 'None';
    items = calc.active(state.blocks.other.items); f.other = items.length ? qCount(items.length, 'item') : 'None';
    schema.BLOCKS.forEach(function (b) { if (!calc.pageShown(state, b.id)) f[b.id] = 'Not included'; });                 // the same pages are left out as in the PDF
    return f;
  }
  /* A card on the main page shows the first part of the figure large and the rest small. */
  function splitFigure(text) { var i = String(text || '').indexOf(' · '); return i < 0 ? { fig: String(text || ''), cap: '' } : { fig: text.slice(0, i), cap: text.slice(i + 3) }; }

  /* ---------- the key-points library (private: found by the page, kept in the browser, never in the repository) ---------- */
  /* The benefit keys a point can carry (the file's "benefit"). The columns: life, sev, lsd, ip, aci, abi. Extra topics shown with a column or a line: see below. Older keys stay valid. */
  var KP_BENEFITS = {
    life: 'Life cover', sev: 'Severe illness', lsd: 'Lump sum disability', ip: 'Income protector', aci: 'ACI (yearly premium increase)', abi: 'ABI (annual benefit increase)',
    sevUpTo200: 'Severe illness up to 200% and when', traumaIQ: 'Trauma IQ (children too)', rareChildhood: 'Children’s rare childhood diseases', ipClaimRoutes: 'Income protector: the two ways to claim', ipWaiting: 'Income protector: the waiting period',
    childCare: 'Child care cover', debt: 'Debts', debtAccelerated: 'Accelerated debt cover', debtStandalone: 'Standalone debt cover', household: 'Household needs', death: 'Death-related needs', dread: 'Additional expense needs (dread)',
    instalmentProtector: 'Instalment Protector', childCover: 'Child care cover (older key)', conversion: 'Conversion'
  };
  var PIL_EXTRA = { sev: ['sevUpTo200', 'traumaIQ'], ip: ['ipClaimRoutes', 'ipWaiting'] };
  function bkey(b) { return String(b == null ? '' : b).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  /* The file as Paul keeps it ({app:"wr-keypoints", schema:"0.x", points:[...]}). Only a point with an approval (who and when) is ever kept: an unapproved one is dropped here and never shows;
     so is one that is too long to be a short bullet (it is counted, so the page can say so). */
  function parseKeyPoints(text) {
    var j; try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'This is not a readable key-points file.' }; }
    if (!j || j.app !== 'wr-keypoints' || !Array.isArray(j.points)) return { ok: false, error: 'This is not a key-points file (it should say "wr-keypoints").' };
    if (!/^0\./.test(String(j.schema || ''))) return { ok: false, error: 'This key-points file has a layout this page does not know (' + String(j.schema || 'none') + ').' };
    var good = [], dropped = 0, tooLong = 0;
    j.points.forEach(function (p) {
      var okp = p && typeof p.text === 'string' && p.text.trim() && typeof p.insurer === 'string' && typeof p.benefit === 'string' && p.approved && typeof p.approved === 'object' && p.approved.by && p.approved.date;
      if (!okp) { dropped++; return; }
      if (String(p.text).trim().length > KP_LONG) { tooLong++; return; }
      good.push({ id: String(p.id || ''), insurer: String(p.insurer), product: String(p.product || ''), benefit: String(p.benefit), text: String(p.text).trim() });
    });
    return { ok: true, points: good, total: j.points.length, dropped: dropped, tooLong: tooLong };
  }
  function sameInsurer(a, b) { a = calc.norm(a); b = calc.norm(b); return !!a && !!b && (a === b || a.indexOf(b + ' ') === 0 || b.indexOf(a + ' ') === 0); }
  function anyInsurer(a) { return !calc.norm(a) || /^(all|any|every)( insurers?)?$/.test(calc.norm(a)); }
  /* The benefit keys a click asks about, most specific first: what the highlighted lines are, then the highlighted column and what goes with it. */
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
  /* At most three approved points for the insurer (and the product, when the point names one; a point with no insurer is for every insurer) and the benefits asked about. One point of each benefit in turn,
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

  /* The tabs that can be opened: the main page and every page the PDF has too (a page with nothing to say is left out). */
  function shownOrder(state) { return ORDER.filter(function (id) { return id === 'map' || calc.pageShown(state, id); }); }

  return { TABS: TABS, ORDER: ORDER, shownOrder: shownOrder, lineKeys: lineKeys, mapFigures: mapFigures, splitFigure: splitFigure, short: short, parseKeyPoints: parseKeyPoints, pointsFor: pointsFor, lineBenefits: lineBenefits, benefitsFor: benefitsFor,
    KP_BENEFITS: KP_BENEFITS, KP_FILE: KP_FILE, KP_MAX: KP_MAX, KP_LONG: KP_LONG };
});
