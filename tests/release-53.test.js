/* Release 5.3 (Fact Find 5.3, Risk Application 1.5, Investment Application 1.4), the adviser's list of 20 November 2026:
   1. Date completed has a Calendar.
   2. Spousal Maintenance and Child Maintenance are greyed out unless the client is divorced (Child Maintenance: also single).
   3. The short-term broker on record is Cameron Maritz, not Paul K.
   4. The conversation log is kept in the browser (logkeep.js); Save log with nothing says so.
   5. The Risk Application's second page is Address, COC & doctor; "Other forms" menus on the two applications; the two applications open filled from the Fact Find (handover.js).
   (The client's agreement to a read-back is tested on the real page in tests/browser/t-release53.js.) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');
const SR = require('../app/js/sr-schema.js');
const CS = require('../app/js/cs-schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const A = require('../app/js/actions.js');
const V = require('../app/js/voice.js');
const K = require('../app/js/logkeep.js');
const H = require('../app/js/handover.js');

const fresh = () => store.blank();
const set = (s, id, v, st) => store.setField(s, id, v, st || 'confirmed');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const shown = (s, id) => calc.showIf(schema.fieldsById[id].cond, store.ctxFor(s));
const STATUSES = schema.fieldsById.marital.o;
const MARRIED = ['Married in community of property', 'Married out of community (with accrual)', 'Married out of community (no accrual)', 'Customary marriage', 'Civil union'];

test('versions: Fact Find 5.3, Risk Application 1.5, Investment Application 1.4 or later; every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 5.3, schema.version);
  assert.ok(parseFloat(SR.version) >= 1.5 && parseFloat(CS.version) >= 1.4, SR.version + ' ' + CS.version);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
  assert.match(app('js/build.js'), new RegExp("BUILD = '" + schema.version.replace('.', '\\.') + "'"));
});

test('1. Date completed has a Calendar, like the other dates', () => {
  assert.strictEqual(schema.fieldsById.date.cal, 1);
  assert.strictEqual(schema.fieldsById.date.date, 1);
  assert.strictEqual(schema.fieldsById.marr_date.cal, 1, 'the others keep theirs');
});

test('2. Spousal Maintenance is open only for a divorced client, Child Maintenance for a divorced or single one; nothing is open or shut before the marital status is answered', () => {
  ['spmaint', 'maint'].forEach(id => { const f = schema.fieldsById[id]; assert.strictEqual(f.grey, 1, id + ' is greyed, not hidden'); assert.ok(f.cond, id + ' has a rule'); });
  const s = fresh();
  assert.ok(shown(s, 'spmaint') && shown(s, 'maint'), 'marital status not answered: both open');
  STATUSES.forEach(st => {
    set(s, 'marital', st);
    assert.strictEqual(shown(s, 'spmaint'), st === 'Divorced', 'Spousal Maintenance for ' + st);
    assert.strictEqual(shown(s, 'maint'), st === 'Divorced' || st === 'Single', 'Child Maintenance for ' + st);
  });
  MARRIED.concat(['Life partner', 'Widowed']).forEach(st => { set(s, 'marital', st); assert.strictEqual(shown(s, 'spmaint') || shown(s, 'maint'), false, st + ': both greyed'); });
  assert.ok(STATUSES.indexOf('Divorced') >= 0 && STATUSES.indexOf('Single') >= 0, 'the choices are as they were');
});

test('2. the rule in calc.js (which leaves greyed boxes out of the sums) is the rule in schema.js', () => {
  // the sums must follow the boxes: for every status, a greyed box adds nothing and an open one adds its amount
  STATUSES.concat(['']).forEach(st => {
    const s = fresh(); set(s, 'net', 'R 50 000.00'); set(s, 'spmaint', 'R 3 000.00'); set(s, 'maint', 'R 2 000.00'); if (st) set(s, 'marital', st);
    const c = store.ctxFor(s), want = 50000 + (shown(s, 'spmaint') ? 3000 : 0) + (shown(s, 'maint') ? 2000 : 0);
    assert.strictEqual(calc.field('tinc', c), schemaMoney(want), 'Total Income for "' + st + '"');
    set(s, 'exp', 'R 10 000.00');
    assert.strictEqual(calc.field('disp', store.ctxFor(s)), schemaMoney(want - 10000), 'Disposable income for "' + st + '"');
  });
  function schemaMoney(n) { return require('../app/js/util.js').money(n); }
});

test('2. a greyed maintenance box keeps what was typed, and a note in it does not blank Total Income', () => {
  const s = fresh(); set(s, 'net', 'R 50 000.00'); set(s, 'maint', 'R 2 000.00'); set(s, 'marital', 'Single');
  assert.strictEqual(calc.field('tinc', store.ctxFor(s)), 'R 52 000.00', 'a single client: open, counted');
  set(s, 'marital', 'Married in community of property');
  assert.strictEqual(s.f.maint.v, 'R 2 000.00', 'what was typed stays in the file');
  assert.strictEqual(calc.field('tinc', store.ctxFor(s)), 'R 50 000.00', 'but it is left out while the box is greyed');
  set(s, 'spmaint', 'about three thousand');
  assert.strictEqual(calc.field('tinc', store.ctxFor(s)), 'R 50 000.00', 'words in a greyed box do not stop the total');
  const back = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual([back.f.maint.v, back.f.spmaint.v], ['R 2 000.00', 'about three thousand'], 'saving and opening loses nothing');
});

test('3. the short-term broker on record offers Cameron Maritz and not Paul K; the other three boxes and the lists keep Paul K', () => {
  assert.deepStrictEqual(schema.fieldsById.sti_broker.o, ['Cameron Maritz', 'Other broker', 'Through company', 'None']);
  ['ma_broker', 'gap_broker', 'will_broker'].forEach(id => assert.deepStrictEqual(schema.fieldsById[id].o, ['Paul K', 'Other broker', 'Through company', 'None'], id));
  ['risk', 'grp', 'ret_ra', 'ret_pp', 'inv', 'bizpol'].forEach(k => assert.ok(schema.lists[k].cols.find(c => c.k === 'broker').o.indexOf('Paul K') >= 0, k));
  assert.strictEqual(schema.fieldsById.sti_broker.preset, 'Other broker', 'it still starts as Other broker');
  assert.strictEqual(schema.fieldsById.sti_broker.keepOld, 1, 'a value an older file holds is shown, not hidden');
});

test('3. a file keeps its short-term broker: Paul K stays, Cameron Maritz is no longer turned into Other broker (the other boxes still turn it)', () => {
  const j = JSON.parse(store.toJSON(fresh()));
  j.f.sti = { v: 'Yes', st: 'confirmed' }; j.f.sti_broker = { v: 'Paul K', st: 'heard' };
  let s = store.fromJSON(JSON.stringify(j));
  assert.deepStrictEqual([s.f.sti_broker.v, s.f.sti_broker.st], ['Paul K', 'heard'], 'nothing is cleared');
  j.f.sti_broker = { v: 'Cameron Maritz', st: 'confirmed' }; s = store.fromJSON(JSON.stringify(j));
  assert.strictEqual(s.f.sti_broker.v, 'Cameron Maritz');
  j.f.ma = { v: 'Medical aid', st: 'confirmed' }; j.f.ma_broker = { v: 'Cameron Maritz', st: 'confirmed' }; s = store.fromJSON(JSON.stringify(j));
  assert.strictEqual(s.f.ma_broker.v, 'Other broker', 'the old choice of the medical aid box is still read as Other broker');
  assert.strictEqual(store.fromJSON(store.toJSON(s)).f.sti_broker.v, 'Cameron Maritz', 'and it survives saving');
});

test('3. voice: Cameron or Maritz is the short-term broker Cameron Maritz; Paul is not a short-term broker; the other boxes read Paul as before', () => {
  const idx = V.buildIndex(schema), r = (id, t) => { const x = V.interpret(idx.byId[id], t); return x && (x.error ? 'ERR:' + x.error : x.value); };
  assert.strictEqual(r('sti_broker', 'Cameron looks after it'), 'Cameron Maritz');
  assert.strictEqual(r('sti_broker', 'it is with Cameron Maritz'), 'Cameron Maritz');
  assert.notStrictEqual(r('sti_broker', 'Paul is the broker'), 'Paul K');
  assert.strictEqual(r('sti_broker', 'another broker'), 'Other broker');
  assert.strictEqual(r('will_broker', 'Paul is the broker'), 'Paul K');
});

test('3. with Cameron Maritz as the short-term broker the form decides nothing by itself: no automatic Not a priority, no "another broker" take-over wording', () => {
  const s = fresh(); set(s, 'sti', 'Yes'); set(s, 'sti_broker', 'Cameron Maritz'); set(s, 'ref_sti', 'Cameron to contact client');
  const f = A.facts(s), ref = (f.referrals || []).filter(x => x.who === 'Cameron')[0];
  assert.ok(ref && !ref.takeover, 'the referral is as the adviser set it, and it does not call the cover another broker\'s');
  set(s, 'sti_broker', 'Other broker'); assert.ok(A.facts(s).referrals.filter(x => x.who === 'Cameron')[0].takeover, 'Other broker is as before');
  const t = fresh(); set(t, 'sti', 'Yes'); set(t, 'sti_broker', 'Cameron Maritz');
  assert.strictEqual(t.f.pr_st.v, '', 'no decision is filled in for Short Term');
});

test('4. logkeep: lines are kept as they are heard, listed, read back in order, and gone once removed', async () => {
  const k = K.create(K.memoryBackend()), sid = k.newSid();
  assert.deepStrictEqual(await k.list(), [], 'nothing kept yet');
  await k.save({ sid, client: 'Anna Kuiper', startedAt: 1000, meta: { app: { version: '5.3' } } }, [{ kid: 2, line: { heard: 'two' } }, { kid: 1, line: { heard: 'one' } }]);
  await k.save({ sid, client: 'Anna Kuiper', startedAt: 1000, meta: { app: { version: '5.3' } } }, [{ kid: 3, line: { heard: 'three' } }, { kid: 1, line: { heard: 'one, with the reply' } }]);
  const rows = await k.list();
  assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].count, 3); assert.strictEqual(rows[0].client, 'Anna Kuiper');
  const one = await k.read(sid);
  assert.deepStrictEqual(one.lines.map(l => l.heard), ['one, with the reply', 'two', 'three'], 'in the order heard; a line written again is replaced, not doubled');
  assert.strictEqual(one.meta.app.version, '5.3');
  assert.strictEqual(await k.read('nope'), null);
  await k.remove(sid);
  assert.deepStrictEqual(await k.list(), [], 'removed');
});

test('4. logkeep: a session with no lines is not listed, the newest is first, and a session nobody saved for 14 days is dropped', async () => {
  const k = K.create(K.memoryBackend()), day = 24 * 3600 * 1000, now = Date.now();
  await k.save({ sid: 'empty', client: 'Nobody', startedAt: now }, []);
  assert.deepStrictEqual(await k.list(), [], 'no lines, no reminder');
  await k.save({ sid: 'a', client: 'Anna', startedAt: now }, [{ kid: 1, line: { heard: 'x' } }]);
  await k.save({ sid: 'b', client: 'Piet', startedAt: now }, [{ kid: 1, line: { heard: 'y' } }]);
  assert.strictEqual((await k.list()).length, 2);
  assert.strictEqual(await k.purge(now + 13 * day), 0, 'thirteen days: kept');
  assert.ok(await k.purge(now + 15 * day) >= 2, 'fifteen days: dropped');
  assert.deepStrictEqual(await k.list(), []);
});

test('4. logkeep: with no storage nothing breaks and nothing is kept', async () => {
  const broken = { putSession: () => Promise.reject(new Error('no')), putLines: () => Promise.reject(new Error('no')), sessions: () => Promise.reject(new Error('no')), lines: () => Promise.reject(new Error('no')), count: () => Promise.reject(new Error('no')), remove: () => Promise.reject(new Error('no')) };
  const k = K.create(broken);
  assert.strictEqual(await k.save({ sid: 's', client: 'x', startedAt: 1 }, [{ kid: 1, line: {} }]), false);
  assert.deepStrictEqual(await k.list(), []); assert.strictEqual(await k.read('s'), null); assert.strictEqual(await k.remove('s'), false);
});

test('4. ui.js keeps the log, says when Save log has nothing, and reminds when a log is unsaved (new client, opened file, Fact Find saved, page start)', () => {
  const ui = app('js/ui.js');
  assert.match(ui, /function cvKeepAdd\(entry\)/); assert.match(ui, /function keepFlush\(all\)/);
  assert.match(ui, /addEventListener\('pagehide'/, 'what is kept is written when the page is left');
  assert.match(ui, /function logBoundary\(\)/);
  assert.match(ui, /meeting\.reset\(\); meetingRender\(\); logBoundary\(\);/, 'New');
  assert.match(ui, /var opened = store\.fromJSON\(r\.result\); logBoundary\(\);/, 'Open');
  assert.match(ui, /toast\(lastFolder \? 'Saved to '[^\n]*logRemind\(\);/, 'the Fact Find is saved');
  assert.match(ui, /keeper\.purge\(\)\.then\(function \(\) \{ return logBarShow\(\); \}\)/, 'page start');
  assert.match(ui, /function logEmpty\(\)/); assert.match(ui, /Nothing to save: no conversation has been heard/);
  const html = app('index.html');
  assert.ok(html.indexOf('js/logkeep.js') > 0 && html.indexOf('js/logkeep.js') < html.indexOf('js/ui.js'));
  assert.ok(html.indexOf('js/handover.js') > 0 && html.indexOf('js/handover.js') < html.indexOf('js/ui.js'));
});

/* ---- 5. the Risk Application and the Investment Application ---- */
test('5. the Risk Application\'s second page is Address, COC & doctor, and its id is still home', () => {
  const p = SR.pages.filter(x => x.id === 'home')[0];
  assert.strictEqual(p.title, 'Address, COC & doctor');
  assert.deepStrictEqual(SR.pages.map(x => x.id), ['client', 'home', 'bank', 'family', 'decl']);
  assert.ok(!/Home COC/.test(app('js/sr-pdf.js')) && !/Home COC/.test(app('short-risk.html')));
});

test('5. each application has the "Other forms" menu: the Risk Application lists Fact Find and Investment Application, the Investment Application lists Fact Find and Risk Application', () => {
  const menu = f => { const m = app(f).match(/<details class="otherforms" id="otherForms">([\s\S]*?)<\/details>/); assert.ok(m, f + ': the menu is there'); return m[1]; };
  const sr = menu('short-risk.html'), cs = menu('capture-sheet.html');
  assert.match(sr, /<summary[^>]*>Other forms/); assert.match(cs, /<summary[^>]*>Other forms/);
  assert.match(sr, /id="linkFF" href="index\.html"/); assert.match(sr, /id="linkCS" href="capture-sheet\.html"/); assert.ok(!/linkSR/.test(sr));
  assert.match(cs, /id="linkFF" href="index\.html"/); assert.match(cs, /id="linkSR" href="short-risk\.html"/); assert.ok(!/linkCS/.test(cs));
  [sr, cs].forEach(m => assert.match(m, /target="_blank"/));
  ['short-risk.html', 'capture-sheet.html'].forEach(f => { const h = app(f); assert.ok(h.indexOf('js/handover.js') > h.indexOf('js/folders-ui.js') && h.indexOf('js/handover.js') < h.indexOf(f === 'short-risk.html' ? 'js/sr-ui.js' : 'js/cs-ui.js'), f); assert.ok(!/<span class="chips"><a/.test(h), f + ': the two loose links are gone'); });
});

test('5. the Fact Find\'s links to the two applications carry the client (?from=factfind) and leave it when clicked', () => {
  const h = app('index.html');
  assert.match(h, /id="linkSR" href="short-risk\.html\?from=factfind"/); assert.match(h, /id="linkCS" href="capture-sheet\.html\?from=factfind"/);
  assert.match(app('js/ui.js'), /FF\.handover\.send\(store\.toJSON\(state\), fileBase \|\| currentBase\(\)\)/);
  assert.match(app('js/ui.js'), /FF\.handover\.clear\(\)/, 'a new Fact Find forgets it');
});

function fakeWin() {
  const mem = {}; return { localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }, mem };
}
const ffText = () => {
  const s = fresh(); set(s, 'fname', 'Anna Maria'); set(s, 'sname', 'Kuiper'); set(s, 'idno', '9001015800088'); set(s, 'cell', '082 555 0101'); store.addRow(s, 'kids', { name: 'Thandi', sname: 'Kuiper' });
  const j = JSON.parse(store.toJSON(s)); j.worked = { x: 1 }; j.sum = { life: {} }; j.claude = { usd: 5 }; j.f.cc_notes = { v: 'private notes', st: 'verify' };
  return JSON.stringify(j);
};

test('5. handover: the Fact Find is left for an hour with only what the applications read, and then it is gone', () => {
  const w = fakeWin(), t0 = Date.now();
  assert.strictEqual(H.send(ffText(), 'Fact Find (Audio to Text) - 20.11.26 - (Anna Maria Kuiper)', w), true);
  const r = H.peek(w, t0 + 1000);
  assert.deepStrictEqual(r.who, { fname: 'Anna Maria', sname: 'Kuiper' }); assert.match(r.name, /Anna Maria Kuiper/);
  const j = JSON.parse(r.text);
  assert.ok(j.app === 'wr-fact-find' && j.f.idno.v === '9001015800088' && j.l.kids.length === 1, 'the answers and the lists are there');
  ['worked', 'sum', 'claude', 'openai', 'unplaced', 'pa', 'focus'].forEach(k => assert.ok(!(k in j), k + ' is not kept'));
  assert.ok(!('cc_notes' in j.f), 'the Current Client notes are not kept');
  assert.ok(H.peek(w, t0 + 59 * 60 * 1000), 'still there after 59 minutes');
  assert.strictEqual(H.peek(w, t0 + 61 * 60 * 1000), null, 'gone after an hour');
  assert.strictEqual(w.localStorage.getItem(H.KEY), null, 'and removed from the browser');
});

test('5. handover: a Fact Find with no client name leaves nothing, clear forgets, and the storage being unavailable is no error', () => {
  const w = fakeWin(), blank = JSON.stringify(JSON.parse(store.toJSON(fresh())));
  assert.strictEqual(H.send(blank, '', w), false); assert.strictEqual(H.peek(w), null);
  H.send(ffText(), 'x', w); assert.ok(H.peek(w)); H.clear(w); assert.strictEqual(H.peek(w), null);
  const broken = { localStorage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } } };
  assert.strictEqual(H.send(ffText(), 'x', broken), false); assert.strictEqual(H.peek(broken), null); H.clear(broken);
});

test('5. handover: the same client is the same surname with the first names agreeing as far as the shorter goes (capitals and accents do not matter)', () => {
  const who = { fname: 'Anna Maria', sname: 'Kuiper' };
  assert.ok(H.sameClient(who, 'Anna Maria', 'Kuiper') && H.sameClient(who, 'anna', 'KUIPER') && H.sameClient({ fname: 'Zoë', sname: 'Dube' }, 'Zoe', 'Dube'));
  assert.ok(!H.sameClient(who, 'Annabel', 'Kuiper') && !H.sameClient(who, 'Anna', 'Botha') && !H.sameClient(who, '', '') && !H.sameClient(null, 'Anna', 'Kuiper'));
});

test('5. handover: the page opened from the Fact Find knows it (?from=factfind) and tidies the address', () => {
  const w = { location: { search: '?from=factfind', pathname: '/short-risk.html', hash: '' }, history: { replaceState(a, b, url) { w.replaced = url; } } };
  assert.strictEqual(H.wants(w), true); H.stripFlag(w); assert.strictEqual(w.replaced, '/short-risk.html');
  assert.strictEqual(H.wants({ location: { search: '' } }), false); assert.strictEqual(H.wants({ location: { search: '?x=1' } }), false);
});

test('5. both applications read the hand-over like "Load from Fact Find" (amber, never over typed boxes) and ask before replacing another client\'s unsaved work', () => {
  ['js/sr-ui.js', 'js/cs-ui.js'].forEach(f => {
    const u = app(f);
    assert.match(u, /HF\.wants\(window\) \? HF\.peek\(\) : null/, f); assert.match(u, /store\.loadFromFactFind\(state, ho\.text/, f);
    assert.match(u, /other = !!HO && !HF\.sameClient\(HO\.who, restored\.f\.fname\.v, restored\.f\.sname\.v\)/, f);
    assert.match(u, /Start a new application for/, f); assert.match(u, /HF\.bindMenu\(document\)/, f);
  });
});

test('no function is defined twice in the page scripts (a second definition silently replaces the first: 5.3 nearly did that to the conversation box)', () => {
  ['js/ui.js', 'js/sr-ui.js', 'js/cs-ui.js', 'js/handover.js', 'js/logkeep.js'].forEach(f => {
    const names = (app(f).match(/^  function ([A-Za-z0-9_$]+)/gm) || []).map(x => x.replace(/^  function /, ''));
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepStrictEqual(dup, [], f + ' defines twice: ' + dup.join(', '));
  });
});

test('the README names the new files and the changes (the Layout table is also checked by readme.test.js)', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  ['app/js/logkeep.js', 'app/js/handover.js', 'Release 5.3'].forEach(x => assert.ok(r.includes(x), x));
});
