/* Release 4.8: the headings of the "Priorities to be Focused on" box ("1. Personal Risk Covers") and of the Action Points box ("Sitamah, please action these for the client ...:") are larger and bold, with room under them,
   on the screen (a read view, as the Current Client notes have) and in the PDF. The text in the saved file stays plain; no id, list, box or choice changes. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');

/* the PDF is drawn here with a recorder instead of jsPDF: it keeps every table cell with its styles */
let cells = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage', 'text'].forEach(n => { doc[n] = () => doc; });
  doc.getTextWidth = s => String(s).length * 1.8;
  doc.splitTextToSize = s => [String(s)];
  doc.addPage = () => { doc.pages++; return doc; };
  doc.getNumberOfPages = () => doc.pages;
  doc.autoTable = o => {
    [].concat(o.head || [], o.body || []).forEach(r => r.forEach(c => cells.push(c && typeof c === 'object' ? c : { content: String(c), styles: {} })));
    doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 10 };
    return doc;
  };
  return doc;
}
global.window = { FF: { util, schema, calc, store, summary, actions, logo: { data: '', w: 1, h: 1 } }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/pdf.js');

const A = actions;
const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cell = text => cells.find(c => String(c.content).trim() === text);
const build = s => { cells = []; global.window.FF.pdf.build(s); };
const GO = schema.PRIORITY;

/* a form with three green priorities, and the text the form itself writes for both boxes */
function sample() {
  const s = fresh(); set(s, 'fname', 'Edwin'); set(s, 'sname', 'Joubert'); set(s, 'has_risk', 'Yes');
  set(s, 'pr_life', GO); set(s, 'pr_rgar', GO); set(s, 'pr_st', GO);
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'New Business'); set(s, 'ref_sti', 'Cameron to contact client');
  store.setField(s, 'focus', A.focusLocal(s));
  store.setField(s, 'pa_actions', A.text(A.local(s), s));
  return s;
}

test('the version is 4.8 or later, and every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 4.8);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('which lines are headings: the numbered areas of the Priorities box, the opening line of the Action Points, the capitals of the Current Client notes', () => {
  const F = l => util.headingKind('focus', l), P = l => util.headingKind('pa', l), C = l => util.headingKind(1, l);
  ['1. Personal Risk Covers', '2. Retirement Planning', '3. RGAR', '4. Investment Planning', '5. EGAR', '6. Medical Aid', '7. Will', '8. Short Term', '  3. RGAR  '].forEach(l => assert.ok(F(l), l));
  ['Recommend: Request a BrightRock Fractured FNA quote', 'Client: The client Edwin wants to retire at 60', 'Come back with:', '- Bring the FNA quote and the reduced quote for R 2 500 p.m.', '', '1. Request the quote: now',
    '1. ' + 'A long sentence typed in the box that is plainly not an area title at all.', 'Personal Risk Covers', '1.Personal'].forEach(l => assert.ok(!F(l), 'not a heading: ' + l));
  assert.ok(P('Sitamah, please action these for the client Edwin Joubert:'));
  assert.ok(P('Sitamah, please action these for the client:'));
  ['- Send the client Edwin the LOA to sign, so the policy schedules can be drawn from Astute.', 'Please action these', 'Sitamah, please action these for the client Edwin Joubert', ''].forEach(l => assert.ok(!P(l), 'not a heading: ' + l));
  assert.ok(C('STILL OPEN') && C('2026 (REVIEW DONE: MAR 2026)') && !C('- Oct 2026 - COL: Discovery, +50% loading') && !C('Recommend: x'), 'the Current Client rule is as it was (3.3)');
  assert.ok(util.headingBig('focus') && util.headingBig('pa') && !util.headingBig(1), 'the two new kinds are larger as well as bold; the Current Client notes stay at the size of the text');
});

test('the two boxes ask for headings; the Current Client notes keep theirs; no id, list or choice changed', () => {
  assert.strictEqual(schema.fieldsById.focus.heads, 'focus');
  assert.strictEqual(schema.fieldsById.pa_actions.heads, 'pa');
  assert.strictEqual(schema.fieldsById.cc_notes.heads, 1);
  ['focus', 'pa_actions'].forEach(id => { const f = schema.fieldsById[id]; assert.ok(f.t === 'area' && f.opt && f.nonotes && f.wide, id + ' is the same kind of box as before'); });
  assert.deepStrictEqual(Object.keys(schema.lists).sort(), ['appts', 'bfred', 'bizpol', 'debts', 'grp', 'inv', 'invq', 'kids', 'meetings', 'raq', 'redq', 'ret_pp', 'ret_ra', 'risk', 'shares']);
});

test('in the text the form writes, the heading lines are exactly the area titles and the opening line, and nothing else', () => {
  const s = sample();
  const focus = s.f.focus.v.split(/\r?\n/), heads = focus.filter(l => util.headingKind('focus', l));
  assert.deepStrictEqual(heads, ['1. Personal Risk Covers', '3. RGAR', '8. Short Term'], 'the three green areas, and no point or label taken for a heading');
  assert.ok(focus.some(l => /^Recommend: /.test(l)) && focus.some(l => /^Come back with:$/.test(l)) && focus.some(l => /^- /.test(l)), 'the points are there, and are not headings');
  const pa = s.f.pa_actions.v.split(/\r?\n/);
  assert.strictEqual(pa[0], 'Sitamah, please action these for the client Edwin Joubert:');
  assert.deepStrictEqual(pa.filter(l => util.headingKind('pa', l)), [pa[0]], 'only the opening line is a heading');
  assert.ok(pa.length > 2 && pa.slice(1).every(l => /^- /.test(l)), 'every other line is a point: ' + pa.slice(1, 3).join(' | '));
});

test('the saved file keeps both boxes as plain text, exactly as written (nothing about bold or size)', () => {
  const s = sample(), j = JSON.parse(store.toJSON(s));
  assert.strictEqual(j.f.focus.v, s.f.focus.v); assert.strictEqual(j.f.pa_actions.v, s.f.pa_actions.v);
  assert.ok(!/<|\*\*|\bbold\b/.test(j.f.focus.v + j.f.pa_actions.v), 'no markup in the file');
  const back = store.fromJSON(JSON.stringify(j));
  assert.strictEqual(back.f.focus.v, s.f.focus.v); assert.strictEqual(back.f.pa_actions.v, s.f.pa_actions.v);
});

test('the PDF prints the headings of both boxes larger and bold, with room under them, and the points in the plain style', () => {
  const s = sample(); build(s);
  const base = 8.5;
  [['1. Personal Risk Covers'], ['3. RGAR'], ['8. Short Term'], ['Sitamah, please action these for the client Edwin Joubert:']].forEach(([h]) => {
    const c = cell(h);
    assert.ok(c, 'the PDF has the heading: ' + h);
    assert.strictEqual(c.styles.fontStyle, 'bold', h + ' is bold');
    assert.ok(c.styles.fontSize > base, h + ' is larger than the text (' + c.styles.fontSize + ')');
  });
  const point = s.f.focus.v.split('\n').find(l => /^Recommend: /.test(l));
  const p = cell(point); assert.ok(p, 'the Recommend line is in the PDF'); assert.strictEqual(p.styles.fontStyle, 'normal'); assert.strictEqual(p.styles.fontSize, undefined, 'a point has no size of its own');
  const second = cell('3. RGAR'), first = cell('1. Personal Risk Covers');
  assert.ok(second.styles.cellPadding.top > first.styles.cellPadding.top, 'more room above a heading that follows another area than above the first');
  assert.ok(first.styles.cellPadding.bottom >= 1.6, 'and room under it');
  assert.ok(cells.some(c => /Priorities to be Focused|What is needed for each green priority/.test(c.content)), 'the label of the box is still there');
});

test('the PDF of the Current Client notes is as it was in 3.3 (bold headings at the size of the text)', () => {
  const s = fresh(); set(s, 'ref', 'Current client'); set(s, 'cc_notes', 'STILL OPEN\n- Oct 2026 - COL: Discovery, +50% loading');
  build(s);
  const h = cell('STILL OPEN'), pt = cell('- Oct 2026 - COL: Discovery, +50% loading');
  assert.ok(h && h.styles.fontStyle === 'bold' && h.styles.fontSize === undefined, 'a capitals heading is bold, not larger');
  assert.ok(pt && pt.styles.fontStyle === 'normal');
});
