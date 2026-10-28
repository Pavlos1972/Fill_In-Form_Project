/* Every box in the form that voice can fill is tried: asked the way an adviser would ask it, and answered the way a client would. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const idx = V.buildIndex(schema);
const st = o => Object.assign({ cur: 'info', target: null, answered: false, value: () => '', visible: () => true, rows: () => [] }, o);
const vid = f => f.vid || f.id;                                                       // a list box is the same kind of box as its namesake elsewhere
const defId = id => String(id).replace(/^(\w+):\d+:(\w+)$/, '$1.$2');                // kids:0:dob -> kids.dob
const targetOf = f => f.list ? f.list + ':0:' + f.k : f.id;
const nounOf = f => (f.list ? V.LIST_NOUNS[f.list][0] + ' ' : '');                    // "the child's date of birth"
const theOrYour = f => f.list ? 'the ' + nounOf(f) : 'your ';
const sameLabel = (a, b) => idx.byId[defId(a)] && idx.byId[defId(b)] && idx.byId[defId(a)].label === idx.byId[defId(b)].label;   // "Insurer" appears in two quotes: either is fine

const SAMPLE = f => {
  if (f.money) return 'R85 000';
  if (['dob', 'will_date', 'marr_date'].includes(vid(f))) return '14 March 1986';
  if (['cell', 'work', 'home', 'sp_tel'].includes(vid(f))) return '082 555 0148';
  if (['pemail', 'wemail'].includes(vid(f))) return 'john at gmail dot com';
  if (vid(f) === 'idno') return '8001015800087';
  if (vid(f) === 'tax') return '1234567890';
  if (vid(f) === 'years') return 'eight years';
  if (/^d_|biz_pct/.test(vid(f))) return 'forty percent';
  if (f.k === 'name') return 'Thandi Dlamini';
  if (f.t === 'area') return 'Looks after the books and the staff';
  return 'Zulu Holdings';
};
const labelOf = f => f.label.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[?:]/g, '').trim();

test('every box can be asked about the way an adviser asks', () => {
  const misses = [];
  idx.fields.filter(f => !(f.list && f.k === 'notes')).forEach(f => ['what is ' + theOrYour(f) + labelOf(f), 'and ' + (f.list ? 'the ' + nounOf(f) : 'your ') + labelOf(f) + '?'].forEach(q => {
    const a = V.plan(q, idx, st({ cur: f.sec })).actions.find(x => x.do === 'ask');
    if (!a || (defId(a.field) !== f.id && !sameLabel(a.field, f.id))) misses.push(q + ' -> ' + (a ? a.field : 'nothing') + ' [want ' + f.id + ']');
  }));
  assert.deepStrictEqual(misses, []);
});

test('every box can be answered the way a client answers', () => {
  const misses = [];
  idx.fields.forEach(f => {
    if (f.options) {                                       // each choice, said on its own while the box waits
      f.options.forEach(o => {
        const fill = V.plan(o, idx, st({ cur: f.sec, target: targetOf(f) })).actions.find(x => x.do === 'fill' || x.do === 'confirm');
        if (!fill || (fill.do === 'fill' && String(fill.res.value).toLowerCase() !== o.toLowerCase())) misses.push(f.id + ' <- "' + o + '" -> ' + (fill ? fill.res && fill.res.value : 'nothing'));
      });
      return;
    }
    const smp = SAMPLE(f);
    const waiting = V.plan(smp, idx, st({ cur: f.sec, target: targetOf(f) })).actions.find(x => x.do === 'fill');
    if (!waiting) misses.push(f.id + ' <- "' + smp + '" while waiting -> nothing');
    const said = (f.list ? 'the ' + nounOf(f) : 'my ') + labelOf(f) + ' is ' + smp, outright = V.plan(said, idx, st({ cur: f.sec })).actions.find(x => x.do === 'fill');   // stated unprompted
    if (!outright || (defId(outright.field) !== f.id && !sameLabel(outright.field, f.id))) misses.push(said + ' -> ' + (outright ? outright.field : 'nothing') + ' [want ' + f.id + ']');
  });
  assert.deepStrictEqual(misses, []);
});

test('every section with a notes box can be told to take notes, and each box is reached', () => {
  const secs = {};
  idx.notes.forEach(n => { (secs[n.sec] = secs[n.sec] || []).push(n); });
  assert.ok(idx.notes.length >= 15);
  Object.keys(secs).forEach(sec => {
    const cmd = V.parseCommand('let me take some notes', idx);
    assert.strictEqual(cmd.type, 'notes');
    secs[sec].forEach(n => {                                // "notes on the <block>" reaches that block's box where a section has several
      if (secs[sec].length > 1 && n.blkTitle) {
        const c = V.parseCommand('let me take some notes on the ' + n.blkTitle.toLowerCase(), idx);
        assert.strictEqual(c.box, n.id, n.blkTitle);
      }
    });
  });
});

test('in every free-text box, lead-in words are never typed and a sentence that stops short fills nothing', () => {
  const misses = [];
  const typed = ['dob', 'will_date', 'marr_date', 'cell', 'work', 'home', 'sp_tel', 'pemail', 'wemail', 'idno', 'tax', 'years'];
  idx.fields.filter(f => f.t === 'txt' && !f.options && !f.money && !f.date && !typed.includes(vid(f)) && !/^d_|biz_pct/.test(vid(f))).forEach(f => {
    const lab = (f.list ? nounOf(f) : '') + labelOf(f);
    // 1. stops at "is": nothing goes into the box (while it waits, or with nothing waiting)
    ['my ' + lab + ' is', 'my ' + lab + ' my ' + lab + ' is'].forEach(t => [targetOf(f), null].forEach(target => {
      const fills = V.plan(t, idx, st({ cur: f.sec, target: target, answered: false })).actions.filter(x => x.do === 'fill');
      if (fills.length) misses.push('"' + t + '" (' + (target ? 'waiting' : 'not waiting') + ') filled ' + fills.map(x => x.field + '=' + x.res.value).join(', '));
    }));
    // 2. the lead-in repeated: only the answer is kept
    const t2 = 'my ' + lab + ' my ' + lab + ' is Zulu Holdings';
    const fill = V.plan(t2, idx, st({ cur: f.sec, target: targetOf(f), answered: false })).actions.find(x => x.do === 'fill');
    if (!fill || String(fill.res.value).toLowerCase() !== 'zulu holdings') misses.push('"' + t2 + '" -> ' + (fill ? '"' + fill.res.value + '"' : 'nothing'));
  });
  assert.deepStrictEqual(misses, []);
});
