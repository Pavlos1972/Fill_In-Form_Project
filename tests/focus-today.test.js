/* The eight priority areas are numbered 1 to 8; the "Priorities to be Focused on" box lists only the green ones with what is needed; Claude is told today's date in every request. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const AI = require('../app/js/voice-ai.js');
const L = require('../app/js/lookup.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const GO = schema.PRIORITY, NO = schema.NOT_PRIORITY;
const prio = schema.sections.find(x => x.id === 'prio');

test('the eight priority areas are numbered 1 to 8 in the order they appear, and Business assurance has no number', () => {
  const dec = schema.panels.filter(p => p.dec);
  assert.deepStrictEqual(dec.map(p => [p.n, p.id]), [[1, 'life'], [2, 'ra'], [3, 'rgar'], [4, 'inv'], [5, 'egar'], [6, 'med'], [7, 'will'], [8, 'st']]);
  assert.strictEqual(schema.areaTitle(schema.panelsById.life), '1. Personal Risk Covers');
  assert.strictEqual(schema.areaTitle(schema.panelsById.st), '8. Short Term');
  assert.strictEqual(schema.areaTitle(schema.panelsById.biz), 'Business assurance');
  const order = prio.blocks.map(b => b.pri).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  assert.deepStrictEqual(order.filter(x => x !== 'biz'), dec.map(p => p.id), 'the areas are on the page in the order of their numbers');
});

test('the Priorities to be Focused on box is the first thing on the Client priorities page, and is not a voice box', () => {
  const b = prio.blocks[0];
  assert.strictEqual(b.title, 'Priorities to be Focused on'); assert.ok(b.focus && b.fields.length === 1 && b.fields[0].id === 'focus' && b.fields[0].t === 'area' && b.fields[0].opt);
  const idx = V.buildIndex(schema); assert.ok(!idx.byId.focus && !idx.notes.some(n => n.id === 'focus'), 'voice never writes in it');
  assert.strictEqual(fresh().f.focus.v, '', 'empty at first');
});

test('only the green priorities are in it, numbered, in order, each with what is needed', () => {
  const s = fresh(); set(s, 'fname', 'Thandi');
  assert.deepStrictEqual(A.focusFacts(s).areas, []); assert.strictEqual(A.focusLocal(s), '', 'no green priority: the box stays empty');
  set(s, 'pr_st', GO); set(s, 'pr_life', GO); set(s, 'pr_inv', NO); set(s, 'pr_med', schema.UNSURE); set(s, 'pr_will', '');
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'New Business'); set(s, 'ref_sti', 'Cameron to contact client'); set(s, 'ref_med', 'Valerie to contact for both');
  store.addRow(s, 'invq', { req: 'Request a quote', ins: 'Allan Gray', monthly: 'R 5 000.00' });
  set(s, 'pr_life_cm', 'Wants to replace the old Liberty cover.');
  const f = A.focusFacts(s);
  assert.deepStrictEqual(f.areas.map(a => [a.number, a.area]), [[1, 'Personal Risk Covers'], [8, 'Short Term']], 'green only (not the red, the yellow or the undecided), in number order');
  const text = A.focusLocal(s);
  assert.strictEqual(text.split('\n')[0], '1. Personal Risk Covers');
  assert.match(text, /- Request a BrightRock Fractured FNA quote \(New Business\): BR FNA Quote based on Fact Find\./);
  assert.match(text, /- Your note: Wants to replace the old Liberty cover\./);
  assert.match(text, /\n\n8\. Short Term\n- Referral: Cameron to contact the client about short-term insurance\./);
  assert.ok(!/Valerie|Allan Gray|Investment/.test(text), 'the yellow and red areas are never in it');
});

test('the box fills as the client agrees and empties again when no priority is green', () => {
  const s = fresh(); set(s, 'pr_will', GO);
  assert.strictEqual(A.focusLocal(s), '7. Will\n- Nothing asked for yet: decide what to quote or refer.');
  set(s, 'ref_will', 'Capital Legacy to contact client'); assert.match(A.focusLocal(s), /- Referral: Capital Legacy to contact the client about the will\./);
  set(s, 'pr_will', NO); assert.strictEqual(A.focusLocal(s), '');
});

test('schedules and credit life of a green area are in it; those of another area are not', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'pr_life', GO); set(s, 'has_risk', 'Yes'); set(s, 'ps_risk', schema.psClient.risk); set(s, 'has_ra', 'Yes'); set(s, 'ps_ra', schema.psClient.ra);
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', cl: 'Yes' });
  const t = A.focusLocal(s);
  assert.match(t, /Current policy schedules for the personal risk policies: asked for from the client, awaiting the client\./);
  assert.match(t, /Credit life on the home loan with Nedbank: get the details\./);
  assert.ok(!/retirement annuities/.test(t), 'the retirement schedules belong to area 2, which is not green');
});

test('the facts for Claude: green areas only, with the form\'s own wording, and the headings are put in by the form', async () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'pr_life', GO); set(s, 'pr_ra', GO); set(s, 'pr_rgar', GO);
  store.addRow(s, 'raq', { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00' }); set(s, 'rgar_req', 'Request an RGAR'); set(s, 'ret_age', '65');
  const f = A.focusFacts(s); assert.deepStrictEqual(f.areas.map(a => a.number), [1, 2, 3]);
  assert.deepStrictEqual(f.areas[1].quotes_to_request, ['Request a retirement annuity quote from Old Mutual for R 5 000 p.m.']);
  let sent = null;
  const by = await AI.focusPoints({ ask: (system, content) => { sent = { system, content: JSON.parse(content) }; return Promise.resolve('{"areas": {"1": ["- Get the BrightRock quote for Thandi"], "2": ["Request the RA quote from Old Mutual, R 5 000 p.m.", "Check the paid-up RAs"], "3": []}}'); }, model: 'm', facts: f });
  assert.deepStrictEqual(by, { 1: ['Get the BrightRock quote for the client Thandi'], 2: ['Request the RA quote from Old Mutual, R 5 000 p.m.', 'Check the paid-up RAs'], 3: [] });
  assert.deepStrictEqual(Object.keys(sent.content).sort(), ['facts', 'today']); assert.match(sent.system, /GREEN/); assert.match(sent.system, /never invent/);
  const t = A.focusText(f, by);
  assert.strictEqual(t.split('\n\n').length, 3);
  assert.match(t, /^1\. Personal Risk Covers\n- Get the BrightRock quote for the client Thandi\n\n2\. Retirement Planning\n- Request the RA quote from Old Mutual, R 5 000 p\.m\.\n- Check the paid-up RAs\n\n3\. RGAR\n- Request a retirement goal analysis \(RGAR\)/, 'an area Claude gave nothing for keeps the plain points');
  await assert.rejects(AI.focusPoints({ ask: () => Promise.reject(new Error('no connection')), model: 'm', facts: f }), /no connection/);
});

test('the box is saved with the file, with what it was written from', () => {
  const s = fresh(); set(s, 'focus', '1. Personal Risk Covers\n- Something'); store.setFocus(s, 'k1', 'claude'); s.focus.edited = true;
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual([back.f.focus.v, back.focus.key, back.focus.by, back.focus.edited], ['1. Personal Risk Covers\n- Something', 'k1', 'claude', true]);
  assert.deepStrictEqual(store.fromJSON(JSON.stringify({ app: 'wr-fact-find' })).focus, { key: '', at: '', by: '', edited: false }, 'an older file opens with an empty box');
});

/* ---- today's date ---- */
test('Claude is told today\'s date in every request: the voice line, the catch-up check, the file notes, the summaries, the action points, the priorities and the look-ups', async () => {
  AI.setClock(() => new Date(2026, 10, 5, 9, 30));                                  // Thursday 5 November 2026
  try {
    assert.strictEqual(AI.todayText(), 'Thursday 05/11/2026');
    const idx = V.buildIndex(schema), prep = AI.buildRequest(idx, { sectionId: 'info', recent: [], meeting: 'Wednesday 04/11/2026' }, 'client', 'Thursday the 19th', 'm');
    const line = JSON.parse(prep.messages[0].content);
    assert.strictEqual(line.today, 'Thursday 05/11/2026'); assert.strictEqual(line.meeting_date, 'Wednesday 04/11/2026', 'the form\'s date is told as well, and can differ');
    const cached = AI.cachedRequest(AI.prepare(idx, { sectionId: 'info', recent: [] }, 'client', 'hello', 'm'));
    assert.ok(!/"today":/.test(cached.messages[0].content[0].text) && /"today":"Thursday 05\/11\/2026"/.test(cached.messages[0].content[1].text), 'the date is in the part that changes, so the remembered part is not touched');
    assert.strictEqual(JSON.parse(AI.sweepRequest({ idx, filled: {}, transcript: [{ who: 'client', text: 'hi' }], model: 'm' }).messages[0].content).today, 'Thursday 05/11/2026');
    const asks = [], ask = (system, content) => { asks.push(JSON.parse(content).today); return Promise.resolve('{"points": ["x"], "areas": {}, "actions": []}'); };
    await AI.points({ ask, model: 'm', text: 'he smokes', topic: 'health' });
    await AI.summarise({ ask, model: 'm', areas: { life: { area: 'Personal Risk Covers', key: 'k', data: { facts: {}, lists: {} } } } });
    await AI.actionPoints({ ask, model: 'm', facts: { client: 'Thandi', schedules: [] } });
    await AI.focusPoints({ ask, model: 'm', facts: { client: 'Thandi', areas: [] } });
    assert.deepStrictEqual(asks, ['Thursday 05/11/2026', 'Thursday 05/11/2026', 'Thursday 05/11/2026', 'Thursday 05/11/2026']);
    [AI.SYSTEM, AI.SWEEP_SYSTEM, AI.ACTIONS_SYSTEM, AI.FOCUS_SYSTEM, AI.SUMMARY_SYSTEM, AI.POINTS_SYSTEM].forEach((sys, i) => assert.match(sys || '', /today/i, 'prompt ' + i + ' says what to do with today'));
  } finally { AI.setClock(null); }
  const req = L.buildRequest('Jawitz & Co', 'business', 'm'), p = req.messages[0].content;
  assert.match(p, /^Today's date is (?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day \d\d\/\d\d\/\d{4}\. Search the web/);
  assert.match(L.buildRequest('Paul K', 'person', 'm', null, { org: 'Acme' }).messages[0].content, /^Today's date is /);
});

test('a schedule is sent with the notes of its own page, so "No need to send through" and "she already emailed it" are read against it', () => {
  const s = fresh(); set(s, 'fname', 'Roquelle'); set(s, 'has_risk', 'Yes'); set(s, 'ps_risk', schema.psClient.risk); set(s, 'has_inv', 'Yes'); set(s, 'has_ra', 'Yes'); set(s, 'has_pp', 'No');
  store.addRow(s, 'risk', { prov: 'Liberty' }); store.addRow(s, 'inv', { prov: 'FNB' }); store.addRow(s, 'ret_ra', { prov: 'Allan Gray' });
  set(s, 'n_cover', '- Client already sent the Liberty policy schedule to us via email\n- Needs to check emails'); set(s, 'n_inv', 'No need to send through'); set(s, 'n_retire', '   ');
  const by = {}; A.facts(s).schedules.forEach(x => { by[x.what] = x; });
  assert.strictEqual(by['personal risk policies'].note_on_this_page, '- Client already sent the Liberty policy schedule to us via email\n- Needs to check emails');
  assert.deepStrictEqual([by['investments'].note_on_this_page, by['investments'].requested], ['No need to send through', ['not asked yet']]);
  assert.ok(!('note_on_this_page' in by['retirement annuities']), 'an empty note adds nothing');
  assert.ok(A.facts(s).notes.some(n => n.page === 'Investments' && n.note === 'No need to send through'), 'and it is still in the notes of all the pages');
  set(s, 'n_inv', 'Other note'); assert.notStrictEqual(A.key(A.facts(s)), A.key((() => { set(s, 'n_inv', 'No need to send through'); return A.facts(s); })()), 'a changed note makes the points out of date');
});

test('the action points prompt says the notes decide: no point for a schedule noted "no need to send through", check the inbox first when she says she already sent it', () => {
  const sys = AI.ACTIONS_SYSTEM;
  assert.match(sys, /THE NOTES DECIDE/); assert.match(sys, /note_on_this_page/); assert.match(sys, /the note wins/);
  assert.match(sys, /No need to send through[^.]*write NO point for it, even when it says "not asked yet"/);
  assert.match(sys, /ALREADY sent the schedule[^.]*first check whether it has arrived/);
  assert.match(AI.FOCUS_SYSTEM, /notes/); assert.match(AI.FOCUS_SYSTEM, /already emailed a schedule means checking for it first/);
});

test('a green area is sent with the notes of its own pages', () => {
  const s = fresh(); set(s, 'fname', 'Roquelle'); set(s, 'pr_life', GO); set(s, 'pr_will', GO); set(s, 'pr_st', GO);
  set(s, 'n_cover', 'Liberty schedule: client says she emailed it'); set(s, 'n_will', 'Draft not signed'); set(s, 'n_sti', ''); set(s, 'n_inv', 'No need to send through');
  const a = A.focusFacts(s).areas;
  assert.deepStrictEqual(a.map(x => [x.number, x.notes]), [[1, ['Liberty schedule: client says she emailed it']], [7, ['Draft not signed']], [8, undefined]]);
});
