/* Client Overview Studio 0.92 (23 November, Paul's third round after he tested 0.91 on a real client): an older quote is brought up to the current rules (ticked by the quote), a quote that is skipped as already loaded still shows its status,
   a quote's dot and row go amber only for a real line difference, a missing pay-out guide or a missing figure; a need line never sits ticked with an empty box (a figure the reading did not find says "Not found on the quote", the
   death-related income portion says "see the BrightRock email"), a lump sum of 0 has an income portion of 0, the additional expense (dread) line has no life cover, the Summary Notes with nothing in them are not an error, the
   Fact Find's notes are read for company, product and premium, and the Presentation's policies table is roomy. Invented client only ("Test Client"). */
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
const DEBTS = [['Home loan', 'Test Bank A', 'R 14 000.00', 'R 1 000 000.00'], ['Vehicle finance', 'Test Bank B', 'R 5 000.00', 'R 300 000.00'], ['Vehicle finance', 'Test Bank B', 'R 4 000.00', 'R 200 000.00'], ['Credit card', 'Test Bank B', 'R 900.00', 'R 20 000.00']];
const FFJ = (f) => ({ app: 'wr-fact-find', schema: '5.4', f: Object.assign({ fname: v('Dora'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') }, f || {}),
  l: { kids: ['Ann', 'Ben'].map(n => ({ d: { name: n, sname: 'Test', cost: 'R 3 000.00' } })), debts: DEBTS.map(d => ({ d: { type: d[0], prov: d[1], desc: d[0], inst: d[2], bal: d[3], term: '60' } })), risk: [{ d: { prov: 'BrightRock', spend: 'R 2 000.00', broker: 'Paul K' } }] } });
const withFF = f => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ(f)), 'ff.json'); return s; };
const readFna = (s, lines, o) => docs.applyQuote(s, 'fna', Object.assign({ insurer: 'BrightRock', number: '100000081', date: '19/11/2026', premium: 5000, lines }, o || {}), 'fna.pdf').quote;
const FULL = [{ type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 }, { type: 'child', name: 'Ann', sname: 'Test', life: { lump: 100000, monthly: 3000 }, abi: 5 }, { type: 'child', name: 'Ben', sname: 'Test', life: { lump: 100000, monthly: 3000 }, abi: 5 },
  { type: 'debt', debt: 'Home loan', life: { lump: 1000000, monthly: 14000 }, abi: 0 }, { type: 'debt', debt: 'Vehicle finance', life: { lump: 300000, monthly: 5000 }, abi: 0 }, { type: 'debt', debt: 'Vehicle finance', life: { lump: 200000, monthly: 4000 }, abi: 0 }, { type: 'debt', debt: 'Credit card', life: { lump: 20000, monthly: 900 }, abi: 0 },
  { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 }, { type: 'dread', sev: { lump: 500000 }, abi: 3 }];

/* ---------- 3 and 5: the income portion ---------- */
test('a need whose lump sum is 0 has an income portion of 0 (household, child, death-related), whoever wrote the line; a typed number is never touched', () => {
  ['household', 'child', 'death'].forEach(t => { const l = store.newLine(t); l.life.lump = 0; assert.strictEqual(calc.settleLine(l), 1, t); assert.strictEqual(l.life.monthly, 0, t); });
  const l = store.newLine('household'); l.life.lump = 0; l.life.monthly = 1234; assert.strictEqual(calc.settleLine(l), 0); assert.strictEqual(l.life.monthly, 1234);
  const d = store.newLine('debt'); d.life.lump = 0; assert.strictEqual(calc.settleLine(d), 0, 'a debt is not one of these needs'); assert.strictEqual(d.life.monthly, null);
  const s = withFF(), q = readFna(s, [{ type: 'household', life: { lump: 0 }, abi: 5 }]);
  assert.strictEqual(q.lines[0].life.monthly, 0, 'read: the income portion is 0');
});

test('a figure the reading did not find says "Not found" in its box (never an empty box); the death-related income portion says it is in the BrightRock email; a debt names the Fact Find\'s instalment', () => {
  const s = withFF(), q = readFna(s, [{ type: 'household', life: { lump: 800000 }, abi: 5 }, { type: 'debt', debt: 'Home loan', life: { lump: 1000000 }, abi: 0 }, { type: 'death', life: { lump: 500000 }, abi: 3 }, { type: 'dread', abi: 3 }]);
  const by = t => q.lines.filter(l => l.type === t)[0];
  assert.strictEqual(by('household').life.monthly, 'Not found'); assert.strictEqual(by('debt').life.monthly, 'Not found'); assert.strictEqual(by('death').life.monthly, 'Not found'); assert.strictEqual(by('dread').sev.lump, 'Not found', 'the additional expense amount is required');
  const r = check.run(s), fig = id => r.problems.filter(p => p.id === 'figures' && p.line === id)[0];
  assert.match(fig(by('debt').id).message, /^Debt Home loan: the monthly instalment is not found on the quote \(the Fact Find has R14,000\)\.$/); assert.match(fig(by('debt').id).short, /^Not found on the quote: monthly instalment \(Fact Find: R14,000\)\.$/);
  assert.match(fig(by('death').id).short, /^Not on the quote: see the BrightRock email\.$/); assert.match(fig(by('household').id).short, /^Not found on the quote: income portion p\.m\.\.$/);
  assert.match(fig(by('dread').id).short, /^Not found on the quote: severe illness amount\.$/);
  check.autoMatch(s, q); q.lines.forEach(l => assert.strictEqual(l.st, 'verify', l.type + ' stays to check: a line with a missing figure is never ticked'));
  assert.strictEqual(q.st, 'verify'); assert.strictEqual(r.dots.fna, 'amber');
  assert.ok(!by('debt').life.monthly || by('debt').life.monthly === 'Not found', 'the Fact Find\'s instalment is shown, not copied into the box');
});

test('an older line with an EMPTY box (read by 0.91 or before) is flagged "Empty" until the page fills it (0.93: from another quote of the same debt, else from the Fact Find, and says so)', () => {
  const s = withFF(), q = readFna(s, FULL); q.lines.filter(l => l.type === 'debt')[0].life.monthly = null; q.lines.forEach(l => { l.st = 'verify'; delete l.match; });
  const p = check.run(s).problems.filter(x => x.id === 'figures'); assert.strictEqual(p.length, 1); assert.match(p[0].short, /^Empty: monthly instalment \(Fact Find: R14,000\)\.$/);
  check.settleAll(s); const debts = q.lines.filter(l => l.type === 'debt'); assert.strictEqual(debts[0].life.monthly, 14000, '0.93: the page fills it from the Fact Find (no other quote has it)'); assert.strictEqual(debts[0].via['life.monthly'], 'from the Fact Find');
  assert.ok(debts.every(l => l.st === 'confirmed'), 'with every figure there, every debt line is ticked');
});

/* ---------- 6: dread ---------- */
test('the additional expense (dread) line has no life cover cell: N/A when made, ignored when read, converted when an older file opens; the severe illness amount stays', () => {
  const l = store.newLine('dread'); assert.strictEqual(l.life, 'N/A'); assert.strictEqual(l.lsd, 'N/A'); assert.strictEqual(l.ip, 'N/A');
  const s = withFF(), q = readFna(s, [{ type: 'dread', life: { lump: 100, monthly: 5 }, sev: { lump: 500000 }, abi: 3 }]); assert.strictEqual(q.lines[0].life, 'N/A', 'what the reading says about its life cover is ignored'); assert.deepStrictEqual(q.lines[0].sev, { lump: 500000 });
  const old = JSON.parse(store.toJSON(s)); old.blocks.fna.quotes[0].lines[0].life = { lump: 0, monthly: 0 };
  const back = store.fromJSON(JSON.stringify(old)); assert.strictEqual(back.blocks.fna.quotes[0].lines[0].life, 'N/A', 'an older file: no life cover on the dread line');
  assert.strictEqual(calc.totals(back.blocks.fna.quotes[0]).sev.lump, 500000); assert.strictEqual(calc.totals(back.blocks.fna.quotes[0]).life.lump, 0);
  const ui = app('js/ov-ui.js'); assert.ok(/pillar\('life', true, true\)/.test(ui), 'the screen draws the cells from the line, so N/A shows');
});

/* ---------- 2: amber only for real reasons ---------- */
test('the quote\'s dot and row: the income-against-net-income check, a standard that differs and a premium above budget are notes; with every figure there and a pay-out guide the quote is green', () => {
  const s = withFF({ net: v('R 90 000.00') }), q = readFna(s, FULL); q.cmp = { number: '100000081', rows: [], st: 'verify' };
  check.autoMatch(s, q); const r = check.run(s);
  assert.ok(r.problems.some(p => p.id === 'fna.income'), 'the income check still says its piece (in the Checks panel)'); assert.ok(Object.keys(check.NOTE_IDS).sort().join() === 'budget,fna.income,standards');
  q.lines.forEach(l => assert.strictEqual(l.st, 'confirmed', l.type)); assert.strictEqual(q.st, 'confirmed', 'the row is accepted'); assert.strictEqual(r.dots.fna, 'green', 'and so is the menu dot');
  assert.strictEqual(check.docLines(s, r.problems).filter(l => l.block === 'fna' && !/pay-out/.test(l.title))[0].state, 'checked', 'the quote\'s own Checks line: checked (the pay-out row has its own line)');
});

test('a real difference still holds it amber: a child that differs, a debt only in the quote, a missing pay-out guide', () => {
  const s = withFF(), noGuide = readFna(s, FULL); check.autoMatch(s, noGuide);
  assert.strictEqual(noGuide.st, 'verify', 'no pay-out guide for this BrightRock quote'); assert.strictEqual(check.run(s).dots.fna, 'amber');
  const s2 = withFF(), q2 = readFna(s2, FULL.map(l => l.name === 'Ann' ? Object.assign({}, l, { life: { lump: 100000, monthly: 4000 } }) : l)); q2.cmp = { number: '100000081', rows: [], st: 'verify' }; check.autoMatch(s2, q2);
  const ann = q2.lines.filter(l => l.name === 'Ann')[0]; assert.strictEqual(ann.st, 'verify'); assert.match(check.run(s2).problems.filter(p => p.line === ann.id)[0].message, /the quote wins: correct the Fact Find\)\.$/); assert.strictEqual(check.run(s2).dots.fna, 'amber');
});

/* ---------- 1: older quotes heal ---------- */
test('a quote read by 0.9 (lines to check, a dread line with life cover, a household line with an empty income portion) is brought up to date when the file opens or a draft is restored', () => {
  const s = withFF(), q = readFna(s, FULL); q.cmp = { number: '100000081', rows: [], st: 'verify' };
  q.lines.forEach(l => { l.st = 'verify'; delete l.match; }); q.st = 'verify';
  const dread = q.lines.filter(l => l.type === 'dread')[0]; dread.life = { lump: null, monthly: null }; const hh = q.lines.filter(l => l.type === 'household')[0]; hh.life = { lump: 0, monthly: null };
  const text = store.toJSON(s), opened = store.fromJSON(text); const n = check.settleAll(opened), oq = opened.blocks.fna.quotes[0];
  assert.ok(n > 0); assert.strictEqual(oq.lines.filter(l => l.type === 'dread')[0].life, 'N/A'); assert.strictEqual(oq.lines.filter(l => l.type === 'household')[0].life.monthly, 0);
  assert.ok(oq.lines.every(l => l.st === 'confirmed'), 'every line is ticked: ' + oq.lines.map(l => l.type[0] + l.st[0]).join(' ')); assert.strictEqual(oq.st, 'confirmed');
  assert.strictEqual(check.settleAll(opened), 0, 'nothing more the second time');
  const ui = app('js/ov-ui.js'); assert.ok(/var healed = check\.settleAll\(state\)/.test(ui) && /state = restored; check\.settleAll\(state\)/.test(ui) && /check\.settleAll\(state\); touch\(\); redraw\(\); checkPass\(\); readFactNotes\(\)/.test(ui), 'on opening a file, restoring a draft, filling from the Fact Find and ending a load');
});

test('a quote that is skipped as already loaded still shows its status ("Already loaded") and is checked again', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/nb0 = navBlockOf\(block, o\.quote\), ticked = check\.autoMatch\(state, have\)/.test(ui) && /progEnd\(nb0, 'done', 'Already loaded'/.test(ui), 'the bar says so');
  assert.ok(/function progEnd\(id, how, text\)/.test(ui) && /p\.ok \|\| 'Downloaded and populated'/.test(ui));
});

/* ---------- debts with the same name ---------- */
test('two debts with the same name (two vehicle loans) are matched by the debt cover first, then by the instalment, not just by order', () => {
  const s = withFF(), q = readFna(s, FULL.map(l => l.debt === 'Vehicle finance' ? l : l).slice().sort((a, b) => (a.debt === 'Vehicle finance' && b.debt === 'Vehicle finance' ? (b.life.lump - a.life.lump) * -1 : 0)));
  const swapped = FULL.slice(); const i = swapped.findIndex(l => l.debt === 'Vehicle finance'); [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
  const s2 = withFF(), q2 = readFna(s2, swapped); check.autoMatch(s2, q2);
  const pairs = calc.matchDebts(calc.activeLines(q2), s2.factFind.facts.debts).pairs.filter(p => p.ff.desc === 'Vehicle finance');
  assert.strictEqual(pairs.length, 2); pairs.forEach(p => assert.strictEqual(p.line.life.lump, p.ff.bal, 'each line is paired with the debt whose balance it covers'));
  assert.strictEqual(check.run(s2).problems.filter(p => p.id === 'quote.debts').length, 0, 'no false difference from a swapped order'); assert.ok(q);
});

/* ---------- 7: block 11 ---------- */
test('a Follow-Up Summary Notes with nothing for the five covers is "Read: nothing new", not a red error; a real failure puts its own message on the bar', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/block === 'followup'\) \{ notice = 'Read: nothing new for these covers'; data = \{ items: \{\} \}/.test(ui), 'not an error');
  assert.ok(/failure \? 'Could not read it: ' \+ failure : notice/.test(ui), 'the real message is on the bar');
  assert.ok(/\.nav \.prog\.error \{ height: auto/.test(app('css/overview.css')), 'and it is shown in full');
  assert.ok(/class="allchecks loadlog"><summary>/.test(ui) && /<details class="chkall"/.test(ui), '0.93: what the last load said, and the whole Checks card, are folded (closed)');
});

const BLOCK11 = { ma: v('Medical aid'), n_ma: v('Test Health Scheme, Saver plan, R 1 800 per month. Paid by the employer.'), gap: v('Yes'), n_gap: v('Gap cover with Test Gap Co.'), will: v('Yes'), n_will: v('Will with Capital Legacy.'), sti: v('Yes'), n_sti: v('Test Short-term, R 2 539 p.m.') };
test('the Fact Find\'s notes are read for company, product and premium: only the four notes boxes are sent, only empty boxes are filled, nothing typed is overwritten', async () => {
  const s = withFF(BLOCK11); const txt = docs.factNotesText(s);
  assert.match(txt, /^Medical aid: Test Health Scheme, Saver plan/); assert.match(txt, /Short-term insurance: Test Short-term/); assert.strictEqual(txt.split('\n').length, 4);
  assert.ok(!/R 60 000|Dora|Test$/.test(txt) && !/@/.test(txt), 'nothing but the notes');
  assert.strictEqual(docs.factNotesText(store.blank()), '');
  const med = s.blocks.other.items.filter(i => i.key === 'medical')[0]; med.product = 'typed by hand';
  const filled = docs.applyNotesRead(s, { items: { medical: { company: 'Test Health Scheme', product: 'Saver', premium: 1800 }, gap: { company: 'Test Gap Co.' }, shortterm: { company: 'Test Short-term', premium: 2539 }, will: null } });
  const it = k => s.blocks.other.items.filter(i => i.key === k)[0];
  assert.deepStrictEqual(filled.sort(), ['gap', 'medical', 'shortterm']); assert.strictEqual(it('medical').company, 'Test Health Scheme'); assert.strictEqual(it('medical').product, 'typed by hand', 'a box that was filled is not overwritten'); assert.strictEqual(it('medical').premium, 1800);
  assert.strictEqual(it('shortterm').premium, 2539, 'the premium the Fact Find already gave (the personal spend) stays when there is one'); assert.strictEqual(it('gap').company, 'Test Gap Co.'); assert.strictEqual(it('medical').st, 'ff', 'still from the Fact Find, to be checked');
  assert.strictEqual(docs.isEmptyRead('ffnotes', { items: { medical: { company: null } } }), true); assert.strictEqual(docs.isEmptyRead('ffnotes', { items: { medical: { company: 'X' } } }), false);
  const p = docs.promptFor('ffnotes'); assert.match(p, /ONLY what the notes say/); assert.match(p, /"premium": n/);
  let sent = null; const fetchStub = (u, o) => { sent = JSON.parse(o.body); return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"items":{}}' }], usage: {} }) }); };
  await docs.readWithClaude({ apiKey: 'k', model: 'm', block: 'ffnotes', text: txt, fetch: fetchStub });
  assert.strictEqual(sent.messages[0].content.length, 1, 'a text call: no document'); assert.strictEqual(sent.messages[0].content[0].type, 'text'); assert.match(sent.messages[0].content[0].text, /THE NOTES:\nMedical aid: Test Health Scheme/);
  const ui = app('js/ov-ui.js'); assert.ok(/function readFactNotes\(\)/.test(ui) && /txt === notesSig/.test(ui) && /!aiOn\(\) \|\| !key\.apiKey/.test(ui), 'once for the same notes, only with reading on and a key');
  assert.ok(/Promise\.resolve\(\)\.then\(function \(\) \{ return D\.readWithClaude\(\{ apiKey: key\.apiKey, model: key\.model, block: 'ffnotes'/.test(ui) && /\.catch\(fail\)\.then\(function \(\) \{ notesBusy = false/.test(ui), 'a failure of any kind (even a throw before the call) ends the bar and frees the next try');
});

/* ---------- the reading instructions ---------- */
test('the reading is told: the income portion of every need, the debt\'s instalment, the dread line has only a severe illness amount, nothing from anywhere but the quote', () => {
  const p = docs.promptFor('fna'); assert.match(p, /INCOME PORTION p\.m\./); assert.match(p, /MONTHLY INSTALMENT/); assert.match(p, /ONLY a severe illness amount, in sev\.lump: leave its life cover empty/); assert.match(p, /Never copy a figure from anywhere but the quote/);
});

/* ---------- 8: the Presentation ---------- */
test('the Presentation\'s current policies table is roomy: its own class, taller rows, more padding, the ACI wording small and cut at four lines with the whole wording as the hover text', () => {
  const pr = app('js/ov-present.js'), css = app('css/present.css');
  assert.ok(/tbl\(\[18, 13, 11, 13, 13, 7, 12, 5, 8\][^\n]*rows, 'pols'\)/.test(pr), 'the class and the wider ACI column'); assert.ok(/function AC\(x\)[\s\S]{0,700}title="/.test(pr), 'the whole wording on hover');
  assert.ok(/\.pres \.ptbl\.pols td \{ padding: 15px 10px; height: 96px; \}/.test(css) && /\.pres \.ptbl\.pols \.a\.aci \{[^}]*font-size: 11\.5px[^}]*-webkit-line-clamp: 4/.test(css), 'padding, height and the small clamped ACI');
});

/* ---------- the contract ---------- */
test('the contract: revision k, the page version 0.92, the layout still 0.1; no key added', () => {
  assert.strictEqual(schema.pageVersion, '0.97'); assert.strictEqual(schema.version, '0.1');
  assert.ok(/Revision k/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8')), 'written in the contract');
});
