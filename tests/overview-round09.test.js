/* Client Overview Studio 0.9 (23 November, Paul's round after he used 0.8 on a real client): every block checks and reports (red dot, a comment under the block's name), a policy of another insurer is ONE row with its benefits
   (only a BrightRock policy has the need-by-need lines), a quote is kept ONCE (the same number), the change moment pay-out table has no x and no "+ A child row", and every table is rounded. Invented client only ("Test Client"). */
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

const FFJ = (l, f) => ({ app: 'wr-fact-find', schema: '5.4', f: Object.assign({ fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } }, f || {}), l: l || {} });
const withFF = (l, f) => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ(l, f)), 'ff.json'); return s; };
const FULL = { risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }] };

/* ---------- 1. every block checks and reports ---------- */
test('a Fact Find with nothing in it: every block that follows it is checked and says so, red', () => {
  const s = withFF({}), r = check.run(s);
  assert.strictEqual(r.dots.policies, 'red'); assert.strictEqual(r.notes.policies.text, 'No current policies');
  assert.strictEqual(r.dots.group, 'red'); assert.strictEqual(r.notes.group.text, 'No group benefits and no personal investments');
  assert.strictEqual(r.dots.comparative, 'red'); assert.strictEqual(r.notes.comparative.text, 'No comparative quotes');
  assert.strictEqual(r.dots.investments, 'red'); assert.strictEqual(r.notes.investments.text, 'No current investments');
  assert.strictEqual(r.dots.proposed, 'red'); assert.strictEqual(r.notes.proposed.text, 'No proposed investments');
  assert.strictEqual(r.dots.goals, 'red'); assert.strictEqual(r.notes.goals.text, 'No goal analysis requested');
  assert.strictEqual(r.dots.other, 'red'); assert.match(r.notes.other.text, /medical aid/i);
  assert.strictEqual(r.dots.shortfallQuote, 'na', 'no group risk: not needed (dashed), and it says why'); assert.match(r.notes.shortfallQuote.text, /no group risk/);
  assert.strictEqual(r.dots.fna, 'grey', 'the FNA is a document: grey until the page has looked through a folder'); assert.ok(!r.notes.fna); assert.strictEqual(r.dots.reduced, 'grey');
  assert.strictEqual(r.dots.shortfall, 'grey', 'the shortfall is worked out from the FNA: it has no "nothing there" of its own');
});

test('the document blocks (FNA, reduced quotes) are red only after the page has looked: a folder load or a check', () => {
  const s = withFF({}), r = check.run(s, { ran: true });
  assert.strictEqual(r.dots.fna, 'red'); assert.strictEqual(r.notes.fna.text, 'No FNA quote found'); assert.strictEqual(r.dots.reduced, 'red'); assert.strictEqual(r.notes.reduced.text, 'No reduced quotes found');
  const q = store.addQuote(s, 'fna'); q.number = '100000001'; assert.strictEqual(check.run(s, { ran: true }).dots.fna, 'grey', 'a quote is there: waiting for its figures, not red');
});

test('nothing is red before anything was read: a new overview is all grey, with no comments', () => {
  const r = check.run(store.blank());
  schema.BLOCKS.forEach(b => assert.notStrictEqual(r.dots[b.id], 'red', b.id)); assert.deepStrictEqual(Object.keys(r.notes), []);
});

test('a block that holds something is not red: policies, investments, group benefits, a requested goal report', () => {
  const s = withFF(FULL, { rgar_req: { v: 'Request a report' } }), r = check.run(s);
  assert.notStrictEqual(r.dots.policies, 'red'); assert.notStrictEqual(r.dots.investments, 'red'); assert.notStrictEqual(r.dots.group, 'red'); assert.notStrictEqual(r.dots.goals, 'red');
  assert.ok(!r.notes.policies && !r.notes.investments && !r.notes.group && !r.notes.goals, 'no comment');
});

test('group benefits and personal investments: one of the two missing has the comment but keeps its own dot', () => {
  const noInv = withFF({ grp: FULL.grp }), r1 = check.run(noInv);
  assert.strictEqual(r1.notes.group.text, 'No personal investments'); assert.notStrictEqual(r1.dots.group, 'red');
  const noGrp = withFF({ ret_ra: FULL.ret_ra }), r2 = check.run(noGrp);
  assert.strictEqual(r2.notes.group.text, 'No group benefits'); assert.notStrictEqual(r2.dots.group, 'red');
});

test('the shortfall quote: group risk but none asked for in the Fact Find is red; asked for, it waits; no group risk is dashed', () => {
  const s = withFF({ grp: FULL.grp }); let r = check.run(s);
  assert.strictEqual(r.dots.shortfallQuote, 'red'); assert.strictEqual(r.notes.shortfallQuote.text, 'No shortfall quote requested');
  s.factFind.facts.asked.sf = true; r = check.run(s); assert.strictEqual(r.dots.shortfallQuote, 'grey'); assert.ok(!r.notes.shortfallQuote, 'asked for: it is waiting for the document');
  assert.strictEqual(check.run(s, { ran: true }).dots.shortfallQuote, 'red', 'asked for and the page has looked: none found'); assert.match(check.run(s, { ran: true }).notes.shortfallQuote.text, /No shortfall quote found/);
});

test('comparative quotes: asked for in the Fact Find they wait; not asked they are red', () => {
  const s = withFF({ raq: [] }, { fna_req: { v: 'Request a quote' } });
  assert.strictEqual(check.run(s).dots.comparative, 'grey', 'the Fact Find asked for a comparative quote (the standard lane)');
  assert.strictEqual(check.run(s, { ran: true }).notes.comparative.text, 'No comparative quote found');
  assert.strictEqual(check.run(withFF({})).notes.comparative.text, 'No comparative quotes');
});

test('the red dot: the legend, the hover text, and the dot is not shown for a block that has rows', () => {
  assert.deepStrictEqual(check.LEGEND.map(l => l[0]), ['grey', 'amber', 'green', 'red', 'na']); assert.strictEqual(check.LEGEND[3][1], 'Checked, nothing there');
  assert.strictEqual(check.dotText(null, 'proposed', 'red', [], { text: 'No proposed investments' }), 'Checked, nothing there: No proposed investments.');
  const s = withFF({}); s.blocks.proposed.items.push(store.newProposed()); assert.notStrictEqual(check.run(s).dots.proposed, 'red', 'a proposed investment is there');
  const h = app('overview.html'); assert.ok(/id="btnCheck"/.test(h) && /Check all blocks/.test(h));
  assert.ok(/\.dot\.red \{/.test(app('css/overview.css')) && /small\.navnote\.red/.test(app('css/overview.css')));
  const ui = app('js/ov-ui.js'); assert.ok(/Red: checked, nothing there/.test(ui) && /function checkPass\(/.test(ui) && /data-note="/.test(ui) && /status: 'checking'|st: 'checking'/.test(ui));
});

/* ---------- 2. a policy of another insurer is one row ---------- */
const LINES = [
  { type: 'household', label: 'Household needs', life: { lump: 500000, monthly: 0 }, sev: { lump: 100000 }, lsd: { lump: 200000, monthly: null }, ip: { monthly: 15000 }, term: 'To age 65', waiting: '1 month', abi: 5 },
  { type: 'child', label: 'Child care', name: 'Amy', sname: 'Client', life: { lump: 300000 }, sev: { lump: null }, lsd: { lump: null }, ip: { monthly: null }, term: 'Age 24', abi: 5 },
  { type: 'debt', label: 'Debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1000000, monthly: 12000 }, sev: { lump: null }, lsd: { lump: 400000 }, ip: { monthly: 12000 } }
];
const libertyItem = () => withFF(FULL).blocks.policies.items[0];

test('a Liberty schedule that came back with household, child and debt lines is ONE "other" line with the benefits added up', () => {
  const s = withFF(FULL), it = s.blocks.policies.items[0];
  docs.applyPolicy(s, it, { insurer: 'Liberty', product: 'Test Life Plan', policyNo: 'L-1', premium: 900, lines: LINES }, 'liberty.pdf');
  const lines = calc.activeLines(it); assert.strictEqual(lines.length, 1, 'one row with its benefits'); const l = lines[0];
  assert.strictEqual(l.type, 'other'); assert.strictEqual(l.label, 'Test Life Plan');
  assert.strictEqual(l.life.lump, 1800000); assert.strictEqual(l.sev.lump, 100000); assert.strictEqual(l.lsd.lump, 600000); assert.strictEqual(l.ip.monthly, 27000);
  assert.strictEqual(l.term, 'To age 65'); assert.strictEqual(l.waiting, '1 month'); assert.strictEqual(l.abi, 5); assert.strictEqual(l.st, 'verify');
  const t = calc.totals(it); assert.strictEqual(t.life.lump, 1800000, 'the totals of the policy do not change when its lines are put in one row'); assert.strictEqual(t.ip.monthly, 27000);
  assert.ok(!lines.some(x => /household|child|debt/.test(x.type)), 'no need-by-need line on a policy that is not BrightRock');
});

test('a BrightRock policy keeps its need-by-need lines; a policy with no insurer yet is left alone', () => {
  const s = withFF(FULL), it = s.blocks.policies.items[0];
  docs.applyPolicy(s, it, { insurer: 'BrightRock', product: 'Life', policyNo: 'B-1', premium: 900, lines: LINES }, 'br.pdf');
  assert.deepStrictEqual(calc.activeLines(it).map(l => l.type), ['household', 'child', 'debt']);
  const bare = { insurer: '', lines: LINES.map(l => store.newLine(l.type, l)) }; assert.strictEqual(store.flattenPolicyLines(bare), false); assert.strictEqual(bare.lines.length, 3);
  assert.strictEqual(store.flattenPolicyLines({ insurer: 'Liberty', lines: [store.newLine('other', { label: 'Life cover' })] }), false, 'an "other" line is already a benefit');
});

test('real "other" lines stay as they are; need lines next to them join ONE line; a removed line is not added in', () => {
  const it = { insurer: 'Discovery', product: 'Test Plan', lines: [store.newLine('other', { label: 'Life cover', life: { lump: 1000000, monthly: null } }), store.newLine('household', { life: { lump: 50000, monthly: null } }), store.newLine('debt', { life: { lump: 70000, monthly: null }, removed: true })] };
  assert.strictEqual(store.flattenPolicyLines(it), true);
  const live = it.lines.filter(l => !l.removed); assert.strictEqual(live.length, 2); assert.deepStrictEqual(live.map(l => l.type), ['other', 'other']);
  assert.strictEqual(live[1].life.lump, 50000, 'the removed debt line is not counted');
});

test('opening a saved file with a Liberty policy that holds need lines puts it in one row (and says how many)', () => {
  const s = withFF(FULL), it = s.blocks.policies.items[0]; it.insurer = 'Liberty'; it.lines = LINES.map(l => store.newLine(l.type, Object.assign({ st: 'verify', by: 'page' }, l)));
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.flattened, 1); assert.strictEqual(calc.activeLines(back.blocks.policies.items[0]).length, 1);
  assert.strictEqual(calc.totals(back.blocks.policies.items[0]).life.lump, 1800000);
  assert.ok(!('flattened' in JSON.parse(store.toJSON(back))) && !('dups' in JSON.parse(store.toJSON(back))), 'the notes are not saved');
});

test('the reading is told: the need-by-need lines are for BrightRock only; every other insurer is ONE line', () => {
  const p = docs.promptFor('policies');
  assert.match(p, /ONLY to a BrightRock policy/); assert.match(p, /exactly ONE line of type "other"/); assert.match(p, /NEVER use the types household, child, debt, death or dread for a policy that is not BrightRock/);
});

test('the screen: a policy of another insurer is "Benefits" with only "+ A benefit"; a BrightRock policy keeps its needs and their buttons', () => {
  const ui = app('js/ov-ui.js');
  assert.match(ui, /flat = isPolicy && !!String\(c\.insurer \|\| ''\)\.trim\(\) && !store\.isBright\(c\.insurer\)/); assert.match(ui, /flat \? 'Benefits' : 'Need'/); assert.match(ui, /flat \? \['other'\]/); assert.match(ui, /flat \? 'A benefit'/);
});

/* ---------- 3. a quote once ---------- */
const READ = (n, extra) => Object.assign({ insurer: 'BrightRock', number: n, date: '19/11/2026', rates: 'Smoker rates', aci: 10, premium: 1500, lines: [{ type: 'household', life: { lump: 800000, monthly: 20000 }, abi: 5 }] }, extra || {});

test('the same quote read twice is ONE quote: the second reading goes into the first (its status, policy number and pay-out are kept)', () => {
  const s = withFF({}); const a = docs.applyQuote(s, 'fna', READ('100000031'), 'FNA 100000031.pdf');
  a.quote.status = 'accepted'; a.quote.policyNo = 'P-1'; a.quote.cmp = { number: '100000031', rows: [], st: 'verify' };
  const b = docs.applyQuote(s, 'fna', READ('CP 100000031', { premium: 1600 }), 'FNA 100000031 (copy).pdf');
  assert.strictEqual(s.blocks.fna.quotes.length, 1, 'one quote, never two'); assert.strictEqual(b.quote, a.quote); assert.strictEqual(b.merged, 'again');
  const q = s.blocks.fna.quotes[0]; assert.strictEqual(q.id, a.quote.id); assert.strictEqual(q.premium, 1600, 'the second reading is what is shown'); assert.strictEqual(q.status, 'accepted'); assert.strictEqual(q.policyNo, 'P-1'); assert.ok(q.cmp, 'the pay-out is kept');
  assert.strictEqual(q.removed, false); assert.strictEqual(q.st, 'verify'); assert.strictEqual(q.src.file, 'FNA 100000031 (copy).pdf');
});

test('only a name and a number never replaces a quote that was read; and a different number or another block is a different quote', () => {
  const s = withFF({}); docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf');
  const nm = docs.applyQuote(s, 'fna', { number: '100000031', date: '19/11/2026' }, 'a.pdf', { nameOnly: true });
  assert.strictEqual(nm.merged, 'kept'); assert.strictEqual(s.blocks.fna.quotes.length, 1); assert.strictEqual(calc.activeLines(s.blocks.fna.quotes[0])[0].life.lump, 800000);
  docs.applyQuote(s, 'fna', READ('100000041'), 'b.pdf'); assert.strictEqual(s.blocks.fna.quotes.length, 2, 'another number: another quote');
  docs.applyQuote(s, 'reduced', READ('100000041'), 'b.pdf'); assert.strictEqual(s.blocks.reduced.quotes.length, 1, 'the same number in another block is a quote of that block');
});

test('Replace quote still replaces: the old one is removed and linked, the new one is a new quote', () => {
  const s = withFF({}); const a = docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf');
  const b = docs.applyQuote(s, 'fna', READ('100000031', { premium: 1700 }), 'a2.pdf', { replaces: a.quote.id });
  assert.strictEqual(s.blocks.fna.quotes.length, 2); assert.strictEqual(a.quote.removed, true); assert.strictEqual(a.quote.replacedBy, b.quote.id); assert.strictEqual(calc.quotes(s, 'fna').length, 1);
});

test('quoteIn and quoteRead: a quote with figures read is "already loaded"; one with only the Fact Find\'s lines is not', () => {
  const s = withFF({ kids: [{ d: { name: 'Amy', sname: 'Client' } }] }); const q = store.addQuote(s, 'fna'); q.number = '100000031';
  assert.strictEqual(docs.quoteIn(s, 'fna', 'CP 100000031'), q); assert.strictEqual(docs.quoteRead(q), false, 'only the Fact Find\'s lines');
  docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf'); assert.strictEqual(docs.quoteRead(docs.quoteIn(s, 'fna', '100000031')), true);
  assert.strictEqual(docs.quoteIn(s, 'reduced', '100000031'), null);
});

test('opening a file that holds the same quote twice keeps ONE (the one with the pay-out), says so, and does not save the note', () => {
  const s = withFF({}); const a = docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf'), b = { quote: JSON.parse(JSON.stringify(a.quote)) };
  b.quote.id = 'q-dup'; b.quote.cmp = { number: '100000031', rows: [{ key: 'total', today: 1, projected: 2 }], st: 'verify' }; s.blocks.fna.quotes.push(b.quote);
  const c = docs.applyQuote(s, 'reduced', READ('100000041'), 'r.pdf'), c2 = JSON.parse(JSON.stringify(c.quote)); c2.id = 'q-dup2'; s.blocks.reduced.quotes.push(c2);
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.dups, 2); assert.strictEqual(back.blocks.fna.quotes.length, 1); assert.ok(back.blocks.fna.quotes[0].cmp, 'the copy with the pay-out stays'); assert.strictEqual(back.blocks.reduced.quotes.length, 1);
  assert.strictEqual(calc.allQuotes(back).length, 2); assert.strictEqual(check.docLines(back, check.run(back).problems).filter(l => /FNA/.test(l.title) && !/pay-out/.test(l.title)).length, 1, 'the Checks list it once');
  assert.strictEqual(store.fromJSON(store.toJSON(back)).dups, 0);
});

test('removed quotes and quotes with no number are never counted as copies', () => {
  const s = withFF({}); docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf'); const o = docs.applyQuote(s, 'fna', READ('100000031', { premium: 1 }), 'b.pdf', { replaces: s.blocks.fna.quotes[0].id });
  s.blocks.fna.quotes.push(store.newQuote(s, 'fna'), store.newQuote(s, 'fna'));
  assert.strictEqual(store.dedupeQuotes(s), 0); assert.strictEqual(s.blocks.fna.quotes.length, 4); assert.ok(o);
});

test('a "replaced by" link to a dropped copy is pointed at the quote that stays', () => {
  const s = withFF({}), a = docs.applyQuote(s, 'fna', READ('100000031'), 'a.pdf').quote, dup = JSON.parse(JSON.stringify(a)); dup.id = 'q-dup'; dup.cmp = { rows: [], st: 'verify' };
  const old = store.newQuote(s, 'fna', { number: '000111', removed: true, replacedBy: 'q-dup' }); s.blocks.fna.quotes.push(dup, old);
  store.dedupeQuotes(s); assert.ok(s.blocks.fna.quotes.some(q => q.id === 'q-dup')); assert.strictEqual(s.blocks.fna.quotes.filter(q => q.id === a.id).length, 0);
  s.blocks.fna.quotes.push(Object.assign(JSON.parse(JSON.stringify(a)), { id: 'q-third' })); store.dedupeQuotes(s); assert.strictEqual(calc.quotes(s, 'fna').length, 1);
});

test('the screen reads a file once: the same file name in one go, and a quote already loaded, are not read twice', () => {
  const ui = app('js/ov-ui.js');
  assert.match(ui, /function uniqueFiles\(list\)/); assert.match(ui, /files = uniqueFiles\(\[\]\.slice\.call\(files\)\)/); assert.match(ui, /res\.files = uniqueFiles\(res\.files\)/);
  assert.match(ui, /D\.quoteIn\(state, block, cls\.number\)/); assert.match(ui, /not read again \(to read it again, use Replace quote/); assert.match(ui, /already there \(each quote is kept once\)/);
  assert.match(ui, /was already there: it was read again into the same quote, so there is still only one/);
});

/* ---------- 4. the change moment pay-out table, 5. rounded tables ---------- */
test('the change moment pay-out table: no x on a row, no "+ A child row", four columns; the store no longer adds or removes rows by hand', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(!/data-delcmprow|data-addcmpchild|Remove this row|A child row/.test(ui), 'no x and no add button on the page');
  assert.match(ui, /<th>Pay-out date<\/th><\/tr><\/thead>/); assert.match(ui, /colspan="4" class="empty">No rows: the insurer gave no pay-out/); assert.match(ui, /The rows come from the change moment pay-out guide/);
  assert.strictEqual(store.addCmpChild, undefined); assert.strictEqual(store.removeCmpRow, undefined);
  assert.ok(/data-delcmp="/.test(ui) && /data-addcmp="/.test(ui), 'removing the whole table and typing one by hand when there is no guide are unchanged');
});

test('every table of the entry screen is inside a rounded wrapper (16px): lines, totals, comparison, pay-out, policies, group, investments, shortfall, proposed', () => {
  const ui = app('js/ov-ui.js'), css = app('css/overview.css');
  const tables = (ui.match(/<table class="ovt/g) || []).length, wrapped = (ui.match(/<div class="ovw"><table class="ovt/g) || []).length;
  assert.ok(tables >= 8 && tables === wrapped, 'every <table class="ovt"> is wrapped: ' + tables + ' tables, ' + wrapped + ' wrapped');
  assert.match(css, /\.ovw \{ border: 1px solid var\(--line\); border-radius: 16px; overflow: hidden;/); assert.match(css, /\.qcard \{ border: 1px solid var\(--line\); border-radius: 16px;/);
});

/* ---------- 6. full screen for the Presentation (Paul presents in Microsoft Teams and the client must not see Chrome's tabs, address bar or bookmarks) ---------- */
test('the Presentation has a Full screen button next to Close, Present full screen on the overview, Esc and Close leave full screen', () => {
  const html = app('overview.html'), js = app('js/ov-present.js'), css = app('css/present.css');
  assert.match(html, /id="btnPresent"/); assert.match(html, /id="btnPresentFull"[^>]*>Present full screen</);
  assert.match(js, /id="pBtnFull"[^>]*>Full screen<\/button>' \+\s*'<button type="button" class="pb" id="pBtnClose"/, 'Full screen sits next to Close');
  assert.match(js, /root\.requestFullscreen \? root\.requestFullscreen\(\) : root\.webkitRequestFullscreen\(\)/, 'the Fullscreen API on the Presentation element itself');
  assert.match(js, /document\.exitFullscreen/); assert.match(js, /'Exit full screen' : 'Full screen'/);
  assert.match(js, /\['fullscreenchange', 'webkitfullscreenchange'\]/);
  assert.match(js, /if \(fsEl\(\)\) exitFs\(\);[^\n]*\n\s*else if \(Date\.now\(\) - fsOff > 400\) close\(\);/, 'the first Esc leaves full screen, the next closes');
  assert.match(js, /exitFs\(\); open = false; root\.hidden = true;/, 'closing leaves full screen too');
  assert.match(js, /if \(wantFull === true\) enterFs\(\)/, 'Present full screen goes in at once, inside the click');
  assert.match(css, /\.pres:fullscreen \{ width: 100vw; height: 100vh; background: #fff; \}/);
});
