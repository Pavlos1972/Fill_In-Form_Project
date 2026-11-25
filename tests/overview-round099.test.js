/* Client Overview Studio 0.99 (24 November, Paul's screenshot of 0.98: "It's brought up the wrong file explorer for the wrong client. This is not what it looked like before ... It shouldn't be opening up the file explorer").
   0.98 opened the browser's folder window by itself 2.5 seconds after the click when no connected folder had answered; the window opened where Chrome last used it (another client's folder) and whatever was chosen was loaded.
   0.99: that window never opens by itself; the page's OWN window says what Chrome has been asked and which client folder is wanted; a folder chosen by hand is checked against the client.
   Without a screen: the shape of the code (the browser check t-overview-round099.js runs it). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const code = f => app(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the page version is 1.0 (0.99 in the 0.99 release), the layout is still 0.1, the saved file gains no key, the changed scripts have new tags', () => {
  const schema = require('../app/js/ov-schema.js');
  assert.ok(/^(1\.[0123456789]|2\.[01])$/.test(schema.pageVersion), 'the page version is 1.0 to 1.6'); assert.strictEqual(schema.version, '0.1');
  const h = app('overview.html');
  ['ov-schema', 'ov-ui', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=(?:20261124[a-z]|20261125[a-z])').test(h), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders-ui\.js\?v=2026112[0-9][a-z]/.test(app(f)), f));
});

test('the browser\'s folder window never opens by itself: no auto limit, no auto timer, no auto action (folders-ui.js, ov-ui.js)', () => {
  const f = code('js/folders-ui.js'), u = code('js/ov-ui.js');
  assert.ok(!/autoPick|autoT\b|act\.auto|auto: FU/.test(f + u), 'nothing is left of the automatic window');
  assert.ok(/pickClientFolder\(\)\.then/.test(u) && (u.match(/pickClientFolder/g) || []).length === 2, 'the window is opened from one place only: the chooseFolder button action (and its check that the function exists)');
});

test('a folder is shown as asked the moment the question goes out, so the screen never says "checking" over a question Chrome is showing (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/gate\.then\(function \(\) \{ st\[k\] = 'prompt'; tell\(\); return race\(requestRoot\(/.test(ui));
});

test('the silent case is the page\'s own window with what Chrome has been asked, the folder wanted and three actions (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function askWindow\(title, html, buttons\)/.test(ui) && /dlg\.showModal\(\)/.test(ui), 'a window of the page\'s own, with buttons whose click runs inside the same click');
  assert.ok(/The page cannot open your client folders yet/.test(ui) && /text: 'Ask Chrome again'/.test(ui) && /text: 'Choose the client’s folder myself'/.test(ui) && /text: 'Stop'/.test(ui), 'its title and three buttons');
  assert.ok(/The page is looking for the folder named/.test(ui) && /F\.clientFolderName\(state\.header\.sname, state\.header\.fname\)/.test(ui), 'it names the client folder wanted');
  assert.ok(/Chrome has been asked and is waiting for you: look next to the address bar for <b>Edit files\?<\/b>/.test(ui) && /Chrome has not answered the page’s question/.test(ui), 'it says whether Chrome has been asked');
  assert.ok(/go to <b>More<\/b>, then <b>Folders…<\/b>, and choose both folders again/.test(ui), 'and where to reconnect');
});

test('a folder chosen by hand is checked against the client: another client\'s folder is refused, a name that is not a client\'s is asked about (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/F\.clientMatches\(res\.label, sn, fn\)/.test(ui) && /!!F\.parseClient\(res\.label\)/.test(ui), 'the folder\'s own name is compared with the client\'s');
  assert.ok(/That is another client’s folder/.test(ui) && /Nothing was loaded\./.test(ui) && /Is this the client’s folder\?/.test(ui) && /text: 'Load them anyway'/.test(ui) && /text: 'Choose again'/.test(ui));
  assert.ok(/if \(same\) \{ showList\(res, false\); return; \}/.test(ui), 'the client\'s own folder goes straight to the list');
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no name twice');
});

test('the real name check works on the client\'s folder name as the page writes it (folders.js)', () => {
  const F = require('../app/js/folders.js');
  assert.strictEqual(F.clientMatches('View, Vera', 'View', 'Vera'), true);
  assert.strictEqual(F.clientMatches('View, Vera Anne', 'View', 'Vera'), true);
  assert.strictEqual(F.clientMatches('Other, Olive', 'View', 'Vera'), false);
  assert.strictEqual(!!F.parseClient('Other, Olive'), true, 'another client\'s folder name reads as a client\'s name');
  assert.strictEqual(!!F.parseClient('3. Quotes'), false, 'a subfolder\'s name does not');
});

test('with no client name there is nothing to name or to check against: the window names no folder and Choose myself asks for the names first (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/F\.norm\(state\.header\.sname\) !== ''/.test(ui), 'wanted() is empty with no surname');
  assert.ok(/if \(FF\.folders\.norm\(state\.header\.sname\) === ''\) \{ abandonSearch\(\); toast\(REASONS\.names/.test(ui), 'chooseFolder stops before the folder window with no name');
});
