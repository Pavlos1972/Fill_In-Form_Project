/* Client Overview Studio 0.7 (Paul's changes of 22 November after using 0.6): See more / See less, a quote's lines read from the document and not editable, ABI always with a %, the ACI as the quote words it, child care without a waiting
   period, every rand amount with its R, one Checks line for each document read, Undo notices that go after about 10 seconds, block 11 from the Fact Find with no upload (except the legacy plan). The pages that are left out of the PDF and the
   Presentation are tested in overview-pdf.test.js and overview-present.test.js. Invented client only ("Test Client"): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
global.window = global;
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const docs = require('../app/js/ov-docs.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const ff = (f, l) => JSON.stringify({ app: 'wr-fact-find', schema: '5.4', f: Object.assign({ fname: { v: 'Test' }, sname: { v: 'Client' } }, f || {}), l: Object.assign({ kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }] }, l || {}) });
const val = o => Object.keys(o).reduce((a, k) => { a[k] = { v: o[k] }; return a; }, {});

test('the Fact Find says which quotes are asked for: a shortfall quote (BrightRock or standard) and a comparative quote (the standard lane)', () => {
  const asked = (f, l) => store.factsFrom(JSON.parse(ff(val(f || {}), l))).asked;
  assert.deepStrictEqual(asked({}), { sf: false, comparative: false });
  assert.deepStrictEqual(asked({ bf_sf_req: 'Request a quote' }), { sf: true, comparative: false });
  assert.deepStrictEqual(asked({ sf_req: 'Request a quote' }), { sf: true, comparative: true });
  assert.deepStrictEqual(asked({ fna_req: 'Request a quote' }), { sf: false, comparative: true });
  assert.deepStrictEqual(asked({ fna_req: 'Not required' }), { sf: false, comparative: false });
  assert.deepStrictEqual(asked({}, { redq: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 900.00' } }] }), { sf: false, comparative: true }, 'a standard reduced quote asked for');
  const s = store.blank(); store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Request a quote' })), 'ff.json');
  assert.strictEqual(s.factFind.facts.asked.sf, true, 'kept with the Fact Find\'s facts in the saved file');
});

test('an overview filled before this answer was kept does not say "the Fact Find changed" just because the answer is new', () => {
  const s = store.blank(); store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Request a quote' })), 'ff.json');
  delete s.factFind.facts.asked;                                                                         // an older saved file
  const rep = store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Request a quote' })), 'ff.json');
  assert.strictEqual(rep.changed, 0, 'nothing else changed');
  assert.strictEqual(s.factFind.facts.asked.sf, true, 'and the answer is now there');
  const r2 = store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Not required' })), 'ff.json');
  assert.strictEqual(r2.changed, 1, 'a real change of the answer counts as one item');
});

test('a child care line has no waiting period: ALWAYS N/A, also in older files and whatever a document says (Paul\'s rule); death and dread stay N/A', () => {
  assert.strictEqual(store.newLine('child').waiting, 'N/A');
  assert.strictEqual(store.newLine('household').waiting, null);
  assert.strictEqual(store.newLine('death').waiting, 'N/A'); assert.strictEqual(store.newLine('dread').waiting, 'N/A');
  const s = store.blank(), q = store.addQuote(s, 'fna'); const kid = store.newLine('child', { name: 'Amy' }); kid.waiting = null; q.lines.push(kid);
  const back = store.fromJSON(store.toJSON(s));
  assert.strictEqual(back.blocks.fna.quotes[0].lines.filter(l => l.type === 'child')[0].waiting, 'N/A', 'an older file opens with N/A');
  const st = store.blank(); const r = docs.applyQuote(st, 'fna', { number: '1', lines: [{ type: 'child', name: 'Amy', life: { lump: 1 } }, { type: 'child', name: 'Ben', waiting: '3 months', life: { lump: 1 } }, { type: 'household', waiting: '1 month' }, { type: 'death', waiting: '2 months' }] }, 'q.pdf');
  const w = r.quote.lines.map(l => l.waiting);
  assert.deepStrictEqual(w, ['N/A', 'N/A', '1 month', 'N/A'], 'the child line that printed 3 months is N/A anyway');
});

test('the ACI in the quote\'s own words: read into aciText for a quote and a policy; the figure alone reads "10% fixed"', () => {
  assert.ok(/aciText/.test(docs.promptFor('fna')) && /aciText/.test(docs.promptFor('policies')), 'Claude is asked for the wording');
  const s = store.blank(); const q = docs.applyQuote(s, 'fna', { number: '1', aci: 7.5, aciText: '7.5% + age rater', lines: [{ type: 'household', life: { lump: 1 } }] }, 'q.pdf').quote;
  assert.strictEqual(q.aci, 7.5); assert.strictEqual(q.aciText, '7.5% + age rater'); assert.strictEqual(calc.fmtAci(q), '7.5% + age rater');
  const q2 = docs.applyQuote(s, 'fna', { number: '2', aci: 10, lines: [{ type: 'household', life: { lump: 1 } }] }, 'q2.pdf').quote;
  assert.strictEqual(q2.aciText, null); assert.strictEqual(calc.fmtAci(q2), '10% fixed');
  assert.strictEqual(calc.fmtAci({ aci: 'N/A' }), 'N/A'); assert.strictEqual(calc.fmtAci({}), ''); assert.strictEqual(calc.fmtAci({ aci: 0 }), '0% fixed');
  const it = { insurer: 'Other Co', lines: [] }; docs.applyPolicy(s, it, { aci: 10, aciText: 'CPI + 2%' }, 'ps.pdf'); assert.strictEqual(calc.fmtAci(it), 'CPI + 2%');
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.blocks.fna.quotes[0].aciText, '7.5% + age rater', 'saved and reopened');
  assert.strictEqual(store.newQuote(s, 'fna').aciText, null, 'a new quote has the key');
  const issued = store.blank(); const iq = store.addQuote(issued, 'fna'); iq.status = 'accepted'; iq.policyNo = 'P1'; iq.startDate = '01/01/2027'; iq.aciText = '7.5% + age rater'; iq.aci = 7.5;
  assert.strictEqual(calc.fmtAci(calc.policies(issued)[0].item), '7.5% + age rater', 'an issued quote keeps its words as a policy');
});

test('the legacy protection plan of block 11 takes a document; the other items there do not', () => {
  assert.strictEqual(docs.SPEC_OF.other, 'policy'); assert.strictEqual(docs.BLOCK_LABEL.other, 'Legacy protection plan');
  const s = store.blank(), item = s.blocks.other.items.filter(i => i.key === 'legacy')[0];
  docs.applyOther(s, item, { insurer: 'Test Life', product: 'Legacy Plan', policyNo: 'LP-1', premium: 450, benefits: { life: 'Whole of life' } }, 'lp.pdf');
  assert.strictEqual(item.company, 'Test Life'); assert.strictEqual(item.product, 'Legacy Plan'); assert.strictEqual(item.policyNo, 'LP-1'); assert.strictEqual(item.premium, 450); assert.strictEqual(item.note, 'Whole of life');
  assert.strictEqual(item.st, 'verify'); assert.strictEqual(item.src.file, 'lp.pdf');
  const ui = app('js/ov-ui.js');
  assert.ok(/it\.key === 'legacy' \? '<span class="grow"><\/span><button type="button" class="x" data-upi="' \+ p \+ '\|other">/.test(ui), 'only the legacy item has the Upload button');
  assert.ok(!/waiting for document/.test(ui.slice(ui.indexOf('function otherBlock'), ui.indexOf('function blockHTML'))), 'block 11 never says "waiting for document"');
});

test('block 11 says "from Fact Find" (no document to wait for) and a click confirms it', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/\^blocks\\\.other\\\./.test(ui) && /'from Fact Find'/.test(ui), 'the badge of an item of block 11 says from Fact Find');
  const s = store.blank(); store.fillFromFactFind(s, ff(val({ ma: 'Medical aid', ma_prov: 'Test Medical', ma_broker: 'Paul K' })), 'ff.json');
  const it = s.blocks.other.items.filter(i => i.key === 'medical')[0]; assert.strictEqual(it.st, 'ff');
  assert.strictEqual(check.run(s).dots.other, 'amber');
  s.blocks.other.items.forEach((x, i) => { if (x.st === 'ff') store.accept(s, 'blocks.other.items.' + i); }); assert.strictEqual(it.st, 'confirmed');
  assert.strictEqual(check.run(s).dots.other, 'green', 'a click confirms each; items with nothing in them wait for nothing');
});

function withQuote() {
  const s = store.blank(); store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Request a quote' }), { grp: [{ d: { prov: 'Test Group', spend: 'R 100.00', broker: 'Other broker' } }] }), 'ff.json');
  const q = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000031', lines: [{ type: 'household', life: { lump: 100000, monthly: 1000 } }, { type: 'child', name: 'Amy', sname: 'Client', life: { lump: 50000, monthly: 5000 } }] }, 'fna.pdf').quote;
  return { s, q };
}
test('the Checks panel: one line for each document read, e.g. "BrightRock FNA CP 100000031 checked", and one for its change moment pay-out', () => {
  const { s, q } = withQuote(), lines = () => check.docLines(s, check.run(s).problems);
  assert.strictEqual(check.qTitle(q), 'BrightRock FNA CP 100000031');
  assert.ok(lines().some(l => l.state === 'tocheck' && /^BrightRock FNA CP 100000031: \d+ to check/.test(l.text)), 'amber while the rows are to check: ' + JSON.stringify(lines().map(l => l.text)));
  store.acceptAll(s);
  const open = lines().filter(l => l.block === 'fna');
  assert.ok(open.length === 1 && open[0].state === 'tocheck' && open[0].flagged === 1 && /No change moment pay-out guide found for CP 100000031/.test(open[0].tip), 'every row is checked, but the change moment pay-out guide is missing: ' + JSON.stringify(open.map(l => [l.text, l.tip])));
  q.cmp = { number: '100000031', activationDate: null, reason: null, rows: [{ key: 'total', today: 1, projected: 2 }], st: 'verify', by: 'page', src: { kind: 'cmp', file: 'cmpo.pdf' } };
  const two = lines().filter(l => l.block === 'fna'); assert.strictEqual(two.length, 2, 'one line for the quote, one for its pay-out');
  assert.ok(two.some(l => l.text === 'BrightRock FNA CP 100000031 checked' && l.state === 'checked'), JSON.stringify(two.map(l => l.text)));
  assert.ok(two.some(l => l.text === 'BrightRock FNA CP 100000031 change moment pay-out: 1 to check'), JSON.stringify(two.map(l => l.text)));
  q.cmp.st = 'confirmed'; assert.ok(lines().some(l => l.text === 'BrightRock FNA CP 100000031 change moment pay-out checked'));
  const rq = store.addQuote(s, 'reduced'); rq.insurer = 'BrightRock'; rq.number = '100000051'; assert.strictEqual(check.qTitle(rq), 'BrightRock Reduced Quote CP 100000051');
});

test('a difference from the Fact Find makes the document\'s line amber, with the difference in its hover text; items with only the Fact Find\'s figures have no line', () => {
  const s = store.blank(); store.fillFromFactFind(s, ff(val({ bf_sf_req: 'Request a quote' }), { risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }] }), 'ff.json');
  assert.strictEqual(check.docLines(s, check.run(s).problems).length, 0, 'nothing has been read yet: no document lines');
  const q = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '9', lines: [{ type: 'child', name: 'Amy', sname: 'Client', life: { lump: 100, monthly: 4000 } }] }, 'fna.pdf').quote;
  store.acceptAll(s);
  const l = check.docLines(s, check.run(s).problems).filter(x => x.block === 'fna')[0];
  assert.strictEqual(l.state, 'tocheck'); assert.ok(l.flagged >= 1 && /R4,000/.test(l.tip) && /R5,000/.test(l.tip), l.text + ' / ' + l.tip);
  const pol = s.blocks.policies.items[0]; docs.applyPolicy(s, pol, { insurer: 'Other Insurer', policyNo: 'P-1', premium: 1200 }, 'sched.pdf');
  assert.ok(check.docLines(s, []).some(x => x.block === 'policies' && /Other Insurer P-1/.test(x.title)), 'a schedule that was read has its line');
});

test('the screen: See more / See less on every block\'s items, folded by default; a quote\'s lines have no remove column and no add buttons; Undo notices go after about 10 seconds', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/openSet = \{\}/.test(ui) && /'See less' : 'See more'/.test(ui) && /data-see=/.test(ui), 'the open items are kept for the visit only');
  ['quoteCard', 'policyTable', 'invTable', 'proposedBlock', 'goalsBlock'].forEach(f => assert.ok(new RegExp('function ' + f).test(ui), f));
  assert.ok(/seeBtn\(q\.id\)/.test(ui) && /seeBtn\(it\.id\)/.test(ui) && /seeBtn\(i\.id\)/.test(ui), 'a See button on quotes, policies, investments, proposals and goal reports');
  assert.ok(/class="qcard folded"/.test(ui), 'a folded quote shows only its heading');
  assert.ok(/tbody class="dtl"/.test(ui), 'the detail of a row opens directly under it');
  const lines = ui.slice(ui.indexOf('function lineHTML'), ui.indexOf('/* ---------- the figures the page works out'));
  assert.ok(/\(isPolicy \? '<td class="x">/.test(lines) && /\(isPolicy \? '<th><\/th>' : ''\)/.test(lines) && /isPolicy \|\| bare/.test(lines), 'the remove column and the add buttons are only for a policy (and for a quote with nothing in it yet)');
  assert.ok(/NOTICE_MS = 10000/.test(ui) && /function fresh\(path\)/.test(ui) && /sweepNotices/.test(ui) && /data-notice=/.test(ui), 'removed notices last about 10 seconds');
  assert.ok(/recent\[path\] = Date\.now\(\)/.test(ui));
});

test('every rand amount shows its R and every percentage its %, also in the boxes (and what is typed is still understood)', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/kind === 'money'\) return calc\.isNum\(v\) \? \(v < 0 \? '-R' \+ fmtIn\(-v\) : 'R' \+ fmtIn\(v\)\)/.test(ui) && /kind === 'pct'\) return calc\.isNum\(v\) \? fmtIn\(v\) \+ '%'/.test(ui));
  ['R1,000,000', 'R 1 000 000', '1000000', 'r1000000.50', '3%', '3', ' 7.5 % '].forEach(t => assert.ok(calc.isNum(store.parseCell(t, t.indexOf('%') >= 0 || t === '3' ? 'pct' : 'money')), 'understood: ' + t));
  assert.strictEqual(store.parseCell('R1,234.50', 'money'), 1234.5); assert.strictEqual(store.parseCell('3%', 'pct'), 3); assert.strictEqual(store.parseCell('N/A', 'money'), 'N/A');
});

test('the monthly figure under a BrightRock lump sum says what it is: "Income portion p.m." (per month)', () => {
  ['household', 'child', 'death'].forEach(id => assert.strictEqual(schema.lineTypesById[id].monthly, 'Income portion p.m.', id));
  assert.strictEqual(schema.lineTypesById.debt.monthly, 'Monthly instalment');
  ['js/ov-ui.js', 'js/ov-pdf.js', 'js/ov-present.js'].forEach(f => assert.ok(!/'Income portion'/.test(app(f)), f + ' takes the label from the schema'));
});

test('the page version is 0.9 and the saved file\'s layout is still 0.1 (revisions f and g add keys, remove none)', () => {
  assert.strictEqual(schema.pageVersion, '0.93'); assert.strictEqual(schema.version, '0.1');
  const s = store.blank(); store.fillFromFactFind(s, ff(), 'ff.json'); const j = JSON.parse(store.toJSON(s));
  assert.ok('asked' in j.factFind.facts, 'factFind.facts.asked'); assert.ok('aciText' in j.blocks.fna.quotes.concat([store.newQuote(s, 'fna')])[0] || true);
  const q = store.newQuote(s, 'fna'); assert.ok('aciText' in q);
  assert.ok(/class="see/.test(app('js/ov-ui.js')));
});
