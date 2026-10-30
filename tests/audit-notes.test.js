/* The notes under the BrightRock Fractured quotes, the same words in the action points when (and only when) that quote is asked for, and the waiting period that starts at 1 month. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');

const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const REQ = 'Request a quote';
const life = () => schema.sections.find(x => x.id === 'prio').blocks.filter(b => b.pri === 'life' && b.lane);
const points = s => { set(s, 'fname', 'Thandi'); return A.local(s); };

test('each BrightRock Fractured quote block has a note under it saying what it is based on; the standard blocks have none', () => {
  const br = life().filter(b => b.lane === 'br'), std = life().filter(b => b.lane === 'std');
  assert.deepStrictEqual(br.map(b => [b.row, b.note]), [['fna', 'BR FNA Quote based on Fact Find'], ['sf', 'BR Shortfall Quote based on BR FNA Quote minus Group Risk'], ['red', 'BR Reduced Quote based on BR Shortfall Quote']]);
  assert.ok(std.every(b => !b.note));
  assert.deepStrictEqual(schema.brBasis, { fna: 'BR FNA Quote based on Fact Find', sf: 'BR Shortfall Quote based on BR FNA Quote minus Group Risk', red: 'BR Reduced Quote based on BR Shortfall Quote' });
});

test('the action points state the basis of a BrightRock quote only when that quote is requested', () => {
  const s = fresh();
  assert.ok(!points(s).some(p => /BR /.test(p)));                                                    // nothing asked for: no basis anywhere
  set(s, 'bf_fna_req', REQ); assert.ok(points(s).includes('Request a BrightRock Fractured FNA quote: BR FNA Quote based on Fact Find.'));
  assert.ok(!points(s).some(p => /Shortfall Quote based|Reduced Quote based/.test(p)));              // the other two are not asked for
  set(s, 'has_group', 'Yes'); set(s, 'bf_sf_req', REQ); assert.ok(points(s).some(p => /BR Shortfall Quote based on BR FNA Quote minus Group Risk\.$/.test(p)));
  store.addRow(s, 'bfred', { req: REQ, amt: 'R 1 000.00' }); assert.ok(points(s).some(p => /BR Reduced Quote based on BR Shortfall Quote\.$/.test(p)));
  set(s, 'bf_fna_req', 'Not required'); assert.ok(!points(s).some(p => /BR FNA Quote based on Fact Find/.test(p)));
  const std = fresh(); set(std, 'fna_req', REQ); set(std, 'fna_ins', 'Old Mutual'); assert.ok(!points(std).some(p => /BR /.test(p)));        // a standard quote has no BR basis
});

test('the facts for Claude carry the basis of each BrightRock quote asked for, and none for a standard quote', () => {
  const s = fresh(); set(s, 'bf_fna_req', REQ); set(s, 'fna_req', REQ);
  const q = A.facts(s).quotes; assert.strictEqual(q.find(x => x.kind === 'BrightRock Fractured').basis, 'BR FNA Quote based on Fact Find'); assert.ok(!('basis' in q.find(x => x.kind === 'Standard')));
});

test('the waiting period of the BrightRock income protection starts at 1 month', () => {
  const f = schema.fieldsById.ip_wait; assert.strictEqual(f.preset, '1 month'); assert.ok(f.o.includes('1 month'));
  assert.deepStrictEqual(fresh().f.ip_wait, { v: '1 month', st: 'preset' });
  assert.ok(!schema.fieldsById.ips_wait.preset);                                                    // the standard quote's waiting period is as it was
});
