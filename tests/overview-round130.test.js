/* Client Overview Studio 1.3 (24 November, evening: the Fix Skills chat tried the page's counter offer reading on a real BrightRock letter and its revised Cover Proposal and sent five findings, a to e). What this file pins:
   (a) BrightRock's PDF font draws the two letters "ti" as the private characters U+E000 and U+E001: a BrightRock reading is put right (BrightRock only); (b) the exclusion's own number never stays in its wording (only when it carries a mark that is
   not a digit or a letter, or stands alone on a line), also in a row read by 1.2; (c) the letter is the ONLY source of loadings and exclusion numbers: reading the revised proposal, before or after the letter, never adds, changes or removes a
   term row; (d) the letter is the source of the before and after premium, and a counter offer card never prints two premiums; (e) the need group decides the benefit and the pillar (needs + recover = income protector, dread + recover =
   severe illness), one table, derived at draw time so a file saved by 1.2 opens with the new labels. Invented client only ("Test, Ruby"); invented numbers: none of the real letter's figures is used. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const docs = require('../app/js/ov-docs.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Ruby'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') }, l: { kids: [], debts: [], risk: [] } };
const fresh = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json'); return s; };
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 };
const DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
const quote = (s, number, o, opts, insurer) => docs.applyQuote(s, 'fna', Object.assign({ insurer: insurer || 'BrightRock', number, date: '19/11/2026', premium: 5000, lines: [LINE, DREAD] }, o || {}), 'BR ' + number + '.pdf', opts).quote;
const qpath = (s, q) => 'blocks.fna.quotes.' + s.blocks.fna.quotes.indexOf(q);
const accepted = (s, q) => { store.setStatus(s, qpath(s, q), 'accepted'); store.setUw(s, qpath(s, q), 'both'); return q; };
const mkLetter = o => Object.assign({ originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 3, exclusionsPage: 4, cells: [
  { need: 'needs', column: 'recover', loading: 9, exclusions: ['4*'] }, { need: 'needs', column: 'permanent', loading: 14, exclusions: [] }, { need: 'dread', column: 'recover', loading: 9, exclusions: ['4*'] }],
  exclusions: [{ no: '4*', type: 'Medical', what: 'No cover for conditions of the lower back', page: 4 }], notes: null }, o || {});
const problems = s => check.run(s, { ran: true, done: { fna: true } }).problems;

test('the page is 1.3 (the layout stays 0.1), the changed scripts carry new tags', () => {
  assert.ok(/^1\.[3456789]$/.test(schema.pageVersion), 'the page is 1.3 or later'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.2'), 'compared as decimals');
  ['ov-schema', 'ov-calc', 'ov-docs', 'ov-check'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[n-z]').test(app('overview.html')), f));
});

test('(e) Paul\u2019s FOUR pillars, ONE table: death = life cover, permanent = lump sum disability, recover from = income protector ONLY, the additional expense row = severe illness whatever column it is printed under; no combined label anywhere', () => {
  const c = schema.cellOf;
  assert.deepStrictEqual(c('needs', 'recover'), { pillars: ['ip'], benefit: 'Income protector' }); assert.deepStrictEqual(c('needs', 'permanent'), { pillars: ['lsd'], benefit: 'Lump sum disability' }); assert.deepStrictEqual(c('needs', 'death'), { pillars: ['life'], benefit: 'Life cover' });
  ['recover', 'permanent', 'death'].forEach(col => assert.deepStrictEqual(c('dread', col), { pillars: ['sev'], benefit: 'Severe illness' }, 'the additional expense row is severe illness under ' + col));
  assert.deepStrictEqual(c(undefined, 'recover'), { pillars: ['ip'], benefit: 'Income protector' }); assert.deepStrictEqual(c('nonsense', 'permanent').pillars, ['lsd']);
  assert.strictEqual(c('needs', 'nonsense'), null); assert.strictEqual(c('constructor', 'recover').benefit, 'Income protector', 'a name from the prototype is no need group');
  assert.strictEqual(schema.cellsBenefit([{ need: 'needs', column: 'recover' }]), 'Income protector'); assert.strictEqual(schema.cellsBenefit([{ need: 'dread', column: 'recover' }]), 'Severe illness');
  assert.strictEqual(schema.cellsBenefit([{ need: 'dread', column: 'recover' }, { need: 'needs', column: 'recover' }]), 'Severe illness, income protector', 'two pillars an exclusion is printed under: listed in the order of the columns, never the combined label');
  assert.strictEqual(schema.cellsBenefit([{ need: 'needs', column: 'recover' }, { need: 'needs', column: 'permanent' }, { need: 'needs', column: 'death' }, { need: 'dread', column: 'recover' }]), 'All benefits', 'an exclusion on every pillar is on all benefits, not a four-part list');
  assert.strictEqual(schema.cellsBenefit([{ need: 'needs', column: 'death' }, { need: 'needs', column: 'permanent' }, { need: 'needs', column: 'recover' }]), 'Life cover, lump sum disability, income protector');
  assert.strictEqual(schema.cellsBenefit([]), ''); assert.strictEqual(schema.cellsBenefit([{ need: 'needs', column: 'nonsense' }]), '');
  assert.ok(schema.TERM_BENEFITS.indexOf('Severe illness and income protector') < 0, 'not offered');
  ['ov-docs.js', 'ov-ui.js', 'ov-calc.js', 'ov-check.js', 'ov-pdf.js', 'ov-present.js', 'ov-pres.js'].forEach(f => assert.ok(!/severe illness and income protector/i.test(app('js/' + f)), f + ' has no combined label'));
});

test('(e) a loading or exclusion belongs to a PILLAR and is shown once per pillar (Paul, 25 November), not on each need line: life cover, lump sum disability, income protector, severe illness; never a combined label', () => {
  const s = fresh(), q = accepted(s, quote(s, '400500600')), L = mkLetter({ cells: [{ need: 'needs', column: 'recover', loading: 9, exclusions: [] }, { need: 'needs', column: 'permanent', loading: 14, exclusions: [] }, { need: 'needs', column: 'death', loading: 6, exclusions: [] }, { need: 'dread', column: 'recover', loading: 11, exclusions: ['4*'] }] });
  const c = docs.applyCounterLetter(s, q, L, 'letter.pdf').quote, tot = p => calc.refsTotal(c, p).map(r => r.text);
  assert.deepStrictEqual(tot('life'), ['+6% loading']); assert.deepStrictEqual(tot('lsd'), ['+14% loading']); assert.deepStrictEqual(tot('ip'), ['+9% loading']); assert.deepStrictEqual(tot('sev'), ['+11% loading', 'Exclusion 4*']);
  assert.strictEqual(calc.refsAt, undefined, 'no reference is worked out for a line');
  ['js/ov-ui.js', 'js/ov-pdf.js', 'js/ov-present.js'].forEach(f => assert.ok(!/refsAt|lineRefs|cellRefs|refsOf/.test(app(f)), f + ' puts no reference on a line'));
  assert.deepStrictEqual(c.terms.loadings.map(l => calc.termBenefit(l)), ['Income protector', 'Lump sum disability', 'Life cover', 'Severe illness'], 'one pillar each, never a combined label');
});

test('(e) a file saved by 1.2 (the old labels stored on the rows) opens with the new labels and the references per pillar; a row with no need group is the column\u2019s pillar; a typed row keeps what was typed', () => {
  const s = fresh(), q = accepted(s, quote(s, '400500600')), c = docs.applyCounterLetter(s, q, mkLetter(), 'letter.pdf').quote;
  c.terms.loadings.forEach(l => { l.benefit = 'Severe illness and income protector'; }); c.terms.exclusions[0].benefit = 'Severe illness and income protector';          // what 1.2 stored
  const o = store.fromJSON(store.toJSON(s)), oc = o.blocks.fna.quotes[1];
  assert.deepStrictEqual(oc.terms.loadings.map(l => calc.termBenefit(l)), ['Income protector', 'Lump sum disability', 'Severe illness']);
  assert.strictEqual(calc.termBenefit(oc.terms.exclusions[0]), 'Severe illness, income protector');
  const tot = p => calc.refsTotal(oc, p).map(r => r.text);
  assert.deepStrictEqual(tot('ip'), ['+9% loading', 'Exclusion 4*']); assert.deepStrictEqual(tot('sev'), ['+9% loading', 'Exclusion 4*']); assert.deepStrictEqual(tot('lsd'), ['+14% loading']); assert.deepStrictEqual(tot('life'), []);
  assert.strictEqual(calc.termBenefit({ column: 'recover', benefit: 'x' }), 'Income protector', 'no need group: the column\u2019s pillar');
  assert.strictEqual(calc.termBenefit({ benefit: 'Life cover' }), 'Life cover', 'a typed row'); assert.strictEqual(calc.termBenefit({ applies: [{ need: 'needs', column: 'death' }] }), 'Life cover');
});

test('(d) the letter is the source of the before and after premium: the counter offer quote takes the letter\u2019s figure in BOTH orders of reading, so one figure is on the card, in the issued policy and in the premium before and after; what the proposal printed is kept and a difference, even a cent, is warned (round 1.3, Paul 25 November)', () => {
  const read = (letterFirst, quotePremium) => {
    const s = fresh(), q = accepted(s, quote(s, '400500600')); let c;
    const letter = () => docs.applyCounterLetter(s, q, mkLetter(), 'letter.pdf').quote, cq = () => docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', premium: quotePremium, lines: [LINE, DREAD] }, 'Cover Proposal 400500777.pdf', { counterOf: q.id }).quote;
    if (letterFirst) { letter(); c = cq(); } else { cq(); c = letter(); }
    return { s, q, c };
  };
  [true, false].forEach(first => {
    const { s, q, c } = read(first, 5420.01), p = calc.counterPremium(s, c);
    assert.strictEqual(calc.counterOffers(s, q).length, 1, 'one counter offer'); assert.strictEqual(c.premium, 5420, 'the quote’s figure is the letter’s: ' + (first ? 'letter first' : 'quote first'));
    assert.deepStrictEqual([p.before, p.after, p.diff], [5000, 5420, 420]); assert.strictEqual(p.after, c.premium, 'the same figure');
    assert.strictEqual(c.offer.quotePremium, 5420.01, 'the figure the revised Cover Proposal printed is kept');
    const w1 = problems(s).filter(x => x.id === 'counter.premium'); assert.strictEqual(w1.length, 1, 'a cent is a warning now'); assert.ok(/5[ , ]?420\.01/.test(w1[0].message) && /5[ , ]?420\.00/.test(w1[0].message), 'it names both figures: ' + w1[0].message);
    assert.ok(calc.premiumWarning(s, c).length > 0, 'and so does the card\u2019s own warning');
    store.setPath(s, qpath(s, c) + '.policyNo', '900800700', 'text'); store.setPath(s, qpath(s, c) + '.startDate', '01/12/2026', 'date'); store.setStatus(s, qpath(s, c), 'accepted');
    const pol = calc.policies(s).filter(x => x.derived)[0]; assert.ok(pol, 'the accepted counter offer is the policy'); assert.strictEqual(pol.item.premium, 5420, 'the issued policy shows the same figure');
  });
  // a real difference is never hidden either: the letter's figure is the premium everywhere, the proposal's own is kept and named
  const { s, c } = read(true, 5500); assert.strictEqual(c.premium, 5420, 'the letter\u2019s figure'); assert.strictEqual(c.offer.quotePremium, 5500); assert.strictEqual(calc.counterPremium(s, c).after, 5420);
  const pr = problems(s).filter(x => x.id === 'counter.premium'); assert.strictEqual(pr.length, 1); assert.ok(/R\s?5[ , ]?420/.test(pr[0].message) && /R\s?5[ , ]?500/.test(pr[0].message), pr[0].message);
  // the same figures: no warning
  const same = read(true, 5420); assert.strictEqual(problems(same.s).filter(x => x.id === 'counter.premium').length, 0); assert.strictEqual(calc.premiumWarning(same.s, same.c), '');
  // the letter prints no premium: the quotes fill in
  const s2 = fresh(), q2 = accepted(s2, quote(s2, '400500600')), c2 = docs.applyCounterLetter(s2, q2, mkLetter({ origPremium: undefined, revPremium: undefined }), 'letter.pdf').quote; c2.premium = 5300;
  assert.deepStrictEqual([calc.counterPremium(s2, c2).before, calc.counterPremium(s2, c2).after], [5000, 5300]);
});

test('(d) a file the skill built or one saved by 1.2 opens with ONE premium too (settleAll): the quote before the letter takes the letter\u2019s figure when a cent apart, the counter offer quote always does and the proposal\u2019s own figure is warned about; a real difference on the BEFORE side is left and said', () => {
  const s = fresh(), q = accepted(s, quote(s, '400500600')), c = docs.applyCounterLetter(s, q, mkLetter(), 'letter.pdf').quote;
  q.premium = 4999.99; c.premium = 5420.01;                                                                  // what a 1.2 file or the skill\u2019s file can hold: each quote\u2019s own figure, a cent off the letter
  const o = store.fromJSON(store.toJSON(s)); assert.ok(check.settleAll(o) >= 2, 'settleAll puts both right');
  const oq = o.blocks.fna.quotes[0], oc = o.blocks.fna.quotes[1];
  assert.deepStrictEqual([oq.premium, oc.premium], [5000, 5420], 'the original\u2019s bar and the counter offer\u2019s bar show the letter\u2019s figures');
  const p = calc.counterPremium(o, oc); assert.deepStrictEqual([p.before, p.after, p.diff], [5000, 5420, 420]);
  const wo = problems(o).filter(x => x.id === 'counter.premium'); assert.strictEqual(wo.length, 1, 'only the revised proposal is warned about (a cent on the before side is rounding)'); assert.ok(/5[ , ]?420\.01/.test(wo[0].message), wo[0].message); assert.strictEqual(oc.offer.quotePremium, 5420.01);
  assert.strictEqual(check.settleAll(o) >= 0 && calc.alignPremiums(o), 0, 'and it is done once'); assert.strictEqual(oc.offer.quotePremium, 5420.01, 'settling again keeps the figure the proposal printed');
  // a real difference on the BEFORE side: left alone, said, the letter\u2019s figure is the one shown as the premium before
  const s2 = fresh(), q2 = accepted(s2, quote(s2, '400500600')), c2 = docs.applyCounterLetter(s2, q2, mkLetter(), 'letter.pdf').quote; q2.premium = 5100; check.settleAll(s2);
  assert.strictEqual(q2.premium, 5100); assert.strictEqual(calc.counterPremium(s2, c2).before, 5000);
  const pr = problems(s2).filter(x => x.id === 'counter.premium'); assert.strictEqual(pr.length, 1); assert.ok(/original premium/.test(pr[0].message) && /5[ ,\u00a0]?000/.test(pr[0].message) && /5[ ,\u00a0]?100/.test(pr[0].message), pr[0].message);
  // the premium before of a SECOND counter offer is the first counter offer\u2019s: aligned the same way
  const s3 = fresh(), q3 = accepted(s3, quote(s3, '400500600')), c3 = docs.applyCounterLetter(s3, q3, mkLetter(), 'l1.pdf').quote, d3 = docs.applyCounterLetter(s3, q3, mkLetter({ revisedNumber: '400500888', origPremium: 5420, revPremium: 5600 }), 'l2.pdf').quote;
  c3.premium = 5420.01; d3.premium = 5600.02; check.settleAll(s3); assert.deepStrictEqual([c3.premium, d3.premium], [5420, 5600]); assert.deepStrictEqual([calc.counterPremium(s3, d3).before, calc.counterPremium(s3, d3).after], [5420, 5600]);
});

test('(c) the letter is the ONLY source of loadings and exclusion numbers: reading the revised proposal, before or after the letter, never adds, changes or removes a term row, whatever the proposal’s own grid says', () => {
  const grid = { terms: { loadings: [{ pct: 0, benefit: 'All benefits' }], exclusions: [{ no: '4', what: 'its own wording' }] }, underwriting: { additionalCharge: 'No', exclusions: ['4'] }, loadings: [{ pct: 33 }], exclusions: [{ no: '9', what: 'x' }] };
  const proposal = (s, q) => docs.applyQuote(s, 'fna', Object.assign({ insurer: 'BrightRock', number: '400500777', premium: 5420, lines: [LINE, DREAD] }, grid), 'Cover Proposal 400500777.pdf', { counterOf: q.id }).quote;
  const A = fresh(), qa = accepted(A, quote(A, '400500600')); docs.applyCounterLetter(A, qa, mkLetter(), 'letter.pdf'); const before = JSON.stringify(calc.counterOffers(A, qa)[0].terms);
  const ca = proposal(A, qa); assert.strictEqual(JSON.stringify(ca.terms), before, 'the proposal read after the letter changes no row'); assert.strictEqual(ca.terms.loadings.length, 3); assert.strictEqual(ca.terms.exclusions.length, 1);
  const B = fresh(), qb = accepted(B, quote(B, '400500600')), cb = proposal(B, qb); assert.deepStrictEqual(cb.terms, { loadings: [], exclusions: [] }, 'the proposal alone makes no row');
  const cb2 = docs.applyCounterLetter(B, qb, mkLetter(), 'letter.pdf').quote; assert.strictEqual(cb2, cb, 'the letter then goes into the same counter offer'); assert.strictEqual(cb2.terms.loadings.length, 3); assert.strictEqual(cb2.terms.exclusions[0].no, '4*', 'the number as the LETTER prints it');
  const C = fresh(), qc = accepted(C, quote(C, '400500600')); docs.applyCounterLetter(C, qc, mkLetter(), 'letter.pdf'); proposal(C, qc); store.confirmTerms(C, qpath(C, calc.counterOffers(C, qc)[0])); const sealed = JSON.stringify(calc.counterOffers(C, qc)[0].terms);
  proposal(C, qc); assert.strictEqual(JSON.stringify(calc.counterOffers(C, qc)[0].terms), sealed, 'a checked row is untouched by a second reading of the proposal');
});

test('(b) the exclusion’s own number is never part of its wording: out when it carries a mark that is not a digit or a letter, or stands alone on a line; a bare digit in a sentence stays', () => {
  const o = calc.ownNumberOut;
  assert.strictEqual(o('No cover for 4* any condition of the lower back', '4*'), 'No cover for any condition of the lower back');
  assert.strictEqual(o('4* No cover for any condition', '4*'), 'No cover for any condition'); assert.strictEqual(o('No cover for any condition 4*', '4*'), 'No cover for any condition');
  assert.strictEqual(o('No cover for any\n4*\ncondition of the lower back', '4*'), 'No cover for any\ncondition of the lower back');
  assert.strictEqual(o('Cover is reduced for 4 conditions', '4'), 'Cover is reduced for 4 conditions', 'a bare digit inside a sentence is real text');
  assert.strictEqual(o('No cover for any\n4\ncondition', '4'), 'No cover for any\ncondition', 'a bare number alone on its own line is the number');
  assert.strictEqual(o('A star (4*) in brackets', '4*'), 'A star (4*) in brackets', 'only a whole token: a number inside brackets is left (no guessing)');
  assert.strictEqual(o('Nothing to strip', ''), 'Nothing to strip'); assert.strictEqual(o('', '4*'), ''); assert.strictEqual(o(null, '4*'), '');
  assert.strictEqual(o('a (5+) b 5+ c', '5+'), 'a (5+) b c', 'a number that has regular-expression characters is matched literally');
  // read by the page: the wording of a BrightRock letter comes out clean, in a new row and in an amber row of an earlier reading
  const s = fresh(), q = accepted(s, quote(s, '400500600')), L = mkLetter({ exclusions: [{ no: '4*', type: 'Medical', what: 'No cover for 4* conditions of the lower back', page: 4 }] });
  const c = docs.applyCounterLetter(s, q, L, 'letter.pdf').quote; assert.strictEqual(c.terms.exclusions[0].what, 'No cover for conditions of the lower back'); assert.strictEqual(c.terms.exclusions[0].no, '4*', 'the number stays in its own column');
  // an amber row of a 1.2 reading (the number in the wording) is cleaned when the file opens and when the letter is read again; a typed or checked row never
  const ex = c.terms.exclusions[0]; ex.what = 'No cover for 4* conditions of the lower back';
  const o1 = store.fromJSON(store.toJSON(s)); assert.strictEqual(o1.blocks.fna.quotes[1].terms.exclusions[0].what, 'No cover for conditions of the lower back', 'cleaned on opening');
  ex.what = 'No cover for 4* conditions of the lower back'; docs.applyCounterLetter(s, q, L, 'letter.pdf'); assert.strictEqual(ex.what, 'No cover for conditions of the lower back', 'cleaned by a second reading');
  store.setPath(s, qpath(s, c) + '.terms.exclusions.0.what', 'Typed 4* wording', 'text'); const o2 = store.fromJSON(store.toJSON(s)); assert.strictEqual(o2.blocks.fna.quotes[1].terms.exclusions[0].what, 'Typed 4* wording', 'what a person typed is theirs');
  docs.applyCounterLetter(s, q, L, 'letter.pdf'); assert.strictEqual(ex.what, 'Typed 4* wording');
  const s3 = fresh(), q3 = accepted(s3, quote(s3, '400500600')), c3 = docs.applyCounterLetter(s3, q3, L, 'letter.pdf').quote; store.confirmTerms(s3, qpath(s3, c3)); c3.terms.exclusions[0].what = 'Checked 4* wording';
  assert.strictEqual(store.fromJSON(store.toJSON(s3)).blocks.fna.quotes[1].terms.exclusions[0].what, 'Checked 4* wording', 'a checked row is untouched');
});

test('(a) BrightRock’s private glyphs for "ti" (U+E000, U+E001) are put right in a BrightRock reading, and only there: the letter, the revised proposal, another insurer’s file is left as it is', () => {
  assert.strictEqual(docs.glyphs('underwring and addional'), 'underwriting and additional'); assert.deepStrictEqual(docs.glyphs({ a: ['x', { b: 'y' }], n: 5, z: null }), { a: ['xti', { b: 'yti' }], n: 5, z: null });
  const s = fresh(), q = accepted(s, quote(s, '400500600')), L = mkLetter({ notes: 'The underwring terms are addional', exclusions: [{ no: '4*', type: 'Medical', what: 'No cover for condions of the back', page: 4 }] });
  const c = docs.applyCounterLetter(s, q, L, 'letter.pdf').quote; assert.strictEqual(c.terms.exclusions[0].what, 'No cover for conditions of the back'); assert.strictEqual(c.offer.notes, 'The underwriting terms are additional');
  const p = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', premium: 5420, aciText: 'CPI + addional', lines: [Object.assign({}, LINE, { note: 'x' })] }, 'Cover Proposal 400500777.pdf', { counterOf: q.id }).quote; assert.strictEqual(p.aciText, 'CPI + additional');
  const lq = quote(s, '112233445', { aciText: 'raised by addional 2%' }, null, 'Liberty'); assert.strictEqual(lq.aciText, 'raised by addional 2%', 'another insurer: not touched (its font may use these code points for something else)');
  const sl = fresh(), ql = accepted(sl, quote(sl, '777888999', null, null, 'Liberty')), cl = docs.applyCounterLetter(sl, ql, mkLetter({ exclusions: [{ no: '4*', type: 'Medical', what: 'condions', page: 4 }] }), 'letter.pdf').quote;
  assert.strictEqual(cl.terms.exclusions[0].what, 'condions', 'a Liberty letter is left as it is');
});

test('the reading prompts: the letter’s asks for "ti", for the number outside the wording and for the letter alone; the quote’s says its own terms grid is never read; no prompt carries a real example number', () => {
  const lp = docs.promptFor('counterletter', {}), qp = docs.promptFor('fna', {});
  assert.ok(/"ti"/.test(lp) && /odd characters/.test(lp), 'the glyphs'); assert.ok(/never part of the wording/.test(lp) && /leave it out of "what"/.test(lp), 'the number'); assert.ok(/THIS letter only/.test(lp), 'the letter alone');
  assert.ok(/Underwriting terms grid/.test(qp) && /counter offer letter only/.test(qp), 'the quote prompt');
  ['ov-docs.js', 'ov-ui.js', 'ov-calc.js', 'ov-check.js', 'ov-pdf.js', 'ov-present.js', 'ov-pres.js', 'ov-schema.js'].forEach(f => assert.ok(!/\b1\*/.test(app('js/' + f)), f + ' has no "1*"'));
  assert.ok(/for example 4\*/.test(lp), 'the invented example');
});
