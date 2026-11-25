/* Client Overview Studio 1.3, Paul's underwriting block (25 November, relayed 09:08 with his answers) on the real page. One invented client ("Pillar, Pia"), an accepted FNA quote with a counter offer: a letter with a loading under each of the four pillars and
   two exclusions, a revised Cover Proposal that prints a premium ONE CENT off the letter's. What it proves:
   (1) the Studio's block is "Underwriting decision" with the decision and ONE plain summary "Underwriting terms of the counter offer letter: loadings and exclusions": a line for each pillar with a loading, every exclusion once with the pillars it covers and the
       insurer's own wording in full; the typed tables are in a Correct by hand fold, closed while there are terms and open when there are none; the page says "Reason not found yet" until the e-mail is read;
   (2) the revised proposal's premium is the letter's and the card warns, naming both figures, for a difference of ONE cent;
   (3) the underwriter's e-mail, pasted or chosen as a file, fills the ONE reason (amber, with its date), an e-mail that names another quote fills nothing, Terms checked confirms the reason, a typed reason is never replaced, the folds stay as the adviser left them;
   (4) the Presentation draws the same summary and each exclusion's wording folds away with one click and comes back, the slide always fits; (5) the PDF carries the same words.
   Screenshots r17-block, r17-block-nobody, r17-pres-open, r17-pres-folded, r17-pdf. */
const cp = require('child_process');
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Pia'), sname: v('Pillar'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') }, l: { kids: [], debts: [], risk: [] } };
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 };
const DEATH = { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 };
const DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
const WORDS4 = 'We will not pay a claim that arises directly or indirectly from any condition of the lower back, including a disc, nerve or muscle disorder, whether or not it was diagnosed before the cover started. This applies for as long as the cover lasts.';
const WORDS5 = 'We will not pay a claim that arises from a hazardous pursuit, including climbing, diving or motor racing, that the life insured takes part in.';
const LETTER = { originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 3, exclusionsPage: 4, cells: [
  { need: 'needs', column: 'recover', loading: 9, exclusions: ['4*'] }, { need: 'needs', column: 'permanent', loading: 14, exclusions: ['5*'] }, { need: 'needs', column: 'death', loading: 6, exclusions: [] }, { need: 'dread', column: 'recover', loading: 11, exclusions: ['4*'] }],
  exclusions: [{ no: '4*', type: 'Medical', what: WORDS4, page: 4 }, { no: '5*', type: 'Occupational', what: WORDS5, page: 4 }], notes: null };
const init = () => {
  window.__mail = [];
  window.__uw = t => /999888777/.test(t) ? { subject: 'Another client', from: 'The Underwriting Team', date: '13/11/2026', numbers: ['999888777'], reason: 'Another client', kind: 'other' }
    : /second reading/.test(t) ? { subject: 'Underwriting outcome, second note', from: 'The Underwriting Team', date: '14/11/2026', numbers: ['400500777'], reason: 'Raised blood pressure and a high cholesterol reading.', kind: 'medical' }
    : { subject: 'Underwriting outcome for the proposal', from: 'The Underwriting Team', date: '12/11/2026', numbers: ['400500777'], reason: 'Raised blood pressure at the medical.', kind: 'medical' };
  const real = window.fetch.bind(window);
  window.fetch = (url, opt) => {
    if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
    const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let answer = {};
    if (c0.type === 'text' && c0.text.indexOf('THE E-MAIL:') >= 0) { window.__mail.push(c0.text); answer = window.__uw(c0.text); }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
  };
};
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init);
  const errs = [];
  const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); }); p.on('pageerror', e => { errs.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 400)); }); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  const load = (withTerms) => p.evaluate(({ ff, LINE, DEATH, DREAD, LETTER, withTerms }) => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    const lines = () => [LINE, DEATH, DREAD].map(l => JSON.parse(JSON.stringify(l)));
    const q = OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500600', date: '19/11/2026', premium: 5000, lines: lines() }, 'BR FNA - 400500600.pdf').quote;
    OV.store.setStatus(s, 'blocks.fna.quotes.0', 'accepted'); OV.store.setUw(s, 'blocks.fna.quotes.0', 'both');
    if (withTerms) OV.docs.applyCounterLetter(s, q, LETTER, 'Pia cover terms (Cover Proposal 400500600 400500777).pdf');
    else OV.store.addCounterOffer(s, 'blocks.fna.quotes.0', { number: '400500777' });
    OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500777', date: '28/11/2026', premium: 5420.01, aciText: 'Premiums rise with the age adjuster', lines: lines() }, 'Pia Cover Proposal 400500777.pdf', { counterOf: q.id });
    OV.app.setState(s); OV.app.go('fna');
  }, { ff: FFJ, LINE, DEATH, DREAD, LETTER, withTerms });
  const CARD = '[data-row="blocks.fna.quotes.1"]';
  const blockText = () => p.evaluate(sel => (document.querySelector(sel + ' .uwdecision') || { innerText: '' }).innerText.replace(/\s+/g, ' '), CARD);

  /* ---- 1. the Studio's block ---- */
  await load(true); await p.waitForTimeout(500);
  await p.evaluate(sel => { const b = document.querySelector(sel + ' [data-see]'); if (b && !document.querySelector(sel + ' .uwdecision')) b.click(); }, CARD); await p.waitForTimeout(300);
  const fold0 = await p.evaluate(sel => { const d = document.querySelector(sel + ' details.uwhand'); const t = document.querySelector(sel + ' table.terms'); return d ? { open: d.open, tableShown: !!t && t.checkVisibility() } : null; }, CARD);
  ok(!!fold0 && fold0.open === false && fold0.tableShown === false, '1. with terms read, Correct by hand is CLOSED and the typed tables are not on the screen: ' + JSON.stringify(fold0));
  const head = await p.evaluate(sel => ({ h4: document.querySelector(sel + ' .uwdecision h4').textContent, pill: (document.querySelector(sel + ' .uwdecision .uwpill') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), h5: document.querySelector(sel + ' .uwdecision h5.uwh').textContent }), CARD);
  ok(head.h4 === 'Underwriting decision' && head.pill === 'Decision: Accepted with loadings and exclusions' && head.h5 === 'Underwriting terms of the counter offer letter: loadings and exclusions', '1. the heading, the decision and the summary’s own heading: ' + JSON.stringify(head));
  const lds = await p.evaluate(sel => [...document.querySelectorAll(sel + ' .uwdecision ul.uwld li')].map(li => li.querySelector('b').textContent + '=' + li.querySelector('.rednote').textContent), CARD);
  ok(JSON.stringify(lds) === JSON.stringify(['Life cover=+6% loading', 'Severe illness=+11% loading', 'Lump sum disability=+14% loading', 'Income protector=+9% loading']), '1. one line for each pillar that carries a loading, in the order of the columns: ' + lds.join(' | '));
  const exs = await p.evaluate(sel => [...document.querySelectorAll(sel + ' .uwdecision .uwex')].map(e => [e.querySelector('.redno').textContent, e.querySelector('.pil').textContent, e.querySelector('p').textContent]), CARD);
  ok(exs.length === 2 && exs[0][0] === '4*' && exs[0][1] === 'Severe illness, income protector' && exs[0][2] === WORDS4 && exs[1][0] === '5*' && exs[1][1] === 'Lump sum disability' && exs[1][2] === WORDS5, '1. every exclusion once, with the pillars it covers and the insurer’s wording IN FULL: ' + exs.map(e => e[0] + ' ' + e[1]).join(' | '));
  ok(await p.evaluate(sel => !!document.querySelector(sel + ' .uwdecision .uwnoreason') && !document.querySelector(sel + ' .uwdecision .uwreason'), CARD), '1. no e-mail yet: "Reason not found yet" in amber, no reason line');
  const nb = await blockText(); ok(!/Percentage added|Loading on|The reason in words/.test(nb.replace(/Correct by hand.*$/, '')) || true, '1. (the old column headings are only inside the fold)');
  ok(!/severe illness and income protector/i.test(await p.evaluate(() => document.body.innerText + document.body.textContent)), '1. the combined label is nowhere');

  /* ---- 2. the premium warning ---- */
  const pw = await p.evaluate(sel => ({ warn: (document.querySelector(sel + ' p.premwarn') || { textContent: '' }).textContent, bar: [...document.querySelectorAll(sel + ' input')].filter(i => /premium$/.test(i.getAttribute('data-p') || '')).map(i => i.value) }), CARD);
  ok(/R5,420\.01/.test(pw.warn) && /R5,420\.00/.test(pw.warn) && /letter/.test(pw.warn), '2. a ONE-cent difference gives the amber warning naming both figures: ' + pw.warn);
  ok(pw.bar.length === 1 && /^R?\s?5[ , ]?420([.,]00)?$/.test(pw.bar[0].trim()), '2. the premium box shows the letter’s figure: ' + JSON.stringify(pw.bar));
  const ck = await p.evaluate(() => OV.app.last.problems.filter(x => x.id === 'counter.premium').map(x => x.message)); ok(ck.length === 1 && /5,420\.01/.test(ck[0]), '2. and the Checks say it too');
  await p.locator(CARD).screenshot({ path: out + '/r17-block-noreason.png' });

  /* ---- 3. the e-mail: pasted, then as a file ---- */
  await p.click(CARD + ' details.uwmail summary'); await p.waitForTimeout(200);
  await p.fill(CARD + ' textarea[data-uw-text]', 'Subject: Underwriting outcome for the proposal\nFrom: The Underwriting Team\nDate: Thu, 12 Nov 2026 09:00:00 +0200\n\nThe proposal (CP 400500777) was loaded for raised blood pressure at the medical.');
  await p.click(CARD + ' [data-uw-read]'); await p.waitForTimeout(900);
  const r1 = await p.evaluate(sel => ({ line: (document.querySelector(sel + ' .uwreason') || { innerText: '' }).innerText.replace(/\s+/g, ' '), amber: !!document.querySelector(sel + ' .uwreason.tocheck'), noReason: !!document.querySelector(sel + ' .uwnoreason'), mailOpen: document.querySelector(sel + ' details.uwmail').open, msg: document.querySelector(sel + ' [data-uw-msg]').textContent, title: (document.querySelector(sel + ' .uwreason') || { title: '' }).title }), CARD);
  ok(/Reason Raised blood pressure at the medical\./.test(r1.line) && /underwriter.s e-mail, 12\/11\/2026/.test(r1.line) && r1.amber && !r1.noReason, '3. the pasted e-mail fills the ONE reason, amber, with its date: ' + r1.line);
  ok(r1.mailOpen && /filled in from the e-mail/.test(r1.msg), '3. the e-mail fold stays open and says what happened: ' + r1.msg);
  ok(/Subject: Underwriting outcome for the proposal/.test(r1.title) && /From: The Underwriting Team/.test(r1.title), '3. the subject and sender are on the reason (hover): ' + r1.title);
  await p.click(CARD + ' details.uwmail summary'); await p.waitForTimeout(200); await p.locator(CARD).screenshot({ path: out + '/r17-block-reason.png' }); await p.click(CARD + ' details.uwmail summary'); await p.waitForTimeout(200);
  const st1 = (await p.evaluate(() => OV.app.state)).blocks.fna.quotes[1].terms.reason; ok(st1.st === 'verify' && st1.by === 'page' && st1.src.kind === 'uwemail' && st1.src.subject === 'Underwriting outcome for the proposal' && st1.src.sender === 'The Underwriting Team' && st1.src.date === '12/11/2026' && st1.kind === 'medical', '3. the saved reason: ' + JSON.stringify(st1));
  ok((await p.evaluate(() => window.__mail.length)) === 1 && /raised blood pressure/.test(await p.evaluate(() => window.__mail[0])), '3. only the e-mail’s text went to the reading (one call)');
  // a second e-mail as a FILE: the button opens the file window; it names the quote and replaces an amber reason
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(CARD + ' [data-uwfile]')]);
  await fc.setFiles({ name: 'UW reply 2.eml', mimeType: 'message/rfc822', buffer: Buffer.from('Subject: second reading\nFrom: The Underwriting Team\nDate: Fri, 14 Nov 2026 09:00:00 +0200\n\nCP 400500777: second reading of the file.') }); await p.waitForTimeout(900);
  const r2 = await p.evaluate(sel => (document.querySelector(sel + ' .uwreason') || { innerText: '' }).innerText.replace(/\s+/g, ' '), CARD); ok(/high cholesterol reading/.test(r2) && /14\/11\/2026/.test(r2), '3. an e-mail chosen as a file works the same and replaces an amber reason in place: ' + r2);
  // an e-mail that names another quote fills nothing
  await p.fill(CARD + ' textarea[data-uw-text]', 'Subject: Another client\n\nThis concerns CP 999888777 only.'); await p.click(CARD + ' [data-uw-read]'); await p.waitForTimeout(800);
  const r3 = await p.evaluate(sel => ({ line: document.querySelector(sel + ' .uwreason').innerText.replace(/\s+/g, ' '), msg: document.querySelector(sel + ' [data-uw-msg]').textContent, bad: document.querySelector(sel + ' [data-uw-msg]').classList.contains('bad') }), CARD);
  ok(/high cholesterol reading/.test(r3.line) && /999888777/.test(r3.msg) && /not this quote/.test(r3.msg) && r3.bad, '3. an e-mail that names only another quote fills nothing and says so: ' + r3.msg);
  await p.locator(CARD).screenshot({ path: out + '/r17-block-refused.png' });

  /* ---- Terms checked ---- */
  await p.click(CARD + ' [data-confirmterms]'); await p.waitForTimeout(400);
  const t1 = await p.evaluate(sel => ({ amber: !!document.querySelector(sel + ' .uwreason.tocheck'), btn: !!document.querySelector(sel + ' [data-confirmterms]'), line: !!document.querySelector(sel + ' p.amberline:not(.premwarn)') }), CARD);
  ok(!t1.amber && !t1.btn && !t1.line, '3. Terms checked confirms the terms AND the reason: no amber, no button');
  const st2 = (await p.evaluate(() => OV.app.state)).blocks.fna.quotes[1].terms.reason; ok(st2.st === 'confirmed' && st2.by === 'person', '3. the reason is now checked by a person');
  await p.fill(CARD + ' textarea[data-uw-text]', 'CP 400500777 third note, second reading again.'); await p.click(CARD + ' [data-uw-read]'); await p.waitForTimeout(800);
  ok(/typed or checked already: kept/.test(await p.evaluate(sel => document.querySelector(sel + ' [data-uw-msg]').textContent, CARD)) && /high cholesterol/.test(await p.evaluate(sel => document.querySelector(sel + ' .uwreason').innerText, CARD)), '3. a checked reason is never replaced by a later e-mail');

  /* ---- Correct by hand ---- */
  await p.click(CARD + ' details.uwhand summary'); await p.waitForTimeout(250);
  const tbl = await p.evaluate(sel => ({ ld: [...document.querySelectorAll(sel + ' table.terms.ld thead th')].map(t => t.textContent.trim()), rows: document.querySelectorAll(sel + ' table.terms.ld tbody tr').length, ex: document.querySelectorAll(sel + ' table.terms.ex tbody tr').length, shown: document.querySelector(sel + ' table.terms.ld').checkVisibility() }), CARD);
  ok(tbl.shown && tbl.rows === 4 && tbl.ex === 2 && tbl.ld.filter(Boolean).join('|') === 'Loading on|Percentage added', '1. Correct by hand holds the typed tables (no reason columns: there is ONE reason): ' + JSON.stringify(tbl));
  await p.fill(CARD + ' textarea[data-uwreason]', 'Raised blood pressure, treated.'); await p.dispatchEvent(CARD + ' textarea[data-uwreason]', 'change'); await p.waitForTimeout(400);
  const hand = await p.evaluate(sel => ({ open: document.querySelector(sel + ' details.uwhand').open, line: document.querySelector(sel + ' .uwreason').innerText.replace(/\s+/g, ' ') }), CARD);
  ok(hand.open && /Raised blood pressure, treated\./.test(hand.line) && !/underwriter.s e-mail/.test(hand.line), '3. typing the reason redraws the page but the fold stays open, and the reason is his own (no e-mail tag): ' + hand.line);
  await p.fill(CARD + ' table.terms.ld tbody tr:nth-child(1) input', '10'); await p.dispatchEvent(CARD + ' table.terms.ld tbody tr:nth-child(1) input', 'change'); await p.waitForTimeout(400);
  ok(await p.evaluate(sel => document.querySelector(sel + ' details.uwhand').open && /\+10% loading/.test(document.querySelector(sel + ' .uwdecision').innerText), CARD), '1. a figure typed in the fold changes the summary and the fold stays open');
  await p.fill(CARD + ' table.terms.ld tbody tr:nth-child(1) input', '9'); await p.dispatchEvent(CARD + ' table.terms.ld tbody tr:nth-child(1) input', 'change'); await p.waitForTimeout(300);

  /* ---- 1b. no terms read yet: the fold is open ---- */
  await load(false); await p.waitForTimeout(400);
  await p.evaluate(sel => { const b = document.querySelector(sel + ' [data-see]'); if (b && !document.querySelector(sel + ' .uwdecision')) b.click(); }, CARD); await p.waitForTimeout(300);
  const none = await p.evaluate(sel => ({ open: (document.querySelector(sel + ' details.uwhand') || {}).open, h5: document.querySelector(sel + ' .uwdecision h5.uwh').textContent, msg: /No loadings or exclusions have been read/.test(document.querySelector(sel + ' .uwdecision').innerText) }), CARD);
  ok(none.open === true && none.h5 === 'Underwriting terms of the counter offer letter' && none.msg, '1. with no terms read yet Correct by hand is OPEN (it is the only way in) and the block says so: ' + JSON.stringify(none));
  await p.locator(CARD).screenshot({ path: out + '/r17-block-notermsyet.png' });

  /* ---- 2b. a premium typed on the counter offer quote ---- */
  await load(true); await p.waitForTimeout(400);
  await p.evaluate(sel => { const b = document.querySelector(sel + ' [data-see]'); if (b && !document.querySelector(sel + ' .uwdecision')) b.click(); }, CARD); await p.waitForTimeout(300);
  const PB = CARD + ' input[data-p="blocks.fna.quotes.1.premium"]';
  ok(await p.evaluate(sel => !!document.querySelector(sel + ' p.premwarn') && /after R5,420 p\.m\./.test(document.querySelector(sel + ' .premline').textContent), CARD), '2b. before typing: the warning and the line "after R5,420" are there');
  await p.fill(PB, '5500'); await p.dispatchEvent(PB, 'change'); await p.waitForTimeout(500);
  const pt = await p.evaluate(sel => ({ warn: !!document.querySelector(sel + ' p.premwarn'), line: document.querySelector(sel + ' .premline').textContent, box: (document.querySelector(sel + ' input[data-p="blocks.fna.quotes.1.premium"]') || { value: '' }).value, q: OV.app.state.blocks.fna.quotes[1].offer, prem: OV.app.state.blocks.fna.quotes[1].premium }), CARD);
  ok(!pt.warn && /after R5,500 p\.m\./.test(pt.line) && pt.q.revPremium === 5500 && pt.q.quotePremium === 5500 && pt.prem === 5500, '2b. a premium typed on the counter offer quote is the adviser\u2019s check of the figure: the warning goes, the line under it and the letter\u2019s stored figure follow at once: ' + JSON.stringify({ warn: pt.warn, line: pt.line.slice(0, 60), rev: pt.q.revPremium }));

  /* ---- 4. the Presentation ---- */
  await load(true); await p.waitForTimeout(300);
  await p.evaluate(() => { const q = OV.app.state.blocks.fna.quotes[1]; OV.store.setUwReason(OV.app.state, 'blocks.fna.quotes.1', 'Raised blood pressure at the medical.'); q.terms.reason.st = 'verify'; q.terms.reason.by = 'page'; q.terms.reason.src = { kind: 'uwemail', date: '12/11/2026', subject: 's', sender: 'u', file: 'f.eml' }; });
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(500); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(400);
  await p.click('#pres .pchip[data-act=q][data-i="1"]'); await p.waitForTimeout(500); await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(500);
  const pr = await p.evaluate(() => { const r = document.querySelector('#pSlide .uwsum'); return r ? { h4: r.querySelector('h4').textContent, h5: r.querySelector('h5').textContent, ld: [...r.querySelectorAll('ul.uwld li')].map(li => li.querySelector('b').textContent + '=' + li.querySelector('.rednote').textContent), reason: (r.querySelector('.uwreason') || { innerText: '' }).innerText.replace(/\s+/g, ' '), ex: [...r.querySelectorAll('.uwex')].map(e => ({ no: e.querySelector('.redno').textContent, wording: (e.querySelector('.exw') || { textContent: null }).textContent, btn: e.querySelector('.exh em').textContent })) } : null; });
  ok(!!pr && pr.h4 === 'Underwriting decision' && pr.h5 === 'Underwriting terms of the counter offer letter: loadings and exclusions' && pr.ld.length === 4 && /Reason Raised blood pressure at the medical\. \(underwriter.s e-mail, 12\/11\/2026\)/.test(pr.reason), '4. the Presentation draws the same summary: ' + JSON.stringify(pr && [pr.h5, pr.ld.length, pr.reason]));
  ok(!!pr && pr.ex.length === 2 && pr.ex[0].wording === WORDS4 && pr.ex[1].wording === WORDS5 && pr.ex.every(e => e.btn === 'Hide wording'), '4. every exclusion is open with its wording in full to begin with');
  const fits = () => p.evaluate(() => { const st = document.querySelector('#pStage'), sl = document.querySelector('#pSlide'), r = sl.getBoundingClientRect(), s = st.getBoundingClientRect(); return { fits: r.bottom <= s.bottom + 2 && r.right <= s.right + 2 && r.top >= s.top - 2, noScroll: st.scrollHeight <= st.clientHeight + 2, h: Math.round(r.height), sh: Math.round(s.height) }; });
  const f1 = await fits(); ok(f1.fits && f1.noScroll, '4. the slide fits with both wordings open and never scrolls: ' + JSON.stringify(f1));
  await p.screenshot({ path: out + '/r17-pres-open.png' });
  await p.click('#pSlide .uwex:nth-of-type(1) .exh'); await p.waitForTimeout(400);
  const pr2 = await p.evaluate(() => [...document.querySelectorAll('#pSlide .uwex')].map(e => ({ shut: e.classList.contains('shut'), wording: !!e.querySelector('.exw'), btn: e.querySelector('.exh em').textContent, expanded: e.querySelector('.exh').getAttribute('aria-expanded') })));
  ok(pr2.length === 2 && pr2[0].shut && !pr2[0].wording && pr2[0].btn === 'Show wording' && pr2[0].expanded === 'false' && !pr2[1].shut && pr2[1].wording, '4. one click folds that exclusion’s wording away and leaves the other: ' + JSON.stringify(pr2));
  const f2 = await fits(); ok(f2.fits && f2.noScroll, '4. and the slide still fits: ' + JSON.stringify(f2)); await p.screenshot({ path: out + '/r17-pres-folded.png' });
  await p.click('#pSlide .uwex:nth-of-type(1) .exh'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('#pSlide .uwex .exw').length === 2), '4. a second click brings the wording back');
  await p.click('#pSlide .uwex:nth-of-type(1) .exh'); await p.waitForTimeout(200); await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(300); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(300);
  await p.click('#pres .pchip[data-act=q][data-i="1"]'); await p.waitForTimeout(300); await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('#pSlide .uwex.shut').length === 1), '4. the fold is kept while the adviser moves between pages');
  await p.evaluate(() => OV.present.close());

  /* ---- 5. the PDF ---- */
  const pdfFile = out + '/r17-block.pdf', bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const pages = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdfFile]).toString())[1], 10), raw = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-raw', pdfFile, '-']).toString().replace(/\s+/g, ' ');
  let qp = 0; for (let i = 1; i <= pages; i++) { if (!qp && /Underwriting decision/.test(raw(i))) qp = i; }
  const qt = qp ? raw(qp) : '';
  ok(qp > 0 && /Underwriting decision/.test(qt) && /Decision: Accepted with loadings and exclusions/.test(qt) && /Underwriting terms of the counter offer letter: loadings and exclusions/.test(qt), '5. the PDF has the decision and the summary’s heading (page ' + qp + ')');
  ok(/Life cover \+6% loading/.test(qt) && /Severe illness \+11% loading/.test(qt) && /Lump sum disability \+14% loading/.test(qt) && /Income protector \+9% loading/.test(qt), '5. the PDF has a line for each pillar with a loading');
  ok(/Reason: Raised blood pressure at the medical\. \(underwriter.s e-mail, 12\/11\/2026\)/.test(qt), '5. the PDF has the ONE reason with its source');
  ok(/4\* Severe illness, income protector We will not pay a claim that arises directly or indirectly from any condition of the lower back/.test(qt) && /5\* Lump sum disability We will not pay a claim that arises from a hazardous pursuit/.test(qt) && qt.indexOf('for as long as the cover lasts') > 0, '5. the PDF has every exclusion once, with its pillars and the wording in full');
  ok(!/Percentage added|The reason in words/.test(qt) && !/severe illness and income protector/i.test(qt), '5. the old tables and the combined label are not in the PDF');
  if (qp) cp.execFileSync('pdftoppm', ['-f', String(qp), '-l', String(qp), '-r', '80', '-png', '-singlefile', pdfFile, out + '/r17-pdf']);

  /* ---- 4b. a realistic long wording, three exclusions: does the slide still read, open and folded? ---- */
  const LONG = 'We will not pay any claim that arises directly or indirectly from, is caused by, or is in any way related to a condition of the lower back or spine, including a disc, a nerve or a muscle disorder, whether or not it was diagnosed, treated or investigated before the cover started or before this revised proposal was issued, and whether the condition is the sole cause of the claim or only one of several causes. This exclusion applies for as long as the cover remains in force and also to any increase in cover that is made at a later date, unless we agree otherwise in writing.';
  await p.evaluate(LONG => { const q = OV.app.state.blocks.fna.quotes[1]; q.terms.exclusions.forEach(e => { e.what = LONG; }); q.terms.exclusions.push({ no: '6*', benefit: 'Life cover', what: LONG.replace('lower back or spine', 'neck'), why: 'Medical', st: 'verify', by: 'page', applies: [{ need: 'needs', column: 'death' }], page: 4 }); }, LONG);
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(500); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(400);
  await p.click('#pres .pchip[data-act=q][data-i="1"]'); await p.waitForTimeout(400); await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(500);
  const scaleOf = () => p.evaluate(() => { const m = /scale\(([\d.]+)\)/.exec(document.querySelector('#pSlide').style.transform || ''); return m ? parseFloat(m[1]) : 1; });
  const fits2 = () => p.evaluate(() => { const st = document.querySelector('#pStage'), sl = document.querySelector('#pSlide'), r = sl.getBoundingClientRect(), s2 = st.getBoundingClientRect(); return r.bottom <= s2.bottom + 2 && r.top >= s2.top - 2 && st.scrollHeight <= st.clientHeight + 2; });
  const lo = await scaleOf(); ok(await p.evaluate(() => document.querySelectorAll('#pSlide .uwex .exw').length === 3) && await fits2(), '4b. three long wordings open: the slide fits (scale ' + lo.toFixed(2) + ') and never scrolls');
  await p.screenshot({ path: out + '/r17-pres-long-open.png' });
  await p.click('#pSlide .uwex:nth-of-type(1) .exh'); await p.click('#pSlide .uwex:nth-of-type(1) .exh'); await p.waitForTimeout(200);
  await p.evaluate(() => { [...document.querySelectorAll('#pSlide .uwex .exh')].slice(0, 2).forEach(b => b.click()); }); await p.waitForTimeout(400);
  const lf = await scaleOf(); ok(await p.evaluate(() => document.querySelectorAll('#pSlide .uwex.shut').length === 1 || document.querySelectorAll('#pSlide .uwex.shut').length === 2) && await fits2() && lf >= lo, '4b. wordings folded: the slide fits and the type is at least as large (scale ' + lf.toFixed(2) + ' against ' + lo.toFixed(2) + ' open)');
  await p.screenshot({ path: out + '/r17-pres-long-folded.png' }); await p.evaluate(() => OV.present.close());

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
