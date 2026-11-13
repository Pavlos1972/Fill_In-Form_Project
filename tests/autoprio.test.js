/* Version 3.4: the decisions of Client priorities and quotes needed follow what the earlier pages say.
   Automatic "Not a priority" (five rules), suggestions with a button, take-overs in the action points, the affordability line in the Checks, the starting Type of quote, the one "no" and the lists that got shorter. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const AP = require('../app/js/autoprio.js');
const A = require('../app/js/actions.js');
const validate = require('../app/js/validate.js');
const V = require('../app/js/voice.js');

const NO = schema.NOT_PRIORITY, YES = schema.PRIORITY, REQUIRED = 'Not required';
const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const sets = (s, o) => { Object.keys(o).forEach(k => set(s, k, o[k])); return s; };
const reopen = (s, edit) => { const j = JSON.parse(store.toJSON(s)); if (edit) edit(j); return store.fromJSON(JSON.stringify(j)); };
const preset = (s, id) => s.f[id].st === 'preset';
const autoOn = (s, area, ref) => s.f['pr_' + area].v === NO && preset(s, 'pr_' + area) && s.f[ref].v === REQUIRED && preset(s, ref) && s.f['pr_' + area + '_cm'].v !== '' && preset(s, 'pr_' + area + '_cm');
const untouched = (s, area, ref) => s.f['pr_' + area].v === '' && s.f['pr_' + area + '_cm'].v === '' && s.f[ref].v === '';

test('the one no is plain Not a priority; the older words open as the new, with the status kept', () => {
  assert.strictEqual(NO, 'Not a priority'); assert.strictEqual(schema.NOT_PRIORITY_OLD, 'Not a priority: client not interested'); assert.strictEqual(schema.version, '3.8');
  schema.panels.filter(P => P.dec).forEach(P => assert.ok(schema.fieldsById[P.dec].o.includes(NO) && !schema.fieldsById[P.dec].o.includes(schema.NOT_PRIORITY_OLD), P.id));
  assert.deepStrictEqual(schema.fieldsById.pr_life.o, [YES, schema.UNSURE, schema.BUDGET, NO], 'no new choice: the same four');
  assert.deepStrictEqual(schema.fieldsById.pr_med.o, [YES, NO]);
  const s = reopen(fresh(), j => { j.f.pr_ra = { v: schema.NOT_PRIORITY_OLD, st: 'confirmed' }; j.f.pr_life = { v: schema.NOT_PRIORITY_OLD, st: 'heard' }; });
  assert.deepStrictEqual([s.f.pr_ra.v, s.f.pr_ra.st, s.f.pr_life.v, s.f.pr_life.st], [NO, 'confirmed', NO, 'heard']);
  const ctx = store.ctxFor(s);
  assert.strictEqual(ctx.v('pr_ra'), NO, 'the quote boxes of an older "no" are switched off as before');
});

test('voice: a spoken no gives the one no', () => {
  const idx = V.buildIndex(schema), def = idx.byId.pr_med;
  assert.ok(def, 'pr_med is in the voice index');
  const r = V.interpret(def, 'no, not interested thanks'); assert.strictEqual(r.value, NO);
  assert.strictEqual(V.interpret(def, 'yes please go ahead').value, YES);
});

/* ---------- 1. the five automatic outcomes ---------- */
test('6. Medical Aid: medical aid or a hospital plan through the company is a NO, whatever the gap cover is', () => {
  [['Medical aid', 'No'], ['Medical aid', 'Yes'], ['Hospital plan', 'Not sure']].forEach(([ma, gap]) => {
    const s = fresh(); sets(s, { ma, gap, ma_broker: 'Through company' });
    assert.ok(autoOn(s, 'med', 'ref_med'), ma + ' / ' + gap);
    assert.match(s.f.pr_med_cm.v, /Medical aid is paid through the client's company \(company broker\) and cannot be touched, so gap cover is not pursued either\./);
  });
  ['Other broker', 'Paul K', 'None'].forEach(b => { const s = fresh(); sets(s, { ma: 'Medical aid', ma_broker: b }); assert.ok(untouched(s, 'med', 'ref_med'), 'broker ' + b); });
  const none = fresh(); sets(none, { ma: 'None', ma_broker: 'Through company' }); assert.ok(untouched(none, 'med', 'ref_med'), 'no medical aid');
  const blank = fresh(); assert.ok(untouched(blank, 'med', 'ref_med'), 'a blank form: nothing is decided');
});
test('7. Will: up to date with another provider is a NO (the comment says who and when); with Capital Legacy only when Paul K is the broker', () => {
  const a = fresh(); sets(a, { will: 'Yes', will_up: 'Yes', will_where: 'Other provider', will_where_other: 'Sanlam Trust', will_date: '03/2025' });
  assert.ok(autoOn(a, 'will', 'ref_will')); assert.strictEqual(a.f.pr_will_cm.v, 'Will is up to date (last updated 03/2025) and held with Sanlam Trust, not Capital Legacy.');
  const bare = fresh(); sets(bare, { will: 'Yes', will_up: 'Yes', will_where: 'Other provider' }); assert.strictEqual(bare.f.pr_will_cm.v, 'Will is up to date and held with another provider, not Capital Legacy.');
  const b = fresh(); sets(b, { will: 'Yes', will_up: 'Yes', will_where: 'Capital Legacy', will_broker: 'Paul K' });
  assert.ok(autoOn(b, 'will', 'ref_will')); assert.strictEqual(b.f.pr_will_cm.v, 'Will is up to date with Capital Legacy and we are the broker.');
  [{ will_up: 'No' }, { will: 'No' }, { will_where: 'Capital Legacy', will_broker: 'Other broker' }, { will_where: 'Capital Legacy', will_broker: 'None' }].forEach(o => {
    const s = fresh(); sets(s, Object.assign({ will: 'Yes', will_up: 'Yes', will_where: 'Other provider' }, o)); assert.ok(untouched(s, 'will', 'ref_will'), JSON.stringify(o));
  });
});
test('8. Short Term: only short-term paid through the company is a NO; with the client\'s own broker, a spouse, or no broker it is the adviser\'s decision', () => {
  const s = fresh(); sets(s, { sti: 'Yes', sti_broker: 'Through company' }); assert.ok(autoOn(s, 'st', 'ref_sti')); assert.strictEqual(s.f.pr_st_cm.v, 'Short-term insurance is paid through the client\'s company.');
  [['Yes', 'Other broker'], ['Yes', 'None'], ['Yes', 'Paul K'], ['No', 'Through company'], ['Handled by spouse', 'Through company'], ['Handled by spouse', 'Other broker']].forEach(([sti, b]) => {
    const t = fresh(); sets(t, { sti, sti_broker: b }); assert.ok(untouched(t, 'st', 'ref_sti'), sti + ' ' + b);
  });
});
test('5. EGAR: no children is a NO, and a child on the list takes it back', () => {
  const s = fresh(); set(s, 'has_kids', 'No'); assert.ok(autoOn(s, 'egar', 'egar_req')); assert.strictEqual(s.f.pr_egar_cm.v, 'No children recorded, so there is no education goal to analyse.');
  store.addRow(s, 'kids', { name: 'Mia' });
  assert.strictEqual(s.f.has_kids.v, 'Yes'); assert.ok(untouched(s, 'egar', 'egar_req'), 'a child was added: the outcome goes');
  const y = fresh(); set(y, 'has_kids', 'Yes'); assert.ok(untouched(y, 'egar', 'egar_req'));
});
test('Life, RA, RGAR and Invest are never decided by the form', () => {
  const s = fresh();
  sets(s, { has_risk: 'Yes', has_group: 'Yes', has_ra: 'No', has_pp: 'No', has_inv: 'No', has_kids: 'No', has_debts: 'No', ma: 'Medical aid', ma_broker: 'Through company', sti: 'Yes', sti_broker: 'Through company', will: 'Yes', will_up: 'Yes', will_where: 'Other provider' });
  ['life', 'ra', 'rgar', 'inv'].forEach(a => assert.strictEqual(s.f['pr_' + a].v, '', a));
  assert.deepStrictEqual(Object.keys(AP.AREAS).sort(), ['egar', 'med', 'st', 'will']);
});

/* ---------- behaviour: only an empty decision, goes again, the adviser takes the area over ---------- */
test('it fills only an empty decision, a comment and a referral nobody wrote', () => {
  const s = fresh(); set(s, 'pr_med', YES); set(s, 'ma', 'Medical aid'); set(s, 'ma_broker', 'Through company');
  assert.deepStrictEqual([s.f.pr_med.v, s.f.pr_med.st, s.f.pr_med_cm.v, s.f.ref_med.v], [YES, 'confirmed', '', ''], 'a decision already made is left alone');
  const t = fresh(); sets(t, { pr_will_cm: 'I will send the old will', ref_will: 'Capital Legacy to contact client' }); sets(t, { will: 'Yes', will_up: 'Yes', will_where: 'Other provider' });
  assert.strictEqual(t.f.pr_will.v, NO); assert.strictEqual(t.f.pr_will_cm.v, 'I will send the old will', 'a typed comment stays'); assert.strictEqual(t.f.ref_will.v, 'Capital Legacy to contact client', 'a chosen referral stays');
});
test('it goes again when the fact changes and nothing was touched; an edited comment stays', () => {
  const s = fresh(); sets(s, { ma: 'Medical aid', ma_broker: 'Through company' }); assert.ok(autoOn(s, 'med', 'ref_med'));
  set(s, 'ma_broker', 'Paul K'); assert.ok(untouched(s, 'med', 'ref_med'), 'back to nothing, all three');
  set(s, 'ma_broker', 'Through company'); assert.ok(autoOn(s, 'med', 'ref_med'));
  set(s, 'pr_med_cm', 'Company scheme, client is happy'); set(s, 'ma_broker', 'Other broker');
  assert.strictEqual(s.f.pr_med.v, ''); assert.strictEqual(s.f.pr_med_cm.v, 'Company scheme, client is happy', 'the adviser\'s own words are kept'); assert.strictEqual(s.f.ref_med.v, '');
  const w = fresh(); sets(w, { will: 'Yes', will_up: 'Yes', will_where: 'Other provider', will_where_other: 'Sanlam Trust' }); set(w, 'will_where_other', 'Liberty Trust');
  assert.match(w.f.pr_will_cm.v, /held with Liberty Trust/, 'a comment the form wrote follows the facts');
});
test('the adviser changing the decision takes the area over for good: the form never sets it again', () => {
  const s = fresh(); sets(s, { ma: 'Medical aid', ma_broker: 'Through company' });
  set(s, 'pr_med', YES);
  assert.deepStrictEqual([s.f.pr_med.v, s.f.pr_med.st], [YES, 'confirmed']); assert.strictEqual(s.auto.skip.med, true);
  set(s, 'ma_broker', 'Other broker'); set(s, 'ma_broker', 'Through company'); assert.strictEqual(s.f.pr_med.v, YES, 'still his');
  const c = fresh(); sets(c, { has_kids: 'No' }); set(c, 'pr_egar', '', 'empty'); store.addRow(c, 'kids', { name: 'Mia' }); set(c, 'has_kids', 'No');
  assert.strictEqual(c.f.pr_egar.v, '', 'cleared by hand: it stays cleared'); assert.strictEqual(c.auto.skip.egar, true);
  const o = reopen(s); assert.strictEqual(o.auto.skip.med, true, 'and the file remembers'); assert.strictEqual(o.f.pr_med.v, YES);
  const junk = reopen(fresh(), j => { j.auto = { skip: { med: true, nonsense: true, life: true, egar: 'yes' } }; });
  assert.deepStrictEqual(junk.auto.skip, { med: true }, 'only areas the form can decide, only true');
});
test('an older file opens with the outcomes its facts give, in every empty decision, and keeps what was decided', () => {
  const base = fresh(); sets(base, { has_kids: 'No', ma: 'Medical aid', ma_broker: 'Through company', pr_will: YES });
  const old = reopen(base, j => { j.f.pr_egar = { v: '', st: 'empty' }; j.f.pr_med = { v: '', st: 'empty' }; j.f.pr_med_cm = { v: '', st: 'empty' }; j.f.ref_med = { v: '', st: 'empty' }; delete j.auto; });
  assert.ok(autoOn(old, 'med', 'ref_med')); assert.ok(autoOn(old, 'egar', 'egar_req')); assert.strictEqual(old.f.pr_will.v, YES);
  const decided = reopen(base, j => { j.f.pr_med = { v: NO, st: 'confirmed' }; j.f.pr_med_cm = { v: 'Client said no', st: 'confirmed' }; });
  assert.deepStrictEqual([decided.f.pr_med.st, decided.f.pr_med_cm.v], ['confirmed', 'Client said no']);
  const stillPreset = reopen(base);
  assert.ok(autoOn(stillPreset, 'med', 'ref_med'), 'what the form set comes back as the form\'s, still preset');
});

/* ---------- 2. suggestions ---------- */
test('suggestions: a take-over chance for medical aid, short-term and a will, each with its line and its button', () => {
  const med = fresh(); sets(med, { ma: 'Medical aid', ma_broker: 'Other broker' });
  const m = AP.suggestion(med, 'med');
  assert.strictEqual(m.text, 'Medical aid is privately paid and with another broker. The client may be open to Valerie taking it over.'); assert.strictEqual(m.label, 'Valerie to contact for medical aid');
  const st = fresh(); sets(st, { sti: 'Yes', sti_broker: 'Other broker' });
  assert.strictEqual(AP.suggestion(st, 'st').text, 'Short-term is with the client\'s own broker. If the client is open to a quote, Cameron can be asked.'); assert.strictEqual(AP.suggestion(st, 'st').label, 'Cameron to contact client');
  const sp = fresh(); set(sp, 'sti', 'Handled by spouse'); assert.match(AP.suggestion(sp, 'st').text, /paid by the spouse/);
  const will = fresh(); sets(will, { will: 'Yes', will_up: 'Yes', will_where: 'Capital Legacy', will_broker: 'Other broker' });
  assert.match(AP.suggestion(will, 'will').text, /We have a code with Capital Legacy and can take over as brokers\./); assert.strictEqual(AP.suggestion(will, 'will').label, 'Capital Legacy to contact client');
  [[med, 'med'], [st, 'st'], [will, 'will']].forEach(([s, a]) => assert.ok(untouched(s, a, schema.panelsById[a].cm && AP.AREAS[a].ref), 'a suggestion stores nothing'));
  const through = fresh(); sets(through, { ma: 'Medical aid', ma_broker: 'Through company' }); assert.strictEqual(AP.suggestion(through, 'med'), null, 'company medical aid is decided, not suggested');
  const mine = fresh(); sets(mine, { ma: 'Medical aid', ma_broker: 'Paul K' }); assert.strictEqual(AP.suggestion(mine, 'med'), null);
});
test('suggestions: all children at tertiary level, and no retirement funds for an RGAR', () => {
  const s = fresh(); store.addRow(s, 'kids', { name: 'Mia', stage: 'Tertiary' }); store.addRow(s, 'kids', { name: 'Piet', stage: 'Tertiary' });
  assert.strictEqual(AP.suggestion(s, 'egar').text, 'All children are at tertiary level.'); assert.strictEqual(AP.suggestion(s, 'egar').label, 'Not a priority');
  store.addRow(s, 'kids', { name: 'Zoe', stage: 'High School' }); assert.strictEqual(AP.suggestion(s, 'egar'), null);
  const r = fresh(); assert.strictEqual(AP.suggestion(r, 'rgar'), null, 'not answered: no suggestion');
  sets(r, { has_ra: 'No', has_pp: 'No' }); assert.strictEqual(AP.suggestion(r, 'rgar').text, 'No retirement funds are recorded, so there is nothing to analyse.');
  store.addRow(r, 'inv', { type: 'Living annuity', prov: 'Allan Gray' }); assert.strictEqual(AP.suggestion(r, 'rgar'), null, 'a living annuity is a retirement fund');
  const r2 = fresh(); sets(r2, { has_ra: 'No', has_pp: 'Yes' }); assert.strictEqual(AP.suggestion(r2, 'rgar'), null);
});
test('a suggestion shows only while the decision is empty and the area is not the adviser\'s', () => {
  const s = fresh(); sets(s, { sti: 'Yes', sti_broker: 'Other broker' }); assert.ok(AP.suggestion(s, 'st'));
  set(s, 'pr_st', schema.UNSURE.length ? NO : NO); assert.strictEqual(AP.suggestion(s, 'st'), null, 'a decision is made');
  const t = fresh(); sets(t, { sti: 'Yes', sti_broker: 'Other broker' }); t.auto.skip.st = true; assert.strictEqual(AP.suggestion(t, 'st'), null);
});
test('the button sets Priority, the referral and the comment as the adviser\'s own answer, keeps a comment already written, and takes the area over', () => {
  const s = fresh(); sets(s, { ma: 'Medical aid', ma_broker: 'Other broker' });
  assert.strictEqual(AP.take(s, 'med'), true);
  assert.deepStrictEqual([s.f.pr_med.v, s.f.pr_med.st, s.f.ref_med.v, s.f.ref_med.st], [YES, 'confirmed', 'Valerie to contact for medical aid', 'confirmed']);
  assert.strictEqual(s.f.pr_med_cm.v, 'Medical aid is with another broker. The client is open to Valerie taking it over.'); assert.strictEqual(s.auto.skip.med, true);
  assert.strictEqual(AP.take(s, 'med'), false, 'a second press does nothing');
  const w = fresh(); sets(w, { will: 'Yes', will_up: 'Yes', will_where: 'Capital Legacy', will_broker: 'Other broker', pr_will_cm: 'Client wants a quick call' }); AP.take(w, 'will');
  assert.strictEqual(w.f.pr_will_cm.v, 'Client wants a quick call'); assert.strictEqual(w.f.pr_will.v, YES); assert.strictEqual(w.f.ref_will.v, 'Capital Legacy to contact client');
  const e = fresh(); store.addRow(e, 'kids', { name: 'Mia', stage: 'Tertiary' }); AP.take(e, 'egar');
  assert.deepStrictEqual([e.f.pr_egar.v, e.f.egar_req.v, e.f.pr_egar_cm.v], [NO, REQUIRED, 'All children are at tertiary level.']);
});

/* ---------- take-overs in the action points ---------- */
test('a referral for cover with another broker says it is a take-over, in the facts, the points and the focus text; only on what was answered', () => {
  const s = fresh();
  sets(s, { fname: 'Anna', ma: 'Medical aid', ma_broker: 'Other broker', ref_med: 'Valerie to contact for medical aid', sti: 'Yes', sti_broker: 'Other broker', ref_sti: 'Cameron to contact client',
    will: 'Yes', will_up: 'Yes', will_where: 'Capital Legacy', will_broker: 'Other broker', ref_will: 'Capital Legacy to contact client' });
  const f = A.facts(s); assert.deepStrictEqual(f.referrals.map(r => [r.who, !!r.takeover]), [['Valerie', true], ['Capital Legacy', true], ['Cameron', true]]);
  const text = A.local(s).join('\n');
  assert.match(text, /Ask Valerie to contact the client Anna about medical aid \(currently with another broker: an opportunity to quote; the client will decide\)\./);
  assert.match(text, /Ask Capital Legacy to contact the client Anna about the will \(currently with another broker: an opportunity to quote; the client will decide\)\./);
  assert.match(text, /Ask Cameron to contact the client Anna about short-term insurance \(currently with another broker: an opportunity to quote; the client will decide\)\./);
  const own = fresh(); sets(own, { fname: 'Anna', ma: 'None', ref_med: 'Valerie to contact for medical aid', sti: 'No', ref_sti: 'Cameron to contact client', will: 'No', ref_will: 'Capital Legacy to contact client' });
  assert.ok(!/another broker/.test(A.local(own).join('\n')), 'no medical aid, no short-term, no will: nothing to take over, though the broker boxes start as Other broker');
  const blank = fresh(); sets(blank, { fname: 'Anna', ref_med: 'Valerie to contact for both' }); assert.ok(!/another broker/.test(A.local(blank).join('\n')), 'nothing answered');
  const gap = fresh(); sets(gap, { fname: 'Anna', ma: 'None', gap: 'Yes', gap_broker: 'Other broker', ref_med: 'Valerie to contact for gap cover' }); assert.match(A.local(gap).join('\n'), /gap cover \(currently with another broker/);
  const spouse = fresh(); sets(spouse, { fname: 'Anna', sti: 'Handled by spouse', ref_sti: 'Cameron to contact client' }); assert.ok(!/another broker/.test(A.local(spouse).join('\n')), 'handled by the spouse: no broker is known, so nothing is said about one');
});
test('the focus box also says take-over for a green area', () => {
  const s = fresh(); sets(s, { fname: 'Anna', ma: 'Medical aid', ma_broker: 'Other broker', pr_med: YES, ref_med: 'Valerie to contact for medical aid' });
  assert.match(A.focusLocal(s), /Recommend: Referral: Valerie to contact the client about medical aid \(currently with another broker: an opportunity to quote; the client will decide\)\./);
});

/* ---------- the Checks: affordability ---------- */
const money = (s, rows) => { sets(s, { net: 'R 20 000', exp: 'R 19 000' }); rows.forEach(r => store.addRow(s, r[0], r[1])); return validate.check(store.ctxFor(s)).filter(x => /disposable income/.test(x.msg)); };
test('the Checks say when the monthly amounts asked for are more than the disposable income, and say nothing otherwise', () => {
  const over = money(fresh(), [['raq', { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 600' }], ['invq', { req: 'Request a quote', monthly: 'R 500' }]]);
  assert.strictEqual(over.length, 1); assert.strictEqual(over[0].id, 'disp');
  assert.strictEqual(over[0].msg, 'The RA, investment and reduced quotes ask for R 1 100.00 a month, but the disposable income is R 1 000.00. The client may need to check their budget.');
  assert.strictEqual(money(fresh(), [['raq', { req: 'Request a quote', monthly: 'R 900' }]]).length, 0, 'within what is left');
  assert.strictEqual(money(fresh(), [['raq', { req: 'Not required', monthly: 'R 9 000' }]]).length, 0, 'only what is asked for counts');
  assert.strictEqual(money(fresh(), [['redq', { req: 'Request a quote', amt: 'R 1 500' }]]).length, 1, 'reduced quotes count');
  const blank = fresh(); store.addRow(blank, 'raq', { req: 'Request a quote', monthly: 'R 5 000' }); assert.strictEqual(validate.check(store.ctxFor(blank)).filter(x => /disposable income/.test(x.msg)).length, 0, 'no disposable income worked out yet');
});

/* ---------- Type of quote starts ---------- */
test('Type of quote starts as New Business or Servicing for a quote that is asked for, goes again, and never replaces a type that was chosen', () => {
  const s = fresh(); set(s, 'has_risk', 'No');
  assert.strictEqual(s.f.fna_type.v, '', 'not asked for yet: nothing');
  set(s, 'fna_req', 'Request a quote'); set(s, 'bf_fna_req', 'Request a quote');
  assert.deepStrictEqual([s.f.fna_type.v, s.f.fna_type.st, s.f.bf_fna_type.v], ['New Business', 'preset', 'New Business']);
  set(s, 'has_risk', 'Yes'); assert.strictEqual(s.f.fna_type.v, '', 'a policy not yet recorded: no start value');
  store.addRow(s, 'risk', { prov: 'Liberty', broker: 'Paul K' }); set(s, 'has_risk', 'Yes'); assert.strictEqual(s.f.fna_type.v, 'Servicing');
  set(s, 'fna_type', 'New Business'); store.setCell(s, 'risk', 0, 'broker', 'Other broker'); assert.strictEqual(s.f.fna_type.v, 'New Business', 'a chosen type stays');
  set(s, 'fna_req', 'Not required'); assert.strictEqual(s.f.fna_type.v, '', 'a quote not required keeps no type (as before)');
  assert.strictEqual(store.addRow(fresh(), 'redq', {}).d.type, '', 'no start value without the facts');
  const t = fresh(); set(t, 'has_risk', 'No'); assert.strictEqual(store.addRow(t, 'redq', {}).d.type, 'New Business'); assert.strictEqual(store.addRow(t, 'bfred', { type: 'Servicing' }).d.type, 'Servicing');
});

/* ---------- the lists that got shorter, and the ones that changed ---------- */
test('the lists: two answers for every quote request, the Investment Capture Sheet\'s insurers on RA and investment quotes, two more investment products, Not required in the referral boxes', () => {
  ['bfred', 'redq', 'raq', 'invq'].forEach(k => assert.deepStrictEqual(schema.lists[k].cols[0].o, ['Request a quote', 'Not required'], k));
  ['bs_req', 'cl_req', 'km_req', 'sf_req', 'bf_sf_req'].forEach(id => assert.deepStrictEqual(schema.fieldsById[id].o, ['Request a quote', 'Not required'], id));
  assert.deepStrictEqual(schema.fieldsById.fna_req.o, ['Request a quote', 'Not required', 'No FNA done']);
  const ins = ['Old Mutual', 'Momentum', 'Sanlam', 'Liberty', 'Discovery', 'Allan Gray', 'Stanlib', 'Other'];
  assert.deepStrictEqual(schema.lists.raq.cols.find(c => c.k === 'ins').o, ins); assert.deepStrictEqual(schema.lists.invq.cols.find(c => c.k === 'ins').o, ins);
  assert.ok(!ins.includes('BrightRock'), 'BrightRock sells risk cover only');
  assert.deepStrictEqual(schema.lists.invq.cols.find(c => c.k === 'product').o, ['Tax-free savings', 'Endowment', 'Unit trust / voluntary funds', 'Living annuity', 'Offshore', 'Other']);
  assert.deepStrictEqual(schema.lists.redq.cols.find(c => c.k === 'ins').o.slice(0, 2), ['Old Mutual', 'Momentum'], 'the life insurers\' list is unchanged');
  assert.deepStrictEqual(schema.fieldsById.ref_med.o, ['Valerie to contact for medical aid', 'Valerie to contact for gap cover', 'Valerie to contact for both', 'Not required']);
  assert.strictEqual(schema.fieldsById.pr_life_cm.rows, 3, 'the comment box has room for a written reason');
});
test('a row of an older file that says Cannot afford now or Not interested keeps what it says', () => {
  const s = reopen(fresh(), j => { j.l.raq = [{ d: { req: 'Cannot afford now', ins: 'Old Mutual', monthly: 'R 500', lump: '' }, st: 'confirmed' }, { d: { req: 'Not interested', ins: 'Sanlam', monthly: '', lump: '' }, st: 'confirmed' }]; });
  assert.deepStrictEqual(s.l.raq.map(r => r.d.req), ['Cannot afford now', 'Not interested']);
  assert.strictEqual(A.facts(s).quotes.filter(q => /Retirement annuity/.test(q.quote)).length, 0, 'neither is a request');
});
