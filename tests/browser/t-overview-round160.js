/* Client Overview Studio 1.6 (25 November, Paul's answers relayed by the Fix Skills chat at 13:02): "look in the latest year folder as the first port of call. If that's not present, then look at what is the latest review documents" and "only latest for the same
   policy number / schedule". A real folder tree of an invented client ("Test, Dora") with a MIXED set of folders: a numbered quotes folder with 2026 and 2024 review folders and loose files, a policy folder with its own review folder, a policy folder with only a
   2024 review folder, comparative quotes loose and in review folders, a policy folder holding two schedules of different products. Checked in the page's own pick list and in what Load sends to Anthropic: for every kind of quote only the newest year's are ticked
   (the others say why), the same file name in two year folders is two files, (1.7, Paul's answer of 25 November 14:52) a kind with no year folder ticks only the newest by the date in its name and keeps all ticked when none has a date, a pay-out guide follows its quote, a document in a Review folder is a review document and never a schedule or a current investment,
   one schedule per policy folder (the newest), and nothing is written (a counter on the folder calls). Screenshot (deviceScaleFactor 2): r16-list. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(pages) {                                                                                        // a small valid PDF: one line of big text on every page
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [' + pages.map((_, i) => (4 + i * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((t, i) => { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET\nBT /F1 13 Tf 50 725 Td (Invented document for the pick list test) Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'); });
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const one = t => pdf([t]);
const TREE = {
  NB: { 'Test, Dora': {
      '1. Overview': {}, '2. Fact Find': {},
      '3. Quotes': {
        'Reduced Quote 02.02.25.pdf': one('Reduced quote loose 2025'), 'Shortfall Quote 03.03.24.pdf': one('Shortfall quote 2024'), 'Shortfall Quote 10.01.26.pdf': one('Shortfall quote 2026'), 'Shortfall Quote Draft.pdf': one('Shortfall quote draft undated'),
        'Retirement Annuity Proposal A.pdf': one('Proposal RA undated'), 'Tax Free Proposal B.pdf': one('Proposal TFSA undated'),
        '2026 - Review': { 'FNA CP 400500602.pdf': one('FNA numbered quote 2026 CP 400500602'), 'FNA Quote.pdf': one('FNA quote 2026'), 'Reduced Quote.pdf': one('Reduced quote 2026') },
        '2024 - Review': { 'BR CMPO - 400500601.pdf': one('Guide 2024 CP 400500601'), 'RGAR Report 2024.pdf': one('RGAR report 2024'), 'FNA CP 400500601.pdf': one('FNA numbered quote 2024 CP 400500601'), 'FNA Quote.pdf': one('FNA quote 2024'), 'Reduced Quote.pdf': one('Reduced quote 2024') } ,
        'BR CMPO - 400500602.pdf': one('Guide 2026 CP 400500602') },
      '6. Policy Schedules': {},
      'Coronation RA - 458899': { 'Policy Schedules': { '2026': { 'Statement 31.03.26.pdf': one('Coronation statement 31.03.26') } }, 'Annual Review Statements': { 'Statement 31.12.25.pdf': one('Coronation statement 31.12.25') },
        '2026 - Review': { 'RA Review 2026.pdf': one('RA review document 2026'), 'Review Summary 2026.pdf': one('Review summary 2026'), 'Charts': { 'Review Letter 2026.pdf': one('Review letter 2026') } },
        'Comparative Quotes': { '2026 - Review': { 'Coronation RA Quote 2026.pdf': one('Coronation comparative quote 2026') }, '2024 - Review': { 'Old Mutual Quote 12.03.24.pdf': one('Old Mutual comparative quote 2024') } } },
      'Sanlam Invest - 889977': { 'Policy Schedules': { '2025': { 'Invest PS 31.12.25.pdf': one('Sanlam invest schedule 2025') }, '2026': { 'UT PS 31.03.26.pdf': one('Sanlam unit trust schedule 2026') } },
        '2024 - Review': { 'Sanlam Quote 2024.pdf': one('Sanlam comparative quote 2024') } },
      'Discovery Life - 8877665': { 'Comparative Quotes': { 'Discovery Quote 08.03.26.pdf': one('Discovery comparative quote 2026'), 'Hollard Quote.pdf': one('Hollard comparative quote undated') } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'T - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Dora'), sname: v('Test'), net: v('R 90 000.00'), ip_age: v('65'), date: v('20/11/2026') },
  l: { kids: [], debts: [], risk: [{ d: { prov: 'Discovery', spend: 'R 2 000.00', broker: 'Paul K' } }],
    ret_ra: [{ d: { prov: 'Coronation', status: 'Current', val: 'R 100 000.00', contrib: 'R 1 000.00', broker: 'Paul K' } }, { d: { prov: 'Sanlam', status: 'Current', val: 'R 90 000.00', contrib: 'R 900.00', broker: 'Paul K' } }], ret_pp: [], inv: [] } };

srv.listen(0, async () => {
  const addr = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const init = () => {
    window.__api = []; window.__writes = 0;
    const DP = FileSystemDirectoryHandle.prototype, FP = FileSystemFileHandle.prototype, gd = DP.getDirectoryHandle, gf = DP.getFileHandle, re = DP.removeEntry, cw = FP.createWritable;
    DP.getDirectoryHandle = function (n, o) { if (o && o.create) window.__writes++; return gd.call(this, n, o); }; DP.getFileHandle = function (n, o) { if (o && o.create) window.__writes++; return gf.call(this, n, o); };
    DP.removeEntry = function (n, o) { if (window.__tracking) window.__writes++; return re.call(this, n, o); }; FP.createWritable = function (o) { if (window.__tracking) window.__writes++; return cw.call(this, o); };
    window.showDirectoryPicker = async o => { const h = window.__rootsById && window.__rootsById[o.id]; if (!h) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; } return h; };
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body), c0 = body.messages[0].content[0];
      if (c0.type === 'document' || (c0.source && c0.source.data)) window.__api.push(atob(c0.source.data));
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 5, output_tokens: 5 } }) });
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
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 }); await ctx.addInitScript(init);
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
  await p.evaluate(ff => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); OV.app.setState(s); OV.app.openAll(); window.__tracking = true; window.__writes = 0; }, FFJ);
  const waitDone = pg => pg.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  const L = await p.evaluate(() => {
    const d = document.querySelector('dialog.fdlg[open]'), out = { heads: [], rows: [] };
    [...d.querySelectorAll('.flist > *')].forEach(e => { if (e.classList.contains('pkh')) { out.cur = e.querySelector('b').textContent; out.heads.push(out.cur); } else if (e.tagName === 'LABEL') out.rows.push({ g: out.cur || '', t: e.textContent.replace(/\s+/g, ' ').trim(), on: e.querySelector('input').checked }); });
    return out;
  });
  const oth = L.rows.filter(r => r.g === 'Other documents'), grp = n => L.rows.filter(r => r.g.indexOf(n) === 0), find = (rows, re) => rows.filter(r => re.test(r.t));
  const one1 = (rows, re) => { const f = find(rows, re); return f.length === 1 ? f[0] : null; };
  const brief = rows => rows.map(r => (r.on ? '[x] ' : '[ ] ') + r.t.slice(0, 90)).join(' | ');

  /* ---- 1. every kind of quote: the newest year folder first ---- */
  const fna26 = one1(oth, /2026 - Review \\ FNA Quote\.pdf/), fna24 = one1(oth, /2024 - Review \\ FNA Quote\.pdf/);
  ok(fna26 && fna24, '1. the same file name FNA Quote.pdf in two year folders is TWO files in the list: ' + find(oth, /FNA Quote/).length + ' rows');
  ok(fna26 && fna24 && fna26.on && !fna24.on && /older year \(2024\): not ticked, the newest is 2026/.test(fna24.t), '1. FNA quotes: 2026 - Review ticked, 2024 - Review not, and it says why: ' + (fna24 && fna24.t));
  const red26 = one1(oth, /2026 - Review \\ Reduced Quote\.pdf/), red24 = one1(oth, /2024 - Review \\ Reduced Quote\.pdf/), red25 = one1(oth, /Reduced Quote 02\.02\.25\.pdf/);
  ok(red26 && red26.on && red24 && !red24.on && red25 && !red25.on && /older year \(2025\)/.test(red25.t), '1. reduced quotes: the 2026 review folder is ticked, the 2024 one and a loose 2025 file are not: ' + [red26 && red26.on, red24 && red24.on, red25 && red25.on].join(', '));
  const sf24 = one1(oth, /Shortfall Quote 03\.03\.24/), sf26 = one1(oth, /Shortfall Quote 10\.01\.26/);
  const sfd = one1(oth, /Shortfall Quote Draft/);
  ok(sf24 && sf26 && sf26.on && !sf24.on && /older date \(03\/03\/2024\): not ticked, the newest is 10\/01\/2026/.test(sf24.t), '1.7. a kind with NO year folder anywhere: only the NEWEST BY THE DATE IN ITS NAME is ticked (Paul, 25 November): the 2026 shortfall quote yes, the 2024 one no, and it says why: ' + (sf24 && sf24.t));
  ok(sfd && !sfd.on && /no date in its name, and a dated one exists: not ticked/.test(sfd.t), '1.7. a shortfall quote with no date loses to the dated ones: ' + (sfd && sfd.t));
  const pa = one1(oth, /Retirement Annuity Proposal A/), pb = one1(oth, /Tax Free Proposal B/);
  ok(pa && pb && pa.on && pb.on && !/not ticked/.test(pa.t + pb.t), '1.7. a kind with no year folder and no date at all (two loose proposals) keeps both ticked: ' + [pa && pa.on, pb && pb.on].join(', '));
  const g26 = one1(oth, /BR CMPO - 400500602/), g24 = one1(oth, /BR CMPO - 400500601/);
  ok(g26 && g26.on && g24 && !g24.on && /guide of an older quote/.test(g24.t) && !/no year/.test(g26.t), '1. a change moment pay-out guide only follows its quote (its name carries no date): the current guide loose in 3. Quotes is ticked, the guide of the 2024 quote in 2024 - Review is not: ' + [g26 && g26.on, g24 && g24.on].join(', ') + ' (' + (g24 && g24.t.slice(-60)) + ')');

  const rg = one1(oth, /2024 - Review \\ RGAR Report 2024/);
  ok(rg && rg.on, '1. DELIBERATE: the rule is per kind, so a goal analysis report that exists only in 2024 - Review is the newest of its kind and is ticked although 2026 - Review exists for other kinds: ' + (rg && rg.t));

  /* ---- 2. comparative quotes: one newest year for the whole client; a review folder inside a policy folder is read by its folder ---- */
  const cq26 = one1(oth, /Coronation RA Quote 2026/), cq24 = one1(oth, /Old Mutual Quote 12\.03\.24/), dq = one1(oth, /Discovery Quote 08\.03\.26/), hq = one1(oth, /Hollard Quote\.pdf/), sq = one1(oth, /Sanlam Quote 2024/);
  ok(cq26 && cq26.on && cq24 && !cq24.on && /older year \(2024\)/.test(cq24.t), '2. comparative quotes in Comparative Quotes\\2026 - Review and \\2024 - Review: only the 2026 one is ticked: ' + [cq26 && cq26.on, cq24 && cq24.on].join(', '));
  ok(dq && dq.on && /Comparative quote/.test(dq.t), '2. a comparative quote with no year folder but 2026 in its name is the newest year too, so ticked: ' + (dq && dq.t));
  ok(hq && !hq.on && /no year found in its folder or name, and 2026 exists: not ticked/.test(hq.t), '2. a comparative quote with no year at all is NOT ticked while a year folder exists elsewhere: ' + (hq && hq.t));
  ok(sq && !sq.on && /older year \(2024\)/.test(sq.t) && /Comparative quote/.test(sq.t), '2. a policy folder with only a 2024 - Review folder: its document is a comparative quote of 2024, listed, not ticked (client-wide the newest year is 2026): ' + (sq && sq.t));
  const rv = one1(oth, /2026 - Review \\ RA Review 2026\.pdf/), rs = one1(oth, /2026 - Review \\ Review Summary 2026/), rl = one1(oth, /Charts \\ Review Letter 2026/);
  ok(rv && /Comparative quote/.test(rv.t) && !/Current investments/.test(rv.t) && !rv.on && /in a Review folder: not ticked, tick it if it is a quote/.test(rv.t), '2. a document in the Coronation folder\'s own review folder (its name has RA in it) is listed as a review document (a comparative quote by its folder, never a current investment) and is NOT ticked: nothing says it is a quote: ' + (rv && rv.t));
  ok(rs && rl && !rl.on && !L.rows.some(r => /Coronation RA - 458899/.test(r.g) && / - Review/.test(r.t)), '2. the review documents are among the Other documents, not in the Coronation group, so none can be its statement; one that says nothing (Review Letter) is listed and not ticked: ' + [rs && rs.t.slice(0, 70), rl && rl.t.slice(0, 70)].join(' / '));

  /* ---- 3. one schedule per policy folder: the newest ---- */
  const sl = grp('Sanlam Invest');
  ok(sl.length === 2 && sl.filter(r => r.on).length === 1 && /UT PS 31\.03\.26\.pdf \(newest/.test(sl.filter(r => r.on)[0].t) && /older/.test(sl.filter(r => !r.on)[0].t) && /Invest PS 31\.12\.25/.test(sl.filter(r => !r.on)[0].t), '3. two schedules of different products in one policy folder: only the newest (UT PS 2026) is ticked, the Invest PS of 2025 says older: ' + brief(sl));
  const co = grp('Coronation RA');
  ok(co.length === 2 && co.filter(r => r.on).length === 1 && /Statement 31\.03\.26\.pdf \(newest/.test(co.filter(r => r.on)[0].t) && co.some(r => /Annual Review Statements \\ Statement 31\.12\.25/.test(r.t) && !r.on), '3. the Coronation group holds its two statements (a folder called Annual Review Statements is a statements folder, not a review folder) and only the newest is ticked; the review documents are not in it: ' + brief(co));
  await p.screenshot({ path: out + '/r16-list.png' });

  /* ---- 4. Load: what is ticked is read, what is not is not ---- */
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(800);
  const api = await p.evaluate(() => window.__api.slice());
  const sent = k => api.some(t => t.indexOf(k) >= 0);
  ok(sent('FNA quote 2026') && sent('FNA numbered quote 2026') && sent('Reduced quote 2026') && sent('Guide 2026') && sent('Shortfall quote 2026') && sent('Proposal RA undated') && sent('Proposal TFSA undated') && sent('Coronation comparative quote 2026') && sent('Discovery comparative quote 2026') && sent('RGAR report 2024'), '4. the ticked documents were sent for reading: ' + api.length + ' document(s)');
  ok(!sent('FNA quote 2024') && !sent('FNA numbered quote 2024') && !sent('Reduced quote 2024') && !sent('Reduced quote loose 2025') && !sent('Guide 2024') && !sent('Old Mutual comparative quote 2024') && !sent('Sanlam comparative quote 2024') && !sent('Hollard comparative quote undated') && !sent('RA review document 2026') && !sent('Shortfall quote 2024') && !sent('Shortfall quote draft undated'), '4. the documents that were not ticked were NOT sent to Anthropic (the 2024 and 2025 quotes, the 2024 guide, the quote with no year, the 2024 shortfall quote and the undated shortfall draft)');
  ok(!sent('Review summary 2026') && !sent('Review letter 2026') && !sent('Sanlam invest schedule 2025'), '4. a review summary, a review letter and the older Sanlam schedule were not sent');
  const cards = await p.evaluate(() => OV.app.state.blocks.comparative.quotes.map(q => q.src && q.src.file));
  ok(cards.indexOf('RA Review 2026.pdf') < 0 && cards.indexOf('Review Summary 2026.pdf') < 0, '4. no quote card was made from a review document: the comparative quotes read are ' + cards.join(', '));
  const w = await p.evaluate(() => window.__writes);
  ok(w === 0, '4. nothing was created, written or removed in any folder (a counter on the browser\'s folder calls: ' + w + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
