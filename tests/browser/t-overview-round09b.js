/* The Client Overview Studio 0.91 on the real page (Paul's second round of 23 November, after he tested 0.9 on a real client), over a REAL directory tree in the browser's private file system (as t-overview-load.js): no block says
   "nothing found" before its search has finished (a neutral waiting / searching bar and no red dot until then), the "What was loaded" pop-up is gone, a policy that was just read stays closed, the lines a quote gives are confirmed by the
   quote (a child that is not in the Fact Find stays to check), block 11 is filled from the Fact Find and from the newest Follow-Up Summary Notes after it (each part of a note says where it came from), a short description sits under each
   benefit amount (entry screen, PDF, Presentation) and no amount of the Presentation's policies table touches the next column. The Anthropic call is a stand-in that answers by what is in the document (no document leaves the machine).
   Invented client ("Round, Rita"): no real client data. Screenshots (deviceScaleFactor 2): r2-waiting, r2-after, r2-policies, r2-fna, r2-block11, r2-pres-policies. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const NOTES28 = 'Follow-Up Appointment Summary Notes - 28.11.26 - (Rita Round).pdf', NOTES10 = 'Follow-Up Appointment Summary Notes - 10.11.26 - (Rita Round).pdf';
const TREE = {
  NB: { 'Round, Rita': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).pdf': 'FFPDF', 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).json': '{}', [NOTES28]: 'FU28', [NOTES10]: 'FU10', 'Teams transcript 20.11.26.pdf': 'TR' },
    '3. Quotes': { 'BR FNA - 100000061 - 19.11.26.pdf': 'FNA61' }, '6. Policy Schedules': { 'Liberty schedule.pdf': 'LIB' } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Rita'), sname: v('Round'), net: v('R 40 000.00'), ip_age: v('65'), date: v('20/11/2026'),
  ma: v('Medical aid'), ma_prov: v('Test Health Scheme'), ma_plan: v('Test Saver'), ma_broker: v('Other broker'), n_ma: v('Premium paid by the employer.'),
  gap: v('Yes'), gap_prov: v('Test Gap Cover'), gap_broker: v('Paul K'), n_gap: v('Quote requested.'),
  will: v('Yes'), will_up: v('No'), will_where: v('Capital Legacy'), will_broker: v('Other broker'), will_date: v('01/03/2019'), n_will: v('Wants the guardian changed.'), ref_will: v('Capital Legacy to contact client'),
  sti: v('Yes'), sti_broker: v('Cameron Maritz'), sti_car: v('Yes'), sti_house: v('Yes'), sti_struct: v('No'), sti_personal: v('R 2 539.00'), n_sti: v('Two cars on the policy.'), ref_sti: v('Cameron to contact client') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }], grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
const READ = {
  FNA61: { insurer: 'BrightRock', number: '100000061', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, premium: 2900, abi: 5, servicing: false, disabilityAge: 65, lines: [
    { type: 'household', life: { lump: 800000, monthly: 5000 }, abi: 5 }, { type: 'death', life: { lump: 300000, monthly: 1000 }, abi: 5 }, { type: 'dread', sev: { lump: 500000 }, abi: 5 }, { type: 'child', name: 'Zoe', sname: 'Round', life: { lump: 100000, monthly: 500 }, abi: 5 }] },
  LIB: { insurer: 'Liberty', product: 'Liberty Life Plan', policyNo: 'L-900', premium: 900,
    benefits: { life: 'Whole of life', sev: 'Living Lifestyle Plus, standalone, whole of life', lsd: 'Absolute Protector Plus, OOD, to age 65', ip: 'After 24 months, to age 65' },
    lines: [{ type: 'other', label: 'Cover', life: { lump: 2044346.02 }, sev: { lump: 817738.41 }, lsd: { lump: 1500000 }, ip: { monthly: 25000 }, waiting: '24 months' }] },
  FU28: { date: '28/11/2026', items: { will: 'Capital Legacy to call to amend the will', shortterm: 'Everything sent to Cameron, feedback awaited.', medical: null, gap: null, legacy: null } },
  FU10: { date: '10/11/2026', items: { will: 'THIS OLD NOTE MUST NEVER BE READ' } }
};
srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = READ_ARG => {
    window.__api = []; window.__read = READ_ARG;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; if (c0.type === 'text') return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"items":{}}' }], usage: {} }) });          // the Fact Find's notes (0.92): nothing to say
      const text = atob(c0.source.data); window.__api.push(text);
      return (window.__delay ? new Promise(r => setTimeout(r, window.__delay)) : Promise.resolve()).then(() => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(window.__read[text] || {}) }], usage: { input_tokens: 5, output_tokens: 5 } }) }));
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
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, READ);
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
  await p.goto(base + 'overview.html'); await p.waitForTimeout(900); await wireOn(p);
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const st = () => p.evaluate(() => OV.app.state);
  const dot = id => p.evaluate(i => document.querySelector('[data-dot="' + i + '"]').className.replace('dot ', ''), id);
  const note = id => p.evaluate(i => { const e = document.querySelector('[data-note="' + i + '"]'), st = document.querySelector('[data-state="' + i + '"]'); return e && !e.hidden && e.checkVisibility() ? e.textContent : (st && !st.hidden && st.checkVisibility() ? st.textContent : ''); }, id);          // round 2.2: a quote line's checklist line says "Not asked for" / "Asked for · outstanding" (the comment is not drawn twice)
  const IDS = ['policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other'];
  const quiet = () => p.evaluate(() => { document.querySelector('#toast').hidden = true; });

  /* ---- 1. Fill from the Fact Find alone: the document blocks say nothing about the folder ---- */
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ));
  await p.evaluate(() => { ['fna', 'reduced'].forEach(id => OV.store.setNeeded(OV.app.state, id, true)); OV.app.setState(OV.app.state); });          // round 2.2: only a quote that is needed can be outstanding (red once the folder was searched)
  await p.evaluate(() => OV.app.checkPass());
  ok(await dot('fna') === 'grey' && /outstanding/.test(await note('fna')) && !/none found|No FNA/.test(await note('fna')) && await dot('reduced') === 'grey' && /outstanding/.test(await note('reduced')), '1. after Fill from Fact Find alone, the FNA and the reduced quotes (needed) are waiting: they do not say "none found", the folder was not searched');
  ok(await dot('group') === 'red' && /No group benefits/.test(await note('group')), '1. group benefits (a statement about the Fact Find) is checked: red');

  /* ---- 2. Load from client folder: every block is neutral while the folder is searched ---- */
  await p.evaluate(() => { window.__delay = 900; });
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const wait = await p.evaluate(ids => ({
    bars: ids.map(i => { const e = document.querySelector('[data-prog="' + i + '"]'); return e && !e.hidden ? e.className + '|' + e.textContent : ''; }),
    notes: [...document.querySelectorAll('[data-note]')].filter(e => !e.hidden).length, reds: document.querySelectorAll('#nav .dot.red[data-dot]').length }), IDS);
  ok(wait.bars.every(t => /waiting|searching/.test(t) && /Waiting to search the client folder|Searching the client folder/.test(t)), '2. every block shows a neutral bar while the folder is searched: ' + wait.bars.slice(0, 3).join(' ; '));
  ok(wait.notes === 0 && wait.reds === 0, '2. no comment and no red dot anywhere before the search has finished (notes: ' + wait.notes + ', red: ' + wait.reds + ')');
  await p.screenshot({ path: out + '/r2-waiting.png', clip: { x: 0, y: 0, width: 520, height: 900 } });
  const list = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => ({ t: l.textContent.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked })));
  const lf = n => list.filter(x => x.t.indexOf(n) >= 0)[0];
  ok(lf('28.11.26') && lf('28.11.26').on, '2. the newest Follow-Up Summary Notes after the Fact Find (28.11.26) is ticked');
  ok(lf('10.11.26') && !lf('10.11.26').on, '2. an older one (dated before the Fact Find) is listed but not ticked');
  ok(!list.some(x => /Fact Find \(Audio to Text\)|Teams transcript/.test(x.t)), '2. the Fact Find itself and the transcript are not listed: ' + list.map(x => x.t.slice(0, 60)).join(' | '));
  await p.click('dialog.fdlg [data-yes]'); await p.waitForTimeout(450);
  const mid = await p.evaluate(() => ({ reading: [...document.querySelectorAll('#nav .prog.reading')].filter(e => !e.hidden).length, searching: [...document.querySelectorAll('#nav .prog.searching')].filter(e => !e.hidden).length,
    notes: [...document.querySelectorAll('[data-note]')].filter(e => !e.hidden).length, reds: document.querySelectorAll('#nav .dot.red[data-dot]').length }));
  ok(mid.reading >= 1 && mid.searching >= 1 && mid.notes === 0 && mid.reds === 0, '2. while documents are read: some blocks read, the others still search, and nothing says "none found": ' + JSON.stringify(mid));
  await quiet(); await p.screenshot({ path: out + '/r2-reading.png', clip: { x: 0, y: 0, width: 520, height: 900 } });
  await p.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 }); await p.waitForTimeout(300);
  ok(await dot('reduced') === 'red' && /No reduced quotes found/.test(await note('reduced')), '2. only when the search is over does the reduced quotes block say "No reduced quotes found" (red)');
  ok(await dot('fna') !== 'red' && await dot('policies') !== 'red', '2. a block that found something is not red');
  ok(!(await p.$('#resultsDlg')) && (await p.evaluate(() => document.querySelectorAll('dialog[open]').length)) === 0, '3. there is no "What was loaded" pop-up and no dialog is open after the load');
  await quiet(); await p.screenshot({ path: out + '/r2-after.png', clip: { x: 0, y: 0, width: 520, height: 900 } });
  const api = await p.evaluate(() => window.__api);
  ok(api.indexOf('FU28') >= 0 && api.indexOf('FU10') < 0, '2. the newest Summary Notes was read and the old one never was: ' + api.join(','));

  /* ---- 3. policies start closed, a description under each amount ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelectorAll('#main tbody.dtl').length) === 0, '4. the Liberty policy was just read and stays closed (See more)');
  const bd = await p.evaluate(() => [...document.querySelectorAll('#main .pols tbody[data-comp^="polrow"] small.bd')].map(e => e.textContent));
  ok(bd.length === 4 && /Whole of life/.test(bd[0]) && /Living Lifestyle Plus/.test(bd[1]) && /Absolute Protector Plus/.test(bd[2]) && /After 24 months/.test(bd[3]), '7. a short description under each of the four amounts: ' + bd.join(' | '));
  ok(await p.evaluate(() => { const r = document.querySelector('#main .pols tbody[data-comp^="polrow"] tr'); return !/Whole of life/.test(r.cells[0].textContent); }), '7. and no longer joined under the policy\'s name');
  const ent = await p.evaluate(() => { const bad = []; document.querySelectorAll('#main .ovt td.c').forEach(td => { const t = td.getBoundingClientRect(); td.querySelectorAll('.a').forEach(a => { const r = a.getBoundingClientRect(); if (r.left < t.left - 0.5 || r.right > t.right + 0.5) bad.push(a.textContent); }); });
    const rows = [...document.querySelectorAll('#main .ovt tr')].map(tr => [...tr.cells].filter(c => c.querySelector('.a')).map(c => { const a = c.querySelector('.a').getBoundingClientRect(); return [a.left, a.right]; })); let touch = 0; rows.forEach(r => { for (let i = 1; i < r.length; i++) if (r[i][0] < r[i - 1][1] + 2) touch++; }); return { bad, touch }; });
  ok(ent.bad.length === 0 && ent.touch === 0, '6. on the entry screen too, no amount leaves its cell or touches the next one (totals included): ' + JSON.stringify(ent));
  await quiet(); await p.screenshot({ path: out + '/r2-policies.png', fullPage: false });
  await p.click('#main [data-see]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Severe illness description/.test(document.querySelector('#main tbody.dtl').textContent)), '7. See more opens the policy: it has a box for each of the four descriptions');

  /* ---- 4. a line in the quote is confirmed by the quote ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(150);
  const q = (await st()).blocks.fna.quotes[0], by = t => q.lines.filter(l => l.type === t)[0];
  ok(['household', 'death', 'dread'].every(t => by(t).st === 'confirmed' && by(t).match === 'quote' && by(t).by === 'page'), '5. household, death-related and additional expense lines are confirmed by the quote');
  ok(by('child').st === 'verify', '5. a child that is not in the Fact Find stays to check');
  ok(await p.evaluate(() => document.querySelectorAll('#main .tickok').length) >= 3, '5. the confirmed lines show a green tick: ' + await p.evaluate(() => document.querySelectorAll('#main .tickok').length));
  await quiet(); await p.screenshot({ path: out + '/r2-fna.png', fullPage: false });

  /* ---- 5. block 11 ---- */
  await p.evaluate(() => OV.app.go('other')); await p.waitForTimeout(150);
  const o = (await st()).blocks.other.items, it = k => o.filter(i => i.key === k)[0];
  ok(it('medical').company === 'Test Health Scheme' && it('medical').product === 'Test Saver' && /^Medical aid; broker Other broker; Premium paid by the employer\. \(Fact Find 20\/11\)$/.test(it('medical').note), '6. medical aid from the Fact Find, with its source: ' + it('medical').note);
  ok(/Has a will, not up to date; last updated 01\/03\/2019; held with Capital Legacy; broker Other broker; Wants the guardian changed\. \(Fact Find 20\/11\) \u00b7 Capital Legacy to call to amend the will \(Summary Notes 28\/11\)$/.test(it('will').note), '6. the will: the Fact Find\'s part, then the Summary Notes\' progress, each with its date: ' + it('will').note);
  ok(/Cameron Maritz.*\(Fact Find 20\/11\) \u00b7 Everything sent to Cameron, feedback awaited\. \(Summary Notes 28\/11\)$/.test(it('shortterm').note) && it('shortterm').premium === 2539, '6. short-term: premium and both parts: ' + it('shortterm').note);
  ok(it('legacy').company === 'Capital Legacy' && /^Capital Legacy to contact client \(Fact Find 20\/11\)$/.test(it('legacy').note), '6. the legacy protection plan is filled from the Fact Find too');
  ok(it('gap').note === 'Gap cover: Yes; broker Paul K; Quote requested. (Fact Find 20/11)' && it('gap').wr === true, '6. gap cover: the Fact Find\'s answer, broker and note');
  ok(it('will').src.kind === 'followup' && it('will').st === 'verify' && it('medical').st === 'ff', '6. an item the Summary Notes added to waits for a check; one it said nothing about is still from the Fact Find');
  ok(await p.evaluate(() => document.querySelectorAll('#main textarea[data-p$=".note"]').length) === 5, '6. every note is a box you can read');
  ok(await p.evaluate(() => { const t = document.querySelectorAll('#main textarea[data-p$=".note"]')[2]; return t.getBoundingClientRect().height >= 40 && /Summary Notes 28\/11/.test(t.value); }), '6. the will\'s box shows the whole note');
  await quiet(); await p.screenshot({ path: out + '/r2-block11.png', fullPage: false });

  /* ---- 6. the Presentation: no amount runs into the next column; descriptions under the amounts ---- */
  await p.click('#btnPresent'); await p.waitForTimeout(500); await p.click('#pres .ptab[data-tab="policies"]'); await p.waitForTimeout(500);
  const over = await p.evaluate(() => {
    const bad = [], cells = [...document.querySelectorAll('#pres .ptbl td')];
    cells.forEach(td => { const tr = td.getBoundingClientRect(); [...td.querySelectorAll('.a')].forEach(a => { const r = a.getBoundingClientRect(); const w = Math.max(a.scrollWidth, r.width) * (r.width / (a.offsetWidth || 1)); if (r.left < tr.left - 0.5 || r.right > tr.right + 0.5 || a.scrollWidth > a.clientWidth + 1 && a.classList.contains('a') && !a.classList.contains('pmv')) bad.push(a.textContent + ' ' + Math.round(r.left) + '-' + Math.round(r.right) + ' in ' + Math.round(tr.left) + '-' + Math.round(tr.right)); }); });
    const rows = [...document.querySelectorAll('#pres .ptbl tr')].map(tr => [...tr.cells].filter(c => c.querySelector('.a')).map(c => { const a = c.querySelector('.a').getBoundingClientRect(); return [a.left, a.right]; }));
    let touch = 0; rows.forEach(r => { for (let i = 1; i < r.length; i++) if (r[i][0] < r[i - 1][1] + 2) touch++; });
    return { bad, touch, desc: [...document.querySelectorAll('#pres .bdesc')].map(e => e.textContent), totals: [...document.querySelectorAll('#pres .ptbl tr.tot td .a')].map(e => e.textContent).slice(0, 4) };
  });
  ok(over.bad.length === 0 && over.touch === 0, '8. in the policies table no amount leaves its cell or touches its neighbour (totals too): ' + (over.bad.join(' ; ') || 'none') + ' / touching: ' + over.touch + ' / totals: ' + over.totals.join(' '));
  ok(over.desc.length === 4 && /Whole of life/.test(over.desc[0]) && /Absolute Protector Plus/.test(over.desc[2]), '7. the Presentation shows the four descriptions under the amounts: ' + over.desc.join(' | '));
  await p.screenshot({ path: out + '/r2-pres-policies.png' });
  await p.click('#pBtnClose'); await p.waitForTimeout(300);

  /* ---- 6b. the standard settings panel is gone from Client details (11:41) ---- */
  await p.evaluate(() => OV.app.go('_client')); await p.waitForTimeout(200);
  const cd = await p.evaluate(() => ({ txt: document.querySelector('#main').textContent, boxes: document.querySelectorAll('#main [data-p^="settings."]').length, titles: [...document.querySelectorAll('#main .block-title')].map(e => e.textContent) }));
  ok(!/standard settings/i.test(cd.txt) && cd.boxes === 0 && !/Difference allowed in a check/.test(cd.txt) && cd.titles.length === 1 && /The client/.test(cd.titles[0]), '10. Client details has no "Paul\'s standard settings" panel and no box for the increases or the difference allowed: ' + cd.titles.join(' | '));
  ok(await p.evaluate(() => OV.app.state.settings.standards.aci === 10 && OV.app.state.settings.tolerance === 1 && OV.app.state.settings.standards.abi.household === 5), '10. the values are still stored in the overview\'s data');
  await quiet(); await p.screenshot({ path: out + '/r2-client-details.png', fullPage: false });

  /* ---- 7. the PDF has the descriptions ---- */
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/r2-overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const t2 = cp.execFileSync('pdftotext', ['-f', '2', '-l', '2', '-layout', file, '-']).toString();
  ok(/Whole of life/.test(t2) && /Living Lifestyle Plus/.test(t2) && /Absolute Protector/.test(t2) && /OOD, to age 65/.test(t2) && /After 24 months/.test(t2) && /whole of life/.test(t2) && /R2,044,346\.02/.test(t2), '7. the PDF\'s policies page has the descriptions under the amounts');
  ok(!errs.length, '9. no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
