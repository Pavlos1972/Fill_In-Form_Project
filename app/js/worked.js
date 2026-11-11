/* The worked-out figures that go into the saved file (.json) beside the answers, under the top-level key "worked", exactly as the PDF prints them.
   The form works these out on screen and prints them; they are not answers, so they are never kept in "f" or "l" and never read back when a file is opened. store.toJSON asks for a fresh block each time it writes a file
   (on a copy of the state, so the form's own answers never hold it). A program that reads the file can use the block instead of working the sums out again.
   The block holds only what the PDF prints: a box or block that is switched off or hidden is left out, as in the PDF. Strings are the PDF's own (util.money and the same calc.js sums). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./tax.js'), require('./schema.js'), require('./calc.js'), require('./store.js'), require('./summary.js'));
  else { root.FF = root.FF || {}; root.FF.worked = factory(root.FF.util, root.FF.tax, root.FF.schema, root.FF.calc, root.FF.store, root.FF.summary); }
})(typeof self !== 'undefined' ? self : this, function (util, tax, schema, calc, store, summary) {
  var VERSION = 1;
  var NOTE = 'Worked out by the form when this file was saved, as the PDF prints them. Not answers: the form ignores this block when it opens a file and writes a new one at every save.';

  /* The blocks the PDF prints, in order: a section that does not apply, and a block that does not apply, are not there. */
  function shownBlocks(ctx) {
    var out = [];
    schema.sections.forEach(function (sec) {
      if (!calc.showIf(sec.cond, ctx)) return;
      sec.blocks.forEach(function (b) { if (calc.showIf(b.cond, ctx)) out.push(b); });
    });
    return out;
  }

  /* The instalment protector as the PDF prints it: a line for each debt with an instalment (label with the provider in brackets, protected or not), the total of those protected, household needs. */
  function protector(ctx) {
    var sp = calc.ipSplit(ctx);
    return {
      insured: sp.insured == null ? '' : util.money(sp.insured),
      rows: sp.rows.map(function (r) { return { label: r.label + (r.prov ? ' (' + r.prov + ')' : ''), provider: r.prov, instalment: util.money(r.inst), protected: !!r.on }; }),
      total: util.money(sp.total),
      notProtected: sp.all > sp.total ? util.money(sp.all - sp.total) : '',
      elsewhere: { debts: sp.elsewhere, total: sp.elsewhere ? util.money(sp.elsewhereTotal) : '' },
      householdNeeds: sp.rest == null ? '' : util.money(sp.rest),
      note: 'Instalment protector: ' + (!sp.count ? 'no debt with an instalment recorded.' : sp.on === sp.count ? 'all debts protected.' : sp.on === 0 ? 'no debt protected.' : sp.on + ' of ' + sp.count + ' debts protected.')
    };
  }

  function build(state) {
    var ctx = store.ctxFor(state), blocks = shownBlocks(ctx), out = { note: NOTE, version: VERSION, form: schema.version, at: new Date().toISOString(), taxYear: tax.taxYearFor(calc.meetingDate(ctx)), f: {}, l: {}, totals: { lists: {}, areas: {} } };
    var seenList = {};
    blocks.forEach(function (b) {
      (b.fields || []).forEach(function (f) {
        if (f.calc && !f.nopdf && calc.showIf(f.cond, ctx)) out.f[f.id] = calc.field(f.calc, ctx);
      });
      if (b.protector) out.protector = protector(ctx);
      if (b.list && !seenList[b.list]) {
        seenList[b.list] = 1;
        var L = schema.lists[b.list], rows = state.l[b.list] || [];
        var calcCols = L.cols.filter(function (c) { return c.calc; });
        if (calcCols.length && rows.length) out.l[b.list] = rows.map(function (r) { var o = {}; calcCols.forEach(function (c) { o[c.k] = calc.rowCalc(c.calc, r, ctx); }); return o; });
        if (rows.length && Object.keys(L.sum || {}).length) out.totals.lists[b.list] = Object.keys(L.sum).map(function (k) {
          var c = L.cols.filter(function (x) { return x.k === k; })[0];
          return { col: k, column: c ? c.l : k, label: L.sum[k], value: util.money(rows.reduce(function (a, r) { return a + util.num(r.d[k]); }, 0)) };      // column: the heading the PDF prints over it; label: the total's own name (printed with it for a list shown as cards)
        });
      }
    });
    /* The totals the form adds up for each area of Client priorities (never by Claude): as they go into the summary points. */
    schema.panels.forEach(function (P) {
      if (!P.sum || !P.sum.t) return;
      var data = summary.areaData(state, P.id); if (!data) return;
      var labels = Object.keys(data.totals || {});
      if (labels.length) out.totals.areas[P.id] = labels.map(function (l) { return { label: l, value: data.totals[l] }; });
    });
    return out;
  }

  store.useWorked(build);
  return { build: build, VERSION: VERSION, NOTE: NOTE };
});
