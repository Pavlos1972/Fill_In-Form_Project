/* Release 4.0: a Fact Find done over two or three meetings. Empty while there has been one meeting; "Add another meeting" makes the meeting so far meeting 1 and adds today; Date completed and Type of meeting are
   always those of the last meeting. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const util = require('../app/js/util.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');

const fresh = () => { const s = store.blank(); store.setField(s, 'date', '12/11/2026'); store.setField(s, 'meet', 'Teams Meeting'); return s; };
const rows = s => s.l.meetings.map(r => [r.d.date, r.d.type, r.d.covered]);
const set = (s, id, v, st) => store.setField(s, id, v, st);

test('the meetings list is on Client info under the Meeting box, with date, type, who was on the call and what was covered', () => {
  const info = schema.sections.find(x => x.id === 'info'), i = info.blocks.findIndex(b => b.list === 'meetings');
  assert.ok(i === 1 && info.blocks[0].title === 'Meeting', 'right under the Meeting box');
  assert.deepStrictEqual(schema.lists.meetings.cols.map(c => c.k), ['date', 'day', 'type', 'who', 'covered']);
  assert.strictEqual(schema.lists.meetings.add, 'Add another meeting'); assert.strictEqual(schema.lists.meetings.cards, 'Meeting');
  assert.deepStrictEqual(schema.lists.meetings.cols[2].o, schema.fieldsById.meet.o, 'the same choices as Type of meeting');
});
test('one meeting: the list is empty and nothing changes; a new form has no meeting rows', () => {
  const s = fresh(); assert.deepStrictEqual(s.l.meetings, []); assert.strictEqual(s.f.date.v, '12/11/2026');
  assert.strictEqual(store.blank().l.meetings.length, 0);
});
test('"Add another meeting": the meeting so far becomes meeting 1, today is meeting 2, and Date completed is today', () => {
  const s = fresh(); store.addRow(s, 'meetings');
  assert.deepStrictEqual(rows(s).map(r => r.slice(0, 2)), [['12/11/2026', 'Teams Meeting'], [util.todayDMY(), 'Teams Meeting']]);
  assert.strictEqual(s.f.date.v, util.todayDMY());
  store.addRow(s, 'meetings', { date: '26/11/2026', type: 'Telephonic Meeting', covered: 'Will and priorities' });
  assert.strictEqual(s.l.meetings.length, 3, 'a third meeting is just one more row');
  assert.deepStrictEqual([s.f.date.v, s.f.meet.v], ['26/11/2026', 'Telephonic Meeting'], 'Date completed and the type are the last meeting\'s');
});
test('changing the last meeting\'s date or type changes Date completed and Type of meeting, and the other way round; an earlier meeting changes nothing else', () => {
  const s = fresh(); store.addRow(s, 'meetings', { date: '19/11/2026' });
  store.setCell(s, 'meetings', 1, 'date', '20/11/2026'); assert.strictEqual(s.f.date.v, '20/11/2026');
  store.setCell(s, 'meetings', 1, 'type', 'Physical Meeting'); assert.strictEqual(s.f.meet.v, 'Physical Meeting');
  store.setCell(s, 'meetings', 0, 'date', '11/11/2026'); assert.strictEqual(s.f.date.v, '20/11/2026', 'an earlier meeting is not Date completed');
  store.setField(s, 'date', '21/11/2026'); assert.strictEqual(s.l.meetings[1].d.date, '21/11/2026'); assert.strictEqual(s.l.meetings[0].d.date, '11/11/2026');
  store.setField(s, 'meet', 'Teams Meeting'); assert.strictEqual(s.l.meetings[1].d.type, 'Teams Meeting');
  store.setCell(s, 'meetings', 1, 'covered', 'Cover and retirement'); assert.strictEqual(s.f.date.v, '21/11/2026');
});
test('removing the last meeting makes the one before it the last', () => {
  const s = fresh(); store.addRow(s, 'meetings', { date: '19/11/2026', type: 'Telephonic Meeting' });
  store.delRow(s, 'meetings', 1); assert.deepStrictEqual([s.f.date.v, s.f.meet.v], ['12/11/2026', 'Teams Meeting']);
});
test('the ages and the tax year go by the last meeting (Date completed)', () => {
  const s = fresh(); store.setField(s, 'dob', '10/09/1988'); const age1 = require('../app/js/calc.js').clientAge(store.ctxFor(s));
  store.addRow(s, 'meetings', { date: '01/10/2027' }); assert.strictEqual(require('../app/js/calc.js').clientAge(store.ctxFor(s)), age1 + 1, 'a meeting after the birthday: a year older');
});
test('the meetings are saved with the file and come back; an older file without them opens with none', () => {
  const s = fresh(); store.addRow(s, 'meetings', { date: '19/11/2026', covered: 'Cover' });
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(rows(back), rows(s)); assert.strictEqual(back.f.date.v, '19/11/2026');
  const old = JSON.parse(store.toJSON(fresh())); delete old.l.meetings; assert.deepStrictEqual(store.fromJSON(JSON.stringify(old)).l.meetings, []);
});
test('the meetings are not read by voice and are not notes for the action points', () => {
  const V = require('../app/js/voice.js'), idx = V.buildIndex(schema);
  assert.ok(!idx.lists.meetings && !Object.keys(idx.byId).some(k => /^meetings\./.test(k)), 'not in the voice index');
  const s = fresh(); store.addRow(s, 'meetings', { date: '19/11/2026', covered: 'Please send the LOA' });
  assert.ok(!JSON.stringify(A.facts(s)).includes('Please send the LOA'), '"what was covered" is a record, not an instruction to the assistant');
});

/* ---------- who was on the call ---------- */
test('each meeting has who was on the call; Others on the call is the last meeting\'s', () => {
  const s = fresh(); set(s, 'on_call', 'Mariette (the client\'s spouse)');
  store.addRow(s, 'meetings');
  assert.deepStrictEqual(s.l.meetings.map(r => r.d.who), ['Mariette (the client\'s spouse)', ''], 'meeting 1 keeps who was on the call; the new meeting starts with nobody noted');
  assert.strictEqual(s.f.on_call.v, '', 'Others on the call is now meeting 2\'s');
  set(s, 'on_call', 'Her husband'); assert.strictEqual(s.l.meetings[1].d.who, 'Her husband'); assert.strictEqual(s.l.meetings[0].d.who, 'Mariette (the client\'s spouse)');
  store.setCell(s, 'meetings', 1, 'who', 'Nobody else'); assert.strictEqual(s.f.on_call.v, 'Nobody else');
  store.delRow(s, 'meetings', 1); assert.strictEqual(s.f.on_call.v, 'Mariette (the client\'s spouse)');
});

/* ---------- what was covered: written by the form, in brief ---------- */
const coveredOf = (s, i) => s.l.meetings[i].d.covered;
test('the form notes the pages on which an answer was typed or said, and writes them in brief when the next meeting starts', () => {
  const s = fresh(); set(s, 'fname', 'Sam'); set(s, 'gross', 'R 50 000.00'); set(s, 'has_debts', 'Yes'); store.addRow(s, 'debts', { type: 'Home loan', prov: 'ABSA' });
  assert.deepStrictEqual(Object.keys(s.covered).sort(), ['debts', 'income', 'info']);
  store.addRow(s, 'meetings');
  assert.strictEqual(coveredOf(s, 0), 'Client info, Income & household, Debts', 'meeting 1: the page names, in the order of the pages');
  assert.deepStrictEqual(s.covered, {}, 'the new meeting starts with nothing covered');
  assert.strictEqual(coveredOf(s, 1), '');
});
test('the meeting in progress is written live; a second meeting records only what it covered', () => {
  const s = fresh(); set(s, 'fname', 'Sam'); store.addRow(s, 'meetings');
  set(s, 'ps_risk', 'Policy Schedules saved in Client File'); assert.strictEqual(coveredOf(s, 1), 'Personal & group risk cover');
  store.addRow(s, 'kids', { name: 'Anna' }); assert.strictEqual(coveredOf(s, 1), 'Children, Personal & group risk cover', 'in the order of the pages');
  assert.ok(!/Client info/.test(coveredOf(s, 1)), 'the first meeting\'s pages are not in the second');
  store.addRow(s, 'meetings'); assert.ok(/Children/.test(coveredOf(s, 1)) && coveredOf(s, 2) === '');
});
test('what the form fills itself is not an answer: the dates, the action points, the Priorities box, defaults and calculated boxes', () => {
  const s = fresh(); store.addRow(s, 'meetings');
  set(s, 'date', '20/11/2026'); set(s, 'pa_actions', '- Send the LOA'); set(s, 'focus', '1. Personal Risk Covers'); set(s, 'ip_age', '65', 'preset'); set(s, 'lc_hh', 'R 1.00');
  assert.strictEqual(coveredOf(s, 1), '', 'nothing typed or said on any page');
  set(s, 'loa', 'Yes'); assert.strictEqual(coveredOf(s, 1), 'Admin');
});
test('a file opened does not count as covered; an older file\'s first meeting is taken from the pages with answers', () => {
  const s = fresh(); set(s, 'fname', 'Sam'); set(s, 'gross', 'R 50 000.00');
  const old = JSON.parse(store.toJSON(s)); delete old.covered;
  const back = store.fromJSON(JSON.stringify(old)); assert.deepStrictEqual(back.covered, {}, 'opening notes nothing');
  store.addRow(back, 'meetings'); assert.strictEqual(coveredOf(back, 0), 'Client info, Income & household', 'the pages that hold answers');
  const again = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(Object.keys(again.covered).sort(), ['income', 'info'], 'the notes are saved with the file');
});
test('a "What was covered" typed by the adviser is left as typed; clearing it hands it back to the form', () => {
  const s = fresh(); store.addRow(s, 'meetings'); set(s, 'fname', 'Sam');
  store.setCell(s, 'meetings', 1, 'covered', 'Only the basics'); set(s, 'gross', 'R 1.00'); assert.strictEqual(coveredOf(s, 1), 'Only the basics');
  store.setCell(s, 'meetings', 1, 'covered', ''); assert.strictEqual(coveredOf(s, 1), 'Client info, Income & household');
  const back = store.fromJSON(store.toJSON((() => { const t = fresh(); store.addRow(t, 'meetings'); store.setCell(t, 'meetings', 1, 'covered', 'Mine'); return t; })()));
  set(back, 'fname', 'Z'); assert.strictEqual(coveredOf(back, 1), 'Mine', 'still the adviser\'s after a save and reopen');
});
