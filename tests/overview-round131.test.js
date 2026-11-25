/* Client Overview Studio 1.3, Paul's underwriting block (25 November, relayed by the Fix Skills chat 09:08 with his answers). A counter offer's underwriting terms are ONE plain summary, "Underwriting terms of the counter offer letter": a heading (loadings and
   exclusions, loadings, exclusions), the loadings of the pillars that carry one, the ONE reason for them (from the underwriters' e-mail), every exclusion once with the pillars it covers and the insurer's own wording; the typed tables are a closed
   "Correct by hand" fold. Contract revision o: terms.reason { text, kind, src { kind "uwemail", subject, sender, date, file }, st, by } and offer.quotePremium. The revised Cover Proposal's premium is replaced by the letter's on EVERY difference and the
   figure it printed is kept and warned about, naming both. Invented client only ("Test, Ruby"), invented figures. */
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
const quote = (s, number, o, opts) => docs.applyQuote(s, 'fna', Object.assign({ insurer: 'BrightRock', number, date: '19/11/2026', premium: 5000, lines: [LINE, DREAD] }, o || {}), 'BR ' + number + '.pdf', opts).quote;
const qpath = (s, q) => 'blocks.fna.quotes.' + s.blocks.fna.quotes.indexOf(q);
const accepted = (s, q) => { store.setStatus(s, qpath(s, q), 'accepted'); store.setUw(s, qpath(s, q), 'both'); return q; };
const CELLS = [{ need: 'needs', column: 'recover', loading: 9, exclusions: ['4*'] }, { need: 'needs', column: 'permanent', loading: 14, exclusions: ['5*'] }, { need: 'needs', column: 'death', loading: 6, exclusions: [] }, { need: 'dread', column: 'recover', loading: 11, exclusions: ['4*'] }];
const WORDS4 = 'We will not pay a claim that arises directly or indirectly from any condition of the lower back, including a disc, nerve or muscle disorder.';
const WORDS5 = 'We will not pay a claim that arises from a hazardous pursuit that the life insured takes part in.';
const mkLetter = o => Object.assign({ originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 3, exclusionsPage: 4, cells: CELLS,
  exclusions: [{ no: '4*', type: 'Medical', what: WORDS4, page: 4 }, { no: '5*', type: 'Occupational', what: WORDS5, page: 4 }], notes: null }, o || {});
const counter = (s, letter) => { const q = accepted(s, quote(s, '400500600')); return { q, c: docs.applyCounterLetter(s, q, letter || mkLetter(), 'letter.pdf').quote }; };
const problems = s => check.run(s, { ran: true, done: { fna: true } }).problems;
const EMAIL = o => Object.assign({ subject: 'Underwriting outcome for the proposal', from: 'The Underwriting Team', date: '12/11/2026', numbers: ['400500777'], reason: 'Raised blood pressure at the medical.', kind: 'medical' }, o || {});

test('the summary: the heading follows what is there; one line for each pillar that carries a loading (and only those); one row for each exclusion with the pillars it covers and the wording in full; the decision is derived', () => {
  const s = fresh(), { c } = counter(s), sm = calc.termsSummary(c);
  assert.strictEqual(sm.heading, 'loadings and exclusions'); assert.strictEqual(sm.decision, 'Accepted with loadings and exclusions');
  assert.deepStrictEqual(sm.loadings.map(l => [l.pillar, l.label, l.texts]), [['life', 'Life cover', ['+6% loading']], ['sev', 'Severe illness', ['+11% loading']], ['lsd', 'Lump sum disability', ['+14% loading']], ['ip', 'Income protector', ['+9% loading']]]);
  assert.strictEqual(sm.exclusions.length, 2, 'one row for each exclusion, however many cells it was printed under');
  assert.deepStrictEqual(sm.exclusions.map(e => [e.no, e.benefit, e.what, e.page]), [['4*', 'Severe illness, income protector', WORDS4, 4], ['5*', 'Lump sum disability', WORDS5, 4]]);
  // only the pillars that carry a loading are listed
  const s2 = fresh(), c2 = counter(s2, mkLetter({ cells: [CELLS[1], CELLS[3]], exclusions: [{ no: '5*', type: 'Occupational', what: WORDS5, page: 4 }] })).c, sm2 = calc.termsSummary(c2);
  assert.deepStrictEqual(sm2.loadings.map(l => l.pillar), ['sev', 'lsd'], 'two pillars, in the order of the columns, never four'); assert.strictEqual(sm2.exclusions.length, 1);
  // loadings only / exclusions only / nothing
  const s3 = fresh(), c3 = counter(s3, mkLetter({ exclusions: [] })).c; assert.strictEqual(calc.termsSummary(c3).heading, 'loadings'); assert.strictEqual(calc.termsSummary(c3).decision, 'Accepted with loadings'); assert.strictEqual(calc.termsSummary(c3).exclusions.length, 0);
  const s4 = fresh(), c4 = counter(s4, mkLetter({ cells: CELLS.map(x => Object.assign({}, x, { loading: null })) })).c; assert.strictEqual(calc.termsSummary(c4).heading, 'exclusions'); assert.strictEqual(calc.termsSummary(c4).decision, 'Accepted with exclusions'); assert.strictEqual(calc.termsSummary(c4).loadings.length, 0);
  const s5 = fresh(), c5 = counter(s5, mkLetter({ cells: [], exclusions: [] })).c, sm5 = calc.termsSummary(c5); assert.deepStrictEqual([sm5.heading, sm5.decision, sm5.loadings.length, sm5.exclusions.length, sm5.reason], ['', '', 0, 0, null]);
  // a pillar can carry two percentages (three cells of the additional expense row are all severe illness): both are shown
  const s6 = fresh(), c6 = counter(s6, mkLetter({ cells: [CELLS[3], { need: 'dread', column: 'permanent', loading: 13, exclusions: [] }] })).c;
  assert.deepStrictEqual(calc.termsSummary(c6).loadings.map(l => l.texts), [['+11% loading', '+13% loading']]);
});

test('the summary can never disagree with the Loadings and exclusions row under the totals: every pillar’s loadings are the loading references of refsTotal', () => {
  const s = fresh(), { c } = counter(s);
  schema.PILLARS.forEach(p => { const fromRow = calc.refsTotal(c, p.id).filter(r => r.kind === 'loading').map(r => r.text), l = calc.termsSummary(c).loadings.filter(x => x.pillar === p.id)[0]; assert.deepStrictEqual(l ? l.texts : [], fromRow, p.id); });
  const t = c.terms; t.loadings.push({ benefit: 'Life cover', pct: 3, kind: 'medical', reason: '' });          // a typed row joins the same way
  schema.PILLARS.forEach(p => { const fromRow = calc.refsTotal(c, p.id).filter(r => r.kind === 'loading').map(r => r.text), l = calc.termsSummary(c).loadings.filter(x => x.pillar === p.id)[0]; assert.deepStrictEqual(l ? l.texts : [], fromRow, p.id + ' after a typed row'); });
});

test('the one reason: terms.reason wins; a file built before it shows the reasons typed in the loading rows ONCE, nothing typed is lost; none is null', () => {
  const s = fresh(), { c } = counter(s); assert.strictEqual(calc.termsReason(c), null); assert.strictEqual(calc.termsSummary(c).reason, null, 'a missing reason is shown as missing, not as an empty one');
  c.terms.loadings[0].reason = 'Raised blood pressure'; c.terms.loadings[1].reason = 'raised blood pressure'; c.terms.loadings[2].reason = 'Works at heights';
  const r = calc.termsReason(c); assert.strictEqual(r.text, 'Raised blood pressure; Works at heights'); assert.strictEqual(r.own, false);
  c.terms.reason = { text: 'Raised blood pressure at the medical.', kind: 'medical', st: 'verify', by: 'page', src: { kind: 'uwemail', date: '12/11/2026' } };
  assert.strictEqual(calc.termsReason(c).text, 'Raised blood pressure at the medical.'); assert.strictEqual(calc.termsReason(c).own, true, 'the one reason wins');
  const s2 = fresh(), { c: c2 } = counter(s2, mkLetter({ cells: [], exclusions: [{ no: '4*', type: 'Medical', what: WORDS4, page: 4 }] })); c2.terms.reason = { text: 'x', st: 'confirmed', by: 'person' };
  assert.strictEqual(calc.termsSummary(c2).reason.text, 'x', 'an exclusions-only counter offer shows a reason that is there');
});

test('applyUwEmail: the reason goes into terms.reason with its source, amber and by the page; a second reading replaces an amber reason in place; a typed or checked reason is never replaced; an e-mail that names only other quotes fills nothing', () => {
  const s = fresh(), { q, c } = counter(s);
  const a = docs.applyUwEmail(s, EMAIL(), 'UW reply.eml', { quote: c }); assert.strictEqual(a.set, true);
  assert.deepStrictEqual([c.terms.reason.text, c.terms.reason.kind, c.terms.reason.st, c.terms.reason.by], ['Raised blood pressure at the medical.', 'medical', 'verify', 'page']);
  assert.deepStrictEqual([c.terms.reason.src.kind, c.terms.reason.src.subject, c.terms.reason.src.sender, c.terms.reason.src.date, c.terms.reason.src.file], ['uwemail', 'Underwriting outcome for the proposal', 'The Underwriting Team', '12/11/2026', 'UW reply.eml']);
  assert.strictEqual(calc.termsToCheck(c), c.terms.loadings.length + c.terms.exclusions.length + 1, 'the reason is one of the things to check');
  docs.applyUwEmail(s, EMAIL({ reason: 'Raised blood pressure and a high cholesterol reading.' }), 'UW reply 2.eml', { quote: c }); assert.strictEqual(c.terms.reason.text, 'Raised blood pressure and a high cholesterol reading.', 'a second e-mail works in place on an amber reason');
  // the e-mail must name this quote when it names any
  const m = docs.applyUwEmail(s, EMAIL({ numbers: ['999888777'], reason: 'Another client' }), 'other.eml', { quote: c }); assert.deepStrictEqual([m.set, m.mismatch], [false, ['999888777']]); assert.strictEqual(c.terms.reason.text, 'Raised blood pressure and a high cholesterol reading.');
  ['400500600', '400500777', 'CP 400500600'].forEach(n => assert.strictEqual(docs.applyUwEmail(s, EMAIL({ numbers: [n], reason: 'by number ' + n }), 'x.eml', { quote: c }).set, true, n));          // the original's, the revised and the counter offer's numbers all belong to this chain
  assert.strictEqual(docs.applyUwEmail(s, EMAIL({ numbers: [], reason: 'names no quote' }), 'x.eml', { quote: c }).set, true, 'an e-mail the adviser picked for this quote that names no number is taken');
  // nothing to fill
  assert.strictEqual(docs.applyUwEmail(s, EMAIL({ reason: null }), 'x.eml', { quote: c }).noReason, true); assert.strictEqual(docs.applyUwEmail(s, EMAIL(), 'x.eml', { quote: q }).noQuote, true, 'an ordinary quote has no counter offer terms to fill');
  assert.strictEqual(docs.isEmptyRead('uwemail', {}), true); assert.strictEqual(docs.isEmptyRead('uwemail', { reason: 'x' }), false); assert.strictEqual(docs.SPEC_OF.uwemail, 'uwemail');
  // checked: kept
  store.confirmTerms(s, qpath(s, c)); assert.strictEqual(c.terms.reason.st, 'confirmed'); assert.strictEqual(c.terms.reason.by, 'person'); assert.strictEqual(calc.termsToCheck(c), 0);
  const k = docs.applyUwEmail(s, EMAIL({ reason: 'A different reason' }), 'later.eml', { quote: c }); assert.strictEqual(k.kept, true);
  assert.notStrictEqual(c.terms.reason.text, 'A different reason', 'a checked reason is never replaced');
});

test('a reason the adviser types is his word (confirmed, by a person, no source); an empty text takes it away; confirming terms confirms the reason; the Counter offers page counts it', () => {
  const s = fresh(), { c } = counter(s); docs.applyUwEmail(s, EMAIL(), 'UW reply.eml', { quote: c });
  store.setUwReason(s, qpath(s, c), 'Raised blood pressure, treated.');
  assert.deepStrictEqual([c.terms.reason.text, c.terms.reason.st, c.terms.reason.by, c.terms.reason.src], ['Raised blood pressure, treated.', 'confirmed', 'person', undefined], 'the source tag goes: it is his now');
  assert.strictEqual(docs.applyUwEmail(s, EMAIL({ reason: 'Overwritten?' }), 'again.eml', { quote: c }).kept, true); assert.strictEqual(c.terms.reason.text, 'Raised blood pressure, treated.');
  store.setUwReason(s, qpath(s, c), '   '); assert.strictEqual(c.terms.reason, undefined, 'an empty text takes the reason away');
  assert.strictEqual(store.setUwReason(s, 'blocks.fna.quotes.99', 'x'), null);
  // confirmTerms with ONLY the reason amber still counts it
  const s2 = fresh(), { c: c2 } = counter(s2); store.confirmTerms(s2, qpath(s2, c2)); docs.applyUwEmail(s2, EMAIL(), 'UW reply.eml', { quote: c2 }); assert.strictEqual(store.confirmTerms(s2, qpath(s2, c2)), 1); assert.strictEqual(c2.terms.reason.st, 'confirmed');
  // acceptAll (confirm everything) goes through confirmTerms too
  const s3 = fresh(), { c: c3 } = counter(s3); docs.applyUwEmail(s3, EMAIL(), 'UW reply.eml', { quote: c3 }); store.acceptAll(s3); assert.strictEqual(c3.terms.reason.st, 'confirmed');
});

test('a hand-edited or older file never breaks the page: a reason that is not an object is dropped, one with no text gets an empty text; the reason and the proposal’s printed premium survive a save and an open', () => {
  const s = fresh(), { c } = counter(s); docs.applyUwEmail(s, EMAIL(), 'UW reply.eml', { quote: c });
  const o = store.fromJSON(store.toJSON(s)), oc = o.blocks.fna.quotes[1]; assert.deepStrictEqual(oc.terms.reason, c.terms.reason, 'the reason survives a save and an open'); assert.strictEqual(oc.offer.quotePremium, c.offer.quotePremium);
  [['text', null], 7, [], { st: 'verify' }].forEach(bad => { const j = JSON.parse(store.toJSON(s)); j.blocks.fna.quotes[1].terms.reason = bad; const r = store.fromJSON(JSON.stringify(j)); check.settleAll(r); assert.doesNotThrow(() => calc.termsSummary(r.blocks.fna.quotes[1])); assert.doesNotThrow(() => problems(r)); const rr = r.blocks.fna.quotes[1].terms.reason; assert.ok(rr === undefined || (typeof rr === 'object' && typeof rr.text === 'string'), JSON.stringify(bad)); });
  const j = JSON.parse(store.toJSON(s)); delete j.blocks.fna.quotes[1].terms.reason; assert.strictEqual(store.fromJSON(JSON.stringify(j)).blocks.fna.quotes[1].terms.reason, undefined, 'a file with no reason has none: the key is optional');
});

test('the premium (Paul 25 November): the letter’s figure is the counter offer quote’s premium on every difference; the proposal’s own figure is kept in offer.quotePremium whichever document is read first, re-read or opened; a premium the adviser types follows; the warning names both figures', () => {
  const rd = (letterFirst, p) => { const s = fresh(), q = accepted(s, quote(s, '400500600')); let c; const L = () => docs.applyCounterLetter(s, q, mkLetter(), 'letter.pdf').quote, Q = () => quote(s, '400500777', { premium: p }, { counterOf: q.id }); if (letterFirst) { L(); c = Q(); } else { Q(); c = L(); } return { s, q, c }; };
  [true, false].forEach(first => { const { s, c } = rd(first, 5420.01); assert.deepStrictEqual([c.premium, c.offer.quotePremium, c.offer.revPremium], [5420, 5420.01, 5420], first ? 'letter first' : 'quote first'); assert.ok(/R5,420\.01/.test(calc.premiumWarning(s, c)) && /R5,420\.00/.test(calc.premiumWarning(s, c))); });
  const big = rd(true, 6100); assert.deepStrictEqual([big.c.premium, big.c.offer.quotePremium], [5420, 6100], 'a large difference too: nothing is lost');
  // the quote is read again with another figure: the printed figure follows, the letter's stays the premium
  quote(big.s, '400500777', { premium: 5421 }, { counterOf: big.q.id }); assert.strictEqual(big.s.blocks.fna.quotes.length, 2, 'the same counter offer'); assert.deepStrictEqual([big.c.premium, big.c.offer.quotePremium], [5420, 5421]);
  // equal figures: no warning, and a letter read again with another figure moves the premium without mistaking the old letter figure for the proposal's
  const eq = rd(true, 5420); assert.strictEqual(calc.premiumWarning(eq.s, eq.c), ''); docs.applyCounterLetter(eq.s, eq.q, mkLetter({ revPremium: 5430 }), 'letter.pdf'); assert.strictEqual(eq.c.premium, 5430); assert.strictEqual(eq.c.offer.quotePremium, 5420, 'the proposal still printed 5,420');
  assert.ok(calc.premiumWarning(eq.s, eq.c).length > 0);
  // a skill-built file: only premium and revPremium, no quotePremium: opening it records the figure and aligns
  const s = fresh(), { c } = counter(s); c.premium = 5499.5; delete c.offer.quotePremium; const o = store.fromJSON(store.toJSON(s)); check.settleAll(o); const oc = o.blocks.fna.quotes[1]; assert.deepStrictEqual([oc.premium, oc.offer.quotePremium], [5420, 5499.5]);
  // typing a premium on the counter offer quote is the adviser's check of the figure: the letter's figure follows, the old one is not put back
  store.setPath(o, qpath(o, oc) + '.premium', '5500', 'money'); check.settleAll(o); assert.deepStrictEqual([oc.premium, oc.offer.revPremium, oc.offer.quotePremium], [5500, 5500, 5500]); assert.strictEqual(calc.premiumWarning(o, oc), '');
  // an ordinary quote has none
  assert.strictEqual(calc.premiumWarning(o, o.blocks.fna.quotes[0]), ''); assert.strictEqual(calc.premiumWarning(o, null), '');
});

test('the e-mail reading prompt asks for the one reason and the numbers, never client details; the page scripts carry no real exclusion number', () => {
  const p = docs.promptFor('uwemail'); assert.ok(/underwriters/.test(p) && /"reason"/.test(p) && /"numbers"/.test(p) && /"subject"/.test(p) && /"from"/.test(p) && /"date"/.test(p) && /never guess/.test(p), 'the prompt');
  assert.ok(/ID number, telephone number or e-mail address/.test(p), 'the client’s private numbers are never copied'); assert.ok(/uwemail/.test(app('js/ov-docs.js')));
  ['ov-docs.js', 'ov-ui.js', 'ov-calc.js', 'ov-pdf.js', 'ov-present.js'].forEach(f => assert.ok(!/\b1\*/.test(app('js/' + f)), f));
});

test('the summary is drawn from ONE function on the screen, in the PDF and in the Presentation; the tables are a closed Correct by hand fold; the e-mail has its own button and file input; the Presentation folds a long wording with one click', () => {
  const ui = app('js/ov-ui.js'), pdf = app('js/ov-pdf.js'), pres = app('js/ov-present.js'), html = app('overview.html');
  [ui, pdf, pres].forEach(f => assert.ok(/calc\.termsSummary\(q\)/.test(f), 'the one summary function'));
  assert.ok(/Underwriting decision/.test(ui) && /Underwriting decision/.test(pdf) && /Underwriting decision/.test(pres)); assert.ok(/Underwriting terms of the counter offer letter/.test(ui) && /Underwriting terms of the counter offer letter/.test(pdf) && /Underwriting terms of the counter offer letter/.test(pres));
  assert.ok(/Correct by hand/.test(ui) && /data-uwfile/.test(ui) && /data-uw-read/.test(ui) && /data-uwreason/.test(ui) && /Add the underwriter(\\u2019|\u2019)s e-mail/.test(ui)); assert.ok(/id="docMail"/.test(html) && /\.eml/.test(html));
  assert.ok(/data-act="exw"/.test(pres) && /exShut/.test(pres) && /Hide wording/.test(pres) && /Show wording/.test(pres));
  assert.ok(/premiumWarning/.test(ui) && /premiumWarning/.test(app('js/ov-check.js')), 'the card and the check use the one warning');
  ['ov-store', 'ov-check', 'ov-docs', 'ov-calc', 'ov-ui', 'ov-pdf', 'ov-present', 'ov-schema'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124q').test(html), f + ' tag'));
});
