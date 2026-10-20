const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const calc = require('../app/js/calc.js');
const validate = require('../app/js/validate.js');

function fresh() { const s = store.blank(); s.f.date = { v: '2026-10-15', st: 'confirmed' }; return s; }
const set = (s, id, v) => store.setField(s, id, v);

test('every field id is unique and every list and calc used exists', () => {
  const seen = new Set();
  for (const sec of schema.sections) for (const b of sec.blocks) {
    for (const f of b.fields || []) {
      assert.ok(!seen.has(f.id), 'duplicate id ' + f.id); seen.add(f.id);
      if (f.t === 'sel') assert.ok(Array.isArray(f.o) && f.o.length, 'no options for ' + f.id);
      if (f.calc) assert.doesNotThrow(() => calc.field(f.calc, store.ctxFor(fresh())), f.calc);
    }
    if (b.list) assert.ok(schema.lists[b.list], 'missing list ' + b.list);
  }
});
test('a new Fact Find starts blank apart from the preset values', () => {
  const s = store.blank();
  assert.strictEqual(s.f.advisor.v, 'Paul Kafentzis');
  assert.strictEqual(s.f.fname.st, 'empty');
  assert.strictEqual(s.f.h_chol.v, '');           // no silent "No"
  assert.strictEqual(s.f.dd_cover.v, '');         // no default R500 000
});
test('Direct Net Income follows the TaxTim figure and the take-home stays separate', () => {
  const s = fresh(); set(s, 'gross', 'R 40 000'); set(s, 'net', '32 000');
  const c = store.ctxFor(s);
  assert.strictEqual(calc.field('dnet', c), 'R 32 138.13');
  assert.strictEqual(c.v('net'), '32 000');
});
test('disposable income and the risk calculation use take-home, childcare and debts', () => {
  const s = fresh(); set(s, 'net', '32000'); set(s, 'exp', '20000');
  store.addRow(s, 'debts', { inst: '11 400' }); store.addRow(s, 'kids', { dob: '2019-08-22', cost: '2 500' });
  const c = store.ctxFor(s);
  assert.strictEqual(calc.field('disp', c), 'R 12 000.00');
  assert.strictEqual(calc.field('hh', c), 'R 32 000.00');
  assert.strictEqual(calc.field('cc', c), 'R 2 500.00');
  assert.strictEqual(calc.field('dr', c), 'R 11 400.00');
  assert.strictEqual(calc.field('need', c), 'R 18 100.00');
});
test('education stage comes from the date of birth', () => {
  const s = fresh(); const c = store.ctxFor(s);
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2019-08-22' } }, c), 'Primary');
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2025-01-01' } }, c), 'Not yet in school');
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '' } }, c), '');
});
test('duties total adds the seven percentages', () => {
  const s = fresh(); set(s, 'd_desk', '60'); set(s, 'd_supo', '40');
  assert.strictEqual(calc.field('d_tot', store.ctxFor(s)), '100%');
});
test('business and spouse sections show only when they apply', () => {
  const s = fresh(); const c = () => store.ctxFor(s);
  const biz = schema.sections.find(x => x.id === 'q_biz');
  assert.strictEqual(calc.showIf(biz.cond, c()), false);
  set(s, 'bizowner', 'Yes'); assert.strictEqual(calc.showIf(biz.cond, c()), true);
  const spouse = schema.sections.find(x => x.id === 'income').blocks[1];
  set(s, 'marital', 'Single'); assert.strictEqual(calc.showIf(spouse.cond, c()), false);
  set(s, 'marital', 'Civil union'); assert.strictEqual(calc.showIf(spouse.cond, c()), true);
});
test('checks catch a bad ID, email, phone and duties total', () => {
  const s = fresh(); set(s, 'idno', '8001015009088'); set(s, 'pemail', 'nope'); set(s, 'cell', '082 555'); set(s, 'd_desk', '60');
  const ids = validate.check(store.ctxFor(s)).map(w => w.id);
  for (const id of ['idno', 'pemail', 'cell', 'd_tot']) assert.ok(ids.includes(id), id);
  set(s, 'idno', '8001015009087'); set(s, 'pemail', 'a@b.co.za'); set(s, 'cell', '082 555 0148'); set(s, 'd_supo', '40');
  assert.deepStrictEqual(validate.check(store.ctxFor(s)), []);
});
test('the ID and tax number boxes show a live length indicator, and the checks warn about a tax number that is not 10 digits', () => {
  const L = (id, v, t) => validate.lengthState(id, v, t);
  assert.deepStrictEqual(L('idno', '', 'ID'), { level: 'hint', text: '13 digits' });
  assert.deepStrictEqual(L('idno', '72120', 'ID'), { level: 'short', text: '5 of 13 digits' });
  assert.strictEqual(L('idno', '7212095268086', 'ID').level, 'ok');
  assert.strictEqual(L('idno', '721209 5268 086', 'ID').level, 'ok');                           // spaces are ignored
  assert.deepStrictEqual(L('idno', '7212095268087', 'ID'), { level: 'bad', text: '13 digits, check digit wrong' });
  assert.deepStrictEqual(L('idno', '72120952680860', 'ID'), { level: 'bad', text: '14 digits, 1 too many' });
  assert.strictEqual(L('idno', 'A1234567', 'Passport'), null);                                 // a passport has no fixed length
  assert.deepStrictEqual(L('idno', 'A1234567', 'ID'), { level: 'bad', text: 'digits only' });
  assert.deepStrictEqual(L('tax', '554-7259'), { level: 'short', text: '7 of 10 digits' });
  assert.strictEqual(L('tax', '5547259123').level, 'ok');
  assert.deepStrictEqual(L('tax', '55472591234'), { level: 'bad', text: '11 digits, 1 too many' });
  assert.strictEqual(L('cell', '0825550148'), null);                                           // no rule for other boxes
  const f = schema.fieldsById; assert.ok(f.idno.len && f.tax.len && !f.cell.len);
  const s = fresh(); set(s, 'tax', '554-7259');
  assert.ok(validate.check(store.ctxFor(s)).some(w => w.id === 'tax' && /10 digits/.test(w.msg)));
  set(s, 'tax', '5547259123'); assert.ok(!validate.check(store.ctxFor(s)).some(w => w.id === 'tax'));
  set(s, 'tax', ''); assert.ok(!validate.check(store.ctxFor(s)).some(w => w.id === 'tax'));
});
test('a saved file reopens exactly, and unknown or missing parts are tolerated', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  store.addRow(s, 'debts', { prov: 'Nedbank', inst: '11 400' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(store.clientName(back), 'Thandi Dlamini');
  assert.strictEqual(back.l.debts[0].d.prov, 'Nedbank');
  assert.strictEqual(back.f.h_chol.v, '');
  assert.throws(() => store.fromJSON('{"app":"other"}'), /not a Wealth Revolution Fact Find/);
});
test('file name follows the meeting date and client', () => {
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  assert.strictEqual(store.baseFileName(s), 'Fact Find - 15.10.2026 - Thandi Dlamini');
});
test('each debt has an Other bank box and its own notes', () => {
  const cols = schema.lists.debts.cols.map(c => c.k);
  assert.ok(cols.includes('prov_other') && cols.includes('notes'));
  const s = fresh(); store.addRow(s, 'debts', { prov: 'Other', prov_other: 'Bidvest Bank', notes: 'Settling early' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.l.debts[0].d.prov_other, 'Bidvest Bank');
  assert.strictEqual(back.l.debts[0].d.notes, 'Settling early');
});

test('amounts saved as plain numbers by an earlier version are tidied when reopened', () => {
  const s = fresh(); s.f.gross.v = '120000'; s.f.net.v = '80200'; store.addRow(s, 'debts', { inst: '11400' });
  const back = store.fromJSON(JSON.stringify(s));
  assert.strictEqual(back.f.gross.v, 'R 120 000.00');
  assert.strictEqual(back.f.net.v, 'R 80 200.00');
  assert.strictEqual(back.l.debts[0].d.inst, 'R 11 400.00');
});

test('every date is shown day/month/year, and older files are brought into line', () => {
  const util = require('../app/js/util.js');
  assert.strictEqual(util.formatDate(util.parseDate('2026-10-17')), '17/10/2026');
  assert.strictEqual(util.formatDate(util.parseDate('5 March 2020')), '05/03/2020');
  const s = store.blank();
  assert.match(s.f.date.v, /^\d{2}\/\d{2}\/\d{4}$/);                      // today's date, as day/month/year
  s.f.dob = { v: '1986-03-14', st: 'confirmed' }; s.f.will_date = { v: '5 March 2020', st: 'confirmed' }; s.f.date = { v: '2026-10-17', st: 'confirmed' };
  store.addRow(s, 'kids', { dob: '2019-08-22' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.f.dob.v, '14/03/1986');
  assert.strictEqual(back.f.will_date.v, '05/03/2020');
  assert.strictEqual(back.f.date.v, '17/10/2026');
  assert.strictEqual(back.l.kids[0].d.dob, '22/08/2019');
  s.f.dob.v = 'not a date'; assert.strictEqual(store.fromJSON(store.toJSON(s)).f.dob.v, 'not a date');   // anything else is left as typed
  assert.strictEqual(store.baseFileName(Object.assign(store.blank(), { f: Object.assign(store.blank().f, { date: { v: '17/10/2026', st: 'confirmed' } }) })), 'Fact Find - 17.10.2026 - New client');
  const calc2 = require('../app/js/calc.js');
  const c = store.ctxFor(back);
  assert.strictEqual(calc2.clientAge(c), 40);                              // ages are worked out from day/month/year dates
});
test('nationality starts as South African and the ID type as ID', () => {
  const s = store.blank();
  assert.deepStrictEqual(s.f.nat, { v: 'South African', st: 'preset' });
  assert.deepStrictEqual(s.f.idtype, { v: 'ID', st: 'preset' });
});

test('a box in a list can be set with the status it was heard with', () => {
  const s = store.blank(); store.addRow(s, 'kids', { name: 'Thandi' }, 'confirmed');
  assert.strictEqual(s.l.kids[0].st, 'confirmed');
  store.setCell(s, 'kids', 0, 'dob', '22/08/2019', 'verify'); assert.strictEqual(s.l.kids[0].st, 'verify'); assert.strictEqual(s.l.kids[0].d.dob, '22/08/2019');
  store.setCell(s, 'kids', 0, 'cost', 'R 2 500.00'); assert.strictEqual(s.l.kids[0].st, 'confirmed');   // typed by hand: confirmed, as before
});
test('age is worked out on the date of the form, from the date of birth', () => {
  const s = fresh(); s.f.date = { v: '15/10/2026', st: 'confirmed' };
  assert.strictEqual(calc.field('age', store.ctxFor(s)), '');                                // nothing to work from yet
  set(s, 'dob', '14/03/1986');
  assert.strictEqual(calc.field('age', store.ctxFor(s)), '40 years');
  set(s, 'dob', '15/10/1986'); assert.strictEqual(calc.field('age', store.ctxFor(s)), '40 years');   // birthday on the day itself
  set(s, 'dob', '16/10/1986'); assert.strictEqual(calc.field('age', store.ctxFor(s)), '39 years');   // the day after
  s.f.date = { v: '15/10/2027', st: 'confirmed' };
  assert.strictEqual(calc.field('age', store.ctxFor(s)), '40 years');                        // a different date of the form, a different age
  set(s, 'dob', '20/10/2025'); assert.strictEqual(calc.field('age', store.ctxFor(s)), '1 year');
  set(s, 'dob', '01/01/2030'); assert.strictEqual(calc.field('age', store.ctxFor(s)), '');   // a date of birth after the form is not an age
  set(s, 'dob', ''); set(s, 'idno', '7212095268086');
  assert.strictEqual(calc.field('age', store.ctxFor(s)), '54 years');                        // no date of birth yet: the ID number gives it
});

test('what Claude has cost travels with the saved file, starts at nothing, and survives odd values', () => {
  const s = store.blank();
  assert.deepStrictEqual(s.claude, { usd: 0, calls: 0, input: 0, output: 0, read: 0, write: 0, searches: 0 });
  s.claude.usd = 0.1234; s.claude.calls = 12; s.claude.read = 70000;
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.claude.usd, 0.1234); assert.strictEqual(back.claude.calls, 12); assert.strictEqual(back.claude.read, 70000);
  const old = JSON.parse(store.toJSON(store.blank())); delete old.claude;
  assert.strictEqual(store.fromJSON(JSON.stringify(old)).claude.usd, 0, 'a file from before the meter opens at nothing');
  const odd = JSON.parse(store.toJSON(store.blank())); odd.claude = { usd: 'lots', calls: -3, input: null };
  assert.deepStrictEqual(store.fromJSON(JSON.stringify(odd)).claude, store.blankTally());
});
