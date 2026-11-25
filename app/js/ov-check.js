/* The Client Overview's checks (docs/OVERVIEW-DATA-CONTRACT.md section 10): amber, for Sitamah and Paul only, never printed, never in the way of saving. Also the dot of each block in the left menu
   (green: complete; amber: needs a look; grey: waiting for a document; hollow: nothing to do here). Loads in the browser (window.OV.check) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.check = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  var isNum = calc.isNum, fmtR = calc.fmtR, norm = calc.norm;
  function qLabel(q) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return [q.insurer, q.counterOf ? 'counter offer' : { fna: 'FNA', shortfall: 'shortfall quote', reduced: 'reduced quote', comparative: 'quote' }[q.kind], n].filter(Boolean).join(' ');
  }
  /* The heading of a quote as the screen shows it: "BrightRock Reduced Quote CP 100000051". */
  function qTitle(q) {
    var n = q.number ? (/bright/i.test(q.insurer) ? 'CP ' : 'Quote ') + q.number : '';
    return [q.insurer, q.counterOf ? 'Counter Offer' : { fna: 'FNA', shortfall: 'Shortfall Quote', reduced: 'Reduced Quote', comparative: 'Comparative Quote' }[q.kind], n].filter(Boolean).join(' ');
  }
  /* Checks that stay in the Checks panel as notes but never hold a block's dot or a quote's row amber (Paul, 23 November: only real line differences, a missing pay-out guide or missing figures do): the quote's income against the client's net income,
     an increase that differs from the standard settings, a premium above the budget. */
  var NOTE_IDS = { 'fna.income': 1, standards: 1, budget: 1 };
  function realOnes(problems) { return (problems || []).filter(function (p) { return !NOTE_IDS[p.id]; }); }
  function hasFigures(x) { return calc.activeLines(x).some(function (l) { return ['life', 'sev', 'lsd', 'ip'].some(function (p) { var c = l[p]; return c && typeof c === 'object' && Object.keys(c).some(function (k) { return isNum(c[k]) && c[k] !== 0; }); }); }); }

  /* opts.ran: the page has looked through a folder or a document, or run its checks, in this visit (the document blocks, FNA and reduced quotes, can only say "nothing found" then).
     opts.done (round 2, 23 November): the blocks whose search or check has FINISHED in this visit ({ blockId: true }). A block never says "nothing found" before it is in there: until then the menu shows a neutral waiting state. Left out: every block counts as finished. */
  function run(state, opts) {
    var out = [], tol = (state.settings && state.settings.tolerance) || 1, h = state.header || {}, std = (state.settings && state.settings.standards) || schema.STANDARDS;
    var facts = state.factFind && state.factFind.facts, B = state.blocks;
    var matched = {};                                                                                    // the ids of the quote lines that are the same as a row of the Fact Find (child, debt)
    function add(id, block, where, message, line, short) { out.push({ id: id, severity: 'amber', block: block, where: where, message: message, short: short || message, line: line || null }); }          // line: the id of the line the problem is about, so the screen can flag it and say why on the line (short: the words for the line)
    var differs = function (a, b) { return isNum(a) && isNum(b) && Math.abs(a - b) > tol; };

    var conflicts = calc.acceptanceConflicts(state);                                                      // round 1.1: only one quote may be in an accepted state (unless ticked: a second policy alongside the first)
    schema.QUOTE_KINDS.forEach(function (kind) {
      var block = schema.blockOfQuote[kind];
      calc.quotes(state, block).forEach(function (q) {
        var where = qLabel(q), t = calc.totals(q), lines = calc.activeLines(q), figures = hasFigures(q), ffInst = {};
        var cf = conflicts.filter(function (c) { return c.quote === q; })[0];
        if (cf) add('accept.second', block, where, 'Another quote is also accepted (' + cf.others.map(qLabel).join(' and ') + '): only one quote can be accepted, unless this is a deliberate second policy alongside the first (tick that on the quote).');
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
            if (differs(m, c.cost)) { add('quote.children', block, where, nm + ': the quote has ' + fmtR(m) + ' a month; the Fact Find has ' + fmtR(c.cost) + ' (the quote wins: correct the Fact Find).', l.id); bad++; }
            if (!bad) matched[l.id] = 1;
          });
          mk.missing.forEach(function (c) { if (figures || mk.pairs.length || mk.extra.length) add('quote.children', block, where, fullName(c) + ' is in the Fact Find, not in the quote.'); });
          mk.extra.forEach(function (l) { if (l.name || l.sname) add('quote.children', block, where, fullName(l) + ' is in the quote, not in the Fact Find.', l.id); });
          md.pairs.forEach(function (p) {
            var d = p.ff, l = p.line, label = d.desc || d.type || 'a debt', m = calc.lineVal(l, 'life', 'monthly'), bk = norm(l.bank), fb = norm(d.prov), bad = 0;
            if (bk && fb && bk.indexOf(fb) < 0 && fb.indexOf(bk) < 0) { add('quote.debts', block, where, label + ': the quote has the bank "' + l.bank + '"; the Fact Find has "' + d.prov + '".', l.id); bad++; }
            if (!bk && !fb) { add('quote.debts', block, where, label + ': bank missing in the Fact Find and the quote.', l.id, 'Bank missing in the Fact Find and the quote.'); bad++; }
            if (differs(m, d.inst)) { add('quote.debts', block, where, label + ': the quote has an instalment of ' + fmtR(m) + '; the Fact Find has ' + fmtR(d.inst) + ' (the quote wins: correct the Fact Find).', l.id); bad++; }
            if (!bad) matched[l.id] = 1;
            if (isNum(d.inst)) ffInst[l.id] = d.inst;
          });
          md.missing.forEach(function (d) { if (figures || md.pairs.length || md.extra.length) add('quote.debts', block, where, (d.desc || d.type || 'A debt') + ' is in the Fact Find, not in the quote.'); });
          md.extra.forEach(function (l) { if (l.debt) add('quote.debts', block, where, l.debt + ' is in the quote, not in the Fact Find.', l.id); });
        }
        if (kind === 'shortfall' && !q.counterOf) {
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
        if (kind !== 'comparative') lines.forEach(function (l) {                                           // a BrightRock line read from the quote: every figure is there, or the line says so and stays to check (never an empty box ticked green)
          if (l.by !== 'page' || !l.src || l.src.kind !== 'quote' || (l.st !== 'verify' && l.st !== 'confirmed')) return;
          var parts = [], shorts = [], isDeath = l.type === 'death';
          (schema.FIGURES[l.type] || []).forEach(function (r) {
            var c = l[r[0]], v = c && typeof c === 'object' ? c[r[1]] : null, notFound = v === 'Not found', empty = v === null || v === undefined || v === '';
            if (!notFound && !empty) return;
            var fnd = isDeath && r[1] === 'monthly' ? r[2] + ' is not on the quote: see the BrightRock email' : r[2] + (notFound ? ' is not found on the quote' : ' is empty');
            if (l.type === 'debt' && r[1] === 'monthly' && isNum(ffInst[l.id])) fnd += ' (the Fact Find has ' + fmtR(ffInst[l.id]) + ')';
            parts.push(fnd); shorts.push((isDeath && r[1] === 'monthly' ? 'Not on the quote: see the BrightRock email' : notFound ? 'Not found on the quote: ' + r[2].replace(/^the /, '') : 'Empty: ' + r[2].replace(/^the /, '')) + (l.type === 'debt' && r[1] === 'monthly' && isNum(ffInst[l.id]) ? ' (Fact Find: ' + fmtR(ffInst[l.id]) + ')' : ''));
          });
          if (!parts.length) return;
          var who = l.type === 'child' ? ((l.name || '') + ' ' + (l.sname || '')).trim() : l.type === 'debt' ? (l.debt || '') : '', lab = ((schema.lineTypesById[l.type] || {}).l || l.type) + (who ? ' ' + who : '');
          add('figures', block, where, lab + ': ' + parts.join('; ') + '.', l.id, shorts.join('. ') + '.');
        });
        if (isNum(q.aci) && isNum(std.aci) && q.aci !== std.aci && lines.length) add('standards', block, where, 'The annual contribution increase is ' + q.aci + '%; your standard is ' + std.aci + '%.');
        if (q.printedTotals) {
          schema.PILLARS.forEach(function (p) {
            var pt = q.printedTotals[p.id]; if (!pt || typeof pt !== 'object') return;
            p.keys.forEach(function (k) { if (differs(pt[k], t[p.id][k])) add('totals.printed', block, where, 'The document prints ' + fmtR(pt[k]) + ' for ' + p.l.toLowerCase() + (k === 'monthly' ? ' (monthly)' : '') + '; the lines add up to ' + fmtR(t[p.id][k]) + '.'); });
          });
        }
        if (isNum(q.disabilityAge) && isNum(h.disabilityAge) && q.disabilityAge !== h.disabilityAge) add('age', block, where, 'The quote covers disability to age ' + q.disabilityAge + '; the Fact Find says ' + h.disabilityAge + '.');
        if (kind === 'reduced' && !q.counterOf && isNum(q.premium) && isNum(h.premiumBudget) && q.premium > h.premiumBudget + tol) add('budget', block, where, 'The premium of ' + fmtR(q.premium) + ' is above the client\'s budget of ' + fmtR(h.premiumBudget) + '.');
        if (kind !== 'comparative' && /bright/i.test(q.insurer) && figures && !q.cmp) add('gaps', block, where, 'No change moment pay-out guide found for CP ' + (q.number || '(no number yet)') + '.');
        if (q.counterOf) { var nt = calc.termsToCheck(q); if (nt) add('counter.terms', block, where, nt + (nt === 1 ? ' term' : ' terms') + ' read from the counter offer letter or the underwriters\' e-mail ' + (nt === 1 ? 'is' : 'are') + ' to check (the Terms checked button confirms them).'); }          // round 1.2
        if (q.counterOf && q.offer) { var cpm = calc.counterPremium(state, q), po = q.offer, pw = calc.premiumWarning(state, q);
          if (pw) add('counter.premium', block, where, pw);                                                    // round 1.3 (Paul): the revised Cover Proposal must match the letter exactly: any difference, even a cent, names both figures
          if (cpm && cpm.prev && isNum(po.origPremium) && isNum(cpm.prev.premium) && Math.abs(cpm.prev.premium - po.origPremium) > 0.05) add('counter.premium', block, where, 'The letter\'s original premium (' + fmtR(po.origPremium) + ') is not the premium of the quote before it (' + fmtR(cpm.prev.premium) + '): the letter\'s figure is the one shown as the premium before.'); }          // a cent on the before side is rounding
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
    var notes = emptyNotes(state, opts);
    return { problems: out, dots: dots(state, out, notes), notes: notes, byBlock: byBlock(out), matched: matched };
  }
  /* What a block says when it was checked and nothing is there (Paul, 23 November): a short comment under the block's name in the menu, and a RED dot when the whole block is empty.
     A block that follows the Fact Find is checked once the Fact Find has been read; the FNA and the reduced quotes (documents only) once the page has looked through a folder or a document (opts.ran).
     Each note is { text, all }: all = nothing at all is there (red); a half-empty block (group benefits there, no personal investments) has the comment and keeps its own dot. kind 'na': not needed (dashed). */
  function emptyNotes(state, opts) {
    var n = {}, ff = state.factFind && state.factFind.facts, ran = !!(opts && opts.ran), B = state.blocks || {}, asked = (ff && ff.asked) || {};
    var done = opts && opts.done, say = function (id, text, all, kind) { if (done && !done[id]) return; n[id] = { text: text, all: !!all, kind: kind || (all ? 'red' : 'part') }; };
    if (ff && !calc.policies(state).length) say('policies', 'No current policies', true);
    if (ran && !calc.quotes(state, 'fna').length) say('fna', 'No FNA quote found', true);
    if (ff || ran) {
      var gi = calc.groupItems(state).length, pi = calc.personalInvestments(state).count;
      if (!gi && !pi) say('group', 'No group benefits and no personal investments', true);
      else if (!gi) say('group', 'No group benefits', false);
      else if (!pi) say('group', 'No personal investments', false);
    }
    if (!calc.quotes(state, 'shortfallQuote').length) {
      if (!calc.hasGroupRisk(state)) { if (ff || ran) say('shortfallQuote', 'Not needed: no group risk', false, 'na'); }
      else if (ff && !asked.sf) say('shortfallQuote', 'No shortfall quote requested', true);
      else if (ran) say('shortfallQuote', 'No shortfall quote found', true);
    }
    if (ran && !calc.quotes(state, 'reduced').length) say('reduced', 'No reduced quotes found', true);
    if (!calc.quotes(state, 'comparative').length) {
      if (ff && !asked.comparative) say('comparative', 'No comparative quotes', true);
      else if (ran) say('comparative', 'No comparative quote found', true);
    }
    if (ff && !calc.investments(state).length) say('investments', 'No current investments', true);
    if (ff && !calc.active((B.proposed || {}).items).length) say('proposed', 'No proposed investments', true);
    if (ff && !calc.pageShown(state, 'goals')) say('goals', 'No goal analysis requested', true);
    var holds = function (it) { return ['company', 'product', 'policyNo', 'note'].some(function (k) { return String(it[k] == null ? '' : it[k]).trim() !== ''; }) || calc.isNum(it.premium); };            // an item the Fact Find only marked "not ours" holds nothing
    if (ff && calc.active((B.other || {}).items).length && !calc.active((B.other || {}).items).some(holds)) say('other', 'No medical aid, gap cover, will or short-term recorded', true);
    return n;
  }
  /* The Checks panel (Paul, 22 November): one line for each document read, e.g. "BrightRock FNA CP 100000031 checked", and one for its change moment pay-out, instead of the long list of every single check.
     A line is checked (every row of the document checked, nothing flagged), to check (rows still amber, or something differs from the Fact Find or from Paul's standards) or waiting (nothing read or typed yet).
     The documents are every quote and every item that a document filled (a schedule, a statement, a proposal, a report); an item that still only has the Fact Find's figures has no document yet. */
  function docLines(state, problems) {
    var out = [], B = state.blocks || {}, probs = realOnes(problems);
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
  /* A line the quote gives is checked by the page (Paul, 22 and 23 November). The quote is the document, so a line that is IN the quote is confirmed (green tick) whether or not the Fact Find has anything like it:
     household needs, death-related needs, additional expense (dread) and the plain benefit lines (match "quote"). A child or a debt line is held to the Fact Find: where the two agree (name, bank, amounts) it is confirmed
     (match "factfind"); one that differs, or that is in the quote and not in the Fact Find, shows "to check" with its reason. Only a line the page itself read (st verify, by page) is touched; a person's typing stays.
     The quote's own row is confirmed too (st only, no key) when nothing at all is flagged for it. Returns how many lines were checked. */
  function autoMatch(state, q) {
    var res = run(state), n = 0, flagged = {}, where = qLabel(q), block = schema.blockOfQuote[q.kind], hold = 0;
    res.problems.forEach(function (p) { if (p.line) flagged[p.line] = 1; });
    calc.activeLines(q).forEach(function (l) {
      if (l.st !== 'verify' || l.by !== 'page') return;
      if (l.type === 'child' || l.type === 'debt') { if (res.matched[l.id] && !flagged[l.id]) { l.st = 'confirmed'; l.match = 'factfind'; n++; } }
      else if (!flagged[l.id]) { l.st = 'confirmed'; l.match = 'quote'; n++; }
    });
    res = run(state);
    hold = realOnes(res.problems).filter(function (p) { return p.block === block && p.where === where; }).length;
    if (!hold && q.st === 'verify' && q.by === 'page' && calc.activeLines(q).length && !calc.activeLines(q).some(function (l) { return l.st === 'verify' || l.st === 'ff'; })) { q.st = 'confirmed'; }
    return n;
  }
  /* Every quote already in the overview is brought up to the current rules (round 3, 23 November): a file saved, or a draft restored, by an older version gets its dread line without life cover, its income portions of 0, and its lines ticked by the quote
     (a quote read by 0.9 had them "to check"). Returns how many things changed. */
  /* A debt's instalment the quote did not print (round 4, 23 November): the same debt has one instalment, so it is taken from the client's OTHER BrightRock quote of that debt (same name, abbreviations set aside), else from the Fact
     Find's debt, and the line says where it came from (via). Only a line the page read from a quote, and only a box that is empty or "Not found". Returns how many were filled. */
  var KIND_WORD = { fna: 'FNA quote', shortfall: 'shortfall quote', reduced: 'reduced quote' };
  function fillInstalments(state) {
    var n = 0, facts = state.factFind && state.factFind.facts, ffDebts = (facts && facts.debts) || [], all = [];
    schema.QUOTE_KINDS.forEach(function (k) { calc.quotes(state, schema.blockOfQuote[k]).forEach(function (q) { if (q.kind !== 'comparative' && /bright/i.test(q.insurer || '')) all.push(q); }); });
    all.forEach(function (q) {
      var lines = calc.activeLines(q), ffOf = {};
      calc.matchDebts(lines, ffDebts).pairs.forEach(function (p) { ffOf[p.line.id] = p.ff; });
      lines.forEach(function (l) {
        if (l.type !== 'debt' || !l.src || l.src.kind !== 'quote' || !l.life || typeof l.life !== 'object') return;
        var m = l.life.monthly; if (calc.isNum(m) || !(m === null || m === undefined || m === '' || m === 'Not found')) return;
        var cands = [];
        all.forEach(function (o) {
          if (o === q) return;
          calc.activeLines(o).forEach(function (x) { if (x.type === 'debt' && x.life && calc.isNum(x.life.monthly) && x.debt && l.debt && calc.sameDebtName(x.debt, l.debt)) cands.push({ v: x.life.monthly, lump: x.life.lump, o: o }); });
        });
        var pick = null, distinct = cands.map(function (c) { return c.v; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (distinct.length === 1) pick = cands[0];
        else if (cands.length) pick = cands.filter(function (c) { return calc.isNum(c.lump) && calc.isNum(l.life.lump) && Math.abs(c.lump - l.life.lump) < 1; })[0] || null;
        var v = null, from = '';
        if (pick) { v = pick.v; from = 'from the ' + (pick.o.counterOf ? 'counter offer' : (KIND_WORD[pick.o.kind] || 'other quote')) + (pick.o.number ? ' CP ' + pick.o.number : ''); }
        else if (ffOf[l.id] && calc.isNum(ffOf[l.id].inst)) { v = ffOf[l.id].inst; from = 'from the Fact Find'; }
        if (v == null) return;
        l.life.monthly = v; l.via = l.via || {}; l.via['life.monthly'] = from; n++;
      });
    });
    return n;
  }
  function settleAll(state) {
    var n = fillInstalments(state) + calc.alignPremiums(state);          // round 1.3: the letter's premiums win a cent of rounding, also in a file the skill built
    schema.QUOTE_KINDS.forEach(function (kind) {
      calc.quotes(state, schema.blockOfQuote[kind]).forEach(function (q) {
        (q.lines || []).forEach(function (l) { n += calc.settleLine(l); });
        if (calc.activeLines(q).some(function (l) { return l.by === 'page' && l.st === 'verify'; }) || (q.st === 'verify' && q.by === 'page' && calc.activeLines(q).length)) n += autoMatch(state, q);
      });
    });
    return n;
  }
  function byBlock(problems) { var m = {}; problems.forEach(function (p) { (m[p.block || '_'] = m[p.block || '_'] || []).push(p); }); return m; }

  /* The dot of every block. */
  function dots(state, problems, notes) {
    var d = {}, bad = byBlock(realOnes(problems));
    notes = notes || {};
    schema.BLOCKS.forEach(function (b) {
      var blk = state.blocks[b.id] || {}, list = ((blk.items || []).concat(blk.quotes || [])).filter(function (r) { return !r.removed; }), amber = !!(bad[b.id] || []).length;
      if (b.id === 'shortfall') { var sfq = calc.shortfall(state); d[b.id] = sfq.has && hasFigures(sfq.quote) ? (amber ? 'amber' : 'green') : 'grey'; return; }          // green only when the FNA has figures, so the result has been worked out
      if (b.id === 'shortfallQuote' && !list.length && !calc.hasGroupRisk(state)) { d[b.id] = 'na'; return; }
      if (notes[b.id] && notes[b.id].all) { d[b.id] = 'red'; return; }                        // checked, and nothing is there
      if (b.id === 'group' && !list.length) { d[b.id] = notes.group && notes.group.text === 'No group benefits' ? 'green' : 'grey'; return; }          // no group benefits but personal investments: nothing here to wait for
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
  var LEGEND = [['grey', 'Nothing yet'], ['amber', 'To check'], ['green', 'Checked'], ['red', 'Checked, nothing there'], ['na', 'Not needed']];
  function dotText(state, id, dot, problems, note) {
    var p = byBlock(realOnes(problems))[id] || [];
    if (dot === 'red') return 'Checked, nothing there: ' + ((note && note.text) || 'nothing was found for this block') + '.';
    if (dot === 'na') return 'Not needed: a shortfall quote is only needed when the client has group risk, and there is none.';
    if (dot === 'green') return 'Checked: every row here has been checked and nothing is flagged.';
    if (dot === 'amber') return p.length ? 'To check: ' + p.length + (p.length === 1 ? ' thing is' : ' things are') + ' flagged. ' + [p[0].where, p[0].message].filter(Boolean).join(' ').slice(0, 140) : 'To check: some rows came from the Fact Find or from a document and are waiting for you to check them.';
    return id === 'shortfall' ? 'Nothing yet: the shortfall is worked out as soon as the FNA quote has figures.' : 'Nothing yet: waiting for a document, or for what you type.';
  }
  return { run: run, dots: dots, qLabel: qLabel, qTitle: qTitle, docLines: docLines, autoMatch: autoMatch, settleAll: settleAll, fillInstalments: fillInstalments, NOTE_IDS: NOTE_IDS, dotText: dotText, emptyNotes: emptyNotes, LEGEND: LEGEND };
});
