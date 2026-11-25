/* Client Overview Studio 2.0 (25 November, Paul's decisions relayed by the Fix Skills chat at 17:20 after he approved the mock-ups): the menu is under FOUR headings (Where the client is now; Servicing quotes on a current policy; New business quotes;
   Investments & goals); five new servicing blocks (Servicing FNA, Servicing shortfall, Servicing reduced, Straight increase, Straight reduction), each quote tied to ONE current policy, with the old and the new side by side; Load from client folder sends a
   quote found in a policy folder to the matching servicing block (never to Comparative quotes); no line is ever added or removed by hand; a "+ Add ..." button at the bottom of every block; a schedule the Fact Find does not list is added and marked.
   Invented client only ("Test, Sia"); invented numbers (none of them is a real client's). Without a screen: t-overview-round200.js runs the screen, the PDF and the Presentation. */
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
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sia'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'BrightRock', spend: 'R 1 000.00', broker: 'Paul K' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } };
const fresh = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json'); return s; };
const L = (type, life, o) => store.newLine(type, Object.assign({ life: { lump: life, monthly: 0 }, sev: { lump: null }, lsd: { lump: null, monthly: null }, ip: { monthly: null } }, o || {}));
/* a BrightRock policy of ours with a household line and a debt, premium R1,000 (invented figures) */
function withPolicy(s) {
  const p = s.blocks.policies.items.filter(i => i.insurer === 'BrightRock')[0];
  p.policyNo = '900100200'; p.product = 'Personal covers'; p.premium = 1000; p.lines = [L('household', 500000), L('debt', 900000, { debt: 'Home loan', bank: 'Test Bank' })]; p.st = 'confirmed';
  return p;
}
const tieOf = p => ({ id: p.id, insurer: p.insurer, number: p.policyNo });
const SVLINES = [{ type: 'household', life: { lump: 700000, monthly: 0 }, abi: 5 }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 900000, monthly: 0 }, abi: 0 }, { type: 'debt', debt: 'Car finance', bank: 'Test Bank', life: { lump: 300000, monthly: 0 }, abi: 0 }];

test('the sixteen blocks sit under four headings in the order Paul gave; the five servicing blocks are quote blocks with their own kinds', () => {
  assert.deepStrictEqual(schema.GROUPS.map(g => g.id), ['now', 'servicing', 'newbiz', 'inv']);
  assert.deepStrictEqual(schema.GROUPS.map(g => g.title), ['Where the client is now', 'Servicing quotes (on a current policy)', 'New business quotes (new policy)', 'Investments & goals']);
  assert.deepStrictEqual(schema.GROUPS.map(g => g.pdf), ['Where you are now', 'Servicing your current policies', 'New business quotes', 'Investments & goals'], 'the client-facing words');
  assert.deepStrictEqual(schema.BLOCKS.map(b => b.group + ':' + b.id), ['now:policies', 'now:group', 'now:investments', 'now:other', 'now:shortfall', 'servicing:svFna', 'servicing:svShortfall', 'servicing:svReduced', 'servicing:svIncrease', 'servicing:svReduction',
    'newbiz:fna', 'newbiz:shortfallQuote', 'newbiz:reduced', 'newbiz:comparative', 'inv:proposed', 'inv:goals']);
  assert.deepStrictEqual(schema.BLOCKS.map(b => b.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepStrictEqual(schema.SV_KINDS, ['svfna', 'svshortfall', 'svreduced', 'svincrease', 'svreduction']);
  assert.deepStrictEqual(schema.QUOTE_KINDS, ['fna', 'shortfall', 'reduced', 'comparative', 'svfna', 'svshortfall', 'svreduced', 'svincrease', 'svreduction']);
  schema.SV_KINDS.forEach(k => { const b = schema.blocksById[schema.blockOfQuote[k]]; assert.ok(b.servicing && b.kind === 'quotes' && b.qkind === k && b.group === 'servicing' && /^Add .* quote$/.test(b.add), k); assert.ok(schema.isServicingKind(k) && schema.SV_MEANING[k], k + ' has its meaning'); });
  assert.ok(!schema.isServicingKind('fna') && !schema.isServicingKind('comparative'));
  assert.strictEqual(schema.blocksById.policies.add, 'Add policy schedule'); assert.strictEqual(schema.blocksById.proposed.add, 'Add proposal'); assert.strictEqual(schema.blocksById.goals.add, 'Add goal report');
  assert.deepStrictEqual(schema.BLOCKS.filter(b => b.id !== 'policies' && b.kind === 'quotes' && !b.servicing).map(b => b.add), ['Add FNA quote', 'Add shortfall quote', 'Add reduced quote', 'Add comparative quote']);
});

test('a servicing quote is tied to ONE current policy and says why; no Fact Find lines are started for it; the saved file keeps both and an older file opens', () => {
  const s = fresh(), p = withPolicy(s), q = store.addQuote(s, 'svincrease');
  assert.strictEqual(q.servicing, true); assert.strictEqual(q.onPolicy, null); assert.strictEqual(q.reason, ''); assert.deepStrictEqual(q.lines, [], 'its lines come from its document');
  assert.ok(store.addQuote(s, 'fna').lines.length > 0, 'a new business FNA still starts with the Fact Find\'s lines');
  assert.deepStrictEqual(store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', p.id), { id: p.id, insurer: 'BrightRock', number: '900100200' });
  assert.strictEqual(store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', 'nope'), null); assert.strictEqual(q.onPolicy, null, 'an unknown policy ties to nothing');
  assert.strictEqual(store.setOnPolicy(s, 'blocks.fna.quotes.0', p.id), null, 'only a servicing quote is tied to a policy');
  store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', p.id); store.setPath(s, 'blocks.svIncrease.quotes.0.reason', 'A car finance', 'text');
  const j = JSON.parse(store.toJSON(s));
  assert.deepStrictEqual(Object.keys(j.blocks).filter(k => /^sv/.test(k)), ['svFna', 'svShortfall', 'svReduced', 'svIncrease', 'svReduction']);
  assert.strictEqual(j.blocks.svIncrease.quotes[0].onPolicy.number, '900100200'); assert.strictEqual(j.blocks.svIncrease.quotes[0].reason, 'A car finance'); assert.strictEqual(j.blocks.svIncrease.quotes[0].kind, 'svincrease');
  const back = store.fromJSON(JSON.stringify(j)); assert.strictEqual(back.blocks.svIncrease.quotes[0].onPolicy.id, p.id); assert.strictEqual(back.blocks.svIncrease.quotes[0].reason, 'A car finance');
  const old = JSON.parse(JSON.stringify(j)); schema.SV_KINDS.forEach(k => delete old.blocks[schema.blockOfQuote[k]]); const o2 = store.fromJSON(JSON.stringify(old));
  assert.deepStrictEqual(schema.SV_KINDS.map(k => o2.blocks[schema.blockOfQuote[k]].quotes.length), [0, 0, 0, 0, 0], 'a file saved before 2.0 opens with the five blocks empty');
  const odd = JSON.parse(JSON.stringify(j)); odd.blocks.svIncrease.quotes[0].onPolicy = 'x'; odd.blocks.svIncrease.quotes[0].reason = 5; delete odd.blocks.svIncrease.quotes[0].kind;
  const o3 = store.fromJSON(JSON.stringify(odd)).blocks.svIncrease.quotes[0]; assert.strictEqual(o3.onPolicy, null); assert.strictEqual(o3.reason, ''); assert.strictEqual(o3.kind, 'svincrease', 'a hand-edited file cannot break the page');
});

test('what a servicing quote changes: line by line against the policy\'s own lines, the totals, the premium before and after and the difference', () => {
  const s = fresh(), p = withPolicy(s), q = store.addQuote(s, 'svincrease');
  q.lines = SVLINES.map(l => store.newLine(l.type, { debt: l.debt, bank: l.bank, life: Object.assign({ lump: null, monthly: 0 }, l.life) })); q.premium = 1450;
  assert.strictEqual(calc.servicingPolicy(s, q), null, 'not tied yet'); assert.deepStrictEqual(calc.servicingDiff(s, q).rows.map(r => r.status), ['added', 'added', 'added'], 'with no policy every line is new');
  store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', p.id);
  const d = calc.servicingDiff(s, q);
  assert.strictEqual(d.policy, p);
  assert.deepStrictEqual(d.rows.map(r => r.type + ':' + r.status + ':' + r.text), ['household:changed:Life cover +R200,000', 'debt:same:No change', 'debt:added:New']);
  assert.deepStrictEqual(d.premium, { now: 1000, next: 1450, diff: 450, pct: 45 }); assert.strictEqual(d.changed, 2);
  assert.strictEqual(d.totals.now.life.lump, 1400000); assert.strictEqual(d.totals.next.life.lump, 1900000); assert.strictEqual(d.totals.delta.life.lump, 500000);
  p.lines.push(L('child', 100000, { name: 'Ayo', sname: 'Test' }));                                                  // a line of the policy the quote no longer has
  const d2 = calc.servicingDiff(s, q); assert.deepStrictEqual(d2.rows.map(r => r.status), ['changed', 'same', 'added', 'removed']); assert.strictEqual(d2.rows[3].text, 'Removed');
  q.lines[1].removed = true; assert.ok(calc.servicingDiff(s, q).rows.some(r => r.type === 'debt' && r.debt === 'Home loan' && r.status === 'removed'), 'a quote line that is taken away shows the policy line as removed');
  p.premium = null; assert.deepStrictEqual(calc.servicingDiff(s, q).premium, { now: null, next: 1450, diff: null, pct: null }, 'a premium the schedule does not give makes no difference up');
  const t = store.addQuote(s, 'svreduction'); t.premium = 800; t.lines = [store.newLine('household', { life: { lump: 300000, monthly: 0 } })]; store.setOnPolicy(s, 'blocks.svReduction.quotes.0', p.id); p.premium = 1000;
  assert.strictEqual(calc.servicingDiff(s, t).premium.diff, -200); assert.strictEqual(calc.servicingDiff(s, t).rows[0].text, 'Life cover −R200,000');
});

test('a servicing quote never becomes a second policy, a second acceptance, a replacement or the shortfall\'s need', () => {
  const s = fresh(), p = withPolicy(s), n0 = calc.policies(s).length;
  const f = store.addQuote(s, 'fna'); f.number = '100000001'; f.lines = [store.newLine('household', { life: { lump: 800000, monthly: 0 } })]; f.status = 'accepted'; f.uw = 'standard';
  const q = store.addQuote(s, 'svfna'); q.number = '100000002'; q.status = 'accepted'; q.uw = 'standard'; q.policyNo = 'S-1'; q.startDate = '01/02/2027'; store.setOnPolicy(s, 'blocks.svFna.quotes.0', p.id);
  assert.strictEqual(calc.policies(s).length, n0, 'an accepted servicing quote with a policy number and a start date changes its policy: it is not listed as a new policy');
  assert.deepStrictEqual(calc.acceptanceConflicts(s), [], 'one FNA accepted and one servicing FNA accepted: no second acceptance');
  assert.strictEqual(calc.acceptedQuotes(s).length, 1);
  q.repl = { answer: 'yes', policies: [p.id] }; assert.strictEqual(calc.replacementInfo(s).by[p.id], undefined, 'a servicing quote replaces nothing');
  s.blocks.fna.quotes = []; const t = calc.shortfall(s); assert.strictEqual(t.has, false, 'the servicing FNA is not the need');
  assert.ok(!check.run(s).problems.some(x => x.id === 'accept.second'));
});

test('a servicing page is there only when it holds a quote; the other pages keep their rules; an untied quote is a check', () => {
  const s = fresh(), p = withPolicy(s);
  schema.SV_KINDS.forEach(k => assert.strictEqual(calc.pageShown(s, schema.blockOfQuote[k]), false, k + ' left out while empty'));
  const q = store.addQuote(s, 'svreduced'); q.number = '200000001'; q.lines = [store.newLine('household', { life: { lump: 400000, monthly: 0 } })];
  assert.strictEqual(calc.pageShown(s, 'svReduced'), true); assert.strictEqual(calc.pageShown(s, 'svIncrease'), false);
  assert.ok(/Left out/.test(calc.pageWhy('svFna')));
  const probs = () => check.run(s).problems.filter(x => x.id === 'sv.policy');
  assert.strictEqual(probs().length, 1); assert.strictEqual(probs()[0].block, 'svReduced'); assert.ok(/ONE current policy/.test(probs()[0].message));
  store.setOnPolicy(s, 'blocks.svReduced.quotes.0', p.id); assert.strictEqual(probs().length, 0, 'tied: the check goes');
  p.removed = true; assert.strictEqual(probs().length, 1, 'the policy is gone from Current policies'); assert.ok(/is not in Current policies/.test(probs()[0].message));
  assert.strictEqual(check.dots(s, [], {}).svIncrease, 'grey'); assert.ok(['amber', 'green'].indexOf(check.run(s).dots.svReduced) >= 0);
  assert.strictEqual(check.qTitle(q), 'BrightRock Servicing Reduced Quote CP 200000001'); assert.strictEqual(check.qLabel(store.addQuote(s, 'svincrease')), 'BrightRock straight increase');
});

test('a quote in a LIFE policy folder is a servicing quote (never a comparative quote); the words that say which; paperwork, investment folders and the client\'s own folders are left alone', () => {
  const PF = 'BR Personal Covers - 900100200', RV = PF + ' \\ Comparative Quotes \\ 2026 - Review', CQ = PF + ' \\ Comparative Quotes', cls = (n, d) => docs.classify(n, d);
  const T = [['BR Serv Quote - 123456789 - R1450.00 - 17.10.26.pdf', RV, 'svIncrease', true], ['BR Serv Quote - 123456789.pdf', CQ, 'svIncrease', true], ['Servicing quote 123456789.pdf', CQ, 'svIncrease', true], ['Alteration quote 123456789.pdf', CQ, 'svIncrease', true],
    ['Increase Quote 123456789.pdf', RV, 'svIncrease', false], ['Decrease quote 123456789.pdf', RV, 'svReduction', false], ['Premium reduction quote 123456789.pdf', CQ, 'svReduction', false],
    ['FNA Quote 123456789.pdf', CQ, 'svFna', false], ['Shortfall quote 22.pdf', RV, 'svShortfall', false], ['Reduced quote CP 111222333.pdf', RV, 'svReduced', false],
    ['Discovery quote 123456789.pdf', CQ, 'comparative', false],
    ['FNA quote 123456789.pdf', '3. Quotes', 'fna', false], ['Shortfall quote 22.pdf', '3. Quotes', 'shortfallQuote', false], ['Reduced quote 22.pdf', '3. Quotes\\2026', 'reduced', false],
    ['FNA quote 123456789.pdf', 'Invest - 555 \\ Comparative Quotes', 'fna', false]];
  T.forEach(([n, d, b, bare]) => { const c = cls(n, d); assert.ok(c, n); assert.strictEqual(c.block, b, n + ' in ' + d); assert.strictEqual(!!c.bare, bare, n + ' bare'); });
  ['Serv Quote signed 123456789.pdf', 'Premium increase letter.pdf', 'Servicing SROA 123456789.pdf', 'Serv quote accepted 123456789.pdf'].forEach(n => { const c = cls(n, RV); assert.ok(!c || !schema.blocksById[c.block] || !schema.blocksById[c.block].servicing, n + ' is paperwork, not a servicing quote'); });
  assert.strictEqual(cls('Serv quote 123456789.pdf', 'Invest - 555 \\ Comparative Quotes'), null, 'an investment policy folder has no servicing block');
  assert.strictEqual(cls('Serv quote 123456789.pdf', '3. Quotes'), null, 'the client\'s own numbered folder is not a policy folder');
  assert.strictEqual(cls('Increase 2026.pdf', CQ), null, 'no quote word and no number: not taken for a quote');
  const DEAL = 'Docs, Dina - (Risk Covers) \\ Comparative Quotes';
  assert.strictEqual(cls('BR FNA - 100000011 - R2900.00 - 19.11.26.pdf', DEAL).block, 'fna', 'an older deal-style folder names no policy number: its FNA quote stays a new business FNA quote (a servicing quote is about ONE named policy)');
  assert.strictEqual(cls('Serv quote 123456789.pdf', DEAL), null, 'and a Serv quote there is not routed anywhere');
  ['svFna', 'svShortfall', 'svReduced', 'svIncrease', 'svReduction'].forEach(b => { assert.ok(docs.QUOTE_OF[b] && docs.SPEC_OF[b] === 'quote' && docs.BLOCK_LABEL[b], b + ' is read as a quote'); });
});

test('a bare Serv quote is a straight increase when its premium is above the policy\'s and a straight reduction when below; the same number is one quote wherever it landed; the tie is kept on a second reading', () => {
  const s = fresh(), p = withPolicy(s), tie = tieOf(p), LINE = SVLINES[0];
  const put = (n, prem, o) => docs.applyQuote(s, 'svIncrease', { insurer: 'BrightRock', number: n, date: '17/10/2026', premium: prem, lines: [LINE] }, 'BR Serv ' + n + '.pdf', Object.assign({ onPolicy: tie, bare: true }, o || {}));
  const up = put('111222333', 1400), down = put('111222444', 800), same = put('111222555', 1000);
  assert.strictEqual(up.quote.kind, 'svincrease'); assert.ok(s.blocks.svIncrease.quotes.indexOf(up.quote) >= 0);
  assert.strictEqual(down.quote.kind, 'svreduction'); assert.ok(s.blocks.svReduction.quotes.indexOf(down.quote) >= 0 && s.blocks.svIncrease.quotes.indexOf(down.quote) < 0, 'placed by its premium');
  assert.strictEqual(same.quote.kind, 'svincrease'); assert.strictEqual(same.unsure, true, 'the same premium cannot tell: it goes under increase and says so');
  assert.deepStrictEqual(up.quote.onPolicy, { id: p.id, insurer: 'BrightRock', number: '900100200' }); assert.strictEqual(up.quote.servicing, true); assert.deepStrictEqual(up.quote.lines.length, 1);
  const forced = docs.applyQuote(s, 'svReduction', { insurer: 'BrightRock', number: '111222666', premium: 5000, lines: [LINE] }, 'x.pdf', { onPolicy: tie });
  assert.strictEqual(forced.quote.kind, 'svreduction', 'a block the adviser chose is respected whatever the premium');
  assert.strictEqual(docs.quoteIn(s, 'svIncrease', '111222444'), down.quote, 'the number is found in any servicing block'); assert.strictEqual(docs.quoteIn(s, 'fna', '111222444'), null);
  down.quote.reason = 'Budget cut'; down.quote.status = 'accepted';
  const again = put('111222444', 800); assert.strictEqual(again.merged, 'again'); assert.strictEqual(s.blocks.svReduction.quotes.filter(q => !q.removed).length, 2, 'still one quote with that number');
  const live = s.blocks.svReduction.quotes.filter(q => q.number === '111222444')[0]; assert.strictEqual(live.reason, 'Budget cut'); assert.strictEqual(live.status, 'accepted'); assert.strictEqual(live.onPolicy.id, p.id);
  const nameOnly = docs.applyQuote(s, 'svIncrease', { number: '111222777', date: '17/10/2026' }, 'BR Serv 111222777.pdf', { nameOnly: true, onPolicy: tie, bare: true });
  assert.strictEqual(nameOnly.quote.kind, 'svincrease'); assert.strictEqual(nameOnly.unsure, true, 'read by name only: the premium is not known, so it cannot be told');
});

test('the tie from the folder is by the policy NUMBER in its name (found when its schedule is read), never by "the only policy of that insurer"; Replace quote keeps the tie and the reason', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/if \(!key \|\| key\.length < 5\) return null;/.test(ui) && /: \{ id: null, insurer: pf\.insurerName \|\| '', number: pf\.number \}/.test(ui) && !/same\.length === 1/.test(ui.slice(ui.indexOf('function policyOfFile'), ui.indexOf('function put(file'))), 'by number only');
  const s = fresh(), p = withPolicy(s), tied = docs.applyQuote(s, 'svIncrease', { insurer: 'BrightRock', number: '111222333', premium: 1400, lines: [SVLINES[0]] }, 'a.pdf', { onPolicy: { id: null, insurer: 'BrightRock', number: '900100200' } }).quote;
  assert.deepStrictEqual(tied.onPolicy, { id: null, insurer: 'BrightRock', number: '900100200' }); assert.strictEqual(calc.servicingPolicy(s, tied), p, 'found by number although the quote holds no policy id');
  assert.strictEqual(docs.applyQuote(s, 'svIncrease', { insurer: 'BrightRock', number: '111222334', premium: 1400, lines: [SVLINES[0]] }, 'b.pdf', { onPolicy: { id: null, insurer: 'BrightRock', number: '555666777' } }).quote.onPolicy.number, '555666777');
  assert.strictEqual(calc.servicingPolicy(s, s.blocks.svIncrease.quotes[1]), null, 'another policy number: tied to no policy of ours, so the table is not drawn against the wrong schedule');
  tied.reason = 'Budget cut'; const r = docs.applyQuote(s, 'svIncrease', { insurer: 'BrightRock', number: '111222999', premium: 1500, lines: [SVLINES[0]] }, 'c.pdf', { replaces: tied.id });
  assert.deepStrictEqual(r.quote.onPolicy, tied.onPolicy, 'Replace quote keeps the policy'); assert.strictEqual(r.quote.reason, 'Budget cut', 'and the reason'); assert.ok(tied.removed && tied.replacedBy === r.quote.id);
  const own = docs.applyQuote(s, 'svIncrease', { insurer: 'BrightRock', number: '111222998', premium: 1500, lines: [SVLINES[0]] }, 'd.pdf', { replaces: r.quote.id, onPolicy: { id: p.id, insurer: 'BrightRock', number: '900100200' } });
  assert.strictEqual(own.quote.onPolicy.id, p.id, 'a policy the new file says is used');
  const sel = ui.slice(ui.indexOf('function svPolicySel'), ui.indexOf('function svCell')); assert.ok(/calc\.servicingPolicy\(state, q\)/.test(sel), 'the policy box shows the policy found by number');
});

test('the Type of servicing moves a quote (and its counter offers) to the block of the new type; "Not requested" stands under an empty servicing block and is never red; the menu counts the quotes', () => {
  const s = fresh(), p = withPolicy(s), q = store.addQuote(s, 'svincrease'); q.number = '200000001'; store.setOnPolicy(s, 'blocks.svIncrease.quotes.0', p.id); q.reason = 'Budget cut';
  const c = store.addQuote(s, 'svincrease'); c.number = '200000002'; c.counterOf = q.id;
  assert.strictEqual(store.setServicingType(s, 'blocks.svIncrease.quotes.0', 'svreduction'), q);
  assert.strictEqual(q.kind, 'svreduction'); assert.strictEqual(c.kind, 'svreduction', 'the counter offer goes with its quote'); assert.deepStrictEqual([s.blocks.svIncrease.quotes.length, s.blocks.svReduction.quotes.length], [0, 2]);
  assert.strictEqual(q.onPolicy.number, '900100200'); assert.strictEqual(q.reason, 'Budget cut'); assert.strictEqual(calc.parentOf(s, c), q);
  assert.strictEqual(store.setServicingType(s, 'blocks.svReduction.quotes.1', 'svfna'), null, 'a counter offer follows its quote'); assert.strictEqual(store.setServicingType(s, 'blocks.svReduction.quotes.0', 'fna'), null, 'only the five servicing types'); assert.strictEqual(store.setServicingType(s, 'blocks.svReduction.quotes.0', 'svreduction'), q);
  assert.strictEqual(store.setServicingType(s, 'blocks.policies.items.0', 'svfna'), null);
  const n = check.emptyNotes(s, { ran: true, done: { svFna: true, svIncrease: true, svReduction: true } });
  assert.deepStrictEqual(n.svFna, { text: 'Not requested', all: false, kind: 'na' }); assert.deepStrictEqual(n.svIncrease, { text: 'Not requested', all: false, kind: 'na' }); assert.strictEqual(n.svReduction, undefined);
  assert.notStrictEqual(check.run(s, { ran: true, done: { svFna: true } }).dots.svFna, 'red', 'an empty servicing block is grey, not red');
  const ui = app('js/ov-ui.js');
  assert.ok(/function svTypeSel\(/.test(ui) && /data-svtype=/.test(ui) && /store\.setServicingType\(state, svt, el\.value\)/.test(ui) && /class="cnt"/.test(ui) && /Lines come from the document only: to change a line, replace the document\./.test(ui), 'the screen: the Type of servicing box, the quote count in the menu, the note under the lines');
});

test('a schedule the Fact Find does not list is added and marked; when the Fact Find gets the policy it joins that row (no copy)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/!item && block === 'policies' && data/.test(ui) && /notInFF: true/.test(ui) && /D\.applyPolicy\(state, item, data, name\)/.test(ui) && /Not in the Fact Find - add it there too/.test(ui), 'put() adds it, applies the schedule and says so');
  assert.ok(/it\.notInFF \? '<b class="rednote">Not in the Fact Find - add it there too<\/b>/.test(ui), 'the policy row carries the red mark');
  const s = fresh(); store.addItem(s, 'policies', { id: 'sch-1', ffKey: null, notInFF: true, wr: true, insurer: 'Hollard', product: 'Life plan', policyNo: 'H-1', premium: 300, lines: [], st: 'verify', src: null, by: 'page', removed: false });
  const before = s.blocks.policies.items.length, J = JSON.parse(JSON.stringify(FFJ)); J.l.risk.push({ d: { prov: 'Hollard', spend: 'R 320.00', broker: 'Paul K' } });
  store.fillFromFactFind(s, JSON.stringify(J), 'ff2.json');
  const hol = s.blocks.policies.items.filter(i => i.insurer === 'Hollard');
  assert.strictEqual(hol.length, 1, 'no second Hollard row'); assert.strictEqual(hol[0].id, 'sch-1'); assert.ok(hol[0].ffKey && !hol[0].notInFF, 'it is the Fact Find\'s row now'); assert.strictEqual(hol[0].premium, 300, 'what the schedule said is kept'); assert.strictEqual(hol[0].policyNo, 'H-1');
  assert.strictEqual(s.blocks.policies.items.length, before, 'the Fact Find added nothing');
});

test('the screen: four headings in the menu, a servicing card with the policy box and the old-and-new table, no line buttons and no x on a line, "+ Add ..." at the bottom of every block', () => {
  const ui = app('js/ov-ui.js'), css = app('css/overview.css');
  assert.ok(/schema\.GROUPS\.map\(function \(g\)/.test(ui) && /class="sep grp" data-group=/.test(ui), 'the menu is drawn group by group');
  assert.ok(!/data-addl|class="xbtn"|c-x"|\+ A benefit|type in by hand<\/button> <button/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')), 'no add-line button, no x on a line');
  assert.ok(!/Kind of quote/.test(ui), 'the Servicing / New business selector is gone: the block says it');
  assert.ok(/data-svpol=/.test(ui) && /store\.setOnPolicy\(state, svp, el\.value\)/.test(ui) && /function svPolicySel\(/.test(ui), 'the policy box');
  assert.ok(/function svDiffHTML\(/.test(ui) && /data-comp="svdiff\|/.test(ui) && /name === 'svdiff'/.test(ui), 'the table is drawn from calc.servicingDiff and redrawn as figures are typed');
  assert.ok(/>\+ ' \+ esc\(b\.add \|\| 'Add quote'\)/.test(ui) && /\+ Add policy schedule&hellip;/.test(ui) && /\+ Add proposal&hellip;/.test(ui) && /\+ Add goal report&hellip;/.test(ui), 'the buttons at the bottom of the blocks');
  assert.ok(/if \(calc\.isServicing\(q\)\) return q\.counterOf \? counterBlock\(q, p\) \+ termsBlock\(q, p\) : termsBlock\(q, p\) \+ counterList\(q, p\)/.test(ui), 'no replacement question and no one-acceptance warning on a servicing quote');
  assert.ok(/CLIENT_KIND = \{[^}]*policies: 'schedule'[^}]*svIncrease: 'comparative'/.test(ui), 'the file window opens in the right folder');
  assert.ok(/\.ovt\.svt/.test(css) && /\.nav \.sep\.grp/.test(css));
  assert.ok(/schedule: \[/.test(app('js/folders.js')), 'the Policy Schedules folder is found for + Add policy schedule');
});

test('the PDF and the Presentation put the pages and tabs under the same four headings, in the same order, and carry the servicing quote', () => {
  const pdf = app('js/ov-pdf.js'), pr = app('js/ov-present.js');
  assert.ok(/function servicingPart\(doc, y, state, q\)/.test(pdf) && /calc\.servicingDiff\(state, q\)/.test(pdf) && /if \(sv\) y = servicingPart\(doc, y, state, q\)/.test(pdf) && /if \(!sv\) y = replLines/.test(pdf));
  assert.ok(/schema\.groupsById\[g\]\.pdf/.test(pdf) && /pages\.tabs/.test(pdf), 'headings over the tabs of the PDF');
  assert.ok(/function svView\(q\)/.test(pr) && /calc\.servicingDiff\(state\(\), q\)/.test(pr) && /What changes on your policy/.test(pr) && /schema\.GROUPS\.map\(function \(g\)/.test(pr) && /class=\"ptg\"/.test(pr), 'the Presentation draws the headings and the servicing table');
  assert.deepStrictEqual(pres.TABS.filter(t => t.group).map(t => t.group).filter((g, i, a) => a.indexOf(g) === i), ['now', 'servicing', 'newbiz', 'inv'], 'the tabs follow the four headings in order');
  pres.TABS.forEach(t => t.blocks.forEach(b => { if (b !== 'map') assert.strictEqual(schema.blocksById[b].group, t.group, b + ' sits in the tab\'s own group'); }));
  const s = fresh(), p = withPolicy(s), q = store.addQuote(s, 'svincrease'); q.lines = [store.newLine('household', { life: { lump: 1, monthly: 0 } })];
  assert.strictEqual(pres.hasContent(s, 'svIncrease'), true); assert.strictEqual(pres.hasContent(s, 'svFna'), false); assert.strictEqual(pres.tabOn(s, 'servicing'), true); assert.strictEqual(pres.firstBlock(s, 'servicing'), 'svIncrease');
  const q2 = store.addQuote(s, 'svreduction'); q2.lines = q.lines.slice(); assert.deepStrictEqual(pres.tabBlocks(s, 'svIncrease'), ['svIncrease', 'svReduction'], 'two servicing blocks, one tab, a button for each');
  assert.ok(pres.ORDER.indexOf('svIncrease') > pres.ORDER.indexOf('shortfall') && pres.ORDER.indexOf('svReduction') < pres.ORDER.indexOf('fna'), 'between the shortfall and the new business quotes (next and back follow it)');
  assert.ok(pres.shownOrder(s).indexOf('svIncrease') > pres.shownOrder(s).indexOf('policies') && pres.shownOrder(s).indexOf('svReduction') > pres.shownOrder(s).indexOf('svIncrease'), 'and the ones that can be opened keep that order');
});

test('the page is 2.0 (the layout stays 0.1), the contract says revision p with the new keys, the changed scripts carry new tags', () => {
  assert.strictEqual(schema.pageVersion, '2.0'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('1.9'), 'compared as decimals');
  const html = app('overview.html');
  ['ov-schema', 'ov-calc', 'ov-store', 'ov-check', 'ov-docs', 'ov-pdf', 'ov-pres', 'ov-ui', 'ov-present', 'folders'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261125[a-z]').test(html), f));
  ['overview', 'present'].forEach(f => assert.ok(new RegExp('css/' + f + '\\.css\\?v=20261125[a-z]').test(html), f + '.css'));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders\.js\?v=20261125[a-z]/.test(app(f)), f));
  const contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8');
  assert.ok(/revision p/i.test(contract) && /onPolicy/.test(contract) && /svincrease/.test(contract) && /svIncrease/.test(contract), 'revision p lists the new keys');
});
