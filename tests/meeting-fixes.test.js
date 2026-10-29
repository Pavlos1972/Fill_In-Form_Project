/* Fixes from the 29 October test meeting with Sitamah Nathoo. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

const idx = V.buildIndex(schema);
const fresh = () => store.blank();
const shown = (s, id) => { const f = schema.fieldsById[id]; return calc.showIf(f.cond, store.ctxFor(s)); };

test('"Since February 2022" is 4.7 years, not the number 2022', () => {
  const now = new Date(2026, 9, 29);
  assert.strictEqual(V.yearsValue('Since February 2022', now), '4.7');
  assert.strictEqual(V.yearsValue('since 2019', now), '7');
  assert.strictEqual(V.yearsValue('about four years', now), '4');
  assert.strictEqual(V.yearsValue('18 months', now), '1.5');
  assert.strictEqual(V.yearsValue('four and a half years', now), '4.5');
  assert.strictEqual(V.yearsValue('12', now), '12');
  assert.strictEqual(V.yearsValue('a long time', now), 'a long time');
  const r = V.interpret(idx.byId.years, 'Since February 2022');
  assert.ok(/^\d+\.\d$/.test(r.value) && +r.value > 4 && +r.value < 20, r.value);
  const said = AI.normalize({ actions: [{ do: 'fill', field: 'years', value: 'Since February 2022' }] }, idx, 'auto', {});
  assert.ok(/^\d+\.\d$/.test(said.actions[0].value), JSON.stringify(said));
});

test('the adviser\'s name only counts as noise when the whole name is the whole line', () => {
  assert.strictEqual(schema.advisor, 'Paul Kafentzis');
});

test('Gap cover can be "Not sure", and a client\'s "I\'m not sure" picks it', () => {
  assert.deepStrictEqual(schema.fieldsById.gap.o, ['Yes', 'No', 'Not sure']);
  const r = V.interpret(idx.byId.gap, "I'm not entirely sure, to be honest");
  assert.strictEqual(r && r.value, 'Not sure');
});

test('a quote that is not required loses its type and insurer: the boxes go and what was there is cleared', () => {
  const s = fresh();
  ['fna', 'sf'].forEach(p => {
    store.setField(s, p + '_type', 'New Business'); store.setField(s, p + '_ins', 'BrightRock');
    assert.ok(shown(s, p + '_type') && shown(s, p + '_ins'));
    store.setField(s, p + '_req', 'Request a quote'); assert.ok(shown(s, p + '_type'));
    store.setField(s, p + '_req', 'Not required');
    assert.ok(!shown(s, p + '_type') && !shown(s, p + '_ins'), p);
    assert.strictEqual(s.f[p + '_type'].v, ''); assert.strictEqual(s.f[p + '_ins'].v, '');
  });
  store.setField(s, 'fna_type', 'Servicing'); store.setField(s, 'fna_req', 'No FNA done'); assert.strictEqual(s.f.fna_type.v, '');
  store.addRow(s, 'redq', { req: 'Request a quote', type: 'New Business', ins: 'Liberty', amt: 'R 1 000.00' });
  store.setCell(s, 'redq', 0, 'req', 'Not required');
  assert.deepStrictEqual(s.l.redq[0].d, { req: 'Not required', type: '', ins: '', amt: '' });
  // the voice does not ask about boxes that are gone
  assert.ok(idx.byId.sf_type.cond && idx.byId.fna_ins.cond);
});

test('"Preferred monthly spend" can be asked about and answered by voice', () => {
  assert.ok(idx.byId.pref_spend && idx.byId.pref_spend.money);
  const m = V.matchQuestion('What are you comfortable spending on a life policy?', idx, { cur: 'prio' });
  assert.strictEqual(m && m.id, 'pref_spend');
  assert.strictEqual(V.interpret(idx.byId.pref_spend, 'we can do a thousand').value, 'R 1 000.00');
});

test('Claude is told which boxes are free text, which are switched off, and the new rules', () => {
  const ctx = { sectionId: 'prio', recent: [], hidden: { fna_req: 1, 'list:raq': 1 } };
  const req = AI.buildRequest(idx, ctx, 'client', 'We can do a thousand?', 'm');
  const body = JSON.parse(req.messages[0].content);
  assert.deepStrictEqual(body.off, ['fna_req', 'list:raq']);
  assert.ok(body.fields.some(f => f.id === 'ma_prov' && f.free) && !body.fields.some(f => 'off' in f));       // "fields" never changes, so it stays cached
  assert.ok(body.lists.find(l => l.id === 'inv').columns.find(c => c.id === 'prov').free);
  const sys = req.system;
  assert.match(sys, /"free": true takes any value as said/);
  assert.match(sys, /Never use "Other" to hide a name that was said/);
  assert.match(sys, /spelled exactly as it is in the CLIENT's own line/);
  assert.match(sys, /A range is not a value/);
  assert.match(sys, /do not pick one: give \{"do":"ask"/);
  assert.match(sys, /"off" \(when present\)/);
  assert.ok(schema.fieldsById.inv_prov_placeholder === undefined);
  const prov = schema.lists.inv.cols.find(c => c.k === 'prov');
  ['FNB', 'Nedbank', 'Standard Bank', 'Capitec'].forEach(b => assert.ok(prov.o.includes(b), b));
});

test('the catch-up check sees only the boxes and lists that are showing, and its prompt keeps offers and fragments out', () => {
  const full = JSON.parse(AI.sweepRequest({ idx, model: 'm', transcript: [], filled: {}, listRows: () => [] }).messages[0].content);
  const some = JSON.parse(AI.sweepRequest({ idx, model: 'm', transcript: [], filled: {}, listRows: () => [], hidden: { fna_req: 1, 'list:raq': 1 } }).messages[0].content);
  assert.ok(full.fields.some(f => f.id === 'fna_req') && full.lists.some(l => l.id === 'raq'));
  assert.ok(!some.fields.some(f => f.id === 'fna_req') && !some.lists.some(l => l.id === 'raq'));
  assert.match(AI.SWEEP_SYSTEM, /An offer or suggestion the client did not take up is not a fact/);
  assert.match(AI.SWEEP_SYSTEM, /never a fragment/);
  assert.match(AI.SWEEP_SYSTEM, /when no name was said, leave the box empty/);
});

test('a Next appointment date sits on the Client priorities page and can be said', () => {
  const blocks = schema.sections.find(x => x.id === 'prio').blocks, i = blocks.findIndex(b => b.title === 'Next appointment');
  assert.ok(i > 0 && blocks[i + 1].fields[0].id === 'n_prio');
  const f = schema.fieldsById.next_appt;
  assert.ok(f.date && f.cal && idx.byId.next_appt);
  const r = V.interpret(idx.byId.next_appt, 'the fifth of November 2026');
  assert.strictEqual(r.value, '05/11/2026');
  const m = V.matchQuestion('When can we meet again for the next appointment?', idx, { cur: 'prio' });
  assert.strictEqual(m && m.id, 'next_appt');
});

/* ---------- sections that are finished, and the notes that end ---------- */
const sch = require('../app/js/schema.js'), Vv = require('../app/js/voice.js'), AIv = require('../app/js/voice-ai.js');
const widx = Vv.buildIndex(sch);
const wrap = (t, prev, cur) => Vv.wrapUp(t, widx, { cur: cur || 'debts', prev });

test('the adviser says a section is finished: that is not small talk', () => {
  ['Okay, that concludes the debt section.', 'That is the debts done', 'We are done with the debts', 'The debts section is complete', 'Right, that is all for the debts', "Let's wrap up the debts"]
    .forEach(t => assert.deepStrictEqual(wrap(t), { sec: 'debts', list: null, via: 'said' }, t));
  assert.deepStrictEqual(wrap('That covers income.'), { sec: 'income', list: null, via: 'said' });
  assert.deepStrictEqual(wrap('I think that is everything for your children'), { sec: 'kids', list: null, via: 'said' });
  assert.deepStrictEqual(wrap('That is all for this section', null, 'kids'), { sec: 'kids', list: null, via: 'said' });                  // this section: the one that is open
  assert.deepStrictEqual(wrap('Okay, we are done here', null, 'health'), { sec: 'health', list: null, via: 'said' });
});

test('things that sound like it but are not: the client\'s own debts, a question, the notes, a box, one item', () => {
  ['My debts are all done', 'The car loan is finished', 'That concludes the notes', 'Is that the debts done?', 'That is all for this one', 'We are done with this', 'He has completed the form'].forEach(t => assert.strictEqual(wrap(t), null, t));
});

test('a part of a page that holds several topics does not finish the page', () => {
  assert.deepStrictEqual(wrap('OK that is it for the will', null, 'other'), { sec: null, list: null, part: 'other', via: 'said' });
  assert.deepStrictEqual(wrap('That is the group risk done', null, 'cover'), { sec: null, list: null, part: 'cover', via: 'said' });
  assert.deepStrictEqual(wrap('That concludes medical will and short term', null, 'other'), { sec: 'other', list: null, via: 'said' });     // the page itself, by its name
});

test('"no" to "any more ...?" is the end of the list: the section when the list is all of it, only the list when the section has several', () => {
  assert.deepStrictEqual(wrap('No.', 'Mr client, do you have any more debts?'), { sec: 'debts', list: 'debts', via: 'declined' });
  assert.deepStrictEqual(wrap('No, that is all', 'Do you have any other children?', 'kids'), { sec: 'kids', list: 'kids', via: 'declined' });
  assert.deepStrictEqual(wrap('Nothing else', 'Anything else on the investments?', 'inv'), { sec: 'inv', list: 'inv', via: 'declined' });
  assert.deepStrictEqual(wrap('Nope, that is all', 'Do you have any more policies?', 'cover'), { sec: null, list: 'risk', via: 'declined' });          // personal and group policies share a page
  assert.deepStrictEqual(wrap('That is everything', 'Is that everything?', 'income'), { sec: 'income', list: null, via: 'declined' });
  // not an end: a different answer, a box that exists, no question before it
  assert.strictEqual(wrap('No, I also have a car loan', 'any more debts?'), null);
  assert.strictEqual(wrap('No', 'Do you have any other health issues?', 'health'), null);          // the box "Other health issues": its answer is the box's
  assert.strictEqual(wrap('No', 'what is your cell number'), null);
  assert.strictEqual(wrap('No'), null);
  assert.deepStrictEqual(wrap('No', 'Is there anything else you want to tell me about your health?', 'health'), { sec: 'health', list: null, via: 'declined' });
});

test('the page\'s own reading follows it: the question is about the list, the "no" finishes it, a line says what to do', () => {
  const st = { cur: 'debts', rows: () => [{ type: 'Home loan' }], visible: () => true };
  const q = Vv.plan('Do you have any more debts?', widx, st).actions;
  assert.deepStrictEqual(q.map(a => a.do + ':' + a.field), ['ask:count:debts']);                  // not the box "Other" of the client's details
  const no = Vv.plan('No.', widx, Object.assign({ prev: 'Do you have any more debts?' }, st)).actions;
  assert.deepStrictEqual(no.map(a => [a.do, a.section, a.via]), [['done', 'debts', 'declined']]);
  const said = Vv.plan('Okay that concludes the debt section. Let\'s talk about the children.', widx, st).actions;
  assert.deepStrictEqual(said.map(a => a.do + ':' + (a.section || (a.cmd && a.cmd.sec) || '')), ['done:debts', 'cmd:kids']);
});

test('Claude can say a section is finished, and is told which ones are', () => {
  const r = AIv.normalize({ actions: [{ do: 'done', section: 'debts' }, { do: 'done', list: 'risk' }, { do: 'done' }, { do: 'done', section: 'nope' }] }, widx, 'auto', {});
  assert.deepStrictEqual(r.actions.map(a => [a.section, a.list]), [['debts', null], [null, 'risk'], [null, null]]);
  const body = JSON.parse(AIv.buildRequest(widx, { sectionId: 'debts', recent: [], concluded: ['income', 'debts'] }, 'auto', 'one more debt, a car loan', 'm').messages[0].content);
  assert.deepStrictEqual(body.position.concluded, ['income', 'debts']);
  assert.ok(!('concluded' in JSON.parse(AIv.buildRequest(widx, { sectionId: 'debts', recent: [] }, 'auto', 'x', 'm').messages[0].content).position));
  assert.match(AIv.SYSTEM, /Sections that are finished/); assert.match(AIv.SYSTEM, /any more debts/); assert.match(AIv.SYSTEM, /reopens it/);
  assert.match(AIv.SYSTEM, /I\\?'ve noted that, I\\?'ve completed those notes/);
});

test('the notes end in many ways, and the words that end them are never noted', () => {
  const ends = t => Vv.endsNotes(Vv.norm(t));
  ["I've noted that, I've completed those notes", "I've noted that", "That's noted", 'I have noted it down', 'Nothing more to note', "Okay, that's all I wanted to note", "That's the end of noting that", 'Notes are done', "I'm done with the notes", 'back to the form']
    .forEach(t => assert.ok(ends(t), t));
  ['noted', 'he noted that the client smokes', 'let me make a note of that', "I've noted that the client is a smoker", 'make a note of this', 'note that down'].forEach(t => assert.ok(!ends(t), t));
  assert.deepStrictEqual(Vv.splitNotesEnd("He wants it for school fees. I've noted that, I've completed those notes. Let's talk about the children."), { before: ['He wants it for school fees.'], rest: ["Let's talk about the children."] });
  assert.strictEqual(Vv.splitNotesEnd('He wants it for school fees.'), null);
  assert.strictEqual(Vv.parseCommand('Let me make a note of this', widx).type, 'notes');
  assert.strictEqual(Vv.parseCommand("I've noted that, I've completed those notes", widx).type, 'notesOff');
  assert.ok(Vv.mentionsNotes('and that is the notes done for now') && !Vv.mentionsNotes('he has two children') && Vv.mayEndNotes("That's everything for this one") && !Vv.mayEndNotes('He lost all his savings in 2019'));
  const noting = Vv.plan("Wants a shorter term. I've noted that", widx, { cur: 'debts', noting: true, visible: () => true }).actions;
  assert.deepStrictEqual(noting.map(a => a.do), ['note', 'cmd']); assert.ok(!/noted/.test(noting[0].text)); assert.strictEqual(noting[1].cmd.type, 'notesOff');       // the last note, then the notes end
});
