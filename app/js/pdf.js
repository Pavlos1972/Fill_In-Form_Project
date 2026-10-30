/* Builds the Fact Find PDF from the saved answers, using the Wealth Revolution look.
   The PDF is generated, not filled into an old form, so lists grow onto extra pages as needed. */
(function () {
  var FF = window.FF, util = FF.util, schema = FF.schema, calc = FF.calc, store = FF.store;

  /* Colours taken from the Wealth Revolution logo: its blue (#27A8E0) and grey. DEEP is a darker blue for small text so it stays readable. */
  var ACCENT = [39, 168, 224], DEEP = [18, 118, 168], ACCENT_SOFT = [225, 243, 251], INK = [40, 40, 42], MUTED = [110, 110, 113], LINE = [205, 222, 232], PALE = [243, 249, 252];
  var GO = [31, 122, 66], STOP = [179, 38, 30], GO_SOFT = [226, 242, 231], STOP_SOFT = [250, 229, 226], MAYBE = [150, 110, 0], MAYBE_SOFT = [253, 243, 205];            // a priority area that is wanted, one that is not, and one the client is thinking about
  var M = 14, W = 210, PAGE_H = 297, CW = W - 2 * M;

  /* Standard PDF fonts cannot show every character. Keep to what they can. */
  function t(s) {
    return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—‐‑‒−]/g, '-').replace(/[\xa0\u2002\u2003\u2009\u200a\u202f]/g, ' ').replace(/[\u200b\u200c\u200d\ufeff]/g, '')
      .replace(/…/g, '...').replace(/[•‣◦⁃▪●]/g, '-').replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~')   // symbols the PDF's font has no shape for, as the plain text they stand for
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa1-\xff]/g, '?');
  }
  function fieldValue(f, state, ctx) { return f.preset === '?' && String(state.f[f.id].v).trim() === '?' ? '' : f.calc ? calc.field(f.calc, ctx) : (f.money ? util.formatMoney(state.f[f.id].v) : (f.t === 'multi' && !f.nona && !state.f[f.id].v ? '(not asked yet)' : state.f[f.id].v)); }

  /* label/value pairs two to a row; wide boxes (notes) take a full row */
  function fieldRows(items) {
    var rows = [], pending = null;
    function flush() { if (pending) { rows.push([pending[0], pending[1], '', '']); pending = null; } }
    items.forEach(function (it) {
      if (it.wide) { flush(); rows.push([it.label, { content: it.value, colSpan: 3 }]); return; }
      if (pending) { rows.push([pending[0], pending[1], it.label, it.value]); pending = null; } else pending = [it.label, it.value];
    });
    flush();
    return rows;
  }
  var GRID = {
    theme: 'grid', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, lineColor: LINE, lineWidth: 0.2, textColor: INK, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: ACCENT_SOFT, textColor: DEEP, fontStyle: 'bold', fontSize: 8.5, lineColor: LINE }
  };
  var PAIR_COLS = { 0: { cellWidth: 37, textColor: MUTED, fillColor: PALE, fontSize: 8 }, 1: { cellWidth: 54 }, 2: { cellWidth: 37, textColor: MUTED, fillColor: PALE, fontSize: 8 }, 3: { cellWidth: 54 } };

  function build(state) {
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var ctx = store.ctxFor(state), name = store.clientName(state) || 'New client', y = 0, firstAdvisor = true;

    function ensure(h) { if (y + h > PAGE_H - 18) { doc.addPage(); y = 22; } }
    function after() { y = doc.lastAutoTable.finalY + 4; }
    function table(opts) {
      doc.autoTable(Object.assign({ startY: y, margin: { left: M, right: M, top: 22, bottom: 18 }, rowPageBreak: 'avoid' }, GRID, opts));
      after();
    }
    /* ----- first page header ----- */
    var logo = FF.logo, lw = 46, lh = lw * logo.h / logo.w;
    doc.addImage(logo.data, 'PNG', M, 8, lw, lh);
    doc.setDrawColor.apply(doc, ACCENT); doc.setLineWidth(0.6); doc.line(M, 8 + lh + 3, W - M, 8 + lh + 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor.apply(doc, INK); var ty = 8 + lh + 12; doc.text('CLIENT FACT FIND', M, ty);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
    doc.text(t(name), W - M, ty - 4, { align: 'right' });
    doc.text('Completed ' + t(state.f.date.v) + '  |  Advisor ' + t(schema.advisor), W - M, ty + 1, { align: 'right' });
    y = ty + 8;

    function sectionHeading(title) {
      ensure(52);
      doc.setFillColor.apply(doc, ACCENT); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255); doc.text(t(title.toUpperCase()), M + 2.5, y + 4.9);
      y += 10;
    }
    function blockTitle(title) {
      ensure(34);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, DEEP); doc.text(t(title), M, y + 3);
      y += 5;
    }
    function fieldsTable(fields, head, sideBySide) {
      var items = fields.filter(function (f) { return !f.nopdf && calc.showIf(f.cond, ctx); }).map(function (f) { return { label: t(f.sl || f.l), value: t(fieldValue(f, state, ctx)), wide: (f.t === 'area' || f.wide) && !(sideBySide && f.t === 'area') }; });
      var rows = fieldRows(items); ensure(Math.min(rows.length * 7 + 4, 95));
      table({ body: rows, columnStyles: PAIR_COLS, head: head || undefined });
    }
    function listBlock(key) {
      var L = schema.lists[key], rows = state.l[key];
      if (!rows.length) { table({ body: [[{ content: 'None recorded.', styles: { textColor: MUTED, fontStyle: 'italic' } }]], columnStyles: { 0: { cellWidth: CW } } }); return; }
      function cellText(c, r) { return t(c.calc ? calc.rowCalc(c.calc, r, ctx) : (c.money ? util.formatMoney(r.d[c.k]) : r.d[c.k])); }
      function totals() {
        return Object.keys(L.sum).map(function (k) { return [t(L.sum[k]), util.money(rows.reduce(function (a, r) { return a + util.num(r.d[k]); }, 0))]; });
      }
      if (L.cards) {
        rows.forEach(function (r, i) {
          var items = L.cols.map(function (c) { return { label: t(c.l.replace(/ \(from date of birth\)/, '')), value: cellText(c, r), wide: !!c.wide }; });
          ensure(40);
          table({ head: [[{ content: L.cards + ' ' + (i + 1), colSpan: 4 }]], body: fieldRows(items), columnStyles: PAIR_COLS });
          y -= 2;
        });
        var tt = totals();
        if (tt.length) {
          var items2 = tt.map(function (x) { return { label: x[0], value: x[1] }; });
          table({ body: fieldRows(items2).map(function (row) { return row.map(function (c, ix) { return ix % 2 === 1 && c !== '' ? { content: c.content || c, styles: { fontStyle: 'bold' } } : c; }); }), columnStyles: PAIR_COLS });
        }
      } else {
        var body = rows.map(function (r) { return L.cols.map(function (c) { return { content: cellText(c, r), styles: c.num ? { halign: 'right' } : {} }; }); });
        var foot = null;
        if (Object.keys(L.sum).length) foot = [L.cols.map(function (c, ix) { return { content: L.sum[c.k] ? util.money(rows.reduce(function (a, r) { return a + util.num(r.d[c.k]); }, 0)) : (ix === 0 ? 'Total' : ''), styles: { halign: c.num ? 'right' : 'left' } }; })];
        table({ head: [L.cols.map(function (c) { return { content: t(c.l), styles: c.num ? { halign: 'right' } : {} }; })], body: body, foot: foot || undefined, footStyles: { fillColor: PALE, textColor: INK, fontStyle: 'bold' } });
      }
    }

    /* Income protection (fractured cover): age and insured amount, the instalment protector (a line for each debt with an instalment and whether it is protected, then the total of those that are), household needs, then the other boxes. */
    function protectorPdf(b) {
      var f = {}; b.fields.forEach(function (x) { f[x.id] = x; });
      var sp = calc.ipSplit(ctx), R = { halign: 'right' };
      fieldsTable([f.ip_age, f.ip_amt]);
      var body = sp.rows.map(function (r) {
        return [t(r.label + (r.prov ? ' (' + r.prov + ')' : '')), { content: r.on ? 'Protected' : 'Not protected', styles: r.on ? {} : { textColor: MUTED, fontStyle: 'italic' } }, { content: t(util.money(r.inst) + ' p.m.'), styles: r.on ? R : { halign: 'right', textColor: MUTED } }];
      });
      body.push([{ content: 'Total instalments protected', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: t(util.money(sp.total) + ' p.m.'), styles: { halign: 'right', fontStyle: 'bold' } }]);
      if (sp.all > sp.total) body.push([{ content: 'Not protected (switched off)', colSpan: 2, styles: { textColor: MUTED } }, { content: t(util.money(sp.all - sp.total) + ' p.m.'), styles: { halign: 'right', textColor: MUTED } }]);
      if (sp.elsewhere) body.push([{ content: 'Paid by someone else, left out (' + sp.elsewhere + (sp.elsewhere === 1 ? ' debt' : ' debts') + ')', colSpan: 2, styles: { textColor: MUTED } }, { content: t(util.money(sp.elsewhereTotal) + ' p.m.'), styles: { halign: 'right', textColor: MUTED } }]);
      noteText('Instalment protector: ' + (!sp.count ? 'no debt with an instalment recorded.' : sp.on === sp.count ? 'all debts protected.' : sp.on === 0 ? 'no debt protected.' : sp.on + ' of ' + sp.count + ' debts protected.'));
      ensure(Math.min(body.length * 7 + 12, 60));
      table({ head: [[{ content: 'Instalment Protector' }, { content: 'Protected' }, { content: 'Instalment (R p.m.)', styles: R }]], body: sp.rows.length ? body : [[{ content: 'No debt with an instalment recorded.', colSpan: 3, styles: { textColor: MUTED, fontStyle: 'italic' } }]], columnStyles: { 0: { cellWidth: CW - 90 }, 1: { cellWidth: 40 }, 2: { cellWidth: 50 } } });
      fieldsTable([f.ip_hh]);
      fieldsTable(b.fields.filter(function (x) { return !/^ip_(?:age|amt|hh)$/.test(x.id); }));
    }
    /* A note shown on the screen (the guidance under a heading) is printed too, small and in italics. */
    function noteText(text) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor.apply(doc, MUTED);
      var lines = doc.splitTextToSize(t(text), CW); ensure(lines.length * 3.5 + 6);
      doc.text(lines, M, y + 3); y += lines.length * 3.5 + 3;
    }
    function lanePrefix(b) { return b.lane ? (b.lane === 'br' ? 'BrightRock Fractured: ' : 'Standard: ') : ''; }
    function blockPdf(b, sec, notitle) {
      if (b.strip) {                                                                 // the top of the BrightRock Risk Calculation page: what was asked for
        var asked = FF.actions.brightRockAsked(state);
        table({ body: [[{ content: 'Asked for on Client priorities and quotes needed', styles: { textColor: DEEP, fontStyle: 'bold', fillColor: ACCENT_SOFT } }, { content: t(asked.length ? 'BrightRock Fractured: ' + asked.join(', ') : 'No BrightRock Fractured quote asked for yet.'), styles: { fillColor: ACCENT_SOFT } }]], columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: CW - 62 } } });
        return;
      }
      if (!calc.showIf(b.cond, ctx)) { if (b.pdfMsg && b.condMsg && !calc.showIf('own' in b ? b.own : b.cond, ctx)) { if (b.title) blockTitle(b.title); table({ body: [[{ content: t(b.condMsg), styles: { fontStyle: 'italic', textColor: MUTED } }]] }); } return; }    // a block that does not apply says so when it asks to
      if (b.fields && b.fields.length && b.fields.every(function (f) { return f.nopdf; })) return;     // a block of boxes that are left off the PDF has no heading either
      if (b.title && !notitle) blockTitle(lanePrefix(b) + b.title);                                // a life quote says which kind it is
      if (b.help) noteText(b.help);
      if (b.protector) protectorPdf(b); else if (b.fields) fieldsTable(b.fields);
      if (b.list) { if (!b.title && !notitle && schema.lists[b.list].title !== sec.title) blockTitle(schema.lists[b.list].title); listBlock(b.list); }
    }
    /* Two blocks side by side (Medical aid and Gap cover): each a column of label and value. */
    function halvesPdf(blocks) {
      var gap = 4, w = (CW - gap) / 2, tops = [], i;
      var heights = blocks.map(function (b) { return (b.fields || []).length * 7 + 14; });
      ensure(Math.min(Math.max.apply(null, heights), 90));
      var top = y;
      blocks.forEach(function (b, k) {
        var x = M + k * (w + gap);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, DEEP); doc.text(t(b.title), x, top + 3);
        var rows = (b.fields || []).filter(function (f) { return !f.nopdf && calc.showIf(f.cond, ctx); }).map(function (f) { return [t(f.sl || f.l), t(fieldValue(f, state, ctx))]; });
        doc.autoTable(Object.assign({ startY: top + 5, margin: { left: x, right: W - x - w, top: 22, bottom: 18 }, tableWidth: w, rowPageBreak: 'avoid', body: rows, columnStyles: { 0: { cellWidth: 30, textColor: MUTED, fillColor: PALE, fontSize: 8 }, 1: { cellWidth: w - 30 } } }, GRID));
        tops.push(doc.lastAutoTable.finalY);
      });
      y = Math.max.apply(null, tops) + 4;
    }
    /* The Life area's two kinds of quote, side by side, the same three rows (FNA, Shortfall, Reduced) in each, as on the screen. */
    function lanesPdf(blocks) {
      var pick = function (lane, row) { return blocks.filter(function (b) { return b.lane === lane && b.row === row; })[0]; };
      var gone = function (x) { return x && x.condMsg && !calc.showIf(x.cond, ctx) && !calc.showIf('own' in x ? x.own : x.cond, ctx); };
      function cell(b) {
        if (b.list) {
          var L = schema.lists[b.list], rows = state.l[b.list];
          if (!rows.length) return 'None recorded.';
          return rows.map(function (r, i) { return L.cards + ' ' + (i + 1) + ': ' + L.cols.map(function (c) { var v = c.money ? util.formatMoney(r.d[c.k]) : r.d[c.k]; return v ? (c.k === 'ins' ? 'Insurer ' : '') + v + (c.k === 'amt' ? ' p.m.' : '') : ''; }).filter(Boolean).join(', '); }).join('\n');
        }
        return b.fields.filter(function (f) { return calc.showIf(f.cond, ctx); }).map(function (f, i) { var v = fieldValue(f, state, ctx); return i === 0 ? v : (v || '') && (f.sl || f.l) + ': ' + v; }).filter(function (x) { return x !== '' && x != null; }).join('\n');
      }
      var body = ['fna', 'sf', 'red'].map(function (row) {
        var a = pick('br', row), b = pick('std', row), name = { fna: 'FNA quote', sf: 'Shortfall quote', red: 'Reduced quotes' }[row];
        if (gone(a) && gone(b)) return [{ content: name, styles: { fontStyle: 'bold' } }, { content: t(a.condMsg), colSpan: 2, styles: { fontStyle: 'italic', textColor: MUTED } }];
        return [{ content: name, styles: { fontStyle: 'bold' } }, t(cell(a)), t(cell(b))];
      });
      var head = [[{ content: '', styles: { fillColor: PALE } }, { content: 'BrightRock: Fractured\nbuilt on the BrightRock Risk Calculation page', styles: { fillColor: ACCENT_SOFT, textColor: DEEP } }, { content: 'Standard\nevery other insurer (BrightRock too, when it is a standard quote)', styles: { fillColor: PALE, textColor: INK } }]];
      var colW = (CW - 28) / 2;
      ensure(50);
      table({ head: head, body: body, headStyles: { fontStyle: 'bold', fontSize: 8.5, lineColor: LINE, valign: 'top' }, columnStyles: { 0: { cellWidth: 28, textColor: MUTED, fillColor: PALE, fontSize: 8 }, 1: { cellWidth: colW }, 2: { cellWidth: colW } } });
    }
    /* What to ask for in a standard quote: one table, a row for each cover, as on the screen. */
    function sqdPdf(blocks) {
      var join = function (ids) { return ids.map(function (id) { return fieldValue(schema.fieldsById[id], state, ctx); }).filter(Boolean).join(' / '); };
      var body = blocks.map(function (b) {
        var m = b.sq;
        return [{ content: t(m.name), styles: { fontStyle: 'bold' } }, t(fieldValue(schema.fieldsById[m.amt], state, ctx)), t(join(m.term)), t(join(m.aci)), t(fieldValue(schema.fieldsById[m.abi], state, ctx)), t(m.wait ? fieldValue(schema.fieldsById[m.wait], state, ctx) : '-'), t(fieldValue(schema.fieldsById[m.cmt], state, ctx))];
      });
      blockTitle('Standard quote details: what to quote');
      table({ head: [['Cover', 'Amount (R)', 'Term / age', 'ACI', 'ABI', 'Waiting', 'Comments']], body: body, columnStyles: { 0: { cellWidth: 38, textColor: MUTED, fillColor: PALE, fontSize: 8 } } });
    }
    /* One area of the Client priorities and quotes needed page, as on the screen: its name and what the client decided, the decision and comments boxes (with a short area's referral or request in the same row),
       what the client has (the summary), then its quotes and referrals. Business assurance is one line until the client is a business owner. */
    function panelPdf(sec, id) {
      var P = schema.panelsById[id], applies = calc.showIf(P.cond, ctx);
      var v = P.dec ? state.f[P.dec].v : '', on = v === schema.PRIORITY, off = v === schema.NOT_PRIORITY, maybe = v === schema.UNSURE || v === schema.BUDGET;
      ensure(applies ? 46 : 20);
      doc.setFillColor.apply(doc, on ? GO_SOFT : off ? STOP_SOFT : maybe ? MAYBE_SOFT : PALE); doc.rect(M, y, CW, 7, 'F');
      doc.setDrawColor.apply(doc, on ? GO : off ? STOP : maybe ? MAYBE : LINE); doc.setLineWidth(0.4); doc.line(M, y + 7, M + CW, y + 7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK); doc.text(t(P.title), M + 2.5, y + 4.9);
      var tw = doc.getTextWidth(t(P.title));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, MUTED); doc.text(t(P.sub), M + 2.5 + tw + 3, y + 4.9);
      if (P.dec) { doc.setFontSize(8.5); doc.setTextColor.apply(doc, on ? GO : off ? STOP : maybe ? MAYBE : MUTED); doc.text(t(v || 'Not yet discussed'), M + CW - 2.5, y + 4.9, { align: 'right' }); }
      else { doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED); doc.text(applies ? 'Business owner' : 'Not applicable', M + CW - 2.5, y + 4.9, { align: 'right' }); }      // business assurance: no decision box, so what the client is
      y += 10;
      if (!applies) { noteText(P.condMsg); return; }
      var blocks = sec.blocks.filter(function (b) { return b.pri === id; }), head = blocks.filter(function (b) { return b.head; })[0], rest = blocks.filter(function (b) { return !b.head; });
      if (head) {
        var fields = head.fields.slice();
        if (P.inline) { var inl = []; rest.forEach(function (b) { if (calc.showIf(b.cond, ctx)) inl = inl.concat(b.fields || []); }); fields = [head.fields[0]].concat(inl, [head.fields[1]]); }      // decision, referral or request, comments
        fieldsTable(fields, null, !P.inline);                                                      // the decision and the comments side by side, as on the screen
      }
      if (off) noteText('The client said this is not a priority. The quote boxes are switched off.');
      if (P.sum) {
        var lines = FF.summary.linesFor(state, id).lines;
        if (lines.length) table({ head: [[{ content: 'Summary' }]], body: lines.map(function (l) { return ['- ' + t(l)]; }), columnStyles: { 0: { cellWidth: CW } } });
      }
      if (P.inline) return;
      var doneL = false, doneS = false;
      rest.forEach(function (b) {
        if (b.lane) { if (!doneL) { doneL = true; if (!off) lanesPdf(rest.filter(function (x) { return x.lane; })); } return; }
        if (b.sqd) { if (!doneS) { doneS = true; if (!off) sqdPdf(rest.filter(function (x) { return x.sqd; })); } return; }
        blockPdf(b, sec, rest.length === 1);
      });
      y += 2;
    }
    schema.sections.forEach(function (sec) {
      if (!calc.showIf(sec.cond, ctx)) return;
      if (sec.adv && firstAdvisor) { firstAdvisor = false; doc.addPage(); y = 22; }                  // the pages after the client's answers start on a new page
      sectionHeading(sec.title);
      if (sec.intro) noteText(sec.intro);
      var done = {}, pair = [];
      var flush = function () { if (pair.length) { halvesPdf(pair); pair = []; } };                  // blocks marked half sit two to a row
      sec.blocks.forEach(function (b) {
        if (b.pri) { flush(); if (!done[b.pri]) { done[b.pri] = 1; panelPdf(sec, b.pri); } return; }
        if (b.half) { pair.push(b); return; }
        flush(); blockPdf(b, sec);
      });
      flush();
      y += 2;
    });

    /* ----- footer on every page ----- */
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      if (p > 1) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, DEEP); doc.text('WEALTH REVOLUTION', M, 10);
        doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, MUTED); doc.text('Client Fact Find - ' + t(name), W - M, 10, { align: 'right' });
        doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.2); doc.line(M, 12, W - M, 12);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('WR Fact Find v' + schema.version + ' - ' + schema.released, M, PAGE_H - 8);
      doc.text('Page ' + p + ' of ' + pages, W - M, PAGE_H - 8, { align: 'right' });
    }
    return doc;
  }
  FF.pdf = { build: build };
})();
