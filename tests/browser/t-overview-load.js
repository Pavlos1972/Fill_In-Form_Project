/* The Client Overview Studio 0.8 on the real page, over a REAL directory tree in the browser's private file system (as t-overview-studio.js, which says why the connection is stored the way it is here; the Anthropic call is a
   stand-in that answers by what is in the document, so no document leaves the machine). Covered: Settings (the key, the reading switch, the link in the "no key" message), the ONE Load from client folder button (the list, the quotes read
   BEFORE the guides, each BrightRock quote's change moment pay-out read by itself, "No change moment pay-out guide found for CP n", a guide that matches no quote said once), the debts named and banked from the Fact Find, an ABI on every
   line, severe illness N/A, child care waiting N/A, the green tick on a matched line and the reason on the others, two Liberty schedules each going to its own policy, the bar under a block's name, the normal file window opening by itself
   when the client's folder is not connected, the More menu, no Documents panel, no block numbers, Back / Next that skip the shortfall quote page without group risk. Invented client ("Load, Lena"): no real client data. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const TREE = {
  NB: { 'Load, Lena': { '1. Overview': {}, '2. Fact Find': {},
    '3. Quotes': { 'BR FNA - 100000011 - 19.11.26.pdf': 'FNA11', 'BR Reduced Quote - 100000022 - 19.11.26.pdf': 'RED22', 'BR CMPO - 100000011.pdf': 'CMP11', 'BR CMPO - 100000099.pdf': 'CMP99' },
    '6. Policy Schedules': { 'Liberty schedule A.pdf': 'LIBA', 'Liberty schedule B.pdf': 'LIBB' } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Lena' }, sname: { v: 'Load' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Load', cost: 'R 5 000.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Cars Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00', term: '60' } }],
    risk: [{ d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }, { d: { prov: 'Liberty', spend: 'R 700.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
const READ = {
  FNA11: { insurer: 'BrightRock', number: '100000011', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, aciText: '7.5% + defined age rater', premium: 2900, abi: 5, servicing: false, disabilityAge: 65, lines: [
    { type: 'household', term: 'Standalone', life: { lump: 800000, monthly: 5000 } }, { type: 'child', name: 'Amy', waiting: '3 months', life: { lump: 500000, monthly: 5000 } },
    { type: 'debt', debt: 'Home loan', life: { lump: 1200000, monthly: 12000 }, ip: { monthly: 12000 } }, { type: 'debt', debt: '', life: { lump: 190000, monthly: 4000 } }, { type: 'debt', debt: 'Mahindra XUV 700', life: { lump: 300000, monthly: 6000 } },
    { type: 'dread', sev: { lump: 500000 } }] },
  RED22: { insurer: 'BrightRock', number: '100000022', date: '19/11/2026', aci: 10, premium: 1400, lines: [{ type: 'household', life: { lump: 300000, monthly: 2000 } }, { type: 'death', life: { lump: 100000, monthly: 1000 } }] },
  CMP11: { number: '100000011', activationDate: '01/02/2028', rows: [{ key: 'total', today: 30000, projected: 80000 }] },
  CMP99: { number: '100000099', activationDate: '01/02/2028', rows: [{ key: 'total', today: 1, projected: 2 }] },
  LIBA: { insurer: 'Liberty', policyNo: 'L-700', premium: 700, lines: [{ type: 'other', label: 'Cover', life: { lump: 700000 } }] },
  LIBB: { insurer: 'Liberty', policyNo: 'L-500', premium: 500, lines: [{ type: 'other', label: 'Cover', life: { lump: 500000 } }] }
};
srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = READ_ARG => {
    window.__calls = []; window.__picks = []; window.__api = []; window.__kinds = {}; window.__open = null; window.__read = READ_ARG;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    window.showOpenFilePicker = async o => { window.__picks.push({ startIn: o && o.startIn ? o.startIn.name : null, id: o && o.id ? o.id : null, multiple: o && o.multiple }); if (!window.__open) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return [window.__open]; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), prompt = body.messages[0].content[1].text;
      const kind = /change moment pay-out guide/.test(prompt) ? 'cmp' : /quote or proposal for an investment/.test(prompt) ? 'proposal' : /Goal Analysis Report/.test(prompt) ? 'goal' : /insurance quote/.test(prompt) ? 'quote' : 'other';
      window.__api.push({ kind, key: opt.headers['x-api-key'], text: atob(body.messages[0].content[0].source.data) });
      return (window.__delay ? new Promise(r => setTimeout(r, window.__delay)) : Promise.resolve()).then(() => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(window.__read[atob(body.messages[0].content[0].source.data)] || {}) }], usage: { input_tokens: 5, output_tokens: 5 } }) }));
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


  const dismiss = pg => pg.on('dialog', d => d.accept());
  const vis = (pg, id) => pg.evaluate(i => { const e = document.getElementById(i); return !!e && e.checkVisibility() && e.getBoundingClientRect().width > 0; }, id);          // a closed menu's buttons are not visible

  /* ---- 1. no folders connected, no key: the bars, the More menu, Settings, the normal file window, Back / Next ---- */
  const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c0.addInitScript(init, READ);
  const p0 = await c0.newPage(); const errs = []; p0.on('pageerror', e => errs.push(e.message)); dismiss(p0);
  await p0.goto(base + 'overview.html'); await p0.waitForTimeout(700);
  const top = await p0.evaluate(() => ({ label: document.querySelector('#btnReadFolder').textContent, docs: !!document.querySelector('#docs, #aiSwitch, #aiNote'), nums: [...document.querySelectorAll('#nav button[data-block]')].map(x => x.textContent.trim()), h2: document.querySelector('#main h2').textContent }));
  ok((await Promise.all(['btnNew', 'btnOpen', 'btnSave', 'btnReadFolder', 'btnPreview', 'btnPdf', 'btnPresent'].map(id => vis(p0, id)))).every(Boolean), '1. the top bar shows New, Open, Save, Load from client folder, Preview PDF, Save PDF and Present');
  ok(/^Load from client folder/.test(top.label) && !(await vis(p0, 'btnUpload')) && !(await vis(p0, 'btnLoad')) && !(await vis(p0, 'btnFolders')) && !(await vis(p0, 'btnReview')) && !(await vis(p0, 'btnSaveAs')) && !(await vis(p0, 'btnSettings')), '1. ONE load button; Fill from Fact Find, Folders, New review year, Save as and Settings are not on the bar');
  await p0.click('#moreMenu summary');
  ok((await Promise.all(['btnLoad', 'btnFolders', 'btnReview', 'btnSaveAs', 'btnSettings'].map(id => vis(p0, id)))).every(Boolean), '1. the More menu holds Fill from Fact Find, Folders, New review year, Save as and Settings');
  await p0.keyboard.press('Escape'); ok(!(await vis(p0, 'btnSettings')), '1. Escape closes the More menu');
  ok(!top.docs, '1. there is no Documents panel on the right');
  ok(top.nums.length === 17 && top.nums.every(t => !/^\d/.test(t)) && top.nums[11] === 'FNA quote' && top.nums[13] === 'Reduced quotes' && top.h2 === 'Client details', '1. the menu has no block numbers: ' + top.nums.join(' | '));
  await p0.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ)); await p0.evaluate(() => { OV.schema.NEED_BLOCKS.forEach(id => OV.store.setNeeded(OV.app.state, id, true)); OV.app.setState(OV.app.state); });
  /* the pager skips a page that does not apply */
  const pager = async id => { await p0.evaluate(i => OV.app.go(i), id); await p0.waitForTimeout(80); return p0.evaluate(() => [...document.querySelectorAll('#main .pagenav button')].map(x => x.textContent.replace(/\s+/g, ' ').trim())); };
  ok(JSON.stringify(await pager('shortfall')) === JSON.stringify(['\u2039 Back: Medical aid, will & short-term', 'Next: FNA quote \u203a']), '1. Next from Shortfall is the FNA quote: the five servicing pages are passed by while they are empty (round 2.0)');
  await p0.evaluate(() => { OV.app.state.blocks.group.items.forEach(g => { g.removed = true; }); OV.app.redraw(); });
  ok(JSON.stringify(await pager('shortfall')) === JSON.stringify(['\u2039 Back: Medical aid, will & short-term', 'Next: FNA quote \u203a']), '1. and without group risk too');
  ok(JSON.stringify(await pager('reduced')) === JSON.stringify(['\u2039 Back: FNA quote', 'Next: Comparative quotes \u203a']), '1. without group risk the Shortfall quote page is skipped, going back too');
  ok((await pager('_client')).join('|') === 'Next: Current policies \u203a' && (await pager('goals')).join('|') === '\u2039 Back: Proposed investments', '1. Client details has only Next; the last page only Back');
  await p0.evaluate(() => { OV.app.state.blocks.group.items.forEach(g => { g.removed = false; }); OV.app.redraw(); });
  /* reading is on, there is no key: said plainly, with a link to Settings */
  await p0.evaluate(() => OV.app.ingest([new File(['FNA11'], 'BR FNA - 100000011 - 19.11.26.pdf', { type: 'application/pdf' })], { block: 'fna' }));
  await p0.waitForTimeout(500);
  const t0 = await p0.evaluate(() => ({ text: document.querySelector('#toast').textContent, link: !!document.querySelector('#toast [data-toastlink]'), shown: !document.querySelector('#toast').hidden }));
  ok(t0.shown && t0.link && /recorded, not read: reading needs your Anthropic key/.test(t0.text) && /Add the key in Settings/.test(t0.text), '1. reading with no key says so plainly, with a link to Settings: ' + t0.text);
  ok((await p0.evaluate(() => window.__api.length)) === 0, '1. nothing was sent to Anthropic');
  ok(await p0.evaluate(() => { const p = document.querySelector('[data-prog=fna]'); return !p.hidden && /recorded/.test(p.className) && /Recorded, not read/.test(p.textContent); }), '1. the bar under FNA quote says it was recorded, not read');
  await p0.click('#toast [data-toastlink]'); await p0.waitForSelector('#settingsDlg[open]');
  await p0.fill('#setKey', 'sk-test-123456'); await p0.click('#settingsDlg [data-yes]'); await p0.waitForTimeout(150);
  ok(await p0.evaluate(() => FF.lookup.getSettings().apiKey === 'sk-test-123456'), '1. the key typed in Settings is kept in the Fact Find\'s own settings (the same key)');
  await p0.click('#moreMenu summary'); await p0.click('#btnSettings'); await p0.waitForSelector('#settingsDlg[open]');
  ok(await p0.evaluate(() => /ending/.test(document.querySelector('#settingsDlg .l').textContent) && document.querySelector('#setKey').value === '' && document.querySelector('#setRead').checked), '1. Settings shows that a key is saved (its end only) and that reading is on');
  await p0.uncheck('#setRead'); await p0.click('#settingsDlg [data-yes]');
  ok(await p0.evaluate(() => localStorage.getItem('wr-overview-read') === '0'), '1. the reading switch is in Settings and is remembered');
  await p0.click('#moreMenu summary'); await p0.click('#btnSettings'); await p0.waitForSelector('#settingsDlg[open]'); await p0.check('#setRead'); await p0.click('#settingsDlg [data-yes]');
  /* Load from client folder with no folders connected: the normal file window opens by itself (several files) */
  const fc = p0.waitForEvent('filechooser'); await p0.click('#btnReadFolder'); const chooser = await fc;
  ok(chooser.isMultiple() && /not connected|normal file window/.test(await p0.evaluate(() => document.querySelector('#toast').textContent)), '1. Load from client folder, with no folders connected, opens the normal file window by itself');
  await p0.evaluate(() => OV.app.go('fna')); await p0.click('[data-upc=fna]'); await p0.waitForTimeout(500);
  const pk0 = await p0.evaluate(() => window.__picks);
  ok(pk0.length === 1 && pk0[0].startIn === null && pk0[0].id === 'overview-docs', '1. Upload from client folder, with no folders connected, opens the normal file window by itself: ' + JSON.stringify(pk0));
  ok(await p0.evaluate(() => !/Upload from another folder|\+ Add new|Add another/.test(document.querySelector('#main').textContent) && /\+ Add [A-Za-z ]+quote/.test(document.querySelector('#main').textContent) && !/type in by hand/.test(document.querySelector('#main').textContent) && document.querySelectorAll('#main [data-upc]').length === 1), '1. one "+ Add ... quote" button in the block and no "type in by hand" link (round 2.0: a quote is added whole)');
  ok(errs.length === 0, '1. no page error: ' + errs.join(' | '));
  await c0.close();

  /* ---- 2. folders connected: Load from client folder ---- */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await ctx.addInitScript(init, READ);
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
  const p = await ctx.newPage(); const errs2 = []; p.on('pageerror', e => errs2.push(e.message)); dismiss(p);
  await p.goto(base + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); await p.evaluate(() => OV.app.openAll());
  if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ)); await p.evaluate(() => { OV.schema.NEED_BLOCKS.forEach(id => OV.store.setNeeded(OV.app.state, id, true)); OV.app.setState(OV.app.state); });
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const st = () => p.evaluate(() => OV.app.state), api = () => p.evaluate(() => window.__api);
  await p.evaluate(() => { window.__delay = 700; });
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const listing = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label span')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(listing.some(t => /3\. Quotes \\ BR FNA - 100000011/.test(t)) && listing.some(t => /3\. Quotes \\ BR CMPO - 100000099/.test(t)) && listing.some(t => /6\. Policy Schedules \\ Liberty schedule A/.test(t)), '2. Load from client folder lists what it found, the quotes folder too: ' + listing.length + ' files');
  await p.click('dialog.fdlg [data-yes]'); await p.waitForTimeout(450);
  ok(await p.evaluate(() => { const e = document.querySelector('[data-prog]:not([hidden])'); return !!e && /reading/.test(e.className) && /Reading|Downloading/.test(e.textContent); }), '2. while a document is read, a bar shows under that block\'s name in the menu');
  await p.waitForSelector('.loadlog', { state: 'attached', timeout: 30000 }); await p.waitForTimeout(300);
  ok(!(await p.$('#resultsDlg')), '2. there is no "What was loaded" pop-up any more');
  const calls = (await api()).map(c => c.text);
  ok(calls.indexOf('CMP99') > calls.indexOf('RED22') && calls.indexOf('CMP99') > calls.indexOf('FNA11') && calls.indexOf('CMP11') > calls.indexOf('FNA11'), '2. the quotes are read before the guides (a guide needs its quote): ' + calls.join(' > '));
  ok(calls.filter(t => t === 'CMP11').length === 1, '2. the guide of the FNA was read ONCE (by its quote), not again from the list');
  const s = await st(), fna = s.blocks.fna.quotes[0], red = s.blocks.reduced.quotes[0];
  ok(fna.cmp && fna.cmp.number === '100000011' && fna.cmp.st === 'verify' && fna.cmp.src.file === 'BR CMPO - 100000011.pdf', '2. the FNA\'s change moment pay-out was found and filled by itself (no "+ Add")');
  ok(red && !red.cmp, '2. the reduced quote has no guide');
  const res = await p.evaluate(() => document.querySelector('.loadlog').textContent.replace(/\s+/g, ' '));
  ok((res.match(/No change moment pay-out guide found for CP 100000022/g) || []).length === 1, '2. "No change moment pay-out guide found for CP 100000022" is said once');
  ok((res.match(/guide for CP 100000099 matches no quote/g) || []).length === 1, '2. a guide that matches no quote is listed once: ' + (res.match(/[^.]*100000099[^.]*\./g) || []).join(' '));
  /* every line, every box */
  ok(fna.lines.length === 6 && fna.lines.every(l => l.abi !== null && l.abi !== undefined && l.abi !== ''), '2. every line of the FNA has an ABI: ' + fna.lines.map(l => l.abi).join());
  ok(red.lines.every(l => l.abi === 'Not found'), '2. a quote that prints no ABI says "Not found" on every line');
  const deb = fna.lines.filter(l => l.type === 'debt');
  ok(deb[0].bank === 'Test Bank' && deb[1].debt === 'Car loan' && deb[1].bank === 'Cars Bank' && deb[2].debt === 'Mahindra XUV 700' && deb[2].bank === '', '2. the debts are named and banked from the Fact Find (the banks were empty before); the one only in the quote stays as it is');
  ok(fna.lines.filter(l => l.sev === 'N/A').length === 5 && fna.lines.filter(l => l.type === 'dread')[0].sev.lump === 500000, '2. severe illness is N/A on every line except the one with an amount (the dread line)');
  ok(fna.lines.filter(l => l.type === 'child')[0].waiting === 'N/A', '2. child care waiting is N/A even though the quote printed 3 months');
  const kid = fna.lines.filter(l => l.type === 'child')[0];
  ok(kid.sname === 'Load' && kid.st === 'confirmed' && kid.match === 'factfind' && deb[0].st === 'confirmed' && deb[1].st === 'confirmed' && deb[2].st === 'verify', '2. the child and the two debts that agree with the Fact Find are checked by the page; the Mahindra is to check');
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(150);
  const dom = await p.evaluate(() => ({ ticks: document.querySelectorAll('#main table.lines .tickok').length, why: [...document.querySelectorAll('#main table.lines small.why')].map(x => x.textContent).filter(Boolean), aci: [...document.querySelectorAll('#main table.lines [data-aci]')].map(x => x.textContent), quoteAci: document.querySelector('#main [data-p$=".aciText"]').value, ticksTxt: [...document.querySelectorAll('#main table.lines tr.ln')].filter(r => !r.querySelector('.tickok') && /to check/.test(r.querySelector('.stb').textContent)).length }));
  ok(dom.ticks === 5 && dom.ticksTxt === 1, '2. on the screen: five green ticks (the child and the two debts that agree with the Fact Find, and the household and dread lines, which are in the quote), and "to check" on the Mahindra only: ' + dom.ticks + ' / ' + dom.ticksTxt);
  ok(dom.why.some(t => /Mahindra XUV 700 is in the quote, not in the Fact Find\./.test(t)), '2. the reason is on the line: ' + dom.why.join(' | '));
  ok(dom.aci.length === 6 && dom.aci.every(t => t === dom.quoteAci && t === '7.5% + defined age rater'), '2. the ACI on every line carries the same words as the quote\'s: ' + dom.aci.join(' | '));
  ok(await p.evaluate(() => { const r = document.querySelector('[data-prog=fna]'), q = document.querySelector('[data-prog=reduced]'), po = document.querySelector('[data-prog=policies]'); return [r, q, po].every(e => e && !e.hidden && /done/.test(e.className) && /Downloaded and populated/.test(e.textContent)); }), '2. each block\'s bar is green with "Downloaded and populated" (FNA quote, Reduced quotes, Current policies)');
  /* the two Liberty schedules */
  const pol = s.blocks.policies.items;
  ok(pol.length === 2 && pol[0].premium === 500 && pol[0].policyNo === 'L-500' && pol[1].premium === 700 && pol[1].policyNo === 'L-700' && pol.every(i => i.lines.length === 1), '2. two Liberty policies: each schedule went to its own policy (by the policy number and the premium): ' + pol.map(i => i.policyNo + ' R' + i.premium).join(', '));
  /* the pay-out is on the screen without anything to add */
  ok(await p.evaluate(() => !!document.querySelector('#main table.payout') && !document.querySelector('#main [data-addcmp]')), '2. the FNA shows its change moment pay-out and no "+ Add" button');
  await p.evaluate(() => OV.app.go('reduced')); await p.waitForTimeout(100);
  ok(await p.evaluate(() => /No change moment pay-out yet/.test(document.querySelector('#main').textContent) && /Type it in by hand/.test(document.querySelector('#main').textContent)), '2. the reduced quote says there is no pay-out yet and offers to type it by hand');
  await p.screenshot({ path: out + '/load-reduced.png' });
  ok(errs2.length === 0, '2. no page error: ' + errs2.join(' | '));
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
