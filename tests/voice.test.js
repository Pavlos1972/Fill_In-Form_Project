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
  assert.strictEqual(d('14 March 1986'), '14/03/1986');
  assert.strictEqual(d('the fourteenth of March nineteen eighty six'), '14/03/1986');
  assert.strictEqual(d('March 14th 1986'), '14/03/1986');
  assert.strictEqual(d('twenty third of July two thousand and five'), '23/07/2005');
  assert.strictEqual(d('1st of December twenty twenty four'), '01/12/2024');
  assert.strictEqual(d('14/03/1986'), '14/03/1986');
  assert.strictEqual(d('9 December 72'), '09/12/1972');
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
  assert.strictEqual(say('dob', '14 March 1986').value, '14/03/1986');
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

/* ---------- the client's answer meets what is already in the box ---------- */
const ans = (id, text, existing) => V.answerFor(f(id), text, existing);

test('agreeing with what is already there confirms it', () => {
  ['yes', "yes that's right", 'correct', 'still the same', 'that is correct', 'yeah, nothing has changed'].forEach(s =>
    assert.strictEqual(ans('occ', s, 'Underwriter').kind, 'confirm', s));
  assert.strictEqual(ans('occ', "I'm an underwriter", 'Underwriter').kind, 'confirm');
  assert.strictEqual(ans('employer', 'yes, Discovery', 'Discovery').kind, 'confirm');
});
test('a different answer replaces it, and a bare "no" waits for the correction', () => {
  const r = ans('occ', "no, I'm now a manager", 'Underwriter');
  assert.deepStrictEqual([r.kind, r.value], ['fill', 'Manager']);
  assert.strictEqual(ans('occ', 'no', 'Underwriter').kind, 'wait');
  assert.strictEqual(ans('occ', 'nope', 'Underwriter').kind, 'wait');
  assert.strictEqual(ans('occ', "right, I'm a senior underwriter now", 'Underwriter').kind, 'fill');
});
test('a bare yes or no is not an occupation when the box is empty', () => {
  assert.strictEqual(ans('occ', 'yes', '').kind, 'none');
  assert.strictEqual(ans('occ', 'no', '').kind, 'none');
  assert.strictEqual(ans('occ', 'underwriter', '').value, 'Underwriter');
});
test('drop-downs: the answer is read as an answer, and only clear wording confirms', () => {
  assert.strictEqual(ans('employed', 'yes', 'Yes').kind, 'confirm');
  const diff = ans('employed', 'yes', 'No');
  assert.deepStrictEqual([diff.kind, diff.value], ['fill', 'Yes']);
  assert.strictEqual(ans('smoker', 'yes', 'Non-smoker').value, 'Smoker');          // "do you smoke?" - "yes"
  assert.strictEqual(ans('smoker', "no, I don't", 'Non-smoker').kind, 'confirm');
  assert.strictEqual(ans('smoker', "that's correct", 'Non-smoker').kind, 'confirm');
  assert.strictEqual(ans('ft', 'contract', 'Full time').value, 'Contract');
});
test('answers that cannot be used are reported, not guessed', () => {
  assert.strictEqual(ans('gross', 'quite a lot', '').kind, 'error');
  assert.strictEqual(ans('marital', "I'm married", '').kind, 'error');
});
test('private fields are the ones that are never sent to Claude', () => {
  assert.deepStrictEqual([...V.PRIVATE_IDS].sort(), ['cell', 'home', 'idno', 'pemail', 'shares.cell', 'shares.id', 'sp_tel', 'tax', 'wemail', 'work']);
});

test('the adviser asking or steering is told apart from the client answering', () => {
  const asks = ['What is your occupation', 'what is your occupation?', "Let's talk about your employer", 'who do you work for', 'Do you work for a company', 'Are you employed', 'Tell me about your job',
    'you work for a company, right?', 'So you work at Discovery', 'And your employer', 'Okay, now how long have you been there', "Can you tell me your cell number", 'Next, your employer', 'Where do you live', 'Employer?',
    'Have you got any children', 'Moving on to health', "I'd like to ask about your health", 'Your date of birth', 'How old are you'];
  const answers = ['my employer is Discovery', 'My employer is Discovery.', "I'm a teacher", 'I work for Discovery', 'Discovery', 'Discovery Limited', "it's Discovery", 'yes that is correct', 'No, I changed jobs last year',
    'I have two children', 'about eight years', 'Next year in March', 'We live in Cape Town', 'My cell is 082 555 0148', 'I do not smoke', 'two', 'Well, my employer is Discovery'];
  asks.forEach(t => assert.ok(V.looksLikeQuestion(t), 'should be the adviser: ' + t));
  answers.forEach(t => assert.ok(!V.looksLikeQuestion(t), 'should be the client: ' + t));
  assert.ok(!V.looksLikeQuestion('') && !V.looksLikeQuestion(null));
});

test('acknowledgements and small talk are ignored, real answers are not', () => {
  ['okay great', 'Perfect, thank you', 'Thanks so much', 'mm hm', 'I see', 'Lovely.', 'Alright, that is fine', 'ok'].forEach(t => assert.ok(V.isChatter(t), 'chatter: ' + t));
  ['my employer is Discovery', "I'm a teacher", 'Discovery', 'two', 'no I changed jobs', 'yes Discovery', 'that is correct, I am married'].forEach(t => assert.ok(!V.isChatter(t), 'not chatter: ' + t));
});

/* ---- fluid conversation: one line can hold the adviser and the client together ---- */
const planOf = (text, o) => {
  const vals = (o && o.vals) || {};
  return V.plan(text, idx, { cur: (o && o.cur) || 'info', target: o && o.target, answered: o && o.answered, value: id => vals[id] || '', visible: () => true });
};
const brief = p => p.actions.map(a => a.do + (a.field ? ':' + a.field : '') + (a.res && a.res.value ? '=' + a.res.value : '')).join(' ');
test('a fact counts whoever says it, in order: your first name is John, and your second name? oh my second name is Peters', () => {
  ['Your first name is John and your second name? Oh my second name is Peters',
    'Your first name is John and your second name. Oh, my second name is Peters.'].forEach(t => {
    const p = planOf(t);
    assert.strictEqual(brief(p), 'fill:fname=John ask:sname fill:sname=Peters', t);
    assert.ok(p.sure);
  });
  assert.strictEqual(brief(planOf('your first name is John and your second name oh my second name is Peters')), 'fill:fname=John fill:sname=Peters');
  assert.strictEqual(brief(planOf('my surname is Peters and my cell is 082 555 0148')), 'fill:sname=Peters fill:cell=082 555 0148');
  assert.strictEqual(brief(planOf('my name is John')), 'fill:fname=John');
});
test('a question then its answer in one breath, and a statement answering a waiting box', () => {
  assert.strictEqual(brief(planOf('What is your occupation? I am a teacher', { cur: 'occ' })), 'ask:occ fill:occ=Teacher');
  assert.strictEqual(brief(planOf('my employer is Discovery', { cur: 'occ', target: 'occ', answered: false })), 'fill:employer=Discovery');
  assert.strictEqual(brief(planOf('Discovery', { cur: 'occ', target: 'employer', answered: false })), 'fill:employer=Discovery');
  assert.strictEqual(brief(planOf('yes that is correct', { cur: 'occ', target: 'occ', answered: false, vals: { occ: 'Underwriter' } })), 'confirm:occ');
  assert.strictEqual(brief(planOf("let's talk about your health")), 'cmd');
});
test('small talk does nothing and is not worth asking Claude about; the unclear is flagged', () => {
  const chat = planOf('Okay great, thank you');
  assert.strictEqual(chat.actions.length, 0); assert.ok(chat.sure);
  assert.ok(!planOf('so how do you feel about the whole situation').sure);
  assert.ok(!planOf('I have been at Discovery for about eight years now and I am an underwriter', { cur: 'occ', target: 'occ', answered: false }).sure);
  assert.ok(!planOf('I work for Discovery', { cur: 'occ' }).sure);
});
test('a check-back tag on a stated fact is not part of the value', () => {
  assert.strictEqual(brief(planOf('your employer is Discovery, right', { cur: 'occ' })), 'fill:employer=Discovery');
  assert.strictEqual(brief(planOf('so your surname is Peters, correct', { cur: 'info' })), 'fill:sname=Peters');
  assert.strictEqual(brief(planOf('your employer is Discovery, correct?', { cur: 'occ' })), 'ask:employer');
});

/* ---- never type what was merely heard: the lead-in words are not the answer ---- */
test('lead-in words, repeated or dangling, are never put in a box', () => {
  const sname = f('sname'), fname = f('fname'), employer = f('employer');
  assert.strictEqual(V.answerFor(sname, 'my second name my surname is Snow', '').value, 'Snow');
  assert.strictEqual(V.answerFor(sname, 'My second name my surname is', '').kind, 'wait');
  assert.strictEqual(V.answerFor(sname, 'my surname is', '').dangling, true);
  assert.strictEqual(V.answerFor(fname, 'Oh, my first name is John', '').value, 'John');
  assert.notStrictEqual(V.answerFor(fname, 'John my second', '').kind, 'fill');
  assert.notStrictEqual(V.answerFor(fname, 'is the', '').kind, 'fill');
  assert.strictEqual(V.answerFor(employer, 'my employer is', '').kind, 'wait');
  assert.strictEqual(V.answerFor(employer, 'my employer Discovery', '').value, 'Discovery');
  assert.strictEqual(V.answerFor(employer, 'The Foschini Group', '').value, 'The Foschini Group');
  assert.strictEqual(V.answerFor(employer, 'Name Brand Holdings', '').value, 'Name Brand Holdings');
});
test('a sentence that stops before the answer glows that box and keeps listening, and the answer then fills it', () => {
  assert.strictEqual(brief(planOf('My second name my surname is')), 'ask:sname');
  assert.ok(planOf('My second name my surname is').sure);
  assert.strictEqual(brief(planOf('Snow', { target: 'sname', answered: false })), 'fill:sname=Snow');
  assert.strictEqual(brief(planOf('my surname is', { target: 'sname', answered: false })), 'ask:sname');
  assert.strictEqual(brief(planOf('John my second', { target: 'fname', answered: false })), '');
  assert.ok(!planOf('John my second', { target: 'fname', answered: false }).sure);
});

/* ---- "I don't have a home number but my work number is ..." ---- */
test('no home number ticks the box and the work number is filled, in one breath', () => {
  const t = "I don't have a home number but my work number is 021 555 0199";
  assert.strictEqual(brief(planOf(t)), 'fill:home=None fill:work=021 555 0199');
  assert.ok(planOf(t).sure);
  assert.strictEqual(brief(planOf('I do not have a home number, but I have a work number 021 555 0199')), 'fill:home=None fill:work=021 555 0199');
  assert.strictEqual(brief(planOf("my cell number is 082 555 0148 and I don't have a work number")), 'fill:cell=082 555 0148 fill:work=None');
  assert.strictEqual(brief(planOf('no personal email')), 'fill:pemail=None');
  assert.strictEqual(brief(planOf("I haven't got a work email")), 'fill:wemail=None');
  assert.strictEqual(brief(planOf("I've got a work number it's 021 555 0199")), 'fill:work=021 555 0199');
});
test('a bare no or none on a box with a "No ..." tick-box ticks it; elsewhere it does not fill', () => {
  ['no', 'none', 'nope', "No, I don't", "I don't have one", "I haven't got a home number"].forEach(x => assert.strictEqual(brief(planOf(x, { target: 'home', answered: false })), 'fill:home=None', x));
  assert.strictEqual(brief(planOf('021 555 0199', { target: 'home', answered: false })), 'fill:home=021 555 0199');
  assert.strictEqual(brief(planOf('no', { cur: 'occ', target: 'employer', answered: false })), '');
});
test('an email is whatever follows "is" or "it\'s", however it was introduced', () => {
  assert.strictEqual(brief(planOf('my email is john at gmail dot com')), 'fill:pemail=john@gmail.com');
  assert.strictEqual(brief(planOf("my personal email, it's john at gmail dot com")), 'fill:pemail=john@gmail.com');
  assert.strictEqual(brief(planOf("I have an email it's peters dot snow at gmail dot com")), 'fill:pemail=peters.snow@gmail.com');
});
test('only the clearly understood actions are certain; the shaky ones are marked so Claude can overrule them', () => {
  const p = planOf('What is your occupation? I am a senior underwriter for one of the big insurers', { cur: 'occ' });
  assert.ok(!p.sure);
  assert.strictEqual(p.actions.filter(a => !a.tentative).map(a => a.do + ':' + a.field).join(' '), 'ask:occ');
  assert.ok(p.actions.some(a => a.tentative && a.do === 'fill'));
  const q = planOf('What is your occupation? I am a teacher and I have been at Discovery for about eight years', { cur: 'occ' });
  assert.ok(!q.sure);                                                        // the second half is not understood here, so Claude reads the line
  assert.strictEqual(q.actions.filter(a => !a.tentative).map(a => a.do + ':' + a.field).join(' '), 'ask:occ fill:occ');
});
test('a long answer to a date or number question is read here; a long free-text answer is left to Claude', () => {
  const d = planOf('it is the fifth of March nineteen eighty', { target: 'dob', answered: false });
  assert.ok(d.sure); assert.strictEqual(brief(d), 'fill:dob=05/03/1980');
  assert.ok(!planOf('I am a senior underwriter for one of the big insurers', { cur: 'occ', target: 'occ', answered: false }).sure);
});

/* ---- nationality, ID or passport, dates ---- */
test('nationality is South African unless the client says otherwise', () => {
  const nat = (t) => V.answerFor(f('nat'), t, 'South African');
  ['South African', 'yes', 'yes I am South African', "I'm South African"].forEach(t => assert.strictEqual(nat(t).kind, 'confirm', t));
  const z = nat("no, I'm Zimbabwean");
  assert.strictEqual(z.value, 'Other'); assert.deepStrictEqual(z.extra.map(x => x.id + '=' + x.value), ['nat_other=Zimbabwean']);
  assert.deepStrictEqual(nat('I am British').extra.map(x => x.value), ['British']);
  assert.deepStrictEqual(nat("I'm not South African, I'm Namibian").extra.map(x => x.value), ['Namibian']);
  assert.deepStrictEqual(nat('I am a Zimbabwean citizen').extra.map(x => x.value), ['Zimbabwean']);
  assert.strictEqual(nat("I'm not South African").kind, 'error');
});
test('the ID type is ID unless the client has no ID and gives a passport', () => {
  const t = (x) => V.answerFor(f('idtype'), x, 'ID');
  ['I have an ID', 'yes', 'I have both an ID and a passport'].forEach(x => assert.strictEqual(t(x).kind, 'confirm', x));
  ['passport', "no I don't have an ID, I have a passport", "I don't have an ID", 'no'].forEach(x => assert.strictEqual(t(x).value, 'Passport', x));
});
test('a passport number has letters, and says the ID type is a passport', () => {
  ['my passport number is A1234567', 'passport number A one two three four five six seven', 'A 1234567'].forEach(x => {
    const r = V.answerFor(f('idno'), x, '');
    assert.strictEqual(r.value, 'A1234567', x); assert.deepStrictEqual(r.extra.map(e => e.id + '=' + e.value), ['idtype=Passport']);
  });
  assert.strictEqual(V.answerFor(f('idno'), 'my ID number is 8001015800087', '').value, '8001015800087');
  assert.ok(!V.answerFor(f('idno'), 'my ID number is 8001015800087', '').extra);
});
test('every spoken date comes out day/month/year', () => {
  assert.strictEqual(V.spokenDate('the fifth of March nineteen eighty'), '05/03/1980');
  assert.strictEqual(V.spokenDate('1986-03-14'), '14/03/1986');
  assert.strictEqual(V.spokenDate('March 14th 1986'), '14/03/1986');
});

/* ---- notes: "let me take some notes", "note that down" ---- */
test('asking to take notes is recognised in the ways it is said, and not in ordinary talk', () => {
  ['let me take some notes', "Let's take some notes", "I'll make a note", 'let me jot down a few notes', 'okay I will take a quick note', 'put that in the notes', 'take some notes', 'notes', 'health notes'].forEach(t => assert.strictEqual((V.parseCommand(t, idx) || {}).type, 'notes', t));
  ['note that down', 'write that down', 'make a note of that', 'note this down'].forEach(t => { const c = V.parseCommand(t, idx); assert.ok(c && c.type === 'notes' && c.retro, t); });
  ['stop notes', "that's all for the notes", 'back to the form'].forEach(t => assert.strictEqual((V.parseCommand(t, idx) || {}).type, 'notesOff', t));
  ['I take notes every day', 'my notes are at the office', 'what is your occupation', 'I make a living as a teacher'].forEach(t => assert.ok(!V.parseCommand(t, idx), t));
  assert.strictEqual(V.parseCommand('let me take some notes on the will', idx).box, 'n_will');
  assert.strictEqual(V.parseCommand('medical aid notes', idx).box, 'n_ma');
});
test('the notes end however the adviser says it, and ending them never starts them again', () => {
  ["Okay, that's all for the notes.", "let's end the notes", "I'm done with the notes", 'we are done with the notes', "that's the end of the notes", "that's enough notes", 'finish the notes', 'notes done',
    "I'm finished with the notes", 'okay back to the questions', "let's go back to the form", 'stop taking notes', "I'm done taking notes", "that's it for the notes", 'close the notes', 'no more notes'
  ].forEach(t => assert.strictEqual((V.parseCommand(t, idx) || {}).type, 'notesOff', t));
  ['let me take some notes', "I'd like to take some notes", 'I wanted to make a couple of notes regarding the Old Mutual tax free', "I'm going to make a note", 'that is the notes', 'go to the notes'].forEach(t => assert.strictEqual((V.parseCommand(t, idx) || {}).type, 'notes', t));
  const st = { cur: 'other', noting: true };
  const p = V.plan("Okay, that's all for the notes.", idx, st);
  assert.deepStrictEqual(p.actions, [{ do: 'cmd', cmd: { type: 'notesOff' } }]);
  assert.ok(!V.plan('he pays half of it', idx, st).actions.some(a => a.do === 'cmd'));          // an ordinary note is still just a note
  ["let's move on", "Okay, let's move on.", 'we can move on now', 'time to carry on', 'move on'].forEach(t => assert.strictEqual((V.parseCommand(t, idx) || {}).type, 'next', t));      // "let's move on" ends the notes and goes to the next question
  assert.deepStrictEqual(V.plan("Okay, let's move on.", idx, st).actions, [{ do: 'cmd', cmd: { type: 'next' } }]);
  assert.strictEqual(V.parseCommand("let's move on to health", idx).sec, 'health');
  assert.ok(!V.parseCommand('he wants to move on', idx));
});
test('while notes are taken, what is said is noted and questions move on', () => {
  const p = (t) => V.plan(t, idx, { cur: 'health', noting: true, value: () => '', visible: () => true });
  assert.strictEqual(p('He wants to retire at sixty and they are worried about school fees').actions.map(a => a.do).join(), 'note');   // one line is one note
  assert.strictEqual(p('okay great').actions.length, 0);
  assert.strictEqual(p('what is your occupation').actions[0].do, 'ask');
  assert.strictEqual(p("let's talk about your health").actions[0].cmd.type, 'goto');
  assert.strictEqual(p('do you feel it is a good idea?').actions.length, 0);        // the adviser's own questions are not noted
  const q = V.plan('Let me take some notes. He wants to retire at sixty.', idx, { cur: 'health', value: () => '', visible: () => true });
  assert.deepStrictEqual(q.actions.map(a => a.do), ['cmd', 'note']);
});
test('notes are in point form, not full sentences', () => {
  assert.deepStrictEqual(V.pointForm('He wants to retire at sixty and they are worried about school fees'), ['Wants to retire at sixty', 'Worried about school fees']);
  assert.deepStrictEqual(V.pointForm("I don't have a will, um, basically"), ['Does not have a will']);
  assert.deepStrictEqual(V.pointForm('Okay great.'), []);
});
test('a correction of the nationality drops every lead-in word', () => {
  ["no actually I'm Zimbabwean", 'no, no, actually I am Zimbabwean', 'oh sorry, I am Zimbabwean', 'well actually Zimbabwean'].forEach(t => {
    const r = V.answerFor(f('nat'), t, 'South African');
    assert.deepStrictEqual(r.extra.map(x => x.value), ['Zimbabwean'], t);
  });
});

/* ---- lists: children, debts, policies and the rest ---- */
const planL = (text, o) => { o = o || {}; const rows = o.rows || {};
  return V.plan(text, idx, { cur: o.cur || 'kids', target: o.target, answered: o.answered, curRow: o.curRow, rows: k => rows[k] || [], value: () => '', visible: () => true }); };
const briefL = p => p.actions.map(a => a.do + (a.list ? '(' + a.list + ')' : '') + (a.field ? ':' + a.field : '') + (a.res && a.res.value ? '=' + a.res.value : '')).join(' ');
const thandi = { rows: { kids: [{ name: 'Thandi' }] }, curRow: { kids: 0 } };

test('the lists are in the voice index, and a partner\'s ID and cell number are private', () => {
  assert.deepStrictEqual(Object.keys(idx.lists).sort(), ['debts', 'inv', 'invq', 'kids', 'raq', 'redq', 'ret', 'risk', 'shares']);
  assert.ok(idx.byId['kids.dob'].date && idx.byId['debts.bal'].money && idx.byId['risk.prov'].options);
  assert.ok(V.PRIVATE_IDS.includes('shares.id') && V.PRIVATE_IDS.includes('shares.cell'));
  assert.ok(!idx.byId['kids.cost'].none);
});
test('"do you have any children?" waits for how many, and the answer adds that many rows', () => {
  assert.strictEqual(briefL(planL('Do you have any children?')), 'ask:count:kids');
  assert.strictEqual(briefL(planL('How many children do you have?')), 'ask:count:kids');
  const w = { target: 'count:kids', answered: false };
  assert.strictEqual(briefL(planL('two', w)), 'addrow(kids) addrow(kids) ask:kids:0:name');
  assert.strictEqual(briefL(planL('yes', w)), 'addrow(kids) ask:kids:0:name');
  assert.strictEqual(briefL(planL('we have three', w)), 'addrow(kids) addrow(kids) addrow(kids) ask:kids:0:name');
  assert.strictEqual(briefL(planL('no', w)), '');
  assert.strictEqual(briefL(planL("we don't have any", w)), '');
  assert.strictEqual(briefL(planL('I have two children')), 'addrow(kids) addrow(kids) ask:kids:0:name');
  assert.strictEqual(briefL(planL('Do you have any debts?', { cur: 'debts' })), 'ask:count:debts');
  assert.strictEqual(briefL(planL('Do you have any existing policies?', { cur: 'cover' })), 'ask:count:risk');
});
test('a box of a row is asked about and filled in the right row', () => {
  assert.strictEqual(briefL(planL("What is the child's name?")), 'addrow(kids) ask:kids:0:name');
  assert.strictEqual(briefL(planL('Thandi', { target: 'kids:0:name', answered: false })), 'fill:kids:0:name=Thandi');
  assert.strictEqual(briefL(planL('When was Thandi born?', Object.assign({ cur: 'info' }, thandi))), 'ask:kids:0:dob');
  assert.strictEqual(briefL(planL('22 August 2019', { target: 'kids:0:dob', answered: false })), 'fill:kids:0:dob=22/08/2019');
  assert.strictEqual(briefL(planL("And the second child's name?", thandi)), 'addrow(kids) ask:kids:1:name');
  assert.strictEqual(briefL(planL('the child name is Sipho', thandi)), 'fill:kids:0:name=Sipho');
  assert.strictEqual(briefL(planL('a girl', { target: 'kids:0:gender', answered: false })), 'fill:kids:0:gender=Female');
  assert.strictEqual(briefL(planL('He is a boy', { target: 'kids:0:gender', answered: false })), 'fill:kids:0:gender=Male');
  assert.strictEqual(briefL(planL('school fees are R2 500 a month', thandi)), 'fill:kids:0:cost=R 2 500.00');
  assert.strictEqual(briefL(planL('what is your date of birth', Object.assign({ cur: 'info' }, thandi))), 'ask:dob');     // "your" is the client, not the child
});
test('another child, one more policy, another one: each adds a row and asks its first box', () => {
  assert.strictEqual(briefL(planL('Add another child', thandi)), 'addrow(kids) ask:kids:1:name');
  assert.strictEqual(briefL(planL('another one', thandi)), 'addrow(kids) ask:kids:1:name');
  assert.strictEqual(briefL(planL('one more policy', { cur: 'cover' })), 'addrow(risk) ask:risk:0:prov');
  assert.strictEqual(briefL(planL('add a debt', { cur: 'debts' })), 'addrow(debts) ask:debts:0:type');
  assert.strictEqual(briefL(planL('another one', { cur: 'income' })), '');                // no list in that section
  assert.strictEqual(briefL(planL('next child', thandi)), 'addrow(kids) ask:kids:1:name');
});
test('debts and policies: balances, instalments and providers', () => {
  const d = { cur: 'debts', rows: { debts: [{ prov: 'FNB' }] }, curRow: { debts: 0 } };
  assert.strictEqual(briefL(planL('the balance on the loan is R450 000', d)), 'fill:debts:0:bal=R 450 000.00');
  assert.strictEqual(briefL(planL('The instalment is R6 200 a month', d)), 'fill:debts:0:inst=R 6 200.00');
  assert.strictEqual(briefL(planL('R450 000', { cur: 'debts', target: 'debts:0:bal', answered: false })), 'fill:debts:0:bal=R 450 000.00');
  assert.strictEqual(briefL(planL('yes', { cur: 'debts', target: 'debts:0:cl', answered: false })), 'fill:debts:0:cl=Yes');
  assert.strictEqual(briefL(planL('Old Mutual', { cur: 'cover', target: 'risk:0:prov', answered: false })), 'fill:risk:0:prov=Old Mutual');
  assert.strictEqual(briefL(planL('the premium is R1 200 a month', { cur: 'cover', rows: { risk: [{ prov: 'Old Mutual' }] }, curRow: { risk: 0 } })), 'fill:risk:0:spend=R 1 200.00');
});

/* ---- "I have a home loan with ABSA bank": a row introduced in a sentence is filled from what the sentence says ---- */
test('a sentence that introduces a row fills what it says about it', () => {
  const d = (t, o) => briefL(planL(t, Object.assign({ cur: 'debts' }, o || {})));
  assert.strictEqual(d('I have a home loan with ABSA bank'), 'addrow(debts) fill:debts:0:type=Home loan fill:debts:0:prov=ABSA ask:debts:0:desc');
  assert.ok(planL('I have a home loan with ABSA bank', { cur: 'debts' }).sure);
  assert.strictEqual(d('we have a bond with Standard Bank, about R6 200 a month'), 'addrow(debts) fill:debts:0:type=Home loan fill:debts:0:prov=Standard Bank fill:debts:0:inst=R 6 200.00 ask:debts:0:desc');
  assert.strictEqual(d('I have a car loan with Wesbank'), 'addrow(debts) fill:debts:0:type=Vehicle finance fill:debts:0:prov=Wesbank ask:debts:0:desc');
  assert.strictEqual(d('I have a credit card with Capitec'), 'addrow(debts) fill:debts:0:type=Credit card fill:debts:0:prov=Capitec ask:debts:0:desc');
  assert.strictEqual(d('I have a home loan'), 'addrow(debts) fill:debts:0:type=Home loan ask:debts:0:prov');
  assert.strictEqual(d('I have a home loan with Bank of Athens'), 'addrow(debts) fill:debts:0:type=Home loan fill:debts:0:prov=Other fill:debts:0:prov_other=Bank of Athens ask:debts:0:desc');
  assert.strictEqual(d('my home loan is with FNB', { rows: { debts: [{ type: 'Home loan' }] }, curRow: { debts: 0 } }), 'fill:debts:0:type=Home loan fill:debts:0:prov=FNB ask:debts:0:desc');
});
test('two items in one breath become two rows', () => {
  assert.strictEqual(briefL(planL('I have a home loan with ABSA bank and a car loan with Wesbank', { cur: 'debts' })),
    'addrow(debts) fill:debts:0:type=Home loan fill:debts:0:prov=ABSA ask:debts:0:desc addrow(debts) fill:debts:1:type=Vehicle finance fill:debts:1:prov=Wesbank ask:debts:1:desc');
  assert.strictEqual(briefL(planL('we have a daughter called Thandi and a son, Sipho', { cur: 'kids' })).replace(/ask:\S+/g, '').replace(/\s+/g, ' ').trim(),
    'addrow(kids) fill:kids:0:gender=Female fill:kids:0:name=Thandi addrow(kids) fill:kids:1:gender=Male fill:kids:1:name=Sipho');
});
test('retirement funds, policies and children work the same way', () => {
  assert.strictEqual(briefL(planL('I have a life policy with Discovery paying R900 a month', { cur: 'cover' })), 'addrow(risk) fill:risk:0:prov=Discovery fill:risk:0:spend=R 900.00 ask:risk:0:broker');
  assert.strictEqual(briefL(planL('I have a retirement annuity with Allan Gray', { cur: 'cover' })), 'addrow(ret) fill:ret:0:type=Retirement annuity fill:ret:0:prov=Allan Gray ask:ret:0:val');
  assert.strictEqual(briefL(planL('we have a daughter called Thandi, born 22 August 2019', { cur: 'kids' })).replace(/ask:\S+/g, '').replace(/\s+/g, ' ').trim(), 'addrow(kids) fill:kids:0:gender=Female fill:kids:0:name=Thandi fill:kids:0:dob=22/08/2019');
});
test('"yes, a home loan with ABSA" answers "do you have any debts?" and fills the row', () => {
  assert.strictEqual(briefL(planL('yes, a home loan with ABSA', { cur: 'debts', target: 'count:debts', answered: false })), 'addrow(debts) fill:debts:0:type=Home loan fill:debts:0:prov=ABSA ask:debts:0:desc');
});
test('a plain answer to the box being asked stays an answer, even when it holds a list word', () => {
  assert.strictEqual(briefL(planL('Home loan', { cur: 'debts', target: 'debts:0:type', answered: false })), 'fill:debts:0:type=Home loan');
  assert.strictEqual(briefL(planL('Unit trust / voluntary funds', { cur: 'q_ret', target: 'invq:0:product', answered: false })), 'fill:invq:0:product=Unit trust / voluntary funds');
  assert.strictEqual(briefL(planL('Home loan with ABSA bank', { cur: 'debts', target: 'debts:0:type', answered: false, rows: { debts: [{}] }, curRow: { debts: 0 } })), 'fill:debts:0:type=Home loan fill:debts:0:prov=ABSA ask:debts:0:desc');
});
test('what the page asks for itself is not answered by the rest of the same sentence', () => {
  const p = planL('I have a home loan with ABSA bank and we owe it jointly', { cur: 'debts' });
  assert.ok(!p.actions.some(a => a.field === 'debts:0:desc' && a.do === 'fill'));      // "we owe it jointly" is not a Description
  assert.ok(!p.sure);                                                                    // it is left for Claude to read
});
test('a statement about a box elsewhere is not turned into a new debt', () => {
  assert.strictEqual(briefL(planL('my loan account balance is R85 000', { cur: 'q_biz' })), 'fill:cl_bal=R 85 000.00');
  assert.strictEqual(briefL(planL('the balance on the home loan is R450 000', { cur: 'debts', rows: { debts: [{ type: 'Home loan', prov: 'ABSA' }, { type: 'Vehicle finance' }] }, curRow: { debts: 1 } })), 'fill:debts:0:bal=R 450 000.00');
  assert.strictEqual(V.parseCommand('add a debt', idx).type, 'addrow');
  assert.deepStrictEqual(require('../app/js/schema.js').lists.debts.cols.map(c => c.k).slice(0, 3), ['type', 'prov', 'prov_other']);   // Type comes before the loan provider
});

/* ---- ID numbers, passports and whole names said in one breath ---- */
test('"my name is John Snow and my ID is 7212095268086" fills the names and the ID number, with no help from Claude', () => {
  const p = planOf('my name is John Snow and my ID is 7212095268086');
  assert.strictEqual(brief(p), 'fill:fname=John fill:idno=7212095268086');
  assert.deepStrictEqual(p.actions[0].res.extra.map(x => x.id + '=' + x.value), ['sname=Snow']);
  assert.ok(p.sure);
  ['my name is John Snow, my ID is 721209 5268 086', 'my name is John Snow my ID is 7212095268086', 'Oh, my ID is 7212095268086', 'ID 7212095268086', '7212095268086', 'it is 7212095268086'].forEach(t => {
    assert.ok(/fill:idno=7212095268086$/.test(brief(planOf(t))), t + ' -> ' + brief(planOf(t)));
  });
  assert.strictEqual(brief(planOf('ID number seven two one two zero nine five two six eight zero eight six')), 'fill:idno=7212095268086');
});
test('a whole name fills the first name and the surname; "first name" alone stays whole; a surname already there is kept', () => {
  const extras = t => (planOf(t).actions[0].res.extra || []).map(x => x.id + '=' + x.value).join();
  assert.strictEqual(extras('my name is John Snow'), 'sname=Snow');
  assert.strictEqual(extras('my name is Pieter van der Merwe'), 'sname=van der Merwe');
  assert.strictEqual(extras('my name is John Peter Snow'), 'sname=Snow');
  assert.strictEqual(extras('my first name is John Peter'), '');
  assert.strictEqual(extras('my name is John'), '');
  assert.strictEqual(extras('my name is Pieter van der Merwe'), 'sname=van der Merwe');
  assert.strictEqual((planOf('my name is John Snow', { vals: { sname: 'Smith' } }).actions[0].res.extra || [])[0].value, 'Snow');            // said as a whole name: it replaces
  assert.strictEqual((planOf('John Snow', { target: 'fname', answered: false, vals: { sname: 'Smith' } }).actions[0].res.extra || []).length, 0);   // a plain answer to the first-name box leaves the surname
  const asked = planOf('John Snow', { target: 'fname', answered: false });
  assert.strictEqual(brief(asked), 'fill:fname=John');
  assert.strictEqual(asked.actions[0].res.extra[0].value, 'Snow');
});
test('a passport number, said as letters and digits, goes in the number box and sets the type to Passport', () => {
  const r = planOf('my passport number is A 1 2 3 4 5 6 7').actions[0].res;
  assert.strictEqual(r.value, 'A1234567');
  assert.strictEqual(r.extra[0].id + '=' + r.extra[0].value, 'idtype=Passport');
  assert.strictEqual(brief(planOf('my ID is 7212095268086 and my salary is R45 000')).split(' ')[0], 'fill:idno=7212095268086');
});
test('questions about the ID still point at the right box', () => {
  assert.strictEqual(brief(planOf('Do you have an ID or a passport?')), 'ask:idtype');
  assert.strictEqual(brief(planOf('What is your ID number?')), 'ask:idno');
  assert.strictEqual(brief(planOf('and your ID?')), 'ask:idno');
});
test('a cell number or an email said without its label is still read here; a waiting box keeps the answer', () => {
  ['you can reach me on 082 555 0148', 'my number is 0825550148', 'call me on 0825550148'].forEach(t => assert.strictEqual(brief(planOf(t)), 'fill:cell=082 555 0148', t));
  assert.strictEqual(brief(planOf('082 555 0148', { target: 'work', answered: false })), 'fill:work=082 555 0148');
  assert.strictEqual(brief(planOf('my spouse number is 0825550148')), 'fill:sp_tel=082 555 0148');
  assert.strictEqual(brief(planOf('you can email me at john@snow.com')), 'fill:pemail=john@snow.com');
  assert.strictEqual(brief(planOf('you can email me at john at snow dot com')), 'fill:pemail=john@snow.com');
});
test('several facts in one breath: name, date of birth and ID number', () => {
  const p = planOf('my name is John Snow, born 9 December 1972, ID 7212095268086');
  assert.strictEqual(brief(p), 'fill:fname=John fill:dob=09/12/1972 fill:idno=7212095268086');
  assert.ok(p.sure);
  assert.strictEqual(brief(planOf('my name is John Snow and I was born on 9 December 1972')), 'fill:fname=John fill:dob=09/12/1972');
});

/* ---- several "No ..." ticks in one sentence, and corrections in the same breath ---- */
test('"I do not have a home number or a work number" ticks both boxes, however it is worded', () => {
  const both = ['I do not have a home number or a work number', 'I dont have a home or work number', 'no work or home number', 'I have neither a work nor a home number', 'I have no landline and no work number', 'I have no work number or home number'];
  both.forEach(t => { const p = planOf(t); assert.deepStrictEqual(p.actions.map(a => a.field + '=' + a.res.value).sort(), ['home=None', 'work=None'], t); assert.ok(p.sure, t); });
  assert.deepStrictEqual(planOf('I do not have a personal email or a work email').actions.map(a => a.field).sort(), ['pemail', 'wemail']);
  assert.strictEqual(brief(planOf('I have no work number')), 'fill:work=None');
  assert.strictEqual(brief(planOf('I have no email address')), 'fill:pemail=None');
});
test('the whole sentence: no home or work number, and a cell number that was corrected', () => {
  ['I do not have a home number or a work number and my cell number is 082 454 1750 sorry 083 454 1751',
    'I have no work number or home number, my cell is 082 454 1750, no sorry it is 083 454 1751',
    'I do not have a home number or a work number my cell number is 082 454 1750 sorry 083 454 1751'].forEach(t => {
    const p = planOf(t);
    assert.deepStrictEqual(p.actions.map(a => a.field + '=' + a.res.value).sort(), ['cell=083 454 1751', 'home=None', 'work=None'], t);
    assert.ok(p.sure, t);
  });
});
test('a correction in the same breath keeps only the last value, for numbers, ID numbers and names', () => {
  assert.strictEqual(brief(planOf('my cell is 082 454 1750 sorry 083 454 1751')), 'fill:cell=083 454 1751');
  assert.strictEqual(brief(planOf('my cell is 082 454 1750, no wait, it is 083 454 1751')), 'fill:cell=083 454 1751');
  assert.strictEqual(brief(planOf('my cell is 082 454 1750 083 454 1751')), 'fill:cell=083 454 1751');
  assert.strictEqual(brief(planOf('my ID is 7212095268086 no sorry 7312095268086')), 'fill:idno=7312095268086');
  assert.strictEqual(brief(planOf('my email is john at snow dot com sorry jon at snow dot com')), 'fill:pemail=jon@snow.com');
  assert.strictEqual(brief(planOf('my name is John sorry Peter')), 'fill:fname=Peter');
  assert.strictEqual(brief(planOf('my date of birth is 5 March 1980 no sorry 6 March 1980')), 'fill:dob=06/03/1980');
  assert.strictEqual(brief(planOf('082 454 1750, sorry, 083 454 1751', { target: 'cell', answered: false })), 'fill:cell=083 454 1751');
  assert.strictEqual(brief(planOf('my cell is 082 555 0148')), 'fill:cell=082 555 0148');                   // no correction: unchanged
});
test('a stated number, a correction and a "no ..." in one sentence each keep their own box', () => {
  assert.strictEqual(brief(planOf('my work number is 011 555 1234 no sorry 011 555 4321 and I have no home number')), 'fill:work=011 555 4321 fill:home=None');
  assert.strictEqual(brief(planOf('my work number is 011 555 1234 and no home number')), 'fill:work=011 555 1234 fill:home=None');
  assert.strictEqual(brief(planOf('I have a work number 011 555 1234 but no home number')), 'fill:work=011 555 1234 fill:home=None');
  assert.strictEqual(brief(planOf('I do not have a personal email but my work email is john at snow dot com')), 'fill:pemail=None fill:wemail=john@snow.com');
  assert.strictEqual(brief(planOf('my cell is 082 454 1750 and my email is john at snow dot com and I have no home number')), 'fill:cell=082 454 1750 fill:pemail=john@snow.com fill:home=None');
  assert.strictEqual(brief(planOf('my work number is 011 555 1234 and my cell is 082 454 1750 no sorry 083 454 1751')), 'fill:work=011 555 1234 fill:cell=083 454 1751');
});
test('a passport number said as letters and spoken digits keeps its letter and sets the type', () => {
  ['A one two three four five six seven', 'A 1 2 3 4 5 6 7', 'A1234567'].forEach(t => {
    const r = V.interpret(idx.byId.idno, t);
    assert.strictEqual(r.value, 'A1234567', t);
    assert.strictEqual(r.extra[0].value, 'Passport', t);
  });
});
test('an address whose first part was split off by dictation is put back together on this computer too', () => {
  assert.strictEqual(brief(planOf('my work email address is Jonathan snow@discovery.co.ZA')), 'fill:wemail=jonathansnow@discovery.co.za');
  assert.strictEqual(brief(planOf('my email is john@snow.com')), 'fill:pemail=john@snow.com');
  assert.strictEqual(brief(planOf('you can email me at jsnow@gmail.com')), 'fill:pemail=jsnow@gmail.com');
  assert.strictEqual(brief(planOf('my work email is Sandra mokoena at acme dot co dot za')), 'fill:wemail=sandramokoena@acme.co.za');
});
test('asking to remove everything is a whole-form command; nothing narrower or negated is', () => {
  const cmd = t => { const c = V.parseCommand(t, idx); return c && c.type; };
  ['All my details on the entire form are wrong, please remove them all', 'remove them all', 'delete everything', 'Delete everything on the form please', 'wipe the entire form',
    'clear the whole form', 'remove all my details', 'get rid of everything', 'start again from scratch', 'my details are not right, remove them all'].forEach(t => assert.strictEqual(cmd(t), 'clearAll', t));
  ['clear that', 'delete that'].forEach(t => assert.strictEqual(cmd(t), 'clear', t));                  // one box only
  ["don't delete everything", 'I do not want to remove everything', 'please do not wipe the form', 'remove the work number', 'what is your name'].forEach(t => assert.notStrictEqual(cmd(t), 'clearAll', t));
});
test('only a plain yes or no answers "delete all data from the entire form?"', () => {
  ['yes', 'Yes, delete everything', 'yeah go ahead', 'Yes please', 'yes I am sure', 'okay yes', 'Sure'].forEach(t => assert.strictEqual(V.wipeAnswer(t), 'yes', t));
  ['no', 'No, keep it', 'cancel', 'not yet', 'undo', 'wait'].forEach(t => assert.strictEqual(V.wipeAnswer(t), 'no', t));
  ['delete everything', 'remove them all', 'yes but keep the name', 'hmm', 'yes no', '', 'All my details on the entire form are wrong, please remove them all'].forEach(t => assert.strictEqual(V.wipeAnswer(t), null, t));
});
test('the public profile box is not a notes box: notes go to the Notes box of the page', () => {
  const occ = idx.notes.filter(n => n.sec === 'occ').map(n => n.id), info = idx.notes.filter(n => n.sec === 'info').map(n => n.id);
  assert.deepStrictEqual(occ, ['n_occ']);
  assert.deepStrictEqual(info, ['n_info']);
  assert.ok(!idx.byId.profile && !idx.noteById.profile);                                    // and voice never fills it
});
test('more ways of asking to make notes are understood, and what follows in the same line is noted', () => {
  ["I wanted to make a couple of notes regarding the client's Old Mutual tax-free investment", "I'd like to make a note about the will", 'can we make some notes about the bond', 'we need to record some notes', 'I would like to take a few notes']
    .forEach(s => assert.strictEqual((V.parseCommand(s, idx) || {}).type, 'notes', s));
  const line = "I wanted to make a couple of notes regarding the client's Old Mutual tax-free investment. The client told me that the Old Mutual tax-free investment was for his son's education when he turns 18 for his university fees.";
  const pl = V.plan(line, idx, { cur: 'inv', noting: false, target: null, answered: false, rows: () => [], curRow: {}, value: () => '', visible: () => true });
  assert.deepStrictEqual(pl.actions.map(a => a.do), ['cmd', 'note']);
  assert.strictEqual(pl.actions[0].cmd.type, 'notes');
  assert.ok(/son's education/.test(pl.actions[1].text));
  assert.ok(!pl.actions.some(a => a.do === 'fill' || a.do === 'addrow'));
});

test('Type of quote: the FNA, shortfall and reduced quote each have one, with three choices', () => {
  ['fna_type', 'sf_type', 'redq.type'].forEach(id => assert.deepStrictEqual(f(id).options, ['New Business', 'Servicing', 'N/A'], id));
  const order = schema.sections.find(s => s.id === 'q_risk').blocks.map(b => (b.fields || []).map(x => x.id).join());
  assert.strictEqual(order[0], 'fna_req,fna_type,fna_ins');
  assert.strictEqual(order[1], 'sf_req,sf_type,sf_ins');
  assert.deepStrictEqual(schema.lists.redq.cols.map(c => c.k), ['req', 'type', 'ins', 'amt']);
});

test('Type of quote: answers in the words people use', () => {
  const v = (id, t) => { const r = V.interpret(f(id), t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  ['fna_type', 'sf_type', 'redq.type'].forEach(id => {
    assert.strictEqual(v(id, 'new business'), 'New Business', id);
    assert.strictEqual(v(id, "it's a new business quote"), 'New Business', id);
    assert.strictEqual(v(id, 'Servicing'), 'Servicing', id);
    assert.strictEqual(v(id, 'it is a servicing one'), 'Servicing', id);
    assert.strictEqual(v(id, 'N/A'), 'N/A', id);
    assert.strictEqual(v(id, 'not applicable'), 'N/A', id);
    assert.strictEqual(v(id, 'n a'), 'N/A', id);
    assert.strictEqual(v(id, 'new business or servicing'), 'ERR:ambiguous', id);   // a question, not an answer
    assert.strictEqual(v(id, 'no'), 'ERR:no-match', id);                           // "no" is not N/A
  });
});

test('Type of quote: a question names the quote it is about, and a plain one takes the first still empty', () => {
  const ask = (t, empty) => { const r = V.matchQuestion(t, idx, { cur: 'q_risk', isEmpty: empty || (() => true) }); return r && r.id; };
  assert.strictEqual(ask('What type of quote is the FNA quote?'), 'fna_type');
  assert.strictEqual(ask('What type of quote is the shortfall?'), 'sf_type');
  assert.strictEqual(ask('And the shortfall quote type?'), 'sf_type');
  assert.strictEqual(ask('What type of reduced quote is it?'), 'redq.type');
  assert.strictEqual(ask('Is it new business or servicing?'), 'fna_type');
  assert.strictEqual(ask('Is it new business or servicing?', id => id !== 'fna_type'), 'sf_type');
  assert.strictEqual(ask('What is the FNA quote?'), 'fna_req');                      // the request box keeps its own name
});
