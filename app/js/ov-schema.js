/* The Client Overview: what it is made of (docs/OVERVIEW-DATA-CONTRACT.md is the written contract that this file, the page, the PDF, the Presentation and the filling skill all follow).
   The blocks in their fixed order, the four pillars, the line types, the quote statuses, Paul's standard settings, the file name. Loads in the browser (window.OV.schema) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.OV = root.OV || {}; root.OV.schema = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  /* VERSION is the layout of the saved file (docs/OVERVIEW-DATA-CONTRACT.md): the filling skill stops on one it does not know. PAGE_VERSION is the page's own version, which changes with every stage. */
  var VERSION = '0.1', PAGE_VERSION = '1.8', APP_ID = 'wr-overview';

  /* The four pillars, in the order of the columns. life and lsd have a lump sum and a monthly figure; sev only a lump sum; ip only a monthly figure. */
  var PILLARS = [
    { id: 'life', l: 'Life cover', keys: ['lump', 'monthly'] },
    { id: 'sev', l: 'Severe illness', keys: ['lump'] },
    { id: 'lsd', l: 'Lump sum disability', keys: ['lump', 'monthly'] },
    { id: 'ip', l: 'Income protector / sickness benefit', keys: ['monthly'] }
  ];

  /* The pillars' short names, as the summary of a counter offer's terms and the totals row name them. */
  var PILLAR_SHORT = { life: 'Life cover', sev: 'Severe illness', lsd: 'Lump sum disability', ip: 'Income protector' };

  /* The eleven blocks, fixed order, the same on the screen, in the PDF and in the Presentation. kind says how the block is drawn; qkind is the kind of quote a quote block holds;
     ff: the block follows the Fact Find (items are added and removed only there). */
  var BLOCKS = [
    { id: 'policies', n: 1, title: 'Current policies', kind: 'policies', ff: true },
    { id: 'fna', n: 2, title: 'FNA quote', kind: 'quotes', qkind: 'fna', one: 'FNA quote' },
    { id: 'group', n: 3, title: 'Group benefits & personal investments', kind: 'group', ff: true },
    { id: 'shortfall', n: 4, title: 'Shortfall', kind: 'shortfall' },
    { id: 'shortfallQuote', n: 5, title: 'Shortfall quote', kind: 'quotes', qkind: 'shortfall', one: 'shortfall quote' },
    { id: 'reduced', n: 6, title: 'Reduced quotes', kind: 'quotes', qkind: 'reduced', one: 'reduced quote' },
    { id: 'comparative', n: 7, title: 'Comparative quotes', kind: 'quotes', qkind: 'comparative', one: 'comparative quote' },
    { id: 'investments', n: 8, title: 'Current investments', kind: 'investments', ff: true },
    { id: 'proposed', n: 9, title: 'Proposed investments', kind: 'proposed' },
    { id: 'goals', n: 10, title: 'Goal analysis reports', kind: 'goals' },
    { id: 'other', n: 11, title: 'Medical aid, will & short-term', kind: 'other' }
  ];
  var blocksById = {}; BLOCKS.forEach(function (b) { blocksById[b.id] = b; });
  var blockOfQuote = { fna: 'fna', shortfall: 'shortfallQuote', reduced: 'reduced', comparative: 'comparative' };
  var QUOTE_KINDS = ['fna', 'shortfall', 'reduced', 'comparative'];

  var INSURERS = ['BrightRock', 'Momentum', 'Sanlam', 'Discovery', 'Old Mutual', 'Liberty', 'Hollard', 'Assupol'];

  /* A quote's status progresses (Paul, 24 November, round 1.1): the CLIENT'S decision first (status: pending, then accepted or not accepted), and only for an accepted quote the INSURER'S underwriting (uw: pending underwriting, then one
     of six outcomes). Older files said declined / medical / underwriting in status: they are converted when a file opens (calc.settleQuote). */
  var STATUS = [
    { id: 'pending', l: 'Pending client decision' },
    { id: 'accepted', l: 'Accepted' },
    { id: 'notaccepted', l: 'Not accepted' }
  ];
  var statusLabel = {}; STATUS.forEach(function (s) { statusLabel[s.id] = s.l; });
  var UW = [
    { id: 'pending', l: 'Pending underwriting' },
    { id: 'standard', l: 'Accepted at standard rates' },
    { id: 'loadings', l: 'Accepted with loadings' },
    { id: 'exclusions', l: 'Accepted with exclusions' },
    { id: 'both', l: 'Accepted with loadings and exclusions' },
    { id: 'declinedHealth', l: 'Declined (health)' },
    { id: 'declinedOther', l: 'Declined (other)' }
  ];
  var uwLabel = {}; UW.forEach(function (u) { uwLabel[u.id] = u.l; });
  var UW_ISSUED = ['standard', 'loadings', 'exclusions', 'both'], UW_DECLINED = ['declinedHealth', 'declinedOther'];
  /* What an older file called a status, as (client decision, underwriting). "declined" is a GUESS: the insurer declined a quote the client had accepted. */
  var LEGACY_STATUS = { underwriting: ['accepted', 'pending'], declined: ['accepted', 'declinedOther'], medical: ['accepted', 'declinedHealth'] };
  var TERM_BENEFITS = ['All benefits', 'Life cover', 'Severe illness', 'Lump sum disability', 'Income protector'];
  /* Counter offers (round 1.2, 24 November): when the client accepts a quote and underwriting comes back with loadings or exclusions, the insurer sends a counter offer LETTER and a counter offer QUOTE. A counter offer is a quote of the same
     kind and block as the one the client accepted (counterOf = that quote's id). BrightRock's letter prints its terms in a grid: ROWS are need groups, the three COLUMN GROUPS are below. BrightRock has FOUR separate pillars and every loading or
     exclusion cell belongs to exactly ONE of them, never a combined label (Paul's final word, 24 November, 22:27; he first said "can recover from = income protector only"): caused by death = LIFE COVER (a death-related line is always life cover);
     permanent = LUMP SUM DISABILITY; can recover from = INCOME PROTECTOR (the temporary expenses cover of the household, child care and debt rows); and the ADDITIONAL EXPENSE needs row (dread), which only carries severe illness, is
     SEVERE ILLNESS whatever column group the letter prints it under. A need is not a pillar, and a loading or exclusion belongs to PILLARS, not to line items (Paul, 25 November 08:30): it is shown once per pillar, in the Loadings and exclusions row under the totals and in the terms block, never on a line. ONE table, here: the column groups
     and the need group that has only one pillar. Round 1.3 (the earlier readings, a combined "severe illness and income protector", are gone). */
  var NEED_GROUPS = [
    { id: 'needs', l: 'Household, childcare, healthcare, debt and death-related needs' },
    { id: 'dread', l: 'Additional expense needs', only: { pillars: ['sev'], benefit: 'Severe illness' } }          // the row that only carries severe illness: every cell of it is severe illness
  ];
  var COLUMN_GROUPS = [
    { id: 'recover', l: 'Cover that you can recover from', pillars: ['ip'], benefit: 'Income protector' },
    { id: 'permanent', l: 'Cover that\u2019s permanent', pillars: ['lsd'], benefit: 'Lump sum disability' },
    { id: 'death', l: 'Cover that\u2019s caused by death', pillars: ['life'], benefit: 'Life cover' }
  ];
  var needGroupById = Object.create(null); NEED_GROUPS.forEach(function (g) { needGroupById[g.id] = g; });
  var columnGroupById = Object.create(null); COLUMN_GROUPS.forEach(function (g) { columnGroupById[g.id] = g; });
  /* The benefit and the pillar of ONE cell of the letter's grid (a need group and a column group): a need group that has only one pillar (the additional expense row) decides it, otherwise the column group does. null: not a cell. */
  function cellOf(need, column) {
    var cg = columnGroupById[column]; if (!cg) return null;
    var ng = needGroupById[need]; if (ng && ng.only) return { pillars: ng.only.pillars.slice(), benefit: ng.only.benefit };
    return { pillars: cg.pillars.slice(), benefit: cg.benefit };
  }
  /* The benefit name for a set of cells: one pillar as it is, every pillar as All benefits, otherwise the pillars listed one after the other (Life cover, lump sum disability, income protector). */
  function cellsBenefit(cells) {
    var names = [], pil = {};
    (cells || []).forEach(function (a) { var c = a && cellOf(a.need, a.column); if (!c) return; if (names.indexOf(c.benefit) < 0) names.push(c.benefit); c.pillars.forEach(function (p) { pil[p] = 1; }); });
    if (!names.length) return '';
    var order = ['Life cover', 'Severe illness', 'Lump sum disability', 'Income protector', 'Severe illness and income protector'], at = function (b) { var i = order.indexOf(b); return i < 0 ? order.length : i; };
    names.sort(function (a, b) { return at(a) - at(b); });                                                   // always in the order of the columns on the page
    if (names.length > 1 && ['life', 'sev', 'lsd', 'ip'].every(function (p) { return pil[p]; })) return 'All benefits';
    return names.map(function (b, i) { return i ? b.charAt(0).toLowerCase() + b.slice(1) : b; }).join(', ');                 // a list of separate pillars (an exclusion printed in several cells), never one combined label
  }
  /* The four pillars a typed benefit name stands for. */
  var BENEFIT_PILLARS = Object.assign(Object.create(null), { 'All benefits': ['life', 'sev', 'lsd', 'ip'], 'Life cover': ['life'], 'Severe illness': ['sev'], 'Lump sum disability': ['lsd'], 'Income protector': ['ip'], 'Severe illness and income protector': ['sev', 'ip']          /* only so that a row typed with this label in 1.2 still draws; it is not offered any more */ });
  var LOADING_KINDS = [{ id: 'medical', l: 'Medical' }, { id: 'occupational', l: 'Occupational' }, { id: 'other', l: 'Other' }];
  var loadingKindLabel = {}; LOADING_KINDS.forEach(function (k) { loadingKindLabel[k.id] = k.l; });
  var BROKER_RECORD = [{ id: 'stays', l: 'Stays with the current broker' }, { id: 'moves', l: 'Moves to Wealth Revolution' }];

  /* The lines of a quote or a policy. monthly is what the monthly figure under a BrightRock lump sum is called. */
  var LINE_TYPES = [
    { id: 'household', l: 'Household needs', monthly: 'Income portion p.m.', abi: 'household' },
    { id: 'child', l: 'Child care', monthly: 'Income portion p.m.', abi: 'child' },
    { id: 'debt', l: 'Debt', monthly: 'Monthly instalment', abi: 'debt' },
    { id: 'death', l: 'Death-related needs', monthly: 'Income portion p.m.', abi: 'death', na: ['lsd', 'ip', 'waiting'], term: 'On my death' },
    { id: 'dread', l: 'Additional expense needs (dread)', monthly: 'Monthly', abi: 'dread', na: ['life', 'lsd', 'ip', 'waiting'], term: 'Whole of life' },          // round 3: the additional expense cover is a severe illness amount only: no life cover cell
    { id: 'other', l: 'Other line', monthly: 'Monthly', abi: null }
  ];
  var lineTypesById = {}; LINE_TYPES.forEach(function (t) { lineTypesById[t.id] = t; });
  /* The figures a quote has to give for each need (round 3, 23 November): [pillar, key, what it is called]. A BrightRock line read from a quote is never ticked while one of them is empty; the reading writes "Not found" in a box it could not find. */
  var FIGURES = { household: [['life', 'lump', 'the lump sum'], ['life', 'monthly', 'the income portion p.m.']], child: [['life', 'lump', 'the lump sum'], ['life', 'monthly', 'the income portion p.m.']], death: [['life', 'lump', 'the lump sum'], ['life', 'monthly', 'the income portion p.m.']],
    debt: [['life', 'lump', 'the debt cover'], ['life', 'monthly', 'the monthly instalment']], dread: [['sev', 'lump', 'the severe illness amount']] };

  /* Paul's standard settings: what the increases normally are. A line that differs is flagged (amber, never printed). */
  var STANDARDS = { aci: 10, abi: { child: 5, household: 5, debt: 0, death: 3, dread: 3 } };

  var PROPOSED_TYPES = ['Tax-free investment', 'Retirement annuity (RA)', 'Endowment', 'Unit trusts (open-ended)', 'Section 14 transfer', 'Pension / provident fund transfer'];
  var CONTRIBUTIONS = [{ id: 'lump', l: 'Lump sum only' }, { id: 'monthly', l: 'Monthly premium only' }, { id: 'both', l: 'Lump sum plus monthly premium' }, { id: 'transfer', l: 'Transfer' }];
  var contributionLabel = {}; CONTRIBUTIONS.forEach(function (c) { contributionLabel[c.id] = c.l; });
  var OTHER_KEYS = [{ key: 'medical', l: 'Medical aid' }, { key: 'gap', l: 'Gap cover' }, { key: 'will', l: 'Will' }, { key: 'legacy', l: 'Legacy protection plan' }, { key: 'shortterm', l: 'Short-term insurance' }];
  var GROUP_KINDS = { risk: 'Group risk', pension: 'Pension fund', provident: 'Provident fund' };
  var PAID_BY = ['employer', 'employee', 'both'];
  var ST_LABEL = { empty: 'waiting for document', ff: 'from Fact Find, waiting for document', verify: 'to check', confirmed: 'checked' };

  function safeName(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function parseDMY(v) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v == null ? '' : v).trim());
    return m ? { d: +m[1], m: +m[2], y: +m[3] } : null;
  }
  function todayDMY() { var t = new Date(); return two(t.getDate()) + '/' + two(t.getMonth() + 1) + '/' + t.getFullYear(); }
  /* "Surname, First names" as the client's folder is named. */
  function clientName(state) {
    var h = (state && state.header) || {}, a = safeName(h.sname), b = safeName(h.fname);
    return a && b ? a + ', ' + b : (a || b);
  }
  function clientFull(state) { var h = (state && state.header) || {}; return [h.fname, h.sname].map(safeName).filter(Boolean).join(' '); }
  /* "WR Overview - dd.mm.yy - (Surname, Name)": the saved file (.json) and the PDF have the same name; only the ending differs. A new date is a new version. */
  function fileName(state) {
    var d = parseDMY(state && state.header && state.header.overviewDate) || parseDMY(todayDMY());
    return 'WR Overview - ' + two(d.d) + '.' + two(d.m) + '.' + two(d.y % 100) + ' - (' + (clientName(state) || 'New client') + ')';
  }
  /* The year folder the overview goes in (the year of its date). */
  function yearOf(state) { var d = parseDMY(state && state.header && state.header.overviewDate) || parseDMY(todayDMY()); return String(d.y); }

  return { version: VERSION, pageVersion: PAGE_VERSION, released: 'November 2026', APP_ID: APP_ID, PILLARS: PILLARS, PILLAR_SHORT: PILLAR_SHORT, BLOCKS: BLOCKS, blocksById: blocksById, blockOfQuote: blockOfQuote, QUOTE_KINDS: QUOTE_KINDS, INSURERS: INSURERS,
    STATUS: STATUS, statusLabel: statusLabel, UW: UW, uwLabel: uwLabel, UW_ISSUED: UW_ISSUED, UW_DECLINED: UW_DECLINED, LEGACY_STATUS: LEGACY_STATUS, TERM_BENEFITS: TERM_BENEFITS, LOADING_KINDS: LOADING_KINDS, loadingKindLabel: loadingKindLabel, BROKER_RECORD: BROKER_RECORD, NEED_GROUPS: NEED_GROUPS, COLUMN_GROUPS: COLUMN_GROUPS, needGroupById: needGroupById, columnGroupById: columnGroupById, cellOf: cellOf, cellsBenefit: cellsBenefit,BENEFIT_PILLARS: BENEFIT_PILLARS, LINE_TYPES: LINE_TYPES, lineTypesById: lineTypesById, STANDARDS: STANDARDS, PROPOSED_TYPES: PROPOSED_TYPES, CONTRIBUTIONS: CONTRIBUTIONS,
    contributionLabel: contributionLabel, OTHER_KEYS: OTHER_KEYS, FIGURES: FIGURES, GROUP_KINDS: GROUP_KINDS, PAID_BY: PAID_BY, ST_LABEL: ST_LABEL, fileName: fileName, yearOf: yearOf, clientName: clientName,
    clientFull: clientFull, parseDMY: parseDMY, todayDMY: todayDMY, safeName: safeName };
});
