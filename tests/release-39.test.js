/* Release 3.9: the BrightRock Risk Calculation follows the client's BrightRock policy (its one ACI, the Yearly premium increase; Dread at R 500 000 or the policy's cover that can be recovered from, whichever is more),
   a percentage typed alone gets its %, and a client with no debts has R 0.00 for the debt repayments, with a note. Invented client. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const util = require('../app/js/util.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const v = (s, id) => s.f[id].v;
const ACI4 = ['lc_f_aciv', 'pd_f_aciv', 'ip_aciv', 'dd_aciv'];
const withBR = (s, prov) => store.addRow(s, 'risk', { prov: prov || 'BrightRock', spend: 'R 1 607.60' });

test('the new boxes of 3.9 are br_aci and br_dd_cover, and the form is at least 3.9', () => {
  assert.ok(parseFloat(schema.version) >= 3.9);
  assert.ok(schema.fieldsById.br_aci && schema.fieldsById.br_dd_cover);
  assert.ok(!schema.fieldsById.br_lc_aciv, 'one figure for the whole policy, not one per benefit');
  assert.match(schema.fieldsById.br_aci.l, /Yearly premium increase/, 'the ACI is BrightRock\'s Yearly premium increase; its Yearly base increase is the ABI and is not asked for');
  assert.ok(!JSON.stringify(schema.sections).includes('base increase'));
});

/* ---------- percentages ---------- */
test('a number typed alone in a percentage box gets its %', () => {
  assert.strictEqual(util.formatPct('5'), '5%'); assert.strictEqual(util.formatPct(' 7,5 '), '7.5%'); assert.strictEqual(util.formatPct('5 %'), '5%'); assert.strictEqual(util.formatPct('5%'), '5%');
  assert.strictEqual(util.formatPct('12.25'), '12.25%'); assert.strictEqual(util.formatPct('?'), '?', 'formatPct itself leaves it; the box turns a "?" into empty'); assert.strictEqual(util.formatPct('CPI'), 'CPI'); assert.strictEqual(util.formatPct(''), '');
  assert.strictEqual(util.formatPct('five'), 'five'); assert.strictEqual(util.formatPct('1000'), '1000', 'not a percentage');
});
test('every ACI value and ABI box of the BrightRock page, and of the standard quotes, takes the %', () => {
  ['lc_f_aciv', 'lc_wol', 'lc_ccabi', 'pd_f_aciv', 'pd_hhabi', 'pd_ccabi', 'ip_aciv', 'ip_abiv', 'dd_aciv', 'dd_abiv', 'lc_aciv', 'lc_abiv', 'pd_aciv', 'pd_abiv', 'ips_aciv', 'ips_abiv', 'dds_aciv', 'dds_abiv', 'br_aci']
    .forEach(id => assert.ok(schema.fieldsById[id].pct, id + ' takes the %'));
  const s = fresh(); set(s, 'lc_f_aciv', '5'); set(s, 'dd_abiv', '4.5'); set(s, 'ip_abiv', 'to be agreed');
  assert.deepStrictEqual([v(s, 'lc_f_aciv'), v(s, 'dd_abiv'), v(s, 'ip_abiv')], ['5%', '4.5%', 'to be agreed']);
});

/* ---------- no debts ---------- */
test('Has debts answered No: the debt repayments are R 0.00 with a note; not answered: empty; with debts: the sum', () => {
  const s = fresh(), ctx = store.ctxFor(s);
  assert.strictEqual(calc.field('dr', ctx), '', 'not answered yet: nobody knows');
  assert.strictEqual(calc.fieldNote('dr', ctx), '');
  set(s, 'has_debts', 'No'); set(s, 'net', 'R 42 538.00');
  assert.strictEqual(calc.field('dr', store.ctxFor(s)), 'R 0.00'); assert.strictEqual(calc.fieldNote('dr', store.ctxFor(s)), 'Client has no debts');
  assert.strictEqual(calc.field('need', store.ctxFor(s)), 'R 42 538.00', 'the household income needed is unchanged');
  set(s, 'has_debts', 'Yes'); store.addRow(s, 'debts', { type: 'Home loan', prov: 'ABSA', inst: 'R 8 000.00' });
  assert.strictEqual(calc.field('dr', store.ctxFor(s)), 'R 8 000.00'); assert.strictEqual(calc.fieldNote('dr', store.ctxFor(s)), '');
  assert.ok(schema.fieldsById.lc_dr.calcNote === 'dr' && schema.fieldsById.pd_dr.calcNote === 'dr', 'both the Life cover and the Lump Sum Disability boxes');
});

/* ---------- the policy in force ---------- */
test('no BrightRock policy: the four ACI values stay empty (there is no "?" any more) and Dread is R 500 000.00', () => {
  const s = fresh();
  ACI4.forEach(id => assert.deepStrictEqual(s.f[id], { v: '', st: 'empty' }));
  assert.deepStrictEqual(s.f.dd_cover, { v: 'R 500 000.00', st: 'preset' });
  store.addRow(s, 'risk', { prov: 'Discovery' }); set(s, 'br_aci', '3%');
  ACI4.forEach(id => assert.strictEqual(v(s, id), '', 'a policy with another insurer sets nothing'));
});
test('a BrightRock policy with its Yearly premium increase: all four ACI values follow it, as defaults; the ABI is never touched', () => {
  const s = fresh(); withBR(s); set(s, 'br_aci', '3');
  assert.strictEqual(v(s, 'br_aci'), '3%');
  ACI4.forEach(id => assert.deepStrictEqual(s.f[id], { v: '3%', st: 'preset' }, id));
  assert.deepStrictEqual(['lc_wol', 'lc_ccabi', 'pd_hhabi', 'pd_ccabi', 'ip_abiv', 'dd_abiv'].map(id => v(s, id)), ['3%', '5%', '5%', '5%', '5%', '3%'], 'the ABI boxes keep their starting values');
  set(s, 'br_aci', '3.5%'); ACI4.forEach(id => assert.strictEqual(v(s, id), '3.5%', 'a changed policy figure follows'));
});
test('an older file with the "?" default opens with the ACI values filled from the policy, or empty', () => {
  const s = fresh(); const old = JSON.parse(store.toJSON(s)); ACI4.concat(['lc_aciv', 'pd_aciv', 'ips_aciv', 'dds_aciv']).forEach(id => { old.f[id] = { v: '?', st: id.includes('s_') || id === 'ips_aciv' || id === 'dds_aciv' ? 'preset' : 'confirmed' }; });
  const back = store.fromJSON(JSON.stringify(old));
  ACI4.concat(['lc_aciv', 'pd_aciv', 'ips_aciv', 'dds_aciv']).forEach(id => assert.strictEqual(back.f[id].v, '', id + ' opens empty'));
});
test('the policy is found whatever the case and spacing; a BrightRock row in a file that is opened is followed too', () => {
  ['BrightRock', 'Brightrock', 'Bright Rock', 'BRIGHTROCK'].forEach(p => { const s = fresh(); withBR(s, p); set(s, 'br_aci', '4'); assert.strictEqual(v(s, 'lc_f_aciv'), '4%', p); });
  const s = fresh(); withBR(s); set(s, 'br_aci', '3%');
  const back = store.fromJSON(store.toJSON(s));
  ACI4.forEach(id => assert.deepStrictEqual(back.f[id], { v: '3%', st: 'preset' }));
  const old = JSON.parse(store.toJSON(s)); ACI4.forEach(id => { old.f[id] = { v: '?', st: 'preset' }; });        // a file saved before the rule: the defaults are brought up to date when it opens
  ACI4.forEach(id => assert.strictEqual(store.fromJSON(JSON.stringify(old)).f[id].v, '3%'));
});
test('taking the policy away, or its figure, empties the boxes the policy had set; a value entered in a quote box stays', () => {
  const s = fresh(); withBR(s); set(s, 'br_aci', '3');
  set(s, 'br_aci', ''); assert.deepStrictEqual(ACI4.map(id => v(s, id)), ['', '', '', ''], 'the policy figure taken away: empty again');
  set(s, 'br_aci', '3'); assert.strictEqual(v(s, 'lc_f_aciv'), '3%');
  store.delRow(s, 'risk', 0); assert.deepStrictEqual(ACI4.map(id => v(s, id)), ['', '', '', ''], 'the policy removed: empty again');
  const t = fresh(); withBR(t); set(t, 'ip_aciv', '6'); store.delRow(t, 'risk', 0);
  ACI4.forEach(id => assert.strictEqual(v(t, id), '6%', 'a value entered by hand is not taken away with the policy'));
});

/* ---------- one ACI for every benefit (4.0) ---------- */
test('an ACI entered in any one of the four boxes is put in all the others', () => {
  ACI4.forEach(src => {
    const s = fresh(); set(s, src, '9');
    ACI4.forEach(id => assert.strictEqual(v(s, id), '9%', src + ' spreads to ' + id));
    assert.strictEqual(s.f[src].st, 'confirmed'); ACI4.forEach(id => assert.strictEqual(s.f[id].st, 'confirmed', 'typed stays typed: ' + id));
  });
  const h = fresh(); set(h, 'pd_f_aciv', '7%', 'heard'); ACI4.forEach(id => assert.deepStrictEqual(h.f[id], { v: '7%', st: 'heard' }, 'said stays said: ' + id));
});
test('the next value entered replaces the last one everywhere, over what was typed in the other boxes', () => {
  const s = fresh(); set(s, 'lc_f_aciv', '5'); set(s, 'dd_aciv', '8'); ACI4.forEach(id => assert.strictEqual(v(s, id), '8%'));
  set(s, 'ip_aciv', '10%'); ACI4.forEach(id => assert.strictEqual(v(s, id), '10%'));
});
test('an empty box spreads nothing, and a "?" typed is an empty box; the ABI, the ACI choice and the standard quotes are not part of it', () => {
  const s = fresh(); set(s, 'lc_f_aciv', '5'); set(s, 'lc_f_aciv', ''); ACI4.slice(1).forEach(id => assert.strictEqual(v(s, id), '5%', 'emptying one box leaves the others'));
  const q = fresh(); set(q, 'lc_f_aciv', '?'); ACI4.forEach(id => assert.strictEqual(v(q, id), '', 'a "?" is an empty box (4.0)'));
  const r = fresh(); set(r, 'lc_f_aciv', '5'); set(r, 'lc_f_aci', 'CPI');
  assert.deepStrictEqual(['lc_wol', 'lc_ccabi', 'pd_hhabi', 'pd_ccabi', 'ip_abiv', 'dd_abiv'].map(id => v(r, id)), ['3%', '5%', '5%', '5%', '5%', '3%'], 'the ABI boxes keep their own values');
  assert.deepStrictEqual(['pd_f_aci', 'ip_aci', 'dd_aci'].map(id => v(r, id)), ['Fixed', 'Fixed', 'Fixed'], 'the ACI choice is not spread');
  ['lc_aciv', 'pd_aciv', 'ips_aciv', 'dds_aciv'].forEach(id => assert.notStrictEqual(v(r, id), '5%', id + ' (a standard quote) is not part of it'));
});
test('with a BrightRock policy the policy\'s ACI is part of it too; with none it is not touched', () => {
  const s = fresh(); withBR(s); set(s, 'br_aci', '10'); set(s, 'dd_aciv', '8');
  assert.strictEqual(v(s, 'br_aci'), '8%'); ACI4.forEach(id => assert.strictEqual(v(s, id), '8%'));
  set(s, 'br_aci', '3'); ACI4.forEach(id => assert.deepStrictEqual(s.f[id], { v: '3%', st: 'preset' }, 'the policy figure entered: every quote box follows it, even one typed before'));
  const n = fresh(); set(n, 'lc_f_aciv', '5'); assert.strictEqual(v(n, 'br_aci'), '', 'no BrightRock policy: the policy box is left empty');
});

test('Dread: the greater of R 500 000.00 and the cover that can be recovered from on the policy', () => {
  const s = fresh(); assert.strictEqual(v(s, 'dd_cover'), 'R 500 000.00', 'no BrightRock policy');
  withBR(s); assert.strictEqual(v(s, 'dd_cover'), 'R 500 000.00', 'a policy with nothing recorded to recover from');
  [['R 0.00', 'R 500 000.00'], ['R 250 000.00', 'R 500 000.00'], ['R 500 000.00', 'R 500 000.00'], ['R 750 000', 'R 750 000.00'], ['1200000', 'R 1 200 000.00'], ['rubbish', 'R 500 000.00']].forEach(([typed, want]) => {
    set(s, 'br_dd_cover', typed); assert.strictEqual(v(s, 'dd_cover'), want, typed + ' gives ' + want); assert.strictEqual(s.f.dd_cover.st, 'preset');
  });
  set(s, 'br_dd_cover', 'R 750 000.00'); set(s, 'dd_cover', 'R 600 000.00'); set(s, 'br_dd_cover', 'R 900 000.00');
  assert.strictEqual(v(s, 'dd_cover'), 'R 600 000.00', 'a cover typed over the default is left alone');
  const t = fresh(); withBR(t); set(t, 'br_dd_cover', 'R 750 000.00'); store.delRow(t, 'risk', 0); assert.strictEqual(v(t, 'dd_cover'), 'R 500 000.00', 'no policy any more');
  const std = fresh(); withBR(std); set(std, 'br_dd_cover', 'R 750 000.00'); assert.strictEqual(v(std, 'dds_cover'), 'R 0.00', 'the standard quote is not changed');
});
test('the block for the policy shows only when a BrightRock policy is listed', () => {
  const b = schema.fieldsById.br_aci && schema.sections.find(x => x.id === 'calc').blocks.find(x => x.title === 'Current BrightRock policy (from the policy schedule)');
  assert.ok(b && b.cond && b.cond.rowHas);
  const s = fresh(); assert.strictEqual(calc.showIf(b.cond, store.ctxFor(s)), false);
  store.addRow(s, 'risk', { prov: 'Old Mutual' }); assert.strictEqual(calc.showIf(b.cond, store.ctxFor(s)), false);
  withBR(s, 'BrightRock'); assert.strictEqual(calc.showIf(b.cond, store.ctxFor(s)), true);
});
