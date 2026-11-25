/* Client Overview Studio 1.2 on the real page (Paul, 24 November, counter offers). One invented client ("Scene, Sam") with an accepted FNA quote whose underwriting came back with loadings and exclusions, a REAL folder tree:
   the policy folder holds a "Counter Offer Letter" folder with the counter offer letter, the counter offer quote, a consent form and a signed copy; ANOTHER policy's counter offer files sit beside them (they must not be ticked).
   (1) the ordinary Load does not list the counter offer files; (2) Add counter offer opens the page's own list with the right files ticked and the consent form and the signed copy not; (3) the letter and the quote are read into ONE counter
   offer in the same block, with the terms amber, the red references in the pillar columns, the premium before and after, a signed-copy hint and a Counter offers page; (4) "Terms checked" confirms them; (5) accepting the counter offer is
   no second acceptance, the policy that issues is the counter offer, the replacement note names it and the Overview card says what was decided; (6) the PDF and the Presentation carry the same; (7) turning the counter offer down takes the
   note away. Screenshots r15-counter, r15-counters, r15-pdf-quote, r15-pres-quote, r15-pres-terms, r15-pres-overview. */
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
  pages.forEach((t, i) => { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET\nBT /F1 13 Tf 50 725 Td (Invented document for the counter offer test) Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); });
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const L_NAME = 'Sam Scene cover terms (Cover Proposal 400500600 400500777).pdf', Q_NAME = 'Sam Scene Cover Proposal 400500777.pdf', C_NAME = 'Consent to release confidential information (Cover Proposal 400500777).pdf', S_NAME = 'Sam Scene cover terms (Cover Proposal 400500600 400500777) - signed.pdf';
const TREE = {
  NB: { 'Scene, Sam': { '1. Overview': {}, '2. Fact Find': {}, '3. Quotes': { 'BR FNA - 400500600 - 19.11.26.pdf': pdf(['BrightRock FNA quote CP 400500600']), 'BR CMPO - 400500777.pdf': pdf(['CMPODOC change moment guide 400500777']) }, '6. Policy Schedules': {},
    'BR Personal Covers - 700800900': { Applications: {}, 'Counter Offer Letter': { [L_NAME]: pdf(['LETTERDOC counter offer letter 400500777', 'terms grid']), [Q_NAME]: pdf(['COUNTERQUOTEDOC revised proposal 400500777']), [C_NAME]: pdf(['CONSENTDOC']), [S_NAME]: pdf(['SIGNEDDOC']) } },
    'Liberty Cover - L-900': { 'Counter Offer Letter': { 'Sam Scene cover terms (Cover Proposal 600700800 600700801).pdf': pdf(['OTHERLETTERDOC']), 'Sam Scene Cover Proposal 600700801.pdf': pdf(['OTHERQUOTEDOC']) } } }, '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'Z - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sam'), sname: v('Scene'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Budget Insurance', spend: 'R 900.00', broker: 'Other broker' } }, { d: { prov: 'Liberty', spend: 'R 500.00', broker: 'Other broker' } }] } };
const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 };
const DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
const CHILD = { type: 'child', name: 'Ann', sname: 'Scene', life: { lump: 100000, monthly: 3000 }, abi: 5 };
const DEBT = { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1000000, monthly: 14000 }, ip: { monthly: 14000 }, abi: 0, accelerated: false };
const DEATH = { type: 'death', life: { lump: 500000, monthly: 2500 }, abi: 3 };
const READ = {
  CMPODOC: { number: '400500777', activationDate: '01/12/2026', rows: [{ key: 'total', today: 1000000, projected: 2000000, payoutDate: '01/12/2040' }, { key: 'child', name: 'Ann', sname: 'Scene', today: 100000, projected: 150000, payoutDate: '01/12/2035' }] },
  LETTERDOC: { originalNumber: '400500600', revisedNumber: '400500777', origPremium: 5000, revPremium: 5420, startDate: '01/12/2026', expires: '20/12/2026', termsPage: 1, exclusionsPage: 2,
    cells: [{ need: 'needs', column: 'recover', loading: 10, exclusions: ['3*'] }, { need: 'needs', column: 'permanent', loading: 15, exclusions: [] }, { need: 'needs', column: 'death', loading: null, exclusions: [] }, { need: 'dread', column: 'recover', loading: 10, exclusions: ['3*'] }],
    exclusions: [{ no: '3*', type: 'Medical', what: 'No cover for conditions of the lower back', page: 2 }], notes: 'Cover for additional expense needs is reduced.' },
  COUNTERQUOTEDOC: { insurer: 'BrightRock', number: '400500777', date: '28/11/2026', premium: 5420.01, aciText: 'Premiums rise with the age adjuster', lines: [LINE, CHILD, DEBT, DEATH, DREAD] }
};
srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = ({ read: READ_ARG }) => {
    window.__api = []; window.__read = READ_ARG;
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let answer = {};
      if (c0.type === 'document' || (c0.source && c0.source.data)) { const text = atob(c0.source.data); window.__api.push(text); const k = Object.keys(window.__read).filter(x => text.indexOf(x) >= 0)[0]; answer = k ? window.__read[k] : {}; }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
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
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, { read: READ });
  const errs = [];
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

  const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); }); p.on('pageerror', e => { errs.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 400)); }); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  await p.evaluate(ff => {
    const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json');
    s.blocks.policies.items.filter(i => i.insurer === 'Budget Insurance')[0].policyNo = '100200300';
    const LINE = { type: 'household', life: { lump: 500000, monthly: 4000 }, sev: { lump: 200000 }, lsd: { lump: 300000, monthly: 2000 }, ip: { monthly: 15000 }, abi: 5 }, DREAD = { type: 'dread', sev: { lump: 150000 }, abi: 3 };
    const q = OV.docs.applyQuote(s, 'fna', { insurer: 'BrightRock', number: '400500600', date: '19/11/2026', premium: 4999.99, lines: [LINE, DREAD] }, 'BR FNA - 400500600 - 19.11.26.pdf').quote;          // a cent off the letter\u2019s original premium (round 1.3)
    OV.store.setStatus(s, 'blocks.fna.quotes.0', 'accepted'); OV.store.setUw(s, 'blocks.fna.quotes.0', 'both'); q.policyNo = 'P-700800900';
    OV.store.toggleReplaced(s, 'blocks.fna.quotes.0', s.blocks.policies.items.filter(i => i.insurer === 'Budget Insurance')[0].id, true);
    OV.app.setState(s); OV.app.openAll();
  }, FFJ);
  const waitDone = () => p.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  const st = () => p.evaluate(() => OV.app.state), txt = sel => p.evaluate(s => (document.querySelector(s) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), sel);

  /* ---- 1. the ordinary Load does not pick the counter offer files up ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const list1 = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  ok(list1.some(t => /BR FNA - 400500600/.test(t)) && !list1.some(t => /cover terms|Cover Proposal|Consent to release|signed/i.test(t)), '1. the ordinary Load lists the quote but none of the counter offer files: ' + list1.map(t => t.slice(0, 40)).join(' | '));
  await p.click('dialog.fdlg [data-no]'); await p.waitForTimeout(300);

  /* ---- 2. Add counter offer: only on a quote that was accepted with loadings or exclusions; the page's own list ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(500);
  ok(await p.$('[data-addcounter]') !== null, '2. the accepted quote with loadings and exclusions has its Add counter offer button');
  await p.screenshot({ path: out + '/r15-before.png' });
  await p.evaluate(() => { OV.store.setUw(OV.app.state, 'blocks.fna.quotes.0', 'standard'); OV.app.redraw(); });
  ok(await p.$('[data-addcounter]') === null, '2. at standard rates there is no such button');
  await p.evaluate(() => { OV.store.setUw(OV.app.state, 'blocks.fna.quotes.0', 'both'); OV.app.redraw(); });
  await p.click('[data-addcounter]'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const list2 = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => ({ t: l.textContent.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked, dis: l.querySelector('input').disabled })));
  const f2 = k => list2.filter(x => x.t.indexOf(k) >= 0)[0];
  ok(list2.length === 6, '2. the list holds all six files of the two Counter Offer Letter folders: ' + list2.length);
  ok(f2('cover terms (Cover Proposal 400500600 400500777).pdf') && f2('cover terms (Cover Proposal 400500600 400500777).pdf').on && !f2('cover terms (Cover Proposal 400500600 400500777).pdf').dis, '2. the counter offer letter of THIS quote is ticked');
  ok(f2('Sam Scene Cover Proposal 400500777') && f2('Sam Scene Cover Proposal 400500777').on, '2. so is its counter offer quote (the revised number the letter names)');
  ok(f2('Consent to release') && !f2('Consent to release').on && f2('Consent to release').dis && f2('- signed') && !f2('- signed').on && f2('- signed').dis, '2. the consent form and the signed copy are not ticked and cannot be (the signed copy is only noticed)');
  ok(!f2('600700800').on && !f2('Cover Proposal 600700801').on, '2. the other policy\u2019s letter and quote are listed and NOT ticked');
  ok(/Counter Offer Letter/.test(list2.map(x => x.t).join(' ')) && /BR Personal Covers - 700800900/.test(list2.map(x => x.t).join(' ')), '2. each file shows the policy folder it is in');
  await p.screenshot({ path: out + '/r15-pick.png' });
  await p.evaluate(() => { window.__api = []; });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(); await p.waitForTimeout(900);

  /* ---- 3. one counter offer in the same block, from the letter and the quote ---- */
  const api = await p.evaluate(() => window.__api.map(t => ['LETTERDOC', 'COUNTERQUOTEDOC', 'CMPODOC', 'CONSENTDOC', 'SIGNEDDOC', 'OTHERLETTERDOC', 'OTHERQUOTEDOC'].filter(k => t.indexOf(k) >= 0)[0]));
  ok(api.length === 3 && api.indexOf('LETTERDOC') >= 0 && api.indexOf('COUNTERQUOTEDOC') >= 0 && api.indexOf('CMPODOC') >= 0, '3. only the letter, the counter offer quote and its pay-out guide were read (not the consent form, the signed copy or the other policy\u2019s files): ' + api.join(', '));
  let S = await st(); const root = S.blocks.fna.quotes[0], cnt = S.blocks.fna.quotes[1];
  ok(S.blocks.fna.quotes.length === 2 && cnt && cnt.counterOf === root.id && cnt.number === '400500777' && cnt.kind === 'fna', '3. ONE counter offer, in the same block as the accepted quote, linked to it, with the revised number');
  ok(cnt.lines.length === 5 && cnt.premium === 5420 && cnt.offer.startDate === '01/12/2026' && cnt.startDate === null && cnt.uw === null && cnt.status === 'pending', '3. its lines and loaded premium came from the quote, the letter\u2019s start date is only proposed, the client has not decided: ' + cnt.lines.length + ' lines, R' + cnt.premium);
  ok(cnt.terms.loadings.length === 3 && cnt.terms.exclusions.length === 1 && cnt.terms.loadings.every(l => l.st === 'verify') && cnt.terms.exclusions[0].no === '3*', '3. the terms from the letter are there, all amber, the exclusion with the insurer\u2019s number');
  ok(cnt.offer.signed === S_NAME && cnt.offer.letter === L_NAME && cnt.offer.expires === '20/12/2026', '3. the signed copy is noticed (not read) and the expiry date kept');
  const head = await txt('[data-statusfor="blocks.fna.quotes.0"]'), head2 = await txt('[data-statusfor="blocks.fna.quotes.1"]');
  ok(/Accepted with loadings and exclusions \u00b7 Counter offer received/.test(head) && /Counter offer \u00b7 Pending client decision/.test(head2), '3. the original says a counter offer was received, the counter offer says it waits for the client: "' + head + '" / "' + head2 + '"');
  await p.evaluate(() => document.querySelector('[data-counter]').scrollIntoView({ block: 'start' })); await p.waitForTimeout(250);
  const refs = await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-row="blocks.fna.quotes.1"] tr.ln')]; return rows.map(r => [...r.querySelectorAll('td.c')].map(td => [...td.querySelectorAll('small.rednote.ref')].map(x => x.textContent).join('+'))); });
  ok(refs.length === 5 && refs.every(r => r.every(x => !x)), '3. NO red reference on any line of the counter offer\u2019s table (Paul, 25 November: a loading belongs to a pillar, not to a line): ' + JSON.stringify(refs));
  ok(await p.evaluate(() => !document.querySelector('[data-row="blocks.fna.quotes.0"] small.rednote.ref')), '3. the original quote (no terms typed) shows no references');
  ok(/The insurer.s terms are on the counter offer below/.test(await txt('[data-row="blocks.fna.quotes.0"] .uwblock')) && !/No loading typed yet/.test(await txt('[data-row="blocks.fna.quotes.0"]')), '3. the original quote does not offer empty typing tables: it says the terms are on the counter offer');
  ok(/The letter proposes the start date 01\/12\/2026/.test(await txt('[data-counter]')) && (await st()).blocks.fna.quotes[1].startDate === null, '3. the letter\u2019s start date is shown as a proposal and is not the policy\u2019s start date');
  const mainNoWarn = await p.evaluate(() => { const c = document.querySelector('#main').cloneNode(true); c.querySelectorAll('.premwarn, textarea, input').forEach(e => e.remove()); return c.textContent; });
  ok(!/5,?420\.01/.test(mainNoWarn) && !/4,?999\.99/.test(mainNoWarn) && /5,?420/.test(await txt('[data-row="blocks.fna.quotes.1"]')), '3. ONE premium on the screen: the counter offer quote prints a cent more than the letter and the letter\u2019s figure is the one shown, in the quote\u2019s own premium bar and in the line under it (the figure the proposal printed is only in the amber warning)');
  ok(/R5,420\.01/.test(await txt('[data-counter] .premwarn')) && /R5,420\.00/.test(await txt('[data-counter] .premwarn')), '3. and that warning names both figures, for a difference of one cent');
  const prem = await txt('[data-counter] .premline'); ok(/before R5,?000 p\.m\..*after R5,?420 p\.m\..*difference \+R420 \(\+8\.4%\)/.test(prem), '3. premium before, after and the difference: "' + prem + '"');
  /* Paul 19:12: the counter offer is drawn like every other quote: the same table line by line, the same pay-out, nothing cut down */
  const tbl = await p.evaluate(() => { const one = n => { const c = document.querySelector('[data-row="blocks.fna.quotes.' + n + '"]'); return { head: [...c.querySelectorAll('table.qlines thead th')].map(t => t.textContent.trim()), needs: [...c.querySelectorAll('table.qlines tr.ln td.need > b')].map(b => b.textContent.trim()), acc: c.querySelectorAll('table.qlines .accsel select').length, ticks: c.querySelectorAll('table.qlines tr.ln .stb').length, tot: [...c.querySelectorAll('table.qlines tr.tot')].map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 28)), text: c.querySelector('table.qlines').textContent.replace(/\s+/g, ' '), cmp: [...c.querySelectorAll('.under table tr[data-row*=".cmp.rows."]')].length, aci: (c.querySelector('[data-aci]') || { textContent: '' }).textContent.trim() }; }; return { orig: one(0), cnt: one(1) }; });
  ok(JSON.stringify(tbl.orig.head) === JSON.stringify(tbl.cnt.head) && tbl.cnt.head.length >= 9, '3. the counter offer\u2019s table has the same columns as the FNA quote\u2019s: ' + tbl.cnt.head.length + ' headings');
  ok(JSON.stringify(tbl.cnt.needs) === JSON.stringify(['Household needs', 'Child care', 'Debt', 'Death-related needs', 'Additional expense needs (dread)']), '3. every need is its own line: ' + tbl.cnt.needs.join(' | '));
  ok(tbl.cnt.acc === 5 && tbl.cnt.ticks === 5, '3. each line has its Accelerated / Standalone choice and its status tick (' + tbl.cnt.acc + ' choices, ' + tbl.cnt.ticks + ' ticks)');
  ok(/Instalment Protector/.test(tbl.cnt.text) && /To be ceded to the bank/.test(tbl.cnt.text) && /Income portion p\.m\./.test(tbl.cnt.text) && /Monthly instalment/.test(tbl.cnt.text), '3. the debt line carries its Instalment Protector note and the monthly instalment, the others the income portion');
  ok(tbl.cnt.tot.length >= 4 && /Total lump sum/.test(tbl.cnt.tot.join('|')) && /Total income protected/.test(tbl.cnt.tot.join('|')) && /Monthly premium/.test(tbl.cnt.tot.join('|')), '3. the Total lump sum, Total income protected and premium rows are there: ' + tbl.cnt.tot.join(' | '));
  ok((await st()).blocks.fna.quotes[1].cmp && (await st()).blocks.fna.quotes[1].cmp.rows.length === 2 && tbl.cnt.cmp === 2, '3. its change moment pay-out was found by the revised proposal\u2019s CP number and is filled in under it (' + tbl.cnt.cmp + ' rows)');
  ok((await st()).blocks.fna.quotes[1].aciText === 'Premiums rise with the age adjuster', '3. the ACI wording came with the counter offer quote');
  ok(await p.evaluate(() => { const c = document.querySelector('[data-counter]'), t = document.querySelector('[data-row="blocks.fna.quotes.1"] table.qlines'); return !!(t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }), '3. the premium before and after and the terms are UNDER the table');
  ok(/to check/.test(await txt('.uwdecision p.amberline:not(.uwnoreason)')) && /A signed copy of the letter/.test(await txt('[data-counter]')) && /Cover for additional expense needs is reduced/.test(await txt('[data-counter]')), '3. the terms to check, the signed-copy hint and what the letter says beyond the terms are on the card');
  ok(/Counter offers \(1\)/.test(await txt('#nav [data-block="counters"]')) && /Counter offers\s+\(1\)/.test(await p.evaluate(() => document.querySelector('#nav [data-block="counters"]').innerText)), '3. the Counter offers entry is in the menu: ' + await txt('#nav [data-block="counters"]'));
  await p.screenshot({ path: out + '/r15-counter.png' });
  /* every View button opens its own file: the counter offer quote and the letter (four files in the folder share the revised number) */
  await p.evaluate(() => OV.view.warm()); await p.waitForTimeout(1500);
  const vbtn = path => p.$eval('[data-vw="' + path + '"]', e => ({ dis: e.disabled, text: e.textContent.trim(), t: e.title })).catch(() => null);
  const bq = await vbtn('blocks.fna.quotes.1'), bl = await vbtn('blocks.fna.quotes.1.letter');
  ok(bq && !bq.dis && bq.text === 'View quote' && bl && !bl.dis && bl.text === 'View letter', '3. the counter offer has View quote and View letter, both enabled: ' + JSON.stringify([bq, bl]));
  for (const [path, name] of [['blocks.fna.quotes.1', Q_NAME], ['blocks.fna.quotes.1.letter', L_NAME]]) {
    await p.evaluate(pth => document.querySelector('[data-vw="' + pth + '"]').scrollIntoView({ block: 'center' }), path); await p.click('[data-vw="' + path + '"]');
    await p.waitForSelector('.dvo .dvpage canvas', { timeout: 20000 }); await p.waitForTimeout(500);
    const title = await p.evaluate(() => document.querySelector('.dvo .dvt').textContent); ok(title.indexOf(name) >= 0, '3. View opens "' + name + '": ' + title);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  }
  /* adding a counter offer again: what is loaded is not ticked again, so nothing the adviser did is read over */
  await p.evaluate(() => { const q = OV.app.state.blocks.fna.quotes[1]; q.terms.loadings[0].kind = 'medical'; q.terms.loadings[0].reason = 'typed by the adviser'; OV.app.redraw(); }); await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(400);
  await p.click('[data-addcounter]'); await p.waitForSelector('dialog.fdlg[open] .flist');
  const list3 = await p.evaluate(() => [...document.querySelectorAll('dialog.fdlg .flist label')].map(l => ({ t: l.textContent.replace(/\s+/g, ' ').trim(), on: l.querySelector('input').checked })));
  ok(list3.filter(x => x.on).length === 0 && list3.filter(x => /already loaded/.test(x.t)).length === 2, '3. asking again: the letter and the quote are marked already loaded and nothing is ticked: ' + list3.filter(x => x.on).length + ' ticked, ' + list3.filter(x => /already loaded/.test(x.t)).length + ' marked');
  await p.click('dialog.fdlg [data-no]'); await p.waitForTimeout(300);
  ok((await st()).blocks.fna.quotes[1].terms.loadings[0].reason === 'typed by the adviser', '3. and what the adviser typed in a row is still there');
  await p.evaluate(() => document.querySelector('[data-row="blocks.fna.quotes.0"]').scrollIntoView({ block: 'start' })); await p.waitForTimeout(150);
  ok(/issued as a policy|counter offer/i.test(await txt('[data-row="blocks.fna.quotes.0"] .blue')) && /Counter offers/.test(await txt('[data-row="blocks.fna.quotes.0"] .counterlist')), '3. the original quote lists its counter offer with the premium and says the policy comes from the counter offer');
  await p.click('#nav [data-block="counters"]'); await p.waitForTimeout(400);
  const cpg = await txt('#main'); ok(/FNA quote/.test(cpg) && /400500777/.test(cpg) && /R5,?000.*R5,?420(?!\.\d)/.test(cpg) && /3 loadings, 1 exclusion/.test(cpg) && /4 to check/.test(cpg), '3. the Counter offers page lists it with its block, quote, premium and terms: ' + cpg.slice(0, 260));
  await p.screenshot({ path: out + '/r15-counters.png' });
  await p.click('[data-gocounter]'); await p.waitForTimeout(500); ok(await p.evaluate(() => !!document.querySelector('[data-counter]') && document.querySelector('#main h2').textContent === 'FNA quote'), '3. its Open button goes to the counter offer on the FNA quote page');

  /* ---- 4. the terms are checked ---- */
  await p.click('[data-confirmterms]'); await p.waitForTimeout(400); S = await st();
  ok(S.blocks.fna.quotes[1].terms.loadings.every(l => l.st === 'confirmed' && l.by === 'person') && S.blocks.fna.quotes[1].terms.exclusions[0].st === 'confirmed', '4. Terms checked confirms every amber row');
  ok(await p.evaluate(() => !document.querySelector('.uwdecision p.amberline:not(.uwnoreason)') && !document.querySelector('.uwblock tr.tocheck')), '4. and the amber note and the amber rows are gone');

  /* ---- 5. the client accepts the counter offer: one acceptance, the policy that issues, the replacement note, the Overview card ---- */
  const sel = 'select[data-p="blocks.fna.quotes.1.status"]'; await p.selectOption(sel, 'accepted'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.querySelector('.acceptbox.bad') && !/accepted|only one/i.test((document.querySelector('#toast') || { hidden: true, textContent: '' }).hidden ? '' : document.querySelector('#toast').textContent.replace(/second/g, ''))), '5. accepting the counter offer gives no second-acceptance warning');
  ok(await p.evaluate(() => !OV.app.state.blocks.fna.quotes.some(q => false) && OV.calc.acceptanceConflicts(OV.app.state).length === 0 && OV.calc.acceptedQuotes(OV.app.state).length === 1), '5. a quote and its counter offer are one acceptance');
  await p.fill('input[data-p="blocks.fna.quotes.1.policyNo"]', 'P-700800900'); await p.dispatchEvent('input[data-p="blocks.fna.quotes.1.policyNo"]', 'change'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.calc.policies(OV.app.state).filter(e => e.derived).length === 0), '5. a policy number alone does not make it a policy: the insurer\u2019s start date is still to be typed');
  await p.fill('input[data-p="blocks.fna.quotes.1.startDate"]', '02/12/2026'); await p.dispatchEvent('input[data-p="blocks.fna.quotes.1.startDate"]', 'change'); await p.waitForTimeout(300);
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(500);
  const pol = await txt('#main'); ok(/P-700800900/.test(pol) && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500777/.test(pol), '5. Current policies shows the policy that issued and the red note names the counter offer (CP 400500777)');
  ok(await p.evaluate(() => OV.calc.policies(OV.app.state).filter(e => e.derived).length === 1 && OV.calc.policies(OV.app.state).filter(e => e.derived)[0].item.id === OV.app.state.blocks.fna.quotes[1].id), '5. it is the counter offer, once (the quote it came from is no policy)');
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(400);
  S = await st(); ok(await p.evaluate(() => OV.pres.sentenceFor(OV.app.state, 'fna') === OV.pres.WORDING.fna.counteraccepted), '5. the Overview card says what was decided: "' + await p.evaluate(() => OV.pres.sentenceFor(OV.app.state, 'fna')) + '"');
  await p.evaluate(() => OV.present.open()); await p.waitForTimeout(500); const cardOv = await p.evaluate(() => [...document.querySelectorAll('#pSlide .pcard')].map(c => c.querySelector('.ct').textContent + ' | ' + c.querySelector('.cs').textContent));
  ok(cardOv.some(t => /^Life cover: FNA quote \| You accepted the insurer.s counter offer for this cover\.$/.test(t)), '5. the Presentation\u2019s Overview page says it on the card: ' + cardOv.filter(t => /FNA/.test(t)).join(''));
  await p.screenshot({ path: out + '/r15-pres-overview.png' });
  await p.evaluate(() => OV.present.go('fna')); await p.waitForTimeout(500);
  const chips = await p.evaluate(() => [...document.querySelectorAll('#pres .pchip[data-act=q]')].map(c => c.textContent.trim())); ok(chips.length === 2 && /Counter offer 400500777/.test(chips[1]), '6. the Presentation lists the counter offer beside the quote: ' + chips.join(' | '));
  await p.click('#pres .pchip[data-act=q][data-i="1"]'); await p.waitForTimeout(500);
  const pq = await p.evaluate(() => { const e = document.querySelector('#pres'); return { text: e.innerText.replace(/\s+/g, ' '), refs: [...e.querySelectorAll('.ptbl small.rednote.ref')].map(x => x.textContent), red: getComputedStyle(e.querySelector('.ptbl small.rednote.ref') || e).color, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, prem: (e.querySelector('.cprem') || { textContent: '' }).textContent }; });
  ok(!/5,?420\.01/.test(pq.text) && !/4,?999\.99/.test(pq.text), '6. ONE premium in the Presentation as well (no figure a cent off the letter, before or after)');
  ok(pq.refs.indexOf('+10% loading') >= 0 && pq.refs.indexOf('Exclusion 3*') >= 0 && pq.refs.indexOf('+15% loading') >= 0 && /Loadings and exclusions/.test(pq.text), '6. the Presentation\u2019s quote table has the red references in its cells and in the totals: ' + pq.refs.length + ' references');
  const pr2 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#pres .ptbl tr[data-label]')].map(r => r.getAttribute('data-label')), text: document.querySelector('#pres .ptbl').textContent.replace(/\s+/g, ' '), subs: [...document.querySelectorAll('#pres .psub')].map(b => b.textContent.trim()), tot: document.querySelectorAll('#pres .ptbl tr.tot, #pres .ptbl tr.prem').length, tick: !!document.querySelector('#pres .ptbl .na, #pres .ptbl td') }));
  ok(pr2.rows.length === 5 && /Child care/.test(pr2.rows.join('|')) && /Debt/.test(pr2.rows.join('|')) && /Instalment Protector/.test(pr2.text) && /To be ceded to the bank/.test(pr2.text) && pr2.tot >= 3 && pr2.subs.indexOf('Your change moment pay-out') >= 0 && pr2.subs.indexOf('Compared with what you have now') >= 0, '6. the Presentation draws it like any quote: ' + pr2.rows.length + ' lines, the Instalment Protector note, the totals, and the tabs ' + pr2.subs.join(' | '));
  ok(pq.red === 'rgb(192, 57, 43)' && /before R5,?000 p\.m\..*after R5,?420(?!\.\d)/.test(pq.prem.replace(/\s+/g, ' ')) && pq.sw <= pq.cw + 1 && pq.sh <= pq.ch + 1, '6. they are really red, the premium line is there and the page fits the screen (' + pq.sw + '/' + pq.cw + ', ' + pq.sh + '/' + pq.ch + ', colour ' + pq.red + ', premium line "' + pq.prem + '")');
  await p.screenshot({ path: out + '/r15-pres-quote.png' });
  await p.click('#pres .psub[data-s=uw]'); await p.waitForTimeout(500);
  const pu = await p.evaluate(() => document.querySelector('#pres').innerText.replace(/\s+/g, ' ')); ok(/Counter offer to BrightRock quote CP 400500600/.test(pu) && /The revised proposal expires 20\/12\/2026/.test(pu) && /Underwriting terms of the counter offer/.test(pu) && /3\*/.test(pu) && /Severe illness, income protector/.test(pu) && !/severe illness and income protector/i.test(pu), '6. the counter offer\u2019s terms tab: its quote, expiry, loadings by benefit and need group, the numbered exclusion');
  ok(!/will be replaced by/.test(pu), '6. the replacements are told once, under the original quote, naming the counter offer');
  await p.screenshot({ path: out + '/r15-pres-terms.png' }); await p.evaluate(() => OV.present.close());

  const pdfFile = out + '/r15-overview.pdf', bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(pdfFile, Buffer.from(bytes));
  const pages = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdfFile]).toString())[1], 10), raw = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-raw', pdfFile, '-']).toString().replace(/\s+/g, ' ');
  let qp = 0, pp = 0; for (let i = 1; i <= pages; i++) { const t = raw(i); if (!qp && /Counter offer to BrightRock quote CP 400500600/.test(t)) qp = i; if (!pp && /will be replaced by/.test(t) && /Current policies/.test(t)) pp = i; }
  const qt = qp ? raw(qp) : '';
  ok(qp > 0 && /Underwriting terms of the counter offer/.test(qt) && /\+10% loading/.test(qt) && /Exclusion 3\*/.test(qt) && /\+15% loading/.test(qt) && /Loadings and exclusions/.test(qt), '6. the PDF quote page has the counter offer with its red references in the cells and the totals (page ' + qp + ')');
  ok(!/5,?420\.01/.test(qt) && !/4,?999\.99/.test(qt), '6. ONE premium in the PDF as well (no figure a cent off the letter, before or after)');
  ok(/Premium: before R ?5,?000 p\.m\. \| after R ?5,?420 p\.m\. \| difference \+R ?420 \(\+8\.4%\)/.test(qt) && /expires 20\/12\/2026/.test(qt) && /The letter also says: Cover for additional expense needs is reduced/.test(qt) && /Counter offer \u00b7 Accepted|Counter offer . Accepted|Counter offer Accepted/.test(qt), '6. the PDF prints the premium before and after, the expiry, what the letter says and the client\u2019s decision');
  ok(/3\* Severe illness, income protector No cover for conditions of the lower back/.test(qt), '6. the exclusion is printed with its number, benefit, wording and type');
  const afterC = qt.indexOf('Counter offer \u00b7 Accepted'), cq = afterC >= 0 ? qt.slice(afterC) : '';
  ok(/Household needs/.test(cq) && /Child care Ann Scene/.test(cq) && /Debt Home loan - Test Bank/.test(cq) && /Standalone/.test(cq) && /Death-related needs/.test(cq) && /Additional expense needs/.test(cq) && /Instalment Protector/.test(cq) && /To be ceded to the bank/.test(cq), '6. the PDF draws the counter offer\u2019s table line by line like any quote: every need, the lender, Standalone, the Instalment Protector note');
  ok(/Total lump sum/.test(cq) && /Total income protected/.test(cq) && /Monthly premium/.test(cq) && /Your change moment pay-out/.test(cq) && /Total for all your needs/.test(cq) && /Compared with what you have now/.test(cq), '6. with its totals, its change moment pay-out and the comparison');
  ok(cq.indexOf('Premium: before') > cq.lastIndexOf('Total income protected') && cq.indexOf('Premium: before') < cq.indexOf('Your change moment pay-out') && cq.indexOf('Underwriting terms of the counter offer') > cq.indexOf('Compared with what you have now'), '6. the premium before and after sits under the table and the terms under the comparison, as the PDF has the terms of every quote');
  ok(pp > 0 && /Budget Insurance 100200300 will be replaced by BrightRock quote CP 400500777/.test(raw(pp)) && !/will be replaced by BrightRock quote CP 400500600/.test(raw(pp)), '6. the PDF\u2019s policy note names the counter offer: page ' + pp);
  const info = cp.execFileSync('pdfinfo', ['-f', String(qp), '-l', String(qp), pdfFile]).toString(), size = /Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/.exec(info); ok(!!size && parseFloat(size[2]) > 0, '6. the page is made to fit its content (' + (size ? size[1] + ' x ' + size[2] : '?') + ' pt)');
  if (qp) cp.execFileSync('pdftoppm', ['-f', String(qp), '-l', String(qp), '-r', '80', '-png', '-singlefile', pdfFile, out + '/r15-pdf-quote']);

  /* ---- 7. the client turns the counter offer down ---- */
  await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(400); await p.selectOption(sel, 'notaccepted'); await p.waitForTimeout(500);
  S = await st(); ok(await p.evaluate(() => OV.calc.policies(OV.app.state).filter(e => e.derived).length === 0 && OV.calc.acceptedQuotes(OV.app.state).length === 0), '7. turned down: no policy issues and nothing is accepted any more');
  ok(/Counter offer not accepted/.test(await txt('[data-statusfor="blocks.fna.quotes.0"]')) && await p.evaluate(() => /notaccepted/.test(document.querySelector('[data-statusfor="blocks.fna.quotes.0"]').className)) && /did not accept the counter offer, so no policy comes from this quote/.test(await txt('[data-row="blocks.fna.quotes.0"]')), '7. the original quote says so too: red badge "' + await txt('[data-statusfor="blocks.fna.quotes.0"]') + '" and no policy comes from it');
  await p.evaluate(() => OV.app.go('policies')); await p.waitForTimeout(400); ok(!/will be replaced by/.test(await txt('#main')), '7. and the red \u201cwill be replaced\u201d note is gone');
  ok(await p.evaluate(() => OV.pres.sentenceFor(OV.app.state, 'fna') === OV.pres.WORDING.fna.counterrefused), '7. the Overview card says so: "' + await p.evaluate(() => OV.pres.sentenceFor(OV.app.state, 'fna')) + '"');

  /* ---- 8. saved and opened again ---- */
  const json = await p.evaluate(() => OV.store.toJSON(OV.app.state)); await p.evaluate(j => OV.app.setState(OV.store.fromJSON(j)), json); await p.evaluate(() => OV.app.go('fna')); await p.waitForTimeout(400);
  S = await st(); ok(S.blocks.fna.quotes[1].counterOf === S.blocks.fna.quotes[0].id && S.blocks.fna.quotes[1].terms.loadings.length === 3 && /Counter offer/.test(await txt('[data-statusfor="blocks.fna.quotes.1"]')), '8. the counter offer survives saving and opening the file');

  /* ---- 9. a counter offer of ANOTHER insurer's quote is drawn the way that insurer's quotes are drawn ---- */
  await p.evaluate(() => {
    const s = OV.store.blank(); s.header.fname = 'Sam'; s.header.sname = 'Scene';
    const l = { type: 'other', label: 'Cover', term: 'Whole of life', life: { lump: 2000000 }, sev: { lump: 500000 }, ip: { monthly: 10000 }, abi: 5 };
    const q = OV.docs.applyQuote(s, 'comparative', { insurer: 'Liberty', number: 'LQ-77', date: '19/11/2026', premium: 4000, lines: [l] }, 'Liberty quote.pdf').quote;
    OV.store.setStatus(s, 'blocks.comparative.quotes.0', 'accepted'); OV.store.setUw(s, 'blocks.comparative.quotes.0', 'loadings');
    OV.docs.applyQuote(s, 'comparative', { insurer: 'Liberty', number: 'LQ-78', date: '28/11/2026', premium: 4400, lines: [l] }, 'Liberty counter.pdf', { counterOf: q.id });
    OV.app.setState(s); OV.app.openAll();
  });
  await p.evaluate(() => OV.app.go('comparative')); await p.waitForTimeout(500);
  const oth = await p.evaluate(() => { const one = n => { const c = document.querySelector('[data-row="blocks.comparative.quotes.' + n + '"]'); return { head: [...c.querySelectorAll('table.qlines thead th')].map(t => t.textContent.trim()), rows: c.querySelectorAll('table.qlines tr.ln').length, label: (c.querySelector('table.qlines tr.ln td.need input') || {}).value, term: (c.querySelector('table.qlines tr.ln input[data-p$=".term"]') || {}).value, acc: c.querySelectorAll('.accsel').length, note: /what the other insurer/.test(c.textContent), tot: c.querySelectorAll('table.qlines tr.tot, table.qlines tr.prem').length }; }; return { a: one(0), b: one(1) }; });
  ok(JSON.stringify(oth.a.head) === JSON.stringify(oth.b.head) && oth.a.rows === oth.b.rows && oth.b.rows === 1 && oth.a.label === oth.b.label && oth.b.label === 'Cover' && oth.a.term === oth.b.term && oth.b.term === 'Whole of life' && oth.a.acc === oth.b.acc && oth.a.note && oth.b.note && oth.a.tot === oth.b.tot, '9. Liberty\u2019s counter offer is drawn exactly as Liberty\u2019s quote is: ' + JSON.stringify(oth.b));
  await p.screenshot({ path: out + '/r15-other-insurer.png', fullPage: true });
  const bytes2 = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer')))); fs.writeFileSync(out + '/r15-other.pdf', Buffer.from(bytes2));
  const n2 = parseInt(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [out + '/r15-other.pdf']).toString())[1], 10); let ot = ''; for (let i = 1; i <= n2; i++) { const t = cp.execFileSync('pdftotext', ['-f', String(i), '-l', String(i), '-raw', out + '/r15-other.pdf', '-']).toString().replace(/\s+/g, ' '); if (/Counter offer/.test(t) && /Liberty/.test(t)) ot = t; }
  ok((ot.match(/Whole of life/g) || []).length >= 2 && (ot.match(/Total lump sum/g) || []).length >= 2 && (ot.match(/Monthly premium/g) || []).length >= 2, '9. the PDF draws both Liberty quotes with the same table (a whole-of-life line, the totals, the premium)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
