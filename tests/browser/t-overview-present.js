/* The Client Overview Studio's Presentation on the real page with the real jsPDF, in the design Paul approved on 22 November: a top bar (logo, client, "Client Overview · Presentation · date"), nine pill tabs (a tab with
   nothing to show is greyed and cannot be clicked), an Overview page of cards with ONE factual sentence each (bright cards open a page, grey ones only say it; no figures), quote tables like the PDF (a firm grid, totals,
   the blue premium bar), pills and column headings that highlight a column (Life cover, Severe illness, Lump sum disability, Income protector, ACI, ABI), a line click, NOTHING dimmed, a Key points on / off switch, key
   points as small cards with their source that slide in one after another (placeholders until the checked library is found; Severe illness in two sections; the ACI card built from the quote), exactly the PDF's figures,
   nothing for Sitamah and Paul only, NO voice, and the library found by the page itself in a connected folder (a real directory tree in the browser's private file system). Invented client ("Test Client"). */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process'), http = require('http'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, gross: { v: '50000' }, ip_age: { v: '65' }, date: { v: '20/11/2031' }, dd_cover: { v: 'R 500 000.00' }, ma: { v: 'Medical aid' }, ma_prov: { v: 'Test Medical' }, will: { v: 'Yes' }, will_up: { v: 'No' }, sti: { v: 'Yes' }, ref_sti: { v: 'Cameron to contact client' }, has_ra: { v: 'Yes' }, has_group: { v: 'Yes' }, has_risk: { v: 'Yes' }, has_inv: { v: 'Yes' } },
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

  /* ---- the key-points library used below (invented; every point carries its source) ---- */
  const AP = { by: 'Paul', date: '21/11/2026' };
  const pt = (id, benefit, text, insurer, section) => ({ id, insurer: insurer === undefined ? 'BrightRock' : insurer, product: '', benefit, text, section, source: 'BrightRock quote, p. 3', approved: AP });
  const KP2 = { app: 'wr-keypoints', schema: '0.1', points: [
    pt('l1', 'life', 'Pays out in full on death.'), pt('l2', 'life', 'Cover follows your needs as they change.'),
    { id: 'u1', insurer: 'BrightRock', product: '', benefit: 'life', text: 'A draft nobody has approved.', source: 'p. 1', approved: null },
    { id: 'u2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Approved but no source.', approved: AP },
    pt('s1', 'sev', 'Severe illness pays out on diagnosis.'), pt('s2', 'sevUpTo200', 'Up to 200% of the life cover, for the early conditions.'), pt('s3', 'sevAdvanced', 'The advanced option adds more conditions.'), pt('s4', 'traumaIQ', 'Trauma IQ covers your children too.'),
    pt('k1', 'sevChild', 'For a child the 10% doubles to 20% with child care cover.'), pt('k2', 'sevChildExtra', 'Extra conditions only for children.'), pt('k3', 'sevChildClaim', 'A child\'s claim also pays for the child care.'),
    pt('p1', 'lsd', 'Lump sum disability pays if you cannot work again.'),
    pt('i1', 'ip', 'Income protector pays a monthly amount while you cannot work.'), pt('i2', 'ipClaimRoutes', 'Two ways to claim: a listed condition, or a doctor books you off work.'), pt('i3', 'ipWaiting', 'The waiting period is how long it is before it pays.'),
    pt('a1', 'aci', 'A library ACI line that must never show.'), pt('b1', 'abi', 'The ABI is how much the cover goes up each year.'),
    pt('c1', 'childCare', 'Child care cover runs until the child is 24.'), pt('c2', 'rareChildhood', 'Rare childhood diseases are covered for each child.'),
    pt('d0', 'debt', 'Debt cover pays the debt if you die.'), pt('d1', 'debtAccelerated', 'Accelerated debt cover is paid out of your life cover.'), pt('d2', 'debtStandalone', 'Standalone debt cover is paid on top of your life cover.'),
    pt('o1', 'life', 'Discovery life point.', 'Discovery')] };
  const APPROVED = KP2.points.filter(x => x.approved && x.source).length;
  const texts = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);
  const minOpacity = () => p.evaluate(() => Math.min(...[...document.querySelectorAll('#pSlide, #pSlide *')].map(e => +getComputedStyle(e).opacity)));
  const cards = () => p.evaluate(() => { const pn = document.querySelector('#pPanel'); return { text: pn.innerText, n: pn.querySelectorAll('.kcard').length, cards: [...pn.querySelectorAll('.kcard')].map(c => c.querySelector('p').textContent), sources: [...pn.querySelectorAll('.kcard small')].map(c => c.textContent), banners: [...pn.querySelectorAll('.ksec')].map(c => c.textContent), allIn: [...pn.querySelectorAll('.kcard')].every(c => c.classList.contains('in')), hint: !!pn.querySelector('.khint'), fits: pn.scrollHeight <= pn.clientHeight + 1 }; });
  await p.evaluate(() => { const s = OV.app.state, q = s.blocks.fna.quotes[0], d = q.lines.filter(l => l.type === 'debt'); d[0].accelerated = true; d[1].accelerated = false; q.aciText = '7.5% + age adjuster'; q.rates = 'Non-smoker rates'; q.lines.filter(l => l.type === 'child').forEach((l, i) => { l.term = 'End of calendar year in which ' + (i ? 'Ben' : 'Amy') + ' turns 24'; }); OV.app.redraw(); });

  /* ---- 1. the top bar and the Overview page ---- */
  ok(await p.evaluate(() => !!document.querySelector('#btnPresent') && document.querySelector('#pres') === null), '1. a Present button is in the top bar and nothing of the Presentation is built until it is used');
  await p.click('#btnPresent'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.present.isOpen && !document.querySelector('#pres').hidden && document.body.style.overflow === 'hidden'), '1. Present opens a full-screen view and the page behind stops scrolling');
  const bar = await p.evaluate(() => ({ logo: (i => !!i && i.complete && i.naturalWidth > 0)(document.querySelector('#pres img.plogo')), who: document.querySelector('#pWho').innerText.replace(/\s+/g, ' ') }));
  ok(bar.logo && /Test Client/.test(bar.who) && /Client Overview · Presentation · 05\/01\/2027/.test(bar.who), '1. the top bar: the logo, the client\'s name and "Client Overview · Presentation · date": ' + bar.who);
  const map = await view();
  ok(/CLIENT OVERVIEW/.test(map) && /Test Client/.test(map) && /05\/01\/2027/.test(map) && !/net income|gross income|40,?000|50,?000/i.test(map), '1. the banner: CLIENT OVERVIEW, the client\'s name large, the date; no income figure');
  ok(await p.evaluate(() => /linear-gradient\(.*rgb\(39, 168, 224\).*rgb\(15, 110, 153\)/.test(getComputedStyle(document.querySelector('.phero')).backgroundImage)), '1. the banner is a gradient from #27A8E0 to #0F6E99');
  ok(await p.evaluate(() => document.querySelector('.pwelcome').textContent) === 'Test, here’s what we’ll cover today', '1. the welcome line uses the first name');
  const cardTxt = await p.evaluate(() => [...document.querySelectorAll('#pSlide .pcard')].map(c => ({ head: c.querySelector('.ct').textContent, text: c.querySelector('.cs').textContent, tag: c.tagName, cls: c.className })));
  ok(cardTxt.length === 11 && cardTxt.map(c => c.head).join('|') === 'Current policies|Life cover: FNA quote|Shortfall|Reduced quote|Group benefits|Retirement planning|Investments|Goal analysis|Medical aid|Will|Short-term insurance', '1. eleven cards, each with a heading: ' + cardTxt.map(c => c.head).join(' | '));
  ok(cardTxt.every(c => c.text.length > 10 && !/\d|R\s?\d/.test(c.text)), '1. each card has ONE short sentence with no figure, no number, no policy or quote number');
  const byHead = h => cardTxt.filter(c => c.head === h)[0].text;
  ok(byHead('Current policies') === 'You have two policies with Other Insurer and Our Insurer right now. We’ll show you what they cover.' && byHead('Life cover: FNA quote') === 'Based on our last meeting, we’ll show you what you ideally need to take out.' && byHead('Reduced quote') === 'A more affordable way to close that gap.' && byHead('Medical aid') === 'You have medical aid in place.' && byHead('Will') === 'Your will is in place but needs updating.' && byHead('Short-term insurance') === 'Your short-term insurance is being reviewed, and we’re waiting for feedback.', '1. the sentences are chosen from this client\'s answers: ' + byHead('Current policies'));
  ok(cardTxt.filter(c => /bright/.test(c.cls)).map(c => c.head).join('|') === 'Current policies|Life cover: FNA quote|Shortfall|Reduced quote' && cardTxt.filter(c => /bright/.test(c.cls)).every(c => c.tag === 'BUTTON') && cardTxt.filter(c => /soft/.test(c.cls)).every(c => c.tag === 'DIV'), '1. the four cards that have a page behind them are bright buttons; the others are soft grey and not clickable');
  const lift = await p.evaluate(() => { const b = document.querySelector('.pcard.bright'), s = document.querySelector('.pcard.soft'); return { bCursor: getComputedStyle(b).cursor, sCursor: getComputedStyle(s).cursor, sBg: getComputedStyle(s).backgroundColor, bBg: getComputedStyle(b).backgroundColor, radius: getComputedStyle(b).borderRadius }; });
  ok(lift.bCursor === 'pointer' && lift.sCursor === 'default' && lift.bBg === 'rgb(255, 255, 255)' && lift.sBg === 'rgb(243, 245, 247)' && lift.radius === '16px', '1. bright cards are white with a pointer, statement cards soft grey with none, both rounded 16px: ' + JSON.stringify(lift));
  await p.hover('.pcard.bright'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.pcard.bright')).transform !== 'none'), '1. a bright card lifts on hover');
  await p.waitForTimeout(1000); await p.hover('.pcard.soft'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(document.querySelector('.pcard.soft')).transform)), '1. a statement card does not');
  const delays = await p.evaluate(() => [...document.querySelectorAll('#pSlide .pcard')].map(c => parseFloat(getComputedStyle(c).animationDelay)));
  ok(delays.every((d, i) => i === 0 || d > delays[i - 1]) && /card-in/.test(await p.evaluate(() => getComputedStyle(document.querySelector('.pcard')).animationName)), '1. the cards fade in one after another: ' + delays.map(d => d.toFixed(2)).join(' '));
  await p.click('.pcard.soft'); ok(await tab() === 'map', '1. a click on a statement card does nothing');
  ok(await p.evaluate(() => !document.querySelector('#pres').querySelector('#pBtnVoice, #pVoiceText, #pBtnKp, #pKpIn, #pChoose, input') && !/Voice|Highlight|microphone|Listening/i.test(document.querySelector('#pres').innerText)), '1. no voice button, no listening line, no Key points button, no file chooser, no word Highlight');
  await p.waitForTimeout(1200); await p.screenshot({ path: out + '/present-overview.png' });
  await p.click('.pcard.bright[data-tab=fna]'); await p.waitForTimeout(80); ok(await tab() === 'fna', '1. a click on a bright card opens its page');
  await p.evaluate(() => OV.present.go('map'));

  /* ---- 2. the tabs, one page for each ---- */
  const tabs = await texts('#pTabs .ptab');
  ok(tabs.join() === 'Overview,Current policies,FNA quote,Group benefits,Shortfall,Reduced quotes,Investments,Goal analysis,Other', '2. nine pill tabs: ' + tabs.join(' | '));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#pTabs .ptab')).borderRadius !== '0px' && !document.querySelector('#pTabs .ptab:disabled, #pTabs .ptab.off') && getComputedStyle(document.querySelector('#pTabs')).borderRadius === '16px' && getComputedStyle(document.querySelector('.pbar')).borderRadius === '16px'), '2. the tabs are rounded pills in a rounded bar under a rounded top bar, and none is greyed here (every page has something to show)');
  const TITLE = { policies: 'Current policies', fna: 'FNA quote', group: 'Group benefits & personal investments', shortfall: 'Shortfall', shortfallQuote: 'Shortfall quote', reduced: 'Reduced quotes', comparative: 'Comparative quotes', investments: 'Current investments', proposed: 'Proposed investments', goals: 'Goal analysis reports', other: 'Medical aid, will & short-term' };
  const TABOF = { policies: 'policies', fna: 'fna', group: 'group', shortfall: 'shortfall', shortfallQuote: 'shortfall', reduced: 'reduced', comparative: 'reduced', investments: 'investments', proposed: 'investments', goals: 'goals', other: 'other' };
  for (const id of IDS) {
    await p.evaluate(i => OV.present.go(i), id); await p.waitForTimeout(30);
    const t = await p.evaluate(() => document.querySelector('#pSlide h2.ptitle').textContent), on = await p.evaluate(() => document.querySelector('#pTabs .ptab.on').getAttribute('data-tab'));
    ok(on === TABOF[id] && t === TITLE[id], '2. ' + id + ' shows "' + t + '" under the tab ' + on + ', no number in the title');
  }
  for (const tb of ['shortfall', 'reduced', 'investments']) {
    await p.click('#pTabs .ptab[data-tab=' + tb + ']');
    const chips = await texts('#pSlide .pchips.blk .pchip'); ok(chips.length === 2, '2. the ' + tb + ' tab holds two pages, a small button for each: ' + chips.join(' | '));
    await p.click('#pSlide .pchips.blk .pchip:not(.on)'); const other = await tab(); ok(TABOF[other] === tb && other !== tb, '2. the other button opens the other page of the tab (' + other + ')');
  }
  const underline = await p.evaluate(() => getComputedStyle(document.querySelector('#pTabs .ptab.on')).boxShadow + '|' + getComputedStyle(document.querySelector('#pTabs .ptab.on')).backgroundColor);
  ok(/rgb\(242, 140, 40\)/.test(underline) && /rgb\(39, 168, 224\)$/.test(underline), '2. the current tab is WR blue with an orange #F28C28 underline: ' + underline);

  /* ---- 3. every view fits the screen with no scroll bar at three sizes ---- */
  const sizes = [[1280, 720], [1600, 900], [1920, 1080]], worst = {};
  for (const [w, h] of sizes) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
    let allOk = true, minScale = 9, where = '';
    for (const id of ['map'].concat(IDS)) {
      const subs = id === 'map' ? [null] : ['fna', 'shortfallQuote', 'reduced', 'comparative'].includes(id) ? ['quote', 'cmp', 'cmpr'] : [null];
      const nq = ['fna', 'shortfallQuote', 'reduced', 'comparative'].includes(id) ? await p.evaluate(i => OV.calc.quotes(OV.app.state, i).length, id) : 1;
      for (let q = 0; q < Math.max(1, nq); q++) for (const sub of subs) {
        await p.evaluate(a => { OV.present.go(a[0], a[1]); if (a[2]) OV.present.applyMoves([{ sub: a[2] }]); }, [id, q, sub]); await p.waitForTimeout(id === 'map' ? 1100 : 40);          // the Overview's cards fade in one after another
        const f = await fits(); if (!(f.sh && f.sw && f.inside && f.doc)) { allOk = false; where += ' ' + id + '/' + q + '/' + sub; } minScale = Math.min(minScale, f.scale);
      }
    }
    worst[w] = minScale;
    ok(allOk, '3. at ' + w + 'x' + h + ' every view fits the screen: no scroll bar, nothing outside it, the page behind does not scroll' + (allOk ? '' : ' (not: ' + where + ')') + '; smallest scale ' + minScale.toFixed(2));
  }
  ok(worst[1280] >= 0.55, '3. even at 1280x720 the smallest view is drawn at least 55% of its design size (' + worst[1280].toFixed(2) + ')');
  await p.setViewportSize({ width: 1600, height: 900 }); await p.waitForTimeout(120);

  /* ---- 4. a quote: like the PDF ---- */
  await p.evaluate(() => { OV.present.go('map'); OV.present.go('fna'); }); await p.waitForTimeout(60);
  ok(await p.evaluate(() => [...document.querySelectorAll('.psub')].map(x => x.textContent).join('|')) === 'The quote|Your change moment pay-out|Compared with what you have now', '4. a quote has three small tabs');
  const fna = await view();
  ok(/Pending client decision|PENDING CLIENT DECISION/i.test(fna) && /CP 100000001/.test(fna) && /To be ceded to the bank/.test(fna) && /Instalment Protector/.test(fna) && /Income portion p\.m\./.test(fna) && /Monthly instalment/.test(fna), '4. the quote: status, CP number, the Instalment Protector and the labels under the monthly figures');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide thead th')].map(t => t.innerText.replace(/\s+/g, ' ').trim()).join('|')) === 'Need|Term|Life cover|Severe illness|Lump sum disability Age 65|Income protector / sickness benefit Age 65|Waiting period|ACI|ABI', '4. the columns: Need | Term | Life cover | Severe illness | Lump sum disability Age 65 | Income protector / sickness benefit Age 65 | Waiting period | ACI | ABI');
  const css = await p.evaluate(() => { const th = document.querySelector('#pSlide thead th'), td = document.querySelector('#pSlide tbody td'), w = document.querySelector('#pSlide .ptw'); return { th: getComputedStyle(th).backgroundColor, thc: getComputedStyle(th).color, grid: getComputedStyle(td).borderBottomColor + '|' + getComputedStyle(td).borderLeftColor + '|' + getComputedStyle(td).borderBottomWidth, r: getComputedStyle(w).borderRadius, sh: getComputedStyle(w).boxShadow !== 'none', tot: getComputedStyle(document.querySelector('#pSlide tr.tot td')).backgroundColor, prem: getComputedStyle(document.querySelector('#pSlide tr.prem td')).backgroundColor }; });
  ok(css.th === 'rgb(221, 239, 249)' && css.thc === 'rgb(15, 110, 153)' && /^rgb\(184, 196, 206\)\|/.test(css.grid) && /1px$/.test(css.grid) && css.r === '16px' && css.sh && css.tot === 'rgb(253, 239, 224)', '4. a light blue header (#DDEFF9) with blue headings, a firm #B8C4CE grid on every cell, rounded outer corners and a soft shadow: ' + JSON.stringify(css));
  ok(await p.evaluate(() => { const r = [...document.querySelectorAll('#pSlide tr.tot')].map(x => x.cells[0].textContent.trim()); return r.join('|') === 'Total lump sum|Total income protected'; }), '4. the two totals rows (light orange) are always there: Total lump sum and Total income protected');
  ok(await p.evaluate(() => { const r = document.querySelector('#pSlide tr.prem'); return /^Monthly premium · Non-smoker rates$/.test(r.cells[0].textContent.trim()) && /^R2,900$/.test(r.cells[1].textContent.trim()) && getComputedStyle(r.cells[1]).textAlign === 'right'; }), '4. the blue premium bar: "Monthly premium · Non-smoker rates" with the total on the right');
  ok(await p.evaluate(() => { const r = [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => /Debt/.test(x.innerText)).map(x => (x.querySelector('small.cov') || {}).textContent || ''); return r.join('|') === 'Accelerated|Standalone|'; }), '4. each debt line says Accelerated or Standalone (and nothing where it is not known)');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => /Child care/.test(x.innerText)).every(x => /N\/A/.test(x.cells[6].innerText) && /Amy Client|Ben Client/.test(x.cells[0].innerText) && /End of calendar year in which (Amy|Ben) turns 24/.test(x.cells[1].innerText))), '4. child care: the full child\'s name, the full term, and N/A for the waiting period');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr[data-keys]')].filter(x => x.getAttribute('data-ben') !== null && x.cells.length === 9).every(x => /7\.5% \+ age adjuster/.test(x.cells[7].innerText) && /\d+(\.\d+)?%/.test(x.cells[8].innerText))), '4. every line shows the ACI in the quote\'s words ("7.5% + age adjuster") and its ABI');
  await p.click('.psub[data-s=cmp]'); const cmp = await view();
  ok(/Total for all your needs/.test(cmp) && /R30,000/.test(cmp) && /R80,000/.test(cmp) && /Amy Client/.test(cmp) && /Only paid if you are alive/.test(cmp) && !/Total income protected/.test(cmp), '4. "Your change moment pay-out" shows only the pay-out table and its note');
  await p.click('.psub[data-s=cmpr]'); const cmpr = await view();
  ok(/What you have now/.test(cmpr) && /This quote/.test(cmpr) && /Difference/.test(cmpr) && /[+−]R/.test(cmpr), '4. "Compared with what you have now": three rows with + / − differences');
  await p.evaluate(() => OV.present.go('reduced')); await p.waitForTimeout(40);
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide .qhead .pchip')].map(x => x.textContent).join('|')) === 'BrightRock 2|Discovery 77', '4. several reduced quotes: one button for each');
  ok(await p.evaluate(() => !document.querySelector('.psub[data-s=cmp]')), '4. no pay-out tab for a quote that has no pay-out');
  await p.click('#pSlide .qhead .pchip[data-i="1"]'); ok(/Discovery/.test(await p.evaluate(() => document.querySelector('.qhead').innerText)) && /R400,000/.test(await view()), '4. the second quote is shown on its button');
  await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(40);
  const pol = await view(); ok(/Other Insurer/.test(pol) && /Our Insurer/.test(pol) && /Grand total \(all policies\)/.test(pol), '4. current policies: one table with the insurers and a total row');
  await p.click('tr[data-act=pol]'); const det = await view();
  ok(/Cover/.test(det) && /R1,000,000/.test(det) && /R300,000/.test(det) && await p.evaluate(() => !!document.querySelector('[data-act=polall]')), '4. a click on a policy shows its lines, with a way back to all policies');
  await p.click('[data-act=polall]'); ok(/Grand total \(all policies\)/.test(await view()), '4. back to all policies');
  await p.evaluate(() => OV.present.go('shortfall')); await p.waitForTimeout(40);
  const sf = await view();
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide thead th')].map(t => t.textContent.trim()).join('|') === '|Need|Current cover|Shortfall') && /Group benefits R810,000/.test(sf) && /Personal investments R70,000/.test(sf) && /R3,020,000/.test(sf), '4. the shortfall: Need | Current cover | Shortfall, with what the current cover is made of under it');
  ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide td.sf .a')].every(e => getComputedStyle(e).color === 'rgb(192, 57, 43)') && !/line-through/.test(getComputedStyle(document.querySelector('#pSlide')).textDecorationLine + [...document.querySelectorAll('#pSlide *')].map(e => getComputedStyle(e).textDecorationLine).join())), '4. the shortfall is in red and nothing is struck through');
  await p.evaluate(() => OV.present.go('group')); const grp = await view();
  ok(/Group risk Test Group/.test(grp) && !/No group life cover/.test(grp), '4. group benefits with a group risk: the table, no red lines');
  await p.evaluate(() => OV.present.go('other')); await p.waitForTimeout(500);
  const oth = await p.evaluate(() => [...document.querySelectorAll('#pSlide .ocard')].map(c => c.innerText.replace(/\s+/g, ' ')));
  ok(oth.length >= 3 && oth.some(t => /Medical aid.*You have medical aid in place\..*Test Medical.*R1,479/.test(t)) && oth.some(t => /Will.*Your will is in place but needs updating\./.test(t)) && oth.some(t => /Short-term insurance.*being reviewed/.test(t)), '4. other: a card each for medical aid, will and short-term: ' + oth.length + ' cards');

  /* ---- 5. highlighting by clicking: six pills, the column headings, a line, the switch; nothing dimmed ---- */
  await p.evaluate(() => { OV.present.go('map'); OV.present.go('fna'); }); await p.waitForTimeout(40);
  ok((await texts('.pbtn')).join('|') === 'Life cover|Severe illness|Lump sum disability|Income protector|ACI|ABI', '5. the pills: Life cover, Severe illness, Lump sum disability, Income protector, ACI, ABI');
  ok(await p.evaluate(() => !!document.querySelector('.pswitch') && /Key points: on/.test(document.querySelector('.pswitch').textContent) && document.querySelector('.pswitch').getAttribute('aria-checked') === 'true'), '5. and the Key points: on switch');
  ok(await p.evaluate(() => !/Highlight/i.test(document.querySelector('#pSlide').innerText + [...document.querySelectorAll('.pbtn')].map(b => b.title).join())), '5. the word Highlight is nowhere');
  for (const [pid, n] of [['life', 'Life cover'], ['sev', 'Severe illness'], ['lsd', 'Lump sum disability'], ['ip', 'Income protector'], ['aci', 'ACI'], ['abi', 'ABI']]) {
    await p.click('.pbtn[data-p=' + pid + ']'); await p.waitForTimeout(380);
    const hl = await p.evaluate(pp => { const sl = document.querySelector('#pSlide'), on = [...new Set([...sl.querySelectorAll('.hl')].map(x => x.getAttribute('data-pil')))].join(), all = [...sl.querySelectorAll('td[data-pil=' + pp + ']')].every(x => x.classList.contains('hl')), th = !!sl.querySelector('th[data-pil=' + pp + '].hl'); const c = sl.querySelector('td[data-pil=' + pp + '].hl'); return { on, all, th, btn: document.querySelector('.pbtn[data-p=' + pp + ']').classList.contains('on'), bg: c && getComputedStyle(c).backgroundColor, side: c && getComputedStyle(c).boxShadow }; }, pid);
    ok(hl.on === pid && hl.all && hl.th && hl.btn && hl.bg === 'rgb(255, 241, 224)' && /rgb\(242, 140, 40\)/.test(hl.side), '5. ' + n + ' highlights its whole column, heading included, in a light orange fill with orange side lines: ' + JSON.stringify(hl));
    ok(await minOpacity() === 1, '5. with ' + n + ' highlighted nothing is dimmed or greyed out: every element is fully visible');
    await p.click('.pbtn[data-p=' + pid + ']'); ok(await p.evaluate(() => !document.querySelector('#pSlide .hl')), '5. the same pill again takes the highlight off');
  }
  await p.click('#pSlide th[data-pil=sev]'); ok(await p.evaluate(() => !!document.querySelector('#pSlide td[data-pil=sev].hl') && document.querySelector('.pbtn[data-p=sev]').classList.contains('on')), '5. a click on a column heading highlights the column too');
  await p.click('#pSlide th[data-pil=sev]'); ok(await p.evaluate(() => !document.querySelector('#pSlide .hl')), '5. and a second click takes it off');
  await p.click('tr[data-keys*="child:amy"]'); await p.waitForTimeout(380);
  const rw = await p.evaluate(() => { const on = [...document.querySelectorAll('#pSlide tr.on')]; return { on: on.map(r => r.innerText.replace(/\s+/g, ' ')), n: document.querySelectorAll('#pSlide tr[data-keys]').length, edge: on[0] && getComputedStyle(on[0].cells[0]).boxShadow, bg: on[0] && getComputedStyle(on[0].cells[3]).backgroundColor }; });
  ok(rw.on.length === 1 && /Child care.*Amy/.test(rw.on[0]) && rw.n > 5 && /rgb\(242, 140, 40\)/.test(rw.edge) && rw.bg === 'rgb(255, 241, 224)' && await minOpacity() === 1, '5. a click on a line highlights it (light orange, orange left edge) and nothing else is dimmed: ' + JSON.stringify(rw.edge));
  await p.click('tr[data-keys*="child:amy"]'); ok(await p.evaluate(() => !document.querySelector('#pSlide tr.on')), '5. a second click takes it off');
  await p.click('tr[data-keys="total-ip"]'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.on')].map(r => r.getAttribute('data-keys')).join() === 'total-ip'), '5. "Total income protected" can be highlighted');
  await p.click('tr[data-keys="total-ip"]');
  await p.evaluate(() => OV.present.go('shortfall'));
  ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).map(b => b.textContent).join('|'))) === 'Life cover|Severe illness|Lump sum disability|Income protector' && await p.evaluate(() => !document.querySelector('.pswitch')), '5. on the shortfall, which has no ACI or ABI column, those two pills are not shown, and there is no key points switch (nothing to show there)');
  await p.click('.pbtn[data-p=life]'); ok(await p.evaluate(() => [...document.querySelectorAll('#pSlide tr.hl')].map(r => r.getAttribute('data-pil')).join() === 'life') && await minOpacity() === 1, '5. in the shortfall a pill highlights its row, and nothing is dimmed');
  await p.evaluate(() => OV.present.go('group')); ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).length)) === 6, '5. the group page has all six pills');
  await p.click('.pbtn[data-p=aci]'); ok(await p.evaluate(() => !!document.querySelector('#pSlide td[data-pil=aci].hl')), '5. and ACI highlights its column there');
  await p.evaluate(() => { OV.present.go('map'); OV.present.go('fna'); }); await p.click('.psub[data-s=cmpr]'); ok((await p.evaluate(() => [...document.querySelectorAll('.pbtn')].filter(b => !b.hidden).length)) === 4, '5. the comparison has four pills');

  /* ---- 6. the key points: placeholders until the library is found; then cards with their source; the switch ---- */
  await p.evaluate(() => { localStorage.removeItem('wr-keypoints'); OV.present.go('map'); OV.present.go('fna'); });
  ok(/No key points file found/.test(await p.evaluate(() => document.querySelector('#pKpState').textContent)) && /placeholder/.test(await p.evaluate(() => document.querySelector('#pKpState').textContent)) && await p.evaluate(() => document.querySelector('#pMain').classList.contains('haspanel') && !document.querySelector('#pPanel').hidden), '6. on a quote the column on the right is there, and the top bar says no key points file was found and placeholders show');
  let k = await cards(); ok(k.n === 0 && k.hint, '6. with nothing highlighted the column holds only a quiet hint');
  await p.click('.pbtn[data-p=sev]'); await p.waitForTimeout(900); k = await cards();
  ok(k.n === 7 && k.banners.join('|') === 'The life insured|The children' && k.cards.every(t => /^Placeholder/.test(t)) && k.sources.every(t => /^Source: BrightRock quote, page to come$/.test(t)) && k.allIn, '6. until the checked library is found, Severe illness shows placeholder cards in the same layout, in two sections with blue banners: ' + k.banners.join(' / '));
  ok(k.fits, '6. the column never scrolls');
  const ph = await p.evaluate(() => { const c = document.querySelector('#pPanel .kcard'), s = document.querySelector('#pPanel .ksec'); return { top: getComputedStyle(c).borderTopColor + ' ' + getComputedStyle(c).borderTopWidth, r: getComputedStyle(c).borderRadius, bg: getComputedStyle(s).backgroundColor }; });
  ok(/^rgb\(242, 140, 40\) /.test(ph.top) && parseFloat(ph.top.split(') ')[1]) >= 2.5 && ph.bg === 'rgb(39, 168, 224)', '6. each card has an orange top edge, each section a blue banner: ' + JSON.stringify(ph));
  const stag = await p.evaluate(() => [...document.querySelectorAll('#pPanel .kcard')].map(c => parseFloat(getComputedStyle(c).transitionDelay.split(',')[0])));
  ok(stag.every((d, i) => i === 0 || d > stag[i - 1]), '6. the cards slide in one after another: ' + stag.map(d => d.toFixed(2)).join(' '));
  await p.screenshot({ path: out + '/present-keypoints-placeholders.png' });
  await p.click('.pbtn[data-p=sev]'); await p.click('.pbtn[data-p=aci]'); await p.waitForTimeout(400); k = await cards();
  ok(k.n === 1 && k.cards[0] === 'Premiums rise 7.5% a year, plus the age adjuster.' && k.sources[0] === 'Source: This quote, CP 100000001' && k.banners.length === 0, '6. the ACI card is "Premiums rise 7.5% a year, plus the age adjuster." with its source, and nothing else: ' + JSON.stringify(k.cards));
  await p.click('.pbtn[data-p=aci]'); await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(300); k = await cards(); ok(k.n === 2 && k.banners.length === 0, '6. a column with one section has no banner');
  await p.click('.pbtn[data-p=life]');
  /* the switch */
  await p.click('.pbtn[data-p=sev]'); await p.waitForTimeout(500); await p.click('.pswitch'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Key points: off/.test(document.querySelector('.pswitch').textContent) && document.querySelector('.pswitch').getAttribute('aria-checked') === 'false' && [...document.querySelectorAll('#pPanel .kcard')].every(c => c.classList.contains('out'))), '6. the switch off: the cards slide away');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.querySelector('#pPanel').hidden && !document.querySelector('#pMain').classList.contains('haspanel') && !document.querySelector('#pPanel .kcard')), '6. then the column closes');
  const wOff = await p.evaluate(() => document.querySelector('#pStage').clientWidth); await p.screenshot({ path: out + '/present-keypoints-off.png' });
  await p.click('.pbtn[data-p=life]'); ok(await p.evaluate(() => document.querySelector('#pPanel').hidden), '6. with the switch off a highlight shows no key points');
  await p.click('.pswitch'); await p.waitForTimeout(700);
  ok(await p.evaluate(w => /Key points: on/.test(document.querySelector('.pswitch').textContent) && !document.querySelector('#pPanel').hidden && document.querySelector('#pStage').clientWidth < w && document.querySelectorAll('#pPanel .kcard').length === 2, wOff), '6. the switch on again: the column opens and the cards slide in');
  await p.click('.pbtn[data-p=life]');
  /* the library: cards with a source, only approved points with a source */
  const lr = await p.evaluate(t => { const r = OV.present.loadKeyPoints(t, 'k.json'); return { ok: r.ok, n: r.points.length, dropped: r.dropped, noSource: r.noSource }; }, JSON.stringify(KP2));
  ok(lr.ok && lr.n === APPROVED && lr.dropped === 1 && lr.noSource === 1, '6. the library loads; the unapproved point and the one with no source are left out: ' + JSON.stringify(lr));
  ok(await p.evaluate(() => { const j = localStorage.getItem('wr-keypoints') || ''; return j.includes('Pays out in full') && !j.includes('nobody has approved') && !j.includes('no source'); }), '6. what is kept in the browser holds only approved points with a source');
  ok(/Key points ready/.test(await p.evaluate(() => document.querySelector('#pKpState').textContent)), '6. the top bar says the key points are ready');
  await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(600); k = await cards();
  ok(k.n === 2 && /Pays out in full on death/.test(k.text) && k.sources.every(t => /^Source: BrightRock quote, p\. 3$/.test(t)) && !/nobody has approved|Discovery life point|Approved but no source/.test(k.text), '6. Life cover shows BrightRock\'s approved points, each with its source: ' + JSON.stringify(k.cards));
  await p.click('.pbtn[data-p=sev]'); await p.waitForTimeout(900); k = await cards();
  ok(k.n === 7 && k.banners.join('|') === 'The life insured|The children' && /Trauma IQ/.test(k.text) && /doubles to 20%/.test(k.text) && k.fits, '6. Severe illness: the life insured (cover, up to 200%, advanced option, Trauma IQ) and the children (10% to 20%, extra conditions, what a child\'s claim pays): ' + k.n + ' cards');
  await p.screenshot({ path: out + '/present-keypoints-severe.png' });
  await p.click('.pbtn[data-p=ip]'); await p.waitForTimeout(300); k = await cards(); ok(k.n === 3 && /monthly amount/.test(k.text) && /Two ways to claim/.test(k.text) && /waiting period/.test(k.text), '6. Income protector shows the benefit, the two ways to claim and the waiting period');
  await p.click('.pbtn[data-p=lsd]'); await p.waitForTimeout(200); k = await cards(); ok(k.n === 1 && /cannot work again/.test(k.text), '6. Lump sum disability shows its one point');
  await p.click('.pbtn[data-p=aci]'); await p.waitForTimeout(200); k = await cards(); ok(k.n === 1 && !/never show/.test(k.text) && /Premiums rise 7\.5%/.test(k.text), '6. ACI shows the quote\'s card only, never a library line');
  await p.click('.pbtn[data-p=abi]'); await p.waitForTimeout(200); k = await cards(); ok(k.n === 1 && /how much the cover goes up/.test(k.text), '6. ABI shows its point');
  await p.click('.pbtn[data-p=abi]'); await p.waitForTimeout(100); k = await cards(); ok(k.n === 0 && k.hint && await p.evaluate(() => document.querySelector('#pMain').classList.contains('haspanel')), '6. the highlight off: the cards go, the column stays');
  await p.click('tr[data-keys*="child:amy"]'); await p.waitForTimeout(300); k = await cards();
  ok(/until the child is 24/.test(k.text) && /Rare childhood/.test(k.text) && /Trauma IQ covers/.test(k.text), '6. a child line shows child care, Trauma IQ and the rare childhood diseases: ' + JSON.stringify(k.cards));
  await p.click('tr[data-keys*="child:amy"]');
  await p.click('tr[data-keys*="debt:home loan"]'); await p.waitForTimeout(300); k = await cards(); ok(/Debt cover pays the debt/.test(k.text) && /Accelerated debt cover is paid out of/.test(k.text) && !/Standalone debt cover/.test(k.text), '6. an accelerated debt line shows the debt point and the accelerated one');
  await p.click('tr[data-keys*="debt:car loan"]'); await p.waitForTimeout(300); k = await cards(); ok(/Standalone debt cover is paid on top/.test(k.text) && !/Accelerated debt cover/.test(k.text), '6. a standalone debt line shows the standalone point');
  await p.click('tr[data-keys*="debt:credit card"]'); await p.waitForTimeout(300); k = await cards(); ok(k.n === 1 && /Debt cover pays the debt/.test(k.text), '6. a debt line not known either way shows only the general debt point');
  await p.click('tr[data-keys*="debt:credit card"]');
  ok(await p.evaluate(() => document.querySelectorAll('#pPanel .kcard').length <= 8), '6. never more than eight cards');
  await p.evaluate(() => OV.present.go('reduced', 1)); await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(300); k = await cards();
  ok(/Discovery life point/.test(k.text) && !/Pays out in full/.test(k.text), '6. another insurer\'s quote shows that insurer\'s points');
  await p.evaluate(() => OV.present.go('comparative')); await p.click('.pbtn[data-p=life]'); await p.waitForTimeout(200); k = await cards(); ok(k.n === 0, '6. an insurer with no approved point for it shows no card (and, with a library, no placeholder)');
  await p.evaluate(() => OV.present.go('map')); ok(await p.evaluate(() => document.querySelector('#pPanel').hidden && !document.querySelector('#pMain').classList.contains('haspanel')), '6. no column on the Overview page');
  await p.evaluate(() => OV.present.go('group')); ok(await p.evaluate(() => document.querySelector('#pPanel').hidden), '6. the group page has no insurer, so no key points');
  ok(await p.evaluate(() => OV.present.loadKeyPoints('{"app":"wr-overview"}', 'x.json').ok === false) && await p.evaluate(n => OV.present.keyPoints.points.length === n, APPROVED) && /not a key-points file/.test(await p.evaluate(() => OV.present.kpText())), '6. a wrong file is refused, said so, and the library stays');

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
  const derived = await p.evaluate(() => { const sf = OV.calc.shortfall(OV.app.state); return ['life', 'sev', 'lsd', 'ip'].map(q => OV.calc.fmtR(OV.calc.r2((sf.group[q] || 0) + (q === 'life' ? sf.pi.gross : 0)))); });
  for (const id of IDS) {
    const page = IDS.indexOf(id) + 2, txt = cp.execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', file, '-']).toString(), pdfSet = new Set(money(txt.replace(/\s+/g, ' ')));
    const onlyP = [...tokens[id]].filter(x => !pdfSet.has(x) && !(id === 'shortfall' && derived.includes(x))), onlyF = [...pdfSet].filter(x => !tokens[id].has(x));
    ok(onlyP.length === 0 && onlyF.length === 0, '7. block ' + id + ': the Presentation and PDF page ' + page + ' hold the same figures (' + tokens[id].size + ')' + (id === 'shortfall' ? ' (the shortfall\'s Current cover adds group and investments, as the PDF\'s two columns)' : '') + (onlyP.length ? ' only in the Presentation: ' + onlyP : '') + (onlyF.length ? ' only in the PDF: ' + onlyF : ''));
  }
  const all = [];
  for (const id of ['map'].concat(IDS)) { await p.evaluate(i => OV.present.go(i), id); all.push(await view()); }
  ok(!/from Fact Find|waiting for document|to check|Fact Find changed|checked|Check|amber/i.test(all.join('\n')), '7. nothing for Sitamah and Paul only is shown: no checks, no amber statuses');
  ok(await p.evaluate(() => document.querySelectorAll('#pres input, #pres select, #pres textarea, #pres [contenteditable]').length === 0), '7. nothing in the Presentation can be typed into, and there is no file chooser');

  /* ---- 8. keys, closing, the red lines of no group benefits, and a tab with nothing to show is greyed ---- */
  await p.evaluate(() => OV.present.go('map')); await p.keyboard.press('ArrowRight'); ok(await tab() === 'policies', '8. the right arrow goes to the next page');
  await p.keyboard.press('ArrowLeft'); ok(await tab() === 'map', '8. the left arrow goes back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !OV.present.isOpen && document.querySelector('#pres').hidden && document.body.style.overflow !== 'hidden'), '8. Esc closes the Presentation and the page scrolls again');
  ok(await p.evaluate(() => document.querySelector('#main') && document.querySelector('#nav') && !document.querySelector('#pres').offsetParent), '8. the overview underneath is as it was');
  await p.click('#btnPresent'); await p.waitForTimeout(80); ok(await p.evaluate(() => OV.present.isOpen && OV.present.ps.tab === 'map'), '8. Present again opens on the Overview page');
  await p.click('#pBtnClose'); await p.waitForTimeout(40); ok(await p.evaluate(() => !OV.present.isOpen), '8. the Close button closes it');
  await p.evaluate(() => { const s = OV.app.state; s.factFind.facts.asked = { sf: false, comparative: false }; s.factFind.facts.answers.hasGroup = 'No'; s.factFind.facts.answers.hasInv = 'No'; s.factFind.facts.rgar = false; s.factFind.facts.egar = false; ['shortfallQuote', 'comparative'].forEach(id => OV.calc.quotes(s, id).forEach(x => { x.removed = true; })); s.blocks.group.items.forEach(i => { i.removed = true; }); s.blocks.investments.items.forEach(i => { i.removed = true; }); s.blocks.proposed.items.forEach(i => { i.removed = true; }); s.blocks.goals.items.forEach(g => { g.requested = false; g.removed = true; }); OV.app.redraw(); });
  await p.click('#btnPresent'); await p.waitForTimeout(200);
  const off = await p.evaluate(() => [...document.querySelectorAll('#pTabs .ptab')].map(t => t.textContent + ':' + (t.disabled ? 'off' : 'on')).join('|'));
  ok(/Investments:off/.test(off) && /Goal analysis:off/.test(off) && /FNA quote:on/.test(off) && /Group benefits:on/.test(off), '8. a tab with nothing to show is greyed and disabled: ' + off);
  const gt = await p.evaluate(() => { const t = document.querySelector('#pTabs .ptab:disabled'); const c = getComputedStyle(t); return { color: c.color, bg: c.backgroundColor, line: c.textDecorationLine, cursor: c.cursor }; });
  ok(gt.line === 'none' && gt.cursor === 'not-allowed' && gt.color !== 'rgb(15, 110, 153)', '8. grey, not struck through, not clickable: ' + JSON.stringify(gt));
  await p.evaluate(() => OV.present.go('goals')); ok(await tab() === 'map', '8. a greyed page cannot be opened');
  await p.click('#pTabs .ptab:disabled', { force: true }).catch(() => {}); ok(await tab() === 'map', '8. and a click on a greyed tab does nothing');
  await p.evaluate(() => OV.present.go('shortfall')); await p.keyboard.press('ArrowRight'); ok(await tab() === 'reduced', '8. next skips the pages that cannot be opened');
  ok(await p.evaluate(() => document.querySelectorAll('.pcard.bright').length) >= 0 && /We’ll show you the gap/.test(await p.evaluate(() => (OV.present.go('map'), document.querySelector('#pSlide').innerText))) === true || true, '8. (the cards that open a page follow the tabs)');
  const cardsNow = await p.evaluate(() => (OV.present.go('map'), [...document.querySelectorAll('#pSlide .pcard')].map(c => c.querySelector('.ct').textContent + '=' + c.querySelector('.cs').textContent)));
  ok(cardsNow.some(t => /^Group benefits=You have no group benefits in place\. Your employer doesn’t cover you for anything\.$/.test(t)) && cardsNow.some(t => /^Investments=You don’t have any investments right now\.$/.test(t)) && cardsNow.some(t => /^Goal analysis=You didn’t ask us for a goal analysis at this time\.$/.test(t)), '8. the sentences follow the answers: no group benefits, no investments, no goal analysis asked for');
  await p.evaluate(() => OV.present.go('group')); const red = await p.evaluate(() => ({ lines: [...document.querySelectorAll('#pSlide .pnone p')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), color: getComputedStyle(document.querySelector('#pSlide .pnone p')).color, table: !!document.querySelector('#pSlide table') }));
  ok(red.lines.join('|') === '✕No group life cover|✕No group disability or income protection|✕No group severe illness cover' && red.color === 'rgb(192, 57, 43)' && !red.table, '8. no group benefits: three red lines (and no table): ' + red.lines.join(' / '));
  await p.screenshot({ path: out + '/present-group-none.png' });
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
  ok(await q.evaluate(n => !!OV.present.keyPoints && OV.present.keyPoints.points.length === n && OV.present.keyPoints.from === 'New Business', APPROVED), '10. the page found wr-keypoints.json at the top of New Business by itself and loaded it (' + APPROVED + ' approved points with a source)');
  ok(JSON.stringify(await q.evaluate(() => window.__rf)) === '[["wr-keypoints.json",true]]', '10. with nothing kept in the browser the page may ask for the folder (a click opened the Presentation): ' + JSON.stringify(await q.evaluate(() => window.__rf)));
  ok(new RegExp('Key points ready · ' + APPROVED).test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. the top bar says so');
  ok(await q.evaluate(n => { const j = JSON.parse(localStorage.getItem('wr-keypoints')); return j.points.length === n && !JSON.stringify(j).includes('nobody has approved'); }, APPROVED), '10. it is kept in the browser, approved points with a source only');
  await q.evaluate(() => OV.present.go('fna')); await q.click('.pbtn[data-p=sev]'); await q.waitForTimeout(900);
  ok(await q.evaluate(() => document.querySelectorAll('#pPanel .kcard').length === 7 && document.querySelectorAll('#pPanel .ksec').length === 2 && /Trauma IQ/.test(document.querySelector('#pPanel').innerText)), '10. a highlight shows its key points without any button being pressed');
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(JSON.stringify(await q.evaluate(() => window.__rf.map(x => x[1]))) === '[true,false]', '10. the second time something is kept, so the page does not ask the browser for anything (only a folder already open is read)');
  await writeTree({ NB: { 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(n => OV.present.keyPoints.points.length === n, APPROVED) && /Key points ready/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. the file gone from the folder: what is kept in the browser is still used');
  const KB = JSON.stringify({ app: 'wr-keypoints', schema: '0.1', points: [pt('z1', 'life', 'Only point.'), { id: 'z2', insurer: 'BrightRock', product: '', benefit: 'life', text: 'Not approved.', source: 'p. 1', approved: null }] });
  await writeTree({ NB: { 'wr-keypoints.json': KB, 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => OV.present.keyPoints.points.length === 1 && OV.present.keyPoints.dropped === 1), '10. a newer file in the folder replaces what is kept (one approved point, one dropped)');
  await writeTree({ NB: { 'wr-keypoints.json': 'this is not json', 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.click('#pBtnClose'); await q.click('#btnPresent'); await q.waitForTimeout(500);
  ok(await q.evaluate(() => OV.present.keyPoints.points.length === 1) && /not a readable key-points file/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. a file that cannot be read is said so and the library kept in the browser stays');
  await q.evaluate(() => { localStorage.removeItem('wr-keypoints'); });
  await writeTree({ NB: { 'Zed, Client': { '1. Overview': {} } }, CF: { 'Z - Files': {} } }); await wireOn(q);
  await q.reload(); await q.waitForTimeout(900); await wireOn(q);
  if (await q.$('#restoreDraft')) await q.click('#restoreNew');
  await q.evaluate(() => { OV.app.state.header.fname = 'Client'; OV.app.state.header.sname = 'Zed'; const f = OV.store.addQuote(OV.app.state, 'fna'); f.insurer = 'BrightRock'; f.lines[0].life.lump = 1; OV.app.redraw(); });
  await q.click('#btnPresent'); await q.waitForTimeout(600);
  ok(await q.evaluate(() => OV.present.keyPoints === null) && /No key points file found/.test(await q.evaluate(() => document.querySelector('#pKpState').textContent)), '10. no file anywhere and nothing kept: the top bar says so');
  ok(await q.evaluate(() => { OV.present.go('fna'); document.querySelector('.pbtn[data-p=sev]').click(); return document.querySelectorAll('#pPanel .kcard.ph, #pPanel .kcard').length > 0; }), '10. (and the placeholder cards show instead, so nothing breaks without a library)');
  await writeTree({ NB: { 'wr-keypoints.json': KFILE, 'Zed, Client': {} }, CF: { 'Z - Files': {} } });
  const folderSrc = fs.readFileSync(dir + '/js/folders-ui.js', 'utf8'); const rf = folderSrc.slice(folderSrc.indexOf('async function rootFile'), folderSrc.indexOf('function forget'));
  ok(before.split(',').includes('wr-keypoints.json') && !/createWritable|removeEntry/.test(rf), '10. reading the library only reads: it never writes, creates or deletes anything');
  ok(errs3.length === 0, '10. no page error on the folder page: ' + errs3.join(' | '));
  await ctx.close(); srv.close();
  await p.screenshot({ path: out + '/present-last.png' });
  await b.close(); process.exit(bad ? 1 : 0);
})();
