/* The Investment Capture Sheet (app/capture-sheet.html): its form definition, its answers, the linked boxes, the Risk Tolerance questionnaire (scoring, profile, reference, file names),
   Load from Fact Find and Load from Short Risk file, saving and reopening, and the Checks. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/cs-schema.js');
const store = require('../app/js/cs-store.js');
const check = require('../app/js/cs-check.js');
const RT = require('../app/js/cs-rt-data.js');
const ffStore = require('../app/js/store.js');
const srStore = require('../app/js/sr-store.js');

const named = (n, v) => { const s = store.blank(); store.setField(s, 'fname', n); store.setField(s, 'sname', v); return s; };

test('the form: five pages in the order of the work, the Declaration with the application and the questionnaire after it', () => {
  assert.deepStrictEqual(schema.pages.map(p => p.id), ['product', 'contact', 'bank', 'funds', 'risk']);
  assert.deepStrictEqual(schema.pages.map(p => p.title), ['Product & client', 'Contact & work', 'Beneficiaries & bank', 'Source of funds', 'Risk tolerance']);
  assert.deepStrictEqual(schema.pages[3].sections, ['funds', 'declare'], 'the Declaration is part of the application: it stays with Source of funds');
  assert.deepStrictEqual(schema.pages[4].sections, ['risk', 'risk_result']);
  const order = schema.sections.map(s => s.id);
  assert.ok(order.indexOf('funds') < order.indexOf('declare') && order.indexOf('declare') < order.indexOf('risk') && order.indexOf('risk') < order.indexOf('risk_result'));
  assert.strictEqual(schema.version, '1.0');
  assert.strictEqual(new Set(schema.fieldIds).size, schema.fieldIds.length, 'no box id is used twice');
  schema.sections.forEach(s => assert.ok(schema.pageOf[s.id], s.id + ' is on a page'));
});

test('the questionnaire is 24 boxes: the confirmation, 18 statements and 5 capacity questions, with the result worked out in three boxes', () => {
  const risk = schema.sectionsById.risk;
  assert.strictEqual(risk.fields.length, 24);
  assert.deepStrictEqual(risk.fields.slice(0, 3).map(f => f.id), ['rt_understand', 'rt_s1', 'rt_s2']);
  assert.strictEqual(risk.fields.filter(f => f.rt === 'scale').length, 18);
  assert.strictEqual(risk.fields.filter(f => f.rt === 'cap').length, 5);
  assert.deepStrictEqual(schema.sectionsById.risk_result.fields.map(f => f.id), ['risk_profile', 'risk_score', 'risk_ref']);
  schema.sectionsById.risk_result.fields.forEach(f => assert.ok(f.calc && f.opt, f.id + ' is worked out, not typed'));
});

/* The questionnaire is a copy of the Risk Tolerance website's (risktolerance.netlify.app): these figures are pinned so a change to the copy is noticed. */
test('the scoring is the Risk Tolerance website’s: 18 statements, six of them counted the other way round, a total out of 90, five profiles', () => {
  assert.strictEqual(RT.STATEMENTS.length, 18); assert.strictEqual(RT.CAPACITY.length, 5);
  assert.deepStrictEqual(RT.SCALE, ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree']);
  assert.deepStrictEqual([...RT.REVERSED].sort((a, b) => a - b), [2, 5, 7, 8, 12, 15]);
  const all = c => RT.totalScore(new Array(18).fill(c));
  assert.strictEqual(all(0), 12 * 1 + 6 * 5, 'all Strongly disagree: 42'); assert.strictEqual(all(2), 54, 'all Neither: 54'); assert.strictEqual(all(4), 12 * 5 + 6 * 1, 'all Strongly agree: 66');
  assert.strictEqual(RT.scoreFor(1, 4), 5); assert.strictEqual(RT.scoreFor(2, 4), 1); assert.strictEqual(RT.scoreFor(1, 0), 1); assert.strictEqual(RT.scoreFor(2, 0), 5);
  assert.deepStrictEqual(RT.CATEGORIES.map(c => [c.name, c.min, c.max]), [['Conservative', 18, 37], ['Cautious', 38, 47], ['Moderate', 48, 57], ['Moderately aggressive', 58, 67], ['Aggressive', 68, 90]]);
  for (let sc = 18; sc <= 90; sc++) assert.ok(RT.categoryFor(sc), 'every score from 18 to 90 has a profile: ' + sc);
  assert.strictEqual(RT.categoryFor(52).name, 'Moderate'); assert.strictEqual(RT.categoryFor(37).name, 'Conservative'); assert.strictEqual(RT.categoryFor(38).name, 'Cautious'); assert.strictEqual(RT.categoryFor(68).name, 'Aggressive');
  RT.CATEGORIES.forEach(c => assert.ok(c.description.length > 80, c.name + ' has its description'));
  assert.deepStrictEqual(RT.CAPACITY.map(c => c.options.length), [3, 4, 3, 4, 3]);
  assert.deepStrictEqual(RT.CAPACITY.map(c => c.field), ['cap_1', 'cap_2', 'cap_3', 'cap_4', 'cap_5'], 'the PDF form’s own field names');
});

function answerAll(s, choice) {
  for (let i = 1; i <= 18; i++) store.setField(s, 'rt_s' + i, RT.SCALE[typeof choice === 'function' ? choice(i) : choice]);
  for (let i = 1; i <= 5; i++) store.setField(s, 'rt_c' + i, RT.CAPACITY[i - 1].options[1]);
}

test('the score and the profile appear when the 18 statements are answered, and the reference when the 5 questions are too', () => {
  const s = named('Sample', 'Client');
  assert.deepStrictEqual(['risk_profile', 'risk_score', 'risk_ref'].map(id => s.f[id].v), ['', '', '']);
  for (let i = 1; i <= 17; i++) store.setField(s, 'rt_s' + i, 'Agree');
  let r = store.rtSync(s, true); assert.strictEqual(r.scoreReady, false); assert.strictEqual(s.f.risk_score.v, '', 'not until all 18');
  store.setField(s, 'rt_s18', 'Agree'); r = store.rtSync(s, true);
  assert.strictEqual(r.scoreReady, true); assert.strictEqual(s.f.risk_score.v, String(RT.totalScore(new Array(18).fill(3)))); assert.strictEqual(s.f.risk_profile.v, RT.categoryFor(RT.totalScore(new Array(18).fill(3))).name);
  assert.strictEqual(s.f.risk_ref.v, '', 'no reference until the capacity questions are answered');
  for (let i = 1; i <= 5; i++) store.setField(s, 'rt_c' + i, RT.CAPACITY[i - 1].options[0]);
  r = store.rtSync(s, true); assert.strictEqual(r.complete, true);
  assert.match(s.f.risk_ref.v, /^RT-\d{8}-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
});
test('a changed answer gives a new reference; opening the file again does not; an incomplete questionnaire has none', () => {
  const s = named('Sample', 'Client'); answerAll(s, 2); store.rtSync(s, true);
  const first = s.f.risk_ref.v; assert.ok(first);
  store.rtSync(s, false); assert.strictEqual(s.f.risk_ref.v, first, 'only a change makes a new one');
  store.setField(s, 'rt_s1', 'Agree'); store.rtSync(s, true); assert.notStrictEqual(s.f.risk_ref.v, first);
  store.setField(s, 'rt_c3', ''); store.rtSync(s, true); assert.strictEqual(s.f.risk_ref.v, ''); assert.ok(s.f.risk_score.v, 'the score stays while the 18 statements are answered');
  store.setField(s, 'rt_s5', ''); store.rtSync(s, true); assert.deepStrictEqual(['risk_profile', 'risk_score'].map(id => s.f[id].v), ['', '']);
});
test('answers that are not one of the questionnaire’s choices do not count', () => {
  const s = store.blank(); store.setField(s, 'rt_s1', 'Maybe'); store.setField(s, 'rt_c1', 'whatever');
  const r = store.rtStatus(s); assert.strictEqual(r.statements, 0); assert.strictEqual(r.capacity, 0);
});
test('the questionnaire counts in the progress like any other boxes, and its three result boxes do not', () => {
  const s = store.blank(), before = store.counts(s);
  answerAll(s, 2); store.setField(s, 'rt_understand', 'Confirmed'); store.rtSync(s, true);
  const after = store.counts(s);
  assert.strictEqual(before.left - after.left, 24, '24 boxes answered');
  assert.strictEqual(store.leftIn(s, schema.sectionsById.risk), 0);
  assert.strictEqual(store.leftIn(s, schema.sectionsById.risk_result), 0, 'the result is worked out, not asked');
});

test('the files are named in the Fact Find’s way: the application with the insurer, the questionnaire on its own', () => {
  const s = named('Sitamah', 'Nathoo'); store.setField(s, 'date', '04/11/2026');
  assert.strictEqual(store.pdfFileName(s), 'Provider Capture Sheet - 04.11.26 - (Sitamah Nathoo)');
  store.setField(s, 'provider', 'Old Mutual'); assert.strictEqual(store.pdfFileName(s), 'OM Capture Sheet - 04.11.26 - (Sitamah Nathoo)');
  assert.strictEqual(store.baseFileName(s), store.pdfFileName(s), 'the PDF and the saved file share one name');
  store.setField(s, 'provider', 'Sanlam'); assert.strictEqual(store.pdfFileName(s), 'Sanlam Capture Sheet - 04.11.26 - (Sitamah Nathoo)');
  assert.strictEqual(store.rtFileName(s), 'Risk Tolerance - 04.11.26 - (Sitamah Nathoo)');
  assert.strictEqual(store.rtFileName(store.blank()).endsWith('(New client)'), true);
});

test('the Old Mutual product names are offered while the insurer is Old Mutual, and the box still takes any name', () => {
  assert.strictEqual(schema.suggestions['Old Mutual'].length, 8);
  assert.ok(schema.suggestions['Old Mutual'].includes('OM Tax Free recurring') && schema.suggestions['Old Mutual'].includes('OM Flexi Investment Plan'));
  assert.strictEqual(schema.suggestions.Sanlam, undefined);
  assert.ok(schema.fieldsById.product_name.suggest && !schema.fieldsById.product_name.t, 'a typed box with a list, not a closed choice');
  const s = store.blank(); store.setField(s, 'product_name', 'Sanlam Tax Free Flexi'); assert.strictEqual(s.f.product_name.v, 'Sanlam Tax Free Flexi');
});

test('linked boxes: the old policy, the foreign tax number, where it originated and the marriage boxes follow their question', () => {
  const s = store.blank();
  store.setField(s, 'replace', 'Yes'); store.setField(s, 'old_policy', 'P-1'); assert.strictEqual(store.shown(s, 'old_policy'), true);
  store.setField(s, 'replace', 'No'); assert.strictEqual(s.f.old_policy.v, ''); assert.strictEqual(store.shown(s, 'old_policy'), false);
  store.setField(s, 'foreign_tax', 'Yes'); store.setField(s, 'foreign_tax_no', 'X1'); store.setField(s, 'foreign_tax', 'No'); assert.strictEqual(s.f.foreign_tax_no.v, '');
  store.setField(s, 'own_knowledge', 'No'); store.setField(s, 'origin', 'Bank'); store.setField(s, 'own_knowledge', 'Yes'); assert.strictEqual(s.f.origin.v, '');
  store.setField(s, 'marital', 'Married'); store.setField(s, 'marital_date', '14/03/2008'); store.setField(s, 'marital_contract', 'In Community of Property');
  assert.strictEqual(store.shown(s, 'marital_contract'), true);
  store.setField(s, 'marital', 'Single'); assert.strictEqual(s.f.marital_date.v, ''); assert.strictEqual(s.f.marital_contract.v, ''); assert.strictEqual(store.shown(s, 'marital_contract'), false);
});

test('amounts and dates are tidied as they are in the Fact Find', () => {
  const s = store.blank();
  store.setField(s, 'amount', '2500'); assert.strictEqual(s.f.amount.v, 'R 2 500.00');
  store.setField(s, 'start_date', '1/12/2026'); assert.strictEqual(s.f.start_date.v, '01/12/2026');
  store.setField(s, 'idno', '800101 5009 087'); assert.strictEqual(s.f.idno.v, '8001015009087');
});

test('beneficiaries: any number, shares as a percentage, the total worked out by the Checks', () => {
  const s = store.blank();
  store.addRow(s, 'benef', { name: 'Anna', sname: 'Kuiper', pct: '60' }); store.addRow(s, 'benef', { name: 'Piet', sname: 'Kuiper', pct: '40' });
  assert.strictEqual(s.l.benef[0].d.pct, '60%');
  assert.strictEqual(check.run(s).problems.filter(p => /add up/.test(p.text)).length, 0);
  store.addRow(s, 'benef', { name: 'Extra', pct: '10' });
  assert.ok(check.run(s).problems.some(p => p.level === 'bad' && /add up to 110%, not 100%/.test(p.text)));
  store.delRow(s, 'benef', 2); store.setCell(s, 'benef', 1, 'pct', ''); assert.ok(check.run(s).problems.some(p => /needs a % of the benefit/.test(p.text)));
});

test('the Checks name what is missing and what looks wrong, and nothing stops a save', () => {
  const s = store.blank(); assert.ok(check.run(s).missing.length >= 25);
  store.setField(s, 'idno', '1234567890123'); store.setField(s, 'cell', '12345'); store.setField(s, 'email', 'not an email'); store.setField(s, 'postal_code', '21'); store.setField(s, 'branch_code', '123');
  store.setField(s, 'acc_no', '12'); store.setField(s, 'amount', 'R 0'); store.setField(s, 'start_date', '31/02/2026');
  const t = check.run(s).problems.map(p => p.text).join(' | ');
  ['valid South African ID', 'does not look like a phone number', 'e-mail address', 'Postal code is four digits', 'branch code is six digits', 'account number should be 6 to 16', 'more than R 0.00', 'not a date'].forEach(x => assert.ok(t.includes(x), x + ' in: ' + t));
  const ok = named('A', 'B'); store.setField(ok, 'idno', '8001015009087'); store.setField(ok, 'cell', '082 123 4567'); store.setField(ok, 'email', 'a@b.co'); store.setField(ok, 'postal_code', '2125'); store.setField(ok, 'branch_code', '198765'); store.setField(ok, 'acc_no', '1234567890');
  assert.deepStrictEqual(check.run(ok).problems, []);
  assert.ok(check.run(s).missing.every(m => !m.id.startsWith('risk_')), 'the worked-out result is never asked for');
});

/* ---------- Load from Fact Find ---------- */
function factFindText() {
  const f = ffStore.blank();
  ffStore.setField(f, 'fname', 'Anna Maria'); ffStore.setField(f, 'sname', 'Kuiper'); ffStore.setField(f, 'idno', '8001015009087'); ffStore.setField(f, 'cell', '0821234567'); ffStore.setField(f, 'pemail', 'anna@example.com');
  ffStore.setField(f, 'work', '0115550148'); ffStore.setField(f, 'tax', '1234567890'); ffStore.setField(f, 'occ', 'Engineer');
  return ffStore.toJSON(f);
}
test('Load from Fact Find fills the empty boxes in amber and never replaces what was typed', () => {
  const s = store.blank(); store.setField(s, 'cell', '083 999 8888');
  const rep = store.loadFromFactFind(s, factFindText(), 'Fact Find - Anna.json');
  assert.strictEqual(s.f.fname.v, 'Anna Maria'); assert.strictEqual(s.f.fname.st, 'verify'); assert.strictEqual(s.f.sname.v, 'Kuiper'); assert.strictEqual(s.f.email.v, 'anna@example.com'); assert.strictEqual(s.f.occupation.v, 'Engineer');
  assert.strictEqual(s.f.cell.v, '083 999 8888', 'what was typed stays'); assert.strictEqual(s.f.cell.st, 'confirmed'); assert.ok(rep.kept.includes('Cell'));
  assert.strictEqual(s.from.name, 'Fact Find - Anna.json'); assert.ok(store.counts(s).verify >= 5);
  store.acceptAll(s); assert.strictEqual(store.counts(s).verify, 0);
  assert.throws(() => store.loadFromFactFind(s, '{"app":"wr-short-risk"}', 'x'), /not a Wealth Revolution Fact Find/);
  assert.throws(() => store.loadFromFactFind(s, 'not json', 'x'), /cannot be read/);
});

/* ---------- Load from Short Risk file ---------- */
function shortRiskText() {
  const f = srStore.blank();
  srStore.setField(f, 'title', 'Mrs'); srStore.setField(f, 'fname', 'Anna Maria'); srStore.setField(f, 'sname', 'Kuiper'); srStore.setField(f, 'idno', '8001015009087'); srStore.setField(f, 'cell', '0821234567'); srStore.setField(f, 'work', '0115550148'); srStore.setField(f, 'email', 'anna@example.com');
  srStore.setField(f, 'unit', '4'); srStore.setField(f, 'complex', 'Oak Place'); srStore.setField(f, 'street_no', '12'); srStore.setField(f, 'street', 'Example Street'); srStore.setField(f, 'suburb', 'Fourways'); srStore.setField(f, 'city', 'Johannesburg'); srStore.setField(f, 'postal', '2191');
  srStore.setField(f, 'acc_holder', 'A M Kuiper'); srStore.setField(f, 'bank', 'Nedbank'); srStore.setField(f, 'branch_code', '198765'); srStore.setField(f, 'acc_type', 'Transmission'); srStore.setField(f, 'acc_no', '1234567890');
  srStore.addRow(f, 'benef', { name: 'Piet van der Merwe', id: '8203150012088', relation: 'Spouse', pct: '60' }); srStore.addRow(f, 'benef', { name: 'Mia Kuiper', id: '', relation: 'Child', pct: '40' });
  return srStore.toJSON(f);
}
test('Load from Short Risk file brings the contact details, home address, bank and beneficiaries, in amber, for the client to agree', () => {
  const s = store.blank(), rep = store.loadFromShortRisk(s, shortRiskText(), 'Sanlam Short Risk.json');
  assert.strictEqual(s.f.title.v, 'Mrs'); assert.strictEqual(s.f.fname.v, 'Anna Maria'); assert.strictEqual(s.f.cell.v, '0821234567'); assert.strictEqual(s.f.tel_w.v, '0115550148'); assert.strictEqual(s.f.email.v, 'anna@example.com');
  assert.strictEqual(s.f.residential.v, 'Unit 4, Oak Place, 12 Example Street, Fourways, Johannesburg'); assert.strictEqual(s.f.residential_code.v, '2191');
  assert.deepStrictEqual(['acc_holder', 'bank', 'branch_code', 'acc_type', 'acc_no'].map(id => s.f[id].v), ['A M Kuiper', 'Nedbank', '198765', 'Other', '1234567890'], 'a Transmission account is an Other account here');
  assert.strictEqual(s.l.benef.length, 2); assert.deepStrictEqual(s.l.benef[0].d, { name: 'Piet', sname: 'van der Merwe', cell: '', id: '8203150012088', relation: 'Spouse', pct: '60%' }); assert.strictEqual(s.l.benef[0].st, 'verify');
  assert.strictEqual(rep.rows, 2); assert.ok(rep.loaded.length >= 12); assert.strictEqual(s.from.name, 'Sanlam Short Risk.json');
  assert.ok(store.counts(s).verify >= 14, 'boxes and rows are both waiting to be agreed');
  store.acceptAll(s); assert.strictEqual(store.counts(s).verify, 0);
});
test('Load from Short Risk file keeps what was typed, leaves a beneficiary list that already has people, and refuses another kind of file', () => {
  const s = named('Typed', 'Name'); store.addRow(s, 'benef', { name: 'Already', sname: 'There', pct: '100' }); store.setField(s, 'bank', 'FNB');
  const rep = store.loadFromShortRisk(s, shortRiskText(), 'x.json');
  assert.strictEqual(s.f.fname.v, 'Typed'); assert.strictEqual(s.f.bank.v, 'FNB'); assert.ok(rep.kept.includes('Full names (as per ID document)') && rep.kept.includes('Name of bank'));
  assert.strictEqual(s.l.benef.length, 1); assert.strictEqual(rep.rows, 0);
  assert.throws(() => store.loadFromShortRisk(s, '{"app":"wr-fact-find"}', 'x'), /not a Wealth Revolution Short Risk Application/);
});
test('a surname with van, de or du in it stays whole', () => {
  [['Piet van der Merwe', 'Piet', 'van der Merwe'], ['Anna Maria Kuiper', 'Anna Maria', 'Kuiper'], ['Jan de Villiers', 'Jan', 'de Villiers'], ['Madonna', 'Madonna', '']].forEach(([full, n, sn]) => assert.deepStrictEqual(store.splitName(full), { name: n, sname: sn }, full));
});

/* ---------- saving and reopening ---------- */
test('the file round-trips with the questionnaire’s answers, and a file from another app is refused', () => {
  const s = named('Sample', 'Client'); answerAll(s, 3); store.setField(s, 'rt_understand', 'Confirmed'); store.rtSync(s, true); store.addRow(s, 'benef', { name: 'Anna', pct: '100' });
  const j = JSON.parse(store.toJSON(s)); assert.strictEqual(j.app, 'wr-capture-sheet'); assert.strictEqual(j.schema, '1.0');
  const o = store.fromJSON(JSON.stringify(j));
  assert.strictEqual(o.f.risk_score.v, s.f.risk_score.v); assert.strictEqual(o.f.risk_ref.v, s.f.risk_ref.v); assert.strictEqual(o.f.rt_s7.v, 'Agree'); assert.strictEqual(o.l.benef[0].d.name, 'Anna');
  assert.strictEqual(store.rtStatus(o).complete, true);
  assert.throws(() => store.fromJSON(JSON.stringify({ app: 'wr-fact-find' })), /./);
});
