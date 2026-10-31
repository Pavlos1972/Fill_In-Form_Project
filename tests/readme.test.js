/* README.md stays true to the code. Only what can be checked by a program is checked here: the page order and the files the Layout table names. Everything else in the README is kept up to date by hand (see CLAUDE.md). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('the README lists the pages in the order of the form', () => {
  const line = readme.split('\n').find(l => l.startsWith('- **Fill in** each section'));
  assert.ok(line, 'the "Fill in each section" bullet is missing');
  let from = 0;
  schema.sections.forEach(s => {
    const at = line.indexOf(s.title, from);
    assert.ok(at >= 0, 'the README does not list "' + s.title + '" here, or lists it out of order');
    from = at + s.title.length;
  });
});

/* The rows of the Layout table: [first cell, second cell] */
function layoutRows() {
  const lines = readme.split('\n'), start = lines.findIndex(l => l.trim() === '## Layout');
  assert.ok(start >= 0, 'the "## Layout" section is missing');
  const rows = [];
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) if (/^\|/.test(lines[i]) && !/^\|[-\s|]+\|$/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map(x => x.trim()));
  return rows.slice(1);                                                                              // without the header row
}

test('every path the Layout table names exists', () => {
  const rows = layoutRows(); assert.ok(rows.length >= 10);
  rows.forEach(r => (r[0].match(/`([^`]+)`/g) || []).map(x => x.slice(1, -1)).forEach(p => assert.ok(fs.existsSync(path.join(root, p)), p + ' is in the Layout table but does not exist')));
});

test('every script, stylesheet and workflow of the app is in the Layout table', () => {
  const named = layoutRows().map(r => r[0]).join(' ');
  const files = [].concat(
    fs.readdirSync(path.join(root, 'app', 'js')).map(f => 'app/js/' + f),
    fs.readdirSync(path.join(root, 'app', 'css')).map(f => 'app/css/' + f),
    fs.readdirSync(path.join(root, '.github', 'workflows')).map(f => '.github/workflows/' + f),
    ['app/index.html', 'tests/', 'docs/']);
  files.forEach(f => assert.ok(named.includes('`' + f + '`'), f + ' is not in the README Layout table: add a row for it'));
});

test('the README does not point at the folder that was removed', () => {
  assert.ok(!fs.existsSync(path.join(root, 'dist')));
  assert.ok(!/`dist\/?`/.test(readme), 'the README still names dist/');
});
