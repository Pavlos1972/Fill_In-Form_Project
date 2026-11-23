/* Release 5.2 (the Fact Find; the Risk Application stays 1.4 and the Investment Application 1.3): the Fact Find saves straight into the client's "2. Fact Find" folder, with the same Folders… connection as the other
   two pages. The adviser's request after 1.4 worked on his real OneDrive. The folder logic itself (client missing = a first meeting, "2. Fact Find" missing, a client in Client Files, both places, a loaded Fact Find, the path
   check) is tested at the end of tests/folders.test.js on a pretend folder tree; the page side is tests/browser/t-folders-ff.js on a real directory tree in the browser. Pinned here: the versions and builds, that nothing
   in the saved file changed, that the other files the Fact Find saves are untouched, and that the records are written. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');
const SR = require('../app/js/sr-schema.js');
const CS = require('../app/js/cs-schema.js');
const store = require('../app/js/store.js');
const F = require('../app/js/folders.js');

const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const root = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('versions: Fact Find 5.2 (compared as decimals), Risk Application 1.4 and Investment Application 1.3 or later; every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 5.2, schema.version);
  assert.ok(parseFloat(SR.version) >= 1.4 && parseFloat(CS.version) >= 1.3, SR.version + ' ' + CS.version);
  assert.strictEqual(require('../app/js/build.js').BUILD, schema.version);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('nothing in the saved file changed: the same top-level keys, the same boxes and lists, only schema says the new version', () => {
  const s = store.blank(), j = JSON.parse(store.toJSON(s));
  assert.deepStrictEqual(Object.keys(j), ['app', 'schema', 'created', 'modified', 'f', 'l', 'covered', 'sum', 'auto', 'pa', 'focus', 'unplaced', 'claude', 'openai'], 'no new top-level key');
  assert.strictEqual(j.schema, schema.version);
  assert.strictEqual(Object.keys(schema.fieldsById).length, 241, 'no box added or removed');
  assert.ok(schema.fieldsById.fname && schema.fieldsById.sname, 'the two boxes the Fact Find\'s folder search reads');
});

test('the scripts the Fact Find loads: folders.js and folders-ui.js before ui.js, the stylesheet, the Folders… button in the left group of the top bar, and every changed script has a new ?v= tag', () => {
  const h = app('index.html');
  assert.ok(h.indexOf('js/folders.js') < h.indexOf('js/folders-ui.js') && h.indexOf('js/folders-ui.js') < h.indexOf('js/ui.js'));
  assert.ok(h.includes('css/folders.css'));
  assert.ok(h.indexOf('id="btnOpen"') < h.indexOf('id="btnFolders"') && h.indexOf('id="btnFolders"') < h.indexOf('class="grp mid"'), 'Folders… sits with Settings, New and Open…');
  ['folders.js', 'folders-ui.js', 'ui.js', 'build.js', 'schema.js'].forEach(f => assert.match(h, new RegExp('js/' + f.replace('.', '\\.') + '\\?v=(?:20261118d|20261120a|20261121a|20261122a|20261123c|20261124d)'), f));
  ['short-risk.html', 'capture-sheet.html'].forEach(f => ['folders.js', 'folders-ui.js', 'build.js'].forEach(x => assert.match(app(f), new RegExp('js/' + x.replace('.', '\\.') + '\\?v=(?:20261118d|20261120a|20261121a|20261122a|20261123c|20261124d)'), f + ' ' + x)));
});

test('only the Fact Find\'s .json and PDF look for the client\'s folder: Save as…, the voice log and the questionnaire-style extras do not', () => {
  const ui = app('js/ui.js');
  assert.ok(/'fact-find-data', fileHandle, \{ auto: !forceAs \}/.test(ui), 'Save: automatic on a first Save only (a remembered file is written back; Save as… is the normal window)');
  assert.ok(/'fact-find-pdf', fileHandle, \{ auto: true, sibling: fileHandle \}/.test(ui), 'Save PDF: beside the saved file, else the client\'s folder');
  const logSave = ui.slice(ui.indexOf('fact-find-voice-log-') - 400, ui.indexOf('fact-find-voice-log-') + 400);
  assert.ok(!/auto:/.test(logSave) && !/kind: 'factfind'/.test(logSave), 'the live-conversation Save log stays as it was');
  assert.strictEqual((ui.match(/kind: 'factfind'/g) || []).length, 2, 'the kind is named in the flow call and in folderInfo, nowhere else');
});

test('the Fact Find target is the "2. Fact Find" folder, directly inside the client\'s folder, and the names the page accepts', () => {
  assert.ok(F.RULES.factFind.test(F.norm('2. Fact Find')) && F.RULES.factFind.test(F.norm('2.Fact Find')) && F.RULES.factFind.test(F.norm('2.  FACT   FIND')));
  ['Fact Find', '3. Fact Find', '2. Fact Find Old', '2. Fact Finds'].forEach(n => assert.ok(!F.RULES.factFind.test(F.norm(n)), n));
  ['resolveFactFind', 'factFindCandidates'].forEach(n => assert.strictEqual(typeof F[n], 'function', n));
  const src = app('js/folders.js'), body = src.slice(src.indexOf('async function factFindCandidates'), src.indexOf('/* ---------- the file ---------- */'));
  assert.ok(!/create\s*:\s*true|removeEntry|createWritable|\.move\(|\.remove\(/.test(body), 'the search only reads: it never creates, removes, moves or writes a folder or file');
  assert.ok(!/C:\\|liferisk|Users\\/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'[^']*typed[^']*'/g, '')), 'no real path in the shipped code');
});

test('the records: README, the change log, the handover file, and no real client name in them', () => {
  assert.match(root('README.md'), /Release 5\.2 \(18 November 2026\): the Fact Find saves straight into the client's "2\. Fact Find" folder/);
  assert.match(root('docs/FORM-CHANGES.md'), /## 5\.2: 18 November 2026 \(Fact Find 5\.1 to 5\.2/);
  assert.match(root('CLAUDE.md'), /Fact Find 5\.2/);
  assert.match(root('README.md'), /Since 5\.2 a first Save and every Save PDF go into the client's `2\. Fact Find` folder/);
});
