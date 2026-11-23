/* Client Overview Studio 0.8 (Paul's third batch, after using 0.7): what reading a quote now does (an ABI on every line, severe illness N/A except where the quote has an amount, child care waiting always N/A, the debts
   named and banked from the Fact Find, the ACI words the same on every line), the automatic match (a line where the Fact Find and the quote agree is checked by the page and shows a tick; the reasons for the others),
   the schedule of one of two policies of the same insurer going to the right one, and the page's own parts (Settings, one load button, the More menu, Back / Next, the bar under a block's name, no Documents panel, no block numbers).
   Invented client only ("Test Client"): no real client data is ever used here. */
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

const FFJ = () => JSON.stringify({ app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Cars Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } }, { d: { type: 'Personal loan', prov: '', desc: 'Furniture', inst: 'R 900.00', bal: 'R 30 000.00', term: '36' } }],
    risk: [{ d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }, { d: { prov: 'Liberty', spend: 'R 700.00', broker: 'Other broker' } }] } });
const filled = () => { const s = store.blank(); store.fillFromFactFind(s, FFJ(), 'ff.json'); return s; };
const read = (s, lines, extra) => docs.applyQuote(s, 'fna', Object.assign({ insurer: 'BrightRock', number: '100000001', aci: 7.5, aciText: '7.5% + defined age rater', premium: 2900, lines }, extra || {}), 'fna.pdf').quote;
const HOUSE = { type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 };

test('reading a quote: an ABI on EVERY line (the line\'s own, the quote\'s one, or "Not found" when the quote prints none)', () => {
  const q = read(filled(), [HOUSE, { type: 'child', name: 'Amy', sname: 'Client', life: { lump: 1 } }, { type: 'death', life: { lump: 2 } }], { abi: 3 });
  assert.deepStrictEqual(q.lines.map(l => l.abi), [5, 3, 3], 'the line\'s own ABI, else the one the quote prints once');
  const r = read(filled(), [HOUSE, { type: 'death', life: { lump: 2 } }]);
  assert.deepStrictEqual(r.lines.map(l => l.abi), [5, 'Not found'], 'a line whose quote prints no ABI says so (never empty)');
  assert.ok(/"abi"/.test(docs.promptFor('fna')) && /EVERY line/.test(docs.promptFor('fna')) && /"Not found"/.test(docs.promptFor('reduced')), 'Claude is told to give one on every line');
  const p = { insurer: 'X', lines: [] }; docs.applyPolicy(filled(), p, { lines: [{ type: 'other', label: 'Cover', life: { lump: 1 } }] }, 'ps.pdf');
  assert.strictEqual(p.lines[0].abi, null, 'a policy schedule\'s lines are unchanged');
});

test('severe illness is N/A on every line of a quote except where the quote has an amount; child care waiting is always N/A', () => {
  const q = read(filled(), [HOUSE, { type: 'child', name: 'Amy', sname: 'Client', waiting: '3 months', life: { lump: 1 }, sev: { lump: 10 } }, { type: 'dread', sev: { lump: 500000 }, waiting: '1 month' }, { type: 'debt', debt: 'Home loan', life: { lump: 5 }, sev: 'N/A' }]);
  assert.strictEqual(q.lines[0].sev, 'N/A'); assert.deepStrictEqual(q.lines[1].sev, { lump: 10 }, 'an amount the quote gives is kept'); assert.deepStrictEqual(q.lines[2].sev, { lump: 500000 }); assert.strictEqual(q.lines[3].sev, 'N/A');
  assert.strictEqual(q.lines[1].waiting, 'N/A', 'Paul\'s rule beats the document'); assert.strictEqual(q.lines[0].waiting, null);
  assert.strictEqual(calc.totals(q).sev.lump, 500000 + 10, 'N/A cells are not added');
  const typed = store.fromJSON(store.toJSON(Object.assign(filled(), {}))); const k = store.newLine('child'); assert.strictEqual(k.waiting, 'N/A');
  const ui = app('js/ov-ui.js'); assert.ok(/\(l\.waiting === 'N\/A' \? '<td class="c"><span class="na">N\/A<\/span><\/td>'/.test(ui), 'the screen shows N/A (not a box) for it');
});

test('the Fact Find\'s debts and children help the reading: the quote\'s debt lines get their names and banks, every debt field is matched', () => {
  const s = filled(), note = docs.factNote(s);
  assert.ok(/Home loan, bank: Test Bank, balance R1200000, instalment R12000 a month/.test(note) && /Car loan, bank: Cars Bank/.test(note) && /Amy Client/.test(note), note);
  assert.ok(/Match each debt line/.test(note) && /do not invent a line/.test(note));
  assert.strictEqual(docs.factNote(store.blank()), '', 'no Fact Find, no note');
  const q = read(s, [HOUSE, { type: 'child', name: 'Amy', life: { lump: 500000, monthly: 5000 } }, { type: 'debt', debt: 'Home loan', life: { lump: 1200000, monthly: 12000 } }, { type: 'debt', debt: '', life: { lump: 190000, monthly: 4000 } }, { type: 'debt', debt: 'Mahindra XUV 700', bank: 'Someone Bank', life: { lump: 300000, monthly: 6000 } }]);
  const debts = q.lines.filter(l => l.type === 'debt');
  assert.strictEqual(debts[0].bank, 'Test Bank', 'the bank the quote did not print comes from the Fact Find');
  assert.strictEqual(debts[1].debt, 'Car loan', 'a debt line with no name is named from the Fact Find row with the same instalment'); assert.strictEqual(debts[1].bank, 'Cars Bank');
  assert.strictEqual(debts[2].debt, 'Mahindra XUV 700'); assert.strictEqual(debts[2].bank, 'Someone Bank', 'what the quote printed is never replaced');
  assert.strictEqual(q.lines.filter(l => l.type === 'child')[0].sname, 'Client', 'a child line without a surname gets it');
});

test('the checks say why, in words for the line: bank missing in both, a debt only in the quote, a debt only in the Fact Find, a child in one and not the other', () => {
  const s = filled(), q = read(s, [HOUSE, { type: 'child', name: 'Amy', sname: 'Client', life: { lump: 1, monthly: 5000 } }, { type: 'child', name: 'Zoe', sname: 'Client', life: { lump: 1, monthly: 100 } },
    { type: 'debt', debt: 'Furniture', life: { lump: 30000, monthly: 900 } }, { type: 'debt', debt: 'Mahindra XUV 700', life: { lump: 300000, monthly: 6000 } }]);
  const probs = check.run(s).problems, by = id => probs.filter(p => p.line === id)[0];
  const furn = q.lines.filter(l => l.debt === 'Furniture')[0], mah = q.lines.filter(l => l.debt === 'Mahindra XUV 700')[0], zoe = q.lines.filter(l => l.name === 'Zoe')[0];
  assert.strictEqual(by(furn.id).short, 'Bank missing in the Fact Find and the quote.', 'the bank is empty in both');
  assert.strictEqual(by(mah.id).short, 'Mahindra XUV 700 is in the quote, not in the Fact Find.');
  assert.strictEqual(by(zoe.id).short, 'Zoe Client is in the quote, not in the Fact Find.');
  assert.ok(probs.some(p => p.message === 'Home loan is in the Fact Find, not in the quote.') && probs.some(p => p.message === 'Car loan is in the Fact Find, not in the quote.'), 'the Fact Find rows with no line in the quote are listed');
  assert.ok(probs.some(p => /^Furniture: bank missing in the Fact Find and the quote\./.test(p.message)), 'and the long list names the debt');
});

test('a line where the Fact Find and the quote agree is checked by the page (green tick, no "to check"); every other line keeps its reason', () => {
  const s = filled(), q = read(s, [HOUSE, { type: 'child', name: 'Amy', sname: 'Client', life: { lump: 1, monthly: 5000 } }, { type: 'debt', debt: 'Home loan', life: { lump: 1200000, monthly: 12000 } },
    { type: 'debt', debt: 'Car loan', life: { lump: 200000, monthly: 3000 } }, { type: 'debt', debt: 'Mahindra XUV 700', life: { lump: 1, monthly: 1 } }]);
  const n = check.autoMatch(s, q), by = (t, d) => q.lines.filter(l => l.type === t && (!d || l.debt === d))[0];
  assert.strictEqual(n, 3, 'the child and the home loan agree with the Fact Find, and the household line is in the quote');
  const kid = by('child'), home = by('debt', 'Home loan');
  assert.ok(kid.st === 'confirmed' && kid.match === 'factfind' && kid.by === 'page' && home.st === 'confirmed' && home.match === 'factfind', 'checked by the page, with the reason: they match');
  assert.strictEqual(by('debt', 'Car loan').st, 'verify', 'the instalment differs: to check'); assert.strictEqual(by('debt', 'Mahindra XUV 700').st, 'verify', 'only in the quote: to check');
  assert.ok(by('household').st === 'confirmed' && by('household').match === 'quote', 'a line the quote gives, with no Fact Find counterpart, is confirmed by the quote (round 2)');
  assert.strictEqual(check.autoMatch(s, q), 0, 'nothing more to tick the second time');
  store.setPath(s, 'blocks.fna.quotes.0.lines.' + q.lines.indexOf(kid) + '.name', 'Amy', 'text');
  assert.ok(kid.st === 'confirmed' && kid.by === 'person' && kid.match === undefined, 'a person\'s typing ends the page\'s automatic check (the tick becomes "checked")');
  const back = store.fromJSON(store.toJSON(s)); assert.strictEqual(back.blocks.fna.quotes[0].lines.filter(l => l.debt === 'Home loan')[0].match, 'factfind', 'the match is saved');
  const ui = app('js/ov-ui.js'); assert.ok(/o\.match === 'factfind'/.test(ui) && /class="tickok"/.test(ui), 'the screen draws the tick'); assert.ok(/data-why=/.test(ui) && /lineWhy\(l\.id\)/.test(ui), 'and the reason on the line');
});

test('two policies of one insurer (two Liberty policies): the schedule goes to its own policy by the policy number, then the premium', () => {
  const s = filled(), items = s.blocks.policies.items, getName = x => x.insurer;
  assert.strictEqual(items.length, 2); assert.deepStrictEqual(items.map(i => i.premium), [500, 700]);
  const m = d => docs.matchItem(items, d, getName);
  assert.strictEqual(m({ insurer: 'Liberty', premium: 700 }), items[1], 'the premium tells them apart');
  assert.strictEqual(m({ insurer: 'Liberty', premium: 500.4 }), items[0]);
  items[1].policyNo = 'L-200'; assert.strictEqual(m({ insurer: 'Liberty', policyNo: 'L-200', premium: 500 }), items[1], 'the policy number comes first');
  assert.ok(m({ insurer: 'Liberty', premium: 999 }).ambiguous, 'a premium that fits neither stays ambiguous (and says which)');
  items[0].premium = 700; items[1].premium = 700; items[1].policyNo = '';
  assert.strictEqual(m({ insurer: 'Liberty', premium: 700 }), items[0], 'the same premium twice: the first one nothing has filled yet');
  docs.applyPolicy(s, items[0], { insurer: 'Liberty', premium: 700 }, 'a.pdf');
  assert.strictEqual(m({ insurer: 'Liberty', premium: 700 }), items[1], 'then the other');
  assert.strictEqual(m({ insurer: 'Sanlam', premium: 700 }), null);
  const ui = app('js/ov-ui.js'); assert.ok(/more than one item could be this one \(/.test(ui), 'the message names the candidates');
});

test('the lines show the SAME ACI words as the quote\'s own (also when the words are on the lines of a file)', () => {
  const q = { aci: 7.5, aciText: '7.5% + defined age rater', lines: [{ id: 'a' }] };
  assert.strictEqual(calc.fmtAci(q), '7.5% + defined age rater');
  const q2 = { aci: 7.5, aciText: null, lines: [{ id: 'a', aciText: '7.5% + defined age rater' }, { id: 'b' }] };
  assert.strictEqual(calc.fmtAci(q2), '7.5% + defined age rater', 'a file whose lines carry the words: the quote shows them too');
  assert.strictEqual(calc.fmtAci({ aci: 7.5, lines: [] }), '7.5% fixed');
  const s = filled(); const r = read(s, [Object.assign({}, HOUSE, { aciText: '10% + age rater' })], { aciText: null });
  assert.strictEqual(r.aciText, '10% + age rater', 'reading: the words a line carries become the quote\'s');
  assert.ok(/data-aci="' \+ \(isPolicy \? '' : c\.id\)/.test(app('js/ov-ui.js')), 'the screen\'s ACI cell of a line is the quote\'s (one function, one place)');
});

test('the page: one load button, a More menu, Settings, no Documents panel, no block numbers, a bar under a block\'s name', () => {
  const html = app('overview.html'), ui = app('js/ov-ui.js');
  assert.ok(/id="btnReadFolder"[^>]*>Load from client folder/.test(html) && !/id="btnUpload"/.test(html), 'one Load from client folder button replaces Upload documents and Read client folder');
  const top = html.slice(html.indexOf('<div class="grp left">'), html.indexOf('<div class="grp right">'));
  ['btnNew', 'btnOpen', 'btnSave', 'btnReadFolder', 'moreMenu'].forEach(id => assert.ok(top.includes('id="' + id + '"'), id + ' is in the top bar'));
  const more = top.slice(top.indexOf('id="moreMenu"'));
  ['btnLoad', 'btnFolders', 'btnReview', 'btnSaveAs', 'btnSettings'].forEach(id => assert.ok(more.includes('id="' + id + '"'), id + ' is in the More menu')); assert.ok(!/id="btnLoad"|id="btnFolders"|id="btnReview"|id="btnSaveAs"/.test(top.slice(0, top.indexOf('id="moreMenu"'))), 'and not on the bar itself');
  assert.ok(!/id="aiSwitch"|id="docs"|<h3>Documents<\/h3>/.test(html), 'the Documents panel is gone');
  assert.ok(/id="setKey"/.test(ui) && /FF\.lookup\.saveSettings\(Object\.assign\(\{\}, s, \{ apiKey: key \}\)\)/.test(ui), 'Settings keeps the key in the Fact Find\'s own settings');
  assert.ok(/function toastLink\(/.test(ui) && /Add the key in Settings/.test(ui), 'reading with no key says so, with a link to Settings');
  assert.ok(!/b\.n \+ ' ' \+ esc\(b\.title\)|b\.n \+ '\. ' \+ b\.title/.test(ui), 'no block numbers on the screen'); assert.ok(!/\(block \d+\)|in block \d/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')), 'nor in the notes');
  assert.ok(/class="prog/.test(ui) && /Downloaded and populated/.test(ui) && /data-prog=/.test(ui), 'the bar under a block\'s name');
  assert.ok(/&lsaquo; Back: /.test(ui) && /Next: ' \+ esc\(pageName\(next\)\)/.test(ui) && /\(last\.dots \|\| \{\}\)\[id\] !== 'na'/.test(ui), 'Back and Next name the pages and skip one that does not apply');
  assert.ok(!/data-upq=|Upload from another folder|type in by hand<\/button> <button/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')), 'one upload button per block');
  assert.ok(/>type in by hand<\/button>/.test(ui) && (ui.match(/class="lnk small" data-add[qp]/g) || []).length === 2, 'and a small "type in by hand" link where there was "+ Add new"');
  assert.ok(/loadFromClientFolder/.test(ui) && /\$\('#docIn'\)\.click\(\)/.test(ui), 'Load falls back to the normal file window by itself');
});

test('quotes are read before their pay-out guides in a bulk load; a guide is looked for by itself for each BrightRock quote; none found and an unmatched guide are said once', () => {
  const ui = app('js/ov-ui.js');
  assert.ok(/chain\(files\.filter\(function \(f\) \{ return !isGuide\(f\) && !isEmail\(f\); \}\)/.test(ui) && /chain\(files\.filter\(isGuide\)/.test(ui) && /chain\(files\.filter\(isEmail\)/.test(ui), 'the guides come after the quotes, the BrightRock e-mails after the guides');
  assert.ok(/function autoGuide\(q, o\)/.test(ui) && /q\.kind === 'comparative' \|\| !\/bright\/i\.test\(q\.insurer/.test(ui) && /No change moment pay-out guide found for CP /.test(ui), 'every BrightRock quote but a comparative one looks for its guide: "No change moment pay-out guide found for CP <n>" when there is none');
  assert.ok(/unmatchedGuides\[num\]/.test(ui) && /matches no quote that is loaded/.test(ui) && /res\.skip = true/.test(ui), 'a guide that matches no quote is listed once');
  assert.ok(/guideIn\(pool, num\)/.test(ui) && /ingest\(fs, \{ pool: res\.files, counted: true, dirs: dirs \}\)/.test(ui), 'the guide is looked for in the files of the client\'s folder that were listed, beside the quote, or in the quotes folder');
  const F = app('js/folders.js'); assert.ok(/quote\|goal\|rgar\|egar\|proposal\|analysis/.test(F), 'the listing of the client\'s folder now includes the quotes, goal and proposals folders (where the guides are)');
});

test('the contract: revision g, the page version 0.92, the layout still 0.1; new keys are only the line\'s match', () => {
  assert.strictEqual(schema.pageVersion, '0.94'); assert.strictEqual(schema.version, '0.1');
  const s = filled(), q = read(s, [{ type: 'child', name: 'Amy', sname: 'Client', life: { lump: 1, monthly: 5000 } }]); check.autoMatch(s, q);
  const j = JSON.parse(store.toJSON(s)); assert.strictEqual(j.blocks.fna.quotes[0].lines[0].match, 'factfind');
  assert.ok(/Revision g/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8')), 'written in the contract');
});
