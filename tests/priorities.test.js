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
const PRI = schema.PRIORITY, NOT = schema.NOT_PRIORITY, UNSURE = schema.UNSURE, BUDGET = schema.BUDGET;
const AREAS = ['life', 'ra', 'rgar', 'inv', 'egar', 'med', 'will', 'st'];

test('the pages: risk cover, retirement funding, then one Client priorities page; the old advisor pages and the Advisor box are gone', () => {
  assert.deepStrictEqual(schema.sections.map(s => s.id), ['info', 'occ', 'income', 'cover', 'retire', 'inv', 'other', 'debts', 'kids', 'health', 'prio', 'calc', 'admin']);
  assert.strictEqual(sec('cover').title, 'Personal & group risk cover');
  assert.strictEqual(sec('retire').title, 'Retirement funding');
  assert.ok(sec('prio').adv && sec('prio').title === 'Client priorities and quotes needed');
  assert.ok(sec('calc').adv && sec('calc').title === 'BrightRock Risk Calculation' && !sec('calc').cond);                    // its own page in the list, always there, for BrightRock only
  assert.deepStrictEqual(sec('calc').blocks.map(b => b.strip ? 'strip' : b.title || '-'), ['strip', 'Life cover: fractured cover', 'Permanent disability: fractured cover', 'Income protection / sickness benefit: fractured cover', 'Dread disease: fractured cover', '-']);
  assert.ok(!sec('calc').blocks.some(b => /standard/i.test(b.title || '')) && !['lc_sa', 'pd_sa', 'ips_amt', 'dds_cover'].some(id => sec('calc').blocks.some(b => (b.fields || []).some(f => f.id === id))));    // no standard quote on the BrightRock page
  assert.ok(sec('calc').blocks.every(b => !b.cond && !b.pri));                                                          // not tied to the Life area, to its decision or to the cover the client has now
  assert.ok(!schema.fieldsById.advisor && schema.advisor === 'Paul Kafentzis');
  assert.ok(!('docs' in schema));
  assert.ok(!schema.sections.some(s => /^q_/.test(s.id)));
  assert.ok(!sec('prio').blocks.some(b => b.docs));
});

test('personal risk first with joint life, then group risk with its own list and no joint life', () => {
  const b = sec('cover').blocks;
  assert.deepStrictEqual(b.map(x => x.title || '-'), ['-', 'Personal risk cover', 'Existing personal risk policies', 'Request Current Policy Schedule(s)', 'Group risk cover', 'Existing group risk policies', 'Request Current Policy Schedule(s)', '-']);
  assert.deepStrictEqual(b[0].fields.map(f => f.id), ['loa']);                                                            // the LOA question comes first, before Personal risk cover
  assert.deepStrictEqual(b[1].fields.map(f => f.id), ['has_risk', 'joint']);
  assert.strictEqual(schema.fieldsById.joint.l, 'Joint life with spouse');
  assert.deepStrictEqual(b[4].fields.map(f => f.id), ['has_group']);
  assert.deepStrictEqual(schema.lists.grp.cols.map(c => c.l), schema.lists.risk.cols.map((c, i) => i === 0 ? 'Provider / administrator' : c.l));
  assert.ok(schema.lists.grp.sum.spend);
  assert.ok(b[2].list === 'risk' && b[5].list === 'grp' && !b.some(x => (x.fields || []).some(f => /joint/.test(f.id)) && x.list === 'grp'));
  assert.deepStrictEqual(sec('retire').blocks.map(x => x.list || '-'), ['ret_ra', '-', 'ret_pp', '-', '-']);                      // retirement annuities, and pension and provident funds, are two lists, each followed by its policy schedule box
  assert.deepStrictEqual(sec('retire').blocks.map(x => x.title || '-'), ['Retirement annuities', 'Request Current Policy Schedule(s)', 'Pension and provident funds', 'Request Current Policy Schedule(s)', '-']);
  assert.ok(!schema.lists.ret && !sec('cover').blocks.some(x => /^ret/.test(x.list || '')));
  assert.deepStrictEqual(schema.lists.ret_pp.cols[0].o, ['Pension fund', 'Provident fund']);
  assert.ok(!schema.lists.ret_ra.cols.some(c => c.k === 'type'));
});

test('no personal risk cover greys out Joint life and the policies, with a message; no group greys the group policies', () => {
  const s = fresh(), [, , polBlock, , , grpBlock] = sec('cover').blocks, joint = schema.fieldsById.joint;
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
    assert.deepStrictEqual(dec.o, ['life', 'ra', 'inv'].includes(id) ? [PRI, UNSURE, BUDGET, NOT] : [PRI, NOT]); assert.strictEqual(cm.t, 'area');       // Life, RA and Invest also have "Client not sure, needs to think about it"
    assert.strictEqual(sec('prio').blocks.filter(b => b.pri === id && b.head).length, 1, id);
  });
  ['fna_req', 'fna_type', 'fna_ins', 'sf_req', 'n_calc', 'pref_spend', 'rgar_req', 'ret_age', 'ret_net', 'egar_req', 'ref_sti', 'ref_med', 'ref_will', 'lc_sa', 'pd_sa', 'dd_cover', 'ip_age', 'bs_req', 'cl_req', 'km_req', 'n_prio'].forEach(id => assert.ok(schema.fieldsById[id], id));
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
  old.f.advisor = { v: 'Someone', st: 'preset' }; old.f.n_q_risk = { v: 'Wants R1m cover', st: 'confirmed' }; old.f.n_bs = { v: 'Partner agrees', st: 'confirmed' }; old.f.n_calc = { v: 'Used fractured', st: 'confirmed' }; old.f.fna_req = { v: 'Request a quote', st: 'confirmed' }; old.f.ref_will = { v: 'Not interested', st: 'confirmed' };
  old.docs = { 'Group risk benefit summary': 1 };
  const back = store.fromJSON(JSON.stringify(Object.assign({ app: 'wr-fact-find' }, old)));
  assert.strictEqual(back.f.fna_req.v, 'Request a quote'); assert.strictEqual(back.f.ref_will.v, 'Not interested');
  assert.strictEqual(back.f.advisor, undefined); assert.strictEqual(back.docs, undefined);
  assert.strictEqual(back.f.n_prio.v, 'Personal risk quotes: Wants R1m cover\nBuy & Sell: Partner agrees');
  assert.strictEqual(back.f.n_calc.v, 'Used fractured');                                    // the Risk calculation page keeps its own notes
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
  store.addRow(s, 'ret_ra', { prov: 'Allan Gray', val: 'R 16 000 000.00', contrib: 'R 50 000.00' }); store.addRow(s, 'ret_pp', { type: 'Pension fund', prov: 'Old Mutual', val: 'R 3 200 000.00', contrib: 'R 8 000.00' });
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
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'life').lists).sort(), ['bfred', 'debts', 'grp', 'redq', 'risk']);
  assert.deepStrictEqual(S.areaData(s, 'life').lists.debts, [{ type: 'Home loan', prov: 'Nedbank', cl: 'Yes' }, { type: 'Vehicle finance', prov: 'Wesbank', cl: 'No' }]);   // credit life per debt, not the balance
  assert.deepStrictEqual(Object.keys(S.areaData(s, 'egar').lists.kids[0]).sort(), ['age', 'cost', 'stage']);                  // no child's name
  assert.ok(!/Allan Gray|Old Mutual/.test(flat('inv')) && !/Discovery Invest/.test(flat('ra')));
  assert.ok(!('joint' in S.areaData(set(s, 'has_risk', 'No') || s, 'life').fields) && S.areaData(s, 'life').lists.risk === undefined);       // no personal cover: its policies and joint life are left out
  set(s, 'has_risk', 'Yes');
  set(s, 'pr_life', NOT); assert.ok(!('fna_req' in S.areaData(s, 'life').fields) && S.areaData(s, 'life').lists.redq === undefined);   // a quote of an area that is not a priority is not reported
});

test('plain points for each area, said the way the adviser needs them', () => {
  const s = sample(), L = id => S.local(s, id);
  assert.deepStrictEqual(L('life'), ['Personal risk cover: Liberty, R 20 000 p.m., Other broker', 'Joint life with spouse: no', 'Group risk: Discovery, R 1 450 p.m., Through company', 'Credit life: Home loan (Nedbank): yes', 'Credit life: Vehicle finance (Wesbank): no', 'Standard quote asked for: FNA quote (new business)', 'Total debt to be covered (balances): R 1 200 000', 'Total childcare cost to be covered, per month: R 20 000']);
  assert.deepStrictEqual(L('ra'), ['Retirement annuity: Allan Gray, R 16 000 000, R 50 000 p.m.', 'Pension fund: Old Mutual, R 3 200 000, R 8 000 p.m.']);
  assert.deepStrictEqual(L('rgar').slice(0, 2), ['Total saved across all retirement funds: R 19 200 000', 'Total monthly contributions to retirement funds: R 58 000 p.m.']);
  assert.ok(L('inv').includes('Tax-free savings: none') && L('inv').includes('Endowment: none') && L('inv').includes('Total invested: R 11 000'));
  assert.deepStrictEqual(L('will'), ['Has a will: held with Capital Legacy', 'Will is not up to date']);
  assert.deepStrictEqual(L('med'), ['Medical aid: Discovery Health', 'Gap cover: none']);
  const e = fresh();
  assert.deepStrictEqual(S.local(e, 'will'), ['Nothing recorded yet about a will']);
  set(e, 'will', 'No'); assert.deepStrictEqual(S.local(e, 'will'), ['No will in place']);
  set(e, 'has_risk', 'No'); set(e, 'has_group', 'No'); assert.deepStrictEqual(S.local(e, 'life'), ['No personal risk cover in place', 'No group risk through the employer']);
  assert.deepStrictEqual(S.local(e, 'egar').slice(0, 1), ['No children recorded, so no education to plan for']);
  assert.deepStrictEqual(S.local(e, 'ra'), ['No retirement funds recorded yet']);
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
  assert.strictEqual(sent.area, 'Personal Risk Covers');                                      // the heading of the Life area
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
  store.addRow(e, 'ret_ra', { prov: 'Allan Gray' });
  assert.deepStrictEqual(Object.keys(S.stale(e).ra.data.lists), ['Retirement annuities']);
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
  ['I am not sure', 'maybe', 'let me think about it', "I'll need to speak to my wife first", 'I need some time to think this over'].forEach(t => assert.strictEqual(v(t), UNSURE, t));       // Life, RA and Invest have a third choice
  assert.strictEqual(V.interpret(idx.byId.pr_will, 'I am not sure').error, 'unsure'); assert.strictEqual(V.interpret(idx.byId.pr_rgar, 'maybe').error, 'unsure');   // the others do not: not guessed either way
  assert.strictEqual(V.interpret(idx.byId.pr_ra, 'let me think about it').value, UNSURE); assert.strictEqual(V.interpret(idx.byId.pr_inv, 'not sure yet').value, UNSURE);
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
  assert.ok(body.fields.some(f => f.id === 'pr_life' && f.options.length === 4 && f.options[1] === UNSURE && f.options[2] === BUDGET) && body.fields.some(f => f.id === 'pr_will' && f.options.length === 2) && body.fields.some(f => f.id === 'pr_life_cm'));
  assert.ok(body.lists.some(l => l.id === 'grp' && l.section === 'cover'));
});

test('"client not sure" is a third answer for Life, RA and Invest: the area stays open, with its own (yellow) state', () => {
  const s = fresh();
  ['life', 'ra', 'inv'].forEach(id => [UNSURE, BUDGET].forEach(ans => {
    set(s, 'pr_' + id, ans);
    sec('prio').blocks.filter(b => b.pri === id).forEach(b => assert.ok(show(s, b.cond), id + ' ' + (b.title || '')));          // not switched off like "not a priority"
  }));
  assert.strictEqual(BUDGET, 'Client needs to check their budget');
  assert.ok(!schema.fieldsById.pr_will.o.includes(UNSURE) && !schema.fieldsById.pr_egar.o.includes(UNSURE));
  assert.strictEqual(schema.UNSURE, 'Client not sure, needs to think about it');
  assert.match(AI.SYSTEM, /Client not sure, needs to think about it/);
});

test('Life also gets the total debt and the total childcare to be covered, worked out by the page', () => {
  const s = sample(); store.addRow(s, 'debts', { type: 'Credit card', bal: 'R 30 000.00', inst: 'R 1 500.00' }); store.addRow(s, 'kids', { name: 'Sipho', cost: 'R 5 000.00' }); set(s, 'has_risk', 'Yes');
  const d = S.areaData(s, 'life');
  assert.deepStrictEqual(d.totals, { 'Total debt to be covered (balances)': 'R 1 230 000', 'Total monthly debt repayments': 'R 1 500', 'Total childcare cost to be covered, per month': 'R 25 000' });
  assert.deepStrictEqual(S.labelled(d).facts['Total debt to be covered (balances)'], 'R 1 230 000');                       // sent to Claude as given: it never adds up
  assert.ok(S.local(s, 'life').includes('Total monthly debt repayments: R 1 500 p.m.') && S.local(s, 'life').includes('Total childcare cost to be covered, per month: R 25 000'));
  assert.ok(!/Total debt|childcare/i.test(JSON.stringify(S.areaData(s, 'ra').totals) + JSON.stringify(S.areaData(s, 'will'))));   // only Life
  const k1 = S.key(d); store.addRow(s, 'debts', { type: 'Personal loan', bal: 'R 10 000.00' }); assert.notStrictEqual(S.key(S.areaData(s, 'life')), k1);   // a new debt makes the summary out of date
  assert.deepStrictEqual(S.areaData(fresh(), 'life').totals, {});                                                          // nothing under a total: no total
  assert.match(AI.SUMMARY_SYSTEM, /starts with "Total"/);
});

test('Business assurance has a summary of the policies the client already has, and says it does not apply to a client with no business', () => {
  const s = fresh(), P = schema.panelsById.biz;
  assert.ok(P.sum && P.src && schema.lists.bizpol && sec('occ').blocks.some(b => b.list === 'bizpol'));
  assert.strictEqual(S.areaData(s, 'biz'), null);
  assert.deepStrictEqual(S.linesFor(s, 'biz').lines, ['Not applicable: the client is not a business owner']);
  assert.deepStrictEqual(S.stale(s, ['biz'], true), {});                                                                   // nothing is sent to Claude for it
  set(s, 'bizowner', 'Yes'); assert.deepStrictEqual(S.linesFor(s, 'biz').lines, ['Nothing recorded yet about business assurance']);
  set(s, 'biz_assur', 'Yes'); assert.deepStrictEqual(S.linesFor(s, 'biz').lines, ['Business assurance in place: yes, no policies recorded yet']);
  store.addRow(s, 'bizpol', { type: 'Buy & sell', prov: 'Old Mutual', cover: 'R 2 000 000.00', prem: 'R 3 400.00', paid: 'The business' });
  store.addRow(s, 'bizpol', { type: 'Keyman', prov: 'Discovery', cover: 'R 1 000 000.00' });
  set(s, 'biz_partners', 'Yes'); set(s, 'biz_loans', 'Yes'); store.addRow(s, 'shares', { name: 'Thandi', pct: '40' });
  assert.deepStrictEqual(S.linesFor(s, 'biz').lines, ['Buy & sell: Old Mutual, cover R 2 000 000, R 3 400 p.m., paid by business', 'Keyman: Discovery, cover R 1 000 000', 'Has partners or co-owners: Thandi 40%', 'Business loans or surety signed: yes']);
  const sent = S.stale(s, ['biz'], true).biz;
  assert.strictEqual(sent.area, 'Business assurance'); assert.strictEqual(sent.data.lists['Existing business assurance policies'].length, 2);
  assert.ok(!/Example|Thandi Dlamini/.test(JSON.stringify(sent)));
  set(s, 'biz_assur', 'No'); assert.ok(S.linesFor(s, 'biz').lines.includes('No business assurance in place') && !S.linesFor(s, 'biz').lines.some(l => /Old Mutual/.test(l)));        // no business assurance: its policies are left out
  assert.match(AI.SUMMARY_SYSTEM, /Business assurance/);
});

test('an older file with one retirement list opens as two: retirement annuities, and pension and provident funds', () => {
  const j = { app: 'wr-fact-find', f: {}, l: { ret: [
    { d: { type: 'Retirement annuity', prov: 'Allan Gray', val: '100000', contrib: '2000', broker: 'Paul K' }, st: 'confirmed' },
    { d: { type: 'Provident fund', prov: 'Old Mutual', val: '5000000' }, st: 'heard' },
    { d: { type: 'Pension fund', prov: 'Sanlam' }, st: 'confirmed' }, { d: { type: '', prov: '' }, st: 'confirmed' }] } };
  const back = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual(back.l.ret_ra.map(r => r.d.prov), ['Allan Gray']); assert.strictEqual(back.l.ret_ra[0].d.broker, 'Paul K'); assert.strictEqual(back.l.ret_ra[0].d.val, 'R 100 000.00');
  assert.deepStrictEqual(back.l.ret_pp.map(r => [r.d.type, r.d.prov, r.st]), [['Provident fund', 'Old Mutual', 'heard'], ['Pension fund', 'Sanlam', 'confirmed']]);
  assert.strictEqual(back.l.ret, undefined);
  const again = store.fromJSON(store.toJSON(back)); assert.strictEqual(again.l.ret_ra.length, 1); assert.strictEqual(again.l.ret_pp.length, 2);
});

test('"I need to check my budget" is the other yellow answer, for Life, RA and Invest only', () => {
  const idx = V.buildIndex(schema), v = (id, t) => { const r = V.interpret(idx.byId[id], t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  ['I need to check my budget', 'let me look at my budget first', "I'll have to see what I can afford", 'I cannot afford it, let me check my budget', 'I need to go through my budget'].forEach(t => assert.strictEqual(v('pr_life', t), BUDGET, t));
  assert.strictEqual(v('pr_ra', 'I need to check my budget'), BUDGET); assert.strictEqual(v('pr_inv', 'let me check the budget'), BUDGET);
  assert.strictEqual(v('pr_will', 'I need to check my budget'), 'ERR:unsure');                                          // no such choice there: left empty
  assert.strictEqual(v('pr_life', 'I cannot afford it'), NOT); assert.strictEqual(v('pr_life', 'not interested, I need to check my budget'), NOT); assert.strictEqual(v('pr_life', 'I am not sure'), UNSURE);
  assert.match(AI.SYSTEM, /Client needs to check their budget/);
});

test('the Life area is headed "Personal Risk Covers", with the same words under it', () => {
  const p = schema.panelsById.life;
  assert.strictEqual(p.title, 'Personal Risk Covers'); assert.strictEqual(p.sub, 'Life cover, disability, dread disease, income protection'); assert.strictEqual(p.dec, 'pr_life');       // only the heading changed
});

/* ---------- Request Current Policy Schedule(s), the LOA question and the Admin page ---------- */
const A = require('../app/js/actions.js');
const PS = ['risk', 'grp', 'ra', 'pp', 'inv'], CL = 'Requested from client in meeting', AS = 'Draw from Astute (with signed LOA)';

test('each of the five sections that hold policies ends with a "Request Current Policy Schedule(s)" tick-box list and a small Other box', () => {
  PS.forEach(k => {
    const f = schema.fieldsById['ps_' + k], o = schema.fieldsById['ps_' + k + '_ot'], blk = schema.sections.reduce((a, s) => a.concat(s.blocks), []).find(b => (b.fields || []).some(x => x.id === 'ps_' + k));
    assert.strictEqual(f.t, 'multi'); assert.strictEqual(blk.title, 'Request Current Policy Schedule(s)'); assert.ok(!blk.cond && !blk.grey && !blk.condMsg);        // never locked
    assert.deepStrictEqual(f.o, k === 'grp' ? [CL, 'Other'] : [CL, AS, 'Other'], k);                                      // group risk has no Astute; "Client does not agree" is gone from all
    assert.ok(!f.o.some(x => /agree/i.test(x)) && o.t === 'txt' && o.cond.has === 'Other' && o.grey);
  });
  assert.strictEqual(schema.sections.find(x => x.id === 'inv').blocks.slice(-2)[0].fields[0].id, 'ps_inv');            // the last item of the section, before its Notes
});

test('no schedule list is ever locked, whatever the client has or has not been asked; the box for "Other" opens with its tick', () => {
  const s = fresh(), blk = id => schema.sections.reduce((a, x) => a.concat(x.blocks), []).find(b => (b.fields || []).some(f => f.id === id));
  const open = () => PS.every(k => !blk('ps_' + k).cond && show(s, blk('ps_' + k).cond));
  assert.ok(open());                                                                                                      // nothing recorded, nothing asked
  set(s, 'has_risk', 'No'); set(s, 'has_group', 'Not sure'); assert.ok(open());                                          // even when the answer is No or Not sure
  store.addRow(s, 'ret_ra', { prov: 'Allan Gray' }); assert.ok(open());
  const other = schema.fieldsById.ps_ra_ot;
  assert.ok(!show(s, other.cond));
  set(s, 'ps_ra', CL + '; Other'); assert.ok(show(s, other.cond));
  set(s, 'ps_ra_ot', 'Bring them next week'); set(s, 'ps_ra', CL); assert.strictEqual(s.f.ps_ra_ot.v, '');        // Other is not ticked any more: what was typed goes
});

test('the action points follow a schedule choice that was made, with or without a recorded policy; "not asked yet" is chased only where the client has the policies', () => {
  const s = fresh(); set(s, 'fname', 'Thandi');
  assert.deepStrictEqual(A.local(s), ['Set up a follow-up appointment with Thandi (date to be agreed).']);              // nothing asked, nothing known: nothing to chase
  set(s, 'ps_ra', CL);                                                                                                    // ticked before the retirement annuity was typed in
  assert.ok(A.local(s).includes('Follow up with Thandi for the current policy schedules, asked for in the meeting, for the retirement annuities.'));
  set(s, 'ps_inv', AS); set(s, 'loa', 'Yes'); assert.ok(A.local(s).some(l => /^Draw the current policy schedules for the investments from Astute/.test(l)));
  set(s, 'has_risk', 'No'); set(s, 'ps_risk', CL); assert.ok(A.local(s).some(l => /personal risk policies/.test(l)));  // a choice made on purpose counts
  set(s, 'ps_risk', ''); assert.ok(!A.local(s).some(l => /personal risk policies/.test(l)));                              // unticked and not a policy the client has: nothing
  set(s, 'has_risk', 'Yes'); assert.ok(A.local(s).includes('Ask Thandi how the current policy schedules for the personal risk policies will be provided.'));
  store.addRow(s, 'ret_pp', { prov: 'Sanlam' }); assert.ok(A.local(s).includes('Ask Thandi how the current policy schedules for the pension and provident funds (Sanlam) will be provided.'));
});

test('the LOA question comes first on the Personal & group risk cover page, with Yes, No and Not now', () => {
  const f = schema.fieldsById.loa, idx = V.buildIndex(schema);
  assert.strictEqual(f.l, 'Can we send you a LOA to sign?'); assert.deepStrictEqual(f.o, ['Yes', 'No', 'Not now']);
  const v = t => { const r = V.interpret(idx.byId.loa, t); return r && r.value; };
  assert.strictEqual(v('yes please'), 'Yes'); assert.strictEqual(v('no'), 'No'); assert.strictEqual(v('not now'), 'Not now'); assert.strictEqual(v('maybe later'), 'Not now');
  assert.strictEqual(V.matchQuestion('Can we send you a LOA to sign?', idx, { cur: 'cover' }).id, 'loa');
});

test('the tick-box lists are said any way, and more said later adds to what is ticked', () => {
  const idx = V.buildIndex(schema), v = (id, t) => { const r = V.interpret(idx.byId[id], t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  assert.strictEqual(v('ps_risk', 'the client will send them'), CL); assert.strictEqual(v('ps_risk', 'we will get them through Astute'), AS);
  assert.strictEqual(v('ps_risk', 'both'), CL + '; ' + AS); assert.strictEqual(v('ps_risk', 'not through Astute, she will send them'), CL);
  assert.strictEqual(v('ps_risk', 'something else'), 'Other'); assert.strictEqual(v('ps_risk', 'blah'), 'ERR:no-match');
  assert.strictEqual(v('ps_grp', 'through Astute'), 'ERR:no-match');                                                     // group risk has no Astute choice
  assert.strictEqual(V.mergeMulti(CL, AS, idx.byId.ps_risk.options), CL + '; ' + AS);
  assert.ok(idx.byId.ps_risk.multi && !idx.byId.loa.multi);
  const body = JSON.parse(AI.buildRequest(idx, { sectionId: 'cover', recent: [] }, 'auto', 'x', 'm').messages[0].content);
  assert.ok(body.fields.find(f => f.id === 'ps_risk').multi === true);
  assert.match(AI.SYSTEM, /Policy schedules/);
});

test('Next appointment and the action points are on the Admin page, which is the last page and has no notes box', () => {
  const admin = sec('admin'), idx = V.buildIndex(schema);
  assert.ok(admin.adv && admin.title === 'Admin' && schema.sections[schema.sections.length - 1] === admin);
  assert.deepStrictEqual(admin.blocks.map(b => b.title), ['Next appointment', 'Action Points for Personal Assistant']);
  assert.ok(!idx.notes.some(n => n.sec === 'admin') && !idx.byId.pa_actions);                                              // voice never writes in the action points
  assert.strictEqual(V.parseCommand('go to admin', idx).sec, 'admin');
  assert.ok(!sec('prio').blocks.some(b => b.title === 'Next appointment'));
});

test('the Retirement Planning and Investment Planning areas have their new headings', () => {
  assert.deepStrictEqual([schema.panelsById.ra.title, schema.panelsById.ra.sub], ['Retirement Planning', 'Retirement Annuities']);
  assert.deepStrictEqual([schema.panelsById.inv.title, schema.panelsById.inv.sub], ['Investment Planning', 'Investments']);
});

function pa() {
  const s = fresh();
  set(s, 'fname', 'Thandi'); set(s, 'loa', 'Yes'); set(s, 'has_risk', 'Yes'); store.addRow(s, 'risk', { prov: 'Liberty' }); store.addRow(s, 'risk', { prov: 'Discovery' }); set(s, 'ps_risk', CL);
  set(s, 'has_group', 'Yes'); store.addRow(s, 'grp', { prov: 'Old Mutual' }); set(s, 'ps_grp', CL + '; Other'); set(s, 'ps_grp_ot', 'Employer HR to send the benefit summary.');
  store.addRow(s, 'ret_ra', { prov: 'Allan Gray' }); set(s, 'ps_ra', AS); store.addRow(s, 'ret_pp', { prov: 'Sanlam', type: 'Pension fund' });
  store.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', cl: 'Yes' }); store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Wesbank', cl: 'No' }); store.addRow(s, 'debts', { type: 'Credit card', prov: 'Discovery Bank' });
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'New Business'); set(s, 'fna_req', 'Request a quote'); set(s, 'fna_type', 'New Business'); set(s, 'fna_ins', 'Old Mutual; Discovery'); set(s, 'rgar_req', 'Request an RGAR'); set(s, 'ret_age', '65'); set(s, 'ret_net', 'R 60 000.00'); set(s, 'egar_req', 'Request an EGAR'); store.addRow(s, 'kids', { name: 'A' }); store.addRow(s, 'kids', { name: 'B' });
  store.addRow(s, 'raq', { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00' });
  set(s, 'ref_med', 'Valerie to contact for both'); set(s, 'ref_will', 'Capital Legacy to contact client'); set(s, 'ref_sti', 'Cameron to contact client');
  set(s, 'pr_life', schema.BUDGET); set(s, 'pr_life_cm', 'Revisit once the budget is checked.'); set(s, 'next_appt', '05/11/2026');
  return s;
}
test('the action points: what is still to get, quotes, who contacts the client, and the follow-up appointment, in point form for the assistant', () => {
  const s = pa(), lines = A.local(s), text = A.text(lines);
  assert.deepStrictEqual(lines, [
    'Send Thandi the LOA to sign, so the policy schedules can be drawn from Astute.',
    'Follow up with Thandi for the current policy schedules, asked for in the meeting, for the personal risk policies (Liberty, Discovery).',
    'Follow up with Thandi for the current policy schedules, asked for in the meeting, for the group risk benefits (Old Mutual).',
    'Current policy schedules for the group risk benefits (Old Mutual): Employer HR to send the benefit summary.',
    'Draw the current policy schedules for the retirement annuities (Allan Gray) from Astute once the signed LOA is back.',
    'Ask Thandi how the current policy schedules for the pension and provident funds (Sanlam) will be provided.',
    'Ask Thandi for the credit life details with Nedbank on the home loan.',
    'Ask Thandi whether there is credit life with Discovery Bank on the credit card.',
    'Request a BrightRock Fractured FNA quote (New Business).',
    'Request standard FNA quotes from Old Mutual and Discovery (New Business).',
    'Request a retirement annuity quote from Old Mutual for R 5 000 p.m.',
    'Request a retirement goal analysis (RGAR): retire at 65 on R 60 000 p.m. net in today\'s terms.',
    'Request an education goal analysis (EGAR) for the 2 children.',
    'Ask Valerie to contact Thandi about medical aid and gap cover.', 'Ask Capital Legacy to contact Thandi about the will.', 'Ask Cameron to contact Thandi about short-term insurance.',
    'Follow up with Thandi on Personal Risk Covers: needs to check the budget before deciding (Revisit once the budget is checked).',
    'Set up a follow-up appointment with Thandi for 05/11/2026.']);
  assert.ok(text.split('\n').every(l => l.startsWith('- ')) && !/\b(?:he|she|his|her)\b/i.test(text));                   // point form, and no pronouns for the client
});
test('the action points follow the schedule choices, the LOA answer, the credit life answers and the quotes that are switched off', () => {
  const s = pa(); set(s, 'loa', 'No');
  assert.ok(A.local(s).includes('There is no signed LOA: ask Thandi to send the current policy schedules for the retirement annuities (Allan Gray) directly.'));      // Astute chosen, no signed LOA: ask the client directly
  assert.ok(!A.local(s).some(l => /^Send Thandi the LOA/.test(l)));
  set(s, 'loa', 'Not now'); assert.ok(A.local(s).includes('Do not send the LOA yet: Thandi is not ready to sign. Raise it again at the follow-up appointment.'));
  set(s, 'ps_ra', ''); set(s, 'ps_risk', ''); assert.ok(A.local(s).includes('Ask Thandi how the current policy schedules for the personal risk policies (Liberty, Discovery) will be provided.'));   // not asked yet
  set(s, 'pr_life', schema.NOT_PRIORITY); assert.ok(!A.local(s).some(l => /FNA/.test(l)) && !A.local(s).some(l => /Personal Risk Covers/.test(l)));      // a quote of an area that is not a priority is not asked for
  set(s, 'next_appt', ''); assert.strictEqual(A.local(s).pop(), 'Set up a follow-up appointment with Thandi (date to be agreed).');
  const e = fresh(); assert.deepStrictEqual(A.local(e), ['Set up a follow-up appointment with the client (date to be agreed).']);                            // cover not asked about, nothing recorded: nothing to chase
  set(e, 'has_risk', 'Yes'); assert.strictEqual(A.local(e)[0], 'Ask the client how the current policy schedules for the personal risk policies will be provided.');   // cover said to exist, schedule not asked yet
  const k1 = A.key(A.facts(pa())); set(s, 'fname', 'Sipho'); assert.notStrictEqual(A.key(A.facts(s)), k1);
});
test('the action points request: only the facts go to Claude, with rules for what to write, and the reply is tidied', async () => {
  const s = pa(); store.setField(s, 'cell', '0824541751'); store.setField(s, 'sname', 'Dlamini');
  const f = A.facts(s); assert.ok(!/0824541751|Dlamini/.test(JSON.stringify(f)));                                          // no private number, no surname
  let sent = null;
  const out = await AI.actionPoints({ ask: (system, content) => { sent = { system, content: JSON.parse(content) }; return Promise.resolve('{"points": ["- Send Thandi the LOA to sign.", "  Ask Valerie to contact Thandi about medical aid.  ", "", 5]}'); }, model: 'm', facts: f });
  assert.deepStrictEqual(out, ['Send Thandi the LOA to sign.', 'Ask Valerie to contact Thandi about medical aid.', '5']);
  assert.deepStrictEqual(Object.keys(sent.content.facts).sort(), ['appointment', 'client', 'credit_life', 'instructions', 'letter_of_authority', 'quotes', 'referrals', 'schedules', 'undecided']);
  assert.match(sent.system, /Sitamah Nathoo/); assert.match(sent.system, /point form/); assert.match(sent.system, /never "he", "she", "his" or "her"/); assert.match(sent.system, /no signed LOA/);
  await assert.rejects(AI.actionPoints({ ask: () => Promise.reject(new Error('no connection')), model: 'm', facts: f }), /no connection/);
});
test('the action points are saved with the file, and their state (written for what, by whom, typed over) with them', () => {
  const s = pa(); store.setField(s, 'pa_actions', '- Something'); store.setPa(s, 'abc123', 'claude'); s.pa.edited = true;
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual([back.f.pa_actions.v, back.pa.key, back.pa.by, back.pa.edited], ['- Something', 'abc123', 'claude', true]);
  assert.deepStrictEqual(store.fromJSON(JSON.stringify({ app: 'wr-fact-find' })).pa, { key: '', at: '', by: '', edited: false });         // an older file
});
