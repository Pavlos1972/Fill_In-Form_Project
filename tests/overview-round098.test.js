/* Client Overview Studio 0.98 (24 November, Paul's screenshot of 0.97 on the website: after one click on "Load from client folder…" the wait said "New Business: checking, Client Files: checking… 19 s").
   "Checking" = Chrome had not answered even the first question about the connected folders, so 0.97, which asked its permission question only after that answer, never asked it. 0.98 asks it after queryWait.
   0.99 (Paul: "It shouldn't be opening up the file explorer"): the browser's folder window that 0.98 opened by itself after 2.5 seconds is taken out again; see overview-round099.test.js.
   Without a screen: the shape of the code (the browser check t-overview-round098.js runs it against Chrome-like handles whose first answer never comes). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const code = f => app(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the layout is still 0.1, the saved file gains no key, the changed scripts have new tags', () => {
  const schema = require('../app/js/ov-schema.js');
  assert.ok(/^(0\.9[89]|1\.[01234])$/.test(schema.pageVersion), 'the page version moves on (1.0 now)'); assert.strictEqual(schema.version, '0.1');
  const h = app('overview.html');
  ['ov-schema', 'ov-ui', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[a-z]').test(h), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders-ui\.js\?v=20261124[a-z]/.test(app(f)), f));
});

test('the permission question is asked after queryWait even when Chrome has not answered the first question, and the first answer still counts (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/queryWait: 1200, probe: 2500, saveQuery: 3000, saveAsk: 15000 \};/.test(ui), 'the limit is one table with the others');
  assert.ok(/var WAIT = \{ wait: true \}/.test(ui) && /setTimeout\(function \(\) \{ r\(WAIT\); \}, T\.queryWait \|\| 1200\)/.test(ui), 'the first answer is given queryWait');
  assert.ok(/first === WAIT \? Promise\.race\(\[q\.then\(function \(x\) \{ return x === 'granted' \? x : mine; \}\), mine\]\) : mine/.test(ui), 'a late "granted" from the first question or the answer to the permission question, whichever comes first');
  assert.ok(/var gate = first === WAIT \|\| !last \? Promise\.resolve\(\)/.test(ui), 'both folders are asked at once when the first answers never come');
});

test('the client\'s folder window is opened without a stored folder as its start (a stored folder may be the one Chrome does not answer about) (folders-ui.js)', () => {
  const c = code('js/folders-ui.js');
  assert.ok(!/startIn/.test(c), 'no startIn anywhere in the code');
  assert.ok(/id: 'wr-client-folder', mode: 'read'/.test(c));
});
