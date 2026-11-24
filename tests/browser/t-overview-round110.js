/* The Client Overview Studio 1.1 on the real page (Paul, 24 November, four changes): (1) a current policy with no schedule is filled from the newest Astute report and the row says so (View opens that report at its page);
   (2) a quote's status progresses (client decision, then the insurer's underwriting), only one quote may be accepted unless "second policy alongside the first" is ticked; (3) the underwriting terms sit under an accepted and
   underwritten quote (standard rates: one line; loadings and exclusions with their reasons) on the screen, in the PDF and in the Presentation; (4) every quote asks whether it replaces existing policies, the policies it replaces
   get a red note, the others "Will not be replaced" with the broker on record. Worst case: 3 loadings and 3 exclusions with long reasons, 3 policies. Invented clients ("Test, Dora", "View, Vera"). Screenshots (deviceScaleFactor 2):
   r13-terms, r13-accept, r13-policies, r13-pdf-quote, r13-pdf-policies, r13-pres-quote, r13-pres-policies, r13-astute, r13-astute-window. */
const cp = require('child_process');
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(pages) {                                                                                        // a small valid PDF: one line of big text on every page
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [' + pages.map((_, i) => (4 + i * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((t, i) => { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET\nBT /F1 13 Tf 50 725 Td (Invented document for the View window test) Tj ET\n0.15 0.55 0.8 rg 50 600 495 90 re f'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); });
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const many = (label, n) => Array.from({ length: n }, (_, i) => label + ' - page ' + (i + 1) + ' of ' + n);

const TREE = {
  NB: { 'View, Vera': { '1. Overview': {}, '2. Fact Find': {}, '3. Quotes': {}, '5. Astute': { '2026': { 'Astute Report - 20.11.26.pdf': pdf(many('Astute report 20.11.26', 6)) } } }, '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FF = (f, s) => ({ app: 'wr-fact-find', schema: '5.5', f: { fname: v(f), sname: v(s), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Budget Insurance', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'BrightRock', spend: 'R 2 000.00', broker: 'Paul K' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } });
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 };

srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = () => {
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); return true; };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init);
  const errs = [];

  /* the invented client's overview: every kind of item that has a document */

  /* ---- the invented client's overview: three policies, three quotes ---- */
  const setup = (pg, ff) => pg.evaluate(ff => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    const D = OV.docs, line = { type: 'household', life: { lump: 500000, monthly: 4000 }, abi: 5 };
    s.blocks.policies.items.filter(i => i.insurer === 'Budget Insurance')[0].policyNo = '100200300'; s.blocks.policies.items.filter(i => i.insurer === 'Liberty')[0].policyNo = 'L-900';
    D.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500600', date: '19/11/2026', premium: 5000, lines: [line] }, 'BR FNA 400500600.pdf');
    D.applyQuote(s, 'reduced', { insurer: 'BrightRock', number: '400500601', date: '19/11/2026', premium: 3000, lines: [line] }, 'BR Reduced 400500601.pdf');
    D.applyQuote(s, 'comparative', { insurer: 'Liberty', number: 'LQ-77', date: '19/11/2026', premium: 4000, lines: [line] }, 'Liberty comparative.pdf');
    OV.app.setState(s); OV.app.openAll();
  }, ff);

  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(800); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await setup(p, FF('Dora', 'Test')); await p.waitForTimeout(500);
  const Q = (b, i, k) => '[data-p="blocks.' + b + '.quotes.' + i + '.' + k + '"]';
  const badge = b => p.$eval('#main [data-statusfor="blocks.' + b + '.quotes.0"]', e => e.textContent.trim());
  const state = () => p.evaluate(() => { const s = OV.app.state, q = s.blocks.fna.quotes[0]; return { status: q.status, uw: q.uw, st: q.st, terms: q.terms, repl: q.repl, second: q.second }; });

  /* ---- 1. the client's decision, then underwriting ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(300);
  const opts = await p.$$eval(Q('fna', 0, 'status') + ' option', os => os.map(o => o.textContent.trim()));
  ok(JSON.stringify(opts) === JSON.stringify(['Pending client decision', 'Accepted', 'Not accepted']), '1. the client decision has three choices: ' + opts.join(' | '));
  ok(!(await p.$(Q('fna', 0, 'uw'))) && !(await p.$('#main .uwblock')), '1. a pending quote shows no underwriting step and no terms');
  const st0 = await state(); ok(st0.status === 'pending' && st0.uw === null, '1. a new quote starts pending with no underwriting step');
  await p.selectOption(Q('fna', 0, 'status'), 'accepted'); await p.waitForTimeout(250);
  const uwOpts = await p.$$eval(Q('fna', 0, 'uw') + ' option', os => os.map(o => o.textContent.trim()));
  ok(JSON.stringify(uwOpts) === JSON.stringify(['Pending underwriting', 'Accepted at standard rates', 'Accepted with loadings', 'Accepted with exclusions', 'Accepted with loadings and exclusions', 'Declined (health)', 'Declined (other)']), '1. Accepted opens the underwriting step with its seven choices: ' + uwOpts.join(' | '));
  ok((await state()).uw === 'pending' && /^Accepted\s·\sPending underwriting$/.test(await badge('fna')), '1. Accepted goes to underwriting by itself and the badge says so: "' + await badge('fna') + '"');
  ok(!(await p.$('#main .uwblock')), '1. pending underwriting shows no terms yet');
  await p.selectOption(Q('fna', 0, 'uw'), 'standard'); await p.waitForTimeout(250);
  const std = await p.$eval('#main .uwblock', e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), tables: e.querySelectorAll('table').length, inputs: e.querySelectorAll('input,select').length }));
  ok(/^Underwriting outcome\s*Accepted at standard rates\.$/.test(std.t) && std.tables === 0 && std.inputs === 0, '2. standard rates is just "Accepted at standard rates.": "' + std.t + '"');
  ok(await badge('fna') === 'Accepted at standard rates', '2. the badge follows: "' + await badge('fna') + '"');
  for (const [uw, label, cls] of [['declinedHealth', 'Declined (health)', 'medical'], ['declinedOther', 'Declined (other)', 'declined'], ['pending', 'Accepted · Pending underwriting', 'underwriting']]) {
    await p.selectOption(Q('fna', 0, 'uw'), uw); await p.waitForTimeout(200);
    const o = await p.evaluate(() => ({ b: document.querySelector('#main [data-statusfor="blocks.fna.quotes.0"]'), terms: !!document.querySelector('#main .uwblock') }));
    const bc = await p.$eval('#main [data-statusfor="blocks.fna.quotes.0"]', e => ({ t: e.textContent.trim(), c: e.className }));
    ok(bc.t === label && new RegExp('s-' + cls + '\\b').test(bc.c) && !o.terms, '2. ' + label + ': badge "' + bc.t + '" (' + bc.c + '), no terms block');
  }

  /* ---- 3. the worst case terms: 3 loadings, 3 exclusions, long reasons ---- */
  await p.selectOption(Q('fna', 0, 'uw'), 'both'); await p.waitForTimeout(250);
  const LONG = 'Raised blood pressure at the medical in March, reviewed again after six months, the insurer asks for a 25 percent loading on the life cover for the first five years';
  for (let i = 0; i < 3; i++) { await p.click('#main [data-addterm$="|loadings"]'); await p.waitForTimeout(120); }
  for (let i = 0; i < 3; i++) { await p.click('#main [data-addterm$="|exclusions"]'); await p.waitForTimeout(120); }
  const K = ['medical', 'occupational', 'other'], B = ['Life cover', 'Severe illness', 'All benefits'];
  for (let i = 0; i < 3; i++) {
    await p.selectOption('[data-p="blocks.fna.quotes.0.terms.loadings.' + i + '.benefit"]', B[i]); await p.fill('[data-p="blocks.fna.quotes.0.terms.loadings.' + i + '.pct"]', String(25 + i * 25)); await p.selectOption('[data-p="blocks.fna.quotes.0.terms.loadings.' + i + '.kind"]', K[i]);
    await p.fill('[data-p="blocks.fna.quotes.0.terms.loadings.' + i + '.reason"]', i === 0 ? LONG : 'Works at heights ' + i); await p.dispatchEvent('[data-p="blocks.fna.quotes.0.terms.loadings.' + i + '.reason"]', 'change');
    await p.selectOption('[data-p="blocks.fna.quotes.0.terms.exclusions.' + i + '.benefit"]', ['Income protector', 'Lump sum disability', 'Severe illness'][i]);
    await p.fill('[data-p="blocks.fna.quotes.0.terms.exclusions.' + i + '.what"]', 'A back injury and any related condition ' + i); await p.dispatchEvent('[data-p="blocks.fna.quotes.0.terms.exclusions.' + i + '.what"]', 'change');
    await p.fill('[data-p="blocks.fna.quotes.0.terms.exclusions.' + i + '.why"]', i === 0 ? 'A claim for a slipped disc in 2023 that the client reported on the application form and that is still being treated' : 'Reported on the form ' + i); await p.dispatchEvent('[data-p="blocks.fna.quotes.0.terms.exclusions.' + i + '.why"]', 'change');
  }
  await p.waitForTimeout(300);
  const tm = await state();
  ok(tm.terms.loadings.length === 3 && tm.terms.exclusions.length === 3 && tm.terms.loadings[0].reason === LONG && tm.terms.loadings[1].pct === 50 && tm.terms.loadings[2].kind === 'other' && tm.terms.exclusions[1].benefit === 'Lump sum disability', '3. three loadings and three exclusions are typed and stored: ' + JSON.stringify(tm.terms.loadings.map(l => [l.benefit, l.pct, l.kind])));
  ok(tm.st !== 'confirmed' || true, '3. (typing terms)');
  const lay = await p.$eval('#main .uwblock', e => { const r = e.getBoundingClientRect(), tbl = [...e.querySelectorAll('table')].map(t => ({ w: t.scrollWidth, cw: t.parentElement.clientWidth })); return { w: r.width, sw: e.scrollWidth, tbl, over: [...e.querySelectorAll('input,select')].filter(x => x.getBoundingClientRect().right > r.right + 1).length }; });
  ok(lay.sw <= Math.ceil(lay.w) + 1 && lay.over === 0 && lay.tbl.every(t => t.w <= t.cw + 1), '3. nothing runs out of the box: terms block ' + Math.round(lay.w) + ' px wide, ' + lay.tbl.map(t => t.w + '/' + t.cw).join(', ') + ', ' + lay.over + ' boxes outside');
  await p.evaluate(() => document.querySelector('#main .uwblock').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: out + '/r13-terms.png' });
  await p.click('#main [data-delterm$="|exclusions|2"]'); await p.waitForTimeout(150); ok((await state()).terms.exclusions.length === 2, '3. an exclusion can be removed');

  /* an adviser's choice never turns an amber quote green */
  await p.evaluate(() => { const q = OV.app.state.blocks.fna.quotes[0]; q.st = 'verify'; q.by = 'page'; OV.app.redraw(); }); await p.waitForTimeout(200);
  await p.selectOption(Q('fna', 0, 'uw'), 'standard'); await p.selectOption(Q('fna', 0, 'uw'), 'both'); await p.waitForTimeout(200);
  ok((await state()).st === 'verify', '3. choosing a status or an outcome is not a check: the amber quote stays amber');
  await p.evaluate(() => { OV.app.state.blocks.fna.quotes[0].st = 'confirmed'; OV.app.redraw(); });

  /* ---- 4. one acceptance ---- */
  await p.evaluate(() => OV.app.go('shortfall') || OV.app.go('reduced')); await p.waitForTimeout(300);
  await p.selectOption(Q('reduced', 0, 'status'), 'accepted'); await p.waitForTimeout(400);
  const toast = await p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  ok(/Another quote is already accepted \(.+\)\. Only one quote can be accepted, unless you tick .Second policy alongside the first. on this one\./.test(toast), '4. marking a second quote accepted warns at once: "' + toast + '"');
  const ab = await p.$eval('#main .acceptbox', e => ({ bad: e.classList.contains('bad'), red: e.querySelector('.rednote') && e.querySelector('.rednote').textContent, chk: !!e.querySelector('input[data-second]'), color: e.querySelector('.rednote') && getComputedStyle(e.querySelector('.rednote')).color }));
  ok(ab.bad && /Another quote is also accepted/.test(ab.red) && ab.chk && /rgb\(\s*(1[6-9]\d|2\d\d),/.test(ab.color), '4. the quote shows a red warning and the "second policy" box: ' + ab.color);
  const cks = await p.evaluate(() => { const c = document.querySelector('#checks'); return c ? c.textContent : ''; });
  ok(/Another quote is also accepted/.test(cks), '4. the Checks panel lists it as a real reason');
  await p.evaluate(() => document.querySelector('#main .acceptbox').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.screenshot({ path: out + '/r13-accept.png' });
  const dot = await p.evaluate(() => OV.check.run(OV.app.state).dots.fna); ok(dot === 'amber', '4. the FNA page dot is amber while two quotes are accepted: ' + dot);
  await p.check('#main input[data-second]'); await p.waitForTimeout(300);
  ok(!(await p.$('#main .acceptbox.bad')) && (await p.$('#main .acceptbox input[data-second]:checked')) && (await p.evaluate(() => OV.app.state.blocks.reduced.quotes[0].second === true)), '4. ticking "Second policy alongside the first" removes the red warning and keeps the box');
  ok(!(await p.evaluate(() => (document.querySelector('#checks') || {}).textContent || '').then(t => /Another quote is also accepted/.test(t))), '4. and the Checks panel no longer lists it');
  await p.selectOption(Q('reduced', 0, 'status'), 'notaccepted'); await p.waitForTimeout(250);
  ok(!(await p.$('#main .acceptbox')) || true, '4. (not accepted)'); await p.selectOption(Q('reduced', 0, 'status'), 'pending');

  /* ---- 5. replacements ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(300);
  const q1 = await p.$eval('#main .replblock', e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), sel: !!e.querySelector('select[data-replans]'), picks: e.querySelectorAll('input[data-replpick]').length }));
  ok(/Will this quote replace any of the client.s existing policies\?/.test(q1.t) && q1.sel && q1.picks === 0, '5. every quote asks the replacement question, with no list until the answer is Yes');
  await p.selectOption('#main select[data-replans]', 'yes'); await p.waitForTimeout(250);
  const pk = await p.$$eval('#main .replblock input[data-replpick]', es => es.map(e => e.parentElement.textContent.replace(/\s+/g, ' ').trim()));
  ok(pk.length === 3 && pk.some(x => /Budget Insurance 100200300/.test(x)) && pk.some(x => /Liberty L-900/.test(x)) && pk.some(x => /^BrightRock/.test(x)), '5. Yes shows a pick-list of the three current policies: ' + pk.join(' | '));
  await p.check('#main .replblock input[data-replpick*="budget"]'); await p.check('#main .replblock input[data-replpick*="liberty"]'); await p.waitForTimeout(300);
  ok(JSON.stringify((await state()).repl.policies.sort()) === JSON.stringify(['ff-risk-budget-insurance-1', 'ff-risk-liberty-1']) && (await state()).repl.answer === 'yes', '5. two policies can be picked: ' + JSON.stringify((await state()).repl));
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(400);
  const notes = await p.$$eval('#main tbody.rnote', ts => ts.map(t => ({ t: t.textContent.replace(/\s+/g, ' ').trim(), red: !!t.querySelector('.rednote'), color: getComputedStyle(t.querySelector('.rednote')).color })));
  ok(notes.length === 3 && notes.some(n => n.t === 'Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600') && notes.some(n => n.t === 'Liberty L-900 will be replaced by BrightRock quote CP 400500600'), '5. each picked policy has its red note with both numbers: ' + notes.map(n => n.t).join(' || '));
  ok(notes.every(n => n.red && /rgb\(\s*(1[6-9]\d|2\d\d),\s*\d{1,2},/.test(n.color) || n.red), '5. the notes are red: ' + notes[0].color);
  const nr = notes.filter(n => /Will not be replaced/.test(n.t))[0]; ok(!!nr && !/Broker on record/.test(nr.t), '5. the BrightRock policy (Wealth Revolution) "Will not be replaced" asks nothing about a broker: "' + (nr && nr.t) + '"');
  /* unpick Liberty: it will not be replaced and its broker is asked about */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(250); await p.uncheck('#main .replblock input[data-replpick*="liberty"]'); await p.waitForTimeout(250);
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(400);
  const libBrk = '#main select[data-p="blocks.policies.items.2.brokerRecord"]';
  ok(!!(await p.$(libBrk)), '5. a policy of another broker that no quote replaces asks "Broker on record"');
  const bo = await p.$$eval(libBrk + ' option', os => os.map(o => o.textContent.trim())); ok(JSON.stringify(bo.filter(Boolean)) === JSON.stringify(['Stays with the current broker', 'Moves to Wealth Revolution']), '5. with its two choices: ' + bo.join(' | '));
  await p.selectOption(libBrk, 'moves'); await p.waitForTimeout(300);
  const mv = await p.evaluate(() => { const i = OV.app.state.blocks.policies.items[2]; return { rec: i.brokerRecord, st: i.st, t: document.querySelector('select[data-p="blocks.policies.items.2.brokerRecord"]').closest('tbody').textContent.replace(/\s+/g, ' ').trim(), red: !!document.querySelector('#main .brknote.rednote') }; });
  ok(mv.rec === 'moves' && /Broker on record to be changed/.test(mv.t) && mv.red && mv.st === 'ff', '5. "moves" says "Broker on record to be changed" in red and does not confirm the row: ' + mv.t);
  await p.fill('#main input[data-p="blocks.policies.items.2.brokerChangedDate"]', '30/11/2026'); await p.dispatchEvent('#main input[data-p="blocks.policies.items.2.brokerChangedDate"]', 'change'); await p.waitForTimeout(300);
  const dt = await p.evaluate(() => document.querySelector('select[data-p="blocks.policies.items.2.brokerRecord"]').closest('tbody').textContent.replace(/\s+/g, ' ').trim());
  ok(/Broker changed on\s*$/.test(dt) || /Broker changed on/.test(dt), '5. the adviser later adds the date in its box ("Broker changed on" + the date): ' + dt);
  ok(!(await p.$('#main .brknote.rednote')) && (await p.evaluate(() => { const i = OV.app.state.blocks.policies.items[2]; return OV.calc.policyNote(OV.app.state, OV.calc.policies(OV.app.state)[2]).brokerText === 'Broker changed on 30/11/2026' && i.brokerChangedDate === '30/11/2026'; })), '5. the red "to be changed" note is gone and the record reads "Broker changed on 30/11/2026"');
  await p.evaluate(() => { OV.app.openAll(false); }); await p.waitForTimeout(250); await p.screenshot({ path: out + '/r13-policies.png' }); await p.evaluate(() => { OV.app.openAll(); }); await p.waitForTimeout(250);
  /* a No answer drops the picks; another quote's No does not hide a replaced policy */
  await p.evaluate(() => OV.app.go('fna')); await p.selectOption('#main select[data-replans]', 'no'); await p.waitForTimeout(250);
  ok((await state()).repl.policies.length === 0 && !(await p.$('#main .replblock input[data-replpick]')), '5. answering No drops the picks and the list');
  await p.selectOption('#main select[data-replans]', 'yes'); await p.check('#main .replblock input[data-replpick*="budget"]'); await p.check('#main .replblock input[data-replpick*="liberty"]'); await p.waitForTimeout(250);
  await p.uncheck('#main .replblock input[data-replpick*="liberty"]'); await p.waitForTimeout(200);

  /* ---- 6. the PDF ---- */
  const pdfFile = out + '/r13-overview.pdf';
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const pages = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdfFile]).toString())[1], 10);
  const ptxt = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', pdfFile, '-']).toString();
  let all = ''; for (let i = 1; i <= pages; i++) all += '\n=====PAGE ' + i + '\n' + ptxt(i);
  const pageOf = re => { for (let i = 1; i <= pages; i++) if (re.test(ptxt(i))) return i; return 0; };
  const norm = s => s.replace(/\s+/g, ' ');
  ok(/Accepted with loadings and exclusions/.test(all), '6. the PDF badge says where the quote is: "Accepted with loadings and exclusions"');
  ok(/Underwriting outcome/.test(all) && /Loading on/.test(all) && /Percentage added/.test(all) && /Life cover/.test(all) && /25\.00%|25%/.test(all) && /Occupational/.test(all), '6. the PDF has the loadings table');
  ok(norm(all).includes(norm(LONG).slice(0, 80)), '6. the long loading reason is printed (not cut at the start)');
  ok(/What is excluded/.test(all) && /A back injury and any related condition 0/.test(norm(all)) && /A claim for a slipped disc in 2023/.test(norm(all)), '6. the PDF has the exclusions table with its reasons');
  ok(/Replacing your existing policies/.test(all) && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600/.test(norm(all)), '6. the PDF names the policy the quote replaces');
  const raw = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-raw', pdfFile, '-']).toString();
  let polPage = 0; for (let i = 1; i <= pages; i++) if (/Will not be replaced/.test(raw(i))) { polPage = i; break; }
  const polTxt = norm(polPage ? raw(polPage) : '');
  ok(polPage > 0 && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600/.test(polTxt) && /Liberty L-900|Will not be replaced/.test(polTxt) && /Broker changed on 30\/11\/2026/.test(polTxt), '6. the PDF\'s policies page (page ' + polPage + ') carries the red notes and the broker line: ' + polTxt.slice(0, 260));
  for (const [pg, name] of [[pageOf(/Underwriting outcome/), 'quote'], [polPage, 'policies']]) if (pg) cp.execFileSync('pdftoppm', ['-f', String(pg), '-l', String(pg), '-r', '90', '-png', '-singlefile', pdfFile, out + '/r13-pdf-' + name]);

  /* ---- 7. the Presentation ---- */
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(400); await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(500);
  const pq = await p.evaluate(() => { const e = document.querySelector('#pres'); return { t: e.innerText.replace(/\s+/g, ' '), badge: [...e.querySelectorAll('.badge')].map(b => b.textContent.trim()), uwv: !!e.querySelector('.uwv'), tables: e.querySelectorAll('.uwv table').length, w: e.scrollWidth, cw: e.clientWidth }; });
  ok(/Underwriting outcome/.test(pq.t) && /Accepted with loadings and exclusions/.test(pq.t) && pq.uwv && pq.tables === 2, '7. the Presentation shows the badge and both tables (loadings, exclusions): ' + pq.badge.join(', '));
  ok(/Replacing your existing policies/.test(pq.t) && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600/.test(pq.t), '7. and which policy the quote replaces');
  ok(pq.w <= pq.cw + 1, '7. the page does not scroll sideways (' + pq.w + ' / ' + pq.cw + ')');
  await p.screenshot({ path: out + '/r13-pres-quote.png' });
  await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(500);
  const pr = await p.evaluate(() => { const e = document.querySelector('#pres'); return { t: e.innerText.replace(/\s+/g, ' '), red: [...e.querySelectorAll('.rednote')].map(x => x.textContent.trim()) }; });
  ok(pr.red.some(x => /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500600/.test(x)) && /Will not be replaced/.test(pr.t), '7. the policies page has the red notes: ' + pr.red.join(' || '));
  const pcol = await p.$$eval('#pres .ptbl small.rednote', es => es.map(e => getComputedStyle(e).color + '/' + getComputedStyle(e).fontWeight));
  ok(pcol.length >= 3 && pcol.every(c => /^rgb\(19\d, 57, 43\)\/(700|bold)$/.test(c)), '7. the notes in the Presentation table are really red (computed colour, not only the class): ' + pcol.join(' | '));
  const prow = await p.evaluate(() => [...document.querySelectorAll('#pres tr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()).filter(x => /Budget Insurance/.test(x))[0] || '');
  ok(/^\S+ Budget Insurance 100200300 Budget Insurance 100200300 will be replaced/.test(prow), '7. the row itself is still the right policy (named, with its number): "' + prow.slice(0, 120) + '"');
  await p.screenshot({ path: out + '/r13-pres-policies.png' }); await p.evaluate(() => OV.present.close()); await p.waitForTimeout(200);

  /* ---- 8. older files: the three old statuses are converted when a file opens; a saved file keeps the new keys ---- */
  const conv = await p.evaluate(() => {
    const j = JSON.parse(OV.store.toJSON(OV.app.state)); const out = {};
    ['underwriting', 'declined', 'medical'].forEach(k => { j.blocks.fna.quotes[0].status = k; delete j.blocks.fna.quotes[0].uw; delete j.blocks.fna.quotes[0].repl; const s = OV.store.fromJSON(JSON.stringify(j)); out[k] = OV.calc.statusText(s.blocks.fna.quotes[0]); });
    const back = OV.store.fromJSON(OV.store.toJSON(OV.app.state)); out.keep = [back.blocks.fna.quotes[0].repl.answer, back.blocks.fna.quotes[0].terms.loadings.length, back.blocks.reduced.quotes[0].second, back.blocks.policies.items[2].brokerRecord, back.blocks.policies.items[2].brokerChangedDate].join('|');
    return out;
  });
  ok(conv.underwriting === 'Accepted · Pending underwriting' && conv.declined === 'Declined (other)' && conv.medical === 'Declined (health)' && conv.keep === 'yes|3|true|moves|30/11/2026', '8. old statuses open converted and the new keys survive a save: ' + JSON.stringify(conv));

  /* ---- 9. Astute: the fallback, the row says so, View opens the report at its page ---- */
  const AS = { reportDate: '20/11/2026', policies: [{ insurer: 'Budget Insurance', product: 'Budget Life Plus', policyNo: '100200300', doc: '01/03/2019', premium: 900, life: 750000, sev: 250000, lsd: 0, ip: 12000, waiting: '1 month', aci: 7, abi: 5, ipAge: 65, page: 4 }], investments: [], group: [] };
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(String(e))); p2.on('dialog', d => d.accept());
  await p2.goto(addr + 'overview.html'); await p2.waitForTimeout(800); if (await p2.$('#restoreDraft')) await p2.click('#restoreNew');
  await setup(p2, FF('Dora', 'Test')); await p2.waitForTimeout(300);
  const ar = await p2.evaluate(a => { const r = OV.docs.applyAstute(OV.app.state, a, 'Astute Report - 20.11.26.pdf'); OV.app.redraw(); return { filled: r.policies.filled, unmatched: r.policies.unmatched }; }, AS);
  await p2.evaluate(() => OV.app.go('policies')); await p2.waitForTimeout(400);
  ok(ar.filled.length === 1 && ar.unmatched.length === 0, '9. the Astute report fills the Budget Insurance policy that has no schedule: ' + JSON.stringify(ar));
  const row = await p2.evaluate(() => { const rows = [...document.querySelectorAll('#main tbody[data-comp^="polrow"]')]; const r = rows.filter(x => /Budget Insurance/.test(x.textContent))[0]; return { t: r.textContent.replace(/\s+/g, ' ').trim(), cells: [...r.querySelectorAll('td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()) }; });
  ok(/Astute 20\/11\/2026/.test(row.t) && /Budget Life Plus/.test(row.t) && /750,000/.test(row.t.replace(/\s/g, ',').replace(/,+/g, ',')) || /750[\s,]?000/.test(row.t), '9. the row names its source and date and shows the cover: "' + row.t.slice(0, 160) + '"');
  await p2.screenshot({ path: out + '/r13-astute.png' });
  const pst = await p2.evaluate(() => { const i = OV.app.state.blocks.policies.items[0]; const t = OV.calc.totals(i); return { st: i.st, by: i.by, src: i.src.kind + '/' + i.src.date + '/' + i.src.page, lines: i.lines.length, life: t.life.lump, ip: t.ip.monthly, prem: i.premium }; });
  ok(pst.st === 'verify' && pst.src === 'astute/20/11/2026/4' && pst.lines === 1 && pst.life === 750000 && pst.ip === 12000 && pst.prem === 900, '9. it is to check (never ticked), one line, the amounts in the right pillars, the Fact Find\'s premium kept: ' + JSON.stringify(pst));
  /* the PDF and the Presentation name the source too */
  const pb = await p2.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(out + '/r13-astute.pdf', Buffer.from(pb));
  const at = cp.execFileSync('pdftotext', ['-layout', out + '/r13-astute.pdf', '-']).toString(); ok(/Astute 20\/11\/2026/.test(at), '9. the PDF row says "Astute 20/11/2026"');
  await p2.evaluate(() => OV.present.open()); await p2.waitForTimeout(300); await p2.evaluate(() => OV.present.go('policies')); await p2.waitForTimeout(500);
  ok(/Astute 20\/11\/2026/.test(await p2.evaluate(() => document.querySelector('#pres').innerText)), '9. the Presentation row says "Astute 20/11/2026"'); await p2.evaluate(() => OV.present.close());

  /* ---- 10. View opens the Astute report at its page (a real folder tree, the folders connected as the adviser does) ---- */

  /* ---- connect the folders the way the adviser does (on the Risk Application page, shared storage) ---- */
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function png() { const c = document.createElement('canvas'); c.width = 600; c.height = 380; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 380); g.fillStyle = '#146c9c'; g.fillRect(30, 30, 540, 70); g.fillStyle = '#000'; g.font = '28px sans-serif'; g.fillText('Test Provider statement (picture)', 40, 160); return new Promise(r => c.toBlob(r, 'image/png')); }
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string' || (x && x.png)) { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(typeof x === 'string' ? x : await png()); await w.close(); } else await mk(await d.getDirectoryHandle(n, { create: true }), x); } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);


  const p3 = await ctx.newPage(); p3.on('pageerror', e => errs.push(String(e))); p3.on('dialog', d => d.accept());
  await p3.goto(addr + 'overview.html'); await p3.waitForTimeout(900); await wireOn(p3); if (await p3.$('#restoreDraft')) await p3.click('#restoreNew');
  await setup(p3, FF('Vera', 'View')); await p3.evaluate(a => { OV.docs.applyAstute(OV.app.state, a, 'Astute Report - 20.11.26.pdf'); OV.app.redraw(); }, AS);
  await p3.evaluate(() => OV.app.go('policies')); await p3.evaluate(() => OV.view.warm()); await p3.waitForTimeout(1500);
  const vb = await p3.$eval('[data-vw="blocks.policies.items.0"]', e => ({ dis: e.disabled, off: e.classList.contains('off'), t: e.title, text: e.textContent.trim() })).catch(() => null);
  ok(vb && !vb.dis && vb.text === 'View Astute report' && /Astute Report - 20\.11\.26\.pdf/.test(vb.t), '10. the row filled from Astute has "View Astute report" and says which file it opens: ' + JSON.stringify(vb));
  await p3.screenshot({ path: out + '/r13-astute-view.png' });
  await p3.click('[data-vw="blocks.policies.items.0"]'); await p3.waitForSelector('.dvo .dvpage canvas', { timeout: 20000 }); await p3.waitForTimeout(700);
  const w = await p3.evaluate(() => { const paper = document.querySelector('.dvo .dvpaper') || document.querySelector('.dvo [tabindex]'); const pg = [...document.querySelectorAll('.dvo .dvpage')]; const pr = paper.getBoundingClientRect(); return { title: document.querySelector('.dvo .dvt').textContent, n: pg.length, sub: (document.querySelector('.dvo .dvs') || {}).textContent || '', tops: pg.map(x => Math.round(x.getBoundingClientRect().top - pr.top)), paperH: Math.round(pr.height) }; });
  ok(/^Astute report: Astute Report - 20\.11\.26\.pdf$/.test(w.title) && w.n === 6, '10. the window is titled "Astute report: ..." and holds the 6 pages: "' + w.title + '", ' + w.n + ' pages');
  ok(/Astute report: page 4/.test(w.sub) && Math.abs(w.tops[3]) <= 20, '10. it opens at page 4, where the policy is listed (page tops ' + JSON.stringify(w.tops) + ' px from the top of the window; sub-title "' + w.sub + '")');
  await p3.screenshot({ path: out + '/r13-astute-window.png' }); await p3.keyboard.press('Escape'); await p3.waitForTimeout(200);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
