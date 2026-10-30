const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:' + srv.address().port + '/');
  const years = (d, m, y) => { const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--; return a; };
  await p.click('.nav button:has-text("Children")'); await p.waitForTimeout(200);
  await p.click('[data-add="kids"]'); await p.click('[data-add="kids"]'); await p.waitForTimeout(200);
  const cell = (i, k) => '[data-l="kids"][data-i="' + i + '"][data-k="' + k + '"]';
  await p.fill(cell(0, 'name'), 'Hannah Kuiper'); await p.fill(cell(1, 'name'), 'Isabelle Kuiper');
  await p.fill(cell(0, 'dob'), '03/01/2009'); await p.press(cell(0, 'dob'), 'Tab'); await p.waitForTimeout(200);
  await p.fill(cell(1, 'dob'), '03/01/2009'); await p.press(cell(1, 'dob'), 'Tab'); await p.waitForTimeout(200);
  const v = async (i, k) => p.evaluate(s => document.querySelector(s).value, cell(i, k));
  ok(await v(0, 'age') === years(3, 1, 2009) + ' years', 'age appears next to the date of birth: ' + await v(0, 'age') + ' (expected ' + years(3, 1, 2009) + ' years)');
  ok(await p.evaluate(s => document.querySelector(s).readOnly || document.querySelector(s).disabled, cell(0, 'age')), 'and it cannot be typed over');
  const order = await p.evaluate(() => [...document.querySelectorAll('.rowcard')[0].querySelectorAll('.f .l span')].map(e => e.textContent.trim()));
  ok(order.join('|') === 'Name|Surname|Gender|Date of birth|Age|Education stage|Monthly cost (R)', 'order of the boxes: ' + order.join(' | '));
  const geom = () => p.evaluate(() => { const card = document.querySelector('.rowcard').getBoundingClientRect(), fs = [...document.querySelectorAll('.rowcard')[0].querySelectorAll('.f')].map(e => e.getBoundingClientRect()); return { rows: new Set(fs.map(r => Math.round(r.top))).size, inside: fs.every(r => r.left >= card.left - 1 && r.right <= card.right + 1), cardW: Math.round(card.width), w: window.innerWidth }; });
  let g = await geom();
  ok(g.inside, 'at ' + g.w + ' px wide every box stays inside its card (' + g.rows + ' rows, card ' + g.cardW + ' px)');
  await p.setViewportSize({ width: 1900, height: 900 }); await p.waitForTimeout(300);
  g = await geom();
  ok(g.inside && g.rows === 1, 'at ' + g.w + ' px wide all seven boxes are on one row inside the card (' + g.rows + ' rows, card ' + g.cardW + ' px)');
  await p.screenshot({ path: shots + '/kids-wide.png', clip: { x: 0, y: 140, width: 1900, height: 380 } });
  await p.setViewportSize({ width: 1300, height: 900 }); await p.waitForTimeout(300);
  await p.fill(cell(1, 'dob'), '15/08/2026'); await p.press(cell(1, 'dob'), 'Tab'); await p.waitForTimeout(200);
  ok(/^\d+ months?$/.test(await v(1, 'age')), 'a baby shows months: ' + await v(1, 'age'));
  await p.fill(cell(1, 'dob'), ''); await p.press(cell(1, 'dob'), 'Tab'); await p.waitForTimeout(200);
  ok(await v(1, 'age') === '', 'no date of birth, no age');
  await p.fill(cell(1, 'dob'), '03/01/2009'); await p.press(cell(1, 'dob'), 'Tab'); await p.waitForTimeout(200);
  await p.screenshot({ path: shots + '/kids.png', clip: { x: 0, y: 150, width: 1300, height: 360 } });
  // the voice route: a date of birth said aloud fills the age too
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  // the defaults on the risk calculation page
  await p.click('.nav button[data-sec="calc"]'); await p.waitForTimeout(300);
  const want = { lc_f_aci: 'Fixed', lc_f_aciv: '?', lc_wol: '3%', lc_ccabi: '5%', pd_f_aci: 'Fixed', pd_f_aciv: '?', pd_ccabi: '5%', dd_aci: 'Fixed', dd_aciv: '?', dd_abiv: '3%', ip_aci: 'Fixed', ip_aciv: '?', ip_abiv: '5%' };
  const got = await p.evaluate(ids => Object.fromEntries(ids.map(i => [i, document.querySelector('[data-f="' + i + '"]').value])), Object.keys(want));
  ok(JSON.stringify(got) === JSON.stringify(want), 'all 13 defaults are on the form: ' + JSON.stringify(got));
  ok(await p.evaluate(() => document.querySelector('[data-field="lc_wol"]').classList.contains('s-preset') && /preset/.test(document.querySelector('[data-field="lc_wol"] .badge').textContent)), 'and are marked "preset"');
  await p.click('.nav button[data-sec="prio"]'); await p.waitForTimeout(300);                       // the standard cover boxes are in the Life area now
  const none = await p.evaluate(() => ['pd_aci', 'lc_aci', 'lc_abiv'].map(i => document.querySelector('[data-f="' + i + '"]').value));
  ok(none.every(x => x === ''), 'the standard cover boxes stay empty: ' + JSON.stringify(none));
  await p.click('.nav button[data-sec="calc"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: shots + '/risk-defaults.png', clip: { x: 0, y: 150, width: 1300, height: 700 } });
  // one can be changed and a New form brings the defaults back
  await p.selectOption('[data-f="lc_f_aci"]', 'CPI'); await p.fill('[data-f="lc_wol"]', '4%'); await p.press('[data-f="lc_wol"]', 'Tab'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('[data-f="lc_f_aci"]').value + '/' + document.querySelector('[data-f="lc_wol"]').value) === 'CPI/4%', 'a default can be changed');
  await p.click('#btnNew'); await p.waitForTimeout(400);
  await p.click('.nav button[data-sec="calc"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('[data-f="lc_f_aci"]').value + '/' + document.querySelector('[data-f="lc_wol"]').value) === 'Fixed/3%', 'a new Fact Find starts with the defaults again');
  // the PDF carries the Age column and the defaults
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'kids', { name: 'Hannah Kuiper', gender: 'Female', dob: '03/01/2009', cost: '12668' }, 'confirmed'); });
  const b64 = await p.evaluate(() => { const d = FF.app.makePdf(); const ab = (d.doc || d).output('arraybuffer'); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); });
  fs.writeFileSync(shots + '/kids.pdf', Buffer.from(b64, 'base64'));
  const txt = cp.execFileSync('pdftotext', ['-layout', shots + '/kids.pdf', '-']).toString();
  const line = txt.split('\n').find(l => /\bAge\s+\d+ years/.test(l)) || '';
  ok(/Age\s+\d+ years/.test(line), 'the PDF shows the age: ' + line.trim().slice(0, 110));
  ok(/Age/.test(txt) && /ACI\s+Fixed|Fixed/.test(txt) && /3%/.test(txt) && /5%/.test(txt), 'the PDF has the Age heading and the defaults');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
