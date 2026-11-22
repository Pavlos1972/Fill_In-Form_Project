/* The Client Overview Studio's Presentation, the part that needs no screen: the tabs (no block numbers), the short figures on the main page, what a click asks the key-points library for (at most three points, the right
   insurer, the right benefits), the library file's checks, and the rules built into the code (no voice, nothing dimmed, the library never in the repository). The screen itself is tested in
   tests/browser/t-overview-present.js. Invented client only ("Test Client"): no real client data is ever used here. */
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

test('the tabs: Main and the eleven pages, with no block numbers', () => {
  assert.deepStrictEqual(pres.TABS, ['Main', 'Policies', 'FNA', 'Group', 'Shortfall', 'Shortfall quote', 'Reduced', 'Comparative', 'Investments', 'Proposed', 'Goals', 'Other']);
  assert.ok(pres.TABS.every(t => !/\d/.test(t)), 'no number on any tab');
  assert.deepStrictEqual(pres.ORDER, ['map'].concat(schema.BLOCKS.map(b => b.id)));
  assert.strictEqual(pres.TABS.length, pres.ORDER.length);
  const js = app('js/ov-present.js');
  assert.ok(!/b\.n \+ '\. '|bl\.n \+|<i>' \+ b\.n/.test(js), 'no block number is drawn on a page title or card');
});

test('the main page: one short figure for each block, the key figure first, and never an income figure', () => {
  const s = sample(), f = pres.mapFigures(s);
  assert.deepStrictEqual(Object.keys(f), ['policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other']);
  assert.match(f.policies, /^R1,200 p\.m\. · 1 polic/); assert.strictEqual(f.fna, 'R2,900 p.m.'); assert.strictEqual(f.reduced, 'from R1,400 p.m. · 2 quotes'); assert.match(f.investments, /1 investment/);
  assert.strictEqual(f.comparative, 'None yet'); assert.strictEqual(f.proposed, '1 proposal');
  assert.ok(!Object.values(f).some(v => /40,?000|50,?000|net income|gross/i.test(v)), 'no income on the main page');
  assert.deepStrictEqual(pres.splitFigure('from R1,400 p.m. · 2 quotes'), { fig: 'from R1,400 p.m.', cap: '2 quotes' }); assert.deepStrictEqual(pres.splitFigure('Waiting'), { fig: 'Waiting', cap: '' });
  assert.strictEqual(pres.short(1000000), 'R1m'); assert.strictEqual(pres.short(2450000), 'R2.5m'); assert.strictEqual(pres.short(80000), 'R80k'); assert.strictEqual(pres.short(2900), 'R2,900');
  const b = store.blank(); const e = pres.mapFigures(b); assert.strictEqual(e.policies, 'None yet'); assert.strictEqual(e.fna, 'Waiting'); assert.strictEqual(e.shortfall, 'Waiting');
});

test('a page that is left out (as in the PDF) is not on the tabs and not on the main page, and next and back skip it', () => {
  const s = sample(); s.factFind.facts.asked = { sf: false, comparative: false }; s.blocks.proposed.items.forEach(i => { i.removed = true; }); s.blocks.goals.items.forEach(g => { g.requested = false; });
  const f = pres.mapFigures(s);
  ['shortfallQuote', 'comparative', 'proposed', 'goals'].forEach(id => assert.strictEqual(f[id], 'Not included', id));
  assert.deepStrictEqual(pres.shownOrder(s), ['map', 'policies', 'fna', 'group', 'shortfall', 'reduced', 'investments', 'other'], 'the pages that exist, in order');
  assert.deepStrictEqual(pres.shownOrder(sample()), pres.ORDER, 'all eleven pages and the main page when everything is there');
  const js = app('js/ov-present.js');
  assert.ok(/P\.shownOrder\(state\(\)\)\.length|ord\.map/.test(js) && /calc\.pageShown\(s, b\.id\)/.test(js) && /calc\.pageShown\(state\(\), tab\)/.test(js), 'the tab row and the cards come only from the pages that exist, and a left-out page cannot be opened');
  assert.ok(!/ptab off|pnode off|text-decoration: line-through/.test(js + app('css/present.css')), 'no struck-through or greyed tab for a left-out page: it is simply not there');
});

test('the design: white, the Wealth Revolution blue, orange accents, the logo, rounded pills; nothing is ever dimmed', () => {
  const css = app('css/present.css'), js = app('js/ov-present.js');
  assert.ok(/\.pres \{[^}]*background: #fff/.test(css), 'a white background');
  assert.ok(!/#0f1318/.test(css), 'no black left');
  assert.ok(/--wr: #27a8e0/.test(css) && /--or: #f0a050/.test(css), 'the blue of the PDF and the orange accent');
  assert.ok(/class="plogo" src="assets\/logo\.png"/.test(js) && /\.plogo/.test(css), 'the logo in the top bar');
  assert.ok(/\.ptab \{[^}]*border-radius: 999px/.test(css) && /\.ptab\.on \{[^}]*background: var\(--wr\)[^}]*inset 0 -3px 0 var\(--or\)/.test(css), 'pill tabs, the current one filled blue with an orange underline');
  assert.ok(/\.phero/.test(css) && /\.pcard/.test(css) && /\.kcard/.test(css), 'a header band, cards on the main page, a key-points card');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/opacity:\s*\.[0-9]+\s*;/.test(rules.replace(/\.kcard \{[^}]*\}/, '').replace(/@keyframes[^}]*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/, '')), 'no rule dims anything (opacity below 1) except the key-points card sliding in');
  assert.ok(!/\.hlp|\.hlr/.test(rules + js), 'the old dimming classes are gone');
  assert.ok(!/class="lbl">Highlight|>Highlight</.test(js), 'the word Highlight is not on the screen');
});

test('the ACI is shown as the quote words it (or "10% fixed") in the Presentation too, and a debt line says Accelerated or Standalone', () => {
  const js = app('js/ov-present.js');
  assert.ok(/calc\.fmtAci/.test(js) && /AC\(it\)/.test(js) && /lineRow\(l, isPolicy \? null : c\)/.test(js));
  const q = { aci: 10 }; assert.strictEqual(calc.fmtAci(q), '10% fixed'); q.aciText = '7.5% + age rater'; assert.strictEqual(calc.fmtAci(q), '7.5% + age rater'); assert.strictEqual(calc.fmtAci({ aci: null }), '');
  assert.ok(/Accelerated/.test(js) && /Standalone/.test(js) && /l\.accelerated === true/.test(js), 'the cover type is shown under the debt');
  assert.ok(/waiting === 'N\/A'|isNA\('waiting'\)/.test(js), 'a child line shows N/A for the waiting period (the store makes it so)');
});

test('highlighting is by clicking: the buttons for Life cover, Severe illness, Lump sum disability, Income protector, ACI and ABI, and the column headings', () => {
  const js = app('js/ov-present.js');
  assert.ok(/\['aci', 'ACI'\], \['abi', 'ABI'\]/.test(js), 'ACI and ABI buttons beside the four benefits');
  assert.ok(/th\('ACI', 'aci'\)/.test(js) && /th\('ABI', 'abi'\)/.test(js) && /'', 'aci'\)/.test(js) && /'', 'abi'\)/.test(js), 'the ACI and ABI columns carry their button\'s name');
  assert.ok(/closest\('th\[data-pil\]'\)/.test(js), 'a click on a column heading highlights the column too');
  assert.ok(/bt\.hidden = !sl\.querySelector/.test(js), 'a button is shown only where its column is on the page');
});

const KP = (pts, over) => JSON.stringify(Object.assign({ app: 'wr-keypoints', schema: '0.1', points: pts }, over || {}));
const OK = { by: 'Paul', date: '21/11/2026' };
test('the key-points library: only approved points are kept; at most three show; the right insurer and benefit; a short bullet only', () => {
  const r = pres.parseKeyPoints(KP([
    { id: 'a1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Pays out in full on death.', approved: OK },
    { id: 'a2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Cover changes as your needs change.', approved: OK },
    { id: 'a3', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A third approved point.', approved: OK },
    { id: 'a4', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A fourth approved point that must not show.', approved: OK },
    { id: 'u1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A draft nobody approved.', approved: null },
    { id: 'u2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Approved without a date.', approved: { by: 'Paul' } },
    { id: 'l1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'x'.repeat(pres.KP_LONG + 1), approved: OK },
    { id: 'b1', insurer: 'Discovery', product: '', benefit: 'life', text: 'Discovery life point.', approved: OK },
    { id: 'c1', insurer: 'BrightRock', product: '', benefit: 'sev', text: 'Severe illness point.', approved: OK },
    { id: 'g1', insurer: '', product: '', benefit: 'aci', text: 'Any insurer\'s ACI point.', approved: OK }
  ]));
  assert.ok(r.ok); assert.strictEqual(r.total, 10); assert.strictEqual(r.dropped, 2, 'the unapproved ones are dropped on loading'); assert.strictEqual(r.tooLong, 1, 'a point too long for a short bullet is left out and counted');
  assert.ok(!r.points.some(p => /draft nobody|without a date/.test(p.text) || p.text.length > pres.KP_LONG));
  assert.strictEqual(pres.KP_MAX, 3);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['life']).map(p => p.id), ['a1', 'a2', 'a3'], 'at most three, in the file\'s order');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'brightrock life', ['sev']).map(p => p.id), ['c1'], 'the insurer matches whatever the capitals');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Discovery', ['life']).map(p => p.id), ['b1']);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Sanlam', ['life']), [], 'another insurer: none');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Sanlam', ['aci']).map(p => p.id), ['g1'], 'a point with no insurer is for every insurer');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['ip']), []);
  const pr = pres.parseKeyPoints(KP([{ id: 'p', insurer: 'Old Mutual', product: 'Optimal', benefit: 'life', text: 'Optimal point.', approved: OK }]));
  assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Optimal Risk').length, 1); assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Flexi').length, 0, 'a point for one product does not show for another');
});

test('what a click asks the library for: the line first, then the column and what goes with it; a little of each topic', () => {
  const L = (type, o) => Object.assign(store.newLine(type), o || {});
  assert.deepStrictEqual(pres.lineBenefits(L('child')), ['childCare', 'traumaIQ', 'rareChildhood', 'childCover']);
  assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: true })), ['debt', 'debtAccelerated']);
  assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: false })), ['debt', 'debtStandalone']);
  assert.deepStrictEqual(pres.lineBenefits(L('debt')), ['debt'], 'unknown: only the general debt points');
  assert.deepStrictEqual(pres.lineBenefits(L('debt', { accelerated: true, ip: { monthly: 4000 } })), ['debt', 'debtAccelerated', 'instalmentProtector']);
  assert.deepStrictEqual(pres.lineBenefits(L('household')), ['household']); assert.deepStrictEqual(pres.lineBenefits(L('death')), ['death']); assert.deepStrictEqual(pres.lineBenefits(L('dread')), ['dread']);
  assert.deepStrictEqual(pres.lineBenefits(L('other')), []); assert.deepStrictEqual(pres.lineBenefits(null), []);
  assert.deepStrictEqual(pres.benefitsFor('life', []), ['life']); assert.deepStrictEqual(pres.benefitsFor('sev', []), ['sev', 'sevUpTo200', 'traumaIQ']);
  assert.deepStrictEqual(pres.benefitsFor('ip', []), ['ip', 'ipClaimRoutes', 'ipWaiting']); assert.deepStrictEqual(pres.benefitsFor('aci', []), ['aci']); assert.deepStrictEqual(pres.benefitsFor('abi', []), ['abi']);
  assert.deepStrictEqual(pres.benefitsFor(null, ['childCare', 'traumaIQ']), ['childCare', 'traumaIQ'], 'a line alone');
  assert.deepStrictEqual(pres.benefitsFor('sev', ['childCare', 'traumaIQ']), ['childCare', 'traumaIQ', 'sev', 'sevUpTo200'], 'a line, then the column, with no key twice');
  assert.deepStrictEqual(pres.benefitsFor(null, []), []);
  const pts = ['sev', 'sevUpTo200', 'traumaIQ', 'ip', 'ipClaimRoutes', 'ipWaiting', 'ipClaimRoutes'].map((b, i) => ({ id: 'p' + i, insurer: 'BrightRock', product: '', benefit: b, text: 'Point ' + i }));
  assert.deepStrictEqual(pres.pointsFor(pts, 'BrightRock', pres.benefitsFor('ip', [])).map(p => p.id), ['p3', 'p4', 'p5'], 'Income protector: the benefit, the two ways to claim and the waiting period, one of each');
  assert.deepStrictEqual(pres.pointsFor(pts, 'BrightRock', pres.benefitsFor('sev', [])).map(p => p.id), ['p0', 'p1', 'p2'], 'Severe illness: the benefit, up to 200% and when, Trauma IQ');
  assert.deepStrictEqual(pres.pointsFor(pts, 'BrightRock', ['SEV-up-to-200']).map(p => p.id), ['p1'], 'a benefit key is matched without capitals, spaces or dashes');
  assert.ok(['life', 'sev', 'lsd', 'ip', 'aci', 'abi', 'sevUpTo200', 'traumaIQ', 'rareChildhood', 'ipClaimRoutes', 'ipWaiting', 'childCare', 'debt', 'debtAccelerated', 'debtStandalone', 'household', 'death', 'dread'].every(k => k in pres.KP_BENEFITS), 'every key the page asks for is on the list given to the skill');
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
  assert.strictEqual(require('../app/js/ov-schema.js').pageVersion, '0.8');
});

test('the Presentation reads the overview and never writes to it', () => {
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/OV\.store\.|store\.(setPath|addQuote|addLine|setRemoved|fillFromFactFind)|state\(\)\.[A-Za-z.\[\]'"]+\s*=[^=]/.test(ui), 'no write to the overview state');
  assert.ok(!/OV\.app\.(setState|redraw|ingest)/.test(ui), 'no call that changes the page');
  assert.ok(!/<input|<select|<textarea|contenteditable/i.test(ui), 'nothing in the Presentation can be typed into');
});
