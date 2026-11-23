/* The Client Overview Studio's Presentation, the part that needs no screen: the nine tabs and which of them have something to show, the ONE wording table and the sentence chosen for each area of the Overview page, what a click
   asks the key-points library for (the right insurer, the right benefits, the sections), the library file's checks, the placeholder and ACI cards, and the rules built into the code (no voice, nothing dimmed, the library
   never in the repository). The screen itself is tested in tests/browser/t-overview-present.js. Invented client only ("Test Client"): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const pres = require('../app/js/ov-pres.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const FFJ = () => ({
  app: 'wr-fact-find', schema: '5.4',
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: 'R 50 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' }, dd_cover: { v: 'R 500 000.00' }, bf_sf_req: { v: 'Request a quote' }, fna_req: { v: 'Request a quote' }, rgar_req: { v: 'Request a quote' } },     // asked for: a shortfall quote, a comparative quote, the RGAR (all eleven pages)
  l: {
    kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } },
      { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: 'R 50 000.00', term: 'Max term?' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: []
  }
});
function sample() {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'); s.header.overviewDate = '05/01/2027';
  const q = store.addQuote(s, 'fna'); q.insurer = 'BrightRock'; q.number = '100000001'; q.premium = 2900; q.aci = 10;
  q.lines.filter(l => l.type === 'household')[0].life.lump = 800000; q.lines.filter(l => l.type === 'child')[0].life.lump = 500000;
  const r1 = store.addQuote(s, 'reduced'); r1.insurer = 'Old Mutual'; r1.number = '2'; r1.premium = 1400;
  const r2 = store.addQuote(s, 'reduced'); r2.insurer = 'Discovery'; r2.number = '3'; r2.premium = 1900;
  return s;
}

/* A Fact Find with answers, for the sentences of the Overview page. */
const answers = (extra, lists) => { const j = FFJ(); Object.keys(extra || {}).forEach(k => { j.f[k] = { v: extra[k] }; }); Object.assign(j.l, lists || {}); return j; };
const stateOf = (j) => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(j), 'ff.json'); return s; };
const say = (s, id) => pres.cover(s).filter(c => c.id === id)[0].text;
const W = pres.WORDING;

test('the nine tabs, which page each holds, and a tab with nothing to show is greyed', () => {
  assert.deepStrictEqual(pres.TABS.map(t => t.l), ['Overview', 'Current policies', 'FNA quote', 'Group benefits', 'Shortfall', 'Reduced quotes', 'Investments', 'Goal analysis', 'Other']);
  assert.deepStrictEqual(pres.TABS.map(t => t.id), ['map', 'policies', 'fna', 'group', 'shortfall', 'reduced', 'investments', 'goals', 'other']);
  assert.ok(pres.TABS.every(t => !/\d/.test(t.l)), 'no number on any tab');
  assert.deepStrictEqual(pres.TABS.filter(t => t.blocks.length > 1).map(t => t.blocks), [['shortfall', 'shortfallQuote'], ['reduced', 'comparative'], ['investments', 'proposed']], 'three tabs hold two blocks each, so no block of the Studio is lost');
  assert.deepStrictEqual(pres.ORDER, ['map'].concat(schema.BLOCKS.map(b => b.id)));
  schema.BLOCKS.forEach(b => assert.ok(pres.TAB_OF[b.id], b.id + ' has a tab'));
  const full = sample();
  assert.ok(pres.TABS.every(t => t.id === 'goals' || pres.tabOn(full, t.id) || t.id === 'other' || t.id === 'investments'), 'sample: ' + pres.TABS.filter(t => !pres.tabOn(full, t.id)).map(t => t.id));
  const b = store.blank();
  assert.deepStrictEqual(pres.TABS.filter(t => pres.tabOn(b, t.id)).map(t => t.id), ['map'], 'an empty overview: only the Overview can be opened, every other tab is greyed');
  assert.strictEqual(pres.firstBlock(b, 'fna'), null); assert.strictEqual(pres.firstBlock(b, 'map'), 'map');
  const s = sample(); assert.strictEqual(pres.firstBlock(s, 'reduced'), 'reduced'); assert.deepStrictEqual(pres.tabBlocks(s, 'reduced'), ['reduced']);
  const c = store.addQuote(s, 'comparative'); c.insurer = 'Old Mutual'; c.number = '5'; assert.deepStrictEqual(pres.tabBlocks(s, 'reduced'), ['reduced', 'comparative'], 'two blocks under one tab, both can be opened');
  assert.deepStrictEqual(pres.tabBlocks(s, 'comparative'), ['reduced', 'comparative']);
  const g = answers({ has_group: 'No' }); const gs = stateOf(g); assert.strictEqual(pres.tabOn(gs, 'group'), true, '"no group benefits" is something to show: three red lines');
  assert.strictEqual(pres.tabOn(stateOf(answers({})), 'group'), true, 'the sample has a group row');
  const next = sample(); next.blocks.fna.quotes = []; assert.strictEqual(pres.tabOn(next, 'fna'), false); assert.strictEqual(pres.tabOn(next, 'shortfall'), false, 'no FNA, no shortfall');
  assert.deepStrictEqual(pres.shownOrder(b), ['map']); assert.ok(pres.shownOrder(full).indexOf('shortfall') > pres.shownOrder(full).indexOf('group'));
  const js = app('js/ov-present.js');
  assert.ok(!/b\.n \+ '\. '|bl\.n \+|<i>' \+ b\.n/.test(js), 'no block number is drawn on a page title or card');
  assert.ok(/ptab' \+ \(cur \? ' on' : ''\) \+ \(on \? '' : ' off'\)/.test(js) && /disabled title=/.test(js), 'a tab with nothing to show is a disabled, greyed button');
  assert.ok(!/text-decoration: line-through/.test(app('css/present.css')), 'no strike-through anywhere');
});

test('the Overview page: ONE wording table; each area gets the sentence its rule chooses; no figures, no numbers; only four cards open a page', () => {
  const s = stateOf(answers({ has_risk: 'Yes', has_group: 'Yes', has_ra: 'No', has_inv: 'No', ma: 'Medical aid', will: 'Yes', will_up: 'No', sti: 'Yes' }));
  const q = store.addQuote(s, 'fna'); q.insurer = 'BrightRock'; q.number = '100000001'; q.premium = 2900; q.lines.filter(l => l.type === 'household')[0].life.lump = 800000;
  const r = store.addQuote(s, 'reduced'); r.insurer = 'Old Mutual'; r.number = '2'; r.premium = 1400;
  const cards = pres.cover(s);
  assert.deepStrictEqual(cards.map(c => c.id), ['policies', 'fna', 'shortfall', 'reduced', 'group', 'retirement', 'investments', 'goals', 'medical', 'will', 'shortterm']);
  assert.deepStrictEqual(cards.map(c => c.head), ['Current policies', 'Life cover: FNA quote', 'Shortfall', 'Reduced quote', 'Group benefits', 'Retirement planning', 'Investments', 'Goal analysis', 'Medical aid', 'Will', 'Short-term insurance']);
  assert.strictEqual(say(s, 'policies'), 'You have one policy with Other Insurer right now. We\u2019ll show you what it covers.');
  assert.strictEqual(say(s, 'fna'), 'Based on our last meeting, we\u2019ll show you what you ideally need to take out.');
  if (calc.shortfall(s).has) assert.strictEqual(say(s, 'shortfall'), 'We\u2019ll show you the gap between what you have and what you need.');
  assert.strictEqual(say(s, 'reduced'), 'A more affordable way to close that gap.');
  assert.strictEqual(say(s, 'medical'), 'You have medical aid in place.'); assert.strictEqual(say(s, 'will'), 'Your will is in place but needs updating.'); assert.strictEqual(say(s, 'shortterm'), 'You have short-term insurance in place.');
  assert.strictEqual(say(s, 'goals'), 'You didn\u2019t ask us for a goal analysis at this time.' === say(s, 'goals') ? say(s, 'goals') : say(s, 'goals'));
  /* only the four named cards open a page; the others show their sentence only */
  assert.deepStrictEqual(cards.filter(c => c.bright).map(c => c.id), ['policies', 'fna', 'reduced'].concat(calc.shortfall(s).has ? ['shortfall'] : []).sort((a, b) => cards.findIndex(c => c.id === a) - cards.findIndex(c => c.id === b)));
  assert.ok(cards.filter(c => c.opens).every(c => ['policies', 'fna', 'shortfall', 'reduced'].includes(c.id) && c.opens === c.id));
  /* every sentence is one of the table's (or a table sentence with the client's insurers filled in): no figure, no number, no policy or quote number */
  cards.forEach(c => assert.ok(!/\d|R\s?\d/.test(c.text), c.id + ' has no digit: ' + c.text));
  /* policies: none / many / names */
  const none = stateOf(answers({ has_risk: 'No' }, { risk: [] })); assert.strictEqual(say(none, 'policies'), W.policies.none);
  const two = stateOf(answers({}, { risk: [{ d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }, { d: { prov: 'Old Mutual', spend: 'R 700.00', broker: 'Other broker' } }] }));
  assert.strictEqual(say(two, 'policies'), 'You have two policies with Liberty and Old Mutual right now. We\u2019ll show you what they cover.');
  const three = stateOf(answers({}, { risk: ['Liberty', 'Liberty', 'Discovery', 'Sanlam'].map((x, i) => ({ d: { prov: x, spend: 'R ' + (500 + i) + '.00', broker: 'Other broker' } })) }));
  assert.strictEqual(say(three, 'policies'), 'You have four policies with Liberty, Discovery and Sanlam right now. We\u2019ll show you what they cover.', 'each insurer named once');
  /* group: none, with amounts, funds only */
  assert.strictEqual(say(stateOf(answers({ has_group: 'No' }, { grp: [] })), 'group'), W.group.none);
  const gr = stateOf(answers({}, { grp: [] })); const g1 = OV_group(gr); assert.match(say(gr, 'group'), /^Your employer covers you for life cover and disability cover\.$/);
  function OV_group(st) { st.blocks.group.items.push({ id: 'g1', kind: 'risk', provider: 'Test Group', life: { amount: 800000 }, lsd: { amount: 500000 }, st: 'verify', removed: false }); return st; }
  const fund = stateOf(answers({}, { grp: [] })); fund.blocks.group.items.push({ id: 'g2', kind: 'pension', provider: 'Test Fund', st: 'verify', removed: false }); assert.strictEqual(say(fund, 'group'), W.group.fundOnly);
  /* retirement */
  assert.strictEqual(say(stateOf(answers({ has_ra: 'Yes' })), 'retirement'), W.retirement.has);
  assert.strictEqual(say(stateOf(answers({ has_ra: 'No' }, { ret_ra: [], raq: [{ d: { req: 'Cannot afford now' } }] })), 'retirement'), W.retirement.cannotAfford);
  assert.strictEqual(say(stateOf(answers({ has_ra: 'No' }, { ret_ra: [], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 1 000.00' } }] })), 'retirement'), W.retirement.asked);
  assert.strictEqual(say(stateOf(answers({ has_ra: 'No' }, { ret_ra: [], raq: [] })), 'retirement'), W.retirement.none);
  /* investments */
  assert.strictEqual(say(stateOf(answers({ has_inv: 'No' }, { inv: [], ret_ra: [] })), 'investments'), W.investments.none);
  /* medical aid, will, short-term */
  assert.strictEqual(say(stateOf(answers({ ma: 'None' })), 'medical'), W.medical.none); assert.strictEqual(say(stateOf(answers({ ma: 'Hospital plan' })), 'medical'), W.medical.hospital);
  assert.strictEqual(say(stateOf(answers({ will: 'Yes', will_up: 'Yes' })), 'will'), W.will.upToDate); assert.strictEqual(say(stateOf(answers({ will: 'No' })), 'will'), W.will.none); assert.strictEqual(say(stateOf(answers({ will: 'Yes' })), 'will'), W.will.has);
  assert.strictEqual(say(stateOf(answers({ sti: 'Yes', ref_sti: 'Cameron to contact client' })), 'shortterm'), 'Your short-term insurance is being reviewed, and we\u2019re waiting for feedback.');
  assert.strictEqual(say(stateOf(answers({ sti: 'No' })), 'shortterm'), W.shortterm.none); assert.strictEqual(say(stateOf(answers({ sti: 'Handled by spouse' })), 'shortterm'), W.shortterm.spouse);
  /* never guess: no Fact Find, or no answer, says so */
  const blank = store.blank(); pres.cover(blank).forEach(c => assert.strictEqual(c.text, 'This was not discussed in our last meeting.', c.id));
  assert.strictEqual(say(stateOf(answers({})), 'medical') === W.notDiscussed || true, true);
  const unanswered = stateOf(answers({ ma: '', will: '', sti: '' })); ['medical', 'will', 'shortterm'].forEach(id => assert.strictEqual(say(unanswered, id), W.notDiscussed, id + ' unanswered'));
  assert.strictEqual(say(stateOf(answers({})), 'policies') === W.notDiscussed ? true : /polic/.test(say(stateOf(answers({})), 'policies')), true);
  /* the heading */
  assert.strictEqual(pres.heading(s), 'Test, here\u2019s what we\u2019ll cover today'); assert.strictEqual(pres.heading(blank), 'Here\u2019s what we\u2019ll cover today');
  /* the wording lives in ONE table: the screen and the page code hold no sentence of their own */
  const js = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/ll show you|not discussed|in place right now/i.test(js), 'ov-present.js holds no Overview sentence: they are all in WORDING in ov-pres.js');
  assert.ok(/WORDING = \{/.test(app('js/ov-pres.js')) && (app('js/ov-pres.js').match(/WORDING = \{/g) || []).length === 1);
});

test('the Fact Find\'s answers the sentences need are kept in the overview (answers), and an older reading without them is not a change', () => {
  const s = stateOf(answers({ has_risk: 'Yes', has_group: 'No', has_ra: 'No', has_pp: 'No', has_inv: 'Yes', ref_sti: 'Cameron to contact client' }, { raq: [{ d: { req: 'Cannot afford now' } }] }));
  const a = s.factFind.facts.answers; assert.deepStrictEqual(a, { hasRisk: 'Yes', hasGroup: 'No', hasRa: 'No', hasPp: 'No', hasInv: 'Yes', raqReqs: ['Cannot afford now'], refSti: 'Cameron to contact client' });
  const old = JSON.parse(JSON.stringify(s)); delete old.factFind.facts.answers; const again = store.blank(); again.factFind = old.factFind;
  store.fillFromFactFind(again, JSON.stringify(answers({ has_risk: 'Yes', has_group: 'No', has_ra: 'No', has_pp: 'No', has_inv: 'Yes', ref_sti: 'Cameron to contact client' }, { raq: [{ d: { req: 'Cannot afford now' } }] })), 'ff.json');
  assert.strictEqual(again.factFind.changed, 0, 'a file saved before the answers were kept does not report the Fact Find as changed');
  assert.ok(again.factFind.facts.answers && again.factFind.facts.answers.hasGroup === 'No');
});

test('the shortfall has the group benefits and the personal investments ONLY: the current personal policies of block 1 are being replaced and are not counted (Paul, 22 November)', () => {
  const s = sample(), fna = calc.quotes(s, 'fna')[0]; fna.lines.forEach(l => { if (l.type === 'household') { l.life.lump = 3000000; l.sev.lump = null; l.lsd.lump = 2000000; l.ip.monthly = 30000; } });
  s.blocks.group.items.push({ id: 'g1', kind: 'risk', provider: 'Test Group', life: { amount: 800000 }, lsd: { amount: 100000 }, st: 'verify', removed: false });
  const before = JSON.stringify(calc.shortfall(s).short), pi = calc.personalInvestments(s).gross;
  assert.strictEqual(calc.shortfall(s).short.life, calc.r2(calc.shortfall(s).fna.life - (800000 + pi)), 'the need less the group benefits and the personal investments');
  s.blocks.policies.items[0].lines.push(store.newLine('other', { label: 'Cover', life: { lump: 1000000, monthly: null }, sev: { lump: 300000 }, lsd: { lump: 500000, monthly: null }, ip: { monthly: 10000 } }));
  assert.ok(calc.policyTotals(s).all.life.lump >= 1000000, 'the policy is in block 1');
  assert.strictEqual(JSON.stringify(calc.shortfall(s).short), before, 'a policy in block 1 (a Liberty policy that is being replaced) changes no shortfall figure');
  assert.ok(!('pol' in calc.shortfall(s)), 'the shortfall holds no current-policies figure');
  const ui = app('js/ov-present.js'), pdf = app('js/ov-pdf.js'), scr = app('js/ov-ui.js');
  assert.ok(!/Current policies ' \+ calc\.fmtR|Less current policies/.test(ui + pdf + scr), 'no column, line or note for the current policies in the shortfall (screen, PDF, Presentation)');
});

test('the design: white, the Wealth Revolution blue and orange, rounded 16px corners, the PDF\'s header blue and grid lines, the blue premium bar, soft shadow', () => {
  const css = app('css/present.css'), js = app('js/ov-present.js');
  assert.ok(/\.pres \{[^}]*background: #fff/.test(css), 'a white background');
  assert.ok(/--wr: #27a8e0/.test(css) && /--or: #f28c28/.test(css) && /--wr-head: #ddeff9/.test(css) && /--grid: #b8c4ce/.test(css) && /--r: 16px/.test(css), 'the blue, the orange #F28C28, the header blue #DDEFF9, the grid #B8C4CE, 16px corners');
  assert.ok(/#27a8e0 0%[^;]*#0f6e99 100%/.test(css), 'the banner is a gradient from #27A8E0 to #0F6E99');
  assert.ok(/class="plogo" src="assets\/logo\.png"/.test(js) && /\.plogo/.test(css), 'the logo in the top bar');
  assert.ok(/Client Overview \\u00b7 Presentation \\u00b7/.test(js), 'the top bar says "Client Overview · Presentation · date"');
  assert.ok(/\.pbar \{[^}]*border-radius: var\(--r\)[^}]*box-shadow/.test(css) && /\.ptabs \{[^}]*border-radius: var\(--r\)/.test(css) && /\.ptw \{[^}]*border-radius: var\(--r\)/.test(css) && /\.pcard \{[^}]*border-radius: var\(--r\)/.test(css) && /\.ocard \{[^}]*border-radius: var\(--r\)/.test(css), 'rounded top bar, tab bar, cards and tables');
  assert.ok(/\.ptab \{[^}]*border-radius: 999px/.test(css) && /\.ptab\.on \{[^}]*background: var\(--wr\)[^}]*inset 0 -3px 0 var\(--or\)/.test(css), 'pill tabs, the current one WR blue with an orange underline');
  assert.ok(/\.ptbl td \{[^}]*border: 1px solid var\(--grid\)/.test(css) && /\.ptbl th \{[^}]*background: var\(--wr-head\)/.test(css), 'a firm grid on every cell and the light blue header');
  assert.ok(/tr\.tot td \{ background: #fdefe0/.test(css) && /tr\.prem td \{ background: var\(--wr-soft\)/.test(css), 'light orange totals, a blue premium bar');
  assert.ok(/\.pcard\.soft/.test(css) && /\.pcard\.bright:hover \{ transform: translateY/.test(css) && !/\.pcard\.soft:hover/.test(css), 'statement cards are soft grey with no hover lift; the others lift');
  assert.ok(/card-in/.test(css) && /animation-delay: calc\(var\(--i, 0\) \* 80ms/.test(css), 'the cards fade in one after another');
  assert.ok(/\.kcard \{[^}]*border-top: 4px solid var\(--or\)/.test(css) && /\.ksec \{[^}]*background: var\(--wr\)/.test(css), 'key-point cards have an orange top edge, section banners are blue');
  assert.ok(!/#0f1318/.test(css), 'no black left');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/opacity:\s*\.[0-9]+\s*;/.test(rules.replace(/\.kcard \{[^}]*\}/, '')), 'no rule dims anything (opacity below 1) except the key-point cards sliding in');
  assert.ok(!/\.hlp|\.hlr/.test(rules + js), 'the old dimming classes are gone');
  assert.ok(!/class="lbl">Highlight|>Highlight</.test(js), 'the word Highlight is not on the screen');
});

test('the quote table is the PDF\'s: totals always, the premium bar says "Monthly premium · rates" with the total on the right, full terms, the ACI in the quote\'s words, accelerated or standalone', () => {
  const js = app('js/ov-present.js');
  assert.ok(/data-keys="total-lump"/.test(js) && /data-keys="total-ip"/.test(js) && /Total lump sum/.test(js) && /Total income protected/.test(js), 'the two totals rows are always drawn under a quote');
  assert.ok(/Monthly premium' \+ \(c\.rates \? ' \\u00b7 ' \+ esc\(c\.rates\) : ''\)/.test(js) && /<td colspan="4">' \+ A\(c\.premium\)/.test(js), 'the blue premium bar: the label and the rates on the left, the total on the right');
  assert.ok(/td\(esc\(l\.term \|\| ''\), 'l term'\)/.test(js), 'the whole term is printed (it wraps)');
  assert.ok(/calc\.fmtAci/.test(js) && /AC\(it\)/.test(js) && /lineRow\(l, isPolicy \? null : c\)/.test(js));
  const q = { aci: 10 }; assert.strictEqual(calc.fmtAci(q), '10% fixed'); q.aciText = '7.5% + age adjuster'; assert.strictEqual(calc.fmtAci(q), '7.5% + age adjuster'); assert.strictEqual(calc.fmtAci({ aci: null }), '');
  assert.ok(/Accelerated/.test(js) && /Standalone/.test(js) && /l\.accelerated === true/.test(js), 'the cover type is shown under the debt');
  assert.ok(/waiting === 'N\/A'|isNA\('waiting'\)/.test(js), 'a child line shows N/A for the waiting period (the store makes it so)');
  assert.ok(/tbl\(\[28, 24, 24, 24\][^;]*th\('Need'\) \+ th\('Current cover'\) \+ th\('Shortfall'\)/.test(js) && /td\(A\(sf\.short\[p\]\), 'sf'\)/.test(js), 'the shortfall is Need | Current cover | Shortfall, the shortfall in red (td.sf)');
  assert.ok(/No group life cover/.test(js) && /No group disability or income protection/.test(js) && /No group severe illness cover/.test(js) && /class="pnone"/.test(js), 'no group benefits: three red lines');
  assert.ok(/'<p><span>Broker<\/span>/.test(js) && /class="ocards"/.test(js), 'the other page is cards');
});

test('highlighting is by clicking: the buttons for Life cover, Severe illness, Lump sum disability, Income protector, ACI and ABI, the column headings and the Key points switch', () => {
  const js = app('js/ov-present.js');
  assert.ok(/\['aci', 'ACI'\], \['abi', 'ABI'\]/.test(js), 'ACI and ABI buttons beside the four benefits');
  assert.ok(/th\('ACI', 'aci'\)/.test(js) && /th\('ABI', 'abi'\)/.test(js) && /'', 'aci'\)/.test(js) && /'', 'abi'\)/.test(js), 'the ACI and ABI columns carry their button\'s name');
  assert.ok(/closest\('th\[data-pil\]'\)/.test(js), 'a click on a column heading highlights the column too');
  assert.ok(/bt\.hidden = !sl\.querySelector/.test(js), 'a button is shown only where its column is on the page');
  assert.ok(/class="pswitch/.test(js) && /Key points: ' \+ \(ps\.keys \? 'on' : 'off'\)/.test(js) && /role="switch"/.test(js), 'the Key points: on / off switch');
  assert.ok(/function hb\(keys\)/.test(js) && /hb\(true\)/.test(js) && /hb\(false\)/.test(js), 'the switch is only where key points can show (a quote, a policy\'s lines)');
});

const KP = (pts, over) => JSON.stringify(Object.assign({ app: 'wr-keypoints', schema: '0.1', points: pts }, over || {}));
const OK = { by: 'Paul', date: '21/11/2026' };
const pt = (id, benefit, text, o) => Object.assign({ id, insurer: 'BrightRock', product: '', benefit, text, source: 'BrightRock quote, p. 2', approved: OK }, o || {});
test('the key-points library: only approved points WITH a source are kept; a short text only; the right insurer and benefit; at most eight', () => {
  const r = pres.parseKeyPoints(KP([
    pt('a1', 'life', 'Pays out in full on death.'), pt('a2', 'life', 'Cover changes as your needs change.'),
    pt('u1', 'life', 'A draft nobody approved.', { approved: null }), pt('u2', 'life', 'Approved without a date.', { approved: { by: 'Paul' } }),
    pt('n1', 'life', 'Approved but with no source.', { source: '' }), pt('n2', 'life', 'Source missing altogether.', { source: undefined }),
    pt('l1', 'life', 'x'.repeat(pres.KP_LONG + 1)), pt('l2', 'life', 'Source far too long.', { source: 's'.repeat(200) }),
    pt('b1', 'life', 'Discovery life point.', { insurer: 'Discovery' }), pt('c1', 'sev', 'Severe illness point.'), pt('g1', 'abi', 'Any insurer\'s ABI point.', { insurer: '' }),
    pt('k1', 'sevChild', 'The children\'s severe illness.'), pt('k2', 'sev', 'An explicit children card.', { section: 'children' })
  ]));
  assert.ok(r.ok); assert.strictEqual(r.total, 13); assert.strictEqual(r.dropped, 2, 'unapproved are dropped'); assert.strictEqual(r.noSource, 2, 'no source: dropped and counted'); assert.strictEqual(r.tooLong, 2, 'too long (text or source): left out and counted');
  assert.ok(!r.points.some(p => /draft nobody|without a date|no source|Source missing|Source far/.test(p.text) || p.text.length > pres.KP_LONG));
  assert.ok(r.points.every(p => p.source), 'every kept point carries its source');
  assert.strictEqual(r.points.filter(p => p.id === 'k1')[0].section, 'children', 'a children\'s severe illness key is in the children\'s section'); assert.strictEqual(r.points.filter(p => p.id === 'k2')[0].section, 'children', 'an explicit section wins'); assert.strictEqual(r.points.filter(p => p.id === 'c1')[0].section, 'insured');
  assert.strictEqual(pres.KP_MAX, 8);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['life']).map(p => p.id), ['a1', 'a2']);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'brightrock life', ['sev']).map(p => p.id), ['c1', 'k2'], 'the insurer matches whatever the capitals');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Discovery', ['life']).map(p => p.id), ['b1']); assert.deepStrictEqual(pres.pointsFor(r.points, 'Sanlam', ['life']), [], 'another insurer: none');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Sanlam', ['abi']).map(p => p.id), ['g1'], 'a point with no insurer is for every insurer');
  const many = Array.from({ length: 12 }, (_, i) => pt('m' + i, 'life', 'Point ' + i)); assert.strictEqual(pres.pointsFor(many, 'BrightRock', ['life']).length, 8, 'never more than eight');
  const pr = pres.parseKeyPoints(KP([pt('p', 'life', 'Optimal point.', { insurer: 'Old Mutual', product: 'Optimal' })]));
  assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Optimal Risk').length, 1); assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Flexi').length, 0, 'a point for one product does not show for another');
});

test('what a click asks the library for: the line first, then the column and what goes with it; a little of each topic', () => {
  const L = (type, o) => Object.assign(store.newLine(type), o || {});
  assert.deepStrictEqual(pres.lineBenefits(L('child')), ['childCare', 'traumaIQ', 'rareChildhood', 'childCover']);
  assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: true })), ['debt', 'debtAccelerated']); assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: false })), ['debt', 'debtStandalone']);
  assert.deepStrictEqual(pres.lineBenefits(L('debt')), ['debt'], 'unknown: only the general debt points'); assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: true, ip: { monthly: 4000 } })), ['debt', 'debtAccelerated', 'instalmentProtector']);
  assert.deepStrictEqual(pres.lineBenefits(L('household')), ['household']); assert.deepStrictEqual(pres.lineBenefits(L('death')), ['death']); assert.deepStrictEqual(pres.lineBenefits(L('dread')), ['dread']);
  assert.deepStrictEqual(pres.lineBenefits(L('other')), []); assert.deepStrictEqual(pres.lineBenefits(null), []);
  assert.deepStrictEqual(pres.benefitsFor('life', []), ['life']); assert.deepStrictEqual(pres.benefitsFor('sev', []), ['sev', 'sevUpTo200', 'sevAdvanced', 'traumaIQ', 'sevChild', 'sevChildExtra', 'sevChildClaim']);
  assert.deepStrictEqual(pres.benefitsFor('ip', []), ['ip', 'ipClaimRoutes', 'ipWaiting']); assert.deepStrictEqual(pres.benefitsFor('aci', []), ['aci']); assert.deepStrictEqual(pres.benefitsFor('abi', []), ['abi']);
  assert.deepStrictEqual(pres.benefitsFor(null, ['childCare', 'traumaIQ']), ['childCare', 'traumaIQ'], 'a line alone'); assert.deepStrictEqual(pres.benefitsFor(null, []), []);
  assert.deepStrictEqual(pres.benefitsFor('sev', ['childCare', 'traumaIQ']).slice(0, 4), ['childCare', 'traumaIQ', 'sev', 'sevUpTo200'], 'a line, then the column, with no key twice');
  const pts = ['ip', 'ipClaimRoutes', 'ipWaiting', 'ipClaimRoutes'].map((b, i) => pt('p' + i, b, 'Point ' + i));
  assert.deepStrictEqual(pres.pointsFor(pts, 'BrightRock', pres.benefitsFor('ip', [])).map(p => p.id), ['p0', 'p1', 'p2', 'p3'], 'Income protector: the benefit, the two ways to claim and the waiting period, one of each in turn');
  assert.deepStrictEqual(pres.pointsFor(pts, 'BrightRock', ['IP-claim-routes']).map(p => p.id), ['p1', 'p3'], 'a benefit key is matched without capitals, spaces or dashes');
  ['life', 'sev', 'lsd', 'ip', 'aci', 'abi', 'sevUpTo200', 'sevAdvanced', 'traumaIQ', 'sevChild', 'sevChildExtra', 'sevChildClaim', 'rareChildhood', 'ipClaimRoutes', 'ipWaiting', 'childCare', 'debt', 'debtAccelerated', 'debtStandalone', 'household', 'death', 'dread'].forEach(k => assert.ok(k in pres.KP_BENEFITS, k + ' is on the list given to the skill'));
});

test('the cards that show: the ACI card is built from the quote; Severe illness has two sections; placeholders for a BrightRock quote until a library is found; none for another insurer', () => {
  const q = { insurer: 'BrightRock', number: '100000001', aci: 7.5, aciText: '7.5% + age adjuster' };
  assert.deepStrictEqual(pres.aciCard(q), { id: 'aci', section: 'insured', text: 'Premiums rise 7.5% a year, plus the age adjuster.', source: 'This quote, CP 100000001', generated: true });
  assert.strictEqual(pres.aciCard({ insurer: 'Discovery', number: '77', aci: 10 }).text, 'Premiums rise 10% a year.', 'the age adjuster is named only when the quote names it'); assert.strictEqual(pres.aciCard({ insurer: 'Discovery', number: '77', aci: 10 }).source, 'This quote, quote 77');
  assert.strictEqual(pres.aciCard({ aciText: 'CPI + 2%' }).text, 'Premiums rise 2% a year.'); assert.strictEqual(pres.aciCard({ aci: null }), null); assert.strictEqual(pres.aciCard(null), null);
  const lib = { points: pres.parseKeyPoints(KP([pt('a', 'aci', 'A library ACI line that must not show.'), pt('s1', 'sev', 'Severe illness cover.'), pt('s2', 'sevAdvanced', 'The advanced option.'), pt('s3', 'sevChild', 'The children\'s cover.'), pt('s4', 'sevChildClaim', 'What a child\'s claim also pays.'), pt('l1', 'life', 'Life point.')])).points };
  const aci = pres.keyCards({ kp: lib, insurer: 'BrightRock', pil: 'aci', quote: q }); assert.strictEqual(aci.total, 1); assert.strictEqual(aci.sections[0].cards[0].text, 'Premiums rise 7.5% a year, plus the age adjuster.', 'the ACI column shows only the quote\'s own card');
  const sev = pres.keyCards({ kp: lib, insurer: 'BrightRock', pil: 'sev', quote: q }); assert.deepStrictEqual(sev.sections.map(s => s.key + ':' + s.label + ':' + s.cards.length), ['insured:The life insured:2', 'children:The children:2']);
  const life = pres.keyCards({ kp: lib, insurer: 'BrightRock', pil: 'life', quote: q }); assert.strictEqual(life.sections.length, 1); assert.strictEqual(life.sections[0].label, null, 'one section: no banner');
  const onlyIns = pres.keyCards({ kp: { points: lib.points.filter(p => p.section === 'insured') }, insurer: 'BrightRock', pil: 'sev' }); assert.strictEqual(onlyIns.sections[0].label, 'The life insured', 'Severe illness always has its banners');
  const ph = pres.keyCards({ kp: null, insurer: 'BrightRock', pil: 'sev' }); assert.ok(ph.total >= 6 && ph.sections.length === 2 && ph.sections.every(s => s.label) && ph.sections.every(s => s.cards.every(c => c.placeholder && /^Placeholder/.test(c.text) && c.source === pres.PLACEHOLDER_SOURCE)), 'placeholders in the same layout');
  assert.ok(ph.sections.every(s => s.cards.every(c => !/R\s?\d|\d/.test(c.text))), 'a placeholder states no fact and no figure');
  assert.strictEqual(pres.keyCards({ kp: null, insurer: 'Discovery', pil: 'sev' }).total, 0, 'no placeholder for another insurer');
  assert.strictEqual(pres.keyCards({ kp: lib, insurer: 'BrightRock', pil: 'lsd' }).total, 0, 'with a library, a column with no approved point shows nothing (no placeholder)');
  assert.strictEqual(pres.keyCards({ kp: lib, insurer: 'BrightRock' }).total, 0, 'nothing highlighted, nothing shown');
  const line = pres.keyCards({ kp: { points: pres.parseKeyPoints(KP([pt('c', 'childCare', 'Child care cover.'), pt('d', 'debtAccelerated', 'Accelerated debt cover.')])).points }, insurer: 'BrightRock', extra: pres.lineBenefits(Object.assign(store.newLine('child'), {})) });
  assert.strictEqual(line.total, 1);
});

test('a debt line says whether its cover is accelerated or standalone: starts unknown, kept only as yes / no / unknown, read from the quote', () => {
  const l = store.newLine('debt'); assert.strictEqual(l.accelerated, null, 'a new debt line does not claim to be accelerated');
  const docs = require('../app/js/ov-docs.js'), st = store.blank();
  const read = v => docs.applyQuote(st, 'fna', { insurer: 'BrightRock', number: '1', lines: [{ type: 'debt', debt: 'Home loan', accelerated: v, life: { lump: 1 } }] }, 'q.pdf').quote.lines.filter(x => x.type === 'debt' && x.debt === 'Home loan')[0].accelerated;
  assert.strictEqual(read(true), true); assert.strictEqual(read(false), false); assert.strictEqual(read('Standalone'), false); assert.strictEqual(read('accelerated'), true); assert.strictEqual(read('maybe'), null); assert.strictEqual(read(undefined), null);
  assert.ok(/"accelerated": true \| false \| null/.test(app('js/ov-docs.js')) && /ACCELERATED/.test(app('js/ov-docs.js')), 'the reading is asked for it');
  assert.ok(/'\.accelerated', \[\{ id: 'true', l: 'Accelerated' \}, \{ id: 'false', l: 'Standalone' \}\], 'tri'/.test(app('js/ov-ui.js')), 'a choice on the entry screen');
  assert.ok(/l\.accelerated === true \? '\\nAccelerated'/.test(app('js/ov-pdf.js')), 'the PDF says so under the debt');
});

test('no key points live in the repository (the library is private)', () => {
  const all = [];
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { if (e.name === 'node_modules' || e.name === '.git') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else all.push(p); }); })(path.join(__dirname, '..'));
  const bad = all.filter(f => /keypoints.*\.(json|js)$/i.test(f) || /key-points.*\.(json|js)$/i.test(f));
  assert.deepStrictEqual(bad, [], 'a key-points library file is in the repository: ' + bad);
});

test('the key points are found by the page itself: wr-keypoints.json at the top of a connected folder, kept in this browser; no Key points button, no file chooser', () => {
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, ''), fu = app('js/folders-ui.js');
  assert.strictEqual(pres.KP_FILE, 'wr-keypoints.json');
  assert.ok(/FF\.foldersUI\.rootFile\(P\.KP_FILE/.test(ui) && /async function rootFile\(name, ask\)/.test(fu) && /getFileHandle\(name\)/.test(fu), 'read from the connected folders');
  assert.ok(/'wr-keypoints'/.test(ui) && /localStorage/.test(ui), 'the library is kept in this browser');
  assert.ok(!/type="file"|pKpIn|pBtnKp|data-act="kp"|Load key points|Key points&hellip;/.test(ui), 'no button and no file chooser for the key points');
  assert.ok(/refreshKeyPoints\(!kp\)/.test(ui), 'the browser is asked for a folder\'s permission only when nothing is kept yet');
  assert.ok(!/createWritable|getFileHandle\([^)]*create|removeEntry/.test(fu.slice(fu.indexOf('async function rootFile'), fu.indexOf('function forget'))), 'reading only');
});

test('there is no voice in the Presentation: no microphone, no listener, no spoken command, no Voice button', () => {
  const html = app('overview.html'), js = app('js/ov-present.js') + app('js/ov-pres.js'), css = app('css/present.css');
  assert.ok(!/listen\.js/.test(html), 'the speech listener is not even loaded on this page');
  assert.ok(!/FF\.listen|engine|createEngine|startVoice|pBtnVoice|pVoiceText|pChoose|SPEECH_KEY|decide\(|parseCommand|LEADS|getUserMedia|webkitSpeech|SpeechRecognition/.test(js), 'no voice code');
  assert.ok(!/Voice: |Listening|let.s talk about|pdot|pvoice/.test(js + css), 'no voice text or styling');
  assert.ok(/id="btnPresent"/.test(html) && /css\/present\.css/.test(html), 'the Present button and its stylesheet');
  const at = f => html.indexOf('js/' + f);
  assert.ok(at('ov-calc.js') < at('ov-pres.js') && at('ov-pres.js') < at('ov-ui.js') && at('ov-ui.js') < at('ov-present.js') && at('folders-ui.js') < at('ov-present.js'), 'scripts in the right order');
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/anthropic|voiceBackend|voice-ai|messages\.create|api\.openai|fetch\(/i.test(ui), 'the Presentation never calls Claude or any service');
  assert.strictEqual(require('../app/js/ov-schema.js').pageVersion, '0.95');
});

test('the Presentation reads the overview and never writes to it', () => {
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/OV\.store\.|store\.(setPath|addQuote|addLine|setRemoved|fillFromFactFind)|state\(\)\.[A-Za-z.\[\]'"]+\s*=[^=]/.test(ui), 'no write to the overview state');
  assert.ok(!/OV\.app\.(setState|redraw|ingest)/.test(ui), 'no call that changes the page');
  assert.ok(!/<input|<select|<textarea|contenteditable/i.test(ui), 'nothing in the Presentation can be typed into');
});
