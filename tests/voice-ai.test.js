const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');
const idx = V.buildIndex(schema);

const reply = body => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }) });

test('nothing private is sent: private boxes are named but never their values, and numbers and emails in the text become markers', () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: 'fname', targetValue: 'Vicky', filled: { fname: 'Vicky' }, filledPrivate: ['cell'], recent: [{ who: 'client', text: 'my cell is 082 555 0148 and my email is vicky@example.com' }] }, 'client', 'my ID is 8104120195088', 'claude-sonnet-5-5');
  const s = JSON.stringify(req), body = JSON.parse(req.messages[0].content);
  assert.ok(!/0825550148|082 555|8104120195088|vicky@example/.test(s));
  assert.ok(s.includes('[number]') && s.includes('[email]'));                                      // earlier lines: just that a number / email was said
  assert.strictEqual(body.newest.text, 'my ID is [N1]');                                            // the newest line: a marker Claude can point at
  assert.deepStrictEqual(body.private_values, [{ id: 'N1', kind: '13 digits, the length of an ID number' }]);
  ['idno', 'cell', 'work', 'home', 'pemail', 'wemail', 'sp_tel', 'tax'].forEach(id => assert.strictEqual(body.fields.find(f => f.id === id).private, true, id));
  ['work', 'home', 'pemail', 'wemail'].forEach(id => assert.strictEqual(body.fields.find(f => f.id === id).none_box, true, id));
  assert.deepStrictEqual(body.filled_private, ['cell']);
  assert.strictEqual(req.model, 'claude-sonnet-5-5');
});
test('markers: numbers and emails said in any way are swapped, with their general shape; amounts and dates are left alone', () => {
  const h = AI.shield("My cell number is 0824541751 and by the way, I don't have a telephone at home. Do you have a work number? Yes, I do, it 011 2346789, oh no, I made a mistake it's 0112345500");
  assert.strictEqual(h.text, "My cell number is [N1] and by the way, I don't have a telephone at home. Do you have a work number? Yes, I do, it [N2], oh no, I made a mistake it's [N3]");
  assert.deepStrictEqual(h.vault, { N1: '0824541751', N2: '011 2346789', N3: '0112345500' });
  assert.deepStrictEqual(h.list.map(x => x.kind), ['10 digits, starts like a cell number', '10 digits, starts like a landline number', '10 digits, starts like a landline number']);
  const e = AI.shield('write to john@snow.com or paul at liferisk dot co dot za, ID 7212095268086, tax zero one two three four five six seven eight nine');
  assert.strictEqual(e.text, 'write to [E1] or [E2], ID [N1], tax [N2]');
  const keep = 'I earn R45 000, owe R1 250 000 and R 1 250 000, born 05 03 1980 and 5 March 1980, a bond of 1 250 000 over 20 years';
  assert.strictEqual(AI.shield(keep).text, keep);
  assert.deepStrictEqual(AI.shield('082 555 0148', true), { text: '[number]', vault: {}, list: [] });
});
test('amounts of six or seven digits are not mistaken for private numbers', () => {
  assert.ok(AI.scrub('I earn 120000 and 1 250 000').includes('120000'));
  assert.ok(AI.scrub('I earn 120000 and 1 250 000').includes('1 250 000'));
});
test('every box carries its option lists, whichever section is open, because a line can move to another section and carry on there', () => {
  const req = AI.buildRequest(idx, { sectionId: 'occ', targetId: 'employer', targetValue: '', recent: [] }, 'me', 'so who do you work for', 'm');
  const body = JSON.parse(req.messages[0].content);
  assert.ok(body.fields.find(x => x.id === 'employed').options);
  assert.deepStrictEqual(body.fields.find(x => x.id === 'smoker').options, ['Non-smoker', 'Smoker']);
  assert.ok(body.fields.find(x => x.id === 'h_dia').options);
  assert.strictEqual(body.position.field, 'employer');
  assert.strictEqual(body.newest.who, 'adviser');
});
test("the adviser's line points at a section or a field", async () => {
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: "let's chat about your job", ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply({ section: 'occ', field: null }) });
  assert.deepStrictEqual(r, { kind: 'point', field: null, section: 'occ' });
  const r2 = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'so what do you do', ctx: { sectionId: 'occ', recent: [] }, fetchImpl: reply('Sure! {"section":"occ","field":"occ"}') });
  assert.deepStrictEqual(r2, { kind: 'point', field: 'occ', section: 'occ' });
});
test('the client\'s line gives answers; private and unknown fields are dropped', async () => {
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: "I'm an underwriter at Discovery", ctx: { sectionId: 'occ', targetId: 'occ', recent: [] },
    fetchImpl: reply({ answers: [{ field: 'occ', value: 'Underwriter', confirm: false }, { field: 'employer', value: 'Discovery' }, { field: 'idno', value: '8104120195088' }, { field: 'nope', value: 'x' }, { field: 'years', value: '' }] }) });
  assert.deepStrictEqual(r.answers.map(a => a.field), ['occ', 'employer']);
  const c = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'yes that is right', ctx: { sectionId: 'occ', targetId: 'occ', targetValue: 'Underwriter', recent: [] }, fetchImpl: reply({ answers: [{ field: 'occ', confirm: true }] }) });
  assert.deepStrictEqual(c.answers, [{ field: 'occ', confirm: true, value: null }]);
  const w = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'no', ctx: { sectionId: 'occ', targetId: 'occ', targetValue: 'Underwriter', recent: [] }, fetchImpl: reply({ answers: [], waiting: true }) });
  assert.strictEqual(w.waiting, true);
});
test('rubbish or errors from the service never reach the form', async () => {
  const none = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'client', text: 'x', ctx: {}, fetchImpl: reply('I am not sure what you mean') });
  assert.deepStrictEqual(none, { kind: 'none' });
  await assert.rejects(() => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'x', ctx: {}, fetchImpl: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }) }), /not accepted/);
  await assert.rejects(() => AI.decide({ apiKey: '', model: 'm', idx, who: 'me', text: 'x', ctx: {} }), /no API key/);
  await assert.rejects(() => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'me', text: 'x', ctx: {}, fetchImpl: () => Promise.reject(new Error('offline')) }), /no connection/);
});

test('when the page cannot tell who is speaking, Claude returns what to do, in order', async () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: null, targetValue: '', recent: [] }, 'auto', 'your first name is John and your second name? oh my second name is Peters', 'm');
  assert.strictEqual(JSON.parse(req.messages[0].content).newest.who, 'unclear');
  assert.ok(/Nobody tells you who is speaking/.test(req.system) && /WHOEVER/.test(req.system) && /actions/.test(req.system));
  const ctx = { sectionId: 'info', targetId: null, targetValue: '', recent: [] };
  const run = body => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', ctx, fetchImpl: reply(body) });
  const many = await run({ actions: [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'ask', field: 'sname' }, { do: 'fill', field: 'sname', value: 'Peters' }] });
  assert.deepStrictEqual(many, { kind: 'actions', actions: [{ do: 'fill', field: 'fname', value: 'John', explicit: false }, { do: 'ask', field: 'sname' }, { do: 'fill', field: 'sname', value: 'Peters', explicit: false }] });
  const mix = await run({ actions: [{ do: 'section', section: 'occ' }, { do: 'confirm', field: 'occ' }, { do: 'wait' }] });
  assert.deepStrictEqual(mix.actions.map(a => a.do), ['section', 'confirm', 'wait']);
  assert.deepStrictEqual(await run({ actions: [] }), { kind: 'none' });
  assert.deepStrictEqual(await run({ actions: [{ do: 'fill', field: 'idno', value: '1' }, { do: 'fill', field: 'cell', value: '0825550148' }, { do: 'fill', field: 'home', value: 'None' }, { do: 'fill', field: 'occ', value: 'None' }, { do: 'fill', field: 'nope', value: 'x' }, { do: 'fill', field: 'occ', value: '  ' }, { do: 'section', section: 'zzz' }] }),
    { kind: 'actions', actions: [{ do: 'fill', field: 'home', value: 'None', explicit: false }, { do: 'fill', field: 'occ', value: 'None', explicit: false }, { do: 'empty', field: 'occ' }] });     // a private box takes only a marker (or None for a No box); digits written by the model are dropped
  const old = await run({ role: 'client', answers: [{ field: 'employer', value: 'Discovery' }] });
  assert.deepStrictEqual(old.actions, [{ do: 'fill', field: 'employer', value: 'Discovery' }]);
  const oldAsk = await run({ role: 'adviser', section: 'occ', field: 'occ' });
  assert.deepStrictEqual(oldAsk.actions, [{ do: 'ask', field: 'occ' }]);
});
test('a host that can reach Claude without a key can be used in place of the key', async () => {
  const calls = [];
  const ask = (system, user) => { calls.push({ system, user }); return Promise.resolve('Sure. {"actions":[{"do":"fill","field":"employer","value":"Discovery"}]}'); };
  const r = await AI.decide({ model: 'm', idx, who: 'auto', text: 'my employer is Discovery', ctx: { sectionId: 'occ', targetId: 'employer', recent: [] }, ask });
  assert.strictEqual(r.actions[0].value, 'Discovery');
  assert.ok(calls[0].system.includes('Fact Find') && JSON.parse(calls[0].user).newest.text === 'my employer is Discovery');
  await assert.rejects(() => AI.decide({ model: 'm', idx, who: 'me', text: 'x', ctx: {}, ask: () => Promise.reject({ code: 'not_granted' }) }), /not allowed/);
  await assert.rejects(() => AI.decide({ model: 'm', idx, who: 'me', text: 'x', ctx: {} }), /no API key/);
});

test('Claude is told about every list of the form, with its section; private columns are named, their values never shown; list boxes are never plain fields', () => {
  const rows = { shares: [{ name: 'Sipho Dlamini', id: '8001015800087', cell: '0825550148', pct: '40' }], kids: [{ name: 'Thandi', dob: '22/08/2019' }] };
  const req = AI.buildRequest(idx, { sectionId: 'occ', targetId: null, recent: [], listRows: k => rows[k] || [] }, 'auto', 'my partner owns forty percent', 'm');
  const body = JSON.parse(req.messages[0].content), s = JSON.stringify(body);
  assert.deepStrictEqual(body.lists.map(l => l.id).sort(), ['debts', 'grp', 'inv', 'invq', 'kids', 'raq', 'redq', 'ret', 'risk', 'shares']);
  const shares = body.lists.find(l => l.id === 'shares'), inv = body.lists.find(l => l.id === 'inv');
  assert.strictEqual(shares.section, 'occ'); assert.strictEqual(inv.section, 'inv');
  assert.deepStrictEqual(shares.columns.map(c => c.id + (c.private ? '(private)' : '')), ['name', 'id(private)', 'cell(private)', 'pct']);
  assert.deepStrictEqual(inv.columns.map(c => c.id), ['type', 'prov', 'val', 'prem', 'broker']);              // a line that moves to Investments can fill a row there
  assert.ok(inv.columns[0].options.includes('Tax-free savings'));
  assert.ok(!/8001015800087|0825550148/.test(s));
  assert.deepStrictEqual(shares.rows, [{ n: 1, values: { name: 'Sipho Dlamini', pct: '40' } }]);
  assert.ok(!body.fields.some(f => String(f.id).includes('.')));
  const kids = JSON.parse(AI.buildRequest(idx, { sectionId: 'kids', targetId: 'kids.dob', targetRow: 2, recent: [], listRows: k => rows[k] || [] }, 'auto', 'x', 'm').messages[0].content);
  assert.strictEqual(kids.position.row, 2); assert.strictEqual(kids.position.field, 'kids.dob');
  assert.deepStrictEqual(kids.lists.find(l => l.id === 'kids').rows[0], { n: 1, values: { name: 'Thandi', dob: '22/08/2019' } });
});
test('Claude can add rows and fill boxes of rows, and nothing else gets through', async () => {
  const run = body => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', ctx: { sectionId: 'kids', recent: [] }, fetchImpl: reply(body) });
  const r = await run({ actions: [
    { do: 'row', list: 'kids', values: { name: 'Thandi', dob: '2019-08-22', nope: 'x', cost: '  ' } },
    { do: 'row', list: 'kids', values: { name: 'Sipho' } },
    { do: 'cell', list: 'kids', row: 2, col: 'cost', value: '3000' },
    { do: 'cell', list: 'kids', row: 'last', col: 'gender', value: 'Male' },
    { do: 'ask', list: 'debts', row: 'new', col: 'bal' }] });
  assert.deepStrictEqual(r.actions, [
    { do: 'row', list: 'kids', values: { name: 'Thandi', dob: '2019-08-22' } },
    { do: 'row', list: 'kids', values: { name: 'Sipho' } },
    { do: 'cell', list: 'kids', row: 2, col: 'cost', value: '3000', explicit: false },
    { do: 'cell', list: 'kids', row: 'last', col: 'gender', value: 'Male', explicit: false },
    { do: 'ask', list: 'debts', row: 'new', col: 'bal' }]);
  const bad = await run({ actions: [{ do: 'row', list: 'nope', values: { a: 'b' } }, { do: 'row', list: 'shares', values: { id: '8001015800087', cell: '0825550148' } },
    { do: 'cell', list: 'shares', row: 1, col: 'id', value: '1' }, { do: 'fill', field: 'kids.dob', value: '1' }, { do: 'ask', field: 'debts.bal' }, { do: 'row', list: 'kids', values: {} }] });
  assert.deepStrictEqual(bad, { kind: 'actions', actions: [{ do: 'cell', list: 'kids', col: 'dob', row: 'last', value: '1', explicit: false }, { do: 'ask', list: 'debts', col: 'bal', row: 'last' }] });   // unknown lists, private columns and empty rows are dropped; a list box named as a plain field is read as the list box
  assert.strictEqual((await run({ actions: [{ do: 'cell', list: 'kids', row: 'banana', col: 'name', value: 'A' }] })).actions[0].row, 'last');
});

test('Claude points at markers; the real values are put back on this computer, and only a marker (or None) is accepted for a private box', async () => {
  const text = "My cell number is 0824541751 and by the way, I don't have a telephone at home. Do you have a work number? Yes, I do, it 011 2346789, oh no, I made a mistake it's 0112345500. And also, my name is actually Jonathan";
  let sent = '';
  const fetchImpl = (url, o) => { sent = o.body; return reply({ actions: [
    { do: 'fill', field: 'cell', value: '[N1]' }, { do: 'fill', field: 'home', value: 'None' }, { do: 'ask', field: 'work' }, { do: 'fill', field: 'work', value: '[N3]' },
    { do: 'fill', field: 'fname', value: 'Jonathan', correction: true }, { do: 'fill', field: 'pemail', value: '[N9]' }, { do: 'fill', field: 'tax', value: '[N1] or [N2]' }, { do: 'fill', field: 'idno', value: '1234567890123' }] })(); };
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text, ctx: { sectionId: 'info', filled: { fname: 'John' }, filledPrivate: [], recent: [] }, fetchImpl });
  assert.ok(!/0824541751|2346789|0112345500/.test(sent) && /\[N1\]/.test(sent) && /\[N3\]/.test(sent));        // what left this computer: markers only
  assert.deepStrictEqual(r.actions, [
    { do: 'fill', field: 'cell', value: '0824541751', explicit: false }, { do: 'fill', field: 'home', value: 'None', explicit: false }, { do: 'ask', field: 'work' },
    { do: 'fill', field: 'work', value: '0112345500', explicit: false }, { do: 'fill', field: 'fname', value: 'Jonathan', explicit: true }]);   // unknown marker, two markers in one value and written digits are dropped
});
test('Claude can ask for the form itself to move: undo, next, notes', async () => {
  const run = body => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply(body) });
  const r = await run({ actions: [{ do: 'cmd', cmd: 'undo' }, { do: 'cmd', cmd: 'notes', retro: true }, { do: 'cmd', cmd: 'notesOff' }, { do: 'cmd', cmd: 'nextSection' }, { do: 'cmd', cmd: 'format the disk' }] });
  assert.deepStrictEqual(r.actions, [{ do: 'cmd', cmd: { type: 'undo' } }, { do: 'cmd', cmd: { type: 'notes', retro: true, box: null } }, { do: 'cmd', cmd: { type: 'notesOff' } }, { do: 'cmd', cmd: { type: 'nextSection' } }]);
});
test('a box that already has a value and a "No" box are described to Claude, so it can tell a correction from a new fact', () => {
  const body = JSON.parse(AI.buildRequest(idx, { sectionId: 'info', targetId: 'work', targetValue: '', targetFilled: false, filled: { fname: 'John', sname: 'Snow' }, filledPrivate: ['cell'], recent: [] }, 'auto', 'x', 'm').messages[0].content);
  assert.deepStrictEqual(body.filled, { fname: 'John', sname: 'Snow' });
  assert.strictEqual(body.position.field, 'work'); assert.strictEqual(body.position.current_value, null); assert.strictEqual(body.position.box_has_value, false);
  assert.ok(/none_box/.test(AI.SYSTEM) && /correction/.test(AI.SYSTEM) && /LAST/.test(AI.SYSTEM));
});
test('a reply that never comes is given up on, so the conversation is never held up', async () => {
  await assert.rejects(() => AI.decide({ model: 'm', idx, who: 'auto', text: 'x', ctx: {}, timeoutMs: 30, ask: () => new Promise(() => {}) }), /took too long/);
  const r = await AI.decide({ model: 'm', idx, who: 'auto', text: 'x', ctx: {}, timeoutMs: 500, ask: () => Promise.resolve('{"actions":[{"do":"ask","field":"occ"}]}') });
  assert.deepStrictEqual(r.actions, [{ do: 'ask', field: 'occ' }]);
});
test('a passport number is a private value too, said as letters and digits or as letters and spoken digits', () => {
  assert.strictEqual(AI.shield("it is A 1 2 3 4 5 6 7").text, 'it is [N1]');
  assert.strictEqual(AI.shield('my passport is A1234567').text, 'my passport is [N1]');
  assert.strictEqual(AI.shield('passport number is A one two three four five six seven').text, 'passport number is [N1]');
  assert.deepStrictEqual(AI.shield('it is M 8 7 6 5 4 3 2 1').list, [{ id: 'N1', kind: 'letters then digits, like a passport number' }]);
  const same = 'I earn R450000, R 1 234 567 and R4500000, invoice no 1234567, I have a one two three four';
  assert.strictEqual(AI.shield(same).text, same);                                              // money and plain words are not passports
});
test('when dictation leaves the start of an address outside the marker, Claude can name those words, and only words that are really there count', async () => {
  const text = 'my work email address is Jonathan snow@discovery.co.ZA and my cell is 0834541751';
  const run = value => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text, ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply({ actions: [{ do: 'fill', field: 'wemail', value }] }) });
  assert.deepStrictEqual((await run('Jonathan [E1]')).actions, [{ do: 'fill', field: 'wemail', value: 'Jonathan snow@discovery.co.ZA', explicit: false }]);
  assert.deepStrictEqual((await run('[E1]')).actions, [{ do: 'fill', field: 'wemail', value: 'snow@discovery.co.ZA', explicit: false }]);
  assert.deepStrictEqual(await run('Susan [E1]'), { kind: 'none' });                          // words that were not said in front of the address
  assert.deepStrictEqual(await run('is [E1]'), { kind: 'none' });                             // a lead-in word is not part of an address
  assert.deepStrictEqual(await run('Jonathan snow@discovery.co.za'), { kind: 'none' });       // an address written out by the model
  const sent = AI.buildRequest(idx, { sectionId: 'info', recent: [] }, 'auto', text, 'm');
  assert.ok(/Jonathan \[E1\]/.test(sent.messages[0].content) && !/discovery/.test(sent.messages[0].content));
  assert.ok(/start of the address/.test(AI.SYSTEM));
});
test('Claude can ask for the whole form to be cleared, and is told when that is and is not meant', async () => {
  const run = body => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'All my details on the entire form are wrong, please remove them all', ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply(body) });
  assert.deepStrictEqual((await run({ actions: [{ do: 'cmd', cmd: 'clearAll' }] })).actions, [{ do: 'cmd', cmd: { type: 'clearAll' } }]);
  assert.deepStrictEqual((await run({ actions: [{ do: 'cmd', cmd: 'clear' }] })).actions, [{ do: 'cmd', cmd: { type: 'clear' } }]);
  assert.ok(/clearAll/.test(AI.SYSTEM) && /are you sure/.test(AI.SYSTEM));
});
test('a shorter number said as a number (a tax number) is private too, but ordinary amounts and years are not', () => {
  const line = 'Can you tell me what your ID number is and your tax number? Yeah sure no problem. My ID number is 721209-5268086 and my tax number is 554-7259.';
  const sh = AI.shield(line);
  assert.strictEqual(sh.text, 'Can you tell me what your ID number is and your tax number? Yeah sure no problem. My ID number is [N1] and my tax number is [N2].');
  assert.deepStrictEqual(sh.list.map(x => x.kind), ['13 digits, the length of an ID number', '7 digits']);
  assert.strictEqual(AI.shield('my policy number is 1234567').text, 'my policy number is [N1]');
  ['my gross income is 1 250 000 a month', 'I owe 450 000 on the bond', 'the year was 1985 and I have 3 kids'].forEach(t => assert.strictEqual(AI.shield(t).text, t, t));
  assert.strictEqual(AI.shield('my passport is A1234567').text, 'my passport is [N1]');                      // letters then digits stay one private number
});
test('both numbers of the sentence reach their boxes, and digits sent unshielded are still recovered', async () => {
  const line = 'Can you tell me what your ID number is and your tax number? Yeah sure no problem. My ID number is 721209-5268086 and my tax number is 554-7259.';
  const run = (value, text) => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: text || line, ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply({ actions: [{ do: 'fill', field: 'idno', value: '[N1]' }, { do: 'fill', field: 'tax', value }] }) });
  assert.deepStrictEqual((await run('[N2]')).actions.map(a => [a.field, a.value]), [['idno', '721209-5268086'], ['tax', '554-7259']]);
  assert.deepStrictEqual((await run('1234567')).actions.map(a => a.field), ['idno']);                       // a number the model could not have seen is refused
  // seven digits with no number word before them are not made private, so Claude sees them as plain text; the box still takes them, because they are in the line that was said
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'okay 5547259 thanks', ctx: { sectionId: 'info', recent: [] }, fetchImpl: reply({ actions: [{ do: 'fill', field: 'tax', value: '5547259' }] }) });
  assert.deepStrictEqual(r.actions.map(a => [a.field, a.value]), [['tax', '5547259']]);
});
test('Claude is told which boxes still wait for the client to agree (private ones without their values), and may confirm them one by one or a whole row', async () => {
  const ctx = { sectionId: 'info', recent: [], awaiting: [{ id: 'fname', label: 'First name', value: 'John' }, { id: 'idno', label: 'ID / passport number', private: true, value: '7212095268086' }, { list: 'kids', row: 1, label: 'Children 1' }], privateHeld: { idno: '7212095268086' } };
  const req = AI.buildRequest(idx, ctx, 'auto', 'yes', 'm'), body = JSON.parse(req.messages[0].content);
  assert.deepStrictEqual(body.awaiting_confirmation, [{ id: 'fname', label: 'First name', value: 'John' }, { id: 'idno', label: 'ID / passport number', private: true }, { list: 'kids', row: 1, label: 'Children 1' }]);
  assert.ok(!/7212095268086/.test(JSON.stringify(req)));                                       // the held values stay here
  assert.ok(!('awaiting_confirmation' in JSON.parse(AI.buildRequest(idx, { sectionId: 'info', recent: [] }, 'auto', 'yes', 'm').messages[0].content)));
  assert.ok(/Confirming/.test(AI.SYSTEM) && /EVERY listed box/.test(AI.SYSTEM) && /acknowledgement/.test(AI.SYSTEM));
  const run = (actions, text) => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: text || 'yes', ctx, fetchImpl: reply({ actions }) });
  assert.deepStrictEqual((await run([{ do: 'confirm', field: 'fname' }, { do: 'confirm', field: 'sname' }, { do: 'confirm', list: 'kids', row: 1 }, { do: 'confirm', field: 'nope' }])).actions,
    [{ do: 'confirm', field: 'fname' }, { do: 'confirm', field: 'sname' }, { do: 'confirm', list: 'kids', row: 1 }]);
  /* a private box: a "yes" after a read-back is accepted when no number was read back, or the same number; refused when a different number was read back */
  assert.deepStrictEqual((await run([{ do: 'confirm', field: 'idno' }])).actions, [{ do: 'confirm', field: 'idno' }]);
  assert.deepStrictEqual((await run([{ do: 'confirm', field: 'idno' }], 'so it is 721209 5268086, right?')).actions, [{ do: 'confirm', field: 'idno' }]);
  assert.strictEqual((await run([{ do: 'confirm', field: 'idno' }], 'so it is 721209 5268087, right?')).kind, 'none');
});
test('a line that moves to another section and carries on is described with that section\'s lists, and Claude is told to do the rest of the line', async () => {
  const line = "I'd like to talk about your investment planning. Do you have any investments in place like a tax free? Yes I do. I have an Old Mutual tax free which I'm contributing R3400 per month towards.";
  const body = JSON.parse(AI.buildRequest(idx, { sectionId: 'cover', recent: [] }, 'auto', line, 'm').messages[0].content);
  assert.strictEqual(body.position.section, 'cover');
  assert.ok(body.lists.some(l => l.id === 'inv' && l.section === 'inv'));
  assert.ok(/Never stop after the "section" action/.test(AI.SYSTEM) && /every list of the form/.test(AI.SYSTEM));
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: line, ctx: { sectionId: 'cover', recent: [] },
    fetchImpl: reply({ actions: [{ do: 'section', section: 'inv' }, { do: 'row', list: 'inv', values: { type: 'Tax-free savings', prov: 'Old Mutual', prem: '3400' } }] }) });
  assert.deepStrictEqual(r.actions.map(a => a.do), ['section', 'row']);
  assert.deepStrictEqual(r.actions[1].values, { type: 'Tax-free savings', prov: 'Old Mutual', prem: '3400' });
});
test('a note from the page says what it already did for the line, so a second look at the same line does not move again', () => {
  const body = JSON.parse(AI.buildRequest(idx, { sectionId: 'inv', recent: [], note: 'The page has already moved to the section "Investments" because of this line.' }, 'auto', 'long line', 'm').messages[0].content);
  assert.ok(/already moved/.test(body.note) && body.position.section === 'inv');
  assert.ok(!('note' in JSON.parse(AI.buildRequest(idx, { sectionId: 'inv', recent: [] }, 'auto', 'x', 'm').messages[0].content)));
  assert.ok(/"note"/.test(AI.SYSTEM));
});
test('Claude can hand back the points for the notes box; a held-back number is put back on this computer, and an empty note is ignored', async () => {
  assert.ok(/Notes\. "let me take some notes"/.test(AI.SYSTEM) && /Never stop at the notes command/.test(AI.SYSTEM) && /"do":"note"/.test(AI.SYSTEM));
  const run = (actions, text) => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: text || 'x', ctx: { sectionId: 'inv', recent: [] }, fetchImpl: reply({ actions }) });
  const r = await run([{ do: 'cmd', cmd: 'notes' }, { do: 'note', text: "- Old Mutual tax free: for his son's university fees\n- To be used when he turns 18" }]);
  assert.deepStrictEqual(r.actions, [{ do: 'cmd', cmd: { type: 'notes', retro: false, box: null } }, { do: 'note', text: "- Old Mutual tax free: for his son's university fees\n- To be used when he turns 18", ready: true }]);
  const withNumber = await run([{ do: 'note', text: '- Spouse cell [N1], calls in the morning' }], 'make a note, his wife is on 082 555 0148, calls in the morning');
  assert.strictEqual(withNumber.actions[0].text, '- Spouse cell 082 555 0148, calls in the morning');
  assert.strictEqual((await run([{ do: 'note', text: '   ' }, { do: 'note' }, { do: 'note', text: 5 }])).kind, 'none');
});

test('with a key the unchanging part of the request (instructions, sections, boxes) is marked to be remembered, and the two pieces say the same as the plain request', async () => {
  const sent = [];
  const fetchImpl = (url, o) => { sent.push(JSON.parse(o.body)); return reply({ actions: [{ do: 'fill', field: 'consent', value: 'Yes' }] })(); };
  const ctx = { sectionId: 'info', recent: [{ who: 'unclear', text: 'hello' }], filled: {}, filledPrivate: [], listRows: () => [] };
  const prep = AI.prepare(idx, ctx, 'auto', 'My ID is 8104120195088. Is that fine? Yes, I am happy for you to record this', 'm');
  const r = await AI.decide({ apiKey: 'k', fetchImpl, idx, who: 'auto', text: 'My ID is 8104120195088. Is that fine? Yes, I am happy for you to record this', ctx, model: 'm' });
  assert.strictEqual(r.kind, 'actions');
  const blocks = sent[0].messages[0].content;
  assert.strictEqual(blocks.length, 2);
  assert.deepStrictEqual(blocks[0].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.ok(!('cache_control' in blocks[1]));
  const a = JSON.parse(blocks[0].text), b = JSON.parse(blocks[1].text);
  assert.deepStrictEqual(Object.assign({}, a, b), JSON.parse(prep.req.messages[0].content));      // nothing lost, nothing added
  assert.ok(a.fields.length > 100 && a.sections.length > 5 && !('position' in a));
  assert.ok(b.newest && b.position && !('fields' in b));
  assert.ok(!/8104120195088/.test(JSON.stringify(sent[0])), 'the ID number is never sent');
  assert.strictEqual(sent[0].system, AI.SYSTEM);
  assert.ok(/two parts/.test(AI.SYSTEM));
});
test('a host without a key (the practice page) gets the plain request as one piece of text', async () => {
  let got = null;
  await AI.decide({ ask: (system, user) => { got = [system, user]; return Promise.resolve(JSON.stringify({ actions: [] })); }, idx, who: 'auto', text: 'okay', ctx: { sectionId: 'info', recent: [], listRows: () => [] }, model: 'm' });
  assert.strictEqual(typeof got[1], 'string');
  assert.ok(JSON.parse(got[1]).fields.length > 100);
});

test('voice requests ask for low effort, so the model does not spend seconds thinking before a short JSON answer', async () => {
  const sent = [];
  const fetchImpl = (url, o) => { sent.push(JSON.parse(o.body)); return reply({ actions: [] })(); };
  const ctx = { sectionId: 'info', recent: [], filled: {}, filledPrivate: [], listRows: () => [] };
  await AI.decide({ apiKey: 'k', fetchImpl, idx, who: 'auto', text: 'okay thanks', ctx, model: 'm' });
  await AI.points({ apiKey: 'k', fetchImpl: (u, o) => { sent.push(JSON.parse(o.body)); return reply({ points: [] })(); }, model: 'm', text: 'he smokes', topic: 'Health' });
  assert.strictEqual(sent.length, 2);
  sent.forEach(r => { assert.deepStrictEqual(r.output_config, { effort: 'low' }); assert.ok(!('thinking' in r) && !('temperature' in r)); });
});

test('thinking is switched off where the model allows it, and left out where it does not', async () => {
  const sent = [];
  const fetchImpl = (url, o) => { sent.push(JSON.parse(o.body)); return reply({ actions: [] })(); };
  const ctx = { sectionId: 'info', recent: [], filled: {}, filledPrivate: [], listRows: () => [] };
  for (const model of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) await AI.decide({ apiKey: 'k', fetchImpl, idx, who: 'auto', text: 'okay thanks', ctx, model });
  assert.deepStrictEqual(sent[0].thinking, { type: 'disabled' });
  assert.deepStrictEqual(sent[1].thinking, { type: 'between_tools' });
  assert.ok(!('thinking' in sent[2]), 'Opus 5.5 cannot switch thinking off');
  sent.forEach(r => assert.deepStrictEqual(r.output_config, { effort: 'low' }));
});
test('if the model refuses the thinking setting the same request is sent again without it', async () => {
  const sent = [];
  const fetchImpl = (url, o) => {
    const b = JSON.parse(o.body); sent.push(b);
    return b.thinking ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: { message: 'thinking.type: between_tools is not supported' } }) }) : reply({ actions: [{ do: 'wait' }] })();
  };
  const r = await AI.decide({ apiKey: 'k', fetchImpl, idx, who: 'auto', text: 'no that is wrong', ctx: { sectionId: 'info', recent: [], filled: {}, filledPrivate: [], listRows: () => [] }, model: 'claude-sonnet-5-5' });
  assert.strictEqual(sent.length, 2); assert.ok(sent[0].thinking && !sent[1].thinking);
  assert.strictEqual(r.kind, 'actions');
  let n = 0;
  await assert.rejects(AI.decide({ apiKey: 'k', fetchImpl: () => { n++; return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'bad key' } }) }); }, idx, who: 'auto', text: 'x y z', ctx: { sectionId: 'info', recent: [], filled: {}, filledPrivate: [], listRows: () => [] }, model: 'claude-sonnet-5-5' }), /API key/);
  assert.strictEqual(n, 1, 'another kind of error is not retried');
});
test('the warm-up asks for nothing back, and has the same remembered part as a real line', async () => {
  const sent = [];
  const fetchImpl = (url, o) => { sent.push(JSON.parse(o.body)); return reply({})(); };
  const ctx = { sectionId: 'kids', recent: [{ who: 'unclear', text: 'hello' }], filled: { fname: 'John' }, filledPrivate: [], listRows: () => [] };
  assert.strictEqual(await AI.warm({ apiKey: 'k', fetchImpl, idx, model: 'claude-haiku-5-5' }), true);
  await AI.decide({ apiKey: 'k', fetchImpl, idx, who: 'auto', text: 'My first name is John', ctx, model: 'claude-haiku-5-5' });
  const w = sent[0], d = sent[1];
  assert.strictEqual(w.max_tokens, 0);
  assert.strictEqual(w.messages[0].content[0].text, d.messages[0].content[0].text);                 // the same bytes in the part that is remembered
  assert.deepStrictEqual(w.messages[0].content[0].cache_control, d.messages[0].content[0].cache_control);
  assert.strictEqual(w.system, d.system); assert.deepStrictEqual(w.thinking, d.thinking); assert.deepStrictEqual(w.output_config, d.output_config); assert.strictEqual(w.model, d.model);
  assert.strictEqual(await AI.warm({ apiKey: '', idx, model: 'm' }), false);
  assert.strictEqual(await AI.warm({ apiKey: 'k', fetchImpl: () => Promise.reject(new Error('offline')), idx, model: 'm' }), false, 'a failed warm-up is silent');
});
test('a clear answer put on the form at once is kept when Claude agrees, and taken back when Claude reads it differently', () => {
  const local = [{ do: 'ask', field: 'consent' }, { do: 'fill', field: 'consent', res: { kind: 'fill', value: 'Yes', status: 'heard' } }];
  let r = AI.reconcile(local, [{ do: 'ask', field: 'consent' }, { do: 'fill', field: 'consent', value: 'yes' }], idx);
  assert.strictEqual(r.agree, true); assert.deepStrictEqual(r.rest, [{ do: 'ask', field: 'consent' }], 'the fill is already done');
  r = AI.reconcile(local, [{ do: 'fill', field: 'consent', value: 'Yes' }, { do: 'fill', field: 'fname', value: 'John' }], idx);
  assert.strictEqual(r.agree, true); assert.deepStrictEqual(r.rest, [{ do: 'fill', field: 'fname', value: 'John' }], 'something more that Claude heard is still done');
  r = AI.reconcile(local, [{ do: 'fill', field: 'consent', value: 'No' }], idx);
  assert.strictEqual(r.agree, false); assert.strictEqual(r.rest.length, 1);
  r = AI.reconcile(local, [], idx);
  assert.strictEqual(r.agree, true, 'Claude has nothing to say about the box: what was heard stays (it is taken back only when Claude disagrees)');
  assert.deepStrictEqual(AI.reconcile(local, [{ do: 'ask', field: 'consent' }], idx), { agree: true, rest: [{ do: 'ask', field: 'consent' }] });
  const cellMine = [{ do: 'fill', field: 'cell', res: { kind: 'fill', value: '082 555 0148', status: 'verify' } }];
  assert.strictEqual(AI.reconcile(cellMine, [{ do: 'fill', field: 'work', value: '0825550148' }], idx).agree, false, 'the same number put in another box is a disagreement');
  assert.strictEqual(AI.reconcile(cellMine, [{ do: 'fill', field: 'work', value: '011 555 0000' }], idx).agree, true, 'a different number for another box is not');
  const two = [{ do: 'fill', field: 'fname', res: { kind: 'fill', value: 'John', status: 'verify', extra: [{ id: 'sname', value: 'Snow', status: 'verify' }] } }];
  assert.strictEqual(AI.reconcile(two, [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'fill', field: 'sname', value: 'Snow' }], idx).agree, true);
  assert.strictEqual(AI.reconcile(two, [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'fill', field: 'sname', value: 'Snowden' }], idx).agree, false);
  assert.strictEqual(AI.reconcile([{ do: 'fill', field: 'cell', res: { kind: 'fill', value: '082 555 0148', status: 'verify' } }], [{ do: 'fill', field: 'cell', value: '0825550148' }], idx).agree, true, 'spaces do not matter');
});
test('sharing on: private numbers go out as they are and Claude fills them itself (off by default)', () => {
  assert.strictEqual(AI.sharing(), false, 'off by default');
  const line = 'my cell number is 082 454 1751 and my ID is 7212095268086';
  const base = { sectionId: 'info', recent: [{ who: 'adviser', text: 'is your cell 082 454 1751?' }], listRows: () => [], filled: { fname: 'Paul' }, awaiting: [] };
  const off = AI.prepare(idx, base, 'auto', line, 'claude-haiku-5-5');
  assert.ok(!/082 454 1751|7212095268086/.test(JSON.stringify(off.req)), 'off: the digits do not go out');
  assert.ok(/\[N1\]/.test(off.parts[1]) && !/SHARING IS ON/.test(off.req.system));
  AI.setShare(true);
  try {
    assert.strictEqual(AI.sharing(), true);
    const on = AI.prepare(idx, base, 'auto', line, 'claude-haiku-5-5');
    assert.ok(on.parts[1].indexOf('082 454 1751') > 0 && on.parts[1].indexOf('7212095268086') > 0, 'on: the digits go out in the line');
    assert.ok(!/\[N1\]/.test(on.parts[1]) && /SHARING IS ON/.test(on.req.system), 'no markers, and the instructions say so');
    assert.ok(!/"private":true/.test(JSON.stringify(on.req)), 'no box is marked private');
    assert.ok(on.parts[1].indexOf('is your cell 082 454 1751?') > 0, 'the earlier lines are not scrubbed');
    const r = AI.normalize({ actions: [{ do: 'fill', field: 'cell', value: '082 454 1751' }, { do: 'fill', field: 'idno', value: '7212095268086', correction: true }, { do: 'fill', field: 'wemail', value: 'paul@example.co.za' }, { do: 'confirm', field: 'tax' }] }, idx, 'auto', on.vault);
    assert.deepStrictEqual(r.actions.map(a => a.do + ':' + a.field + (a.value ? '=' + a.value : '')), ['fill:cell=082 454 1751', 'fill:idno=7212095268086', 'fill:wemail=paul@example.co.za', 'confirm:tax']);
    assert.strictEqual(AI.scrub('call 082 454 1751'), 'call 082 454 1751', 'nothing is scrubbed while sharing');
  } finally { AI.setShare(false); }
  assert.strictEqual(AI.normalize({ actions: [{ do: 'fill', field: 'cell', value: '082 454 1751' }] }, idx, 'auto', { _sent: 'hello', _line: 'hello' }).kind, 'none', 'off again: digits Claude was never shown are refused');
});

test('Claude saying wait takes back what the page put in for a line that was only the start of a thought', () => {
  const mine = [{ do: 'fill', field: 'sname', res: { kind: 'fill', value: 'Spelled', status: 'heard' } }];
  const r = AI.reconcile(mine, [{ do: 'wait' }], idx);
  assert.strictEqual(r.agree, false);
  assert.deepStrictEqual(r.rest, [{ do: 'wait' }]);
  assert.strictEqual(AI.reconcile([], [{ do: 'wait' }], idx).agree, true, 'nothing was put in, so there is nothing to take back');
  assert.strictEqual(AI.reconcile(mine, [], idx).agree, true, 'silence still keeps what was heard');
});
test('the instructions tell Claude that speech comes in fragments and how to read them', () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: 'sname', recent: [{ who: 'adviser', text: 'what is your surname' }], listRows: () => [] }, 'auto', 'Kafentzis', 'm');
  assert.match(req.system, /Fragments/);
  assert.match(req.system, /my surname is spelled/);
  assert.match(req.system, /even if it is a single word/);
  const body = JSON.parse(req.messages[0].content);
  assert.strictEqual(body.newest.text, 'Kafentzis');
  assert.deepStrictEqual(body.recent.map(l => l.text), ['what is your surname'], 'the lines before it go with it');
  assert.strictEqual(body.position.field, 'sname');
});
test('the instructions say a read-back is not agreement, that undo and clear need words, and that remarks about the software ask for nothing', () => {
  const req = AI.buildRequest(idx, { sectionId: 'info', targetId: 'sname', recent: [], listRows: () => [] }, 'auto', 'I just want to confirm you said R150 000 correct', 'm');
  assert.match(req.system, /A read-back is NOT agreement/);
  assert.match(req.system, /The client agrees in a LATER line/);
  assert.match(req.system, /Only give "undo" or "clear" when the newest line asks for it in words/);
  assert.match(req.system, /Remarks about the form or the software itself/);
  assert.match(req.system, /Start the notes only when someone says they want to take/);
  assert.match(req.system, /never to the client's own boxes/);
  assert.match(req.system, /confirms only what the line just before it/);
  assert.match(req.system, /is an echo, not agreement/);
  assert.match(req.system, /Being addressed by name/);
  assert.match(req.system, /"I know" is often "no"/);
});
test('an empty value for one box means the box is to be emptied, and unknown boxes are ignored', () => {
  const run = actions => AI.normalize({ actions }, idx, 'auto', { _line: '', _sent: '', _held: {} });
  assert.deepStrictEqual(run([{ do: 'fill', field: 'sname', value: '' }]).actions, [{ do: 'empty', field: 'sname' }]);
  assert.deepStrictEqual(run([{ do: 'empty', field: 'fname' }]).actions, [{ do: 'empty', field: 'fname' }]);
  assert.deepStrictEqual(run([{ do: 'cell', list: 'shares', row: 1, col: 'name', value: '' }]).actions, [{ do: 'empty', list: 'shares', row: 1, col: 'name' }]);
  assert.deepStrictEqual(run([{ do: 'empty', list: 'shares', row: 'last', col: 'name' }]).actions, [{ do: 'empty', list: 'shares', row: 'last', col: 'name' }]);
  assert.strictEqual(run([{ do: 'fill', field: '', value: '' }]).kind, 'none');
  assert.strictEqual(run([{ do: 'fill', field: 'shares', value: '' }]).kind, 'none');
  assert.deepStrictEqual(run([{ do: 'fill', field: 'shares.name', value: '' }]).actions, [{ do: 'empty', list: 'shares', row: 'last', col: 'name' }]);
});
test('an amount in the past tense is not taken as the current figure', () => {
  assert.match(AI.SYSTEM, /"I used to put about 2000 a month" is the old figure/);
});
test('the client saying in a statement that a box is correct is agreement', () => {
  assert.match(AI.SYSTEM, /my personal email address is also correct/);
  assert.match(AI.SYSTEM, /IS agreement: confirm the box it names/);
});
test('"delete that" and "we need to delete that" are clear requests for the box being talked about', () => {
  assert.match(AI.SYSTEM, /"delete that", "remove it" and "we need to delete that" are clear/);
  assert.match(AI.SYSTEM, /"clear that", "delete that", "delete the \.\.\."/);
});

test('what else the speech recogniser thought it heard goes to Claude as text, with numbers and addresses hidden, and the instructions explain it', () => {
  const ctx = { sectionId: 'info', targetId: 'sname', targetValue: '', recent: [], alternatives: ['my surname is offenses', 'my surname is 082 454 1751 or paul at gmail dot com', 'a third one'] };
  const body = JSON.parse(AI.buildRequest(idx, ctx, 'auto', 'my surname is offensive', 'm').messages[0].content);
  assert.deepStrictEqual(body.heard_alternatives, ['my surname is offenses', 'my surname is [number] or [email]']);          // two at most, nothing private
  assert.strictEqual(body.newest.text, 'my surname is offensive');
  assert.ok(!JSON.stringify(body).includes('082 454'));
  const none = JSON.parse(AI.buildRequest(idx, { sectionId: 'info', recent: [] }, 'auto', 'hello', 'm').messages[0].content);
  assert.strictEqual(none.heard_alternatives, undefined);
  assert.match(AI.SYSTEM, /"heard_alternatives"/);
  assert.match(AI.SYSTEM, /"confesses" or "offenses" for Kafentzis/);
});

test('facts Claude had no box for come back as "unplaced", with markers swapped for the real values and only real sections kept', async () => {
  const sent = AI.shield('my bond is with [N1]');
  const raw = { actions: [{ do: 'ask', field: 'occ' }], unplaced: [{ text: 'Has a boat loan of R180 000 with Wesbank', section: 'debts' }, { text: 'Policy number [N1]', section: 'nowhere' }, 'Plans to emigrate in 2028', { text: 'ab' }, { section: 'debts' }, 42] };
  const r = AI.normalize(raw, idx, 'auto', { N1: '0825550148' });
  assert.strictEqual(r.kind, 'actions');
  assert.deepStrictEqual(r.unplaced, [
    { text: 'Has a boat loan of R180 000 with Wesbank', section: 'debts' },
    { text: 'Policy number 0825550148', section: null },
    { text: 'Plans to emigrate in 2028', section: null }
  ]);
  assert.deepStrictEqual(AI.normalize({ actions: [], unplaced: [{ text: 'She also owns a small farm', section: 'info' }] }, idx, 'auto', {}), { kind: 'none', unplaced: [{ text: 'She also owns a small farm', section: 'info' }] });
  assert.deepStrictEqual(AI.normalize({ actions: [{ do: 'ask', field: 'occ' }] }, idx, 'auto', {}), { kind: 'actions', actions: [{ do: 'ask', field: 'occ' }] });   // nothing unplaced: the answer keeps its old shape
  assert.strictEqual(AI.normalize({ actions: [], unplaced: new Array(20).fill({ text: 'a fact to keep' }) }, idx, 'auto', {}).unplaced.length, 6);
  assert.ok(/unplaced/.test(AI.SYSTEM) && /Never put in "unplaced" small talk/.test(AI.SYSTEM));
  void sent;
});

test('the catch-up request holds the conversation and the form, and nothing private', () => {
  const req = AI.sweepRequest({ idx, model: 'claude-sonnet-5-5', focus: 'info',
    transcript: [{ who: 'adviser', text: 'what is your cell number?' }, { who: 'client', text: 'it is 082 555 0148 and my email is vicky@example.com' }, { who: 'unlabelled', text: 'I earn R85 000 a month' }],
    filled: { fname: 'Vicky', cell: '0825550148', gross: 'R 85 000.00' }, listRows: () => [] });
  const s = JSON.stringify(req), body = JSON.parse(req.messages[0].content);
  assert.ok(!/0825550148|082 555|vicky@example/.test(s), 'private values left the computer');
  assert.ok(s.includes('[number]') && s.includes('[email]'));
  assert.strictEqual(body.focus, 'info');
  assert.deepStrictEqual(body.transcript.map(l => l.who), ['adviser', 'client', 'unclear']);
  ['idno', 'cell', 'work', 'home', 'pemail', 'wemail', 'sp_tel', 'tax'].forEach(id => assert.ok(!body.fields.some(f => f.id === id), id + ' is private and not listed'));
  assert.ok(!('cell' in body.filled) && body.filled.fname === 'Vicky');
  assert.ok(body.fields.some(f => f.id === 'gross') && body.lists.some(l => l.id === 'kids'));
  assert.strictEqual(req.model, 'claude-sonnet-5-5');
  assert.ok(/EMPTY now/.test(req.system) && /Never fill a box that already has a value/.test(req.system));
});

test('the catch-up check returns fills, rows and unplaced facts through the same safe reading as a live line', async () => {
  let asked = null;
  const fetchImpl = (url, init) => { asked = JSON.parse(init.body); return reply({ actions: [
    { do: 'fill', field: 'occ', value: 'Nurse' }, { do: 'fill', field: 'cell', value: '0825550148' }, { do: 'fill', field: 'nonsense', value: 'x' },
    { do: 'cell', list: 'kids', row: 1, col: 'dob', value: '2019-08-22' }, { do: 'row', list: 'kids', values: { name: 'Ben', nonsense: 'x' } }, { do: 'cmd', cmd: 'clearAll' }
  ], unplaced: [{ text: 'Wants to retire at 60', section: 'income' }] })(); };
  const r = await AI.sweep({ apiKey: 'k', fetchImpl, idx, model: 'claude-sonnet-5-5', transcript: [{ who: 'client', text: 'I am a nurse' }], filled: {}, listRows: () => [] });
  assert.strictEqual(r.kind, 'actions');
  assert.ok(r.actions.some(a => a.do === 'fill' && a.field === 'occ' && a.value === 'Nurse'));
  assert.ok(!r.actions.some(a => a.field === 'cell' || a.field === 'nonsense'), 'a private box or an unknown box got through');
  assert.deepStrictEqual(r.actions.find(a => a.do === 'row'), { do: 'row', list: 'kids', values: { name: 'Ben' } });
  assert.deepStrictEqual(r.unplaced, [{ text: 'Wants to retire at 60', section: 'income' }]);
  assert.strictEqual(asked.max_tokens, 6000);
  assert.ok(/Fact Find form against the conversation/.test(asked.system));
});

test('a reply with a second, corrected answer is read from its last complete answer', () => {
  const two = '{"actions":[{"do":"fill","field":"risk.prov","value":"Liberty"}]}\n\nWait \u2014 correcting to the proper list action:\n\n{"actions":[{"do":"cell","list":"risk","row":1,"col":"prov","value":"Liberty"}]}';
  assert.deepStrictEqual(AI.extractJson(two), { actions: [{ do: 'cell', list: 'risk', row: 1, col: 'prov', value: 'Liberty' }] });
  const talk = '{"actions":[{"do":"fill","field":"marital","value":"Married in community of property"}]}  Wait, the client only said "I\'m married" and did not say how. Corrected: {"actions":[{"do":"ask","field":"marital"}]} and nothing else {braces} here';
  assert.deepStrictEqual(AI.extractJson(talk), { actions: [{ do: 'ask', field: 'marital' }] });
  assert.deepStrictEqual(AI.extractJson('Here you go: {"actions": []}'), { actions: [] });
  assert.deepStrictEqual(AI.extractJson('{"actions":[{"do":"note","text":"a } b"}]} trailing'), { actions: [{ do: 'note', text: 'a } b' }] });
  assert.strictEqual(AI.extractJson('no json at all'), null);
});

test('a box of a list written as a plain box is still read as that list box', () => {
  const run = actions => AI.normalize({ actions }, idx, 'auto', { _line: '', _sent: '', _held: {} }).actions;
  assert.deepStrictEqual(run([{ do: 'fill', list: 'debts', row: 1, col: 'prov', value: 'ABSA' }]), [{ do: 'cell', list: 'debts', row: 1, col: 'prov', value: 'ABSA', explicit: false }]);
  assert.deepStrictEqual(run([{ do: 'fill', field: 'debts.prov', value: 'ABSA' }]), [{ do: 'cell', list: 'debts', row: 'last', col: 'prov', value: 'ABSA', explicit: false }]);
  assert.deepStrictEqual(run([{ do: 'fill', field: 'risk.prov', value: 'Liberty', correction: true }]), [{ do: 'cell', list: 'risk', row: 'last', col: 'prov', value: 'Liberty', explicit: true }]);
  assert.deepStrictEqual(run([{ do: 'ask', field: 'debts.desc' }]), [{ do: 'ask', list: 'debts', row: 'last', col: 'desc' }]);
  assert.deepStrictEqual(run([{ do: 'fill', field: 'shares.id', value: '8001015800087' }]), undefined);                 // a private column still takes only a marker
  assert.deepStrictEqual(run([{ do: 'fill', field: 'nope.prov', value: 'x' }]), undefined);
});

test('the prompt says: one answer only, list boxes by "cell", calculated figures are not facts, and what is left over is not the expenses', () => {
  assert.ok(/never a second object/.test(AI.SYSTEM));
  assert.ok(/only ever filled with a "cell" action/.test(AI.SYSTEM));
  assert.ok(/Direct Net Income" \(dnet\)/.test(AI.SYSTEM) && /not the take-home pay/.test(AI.SYSTEM));
  assert.ok(/left with 90 000 after all my expenses/.test(AI.SYSTEM) && /net minus that amount/.test(AI.SYSTEM));
});

test('a slow answer is raced by a second request and the first answer back is used; without hedging nothing is sent twice', async () => {
  let calls = 0;
  const slowThenFast = () => { const n = ++calls; return new Promise(r => setTimeout(() => r({ ok: true, status: 200, json: () => Promise.resolve({ content: [{ type: 'text', text: JSON.stringify({ actions: [{ do: 'ask', field: 'occ' }] }) }] }) }), n === 1 ? 600 : 20)); };
  const t0 = Date.now();
  const r = await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', hedgeMs: 80, ctx: { sectionId: 'occ', recent: [] }, fetchImpl: slowThenFast });
  assert.strictEqual(r.kind, 'actions'); assert.strictEqual(calls, 2); assert.ok(Date.now() - t0 < 400, 'waited for the slow one');
  calls = 0;
  await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', hedgeMs: 500, ctx: { sectionId: 'occ', recent: [] }, fetchImpl: () => { calls++; return reply({ actions: [] })(); } });
  assert.strictEqual(calls, 1, 'a quick answer sends no second request');
  calls = 0;
  await AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', ctx: { sectionId: 'occ', recent: [] }, fetchImpl: slowThenFast });
  assert.strictEqual(calls, 1, 'no hedging unless asked for');
  await assert.rejects(() => AI.decide({ apiKey: 'k', model: 'm', idx, who: 'auto', text: 'x', hedgeMs: 20, ctx: { sectionId: 'occ', recent: [] }, fetchImpl: () => Promise.reject(new Error('down')) }), /no connection/);
});

test('the catch-up request carries the notes and the facts already offered, and tells the model not to repeat them', () => {
  const req = AI.sweepRequest({ idx, model: 'claude-sonnet-5-5', focus: null, transcript: [{ who: 'client', text: 'I have gout' }], filled: {}, listRows: () => [],
    notes: { health: '- Has gout' }, listed: ['Blood pressure 140 over 180'] });
  const body = JSON.parse(req.messages[0].content);
  assert.deepStrictEqual(body.notes, { health: '- Has gout' });
  assert.deepStrictEqual(body.listed, ['Blood pressure 140 over 180']);
  assert.ok(/already in "notes" or in "listed" is never reported again/.test(req.system));
  assert.ok(/net minus that amount/.test(req.system));
});
