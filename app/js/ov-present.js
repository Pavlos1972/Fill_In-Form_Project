/* The Client Overview's Presentation, the screen (stage 5): a full-screen, read-only view of exactly what the PDF sent to the client holds (the figures come from ov-calc.js, the same code), for the meeting.
   A map with the client's name in the middle and the eleven blocks around it; tabs across the top; a quote has small tabs (The quote / Your change moment pay-out / Compared with what you have now);
   a benefit button highlights its column, a click on a line highlights it; the key points Paul has approved for the insurer and benefit show in a small panel on the right (library kept in this browser: it is private).
   It never scrolls (the page is drawn at one width and scaled to fit) and it never changes the overview. The voice part follows only Paul's microphone and only a fixed list of commands (js/ov-pres.js).
   Nothing for Sitamah and Paul only is shown: no checks, no amber statuses, no income figure. Clicking always works and pauses the voice for a while. */
(function () {
  var FF = window.FF, OV = window.OV, schema = OV.schema, calc = OV.calc, P = OV.pres;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var KP_KEY = 'wr-keypoints', SPEECH_KEY = 'wr-fact-find-speech-2', SLIDE_W = 1240;
  var ps = { tab: 'map', qi: 0, sub: 'quote', pol: null, pil: null, rows: [] };
  var root = null, open = false, lsn = null, lsnState = 'off', lastLabel = '', hint = '', hintT = null, tick = null, kp = null, prevOverflow = '';

  function state() { return OV.app.state; }
  function loadKP() { try { var j = JSON.parse(localStorage.getItem(KP_KEY) || 'null'); return j && Array.isArray(j.points) ? j : null; } catch (e) { return null; } }
  function saveKP(o) { try { if (o) localStorage.setItem(KP_KEY, JSON.stringify(o)); else localStorage.removeItem(KP_KEY); } catch (e) { /* kept for this visit only */ } kp = o; }

  /* ---------- the little pieces of every table (the same words and figures as the PDF) ---------- */
  var NA = function (v) { return v === 'N/A' || v === 'Not found'; };
  function A(v, cls) { return calc.isNum(v) ? '<span class="a' + (cls ? ' ' + cls : '') + '">' + calc.fmtR(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function PM(v) { return calc.isNum(v) ? '<span class="a pmv">' + calc.fmtR(v) + '</span> <small class="pm">p.m.</small>' : A(v); }
  function PC(v) { return calc.isNum(v) ? '<span class="a">' + calc.fmtPct(v) + '</span>' : NA(v) ? '<span class="na">' + v + '</span>' : '<span class="none">&ndash;</span>'; }
  function td(inner, cls, pil, extra) { return '<td' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '"' : '') + (extra || '') + '>' + inner + '</td>'; }
  function th(text, pil, cls) { return '<th' + (cls ? ' class="' + cls + '"' : '') + (pil ? ' data-pil="' + pil + '"' : '') + '>' + esc(text).replace(/\n/g, '<br>') + '</th>'; }
  function tbl(widths, head, body, cls) {
    return '<table class="ptbl ' + (cls || '') + '"><colgroup>' + widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  function title(b) { return '<h2 class="ptitle">' + b.n + '. ' + esc(b.title) + '</h2>'; }
  function empty(text) { return '<p class="pempty">' + esc(text) + '</p>'; }
  function note(text) { return '<p class="pnote">' + esc(text) + '</p>'; }
  function ageText(age) { return age ? '\nAge ' + age : ''; }
  var PILL_ROW = [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector']];
  function pillBtns() { return '<span class="lbl">Highlight</span>' + PILL_ROW.map(function (p) { return '<button type="button" class="pbtn" data-act="pil" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join(''); }

  /* ---------- the lines of a quote or a policy ---------- */
  function needCell(l) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, name = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? [l.debt, l.bank].filter(Boolean).join(' - ') : '';
    return td('<b>' + esc(l.type === 'other' ? (l.label || tp.l) : tp.l) + '</b>' + (name ? '<small>' + esc(name) + '</small>' : ''), 'l');
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
    return '<tr data-keys="' + esc(P.lineKeys(l).join('|')) + '">' + needCell(l) + td(esc(l.term || ''), 'l') + pillCell(l, 'life', true) + pillCell(l, 'sev', false) + pillCell(l, 'lsd', true) + pillCell(l, 'ip', true) +
      td(isNA('waiting') ? '<span class="na">N/A</span>' : esc(l.waiting || '-')) + td(PC(aci)) + td(PC(l.abi)) + '</tr>';
  }
  var LINE_W = [19, 10, 11, 10, 11, 14, 9, 8, 8];
  function linesHead(age) {
    return th('Need', '', 'l') + th('Term', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageText(age), 'lsd') + th('Income protector / sickness benefit' + ageText(age), 'ip') + th('Waiting period') + th('ACI') + th('ABI');
  }
  function linesTable(c, isPolicy, age) {
    var lines = calc.activeLines(c), body = lines.map(function (l) { return lineRow(l, isPolicy ? null : c.aci); }).join('');
    if (!isPolicy) {
      var tt = calc.totals(c);
      body += '<tr class="tot" data-keys="total-lump"><td class="l" colspan="2">Total lump sum</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td('', '', 'ip') + '<td colspan="3"></td></tr>' +
        '<tr class="tot" data-keys="total-ip"><td class="l" colspan="2">Total income protected</td>' + td(PM(tt.life.monthly), '', 'life') + td('<span class="na">N/A</span>', '', 'sev') + td(PM(tt.lsd.monthly), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td colspan="3"></td></tr>' +
        '<tr class="prem" data-keys="total-premium"><td class="l" colspan="2">Monthly premium</td><td colspan="2">' + A(c.premium) + '</td><td class="l" colspan="5">' + esc(c.rates || '') + '</td></tr>';
    }
    return tbl(LINE_W, linesHead(age), body, 'lines');
  }

  /* ---------- a quote: its tabs ---------- */
  var KIND = { fna: 'FNA', shortfall: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote' };
  function quoteHead(q) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return '<div class="qhead"><span class="badge ' + esc(q.status || 'pending') + '">' + esc(schema.statusLabel[q.status] || '') + '</span><span>' + esc([q.insurer, KIND[q.kind], n, q.date, q.rates, q.servicing ? 'Servicing quote' : ''].filter(Boolean).join('   |   ')) + '</span></div>';
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
      var f = function (v, pm) { return td(d ? '<span class="a">' + calc.fmtDiff(v) + '</span>' : (pm ? PM(v) : A(v))); };
      return '<tr' + (d ? ' class="diff"' : '') + '>' + td('<b>' + label + '</b>', 'l') + f(r.life) + f(r.sev) + f(r.lsd) + f(r.ip, true) + f(r.premium) + '</tr>';
    };
    return tbl([22, 16, 16, 16, 16, 14], th('', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability', 'lsd') + th('Income protector p.m.', 'ip') + th('Monthly premium'),
      row('What you have now', c.now) + row('This quote', c.quote) + row('Difference', c.diff, true));
  }
  function currentQuote(b) { var qs = calc.quotes(state(), b.id); return qs[Math.min(ps.qi, Math.max(0, qs.length - 1))]; }
  function quotesView(b) {
    var qs = calc.quotes(state(), b.id), out = title(b);
    if (!qs.length) return out + empty(b.id === 'shortfallQuote' && !calc.hasGroupRisk(state()) ? 'The client has no group risk, so no shortfall quote is needed.' : 'Nothing to show here for this client.');
    var q = qs[Math.min(ps.qi, qs.length - 1)], hasCmp = !!q.cmp, sub = ps.sub === 'cmp' && !hasCmp ? 'quote' : ps.sub;
    var chips = qs.length > 1 ? '<span class="lbl">Quote</span>' + qs.map(function (x, i) { return '<button type="button" class="pchip' + (i === Math.min(ps.qi, qs.length - 1) ? ' on' : '') + '" data-act="q" data-i="' + i + '">' + esc((x.insurer || 'Quote') + (x.number ? ' ' + x.number : '')) + '</button>'; }).join('') : '';
    var subs = [['quote', 'The quote']].concat(hasCmp ? [['cmp', 'Your change moment pay-out']] : [], [['cmpr', 'Compared with what you have now']]);
    out += '<div class="pctl">' + chips + '<span class="sp"></span></div>' + quoteHead(q);
    out += '<div class="pctl">' + subs.map(function (s) { return '<button type="button" class="psub' + (s[0] === sub ? ' on' : '') + '" data-act="sub" data-s="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '<span class="sp"></span>' + (sub === 'cmp' ? '' : pillBtns()) + '</div>';
    if (sub === 'cmp') return out + cmpView(q);
    if (sub === 'cmpr') return out + compareView(q);
    out += linesTable(q, false, q.disabilityAge || state().header.disabilityAge);
    if (calc.activeLines(q).some(function (l) { return l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; })) out += note('Instalment Protector: if you are retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.');
    return out;
  }

  /* ---------- the other blocks ---------- */
  function tickCell(inner, yes) { return '<td class="l tick"><i class="' + (yes ? 'yes' : 'no') + '">' + (yes ? '&#10003;' : '&#10005;') + '</i>' + inner + '</td>'; }
  function policiesView(b) {
    var s = state(), ps0 = calc.policies(s), pt = calc.policyTotals(s), age = s.header.disabilityAge, out = title(b);
    if (!ps0.length) return out + empty('No current policies.');
    var one = ps.pol != null ? ps0[ps.pol] : null;
    if (one) {
      var it = one.item;
      return out + '<div class="pctl"><button type="button" class="pchip" data-act="polall">&larr; All policies</button><span class="sp"></span>' + pillBtns() + '</div><div class="qhead"><span>' + esc([it.insurer || 'Policy', it.policyNo, it.product, it.doc ? 'DOC ' + it.doc : ''].filter(Boolean).join('   |   ')) + '</span></div>' + linesTable(it, true, it.ipAge || age);
    }
    var ageH = ageText(age), rows = ps0.map(function (e, i) {
      var it = e.item, tt = calc.totals(it), lines = calc.activeLines(it), has = lines.length, bn = it.benefits || {}, notes = [bn.life, bn.lsd, bn.ip].filter(Boolean).join(' / ');
      var w = (lines.filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
      return '<tr' + (has ? ' data-act="pol" data-i="' + i + '"' : '') + '>' + tickCell('<b>' + esc((it.insurer || 'Policy') + (it.policyNo ? '   ' + it.policyNo : '')) + '</b><small>' + esc([it.product, it.doc ? 'DOC ' + it.doc : '', notes].filter(Boolean).join('  |  ')) + '</small>', !!it.wr) +
        td(has ? A(tt.life.lump) : A(null), '', 'life') + td(has ? A(tt.sev.lump) : A(null), '', 'sev') + td(has ? A(tt.lsd.lump) : A(null), '', 'lsd') + td(has ? PM(tt.ip.monthly) : A(null), '', 'ip') + td(esc(w || '-')) + td(PC(it.aci)) + td(PC(it.abi)) + td(A(it.premium)) + '</tr>';
    }).join('');
    var tot = function (label, tt, prem, cls) { return '<tr class="' + cls + '"><td class="l">' + label + '</td>' + td(A(tt.life.lump), '', 'life') + td(A(tt.sev.lump), '', 'sev') + td(A(tt.lsd.lump), '', 'lsd') + td(PM(tt.ip.monthly), '', 'ip') + '<td></td><td></td><td></td>' + td(A(prem)) + '</tr>'; };
    if (pt.count.wr) rows += tot('Total: policies where we are the broker', pt.wr, pt.premium.wr, 'prem'); if (pt.count.other) rows += tot('Total: other brokers', pt.other, pt.premium.other, 'prem');
    rows += tot('Grand total (all policies)', pt.all, pt.premium.all, 'tot');
    return out + '<div class="pctl"><span class="lbl">Click a policy to see its lines</span><span class="sp"></span>' + pillBtns() + '</div>' +
      tbl([27, 11, 10, 11, 12, 8, 6, 6, 9], th('Policy', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI') + th('ABI') + th('Premium'), rows);
  }
  function groupView(b) {
    var s = state(), items = calc.groupItems(s), pi = calc.personalInvestments(s), gt = calc.groupTotals(s), prem = 0, age = s.header.disabilityAge, out = title(b);
    if (!items.length && !pi.count) return out + empty('No group benefits or personal investments.');
    var cell = function (g, p) {
      var c = g[p]; if (!c || !calc.isNum(c.amount)) return td(c && c.amount === 'Not found' ? '<span class="na">Not found</span>' : '<span class="none">&ndash;</span>', '', p);
      return td((p === 'ip' ? PM(c.amount) : A(c.amount)) + (c.endAge != null && c.endAge !== '' ? '<small>' + esc(/^\d+$/.test(String(c.endAge)) ? 'To age ' + c.endAge : c.endAge) + '</small>' : ''), '', p);
    };
    var rows = items.map(function (g) {
      var p2 = g.kind === 'risk' ? g.monthlyCost : (calc.isNum(g.employer) || calc.isNum(g.employee) ? calc.r2((g.employer || 0) + (g.employee || 0)) : g.contribTotal); if (calc.isNum(p2)) prem = calc.r2(prem + p2);
      var label = (schema.GROUP_KINDS[g.kind] || g.kind) + '   ' + (g.provider || '');
      if (g.kind === 'risk') return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc([g.statementDate ? 'Statement ' + g.statementDate : '', g.paidBy ? 'paid by ' + g.paidBy : ''].filter(Boolean).join('  |  ')) + '</small></td>' + cell(g, 'life') + cell(g, 'sev') + cell(g, 'lsd') + cell(g, 'ip') + td(esc(g.ipWaiting || '-')) + td(PC(g.aci)) + td(PC(g.abi)) + td(A(p2)) + '</tr>';
      return '<tr><td class="l"><b>' + esc(label) + '</b><small>' + esc((calc.isNum(g.value) ? 'Fund value ' + calc.fmtR(g.value) + '  |  ' : '') + (calc.isNum(g.employer) || calc.isNum(g.employee) ? 'employer ' + calc.fmtR(g.employer || 0) + ', employee ' + calc.fmtR(g.employee || 0) : 'POI needed')) + '</small></td>' +
        td('<span class="none">&ndash;</span>', '', 'life') + td('<span class="none">&ndash;</span>', '', 'sev') + td('<span class="none">&ndash;</span>', '', 'lsd') + td('<span class="none">&ndash;</span>', '', 'ip') + td('<span class="na">N/A</span>') + td(PC(g.aci)) + td('<span class="na">N/A</span>') + td(A(p2)) + '</tr>';
    }).join('');
    prem = calc.r2(prem + pi.monthly);
    rows += '<tr><td class="l"><b>Personal investments</b><small>The total of the current investments (block 8)</small></td>' + td(pi.count ? A(pi.gross) : A(null), '', 'life') + td('', '', 'sev') + td('', '', 'lsd') + td('', '', 'ip') + td('<span class="na">N/A</span>') + td('<span class="na">N/A</span>') + td('<span class="na">N/A</span>') + td(pi.count ? A(pi.monthly) : A(null)) + '</tr>';
    rows += '<tr class="tot"><td class="l">Total</td>' + td(A(calc.r2(gt.life + pi.gross)), '', 'life') + td(A(gt.sev), '', 'sev') + td(A(gt.lsd), '', 'lsd') + td(PM(gt.ip), '', 'ip') + '<td></td><td></td><td></td>' + td(A(prem)) + '</tr>';
    var ageH = ageText(age);
    return out + '<div class="pctl"><span class="sp"></span>' + pillBtns() + '</div>' + tbl([25, 11, 10, 11, 12, 8, 6, 6, 11], th('Item', '', 'l') + th('Life cover', 'life') + th('Severe illness', 'sev') + th('Lump sum disability' + ageH, 'lsd') + th('Income protector / sickness benefit' + ageH, 'ip') + th('Waiting period') + th('ACI') + th('ABI') + th('Total monthly premium'), rows);
  }
  function shortfallView(b) {
    var sf = calc.shortfall(state()), out = title(b);
    if (!sf.has) return out + empty('There is no FNA quote yet, so the shortfall cannot be worked out.');
    var rows = PILL_ROW.map(function (r) {
      var p = r[0], pi = p === 'life' ? sf.pi.gross : 0;
      return '<tr data-pil="' + p + '">' + td('<b>' + (p === 'ip' ? 'Income protector (R p.m.)' : r[1]) + '</b>', 'l') + td(A(sf.fna[p])) + td(sf.group[p] ? A(sf.group[p]) : '<span class="none">none</span>') + td(pi ? A(pi) : '<span class="none">none</span>') + td(A(sf.short[p]), 'tot') + '</tr>';
    }).join('');
    return out + '<div class="pctl"><span class="sp"></span>' + pillBtns() + '</div>' + tbl([25, 19, 19, 19, 18], th('', '', 'l') + th('FNA') + th('Less group benefits') + th('Less personal investments') + th('Shortfall'), rows) +
      note('The FNA assumes you have nothing in place. The shortfall takes off what you already have through your group benefits and your personal investments (your retirement annuities and other investments count towards the life cover shortfall).');
  }
  function investmentsView(b) {
    var items = calc.investments(state()), pi = calc.personalInvestments(state()), out = title(b);
    if (!items.length) return out + empty('No current investments.');
    var rows = items.map(function (i) {
      var vs = i.valueSource || {}, src = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? '<small>' + esc(vs.date) + '</small>' : '') : '-';
      return '<tr>' + tickCell('<b>' + esc(i.provider || 'Investment') + '</b><small>' + esc(i.product || '') + '</small>', !!i.wr) + td(esc(i.valueDate || '-'), 'c') + td(src, 'c') + td(A(i.gross)) + td(A(i.penalty)) + td(calc.isNum(i.gross) ? A(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : A(null)) + td(PC(i.returnRate)) + td(PC(i.aci)) + td(A(i.monthly)) + '</tr>';
    }).join('');
    rows += '<tr class="tot"><td class="l">Total investments</td><td></td><td></td>' + td(A(pi.gross)) + td(A(pi.penalty)) + td(A(pi.net)) + '<td></td><td></td>' + td(A(pi.monthly)) + '</tr>';
    return out + tbl([21, 9, 14, 12, 10, 12, 8, 6, 8], th('Investment', '', 'l') + th('Values at') + th('Source') + th('Gross fund value') + th('Penalties') + th('Net fund value') + th('Rate of return') + th('ACI') + th('Premium'), rows);
  }
  function proposedView(b) {
    var items = calc.active(state().blocks.proposed.items), out = title(b);
    if (!items.length) return out + empty('No proposed investments.');
    return out + tbl([17, 20, 14, 11, 11, 7, 13, 7], th('Investment type', '', 'l') + th('Provider & quote', '', 'l') + th('Contribution', '', 'l') + th('Lump sum') + th('Monthly premium') + th('Boost') + th('Net amount invested') + th('ACI'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.type) + '</b>', 'l') + td(esc([i.provider, i.quote ? 'Quote ' + i.quote : ''].filter(Boolean).join('   ')), 'l') + td(esc(schema.contributionLabel[i.contribution] || ''), 'l') + td(A(i.lump)) + td(A(i.monthly)) + td(PC(i.boostPct)) + td(A(i.netInvested)) + td(PC(i.aci)) + '</tr>'; }).join(''));
  }
  function goalsView(b) {
    var items = calc.active(state().blocks.goals.items), out = title(b);
    if (!items.length) return out + empty('No goal analysis reports.');
    return out + tbl([27, 9, 21, 12, 12, 6, 13], th('Report', '', 'l') + th('Requested') + th('Note', '', 'l') + th('Current value (R p.m. gross)') + th('Future value (R p.m. gross)') + th('ACI') + th('Premium'),
      items.map(function (i) { return '<tr>' + td('<b>' + esc(i.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)') + '</b>', 'l') + td(i.requested ? 'Yes' : 'No', 'c') + td(esc(i.note || ''), 'l') + td(A(i.currentValuePm)) + td(A(i.futureValuePm)) + td(PC(i.aci)) + td(A(i.premium)) + '</tr>'; }).join(''));
  }
  function otherView(b) {
    var out = title(b);
    return out + tbl([17, 24, 14, 8, 11, 26], th('Item', '', 'l') + th('Company & product', '', 'l') + th('Policy number', '', 'l') + th('Broker') + th('Premium') + th('Notes', '', 'l'),
      state().blocks.other.items.filter(function (i) { return !i.removed; }).map(function (i) {
        var nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === i.key; })[0] || { l: i.key }).l, has = i.company || i.product || i.note;
        return '<tr>' + td('<b>' + esc(nm) + '</b>', 'l') + td(esc([i.company, i.product].filter(Boolean).join('   ') || '-'), 'l') + td(esc(i.policyNo || '-'), 'l') + td(has ? '<b style="color:' + (i.wr ? '#4fcf86' : '#ff6b5e') + '">' + (i.wr ? '&#10003;' : '&#10005;') + '</b>' : '-', 'c') + td(A(i.premium)) + td(esc(i.note || ''), 'l') + '</tr>';
      }).join(''));
  }
  var VIEWS = { policies: policiesView, fna: quotesView, group: groupView, shortfall: shortfallView, shortfallQuote: quotesView, reduced: quotesView, comparative: quotesView, investments: investmentsView, proposed: proposedView, goals: goalsView, other: otherView };

  /* ---------- the map ---------- */
  function mapView() {
    var s = state(), f = P.mapFigures(s), cx = 620, cy = 310, rx = 490, ry = 240, nodes = '', lines = '', n = schema.BLOCKS.length;
    schema.BLOCKS.forEach(function (b, i) {
      var a = (-90 + i * 360 / n) * Math.PI / 180, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a), none = /^(None|Waiting|Not needed)/.test(f[b.id] || '');
      lines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + Math.round(x) + '" y2="' + Math.round(y) + '"/>';
      nodes += '<button type="button" class="pnode' + (none ? ' empty' : '') + '" data-act="tab" data-tab="' + b.id + '" style="left:' + Math.round(x - 112) + 'px;top:' + Math.round(y - 40) + 'px"><b><i>' + b.n + '</i>' + esc(b.title) + '</b><span>' + esc(f[b.id] || '') + '</span></button>';
    });
    return '<svg viewBox="0 0 1240 620">' + lines + '</svg><div class="pcentre"><div class="nm">' + esc(schema.clientFull(s) || 'New client') + '</div><div class="ov">CLIENT OVERVIEW</div><div class="dt">' + esc(s.header.overviewDate || schema.todayDMY()) + '</div></div>' + nodes;
  }

  /* ---------- drawing ---------- */
  function slide() { return $('#pSlide'); }
  function render() {
    var sl = slide(), b = schema.blocksById[ps.tab];
    sl.className = 'pslide' + (ps.tab === 'map' ? ' pmap' : ''); sl.innerHTML = ps.tab === 'map' ? mapView() : VIEWS[ps.tab](b);
    $('#pTabs').innerHTML = P.TABS.map(function (t, i) { return '<button type="button" class="ptab' + (P.ORDER[i] === ps.tab ? ' on' : '') + '" data-act="tab" data-tab="' + P.ORDER[i] + '">' + esc(t) + '</button>'; }).join('');
    $('#pWho').textContent = (schema.clientFull(state()) || 'New client') + ' · Client Overview';
    paintHL(); paintPanel(); fit();
  }
  function fit() {
    var st = $('#pStage'), sl = slide(); if (!st || !sl) return;
    sl.style.transform = 'none'; var h = sl.offsetHeight, sw = st.clientWidth, sh = st.clientHeight, pad = ps.tab === 'map' ? 0 : 10, sc = Math.min(sw / SLIDE_W, (sh - pad) / h, 1.5);
    if (!(sc > 0) || !isFinite(sc)) sc = 1;
    sl.style.transform = 'translate(' + Math.round((sw - SLIDE_W * sc) / 2) + 'px,' + (ps.tab === 'map' ? Math.max(0, Math.round((sh - h * sc) / 2)) : 4) + 'px) scale(' + sc + ')';
  }
  function rowsOn() { var sl = slide(); return sl ? [].slice.call(sl.querySelectorAll('tr[data-keys]')).filter(function (r) { return ps.rows.some(function (k) { return ('|' + r.getAttribute('data-keys') + '|').indexOf('|' + k + '|') >= 0; }); }) : []; }
  function paintHL() {
    var sl = slide(); if (!sl) return;
    [].forEach.call(sl.querySelectorAll('[data-pil]'), function (el) { el.classList.toggle('hl', !!ps.pil && el.getAttribute('data-pil') === ps.pil); });
    sl.classList.toggle('hlp', !!ps.pil && !!sl.querySelector('[data-pil]'));
    var on = rowsOn();
    [].forEach.call(sl.querySelectorAll('tr[data-keys]'), function (r) { r.classList.toggle('on', on.indexOf(r) >= 0); });
    sl.classList.toggle('hlr', on.length > 0);
    [].forEach.call(sl.querySelectorAll('.pbtn'), function (bt) { bt.classList.toggle('on', bt.getAttribute('data-p') === ps.pil); });
  }
  function context() {
    var b = schema.blocksById[ps.tab]; if (!b) return null;
    if (b.kind === 'quotes') { var q = currentQuote(b); return q ? { insurer: q.insurer, product: q.productName || '' } : null; }
    if (b.id === 'policies' && ps.pol != null) { var e = calc.policies(state())[ps.pol]; return e ? { insurer: e.item.insurer, product: e.item.product } : null; }
    return null;
  }
  function paintPanel() {
    var pn = $('#pPanel'); if (!pn) return;
    pn.hidden = ps.tab === 'map'; if (pn.hidden) return;
    var ctx = context(), h = '<h3>Key points</h3>', foot = '';
    if (!kp) h += '<p class="muted">No key points are loaded in this browser yet.</p><button type="button" class="pb" data-act="kp">Load key points&hellip;</button>';
    else if (!ctx || !ctx.insurer) h += '<p class="muted">Key points show here for a quote or a policy.</p>';
    else if (!ps.pil) h += '<div class="pk-for">' + esc(ctx.insurer) + '</div><p class="muted">Choose a benefit to see its key points.</p>';
    else {
      var pts = P.pointsFor(kp.points, ctx.insurer, P.benefitsFor(ps.pil, ps.rows), ctx.product), lab = (PILL_ROW.filter(function (p) { return p[0] === ps.pil; })[0] || [0, ''])[1];
      h += '<div class="pk-for">' + esc(ctx.insurer) + ' &middot; ' + esc(lab) + '</div>' + (pts.length ? '<ul>' + pts.map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No approved key points for this benefit yet.</p>');
    }
    if (kp) foot = '<div class="pk-foot">' + kp.points.length + ' approved points &middot; ' + esc(kp.loaded || '') + '<br><button type="button" data-act="kp">Replace</button><button type="button" data-act="kpx">Remove</button></div>';
    pn.innerHTML = h + foot;
  }

  /* ---------- moving ---------- */
  function go(tab, qi, pol) {
    if (!schema.blocksById[tab] && tab !== 'map') return;
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
    var sl = slide(); if (!sl || !sl.querySelector('[data-pil]')) return false;
    ps.pil = toggle && ps.pil === p ? null : p; paintHL(); paintPanel(); return true;
  }
  function setRows(keys, toggle) {
    ps.rows = toggle && ps.rows.length === keys.length && ps.rows[0] === keys[0] ? [] : keys;
    if (ps.rows.length && !rowsOn().length) { ps.rows = []; return false; }
    paintHL(); paintPanel(); return true;
  }
  function applyMoves(moves) {
    var miss = false;
    moves.forEach(function (m) {
      if (m.clear) { ps.pil = null; ps.rows = []; paintHL(); paintPanel(); }
      else if (m.step) { var i = P.ORDER.indexOf(ps.tab) + m.step; if (i >= 0 && i < P.ORDER.length) go(P.ORDER[i]); }
      else if (m.tab) go(m.tab, m.qi, m.pol);
      else if (m.sub) { if (!setSub(m.sub)) miss = true; }
      else if (m.pil) { if (!setPil(m.pil, false)) miss = true; }
      else if (m.line) { if (!setRows([m.line], false)) miss = true; }
    });
    if (miss) hintMsg('That is not on this page.');
  }

  /* ---------- the voice ---------- */
  var engine = P.createEngine({ topics: function () { return P.topics(state()); }, onMove: function (m, label) { lastLabel = label || ''; hint = ''; applyMoves(m); renderChoices(); paintVoice(); }, onChoices: function () { renderChoices(); paintVoice(); }, onUnknown: function () { hintMsg('That is not on this overview.'); } });
  function hintMsg(t) { hint = t; clearTimeout(hintT); hintT = setTimeout(function () { hint = ''; paintVoice(); }, 3500); paintVoice(); }
  function speechPrefs() {
    var p = { engine: 'whisper', model: FF.listen ? FF.listen.DEFAULT_MODEL : 'moonshine-tiny' };
    try { var sv = JSON.parse(localStorage.getItem(SPEECH_KEY) || '{}'); if (sv.engine) p.engine = sv.engine; if (sv.model) p.model = sv.model; } catch (e) { /* the defaults */ }
    return p;
  }
  var STATUS_TEXT = { locked: 'Listening. Say "let’s talk about …", "next", or "back to the main page".', cooling: 'Moved', paused: 'Paused because you clicked', choose: 'Not clear: choose one of the buttons' };
  function paintVoice() {
    if (!root) return;
    var st = engine.status(), txt = hint || (st === 'off' ? (lsnState === 'loading' ? 'Starting the voice (the first time the speech model may take a minute)…' : 'Voice is off. Click works always.') : (STATUS_TEXT[st] + (st === 'cooling' && lastLabel ? ': ' + lastLabel : '')));
    var b = $('#pBtnVoice'); b.textContent = engine.on ? 'Voice: On' : lsnState === 'loading' ? 'Voice: Starting…' : 'Voice: Off'; b.classList.toggle('on', engine.on);
    $('#pDot').className = 'pdot ' + st; $('#pVoiceText').textContent = txt;
  }
  function renderChoices() {
    var c = engine.choices(), el = $('#pChoose'); if (!el) return;
    if (!c) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false; el.innerHTML = '<span>Which one?</span>' + c.map(function (x, i) { return '<button type="button" class="pb" data-act="choose" data-i="' + i + '">' + esc(x.label) + '</button>'; }).join(''); fit();
  }
  function startVoice() {
    if (lsn) return;
    if (!FF.listen) { hintMsg('Voice is not available in this copy of the page.'); return; }
    var p = speechPrefs(), set = FF.lookup && FF.lookup.getSettings ? FF.lookup.getSettings() : {};
    lsn = FF.listen.create({
      engine: p.engine, model: p.model, openaiKey: set.openaiKey, openaiModel: set.openaiModel, usage: function () {}, call: false,        // the microphone alone: the sound of a call is never listened to here
      prompt: function () { return 'A South African financial adviser presenting a client overview. Commands: let us talk about, go to, show me, next, back, back to the main page. Words: life cover, severe illness, lump sum disability, income protector, shortfall, reduced quotes, comparative quotes, investments.'; },
      state: function (st, d) {
        lsnState = st;
        if (st === 'on') { engine.setOn(true); hint = ''; if (p.engine === 'chrome') hintMsg('Chrome’s speech recognition sends the sound to Google: for practice only.'); }
        else if (st === 'error') { lsn = null; engine.setOn(false); hintMsg((d && d.message) || 'The voice could not start.'); }
        paintVoice();
      },
      text: function (t, m) { engine.hear(t, m && m.who); },
      note: function (msg) { hintMsg(msg); }, event: function () {}, level: function () {}
    });
    lsnState = 'loading'; paintVoice(); lsn.start();
  }
  function stopVoice() { if (lsn) { var l = lsn; lsn = null; try { l.stop(); } catch (e) { /* already stopped */ } } lsnState = 'off'; engine.setOn(false); renderChoices(); paintVoice(); }

  /* ---------- the key-points library ---------- */
  function loadKeyPoints(text, name) {
    var r = P.parseKeyPoints(text);
    if (!r.ok) { hintMsg(r.error); return r; }
    saveKP({ file: name || '', loaded: schema.todayDMY(), points: r.points, total: r.total, dropped: r.dropped });
    hintMsg(r.points.length + ' approved key points loaded' + (r.dropped ? ' (' + r.dropped + ' not approved, left out)' : '') + '.'); paintPanel(); return r;
  }

  /* ---------- the screen's chrome and the clicks ---------- */
  function build() {
    root = document.createElement('div'); root.className = 'pres'; root.id = 'pres'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Presentation');
    root.innerHTML = '<div class="pbar"><div class="pwho" id="pWho"></div><div class="pvoice"><span class="pdot" id="pDot"></span><span id="pVoiceText"></span></div><div class="pbtns">' +
      '<button type="button" class="pb" id="pBtnVoice" title="Follow your voice: only your microphone, only a fixed list of commands">Voice: Off</button><button type="button" class="pb" id="pBtnKp" data-act="kp" title="Load your approved key points (kept in this browser)">Key points&hellip;</button>' +
      '<button type="button" class="pb" id="pBtnClose" title="Back to the overview (Esc)">Close &#10005;</button></div></div><div class="ptabs" id="pTabs"></div><div class="pchoose" id="pChoose" hidden></div>' +
      '<div class="pmain"><div class="pstage" id="pStage"><div class="pslide" id="pSlide"></div></div><aside class="ppanel" id="pPanel"></aside></div><input type="file" id="pKpIn" accept=".json,application/json" hidden>';
    document.body.appendChild(root);
    root.addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr[data-keys]'), el = ev.target.closest('[data-act]'), act = el && el.getAttribute('data-act');
      if (ev.target.closest('#pBtnClose')) { close(); return; }
      if (ev.target.closest('#pBtnVoice')) { if (engine.on || lsn) stopVoice(); else startVoice(); return; }
      if (!act && !tr) return;
      if (act !== 'choose') engine.pause();                                                         // a click always works, and the voice waits
      if (act === 'tab') go(el.getAttribute('data-tab'));
      else if (act === 'q') { ps.qi = +el.getAttribute('data-i'); ps.sub = 'quote'; ps.pil = null; ps.rows = []; render(); }
      else if (act === 'sub') setSub(el.getAttribute('data-s'));
      else if (act === 'pil') setPil(el.getAttribute('data-p'), true);
      else if (act === 'pol') go('policies', undefined, +el.getAttribute('data-i'));
      else if (act === 'polall') { ps.pol = null; ps.pil = null; ps.rows = []; render(); }
      else if (act === 'choose') engine.choose(+el.getAttribute('data-i'));
      else if (act === 'kp') $('#pKpIn').click();
      else if (act === 'kpx') { saveKP(null); paintPanel(); }
      else if (tr) { var keys = tr.getAttribute('data-keys').split('|'); setRows([keys[keys.length - 1]], true); }
      paintVoice();
    });
    $('#pKpIn').addEventListener('change', function () {
      var f = this.files && this.files[0], inp = this; if (!f) return;
      var r = new FileReader(); r.onload = function () { loadKeyPoints(String(r.result || ''), f.name); inp.value = ''; }; r.onerror = function () { hintMsg('The file could not be read.'); }; r.readAsText(f);
    });
    window.addEventListener('resize', function () { if (open) fit(); });
    document.addEventListener('keydown', function (ev) {
      if (!open) return;
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); engine.pause(); applyMoves([{ step: ev.key === 'ArrowRight' ? 1 : -1 }]); paintVoice(); }
    });
  }
  function openPres() {
    if (!root) { kp = loadKP(); build(); }
    if (open) return;
    open = true; prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; root.hidden = false;
    ps = { tab: 'map', qi: 0, sub: 'quote', pil: null, rows: [], pol: null };
    render(); paintVoice(); renderChoices();
    tick = setInterval(function () { paintVoice(); renderChoices(); }, 400);
    setTimeout(fit, 30);
  }
  function close() {
    if (!open) return;
    open = false; stopVoice(); clearInterval(tick); root.hidden = true; document.body.style.overflow = prevOverflow;
  }
  var btn = $('#btnPresent'); if (btn) btn.addEventListener('click', openPres);
  OV.present = { open: openPres, close: close, get isOpen() { return open; }, get ps() { return ps; }, engine: engine, hear: function (t, who) { return engine.hear(t, who); }, applyMoves: applyMoves, go: go, loadKeyPoints: loadKeyPoints, get keyPoints() { return kp; }, render: render };
})();
