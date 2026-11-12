/* The Investment Capture Sheet (the details every insurer asks for when an investment is captured: product, client, contact, work, education, beneficiaries, bank, source of funds), used for all insurers. Change the form here.
   (Same pattern as the Short Risk Application's definition.) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cs-rt-data.js'));
  else { root.CS = root.CS || {}; root.CS.schema = factory(root.CS.rtdata); }
})(typeof self !== 'undefined' ? self : this, function (RT) {
  var YN = ['Yes', 'No'];
  var PLANNER = 'Paul Kafentzis';
  var PROVIDERS = ['Old Mutual', 'Momentum', 'Sanlam', 'Liberty', 'Discovery', 'Allan Gray', 'Stanlib'];
  var PRODUCTS = ['Retirement Annuity', 'Tax-Free Investment', 'Endowment / Flexible Investment Plan', 'Living Annuity', 'Other'];
  var CONTRIB = ['Recurring (monthly)', 'Lump sum', 'Section 14 transfer'];
  var MARITAL = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Civil Union', 'Customary Marriage', 'Life Partner / Cohabiting'];
  var CONTRACT = ['In Community of Property', 'Out of Community of Property - with Accrual', 'Out of Community of Property - without Accrual', 'Customary Marriage', 'Civil Union', 'Religious Marriage', 'Foreign Marriage', 'N/A'];
  var QUAL = ['Matric', 'Matric & Diploma', '4-Year Diploma', '3-Year Degree', 'Postgraduate'];
  var BANKS = ['Absa Bank', 'Access Bank', 'African Bank', 'Albaraka Bank', 'Bank Zero', 'Bidvest Bank', 'Capitec Bank', 'Discovery Bank', 'FNB', 'FNB Namibia', 'GoTyme Bank (TymeBank)', 'Investec', 'Nedbank', 'OM Bank (Old Mutual)', 'Postbank', 'Sasfin Bank', 'Standard Bank'];
  var ABBR = { 'Old Mutual': 'OM' };
  /* Old Mutual's own product names, as its Application Details for Finalisor sheet lists them: offered as suggestions in the Product box while the insurer is Old Mutual (anything else can be typed). */
  var OM_PRODUCTS = ['OM Flexi Investment Plan', 'OM RA - Xtra Max 8.5% - section 14 transfer', 'OM RA - Xtra Max 8.5%', 'OM RA - Xtra Max 5%', 'OM Optimal RA - Recurring', 'OM Tax Free recurring', 'OM Tax Free Lumpsum', 'OM RA - Wealth recurring'];
  var MARRIED = { f: 'marital', in: ['Married', 'Civil Union', 'Customary Marriage', 'Life Partner / Cohabiting', 'Separated'] };

  /* the questionnaire's boxes, made from its own questions (cs-rt-data.js): the client's confirmation, 18 statements, 5 capacity questions */
  var rtFields = [{ id: 'rt_understand', l: 'The client confirms that they understand the different investments as explained by their Financial Planner, and the benefits and risks of every investment type', t: 'sel', o: ['Confirmed'], rt: 'confirm' }];
  RT.STATEMENTS.forEach(function (q, i) { rtFields.push({ id: 'rt_s' + (i + 1), l: q, t: 'sel', o: RT.SCALE, rt: 'scale', n: i + 1 }); });
  RT.CAPACITY.forEach(function (c, i) { rtFields.push({ id: 'rt_c' + (i + 1), l: c.question, t: 'sel', o: c.options, rt: 'cap', title: c.title, n: i + 1 }); });

  var sections = [
    { id: 'product', title: 'Product & policy details', fields: [
      { id: 'provider', l: 'Insurer / provider', t: 'sel', o: PROVIDERS, free: 1 },
      { id: 'product', l: 'Product type', t: 'sel', o: PRODUCTS },
      { id: 'product_name', l: 'Product (the provider’s own name)', hint: 'e.g. OM Tax Free recurring', o: [], suggest: 1, wide: 1 },
      { id: 'contrib_type', l: 'Recurring, lump sum or transfer', t: 'sel', o: CONTRIB },
      { id: 'amount', l: 'Contribution or lump sum (R)', t: 'money' },
      { id: 'start_date', l: 'Date of entry / start date (also the deduction date)', t: 'date', cal: 1 },
      { id: 'deferred', l: 'Deferred premium facility', t: 'sel', o: ['Yes', 'No', 'N/A'], opt: 1 },
      { id: 'replace', l: 'Is this a replacement of an existing policy?', t: 'sel', o: YN, wide: 1 },
      { id: 'old_policy', l: 'Policy number(s) of the policy being replaced', cond: { f: 'replace', eq: 'Yes' }, wide: 1 },
      { id: 'date', l: 'Date of application', t: 'date', preset: '@today' }
    ] },
    { id: 'personal', title: 'Personal details', fields: [
      { id: 'title', l: 'Title', t: 'sel', o: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'], free: 1 },
      { id: 'fname', l: 'Full names (as per ID document)' },
      { id: 'sname', l: 'Surname' },
      { id: 'idno', l: 'Identity number' },
      { id: 'birth_country', l: 'Country of birth' },
      { id: 'nationality', l: 'Nationality' },
      { id: 'language', l: 'Correspondence language' },
      { id: 'marital', l: 'Marital status', t: 'sel', o: MARITAL },
      { id: 'marital_date', l: 'Marital date', t: 'date', cal: 1, cond: MARRIED, opt: 1 },
      { id: 'marital_contract', l: 'Marital contract type', t: 'sel', o: CONTRACT, cond: MARRIED, wide: 1 },
      { id: 'tax_no', l: 'Tax number' },
      { id: 'foreign_tax', l: 'Tax obligation in another country?', t: 'sel', o: YN },
      { id: 'foreign_tax_no', l: 'Foreign tax number', cond: { f: 'foreign_tax', eq: 'Yes' } }
    ] },
    { id: 'contact', cols: 3, title: 'Contact details', fields: [
      { id: 'tel_h', l: 'Telephone (H)', opt: 1 },
      { id: 'tel_w', l: 'Telephone (W)', opt: 1 },
      { id: 'cell', l: 'Cell' },
      { id: 'email', l: 'E-mail', wide: 1 },
      { id: 'postal', l: 'Postal address', wide: 1 },
      { id: 'postal_code', l: 'Postal code' },
      { id: 'residential', l: 'Residential address', wide: 1 },
      { id: 'residential_code', l: 'Residential code' }
    ] },
    { id: 'work', cols: 3, title: 'Employment details', fields: [
      { id: 'occupation', l: 'Occupation' },
      { id: 'position', l: 'Employment position' },
      { id: 'industry', l: 'Employment industry' }
    ] },
    { id: 'education', title: 'Education', fields: [
      { id: 'qualification', l: 'Highest qualification', t: 'sel', o: QUAL },
      { id: 'edu_other', l: 'Education / other', opt: 1 }
    ] },
    { id: 'benef', title: 'Beneficiary details', list: 'benef' },
    { id: 'bank', cols: 3, title: 'Bank details', fields: [
      { id: 'bank', l: 'Name of bank', t: 'sel', o: BANKS, free: 1 },
      { id: 'branch_code', l: 'Branch code' },
      { id: 'acc_type', l: 'Account type', t: 'sel', o: ['Current', 'Savings', 'Cheque', 'Other'], free: 1 },
      { id: 'acc_holder', l: 'Account holder', wide: 1 },
      { id: 'acc_no', l: 'Account number' }
    ] },
    { id: 'funds', cols: 3, title: 'Source of funds & income', fields: [
      { id: 'src_funds', l: 'Source of funds (investments only)', wide: 1 },
      { id: 'src_income', l: 'Source of income', wide: 1 },
      { id: 'known_years', l: 'I have known the investor for: years' },
      { id: 'known_months', l: 'months', opt: 1 },
      { id: 'known_days', l: 'days', opt: 1 },
      { id: 'funds_raised', l: 'Where have the funds for this investment been raised from?', wide: 1 },
      { id: 'own_knowledge', l: 'Has the information been provided from your own knowledge of the investor\u2019s circumstances?', t: 'sel', o: YN, wide: 1 },
      { id: 'origin', l: 'If no, where did it originate?', cond: { f: 'own_knowledge', eq: 'No' }, wide: 1 }
    ] },
    { id: 'declare', title: 'Declaration', pdfNote: 1, note: 'Please refer to the provider’s terms and conditions in its own application system. Bank mandates and customer declarations are generated by that system. The client’s signature and the date are on the PDF.', fields: [] },
    { id: 'risk', title: 'Risk tolerance questionnaire', rtq: 1, note: 'Completed here with the client. The client’s name and the date come from this application. It has its own PDF, with a blank signature block and date for the client to sign later, saved separately from this application’s PDF.', fields: rtFields },
    { id: 'risk_result', title: 'Result of the questionnaire', skipEmpty: 1, note: 'Worked out from the answers above. These three are printed on this application’s PDF; the questionnaire itself is not.', fields: [
      { id: 'risk_profile', l: 'Risk profile', calc: 1, opt: 1 },
      { id: 'risk_score', l: 'Total score (out of 90)', calc: 1, opt: 1 },
      { id: 'risk_ref', l: 'Questionnaire reference', calc: 1, opt: 1 }
    ] }
  ];

  var lists = {
    benef: { title: 'Beneficiaries', one: 'Beneficiary', add: 'Add beneficiary', opt: 1, cols: [
      { k: 'name', l: 'Name' },
      { k: 'sname', l: 'Surname' },
      { k: 'cell', l: 'Cell number' },
      { k: 'id', l: 'ID number', id: 1 },
      { k: 'relation', l: 'Relationship', o: ['Spouse', 'Child', 'Parent', 'Sibling', 'Estate', 'Other'], free: 1 },
      { k: 'pct', l: 'Share %', pct: 1 }
    ], sum: 'pct' }
  };

  var pages = [
    { id: 'product', title: 'Product & client', sections: ['product', 'personal'] },
    { id: 'contact', cols: 3, title: 'Contact & work', sections: ['contact', 'work', 'education'] },
    { id: 'bank', cols: 3, title: 'Beneficiaries & bank', sections: ['benef', 'bank'] },
    { id: 'funds', cols: 3, title: 'Source of funds', sections: ['funds', 'declare'] },
    { id: 'risk', title: 'Risk tolerance', sections: ['risk', 'risk_result'] }
  ];
  var sectionsById = {}, pageOf = {};
  sections.forEach(function (s) { sectionsById[s.id] = s; });
  pages.forEach(function (p) { p.sections.forEach(function (id) { pageOf[id] = p.id; }); });
  var fieldsById = {}, fieldIds = [], sectionOf = {};
  sections.forEach(function (s) { (s.fields || []).forEach(function (f) { fieldsById[f.id] = f; fieldIds.push(f.id); sectionOf[f.id] = s.id; }); });

  return { version: '1.0', released: 'November 2026', title: 'Investment Capture Sheet', sections: sections, sectionsById: sectionsById, pages: pages, pageOf: pageOf, lists: lists, fieldsById: fieldsById, fieldIds: fieldIds, sectionOf: sectionOf,
    planner: PLANNER, rt: RT, insurers: PROVIDERS, products: PRODUCTS, abbr: ABBR, banks: BANKS, suggestions: { 'Old Mutual': OM_PRODUCTS } };
});
