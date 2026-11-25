/* The Client Overview Studio 0.9 on the real page (Paul's round of 23 November): every block checks and reports (a bar while it looks, then its dot and, where nothing is there, a comment under its name and a RED dot), a policy of another
   insurer is ONE row with its benefits, each quote is kept ONCE (the same file listed twice, the same CP read from two files, an opened file that holds a copy), the change moment pay-out table has no x and no "+ A child row", and every
   table of the entry screen is rounded (16px). The Anthropic call is a stand-in that answers by what is in the document (no document leaves the machine). Invented client ("Round, Nina"): no real client data.
   Screenshots (deviceScaleFactor 2) go to the out folder: r09-menu, r09-policies, r09-fna-header-closed / -open, r09-payout, r09-reduced, r09-fullscreen. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FFJ = (extra) => ({ app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Nina' }, sname: { v: 'Round' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } },
  l: Object.assign({ kids: [{ d: { name: 'Amy', sname: 'Round', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Round', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }],
    risk: [{ d: { prov: 'Liberty', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'BrightRock', spend: 'R 1 500.00', broker: 'Paul K' } }] }, extra || {}) });
const LINES = [
  { type: 'household', term: 'To age 65', waiting: '1 month', life: { lump: 500000, monthly: 0 }, sev: { lump: 100000 }, lsd: { lump: 200000 }, ip: { monthly: 15000 } },
  { type: 'child', name: 'Amy', sname: 'Round', life: { lump: 300000 } },
  { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1000000, monthly: 12000 }, lsd: { lump: 400000 } }];
const FNA = { insurer: 'BrightRock', number: '100000031', date: '19/11/2026', rates: 'Smoker rates', aci: 10, premium: 2900, abi: 5, lines: [
  { type: 'household', life: { lump: 800000, monthly: 5000 } }, { type: 'child', name: 'Amy', sname: 'Round', life: { lump: 500000, monthly: 5000 } }, { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1200000, monthly: 12000 } }] };
const RED = (n, p) => ({ insurer: 'BrightRock', number: n, date: '19/11/2026', rates: 'Smoker rates', aci: 10, premium: p, abi: 5, lines: [{ type: 'household', life: { lump: 300000, monthly: 2000 } }] });
const READ = {
  FNA1: FNA, FNA2: Object.assign({}, FNA, { premium: 2950 }), LIB: { insurer: 'Liberty', product: 'Liberty Life Plan', policyNo: 'L-900', premium: 900, lines: LINES },
  RED1: RED('100000041', 1400), RED2: RED('100000042', 1300), CMP: { number: '100000031', activationDate: '01/02/2028', rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: '31/12/2046' }, { key: 'retirement', today: 10000, projected: 20000 }, { key: 'child', name: 'Amy', sname: 'Round', today: 5000, projected: 9000 }] }
};
srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = R => {
    window.__api = []; window.__read = R;
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), text = atob(body.messages[0].content[0].source.data); window.__api.push(text);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(window.__read[text] || {}) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
    };
  };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, READ);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(base + 'overview.html'); await p.waitForTimeout(600);
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const clean = () => p.evaluate(() => { document.querySelector('#toast').hidden = true; const d = document.getElementById('resultsDlg'); if (d) d.remove(); });
  const dot = id => p.evaluate(i => document.querySelector('[data-dot="' + i + '"]').className.replace('dot ', ''), id);
  const note = id => p.evaluate(i => { const e = document.querySelector('[data-note="' + i + '"]'); return e && !e.hidden && e.checkVisibility() ? e.textContent : ''; }, id);
  const file = (txt, name) => `new File(${JSON.stringify([txt])}, ${JSON.stringify(name)}, { type: 'application/pdf' })`;
  const ing = (files, o) => p.evaluate(`OV.app.ingest([${files.map(f => file(f[0], f[1])).join(',')}], ${JSON.stringify(o || {})})`);

  /* ---- 1. the legend, and a new overview is all grey ---- */
  const leg = await p.evaluate(() => document.querySelector('#legend').textContent);
  ok(/Red: checked, nothing there/.test(leg) && /Grey: nothing yet/.test(leg) && /Amber: to check/.test(leg) && /Green: checked/.test(leg) && /Dashed: not needed/.test(leg), '1. the legend has Red: checked, nothing there');
  ok(await p.evaluate(() => !document.querySelector('.dot.red[data-dot]') && ![...document.querySelectorAll('[data-note]')].some(e => !e.hidden)), '1. a new overview has no red dot and no comment: nothing has been checked');
  ok(await p.evaluate(() => !!document.querySelector('#legend .dot.red')), '1. the legend shows a red dot');

  /* ---- 2. a Fact Find with a Liberty and a BrightRock policy, nothing else: Check all blocks (the More menu) ---- */
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ()));
  await p.click('#moreMenu summary'); ok(await p.evaluate(() => { const b = document.querySelector('#btnCheck'); return b.checkVisibility() && /Check all blocks/.test(b.textContent); }), '2. the More menu has Check all blocks');
  await p.click('#btnCheck'); await p.waitForTimeout(230);
  const mid = await p.evaluate(() => ({ bars: [...document.querySelectorAll('#nav .prog.checking')].filter(e => !e.hidden).length, txt: [...document.querySelectorAll('#nav .prog.checking em')].map(e => e.textContent)[0] }));
  ok(mid.bars >= 1 && /Checking/.test(mid.txt), '2. a bar "Checking…" runs under the name of the blocks while it looks: ' + mid.bars + ' at 230 ms');
  await p.evaluate(() => OV.app.checkPass()); await p.waitForTimeout(120);
  ok(await dot('group') === 'red' && /No group benefits and no personal investments/.test(await note('group')), '2. group benefits and personal investments: red, "No group benefits and no personal investments"');
  ok(await dot('comparative') === 'red' && /No comparative quotes/.test(await note('comparative')), '2. comparative quotes: red, "No comparative quotes"');
  ok(await dot('proposed') === 'red' && /No proposed investments/.test(await note('proposed')), '2. proposed investments: red');
  ok(await dot('goals') === 'red' && /No goal analysis requested/.test(await note('goals')), '2. goal analysis reports: red, "No goal analysis requested"');
  ok(await dot('investments') === 'red' && /No current investments/.test(await note('investments')), '2. current investments: red');
  ok(await dot('other') === 'red' && /No medical aid/.test(await note('other')), '2. medical aid, will & short-term: red');
  ok(await dot('fna') === 'red' && /No FNA quote found/.test(await note('fna')) && await dot('reduced') === 'red', '2. after the check the FNA and the reduced quotes (documents only) say none was found');
  ok(await dot('shortfallQuote') === 'na' && /Not needed: no group risk/.test(await note('shortfallQuote')), '2. the shortfall quote without group risk is dashed and says why');
  ok(await dot('policies') !== 'red' && !(await note('policies')), '2. the policies are there: no red, no comment');
  const title = await p.evaluate(() => document.querySelector('[data-block="group"]').title);
  ok(/^Checked, nothing there: No group benefits and no personal investments\./.test(title), '2. the hover text says what red means: ' + title);
  await p.waitForTimeout(2600);
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav .prog')].every(e => e.hidden)), '2. the bars are gone once every block has finished');

  /* ---- 3. a policy of another insurer is ONE row; a BrightRock policy keeps its needs ---- */
  await ing([[ 'LIB', 'Liberty schedule.pdf' ]], { block: 'policies' }); await p.waitForTimeout(300);
  const pol = await p.evaluate(() => { const it = OV.app.state.blocks.policies.items.filter(i => i.insurer === 'Liberty')[0]; return { n: it.lines.length, t: it.lines.map(l => l.type), life: it.lines[0].life.lump, ip: it.lines[0].ip.monthly, label: it.lines[0].label }; });
  ok(pol.n === 1 && pol.t[0] === 'other' && pol.life === 1800000 && pol.ip === 15000 && pol.label === 'Liberty Life Plan', '3. a Liberty schedule that came back with household, child and debt lines is ONE "other" line: ' + JSON.stringify(pol));
  await p.evaluate(() => { OV.app.go('policies'); OV.app.openAll(true); });
  const view = await p.evaluate(() => { const c = [...document.querySelectorAll('article.qcard')]; const lib = c.filter(x => /Liberty/.test(x.querySelector('h3').textContent))[0], br = c.filter(x => /BrightRock/.test(x.querySelector('h3').textContent))[0];
    const adders = a => a ? [...a.querySelectorAll('[data-addl]')].map(x => x.textContent.trim()) : null; return { libHead: lib.querySelector('th.need').textContent, libRows: lib.querySelectorAll('table.lines tbody:first-of-type tr.ln').length, libAdd: adders(lib), brHead: br.querySelector('th.need').textContent, brAdd: adders(br), libNeedRows: lib.querySelectorAll('tr.ln b').length }; });
  ok(view.libHead === 'Benefits' && view.libRows === 1 && view.libAdd.length === 0, '3. the Liberty policy shows "Benefits", one row, and no add button (round 2.0: a schedule is added whole): ' + JSON.stringify(view));
  ok(view.brHead === 'Need' && view.brAdd.length === 0, '3. a BrightRock policy keeps "Need" and has no add-line buttons either');
  await p.evaluate(() => { OV.app.go('policies'); document.querySelector('#toast').hidden = true; }); await p.waitForTimeout(3600);
  await p.setViewportSize({ width: 1440, height: 1500 }); await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/r09-policies.png', fullPage: false });
  await p.setViewportSize({ width: 1440, height: 1000 });

  /* ---- 4. a quote once ---- */
  await p.evaluate(() => { OV.app.state.blocks.fna.quotes.length = 0; OV.app.state.blocks.reduced.quotes.length = 0; OV.app.redraw(); window.__api.length = 0; });
  await ing([['FNA1', 'BR FNA - 100000031 - 19.11.26.pdf'], ['FNA1', 'br fna - 100000031 - 19.11.26.PDF']], { block: 'fna' }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.app.state.blocks.fna.quotes.length) === 1 && await p.evaluate(() => window.__api.length) === 1, '4. the same file twice in one go is one quote and is read once');
  await ing([['FNA1', 'BR FNA - 100000031 - 19.11.26 (1).pdf']], { block: 'fna' }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.app.state.blocks.fna.quotes.length) === 1 && await p.evaluate(() => window.__api.length) === 1, '4. a file whose number is in its name, for a quote already loaded and read: not read again (no second quote, no second call)');
  ok(await p.evaluate(() => OV.app.lastLog().some(l => /already loaded as BrightRock FNA CP 100000031/.test(l.msg))), '4. and it says so: ' + await p.evaluate(() => OV.app.lastLog().map(l => l.msg).join(' | ').slice(0, 160)));
  await ing([['FNA2', 'FNA from the adviser.pdf']], { block: 'fna' }); await p.waitForTimeout(300);
  const again = await p.evaluate(() => ({ n: OV.app.state.blocks.fna.quotes.length, prem: OV.app.state.blocks.fna.quotes[0].premium, calls: window.__api.length, msg: OV.app.lastLog().map(l => l.msg).join(' | ') }));
  ok(again.n === 1 && again.prem === 2950 && again.calls === 2 && /read again into the same quote, so there is still only one/.test(again.msg), '4. the same CP in a file whose name has no number is read, and goes INTO the same quote (still one): ' + JSON.stringify(again).slice(0, 200));
  await p.evaluate(() => OV.app.go('fna')); await p.evaluate(() => OV.app.openAll(false)); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelectorAll('#main article.qcard').length) === 1 && await p.evaluate(() => document.querySelectorAll('#main article.qcard header .see').length) === 1, '4. the FNA tab shows ONE header with ONE See more / See less');
  await clean(); await p.evaluate(() => document.querySelector('#main article.qcard').scrollIntoView({ block: 'center' }));
  await p.locator('#main article.qcard header').first().screenshot({ path: out + '/r09-fna-header-closed.png' });
  const seeClosed = await p.evaluate(() => document.querySelector('#main article.qcard header .see').textContent);
  await p.click('#main article.qcard header .see'); await p.waitForTimeout(150);
  const seeOpen = await p.evaluate(() => document.querySelector('#main article.qcard header .see').textContent);
  ok(/See more/.test(seeClosed) && /See less/.test(seeOpen), '4. the one header says See more when folded and See less when open: ' + seeClosed + ' / ' + seeOpen);
  await p.locator('#main article.qcard header').first().screenshot({ path: out + '/r09-fna-header-open.png' });
  const checks = await p.evaluate(() => [...document.querySelectorAll('#checks .docline')].map(e => e.textContent));
  ok(checks.filter(t => /FNA CP 100000031/.test(t) && !/pay-out/.test(t)).length === 1, '4. the Checks panel lists the quote once: ' + JSON.stringify(checks));
  /* reduced quotes: two different CPs, each read twice, show each once */
  await ing([['RED1', 'BR Reduced Quote - 100000041 - 19.11.26.pdf'], ['RED2', 'BR Reduced Quote - 100000042 - 19.11.26.pdf'], ['RED1', 'BR Reduced Quote - 100000041 - 19.11.26.pdf']], { block: 'reduced' }); await p.waitForTimeout(300);
  await ing([['RED2', 'Reduced - the other copy.pdf']], { block: 'reduced' }); await p.waitForTimeout(300);
  await p.evaluate(() => { OV.app.go('reduced'); OV.app.openAll(false); }); await p.waitForTimeout(200);
  const red = await p.evaluate(() => [...document.querySelectorAll('#main article.qcard h3')].map(h => h.textContent));
  ok(red.length === 2 && /100000041/.test(red[0]) && /100000042/.test(red[1]), '4. Reduced quotes shows each CP once: ' + JSON.stringify(red));
  await clean(); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
  const box = await p.evaluate(() => { const h = document.querySelector('#main h2').getBoundingClientRect(), cs = [...document.querySelectorAll('#main article.qcard')], l = cs[cs.length - 1].getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect(); return { x: m.left, y: h.top - 16, width: m.width, height: l.bottom - h.top + 32 }; });
  await p.screenshot({ path: out + '/r09-reduced.png', clip: box });
  /* an opened file that holds the same quote twice */
  const saved = await p.evaluate(() => { const st = OV.app.state, j = JSON.parse(OV.store.toJSON(st)), q = j.blocks.fna.quotes[0], c = JSON.parse(JSON.stringify(q)); c.id = 'q-copy'; j.blocks.fna.quotes.push(c); return JSON.stringify(j); });
  const opened = await p.evaluate(t => { const s = OV.store.fromJSON(t); return { n: s.blocks.fna.quotes.length, dups: s.dups }; }, saved);
  ok(opened.n === 1 && opened.dups === 1, '4. a saved file that holds the same quote twice opens with one (and says it dropped one)');

  /* ---- 5. the change moment pay-out ---- */
  await ing([['CMP', 'BR CMPO - 100000031.pdf']], { block: 'cmp' }); await p.waitForTimeout(300);
  await p.evaluate(() => { OV.app.go('fna'); OV.app.openAll(true); }); await p.waitForTimeout(200);
  const po = await p.evaluate(() => { const t = document.querySelector('table.payout'); return { x: t ? t.querySelectorAll('.xbtn, [data-delcmprow]').length : -1, add: document.querySelectorAll('[data-addcmpchild]').length, heads: t ? [...t.querySelectorAll('thead th')].map(h => h.textContent) : [], rows: t ? t.querySelectorAll('tbody tr').length : 0, foot: /rows come from the change moment pay-out guide/.test(document.querySelector('#main').textContent) }; });
  ok(po.x === 0 && po.add === 0 && po.heads.length === 4 && po.rows === 3 && po.foot, '5. the pay-out table has no x on a row, no "+ A child row", four columns and three rows from the guide: ' + JSON.stringify(po));
  ok(await p.evaluate(() => !!document.querySelector('[data-delcmp]')), '5. the whole table can still be removed (Remove) and the quote itself can be replaced or removed');
  await clean(); await p.evaluate(() => document.querySelector('table.payout').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  await p.locator('#main .under').first().screenshot({ path: out + '/r09-payout.png' });

  /* ---- 6. every table is rounded ---- */
  const tabs = ['policies', 'fna', 'group', 'shortfall', 'investments', 'proposed', 'reduced'];
  for (const t of tabs) {
    await p.evaluate(id => { OV.app.go(id); OV.app.openAll(true); }, t); await p.waitForTimeout(120);
    const r = await p.evaluate(() => { const ts = [...document.querySelectorAll('#main table.ovt')]; return { n: ts.length, wrapped: ts.filter(x => x.parentElement.classList.contains('ovw')).length, radius: [...new Set([...document.querySelectorAll('#main .ovw')].map(w => getComputedStyle(w).borderTopLeftRadius))], clip: [...new Set([...document.querySelectorAll('#main .ovw')].map(w => getComputedStyle(w).overflow))] }; });
    ok(r.n === r.wrapped && (r.n === 0 || (r.radius.length === 1 && r.radius[0] === '16px' && r.clip[0] === 'hidden')), '6. ' + t + ': ' + r.n + ' table(s), all rounded 16px: ' + JSON.stringify(r));
  }
  await p.evaluate(() => { OV.app.go('goals'); }); const gr = await p.evaluate(() => [...new Set([...document.querySelectorAll('#main article.qcard')].map(c => getComputedStyle(c).borderTopLeftRadius))]);
  ok(gr.length === 1 && gr[0] === '16px', '6. the cards (goals, other) are rounded 16px too: ' + JSON.stringify(gr));
  await p.evaluate(() => { OV.app.go('other'); }); const gr2 = await p.evaluate(() => [...new Set([...document.querySelectorAll('#main article.qcard')].map(c => getComputedStyle(c).borderTopLeftRadius))]);
  ok(gr2.length === 1 && gr2[0] === '16px', '6. the other-cover cards are rounded 16px');

  /* ---- 7. the left menu for the screenshot: some blocks done, the empty ones red ---- */
  await p.evaluate(() => { OV.app.go('policies'); OV.app.openAll(false); }); await p.evaluate(() => OV.app.checkPass()); await p.waitForTimeout(3800);
  const menu = await p.evaluate(() => [...document.querySelectorAll('#nav button[data-block]')].map(b => b.textContent.trim().replace(/\s+/g, ' ') + ' [' + (b.querySelector('.dot') ? b.querySelector('.dot').className.replace('dot ', '') : '') + ']'));
  console.log('menu: ' + menu.join(' | '));
  await clean(); await p.locator('#nav').screenshot({ path: out + '/r09-menu.png' });
  /* ---- 8. full screen: Paul presents in Microsoft Teams and the client must not see Chrome's tabs, address bar or bookmarks ---- */
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(200);
  const fs = () => p.evaluate(() => ({ el: document.fullscreenElement ? document.fullscreenElement.id : null, btn: document.querySelector('#pBtnFull').textContent, open: OV.present.isOpen, rect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(document.querySelector('#pres').getBoundingClientRect()), win: [innerWidth, innerHeight] }));
  ok(await p.evaluate(() => { const b = document.querySelector('#btnPresentFull'); return b.checkVisibility() && /Present full screen/.test(b.textContent) && document.querySelector('#btnPresent').checkVisibility(); }), '8. the overview has Present and Present full screen');
  await p.click('#btnPresent'); await p.waitForTimeout(500);
  let f = await fs();
  ok(f.open && f.el === null && f.btn === 'Full screen', '8. Present opens the Presentation as before, not in full screen: ' + JSON.stringify(f));
  ok(await p.evaluate(() => [...document.querySelectorAll('#pres .pbar button')].map(b => b.id).join() === 'pBtnFull,pBtnClose' && !document.querySelector('#pBtnFull').hidden), '8. the Presentation\'s top bar has Full screen next to Close');
  await p.click('#pBtnFull'); await p.waitForTimeout(600); f = await fs();
  ok(f.el === 'pres' && f.btn === 'Exit full screen' && f.rect[0] === 0 && f.rect[1] === 0 && f.rect[2] === f.win[0] && f.rect[3] === f.win[1], '8. Full screen puts the Presentation itself in the browser\'s full-screen mode, edge to edge, and the button says Exit full screen: ' + JSON.stringify(f));
  /* everything keeps working in full screen */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(300);
  await p.click('#pres .ptab[data-tab="policies"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => OV.present.ps.tab) === 'policies' && (await fs()).el === 'pres', '8. in full screen a tab click moves to its page and stays in full screen');
  await p.click('#pres .ptab[data-tab="fna"]'); await p.waitForTimeout(300);
  await p.click('#pres th[data-pil]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!OV.present.ps.pil && !!document.querySelector('#pres .hl, #pres [data-pil].on, #pres th.hl, #pres td.hl')), '8. in full screen a column click highlights the column');
  const sw0 = await p.evaluate(() => { const s = document.querySelector('#pres [data-act="keys"]'); return s ? s.getAttribute('aria-checked') : null; });
  if (sw0 !== null) { await p.click('#pres [data-act="keys"]'); await p.waitForTimeout(200); ok(await p.evaluate(() => document.querySelector('#pres [data-act="keys"]').getAttribute('aria-checked')) !== sw0, '8. in full screen the Key points switch turns on and off'); await p.click('#pres [data-act="keys"]'); await p.waitForTimeout(200); }
  else ok(true, '8. (the Key points switch is not on this page)');
  ok(await p.evaluate(() => { const st = document.querySelector('#pStage').getBoundingClientRect(), sl = document.querySelector('#pSlide').getBoundingClientRect(); return sl.width > 200 && sl.left >= st.left - 1 && sl.right <= st.right + 1 && sl.bottom <= st.bottom + 1 && document.querySelector('#pStage').scrollHeight <= document.querySelector('#pStage').clientHeight + 1; }), '8. in full screen the page is drawn to fit the whole monitor and does not scroll');
  await p.evaluate(() => document.querySelector('#toast').hidden = true);
  await p.screenshot({ path: out + '/r09-fullscreen.png' });
  /* Esc leaves full screen first; the next Esc closes the Presentation */
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); f = await fs();
  ok(f.el === null && f.open && f.btn === 'Full screen', '8. the first Esc leaves full screen and the Presentation stays open: ' + JSON.stringify(f));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => OV.present.isOpen)), '8. the next Esc closes the Presentation');
  /* the same button leaves it too, and Present full screen goes straight in */
  await p.click('#btnPresentFull'); await p.waitForTimeout(600); f = await fs();
  ok(f.open && f.el === 'pres' && f.btn === 'Exit full screen', '8. Present full screen opens the Presentation in full screen at once: ' + JSON.stringify(f));
  await p.click('#pBtnFull'); await p.waitForTimeout(500); f = await fs();
  ok(f.open && f.el === null && f.btn === 'Full screen', '8. the same button (Exit full screen) leaves full screen and the Presentation stays open');
  await p.click('#pBtnFull'); await p.waitForTimeout(500); await p.click('#pBtnClose'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !OV.present.isOpen && !document.fullscreenElement && document.querySelector('#pres').hidden), '8. Close in full screen closes the Presentation and leaves full screen too (the overview is not left in full screen)');
  ok(await p.evaluate(() => document.querySelector('#btnPresentFull').checkVisibility()), '8. the overview is back with its buttons');
  ok(!errs.length, '7. no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
