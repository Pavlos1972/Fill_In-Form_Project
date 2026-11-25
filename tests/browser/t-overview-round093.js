/* The Client Overview Studio 0.93 on the real page (Paul's fourth round of 23 November, after he tested 0.92 on a real client), over a REAL directory tree in the browser's private file system: the folder tells what a file is
   (a policy schedule whose name does not say so, the Astute report), a BrightRock e-mail saved in the client's folder is read for the death-related income portion (and one can be pasted into a quote), a debt's instalment is one
   figure (Life cover and Lump sum disability) and a missing one is taken from the client's other BrightRock quote or the Fact Find and says so, "FNB Rev Credit" and "Revolving credit" are one debt, the Astute report date is filled,
   block 11 gets the Fact Find's answers also in a review year, the ACI is 3 short points (entry screen and Presentation), the Checks card is folded. The Anthropic call is a stand-in. Invented client ("Round, Rita").
   Screenshots (deviceScaleFactor 2): r4-fna, r4-paste, r4-policies, r4-pres-policies, r4-block11. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const EML = 'From: BrightRock <info@example.test>\r\nSubject: Your quotes\r\nDate: Thu, 19 Nov 2026 10:00:00 +0200\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nQuotes for Rita Round.\r\nCP 100000091 (FNA): death-related income portion R4,500 p.m.\r\nCP 100000093 (reduced): death-related income portion R3,900 p.m.\r\n';
const TREE = {
  NB: { 'Round, Rita': { '1. Overview': {}, '2. Fact Find': { 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).pdf': 'FFPDF', 'Fact Find (Audio to Text) - 20.11.26 - (Rita Round).json': '{}' },
    '3. Quotes': { 'BR FNA - 100000091 - 19.11.26.pdf': 'FNA91', 'BR Shortfall - 100000092 - 19.11.26.pdf': 'SF92', 'BR Reduced Quote - 100000093 - 19.11.26.pdf': 'RED93', 'Re BrightRock quotes.eml': EML },
    '5. Astute': { 'Astute - 20.11.26.pdf': 'AST' }, '6. Policy Schedules': { 'Lifestyle Protector 12.10.26.pdf': 'LIB' } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const DEBTS = [['Home loan', 'Test Bank A', 'R 9 000.00', 'R 900 000.00'], ['Revolving credit', 'Test Bank B', 'R 1 873.00', 'R 72 000.00']];
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: v('Rita'), sname: v('Round'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026'),
  ma: v('Medical aid'), ma_broker: v('Other broker'), n_ma: v('Premium paid by the employer.'), gap: v('Yes'), gap_prov: v('Test Gap Co.'), gap_broker: v('Other broker'), n_gap: v('Quote requested.') },
  l: { kids: [], debts: DEBTS.map(d => ({ d: { type: d[0], prov: d[1], desc: d[0], inst: d[2], bal: d[3], term: '60' } })), risk: [{ d: { prov: 'Liberty', spend: 'R 1 371.68', broker: 'Other broker' } }], grp: [], ret_ra: [], inv: [], raq: [], invq: [], bfred: [] } };
const LONG_ACI = 'The premium is reviewed every year on the policy anniversary. Cover for children is priced pro rata from the second year; waiver of premium is not indexed. Further wording follows here and continues.';
const debtL = (name, lump, monthly) => ({ type: 'debt', debt: name, life: { lump, monthly }, lsd: { lump, monthly: null }, abi: 0 });
const READ = {
  FNA91: { insurer: 'BrightRock', number: '100000091', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, premium: 2900, abi: 5, servicing: false, disabilityAge: 65, lines: [{ type: 'household', accelerated: false, life: { lump: 800000, monthly: 5000 }, abi: 5 }, Object.assign(debtL('Home loan', 900000, 9000), { accelerated: true }), debtL('Revolving credit', 72000, 1873), { type: 'death', accelerated: false, life: { lump: 300000 }, abi: 5 }] },
  SF92: { insurer: 'BrightRock', number: '100000092', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, premium: 1900, abi: 5, servicing: false, disabilityAge: 65, lines: [debtL('Home loan', 700000, null), { type: 'death', life: { lump: 200000 }, abi: 5 }] },
  RED93: { insurer: 'BrightRock', number: '100000093', date: '19/11/2026', rates: 'Non-smoker rates', aci: 7.5, premium: 1500, abi: 5, servicing: false, disabilityAge: 65, lines: [debtL('Home loan', 800000, null), debtL('FNB Rev Credit', 72000, null), { type: 'death', life: { lump: 100000 }, abi: 5 }] },
  LIB: { insurer: 'Liberty', product: 'Liberty Life Plan', policyNo: 'L-900', premium: 1371.68, aciText: LONG_ACI, aciPoints: ['Reviewed yearly after year 1', 'Extra cover priced pro rata', 'Waiver of premium not indexed'],
    benefits: { life: 'Whole of life', sev: 'Living Lifestyle Plus, standalone', lsd: 'Absolute Protector Plus, OOD, to age 65', ip: 'After 24 months, to age 65' },
    lines: [{ type: 'other', label: 'Cover', life: { lump: 2044346.02 }, sev: { lump: 817738.41 }, lsd: { lump: 1500000 }, ip: { monthly: 25000 }, waiting: '24 months' }] },
  AST: { reportDate: null, investments: [{ provider: 'Test Provider', product: 'Test RA', policyNo: 'T-1', gross: 100000, monthly: 0 }] }
};
const mailAnswer = t => ({ quotes: ['100000091', '100000092', '100000093'].filter(n => t.indexOf(n) >= 0).map(n => ({ number: n, deathIncomePortion: n === '100000091' ? 4500 : n === '100000092' ? 2250 : 3900 })) });
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = ({ read: READ_ARG, mail: MAILFN }) => {
    window.__api = []; window.__notesApi = []; window.__read = READ_ARG; window.__mail = new Function('t', 'return (' + MAILFN + ')(t)');
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let answer;
      if (c0.type === 'text') { window.__notesApi.push(c0.text); answer = c0.text.indexOf('THE E-MAIL:') >= 0 ? window.__mail(c0.text) : { items: {} }; }
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
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, { read: READ, mail: String(mailAnswer) });
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
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ)); await p.evaluate(() => { OV.schema.NEED_BLOCKS.forEach(id => OV.store.setNeeded(OV.app.state, id, true)); OV.app.setState(OV.app.state); });

  /* ---- 1. Load from client folder: the pick list (the folder tells what a file is; the e-mail is listed) ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const list = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => ({ t: l.textContent.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked })));
  const lf = n => list.filter(x => x.t.indexOf(n) >= 0)[0];
  ok(lf('Lifestyle Protector') && lf('Lifestyle Protector').on && /Current policies/.test(lf('Lifestyle Protector').t), '9. a schedule whose name does not say what it is is ticked as a policy because of its folder (6. Policy Schedules): ' + (lf('Lifestyle Protector') || {}).t);
  ok(lf('Astute') && lf('Astute').on, '5. the Astute report is ticked');
  ok(lf('Re BrightRock quotes.eml') && lf('Re BrightRock quotes.eml').on && /BrightRock email/.test(lf('Re BrightRock quotes.eml').t), '3. the e-mail saved in the quotes folder is listed and ticked: ' + (lf('Re BrightRock quotes.eml') || {}).t);
  await p.click('dialog.fdlg [data-yes]'); await waitDone(); await p.waitForTimeout(600);

  /* ---- 2. what the load made of it ---- */
  const S = await st(), fna = S.blocks.fna.quotes[0], sf = S.blocks.shortfallQuote.quotes[0], red = S.blocks.reduced.quotes[0];
  const L = (q, t, n) => q.lines.filter(l => l.type === t)[n || 0];
  ok(!!fna && !!sf && !!red && S.blocks.fna.quotes.length === 1 && S.blocks.reduced.quotes.length === 1, '2. the three quotes were read once each');
  ok(L(fna, 'death').life.monthly === 4500 && /^from the BrightRock email( \d\d\/\d\d)?$/.test(L(fna, 'death').via['life.monthly']), '3. the FNA\'s death-related income portion came from the e-mail file: ' + JSON.stringify(L(fna, 'death').life) + ' ' + JSON.stringify(L(fna, 'death').via));
  ok(L(red, 'death').life.monthly === 3900, '3. and the reduced quote\'s too (the e-mail names its CP number)');
  ok(L(sf, 'death').life.monthly === 'Not found', '3. the shortfall quote\'s CP number is not in the e-mail: still Not found (it can be pasted)');
  ok(L(fna, 'debt', 0).lsd.monthly === 9000 && L(fna, 'debt', 1).lsd.monthly === 1873, '2. on the FNA, every debt\'s Lump sum disability instalment is its Life cover instalment');
  ok(L(sf, 'debt').life.monthly === 9000 && L(sf, 'debt').lsd.monthly === 9000 && L(sf, 'debt').via['life.monthly'] === 'from the FNA quote CP 100000091', '6. the shortfall quote\'s debt: instalment taken from the FNA, and carried into the Lump sum disability box: ' + JSON.stringify(L(sf, 'debt').via));
  ok(L(red, 'debt', 0).life.monthly === 9000 && L(red, 'debt', 1).life.monthly === 1873 && L(red, 'debt', 1).lsd.monthly === 1873 && /^from the FNA quote/.test(L(red, 'debt', 1).via['life.monthly']), '7. the reduced quote\'s debts are no longer Not found: "FNB Rev Credit" took the FNA\'s Revolving credit instalment');
  const dp = await p.evaluate(() => OV.check.run(OV.app.state).problems.filter(x => x.id === 'quote.debts').map(x => x.where + ': ' + x.message));
  ok(!dp.some(m => /Rev|Revolving/i.test(m) && /reduced|only in the quote|not in the Fact Find|not on this quote/i.test(m)), '10. "FNB Rev Credit" and "Revolving credit" are one debt: nothing about it is flagged on the reduced quote (other messages: ' + dp.length + ')');
  ok(S.header.astuteDate === '20/11/2026', '5. the Astute report date is in Client details: ' + S.header.astuteDate);
  const pol = S.blocks.policies.items.filter(i => /liberty/i.test(i.insurer))[0];
  ok(pol && pol.product === 'Liberty Life Plan' && pol.policyNo === 'L-900' && pol.aciPoints.length === 3, '9. the Liberty policy has its details (product, policy number, ACI points)');
  const med = S.blocks.other.items.filter(i => i.key === 'medical')[0], gapi = S.blocks.other.items.filter(i => i.key === 'gap')[0];
  ok(/\(Fact Find 20\/11\)$/.test(med.note) && /Premium paid by the employer/.test(med.note) && gapi.company === 'Test Gap Co.' && /Quote requested/.test(gapi.note), '8. medical aid and gap cover carry the Fact Find\'s answers with their source: ' + med.note);

  /* ---- 3. a review year: the carried-over empty items get this year's answers ---- */
  const rev = await p.evaluate(t => {
    const old = OV.store.blank(); OV.store.fillFromFactFind(old, JSON.stringify({ app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Rita' }, sname: { v: 'Round' }, date: { v: '01/11/2025' } }, l: { kids: [], debts: [], risk: [] } }), 'old.json');
    old.blocks.other.items.forEach(i => { i.st = 'ff'; });
    const r = OV.store.startReview(old, '24/11/2026'), s = r.state, was = s.blocks.other.items.map(i => i.st).join();
    OV.store.fillFromFactFind(s, t, 'ff.json'); OV.schema.NEED_BLOCKS.forEach(id => OV.store.setNeeded(s, id, true)); return { was, now: s.blocks.other.items.map(i => ({ k: i.key, st: i.st, note: i.note })) };
  }, JSON.stringify(FFJ));
  ok(/verify|empty/.test(rev.was) && /\(Fact Find 20\/11\)$/.test(rev.now.filter(x => x.k === 'medical')[0].note) && /\(Fact Find 20\/11\)$/.test(rev.now.filter(x => x.k === 'gap')[0].note), '8. a New review year overview (items carried over to check, with nothing in them) gets this year\'s Fact Find answers: ' + JSON.stringify(rev.now.slice(0, 2)));

  /* ---- 4. the Checks card is folded, and folds again after a fill ---- */
  const chk = () => p.evaluate(() => { const d = document.querySelector('#checks details.chkall'), dl = document.querySelector('#checks .docline'); return { has: !!d, open: !!(d && d.open), vis: dl ? dl.checkVisibility() : null, sum: d ? d.querySelector('summary').textContent : '' }; });
  let c1 = await chk();
  ok(c1.has && !c1.open && c1.vis === false && /to look at|All checked/.test(c1.sum), '4. after the load the Checks card is closed: ' + JSON.stringify(c1));
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(250); await quiet();
  await p.click('#checks details.chkall > summary'); await p.waitForTimeout(150);
  ok((await chk()).open, '4. one click opens it');
  await p.setInputFiles('#ffIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FFJ)) }); await p.waitForTimeout(700); await quiet();
  ok(!(await chk()).open, '4. a fill from the Fact Find closes it again');

  /* ---- 5. the entry screen: the FNA's debts, the points, the e-mail box ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(250); await quiet();
  const fl = await p.evaluate(() => { const rows = [...document.querySelectorAll('#main .ovt tbody tr.ln')], debt = rows.filter(r => /Debt/.test(r.cells[0].textContent)); return { n: debt.length, lsd: debt.map(r => r.cells[4].querySelector('input[data-p$=".lsd.monthly"]').value), life: debt.map(r => r.cells[2].querySelector('input[data-p$=".life.monthly"]').value), bre: !!document.querySelector('details.bre') }; });
  ok(fl.n === 2 && fl.lsd.join() === fl.life.join() && fl.lsd.every(x => /R/.test(x)), '2. on the screen the Lump sum disability instalment of each debt equals its Life cover instalment: ' + fl.life.join(' / ') + ' | ' + fl.lsd.join(' / '));
  ok(fl.bre, '3. a BrightRock quote has a Paste BrightRock email box');
  const acc = await p.evaluate(() => [...document.querySelectorAll('#main tr.ln')].map(r => { const s = r.querySelector('select[data-p$=".accelerated"]'); return r.cells[0].querySelector('b').textContent.trim() + ':' + (s ? s.value : '-'); }));
  ok(acc.indexOf('Household needs:false') >= 0 && acc.indexOf('Death-related needs:false') >= 0 && acc.indexOf('Debt:true') >= 0 && acc.indexOf('Debt:') >= 0, '11. every need line has its Accelerated / Standalone choice on the entry screen (Standalone for household and death-related, Accelerated for one debt, blank where the quote does not say): ' + acc.join(' | '));
  await p.evaluate(() => document.querySelector('#main .ovt').scrollIntoView()); await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/r4-fna.png', fullPage: false });

  /* ---- 6. the shortfall quote: pasting the e-mail ---- */
  await p.evaluate(() => OV.app.go('shortfallQuote')); await p.waitForTimeout(300); await quiet();
  const viaTxt = await p.evaluate(() => [...document.querySelectorAll('#main small.via')].map(e => e.textContent));
  ok(viaTxt.some(t => /from the FNA quote CP 100000091/.test(t)), '7. the screen says where the instalment came from: ' + viaTxt.join(' | '));
  await p.evaluate(() => { const d = document.querySelector('details.bre'); d.open = true; });
  await p.fill('textarea[data-bre-text]', 'Hi, for CP 100000092 the death related income portion is R2 250 a month. Regards, BrightRock');
  await p.click('[data-bre-read]'); await p.waitForFunction(() => { const q = OV.app.state.blocks.shortfallQuote.quotes[0]; const l = q.lines.filter(x => x.type === 'death')[0]; return l.life.monthly === 2250; }, null, { timeout: 15000 }).catch(() => {});
  const pasted = await p.evaluate(() => { const q = OV.app.state.blocks.shortfallQuote.quotes[0], l = q.lines.filter(x => x.type === 'death')[0], m = document.querySelector('[data-bre-msg]'); return { v: l.life.monthly, via: l.via && l.via['life.monthly'], st: l.st, msg: m ? m.textContent : '' }; });
  ok(pasted.v === 2250 && /^from the BrightRock email/.test(pasted.via) && /Filled/.test(pasted.msg), '3. the pasted e-mail filled the death-related income portion and says so: ' + JSON.stringify(pasted));
  const sent = await p.evaluate(() => window.__notesApi.filter(t => t.indexOf('THE E-MAIL:') >= 0).map(t => t.slice(t.indexOf('THE E-MAIL:'))));
  ok(sent.length >= 2 && sent.every(t => !/ID number|@/.test(t.replace(/info@example\.test/g, ''))), '3. only the e-mails\' text went to Claude (' + sent.length + ' calls)');
  await p.evaluate(() => document.querySelector('details.bre').scrollIntoView()); await p.waitForTimeout(150); await quiet();
  await p.screenshot({ path: out + '/r4-paste.png', fullPage: false });

  /* ---- 7. current policies: the ACI as points, entry screen and Presentation ---- */
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(300); await quiet();
  const ent = await p.evaluate(() => { const u = document.querySelector('#main .pols ul.aciu'); const tr = u && u.closest('tr'); return u ? { li: u.querySelectorAll('li').length, title: u.title, txt: u.textContent, h: Math.round(tr.getBoundingClientRect().height), w: Math.round(u.getBoundingClientRect().width), wrap: getComputedStyle(u).overflowWrap } : null; });
  ok(ent && ent.li === 3 && ent.title.length > 150 && /^The premium is reviewed/.test(ent.title) && ent.txt.length < 120, '1. the entry screen shows three short points; the whole wording is the hover text: ' + (ent && ent.txt));
  ok(ent && ent.h <= 170 && ent.w >= 130 && ent.wrap === 'break-word', '1. the policy row is not stretched by the points (row ' + (ent && ent.h) + ' px, points ' + (ent && ent.w) + ' px wide) and a word is not broken in the middle');
  await p.screenshot({ path: out + '/r4-policies.png', fullPage: false });
  await p.click('#btnPresent'); await p.waitForTimeout(500); await p.click('#pres .ptab[data-tab="policies"]'); await p.waitForTimeout(600);
  const pr = await p.evaluate(() => { const t = document.querySelector('#pres .ptbl.pols'), a = t && t.querySelector('.a.aci.pts'), td = a && a.closest('td'); const rows = [...t.querySelectorAll('tbody tr')].map(tr => Math.round(tr.getBoundingClientRect().height)), r = a && a.getBoundingClientRect(), tr = td && td.getBoundingClientRect(); return a ? { li: a.querySelectorAll('li').length, title: a.title, rows, inside: r.left >= tr.left - 0.5 && r.right <= tr.right + 0.5 && r.bottom <= tr.bottom + 0.5, txt: a.textContent } : null; });
  ok(pr && pr.li === 3 && /^The premium is reviewed/.test(pr.title) && pr.inside && Math.max.apply(null, pr.rows) <= 140, '1. the Presentation shows the three points inside the cell, the row not stretched (' + (pr && pr.rows.join(' ')) + ' px): ' + (pr && pr.txt));
  await p.screenshot({ path: out + '/r4-pres-policies.png' });
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(600);
  const cov = await p.evaluate(() => [...document.querySelectorAll('#pres small.cov')].map(e => e.textContent));
  ok(cov.filter(t => t === 'Standalone').length >= 2 && cov.filter(t => t === 'Accelerated').length >= 1, '11. the Presentation tags every need line: ' + cov.join(', '));
  await p.screenshot({ path: out + '/r4-pres-fna.png' });
  await p.click('#pBtnClose'); await p.waitForTimeout(300);
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); const pdfFile = out + '/r4-overview.pdf'; fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const ptxt = cp.execFileSync('pdftotext', ['-layout', pdfFile, '-']).toString();
  ok((ptxt.match(/Standalone/g) || []).length >= 2 && /Accelerated/.test(ptxt) && /- Reviewed/.test(ptxt) && /- Extra cover/.test(ptxt), '1, 11. the PDF has the ACI points and the Accelerated / Standalone tag of the need lines');

  /* ---- 8. block 11 on the screen ---- */
  await p.evaluate(() => OV.app.go('other')); await p.waitForTimeout(300); await quiet();
  ok(await p.evaluate(() => /Premium paid by the employer/.test([...document.querySelectorAll('#main textarea[data-p$=".note"]')].map(t => t.value).join(' '))), '8. Medical aid and Gap cover show their note on the screen');
  await p.screenshot({ path: out + '/r4-block11.png', fullPage: false });

  ok(!errs.length, '9. no script errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
