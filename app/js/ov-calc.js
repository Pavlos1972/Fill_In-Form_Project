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

  /* ---------- counter offers (round 1.2, 24 November) ---------- */
  /* A counter offer is a quote of the same kind and block (counterOf = the id of the quote the client accepted, which is the ROOT of the chain). Everything that must treat a quote and its counter offers as one thing asks these. */
  function parentOf(state, q) {
    var cur = q, seen = {}, n = 0;
    while (cur && cur.counterOf && !seen[cur.id] && n++ < 20) {                                                // a counter offer of a counter offer belongs to the root; a loop (a hand-edited file) belongs to nobody
      seen[cur.id] = 1; var hit = null; allQuotes(state).forEach(function (x) { if (x.id === cur.counterOf && x !== cur) hit = x; });
      if (!hit) return null;                                                                                   // a counter offer whose quote is gone is an ordinary quote again
      if (!hit.counterOf) return hit;
      cur = hit;
    }
    return null;
  }
  function isCounter(state, q) { return !!parentOf(state, q); }
  function mainQuotes(state, blockId) { return (blockId ? quotes(state, blockId) : allQuotes(state)).filter(function (q) { return !parentOf(state, q); }); }
  /* The counter offers of a quote, oldest first (the order of the block's list); the last one is the live one. */
  function counterOffers(state, root) { return !root ? [] : allQuotes(state).filter(function (x) { return x !== root && parentOf(state, x) === root; }); }
  function liveCounter(state, root) { var c = counterOffers(state, root); return c.length ? c[c.length - 1] : null; }
  function effectiveQuote(state, root) { return liveCounter(state, root) || root; }                            // the quote that will become the policy: the newest counter offer, else the quote itself
  function counterDead(state, root) { var c = liveCounter(state, root); return !!c && dead(c); }               // the client did not accept the counter offer: nothing comes of the quote
  function chainIds(state, q) { var root = (q && parentOf(state, q)) || q, o = {}; if (!root) return o; o[root.id] = 1; counterOffers(state, root).forEach(function (c) { o[c.id] = 1; }); return o; }
  /* The quote that has become a policy: the live counter offer when it is accepted (policy number and start date from it, else from the quote it came from), or the quote itself when it has no counter offer. null: none. */
  function chainIssued(state, root) {
    var c = liveCounter(state, root);
    if (!c) return issued(root) ? root : null;
    if (!accepted(c) || !accepted(root)) return null;
    var no = c.policyNo || root.policyNo, sd = c.startDate; if (!no || !sd) return null;                           // the same policy number; the start date is the counter offer's own (the letter's proposed date is in offer.startDate)
    var own = activeLines(c).length > 0, off = c.offer || {};                                                  // a counter offer known only from its letter has no lines yet: the policy keeps the quote's lines, benefits and ACI so it is not an empty policy
    return Object.assign({}, c, { policyNo: no, startDate: sd, insurer: c.insurer || root.insurer, productName: c.productName || root.productName,
      lines: own ? c.lines : root.lines, aci: own ? c.aci : root.aci, aciText: own ? c.aciText : root.aciText, benefits: own ? c.benefits : root.benefits, cmp: c.cmp || (own ? null : root.cmp),
      premium: isNum(c.premium) ? c.premium : isNum(off.revPremium) ? off.revPremium : root.premium });
  }
  /* Whether a quote can have a counter offer added: the client accepted it and underwriting came back with loadings, exclusions or both. */
  function canCounter(state, q) { var u = uwOf(q); return !!q && !q.counterOf && !parentOf(state, q) && accepted(q) && (u === 'loadings' || u === 'exclusions' || u === 'both'); }
  /* Before, after and the difference of a counter offer's premium: the letter's original and revised premium (the letter is the source), else the premium of the quote before it in the chain and the counter offer's own premium. */
  function counterPremium(state, c) {
    var root = parentOf(state, c); if (!root) return null;
    var chain = [root].concat(counterOffers(state, root)), prev = chain[Math.max(0, chain.indexOf(c) - 1)], off = c.offer || {};
    var before = isNum(off.origPremium) ? off.origPremium : isNum(prev.premium) ? prev.premium : null, after = isNum(off.revPremium) ? off.revPremium : isNum(c.premium) ? c.premium : null;          // round 1.3: the LETTER is the source of before and after (the contract); the quotes fill in only what the letter does not print
    var diff = isNum(before) && isNum(after) ? r2(after - before) : null;
    return { before: before, after: after, diff: diff, pct: isNum(diff) && before > 0 ? Math.round(diff / before * 10000) / 100 : null, prev: prev };
  }
  /* The letter's premiums and the premiums of the quotes on either side of it are the same figures a cent apart (rounding): the LETTER's figures win, so a card never prints two premiums. For every counter offer: the quote before it
     takes the letter's original premium and the counter offer quote takes the letter's revised premium, when each differs by 5 cents or less. A larger difference is left as it is and the check counter.premium says so. Runs when a
     document is read and when a file opens (settleAll), so a file the skill built or one saved by 1.2 opens with one figure too. Returns how many premiums it changed. */
  function alignPremiums(state) {
    var n = 0, near = function (a, b) { return isNum(a) && isNum(b) && a !== b && Math.abs(a - b) <= 0.05; };
    mainQuotes(state).forEach(function (root) {
      var chain = [root].concat(counterOffers(state, root));
      for (var i = 1; i < chain.length; i++) {
        var c = chain[i], p = chain[i - 1], off = c.offer || {};
        if (near(p.premium, off.origPremium)) { p.premium = off.origPremium; n++; }
        if (near(c.premium, off.revPremium)) { c.premium = off.revPremium; n++; }
      }
    });
    return n;
  }
  /* The red references a quote's terms put on the pillar columns: [{ kind, text, pillars }]. A loading or an exclusion belongs to PILLARS (Paul, 25 November: "a loading would apply NOT to individual line items BUT to pillars: life, disability,
     severe and ICB"), so it is shown once per pillar, in the Loadings and exclusions row under the totals, never on a line. A loading is a cell of BrightRock's letter (a need group and a column group) or a benefit a person typed; an exclusion
     is numbered as the insurer numbers it and lists the cells it applies to. Derived: nothing is stored per line. */
  function pctText(p) { return (Math.round(p * 100) / 100) + '%'; }
  function termRefs(q) {
    var out = [], t = q && q.terms || {};
    (t.loadings || []).forEach(function (l) {
      if (!l || !isNum(l.pct) || !(l.pct > 0)) return;
      var col = schema.cellOf(l.need, l.column), pil = col ? col.pillars : (schema.BENEFIT_PILLARS[l.benefit] || schema.BENEFIT_PILLARS['All benefits']);          // the need group decides the pillar where the table says so (round 1.3)
      out.push({ kind: 'loading', text: '+' + pctText(l.pct) + ' loading', pillars: pil });
    });
    (t.exclusions || []).forEach(function (e, i) {
      if (!e) return;
      var label = 'Exclusion ' + (String(e.no == null ? '' : e.no).trim() || (i + 1)), cells = Array.isArray(e.applies) ? e.applies.filter(function (a) { return a && schema.columnGroupById[a.column]; }) : [];
      if (!cells.length) { out.push({ kind: 'exclusion', text: label, pillars: schema.BENEFIT_PILLARS[e.benefit] || schema.BENEFIT_PILLARS['All benefits'] }); return; }
      cells.forEach(function (a) { out.push({ kind: 'exclusion', text: label, pillars: schema.cellOf(a.need, a.column).pillars }); });
    });
    return out;
  }
  /* The references of ONE pillar (the Loadings and exclusions row under the totals, in the pillar's column): duplicates (the same text) are shown once. */
  function refsTotal(q, pillarId) { var seen = {}, out = []; termRefs(q).forEach(function (r) { if (r.pillars.indexOf(pillarId) < 0 || seen[r.text]) return; seen[r.text] = 1; out.push(r); }); return out; }
  /* The benefit a term row is about, DERIVED from the column group (a loading) or the cells it applies to (an exclusion), so a correction of the mapping reaches every file; a typed row keeps what was typed. */
  function termBenefit(r) {
    if (!r) return '';
    if (r.column && schema.columnGroupById[r.column]) return schema.cellOf(r.need, r.column).benefit;          // round 1.3: the need group decides (needs + recover = income protector, dread + recover = severe illness); a file saved by 1.2 opens with the new label because the stored `benefit` is never read here
    var cells = Array.isArray(r.applies) ? r.applies.filter(function (a) { return a && schema.columnGroupById[a.column]; }) : [];
    if (cells.length) return schema.cellsBenefit(cells);
    return r.benefit || '';
  }
  /* The letter's text can put an exclusion's own number (with its asterisk) in the middle of the paragraph that explains it. The number is never part of the wording: out it goes, but only when it carries a mark that is not a digit or a letter
     (a bare 4 could be real text) or when it stands alone on a line. Used when the letter is read and when a file read by 1.2 is opened. */
  function ownNumberOut(what, no) {
    var w = String(what == null ? '' : what), tok = String(no == null ? '' : no).trim(); if (!tok || !w) return w;
    var esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    w = /[^0-9A-Za-z]/.test(tok) ? w.replace(new RegExp('(^|\\s)' + esc + '(?=\\s|$)', 'g'), '$1') : w.replace(new RegExp('(^|\\n)[ \\t]*' + esc + '[ \\t]*(?=\\n|$)', 'g'), '$1');
    return w.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();          // the wording is one paragraph: a number taken out of the middle never leaves a blank line
  }
  /* The terms a counter offer read from the letter that nobody has checked yet. */
  function termsToCheck(q) { var t = q && q.terms || {}, n = 0; ['loadings', 'exclusions'].forEach(function (k) { (t[k] || []).forEach(function (r) { if (r && r.st === 'verify') n++; }); }); return n; }

  /* Block 1: the policies that are not removed, and every accepted quote that has been issued (policy number and start date): it is shown here as a WR policy and no longer as a quote.
     A schedule with the same policy number wins over the quote. Each entry is { item, derived }. */
  function policies(state) {
    var items = active(state && state.blocks && state.blocks.policies && state.blocks.policies.items), out = items.map(function (i) { return { item: i, derived: false }; });
    var have = {}; items.forEach(function (i) { if (i.policyNo) have[norm(i.policyNo)] = 1; });
    mainQuotes(state).forEach(function (root) {
      var q = chainIssued(state, root);                                                                       // round 1.2: when the insurer sent a counter offer, the policy that issues is the counter offer the client accepted
      if (!q || have[norm(q.policyNo)]) return;
      out.push({ derived: true, item: { id: q.id, wr: true, insurer: q.insurer, product: q.productName || (q.kind === 'fna' ? 'FNA' : q.kind), policyNo: q.policyNo, doc: q.startDate, premium: q.premium, aci: q.aci, aciText: q.aciText || null, abi: null,
        ipAge: q.disabilityAge, benefits: q.benefits || {}, lines: q.lines || [], cmp: q.cmp || null, st: q.st, src: q.src, by: q.by, fromQuote: q.id } });
    });
    return out;
  }

  /* ---------- a quote's state: ONE place (round 1.1, 24 November) ---------- */
  /* The client decides first (status: pending, accepted, notaccepted); only an accepted quote goes to underwriting (uw: pending, then an outcome). Everything that needs to know whether a quote counts as accepted (the badge, the policy
     an issued quote becomes, the one-acceptance rule, the replacement notes) asks these functions. Returns how many things settleQuote changed in a quote that was read from an older file or typed. */
  function settleQuote(q) {
    var n = 0; if (!q || typeof q !== 'object') return 0;
    var lg = schema.LEGACY_STATUS[q.status];
    if (lg) { q.status = lg[0]; if (!q.uw) q.uw = lg[1]; n++; }                                           // an older file: the insurer's answer was a status of its own
    if (!schema.statusLabel[q.status]) { q.status = 'pending'; n++; }
    if (q.uw != null && !schema.uwLabel[q.uw]) { q.uw = null; n++; }
    if (q.uw === undefined) { q.uw = null; n++; }
    if (typeof q.second !== 'boolean') { q.second = q.second === true || q.second === 'true'; n++; }
    if (q.counterOf === undefined) q.counterOf = null; else if (q.counterOf === '' || (q.counterOf !== null && typeof q.counterOf !== 'string')) { q.counterOf = null; n++; }          // an older file has no counterOf: that is not a change worth counting
    if (q.counterOf) { if (q.uw) { q.uw = null; n++; } if (!q.offer || typeof q.offer !== 'object') { q.offer = {}; n++; } } else if (q.offer === undefined) q.offer = null;
    var t = q.terms && typeof q.terms === 'object' ? q.terms : (q.terms = { loadings: [], exclusions: [] }, n++);
    if (!Array.isArray(t.loadings)) { t.loadings = []; n++; } if (!Array.isArray(t.exclusions)) { t.exclusions = []; n++; }
    if (q.counterOf) t.exclusions.forEach(function (e) { if (e && e.no && typeof e.what === 'string' && e.st === 'verify' && e.by !== 'person') { var w = ownNumberOut(e.what, e.no); if (w !== e.what) { e.what = w; n++; } } });          // round 1.3: a row read by 1.2 may carry its own number in the wording; nothing a person typed or checked is touched
    var r = q.repl && typeof q.repl === 'object' ? q.repl : (q.repl = { answer: null, policies: [] }, n++);
    if (r.answer !== 'yes' && r.answer !== 'no' && r.answer !== null) { r.answer = null; n++; } if (r.answer === undefined) r.answer = null;
    if (!Array.isArray(r.policies)) { r.policies = []; n++; }
    return n;
  }
  function uwOf(q) { return q && !q.counterOf && q.status === 'accepted' && schema.uwLabel[q.uw] ? q.uw : null; }               // the underwriting step counts only for a quote the client accepted
  function declined(q) { return schema.UW_DECLINED.indexOf(uwOf(q)) >= 0; }
  /* "In an accepted state": the client accepted it and the insurer has not declined it (pending underwriting counts; a removed quote never does). */
  function accepted(q) { return !!q && !q.removed && q.status === 'accepted' && !declined(q); }
  function dead(q) { return !q || !!q.removed || q.status === 'notaccepted' || declined(q); }                  // not accepted by the client, or declined by the insurer: it will not come about
  function issued(q) { return accepted(q) && !!q.policyNo && !!q.startDate; }                               // an accepted quote the insurer has issued as a policy
  function statusText(q, state) {
    if (!q) return '';
    if (q.counterOf) return 'Counter offer · ' + (schema.statusLabel[q.status] || schema.statusLabel.pending);               // a counter offer carries only the client's decision
    var base = q.status === 'notaccepted' ? schema.statusLabel.notaccepted : q.status !== 'accepted' ? schema.statusLabel.pending : (function () { var u = uwOf(q); return !u ? 'Accepted' : u === 'pending' ? 'Accepted · Pending underwriting' : schema.uwLabel[u]; })();
    var live = state && liveCounter(state, q);
    return live ? base + (live.status === 'accepted' ? ' · Counter offer accepted' : live.status === 'notaccepted' ? ' · Counter offer not accepted' : ' · Counter offer received') : base;
  }
  /* The class of a quote's badge (the colours already exist: pending, accepted, notaccepted, underwriting, medical, declined). */
  function statusClass(q, state) {
    if (!q || q.status === 'pending' || !schema.statusLabel[q.status]) return 'pending';
    if (state && counterDead(state, q)) return 'notaccepted';                                                        // the client turned the counter offer down: nothing comes of the quote
    if (q.status === 'notaccepted') return 'notaccepted';
    var u = uwOf(q); return u === 'pending' ? 'underwriting' : u === 'declinedHealth' ? 'medical' : u === 'declinedOther' ? 'declined' : 'accepted';
  }
  function acceptedQuotes(state) { return mainQuotes(state).filter(function (q) { return accepted(q) && !counterDead(state, q); }); }          // a quote and its counter offers are ONE acceptance; a counter offer the client did not accept ends it
  /* The one-acceptance rule: across the FNA, shortfall, reduced and comparative quotes only one may be in an accepted state, unless the adviser has ticked "second policy alongside the first" on a quote. Every accepted quote that is not
     ticked is in conflict when there are two or more of them. Returns [{ quote, others }]. */
  function acceptanceConflicts(state) {
    var one = acceptedQuotes(state).filter(function (q) { return !q.second; });
    return one.length < 2 ? [] : one.map(function (q) { return { quote: q, others: one.filter(function (x) { return x !== q; }) }; });
  }
  /* ---------- replacements (round 1.1) ---------- */
  function replOf(q) { var r = q && q.repl; return { answer: r && (r.answer === 'yes' || r.answer === 'no') ? r.answer : null, policies: r && Array.isArray(r.policies) ? r.policies : [] }; }
  function quoteRef(q) { var n = q.number ? (/bright/i.test(q.insurer || '') ? 'CP ' : '') + q.number : ''; return [q.insurer, 'quote', n].filter(Boolean).join(' '); }
  function policyRef(it) { return [it.insurer || 'Policy', it.policyNo].filter(Boolean).join(' '); }
  /* The current policies a quote can replace: every policy of block 1 except the one the quote itself became. */
  function replaceable(state, q) { var ids = chainIds(state, q); return policies(state).filter(function (e) { return !ids[e.item.id]; }); }
  /* Which quotes replace which policy, from the quotes that are still alive (not removed, not declined by the client or the insurer); answered: at least one such quote has had its replacement question answered. */
  function replacementInfo(state) {
    var live = mainQuotes(state).filter(function (q) { return !dead(q) && !counterDead(state, q); }), ids = {}, by = {};
    policies(state).forEach(function (e) { ids[e.item.id] = 1; });
    live.forEach(function (q) {
      var r = replOf(q), eff = effectiveQuote(state, q), own = chainIds(state, q); if (r.answer !== 'yes') return;                // the answer is given on the quote the client accepted; a counter offer is the same replacement, named by its own number
      r.policies.forEach(function (id) { if (!ids[id] || own[id]) return; (by[id] = by[id] || []).push(eff.number ? eff : q); });
    });
    return { answered: live.some(function (q) { return !!replOf(q).answer; }), by: by };
  }
  /* The red note of a policy (the screen, the PDF and the Presentation all print this one): replaced by a quote, or "Will not be replaced" once a quote's question has been answered (never before: nothing is decided yet),
     with the broker question for a policy of another broker. null: no note. */
  function policyNote(state, entry, info) {
    info = info || replacementInfo(state); var it = entry.item, by = info.by[it.id];
    if (by && by.length) return { kind: 'replaced', red: true, text: policyRef(it) + ' will be replaced by ' + by.map(quoteRef).join(' and '), quotes: by.map(function (q) { return q.id; }) };
    if (entry.derived || !info.answered) return null;
    var out = { kind: 'not', red: true, text: 'Will not be replaced', broker: !it.wr, record: null, date: null, brokerText: '' };
    if (out.broker) {
      out.record = it.brokerRecord === 'stays' || it.brokerRecord === 'moves' ? it.brokerRecord : null; out.date = it.brokerChangedDate || null;
      out.brokerText = out.record === 'moves' ? (out.date ? 'Broker changed on ' + out.date : 'Broker on record to be changed') : out.record === 'stays' ? 'Broker on record stays with the current broker' : '';
    }
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
    var f = quotes(state, 'fna').filter(function (x) { return !x.counterOf; })[0];                            // never a counter offer (even one whose quote was removed): the need is the quote the client was first given
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

  return { alignPremiums: alignPremiums, ownNumberOut: ownNumberOut, settleQuote: settleQuote, parentOf: parentOf, isCounter: isCounter, mainQuotes: mainQuotes, counterOffers: counterOffers, liveCounter: liveCounter, effectiveQuote: effectiveQuote, counterDead: counterDead, chainIds: chainIds, chainIssued: chainIssued, canCounter: canCounter, counterPremium: counterPremium, termRefs: termRefs, termBenefit: termBenefit, refsTotal: refsTotal, termsToCheck: termsToCheck, uwOf: uwOf, declined: declined, accepted: accepted, dead: dead, issued: issued, statusText: statusText, statusClass: statusClass, acceptedQuotes: acceptedQuotes, acceptanceConflicts: acceptanceConflicts, replOf: replOf, quoteRef: quoteRef, policyRef: policyRef, replaceable: replaceable, replacementInfo: replacementInfo, policyNote: policyNote, settleLine: settleLine, aciPoints: aciPoints, sameDebtName: sameDebtName, isNum: isNum, r2: r2, norm: norm, fmtR: fmtR, fmtPct: fmtPct, fmtAci: fmtAci, matchChildren: matchChildren, matchDebts: matchDebts, pageShown: pageShown, pageWhy: pageWhy, fmtDiff: fmtDiff, show: show, lineVal: lineVal, active: active, activeLines: activeLines, totals: totals, sumLines: sumLines,
    quotes: quotes, allQuotes: allQuotes, policies: policies, policyTotals: policyTotals, groupItems: groupItems, hasGroupRisk: hasGroupRisk, groupTotals: groupTotals, investments: investments,
    personalInvestments: personalInvestments, shortfall: shortfall, compare: compare, pillars: pillarOfBlock };
});
