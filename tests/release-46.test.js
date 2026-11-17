/* Release 4.6 (display and one rule; no id, list or choice added, removed or relabelled):
   1. The "heard" tag on a box was caught by the style of the microphone line (same class name) and stretched into a bar: it must not be.
   2. Gap cover is greyed out while Medical aid is None: there is no gap cover without a medical aid. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const A = require('../app/js/actions.js');
const S = require('../app/js/summary.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const shown = (s, id) => calc.showIf(schema.fieldsById[id].cond, store.ctxFor(s));
const GAP = ['gap', 'gap_prov', 'gap_broker'];

test('the version is 4.6 or later, and every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 4.6);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('the "heard" tag is not caught by the microphone line style (the class name is shared)', () => {
  const css = app('css/app.css');
  const rules = css.split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
  const bare = rules.filter(sel => sel.split(',').some(x => /(^|\s)\.heard(\b|$)/.test(x.trim()) && !/^div\.heard/.test(x.trim()) && !/\.badge/.test(x)));
  assert.deepStrictEqual(bare, [], 'a style for plain .heard would stretch every heard tag: ' + bare.join(' | '));
  assert.ok(/(^|\n)div\.heard \{ flex: 1 0 100%/.test(css), 'the microphone line keeps its style, on the div');
  const html = app('index.html');
  assert.ok(/<div class="heard" id="heard"/.test(html) && /<div class="heard heard-bad" id="nolisten"/.test(html), 'the two microphone lines are divs');
  assert.ok(/\.badge\.heard \{[^}]*background: var\(--accent\)/.test(css), 'the heard tag keeps its own colours');
});

test('Gap cover, its provider and its broker are greyed while Medical aid is None, and open when it is not', () => {
  GAP.forEach(id => { const f = schema.fieldsById[id]; assert.strictEqual(f.grey, 1, id + ' is greyed, not hidden'); assert.ok(f.cond, id + ' has a rule'); });
  const s = fresh();
  assert.ok(shown(s, 'gap'), 'Medical aid not answered yet: the Gap cover answer is open');
  set(s, 'ma', 'None');
  GAP.forEach(id => assert.strictEqual(shown(s, id), false, id + ' is greyed with no medical aid'));
  set(s, 'gap', 'Yes');
  assert.strictEqual(shown(s, 'gap_prov'), false, 'whatever the Gap cover answer says');
  set(s, 'ma', 'Medical aid');
  assert.ok(shown(s, 'gap') && shown(s, 'gap_prov') && shown(s, 'gap_broker'), 'a medical aid opens them');
  set(s, 'ma', 'Hospital plan'); assert.ok(shown(s, 'gap'), 'a hospital plan opens them too');
  set(s, 'gap', 'No'); assert.strictEqual(shown(s, 'gap_prov'), false, 'No gap cover still greys the provider and broker');
  assert.ok(shown(s, 'gap'), 'but the Gap cover answer stays open');
  assert.strictEqual(schema.fieldsById.n_gap.cond, undefined, 'the Gap cover notes box stays open, as the Medical aid notes box does');
});

test('the Gap cover broker default follows Medical aid: it goes with None, comes back, and a chosen broker stays', () => {
  const s = fresh();
  assert.deepStrictEqual([s.f.gap_broker.v, s.f.gap_broker.st], ['Other broker', 'preset'], 'a new form starts as before');
  set(s, 'ma', 'None'); assert.deepStrictEqual([s.f.gap_broker.v, s.f.gap_broker.st], ['', 'empty'], 'None: the untouched default goes');
  set(s, 'ma', 'Medical aid'); assert.deepStrictEqual([s.f.gap_broker.v, s.f.gap_broker.st], ['Other broker', 'preset'], 'a medical aid: the default is back');
  set(s, 'gap_broker', 'Paul K'); set(s, 'ma', 'None'); assert.strictEqual(s.f.gap_broker.v, 'Paul K', 'a broker chosen on purpose stays');
  set(s, 'ma', ''); set(s, 'gap_broker', ''); set(s, 'ma', 'None'); set(s, 'ma', ''); assert.strictEqual(s.f.gap_broker.v, 'Other broker', 'an answer taken away is not a None');
  const t = fresh(); set(t, 'gap', 'No'); set(t, 'ma', 'Medical aid'); assert.strictEqual(t.f.gap_broker.v, '', 'Gap cover No keeps it closed, whatever Medical aid says');
});

test('a file opened with no medical aid has the untouched gap broker default taken away, and keeps every answer', () => {
  const j = JSON.parse(store.toJSON(fresh()));
  j.f.ma = { v: 'None', st: 'confirmed' }; j.f.gap = { v: 'No', st: 'confirmed' };
  j.f.gap_broker = { v: 'Other broker', st: 'preset' }; j.f.ma_broker = { v: 'Other broker', st: 'preset' };
  const s = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual([s.f.ma.v, s.f.gap.v, s.f.gap_broker.v], ['None', 'No', ''], 'nothing the adviser answered is lost');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)).filter(w => w.id === 'ma'), [], 'no warning about a default');
  const k = JSON.parse(store.toJSON(fresh()));
  k.f.ma = { v: 'None', st: 'confirmed' }; k.f.gap = { v: 'Yes', st: 'confirmed' }; k.f.gap_prov = { v: 'Discovery Health', st: 'confirmed' }; k.f.gap_broker = { v: 'Other broker', st: 'confirmed' };
  const o = store.fromJSON(JSON.stringify(k));
  assert.deepStrictEqual([o.f.gap.v, o.f.gap_prov.v, o.f.gap_broker.v], ['Yes', 'Discovery Health', 'Other broker'], 'an older file that holds a gap cover under no medical aid keeps it, greyed');
});

test('the Checks flag a gap cover answer left under no medical aid, but not a plain No', () => {
  const gapWarn = s => validate.check(store.ctxFor(s)).filter(w => w.id === 'ma' && /gap cover details/.test(w.msg));
  const s = fresh(); set(s, 'ma', 'None'); assert.deepStrictEqual(gapWarn(s), [], 'a new form with no medical aid has nothing to flag');
  set(s, 'gap', 'No'); assert.deepStrictEqual(gapWarn(s), [], 'No gap cover under no medical aid is what the grey says');
  set(s, 'gap', 'Yes'); assert.strictEqual(gapWarn(s).length, 1); assert.match(gapWarn(s)[0].msg, /Medical aid is None, but the gap cover details are still filled in \(Gap cover\)/);
  set(s, 'gap_prov', 'Discovery Health'); assert.match(gapWarn(s)[0].msg, /\(Gap cover, Gap cover provider\)/);
  set(s, 'ma', 'Medical aid'); assert.deepStrictEqual(gapWarn(s), [], 'with a medical aid there is nothing to flag');
  const t = fresh(); set(t, 'ma', 'None'); set(t, 'gap', 'Not sure'); assert.strictEqual(gapWarn(t).length, 1, 'Not sure is flagged too');
});

test('the Progress numbers leave the greyed gap boxes out', () => {
  const s = fresh(); set(s, 'ma', 'Medical aid');
  const open = store.pending(s, 'empty').filter(x => GAP.includes(x.id)).map(x => x.id);
  assert.ok(open.includes('gap') && open.includes('gap_prov'), 'asked while there is a medical aid: ' + open);
  set(s, 'ma', 'None');
  assert.deepStrictEqual(store.pending(s, 'empty').filter(x => GAP.includes(x.id)), [], 'not asked, not counted, with no medical aid');
});

test('the summary and the action points do not count a gap cover under no medical aid', () => {
  const s = fresh(); set(s, 'ma', 'None'); set(s, 'gap', 'Yes'); set(s, 'gap_prov', 'Discovery Health'); set(s, 'gap_broker', 'Other broker');
  assert.deepStrictEqual(S.local(s, 'med'), ['Medical aid: none'], 'the Medical aid summary says no medical aid and nothing about a gap cover');
  set(s, 'ma', 'Medical aid'); set(s, 'ma_prov', 'Discovery Health');
  assert.ok(S.local(s, 'med').some(l => /^Gap cover: Discovery Health/.test(l)), 'with a medical aid the gap cover is in the summary: ' + S.local(s, 'med').join(' | '));
  const t = fresh(); set(t, 'fname', 'Anna'); set(t, 'ma', 'None'); set(t, 'gap', 'Yes'); set(t, 'gap_broker', 'Other broker'); set(t, 'ref_med', 'Valerie to contact for gap cover');
  assert.ok(!/another broker/.test(A.local(t).join('\n')), 'no medical aid: nothing to take over');
  set(t, 'ma', 'Medical aid');
  assert.match(A.local(t).join('\n'), /gap cover \(currently with another broker/, 'with a medical aid the take-over point is there');
});

test('voice treats the gap boxes as switched off while Medical aid is None (the same rule the screen uses)', () => {
  const s = fresh(); set(s, 'ma', 'None');
  const idx = V.buildIndex(schema);
  GAP.forEach(id => { const f = schema.fieldsById[id]; assert.ok(idx.byId[id], id + ' is a voice box'); assert.strictEqual(calc.showIf(f.cond, store.ctxFor(s)), false, id + ' is off'); });
});

test('the Gap cover rule changed no id, list or choice', () => {
  assert.deepStrictEqual(schema.fieldsById.gap.o, ['Yes', 'No', 'Not sure']);
  assert.deepStrictEqual(schema.fieldsById.ma.o, ['Medical aid', 'Hospital plan', 'None']);
  assert.deepStrictEqual(Object.keys(schema.lists).sort(), ['appts', 'bfred', 'bizpol', 'debts', 'grp', 'inv', 'invq', 'kids', 'meetings', 'raq', 'redq', 'ret_pp', 'ret_ra', 'risk', 'shares']);
});
