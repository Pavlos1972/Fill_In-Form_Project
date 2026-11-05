/* "Broker on record" is the same box everywhere (label, choices) and starts as Other broker: a new row of each list, and the broker box of Medical aid, Gap cover, Will and Short-term insurance as soon as its answer opens it. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const validate = require('../app/js/validate.js');
const V = require('../app/js/voice.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const CH = ['Paul K', 'Other broker', 'Through company', 'None'];
const LISTS = ['risk', 'grp', 'ret_ra', 'ret_pp', 'inv', 'bizpol'], BOXES = { ma: 'ma_broker', gap: 'gap_broker', will: 'will_broker', sti: 'sti_broker' };

test('every Broker on record is called that and has the same four choices', () => {
  LISTS.forEach(k => { const c = schema.lists[k].cols.find(x => x.k === 'broker'); assert.strictEqual(c.l, 'Broker on record', k); assert.deepStrictEqual(c.o, CH, k); assert.strictEqual(c.def, 'Other broker', k); });
  Object.values(BOXES).forEach(id => { const f = schema.fieldsById[id]; assert.strictEqual(f.l, 'Broker on record', id); assert.deepStrictEqual(f.o, CH, id); assert.ok(f.vl && /broker on record$/.test(f.vl), id + ' keeps its own name for voice'); });
  assert.strictEqual(schema.defaultBroker, 'Other broker');
});

test('a new row starts as Other broker, a broker that is given is kept, and the adviser can change it', () => {
  const s = fresh();
  LISTS.forEach(k => { const r = store.addRow(s, k, {}); assert.strictEqual(r.d.broker, 'Other broker', k); });
  assert.strictEqual(store.addRow(s, 'risk', { broker: 'Paul K' }).d.broker, 'Paul K');
  store.setCell(s, 'risk', 0, 'broker', 'None'); assert.strictEqual(s.l.risk[0].d.broker, 'None');
  assert.strictEqual(store.addRow(s, 'debts', {}).d.broker, undefined, 'lists without the column are not touched');
});

test('a row that holds only the default broker is empty: it is not counted, does not make the Yes/No a Yes, and is dropped when pointed at and not used', () => {
  const s = fresh(), inv = schema.sections.find(x => x.id === 'inv'); set(s, 'has_inv', 'Yes'); const before = store.counts(s, inv);
  const r = store.addRow(s, 'inv', {});
  assert.ok(store.rowBlank('inv', r) && !store.rowFilled('inv', r));
  assert.deepStrictEqual(store.counts(s, inv).fill, before.fill, 'an unused new row is not an answer');
  store.setCell(s, 'inv', 0, 'prov', 'Allan Gray'); assert.ok(store.rowFilled('inv', s.l.inv[0]));
  assert.ok(store.counts(s, inv).fill > before.fill);
  const old = JSON.parse(store.toJSON(fresh())); old.l.inv = [{ d: { broker: 'Other broker' }, st: 'confirmed' }];
  assert.strictEqual(store.fromJSON(JSON.stringify(old)).f.has_inv.v, '', 'a file with only a default row does not say Yes');
});

test('Medical aid, Gap cover, Will and Short-term: the broker starts as Other broker when the answer above opens the boxes, and goes again when it closes them', () => {
  const s = fresh();
  Object.values(BOXES).forEach(id => assert.strictEqual(s.f[id].v, '', id + ' empty until its answer opens it'));
  set(s, 'ma', 'Medical aid'); assert.deepStrictEqual([s.f.ma_broker.v, s.f.ma_broker.st], ['Other broker', 'preset']);
  set(s, 'ma', 'None'); assert.strictEqual(s.f.ma_broker.v, '', 'None: the untouched default goes, nothing is left under it');
  set(s, 'gap', 'Not sure'); assert.strictEqual(s.f.gap_broker.v, 'Other broker', 'Not sure opens the gap boxes');
  set(s, 'gap', 'No'); assert.strictEqual(s.f.gap_broker.v, '');
  set(s, 'will', 'Yes'); assert.strictEqual(s.f.will_broker.v, 'Other broker');
  set(s, 'sti', 'Handled by spouse'); assert.strictEqual(s.f.sti_broker.v, '');
  set(s, 'sti', 'Yes'); assert.strictEqual(s.f.sti_broker.v, 'Other broker');
  set(s, 'sti_broker', 'Paul K'); assert.deepStrictEqual([s.f.sti_broker.v, s.f.sti_broker.st], ['Paul K', 'confirmed']);
  set(s, 'sti', 'Yes'); assert.strictEqual(s.f.sti_broker.v, 'Paul K', 'saying Yes again never changes a chosen broker');
  set(s, 'ma', 'Hospital plan'); set(s, 'ma_broker', 'Other broker'); set(s, 'ma', 'None'); assert.strictEqual(s.f.ma_broker.v, 'Other broker', 'a broker chosen on purpose stays even if it equals the default (its status is not preset)');
});

test('no warning about data left under a No for a default broker', () => {
  const s = fresh();
  set(s, 'ma', 'Medical aid'); set(s, 'ma', 'None'); set(s, 'will', 'Yes'); set(s, 'will', 'No');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)).filter(w => /ma_broker|will_broker/.test(w.id || '')), []);
});

test('files saved with the older medical aid, gap and short-term choices keep the fact', () => {
  const j = JSON.parse(store.toJSON(fresh()));
  j.f.ma = { v: 'Medical aid', st: 'confirmed' }; j.f.ma_broker = { v: 'Privately paid, no broker', st: 'confirmed' };
  j.f.gap = { v: 'Yes', st: 'confirmed' }; j.f.gap_broker = { v: 'Privately paid, other broker', st: 'confirmed' };
  j.f.sti = { v: 'Yes', st: 'confirmed' }; j.f.sti_broker = { v: 'Cameron Maritz', st: 'confirmed' };
  j.f.will = { v: 'Yes', st: 'confirmed' }; j.f.will_broker = { v: 'Paul K', st: 'confirmed' };
  const s = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual(['ma_broker', 'gap_broker', 'sti_broker', 'will_broker'].map(id => s.f[id].v), ['None', 'Other broker', 'Other broker', 'Paul K']);
  const empty = JSON.parse(store.toJSON(fresh())); empty.f.ma = { v: 'Medical aid', st: 'confirmed' };
  const opened = store.fromJSON(JSON.stringify(empty));
  assert.deepStrictEqual([opened.f.ma_broker.v, opened.f.ma_broker.st], ['Other broker', 'preset'], 'an older file whose answer opens the box and whose broker is empty gets the default when it is opened');
  assert.strictEqual(store.fromJSON(store.toJSON(opened)).f.ma_broker.v, 'Other broker', 'opening it again changes nothing more');
});

test('voice: "Paul", "through the company", "no broker" and "Cameron" are read for the four boxes, and the default is not an answer Claude has to respect', () => {
  const idx = V.buildIndex(schema), r = (id, t) => { const x = V.interpret(idx.byId[id], t); return x && (x.error ? 'ERR:' + x.error : x.value); };
  ['ma_broker', 'gap_broker', 'will_broker', 'sti_broker'].forEach(id => {
    assert.strictEqual(r(id, 'Paul is the broker'), 'Paul K', id); assert.strictEqual(r(id, 'it goes through the company'), 'Through company', id); assert.strictEqual(r(id, 'no broker'), 'None', id);
    assert.strictEqual(r(id, 'another broker'), 'Other broker', id);
  });
  assert.strictEqual(r('sti_broker', 'Cameron looks after it'), 'Other broker');
  LISTS.forEach(k => { assert.strictEqual(r(k + '.broker', 'Paul K'), 'Paul K', k); assert.strictEqual(r(k + '.broker', 'another broker'), 'Other broker', k); });
  assert.ok(idx.byId.ma_broker.label === 'Medical aid broker on record' && idx.byId.sti_broker.label === 'Short-term broker on record', 'voice and Claude can tell the four apart');
});

test('opening a file saved before these rules: Duties zeros, an empty Broker on record in every policy row, and the four boxes', () => {
  const old = JSON.parse(store.toJSON(fresh()));
  old.f.d_desk = { v: '90', st: 'heard' }; old.f.d_trav = { v: '10', st: 'heard' };
  old.f.has_risk = { v: 'Yes', st: 'heard' }; old.f.sti = { v: 'No', st: 'heard' }; old.f.will = { v: 'Yes', st: 'confirmed' };
  old.l.risk = [{ d: { prov: 'Liberty', spend: 'R 2 231.35', broker: '', notes: '' }, st: 'heard' }, { d: { prov: '', spend: '', broker: '', notes: '' }, st: 'heard' }];
  old.l.inv = [{ d: { type: 'Other', prov: 'FNB', val: 'R 11 000.00', prem: 'R 200.00', broker: '' }, st: 'confirmed' }];
  old.l.ret_ra = [{ d: { prov: 'Allan Gray', broker: 'Paul K' }, st: 'confirmed' }];
  const s = store.fromJSON(JSON.stringify(old)), D = ['d_desk', 'd_supo', 'd_trav', 'd_sups', 'd_light', 'd_mod', 'd_heavy'];
  assert.deepStrictEqual(D.map(id => s.f[id].v), ['90', '0', '10', '0', '0', '0', '0'], 'the other duties are 0');
  assert.deepStrictEqual([s.f.d_supo.st, s.f.d_desk.st], ['preset', 'heard']);
  assert.strictEqual(s.l.risk[0].d.broker, 'Other broker'); assert.strictEqual(s.l.risk[1].d.broker, '', 'a row with nothing in it stays empty');
  assert.strictEqual(s.l.inv[0].d.broker, 'Other broker'); assert.strictEqual(s.l.ret_ra[0].d.broker, 'Paul K', 'a broker that is there is not changed');
  assert.deepStrictEqual([s.f.will_broker.v, s.f.will_broker.st, s.f.sti_broker.v], ['Other broker', 'preset', ''], 'Will is Yes so its broker opens with the default; short-term is No so it does not');
  const again = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual(D.map(id => again.f[id].v), D.map(id => s.f[id].v)); assert.strictEqual(store.toJSON(again).replace(/"(created|modified|at)":"[^"]*"/g, ''), store.toJSON(s).replace(/"(created|modified|at)":"[^"]*"/g, ''), 'a second opening changes nothing');
  const under = JSON.parse(store.toJSON(fresh())); under.f.d_desk = { v: '90', st: 'heard' }; under.f.d_trav = { v: '5', st: 'heard' };
  assert.deepStrictEqual(D.map(id => store.fromJSON(JSON.stringify(under)).f[id].v), ['90', '', '5', '', '', '', ''], 'not 100%: nothing is added');
});
