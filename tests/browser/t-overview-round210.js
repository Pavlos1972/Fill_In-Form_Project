/* Client Overview Studio 2.1 (25 November, Paul's answers relayed by the Fix Skills chat at 18:36). A real folder tree of an invented client ("Test, Sia") named the new BrightRock way:  BR <Type> - <quote no> - R<premium> - dd.mm.yy - (<Initials Surname>)  with a
   signed copy ending  - SIGNED. Checked on the real page: (1) the pick list: a Serv Increase loose in 3. Quotes is a straight increase, a Serv Decrease in a policy folder's review folder is a straight reduction tied to the policy, BR Quote is a comparative quote, the CMPO with the
   quote's number is a pay-out guide, a signed copy beside its unsigned quote is NOT ticked (and is never sent to the reading), a signed copy that is the only copy IS ticked; (2) what Load put where; (3) the PDF: the five pages of Where the client is now always, a quote page only with a
   quote, a heading only when a page sits under it; (4) an overview with NO quotes at all: the five pages each say so in one line, in the PDF and in the Presentation, and the Presentation's quote tabs are greyed; nothing is written to the folders. Screenshots (deviceScaleFactor 2): r21-*. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
function pdf(t) {
  let body = '%PDF-1.4\n'; const offs = [], add = s => { offs.push(body.length); body += offs.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'); const c = 'BT /F1 26 Tf 50 760 Td (' + t + ') Tj ET'; add('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
  const x = body.length; body += 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return body;
}
const one = t => pdf('READ:' + t);
const TREE = {
  NB: { 'Test, Sia': {
      '1. Overview': {}, '2. Fact Find': {}, '6. Policy Schedules': {},
      '3. Quotes': {
        'BR FNA - 100000301 - R2,900.00 - 05.01.27 - (S Test).pdf': one('fna'),
        'BR FNA - 100000301 - R2,900.00 - 05.01.27 - (S Test) - SIGNED.pdf': one('fna'),
        'BR CMPO - 100000301 - R2,900.00 - 05.01.27 - (S Test).pdf': one('cmpo'),
        'BR Quote - 100000302 - R1,900.00 - 05.01.27 - (S Test).pdf': one('cq'),
        'BR Reduced - 100000303 - R1,400.00 - 05.01.27 - (S Test) - SIGNED.pdf': one('red'),
        'BR Serv Increase - 100000304 - R1,450.00 - 05.01.27 - (S Test).pdf': one('svinc') },
      'BR Personal Covers - 900100200': {
        'Policy Schedules': { '2026': { 'BR Policy Summary 01.06.26.pdf': one('sched') } },
        'Comparative Quotes': { '2027 - Review': {
          'BR Serv Decrease - 100000305 - R900.00 - 05.01.27 - (S Test).pdf': one('svdec'),
          'BR Serv Decrease - 100000305 - R900.00 - 05.01.27 - (S Test) - SIGNED.pdf': one('svdec'),
          'BR Serv Increase - 100000306 - R1,500.00 - 20.12.26 - (S Test).pdf': one('svinc2'),
          'BR Serv Increase - 100000307 - R1,600.00 - 05.01.27 - (S Test).pdf': one('svinc3') } } } },
    '1. ON HOLD': {}, '2. Awaiting compliance from client': {} },
  CF: { 'T - Files': {} }
};
const v = x => ({ v: x });
const FFJ = { app: 'wr-fact-find', schema: '5.5', f: { fname: v('Sia'), sname: v('Test'), net: v('R 60 000.00'), ip_age: v('65'), date: v('10/11/2026') },
  l: { kids: [], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 8 000.00', bal: 'R 900 000.00' } }], risk: [{ d: { prov: 'BrightRock', spend: 'R 1 000.00', broker: 'Paul K' } }], grp: [], ret_pp: [], ret_ra: [], inv: [] } };
const L = (type, lump, monthly, o) => Object.assign({ type, life: { lump, monthly }, abi: type === 'household' ? 5 : 0 }, o || {});
const base = (no, prem, lines) => ({ insurer: 'BrightRock', number: no, date: '05/01/2027', rates: 'Non-smoker rates', aci: 10, premium: prem, lines });
const READS = {
  sched: { insurer: 'BrightRock', product: 'Personal covers', policyNo: '900100200', doc: '01/06/2026', premium: 1000, aci: 10, lines: [L('household', 500000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })] },
  fna: base('100000301', 2900, [L('household', 800000, 0)]),
  cq: base('100000302', 1900, [L('household', 600000, 0)]),                                              // a real BR Quote is a BrightRock quote
  red: base('100000303', 1400, [L('household', 400000, 0)]),
  svinc: base('100000304', 1450, [L('household', 700000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })]),
  svdec: base('100000305', 900, [L('household', 400000, 0), L('debt', 900000, 8000, { debt: 'Home loan', bank: 'Test Bank' })]),
  svinc2: base('100000306', 1500, [L('household', 650000, 0)]),
  svinc3: base('100000307', 1600, [L('household', 750000, 0)]),
  cmpo: { number: '100000301', activationDate: '01/01/2027', rows: [{ key: 'total', today: 30000, projected: 80000, payoutDate: null }] }
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
  const waitDone = pg => pg.waitForFunction(() => !document.querySelector('#nav .prog:not([hidden]).reading, #nav .prog:not([hidden]).searching, #nav .prog:not([hidden]).waiting, #nav .prog:not([hidden]).checking'), null, { timeout: 60000 });
  const text = (file, n) => cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', file, '-']).toString();

  /* ---- 1. an overview with NO quote at all: the five pages of Where the client is now still print, each with its one line ---- */
  await p.evaluate(() => { const s = OV.store.blank(); s.header.fname = 'Sia'; s.header.sname = 'Test'; s.header.overviewDate = '05/01/2027'; OV.app.setState(s); OV.app.openAll(); });
  const b0 = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const f0 = out + '/r21-empty.pdf'; fs.writeFileSync(f0, Buffer.from(b0));
  const ids0 = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids);
  ok(ids0.join(',') === 'cover,policies,group,investments,other,shortfall', '1. an empty overview prints the cover and the five pages of Where the client is now, and no quote page: ' + ids0.join(','));
  const pdfText0 = ids0.map((id, i) => text(f0, i + 1).replace(/\s+/g, ' '));
  ok(/There are no current policies in place\./.test(pdfText0[1]) && /There are no group benefits in place\./.test(pdfText0[2]) && /There are no personal investments in place\./.test(pdfText0[2]) && /There are no current investments in place\./.test(pdfText0[3]) && /No medical aid, gap cover, will, legacy plan or short-term insurance is recorded\./.test(pdfText0[4]) && /There is no FNA quote yet, so the shortfall cannot be worked out\./.test(pdfText0[5]), '1. each of the five pages says so in plain words');
  ok(pdfText0.every(t => /Where you are now/.test(t) && !/New business quotes|Servicing your current policies|Investments & goals/.test(t)), '1. only the heading that has a page under it is drawn (Where you are now)');
  cp.execFileSync('pdftoppm', ['-r', '60', '-f', '2', '-l', '2', '-png', f0, out + '/r21-pdf-empty']);
  await p.click('#btnPresent'); await p.waitForTimeout(300);
  const P0 = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#pTabs .ptab')].map(t => t.textContent + ':' + (t.disabled ? 'off' : 'on')).join('|') }));
  ok(P0.tabs === 'Overview:on|Current policies:on|Group benefits:on|Investments:on|Other:on|Shortfall:on', '1. the Presentation: the five tabs of Where the client is now are open; with no quote at all the headings of the quote pages are not shown: ' + P0.tabs);
  await p.evaluate(() => OV.present.go('other')); await p.waitForTimeout(250);
  const O0 = await p.evaluate(() => document.querySelector('#pSlide').innerText.replace(/\s+/g, ' '));
  ok(/Medical aid/.test(O0) && /This was not discussed in our last meeting\./.test(O0), '1. the Medical aid, will & short-term page of an empty overview still opens and says each cover was not discussed: ' + O0.slice(0, 160));
  await p.evaluate(() => OV.present.go('policies')); await p.waitForTimeout(200);
  ok(/There are no current policies in place\./.test(await p.evaluate(() => document.querySelector('#pSlide').innerText)), '1. and so does Current policies');
  await p.screenshot({ path: out + '/r21-present-empty.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(250); if (await p.evaluate(() => OV.present.isOpen)) { await p.click('#pBtnClose'); await p.waitForTimeout(200); }

  /* ---- 2. Load from client folder: the pick list reads the new names ---- */
  await p.evaluate(ff => { const s = OV.store.blank(); OV.store.fillFromFactFind(s, JSON.stringify(ff), 'ff.json'); OV.schema.NEED_BLOCKS.forEach(id => OV.store.setNeeded(s, id, true)); OV.app.setState(s); OV.app.openAll(); window.__tracking = true; window.__writes = 0; window.__api = []; }, FFJ);
  await p.click('#btnReadFolder'); await p.waitForSelector('dialog.fdlg[open] .flist .pkh');
  const L1 = await p.evaluate(() => {
    const d = document.querySelector('dialog.fdlg[open]'), res = { rows: [] };
    [...d.querySelectorAll('.flist > *')].forEach(e => { if (e.tagName === 'LABEL') res.rows.push({ t: e.textContent.replace(/\s+/g, ' ').trim(), on: e.querySelector('input').checked }); });
    return res;
  });
  const row = re => L1.rows.filter(r => re.test(r.t))[0] || null;
  const fna = row(/BR FNA - 100000301 - R2,900\.00 - 05\.01\.27 - \(S Test\)\.pdf/), fnaS = row(/BR FNA - 100000301 .* - SIGNED/), cmpo = row(/BR CMPO - 100000301/), cq = row(/BR Quote - 100000302/), red = row(/BR Reduced - 100000303 .* - SIGNED/), inc = row(/BR Serv Increase - 100000304/), dec = row(/BR Serv Decrease - 100000305/);
  ok(fna && fna.on && /FNA quote/.test(fna.t) && !/Servicing/.test(fna.t), '2. BR FNA in 3. Quotes is the FNA quote, ticked: ' + (fna && fna.t));
  ok(fnaS && !fnaS.on && /signed copy: the quote itself is in the list and is the one read, so this is not ticked/.test(fnaS.t), '2. the SIGNED copy beside it is listed, NOT ticked, and says why: ' + (fnaS && fnaS.t));
  ok(cmpo && cmpo.on && /Change moment pay-out guide/.test(cmpo.t), '2. BR CMPO with the same quote number is the pay-out guide, ticked: ' + (cmpo && cmpo.t));
  ok(cq && cq.on && /Comparative quote/.test(cq.t), '2. BR Quote is a comparative quote, ticked: ' + (cq && cq.t));
  ok(red && red.on && /Reduced quote/.test(red.t) && /the only copy of this quote/.test(red.t), '2. a SIGNED copy that is the only copy is ticked and says so: ' + (red && red.t));
  ok(inc && inc.on && /Straight increase quote/.test(inc.t), '2. BR Serv Increase loose in 3. Quotes is a straight increase quote, ticked: ' + (inc && inc.t));
  ok(dec && dec.on && /Straight reduction quote/.test(dec.t), '2. BR Serv Decrease in the policy folder\'s review folder is a straight reduction quote, ticked: ' + (dec && dec.t));
  const inc6 = row(/BR Serv Increase - 100000306/), inc7 = row(/BR Serv Increase - 100000307/), decS = row(/BR Serv Decrease - 100000305 .* - SIGNED/);
  ok(inc7 && inc7.on && inc6 && !inc6.on && /older date/.test(inc6.t), '2. two Serv Increase quotes of one policy: only the newest by the date in the name is ticked, the older says so (Paul: newest only): ' + (inc6 && inc6.t));
  ok(decS && !decS.on && /paperwork about a change/.test(decS.t), '2. a SIGNED copy inside the policy folder\'s review folder is paperwork there (Paul, 25 November: never ticked, even when it is the only copy): ' + (decS && decS.t));
  await p.screenshot({ path: out + '/r21-list.png' });
  await p.click('dialog.fdlg [data-yes]'); await waitDone(p); await p.waitForTimeout(900);

  /* ---- 3. what Load put where ---- */
  const S = await p.evaluate(() => { const s = OV.app.state, q = b => s.blocks[b].quotes.filter(x => !x.removed).map(x => ({ n: x.number, k: x.kind, tie: x.onPolicy && x.onPolicy.number, cmp: x.cmp ? x.cmp.rows.length : 0 })); return { fna: q('fna'), red: q('reduced'), cmp: q('comparative'), inc: q('svIncrease'), dec: q('svReduction'), sf: q('shortfallQuote'), svf: q('svFna'), reads: window.__api.map(t => /READ:(\w+)/.exec(t)[1]).sort().join(','), w: window.__writes }; });
  ok(S.fna.length === 1 && S.fna[0].n === '100000301' && S.fna[0].cmp === 1, '3. one FNA quote, with its pay-out guide read into it (the guide follows the quote number): ' + JSON.stringify(S.fna));
  ok(S.red.length === 1 && S.red[0].n === '100000303' && S.cmp.length === 1 && S.cmp[0].n === '100000302', '3. the signed-only Reduced quote was read, and the BR Quote is the comparative quote: ' + JSON.stringify([S.red, S.cmp]));
  ok(S.inc.length === 2 && S.inc.some(x => x.n === '100000304' && x.tie === null) && S.inc.some(x => x.n === '100000307' && x.tie === '900100200') && S.dec.length === 1 && S.dec[0].n === '100000305' && S.dec[0].tie === '900100200', '3. the loose Serv Increase is in Straight increase tied to no policy yet, the newest Serv Increase of the policy folder is tied to 900100200 (the older one was not loaded); the Serv Decrease is in Straight reduction tied to policy 900100200: ' + JSON.stringify([S.inc, S.dec]));
  ok(S.reads.split(',').filter(x => x === 'fna').length === 1, '3. the signed FNA copy was never sent to the reading (one FNA reading in all): ' + S.reads);
  ok(S.sf.length === 0 && S.svf.length === 0 && S.w === 0, '3. no shortfall or servicing FNA quote; nothing was created, written or removed in any folder (' + S.w + ' writes)');

  const CQ = await p.evaluate(() => { OV.app.go('comparative'); OV.app.openAll(); const c = document.querySelector('#main .qcard'); return { card: c ? c.innerText.replace(/\s+/g, ' ').slice(0, 220) : '', checks: [...document.querySelectorAll('#checks .chk, #checks li')].map(x => x.textContent.replace(/\s+/g, ' ')).filter(t => /comparative|CP 100000302|100000302/i.test(t)).join(' | '), dot: (document.querySelector('[data-dot=comparative]') || {}).className }; });
  ok(/BrightRock/.test(CQ.card) && /100000302/.test(CQ.card), '3. a BrightRock BR Quote is drawn as a comparative quote card: ' + CQ.card);
  console.log('INFO the comparative quote\'s checks: ' + (CQ.checks || '(none)') + ' / dot ' + CQ.dot);
  ok(!/pay-out guide|change moment/i.test(CQ.checks), '3. a BrightRock comparative quote is not blamed for a missing change moment pay-out guide: ' + CQ.checks);

  /* ---- 4. the PDF: a quote page only with a quote ---- */
  const bytes = await p.evaluate(() => Array.from(new Uint8Array(OV.app.makePdf().output('arraybuffer'))));
  const file = out + '/r21-overview.pdf'; fs.writeFileSync(file, Buffer.from(bytes));
  const ids = await p.evaluate(() => OV.pdf.pagesOf(OV.app.state).ids);
  ok(ids.join(',') === 'cover,policies,group,investments,other,shortfall,svIncrease,svReduction,fna,reduced,comparative', '4. the PDF has the five pages of Where the client is now, the two servicing pages that hold a quote and the three new business pages that hold one; no Servicing FNA, Servicing shortfall, Servicing reduced or Shortfall quote page: ' + ids.join(','));
  const t1 = text(file, ids.indexOf('svIncrease') + 1).replace(/\s+/g, ' ');
  ok(/Where you are now/.test(t1) && /Servicing your current policies/.test(t1) && /New business quotes/.test(t1) && !/Investments & goals/.test(t1), '4. the three headings that have pages are drawn, the fourth (no page under it) is not');
  cp.execFileSync('pdftoppm', ['-r', '60', '-f', String(ids.indexOf('fna') + 1), '-l', String(ids.indexOf('fna') + 1), '-png', file, out + '/r21-pdf-fna']);

  /* ---- 5. the Presentation and the menu with quotes ---- */
  await p.click('#btnPresent'); await p.waitForTimeout(300);
  const P1 = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#pTabs .ptab')].map(t => t.textContent + ':' + (t.disabled ? 'off' : 'on')).join('|') }));
  ok(/Servicing quotes:on/.test(P1.tabs) && /FNA quote:on/.test(P1.tabs) && /Reduced quotes:on/.test(P1.tabs) && !/Proposed investments|Goal analysis/.test(P1.tabs), '5. with quotes the Presentation opens the servicing and the new business tabs; the Investments & goals heading (nothing under it) is still not shown: ' + P1.tabs);
  await p.screenshot({ path: out + '/r21-present.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
