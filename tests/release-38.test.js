/* Release 3.8: the faults of a recorded meeting (client Sasson, 12 November 2026), with invented names. A "heard but not placed" note that said only three of five children were on the form went on telling the
   action points to ask for the other two after all five were added; a remark about what the client would do ("will reply by email when the quotes are sent") became a task for the assistant; small talk and a sentence
   that broke off were noted; life-cover words went into the Will notes; and a copy of the form that loaded old scripts from a backup folder ran for most of a day with nobody knowing. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const AI = require('../app/js/voice-ai.js');
const V = require('../app/js/voice.js');
const B = require('../app/js/build.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const kids = (s, n) => { for (let i = 0; i < n; i++) store.addRow(s, 'kids', { name: 'Child' + i, sname: 'Test', gender: 'Female', dob: '01/01/2018' }); };

test('the version is 3.8', () => { assert.strictEqual(schema.version, '3.8'); });

/* ---------- 1. a note the form now covers ---------- */
test('"five children in total; only three are on the form so far" is covered once the five children are on the form', () => {
  const s = fresh(); kids(s, 3);
  const u = store.addUnplaced(s, { text: 'The client has five children in total; only three are on the form so far', sec: 'kids' });
  assert.strictEqual(store.unplacedCovered(s, u), false, 'three of five: still missing, not covered');
  assert.ok(A.facts(s).notes.some(n => /five children/.test(n.note)), 'then Claude is told');
  kids(s, 2);
  assert.strictEqual(store.unplacedCovered(s, u), true);
  assert.ok(!A.facts(s).notes.some(n => /five children/.test(n.note)), 'five children on the form: the note is not sent to Claude');
  assert.strictEqual(store.closeCovered(s, {}), 1); assert.strictEqual(s.unplaced.length, 0, 'and it is closed, so the list says so');
});
test('words and digits, and a note that is not about children missing, are not treated as covered', () => {
  const s = fresh(); kids(s, 4);
  assert.strictEqual(store.unplacedCovered(s, { text: '4 children, only 2 on the form' }), true);
  assert.strictEqual(store.unplacedCovered(s, { text: 'The eldest of the five children is at university' }), false, 'no shortfall words: left alone');
  assert.strictEqual(store.unplacedCovered(s, { text: 'Client has six children, only four so far on the form' }), false, 'six wanted, four there');
  assert.strictEqual(store.unplacedCovered(s, { text: 'Spouse works' }), false);
});
test('a note that names a box which holds that very value now is covered; one that disagrees is kept', () => {
  const s = fresh(); set(s, 'gender', 'Female');
  assert.strictEqual(store.unplacedCovered(s, { text: 'Gender: Female', field: 'gender', value: 'Female' }), true);
  assert.strictEqual(store.unplacedCovered(s, { text: 'Gender: Male', field: 'gender', value: 'Male' }), false, 'a conflict is for the adviser');
});

/* ---------- 2. what the form holds right now goes to Claude ---------- */
test('the facts say how many children, debts and policies the form holds, and who the policies are with (no amounts, no children\'s names)', () => {
  const s = fresh(); kids(s, 5); set(s, 'has_risk', 'Yes'); store.addRow(s, 'risk', { prov: 'BrightRock', spend: 'R 1 607.60' }); store.addRow(s, 'ret_ra', { prov: 'Allan Gray' }); store.addRow(s, 'inv', { type: 'Tax-free savings', prov: 'Absa' });
  const held = A.facts(s).on_the_form_now;
  assert.deepStrictEqual(held['Children'], { count: 5 });
  assert.deepStrictEqual(held['Existing personal risk policies'], { count: 1, held: ['BrightRock'] });
  assert.deepStrictEqual(held['Retirement annuities'], { count: 1, held: ['Allan Gray'] });
  assert.deepStrictEqual(held['Investments'], { count: 1, held: ['Tax-free savings Absa'] });
  assert.ok(!('Debts' in held), 'a list with no rows is not there');
  assert.ok(!/Child0|1 607/.test(JSON.stringify(held)));
  const k1 = A.key(A.facts(s)); kids(s, 1); assert.notStrictEqual(A.key(A.facts(s)), k1, 'a child added makes the points out of date: they are written again');
});
test('Claude is told a note can be older than the form, and what the client or adviser will do is information', () => {
  assert.match(AI.ACTIONS_SYSTEM, /"on_the_form_now"/);
  assert.match(AI.ACTIONS_SYSTEM, /OUT OF DATE when "on_the_form_now" shows it is there/);
  assert.match(AI.ACTIONS_SYSTEM, /Never ask the client for something the form already holds/);
  assert.match(AI.ACTIONS_SYSTEM, /WHAT THE CLIENT OR THE ADVISER WILL DO IS INFORMATION/);
  assert.match(AI.ACTIONS_SYSTEM, /Never add a task nobody asked for/);
});

/* ---------- 3. every point names its source ---------- */
const withNote = () => { const s = fresh(); set(s, 'fname', 'Sam'); set(s, 'n_will', 'Client will reply by email when the two quotes are sent\nOffer a will review'); set(s, 'loa', 'Yes'); return s; };
test('a point is kept only when its source is in the form; for a note, the words it quotes must be in that note', () => {
  const f = A.facts(withNote());
  const why = p => AI.pointSourceWhy(p, f);
  assert.strictEqual(why({ text: 'x', from: 'loa' }), '');
  assert.strictEqual(why({ text: 'x', from: 'appointment' }), '');
  assert.strictEqual(why({ text: 'x', from: 'n_will', said: 'Offer a will review' }), '', 'quoted from the note');
  assert.strictEqual(why({ text: 'x', from: 'note:n_will', said: 'offer a WILL review' }), '', 'a "note:" prefix, letters and spacing do not matter');
  assert.match(why({ text: 'x', from: 'n_will', said: 'send the client both quotes' }), /not in that note/);
  assert.match(why({ text: 'x', from: 'n_will' }), /does not quote/);
  assert.match(why({ text: 'x', from: 'n_nowhere', said: 'Offer a will review' }), /not in the form/);
  assert.match(why({ text: 'x', from: 'quotes' }), /holds nothing/, 'no quote asked for: "quotes" is no source');
  assert.match(why({ text: 'x' }), /no source/); assert.match(why('a plain string'), /no source/); assert.match(why(null), /no source/);
});
test('Claude\'s points without a source, with a source that is not there, or with words that are not in the note are removed, and named', async () => {
  const f = A.facts(withNote());
  const reply = { points: [
    { text: 'Send the client Sam the letter of authority to sign.', from: 'loa' },
    { text: 'Offer to arrange a will review for the client Sam.', from: 'n_will', said: 'Offer a will review' },
    { text: 'Send the client Sam the two life insurance quotes and await his email reply.', from: 'n_will', said: 'Send the two quotes and wait for the reply' },
    { text: 'Ask the client Sam for his children\'s details.' },
    'A bare string',
    { text: 'Set up a follow-up appointment with the client Sam.', from: 'appointment' }], notes: [{ id: 'n_will', status: 'action' }] };
  const r = await AI.actionPointsFull({ ask: () => Promise.resolve(JSON.stringify(reply)), model: 'm', facts: f });
  assert.deepStrictEqual(r.points, ['Send the client Sam the letter of authority to sign.', 'Offer to arrange a will review for the client Sam.', 'Set up a follow-up appointment with the client Sam.']);
  assert.strictEqual(r.dropped.length, 3);
  assert.match(r.dropped[0].why, /not in that note/); assert.match(r.dropped[1].why, /no source/); assert.match(r.dropped[2].why, /no source/);
  assert.deepStrictEqual(r.sources.map(x => x.from), ['loa', 'n_will', 'appointment']);
  assert.strictEqual(r.sources[1].said, 'Offer a will review');
});
test('the request asks for sources and shows Claude what the form holds', async () => {
  const s = withNote(); kids(s, 5);
  let sent = null;
  await AI.actionPointsFull({ ask: (system, content) => { sent = { system, body: JSON.parse(content) }; return Promise.resolve('{"points": []}'); }, model: 'm', facts: A.facts(s) });
  assert.deepStrictEqual(sent.body.facts.on_the_form_now.Children, { count: 5 });
  assert.match(sent.system, /EVERY POINT NAMES ITS SOURCE/); assert.match(sent.system, /"from"/); assert.match(sent.system, /copied EXACTLY from that note/);
});

/* ---------- 4. small talk, broken-off sentences, and life cover in the wrong notes ---------- */
test('small talk and a sentence that broke off are not noted', () => {
  ['All right then, fantastic', 'All right then, fantastic.', 'Okay, perfect', 'Alex, when can you', 'Above and beyond it, I want to know', 'Client asked about the', '- Fantastic', ''].forEach(t => assert.ok(V.isNoteJunk(t), t));
  ['Client unsure of a comfortable monthly premium spend for life cover', 'Paul to email Cameron and CC the client', 'Wants to know the cost.', 'Client will check with his bank'].forEach(t => assert.ok(!V.isNoteJunk(t), t));
});
test('life cover said in the Will, Medical aid, Gap cover or Short-term notes is filed with the notes of Client priorities', () => {
  const line = 'Client will reply by email when the two life insurance quotes are sent';
  ['n_will', 'n_ma', 'n_gap', 'n_sti'].forEach(b => assert.strictEqual(V.noteBoxFor(line, b), 'n_prio', b));
  assert.strictEqual(V.noteBoxFor('Offer a will review', 'n_will'), 'n_will', 'a will remark stays');
  assert.strictEqual(V.noteBoxFor('Wants BrightRock dread disease cover', 'n_sti'), 'n_prio');
  assert.strictEqual(V.noteBoxFor(line, 'n_income'), 'n_income', 'only the boxes that are about something else are moved');
});

/* ---------- 5. the copy check ---------- */
test('a copy whose files all come from its own folder, with the build it says, is whole', () => {
  const page = 'file:///C:/Users/Paul/OneDrive/WR%20Fact%20Find/index.html';
  const own = ['js/util.js?v=1', 'js/schema.js?v=2', 'css/app.css?v=3'].map(x => 'file:///C:/Users/Paul/OneDrive/WR%20Fact%20Find/' + x);
  const r = B.check({ pageUrl: page, urls: own.concat(['data:image/png;base64,AAAA']), meta: schema.version });
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.problems, []); assert.strictEqual(r.files, 3);
  assert.strictEqual(B.BUILD, schema.version, 'the build is the version of the release');
});
test('files loaded from a backup folder next to the copy (what OneDrive did on 13 November) are caught', () => {
  const page = 'file:///C:/Users/Paul/OneDrive/WR%20Fact%20Find/index.html';
  const urls = ['file:///C:/Users/Paul/OneDrive/WR%20Fact%20Find/js/util.js', 'file:///C:/Users/Paul/OneDrive/WR%20Fact%20Find%20-%20before%203.6%20(13%20Nov%202026)/js/schema.js?v=1'];
  const r = B.check({ pageUrl: page, urls, meta: schema.version });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.problems.length, 1);
  assert.match(r.problems[0], /another folder: file:\/\/\/C:\/Users\/Paul\/OneDrive\/WR Fact Find - before 3\.6 \(13 Nov 2026\)\/js\/schema\.js$/);
  assert.strictEqual(B.check({ pageUrl: 'https://x.github.io/app/index.html', urls: ['https://x.github.io/app/js/a.js', 'https://cdn.example.com/b.js'], meta: schema.version }).ok, false, 'a script from another site');
});
test('a page of another build, or one that does not say, is caught', () => {
  const page = 'http://localhost:8080/index.html', urls = ['http://localhost:8080/js/util.js'];
  assert.match(B.check({ pageUrl: page, urls, meta: '3.7' }).problems[0], /page is build 3\.7 but its scripts are build 3\.8/);
  assert.match(B.check({ pageUrl: page, urls, meta: '' }).problems[0], /does not say which build/);
  assert.strictEqual(B.check({ pageUrl: page, urls, meta: '3.8' }).ok, true);
});
test('every page carries the build and the check, and the build is the first script', () => {
  const fs = require('fs'), path = require('path');
  ['index.html', 'capture-sheet.html', 'short-risk.html'].forEach(f => {
    const h = fs.readFileSync(path.join(__dirname, '../app', f), 'utf8');
    assert.ok(h.includes('<meta name="wr-build" content="' + schema.version + '">'), f + ': the build meta');
    assert.ok(h.indexOf('js/build.js') > 0 && h.indexOf('js/build.js') < h.indexOf('vendor/jspdf.umd.min.js'), f + ': build.js first');
    assert.ok(/FF\.build\.run\(u,location\.href,m\)/.test(h), f + ': the check at the foot of the page');
  });
});
