/* The Client Overview Studio's Presentation, the screen: a full-screen, read-only view of what the PDF sent to the client holds (the figures come from ov-calc.js, the same code), for the meeting.
   Design approved by Paul on 22 November: a white page, a top bar (logo, client, "Client Overview · Presentation · date"), nine pill tabs (a tab with nothing to show is greyed), an Overview page of cards with ONE factual
   sentence each (js/ov-pres.js, the wording table), quote tables like the PDF (grid lines, totals, the blue premium bar), pills that highlight a column and a Key points on / off switch, key points as small cards that
   slide in on the right (private library found by the page itself; placeholders until then), Severe illness in two sections. There is NO voice. It never scrolls (a page is drawn at one width and scaled to fit) and it
   never changes the overview. Nothing for Sitamah and Paul only is shown: no checks, no amber statuses, no income figure. */
(function () {
  var FF = window.FF, OV = window.OV, schema = OV.schema, calc = OV.calc, P = OV.pres;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var KP_KEY = 'wr-keypoints', SLIDE_W = 1240;
  var ps = { tab: 'map', qi: 0, sub: 'quote', pol: null, pil: null, rows: [], keys: true, exShut: {} };
  var root = null, open = false, kp = null, kpNote = '', prevOverflow = '', fsOff = 0;

  function state() { return OV.app.state; }
  /* The View buttons (0.95): the same button as the entry screen's, larger; one that cannot open its file is hidden here (nothing greyed in front of a client). */
  function vp(path) { return OV.view && path ? OV.view.button(state(), path, 'pres') : ''; }
  function idxOf(block, list, o) { var i = state().blocks[block][list].indexOf(o); return i >= 0 ? 'blocks.' + block + '.' + list + '.' + i : ''; }
  function loadKP() { try { var j = JSON.parse(localStorage.getItem(KP_KEY) || 'null'); return j && Array.isArray(j.points) ? j : null; } catch (e) { return null; } }
  function saveKP(o) { try { if (o) localStorage.setItem(KP_KEY, JSON.stringify(o)); else localStorage.removeItem(KP_KEY); } catch (e) { /* kept for this visit only */ } kp = o; }

  /* ---------- the little icons (plain line drawings, the colour of the text around them) ---------- */
  var IC = {
    policies: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z M9 12l2 2 4-4',
    fna: 'M7 4h10a1 1 0 011 1v15a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z M9 9h6 M9 13h6 M9 17h4',
    group: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 11a2.5 2.5 0 100-5 M17 14.2c2.3.5 4 2.6 4 5.8',
    shortfall: 'M5 20h14 M7 20v-9 M12 20V5 M17 20v-5',
    shortfallQuote: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z M12 9v6 M9 12h6',
    reduced: 'M12 5v14 M6 13l6 6 6-6',
    comparative: 'M4 20V10h5v10z M15 20V5h5v15z M4 20h16',
    investments: 'M4 18l5-6 4 3 7-9 M15 6h5v5',
    proposed: 'M4 19l5-6 4 3 4-5 M17 3v6 M14 6h6',
    goals: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z M12 12.6a.6.6 0 100-1.2.6.6 0 000 1.2z',
    other: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z',
    life: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z',
    sev: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
    lsd: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z',
    ip: 'M3 7h18v10H3z M12 14a2 2 0 100-4 2 2 0 000 4z M6 10v.01 M18 14v.01',
    aci: 'M4 17l5-5 4 4 7-8 M15 8h5v5',
    abi: 'M5 19L19 5 M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M16.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    key: 'M12 3a6 6 0 00-3.5 10.9V17h7v-3.1A6 6 0 0012 3z M9.5 20h5',
    retire: 'M12 4v2 M5.6 8.6l1.4 1.4 M18.4 8.6L17 10 M4 15h16 M7 15a5 5 0 0110 0 M3 19h18',
    will: 'M7 3h8l4 4v14H7z M15 3v4h4 M10 12h6 M10 16h4',
    medical: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
    home: 'M4 11l8-7 8 7v9H4z M10 20v-6h4v6'
  };
  function ico(id, cls) { return IC[id] ? '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[id] + '"/></svg>' : ''; }

  /* ---------- the little pieces of every table (the same words and figures as the PDF) ---------- */
  var NA = function (v) { return v === 'N/A' || v === 'Not found'; };
  function A(v, cls) { return calc.isNum(v) ? '<span class="a' + (cls ? ' ' + cls : '') + '">' + calc.fmtR(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function PM(v) { return calc.isNum(v) ? '<span class="a pmv">' + calc.fmtR(v) + '</span> <small class="pm">p.m.</small>' : A(v); }
  function AC(x) {
    var t = calc.fmtAci(x), pts = calc.aciPoints(x); if (!t) return '<span class="none">&ndash;</span>';
    if (pts.length === 1 && pts[0] === t) return '<span class="a aci" title="' + esc(t) + '">' + esc(t) + '</span>';
    return '<span class="a aci pts" title="' + esc(t) + '"><ul>' + pts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></span>';          // 1 to 3 short points (round 4); the whole wording is the hover text
  }
  function PC(v) { return calc.isNum(v) ? '<span class="a">' + calc.fmtPct(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function td(inner, cls, pil, extra) { return '<td' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '"' : '') + (extra || '') + '>' + inner + '</td>'; }
  function th(text, pil, cls) {
    return '<th' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '" title="Click to highlight this column"' : '') + '>' + (pil && IC[pil] ? '<span class="hi">' + ico(pil) + '</span>' : '') + '<span class="ht">' + esc(text).replace(/\n/g, '<br>') + '</span></th>';
  }
  function tbl(widths, head, body, cls) {
    return '<div class="ptw"><table class="ptbl ' + (cls || '') + '"><colgroup>' + widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  var BLOCK_SHORT = { shortfall: 'Shortfall', shortfallQuote: 'Shortfall quote', reduced: 'Reduced quotes', comparative: 'Comparative quotes', investments: 'Current investments', proposed: 'Proposed investments' };
  /* A tab that holds two blocks has a small button for each (only the ones that can be opened). */
  function blockChips(b) {
    var bl = P.tabBlocks(state(), b.id); if (bl.length < 2) return '';
    return '<span class="pchips blk">' + bl.map(function (id) { return '<button type="button" class="pchip' + (id === b.id ? ' on' : '') + '" data-act="blk" data-b="' + id + '">' + esc(BLOCK_SHORT[id] || id) + '</button>'; }).join('') + '</span>';
  }
  function head(b, right) { return '<div class="phead"><span class="pico">' + ico(b.id) + '</span><h2 class="ptitle">' + esc(b.title) + '</h2>' + blockChips(b) + '<span class="sp"></span>' + (right || '') + '</div>'; }
  function empty(text) { return '<p class="pempty">' + esc(text) + '</p>'; }
  function note(text) { return '<p class="pnote">' + esc(text) + '</p>'; }
  function ageText(age) { return age ? '\nAge ' + age : ''; }
  var PILL_ROW = [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector']];
  var BUTTONS = PILL_ROW.concat([['aci', 'ACI'], ['abi', 'ABI']]);
  function pillBtns() { return BUTTONS.map(function (p) { return '<button type="button" class="pbtn" data-act="pil" data-p="' + p[0] + '">' + ico(p[0]) + '<span>' + p[1] + '</span></button>'; }).join(''); }
  function keySwitch() { return '<button type="button" class="pswitch' + (ps.keys ? ' on' : '') + '" data-act="keys" role="switch" aria-checked="' + ps.keys + '"><span class="sw"></span><span class="st">Key points: ' + (ps.keys ? 'on' : 'off') + '</span></button>'; }
  /* The pills; the Key points switch only where key points can show (a quote, a policy's lines). */
  function hb(keys) { return '<span class="pbtns2">' + pillBtns() + (keys ? keySwitch() : '') + '</span>'; }
  function tools(left) { return left ? '<div class="ptools">' + left + '</div>' : ''; }

  /* ---------- the lines of a quote or a policy ---------- */
  function needCell(l) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, name = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? [l.debt, l.bank].filter(Boolean).join(' - ') : '';
    var cov = l.type !== 'other' ? (l.accelerated === true ? '<small class="cov">Accelerated</small>' : l.accelerated === false ? '<small class="cov">Standalone</small>' : '') : '';          // every need line, not only a debt (round 4)
    return td('<b>' + esc(l.type === 'other' ? (l.label || tp.l) : tp.l) + '</b>' + (name ? '<small>' + esc(name) + '</small>' : '') + cov, 'l');
  }
  function lineLabel(l) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, name = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? (l.debt || l.bank || '') : '';
    return (l.type === 'other' ? (l.label || tp.l) : tp.l) + (name ? ' · ' + name : '');
  }
  /* The red references a quote's terms put on a PILLAR (round 1.2): in the Loadings and exclusions row under the totals, never on a line (Paul, 25 November). */
  function refSmall(r) { return '<small class="rednote ref">' + esc(r.text) + '</small>'; }
  function pillCell(l, p, monthly, q) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, hasIP = l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0;
    if (l[p] === 'N/A') return td('<span class="na">N/A</span>', '', p);
    if (p === 'ip') return td(PM(calc.lineVal(l, 'ip', 'monthly')) + (hasIP ? '<small>Instalment Protector</small><small class="red">To be ceded to the bank</small>' : ''), '', 'ip');
    var L = calc.lineVal(l, p, 'lump'), M = monthly ? calc.lineVal(l, p, 'monthly') : undefined;
    if (!calc.isNum(L) && !calc.isNum(M) && L !== 'Not found') return td('<span class="none">&ndash;</span>', '', p);
    return td(A(L) + (monthly ? A(M, 'red') + '<small>' + esc(tp.monthly) + '</small>' : ''), '', p);
  }
  function lineRow(l, aci) {
    var isNA = function (k) { return l[k] === 'N/A'; };
    return '<tr data-keys="' + esc(P.lineKeys(l).join('|')) + '" data-ben="' + esc(P.lineBenefits(l).join(',')) + '" data-label="' + esc(lineLabel(l)) + '">' + needCell(l) + td(esc(l.term || ''), 'l term') + pillCell(l, 'life', true, aci) + pillCell(l, 'sev', false, aci) + pillCell(l, 'lsd', true, aci) + pillCell(l, 'ip', true, aci) +
      td(isNA('waiting') ? '<span class="na">N/A</span>' : esc(l.waiting || '-')) + td(aci ? AC(aci) : '<span class="none">&ndash;</span>', '', 'aci') + td(PC(l.abi), '', 'abi') + '</tr>';
  }
  var LINE_W = [15, 13, 12, 9, 12, 14, 7, 11, 7];
  function linesHead(age) {
    return th('Need', '', 'l') + th('Term', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageText(age), 'lsd') + th('Income protector / sickness benefit' + ageText(age), 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi');
  }
  function linesTable(c, isPolicy, age) {
    var lines = calc.activeLines(c), body = lines.map(function (l) { return lineRow(l, isPolicy ? null : c); }).join('');
    if (!isPolicy) {
      var tt = calc.totals(c), rf = c.terms ? ['life', 'sev', 'lsd', 'ip'].map(function (pid) { return calc.refsTotal(c, pid).map(refSmall).join(''); }) : [];
      body += (rf.some(Boolean) ? '<tr class="tot refs" data-keys="total-refs"><td class="l" colspan="2">Loadings and exclusions</td>' + td(rf[0], '', 'life') + td(rf[1], '', 'sev') + td(rf[2], '', 'lsd') + td(rf[3], '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + '</tr>' : '') + '<tr class="tot" data-keys="total-lump"><td class="l" colspan="2">Total lump sum</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td('', '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + '</tr>' +
        '<tr class="tot" data-keys="total-ip"><td class="l" colspan="2">Total income protected</td>' + td(PM(tt.life.monthly), '', 'life') + td('<span class="na">N/A</span>', '', 'sev') + td(PM(tt.lsd.monthly), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + '</tr>' +
        '<tr class="prem" data-keys="total-premium"><td class="l" colspan="5">Monthly premium' + (c.rates ? ' \u00b7 ' + esc(c.rates) : '') + '</td><td colspan="4">' + A(c.premium) + '</td></tr>';
    }
    return tbl(LINE_W, linesHead(age), body, 'lines');
  }

  /* ---------- a quote: its tabs ---------- */
  var KIND = { fna: 'FNA', shortfall: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote' };
  function quoteHead(q, right) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return '<div class="qhead"><span class="badge ' + esc(calc.statusClass(q, state())) + '">' + esc(calc.counterDead(state(), q) && calc.liveCounter(state(), q) ? 'Counter offer not accepted' : calc.statusText(q)) + '</span><span class="qinfo">' + esc([q.insurer, q.counterOf ? 'Counter offer' : KIND[q.kind], n, q.date, q.rates, q.servicing ? 'Servicing quote' : '', (function () { var g = calc.liveCounter(state(), q); return g && g.status !== 'notaccepted' ? (g.status === 'accepted' ? 'Counter offer accepted' : 'Counter offer received') : ''; })()].filter(Boolean).join('   |   ')) + '</span>' + (right || '') + '</div>';
  }
  function cmpView(q) {
    var m = q.cmp; if (!m) return '';
    if (!(m.rows && m.rows.length)) return note(m.reason || 'The insurer gave no change moment pay-out for this quote.');
    var lbl = { total: 'Total for all your needs', retirement: 'Your retirement needs', childcare: 'Your childcare needs' };
    return tbl([30, 17, 30, 23], th('', '', 'l') + th('Today') + th('Projected value at your change moment date') + th('Pay-out date'), m.rows.map(function (r) {
      return '<tr>' + td('<b>' + esc(r.key === 'child' ? ((r.name || '') + ' ' + (r.sname || '')).trim() : (lbl[r.key] || r.key)) + '</b>', 'l') + td(A(r.today)) + td(A(r.projected)) + td(esc(r.payoutDate || '')) + '</tr>';
    }).join('')) + note('Retirement part: paid monthly for 10 years from the month after the policy anniversary that follows age 65 (so about 65 to 75), growing 5% a year. Childcare part: a once-off lump sum for each child when their childcare cover ends. Only paid if you are alive and the linked cover is still in place.');
  }
  function compareView(q) {
    var c = calc.compare(state(), q), row = function (label, r, d) {
      var f = function (v, pm, p) { return td(d ? '<span class="a">' + calc.fmtDiff(v) + '</span>' : (pm ? PM(v) : A(v)), '', p); };
      return '<tr' + (d ? ' class="diff"' : '') + '>' + td('<b>' + label + '</b>', 'l') + f(r.life, false, 'life') + f(r.sev, false, 'sev') + f(r.lsd, false, 'lsd') + f(r.ip, true, 'ip') + f(r.premium) + '</tr>';
    };
    return tbl([22, 16, 16, 16, 16, 14], th('', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability', 'lsd') + th('Income protector p.m.', 'ip') + th('Monthly premium'),
      row('What you have now', c.now) + row('This quote', c.quote) + row('Difference', c.diff, true));
  }
  function currentQuote(b) { var qs = calc.quotes(state(), b.id); return qs[Math.min(ps.qi, Math.max(0, qs.length - 1))]; }
  function quotesView(b) {
    var qs = calc.quotes(state(), b.id);
    if (!qs.length) return head(b) + empty(b.id === 'shortfallQuote' && !calc.hasGroupRisk(state()) ? 'The client has no group risk, so no shortfall quote is needed.' : 'Nothing to show here for this client.');
    var cur = Math.min(ps.qi, qs.length - 1), q = qs[cur], hasCmp = !!q.cmp, extra = counterView(q) + uwView(q) + replView(q), sub = (ps.sub === 'cmp' && !hasCmp) || (ps.sub === 'uw' && !extra) ? 'quote' : ps.sub;
    var chips = qs.length > 1 ? '<span class="sp"></span><span class="pchips">' + qs.map(function (x, i) { return '<button type="button" class="pchip' + (i === cur ? ' on' : '') + '" data-act="q" data-i="' + i + '">' + esc((x.counterOf ? 'Counter offer' : (x.insurer || 'Quote')) + (x.number ? ' ' + x.number : '')) + '</button>'; }).join('') + '</span>' : '';
    var subs = [['quote', 'The quote']].concat(hasCmp ? [['cmp', 'Your change moment pay-out']] : [], (q.counterOf && !calc.activeLines(q).length ? [] : [['cmpr', 'Compared with what you have now']]), extra ? [['uw', q.counterOf ? 'Counter offer terms' : 'Underwriting and replacements']] : []);          // the terms and the replacements have a tab of their own: on the quote page they made the page too small to read (round 1.1)
    var qpath = idxOf(b.id, 'quotes', q), out = head(b, sub !== 'cmp' && sub !== 'uw' ? hb(true) : '') + quoteHead(q, (sub === 'cmp' ? vp(qpath && qpath + '.cmp') : vp(qpath)) + chips);
    out += tools('<span class="psubs">' + subs.map(function (s) { return '<button type="button" class="psub' + (s[0] === sub ? ' on' : '') + '" data-act="sub" data-s="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</span>');
    if (sub === 'cmp') return out + cmpView(q);
    if (sub === 'cmpr') return out + compareView(q);
    if (sub === 'uw') return out + extra;
    out += linesTable(q, false, q.disabilityAge || state().header.disabilityAge);
    if (q.counterOf) out += counterPrem(q);
    if (calc.activeLines(q).some(function (l) { return l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; })) out += note('Instalment Protector: if you are retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.');
    return out;
  }
  /* The insurer's terms, and which of the client's policies a quote replaces (round 1.1): the same words as the screen and the PDF. */
  /* A counter offer (round 1.2): premium before and after, and what its letter says beyond the terms. */
  function premP(pr) {
    if (!pr || !calc.isNum(pr.before) || !calc.isNum(pr.after)) return '';
    return 'Premium: before ' + calc.fmtR(pr.before) + ' p.m.   |   after ' + calc.fmtR(pr.after) + ' p.m.   |   difference ' + calc.fmtDiff(pr.diff) + (calc.isNum(pr.pct) ? ' (' + (pr.pct > 0 ? '+' : pr.pct < 0 ? '\u2212' : '') + Math.abs(pr.pct) + '%)' : '');
  }
  function counterPrem(q) { var t = premP(calc.counterPremium(state(), q)); return t ? '<p class="cprem">' + esc(t) + '</p>' : ''; }
  function counterView(q) {
    var root = calc.parentOf(state(), q); if (!root) return '';
    var off = q.offer || {}, h = '<div class="uwv counterv"><h4>Counter offer to ' + esc(calc.quoteRef(root)) + '</h4>' + (off.expires ? '<p class="uwok">The revised proposal expires ' + esc(off.expires) + '.</p>' : '') + counterPrem(q);
    if (off.notes) h += '<p class="rednote">' + esc('The letter also says: ' + off.notes) + '</p>';
    return h + '</div>';
  }
  /* The underwriting decision of a counter offer (round 1.3, Paul 25 November): the same plain summary as the screen and the PDF (calc.termsSummary). Each exclusion's wording is in FULL and can be folded away with one click (open until the adviser
     folds it): the page is drawn at one size and scaled to fit, so a long paragraph folds to give the rest room. The fold is kept in ps.exShut, because render() draws the slide again. */
  function uwSummaryView(q) {
    var sm = calc.termsSummary(q); if (!sm.loadings.length && !sm.exclusions.length) return '';
    var h = '<div class="uwv uwsum"><h4>Underwriting decision</h4>' + (sm.decision ? '<p class="uwok">Decision: <b>' + esc(sm.decision) + '</b></p>' : '') + '<h5>Underwriting terms of the counter offer letter: ' + esc(sm.heading) + '</h5>';
    if (sm.loadings.length) h += '<h6>Loadings</h6><ul class="uwld">' + sm.loadings.map(function (l) { return '<li><b>' + esc(l.label) + '</b><span class="rednote">' + esc(l.texts.join(', ')) + '</span></li>'; }).join('') + '</ul>';
    var rs = sm.reason; if (rs) h += '<p class="uwreason"><b>Reason</b> ' + esc(rs.text) + (rs.src && rs.src.kind === 'uwemail' ? ' <small>(underwriter’s e-mail' + (rs.src.date ? ', ' + esc(rs.src.date) : '') + ')</small>' : '') + '</p>';
    if (sm.exclusions.length) h += '<h6>Exclusions</h6>' + sm.exclusions.map(function (e) {
      var k = q.id + '|' + e.index, shut = !!ps.exShut[k];
      return '<div class="uwex' + (shut ? ' shut' : '') + '"><button type="button" class="exh" data-act="exw" data-k="' + esc(k) + '" aria-expanded="' + (shut ? 'false' : 'true') + '"><i>' + (shut ? '▸' : '▾') + '</i><b class="redno">' + esc(e.no) + '</b><span>' + esc(e.benefit) + '</span><em>' + (shut ? 'Show wording' : 'Hide wording') + '</em></button>' + (shut ? '' : '<p class="exw">' + esc(e.what) + '</p>') + '</div>';
    }).join('');
    return h + '</div>';
  }
  function uwView(q) {
    if (q.counterOf) return uwSummaryView(q);
    var counter = !!q.counterOf, tm0 = q.terms || {}, u = counter ? ((tm0.loadings || []).length || (tm0.exclusions || []).length ? 'both' : null) : calc.uwOf(q); if (!u || u === 'pending' || schema.UW_DECLINED.indexOf(u) >= 0) return '';
    var h = '<div class="uwv"><h4>' + (counter ? 'Underwriting terms of the counter offer' : 'Underwriting outcome') + '</h4>' + (counter ? '' : '<p class="uwok">' + esc(u === 'standard' ? 'Accepted at standard rates.' : schema.uwLabel[u] + '.') + '</p>'), tm = q.terms || {}, ls = Array.isArray(tm.loadings) ? tm.loadings : [], es = Array.isArray(tm.exclusions) ? tm.exclusions : [];
    if ((u === 'loadings' || u === 'both') && ls.length) h += tbl([24, 14, 14, 48], th('Loading on', '', 'l') + th('Percentage added') + th('Reason') + th('The reason in words', '', 'l'),
      ls.map(function (r) { var ng = schema.needGroupById[r.need]; return '<tr>' + td('<b>' + esc(calc.termBenefit(r) || '') + '</b>' + (ng ? '<small>' + esc(ng.l) + '</small>' : ''), 'l') + td(calc.isNum(r.pct) ? esc(calc.fmtPct(r.pct)) : '-') + td(esc(schema.loadingKindLabel[r.kind] || '')) + td(esc(r.reason || ''), 'l') + '</tr>'; }).join(''), 'terms');
    var withNo = es.some(function (r) { return r && r.no; });
    if ((u === 'exclusions' || u === 'both') && es.length) h += withNo ? tbl([8, 22, 46, 24], th('No.', '', 'l') + th('Benefit', '', 'l') + th('What is excluded', '', 'l') + th('Type', '', 'l'),
      es.map(function (r) { return '<tr>' + td('<b class="redno">' + esc(r.no || '') + '</b>', 'l') + td('<b>' + esc(calc.termBenefit(r)) + '</b>', 'l') + td(esc(r.what || ''), 'l') + td(esc(r.why || ''), 'l') + '</tr>'; }).join(''), 'terms') : tbl([24, 38, 38], th('Benefit', '', 'l') + th('What is excluded', '', 'l') + th('Why', '', 'l'),
      es.map(function (r) { return '<tr>' + td('<b>' + esc(r.benefit || '') + '</b>', 'l') + td(esc(r.what || ''), 'l') + td(esc(r.why || ''), 'l') + '</tr>'; }).join(''), 'terms');
    return h + '</div>';
  }
  function replView(q) {
    if (calc.dead(q) || q.counterOf || calc.counterDead(state(), q)) return '';                                       // a counter offer is the same replacement, told under the quote the client accepted, naming the counter offer
    var r = calc.replOf(q), ids = {}, live = calc.effectiveQuote(state(), q); calc.policies(state()).forEach(function (e) { ids[e.item.id] = e; });
    if (r.answer === 'no') return note('This quote does not replace any of your existing policies.');
    var picks = r.answer === 'yes' ? r.policies.map(function (id) { return ids[id]; }).filter(function (e) { return e && !calc.chainIds(state(), q)[e.item.id]; }) : [];
    return picks.length ? '<div class="uwv"><h4>Replacing your existing policies</h4>' + picks.map(function (e) { return '<p class="rednote">' + esc(calc.policyRef(e.item) + ' will be replaced by ' + calc.quoteRef(live)) + '</p>'; }).join('') + '</div>' : '';
  }

  /* ---------- the other blocks ---------- */
  function tickCell(inner, yes) { return '<td class="l tick"><i class="' + (yes ? 'yes' : 'no') + '">' + (yes ? '&#10003;' : '&#10005;') + '</i>' + inner + '</td>'; }
  function policiesView(b) {
    var s = state(), ps0 = calc.policies(s), pt = calc.policyTotals(s), age = s.header.disabilityAge;
    if (!ps0.length) return head(b) + empty('No current policies.');
    var one = ps.pol != null ? ps0[ps.pol] : null;
    if (one) {
      var it = one.item, ppath = idxOf('policies', 'items', it);
      return head(b, hb(true)) + '<div class="qhead"><button type="button" class="pchip back" data-act="polall">&larr; All policies</button><span class="qinfo">' + esc([it.insurer || 'Policy', it.policyNo, it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join('   |   ')) + '</span>' + vp(ppath) + '</div>' + (function () { var pn1 = calc.policyNote(s, one, calc.replacementInfo(s)); return pn1 ? '<p class="rednote">' + esc(pn1.text) + '</p>' + (pn1.brokerText ? '<p class="' + (pn1.record === 'moves' && !pn1.date ? 'rednote' : 'bnote') + '">' + esc(pn1.brokerText) + '</p>' : '') : ''; })() + linesTable(it, true, it.ipAge || age) + (it.cmp ? '<div class="qhead"><span class="qinfo">Your change moment pay-out</span>' + vp(ppath && ppath + '.cmp') + '</div>' + cmpView(it) : '');
    }
    var ageH = ageText(age), ri = calc.replacementInfo(s), rows = ps0.map(function (e, i) {
      var pn = calc.policyNote(s, e, ri), pnote = pn ? '<small class="rednote">' + esc(pn.text) + '</small>' + (pn.brokerText ? '<small class="' + (pn.record === 'moves' && !pn.date ? 'rednote' : 'bnote') + '">' + esc(pn.brokerText) + '</small>' : '') : '';
      var it = e.item, tt = calc.totals(it), lines = calc.activeLines(it), has = lines.length, bn = it.benefits || {}, bd = function (k) { return bn[k] ? '<small class="bdesc">' + esc(bn[k]) + '</small>' : ''; };
      var w = (lines.filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
      return '<tr' + (has ? ' data-act="pol" data-i="' + i + '"' : '') + '>' + tickCell('<b>' + esc((it.insurer || 'Policy') + (it.policyNo ? ' ' + it.policyNo : '')) + '</b><small>' + esc([it.product, it.doc ? 'DOC ' + it.doc : '', it.src && it.src.kind === 'astute' ? 'Astute' + (it.src.date ? ' ' + it.src.date : '') : ''].filter(Boolean).join('  |  ')) + '</small>' + pnote + vp(idxOf('policies', 'items', it)), !!it.wr) +
        td((has ? A(tt.life.lump) : A(null)) + bd('life'), '', 'life') + td((has ? A(tt.sev.lump) : A(null)) + bd('sev'), '', 'sev') + td((has ? A(tt.lsd.lump) : A(null)) + bd('lsd'), '', 'lsd') + td((has ? PM(tt.ip.monthly) : A(null)) + bd('ip'), '', 'ip') + td(esc(w || '-')) + td(AC(it), '', 'aci') + td(PC(it.abi), '', 'abi') + td(A(it.premium)) + '</tr>';
    }).join('');
    var tot = function (label, tt, prem, cls) { return '<tr class="' + cls + '"><td class="l">' + label + '</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + td(A(prem)) + '</tr>'; };
    if (pt.count.wr) rows += tot('Total: policies where we are the broker', pt.wr, pt.premium.wr, 'prem'); if (pt.count.other) rows += tot('Total: other brokers', pt.other, pt.premium.other, 'prem');
    rows += tot('Grand total (all policies)', pt.all, pt.premium.all, 'tot');
    return head(b, hb(false)) + tools('<span class="phint">Click a policy to see its lines</span>') +
      tbl([18, 13, 11, 13, 13, 7, 12, 5, 8], th('Policy', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi') + th('Premium'), rows, 'pols');
  }
  function groupView(b) {
    var s = state(), items = calc.groupItems(s), pi = calc.personalInvestments(s), gt = calc.groupTotals(s), prem = 0, age = s.header.disabilityAge, risk = items.filter(function (g) { return g.kind === 'risk'; });
    var red = risk.length ? '' : '<div class="pnone">' + ['No group life cover', 'No group disability or income protection', 'No group severe illness cover'].map(function (t) { return '<p><i>&#10005;</i>' + t + '</p>'; }).join('') + '</div>';
    if (!items.length && !pi.count) return head(b) + red;
    var cell = function (g, p) {
      var c = g[p]; if (!c || !calc.isNum(c.amount)) return td(c && c.amount === 'Not found' ? '<span class="na">Not found</span>' : '<span class="none">&ndash;</span>', '', p);
      return td((p === 'ip' ? PM(c.amount) : A(c.amount)) + (c.endAge != null && c.endAge !== '' ? '<small>' + esc(/^\d+$/.test(String(c.endAge)) ? 'To age ' + c.endAge : c.endAge) + '</small>' : ''), '', p);
    };
    var rows = items.map(function (g) {
      var p2 = g.kind === 'risk' ? g.monthlyCost : (calc.isNum(g.employer) || calc.isNum(g.employee) ? calc.r2((g.employer || 0) + (g.employee || 0)) : g.contribTotal); if (calc.isNum(p2)) prem = calc.r2(prem + p2);
      var label = (schema.GROUP_KINDS[g.kind] || g.kind) + '   ' + (g.provider || '');
      if (g.kind === 'risk') return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc([g.statementDate ? 'Statement ' + g.statementDate : '', g.paidBy ? 'paid by ' + g.paidBy : ''].filter(Boolean).join('  |  ')) + '</small>' + vp(idxOf('group', 'items', g)) + '</td>' + cell(g, 'life') + cell(g, 'sev') + cell(g, 'lsd') + cell(g, 'ip') + td(esc(g.ipWaiting || '-')) + td(PC(g.aci), '', 'aci') + td(PC(g.abi), '', 'abi') + td(A(p2)) + '</tr>';
      return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc((calc.isNum(g.value) ? 'Fund value ' + calc.fmtR(g.value) + '  |  ' : '') + (calc.isNum(g.employer) || calc.isNum(g.employee) ? 'employer ' + calc.fmtR(g.employer || 0) + ', employee ' + calc.fmtR(g.employee || 0) : 'POI needed')) + '</small>' + vp(idxOf('group', 'items', g)) + '</td>' +
        td('<span class="none">&ndash;</span>', '', 'life') + td('<span class="none">&ndash;</span>', '', 'sev') + td('<span class="none">&ndash;</span>', '', 'lsd') + td('<span class="none">&ndash;</span>', '', 'ip') + td('<span class="na">N/A</span>') + td(PC(g.aci), '', 'aci') + td('<span class="na">N/A</span>', '', 'abi') + td(A(p2)) + '</tr>';
    }).join('');
    prem = calc.r2(prem + pi.monthly);
    rows += '<tr><td class="l"><b>Personal investments</b><small>The total of the current investments</small></td>' + td(pi.count ? A(pi.gross) : A(null), '', 'life') + td('', '', 'sev') + td('', '', 'lsd') + td('', '', 'ip') + td('<span class="na">N/A</span>') + td('<span class="na">N/A</span>', '', 'aci') + td('<span class="na">N/A</span>', '', 'abi') + td(pi.count ? A(pi.monthly) : A(null)) + '</tr>';
    rows += '<tr class="tot"><td class="l">Total</td>' + td(A(calc.r2(gt.life + pi.gross)), '', 'life') + td(A(gt.sev), '', 'sev') + td(A(gt.lsd), '', 'lsd') + td(PM(gt.ip), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + td(A(prem)) + '</tr>';
    var ageH = ageText(age);
    return head(b, hb(false)) + red + tbl([25, 11, 10, 11, 12, 8, 6, 6, 11], th('Item', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi') + th('Total monthly premium'), rows);
  }
  function shortfallView(b) {
    var sf = calc.shortfall(state());
    if (!sf.has) return head(b) + empty('There is no FNA quote yet, so the shortfall cannot be worked out.');
    var rows = PILL_ROW.map(function (r) {
      var p = r[0], grp = sf.group[p] || 0, pi = p === 'life' ? sf.pi.gross : 0, cur = calc.r2(grp + pi);
      var sub = (grp ? '<small>Group benefits ' + calc.fmtR(grp) + '</small>' : '') + (pi ? '<small>Personal investments ' + calc.fmtR(pi) + '</small>' : '');
      return '<tr data-pil="' + p + '">' + td('<b>' + (p === 'ip' ? 'Income protector (R p.m.)' : r[1]) + '</b>', 'l') + td(A(sf.fna[p])) + td((cur ? A(cur) : '<span class="none">none</span>') + sub) + td(A(sf.short[p]), 'sf') + '</tr>';
    }).join('');
    return head(b, hb(false)) + tbl([28, 24, 24, 24], th('', '', 'l') + th('Need') + th('Current cover') + th('Shortfall'), rows) +
      note('The need is what the FNA says you need if you have nothing in place. Your current cover is what you already have through your group benefits and your personal investments (your retirement annuities and other investments count towards the life cover). The shortfall is the gap.');
  }
  function investmentsView(b) {
    var items = calc.investments(state()), pi = calc.personalInvestments(state());
    if (!items.length) return head(b) + empty('No current investments.');
    var rows = items.map(function (i) {
      var vs = i.valueSource || {}, src = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? '<small>' + esc(vs.date) + '</small>' : '') : '-';
      return '<tr>' + tickCell('<b>' + esc(i.provider || 'Investment') + '</b><small>' + esc(i.product || '') + '</small>' + vp(idxOf('investments', 'items', i)), !!i.wr) + td(esc(i.valueDate || '-'), 'c') + td(src, 'c') + td(A(i.gross)) + td(A(i.penalty)) + td(calc.isNum(i.gross) ? A(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : A(null)) + td(PC(i.returnRate)) + td(PC(i.aci)) + td(A(i.monthly)) + '</tr>';
    }).join('');
    rows += '<tr class="tot"><td class="l">Total investments</td><td></td><td></td>' + td(A(pi.gross)) + td(A(pi.penalty)) + td(A(pi.net)) + '<td></td><td></td>' + td(A(pi.monthly)) + '</tr>';
    return head(b) + tbl([21, 9, 14, 12, 10, 12, 8, 6, 8], th('Investment', '', 'l') + th('Values at') + th('Source') + th('Gross fund value') + th('Penalties') + th('Net fund value') + th('Rate of return') + th('ACI') + th('Premium'), rows);
  }
  function proposedView(b) {
    var items = calc.active(state().blocks.proposed.items);
    if (!items.length) return head(b) + empty('No proposed investments.');
    return head(b) + tbl([17, 20, 14, 11, 11, 7, 13, 7], th('Investment type', '', 'l') + th('Provider & quote', '', 'l') + th('Contribution', '', 'l') + th('Lump sum') + th('Monthly premium') + th('Boost') + th('Net amount invested') + th('ACI'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.type) + '</b>' + vp(idxOf('proposed', 'items', i)), 'l') + td(esc([i.provider, i.quote ? 'Quote ' + i.quote : ''].filter(Boolean).join('   ')), 'l') + td(esc(schema.contributionLabel[i.contribution] || ''), 'l') + td(A(i.lump)) + td(A(i.monthly)) + td(PC(i.boostPct)) + td(A(i.netInvested)) + td(PC(i.aci)) + '</tr>'; }).join(''));
  }
  function goalsView(b) {
    var items = calc.active(state().blocks.goals.items);
    if (!items.length) return head(b) + empty('No goal analysis reports.');
    return head(b) + tbl([27, 9, 21, 12, 12, 6, 13], th('Report', '', 'l') + th('Requested') + th('Note', '', 'l') + th('Current value (R p.m. gross)') + th('Future value (R p.m. gross)') + th('ACI') + th('Premium'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)') + '</b>' + vp(idxOf('goals', 'items', i)), 'l') + td(i.requested ? 'Yes' : 'No', 'c') + td(esc(i.note || ''), 'l') + td(A(i.currentValuePm)) + td(A(i.futureValuePm)) + td(PC(i.aci)) + td(A(i.premium)) + '</tr>'; }).join(''));
  }
  var OTHER_ICON = { medical: 'medical', gap: 'medical', will: 'will', legacy: 'policies', shortterm: 'home' }, OTHER_SAY = { medical: 'medical', will: 'will', shortterm: 'shortterm' };
  function otherView(b) {
    var cards = state().blocks.other.items.filter(function (i) { return !i.removed; }).filter(function (i) { return i.company || i.product || i.note || i.policyNo || calc.isNum(i.premium) || OTHER_SAY[i.key]; }).map(function (i, n) {
      var nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === i.key; })[0] || { l: i.key }).l, has = i.company || i.product || i.note, say = OTHER_SAY[i.key] ? P.sentenceFor(state(), OTHER_SAY[i.key]) : '', fromFF = i.st === 'ff' && !!say;
      var rows = [i.company || i.product ? '<p><span>Company</span>' + esc([i.company, i.product].filter(Boolean).join('   ')) + '</p>' : '', i.policyNo ? '<p><span>Policy number</span>' + esc(i.policyNo) + '</p>' : '',
        calc.isNum(i.premium) ? '<p><span>Premium</span>' + A(i.premium) + '</p>' : '', has ? '<p><span>Broker</span><b class="' + (i.wr ? 'yes' : 'no') + '">' + (i.wr ? '&#10003; Wealth Revolution' : '&#10005; Another broker') + '</b></p>' : '',
        i.note && !fromFF ? '<p><span>Notes</span>' + esc(i.note) + '</p>' : ''].join('');
      return '<div class="ocard" style="--i:' + n + '"><div class="oh"><span class="pico">' + ico(OTHER_ICON[i.key] || 'other') + '</span><b>' + esc(nm) + '</b></div>' + (i.key === 'legacy' ? vp(idxOf('other', 'items', i)) : '') + (say ? '<p class="osay">' + esc(say) + '</p>' : '') + (rows ? '<div class="orows">' + rows + '</div>' : '') + '</div>';
    }).join('');
    return head(b) + '<div class="ocards">' + cards + '</div>';
  }
  var VIEWS = { policies: policiesView, fna: quotesView, group: groupView, shortfall: shortfallView, shortfallQuote: quotesView, reduced: quotesView, comparative: quotesView, investments: investmentsView, proposed: proposedView, goals: goalsView, other: otherView };

  /* ---------- the Overview page: the client's name in a blue band, and one card for each area with ONE factual sentence (the wording table in js/ov-pres.js); no figures ---------- */
  function mapView() {
    var s = state(), cards = P.cover(s).map(function (c, n) {
      var inner = '<span class="pico">' + ico(c.icon) + '</span><span class="ct">' + esc(c.head) + '</span><span class="cs">' + esc(c.text) + '</span>', st = ' style="--i:' + n + '"';
      return c.opens ? '<button type="button" class="pcard bright" data-act="tab" data-tab="' + c.opens + '"' + st + '>' + inner + '</button>' : '<div class="pcard soft"' + st + '>' + inner + '</div>';
    }).join('');
    return '<div class="phero"><div class="hn"><div class="ov">CLIENT OVERVIEW</div><div class="nm">' + esc(schema.clientFull(s) || 'New client') + '</div></div><div class="dt">' + esc(s.header.overviewDate || schema.todayDMY()) + '</div></div>' +
      '<h2 class="pwelcome">' + esc(P.heading(s)) + '</h2><div class="pcards">' + cards + '</div>';
  }

  /* ---------- drawing ---------- */
  function slide() { return $('#pSlide'); }
  function render() {
    var sl = slide(), b = schema.blocksById[ps.tab], st = state();
    root.classList.toggle('onmap', ps.tab === 'map');
    sl.className = 'pslide' + (ps.tab === 'map' ? ' pmap' : ''); sl.innerHTML = '<div class="pin">' + (ps.tab === 'map' ? mapView() : VIEWS[ps.tab](b)) + '</div>';
    $('#pTabs').innerHTML = P.TABS.map(function (t) {
      var on = P.tabOn(st, t.id), cur = P.TAB_OF[ps.tab] === t.id || (t.id === 'map' && ps.tab === 'map');
      return '<button type="button" class="ptab' + (cur ? ' on' : '') + (on ? '' : ' off') + '"' + (on ? ' data-act="tab" data-tab="' + t.id + '"' : ' disabled title="Nothing to show here for this client."') + '>' + esc(t.l) + '</button>';
    }).join('');
    $('#pWho').innerHTML = '<b>' + esc(schema.clientFull(st) || 'New client') + '</b><small>Client Overview \u00b7 Presentation \u00b7 ' + esc(st.header.overviewDate || schema.todayDMY()) + '</small>';
    syncButtons(); paintHL(); paintPanel(); paintState(); if (OV.view) OV.view.paint(); fit();
  }
  /* The key-points column is there on a quote or a policy that has the pills, while the switch is on (the library, or the placeholder cards until it is found). */
  function panelOn() { var c = context(), sl = slide(); return ps.tab !== 'map' && ps.keys && !!(c && c.insurer) && !!(sl && sl.querySelector('.pbtn:not([hidden])')); }
  /* An amount never touches or runs into the next column (totals rows too): where a figure is wider than its cell, its type is made smaller (down to 10px) until it fits. Measured at the slide's own size, before it is scaled. */
  function fitAmounts(sl) {
    [].forEach.call(sl.querySelectorAll('.ptbl td'), function (cell) {
      var nums = [].slice.call(cell.querySelectorAll('.a:not(.aci)')); if (!nums.length) return;
      nums.forEach(function (n) { n.style.fontSize = ''; });
      var cs = getComputedStyle(cell), room = cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), fs = parseFloat(getComputedStyle(nums[0]).fontSize) || 17.5;
      var wide = function (n) {
        var w = Math.max(n.getBoundingClientRect().width, n.scrollWidth);
        if (n.classList.contains('pmv') && n.nextElementSibling) w = n.getBoundingClientRect().width + n.nextElementSibling.getBoundingClientRect().width + 4;          // "R25,000" and its "p.m." are one line
        return w > room + 0.5;
      };
      while (fs > 10 && nums.some(wide)) { fs -= 0.5; nums.forEach(function (n) { n.style.fontSize = fs + 'px'; }); }
    });
  }
  function fit() {
    var st = $('#pStage'), sl = slide(); if (!st || !sl) return;
    $('#pMain').classList.toggle('haspanel', panelOn());
    sl.style.transform = 'none'; fitAmounts(sl); var h = sl.offsetHeight, sw = st.clientWidth, sh = st.clientHeight, pad = ps.tab === 'map' ? 0 : 10, sc = Math.min(sw / SLIDE_W, (sh - pad) / h, 1.5);
    if (!(sc > 0) || !isFinite(sc)) sc = 1;
    sl.style.transform = 'translate(' + Math.round((sw - SLIDE_W * sc) / 2) + 'px,' + (ps.tab === 'map' ? Math.max(0, Math.round((sh - h * sc) / 2)) : 4) + 'px) scale(' + sc + ')';
  }
  /* A button is shown only where its column is on the page (the shortfall and the comparison have no ACI or ABI). */
  function syncButtons() {
    var sl = slide(); if (!sl) return;
    [].forEach.call(sl.querySelectorAll('.pbtn'), function (bt) { bt.hidden = !sl.querySelector('[data-pil="' + bt.getAttribute('data-p') + '"]'); });
  }
  function rowsOn() { var sl = slide(); return sl ? [].slice.call(sl.querySelectorAll('tr[data-keys]')).filter(function (r) { return ps.rows.some(function (k) { return ('|' + r.getAttribute('data-keys') + '|').indexOf('|' + k + '|') >= 0; }); }) : []; }
  function paintHL() {
    var sl = slide(); if (!sl) return;
    [].forEach.call(sl.querySelectorAll('[data-pil]'), function (el) { el.classList.toggle('hl', !!ps.pil && el.getAttribute('data-pil') === ps.pil); });
    var on = rowsOn();
    [].forEach.call(sl.querySelectorAll('tr[data-keys]'), function (r) { r.classList.toggle('on', on.indexOf(r) >= 0); });
    [].forEach.call(sl.querySelectorAll('.pbtn'), function (bt) { bt.classList.toggle('on', bt.getAttribute('data-p') === ps.pil); });
  }
  function context() {
    var b = schema.blocksById[ps.tab]; if (!b) return null;
    if (b.kind === 'quotes') { var q = currentQuote(b); return q ? { insurer: q.insurer, product: q.productName || '', quote: q } : null; }
    if (b.id === 'policies' && ps.pol != null) { var e = calc.policies(state())[ps.pol]; return e ? { insurer: e.item.insurer, product: e.item.product } : null; }
    return null;
  }
  /* The key points of what is highlighted, for this insurer, as small cards that slide in on the right one after another (Severe illness in two sections with blue banners; ACI is one card built from the quote).
     Until the checked library is found, BrightRock quotes show placeholder cards in the same layout. Nothing shows when no card fits; the switch (Key points: on / off) hides the whole column. */
  function paintPanel() {
    var pn = $('#pPanel'); if (!pn) return;
    var on = panelOn(), main = $('#pMain'), was = main.classList.contains('haspanel');
    main.classList.toggle('haspanel', on); pn.hidden = !on;
    if (on !== was) fit();
    if (!on) { pn.innerHTML = ''; return; }
    var ctx = context(), rows = rowsOn(), extra = [], labels = [];
    rows.forEach(function (r) { (r.getAttribute('data-ben') || '').split(',').filter(Boolean).forEach(function (k) { extra.push(k); }); if (r.getAttribute('data-label')) labels.push(r.getAttribute('data-label')); });
    var res = ps.pil || rows.length ? P.keyCards({ kp: kp, insurer: ctx.insurer, product: ctx.product, pil: ps.pil, extra: extra, quote: ctx.quote }) : { sections: [], total: 0 };
    if (!res.total) { pn.innerHTML = '<div class="khint">' + (ps.pil || rows.length ? 'No key points for this yet.' : 'Click a column heading or a line to see its key points here.') + '</div>'; return; }
    var pl = (BUTTONS.filter(function (p) { return p[0] === ps.pil; })[0] || [0, ''])[1], what = [labels[0], pl].filter(Boolean).join('  \u00b7  '), n = 0;
    pn.innerHTML = '<div class="kwrap"><div class="kwhat">' + esc(what) + '<small>' + esc(ctx.insurer) + '</small></div>' + res.sections.map(function (sec) {
      return (sec.label ? '<div class="ksec">' + esc(sec.label) + '</div>' : '') + sec.cards.map(function (c) { return '<div class="kcard' + (c.placeholder ? ' ph' : '') + '" style="--i:' + (n++) + '"><p>' + esc(c.text) + '</p><small>Source: ' + esc(c.source) + '</small></div>'; }).join('');
    }).join('') + '</div>';
    void pn.offsetWidth; [].forEach.call(pn.querySelectorAll('.kcard'), function (c) { c.classList.add('in'); });
    fitPanel();
  }
  /* The column never scrolls: a long list of cards is drawn a little smaller instead. */
  function fitPanel() {
    var pn = $('#pPanel'), w = pn && pn.querySelector('.kwrap'); if (!w) return;
    w.style.zoom = ''; var h = w.offsetHeight, avail = pn.clientHeight - 34, k = h > avail && avail > 0 ? Math.max(0.55, avail / h) : 1;
    if (k < 1) w.style.zoom = k;
  }
  /* The switch: Key points on / off. Off: the cards slide away, then the column closes and the page grows to fill the screen. */
  function setKeys(on) {
    on = !!on; if (on === ps.keys) return;
    ps.keys = on; [].forEach.call(document.querySelectorAll('#pres .pswitch'), function (b) { b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.querySelector('.st').textContent = 'Key points: ' + (on ? 'on' : 'off'); });
    if (on) { paintPanel(); return; }
    [].forEach.call(document.querySelectorAll('#pPanel .kcard'), function (c) { c.classList.remove('in'); c.classList.add('out'); });
    setTimeout(function () { if (!ps.keys) paintPanel(); }, 380);
  }
  function kpText() { return kpNote || (kp ? 'Key points ready \u00b7 ' + kp.points.length + (kp.tooLong || kp.noSource ? ' (' + ((kp.tooLong || 0) + (kp.noSource || 0)) + ' left out: too long or no source)' : '') : 'No key points file found \u00b7 placeholder cards shown'); }
  function paintState() { var el = $('#pKpState'); if (el) { el.textContent = kpText(); el.classList.toggle('none', !kp); } }

  /* ---------- the key-points library: found by the page itself, kept in this browser ---------- */
  function loadKeyPoints(text, name, from) {
    var r = P.parseKeyPoints(text);
    if (!r.ok) { kpNote = r.error; paintState(); return r; }
    kpNote = ''; saveKP({ file: name || P.KP_FILE, from: from || '', loaded: schema.todayDMY(), points: r.points, total: r.total, dropped: r.dropped, tooLong: r.tooLong, noSource: r.noSource });
    if (root) { paintPanel(); paintState(); } return r;
  }
  /* Looks for wr-keypoints.json at the top of a connected folder (New Business, then Client Files). Where the browser has to ask for a folder's permission (a click is behind it) is only when nothing is kept in this browser yet. */
  async function refreshKeyPoints(ask) {
    var got = null;
    try { got = FF.foldersUI && FF.foldersUI.rootFile ? await FF.foldersUI.rootFile(P.KP_FILE, !!ask) : null; } catch (e) { got = null; }
    if (got) loadKeyPoints(got.text, P.KP_FILE, got.from);
    else if (!kp && root) paintState();
    return !!got;
  }

  /* ---------- moving ---------- */
  function go(tab, qi, pol) {
    if (!schema.blocksById[tab] && tab !== 'map') return;
    if (tab !== 'map' && !P.blockOn(state(), tab)) return;                                         // a page with nothing to show cannot be opened (its tab is greyed)
    if (tab === ps.tab && qi === undefined && pol === undefined) return;
    var same = tab === ps.tab;
    ps.tab = tab; ps.qi = qi !== undefined ? qi : (same ? ps.qi : 0); ps.pol = pol !== undefined ? pol : (same ? ps.pol : null); ps.sub = 'quote'; ps.pil = null; ps.rows = [];
    render();
  }
  function setSub(sub) {
    var b = schema.blocksById[ps.tab]; if (!b || b.kind !== 'quotes') return false;
    var q = currentQuote(b); if (!q || (sub === 'cmp' && !q.cmp)) return false;
    ps.sub = sub; ps.pil = null; ps.rows = []; render(); return true;
  }
  function setPil(p, toggle) {
    var sl = slide(); if (!sl || !sl.querySelector('[data-pil="' + p + '"]')) return false;
    ps.pil = toggle && ps.pil === p ? null : p; paintHL(); paintPanel(); return true;
  }
  function setRows(keys, toggle) {
    ps.rows = toggle && ps.rows.length === keys.length && ps.rows[0] === keys[0] ? [] : keys;
    if (ps.rows.length && !rowsOn().length) { ps.rows = []; return false; }
    paintHL(); paintPanel(); return true;
  }
  function applyMoves(moves) {
    moves.forEach(function (m) {
      if (m.clear) { ps.pil = null; ps.rows = []; paintHL(); paintPanel(); }
      else if (m.step) { var ord = P.shownOrder(state()), i = ord.indexOf(ps.tab) + m.step; if (i >= 0 && i < ord.length) go(ord[i]); }
      else if (m.tab) go(m.tab, m.qi, m.pol);
      else if (m.sub) setSub(m.sub);
      else if (m.pil) setPil(m.pil, false);
      else if (m.line) setRows([m.line], false);
    });
  }

  /* ---------- the screen's chrome and the clicks ---------- */
  function build() {
    root = document.createElement('div'); root.className = 'pres'; root.id = 'pres'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Presentation');
    root.innerHTML = '<div class="pbar"><img class="plogo" src="assets/logo.png" alt="Wealth Revolution"><div class="pwho" id="pWho"></div><span class="sp"></span><span class="pkstate" id="pKpState"></span>' +
      '<button type="button" class="pb" id="pBtnFull" title="Fill the whole screen with the Presentation: the client sees no Chrome tabs, address bar or bookmarks">Full screen</button>' +
      '<button type="button" class="pb" id="pBtnClose" title="Back to the overview (Esc)">Close &#10005;</button></div><div class="ptabs" id="pTabs"></div>' +
      '<div class="pmain" id="pMain"><div class="pstage" id="pStage"><div class="pslide" id="pSlide"></div></div><aside class="ppanel" id="pPanel" hidden></aside></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (ev) {
      var vw = ev.target.closest('[data-vw]');                                                       // a View button: the document opens inside the page (a click on it never opens the row behind it)
      if (vw) { ev.preventDefault(); ev.stopPropagation(); if (OV.view) OV.view.open(vw.getAttribute('data-vw'), vw, 'pres'); return; }
      var tr = ev.target.closest('tr[data-keys]'), el = ev.target.closest('[data-act]'), hd = ev.target.closest('th[data-pil]'), act = el && el.getAttribute('data-act');
      if (ev.target.closest('#pBtnClose')) { close(); return; }
      if (ev.target.closest('#pBtnFull')) { toggleFs(); return; }
      if (!act && hd) { setPil(hd.getAttribute('data-pil'), true); return; }
      if (!act && !tr) return;
      if (act === 'tab') { var tb = P.firstBlock(state(), el.getAttribute('data-tab')); if (tb) go(tb); }
      else if (act === 'blk') go(el.getAttribute('data-b'));
      else if (act === 'keys') setKeys(!ps.keys);
      else if (act === 'q') { ps.qi = +el.getAttribute('data-i'); ps.sub = 'quote'; ps.pil = null; ps.rows = []; render(); }
      else if (act === 'sub') setSub(el.getAttribute('data-s'));
      else if (act === 'exw') { var xk = el.getAttribute('data-k'); ps.exShut[xk] = !ps.exShut[xk]; render(); }
      else if (act === 'pil') setPil(el.getAttribute('data-p'), true);
      else if (act === 'pol') go('policies', undefined, +el.getAttribute('data-i'));
      else if (act === 'polall') { ps.pol = null; ps.pil = null; ps.rows = []; render(); }
      else if (tr) { var keys = tr.getAttribute('data-keys').split('|'); setRows([keys[keys.length - 1]], true); }
    });
    window.addEventListener('resize', function () { if (open) fit(); });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (n) { document.addEventListener(n, onFs); });
    document.addEventListener('keydown', function (ev) {
      if (!open) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (fsEl()) exitFs();                                                                            // the first Esc leaves full screen (the browser usually does it before the page hears the key)
        else if (Date.now() - fsOff > 400) close();                                                      // the next one closes; an Esc that has just left full screen is not counted twice
      }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); applyMoves([{ step: ev.key === 'ArrowRight' ? 1 : -1 }]); }
    });
  }
  /* ---------- full screen (Paul presents in Microsoft Teams and does not want the client to see Chrome's tabs, address bar or bookmarks) ---------- */
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function canFs() { return !!(root && (root.requestFullscreen || root.webkitRequestFullscreen)); }
  function enterFs() {                                                                                  // must run inside the click that asked for it
    if (!canFs() || fsEl()) return Promise.resolve(false);
    try { var r = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen(); return Promise.resolve(r).then(function () { return true; }, function () { return false; }); } catch (e) { return Promise.resolve(false); }
  }
  function exitFs() {
    if (!fsEl()) return Promise.resolve(false);
    try { var r = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen(); return Promise.resolve(r).then(function () { return true; }, function () { return false; }); } catch (e) { return Promise.resolve(false); }
  }
  function toggleFs() { return fsEl() ? exitFs() : enterFs(); }
  function paintFs() {
    var b = $('#pBtnFull'); if (!b) return;
    var on = fsEl() === root;
    b.textContent = on ? 'Exit full screen' : 'Full screen'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Leave full screen (Esc)' : 'Fill the whole screen with the Presentation: the client sees no Chrome tabs, address bar or bookmarks';
    b.hidden = !canFs();
  }
  function onFs() { paintFs(); if (!fsEl()) fsOff = Date.now(); setTimeout(function () { if (open) fit(); }, 60); }
  function openPres(wantFull) {
    if (!root) { kp = loadKP(); build(); }
    if (open) return;
    open = true; prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; root.hidden = false;
    ps = { tab: 'map', qi: 0, sub: 'quote', pil: null, rows: [], pol: null, keys: true, exShut: {} };
    render(); setTimeout(fit, 30); paintFs();
    if (OV.view && OV.view.warm) OV.view.warm();                                                          // a click opened this: the client's files are listed (no question to Chrome) so a button that cannot open its file is not shown
    if (wantFull === true) enterFs();                                                                   // "Present full screen": this click is what lets the browser do it
    refreshKeyPoints(!kp);                                                                          // the click that opened this is what lets the browser ask, and only when nothing is kept yet
  }
  function close() {
    if (!open) return;
    exitFs(); open = false; root.hidden = true; document.body.style.overflow = prevOverflow;
  }
  var btn = $('#btnPresent'); if (btn) btn.addEventListener('click', function () { openPres(); });
  var btnFull = $('#btnPresentFull'); if (btnFull) btnFull.addEventListener('click', function () { openPres(true); });
  OV.present = { open: openPres, close: close, enterFullScreen: enterFs, exitFullScreen: exitFs, toggleFullScreen: toggleFs, get isFullScreen() { return !!fsEl() && fsEl() === root; }, get isOpen() { return open; }, get ps() { return ps; }, applyMoves: applyMoves, go: go, setKeys: setKeys, loadKeyPoints: loadKeyPoints, refreshKeyPoints: refreshKeyPoints, get keyPoints() { return kp; }, kpText: kpText, render: render };
})();
