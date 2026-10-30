/* The Fact Find definition: sections, fields, lists and documents.
   One place describes the form, so the screen, the saved file, the checks and the PDF all agree.
   Field keys:  id, l (label), t ('txt' | 'sel' | 'area'), o (options), free (pick a value or type your own),
                preset (default value), calc (name of a calculation in calc.js), risky (check the spelling or number),
                opt (optional, left out of the progress count), wide (full width), link ([text, url]), hint,
                cal (a calendar button beside a date box), cond (show the box only when true, same form as a block's),
                lookup (a box with a look-up button: the id of the box holding the name to search for, or 'client'), lookupBtn (the button's words), nopdf (left off the PDF), rows (lines of a text box), len (shows a live digit count: see validate.lengthState).
                grey (a box whose cond is false stays on screen, greyed out, instead of going away),
                sl (the label shown on screen, when it is shorter than the label voice uses), vl (the label voice and Claude use, when the two kinds of life quote need telling apart),
                t 'multi' (tick boxes; multi: 'ins' makes it a list of insurers; nona: no "(not asked yet)" row).
   Block keys:  title, fields, list, cond (show only when true), condMsg, help (guidance shown on screen only),
                grey (when cond is false the block stays on screen greyed out, under condMsg, instead of going away), nomsg (no condMsg above a greyed block), own (the block's own cond, apart from its area being switched off: a block with its own condMsg is hidden when that rule fails, but greyed when only its area is off),
                pri (the priority area of the Client priorities page the block belongs to), head (the block holding that area's decision and comments boxes),
                lane ('br' BrightRock Fractured or 'std' Standard) and row ('fna', 'sf', 'red'): where a life quote block sits in the two-column grid of the Life area, sqd and sq (a row of the standard quote details table, and which boxes make it up),
                strip (the line at the top of the BrightRock Risk Calculation page), half (two blocks side by side), protector / actions (their own layouts).
   List keys:   dense (one short row for each quote instead of a card). Panel keys: inline (the area's decision, referral or request and comments are in one row). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.schema = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var YN = ['Yes', 'No'], BROKER = ['Paul K', 'Other broker', 'Through company', 'None'];
  var QTYPE = ['New Business', 'Servicing', 'N/A'];                         // what kind of quote it is
  var INS = ['Old Mutual', 'Momentum', 'Liberty', 'Sanlam', 'Discovery', 'BrightRock', 'Hollard', 'Assupol', 'Clientele', 'Other'];
  var INS_STD = ['Old Mutual', 'Momentum', 'Liberty', 'Sanlam', 'Discovery', 'Hollard', 'Assupol', 'Clientele', 'BrightRock (standard)', 'Other'];     // the insurers a standard quote can be asked of (BrightRock too: it does standard as well as fractured)
  var BANKS = ['Nedbank', 'FNB', 'Investec', 'Standard Bank', 'ABSA', 'Discovery Bank', 'Capitec', 'Wesbank', 'Other'];
  var WHO = ['Client', 'Spouse', 'Joint', 'Business', 'Ex-Spouse/Partner'];
  var ACI = ['Fixed', 'CPI', 'None'], REQ = ['Request a quote', 'Not required'];
  var MA_BROKER = ['Through company', 'Privately paid, no broker', 'Privately paid, other broker', 'Paul K'];
  var N = function (id, l, rows) { var f = { id: id, l: l || 'Notes', t: 'area', wide: 1, opt: 1 }; if (rows) f.rows = rows; return f; };
  var BIZ = { f: 'bizowner', eq: 'Yes' }, HAS_BIZPOL = { all: [BIZ, { f: 'biz_assur', nin: ['No'] }] };
  var MED_SCHEMES = ['Discovery Health', 'Momentum Medical Scheme', 'Bonitas Medical Fund', 'Bestmed Medical Scheme', 'Fedhealth Medical Scheme', 'Medihelp Medical Scheme', 'KeyHealth Medical Scheme', 'Medshield Medical Scheme', 'CompCare Medical Scheme', 'GEMS (Government Employees Medical Scheme)', 'POLMED (SA Police Service)', 'SAMWUMED (Municipal Workers)', 'Transmed (Transport industry)', 'LA Health (Local Authorities)', 'Bankmed (Banking sector)', 'Sizwe Hosmed Medical Scheme', 'Profmed (Professionals only)', 'Anglovaal Group Medical Scheme (AGMS)', 'Sasolmed', 'Cape Medical Plan (Cape Medical Scheme)', 'Hosmed Medical Scheme', 'Genesis Medical Scheme', 'Suremed Health', 'Resolution Health Medical Scheme', 'Makoti Medical Scheme', 'BMW Medical Aid Scheme', 'Anglo Medical Scheme', 'Other'];
  var GAP_PROVIDERS = ['TRA (Total Risk Administrators)', 'Turnberry', 'Ambledown Financial Services', 'Stratum Benefits', 'Kaelo', 'Zestlife', 'GapCover', 'Oneplan', 'Discovery', 'Momentum', 'Sanlam', 'Old Mutual', 'Dis-Chem Health', 'NetcarePlus', 'Other'];
  var INV_PROVIDERS = ['Old Mutual', 'Momentum', 'Sanlam', 'Liberty', 'Discovery Invest', 'Allan Gray', 'Coronation', 'Ninety One', 'PSG', 'Sygnia', 'Satrix', '10X Investments', 'Glacier by Sanlam', 'Investec', 'Nedgroup Investments', 'STANLIB', 'Absa', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'EasyEquities', 'Other'];
  var MARRIED = ['Married in community of property', 'Married out of community (with accrual)', 'Married out of community (no accrual)', 'Customary marriage', 'Civil union'];     // the marital statuses that have a date of marriage
  var STAGES = ['Not Yet in School', 'Pre-school', 'Primary', 'High School', 'Tertiary'];
  var ADVISOR = 'Paul Kafentzis';                                                                // printed in the PDF header; there is no Advisor box on the form
  var PRIORITY = 'Priority: client agrees', NOT_PRIORITY = 'Not a priority: client not interested';     // the answers of a priority's decision box (empty = not discussed yet)
  var UNSURE = 'Client not sure, needs to think about it', BUDGET = 'Client needs to check their budget', CAN_THINK = { life: 1, ra: 1, inv: 1 };        // two more answers (both yellow) for the areas where a client often wants time
  var HAS_RISK = { f: 'has_risk', nin: ['No'] }, HAS_GROUP = { f: 'has_group', nin: ['No', 'Not sure'] };
  var FNA_ON = { f: 'fna_req', nin: ['Not required', 'No FNA done'] }, SF_ON = { f: 'sf_req', nin: ['Not required'] };      // a quote that is not required has no type or insurer: those boxes go
  var BF_FNA_ON = { f: 'bf_fna_req', nin: ['Not required', 'No FNA done'] }, BF_SF_ON = { f: 'bf_sf_req', nin: ['Not required'] };      // the same for the BrightRock Fractured quotes (no insurer: it is always BrightRock)
  var FNA_REQ = ['Request a quote', 'Not required', 'No FNA done'];
  var NO_GROUP = 'No Group exists for a Shortfall Quote to be compiled. (Group risk through employer, on the Personal & group risk cover page, is No or Not sure.)';

  /* The first block of a priority area: the client's decision (empty until discussed) and the box for the reason or the adviser's instructions. */
  var TITLES = { life: 'Life', ra: 'RA', rgar: 'RGAR', inv: 'Invest', egar: 'EGAR', med: 'Medical Aid', will: 'Will', st: 'Short Term' };
  function HEAD(id) {
    return { pri: id, head: 1, layout: 'g12', fields: [
      { id: 'pr_' + id, l: TITLES[id] + ': client decision', sl: 'Client decision', t: 'sel', o: CAN_THINK[id] ? [PRIORITY, UNSURE, BUDGET, NOT_PRIORITY] : [PRIORITY, NOT_PRIORITY], s: 6 },
      { id: 'pr_' + id + '_cm', l: TITLES[id] + ': comments (the reason, or your instructions)', sl: 'Comments (reason or instructions)', t: 'area', rows: 2, s: 6 }
    ] };
  }

  function riskCalc(p) {
    return [
      { id: p + '_hh', l: 'Household net income (R)', t: 'txt', calc: 'hh', s: 3 },
      { id: p + '_cc', l: 'Minus childcare costs (R)', t: 'txt', calc: 'cc', s: 3 },
      { id: p + '_dr', l: 'Minus debt repayments (R)', t: 'txt', calc: 'dr', s: 3 },
      { id: p + '_need', l: 'Total household income needed (R)', t: 'txt', calc: 'need', s: 3 }
    ];
  }

  /* Dread disease cover starts at R 500 000.00 with a term of WOL (typed over when different); p is the prefix of the ids (dd: fractured cover, dds: standard quote). */
  function dread(p) {
    return [
      { id: p + '_cover', money: 1, l: 'Dread disease cover (R)', t: 'txt', opt: 1, preset: 'R 500 000.00', s: 3 },
      { id: p + '_term', l: 'Term', t: 'sel', o: ['WOL', 'Specified Age', 'Other'], opt: 1, preset: 'WOL', s: 3 },
      { id: p + '_termv', l: 'Term value', t: 'txt', opt: 1, s: 3 },
      { id: p + '_aci', l: 'ACI', t: 'sel', o: ['Fixed', 'Age-rated', 'Other'], opt: 1, preset: 'Fixed', s: 3 },
      { id: p + '_aciv', l: 'ACI value', t: 'txt', opt: 1, preset: '?', s: 3 },
      { id: p + '_abiv', l: 'ABI', t: 'txt', opt: 1, preset: '3%', s: 3 },
      N(p + '_cmt', 'Comments', 1)
    ];
  }
  /* "Request Current Policy Schedule(s)": the last item of each section that holds policies. A tick-box dropdown (t: 'multi', the choices ticked are kept as one text joined with "; ", empty = not asked yet) and, beside it,
     a small box for "Other". The block is greyed out while the client has no such policies (cond); group risk has no Astute choice. */
  var PS_CLIENT = 'Requested from client in meeting', PS_ASTUTE = 'Draw from Astute (with signed LOA)', PS_OTHER = 'Other';
  function PS(id, cond, msg, group) {
    return { title: 'Request Current Policy Schedule(s)', layout: 'g12', cond: cond, grey: 1, condMsg: msg, fields: [
      { id: 'ps_' + id, l: 'Schedule(s) requested', t: 'multi', o: group ? [PS_CLIENT, PS_OTHER] : [PS_CLIENT, PS_ASTUTE, PS_OTHER], s: 7 },
      { id: 'ps_' + id + '_ot', l: 'Other schedule arrangement', t: 'txt', opt: 1, voice: 1, cond: { f: 'ps_' + id, has: PS_OTHER }, grey: 1, s: 5 }
    ] };
  }
  var WAIT = ['7 days', '14 days', '1 month', '3 months', 'Other'];

  var sections = [
    { id: 'info', title: 'Client info', roomy: 1, fit: 1, blocks: [
      { title: 'Meeting', layout: 'g12', fields: [
        { id: 'consent', l: 'Consent to record and transcribe', t: 'sel', o: YN, s: 3 },
        { id: 'date', l: 'Date completed', t: 'txt', date: 1, preset: '@today', s: 3 },
        { id: 'meet', l: 'Type of meeting', t: 'sel', o: ['Teams Meeting', 'Telephonic Meeting', 'Physical Meeting', 'Other'], preset: 'Teams Meeting', s: 3 },
        { id: 'ref', l: 'Referral from', t: 'sel', o: ['D&R Marketing', 'Current client', 'Referral prospect', 'Spouse', 'Other'], s: 3 }
      ] },
      { title: 'Client', layout: 'g12', fields: [
        { id: 'fname', l: 'First name', t: 'txt', s: 3 },
        { id: 'sname', l: 'Surname', t: 'txt', risky: 1, s: 3 },
        { id: 'dob', l: 'Date of birth', t: 'txt', date: 1, risky: 1, hint: 'e.g. 14/03/1986', s: 3 },
        { id: 'age', l: 'Age at date of form', t: 'txt', calc: 'age', s: 3 },
        { id: 'idtype', l: 'ID or passport', t: 'sel', o: ['ID', 'Passport'], preset: 'ID', voice: 1, s: 3 },
        { id: 'idno', l: 'ID / passport number', t: 'txt', risky: 1, len: 1, s: 4 },
        { id: 'gender', l: 'Gender', t: 'sel', o: ['Female', 'Male'], s: 2 },
        { id: 'nat', l: 'Nationality', t: 'sel', o: ['South African', 'Other'], preset: 'South African', voice: 1, s: 3 },
        { id: 'nat_other', l: 'Other', t: 'txt', s: 3 },
        { id: 'tax', l: 'Income tax number', t: 'txt', risky: 1, len: 1, s: 4 }
      ] },
      { title: 'Contact details', layout: 'g12', fields: [
        { id: 'cell', l: 'Cell number', t: 'txt', risky: 1, s: 4 },
        { id: 'work', l: 'Work number', t: 'txt', risky: 1, none: 'No work number', s: 4 },
        { id: 'home', l: 'Home number', t: 'txt', risky: 1, none: 'No home number', s: 4 },
        { id: 'pemail', l: 'Personal email', t: 'txt', risky: 1, none: 'No personal email', s: 6 },
        { id: 'wemail', l: 'Work email', t: 'txt', risky: 1, none: 'No work email', s: 6 }
      ] },
      { title: 'Background', layout: 'g12', fields: [
        { id: 'smoker', l: 'Smoker', t: 'sel', o: ['Non-smoker', 'Smoker'], s: 3 },
        { id: 'edu', l: 'Highest education', t: 'sel', o: ['Matric', 'Matric & diploma', '4-year diploma', '3-year degree', 'Postgraduate', 'Other'], s: 3 },
        { id: 'edu_notes', l: 'Qualification details', t: 'area', s: 6 }
      ] },
      { title: 'Public profile (LinkedIn)', fields: [
        { id: 'profile', l: 'Public profile summary', t: 'area', wide: 1, opt: 1, nopdf: 1, lookup: 'client', lookupBtn: 'Search LinkedIn', rows: 3, hint: 'Filled in by itself when the name and employer or occupation are known. Needs the Anthropic key on the laptop; it is not available on the practice page.' }
      ] },
      { fields: [N('n_info')] }
    ] },

    { id: 'occ', title: 'Occupation', blocks: [
      { title: 'Work', fields: [
        { id: 'employed', l: 'Employed', t: 'sel', o: YN },
        { id: 'employer', l: 'Employer', t: 'txt' },
        { id: 'co_does', l: 'What does the company do?', t: 'area', wide: 1, lookup: 'employer' },
        { id: 'bizowner', l: 'Business owner', t: 'sel', o: YN },
        { id: 'occ', l: 'Occupation', t: 'txt' },
        { id: 'ft', l: 'Full time or contract', t: 'sel', o: ['Full time', 'Contract'] },
        { id: 'years', l: 'Years in this occupation', t: 'txt' }
      ] },
      { title: 'Business owner details', cond: BIZ, condMsg: 'These fields appear when Business owner is set to Yes.', fields: [
        { id: 'biz_name', l: 'Business name', t: 'txt' },
        { id: 'biz_struct', l: 'Type of ownership', t: 'sel', o: ['Sole proprietor', 'Partnership', 'Private company (Pty) Ltd', 'Close corporation', 'Trust', 'Other'] },
        { id: 'biz_struct_other', l: 'Other', t: 'txt' },
        { id: 'biz_does', l: 'What does the business do?', t: 'area', wide: 1, lookup: 'biz_name' },
        { id: 'biz_partners', l: 'Has partners or co-owners', t: 'sel', o: YN },
        { id: 'biz_pct', l: 'Your shareholding / interest %', t: 'txt' },
        { id: 'biz_loans', l: 'Business loans / surety signed', t: 'sel', o: ['Yes', 'No', 'Unsure'] },
        { id: 'biz_assur', l: 'Business assurance in place (buy & sell, keyman, contingent liability)', t: 'sel', o: ['Yes', 'No', 'Not sure'] }
      ] },
      { title: 'Existing business assurance policies', cond: HAS_BIZPOL, condMsg: 'Existing business assurance policies appear when Business owner = Yes and Business assurance in place is not No.', list: 'bizpol' },
      { title: 'Partners and shareholders', cond: { all: [BIZ, { f: 'biz_partners', eq: 'Yes' }] }, condMsg: 'Partner and shareholder details appear when Business owner = Yes and Has partners = Yes.', list: 'shares' },
      { title: 'Duties split', help: 'The percentages must add up to 100%.', fields: [
        { id: 'd_desk', l: 'Deskbound / office %', t: 'txt' },
        { id: 'd_supo', l: 'Supervising staff in office %', t: 'txt' },
        { id: 'd_trav', l: 'Travelling (not commute) %', t: 'txt' },
        { id: 'd_sups', l: 'Supervising staff on site %', t: 'txt' },
        { id: 'd_light', l: 'Light manual %', t: 'txt' },
        { id: 'd_mod', l: 'Moderate manual %', t: 'txt' },
        { id: 'd_heavy', l: 'Heavy manual %', t: 'txt' },
        { id: 'd_tot', l: 'Total (must be 100%)', t: 'txt', calc: 'd_tot' },
        { id: 'd_desc', l: 'Brief description of duties', t: 'area', wide: 1 }
      ] },
      { fields: [N('n_occ')] }
    ] },

    { id: 'income', roomy: 1, title: 'Income & household', blocks: [
      { fields: [
        { id: 'gross', money: 1, l: 'Gross monthly income (R)', t: 'txt', risky: 1 },
        { id: 'dnet', l: 'Direct Net Income (R p.m.)', t: 'txt', calc: 'dnet', link: ['Check on TaxTim', 'https://www.taxtim.com/za/calculators/income-tax'] },
        { id: 'net', money: 1, l: 'Take-home net income (R p.m.)', t: 'txt', risky: 1 },
        { id: 'exp', money: 1, l: 'Monthly expenses / budget (R)', t: 'txt', risky: 1 },
        { id: 'disp', l: 'Disposable income (R)', t: 'txt', calc: 'disp' },
        { id: 'marital', l: 'Marital status', t: 'sel', o: ['Single', 'Married in community of property', 'Married out of community (with accrual)', 'Married out of community (no accrual)', 'Customary marriage', 'Civil union', 'Life partner', 'Divorced', 'Widowed'] },
        { id: 'marr_date', l: 'Date of marriage', t: 'txt', date: 1, cal: 1, hint: 'e.g. 14/03/2010', cond: { f: 'marital', in: MARRIED } }
      ], help: 'Direct Net Income is gross income less PAYE and UIF, calculated from the SARS tables. It matches TaxTim\'s "Take-home pay" for a client under 65 with no pension contribution and no medical aid credits. Take-home net income is what the employer actually pays after all deductions.' },
      { title: 'Spouse / partner', cond: { f: 'marital', nin: ['Single', 'Divorced', 'Widowed'] }, condMsg: 'Spouse details are not needed for this marital status.', fields: [
        { id: 'sp_name', l: 'Spouse / partner name', t: 'txt', risky: 1 },
        { id: 'sp_tel', l: 'Spouse telephone number', t: 'txt', risky: 1 },
        { id: 'sp_occ', l: 'Spouse occupation', t: 'txt' }
      ] },
      { fields: [N('n_income')] }
    ] },

    { id: 'cover', title: 'Personal & group risk cover', blocks: [
      { help: 'The Letter of Authority (LOA) lets us get the policy schedules through Astute.', fields: [
        { id: 'loa', l: 'Can we send you a LOA to sign?', t: 'sel', o: ['Yes', 'No', 'Not now'] }
      ] },
      { title: 'Personal risk cover', fields: [
        { id: 'has_risk', l: 'Has personal risk cover', t: 'sel', o: YN },
        { id: 'joint', l: 'Joint life with spouse', t: 'sel', o: YN, cond: HAS_RISK, grey: 1 }
      ] },
      { title: 'Existing personal risk policies', list: 'risk', cond: HAS_RISK, grey: 1, condMsg: 'No personal risk cover is in place, so there are no policies to record.' },
      PS('risk', HAS_RISK, 'No personal risk cover is in place, so there is no policy schedule to ask for.'),
      { title: 'Group risk cover', fields: [
        { id: 'has_group', l: 'Group risk through employer', t: 'sel', o: ['Yes', 'No', 'Not sure'] }
      ] },
      { title: 'Existing group risk policies', list: 'grp', cond: HAS_GROUP, grey: 1, condMsg: 'No group risk cover is in place (Group risk through employer is No or Not sure), so there are no policies to record.' },
      PS('grp', HAS_GROUP, 'No group risk cover is in place, so there is no policy schedule to ask for.', true),
      { fields: [N('n_cover')] }
    ] },

    { id: 'retire', title: 'Retirement funding', blocks: [
      { title: 'Retirement annuities', list: 'ret_ra' },
      PS('ra', { rows: 'ret_ra' }, 'No retirement annuity is recorded, so there is no policy schedule to ask for.'),
      { title: 'Pension and provident funds', list: 'ret_pp' },
      PS('pp', { rows: 'ret_pp' }, 'No pension or provident fund is recorded, so there is no policy schedule to ask for.'),
      { fields: [N('n_retire')] }
    ] },

    { id: 'inv', title: 'Investments', blocks: [
      { list: 'inv' },
      PS('inv', { rows: 'inv' }, 'No investment is recorded, so there is no policy schedule to ask for.'),
      { fields: [N('n_inv')] }
    ] },

    /* Medical, will & short-term: the same boxes and the same four notes boxes, laid out in rows (half: two blocks side by side). */
    { id: 'other', title: 'Medical, will & short-term', blocks: [
      { title: 'Medical aid', half: 1, layout: 'g12', fields: [
        { id: 'ma', l: 'Medical aid', t: 'sel', o: ['Medical aid', 'Hospital plan', 'None'], s: 6 },
        { id: 'ma_prov', l: 'Medical aid provider', t: 'sel', free: 1, o: MED_SCHEMES, s: 6 },
        { id: 'ma_plan', l: 'Plan', t: 'txt', risky: 1, s: 6 },
        { id: 'ma_broker', l: 'Medical aid broker', t: 'sel', o: MA_BROKER, s: 6 },
        N('n_ma', 'Notes', 2)
      ] },
      { title: 'Gap cover', half: 1, layout: 'g12', fields: [
        { id: 'gap', l: 'Gap cover', t: 'sel', o: ['Yes', 'No', 'Not sure'], s: 6 },
        { id: 'gap_prov', l: 'Gap cover provider', t: 'sel', free: 1, o: GAP_PROVIDERS, s: 6 },
        { id: 'gap_broker', l: 'Gap cover broker', t: 'sel', o: MA_BROKER, s: 6 },
        N('n_gap', 'Notes', 2)
      ] },
      { title: 'Will', layout: 'g12', fields: [
        { id: 'will', l: 'Has a will', t: 'sel', o: YN, s: 4 },
        { id: 'will_up', l: 'Will is up to date', t: 'sel', o: YN, s: 4 },
        { id: 'will_where', l: 'Held with', t: 'sel', o: ['Capital Legacy', 'Other provider'], s: 4 },
        { id: 'will_where_other', l: 'Other', t: 'txt', s: 4 },
        { id: 'will_broker', l: 'Will broker', t: 'sel', o: ['Paul K', 'Other broker', 'None'], s: 4 },
        { id: 'will_date', l: 'Last updated', t: 'txt', date: 1, s: 4 },
        N('n_will', 'Notes', 2)
      ] },
      { title: 'Short-term insurance', layout: 'g12', fields: [
        { id: 'sti', l: 'Has short-term insurance', t: 'sel', o: ['Yes', 'No', 'Handled by spouse'], s: 3 },
        { id: 'sti_broker', l: 'Short-term broker', t: 'sel', o: ['Cameron Maritz', 'Other broker'], s: 3 },
        { id: 'sti_car', l: 'Car', t: 'sel', o: YN, s: 3 },
        { id: 'sti_house', l: 'Household contents', t: 'sel', o: YN, s: 3 },
        { id: 'sti_struct', l: 'Structural', t: 'sel', o: YN, s: 3 },
        { id: 'sti_personal', l: 'Total personal spend (R)', t: 'txt', money: 1, s: 3 },
        { id: 'sti_biz', l: 'Business', t: 'sel', o: YN, s: 3 },
        { id: 'sti_biz_spend', l: 'Total business spend (R)', t: 'txt', money: 1, s: 3 },
        N('n_sti', 'Notes', 2)
      ] }
    ] },

    { id: 'debts', title: 'Debts', blocks: [{ list: 'debts' }, { fields: [N('n_debts')] }] },
    { id: 'kids', title: 'Children', blocks: [{ list: 'kids' }, { fields: [N('n_kids')] }] },

    { id: 'health', roomy: 1, title: 'Health', blocks: [
      { fields: [
        { id: 'h_gen', l: 'General health good', t: 'sel', o: YN },
        { id: 'h_dia', l: 'Diabetes / high sugar', t: 'sel', o: YN },
        { id: 'h_chol', l: 'High cholesterol', t: 'sel', o: YN },
        { id: 'h_bp', l: 'High blood pressure', t: 'sel', o: YN },
        { id: 'h_bmi', l: 'High BMI', t: 'sel', o: YN },
        { id: 'h_oth', l: 'Other health issues', t: 'sel', o: YN },
        N('h_notes', 'Health notes')
      ] }
    ] },

    /* Client priorities identified: what is recommended to the client, area by area. Each area has a decision (priority, or not a priority), a box for the reason or instructions,
       a short summary of what the client has now (written from the rest of the form, see summary.js) and the quotes and referrals that belong to it. The earlier advisor pages are merged in here. */
    { id: 'prio', adv: 1, title: 'Client priorities and quotes needed', intro: 'What the client decides, area by area, and what we need to quote or refer. A priority turns the area green, not a priority red, and "not sure" or "check the budget" yellow.', blocks: [
      HEAD('life'),
      /* The two kinds of quote, side by side: BrightRock Fractured (built on the BrightRock Risk Calculation page, so BrightRock is the only insurer) and Standard (any insurer, BrightRock too). Each has the same three rows,
         FNA, Shortfall and Reduced. lane / row place a block in that grid; vl is the label voice and Claude use, so the two kinds of the same quote are told apart. */
      { pri: 'life', lane: 'br', row: 'fna', title: 'FNA quote', layout: 'g12', fields: [
        { id: 'bf_fna_req', l: 'FNA quote', vl: 'BrightRock Fractured FNA quote', t: 'sel', o: FNA_REQ, s: 6 },
        { id: 'bf_fna_type', l: 'Type of quote', vl: 'BrightRock Fractured FNA type of quote', t: 'sel', o: QTYPE, cond: BF_FNA_ON, s: 6 }
      ] },
      { pri: 'life', lane: 'std', row: 'fna', title: 'FNA quote', layout: 'g12', fields: [
        { id: 'fna_req', l: 'FNA quote', vl: 'Standard FNA quote', t: 'sel', o: FNA_REQ, s: 6 },
        { id: 'fna_type', l: 'Type of quote', vl: 'Standard FNA type of quote', t: 'sel', o: QTYPE, cond: FNA_ON, s: 6 },
        { id: 'fna_ins', l: 'Insurer(s)', vl: 'Standard FNA insurers', t: 'multi', multi: 'ins', o: INS_STD, nona: 1, cond: FNA_ON, s: 12 }
      ] },
      { pri: 'life', lane: 'br', row: 'sf', title: 'Shortfall quote', cond: HAS_GROUP, condMsg: NO_GROUP, pdfMsg: 1, layout: 'g12', fields: [
        { id: 'bf_sf_req', l: 'Shortfall quote', vl: 'BrightRock Fractured shortfall quote', t: 'sel', o: REQ, s: 6 },
        { id: 'bf_sf_type', l: 'Type of quote', vl: 'BrightRock Fractured shortfall type of quote', t: 'sel', o: QTYPE, cond: BF_SF_ON, s: 6 }
      ] },
      { pri: 'life', lane: 'std', row: 'sf', title: 'Shortfall quote', cond: HAS_GROUP, condMsg: NO_GROUP, layout: 'g12', fields: [
        { id: 'sf_req', l: 'Shortfall quote', vl: 'Standard shortfall quote', t: 'sel', o: REQ, s: 6 },
        { id: 'sf_type', l: 'Type of quote', vl: 'Standard shortfall type of quote', t: 'sel', o: QTYPE, cond: SF_ON, s: 6 },
        { id: 'sf_ins', l: 'Insurer(s)', vl: 'Standard shortfall insurers', t: 'multi', multi: 'ins', o: INS_STD, nona: 1, cond: SF_ON, s: 12 }
      ] },
      { pri: 'life', lane: 'br', row: 'red', title: 'Reduced quotes', list: 'bfred' },
      { pri: 'life', lane: 'std', row: 'red', title: 'Reduced quotes', list: 'redq' },
      /* What to ask for in a standard quote (it used to be the second half of the Risk Calculation page): shown as one table, a row for each cover (sqd groups the four blocks). */
      { pri: 'life', sqd: 'lc', sq: { name: 'Life cover', amt: 'lc_sa', term: ['lc_term', 'lc_termv'], aci: ['lc_aci', 'lc_aciv'], abi: 'lc_abiv', cmt: 'lc_cmt' }, title: 'Life cover: standard', fields: [
        { id: 'lc_sa', money: 1, l: 'Sum assured (R)', t: 'txt', opt: 1 },
        { id: 'lc_term', l: 'Term', t: 'sel', o: ['WOL', 'Fixed term', 'Other'], opt: 1 },
        { id: 'lc_termv', l: 'Term value', t: 'txt', opt: 1 },
        { id: 'lc_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'lc_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'lc_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('lc_cmt', 'Comments')
      ] },
      { pri: 'life', sqd: 'pd', sq: { name: 'Permanent disability', amt: 'pd_sa', term: ['pd_term', 'pd_termv'], aci: ['pd_aci', 'pd_aciv'], abi: 'pd_abiv', cmt: 'pd_cmt' }, title: 'Permanent disability: standard', fields: [
        { id: 'pd_sa', money: 1, l: 'Sum assured (R)', t: 'txt', opt: 1 },
        { id: 'pd_term', l: 'Term', t: 'sel', o: ['To age 65', 'To age 70', 'Fixed term', 'Other'], opt: 1 },
        { id: 'pd_termv', l: 'Term value', t: 'txt', opt: 1 },
        { id: 'pd_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'pd_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'pd_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('pd_cmt', 'Comments')
      ] },
      { pri: 'life', sqd: 'ip', sq: { name: 'Income protection / sickness benefit', amt: 'ips_amt', term: ['ips_age'], aci: ['ips_aci', 'ips_aciv'], abi: 'ips_abiv', wait: 'ips_wait', cmt: 'ips_cmt' }, title: 'Income protection / sickness benefit: standard', fields: [
        { id: 'ips_age', l: 'Income protection age', t: 'sel', o: ['65', '70'], opt: 1, preset: '65' },
        { id: 'ips_amt', money: 1, l: 'Insured amount (R p.m.)', t: 'txt', opt: 1 },
        { id: 'ips_wait', l: 'Waiting period', t: 'sel', o: WAIT, opt: 1 },
        { id: 'ips_aci', l: 'ACI', t: 'sel', o: ['Fixed', 'Age-rated', 'Other'], opt: 1, preset: 'Fixed' },
        { id: 'ips_aciv', l: 'ACI value', t: 'txt', opt: 1, preset: '?' },
        { id: 'ips_abiv', l: 'ABI', t: 'txt', opt: 1, preset: '5%' },
        N('ips_cmt', 'Comments')
      ] },
      { pri: 'life', sqd: 'dd', sq: { name: 'Dread disease', amt: 'dds_cover', term: ['dds_term', 'dds_termv'], aci: ['dds_aci', 'dds_aciv'], abi: 'dds_abiv', cmt: 'dds_cmt' }, title: 'Dread disease: standard', fields: dread('dds') },
      { pri: 'life', fields: [{ id: 'pref_spend', money: 1, l: 'Preferred monthly spend (R)', t: 'txt', opt: 1, voice: 1 }] },
      HEAD('ra'),
      { pri: 'ra', title: 'Retirement annuity quotes', list: 'raq' },
      HEAD('rgar'),
      { pri: 'rgar', title: 'Retirement goal analysis (RGAR)', help: 'To generate the RGAR report you need the client\'s current or paid-up retirement annuities, pension and/or provident fund(s), and proof of income where there is a pension and/or provident fund.', layout: 'g12', fields: [
        { id: 'rgar_req', l: 'RGAR', t: 'sel', o: ['Request an RGAR', 'Not required'], s: 4 },
        { id: 'ret_age', l: 'Retirement age', t: 'sel', o: ['50', '55', '60', '65', '70'], s: 4 },
        { id: 'ret_net', money: 1, l: 'Net amount (today\'s terms) (R)', t: 'txt', s: 4 }
      ] },
      HEAD('inv'),
      { pri: 'inv', title: 'Investment quotes', list: 'invq' },
      HEAD('egar'),
      { pri: 'egar', title: 'Education goal analysis (EGAR)', fields: [{ id: 'egar_req', l: 'EGAR', t: 'sel', o: ['Request an EGAR', 'Not required'] }] },
      HEAD('med'),
      { pri: 'med', title: 'Referral', fields: [
        { id: 'ref_med', l: 'Medical & gap (Valerie)', t: 'sel', o: ['Valerie to contact for medical aid', 'Valerie to contact for gap cover', 'Valerie to contact for both', 'Not required'] }
      ] },
      HEAD('will'),
      { pri: 'will', title: 'Referral', fields: [
        { id: 'ref_will', l: 'Will (Capital Legacy)', t: 'sel', o: ['Capital Legacy to contact client', 'Has updated will', 'Not interested'] }
      ] },
      HEAD('st'),
      { pri: 'st', title: 'Referral', fields: [
        { id: 'ref_sti', l: 'Short-term (Cameron)', t: 'sel', o: ['Cameron to contact client', 'Must not contact client', 'Client has own broker', 'Not interested'] }
      ] },
      { pri: 'biz', cond: BIZ, grey: 1, nomsg: 1, title: 'Buy & Sell', help: 'Partner names, ID numbers, cell numbers and shareholding % come from the Partners and shareholders list on the Occupation page.', fields: [
        { id: 'bs_req', l: 'Buy & Sell quote', t: 'sel', o: REQ },
        { id: 'bs_ins', l: 'Insurer', t: 'sel', free: 1, o: INS },
        { id: 'bs_value', money: 1, l: 'Agreed cover value (R)', t: 'txt' },
        { id: 'bs_basis', l: 'Basis of value', t: 'sel', o: ['Formal valuation', 'Shareholders agreement', 'Agreed between parties'] },
        { id: 'bs_own', l: 'Partner completes own Fact Find', t: 'sel', o: YN }
      ] },
      { pri: 'biz', cond: BIZ, grey: 1, nomsg: 1, title: 'Contingent liability', fields: [
        { id: 'cl_req', l: 'Contingent liability quote', t: 'sel', o: REQ },
        { id: 'cl_lender', l: 'Lender / credit provider', t: 'txt' },
        { id: 'cl_bal', money: 1, l: 'Loan account balance (R)', t: 'txt' },
        { id: 'cl_life', l: 'Life to be insured', t: 'txt' }
      ] },
      { pri: 'biz', cond: BIZ, grey: 1, nomsg: 1, title: 'Keyman', fields: [
        { id: 'km_req', l: 'Keyman quote', t: 'sel', o: REQ },
        { id: 'km_name', l: 'Keyman name', t: 'txt' },
        { id: 'km_role', l: 'Keyman role', t: 'txt' },
        { id: 'km_amt', money: 1, l: 'Cover amount (R)', t: 'txt' },
        { id: 'km_basis', l: 'Basis of cover amount', t: 'sel', o: ['Multiple of salary', 'Profit contribution', 'Replacement cost', 'Other'] }
      ] },
      { fields: [N('n_prio')] }
    ] },

    /* BrightRock Risk Calculation: always on its own page in the list (not tied to the Life area or to what cover the client has now). It is only how a BrightRock Fractured quote is built (the needs the cover is made from);
       the standard quotes of every other insurer are asked for on Client priorities and quotes needed. Income protection also splits the insured amount into the instalment protector, one box for each debt on the Debts page, and household needs. */
    { id: 'calc', adv: 1, title: 'BrightRock Risk Calculation', intro: 'How a BrightRock Fractured quote is built. This page is for BrightRock only: standard quotes (every other insurer, and BrightRock standard) are asked for, and described, on Client priorities and quotes needed.', blocks: [
      { strip: 'br' },
      { title: 'Life cover: fractured cover', layout: 'g12', fields: riskCalc('lc').concat([
        { id: 'lc_f_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1, preset: 'Fixed', s: 3 },
        { id: 'lc_f_aciv', l: 'ACI value', t: 'txt', opt: 1, preset: '?', s: 3 },
        { id: 'lc_wol', l: 'Life cover (WOL) ABI', t: 'txt', opt: 1, preset: '3%', s: 3 },
        { id: 'lc_ccabi', l: 'Childcare ABI', t: 'txt', opt: 1, preset: '5%', s: 3 }
      ]) },
      { title: 'Permanent disability: fractured cover', layout: 'g12', fields: riskCalc('pd').concat([
        { id: 'pd_f_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1, preset: 'Fixed', s: 3 },
        { id: 'pd_f_aciv', l: 'ACI value', t: 'txt', opt: 1, preset: '?', s: 3 },
        { id: 'pd_ccabi', l: 'Childcare ABI', t: 'txt', opt: 1, preset: '5%', s: 3 }
      ]) },
      { title: 'Income protection / sickness benefit: fractured cover', protector: 1, layout: 'g12', fields: [
        { id: 'ip_age', l: 'Income protection age', t: 'sel', o: ['65', '70'], opt: 1, preset: '65' },
        { id: 'ip_amt', l: 'Insured amount (R p.m.)', t: 'txt', calc: 'ip_amt' },
        { id: 'ip_hh', l: 'Household needs (R p.m.)', t: 'txt', calc: 'ip_hh' },
        { id: 'ip_wait', l: 'Waiting period', t: 'sel', o: WAIT, opt: 1, s: 3 },
        { id: 'ip_aci', l: 'ACI', t: 'sel', o: ['Fixed', 'Age-rated', 'Other'], opt: 1, preset: 'Fixed', s: 3 },
        { id: 'ip_aciv', l: 'ACI value', t: 'txt', opt: 1, preset: '?', s: 3 },
        { id: 'ip_abiv', l: 'ABI', t: 'txt', opt: 1, preset: '5%', s: 3 },
        N('ip_cmt', 'Comments', 1)
      ] },
      { title: 'Dread disease: fractured cover', layout: 'g12', fields: dread('dd') },
      { fields: [N('n_calc', 'Notes', 2)] }
    ] },

    /* Admin: the next appointment (moved here from Client priorities) on the left and, on the right, the action points for the personal assistant (what is still to be asked for, quotes to request, who must contact the client, the follow-up
       appointment), written from the rest of the form (see actions.js). */
    { id: 'admin', adv: 1, layout: 'admin', title: 'Admin', blocks: [
      { title: 'Next appointment', fields: [{ id: 'next_appt', l: 'Next appointment (date)', t: 'txt', date: 1, cal: 1, hint: 'e.g. 05/11/2026' }] },
      { title: 'Action Points for Personal Assistant', actions: 1, fields: [{ id: 'pa_actions', l: 'Action points for Sitamah Nathoo (personal assistant)', t: 'area', wide: 1, opt: 1, nonotes: 1, rows: 16 }] }
    ] }
  ];

  /* The areas of the Client priorities page. dec / cm are the ids of the area's decision and comments boxes (made below). sum: the boxes (f) and lists (l, with the columns used, or 0 for all)
     that the area's summary is written from, and nothing else, so a summary only ever speaks about its own area. */
  /* sum.t: totals worked out by the page (never added up by Claude): [label, [[list, column], ...]]. */
  var panels = [
    { id: 'life', title: 'Personal Risk Covers', sub: 'Life cover, disability, dread disease, income protection', src: 'Personal risk cover, group risk cover, credit life, total debt and childcare to be covered',
      sum: { f: ['has_risk', 'joint', 'has_group', 'bf_fna_req', 'bf_fna_type', 'bf_sf_req', 'bf_sf_type', 'fna_req', 'fna_type', 'fna_ins', 'sf_req', 'sf_type', 'sf_ins'], l: { risk: 0, grp: 0, debts: ['type', 'prov', 'prov_other', 'desc', 'cl'], bfred: 0, redq: 0 },
        t: [['Total debt to be covered (balances)', [['debts', 'bal']]], ['Total monthly debt repayments', [['debts', 'inst']]], ['Total childcare cost to be covered, per month', [['kids', 'cost']]]] } },
    { id: 'ra', title: 'Retirement Planning', sub: 'Retirement Annuities', src: 'Retirement funding: retirement annuities, pension and provident funds',
      sum: { f: [], l: { ret_ra: 0, ret_pp: 0, raq: 0 } } },
    { id: 'rgar', title: 'RGAR', sub: 'Retirement goal analysis', src: 'Retirement funding totals, retirement age and income goal',
      sum: { f: ['rgar_req', 'ret_age', 'ret_net'], l: {}, t: [['Total saved across all retirement funds', [['ret_ra', 'val'], ['ret_pp', 'val']]], ['Total monthly contributions to retirement funds', [['ret_ra', 'contrib'], ['ret_pp', 'contrib']]]] } },
    { id: 'inv', title: 'Investment Planning', sub: 'Investments', src: 'Investments',
      sum: { f: [], l: { inv: 0, invq: 0 } } },
    { id: 'egar', inline: 1, title: 'EGAR', sub: 'Education goal analysis', src: 'Children (education stage and cost)',
      sum: { f: ['egar_req'], l: { kids: ['age', 'stage', 'cost'] } } },
    { id: 'med', inline: 1, title: 'Medical Aid', sub: 'Medical aid and gap cover', src: 'Medical aid and gap cover',
      sum: { f: ['ma', 'ma_prov', 'ma_plan', 'ma_broker', 'gap', 'gap_prov', 'gap_broker', 'ref_med'], l: {} } },
    { id: 'will', inline: 1, title: 'Will', sub: 'Will and estate planning', src: 'Will',
      sum: { f: ['will', 'will_up', 'will_where', 'will_where_other', 'will_broker', 'will_date', 'ref_will'], l: {} } },
    { id: 'st', inline: 1, title: 'Short Term', sub: 'Short-term insurance', src: 'Short-term insurance',
      sum: { f: ['sti', 'sti_broker', 'sti_car', 'sti_house', 'sti_struct', 'sti_personal', 'sti_biz', 'sti_biz_spend', 'ref_sti'], l: {} } },
    { id: 'biz', title: 'Business assurance', sub: 'Buy & sell, contingent liability, keyman', src: 'Occupation: the business and its existing business assurance policies', nodec: 1, cond: BIZ, condMsg: 'Business assurance applies only when Business owner is set to Yes on the Occupation page.',
      sum: { f: ['biz_assur', 'biz_struct', 'biz_partners', 'biz_pct', 'biz_loans'], l: { bizpol: 0, shares: ['name', 'pct'] } } }
  ];
  var panelsById = {};
  panels.forEach(function (p) { panelsById[p.id] = p; if (!p.nodec) { p.dec = 'pr_' + p.id; p.cm = 'pr_' + p.id + '_cm'; } });

  /* Lists that grow. cards: show each row as a spread-out card (and in the PDF as its own block).
     sum: columns that get a total.  calc: a column worked out from other columns. */
  var lists = {
    risk: { title: 'Existing personal risk policies', add: 'Add policy', cols: [
      { k: 'prov', l: 'Provider', o: INS, free: 1 }, { k: 'spend', money: 1, l: 'Spend (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }, { k: 'notes', l: 'Notes' }
    ], sum: { spend: 'Total spend' } },
    grp: { title: 'Existing group risk policies', add: 'Add group policy', cols: [
      { k: 'prov', l: 'Provider / administrator', o: INS, free: 1 }, { k: 'spend', money: 1, l: 'Spend (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }, { k: 'notes', l: 'Notes' }
    ], sum: { spend: 'Total spend' } },
    ret_ra: { title: 'Retirement annuities', add: 'Add retirement annuity', cols: [
      { k: 'prov', l: 'Provider / administrator', o: INS.concat(['Allan Gray']), free: 1 },
      { k: 'val', money: 1, l: 'Value (R)', num: 1 }, { k: 'contrib', money: 1, l: 'Monthly contribution (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }
    ], sum: { val: 'Total value', contrib: 'Total contributions' } },
    ret_pp: { title: 'Pension and provident funds', add: 'Add pension / provident fund', cols: [
      { k: 'type', l: 'Type', o: ['Pension fund', 'Provident fund'] }, { k: 'prov', l: 'Provider / administrator', o: INS.concat(['Allan Gray']), free: 1 },
      { k: 'val', money: 1, l: 'Value (R)', num: 1 }, { k: 'contrib', money: 1, l: 'Monthly contribution (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }
    ], sum: { val: 'Total value', contrib: 'Total contributions' } },
    inv: { title: 'Investments', add: 'Add investment', cols: [
      { k: 'type', l: 'Type', o: ['Unit trust', 'Tax-free savings', 'Endowment', 'Offshore', 'Share portfolio', 'Living annuity', 'Other'] },
      { k: 'prov', l: 'Provider', free: 1, o: INV_PROVIDERS },
      { k: 'val', money: 1, l: 'Current value (R)', num: 1 }, { k: 'prem', money: 1, l: 'Monthly premium (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }
    ], sum: { val: 'Total value', prem: 'Total monthly' } },
    bizpol: { cards: 'Business policy', title: 'Existing business assurance policies', add: 'Add business policy', cols: [
      { k: 'type', l: 'Type', o: ['Buy & sell', 'Contingent liability', 'Keyman', 'Other'] }, { k: 'prov', l: 'Insurer', o: INS, free: 1 },
      { k: 'cover', money: 1, l: 'Cover amount (R)', num: 1 }, { k: 'prem', money: 1, l: 'Premium (R p.m.)', num: 1 },
      { k: 'paid', l: 'Premium paid by', o: ['The business', 'The shareholders personally', 'Not sure'] }, { k: 'broker', l: 'Broker on record', o: BROKER },
      { k: 'notes', l: 'Notes', t: 'area', wide: 1 }
    ], sum: { cover: 'Total cover', prem: 'Total premiums' } },
    shares: { title: 'Partners and shareholders', add: 'Add partner / shareholder', cols: [
      { k: 'name', l: 'Full name' }, { k: 'id', l: 'ID number' }, { k: 'cell', l: 'Cell number' }, { k: 'pct', l: 'Shareholding %', num: 1 }
    ], sum: {} },
    debts: { cards: 'Debt', title: 'Debts', add: 'Add debt', cols: [
      { k: 'type', l: 'Type', o: ['Home loan', 'Vehicle finance', 'Credit card', 'Personal loan', 'Revolving credit', 'Other'] }, { k: 'prov', l: 'Loan provider / bank', o: BANKS }, { k: 'prov_other', l: 'Other (if the bank is not in the list)' },
      { k: 'desc', l: 'Description' }, { k: 'owner', l: 'Owner', o: WHO }, { k: 'payer', l: 'Payer', o: WHO }, { k: 'term', l: 'Term left' },
      { k: 'inst', money: 1, l: 'Instalment (R p.m.)', num: 1 }, { k: 'bal', money: 1, l: 'Balance (R)', num: 1 }, { k: 'asset', money: 1, l: 'Asset value (R)', num: 1 },
      { k: 'cl', l: 'Credit life with lender', o: YN }, { k: 'surety', l: 'Surety signed', o: ['Yes', 'No', 'Unsure'] },
      { k: 'notes', l: 'Notes', t: 'area', wide: 1 }
    ], sum: { inst: 'Total monthly', bal: 'Total liabilities', asset: 'Total assets' } },
    kids: { cards: 'Child', title: 'Children', add: 'Add child', cols: [
      { k: 'name', l: 'Name' }, { k: 'sname', l: 'Surname' }, { k: 'gender', l: 'Gender', o: ['Female', 'Male'] }, { k: 'dob', l: 'Date of birth', date: 1 }, { k: 'age', l: 'Age', calc: 'age' },
      { k: 'stage', l: 'Education stage', o: STAGES }, { k: 'cost', money: 1, l: 'Monthly cost (R)', num: 1 }
    ], sum: { cost: 'Total childcare' } },
    bfred: { dense: 1, cards: 'Reduced quote', title: 'Reduced quotes (BrightRock Fractured)', add: 'Add reduced quote', cols: [
      { k: 'req', l: 'Request', o: REQ }, { k: 'type', l: 'Type of quote', o: QTYPE }, { k: 'amt', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }
    ], sum: {} },
    redq: { dense: 1, cards: 'Reduced quote', title: 'Reduced quotes (Standard)', add: 'Add reduced quote', cols: [
      { k: 'req', l: 'Request', o: REQ }, { k: 'type', l: 'Type of quote', o: QTYPE }, { k: 'ins', l: 'Insurer', o: INS_STD, free: 1 }, { k: 'amt', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }
    ], sum: {} },
    raq: { dense: 1, cards: 'RA quote', title: 'Retirement annuity quotes', add: 'Add RA quote', cols: [
      { k: 'req', l: 'Request', o: ['Request a quote', 'Not required', 'Cannot afford now', 'Not interested'] }, { k: 'ins', l: 'Insurer', o: INS, free: 1 },
      { k: 'monthly', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }, { k: 'lump', money: 1, l: 'Lump sum (R)', num: 1 }
    ], sum: {} },
    invq: { dense: 1, cards: 'Investment quote', title: 'Investment quotes', add: 'Add investment quote', cols: [
      { k: 'purpose', l: 'Purpose', o: ['Children\'s education', 'General investing'] }, { k: 'product', l: 'Product', o: ['Tax-free savings', 'Endowment', 'Unit trust / voluntary funds', 'Other'] },
      { k: 'ins', l: 'Insurer', o: INS, free: 1 }, { k: 'monthly', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }, { k: 'lump', money: 1, l: 'Lump sum (R)', num: 1 }
    ], sum: {} }
  };

  /* A block of a priority area that is not applicable (not a priority, or no business) stays on screen greyed out; its answers are left out of the voice reading, the progress count and the PDF.
     The decision box that switches an area off is listed here as the cond of each of the area's blocks. */
  sections.forEach(function (sec) {
    sec.blocks.forEach(function (b) {
      var p = b.pri && panelsById[b.pri]; if (!p) return;
      b.own = b.cond || null;                                                                 // own: the block's own rule (a Shortfall quote needs a Group), apart from the area being switched off
      if (!b.condMsg) { b.grey = 1; b.nomsg = 1; }                                            // a block with a message of its own (Shortfall) says so and goes away, as before
      if (p.dec && !b.head) { var off = { f: p.dec, nin: [NOT_PRIORITY] }; b.cond = b.cond ? { all: [b.cond, off] } : off; }
    });
  });

  /* Every field, flat, for lookups. */
  var byId = {};
  sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) { byId[f.id] = f; }); }); });

  return { version: '3.0', released: 'October 2026', sections: sections, lists: lists, panels: panels, panelsById: panelsById, advisor: ADVISOR, PRIORITY: PRIORITY, NOT_PRIORITY: NOT_PRIORITY, UNSURE: UNSURE, BUDGET: BUDGET, fieldsById: byId };
});
