/* The audit's fourth batch: the publishing workflow runs the tests first, the local launcher files stay off the website, and what was removed stays removed. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('publishing runs the tests first, and a pull request runs them too', () => {
  const pages = read('.github/workflows/pages.yml');
  assert.ok(pages.includes('run: npm test'), 'pages.yml has no test step');
  assert.ok(pages.indexOf('run: npm test') < pages.indexOf('actions/upload-pages-artifact'), 'the tests must run before anything is uploaded');
  assert.ok(pages.indexOf('run: npm test') < pages.indexOf('actions/deploy-pages'));
  const tests = read('.github/workflows/tests.yml');
  assert.match(tests, /pull_request:/); assert.match(tests, /run: npm test/);
});

test('the files that start the Fact Find on a computer are left off the website, and stay in the app folder', () => {
  assert.match(read('.github/workflows/pages.yml'), /rm -f "app\/Start Fact Find\.bat" app\/FactFindServer\.ps1/);
  assert.ok(fs.existsSync(path.join(root, 'app', 'Start Fact Find.bat')) && fs.existsSync(path.join(root, 'app', 'FactFindServer.ps1')));
});

test('the browser tests are in the project, with a runner', () => {
  const dir = path.join(root, 'tests', 'browser');
  assert.ok(fs.existsSync(path.join(dir, 'run.sh')));
  const scripts = fs.readdirSync(dir).filter(f => /\.js$/.test(f));
  assert.ok(scripts.length >= 30, scripts.length + ' scripts');
  scripts.forEach(f => assert.ok(!/\/tmp\/claude|\/opt\/pw-browsers/.test(fs.readFileSync(path.join(dir, f), 'utf8')), f + ' names a path of the machine it was written on'));
  assert.match(read('package.json'), /"test:browser"/);
});

test('the dead "part" band and the unused styles are gone, and the stale dist folder is not in the project', () => {
  assert.ok(!/b\.part\b/.test(read('app/js/ui.js')) && !/b\.part\b/.test(read('app/js/pdf.js')));
  const css = read('app/css/app.css');
  ['.pill', '.badge.newcol', '.heard-warn', '.heard-bad', '.partband'].forEach(c => assert.ok(!css.includes(c), c));
  assert.ok(!fs.existsSync(path.join(root, 'dist')));
});

test('Settings warns that the keys are kept in the browser and can remove them', () => {
  const html = read('app/index.html');
  assert.match(html, /Keep the keys safe/); assert.match(html, /id="setForget"/);
  assert.match(read('app/js/ui.js'), /setForget/);
});

test('an unsaved draft is offered back, not restored by itself', () => {
  const ui = read('app/js/ui.js');
  assert.match(ui, /Unsaved changes found/); assert.match(ui, /restoreDraft/);
  assert.ok(!/state = restored \|\| store\.blank\(\)/.test(ui));
});
