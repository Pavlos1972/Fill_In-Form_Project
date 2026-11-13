/* Release 3.6: the faults of the 13 November meeting (Edwin Joubert) and of the audit that followed, each pinned by a test.
   Money and dates, the debt payer split, credit life, action points, the Priorities box, and the voice behaviour. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');
const util = require('../app/js/util.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const ctx = s => store.ctxFor(s);

test('the version is 3.6', () => { assert.strictEqual(schema.version, '3.6'); });

/* ---------- money and dates ---------- */
test('number words with "and a half" and ranges: read right, or not read at all', () => {
  assert.strictEqual(V.wordsToNumber('six and a half thousand'), 6500);
  assert.strictEqual(V.wordsToNumber('two and a half thousand'), 2500);
  assert.strictEqual(V.wordsToNumber('eighty five thousand'), 85000);
  assert.strictEqual(V.wordsToNumber('between forty and fifty thousand'), null, 'a range is not one amount');
  assert.strictEqual(V.wordsToNumber('30 to 35 thousand'), null);
  assert.strictEqual(V.wordsToNumber('five or six thousand'), null);
});

test('"6.500" in an amount box is six thousand five hundred, not 6.50', () => {
  assert.strictEqual(util.formatMoney('6.500'), 'R 6 500.00');
  assert.strictEqual(util.formatMoney('R 12.250'), 'R 12 250.00');
  assert.strictEqual(util.formatMoney('1.000.000'), 'R 1 000 000.00');
  assert.strictEqual(util.formatMoney('6500.50'), 'R 6 500.50');
  assert.strictEqual(util.formatMoney('0.500'), 'R 0.50', 'a leading zero is a decimal');
  const s = fresh(); s.f.net.v = '6.500';
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.f.net.v, 'R 6 500.00');
});

test('words in an amount box are never counted as R 0: the figure that depends on them stays blank', () => {
  const s = fresh(); set(s, 'net', 'R 30 000.00'); set(s, 'exp', 'about twenty five thousand');
  assert.strictEqual(calc.field('disp', ctx(s)), '', 'no disposable income from words');
  set(s, 'exp', 'R 25 000.00');
  assert.strictEqual(calc.field('disp', ctx(s)), 'R 5 000.00');
  assert.ok(util.isAmount('') && util.isAmount('R 1 000.00') && !util.isAmount('about 5'));
});

test('two-digit years are read; an ID that would be born in the future is a 1900s one', () => {
  assert.deepStrictEqual(util.parseDate('04.11.26'), { y: 2026, m: 11, d: 4 });
  assert.deepStrictEqual(util.parseDate('01/02/62'), { y: 1962, m: 2, d: 1 });
  assert.deepStrictEqual(util.dobFromSaId('9901015009087'), { y: 1999, m: 1, d: 1 });
  assert.strictEqual(util.dobFromSaId('2612315009087').y, 1926, '31 December 2026 has not happened yet');
  const s = fresh(); set(s, 'date', '04.11.26');
  assert.ok(/ - 04\.11\.26 - /.test(store.pdfFileName(s)), 'the PDF is named for the form date: ' + store.pdfFileName(s));
});

test('the SARS age rebate goes by the age on the last day of the tax year, not the day of the meeting', () => {
  const s = fresh(); set(s, 'date', '13/11/2026'); set(s, 'gross', 'R 40 000.00'); set(s, 'dob', '01/02/1962');       // 65 on 1 Feb 2027, before the year ends
  const turning = util.num(calc.field('dnet', ctx(s)));
  set(s, 'dob', '01/02/1970');
  const younger = util.num(calc.field('dnet', ctx(s)));
  assert.ok(turning > younger + 700, 'the secondary rebate applies: ' + turning + ' against ' + younger);
});

test('a future child birth date has no education stage; a debt provider "Other" typed since 3.6 stays', () => {
  const s = fresh(); set(s, 'date', '13/11/2026'); store.addRow(s, 'kids', { dob: '20/12/2026' });
  assert.strictEqual(calc.rowCalc('stage', s.l.kids[0], ctx(s)), '');
  const t = fresh(); store.addRow(t, 'debts', { type: 'Other', prov: 'Other' });
  assert.strictEqual(store.fromJSON(store.toJSON(t)).l.debts[0].d.prov, 'Other');
});

/* ---------- the debt payer ---------- */
test('credit life has Yes, No and Not sure', () => {
  assert.deepStrictEqual(schema.lists.debts.cols.find(c => c.k === 'cl').o, ['Yes', 'No', 'Not sure']);
});

test('a joint debt: the instalment is split 50/50 into the two boxes, and only the client\'s half is the client\'s monthly', () => {
  const s = fresh(); set(s, 'net', 'R 30 000.00');
  const r = store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', payer: 'Client' });
  store.setCell(s, 'debts', 0, 'inst', 'R 6 500.00');
  store.setCell(s, 'debts', 0, 'payer', 'Joint');
  assert.deepStrictEqual([r.d.inst, r.d.sinst], ['R 3 250.00', 'R 3 250.00']);
  assert.strictEqual(calc.field('dr', ctx(s)), 'R 3 250.00');
  store.setCell(s, 'debts', 0, 'inst', 'R 7 000.00');                                                  // said again over the automatic split: the new whole instalment
  assert.deepStrictEqual([r.d.inst, r.d.sinst], ['R 3 500.00', 'R 3 500.00']);
  store.setCell(s, 'debts', 0, 'sinst', 'R 2 000.00');                                                 // a split typed by hand is left alone
  store.setCell(s, 'debts', 0, 'inst', 'R 4 000.00');
  assert.deepStrictEqual([r.d.inst, r.d.sinst], ['R 4 000.00', 'R 2 000.00']);
  store.setCell(s, 'debts', 0, 'payer', 'Client');                                                     // paid by the client alone after all: the spouse's part comes back
  assert.deepStrictEqual([r.d.inst, r.d.sinst], ['R 6 000.00', '']);
});

test('a spouse who pays outright: the instalment is the spouse\'s and the client\'s monthly does not carry it', () => {
  const s = fresh(); set(s, 'net', 'R 30 000.00');
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'ABSA', payer: 'Spouse', inst: 'R 9 000.00', bal: 'R 800 000.00' });
  const r = s.l.debts[0];
  assert.deepStrictEqual([r.d.inst, r.d.sinst], ['', 'R 9 000.00']);
  assert.strictEqual(calc.field('dr', ctx(s)), 'R 0.00');
  assert.strictEqual(calc.ipSplit(ctx(s)).rows.length, 0);
  assert.strictEqual(calc.ipSplit(ctx(s)).elsewhereTotal, 9000);
  assert.ok(calc.colShown(schema.lists.debts.cols.find(c => c.k === 'sinst'), r));
  assert.ok(!calc.colShown(schema.lists.debts.cols.find(c => c.k === 'sinst'), { d: { payer: 'Client' } }));
});

test('a file saved before 3.6 with a joint or spouse debt opens split the same way', () => {
  const s = fresh(); store.addRow(s, 'debts', { type: 'Home loan', payer: 'Client', inst: 'R 8 000.00' });
  store.addRow(s, 'debts', { type: 'Vehicle finance', payer: 'Client', inst: 'R 5 000.00' });
  const j = JSON.parse(store.toJSON(s)); j.schema = '3.5';
  j.l.debts[0].d.payer = 'Joint'; j.l.debts[1].d.payer = 'Spouse';
  const o = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual([o.l.debts[0].d.inst, o.l.debts[0].d.sinst], ['R 4 000.00', 'R 4 000.00']);
  assert.deepStrictEqual([o.l.debts[1].d.inst, o.l.debts[1].d.sinst], ['', 'R 5 000.00']);
});

/* ---------- action points and the Priorities box ---------- */
const A = require('../app/js/actions.js');
const S = require('../app/js/summary.js');
const sets = (s, o) => { Object.keys(o).forEach(k => set(s, k, o[k])); return s; };

test('credit life is asked only for a home loan, vehicle finance or personal loan with a lender that the client pays; never for a cell phone, a person, a card or a paid-up debt', () => {
  const s = fresh(); set(s, 'fname', 'Edwin');
  store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', payer: 'Client', bal: 'R 550 000.00', cl: 'Not sure' });
  store.addRow(s, 'debts', { type: 'Other', desc: 'Cell phone', payer: 'Business', bal: 'R 20 000.00' });
  store.addRow(s, 'debts', { prov: 'Lily' });                                                       // the stray row of 13 November: a name in Loan provider, nothing else
  store.addRow(s, 'debts', { type: 'Credit card', payer: 'Client', bal: 'R 0.00' });
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'ABSA', payer: 'Spouse', bal: 'R 900 000.00' });
  store.addRow(s, 'debts', { type: 'Personal loan', prov: 'Capitec', payer: 'Client', bal: 'R 0.00' });      // paid up
  assert.deepStrictEqual(A.facts(s).credit_life.map(c => [c.debt, c.lender, c.credit_life]), [['vehicle finance', 'Wesbank', 'not sure']]);
  assert.match(A.local(s).join('\n'), /Ask the client Edwin whether there is credit life with Wesbank on the vehicle finance \(the client was not sure\)\./);
  store.addRow(s, 'debts', { type: 'Credit card', prov: 'Discovery Bank', payer: 'Client', bal: 'R 4 000.00', cl: 'Yes' });
  assert.ok(A.facts(s).credit_life.some(c => c.debt === 'credit card' && c.credit_life === 'Yes'), 'a card the client says has credit life is listed');
});

test('a take-over is said only for a broker box that was answered, per cover, and is an opportunity to quote', () => {
  const s = fresh(); sets(s, { fname: 'Anna', ma: 'Medical aid', ref_med: 'Valerie to contact for both', gap: 'Yes', sti: 'Yes', ref_sti: 'Cameron to contact client' });
  assert.ok(!A.facts(s).referrals.some(r => r.takeover), 'the preset Other broker alone is not an answer');
  assert.ok(!/another broker/.test(A.local(s).join('\n')));
  set(s, 'gap_broker', 'Other broker');                                                              // answered: the gap cover is with another broker
  const r = A.facts(s).referrals.find(x => x.who === 'Valerie');
  assert.strictEqual(r.takeover_of, 'gap cover');
  assert.match(A.local(s).join('\n'), /about medical aid and gap cover \(the gap cover is currently with another broker: an opportunity to quote; the client will decide\)/);
  assert.ok(!/take-over/i.test(A.local(s).join('\n')));
  const sp = fresh(); sets(sp, { fname: 'Anna', sti: 'Handled by spouse', ref_sti: 'Cameron to contact client' });
  assert.ok(!A.facts(sp).referrals.some(x => x.takeover), 'the spouse handles it: no broker is known');
});

test('hidden lists never feed points or totals', () => {
  const s = fresh(); set(s, 'has_debts', 'No'); store.addRow(s, 'debts', { bal: 'R 900 000.00', inst: 'R 9 500.00' }); set(s, 'has_debts', 'No');
  assert.ok(!(S.local(s, 'life') || []).some(l => /Total debt/.test(l)), 'no debt total with Has debts = No');
  const k = fresh(); store.addRow(k, 'kids', { name: 'Ben' }); store.addRow(k, 'kids', {}); set(k, 'has_kids', 'No'); set(k, 'pr_egar', schema.PRIORITY); set(k, 'egar_req', 'Request an EGAR');
  assert.ok(!A.facts(k).quotes.some(q => /Education/.test(q.quote) && q.children), 'no children counted when Has children = No');
  const g = fresh(); store.addRow(g, 'grp', { prov: 'Momentum FundsAtWork' }); set(g, 'has_group', 'Not sure');
  assert.strictEqual(A.facts(g).schedules.length, 0);
  const p = fresh(); set(p, 'pr_life', schema.NOT_PRIORITY); set(p, 'pref_spend', '850');
  assert.strictEqual(A.facts(p).preferred_monthly_spend, '');
});

test('a last look drops a point about group risk, pension schedules or credit life that the form does not hold', () => {
  const s = fresh(); set(s, 'fname', 'Edwin'); set(s, 'has_group', 'No'); set(s, 'has_pp', 'No');
  const kept = A.checkPoints(s, ['Ask the client Edwin how the current policy schedules for the group risk benefits will be provided.', 'Ask the client Edwin how the current pension and provident fund schedules will be provided.',
    'Ask the client Edwin whether there is credit life on the cell phone.', 'Request a BrightRock Fractured Shortfall quote: BR Shortfall Quote based on BR FNA Quote minus Group Risk.', 'Send the client Edwin the LOA to sign.']);
  assert.deepStrictEqual(kept, ['Request a BrightRock Fractured Shortfall quote: BR Shortfall Quote based on BR FNA Quote minus Group Risk.', 'Send the client Edwin the LOA to sign.']);
  assert.ok(!/group risk|provident|credit life/i.test(A.text(['Ask the client Edwin about the group risk benefits schedules.'], s)));
});

test('the Priorities box: Recommend, Client, Come back with (at most three lines), and Claude\'s version has the same shape', () => {
  const s = fresh(); sets(s, { fname: 'Edwin', pr_life: schema.PRIORITY, bf_fna_req: 'Request a quote', bf_fna_type: 'New Business', pref_spend: 'R 2 500.00' });
  store.addRow(s, 'bfred', { req: 'Request a quote', type: 'New Business', amt: 'R 2 500.00' });
  store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', cl: 'Yes' });
  const t = A.focusLocal(s);
  assert.match(t, /^1\. Personal Risk Covers\nRecommend: Request a BrightRock Fractured FNA quote/);
  assert.match(t, /\nClient: Agrees\./);
  assert.match(t, /Come back with:\n- Request a BrightRock Fractured reduced quote/);
  assert.ok(!/credit life/i.test(t));
  assert.ok(t.split('\n').length <= 7, 'a short box: ' + t.split('\n').length + ' lines');
});

test('one Astute pull covers all the policies: the other empty schedule boxes of cover the client has are preset to Draw from Astute', () => {
  const AS = 'Draw from Astute (with signed LOA)', s = fresh();
  sets(s, { has_risk: 'Yes', has_ra: 'Yes', has_pp: 'No', has_inv: 'Yes', has_group: 'No' });
  set(s, 'ps_risk', AS); assert.strictEqual(s.f.ps_ra.v, '', 'not before the LOA is Yes');
  set(s, 'loa', 'Yes');
  assert.deepStrictEqual([s.f.ps_ra.v, s.f.ps_ra.st, s.f.ps_inv.v, s.f.ps_inv.st], [AS, 'preset', AS, 'preset']);
  assert.strictEqual(s.f.ps_pp.v, '', 'the client has no pension fund');
  set(s, 'ps_inv', schema.psClient.inv);                                                                 // an answer already given is never changed
  assert.strictEqual(s.f.ps_inv.v, schema.psClient.inv);
  assert.ok(!/group risk/i.test(A.local(s).join('\n')));
});
