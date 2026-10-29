/* The Client priorities page and the pages split out for it: the structure in the schema, what each area's summary is written from, the old files, the voice answers and Claude's summary request. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const S = require('../app/js/summary.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const show = (s, cond) => calc.showIf(cond, store.ctxFor(s));
const sec = id => schema.sections.find(x => x.id === id);
const PRI = schema.PRIORITY, NOT = schema.NOT_PRIORITY;
const AREAS = ['life', 'ra', 'rgar', 'inv', 'egar', 'med', 'will', 'st'];

test('the pages: risk cover, retirement funding, then one Client priorities page; the old advisor pages and the Advisor box are gone', () => {
  assert.deepStrictEqual(schema.sections.map(s => s.id), ['info', 'occ', 'income', 'cover', 'retire', 'inv', 'other', 'debts', 'kids', 'health', 'prio']);
  assert.strictEqual(sec('cover').title, 'Personal & group risk cover');
  assert.strictEqual(sec('retire').title, 'Retirement funding');
  assert.ok(sec('prio').adv && sec('prio').title === 'Client priorities');
  assert.ok(!schema.fieldsById.advisor && schema.advisor === 'Paul Kafentzis');
  assert.ok(!('docs' in schema));
  assert.ok(!schema.sections.some(s => /^q_/.test(s.id)));
  assert.ok(!sec('prio').blocks.some(b => b.docs));
});

test('personal risk first with joint life, then group risk with its own list and no joint life', () => {
  const b = sec('cover').blocks;
  assert.deepStrictEqual(b.map(x => x.title || '-'), ['Personal risk cover', 'Existing personal risk policies', 'Group risk cover', 'Existing group risk policies', '-']);
  assert.deepStrictEqual(b[0].fields.map(f => f.id), ['has_risk', 'joint']);
  assert.strictEqual(schema.fieldsById.joint.l, 'Joint life with spouse');
  assert.deepStrictEqual(b[2].fields.map(f => f.id), ['has_group']);
  assert.deepStrictEqual(schema.lists.grp.cols.map(c => c.l), schema.lists.risk.cols.map((c, i) => i === 0 ? 'Provider / administrator' : c.l));
  assert.ok(schema.lists.grp.sum.spend);
  assert.ok(b[1].list === 'risk' && b[3].list === 'grp' && !b.some(x => (x.fields || []).some(f => /joint/.test(f.id)) && x.list === 'grp'));
  assert.strictEqual(sec('retire').blocks[0].list, 'ret');
  assert.ok(!sec('cover').blocks.some(x => x.list === 'ret'));
});

test('no personal risk cover greys out Joint life and the policies, with a message; no group greys the group policies', () => {
  const s = fresh(), [, polBlock, , grpBlock] = sec('cover').blocks, joint = schema.fieldsById.joint;
  assert.ok(polBlock.grey && grpBlock.grey && joint.grey && polBlock.condMsg && grpBlock.condMsg);
  assert.match(polBlock.condMsg, /No personal risk cover is in place/);
  assert.match(grpBlock.condMsg, /No group risk cover is in place/);
  assert.ok(show(s, polBlock.cond) && show(s, joint.cond) && show(s, grpBlock.cond));       // not asked yet: nothing is greyed
  set(s, 'has_risk', 'No'); assert.ok(!show(s, polBlock.cond) && !show(s, joint.cond));
  set(s, 'has_risk', 'Yes'); assert.ok(show(s, polBlock.cond) && show(s, joint.cond));
  set(s, 'has_group', 'No'); assert.ok(!show(s, grpBlock.cond));
  set(s, 'has_group', 'Not sure'); assert.ok(!show(s, grpBlock.cond));
  set(s, 'has_group', 'Yes'); assert.ok(show(s, grpBlock.cond));
});

test('the priority areas, in order, each with a decision and a comments box; every old advisor box is still there under its id', () => {
  assert.deepStrictEqual(schema.panels.map(p => p.id), AREAS.concat('biz'));
  AREAS.forEach(id => {
    const p = schema.panelsById[id], dec = schema.fieldsById[p.dec], cm = schema.fieldsById[p.cm];
    assert.strictEqual(p.dec, 'pr_' + id); assert.strictEqual(p.cm, 'pr_' + id + '_cm');
    assert.deepStrictEqual(dec.o, [PRI, NOT]); assert.strictEqual(cm.t, 'area');
    assert.strictEqual(sec('prio').blocks.filter(b => b.pri === id && b.head).length, 1, id);
  });
  ['fna_req', 'fna_type', 'fna_ins', 'sf_req', 'pref_spend', 'rgar_req', 'ret_age', 'ret_net', 'egar_req', 'ref_sti', 'ref_med', 'ref_will', 'lc_sa', 'pd_sa', 'dd_cover', 'ip_age', 'bs_req', 'cl_req', 'km_req', 'n_prio'].forEach(id => assert.ok(schema.fieldsById[id], id));
  ['redq', 'raq', 'invq'].forEach(k => assert.ok(schema.lists[k], k));
  const order = sec('prio').blocks.filter(b => b.head).map(b => b.pri);
  assert.deepStrictEqual(order, AREAS);
  assert.ok(sec('prio').blocks.every(b => !b.pri || schema.panelsById[b.pri]));
});

test('"not a priority" switches the area\'s quote and referral boxes off, keeps the decision and comments, and "priority" or no answer leaves them on', () => {
  const s = fresh(), shortfall = sec('prio').blocks.find(b => b.title === 'Shortfall quote');
  AREAS.forEach(id => {
    const mine = sec('prio').blocks.filter(b => b.pri === id);
    set(s, 'pr_' + id, NOT);
    mine.forEach(b => assert.strictEqual(show(s, b.cond), !!b.head, id + ' ' + (b.title || '')));
    set(s, 'pr_' + id, PRI); mine.forEach(b => assert.ok(show(s, b.cond) || b.title === 'Shortfall quote' && false, id));
    set(s, 'pr_' + id, ''); mine.forEach(b => assert.ok(show(s, b.cond), id));
  });
  // the Shortfall quote keeps its own rule (a Group), apart from the area being switched off
  assert.deepStrictEqual(shortfall.own, { f: 'has_group', nin: ['No', 'Not sure'] });
  set(s, 'has_group', 'No'); assert.ok(!show(s, shortfall.cond) && !show(s, shortfall.own));
  set(s, 'has_group', 'Yes'); set(s, 'pr_life', NOT); assert.ok(!show(s, shortfall.cond) && show(s, shortfall.own));
});

test('business assurance follows Business owner', () => {
  const s = fresh(), biz = sec('prio').blocks.filter(b => b.pri === 'biz');
  assert.strictEqual(biz.length, 3); assert.match(schema.panelsById.biz.condMsg, /applies only when Business owner is set to Yes/);
  assert.ok(biz.every(b => !show(s, b.cond) && b.grey));
  assert.ok(!sec('prio').blocks.find(b => b.title === 'Shortfall quote').grey);                       // the Shortfall quote keeps its own message and goes away, as before
  set(s, 'bizowner', 'Yes'); assert.ok(biz.every(b => show(s, b.cond)));
});

test('an older file opens: the advisor name is ignored, the old notes boxes become the one Notes box, quotes and referrals are kept', () => {
  const old = fresh();
  old.f.advisor = { v: 'Someone', st: 'preset' }; old.f.n_q_risk = { v: 'Wants R1m cover', st: 'confirmed' }; old.f.n_calc = { v: 'Used fractured', st: 'confirmed' }; old.f.fna_req = { v: 'Request a quote', st: 'confirmed' }; old.f.ref_will = { v: 'Not interested', st: 'confirmed' };
  old.docs = { 'Group risk benefit summary': 1 };
  const back = store.fromJSON(JSON.stringify(Object.assign({ app: 'wr-fact-find' }, old)));
  assert.strictEqual(back.f.fna_req.v, 'Request a quote'); assert.strictEqual(back.f.ref_will.v, 'Not interested');
  assert.strictEqual(back.f.advisor, undefined); assert.strictEqual(back.docs, undefined);
  assert.strictEqual(back.f.n_prio.v, 'Personal risk quotes: Wants R1m cover\nRisk calculation: Used fractured');
  const again = store.fromJSON(store.toJSON(back)); assert.strictEqual(again.f.n_prio.v, back.f.n_prio.v);
  const newer = fresh(); set(newer, 'n_prio', 'Mine'); newer.f.n_q_risk = { v: 'Old', st: 'confirmed' };
  assert.strictEqual(store.fromJSON(JSON.stringify(Object.assign({ app: 'wr-fact-find' }, newer))).f.n_prio.v, 'Mine');       // never over what is already there
});

function sample() {
  const s = fresh();
  set(s, 'marital', 'Customary marriage'); set(s, 'gross', 'R 500 000.00'); set(s, 'h_bp', 'Yes'); set(s, 'fname', 'Example'); set(s, 'cell', '0824541751');
  set(s, 'has_risk', 'Yes'); set(s, 'joint', 'No'); store.addRow(s, 'risk', { prov: 'Liberty', spend: 'R 20 000.00', broker: 'Other broker' });
  set(s, 'has_group', 'Yes'); store.addRow(s, 'grp', { prov: 'Discovery', spend: 'R 1 450.00', broker: 'Through company' });
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', cl: 'Yes', bal: 'R 1 200 000.00' }); store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', cl: 'No' });
  store.addRow(s, 'ret', { type: 'Retirement annuity', prov: 'Allan Gray', val: 'R 16 000 000.00', contrib: 'R 50 000.00' }); store.addRow(s, 'ret', { type: 'Pension fund', prov: 'Old Mutual', val: 'R 3 200 000.00', contrib: 'R 8 000.00' });
  store.addRow(s, 'inv', { type: 'Unit trust', prov: 'Discovery Invest', val: 'R 11 000.00', prem: 'R 99.99' });
  store.addRow(s, 'kids', { name: 'Thandi', dob: '01/02/2014', stage: 'Primary', cost: 'R 20 000.00' });
  set(s, 'will', 'Yes'); set(s, 'will_where', 'Capital Legacy'); set(s, 'will_up', 'No'); set(s, 'ma', 'Medical aid'); set(s, 'ma_prov', 'Discovery Health'); set(s, 'gap', 'No'); set(s, 'sti', 'Yes'); set(s, 'sti_broker', 'Other broker');
  set(s, 'fna_req', 'Request a quote'); set(s, 'fna_type', 'New Business');
  return s;
}

test('an area\'s summary is written from that area\'s own boxes only', () => {
  const s = sample(), flat = id => JSON.stringify(S.areaData(s, id));
  const all = AREAS.map(id => flat(id)).join(' ');
  assert.ok(!/Customary|500 000|Example|0824541751|h_bp|Thandi/.test(all), 'no income, marital status, health, name or phone in any area');
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'will').fields).sort(), ['will', 'will_up', 'will_where']);
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'will').lists), []);
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'life').lists).sort(), ['debts', 'grp', 'redq', 'risk']);
  assert.deepStrictEqual(S.areaData(s, 'life').lists.debts, [{ type: 'Home loan', prov: 'Nedbank', cl: 'Yes' }, { type: 'Vehicle finance', prov: 'Wesbank', cl: 'No' }]);   // credit life per debt, not the balance
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'egar').lists.kids[0]).sort(), ['age', 'cost', 'stage']);                  // no child's name
  assert.ok(!/Allan Gray|Old Mutual/.test(flat('inv')) && !/Discovery Invest/.test(flat('ra')));
  assert.ok(!('joint' in S.areaData(set(s, 'has_risk', 'No') || s, 'life').fields) && S.areaData(s, 'life').lists.risk === undefined);       // no personal cover: its policies and joint life are left out
  set(s, 'has_risk', 'Yes');
  set(s, 'pr_life', NOT); assert.ok(!('fna_req' in S.areaData(s, 'life').fields) && S.areaData(s, 'life').lists.redq === undefined);   // a quote of an area that is not a priority is not reported
});

test('plain points for each area, said the way the adviser needs them', () => {
  const s = sample(), L = id => S.local(s, id);
  assert.deepStrictEqual(L('life'), ['Personal risk cover: Liberty, R 20 000 p.m., Other broker', 'Joint life with spouse: no', 'Group risk: Discovery, R 1 450 p.m., Through company', 'Credit life: Home loan (Nedbank): yes', 'Credit life: Vehicle finance (Wesbank): no', 'Quote asked for: FNA quote (new business)']);
  assert.deepStrictEqual(L('ra'), ['Retirement annuity: Allan Gray, R 16 000 000, R 50 000 p.m., ', 'Pension fund: Old Mutual, R 3 200 000, R 8 000 p.m., ', 'Provident fund: none'].map(x => x.replace(/, $/, '')));
  assert.deepStrictEqual(L('rgar').slice(0, 2), ['Total saved across all retirement funds: R 19 200 000', 'Total contributions: R 58 000 p.m.']);
  assert.ok(L('inv').includes('Tax-free savings: none') && L('inv').includes('Endowment: none') && L('inv').includes('Total invested: R 11 000'));
  assert.deepStrictEqual(L('will'), ['Has a will: held with Capital Legacy', 'Will is not up to date']);
  assert.deepStrictEqual(L('med'), ['Medical aid: Discovery Health', 'Gap cover: none']);
  const e = fresh();
  assert.deepStrictEqual(S.local(e, 'will'), ['Nothing recorded yet about a will']);
  set(e, 'will', 'No'); assert.deepStrictEqual(S.local(e, 'will'), ['No will in place']);
  set(e, 'has_risk', 'No'); set(e, 'has_group', 'No'); assert.deepStrictEqual(S.local(e, 'life'), ['No personal risk cover in place', 'No group risk through the employer']);
  assert.deepStrictEqual(S.local(e, 'egar').slice(0, 1), ['No children recorded, so no education to plan for']);
  assert.deepStrictEqual(S.local(e, 'ra'), ['No retirement funds recorded']);
});

test('Claude\'s points are used only while the area still holds what it held when they were written', () => {
  const s = sample(), key = S.key(S.areaData(s, 'will'));
  assert.strictEqual(S.linesFor(s, 'will').by, 'form');
  store.setSum(s, 'will', ['- Has a will with Capital Legacy', 'Not up to date'], key);
  const r = S.linesFor(s, 'will'); assert.ok(r.by === 'claude' && r.fresh && r.lines.length === 2);
  set(s, 'will_up', 'Yes'); assert.ok(S.linesFor(s, 'will').by === 'form' && !S.linesFor(s, 'will').fresh);
  assert.ok(S.stale(s, ['will']).will && !S.stale(s, ['ra']).ra === false);
  store.setSum(s, 'will', ['x'], S.key(S.areaData(s, 'will')));
  assert.deepStrictEqual(Object.keys(S.stale(s, ['will'])), []); assert.deepStrictEqual(Object.keys(S.stale(s, ['will'], true)), ['will']);
  const back = store.fromJSON(store.toJSON(s)); assert.deepStrictEqual(back.sum.will.lines, ['x']); assert.strictEqual(back.sum.will.key, S.key(S.areaData(s, 'will')));
  assert.deepStrictEqual(store.cleanSum({ nope: { lines: ['a'] }, ra: { lines: [' a  b ', '', 5] }, inv: 'x' }), { ra: { lines: ['a b', '5'], key: '', at: '' } });
});

test('what is sent to Claude for the summaries has labelled boxes only, and no private numbers', () => {
  const s = sample(); store.addRow(s, 'risk', { prov: 'Liberty', notes: 'policy 1234567890 for her' });
  const sent = S.stale(s).life, txt = JSON.stringify(sent);
  assert.strictEqual(sent.area, 'Life');
  assert.ok(!/"has_risk"|"prov"|"cl"/.test(txt) && /Has personal risk cover/.test(txt) && /Credit life with lender/.test(txt));
  let body = null;
  return AI.summarise({ ask: (system, content) => { body = { system, content: JSON.parse(content) }; return Promise.resolve('{"areas":{}}'); }, model: 'm', areas: { life: sent } }).then(() => {
    assert.ok(!/1234567890/.test(JSON.stringify(body.content)) && /\[number\]/.test(JSON.stringify(body.content)));
    assert.match(body.system, /Use only the data given for that area/);
    assert.match(body.system, /Do not advise/);
  });
});

test('an area with nothing recorded sends nothing to claim "none" from, and the prompt forbids claiming absence from a missing box', () => {
  const e = fresh(), sent = S.stale(e).life;
  assert.deepStrictEqual(sent.data, { facts: {}, lists: {} });                                  // empty lists are left out
  set(e, 'has_risk', 'No'); assert.deepStrictEqual(S.stale(e).life.data, { facts: { 'Has personal risk cover': 'No' }, lists: {} });
  store.addRow(e, 'ret', { type: 'Retirement annuity', prov: 'Allan Gray' });
  assert.deepStrictEqual(Object.keys(S.stale(e).ra.data.lists), ['Retirement funding']);
  assert.match(AI.SUMMARY_SYSTEM, /never write "No \.\.\. in place" or "none recorded" because something is missing/);
  assert.match(AI.SUMMARY_SYSTEM, /"Nothing recorded yet"/);
});

test('Claude\'s reply for the summaries: points are tidied, areas not asked for and empty answers are dropped', async () => {
  const areas = { life: { area: 'Life', data: { facts: {}, lists: {} } }, ra: { area: 'RA', data: { facts: {}, lists: {} } }, will: { area: 'Will', data: { facts: {}, lists: {} } } };
  const reply = '```json\n{"areas": {"life": ["- No personal risk cover", "  No group risk  ", "", 7], "ra": [], "st": ["not asked"]}}\n```';
  const out = await AI.summarise({ ask: () => Promise.resolve(reply), model: 'm', areas });
  assert.deepStrictEqual(out, { life: ['No personal risk cover', 'No group risk', '7'] });
  await assert.rejects(AI.summarise({ ask: () => Promise.reject(new Error('no connection')), model: 'm', areas }), /no connection/);
});

test('voice: a plain yes makes an area a priority, a decline makes it not a priority, mixed answers are not guessed', () => {
  const idx = V.buildIndex(schema), f = idx.byId.pr_life, v = t => { const r = V.interpret(f, t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  ['yes', 'Yes, definitely', 'go ahead', 'that makes sense', 'yeah please do', 'ja'].forEach(t => assert.strictEqual(v(t), PRI, t));
  ['no', 'not now', "I'm not interested", 'no thanks', 'I cannot afford it at the moment', 'I already have that', 'not a priority', 'not at this stage'].forEach(t => assert.strictEqual(v(t), NOT, t));
  assert.strictEqual(v('yes but not now'), 'ERR:ambiguous');
  assert.strictEqual(v('I am not sure'), 'ERR:unsure'); assert.strictEqual(v('maybe'), 'ERR:unsure');          // not guessed either way
  AREAS.forEach(id => { const r = V.interpret(idx.byId['pr_' + id], 'yes'); assert.strictEqual(r.value, PRI, id); });
  assert.ok(idx.byId.pr_ra_cm && idx.byId.pr_ra_cm.t === 'area' && !idx.byId.pr_ra_cm.notes);
});

test('voice: the areas that are switched off are not asked about, and the priorities page is reached by name', () => {
  const idx = V.buildIndex(schema), s = fresh();
  const vis = f => show(s, f.cond);
  assert.ok(vis(idx.byId.fna_req) && vis(idx.byId['raq.req']));
  set(s, 'pr_life', NOT); set(s, 'pr_ra', NOT);
  assert.ok(!vis(idx.byId.fna_req) && !vis(idx.byId['raq.req']) && !vis(idx.byId['redq.req']) && vis(idx.byId.invq ? idx.byId.invq : idx.byId['invq.purpose']) && vis(idx.byId.pr_life) && vis(idx.byId.pr_life_cm));
  assert.strictEqual(V.parseCommand('go to client priorities', idx).sec, 'prio');
  assert.strictEqual(V.parseCommand('lets talk about group risk', idx).sec, 'cover');
  const ask = (t, cur) => { const r = V.matchQuestion(t, idx, { cur: cur || 'prio' }); return r && r.id; };
  assert.strictEqual(ask('Is life cover a priority for you?'), 'pr_life');
  assert.strictEqual(ask('Is a retirement annuity a priority?'), 'pr_ra');
  assert.strictEqual(ask('What are the comments for the will?'), 'pr_will_cm');
  assert.strictEqual(ask('Do you have group risk through work?', 'cover'), 'has_group');
});

test('Claude is told how the priority boxes work', () => {
  assert.match(AI.buildRequest(V.buildIndex(schema), { sectionId: 'prio', recent: [] }, 'auto', 'is life cover a priority?', 'm').system, /pr_life.*pr_st[\s\S]*Not a priority/);
  const body = JSON.parse(AI.buildRequest(V.buildIndex(schema), { sectionId: 'prio', recent: [] }, 'auto', 'x', 'm').messages[0].content);
  assert.ok(body.fields.some(f => f.id === 'pr_life' && f.options.length === 2) && body.fields.some(f => f.id === 'pr_life_cm'));
  assert.ok(body.lists.some(l => l.id === 'grp' && l.section === 'cover'));
});
