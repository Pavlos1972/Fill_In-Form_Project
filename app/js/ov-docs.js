/* The Client Overview's documents (stage 4): a document is sorted into its block by its name, read (only when the adviser has switched reading on: it sends the document to Anthropic, so it is OFF until then) and
   what was read is put into the overview as rows that are amber "to check", each with the file it came from. With reading off the document is only recorded (and a quote started from the number and the date in
   its file name), and the figures are typed from it. Blocks 1, 3 and 8 follow the Fact Find: a document fills the details of an item that is already there and never adds or removes one.
   Everything read is a suggestion: nothing is ever marked "checked" here (docs/OVERVIEW-DATA-CONTRACT.md section 2). Loads in the browser (window.OV.docs) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./ov-schema.js'), require('./ov-calc.js'), require('./ov-store.js'));
  else { root.OV = root.OV || {}; root.OV.docs = factory(root.FF.util, root.OV.schema, root.OV.calc, root.OV.store); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc, store) {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages', API_VERSION = '2023-06-01';
  var BLOCK_LABEL = { policies: 'Current policies', fna: 'FNA quote', group: 'Group benefits', shortfallQuote: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote', investments: 'Current investments', astute: 'Astute report', cmp: 'Change moment pay-out guide', proposed: 'Proposed investment', goals: 'Goal analysis report', other: 'Legacy protection plan' };
  var QUOTE_OF = { fna: 'fna', shortfallQuote: 'shortfall', reduced: 'reduced', comparative: 'comparative' };

  /* ---------- sorting a document by its name ---------- */
  function two(n) { return (n < 10 ? '0' : '') + n; }
  /* The block a file belongs to, and what its name says: the quote number (6 to 12 digits), the date (dd.mm.yy). Returns null when the name does not say. */
  function classify(fileName) {
    var n = String(fileName == null ? '' : fileName).replace(/\.[A-Za-z0-9]{2,5}$/, ''), low = n.toLowerCase(), m, date = '', number = '';
    if ((m = /(\d{6,12})/.exec(n))) number = m[1];
    if ((m = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})(?!\d)/.exec(n))) { var y = +m[3]; if (y < 100) y += 2000; date = two(+m[1]) + '/' + two(+m[2]) + '/' + y; }
    var block = null;
    if (/cmpo|change[ _-]?moment/.test(low)) block = 'cmp';
    else if (/rgar|egar|goal[ _-]?analysis|goal[ _-]?report|retirement goal|education goal/.test(low)) block = 'goals';
    else if (/(^|[^a-z])fna([^a-z]|$)/.test(low)) block = 'fna';
    else if (/shortfall/.test(low)) block = 'shortfallQuote';
    else if (/reduced/.test(low)) block = 'reduced';
    else if (/astute/.test(low)) block = 'astute';
    else if (/group|funds ?at ?work|benefit statement|membership certificate|certificate/.test(low)) block = 'group';
    else if (/(optimal|tax[ _-]?free|retirement annuity|endowment|unit trust|living annuity|investment).*(quote|proposal|illustration)|(quote|proposal|illustration).*(optimal|tax[ _-]?free|retirement annuity|endowment|living annuity)/.test(low)) block = 'proposed';
    else if (/(momentum|sanlam|discovery|liberty|old mutual|hollard|assupol|metropolitan|absa|bidvest|clientele).*(quote|proposal|illustration)|comparative/.test(low)) block = 'comparative';
    else if (/schedule|policy|(^|[^a-z])ps([^a-z]|$)/.test(low)) block = 'policies';
    else if (/investment|statement|(^|[^a-z])ra([^a-z]|$)|retirement annuity|tax.?free|endowment|unit trust|fund value/.test(low)) block = 'investments';
    return block ? { block: block, number: number, date: date, label: BLOCK_LABEL[block] } : null;
  }

  /* ---------- reading with Claude (only when switched on) ---------- */
  var RULES = 'Answer with ONE JSON object and nothing else. Amounts are plain numbers in rand (no R, no spaces, no commas); percentages are plain numbers (10 means 10%); dates are dd/mm/yyyy. Copy only what the document says: if you cannot find ' +
    'a figure, write null, never a guess. Write "N/A" only where the document marks a cell as not applicable. Do not add, work out or round anything.';
  var LINE = '{ "type": "household" | "child" | "debt" | "death" | "dread" | "other", "label": "text", "term": "text as printed", "name": "child first name", "sname": "child surname", "debt": "debt name as printed", "bank": "bank", ' +
    '"life": { "lump": n, "monthly": n }, "sev": { "lump": n }, "lsd": { "lump": n, "monthly": n }, "ip": { "monthly": n }, "waiting": "text as printed", "abi": n | "Not found" }';
  var SPECS = {
    quote: 'This is an insurance quote (BrightRock or another insurer). Return { "insurer": "text", "number": "the quote or CP number as printed", "date": "dd/mm/yyyy", "rates": "e.g. Non-smoker rates", "aci": n (the yearly premium increase as a number), "aciText": "the yearly premium increase EXACTLY as the quote words it, for example 7.5% + age rater, or CPI + 2%; null when the quote only gives a figure", "premium": n (the total monthly premium), ' +
      '"abi": n (only when the quote prints ONE annual benefit increase for the whole quote), "servicing": true | false (true when the quote is for a policy the client already has, a review or servicing quote; false for new business), "disabilityAge": n (the age lump sum disability and the income protector run to), "lines": [ ' + LINE + ' ], "printedTotals": { "life": { "lump": n, "monthly": n }, "sev": { "lump": n }, "lsd": { "lump": n, "monthly": n }, "ip": { "monthly": n } } }. ' +
      'Each need (household, each child, each debt, death-related needs, additional expense needs / dread) is one line; the monthly figure printed under a lump sum is "monthly". A child line has the child\'s name and surname; a debt line the debt\'s name and the bank. ' +
      'EVERY line has its own "abi": the annual benefit increase (annual base increase) of that need, as a number. BrightRock prints it for each need, or once for the whole quote: when it is printed once, copy it onto every line it covers (and also give it as "abi" of the quote). ' +
      'When the quote prints no annual benefit increase for a line, write "Not found" in that line\'s "abi", never null. Severe illness has an amount only on the lines where the quote gives one (the additional expense needs line); leave it null on the others. ' +
      'For a quote that does not list needs separately (other insurers), give one line of type "other" for each benefit with its label. printedTotals is only what the document itself prints as totals; leave it null if it prints none.',
    policy: 'This is a policy schedule. Return { "insurer": "text", "product": "text", "policyNo": "text", "doc": "dd/mm/yyyy (date of commencement)", "premium": n (monthly), "aci": n, "aciText": "the yearly premium increase exactly as the schedule words it, or null when it only gives a figure", "abi": n, "ipAge": n, "benefits": { "life": "short description as printed", "lsd": "...", "ip": "..." }, "lines": [ ' + LINE + ' ] }. ' +
      'Give one line for each benefit or need with its amounts; use type "other" for a benefit that is not a need.',
    group: 'This is a group risk benefit statement or a pension / provident fund statement. Return { "provider": "text", "statementDate": "dd/mm/yyyy", "basis": "e.g. 1.5 x insurance salary", "paidBy": "employer" | "employee" | "both" | null, "monthlyCost": n, "ipWaiting": "text", "aci": n, "abi": n, ' +
      '"life": { "amount": n, "endAge": "age or Whole of life as printed" }, "sev": { "amount": n, "endAge": "..." }, "lsd": { "amount": n, "endAge": "..." }, "ip": { "amount": n (a month), "endAge": "..." }, "value": n (fund value), "employer": n (a month), "employee": n (a month) }. ' +
      'Write "Not found" in endAge when the statement does not give the age a benefit ends.',
    investment: 'This is an investment or retirement annuity statement or schedule. Return { "provider": "text", "product": "text", "policyNo": "text", "valueDate": "dd/mm/yyyy", "valueKind": "schedule", "gross": n (fund value), "penalty": n (Section 14 transfer penalty), "returnRate": n (since inception), "aci": n (the yearly contribution increase; write "Not found" if the schedule does not give it), "monthly": n (the monthly premium or contribution) }.',
    astute: 'This is an Astute report. Return { "reportDate": "dd/mm/yyyy", "investments": [ { "provider": "text", "product": "text", "policyNo": "text", "gross": n, "monthly": n } ] } with every investment and retirement annuity in it.',
    proposal: 'This is a quote or proposal for an investment (a retirement annuity, a tax-free investment, an endowment, unit trusts, a Section 14 or pension / provident fund transfer, a living annuity). Return { "provider": "text", "type": "Tax-free investment" | "Retirement annuity (RA)" | "Endowment" | "Unit trusts (open-ended)" | "Section 14 transfer" | "Pension / provident fund transfer", "number": "the quote number as printed", ' +
      '"contribution": "lump" | "monthly" | "both" | "transfer", "lump": n (a lump sum), "monthly": n (the monthly premium), "boostPct": n (the boost or bonus on the contribution as a percentage, only if printed), "netInvested": n (the net amount invested after charges and boost, only if printed), "aci": n (the yearly contribution increase) }.',
    goal: 'This is a Retirement Goal Analysis Report (RGAR) or an Education Goal Analysis Report (EGAR). Return { "kind": "rgar" | "egar", "note": "a short reason, only if the report says it could not be done or is not applicable, else null", "currentValuePm": n (the current value in rand a month, gross), "futureValuePm": n (the future value in rand a month, gross), "aci": n, "premium": n (the monthly premium) }.',
    cmp: 'This is a BrightRock change moment pay-out guide. Return { "number": "the CP number", "activationDate": "dd/mm/yyyy", "reason": "BrightRock\'s reason, only if it gives no pay-out, else null", "rows": [ { "key": "total" | "retirement" | "childcare" | "child", "name": "child first name", "sname": "child surname", "today": n, "projected": n, "payoutDate": "dd/mm/yyyy" or null } ] }.'
  };
  var SPEC_OF = { fna: 'quote', shortfallQuote: 'quote', reduced: 'quote', comparative: 'quote', policies: 'policy', group: 'group', investments: 'investment', astute: 'astute', cmp: 'cmp', proposed: 'proposal', goals: 'goal', other: 'policy' };
  /* What the Fact Find says about the client's debts and children, for the reading of a quote (the quote often prints no bank or the debt's name): Claude is asked to name each debt line from it. '' when there is nothing. */
  function factNote(state) {
    var f = state && state.factFind && state.factFind.facts; if (!f) return '';
    var debts = (f.debts || []).map(function (d) { return '- ' + [d.desc || d.type, d.prov ? 'bank: ' + d.prov : '', calc.isNum(d.bal) ? 'balance R' + d.bal : '', calc.isNum(d.inst) ? 'instalment R' + d.inst + ' a month' : ''].filter(Boolean).join(', '); });
    var kids = (f.children || []).map(function (c) { return '- ' + [c.name, c.sname].filter(Boolean).join(' '); });
    if (!debts.length && !kids.length) return '';
    return 'The adviser\'s Fact Find for this client lists these debts and children. Match each debt line and child line of the quote to one of them and use their names (and the bank of a debt) where the quote does not print them; do not invent a line the quote does not have.\n' +
      (debts.length ? 'Debts:\n' + debts.join('\n') + '\n' : '') + (kids.length ? 'Children:\n' + kids.join('\n') : '');
  }
  function promptFor(block, ctx) {
    return 'You read insurance documents for a South African financial adviser. ' + RULES + '\n\n' + SPECS[SPEC_OF[block]] + (ctx && ctx.clientNote ? '\n\n' + ctx.clientNote : '');
  }
  /* The first JSON object in the reply (the model may fence it). */
  function parseReply(text) {
    var t = String(text || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Claude did not give anything that could be read.');
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error('Claude\'s answer could not be read as figures. Try again, or type them in.'); }
  }
  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'The API key was not accepted. Check it in the Fact Find\'s Settings.';
    if (status === 413 || /too large|too many pages/i.test(msg)) return 'That document is too big for Claude to read. Type the figures in instead.';
    if (status === 429) return 'Too many requests just now. Wait a minute and try again.';
    return 'Anthropic said: ' + (msg || 'error ' + status);
  }
  /* o: { apiKey, model, fetch, mediaType, base64, block, ctx } -> resolves { data, usage } */
  function readWithClaude(o) {
    var doFetch = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (!o.apiKey) return Promise.reject(new Error('Add your Anthropic API key in the Fact Find\'s Settings first.'));
    if (!SPEC_OF[o.block]) return Promise.reject(new Error('That kind of document cannot be read here.'));
    var kind = /^image\//.test(o.mediaType) ? 'image' : 'document';
    var body = { model: o.model, max_tokens: 8000, messages: [{ role: 'user', content: [{ type: kind, source: { type: 'base64', media_type: o.mediaType || 'application/pdf', data: o.base64 } }, { type: 'text', text: promptFor(o.block, o.ctx) }] }] };
    return doFetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': o.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(friendly(res.status, j));
        if (j.stop_reason === 'refusal') throw new Error('Claude could not read this document.');
        var text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join(' ');
        return { data: parseReply(text), usage: j.usage || null };
      });
    }, function () { throw new Error('Could not reach Anthropic. Check the internet connection.'); });
  }

  /* ---------- putting what was read into the overview ---------- */
  function today() { return schema.todayDMY(); }
  function srcOf(kind, file, date) { return { kind: kind, file: String(file || ''), page: null, date: date || today() }; }
  function n(v) { return store.parseCell(v == null ? '' : (typeof v === 'number' ? String(v) : v), 'money'); }
  function s(v) { return v == null || v === '' ? null : String(v).trim() || null; }
  function dmy(v) { var t = s(v); if (!t) return null; var d = util.parseDate(t); return d ? util.formatDate(d) : t; }
  /* A line as the document gave it: only the known cells, as numbers; anything else is dropped. */
  function line(l, src, o) {
    o = o || {};
    l = l && typeof l === 'object' ? l : {};
    var t = schema.lineTypesById[l.type] ? l.type : 'other', out = store.newLine(t, { label: s(l.label) || schema.lineTypesById[t].l });
    if (s(l.term)) out.term = s(l.term);
    if (t === 'child') { out.name = s(l.name) || ''; out.sname = s(l.sname) || ''; }
    if (t === 'debt') { out.debt = s(l.debt) || ''; out.bank = s(l.bank) || ''; }
    [['life', ['lump', 'monthly']], ['sev', ['lump']], ['lsd', ['lump', 'monthly']], ['ip', ['monthly']]].forEach(function (p) {
      if (out[p[0]] === 'N/A') return;
      var c = l[p[0]]; if (c === 'N/A') { out[p[0]] = 'N/A'; return; }
      if (c && typeof c === 'object') p[1].forEach(function (k) { if (c[k] !== undefined) out[p[0]][k] = n(c[k]); });
    });
    if (t === 'child') out.waiting = 'N/A';                                                                    // Paul's rule (22 November): child care never has a waiting period, whatever the document says
    else if (out.waiting !== 'N/A' && s(l.waiting)) out.waiting = s(l.waiting);
    var hasAbi = function (v) { return v !== undefined && v !== null && v !== ''; };
    if (hasAbi(l.abi)) out.abi = n(l.abi); else if (hasAbi(o.abi)) out.abi = n(o.abi); else if (o.quote) out.abi = 'Not found';        // a quote's line always has an ABI; one the quote does not print says so
    if (o.quote && out.sev !== 'N/A' && !calc.isNum(out.sev.lump)) out.sev = 'N/A';                          // severe illness is N/A on every line except where the quote has an amount
    out.st = 'verify'; out.by = 'page'; out.src = src; return out;
  }
  function pillarsOf(c) {
    var o = {}; schema.PILLARS.forEach(function (p) { var v = c && c[p.id]; if (v && typeof v === 'object') { o[p.id] = {}; p.keys.forEach(function (k) { if (v[k] !== undefined) o[p.id][k] = n(v[k]); }); } });
    return Object.keys(o).length ? o : null;
  }
  function logDoc(state, file, block, how) {
    state.documents = state.documents || []; state.documents.push({ id: store.uid('d'), file: String(file || ''), block: block, how: how, at: new Date().toISOString() });
  }
  function qkey(num) { return String(num == null ? '' : num).replace(/\D/g, ''); }
  function findQuoteByNumber(state, num) {
    var k = qkey(num), hit = null; if (!k) return null;
    calc.allQuotes(state).forEach(function (q) { if (qkey(q.number) === k) hit = q; });
    return hit;
  }

  /* The Fact Find's children and debts against a quote that was read: a debt line the quote gives without its name or bank (or a child line without a surname) gets them from the matching Fact Find row (matched by name, then by the
     instalment or the balance). Only empty text boxes are filled: what the quote printed is never replaced, and no amount is invented. */
  function enrich(state, q) {
    var f = state && state.factFind && state.factFind.facts; if (!f) return 0;
    var lines = calc.activeLines(q), n2 = 0;
    calc.matchChildren(lines, f.children || []).pairs.forEach(function (p) { if (!s(p.line.sname) && s(p.ff.sname)) { p.line.sname = s(p.ff.sname); n2++; } });
    calc.matchDebts(lines, f.debts || []).pairs.forEach(function (p) {
      if (!s(p.line.debt) && (s(p.ff.desc) || s(p.ff.type))) { p.line.debt = s(p.ff.desc) || s(p.ff.type); n2++; }
      if (!s(p.line.bank) && s(p.ff.prov)) { p.line.bank = s(p.ff.prov); n2++; }
    });
    return n2;
  }
  /* A quote. data: what was read (or, with reading off, { number, date } from the file name). o: { replaces: id } */
  function applyQuote(state, block, data, file, o) {
    o = o || {}; data = data || {};
    var kind = QUOTE_OF[block], src = srcOf('quote', file), q = store.newQuote(state, kind), read = !!(data.lines && data.lines.length);
    if (s(data.insurer)) q.insurer = s(data.insurer);
    q.number = s(data.number) || ''; q.date = dmy(data.date); if (s(data.rates)) q.rates = s(data.rates);
    if (data.aci !== undefined) q.aci = n(data.aci);
    if (s(data.aciText)) q.aciText = s(data.aciText);
    if (data.premium !== undefined && !o.nameOnly) q.premium = n(data.premium);
    if (data.servicing === true || data.servicing === false) q.servicing = data.servicing;
    if (data.disabilityAge !== undefined && calc.isNum(n(data.disabilityAge))) q.disabilityAge = n(data.disabilityAge);
    if (read) q.lines = data.lines.map(function (l) { return line(l, src, { quote: true, abi: data.abi }); });
    if (!s(data.aciText) && read) { var lw = data.lines.filter(function (l) { return l && s(l.aciText); })[0]; if (lw) q.aciText = s(lw.aciText); }          // the ACI words belong to the quote: the lines show the same
    if (read) enrich(state, q);
    if (data.printedTotals && typeof data.printedTotals === 'object') q.printedTotals = pillarsOf(data.printedTotals);
    q.st = 'verify'; q.by = 'page'; q.src = src; q.status = 'pending';
    if (o.replaces) { var old = store.findQuote(state, o.replaces); if (old) { old.removed = true; old.replacedBy = q.id; q.replaces = old.id; } }
    var dup = findQuoteByNumber(state, q.number);                                                           // a quote with this number (not removed) is already there: the caller says so
    state.blocks[schema.blockOfQuote[kind]].quotes.push(q);
    return { quote: q, read: read, duplicate: dup || null };
  }
  /* A policy schedule fills the details of one item of block 1. Returns the item, or null when none matches (the schedule is for a policy that is not in the Fact Find). */
  function matchItem(items, data, getName) {
    var pn = qkey(data.policyNo || ''), hits = items.filter(function (i) { return !i.removed; });
    var byNo = pn ? hits.filter(function (i) { return qkey(i.policyNo) === pn; }) : [];
    if (byNo.length === 1) return byNo[0];
    var who = calc.norm(getName(data)), byName = who ? hits.filter(function (i) { var m = calc.norm(getName(i)); return m && (m === who || who.indexOf(m) >= 0 || m.indexOf(who) >= 0); }) : [];
    if (byName.length <= 1) return byName.length ? byName[0] : null;
    /* more than one policy of this insurer (two Liberty policies): the policy number, then the premium (the Fact Find's monthly spend against the schedule's), then the one no document has filled yet */
    var prem = n(data.premium), byPrem = calc.isNum(prem) ? byName.filter(function (i) { return calc.isNum(i.premium) && Math.abs(i.premium - prem) <= 1; }) : [];
    if (byPrem.length === 1) return byPrem[0];
    var pool = byPrem.length ? byPrem : byName, open = pool.filter(function (i) { return i.st === 'ff' || i.st === 'empty'; });
    if (byPrem.length > 1 && open.length >= 1) return open[0];                                              // the same premium twice: the first one nothing has filled yet
    return { ambiguous: byName };
  }
  function applyPolicy(state, item, data, file) {
    var src = srcOf('schedule', file);
    ['insurer', 'product', 'policyNo'].forEach(function (k) { if (s(data[k])) item[k] = s(data[k]); });
    if (dmy(data.doc)) item.doc = dmy(data.doc);
    ['premium', 'aci', 'abi'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
    if (s(data.aciText)) item.aciText = s(data.aciText);
    if (data.ipAge !== undefined && calc.isNum(n(data.ipAge))) item.ipAge = n(data.ipAge);
    if (data.benefits && typeof data.benefits === 'object') { item.benefits = item.benefits || {}; ['life', 'lsd', 'ip'].forEach(function (k) { if (s(data.benefits[k])) item.benefits[k] = s(data.benefits[k]); }); }
    if (data.lines && data.lines.length) item.lines = data.lines.map(function (l) { return line(l, src); });
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  /* The legacy protection plan of block 11 (the only item there that takes a document): read like a policy schedule, put in the item's own boxes. */
  function applyOther(state, item, data, file) {
    var src = srcOf('schedule', file), b = (data && data.benefits) || {};
    if (s(data.insurer)) item.company = s(data.insurer); if (s(data.product)) item.product = s(data.product); if (s(data.policyNo)) item.policyNo = s(data.policyNo);
    if (data.premium !== undefined && data.premium !== null) item.premium = n(data.premium);
    var note = [b.life, b.lsd, b.ip].filter(Boolean).join(' / '); if (note) item.note = note;
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  function applyGroup(state, item, data, file) {
    var src = srcOf('group', file);
    if (item.kind === 'risk') {
      ['statementDate'].forEach(function (k) { if (dmy(data[k])) item[k] = dmy(data[k]); });
      ['basis', 'ipWaiting'].forEach(function (k) { if (s(data[k])) item[k] = s(data[k]); });
      if (['employer', 'employee', 'both'].indexOf(data.paidBy) >= 0) item.paidBy = data.paidBy;
      ['monthlyCost', 'aci', 'abi'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
      schema.PILLARS.forEach(function (p) { var c = data[p.id]; if (c && typeof c === 'object') { item[p.id] = item[p.id] || { amount: null, endAge: null }; if (c.amount !== undefined) item[p.id].amount = n(c.amount); if (c.endAge !== undefined && c.endAge !== null && c.endAge !== '') item[p.id].endAge = String(c.endAge).trim(); } });
    } else {
      ['value', 'employer', 'employee', 'aci'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
      if (s(data.note)) item.note = s(data.note);
    }
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  function applyInvestment(state, item, data, file, o) {
    o = o || {}; var src = srcOf(o.kind === 'astute' ? 'astute' : 'schedule', file);
    if (s(data.product)) item.product = s(data.product); if (s(data.policyNo)) item.policyNo = s(data.policyNo);
    if (dmy(data.valueDate)) item.valueDate = dmy(data.valueDate);
    ['gross', 'penalty', 'returnRate', 'aci', 'monthly'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
    item.valueSource = { kind: o.kind === 'astute' ? 'astute' : 'schedule', date: dmy(data.valueDate) || (o.date || null), file: String(file || '') };
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  /* An Astute report fills the value of each investment it lists that matches one of the Fact Find's; a value from an investment schedule is never replaced by Astute (schedules first). Returns { filled, unmatched }. */
  function applyAstute(state, data, file) {
    var res = { filled: 0, unmatched: [] }, date = dmy(data.reportDate);
    (data.investments || []).forEach(function (r) {
      var hit = matchItem(state.blocks.investments.items, r, function (x) { return x.provider; });
      if (!hit || hit.ambiguous) { res.unmatched.push(r.provider || r.product || 'an investment'); return; }
      if (hit.valueSource && hit.valueSource.kind === 'schedule' && (hit.st === 'verify' || hit.st === 'confirmed')) return;
      applyInvestment(state, hit, { product: hit.product, valueDate: date, gross: r.gross, monthly: r.monthly, policyNo: r.policyNo }, file, { kind: 'astute', date: date }); res.filled++;
    });
    return res;
  }
  function applyCmp(state, data, file) {
    var q = findQuoteByNumber(state, data.number); if (!q) return null;
    var rows = (data.rows || []).map(function (r) { return { key: ['total', 'retirement', 'childcare', 'child'].indexOf(r.key) >= 0 ? r.key : 'total', name: s(r.name) || undefined, sname: s(r.sname) || undefined, today: n(r.today), projected: n(r.projected), payoutDate: dmy(r.payoutDate) }; });
    q.cmp = { number: s(data.number) || q.number, activationDate: dmy(data.activationDate), reason: s(data.reason), rows: rows, st: 'verify', by: 'page', src: srcOf('cmp', file) };
    return q;
  }

  /* A proposed investment (block 9). A row from the Fact Find (the same provider, and the same type when the document says one) that no document has filled yet is filled in; otherwise a new row is added.
     Returns { item, matched }. Nothing is checked here: everything is amber. */
  function applyProposed(state, data, file) {
    data = data || {}; var src = srcOf('proposal', file), items = state.blocks.proposed.items, who = calc.norm(s(data.provider) || '');
    var type = null; schema.PROPOSED_TYPES.forEach(function (t) { if (calc.norm(t) === calc.norm(s(data.type) || '')) type = t; });
    var hit = items.filter(function (i) {
      var m = calc.norm(i.provider || ''); return !i.removed && (i.st === 'ff' || i.st === 'empty') && who && m && (m.indexOf(who) >= 0 || who.indexOf(m) >= 0) && (!type || i.type === type);
    })[0] || null, it = hit || store.newProposed();
    if (type) it.type = type; if (s(data.provider)) it.provider = s(data.provider); if (s(data.number)) it.quote = s(data.number);
    ['lump', 'monthly', 'boostPct', 'netInvested', 'aci'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) it[k] = n(data[k]); });
    if (['lump', 'monthly', 'both', 'transfer'].indexOf(data.contribution) >= 0) it.contribution = data.contribution;
    else if (calc.isNum(it.lump) && calc.isNum(it.monthly) && it.lump && it.monthly) it.contribution = 'both'; else if (calc.isNum(it.lump) && it.lump) it.contribution = 'lump'; else if (calc.isNum(it.monthly) && it.monthly) it.contribution = 'monthly';
    it.st = 'verify'; it.by = 'page'; it.src = src; if (!hit) items.push(it);
    return { item: it, matched: !!hit };
  }
  /* A goal analysis report (block 10): the RGAR or the EGAR row (made when it is not there) gets the report's figures. Returns { item, wasRequested }. */
  function applyGoal(state, data, file) {
    data = data || {}; var src = srcOf('goal', file), kind = /egar|education/i.test(String(data.kind || '')) ? 'egar' : 'rgar', items = state.blocks.goals.items;
    var it = items.filter(function (g) { return g.kind === kind && !g.removed; })[0], was = it ? !!it.requested : false;
    if (!it) { it = { id: 'goal-' + kind, kind: kind, requested: true, note: '', currentValuePm: null, futureValuePm: null, aci: null, premium: null, st: 'empty', src: null, by: 'page', removed: false }; items.push(it); }
    ['currentValuePm', 'futureValuePm', 'aci', 'premium'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) it[k] = n(data[k]); });
    it.requested = true; if (s(data.note)) it.note = s(data.note); else if (!was) it.note = '';
    it.st = 'verify'; it.by = 'page'; it.src = src; return { item: it, wasRequested: was };
  }
  /* What was read has nothing in it (a document that is not the kind said, a scan that could not be read): the caller says so and only records the document. */
  function isEmptyRead(block, data) {
    if (!data || typeof data !== 'object') return true;
    var has = function (v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !isFinite(v)); };
    var kind = SPEC_OF[block];
    if (kind === 'quote') return !(data.lines && data.lines.length) && !has(data.premium);
    if (kind === 'proposal') return !has(data.lump) && !has(data.monthly) && !has(data.netInvested);
    if (kind === 'goal') return !has(data.currentValuePm) && !has(data.futureValuePm) && !has(data.premium);
    if (kind === 'cmp') return !(data.rows && data.rows.length) && !has(data.reason);
    if (kind === 'astute') return !(data.investments && data.investments.length);
    return !Object.keys(data).some(function (k) { return has(data[k]) && typeof data[k] !== 'object'; }) && !Object.keys(data).some(function (k) { var v = data[k]; return v && typeof v === 'object' && Object.keys(v).some(function (j) { return has(v[j]); }); });
  }

  return { classify: classify, promptFor: promptFor, parseReply: parseReply, readWithClaude: readWithClaude, applyQuote: applyQuote, enrich: enrich, factNote: factNote, applyPolicy: applyPolicy, applyOther: applyOther, applyGroup: applyGroup, applyInvestment: applyInvestment, applyAstute: applyAstute, applyProposed: applyProposed, applyGoal: applyGoal, isEmptyRead: isEmptyRead,
    applyCmp: applyCmp, matchItem: matchItem, logDoc: logDoc, findQuoteByNumber: findQuoteByNumber, SPEC_OF: SPEC_OF, BLOCK_LABEL: BLOCK_LABEL, QUOTE_OF: QUOTE_OF, ENDPOINT: ENDPOINT };
});
