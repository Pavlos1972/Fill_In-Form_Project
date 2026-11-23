/* The Client Overview Studio 0.92 on the real page (Paul's third round of 23 November, after he tested 0.91 on a real client), over a REAL directory tree in the browser's private file system (as t-overview-round09b.js):
   a figure the quote does not print says "Not found" in its box and the line stays to check with its reason (never an empty box ticked green), a need with a lump sum of 0 has an income portion of 0, the additional expense line has no
   life cover (N/A), the death-related income portion points to the BrightRock email, the quote wins where it differs from the Fact Find, an older quote (0.9) is brought up to date when its file opens, a quote loaded again says
   "Already loaded", only a real difference, a missing guide or a missing figure holds a quote amber, the Fact Find's own notes are read for company, product and premium (only those notes leave the page), and the Presentation's
   current policies table has roomy rows with a long ACI wording small and cut. The Anthropic call is a stand-in that answers by what is in the document. Invented client ("Round, Rita"): no real client data.
   Screenshots (deviceScaleFactor 2): r3-fna, r3-checks, r3-healed, r3-notes, r3-pres-policies. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const TREE = {
  NB: { 'Round, Rita': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).pdf': 'FFPDF', 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).json': '{}' },
    '3. Quotes': { 'BR FNA - 100000071 - 19.11.26.pdf': 'FNA71', 'BR CMPO - 100000071.pdf': 'CMP71' }, '6. Policy Schedules': { 'Liberty schedule.pdf': 'LIB' } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const base = { fname: v('Rita'), sname: v('Round'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') };
const LISTS = { kids: [{ d: { name: 'Zoe', sname: 'Round', cost: 'R 500.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 9 000.00', bal: 'R 900 000.00', term: '240' } }], risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }], grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] };
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: base, l: LISTS };
const FFJ2 = { app: 'wr-fact-find', schema: '5.4', f: Object.assign({}, base, { ma: v('Medical aid'), n_ma: v('Test Health Scheme, Saver plan, about R 1 800 a month.'), sti: v('Yes'), n_sti: v('Test Short-term Co, total R 2 539 p.m.') }), l: LISTS };
const LONG_ACI = 'EACH YEAR WITH AGE AND BENEFIT INCREASES on policy anniversary';
const READ = {
  FNA71: { insurer: 'BrightRock', number: '100000071', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, premium: 2900, abi: 5, servicing: false, disabilityAge: 65, lines: [
    { type: 'household', life: { lump: 0 }, abi: 5 },
    { type: 'child', name: 'Zoe', sname: 'Round', life: { lump: 100000, monthly: 500 }, abi: 5 },
    { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 900000 }, abi: 0 },
    { type: 'death', life: { lump: 300000 }, abi: 5 },
    { type: 'dread', life: { lump: 777, monthly: 7 }, sev: { lump: 500000 }, abi: 5 }] },
  CMP71: { number: '100000071', activationDate: '01/02/2028', rows: [{ key: 'total', today: 30000, projected: 80000 }] },
  LIB: { insurer: 'Liberty', product: 'Liberty Life Plan', policyNo: 'L-900', premium: 900, aciText: LONG_ACI,
    benefits: { life: 'Whole of life', sev: 'Living Lifestyle Plus, standalone, whole of life', lsd: 'Absolute Protector Plus, OOD, to age 65', ip: 'After 24 months, to age 65' },
    lines: [{ type: 'other', label: 'Cover', life: { lump: 2044346.02 }, sev: { lump: 817738.41 }, lsd: { lump: 1500000 }, ip: { monthly: 25000 }, waiting: '24 months' }] },
  __NOTES: { items: { medical: { company: 'Test Health Scheme', product: 'Saver plan', premium: 1800 }, shortterm: { company: 'Test Short-term Co', premium: 2539 } } }
};
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = READ_ARG => {
    window.__api = []; window.__notesApi = []; window.__read = READ_ARG;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let answer;
      if (c0.type === 'text') { if (window.__throwNotes) throw new Error('boom'); window.__notesApi.push(c0.text); answer = window.__read.__NOTES; }
      else { const text = atob(c0.source.data); window.__api.push(text); answer = window.__read[text] || {}; }
      return (window.__delay ? new Promise(r => setTimeout(r, window.__delay)) : Promise.resolve()).then(() => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 5, output_tokens: 5 } }) }));
    };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, READ);
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(x); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), x); } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p);
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const st = () => p.evaluate(() => OV.app.state);
  const dot = id => p.evaluate(i => document.querySelector('[data-dot="' + i + '"]').className.replace('dot ', ''), id);
  const quiet = () => p.evaluate(() => { document.querySelector('#toast').hidden = true; });
  const waitDone = () => p.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ));

  /* ---- 1. a fresh load: the lines that lack a figure ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist'); await p.click('dialog.fdlg [data-yes]');
  await waitDone(); await p.waitForTimeout(400);
  const q = (await st()).blocks.fna.quotes[0], by = t => q.lines.filter(l => l.type === t)[0];
  ok(by('household').life.lump === 0 && by('household').life.monthly === 0, '1. a household need with a lump sum of 0 has an income portion of 0 (not an empty box): ' + JSON.stringify(by('household').life));
  ok(by('debt').life.lump === 900000 && by('debt').life.monthly === 9000 && by('debt').via['life.monthly'] === 'from the Fact Find', '1. (0.93) the debt line, whose instalment the quote does not print, is filled from the Fact Find and says so: ' + JSON.stringify(by('debt').life));
  ok(by('death').life.lump === 300000 && by('death').life.monthly === 'Not found', '1. the death-related line has no income portion on the quote: Not found');
  ok(by('dread').life === 'N/A' && by('dread').sev.lump === 500000, '1. the additional expense line has no life cover (N/A, whatever the reading said) and keeps its severe illness amount');
  ok(by('household').st === 'confirmed' && by('child').st === 'confirmed' && by('child').match === 'factfind' && by('dread').st === 'confirmed', '1. the lines with every figure are confirmed (household, child, additional expense)');
  ok(by('debt').st === 'confirmed' && by('death').st === 'verify', '1. the death-related line, with its figure still missing, stays to check (never ticked); the debt line, now with every figure, is ticked');
  ok(await dot('fna') === 'amber' && q.st === 'verify', '1. the FNA is amber, because figures are missing');
  const probs = await p.evaluate(() => OV.check.run(OV.app.state).problems.filter(x => x.id === 'figures').map(x => x.message));
  ok(!probs.some(m => /^Debt Home loan/.test(m)) && probs.some(m => /^Death-related needs: the income portion p\.m\. is not on the quote: see the BrightRock email\.$/.test(m)), '1. the Checks say which figure and where to look: ' + probs.join(' | '));
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(200); await quiet();
  const cells = await p.evaluate(() => { const t = [...document.querySelectorAll('#main .ovt tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()); return { nf: document.querySelectorAll('#main .ovt input[value="Not found"], #main .ovt [data-v="Not found"]').length, rows: t.length, txt: document.querySelector('#main').textContent }; });
  ok(await p.evaluate(() => [...document.querySelectorAll('#main input')].some(i => i.value === 'Not found')) && /N\/A/.test(cells.txt), '1. the boxes show "Not found" (the death-related income portion) and N/A on the screen');
  const dreadRow = await p.evaluate(() => { const rows = [...document.querySelectorAll('#main .ovt tbody tr')].filter(tr => /Additional expense/.test(tr.textContent)); return rows.length ? rows[0].cells[2].textContent.trim() + '|' + rows[0].querySelectorAll('input').length : ''; });
  ok(/N\/A/.test(dreadRow), '1. the additional expense line has N/A in its life cover cell: ' + dreadRow);
  await p.screenshot({ path: out + '/r3-fna.png', fullPage: false });
  const err = await p.evaluate(() => { const bars = [...document.querySelectorAll('#nav .prog:not([hidden])')].map(e => e.className + '|' + e.textContent); return bars; });
  ok(err.some(t => /done/.test(t) && /Downloaded and populated/.test(t)), '1. the FNA block has its status bar: Downloaded and populated: ' + err.join(' ; '));
  await p.evaluate(() => { const d = document.querySelector('#checks details.allchecks'); if (d) d.open = true; });
  await p.screenshot({ path: out + '/r3-checks.png', clip: { x: 1000, y: 0, width: 440, height: 1000 } });

  /* ---- 2. loading the same folder again: the quote is "Already loaded", checked again, not read again ---- */
  const before = await p.evaluate(() => window.__api.filter(t => t === 'FNA71').length);
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist'); await p.click('dialog.fdlg [data-yes]');
  await waitDone(); await p.waitForTimeout(400);
  const after = await p.evaluate(() => window.__api.filter(t => t === 'FNA71').length);
  ok(after === before, '2. the same quote is not read a second time (' + before + ' > ' + after + ' calls)');
  ok(((await st()).blocks.fna.quotes || []).length === 1, '2. and there is still one quote');
  const logs = await p.evaluate(() => OV.app.lastLog().map(x => x.msg));
  ok(logs.some(m => /already loaded as/.test(m)), '2. the load says it is already loaded: ' + logs.filter(m => /already loaded/.test(m)).join(' | ').slice(0, 120));
  ok(await dot('fna') === 'amber', '2. the quote is still amber (its figures are still missing)');

  /* ---- 3. an older quote (0.9) heals when its file opens: ticked by the quote, dread without life cover ---- */
  const healed = await p.evaluate(() => {
    const s = OV.app.state, old = JSON.parse(OV.store.toJSON(s)), qq = old.blocks.fna.quotes[0];
    qq.lines.forEach(l => { l.st = 'verify'; delete l.match; l.by = 'page'; if (l.type === 'dread') l.life = { lump: null, monthly: null }; if (l.type === 'household') l.life = { lump: 0, monthly: null }; if (l.type === 'debt') l.life.monthly = 9000; if (l.type === 'death') l.life.monthly = 1500; });
    qq.st = 'verify'; qq.cmp = qq.cmp || { number: '100000071', rows: [], st: 'verify' };
    const opened = OV.store.fromJSON(JSON.stringify(old)), n = OV.check.settleAll(opened); OV.app.setState(opened);
    const nq = opened.blocks.fna.quotes[0];
    return { n, st: nq.lines.map(l => l.type[0] + ':' + l.st), dread: nq.lines.filter(l => l.type === 'dread')[0].life, hh: nq.lines.filter(l => l.type === 'household')[0].life.monthly, row: nq.st };
  });
  ok(healed.n > 0 && healed.dread === 'N/A' && healed.hh === 0, '3. an older file: the additional expense line loses its life cover and the household income portion becomes 0: ' + JSON.stringify(healed));
  ok(healed.st.every(s => /confirmed$/.test(s)) && healed.row === 'confirmed', '3. every line is ticked by the quote and the row is accepted: ' + healed.st.join(' '));
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(250); await quiet();
  ok(await p.evaluate(() => document.querySelectorAll('#main .tickok').length) >= 4, '3. the lines show the green tick');
  await p.screenshot({ path: out + '/r3-healed.png', fullPage: false });

  /* ---- 4. the quote wins: a child whose cost differs ---- */
  const win = await p.evaluate(() => { const s = OV.app.state, l = s.blocks.fna.quotes[0].lines.filter(x => x.type === 'child')[0]; l.life.monthly = 650; l.st = 'verify'; delete l.match; OV.check.autoMatch(s, s.blocks.fna.quotes[0]);
    return { st: l.st, msg: OV.check.run(s).problems.filter(x => x.line === l.id).map(x => x.message).join(' ') }; });
  ok(win.st === 'verify' && /the quote wins: correct the Fact Find\)\.$/.test(win.msg), '4. a child whose cost differs from the Fact Find stays to check and says the quote wins: ' + win.msg);

  /* ---- 5. the Fact Find's notes are read for company, product and premium (only those notes are sent) ---- */
  const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message)); p2.on('dialog', d => d.accept());
  await p2.goto(addr + 'overview.html'); await p2.waitForTimeout(900);
  if (await p2.$('#restoreDraft')) await p2.click('#restoreNew');
  await p2.evaluate(() => { OV.app.setState(OV.store.blank()); FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }); });
  await p2.setInputFiles('#ffIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FFJ2)) });
  await p2.waitForFunction(() => window.__notesApi.length >= 1, null, { timeout: 15000 }).catch(() => {});
  await p2.evaluate(() => { document.querySelector('#toast').hidden = true; });
  const sent = await p2.evaluate(() => window.__notesApi.slice());
  ok(sent.length === 1 && /^Medical aid: Test Health Scheme, Saver plan/.test(sent[0].split('THE NOTES:\n')[1] || '') && /Short-term insurance: Test Short-term Co/.test(sent[0]), '5. the notes were sent to Claude: ' + (sent.length ? sent[0].split('THE NOTES:\n')[1].replace(/\n/g, ' / ') : 'nothing sent'));
  ok(sent.length === 1 && !/Rita|Round|90 000|@|\d{10}/.test(sent[0].split('THE NOTES:\n')[1] || 'x'), '5. nothing but the four notes leaves the page (no name, income, number or address)');
  await p2.waitForTimeout(500);
  const oth = await p2.evaluate(() => OV.app.state.blocks.other.items.map(i => ({ k: i.key, c: i.company, p: i.product, pr: i.premium, st: i.st })));
  const it = k => oth.filter(i => i.k === k)[0];
  ok(it('medical').c === 'Test Health Scheme' && it('medical').p === 'Saver plan' && it('medical').pr === 1800, '5. the medical aid company, product and premium were filled from its note: ' + JSON.stringify(it('medical')));
  ok(it('shortterm').c === 'Test Short-term Co' && it('shortterm').pr === 2539, '5. the short-term company and premium too: ' + JSON.stringify(it('shortterm')));
  ok(it('medical').st === 'ff' && it('shortterm').st === 'ff', '5. they are still "from the Fact Find", waiting for a click to confirm');
  await p2.evaluate(() => OV.app.go('other')); await p2.waitForTimeout(250);
  await p2.evaluate(() => { document.querySelector('#toast').hidden = true; });
  await p2.screenshot({ path: out + '/r3-notes.png', fullPage: false });
  const sentBefore = sent.length; await p2.evaluate(() => OV.app.checkPass({ explicit: true })); await p2.waitForTimeout(400);
  ok((await p2.evaluate(() => window.__notesApi.length)) === sentBefore, '5. the same notes are not sent a second time');

  /* ---- 5b. a notes reading that fails ends its bar with the reason and may be tried again (a throw before the call even starts included) ---- */
  const p3 = await ctx.newPage(); p3.on('dialog', d => d.accept());
  await p3.goto(addr + 'overview.html'); await p3.waitForTimeout(900);
  if (await p3.$('#restoreDraft')) await p3.click('#restoreNew');
  await p3.evaluate(() => { OV.app.setState(OV.store.blank()); FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }); window.__throwNotes = true; });
  await p3.setInputFiles('#ffIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FFJ2)) });
  await p3.waitForFunction(() => { const e = document.querySelector('[data-prog="other"]'); return e && !e.hidden && /error/.test(e.className); }, null, { timeout: 15000 }).catch(() => {});
  const bar = await p3.evaluate(() => { const e = document.querySelector('[data-prog="other"]'); return e ? e.className + '|' + e.textContent : ''; });
  ok(/error/.test(bar) && /Could not read the notes: boom/.test(bar) && !/reading/.test(bar.split('|')[0]), '5b. a notes reading that fails ends its bar and says why: ' + bar);
  await p3.evaluate(() => { window.__throwNotes = false; });
  await p3.setInputFiles('#ffIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FFJ2)) });
  await p3.waitForFunction(() => window.__notesApi.length >= 1, null, { timeout: 15000 }).catch(() => {});
  await p3.waitForTimeout(500);
  ok(await p3.evaluate(() => window.__notesApi.length) === 1 && await p3.evaluate(() => OV.app.state.blocks.other.items.filter(i => i.key === 'medical')[0].company) === 'Test Health Scheme', '5b. the next fill tries again and fills the boxes');

  /* ---- 6. the Presentation: roomy policies table, a long ACI wording small and cut ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(200);
  ok(await p.evaluate(() => (OV.app.state.blocks.policies.items || []).some(i => i.aciText === 'EACH YEAR WITH AGE AND BENEFIT INCREASES on policy anniversary')), '6. the Liberty policy was read with its long ACI wording');
  await p.click('#btnPresent'); await p.waitForTimeout(500); await p.click('#pres .ptab[data-tab="policies"]'); await p.waitForTimeout(600);
  const pr = await p.evaluate(() => {
    const t = document.querySelector('#pres .ptbl.pols'); if (!t) return null;
    const rows = [...t.querySelectorAll('tbody tr')].map(tr => Math.round(tr.getBoundingClientRect().height));
    const aci = t.querySelector('.a.aci'); const cs = aci ? getComputedStyle(aci) : null, td = aci && aci.closest('td');
    const r = aci && aci.getBoundingClientRect(), tr = td && td.getBoundingClientRect();
    return { rows, pad: getComputedStyle(t.querySelector('td')).paddingTop, fs: cs && cs.fontSize, clamp: cs && (cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp')), title: aci && aci.title, inside: r && tr && r.left >= tr.left - 0.5 && r.right <= tr.right + 0.5 && r.bottom <= tr.bottom + 0.5, aciH: r && Math.round(r.height) };
  });
  ok(pr && pr.rows.every(h => h >= 90), '6. the policies rows are roomy: ' + (pr && pr.rows.join(' ')) + ' px (the least is 90)');
  ok(pr && pr.pad === '15px' && parseFloat(pr.fs) <= 12 && pr.clamp === '4', '6. more padding, the ACI wording small and cut at four lines: padding ' + (pr && pr.pad) + ', ' + (pr && pr.fs) + ', clamp ' + (pr && pr.clamp));
  ok(pr && pr.inside && /AGE AND BENEFIT INCREASES on policy anniversary/.test(pr.title), '6. the long wording stays inside its cell and the whole wording is the hover text: ' + (pr && pr.title));
  ok(pr && Math.max.apply(null, pr.rows) - Math.min.apply(null, pr.rows) <= 60, '6. a long wording does not stretch its row (rows ' + (pr && pr.rows.join(' ')) + ')');
  await p.screenshot({ path: out + '/r3-pres-policies.png' });
  await p.click('#pBtnClose'); await p.waitForTimeout(300);

  ok(!errs.length && !errs2.length, '7. no script errors' + (errs.length ? ': ' + errs[0] : errs2.length ? ': ' + errs2[0] : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
