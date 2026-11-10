/* The Short Risk Application (Wealth Revolution's General Short Risk Application, used for all insurers): every section, box, choice and list. Change the form here.
   Box: id, l (label), t ('txt' by default, 'sel' a list of choices, 'money', 'date'), o (the choices), free (a value that is not in the list may be typed), opt (not needed for the application to be complete),
   cond (the box only counts while another box holds a value), preset ('@today'), wide (a full row), hint (a grey example in the empty box).
   Section: id, title, fields or list, cols (3: the PDF puts three boxes on a row instead of two), note (a line of guidance under the heading; screen only, it is not in the PDF). Page: the sections shown together on one screen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.SR = root.SR || {}; root.SR.schema = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var YN = ['Yes', 'No'];
  var INSURERS = ['Momentum', 'Brightrock', 'Discovery', 'Old Mutual', 'Liberty', 'Sanlam', 'Stanlib'];
  /* The product type is part of the file name. It also says whether the cover is for the person or the business (Cover lines). */
  var PRODUCTS = ['Personal Covers', 'Business Covers', 'Buy & Sell', 'Contingent Liability', 'Keyman Cover'];
  var LINES_OF = { 'Personal Covers': 'Personal', 'Business Covers': 'Business', 'Buy & Sell': 'Business', 'Contingent Liability': 'Business', 'Keyman Cover': 'Business' };
  var ABBR = { 'Old Mutual': 'OM', 'Brightrock': 'BR' };                                              // the insurers that have a short name in the application file name; the others are written out
  var BANKS = ['ABSA', 'African Bank', 'Bidvest Bank', 'Capitec', 'Discovery Bank', 'FNB', 'Investec', 'Nedbank', 'Standard Bank', 'TymeBank'];
  var YES = { cond: { f: 'replace', eq: 'Yes' } };

  var sections = [
    { id: 'cover', title: 'Cover info', fields: [
      { id: 'insurer', l: 'Insurer', t: 'sel', o: INSURERS },
      { id: 'quote', l: 'Quote number' },
      { id: 'product', l: 'Product type', t: 'sel', o: PRODUCTS, free: 1 },
      { id: 'lines', l: 'Cover lines', t: 'sel', o: ['Business', 'Personal'] },
      { id: 'premium', l: 'Monthly premium (R p.m.)', t: 'money' },
      { id: 'owner', l: 'Owner of the policy' },
      { id: 'ownerpays', l: 'The policy owner is responsible for paying the monthly premium', t: 'sel', o: YN, wide: 1 },
      { id: 'date', l: 'Date of application', t: 'date', preset: '@today' }
    ] },
    { id: 'client', title: 'Client details', fields: [
      { id: 'title', l: 'Title', t: 'sel', o: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'], free: 1 },
      { id: 'fname', l: 'Full names' },
      { id: 'sname', l: 'Surname' },
      { id: 'idno', l: 'ID number' }
    ] },
    { id: 'contact', cols: 3, title: 'Client contact details', fields: [
      { id: 'cell', l: 'Cell' },
      { id: 'work', l: 'Work', opt: 1 },
      { id: 'email', l: 'E-mail' }
    ] },
    { id: 'address', cols: 3, title: 'Home address', fields: [
      { id: 'unit', l: 'Unit number', opt: 1 },
      { id: 'complex', l: 'Complex name', opt: 1 },
      { id: 'street_no', l: 'Street number' },
      { id: 'street', l: 'Street name' },
      { id: 'suburb', l: 'Suburb' },
      { id: 'city', l: 'City' },
      { id: 'region', l: 'Region', opt: 1 },
      { id: 'postal', l: 'Postal code' }
    ] },
    { id: 'phone', title: 'Contact day & time', fields: [
      { id: 'best_time', l: 'Best time for us to phone you', opt: 1 },
      { id: 'best_day', l: 'Best work day for us to phone you', opt: 1 }
    ] },
    { id: 'doctor', cols: 3, title: 'Doctor’s details', fields: [
      { id: 'dr', l: 'Doctor', opt: 1 },
      { id: 'dr_tel', l: 'Doctor’s tel no', opt: 1 },
      { id: 'dr_years', l: 'Years with the doctor', opt: 1 }
    ] },
    { id: 'bank', cols: 3, title: 'Banking details of the person paying the premium', note: 'These details are saved in this application’s file and printed in its PDF. Keep both in the client’s folder.', fields: [
      { id: 'acc_holder', l: 'Account holder' },
      { id: 'bank', l: 'Bank name', t: 'sel', o: BANKS, free: 1 },
      { id: 'branch', l: 'Branch name', opt: 1 },
      { id: 'branch_code', l: 'Branch code' },
      { id: 'acc_type', l: 'Account type', t: 'sel', o: ['Cheque', 'Savings', 'Transmission'], free: 1 },
      { id: 'debit_date', l: 'Debit date (not the 10th to the 14th)', hint: 'e.g. 25' },
      { id: 'acc_no', l: 'Account number' },
      { id: 'bank_contact', l: 'Contact number', opt: 1 },
      { id: 'bank_email', l: 'Email address', opt: 1 }
    ] },
    { id: 'kids', title: 'Children’s details', list: 'kids' },
    { id: 'benef', title: 'Beneficiary details', list: 'benef' },
    { id: 'decl', title: 'Insolvency and debt', fields: [
      { id: 'insolvent', wide: 1, l: 'Ever been insolvent or sequestrated?', t: 'sel', o: YN },
      { id: 'debt_review', wide: 1, l: 'Are you currently under debt review?', t: 'sel', o: YN },
      { id: 'debt_help', wide: 1, l: 'Have you applied for assistance with debt?', t: 'sel', o: YN }
    ] },
    { id: 'existing', title: 'Existing insurance details', fields: [
      { id: 'replace', l: 'Will this policy replace an existing policy?', t: 'sel', o: YN, wide: 1 },
      { id: 'old_company', l: 'Company', cond: YES.cond },
      { id: 'old_policy', l: 'Policy number', cond: YES.cond }
    ] }
  ];

  /* Lists: any number of rows, added and removed on the screen. opt: the list may stay empty. */
  var lists = {
    kids: { title: 'Children', one: 'Child', add: 'Add child', opt: 1, cols: [
      { k: 'name', l: 'Name & surname' },
      { k: 'id', l: 'ID number', id: 1 }
    ] },
    benef: { title: 'Beneficiaries', one: 'Beneficiary', add: 'Add beneficiary', opt: 1, cols: [
      { k: 'name', l: 'Name & surname' },
      { k: 'id', l: 'ID number', id: 1 },
      { k: 'relation', l: 'Relation', o: ['Spouse', 'Child', 'Parent', 'Sibling', 'Estate', 'Other'], free: 1 },
      { k: 'pct', l: '% of benefit', pct: 1 }
    ], sum: 'pct' }
  };

  var pages = [
    { id: 'client', title: 'Cover & client', sections: ['cover', 'client', 'contact'] },
    { id: 'home', title: 'Home & doctor', sections: ['address', 'phone', 'doctor'] },
    { id: 'bank', cols: 3, title: 'Banking', sections: ['bank'] },
    { id: 'family', title: 'Family', sections: ['kids', 'benef'] },
    { id: 'decl', title: 'Declarations', sections: ['decl', 'existing'] }
  ];
  var sectionsById = {}, pageOf = {};
  sections.forEach(function (s) { sectionsById[s.id] = s; });
  pages.forEach(function (p) { p.sections.forEach(function (id) { pageOf[id] = p.id; }); });

  var fieldsById = {}, fieldIds = [], sectionOf = {};
  sections.forEach(function (s) { (s.fields || []).forEach(function (f) { fieldsById[f.id] = f; fieldIds.push(f.id); sectionOf[f.id] = s.id; }); });

  return { version: '1.0', released: 'November 2026', title: 'Short Risk Application', sections: sections, sectionsById: sectionsById, pages: pages, pageOf: pageOf, lists: lists, fieldsById: fieldsById, fieldIds: fieldIds, sectionOf: sectionOf,
    insurers: INSURERS, products: PRODUCTS, linesOf: LINES_OF, abbr: ABBR, banks: BANKS };
});
