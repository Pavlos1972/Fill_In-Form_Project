const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1700, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const NAVMAP = { 'Risk calculation': 'calc', 'Personal risk quotes': 'prio', 'Existing cover': 'cover' }; const nav = t => (NAVMAP[t] ? p.click('.nav button[data-sec="' + NAVMAP[t] + '"]') : p.click('.nav button:has-text("' + t + '")')).then(() => p.waitForTimeout(250));
  const ip = () => p.evaluate(() => { const e = document.querySelector('[data-f="ip_amt"]'); return { v: e.value, ro: e.readOnly || e.disabled, st: document.querySelector('[data-field="ip_amt"]').className.match(/s-\w+/)[0] }; });
  await nav('Risk calculation'); let r = await ip();
  ok(r.v === '' && r.ro && r.st === 's-calc', 'no take-home income yet: empty, read-only, shown as a calculation: ' + JSON.stringify(r));
  await nav('Income'); await p.fill('[data-f="net"]', '61449'); await p.press('[data-f="net"]', 'Tab'); await p.waitForTimeout(250);
  const net = await p.evaluate(() => document.querySelector('[data-f="net"]').value);
  await nav('Risk calculation'); r = await ip();
  ok(r.v === net && net === 'R 61 449.00', 'typed take-home income appears as the insured amount: ' + net + ' -> ' + r.v);
  await p.screenshot({ path: shots + '/ip.png', clip: { x: 240, y: 700, width: 1300, height: 260 } }).catch(() => {});
  // it cannot be typed over
  const typed = await p.evaluate(() => { const e = document.querySelector('[data-f="ip_amt"]'); e.removeAttribute('readonly'); e.removeAttribute('disabled'); e.value = 'R 1.00'; e.dispatchEvent(new Event('change', { bubbles: true })); return true; });
  await nav('Income'); await nav('Risk calculation'); r = await ip();
  ok(r.v === net, 'even forced, a typed amount does not stick: ' + r.v);
  // a change of the take-home income is followed
  await nav('Income'); await p.fill('[data-f="net"]', '70000'); await p.press('[data-f="net"]', 'Tab'); await p.waitForTimeout(250);
  await nav('Risk calculation'); r = await ip();
  ok(r.v === 'R 70 000.00', 'a new take-home income is followed: ' + r.v);
  // by voice
  await p.click('#btnVoice'); await nav('Income');
  await p.evaluate(() => FF.app.voiceHear('what is your take home pay?')); await p.waitForTimeout(400);
  await p.evaluate(() => FF.app.voiceHear('R 55 000')); await p.waitForTimeout(700);
  const spoken = await p.evaluate(() => FF.app.state.f.net.v); await p.click('#btnVoice'); await nav('Risk calculation'); r = await ip();
  ok(r.v === spoken && /55 000/.test(spoken), 'a take-home income said aloud is followed too: ' + spoken + ' -> ' + r.v);
  // the PDF
  const b64 = await p.evaluate(() => { const d = FF.app.makePdf(); const ab = (d.doc || d).output('arraybuffer'); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); });
  fs.writeFileSync(shots + '/ip.pdf', Buffer.from(b64, 'base64'));
  const t = cp.execFileSync('pdftotext', ['-layout', shots + '/ip.pdf', '-']).toString(); const i = t.indexOf('Income protection / sickness benefit: fractured');
  ok(/Insured amount \(R p\.m\.\)[\s\S]{0,60}R 55 000\.00/.test(t.slice(i, i + 600)), 'the PDF shows it: ' + t.slice(i, i + 330).replace(/\s+/g, ' ').slice(0, 170));
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
