/* Client Overview Studio 2.2 (25 November, Paul's next round relayed by the Fix Skills chat at 18:48, after he said "I'll go with your suggestion"): every quote line of the menu (the five servicing quotes, the four new business quotes and, my addition, Proposed
   investments) has a "needed" tick box. It starts PRE-TICKED from what the Fact Find asks for (the BrightRock FNA, shortfall and each reduced row by their own New Business or Servicing type, the standard lane as comparative quotes, an RA or investment quote request as proposed
   investments); the adviser can tick or untick any line (his choice is kept and wins); Load from client folder looks only for the needed quotes and lists any other quote once, collapsed, as "found but not asked for"; the menu reads as a checklist (asked for / loaded /
   outstanding). Without a screen: what the Fact Find asks for (store.factsFrom), calc.needed / calc.checklist, store.setNeeded, check.emptyNotes and the dots. What the menu and the pick list look like on the real page is in tests/browser/t-overview-round220.js.
   Invented clients and numbers only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const val = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { v }]));
const ffOf = (f, l) => JSON.stringify({ app: 'wr-fact-find', schema: '5.5', f: Object.assign(val({ fname: 'Sia', sname: 'Test', net: 'R 60 000.00', ip_age: '65' }), val(f || {})), l: l || {} });
const asked = (f, l) => store.factsFrom(JSON.parse(ffOf(f, l))).asked.blocks;
const filled = (f, l) => { const s = store.blank(); store.fillFromFactFind(s, ffOf(f, l), 'ff.json'); return s; };
const REQ = 'Request a quote';

/* ---------- 1. what the Fact Find asks for ---------- */
test('the BrightRock FNA, shortfall and reduced quotes go to the block of their own type: Servicing to the servicing block, New Business, N/A or empty to the new business block', () => {
  assert.deepStrictEqual(asked({}), {});
  assert.deepStrictEqual(asked({ bf_fna_req: REQ, bf_fna_type: 'New Business' }), { fna: true });
  assert.deepStrictEqual(asked({ bf_fna_req: REQ, bf_fna_type: 'Servicing' }), { svFna: true });
  assert.deepStrictEqual(asked({ bf_fna_req: REQ }), { fna: true }, 'no type: new business');
  assert.deepStrictEqual(asked({ bf_fna_req: REQ, bf_fna_type: 'N/A' }), { fna: true }, 'N/A: new business (my reading)');
  assert.deepStrictEqual(asked({ bf_fna_req: 'Not required', bf_fna_type: 'Servicing' }), {}, 'not required: nothing, whatever the type says');
  assert.deepStrictEqual(asked({ bf_fna_req: 'No FNA done' }), {});
  assert.deepStrictEqual(asked({ bf_sf_req: REQ, bf_sf_type: 'Servicing' }), { svShortfall: true });
  assert.deepStrictEqual(asked({ bf_sf_req: REQ, bf_sf_type: 'New Business' }), { shortfallQuote: true });
  assert.deepStrictEqual(asked({}, { bfred: [{ d: { req: REQ, type: 'Servicing', amt: 'R 900.00' } }] }), { svReduced: true });
  assert.deepStrictEqual(asked({}, { bfred: [{ d: { req: REQ, type: 'New Business', amt: 'R 900.00' } }, { d: { req: REQ, type: 'Servicing', amt: 'R 400.00' } }] }), { reduced: true, svReduced: true }, 'two rows of different types ask for both blocks');
  assert.deepStrictEqual(asked({}, { bfred: [{ d: { req: 'Not required', type: 'Servicing' } }] }), {});
});

test('the standard lane asks for comparative quotes; a retirement annuity or investment quote request asks for proposed investments; a straight increase or reduction is never asked for', () => {
  assert.deepStrictEqual(asked({ fna_req: REQ }), { comparative: true });
  assert.deepStrictEqual(asked({ sf_req: REQ }), { comparative: true });
  assert.deepStrictEqual(asked({}, { redq: [{ d: { req: REQ, type: 'Servicing', amt: 'R 900.00' } }] }), { comparative: true }, 'a standard reduced quote, whatever its type: a comparative quote');
  assert.deepStrictEqual(asked({}, { raq: [{ d: { req: REQ, ins: 'Old Mutual' } }] }), { proposed: true });
  assert.deepStrictEqual(asked({}, { invq: [{ d: { req: REQ, purpose: 'Lump sum', ins: 'Old Mutual' } }] }), { proposed: true });
  assert.deepStrictEqual(asked({}, { raq: [{ d: { req: 'Not required' } }] }), {});
  const all = asked({ bf_fna_req: REQ, bf_sf_req: REQ, fna_req: REQ }, { bfred: [{ d: { req: REQ, type: 'Servicing' } }], raq: [{ d: { req: REQ } }] });
  assert.ok(!all.svIncrease && !all.svReduction, 'nothing in the Fact Find asks for a straight increase or a straight reduction');
  assert.deepStrictEqual(all, { fna: true, shortfallQuote: true, svReduced: true, comparative: true, proposed: true });
});

test('the page keeps the answer in the saved file (factFind.facts.asked.blocks) next to the older sf and comparative', () => {
  const s = filled({ bf_sf_req: REQ, bf_sf_type: 'Servicing' });
  assert.deepStrictEqual(s.factFind.facts.asked.blocks, { svShortfall: true }); assert.strictEqual(s.factFind.facts.asked.sf, true); assert.strictEqual(s.factFind.facts.asked.comparative, false);
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(back.factFind.facts.asked.blocks, { svShortfall: true }, 'it survives Save and Open');
});

/* ---------- 2. needed ---------- */
test('calc.needed: the adviser\'s own tick wins; else what the Fact Find asked for; else nothing is known (null)', () => {
  const blank = store.blank();
  schema.NEED_BLOCKS.forEach(id => assert.deepStrictEqual(calc.needed(blank, id), { on: null, by: 'none' }, id + ': no Fact Find read, nothing known'));
  const s = filled({ bf_fna_req: REQ, bf_fna_type: 'Servicing' });
  assert.deepStrictEqual(calc.needed(s, 'svFna'), { on: true, by: 'factfind' }); assert.deepStrictEqual(calc.needed(s, 'fna'), { on: false, by: 'factfind' }); assert.deepStrictEqual(calc.needed(s, 'svIncrease'), { on: false, by: 'factfind' });
  assert.strictEqual(store.setNeeded(s, 'svIncrease', true), true); assert.deepStrictEqual(calc.needed(s, 'svIncrease'), { on: true, by: 'person' }, 'a straight increase that came up after the Fact Find');
  assert.strictEqual(store.setNeeded(s, 'svFna', false), false); assert.deepStrictEqual(calc.needed(s, 'svFna'), { on: false, by: 'person' });
  assert.strictEqual(s.blocks.svIncrease.needed, true); assert.strictEqual(s.blocks.fna.needed, undefined, 'a block nobody touched stores nothing: it follows the Fact Find');
});

test('only the ten quote blocks have a tick box; a block with no tick box refuses one', () => {
  assert.deepStrictEqual(schema.NEED_BLOCKS, ['svFna', 'svShortfall', 'svReduced', 'svIncrease', 'svReduction', 'fna', 'shortfallQuote', 'reduced', 'comparative', 'proposed']);
  assert.deepStrictEqual(schema.BLOCKS.filter(b => b.need).map(b => b.id), schema.NEED_BLOCKS);
  const s = store.blank(); ['policies', 'group', 'investments', 'other', 'shortfall', 'goals', 'nope'].forEach(id => assert.strictEqual(store.setNeeded(s, id, true), null, id));
});

test('the adviser\'s tick is kept when the Fact Find is read again, and the Fact Find\'s answer is brought up to date', () => {
  const s = filled({ bf_fna_req: REQ }); store.setNeeded(s, 'fna', false); store.setNeeded(s, 'comparative', true);
  store.fillFromFactFind(s, ffOf({ bf_sf_req: REQ }), 'ff.json');
  assert.deepStrictEqual(calc.needed(s, 'fna'), { on: false, by: 'person' }, 'his unticked FNA stays unticked although the Fact Find still asks for it');
  assert.deepStrictEqual(calc.needed(s, 'comparative'), { on: true, by: 'person' });
  assert.deepStrictEqual(calc.needed(s, 'shortfallQuote'), { on: true, by: 'factfind' }, 'a new request in the Fact Find ticks its line');
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.blocks.fna.needed, false); assert.strictEqual(back.blocks.comparative.needed, true, 'and the choice survives Save and Open');
});

/* ---------- 3. the checklist ---------- */
test('the checklist: asked for and nothing loaded is outstanding; asked for and loaded is loaded; loaded but not asked for says so; not asked for is not asked for', () => {
  const s = filled({ bf_fna_req: REQ, bf_sf_req: REQ, bf_sf_type: 'Servicing', fna_req: REQ }), q = store.addQuote(s, 'fna'); q.number = '100880001';
  const x = store.addQuote(s, 'svreduction'); x.number = '100880002';
  let c = calc.checklist(s), r = c.rows;
  assert.deepStrictEqual([r.fna.state, r.fna.text], ['loaded', 'Asked for · loaded (1)']); assert.deepStrictEqual([r.svShortfall.state, r.svShortfall.text], ['outstanding', 'Asked for · outstanding']);
  assert.deepStrictEqual([r.comparative.state, r.comparative.text], ['outstanding', 'Asked for · outstanding']);
  assert.deepStrictEqual([r.svReduction.state, r.svReduction.text], ['extra', 'Loaded (1) · not asked for']); assert.deepStrictEqual([r.reduced.state, r.reduced.text], ['notasked', 'Not asked for']);
  assert.deepStrictEqual([c.asked, c.loaded, c.outstanding, c.known], [3, 1, 2, true]);
  store.setNeeded(s, 'svReduction', true); c = calc.checklist(s); assert.deepStrictEqual([c.asked, c.loaded, c.outstanding], [4, 2, 2], 'ticking a loaded line makes it asked for and loaded');
  const blank = store.blank(); store.addQuote(blank, 'fna').number = '100880003'; c = calc.checklist(blank);
  assert.deepStrictEqual([c.rows.fna.state, c.rows.fna.text, c.rows.reduced.state, c.rows.reduced.text, c.known], ['loaded', 'Loaded (1)', 'unknown', '', false], 'no Fact Find read: nothing is said about what is asked for');
});

test('a proposed investment counts as loaded only once a document or the adviser filled it: the Fact Find\'s own skeleton row is only the request', () => {
  const s = filled({}, { raq: [{ d: { req: REQ, ins: 'Old Mutual', monthly: 'R 2 000.00' } }] });
  assert.strictEqual(s.blocks.proposed.items.length, 1, 'the Fact Find leaves a skeleton row');
  assert.deepStrictEqual([calc.checklist(s).rows.proposed.state, calc.checklist(s).rows.proposed.text], ['outstanding', 'Asked for \u00b7 outstanding'], 'asked for and nothing loaded: outstanding');
  assert.deepStrictEqual(check.emptyNotes(s, {}).proposed, { text: 'Asked for: not loaded yet', all: false, kind: 'part' }); assert.deepStrictEqual(check.emptyNotes(s, { ran: true }).proposed, { text: 'Asked for: no proposal found', all: true, kind: 'red' });
  s.blocks.proposed.items[0].st = 'verify';
  assert.deepStrictEqual([calc.checklist(s).rows.proposed.state, calc.checklist(s).rows.proposed.n], ['loaded', 1], 'a document read into it (amber until checked) counts');
  assert.ok(!check.emptyNotes(s, { ran: true }).proposed, 'and then there is no "nothing there" note');
  const t = store.blank(); assert.strictEqual(calc.checklist(t).rows.proposed.n, 0);
});

test('a shortfall line asked for with no group risk is "Not needed: no group risk", neither asked for nor outstanding', () => {
  const s = filled({ bf_sf_req: REQ, bf_sf_type: 'New Business' });                                       // no group risk in this client
  assert.ok(!calc.hasGroupRisk(s)); const r = calc.checklist(s).rows.shortfallQuote, c = calc.checklist(s);
  assert.deepStrictEqual([r.state, r.text], ['nogroup', ''], 'the checklist line is silent; the menu\'s own note says why'); assert.strictEqual(c.asked, 0); assert.strictEqual(c.outstanding, 0);
  assert.deepStrictEqual(check.emptyNotes(s, {}).shortfallQuote, { text: 'Not needed: no group risk', all: false, kind: 'na' });
  store.addQuote(s, 'shortfall').number = '100880010'; assert.strictEqual(calc.checklist(s).rows.shortfallQuote.state, 'loaded', 'a quote that is there is loaded whatever');
});

test('a new review year does not carry last year\'s requests: the lines are asked for again only when this year\'s Fact Find is read', () => {
  const old = filled({ bf_fna_req: REQ, fna_req: REQ }); store.setNeeded(old, 'svIncrease', true);
  assert.deepStrictEqual(old.factFind.facts.asked.blocks, { fna: true, comparative: true });
  const s = store.startReview(old, '01/01/2027').state;
  assert.strictEqual(s.factFind.facts.asked.blocks, undefined, 'last year\'s asked-for blocks are not carried');
  schema.NEED_BLOCKS.forEach(id => assert.strictEqual(calc.needed(s, id).on, null, id + ': nothing is known until this year\'s Fact Find is read'));
  assert.strictEqual(s.blocks.svIncrease.needed, undefined, 'and the adviser\'s tick of last year is not carried either');
  store.fillFromFactFind(s, ffOf({ bf_sf_req: REQ }), 'ff2.json'); assert.deepStrictEqual(s.factFind.facts.asked.blocks, { shortfallQuote: true });
});

/* ---------- 4. the checks and the dots ---------- */
test('a quote block that is not needed says "Not asked for" and is dashed, never red; a needed one waits and is red only once the folder was searched; an older file keeps the earlier words', () => {
  const s = filled({ bf_fna_req: REQ, bf_sf_req: REQ, bf_sf_type: 'Servicing' });
  const n = check.emptyNotes(s, {}), nr = check.emptyNotes(s, { ran: true });
  assert.deepStrictEqual(n.reduced, { text: 'Not asked for', all: false, kind: 'na' }); assert.deepStrictEqual(n.comparative, { text: 'Not asked for', all: false, kind: 'na' }); assert.deepStrictEqual(n.svFna, { text: 'Not asked for', all: false, kind: 'na' });
  assert.deepStrictEqual(n.fna, { text: 'Asked for: not loaded yet', all: false, kind: 'part' }); assert.deepStrictEqual(n.svShortfall, { text: 'Asked for: not loaded yet', all: false, kind: 'part' });
  assert.deepStrictEqual(nr.fna, { text: 'No FNA quote found', all: true, kind: 'red' }); assert.deepStrictEqual(nr.svShortfall, { text: 'Asked for: none found in the folder', all: true, kind: 'red' }); assert.strictEqual(nr.reduced.kind, 'na', 'not asked for: not red even after the search');
  const d = check.run(s, { ran: true }).dots; assert.strictEqual(d.fna, 'red'); assert.strictEqual(d.svShortfall, 'red'); assert.strictEqual(d.reduced, 'na'); assert.strictEqual(d.svIncrease, 'na'); assert.strictEqual(d.comparative, 'na');
  const old = filled({}); delete old.factFind.facts.asked.blocks;
  const o = check.emptyNotes(old, { ran: true }); assert.strictEqual(o.fna.text, 'No FNA quote found'); assert.strictEqual(o.comparative.text, 'No comparative quotes'); assert.strictEqual(o.svFna.text, 'Not requested', 'an overview with no record of what was asked for: the earlier words');
});

test('a block the adviser ticked is needed whatever the Fact Find says, and one he unticked is not', () => {
  const s = filled({ bf_fna_req: REQ }); store.setNeeded(s, 'fna', false); store.setNeeded(s, 'svIncrease', true);
  const n = check.emptyNotes(s, { ran: true });
  assert.strictEqual(n.fna.kind, 'na'); assert.strictEqual(n.svIncrease.all, true); assert.strictEqual(n.svIncrease.text, 'Asked for: none found in the folder');
  const q = store.addQuote(s, 'fna'); q.number = '100880004'; assert.ok(!check.emptyNotes(s, { ran: true }).fna, 'a loaded block has no "nothing there" note, ticked or not');
});

test('proposed investments: not asked for is dashed; asked for and none is outstanding', () => {
  let s = filled({}); assert.deepStrictEqual(check.emptyNotes(s, {}).proposed, { text: 'Not asked for', all: false, kind: 'na' });
  s = filled({ bf_fna_req: REQ }); store.setNeeded(s, 'proposed', true); assert.deepStrictEqual(check.emptyNotes(s, {}).proposed, { text: 'Asked for: not loaded yet', all: false, kind: 'part' });
  assert.deepStrictEqual(check.emptyNotes(s, { ran: true }).proposed, { text: 'Asked for: no proposal found', all: true, kind: 'red' });
});

/* ---------- 5. the Fact Find changed? ---------- */
test('an overview read before the asked-for blocks were kept does not say the Fact Find changed; a real change of the quotes asked for is ONE item', () => {
  const s = filled({ bf_sf_req: REQ }); delete s.factFind.facts.asked.blocks;
  assert.strictEqual(store.fillFromFactFind(s, ffOf({ bf_sf_req: REQ }), 'ff.json').changed, 0, 'only the new key is new');
  assert.deepStrictEqual(s.factFind.facts.asked.blocks, { shortfallQuote: true });
  assert.strictEqual(store.fillFromFactFind(s, ffOf({ bf_sf_req: 'Not required', fna_req: REQ }), 'ff.json').changed, 1, 'the quotes asked for are one answer of the Fact Find, however many of their keys moved');
});

/* ---------- 6. Load and the screen ---------- */
test('Load ticks only the needed quotes, lists the others once and collapsed, and ticking one ticks its block; the menu has the box, the line and the summary', () => {
  const ui = app('js/ov-ui.js'), css = app('css/overview.css');
  assert.ok(/notAsked\.has\(f\)\) return false/.test(ui) && /calc\.needed\(state, blk\)\.on === false/.test(ui), 'tickPlan leaves a quote of a block that is not needed unticked (and nothing is known: nothing is held back)');
  assert.ok(/<details class="pknot"' \+ \(anyAsked \? '' : ' open'\) \+ '><summary>Found but not asked for \(/.test(ui) && /No quote line is ticked as needed \(the Fact Find asks for none\)/.test(ui), 'the others are listed once, collapsed (open, with a sentence, when no line is needed at all)');
  assert.ok(/c\.bare && blk === 'svIncrease'/.test(ui) && /schema\.blockOfQuote\[r\.quote\.kind\]/.test(ui), 'a bare Serv quote is asked for when either straight line is, and ticks the block its premium put it in');
  assert.ok(/calc\.needed\(state, schema\.blockOfQuote\[r\.quote\.kind\]\)\.on === false\) store\.setNeeded\(state, schema\.blockOfQuote\[r\.quote\.kind\], true\)/.test(ui) && /calc\.needed\(state, 'proposed'\)\.on === false\) store\.setNeeded\(state, 'proposed', true\)/.test(ui), 'a quote read into a block that was not needed ticks it');
  assert.ok(/needSpanHTML\(b\)/.test(ui) && /stateHTML\(b\.id\)/.test(ui) && /data-needblock/.test(ui) && /data-navsum/.test(ui) && /toggleNeed\(/.test(ui), 'the menu: the tick box, the checklist line, the summary, and the real check box on the block\'s own page');
  assert.ok(/\.need\.on/.test(css) && /\.navstate/.test(css) && /\.needbox/.test(css) && /details\.pknot/.test(css), 'the styles');
});

test('the page is 2.2 (the decimal after 2.1), the layout stays 0.1, and the saved file gains the optional keys of revision q', () => {
  assert.strictEqual(schema.pageVersion, '2.2'); assert.strictEqual(schema.version, '0.1'); assert.ok(parseFloat(schema.pageVersion) > parseFloat('2.1'), 'compared as decimals');
  const html = app('overview.html'); ['ov-schema', 'ov-calc', 'ov-store', 'ov-check', 'ov-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261125c').test(html), f)); assert.ok(/css\/overview\.css\?v=20261125c/.test(html), 'overview.css');
  const contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8');
  assert.ok(/Revision q/.test(contract) && /blocks\.<id>\.needed|`needed`/.test(contract) && /asked\.blocks/.test(contract), 'the contract says revision q and lists the two keys');
});
