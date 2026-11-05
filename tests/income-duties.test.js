/* Other income (Rental, Spousal, Child Maintenance) and Total Income; Disposable income from Total Income; the BrightRock Insured amount still from the take-home net income alone; the Duties split zeros. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const f = (s, name) => calc.field(name, store.ctxFor(s));
const income = schema.sections.find(x => x.id === 'income');

test('Income & household: the four new boxes are there, in the order Paul gave, with exactly his words', () => {
  const ids = income.blocks[0].fields.map(x => x.id);
  assert.deepStrictEqual(ids.slice(0, 9), ['gross', 'dnet', 'net', 'rent', 'spinc', 'maint', 'tinc', 'exp', 'disp']);
  assert.deepStrictEqual(['rent', 'spinc', 'maint', 'tinc', 'exp', 'disp'].map(id => schema.fieldsById[id].l), ['Rental Income', 'Spousal Income', 'Child Maintenance Income', 'Total Income', 'Monthly expenses / budget (R)', 'Disposable income (R)']);
  ['rent', 'spinc', 'maint'].forEach(id => assert.ok(schema.fieldsById[id].money && schema.fieldsById[id].opt, id + ' is a money box and optional'));
  assert.ok(schema.fieldsById.tinc.calc === 'tinc' && schema.fieldsById.disp.calc === 'disp');
  assert.strictEqual(schema.fieldsById.net.l, 'Take-home net income (R p.m.)');
});

test('Total Income is the take-home net income plus the rental, spousal and child maintenance income; Disposable income is Total Income less the expenses', () => {
  const s = fresh();
  assert.strictEqual(f(s, 'tinc'), '');
  set(s, 'net', 'R 20 000.00'); assert.strictEqual(f(s, 'tinc'), 'R 20 000.00');
  set(s, 'rent', 'R 3 000.00'); assert.strictEqual(f(s, 'tinc'), 'R 23 000.00');
  set(s, 'spinc', 'R 10 000.00'); set(s, 'maint', 'R 16 000.00'); assert.strictEqual(f(s, 'tinc'), 'R 49 000.00');
  assert.strictEqual(f(s, 'disp'), '', 'no expenses yet, no disposable income');
  set(s, 'exp', 'R 19 000.00'); assert.strictEqual(f(s, 'disp'), 'R 30 000.00');
  set(s, 'rent', ''); set(s, 'spinc', ''); set(s, 'maint', ''); assert.strictEqual(f(s, 'tinc'), 'R 20 000.00'); assert.strictEqual(f(s, 'disp'), 'R 1 000.00');
  const o = fresh(); set(o, 'maint', 'R 5 000.00'); assert.strictEqual(f(o, 'tinc'), 'R 5 000.00', 'other income alone still adds up');
});

test('the BrightRock Insured amount (income protection) and the household figures stay the take-home net income alone', () => {
  const s = fresh(); set(s, 'net', 'R 20 000.00'); set(s, 'rent', 'R 3 000.00'); set(s, 'spinc', 'R 10 000.00'); set(s, 'maint', 'R 16 000.00');
  assert.strictEqual(f(s, 'ip_amt'), 'R 20 000.00'); assert.strictEqual(f(s, 'hh'), 'R 20 000.00'); assert.strictEqual(f(s, 'need'), 'R 20 000.00');
  assert.strictEqual(calc.ipSplit(store.ctxFor(s)).insured, 20000);
});

test('the new income boxes are optional: left empty they cost nothing in the progress, filled they are saved and reopened', () => {
  const a = fresh(), before = store.counts(a, income);
  set(a, 'rent', 'R 3 000.00'); assert.deepStrictEqual(store.counts(a, income), before);
  const back = store.fromJSON(store.toJSON(a)); assert.strictEqual(back.f.rent.v, 'R 3 000.00');
  const old = JSON.parse(store.toJSON(fresh())); delete old.f.rent; delete old.f.spinc; delete old.f.maint; delete old.f.tinc;
  const o = store.fromJSON(JSON.stringify(old)); assert.deepStrictEqual(['rent', 'spinc', 'maint'].map(id => o.f[id].v), ['', '', ''], 'a file saved before the boxes existed opens with them empty');
});

test('voice: the three income boxes are asked for and filled by their own words', () => {
  const idx = V.buildIndex(schema);
  ['rent', 'spinc', 'maint'].forEach(id => assert.ok(idx.byId[id], id + ' is in the voice index'));
  const v = (id, t) => { const r = V.interpret(idx.byId[id], t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  assert.strictEqual(v('maint', 'R16 000 a month'), 'R 16 000.00');
  assert.strictEqual(v('rent', 'R3 500'), 'R 3 500.00');
  assert.strictEqual(v('spinc', 'about R12 000'), 'R 12 000.00');
  assert.strictEqual(V.interpret(idx.byId.exp, 'the monthly budget is 5000 plus 950').value, 'R 5 950.00', 'an amount said as a sum is added up');
});

test('Duties split: when the boxes add up to 100%, the empty ones are set to 0; when the total moves off 100% those zeros go again', () => {
  const D = calc.DUTY_IDS, s = fresh();
  set(s, 'd_desk', '90'); assert.deepStrictEqual(D.map(id => s.f[id].v), ['90', '', '', '', '', '', ''], '90% is not 100%: nothing yet');
  set(s, 'd_trav', '10', 'heard');
  assert.deepStrictEqual(D.map(id => s.f[id].v), ['90', '0', '10', '0', '0', '0', '0']);
  assert.strictEqual(s.f.d_supo.st, 'preset'); assert.strictEqual(s.f.d_trav.st, 'heard');
  assert.strictEqual(f(s, 'd_tot'), '100%');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)).filter(w => w.id === 'd_tot'), []);
  set(s, 'd_trav', '20'); assert.deepStrictEqual(D.map(id => s.f[id].v), ['90', '', '20', '', '', '', ''], '110%: the automatic zeros are taken away');
  set(s, 'd_desk', '80'); assert.deepStrictEqual(D.map(id => [s.f[id].v, s.f[id].st].join('/')), ['80/confirmed', '0/preset', '20/confirmed', '0/preset', '0/preset', '0/preset', '0/preset']);
  set(s, 'd_trav', ''); assert.deepStrictEqual(D.map(id => s.f[id].v), ['80', '', '', '', '', '', ''], 'the 20 cleared: back to 80%, no zeros left over');
});

test('Duties split: a 0 that was typed or said is never taken away, and the duties still count as one answer in the progress', () => {
  const D = calc.DUTY_IDS, s = fresh(), info = schema.sections.find(x => x.id === 'occ');
  set(s, 'd_heavy', '0'); set(s, 'd_desk', '60'); set(s, 'd_trav', '30');
  assert.strictEqual(s.f.d_heavy.st, 'confirmed');
  set(s, 'd_trav', '40'); assert.deepStrictEqual([s.f.d_heavy.v, s.f.d_heavy.st, s.f.d_light.v, s.f.d_light.st], ['0', 'confirmed', '0', 'preset'], 'at 100% the others get 0; the one typed by hand is as it was');
  set(s, 'd_trav', '30'); assert.deepStrictEqual([s.f.d_heavy.v, s.f.d_heavy.st, s.f.d_light.v], ['0', 'confirmed', ''], 'off 100%: the automatic zeros go, the typed 0 stays');
  const filled = () => store.counts(s, info).fill;
  assert.ok(filled() >= 0);
  const reopened = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(D.map(id => reopened.f[id].v), D.map(id => s.f[id].v), 'saved and opened again, the same');
});
