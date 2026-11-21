/* The Client Overview's figures: everything the page works out (nobody types them). Totals of a quote or a policy, the policies of block 1 (with an issued quote moved in), the group benefits, the personal
   investments, the shortfall (block 4) and the "compared with what you have now" table. The screen, the PDF and the Presentation all take their figures from here, so they cannot disagree.
   A figure is a number, null (not known yet), or the text "N/A" / "Not found" (docs/OVERVIEW-DATA-CONTRACT.md section 2). Loads in the browser (window.OV.calc) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'));
  else { root.OV = root.OV || {}; root.OV.calc = factory(root.OV.schema); }
})(typeof self !== 'undefined' ? self : this, function (schema) {
  var P = schema.PILLARS;
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function r2(n) { return Math.round(n * 100) / 100; }
  /* Capitals, accents and repeated spaces do not matter when two names are compared. */
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* R1,034,800 and R637.85: cents only when there are some; a thousands comma; no space after the R (it is never split over two lines: the screen keeps it together). */
  function fmtR(n) {
    if (!isNum(n)) return '';
    var a = Math.abs(n), whole = Math.abs(a - Math.round(a)) < 0.005, s = whole ? String(Math.round(a)) : a.toFixed(2), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + 'R' + p.join('.');
  }
  function fmtPct(n) { return isNum(n) ? String(Math.round(n * 100) / 100) + '%' : ''; }
  /* What a cell shows: a number as rand, "N/A" and "Not found" as they are, nothing known as an empty string. */
  function show(v) { return isNum(v) ? fmtR(v) : (v === 'N/A' || v === 'Not found' ? v : ''); }

  /* A line's figure for one pillar and key ("life", "lump"). The text "N/A" on a whole pillar gives "N/A". */
  function lineVal(line, p, k) {
    var c = line && line[p];
    if (c === 'N/A') return 'N/A';
    if (!c || typeof c !== 'object') return null;
    var v = c[k]; return v === undefined ? null : v;
  }
  function active(list) { return (list || []).filter(function (x) { return x && !x.removed; }); }
  function activeLines(x) { return active(x && x.lines); }
  function emptyTotals() { return { life: { lump: 0, monthly: 0 }, sev: { lump: 0 }, lsd: { lump: 0, monthly: 0 }, ip: { monthly: 0 } }; }
  function sumLines(lines) {
    var t = emptyTotals();
    lines.forEach(function (l) { P.forEach(function (p) { p.keys.forEach(function (k) { var v = lineVal(l, p.id, k); if (isNum(v)) t[p.id][k] = r2(t[p.id][k] + v); }); }); });
    return t;
  }
  /* Total lump sum and total income protected of a quote or a policy, from the lines that are not removed (never from the totals a document printed). */
  function totals(x) { return sumLines(activeLines(x)); }
  function quotes(state, blockId) { return active(state && state.blocks && state.blocks[blockId] && state.blocks[blockId].quotes); }
  function allQuotes(state) { return schema.QUOTE_KINDS.reduce(function (a, k) { return a.concat(quotes(state, schema.blockOfQuote[k])); }, []); }

  /* Block 1: the policies that are not removed, and every accepted quote that has been issued (policy number and start date): it is shown here as a WR policy and no longer as a quote.
     A schedule with the same policy number wins over the quote. Each entry is { item, derived }. */
  function policies(state) {
    var items = active(state && state.blocks && state.blocks.policies && state.blocks.policies.items), out = items.map(function (i) { return { item: i, derived: false }; });
    var have = {}; items.forEach(function (i) { if (i.policyNo) have[norm(i.policyNo)] = 1; });
    allQuotes(state).forEach(function (q) {
      if (q.status !== 'accepted' || !q.policyNo || !q.startDate || have[norm(q.policyNo)]) return;
      out.push({ derived: true, item: { id: q.id, wr: true, insurer: q.insurer, product: q.productName || (q.kind === 'fna' ? 'FNA' : q.kind), policyNo: q.policyNo, doc: q.startDate, premium: q.premium, aci: q.aci, abi: null,
        ipAge: q.disabilityAge, benefits: q.benefits || {}, lines: q.lines || [], cmp: q.cmp || null, st: q.st, src: q.src, by: q.by, fromQuote: q.id } });
    });
    return out;
  }
  /* Totals of the policies of block 1: per group (WR, other brokers) and all together, with the premium. */
  function policyTotals(state) {
    var res = { wr: emptyTotals(), other: emptyTotals(), all: emptyTotals(), premium: { wr: 0, other: 0, all: 0 }, count: { wr: 0, other: 0, all: 0 } };
    policies(state).forEach(function (e) {
      var t = totals(e.item), g = e.item.wr ? 'wr' : 'other', pr = isNum(e.item.premium) ? e.item.premium : 0;
      P.forEach(function (p) { p.keys.forEach(function (k) { res[g][p.id][k] = r2(res[g][p.id][k] + t[p.id][k]); res.all[p.id][k] = r2(res.all[p.id][k] + t[p.id][k]); }); });
      res.premium[g] = r2(res.premium[g] + pr); res.premium.all = r2(res.premium.all + pr); res.count[g]++; res.count.all++;
    });
    return res;
  }
  function groupItems(state) { return active(state && state.blocks && state.blocks.group && state.blocks.group.items); }
  function hasGroupRisk(state) { return groupItems(state).some(function (g) { return g.kind === 'risk'; }); }
  /* The group risk benefits added up per pillar (life, severe illness and lump sum disability are lump sums; income protector is R p.m.). */
  function groupTotals(state) {
    var t = { life: 0, sev: 0, lsd: 0, ip: 0 };
    groupItems(state).forEach(function (g) { if (g.kind !== 'risk') return; P.forEach(function (p) { var c = g[p.id]; if (c && isNum(c.amount)) t[p.id] = r2(t[p.id] + c.amount); }); });
    return t;
  }
  function investments(state) { return active(state && state.blocks && state.blocks.investments && state.blocks.investments.items); }
  /* "Personal investments" in block 3: every investment of block 8 (retirement annuities too), the gross values and the monthly contributions. */
  function personalInvestments(state) {
    var g = 0, m = 0, p = 0;
    investments(state).forEach(function (i) { if (isNum(i.gross)) g = r2(g + i.gross); if (isNum(i.monthly)) m = r2(m + i.monthly); if (isNum(i.penalty)) p = r2(p + i.penalty); });
    return { gross: g, monthly: m, penalty: p, net: r2(g - p), count: investments(state).length };
  }
  /* Block 4, the shortfall: the FNA less what the client already has. Personal investments reduce the life pillar only (Paul's worked example). Never below nothing. */
  function shortfall(state) {
    var f = quotes(state, 'fna')[0];
    if (!f) return { has: false, fna: null, group: groupTotals(state), pi: personalInvestments(state), short: null };
    var t = totals(f), g = groupTotals(state), pi = personalInvestments(state), floor = function (n) { return Math.max(0, r2(n)); };
    var fna = { life: t.life.lump, sev: t.sev.lump, lsd: t.lsd.lump, ip: t.ip.monthly };
    return { has: true, quote: f, fna: fna, group: g, pi: pi, short: { life: floor(fna.life - (g.life + pi.gross)), sev: floor(fna.sev - g.sev), lsd: floor(fna.lsd - g.lsd), ip: floor(fna.ip - g.ip) } };
  }
  /* "Compared with what you have now": three rows (what you have now = the grand totals of block 1; this quote; the difference) for the lump sums, the income protector (R p.m.) and the monthly premium. */
  function compare(state, q) {
    var pt = policyTotals(state), qt = totals(q), pick = function (t) { return { life: t.life.lump, sev: t.sev.lump, lsd: t.lsd.lump, ip: t.ip.monthly }; };
    var now = pick(pt.all); now.premium = pt.premium.all;
    var me = pick(qt); me.premium = isNum(q && q.premium) ? q.premium : 0;
    var diff = {}; ['life', 'sev', 'lsd', 'ip', 'premium'].forEach(function (k) { diff[k] = r2(me[k] - now[k]); });
    return { now: now, quote: me, diff: diff, nowCount: pt.count.all };
  }
  /* A "+R1,234" or "−R1,234" for a difference; "R0" when there is none. */
  function fmtDiff(n) { if (!isNum(n)) return ''; if (Math.abs(n) < 0.005) return 'R0'; return (n > 0 ? '+' : '−') + fmtR(Math.abs(n)); }
  function pillarOfBlock() { return P; }

  return { isNum: isNum, r2: r2, norm: norm, fmtR: fmtR, fmtPct: fmtPct, fmtDiff: fmtDiff, show: show, lineVal: lineVal, active: active, activeLines: activeLines, totals: totals, sumLines: sumLines,
    quotes: quotes, allQuotes: allQuotes, policies: policies, policyTotals: policyTotals, groupItems: groupItems, hasGroupRisk: hasGroupRisk, groupTotals: groupTotals, investments: investments,
    personalInvestments: personalInvestments, shortfall: shortfall, compare: compare, pillars: pillarOfBlock };
});
