/* The audit's first batch of fixes: the checks panel (quotes, hidden boxes, dates, amounts, gates, priorities), the Admin points, two voice readers and the partner questions. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const util = require('../app/js/util.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const A = require('../app/js/actions.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const ctx = s => store.ctxFor(s);
const warns = s => validate.check(ctx(s));
const at = (s, id) => warns(s).filter(w => w.id === id);
const rowAt = (s, list) => warns(s).filter(w => w.list === list);
const REQ = 'Request a quote';
const idx = V.buildIndex(schema);
const say = (id, text) => V.interpret(idx.byId[id], text);

test('every box a check points at is a real box', () => {                      // a check anchored on a missing id would break the Checks panel
  const s = fresh();
  set(s, 'bf_fna_req', REQ); set(s, 'fna_req', REQ); set(s, 'bf_sf_req', REQ); set(s, 'sf_req', REQ); set(s, 'rgar_req', 'Request an RGAR'); set(s, 'egar_req', 'Request an EGAR');
  set(s, 'bizowner', 'Yes'); set(s, 'biz_partners', 'Yes'); set(s, 'bs_req', REQ); set(s, 'cl_req', REQ); set(s, 'km_req', REQ);
  set(s, 'has_risk', 'No'); set(s, 'loa', 'No'); set(s, 'ps_risk', 'Draw from Astute (with signed LOA)'); set(s, 'date', '31/02/2026'); set(s, 'next_appt', 'soon'); set(s, 'will_date', 'x');
  store.addRow(s, 'risk', { prov: 'Old Mutual' }, 'confirmed');
  warns(s).forEach(w => assert.ok(w.id ? schema.fieldsById[w.id] : schema.lists[w.list], JSON.stringify(w)));
});

test('a blank form has nothing to warn about', () => {
  assert.deepStrictEqual(warns(fresh()), []);
});

/* ---- 1. quotes: what a requested quote needs ---- */
test('a requested quote is checked for what it needs, and each warning points at the missing box', () => {
  const blank = fresh();
  ['bf_fna_req', 'fna_req', 'bf_sf_req', 'sf_req'].forEach(id => set(blank, id, REQ));
  set(blank, 'rgar_req', 'Request an RGAR'); set(blank, 'egar_req', 'Request an EGAR');
  schema.panels.forEach(P => P.dec && set(blank, P.dec, schema.PRIORITY));
  const ids = warns(blank).map(w => w.id).filter(Boolean);
  ['net', 'fna_ins', 'ret_age', 'ret_net', 'rgar_req', 'egar_req'].forEach(id => assert.ok(ids.includes(id), id));
  assert.ok(at(blank, 'bf_sf_req').length && at(blank, 'sf_req').length);                                   // Shortfall with no group policy and no schedule
  assert.match(at(blank, 'net')[0].msg, /BrightRock Fractured FNA/);

  const full = fresh();
  ['bf_fna_req', 'fna_req'].forEach(id => set(full, id, REQ));
  set(full, 'net', 'R 40 000.00'); set(full, 'fna_ins', 'Old Mutual');
  assert.strictEqual(warns(full).filter(w => ['net', 'fna_ins'].includes(w.id)).length, 0);
});

test('RA, reduced and investment quotes, Buy & Sell, Contingent liability and Keyman each need their details', () => {
  const s = fresh();
  schema.panels.forEach(P => P.dec && set(s, P.dec, schema.PRIORITY));
  store.addRow(s, 'raq', { req: REQ }, 'confirmed');
  store.addRow(s, 'bfred', { req: REQ, type: 'Servicing' }, 'confirmed');
  store.addRow(s, 'redq', { req: REQ, amt: 'R 1 000.00' }, 'confirmed');
  store.addRow(s, 'invq', { product: 'Endowment' }, 'confirmed');
  assert.deepStrictEqual(rowAt(s, 'raq').map(w => w.msg.replace(/:.*/, '')), ['RA quote', 'RA quote']);      // no amount, no insurer
  assert.ok(rowAt(s, 'bfred').some(w => /monthly amount/.test(w.msg)) && rowAt(s, 'bfred').some(w => /Servicing/.test(w.msg)));
  assert.ok(rowAt(s, 'redq').some(w => /insurer/.test(w.msg)));
  assert.ok(rowAt(s, 'invq').length === 2);
  ['bs_req', 'cl_req', 'km_req'].forEach(id => set(s, id, REQ));
  assert.strictEqual(warns(s).filter(w => ['bs_req', 'cl_lender', 'cl_bal', 'km_name', 'km_amt'].includes(w.id)).length, 0);      // the business boxes are greyed until Business owner = Yes with partners
  set(s, 'bizowner', 'Yes'); set(s, 'biz_partners', 'Yes');
  assert.deepStrictEqual(['bs_req', 'cl_lender', 'cl_bal', 'km_name', 'km_amt'].filter(id => at(s, id).length), ['bs_req', 'cl_lender', 'cl_bal', 'km_name', 'km_amt']);
  store.addRow(s, 'shares', { name: 'P' }, 'confirmed'); set(s, 'cl_lender', 'FNB'); set(s, 'km_name', 'J');
  assert.deepStrictEqual(['bs_req', 'cl_lender', 'km_name'].filter(id => at(s, id).length), []);
});

test('an EGAR needs children with dates of birth', () => {
  const s = fresh(); set(s, 'pr_egar', schema.PRIORITY); set(s, 'egar_req', 'Request an EGAR');
  assert.strictEqual(at(s, 'egar_req').length, 1);
  store.addRow(s, 'kids', { name: 'K' }, 'confirmed');
  assert.strictEqual(at(s, 'egar_req').length, 0); assert.strictEqual(rowAt(s, 'kids').length, 1);
  s.l.kids[0].d.dob = '22/08/2019'; assert.strictEqual(rowAt(s, 'kids').length, 0);
});

/* ---- 3. hidden boxes do not warn ---- */
test('a check does not speak about a box that is hidden or greyed out', () => {
  const s = fresh();
  set(s, 'marital', 'Single'); set(s, 'sp_tel', '12'); set(s, 'bizowner', 'No'); set(s, 'biz_pct', '150');
  store.addRow(s, 'shares', { name: 'X', id: '123' }, 'confirmed');
  assert.deepStrictEqual(warns(s), []);
  set(s, 'marital', 'Married in community of property'); assert.strictEqual(at(s, 'sp_tel').length, 1);
  set(s, 'bizowner', 'Yes'); assert.ok(at(s, 'biz_pct').length >= 1);                                  // back on show: the shareholding checks speak again
});

/* ---- 4. negative household income needed ---- */
test('household income needed below nothing is warned about', () => {
  const s = fresh(); set(s, 'net', 'R 40 000.00');
  store.addRow(s, 'kids', { name: 'A', cost: 'R 20 000.00' }, 'confirmed'); store.addRow(s, 'debts', { type: 'Home loan', inst: 'R 45 000.00' }, 'confirmed');
  const w = at(s, 'lc_need'); assert.strictEqual(w.length, 1); assert.match(w[0].msg, /-R 25 000\.00/);
  s.l.debts[0].d.inst = 'R 5 000.00'; assert.strictEqual(at(s, 'lc_need').length, 0);
});

/* ---- 5. dates, home number, gender and ID ---- */
test('Date completed, next appointment, will date and dates of birth are read and compared', () => {
  const s = fresh();
  set(s, 'date', '31/02/2026'); assert.match(at(s, 'date')[0].msg, /today's date is used/);
  set(s, 'date', '29/10/2026'); assert.strictEqual(at(s, 'date').length, 0);
  set(s, 'next_appt', 'soon'); assert.strictEqual(at(s, 'next_appt').length, 1);
  set(s, 'next_appt', '01/10/2026'); assert.match(at(s, 'next_appt')[0].msg, /before the date of the form/);
  set(s, 'next_appt', '05/11/2026'); assert.strictEqual(at(s, 'next_appt').length, 0);
  set(s, 'will_date', 'long ago'); assert.strictEqual(at(s, 'will_date').length, 1);
  set(s, 'will_date', '2019'); assert.strictEqual(at(s, 'will_date').length, 0);
  set(s, 'will_date', '2031'); assert.strictEqual(at(s, 'will_date').length, 1);
  set(s, 'dob', '01/01/2030'); assert.match(at(s, 'dob')[0].msg, /after the date of the form/);
  set(s, 'dob', '01/01/1980'); assert.strictEqual(at(s, 'dob').length, 0);
  store.addRow(s, 'kids', { name: 'K', dob: '01/01/2030' }, 'confirmed'); assert.match(rowAt(s, 'kids')[0].msg, /after the date of the form/);
});

test('the home number is checked like the other phone numbers', () => {
  const s = fresh(); set(s, 'home', '123'); assert.strictEqual(at(s, 'home').length, 1);
  set(s, 'home', '011 555 0148'); assert.strictEqual(at(s, 'home').length, 0);
});

test('the gender is compared with the sex in a valid ID number', () => {
  const s = fresh(); set(s, 'idno', '7212095268086');                                    // 5268: male
  set(s, 'gender', 'Female'); assert.match(at(s, 'gender')[0].msg, /for a male/);
  set(s, 'gender', 'Male'); assert.strictEqual(at(s, 'gender').length, 0);
  set(s, 'gender', 'Female'); set(s, 'idtype', 'Passport'); assert.strictEqual(at(s, 'gender').length, 0);
});

/* ---- 6. a Yes/No answer against the data under it ---- */
test('an answer that switches boxes off is warned about while what is under it is still filled in', () => {
  const s = fresh(); set(s, 'has_risk', 'No'); store.addRow(s, 'risk', { prov: 'Old Mutual' }, 'confirmed');
  assert.match(at(s, 'has_risk')[0].msg, /1 row in the list/);
  s.l.risk.length = 0; assert.strictEqual(at(s, 'has_risk').length, 0);
  set(s, 'ma', 'None'); set(s, 'ma_prov', 'Discovery Health'); assert.match(at(s, 'ma')[0].msg, /Medical aid provider/);
  set(s, 'bizowner', 'Yes'); set(s, 'biz_assur', 'No'); store.addRow(s, 'bizpol', { prov: 'Old Mutual' }, 'confirmed'); assert.strictEqual(at(s, 'biz_assur').length, 1);
});

test('Draw from Astute with an LOA that is No or Not now is a check as well as an action point', () => {
  const s = fresh(); set(s, 'ps_risk', 'Draw from Astute (with signed LOA)');
  assert.strictEqual(at(s, 'loa').length, 0);
  set(s, 'loa', 'No'); assert.strictEqual(at(s, 'loa').length, 1);
  set(s, 'loa', 'Not now'); assert.strictEqual(at(s, 'loa').length, 1);
  set(s, 'loa', 'Yes'); assert.strictEqual(at(s, 'loa').length, 0);
});

/* ---- 11. Not a priority, and a priority with nothing to do ---- */
test('credit life is not chased for a Life area that is not a priority', () => {
  const s = fresh(); store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', inst: 'R 5 000.00' }, 'confirmed');
  assert.strictEqual(A.facts(s).credit_life.length, 1);
  set(s, 'pr_life', schema.NOT_PRIORITY); assert.strictEqual(A.facts(s).credit_life.length, 0);
  assert.ok(!A.local(s).some(p => /credit life/.test(p)));
});

test('an area marked as a priority with nothing asked for and nothing written is warned about', () => {
  const s = fresh(); set(s, 'pr_ra', schema.PRIORITY);
  assert.strictEqual(at(s, 'pr_ra').length, 1);
  set(s, 'pr_ra_cm', 'Increase the contribution'); assert.strictEqual(at(s, 'pr_ra').length, 0);
  set(s, 'pr_ra_cm', ''); store.addRow(s, 'raq', { req: REQ, ins: 'Old Mutual', monthly: 'R 2 000.00' }, 'confirmed'); assert.strictEqual(at(s, 'pr_ra').length, 0);
  set(s, 'pr_med', schema.PRIORITY); assert.strictEqual(at(s, 'pr_med').length, 1);
  set(s, 'ref_med', 'Valerie to contact for medical aid'); assert.strictEqual(at(s, 'pr_med').length, 0);
  set(s, 'pr_life', schema.NOT_PRIORITY); assert.strictEqual(at(s, 'pr_life').length, 0);
});

/* ---- 12, 13. voice ---- */
test('nationality: a thank you, an okay or an "I don\'t know" is not a nationality', () => {
  ['okay', 'Okay, thank you', 'thank you', 'hello', "I don't know", 'not sure', 'um okay'].forEach(t => assert.ok(!say('nat', t) || !(say('nat', t).value === 'Other'), t));
  const z = say('nat', "I'm Zimbabwean"); assert.strictEqual(z.value, 'Other'); assert.strictEqual(z.extra[0].value, 'Zimbabwean');
  assert.strictEqual(say('nat', 'Greek').value, 'Other');
  assert.strictEqual(say('nat', "I'm South African").value, 'South African');
});

test('a bare "yes please" or "no" answers a quote Request box', () => {
  ['bf_fna_req', 'fna_req', 'bf_sf_req', 'sf_req', 'rgar_req', 'egar_req', 'bs_req'].forEach(id => {
    const yes = say(id, 'yes please'), no = say(id, 'no');
    assert.match(yes && yes.value, /^Request an? /, id); assert.strictEqual(no && no.value, 'Not required', id);
  });
  assert.strictEqual(say('fna_req', 'No FNA done').value, 'No FNA done');                          // the words of another choice still win
  assert.strictEqual(say('fna_req', 'yes, a new business quote') && say('fna_req', 'yes, a new business quote').value === 'Not required', false);
});

/* ---- 14. amounts ---- */
test('an amount typed with dots between the thousands and a comma for the cents is read right', () => {
  assert.strictEqual(util.num('R1.000,00'), 1000); assert.strictEqual(util.num('R 12.500,50'), 12500.5); assert.strictEqual(util.num('1.000.000'), 1000000);
  assert.strictEqual(util.num('1 000,50'), 1000.5); assert.strictEqual(util.num('R 1,000.50'), 1000.5); assert.strictEqual(util.num('R 32 138,50'), 32138.5); assert.strictEqual(util.num('1.5'), 1.5);
  assert.strictEqual(util.formatMoney('R1.000,00'), 'R 1 000.00');
});

test('words and negative amounts in an amount box are warned about', () => {
  const s = fresh(); set(s, 'gross', 'lots'); assert.strictEqual(at(s, 'gross').length, 1);
  set(s, 'gross', 'R -500.00'); assert.match(at(s, 'gross')[0].msg, /less than nothing/);
  set(s, 'gross', 'R 50 000.00'); assert.strictEqual(at(s, 'gross').length, 0);
  store.addRow(s, 'debts', { type: 'Home loan', bal: 'a lot' }, 'confirmed'); assert.match(rowAt(s, 'debts')[0].msg, /Balance \(R\): this is not an amount/);
});

/* ---- 17. questions that need a partner ---- */
test('Joint life with spouse and Buy & Sell are asked only when there is a spouse or business partners', () => {
  const s = fresh(); set(s, 'has_risk', 'Yes');
  const joint = () => calc.showIf(schema.fieldsById.joint.cond, ctx(s));
  assert.strictEqual(joint(), true);                                                                // marital status not asked yet
  set(s, 'marital', 'Single'); assert.strictEqual(joint(), false);
  set(s, 'marital', 'Divorced'); assert.strictEqual(joint(), false);
  set(s, 'marital', 'Civil union'); assert.strictEqual(joint(), true);
  const bs = schema.sections.find(x => x.id === 'prio').blocks.find(b => b.title === 'Buy & Sell');
  set(s, 'bizowner', 'Yes'); assert.strictEqual(calc.showIf(bs.cond, ctx(s)), false);
  set(s, 'biz_partners', 'Yes'); assert.strictEqual(calc.showIf(bs.cond, ctx(s)), true);
});
