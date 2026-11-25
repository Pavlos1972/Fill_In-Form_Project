/* Client Overview Studio 2.0 (25 November, Paul's decisions relayed by the Fix Skills chat at 17:20 after he approved the mock-ups). A real folder tree of an invented client ("Test, Sia") with a BrightRock policy folder whose review folder holds a bare Serv quote, a
   Decrease quote, an FNA quote, a premium increase letter and a Discovery comparative quote, an investment policy folder with a Serv quote, and a numbered 3. Quotes folder with a new business FNA quote. Checked on the real page: Load sends each quote to its
   servicing block tied to the policy (never to Comparative quotes), the menu is under four headings, the servicing card shows the policy and the old and the new side by side, no line can be added or removed by hand, a "+ Add ..." button ends every block,
   Back and Next pass the empty servicing pages by, a schedule the Fact Find does not list is added and marked, the PDF and the Presentation carry the same headings in the same order, and nothing is written to the folders. Screenshots (deviceScaleFactor 2): r20-*. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(t) {                                                                                            // a small valid PDF: one line of big text; the text says what the stand-in reading will answer (READ:name)
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const one = t => pdf('READ:' + t);
const TREE = {
  NB: { 'Test, Sia': {
      '1. Overview': {}, '2. Fact Find': {}, '3. Quotes': { 'FNA Quote 100000099 12.01.26.pdf': one('nbfna') }, '6. Policy Schedules': {},
      'BR Personal Covers - 900100200': {
        'Policy Schedules': { '2026': { 'BR Policy Summary 01.06.26.pdf': one('sched') } },
        'Comparative Quotes': { '2026 - Review': { 'BR Serv Quote - 123456789 - R1450.00 - 17.10.26.pdf': one('svinc'), 'Decrease Quote 987654321 02.11.26.pdf': one('svdec'), 'FNA Quote 555000111 10.11.26.pdf': one('svfna'), 'Premium Increase Letter 2026.pdf': one('letter'), 'BR CMPO - 123456789.pdf': one('cmpo') },
          'Discovery Quote 12.03.26.pdf': one('disc') } },
      'BR Life Cover - 900300400': { 'Policy Schedules': { '2026': { 'BR Policy Summary 01.06.26.pdf': one('schedb') } }, 'Comparative Quotes': { '2026 - Review': { 'Decrease Quote 777888999 20.10.26.pdf': one('svdecb') } } },
      'BR Old Cover - 555666777': { 'Comparative Quotes': { '2026 - Review': { 'Decrease Quote 111000222 21.10.26.pdf': one('svdecc') } } },
      'Sanlam Invest - 889977': { 'Comparative Quotes': { 'Serv quote 444555666.pdf': one('none') } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'T - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sia'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026'), bf_sf_req: v('Request a quote') },
  l: { kids: [], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 8 000.00', bal: 'R 900 000.00' } }],
    risk: [{ d: { prov: 'BrightRock', spend: 'R 1 000.00', broker: 'Paul K' } }, { d: { prov: 'BrightRock', spend: 'R 650.00', broker: 'Paul K' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [], inv: [] } };
const L = (type, lump, monthly, o) => Object.assign({ type, life: { lump, monthly }, abi: type === 'household' ? 5 : 0 }, o || {});
const READS = {
  sched: { insurer: 'BrightRock', product: 'Personal covers', policyNo: '900100200', doc: '01/06/2026', premium: 1000, aci: 10, lines: [L('household', 500000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })] },
  svinc: { insurer: 'BrightRock', number: '123456789', date: '17/10/2026', rates: 'Non-smoker rates', aci: 10, premium: 1450, lines: [L('household', 700000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' }), L('debt', 300000, 2500, { debt: 'Car finance', bank: 'Test Bank' })] },
  svdec: { insurer: 'BrightRock', number: '987654321', date: '02/11/2026', rates: 'Non-smoker rates', aci: 10, premium: 900, lines: [L('household', 400000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })] },
  svfna: { insurer: 'BrightRock', number: '555000111', date: '10/11/2026', rates: 'Non-smoker rates', aci: 10, premium: 1800, lines: [L('household', 900000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })] },
  schedb: { insurer: 'BrightRock', product: 'Life cover', policyNo: '900300400', doc: '01/06/2026', premium: 650.5, lines: [L('household', 200000, 0)] },
  svdecb: { insurer: 'BrightRock', number: '777888999', date: '20/10/2026', rates: 'Non-smoker rates', aci: 10, premium: 500, lines: [L('household', 150000, 0)] },
  svdecc: { insurer: 'BrightRock', number: '111000222', date: '21/10/2026', rates: 'Non-smoker rates', aci: 10, premium: 100, lines: [L('household', 50000, 0)] },
  cmpo: { number: '123456789', activationDate: '01/01/2027', rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }] },
  nbfna: { insurer: 'BrightRock', number: '100000099', date: '12/01/2026', rates: 'Non-smoker rates', aci: 10, premium: 2500, lines: [L('household', 800000, 0)] },
  nobody: { insurer: 'Nobody Assurance', product: 'Life plan', policyNo: 'Z-9', premium: 300, lines: [] }
};

srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = reads => {
    window.__api = []; window.__writes = 0; window.__reads = reads;
    const DP = FileSystemDirectoryHandle.prototype, FP = FileSystemFileHandle.prototype, gd = DP.getDirectoryHandle, gf = DP.getFileHandle, re = DP.removeEntry, cw = FP.createWritable;
    DP.getDirectoryHandle = function (n, o) { if (o && o.create) window.__writes++; return gd.call(this, n, o); }; DP.getFileHandle = function (n, o) { if (o && o.create) window.__writes++; return gf.call(this, n, o); };
    DP.removeEntry = function (n, o) { if (window.__tracking) window.__writes++; return re.call(this, n, o); }; FP.createWritable = function (o) { if (window.__tracking) window.__writes++; return cw.call(this, o); };
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0]; let txt = '';
      if (c0.source && c0.source.data) { txt = atob(c0.source.data); window.__api.push(txt); }
      const m = /READ:(\w+)/.exec(txt), reply = m && window.__reads[m[1]] ? window.__reads[m[1]] : {};
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 5, output_tokens: 5 } }) });
    };
    let fo; const FFo = {};
    Object.defineProperty(FFo, 'folders', { configurable: true, enumerable: true, get() { return fo; }, set(x) {
      fo = x;
      x.saveHandle = async (key, h) => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (h) { const root = await navigator.storage.getDirectory(); m[key] = await root.resolve(h); } else delete m[key]; localStorage.setItem('tf-handles', JSON.stringify(m)); };
      x.loadHandle = async key => { const m = JSON.parse(localStorage.getItem('tf-handles') || '{}'); if (!m[key]) return null; try { let d = await navigator.storage.getDirectory(); for (const n of m[key]) d = await d.getDirectoryHandle(n); return d; } catch (e) { return null; } };
    } });
    window.FF = FFo;
  };
  const wireOn = pg => pg.evaluate(async () => { const root = await navigator.storage.getDirectory(); window.__rootsById = { 'wr-folder-a': await root.getDirectoryHandle('NB'), 'wr-folder-b': await root.getDirectoryHandle('CF') }; });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init, READS);
  const errs = [];
  const rp = await ctx.newPage(); rp.on('dialog', d => d.accept()); await rp.goto(addr + 'short-risk.html'); await rp.waitForTimeout(500);
  await rp.evaluate(async spec => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    async function mk(d, s) { for (const [n, x] of Object.entries(s)) { if (typeof x === 'string') { const f = await d.getFileHandle(n, { create: true }), w = await f.createWritable(); await w.write(x); await w.close(); } else { const sub = await d.getDirectoryHandle(n, { create: true }); await mk(sub, x); } } }
    await mk(root, spec);
  }, TREE);
  await wireOn(rp); await rp.click('#btnFolders'); await rp.waitForSelector('dialog.fdlg[open]');
  await rp.click('dialog.fdlg [data-key="A"] [data-pick]'); await rp.waitForTimeout(250); await rp.click('dialog.fdlg [data-key="B"] [data-pick]'); await rp.waitForTimeout(250);
  await rp.fill('dialog.fdlg [data-key="A"] [data-path]', 'C:\\Users\\tester\\Company\\New Business'); await rp.fill('dialog.fdlg [data-key="B"] [data-path]', 'C:\\Users\\tester\\Company\\Client Files');
  await rp.click('dialog.fdlg [data-done]'); await rp.waitForTimeout(300);

  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(addr + 'overview.html'); await p.waitForTimeout(900); await wireOn(p); if (await p.$('#restoreDraft')) await p.click('#restoreNew');
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  await p.evaluate(ff => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); ['svFna', 'svIncrease', 'svReduction', 'fna', 'comparative'].forEach(id => OV.store.setNeeded(s, id, true)); OV.app.setState(s); OV.app.openAll(); window.__tracking = true; window.__writes = 0; }, FFJ);
  const waitDone = pg => pg.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });

  /* ---- 1. Load from client folder: the pick list ---- */
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  const L1 = await p.evaluate(() => {
    const d = document.querySelector('dialog.fdlg[open]'), res = { heads: [], rows: [] };
    [...d.querySelectorAll('.flist > *')].forEach(e => { if (e.classList.contains('pkh')) { res.cur = e.querySelector('b').textContent; res.heads.push(res.cur); } else if (e.tagName === 'LABEL') res.rows.push({ g: res.cur || '', t: e.textContent.replace(/\s+/g, ' ').trim(), on: e.querySelector('input').checked }); });
    return res;
  });
  const row = re => L1.rows.filter(r => re.test(r.t))[0] || null;
  const sv = row(/BR Serv Quote - 123456789/), dec = row(/Decrease Quote 987654321/), fna = row(/FNA Quote 555000111/), letter = row(/Premium Increase Letter/), disc = row(/Discovery Quote 12\.03\.26/), nbf = row(/3\. Quotes \\ FNA Quote 100000099|FNA Quote 100000099/), sl = row(/Serv quote 444555666/);
  ok(sv && sv.on && /Straight increase quote/.test(sv.t) && /its premium tells increase from reduction/.test(sv.t), '1. a bare "BR Serv Quote" in the policy folder is a straight quote, ticked, and says its premium tells increase from reduction: ' + (sv && sv.t));
  ok(dec && dec.on && /Straight reduction quote/.test(dec.t), '1. "Decrease Quote" is a straight reduction quote: ' + (dec && dec.t));
  ok(fna && fna.on && /Servicing FNA quote/.test(fna.t), '1. an FNA quote inside the policy folder is a SERVICING FNA quote: ' + (fna && fna.t));
  ok(letter && !letter.on && /paperwork about a change/.test(letter.t), '1. the premium increase letter is paperwork, not a quote, not ticked: ' + (letter && letter.t));
  ok(disc && /Comparative quote/.test(disc.t) && !/Servicing|Straight/.test(disc.t), '1. a Discovery quote in the same folder stays a comparative quote (nothing in its name says servicing): ' + (disc && disc.t));
  ok(nbf && /FNA quote/.test(nbf.t) && !/Servicing/.test(nbf.t) && nbf.on, '1. the new business FNA quote in the client\'s own 3. Quotes folder stays a new business FNA quote: ' + (nbf && nbf.t));
  ok(!sl || !/Servicing|Straight/.test(sl.t), '1. a Serv quote in an investment policy folder is not routed to a servicing block (there is none for investments): ' + (sl && sl.t));
  await p.screenshot({ path: out + '/r20-list.png' });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(900);

  /* ---- 2. what Load put where ---- */
  const S = await p.evaluate(() => { const s = OV.app.state, q = (b) => s.blocks[b].quotes.filter(x => !x.removed).map(x => ({ n: x.number, k: x.kind, tie: x.onPolicy && x.onPolicy.number, found: (OV.calc.servicingPolicy(s, x) || {}).policyNo || null, lines: x.lines.length, serv: x.servicing, cmp: x.cmp ? x.cmp.rows.length : 0 })); return { svInc: q('svIncrease'), svDec: q('svReduction'), svFna: q('svFna'), svSf: q('svShortfall'), svRed: q('svReduced'), fna: q('fna'), cmp: q('comparative'), pol: s.blocks.policies.items.map(i => i.insurer + '|' + i.policyNo + '|' + i.premium + '|' + i.lines.length), docs: s.documents.map(d => d.block).sort().join(',') }; });
  ok(S.svInc.length === 1 && S.svInc[0].n === '123456789' && S.svInc[0].k === 'svincrease' && S.svInc[0].tie === '900100200' && S.svInc[0].serv === true && S.svInc[0].lines === 3, '2. the bare Serv quote is in Straight increase (its premium R1,450 is above the policy\'s R1,000), tied to policy 900100200: ' + JSON.stringify(S.svInc));
  const dec3 = n => S.svDec.filter(x => x.n === n)[0] || {};
  ok(S.svDec.length === 3 && dec3('987654321').found === '900100200' && dec3('777888999').found === '900300400' && dec3('111000222').tie === '555666777' && dec3('111000222').found === null, '2. the three Decrease quotes are in Straight reduction, each tied to the policy whose NUMBER is in the name of its folder; the one whose folder names a policy that is not in Current policies is tied to none of ours (never the only BrightRock policy): ' + JSON.stringify(S.svDec));
  ok(S.svInc[0].cmp === 1, '2. the pay-out guide beside the quote (BR CMPO - 123456789) was read into it (the guide follows the quote number): ' + JSON.stringify(S.svInc[0]));
  ok(S.svFna.length === 1 && S.svFna[0].n === '555000111' && S.svFna[0].tie === '900100200' && S.fna.length === 1 && S.fna[0].n === '100000099', '2. the FNA quote of the policy folder is a servicing FNA quote, the one of 3. Quotes a new business FNA quote: ' + JSON.stringify([S.svFna, S.fna]));
  ok(S.svSf.length === 0 && S.svRed.length === 0 && S.cmp.every(x => !/^sv/.test(x.k)), '2. nothing in the other servicing blocks; nothing servicing among the comparative quotes: ' + JSON.stringify([S.svSf, S.svRed, S.cmp]));
  ok(S.pol.some(x => /^BrightRock\|900100200\|1000\|2$/.test(x)) && S.pol.some(x => /^BrightRock\|900300400\|650\.5\|1$/.test(x)), '2. both BrightRock schedules were read into their own policies, the second one with a premium (R650.50) that differs a little from the Fact Find\'s (R650): ' + S.pol.join(' ; '));
  const w = await p.evaluate(() => window.__writes);
  ok(w === 0, '2. nothing was created, written or removed in any folder (a counter on the browser\'s folder calls: ' + w + ')');

  /* ---- 3. the menu under four headings, Back and Next ---- */
  await p.evaluate(() => { OV.app.go('policies'); OV.app.openAll(); });
  const nav = await p.evaluate(() => ({ heads: [...document.querySelectorAll('#nav .sep.grp')].map(e => e.textContent), btns: [...document.querySelectorAll('#nav button[data-block]')].map(x => x.getAttribute('data-block')), dots: Object.fromEntries([...document.querySelectorAll('#nav .dot[data-dot]')].map(d => [d.getAttribute('data-dot'), d.className.replace('dot ', '')])) }));
  ok(nav.heads.join('|') === 'Where the client is now|Servicing quotes (on a current policy)|New business quotes (new policy)|Investments & goals', '3. the menu has the four headings: ' + nav.heads.join(' | '));
  ok(nav.btns.join(',') === '_client,policies,group,investments,other,shortfall,svFna,svShortfall,svReduced,svIncrease,svReduction,fna,shortfallQuote,reduced,comparative,proposed,goals', '3. the sixteen blocks under them, in order: ' + nav.btns.join(','));
  ok(nav.dots.svFna !== 'grey' && nav.dots.svIncrease !== 'grey' && nav.dots.svReduction !== 'grey' && nav.dots.svShortfall === 'na' && nav.dots.svReduced === 'na', '3. each servicing block has its own dot: the three with a quote are not grey, the two empty ones nobody asked for are dashed (round 2.2): ' + JSON.stringify(nav.dots));
  const pager = async id => { await p.evaluate(i => OV.app.go(i), id); await p.waitForTimeout(80); return p.evaluate(() => [...document.querySelectorAll('#main .pagenav button')].map(x => x.textContent.replace(/\s+/g, ' ').trim())); };
  ok((await pager('shortfall'))[1] === 'Next: Servicing FNA quote \u203a' && (await pager('svFna'))[1] === 'Next: Straight increase \u203a' && (await pager('svIncrease'))[1] === 'Next: Straight reduction \u203a' && (await pager('svReduction'))[1] === 'Next: FNA quote \u203a', '3. Next passes the two empty servicing pages by (Servicing shortfall, Servicing reduced) and goes on through the three that hold a quote');
  ok((await pager('fna'))[0] === '\u2039 Back: Straight reduction' && (await pager('svFna'))[0] === '\u2039 Back: Shortfall (needs calculation)', '3. and Back does the same');
  const nt = await p.evaluate(() => ({ s: document.querySelector('[data-state=svShortfall]').textContent, r: document.querySelector('[data-state=svReduced]').textContent, inc: (document.querySelector('[data-block=svIncrease] .cnt') || {}).textContent, dec: (document.querySelector('[data-block=svReduction] .cnt') || {}).textContent, none: !document.querySelector('[data-block=svShortfall] .cnt') }));
  ok(nt.s === 'Not asked for' && nt.r === 'Not asked for' && nt.inc === '1' && nt.dec === '3' && nt.none, '3. an empty servicing block nobody asked for says Not asked for (never red; round 2.2) and a block with quotes shows how many: ' + JSON.stringify(nt));
  await p.screenshot({ path: out + '/r20-menu.png', clip: { x: 0, y: 0, width: 330, height: 1100 } });

  /* ---- 4. the servicing card ---- */
  await p.evaluate(() => { OV.app.go('svIncrease'); OV.app.openAll(); }); await p.waitForTimeout(150);
  const C = await p.evaluate(() => {
    const c = document.querySelector('#main .qcard'), rows = [...c.querySelectorAll('table.svt tbody tr.svr')].map(r => r.className.replace('svr ', '') + ':' + r.querySelector('td.need').textContent.replace(/\s+/g, ' ').trim() + ':' + r.querySelector('td.chgtxt').textContent.replace(/\s+/g, ' ').trim());
    return { title: c.querySelector('h3').textContent, payout: !!c.querySelector('table.payout'), typeSel: c.querySelector('select[data-svtype]').selectedOptions[0].textContent, sel: c.querySelector('select[data-svpol]').selectedOptions[0].textContent, rows, prem: c.querySelector('table.svt tr.prem').textContent.replace(/\s+/g, ' ').trim(), note: c.querySelector('.svnote').textContent.replace(/\s+/g, ' ').trim(),
      addl: c.querySelectorAll('[data-addl]').length, x: c.querySelectorAll('.xbtn').length, kindSel: [...c.querySelectorAll('.f .l')].some(e => /Kind of quote/.test(e.textContent)), repl: c.querySelectorAll('[data-replans], [data-replpick]').length, replace: !!c.querySelector('[data-replace]'), btn: [...document.querySelectorAll('#main [data-upc]')].map(x => x.textContent).join('|') };
  });
  ok(/Straight Increase CP 123456789/.test(C.title) && /BrightRock/.test(C.sel) && /900100200/.test(C.sel), '4. the card is headed "Straight Increase CP 123456789" and names the ONE policy it is about: ' + C.title + ' / ' + C.sel);
  ok(C.rows.length === 3 && /^changed:Household needs:Changed Life cover \+R200,000$/.test(C.rows[0]) && /^same:DebtHome loan/.test(C.rows[1]) && /No change/.test(C.rows[1]) && /^added:DebtCar finance/.test(C.rows[2]) && /New/.test(C.rows[2]), '4. old and new line by line: household raised, the home loan unchanged, the car finance added: ' + C.rows.join(' || '));
  ok(/R1,000/.test(C.prem) && /R1,450/.test(C.prem) && /\+R450 a month/.test(C.prem) && /\+45%/.test(C.prem), '4. the premium before, after and the difference: ' + C.prem);
  ok(/One line added or raised: no FNA and no shortfall\./.test(C.note) && /On BrightRock 900100200/.test(C.note), '4. the note says what a straight increase is and names the policy: ' + C.note);
  ok(C.addl === 0 && C.x === 0 && !C.kindSel && C.repl === 0 && C.replace, '4. no add-line button, no x on a line, no Servicing / New business selector, no replacement question; Replace quote… is there: ' + JSON.stringify({ addl: C.addl, x: C.x, kindSel: C.kindSel, repl: C.repl, replace: C.replace }));
  ok(C.payout && C.typeSel === 'Straight increase', '4. the pay-out guide that sits beside the quote is under it, and the Type of servicing box says Straight increase: ' + JSON.stringify({ payout: C.payout, type: C.typeSel }));
  ok(C.btn === '+ Add straight increase quote…', '4. the button at the bottom of the block says + Add straight increase quote…: ' + C.btn);
  await p.fill('#main .qcard textarea[data-p$=".reason"]', 'A car loan added to the policy'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.quotes[0].reason === 'A car loan added to the policy'), '4. the reason is typed and kept');
  await p.fill('#main .qcard input[data-p$=".premium"]', '1500'); await p.waitForTimeout(250);
  ok(/R1,500/.test(await p.evaluate(() => document.querySelector('#main .qcard table.svt tr.prem').textContent)) && /\+R500 a month/.test(await p.evaluate(() => document.querySelector('#main .qcard table.svt tr.prem').textContent)), '4. the table follows what is typed (premium R1,500: +R500 a month)'); await p.fill('#main .qcard input[data-p$=".premium"]', '1450'); await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/r20-servicing.png', fullPage: true });
  await p.selectOption('#main .qcard select[data-svpol]', ''); await p.waitForTimeout(200);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.quotes[0].onPolicy === null) && /ONE current policy/.test(await p.evaluate(() => document.querySelector('#checks').textContent)) && /Not tied to a policy yet/.test(await p.evaluate(() => document.querySelector('#main .svnote').textContent)), '4. with no policy chosen every line is new, the note and the Checks say to choose the ONE policy');
  await p.selectOption('#main .qcard select[data-svpol]', { index: 1 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.quotes[0].onPolicy && OV.app.state.blocks.svIncrease.quotes[0].onPolicy.number === '900100200'), '4. choosing the policy ties the quote to it again');
  await p.evaluate(() => { OV.app.go('svFna'); }); await p.waitForTimeout(100);
  ok(await p.evaluate(() => /Servicing FNA/.test(document.querySelector('#main h2').textContent) && document.querySelectorAll('#main table.svt').length === 1 && /The current policy re-quoted to full needs\./.test(document.querySelector('#main .svnote').textContent)), '4. the servicing FNA block draws the same card with its own meaning');

  await p.evaluate(() => { OV.app.go('svIncrease'); OV.app.openAll(); }); await p.waitForTimeout(100);
  await p.selectOption('#main .qcard select[data-svtype]', 'svreduction'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.quotes.length === 0 && OV.app.state.blocks.svReduction.quotes.some(q => q.number === '123456789' && q.kind === 'svreduction' && q.onPolicy.number === '900100200' && q.reason === 'A car loan added to the policy') && /Straight reduction/.test(document.querySelector('#main h2').textContent)), '4. the Type of servicing moves the quote to the other block with its policy and its reason, and the page follows it');
  await p.selectOption('#main .qcard:has-text("CP 123456789") select[data-svtype]', 'svincrease'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => OV.app.state.blocks.svIncrease.quotes.length === 1 && OV.app.state.blocks.svReduction.quotes.length === 3), '4. and back again');

  /* ---- 5. the other blocks: no line buttons, + Add ... at the bottom, a schedule not in the Fact Find ---- */
  const adds = {};
  for (const id of ['policies', 'fna', 'shortfallQuote', 'reduced', 'comparative', 'svShortfall', 'svReduced', 'svReduction', 'proposed', 'goals']) { await p.evaluate(i => OV.app.go(i), id); await p.waitForTimeout(40); adds[id] = await p.evaluate(() => [...document.querySelectorAll('#main [data-upc]')].map(x => x.textContent).join('|') + '#' + document.querySelectorAll('#main [data-addl], #main .xbtn').length); }
  ok(JSON.stringify(adds) === JSON.stringify({ policies: '+ Add policy schedule…#0', fna: '+ Add FNA quote…#0', shortfallQuote: '+ Add shortfall quote…#0', reduced: '+ Add reduced quote…#0', comparative: '+ Add comparative quote…#0', svShortfall: '+ Add servicing shortfall quote…#0', svReduced: '+ Add servicing reduced quote…#0', svReduction: '+ Add straight reduction quote…#0', proposed: '+ Add proposal…#0', goals: '+ Add goal report…#0' }), '5. a "+ Add ..." button ends every block and no block has a line button or an x: ' + JSON.stringify(adds));
  ok(await p.evaluate(() => { OV.app.go('policies'); OV.app.openAll(); return document.querySelectorAll('#main table.lines .xbtn, #main table.lines thead th:empty').length === 0; }), '5. the policies\' lines have no remove column');
  await p.evaluate(() => OV.app.ingest([new File(['%PDF-1.4 READ:nobody'], 'Nobody Policy Schedule.pdf', { type: 'application/pdf' })], { block: 'policies' })); await p.waitForTimeout(900);
  const nb = await p.evaluate(() => { const it = OV.app.state.blocks.policies.items.filter(i => i.notInFF)[0]; return it ? { ins: it.insurer, no: it.policyNo, ffKey: it.ffKey, mark: [...document.querySelectorAll('#main .rednote')].map(e => e.textContent).join('|'), count: OV.app.state.blocks.policies.items.length } : null; });
  ok(nb && nb.ins === 'Nobody Assurance' && nb.no === 'Z-9' && nb.ffKey === null && /Not in the Fact Find - add it there too/.test(nb.mark), '5. a schedule the Fact Find does not list is added to Current policies and marked in red "Not in the Fact Find - add it there too": ' + JSON.stringify(nb));
  await p.screenshot({ path: out + '/r20-policies.png', fullPage: true });

  /* ---- 6. the PDF: the same four headings ---- */
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/r20-overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const ids = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids), pg = id => ids.indexOf(id) + 1;
  const text = n => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']).toString();
  ok(['svFna', 'svIncrease', 'svReduction'].every(i => ids.includes(i)) && !ids.includes('svShortfall') && !ids.includes('svReduced') && ids.indexOf('shortfall') < ids.indexOf('svFna') && ids.indexOf('svReduction') < ids.indexOf('fna'), '6. the PDF has a page for each servicing block that holds a quote, none for the empty ones, between the shortfall and the new business pages: ' + ids.join(','));
  const t1 = text(pg('svIncrease'));
  ok(/Servicing your current policies/.test(t1) && /Where you are now/.test(t1) && /New business quotes/.test(t1), '6. every page carries the headings over its tabs');
  ok(/Straight increase/.test(t1) && /On: BrightRock 900100200/.test(t1) && /Reason: A car loan added to the policy/.test(t1) && /R1,000/.test(t1) && /R1,450/.test(t1) && /\+R450 a month \(\+45%\)/.test(t1) && !/Compared with what you have now/.test(t1), '6. the servicing page names the policy and the reason and prints the premium before and after');
  cp.execFileSync('pdftoppm', ['-r', '70', '-f', String(pg('svIncrease')), '-l', String(pg('svIncrease')), '-png', file, out + '/r20-pdf-servicing']);

  /* ---- 7. the Presentation ---- */
  await p.click('#btnPresent'); await p.waitForTimeout(250);
  const P = await p.evaluate(() => ({ heads: [...document.querySelectorAll('#pTabs .ptgh')].map(e => e.textContent), tabs: [...document.querySelectorAll('#pTabs .ptab')].map(t => t.textContent + ':' + (t.disabled ? 'off' : 'on')).join('|') }));
  ok(P.heads.join('|') === 'Where you are now|Servicing your current policies|New business quotes' && /Servicing quotes:on/.test(P.tabs), '7. the tabs sit under the headings, the servicing tab among them: ' + P.heads.join(' | ') + ' // ' + P.tabs);
  await p.evaluate(() => OV.present.go('svIncrease')); await p.waitForTimeout(200);
  const V = await p.evaluate(() => ({ title: document.querySelector('#pSlide h2.ptitle').textContent, chips: [...document.querySelectorAll('#pSlide .pchips.blk .pchip')].map(x => x.textContent), tab: document.querySelector('#pTabs .ptab.on').textContent, subs: [...document.querySelectorAll('#pSlide .psub')].map(x => x.textContent), repl: !!document.querySelector('#pSlide .replv, #pSlide [data-act=repl]') }));
  ok(V.title === 'Straight increase' && V.tab === 'Servicing quotes' && V.chips.join('|') === 'Servicing FNA|Straight increase|Straight reduction', '7. the Presentation shows the straight increase under the Servicing tab, with a small button for each servicing page that holds a quote: ' + JSON.stringify(V));
  ok(V.subs.join('|') === 'The quote|What changes on your policy|Underwriting and replacements'.replace('|Underwriting and replacements', '') || /What changes on your policy/.test(V.subs.join('|')), '7. its sub-tabs: ' + V.subs.join(' | '));
  await p.evaluate(() => OV.present.applyMoves([{ sub: 'cmpr' }])); await p.waitForTimeout(200);
  const T = await p.evaluate(() => document.querySelector('#pSlide').innerText.replace(/\s+/g, ' '));
  ok(/On BrightRock 900100200/.test(T) && /Why: A car loan added to the policy/.test(T) && /R1,000/.test(T) && /R1,450/.test(T) && /\+R450 a month/.test(T) && /New/.test(T) && !/will be replaced/.test(T), '7. "What changes on your policy": the policy, the reason, the old and the new, the premium: ' + T.slice(0, 200));
  await p.screenshot({ path: out + '/r20-present.png' });
  await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(250);
  const sc = await p.evaluate(() => { const m = /scale\(([\d.]+)\)/.exec(document.querySelector('#pSlide').style.transform); return m ? +m[1] : 0; });
  ok(sc >= 0.5, '7. the servicing page is drawn at a readable size at 1280x720 (scale ' + sc + ')');
  await p.screenshot({ path: out + '/r20-present-1280.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
