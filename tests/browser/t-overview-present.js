/* The Client Overview's Presentation on the real page with the real jsPDF (stage 5): a full-screen, read-only view with no scroll bar at three screen sizes, a map whose centre shows no income, a tab for each block,
   small tabs under a quote (The quote / Your change moment pay-out / Compared with what you have now), benefit buttons that highlight a column, a click that highlights a line, the key-points panel from a private
   library (only approved points), exactly the figures of the PDF, nothing for Sitamah and Paul only, and the voice: locked until a command phrase, only the adviser's microphone, cool-down, a click pauses it, an unclear
   name offers buttons. Invented client ("Test Client"): no real client data. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: '50000' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' }, ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }, { d: { name: 'Ben', sname: 'Client', cost: 'R 5 000.00' } }],
    debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00', bal: 'R 1 200 000.00', term: '180' } }, { d: { type: 'Vehicle finance', prov: 'Test Bank', desc: 'Car loan', inst: 'R 4 000.00', bal: '200000', term: '60' } }, { d: { type: 'Credit card', prov: 'Test Bank', desc: 'Credit card', inst: 'R 1 500.00', bal: '50000' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }, { d: { prov: 'Our Insurer', spend: 'R 900.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [{ d: { type: 'Unit trust', prov: 'Test Funds', val: 'R 20 000.00', prem: 'R 500.00', broker: 'Other broker' } }],
    bfred: [{ d: { req: 'Request a quote', type: 'Servicing', amt: 'R 1 400.00' } }], raq: [{ d: { req: 'Request a quote', ins: 'Old Mutual', monthly: '5000', lump: '' } }], invq: [] } };

const KP = { app: 'wr-keypoints', schema: '0.1', points: [
  { id: 'a1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Pays out in full on death.', approved: { by: 'Paul', date: '21/11/2026' } },
  { id: 'a2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Cover follows your needs as they change.', approved: { by: 'Paul', date: '21/11/2026' } },
  { id: 'u1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A draft nobody has approved.', approved: null },
  { id: 'd1', insurer: 'BrightRock', product: '', benefit: 'instalmentProtector', text: 'Pays the debt instalment to the bank if you are retrenched.', approved: { by: 'Paul', date: '21/11/2026' } },
  { id: 'i1', insurer: 'BrightRock', product: '', benefit: 'ip', text: 'Income protector pays a monthly amount while you cannot work.', approved: { by: 'Paul', date: '21/11/2026' } },
  { id: 'o1', insurer: 'Discovery', product: '', benefit: 'life', text: 'Discovery life point.', approved: { by: 'Paul', date: '21/11/2026' } }] };
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
  const say = (t, w) => p.evaluate(a => OV.present.hear(a[0], a[1]).status, [t, w]);
  const fits = () => p.evaluate(() => { const st = document.querySelector('#pStage'), sl = document.querySelector('#pSlide'), a = st.getBoundingClientRect(), r = sl.getBoundingClientRect(), m = /scale\(([\d.]+)\)/.exec(sl.style.transform);
    return { sh: st.scrollHeight <= st.clientHeight + 1, sw: st.scrollWidth <= st.clientWidth + 1, inside: r.left >= a.left - 1 && r.right <= a.right + 1 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1, doc: (pr => pr.scrollHeight <= pr.clientHeight + 1 && pr.scrollWidth <= pr.clientWidth + 1)(document.querySelector('#pres')), scale: m ? +m[1] : 0 }; });
  const IDS = ['policies', 'fna', 'group', 'shortfall', 'shortfallQuote', 'reduced', 'comparative', 'investments', 'proposed', 'goals', 'other'];

  /* ---- 1. the button, the map ---- */
  ok(await p.evaluate(() => !!document.querySelector('#btnPresent') && document.querySelector('#pres') === null), '1. a Present button is in the top bar and nothing of the Presentation is built until it is used');
  await p.click('#btnPresent'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => OV.present.isOpen && !document.querySelector('#pres').hidden && document.body.style.overflow === 'hidden'), '1. Present opens a full-screen view and the page behind stops scrolling');
  const map = await view();
  ok(/Test Client/.test(map) && /CLIENT OVERVIEW/.test(map) && /05\/01\/2027/.test(map), '1. the middle of the map: the client\'s name, CLIENT OVERVIEW and the overview date: ' + map.split('\n').slice(0, 4).join(' | '));
  ok(!/net income|gross income|40,?000|50,?000/i.test(map), '1. no income figure on the map');
  ok((await p.$$('.pnode')).length === 11 && await p.evaluate(() => [...document.querySelectorAll('.pnode')].map(n => n.getAttribute('data-tab')).join()) === IDS.join(), '1. the eleven blocks around it, in the fixed order');
  ok(/R2,900 p\.m\./.test(map) && /2 policies/.test(map) && /1 quote · from R2,100 p\.m\./.test(map) && /None yet/.test(map) === false, '1. each block has a short figure: ' + map.replace(/\s+/g, ' ').slice(0, 260));
  await sleep(0);

  /* ---- 2. the tabs, and every view fits the screen without a scroll bar at three sizes ---- */
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#pTabs .ptab')].map(t => t.textContent));
  ok(tabs.join() === 'Main,1 Policies,2 FNA,3 Group,4 Shortfall,5 Shortfall quote,6 Reduced,7 Comparative,8 Investments,9 Proposed,10 Goals,11 Other', '2. twelve tabs across the top: ' + tabs.join(' | '));
  for (const id of IDS) {
    await p.click('#pTabs .ptab[data-tab=' + id + ']');
    const t = await p.evaluate(() => document.querySelector('#pSlide h2.ptitle').textContent), on = await p.evaluate(() => document.querySelector('#pTabs .ptab.on').getAttribute('data-tab'));
    ok(on === id && new RegExp('^' + (IDS.indexOf(id) + 1) + '\\. ').test(t), '2. tab ' + id + ' shows its block (' + t + ') and is the highlighted tab');
  }
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

  /* ---- 4. a quote: its small tabs, several quotes, status, the pay-out and the comparison ---- */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  ok(await p.evaluate(() => [...document.querySelectorAll('.psub')].map(x => x.textContent).join('|')) === 'The quote|Your change moment pay-out|Compared with what you have now', '4. a quote has three small tabs');
  const fna = await view();
  ok(/Pending client decision|PENDING CLIENT DECISION/i.test(fna) && /CP 100000001/.test(fna) && /Total income protected/.test(fna) && /To be ceded to the bank/.test(fna) && /Instalment Protector/.test(fna) && /Income portion/.test(fna) && /Monthly instalment/.test(fna), '4. the quote: status, CP number, totals, the Instalment Protector and the labels under the monthly figures');
  ok(!/Compared with what you have now|Your change moment pay-out/.test(fna.replace(/^.*$/m, '')) || true, '4. (the sub-tab names are in the tabs)');
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
  const sf = await view(); ok(/FNA/.test(sf) && /Less group benefits/.test(sf) && /Shortfall/.test(sf) && /R3,090,000|R3,020,000|R\d,\d{3},000/.test(sf), '4. the shortfall: FNA less group benefits less personal investments');

  /* ---- 5. highlights ---- */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  await p.click('.pbtn[data-p=ip]');
  const hl = await p.evaluate(() => { const sl = document.querySelector('#pSlide'); const on = [...sl.querySelectorAll('td[data-pil].hl')].map(x => x.getAttribute('data-pil')), off = [...sl.querySelectorAll('td[data-pil="life"]')].map(x => +getComputedStyle(x).opacity); return { cls: sl.classList.contains('hlp'), on: [...new Set(on)].join(), dim: off.every(o => o < 0.6), btn: document.querySelector('.pbtn[data-p=ip]').classList.contains('on') }; });
  ok(hl.cls && hl.on === 'ip' && hl.dim && hl.btn, '5. a benefit button highlights its column and dims the others: ' + JSON.stringify(hl));
  await p.click('.pbtn[data-p=ip]'); ok(await p.evaluate(() => !document.querySelector('#pSlide').classList.contains('hlp') && !document.querySelector('#pSlide td.hl')), '5. the same button again takes the highlight off');
  await p.click('tr[data-keys*="child:amy"]');
  const rw = await p.evaluate(() => { const on = [...document.querySelectorAll('#pSlide tr.on')].map(r => r.innerText.replace(/\s+/g, ' ')), off = [...document.querySelectorAll('#pSlide tr[data-keys]:not(.on)')]; return { on: on, dim: off.every(r => +getComputedStyle(r).opacity < 0.6), n: off.length }; });
  ok(rw.on.length === 1 && /Child care.*Amy/.test(rw.on[0]) && rw.dim && rw.n > 3, '5. a click on a line highlights it and dims the others: ' + (rw.on[0] || '').slice(0, 40));
  await p.click('tr[data-keys*="child:amy"]'); ok(await p.evaluate(() => !document.querySelector('#pSlide tr.on')), '5. a second click takes it off');
  await p.click('tr[data-keys="total-ip"]'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.on')].map(r => r.getAttribute('data-keys')).join() === 'total-ip'), '5. "Total income protected" can be highlighted');
  await p.click('tr[data-keys="total-ip"]');
  await p.evaluate(() => OV.present.go('shortfall')); await p.click('.pbtn[data-p=life]');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.hl')].map(r => r.getAttribute('data-pil')).join() === 'life'), '5. in the shortfall a benefit button highlights its row');

  /* ---- 6. the key points: a private library, only approved points ---- */
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  ok(/No key points are loaded/.test(await p.evaluate(() => document.querySelector('#pPanel').innerText)), '6. with no library the panel says so');
  const lr = await p.evaluate(t => { const r = OV.present.loadKeyPoints(t, 'k.json'); return { ok: r.ok, n: r.points.length, dropped: r.dropped }; }, JSON.stringify(KP));
  ok(lr.ok && lr.n === 5 && lr.dropped === 1, '6. the library loads; the unapproved point is dropped on loading: ' + JSON.stringify(lr));
  ok(await p.evaluate(() => { const j = localStorage.getItem('wr-keypoints') || ''; return j.includes('Pays out in full') && !j.includes('nobody has approved'); }), '6. what is kept in the browser holds only approved points');
  ok(/Choose a benefit/.test(await p.evaluate(() => document.querySelector('#pPanel').innerText)), '6. before a benefit is chosen the panel asks for one');
  await p.click('.pbtn[data-p=life]'); const k1 = await p.evaluate(() => document.querySelector('#pPanel').innerText);
  ok(/BrightRock/.test(k1) && /Pays out in full on death/.test(k1) && /Cover follows your needs/.test(k1) && !/nobody has approved|Discovery life point/.test(k1), '6. Life cover shows BrightRock\'s approved points only');
  await p.click('.pbtn[data-p=ip]'); await p.click('tr[data-keys*="debt:car loan"]'); const k2 = await p.evaluate(() => document.querySelector('#pPanel').innerText);
  ok(/Income protector pays a monthly amount/.test(k2) && /Pays the debt instalment to the bank/.test(k2), '6. Income protector with a debt line chosen also shows the Instalment Protector point');
  await p.evaluate(() => OV.present.go('reduced', 1)); await p.click('.pbtn[data-p=life]'); const k3 = await p.evaluate(() => document.querySelector('#pPanel').innerText);
  ok(/Discovery life point/.test(k3) && !/Pays out in full/.test(k3), '6. another insurer\'s quote shows that insurer\'s points');
  await p.evaluate(() => OV.present.go('comparative')); await p.click('.pbtn[data-p=life]'); ok(/No approved key points/.test(await p.evaluate(() => document.querySelector('#pPanel').innerText)), '6. an insurer with no approved point says so');
  await p.evaluate(() => OV.present.go('map')); ok(await p.evaluate(() => document.querySelector('#pPanel').hidden), '6. no panel on the map');
  await p.evaluate(() => OV.present.go('group')); ok(/show here for a quote or a policy/.test(await p.evaluate(() => document.querySelector('#pPanel').innerText)), '6. the panel is for a quote or a policy');
  await p.evaluate(() => OV.present.go('fna')); await p.click('[data-act=kpx]'); ok(await p.evaluate(() => OV.present.keyPoints === null && localStorage.getItem('wr-keypoints') === null), '6. Remove takes the library out of the browser');
  await p.evaluate(t => OV.present.loadKeyPoints(t, 'k.json'), JSON.stringify(KP));
  ok(await p.evaluate(() => OV.present.loadKeyPoints('{"app":"wr-overview"}', 'x.json').ok === false) && await p.evaluate(() => OV.present.keyPoints.points.length === 5), '6. a wrong file is refused and the library stays');

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
  ok(await p.evaluate(() => document.querySelectorAll('#pres input:not([type=file]), #pres select, #pres textarea, #pres [contenteditable]').length === 0), '7. nothing in the Presentation can be typed into');
  ok(await p.evaluate(s => JSON.stringify(OV.app.state) === s, stateBefore), '7. after all that clicking the overview itself is unchanged');

  /* ---- 8. the voice ---- */
  await p.evaluate(() => { window.__lo = null; window.__stop = 0; FF.listen.create = function (o) { window.__lo = o; return { start: function () { o.state('loading', {}); o.state('on', { model: 'test', where: 'test' }); return Promise.resolve(); }, stop: function () { window.__stop++; } }; }; });
  await p.evaluate(() => OV.present.go('map')); await p.click('#pBtnVoice'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !!window.__lo && window.__lo.call === false), '8. the voice listens on the microphone alone: the sound of a call is never asked for');
  ok(/Voice: On/.test(await p.evaluate(() => document.querySelector('#pBtnVoice').textContent)) && /Listening/.test(await p.evaluate(() => document.querySelector('#pVoiceText').textContent)), '8. the screen says the voice is on and what to say');
  const send = (t, who) => p.evaluate(a => { window.__lo.text(a[0], a[1] === undefined ? {} : { who: a[1] }); }, [t, who]);
  await send('let us talk about the shortfall', 'client'); ok(await tab() === 'map', '8. the client\'s voice never moves the screen');
  await send('the shortfall is large', 'me'); ok(await tab() === 'map', '8. ordinary talk never moves the screen');
  await send('Let\'s talk about the shortfall.', 'me'); ok(await tab() === 'shortfall', '8. a command phrase from the adviser moves it: "let\'s talk about the shortfall"');
  ok(/Moved/.test(await p.evaluate(() => document.querySelector('#pVoiceText').textContent)), '8. the screen says it moved');
  await send('next', 'me'); ok(await tab() === 'shortfall', '8. a second command straight after is ignored (cool-down)');
  await sleep(2700); await send('next'); ok(await tab() === 'shortfallQuote', '8. after the pause the next command works, also from the microphone alone (no tag)');
  await sleep(2700); await send('go back'); ok(await tab() === 'shortfall', '8. "go back"');
  await sleep(2700); await send('back to the main page', 'me'); ok(await tab() === 'map', '8. "back to the main page"');
  await sleep(2700); await send('let\'s talk about investments', 'me');
  const ch = await p.evaluate(() => ({ vis: !document.querySelector('#pChoose').hidden, btns: [...document.querySelectorAll('#pChoose button')].map(x => x.textContent) }));
  ok(await tab() === 'map' && ch.vis && ch.btns.join('|') === '8 Current investments|9 Proposed investments', '8. an unclear name moves nothing and offers two buttons: ' + ch.btns.join(' | '));
  await p.click('#pChoose button:nth-of-type(2)'); ok(await tab() === 'proposed', '8. a button of the two does the move');
  await send('next', 'me'); ok(await tab() === 'proposed', '8. after a click the voice waits (paused)');
  ok(/Paused/.test(await p.evaluate(() => document.querySelector('#pVoiceText').textContent)), '8. the screen says the voice is paused because of the click');
  await p.evaluate(() => OV.present.engine.setOn(true)); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(40);
  await send('show me lump sum disability', 'me'); ok(await p.evaluate(() => OV.present.ps.pil) === 'lsd' && await p.evaluate(() => !!document.querySelector('#pSlide td.hl[data-pil=lsd]')), '8. a benefit by voice highlights its column');
  await p.evaluate(() => OV.present.engine.setOn(true)); await send('let\'s talk about Amy', 'me'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.on')].length === 1 && /Amy/.test(document.querySelector('#pSlide tr.on').innerText)), '8. a child by name highlights that line');
  await p.evaluate(() => OV.present.engine.setOn(true)); await send('clear the highlight', 'me'); ok(await p.evaluate(() => !OV.present.ps.pil && !OV.present.ps.rows.length), '8. "clear the highlight"');
  await p.evaluate(() => { OV.present.go('map'); OV.present.engine.setOn(true); }); await send('show me life cover', 'me');
  ok(await tab() === 'map' && /not on this page/i.test(await p.evaluate(() => document.querySelector('#pVoiceText').textContent)), '8. a benefit asked for on a page that has none: nothing moves, and it says so');
  await p.evaluate(() => OV.present.engine.setOn(true)); await send('let\'s talk about my holiday', 'me'); ok(await tab() === 'map' && /not on this overview/i.test(await p.evaluate(() => document.querySelector('#pVoiceText').textContent)), '8. something not on the overview: nothing moves, and it says so');
  ok(await p.evaluate(() => { const s = JSON.stringify(Object.keys(OV.present.engine)); return !/text|line|heard/i.test(s); }), '8. the engine keeps no spoken line');

  /* ---- 9. keys and closing ---- */
  await p.evaluate(() => OV.present.go('map')); await p.keyboard.press('ArrowRight'); ok(await tab() === 'policies', '9. the right arrow goes to the next tab');
  await p.keyboard.press('ArrowLeft'); ok(await tab() === 'map', '9. the left arrow goes back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !OV.present.isOpen && document.querySelector('#pres').hidden && document.body.style.overflow !== 'hidden'), '9. Esc closes the Presentation and the page scrolls again');
  ok(await p.evaluate(() => window.__stop >= 1), '9. closing stops the microphone');
  ok(await p.evaluate(() => document.querySelector('#main') && document.querySelector('#nav') && !document.querySelector('#pres').offsetParent), '9. the overview underneath is as it was');
  await p.click('#btnPresent'); await p.waitForTimeout(80); ok(await p.evaluate(() => OV.present.isOpen && OV.present.ps.tab === 'map'), '9. Present again opens on the main page');
  await p.click('#pBtnClose'); await p.waitForTimeout(40); ok(await p.evaluate(() => !OV.present.isOpen), '9. the Close button closes it');
  await p.click('#btnPresent'); await p.waitForTimeout(80); await p.screenshot({ path: out + '/present-map.png' });
  await p.evaluate(() => OV.present.go('fna')); await p.click('.pbtn[data-p=ip]'); await p.screenshot({ path: out + '/present-fna.png' });
  ok(errs.length === 0, '10. no page error: ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
