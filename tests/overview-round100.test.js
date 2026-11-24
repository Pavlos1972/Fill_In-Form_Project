/* Client Overview Studio 1.0 (24 November: the Fix Skills chat measured Paul's own Chrome on the website: both stored folders LOAD at once and queryPermission gets no answer for either, also after Chrome was fully restarted;
   choosing both folders again in Folders... made them answer at once). So the saved links go stale, and Chrome says nothing about it.
   1.0: when Chrome has answered nothing about any connected folder the page's own window says the saved links look out of date and offers Reconnect my folders; the Folders... dialog does not show such a folder as Connected;
   Save (which waited for ever on such a folder) says so after a few seconds. The version after 0.99 is 1.0 (versions are compared as decimals; 0.100 would be 0.1).
   Without a screen: the shape of the code (the browser check t-overview-round100.js runs it). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

test('the page version is 1.0 (the decimal after 0.99), the layout is still 0.1, the saved file gains no key, the changed scripts have new tags', () => {
  const schema = require('../app/js/ov-schema.js');
  assert.ok(/^1\.[012]$/.test(schema.pageVersion), 'the page version is 1.0, 1.1 or 1.2'); assert.strictEqual(schema.version, '0.1');
  assert.ok(parseFloat(schema.pageVersion) > parseFloat('0.99'), 'compared as decimals the new version is higher');
  const h = app('overview.html');
  ['ov-schema', 'ov-ui', 'folders-ui'].forEach(f => assert.ok(new RegExp(f + '\\.js\\?v=20261124[a-z]').test(h), f));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/folders-ui\.js\?v=2026112[0-9][a-z]/.test(app(f)), f));
});

test('whether a folder has answered the FIRST question is passed along with the states (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/var qa = \{\};/.test(ui) && /qv\[LABEL\[k\]\] = !!qa\[k\]; \}\); opts\.onPerm\(sv, why, qv\)/.test(ui), 'tell() passes the answered flags as a third argument');
  assert.ok(/if \(v !== SLOW\) \{ qa\[k\] = true; tell\(\); \} return v;/.test(ui), 'a folder is marked answered only when its first question came back');
});

test('the Folders… dialog asks each stored folder with a short limit and does not call a silent one Connected; connect() says which folders were chosen again, also on Esc (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/probe: 2500/.test(ui) && /race\(queryRoot\(h\), TIMEOUTS\.probe \|\| 2500\)/.test(ui), 'the probe has its limit');
  assert.ok(/Chrome is not answering about this folder \(/.test(ui) && /roots\[k\] && !dead \? 'ok' : 'no'/.test(ui), 'a silent folder is said not to answer and is not shown as ok');
  assert.ok(/delete probe\[k\]; if \(chosen\.indexOf\(k\) < 0\) chosen\.push\(k\)/.test(ui) && /resolve\(\{ chosen: chosen\.slice\(\) \}\)/.test(ui), 'a folder chosen again is not silent any more and is reported');
  assert.ok(/dlg\.addEventListener\('close'/.test(ui), 'Done and Esc both close the dialog');
});

test('Save no longer waits for ever for a folder Chrome does not answer about: every folder is asked at once with a limit, a silent one is named, the Save falls back with the reason (folders-ui.js)', () => {
  const ui = app('js/folders-ui.js');
  assert.ok(/saveQuery: 3000, saveAsk: 15000/.test(ui), 'the two limits are in the table');
  assert.ok(!/await F\.permission\(all\[keys\[i\]\]\.handle, true\)/.test(ui), 'the unlimited wait is gone');
  assert.ok(/Promise\.all\(keys\.map\(function \(rk\) \{ return race\(queryRoot\(all\[rk\]\.handle\), T\.saveQuery \|\| 3000\); \}\)\)/.test(ui), 'every folder is asked about at the same moment, with a limit');
  assert.ok(/if \(ra === 'prompt'\) ra = await race\(requestRoot\(all\[rk\]\.handle\), Math\.max\(1, askDeadline - Date\.now\(\)\)\)/.test(ui), 'only a folder that said "not yet" is asked for, within one limit');
  assert.ok(/Chrome is not answering about ' \+ silent\.join\(' and '\)/.test(ui) && /Click Folders… and choose/.test(ui), 'a silent folder is named');
});

test('the page\'s own window has two modes: nothing answered = the saved links look out of date, Reconnect my folders is the main button and Ask Chrome again is not offered; otherwise the 0.99 window (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function stale\(\) \{ var k = Object\.keys\(qans\); return k\.length > 0 && k\.every\(function \(x\) \{ return !qans\[x\]; \}\); \}/.test(ui), 'stale = no folder has answered the first question');
  assert.ok(/var mode = stale\(\) && act\.reconnect \? 'stale' : 'ask';/.test(ui) && /win\.mode !== mode/.test(ui), 'the window follows the mode');
  assert.ok(/text: 'Reconnect my folders', cls: '', fn: act\.reconnect/.test(ui) && /Your connected folders look out of date/.test(ui), 'Reconnect is the main button of the stale window');
  const stale = ui.slice(ui.indexOf("if (mode === 'stale') {"), ui.indexOf("} else {", ui.indexOf("if (mode === 'stale') {")));
  assert.ok(!/Ask Chrome again/.test(stale.replace(/\/\/.*$/gm, '')), 'Ask Chrome again is not in the stale window');
  assert.ok(!/Edit files/.test((ui.match(/if \(mode === 'stale'\) return '[^\n]*\n[^\n]*\n/) || [''])[0]), 'the stale text does not send the adviser looking for a question');
});

test('Reconnect my folders opens the Folders… dialog and starts the search over only when a folder was chosen again; Load and Upload both have it (ov-ui.js)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/function reconnect\(\) \{\s*FU\.connect\(\)\.then\(function \(r\) \{\s*drawMeta\(\); if \(OV\.view\) OV\.view\.forget\(\);\s*if \(r && r\.chosen && r\.chosen\.length\) run\(\);\s*else \{ abandonSearch\(\); toast\('No folder was chosen again, so nothing was loaded\.'/.test(ui), 'Load');
  assert.ok(/choose: FU\.pickClientFolder \? chooseFolder : null, reconnect: reconnect/.test(ui), 'Load hands it to the window');
  assert.ok(/reconnect: function \(\) \{\s*FU\.connect\(\)\.then\(function \(r\) \{\s*drawMeta\(\); if \(OV\.view\) OV\.view\.forget\(\);\s*if \(r && r\.chosen && r\.chosen\.length\) fromClientFolder\(block\)/.test(ui), 'Upload from client folder');
  const names = (ui.match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, '')); assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'no name twice');
});
