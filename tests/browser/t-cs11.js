// Investment Capture Sheet 1.1 on the real page: the files are named by the application file name rule (the same as the Short Risk Application's): the card "It saves as" follows the boxes, Save and Save PDF suggest the same name,
// the questionnaire's PDF keeps its own name, an older saved file opens as before and keeps its own name, and the longer name fits on a phone.
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'capture-sheet.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:' + srv.address().port + '/'); await p.waitForTimeout(300);
  const type = async (id, v) => { await p.fill('[data-f="' + id + '"]', v); await p.press('[data-f="' + id + '"]', 'Tab'); await p.waitForTimeout(80); };
  const pick = async (id, v) => {
    const sel = '[data-f="' + id + '"]';
    if (await p.evaluate(s => document.querySelector(s).tagName === 'SELECT', sel)) await p.selectOption(sel, v); else { await p.fill(sel, v); await p.press(sel, 'Tab'); }
    await p.waitForTimeout(80);
  };
  const card = () => p.evaluate(() => document.querySelector('#meta .fn').textContent);
  const fake = () => p.evaluate(() => {
    window.__sug = [];
    const handle = { name: 'saved.json', requestPermission: () => Promise.resolve('granted'), createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }), getFile: () => Promise.resolve({ text: () => Promise.resolve('') }) };
    window.showSaveFilePicker = o => { window.__sug.push(o && o.suggestedName); return Promise.resolve(handle); };
  });
  const EX1 = 'OM - Optimal RA Application - 20.11.26 - R 2,800.00 p.m. - (Anna Kuiper)';
  const setEx1 = async () => { await pick('provider', 'Old Mutual'); await pick('product', 'Retirement Annuity'); await type('product_name', 'OM Optimal RA - Recurring'); await pick('contrib_type', 'Recurring (monthly)'); await type('amount', '2800'); };

  /* the version, and a new sheet before anything is filled in: the missing parts read as what they are */
  ok(/Version 1\.1/.test(await p.evaluate(() => document.querySelector('#verLine').textContent)), 'the top says Version 1.1');
  ok(/^Provider - Product Application - \d\d\.\d\d\.\d\d - R amount - p\.m\. or Lump Sum - \(New client\)$/.test(await card()), 'a new sheet: the card says what is still missing: ' + await card());

  /* Paul's first example, built up box by box: the card follows each one */
  await type('fname', 'Anna'); await type('sname', 'Kuiper'); await type('date', '20/11/2026');
  ok(await card() === 'Provider - Product Application - 20.11.26 - R amount - p.m. or Lump Sum - (Anna Kuiper)', 'name and date: ' + await card());
  await pick('provider', 'Old Mutual');
  ok((await card()).startsWith('OM - Product Application'), 'Old Mutual is OM');
  await pick('product', 'Retirement Annuity');
  ok((await card()).startsWith('OM - RA Application'), 'the Product type gives RA: ' + await card());
  await type('product_name', 'OM Optimal RA - Recurring');
  ok((await card()).startsWith('OM - Optimal RA Application'), 'Old Mutual\'s own name gives Optimal RA: ' + await card());
  await pick('contrib_type', 'Recurring (monthly)'); await type('amount', '2800');
  ok(await card() === EX1, 'example 1, exactly: ' + await card());
  await p.screenshot({ path: out + '/cs11-card.png' });

  /* Paul's second example: a lump sum; a Section 14 transfer says Lump Sum too; another insurer is written out; Other uses the typed product; Xtra Max */
  await type('product_name', 'OM Tax Free Lumpsum'); await pick('product', 'Tax-Free Investment'); await pick('contrib_type', 'Lump sum'); await type('amount', '50000');
  ok(await card() === 'OM - Tax-Free Application - 20.11.26 - R 50,000.00 - Lump Sum - (Anna Kuiper)', 'example 2, exactly: ' + await card());
  await pick('contrib_type', 'Section 14 transfer');
  ok(await card() === 'OM - Tax-Free Application - 20.11.26 - R 50,000.00 - Lump Sum - (Anna Kuiper)', 'a Section 14 transfer reads Lump Sum too');
  await pick('provider', 'Allan Gray'); await pick('product', 'Other'); await type('product_name', 'Offshore Fund');
  ok(await card() === 'Allan Gray - Offshore Fund Application - 20.11.26 - R 50,000.00 - Lump Sum - (Anna Kuiper)', 'another insurer is written out, and for Other the typed product stands in: ' + await card());
  await pick('provider', 'Old Mutual'); await type('product_name', 'OM RA - Xtra Max 8.5%'); await pick('product', 'Retirement Annuity'); await pick('contrib_type', 'Recurring (monthly)'); await type('amount', '1234567.5');
  ok(await card() === 'OM - Xtra Max RA Application - 20.11.26 - R 1,234,567.50 p.m. - (Anna Kuiper)', 'Xtra Max RA, thousands commas and two decimals: ' + await card());

  /* the longer name fits: no sideways scroll on a phone, and the card holds it */
  for (const w of [390, 800]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'at ' + w + ' wide the page does not scroll sideways');
    const fits = await p.evaluate(() => { const f = document.querySelector('#meta .fn'), m = document.querySelector('#meta'); return f.getBoundingClientRect().right <= m.getBoundingClientRect().right + 1 && f.scrollWidth <= f.clientWidth + 1; });
    ok(fits, 'at ' + w + ' wide the card holds the whole name');
  }
  await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(150);

  /* Save and Save PDF suggest the same name; the questionnaire's PDF keeps its own (after a save the sheet keeps the name it was saved under, so this comes last) */
  await setEx1();
  ok(await card() === EX1, 'back to example 1: ' + await card());
  await fake(); await p.click('#btnSave'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__sug[0]) === EX1 + '.json', 'Save suggests: ' + await p.evaluate(() => window.__sug[0]));
  await fake(); await p.click('#btnPdf'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__sug[0]) === EX1 + '.pdf', 'Save PDF suggests the same name with .pdf: ' + await p.evaluate(() => window.__sug[0]));
  await p.click('.nav button[data-page="risk"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.rtfile').innerText.includes('Risk Tolerance - 20.11.26 - (Anna Kuiper).pdf')), 'the questionnaire\'s PDF keeps its own name');

  /* an older saved file (1.0) opens as before, keeps its own name, and a new sheet is named by the new rule */
  const old = await p.evaluate(() => { const j = JSON.parse(CS.store.toJSON(CS.app.state)); j.schema = '1.0'; return JSON.stringify(j); });
  await p.evaluate(() => document.querySelector('#btnNew').click()); await p.waitForTimeout(300);
  ok(/^Provider - Product Application/.test(await card()), 'a new sheet after New starts with the new rule: ' + await card());
  await p.setInputFiles('#fileIn', { name: 'OM Capture Sheet - 12.11.26 - (Anna Kuiper).json', mimeType: 'application/json', buffer: Buffer.from(old) }); await p.waitForTimeout(500);
  const opened = await p.evaluate(() => ({ f: CS.app.state.f, schema: CS.app.state.schema }));
  ok(opened.f.fname.v === 'Anna' && opened.f.provider.v === 'Old Mutual' && opened.f.product_name.v === 'OM Optimal RA - Recurring' && /2\s?800/.test(opened.f.amount.v), 'an older file opens with its answers');
  ok(await card() === 'OM Capture Sheet - 12.11.26 - (Anna Kuiper)', 'and keeps its own name when saved again: ' + await card());

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
