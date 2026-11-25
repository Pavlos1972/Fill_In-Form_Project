/* Client Overview Studio 1.1 (24 November, Paul's four changes, relayed by the Fix Skills chat at 16:25):
   (1) a current policy the Fact Find lists but no schedule covers is filled from the NEWEST Astute report (a fallback: a schedule always wins; only empty boxes; the row names its source and date);
   (2) a quote's status progresses: the client's decision (pending, accepted, not accepted) and, for an accepted quote, the insurer's underwriting (pending, six outcomes); only one quote may be accepted unless the adviser ticks "second policy alongside the first";
   (3) the underwriting terms (loadings and exclusions) sit under an accepted and underwritten quote;
   (4) every quote asks "Will this quote replace any of the client's existing policies?" and the policies it replaces get a red note; a policy no quote replaces says so and asks about the broker on record.
   Invented client only ("Test Dora"); invented policy and quote numbers. Without a screen: the browser check t-overview-round110.js runs the screen, the PDF and the Presentation. */
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
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Dora'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Budget Insurance', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'BrightRock', spend: 'R 2 000.00', broker: 'Paul K' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } };
const fresh = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json'); return s; };
const quote = (s, block, number, o) => docs.applyQuote(s, block, Object.assign({ insurer: 'BrightRock', number, date: '19/11/2026', premium: 5000, lines: [{ type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 }] }, o || {}), 'q' + number + '.pdf').quote;
const qpath = (s, q) => { const b = ['fna', 'shortfallQuote', 'reduced', 'comparative'].filter(k => s.blocks[k].quotes.indexOf(q) >= 0)[0]; return 'blocks.' + b + '.quotes.' + s.blocks[b].quotes.indexOf(q); };
const pol = (s, ins) => s.blocks.policies.items.filter(i => i.insurer === ins)[0];
const entry = (s, it) => calc.policies(s).filter(e => e.item === it)[0];

test('the page is 1.1 (the layout stays 0.1), the changed scripts carry new tags in every page that loads them', () => {
  assert.ok(/^1\.[1234567]$/.test(schema.pageVersion), 'the page version is 1.1 to 1.6'); assert.strictEqual(schema.version, '0.1');
  assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.0'), 'compared as decimals');
  const h = app('overview.html');
  ['ov-schema', 'ov-calc', 'ov-store', 'ov-check', 'ov-docs', 'ov-pdf', 'ov-view', 'ov-ui', 'ov-present'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[a-z]').test(h), f + ' has a new tag'));
  ['overview', 'present'].forEach(f => assert.ok(new RegExp('css/' + f + '\\.css\\?v=20261124[a-z]').test(h) || new RegExp('css/' + f + '\\.css\\?v=20261124[a-z]').test(h), f + '.css'));
});

test('the states: three client decisions, seven underwriting steps, every older status converted when a quote is settled (declined = accepted then declined (other) is a GUESS)', () => {
  assert.deepStrictEqual(schema.STATUS.map(x => x.id), ['pending', 'accepted', 'notaccepted']);
  assert.deepStrictEqual(schema.UW.map(x => x.id), ['pending', 'standard', 'loadings', 'exclusions', 'both', 'declinedHealth', 'declinedOther']);
  const old = { pending: ['pending', null], accepted: ['accepted', null], notaccepted: ['notaccepted', null], underwriting: ['accepted', 'pending'], declined: ['accepted', 'declinedOther'], medical: ['accepted', 'declinedHealth'] };
  Object.keys(old).forEach(k => { const q = { status: k }; calc.settleQuote(q); assert.deepStrictEqual([q.status, q.uw], old[k], k); assert.strictEqual(q.second, false); assert.deepStrictEqual(q.terms, { loadings: [], exclusions: [] }); assert.deepStrictEqual(q.repl, { answer: null, policies: [] }); });
  const junk = { status: 'something else', uw: 'nonsense', second: 'true', terms: { loadings: 'x' }, repl: { answer: 'maybe', policies: 'x' } }; calc.settleQuote(junk);
  assert.deepStrictEqual([junk.status, junk.uw, junk.second], ['pending', null, true]); assert.deepStrictEqual(junk.terms, { loadings: [], exclusions: [] }); assert.deepStrictEqual(junk.repl, { answer: null, policies: [] });
  const again = { status: 'accepted', uw: 'standard', second: false, terms: { loadings: [], exclusions: [] }, repl: { answer: null, policies: [] } }; assert.strictEqual(calc.settleQuote(again), 0, 'a settled quote changes nothing');
});

test('one function says what a quote\'s state is: text, badge class, accepted, dead, issued', () => {
  const T = (status, uw) => { const q = { status, uw: uw || null, policyNo: '', startDate: '' }; calc.settleQuote(q); return q; };
  const rows = [[T('pending'), 'Pending client decision', 'pending', false, false], [T('notaccepted'), 'Not accepted', 'notaccepted', false, true], [T('accepted'), 'Accepted', 'accepted', true, false],
    [T('accepted', 'pending'), 'Accepted · Pending underwriting', 'underwriting', true, false], [T('accepted', 'standard'), 'Accepted at standard rates', 'accepted', true, false], [T('accepted', 'loadings'), 'Accepted with loadings', 'accepted', true, false],
    [T('accepted', 'exclusions'), 'Accepted with exclusions', 'accepted', true, false], [T('accepted', 'both'), 'Accepted with loadings and exclusions', 'accepted', true, false],
    [T('accepted', 'declinedHealth'), 'Declined (health)', 'medical', false, true], [T('accepted', 'declinedOther'), 'Declined (other)', 'declined', false, true]];
  rows.forEach(r => { assert.strictEqual(calc.statusText(r[0]), r[1], r[1]); assert.strictEqual(calc.statusClass(r[0]), r[2], r[1]); assert.strictEqual(calc.accepted(r[0]), r[3], r[1] + ' accepted'); assert.strictEqual(calc.dead(r[0]), r[4], r[1] + ' dead'); });
  const q = T('pending', 'standard'); assert.strictEqual(calc.uwOf(q), null, 'an underwriting step left on a quote the client has not accepted does not count');
  const i = T('accepted', 'standard'); i.policyNo = 'P1'; assert.strictEqual(calc.issued(i), false, 'no start date yet'); i.startDate = '01/12/2026'; assert.strictEqual(calc.issued(i), true);
  const d = T('accepted', 'declinedOther'); d.policyNo = 'P2'; d.startDate = '01/12/2026'; assert.strictEqual(calc.issued(d), false, 'a declined quote never becomes a policy');
  const r = T('accepted', 'standard'); r.removed = true; assert.strictEqual(calc.accepted(r), false); assert.strictEqual(calc.dead(r), true);
});

test('the store: Accepted goes to underwriting by itself, an outcome is kept, picks and answers are the adviser\'s, nothing turns an amber row green', () => {
  const s = fresh(), q = quote(s, 'fna', '400500601'), p = qpath(s, q);
  assert.strictEqual(q.status, 'pending'); assert.strictEqual(q.uw, null);
  store.setStatus(s, p, 'accepted'); assert.deepStrictEqual([q.status, q.uw], ['accepted', 'pending']);
  store.setUw(s, p, 'loadings'); store.setStatus(s, p, 'accepted'); assert.strictEqual(q.uw, 'loadings', 'an outcome already chosen is kept');
  assert.strictEqual(store.setStatus(s, p, 'declined'), null, 'a status that is not one of the three is refused'); assert.strictEqual(store.setUw(s, p, 'nonsense'), null);
  store.setStatus(s, p, 'notaccepted'); assert.strictEqual(calc.uwOf(q), null, 'not accepted: no underwriting step');
  store.setStatus(s, p, 'accepted');
  const l = store.addTerm(s, p, 'loadings'); assert.deepStrictEqual(l, { benefit: 'All benefits', pct: null, kind: 'medical', reason: '' }); const e = store.addTerm(s, p, 'exclusions'); assert.deepStrictEqual(e, { benefit: '', what: '', why: '' });
  assert.strictEqual(store.removeTerm(s, p, 'loadings', 5), false); assert.strictEqual(store.removeTerm(s, p, 'loadings', 0), true); assert.strictEqual(q.terms.loadings.length, 0);
  const bud = pol(s, 'Budget Insurance'); store.setRepl(s, p, 'yes'); store.toggleReplaced(s, p, bud.id, true); store.toggleReplaced(s, p, bud.id, true); assert.deepStrictEqual(q.repl.policies, [bud.id], 'picked once');
  store.setRepl(s, p, 'no'); assert.deepStrictEqual(q.repl, { answer: 'no', policies: [] }, 'No drops the picks');
  assert.strictEqual(store.setBrokerRecord(s, 'blocks.policies.items.0', 'moves').brokerRecord, 'moves'); store.setBrokerRecord(s, 'blocks.policies.items.0', 'stays'); assert.strictEqual(s.blocks.policies.items[0].brokerChangedDate, null);
  // an amber quote stays amber whatever the adviser chooses: only a typed figure is a check
  q.st = 'verify'; q.by = 'page';
  ['status', 'uw', 'second'].forEach(k => { store.setPath(s, p + '.' + k, k === 'second' ? 'true' : (k === 'uw' ? 'standard' : 'accepted'), 'text'); assert.strictEqual(q.st, 'verify', k + ' is a choice, not a check'); });
  store.setPath(s, p + '.repl.answer', 'no', 'text'); store.setPath(s, p + '.terms.loadings.0.pct', '25', 'pct'); assert.strictEqual(q.st, 'verify');
  store.setPath(s, 'blocks.policies.items.0.brokerRecord', 'stays', 'text'); assert.strictEqual(s.blocks.policies.items[0].st, 'ff', 'a policy\'s broker question does not confirm the row');
  store.setPath(s, p + '.premium', '5 100', 'money'); assert.strictEqual(q.st, 'confirmed', 'a typed figure is a check');
});

test('the one-acceptance rule: two accepted quotes conflict across the FNA, shortfall, reduced and comparative pages unless the adviser ticks the second; declined, not accepted and removed quotes are not in it', () => {
  const s = fresh(), a = quote(s, 'fna', '400500611'), b = quote(s, 'reduced', '400500612'), c = quote(s, 'comparative', '400500613', { insurer: 'Liberty' });
  assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'nothing accepted yet');
  store.setStatus(s, qpath(s, a), 'accepted'); assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'one accepted is fine (pending underwriting counts as accepted)');
  store.setStatus(s, qpath(s, b), 'accepted'); let cf = calc.acceptanceConflicts(s);
  assert.deepStrictEqual(cf.map(x => x.quote.number).sort(), ['400500611', '400500612'], 'both are in conflict'); assert.deepStrictEqual(cf.filter(x => x.quote === a)[0].others, [b]);
  store.setSecond(s, qpath(s, b), true); assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'ticked: a deliberate second policy');
  store.setStatus(s, qpath(s, c), 'accepted'); cf = calc.acceptanceConflicts(s); assert.deepStrictEqual(cf.map(x => x.quote.number).sort(), ['400500611', '400500613'], 'the ticked one is left out, the other two still conflict');
  store.setUw(s, qpath(s, c), 'declinedHealth'); assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'a quote the insurer declined is not accepted');
  store.setUw(s, qpath(s, c), 'standard'); store.setStatus(s, qpath(s, c), 'notaccepted'); assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'not accepted'); store.setStatus(s, qpath(s, c), 'accepted'); store.setRemoved(s, qpath(s, c), true); assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'removed');
  // the checks say so as a real reason, and name the other quote
  store.setRemoved(s, qpath(s, c), false); store.setSecond(s, qpath(s, b), false);
  const r = check.run(s), pr = r.problems.filter(p => p.id === 'accept.second');
  assert.strictEqual(pr.length, 3, 'one problem per quote in conflict (the three are accepted and none is ticked)'); assert.match(pr[0].message, /^Another quote is also accepted \(.+\): only one quote can be accepted, unless this is a deliberate second policy alongside the first \(tick that on the quote\)\.$/);
  assert.ok(!check.NOTE_IDS['accept.second'], 'it is a reason, not a note'); assert.strictEqual(r.dots.fna, 'amber', 'and it holds the quotes\' page amber');
});

test('the policy an accepted quote becomes follows the same function: only an issued (accepted, number, start date) quote, never a declined one', () => {
  const s = fresh(), q = quote(s, 'fna', '400500621'); const n0 = calc.policies(s).length;
  store.setStatus(s, qpath(s, q), 'accepted'); q.policyNo = 'NP100'; q.startDate = '01/12/2026'; store.setUw(s, qpath(s, q), 'standard');
  assert.strictEqual(calc.policies(s).length, n0 + 1); assert.ok(calc.policies(s).some(e => e.derived && e.item.policyNo === 'NP100'));
  store.setUw(s, qpath(s, q), 'declinedOther'); assert.strictEqual(calc.policies(s).length, n0, 'declined: no policy');
  store.setUw(s, qpath(s, q), 'pending'); assert.strictEqual(calc.policies(s).length, n0 + 1, 'pending underwriting still counts as issued once it has a number and a start date');
});

test('replacements: a policy picked by a live quote carries the red note with both numbers; a quote that is declined, not accepted or removed replaces nothing; the quote\'s own derived policy is not in its pick list', () => {
  const s = fresh(), q = quote(s, 'fna', '400500631'), r = quote(s, 'reduced', '400500632'), bud = pol(s, 'Budget Insurance'), lib = pol(s, 'Liberty');
  store.setRepl(s, qpath(s, q), 'yes'); store.toggleReplaced(s, qpath(s, q), bud.id, true);
  let n = calc.policyNote(s, entry(s, bud));
  assert.deepStrictEqual([n.kind, n.red, n.text], ['replaced', true, 'Budget Insurance will be replaced by BrightRock quote CP 400500631'], 'no policy number yet: just the insurer');
  bud.policyNo = '100200300'; n = calc.policyNote(s, entry(s, bud)); assert.strictEqual(n.text, 'Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500631');
  store.setRepl(s, qpath(s, r), 'yes'); store.toggleReplaced(s, qpath(s, r), bud.id, true); n = calc.policyNote(s, entry(s, bud)); assert.match(n.text, /will be replaced by BrightRock quote CP 400500631 and BrightRock quote CP 400500632$/, 'two quotes replace it');
  store.setStatus(s, qpath(s, q), 'notaccepted'); n = calc.policyNote(s, entry(s, bud)); assert.match(n.text, /replaced by BrightRock quote CP 400500632$/, 'a quote the client did not accept replaces nothing');
  store.setStatus(s, qpath(s, r), 'accepted'); store.setUw(s, qpath(s, r), 'declinedHealth'); assert.strictEqual(calc.policyNote(s, entry(s, bud)), null, 'declined by the insurer: no longer replaced, and with no live quote nothing is decided');
  const r3 = quote(s, 'comparative', '400500633', { insurer: 'Liberty' }); store.setRepl(s, qpath(s, r3), 'no'); assert.strictEqual(calc.policyNote(s, entry(s, bud)).kind, 'not', 'a live quote that answers No: this policy will not be replaced'); store.setRemoved(s, qpath(s, r3), true);
  store.setUw(s, qpath(s, r), 'standard'); store.setRemoved(s, qpath(s, r), true); assert.strictEqual(calc.policyNote(s, entry(s, bud)), null, 'every quote dead: nothing is decided, so no note at all');
  // the quote's own derived policy
  store.setRemoved(s, qpath(s, r), false); r.policyNo = 'NP200'; r.startDate = '01/12/2026'; store.setStatus(s, qpath(s, r), 'accepted'); store.setUw(s, qpath(s, r), 'standard');
  assert.ok(calc.replaceable(s, r).every(e => e.item.id !== r.id), 'a quote cannot replace the policy it became');
  assert.ok(calc.replaceable(s, q).some(e => e.item.id === r.id), 'another quote can replace it');
  assert.ok(lib, 'the Liberty policy exists');
});

test('"Will not be replaced" shows only once a live quote\'s replacement question is answered (never while nothing is decided); the broker question is for a policy of another broker only; the date turns the red note into a record', () => {
  const s = fresh(), q = quote(s, 'fna', '400500641'), bud = pol(s, 'Budget Insurance'), br = pol(s, 'BrightRock'), lib = pol(s, 'Liberty');
  assert.strictEqual(calc.policyNote(s, entry(s, bud)), null, 'question not answered: no note');
  store.setRepl(s, qpath(s, q), 'no'); let n = calc.policyNote(s, entry(s, bud));
  assert.deepStrictEqual([n.kind, n.red, n.text, n.broker, n.record, n.brokerText], ['not', true, 'Will not be replaced', true, null, ''], 'another broker: the question is asked');
  assert.strictEqual(calc.policyNote(s, entry(s, br)).broker, false, 'a Wealth Revolution policy has no broker question');
  store.setBrokerRecord(s, 'blocks.policies.items.' + s.blocks.policies.items.indexOf(bud), 'stays'); n = calc.policyNote(s, entry(s, bud)); assert.strictEqual(n.brokerText, 'Broker on record stays with the current broker');
  store.setBrokerRecord(s, 'blocks.policies.items.' + s.blocks.policies.items.indexOf(bud), 'moves'); n = calc.policyNote(s, entry(s, bud)); assert.strictEqual(n.brokerText, 'Broker on record to be changed'); assert.strictEqual(n.date, null);
  bud.brokerChangedDate = '30/11/2026'; n = calc.policyNote(s, entry(s, bud)); assert.strictEqual(n.brokerText, 'Broker changed on 30/11/2026', 'later updated by the adviser');
  store.setBrokerRecord(s, 'blocks.policies.items.' + s.blocks.policies.items.indexOf(bud), 'stays'); assert.strictEqual(bud.brokerChangedDate, null, 'the date goes when the broker stays');
  // a replaced policy never asks about the broker
  store.setRepl(s, qpath(s, q), 'yes'); store.toggleReplaced(s, qpath(s, q), lib.id, true); n = calc.policyNote(s, entry(s, lib)); assert.strictEqual(n.kind, 'replaced'); assert.strictEqual(n.brokerText, undefined);
  // the quote it is answered on goes: nothing is decided any more
  store.setStatus(s, qpath(s, q), 'notaccepted'); assert.strictEqual(calc.policyNote(s, entry(s, bud)), null, 'the only answered quote is dead');
  // a derived policy (an issued quote) is never "not replaced"
  const q2 = quote(s, 'reduced', '400500642'); store.setRepl(s, qpath(s, q2), 'no'); q2.policyNo = 'NP300'; q2.startDate = '01/12/2026'; store.setStatus(s, qpath(s, q2), 'accepted'); store.setUw(s, qpath(s, q2), 'standard');
  const der = calc.policies(s).filter(e => e.derived)[0]; assert.strictEqual(calc.policyNote(s, der), null);
});

test('the saved file keeps every new key, an older file with an older status opens converted, and a key the page does not know in a quote is kept', () => {
  const s = fresh(), q = quote(s, 'fna', '400500651'), bud = pol(s, 'Budget Insurance');
  store.setStatus(s, qpath(s, q), 'accepted'); store.setUw(s, qpath(s, q), 'both'); store.setSecond(s, qpath(s, q), true);
  store.addTerm(s, qpath(s, q), 'loadings'); q.terms.loadings[0] = { benefit: 'Life cover', pct: 25, kind: 'occupational', reason: 'works at heights' }; store.addTerm(s, qpath(s, q), 'exclusions'); q.terms.exclusions[0] = { benefit: 'Income protector', what: 'a back injury', why: 'a claim in 2023' };
  store.setRepl(s, qpath(s, q), 'yes'); store.toggleReplaced(s, qpath(s, q), bud.id, true); store.setBrokerRecord(s, 'blocks.policies.items.' + s.blocks.policies.items.indexOf(pol(s, 'Liberty')), 'moves'); pol(s, 'Liberty').brokerChangedDate = '01/12/2026';
  const back = store.fromJSON(store.toJSON(s)), q2 = back.blocks.fna.quotes[0];
  assert.deepStrictEqual([q2.status, q2.uw, q2.second], ['accepted', 'both', true]); assert.deepStrictEqual(q2.terms, q.terms); assert.deepStrictEqual(q2.repl, { answer: 'yes', policies: [bud.id] });
  assert.deepStrictEqual([pol(back, 'Liberty').brokerRecord, pol(back, 'Liberty').brokerChangedDate], ['moves', '01/12/2026']);
  const json = JSON.parse(store.toJSON(s)); ['underwriting', 'declined', 'medical'].forEach((k, i) => { json.blocks.fna.quotes[0].status = k; delete json.blocks.fna.quotes[0].uw; delete json.blocks.fna.quotes[0].terms; delete json.blocks.fna.quotes[0].repl; delete json.blocks.fna.quotes[0].second;
    const o = store.fromJSON(JSON.stringify(json)).blocks.fna.quotes[0]; assert.deepStrictEqual([o.status, o.uw], [['accepted', 'pending'], ['accepted', 'declinedOther'], ['accepted', 'declinedHealth']][i], 'old status ' + k); assert.deepStrictEqual(o.repl, { answer: null, policies: [] }); assert.deepStrictEqual(o.terms, { loadings: [], exclusions: [] }); });
});

test('a quote read again keeps what the adviser decided (status, underwriting, terms, replacements); a quote read twice is still one quote', () => {
  const s = fresh(), q = quote(s, 'fna', '400500661'), bud = pol(s, 'Budget Insurance'), p = qpath(s, q);
  store.setStatus(s, p, 'accepted'); store.setUw(s, p, 'loadings'); store.addTerm(s, p, 'loadings'); q.terms.loadings[0].pct = 25; store.setRepl(s, p, 'yes'); store.toggleReplaced(s, p, bud.id, true); store.setSecond(s, p, true);
  const q2 = quote(s, 'fna', '400500661', { premium: 5200 });
  assert.strictEqual(s.blocks.fna.quotes.length, 1, 'still one quote'); assert.strictEqual(q2.premium, 5200, 'the figures were read again');
  assert.deepStrictEqual([q2.status, q2.uw, q2.second], ['accepted', 'loadings', true]); assert.strictEqual(q2.terms.loadings[0].pct, 25); assert.deepStrictEqual(q2.repl, { answer: 'yes', policies: [bud.id] });
  // a duplicate copy that is dropped on opening hands its choices to the survivor when the survivor is still pending
  const s2 = fresh(), a = quote(s2, 'fna', '400500662'); const b = JSON.parse(JSON.stringify(a)); b.id = 'dup1'; b.status = 'accepted'; b.uw = 'standard'; s2.blocks.fna.quotes.push(b);
  const n = store.dedupeQuotes(s2); assert.ok(n >= 1); assert.strictEqual(s2.blocks.fna.quotes.filter(x => !x.removed).length, 1);
});

/* ---------- Astute: the fallback ---------- */
const ASTUTE = (o) => Object.assign({ reportDate: '20/11/2026', investments: [], policies: [{ insurer: 'Budget Insurance', product: 'Budget Life Plus', policyNo: '100200300', doc: '01/03/2019', premium: 900, life: 750000, sev: 250000, lsd: 0, ip: 12000, waiting: '1 month', aci: 7, abi: 5, ipAge: 65, benefits: { life: 'Life cover until age 70', ip: 'Income paid until age 65' }, page: 4 }], group: [] }, o || {});

test('Astute fills a current policy that has no schedule: only empty boxes, ONE line, the source and the date on the row, the amounts of the report in the right pillars', () => {
  const s = fresh(), bud = pol(s, 'Budget Insurance'); bud.product = 'My own typing';
  const r = docs.applyAstute(s, ASTUTE(), 'Astute 20.11.26.pdf');
  assert.deepStrictEqual(r.policies.filled, ['Budget Insurance 100200300']); assert.deepStrictEqual(r.policies.unmatched, []);
  assert.strictEqual(bud.product, 'My own typing', 'a box that already has something is never overwritten'); assert.strictEqual(bud.policyNo, '100200300'); assert.strictEqual(bud.doc, '01/03/2019'); assert.strictEqual(bud.premium, 900, 'the Fact Find\'s premium stays'); assert.strictEqual(bud.aci, 7); assert.strictEqual(bud.abi, 5); assert.strictEqual(bud.ipAge, 65);
  assert.strictEqual(bud.lines.length, 1); const l = bud.lines[0]; assert.strictEqual(l.type, 'other'); assert.strictEqual(l.life.lump, 750000); assert.strictEqual(l.sev.lump, 250000); assert.strictEqual(l.lsd.lump, 0); assert.strictEqual(l.ip.monthly, 12000); assert.strictEqual(l.waiting, '1 month');
  assert.deepStrictEqual([bud.src.kind, bud.src.file, bud.src.date, bud.src.page], ['astute', 'Astute 20.11.26.pdf', '20/11/2026', 4]); assert.strictEqual(l.src.kind, 'astute');
  assert.deepStrictEqual([bud.st, bud.by], ['verify', 'page'], 'it is to be checked, never ticked');
  assert.strictEqual(bud.benefits.life, 'Life cover until age 70'); assert.strictEqual(bud.benefits.ip, 'Income paid until age 65');
  const t = calc.totals(bud); assert.strictEqual(t.life.lump, 750000); assert.strictEqual(t.ip.monthly, 12000);
});

test('a schedule always beats Astute: a policy whose schedule was read is left alone, a later schedule replaces what Astute filled, a person\'s check is never touched, an older Astute never overwrites a newer one, a policy the Fact Find does not list is not added', () => {
  const s = fresh(), bud = pol(s, 'Budget Insurance'), lib = pol(s, 'Liberty');
  bud.src = { kind: 'schedule', file: 'Budget schedule.pdf', date: '01/11/2026' }; bud.st = 'verify'; bud.lines = [{ id: 'x1', type: 'other', label: 'Plan', life: { lump: 111111 }, st: 'verify', src: { kind: 'schedule' } }];
  let r = docs.applyAstutePolicies(s, ASTUTE(), 'a.pdf', '20/11/2026'); assert.deepStrictEqual(r.filled, []); assert.match(r.skipped[0], /its schedule was read/); assert.strictEqual(bud.lines[0].life.lump, 111111);
  const s2 = fresh(), b2 = pol(s2, 'Budget Insurance'); b2.st = 'confirmed'; b2.by = 'person'; r = docs.applyAstutePolicies(s2, ASTUTE(), 'a.pdf', '20/11/2026'); assert.match(r.skipped[0], /checked by hand/); assert.strictEqual(b2.lines.length, 0);
  const s3 = fresh(), b3 = pol(s3, 'Budget Insurance'); docs.applyAstutePolicies(s3, ASTUTE(), 'new.pdf', '20/11/2026');
  r = docs.applyAstutePolicies(s3, ASTUTE({ policies: [{ insurer: 'Budget Insurance', policyNo: '100200300', life: 1, page: 2 }] }), 'old.pdf', '01/06/2026'); assert.match(r.skipped[0], /Astute report of a later date/); assert.strictEqual(b3.lines[0].life.lump, 750000, 'the newer report stands'); assert.strictEqual(b3.src.date, '20/11/2026');
  const s4 = fresh(); r = docs.applyAstutePolicies(s4, ASTUTE({ policies: [{ insurer: 'Test Assurance', product: 'X', policyNo: '999', life: 5 }] }), 'a.pdf', '20/11/2026'); assert.deepStrictEqual(r.filled, []); assert.match(r.unmatched[0], /Test Assurance 999/); assert.strictEqual(s4.blocks.policies.items.length, 3, 'nothing was added');
  // a schedule read LATER claims the item Astute filled (it replaces the Astute line)
  const s5 = fresh(), b5 = pol(s5, 'Budget Insurance'); docs.applyAstutePolicies(s5, ASTUTE(), 'a.pdf', '20/11/2026');
  const hit = docs.matchItem(s5.blocks.policies.items, { policyNo: '100200300', premium: 900, insurer: 'Budget Insurance' }, x => x.insurer); assert.ok(hit && !hit.ambiguous && hit === b5, 'an Astute-filled item can still be claimed by its schedule');
  assert.ok(lib);
});

test('a figure the adviser corrected on an Astute line is kept when the same report is applied again (a line he typed or checked is never replaced)', () => {
  const s = fresh(), bud = pol(s, 'Budget Insurance'); docs.applyAstute(s, ASTUTE(), 'a.pdf');
  assert.strictEqual(bud.lines[0].life.lump, 750000); store.setPath(s, 'blocks.policies.items.0.lines.0.life.lump', '900000', 'money');
  assert.deepStrictEqual([bud.lines[0].st, bud.lines[0].by], ['confirmed', 'person'], 'typing is a person\'s check');
  docs.applyAstute(s, ASTUTE(), 'a.pdf'); assert.strictEqual(bud.lines[0].life.lump, 900000, 'the correction stands'); assert.strictEqual(bud.src.kind, 'astute');
  const s2 = fresh(), b2 = pol(s2, 'Budget Insurance'); docs.applyAstute(s2, ASTUTE(), 'a.pdf'); docs.applyAstute(s2, ASTUTE({ policies: [{ insurer: 'Budget Insurance', policyNo: '100200300', life: 1, ip: 2 }] }), 'b.pdf');
  assert.strictEqual(b2.lines[0].life.lump, 1, 'an untouched Astute line is replaced by the next report');
});

test('a schedule read after Astute replaces what both give (product, premium, lines) and the row becomes a schedule row', () => {
  const s = fresh(); docs.applyAstute(s, ASTUTE(), 'a.pdf'); const b = pol(s, 'Budget Insurance');
  const hit = docs.matchItem(s.blocks.policies.items, { policyNo: '100200300', premium: 900, insurer: 'Budget Insurance' }, x => x.insurer);
  docs.applyPolicy(s, hit, { insurer: 'Budget Insurance', policyNo: '100200300', product: 'Schedule product', premium: 905, lines: [{ type: 'other', label: 'Cover', life: { lump: 111111 } }] }, 'sched.pdf');
  assert.deepStrictEqual([b.src.kind, b.product, b.premium, b.lines.length, b.lines[0].life.lump, b.lines[0].src.kind], ['schedule', 'Schedule product', 905, 1, 111111, 'schedule']);
});

test('Astute is the fallback for group benefits too: only empty boxes of an item the Fact Find lists whose statement was not read', () => {
  const s = fresh(); s.blocks.group.items.push({ id: 'g1', kind: 'risk', provider: 'Test Group Scheme', statementDate: null, life: { amount: null, endAge: null }, sev: { amount: null, endAge: null }, lsd: { amount: null, endAge: null }, ip: { amount: null, endAge: null }, st: 'ff', src: { kind: 'factfind' } });
  const g = s.blocks.group.items[0], data = ASTUTE({ policies: [], group: [{ provider: 'Test Group Scheme', kind: 'risk', life: { amount: 1200000, endAge: '65' }, sev: { amount: 300000, endAge: '65' }, page: 6 }] });
  let r = docs.applyAstuteGroup(s, data, 'a.pdf', '20/11/2026'); assert.deepStrictEqual(r.filled, ['Test Group Scheme']); assert.strictEqual(g.life.amount, 1200000); assert.strictEqual(g.life.endAge, '65'); assert.strictEqual(g.sev.amount, 300000);
  assert.deepStrictEqual([g.src.kind, g.src.date, g.src.page, g.st], ['astute', '20/11/2026', 6, 'verify']);
  g.life.amount = 5; r = docs.applyAstuteGroup(s, ASTUTE({ policies: [], group: [{ provider: 'Test Group Scheme', kind: 'risk', life: { amount: 9 } }] }), 'b.pdf', '21/11/2026'); assert.strictEqual(g.life.amount, 5, 'a filled box is not overwritten');
  const s2 = fresh(); s2.blocks.group.items.push({ id: 'g2', kind: 'risk', provider: 'Test Group Scheme', life: { amount: 1, endAge: null }, sev: { amount: null, endAge: null }, lsd: { amount: null, endAge: null }, ip: { amount: null, endAge: null }, st: 'verify', src: { kind: 'group', file: 'stmt.pdf' } });
  r = docs.applyAstuteGroup(s2, data, 'a.pdf', '20/11/2026'); assert.match(r.skipped[0], /its statement was read/);
});

test('an Astute investment value keeps its page (the View button opens the report there); a schedule value is not replaced', () => {
  const s = fresh(); s.blocks.investments.items.push({ id: 'inv1', provider: 'Test Provider', product: 'Test RA', policyNo: 'RA1', st: 'ff', src: { kind: 'factfind' } });
  const r = docs.applyAstute(s, ASTUTE({ policies: [], investments: [{ provider: 'Test Provider', product: 'Test RA', policyNo: 'RA1', gross: 250000, monthly: 3000, page: 3 }] }), 'a.pdf');
  assert.strictEqual(r.filled, 1); const it = s.blocks.investments.items[0]; assert.deepStrictEqual([it.valueSource.kind, it.valueSource.date, it.valueSource.page], ['astute', '20/11/2026', 3]);
  const s2 = fresh(); s2.blocks.investments.items.push({ id: 'inv2', provider: 'Test Provider', product: 'Test RA', policyNo: 'RA1', st: 'verify', valueSource: { kind: 'schedule', file: 'ra.pdf' }, gross: 111 });
  docs.applyAstute(s2, ASTUTE({ policies: [], investments: [{ provider: 'Test Provider', product: 'Test RA', policyNo: 'RA1', gross: 250000 }] }), 'a.pdf'); assert.strictEqual(s2.blocks.investments.items[0].gross, 111);
});

test('the code: Astute is read in its own last phase, newest report last, and only the newest is ticked in the pick list; View opens the Astute report at its page; every screen asks the one state function', () => {
  const ui = app('js/ov-ui.js'), view = app('js/ov-view.js'), pdf = app('js/ov-pdf.js'), pres = app('js/ov-present.js');
  assert.ok(/var as = files\.filter\(isAstute\)\.map\(function \(f, i\) \{ return \{ f: f, i: i, k: dkey\(/.test(ui) && /sort\(function \(a, b\) \{ return a\.k - b\.k \|\| a\.i - b\.i; \}\)/.test(ui), 'the Astute files are read in their own last phase, sorted by the date in the name (the newest is the one that is read)');
  assert.ok(/!isGuide\(f\) && !isEmail\(f\) && !isAstute\(f\)/.test(ui), 'not read with the schedules');
  assert.ok(/f === tickAs\.best/.test(ui), 'only the newest Astute report is ticked');
  assert.ok(/ref\.astute = true/.test(view) && /View Astute report/.test(view) && /Astute report: page /.test(view), 'View names the report and goes to its page');
  [ui, pdf, pres].forEach(src => assert.ok(/calc\.statusText\(/.test(src), 'status text from calc'));
  [ui, pdf, pres].forEach(src => assert.ok(!/schema\.statusLabel\[q\.status\]/.test(src), 'no screen reads the old status label'));
  assert.ok(/calc\.replacementInfo\(/.test(ui) && /calc\.replacementInfo\(/.test(pdf) && /calc\.replacementInfo\(/.test(pres), 'every screen takes the replacement notes from the one function');
  assert.ok(/as\.slice\(0, -1\)\.forEach\(function \(f\) \{ log\.push\(\{ msg: 'Astute report ' \+ f\.name \+ ' was not read: a newer Astute report/.test(ui) && /return chain\(as\.slice\(-1\)/.test(ui), 'only the NEWEST Astute report of a load is read, the others are said to be skipped');
  assert.ok(!/c\.y \+ 13\.6/.test(pdf) && /noteRows\(e\)/.test(pdf) && /colSpan: 9/.test(pdf), 'the PDF prints a policy\'s red notes as a table row of their own (nothing drawn over the policy\'s text)');
  assert.ok(/\['uw', q\.counterOf \? 'Counter offer terms' : 'Underwriting and replacements'\]/.test(pres) && /if \(sub === 'uw'\) return out \+ extra;/.test(pres) && !/return out \+ uwView\(q\) \+ replView\(q\);/.test(pres), 'the Presentation gives the terms and the replacements a sub-tab of their own');
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no function name twice in ov-ui.js');
});
