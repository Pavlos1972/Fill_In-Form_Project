/* Client Overview Studio 0.93 (23 November, Paul's fourth round after he tested 0.92 on a real client: ten faults, each with its cause found in the code). Invented client only ("Test Client"):
   (1) the ACI is shown as 1 to 3 short points, never a paragraph; (2, 6) a debt's Life cover instalment is its Lump sum disability instalment too; (3) the BrightRock e-mail (read from a file in the client's folder, or pasted) gives
   the death-related income portion; (4) the Checks card is folded; (5) the Astute report date is filled into Client details; (7) a missing instalment is taken from the client's other BrightRock quote of the same debt, else the Fact
   Find, and says so; (8) block 11 gets the Fact Find's answers whatever the item's status; (9) the folder tells what a file is; (10) "FNB Rev Credit" and "Revolving credit" are one debt. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const docs = require('../app/js/ov-docs.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const v = x => ({ v: x });
const FFJ = (f, debts) => ({ app: 'wr-fact-find', schema: '5.4', f: Object.assign({ fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('10/11/2026') }, f || {}),
  l: { kids: [], debts: (debts || [['Home loan', 'Test Bank A', 'R 9 000.00', 'R 900 000.00'], ['Revolving credit', 'Test Bank B', 'R 1 873.00', 'R 72 000.00']]).map(d => ({ d: { type: d[0], prov: d[1], desc: d[0], inst: d[2], bal: d[3], term: '60' } })), risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }] } });
const withFF = (f, debts) => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ(f, debts)), 'ff.json'); return s; };
const quote = (s, block, number, lines, extra) => docs.applyQuote(s, block, Object.assign({ insurer: 'BrightRock', number, date: '19/11/2026', premium: 5000, lines }, extra || {}), 'q.pdf').quote;
const HOME = (m, l) => ({ type: 'debt', debt: 'Home loan', bank: 'Test Bank A', life: { lump: l == null ? 900000 : l, monthly: m }, lsd: { lump: l == null ? 900000 : l, monthly: null }, abi: 0 });

/* ---------- 2 and 6: the instalment is one figure ---------- */
test('a debt\'s Life cover instalment is carried into an empty Lump sum disability instalment (read, opened, settled); a typed figure and N/A are never touched; typing drops the "from" note', () => {
  const l = store.newLine('debt'); l.life.lump = 900000; l.life.monthly = 9000; l.lsd.lump = 900000;
  assert.strictEqual(calc.settleLine(l), 1); assert.strictEqual(l.lsd.monthly, 9000);
  const t = store.newLine('debt'); t.life.monthly = 9000; t.lsd.monthly = 123; assert.strictEqual(calc.settleLine(t), 0); assert.strictEqual(t.lsd.monthly, 123, 'typed: kept');
  const na = store.newLine('debt'); na.life.monthly = 9000; na.lsd = 'N/A'; assert.strictEqual(calc.settleLine(na), 0); assert.strictEqual(na.lsd, 'N/A');
  const nf = store.newLine('debt'); nf.life.monthly = 'Not found'; assert.strictEqual(calc.settleLine(nf), 0, 'only a number is carried');
  const h = store.newLine('household'); h.life.monthly = 500; assert.strictEqual(calc.settleLine(h), 0); assert.strictEqual(h.lsd.monthly, null, 'only a debt');
  const s = withFF(), q = quote(s, 'fna', '100000081', [HOME(9000)]);
  assert.strictEqual(q.lines[0].lsd.monthly, 9000, 'when the quote is read, the debt line has both');
  q.lines[0].lsd.monthly = null; q.lines[0].via = { 'lsd.monthly': 'x' }; check.settleAll(s); assert.strictEqual(q.lines[0].lsd.monthly, 9000, 'an older quote is settled when it opens');
  const p = 'blocks.fna.quotes.0.lines.0.life.monthly'; q.lines[0].via = { 'life.monthly': 'from the Fact Find' }; store.setPath(s, p, 'R 9 500', 'money'); assert.ok(!q.lines[0].via['life.monthly'], 'a figure somebody types is no longer "from ..."');
});

/* ---------- 7: a missing instalment comes from the other quote, else the Fact Find ---------- */
test('a debt\'s missing instalment is taken from the client\'s other BrightRock quote of the same debt, else from the Fact Find, and the line says so; a typed figure and a quote\'s own figure are kept', () => {
  const s = withFF();
  const fna = quote(s, 'fna', '100000081', [HOME(9000), { type: 'debt', debt: 'Revolving credit', life: { lump: 72000, monthly: 1873 }, lsd: { lump: 72000, monthly: null }, abi: 0 }]);
  const red = quote(s, 'reduced', '100000083', [HOME(null, 700000), { type: 'debt', debt: 'FNB Rev Credit', life: { lump: 72000, monthly: null }, lsd: { lump: 72000, monthly: null }, abi: 0 }]);
  assert.strictEqual(red.lines[0].life.monthly, 'Not found', 'the reduced quote printed no instalment');
  const n = check.settleAll(s); assert.ok(n >= 2);
  const home = red.lines[0], rev = red.lines[1];
  assert.strictEqual(home.life.monthly, 9000); assert.strictEqual(home.via['life.monthly'], 'from the FNA quote CP 100000081'); assert.strictEqual(home.lsd.monthly, 9000, 'and the Lump sum disability box carries it');
  assert.strictEqual(rev.life.monthly, 1873, '"FNB Rev Credit" is the FNA\'s "Revolving credit": same debt'); assert.match(rev.via['life.monthly'], /^from the FNA quote CP 100000081$/);
  const s2 = withFF(), only = quote(s2, 'reduced', '100000083', [HOME(null)]); check.settleAll(s2);
  assert.strictEqual(only.lines[0].life.monthly, 9000); assert.strictEqual(only.lines[0].via['life.monthly'], 'from the Fact Find', 'no other quote has it: the Fact Find\'s instalment');
  assert.ok(calc.activeLines(only).every(l => l.st === 'confirmed'), 'with every figure there the line is ticked');
  const typed = quote(withFF(), 'reduced', '100000084', [Object.assign(HOME(null), { life: { lump: 900000, monthly: null } })]); typed.lines[0].life.monthly = 7777; typed.lines[0].by = 'person';
  check.fillInstalments({ blocks: { reduced: { quotes: [typed] }, fna: { quotes: [] }, shortfallQuote: { quotes: [] }, comparative: { quotes: [] } }, factFind: { facts: { debts: [] } } }); assert.strictEqual(typed.lines[0].life.monthly, 7777);
});

/* ---------- 10: the same debt under another spelling ---------- */
test('debt names: abbreviations (Rev, CC, Veh) and bank names are set aside; equal balance or instalment matches whatever the names say; the quote\'s name wins', () => {
  assert.ok(calc.sameDebtName('FNB Rev Credit', 'Revolving credit')); assert.ok(calc.sameDebtName('CC', 'Credit card')); assert.ok(calc.sameDebtName('ABSA Veh Fin', 'Vehicle finance'));
  assert.ok(!calc.sameDebtName('Home loan', 'Vehicle finance')); assert.ok(!calc.sameDebtName('Credit card', 'Revolving credit'));
  const ff = [{ desc: 'Revolving credit', type: 'Revolving credit', prov: 'Test Bank B', bal: 72000, inst: 1873 }];
  const named = [{ id: 'a', type: 'debt', debt: 'FNB Rev Credit', life: { lump: 72000, monthly: 1873 } }];
  assert.strictEqual(calc.matchDebts(named, ff).pairs.length, 1, 'by the spelling');
  const other = [{ id: 'b', type: 'debt', debt: 'Something else entirely', life: { lump: 72000, monthly: 1873 } }];
  assert.strictEqual(calc.matchDebts(other, ff).pairs.length, 1, 'by the amounts (the same balance and instalment)'); assert.strictEqual(calc.matchDebts(other, ff).missing.length, 0);
  const byInst = [{ id: 'c', type: 'debt', debt: 'Odd name', life: { lump: 50000, monthly: 1873 } }]; assert.strictEqual(calc.matchDebts(byInst, ff).pairs.length, 1, 'by the one line with this instalment');
  const none = [{ id: 'd', type: 'debt', debt: 'Odd name', life: { lump: 50000, monthly: 999 } }]; assert.strictEqual(calc.matchDebts(none, ff).pairs.length, 0); assert.strictEqual(calc.matchDebts(none, ff).missing.length, 1);
  const s = withFF({}, [['Revolving credit', 'Test Bank B', 'R 1 873.00', 'R 72 000.00']]), q = quote(s, 'fna', '100000081', [{ type: 'debt', debt: 'FNB Rev Credit', life: { lump: 72000, monthly: 1873 }, lsd: { lump: 72000, monthly: 1873 }, abi: 0 }]);
  check.autoMatch(s, q); assert.strictEqual(q.lines[0].st, 'confirmed'); assert.strictEqual(q.lines[0].debt, 'FNB Rev Credit', 'the quote\'s own name stays');
  assert.ok(!check.run(s).problems.some(p => p.id === 'quote.debts' && /only in the quote|not in the Fact Find/i.test(p.message)), 'no false "only in the quote"');
});

/* ---------- 9: the folder tells what a file is ---------- */
test('a file whose name does not say what it is is classified by the folder it sits in (6. Policy Schedules, the Astute folder) and by an insurer\'s product name; e-mails are their own kind; the name still wins', () => {
  assert.strictEqual(docs.classify('Lifestyle Protector 12.10.26.pdf', '6. Policy Schedules').block, 'policies');
  assert.strictEqual(docs.classify('Liberty Lifestyle Protector.pdf').block, 'policies', 'an insurer and a product word');
  assert.strictEqual(docs.classify('Report 20.11.26.pdf', '5. Astute \\ 2026').block, 'astute');
  assert.strictEqual(docs.classify('Statement.pdf', '6. Policy Schedules').block, 'investments', 'the name wins over the folder');
  assert.strictEqual(docs.classify('Misc.pdf', '3. Quotes'), null, 'a quotes folder says nothing about the kind');
  assert.strictEqual(docs.classify('Re BrightRock quotes.eml').block, 'bremail'); assert.strictEqual(docs.classify('BrightRock email.txt').block, 'bremail'); assert.strictEqual(docs.classify('readme.txt'), null, 'a plain text file with no hint is not taken for an e-mail'); assert.strictEqual(docs.classify('BR email 100000081.msg').number, '100000081');
  assert.strictEqual(docs.classify('BR FNA - 100000081.pdf').block, 'fna'); assert.strictEqual(docs.classify('BR CMPO - 100000081.pdf').block, 'cmp');
  const ui = app('js/ov-ui.js'), fo = app('js/folders.js');
  assert.ok(/D\.classify\(f\.name, \(f\.rel \|\| \[\]\)\.join\(' \\\\ '\)\)/.test(ui), 'the pick list ticks by the name or the folder'); assert.ok(/o\.dirs && o\.dirs\[String\(file\.name\)\.toLowerCase\(\)\]/.test(ui), 'and the load reads it the same way');
  assert.ok(/isMail = function/.test(fo) && /isDoc = function \(n\) \{ return \/\\\.\(pdf\|png\|jpe\?g\)\$\/i\.test\(n\) \|\| isMail\(n\)/.test(fo) && /e-\?mail\|correspondence/.test(fo), 'the client\'s folder lists e-mails (its own folder, the quotes folder, an e-mail folder)');
});

/* ---------- 5: the Astute report date ---------- */
test('the Astute report date goes into Client details: from the report, else from its file name, even when no investment matches; a later date replaces an earlier one', () => {
  const s = store.blank();
  assert.strictEqual(docs.setAstuteDate(s, { reportDate: '20/11/2026' }, '19/11/2026'), '20/11/2026'); assert.strictEqual(s.header.astuteDate, '20/11/2026');
  const s2 = store.blank(); assert.strictEqual(docs.setAstuteDate(s2, null, docs.classify('Astute - 20.11.26.pdf').date), '20/11/2026', 'from the file name'); assert.strictEqual(s2.header.astuteDate, '20/11/2026');
  assert.strictEqual(docs.setAstuteDate(s2, { reportDate: '01/10/2026' }, null), null, 'an earlier one does not replace it'); assert.strictEqual(s2.header.astuteDate, '20/11/2026');
  assert.strictEqual(docs.setAstuteDate(s2, { reportDate: '05/12/2026' }, null), '05/12/2026');
  assert.strictEqual(docs.isEmptyRead('astute', { investments: [], reportDate: '20/11/2026' }), false, 'a report with only its date is not "no figures"');
  assert.strictEqual(docs.isEmptyRead('astute', { investments: [] }), true);
  assert.ok(/astuteSet = block === 'astute' \? D\.setAstuteDate\(state, data, cls\.date\)/.test(app('js/ov-ui.js')), 'done for every Astute document, read or only recorded');
});

/* ---------- 8: block 11 ---------- */
const OTHER = { ma: v('Medical aid'), ma_broker: v('Other broker'), n_ma: v('Premium paid by the employer.'), gap: v('Yes'), gap_prov: v('Test Gap Co.'), gap_broker: v('Other broker'), n_gap: v('Quote requested.') };
test('block 11: a box that is still empty gets the Fact Find\'s answer whatever the item\'s status (carried over by New review year, to check, confirmed); what is written there is never replaced', () => {
  const old = withFF(); old.blocks.other.items.forEach(i => { i.st = 'ff'; });                                   // last year's overview: items with nothing in them (made before notes were filled)
  const s = store.startReview(old, '24/11/2026').state;
  assert.ok(s.blocks.other.items.every(i => i.st === 'verify' || i.st === 'empty'), 'carried over "to check"');
  store.fillFromFactFind(s, JSON.stringify(FFJ(OTHER)), 'ff2.json');
  const it = k => s.blocks.other.items.filter(i => i.key === k)[0];
  assert.match(it('medical').note, /^Medical aid; broker Other broker; Premium paid by the employer\. \(Fact Find 10\/11\)$/, 'medical aid: the answers and the note, with their source');
  assert.match(it('gap').note, /^Gap cover: Yes; broker Other broker; Quote requested\. \(Fact Find 10\/11\)$/); assert.strictEqual(it('gap').company, 'Test Gap Co.');
  const s2 = store.startReview(old, '24/11/2026').state; s2.blocks.other.items.filter(i => i.key === 'medical')[0].note = 'Typed last year: R1 800 a month'; s2.blocks.other.items.filter(i => i.key === 'medical')[0].src = { kind: 'previous', file: 'old', date: '' };
  store.fillFromFactFind(s2, JSON.stringify(FFJ(OTHER)), 'ff2.json');
  const n2 = s2.blocks.other.items.filter(i => i.key === 'medical')[0].note; assert.ok(/\(Fact Find 10\/11\) · Typed last year: R1 800 a month$/.test(n2), 'last year\'s note stays, this year\'s Fact Find part in front: ' + n2);
  store.fillFromFactFind(s2, JSON.stringify(FFJ(OTHER)), 'ff2.json'); assert.strictEqual(s2.blocks.other.items.filter(i => i.key === 'medical')[0].note, n2, 'not added twice');
  const s3 = withFF(); const m3 = s3.blocks.other.items.filter(i => i.key === 'medical')[0]; m3.st = 'confirmed'; m3.by = 'person'; m3.note = ''; m3.company = 'Typed Scheme';
  store.fillFromFactFind(s3, JSON.stringify(FFJ(Object.assign({}, OTHER, { ma_prov: v('Other Scheme') }))), 'ff3.json');
  assert.strictEqual(m3.company, 'Typed Scheme', 'typed: kept'); assert.ok(/\(Fact Find 10\/11\)$/.test(m3.note), 'the empty note is filled'); assert.strictEqual(m3.st, 'ff', 'a confirmed item that was empty waits for a click again');
});

/* ---------- 1: the ACI as short points ---------- */
test('the ACI is 1 to 3 short points: the reading\'s points, else cut from the wording (3 at most, 56 characters each); one clause stays whole; every screen uses them', () => {
  assert.deepStrictEqual(calc.aciPoints({ aciText: 'x'.repeat(200), aciPoints: ['Reviewed yearly after year 1', 'Extra cover priced pro rata', 'c', 'd'] }), ['Reviewed yearly after year 1', 'Extra cover priced pro rata', 'c']);
  assert.deepStrictEqual(calc.aciPoints({ aciText: '7.5% + age rater' }), ['7.5% + age rater']); assert.deepStrictEqual(calc.aciPoints({ aci: 10 }), ['10% fixed']); assert.deepStrictEqual(calc.aciPoints({}), []);
  const long = 'The premium is reviewed every year on the policy anniversary. Cover for children is priced pro rata from the second year; waiver of premium is not indexed. Further wording follows here and continues.';
  const pts = calc.aciPoints({ aciText: long }); assert.ok(pts.length >= 2 && pts.length <= 3 && pts.every(p => p.length <= 56), JSON.stringify(pts));
  assert.deepStrictEqual(calc.aciPoints({ aciText: 'EACH YEAR WITH AGE AND BENEFIT INCREASES on policy anniversary' }), ['EACH YEAR WITH AGE AND BENEFIT INCREASES on policy anniversary'], 'one clause of a normal length stays whole');
  const ui = app('js/ov-ui.js'), pr = app('js/ov-present.js'), pdf = app('js/ov-pdf.js'), css = app('css/present.css');
  assert.ok(/function aciHTML\(x\)/.test(ui) && /<ul class="aciu" title="/.test(ui), 'the entry screen: points, the whole wording on hover'); assert.ok(/ACI in short points/.test(ui) && /taLines\(p \+ '\.aciPoints'\)/.test(ui), 'a box for the points in the policy and quote cards');
  assert.ok(/class="a aci pts"/.test(pr) && /calc\.aciPoints\(x\)/.test(pr) && /\.pres \.ptbl \.a\.aci\.pts/.test(css), 'the Presentation'); assert.ok(/calc\.aciPoints\(x\)/.test(pdf) && /'- ' \+ t/.test(pdf), 'the PDF');
  const s = withFF(), item = s.blocks.policies.items[0]; docs.applyPolicy(s, item, { insurer: 'Liberty', aciText: long, aciPoints: ['Reviewed yearly after year 1', 'Extra cover priced pro rata'] }, 'sched.pdf');
  assert.deepStrictEqual(item.aciPoints, ['Reviewed yearly after year 1', 'Extra cover priced pro rata']); assert.strictEqual(item.aciText, long, 'the whole wording is kept');
  assert.deepStrictEqual(store.parseCell('one\ntwo\n\nthree\nfour', 'lines'), ['one', 'two', 'three']); assert.strictEqual(store.parseCell('  ', 'lines'), null);
  assert.match(docs.promptFor('policies'), /"aciPoints" is the yearly premium increase in ONE to THREE very short points/); assert.match(docs.promptFor('fna'), /lsd\.monthly too/);
});

/* ---------- 3: the BrightRock e-mail ---------- */
test('the BrightRock e-mail: text is made readable (quoted-printable, base64, HTML, .msg strings); the death-related income portion goes into the quote the e-mail names, only where the quote printed none, and says where it came from', () => {
  const eml = 'From: BrightRock <x@y.z>\r\nSubject: Your quotes\r\nDate: Thu, 19 Nov 2026 10:00:00 +0200\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="B1"\r\n\r\n--B1\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCP 100000081: death-related income portion R4=2C500 p.m.=\r\n and more\r\n--B1\r\nContent-Type: text/html\r\n\r\n<p>Hello</p>\r\n--B1--\r\n';
  const t = docs.emailText(eml); assert.match(t, /^Subject: Your quotes\nFrom: BrightRock/); assert.match(t, /income portion R4,500 p\.m\. and more/); assert.match(t, /Hello/);
  assert.match(docs.emailText('Content-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\nSubject: s\r\n\r\n' + Buffer.from('CP 100000082 income R5 000').toString('base64')), /CP 100000082 income R5 000/);
  assert.match(docs.emailText('<html><body><p>Death related <b>R3 000</b></p><br>next</body></html>'), /Death related R3 000/); assert.strictEqual(docs.emailText('plain text only'), 'plain text only');
  const u16 = Buffer.from('CP 100000081 death-related income portion R4 500', 'utf16le'), bin = Buffer.concat([Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0]), u16, Buffer.from([0, 0, 0]), Buffer.from('plain ascii run that is long enough')]);
  const mt = docs.msgText(new Uint8Array(bin)); assert.match(mt, /CP 100000081 death-related income portion R4 500/); assert.match(mt, /plain ascii run that is long enough/);
  const s = withFF(), fna = quote(s, 'fna', '100000081', [{ type: 'death', life: { lump: 300000 }, abi: 3 }]), sf = quote(s, 'shortfallQuote', '100000082', [{ type: 'death', life: { lump: 200000 }, abi: 3 }]), other = quote(s, 'reduced', '100000083', [{ type: 'death', life: { lump: 100000, monthly: 2000 }, abi: 3 }]);
  assert.strictEqual(fna.lines[0].life.monthly, 'Not found');
  const a = docs.applyBrEmail(s, { quotes: [{ number: 'CP 100000081', deathIncomePortion: 4500 }, { number: '100000082', deathIncomePortion: 'R 2 250' }, { number: '100000083', deathIncomePortion: 9999 }, { number: '100000099', deathIncomePortion: 1 }, { number: '100000081', deathIncomePortion: null }] }, 'mail.eml', { date: '19/11/2026' });
  assert.strictEqual(fna.lines[0].life.monthly, 4500); assert.strictEqual(fna.lines[0].via['life.monthly'], 'from the BrightRock email 19/11'); assert.strictEqual(sf.lines[0].life.monthly, 2250);
  assert.strictEqual(other.lines[0].life.monthly, 2000, 'the quote printed it: kept'); assert.deepStrictEqual(a.unmatched, ['100000099']); assert.strictEqual(a.nofigure, 1); assert.strictEqual(a.filled.length, 2);
  check.autoMatch(s, fna); assert.strictEqual(fna.lines[0].st, 'confirmed', 'with the figure there the line is ticked');
  const s2 = withFF(), q2 = quote(s2, 'fna', '100000081', [{ type: 'death', life: { lump: 300000 }, abi: 3 }]); const b = docs.applyBrEmail(s2, { quotes: [{ number: null, deathIncomePortion: 3100 }] }, 'pasted', { quote: q2 });
  assert.strictEqual(q2.lines[0].life.monthly, 3100, 'an unnumbered figure goes to the quote the e-mail was pasted into'); assert.strictEqual(b.filled.length, 1);
  assert.strictEqual(docs.isEmptyRead('bremail', { quotes: [{ number: '1', deathIncomePortion: null }] }), true); assert.strictEqual(docs.isEmptyRead('bremail', { quotes: [{ number: '1', deathIncomePortion: 5 }] }), false);
  assert.match(docs.promptFor('bremail'), /deathIncomePortion/); assert.match(docs.promptFor('bremail'), /never work anything out/);
  const ui = app('js/ov-ui.js');
  assert.ok(/function intakeEmail\(file, o, cls\)/.test(ui) && /if \(block === 'bremail'\) return intakeEmail\(file, o, cls\)/.test(ui), 'a BrightRock e-mail found in the folder');
  assert.ok(/does not mention|nums\.some\(function \(n\) \{ return new RegExp/.test(ui), 'a text e-mail that names no CP number of a loaded quote is left alone, and sent nowhere');
  assert.ok(/chain\(files\.filter\(isEmail\)/.test(ui), 'read after the quotes and the guides'); assert.ok(/data-bre-read/.test(ui) && /Paste BrightRock email/.test(ui) && /function readPastedEmail\(qid\)/.test(ui), 'the Paste BrightRock email box on a quote');
  assert.ok(/textLabel: 'THE E-MAIL'/.test(ui), 'only the e-mail\'s text is sent');
});

/* ---------- 4: the Checks card is folded ---------- */
test('the Checks card is folded: one closed details with a count; closed again after a load, a fill and a check', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/'<details class="chkall"' \+ \(checksOpen \? ' open' : ''\)/.test(ui), 'the whole card is a details, open only when it was opened'); assert.ok(/class="allchecks loadlog"><summary>/.test(ui) && !/loadlog" open/.test(ui), 'what the last load said is closed');
  assert.ok(/checksOpen = false; checksInner = false;/.test(ui), 'reset by a load, a fill and Check all blocks'); assert.strictEqual((ui.match(/checksOpen = false; checksInner = false;/g) || []).length, 3);
  assert.ok(/to look at'/.test(ui) && /'All checked'/.test(ui) && /'Nothing read yet'/.test(ui), 'the summary says how many things to look at');
});

/* ---------- the contract ---------- */
test('the contract: revision l, the page version 0.93, the layout still 0.1; new keys are only aciPoints (policy, quote) and via (line)', () => {
  assert.strictEqual(schema.pageVersion, '0.93'); assert.strictEqual(schema.version, '0.1');
  assert.ok(/Revision l/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8')), 'written in the contract');
  const s = withFF(), q = quote(s, 'fna', '100000081', [HOME(null)]); check.settleAll(s); const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.blocks.fna.quotes[0].lines[0].via['life.monthly'], 'from the Fact Find', 'via survives a save and an open');
  docs.logDoc(s, 'mail.eml', 'bremail', 'read'); assert.strictEqual(s.documents[s.documents.length - 1].block, 'bremail');
});
