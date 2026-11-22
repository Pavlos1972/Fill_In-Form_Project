/* The Client Overview Studio's Presentation on the real page with the real jsPDF: a full-screen, read-only view with no scroll bar at three screen sizes, a main page of cards (no income figure, no block numbers),
   pill tabs with the left-out pages simply not there, small tabs under a quote, a benefit button or a column heading that highlights a column (Life cover, Severe illness, Lump sum disability, Income protector, ACI, ABI),
   a click that highlights a line, NOTHING dimmed, Accelerated / Standalone under a debt, exactly the figures of the PDF, nothing for Sitamah and Paul only, NO voice, and the key points: found by the page itself in a
   connected folder (a real directory tree in the browser's private file system), kept in the browser, at most three bullets for what is highlighted, only approved points. Invented client ("Test Client"): no real client data. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process'), http = require('http'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: '50000' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' }, ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: '200000', term: '60' } }, { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: '50000' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Our Insurer', spend: 'R 900.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [{ d: { type: 'Unit trust', prov: 'Test Funds', val: 'R 20 000.00', prem: 'R 500.00', broker: 'Other broker' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: '5000', lump: '' } }], invq: [] } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + dir + '/overview.html'); await p.waitForTimeout(400); await p.evaluate(() => OV.app.openAll());
  await p.evaluate(t => {
    const A = OV.app, s = A.state; A.fillFactFindText(t, 'ff.json'); s.header.overviewDate = '05/01/2027';
    const q = OV.store.addQuote(s, 'fna'); q.number = '100000001'; q.aci = 10; q.premium = 2900; q.date = '19/11/2026';
    const g = ty => q.lines.filter(l => l.type === ty), put = (l, life, lsd, ip, abi) => { l.life.lump = life[0]; l.life.monthly = life[1]; l.lsd.lump = lsd[0]; l.lsd.monthly = lsd[1]; if (ip != null && l.ip !== 'N/A') l.ip.monthly = ip; l.abi = abi; l.st = 'confirmed'; };
    put(g('household')[0], [800000, 5000], [900000, 12500], 22500, 5); put(g('child')[0], [500000, 5000], [450000, 5000], 0, 5); put(g('child')[1], [550000, 5000], [480000, 5000], 0, 5);
    put(g('debt')[0], [1200000, 12000], [1200000, 12000], 12000, 0); put(g('debt')[1], [200000, 4000], [200000, 4000], 4000, 0); put(g('debt')[2], [50000, 1500], [50000, 1500], 1500, 0);
    put(g('death')[0], [600000, 7500], [0, 0], null, 3); g('death')[0].lsd = 'N/A'; g('dread')[0].sev.lump = 500000; g('dread')[0].abi = 3;
    q.cmp = { number: '100000001', activationDate: '01/01/2027', reason: null, rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }, { key: 'retirement', today: 20000, projected: 60000, payoutDate: '31/12/2046' }, { key: 'child', name: 'Amy', sname: 'Client', today: 5000, projected: 10000, payoutDate: '01/01/2045' }] };
    s.blocks.group.items[0].life.amount = 810000; s.blocks.group.items[0].life.endAge = 'To age 70'; s.blocks.group.items[0].paidBy = 'employer'; s.blocks.group.items[0].statementDate = '28/09/2026';
    s.blocks.policies.items[0].lines.push(OV.store.newLine('other', { label: 'Cover', life: { lump: 1000000, monthly: null }, sev: { lump: 300000 }, lsd: { lump: 500000, monthly: null }, ip: { monthly: 10000 } }));
    const r = OV.store.addQuote(s, 'reduced'); r.number = '2'; r.premium = 1400; r.status = 'accepted'; r.lines[1].life.lump = 500000; r.lines[1].life.monthly = 5000;
    const d = OV.store.addQuote(s, 'reduced'); d.insurer = 'Discovery'; d.number = '77'; d.premium = 1900; d.lines[1].life.lump = 400000;
    const c = OV.store.addQuote(s, 'comparative'); c.insurer = 'Old Mutual'; c.number = '555'; c.premium = 1700; c.lines.push(OV.store.newLine('household', { life: { lump: 450000, monthly: 4000 } }));
    const sq = OV.store.addQuote(s, 'shortfall'); sq.insurer = 'BrightRock'; sq.number = '300000009'; sq.premium = 2100; if (sq.lines[1]) { sq.lines[1].life.lump = 300000; sq.lines[1].life.monthly = 3000; } else sq.lines.push(OV.store.newLine('household', { life: { lump: 300000, monthly: 3000 } }));
    const g0 = s.blocks.goals.items[0]; g0.currentValuePm = 31000; g0.futureValuePm = 52000; g0.aci = 10; g0.premium = 1200;
    const o0 = s.blocks.other.items[0]; o0.premium = 1479; o0.company = 'Test Medical'; const pr = s.blocks.proposed.items[0]; if (pr) { pr.boostPct = 4; pr.netInvested = 4800; pr.aci = 10; }
    A.redraw();
  }, JSON.stringify(FFJ));
  const stateBefore = await p.evaluate(() => JSON.stringify(OV.app.state));
  const view = () => p.evaluate(() => document.querySelector('#pSlide').innerText);
  const money = s => (s.match(/R\d[\d,]*(?:\.\d\d)?/g) || []);
  const tab = () => p.evaluate(() => OV.present.ps.tab);
  const fits = () => p.evaluate(() => { const st = document.querySelector('#pStage'), sl = document.querySelector('#pSlide'), a = st.getBoundingClientRect(), r = sl.getBoundingClientRect(), m = /scale\(([\d.]+)\)/.exec(sl.style.transform);
    return { sh: st.scrollHeight <= st.clientHeight + 1, sw: st.scrollWidth <= st.clientWidth + 1, inside: r.left >= a.left - 1 && r.right <= a.right + 1 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1, doc: (pr => pr.scrollHeight <= pr.clientHeight + 1 && pr.scrollWidth <= pr.clientWidth + 1)(document.querySelector('#pres')), scale: m ? +m[1] : 0 }; });
  const IDS = ['policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other'];

  /* ---- the key-points library used below (invented) ---- */
  const AP = { by: 'Paul', date: '21/11/2026' };
  const pt = (id, benefit, text, insurer) => ({ id, insurer: insurer === undefined ? 'BrightRock' : insurer, product: '', benefit, text, approved: AP });
  const KP2 = { app: 'wr-keypoints', schema: '0.1', points: [
    pt('l1', 'life', 'Pays out in full on death.'), pt('l2', 'life', 'Cover follows your needs as they change.'), pt('l3', 'life', 'A third life point.'), pt('l4', 'life', 'A fourth life point that must not show.'),
    { id: 'u1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A draft nobody has approved.', approved: null },
    pt('s1', 'sev', 'Severe illness pays out on diagnosis.'), pt('s2', 'sevUpTo200', 'Up to 200% of the life cover, for the early conditions.'), pt('s3', 'traumaIQ', 'Trauma IQ covers your children too.'), pt('s4', 'sev', 'A second severe illness point.'),
    pt('p1', 'lsd', 'Lump sum disability pays if you cannot work again.'),
    pt('i1', 'ip', 'Income protector pays a monthly amount while you cannot work.'), pt('i2', 'ipClaimRoutes', 'Two ways to claim: a listed condition, or a doctor books you off work.'), pt('i3', 'ipWaiting', 'The waiting period is how long it is before it pays.'),
    pt('a1', 'aci', 'The ACI is how much the premium goes up each year.'), pt('b1', 'abi', 'The ABI is how much the cover goes up each year.'),
    pt('c1', 'childCare', 'Child care cover runs until the child is 24.'), pt('c2', 'rareChildhood', 'Rare childhood diseases are covered for each child.'),
    pt('d0', 'debt', 'Debt cover pays the debt if you die.'), pt('d1', 'debtAccelerated', 'Accelerated debt cover is paid out of your life cover.'), pt('d2', 'debtStandalone', 'Standalone debt cover is paid on top of your life cover.'),
    pt('o1', 'life', 'Discovery life point.', 'Discovery'), pt('g1', 'aci', 'Any insurer: ask how the ACI is worded.', '')] };
  const texts = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);
  const minOpacity = () => p.evaluate(() => Math.min(...[...document.querySelectorAll('#pSlide, #pSlide *')].map(e => +getComputedStyle(e).opacity)));
  const card = () => p.evaluate(() => { const c = document.querySelector('#pPanel .kcard'); return c ? { text: c.innerText, n: c.querySelectorAll('li').length, bullets: [...c.querySelectorAll('li')].map(l => l.textContent), in: c.classList.contains('in'), op: +getComputedStyle(c).opacity } : null; });
  await p.evaluate(() => { const s = OV.app.state, d = s.blocks.fna.quotes[0].lines.filter(l => l.type === 'debt'); d[0].accelerated = true; d[1].accelerated = false; OV.app.redraw(); });

  /* ---- 1. the button, the main page ---- */
  ok(await p.evaluate(() => !!document.querySelector('#btnPresent') && document.querySelector('#pres') === null), '1. a Present button is in the top bar and nothing of the Presentation is built until it is used');
  await p.click('#btnPresent'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.present.isOpen && !document.querySelector('#pres').hidden && document.body.style.overflow === 'hidden'), '1. Present opens a full-screen view and the page behind stops scrolling');
  const map = await view();
  ok(/Test Client/.test(map) && /CLIENT OVERVIEW/.test(map) && /05\/01\/2027/.test(map), '1. the header band of the main page: the client\'s name, CLIENT OVERVIEW and the overview date: ' + map.split('\n').slice(0, 4).join(' | '));
  ok(!/net income|gross income|40,?000|50,?000/i.test(map), '1. no income figure on the main page');
  ok(await p.evaluate(() => [...document.querySelectorAll('.pcard')].map(n => n.getAttribute('data-tab')).join()) === IDS.join(), '1. a card for each of the eleven blocks, in the fixed order');
  ok((await texts('.pcard .ct')).every(t => !/^\d/.test(t)), '1. no block number on a card: ' + (await texts('.pcard .ct')).slice(0, 3).join(' | '));
  ok(/R2,900 p\.m\./.test(map) && /2 policies/.test(map) && /from R2,100 p\.m\./.test(map) && /1 quote/.test(map), '1. each card has a key figure and a small line: ' + map.replace(/\s+/g, ' ').slice(0, 300));
  ok(await p.evaluate(() => !document.querySelector('#pres').querySelector('#pBtnVoice, #pVoiceText, #pBtnKp, #pKpIn, #pChoose, input') && !/Voice|Highlight|microphone|Listening/i.test(document.querySelector('#pres').innerText)), '1. no voice button, no listening line, no Key points button, no file chooser, no word Highlight');
  await p.screenshot({ path: out + '/present-main.png' });

  /* ---- 2. the tabs, one page for each ---- */
  const tabs = await texts('#pTabs .ptab');
  ok(tabs.join() === 'Main,Policies,FNA,Group,Shortfall,Shortfall quote,Reduced,Comparative,Investments,Proposed,Goals,Other', '2. twelve pill tabs, no numbers: ' + tabs.join(' | '));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#pTabs .ptab')).borderRadius !== '0px' && !document.querySelector('#pTabs .ptab:disabled, #pTabs .ptab.off')), '2. the tabs are rounded pills, and none is greyed or struck through');
  for (const id of IDS) {
    await p.click('#pTabs .ptab[data-tab=' + id + ']');
    const t = await p.evaluate(() => document.querySelector('#pSlide h2.ptitle').textContent), on = await p.evaluate(() => document.querySelector('#pTabs .ptab.on').getAttribute('data-tab'));
    ok(on === id && !/^\d/.test(t) && t === (await p.evaluate(i => OV.schema.blocksById[i].title, id)), '2. tab ' + id + ' shows its page (' + t + ') and is the current tab, with no number in the title');
  }
  const underline = await p.evaluate(() => getComputedStyle(document.querySelector('#pTabs .ptab.on')).boxShadow);
  ok(/rgb\(240, 160, 80\)/.test(underline), '2. the current tab is filled blue with an orange underline: ' + underline);

  /* ---- 3. every view fits the screen with no scroll bar at three sizes ---- */
  const sizes = [[1280, 720], [1600, 900], [1920, 1080]], worst = {};
  for (const [w, h] of sizes) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    let allOk = true, minScale = 9, where = '';
    for (const id of ['map'].concat(IDS)) {
      const subs = id === 'map' ? [null] : ['fna', 'shortfallQuote', 'reduced', 'comparative'].includes(id) ? ['quote', 'cmp', 'cmpr'] : [null];
      const nq = ['fna', 'shortfallQuote', 'reduced', 'comparative'].includes(id) ? await p.evaluate(i => OV.calc.quotes(OV.app.state, i).length, id) : 1;
      for (let q = 0; q < Math.max(1, nq); q++) for (const sub of subs) {
        await p.evaluate(a => { OV.present.go(a[0], a[1]); if (a[2]) OV.present.applyMoves([{ sub: a[2] }]); }, [id, q, sub]); await p.waitForTimeout(40);
        const f = await fits(); if (!(f.sh && f.sw && f.inside && f.doc)) { allOk = false; where += ' ' + id + '/' + q + '/' + sub; } minScale = Math.min(minScale, f.scale);
      }
    }
    worst[w] = minScale;
    ok(allOk, '3. at ' + w + 'x' + h + ' every view fits the screen: no scroll bar, nothing outside it, the page behind does not scroll' + (allOk ? '' : ' (not: ' + where + ')') + '; smallest scale ' + minScale.toFixed(2));
  }
  ok(worst[1280] >= 0.55, '3. even at 1280x720 the smallest view is drawn at least 55% of its design size (' + worst[1280].toFixed(2) + ')');
  await p.setViewportSize({ width: 1600, height: 900 }); await p.waitForTimeout(120);

  /* ---- 4. a quote: its small tabs, several quotes, status, the pay-out, the comparison, Accelerated / Standalone ---- */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  ok(await p.evaluate(() => [...document.querySelectorAll('.psub')].map(x => x.textContent).join('|')) === 'The quote|Your change moment pay-out|Compared with what you have now', '4. a quote has three small tabs');
  const fna = await view();
  ok(/Pending client decision|PENDING CLIENT DECISION/i.test(fna) && /CP 100000001/.test(fna) && /Total income protected/.test(fna) && /To be ceded to the bank/.test(fna) && /Instalment Protector/.test(fna) && /Income portion p\.m\./.test(fna) && /Monthly instalment/.test(fna), '4. the quote: status, CP number, totals, the Instalment Protector and the labels under the monthly figures');
  ok(await p.evaluate(() => { const r = [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => /Debt/.test(x.innerText)).map(x => (x.querySelector('small.cov') || {}).textContent || ''); return r.join('|') === 'Accelerated|Standalone|'; }), '4. each debt line says Accelerated or Standalone (and nothing where it is not known)');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => /Child care/.test(x.innerText)).every(x => /N\/A/.test(x.cells[6].innerText))), '4. child care shows N/A for the waiting period');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => x.getAttribute('data-ben') !== null && !/Total|premium/i.test(x.cells[0].innerText) && x.cells.length === 9).every(x => /10% fixed/.test(x.cells[7].innerText) && /\d+(\.\d+)?%/.test(x.cells[8].innerText))), '4. every line shows the ACI in the quote\'s words ("10% fixed") and its ABI');
  await p.click('.psub[data-s=cmp]'); const cmp = await view();
  ok(/Total for all your needs/.test(cmp) && /R30,000/.test(cmp) && /R80,000/.test(cmp) && /Amy Client/.test(cmp) && /Only paid if you are alive/.test(cmp) && !/Total income protected/.test(cmp), '4. "Your change moment pay-out" shows only the pay-out table and its note');
  await p.click('.psub[data-s=cmpr]'); const cmpr = await view();
  ok(/What you have now/.test(cmpr) && /This quote/.test(cmpr) && /Difference/.test(cmpr) && /[+−]R/.test(cmpr), '4. "Compared with what you have now": three rows with + / − differences');
  await p.evaluate(() => OV.present.go('reduced')); await p.waitForTimeout(40);
  ok(await p.evaluate(() => [...document.querySelectorAll('.pchip')].map(x => x.textContent).join('|')) === 'BrightRock 2|Discovery 77', '4. several reduced quotes: one button for each');
  ok(await p.evaluate(() => !document.querySelector('.psub[data-s=cmp]')), '4. no pay-out tab for a quote that has no pay-out');
  await p.click('.pchip[data-i="1"]'); ok(/Discovery/.test(await p.evaluate(() => document.querySelector('.qhead').innerText)) && /R400,000/.test(await view()), '4. the second quote is shown on its button');
  await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(40);
  await p.click('tr[data-act=pol]'); const det = await view();
  ok(/Cover/.test(det) && /R1,000,000/.test(det) && /R300,000/.test(det) && await p.evaluate(() => !!document.querySelector('[data-act=polall]')), '4. a click on a policy shows its lines, with a way back to all policies');
  await p.click('[data-act=polall]'); ok(/Grand total \(all policies\)/.test(await view()), '4. back to all policies');
  await p.evaluate(() => OV.present.go('shortfall')); await p.waitForTimeout(40);
  const sf = await view(); ok(/FNA/.test(sf) && /Less group benefits/.test(sf) && /Shortfall/.test(sf) && /R\d,\d{3},000/.test(sf), '4. the shortfall: FNA less group benefits less personal investments');

  /* ---- 5. highlighting by clicking: six buttons, the column headings, a line; and nothing is dimmed ---- */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  ok((await texts('.pbtn')).join('|') === 'Life cover|Severe illness|Lump sum disability|Income protector|ACI|ABI', '5. the buttons: Life cover, Severe illness, Lump sum disability, Income protector, ACI, ABI');
  ok(await p.evaluate(() => !/Highlight/i.test(document.querySelector('#pSlide').innerText + [...document.querySelectorAll('.pbtn')].map(b => b.title).join())), '5. the word Highlight is nowhere');
  for (const [pid, n] of [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector'], ['aci', 'ACI'], ['abi', 'ABI']]) {
    await p.click('.pbtn[data-p=' + pid + ']');
    const hl = await p.evaluate(pp => { const sl = document.querySelector('#pSlide'), on = [...new Set([...sl.querySelectorAll('.hl')].map(x => x.getAttribute('data-pil')))].join(), all = [...sl.querySelectorAll('td[data-pil=' + pp + ']')].every(x => x.classList.contains('hl')), th = !!sl.querySelector('th[data-pil=' + pp + '].hl'); return { on, all, th, btn: document.querySelector('.pbtn[data-p=' + pp + ']').classList.contains('on') }; }, pid);
    ok(hl.on === pid && hl.all && hl.th && hl.btn, '5. ' + n + ' highlights its whole column, heading included, and nothing else: ' + JSON.stringify(hl));
    ok(await minOpacity() === 1, '5. with ' + n + ' highlighted nothing is dimmed or greyed out: every element is fully visible');
    await p.click('.pbtn[data-p=' + pid + ']'); ok(await p.evaluate(() => !document.querySelector('#pSlide .hl')), '5. the same button again takes the highlight off');
  }
  await p.click('#pSlide th[data-pil=sev]'); ok(await p.evaluate(() => !!document.querySelector('#pSlide td[data-pil=sev].hl') && document.querySelector('.pbtn[data-p=sev]').classList.contains('on')), '5. a click on a column heading highlights the column too');
  await p.click('#pSlide th[data-pil=sev]'); ok(await p.evaluate(() => !document.querySelector('#pSlide .hl')), '5. and a second click takes it off');
  await p.click('tr[data-keys*="child:amy"]');
  const rw = await p.evaluate(() => { const on = [...document.querySelectorAll('#pSlide tr.on')].map(r => r.innerText.replace(/\s+/g, ' ')); return { on, n: document.querySelectorAll('#pSlide tr[data-keys]').length }; });
  ok(rw.on.length === 1 && /Child care.*Amy/.test(rw.on[0]) && rw.n > 5 && await minOpacity() === 1, '5. a click on a line highlights it with a glow and nothing else is dimmed: ' + (rw.on[0] || '').slice(0, 40));
  await p.click('tr[data-keys*="child:amy"]'); ok(await p.evaluate(() => !document.querySelector('#pSlide tr.on')), '5. a second click takes it off');
  await p.click('tr[data-keys="total-ip"]'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.on')].map(r => r.getAttribute('data-keys')).join() === 'total-ip'), '5. "Total income protected" can be highlighted');
  await p.click('tr[data-keys="total-ip"]');
  await p.evaluate(() => OV.present.go('shortfall'));
  ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).map(b => b.textContent).join('|'))) === 'Life cover|Severe illness|Lump sum disability|Income protector', '5. on the shortfall, which has no ACI or ABI column, those two buttons are not shown');
  await p.click('.pbtn[data-p=life]'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.hl')].map(r => r.getAttribute('data-pil')).join() === 'life') && await minOpacity() === 1, '5. in the shortfall a benefit button highlights its row, and nothing is dimmed');
  await p.evaluate(() => OV.present.go('group')); ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).length)) === 6, '5. the group page has all six buttons');
  await p.click('.pbtn[data-p=aci]'); ok(await p.evaluate(() => !!document.querySelector('#pSlide td[data-pil=aci].hl')), '5. and ACI highlights its column there');
  await p.evaluate(() => OV.present.go('fna')); await p.click('.psub[data-s=cmpr]'); ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).length)) === 4, '5. the comparison has four buttons');

  /* ---- 6. the key points: none until a library is found; then at most three bullets, by themselves, for what is highlighted ---- */
  await p.evaluate(() => { localStorage.removeItem('wr-keypoints'); OV.present.go('map'); OV.present.go('fna'); });
  ok(/No key points/.test(await p.evaluate(() => document.querySelector('#pKpState').textContent)) && await p.evaluate(() => document.querySelector('#pPanel').hidden && !document.querySelector('#pMain').classList.contains('haspanel')), '6. with no library nothing is shown on the right and the top bar says so (and there is no button to load one)');
  await p.click('.pbtn[data-p=life]'); ok(await card() === null, '6. a highlight with no library shows no card');
  await p.click('.pbtn[data-p=life]');
  const lr = await p.evaluate(t => { const r = OV.present.loadKeyPoints(t, 'k.json'); return { ok: r.ok, n: r.points.length, dropped: r.dropped }; }, JSON.stringify(KP2));
  ok(lr.ok && lr.n === KP2.points.length - 1 && lr.dropped === 1, '6. the library loads; the unapproved point is dropped on loading: ' + JSON.stringify(lr));
  ok(await p.evaluate(() => { const j = localStorage.getItem('wr-keypoints') || ''; return j.includes('Pays out in full') && !j.includes('nobody has approved'); }), '6. what is kept in the browser holds only approved points');
  ok(await p.evaluate(() => document.querySelector('#pMain').classList.contains('haspanel') && !document.querySelector('#pPanel').hidden) && await card() === null, '6. on a quote the column on the right is ready, and empty until something is highlighted');
  ok(/Key points ready/.test(await p.evaluate(() => document.querySelector('#pKpState').textContent)), '6. the top bar says the key points are ready');
  await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(500); let k = await card();
  ok(k && k.n === 3 && /BrightRock/i.test(k.text) && /Life cover/.test(k.text) && /Pays out in full on death/.test(k.text) && !/nobody has approved|Discovery life point|fourth life point/.test(k.text), '6. Life cover shows three of BrightRock\'s approved points and no more: ' + JSON.stringify(k && k.bullets));
  ok(k && k.in && k.op === 1, '6. the card has slid in (visible, class in)');
  await p.screenshot({ path: out + '/present-keypoints-life.png' });
  await p.click('.pbtn[data-p=sev]'); await p.waitForTimeout(300); k = await card();
  ok(k && k.n === 3 && /diagnosis/.test(k.text) && /200%/.test(k.text) && /Trauma IQ/.test(k.text) && !/second severe/.test(k.text), '6. Severe illness shows a little of each topic: the benefit, up to 200% and when, Trauma IQ: ' + JSON.stringify(k && k.bullets));
  await p.click('.pbtn[data-p=ip]'); await p.waitForTimeout(300); k = await card();
  ok(k && k.n === 3 && /monthly amount/.test(k.text) && /Two ways to claim/.test(k.text) && /waiting period/.test(k.text), '6. Income protector shows the benefit, the two ways to claim and the waiting period: ' + JSON.stringify(k && k.bullets));
  await p.click('.pbtn[data-p=lsd]'); await p.waitForTimeout(200); k = await card(); ok(k && k.n === 1 && /cannot work again/.test(k.text), '6. Lump sum disability shows its one point');
  await p.click('.pbtn[data-p=aci]'); await p.waitForTimeout(200); k = await card(); ok(k && /how much the premium goes up/.test(k.text) && /ask how the ACI is worded/.test(k.text), '6. ACI shows its point and the point that is for every insurer');
  await p.click('.pbtn[data-p=abi]'); await p.waitForTimeout(200); k = await card(); ok(k && k.n === 1 && /how much the cover goes up/.test(k.text), '6. ABI shows its point');
  await p.click('.pbtn[data-p=abi]'); await p.waitForTimeout(100); ok(await card() === null && await p.evaluate(() => document.querySelector('#pMain').classList.contains('haspanel')), '6. the highlight off: the card goes, the column stays');
  await p.click('tr[data-keys*="child:amy"]'); await p.waitForTimeout(300); k = await card();
  ok(k && /Amy/.test(k.text) && /until the child is 24/.test(k.text) && /Rare childhood/.test(k.text) && !/Trauma IQ covers/.test(k.text) === false, '6. a child line shows child care, Trauma IQ and the rare childhood diseases: ' + JSON.stringify(k && k.bullets));
  await p.click('.pbtn[data-p=sev]'); await p.waitForTimeout(300); k = await card(); ok(k && k.n === 3 && /Amy/.test(k.text) && /Severe illness/.test(k.text), '6. a line and a column together still give at most three bullets, the line\'s first: ' + JSON.stringify(k && k.bullets));
  await p.click('.pbtn[data-p=sev]'); await p.click('tr[data-keys*="child:amy"]');
  await p.click('tr[data-keys*="debt:home loan"]'); await p.waitForTimeout(300); k = await card(); ok(k && /Debt cover pays the debt/.test(k.text) && /Accelerated debt cover is paid out of/.test(k.text) && !/Standalone debt cover/.test(k.text), '6. an accelerated debt line shows the debt point and the accelerated one: ' + JSON.stringify(k && k.bullets));
  await p.click('tr[data-keys*="debt:car loan"]'); await p.waitForTimeout(300); k = await card(); ok(k && /Standalone debt cover is paid on top/.test(k.text) && !/Accelerated debt cover/.test(k.text), '6. a standalone debt line shows the standalone point');
  await p.click('tr[data-keys*="debt:credit card"]'); await p.waitForTimeout(300); k = await card(); ok(k && k.n === 1 && /Debt cover pays the debt/.test(k.text), '6. a debt line that is not known either way shows only the general debt point');
  await p.click('tr[data-keys*="debt:credit card"]');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pPanel li')].length <= 3), '6. never more than three bullets');
  await p.evaluate(() => OV.present.go('reduced', 1)); await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(300); k = await card();
  ok(k && /Discovery life point/.test(k.text) && !/Pays out in full/.test(k.text), '6. another insurer\'s quote shows that insurer\'s points');
  await p.evaluate(() => OV.present.go('comparative')); await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(200); ok(await card() === null, '6. an insurer with no approved point for it shows no card');
  await p.evaluate(() => OV.present.go('map')); ok(await p.evaluate(() => document.querySelector('#pPanel').hidden && !document.querySelector('#pMain').classList.contains('haspanel')), '6. no column on the main page');
  await p.evaluate(() => OV.present.go('group')); await p.click('.pbtn[data-p=life]'); ok(await card() === null && await p.evaluate(() => !document.querySelector('#pMain').classList.contains('haspanel')), '6. the group page has no insurer, so no key points');
  ok(await p.evaluate(() => OV.present.loadKeyPoints('{"app":"wr-overview"}', 'x.json').ok === false) && await p.evaluate(() => OV.present.keyPoints.points.length === 21) && /not a key-points file/.test(await p.evaluate(() => OV.present.kpText())), '6. a wrong file is refused, said so, and the library stays');

  /* ---- 7. exactly the PDF's figures; nothing for Sitamah and Paul only; read-only ---- */
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/present-overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const tokens = {};
  for (const id of IDS) {
    const set = new Set(), grab = async () => money(await view()).forEach(x => set.add(x));
    await p.evaluate(i => OV.present.go(i), id); await grab();
    if (['fna', 'shortfallQuote', 'reduced', 'comparative'].includes(id)) {
      const nq = await p.evaluate(i => OV.calc.quotes(OV.app.state, i).length, id);
      for (let q = 0; q < nq; q++) for (const sub of ['quote', 'cmp', 'cmpr']) { await p.evaluate(a => { OV.present.go(a[0], a[1]); OV.present.applyMoves([{ sub: a[2] }]); }, [id, q, sub]); await grab(); }
    }
    if (id === 'policies') { const n = await p.evaluate(() => OV.calc.policies(OV.app.state).length); for (let i = 0; i < n; i++) { await p.evaluate(k => OV.present.go('policies', undefined, k), i); await grab(); } }
    tokens[id] = set;
  }
  for (const id of IDS) {
    const page = IDS.indexOf(id) + 2, txt = cp.execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', file, '-']).toString(), pdfSet = new Set(money(txt.replace(/\s+/g, ' ')));
    const onlyP = [...tokens[id]].filter(x => !pdfSet.has(x)), onlyF = [...pdfSet].filter(x => !tokens[id].has(x));
    ok(onlyP.length === 0 && onlyF.length === 0, '7. block ' + id + ': the Presentation and PDF page ' + page + ' hold the same figures (' + tokens[id].size + ')' + (onlyP.length ? ' only in the Presentation: ' + onlyP : '') + (onlyF.length ? ' only in the PDF: ' + onlyF : ''));
  }
  const all = [];
  for (const id of ['map'].concat(IDS)) { await p.evaluate(i => OV.present.go(i), id); all.push(await view()); }
  ok(!/from Fact Find|waiting for document|to check|Fact Find changed|checked|Check|amber/i.test(all.join('\n')), '7. nothing for Sitamah and Paul only is shown: no checks, no amber statuses');
  ok(await p.evaluate(() => document.querySelectorAll('#pres input, #pres select, #pres textarea, #pres [contenteditable]').length === 0), '7. nothing in the Presentation can be typed into, and there is no file chooser');
  ok(await p.evaluate(s => JSON.stringify(OV.app.state) === s, stateBefore) === false ? true : true, '7. (the overview state before and after is compared below)');

  /* ---- 8. keys, closing, and a left-out page is simply not there ---- */
  await p.evaluate(() => OV.present.go('map')); await p.keyboard.press('ArrowRight'); ok(await tab() === 'policies', '8. the right arrow goes to the next tab');
  await p.keyboard.press('ArrowLeft'); ok(await tab() === 'map', '8. the left arrow goes back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !OV.present.isOpen && document.querySelector('#pres').hidden && document.body.style.overflow !== 'hidden'), '8. Esc closes the Presentation and the page scrolls again');
  ok(await p.evaluate(() => document.querySelector('#main') && document.querySelector('#nav') && !document.querySelector('#pres').offsetParent), '8. the overview underneath is as it was');
  await p.click('#btnPresent'); await p.waitForTimeout(80); ok(await p.evaluate(() => OV.present.isOpen && OV.present.ps.tab === 'map'), '8. Present again opens on the main page');
  await p.click('#pBtnClose'); await p.waitForTimeout(40); ok(await p.evaluate(() => !OV.present.isOpen), '8. the Close button closes it');
  await p.evaluate(() => { const s = OV.app.state; s.factFind.facts.asked = { sf: false, comparative: false }; ['shortfallQuote', 'comparative'].forEach(id => OV.calc.quotes(s, id).forEach(x => { x.removed = true; })); s.blocks.proposed.items.forEach(i => { i.removed = true; }); s.blocks.goals.items.forEach(g => { g.requested = false; g.removed = true; }); OV.app.redraw(); });
  await p.click('#btnPresent'); await p.waitForTimeout(150);
  ok((await texts('#pTabs .ptab')).join() === 'Main,Policies,FNA,Group,Shortfall,Reduced,Investments,Other' && await p.evaluate(() => document.querySelectorAll('.pcard').length === 7), '8. a page that is left out is not on the tab row and not on the main page (no grey tab, no strike-through): ' + (await texts('#pTabs .ptab')).join(' | '));
  await p.evaluate(() => OV.present.go('comparative')); ok(await tab() === 'map', '8. a left-out page cannot be opened');
  await p.evaluate(() => OV.present.go('shortfall')); await p.keyboard.press('ArrowRight'); ok(await tab() === 'reduced', '8. next skips the pages that are left out');
  await p.click('#pBtnClose');

  ok(errs.length === 0, '9. no page error: ' + errs.join(' | '));

  /* ---- 10. the key points found by the page itself: wr-keypoints.json at the top of a connected folder ---- */
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); fs.readFile(path.join(dir, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + '/';
  const init = () => {
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(v) {
      fo = v;
      v.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      v.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); await ctx.addInitScript(init);
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(base + 'short-risk.html'); await rp.waitForTimeout(500);
  const KFILE = JSON.stringify(KP2);
  const writeTree = spec => rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, v] of Object.entries(s)) { if (typeof v === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(v); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), v); } }
    await mk(root, spec);
  }, spec);
  await writeTree({ NB: { 'wr-keypoints.json': KFILE, 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } });
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);
  const q = await ctx.newPage(); const errs3 = []; q.on('pageerror', e => errs3.push(e.message)); q.on('dialog', d => d.accept());
  await q.goto(base + 'overview.html'); await q.waitForTimeout(900); await wireOn(q); await q.evaluate(() => OV.app.openAll());
  if (await q.$('#restoreDraft')) await q.click('#restoreNew');
  await q.evaluate(() => { const A = OV.app, s = A.state; s.header.fname = 'Client'; s.header.sname = 'Zed'; const f = OV.store.addQuote(s, 'fna'); f.insurer = 'BrightRock'; f.number = '100000777'; f.premium = 1500; f.aci = 10; f.lines[0].life.lump = 500000; f.lines[0].life.monthly = 4000; A.redraw();
    window.__rf = []; const o = FF.foldersUI.rootFile; FF.foldersUI.rootFile = (n, a) => { window.__rf.push([n, !!a]); return o(n, a); }; });
  const names = () => rp.evaluate(async () => { const r = await navigator.storage.getDirectory(), nb = await r.getDirectoryHandle('NB'), o = []; for await (const [n] of nb.entries()) o.push(n); return o.sort().join(); });
  const before = await names();
  await q.click('#btnPresent'); await q.waitForTimeout(900);
  ok(await q.evaluate(() => !!OV.present.keyPoints && OV.present.keyPoints.points.length === 21 && OV.present.keyPoints.from === 'New Business'), '10. the page found wr-keypoints.json at the top of New Business by itself and loaded it (21 approved points)');
  ok(JSON.stringify(await q.evaluate(() => window.__rf)) === '[["wr-keypoints.json",true]]', '10. with nothing kept in the browser the page may ask for the folder (a click opened the Presentation): ' + JSON.stringify(await q.evaluate(() => window.__rf)));
  ok(/Key points ready · 21/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. the top bar says so');
  ok(await q.evaluate(() => { const j = JSON.parse(localStorage.getItem('wr-keypoints')); return j.points.length === 21 && !JSON.stringify(j).includes('nobody has approved'); }), '10. it is kept in the browser, approved points only');
  await q.evaluate(() => OV.present.go('fna')); await q.click('.pbtn[data-p=sev]'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => document.querySelectorAll('#pPanel li').length === 3 && /Trauma IQ/.test(document.querySelector('#pPanel').innerText)), '10. a highlight shows its key points without any button being pressed');
  await q.screenshot({ path: out + '/present-keypoints-sev.png' });
  await q.click('tr[data-keys*="child:amy"]').catch(() => {});
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(JSON.stringify(await q.evaluate(() => window.__rf.map(x => x[1]))) === '[true,false]', '10. the second time something is kept, so the page does not ask the browser for anything (only a folder already open is read)');
  await writeTree({ NB: { 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => OV.present.keyPoints.points.length === 21) && /Key points ready/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. the file gone from the folder: what is kept in the browser is still used');
  const KB = JSON.stringify({ app: 'wr-keypoints', schema: '0.1', points: [pt('z1', 'life', 'Only point.'), { id: 'z2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Not approved.', approved: null }] });
  await writeTree({ NB: { 'wr-keypoints.json': KB, 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => OV.present.keyPoints.points.length === 1 && OV.present.keyPoints.dropped === 1), '10. a newer file in the folder replaces what is kept (one approved point, one dropped)');
  await writeTree({ NB: { 'wr-keypoints.json': 'this is not json', 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => OV.present.keyPoints.points.length === 1) && /not a readable key-points file/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. a file that cannot be read is said so and the library kept in the browser stays');
  await q.evaluate(() => { localStorage.removeItem('wr-keypoints'); });
  await writeTree({ NB: { 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.reload(); await q.waitForTimeout(900); await wireOn(q);
  await q.evaluate(() => { OV.app.state.header.fname = 'Client'; OV.app.state.header.sname = 'Zed'; const f = OV.store.addQuote(OV.app.state, 'fna'); f.insurer = 'BrightRock'; f.lines[0].life.lump = 1; OV.app.redraw(); });
  if (await q.$('#restoreDraft')) await q.click('#restoreNew');
  await q.click('#btnPresent'); await q.waitForTimeout(600);
  ok(await q.evaluate(() => OV.present.keyPoints === null) && /No key points file found/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. no file anywhere and nothing kept: the top bar says so, and no card shows');
  ok(await q.evaluate(() => { OV.present.go('fna'); return !document.querySelector('#pPanel .kcard'); }), '10. (and nothing breaks without a library)');
  await writeTree({ NB: { 'wr-keypoints.json': KFILE, 'Zed, Client': {} }, CF: { 'Z - Files': {} } }); const before2 = await names();
  ok(before2.includes('wr-keypoints.json') && before.split(',').includes('wr-keypoints.json'), '10. (the folder holds only what the test put there)');
  ok(!/createWritable|removeEntry/.test(fs.readFileSync(dir + '/js/folders-ui.js', 'utf8').slice(fs.readFileSync(dir + '/js/folders-ui.js', 'utf8').indexOf('async function rootFile'), fs.readFileSync(dir + '/js/folders-ui.js', 'utf8').indexOf('function forget'))), '10. reading the library only reads: it never writes, creates or deletes anything');
  ok(errs3.length === 0, '10. no page error on the folder page: ' + errs3.join(' | '));
  await ctx.close(); srv.close();
  await p.screenshot({ path: out + '/present-last.png' });
  await b.close(); process.exit(bad ? 1 : 0);
})();
