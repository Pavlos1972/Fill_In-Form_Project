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

test('the meetings list is on Client info under the Meeting box, with date, type and what was covered', () => {
  const info = schema.sections.find(x => x.id === 'info'), i = info.blocks.findIndex(b => b.list === 'meetings');
  assert.ok(i === 1 && info.blocks[0].title === 'Meeting', 'right under the Meeting box');
  assert.deepStrictEqual(schema.lists.meetings.cols.map(c => c.k), ['date', 'type', 'covered']);
  assert.strictEqual(schema.lists.meetings.add, 'Add another meeting'); assert.strictEqual(schema.lists.meetings.cards, 'Meeting');
  assert.deepStrictEqual(schema.lists.meetings.cols[1].o, schema.fieldsById.meet.o, 'the same choices as Type of meeting');
});
test('one meeting: the list is empty and nothing changes; a new form has no meeting rows', () => {
  const s = fresh(); assert.deepStrictEqual(s.l.meetings, []); assert.strictEqual(s.f.date.v, '12/11/2026');
  assert.strictEqual(store.blank().l.meetings.length, 0);
});
test('"Add another meeting": the meeting so far becomes meeting 1, today is meeting 2, and Date completed is today', () => {
  const s = fresh(); store.addRow(s, 'meetings');
  assert.deepStrictEqual(rows(s), [['12/11/2026', 'Teams Meeting', ''], [util.todayDMY(), 'Teams Meeting', '']]);
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
