/* The Client Overview's data (docs/OVERVIEW-DATA-CONTRACT.md): the saved file's layout, saving and opening it, the changes the page makes (typing, adding a quote or a line, removing and undoing), and the pre-fill
   from the Fact Find. State is plain data. Every row holds a status st (empty, ff, verify, confirmed), the document it came from (src) and who wrote it (by).
   Blocks 1, 3 and 8 follow the Fact Find: the page adds a skeleton item for every Fact Find row (tied to it by its ffKey) and never removes one. Loads in the browser (window.OV.store) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.store = factory(root.FF.util, root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc) {
  var APP_ID = schema.APP_ID, FF_APP_ID = 'wr-fact-find', ST = { empty: 1, ff: 1, verify: 1, confirmed: 1 };
  var seq = 0;
  function uid(prefix) { seq++; return prefix + '-' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6) + seq.toString(36); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function money(v) { var t = str(v); return t === '' || !/\d/.test(t) ? null : calc.r2(util.num(t)); }

  /* ---------- a blank overview ---------- */
  function blank() {
    var s = { app: APP_ID, schema: schema.version, created: new Date().toISOString(), modified: null,
      header: { fname: '', sname: '', dob: null, broker: 'Paul Kafentzis', overviewDate: schema.todayDMY(), meetingDate: null, astuteDate: null, netIncome: null, grossIncome: null, disabilityAge: null, sevRequest: null, premiumBudget: null, previous: null },
      factFind: null, documents: [], settings: { standards: clone(schema.STANDARDS), tolerance: 1.00 },
      blocks: { policies: { items: [] }, fna: { quotes: [] }, group: { items: [] }, shortfallQuote: { quotes: [] }, reduced: { quotes: [] }, comparative: { quotes: [] }, investments: { items: [] }, proposed: { items: [] }, goals: { items: [] }, other: { items: [] } },
      computed: null };
    s.blocks.other.items = schema.OTHER_KEYS.map(function (k) { return otherItem(k.key); });
    return s;
  }
  function otherItem(key) { return { id: 'other-' + key, key: key, company: '', product: '', policyNo: '', wr: false, note: '', premium: null, st: 'empty', src: null, by: 'page' }; }

  /* ---------- what a typed cell holds ---------- */
  /* Money and percent cells: a number, "N/A", "Not found", or nothing (null). */
  function parseNum(text) {
    var t = str(text);
    if (t === '') return null;
    if (/^n\/?a$/i.test(t)) return 'N/A';
    if (/^not\s*found$/i.test(t)) return 'Not found';
    return /\d/.test(t) ? calc.r2(util.num(t)) : null;
  }
  function parseCell(text, kind) {
    var t = str(text);
    if (kind === 'money' || kind === 'pct' || kind === 'num') return parseNum(t);
    if (kind === 'date') { if (t === '') return null; var d = util.parseDate(t); return d ? util.formatDate(d) : t; }
    if (kind === 'lines') { var ls = String(text == null ? '' : text).split(/\r?\n+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3); return ls.length ? ls : null; }          // the ACI in short points: one per line, up to three
    if (kind === 'bool') return text === true || text === 'true' || text === 'on' || text === '1';
    if (kind === 'tri') return t === '' ? null : (text === true || t === 'true');
    return t === '' ? null : t;
  }
  function pathParts(path) { return String(path).split('.'); }
  function pathGet(state, path) { var o = state; pathParts(path).forEach(function (k) { o = o == null ? undefined : o[k]; }); return o; }
  /* Set the value at a path ("blocks.fna.quotes.0.lines.2.life.lump"). The row it belongs to becomes "confirmed" and "person" (somebody typed it). Returns the value stored. */
  function setPath(state, path, text, kind) {
    var parts = pathParts(path), o = state, owner = null, val = parseCell(text, kind);
    for (var i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (o == null) return undefined; if (typeof o === 'object' && !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, 'st')) owner = o; }
    var last = parts[parts.length - 1];
    o[last] = val;
    if (parts.length >= 3) { var ln = pathGet(state, parts.slice(0, -2).join('.')); if (ln && ln.via && typeof ln.via === 'object') delete ln.via[parts.slice(-2).join('.')]; }          // a figure somebody types is no longer "from the FNA quote" or "from the email"
    if (owner) { owner.st = 'confirmed'; owner.by = 'person'; delete owner.match; }                          // a person's typing is a person's check: the page's automatic match is over
    return val;
  }
  /* A row (a quote, a line, an item) is checked by a person: it turns green. */
  function accept(state, path) { var o = pathGet(state, path); if (o && typeof o === 'object') { o.st = 'confirmed'; o.by = 'person'; return true; } return false; }
  function acceptAll(state) {
    var n = 0;
    walkRows(state, function (r) { if (r.st === 'ff' || r.st === 'verify') { r.st = 'confirmed'; r.by = 'person'; n++; } });
    return n;
  }
  /* Every row that carries a status: items, quotes and their lines. */
  function walkRows(state, fn) {
    Object.keys(state.blocks).forEach(function (b) {
      var blk = state.blocks[b];
      (blk.items || []).forEach(function (it) { fn(it, b); (it.lines || []).forEach(function (l) { fn(l, b); }); });
      (blk.quotes || []).forEach(function (q) { fn(q, b); (q.lines || []).forEach(function (l) { fn(l, b); }); });
    });
  }

  /* ---------- quotes and lines ---------- */
  function newLine(type, o) {
    var t = schema.lineTypesById[type] || schema.lineTypesById.other, l = { id: uid('l'), type: t.id, label: t.l, term: t.term || null,
      life: { lump: null, monthly: null }, sev: { lump: null }, lsd: { lump: null, monthly: null }, ip: { monthly: null }, waiting: null, abi: null, st: 'empty', src: null, by: 'person', removed: false };
    if (t.id === 'child') { l.name = ''; l.sname = ''; l.term = 'Age 24'; l.waiting = 'N/A'; }
    if (t.id === 'debt') { l.debt = ''; l.bank = ''; l.accelerated = null; }                                       // accelerated (true) or standalone (false) debt cover: not known until the quote says so
    (t.na || []).forEach(function (k) { if (k === 'waiting') l.waiting = 'N/A'; else l[k] = 'N/A'; });
    return Object.assign(l, o || {});
  }
  /* A new quote. For an FNA, shortfall or reduced quote (BrightRock) the lines the Fact Find already knows are started for it (household, a line per child, a line per debt, death-related needs, dread) and wait for the
     quote's figures ("from the Fact Find, waiting for document"). */
  function newQuote(state, kind, o) {
    var q = { id: uid('q'), kind: kind, insurer: kind === 'comparative' ? '' : 'BrightRock', number: '', date: null, rates: 'Non-smoker rates', servicing: false, status: 'pending', disabilityAge: state.header.disabilityAge,
      aci: null, aciText: null, premium: null, printedTotals: null, lines: [], cmp: null, policyNo: null, startDate: null, replaces: null, replacedBy: null, st: 'empty', src: null, by: 'person', removed: false };
    if (kind !== 'comparative') {
      var facts = state.factFind && state.factFind.facts, ffLine = function (l) { l.st = 'ff'; l.by = 'page'; l.src = { kind: 'factfind' }; return l; };
      q.lines.push(ffLine(newLine('household')));
      ((facts && facts.children) || []).forEach(function (c) { q.lines.push(ffLine(newLine('child', { name: c.name, sname: c.sname, label: 'Child care' }))); });
      ((facts && facts.debts) || []).forEach(function (d) { q.lines.push(ffLine(newLine('debt', { debt: d.desc || d.type || '', bank: d.prov || '', label: 'Debt' }))); });
      q.lines.push(ffLine(newLine('death'))); q.lines.push(ffLine(newLine('dread')));
      if (facts && facts.children && facts.children.length + (facts.debts || []).length) q.st = 'ff';
    } else q.lines.push(newLine('other', { label: 'Cover', term: 'Whole of life' }));          // another insurer's quote is tailored to what it prints: often one whole-of-life amount for each benefit
    return Object.assign(q, o || {});
  }
  function addQuote(state, kind, o) { var q = newQuote(state, kind, o); state.blocks[schema.blockOfQuote[kind]].quotes.push(q); return q; }
  function findQuote(state, id) {
    var hit = null;
    schema.QUOTE_KINDS.forEach(function (k) { state.blocks[schema.blockOfQuote[k]].quotes.forEach(function (q) { if (q.id === id) hit = q; }); });
    return hit;
  }
  function setRemoved(state, path, yes) { var o = pathGet(state, path); if (!o || typeof o !== 'object') return false; o.removed = !!yes; return true; }
  function addLine(state, path, type, o) { var c = pathGet(state, path); if (!c || !Array.isArray(c.lines)) return null; var l = newLine(type, o); c.lines.push(l); return l; }
  function addItem(state, blockId, item) { state.blocks[blockId].items.push(item); return item; }
  function newProposed() { return { id: uid('pi'), type: schema.PROPOSED_TYPES[0], provider: '', quote: '', contribution: 'monthly', lump: null, monthly: null, boostPct: null, netInvested: null, aci: null, st: 'empty', src: null, by: 'person', removed: false }; }


  /* ---------- the change moment pay-out (typed: stage 6) ---------- */
  /* The rows of a pay-out table as the guide prints them: the total, the retirement part, the childcare part and one row for each child (named from the quote's child lines, else from the Fact Find). */
  function newCmp(state, owner) {
    var rows = [{ key: 'total' }, { key: 'retirement' }, { key: 'childcare' }].map(function (r) { return Object.assign({ today: null, projected: null, payoutDate: null }, r); });
    var kids = calc.activeLines(owner).filter(function (l) { return l.type === 'child' && (l.name || l.sname); }).map(function (l) { return { name: l.name, sname: l.sname }; });
    if (!kids.length) kids = ((state.factFind && state.factFind.facts && state.factFind.facts.children) || []).map(function (c) { return { name: c.name, sname: c.sname }; });
    kids.forEach(function (c) { rows.push({ key: 'child', name: c.name || '', sname: c.sname || '', today: null, projected: null, payoutDate: null }); });
    return { number: owner.number || '', activationDate: null, reason: null, rows: rows, st: 'empty', by: 'person', src: { kind: 'typed' } };
  }
  function addCmp(state, path) { var o = pathGet(state, path); if (!o || typeof o !== 'object' || o.cmp) return null; o.cmp = newCmp(state, o); return o.cmp; }
  function removeCmp(state, path) { var o = pathGet(state, path); if (!o || !o.cmp) return false; o.cmp = null; return true; }

  /* ---------- a review year (stage 6) ---------- */
  /* The next year's overview, started from this one. The client, the policies (an issued quote of ours becomes a policy), the group benefits, the investments, the goal reports asked for and the other cover are carried over,
     every one "to check" and marked as coming from last year's overview, so the checks say what still waits for the latest schedule or statement; the quotes (the new FNA replaces last year's), the proposals, the documents
     log, the Astute date and the meeting date start empty. The old overview is not changed (it is a file of its own, kept: a new date is a new file name). */
  function startReview(old, today) {
    var s = blank(), prev = { date: old.header.overviewDate || '', file: schema.fileName(old) }, src = { kind: 'previous', file: prev.file, date: prev.date };
    Object.keys(s.header).forEach(function (k) { if (old.header[k] !== undefined) s.header[k] = clone(old.header[k]); });
    s.header.overviewDate = today || schema.todayDMY(); s.header.meetingDate = null; s.header.astuteDate = null; s.header.previous = prev;
    s.factFind = clone(old.factFind); if (old.settings) s.settings = clone(old.settings);
    var n = { policies: 0, group: 0, investments: 0, other: 0, goals: 0 };
    function carry(r, kind) {
      var c = clone(r); delete c.derived; delete c.fromQuote; delete c.replaces; delete c.replacedBy; c.removed = false;
      c.cmp = null;                                                                                   // last year's pay-out guide is out of date
      if (c.st !== 'empty') { c.st = 'verify'; c.by = 'page'; c.src = src; n[kind]++; }
      c.lines = (c.lines || []).filter(function (l) { return !l.removed; }).map(function (l) { l = clone(l); if (l.st !== 'empty') { l.st = 'verify'; l.by = 'page'; l.src = src; } return l; });
      return c;
    }
    s.blocks.policies.items = calc.policies(old).map(function (e) { return carry(e.item, 'policies'); });
    s.blocks.group.items = calc.groupItems(old).map(function (g) { return carry(g, 'group'); });
    s.blocks.investments.items = calc.investments(old).map(function (i) { return carry(i, 'investments'); });
    s.blocks.goals.items = calc.active(old.blocks.goals.items).map(function (g) { var c = carry(g, 'goals'); c.currentValuePm = null; c.futureValuePm = null; c.aci = null; c.premium = null; return c; });
    var order = {}; old.blocks.other.items.forEach(function (it) { order[it.key] = it; });
    s.blocks.other.items = schema.OTHER_KEYS.map(function (k) { return order[k.key] && !order[k.key].removed ? carry(order[k.key], 'other') : otherItem(k.key); });
    return { state: s, carried: n };
  }

  /* ---------- the Fact Find's facts ---------- */
  function ffKeyFor(list, row, counts) {
    var base = calc.norm(row.prov || row.ins || row.product || row.type || ''), k = list + ':' + base;
    counts[k] = (counts[k] || 0) + 1;
    return k + ':' + counts[k];
  }
  /* Which of the quotes the PDF and the Presentation have pages for the Fact Find asks for (Client priorities and quotes needed): a shortfall quote (BrightRock or standard) and a comparative quote (the standard lane:
     the FNA, the shortfall quote or a reduced quote asked for from any insurer). */
  function quotesAsked(f, rows) {
    var req = function (id) { return f(id) === 'Request a quote'; };
    var red = rows('redq').some(function (d) { return d.req === 'Request a quote'; });
    return { sf: req('bf_sf_req') || req('sf_req'), comparative: req('fna_req') || req('sf_req') || red };
  }
  /* Reads a saved Fact Find (parsed) and gathers what the overview uses (section 11 of the contract). */
  function factsFrom(j) {
    var f = function (id) { var c = j.f && j.f[id]; return c && c.v != null ? String(c.v).trim() : ''; };
    var rows = function (key) { return ((j.l && j.l[key]) || []).map(function (r) { return (r && r.d) || {}; }); };
    var any = function (d) { return Object.keys(d).some(function (k) { return str(d[k]) !== ''; }); };
    var keyed = function (list, fields) {
      var counts = {};
      return rows(list).filter(any).map(function (d) { var o = { ffKey: ffKeyFor(list, d, counts) }; fields.forEach(function (k) { o[k] = k === 'val' || k === 'spend' || k === 'contrib' || k === 'prem' ? money(d[k]) : str(d[k]); }); return o; });
    };
    var asked = function (list, fields) {
      var counts = {};
      return rows(list).filter(function (d) { return d.req === 'Request a quote'; }).map(function (d) { var o = { ffKey: ffKeyFor(list, d, counts) }; fields.forEach(function (k) { o[k] = k === 'monthly' || k === 'lump' ? money(d[k]) : str(d[k]); }); return o; });
    };
    var budget = function () {
      var pick = function (list) { var r = rows(list).filter(function (d) { return d.req === 'Request a quote'; }); return r.filter(function (d) { return d.type === 'Servicing'; })[0] || r.filter(function (d) { return d.type === 'New Business'; })[0] || r[0]; };
      var d = pick('bfred') || pick('redq'); return d ? money(d.amt) : null;
    };
    var ipAge = parseInt(f('ip_age'), 10);
    return {
      header: { fname: f('fname'), sname: f('sname'), dob: f('dob'), gross: money(f('gross')), net: money(f('net')), ipAge: isNaN(ipAge) ? null : ipAge, date: f('date'), sevRequest: money(f('dd_cover') || f('dds_cover')), premiumBudget: budget() },
      children: rows('kids').filter(function (d) { return str(d.name) || str(d.sname); }).map(function (d) { return { name: str(d.name), sname: str(d.sname), dob: str(d.dob), cost: money(d.cost) }; }),
      debts: rows('debts').filter(any).map(function (d) { return { type: str(d.type), prov: str(d.prov), desc: str(d.desc), bal: money(d.bal), inst: money(d.inst), term: str(d.term) }; }),
      risk: keyed('risk', ['prov', 'spend', 'broker', 'notes']), grp: keyed('grp', ['prov', 'spend', 'broker', 'notes']),
      ret_pp: keyed('ret_pp', ['type', 'prov', 'val', 'contrib', 'broker']), ret_ra: keyed('ret_ra', ['prov', 'status', 'val', 'contrib', 'broker']), inv: keyed('inv', ['type', 'prov', 'val', 'prem', 'broker']),
      raq: asked('raq', ['ins', 'monthly', 'lump']), invq: asked('invq', ['purpose', 'product', 'ins', 'monthly', 'lump']),
      rgar: /^request/i.test(f('rgar_req')), egar: /^request/i.test(f('egar_req')),
      asked: quotesAsked(f, rows),
      answers: { hasRisk: f('has_risk'), hasGroup: f('has_group'), hasRa: f('has_ra'), hasPp: f('has_pp'), hasInv: f('has_inv'), raqReqs: rows('raq').map(function (d) { return str(d.req); }).filter(Boolean), refSti: f('ref_sti') },     // what the Fact Find answered, for the Presentation's sentences (never guessed: an empty answer says so)
      other: { ma: { value: f('ma'), provider: f('ma_prov'), plan: f('ma_plan'), broker: f('ma_broker') }, gap: { value: f('gap'), provider: f('gap_prov'), broker: f('gap_broker') },
        will: { value: f('will'), where: f('will_where') === 'Other' ? f('will_where_other') : f('will_where'), up: f('will_up'), broker: f('will_broker'), date: f('will_date') },
        shortterm: { value: f('sti'), broker: f('sti_broker'), personal: money(f('sti_personal')) } },
      otherDetail: { ma: { note: f('n_ma') }, gap: { note: f('n_gap') }, will: { note: f('n_will'), ref: f('ref_will') }, shortterm: { note: f('n_sti'), car: f('sti_car'), house: f('sti_house'), struct: f('sti_struct'), biz: f('sti_biz'), bizSpend: money(f('sti_biz_spend')), ref: f('ref_sti') } }          // round 2: what the Fact Find's notes and answers say about each cover of block 11
    };
  }
  /* The facts as a flat list of "where = value", so two readings of the Fact Find can be compared. */
  function flat(facts) {
    var out = {};
    (function walk(o, p) {
      if (o == null || typeof o !== 'object') { out[p] = o; return; }
      if (Array.isArray(o)) { o.forEach(function (x, i) { walk(x, p + '.' + (x && x.ffKey ? x.ffKey : i)); }); return; }
      Object.keys(o).forEach(function (k) { if (k !== 'ffKey') walk(o[k], p ? p + '.' + k : k); });
    })(facts || {}, '');
    return out;
  }
  /* How many items of the Fact Find differ between two readings of it. */
  function diffFacts(a, b) {
    ['asked', 'answers', 'otherDetail'].forEach(function (k) {                                                   // a key an older reading did not have is not a change in the Fact Find
      var oldHad = a && a[k] !== undefined, newHad = b && b[k] !== undefined;
      if (oldHad !== newHad) { a = Object.assign({}, a); b = Object.assign({}, b); delete a[k]; delete b[k]; }
    });
    var x = flat(a), y = flat(b), seen = {}, items = {};
    Object.keys(x).concat(Object.keys(y)).forEach(function (k) {
      if (seen[k]) return; seen[k] = 1;
      if (JSON.stringify(x[k] === undefined ? null : x[k]) === JSON.stringify(y[k] === undefined ? null : y[k])) return;
      var p = k.replace(/^\./, '').split('.');                                                           // one item is a header box, a child, a debt, a policy row, a list row or one of the other answers
      items[p[0] === 'rgar' || p[0] === 'egar' ? p[0] : p[0] + '.' + p[1]] = 1;
    });
    return Object.keys(items).length;
  }
  var isWR = function (broker) { return broker === 'Paul K'; };
  var dm = function (v) { var m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/.exec(String(v || '')); return m ? ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) : String(v || ''); };          // dd/mm/yyyy as dd/mm, for the source tag of a note
  function ffSrc(name) { return { kind: 'factfind', file: name || '', page: null, date: schema.todayDMY() }; }
  function findByKey(list, key) { var hit = null; (list || []).forEach(function (i) { if (i.ffKey === key) hit = i; }); return hit; }
  function present(v) { return v != null && v !== ''; }

  /* Make the blocks follow the Fact Find. Skeleton items are added for every row of the Fact Find that has none (never removed again); an item that still only has the Fact Find's figures (st ff) is brought up to date;
     an item a document has filled is never overwritten (the difference shows in the checks). Returns { added, updated }. */
  function syncBlocks(state, facts, name) {
    var rep = { added: 0, updated: 0 }, src = ffSrc(name), B = state.blocks;
    function upd(item, fields) { // fields: [key, value]; only for items still waiting for a document
      if (item.st !== 'ff' && item.st !== 'empty') return;
      var ch = false; fields.forEach(function (f) { if (JSON.stringify(item[f[0]]) !== JSON.stringify(f[1])) { item[f[0]] = f[1]; ch = true; } });
      if (ch) { item.st = 'ff'; item.by = 'page'; item.src = src; rep.updated++; }
    }
    facts.risk.forEach(function (r) {
      var it = findByKey(B.policies.items, r.ffKey);
      if (!it) { B.policies.items.push({ id: 'ff-' + r.ffKey.replace(/[^a-z0-9]+/g, '-'), ffKey: r.ffKey, wr: isWR(r.broker), insurer: r.prov, product: '', policyNo: '', doc: null, broker: r.broker, premium: r.spend, aci: null, aciText: null, abi: null, ipAge: null,
        benefits: {}, cession: null, lines: [], cmp: null, st: 'ff', src: src, by: 'page', removed: false }); rep.added++; }
      else upd(it, [['insurer', r.prov], ['broker', r.broker], ['wr', isWR(r.broker)], ['premium', r.spend]]);
    });
    facts.grp.forEach(function (r) {
      var it = findByKey(B.group.items, r.ffKey);
      if (!it) { B.group.items.push({ id: 'ff-' + r.ffKey.replace(/[^a-z0-9]+/g, '-'), ffKey: r.ffKey, kind: 'risk', provider: r.prov, statementDate: null, life: { amount: null, endAge: null }, sev: { amount: null, endAge: null },
        lsd: { amount: null, endAge: null }, ip: { amount: null, endAge: null }, ipWaiting: null, aci: null, abi: null, monthlyCost: r.spend, paidBy: null, basis: null, wr: isWR(r.broker), st: 'ff', src: src, by: 'page', removed: false }); rep.added++; }
      else upd(it, [['provider', r.prov], ['monthlyCost', r.spend]]);
    });
    facts.ret_pp.forEach(function (r) {
      var it = findByKey(B.group.items, r.ffKey), kind = /^provident/i.test(r.type) ? 'provident' : 'pension';
      if (!it) { B.group.items.push({ id: 'ff-' + r.ffKey.replace(/[^a-z0-9]+/g, '-'), ffKey: r.ffKey, kind: kind, provider: r.prov, value: r.val, employer: null, employee: null, contribTotal: r.contrib, aci: null, note: '', wr: isWR(r.broker),
        st: 'ff', src: src, by: 'page', removed: false }); rep.added++; }
      else upd(it, [['provider', r.prov], ['value', r.val], ['contribTotal', r.contrib]]);
    });
    function inv(r, product, list) {
      var it = findByKey(B.investments.items, r.ffKey);
      if (!it) { B.investments.items.push({ id: 'ff-' + r.ffKey.replace(/[^a-z0-9]+/g, '-'), ffKey: r.ffKey, wr: isWR(r.broker), provider: r.prov, product: product, policyNo: '', valueDate: null, valueSource: null, gross: r.val, penalty: null,
        returnRate: null, aci: null, monthly: list === 'ret_ra' ? r.contrib : r.prem, st: 'ff', src: src, by: 'page', removed: false }); rep.added++; }
      else upd(it, [['provider', r.prov], ['gross', r.val], ['monthly', list === 'ret_ra' ? r.contrib : r.prem], ['wr', isWR(r.broker)]]);
    }
    facts.ret_ra.forEach(function (r) { inv(r, 'Retirement annuity', 'ret_ra'); });
    facts.inv.forEach(function (r) { inv(r, r.type, 'inv'); });
    function prop(r, type) {
      var it = findByKey(B.proposed.items, r.ffKey), both = r.lump && r.monthly, c = both ? 'both' : (r.lump ? 'lump' : 'monthly');
      if (!it) { var p = newProposed(); Object.assign(p, { ffKey: r.ffKey, type: type, provider: r.ins, contribution: c, lump: r.lump, monthly: r.monthly, st: 'ff', src: src, by: 'page' }); B.proposed.items.push(p); rep.added++; }
      else upd(it, [['provider', r.ins], ['lump', r.lump], ['monthly', r.monthly], ['contribution', c]]);
    }
    facts.raq.forEach(function (r) { prop(r, 'Retirement annuity (RA)'); });
    facts.invq.forEach(function (r) {
      var t = /tax/i.test(r.product) ? 'Tax-free investment' : /endow/i.test(r.product) ? 'Endowment' : /unit/i.test(r.product) ? 'Unit trusts (open-ended)' : (/living/i.test(r.product) ? 'Retirement annuity (RA)' : 'Unit trusts (open-ended)');
      prop(r, t);
    });
    [['rgar', facts.rgar], ['egar', facts.egar]].forEach(function (x) {
      var it = null; B.goals.items.forEach(function (g) { if (g.kind === x[0]) it = g; });
      var note = x[1] ? '' : 'Client did not request for at this time';
      if (!it) { B.goals.items.push({ id: 'goal-' + x[0], kind: x[0], requested: x[1], note: note, currentValuePm: null, futureValuePm: null, aci: null, premium: null, st: 'ff', src: src, by: 'page', removed: false }); rep.added++; }
      else if (it.st === 'ff' || it.st === 'empty') { if (it.requested !== x[1]) { it.requested = x[1]; it.note = note; it.st = 'ff'; it.src = src; rep.updated++; } }
    });
    var od = facts.otherDetail || {}, ffDate = facts.header && facts.header.date, ffTag = ' (Fact Find' + (ffDate ? ' ' + dm(ffDate) : '') + ')';
    var join = function (parts) { return parts.filter(Boolean).join('; '); }, yes = function (v) { return v === 'Yes'; };
    /* What the Fact Find asked and answered for each cover of block 11, in the item's own boxes (company, product, broker, premium) and in the note (the answers and the Fact Find's own notes, ending with where it came from). */
    function pickOf(key) {
      var o = facts.other, ma = o.ma, gap = o.gap, wl = o.will, st = o.shortterm, mad = od.ma || {}, gapd = od.gap || {}, wd = od.will || {}, sd = od.shortterm || {}, text = '', pick;
      if (key === 'medical') {
        text = join([ma.value === 'None' ? 'No medical aid' : ma.value, ma.value && ma.value !== 'None' && ma.broker ? 'broker ' + ma.broker : '', mad.note]);
        pick = { company: ma.provider, product: ma.plan, wr: isWR(ma.broker), note: text };
      } else if (key === 'gap') {
        text = join([gap.value ? 'Gap cover: ' + gap.value : (ma.value === 'None' ? 'No medical aid, so no gap cover' : ''), gap.value && gap.value !== 'No' && gap.broker ? 'broker ' + gap.broker : '', gapd.note]);
        pick = { company: gap.provider, wr: isWR(gap.broker), note: text };
      } else if (key === 'will') {
        var has = wl.value === 'Yes' ? (wl.up === 'Yes' ? 'Has a will, up to date' : wl.up === 'No' ? 'Has a will, not up to date' : 'Has a will') : wl.value === 'No' ? 'No will' : wl.value;
        text = join([has, wl.date ? 'last updated ' + wl.date : '', wl.where ? 'held with ' + wl.where : '', wl.value === 'Yes' && wl.broker ? 'broker ' + wl.broker : '', wd.note]);
        pick = { company: wl.where, wr: isWR(wl.broker), note: text };
      } else if (key === 'legacy') {
        var cap = /capital legacy/i.test(wl.where || '') || /capital legacy/i.test(wd.ref || '');
        text = join([wd.ref]);
        pick = cap || text ? { company: cap ? 'Capital Legacy' : '', note: text } : {};
      } else if (key === 'shortterm') {
        var covers = [yes(sd.car) ? 'car' : '', yes(sd.house) ? 'household contents' : '', yes(sd.struct) ? 'structural' : '', yes(sd.biz) ? 'business' : ''].filter(Boolean);
        text = join([st.value === 'Yes' ? 'Has short-term insurance' : st.value === 'No' ? 'No short-term insurance' : st.value, st.value === 'Yes' && st.broker ? 'broker ' + st.broker : '', covers.length ? 'covers ' + covers.join(', ') : '',
          calc.isNum(sd.bizSpend) ? 'business spend ' + calc.fmtR(sd.bizSpend) : '', sd.note, sd.ref]);
        pick = { company: '', wr: false, note: text, premium: st.personal };
      } else pick = {};
      if (pick.note) pick.note += ffTag; else delete pick.note;
      return pick;
    }
    B.other.items.forEach(function (it) {
      var pick = pickOf(it.key);
      if (it.st !== 'ff' && it.st !== 'empty') {                                                               // a later update (the Summary Notes) was added: the Fact Find's part stays in front of it
        if (it.src && it.src.kind === 'followup' && pick.note && !/\(Fact Find/.test(it.note || '')) it.note = pick.note + ' · ' + (it.note || '');
        /* Round 4 (23 November): whatever the item's status (to check, confirmed, carried over from last year's overview by New review year), a box that is still EMPTY gets the Fact Find's answer; what is written there is never touched.
           Last year's note (carried over, with no Fact Find tag) gets this year's Fact Find part in front. */
        var filled = false;
        ['company', 'product', 'premium', 'note'].forEach(function (k) { var cur = it[k]; if ((cur == null || String(cur).trim() === '') && pick[k] != null && pick[k] !== '') { it[k] = pick[k]; filled = true; } });
        if (it.src && it.src.kind === 'previous' && pick.note && it.note && !/\(Fact Find/.test(it.note)) { it.note = pick.note + ' · ' + it.note; filled = true; }
        if (filled) { rep.updated++; if (it.st === 'confirmed') { it.st = 'ff'; it.by = 'page'; it.src = src; } }
        return;
      }
      var prev = JSON.stringify(it);
      Object.keys(pick).forEach(function (k) { if (pick[k] != null && pick[k] !== '') it[k] = pick[k]; });
      if (JSON.stringify(it) !== prev || it.st === 'empty') { var had = Object.keys(pick).some(function (k) { return pick[k] != null && pick[k] !== '' && !(k === 'wr' && pick[k] === false); }); if (had) { it.st = 'ff'; it.src = src; it.by = 'page'; rep.updated++; } }
    });
    return rep;
  }

  /* Fill the overview from a saved Fact Find (text). The header is filled only where it is empty. The Fact Find's facts are kept (factFind.facts) so a later reading can say how many items changed.
     Returns { added, updated, changed, first, kept: [header fields left as they were] }. */
  function fillFromFactFind(state, text, name) {
    var j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('That file cannot be read as a Fact Find.'); }
    if (!j || j.app !== FF_APP_ID) throw new Error('This file is not a Wealth Revolution Fact Find.');
    var facts = factsFrom(j), first = !state.factFind, h = state.header, kept = [], hf = facts.header, put = function (key, v, label) {
      if (v == null || v === '') return;
      if (h[key] == null || h[key] === '') h[key] = v; else if (JSON.stringify(h[key]) !== JSON.stringify(v)) kept.push(label);
    };
    put('fname', hf.fname, 'first names'); put('sname', hf.sname, 'surname'); put('dob', hf.dob, 'date of birth'); put('netIncome', hf.net, 'net income'); put('grossIncome', hf.gross, 'gross income');
    put('disabilityAge', hf.ipAge, 'disability age'); put('meetingDate', hf.date, 'meeting date'); put('sevRequest', hf.sevRequest, 'severe illness request'); put('premiumBudget', hf.premiumBudget, 'premium budget');
    var changed = first ? 0 : diffFacts(state.factFind.facts, facts);
    var rep = syncBlocks(state, facts, name);
    state.factFind = { file: String(name || ''), schema: String(j.schema || ''), readAt: new Date().toISOString(), changed: changed, facts: facts };
    return { added: rep.added, updated: rep.updated, changed: changed, first: first, kept: kept };
  }

  /* ---------- saving and opening ---------- */
  function fileName(state) { return schema.fileName(state); }
  function clientName(state) { return schema.clientFull(state); }
  /* The figures written into the saved file for readers (never read back). */
  function computed(state) {
    var c = { totals: {}, compare: {}, policies: calc.policyTotals(state), personalInvestments: calc.personalInvestments(state), shortfall: null };
    calc.allQuotes(state).forEach(function (q) { c.totals[q.id] = calc.totals(q); c.compare[q.id] = calc.compare(state, q); });
    var sf = calc.shortfall(state); if (sf.has) c.shortfall = { fna: sf.fna, group: sf.group, personalInvestments: sf.pi.gross, shortfall: sf.short };
    return c;
  }
  function toJSON(state) {
    state.modified = new Date().toISOString(); state.computed = computed(state);
    var out = Object.assign({}, state._extra || {}, state); delete out._extra; delete out.newer; delete out.dups; delete out.flattened;
    return JSON.stringify(out, null, 2);
  }
  var KNOWN = { app: 1, schema: 1, created: 1, modified: 1, header: 1, factFind: 1, documents: 1, settings: 1, blocks: 1, computed: 1 };
  function normLine(l) {
    l = l && typeof l === 'object' ? l : {};
    var t = schema.lineTypesById[l.type] ? l.type : 'other';
    var n = Object.assign(newLine(t), l); n.type = t; n.id = n.id || uid('l'); n.st = ST[l.st] ? l.st : 'verify'; n.removed = !!n.removed;
    if (t === 'debt') n.accelerated = n.accelerated === true || n.accelerated === false ? n.accelerated : (/^accelerated$/i.test(String(n.accelerated || '')) ? true : /^stand ?alone$/i.test(String(n.accelerated || '')) ? false : null);
    if (t === 'child') n.waiting = 'N/A';                                                                          // Paul's rule (22 November): a child care line has no waiting period, whatever an older file or a document says
    ['life', 'sev', 'lsd', 'ip'].forEach(function (p) { if (n[p] !== 'N/A' && (n[p] == null || typeof n[p] !== 'object')) n[p] = newLine(t)[p]; });
    calc.settleLine(n);                                                                                            // an older file: the dread line has no life cover, a need with a lump sum of 0 has an income portion of 0
    return n;
  }
  function normRow(r) { r = r && typeof r === 'object' ? r : {}; r.id = r.id || uid('r'); r.st = ST[r.st] ? r.st : 'verify'; r.removed = !!r.removed; if (Array.isArray(r.lines)) r.lines = r.lines.map(normLine); return r; }
  function fromJSON(text) {
    var j = JSON.parse(text);
    if (!j || j.app !== APP_ID) throw new Error('This file is not a Wealth Revolution Client Overview.');
    var s = blank();
    s.created = j.created || s.created; s.modified = j.modified || null;
    Object.keys(s.header).forEach(function (k) { if (j.header && j.header[k] !== undefined) s.header[k] = j.header[k]; });
    s.factFind = j.factFind && typeof j.factFind === 'object' ? j.factFind : null;
    s.documents = (Array.isArray(j.documents) ? j.documents : []).filter(function (d) { return d && typeof d === 'object'; }).map(function (d) { return { id: d.id || uid('d'), file: String(d.file || ''), block: String(d.block || ''), how: d.how === 'read' ? 'read' : 'name', at: String(d.at || '') }; });
    if (j.settings) { if (j.settings.standards) s.settings.standards = Object.assign(clone(schema.STANDARDS), j.settings.standards); if (typeof j.settings.tolerance === 'number') s.settings.tolerance = j.settings.tolerance; }
    var other = {};
    Object.keys(s.blocks).forEach(function (b) {
      var src = (j.blocks && j.blocks[b]) || {};
      if (s.blocks[b].quotes) s.blocks[b].quotes = (src.quotes || []).map(function (q) { q = normRow(q); q.kind = q.kind || ({ fna: 'fna', shortfallQuote: 'shortfall', reduced: 'reduced', comparative: 'comparative' }[b]); q.status = schema.statusLabel[q.status] ? q.status : 'pending'; q.lines = q.lines || []; return q; });
      else if (b === 'other') { (src.items || []).forEach(function (it) { it = normRow(it); var k = it.key; s.blocks.other.items = s.blocks.other.items.filter(function (x) { return x.key !== k; }); s.blocks.other.items.push(it); }); }
      else s.blocks[b].items = (src.items || []).map(normRow);
    });
    var order = schema.OTHER_KEYS.map(function (k) { return k.key; }); s.blocks.other.items.sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); });
    s.dups = dedupeQuotes(s);                                                                                  // not saved: how many extra copies of a quote were dropped on opening (the screen says so)
    s.flattened = 0; s.blocks.policies.items.forEach(function (it) { if (flattenPolicyLines(it)) s.flattened++; });
    Object.keys(j).forEach(function (k) { if (!KNOWN[k]) other[k] = j[k]; });
    if (Object.keys(other).length) s._extra = other;
    if (parseFloat(j.schema) > parseFloat(schema.version)) s.newer = true;
    return s;
  }

  /* ---------- one quote once, and a policy of another insurer as one row (Paul, 23 November) ---------- */
  var NEED_TYPES = { household: 1, child: 1, debt: 1, death: 1, dread: 1 };
  function isBright(name) { return /bright/i.test(String(name == null ? '' : name)); }
  function numKey(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  /* The need-by-need lines (household, child care, debts, death-related needs, additional expense needs) belong only to a BrightRock policy that is in force. A policy of any other insurer is ONE row with its benefits:
     its need lines become ONE line of type "other" (each benefit added up from the lines it was on; the label is the product). Nothing is invented; a policy with no insurer yet is left alone. Returns true when it changed anything. */
  function flattenPolicyLines(item) {
    if (!item || !str(item.insurer) || isBright(item.insurer) || !Array.isArray(item.lines)) return false;
    var needs = item.lines.filter(function (l) { return l && !l.removed && NEED_TYPES[l.type]; });
    if (!needs.length) return false;
    var one = newLine('other', { label: str(item.product) || 'Policy benefits' }), tot = calc.sumLines(needs), first = needs[0], any = function (p, k) { return needs.some(function (l) { var c = l[p]; return c && typeof c === 'object' && calc.isNum(c[k]); }); };
    schema.PILLARS.forEach(function (p) { p.keys.forEach(function (k) { one[p.id][k] = any(p.id, k) ? tot[p.id][k] : null; }); });
    var term = needs.map(function (l) { return str(l.term); }).filter(Boolean)[0], wait = needs.map(function (l) { return str(l.waiting); }).filter(function (w) { return w && w !== 'N/A'; })[0], abi = needs.map(function (l) { return l.abi; }).filter(calc.isNum)[0];
    one.term = term || null; one.waiting = wait || null; one.abi = abi === undefined ? null : abi;
    one.st = first.st || 'verify'; one.by = first.by || 'page'; one.src = first.src || null;
    var at = item.lines.indexOf(first), rest = item.lines.filter(function (l) { return !(l && NEED_TYPES[l.type]); });
    rest.splice(Math.min(at, rest.length), 0, one); item.lines = rest;
    return true;
  }
  /* A quote that is in a block twice (the same number: a document read twice, a folder listing the same file twice) is kept ONCE: the copy with the change moment pay-out, else with more lines, else the first one.
     The extra copy is dropped from the file; a "replaced by" link to it is pointed at the copy that stays. Returns how many copies were dropped. */
  function dedupeQuotes(state) {
    var dropped = 0, score = function (q) { return (q.cmp ? 1000 : 0) + calc.activeLines(q).filter(function (l) { return l.st !== 'ff' && l.st !== 'empty'; }).length * 10 + calc.activeLines(q).length + (q.st === 'confirmed' ? 5 : 0) + (q.policyNo ? 3 : 0); };
    schema.QUOTE_KINDS.forEach(function (k) {
      var b = state.blocks[schema.blockOfQuote[k]], at = {}, keep = [];
      (b.quotes || []).forEach(function (q) {
        var key = q.removed ? '' : numKey(q.number);
        if (!key) { keep.push(q); return; }
        if (at[key] === undefined) { at[key] = keep.length; keep.push(q); return; }
        var cur = keep[at[key]], win = score(q) > score(cur) ? q : cur, lose = win === q ? cur : q;
        keep[at[key]] = win; dropped++;
        (b.quotes || []).forEach(function (x) { if (x.replacedBy === lose.id) x.replacedBy = win.id; });
      });
      b.quotes = keep;
    });
    return dropped;
  }

  /* ---------- how far the overview is ---------- */
  function rows(state, blockId) {
    var b = state.blocks[blockId], out = [];
    (b.items || []).concat(b.quotes || []).forEach(function (r) { if (!r.removed) out.push(r); });
    return out;
  }
  function counts(state) {
    var c = { confirmed: 0, check: 0, waiting: 0 };
    walkRows(state, function (r) { if (r.removed) return; if (r.st === 'confirmed') c.confirmed++; else if (r.st === 'ff' || r.st === 'verify') c.check++; else c.waiting++; });
    return c;
  }

  return { blank: blank, uid: uid, parseCell: parseCell, setPath: setPath, pathGet: pathGet, accept: accept, acceptAll: acceptAll, walkRows: walkRows, newLine: newLine, newQuote: newQuote, addQuote: addQuote, findQuote: findQuote,
    setRemoved: setRemoved, newCmp: newCmp, addCmp: addCmp, removeCmp: removeCmp, startReview: startReview, addLine: addLine, addItem: addItem, newProposed: newProposed, factsFrom: factsFrom, diffFacts: diffFacts, syncBlocks: syncBlocks, fillFromFactFind: fillFromFactFind, fileName: fileName,
    clientName: clientName, computed: computed, dedupeQuotes: dedupeQuotes, flattenPolicyLines: flattenPolicyLines, isBright: isBright, toJSON: toJSON, fromJSON: fromJSON, rows: rows, counts: counts, ffKeyFor: ffKeyFor, APP_ID: APP_ID };
});
