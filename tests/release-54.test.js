/* Release 5.4 (21 November 2026): the Client Overview page, stage 2 (version 0.1): its schema, figures, saved file, pre-fill from the Fact Find and checks (docs/OVERVIEW-DATA-CONTRACT.md).
   Invented client only (the "Test Client" of the build brief): no real client data is ever used here. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.FF = { util: require('../app/js/util.js') };
const schema = require('../app/js/ov-schema.js');
const calc = require('../app/js/ov-calc.js');
const store = require('../app/js/ov-store.js');
const check = require('../app/js/ov-check.js');
const ffSchema = require('../app/js/schema.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

/* An invented Fact Find: Test Client, net income R40,000, two children, three debts, one other-broker policy, a group risk provider, one retirement annuity of ours. */
const FFJ = () => ({
  app: 'wr-fact-find', schema: '5.4',
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, dob: { v: '14/03/1985' }, net: { v: 'R 40 000.00' }, gross: { v: 'R 50 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' }, dd_cover: { v: 'R 500 000.00' },
    ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' }, ma_broker: { v: 'Other broker' }, will: { v: 'Yes' }, will_up: { v: 'Yes' }, will_where: { v: 'Test Attorneys' }, sti: { v: 'Yes' }, sti_broker: { v: 'Cameron Maritz' }, sti_personal: { v: 'R 1 479.00' }, rgar_req: { v: 'Not required' }, egar_req: { v: 'Request an EGAR' } },
  l: {
    kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } },
      { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: 'R 50 000.00', term: 'Max term?' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_pp: [{ d: { type: 'Pension fund', prov: 'Test Pension', val: 'R 300 000.00', contrib: 'R 3 000.00', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [{ d: { type: 'Unit trust', prov: 'Test Funds', val: 'R 20 000.00', prem: 'R 500.00', broker: 'Other broker' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'New Business', amt: 'R 2 000.00' } }, { d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }],
    raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: [{ d: { req: 'Request a quote', product: 'Tax-free savings', ins: 'Old Mutual', monthly: 'R 3 000.00', lump: '' } }, { d: { req: 'Not required', product: 'Endowment', ins: 'Sanlam', monthly: '', lump: '' } }]
  }
});
const filled = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'Fact Find (Audio to Text) - 20.11.26 - (Test Client).json'); return s; };
const set = (s, p, v, k) => store.setPath(s, p, v, k || 'money');
/* A BrightRock FNA for the invented client whose three income-linked pillars each add up to R40,000 a month. */
function fnaFilled(s) {
  const q = store.addQuote(s, 'fna'); q.number = '100000001'; q.aci = 10; q.premium = 2900; q.date = '19/11/2026';
  const L = q.lines, get = t => L.filter(l => l.type === t);
  const put = (l, life, lsd, ip, abi) => { l.life.lump = life[0]; l.life.monthly = life[1]; l.lsd.lump = lsd[0]; l.lsd.monthly = lsd[1]; if (ip != null && l.ip !== 'N/A') l.ip.monthly = ip; l.abi = abi; l.st = 'verify'; l.by = 'skill'; };
  put(get('household')[0], [800000, 5000], [900000, 12500], 22500, 5);
  put(get('child')[0], [500000, 5000], [450000, 5000], 0, 5); put(get('child')[1], [550000, 5000], [480000, 5000], 0, 5);
  put(get('debt')[0], [1200000, 12000], [1200000, 12000], 12000, 0); put(get('debt')[1], [200000, 4000], [200000, 4000], 4000, 0); put(get('debt')[2], [50000, 1500], [50000, 1500], 1500, 0);
  put(get('death')[0], [600000, 7500], [0, 0], null, 3); get('death')[0].lsd = 'N/A';
  get('dread')[0].sev.lump = 500000; get('dread')[0].abi = 3;
  return q;
}

test('the schema: eleven blocks in the fixed order, four pillars, six statuses, Paul\'s standards', () => {
  assert.deepStrictEqual(schema.BLOCKS.map(b => b.n + ' ' + b.title), ['1 Current policies', '2 FNA quote', '3 Group benefits & personal investments', '4 Shortfall', '5 Shortfall quote', '6 Reduced quotes', '7 Comparative quotes', '8 Current investments', '9 Proposed investments', '10 Goal analysis reports', '11 Medical aid, will & short-term']);
  assert.deepStrictEqual(schema.PILLARS.map(p => p.id), ['life', 'sev', 'lsd', 'ip']);
  assert.deepStrictEqual(schema.STATUS.map(s => s.l), ['Pending client decision', 'Accepted', 'Not accepted', 'Declined', 'Medical decline', 'Pending underwriting']);
  assert.deepStrictEqual(schema.STANDARDS, { aci: 10, abi: { child: 5, household: 5, debt: 0, death: 3, dread: 3 } });
  assert.deepStrictEqual(schema.BLOCKS.filter(b => b.ff).map(b => b.id), ['policies', 'group', 'investments'], 'blocks 1, 3 and 8 follow the Fact Find');
  assert.strictEqual(schema.version, '0.1');
});

test('the file name is "WR Overview - dd.mm.yy - (Surname, Name)" and the year folder is the year of the overview date', () => {
  const s = filled(); s.header.overviewDate = '15/12/2026';
  assert.strictEqual(schema.fileName(s), 'WR Overview - 15.12.26 - (Client, Test)');
  assert.strictEqual(store.fileName(s), schema.fileName(s)); assert.strictEqual(schema.yearOf(s), '2026');
  s.header.overviewDate = '03/01/2027'; assert.strictEqual(schema.fileName(s), 'WR Overview - 03.01.27 - (Client, Test)'); assert.strictEqual(schema.yearOf(s), '2027');
  const b = store.blank(); b.header.overviewDate = '01/02/2027'; assert.strictEqual(schema.fileName(b), 'WR Overview - 01.02.27 - (New client)');
  const odd = store.blank(); odd.header.fname = 'Test: A'; odd.header.sname = 'Cl/ient'; odd.header.overviewDate = '01/02/2027'; assert.strictEqual(schema.fileName(odd), 'WR Overview - 01.02.27 - (Client, Test A)'.replace('Client', 'Client'), 'characters a file name cannot hold are taken out');
});

test('figures: rand is written R1,034,800 and R637.85, a difference +R1,000 or −R1,000', () => {
  assert.strictEqual(calc.fmtR(1034800), 'R1,034,800'); assert.strictEqual(calc.fmtR(637.85), 'R637.85'); assert.strictEqual(calc.fmtR(0), 'R0'); assert.strictEqual(calc.fmtR(null), '');
  assert.strictEqual(calc.fmtDiff(1000), '+R1,000'); assert.strictEqual(calc.fmtDiff(-1000), '−R1,000'); assert.strictEqual(calc.fmtDiff(0), 'R0');
  assert.strictEqual(calc.show('N/A'), 'N/A'); assert.strictEqual(calc.show('Not found'), 'Not found'); assert.strictEqual(calc.show(null), '');
});

test('a quote\'s totals are worked out from its lines that are not removed: total lump sum, total income protected, N/A cells left out', () => {
  const s = filled(), q = fnaFilled(s), t = calc.totals(q);
  assert.deepStrictEqual(t.life, { lump: 3900000, monthly: 40000 });
  assert.deepStrictEqual(t.lsd, { lump: 3280000, monthly: 40000 });
  assert.deepStrictEqual(t.sev, { lump: 500000 }); assert.deepStrictEqual(t.ip, { monthly: 40000 });
  const gone = q.lines[1].life.lump; q.lines[1].removed = true;                                           // the first child's line is taken out: nothing of it counts any more
  assert.strictEqual(calc.totals(q).life.lump, 3900000 - gone);
  q.printedTotals = { life: { lump: 1 } };
  assert.strictEqual(calc.totals(q).life.lump, 3900000 - gone, 'a total a document printed is never used');
});

test('the shortfall is the FNA less the group benefits and the personal investments; personal investments reduce the life pillar only; never below nothing', () => {
  const s = filled(); fnaFilled(s);
  s.blocks.group.items[0].life.amount = 810000; s.blocks.group.items[0].lsd.amount = 810000;
  const pi = calc.personalInvestments(s);
  assert.strictEqual(pi.gross, 70000, 'the retirement annuity and the unit trust: both are in block 8'); assert.strictEqual(pi.monthly, 1100);
  const sf = calc.shortfall(s);
  assert.deepStrictEqual(sf.short, { life: 3900000 - (810000 + 70000), sev: 500000, lsd: 3280000 - 810000, ip: 40000 });
  s.blocks.group.items[0].sev.amount = 900000; assert.strictEqual(calc.shortfall(s).short.sev, 0, 'never below nothing');
  assert.strictEqual(calc.shortfall(store.blank()).has, false);
});

test('"compared with what you have now": three rows, the grand totals of block 1, this quote and the difference', () => {
  const s = filled(), q = fnaFilled(s), pol = s.blocks.policies.items[0];
  pol.lines.push(store.newLine('other', { label: 'Cover', life: { lump: 1000000, monthly: null }, sev: { lump: 300000 }, lsd: { lump: 500000, monthly: null }, ip: { monthly: 10000 } }));
  const c = calc.compare(s, q);
  assert.deepStrictEqual(c.now, { life: 1000000, sev: 300000, lsd: 500000, ip: 10000, premium: 1200 });
  assert.deepStrictEqual(c.quote, { life: 3900000, sev: 500000, lsd: 3280000, ip: 40000, premium: 2900 });
  assert.deepStrictEqual(c.diff, { life: 2900000, sev: 200000, lsd: 2780000, ip: 30000, premium: 1700 });
});

test('block 1: an accepted quote that has been issued (policy number and start date) is a WR policy there; a schedule with the same policy number wins', () => {
  const s = filled(), q = fnaFilled(s);
  assert.strictEqual(calc.policies(s).length, 1);
  q.status = 'accepted'; assert.strictEqual(calc.policies(s).length, 1, 'accepted but not yet issued: still a quote');
  q.policyNo = 'P-1'; q.startDate = '01/12/2026';
  const ps = calc.policies(s); assert.strictEqual(ps.length, 2); assert.ok(ps[1].derived && ps[1].item.wr, 'a WR policy, with a green tick');
  assert.strictEqual(calc.policyTotals(s).count.wr, 1); assert.strictEqual(calc.policyTotals(s).premium.all, 4100);
  s.blocks.policies.items.push({ id: 'sched', wr: true, insurer: 'BrightRock', policyNo: 'p-1', premium: 2800, lines: [], st: 'verify' });
  assert.strictEqual(calc.policies(s).filter(e => e.derived).length, 0, 'the schedule supersedes the quote');
});

test('typing: a figure, N/A and Not found are kept as they are; typing checks the row; a box can be emptied again', () => {
  const s = filled(), q = fnaFilled(s), p = 'blocks.fna.quotes.0.lines.1.';
  assert.strictEqual(set(s, p + 'life.lump', 'R 1 234 567,50'), 1234567.5); assert.strictEqual(q.lines[1].st, 'confirmed'); assert.strictEqual(q.lines[1].by, 'person');
  assert.strictEqual(set(s, p + 'sev.lump', 'n/a'), 'N/A'); assert.strictEqual(set(s, p + 'abi', 'not found', 'pct'), 'Not found'); assert.strictEqual(set(s, p + 'sev.lump', '', 'money'), null, 'a box can be emptied again');
  assert.strictEqual(store.setPath(s, 'header.overviewDate', '5/1/2027', 'date'), '05/01/2027');
  assert.strictEqual(store.setPath(s, 'blocks.fna.quotes.0.servicing', true, 'bool'), true);
  store.accept(s, 'blocks.fna.quotes.0.lines.0'); assert.strictEqual(q.lines[0].st, 'confirmed');
});

test('a new FNA, shortfall or reduced quote starts with the lines the Fact Find knows; a comparative quote starts with one whole-of-life line (stage 6: it is tailored to what that insurer prints)', () => {
  const s = filled();
  const q = store.addQuote(s, 'fna');
  assert.deepStrictEqual(q.lines.map(l => l.type), ['household', 'child', 'child', 'debt', 'debt', 'debt', 'death', 'dread']);
  assert.deepStrictEqual(q.lines.filter(l => l.type === 'child').map(l => l.name + ' ' + l.sname), ['Amy Client', 'Ben Client']);
  assert.deepStrictEqual(q.lines.filter(l => l.type === 'debt').map(l => l.debt), ['Home loan', 'Car loan', 'Credit card']);
  assert.ok(q.lines.every(l => l.st === 'ff') && q.status === 'pending' && q.insurer === 'BrightRock' && q.rates === 'Non-smoker rates' && q.disabilityAge === 65);
  const dead = q.lines.filter(l => l.type === 'death' || l.type === 'dread');
  assert.ok(dead.every(l => l.lsd === 'N/A' && l.ip === 'N/A' && l.waiting === 'N/A'), 'death-related and dread: N/A in lump sum disability, income protector and waiting period');
  assert.strictEqual(q.lines.filter(l => l.type === 'child')[0].term, 'Age 24'); assert.strictEqual(q.lines.filter(l => l.type === 'dread')[0].term, 'Whole of life');
  const cq = store.addQuote(s, 'comparative'); assert.deepStrictEqual(cq.lines.map(l => [l.type, l.label, l.term]), [['other', 'Cover', 'Whole of life']]); assert.strictEqual(cq.insurer, '');
  assert.strictEqual(store.addQuote(s, 'reduced').lines.length, 8); assert.strictEqual(s.blocks.reduced.quotes.length, 1);
  const blank = store.addQuote(store.blank(), 'fna'); assert.deepStrictEqual(blank.lines.map(l => l.type), ['household', 'death', 'dread'], 'with no Fact Find read, only the lines every client has');
});

test('removing a line or a quote hides it and its figures; Undo brings it back', () => {
  const s = filled(), q = fnaFilled(s), before = calc.totals(q).life.lump;
  assert.ok(store.setRemoved(s, 'blocks.fna.quotes.0.lines.1', true)); assert.ok(calc.totals(q).life.lump < before);
  store.setRemoved(s, 'blocks.fna.quotes.0.lines.1', false); assert.strictEqual(calc.totals(q).life.lump, before);
  store.setRemoved(s, 'blocks.fna.quotes.0', true); assert.strictEqual(calc.quotes(s, 'fna').length, 0); assert.strictEqual(calc.allQuotes(s).length, 0);
  store.setRemoved(s, 'blocks.fna.quotes.0', false); assert.strictEqual(calc.quotes(s, 'fna').length, 1);
});

test('Fill from Fact Find: the header, a starting item for every Fact Find row (blocks 1, 3, 8, 9, 10, 11), each tied to its row by an ffKey and waiting for a document', () => {
  const s = store.blank(), rep = store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'), h = s.header;
  assert.deepStrictEqual([h.fname, h.sname, h.dob, h.netIncome, h.grossIncome, h.disabilityAge, h.meetingDate, h.sevRequest, h.premiumBudget], ['Test', 'Client', '14/03/1985', 40000, 50000, 65, '20/11/2026', 500000, 1400], 'the budget is the first servicing reduced-quote request');
  assert.strictEqual(rep.first, true); assert.strictEqual(rep.changed, 0); assert.strictEqual(s.factFind.file, 'ff.json'); assert.strictEqual(s.factFind.schema, '5.4');
  const B = s.blocks;
  assert.deepStrictEqual(B.policies.items.map(i => [i.ffKey, i.insurer, i.premium, i.wr, i.st]), [['risk:other insurer:1', 'Other Insurer', 1200, false, 'ff']]);
  assert.deepStrictEqual(B.group.items.map(i => [i.ffKey, i.kind, i.provider]), [['grp:test group:1', 'risk', 'Test Group'], ['ret_pp:test pension:1', 'pension', 'Test Pension']]);
  assert.deepStrictEqual(B.investments.items.map(i => [i.ffKey, i.product, i.gross, i.monthly, i.wr]), [['ret_ra:test ra co:1', 'Retirement annuity', 50000, 600, true], ['inv:test funds:1', 'Unit trust', 20000, 500, false]]);
  assert.deepStrictEqual(B.proposed.items.map(i => [i.type, i.provider, i.monthly, i.contribution]), [['Retirement annuity (RA)', 'Old Mutual', 5000, 'monthly'], ['Tax-free investment', 'Old Mutual', 3000, 'monthly']], 'only what the client asked to have quoted');
  assert.deepStrictEqual(B.goals.items.map(i => [i.kind, i.requested, i.note]), [['rgar', false, 'Client did not request for at this time'], ['egar', true, '']]);
  assert.deepStrictEqual(B.other.items.map(i => i.key), ['medical', 'gap', 'will', 'legacy', 'shortterm']);
  assert.strictEqual(B.other.items[0].company, 'Test Medical'); assert.strictEqual(B.other.items[2].company, 'Test Attorneys'); assert.ok(/Will up to date/.test(B.other.items[2].note));
  assert.strictEqual(B.other.items[4].premium, 1479, 'short-term from the Fact Find, with Cameron Maritz as its broker'); assert.ok(/Cameron Maritz/.test(B.other.items[4].note));
  assert.ok([].concat(B.policies.items, B.group.items, B.investments.items).every(i => i.st === 'ff' && i.by === 'page' && i.src.kind === 'factfind'));
});

test('reading the same Fact Find again adds nothing and changes nothing; a typed header box is never overwritten; two rows of one provider get ffKey 1 and 2', () => {
  const s = filled(); s.header.netIncome = 38000;
  const again = store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json');
  assert.deepStrictEqual([again.added, again.updated, again.changed, again.first], [0, 0, 0, false]); assert.ok(again.kept.indexOf('net income') >= 0, 'what was typed is left, and said'); assert.strictEqual(s.header.netIncome, 38000);
  const j = FFJ(); j.l.risk.push({ d: { prov: 'Other Insurer', spend: 'R 300.00', broker: 'Other broker' } });
  const t = store.fillFromFactFind(s, JSON.stringify(j), 'ff.json');
  assert.strictEqual(t.added, 1); assert.deepStrictEqual(s.blocks.policies.items.map(i => i.ffKey), ['risk:other insurer:1', 'risk:other insurer:2']); assert.strictEqual(t.changed, 1, 'the new policy is one item that changed (not one for each of its boxes)');
});

test('a later Fact Find: an item still waiting for its document follows it; one a document has filled is never overwritten, and "the Fact Find changed: n items" says so', () => {
  const s = filled(), pol = s.blocks.policies.items[0];
  const j = FFJ(); j.l.risk[0].d.spend = 'R 1 350.00'; j.l.kids[0].d.cost = 'R 6 000.00';
  const r = store.fillFromFactFind(s, JSON.stringify(j), 'ff.json');
  assert.strictEqual(pol.premium, 1350, 'still the Fact Find\'s figure: it follows the Fact Find'); assert.strictEqual(r.changed, 2); assert.strictEqual(s.factFind.changed, 2);
  pol.st = 'verify'; pol.premium = 1281.9;                                                              // a schedule has given the real figure
  j.l.risk[0].d.spend = 'R 1 500.00'; store.fillFromFactFind(s, JSON.stringify(j), 'ff.json');
  assert.strictEqual(pol.premium, 1281.9, 'the document wins');
  const c = check.run(s), msg = c.problems.filter(p => p.id === 'doc.vs.factfind');
  assert.strictEqual(msg.length, 1); assert.ok(/1,281\.90/.test(msg[0].message) && /1,500/.test(msg[0].message));
  assert.ok(c.problems.some(p => p.id === 'ff.changed'));
});

test('a file that is not a Fact Find is refused', () => {
  assert.throws(() => store.fillFromFactFind(store.blank(), '{"app":"wr-short-risk"}', 'x.json'), /not a Wealth Revolution Fact Find/);
  assert.throws(() => store.fillFromFactFind(store.blank(), 'nonsense', 'x.json'), /cannot be read/);
});

test('the saved file: the layout of the contract, computed figures written for readers and never read back, unknown keys kept, a newer schema flagged', () => {
  const s = filled(); fnaFilled(s); s.blocks.fna.quotes[0].cmp = { number: '100000001', activationDate: '01/01/2027', reason: null, rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }] };
  s._extra = { futureThing: { a: 1 } };
  const text = store.toJSON(s), j = JSON.parse(text);
  assert.strictEqual(j.app, 'wr-overview'); assert.strictEqual(j.schema, '0.1');
  assert.deepStrictEqual(Object.keys(j.blocks), ['policies', 'fna', 'group', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other']);
  assert.ok(j.header && j.factFind.facts.children.length === 2 && j.settings.standards.aci === 10 && j.settings.tolerance === 1);
  assert.strictEqual(j.computed.totals[s.blocks.fna.quotes[0].id].life.monthly, 40000); assert.ok(j.computed.shortfall && j.computed.policies.premium.all === 1200); assert.strictEqual(j.futureThing.a, 1);
  const back = store.fromJSON(text);
  assert.strictEqual(back.computed, null, 'computed is never read back'); assert.strictEqual(back.blocks.fna.quotes[0].lines.length, 8); assert.strictEqual(back.blocks.fna.quotes[0].cmp.rows[0].projected, 80000);
  assert.strictEqual(back.factFind.facts.debts.length, 3); assert.strictEqual(back._extra.futureThing.a, 1); assert.ok(!back.newer);
  assert.strictEqual(JSON.parse(store.toJSON(back)).futureThing.a, 1, 'saved again, the unknown key is still there');
  const newer = JSON.parse(text); newer.schema = '0.9'; assert.strictEqual(store.fromJSON(JSON.stringify(newer)).newer, true);
  assert.throws(() => store.fromJSON('{"app":"wr-fact-find"}'), /not a Wealth Revolution Client Overview/);
});

test('opening tidies a file a skill wrote: missing ids, statuses and pillar cells are filled in, an unknown status becomes "verify"', () => {
  const j = { app: 'wr-overview', schema: '0.1', header: { fname: 'Test', sname: 'Client' }, blocks: { fna: { quotes: [{ insurer: 'BrightRock', number: '1', status: 'weird', lines: [{ type: 'child', name: 'Amy', sname: 'Client', life: { lump: 5, monthly: 1 } }, { type: 'nonsense', label: 'x' }] }] }, other: { items: [{ key: 'will', note: 'Has a will' }] } } };
  const s = store.fromJSON(JSON.stringify(j)), q = s.blocks.fna.quotes[0];
  assert.ok(q.id && q.kind === 'fna' && q.status === 'pending' && q.st === 'verify' && q.removed === false);
  assert.ok(q.lines[0].id && q.lines[0].st === 'verify' && q.lines[0].sev.lump === null && q.lines[0].ip.monthly === null && q.lines[0].life.lump === 5);
  assert.strictEqual(q.lines[1].type, 'other');
  assert.deepStrictEqual(s.blocks.other.items.map(i => i.key), ['medical', 'gap', 'will', 'legacy', 'shortterm']); assert.strictEqual(s.blocks.other.items[2].note, 'Has a will');
});

test('the checks: net income, children, debts, the shortfall quote, the standards, printed totals, the age, the budget, gaps', () => {
  const s = filled(), q = fnaFilled(s), ids = () => check.run(s).problems.map(p => p.id);
  assert.deepStrictEqual(ids().filter(i => i !== 'gaps'), [], 'a right FNA: nothing to flag');
  const kid = q.lines.filter(l => l.type === 'child')[0], debt = q.lines.filter(l => l.type === 'debt')[0];
  kid.life.monthly = 4000;
  const a = check.run(s).problems;
  assert.ok(a.some(p => p.id === 'fna.income' && /Life cover/.test(p.message) && /R39,000/.test(p.message) && /R40,000/.test(p.message)));
  assert.ok(a.some(p => p.id === 'quote.children' && /Amy Client/.test(p.message) && /R4,000/.test(p.message) && /R5,000/.test(p.message)));
  kid.life.monthly = 5000; debt.life.monthly = 11000;
  assert.ok(check.run(s).problems.some(p => p.id === 'quote.debts' && /Home loan/.test(p.message) && /R11,000/.test(p.message) && /R12,000/.test(p.message)));
  debt.life.monthly = 12000;
  q.lines.push(store.newLine('child', { name: 'Cleo', sname: 'Client', life: { lump: 1, monthly: 100 } })); q.lines.push(store.newLine('debt', { debt: 'Boat loan', life: { lump: 1, monthly: 100 } }));
  const b = check.run(s).problems; assert.ok(b.some(p => p.id === 'quote.children' && /Cleo Client/.test(p.message))); assert.ok(b.some(p => p.id === 'quote.debts' && /Boat loan/.test(p.message)));
  q.lines.splice(q.lines.length - 2, 2);
  q.lines.filter(l => l.type === 'child')[0].abi = 4; q.aci = 11; q.lines.filter(l => l.type === 'dread')[0].abi = 5;
  const c = check.run(s).problems.filter(p => p.id === 'standards'); assert.strictEqual(c.length, 3); assert.ok(c.some(p => /11%/.test(p.message)) && c.some(p => /4%/.test(p.message)));
  q.lines.filter(l => l.type === 'child')[0].abi = 5; q.aci = 10; q.lines.filter(l => l.type === 'dread')[0].abi = 3;
  q.printedTotals = { ip: { monthly: 43000 }, life: { lump: 3900000 } }; assert.ok(check.run(s).problems.some(p => p.id === 'totals.printed' && /R43,000/.test(p.message) && /R40,000/.test(p.message)), 'the document\'s own printing error'); q.printedTotals = null;
  q.disabilityAge = 70; assert.ok(ids().includes('age')); q.disabilityAge = 65;
  const red = store.addQuote(s, 'reduced', { premium: 1700 }); red.number = '2'; assert.ok(check.run(s).problems.some(p => p.id === 'budget' && /R1,700/.test(p.message) && /R1,400/.test(p.message))); red.premium = 1400;
  assert.ok(!ids().includes('budget'));
  const g = s.blocks.group.items[0]; g.life.amount = 810000; assert.ok(check.run(s).problems.some(p => p.id === 'gaps' && /Life cover: the age the benefit ends/.test(p.message))); g.life.endAge = 'To age 70';
  assert.ok(!check.run(s).problems.some(p => /Life cover: the age/.test(p.message)));
  const inv = s.blocks.investments.items[0]; inv.st = 'verify'; assert.ok(check.run(s).problems.some(p => p.id === 'gaps' && /annual contribution increase/.test(p.message))); inv.aci = 'Not found'; assert.ok(!check.run(s).problems.some(p => /annual contribution increase is not filled/.test(p.message)));
  const pen = s.blocks.group.items[1]; pen.st = 'verify'; assert.ok(check.run(s).problems.some(p => /POI/.test(p.message)));
  s.blocks.policies.items[0].ffKey = 'risk:gone:1'; assert.ok(ids().includes('ff.missing'));
});

test('the shortfall check compares the shortfall quote with what the form works out', () => {
  const s = filled(); fnaFilled(s); s.blocks.group.items[0].life.amount = 810000;
  const sq = store.addQuote(s, 'shortfall'); sq.number = '3';
  sq.lines.filter(l => l.type === 'household')[0].life.lump = 3900000 - 810000 - 70000; sq.lines.filter(l => l.type === 'dread')[0].sev.lump = 500000;
  assert.ok(!check.run(s).problems.some(p => p.id === 'shortfall.match' && /Life cover/.test(p.message)), 'the quote has the shortfall the form works out');
  sq.lines.filter(l => l.type === 'household')[0].life.lump = 3900000 - 810000;                           // the quote ignored the personal investments
  const p = check.run(s).problems.filter(x => x.id === 'shortfall.match' && /Life cover/.test(x.message)); assert.strictEqual(p.length, 1); assert.ok(/R3,090,000/.test(p[0].message) && /R3,020,000/.test(p[0].message));
});

test('the dot of every block: grey when waiting, amber when it needs a look, green when complete, hollow for a shortfall quote nobody needs', () => {
  const s = filled(), d = () => check.run(s).dots;
  assert.strictEqual(d().policies, 'grey'); assert.strictEqual(d().fna, 'grey'); assert.strictEqual(d().shortfall, 'grey');
  assert.strictEqual(d().other, 'amber', 'block 11 follows the Fact Find and has no document to wait for: what it says is to be checked');
  s.blocks.other.items.forEach(it => { if (it.st === 'ff') it.st = 'confirmed'; }); assert.strictEqual(d().other, 'green', 'a click confirms it; the items with nothing in them wait for nothing');
  s.blocks.other.items.forEach(it => { if (it.st === 'confirmed') it.st = 'ff'; });
  assert.strictEqual(d().shortfallQuote, 'grey', 'there is group risk (the Fact Find has a provider): a shortfall quote is wanted');
  const none = filled(); none.blocks.group.items = none.blocks.group.items.filter(i => i.kind !== 'risk'); assert.strictEqual(check.run(none).dots.shortfallQuote, 'na');
  fnaFilled(s); assert.strictEqual(d().fna, 'amber'); assert.strictEqual(d().shortfall, 'green');
  calc.activeLines(s.blocks.fna.quotes[0]).forEach(l => { l.st = 'confirmed'; }); s.blocks.fna.quotes[0].st = 'confirmed'; assert.strictEqual(d().fna, 'amber', 'still the missing change moment pay-out guide');
  s.blocks.fna.quotes[0].cmp = { rows: [] }; assert.strictEqual(d().fna, 'green');
  s.blocks.policies.items[0].st = 'confirmed'; assert.strictEqual(d().policies, 'green');
});

test('the page: every script is loaded in order from its own folder, the build matches, and every page\'s Other forms menu lists the Client Overview', () => {
  const h = app('overview.html'), B = require('../app/js/build.js');
  assert.ok(h.includes('<meta name="wr-build" content="' + B.BUILD + '">') && B.BUILD === ffSchema.version);
  const order = ['build.js', 'util.js', 'ov-schema.js', 'ov-calc.js', 'ov-store.js', 'ov-check.js', 'handover.js', 'ov-ui.js'].map(f => h.indexOf('js/' + f));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'scripts in dependency order');
  ['index.html', 'short-risk.html', 'capture-sheet.html', 'overview.html'].forEach(f => { const x = app(f); assert.ok(x.includes('<meta name="wr-build" content="' + B.BUILD + '">'), f + ' build'); });
  assert.ok(app('index.html').includes('id="linkOV" href="overview.html?from=factfind"'), 'the Fact Find carries its client to the Overview');
  ['short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(/id="linkOV" href="overview\.html" data-base="overview\.html"/.test(app(f)), f + ' links to the Overview'));
  ['linkFF', 'linkSR', 'linkCS'].forEach(id => assert.ok(h.includes('id="' + id + '"'), 'the Overview links to ' + id));
  assert.ok(/\['#linkSR', '#linkCS', '#linkOV'\]/.test(app('js/ui.js')), 'the Fact Find leaves its client for the Overview too');
  assert.strictEqual(parseFloat(require('../app/js/sr-schema.js').version) >= 1.6 && parseFloat(require('../app/js/cs-schema.js').version) >= 1.5, true);
});

test('the Overview page keeps its own functions once (a name defined twice silently replaces the first)', () => {
  ['ov-ui.js', 'ov-store.js', 'ov-calc.js', 'ov-check.js', 'ov-schema.js'].forEach(f => {
    const names = (app('js/' + f).match(/^\s{2,4}function ([A-Za-z0-9_]+)\(/gm) || []).map(x => x.replace(/^\s*function /, '').replace(/\($/, ''));
    const dup = names.filter((n, i) => names.indexOf(n) !== i); assert.deepStrictEqual(dup, [], f + ' defines twice: ' + dup.join(', '));
  });
});

test('no real client data in the Overview files or documents (invented names only)', () => {
  const files = ['js/ov-ui.js', 'js/ov-store.js', 'js/ov-calc.js', 'js/ov-check.js', 'js/ov-schema.js', 'overview.html', 'css/overview.css'].map(f => app(f)).concat([fs.readFileSync(path.join(__dirname, '..', 'docs', 'OVERVIEW-DATA-CONTRACT.md'), 'utf8')]);
  files.forEach(t => { assert.ok(!/\b\d{13}\b/.test(t), 'no ID number'); assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(t), 'no e-mail address'); });
});
