/* Release 3.7: the page-side reader of spoken lines (app/js/voice.js), hardened against the faults of the audit (A4 to A15).
   Each test pins the line that went wrong, and a line that must still work. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const idx = V.buildIndex(schema);
const f = id => idx.byId[id];

const plan = (text, o) => {
  o = o || {}; const vals = o.vals || {}, rows = o.rows || {};
  return V.plan(text, idx, { cur: o.cur || 'info', target: o.target, answered: !!o.answered, prev: o.prev, who: o.who || 'client',
    value: id => vals[id] || '', visible: () => true, rows: k => rows[k] || [], curRow: o.curRow || {} });
};
const brief = p => p.actions.map(a => a.do + (a.list ? '(' + a.list + ')' : '') + (a.field ? ':' + a.field : '') + (a.res && a.res.value ? '=' + a.res.value : '') + (a.section ? '@' + a.section : '') + (a.via ? '/' + a.via : '')).join(' ');
const oneCar = { debts: [{ type: 'Vehicle finance' }] }, carRow = { rows: oneCar, curRow: { debts: 0 }, cur: 'debts' };

/* ---- A4, A5: "no, still the same" and "yes it has changed" ---- */
test('A4: "no, still the same" keeps what is in the box, it is not a new value', () => {
  ['no, still the same', 'no, unchanged', 'no same as before', 'nope, still the same'].forEach(t => {
    assert.deepStrictEqual(V.answerFor(f('employer'), t, 'Discovery'), { kind: 'confirm' }, t);
    assert.strictEqual(brief(plan(t, { cur: 'occ', target: 'employer', vals: { employer: 'Discovery' } })), 'confirm:employer', t);
  });
  assert.strictEqual(V.answerFor(f('employer'), 'no, Absa', 'Discovery').value, 'Absa', 'a real correction still fills');
});
test('A5: "yes it has changed" is not a confirmation: the new value is awaited', () => {
  assert.strictEqual(V.isConfirm('yes it has changed', true), false);
  assert.strictEqual(V.isConfirm('it has changed', true), false);
  assert.deepStrictEqual(V.answerFor(f('employer'), 'yes it has changed', 'Discovery'), { kind: 'wait' });
  ['nothing has changed', 'no change', 'it has not changed', 'yes still the same'].forEach(t => assert.strictEqual(V.isConfirm(t, true), true, t));
});

/* ---- A6, A7, A8: facts that the words only seem to hold ---- */
test('A6: "I never finished school" is not Matric', () => {
  ['I never finished school', 'I dropped out of school', 'I did not finish matric'].forEach(t => assert.ok(V.interpret(f('edu'), t).error, t));
  assert.strictEqual(brief(plan('I never finished school', { target: 'edu' })), '');
  assert.strictEqual(V.interpret(f('edu'), 'I finished matric').value, 'Matric');
  assert.strictEqual(V.interpret(f('edu'), 'I went to school and did matric').value, 'Matric');
  assert.strictEqual(V.interpret(f('edu'), 'I did a degree').value, '3-year degree');
});
test('A7: an ex-smoker, or someone else who smokes, does not make the client a Smoker', () => {
  ['I used to smoke but I quit five years ago', 'I stopped smoking', 'I am a former smoker'].forEach(t => {
    assert.ok(V.interpret(f('smoker'), t).error, t);
    assert.strictEqual(brief(plan(t, { target: 'smoker' })), '', t);
  });
  ['my wife smokes', 'she smokes'].forEach(t => assert.notStrictEqual((V.interpret(f('smoker'), t) || {}).value, 'Smoker', t));
  assert.strictEqual(V.interpret(f('smoker'), "my husband smokes but I don't").value, 'Non-smoker');
  assert.strictEqual(V.interpret(f('smoker'), 'I smoke').value, 'Smoker');
  assert.strictEqual(V.interpret(f('smoker'), 'I smoke but I want to quit').value, 'Smoker');
  assert.strictEqual(V.interpret(f('smoker'), 'no').value, 'Non-smoker');
});
test('A8: a cancelled, lapsed or unaffordable medical aid is None, not Medical aid', () => {
  ['I used to have medical aid but I cancelled it', "I can't afford medical aid at the moment", 'my medical aid lapsed'].forEach(t => {
    assert.strictEqual(V.interpret(f('ma'), t).value, 'None', t);
    assert.strictEqual(brief(plan(t, { cur: 'other', target: 'ma' })), 'fill:ma=None', t);
  });
  assert.ok(V.interpret(f('ma'), 'I cancelled the old medical aid and joined Discovery').error, 'a new cover in the same breath is for the adviser');
  assert.strictEqual(V.interpret(f('ma'), 'I have medical aid').value, 'Medical aid');
});

/* ---- A9, A11: no phantom or someone else's rows ---- */
test('A9: a hypothesis or someone else\'s loan makes, adds and fills no row on any branch', () => {
  ['My brother has a personal loan with Capitec', 'Imagine you had a home loan with FNB', 'My dad has a credit card with Nedbank and a car loan', 'my brother has another loan with FNB'].forEach(t => {
    assert.strictEqual(brief(plan(t, { cur: 'debts' })), '', t);
    assert.strictEqual(brief(plan(t, carRow)), '', t + ' (a row already there)');
    assert.strictEqual(brief(plan(t, { cur: 'debts', target: 'debts:0:prov', rows: oneCar, curRow: { debts: 0 } })), '', t + ' (a box waiting)');
    assert.strictEqual(brief(plan(t, { cur: 'debts', target: 'count:debts' })), '', t + ' (the count asked)');
  });
  assert.match(brief(plan('I have a credit card with Nedbank and a car loan with WesBank', { cur: 'debts' })), /addrow\(debts\).*addrow\(debts\)/, 'the client\'s own loans still make rows');
  assert.match(brief(plan('my son Thandi is nine', { cur: 'kids' })), /^$|kids/, 'the children list is not guarded');
});
test('A11: the add-a-row word must qualify the list noun, not merely sit in the clause', () => {
  ['I just have one more payment on the car loan', 'My wife looks after the other investments', 'We bought a new car on finance'].forEach(t => {
    assert.ok(!/addrow/.test(brief(plan(t, { cur: t.indexOf('investments') >= 0 ? 'inv' : 'debts', rows: oneCar, curRow: { debts: 0 } }))), t);
  });
  assert.strictEqual(brief(plan('add another loan', { cur: 'debts' })), 'addrow(debts) ask:debts:0:type');
  assert.strictEqual(brief(plan('one more loan', { cur: 'debts' })), 'addrow(debts) ask:debts:0:type');
  assert.strictEqual(brief(plan('a new home loan', { cur: 'debts' })), 'addrow(debts) ask:debts:0:type');
  assert.strictEqual(brief(plan('another policy', { cur: 'cover' })), 'addrow(risk) ask:risk:0:prov');
  assert.strictEqual(brief(plan('the other loan', { cur: 'debts' })), 'addrow(debts) ask:debts:0:type');
  assert.strictEqual(brief(plan('Add another child', { cur: 'kids', rows: { kids: [{ name: 'Thandi' }] }, curRow: { kids: 0 } })), 'addrow(kids) ask:kids:1:name');
});

/* ---- A12, A13: whose name, whose number ---- */
test('A12: "my wife is a teacher" is not the spouse\'s name', () => {
  ['My wife is a teacher', 'my husband is a plumber', 'my wife is an accountant', 'my wife is retired'].forEach(t => {
    assert.strictEqual(brief(plan(t, { cur: 'income' })), '', t);
    assert.strictEqual(brief(plan(t, { cur: 'income', target: 'sp_name' })), '', t + ' (box waiting)');
  });
  assert.strictEqual(brief(plan('My wife is Sarah', { cur: 'income' })), 'fill:sp_name=Sarah');
  assert.strictEqual(brief(plan('my wife is sarah', { cur: 'income' })), 'fill:sp_name=Sarah');
  assert.strictEqual(brief(plan('my wife is called Sarah Jones', { cur: 'income' })), 'fill:sp_name=Sarah Jones');
});
test('A13: another person\'s ID, tax, phone or email never goes into the client\'s box', () => {
  ["My wife's ID is 8001015009087", "my husband's ID number is 7001015009087", "my son's tax number is 1234567890", "my wife's tax number is 1234567890",
    "my wife's cell is 082 555 0148", "my husband's number is 082 555 0148", "my ex-wife's ID is 8001015009087", "my wife's email is sarah@gmail.com", "my wife's passport is A1234567"].forEach(t => {
    assert.strictEqual(brief(plan(t, { cur: 'info' })), '', t);
    assert.strictEqual(brief(plan(t, { cur: 'info', target: 'idno' })), '', t + ' (ID box waiting)');
  });
  assert.strictEqual(brief(plan('my ID is 8001015009087')), 'fill:idno=8001015009087');
  assert.strictEqual(brief(plan('my tax number is 1234567890')), 'fill:tax=1234567890');
  assert.strictEqual(brief(plan('my email is john@gmail.com')), 'fill:pemail=john@gmail.com');
  assert.strictEqual(V.interpret(f('idno'), "my wife's ID is 8001015009087").error, 'other-person');
  assert.match(brief(plan('the partner id number is 8001015800087', { cur: 'income' })), /shares.*8001015800087/, 'the partner boxes still take theirs');
});

/* ---- A14: yes and no ---- */
test('A14: the adviser\'s pitch and "ja nee" are not a Yes to Has personal risk cover', () => {
  ['we definitely need to get you some cover in place', 'we should definitely get you some cover', 'I have to get some cover', 'Ja nee'].forEach(t => {
    assert.strictEqual(brief(plan(t, { cur: 'cover', target: 'has_risk', who: t[0] === 'J' ? 'client' : 'adviser' })), '', t);
  });
  assert.strictEqual(V.interpret(f('has_risk'), 'nee').value, 'No');
  ['yes', 'ja', 'definitely', 'yes definitely', 'yes I do'].forEach(t => assert.strictEqual(V.interpret(f('has_risk'), t).value, 'Yes', t));
  assert.strictEqual(V.interpret(f('has_risk'), "no I can't").value, 'No');
  assert.strictEqual(V.interpret(f('has_risk'), "I can't remember").error, 'unsure', "can't remember is not a No");
});

/* ---- A15: finishing a section, and moving to one ---- */
test('A15: "the kids are all sorted" and "any more questions?" end no section', () => {
  assert.strictEqual(brief(plan('the kids are all sorted', { cur: 'kids' })), '');
  assert.strictEqual(brief(plan('No', { cur: 'occ', prev: 'Any more questions from your side?' })), '');
  assert.strictEqual(brief(plan('No', { cur: 'debts', prev: 'Any more questions on the debts?' })), 'done(debts)@debts/declined', 'a question that names a list still closes it');
  assert.strictEqual(brief(plan('No', { cur: 'debts', prev: 'Anything else?' })), 'done@debts/declined');
  assert.strictEqual(brief(plan('the debts are all done', { cur: 'debts' })), 'done@debts/said');
  assert.strictEqual(brief(plan('the debts section is sorted', { cur: 'debts' })), 'done@debts/said');
});
test('A15: "open up", "onto" and "on to" move the page only before a section\'s name, and a plan for later is not an order', () => {
  ['we can open up a tax-free savings account for you', 'She signed onto the medical aid in January', "We'll talk about retirement options once the cover is sorted", 'open a savings account'].forEach(t =>
    assert.strictEqual(V.parseCommand(t, idx), null, t));
  assert.strictEqual(V.parseCommand('go to the debts when we are done', idx), null);
  ['on to retirement', 'open up the debts', 'open the debts section', 'let us move on to retirement', 'go to the investments', 'moving on to health'].forEach(t =>
    assert.strictEqual(V.parseCommand(t, idx).type, 'goto', t));
});
