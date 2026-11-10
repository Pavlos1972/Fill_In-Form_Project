/* Builds the Short Risk Application PDF from the answers, in the Wealth Revolution look of the Fact Find PDF.
   It is drawn from the form's own definition (sr-schema.js): a box added there appears here by itself. It is one A4 page when the client has up to two children and two beneficiaries, and grows to a second page after that. */
(function () {
  var FF = window.FF, SR = window.SR, util = FF.util, schema = SR.schema, store = SR.store;

  /* the Fact Find PDF's colours (the logo's blue and grey) */
  var ACCENT = [39, 168, 224], DEEP = [18, 118, 168], ACCENT_SOFT = [225, 243, 251], INK = [40, 40, 42], MUTED = [110, 110, 113], LINE = [205, 222, 232], PALE = [243, 249, 252];
  var M = 14, W = 210, PAGE_H = 297, CW = W - 2 * M, BOTTOM = 12;

  /* Standard PDF fonts cannot show every character. Keep to what they can. */
  function t(s) {
    return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—‐‑‒−]/g, '-').replace(/[\xa0     ]/g, ' ').replace(/[​‌‍﻿]/g, '')
      .replace(/…/g, '...').replace(/[•‣◦⁃▪●]/g, '-').replace(/→/g, '->').replace(/←/g, '<-')
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa1-\xff]/g, '?');
  }
  /* label/value pairs, n to a row (two, or three for a section that says cols: 3); a wide box takes a full row: its question across all but the last column, the answer in the last */
  function fieldRows(items, n) {
    var rows = [], pending = [];
    function flush() {
      if (!pending.length) return;
      var r = []; pending.forEach(function (p) { r.push(p[0], p[1]); });
      while (r.length < 2 * n) r.push('');
      rows.push(r); pending = [];
    }
    items.forEach(function (it) {
      if (it.wide) { flush(); rows.push([{ content: it.label, colSpan: 2 * n - 1, styles: { textColor: MUTED, fillColor: PALE, fontSize: 7.5 } }, it.value]); return; }
      pending.push([it.label, it.value]);
      if (pending.length === n) flush();
    });
    flush();
    return rows;
  }
  var GRID = {
    theme: 'grid', styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 0.9, bottom: 0.9, left: 2, right: 2 }, lineColor: LINE, lineWidth: 0.2, textColor: INK, overflow: 'linebreak', valign: 'middle', minCellHeight: 4.5 },
    headStyles: { fillColor: ACCENT_SOFT, textColor: DEEP, fontStyle: 'bold', fontSize: 8, lineColor: LINE }
  };
  var LABEL = { textColor: MUTED, fillColor: PALE, fontSize: 7.5 };
  var PAIR_COLS = { 0: Object.assign({ cellWidth: 37 }, LABEL), 1: { cellWidth: 54 }, 2: Object.assign({ cellWidth: 37 }, LABEL), 3: { cellWidth: 54 } };
  var TRIPLE_COLS = { 0: Object.assign({ cellWidth: 22 }, LABEL), 1: { cellWidth: 38.67 }, 2: Object.assign({ cellWidth: 22 }, LABEL), 3: { cellWidth: 38.67 }, 4: Object.assign({ cellWidth: 22 }, LABEL), 5: { cellWidth: 38.67 } };

  function build(state) {
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var name = store.clientName(state) || 'New client', y = 0;

    function ensure(h) { if (y + h > PAGE_H - BOTTOM) { doc.addPage(); y = 20; } }
    function after() { y = doc.lastAutoTable.finalY + 2.4; }
    function table(opts) {
      doc.autoTable(Object.assign({ startY: y, margin: { left: M, right: M, top: 20, bottom: BOTTOM }, rowPageBreak: 'avoid' }, GRID, opts));
      after();
    }

    /* ----- header ----- */
    var logo = FF.logo, lw = 32, lh = lw * logo.h / logo.w;
    doc.addImage(logo.data, 'PNG', M, 7, lw, lh);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor.apply(doc, INK); doc.text('SHORT RISK APPLICATION', W - M, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED);
    doc.text('General short application for all insurers', W - M, 16.5, { align: 'right' });
    doc.text(t(name) + '  |  ' + t(state.f.insurer.v || 'Insurer') + '  |  ' + t(state.f.product.v || 'Product type'), W - M, 21, { align: 'right' });
    doc.setDrawColor.apply(doc, ACCENT); doc.setLineWidth(0.6); doc.line(M, 7 + lh + 2, W - M, 7 + lh + 2);
    y = 7 + lh + 5;

    function sectionHeading(title) {
      ensure(18);
      doc.setFillColor.apply(doc, ACCENT); doc.rect(M, y, CW, 4.8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255); doc.text(t(title.toUpperCase()), M + 2.5, y + 3.4);
      y += 5.8;
    }
    function fieldsSection(s) {
      var items = s.fields.filter(function (f) { return store.shown(state, f.id); }).map(function (f) { return { label: t(f.l), value: t(state.f[f.id].v), wide: !!f.wide }; });
      var n = s.cols === 3 ? 3 : 2;
      table({ body: fieldRows(items, n), columnStyles: n === 3 ? TRIPLE_COLS : PAIR_COLS });
    }
    function listSection(key) {
      var L = schema.lists[key], rows = state.l[key], cols = L.cols;
      if (!rows.length) { table({ body: [[{ content: 'None recorded.', styles: { textColor: MUTED, fontStyle: 'italic' } }]], columnStyles: { 0: { cellWidth: CW } } }); return; }
      var head = [['#'].concat(cols.map(function (c) { return t(c.l); }))];
      var body = rows.map(function (r, i) { return [String(i + 1)].concat(cols.map(function (c) { return t(r.d[c.k]); })); });
      var styles = { 0: { cellWidth: 8, halign: 'center', textColor: MUTED } };
      if (cols.length === 2) styles[1] = { cellWidth: 100 };
      var foot;
      if (L.sum) {
        var total = Math.round(rows.reduce(function (a, r) { return a + store.pctNum(r.d[L.sum]); }, 0) * 100) / 100;
        foot = [[{ content: 'Total of the shares', colSpan: cols.length }, total + '%']];
      }
      table({ head: head, body: body, foot: foot, columnStyles: styles, footStyles: { fillColor: ACCENT_SOFT, textColor: DEEP, fontStyle: 'bold', lineColor: LINE } });
    }
    schema.sections.forEach(function (s) {
      sectionHeading(s.title);
      if (s.list) listSection(s.list); else fieldsSection(s);
    });

    /* ----- signature, as on the printed form ----- */
    ensure(9); y += 5.5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, INK);
    doc.text('CLIENT’S SIGNATURE', M, y);
    doc.setDrawColor.apply(doc, MUTED); doc.setLineWidth(0.3); doc.line(M + 40, y + 0.8, M + 115, y + 0.8);
    doc.text('DATE', M + 125, y); doc.setFont('helvetica', 'normal'); doc.text(t(state.f.date.v), M + 138, y - 0.4);
    doc.line(M + 136, y + 0.8, W - M, y + 0.8);

    /* ----- footer on every page ----- */
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      if (p > 1) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, DEEP); doc.text('WEALTH REVOLUTION', M, 10);
        doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, MUTED); doc.text('Short Risk Application - ' + t(name), W - M, 10, { align: 'right' });
        doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.2); doc.line(M, 12, W - M, 12);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('WR Short Risk Application v' + schema.version + ' - ' + schema.released, M, PAGE_H - 8);
      doc.text('Page ' + p + ' of ' + pages, W - M, PAGE_H - 8, { align: 'right' });
    }
    return doc;
  }

  SR.pdf = { build: build };
})();
