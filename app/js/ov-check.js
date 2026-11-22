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
  /* The heading of a quote as the screen shows it: "BrightRock Reduced Quote CP 100000051". */
  function qTitle(q) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return [q.insurer, { fna: 'FNA', shortfall: 'Shortfall Quote', reduced: 'Reduced Quote', comparative: 'Comparative Quote' }[q.kind], n].filter(Boolean).join(' ');
  }
  function hasFigures(x) { return calc.activeLines(x).some(function (l) { return ['life', 'sev', 'lsd', 'ip'].some(function (p) { var c = l[p]; return c && typeof c === 'object' && Object.keys(c).some(function (k) { return isNum(c[k]) && c[k] !== 0; }); }); }); }

  function run(state) {
    var out = [], tol = (state.settings && state.settings.tolerance) || 1, h = state.header || {}, std = (state.settings && state.settings.standards) || schema.STANDARDS;
    var facts = state.factFind && state.factFind.facts, B = state.blocks;
    var matched = {};                                                                                    // the ids of the quote lines that are the same as a row of the Fact Find (child, debt)
    function add(id, block, where, message, line, short) { out.push({ id: id, severity: 'amber', block: block, where: where, message: message, short: short || message, line: line || null }); }          // line: the id of the line the problem is about, so the screen can flag it and say why on the line (short: the words for the line)
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
          var mk = calc.matchChildren(lines, facts.children || []), md = calc.matchDebts(lines, facts.debts || []), fullName = function (x) { return ((x.name || '') + ' ' + (x.sname || '')).trim(); };
          mk.pairs.forEach(function (p) {
            var c = p.ff, l = p.line, nm = fullName(c), bad = 0;
            if (p.loose) { add('quote.children', block, where, nm + ': the quote has the child as "' + fullName(l) + '"; the Fact Find has the surname "' + c.sname + '".', l.id); bad++; }
            var m = calc.lineVal(l, 'life', 'monthly');
            if (differs(m, c.cost)) { add('quote.children', block, where, nm + ': the quote has ' + fmtR(m) + ' a month; the Fact Find has ' + fmtR(c.cost) + '.', l.id); bad++; }
            if (!bad) matched[l.id] = 1;
          });
          mk.missing.forEach(function (c) { if (figures || mk.pairs.length || mk.extra.length) add('quote.children', block, where, fullName(c) + ' is in the Fact Find, not in the quote.'); });
          mk.extra.forEach(function (l) { if (l.name || l.sname) add('quote.children', block, where, fullName(l) + ' is in the quote, not in the Fact Find.', l.id); });
          md.pairs.forEach(function (p) {
            var d = p.ff, l = p.line, label = d.desc || d.type || 'a debt', m = calc.lineVal(l, 'life', 'monthly'), bk = norm(l.bank), fb = norm(d.prov), bad = 0;
            if (bk && fb && bk.indexOf(fb) < 0 && fb.indexOf(bk) < 0) { add('quote.debts', block, where, label + ': the quote has the bank "' + l.bank + '"; the Fact Find has "' + d.prov + '".', l.id); bad++; }
            if (!bk && !fb) { add('quote.debts', block, where, label + ': bank missing in the Fact Find and the quote.', l.id, 'Bank missing in the Fact Find and the quote.'); bad++; }
            if (differs(m, d.inst)) { add('quote.debts', block, where, label + ': the quote has an instalment of ' + fmtR(m) + '; the Fact Find has ' + fmtR(d.inst) + '.', l.id); bad++; }
            if (!bad) matched[l.id] = 1;
          });
          md.missing.forEach(function (d) { if (figures || md.pairs.length || md.extra.length) add('quote.debts', block, where, (d.desc || d.type || 'A debt') + ' is in the Fact Find, not in the quote.'); });
          md.extra.forEach(function (l) { if (l.debt) add('quote.debts', block, where, l.debt + ' is in the quote, not in the Fact Find.', l.id); });
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
        if (kind !== 'comparative' && /bright/i.test(q.insurer) && figures && !q.cmp) add('gaps', block, where, 'No change moment pay-out guide found for CP ' + (q.number || '(no number yet)') + '.');
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
    if (facts) calc.active(B.proposed.items).forEach(function (it) {                                   // a proposed investment read from a quote against what the Fact Find asked for
      if (!it.ffKey || it.st === 'ff' || it.st === 'empty') return;
      var r = (facts.raq || []).concat(facts.invq || []).filter(function (x) { return x.ffKey === it.ffKey; })[0]; if (!r) return;
      if (differs(it.lump, r.lump)) add('doc.vs.factfind', 'proposed', it.provider || 'A proposal', 'the quote has a lump sum of ' + fmtR(it.lump) + '; the Fact Find asked for ' + fmtR(r.lump) + '.');
      if (differs(it.monthly, r.monthly)) add('doc.vs.factfind', 'proposed', it.provider || 'A proposal', 'the quote has a premium of ' + fmtR(it.monthly) + ' a month; the Fact Find asked for ' + fmtR(r.monthly) + '.');
    });
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
    return { problems: out, dots: dots(state, out), byBlock: byBlock(out), matched: matched };
  }
  /* The Checks panel (Paul, 22 November): one line for each document read, e.g. "BrightRock FNA CP 100000031 checked", and one for its change moment pay-out, instead of the long list of every single check.
     A line is checked (every row of the document checked, nothing flagged), to check (rows still amber, or something differs from the Fact Find or from Paul's standards) or waiting (nothing read or typed yet).
     The documents are every quote and every item that a document filled (a schedule, a statement, a proposal, a report); an item that still only has the Fact Find's figures has no document yet. */
  function docLines(state, problems) {
    var out = [], B = state.blocks || {}, probs = problems || [];
    function make(block, title, rows, own) {
      var toCheck = rows.filter(function (r) { return r && (r.st === 'verify' || r.st === 'ff'); }).length, flagged = own.length, any = rows.some(function (r) { return r && (r.st === 'confirmed' || r.st === 'verify' || r.st === 'ff'); });
      var st = toCheck || flagged ? 'tocheck' : (rows.some(function (r) { return r && r.st === 'confirmed'; }) ? 'checked' : 'waiting');
      var text = st === 'checked' ? title + ' checked' : st === 'waiting' ? title + ': waiting for its figures' : title + ': ' + [toCheck ? toCheck + ' to check' : '', flagged ? flagged + (flagged === 1 ? ' difference' : ' differences') + ' flagged' : ''].filter(Boolean).join(', ');
      out.push({ block: block, title: title, state: st, toCheck: toCheck, flagged: flagged, text: text, tip: own.map(function (p) { return p.message; }).join(' ') || (any ? '' : 'Nothing has been read or typed for this yet.') });
    }
    schema.QUOTE_KINDS.forEach(function (kind) {
      var block = schema.blockOfQuote[kind];
      calc.quotes(state, block).forEach(function (q) {
        var where = qLabel(q), own = probs.filter(function (p) { return p.block === block && p.where === where; });
        make(block, qTitle(q), [q].concat(calc.activeLines(q)), own.filter(function (p) { return p.id !== 'cmp.match'; }));
        if (q.cmp) make(block, qTitle(q) + ' change moment pay-out', [q.cmp], own.filter(function (p) { return p.id === 'cmp.match'; }));
      });
    });
    var named = { policies: function (i) { return [i.insurer || 'Policy', i.policyNo].filter(Boolean).join(' '); }, group: function (i) { return (schema.GROUP_KINDS[i.kind] || 'Group') + ' ' + (i.provider || ''); }, investments: function (i) { return [i.provider || 'Investment', i.product].filter(Boolean).join(' '); },
      proposed: function (i) { return [i.type, i.provider, i.quote ? 'Quote ' + i.quote : ''].filter(Boolean).join(' '); }, goals: function (i) { return i.kind === 'rgar' ? 'Retirement Goal Analysis Report' : 'Education Goal Analysis Report'; } };
    Object.keys(named).forEach(function (block) {
      calc.active((B[block] || {}).items).forEach(function (it) {
        var k = it.src && it.src.kind; if (!it.src || !it.src.file || k === 'factfind' || k === 'previous' || k === 'typed') return;
        var title = named[block](it), where = block === 'policies' ? it.insurer : block === 'group' ? it.provider : block === 'investments' ? it.provider : it.provider;
        make(block, title, [it].concat(calc.activeLines(it)), probs.filter(function (p) { return p.block === block && where && p.where === where; }));
      });
    });
    return out;
  }
  /* A line where the Fact Find and the quote agree is checked by the page (Paul, 22 November): a child or a debt line the quote gives that is the same as a row of the Fact Find (name, bank, amounts) and has nothing flagged
     turns green with a tick, no "to check". Only a line the page itself read (st verify, by page) is touched; a person's typing and every line that is missing, different or only in one of the two stay as they are.
     Returns how many lines were checked. */
  function autoMatch(state, q) {
    var res = run(state), n = 0, flagged = {};
    res.problems.forEach(function (p) { if (p.line) flagged[p.line] = 1; });
    calc.activeLines(q).forEach(function (l) {
      if ((l.type === 'child' || l.type === 'debt') && res.matched[l.id] && !flagged[l.id] && l.st === 'verify' && l.by === 'page') { l.st = 'confirmed'; l.match = 'factfind'; n++; }
    });
    return n;
  }
  function byBlock(problems) { var m = {}; problems.forEach(function (p) { (m[p.block || '_'] = m[p.block || '_'] || []).push(p); }); return m; }

  /* The dot of every block. */
  function dots(state, problems) {
    var d = {}, bad = byBlock(problems);
    schema.BLOCKS.forEach(function (b) {
      var blk = state.blocks[b.id] || {}, list = ((blk.items || []).concat(blk.quotes || [])).filter(function (r) { return !r.removed; }), amber = !!(bad[b.id] || []).length;
      if (b.id === 'shortfall') { var sfq = calc.shortfall(state); d[b.id] = sfq.has && hasFigures(sfq.quote) ? (amber ? 'amber' : 'green') : 'grey'; return; }          // green only when the FNA has figures, so the result has been worked out
      if (b.id === 'shortfallQuote' && !list.length && !calc.hasGroupRisk(state)) { d[b.id] = 'na'; return; }
      if (b.id === 'group' && !list.length) { d[b.id] = 'grey'; return; }
      if (!list.length) { d[b.id] = 'grey'; return; }
      var rows = list.slice(); list.forEach(function (r) { (r.lines || []).forEach(function (l) { if (!l.removed) rows.push(l); }); });
      var ver = rows.some(function (r) { return r.st === 'verify' || (b.id === 'other' && r.st === 'ff'); }),                 // block 11 follows the Fact Find and has no document to wait for: what it says is to be checked
         conf = rows.filter(function (r) { return r.st === 'confirmed'; }).length, wait = rows.filter(function (r) { return r.st === 'ff' || (r.st === 'empty' && b.id !== 'other'); }).length;       // an item of block 11 with nothing in it has nothing to wait for
      if (b.id === 'other' && !conf && !ver && rows.every(function (r) { return r.st === 'empty'; })) d[b.id] = 'grey';
      else if (ver || amber) d[b.id] = 'amber';
      else if (conf && !wait) d[b.id] = 'green';
      else if (conf) d[b.id] = 'amber';
      else d[b.id] = 'grey';
    });
    return d;
  }
  /* What a dot means, in words, for the hover text of the menu (stage 7: Paul could not tell what the dots meant). */
  var LEGEND = [['grey', 'Nothing yet'], ['amber', 'To check'], ['green', 'Checked'], ['na', 'Not needed']];
  function dotText(state, id, dot, problems) {
    var p = byBlock(problems || [])[id] || [];
    if (dot === 'na') return 'Not needed: a shortfall quote is only needed when the client has group risk, and there is none.';
    if (dot === 'green') return 'Checked: every row here has been checked and nothing is flagged.';
    if (dot === 'amber') return p.length ? 'To check: ' + p.length + (p.length === 1 ? ' thing is' : ' things are') + ' flagged. ' + [p[0].where, p[0].message].filter(Boolean).join(' ').slice(0, 140) : 'To check: some rows came from the Fact Find or from a document and are waiting for you to check them.';
    return id === 'shortfall' ? 'Nothing yet: the shortfall is worked out as soon as the FNA quote has figures.' : 'Nothing yet: waiting for a document, or for what you type.';
  }
  return { run: run, dots: dots, qLabel: qLabel, qTitle: qTitle, docLines: docLines, autoMatch: autoMatch, dotText: dotText, LEGEND: LEGEND };
});
