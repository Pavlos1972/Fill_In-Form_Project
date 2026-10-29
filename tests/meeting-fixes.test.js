/* Fixes from the 29 October test meeting with Sitamah Nathoo. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');

const idx = V.buildIndex(schema);
const fresh = () => store.blank();
const shown = (s, id) => { const f = schema.fieldsById[id]; return calc.showIf(f.cond, store.ctxFor(s)); };

test('"Since February 2022" is 4.7 years, not the number 2022', () => {
  const now = new Date(2026, 9, 29);
  assert.strictEqual(V.yearsValue('Since February 2022', now), '4.7');
  assert.strictEqual(V.yearsValue('since 2019', now), '7');
  assert.strictEqual(V.yearsValue('about four years', now), '4');
  assert.strictEqual(V.yearsValue('18 months', now), '1.5');
  assert.strictEqual(V.yearsValue('four and a half years', now), '4.5');
  assert.strictEqual(V.yearsValue('12', now), '12');
  assert.strictEqual(V.yearsValue('a long time', now), 'a long time');
  const r = V.interpret(idx.byId.years, 'Since February 2022');
  assert.ok(/^\d+\.\d$/.test(r.value) && +r.value > 4 && +r.value < 20, r.value);
  const said = AI.normalize({ actions: [{ do: 'fill', field: 'years', value: 'Since February 2022' }] }, idx, 'auto', {});
  assert.ok(/^\d+\.\d$/.test(said.actions[0].value), JSON.stringify(said));
});

test('Gap cover can be "Not sure", and a client\'s "I\'m not sure" picks it', () => {
  assert.deepStrictEqual(schema.fieldsById.gap.o, ['Yes', 'No', 'Not sure']);
  const r = V.interpret(idx.byId.gap, "I'm not entirely sure, to be honest");
  assert.strictEqual(r && r.value, 'Not sure');
});

test('a quote that is not required loses its type and insurer: the boxes go and what was there is cleared', () => {
  const s = fresh();
  ['fna', 'sf'].forEach(p => {
    store.setField(s, p + '_type', 'New Business'); store.setField(s, p + '_ins', 'BrightRock');
    assert.ok(shown(s, p + '_type') && shown(s, p + '_ins'));
    store.setField(s, p + '_req', 'Request a quote'); assert.ok(shown(s, p + '_type'));
    store.setField(s, p + '_req', 'Not required');
    assert.ok(!shown(s, p + '_type') && !shown(s, p + '_ins'), p);
    assert.strictEqual(s.f[p + '_type'].v, ''); assert.strictEqual(s.f[p + '_ins'].v, '');
  });
  store.setField(s, 'fna_type', 'Servicing'); store.setField(s, 'fna_req', 'No FNA done'); assert.strictEqual(s.f.fna_type.v, '');
  store.addRow(s, 'redq', { req: 'Request a quote', type: 'New Business', ins: 'Liberty', amt: 'R 1 000.00' });
  store.setCell(s, 'redq', 0, 'req', 'Not required');
  assert.deepStrictEqual(s.l.redq[0].d, { req: 'Not required', type: '', ins: '', amt: '' });
  // the voice does not ask about boxes that are gone
  assert.ok(idx.byId.sf_type.cond && idx.byId.fna_ins.cond);
});

test('"Preferred monthly spend" can be asked about and answered by voice', () => {
  assert.ok(idx.byId.pref_spend && idx.byId.pref_spend.money);
  const m = V.matchQuestion('What are you comfortable spending on a life policy?', idx, { cur: 'prio' });
  assert.strictEqual(m && m.id, 'pref_spend');
  assert.strictEqual(V.interpret(idx.byId.pref_spend, 'we can do a thousand').value, 'R 1 000.00');
});

test('Claude is told which boxes are free text, which are switched off, and the new rules', () => {
  const ctx = { sectionId: 'prio', recent: [], hidden: { fna_req: 1, 'list:raq': 1 } };
  const req = AI.buildRequest(idx, ctx, 'client', 'We can do a thousand?', 'm');
  const body = JSON.parse(req.messages[0].content);
  assert.deepStrictEqual(body.off, ['fna_req', 'list:raq']);
  assert.ok(body.fields.some(f => f.id === 'ma_prov' && f.free) && !body.fields.some(f => 'off' in f));       // "fields" never changes, so it stays cached
  assert.ok(body.lists.find(l => l.id === 'inv').columns.find(c => c.id === 'prov').free);
  const sys = req.system;
  assert.match(sys, /"free": true takes any value as said/);
  assert.match(sys, /Never use "Other" to hide a name that was said/);
  assert.match(sys, /spelled exactly as it is in the CLIENT's own line/);
  assert.match(sys, /A range is not a value/);
  assert.match(sys, /do not pick one: give \{"do":"ask"/);
  assert.match(sys, /"off" \(when present\)/);
  assert.ok(schema.fieldsById.inv_prov_placeholder === undefined);
  const prov = schema.lists.inv.cols.find(c => c.k === 'prov');
  ['FNB', 'Nedbank', 'Standard Bank', 'Capitec'].forEach(b => assert.ok(prov.o.includes(b), b));
});

test('the catch-up check sees only the boxes and lists that are showing, and its prompt keeps offers and fragments out', () => {
  const full = JSON.parse(AI.sweepRequest({ idx, model: 'm', transcript: [], filled: {}, listRows: () => [] }).messages[0].content);
  const some = JSON.parse(AI.sweepRequest({ idx, model: 'm', transcript: [], filled: {}, listRows: () => [], hidden: { fna_req: 1, 'list:raq': 1 } }).messages[0].content);
  assert.ok(full.fields.some(f => f.id === 'fna_req') && full.lists.some(l => l.id === 'raq'));
  assert.ok(!some.fields.some(f => f.id === 'fna_req') && !some.lists.some(l => l.id === 'raq'));
  assert.match(AI.SWEEP_SYSTEM, /An offer or suggestion the client did not take up is not a fact/);
  assert.match(AI.SWEEP_SYSTEM, /never a fragment/);
  assert.match(AI.SWEEP_SYSTEM, /when no name was said, leave the box empty/);
});

test('a Next appointment date sits on the Client priorities page and can be said', () => {
  const blocks = schema.sections.find(x => x.id === 'prio').blocks, i = blocks.findIndex(b => b.title === 'Next appointment');
  assert.ok(i > 0 && blocks[i + 1].fields[0].id === 'n_prio');
  const f = schema.fieldsById.next_appt;
  assert.ok(f.date && f.cal && idx.byId.next_appt);
  const r = V.interpret(idx.byId.next_appt, 'the fifth of November 2026');
  assert.strictEqual(r.value, '05/11/2026');
  const m = V.matchQuestion('When can we meet again for the next appointment?', idx, { cur: 'prio' });
  assert.strictEqual(m && m.id, 'next_appt');
});
