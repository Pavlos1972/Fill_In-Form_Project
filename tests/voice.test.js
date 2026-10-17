const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const idx = V.buildIndex(schema);
const f = id => idx.byId[id];
const q = (text, cur) => { const r = V.matchQuestion(text, idx, { cur: cur || 'info', isEmpty: () => true }); return r && r.id; };
const say = (id, text) => V.interpret(f(id), text);

test('spoken numbers become amounts', () => {
  const n = V.wordsToNumber;
  assert.strictEqual(n('eighty five thousand two hundred'), 85200);
  assert.strictEqual(n('R85 000'), 85000);
  assert.strictEqual(n('85,000 rand a month'), 85000);
  assert.strictEqual(n('about 85k'), 85000);
  assert.strictEqual(n('twelve hundred'), 1200);
  assert.strictEqual(n('two hundred and fifty thousand'), 250000);
  assert.strictEqual(n('a hundred thousand'), 100000);
  assert.strictEqual(n('one point five million'), 1500000);
  assert.strictEqual(n('2.5 million'), 2500000);
  assert.strictEqual(n('nine'), 9);
  assert.strictEqual(n('no idea at all'), null);
});

test('spoken digits for phone and ID numbers', () => {
  assert.strictEqual(V.spokenDigits('zero eight two five five five oh one four eight'), '0825550148');
  assert.strictEqual(V.spokenDigits('082 555 0148'), '0825550148');
  assert.strictEqual(V.spokenDigits('double five'), '55');
  assert.strictEqual(V.spokenDigits('8104120195088'), '8104120195088');
});

test('spoken dates', () => {
  const d = V.spokenDate;
  assert.strictEqual(d('14 March 1986'), '1986-03-14');
  assert.strictEqual(d('the fourteenth of March nineteen eighty six'), '1986-03-14');
  assert.strictEqual(d('March 14th 1986'), '1986-03-14');
  assert.strictEqual(d('twenty third of July two thousand and five'), '2005-07-23');
  assert.strictEqual(d('1st of December twenty twenty four'), '2024-12-01');
  assert.strictEqual(d('14/03/1986'), '1986-03-14');
  assert.strictEqual(d('9 December 72'), '1972-12-09');
  assert.strictEqual(d('thirty first of february 1990'), null);
  assert.strictEqual(d('some time ago'), null);
});

test('spoken email addresses', () => {
  assert.strictEqual(V.spokenEmail('paul at liferisk dot co dot za'), 'paul@liferisk.co.za');
  assert.strictEqual(V.spokenEmail('paul dot k at gmail dot com'), 'paul.k@gmail.com');
  assert.strictEqual(V.spokenEmail('paulk@liferisk.co.za'), 'paulk@liferisk.co.za');
});

test('yes, no and not sure are understood in many wordings', () => {
  ['yes', 'yeah', 'yep', 'definitely', 'I do', 'we have', 'that is correct'].forEach(s => assert.strictEqual(V.yesNo(V.norm(s)), 'yes', s));
  ['no', 'nope', "I don't", 'I do not', 'we have not', 'none', 'not at all'].forEach(s => assert.strictEqual(V.yesNo(V.norm(s)), 'no', s));
  ['not sure', "I don't know", 'maybe'].forEach(s => assert.strictEqual(V.yesNo(V.norm(s)), 'unsure', s));
  assert.strictEqual(V.yesNo('the weather'), null);
});

test('commands that open a section', () => {
  const g = text => { const c = V.parseCommand(text, idx); return c && c.type === 'goto' ? c.sec : (c && c.type); };
  assert.strictEqual(g('I want to deal with occupation'), 'occ');
  assert.strictEqual(g("Let's deal with occupation"), 'occ');
  assert.strictEqual(g("let's look at the medical aid"), 'other');
  assert.strictEqual(g('go to income and household'), 'income');
  assert.strictEqual(g('We will deal with the children now'), 'kids');
  assert.strictEqual(g("I'd like to talk about your health"), 'health');
  assert.strictEqual(g('moving on to debts'), 'debts');
  assert.strictEqual(g('go to retirement and investment quotes'), 'q_ret');
  assert.strictEqual(g('open the investments'), 'inv');
  assert.strictEqual(g('occupation'), 'occ');
  assert.strictEqual(g('the health section'), 'health');
});

test('other commands', () => {
  const c = t => (V.parseCommand(t, idx) || {}).type;
  assert.strictEqual(c('scratch that'), 'undo');
  assert.strictEqual(c('undo that'), 'undo');
  assert.strictEqual(c('next'), 'next');
  assert.strictEqual(c('skip that'), 'next');
  assert.strictEqual(c('go back'), 'prev');
  assert.strictEqual(c('next section'), 'nextSection');
  assert.strictEqual(c('previous section'), 'prevSection');
  assert.strictEqual(c('clear that'), 'clear');
});

test('ordinary questions to the client are not mistaken for commands', () => {
  ['Do you have a medical aid?', 'What do you do for work?', 'How is your health?', 'Do you have any debts?', 'Are you married?', 'Do you work for a company?']
    .forEach(s => assert.strictEqual(V.parseCommand(s, idx), null, s));
});

test('your question points at the right field', () => {
  const cases = [
    ['Do you work for a company?', 'occ', 'employed'],
    ["What's the company's name?", 'occ', 'employer'],
    ['Who do you work for?', 'occ', 'employer'],
    ['What is your occupation?', 'occ', 'occ'],
    ['How long have you been in your current occupation?', 'occ', 'years'],
    ['Is that full time or contract?', 'occ', 'ft'],
    ['Do you own your own business?', 'occ', 'bizowner'],
    ['What is the name of the business?', 'occ', 'biz_name'],
    ['How is the business registered?', 'occ', 'biz_struct'],
    ['What is your first name?', 'info', 'fname'],
    ["What's your surname?", 'info', 'sname'],
    ['When were you born?', 'info', 'dob'],
    ['What is your ID number?', 'info', 'idno'],
    ['What is your cell number?', 'info', 'cell'],
    ['And your personal email address?', 'info', 'pemail'],
    ['Do you smoke?', 'info', 'smoker'],
    ['What is your highest qualification?', 'info', 'edu'],
    ['What is your gross monthly income?', 'income', 'gross'],
    ['What do you take home?', 'income', 'net'],
    ['What are your monthly expenses?', 'income', 'exp'],
    ['Are you married?', 'income', 'marital'],
    ["What's your wife's name?", 'income', 'sp_name'],
    ['Do you have a medical aid?', 'other', 'ma'],
    ['Which medical aid are you on?', 'other', 'ma_prov'],
    ['Do you have gap cover?', 'other', 'gap'],
    ['Do you have a will?', 'other', 'will'],
    ['Is it up to date?', 'other', 'will_up'],
    ['Do you have short term insurance?', 'other', 'sti'],
    ['Is your car insured?', 'other', 'sti_car'],
    ['Do you have any life cover?', 'cover', 'has_risk'],
    ['Do you have group risk through work?', 'cover', 'has_group'],
    ['Do you have diabetes?', 'health', 'h_dia'],
    ['Any problems with cholesterol?', 'health', 'h_chol'],
    ['What about blood pressure?', 'health', 'h_bp']
  ];
  cases.forEach(([text, sec, want]) => assert.strictEqual(q(text, sec), want, text));
});

test('a line that is not about any field matches nothing', () => {
  assert.strictEqual(q('How was your weekend?'), null);
  assert.strictEqual(q('Lovely weather today.'), null);
  assert.strictEqual(q('Okay, great.'), null);
});

test('drop-downs are chosen by what the client says', () => {
  assert.deepStrictEqual(say('employed', 'yes I do'), { value: 'Yes', status: 'heard' });
  assert.deepStrictEqual(say('employed', 'No, I am self employed').value, 'No');
  assert.strictEqual(say('ft', 'full time').value, 'Full time');
  assert.strictEqual(say('ft', "I'm permanent").value, 'Full time');
  assert.strictEqual(say('ft', 'on contract').value, 'Contract');
  assert.strictEqual(say('smoker', "I don't smoke").value, 'Non-smoker');
  assert.strictEqual(say('smoker', 'yes, I smoke').value, 'Smoker');
  assert.strictEqual(say('smoker', 'non-smoker').value, 'Non-smoker');
  assert.strictEqual(say('edu', 'I have a degree').value, '3-year degree');
  assert.strictEqual(say('edu', 'matric').value, 'Matric');
  assert.strictEqual(say('edu', 'matric and a diploma').value, 'Matric & diploma');
  assert.strictEqual(say('marital', "I'm married in community of property").value, 'Married in community of property');
  assert.strictEqual(say('marital', 'divorced').value, 'Divorced');
  assert.strictEqual(say('marital', 'single').value, 'Single');
  assert.strictEqual(say('biz_struct', "it's a Pty Ltd").value, 'Private company (Pty) Ltd');
  assert.strictEqual(say('ref', 'D and R Marketing').value, 'D&R Marketing');
  assert.strictEqual(say('ref', 'a current client').value, 'Current client');
  assert.strictEqual(say('ma', 'a hospital plan').value, 'Hospital plan');
  assert.strictEqual(say('sti', 'my wife handles it').value, 'Handled by spouse');
  assert.strictEqual(say('has_group', "I'm not sure").value, 'Not sure');
  assert.strictEqual(say('ret_age', 'sixty five').value, '65');
  assert.strictEqual(say('ma', 'yes I do').value, 'Medical aid');
  assert.strictEqual(say('ma', 'no').value, 'None');
  assert.strictEqual(say('marital', 'in community of property').value, 'Married in community of property');
  assert.strictEqual(say('marital', 'with accrual').value, 'Married out of community (with accrual)');
});

test('an unclear answer is left alone instead of guessed', () => {
  assert.strictEqual(say('marital', "I'm married").error, 'ambiguous');
  assert.strictEqual(say('marital', 'married out of community').error, 'ambiguous');
  assert.strictEqual(say('employed', 'what a lovely day').error, 'no-match');
  assert.strictEqual(say('smoker', 'sometimes at parties').error, 'no-match');
  assert.strictEqual(say('edu', 'a diploma').error, 'no-match');
});

test('provider lists accept a name that is on the list or any other', () => {
  assert.strictEqual(say('ma_prov', 'Discovery').value, 'Discovery Health');
  assert.strictEqual(say('ma_prov', "I'm with Momentum").value, 'Momentum Medical Scheme');
  assert.strictEqual(say('ma_prov', 'GEMS').value, 'GEMS (Government Employees Medical Scheme)');
  assert.deepStrictEqual(say('ma_prov', 'Some Tiny Scheme'), { value: 'Some Tiny Scheme', status: 'verify' });
  assert.strictEqual(say('gap_prov', 'Discovery').value, 'Discovery');
});

test('nationality: South African, or Other with the nationality filled in', () => {
  assert.strictEqual(say('nat', "I'm South African").value, 'South African');
  const o = say('nat', 'Greek');
  assert.strictEqual(o.value, 'Other');
  assert.deepStrictEqual(o.extra, [{ id: 'nat_other', value: 'Greek', status: 'verify' }]);
});

test('"none" boxes: a no answer ticks the box', () => {
  assert.strictEqual(say('work', "No, I don't have one").value, 'None');
  assert.strictEqual(say('home', 'none').value, 'None');
  assert.strictEqual(say('work', 'zero one one four five six seven eight nine zero').value, '011 456 7890');
});

test('amounts, dates, phone, ID and email are written correctly and flagged to verify', () => {
  assert.deepStrictEqual(say('gross', 'eighty five thousand rand a month'), { value: 'R 85 000.00', status: 'verify' });
  assert.strictEqual(say('exp', 'about R42 500').value, 'R 42 500.00');
  assert.strictEqual(say('dob', '14 March 1986').value, '1986-03-14');
  assert.strictEqual(say('cell', 'zero eight two five five five oh one four eight').value, '082 555 0148');
  assert.strictEqual(say('idno', '8 1 0 4 1 2 0 1 9 5 0 8 8').value, '8104120195088');
  assert.match(say('idno', 'eight one zero four one two').note, /6 digits heard/);
  assert.strictEqual(say('pemail', 'paul at liferisk dot co dot za').value, 'paul@liferisk.co.za');
  assert.strictEqual(say('pemail', 'paul at liferisk dot co dot za').status, 'verify');
  assert.strictEqual(say('gross', 'quite a lot').error, 'no-number');
  assert.strictEqual(say('dob', 'a while ago').error, 'no-date');
});

test('names and companies lose the lead-in words and get capital letters', () => {
  assert.deepStrictEqual(say('fname', 'my name is vicky'), { value: 'Vicky', status: 'verify' });
  assert.strictEqual(say('sname', "it's van der Merwe").value, 'Van der Merwe');
  assert.strictEqual(say('sname', 'zachos').value, 'Zachos');
  assert.strictEqual(say('sname', "o'brien").value, "O'Brien");
  assert.deepStrictEqual(say('employer', 'I work for Discovery'), { value: 'Discovery', status: 'heard' });
  assert.strictEqual(say('employer', "um, it's discovery limited.").value, 'Discovery Limited');
  assert.strictEqual(say('employer', 'FNB').value, 'FNB');
  assert.strictEqual(say('occ', "I'm an underwriter").value, 'Underwriter');
  assert.strictEqual(say('occ', 'I work as a financial adviser').value, 'Financial adviser');
});

test('percentages and years', () => {
  assert.strictEqual(say('d_desk', 'about sixty percent').value, '60');
  assert.strictEqual(say('biz_pct', '50 per cent').value, '50');
  assert.strictEqual(say('years', 'nine years').value, '9');
  assert.strictEqual(say('years', 'six months').value, '0.5');
});

test('notes are text and are added to rather than replaced', () => {
  const r = say('edu_notes', 'BCom accounting from Wits');
  assert.strictEqual(r.value, 'BCom accounting from Wits');
  assert.strictEqual(r.append, true);
});

test('only questions the client can answer are in the voice index', () => {
  assert.ok(f('employer') && f('gross') && f('smoker'));
  assert.ok(!f('dnet') && !f('disp') && !f('advisor') && !f('date') && !f('n_cover') && !f('lc_hh'));
});
