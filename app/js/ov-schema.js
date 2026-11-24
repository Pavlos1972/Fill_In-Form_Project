/* The Client Overview: what it is made of (docs/OVERVIEW-DATA-CONTRACT.md is the written contract that this file, the page, the PDF, the Presentation and the filling skill all follow).
   The blocks in their fixed order, the four pillars, the line types, the quote statuses, Paul's standard settings, the file name. Loads in the browser (window.OV.schema) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.OV = root.OV || {}; root.OV.schema = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  /* VERSION is the layout of the saved file (docs/OVERVIEW-DATA-CONTRACT.md): the filling skill stops on one it does not know. PAGE_VERSION is the page's own version, which changes with every stage. */
  var VERSION = '0.1', PAGE_VERSION = '0.96', APP_ID = 'wr-overview';

  /* The four pillars, in the order of the columns. life and lsd have a lump sum and a monthly figure; sev only a lump sum; ip only a monthly figure. */
  var PILLARS = [
    { id: 'life', l: 'Life cover', keys: ['lump', 'monthly'] },
    { id: 'sev', l: 'Severe illness', keys: ['lump'] },
    { id: 'lsd', l: 'Lump sum disability', keys: ['lump', 'monthly'] },
    { id: 'ip', l: 'Income protector / sickness benefit', keys: ['monthly'] }
  ];

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

  /* A quote's status. pending is where every quote starts; the others are set when the client decides or the insurer answers. */
  var STATUS = [
    { id: 'pending', l: 'Pending client decision' },
    { id: 'accepted', l: 'Accepted' },
    { id: 'notaccepted', l: 'Not accepted' },
    { id: 'declined', l: 'Declined' },
    { id: 'medical', l: 'Medical decline' },
    { id: 'underwriting', l: 'Pending underwriting' }
  ];
  var statusLabel = {}; STATUS.forEach(function (s) { statusLabel[s.id] = s.l; });

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

  return { version: VERSION, pageVersion: PAGE_VERSION, released: 'November 2026', APP_ID: APP_ID, PILLARS: PILLARS, BLOCKS: BLOCKS, blocksById: blocksById, blockOfQuote: blockOfQuote, QUOTE_KINDS: QUOTE_KINDS, INSURERS: INSURERS,
    STATUS: STATUS, statusLabel: statusLabel, LINE_TYPES: LINE_TYPES, lineTypesById: lineTypesById, STANDARDS: STANDARDS, PROPOSED_TYPES: PROPOSED_TYPES, CONTRIBUTIONS: CONTRIBUTIONS,
    contributionLabel: contributionLabel, OTHER_KEYS: OTHER_KEYS, FIGURES: FIGURES, GROUP_KINDS: GROUP_KINDS, PAID_BY: PAID_BY, ST_LABEL: ST_LABEL, fileName: fileName, yearOf: yearOf, clientName: clientName,
    clientFull: clientFull, parseDMY: parseDMY, todayDMY: todayDMY, safeName: safeName };
});
