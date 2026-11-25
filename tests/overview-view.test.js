/* Client Overview Studio 0.95 (23 November, Paul: a View button on every document-backed item, in the entry screen and in the Presentation, that opens the source PDF from the client's folder inside the page).
   Without a screen: which file belongs to an item (the file name the overview already holds first; a number or an insurer when no name is held), the BrightRock policy summary schedule and never the owner's manual,
   a file another item holds is never offered, a different number in a file name rules it out, a statement is only found again by its policy number, and the wiring of both screens. Invented client only ("Test Client"). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const store = require('../app/js/ov-store.js');
const docs = require('../app/js/ov-docs.js');
const V = require('../app/js/ov-view.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const F = (name, rel) => ({ name, rel: rel || [], handle: { name } });

const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('10/11/2026') },
  l: { kids: [], debts: [], risk: [['BrightRock', 'a'], ['Liberty', 'b'], ['BrightRock', 'c']].map(r => ({ d: { prov: r[0], spend: 'R 900.00', broker: 'Other broker' } })) } };
function build() {
  const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ), 'ff.json');
  const p = s.blocks.policies.items, br = p.filter(i => i.insurer === 'BrightRock'), lib = p.filter(i => i.insurer === 'Liberty')[0];
  docs.applyPolicy(s, br[0], { insurer: 'BrightRock', policyNo: '8844', product: 'Lifestyle', premium: 900, lines: [{ type: 'household', life: { lump: 500000 } }] }, 'BR Policy Summary Schedule - 8844.pdf');
  docs.applyPolicy(s, lib, { insurer: 'Liberty', policyNo: 'L-900', product: 'Plan', premium: 800, lines: [{ type: 'other', label: 'Cover', life: { lump: 1000000 } }] }, 'Liberty Schedule L-900.pdf');
  br[1].policyNo = '7777'; br[1].product = 'Lifestyle';
  return { s, br, lib, idx: n => p.findIndex(i => i.policyNo === n) };
}
const path0 = i => 'blocks.policies.items.' + i;

test('refFor: a policy, a quote, its pay-out guide, a statement, a goal report and the legacy plan each say what they open; an item with no document has none; a removed one has none', () => {
  const { s, idx } = build();
  const q = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000091', date: '19/11/2026', premium: 5000, lines: [{ type: 'household', life: { lump: 500000 } }] }, 'BR FNA - 100000091.pdf').quote;
  docs.applyCmp(s, { number: '100000091', rows: [{ key: 'total', today: 1, projected: 2 }] }, 'BR CMPO - 100000091.pdf');
  const pol = V.refFor(s, path0(idx('8844')));
  assert.deepStrictEqual([pol.role, pol.name, pol.bright, pol.required, pol.show], ['schedule', 'BR Policy Summary Schedule - 8844.pdf', true, true, true]);
  const qr = V.refFor(s, 'blocks.fna.quotes.0'); assert.deepStrictEqual([qr.role, qr.name, qr.number], ['quote', 'BR FNA - 100000091.pdf', '100000091']);
  const gd = V.refFor(s, 'blocks.fna.quotes.0.cmp'); assert.deepStrictEqual([gd.role, gd.name, gd.number], ['guide', 'BR CMPO - 100000091.pdf', '100000091']);
  assert.strictEqual(V.refFor(s, 'blocks.fna.quotes.5'), null); assert.strictEqual(V.refFor(s, 'blocks.fna.quotes.0.rows'), null); assert.strictEqual(V.refFor(null, 'blocks.fna.quotes.0'), null);
  docs.applyGoal(s, { kind: 'rgar', currentValuePm: 1 }, 'RGAR - 20.11.26.pdf');
  const gr = V.refFor(s, 'blocks.goals.items.0'); assert.deepStrictEqual([gr.role, gr.name, gr.kind], ['report', 'RGAR - 20.11.26.pdf', 'rgar']);
  const inv = { id: 'i1', wr: true, provider: 'Test Provider', product: 'RA', st: 'empty', removed: false }; s.blocks.investments.items.push(inv);
  assert.strictEqual(V.refFor(s, 'blocks.investments.items.0').show, false, 'an investment no document filled has no button');
  docs.applyInvestment(s, inv, { gross: 1 }, 'Test Provider Statement.pdf', { kind: 'schedule' });
  const ir = V.refFor(s, 'blocks.investments.items.0'); assert.deepStrictEqual([ir.role, ir.name, ir.show], ['statement', 'Test Provider Statement.pdf', true]);
  const leg = s.blocks.other.items.filter(i => i.key === 'legacy')[0], li = s.blocks.other.items.indexOf(leg);
  assert.strictEqual(V.refFor(s, 'blocks.other.items.' + li).show, false);
  docs.applyOther(s, leg, { insurer: 'Test Life', product: 'Legacy', policyNo: 'LP-1' }, 'Legacy Plan Schedule LP-1.pdf');
  assert.strictEqual(V.refFor(s, 'blocks.other.items.' + li).name, 'Legacy Plan Schedule LP-1.pdf');
  q.removed = true; assert.strictEqual(V.refFor(s, 'blocks.fna.quotes.0'), null, 'a removed quote has no button');
});

test('pick: the file name the overview holds wins (any capitals); a policy with no name is found by its number; a renamed quote by its CP number', () => {
  const { s, idx } = build();
  const pool = [F('BR Policy Summary Schedule - 8844.pdf'), F('BR Owners Manual 8844.pdf'), F('Other.pdf')];
  assert.strictEqual(V.pick(V.refFor(s, path0(idx('8844'))), pool).file.name, 'BR Policy Summary Schedule - 8844.pdf');
  assert.strictEqual(V.pick(V.refFor(s, path0(idx('8844'))), [F('br policy summary schedule - 8844.PDF')]).how, 'name');
  const ref = V.refFor(s, path0(idx('8844'))); ref.name = ''; assert.deepStrictEqual([V.pick(ref, pool).file.name, V.pick(ref, pool).how], ['BR Policy Summary Schedule - 8844.pdf', 'search']);
  const q = { role: 'quote', name: 'old name.pdf', number: '100000093', insurer: 'BrightRock', label: 'x' };
  assert.strictEqual(V.pick(q, [F('Reduced 100000093 (renamed).pdf'), F('Reduced 100000094.pdf')]).file.name, 'Reduced 100000093 (renamed).pdf');
  assert.strictEqual(V.pick(q, [F('Reduced 100000094.pdf')]).reason, 'missing');
  assert.ok(!V.pick(q, [F('BR CMPO - 100000093.pdf')]).file, 'a pay-out guide is never offered as the quote');
  const g = { role: 'guide', name: '', number: '100000093', insurer: 'BrightRock', label: 'x' };
  assert.strictEqual(V.pick(g, [F('BR FNA - 100000093.pdf'), F('BR CMPO - 100000093.pdf')]).file.name, 'BR CMPO - 100000093.pdf');
  assert.ok(!V.pick({ role: 'schedule', name: '', policyNo: '', insurer: 'BrightRock', bright: true, label: 'x' }, [F('notes.txt'), F('photo.heic')]).file, 'only PDFs and pictures can be opened');
});

test('a BrightRock policy is shown by its policy SUMMARY schedule, never by the owner\'s manual', () => {
  const ref = { role: 'schedule', name: '', policyNo: '8844', insurer: 'BrightRock', bright: true, label: 'BrightRock 8844' };
  ['BR Owners Manual 8844.pdf', 'BrightRock Owner Manual 8844.pdf', 'BR Policy Terms and Conditions 8844.pdf', 'BR Policy Document 8844.pdf', 'BR Policy Wording 8844.pdf', 'BR Brochure.pdf'].forEach(n => {
    const r = V.pick(ref, [F(n)]); assert.ok(!r.file, n + ' is never opened for a BrightRock policy'); assert.strictEqual(r.reason, 'manual', n);
  });
  assert.match(V.pick(ref, [F('BR Owners Manual 8844.pdf')]).text, /owner.s manual.*not its policy summary schedule/);
  assert.strictEqual(V.pick(ref, [F('BR Owners Manual 8844.pdf'), F('BR Policy Summary Schedule - 8844.pdf'), F('BR Summary 8844 - draft.pdf')]).file.name, 'BR Policy Summary Schedule - 8844.pdf', 'the schedule outscores a loose summary');
  const named = { role: 'schedule', name: 'BR Owners Manual 8844.pdf', policyNo: '8844', insurer: 'BrightRock', bright: true, label: 'x' };
  assert.strictEqual(V.pick(named, [F('BR Owners Manual 8844.pdf')]).reason, 'manual', 'even when the overview was told that file name');
  assert.strictEqual(V.pick({ role: 'schedule', name: '', policyNo: 'L-900', insurer: 'Liberty', bright: false, label: 'x' }, [F('Liberty Policy Document L-900.pdf')]).file.name, 'Liberty Policy Document L-900.pdf', 'another insurer\'s schedule is whatever its schedule is');
});

test('a wrong document is never shown: another policy\'s number in the name rules a file out, and a file another item was read from is never offered', () => {
  const { s, idx } = build();
  const r7777 = V.refFor(s, path0(idx('7777')));
  const pool = [F('BR Policy Summary Schedule - 8844.pdf'), F('BR Policy Summary Schedule - 5555.pdf')];
  assert.ok(!V.pick(r7777, pool).file, 'policy 7777 does not take the schedule of policy 8844 or 5555 just because both are BrightRock summary schedules');
  assert.strictEqual(V.pick(r7777, pool.concat(F('BR Policy Summary Schedule - 7777.pdf'))).file.name, 'BR Policy Summary Schedule - 7777.pdf');
  assert.ok(V.foreign('BR Policy Summary Schedule - 8844 - 12.10.26.pdf', '7777') && !V.foreign('BR Policy Summary Schedule - 8844 - 12.10.26.pdf', '8844') && !V.foreign('Summary 12.10.26 2026.pdf', '7777'), 'dates and bare years are not another policy\'s number');
  const taken = V.takenBy(s, path0(idx('7777')));
  assert.ok(taken['br policy summary schedule - 8844.pdf'] && taken['liberty schedule l-900.pdf'], 'the files the other items were read from');
  assert.ok(!V.takenBy(s, path0(idx('8844')))['br policy summary schedule - 8844.pdf'], 'an item\'s own file is not "taken" from it');
  const generic = { role: 'schedule', name: '', policyNo: '7777', insurer: 'BrightRock', bright: true, label: 'x' };
  assert.ok(!V.pick(generic, [F('BR Policy Summary Schedule.pdf')], { 'br policy summary schedule.pdf': true }).file, 'a file another item holds is skipped');
  assert.ok(V.pick(generic, [F('BR Policy Summary Schedule.pdf')]).file, 'a generic summary schedule with no number and no owner is still offered');
});

test('a statement is only found again by its policy number, never by the provider\'s name alone', () => {
  const st = { role: 'statement', name: 'Gone Statement.pdf', policyNo: '', insurer: 'Test Lost Provider', product: 'RA', label: 'x' };
  const pool = [F('Test Group Statement 2026.pdf'), F('Test Provider Statement.png')];
  assert.strictEqual(V.pick(st, pool).reason, 'missing');
  assert.match(V.pick(st, pool).text, /“Gone Statement\.pdf” is not in the client’s folder any more/);
  assert.strictEqual(V.pick(Object.assign({}, st, { policyNo: 'T-12345' }), pool.concat(F('Statement T-12345 RA.pdf'))).file.name, 'Statement T-12345 RA.pdf');
  assert.strictEqual(V.pick({ role: 'report', name: '', kind: 'rgar', label: 'x' }, [F('EGAR - education.pdf'), F('RGAR Report 20.11.26.pdf')]).file.name, 'RGAR Report 20.11.26.pdf');
});

test('no saved-file key is added: the page version is 0.95, the layout is still 0.1, and looking at a document changes nothing', () => {
  assert.ok(/^1\.[01234567]$/.test(schema.pageVersion), 'the page version is 1.0 to 1.6'); assert.strictEqual(schema.version, '0.1');
  const { s } = build(); const before = JSON.stringify(s);
  V.refFor(s, path0(0)); V.takenBy(s, path0(0)); V.pick(V.refFor(s, path0(0)), [F('x.pdf')], V.takenBy(s, path0(0)));
  assert.strictEqual(JSON.stringify(s), before, 'reading what to open does not touch the overview');
  assert.ok(!/view|viewed|files/i.test(Object.keys(JSON.parse(store.toJSON(s))).join(' ')), 'no top-level key about viewing');
});

test('the page: the script and stylesheet are loaded before the screens that use them, pdf.js is vendored with its licence and fonts, and nothing is downloaded from a website', () => {
  const html = app('overview.html'), at = f => html.indexOf(f);
  assert.ok(at('js/ov-view.js') > at('js/ov-calc.js') && at('js/ov-view.js') < at('js/ov-ui.js') && at('js/ov-view.js') < at('js/ov-present.js') && at('js/folders-ui.js') < at('js/ov-view.js'), 'order of the scripts');
  assert.ok(/css\/view\.css/.test(html));
  ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/pdfjs-LICENSE.txt', 'vendor/pdfjs-fonts/LiberationSans-Regular.ttf', 'vendor/pdfjs-fonts/FoxitSerif.pfb'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', f)), f));
  assert.ok(fs.readdirSync(path.join(__dirname, '..', 'app', 'vendor', 'pdfjs-fonts')).length >= 14, 'the standard fonts pdf.js needs for a document that does not carry its own');
  assert.ok(/Apache License/.test(app('vendor/pdfjs-LICENSE.txt')), 'the licence is kept with the code');
  const js = app('js/ov-view.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/https?:\/\//.test(js), 'no address in the code: pdf.js and its fonts come from this folder');
  assert.ok(/'vendor\/pdf\.min\.js/.test(js) && /standardFontDataUrl: FONTS/.test(js) && /GlobalWorkerOptions\.workerSrc/.test(js));
  assert.ok(!/window\.open|target="_blank"|location\.href|createElement\('a'\)/.test(js), 'nothing opens a new tab or leaves the page');
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(!/ov-view\.js|view\.css/.test(app(f)), f + ' does not load the Studio\'s viewer'));
});

test('the entry screen: every document-backed item has the button, the click opens the window (a read-only file too), and the screen is painted after every draw', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function vb\(path\)/.test(ui) && /function paintView\(\)/.test(ui));
  const n = (ui.match(/vb\(p\)/g) || []).length; assert.ok(n >= 10, 'policy row and card, quote card, group card, investment row and card, proposed row and card, goals, legacy plan (' + n + ')');
  assert.ok(/vb\(p \+ '\.cmp'\)/.test(ui), 'the change moment pay-out has its own button');
  assert.ok(/seeBtn\(it\.id\)[^;]*dvrow|dvrow[^;]*vb\(p\)/.test(ui), 'in a table row the button sits with See more');
  assert.ok(/\[data-vw\][\s\S]{0,200}OV\.view\.open\(vbn\.getAttribute\('data-vw'\), vbn, 'studio'\)/.test(ui), 'the click');
  assert.ok(/paintStatuses\(\); fitTables\(\); paintView\(\);/.test(ui) && /fitTables\(\); paintView\(\);\s*\n\s*\}/.test(ui), 'painted after a draw and after a row is redrawn');
  assert.ok(/OV\.view\.forget\(\); OV\.view\.paint\(\)/.test(ui), 'connecting the folders starts the search again');
});

test('the Presentation: the button on every page that has a document, a click on it never opens the row behind it, a button that cannot open its file is not shown', () => {
  const pr = app('js/ov-present.js');
  assert.ok(/function vp\(path\)[^\n]*'pres'/.test(pr));
  const n = (pr.match(/vp\(/g) || []).length; assert.ok(n >= 11, 'policies (list and one), quote, pay-out guide, group (two rows), investments, proposed, goals, legacy plan (' + n + ')');
  assert.ok(/var vw = ev\.target\.closest\('\[data-vw\]'\);[\s\S]{0,260}OV\.view\.open\(vw\.getAttribute\('data-vw'\), vw, 'pres'\); return; \}\s*\n\s*var tr = ev\.target\.closest/.test(pr), 'the View click is answered before the row click');
  assert.ok(/OV\.view\.paint\(\); fit\(\);/.test(pr));
  const css = app('css/view.css');
  assert.ok(/\.dvo\.dvpres/.test(css) && /\.dvpres \.dvwin \{[^}]*height: 97vh/.test(css), 'a clean, nearly full-screen window for the Presentation');
  assert.ok(!/(^|[^a-z-])\.pres [^{]*\.dvo/.test(css) && !/class = 'dvo' \+ \(o\.mode === 'pres' \? ' pres'/.test(app('js/ov-view.js')), 'the overlay never carries the Presentation\'s own class name');
  assert.ok(/document\.fullscreenElement \|\| document\.webkitFullscreenElement \|\| document\.body/.test(app('js/ov-view.js')), 'inside the full-screen element when the Presentation is full screen');
});

test('the window: Esc closes it and nothing behind hears the key, the keys +, - and 0 zoom, Tab stays inside, it restores the screen and the focus, and a file pdf.js cannot read falls back to the browser\'s own viewer', () => {
  const js = app('js/ov-view.js');
  assert.ok(/addEventListener\('keydown', onKey, true\)/.test(js) && /k === 'Escape'[^\n]*stopImmediatePropagation\(\); ctl\.close\(\)/.test(js));
  assert.ok(/k === 'Tab'/.test(js) && /k === '0'/.test(js) && /e\.ctrlKey && !ctl\.native && inPaper/.test(js));
  assert.ok(/window\.scrollTo\(window\.scrollX, scrollY\)/.test(js) && /mainEl\.scrollTop = mainTop/.test(js) && /ctl\.opener\.focus\(\{ preventScroll: true \}\)/.test(js));
  assert.ok(/URL\.revokeObjectURL\(ctl\.blobUrl\)/.test(js) && /ctl\.pdf\.destroy\(\)/.test(js), 'nothing is kept after it closes');
  assert.ok(/showNative\(new Blob\(\[buf\], \{ type: 'application\/pdf' \}\)\)/.test(js));
  assert.ok(V.ZOOMS[0] === 0.5 && V.ZOOMS[V.ZOOMS.length - 1] === 3 && V.ZOOMS.indexOf(1) > 0);
});
