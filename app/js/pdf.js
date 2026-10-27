/* Builds the Fact Find PDF from the saved answers, using the Wealth Revolution look.
   The PDF is generated, not filled into an old form, so lists grow onto extra pages as needed. */
(function () {
  var FF = window.FF, util = FF.util, schema = FF.schema, calc = FF.calc, store = FF.store;

  /* Colours taken from the Wealth Revolution logo: its blue (#27A8E0) and grey. DEEP is a darker blue for small text so it stays readable. */
  var ACCENT = [39, 168, 224], DEEP = [18, 118, 168], ACCENT_SOFT = [225, 243, 251], INK = [40, 40, 42], MUTED = [110, 110, 113], LINE = [205, 222, 232], PALE = [243, 249, 252];
  var M = 14, W = 210, PAGE_H = 297, CW = W - 2 * M;

  /* Standard PDF fonts cannot show every character. Keep to what they can. */
  function t(s) {
    return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\xa0/g, ' ').replace(/[^\x09\x0a\x0d\x20-\x7e\xa1-\xff]/g, '?');
  }
  function fieldValue(f, state, ctx) { return f.calc ? calc.field(f.calc, ctx) : (f.money ? util.formatMoney(state.f[f.id].v) : state.f[f.id].v); }

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
    doc.text('Completed ' + t(state.f.date.v) + '  |  Advisor ' + t(state.f.advisor.v), W - M, ty + 1, { align: 'right' });
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
    function fieldsTable(fields, head) {
      var items = fields.filter(function (f) { return !f.nopdf; }).map(function (f) { return { label: t(f.l), value: t(fieldValue(f, state, ctx)), wide: f.t === 'area' || f.wide }; });
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

    schema.sections.forEach(function (sec) {
      if (!calc.showIf(sec.cond, ctx)) return;
      if (sec.adv && firstAdvisor) { firstAdvisor = false; doc.addPage(); y = 22; doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor.apply(doc, INK); doc.text('ADVISOR ACTIONS', M, y + 3); y += 10; }
      sectionHeading(sec.title);
      sec.blocks.forEach(function (b) {
        if (!calc.showIf(b.cond, ctx)) { if (b.pdfMsg && b.condMsg) { if (b.title) blockTitle(b.title); table({ body: [[{ content: t(b.condMsg), styles: { fontStyle: 'italic', textColor: MUTED } }]] }); } return; }    // a block that does not apply says so when it asks to
        if (b.fields && b.fields.length && b.fields.every(function (f) { return f.nopdf; })) return;     // a block of boxes that are left off the PDF has no heading either
        if (b.title) blockTitle(b.title);
        if (b.fields) fieldsTable(b.fields);
        if (b.docs) table({ body: schema.docs.map(function (d) { return [d, state.docs[d] ? 'Requested' : '']; }), columnStyles: { 0: { cellWidth: CW - 40 }, 1: { cellWidth: 40, fontStyle: 'bold', textColor: DEEP } } });
        if (b.list) { if (!b.title && schema.lists[b.list].title !== sec.title) blockTitle(schema.lists[b.list].title); listBlock(b.list); }
      });
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
