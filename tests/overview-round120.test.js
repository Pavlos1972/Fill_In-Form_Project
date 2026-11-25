/* Client Overview Studio 1.2 (24 November, Paul's counter offers, relayed by the Fix Skills chat at 18:20 and 18:50): when the client accepts a quote and the insurer comes back with loadings or exclusions, it sends a counter offer LETTER and a
   counter offer QUOTE. A counter offer is a quote of the same kind in the same block as the quote the client accepted (counterOf); the letter's terms (loadings per need group AND column group, exclusions numbered as the insurer numbers them)
   are read into it, amber until checked; the red references in the pillar columns, the premium before and after and the difference are DERIVED; the client decides on it and accepting it is not a second acceptance; the policy that issues is the
   counter offer; the replacement notes name it; the Overview cards say what was decided. Invented client only ("Test, Ruby"); invented numbers. Without a screen: t-overview-round120.js runs the screen, the PDF and the Presentation. */
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
const pres = require('../app/js/ov-pres.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Ruby'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Budget Insurance', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } };
const fresh = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json'); return s; };
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 };
const DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
const quote = (s, block, number, o, opts) => docs.applyQuote(s, block, Object.assign({ insurer: 'BrightRock', number, date: '19/11/2026', premium: 5000, lines: [LINE, DREAD] }, o || {}), 'BR ' + number + '.pdf', opts).quote;
const qpath = (s, q) => { const b = ['fna', 'shortfallQuote', 'reduced', 'comparative'].filter(k => s.blocks[k].quotes.indexOf(q) >= 0)[0]; return 'blocks.' + b + '.quotes.' + s.blocks[b].quotes.indexOf(q); };
const LETTER = { originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 3, exclusionsPage: 4, cells: [
  { need: 'needs', column: 'recover', loading: 10, exclusions: ['3*'] }, { need: 'needs', column: 'permanent', loading: 15, exclusions: [] }, { need: 'needs', column: 'death', loading: null, exclusions: [] },
  { need: 'dread', column: 'recover', loading: 10, exclusions: ['3*'] }], exclusions: [{ no: '3*', type: 'Medical', what: 'No cover for conditions of the lower back', page: 4 }], notes: 'Cover for additional expense needs is reduced.' };
const accepted = (s, q, uw) => { store.setStatus(s, qpath(s, q), 'accepted'); store.setUw(s, qpath(s, q), uw || 'both'); return q; };

test('the page is 1.2 (the layout stays 0.1), the changed scripts carry new tags in every page that loads them', () => {
  assert.ok(/^1\.[234]$/.test(schema.pageVersion), 'the page version is 1.2 to 1.4'); assert.strictEqual(schema.version, '0.1');
  assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.1'), 'compared as decimals');
  ['ov-schema', 'ov-calc', 'ov-store', 'ov-check', 'ov-docs', 'ov-pdf', 'ov-pres', 'ov-ui', 'ov-present'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[m-z]').test(app('overview.html')), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html', 'overview.html'].forEach(f => assert.ok(/folders-ui\.js\?v=20261124[m-z]/.test(app(f)) && /folders\.js\?v=20261124[m-z]/.test(app(f)), f));
});

test('the BrightRock column groups and need groups are ONE table (Paul\u2019s final word, 24 November: FOUR separate pillars, never a combined label): death = life cover, permanent = lump sum disability, recover from = income protector ONLY, the additional expense row = severe illness', () => {
  const col = schema.columnGroupById;
  assert.deepStrictEqual(col.death.pillars, ['life']); assert.deepStrictEqual(col.permanent.pillars, ['lsd']); assert.deepStrictEqual(col.recover.pillars, ['ip']);
  assert.ok(schema.needGroupById.needs && schema.needGroupById.dread && !schema.needGroupOfLine, 'two need groups; a line type does not decide a reference any more (Paul, 25 November)');
  assert.ok(schema.TERM_BENEFITS.indexOf('Severe illness and income protector') < 0, 'no combined label is offered');
  assert.deepStrictEqual(schema.cellOf('needs', 'recover'), { pillars: ['ip'], benefit: 'Income protector' }); assert.deepStrictEqual(schema.cellOf('dread', 'recover'), { pillars: ['sev'], benefit: 'Severe illness' });
  assert.deepStrictEqual(schema.cellOf(null, 'recover'), { pillars: ['ip'], benefit: 'Income protector' });
});

test('a counter offer is a quote of the same kind in the same block, linked to the one the client accepted; it has no underwriting of its own', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600'));
  assert.ok(calc.canCounter(s, q), 'accepted with loadings and exclusions: a counter offer can be added');
  const c = store.addCounterOffer(s, qpath(s, q), { number: '400500777', premium: 5420.01 });
  assert.strictEqual(c.counterOf, q.id); assert.strictEqual(c.kind, 'fna'); assert.strictEqual(c.lines.length, 0); assert.strictEqual(c.uw, null);
  assert.strictEqual(s.blocks.fna.quotes.indexOf(c), 1, 'in the same block');
  assert.strictEqual(calc.parentOf(s, c), q); assert.ok(calc.isCounter(s, c)); assert.ok(!calc.isCounter(s, q));
  assert.deepStrictEqual(calc.mainQuotes(s, 'fna'), [q]); assert.deepStrictEqual(calc.counterOffers(s, q), [c]); assert.strictEqual(calc.liveCounter(s, q), c);
  store.setStatus(s, qpath(s, c), 'accepted'); assert.strictEqual(c.uw, null, 'accepting a counter offer does not send it to underwriting'); assert.strictEqual(store.setUw(s, qpath(s, c), 'standard'), null);
  assert.ok(!calc.canCounter(s, c), 'a counter offer of a counter offer is added to the original quote, not to the counter offer');
});

test('the button is for an accepted quote whose underwriting has loadings, exclusions or both: not pending, standard, declined or a quote the client has not accepted', () => {
  const s = fresh(), q = quote(s, 'fna', '400500600');
  assert.ok(!calc.canCounter(s, q), 'pending client decision');
  store.setStatus(s, qpath(s, q), 'accepted'); assert.ok(!calc.canCounter(s, q), 'pending underwriting');
  ['standard', 'declinedHealth', 'declinedOther'].forEach(u => { store.setUw(s, qpath(s, q), u); assert.ok(!calc.canCounter(s, q), u); });
  ['loadings', 'exclusions', 'both'].forEach(u => { store.setUw(s, qpath(s, q), u); assert.ok(calc.canCounter(s, q), u); });
});

test('the letter’s terms: a loading belongs to a need group AND a column group and can differ (10% and 15%); exclusions keep the insurer’s number and the cells they apply to; everything amber; the reason stays empty', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600'));
  const r = docs.applyCounterLetter(s, q, LETTER, 'Ruby cover terms (Cover Proposal 400500600 400500777).pdf'), c = r.quote;
  assert.strictEqual(r.loadings, 3); assert.strictEqual(r.exclusions, 1);
  assert.strictEqual(c.number, '400500777'); assert.strictEqual(c.startDate, null, 'the letter\u2019s date is a proposal: it is kept in offer, not made the policy\u2019s start date'); assert.strictEqual(c.offer.startDate, '01/12/2026'); assert.strictEqual(c.offer.expires, '20/12/2026'); assert.strictEqual(c.offer.revPremium, 5420);
  const ls = c.terms.loadings; assert.deepStrictEqual(ls.map(l => [l.need, l.column, l.pct]), [['needs', 'recover', 10], ['needs', 'permanent', 15], ['dread', 'recover', 10]]);
  assert.ok(ls.every(l => l.st === 'verify' && l.by === 'page' && l.src.kind === 'counteroffer' && l.src.page === 3 && l.reason === '' && l.kind === null), 'amber, from the letter, no reason invented');
  assert.strictEqual(ls[0].benefit, 'Income protector'); assert.strictEqual(ls[1].benefit, 'Lump sum disability'); assert.strictEqual(ls[2].benefit, 'Severe illness');
  const ex = c.terms.exclusions[0]; assert.strictEqual(ex.no, '3*'); assert.strictEqual(ex.why, 'Medical'); assert.strictEqual(ex.page, 4); assert.deepStrictEqual(ex.applies, [{ need: 'needs', column: 'recover' }, { need: 'dread', column: 'recover' }]);
  assert.strictEqual(ex.st, 'verify'); assert.strictEqual(c.offer.notes, 'Cover for additional expense needs is reduced.');
  assert.strictEqual(calc.termsToCheck(c), 4); assert.strictEqual(calc.parentOf(s, c), q);
});

test('a letter read again changes nothing twice, replaces only amber rows, and never a row the adviser has checked', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600'));
  const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.strictEqual(store.confirmTerms(s, qpath(s, c)), 4); assert.strictEqual(calc.termsToCheck(c), 0);
  const again = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { cells: LETTER.cells.concat([{ need: 'needs', column: 'death', loading: 20, exclusions: [] }]) }), 'letter.pdf');
  assert.strictEqual(again.quote, c, 'the same counter offer'); assert.strictEqual(calc.counterOffers(s, q).length, 1);
  assert.strictEqual(c.terms.loadings.length, 4, 'the three checked rows stay and only the new 12% is added'); assert.strictEqual(c.terms.exclusions.length, 1);
  assert.strictEqual(c.terms.loadings.filter(l => l.st === 'verify').length, 1);
});

test('the red references are derived from the terms and belong to PILLARS (Paul, 25 November): each pillar\u2019s loading and exclusion once, in the pillar\u2019s column of the totals; nothing on a line', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const tot = (qq, p) => calc.refsTotal(qq, p).map(r => r.text);
  assert.deepStrictEqual(tot(c, 'ip'), ['+10% loading', 'Exclusion 3*'], 'recover from is the income protector'); assert.deepStrictEqual(tot(c, 'sev'), ['+10% loading', 'Exclusion 3*'], 'the additional expense row is severe illness');
  assert.deepStrictEqual(tot(c, 'lsd'), ['+15% loading']); assert.deepStrictEqual(tot(c, 'life'), [], 'the death column has no loading');
  assert.strictEqual(calc.refsAt, undefined, 'there is no per-line reference any more');
  // a typed loading on one benefit (round 1.1) and "All benefits" are references too
  store.addTerm(s, qpath(s, q), 'loadings'); const t = q.terms.loadings[0]; t.benefit = 'Life cover'; t.pct = 40;
  assert.deepStrictEqual(tot(q, 'life'), ['+40% loading']); assert.deepStrictEqual(tot(q, 'sev'), []);
  t.benefit = 'All benefits'; assert.deepStrictEqual(tot(q, 'ip'), ['+40% loading']); assert.deepStrictEqual(tot(q, 'life'), ['+40% loading']);
  t.pct = 12.5; assert.deepStrictEqual(tot(q, 'lsd'), ['+12.5% loading']);
});

test('premium before, after and the difference are derived: the LETTER’s original and revised premium (round 1.3: the letter is the source), else the quote before it and the counter offer’s own premium', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  let p = calc.counterPremium(s, c); assert.deepStrictEqual([p.before, p.after, p.diff, p.pct], [5000, 5420, 420, 8.4], 'only the letter is loaded: its revised premium');
  c.premium = 5420.01; p = calc.counterPremium(s, c); assert.deepStrictEqual([p.after, p.diff], [5420, 420], 'the counter offer quote prints the loaded premium a cent off the letter: the letter wins');
  q.premium = null; p = calc.counterPremium(s, c); assert.strictEqual(p.before, 5000, 'no premium on the original quote: the letter’s original premium');
  q.premium = 4999.99; p = calc.counterPremium(s, c); assert.strictEqual(p.before, 5000, 'the quote before it is a cent off the letter: the letter wins');
  const off0 = c.offer, was = [off0.origPremium, off0.revPremium]; off0.origPremium = null; off0.revPremium = null; p = calc.counterPremium(s, c); assert.deepStrictEqual([p.before, p.after], [4999.99, 5420.01], 'a letter that prints no premium: the quotes fill in'); off0.origPremium = was[0]; off0.revPremium = was[1]; q.premium = 5000;
  const c2 = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: '400500888', origPremium: 5420.01, revPremium: 5500 }), 'letter2.pdf').quote; c2.premium = 5500;
  assert.strictEqual(calc.counterOffers(s, q).length, 2); assert.strictEqual(calc.liveCounter(s, q), c2, 'the newest is the live one');
  assert.strictEqual(calc.counterPremium(s, c2).before, 5420.01, 'a second counter offer is compared with the first');
});

test('a quote and its counter offers are ONE acceptance: accepting the counter offer is no second acceptance; another quote accepted beside them still is', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  store.setStatus(s, qpath(s, c), 'accepted');
  assert.deepStrictEqual(calc.acceptedQuotes(s), [q], 'one acceptance'); assert.strictEqual(calc.acceptanceConflicts(s).length, 0);
  assert.ok(!check.run(s, { ran: true, done: { fna: true } }).problems.some(p => p.id === 'accept.second'));
  const r = quote(s, 'reduced', '400500650'); accepted(s, r, 'standard');
  assert.strictEqual(calc.acceptanceConflicts(s).length, 2, 'a second quote accepted beside them is a conflict');
  r.second = true; assert.strictEqual(calc.acceptanceConflicts(s).length, 0, 'unless the adviser ticks it');
  // a counter offer the client did not accept ends the acceptance
  const s2 = fresh(), q2 = accepted(s2, quote(s2, 'fna', '400500600')), c2 = docs.applyCounterLetter(s2, q2, LETTER, 'letter.pdf').quote; store.setStatus(s2, qpath(s2, c2), 'notaccepted');
  assert.deepStrictEqual(calc.acceptedQuotes(s2), [], 'the client turned the counter offer down: nothing is accepted'); assert.ok(calc.counterDead(s2, q2));
  const o2 = quote(s2, 'reduced', '400500650'); accepted(s2, o2, 'standard'); assert.strictEqual(calc.acceptanceConflicts(s2).length, 0, 'so another quote can be accepted without a warning');
});

test('the shortfall is the first quote that is NOT a counter offer; a counter offer never becomes the need', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  c.lines = [Object.assign({}, LINE, { life: { lump: 999999, monthly: 1 } })];
  assert.strictEqual(calc.shortfall(s).quote, q); assert.strictEqual(calc.shortfall(s).fna.life, 500000);
  s.blocks.fna.quotes.reverse(); assert.strictEqual(calc.shortfall(s).quote, q, 'also when the counter offer is listed first');
});

test('the policy that issues is the live counter offer once the client accepted it: the policy number is the same one (or its own), the start date is the counter offer\u2019s own, typed when the insurer has issued it; the quote itself is then no policy', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')); q.policyNo = 'P-100'; q.startDate = '01/11/2026';
  assert.ok(calc.policies(s).some(e => e.derived && e.item.id === q.id), 'issued, no counter offer yet: the quote is a policy');
  const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.ok(!calc.policies(s).some(e => e.derived), 'a counter offer is pending: nothing is a policy yet (the original is superseded)');
  store.setStatus(s, qpath(s, c), 'accepted');
  assert.ok(!calc.policies(s).some(e => e.derived), 'accepted, but the letter\u2019s proposed start date does not make it a policy: the insurer has not issued it yet');
  c.startDate = '01/12/2026';
  const d = calc.policies(s).filter(e => e.derived); assert.strictEqual(d.length, 1); assert.strictEqual(d[0].item.id, c.id); assert.strictEqual(d[0].item.lines.length, 2, 'a counter offer known only from its letter keeps the quote\u2019s lines: it is no empty policy'); assert.strictEqual(calc.policyTotals(s).all.life.lump >= 500000, true); assert.strictEqual(d[0].item.premium, 5420, 'the letter\u2019s revised premium until the quote is read'); assert.strictEqual(d[0].item.policyNo, 'P-100', 'the same policy number'); assert.strictEqual(d[0].item.doc, '01/12/2026');
  c.policyNo = 'P-200'; assert.strictEqual(calc.policies(s).filter(e => e.derived)[0].item.policyNo, 'P-200');
  store.setStatus(s, qpath(s, c), 'notaccepted'); assert.ok(!calc.policies(s).some(e => e.derived), 'the counter offer was turned down: no policy');
});

test('the replacement is the original quote’s answer; the red note names the live counter offer; a counter offer turned down takes the note away', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), bud = s.blocks.policies.items.filter(i => i.insurer === 'Budget Insurance')[0]; bud.policyNo = '100200300';
  store.toggleReplaced(s, qpath(s, q), bud.id, true);
  assert.strictEqual(calc.policyNote(s, calc.policies(s).filter(e => e.item === bud)[0]).text, 'Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600');
  const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.strictEqual(calc.policyNote(s, calc.policies(s).filter(e => e.item === bud)[0]).text, 'Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500777', 'named by the counter offer’s own number, once');
  assert.deepStrictEqual(calc.replOf(c), { answer: null, policies: [] }, 'nothing is stored on the counter offer');
  assert.deepStrictEqual(calc.replaceable(s, q).map(e => e.item.id), calc.replaceable(s, c).map(e => e.item.id), 'the same list for both');
  store.setStatus(s, qpath(s, c), 'notaccepted');
  const note = calc.policyNote(s, calc.policies(s).filter(e => e.item === bud)[0]); assert.ok(!note || note.kind !== 'replaced', 'turned down: no “will be replaced” note');
});

test('the status text: the quote says a counter offer was received; the counter offer carries only the client’s decision', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600'));
  assert.strictEqual(calc.statusText(q, s), 'Accepted with loadings and exclusions');
  const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.strictEqual(calc.statusText(q, s), 'Accepted with loadings and exclusions · Counter offer received'); assert.strictEqual(calc.statusText(c, s), 'Counter offer · Pending client decision');
  store.setStatus(s, qpath(s, c), 'accepted'); assert.strictEqual(calc.statusText(c, s), 'Counter offer · Accepted'); assert.strictEqual(calc.statusClass(c), 'accepted');
  store.setStatus(s, qpath(s, c), 'notaccepted'); assert.strictEqual(calc.statusText(c, s), 'Counter offer · Not accepted');
});

test('the counter offer quote is read like any quote into the counter offer with the same number (the letter made it); it is never merged into an ordinary quote, and the adviser’s terms and offer are kept', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const r = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', date: '28/11/2026', premium: 5420.01, lines: [LINE, DREAD] }, 'Ruby Cover Proposal 400500777.pdf', { counterOf: q.id });
  assert.strictEqual(r.quote, c, 'into the same counter offer'); assert.strictEqual(calc.counterOffers(s, q).length, 1); assert.strictEqual(s.blocks.fna.quotes.length, 2);
  assert.strictEqual(c.counterOf, q.id); assert.strictEqual(c.terms.loadings.length, 3, 'the terms read from the letter stay'); assert.strictEqual(c.offer.letter, 'letter.pdf'); assert.strictEqual(c.lines.length, 2); assert.strictEqual(c.premium, 5420, 'a cent off the letter is rounding: the letter’s figure is kept so a card never prints two premiums');
  // the same number as an ordinary quote: never merged
  const s2 = fresh(), a = quote(s2, 'fna', '555666777'); const r2 = docs.applyQuote(s2, 'fna', { insurer: 'BrightRock', number: '555666777', premium: 1, lines: [LINE] }, 'x.pdf', { counterOf: a.id });
  assert.notStrictEqual(r2.quote, a); assert.strictEqual(r2.quote.counterOf, a.id);
});

test('the file names in a Counter Offer Letter folder: letter, quote, consent form (ignored), signed copy (a hint only); the numbers in the names', () => {
  const R = docs.counterRole;
  assert.deepStrictEqual(R('Ruby’s cover terms (Cover Proposal 400500600 400500777).pdf'), { role: 'letter', numbers: ['400500600', '400500777'] });
  assert.deepStrictEqual(R('Ruby’s Cover Proposal 400500777.pdf'), { role: 'quote', numbers: ['400500777'] });
  assert.strictEqual(R('Consent to release confidential information (Cover Proposal 400500777).pdf').role, 'consent');
  assert.strictEqual(R('Ruby’s cover terms (Cover Proposal 400500600 400500777) - signed.pdf').role, 'signed');
  assert.strictEqual(R('Liberty Counter Offer - June 2012 - (Ruby).pdf').role, 'letter');
  assert.strictEqual(R('scan0001.pdf').role, 'other');
});

test('the folder search: the exact folder name Counter Offer Letter inside each policy folder (capitals and spaces ignored), never in a numbered standard folder; only read', () => {
  const F = require('../app/js/folders.js'); assert.strictEqual(typeof F.counterOfferDocuments, 'function');
  const src = app('js/folders.js'); assert.ok(/COUNTER_FOLDER = \/\^counter offer letters\?\$\//.test(src) && /if \(isStandard\(k\.name\)\) continue;/.test(src.slice(src.indexOf('async function counterOfferDocuments'))));
  const ui = app('js/folders-ui.js'); assert.ok(/async function counterFiles\(info, opts\)/.test(ui) && /F\.counterOfferDocuments\(f\.clients\[c\]\)/.test(ui) && /counterFiles: counterFiles/.test(ui));
  assert.ok(!/counterOffer/.test(src.slice(src.indexOf('async function clientDocuments'), src.indexOf('var COUNTER_FOLDER'))), 'the ordinary Load never picks the counter offer files up');
});

test('the letter’s reading: its own specification asks for the grid, the exclusions and the premiums; an empty reading is empty', () => {
  const p = docs.promptFor('counterletter');
  ['originalNumber', 'revisedNumber', 'origPremium', 'revPremium', 'startDate', 'expires', '"cells"', '"recover"', '"permanent"', '"death"', '"needs"', '"dread"', '"exclusions"', 'never guess'].forEach(k => assert.ok(p.indexOf(k) >= 0, k));
  assert.ok(docs.isEmptyRead('counterletter', {})); assert.ok(!docs.isEmptyRead('counterletter', { revPremium: 100 })); assert.ok(!docs.isEmptyRead('counterletter', { cells: [{}] }));
  assert.strictEqual(docs.SPEC_OF.counterletter, 'counterletter');
});

test('the check: unchecked terms hold the counter offer amber; "Terms checked" confirms them; a counter offer is asked for its pay-out guide like every BrightRock quote', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  let ps = check.run(s, { ran: true, done: { fna: true } }).problems; assert.ok(ps.some(p => p.id === 'counter.terms' && /4 terms/.test(p.message)));
  assert.ok(!ps.some(p => p.id === 'gaps' && /400500777/.test(p.message)), 'a counter offer known only from its letter has no figures yet, so no guide is asked for');
  c.lines = [LINE]; assert.ok(check.run(s, { ran: true, done: { fna: true } }).problems.some(p => p.id === 'gaps' && /400500777/.test(p.message)), 'once it has figures it is asked for its pay-out guide, like every BrightRock quote'); c.lines = [];
  assert.strictEqual(c.st, 'verify'); store.confirmTerms(s, qpath(s, c)); assert.strictEqual(c.st, 'confirmed', 'a counter offer known only from its letter is checked when its terms are');
  ps = check.run(s, { ran: true, done: { fna: true } }).problems; assert.ok(!ps.some(p => p.id === 'counter.terms'));
  assert.strictEqual(check.qTitle(c), 'BrightRock Counter Offer CP 400500777'); assert.notStrictEqual(check.qLabel(c), check.qLabel(q));
});

test('a file written by an older Studio opens (no counterOf, no offer); a saved counter offer round-trips; a counter offer whose quote is gone is an ordinary quote again', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')); const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const json = JSON.parse(store.toJSON(s)); const o = store.fromJSON(JSON.stringify(json));
  const oc = o.blocks.fna.quotes[1]; assert.strictEqual(oc.counterOf, o.blocks.fna.quotes[0].id); assert.strictEqual(oc.offer.letter, 'letter.pdf'); assert.strictEqual(oc.terms.loadings.length, 3); assert.strictEqual(calc.termsToCheck(oc), 4);
  delete json.blocks.fna.quotes[0].counterOf; delete json.blocks.fna.quotes[0].offer; const old = store.fromJSON(JSON.stringify(json)); assert.strictEqual(old.blocks.fna.quotes[0].counterOf, null);
  json.blocks.fna.quotes[0].removed = true; const gone = store.fromJSON(JSON.stringify(json));
  assert.deepStrictEqual(calc.mainQuotes(gone, 'fna').map(x => x.number), ['400500777'], 'the quote was removed: the counter offer stands on its own');
});

test('the Overview card follows the client’s decisions (FNA and reduced): the first-meeting wording only while the quote is open', () => {
  const s = fresh(), W = pres.WORDING, F = id => pres.sentenceFor(s, id);
  assert.strictEqual(F('fna'), 'This was not discussed in our last meeting.');
  const q = quote(s, 'fna', '400500600'); assert.strictEqual(F('fna'), W.fna.some);
  store.setStatus(s, qpath(s, q), 'notaccepted'); assert.strictEqual(F('fna'), W.fna.notaccepted); store.setStatus(s, qpath(s, q), 'accepted'); assert.strictEqual(F('fna'), W.fna.accepted);
  store.setUw(s, qpath(s, q), 'standard'); assert.strictEqual(F('fna'), W.fna.standard); store.setUw(s, qpath(s, q), 'declinedHealth'); assert.strictEqual(F('fna'), W.fna.declined);
  store.setUw(s, qpath(s, q), 'both'); assert.strictEqual(F('fna'), W.fna.terms);
  const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote; assert.strictEqual(F('fna'), W.fna.counter);
  store.setStatus(s, qpath(s, c), 'accepted'); assert.strictEqual(F('fna'), W.fna.counteraccepted); store.setStatus(s, qpath(s, c), 'notaccepted'); assert.strictEqual(F('fna'), W.fna.counterrefused);
  const r = quote(s, 'reduced', '400500650'); assert.strictEqual(F('reduced'), W.reduced.some); store.setStatus(s, qpath(s, r), 'accepted'); store.setUw(s, qpath(s, r), 'standard'); assert.strictEqual(F('reduced'), W.reduced.standard);
  Object.keys(W.fna).forEach(k => assert.ok(W.reduced[k], 'reduced has ' + k));
  // one open quote beside an accepted one: the most advanced counts
  const r2 = quote(s, 'reduced', '400500651'); assert.strictEqual(F('reduced'), W.reduced.standard);
  // no decision wording says "figures": the cards carry no numbers
  [].concat(Object.values(W.fna), Object.values(W.reduced)).forEach(t => assert.ok(!/\d/.test(t), t));
});

test('the screen, the PDF and the Presentation use the one set of functions: references in the totals row only, the counter offer head, the Counter offers page', () => {
  const ui = app('js/ov-ui.js'), pdf = app('js/ov-pdf.js'), pr = app('js/ov-present.js');
  assert.ok(/data-addcounter/.test(ui) && /data-confirmterms/.test(ui) && /calc\.canCounter\(state, q\)/.test(ui) && !/refsAt|lineRefs/.test(ui) && /calc\.refsTotal\(q, pid\)/.test(ui), 'the screen');
  assert.ok(/var COUNTERS = 'counters'/.test(ui) && /function countersHTML\(\)/.test(ui) && /data-gocounter/.test(ui), 'the Counter offers page');
  assert.ok(!/refsAt|refsOf/.test(pdf) && /calc\.refsTotal\(q, p\)/.test(pdf) && /function counterHead\(/.test(pdf) && /calc\.counterPremium\(state, q\)/.test(pdf), 'the PDF');
  assert.ok(!/refsAt|cellRefs/.test(pr) && /calc\.refsTotal\(c, pid\)/.test(pr) && /function counterView\(/.test(pr) && /calc\.counterPremium\(state\(\), q\)/.test(pr), 'the Presentation');
  assert.ok(!/ calc\.statusText\(q\)/.test(ui), 'every badge on the screen asks statusText with the state');
  [pdf, pr].forEach(src => assert.ok(/'Counter offer received'/.test(src), 'the PDF and the Presentation keep the badge short and say "Counter offer received" in the line beside it'));
});

test('no name is defined twice in the scripts of the page (a doubled name silently replaces the first)', () => {
  ['ov-ui.js', 'ov-pdf.js', 'ov-present.js', 'ov-calc.js', 'ov-docs.js', 'ov-store.js'].forEach(f => {
    const names = {}; (app('js/' + f).match(/^\s{2}function (\w+)\(/gm) || []).forEach(m => { const n = /function (\w+)/.exec(m)[1]; names[n] = (names[n] || 0) + 1; });
    assert.deepStrictEqual(Object.keys(names).filter(n => names[n] > 1), [], f);
  });
});

test('a second reading of the letter works in place: an amber row gets the new figure and keeps what was typed in it; a checked row is never touched; the same cell never gets a second row', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const l0 = c.terms.loadings[0]; l0.kind = 'medical'; l0.reason = 'raised blood pressure';          // typed by the adviser (a choice: it does not turn the row green)
  const again = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { cells: LETTER.cells.map(x => x.need === 'needs' && x.column === 'recover' ? Object.assign({}, x, { loading: 12 }) : x) }), 'letter.pdf');
  assert.strictEqual(again.quote.terms.loadings.length, 3, 'still three rows'); assert.strictEqual(l0.pct, 12, 'the amber row got the new figure'); assert.strictEqual(l0.reason, 'raised blood pressure'); assert.strictEqual(l0.kind, 'medical');
  assert.strictEqual(again.updated, 1);
  l0.st = 'confirmed'; l0.pct = 11;                                                                                                       // checked, and corrected by hand to 11%
  docs.applyCounterLetter(s, q, LETTER, 'letter.pdf'); assert.strictEqual(c.terms.loadings.length, 3, 'no second row for the same cell'); assert.strictEqual(l0.pct, 11, 'a checked row is never changed by a reading');
  const ex = c.terms.exclusions[0]; store.setPath(s, qpath(s, c) + '.terms.exclusions.0.what', 'Corrected wording', 'text'); docs.applyCounterLetter(s, q, LETTER, 'letter.pdf'); assert.strictEqual(c.terms.exclusions.length, 1); assert.strictEqual(ex.what, 'Corrected wording', 'a corrected wording stays');
});

test('Replace quote keeps the chain: a replaced counter offer stays a counter offer with its letter and terms; the counter offers of a replaced quote follow the new quote; a duplicate copy drops into the one that stays', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const r1 = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', premium: 5420.01, lines: [LINE] }, 'again.pdf', { replaces: c.id }), n1 = r1.quote;
  assert.strictEqual(n1.counterOf, q.id); assert.strictEqual(n1.terms.loadings.length, 3); assert.strictEqual(n1.offer.letter, 'letter.pdf'); assert.strictEqual(c.removed, true); assert.strictEqual(calc.parentOf(s, n1), q); assert.strictEqual(calc.liveCounter(s, q), n1);
  const r2 = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500601', premium: 5100, lines: [LINE, DREAD] }, 'new original.pdf', { replaces: q.id }), nq = r2.quote;
  assert.strictEqual(n1.counterOf, nq.id, 'the counter offer now belongs to the new original'); assert.strictEqual(calc.counterOffers(s, nq).length, 1); assert.strictEqual(calc.shortfall(s).quote, nq);
  const s2 = fresh(), a = accepted(s2, quote(s2, 'fna', '400500600')), b = docs.applyCounterLetter(s2, a, LETTER, 'letter.pdf').quote, dup = quote(s2, 'fna', '400500600', { lines: [LINE, DREAD, LINE] });
  s2.blocks.fna.quotes.unshift(dup); const dropped = store.dedupeQuotes(s2); assert.strictEqual(dropped, 1);
  const keep = s2.blocks.fna.quotes.filter(x => x.number === '400500600')[0]; assert.strictEqual(b.counterOf, keep.id, 'the counter offer points at the copy that stays');
});

test('the shortfall never takes a counter offer, even one whose quote is gone', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote; c.lines = [LINE];
  q.removed = true; assert.strictEqual(calc.shortfall(s).has, false, 'the quote is removed: there is no need to work out (the counter offer is not one)');
  assert.deepStrictEqual(calc.mainQuotes(s, 'fna').map(x => x.number), ['400500777'], 'it stands on its own for the acceptance rule');
});

test('the labels of the terms come from the table (need group and column group) at draw time: a correction of the mapping reaches saved files, also one saved by 1.2; a typed row keeps what was typed', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const l = c.terms.loadings[0], e = c.terms.exclusions[0]; l.benefit = 'a stale label'; e.benefit = 'a stale label';
  assert.strictEqual(calc.termBenefit(l), 'Income protector'); assert.strictEqual(calc.termBenefit(e), 'Severe illness, income protector', 'an exclusion printed in two cells: the two pillars listed, never one combined label');
  assert.strictEqual(calc.termBenefit({ benefit: 'Life cover' }), 'Life cover');
  const old = schema.columnGroupById.recover.pillars.slice(), oldB = schema.columnGroupById.recover.benefit; schema.columnGroupById.recover.pillars = ['lsd']; schema.columnGroupById.recover.benefit = 'Lump sum disability';
  assert.strictEqual(calc.termBenefit(l), 'Lump sum disability'); assert.deepStrictEqual(calc.refsTotal(c, 'ip').map(r => r.text), [], 'and the red references follow the same table'); assert.ok(calc.refsTotal(c, 'lsd').length > 0);
  schema.columnGroupById.recover.pillars = old; schema.columnGroupById.recover.benefit = oldB;
});

test('a quote whose counter offer the client turned down says so: not accepted (red), no policy comes from it; one the client accepted says that', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.strictEqual(calc.statusText(q, s), 'Accepted with loadings and exclusions \u00b7 Counter offer received'); assert.strictEqual(calc.statusClass(q, s), 'accepted');
  store.setStatus(s, qpath(s, c), 'notaccepted'); assert.strictEqual(calc.statusText(q, s), 'Accepted with loadings and exclusions \u00b7 Counter offer not accepted'); assert.strictEqual(calc.statusClass(q, s), 'notaccepted');
  store.setStatus(s, qpath(s, c), 'accepted'); assert.strictEqual(calc.statusText(q, s), 'Accepted with loadings and exclusions \u00b7 Counter offer accepted');
});

test('Mark everything as checked checks the terms read from a letter too', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  assert.ok(calc.termsToCheck(c) > 0); store.acceptAll(s); assert.strictEqual(calc.termsToCheck(c), 0); assert.strictEqual(c.st, 'confirmed');
});

test('View: the letter has its own button (the file the overview holds); the quote\u2019s file is never the letter; the counter offer\u2019s quote and letter each find their own file', () => {
  const view = require('../app/js/ov-view.js'); assert.strictEqual(typeof view.refFor, 'function');
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'Ruby cover terms (Cover Proposal 400500600 400500777).pdf').quote;
  c.src = { kind: 'quote', file: 'Ruby Cover Proposal 400500777.pdf' };
  const L = view.refFor(s, 'blocks.fna.quotes.1.letter'), Qr = view.refFor(s, 'blocks.fna.quotes.1');
  assert.strictEqual(L.role, 'letter'); assert.strictEqual(L.name, 'Ruby cover terms (Cover Proposal 400500600 400500777).pdf'); assert.strictEqual(Qr.role, 'quote'); assert.strictEqual(Qr.name, 'Ruby Cover Proposal 400500777.pdf');
  assert.strictEqual(view.refFor(s, 'blocks.fna.quotes.0.letter'), null, 'the original quote has no letter');
  const mk = n => ({ name: n, rel: ['BR Personal Covers - 700800900', 'Counter Offer Letter'], handle: {} }), pool = [mk(L.name), mk(Qr.name), mk('Ruby cover terms (Cover Proposal 400500600 400500777) - signed.pdf'), mk('Consent to release confidential information (Cover Proposal 400500777).pdf')];
  assert.strictEqual(view.pick(L, pool, {}).file.name, L.name); assert.strictEqual(view.pick(Qr, pool, {}).file.name, Qr.name);
});

test('review findings: a counter offer with the original\u2019s number is never a copy of it (and survives save and open); a letter with no number belongs to the counter offer that holds the file', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600'));
  const c = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: '400500600' }), 'letter.pdf').quote;
  assert.strictEqual(c.number, '', 'the original\u2019s number is no number for a counter offer'); assert.strictEqual(c.terms.loadings.length, 3);
  const o = store.fromJSON(store.toJSON(s)); assert.strictEqual(o.dups, 0, 'nothing is dropped on opening'); assert.strictEqual(calc.counterOffers(o, o.blocks.fna.quotes[0]).length, 1);
  const c2 = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: null }), 'letter.pdf').quote; assert.strictEqual(c2, c, 'the same file: the same counter offer'); assert.strictEqual(calc.counterOffers(s, q).length, 1);
  const c3 = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: '400500777' }), 'letter.pdf').quote; assert.strictEqual(c3.number, '400500777'); assert.strictEqual(calc.counterOffers(s, q).length, 1, 'it got its number; still one counter offer');
});

test('review findings: a typed correction in an amber term row is the adviser\u2019s (through setPath) and a second reading never overwrites it', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote, base = qpath(s, c);
  store.setPath(s, base + '.terms.loadings.0.pct', '12', 'pct'); store.setPath(s, base + '.terms.exclusions.0.what', 'Typed wording', 'text');
  assert.strictEqual(c.terms.loadings[0].st, 'verify', 'still amber: typing a term is a choice, not a check'); assert.strictEqual(c.terms.loadings[0].by, 'person');
  docs.applyCounterLetter(s, q, LETTER, 'letter.pdf'); assert.strictEqual(c.terms.loadings[0].pct, 12); assert.strictEqual(c.terms.exclusions[0].what, 'Typed wording');
});

test('review findings: removing a quote takes its counter offers with it and Undo brings them back together; the chain never splits', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  store.setStatus(s, qpath(s, c), 'accepted'); const other = quote(s, 'reduced', '400500650'); accepted(s, other, 'standard');
  store.setRemoved(s, qpath(s, q), true); assert.strictEqual(c.removed, true); assert.deepStrictEqual(calc.acceptedQuotes(s).map(x => x.number), ['400500650'], 'no orphan counter offer is accepted beside the other quote'); assert.strictEqual(calc.acceptanceConflicts(s).length, 0);
  store.setRemoved(s, qpath(s, q), false); assert.strictEqual(c.removed, false); assert.strictEqual(c.removedWith, undefined); assert.strictEqual(calc.parentOf(s, c), q);
  c.removed = true; store.setRemoved(s, qpath(s, q), true); store.setRemoved(s, qpath(s, q), false); assert.strictEqual(c.removed, true, 'a counter offer removed on its own stays removed');
});

test('review findings: replacing the OLDER counter offer keeps it the older one, the copies share nothing, and a replaced quote\u2019s counter offers follow', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c1 = docs.applyCounterLetter(s, q, LETTER, 'l1.pdf').quote, c2 = docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: '400500888' }), 'l2.pdf').quote;
  assert.strictEqual(calc.liveCounter(s, q), c2);
  const n = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', premium: 5420.01, lines: [LINE] }, 'again.pdf', { replaces: c1.id }).quote;
  assert.strictEqual(calc.liveCounter(s, q), c2, 'the newer one is still the live one'); assert.notStrictEqual(n.terms, c1.terms); assert.notStrictEqual(n.offer, c1.offer);
  n.terms.loadings[0].pct = 99; assert.notStrictEqual(c1.terms.loadings[0].pct, 99, 'editing the copy does not edit the one that Undo brings back');
  assert.ok(s.blocks.fna.quotes.indexOf(n) === s.blocks.fna.quotes.indexOf(c1) + 1, 'it takes the replaced one\u2019s place');
});

test('review findings: the replacement note names a number even when the live counter offer has none; a letter-only counter offer compares nothing in any view', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), bud = s.blocks.policies.items.filter(i => i.insurer === 'Budget Insurance')[0]; bud.policyNo = '100200300'; store.toggleReplaced(s, qpath(s, q), bud.id, true);
  docs.applyCounterLetter(s, q, Object.assign({}, LETTER, { revisedNumber: null }), 'letter.pdf');
  assert.strictEqual(calc.policyNote(s, calc.policies(s).filter(e => e.item === bud)[0]).text, 'Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600');
  const ui = app('js/ov-ui.js'), pdf = app('js/ov-pdf.js'), pr = app('js/ov-present.js');
  assert.ok(/q\.counterOf && !calc\.activeLines\(q\)\.length \? '' : '<h4>Compared with what you have now/.test(ui) && /q\.counterOf && !calc\.activeLines\(q\)\.length\)\) y = compareTable/.test(pdf) && /q\.counterOf && !calc\.activeLines\(q\)\.length \? \[\] : \[\['cmpr'/.test(pr));
});

test('review findings: a hand-edited file cannot crash the page (a loop of counter offers, a benefit named "constructor", a term row that is not an object)', () => {
  const s = fresh(), q = accepted(s, quote(s, 'fna', '400500600')), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  q.counterOf = c.id;                                                                                                                   // A -> B and B -> A
  assert.strictEqual(calc.parentOf(s, c), null); assert.strictEqual(calc.parentOf(s, q), null); assert.doesNotThrow(() => store.toJSON(s)); assert.doesNotThrow(() => check.run(s, { ran: true, done: { fna: true } }));
  q.counterOf = null; c.terms.loadings[0].benefit = 'constructor'; c.terms.loadings[0].column = 'constructor'; c.terms.exclusions[0].applies = [{ need: 'toString', column: '__proto__' }]; c.terms.loadings.push(null, 5, 'x');
  assert.doesNotThrow(() => calc.termRefs(c)); assert.doesNotThrow(() => calc.refsTotal(c, 'sev')); assert.doesNotThrow(() => calc.termBenefit(c.terms.loadings[0])); assert.doesNotThrow(() => calc.termsToCheck(c));
  assert.strictEqual(schema.needGroupById.constructor, undefined); assert.strictEqual(schema.BENEFIT_PILLARS.constructor, undefined);
});

test('review findings: the checks leave a counter offer out of the shortfall and budget rules of an ordinary quote', () => {
  const s = fresh(), q = quote(s, 'shortfallQuote', '400500650'); accepted(s, q, 'both'); const c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote; c.lines = [Object.assign({}, LINE, { life: { lump: 1, monthly: 1 } })];
  const ps = check.run(s, { ran: true, done: { shortfallQuote: true, fna: true } }).problems;
  assert.ok(!ps.some(p => p.id === 'shortfall.match' && /counter offer/.test(p.where)), 'no shortfall difference is flagged on the counter offer');
});

test('Paul 19:12: a counter offer is shown EXACTLY like every other quote of its insurer: the same lines read the same way, the same pay-out guide, the same instalment fill, the same checks', () => {
  const s = fresh(); store.fillFromFactFind(s, JSON.stringify(Object.assign({}, FFJ, { l: Object.assign({}, FFJ.l, { kids: [{ d: { name: 'Ann', sname: 'Test', cost: 'R 3 000.00' } }], debts: [{ d: { desc: 'Home loan', prov: 'Test Bank', inst: 'R 14 000.00', bal: 'R 1 000 000.00' } }] }) })), 'ff.json');
  const FULL = [LINE, { type: 'child', name: 'Ann', sname: 'Test', life: { lump: 100000, monthly: 3000 }, abi: 5 }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1000000, monthly: 'Not found' }, ip: { monthly: 14000 }, abi: 0, accelerated: false }, { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 }, DREAD];
  const q = accepted(s, quote(s, 'fna', '400500600', { lines: FULL })), c = docs.applyCounterLetter(s, q, LETTER, 'letter.pdf').quote;
  const r = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', date: '28/11/2026', premium: 5420.01, aciText: 'Premiums rise with the age adjuster', lines: FULL }, 'counter quote.pdf', { counterOf: q.id });
  assert.strictEqual(r.quote, c);
  const shape = x => calc.activeLines(x).map(l => [l.type, l.name || l.debt || '', l.src && l.src.kind, l.accelerated, !!(l.ip && l.ip.monthly), l.st]);
  assert.deepStrictEqual(shape(c), shape(Object.assign({}, q, { lines: q.lines })), 'every line is read into the counter offer the way the original\u2019s was: child care per child, each debt with its lender, Accelerated / Standalone, the instalment protector');
  check.settleAll(s);
  assert.ok(calc.activeLines(c).some(l => l.type === 'debt' && l.life.monthly === 14000 && l.via && /Fact Find|quote/.test(l.via['life.monthly'])), 'a debt instalment the counter offer quote did not print is filled like any quote\u2019s (from the other quote or the Fact Find)');
  assert.deepStrictEqual(calc.totals(c), calc.totals(q)); assert.strictEqual(c.aciText, 'Premiums rise with the age adjuster');
  // its change moment pay-out: found and filled like any quote's
  const m = docs.applyCmp(s, { number: '400500777', rows: [{ key: 'total', today: 1000000, projected: 2000000 }] }, 'BR CMPO - 400500777.pdf');
  assert.strictEqual(m, c, 'the pay-out guide goes to the counter offer with that CP number'); assert.ok(c.cmp && c.cmp.rows.length === 1);
  const ps = check.run(s, { ran: true, done: { fna: true } }).problems; assert.ok(!ps.some(p => p.id === 'gaps' && /400500777/.test(p.message)), 'and then nothing is missing');
});

test('Paul 19:12: a counter offer of ANOTHER insurer\u2019s quote is shown the way that insurer\u2019s quotes are shown (one whole-of-life line, the comparative card)', () => {
  const s = fresh(), l = { type: 'other', label: 'Cover', term: 'Whole of life', life: { lump: 2000000 }, sev: { lump: 500000 }, ip: { monthly: 10000 } };
  const q = docs.applyQuote(s, 'comparative', { insurer: 'Liberty', number: 'LQ-77', premium: 4000, lines: [l] }, 'Liberty quote.pdf').quote; accepted(s, q, 'loadings');
  const c = docs.applyQuote(s, 'comparative', { insurer: 'Liberty', number: 'LQ-78', premium: 4400, lines: [l] }, 'Liberty counter.pdf', { counterOf: q.id }).quote;
  assert.strictEqual(c.kind, 'comparative'); assert.strictEqual(c.insurer, 'Liberty'); assert.strictEqual(calc.parentOf(s, c), q); assert.deepStrictEqual(calc.activeLines(c).map(x => [x.type, x.label, x.term]), [['other', 'Cover', 'Whole of life']]);
  assert.deepStrictEqual(calc.totals(c), calc.totals(q)); assert.strictEqual(calc.counterPremium(s, c).diff, 400); assert.strictEqual(s.blocks.comparative.quotes.length, 2, 'in the same block');
  const ui = app('js/ov-ui.js'); assert.ok(/q\.kind === 'comparative' \? '<p class="blue">This is what the other insurer/.test(ui) && !/q\.counterOf \? ''  *: *cmpHTML/.test(ui), 'the card is the same quote card for both');
});

test('Paul 19:12: nothing in the three views is a summary: the screen, the PDF and the Presentation draw a counter offer with the same functions as every other quote', () => {
  const ui = app('js/ov-ui.js'), pdf = app('js/ov-pdf.js'), pr = app('js/ov-present.js');
  assert.ok(/linesTable\(p, q, false\)/.test(ui) && /cmpHTML\(q, p\)/.test(ui) && !/q\.counterOf \? ''\s*:\s*cmpHTML/.test(ui), 'the screen: the same lines table and pay-out');
  assert.ok(/y = linesTable\(doc, y, q, false/.test(pdf) && /y = cmpTable\(doc, y \+ 2, q\)/.test(pdf) && /y = uwBlock\(doc, y \+ 3, q\)/.test(pdf), 'the PDF: the same table, pay-out and terms for every quote');
  assert.ok(/out \+= linesTable\(q, false/.test(pr) && /hasCmp \? \[\['cmp', 'Your change moment pay-out'\]\]/.test(pr), 'the Presentation: the same lines table and pay-out tab');
  const i1 = pdf.indexOf("y = linesTable(doc, y, q, false"), i2 = pdf.indexOf('counterHead(doc, y + 2, state, q)'), i3 = pdf.indexOf('y = cmpTable(doc, y + 2, q)'); assert.ok(i1 > 0 && i1 < i2 && i2 < i3, 'the premium before and after sits under the table, before the pay-out');
});
