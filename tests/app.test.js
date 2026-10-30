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
  assert.strictEqual(s.f.advisor, undefined);                                    // there is no Advisor box; the PDF header carries the name
  assert.strictEqual(schema.advisor, 'Paul Kafentzis');
  assert.strictEqual(s.f.fname.st, 'empty');
  assert.strictEqual(s.f.h_chol.v, '');           // no silent "No"
  assert.strictEqual(s.f.dd_cover.v, 'R 500 000.00'); assert.strictEqual(s.f.dd_cover.st, 'preset');       // dread disease starts at R 500 000.00 with a term of WOL
  assert.strictEqual(s.f.dd_term.v, 'WOL'); assert.strictEqual(s.f.dds_cover.v, 'R 500 000.00'); assert.strictEqual(s.f.dds_term.v, 'WOL');
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
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2025-01-01' } }, c), 'Not Yet in School');
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '2009-01-03' } }, c), 'High School');
  schema.lists.kids.cols.find(x => x.k === 'stage').o.forEach(o => assert.ok(['2025-01-01', '2022-01-01', '2019-08-22', '2009-01-03', '2000-01-01'].some(d => calc.rowCalc('stage', { d: { dob: d } }, c) === o), o + ' is never worked out'));   // every calculated stage is one of the choices
  assert.strictEqual(calc.rowCalc('stage', { d: { dob: '' } }, c), '');
});
test('duties total adds the seven percentages', () => {
  const s = fresh(); set(s, 'd_desk', '60'); set(s, 'd_supo', '40');
  assert.strictEqual(calc.field('d_tot', store.ctxFor(s)), '100%');
});
test('business and spouse sections show only when they apply', () => {
  const s = fresh(); const c = () => store.ctxFor(s);
  const biz = schema.panelsById.biz;
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
test('the PDF is named "Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)"', () => {
  const s = fresh(); set(s, 'fname', 'Sitamah'); set(s, 'sname', 'Nathoo'); set(s, 'date', '29/10/2026');
  assert.strictEqual(store.pdfFileName(s), 'Fact Find (Voice to Text) - 29.10.26 - (Sitamah Nathoo)');
  set(s, 'date', '05/03/2027'); assert.strictEqual(store.pdfFileName(s), 'Fact Find (Voice to Text) - 05.03.27 - (Sitamah Nathoo)');         // day and month with two digits, the year with two
  set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini: "Test"/Co'); assert.strictEqual(store.pdfFileName(s), 'Fact Find (Voice to Text) - 05.03.27 - (Thandi Dlamini TestCo)');   // characters a file name cannot hold are left out
  const e = fresh(); set(e, 'date', '17/10/2026'); assert.strictEqual(store.pdfFileName(e), 'Fact Find (Voice to Text) - 17.10.26 - (New client)');
  assert.strictEqual(store.baseFileName(s), 'Fact Find - 05.03.2027 - Thandi Dlamini TestCo');                                                        // the saved .json keeps its own name
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

test('a child\'s age is worked out from the date of birth on the date of the form', () => {
  const c = store.ctxFor(fresh());                                                    // the form is dated 15 October 2026
  const age = dob => calc.rowCalc('age', { d: { dob } }, c);
  assert.strictEqual(age('03/01/2009'), '17 years');
  assert.strictEqual(age('2009-01-03'), '17 years');
  assert.strictEqual(age('15/10/2009'), '17 years');                                    // the birthday is the day of the form
  assert.strictEqual(age('16/10/2009'), '16 years');                                    // the day before the birthday
  assert.strictEqual(age('2025-10-15'), '1 year');
  assert.strictEqual(age('2026-05-01'), '5 months');
  assert.strictEqual(age('2026-09-16'), '0 months');
  assert.strictEqual(age('2026-09-15'), '1 month');
  assert.strictEqual(age(''), '');
  assert.strictEqual(age('2030-01-01'), '');                                            // not born yet: nothing is shown
  assert.strictEqual(age('rubbish'), '');
  const kids = schema.lists.kids.cols.map(x => x.k);
  assert.deepStrictEqual(kids.slice(0, 5), ['name', 'sname', 'gender', 'dob', 'age']);   // name and surname apart, and the age next to the date of birth
  assert.ok(schema.lists.kids.cols.find(x => x.k === 'age').calc);
});

test('the risk calculation boxes start with the agreed defaults', () => {
  const s = store.blank(), want = {
    lc_f_aci: 'Fixed', lc_f_aciv: '?', lc_wol: '3%', lc_ccabi: '5%',
    pd_f_aci: 'Fixed', pd_f_aciv: '?', pd_ccabi: '5%',
    dd_aci: 'Fixed', dd_aciv: '?', dd_abiv: '3%', dd_cover: 'R 500 000.00', dd_term: 'WOL',
    dds_aci: 'Fixed', dds_aciv: '?', dds_abiv: '3%', dds_cover: 'R 500 000.00', dds_term: 'WOL',
    ip_age: '65', ips_age: '65', ip_aci: 'Fixed', ip_aciv: '?', ip_abiv: '5%', ips_aci: 'Fixed', ips_aciv: '?', ips_abiv: '5%'
  };
  Object.keys(want).forEach(id => { assert.strictEqual(s.f[id].v, want[id], id); assert.strictEqual(s.f[id].st, 'preset', id); });
  Object.keys(want).filter(id => schema.fieldsById[id].t === 'sel').forEach(id => assert.ok(schema.fieldsById[id].o.includes(want[id]), id + ' is not one of its choices'));
  ['pd_wol', 'lc_aci', 'pd_aci', 'lc_abiv', 'pd_abiv'].forEach(id => assert.ok(!schema.fieldsById[id] || !schema.fieldsById[id].preset, id + ' should have no default'));   // the standard cover boxes are left alone
  const o = store.blank(); store.setField(o, 'lc_wol', '4%');
  assert.strictEqual(o.f.lc_wol.v, '4%');                                                // a default can be changed
  const back = store.fromJSON(store.toJSON(o));
  assert.strictEqual(back.f.lc_wol.v, '4%'); assert.strictEqual(back.f.lc_ccabi.v, '5%');   // and a saved file keeps both
});

/* ---- the shortfall quote only with a group, children's surnames, an ID number once ---- */
const util = require('../app/js/util.js');

test('the Shortfall quote block is only there when the client has group risk', () => {
  const blk = schema.sections.find(x => x.id === 'prio').blocks.find(b => b.title === 'Shortfall quote');
  assert.ok(blk.cond && blk.condMsg && blk.pdfMsg);
  assert.match(blk.condMsg, /No Group exists for a Shortfall Quote to be compiled/);
  const show = v => { const s = fresh(); if (v !== undefined) set(s, 'has_group', v); return calc.showIf(blk.cond, store.ctxFor(s)); };
  assert.strictEqual(show('Yes'), true);
  assert.strictEqual(show('No'), false);
  assert.strictEqual(show('Not sure'), false);
  assert.strictEqual(show(undefined), true);                                            // not asked yet: nothing is hidden
  assert.strictEqual(show(''), true);
});

test('names are split at the surname, particles stay with it, and a given surname is honoured', () => {
  assert.deepStrictEqual(util.splitFullName('Anna Kuiper'), { first: 'Anna', last: 'Kuiper' });
  assert.deepStrictEqual(util.splitFullName('Anna Maria Kuiper'), { first: 'Anna Maria', last: 'Kuiper' });
  assert.deepStrictEqual(util.splitFullName('Jan van der Merwe'), { first: 'Jan', last: 'van der Merwe' });
  assert.deepStrictEqual(util.splitFullName('Anna'), { first: 'Anna', last: '' });
  assert.deepStrictEqual(util.splitFullName('Anna van der Merwe', 'van der Merwe'), { first: 'Anna', last: 'van der Merwe' });
  assert.deepStrictEqual(util.splitFullName('  Anna   Kuiper '), { first: 'Anna', last: 'Kuiper' });
  assert.strictEqual(util.sexFromSaId('7212095268086'), 'Male');
  assert.strictEqual(util.sexFromSaId('7709140090084'), 'Female');
  assert.strictEqual(util.sexFromSaId('772091'), null);
});

test('a male client\'s surname goes into his children\'s Surname boxes by itself', () => {
  const s = fresh();
  set(s, 'sname', 'Kuiper');                                                           // no gender yet: nothing is filled
  assert.strictEqual(store.addRow(s, 'kids', { name: 'Anna' }, 'confirmed').d.sname, '');
  set(s, 'gender', 'Male');                                                             // the gender arrives: the empty surname is filled
  assert.strictEqual(s.l.kids[0].d.sname, 'Kuiper');
  assert.strictEqual(store.addRow(s, 'kids', { name: 'Isabel' }, 'confirmed').d.sname, 'Kuiper');   // and every new child has it
  s.l.kids[1].d.sname = 'Smith';                                                        // typed by hand: never touched
  set(s, 'sname', 'Kuyper');                                                            // the client's surname is corrected
  assert.deepStrictEqual(s.l.kids.map(r => r.d.sname), ['Kuyper', 'Smith']);            // the child that still carried the old one follows
  const f = fresh(); set(f, 'sname', 'Kuiper'); set(f, 'gender', 'Female');
  assert.strictEqual(store.addRow(f, 'kids', { name: 'Anna' }, 'confirmed').d.sname, ''); // a female client: left empty
  assert.strictEqual(store.addRow(f, 'kids', { name: 'Ben', sname: 'Smith' }, 'confirmed').d.sname, 'Smith');
});

test('an older file with one "Name & surname" box is opened as name and surname', () => {
  const old = JSON.parse(store.toJSON(store.blank()));
  old.f.sname.v = 'Kuiper';
  old.l.kids = [{ d: { name: 'Hannah Kuiper', gender: 'Female', dob: '03/01/2009', stage: '', cost: '' }, st: 'confirmed' }, { d: { name: 'Jan van der Merwe' }, st: 'confirmed' }, { d: { name: 'Thandi' }, st: 'confirmed' }];
  const s = store.fromJSON(JSON.stringify(old));
  assert.deepStrictEqual(s.l.kids.map(r => [r.d.name, r.d.sname]), [['Hannah', 'Kuiper'], ['Jan', 'van der Merwe'], ['Thandi', '']]);
  const again = store.fromJSON(store.toJSON(s));                                        // a file saved now is not split a second time
  assert.deepStrictEqual(again.l.kids.map(r => [r.d.name, r.d.sname]), [['Hannah', 'Kuiper'], ['Jan', 'van der Merwe'], ['Thandi', '']]);
  const dbl = store.blank(); store.addRow(dbl, 'kids', { name: 'Anna Maria' }, 'confirmed');
  assert.deepStrictEqual(store.fromJSON(store.toJSON(dbl)).l.kids.map(r => [r.d.name, r.d.sname]), [['Anna Maria', '']]);   // two first names, saved with a Surname box, stay as they are
});

test('an ID number can be on the form once: spaces and dashes do not hide a repeat, the box itself is not a repeat', () => {
  const s = fresh();
  set(s, 'idno', '7212095268086');
  store.addRow(s, 'shares', { name: 'Thandi Dlamini', id: '8001015009087' }, 'confirmed');
  assert.deepStrictEqual(store.idClash(s, '721209 5268086', { list: 'shares', i: 0 }), { who: 'the client' });
  assert.deepStrictEqual(store.idClash(s, '721209-5268086', { list: 'shares', i: 1 }), { who: 'the client' });
  assert.strictEqual(store.idClash(s, '7212095268086', { id: 'idno' }), null);          // the client's own box
  assert.deepStrictEqual(store.idClash(s, '800101 5009087', { id: 'idno' }), { who: 'partner / shareholder 1 (Thandi Dlamini)' });
  assert.strictEqual(store.idClash(s, '8001015009087', { list: 'shares', i: 0 }), null);
  assert.strictEqual(store.idClash(s, '9001015009084', { list: 'shares', i: 0 }), null);  // a number nobody has
  assert.strictEqual(store.idClash(s, '7212', { list: 'shares', i: 0 }), null);          // too short to be a number yet
  const p = fresh(); set(p, 'idtype', 'Passport'); set(p, 'idno', 'a1234567'); store.addRow(p, 'shares', { id: 'A 1234567' }, 'confirmed');
  assert.ok(store.idClash(p, 'A-1234567', { list: 'shares', i: 5 }), 'passport numbers are compared too, ignoring case and spaces');
});

test('a file that already repeats an ID number is flagged on both boxes', () => {
  const s = fresh();
  set(s, 'idno', '7212095268086');
  store.addRow(s, 'shares', { name: 'A', id: '7212095268086' }, 'confirmed');
  store.addRow(s, 'shares', { name: 'B', id: '8001015009087' }, 'confirmed');
  store.addRow(s, 'shares', { name: 'C', id: '8001015009087' }, 'confirmed');
  const msgs = validate.check(store.ctxFor(s)).filter(w => /already used/.test(w.msg));
  assert.strictEqual(msgs.length, 2);
  assert.match(msgs[0].msg, /already used for the client/); assert.strictEqual(msgs[0].list, 'shares'); assert.strictEqual(msgs[0].i, 0);
  assert.match(msgs[1].msg, /already used for partner \/ shareholder 2 \(B\)/); assert.strictEqual(msgs[1].i, 2);
  const ok = fresh(); set(ok, 'idno', '7212095268086'); store.addRow(ok, 'shares', { id: '8001015009087' }, 'confirmed');
  assert.strictEqual(validate.check(store.ctxFor(ok)).filter(w => /already used/.test(w.msg)).length, 0);
});

test('the client\'s gender is a box of Client info with the two choices', () => {
  assert.deepStrictEqual(schema.fieldsById.gender.o, ['Female', 'Male']);
  assert.strictEqual(schema.sections.find(x => x.id === 'info').blocks.some(b => (b.fields || []).some(f => f.id === 'gender')), true);
});

test('the income protection insured amount is always the take-home net income', () => {
  const f = schema.fieldsById.ip_amt;
  assert.strictEqual(f.calc, 'ip_amt');                                                  // worked out, so it cannot be typed over
  const s = fresh(), c = () => store.ctxFor(s);
  assert.strictEqual(calc.field('ip_amt', c()), '');                                     // no take-home income yet
  set(s, 'net', 'R 61 449.00');
  assert.strictEqual(calc.field('ip_amt', c()), 'R 61 449.00');
  assert.strictEqual(calc.field('ip_amt', c()), util.formatMoney(s.f.net.v));            // the same text as the box it follows
  set(s, 'net', '45000');                                                                // typed as a plain number: shown as an amount
  assert.strictEqual(calc.field('ip_amt', c()), 'R 45 000.00');
  assert.strictEqual(calc.field('ip_amt', c()), calc.field('hh', c()));                  // and equal to the household net income of the risk calculation
  set(s, 'ip_amt', 'R 1.00');                                                            // an old file may hold a typed amount: it is ignored
  assert.strictEqual(calc.field('ip_amt', c()), 'R 45 000.00');
});

/* ---- Date of marriage ---- */
const MARRIED_NOW = ['Married in community of property', 'Married out of community (with accrual)', 'Married out of community (no accrual)', 'Customary marriage', 'Civil union'];
const incomeSec = schema.sections.find(x => x.id === 'income');
test('Date of marriage sits right after Marital status and shows only for the marriage types', () => {
  const ids = incomeSec.blocks[0].fields.map(x => x.id);
  assert.strictEqual(ids[ids.indexOf('marital') + 1], 'marr_date');
  const def = schema.fieldsById.marr_date;
  assert.ok(def.date && def.cal && def.cond);
  const s = fresh();
  schema.fieldsById.marital.o.forEach(o => {
    set(s, 'marital', o);
    assert.strictEqual(calc.showIf(def.cond, store.ctxFor(s)), MARRIED_NOW.includes(o), o);
  });
  assert.deepStrictEqual(schema.fieldsById.marital.o.filter(o => !MARRIED_NOW.includes(o)), ['Single', 'Life partner', 'Divorced', 'Widowed']);
});
test('a hidden Date of marriage is not counted in the progress', () => {
  const s = fresh(); set(s, 'marital', 'Single');
  const single = store.counts(s, incomeSec).tot;
  set(s, 'marital', 'Customary marriage');
  assert.strictEqual(store.counts(s, incomeSec).tot, single + 1 + 3);                        // the box itself and the three spouse boxes
  const before = store.counts(s, incomeSec).fill;
  set(s, 'marr_date', '14/03/2010');
  assert.strictEqual(store.counts(s, incomeSec).fill, before + 1);
  set(s, 'marital', 'Single');
  assert.strictEqual(store.counts(s, incomeSec).fill, before, 'a date left behind is not counted once the box is hidden');
});
test('the date of marriage is tidied to day/month/year when a saved file is opened, and an old file without it opens fine', () => {
  const s = fresh(); set(s, 'marital', 'Married in community of property'); set(s, 'marr_date', '14 March 2010');
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.f.marr_date.v, '14/03/2010');
  const old = JSON.parse(store.toJSON(fresh())); delete old.f.marr_date;
  const open = store.fromJSON(JSON.stringify(old));
  assert.strictEqual(open.f.marr_date.v, '');
});
test('checks on the date of marriage: unreadable, after the form date, or before the client was 16', () => {
  const msgs = (marital, d, dob) => { const s = fresh(); set(s, 'marital', marital); set(s, 'marr_date', d); if (dob) set(s, 'dob', dob); return validate.check(store.ctxFor(s)).filter(w => w.id === 'marr_date').map(w => w.msg); };
  assert.deepStrictEqual(msgs('Customary marriage', '14/03/2010'), []);
  assert.match(msgs('Customary marriage', 'sometime in spring')[0], /not recognised/);
  assert.match(msgs('Customary marriage', '15/11/2026')[0], /after the date of the form/);
  assert.deepStrictEqual(msgs('Customary marriage', '15/10/2026'), []);                                // the day of the form is fine
  assert.match(msgs('Civil union', '01/01/2005', '14/03/1992')[0], /under 16/);
  assert.deepStrictEqual(msgs('Civil union', '01/01/2010', '14/03/1992'), []);
  assert.deepStrictEqual(msgs('Single', '15/11/2026'), [], 'a hidden date is not checked');
  assert.deepStrictEqual(msgs('Life partner', 'rubbish'), []);
});

/* ---- Heard but not placed ---- */
test('facts that were heard but not placed are kept once, saved with the file, and a dismissed one does not come back', () => {
  const s = fresh(); const seen = {};
  const a = store.addUnplaced(s, { text: 'Has a boat loan of R180 000 with Wesbank', sec: 'debts', why: 'no such box' }, seen);
  assert.ok(a && a.id && a.sec === 'debts');
  assert.strictEqual(store.addUnplaced(s, { text: 'has a BOAT loan of R180 000 with Wesbank!', sec: 'debts' }, seen), null, 'the same fact twice');
  assert.strictEqual(store.addUnplaced(s, { text: 'no' }, seen), null, 'too short');
  const b = store.addUnplaced(s, { text: 'Occupation: the conversation says Nurse', field: 'occ', value: 'Nurse', sec: 'info' }, seen);
  const c = store.addUnplaced(s, { text: 'Children: Name Ben', list: 'kids', values: { name: 'Ben', nonsense: 'x' }, sec: 'family' }, seen);
  assert.deepStrictEqual(c.values, { name: 'Ben' });
  assert.strictEqual(s.unplaced.length, 3);
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual(back.unplaced.map(x => x.text), s.unplaced.map(x => x.text));
  assert.strictEqual(back.unplaced[1].field, 'occ');
  assert.strictEqual(store.closeUnplaced(s, b.id, seen).id, b.id);
  assert.strictEqual(s.unplaced.length, 2);
  assert.strictEqual(store.addUnplaced(s, { text: 'Occupation: the conversation says Nurse', field: 'occ', value: 'Nurse' }, seen), null, 'dismissed: not offered again');
  const old = JSON.parse(store.toJSON(fresh())); delete old.unplaced;
  assert.deepStrictEqual(store.fromJSON(JSON.stringify(old)).unplaced, [], 'an older file opens with an empty list');
  assert.deepStrictEqual(store.fromJSON(JSON.stringify(Object.assign(old, { unplaced: [{ text: 'ok fact here', field: 'nonsense', value: 'x', sec: 'nope' }, 7, null] }))).unplaced.map(x => [x.text, x.field, x.sec]), [['ok fact here', undefined, undefined]]);
});

test('Debts: Owner and Payer both offer Ex-Spouse/Partner, and an older file with the other choices still opens', () => {
  ['owner', 'payer'].forEach(k => assert.deepStrictEqual(schema.lists.debts.cols.find(c => c.k === k).o, ['Client', 'Spouse', 'Joint', 'Business', 'Ex-Spouse/Partner']));
  const s = fresh(); store.addRow(s, 'debts', { type: 'Home loan', owner: 'Ex-Spouse/Partner', payer: 'Ex-Spouse/Partner' });
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.l.debts[0].d.owner, 'Ex-Spouse/Partner');
  assert.strictEqual(back.l.debts[0].d.payer, 'Ex-Spouse/Partner');
});

test('the same fact in other words is not listed twice, but a different fact is', () => {
  const s = fresh(), seen = {};
  const add = t => !!store.addUnplaced(s, { text: t }, seen);
  assert.ok(add('Has gout'));
  assert.ok(!add('Health: client also has gout'));
  assert.ok(add('Blood pressure reading 140 over 180'));
  assert.ok(!add('Blood pressure about 140 over 180'));
  assert.ok(!add('Health: blood pressure last reading 140 over 180'));
  assert.ok(add('Health: BMI is 28'));
  assert.ok(add('Discovery investment is called FlexiSave, client unsure of the product type'));
  assert.ok(!add('Discovery investment called FlexiSave, type unknown to client'));
  assert.ok(add('The Discovery Invest investment (R11 000, R99.99 p.m.) is for her husband'));
  assert.ok(!add("The Discovery Invest investment (R11 000, R99.99 p.m.) is held for the client's husband"));
  assert.ok(add('Boat loan of R180 000 with Wesbank'));
  assert.ok(add('Plans to emigrate in 2028'));
  assert.strictEqual(s.unplaced.length, 7);
});
test('a marriage date that is only a year is accepted, and one in the future is still flagged', () => {
  const msgs = (d) => { const s = fresh(); set(s, 'marital', 'Customary marriage'); set(s, 'marr_date', d); return validate.check(store.ctxFor(s)).filter(w => w.id === 'marr_date').map(w => w.msg); };
  assert.deepStrictEqual(msgs('2014'), []);
  assert.match(msgs('2099')[0], /after the date of the form/);
  assert.match(msgs('sometime')[0], /not recognised/);
});

test('income protection (fractured cover): the insured amount is split into the instalment protector, one line for each debt with an instalment, and household needs', () => {
  const s = fresh(), c = () => store.ctxFor(s);
  assert.deepStrictEqual(calc.ipSplit(c()), { insured: null, rows: [], total: 0, all: 0, on: 0, count: 0, rest: null, over: false });     // nothing known yet
  assert.strictEqual(calc.field('ip_hh', c()), '');
  set(s, 'net', 'R 60 000.00');
  [['Home loan', 'Nedbank', 10000], ['Vehicle finance', 'Wesbank', 10000], ['Credit card', 'Discovery Bank', 5000], ['Personal loan', 'Capitec', 5000]].forEach(d => store.addRow(s, 'debts', { type: d[0], prov: d[1], inst: 'R ' + d[2] + '.00' }));
  store.addRow(s, 'debts', { type: 'Vehicle finance', prov: 'Absa' });                                                // no instalment recorded: no box
  const sp = calc.ipSplit(c());
  assert.deepStrictEqual(sp.rows.map(r => [r.label, r.prov, r.inst]), [['Bond repayments', 'Nedbank', 10000], ['Car', 'Wesbank', 10000], ['Credit card', 'Discovery Bank', 5000], ['Personal loan', 'Capitec', 5000]]);
  assert.strictEqual(sp.total, 30000); assert.strictEqual(sp.rest, 30000); assert.strictEqual(sp.over, false);
  assert.strictEqual(calc.field('ip_amt', c()), 'R 60 000.00'); assert.strictEqual(calc.field('ip_hh', c()), 'R 30 000.00');
  assert.strictEqual(sp.rows.reduce((a, r) => a + r.inst, 0) + sp.rest, sp.insured);                                   // 10 000 + 10 000 + 5 000 + 5 000 + 30 000 = 60 000
  store.addRow(s, 'debts', { type: 'Other', desc: 'Boat loan', prov: 'Other', prov_other: 'Local bank', inst: 'R 3 000' });
  assert.deepStrictEqual(calc.ipSplit(c()).rows.pop(), { i: 5, label: 'Boat loan', prov: 'Local bank', inst: 3000, on: true });
  assert.strictEqual(calc.field('ip_hh', c()), 'R 27 000.00');
  assert.deepStrictEqual(validate.check(c()), []);
  store.addRow(s, 'debts', { type: 'Revolving credit', inst: 'R 40 000' });                                            // more than the insured amount
  assert.strictEqual(calc.ipSplit(c()).over, true); assert.strictEqual(calc.field('ip_hh', c()), '-R 13 000.00');
  const w = validate.check(c()).filter(x => x.id === 'ip_hh'); assert.strictEqual(w.length, 1); assert.match(w[0].msg, /R 73 000\.00 p\.m\.\) are more than the Insured amount \(R 60 000\.00 p\.m\.\) by R 13 000\.00/);
  const blk = schema.sections.find(x => x.id === 'calc').blocks.find(b => b.protector);
  assert.deepStrictEqual(blk.fields.map(f => f.id).slice(0, 3), ['ip_age', 'ip_amt', 'ip_hh']);                         // the insured amount sits right under the age
  assert.strictEqual(blk.title, 'Income protection / sickness benefit: fractured cover');
});
test('the instalment protector: a switch for each debt and one for all, and household needs follows', () => {
  const s = fresh(), c = () => store.ctxFor(s);
  set(s, 'net', 'R 60 000.00');
  [['Home loan', 'Nedbank', 10000], ['Vehicle finance', 'Wesbank', 10000], ['Credit card', 'Discovery Bank', 5000], ['Personal loan', 'Capitec', 5000]].forEach(d => store.addRow(s, 'debts', { type: d[0], prov: d[1], inst: 'R ' + d[2] + '.00' }));
  const st = () => { const p = calc.ipSplit(c()); return [p.on, p.count, p.total, p.rest, calc.field('ip_hh', c())]; };
  assert.deepStrictEqual(st(), [4, 4, 30000, 30000, 'R 30 000.00']);                                        // every debt is protected to begin with
  store.setProtect(s, 2, false); store.setProtect(s, 3, false);                                             // credit card and personal loan off
  assert.deepStrictEqual(st(), [2, 4, 20000, 40000, 'R 40 000.00']);
  assert.strictEqual(calc.ipSplit(c()).all, 30000);
  assert.deepStrictEqual(calc.ipSplit(c()).rows.map(r => r.on), [true, true, false, false]);
  assert.strictEqual(s.l.debts[2].st, 'confirmed'); s.l.debts[2].st = 'verify'; store.setProtect(s, 2, false); assert.strictEqual(s.l.debts[2].st, 'verify');      // a switch does not touch the row's status
  store.setProtectAll(s, false); assert.deepStrictEqual(st(), [0, 4, 0, 60000, 'R 60 000.00']);          // the master switch off: nothing protected, the whole insured amount is household needs
  store.setProtectAll(s, true); assert.deepStrictEqual(st(), [4, 4, 30000, 30000, 'R 30 000.00']);
  store.addRow(s, 'debts', { type: 'Revolving credit', inst: 'R 40 000' });                                  // a new debt starts switched on, and the warning counts only the protected ones
  assert.strictEqual(calc.ipSplit(c()).over, true);
  store.setProtect(s, 4, false); assert.strictEqual(calc.ipSplit(c()).over, false); assert.deepStrictEqual(validate.check(c()).filter(x => x.id === 'ip_hh'), []);
  store.setProtect(s, 0, false); store.delRow(s, 'debts', 0);                                                // the switch goes with its debt
  assert.deepStrictEqual(calc.ipSplit(c()).rows.map(r => r.label + ':' + r.on), ['Car:true', 'Credit card:true', 'Personal loan:true', 'Revolving credit:false']);
  store.setProtect(s, 1, false);
  const back = store.fromJSON(store.toJSON(s));                                                              // saved with the file
  assert.deepStrictEqual(back.l.debts.map(r => r.off === true), [false, true, false, true]);
  assert.deepStrictEqual(calc.ipSplit(store.ctxFor(back)).rows.map(r => r.on), [true, false, true, false]);
  assert.ok(!('off' in store.fromJSON(JSON.stringify({ app: 'wr-fact-find', l: { debts: [{ d: { type: 'Home loan', inst: '1000' } }] } })).l.debts[0]));   // an older file: every debt protected
  assert.ok(!schema.lists.debts.cols.some(c => c.k === 'off' || c.k === 'prot'));                            // not a box on the Debts page
});
test('the Standard Quotes have an income protection and a dread disease quote of their own, and an older file keeps its answers', () => {
  ['ips_age', 'ips_amt', 'ips_wait', 'ips_aci', 'ips_abiv', 'ips_cmt', 'dds_cover', 'dds_term', 'dds_termv', 'dds_aci', 'dds_abiv', 'dds_cmt'].forEach(id => assert.ok(schema.fieldsById[id], id));
  const old = store.blank(); old.f.dd_cover = { v: 'R 250 000.00', st: 'confirmed' }; old.f.ip_wait = { v: '1 month', st: 'confirmed' }; old.f.dd_term = { v: '', st: 'empty' };
  const back = store.fromJSON(JSON.stringify(old));
  assert.strictEqual(back.f.dd_cover.v, 'R 250 000.00'); assert.strictEqual(back.f.ip_wait.v, '1 month');             // what was typed stays
  assert.strictEqual(back.f.dd_term.v, '');                                                                          // and a box left empty in the old file is not filled behind the adviser's back
  assert.strictEqual(back.f.dds_cover.v, 'R 500 000.00');
});
