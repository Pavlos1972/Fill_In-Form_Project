/* Client Overview Studio 0.97 (24 November: on the website copy of 0.96 one click on "Load from client folder…" showed only "Waiting for Chrome's permission question… 7 s" and no question from Chrome, where 0.94 had opened the ticked list at once).
   Found by running 0.94 and 0.96 against handles that behave like Chrome's: the calls after the click are the same in both, and both wait for EVERY connected folder to answer, so one folder Chrome leaves unanswered holds the whole list back.
   Without a screen: the shape of the code (the browser check t-overview-round097.js runs it). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

test('the page version moves on with the fixes (1.0 now), the layout is still 0.1 and the saved file gains no key', () => {
  const schema = require('../app/js/ov-schema.js');
  assert.ok(/^1\.[0123456789]$/.test(schema.pageVersion), 'the page version is 1.0 to 1.6'); assert.strictEqual(schema.version, '0.1');
  assert.ok(/ov-schema\.js\?v=20261124[a-z]/.test(app('overview.html')) && /ov-ui\.js\?v=20261124[a-z]/.test(app('overview.html')) && /folders-ui\.js\?v=20261124[a-z]/.test(app('overview.html')), 'the changed scripts have new ?v= tags');
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders-ui\.js\?v=20261124[a-z]/.test(app(f)), f));
});

test('every connected folder is asked about at the same moment, the click is behind the first question, and the list opens as soon as ONE folder is open (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/var queries = keys\.map\(function \(k\) \{ st\[k\] = 'asking'; return race\(queryRoot\(all\[k\]\.handle/.test(ui), 'every folder is queried in the same turn, with no await between');
  assert.ok(/last = mine\.then\(function \(\) \{\}, function \(\) \{\}\)/.test(ui) && /requestRoot\(all\[k\]\.handle/.test(ui) && /T\.askNext \|\| 3000/.test(ui) && /deadline = Date\.now\(\) \+ T\.permission/.test(ui), 'a folder that is not open is asked for after the one before has answered or after a few seconds, all under one limit');
  assert.ok(/await \(early \? Promise\.race\(\[firstOpen, finished\]\) : finished\)/.test(ui), 'early: the first open folder is enough');
  assert.ok(/liveRoots\(true, say, \{ early: true, onPerm: opts && opts\.onPerm \}\)/.test(ui) && (ui.match(/\{ early: true/g) || []).length >= 3, 'Load, Upload and the View index all start early');
  assert.ok(/async function findInOpen\(r, info, say\)/.test(ui) && /r\.rest/.test(ui), 'a client who is not in the open folders makes the page wait for the others');
  assert.ok(/reason: 'client', skipped: /.test(ui), 'and a folder that was not open is named in the answer');
  assert.ok(/why\[k\] = t/.test(ui) && /function whyText\(e\)/.test(ui), 'what Chrome said when it refused is kept');
});

test('the client\'s own folder can be picked in the browser\'s folder window: read only, opens in New Business, the same list (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/async function pickClientFolder\(\)/.test(ui) && /id: 'wr-client-folder', mode: 'read'/.test(ui) && !/startIn/.test(ui.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')), 'read only, no starting folder passed (a stored folder may be the stuck one)');
  assert.ok(/listClient\(\{ handle: h, parts: \[h\.name\] \}, TIMEOUTS\)/.test(ui), 'the same list as the connected folders give');
  assert.ok(/pickClientFolder: pickClientFolder/.test(ui) && /askAgain: 4000/.test(ui), 'exported, and the limit for offering another try');
});

test('the screen: the wait names each folder and what Chrome said, and after 4 seconds offers Ask Chrome again, the client\'s own folder and the normal file window (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function watchSearch\(act\)/.test(ui) && /w\.perm = function \(states, why, qa\)/.test(ui), 'the wait takes what Chrome says about each folder');
  assert.ok(/text: 'Ask Chrome again'/.test(ui) && /text: 'Choose the client’s folder myself'/.test(ui) && /text: 'Stop and use the normal file window'/.test(ui), 'the three buttons');
  assert.ok(/function toastLinks\(msg, links, ms\)/.test(ui) && /data-toastlink="' \+ i \+ '"/.test(ui), 'a message can carry several buttons');
  assert.ok(/function chooseFolder\(\)/.test(ui) && /FU\.pickClientFolder\(\)\.then/.test(ui) && /function showList\(res, click\)/.test(ui), 'the picked folder opens the same list');
  assert.ok(/'Nothing was chosen\.'/.test(ui) && /function reasonText\(res\)/.test(ui) && /Chrome said: /.test(ui), 'a cancelled window and a refusal are told with Chrome\'s words');
  assert.ok(/not open to this page yet, so only the other connected folder was searched/.test(ui), 'the list says when a connected folder was not searched');
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no name twice');
});
