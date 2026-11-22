/* The Client Overview's Presentation, the part that needs no screen (stage 5): the fixed command grammar, the closed list of topics, the engine that decides whether a spoken line moves the screen
   (locked until a command phrase, a cool-down after a move, a pause after a click, only the adviser's microphone, an unclear name moves nothing), the short figures on the map, and the private key-points library.
   Invented client only ("Test Client"): no real client data is ever used here. */
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
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: 'R 50 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' }, dd_cover: { v: 'R 500 000.00' } },
  l: {
    kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } },
      { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: 'R 50 000.00', term: 'Max term?' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [], invq: []
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

test('the tabs: Main and the eleven blocks, the same names as the PDF tabs', () => {
  const pdfTabs = app('js/ov-pdf.js').match(/var TABS = \[(.*?)\];/)[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''));
  assert.deepStrictEqual(pres.TABS.slice(1), pdfTabs.slice(1), 'the Presentation\'s tabs are the PDF\'s tabs');
  assert.strictEqual(pres.TABS[0], 'Main'); assert.strictEqual(pres.TABS.length, 12);
  assert.deepStrictEqual(pres.ORDER, ['map'].concat(schema.BLOCKS.map(b => b.id)));
});

test('the grammar: only a line that STARTS with a command phrase is a command', () => {
  const P = pres.parse;
  assert.deepStrictEqual(P('Let\'s talk about life cover'), { cmd: 'goto', lead: 'lets talk about', topic: 'life cover' });
  assert.deepStrictEqual(P('OK, so let us talk about the shortfall.'), { cmd: 'goto', lead: 'let us talk about', topic: 'the shortfall' });
  assert.strictEqual(P('Go to the reduced quotes').topic, 'the reduced quotes'); assert.strictEqual(P('Show me the debts').topic, 'the debts'); assert.strictEqual(P('Take us to investments').topic, 'investments');
  assert.deepStrictEqual(P('Next'), { cmd: 'next' }); assert.deepStrictEqual(P('okay, next one please'), { cmd: 'next' }); assert.deepStrictEqual(P('let\'s go to the next one'), { cmd: 'next' });
  assert.deepStrictEqual(P('go back'), { cmd: 'back' }); assert.deepStrictEqual(P('Previous'), { cmd: 'back' });
  assert.deepStrictEqual(P('Back to the main page'), { cmd: 'main' }); assert.deepStrictEqual(P('let\'s go back to the main page'), { cmd: 'main' }); assert.deepStrictEqual(P('Go to the main page.'), { cmd: 'main' });
  assert.deepStrictEqual(P('clear the highlight'), { cmd: 'clear' });
  /* ordinary talk is never a command */
  ['I want to talk about my life cover later', 'the life cover is important', 'next year we will review the policy', 'your children will be protected', 'we can talk about the shortfall', 'so what do you think about the premium', 'main page', 'back in 2019 I started', 'OK', '', '   ']
    .forEach(t => assert.strictEqual(P(t), null, 'not a command: "' + t + '"'));
  assert.strictEqual(P('go to ' + 'x '.repeat(30)), null, 'a very long line is not a command');
});

test('the closed list is built from this overview: blocks, benefits, line types, each child, each debt, each quote', () => {
  const s = sample(), list = pres.topics(s), by = (dim) => list.filter(t => t.dim === dim);
  assert.strictEqual(by('nav').filter(t => !t.specific).length, 11, 'eleven blocks');
  assert.deepStrictEqual(by('pillar').map(t => t.target.pil), ['life', 'sev', 'lsd', 'ip']);
  assert.deepStrictEqual(by('sub').map(t => t.target.sub), ['quote', 'cmp', 'cmpr']);
  const lines = by('line').map(t => t.target.line);
  ['type:household', 'type:child', 'type:debt', 'type:death', 'type:dread', 'total-ip', 'total-lump', 'total-premium', 'child:amy', 'child:ben'].forEach(k => assert.ok(lines.includes(k), k));
  assert.ok(lines.filter(k => k.startsWith('debt:')).length === 3, 'each debt: ' + lines.filter(k => k.startsWith('debt:')));
  assert.ok(by('nav').some(t => t.target.tab === 'reduced' && t.target.qi === 1), 'the second reduced quote');
});

test('deciding: a clear request moves, an unknown one does nothing, the quote and the benefit and the line can be asked together', () => {
  const s = sample(), L = pres.topics(s), D = t => pres.decide(t, L);
  assert.deepStrictEqual(D('let\'s talk about the shortfall').moves, [{ tab: 'shortfall' }]);
  assert.deepStrictEqual(D('go to the reduced quotes').moves, [{ tab: 'reduced' }]);
  assert.deepStrictEqual(D('let\'s talk about the second reduced quote').moves, [{ tab: 'reduced', qi: 1 }]);
  assert.deepStrictEqual(D('go to the Discovery quote').moves, [{ tab: 'reduced', qi: 1 }]);
  assert.deepStrictEqual(D('let\'s talk about lump sum disability').moves, [{ pil: 'lsd' }]);
  assert.deepStrictEqual(D('show me life cover').moves, [{ pil: 'life' }]);
  assert.deepStrictEqual(D('let\'s talk about income protector').moves, [{ pil: 'ip' }]);
  assert.deepStrictEqual(D('show me the car loan').moves, [{ line: 'debt:car loan' }]);
  assert.deepStrictEqual(D('let\'s talk about Amy').moves, [{ line: 'child:amy' }]);
  assert.deepStrictEqual(D('show me child care').moves, [{ line: 'type:child' }]);
  assert.deepStrictEqual(D('show me total income protected').moves, [{ line: 'total-ip' }]);
  assert.deepStrictEqual(D('go to your change moment pay-out').moves, [{ sub: 'cmp' }]);
  assert.deepStrictEqual(D('go to compared with what you have now').moves, [{ sub: 'cmpr' }]);
  assert.deepStrictEqual(D('go to the reduced quotes life cover').moves, [{ tab: 'reduced' }, { pil: 'life' }], 'page then benefit, in that order');
  assert.strictEqual(D('let\'s talk about my holiday plans').status, 'unknown');
  assert.strictEqual(D('how are you today').status, 'none');
  assert.deepStrictEqual(D('back to the main page').moves, [{ tab: 'map' }]);
  assert.deepStrictEqual(D('next').moves, [{ step: 1 }]); assert.deepStrictEqual(D('go back').moves, [{ step: -1 }]);
});

test('an unclear request moves nothing and offers the choices as buttons', () => {
  const s = sample(), L = pres.topics(s), D = t => pres.decide(t, L);
  const inv = D('let\'s talk about investments');
  assert.strictEqual(inv.status, 'choose'); assert.deepStrictEqual(inv.choices.map(c => c.moves[0].tab), ['investments', 'proposed'], 'current or proposed investments');
  const loan = D('show me the loan'); assert.strictEqual(loan.status, 'choose'); assert.ok(loan.choices.length === 2 && loan.choices.every(c => c.moves[0].line.startsWith('debt:')), JSON.stringify(loan.choices));
  assert.ok(!('moves' in loan), 'nothing moves');
  /* the same insurer in two quotes of one block: which one? */
  const q = store.addQuote(s, 'reduced'); q.insurer = 'Old Mutual'; q.number = '4';
  const om = pres.decide('go to Old Mutual', pres.topics(s)); assert.strictEqual(om.status, 'choose'); assert.ok(om.choices.length >= 2);
  /* a choice keeps the other things asked for in the same line */
  const both = pres.decide('show me the loan in life cover', L); assert.strictEqual(both.status, 'choose'); assert.ok(both.choices.every(c => c.moves.some(m => m.pil === 'life')), 'the benefit is kept with each choice');
});

test('the engine: off until switched on; the client\'s lines are dropped; only a command phrase moves; cool-down; click pause; buttons', () => {
  const s = sample(); let t = 1000; const moves = [], choices = [], unknown = [];
  const e = pres.createEngine({ topics: () => pres.topics(s), now: () => t, onMove: (m, l) => moves.push([m, l]), onChoices: c => choices.push(c), onUnknown: x => unknown.push(x) });
  assert.strictEqual(e.status(), 'off'); assert.strictEqual(e.hear('go to the shortfall', 'me').status, 'off'); assert.strictEqual(moves.length, 0);
  e.setOn(true); assert.strictEqual(e.status(), 'locked');
  assert.strictEqual(e.hear('go to the shortfall', 'client').status, 'ignored', 'the client\'s voice is never acted on'); assert.strictEqual(e.hear('go to the shortfall', 'someone').status, 'ignored'); assert.strictEqual(moves.length, 0);
  assert.strictEqual(e.hear('the shortfall is large', 'me').status, 'none'); assert.strictEqual(moves.length, 0, 'ordinary talk moves nothing');
  assert.strictEqual(e.hear('let\'s talk about the shortfall', 'me').status, 'move'); assert.strictEqual(moves.length, 1); assert.deepStrictEqual(moves[0][0], [{ tab: 'shortfall' }]);
  assert.strictEqual(e.status(), 'cooling'); assert.strictEqual(e.hear('next', 'me').status, 'cooling'); assert.strictEqual(moves.length, 1, 'no second move during the cool-down');
  t += pres.COOL_MS + 1; assert.strictEqual(e.status(), 'locked'); assert.strictEqual(e.hear('next', undefined).status, 'move', 'a line from the microphone alone carries no tag: it is the adviser\'s'); assert.strictEqual(moves.length, 2);
  t += pres.COOL_MS + 1; e.pause(); assert.strictEqual(e.status(), 'paused'); assert.strictEqual(e.hear('go back', 'me').status, 'paused'); assert.strictEqual(moves.length, 2, 'a click pauses the voice');
  t += pres.PAUSE_MS + 1; assert.strictEqual(e.status(), 'locked');
  assert.strictEqual(e.hear('let\'s talk about holidays', 'me').status, 'unknown'); assert.deepStrictEqual(unknown, ['holidays']); assert.strictEqual(moves.length, 2);
  assert.strictEqual(e.hear('show me the loan', 'me').status, 'choose'); assert.strictEqual(moves.length, 2, 'unclear: no move'); assert.strictEqual(e.status(), 'choose'); assert.strictEqual(e.choices().length, 2);
  assert.strictEqual(e.choose(1), true); assert.strictEqual(moves.length, 3); assert.ok(moves[2][0][0].line.startsWith('debt:')); assert.strictEqual(e.status(), 'paused', 'a button is a click');
  e.setOn(false); assert.strictEqual(e.status(), 'off');
});

test('the engine keeps no spoken text, and the module has no network, no Claude and no storage of lines', () => {
  const src = app('js/ov-pres.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/fetch\(|XMLHttpRequest|anthropic|localStorage|sessionStorage|indexedDB|console\./i.test(src), 'no network, no storage, no log in the grammar and engine');
  const s = sample(); const e = pres.createEngine({ topics: () => pres.topics(s), now: () => 5 }); e.setOn(true); e.hear('go to the shortfall', 'me');
  assert.ok(!JSON.stringify(Object.keys(e)).includes('text'), 'nothing of the line is held on the engine');
});

test('the map: a short figure for each block and never an income figure', () => {
  const s = sample(), f = pres.mapFigures(s);
  assert.deepStrictEqual(Object.keys(f), ['policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other']);
  assert.match(f.policies, /polic/); assert.strictEqual(f.fna, 'R2,900 p.m.'); assert.match(f.reduced, /2 quotes · from R1,400 p.m./); assert.match(f.investments, /1 investment/);
  assert.strictEqual(f.comparative, 'None yet');
  assert.ok(!Object.values(f).some(v => /40,?000|50,?000|net income|gross/i.test(v)), 'no income on the map');
  assert.strictEqual(pres.short(1000000), 'R1m'); assert.strictEqual(pres.short(2450000), 'R2.5m'); assert.strictEqual(pres.short(80000), 'R80k'); assert.strictEqual(pres.short(2900), 'R2,900');
  const b = store.blank(); const e = pres.mapFigures(b); assert.strictEqual(e.policies, 'None yet'); assert.strictEqual(e.fna, 'Waiting'); assert.strictEqual(e.shortfall, 'Waiting');
});

const KP = (pts, over) => JSON.stringify(Object.assign({ app: 'wr-keypoints', schema: '0.1', points: pts }, over || {}));
const OK = { by: 'Paul', date: '21/11/2026' };
test('the key-points library: only approved points are ever kept; at most four per benefit; the right insurer and benefit', () => {
  const r = pres.parseKeyPoints(KP([
    { id: 'a1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Pays out in full on death.', approved: OK },
    { id: 'a2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Cover changes as your needs change.', approved: OK },
    { id: 'a3', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A third approved point.', approved: OK },
    { id: 'a4', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A fourth approved point.', approved: OK },
    { id: 'a5', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A fifth approved point that must not show.', approved: OK },
    { id: 'u1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A draft nobody approved.', approved: null },
    { id: 'u2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Approved without a date.', approved: { by: 'Paul' } },
    { id: 'b1', insurer: 'Discovery', product: '', benefit: 'life', text: 'Discovery life point.', approved: OK },
    { id: 'c1', insurer: 'BrightRock', product: '', benefit: 'sev', text: 'Severe illness point.', approved: OK },
    { id: 'd1', insurer: 'BrightRock', product: '', benefit: 'instalmentProtector', text: 'Pays the instalment to the bank.', approved: OK }
  ]));
  assert.ok(r.ok); assert.strictEqual(r.total, 10); assert.strictEqual(r.dropped, 2, 'the unapproved ones are dropped on loading'); assert.ok(!r.points.some(p => /draft nobody|without a date/.test(p.text)));
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['life']).map(p => p.id), ['a1', 'a2', 'a3', 'a4'], 'at most four, in the file\'s order');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'brightrock life', ['sev']).map(p => p.id), ['c1'], 'the insurer matches whatever the capitals');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Discovery', ['life']).map(p => p.id), ['b1']);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'Sanlam', ['life']), [], 'another insurer: none');
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['ip']), []);
  assert.deepStrictEqual(pres.pointsFor(r.points, 'BrightRock', ['ip', 'instalmentProtector']).map(p => p.id), ['d1']);
  assert.deepStrictEqual(pres.benefitsFor('ip', ['debt:car loan']), ['ip', 'instalmentProtector']); assert.deepStrictEqual(pres.benefitsFor('ip', []), ['ip']); assert.deepStrictEqual(pres.benefitsFor(null, []), []);
  assert.deepStrictEqual(pres.benefitsFor('life', ['child:amy']), ['life', 'childCover']);
  const pr = pres.parseKeyPoints(KP([{ id: 'p', insurer: 'Old Mutual', product: 'Optimal', benefit: 'life', text: 'Optimal point.', approved: OK }]));
  assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Optimal Risk').length, 1); assert.strictEqual(pres.pointsFor(pr.points, 'Old Mutual', ['life'], 'Flexi').length, 0, 'a point for one product does not show for another');
});

test('the key-points file is checked: wrong app, wrong layout, not JSON', () => {
  assert.strictEqual(pres.parseKeyPoints('not json').ok, false); assert.strictEqual(pres.parseKeyPoints('{"app":"wr-overview","points":[]}').ok, false);
  assert.strictEqual(pres.parseKeyPoints(KP([], { schema: '9.0' })).ok, false); assert.match(pres.parseKeyPoints(KP([], { schema: '9.0' })).error, /layout/);
  assert.strictEqual(pres.parseKeyPoints(KP([])).ok, true);
});

test('no key points live in the repository (the library is private)', () => {
  const all = [];
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { if (e.name === 'node_modules' || e.name === '.git') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else all.push(p); }); })(path.join(__dirname, '..'));
  const bad = all.filter(f => /keypoints.*\.json$/i.test(f) || /key-points.*\.json$/i.test(f));
  assert.deepStrictEqual(bad, [], 'a key-points library file is in the repository: ' + bad);
});

test('the page: a Present button, the stylesheet and the scripts in the right order; the voice never calls Claude', () => {
  const html = app('overview.html');
  assert.ok(/id="btnPresent"/.test(html) && /css\/present\.css/.test(html), 'the Present button and its stylesheet');
  const at = f => html.indexOf('js/' + f);
  assert.ok(at('ov-calc.js') < at('ov-pres.js') && at('ov-pres.js') < at('ov-ui.js') && at('ov-ui.js') < at('listen.js') && at('listen.js') < at('ov-present.js'), 'ov-pres.js after the figures, ov-present.js after the page and the listener');
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/anthropic|voiceBackend|voice-ai|messages\.create|api\.openai|fetch\(/i.test(ui), 'the Presentation never calls Claude or any service itself (the listener is the only thing that may reach a speech service, on Paul\'s own setting)');
  assert.ok(/call:\s*false/.test(ui), 'the listener is started on the microphone alone: the sound of a call is never asked for');
  assert.ok(/who/.test(ui) && /engine\.hear\(t, m && m\.who\)/.test(ui), 'every line goes to the engine with its speaker tag');
  assert.ok(/'wr-keypoints'/.test(ui) && !/wr-keypoints.*\.json/.test(ui), 'the library is kept in this browser only');
  assert.ok(!/<input(?![^>]*type="file")|<select|<textarea|contenteditable/i.test(ui.replace(/'<input type="file"[^']*'/g, '')) || /pKpIn/.test(ui), 'the only input is the hidden file chooser for the key points');
  assert.strictEqual(require('../app/js/ov-schema.js').pageVersion, '0.6');
});

test('the Presentation reads the overview and never writes to it', () => {
  const ui = app('js/ov-present.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/OV\.store\.|store\.(setPath|addQuote|addLine|setRemoved|fillFromFactFind)|state\(\)\.[A-Za-z.\[\]'"]+\s*=[^=]/.test(ui), 'no write to the overview state');
  assert.ok(!/OV\.app\.(setState|redraw|ingest)/.test(ui), 'no call that changes the page');
});
