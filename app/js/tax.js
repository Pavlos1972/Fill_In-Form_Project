/* SARS income tax tables and the Direct Net Income calculation.
   Direct Net Income = gross less PAYE and UIF, which is what TaxTim shows as "Take-home pay".
   Verified against TaxTim: 2026/27 for R20k, R40k, R60k, R80k and R100k gross (under 65, no pension, no medical credits).
   2025/26 verified against the same five salaries. Update the tables here each tax year (docs/tax_tables.json mirrors them). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.tax = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  /* bracket = [upper limit of annual taxable income, tax at the lower limit, rate, lower limit] */
  var TABLES = {
    '2025/26': {
      brackets: [[237100, 0, .18, 0], [370500, 42678, .26, 237100], [512800, 77362, .31, 370500], [673000, 121475, .36, 512800], [857900, 179147, .39, 673000], [1817000, 251258, .41, 857900], [1e12, 644489, .45, 1817000]],
      rebates: { primary: 17235, secondary: 9444, tertiary: 3145 }
    },
    '2026/27': {
      brackets: [[245100, 0, .18, 0], [383100, 44118, .26, 245100], [530200, 79998, .31, 383100], [695800, 125599, .36, 530200], [887000, 185215, .39, 695800], [1878600, 259783, .41, 887000], [1e12, 659969, .45, 1878600]],
      /* secondary and tertiary are not yet verified against TaxTim */
      rebates: { primary: 17820, secondary: 9765, tertiary: 3249 }
    }
  };
  var UIF_RATE = 0.01, UIF_CAP_MONTHLY_EARNINGS = 17712;

  /* Tax year runs 1 March to end of February; label is "2026/27". date = {y,m,d}. */
  function taxYearFor(date) {
    var y = date ? (date.m >= 3 ? date.y : date.y - 1) : new Date().getFullYear();
    var label = y + '/' + String((y + 1) % 100).padStart(2, '0');
    if (TABLES[label]) return label;
    var keys = Object.keys(TABLES).sort();
    return keys[keys.length - 1];
  }
  function annualTax(annualIncome, age, year) {
    var t = TABLES[year] || TABLES[taxYearFor()], tax = 0, i, b;
    for (i = 0; i < t.brackets.length; i++) {
      b = t.brackets[i];
      if (annualIncome <= b[0]) { tax = b[1] + b[2] * (annualIncome - b[3]); break; }
    }
    var rebate = t.rebates.primary + (age != null && age >= 65 ? t.rebates.secondary : 0) + (age != null && age >= 75 ? t.rebates.tertiary : 0);
    return Math.max(0, tax - rebate);
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  /* grossMonthly in rand; age in years or null (treated as under 65). */
  function monthlyNet(grossMonthly, age, year) {
    var paye = annualTax(grossMonthly * 12, age, year) / 12;
    var uif = Math.min(grossMonthly, UIF_CAP_MONTHLY_EARNINGS) * UIF_RATE;
    return { paye: round2(paye), uif: round2(uif), net: round2(grossMonthly - paye - uif), year: year };
  }
  return { TABLES: TABLES, taxYearFor: taxYearFor, annualTax: annualTax, monthlyNet: monthlyNet };
});
