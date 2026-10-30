/* The two kinds of life quote: BrightRock Fractured (built on the BrightRock Risk Calculation page) and Standard (any insurer), the same three rows in each; the pages that were reshaped for them. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const S = require('../app/js/summary.js');
const A = require('../app/js/actions.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const sec = id => schema.sections.find(x => x.id === id);
const idx = V.buildIndex(schema);
const life = () => sec('prio').blocks.filter(b => b.pri === 'life' && !b.head);
const shows = (s, b) => calc.showIf(b.cond, store.ctxFor(s));

test('the Life area has the same three quote rows twice: BrightRock Fractured and Standard', () => {
  const lanes = life().filter(b => b.lane);
  assert.deepStrictEqual(lanes.map(b => b.lane + ':' + b.row), ['br:fna', 'std:fna', 'br:sf', 'std:sf', 'br:red', 'std:red']);             // in row order, so the two kinds sit side by side
  assert.deepStrictEqual(lanes.map(b => (b.fields || []).map(f => f.id).join() || b.list),
    ['bf_fna_req,bf_fna_type', 'fna_req,fna_type,fna_ins', 'bf_sf_req,bf_sf_type', 'sf_req,sf_type,sf_ins', 'bfred', 'redq']);
  assert.ok(!schema.fieldsById.bf_fna_ins && !schema.lists.bfred.cols.some(c => c.k === 'ins'));                                                // BrightRock is the only insurer: no insurer box
  assert.deepStrictEqual(schema.lists.bfred.cols.map(c => c.k), ['req', 'type', 'amt']);
  assert.deepStrictEqual(schema.lists.redq.cols.map(c => c.k), ['req', 'type', 'ins', 'amt']);
  assert.ok(schema.fieldsById.fna_ins.t === 'multi' && schema.fieldsById.fna_ins.o.includes('BrightRock (standard)') && !schema.fieldsById.fna_ins.o.includes('BrightRock'));      // BrightRock standard is a standard quote
  assert.ok(schema.lists.bfred.dense && schema.lists.redq.dense);
});

test('a quote that is not required keeps no type, and the standard one no insurers, in either kind', () => {
  const s = fresh();
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'Servicing'); set(s, 'bf_fna_req', 'Not required'); assert.strictEqual(s.f.bf_fna_type.v, '');
  set(s, 'bf_sf_req', 'Request a quote'); set(s, 'bf_sf_type', 'New Business'); set(s, 'bf_sf_req', 'Not required'); assert.strictEqual(s.f.bf_sf_type.v, '');
  set(s, 'fna_req', 'Request a quote'); set(s, 'fna_type', 'New Business'); set(s, 'fna_ins', 'Old Mutual; Discovery'); set(s, 'fna_req', 'Not required');
  assert.deepStrictEqual([s.f.fna_type.v, s.f.fna_ins.v], ['', '']);
  store.addRow(s, 'bfred', { req: 'Request a quote', type: 'New Business', amt: 'R 2 500.00' }); store.setCell(s, 'bfred', 0, 'req', 'Not required');
  assert.deepStrictEqual(s.l.bfred[0].d, { req: 'Not required', type: '', amt: '' });
  const b = life().find(x => x.lane === 'br' && x.row === 'fna'), std = life().find(x => x.lane === 'std' && x.row === 'fna');
  assert.ok(!calc.showIf(b.fields[1].cond, store.ctxFor(s)) && !calc.showIf(std.fields[2].cond, store.ctxFor(s)));                              // the type and the insurers go away with the request
  set(s, 'bf_fna_req', 'Request a quote'); assert.ok(calc.showIf(b.fields[1].cond, store.ctxFor(s)));
});

test('the shortfall needs a group in both kinds, and a quote of an area that is not a priority is switched off in both', () => {
  const s = fresh(), sf = life().filter(b => b.row === 'sf');
  assert.ok(sf.every(b => b.condMsg === sf[0].condMsg) && sf.filter(b => b.pdfMsg).length === 1);                                              // one message, one place in the PDF
  set(s, 'has_group', 'Yes'); assert.ok(sf.every(b => shows(s, b)));
  set(s, 'has_group', 'No'); assert.ok(sf.every(b => !shows(s, b)));
  set(s, 'has_group', 'Yes'); set(s, 'pr_life', schema.NOT_PRIORITY);
  assert.ok(life().filter(b => b.lane || b.sqd).every(b => !shows(s, b)));                                                                    // also the standard quote details
  set(s, 'pr_life', schema.PRIORITY); assert.ok(life().filter(b => b.lane || b.sqd).filter(b => b.row !== 'sf').every(b => shows(s, b)));
});

test('the standard quote details moved to the Life area; the BrightRock Risk Calculation page keeps only the fractured covers', () => {
  const ids = (blocks) => [].concat.apply([], blocks.map(b => (b.fields || []).map(f => f.id)));
  const std = life().filter(b => b.sqd);
  assert.deepStrictEqual(std.map(b => b.title), ['Life cover: standard', 'Permanent disability: standard', 'Income protection / sickness benefit: standard', 'Dread disease: standard']);
  ['lc_sa', 'lc_term', 'lc_termv', 'lc_aci', 'lc_aciv', 'lc_abiv', 'lc_cmt', 'pd_sa', 'pd_term', 'ips_age', 'ips_amt', 'ips_wait', 'ips_abiv', 'dds_cover', 'dds_term', 'dds_abiv', 'dds_cmt'].forEach(id => assert.ok(ids(std).includes(id), id));   // the same ids, so nothing is lost
  assert.ok(!ids(sec('calc').blocks).some(id => /^(?:lc_sa|pd_sa|ips_|dds_|pd_term|lc_term)/.test(id)));
  ['lc_hh', 'lc_f_aci', 'pd_ccabi', 'ip_age', 'ip_amt', 'ip_hh', 'dd_cover', 'dd_abiv', 'n_calc'].forEach(id => assert.ok(ids(sec('calc').blocks).includes(id), id));
  const s = fresh(); assert.strictEqual(s.f.ips_age.v, '65'); assert.strictEqual(s.f.dds_cover.v, 'R 500 000.00'); assert.strictEqual(s.f.dd_cover.v, 'R 500 000.00');   // the starting answers are unchanged
});

test('files saved before the two kinds: what was asked of BrightRock moves to BrightRock Fractured, the rest stays Standard', () => {
  const s = fresh();
  set(s, 'fna_req', 'Request a quote'); set(s, 'fna_type', 'New Business'); set(s, 'fna_ins', 'BrightRock');
  set(s, 'sf_req', 'Request a quote'); set(s, 'sf_type', 'Servicing'); set(s, 'sf_ins', 'Old Mutual');
  store.addRow(s, 'redq', { req: 'Request a quote', type: 'New Business', ins: 'BrightRock', amt: '2500' }); store.addRow(s, 'redq', { req: 'Request a quote', ins: 'Discovery', amt: '1800' });
  const old = JSON.parse(store.toJSON(s)); ['bf_fna_req', 'bf_fna_type', 'bf_sf_req', 'bf_sf_type'].forEach(id => delete old.f[id]); delete old.l.bfred;           // as saved before
  const t = store.fromJSON(JSON.stringify(old));
  assert.deepStrictEqual([t.f.bf_fna_req.v, t.f.bf_fna_type.v, t.f.fna_req.v, t.f.fna_type.v, t.f.fna_ins.v], ['Request a quote', 'New Business', '', '', '']);
  assert.deepStrictEqual([t.f.sf_req.v, t.f.sf_type.v, t.f.sf_ins.v, t.f.bf_sf_req.v], ['Request a quote', 'Servicing', 'Old Mutual', '']);
  assert.deepStrictEqual(t.l.bfred.map(r => r.d), [{ req: 'Request a quote', type: 'New Business', amt: 'R 2 500.00' }]);
  assert.deepStrictEqual(t.l.redq.map(r => r.d.ins), ['Discovery']);
  const again = store.fromJSON(store.toJSON(t));                                                                                                // a file saved since is left as it is
  assert.deepStrictEqual([again.f.bf_fna_req.v, again.l.bfred.length, again.l.redq.length], ['Request a quote', 1, 1]);
  assert.strictEqual(store.fromJSON(JSON.stringify({ app: 'wr-fact-find' })).l.bfred.length, 0);                                                // a file with nothing
});

test('the standard insurers are a tick-box list: several can be named, and one that is not in the list is kept', () => {
  const f = idx.byId.fna_ins;
  assert.ok(f.multi && f.mk === 'ins' && f.options.length === 10);
  const say = t => { const r = V.interpret(f, t); return r && (r.error ? 'ERR:' + r.error : r.value); };
  assert.strictEqual(say('Old Mutual and Discovery'), 'Old Mutual; Discovery');
  assert.strictEqual(say('let us ask Sanlam, Liberty and Momentum'), 'Momentum; Liberty; Sanlam'.split('; ').sort((a, b) => f.options.indexOf(a) - f.options.indexOf(b)).join('; '));   // in the order of the list
  assert.strictEqual(say('BrightRock standard'), 'BrightRock (standard)');
  assert.strictEqual(say('another insurer'), 'Other');
  assert.strictEqual(say('nobody in particular'), 'ERR:no-match');
  assert.strictEqual(V.mergeMulti('Old Mutual', 'Discovery', f.options), 'Old Mutual; Discovery');
  assert.strictEqual(V.mergeMulti('FNB; Old Mutual', 'Discovery', f.options), 'Old Mutual; Discovery; FNB');                                    // an insurer typed in an older file stays
});

test('voice: a question or an answer about a quote goes to the kind it names, and a plain one to the standard quote', () => {
  const ask = (t) => { const r = V.matchQuestion(t, idx, { cur: 'prio', isEmpty: () => true }); return r && r.id; };
  assert.strictEqual(ask('What is the FNA quote?'), 'fna_req');
  assert.strictEqual(ask('Shall we do a fractured FNA quote?'), 'bf_fna_req');
  assert.strictEqual(ask('What about the BrightRock fractured shortfall quote?'), 'bf_sf_req');
  assert.strictEqual(ask('And the standard shortfall quote?'), 'sf_req');
  assert.strictEqual(ask('What type of fractured FNA quote is it?'), 'bf_fna_type');
  assert.strictEqual(ask('What type of standard FNA quote is it?'), 'fna_type');
  assert.strictEqual(idx.byId.bf_fna_req.label, 'BrightRock Fractured FNA quote');                                                              // what Claude is shown tells them apart
  assert.strictEqual(idx.byId.fna_req.label, 'Standard FNA quote');
  assert.ok(idx.lists.bfred && idx.lists.redq);
});

test('voice: the pages were renamed and the standard quotes are on the priorities page', () => {
  const hit = t => { const h = V.plan('go to ' + t, idx, { cur: 'info', target: null, answered: false, value: () => '', visible: () => true, rows: () => [] }).actions[0]; return h && h.cmd && h.cmd.sec; };
  assert.strictEqual(hit('the BrightRock risk calculation'), 'calc');
  assert.strictEqual(hit('risk calculation'), 'calc');
  assert.strictEqual(hit('client priorities and quotes needed'), 'prio');
  assert.strictEqual(hit('standard quotes'), 'prio');
});

test('the summary and the action points name the kind of quote', () => {
  const s = fresh();
  set(s, 'fname', 'Thandi'); set(s, 'pr_life', schema.PRIORITY); set(s, 'has_group', 'Yes');
  set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'New Business'); set(s, 'bf_sf_req', 'Request a quote');
  store.addRow(s, 'bfred', { req: 'Request a quote', type: 'New Business', amt: 'R 2 500.00' });
  set(s, 'fna_req', 'Request a quote'); set(s, 'fna_type', 'New Business'); set(s, 'fna_ins', 'Old Mutual; Discovery');
  set(s, 'sf_req', 'Request a quote'); set(s, 'sf_ins', 'Sanlam');
  store.addRow(s, 'redq', { req: 'Request a quote', ins: 'Old Mutual', amt: 'R 2 500.00' });
  assert.deepStrictEqual(A.local(s).filter(l => /quote|appointment/.test(l)), [
    'Request a BrightRock Fractured FNA quote (New Business): BR FNA Quote based on Fact Find.',
    'Request a BrightRock Fractured shortfall quote: BR Shortfall Quote based on BR NA minus Group Risk.',
    'Request a BrightRock Fractured reduced quote (New Business) for R 2 500 p.m.: BR Reduced Quote based on Shortfall Quote.',
    'Request standard FNA quotes from Old Mutual and Discovery (New Business).',
    'Request a standard shortfall quote from Sanlam.',
    'Request a standard reduced quote from Old Mutual for R 2 500 p.m.',
    'Set up a follow-up appointment with Thandi (date to be agreed).']);
  assert.deepStrictEqual(A.brightRockAsked(s), ['FNA (New Business)', 'Shortfall', 'Reduced (New Business) R 2 500 p.m.']);
  assert.deepStrictEqual(A.facts(s).quotes.map(q => q.kind), ['BrightRock Fractured', 'BrightRock Fractured', 'BrightRock Fractured', 'Standard', 'Standard', 'Standard']);
  const pts = S.local(s, 'life');
  assert.ok(pts.includes('BrightRock Fractured quote asked for: FNA quote (new business), shortfall quote, reduced quote R 2 500 p.m.'), pts.join(' | '));
  assert.ok(pts.includes('Standard quote asked for: FNA quote (new business) from Old Mutual, Discovery, shortfall quote from Sanlam, reduced quote R 2 500 p.m. from Old Mutual'), pts.join(' | '));
  const facts = JSON.stringify(S.labelled(S.areaData(s, 'life')));
  assert.ok(/BrightRock Fractured FNA quote/.test(facts) && /Standard FNA quote/.test(facts) && /Standard FNA insurers/.test(facts));      // the two kinds do not overwrite each other for Claude
  set(s, 'pr_life', schema.NOT_PRIORITY); assert.deepStrictEqual(A.brightRockAsked(s), []);                                                       // an area that is not a priority asks for nothing
});

test('Claude is told about the two kinds of life quote, for reading the talk, the summaries and the action points', () => {
  assert.match(AI.SYSTEM, /BrightRock Fractured/); assert.match(AI.SYSTEM, /bf_fna_req/); assert.match(AI.SYSTEM, /prefer the Standard box/);
  assert.match(AI.SUMMARY_SYSTEM, /BrightRock Fractured/); assert.match(AI.ACTIONS_SYSTEM, /"insurers"/);
});

test('the Medical, will & short-term page keeps every box and notes box, two blocks to a row', () => {
  const o = sec('other');
  assert.deepStrictEqual(o.blocks.map(b => b.title + (b.half ? ' (half)' : '')), ['Medical aid (half)', 'Gap cover (half)', 'Will', 'Short-term insurance']);
  const ids = [].concat.apply([], o.blocks.map(b => b.fields.map(f => f.id)));
  assert.deepStrictEqual(ids, ['ma', 'ma_prov', 'ma_plan', 'ma_broker', 'n_ma', 'gap', 'gap_prov', 'gap_broker', 'n_gap', 'will', 'will_up', 'will_where', 'will_where_other', 'will_broker', 'will_date', 'n_will',
    'sti', 'sti_broker', 'sti_car', 'sti_house', 'sti_struct', 'sti_personal', 'sti_biz', 'sti_biz_spend', 'n_sti']);
  assert.ok(o.blocks.every(b => b.layout === 'g12') && o.blocks.every(b => b.fields.every(f => f.id.startsWith('n_') || f.s)) && !o.roomy);
  ['n_ma', 'n_gap', 'n_will', 'n_sti'].forEach(id => assert.strictEqual(schema.fieldsById[id].rows, 2));                                           // each notes box starts two lines high
});

test('the RGAR area says what the report needs', () => {
  const b = sec('prio').blocks.find(x => x.pri === 'rgar' && !x.head);
  assert.match(b.help, /current or paid-up retirement annuities/); assert.match(b.help, /pension and\/or provident fund\(s\)/); assert.match(b.help, /proof of income where there is a pension and\/or provident fund/);
});

test('voice reads the standard quote details, each cover under its own label, and "make a note" goes to the page\'s notes box', () => {
  const ids = ['lc_sa', 'lc_term', 'lc_termv', 'lc_aci', 'lc_aciv', 'lc_abiv', 'pd_sa', 'pd_term', 'pd_abiv', 'ips_age', 'ips_amt', 'ips_wait', 'ips_abiv', 'dds_cover', 'dds_term', 'dds_abiv'];
  ids.forEach(id => assert.ok(idx.byId[id] && idx.byId[id].sec === 'prio', id));
  assert.deepStrictEqual(new Set(ids.map(id => idx.byId[id].label)).size, ids.length);                                                         // no two the same for Claude
  assert.strictEqual(idx.byId.lc_sa.label, 'Standard life cover: Sum assured (R)');
  assert.deepStrictEqual(idx.notes.filter(n => n.sec === 'prio').map(n => n.id), ['n_prio']);                                                  // the comments boxes of the table are typed only
  ['lc_cmt', 'pd_cmt', 'ips_cmt', 'dds_cmt'].forEach(id => assert.ok(!idx.byId[id] && !idx.noteById[id], id));
  const ask = t => { const r = V.matchQuestion(t, idx, { cur: 'prio', isEmpty: () => true }); return r && r.id; };
  assert.strictEqual(ask('What is the sum assured for the permanent disability?'), 'pd_sa');
  assert.strictEqual(ask('What is the sum assured for the life cover?'), 'lc_sa');
  assert.strictEqual(ask('What is the standard life cover term?'), 'lc_term');
  assert.strictEqual(V.interpret(idx.byId.lc_sa, 'two million rand').value, 'R 2 000 000.00');
  const s = fresh(), c = store.ctxFor(s);
  assert.ok(calc.showIf(idx.byId.lc_sa.cond, c)); set(s, 'pr_life', schema.NOT_PRIORITY); assert.ok(!calc.showIf(idx.byId.lc_sa.cond, c));      // switched off with the area
  assert.ok(!idx.fields.some(f => f.sec === 'calc'));                                                                                          // BrightRock Risk Calculation has no box voice reads
});
