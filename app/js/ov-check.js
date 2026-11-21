/* The Client Overview's checks (docs/OVERVIEW-DATA-CONTRACT.md section 10): amber, for Sitamah and Paul only, never printed, never in the way of saving. Also the dot of each block in the left menu
   (green: complete; amber: needs a look; grey: waiting for a document; hollow: nothing to do here). Loads in the browser (window.OV.check) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.check = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  var isNum = calc.isNum, fmtR = calc.fmtR, norm = calc.norm;
  function qLabel(q) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return [q.insurer, { fna: 'FNA', shortfall: 'shortfall quote', reduced: 'reduced quote', comparative: 'quote' }[q.kind], n].filter(Boolean).join(' ');
  }
  function hasFigures(x) { return calc.activeLines(x).some(function (l) { return ['life', 'sev', 'lsd', 'ip'].some(function (p) { var c = l[p]; return c && typeof c === 'object' && Object.keys(c).some(function (k) { return isNum(c[k]) && c[k] !== 0; }); }); }); }

  function run(state) {
    var out = [], tol = (state.settings && state.settings.tolerance) || 1, h = state.header || {}, std = (state.settings && state.settings.standards) || schema.STANDARDS;
    var facts = state.factFind && state.factFind.facts, B = state.blocks;
    function add(id, block, where, message) { out.push({ id: id, severity: 'amber', block: block, where: where, message: message }); }
    var differs = function (a, b) { return isNum(a) && isNum(b) && Math.abs(a - b) > tol; };

    schema.QUOTE_KINDS.forEach(function (kind) {
      var block = schema.blockOfQuote[kind];
      calc.quotes(state, block).forEach(function (q) {
        var where = qLabel(q), t = calc.totals(q), lines = calc.activeLines(q), figures = hasFigures(q);
        if (kind === 'fna' && isNum(h.netIncome) && figures) {
          [['life', t.life.monthly, 'Life cover'], ['lsd', t.lsd.monthly, 'Lump sum disability'], ['ip', t.ip.monthly, 'Income protector']].forEach(function (x) {
            if (differs(x[1], h.netIncome)) add('fna.income', block, where, x[2] + ' protects ' + fmtR(x[1]) + ' a month; the client\'s net income is ' + fmtR(h.netIncome) + '.');
          });
        }
        if (kind !== 'comparative' && facts) {
          var kids = lines.filter(function (l) { return l.type === 'child'; }), ffKids = facts.children || [], seen = {};
          ffKids.forEach(function (c) {
            var nm = norm(c.name + ' ' + c.sname), l = kids.filter(function (x) { return norm((x.name || '') + ' ' + (x.sname || '')) === nm; })[0];
            if (!l) { if (figures || kids.length) add('quote.children', block, where, (c.name + ' ' + c.sname).trim() + ' is in the Fact Find but has no child line in this quote.'); return; }
            seen[l.id] = 1;
            var m = calc.lineVal(l, 'life', 'monthly');
            if (differs(m, c.cost)) add('quote.children', block, where, (c.name + ' ' + c.sname).trim() + ': the quote has ' + fmtR(m) + ' a month; the Fact Find has ' + fmtR(c.cost) + '.');
          });
          kids.forEach(function (l) { if (!seen[l.id] && (l.name || l.sname)) add('quote.children', block, where, 'The quote has a child line for ' + (l.name + ' ' + (l.sname || '')).trim() + ', who is not in the Fact Find.'); });
          var debts = lines.filter(function (l) { return l.type === 'debt'; }), ffDebts = facts.debts || [], used = {};
          ffDebts.forEach(function (d) {
            var keys = [norm(d.desc), norm(d.type), norm(d.prov + ' ' + d.type)].filter(Boolean);
            var l = debts.filter(function (x) { return !used[x.id] && keys.indexOf(norm(x.debt)) >= 0; })[0];
            var label = d.desc || d.type || 'a debt';
            if (!l) { if (figures || debts.length) add('quote.debts', block, where, label + ' is in the Fact Find but has no debt line in this quote.'); return; }
            used[l.id] = 1;
            var m = calc.lineVal(l, 'life', 'monthly');
            if (differs(m, d.inst)) add('quote.debts', block, where, label + ': the quote has an instalment of ' + fmtR(m) + '; the Fact Find has ' + fmtR(d.inst) + '.');
          });
          debts.forEach(function (l) { if (!used[l.id] && l.debt) add('quote.debts', block, where, 'The quote has a debt line "' + l.debt + '" that is not in the Fact Find.'); });
        }
        if (kind === 'shortfall') {
          var sf = calc.shortfall(state);
          if (sf.has && figures) {
            [['life', t.life.lump, sf.short.life, 'Life cover'], ['sev', t.sev.lump, sf.short.sev, 'Severe illness'], ['lsd', t.lsd.lump, sf.short.lsd, 'Lump sum disability'], ['ip', t.ip.monthly, sf.short.ip, 'Income protector']].forEach(function (x) {
              if (differs(x[1], x[2])) add('shortfall.match', block, where, x[3] + ': the quote has ' + fmtR(x[1]) + (x[0] === 'ip' ? ' a month' : '') + '; the form works out a shortfall of ' + fmtR(x[2]) + '.');
            });
          }
        }
        lines.forEach(function (l) {
          var key = (schema.lineTypesById[l.type] || {}).abi;
          if (key && isNum(l.abi) && isNum(std.abi[key]) && l.abi !== std.abi[key]) add('standards', block, where, (l.label || l.type) + ': the annual benefit increase is ' + l.abi + '%; your standard is ' + std.abi[key] + '%.');
        });
        if (isNum(q.aci) && isNum(std.aci) && q.aci !== std.aci && lines.length) add('standards', block, where, 'The annual contribution increase is ' + q.aci + '%; your standard is ' + std.aci + '%.');
        if (q.printedTotals) {
          schema.PILLARS.forEach(function (p) {
            var pt = q.printedTotals[p.id]; if (!pt || typeof pt !== 'object') return;
            p.keys.forEach(function (k) { if (differs(pt[k], t[p.id][k])) add('totals.printed', block, where, 'The document prints ' + fmtR(pt[k]) + ' for ' + p.l.toLowerCase() + (k === 'monthly' ? ' (monthly)' : '') + '; the lines add up to ' + fmtR(t[p.id][k]) + '.'); });
          });
        }
        if (isNum(q.disabilityAge) && isNum(h.disabilityAge) && q.disabilityAge !== h.disabilityAge) add('age', block, where, 'The quote covers disability to age ' + q.disabilityAge + '; the Fact Find says ' + h.disabilityAge + '.');
        if (kind === 'reduced' && isNum(q.premium) && isNum(h.premiumBudget) && q.premium > h.premiumBudget + tol) add('budget', block, where, 'The premium of ' + fmtR(q.premium) + ' is above the client\'s budget of ' + fmtR(h.premiumBudget) + '.');
        if (kind !== 'comparative' && /bright/i.test(q.insurer) && figures && !q.cmp) add('gaps', block, where, 'The change moment pay-out guide is not loaded for this quote.');
        if (q.cmp && q.cmp.number && q.number && norm(q.cmp.number) !== norm(q.number)) add('cmp.match', block, where, 'The change moment pay-out is for CP ' + q.cmp.number + ', not for this quote (CP ' + q.number + ').');
      });
    });

    if (facts) {
      calc.active(B.policies.items).forEach(function (it) {
        if (!it.ffKey) return;
        var r = (facts.risk || []).filter(function (x) { return x.ffKey === it.ffKey; })[0];
        if (!r) { add('ff.missing', 'policies', it.insurer || 'A policy', 'is not in the Fact Find any more.'); return; }
        if (it.st !== 'ff' && it.st !== 'empty' && differs(it.premium, r.spend)) add('doc.vs.factfind', 'policies', it.insurer, 'the document says ' + fmtR(it.premium) + ' a month; the Fact Find has ' + fmtR(r.spend) + ' (the document wins: correct the Fact Find).');
      });
      calc.active(B.group.items).forEach(function (it) {
        if (!it.ffKey) return;
        var list = it.kind === 'risk' ? facts.grp : facts.ret_pp;
        if (!(list || []).some(function (x) { return x.ffKey === it.ffKey; })) add('ff.missing', 'group', it.provider || 'A group item', 'is not in the Fact Find any more.');
      });
      calc.active(B.investments.items).forEach(function (it) {
        if (!it.ffKey) return;
        var r = (facts.ret_ra || []).concat(facts.inv || []).filter(function (x) { return x.ffKey === it.ffKey; })[0];
        if (!r) { add('ff.missing', 'investments', it.provider || 'An investment', 'is not in the Fact Find any more.'); return; }
        if (it.st !== 'ff' && it.st !== 'empty' && differs(it.gross, r.val)) add('doc.vs.factfind', 'investments', it.provider, 'the statement says ' + fmtR(it.gross) + '; the Fact Find has ' + fmtR(r.val) + ' (the statement wins: correct the Fact Find).');
      });
    }
    calc.groupItems(state).forEach(function (g) {
      var where = g.provider || 'Group benefit';
      if (g.kind === 'risk') schema.PILLARS.forEach(function (p) { var c = g[p.id]; if (c && isNum(c.amount) && (c.endAge == null || c.endAge === '')) add('gaps', 'group', where, p.l + ': the age the benefit ends is not filled in (read it from the statement).'); });
      else if (g.st !== 'ff' && g.st !== 'empty' && g.employer == null && g.employee == null) add('gaps', 'group', where, 'The contributions are not filled in: a payslip (POI) is needed.');
    });
    calc.investments(state).forEach(function (i) {
      if (i.st !== 'ff' && i.st !== 'empty' && i.aci == null) add('gaps', 'investments', i.provider || 'An investment', 'The annual contribution increase is not filled in: look for it on the schedule ("Not found" if it is not there).');
    });
    if (state.factFind && state.factFind.changed > 0) add('ff.changed', null, 'Fact Find', 'The Fact Find changed: ' + state.factFind.changed + (state.factFind.changed === 1 ? ' item' : ' items') + ' since it was last read.');

    if (h.previous) {                                                                                   // a review year: what was carried over from last year's overview and still waits for its latest document
      var waiting = 0;
      ['policies', 'group', 'investments', 'goals', 'other'].forEach(function (bid) { calc.active(B[bid].items).forEach(function (it) { if (it.src && it.src.kind === 'previous' && it.st === 'verify') waiting++; }); });
      if (waiting) add('review.carried', 'policies', 'Review of ' + (h.previous.date || 'last year'), waiting + (waiting === 1 ? ' item was' : ' items were') + ' carried over from last year\'s overview and still ' + (waiting === 1 ? 'waits' : 'wait') + ' for the latest schedule or statement (a document replaces it; typing a figure checks it).');
    }
    return { problems: out, dots: dots(state, out), byBlock: byBlock(out) };
  }
  function byBlock(problems) { var m = {}; problems.forEach(function (p) { (m[p.block || '_'] = m[p.block || '_'] || []).push(p); }); return m; }

  /* The dot of every block. */
  function dots(state, problems) {
    var d = {}, bad = byBlock(problems);
    schema.BLOCKS.forEach(function (b) {
      var blk = state.blocks[b.id] || {}, list = ((blk.items || []).concat(blk.quotes || [])).filter(function (r) { return !r.removed; }), amber = !!(bad[b.id] || []).length;
      if (b.id === 'shortfall') { d[b.id] = calc.shortfall(state).has ? (amber ? 'amber' : 'green') : 'grey'; return; }
      if (b.id === 'shortfallQuote' && !list.length && !calc.hasGroupRisk(state)) { d[b.id] = 'na'; return; }
      if (b.id === 'group' && !list.length) { d[b.id] = 'grey'; return; }
      if (!list.length) { d[b.id] = 'grey'; return; }
      var rows = list.slice(); list.forEach(function (r) { (r.lines || []).forEach(function (l) { if (!l.removed) rows.push(l); }); });
      var ver = rows.some(function (r) { return r.st === 'verify'; }), conf = rows.filter(function (r) { return r.st === 'confirmed'; }).length, wait = rows.filter(function (r) { return r.st === 'ff' || r.st === 'empty'; }).length;
      if (b.id === 'other' && !conf && !ver && rows.every(function (r) { return r.st === 'empty'; })) d[b.id] = 'grey';
      else if (ver || amber) d[b.id] = 'amber';
      else if (conf && !wait) d[b.id] = 'green';
      else if (conf) d[b.id] = 'amber';
      else d[b.id] = 'grey';
    });
    return d;
  }
  return { run: run, dots: dots, qLabel: qLabel };
});
