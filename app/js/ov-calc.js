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
  /* The ACI as the document words it ("7.5% + age rater": every insurer has its own terms); a document that gives only a figure reads "10% fixed". */
  function fmtAci(x) {
    if (!x) return '';
    var t = typeof x.aciText === 'string' ? x.aciText.trim() : '';
    if (!t && Array.isArray(x.lines)) { var w = x.lines.filter(function (l) { return l && !l.removed && typeof l.aciText === 'string' && l.aciText.trim(); })[0]; if (w) t = w.aciText.trim(); }          // a file whose lines carry the words (the skill may write them there): the quote shows them too, so the top and the lines always read the same
    if (t) return t;
    return isNum(x.aci) ? fmtPct(x.aci) + ' fixed' : (x.aci === 'N/A' || x.aci === 'Not found' ? x.aci : '');
  }
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
  /* Two rules about a need line that hold whoever wrote it (Paul, 23 November): the additional expense (dread) line has no life cover cell (N/A), and a need whose lump sum is 0 has an income portion of 0. Returns how many things changed. */
  function settleLine(l) {
    var n = 0; if (!l || typeof l !== 'object') return 0;
    if (l.type === 'dread' && l.life !== 'N/A') { l.life = 'N/A'; n++; }
    if (l.type === 'debt' && l.lsd && typeof l.lsd === 'object' && l.life && typeof l.life === 'object' && isNum(l.life.monthly) && (l.lsd.monthly === null || l.lsd.monthly === undefined || l.lsd.monthly === '' || l.lsd.monthly === 'Not found')) {
      l.lsd.monthly = l.life.monthly; n++;                                                                       // round 4 (23 November): the debt's instalment is one figure; the Lump sum disability box is never left empty beside it
    }
    if ((l.type === 'household' || l.type === 'child' || l.type === 'death') && l.life && typeof l.life === 'object' && l.life.lump === 0 && (l.life.monthly === null || l.life.monthly === undefined || l.life.monthly === '')) { l.life.monthly = 0; n++; }
    return n;
  }
  /* The ACI in short points (round 4, 23 November): another insurer's ACI wording can be a whole paragraph. Every screen shows 1 to 3 short points and keeps the whole wording for the hover text and the policy card. The points are the
     ones the reading gave (aciPoints); for an older file they are cut from the wording: its first sentences or clauses, each at most 56 characters. A short wording ("7.5% + age rater", "10% fixed") is its own single point. */
  function cutWords(t, n) { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; var c = t.slice(0, n - 1), i = c.lastIndexOf(' '); if (i > n * 0.5) c = c.slice(0, i); return c.replace(/[ ,;:.\-]+$/, '') + '\u2026'; }
  function aciPoints(x) {
    var full = fmtAci(x); if (!full) return [];
    var own = x && Array.isArray(x.aciPoints) ? x.aciPoints.map(function (p) { return cutWords(p, 60); }).filter(Boolean).slice(0, 3) : [];
    if (own.length) return own;
    if (full.length <= 38) return [full];
    var parts = full.split(/\s*(?:\r?\n|[;\u2022]|\.\s+(?=[A-Za-z0-9])|\s-\s)\s*/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 2; });
    if (parts.length < 2) parts = full.split(/\s*,\s+/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 2; });
    if (parts.length < 2 && full.length <= 90) return [full];                                               // one clause of a normal length stays whole
    return (parts.length ? parts : [full]).slice(0, 3).map(function (p) { return cutWords(p, 56); });
  }
  /* Debt names that mean the same thing (round 4): "FNB Rev Credit" and "Revolving credit" are one debt. A name is lower-cased, its abbreviations are spelled out (rev, cc, veh, fin, pers, hl, od, mtg), bank names are dropped, and two
     names match when their words are the same or all the words of one are in the other. */
  var DEBT_WORDS = { rev: 'revolving', revolv: 'revolving', revolve: 'revolving', cc: 'credit card', crd: 'credit', cr: 'credit', veh: 'vehicle', fin: 'finance', pers: 'personal', hl: 'home loan', od: 'overdraft', ovd: 'overdraft', ln: 'loan',
    mtg: 'home loan', mortgage: 'home loan', bond: 'home loan', acc: '', account: '', facility: '', fnb: '', absa: '', nedbank: '', capitec: '', investec: '', tyme: '', tymebank: '', wesbank: '', mfc: '', std: '', standard: '', bank: '',
    first: '', national: '', discovery: '', african: '', bidvest: '' };
  function debtWords(s) {
    var out = [];
    norm(s).split(' ').forEach(function (w) { if (!w) return; var m = Object.prototype.hasOwnProperty.call(DEBT_WORDS, w) ? DEBT_WORDS[w] : w; m.split(' ').forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function sameDebtName(a, b) {
    var x = debtWords(a), y = debtWords(b); if (!x.length || !y.length) return false;
    var sub = function (p, q) { return p.every(function (w) { return q.indexOf(w) >= 0; }); };
    return sub(x, y) || sub(y, x);
  }
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
      out.push({ derived: true, item: { id: q.id, wr: true, insurer: q.insurer, product: q.productName || (q.kind === 'fna' ? 'FNA' : q.kind), policyNo: q.policyNo, doc: q.startDate, premium: q.premium, aci: q.aci, aciText: q.aciText || null, abi: null,
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

  /* The Fact Find's children and debts against the lines of a quote (the checks, the automatic match and the reading all use this one matching).
     A child: the full name, else the first name alone (loose: the surname differs). A debt: by what it is called (the description, the type, the provider and the type), by part of that name, and last by the amount
     (the instalment, or the balance against the lump sum). Returns { pairs: [{ line, ff, loose }], missing: [Fact Find rows with no line], extra: [lines with no Fact Find row] }. */
  function matchChildren(lines, ffKids) {
    var kids = lines.filter(function (l) { return l.type === 'child'; }), seen = {}, pairs = [], missing = [];
    (ffKids || []).forEach(function (c) {
      var nm = norm(c.name + ' ' + c.sname), l = kids.filter(function (x) { return !seen[x.id] && norm((x.name || '') + ' ' + (x.sname || '')) === nm; })[0], loose = false;
      if (!l && norm(c.name)) { l = kids.filter(function (x) { return !seen[x.id] && norm(x.name) === norm(c.name); })[0]; loose = !!l; }
      if (!l) { missing.push(c); return; }
      seen[l.id] = 1; pairs.push({ line: l, ff: c, loose: loose });
    });
    return { pairs: pairs, missing: missing, extra: kids.filter(function (l) { return !seen[l.id]; }) };
  }
  function matchDebts(lines, ffDebts) {
    var debts = lines.filter(function (l) { return l.type === 'debt'; }), used = {}, pairs = [], missing = [];
    (ffDebts || []).forEach(function (d) {
      var keys = [norm(d.desc), norm(d.type), norm(d.prov + ' ' + d.type)].filter(Boolean);
      var same = debts.filter(function (x) { return !used[x.id] && keys.indexOf(norm(x.debt)) >= 0; });
      if (same.length > 1) {                                                                              // two debts with the same name (two vehicle loans): the one whose debt cover is this debt's balance, then the one whose instalment is this debt's
        var byBal = same.filter(function (x) { var g = lineVal(x, 'life', 'lump'); return isNum(g) && isNum(d.bal) && d.bal > 0 && Math.abs(g - d.bal) < 1; })[0], byInst = same.filter(function (x) { var m = lineVal(x, 'life', 'monthly'); return isNum(m) && isNum(d.inst) && d.inst > 0 && Math.abs(m - d.inst) < 1; })[0];
        same = [byBal || byInst || same[0]];
      }
      var l = same[0] || debts.filter(function (x) { var nd = norm(x.debt); return !used[x.id] && nd.length > 2 && keys.some(function (k) { return k.length > 2 && (nd.indexOf(k) >= 0 || k.indexOf(nd) >= 0); }); })[0];
      var near = function (a, b) { return isNum(a) && isNum(b) && b > 0 && Math.abs(a - b) < 1; };
      if (!l) {                                                                                           // the same debt under another spelling (FNB Rev Credit = Revolving credit): abbreviations and bank names set aside
        var cands = debts.filter(function (x) { return !used[x.id] && x.debt && [d.desc, d.type, d.prov + ' ' + d.type].some(function (k) { return sameDebtName(k, x.debt); }); });
        l = cands.filter(function (x) { return near(lineVal(x, 'life', 'lump'), d.bal); })[0] || cands.filter(function (x) { return near(lineVal(x, 'life', 'monthly'), d.inst); })[0] || cands[0];
      }
      if (!l) l = debts.filter(function (x) {                                                           // a line with no name (or another one) but the same instalment, or the same balance as its lump sum
        return !used[x.id] && !norm(x.debt) && (near(lineVal(x, 'life', 'monthly'), d.inst) || near(lineVal(x, 'life', 'lump'), d.bal));
      })[0];
      if (!l) {                                                                                           // same amounts, whatever the names say (the quote's name wins): the balance and the instalment both, else the balance, else the one line with this instalment
        var open = debts.filter(function (x) { return !used[x.id]; }), byBoth = open.filter(function (x) { return near(lineVal(x, 'life', 'lump'), d.bal) && near(lineVal(x, 'life', 'monthly'), d.inst); }),
          byBal = open.filter(function (x) { return near(lineVal(x, 'life', 'lump'), d.bal); }), byInst = open.filter(function (x) { return near(lineVal(x, 'life', 'monthly'), d.inst); });
        l = byBoth[0] || byBal[0] || (byInst.length === 1 ? byInst[0] : null);
      }
      if (!l) { missing.push(d); return; }
      used[l.id] = 1; pairs.push({ line: l, ff: d });
    });
    return { pairs: pairs, missing: missing, extra: debts.filter(function (l) { return !used[l.id]; }) };
  }

  /* Which pages the PDF and the Presentation have (Paul, 22 November): a page with nothing to say is left out and its tab is greyed. The Shortfall quote page needs group risk AND a shortfall quote asked for in the Fact Find (or one
     already there); the Comparative quotes page needs one asked for in the Fact Find (the standard quote lane) or one already there; Proposed investments and Goal analysis reports need at least one (a report that was asked for or has figures).
     The other eleven pages are always there (an empty Current investments page says there are none). */
  function asked(state) { var f = state && state.factFind && state.factFind.facts; return (f && f.asked) || {}; }
  function pageShown(state, id) {
    var B = (state && state.blocks) || {};
    if (id === 'shortfallQuote') return hasGroupRisk(state) && (!!asked(state).sf || quotes(state, 'shortfallQuote').length > 0);
    if (id === 'comparative') return !!asked(state).comparative || quotes(state, 'comparative').length > 0;
    if (id === 'proposed') return active(B.proposed && B.proposed.items).length > 0;
    if (id === 'goals') return active(B.goals && B.goals.items).some(function (g) { return g.requested === true || ['currentValuePm', 'futureValuePm', 'aci', 'premium'].some(function (k) { return isNum(g[k]); }); });
    return true;
  }
  var PAGE_WHY = { shortfallQuote: 'Left out: there is no group risk, or no shortfall quote was asked for.', comparative: 'Left out: no comparative quote was asked for in the Fact Find.', proposed: 'Left out: there are no proposed investments.', goals: 'Left out: no goal analysis report was asked for.' };
  function pageWhy(id) { return PAGE_WHY[id] || ''; }

  return { settleLine: settleLine, aciPoints: aciPoints, sameDebtName: sameDebtName, isNum: isNum, r2: r2, norm: norm, fmtR: fmtR, fmtPct: fmtPct, fmtAci: fmtAci, matchChildren: matchChildren, matchDebts: matchDebts, pageShown: pageShown, pageWhy: pageWhy, fmtDiff: fmtDiff, show: show, lineVal: lineVal, active: active, activeLines: activeLines, totals: totals, sumLines: sumLines,
    quotes: quotes, allQuotes: allQuotes, policies: policies, policyTotals: policyTotals, groupItems: groupItems, hasGroupRisk: hasGroupRisk, groupTotals: groupTotals, investments: investments,
    personalInvestments: personalInvestments, shortfall: shortfall, compare: compare, pillars: pillarOfBlock };
});
