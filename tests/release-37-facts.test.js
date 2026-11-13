/* Release 3.7: faults in what the action points and the Priorities box are written from (the facts), each pinned by a test. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const S = require('../app/js/summary.js');
const autoprio = require('../app/js/autoprio.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st);
const ASTUTE = 'Draw from Astute (with signed LOA)';

/* ---------- D2: the "both" referral says which cover is with another broker ---------- */
test('D2: referral for both covers: the take-over names only the cover that is with another broker', () => {
  const s = fresh(); set(s, 'ma', 'Medical aid'); set(s, 'ma_broker', 'Paul K'); set(s, 'gap', 'Yes'); set(s, 'gap_broker', 'Other broker'); set(s, 'ref_med', 'Valerie to contact for both');
  const r = A.facts(s).referrals[0];
  assert.strictEqual(r.about, 'medical aid and gap cover'); assert.strictEqual(r.takeover, true); assert.strictEqual(r.takeover_of, 'gap cover');
  assert.ok(A.local(s).some(p => /about medical aid and gap cover \(the gap cover is currently with another broker/.test(p)), A.local(s).join('|'));
  set(s, 'ma_broker', 'Other broker');
  assert.strictEqual(A.facts(s).referrals[0].takeover_of, 'medical aid and gap cover');
  assert.ok(A.local(s).some(p => /about medical aid and gap cover \(currently with another broker/.test(p)), 'both with another broker: no "the ... is" wording');
});
test('D2: referral for the gap only, and for both with nothing answered', () => {
  const s = fresh(); set(s, 'gap', 'Yes'); set(s, 'gap_broker', 'Other broker'); set(s, 'ref_med', 'Valerie to contact for gap cover');
  const r = A.facts(s).referrals[0]; assert.strictEqual(r.about, 'gap cover'); assert.strictEqual(r.takeover_of, 'gap cover');
  assert.ok(A.local(s).some(p => /about gap cover \(currently with another broker/.test(p)), 'the gap alone is not "the gap cover is"');
  const n = fresh(); set(n, 'ref_med', 'Valerie to contact for both');                                  // the Broker boxes still hold their preset: nothing is claimed
  assert.strictEqual(A.facts(n).referrals[0].takeover, undefined);
});

/* ---------- D7: a comment on a declined area is still read ---------- */
test('D7: a comment on a "Not a priority" area goes to Claude as a declined-area note, never as an instruction or a point', () => {
  const s = fresh(); set(s, 'fname', 'Ann'); const P = schema.panelsById.life;
  set(s, P.dec, schema.NOT_PRIORITY); set(s, P.cm, 'Not a priority now, but client asked to revisit life cover in March: diarise a reminder.');
  const f = A.facts(s);
  assert.deepStrictEqual(f.instructions, []);
  assert.strictEqual(f.notes.length, 1);
  assert.strictEqual(f.notes[0].id, P.cm); assert.strictEqual(f.notes[0].page, 'Declined area: ' + P.title); assert.strictEqual(f.notes[0].declined_area, true);
  assert.ok(/diarise a reminder/.test(f.notes[0].note));
  assert.ok(A.noteIds(f).indexOf(P.cm) >= 0, 'the verdict machinery sees it');
  assert.ok(!A.local(s).some(p => /diarise|March/.test(p)), 'plain points never turn it into a point');
});
test('D7: what the form wrote itself on a declined area is not sent', () => {
  const s = fresh(); set(s, 'has_kids', 'No');                                                          // autoprio presets EGAR to Not a priority with its own comment
  const P = schema.panelsById.egar;
  assert.strictEqual(s.f[P.dec].v, schema.NOT_PRIORITY); assert.strictEqual(s.f[P.cm].st, 'preset');
  assert.strictEqual(A.facts(s).notes.filter(n => n.id === P.cm).length, 0);
  const m = fresh(), Q = schema.panelsById.st; set(m, Q.dec, schema.NOT_PRIORITY); set(m, Q.cm, store.NO_CONTACT_NOTE);
  assert.strictEqual(A.facts(m).notes.filter(n => n.id === Q.cm).length, 0, 'the migration sentence is not chased');
  set(m, Q.cm, store.NO_CONTACT_NOTE + '\nRevisit in June.');
  const n = A.facts(m).notes.filter(x => x.id === Q.cm);
  assert.strictEqual(n.length, 1); assert.strictEqual(n[0].note, 'Revisit in June.');
});
test('D7: an area that is a priority still sends its comment as an instruction, once', () => {
  const s = fresh(), P = schema.panelsById.life; set(s, P.dec, schema.PRIORITY); set(s, P.cm, 'Wants quotes.');
  const f = A.facts(s); assert.strictEqual(f.instructions.length, 1); assert.strictEqual(f.notes.length, 0);
});

/* ---------- D8: one page note is not attached to two schedules ---------- */
test('D8: two schedules on one page: the note is read once (notes[]), neither schedule carries it, each says who it is shared with', () => {
  const s = fresh(); set(s, 'has_pp', 'Yes'); set(s, 'ps_ra', ASTUTE); set(s, 'ps_pp', ASTUTE); set(s, 'n_retire', 'Sanlam RA: no need to send through');
  store.addRow(s, 'ret_ra', { prov: 'Sanlam' }); store.addRow(s, 'ret_pp', { prov: 'Alexander Forbes' });
  const f = A.facts(s), ra = f.schedules.find(x => x.what === 'retirement annuities'), pp = f.schedules.find(x => x.what === 'pension and provident funds');
  assert.ok(ra && pp);
  assert.strictEqual(ra.note_on_this_page, undefined); assert.strictEqual(pp.note_on_this_page, undefined);
  assert.strictEqual(ra.shared_with, 'pension and provident funds'); assert.strictEqual(pp.shared_with, 'retirement annuities');
  assert.strictEqual(ra.page_note_id, 'n_retire');
  assert.strictEqual(f.notes.filter(n => n.id === 'n_retire').length, 1);
});
test('D8: a page with one schedule still carries its note', () => {
  const s = fresh(); set(s, 'has_inv', 'Yes'); set(s, 'ps_inv', 'Requested from client in meeting'); set(s, 'n_inv', 'Says she emailed it');
  const sch = A.facts(s).schedules.find(x => x.what === 'investments');
  assert.ok(sch, 'the investments schedule is there'); assert.strictEqual(sch.note_on_this_page, 'Says she emailed it'); assert.strictEqual(sch.shared_with, undefined);
});

/* ---------- D9: a row that holds only the column default is an empty row ---------- */
test('D9: a new empty investment or RA row prints nothing, not "Other broker" or "Total invested: R 0"', () => {
  const s = fresh(); store.addRow(s, 'inv', {}); store.addRow(s, 'ret_ra', {});
  assert.deepStrictEqual(S.local(s, 'inv'), ['No investments recorded']);
  assert.deepStrictEqual(S.local(s, 'ra'), ['No retirement funds recorded yet']);
  assert.deepStrictEqual(S.areaData(s, 'inv').lists.inv, []);
});
test('D9: a filled row still prints, total only when a value is filled', () => {
  const s = fresh(); store.addRow(s, 'inv', { type: 'Endowment', prov: 'Sanlam' });
  let l = S.local(s, 'inv'); assert.ok(l.some(x => /Endowment/.test(x)));
  assert.ok(!l.some(x => /Total invested/.test(x)), 'no value, no total: ' + l.join('|'));
  store.addRow(s, 'inv', { type: 'Tax-free savings', val: '50000' });
  l = S.local(s, 'inv'); assert.ok(l.some(x => /Total invested: R 50 000/.test(x)), l.join('|'));
});
test('D9 (same class): a default-only retirement row does not hide the RGAR "no retirement funds" suggestion, nor count as a held policy', () => {
  const s = fresh(); set(s, 'has_ra', 'No'); set(s, 'has_pp', 'No'); store.addRow(s, 'ret_ra', {});
  set(s, 'has_ra', 'No');
  assert.ok(autoprio.suggestion(s, 'rgar'), 'the suggestion is still made');
  const t = fresh(); set(t, 'ps_ra', ASTUTE); store.addRow(t, 'ret_ra', {});
  assert.deepStrictEqual(A.facts(t).schedules[0].held, []);
});

/* ---------- D10: the weekday is the one the date gives ---------- */
test('D10: a weekday typed before the date is replaced by the true one', () => {
  const s = fresh(); set(s, 'next_appt', 'Friday 19/11/2026');
  assert.strictEqual(A.facts(s).appointment, 'Thursday 19/11/2026 (time to be agreed)');
  set(s, 'next_appt', 'Mon, 19 November 2026'); set(s, 'next_time', '14:30');
  assert.strictEqual(A.facts(s).appointment, 'Thursday 19/11/2026 at 14:30');
  set(s, 'next_appt', 'next week sometime'); set(s, 'next_time', '');
  assert.strictEqual(A.facts(s).appointment, 'next week sometime (time to be agreed)', 'what cannot be read is kept as typed');
});

/* ---------- D11: two ticked arrangements: the Priorities line says both ---------- */
test('D11: a schedule with two choices ticked has one clause for each in the Priorities box, as local() has one point each', () => {
  const s = fresh(), P = schema.panelsById.life; set(s, 'fname', 'Ann'); set(s, P.dec, schema.PRIORITY);
  set(s, 'ps_risk', 'Requested Personal Risk Covers in meeting, await client response; ' + ASTUTE);
  const t = A.focusLocal(s);
  assert.ok(/Current policy schedules for the personal risk policies: asked for from the client, awaiting the client; to be drawn from Astute with the signed LOA\./.test(t), t);
  set(s, 'ps_risk', 'Requested Personal Risk Covers in meeting, await client response; Other'); set(s, 'ps_risk_ot', 'Will email on Monday.');
  const u = A.focusLocal(s); assert.ok(/awaiting the client; Will email on Monday\./.test(u), u);
  set(s, 'ps_risk', ASTUTE);
  assert.ok(/: to be drawn from Astute with the signed LOA\./.test(A.focusLocal(s)));
});

/* ---------- C7: the taken-over RGAR suggestion stays taken over after save and open ---------- */
test('C7: autoprio.take(rgar) is kept by store.toJSON -> fromJSON, so the suggestion does not come back', () => {
  const s = fresh(); set(s, 'has_ra', 'No'); set(s, 'has_pp', 'No');
  assert.ok(autoprio.suggestion(s, 'rgar')); assert.ok(autoprio.take(s, 'rgar')); assert.strictEqual(s.auto.skip.rgar, true);
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.auto.skip.rgar, true, 'the flag survives the file');
  set(back, schema.panelsById.rgar.dec, '');                                                           // the adviser clears the decision he took
  assert.strictEqual(autoprio.suggestion(back, 'rgar'), null, 'the line does not reappear after the adviser took the area over');
  ['egar', 'med', 'will', 'st'].forEach(id => assert.ok(autoprio.SUGGESTS.indexOf(id) >= 0));
});
