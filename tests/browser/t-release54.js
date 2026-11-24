/* Release 5.4 on the real pages: the Client Overview (stage 2, version 0.1) with an invented client ("Test Client"; no real client data).
   1. It opens whole (no red bar, no errors) with Client details and the eleven blocks. 2. The Fact Find's Other forms menu opens it filled from the client on screen; the two applications link to it.
   3. An FNA quote starts with the lines the Fact Find knows, totals follow typing, the checks speak, the dots follow. 4. Amounts never wrap and there is no sideways scroll bar on any block.
   5. Remove and Undo, N/A cells, opening a saved file again, and unsaved work being offered back. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: '50000' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: '200000', term: '60' } }, { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: '50000' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [], invq: [] } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = []; const watch = p => { p.on('pageerror', e => errs.push(e.message)); return p; };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

  /* ---- 1. it opens whole ---- */
  const ov = watch(await ctx.newPage());
  await ov.goto('file://' + dir + '/overview.html'); await ov.waitForTimeout(400); await ov.evaluate(() => OV.app.openAll());          // the page starts folded (See more); this test is about what is inside
  ok(!(await ov.$('#buildBanner')), '1. no "Mixed versions" bar');
  ok(await ov.evaluate(() => document.title) === 'Client Overview Studio' && /Version (0\.9|1\.[012])/.test(await ov.evaluate(() => document.querySelector('#verLine').textContent)), '1. the page says it is the Client Overview Studio, version 0.9');
  const nav = await ov.evaluate(() => [...document.querySelectorAll('#nav button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(nav.length === 12 && nav[0] === 'Client details' && nav[6] === 'Reduced quotes' && nav[11] === 'Medical aid, will & short-term', '1. the menu: Client details and the eleven blocks in order: ' + nav.join(' | '));
  ok(await ov.evaluate(() => document.querySelectorAll('.dot[data-dot]').length === 11 && document.querySelectorAll('#legend .dot').length === 5), '1. a dot beside each block, and five in the legend under the menu (grey, amber, green, red, dashed)');
  await ov.screenshot({ path: out + '/release54-client.png' });

  /* ---- 2. from the Fact Find ---- */
  const ff = watch(await ctx.newPage());
  await ff.goto('file://' + dir + '/index.html'); await ff.waitForTimeout(500);
  await ff.evaluate(() => {
    const S = FF.app.state, set = (id, v) => FF.store.setField(S, id, v, 'confirmed');
    set('fname', 'Test'); set('sname', 'Client'); set('net', 'R 40 000.00'); set('gross', 'R 50 000.00');
    [['kids', { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' }], ['kids', { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' }],
      ['debts', { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00' }], ['debts', { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: 'R 200 000.00' }], ['debts', { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: 'R 50 000.00' }], ['risk', { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' }],
      ['ret_ra', { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' }]].forEach(x => FF.store.addRow(S, x[0], x[1]));
    FF.app.redraw();
  });
  await ff.click('#otherForms summary');
  const labels = await ff.evaluate(() => [...document.querySelectorAll('#otherForms .ofmenu a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()));
  ok(labels.join('|') === 'Risk Application ↗|Investment Application ↗|Client Overview Studio ↗', '2. the Fact Find\'s Other forms menu lists the two applications and the Client Overview: ' + labels.join(' | '));
  const [ov2] = await Promise.all([ctx.waitForEvent('page'), ff.click('#linkOV')]);
  watch(ov2); await ov2.waitForLoadState(); await ov2.waitForTimeout(700);
  const filled = await ov2.evaluate(() => { const s = OV.app.state, B = s.blocks; return { h: [s.header.fname, s.header.sname, s.header.netIncome, s.header.grossIncome], url: location.search, pol: B.policies.items.map(i => i.insurer + '|' + i.premium + '|' + i.wr), inv: B.investments.items.map(i => i.provider + '|' + i.gross + '|' + i.wr), ff: s.factFind && s.factFind.file, kids: s.factFind && s.factFind.facts.children.length }; });
  ok(filled.h.join('|') === 'Test|Client|40000|50000', '2. opened from the Fact Find\'s link: the client is filled in: ' + filled.h.join('|'));
  ok(filled.pol.join(',') === 'Other Insurer|1200|false' && filled.inv.join(',') === 'Test RA Co|50000|true' && filled.kids === 2, '2. a starting item for each Fact Find row: ' + filled.pol + ' / ' + filled.inv);
  ok(!/from=factfind/.test(filled.url), '2. the ?from= flag is taken out of the address: "' + filled.url + '"');
  ok(/Filled from the Fact Find/.test(await ov2.evaluate(() => document.querySelector('#meta').textContent)), '2. the side card says where it was filled from');
  const direct = watch(await ctx.newPage()); await direct.goto('file://' + dir + '/overview.html'); await direct.waitForTimeout(500);
  ok(await direct.evaluate(() => OV.app.state.header.fname) === '' && !(await direct.evaluate(() => OV.app.state.factFind)), '2. opened on its own, the Overview stays blank even though a hand-over exists');
  for (const [page, sel, base] of [['short-risk.html', '#linkOV', 'overview.html'], ['capture-sheet.html', '#linkOV', 'overview.html']]) {
    const a = watch(await ctx.newPage()); await a.goto('file://' + dir + '/' + page + '?from=factfind'); await a.waitForTimeout(700);
    await a.evaluate(() => { document.querySelector('#otherForms').open = true; });
    const href = await a.evaluate(sel => { const l = document.querySelector(sel); l.addEventListener('click', e => e.preventDefault(), { once: true }); l.click(); return l.getAttribute('href'); }, sel);
    ok(href === base + '?from=factfind', '2. ' + page + ': the Client Overview link carries the same client (' + href + ')');
    const lnk = await a.evaluate(sel => document.querySelector(sel) && document.querySelector(sel).textContent.replace(/\s+/g, ' ').trim(), sel);
    ok(/Client Overview/.test(lnk), '2. ' + page + ': the menu has Client Overview');
  }

  /* ---- 3. an FNA quote ---- */
  const p = ov2;
  await p.evaluate(() => OV.app.go('fna')); await p.click('[data-addq="fna"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => OV.app.state.blocks.fna.quotes[0].lines.map(l => l.type).join(',')) === 'household,child,child,debt,debt,debt,death,dread', '3. a new FNA starts with the household, each child, each debt, death-related needs and dread');
  ok(/Pending client decision/.test(await p.evaluate(() => document.querySelector('.statusbadge').textContent)), '3. a new quote is "Pending client decision"');
  ok(await p.evaluate(() => [...document.querySelectorAll('tr.ln')].filter(r => /N\/A/.test(r.textContent)).length) === 4, '3. death-related needs and dread show N/A in the cells that do not apply, and so do the two child care lines (their waiting period is always N/A)');
  const set = async (path, v) => { const s = '[data-p="' + path + '"]'; await p.fill(s, v); await p.press(s, 'Tab'); };
  const q0 = 'blocks.fna.quotes.0.';
  await set(q0 + 'number', '100000001'); await set(q0 + 'aci', '10'); await set(q0 + 'premium', '2900');
  const money = { 1: [[500000, 5000], [450000, 5000], 0], 2: [[550000, 5000], [480000, 5000], 0], 3: [[1200000, 12000], [1200000, 12000], 12000], 4: [[200000, 4000], [200000, 4000], 4000], 5: [[50000, 1500], [50000, 1500], 1500] };
  for (const i of Object.keys(money)) { const m = money[i], L = q0 + 'lines.' + i + '.'; await set(L + 'life.lump', String(m[0][0])); await set(L + 'life.monthly', String(m[0][1])); await set(L + 'lsd.lump', String(m[1][0])); await set(L + 'lsd.monthly', String(m[1][1])); await set(L + 'ip.monthly', String(m[2])); }
  await set(q0 + 'lines.0.life.lump', '800000'); await set(q0 + 'lines.0.life.monthly', '5000'); await set(q0 + 'lines.0.lsd.lump', '900000'); await set(q0 + 'lines.0.lsd.monthly', '12500'); await set(q0 + 'lines.0.ip.monthly', '22500');
  await set(q0 + 'lines.6.life.lump', '600000'); await set(q0 + 'lines.6.life.monthly', '7500'); await set(q0 + 'lines.7.sev.lump', '500000');
  const tot = await p.evaluate(() => document.querySelector('[data-comp^="qtot"]').innerText.replace(/\s+/g, ' '));
  ok(/Total lump sum R3,900,000 R500,000 R3,280,000/.test(tot), '3. total lump sum is worked out by the page: ' + tot.slice(0, 80));
  ok(/Total income protected R40,000\s?p\.m\. N\/A R40,000\s?p\.m\. R40,000\s?p\.m\./.test(tot), '3. total income protected: R40,000 p.m. in each income-linked pillar, N/A for severe illness: ' + tot.slice(60, 160));
  ok(/Monthly premium.*R2,900/.test(tot), '3. the monthly premium is the bottom row');
  ok(await p.evaluate(() => document.querySelector('h3[data-titlefor]').textContent) === 'BrightRock FNA CP 100000001 · Non-smoker rates', '3. the title follows the CP number: ' + await p.evaluate(() => document.querySelector('h3[data-titlefor]').textContent));
  ok(await p.evaluate(() => /debt/i.test(document.body.textContent) && [...document.querySelectorAll('[data-aci]')].every(e => e.textContent === '10% fixed')), '3. the ACI shows on every line (a figure alone reads "10% fixed")');
  ok(!(await p.evaluate(() => document.querySelector('#checks').textContent.includes('net income'))), '3. a right FNA: no net-income check');
  await set(q0 + 'lines.1.life.monthly', '4000');
  ok(/Life cover protects R39,000 a month/.test(await p.evaluate(() => document.querySelector('#checks').textContent)), '3. a child\'s monthly figure that is not the Fact Find\'s: the checks say so');
  ok(/Amy Client: the quote has R4,000 a month; the Fact Find has R5,000/.test(await p.evaluate(() => document.querySelector('#checks').textContent)), '3. and name the child');
  await set(q0 + 'lines.1.life.monthly', '5000');
  const cmp = await p.evaluate(() => document.querySelector('[data-comp^="cmp"]').innerText.replace(/\s+/g, ' '));
  ok(/What you have now/.test(cmp) && /This quote R3,900,000/.test(cmp) && /Difference \+R3,900,000/.test(cmp), '3. "compared with what you have now": three rows: ' + cmp.slice(0, 160));
  await p.evaluate(() => OV.app.go('shortfall'));
  ok(/Life cover R3,900,000 none R50,000 R3,850,000/.test(await p.evaluate(() => document.querySelector('[data-comp="sf|"]').innerText.replace(/\s+/g, ' '))), '3. the shortfall is worked out: the personal investment (the retirement annuity) is taken off the life cover only');
  const dots = await p.evaluate(() => [...document.querySelectorAll('.dot')].map(d => d.className.replace('dot ', '')));
  ok(dots[1] === 'amber' && dots[3] === 'green' && dots[0] === 'grey', '3. the dots: policies grey, FNA amber, shortfall green: ' + dots.join(','));
  await p.screenshot({ path: out + '/release54-shortfall.png', fullPage: true });

  /* ---- 4. layout ---- */
  for (const id of ['_client', 'policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other']) {
    await p.evaluate(i => OV.app.go(i), id); await p.waitForTimeout(50);
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, mainOver: (() => { const m = document.querySelector('#main'); return m.scrollWidth > m.clientWidth + 1; })() }));
    ok(w.sw <= w.iw + 1 && !w.mainOver, '4. no sideways scroll bar on ' + id + ' (page ' + w.sw + ' of ' + w.iw + ')');
    const wraps = await p.evaluate(() => [...document.querySelectorAll('.ovt .a')].filter(e => getComputedStyle(e).whiteSpace !== 'nowrap').length);
    ok(wraps === 0, '4. every amount on ' + id + ' is kept on one line');
  }
  await p.evaluate(() => OV.app.go('fna')); await p.screenshot({ path: out + '/release54-fna.png', fullPage: true });

  /* ---- 5. remove and undo; save file and open it again; unsaved work offered back ---- */
  ok(await p.evaluate(() => !document.querySelector('.qcard table.lines .xbtn') && document.querySelectorAll('.qcard table.lines thead th').length === 9), '5. a quote\'s lines have no remove column (they come from the quote)');
  await p.evaluate(() => { OV.store.setRemoved(OV.app.state, 'blocks.fna.quotes.0.lines.1', true); OV.app.redraw(); }); await p.waitForTimeout(100);
  ok(/R3,400,000/.test(await p.evaluate(() => document.querySelector('[data-comp^="qtot"]').textContent.replace(/\s+/g, ''))), '5. a line that is marked removed (an older file) is left out of the totals');
  await p.evaluate(() => { OV.store.setRemoved(OV.app.state, 'blocks.fna.quotes.0.lines.1', false); OV.app.redraw(); }); await p.waitForTimeout(100);
  ok(/R3,900,000/.test(await p.evaluate(() => document.querySelector('[data-comp^="qtot"]').textContent.replace(/\s+/g, ''))), '5. and back in when it is not');
  p.on('dialog', d => d.accept());
  await p.click('[data-del="blocks.fna.quotes.0"]'); await p.waitForTimeout(100);
  ok(/removed/.test(await p.evaluate(() => document.querySelector('#main').textContent)) && !(await p.$('.qcard')), '5. a removed quote is hidden, with Undo');
  await p.click('[data-undo="blocks.fna.quotes.0"]'); await p.waitForTimeout(100);
  const text = await p.evaluate(() => OV.store.toJSON(OV.app.state));
  const j = JSON.parse(text);
  ok(j.app === 'wr-overview' && j.schema === '0.1' && j.computed.shortfall && j.blocks.fna.quotes[0].lines.length === 8, '5. the saved file has the contract\'s layout, with the figures written for readers');
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });                          // a new browser profile: the work above is not offered back here
  const reopen = watch(await ctx2.newPage()); await reopen.goto('file://' + dir + '/overview.html'); await reopen.waitForTimeout(400);
  await reopen.setInputFiles('#fileIn', { name: 'WR Overview - 21.11.26 - (Client, Test).json', mimeType: 'application/json', buffer: Buffer.from(text) }); await reopen.waitForTimeout(400);
  ok(await reopen.evaluate(() => OV.app.state.blocks.fna.quotes[0].number) === '100000001' && await reopen.evaluate(() => OV.app.state.header.fname) === 'Test', '5. opened again, the file brings everything back');
  ok(/WR Overview - 21\.11\.26 - \(Client, Test\)/.test(await reopen.evaluate(() => document.querySelector('#saveState').textContent)), '5. it saves under the same name');
  await reopen.setInputFiles('#fileIn', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"wr-fact-find"}') }); await reopen.waitForTimeout(300);
  ok(/not a Wealth Revolution Client Overview/.test(await reopen.evaluate(() => document.querySelector('#toast').textContent)), '5. a file that is not an overview is refused, in plain words');
  const ctx3 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const draft = watch(await ctx3.newPage()); await draft.goto('file://' + dir + '/overview.html'); await draft.waitForTimeout(300);
  await draft.fill('[data-p="header.fname"]', 'Test'); await draft.fill('[data-p="header.sname"]', 'Client'); await draft.waitForTimeout(100);
  await draft.reload(); await draft.waitForTimeout(500);
  ok(await draft.evaluate(() => !!document.querySelector('#restoreDraft[open]')) && /Restore Test Client/.test(await draft.evaluate(() => document.querySelector('#restoreYes').textContent)), '5. unsaved work is offered back after a reload (restore or start new)');
  await draft.click('#restoreYes'); await draft.waitForTimeout(200);
  ok(await draft.evaluate(() => OV.app.state.header.sname) === 'Client', '5. Restore brings the unsaved work back');

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
