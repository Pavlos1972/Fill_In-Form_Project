const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');
const validate = require('../app/js/validate.js');

function fresh() { const s = store.blank(); s.f.date = { v: '2026-10-15', st: 'confirmed' }; return s; }
const set = (s, id, v) => store.setField(s, id, v);

test('every field id is unique and every list and calc used exists', () => {
  const seen = new Set();
  for (const sec of schema.sections) for (const b of sec.blocks) {
    for (const f of b.fields || []) {
      assert.ok(!seen.has(f.id), 'duplicate id ' + f.id); seen.add(f.id);
      if (f.t === 'sel') assert.ok(Array.isArray(f.o) && f.o.length, 'no options for ' + f.id);
      if (f.calc) assert.doesNotThrow(() => calc.field(f.calc, store.ctxFor(fresh())), f.calc);
    }
    if (b.list) assert.ok(schema.lists[b.list], 'missing list ' + b.list);
  }
});
test('a new Fact Find starts blank apart from the preset values', () => {
  const s = store.blank();
  assert.strictEqual(s.f.advisor.v, 'Paul Kafentzis');
  assert.strictEqual(s.f.fname.st, 'empty');
  assert.strictEqual(s.f.h_chol.v, '');           // no silent "No"
  assert.strictEqual(s.f.dd_cover.v, '');         // no default R500 000
});
test('Direct Net Income follows the TaxTim figure and the take-home stays separate', () => {
  const s = fresh(); set(s, 'gross', 'R 40 000'); set(s, 'net', '32 000');
  const c = store.ctxFor(s);
  assert.strictEqual(calc.field('dnet', c), 'R 32 138.13');
  assert.strictEqual(c.v('net'), '32 000');
});
test('disposable income and the risk calculation use take-home, childcare and debts', () => {
  const s = fresh(); set(s, 'net', '32000'); set(s, 'exp', '20000');
  store.addRow(s, 'debts', { inst: '11 400' }); store.addRow(s, 'kids', { dob: '2019-08-22', cost: '2 500' });
  const c = store.ctxFor(s);
  assert.strictEqual(calc.field('disp', c), 'R 12 000');
  assert.strictEqual(calc.field('hh', c), 'R 32 000');
  assert.strictEqual(calc.field('cc', c), 'R 2 500');
  assert.strictEqual(calc.field('dr', c), 'R 11 400');
  assert.strictEqual(calc.field('need', c), 'R 18 100');
});
test('education stage comes from the date of birth', () => {
  const s = fresh(); const c = store.ctxFor(s);
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2019-08-22' } }, c), 'Primary');
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2025-01-01' } }, c), 'Not yet in school');
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '' } }, c), '');
});
test('duties total adds the seven percentages', () => {
  const s = fresh(); set(s, 'd_desk', '60'); set(s, 'd_supo', '40');
  assert.strictEqual(calc.field('d_tot', store.ctxFor(s)), '100%');
});
test('business and spouse sections show only when they apply', () => {
  const s = fresh(); const c = () => store.ctxFor(s);
  const biz = schema.sections.find(x => x.id === 'q_biz');
  assert.strictEqual(calc.showIf(biz.cond, c()), false);
  set(s, 'bizowner', 'Yes'); assert.strictEqual(calc.showIf(biz.cond, c()), true);
  const spouse = schema.sections.find(x => x.id === 'income').blocks[1];
  set(s, 'marital', 'Single'); assert.strictEqual(calc.showIf(spouse.cond, c()), false);
  set(s, 'marital', 'Civil union'); assert.strictEqual(calc.showIf(spouse.cond, c()), true);
});
test('checks catch a bad ID, email, phone and duties total', () => {
  const s = fresh(); set(s, 'idno', '8001015009088'); set(s, 'pemail', 'nope'); set(s, 'cell', '082 555'); set(s, 'd_desk', '60');
  const ids = validate.check(store.ctxFor(s)).map(w => w.id);
  for (const id of ['idno', 'pemail', 'cell', 'd_tot']) assert.ok(ids.includes(id), id);
  set(s, 'idno', '8001015009087'); set(s, 'pemail', 'a@b.co.za'); set(s, 'cell', '082 555 0148'); set(s, 'd_supo', '40');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)), []);
});
test('a saved file reopens exactly, and unknown or missing parts are tolerated', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  store.addRow(s, 'debts', { prov: 'Nedbank', inst: '11 400' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(store.clientName(back), 'Thandi Dlamini');
  assert.strictEqual(back.l.debts[0].d.prov, 'Nedbank');
  assert.strictEqual(back.f.h_chol.v, '');
  assert.throws(() => store.fromJSON('{"app":"other"}'), /not a Wealth Revolution Fact Find/);
});
test('file name follows the meeting date and client', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  assert.strictEqual(store.baseFileName(s), 'Fact Find - 2026-10-15 - Thandi Dlamini');
});
test('each debt has an Other bank box and its own notes', () => {
  const cols = schema.lists.debts.cols.map(c => c.k);
  assert.ok(cols.includes('prov_other') && cols.includes('notes'));
  const s = fresh(); store.addRow(s, 'debts', { prov: 'Other', prov_other: 'Bidvest Bank', notes: 'Settling early' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.l.debts[0].d.prov_other, 'Bidvest Bank');
  assert.strictEqual(back.l.debts[0].d.notes, 'Settling early');
});
