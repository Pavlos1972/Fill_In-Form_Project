/* The audit's second batch: Yes/No answers that open the lists, progress that counts real answers, boxes that hide when they do not apply, the placeholder check, one bank box, preferred spend. */
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
const sec = id => schema.sections.find(x => x.id === id);
const cnt = (s, id) => store.counts(s, sec(id));
const ctx = s => store.ctxFor(s);
const shown = (s, id) => calc.showIf(schema.fieldsById[id].cond, ctx(s));
const at = (s, id) => validate.check(ctx(s)).filter(w => w.id === id);

/* ---- 7. progress ---- */
test('Debts, Children, Investments and Retirement each have a Yes/No that opens their list', () => {
  [['debts', 'has_debts', 'debts'], ['kids', 'has_kids', 'kids'], ['inv', 'has_inv', 'inv'], ['retire', 'has_ra', 'ret_ra'], ['retire', 'has_pp', 'ret_pp']].forEach(([sid, gate, list]) => {
    const f = schema.fieldsById[gate]; assert.deepStrictEqual(f.o, ['Yes', 'No'], gate);
    const b = sec(sid).blocks.find(x => x.list === list); assert.ok(b && b.cond && b.grey, list);
    const s = fresh(); assert.strictEqual(calc.showIf(b.cond, ctx(s)), true);                                    // not answered yet: the list is open
    set(s, gate, 'No'); assert.strictEqual(calc.showIf(b.cond, ctx(s)), false);
  });
});

test('a list is one answer still to give until it has a row with something in it', () => {
  const s = fresh();
  assert.deepStrictEqual([cnt(s, 'debts').tot, cnt(s, 'debts').fill], [2, 0]);                                  // the Yes/No, and the list
  set(s, 'has_debts', 'Yes'); assert.deepStrictEqual([cnt(s, 'debts').tot, cnt(s, 'debts').fill], [2, 1]);
  store.addRow(s, 'debts', {}); assert.deepStrictEqual([cnt(s, 'debts').tot, cnt(s, 'debts').fill], [2, 1]);      // an empty row is not an answer
  s.l.debts[0].d.type = 'Home loan'; assert.deepStrictEqual([cnt(s, 'debts').tot, cnt(s, 'debts').fill], [2, 2]);
  const n = fresh(); set(n, 'has_debts', 'No'); assert.deepStrictEqual([cnt(n, 'debts').tot, cnt(n, 'debts').fill], [1, 1]);   // "No": nothing more to ask
});

test('adding a row says Yes to the Has-question above it', () => {
  const s = fresh(); store.addRow(s, 'kids', { name: 'A' });
  assert.strictEqual(s.f.has_kids.v, 'Yes');
  set(s, 'has_kids', 'No'); store.addRow(s, 'kids', { name: 'B' }); assert.strictEqual(s.f.has_kids.v, 'Yes');
  const o = fresh(); store.addRow(o, 'ret_pp', { prov: 'Old Mutual' }); assert.strictEqual(o.f.has_pp.v, 'Yes'); assert.strictEqual(o.f.has_ra.v, '');
});

test('an older file with rows in a list and no Yes/No opens with the Yes', () => {
  const old = JSON.parse(store.toJSON(fresh()));
  old.l.kids = [{ d: { name: 'A' }, st: 'confirmed' }]; old.l.inv = [{ d: { type: 'Unit trust' }, st: 'confirmed' }]; delete old.f.has_kids; delete old.f.has_inv;
  const s = store.fromJSON(JSON.stringify(old));
  assert.deepStrictEqual([s.f.has_kids.v, s.f.has_inv.v, s.f.has_debts.v], ['Yes', 'Yes', '']);
});

test('the seven duties boxes are one answer, and a schedule request is not counted when there is nothing to ask for', () => {
  const s = fresh(), before = cnt(s, 'occ');
  schema.sections.find(x => x.id === 'occ').blocks.forEach(() => {});
  set(s, 'd_desk', '60'); assert.deepStrictEqual([cnt(s, 'occ').tot, cnt(s, 'occ').fill], [before.tot, before.fill]);   // 60% is not 100%
  set(s, 'd_supo', '40'); assert.strictEqual(cnt(s, 'occ').fill, before.fill + 1);
  assert.ok(before.tot < 20, 'duties counted as one: ' + before.tot);
  const c = fresh(), c0 = cnt(c, 'cover'); set(c, 'has_risk', 'No');
  assert.strictEqual(cnt(c, 'cover').tot, c0.tot - 3);                                                              // joint life, the personal policies list and its schedule request are no longer counted
});

/* ---- 8. boxes that depend on an answer ---- */
test('boxes under an answer are greyed, and not counted, until the answer opens them', () => {
  const s = fresh(), c0 = cnt(s, 'other');
  ['ma_prov', 'ma_plan', 'ma_broker'].forEach(id => assert.strictEqual(shown(s, id), true, id));              // not answered yet: asked
  set(s, 'ma', 'None'); set(s, 'gap', 'No'); set(s, 'will', 'No'); set(s, 'sti', 'No');
  ['ma_prov', 'ma_plan', 'ma_broker', 'gap_prov', 'gap_broker', 'will_up', 'will_where', 'will_broker', 'will_date', 'sti_broker', 'sti_car', 'sti_house', 'sti_struct', 'sti_personal', 'sti_biz'].forEach(id => assert.strictEqual(shown(s, id), false, id));
  assert.ok(cnt(s, 'other').tot <= c0.tot - 13, c0.tot + ' -> ' + cnt(s, 'other').tot);
  set(s, 'sti', 'Handled by spouse'); assert.strictEqual(shown(s, 'sti_car'), false);
  set(s, 'sti', 'Yes'); assert.strictEqual(shown(s, 'sti_car'), true); assert.strictEqual(shown(s, 'sti_biz'), false);       // the business row needs a business owner
  set(s, 'bizowner', 'Yes'); assert.strictEqual(shown(s, 'sti_biz'), true); assert.strictEqual(shown(s, 'sti_biz_spend'), false);
  set(s, 'sti_biz', 'Yes'); assert.strictEqual(shown(s, 'sti_biz_spend'), true);
});

test('the "Other" boxes open only for "Other"', () => {
  const s = fresh();
  assert.strictEqual(shown(s, 'nat_other'), false);                                                                // nationality starts as South African
  set(s, 'nat', 'Other'); assert.strictEqual(shown(s, 'nat_other'), true);
  set(s, 'will', 'Yes'); assert.strictEqual(shown(s, 'will_where_other'), false); set(s, 'will_where', 'Other provider'); assert.strictEqual(shown(s, 'will_where_other'), true);
  set(s, 'bizowner', 'Yes'); set(s, 'biz_struct', 'Other'); assert.strictEqual(shown(s, 'biz_struct_other'), true);
});

/* ---- 9. placeholders ---- */
test('an ACI value that is still "?" is flagged on a quote that is asked for', () => {
  const s = fresh(); assert.strictEqual(validate.check(ctx(s)).length, 0);                                         // no quote asked: the preset is fine
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'net', 'R 40 000.00');
  assert.deepStrictEqual(['lc_f_aciv', 'pd_f_aciv', 'ip_aciv', 'dd_aciv'].filter(id => at(s, id).length), ['lc_f_aciv', 'pd_f_aciv', 'ip_aciv', 'dd_aciv']);
  set(s, 'lc_f_aciv', '1.5%'); assert.strictEqual(at(s, 'lc_f_aciv').length, 0);
  assert.strictEqual(at(s, 'lc_aciv').length, 0);                                                                  // the standard boxes are for a standard quote
});

/* ---- 21. the bank ---- */
test('the debts bank list no longer has an Other choice', () => {
  const col = schema.lists.debts.cols.find(c => c.k === 'prov');
  assert.ok(col.free && !col.o.includes('Other'));
});

/* ---- 23. preferred monthly spend, and the Permanent disability figures ---- */
test('the preferred monthly spend reaches the Life summary and the action points', () => {
  const s = fresh(); set(s, 'pref_spend', 'R 3 500.00'); set(s, 'fna_req', 'Request a quote'); set(s, 'pr_life', schema.PRIORITY);
  assert.ok(A.facts(s).preferred_monthly_spend === 'R 3 500.00');
  assert.ok(A.local(s).some(p => /prefers to spend R 3 500 p\.m\./.test(p)), A.local(s).join('|'));
  const lines = S.local(s, 'life');
  assert.ok(lines.some(l => /Preferred monthly spend on life cover: R 3 500 p\.m\./.test(l)), JSON.stringify(lines));
  assert.ok(schema.panelsById.life.sum.f.includes('pref_spend'));
  const n = fresh(); set(n, 'fna_req', 'Request a quote'); assert.ok(!A.local(n).some(p => /prefers to spend/.test(p)));
});

test('Permanent disability does not repeat the household figures of the Life cover', () => {
  const ids = b => (b.fields || []).map(f => f.id);
  const calcSec = sec('calc').blocks, life = calcSec.find(b => /^Life cover/.test(b.title || '')), pd = calcSec.find(b => /^Permanent disability/.test(b.title || ''));
  assert.deepStrictEqual(ids(life).slice(0, 4), ['lc_hh', 'lc_cc', 'lc_dr', 'lc_need']);
  assert.ok(!ids(pd).some(id => /^pd_(?:hh|cc|dr|need)$/.test(id)) && /same household income needed/.test(pd.help));
});
