/* Client Overview Studio 0.96 (24 November: "Load from client folder" stuck on "Looking for the client's folder…" in 0.95). Without a screen: the folder walk has a time budget and hands back what it found, the file choice gives the
   same answers as in 0.95 on a faster path, and the wiring: every step of a folder search has a limit and says where it is, an error in the load shows a message, nothing walks the folders by itself, the Load's list serves
   the View buttons. The stalls themselves are checked on the real page in tests/browser/t-overview-round096.js. Invented client only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const F = require('../app/js/folders.js');
const V = require('../app/js/ov-view.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

/* a pretend directory: entries() yields [name, handle] */
const dirOf = (kids, o) => ({ kind: 'directory', async *entries() { for (const [n, h] of Object.entries(kids)) { if (o && o.delay) await new Promise(r => setTimeout(r, o.delay)); yield [n, typeof h === 'object' && h.kind ? h : (h === 'dir' ? dirOf({}) : { kind: 'file', name: n })]; } } });
const tree = n => { const kids = {}; for (let i = 0; i < n; i++) kids['Statement ' + (100000 + i) + '.pdf'] = 'f'; return kids; };

test('viewableFiles: lists PDFs and pictures down the tree, with the folder names it passed', async () => {
  const c = { handle: dirOf({ '3. Quotes': dirOf({ 'a.pdf': 'f', 'b.txt': 'f', 'c.PNG': 'f' }), 'Archive': dirOf({ '2019': dirOf({ 'old.pdf': 'f' }) }), 'top.jpg': 'f' }) };
  const out = await F.viewableFiles(c);
  assert.deepStrictEqual(out.map(f => (f.rel.concat(f.name)).join('/')).sort(), ['3. Quotes/a.pdf', '3. Quotes/c.PNG', 'Archive/2019/old.pdf', 'top.jpg']);
  assert.strictEqual(out.partial, false);
});

test('viewableFiles: it stops at the entry limit and says so (partial), keeping what it found', async () => {
  const out = await F.viewableFiles({ handle: dirOf(tree(500)) }, { cap: 120 });
  assert.strictEqual(out.partial, true); assert.ok(out.length >= 100 && out.length <= 121, 'kept what it had found: ' + out.length);
});

test('viewableFiles: it stops at its time limit and says so, and the sink hands the files to a caller that gave up', async () => {
  const sink = [], out = await F.viewableFiles({ handle: dirOf(tree(400), { delay: 3 }) }, { ms: 120, sink });
  assert.strictEqual(out.partial, true); assert.strictEqual(out, sink, 'the same array'); assert.ok(sink.length > 5 && sink.length < 400, 'some, not all: ' + sink.length);
});

test('viewableFiles: the default is bounded (12 seconds, 2,500 entries): a huge folder cannot hold the page up', () => {
  const src = app('js/folders.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/cap = lim\.cap \|\| 2500/.test(src) && /lim\.ms \|\| 12000/.test(src) && /out\.partial = true/.test(src));
});

/* the file choice is unchanged in meaning: the same answers as 0.95 on a faster path */
const FL = (name, rel) => ({ name, rel: rel || [], handle: {} });
test('pick: the answers of 0.95 are the same on the faster path (name first, BrightRock summary never the manual, another policy\'s number rules a file out, a statement only by its number, a file another item holds is skipped)', () => {
  const pool = [FL('BR Policy Summary Schedule - 8844.pdf'), FL('BR Owners Manual 8844.pdf'), FL('BR Owners Manual 7777.pdf'), FL('Test Group Statement 2026.pdf'), FL('Reduced 100000093 (renamed).pdf'), FL('BR CMPO - 100000093.pdf')];
  const sch = n => ({ role: 'schedule', name: '', policyNo: n, insurer: 'BrightRock', bright: true, label: 'x' });
  assert.strictEqual(V.pick(sch('8844'), pool).file.name, 'BR Policy Summary Schedule - 8844.pdf');
  assert.strictEqual(V.pick(sch('7777'), pool).reason, 'manual');
  assert.ok(!V.pick(sch('5555'), pool).file, 'another policy\'s schedule is never offered');
  assert.strictEqual(V.pick({ role: 'statement', name: 'Gone.pdf', policyNo: '', insurer: 'Test Lost Provider', label: 'x' }, pool).reason, 'missing');
  assert.strictEqual(V.pick({ role: 'quote', name: 'old.pdf', number: '100000093', insurer: 'BrightRock', label: 'x' }, pool).file.name, 'Reduced 100000093 (renamed).pdf');
  assert.strictEqual(V.pick({ role: 'guide', name: '', number: '100000093', insurer: 'BrightRock', label: 'x' }, pool).file.name, 'BR CMPO - 100000093.pdf');
  assert.ok(!V.pick(sch('8844'), pool, { 'br policy summary schedule - 8844.pdf': true }).file, 'a file another item holds is skipped');
  assert.strictEqual(V.pick(sch('8844'), [FL('BR Policy Summary Schedule - 8844.pdf')]).how, 'search');
  assert.strictEqual(V.pick({ role: 'schedule', name: 'br policy summary schedule - 8844.PDF', policyNo: '8844', insurer: 'BrightRock', bright: true, label: 'x' }, pool).how, 'name');
});

test('pick: 40 buttons over 4,000 files are chosen in well under a quarter of a second (0.95 took about 280 ms for every redraw), and the facts of a file are worked out once', () => {
  const files = [], w = ['BR', 'Liberty', 'Policy', 'Summary', 'Schedule', 'Quote', 'FNA', 'Statement', '2026', 'Astute', 'Report', 'Old Mutual', 'Discovery'];
  for (let i = 0; i < 4000; i++) files.push(FL(w[i % 13] + ' ' + w[(i * 7) % 13] + ' ' + (100000 + i) + ' - ' + (i % 28 + 1) + '.11.26.pdf', ['3. Quotes', '2026']));
  const refs = []; for (let k = 0; k < 40; k++) refs.push({ role: ['schedule', 'quote', 'statement', 'guide'][k % 4], name: 'x' + k + '.pdf', policyNo: String(8000 + k), number: String(100000 + k * 37), insurer: ['BrightRock', 'Liberty', 'Old Mutual'][k % 3], bright: k % 3 === 0, label: 'x', product: 'Test product' });
  const t0 = Date.now(); refs.forEach(r => V.pick(r, files, {})); const first = Date.now() - t0;
  const t1 = Date.now(); for (let i = 0; i < 5; i++) refs.forEach(r => V.pick(r, files, {})); const again = (Date.now() - t1) / 5;
  assert.ok(first < 250, 'first pass (works the facts out) ' + first + ' ms'); assert.ok(again < 120, 'a later pass ' + again + ' ms');
  assert.ok(files[0]._k && typeof files[0]._k.n === 'string', 'kept on the file');
});

test('every step of a folder search has a limit and a name: permission, find, list, walk (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/var TIMEOUTS = \{ permission: 45000, find: 45000, list: 60000, walk: 15000, stopLink: 8000, askAgain: 4000, askNext: 3000, queryWait: 1200, probe: 2500, saveQuery: 3000, saveAsk: 15000(, policyFolder: 5000)? \}/.test(ui), 'the limits');
  assert.ok(/function race\(p, ms\)/.test(ui) && /resolve\(SLOW\)/.test(ui), 'a promise that does not answer in time gives SLOW');
  ['slow-permission', 'slow-find', 'slow-list'].forEach(r => assert.ok(ui.indexOf("'" + r + "'") >= 0, r));
  assert.ok(/race\(requestRoot\(all\[k\]\.handle, function \(t\) \{ why\[k\] = t; \}\), left\(\)\)/.test(ui) && /deadline = Date\.now\(\) \+ T\.permission/.test(ui) && /race\(F\.findClients\(r\.live, info\.sname, info\.fname\), T\.find\)/.test(ui) && /race\(F\.clientDocuments\(client, \{ sink: docSink, perFolder: T\.policyFolder \}\), T\.list\)/.test(ui) && /race\(F\.clientSubfolder\(clients\[0\], kind\), T\.list\)/.test(ui), 'Load, Upload and the View list all race their waits');
  assert.ok(/say\('permission'\)/.test(ui) && /say\('find'\)/.test(ui) && /say\('list'\)/.test(ui) && /say\('walk'\)/.test(ui), 'each stage is announced');
  assert.ok(/race\(F\.permission\(h, !!ask\), TIMEOUTS\.permission\)/.test(ui), 'the key-points library never waits for ever on a question either');
  assert.ok(/timeouts: TIMEOUTS/.test(ui), 'the limits are in FF.foldersUI.timeouts, for the tests');
});

test('the screen: Load and Upload watch their search (the stage and the seconds, a Stop link, an end that always comes), an error in the load shows a message, and a late result of a stopped search is ignored', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function watchSearch\(act\)/.test(ui) && /Stop and use the normal file window/.test(ui) && /var searchTok = 0;/.test(ui));
  assert.ok(/Waiting for Chrome’s permission question: look next to the address bar and click Allow/.test(ui), 'the wait says what it waits for');
  assert.ok(/FU\.clientFiles\(\{ sname: state\.header\.sname, fname: state\.header\.fname \}, \{ onStage: me\.stage, onPerm: me\.perm \}\)/.test(ui) && /FU\.clientFolder\(\{ sname: state\.header\.sname, fname: state\.header\.fname \}, CLIENT_KIND\[block\], \{ onStage: w\.stage, onPerm: w\.perm \}\)/.test(ui), 'both searches report their stage');
  assert.ok(/if \(me\.stale\(\)\) return;/.test(ui), 'a result that comes after the search was stopped changes nothing');
  assert.ok(/\.catch\(function \(e\) \{ if \(me\.stale\(\)\) return; normal\('Something went wrong while looking for the client’s folder/.test(ui), 'an error in the success handler is told');
  assert.ok(/toastLink\(\(why \? why \+ ' ' : ''\) \+ 'Nothing was loaded\.', 'Open the normal file window'/.test(ui), 'after a long wait the browser would refuse the window, so the message carries the button for the click that is needed');
  ['slow-permission', 'slow-find', 'slow-list'].forEach(r => assert.ok(ui.indexOf("'" + r + "'") >= 0, r + ' has its words'));
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no name twice');
});

test('nothing walks the folders by itself: paint never lists, only a click does (the Presentation opens, a View is clicked), and a Load\'s list serves the buttons', () => {
  const vw = app('js/ov-view.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const paintNow = vw.slice(vw.indexOf('function paintNow()'), vw.indexOf('function warm()'));
  assert.ok(!/clientIndex|ensure\(|warm\(/.test(paintNow), 'paintNow only brings the buttons in line with what is known');
  assert.ok(/function paint\(\) \{[^}]*setTimeout\(function \(\) \{ paintT = null; paintNow\(\); \}, 120\)/.test(vw), 'a burst of redraws is one');
  assert.ok(/function warm\(\)/.test(vw) && /clientIndex\(info\(\), \{ ask: false \}\)/.test(vw) && /function seed\(label, files\)/.test(vw));
  const pr = app('js/ov-present.js'); assert.ok(/OV\.view\.warm\(\)/.test(pr), 'the Presentation (a click) asks for the list');
  const ui = app('js/ov-ui.js'); assert.ok(/OV\.view\.seed\(res\.label, res\.files\)/.test(ui) && /OV\.view\.invalidate\(\); drawNav\(\)/.test(ui) && /FF\.foldersUI\.init\(function \(\) \{ drawMeta\(\); paintView\(\); \}\)/.test(ui));
});

test('a list that covers only some folders never greys a button; a complete one does (statusOf)', () => {
  const src = app('js/ov-view.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/vs\.idx\.partial \? neutral : \{ ok: false/.test(src), 'partial: neutral');
  assert.ok(/idx\.partial\) return \{ reason: 'partial'/.test(src) && /The client’s folder is big: its list was cut short/.test(src), 'and a click on a button whose file was not found in a cut-short list says so');
});

test('the page version moves on with the fixes (0.97 now), the layout is still 0.1 and the saved file gains no key', () => {
  const schema = require('../app/js/ov-schema.js'); assert.ok(/^1\.[0123456]$/.test(schema.pageVersion), 'the page version is 1.0 to 1.6'); assert.strictEqual(schema.version, '0.1');
});
