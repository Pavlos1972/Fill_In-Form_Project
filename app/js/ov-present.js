/* The Client Overview Studio's Presentation, the screen: a full-screen, read-only view of exactly what the PDF sent to the client holds (the figures come from ov-calc.js, the same code), for the meeting.
   A main page with the client's name and a card for each block; tabs across the top; a quote has small tabs (The quote / Your change moment pay-out / Compared with what you have now).
   There is NO voice (Paul, 22 November: removed altogether): everything is done by clicking. A button (Life cover, Severe illness, Lump sum disability, Income protector, ACI, ABI) or a column heading highlights
   that column, a click on a line highlights that line; nothing else is dimmed. The key points Paul has approved for the insurer and for what is highlighted (at most three) slide in on the right by themselves:
   the library is private, it is found by the page itself (wr-keypoints.json at the top of a connected folder) and kept in this browser.
   It never scrolls (a page is drawn at one width and scaled to fit) and it never changes the overview. Nothing for Sitamah and Paul only is shown: no checks, no amber statuses, no income figure. */
(function () {
  var FF = window.FF, OV = window.OV, schema = OV.schema, calc = OV.calc, P = OV.pres;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var KP_KEY = 'wr-keypoints', SLIDE_W = 1240;
  var ps = { tab: 'map', qi: 0, sub: 'quote', pol: null, pil: null, rows: [] };
  var root = null, open = false, kp = null, kpNote = '', prevOverflow = '';

  function state() { return OV.app.state; }
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
    key: 'M12 3a6 6 0 00-3.5 10.9V17h7v-3.1A6 6 0 0012 3z M9.5 20h5'
  };
  function ico(id, cls) { return IC[id] ? '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[id] + '"/></svg>' : ''; }

  /* ---------- the little pieces of every table (the same words and figures as the PDF) ---------- */
  var NA = function (v) { return v === 'N/A' || v === 'Not found'; };
  function A(v, cls) { return calc.isNum(v) ? '<span class="a' + (cls ? ' ' + cls : '') + '">' + calc.fmtR(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function PM(v) { return calc.isNum(v) ? '<span class="a pmv">' + calc.fmtR(v) + '</span> <small class="pm">p.m.</small>' : A(v); }
  function AC(x) { var t = calc.fmtAci(x); return t ? '<span class="a aci">' + esc(t) + '</span>' : '<span class="none">&ndash;</span>'; }
  function PC(v) { return calc.isNum(v) ? '<span class="a">' + calc.fmtPct(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function td(inner, cls, pil, extra) { return '<td' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '"' : '') + (extra || '') + '>' + inner + '</td>'; }
  function th(text, pil, cls) {
    return '<th' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '" title="Click to highlight this column"' : '') + '>' + (pil && IC[pil] ? '<span class="hi">' + ico(pil) + '</span>' : '') + '<span class="ht">' + esc(text).replace(/\n/g, '<br>') + '</span></th>';
  }
  function tbl(widths, head, body, cls) {
    return '<div class="ptw"><table class="ptbl ' + (cls || '') + '"><colgroup>' + widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function head(b, right) { return '<div class="phead"><span class="pico">' + ico(b.id) + '</span><h2 class="ptitle">' + esc(b.title) + '</h2><span class="sp"></span>' + (right || '') + '</div>'; }
  function empty(text) { return '<p class="pempty">' + esc(text) + '</p>'; }
  function note(text) { return '<p class="pnote">' + esc(text) + '</p>'; }
  function ageText(age) { return age ? '\nAge ' + age : ''; }
  var PILL_ROW = [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector']];
  var BUTTONS = PILL_ROW.concat([['aci', 'ACI'], ['abi', 'ABI']]);
  function pillBtns() { return BUTTONS.map(function (p) { return '<button type="button" class="pbtn" data-act="pil" data-p="' + p[0] + '">' + ico(p[0]) + '<span>' + p[1] + '</span></button>'; }).join(''); }
  function hb() { return '<span class="pbtns2">' + pillBtns() + '</span>'; }
  function tools(left) { return left ? '<div class="ptools">' + left + '</div>' : ''; }

  /* ---------- the lines of a quote or a policy ---------- */
  function needCell(l) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, name = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? [l.debt, l.bank].filter(Boolean).join(' - ') : '';
    var cov = l.type === 'debt' ? (l.accelerated === true ? '<small class="cov">Accelerated</small>' : l.accelerated === false ? '<small class="cov">Standalone</small>' : '') : '';
    return td('<b>' + esc(l.type === 'other' ? (l.label || tp.l) : tp.l) + '</b>' + (name ? '<small>' + esc(name) + '</small>' : '') + cov, 'l');
  }
  function lineLabel(l) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, name = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? (l.debt || l.bank || '') : '';
    return (l.type === 'other' ? (l.label || tp.l) : tp.l) + (name ? ' · ' + name : '');
  }
  function pillCell(l, p, monthly) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, hasIP = l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0;
    if (l[p] === 'N/A') return td('<span class="na">N/A</span>', '', p);
    if (p === 'ip') return td(PM(calc.lineVal(l, 'ip', 'monthly')) + (hasIP ? '<small>Instalment Protector</small><small class="red">To be ceded to the bank</small>' : ''), '', 'ip');
    var L = calc.lineVal(l, p, 'lump'), M = monthly ? calc.lineVal(l, p, 'monthly') : undefined;
    if (!calc.isNum(L) && !calc.isNum(M) && L !== 'Not found') return td('<span class="none">&ndash;</span>', '', p);
    return td(A(L) + (monthly ? A(M, 'red') + '<small>' + esc(tp.monthly) + '</small>' : ''), '', p);
  }
  function lineRow(l, aci) {
    var isNA = function (k) { return l[k] === 'N/A'; };
    return '<tr data-keys="' + esc(P.lineKeys(l).join('|')) + '" data-ben="' + esc(P.lineBenefits(l).join(',')) + '" data-label="' + esc(lineLabel(l)) + '">' + needCell(l) + td(esc(l.term || ''), 'l') + pillCell(l, 'life', true) + pillCell(l, 'sev', false) + pillCell(l, 'lsd', true) + pillCell(l, 'ip', true) +
      td(isNA('waiting') ? '<span class="na">N/A</span>' : esc(l.waiting || '-')) + td(aci ? AC(aci) : '<span class="none">&ndash;</span>', '', 'aci') + td(PC(l.abi), '', 'abi') + '</tr>';
  }
  var LINE_W = [15, 8, 13, 9, 13, 15, 7, 12, 8];
  function linesHead(age) {
    return th('Need', '', 'l') + th('Term', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageText(age), 'lsd') + th('Income protector / sickness benefit' + ageText(age), 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi');
  }
  function linesTable(c, isPolicy, age) {
    var lines = calc.activeLines(c), body = lines.map(function (l) { return lineRow(l, isPolicy ? null : c); }).join('');
    if (!isPolicy) {
      var tt = calc.totals(c);
      body += '<tr class="tot" data-keys="total-lump"><td class="l" colspan="2">Total lump sum</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td('', '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + '</tr>' +
        '<tr class="tot" data-keys="total-ip"><td class="l" colspan="2">Total income protected</td>' + td(PM(tt.life.monthly), '', 'life') + td('<span class="na">N/A</span>', '', 'sev') + td(PM(tt.lsd.monthly), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + '</tr>' +
        '<tr class="prem" data-keys="total-premium"><td class="l" colspan="2">Monthly premium</td><td colspan="2">' + A(c.premium) + '</td><td class="l" colspan="5">' + esc(c.rates || '') + '</td></tr>';
    }
    return tbl(LINE_W, linesHead(age), body, 'lines');
  }

  /* ---------- a quote: its tabs ---------- */
  var KIND = { fna: 'FNA', shortfall: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote' };
  function quoteHead(q, right) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return '<div class="qhead"><span class="badge ' + esc(q.status || 'pending') + '">' + esc(schema.statusLabel[q.status] || '') + '</span><span class="qinfo">' + esc([q.insurer, KIND[q.kind], n, q.date, q.rates, q.servicing ? 'Servicing quote' : ''].filter(Boolean).join('   |   ')) + '</span>' + (right || '') + '</div>';
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
    var cur = Math.min(ps.qi, qs.length - 1), q = qs[cur], hasCmp = !!q.cmp, sub = ps.sub === 'cmp' && !hasCmp ? 'quote' : ps.sub;
    var chips = qs.length > 1 ? '<span class="sp"></span><span class="pchips">' + qs.map(function (x, i) { return '<button type="button" class="pchip' + (i === cur ? ' on' : '') + '" data-act="q" data-i="' + i + '">' + esc((x.insurer || 'Quote') + (x.number ? ' ' + x.number : '')) + '</button>'; }).join('') + '</span>' : '';
    var subs = [['quote', 'The quote']].concat(hasCmp ? [['cmp', 'Your change moment pay-out']] : [], [['cmpr', 'Compared with what you have now']]);
    var out = head(b, sub !== 'cmp' ? hb() : '') + quoteHead(q, chips);
    out += tools('<span class="psubs">' + subs.map(function (s) { return '<button type="button" class="psub' + (s[0] === sub ? ' on' : '') + '" data-act="sub" data-s="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</span>');
    if (sub === 'cmp') return out + cmpView(q);
    if (sub === 'cmpr') return out + compareView(q);
    out += linesTable(q, false, q.disabilityAge || state().header.disabilityAge);
    if (calc.activeLines(q).some(function (l) { return l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; })) out += note('Instalment Protector: if you are retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.');
    return out;
  }

  /* ---------- the other blocks ---------- */
  function tickCell(inner, yes) { return '<td class="l tick"><i class="' + (yes ? 'yes' : 'no') + '">' + (yes ? '&#10003;' : '&#10005;') + '</i>' + inner + '</td>'; }
  function policiesView(b) {
    var s = state(), ps0 = calc.policies(s), pt = calc.policyTotals(s), age = s.header.disabilityAge;
    if (!ps0.length) return head(b) + empty('No current policies.');
    var one = ps.pol != null ? ps0[ps.pol] : null;
    if (one) {
      var it = one.item;
      return head(b, hb()) + '<div class="qhead"><button type="button" class="pchip back" data-act="polall">&larr; All policies</button><span class="qinfo">' + esc([it.insurer || 'Policy', it.policyNo, it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join('   |   ')) + '</span></div>' + linesTable(it, true, it.ipAge || age) + (it.cmp ? '<div class="qhead"><span class="qinfo">Your change moment pay-out</span></div>' + cmpView(it) : '');
    }
    var ageH = ageText(age), rows = ps0.map(function (e, i) {
      var it = e.item, tt = calc.totals(it), lines = calc.activeLines(it), has = lines.length, bn = it.benefits || {}, notes = [bn.life, bn.lsd, bn.ip].filter(Boolean).join(' / ');
      var w = (lines.filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
      return '<tr' + (has ? ' data-act="pol" data-i="' + i + '"' : '') + '>' + tickCell('<b>' + esc((it.insurer || 'Policy') + (it.policyNo ? '   ' + it.policyNo : '')) + '</b><small>' + esc([it.product, it.doc ? 'DOC ' + it.doc : '', notes].filter(Boolean).join('  |  ')) + '</small>', !!it.wr) +
        td(has ? A(tt.life.lump) : A(null), '', 'life') + td(has ? A(tt.sev.lump) : A(null), '', 'sev') + td(has ? A(tt.lsd.lump) : A(null), '', 'lsd') + td(has ? PM(tt.ip.monthly) : A(null), '', 'ip') + td(esc(w || '-')) + td(AC(it), '', 'aci') + td(PC(it.abi), '', 'abi') + td(A(it.premium)) + '</tr>';
    }).join('');
    var tot = function (label, tt, prem, cls) { return '<tr class="' + cls + '"><td class="l">' + label + '</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + td(A(prem)) + '</tr>'; };
    if (pt.count.wr) rows += tot('Total: policies where we are the broker', pt.wr, pt.premium.wr, 'prem'); if (pt.count.other) rows += tot('Total: other brokers', pt.other, pt.premium.other, 'prem');
    rows += tot('Grand total (all policies)', pt.all, pt.premium.all, 'tot');
    return head(b, hb()) + tools('<span class="phint">Click a policy to see its lines</span>') +
      tbl([25, 10, 9, 10, 11, 8, 12, 6, 9], th('Policy', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi') + th('Premium'), rows);
  }
  function groupView(b) {
    var s = state(), items = calc.groupItems(s), pi = calc.personalInvestments(s), gt = calc.groupTotals(s), prem = 0, age = s.header.disabilityAge;
    if (!items.length && !pi.count) return head(b) + empty('No group benefits or personal investments.');
    var cell = function (g, p) {
      var c = g[p]; if (!c || !calc.isNum(c.amount)) return td(c && c.amount === 'Not found' ? '<span class="na">Not found</span>' : '<span class="none">&ndash;</span>', '', p);
      return td((p === 'ip' ? PM(c.amount) : A(c.amount)) + (c.endAge != null && c.endAge !== '' ? '<small>' + esc(/^\d+$/.test(String(c.endAge)) ? 'To age ' + c.endAge : c.endAge) + '</small>' : ''), '', p);
    };
    var rows = items.map(function (g) {
      var p2 = g.kind === 'risk' ? g.monthlyCost : (calc.isNum(g.employer) || calc.isNum(g.employee) ? calc.r2((g.employer || 0) + (g.employee || 0)) : g.contribTotal); if (calc.isNum(p2)) prem = calc.r2(prem + p2);
      var label = (schema.GROUP_KINDS[g.kind] || g.kind) + '   ' + (g.provider || '');
      if (g.kind === 'risk') return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc([g.statementDate ? 'Statement ' + g.statementDate : '', g.paidBy ? 'paid by ' + g.paidBy : ''].filter(Boolean).join('  |  ')) + '</small></td>' + cell(g, 'life') + cell(g, 'sev') + cell(g, 'lsd') + cell(g, 'ip') + td(esc(g.ipWaiting || '-')) + td(PC(g.aci), '', 'aci') + td(PC(g.abi), '', 'abi') + td(A(p2)) + '</tr>';
      return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc((calc.isNum(g.value) ? 'Fund value ' + calc.fmtR(g.value) + '  |  ' : '') + (calc.isNum(g.employer) || calc.isNum(g.employee) ? 'employer ' + calc.fmtR(g.employer || 0) + ', employee ' + calc.fmtR(g.employee || 0) : 'POI needed')) + '</small></td>' +
        td('<span class="none">&ndash;</span>', '', 'life') + td('<span class="none">&ndash;</span>', '', 'sev') + td('<span class="none">&ndash;</span>', '', 'lsd') + td('<span class="none">&ndash;</span>', '', 'ip') + td('<span class="na">N/A</span>') + td(PC(g.aci), '', 'aci') + td('<span class="na">N/A</span>', '', 'abi') + td(A(p2)) + '</tr>';
    }).join('');
    prem = calc.r2(prem + pi.monthly);
    rows += '<tr><td class="l"><b>Personal investments</b><small>The total of the current investments</small></td>' + td(pi.count ? A(pi.gross) : A(null), '', 'life') + td('', '', 'sev') + td('', '', 'lsd') + td('', '', 'ip') + td('<span class="na">N/A</span>') + td('<span class="na">N/A</span>', '', 'aci') + td('<span class="na">N/A</span>', '', 'abi') + td(pi.count ? A(pi.monthly) : A(null)) + '</tr>';
    rows += '<tr class="tot"><td class="l">Total</td>' + td(A(calc.r2(gt.life + pi.gross)), '', 'life') + td(A(gt.sev), '', 'sev') + td(A(gt.lsd), '', 'lsd') + td(PM(gt.ip), '', 'ip') + '<td></td>' + td('', '', 'aci') + td('', '', 'abi') + td(A(prem)) + '</tr>';
    var ageH = ageText(age);
    return head(b, hb()) + tbl([25, 11, 10, 11, 12, 8, 6, 6, 11], th('Item', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI', 'aci') + th('ABI', 'abi') + th('Total monthly premium'), rows);
  }
  function shortfallView(b) {
    var sf = calc.shortfall(state());
    if (!sf.has) return head(b) + empty('There is no FNA quote yet, so the shortfall cannot be worked out.');
    var rows = PILL_ROW.map(function (r) {
      var p = r[0], pi = p === 'life' ? sf.pi.gross : 0;
      return '<tr data-pil="' + p + '">' + td('<b>' + (p === 'ip' ? 'Income protector (R p.m.)' : r[1]) + '</b>', 'l') + td(A(sf.fna[p])) + td(sf.group[p] ? A(sf.group[p]) : '<span class="none">none</span>') + td(pi ? A(pi) : '<span class="none">none</span>') + td(A(sf.short[p]), 'tot') + '</tr>';
    }).join('');
    return head(b, hb()) + tbl([25, 19, 19, 19, 18], th('', '', 'l') + th('FNA') + th('Less group benefits') + th('Less personal investments') + th('Shortfall'), rows) +
      note('The FNA assumes you have nothing in place. The shortfall takes off what you already have through your group benefits and your personal investments (your retirement annuities and other investments count towards the life cover shortfall).');
  }
  function investmentsView(b) {
    var items = calc.investments(state()), pi = calc.personalInvestments(state());
    if (!items.length) return head(b) + empty('No current investments.');
    var rows = items.map(function (i) {
      var vs = i.valueSource || {}, src = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? '<small>' + esc(vs.date) + '</small>' : '') : '-';
      return '<tr>' + tickCell('<b>' + esc(i.provider || 'Investment') + '</b><small>' + esc(i.product || '') + '</small>', !!i.wr) + td(esc(i.valueDate || '-'), 'c') + td(src, 'c') + td(A(i.gross)) + td(A(i.penalty)) + td(calc.isNum(i.gross) ? A(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : A(null)) + td(PC(i.returnRate)) + td(PC(i.aci)) + td(A(i.monthly)) + '</tr>';
    }).join('');
    rows += '<tr class="tot"><td class="l">Total investments</td><td></td><td></td>' + td(A(pi.gross)) + td(A(pi.penalty)) + td(A(pi.net)) + '<td></td><td></td>' + td(A(pi.monthly)) + '</tr>';
    return head(b) + tbl([21, 9, 14, 12, 10, 12, 8, 6, 8], th('Investment', '', 'l') + th('Values at') + th('Source') + th('Gross fund value') + th('Penalties') + th('Net fund value') + th('Rate of return') + th('ACI') + th('Premium'), rows);
  }
  function proposedView(b) {
    var items = calc.active(state().blocks.proposed.items);
    if (!items.length) return head(b) + empty('No proposed investments.');
    return head(b) + tbl([17, 20, 14, 11, 11, 7, 13, 7], th('Investment type', '', 'l') + th('Provider & quote', '', 'l') + th('Contribution', '', 'l') + th('Lump sum') + th('Monthly premium') + th('Boost') + th('Net amount invested') + th('ACI'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.type) + '</b>', 'l') + td(esc([i.provider, i.quote ? 'Quote ' + i.quote : ''].filter(Boolean).join('   ')), 'l') + td(esc(schema.contributionLabel[i.contribution] || ''), 'l') + td(A(i.lump)) + td(A(i.monthly)) + td(PC(i.boostPct)) + td(A(i.netInvested)) + td(PC(i.aci)) + '</tr>'; }).join(''));
  }
  function goalsView(b) {
    var items = calc.active(state().blocks.goals.items);
    if (!items.length) return head(b) + empty('No goal analysis reports.');
    return head(b) + tbl([27, 9, 21, 12, 12, 6, 13], th('Report', '', 'l') + th('Requested') + th('Note', '', 'l') + th('Current value (R p.m. gross)') + th('Future value (R p.m. gross)') + th('ACI') + th('Premium'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)') + '</b>', 'l') + td(i.requested ? 'Yes' : 'No', 'c') + td(esc(i.note || ''), 'l') + td(A(i.currentValuePm)) + td(A(i.futureValuePm)) + td(PC(i.aci)) + td(A(i.premium)) + '</tr>'; }).join(''));
  }
  function otherView(b) {
    return head(b) + tbl([17, 24, 14, 8, 11, 26], th('Item', '', 'l') + th('Company & product', '', 'l') + th('Policy number', '', 'l') + th('Broker') + th('Premium') + th('Notes', '', 'l'),
      state().blocks.other.items.filter(function (i) { return !i.removed; }).map(function (i) {
        var nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === i.key; })[0] || { l: i.key }).l, has = i.company || i.product || i.note;
        return '<tr>' + td('<b>' + esc(nm) + '</b>', 'l') + td(esc([i.company, i.product].filter(Boolean).join('   ') || '-'), 'l') + td(esc(i.policyNo || '-'), 'l') + td(has ? '<b class="' + (i.wr ? 'yes' : 'no') + '">' + (i.wr ? '&#10003;' : '&#10005;') + '</b>' : '-', 'c') + td(A(i.premium)) + td(esc(i.note || ''), 'l') + '</tr>';
      }).join(''));
  }
  var VIEWS = { policies: policiesView, fna: quotesView, group: groupView, shortfall: shortfallView, shortfallQuote: quotesView, reduced: quotesView, comparative: quotesView, investments: investmentsView, proposed: proposedView, goals: goalsView, other: otherView };

  /* ---------- the main page: the client's name, and a card for each page that exists ---------- */
  function mapView() {
    var s = state(), f = P.mapFigures(s), cards = schema.BLOCKS.filter(function (b) { return calc.pageShown(s, b.id); }).map(function (b) {
      var sp = P.splitFigure(f[b.id]), none = /^(None|Waiting|Not needed)/.test(f[b.id] || '');
      return '<button type="button" class="pcard' + (none ? ' empty' : '') + '" data-act="tab" data-tab="' + b.id + '"><span class="pico">' + ico(b.id) + '</span><span class="ct">' + esc(b.title) + '</span><span class="cf">' + esc(sp.fig) + '</span><span class="cc">' + esc(sp.cap) + '</span></button>';
    }).join('');
    return '<div class="phero"><div class="hn"><div class="nm">' + esc(schema.clientFull(s) || 'New client') + '</div><div class="ov">CLIENT OVERVIEW</div></div><div class="dt">' + esc(s.header.overviewDate || schema.todayDMY()) + '</div></div><div class="pcards">' + cards + '</div>';
  }

  /* ---------- drawing ---------- */
  function slide() { return $('#pSlide'); }
  function render() {
    var sl = slide(), b = schema.blocksById[ps.tab], ord = P.shownOrder(state());
    root.classList.toggle('onmap', ps.tab === 'map');
    sl.className = 'pslide' + (ps.tab === 'map' ? ' pmap' : ''); sl.innerHTML = '<div class="pin">' + (ps.tab === 'map' ? mapView() : VIEWS[ps.tab](b)) + '</div>';
    $('#pTabs').innerHTML = ord.map(function (id) { return '<button type="button" class="ptab' + (id === ps.tab ? ' on' : '') + '" data-act="tab" data-tab="' + id + '">' + esc(P.TABS[P.ORDER.indexOf(id)]) + '</button>'; }).join('');
    $('#pWho').textContent = (schema.clientFull(state()) || 'New client') + ' · Client Overview';
    syncButtons(); paintHL(); paintPanel(); paintState(); fit();
  }
  function panelOn() { var c = context(); return ps.tab !== 'map' && !!(kp && c && c.insurer); }
  function fit() {
    var st = $('#pStage'), sl = slide(); if (!st || !sl) return;
    $('#pMain').classList.toggle('haspanel', panelOn());
    sl.style.transform = 'none'; var h = sl.offsetHeight, sw = st.clientWidth, sh = st.clientHeight, pad = ps.tab === 'map' ? 0 : 10, sc = Math.min(sw / SLIDE_W, (sh - pad) / h, 1.5);
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
    if (b.kind === 'quotes') { var q = currentQuote(b); return q ? { insurer: q.insurer, product: q.productName || '' } : null; }
    if (b.id === 'policies' && ps.pol != null) { var e = calc.policies(state())[ps.pol]; return e ? { insurer: e.item.insurer, product: e.item.product } : null; }
    return null;
  }
  /* The key points of what is highlighted: at most three, for this insurer, in a slim card that slides in on the right. Nothing shows when nothing is highlighted or no approved point fits. */
  function paintPanel() {
    var pn = $('#pPanel'); if (!pn) return;
    var on = panelOn(), main = $('#pMain'), was = main.classList.contains('haspanel');
    main.classList.toggle('haspanel', on); pn.hidden = !on;
    if (on !== was) fit();
    if (!on) { pn.innerHTML = ''; return; }
    var ctx = context(), rows = rowsOn(), extra = [], labels = [];
    rows.forEach(function (r) { (r.getAttribute('data-ben') || '').split(',').filter(Boolean).forEach(function (k) { extra.push(k); }); if (r.getAttribute('data-label')) labels.push(r.getAttribute('data-label')); });
    var pts = ps.pil || rows.length ? P.pointsFor(kp.points, ctx.insurer, P.benefitsFor(ps.pil, extra), ctx.product) : [];
    if (!pts.length) { pn.innerHTML = ''; return; }
    var pl = (BUTTONS.filter(function (p) { return p[0] === ps.pil; })[0] || [0, ''])[1], what = [labels[0], pl].filter(Boolean).join('  ·  ');
    pn.innerHTML = '<div class="kcard"><div class="khead"><span class="kico">' + ico('key') + '</span><span class="kfor">' + esc(ctx.insurer) + '</span></div><div class="kwhat">' + esc(what) + '</div><ul>' + pts.map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + '</ul></div>';
    var card = pn.firstChild; void card.offsetWidth; card.classList.add('in');
  }
  function kpText() { return kpNote || (!kp ? 'No key points loaded' : 'Key points ready · ' + kp.points.length + (kp.tooLong ? ' (' + kp.tooLong + ' too long, left out)' : '')); }
  function paintState() { var el = $('#pKpState'); if (el) { el.textContent = kpText(); el.classList.toggle('none', !kp); } }

  /* ---------- the key-points library: found by the page itself, kept in this browser ---------- */
  function loadKeyPoints(text, name, from) {
    var r = P.parseKeyPoints(text);
    if (!r.ok) { kpNote = r.error; paintState(); return r; }
    kpNote = ''; saveKP({ file: name || P.KP_FILE, from: from || '', loaded: schema.todayDMY(), points: r.points, total: r.total, dropped: r.dropped, tooLong: r.tooLong });
    if (root) { paintPanel(); paintState(); } return r;
  }
  /* Looks for wr-keypoints.json at the top of a connected folder (New Business, then Client Files). Where the browser has to ask for a folder's permission (a click is behind it) is only when nothing is kept in this browser yet. */
  async function refreshKeyPoints(ask) {
    var got = null;
    try { got = FF.foldersUI && FF.foldersUI.rootFile ? await FF.foldersUI.rootFile(P.KP_FILE, !!ask) : null; } catch (e) { got = null; }
    if (got) loadKeyPoints(got.text, P.KP_FILE, got.from);
    else if (!kp) { kpNote = 'No key points file found'; if (root) paintState(); }
    return !!got;
  }

  /* ---------- moving ---------- */
  function go(tab, qi, pol) {
    if (!schema.blocksById[tab] && tab !== 'map') return;
    if (tab !== 'map' && !calc.pageShown(state(), tab)) return;                                    // a page that is left out cannot be opened
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
      '<button type="button" class="pb" id="pBtnClose" title="Back to the overview (Esc)">Close &#10005;</button></div><div class="ptabs" id="pTabs"></div>' +
      '<div class="pmain" id="pMain"><div class="pstage" id="pStage"><div class="pslide" id="pSlide"></div></div><aside class="ppanel" id="pPanel" hidden></aside></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr[data-keys]'), el = ev.target.closest('[data-act]'), hd = ev.target.closest('th[data-pil]'), act = el && el.getAttribute('data-act');
      if (ev.target.closest('#pBtnClose')) { close(); return; }
      if (!act && hd) { setPil(hd.getAttribute('data-pil'), true); return; }
      if (!act && !tr) return;
      if (act === 'tab') go(el.getAttribute('data-tab'));
      else if (act === 'q') { ps.qi = +el.getAttribute('data-i'); ps.sub = 'quote'; ps.pil = null; ps.rows = []; render(); }
      else if (act === 'sub') setSub(el.getAttribute('data-s'));
      else if (act === 'pil') setPil(el.getAttribute('data-p'), true);
      else if (act === 'pol') go('policies', undefined, +el.getAttribute('data-i'));
      else if (act === 'polall') { ps.pol = null; ps.pil = null; ps.rows = []; render(); }
      else if (tr) { var keys = tr.getAttribute('data-keys').split('|'); setRows([keys[keys.length - 1]], true); }
    });
    window.addEventListener('resize', function () { if (open) fit(); });
    document.addEventListener('keydown', function (ev) {
      if (!open) return;
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); applyMoves([{ step: ev.key === 'ArrowRight' ? 1 : -1 }]); }
    });
  }
  function openPres() {
    if (!root) { kp = loadKP(); build(); }
    if (open) return;
    open = true; prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; root.hidden = false;
    ps = { tab: 'map', qi: 0, sub: 'quote', pil: null, rows: [], pol: null };
    render(); setTimeout(fit, 30);
    refreshKeyPoints(!kp);                                                                          // the click that opened this is what lets the browser ask, and only when nothing is kept yet
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true; document.body.style.overflow = prevOverflow;
  }
  var btn = $('#btnPresent'); if (btn) btn.addEventListener('click', openPres);
  OV.present = { open: openPres, close: close, get isOpen() { return open; }, get ps() { return ps; }, applyMoves: applyMoves, go: go, loadKeyPoints: loadKeyPoints, refreshKeyPoints: refreshKeyPoints, get keyPoints() { return kp; }, kpText: kpText, render: render };
})();
