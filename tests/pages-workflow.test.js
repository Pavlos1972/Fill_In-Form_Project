/* The website's publish step stamps the ?v= tags of the scripts and stylesheets of every page with the commit, so Chrome fetches the new files after an update.
   It once named only three of the four pages (the Client Overview Studio's tags were raised by hand in every release). This runs the workflow's own command on a copy of the pages. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8');

/* the lines of the "run: |" block of the step with this name */
function stepBlock(name) {
  const lines = yml.split('\n');
  const at = lines.findIndex(l => l.includes('name: ' + name));
  assert.ok(at >= 0, 'step not found: ' + name);
  const run = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  assert.ok(run > at && run - at <= 2, 'the step has no run block');
  const out = [];
  for (let i = run + 1; i < lines.length && (/^\s{10,}\S/.test(lines[i]) || lines[i].trim() === ''); i++) out.push(lines[i]);
  return out.join('\n').trim();
}

const STEP = 'Make the browser fetch the new scripts after an update';
const pagesWithTags = fs.readdirSync(path.join(root, 'app')).filter(f => /\.html$/.test(f) && /\.(js|css)\?v=[0-9a-z]+"/.test(fs.readFileSync(path.join(root, 'app', f), 'utf8')));

test('every page that carries ?v= tags is named in the publish step, in the stamp and in its check', () => {
  const block = stepBlock(STEP);
  assert.ok(pagesWithTags.length >= 4, 'pages with tags: ' + pagesWithTags.join(', '));
  pagesWithTags.forEach(f => {
    const named = block.split('\n').filter(l => l.includes('app/' + f));
    assert.ok(named.length >= 2, f + ' is not named in both the sed line and the grep line of the publish step');
    assert.ok(named.some(l => /sed -i/.test(l)) && named.some(l => /grep -c/.test(l)), f + ': one of the two commands leaves it out');
  });
});

test('running the workflow\'s own command stamps every tag of all four pages with the commit and fails on none', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-wf-'));
  try {
    fs.mkdirSync(path.join(dir, 'app'));
    pagesWithTags.forEach(f => fs.copyFileSync(path.join(root, 'app', f), path.join(dir, 'app', f)));
    const sha = 'abcdef0123456789abcdef0123456789abcdef01';
    const r = spawnSync('bash', ['-e', '-c', stepBlock(STEP)], { cwd: dir, env: Object.assign({}, process.env, { GITHUB_SHA: sha }), encoding: 'utf8' });
    assert.strictEqual(r.status, 0, 'the publish step failed: ' + r.stderr + r.stdout);
    pagesWithTags.forEach(f => {
      const text = fs.readFileSync(path.join(dir, 'app', f), 'utf8');
      const tags = text.match(/\.(js|css)\?v=[0-9a-z]+"/g) || [];
      assert.ok(tags.length > 0, f + ' lost its tags');
      tags.forEach(t => assert.ok(t.includes('?v=abcdef0123"'), f + ' still has an old tag: ' + t));
    });
    /* nothing but the tags changed */
    pagesWithTags.forEach(f => {
      const before = fs.readFileSync(path.join(root, 'app', f), 'utf8').replace(/\?v=[0-9a-z]+"/g, '?v="');
      const after = fs.readFileSync(path.join(dir, 'app', f), 'utf8').replace(/\?v=[0-9a-z]+"/g, '?v="');
      assert.strictEqual(after, before, f + ' changed outside its tags');
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
