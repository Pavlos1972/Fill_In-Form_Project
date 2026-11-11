/* The first choice of each "Request Current Policy Schedule(s)" box is worded for its own area ("Requested Personal Risk Covers in meeting, await client response"). */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const V = require('../app/js/voice.js');

const AREAS = { risk: 'Personal Risk Covers', grp: 'Group Risk Covers', ra: 'Retirement Annuities', pp: 'Pension and Provident Funds', inv: 'Investments' };
const OLD = 'Requested from client in meeting', ASTUTE = 'Draw from Astute (with signed LOA)', NOSEND = 'Client does not need to send through', SAVED = 'Policy Schedules saved in Client File';
const fresh = () => store.blank();
const set = (s, id, v) => store.setField(s, id, v);
const idx = V.buildIndex(schema);

test('each of the five boxes has its own wording for the first choice, then Policy Schedules saved in Client File, Astute (not for group risk) and Other', () => {
  Object.keys(AREAS).forEach(k => {
    const want = 'Requested ' + AREAS[k] + ' in meeting, await client response';
    assert.strictEqual(schema.psClient[k], want);
    assert.deepStrictEqual(schema.fieldsById['ps_' + k].o, k === 'grp' ? [want, SAVED, 'Other'] : [want, SAVED, ASTUTE, 'Other'], k);
    assert.ok(!schema.fieldsById['ps_' + k].o.includes(OLD) && !schema.fieldsById['ps_' + k].o.includes(NOSEND), 'the old choices are gone');
  });
  assert.strictEqual(schema.psClient.risk, 'Requested Personal Risk Covers in meeting, await client response');            // the example given
  assert.strictEqual(new Set(Object.values(schema.psClient)).size, 5);
});

test('a file saved with the old wording opens with the wording of each area, ticks and all', () => {
  const j = JSON.parse(store.toJSON(fresh()));
  Object.keys(AREAS).forEach(k => { j.f['ps_' + k] = { v: OLD + '; Other', st: 'confirmed' }; j.f['ps_' + k + '_ot'] = { v: 'By courier', st: 'confirmed' }; });
  j.f.ps_inv = { v: OLD + '; ' + ASTUTE, st: 'heard' }; j.f.ps_grp = { v: 'Other', st: 'confirmed' };
  const s = store.fromJSON(JSON.stringify(j));
  assert.strictEqual(s.f.ps_risk.v, schema.psClient.risk + '; Other'); assert.strictEqual(s.f.ps_ra.v, schema.psClient.ra + '; Other'); assert.strictEqual(s.f.ps_pp.v, schema.psClient.pp + '; Other');
  assert.strictEqual(s.f.ps_inv.v, schema.psClient.inv + '; ' + ASTUTE); assert.strictEqual(s.f.ps_inv.st, 'heard');
  assert.strictEqual(s.f.ps_grp.v, 'Other');                                                                                // nothing to change: left as it was
  assert.strictEqual(s.f.ps_risk_ot.v, 'By courier');                                                                       // the "Other" text is kept
  const again = store.fromJSON(store.toJSON(s)); assert.strictEqual(again.f.ps_risk.v, s.f.ps_risk.v);                      // opening it again changes nothing
});

test('the action point for a request made in the meeting says to await the client\'s response, in each area', () => {
  const what = { risk: 'personal risk policies', grp: 'group risk benefits', ra: 'retirement annuities', pp: 'pension and provident funds', inv: 'investments' };
  Object.keys(AREAS).forEach(k => {
    const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'ps_' + k, schema.psClient[k]);
    assert.ok(A.local(s).includes('Follow up with the client Thandi for the current policy schedules, asked for in the meeting, for the ' + what[k] + ': await client response.'), k + ': ' + A.local(s).join(' | '));
  });
  const a = fresh(); set(a, 'fname', 'Thandi'); set(a, 'loa', 'Yes'); set(a, 'ps_inv', ASTUTE);
  assert.ok(!A.local(a).some(p => /await client response/.test(p)));                                                        // Astute alone: nothing to await from the client
  const both = fresh(); set(both, 'fname', 'Thandi'); set(both, 'loa', 'Yes'); set(both, 'ps_ra', schema.psClient.ra + '; ' + ASTUTE);
  assert.ok(A.local(both).some(p => /asked for in the meeting.*await client response/.test(p)) && A.local(both).some(p => /Draw the current policy schedules/.test(p)));
});

test('the facts for Claude keep one name for the choice, and the Claude instructions say to await the response', () => {
  const s = fresh(); set(s, 'ps_risk', schema.psClient.risk);
  assert.deepStrictEqual(A.facts(s).schedules[0].requested, [OLD]);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'js', 'voice-ai.js'), 'utf8');
  assert.ok(src.includes('await client response'));
});

test('voice ticks the first choice of the box that is being asked about', () => {
  Object.keys(AREAS).forEach(k => {
    const f = idx.byId['ps_' + k];
    assert.strictEqual(V.interpret(f, 'the client will send them').value, schema.psClient[k], k);
    assert.strictEqual(V.interpret(f, 'not through Astute, she will send them').value, schema.psClient[k], k);
  });
  assert.strictEqual(V.interpret(idx.byId.ps_ra, 'both').value, schema.psClient.ra + '; ' + ASTUTE);
  assert.strictEqual(V.mergeMulti(schema.psClient.risk, ASTUTE, idx.byId.ps_risk.options), schema.psClient.risk + '; ' + ASTUTE);
});

test('"Policy Schedules saved in Client File": every box has it, voice picks it when it is said, the action points chase nothing for it, and the removed choice opens as it', () => {
  Object.keys(AREAS).forEach(k => {
    assert.ok(schema.fieldsById['ps_' + k].o.includes(SAVED), k);
    const f = idx.byId['ps_' + k];
    ['we already have the schedules', 'the schedule is saved in the client file', 'it is on file', 'we have them on file', 'the client does not need to send them through', 'there is no need to send anything'].forEach(t =>
      assert.strictEqual(V.interpret(f, t).value, SAVED, k + ': "' + t + '"'));
    assert.strictEqual(V.interpret(f, 'the client will send them').value, schema.psClient[k], k + ': "the client will send them" is the first choice, never this one');
  });
  const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'ps_ra', SAVED);
  assert.deepStrictEqual(A.facts(s).schedules, []);
  assert.ok(!A.local(s).some(p => /schedules/.test(p)), A.local(s).join(' | '));
  set(s, 'ps_ra', schema.psClient.ra + '; ' + SAVED);                                                                       // with another choice, the other choice is what counts
  assert.deepStrictEqual(A.facts(s).schedules.map(x => x.requested), [[OLD]]);
  const t = fresh(); set(t, 'ps_risk', NOSEND); set(t, 'ps_inv', schema.psClient.inv + '; ' + NOSEND + '; ' + ASTUTE); set(t, 'ps_ra', OLD + '; ' + NOSEND);
  const o = store.fromJSON(store.toJSON(t));
  assert.strictEqual(o.f.ps_risk.v, SAVED, 'a file that held "Client does not need to send through" opens with Policy Schedules saved in Client File');
  assert.strictEqual(o.f.ps_inv.v, schema.psClient.inv + '; ' + SAVED + '; ' + ASTUTE, 'in place, with the other choices kept');
  assert.strictEqual(o.f.ps_ra.v, schema.psClient.ra + '; ' + SAVED, 'both older wordings are moved');
});

test('Request Current Policy Schedule(s) greys out when the Yes/No above is No, says so, and the PDF says so too', () => {
  const gate = { risk: 'has_risk', grp: 'has_group', ra: 'has_ra', pp: 'has_pp', inv: 'has_inv' };
  Object.keys(AREAS).forEach(k => {
    const s = fresh(); set(s, 'fname', 'Thandi'); set(s, 'ps_' + k, schema.psClient[k]);
    assert.ok(A.local(s).some(p => /current policy schedules/.test(p)), k + ' is asked for');
    set(s, gate[k], 'No');
    assert.ok(!A.local(s).some(p => /current policy schedules/.test(p)), k + ': No, so nothing to request');
    assert.strictEqual(s.f['ps_' + k].v, '', k + ' cleared');
  });
  const blk = schema.sections.reduce((a, x) => a.concat(x.blocks), []).filter(b => b.title === 'Request Current Policy Schedule(s)');
  assert.strictEqual(blk.length, 5);
  assert.ok(blk.every(b => b.condMsg === 'No policy schedules to request' && b.grey === 1 && b.pdfMsg === 1));
});
