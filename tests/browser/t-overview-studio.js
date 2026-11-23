/* The Client Overview Studio (page 0.6) on the real page, over a REAL directory tree in the browser's private file system (the real folder calls run: listing the client's folder, choosing its quotes folder, finding the
   pay-out guide beside the quote). The folder windows and the file window are stand-ins (as in t-overview-folders.js, which says why the connection is stored the way it is here); the Anthropic call is replaced by a
   stand-in that answers by the kind of document, so no document leaves the machine. Covered: the new name, reading on by default, the file window opening in the client's quotes / goal analysis / proposals folder,
   the quote read into every box (kind, lines, premium) with its pay-out guide of the same CP number read too (and the other CP number's not), the comparison with the Fact Find flagging a differing surname, an unknown
   child, a differing bank and instalment amber ON THEIR LINES with nothing overwritten, a goal analysis report, a proposed investment compared with what the Fact Find asked for, a reading that found nothing,
   the menu legend, the hover text and the shortfall dot. Invented client ("Docs, Dina"): no real client data. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const TREE = {
  NB: { 'Docs, Dina': { '1. Overview': {}, '2. Fact Find': {},
    '3. Quotes': { 'BR FNA - 100000011 - R2900.00 - 19.11.26.pdf': '%PDF-1.4 the fna', 'BR CMPO - 100000011.pdf': '%PDF-1.4 the guide', 'BR CMPO - 100000099.pdf': '%PDF-1.4 another clients guide' },
    '4. Goal Analysis Reports': { 'RGAR - Dina Docs.pdf': '%PDF-1.4 the rgar' }, '8. Proposals': { 'OM Optimal RA quote 12345678.pdf': '%PDF-1.4 the proposal' }, '1. ON HOLD': {} },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Dina' }, sname: { v: 'Docs' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' }, rgar_req: { v: 'Not required' }, egar_req: { v: 'Not required' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Docs', cost: 'R 5 000.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_ra: [], inv: [],
    raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: 'R 5 000.00', lump: '' } }], invq: [], bfred: [] } };
const QUOTE = { insurer: 'BrightRock', number: '100000011', date: '19/11/2026', rates: 'Non-smoker rates', aci: 10, premium: 2900, servicing: true, disabilityAge: 65, lines: [
  { type: 'household', term: 'Standalone', waiting: '3 months', life: { lump: 800000, monthly: 5000 }, lsd: { lump: 900000, monthly: 12500 }, ip: { monthly: 22500 }, abi: 5 },
  { type: 'child', name: 'Amy', sname: 'Docz', term: 'Age 24', life: { lump: 500000, monthly: 5000 }, lsd: { lump: 450000, monthly: 5000 }, abi: 5 },
  { type: 'child', name: 'Cleo', sname: 'Docs', term: 'Age 24', life: { lump: 400000, monthly: 4000 }, abi: 5 },
  { type: 'debt', debt: 'Home loan', bank: 'Other Bank', term: '180 months', life: { lump: 1200000, monthly: 11000 }, lsd: { lump: 1200000, monthly: 11000 }, ip: { monthly: 11000 }, abi: 0 },
  { type: 'death', life: { lump: 600000, monthly: 7500 }, abi: 3 }, { type: 'dread', sev: { lump: 500000 }, abi: 3 }] };
const CMP = { number: '100000011', activationDate: '01/02/2028', reason: null, rows: [{ key: 'total', today: 30000, projected: 80000 }, { key: 'retirement', today: 20000, projected: 60000, payoutDate: '31/12/2046' }, { key: 'child', name: 'Amy', sname: 'Docz', today: 5000, projected: 10000, payoutDate: '01/01/2045' }] };
const GOAL = { kind: 'rgar', currentValuePm: 31000, futureValuePm: 52000, aci: 10, premium: 1200 };
const PROP = { provider: 'Old Mutual', type: 'Retirement annuity (RA)', number: '12345678', contribution: 'monthly', monthly: 5200, boostPct: 4, netInvested: 4800, aci: 10 };

srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = () => {
    window.__calls = []; window.__picks = []; window.__api = []; window.__kinds = {}; window.__open = null;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    window.showOpenFilePicker = async o => { window.__picks.push({ startIn: o && o.startIn ? o.startIn.name : null, id: o && o.id ? o.id : null, multiple: o && o.multiple }); if (!window.__open) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return [window.__open]; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), prompt = body.messages[0].content[1].text;
      const kind = /change moment pay-out guide/.test(prompt) ? 'cmp' : /quote or proposal for an investment/.test(prompt) ? 'proposal' : /Goal Analysis Report/.test(prompt) ? 'goal' : /insurance quote/.test(prompt) ? 'quote' : 'other';
      window.__api.push({ kind, key: opt.headers['x-api-key'], text: atob(body.messages[0].content[0].source.data) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(window.__kinds[kind] || {}) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
    };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(v) {
      fo = v;
      v.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      v.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });

  /* ---- 1. no folders connected: the page says so and does not open anything ---- */
  const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c0.addInitScript(init);
  const p0 = await c0.newPage(); p0.on('dialog', d => d.accept());
  await p0.goto(base + 'overview.html'); await p0.waitForTimeout(500);
  ok(await p0.evaluate(() => document.title === 'Client Overview Studio' && document.querySelector('h1').textContent === 'Client Overview Studio'), '1. the page is called Client Overview Studio in its heading and its tab');
  ok(await p0.evaluate(() => OV.app.aiOn() && !FF.lookup.getSettings().apiKey), '1. reading is ON to start with (and there is no key yet)');
  await p0.evaluate(() => { OV.app.fillFactFindText(JSON.stringify({ app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Dina' }, sname: { v: 'Docs' } }, l: { kids: [], debts: [], risk: [], grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } }), 'ff.json'); OV.app.go('fna'); });
  await p0.click('[data-upc=fna]'); await p0.waitForTimeout(400);
  ok(/Nothing was chosen/.test(await p0.evaluate(() => document.querySelector('#toast').textContent)) && await p0.evaluate(() => window.__picks.length) === 1 && await p0.evaluate(() => window.__picks[0].startIn) === null, '1. with no folders connected the normal file window opens by itself (and closing it chooses nothing)');
  await c0.close();

  /* ---- 2. connect the folders (on the Risk Application, as before), then the Studio ---- */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await ctx.addInitScript(init);
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(base + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, v] of Object.entries(s)) { if (typeof v === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(v); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), v); } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(base + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); await p.evaluate(() => OV.app.openAll());          // the page starts folded (See more); this test is about what is inside
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ));
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' })); await p.evaluate(() => OV.app.redraw());
  const st = () => p.evaluate(() => OV.app.state), toast = () => p.evaluate(() => document.querySelector('#toast').textContent), side = () => p.evaluate(() => OV.app.lastLog().map(x => x.msg).join(' ') + ' ' + document.querySelector('#toast').textContent);
  const open = names => p.evaluate(async n => { let d = await navigator.storage.getDirectory(); for (const x of n.slice(0, -1)) d = await d.getDirectoryHandle(x); window.__open = await d.getFileHandle(n[n.length - 1]); }, names);
  const kinds = o => p.evaluate(o => { window.__kinds = o; }, o), picks = () => p.evaluate(() => window.__picks), api = () => p.evaluate(() => window.__api);
  const factsBefore = JSON.stringify((await st()).factFind.facts);
  ok(await p.evaluate(() => OV.app.aiOn() && !!FF.lookup.getSettings().apiKey), '2. with a key, reading is on');

  /* the dots and what they mean, before anything is filled */
  const nav = await p.evaluate(() => ({ legend: document.querySelector('#legend').innerText.replace(/\s+/g, ' '), titles: [...document.querySelectorAll('#nav button[data-block]')].map(x => x.title).filter(Boolean).length, sf: document.querySelector('[data-dot=shortfall]').className, sfTitle: document.querySelector('[data-dot=shortfall]').closest('button').title }));
  ok(/Grey: nothing yet/.test(nav.legend) && /Amber: to check/.test(nav.legend) && /Green: checked/.test(nav.legend) && /Dashed: not needed/.test(nav.legend), '3. a legend under the menu says what the dots mean: ' + nav.legend);
  ok(nav.titles === 11 && /grey/.test(nav.sf) && /as soon as the FNA quote has figures/.test(nav.sfTitle), '3. every block in the menu has a hover text, and the shortfall dot is grey while the FNA has no figures');

  /* ---- 4. an FNA from the client's folder: the file window opens in 3. Quotes; the quote and its guide are read ---- */
  await p.evaluate(() => OV.app.go('fna'));
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-upc]')].map(x => x.textContent).join('|')) === 'Upload from client folder…', '4. the FNA block has Upload from client folder…');
  await open(['NB', 'Docs, Dina', '3. Quotes', 'BR FNA - 100000011 - R2900.00 - 19.11.26.pdf']); await kinds({ quote: QUOTE, cmp: CMP });
  await p.click('[data-upc=fna]'); await p.waitForTimeout(1800);
  const pk = await picks(); ok(pk.length === 1 && pk[0].startIn === '3. Quotes' && pk[0].multiple === false && pk[0].id === null, '4. the file window opened in the client\'s folder 3. Quotes: ' + JSON.stringify(pk));
  const calls = await api();
  ok(calls.map(c => c.kind).join() === 'quote,cmp' && calls[0].text === '%PDF-1.4 the fna' && calls[1].text === '%PDF-1.4 the guide' && calls.every(c => c.key === 'sk-test-key'), '4. the quote was read, then the pay-out guide of the SAME CP number (not the other client\'s): ' + calls.map(c => c.kind + ':' + c.text).join(' | '));
  let s = await st(), q = s.blocks.fna.quotes[s.blocks.fna.quotes.length - 1];
  ok(q.number === '100000011' && q.date === '19/11/2026' && q.rates === 'Non-smoker rates' && q.aci === 10 && q.premium === 2900 && q.servicing === true && q.disabilityAge === 65, '4. every box of the header was filled: number, date, rates, ACI, premium, kind (servicing), disability age');
  const hh = q.lines.filter(l => l.type === 'household')[0];
  ok(q.lines.length === 6 && hh.term === 'Standalone' && hh.waiting === '3 months' && hh.life.lump === 800000 && hh.life.monthly === 5000 && hh.lsd.monthly === 12500 && hh.ip.monthly === 22500 && hh.abi === 5, '4. every line was filled: lump sum, monthly figure, term, waiting period, ABI');
  ok(q.cmp && q.cmp.rows.length === 3 && q.cmp.number === '100000011' && q.cmp.st === 'verify' && q.cmp.src.file === 'BR CMPO - 100000011.pdf' && q.cmp.rows[1].projected === 60000, '4. the change moment pay-out was filled from the guide, amber, with its file');
  ok(!q.lines.some(l => l.st === 'confirmed' && l.by !== 'page') && q.by === 'page' && q.lines.every(l => l.st === 'verify' || l.match === 'quote' || l.match === 'factfind'), '4. nothing read is marked as checked by a person: only the page confirms a line (it is in the quote, or it matches the Fact Find)');
  const msg = await side();
  ok(/Compared with the Fact Find \(1 children, 1 debts\)/.test(msg) && /differences are flagged amber/.test(msg) && /change moment pay-out is filled in/.test(msg), '4. the Documents card says it compared with the Fact Find and what it flagged: ' + msg.slice(0, 260));
  const flags = await p.evaluate(() => [...document.querySelectorAll('.qcard:last-of-type tr.ffdiff')].map(r => ({ need: (r.querySelector('.need').innerText + ' ' + [...r.querySelectorAll('.need input')].map(i => i.value).join(' ')).replace(/\s+/g, ' ').trim(), title: r.title })));
  ok(flags.length === 3 && flags.some(f => /Amy/.test(f.need) && /surname "Docs"/.test(f.title)) && flags.some(f => /Cleo/.test(f.need) && /not in the Fact Find/.test(f.title)) && flags.some(f => /Home loan/.test(f.need) && /bank "Other Bank"/.test(f.title) && /instalment of R11,000; the Fact Find has R12,000/.test(f.title)), '4. the lines that differ are marked amber with what differs: ' + JSON.stringify(flags.map(f => f.need)));
  ok(JSON.stringify((await st()).factFind.facts) === factsBefore && q.lines.filter(l => l.type === 'child')[0].sname === 'Docz', '4. nothing was overwritten: the Fact Find is as it was and the document\'s own surname is kept');
  const chk = await p.evaluate(() => document.querySelector('#checks').textContent);
  ok(/Amy/.test(chk) && /Cleo/.test(chk), '4. the Checks list the differences too');
  const dots = await p.evaluate(() => ({ sf: document.querySelector('[data-dot=shortfall]').className, fna: document.querySelector('[data-dot=fna]').className, fnaTitle: document.querySelector('[data-dot=fna]').closest('button').title }));
  ok(/green/.test(dots.sf) && /amber/.test(dots.fna) && /^To check: \d+ things? (is|are) flagged/.test(dots.fnaTitle), '4. once the FNA has figures the shortfall dot is green; the FNA dot is amber with its reason on hover: ' + dots.fnaTitle.slice(0, 90));
  await p.screenshot({ path: out + '/studio-fna.png', fullPage: true });

  /* ---- 5. a goal analysis report and a proposed investment from their folders ---- */
  await p.evaluate(() => OV.app.go('goals'));
  await open(['NB', 'Docs, Dina', '4. Goal Analysis Reports', 'RGAR - Dina Docs.pdf']); await kinds({ goal: GOAL });
  await p.click('[data-upc=goals]'); await p.waitForTimeout(1200);
  s = await st(); const rg = s.blocks.goals.items.filter(g => g.kind === 'rgar')[0];
  ok((await picks())[1].startIn === '4. Goal Analysis Reports' && rg.currentValuePm === 31000 && rg.futureValuePm === 52000 && rg.aci === 10 && rg.premium === 1200 && rg.requested === true && rg.st === 'verify' && rg.src.kind === 'goal', '5. the goal analysis report was read from the goal analysis folder into the RGAR row, amber');
  ok(/The Fact Find said it was not requested/.test(await side()), '5. and it says the Fact Find had it as not requested');
  await p.evaluate(() => OV.app.go('proposed'));
  await open(['NB', 'Docs, Dina', '8. Proposals', 'OM Optimal RA quote 12345678.pdf']); await kinds({ proposal: PROP });
  const n0 = (await st()).blocks.proposed.items.length;
  await p.click('[data-upc=proposed]'); await p.waitForTimeout(1200);
  s = await st(); const pr = s.blocks.proposed.items.filter(i => !i.removed && i.quote === '12345678')[0];
  ok((await picks())[2].startIn === '8. Proposals' && s.blocks.proposed.items.length === n0 && pr && pr.type === 'Retirement annuity (RA)' && pr.monthly === 5200 && pr.boostPct === 4 && pr.netInvested === 4800 && pr.aci === 10 && pr.st === 'verify' && pr.ffKey, '5. the proposal was read from the proposals folder into the row the Fact Find asked for (no second row)');
  ok(/the quote has a premium of R5,200 a month; the Fact Find asked for R5,000/.test(await p.evaluate(() => document.querySelector('#checks').textContent)), '5. and the difference from the Fact Find\'s request is flagged');

  /* ---- 6. a reading that found nothing; a window that is closed ---- */
  await p.evaluate(() => OV.app.go('reduced'));
  await open(['NB', 'Docs, Dina', '3. Quotes', 'BR FNA - 100000011 - R2900.00 - 19.11.26.pdf']); await kinds({ quote: {} });
  await p.click('[data-upc=reduced]'); await p.waitForTimeout(1200);
  ok(/found no figures in it/.test(await side()) && (await st()).blocks.reduced.quotes.length === 1 && (await st()).blocks.reduced.quotes[0].premium === null, '6. a reading that found nothing says so, and the document is only recorded');
  await p.evaluate(() => { window.__open = null; }); const nq = (await st()).blocks.reduced.quotes.length;
  await p.click('[data-upc=reduced]'); await p.waitForTimeout(800);
  ok(/Nothing was chosen/.test(await toast()) && (await st()).blocks.reduced.quotes.length === nq, '6. closing the file window changes nothing');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-upc]')].length) >= 1 && await p.evaluate(() => ['shortfallQuote', 'comparative'].every(id => { OV.app.go(id); return !!document.querySelector('[data-upc="' + id + '"]'); })), '6. the shortfall and comparative blocks have the button too');
  ok(errs.length === 0, '7. no page error: ' + errs.join(' | '));
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
