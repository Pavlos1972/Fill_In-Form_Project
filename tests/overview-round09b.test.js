/* Client Overview Studio 0.91 (23 November, Paul's second round after he tested 0.9 on a real client): a block says "nothing found" only when ITS search has finished (a neutral waiting state before), the "What was loaded" pop-up
   is gone, a current policy starts closed, a line the quote gives is confirmed by the quote, block 11 is filled from the Fact Find's answers and from the later Follow-Up Summary Notes (each part of a note says where it came from),
   a short description of each benefit sits under its amount (entry screen, PDF, Presentation), and no amount of the Presentation's tables runs into the next column. Invented client only ("Test Client"). */
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
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const FFJ = (l, f) => ({ app: 'wr-fact-find', schema: '5.4', f: Object.assign({ fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' } }, f || {}), l: l || {} });
const v = x => ({ v: x });
const withFF = (l, f) => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ(l, f)), 'ff.json'); return s; };
const item = (s, key) => s.blocks.other.items.filter(i => i.key === key)[0];

/* ---------- 1. nothing is said before the search of a block has finished ---------- */
test('a block says "nothing found" only when its own search has finished (opts.done); until then every block is neutral (grey, no comment)', () => {
  const s = withFF({}), none = check.run(s, { ran: true, done: {} });
  assert.deepStrictEqual(Object.keys(none.notes), [], 'no note at all while nothing has finished');
  schema.BLOCKS.forEach(b => assert.notStrictEqual(none.dots[b.id], 'red', b.id + ' is not red before its search has finished'));
  assert.strictEqual(none.dots.policies, 'grey'); assert.strictEqual(none.dots.group, 'grey'); assert.strictEqual(none.dots.fna, 'grey'); assert.strictEqual(none.dots.reduced, 'grey');
  const some = check.run(s, { ran: true, done: { fna: true, group: true } });
  assert.strictEqual(some.dots.fna, 'red'); assert.strictEqual(some.notes.fna.text, 'No FNA quote found');
  assert.strictEqual(some.dots.group, 'red'); assert.strictEqual(some.notes.group.text, 'No group benefits and no personal investments');
  assert.ok(!some.notes.policies && !some.notes.reduced && !some.notes.investments, 'the others are still waiting');
  const all = {}; schema.BLOCKS.forEach(b => { all[b.id] = true; });
  const full = check.run(s, { ran: true, done: all }), plain = check.run(s, { ran: true });
  assert.deepStrictEqual(Object.keys(full.notes).sort(), Object.keys(plain.notes).sort(), 'every block finished = the same as before (and with no done list at all)');
  assert.strictEqual(full.dots.reduced, 'red'); assert.strictEqual(full.notes.reduced.text, 'No reduced quotes found');
});

test('the shortfall quote and the comparative quotes follow the same rule: no note, and no dashed "not needed" comment, until they have finished', () => {
  const s = withFF({}), r = check.run(s, { ran: true, done: {} });
  assert.ok(!r.notes.shortfallQuote && !r.notes.comparative);
  assert.strictEqual(r.dots.shortfallQuote, 'na', 'the dot of a block that is not needed is a fact of the Fact Find and stays dashed');
  assert.match(check.run(s, { ran: true, done: { shortfallQuote: true } }).notes.shortfallQuote.text, /no group risk/);
});

test('the screen: a waiting bar for every block before the folder is searched, a searching bar, then each block finishes; a failed or cancelled search ends with no verdict', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/Waiting to search the client folder/.test(ui) && /Searching the client folder/.test(ui), 'the two neutral wordings');
  assert.ok(/function beginSearch\(/.test(ui) && /function endSearch\(/.test(ui) && /function abandonSearch\(/.test(ui) && /function searching\(/.test(ui), 'begin, searching, end and abandon');
  assert.ok(/check\.run\(state, runOpts\(\)\)/.test(ui) && !/check\.run\(state, \{ ran: ran \}\)/.test(ui), 'every check of the screen carries the list of finished blocks');
  assert.ok(/if \(loading\) \{ deferred = true; return Promise\.resolve\(\); \}/.test(ui), 'a check asked for while a search runs is held until the search has ended');
  assert.ok(/function busy\(id\)[^\n]*'waiting'[^\n]*'searching'/.test(ui), 'a waiting or searching block shows no note');
  assert.ok(/beginSearch\(\);\s+\/\/ every block waits/.test(ui) && /abandonSearch\(\);\s+if \(click === true \|\| \(click !== false && w\.since\(\) < 4000\)\) \{ toast\(\(why/.test(ui) && /counted: true/.test(ui), 'the folder load starts the search, falls back without a verdict, and hands the count to ingest');
  assert.ok(/fillFactFind[\s\S]{0,400}checkPass\(\)/.test(ui) && /\{ explicit: true \}/.test(ui), 'Fill from Fact Find checks (held while loading); only the Check all blocks button counts as a search of the documents');
  const css = app('css/overview.css'); assert.ok(/\.nav \.prog\.waiting/.test(css) && /\.nav \.prog\.searching/.test(css), 'styled');
});

/* ---------- 2. no pop-up ---------- */
test('the "What was loaded" pop-up is gone for good; the Checks panel carries what needs a look (folded)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(!/showResults/.test(ui) && !/resultsDlg/.test(ui) && !/What was loaded/.test(ui), 'no pop-up code is left');
  assert.ok(/What the last load said/.test(ui) && /loadlog/.test(ui), 'the warnings of the last load are a folded line of the Checks panel');
});

/* ---------- 3. a policy starts closed ---------- */
test('a policy that was just read stays closed (See more); every other item that was read still opens', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/if \(block !== 'policies'\) openSet\[item\.id\] = true;/.test(ui), 'only the policy is held back');
  assert.ok(/openSet\[pr\.item\.id\] = true/.test(ui) && /openSet\[r\.quote\.id\] = true/.test(ui) && /openSet\[gl\.item\.id\] = true/.test(ui), 'proposals, quotes and goal reports still open');
  assert.ok(!/policyOpen|openSet\[e\.item\.id\] = true/.test(ui));
});

/* ---------- 4. a line in the quote is confirmed by the quote ---------- */
const readQuote = (s, lines, o) => docs.applyQuote(s, 'fna', Object.assign({ insurer: 'BrightRock', number: '100000071', date: '20/11/2026', premium: 5000, lines }, o || {}), 'fna.pdf').quote;
const L = (type, o) => Object.assign({ type, label: type, life: { lump: 100000, monthly: 100 }, abi: 5 }, o);

test('household needs, death-related needs and additional expense needs read from a quote are confirmed by the quote (green tick, match "quote"); nothing needs the Fact Find', () => {
  const s = withFF({}), q = readQuote(s, [L('household'), L('death'), L('dread', { sev: { lump: 50000 } })]);
  q.lines.forEach(l => assert.ok(l.st === 'verify' && l.by === 'page', 'read: to check'));
  const n = check.autoMatch(s, q); assert.strictEqual(n, 3);
  q.lines.forEach(l => assert.ok(l.st === 'confirmed' && l.match === 'quote' && l.by === 'page', l.type + ' is confirmed by the quote'));
  assert.strictEqual(check.autoMatch(s, q), 0, 'nothing more the second time');
  const j = JSON.parse(store.toJSON(s)); assert.strictEqual(j.blocks.fna.quotes[0].lines[0].match, 'quote', 'saved');
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.blocks.fna.quotes[0].lines[2].match, 'quote');
});

test('the quote\'s own row is confirmed when every line is and nothing is flagged for it; a flagged difference keeps its reason and keeps the row to check', () => {
  const s = withFF({ kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }] });
  const q = readQuote(s, [L('household'), L('child', { name: 'Amy', sname: 'Client', life: { lump: 1, monthly: 4000 } })], { servicing: true });
  const n = check.autoMatch(s, q); const kid = q.lines.filter(l => l.type === 'child')[0], house = q.lines.filter(l => l.type === 'household')[0];
  assert.strictEqual(house.st, 'confirmed'); assert.strictEqual(house.match, 'quote');
  assert.strictEqual(kid.st, 'verify', 'the quote has R 4 000 and the Fact Find R 5 000: a real mismatch stays to check'); assert.ok(check.run(s).problems.some(p => p.line === kid.id && /4 000|4,000/.test(p.message)), 'with its reason');
  assert.strictEqual(q.st, 'verify', 'a line is still to check: the row of the quote is too');
  assert.strictEqual(n, 1);
  const s2 = store.blank(), q2 = readQuote(s2, [L('household')], { number: '100000072', servicing: true }); q2.cmp = { number: '100000072', rows: [], st: 'verify' };
  check.autoMatch(s2, q2); assert.strictEqual(q2.st, 'confirmed', 'every line confirmed, no problem: the row of the quote is confirmed as well');
});

test('a child or a debt that is in the quote and not in the Fact Find is still flagged; a line a person typed is not touched', () => {
  const s = withFF({}), q = readQuote(s, [L('child', { name: 'Zoe', sname: 'Client' }), L('household')]);
  check.autoMatch(s, q); const zoe = q.lines[0], house = q.lines[1];
  assert.strictEqual(zoe.st, 'verify', 'not in the Fact Find: to check'); assert.strictEqual(house.st, 'confirmed');
  store.setPath(s, 'blocks.fna.quotes.0.lines.1.label', 'Home needs', 'text');
  assert.ok(house.st === 'confirmed' && house.by === 'person' && house.match === undefined, 'a person\'s typing ends the automatic check: it is the person\'s check now');
  const t = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000073', lines: [L('death')] }, 'x.pdf').quote; t.lines[0].by = 'person'; t.lines[0].st = 'verify';
  check.autoMatch(s, t); assert.strictEqual(t.lines[0].st, 'verify', 'a person\'s own line is left');
});

test('the page runs the check on every quote it reads (the message says how many lines were checked)', () => {
  const ui = app('js/ov-ui.js'); assert.ok(/nm = check\.autoMatch\(state, r\.quote\)/.test(ui) && /o\.match === 'quote'/.test(ui) && /the quote is the document/.test(ui));
});

/* ---------- 5. block 11: the Fact Find's answers, then the later Summary Notes ---------- */
const BLOCK11 = { ma: v('Medical aid'), ma_prov: v('Test Health Scheme'), ma_plan: v('Test Saver'), ma_broker: v('Other broker'), n_ma: v('Premium paid by the employer.'),
  gap: v('Yes'), gap_prov: v('Test Gap Cover'), gap_broker: v('Paul K'), n_gap: v('Quote requested.'),
  will: v('Yes'), will_up: v('No'), will_where: v('Capital Legacy'), will_broker: v('Other broker'), will_date: v('01/03/2019'), n_will: v('Wants the guardian changed.'),
  ref_will: v('Capital Legacy to contact client'), sti: v('Yes'), sti_broker: v('Cameron Maritz'), sti_car: v('Yes'), sti_house: v('Yes'), sti_struct: v('No'), sti_personal: v('R 2 539.00'), n_sti: v('Two cars on the policy.'), ref_sti: v('Cameron to contact client') };

test('block 11 is filled from what the Fact Find asked and answered: company, product, broker, premium and the Fact Find\'s notes, each note ending with where it came from', () => {
  const s = withFF({}, BLOCK11), med = item(s, 'medical'), gap = item(s, 'gap'), will = item(s, 'will'), leg = item(s, 'legacy'), st = item(s, 'shortterm');
  assert.strictEqual(med.company, 'Test Health Scheme'); assert.strictEqual(med.product, 'Test Saver'); assert.strictEqual(med.wr, false);
  assert.ok(/^Medical aid; broker Other broker; Premium paid by the employer\. \(Fact Find 20\/11\)$/.test(med.note), med.note);
  assert.strictEqual(gap.company, 'Test Gap Cover'); assert.strictEqual(gap.wr, true); assert.ok(/^Gap cover: Yes; broker Paul K; Quote requested\. \(Fact Find 20\/11\)$/.test(gap.note), gap.note);
  assert.strictEqual(will.company, 'Capital Legacy'); assert.ok(/Has a will, not up to date; last updated 01\/03\/2019; held with Capital Legacy; broker Other broker; Wants the guardian changed\. \(Fact Find 20\/11\)$/.test(will.note), will.note);
  assert.strictEqual(leg.company, 'Capital Legacy', 'the legacy protection plan comes from the Fact Find too'); assert.ok(/^Capital Legacy to contact client \(Fact Find 20\/11\)$/.test(leg.note), leg.note);
  assert.strictEqual(st.premium, 2539); assert.ok(/^Has short-term insurance; broker Cameron Maritz; covers car, household contents; Two cars on the policy\.; Cameron to contact client \(Fact Find 20\/11\)$/.test(st.note), st.note);
  [med, gap, will, leg, st].forEach(i => assert.ok(i.st === 'ff' && i.src.kind === 'factfind', i.key + ' comes from the Fact Find and waits to be checked'));
});

test('no medical aid says so for the gap cover; nothing answered leaves the item empty; a Fact Find with no date has a tag with no date', () => {
  const s = withFF({}, { ma: v('None') }); assert.ok(/^No medical aid \(Fact Find 20\/11\)$/.test(item(s, 'medical').note)); assert.ok(/^No medical aid, so no gap cover \(Fact Find 20\/11\)$/.test(item(s, 'gap').note));
  const e = withFF({}); assert.ok(['medical', 'gap', 'will', 'legacy'].every(k => item(e, k).st === 'empty' && item(e, k).note === ''), 'nothing asked, nothing written');
  const j = FFJ({}, { will: v('No') }); delete j.f.date; const s2 = store.blank(); store.fillFromFactFind(s2, JSON.stringify(j), 'ff.json'); assert.strictEqual(item(s2, 'will').note, 'No will (Fact Find)');
});

test('an older reading of the Fact Find without the new details is not a change; refilling keeps what was typed and what a Summary Notes added', () => {
  const s = withFF({}, BLOCK11), a = JSON.parse(JSON.stringify(s.factFind.facts)); delete a.otherDetail; assert.strictEqual(store.diffFacts(a, s.factFind.facts), 0, 'otherDetail is ignored when one side lacks it');
  item(s, 'will').note = 'typed by hand'; item(s, 'will').st = 'confirmed'; item(s, 'will').by = 'person';
  store.fillFromFactFind(s, JSON.stringify(FFJ({}, BLOCK11)), 'ff.json'); assert.strictEqual(item(s, 'will').note, 'typed by hand', 'a checked item is not overwritten');
});

test('Follow-Up Appointment Summary Notes: found by name, dated by the name, one item\'s progress added to its note with "(Summary Notes dd/mm)"', () => {
  const c = docs.classify('Follow-Up Appointment Summary Notes - 28.11.26 - (Test Client).pdf'); assert.strictEqual(c.block, 'followup'); assert.strictEqual(c.date, '28/11/2026'); assert.strictEqual(docs.classify('Test Client - Summary Notes 05.12.26.pdf').block, 'followup');
  assert.strictEqual(docs.classify('BR CMPO - 100000071.pdf').block, 'cmp'); assert.strictEqual(docs.classify('BR FNA - 100000071 - R5000.00 - 19.11.26.pdf').block, 'fna', 'the other names are not touched');
  const s = withFF({}, BLOCK11), before = item(s, 'will').note;
  const r = docs.applyFollowUp(s, { date: '28/11/2026', items: { will: 'Capital Legacy to call to amend the will', shortterm: 'Everything sent to Cameron, feedback awaited.', medical: null, gap: '' } }, 'Follow-Up Summary Notes 28.11.26.pdf', '28/11/2026');
  assert.deepStrictEqual(r.filled.sort(), ['shortterm', 'will']); assert.strictEqual(r.date, '28/11/2026');
  assert.strictEqual(item(s, 'will').note, before + ' · Capital Legacy to call to amend the will (Summary Notes 28/11)', 'the Fact Find\'s part stays in front');
  assert.ok(/Everything sent to Cameron, feedback awaited\. \(Summary Notes 28\/11\)$/.test(item(s, 'shortterm').note));
  assert.strictEqual(item(s, 'medical').st, 'ff', 'an item the notes say nothing about is not touched'); assert.strictEqual(item(s, 'will').st, 'verify'); assert.strictEqual(item(s, 'will').src.kind, 'followup'); assert.strictEqual(item(s, 'will').src.date, '28/11/2026');
  const again = docs.applyFollowUp(s, { date: '28/11/2026', items: { will: 'Capital Legacy to call to amend the will' } }, 'f.pdf'); assert.deepStrictEqual(again.filled, [], 'the same words are not added twice');
});

test('notes read before the Fact Find was filled still get the Fact Find\'s part in front when it is filled; the file reads and saves back', () => {
  const s = store.blank(); docs.applyFollowUp(s, { date: '02/12/2026', items: { legacy: 'Plan documents received.' } }, 'n.pdf');
  assert.strictEqual(item(s, 'legacy').note, 'Plan documents received. (Summary Notes 02/12)');
  store.fillFromFactFind(s, JSON.stringify(FFJ({}, BLOCK11)), 'ff.json');
  assert.strictEqual(item(s, 'legacy').note, 'Capital Legacy to contact client (Fact Find 20/11) · Plan documents received. (Summary Notes 02/12)');
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(item(back, 'legacy').src.kind, 'followup'); assert.strictEqual(item(back, 'legacy').note, item(s, 'legacy').note);
});

test('reading a Summary Notes: the prompt asks for each cover in one short sentence; an empty reading is said; the menu bar of block 11 shows the progress', () => {
  const p = docs.promptFor('followup'); assert.match(p, /Follow-Up Appointment Summary Notes/); assert.match(p, /"medical"/); assert.match(p, /"legacy"/); assert.match(p, /ONE short sentence/); assert.match(p, /null for an item the notes say nothing about/);
  assert.strictEqual(docs.isEmptyRead('followup', { date: '01/01/2026', items: { will: null } }), true); assert.strictEqual(docs.isEmptyRead('followup', { items: { will: 'x' } }), false);
  const ui = app('js/ov-ui.js'); assert.ok(/block === 'followup' \? 'other'/.test(ui) && /D\.applyFollowUp\(state, data, name, cls\.date\)/.test(ui) && /newestFollowUp/.test(ui) && /f === tickFu/.test(ui), 'the page applies it, shows its bar on block 11 and ticks only the newest one after the Fact Find');
  assert.ok(/function area\(path, rows\)/.test(ui) && /lab\('Note', area\(p \+ '\.note', 3\)/.test(ui), 'the note is a box you can read');
});

class FileH { constructor(name) { this.kind = 'file'; this.name = name; } }
class Dir {
  constructor(name) { this.kind = 'directory'; this.name = name; this.kids = new Map(); }
  async *entries() { for (const [n, h] of this.kids) yield [n, h]; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n)), d.kids.get(n)); return d; }
  file(n) { this.kids.set(n, new FileH(n)); return this; }
}
test('the client\'s folder listing includes the Follow-Up Summary Notes of "2. Fact Find" and of its year folders, and nothing else of it (not the Fact Find, not a transcript)', async () => {
  const c = new Dir('Client, Test'); const ff = c.add('2. Fact Find');
  ff.file('Fact Find (Audio to Text) - 20.11.26 - (Test Client).pdf').file('Fact Find (Audio to Text) - 20.11.26 - (Test Client).json').file('Teams transcript 20.11.26.pdf').file('Follow-Up Appointment Summary Notes - 28.11.26 - (Test Client).pdf').file('notes.txt');
  ff.add('2026').file('Follow-Up Summary Notes - 05.12.26 - (Test Client).pdf').file('Transcript 05.12.26.pdf');
  const out = await F.clientDocuments({ rootKey: 'A', parts: ['Client, Test'], handle: c });
  assert.deepStrictEqual(out.map(f => f.rel.join('/') + '/' + f.name).sort(), ['2. Fact Find/2026/Follow-Up Summary Notes - 05.12.26 - (Test Client).pdf', '2. Fact Find/Follow-Up Appointment Summary Notes - 28.11.26 - (Test Client).pdf']);
});

/* ---------- 7. a description under each benefit amount ---------- */
test('the policy reading asks for a very short description of life cover, severe illness, lump sum disability and income protector, for any insurer; the policy keeps all four', () => {
  const p = docs.promptFor('policies'); ['"life"', '"sev"', '"lsd"', '"ip"'].forEach(k => assert.ok(p.indexOf(k) >= 0, k));
  assert.match(p, /ONE or TWO short lines/); assert.match(p, /Living Lifestyle Plus/); assert.match(p, /Absolute Protector Plus/); assert.match(p, /OOD \(own occupation\)/); assert.match(p, /first 24 months/); assert.match(p, /whole of life or term/);
  const s = withFF({ risk: [{ d: { prov: 'Test Insurer', spend: 'R 900.00', broker: 'Other broker' } }] }), it = s.blocks.policies.items[0];
  docs.applyPolicy(s, it, { insurer: 'Test Insurer', premium: 900, benefits: { life: 'Whole of life', sev: 'Living Lifestyle Plus, standalone, whole of life', lsd: 'Absolute Protector Plus, OOD, to age 65', ip: 'After 24 months, to age 65' }, lines: [{ type: 'other', label: 'Cover', life: { lump: 500000 }, sev: { lump: 100000 } }] }, 's.pdf');
  assert.deepStrictEqual(it.benefits, { life: 'Whole of life', sev: 'Living Lifestyle Plus, standalone, whole of life', lsd: 'Absolute Protector Plus, OOD, to age 65', ip: 'After 24 months, to age 65' });
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.blocks.policies.items[0].benefits.sev, 'Living Lifestyle Plus, standalone, whole of life', 'saved and read back');
});

test('the description is under the amount on the entry screen, in the PDF and in the Presentation; the policy card has a box for each of the four', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/bd\('life'\)/.test(ui) && /bd\('sev'\)/.test(ui) && /bd\('lsd'\)/.test(ui) && /bd\('ip'\)/.test(ui) && /class="d bd"/.test(ui), 'entry screen');
  ['Life cover description', 'Severe illness description', 'Lump sum disability description', 'Income protector description'].forEach(t => assert.ok(ui.indexOf("'" + t + "'") >= 0, t));
  assert.ok(!/notes = \[b\.life, b\.lsd, b\.ip\]/.test(ui), 'no longer joined under the policy name');
  const pdf = app('js/ov-pdf.js'); assert.ok(/o\.pol !== undefined/.test(pdf) && /splitTextToSize/.test(pdf) && /dl\[k\]/.test(pdf) && !/notes = \[b2\.life/.test(pdf), 'PDF: small grey, one or two lines under the figure');
  const pr = app('js/ov-present.js'); assert.ok(/small class="bdesc"/.test(pr) && /bd\('sev'\)/.test(pr) && !/notes = \[bn\.life/.test(pr), 'Presentation');
  assert.ok(/small\.bdesc/.test(app('css/present.css')), 'styled, wrapping');
});

/* ---------- 6. the Presentation tables ---------- */
test('the Presentation\'s tables: a figure never runs into the next column (it is made smaller until it fits), the money columns of the policies table are wider', () => {
  const pr = app('js/ov-present.js');
  assert.ok(/function fitAmounts\(sl\)/.test(pr) && /fitAmounts\(sl\); var h = sl\.offsetHeight/.test(pr), 'measured at the slide\'s own size, before it is scaled');
  assert.ok(/fs > 10/.test(pr) && /w > room \+ 0\.5/.test(pr) && /nextElementSibling\.getBoundingClientRect\(\)\.width/.test(pr), 'down to 10px, never overflowing; "R25,000" and its "p.m." are measured as one line');
  const ui = app('js/ov-ui.js'); assert.ok(/function fitTables\(\)/.test(ui) && /fs > 9/.test(ui) && /fitTables\(\);( paintView\(\);)?\s*\n\s*\}/.test(ui), 'the entry screen has the same rule (down to 9px), after every draw and every redraw of a row');
  assert.ok(/tbl\(\[18, 13, 11, 13, 13, 7, 12, 5, 8\]/.test(pr), 'the policies table gives its money columns more room');
});

/* ---------- the contract ---------- */
test('the contract: revision j, the page version 0.92, the layout still 0.1; new: benefits.sev, match "quote", src.kind "followup"', () => {
  assert.ok(/^(1\.[0123456789]|2\.[01])$/.test(schema.pageVersion), 'the page version is 1.0 to 1.6'); assert.strictEqual(schema.version, '0.1');
  assert.ok(/Revision j/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8')), 'written in the contract');
});

/* ---------- 8. Paul's standard settings are not shown any more (11:41), but they are kept and used ---------- */
test('the "Paul\'s standard settings" panel is gone from the Client details screen; the values are still stored, saved and used by the checks', () => {
  const ui = app('js/ov-ui.js'), client = ui.slice(ui.indexOf('function clientHTML()'), ui.indexOf('/* ---------- the lines of a quote or a policy ---------- */')).replace(/\/\*[\s\S]*?\*\//g, '');   // the comment may name the panel
  assert.ok(!/standard settings/i.test(client) && !/settings\.standards/.test(client) && !/settings\.tolerance/.test(client) && !/Difference allowed in a check/.test(client), 'no panel, no box for the increases or the difference allowed');
  assert.ok(/lab\('First names'/.test(client) && /Premium budget for the reduced quote/.test(client), 'the client\'s own boxes are still there');
  const s = store.blank(); assert.strictEqual(s.settings.standards.aci, 10); assert.strictEqual(s.settings.tolerance, 1); assert.deepStrictEqual(s.settings.standards.abi, { child: 5, household: 5, debt: 0, death: 3, dread: 3 });
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.settings.standards.aci, 10); assert.strictEqual(back.settings.tolerance, 1);
  const t = withFF({}); docs.applyQuote(t, 'fna', { insurer: 'BrightRock', number: '100000099', premium: 1, aci: 7, lines: [L('household', { abi: 6 })] }, 'x.pdf');
  const probs = check.run(t).problems.filter(p => p.id === 'standards'); assert.ok(probs.some(p => /annual benefit increase is 6%; your standard is 5%/.test(p.message)) && probs.some(p => /contribution increase is 7%; your standard is 10%/.test(p.message)), 'a line that differs is still flagged amber: ' + probs.map(p => p.message).join(' | '));
  const loose = store.fromJSON(JSON.stringify(Object.assign(JSON.parse(store.toJSON(s)), { settings: { standards: { aci: 12, abi: { household: 4 } }, tolerance: 5 } }))); assert.strictEqual(loose.settings.standards.aci, 12); assert.strictEqual(loose.settings.tolerance, 5, 'a file\'s own values are still read');
});
