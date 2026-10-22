/* The Fact Find definition: sections, fields, lists and documents.
   One place describes the form, so the screen, the saved file, the checks and the PDF all agree.
   Field keys:  id, l (label), t ('txt' | 'sel' | 'area'), o (options), free (pick a value or type your own),
                preset (default value), calc (name of a calculation in calc.js), risky (check the spelling or number),
                opt (optional, left out of the progress count), wide (full width), link ([text, url]), hint,
                lookup (a box with a look-up button: the id of the box holding the name to search for, or 'client'), lookupBtn (the button's words), nopdf (left off the PDF), rows (lines of a text box), len (shows a live digit count: see validate.lengthState).
   Block keys:  title, fields, list, cond (show only when true), condMsg, help (guidance shown on screen only), docs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.schema = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var YN = ['Yes', 'No'], BROKER = ['Paul K', 'Other broker', 'Through company', 'None'];
  var INS = ['Old Mutual', 'Momentum', 'Liberty', 'Sanlam', 'Discovery', 'BrightRock', 'Hollard', 'Assupol', 'Clientele', 'Other'];
  var BANKS = ['Nedbank', 'FNB', 'Investec', 'Standard Bank', 'ABSA', 'Discovery Bank', 'Capitec', 'Wesbank', 'Other'];
  var WHO = ['Client', 'Spouse', 'Joint', 'Business'];
  var ACI = ['Fixed', 'CPI', 'None'], REQ = ['Request a quote', 'Not required'];
  var MA_BROKER = ['Through company', 'Privately paid, no broker', 'Privately paid, other broker', 'Paul K'];
  var N = function (id, l) { return { id: id, l: l || 'Notes', t: 'area', wide: 1, opt: 1 }; };
  var BIZ = { f: 'bizowner', eq: 'Yes' };
  var MED_SCHEMES = ['Discovery Health', 'Momentum Medical Scheme', 'Bonitas Medical Fund', 'Bestmed Medical Scheme', 'Fedhealth Medical Scheme', 'Medihelp Medical Scheme', 'KeyHealth Medical Scheme', 'Medshield Medical Scheme', 'CompCare Medical Scheme', 'GEMS (Government Employees Medical Scheme)', 'POLMED (SA Police Service)', 'SAMWUMED (Municipal Workers)', 'Transmed (Transport industry)', 'LA Health (Local Authorities)', 'Bankmed (Banking sector)', 'Sizwe Hosmed Medical Scheme', 'Profmed (Professionals only)', 'Anglovaal Group Medical Scheme (AGMS)', 'Sasolmed', 'Cape Medical Plan (Cape Medical Scheme)', 'Hosmed Medical Scheme', 'Genesis Medical Scheme', 'Suremed Health', 'Resolution Health Medical Scheme', 'Makoti Medical Scheme', 'BMW Medical Aid Scheme', 'Anglo Medical Scheme', 'Other'];
  var GAP_PROVIDERS = ['TRA (Total Risk Administrators)', 'Turnberry', 'Ambledown Financial Services', 'Stratum Benefits', 'Kaelo', 'Zestlife', 'GapCover', 'Oneplan', 'Discovery', 'Momentum', 'Sanlam', 'Old Mutual', 'Dis-Chem Health', 'NetcarePlus', 'Other'];
  var INV_PROVIDERS = ['Old Mutual', 'Momentum', 'Sanlam', 'Liberty', 'Discovery Invest', 'Allan Gray', 'Coronation', 'Ninety One', 'PSG', 'Sygnia', 'Satrix', '10X Investments', 'Glacier by Sanlam', 'Investec', 'Nedgroup Investments', 'STANLIB', 'Absa', 'EasyEquities', 'Other'];
  var STAGES = ['Not Yet in School', 'Pre-school', 'Primary', 'High School', 'Tertiary'];

  function riskCalc(p) {
    return [
      { id: p + '_hh', l: 'Household net income (R)', t: 'txt', calc: 'hh' },
      { id: p + '_cc', l: 'Minus childcare costs (R)', t: 'txt', calc: 'cc' },
      { id: p + '_dr', l: 'Minus debt repayments (R)', t: 'txt', calc: 'dr' },
      { id: p + '_need', l: 'Total household income needed (R)', t: 'txt', calc: 'need' }
    ];
  }

  var sections = [
    { id: 'info', title: 'Client info', roomy: 1, fit: 1, blocks: [
      { title: 'Meeting', layout: 'g12', fields: [
        { id: 'consent', l: 'Consent to record and transcribe', t: 'sel', o: YN, s: 3 },
        { id: 'advisor', l: 'Advisor', t: 'txt', preset: 'Paul Kafentzis', s: 3 },
        { id: 'date', l: 'Date completed', t: 'txt', date: 1, preset: '@today', s: 2 },
        { id: 'meet', l: 'Type of meeting', t: 'sel', o: ['Teams Meeting', 'Telephonic Meeting', 'Physical Meeting', 'Other'], preset: 'Teams Meeting', s: 2 },
        { id: 'ref', l: 'Referral from', t: 'sel', o: ['D&R Marketing', 'Current client', 'Referral prospect', 'Spouse', 'Other'], s: 2 }
      ] },
      { title: 'Client', layout: 'g12', fields: [
        { id: 'fname', l: 'First name', t: 'txt', s: 3 },
        { id: 'sname', l: 'Surname', t: 'txt', risky: 1, s: 3 },
        { id: 'dob', l: 'Date of birth', t: 'txt', date: 1, risky: 1, hint: 'e.g. 14/03/1986', s: 3 },
        { id: 'age', l: 'Age at date of form', t: 'txt', calc: 'age', s: 3 },
        { id: 'idtype', l: 'ID or passport', t: 'sel', o: ['ID', 'Passport'], preset: 'ID', voice: 1, s: 3 },
        { id: 'idno', l: 'ID / passport number', t: 'txt', risky: 1, len: 1, s: 4 },
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
        { id: 'biz_loans', l: 'Business loans / surety signed', t: 'sel', o: ['Yes', 'No', 'Unsure'] }
      ] },
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
        { id: 'marital', l: 'Marital status', t: 'sel', o: ['Single', 'Married in community of property', 'Married out of community (with accrual)', 'Married out of community (no accrual)', 'Customary marriage', 'Civil union', 'Life partner', 'Divorced', 'Widowed'] }
      ], help: 'Direct Net Income is gross income less PAYE and UIF, calculated from the SARS tables. It matches TaxTim\'s "Take-home pay" for a client under 65 with no pension contribution and no medical aid credits. Take-home net income is what the employer actually pays after all deductions.' },
      { title: 'Spouse / partner', cond: { f: 'marital', nin: ['Single', 'Divorced', 'Widowed'] }, condMsg: 'Spouse details are not needed for this marital status.', fields: [
        { id: 'sp_name', l: 'Spouse / partner name', t: 'txt', risky: 1 },
        { id: 'sp_tel', l: 'Spouse telephone number', t: 'txt', risky: 1 },
        { id: 'sp_occ', l: 'Spouse occupation', t: 'txt' }
      ] },
      { fields: [N('n_income')] }
    ] },

    { id: 'cover', title: 'Existing cover & retirement', blocks: [
      { title: 'Personal risk cover', fields: [
        { id: 'has_risk', l: 'Has personal risk cover', t: 'sel', o: YN },
        { id: 'joint', l: 'Joint cover with spouse', t: 'sel', o: YN },
        { id: 'has_group', l: 'Group risk through employer', t: 'sel', o: ['Yes', 'No', 'Not sure'] }
      ] },
      { list: 'risk' },
      { title: 'Retirement funding', list: 'ret' },
      { fields: [N('n_cover')] }
    ] },

    { id: 'inv', title: 'Investments', blocks: [
      { list: 'inv' },
      { fields: [N('n_inv')] }
    ] },

    { id: 'other', roomy: 1, title: 'Medical, will & short-term', blocks: [
      { title: 'Medical aid', fields: [
        { id: 'ma', l: 'Medical aid', t: 'sel', o: ['Medical aid', 'Hospital plan', 'None'] },
        { id: 'ma_prov', l: 'Medical aid provider', t: 'sel', free: 1, o: MED_SCHEMES },
        { id: 'ma_plan', l: 'Plan', t: 'txt', risky: 1 },
        { id: 'ma_broker', l: 'Medical aid broker', t: 'sel', o: MA_BROKER },
        N('n_ma')
      ] },
      { title: 'Gap cover', fields: [
        { id: 'gap', l: 'Gap cover', t: 'sel', o: YN },
        { id: 'gap_prov', l: 'Gap cover provider', t: 'sel', free: 1, o: GAP_PROVIDERS },
        { id: 'gap_broker', l: 'Gap cover broker', t: 'sel', o: MA_BROKER },
        N('n_gap')
      ] },
      { title: 'Will', fields: [
        { id: 'will', l: 'Has a will', t: 'sel', o: YN },
        { id: 'will_up', l: 'Will is up to date', t: 'sel', o: YN },
        { id: 'will_where', l: 'Held with', t: 'sel', o: ['Capital Legacy', 'Other provider'] },
        { id: 'will_where_other', l: 'Other', t: 'txt' },
        { id: 'will_broker', l: 'Will broker', t: 'sel', o: ['Paul K', 'Other broker', 'None'] },
        { id: 'will_date', l: 'Last updated', t: 'txt', date: 1 },
        N('n_will')
      ] },
      { title: 'Short-term insurance', fields: [
        { id: 'sti', l: 'Has short-term insurance', t: 'sel', o: ['Yes', 'No', 'Handled by spouse'] },
        { id: 'sti_broker', l: 'Short-term broker', t: 'sel', o: ['Cameron Maritz', 'Other broker'] },
        { id: 'sti_car', l: 'Car', t: 'sel', o: YN },
        { id: 'sti_house', l: 'Household contents', t: 'sel', o: YN },
        { id: 'sti_struct', l: 'Structural', t: 'sel', o: YN },
        { id: 'sti_personal', l: 'Total personal spend (R)', t: 'txt', money: 1 },
        { id: 'sti_biz', l: 'Business', t: 'sel', o: YN },
        { id: 'sti_biz_spend', l: 'Total business spend (R)', t: 'txt', money: 1 },
        N('n_sti')
      ] }
    ] },

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

    { id: 'debts', title: 'Debts', blocks: [{ list: 'debts' }, { fields: [N('n_debts')] }] },
    { id: 'kids', title: 'Children', blocks: [{ list: 'kids' }, { fields: [N('n_kids')] }] },

    { id: 'q_risk', adv: 1, title: 'Personal risk quotes', blocks: [
      { title: 'FNA quote', fields: [
        { id: 'fna_req', l: 'FNA quote', t: 'sel', o: ['Request a quote', 'Not required', 'No FNA done'] },
        { id: 'fna_ins', l: 'Insurer', t: 'sel', free: 1, o: INS }
      ] },
      { title: 'Shortfall quote', fields: [
        { id: 'sf_req', l: 'Shortfall quote', t: 'sel', o: REQ },
        { id: 'sf_ins', l: 'Insurer', t: 'sel', free: 1, o: INS }
      ] },
      { title: 'Reduced quotes', list: 'redq' },
      { fields: [{ id: 'pref_spend', money: 1, l: 'Preferred monthly spend (R)', t: 'txt', opt: 1 }, N('n_q_risk')] }
    ] },
    { id: 'q_ret', adv: 1, title: 'Retirement & investment quotes', blocks: [
      { title: 'Retirement goal analysis (RGAR)', fields: [
        { id: 'rgar_req', l: 'RGAR', t: 'sel', o: ['Request an RGAR', 'Not required'] },
        { id: 'ret_age', l: 'Retirement age', t: 'sel', o: ['50', '55', '60', '65', '70'] },
        { id: 'ret_net', money: 1, l: 'Net amount (today\'s terms) (R)', t: 'txt' }
      ] },
      { title: 'Retirement annuity quotes', list: 'raq' },
      { title: 'Education goal analysis (EGAR)', fields: [{ id: 'egar_req', l: 'EGAR', t: 'sel', o: ['Request an EGAR', 'Not required'] }] },
      { title: 'Investment quotes', list: 'invq' },
      { fields: [N('n_q_ret')] }
    ] },
    { id: 'q_ref', adv: 1, roomy: 1, title: 'Referrals & documents', blocks: [
      { title: 'Referrals', fields: [
        { id: 'ref_sti', l: 'Short-term (Cameron)', t: 'sel', o: ['Cameron to contact client', 'Must not contact client', 'Client has own broker', 'Not interested'] },
        { id: 'ref_med', l: 'Medical & gap (Valerie)', t: 'sel', o: ['Valerie to contact for medical aid', 'Valerie to contact for gap cover', 'Valerie to contact for both', 'Not required'] },
        { id: 'ref_will', l: 'Will (Capital Legacy)', t: 'sel', o: ['Capital Legacy to contact client', 'Has updated will', 'Not interested'] }
      ] },
      { title: 'Documents to request', docs: 1 },
      { fields: [N('n_ref')] }
    ] },
    { id: 'q_calc', adv: 1, title: 'Risk calculation', blocks: [
      { title: 'Life cover: fractured cover', fields: riskCalc('lc').concat([
        { id: 'lc_f_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'lc_f_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'lc_wol', l: 'Life cover (WOL) ABI', t: 'txt', opt: 1 },
        { id: 'lc_ccabi', l: 'Childcare ABI', t: 'txt', opt: 1 }
      ]) },
      { title: 'Life cover: standard', fields: [
        { id: 'lc_sa', money: 1, l: 'Sum assured (R)', t: 'txt', opt: 1 },
        { id: 'lc_term', l: 'Term', t: 'sel', o: ['WOL', 'Fixed term', 'Other'], opt: 1 },
        { id: 'lc_termv', l: 'Term value', t: 'txt', opt: 1 },
        { id: 'lc_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'lc_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'lc_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('lc_cmt', 'Comments')
      ] },
      { title: 'Permanent disability: fractured cover', fields: riskCalc('pd').concat([
        { id: 'pd_f_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'pd_f_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'pd_ccabi', l: 'Childcare ABI', t: 'txt', opt: 1 }
      ]) },
      { title: 'Permanent disability: standard', fields: [
        { id: 'pd_sa', money: 1, l: 'Sum assured (R)', t: 'txt', opt: 1 },
        { id: 'pd_term', l: 'Term', t: 'sel', o: ['To age 65', 'To age 70', 'Fixed term', 'Other'], opt: 1 },
        { id: 'pd_termv', l: 'Term value', t: 'txt', opt: 1 },
        { id: 'pd_aci', l: 'ACI', t: 'sel', o: ACI, opt: 1 },
        { id: 'pd_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'pd_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('pd_cmt', 'Comments')
      ] },
      { title: 'Dread disease', fields: [
        { id: 'dd_cover', money: 1, l: 'Dread disease cover (R)', t: 'txt', opt: 1 },
        { id: 'dd_term', l: 'Term', t: 'sel', o: ['WOL', 'Specified Age', 'Other'], opt: 1 },
        { id: 'dd_termv', l: 'Term value', t: 'txt', opt: 1 },
        { id: 'dd_aci', l: 'ACI', t: 'sel', o: ['Fixed', 'Age-rated', 'Other'], opt: 1 },
        { id: 'dd_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'dd_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('dd_cmt', 'Comments')
      ] },
      { title: 'Income protection / sickness benefit', fields: [
        { id: 'ip_age', l: 'Income protection age', t: 'sel', o: ['65', '70'], opt: 1 },
        { id: 'ip_amt', money: 1, l: 'Insured amount (R p.m.)', t: 'txt', opt: 1 },
        { id: 'ip_wait', l: 'Waiting period', t: 'sel', o: ['7 days', '14 days', '1 month', '3 months', 'Other'], opt: 1 },
        { id: 'ip_aci', l: 'ACI', t: 'sel', o: ['Fixed', 'Age-rated', 'Other'], opt: 1 },
        { id: 'ip_aciv', l: 'ACI value', t: 'txt', opt: 1 },
        { id: 'ip_abiv', l: 'ABI', t: 'txt', opt: 1 },
        N('ip_cmt', 'Comments')
      ] },
      { fields: [N('n_calc')] }
    ] },
    { id: 'q_biz', adv: 1, roomy: 1, title: 'Business assurance', cond: BIZ, condMsg: 'Business assurance applies only when Business owner is set to Yes on the Occupation page.', blocks: [
      { title: 'Buy & Sell', help: 'Partner names, ID numbers, cell numbers and shareholding % come from the Partners and shareholders list on the Occupation page.', fields: [
        { id: 'bs_req', l: 'Buy & Sell quote', t: 'sel', o: REQ },
        { id: 'bs_ins', l: 'Insurer', t: 'sel', free: 1, o: INS },
        { id: 'bs_value', money: 1, l: 'Agreed cover value (R)', t: 'txt' },
        { id: 'bs_basis', l: 'Basis of value', t: 'sel', o: ['Formal valuation', 'Shareholders agreement', 'Agreed between parties'] },
        { id: 'bs_own', l: 'Partner completes own Fact Find', t: 'sel', o: YN },
        N('n_bs')
      ] },
      { title: 'Contingent liability', fields: [
        { id: 'cl_req', l: 'Contingent liability quote', t: 'sel', o: REQ },
        { id: 'cl_lender', l: 'Lender / credit provider', t: 'txt' },
        { id: 'cl_bal', money: 1, l: 'Loan account balance (R)', t: 'txt' },
        { id: 'cl_life', l: 'Life to be insured', t: 'txt' }
      ] },
      { title: 'Keyman', fields: [
        { id: 'km_req', l: 'Keyman quote', t: 'sel', o: REQ },
        { id: 'km_name', l: 'Keyman name', t: 'txt' },
        { id: 'km_role', l: 'Keyman role', t: 'txt' },
        { id: 'km_amt', money: 1, l: 'Cover amount (R)', t: 'txt' },
        { id: 'km_basis', l: 'Basis of cover amount', t: 'sel', o: ['Multiple of salary', 'Profit contribution', 'Replacement cost', 'Other'] }
      ] }
    ] }
  ];

  /* Lists that grow. cards: show each row as a spread-out card (and in the PDF as its own block).
     sum: columns that get a total.  calc: a column worked out from other columns. */
  var lists = {
    risk: { title: 'Existing personal risk policies', add: 'Add policy', cols: [
      { k: 'prov', l: 'Provider', o: INS, free: 1 }, { k: 'spend', money: 1, l: 'Spend (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }, { k: 'notes', l: 'Notes' }
    ], sum: { spend: 'Total spend' } },
    ret: { title: 'Retirement funding', add: 'Add fund', cols: [
      { k: 'type', l: 'Type', o: ['Retirement annuity', 'Pension fund', 'Provident fund'] }, { k: 'prov', l: 'Provider / administrator', o: INS.concat(['Allan Gray']), free: 1 },
      { k: 'val', money: 1, l: 'Value (R)', num: 1 }, { k: 'contrib', money: 1, l: 'Monthly contribution (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }
    ], sum: { contrib: 'Total contributions' } },
    inv: { title: 'Investments', add: 'Add investment', cols: [
      { k: 'type', l: 'Type', o: ['Unit trust', 'Tax-free savings', 'Endowment', 'Offshore', 'Share portfolio', 'Living annuity', 'Other'] },
      { k: 'prov', l: 'Provider', free: 1, o: INV_PROVIDERS },
      { k: 'val', money: 1, l: 'Current value (R)', num: 1 }, { k: 'prem', money: 1, l: 'Monthly premium (R p.m.)', num: 1 }, { k: 'broker', l: 'Broker on record', o: BROKER }
    ], sum: { val: 'Total value', prem: 'Total monthly' } },
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
      { k: 'name', l: 'Name & surname' }, { k: 'gender', l: 'Gender', o: ['Female', 'Male'] }, { k: 'dob', l: 'Date of birth', date: 1 },
      { k: 'stage', l: 'Education stage', o: STAGES }, { k: 'cost', money: 1, l: 'Monthly cost (R)', num: 1 }
    ], sum: { cost: 'Total childcare' } },
    redq: { cards: 'Reduced quote', title: 'Reduced quotes', add: 'Add reduced quote', cols: [
      { k: 'req', l: 'Request', o: REQ }, { k: 'ins', l: 'Insurer', o: INS, free: 1 }, { k: 'amt', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }
    ], sum: {} },
    raq: { cards: 'RA quote', title: 'Retirement annuity quotes', add: 'Add RA quote', cols: [
      { k: 'req', l: 'Request', o: ['Request a quote', 'Not required', 'Cannot afford now', 'Not interested'] }, { k: 'ins', l: 'Insurer', o: INS, free: 1 },
      { k: 'monthly', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }, { k: 'lump', money: 1, l: 'Lump sum (R)', num: 1 }
    ], sum: {} },
    invq: { cards: 'Investment quote', title: 'Investment quotes', add: 'Add investment quote', cols: [
      { k: 'purpose', l: 'Purpose', o: ['Children\'s education', 'General investing'] }, { k: 'product', l: 'Product', o: ['Tax-free savings', 'Endowment', 'Unit trust / voluntary funds', 'Other'] },
      { k: 'ins', l: 'Insurer', o: INS, free: 1 }, { k: 'monthly', money: 1, l: 'Monthly amount (R p.m.)', num: 1 }, { k: 'lump', money: 1, l: 'Lump sum (R)', num: 1 }
    ], sum: {} }
  };

  var docs = ['Existing life policy schedules', 'Group risk benefit summary', 'Retirement annuity statements', 'Pension / provident statement', 'Investment statements'];

  /* Every field, flat, for lookups. */
  var byId = {};
  sections.forEach(function (s) { s.blocks.forEach(function (b) { (b.fields || []).forEach(function (f) { byId[f.id] = f; }); }); });

  return { version: '3.0', released: 'October 2026', sections: sections, lists: lists, docs: docs, fieldsById: byId };
});
