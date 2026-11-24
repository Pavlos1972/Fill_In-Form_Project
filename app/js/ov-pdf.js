/* Builds the Client Overview PDF (stage 3): the same eleven blocks, tables and figures as the screen (the figures come from ov-calc.js, the same code), in a fresh, simple look made to be read on a screen:
   a cover (a blue strip with the client's name on white, so the logo stands out), then one page for each block that has something to say (a page with nothing in it is left out and its tab is greyed); each page is A4 wide (landscape) and as tall as its content needs, so a quote's change moment pay-out and its comparison always stay on the same
   page as the quote. Every page has a row of tabs (Cover and one for each block, the current one highlighted), each tab a link to its page, and the PDF opens in single-page view, so the client moves by tabs and
   never has to scroll. Amounts never split over two lines. What is for Sitamah and Paul only (the checks, the amber statuses) is never printed. */
(function () {
  var FF = window.FF, OV = window.OV, schema = OV.schema, calc = OV.calc, store = OV.store;

  var W = 297, M = 12, CW = W - 2 * M, MIN_H = 210, TAB_Y = 6.5, TAB_H = 8, TOP = 22;
  var ACCENT = [39, 168, 224], DEEP = [18, 118, 168], INK = [38, 41, 46], MUTED = [100, 110, 118], LINE = [200, 218, 230], HEAD = [213, 236, 248], ORANGE = [253, 239, 224], BLUE = [225, 243, 251], RED = [179, 38, 30], GREEN = [45, 106, 62], PALE = [243, 249, 252];
  var FS = { body: 9.5, head: 9, small: 7, h1: 19, name: 43, sub: 11 };
  var TABS = ['Cover', '1 Policies', '2 FNA', '3 Group', '4 Shortfall', '5 Shortfall quote', '6 Reduced', '7 Comparative', '8 Investments', '9 Proposed', '10 Goals', '11 Other'];

  /* Standard PDF fonts cannot show every character. Keep to what they can. */
  function t(s) {
    return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—‐‑‒−]/g, '-').replace(/[\xa0 -   ]/g, ' ')
      .replace(/[​‌‍﻿]/g, '').replace(/…/g, '...').replace(/[•‣◦⁃▪●]/g, '-').replace(/→/g, '->').replace(/←/g, '<-')
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa1-\xff]/g, '?');
  }
  var A = function (v) { return calc.isNum(v) ? calc.fmtR(v) : (v === 'N/A' || v === 'Not found' ? v : '-'); };
  var PM = function (v) { return calc.isNum(v) ? calc.fmtR(v) + ' p.m.' : A(v); };
  var PC = function (v) { return calc.isNum(v) ? calc.fmtPct(v) : (v === 'N/A' || v === 'Not found' ? v : '-'); };
  var AC = function (x) { var p = calc.aciPoints(x); return !p.length ? '-' : (p.length === 1 && p[0] === calc.fmtAci(x) ? p[0] : p.map(function (t) { return '- ' + t; }).join('\n')); };          // the ACI as 1 to 3 short points (round 4), or the short wording itself                                          // the ACI as the document words it, or "10% fixed"
  var right = function (s, extra) { return Object.assign({ content: t(s), styles: Object.assign({ halign: 'right' }, extra || {}) }); };
  var center = function (s, extra) { return { content: t(s), styles: Object.assign({ halign: 'center' }, extra || {}) }; };

  function setText(doc, c, size, bold) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function table(doc, y, o) {
    var cs = {}; o.colw.forEach(function (w, i) { cs[i] = { cellWidth: w, halign: o.align && o.align[i] || 'right' }; });
    doc.autoTable({ startY: y, margin: { left: M, right: M, top: 4, bottom: 4 }, theme: 'grid', head: o.head, body: o.body, tableWidth: CW, columnStyles: cs,
      styles: { font: 'helvetica', fontSize: FS.body, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, lineColor: LINE, lineWidth: 0.25, textColor: INK, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: HEAD, textColor: DEEP, fontStyle: 'bold', fontSize: FS.head, halign: 'center', valign: 'bottom' }, didDrawCell: o.draw || undefined, rowPageBreak: 'avoid' });
    return doc.lastAutoTable.finalY;
  }

  /* ---------- the tab row ---------- */
  function tabRow(doc, current, pages, measuring) {
    var w = CW / TABS.length;
    TABS.forEach(function (name, i) {
      var x = M + i * w, on = i === current, here = !pages || pages.no[i] > 0;
      doc.setFillColor.apply(doc, on ? ACCENT : here ? PALE : [236, 238, 240]);
      doc.roundedRect(x + 0.4, TAB_Y, w - 0.8, TAB_H, 1.6, 1.6, 'F');
      setText(doc, on ? [255, 255, 255] : here ? DEEP : [168, 174, 180], 7.5, on);
      doc.text(t(name), x + w / 2, TAB_Y + TAB_H / 2 + 1.1, { align: 'center' });
      if (!measuring && here) doc.link(x + 0.4, TAB_Y, w - 0.8, TAB_H, { pageNumber: pages ? pages.no[i] : i + 1 });
    });
  }
  function pageTitle(doc, text) { setText(doc, DEEP, FS.h1, true); doc.text(t(text), M, TOP + 6); return TOP + 14; }
  function note(doc, y, text, color) {
    setText(doc, color || MUTED, 8.5, false);
    var lines = doc.splitTextToSize ? doc.splitTextToSize(t(text), CW) : [t(text)];
    doc.text(lines, M, y + 3); return y + 3 + 4 * lines.length + 1;
  }
  function empty(doc, y, text) { setText(doc, MUTED, 10.5, false); doc.text(t(text), M, y + 5); return y + 10; }

  /* ---------- the cover ---------- */
  function cover(doc, state, H, measuring, pages) {
    tabRow(doc, 0, pages, measuring);
    var name = schema.clientFull(state) || 'New client', h = state.header, lg = FF.logo, top = H / 2 - 22, bottom = H / 2 + 33;
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.rect(0, top, W, bottom - top, 'F');
    if (lg && lg.data) { try { doc.addImage(lg.data, 'PNG', M, H - 34, 40, 40 * lg.h / lg.w); } catch (e) { /* the logo is optional */ } }
    setText(doc, [255, 255, 255], FS.name, true); doc.text(t(name), W / 2, H / 2 - 4, { align: 'center' });
    setText(doc, [255, 255, 255], 20, false); doc.text('Your financial overview', W / 2, H / 2 + 12, { align: 'center' });
    setText(doc, [255, 255, 255], 12, false);
    var bits = ['Prepared ' + (h.overviewDate || schema.todayDMY()), h.broker ? 'by Broker ' + h.broker : '', h.astuteDate ? 'Astute report: ' + h.astuteDate : ''].filter(Boolean).join('     ');
    doc.text(t(bits), W / 2, H / 2 + 26, { align: 'center' });
    return H;
  }

  /* ---------- the lines of a quote or a policy ---------- */
  function lineCells(l, aci) {
    var tp = schema.lineTypesById[l.type] || schema.lineTypesById.other, need = l.type === 'child' ? 'Child care\n' + ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? 'Debt\n' + [l.debt, l.bank].filter(Boolean).join(' - ') : l.type === 'other' ? (l.label || '') : tp.l;
    if (l.type !== 'other') need += l.accelerated === true ? '\nAccelerated' : l.accelerated === false ? '\nStandalone' : '';                  // every need line says Accelerated or Standalone (round 4)
    var isNA = function (p) { return l[p] === 'N/A'; };
    var hasIP = l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0, any = !isNA('life') || !isNA('lsd');
    var tall = any ? (hasIP ? 22 : 17) : 9; if (l.type !== 'other' && (l.accelerated === true || l.accelerated === false)) tall = Math.max(tall, 17);
    var refsOf = function (p) {                                                                                           // round 1.2: the red references the quote's terms put on this cell (+10% loading, Exclusion 3*), only where it has an amount
      if (!aci || !aci.terms || isNA(p)) return [];
      var pl = schema.PILLARS.filter(function (x) { return x.id === p; })[0];
      if (!pl || !pl.keys.some(function (k) { var v = calc.lineVal(l, p, k); return calc.isNum(v) && v > 0; })) return [];
      return calc.refsAt(aci, l.type, p).map(function (r) { return r.text; });
    };
    var maxRefs = Math.max.apply(null, ['life', 'sev', 'lsd', 'ip'].map(function (p) { return refsOf(p).length; }).concat([0])); if (maxRefs) tall += 3.6 * maxRefs;           // the name, the bank and Accelerated / Standalone
    var pill = function (p, lump, monthly) {
      if (isNA(p)) return right('N/A', { textColor: MUTED });
      var o = { p: p, lump: lump ? calc.lineVal(l, p, 'lump') : undefined, monthly: monthly ? calc.lineVal(l, p, 'monthly') : undefined, label: tp.monthly, protector: p === 'ip' && hasIP, refs: refsOf(p) };
      return { content: '', ov: o, styles: { minCellHeight: tall } };
    };
    return [{ content: t(need), styles: { halign: 'left', fontStyle: 'bold', minCellHeight: tall } }, { content: t(l.term || ''), styles: { halign: 'left' } }, pill('life', true, true), pill('sev', true, false), pill('lsd', true, true), pill('ip', false, true),
      isNA('waiting') ? right('N/A', { textColor: MUTED }) : right(l.waiting || '-'), right(aci ? AC(aci) : '-'), right(PC(l.abi))];
  }
  /* The amounts of a BrightRock line are drawn by hand, in the cell: the lump sum, the monthly figure under it (in red) and what the monthly figure is called; an income protector amount ends in p.m., and a debt's carries the Instalment Protector note. */
  /* A green tick (we are the broker) or a red cross (another broker), drawn with lines: the standard PDF fonts have neither. */
  function mark(d, x, y, yes) {
    d.setLineWidth(0.75); var col = yes ? GREEN : RED; d.setDrawColor(col[0], col[1], col[2]);
    if (yes) { d.line(x, y + 1.7, x + 1.4, y + 3.1); d.line(x + 1.4, y + 3.1, x + 4.3, y - 0.3); } else { d.line(x, y, x + 3.4, y + 3.4); d.line(x + 3.4, y, x, y + 3.4); }
    d.setLineWidth(0.25); d.setDrawColor(LINE[0], LINE[1], LINE[2]);
  }
  function drawOv(data) {
    var o = data.cell && data.cell.raw && data.cell.raw.ov; if (!o || data.section !== 'body') return;
    var d = data.doc, c = data.cell, x = c.x + c.width - 2.2, y = c.y + 4.6;
    if (o.tick !== undefined) {
      mark(d, o.center ? c.x + c.width / 2 - 2 : c.x + 2.6, c.y + c.height / 2 - 1.7, o.tick);
      return;
    }
    function one(txt, size, color, bold) { setText(d, color, size, bold); d.text(t(txt), x, y, { align: 'right' }); y += size > 8 ? 4.5 : 3.4; }
    if (o.pol !== undefined) { one(o.pol, FS.body, INK, false); (o.desc || []).forEach(function (l) { one(l, FS.small, MUTED, false); }); return; }                  // a policy's amount with the description of the benefit under it
    var refs = function () { (o.refs || []).forEach(function (r) { one(r, FS.small, RED, true); }); };
    if (o.p === 'ip') { one(PM(o.monthly), FS.body, INK, false); if (o.protector) { one('Instalment Protector', FS.small, MUTED, false); one('To be ceded to the bank', FS.small, RED, true); } refs(); return; }
    if (!calc.isNum(o.lump) && !calc.isNum(o.monthly) && o.lump !== 'Not found') { one('-', FS.body, MUTED, false); return; }
    one(A(o.lump), FS.body, INK, false);
    if (o.monthly !== undefined) { one(A(o.monthly), FS.body, RED, false); one(o.label, FS.small, MUTED, false); }
    refs();
  }
  var LINES_W = [54, 30, 32, 26, 31, 33, 20, 29, 18];
  function ageHead(age) { return age ? '\nAge ' + age : ''; }
  function linesHead(age) { return [['Need', 'Term', 'Life cover', 'Severe illness', 'Lump sum disability' + ageHead(age), 'Income protector / sickness benefit' + ageHead(age), 'Waiting period', 'ACI', 'ABI']]; }
  function totalRows(tt, premium, rates, q) {
    var tot = function (label, cells, fill, bold) { return [{ content: t(label), colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: fill } }].concat(cells.map(function (c) { return { content: t(c), styles: { halign: 'right', fontStyle: 'bold', fillColor: fill } }; }), [{ content: '', colSpan: 4, styles: { fillColor: fill } }]); };
    var rows = [tot('Total lump sum', [A(tt.life.lump), A(tt.sev.lump), A(tt.lsd.lump), ''], ORANGE), tot('Total income protected', [PM(tt.life.monthly), 'N/A', PM(tt.lsd.monthly), PM(tt.ip.monthly)], ORANGE)];
    var rf = q && q.terms ? ['life', 'sev', 'lsd', 'ip'].map(function (p) { return calc.refsTotal(q, p).map(function (r) { return r.text; }).join('\n'); }) : [];
    if (rf.some(Boolean)) rows.splice(2, 0, [{ content: t('Loadings and exclusions'), colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: [255, 255, 255] } }].concat(rf.map(function (c) { return { content: t(c), styles: { halign: 'right', fontStyle: 'bold', textColor: RED, fillColor: [255, 255, 255], fontSize: FS.small + 1 } }; }), [{ content: '', colSpan: 4, styles: { fillColor: [255, 255, 255] } }]));
    rows.push([{ content: t('Monthly premium' + (rates ? '   ' + rates : '')), colSpan: 3, styles: { halign: 'left', fontStyle: 'bold', fillColor: BLUE } }, { content: t(A(premium)), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: BLUE } }, { content: '', colSpan: 4, styles: { fillColor: BLUE } }]);
    return rows;
  }
  function linesTable(doc, y, c, isPolicy, age) {
    var lines = calc.activeLines(c), body = lines.map(function (l) { return lineCells(l, isPolicy ? null : c); });
    if (!isPolicy) body = body.concat(totalRows(calc.totals(c), c.premium, c.rates, c));
    if (!body.length) return y;
    return table(doc, y, { head: linesHead(age), body: body, colw: LINES_W, align: ['left', 'left'], draw: drawOv });
  }

  /* ---------- quotes ---------- */
  var BADGE = { pending: [[253, 239, 207], [143, 82, 0]], accepted: [[223, 240, 227], GREEN], notaccepted: [[251, 227, 224], RED], declined: [[251, 227, 224], RED], medical: [[251, 227, 224], RED], underwriting: [[225, 242, 250], DEEP] };
  function quoteHeader(doc, y, q, state) {
    var b = BADGE[calc.statusClass(q, state)] || BADGE.pending, got = state && calc.liveCounter(state, q), refused = !!got && calc.counterDead(state, q), label = refused ? 'Counter offer not accepted' : calc.statusText(q), bw = Math.max(48, label.length * 2.5 + 8);          // the badge stays short: a counter offer received is said in the line beside it
    doc.setFillColor.apply(doc, b[0]); doc.setDrawColor.apply(doc, b[1]); doc.setLineWidth(0.4); doc.roundedRect(M, y, bw, 8, 1.8, 1.8, 'FD');
    setText(doc, b[1], 9.5, true); doc.text(t(label), M + bw / 2, y + 5.4, { align: 'center' });
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '', kind = q.counterOf ? 'Counter offer' : { fna: 'FNA', shortfall: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote' }[q.kind];
    setText(doc, INK, FS.sub, true);
    doc.text(t([q.insurer, kind, n, q.date, q.rates, q.servicing ? 'Servicing quote' : ''].filter(Boolean).join('   |   ')), M + bw + 5, y + 5.6);
    if (got && !refused) { setText(doc, DEEP, FS.sub, true); doc.text(t(got.status === 'accepted' ? 'Counter offer accepted' : 'Counter offer received'), M + 1, y + 13); return y + 17; }          // said on a line of its own: beside the long badge it ran off the page
    return y + 12;
  }
  function cmpTable(doc, y, q) {
    var m = q.cmp; if (!m) return y;
    setText(doc, DEEP, FS.sub, true); doc.text('Your change moment pay-out', M, y + 5); y += 8;
    if (!(m.rows && m.rows.length)) return note(doc, y, m.reason || 'The insurer gave no change moment pay-out for this quote.');
    var lbl = { total: 'Total for all your needs', retirement: 'Your retirement needs', childcare: 'Your childcare needs' };
    y = table(doc, y, { head: [['', 'Today', 'Projected value at your change moment date', 'Pay-out date']], colw: [90, 50, 80, 53], align: ['left', 'right', 'right', 'right'],
      body: m.rows.map(function (r) { return [{ content: t(r.key === 'child' ? ((r.name || '') + ' ' + (r.sname || '')).trim() : (lbl[r.key] || r.key)), styles: { halign: 'left' } }, right(A(r.today)), right(A(r.projected)), right(r.payoutDate || '')]; }) });
    return note(doc, y + 1, 'Retirement part: paid monthly for 10 years from the month after the policy anniversary that follows age 65 (so about 65 to 75), growing 5% a year. Childcare part: a once-off lump sum for each child when their childcare cover ends. Only paid if you are alive and the linked cover is still in place.');
  }
  function compareTable(doc, y, state, q) {
    var c = calc.compare(state, q); setText(doc, DEEP, FS.sub, true); doc.text('Compared with what you have now', M, y + 5); y += 8;
    var row = function (label, r, d) { var f = function (v) { return right(d ? calc.fmtDiff(v) : A(v), d ? { fontStyle: 'bold', fillColor: PALE } : {}); }; return [{ content: label, styles: { halign: 'left', fontStyle: d ? 'bold' : 'normal', fillColor: d ? PALE : [255, 255, 255] } }, f(r.life), f(r.sev), f(r.lsd), f(r.ip), f(r.premium)]; };
    return table(doc, y, { head: [['', 'Life cover', 'Severe illness', 'Lump sum disability', 'Income protector p.m.', 'Monthly premium']], colw: [63, 42, 42, 42, 42, 42], align: ['left', 'right', 'right', 'right', 'right', 'right'],
      body: [row('What you have now', c.now), row('This quote', c.quote), row('Difference', c.diff, true)] });
  }
  /* The insurer's terms once the client has accepted and the insurer has answered (round 1.1): standard rates say just that; loadings and exclusions are listed with their reasons. Nothing for a quote still pending or declined. */
  function uwBlock(doc, y, q) {
    var counter = !!q.counterOf, tm0 = q.terms || {}, u = counter ? ((tm0.loadings || []).length || (tm0.exclusions || []).length ? 'both' : null) : calc.uwOf(q); if (!u || u === 'pending' || schema.UW_DECLINED.indexOf(u) >= 0) return y;
    setText(doc, DEEP, FS.sub, true); doc.text(counter ? 'Underwriting terms of the counter offer' : 'Underwriting outcome', M, y + 5); y += 8;
    if (u === 'standard') return note(doc, y, 'Accepted at standard rates.', GREEN);
    if (!counter) y = note(doc, y, schema.uwLabel[u] + '.', GREEN);
    var tm = q.terms || {}, ls = Array.isArray(tm.loadings) ? tm.loadings : [], es = Array.isArray(tm.exclusions) ? tm.exclusions : [];
    if ((u === 'loadings' || u === 'both') && ls.length) y = table(doc, y + 1, { head: [['Loading on', 'Percentage added', 'Reason', 'The reason in words']], colw: [60, 36, 36, 141], align: ['left', 'right', 'left', 'left'],
      body: ls.map(function (r) { var ng = schema.needGroupById[r.need]; return [{ content: t((calc.termBenefit(r) || '') + (ng ? '\n' + ng.l : '')), styles: { halign: 'left', fontStyle: 'bold' } }, right(calc.isNum(r.pct) ? calc.fmtPct(r.pct) : '-'), { content: t(schema.loadingKindLabel[r.kind] || ''), styles: { halign: 'left' } }, { content: t(r.reason || ''), styles: { halign: 'left' } }]; }) }) + 2;
    var withNo = es.some(function (r) { return r && r.no; });
    if ((u === 'exclusions' || u === 'both') && es.length) y = table(doc, y + 1, withNo ? { head: [['No.', 'Benefit', 'What is excluded', 'Type']], colw: [16, 52, 126, 79], align: ['left', 'left', 'left', 'left'],
      body: es.map(function (r) { return [{ content: t(r.no || ''), styles: { halign: 'left', fontStyle: 'bold', textColor: RED } }, { content: t(calc.termBenefit(r)), styles: { halign: 'left', fontStyle: 'bold' } }, { content: t(r.what || ''), styles: { halign: 'left' } }, { content: t(r.why || ''), styles: { halign: 'left' } }]; }) } : { head: [['Benefit', 'What is excluded', 'Why']], colw: [60, 108, 105], align: ['left', 'left', 'left'],
      body: es.map(function (r) { return [{ content: t(r.benefit || ''), styles: { halign: 'left', fontStyle: 'bold' } }, { content: t(r.what || ''), styles: { halign: 'left' } }, { content: t(r.why || ''), styles: { halign: 'left' } }]; }) }) + 2;
    return y;
  }
  /* The head of a counter offer (round 1.2): what it is, the letter, its expiry, the premium before and after, and what the letter says beyond the terms. */
  function counterHead(doc, y, state, q) {
    var root = calc.parentOf(state, q); if (!root) return y;
    var off = q.offer || {}, pr = calc.counterPremium(state, q), parts = ['Counter offer to ' + calc.quoteRef(root), off.expires ? 'the revised proposal expires ' + off.expires : ''].filter(Boolean);
    y = note(doc, y, parts.join('   |   '), DEEP);
    if (pr && calc.isNum(pr.before) && calc.isNum(pr.after)) y = note(doc, y, 'Premium: before ' + A(pr.before) + ' p.m.   |   after ' + A(pr.after) + ' p.m.   |   difference ' + calc.fmtDiff(pr.diff) + (calc.isNum(pr.pct) ? ' (' + (pr.pct > 0 ? '+' : pr.pct < 0 ? '-' : '') + Math.abs(pr.pct) + '%)' : ''), INK);
    if (off.notes) y = note(doc, y, 'The letter also says: ' + off.notes, RED);
    return y;
  }
  /* Which of the client's current policies a quote replaces, in red (round 1.1). A quote the client did not accept, or the insurer declined, prints nothing about it. */
  function replLines(doc, y, state, q) {
    if (calc.dead(q) || q.counterOf || calc.counterDead(state, q)) return y;                                          // a counter offer is the same replacement: it is told once, under the quote the client accepted, naming the counter offer
    var r = calc.replOf(q), ids = {}, live = calc.effectiveQuote(state, q); calc.policies(state).forEach(function (e) { ids[e.item.id] = e; });
    if (r.answer === 'no') return note(doc, y, 'This quote does not replace any of your existing policies.');
    var picks = r.answer === 'yes' ? r.policies.map(function (id) { return ids[id]; }).filter(function (e) { return e && !calc.chainIds(state, q)[e.item.id]; }) : [];
    if (!picks.length) return y;
    setText(doc, DEEP, FS.sub, true); doc.text('Replacing your existing policies', M, y + 5); y += 8;
    picks.forEach(function (e) { y = note(doc, y, calc.policyRef(e.item) + ' will be replaced by ' + calc.quoteRef(live), RED); });
    return y;
  }
  function quotesPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), qs = calc.quotes(state, b.id);
    if (!qs.length) return empty(doc, y, b.id === 'shortfallQuote' && !calc.hasGroupRisk(state) ? 'The client has no group risk, so no shortfall quote is needed.' : 'Nothing to show here for this client.');
    qs.forEach(function (q, i) {
      if (i) y += 6;
      y = quoteHeader(doc, y, q, state);
      if (q.counterOf) y = counterHead(doc, y, state, q);
      y = linesTable(doc, y, q, false, q.disabilityAge || state.header.disabilityAge) + 3;
      if (calc.activeLines(q).some(function (l) { return l.type === 'debt' && calc.isNum(l.ip && l.ip.monthly) && l.ip.monthly > 0; })) y = note(doc, y, 'Instalment Protector: if you are retrenched, the insurer pays each debt\'s instalment straight to the bank, for a period set by the insurer\'s rules.') + 1;
      y = cmpTable(doc, y + 2, q);
      if (!(q.counterOf && !calc.activeLines(q).length)) y = compareTable(doc, y + 3, state, q);                  // a counter offer known only from its letter compares nothing
      y = uwBlock(doc, y + 3, q);
      y = replLines(doc, y + 2, state, q);
    });
    return y;
  }

  /* ---------- the other blocks ---------- */
  function policiesPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), ps = calc.policies(state), pt = calc.policyTotals(state), age = state.header.disabilityAge ? '\nAge ' + state.header.disabilityAge : '';
    if (!ps.length) return empty(doc, y, 'No current policies.');
    var ri = calc.replacementInfo(state);
    var tickCell = function (e) {
      var it = e.item;
      var src = it.src && it.src.kind === 'astute' ? 'Astute' + (it.src.date ? ' ' + it.src.date : '') : '';
      return { content: t((it.insurer || 'Policy') + (it.policyNo ? '   ' + it.policyNo : '') + '\n' + [it.product, it.doc ? 'DOC ' + it.doc : '', src].filter(Boolean).join('  |  ')), ov: { tick: !!it.wr }, styles: { halign: 'left', fontStyle: 'bold', cellPadding: { top: 2, bottom: 2, left: 9, right: 2 } } };
    };
    /* the red notes of a policy (replaced by a quote / will not be replaced, then the broker on record) are a table row of their own under it, so the table makes the room and nothing is drawn over the policy's text (round 1.1) */
    var noteRows = function (e) {
      var pn = calc.policyNote(state, e, ri), out = [], mk = function (txt, red) { return [{ content: t(txt), colSpan: 9, styles: { halign: 'left', fontStyle: red ? 'bold' : 'normal', textColor: red ? RED : MUTED, fontSize: FS.small + 1, fillColor: [255, 255, 255], cellPadding: { top: 1.2, bottom: 1.6, left: 9, right: 2 } } }]; };
      if (!pn) return out;
      out.push(mk(pn.text, true)); if (pn.brokerText) out.push(mk(pn.brokerText, pn.record === 'moves' && !pn.date));
      return out;
    };
    var rows = ps.map(function (e) {
      var tt = calc.totals(e.item), has = calc.activeLines(e.item).length, w = (calc.activeLines(e.item).filter(function (l) { return l.waiting && l.waiting !== 'N/A'; })[0] || {}).waiting;
      /* a very short description of each benefit, read from the schedule, in small grey under its amount (up to three short lines, never cut mid-word) */
      var bn = e.item.benefits || {}, cw = { life: 32, sev: 32, lsd: 32, ip: 34 }, dl = {}, most = 0;
      ['life', 'sev', 'lsd', 'ip'].forEach(function (k) { dl[k] = []; if (bn[k]) { setText(doc, MUTED, FS.small, false); dl[k] = doc.splitTextToSize(t(bn[k]), cw[k] - 3.5); if (dl[k].length > 3) { dl[k] = dl[k].slice(0, 3); dl[k][2] = dl[k][2].replace(/\s*\S*$/, '') + '...'; } } most = Math.max(most, dl[k].length); });
      var amtCell = function (k, txt) { return most ? { content: '', ov: { pol: txt, desc: dl[k] }, styles: { minCellHeight: 7.6 + 3.4 * most } } : right(txt); };
      return [[tickCell(e), amtCell('life', has ? A(tt.life.lump) : '-'), amtCell('sev', has ? A(tt.sev.lump) : '-'), amtCell('lsd', has ? A(tt.lsd.lump) : '-'), amtCell('ip', has ? PM(tt.ip.monthly) : '-'), right(w || '-'), right(AC(e.item)), right(PC(e.item.abi)), right(A(e.item.premium))]].concat(noteRows(e));
    }).reduce(function (a, b) { return a.concat(b); }, []);
    var tot = function (label, tt, prem, fill) { var f = function (s) { return right(s, { fontStyle: 'bold', fillColor: fill }); }; return [{ content: t(label), styles: { halign: 'left', fontStyle: 'bold', fillColor: fill } }, f(A(tt.life.lump)), f(A(tt.sev.lump)), f(A(tt.lsd.lump)), f(PM(tt.ip.monthly)), f(''), f(''), f(''), f(A(prem))]; };
    if (pt.count.wr) rows.push(tot('Total: policies where we are the broker', pt.wr, pt.premium.wr, BLUE)); if (pt.count.other) rows.push(tot('Total: other brokers', pt.other, pt.premium.other, BLUE));
    rows.push(tot('Grand total (all policies)', pt.all, pt.premium.all, ORANGE));
    y = table(doc, y, { head: [['Policy', 'Life cover', 'Severe illness', 'Lump sum disability' + age, 'Income protector / sickness benefit' + age, 'Waiting period', 'ACI', 'ABI', 'Premium']], colw: [48, 32, 32, 32, 34, 19, 24, 14, 38], align: ['left'], body: rows, draw: drawOv });
    ps.forEach(function (e) {
      var lines = calc.activeLines(e.item); if (!lines.length || (lines.length === 1 && lines[0].type === 'other' && !e.item.wr)) return;
      setText(doc, DEEP, FS.sub, true); doc.text(t((e.item.insurer || 'Policy') + (e.item.policyNo ? '   ' + e.item.policyNo : '') + (e.item.product ? '   ' + e.item.product : '')), M, y + 10);
      y = linesTable(doc, y + 12, e.item, true, e.item.ipAge || state.header.disabilityAge);
      if (e.item.cmp) y = cmpTable(doc, y + 4, e.item);                                                // a BrightRock policy whose pay-out guide is on file shows it under its lines
    });
    return y;
  }
  function groupPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), items = calc.groupItems(state), pi = calc.personalInvestments(state), gt = calc.groupTotals(state), prem = 0, age = state.header.disabilityAge ? '\nAge ' + state.header.disabilityAge : '';
    var cell = function (g, p) { var c = g[p]; if (!c || !calc.isNum(c.amount)) return right(c && c.amount === 'Not found' ? 'Not found' : '-'); return right((p === 'ip' ? PM(c.amount) : A(c.amount)) + (c.endAge != null && c.endAge !== '' ? '\n' + (/^\d+$/.test(String(c.endAge)) ? 'To age ' + c.endAge : c.endAge) : '')); };
    var red = function (text) { setText(doc, RED, 11, true); doc.text(t(text), M, y + 5); y += 11; };
    if (!items.length) red('There are no group benefits in place.');
    if (!items.length && !pi.count) { red('There are no personal investments in place.'); return y; }
    var rows = items.map(function (g) {
      var p2 = g.kind === 'risk' ? g.monthlyCost : (calc.isNum(g.employer) || calc.isNum(g.employee) ? calc.r2((g.employer || 0) + (g.employee || 0)) : g.contribTotal); if (calc.isNum(p2)) prem = calc.r2(prem + p2);
      var label = (schema.GROUP_KINDS[g.kind] || g.kind) + '   ' + (g.provider || '');
      if (g.kind === 'risk') return [{ content: t(label + (g.statementDate ? '\nStatement ' + g.statementDate : (g.src && g.src.kind === 'astute' ? '\nAstute ' + (g.src.date || '') : '')) + (g.paidBy ? '  |  paid by ' + g.paidBy : '')), styles: { halign: 'left', fontStyle: 'bold' } }, cell(g, 'life'), cell(g, 'sev'), cell(g, 'lsd'), cell(g, 'ip'), right(g.ipWaiting || '-'), right(PC(g.aci)), right(PC(g.abi)), right(A(p2))];
      return [{ content: t(label + '\n' + (calc.isNum(g.value) ? 'Fund value ' + A(g.value) + '  |  ' : '') + (calc.isNum(g.employer) || calc.isNum(g.employee) ? 'employer ' + A(g.employer || 0) + ', employee ' + A(g.employee || 0) : 'POI needed')), styles: { halign: 'left', fontStyle: 'bold' } }, right('-'), right('-'), right('-'), right('-'), right('N/A'), right(PC(g.aci)), right('N/A'), right(A(p2))];
    });
    prem = calc.r2(prem + pi.monthly);
    if (pi.count) rows.push([{ content: t('Personal investments\nThe total of the current investments (block 8)'), styles: { halign: 'left', fontStyle: 'bold' } }, right(A(pi.gross)), right(''), right(''), right(''), right('N/A'), right('N/A'), right('N/A'), right(A(pi.monthly))]);
    var f = function (s2) { return right(s2, { fontStyle: 'bold', fillColor: ORANGE }); };
    rows.push([{ content: 'Total', styles: { halign: 'left', fontStyle: 'bold', fillColor: ORANGE } }, f(A(calc.r2(gt.life + pi.gross))), f(A(gt.sev)), f(A(gt.lsd)), f(PM(gt.ip)), f(''), f(''), f(''), f(A(prem))]);
    y = table(doc, y, { head: [['Item', 'Life cover', 'Severe illness', 'Lump sum disability' + age, 'Income protector / sickness benefit' + age, 'Waiting period', 'ACI', 'ABI', 'Total monthly premium']], colw: [66, 30, 28, 30, 32, 20, 14, 14, 39], align: ['left'], body: rows });
    if (!pi.count) { y += 3; red('There are no personal investments in place.'); }
    return y;
  }
  function shortfallPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), s = calc.shortfall(state);
    if (!s.has) return empty(doc, y, 'There is no FNA quote yet, so the shortfall cannot be worked out.');
    var rows = [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector (R p.m.)']].map(function (r) {
      var pi = r[0] === 'life' ? s.pi.gross : 0;
      return [{ content: r[1], styles: { halign: 'left', fontStyle: 'bold' } }, right(A(s.fna[r[0]])), right(s.group[r[0]] ? A(s.group[r[0]]) : 'none'), right(pi ? A(pi) : 'none'), right(A(s.short[r[0]]), { fontStyle: 'bold', fillColor: ORANGE })];
    });
    y = table(doc, y, { head: [['', 'FNA', 'Less group benefits', 'Less personal investments', 'Shortfall']], colw: [63, 52, 52, 52, 54], align: ['left'], body: rows });
    return note(doc, y + 1, 'The FNA assumes you have nothing in place. The shortfall takes off what you already have through your group benefits and your personal investments (your retirement annuities and other investments count towards the life cover shortfall).');
  }
  function investmentsPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), items = calc.investments(state), pi = calc.personalInvestments(state);
    if (!items.length) return empty(doc, y, 'There are no current investments in place.');
    var rows = items.map(function (i) {
      var vs = i.valueSource || {}, src = vs.kind ? (vs.kind === 'astute' ? 'Astute report' : 'Investment schedule') + (vs.date ? '\n' + vs.date : '') : '-';
      return [{ content: t((i.provider || 'Investment') + '\n' + (i.product || '')), ov: { tick: !!i.wr }, styles: { halign: 'left', fontStyle: 'bold', cellPadding: { top: 2, bottom: 2, left: 9, right: 2 } } }, center(i.valueDate || '-'), center(src), right(A(i.gross)), right(A(i.penalty)),
        right(calc.isNum(i.gross) ? A(calc.r2(i.gross - (calc.isNum(i.penalty) ? i.penalty : 0))) : '-'), right(PC(i.returnRate)), right(PC(i.aci)), right(A(i.monthly))];
    });
    var f = function (s) { return right(s, { fontStyle: 'bold', fillColor: ORANGE }); };
    rows.push([{ content: 'Total investments', styles: { halign: 'left', fontStyle: 'bold', fillColor: ORANGE } }, f(''), f(''), f(A(pi.gross)), f(A(pi.penalty)), f(A(pi.net)), f(''), f(''), f(A(pi.monthly))]);
    return table(doc, y, { head: [['Investment', 'Values at', 'Source', 'Gross fund value', 'Penalties', 'Net fund value', 'Rate of return', 'ACI', 'Premium']], colw: [56, 24, 40, 30, 26, 30, 20, 17, 30], align: ['left'], body: rows, draw: drawOv });
  }
  function proposedPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), items = calc.active(state.blocks.proposed.items);
    if (!items.length) return empty(doc, y, 'No proposed investments.');
    return table(doc, y, { head: [['Investment type', 'Provider & quote', 'Contribution', 'Lump sum', 'Monthly premium', 'Boost', 'Net amount invested', 'ACI']], colw: [44, 52, 36, 28, 28, 20, 38, 27], align: ['left', 'left', 'left'],
      body: items.map(function (i) { return [{ content: t(i.type), styles: { halign: 'left', fontStyle: 'bold' } }, { content: t([i.provider, i.quote ? 'Quote ' + i.quote : ''].filter(Boolean).join('   ')), styles: { halign: 'left' } }, { content: t(schema.contributionLabel[i.contribution] || ''), styles: { halign: 'left' } }, right(A(i.lump)), right(A(i.monthly)), right(PC(i.boostPct)), right(A(i.netInvested)), right(PC(i.aci))]; }) });
  }
  function goalsPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title), items = calc.active(state.blocks.goals.items);
    if (!items.length) return empty(doc, y, 'No goal analysis reports.');
    return table(doc, y, { head: [['Report', 'Requested', 'Note', 'Current value (R p.m. gross)', 'Future value (R p.m. gross)', 'ACI', 'Premium']], colw: [80, 28, 60, 30, 30, 15, 30], align: ['left', 'center', 'left'],
      body: items.map(function (i) { return [{ content: t(i.kind === 'rgar' ? 'Retirement Goal Analysis Report (RGAR)' : 'Education Goal Analysis Report (EGAR)'), styles: { halign: 'left', fontStyle: 'bold' } }, center(i.requested ? 'Yes' : 'No'), { content: t(i.note || ''), styles: { halign: 'left' } }, right(A(i.currentValuePm)), right(A(i.futureValuePm)), right(PC(i.aci)), right(A(i.premium))]; }) });
  }
  function otherPage(doc, state, b) {
    var y = pageTitle(doc, b.n + '. ' + b.title);
    return table(doc, y, { head: [['Item', 'Company & product', 'Policy number', 'Broker', 'Premium', 'Notes']], colw: [50, 70, 40, 24, 30, 59], align: ['left', 'left', 'left', 'center'], draw: drawOv,
      body: state.blocks.other.items.filter(function (i) { return !i.removed; }).map(function (i) {
        var nm = (schema.OTHER_KEYS.filter(function (k) { return k.key === i.key; })[0] || { l: i.key }).l;
        return [{ content: t(nm), styles: { halign: 'left', fontStyle: 'bold' } }, { content: t([i.company, i.product].filter(Boolean).join('   ') || '-'), styles: { halign: 'left' } }, { content: t(i.policyNo || '-'), styles: { halign: 'left' } }, (i.company || i.product || i.note ? { content: '', ov: { tick: !!i.wr, center: true } } : center('-')), right(A(i.premium)), { content: t(i.note || ''), styles: { halign: 'left' } }];
      }) });
  }
  var PAGES = { policies: policiesPage, fna: quotesPage, group: groupPage, shortfall: shortfallPage, shortfallQuote: quotesPage, reduced: quotesPage, comparative: quotesPage, investments: investmentsPage, proposed: proposedPage, goals: goalsPage, other: otherPage };

  /* One page, drawn on a page of height H. Returns how far down the content reached (so the page can be made exactly that tall). */
  function drawPage(doc, state, id, H, measuring, pages) {
    if (id === 'cover') return cover(doc, state, H, measuring, pages);
    var b = schema.blocksById[id];
    tabRow(doc, b.n, pages, measuring);
    return PAGES[id](doc, state, b);
  }
  /* The pages there are: the cover and every block whose page has something to say (ov-calc.js pageShown); no[i] is the page number of tab i, 0 for a page that is left out. */
  function pagesOf(state) {
    var ids = ['cover'].concat(schema.BLOCKS.filter(function (b) { return calc.pageShown(state, b.id); }).map(function (b) { return b.id; })), no = [], all = ['cover'].concat(schema.BLOCKS.map(function (b) { return b.id; }));
    all.forEach(function (id) { no.push(ids.indexOf(id) + 1); });
    return { ids: ids, no: no };
  }
  function build(state) {
    var jsPDF = window.jspdf.jsPDF, pages = pagesOf(state), ids = pages.ids, orient = function (h) { return h > W ? 'portrait' : 'landscape'; };
    var heights = ids.map(function (id) {
      if (id === 'cover') return MIN_H;
      var scratch = new jsPDF({ unit: 'mm', format: [W, 4000], orientation: 'portrait' });
      return Math.max(MIN_H, Math.ceil(drawPage(scratch, state, id, 4000, true, pages) + M));
    });
    var doc = new jsPDF({ unit: 'mm', format: [W, heights[0]], orientation: orient(heights[0]) });
    ids.forEach(function (id, i) { if (i) doc.addPage([W, heights[i]], orient(heights[i])); drawPage(doc, state, id, heights[i], false, pages); });
    if (doc.setDisplayMode) doc.setDisplayMode('fullpage', 'single');
    if (doc.setProperties) doc.setProperties({ title: schema.fileName(state), subject: 'Client Overview', author: 'Wealth Revolution' });
    return doc;
  }
  OV.pdf = { build: build, pagesOf: pagesOf, TABS: TABS, W: W, MIN_H: MIN_H };
})();
