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
  assert.strictEqual(briefL(planL('add a debt', { cur: 'debts' })), 'addrow(debts) ask:debts:0:prov');
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
