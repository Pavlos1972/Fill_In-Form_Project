/* The Client Overview's documents (stage 4): sorting a document by its name, reading it with Claude (a stand-in for the Anthropic call; reading is off until the adviser switches it on), and putting what was read into the
   overview as amber rows that carry the file they came from. Nothing read is ever "checked". Invented names and figures only ("Test Client"): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
global.FF = { util };
const store = require('../app/js/ov-store.js');
const D = require('../app/js/ov-docs.js');

const FFJ = () => ({ app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Second Insurer', spend: 'R 800.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_pp: [{ d: { type: 'Pension fund', prov: 'Test Group', val: 'R 300 000.00', contrib: 'R 3 000.00', broker: 'Other broker' } }], ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [] } });
const filled = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'); return s; };

test('a document is sorted into its block by its name, with the number and the date the name carries', () => {
  const c = n => D.classify(n);
  assert.deepStrictEqual([c('BR FNA - 100000001 - R2900.00 - 19.11.26.pdf').block, c('BR FNA - 100000001 - R2900.00 - 19.11.26.pdf').number, c('BR FNA - 100000001 - R2900.00 - 19.11.26.pdf').date], ['fna', '100000001', '19/11/2026']);
  assert.strictEqual(c('BR Shortfall - 100000002 - R2500.00 - 20.11.26.pdf').block, 'shortfallQuote');
  assert.strictEqual(c('BR Reduced Quote - 100000003 - R1400.00 - 04.09.26.pdf').block, 'reduced');
  assert.deepStrictEqual([c('BR CMPO - 100000001.pdf').block, c('BR CMPO - 100000001.pdf').number], ['cmp', '100000001']);
  assert.strictEqual(c('Test Insurer PS - 123456789.pdf').block, 'policies'); assert.strictEqual(c('Test Insurer Policy Schedule.pdf').block, 'policies');
  assert.strictEqual(c('Test Group FundsAtWork Schedule - 28.09.26.pdf').block, 'group', 'a group statement is not a policy schedule');
  assert.strictEqual(c('Group Benefit Statement.pdf').block, 'group'); assert.strictEqual(c('Astute - 20.11.26.pdf').block, 'astute');
  assert.strictEqual(c('Momentum Quote - 55555555.pdf').block, 'comparative'); assert.strictEqual(c('Investment statement Test RA.pdf').block, 'investments');
  assert.strictEqual(c('notes.pdf'), null); assert.strictEqual(c(''), null); assert.strictEqual(c('IMG_0042.jpg'), null);
  assert.strictEqual(c('BR FNA 100000001.PDF').block, 'fna', 'capitals do not matter');
});

/* ---- reading with Claude ---- */
const reply = (obj, status) => async (url, opt) => { reply.last = { url, opt, body: JSON.parse(opt.body) }; return { ok: (status || 200) < 400, status: status || 200, json: async () => (typeof obj === 'function' ? obj() : obj) }; };
const text = t => ({ content: [{ type: 'text', text: t }], usage: { input_tokens: 10, output_tokens: 20 } });

test('the call to Anthropic: the document as base64, the block\'s own instructions, the key in the header; the JSON in the answer is read even when it is fenced', async () => {
  const r = await D.readWithClaude({ apiKey: 'k', model: 'm', base64: 'QUJD', mediaType: 'application/pdf', block: 'fna', fetch: reply(text('Here you go:\n```json\n{"insurer":"BrightRock","number":"100000001","lines":[]}\n```')) });
  assert.deepStrictEqual(r.data, { insurer: 'BrightRock', number: '100000001', lines: [] }); assert.deepStrictEqual(r.usage, { input_tokens: 10, output_tokens: 20 });
  const { url, opt, body } = reply.last;
  assert.strictEqual(url, 'https://api.anthropic.com/v1/messages'); assert.strictEqual(opt.headers['x-api-key'], 'k'); assert.strictEqual(opt.headers['anthropic-version'], '2023-06-01'); assert.strictEqual(opt.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.strictEqual(body.model, 'm'); assert.deepStrictEqual(body.messages[0].content[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } });
  assert.ok(/insurance quote/.test(body.messages[0].content[1].text) && /never a guess/.test(body.messages[0].content[1].text) && /"printedTotals"/.test(body.messages[0].content[1].text), 'the quote instructions');
  await D.readWithClaude({ apiKey: 'k', model: 'm', base64: 'QUJD', mediaType: 'image/png', block: 'group', fetch: reply(text('{"provider":"x"}')) });
  assert.strictEqual(reply.last.body.messages[0].content[0].type, 'image'); assert.ok(/group risk benefit statement/.test(reply.last.body.messages[0].content[1].text));
});

test('every kind of document has its own instructions that say what the page will put where', () => {
  ['fna', 'shortfallQuote', 'reduced', 'comparative'].forEach(b => assert.ok(/"lines"/.test(D.promptFor(b)) && /Each need/.test(D.promptFor(b)), b));
  assert.ok(/policyNo/.test(D.promptFor('policies')) && /benefits/.test(D.promptFor('policies')));
  assert.ok(/endAge/.test(D.promptFor('group')) && /Not found/.test(D.promptFor('group')));
  assert.ok(/valueDate/.test(D.promptFor('investments')) && /Section 14/.test(D.promptFor('investments')));
  assert.ok(/reportDate/.test(D.promptFor('astute')) && /activationDate/.test(D.promptFor('cmp')));
});

test('when reading goes wrong the adviser is told in plain words: no key, a refused key, too many requests, a document too big, an answer that is not figures', async () => {
  const go = (f, o) => D.readWithClaude(Object.assign({ apiKey: 'k', model: 'm', base64: 'x', block: 'fna', fetch: f }, o));
  await assert.rejects(go(reply(text('{}')), { apiKey: '' }), /Add your Anthropic API key/);
  await assert.rejects(go(reply({ error: { message: 'bad' } }, 401)), /key was not accepted/);
  await assert.rejects(go(reply({ error: { message: 'bad' } }, 429)), /Too many requests/);
  await assert.rejects(go(reply({ error: { message: 'request too large' } }, 413)), /too big/);
  await assert.rejects(go(reply(text('I could not read it'))), /could not be read|did not give/);
  await assert.rejects(go(reply(text('{"a": nonsense}'))), /could not be read as figures/);
  await assert.rejects(go(reply({ stop_reason: 'refusal', content: [] })), /could not read this document/);
  await assert.rejects(go(async () => { throw new Error('offline'); }), /Could not reach Anthropic/);
  await assert.rejects(go(reply(text('{}')), { block: 'nonsense' }), /cannot be read here/);
});

/* ---- putting what was read into the overview ---- */
const READ_QUOTE = () => ({ insurer: 'BrightRock', number: '100000001', date: '19/11/2026', rates: 'Non-smoker rates', aci: '10', premium: 2900, disabilityAge: 65,
  lines: [{ type: 'household', life: { lump: '800 000', monthly: 5000 }, lsd: { lump: 900000, monthly: 12500 }, ip: { monthly: 22500 }, abi: 5, waiting: '1 month' },
    { type: 'child', name: 'Amy', sname: 'Client', term: 'Age 24', life: { lump: 500000, monthly: 5000 }, abi: 5, junk: 'x' }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1200000, monthly: 12000 }, ip: { monthly: 12000 } },
    { type: 'death', life: { lump: 600000, monthly: 7500 } }, { type: 'dread', sev: { lump: 500000 } }, { type: 'weird', label: 'Something else' }], printedTotals: { life: { lump: 3100000 }, ip: { monthly: 34500 } } });

test('a quote that was read: a new quote, its lines as numbers, amber, with its file; nothing is "checked"; statuses start at pending', () => {
  const s = filled(), r = D.applyQuote(s, 'fna', READ_QUOTE(), 'BR FNA - 100000001.pdf'), q = r.quote;
  assert.ok(r.read && s.blocks.fna.quotes[0] === q); assert.deepStrictEqual([q.insurer, q.number, q.date, q.rates, q.aci, q.premium, q.disabilityAge, q.status], ['BrightRock', '100000001', '19/11/2026', 'Non-smoker rates', 10, 2900, 65, 'pending']);
  assert.strictEqual(q.lines.length, 6); assert.deepStrictEqual(q.lines.map(l => l.type), ['household', 'child', 'debt', 'death', 'dread', 'other']);
  assert.strictEqual(q.lines[0].life.lump, 800000, 'a figure typed with a space is a number'); assert.strictEqual(q.lines[0].waiting, '1 month'); assert.strictEqual(q.lines[0].abi, 5);
  assert.ok(q.lines[1].junk === undefined && q.lines[1].name === 'Amy' && q.lines[1].term === 'Age 24', 'only the known cells are kept');
  assert.strictEqual(q.lines[3].lsd, 'N/A', 'the death-related rule survives'); assert.strictEqual(q.lines[5].label, 'Something else');
  assert.deepStrictEqual(q.printedTotals, { life: { lump: 3100000 }, ip: { monthly: 34500 } });
  const all = [q].concat(q.lines); assert.ok(all.every(x => x.st === 'verify' && x.by === 'page' && x.src && x.src.file === 'BR FNA - 100000001.pdf' && x.src.kind === 'quote'), 'amber, with the file');
  assert.ok(!all.some(x => x.st === 'confirmed'));
});

test('a quote that was only recorded (reading off): started from the number and date in the file name, the Fact Find\'s lines kept waiting, no figure taken from the name', () => {
  const s = filled(), q = D.applyQuote(s, 'reduced', { number: '100000003', date: '04/09/2026', premium: 1400 }, 'BR Reduced Quote - 100000003 - R1400.00 - 04.09.26.pdf', { nameOnly: true }).quote;
  assert.deepStrictEqual([q.number, q.date, q.premium, q.st], ['100000003', '04/09/2026', null, 'verify']);
  assert.deepStrictEqual(q.lines.map(l => l.type), ['household', 'child', 'debt', 'death', 'dread']); assert.ok(q.lines.every(l => l.st === 'ff'), 'the lines still wait for the document');
});

test('replacing a quote: the old one is removed (and says what replaced it), the new one says what it replaced; the same number twice is pointed out', () => {
  const s = filled(), a = D.applyQuote(s, 'fna', READ_QUOTE(), 'a.pdf').quote, b = D.applyQuote(s, 'fna', Object.assign(READ_QUOTE(), { number: '100000009' }), 'b.pdf', { replaces: a.id });
  assert.strictEqual(a.removed, true); assert.strictEqual(a.replacedBy, b.quote.id); assert.strictEqual(b.quote.replaces, a.id); assert.deepStrictEqual(calc.quotes(s, 'fna').map(q => q.number), ['100000009']);
  const c = D.applyQuote(s, 'fna', READ_QUOTE(), 'c.pdf'); assert.ok(c.duplicate === null || c.duplicate.number !== '100000001', 'the removed one is not a duplicate');
  const d = D.applyQuote(s, 'fna', Object.assign(READ_QUOTE(), { number: '100000009' }), 'd.pdf'); assert.ok(d.duplicate && d.duplicate.id === b.quote.id, 'the same number again is pointed out');
});

test('a policy schedule fills the details of the item it is for (matched by policy number, else by the insurer\'s name); one that matches none or two is not guessed', () => {
  const s = filled(), items = s.blocks.policies.items, nm = x => x.insurer;
  assert.strictEqual(D.matchItem(items, { insurer: 'Other Insurer Ltd' }, nm), items[0], 'by name (one contains the other)');
  assert.ok(D.matchItem(items, { insurer: 'Insurer' }, nm).ambiguous.length === 2, 'two insurers fit: not guessed');
  assert.strictEqual(D.matchItem(items, { insurer: 'Nobody Assurance' }, nm), null);
  items[1].policyNo = 'P-22'; assert.strictEqual(D.matchItem(items, { policyNo: 'p 22', insurer: 'whatever' }, nm), items[1], 'the policy number wins');
  const it = D.applyPolicy(s, items[0], { insurer: 'Other Insurer', product: 'Test Protector', policyNo: 'P-11', doc: '1/12/2025', premium: '1 281.90', aci: 10, abi: '?', ipAge: 65, benefits: { life: 'WOL', lsd: 'Occupation-based', zzz: 'x' },
    lines: [{ type: 'other', label: 'Life', life: { lump: 1000000 } }, { type: 'other', label: 'Dread', sev: { lump: 300000 } }] }, 'Other Insurer PS.pdf');
  assert.deepStrictEqual([it.product, it.policyNo, it.doc, it.premium, it.aci, it.abi, it.ipAge], ['Test Protector', 'P-11', '01/12/2025', 1281.9, 10, null, 65]);
  assert.deepStrictEqual(it.benefits, { life: 'WOL', lsd: 'Occupation-based' }); assert.strictEqual(it.lines.length, 2); assert.ok(it.st === 'verify' && it.src.file === 'Other Insurer PS.pdf' && it.lines.every(l => l.st === 'verify'));
  assert.strictEqual(s.blocks.policies.items.length, 2, 'a schedule never adds or removes an item: that is the Fact Find\'s');
});

test('a group statement: the amounts and the ages each benefit ends, who pays, the waiting period; a pension item gets its contributions', () => {
  const s = filled(), risk = s.blocks.group.items.filter(i => i.kind === 'risk')[0], pen = s.blocks.group.items.filter(i => i.kind === 'pension')[0];
  D.applyGroup(s, risk, { provider: 'x', statementDate: '28/9/2026', basis: '1.5 x salary', paidBy: 'employer', monthlyCost: 0, ipWaiting: '6 months', aci: 0, abi: null, life: { amount: 810000, endAge: 70 }, lsd: { amount: 810000, endAge: 65 }, sev: { amount: null, endAge: 'Not found' }, ip: { amount: 'Not found', endAge: null } }, 'Group.pdf');
  assert.deepStrictEqual([risk.statementDate, risk.basis, risk.paidBy, risk.ipWaiting, risk.life, risk.lsd.endAge, risk.sev.endAge, risk.ip.amount], ['28/09/2026', '1.5 x salary', 'employer', '6 months', { amount: 810000, endAge: '70' }, '65', 'Not found', 'Not found']);
  D.applyGroup(s, risk, { paidBy: 'somebody else' }, 'x.pdf'); assert.strictEqual(risk.paidBy, 'employer', 'a value that is not one of the three is ignored');
  D.applyGroup(s, pen, { value: 310000, employer: 1500, employee: 1500, aci: 0 }, 'Fund.pdf'); assert.deepStrictEqual([pen.value, pen.employer, pen.employee, pen.aci, pen.st], [310000, 1500, 1500, 0, 'verify']);
});

test('an investment statement fills value, date, source and the annual increase; Astute fills the rest but never replaces what a schedule gave', () => {
  const s = filled(), ra = s.blocks.investments.items[0];
  D.applyInvestment(s, ra, { product: 'RA', policyNo: 'R-1', valueDate: '20/11/2026', gross: 76661.06, penalty: 0, returnRate: 8.2, aci: 'Not found', monthly: 637.85 }, 'Test RA schedule.pdf');
  assert.deepStrictEqual([ra.gross, ra.valueDate, ra.aci, ra.monthly, ra.valueSource.kind, ra.valueSource.date, ra.valueSource.file, ra.st], [76661.06, '20/11/2026', 'Not found', 637.85, 'schedule', '20/11/2026', 'Test RA schedule.pdf', 'verify']);
  const r = D.applyAstute(s, { reportDate: '20/11/2026', investments: [{ provider: 'Test RA Co', gross: 1 }, { provider: 'Unknown Co', gross: 2 }] }, 'Astute.pdf');
  assert.deepStrictEqual([r.filled, r.unmatched], [0, ['Unknown Co']]); assert.strictEqual(ra.gross, 76661.06, 'the schedule\'s value stays');
  const s2 = filled(), ra2 = s2.blocks.investments.items[0], r2 = D.applyAstute(s2, { reportDate: '20/11/2026', investments: [{ provider: 'Test RA Co', gross: 52000, monthly: 600 }] }, 'Astute.pdf');
  assert.strictEqual(r2.filled, 1); assert.deepStrictEqual([ra2.gross, ra2.valueSource.kind, ra2.valueSource.date, ra2.valueSource.file], [52000, 'astute', '20/11/2026', 'Astute.pdf']);
});

test('a change moment pay-out guide goes under the quote with the same CP number; with no such quote nothing is made', () => {
  const s = filled(), q = D.applyQuote(s, 'fna', READ_QUOTE(), 'a.pdf').quote;
  assert.strictEqual(D.applyCmp(s, { number: '999999999', rows: [] }, 'x.pdf'), null);
  const hit = D.applyCmp(s, { number: 'CP 100000001', activationDate: '1/1/2027', reason: null, rows: [{ key: 'total', today: 30000, projected: '80 000' }, { key: 'child', name: 'Amy', sname: 'Client', today: 5000, projected: 10000, payoutDate: '01/01/2045' }, { key: 'zzz', today: 1 }] }, 'BR CMPO - 100000001.pdf');
  assert.strictEqual(hit, q); assert.deepStrictEqual(q.cmp.rows.map(r => [r.key, r.today, r.projected]), [['total', 30000, 80000], ['child', 5000, 10000], ['total', 1, null]]);
  assert.strictEqual(q.cmp.activationDate, '01/01/2027'); assert.strictEqual(q.cmp.src.file, 'BR CMPO - 100000001.pdf');
});

test('the documents loaded are listed in the saved file (file names only), and come back when it is opened', () => {
  const s = filled(); D.logDoc(s, 'BR FNA - 100000001.pdf', 'fna', 'read'); D.logDoc(s, 'Astute - 20.11.26.pdf', 'astute', 'name');
  const j = JSON.parse(store.toJSON(s)); assert.deepStrictEqual(j.documents.map(d => [d.file, d.block, d.how]), [['BR FNA - 100000001.pdf', 'fna', 'read'], ['Astute - 20.11.26.pdf', 'astute', 'name']]);
  const back = store.fromJSON(JSON.stringify(j)); assert.deepStrictEqual(back.documents.map(d => d.file), ['BR FNA - 100000001.pdf', 'Astute - 20.11.26.pdf']); assert.ok(back.documents.every(d => d.id && d.at));
  assert.deepStrictEqual(store.blank().documents, []);
});

test('only the name of a file is ever kept (no folder path), and no document is read unless the adviser has switched reading on', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'js', 'ov-ui.js'), 'utf8');
  assert.ok(/function aiOn\(\)[^}]*=== '1'/.test(src) && /var want = aiOn\(\), key = aiKey\(\), read = want && !!key\.apiKey/.test(src), 'reading needs the switch AND a key');
  assert.ok(/getItem\(AI_KEY\) === '1'/.test(src) && !/setItem\(AI_KEY, '1'\)[^;]*;[^;]*init/.test(src), 'the switch starts off');
  assert.ok(/window\.confirm\('Switch reading on\?/.test(src), 'switching it on asks first');
});
