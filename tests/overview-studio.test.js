/* The Client Overview Studio (page 0.6, 22 November): the new name, reading on by default, proposed investments and goal analysis reports that can be read, "Upload from client folder" (where it looks in the client's folder,
   what it reads beside the quote), the Fact Find matching that flags a difference on its own line, and the menu dots (legend, hover text, the shortfall dot). Invented client only ("Test Client"): no real client data. */
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
const F = require('../app/js/folders.js');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const FFJ = () => ({
  app: 'wr-fact-find', schema: '5.4',
  f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' }, date: { v: '20/11/2026' } },
  l: {
    kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }],
    ret_ra: [{ d: { prov: 'Test RA Co', status: 'Current', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: []
  }
});
const filled = () => { const s = store.blank(); store.fillFromFactFind(s, JSON.stringify(FFJ()), 'ff.json'); return s; };

test('the new name: the heading, the tab title and the Other forms link of every page', () => {
  const ov = app('overview.html');
  assert.ok(/<title>Client Overview Studio<\/title>/.test(ov) && /<h1>Client Overview Studio<\/h1>/.test(ov));
  assert.ok(/document\.title = 'Client Overview Studio'/.test(app('js/ov-ui.js')));
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => { const h = app(f); assert.ok(/id="linkOV"[^>]*>Client Overview Studio &#8599;<\/a>/.test(h), f); assert.ok(!/>Client Overview &#8599;/.test(h), f + ' has no old label'); });
});

test('a document is sorted into the new kinds by its name: goal analysis reports and proposed investments', () => {
  const c = n => (docs.classify(n) || {}).block;
  assert.strictEqual(c('RGAR - Test Client.pdf'), 'goals'); assert.strictEqual(c('EGAR 2026.pdf'), 'goals'); assert.strictEqual(c('Retirement Goal Analysis Report.pdf'), 'goals');
  assert.strictEqual(c('OM - Optimal RA quote 12345678 - 20.11.26.pdf'), 'proposed'); assert.strictEqual(c('Tax-Free proposal OM.pdf'), 'proposed');
  assert.strictEqual(c('Discovery quote 99887766.pdf'), 'comparative', 'a risk quote is still a comparative quote'); assert.strictEqual(c('BR FNA 100000001.pdf'), 'fna'); assert.strictEqual(c('Old Mutual investment statement.pdf'), 'investments');
  assert.strictEqual(docs.SPEC_OF.proposed, 'proposal'); assert.strictEqual(docs.SPEC_OF.goals, 'goal');
  assert.match(docs.promptFor('proposed'), /quote or proposal for an investment/); assert.match(docs.promptFor('goals'), /Goal Analysis Report/); assert.match(docs.promptFor('fna'), /"servicing"/);
});

test('a quote read from a document sets the kind (servicing or new business); nothing else is guessed', () => {
  const s = filled(); const r = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000001', premium: 2900, servicing: true, lines: [{ type: 'household', life: { lump: 800000 } }] }, 'q.pdf');
  assert.strictEqual(r.quote.servicing, true); const n = docs.applyQuote(s, 'reduced', { number: '2', lines: [{ type: 'household' }] }, 'r.pdf'); assert.strictEqual(n.quote.servicing, false, 'not said: left as it was');
});

test('a proposed investment: a Fact Find row from the same provider is filled in, else a new row is added; the type and contribution are normalised', () => {
  const s = filled(), before = s.blocks.proposed.items.length;
  const r = docs.applyProposed(s, { provider: 'Old Mutual', type: 'retirement annuity (ra)', number: 'Q-77', monthly: 5200, boostPct: 4, netInvested: 4800, aci: 10 }, 'om.pdf');
  assert.strictEqual(r.matched, true); assert.strictEqual(s.blocks.proposed.items.length, before, 'no new row'); const it = r.item;
  assert.deepStrictEqual([it.type, it.quote, it.monthly, it.boostPct, it.netInvested, it.aci, it.contribution, it.st, it.by, it.src.kind, it.src.file], ['Retirement annuity (RA)', 'Q-77', 5200, 4, 4800, 10, 'monthly', 'verify', 'page', 'proposal', 'om.pdf']);
  assert.ok(it.ffKey, 'still tied to the Fact Find row');
  const n = docs.applyProposed(s, { provider: 'Sanlam', type: 'Tax-free investment', lump: 100000, monthly: 1000 }, 'sl.pdf');
  assert.strictEqual(n.matched, false); assert.strictEqual(s.blocks.proposed.items.length, before + 1); assert.strictEqual(n.item.contribution, 'both'); assert.ok(!n.item.ffKey);
  const again = docs.applyProposed(s, { provider: 'Old Mutual', type: 'Retirement annuity (RA)', monthly: 5000 }, 'om2.pdf'); assert.strictEqual(again.matched, false, 'a row a document has filled is not filled again: a second quote is a new row');
});

test('a goal analysis report fills the RGAR or EGAR row and marks it requested; a Fact Find that said "no" is told', () => {
  const s = filled(), g0 = s.blocks.goals.items.filter(g => g.kind === 'rgar')[0];
  g0.requested = false; const r = docs.applyGoal(s, { kind: 'rgar', currentValuePm: 31000, futureValuePm: 52000, aci: 10, premium: 1200 }, 'rgar.pdf');
  assert.strictEqual(r.wasRequested, false); assert.strictEqual(r.item, g0); assert.deepStrictEqual([g0.currentValuePm, g0.futureValuePm, g0.aci, g0.premium, g0.requested, g0.st, g0.src.kind], [31000, 52000, 10, 1200, true, 'verify', 'goal']);
  const e = docs.applyGoal(s, { kind: 'Education Goal Analysis Report', currentValuePm: 5000 }, 'e.pdf'); assert.strictEqual(e.item.kind, 'egar');
  const fresh = store.blank(); const f = docs.applyGoal(fresh, { kind: 'rgar', premium: 900 }, 'x.pdf'); assert.strictEqual(fresh.blocks.goals.items.length, 1); assert.strictEqual(f.item.premium, 900);
});

test('a reading that found nothing is recognised, so the page can say so plainly and only record the document', () => {
  assert.strictEqual(docs.isEmptyRead('fna', {}), true); assert.strictEqual(docs.isEmptyRead('fna', { lines: [] }), true); assert.strictEqual(docs.isEmptyRead('fna', { premium: 2900 }), false);
  assert.strictEqual(docs.isEmptyRead('fna', { lines: [{ type: 'household' }] }), false); assert.strictEqual(docs.isEmptyRead('proposed', { provider: 'OM' }), true); assert.strictEqual(docs.isEmptyRead('proposed', { monthly: 1 }), false);
  assert.strictEqual(docs.isEmptyRead('goals', {}), true); assert.strictEqual(docs.isEmptyRead('goals', { futureValuePm: 1 }), false); assert.strictEqual(docs.isEmptyRead('cmp', { rows: [] }), true); assert.strictEqual(docs.isEmptyRead('cmp', { reason: 'none' }), false);
  assert.strictEqual(docs.isEmptyRead('policies', {}), true); assert.strictEqual(docs.isEmptyRead('policies', { premium: 10 }), false); assert.strictEqual(docs.isEmptyRead('fna', null), true);
});

test('matching with the Fact Find: a differing surname, bank or instalment is flagged on its own line; nothing the document says is changed', () => {
  const s = filled(), q = docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '100000001', premium: 2900, lines: [
    { type: 'household', life: { lump: 800000, monthly: 5000 } },
    { type: 'child', name: 'Amy', sname: 'Clients', life: { lump: 500000, monthly: 5000 } },
    { type: 'child', name: 'Ben', sname: 'Client', life: { lump: 500000, monthly: 4500 } },
    { type: 'debt', debt: 'Home loan', bank: 'Other Bank', life: { lump: 1200000, monthly: 12000 } },
    { type: 'debt', debt: 'Car loan', bank: 'Test Bank', life: { lump: 200000, monthly: 3500 } }] }, 'q.pdf').quote;
  const probs = check.run(s).problems.filter(p => p.id === 'quote.children' || p.id === 'quote.debts'), by = id => probs.filter(p => p.line === id).map(p => p.message).join(' ');
  const L = n => q.lines.filter(l => l.type === n);
  assert.match(by(L('child')[0].id), /Amy Client: the quote has the child as "Amy Clients"; the Fact Find has the surname "Client"/);
  assert.match(by(L('child')[1].id), /Ben Client: the quote has R4,500 a month; the Fact Find has R5,000/);
  assert.match(by(L('debt')[0].id), /Home loan: the quote has the bank "Other Bank"; the Fact Find has "Test Bank"/);
  assert.match(by(L('debt')[1].id), /Car loan: the quote has an instalment of R3,500; the Fact Find has R4,000/);
  assert.strictEqual(probs.length, 4, 'one flag for each difference, none for what matches: ' + probs.map(p => p.message).join(' | '));
  assert.strictEqual(L('child')[0].sname, 'Clients', 'the document\'s own value is kept'); assert.strictEqual(calc.lineVal(L('child')[1], 'life', 'monthly'), 4500);
  const good = filled(); docs.applyQuote(good, 'fna', { insurer: 'BrightRock', number: '2', premium: 1, lines: [{ type: 'child', name: 'Amy', sname: 'Client', life: { lump: 1, monthly: 5000 } }, { type: 'child', name: 'Ben', sname: 'Client', life: { lump: 1, monthly: 5000 } },
    { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1, monthly: 12000 } }, { type: 'debt', debt: 'Car loan', bank: 'test bank ', life: { lump: 1, monthly: 4000 } }] }, 'g.pdf');
  assert.deepStrictEqual(check.run(good).problems.filter(p => p.id === 'quote.children' || p.id === 'quote.debts'), [], 'what matches (capitals and spaces aside) is not flagged');
  assert.ok(check.run(s).problems.every(p => 'line' in p), 'every problem says which line it is about, or null');
});

test('a proposed investment read from a quote is compared with what the Fact Find asked for', () => {
  const s = filled(); docs.applyProposed(s, { provider: 'Old Mutual', type: 'Retirement annuity (RA)', monthly: 5200 }, 'om.pdf');
  const p = check.run(s).problems.filter(x => x.id === 'doc.vs.factfind' && x.block === 'proposed'); assert.strictEqual(p.length, 1); assert.match(p[0].message, /the quote has a premium of R5,200 a month; the Fact Find asked for R5,000/);
  const ok = filled(); docs.applyProposed(ok, { provider: 'Old Mutual', type: 'Retirement annuity (RA)', monthly: 5000 }, 'om.pdf'); assert.strictEqual(check.run(ok).problems.filter(x => x.block === 'proposed').length, 0);
});

test('the menu dots: the shortfall is green only when the FNA has figures; the hover text and the legend say what a dot means', () => {
  const s = filled(); let r = check.run(s);
  assert.strictEqual(r.dots.shortfall, 'grey', 'no FNA yet');
  const q = store.addQuote(s, 'fna'); r = check.run(s); assert.strictEqual(r.dots.shortfall, 'grey', 'an FNA with no figures: nothing has been worked out');
  q.lines[0].life.lump = 800000; r = check.run(s); assert.strictEqual(r.dots.shortfall, 'green', 'the FNA has figures and the result is worked out');
  assert.deepStrictEqual(check.LEGEND.map(l => l[0]), ['grey', 'amber', 'green', 'na']);
  assert.match(check.dotText(s, 'shortfall', 'grey', []), /as soon as the FNA quote has figures/); assert.match(check.dotText(s, 'fna', 'green', []), /^Checked/); assert.match(check.dotText(s, 'shortfallQuote', 'na', []), /group risk/);
  assert.match(check.dotText(s, 'group', 'grey', []), /^Nothing yet/); assert.match(check.dotText(s, 'fna', 'amber', [{ block: 'fna', where: 'BrightRock FNA 1', message: 'Amy is missing.' }]), /^To check: 1 thing is flagged\. BrightRock FNA 1 Amy is missing\./);
  assert.match(check.dotText(s, 'fna', 'amber', []), /^To check: some rows came from the Fact Find/);
  const ui = app('js/ov-ui.js'); assert.ok(/check\.dotText\(state, b\.id/.test(ui) && /id="legend"/.test(ui) && /Dashed: not needed/.test(ui) && /Grey: nothing yet/.test(ui) && /Amber: to check/.test(ui) && /Green: checked/.test(ui), 'the legend and the hover text are on the page');
});

/* ---------- where "Upload from client folder" looks (a pretend tree; the real file window is in tests/browser/t-overview-studio.js) ---------- */
class FileH { constructor(name) { this.kind = 'file'; this.name = name; } }
class Dir {
  constructor(name, parent) { this.kind = 'directory'; this.name = name; this.parent = parent || null; this.kids = new Map(); }
  async *entries() { for (const [n, h] of this.kids) yield [n, h]; }
  add(...names) { let d = this; for (const n of names) d = d.kids.get(n) || (d.kids.set(n, new Dir(n, d)), d.kids.get(n)); return d; }
  file(n) { this.kids.set(n, new FileH(n)); return this; }
  async getDirectoryHandle() { throw new Error('read only'); }
}
const names = d => { const out = []; (function walk(x, p) { for (const [n, h] of x.kids) { out.push(p + n); if (h.kind === 'directory') walk(h, p + n + '/'); } })(d, ''); return out.sort(); };
const client = d => ({ rootKey: 'A', parts: ['Docs, Dina'], handle: d });

test('where each kind of document is looked for in a client\'s folder, best folder first, and nothing is changed', async () => {
  const c = new Dir('Docs, Dina'); c.add('1. Overview'); c.add('2. Fact Find'); c.add('8. Proposals'); c.add('4. Goal Analysis Reports'); c.add('3. Quotes'); c.add('7. Investments');
  c.add('Docs, Dina - (Risk Covers)', 'Comparative Quotes'); const before = names(c);
  const sub = async k => (await F.clientSubfolder(client(c), k));
  assert.deepStrictEqual((await sub('quote')).parts, ['Docs, Dina', '3. Quotes']);
  assert.deepStrictEqual((await sub('goal')).parts, ['Docs, Dina', '4. Goal Analysis Reports']);
  assert.deepStrictEqual((await sub('proposal')).parts, ['Docs, Dina', '8. Proposals'], 'a proposals folder before an investments or quotes folder');
  assert.deepStrictEqual((await sub('comparative')).parts, ['Docs, Dina', 'Docs, Dina - (Risk Covers)', 'Comparative Quotes'], 'comparative quotes: the deal folder\'s Comparative Quotes first');
  const bare = new Dir('Bare, Bob'); bare.add('1. Overview'); assert.deepStrictEqual((await F.clientSubfolder({ rootKey: 'A', parts: ['Bare, Bob'], handle: bare }, 'quote')).parts, ['Bare, Bob'], 'no such folder: the client\'s own folder');
  const onlyDeal = new Dir('Deal, Dan'); onlyDeal.add('Deal, Dan - (BR)', 'Comparative Quotes'); assert.deepStrictEqual((await F.clientSubfolder({ rootKey: 'A', parts: ['Deal, Dan'], handle: onlyDeal }, 'quote')).parts, ['Deal, Dan', 'Deal, Dan - (BR)', 'Comparative Quotes'], 'a quote with no quotes folder: the deal folder\'s Comparative Quotes');
  assert.deepStrictEqual(names(c), before, 'only reads');
  assert.ok(!/create:\s*true/.test(app('js/folders.js').slice(app('js/folders.js').indexOf('async function clientSubfolder'), app('js/folders.js').indexOf('async function findFiles'))), 'it never creates a folder');
});

test('finding the change moment pay-out guide beside a quote: by name and by the CP number, in the folder and one level inside it', async () => {
  const q = new Dir('3. Quotes'); q.file('BR FNA - 100000011 - R2900.00 - 19.11.26.pdf').file('BR CMPO - 100000011.pdf').file('BR CMPO - 100000099.pdf').file('notes.txt'); q.add('Old').file('BR CMPO - 100000012.pdf');
  const hit = await F.findFiles(q, /\.(pdf|png|jpe?g)$/i), cmpo = hit.filter(f => /cmpo|change[ _-]?moment/i.test(f.name) && (f.name.match(/\d{6,12}/g) || []).indexOf('100000011') >= 0);
  assert.deepStrictEqual(cmpo.map(f => f.name), ['BR CMPO - 100000011.pdf']); assert.deepStrictEqual(hit.map(f => f.name).sort(), ['BR CMPO - 100000011.pdf', 'BR CMPO - 100000012.pdf', 'BR CMPO - 100000099.pdf', 'BR FNA - 100000011 - R2900.00 - 19.11.26.pdf']);
  assert.deepStrictEqual(hit.filter(f => f.rel.length).map(f => f.rel.join('/') + '/' + f.name), ['Old/BR CMPO - 100000012.pdf'], 'one level inside is searched, with where it was found');
});

test('the page: an Upload from client folder button in all six blocks, the file window opens in the client\'s folder, reading is on by default', () => {
  const ui = app('js/ov-ui.js');
  assert.ok((ui.match(/data-upc=/g) || []).length >= 3 && /data-upc="proposed"/.test(ui) && /data-upc="goals"/.test(ui) && /data-upc="' \+ b\.id \+ '"/.test(ui), 'quote blocks, proposed investments and goal reports each have the button');
  assert.ok(/startIn: handle/.test(ui) && /CLIENT_KIND = \{ fna: 'quote', shortfallQuote: 'quote', reduced: 'quote', comparative: 'comparative', proposed: 'proposal', goals: 'goal' \}/.test(ui), 'the file window opens in the client\'s folder for that kind of document');
  assert.ok(/ingest\(\[file\], \{ block: block, dir: res\.handle \}\)/.test(ui), 'the document is read into the block it was picked for, with the folder to look in for the pay-out guide');
  assert.ok(!/Upload from another folder/.test(ui) && /function pickAny\(block, dir\)/.test(ui) && /pickAny\(block\)/.test(ui), 'there is one upload button per block: when the client\'s folder is not found the normal file window opens by itself');
  assert.ok(/!== '0'/.test(ui), 'reading is on unless switched off');
});
