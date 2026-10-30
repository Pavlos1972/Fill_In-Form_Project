/* The audit's third batch (the parts decided with the adviser): only the debts the client pays come off the take-home income, the take-home is labelled and checked, the RGAR totals, and one request vocabulary for every quote list. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const S = require('../app/js/summary.js');
const A = require('../app/js/actions.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const ctx = s => store.ctxFor(s);
const at = (s, id) => validate.check(ctx(s)).filter(w => w.id === id);
const REQ = 'Request a quote';

/* ---- #2: who pays the debt ---- */
test('only the debts the client pays come off the take-home income', () => {
  const s = fresh(); set(s, 'net', 'R 60 000.00');
  [['Home loan', 'Client', 10000], ['Vehicle finance', '', 5000], ['Credit card', 'Spouse', 2000], ['Personal loan', 'Joint', 3000], ['Revolving credit', 'Business', 4000], ['Other', 'Ex-Spouse/Partner', 1000]]
    .forEach(([type, payer, inst]) => store.addRow(s, 'debts', { type, payer, inst: 'R ' + inst + '.00', desc: 'x' }));
  assert.strictEqual(calc.field('dr', ctx(s)), 'R 15 000.00');                                                  // Client and not set
  assert.strictEqual(calc.field('need', ctx(s)), 'R 45 000.00');
  const sp = calc.ipSplit(ctx(s));
  assert.deepStrictEqual(sp.rows.map(r => r.inst), [10000, 5000]);
  assert.deepStrictEqual([sp.total, sp.all, sp.count, sp.elsewhere, sp.elsewhereTotal, sp.rest], [15000, 15000, 2, 4, 10000, 45000]);
  assert.strictEqual(calc.field('ip_hh', ctx(s)), 'R 45 000.00');
  s.l.debts[3].d.payer = 'Client';                                                                                // a joint loan the client pays alone
  assert.strictEqual(calc.field('dr', ctx(s)), 'R 18 000.00');
});

test('a debt that is paid by someone else is not a protector line, and the over-insured warning ignores it', () => {
  const s = fresh(); set(s, 'net', 'R 10 000.00');
  store.addRow(s, 'debts', { type: 'Home loan', payer: 'Spouse', inst: 'R 30 000.00' });
  assert.strictEqual(calc.ipSplit(ctx(s)).over, false);
  assert.strictEqual(at(s, 'ip_hh').length, 0); assert.strictEqual(at(s, 'lc_need').length, 0);
  store.addRow(s, 'debts', { type: 'Home loan', payer: 'Client', inst: 'R 12 000.00' });
  assert.strictEqual(calc.ipSplit(ctx(s)).over, true); assert.strictEqual(at(s, 'ip_hh').length, 1);
});

test('the calculation says the repayments are the ones the client pays, and the Debts page says why', () => {
  assert.match(schema.fieldsById.lc_dr.l, /paid by the client/);
  const b = schema.sections.find(x => x.id === 'debts').blocks.find(x => x.list === 'debts');
  assert.match(b.help, /Payer: Client, or not set/);
});

/* ---- #22: the take-home income ---- */
test('the calculation page calls it the client\'s take-home income, and a typed take-home far from the Direct Net Income is flagged', () => {
  assert.strictEqual(schema.fieldsById.lc_hh.l, 'Client take-home income (R)');
  const s = fresh(); set(s, 'gross', 'R 50 000.00');
  const dn = calc.field('dnet', ctx(s)); assert.ok(dn);
  set(s, 'net', dn); assert.strictEqual(at(s, 'net').length, 0);
  set(s, 'net', 'R 10 000.00'); assert.match(at(s, 'net')[0].msg, /more than 20% away from the Direct Net Income/);
  set(s, 'net', 'R 62 000.00'); assert.match(at(s, 'net').map(w => w.msg).join('|'), /higher than gross/);           // that one is its own warning
  assert.strictEqual(at(fresh(), 'net').length, 0);
});

/* ---- #24: the RGAR ---- */
test('the RGAR total includes a living annuity held under Investments, and a retirement annuity can be current or paid-up', () => {
  const s = fresh(); set(s, 'pr_rgar', schema.PRIORITY);
  store.addRow(s, 'ret_ra', { prov: 'Allan Gray', status: 'Paid-up', val: 'R 1 000 000.00' }); store.addRow(s, 'ret_pp', { type: 'Pension fund', val: 'R 500 000.00' });
  store.addRow(s, 'inv', { type: 'Living annuity', val: 'R 2 000 000.00' }); store.addRow(s, 'inv', { type: 'Unit trust', val: 'R 700 000.00' });
  const d = S.areaData(s, 'rgar'); assert.deepStrictEqual(Object.values(d.totals)[0], 'R 3 500 000');                    // the unit trust is not retirement money
  assert.ok(Object.keys(d.totals)[0].includes('living annuities'));
  assert.deepStrictEqual(schema.lists.ret_ra.cols.find(c => c.k === 'status').o, ['Current', 'Paid-up']);
  assert.match(schema.fieldsById.ret_net.l, /R p\.m\./);
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.l.ret_ra[0].d.status, 'Paid-up');
});

/* ---- #20: one request vocabulary ---- */
test('every quote list has the same four answers, and the investment quotes have a Request column', () => {
  const four = ['Request a quote', 'Not required', 'Cannot afford now', 'Not interested'];
  ['bfred', 'redq', 'raq', 'invq'].forEach(k => assert.deepStrictEqual(schema.lists[k].cols.find(c => c.k === 'req').o, four, k));
  assert.strictEqual(schema.lists.invq.cols[0].k, 'req');
});

test('an investment quote is asked for when its Request says so; a new row, and a row in an older file, start as a request', () => {
  const s = fresh(); set(s, 'pr_inv', schema.PRIORITY);
  store.addRow(s, 'invq', { product: 'Endowment', ins: 'Old Mutual', monthly: 'R 2 000.00' });
  assert.strictEqual(s.l.invq[0].d.req, REQ); assert.strictEqual(A.facts(s).quotes.filter(q => q.quote === 'Investment quote').length, 1);
  s.l.invq[0].d.req = 'Not interested'; assert.strictEqual(A.facts(s).quotes.filter(q => q.quote === 'Investment quote').length, 0);
  assert.ok(!S.local(s, 'inv').some(l => /Quote asked for/.test(l)));
  const old = JSON.parse(store.toJSON(fresh()));
  old.l.invq = [{ d: { product: 'Tax-free savings', monthly: 'R 1 000.00' }, st: 'confirmed' }, { d: {}, st: 'confirmed' }];
  const o = store.fromJSON(JSON.stringify(old)); assert.deepStrictEqual(o.l.invq.map(r => r.d.req), [REQ, '']);
});
