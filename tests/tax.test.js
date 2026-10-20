const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const tax = require('../app/js/tax.js');

/* The TaxTim results Paul supplied. Direct Net Income must match to the cent. */
for (const [file, year] of [['docs/taxtim_examples.json', '2025/26'], ['docs/taxtim_examples_2026_27.json', '2026/27']]) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const ex of j.examples) {
    test(`${year}: R${ex.gross_monthly} gross gives take-home R${ex.take_home}`, () => {
      const r = tax.monthlyNet(ex.gross_monthly, 40, year);
      assert.strictEqual(r.net, ex.take_home);
      if (ex.paye !== undefined) assert.strictEqual(r.paye, ex.paye);
      if (ex.uif !== undefined) assert.strictEqual(r.uif, ex.uif);
    });
  }
}
test('tax year follows 1 March to end of February', () => {
  assert.strictEqual(tax.taxYearFor({ y: 2026, m: 10, d: 15 }), '2026/27');
  assert.strictEqual(tax.taxYearFor({ y: 2026, m: 2, d: 28 }), '2025/26');
  assert.strictEqual(tax.taxYearFor({ y: 2026, m: 3, d: 1 }), '2026/27');
});
test('UIF is capped and low earners pay no PAYE', () => {
  assert.strictEqual(tax.monthlyNet(30000, 40, '2026/27').uif, 177.12);
  assert.strictEqual(tax.monthlyNet(7000, 40, '2026/27').paye, 0);
});
