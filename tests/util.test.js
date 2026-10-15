const test = require('node:test');
const assert = require('node:assert');
const u = require('../app/js/util.js');

test('numbers typed in South African style are understood', () => {
  assert.strictEqual(u.num('R 32 138,13'), 32138.13);
  assert.strictEqual(u.num('1,200,000'), 1200000);
  assert.strictEqual(u.num(''), 0);
  assert.strictEqual(u.num('abc'), 0);
});
test('money formatting', () => {
  assert.strictEqual(u.money(11400), 'R 11 400.00');
  assert.strictEqual(u.formatMoney('80200'), 'R 80 200.00');
  assert.strictEqual(u.formatMoney('R 1,200,000'), 'R 1 200 000.00');
  assert.strictEqual(u.formatMoney('32,5'), 'R 32.50');
  assert.strictEqual(u.formatMoney('about 5'), 'about 5');
  assert.strictEqual(u.formatMoney(''), '');
  assert.strictEqual(u.money2(32138.13), 'R 32 138.13');
});
test('dates in common forms', () => {
  assert.deepStrictEqual(u.parseDate('14 March 1986'), { y: 1986, m: 3, d: 14 });
  assert.deepStrictEqual(u.parseDate('1986-03-14'), { y: 1986, m: 3, d: 14 });
  assert.deepStrictEqual(u.parseDate('14/03/1986'), { y: 1986, m: 3, d: 14 });
  assert.strictEqual(u.parseDate('31 February 2020'), null);
  assert.strictEqual(u.parseDate('soon'), null);
});
test('age is counted to the birthday', () => {
  assert.strictEqual(u.ageAt({ y: 1986, m: 3, d: 14 }, { y: 2026, m: 3, d: 13 }), 39);
  assert.strictEqual(u.ageAt({ y: 1986, m: 3, d: 14 }, { y: 2026, m: 3, d: 14 }), 40);
});
test('South African ID numbers', () => {
  assert.strictEqual(u.saIdValid('8001015009087'), true);
  assert.strictEqual(u.saIdValid('8001015009088'), false);
  assert.strictEqual(u.saIdValid('123'), false);
  assert.deepStrictEqual(u.dobFromSaId('8001015009087'), { y: 1980, m: 1, d: 1 });
});
