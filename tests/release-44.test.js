/* Release 4.4: the Short Risk Application and Investment Capture Sheet links are one "Other forms" menu in the Fact Find's top bar; the keys-and-costs table stays. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const schema = require('../app/js/schema.js');
const B = require('../app/js/build.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

test('the version is at least 4.4 and the build matches it', () => { assert.ok(parseFloat(schema.version) >= 4.4); assert.strictEqual(B.BUILD, schema.version); });

test('the top bar has one "Other forms" menu holding both links, and the keys-and-costs table beside it', () => {
  const h = app('index.html');
  const m = h.match(/<details class="otherforms" id="otherForms">([\s\S]*?)<\/details>/);
  assert.ok(m, 'the menu is there');
  assert.ok(/<summary[^>]*>Other forms/.test(m[1]), 'its button says Other forms');
  assert.ok(/id="linkSR" href="short-risk.html(?:\?from=factfind)?"/.test(m[1]) && /id="linkCS" href="capture-sheet.html(?:\?from=factfind)?"/.test(m[1]), 'both links are inside it');
  assert.ok(/target="_blank"/.test(m[1]), 'each opens in another tab');
  const before = h.slice(0, h.indexOf('<details class="otherforms"'));
  assert.ok(!/id="linkSR"|id="linkCS"/.test(before) && !/id="linkSR"|id="linkCS"/.test(h.slice(h.indexOf('</details>', h.indexOf('otherforms')) + 10)), 'the links are nowhere else');
  assert.ok(h.indexOf('id="svcTable"') > h.indexOf('</details>'), 'the keys-and-costs table is still there, after the menu');
});

test('the menu is styled and closes on Escape, on a click elsewhere and on a chosen link', () => {
  assert.ok(/\.top \.otherforms/.test(app('css/app.css')) && /\.top \.ofmenu/.test(app('css/app.css')));
  const u = app('js/ui.js');
  assert.ok(/function ofClose/.test(u) && /Escape/.test(u) && /\.ofmenu a/.test(u));
});

test('the other two pages carry the same build', () => {
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});
