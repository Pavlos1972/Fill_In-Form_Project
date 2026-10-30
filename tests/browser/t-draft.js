const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'http://localhost:' + srv.address().port + '/';
  await p.goto(url);
  ok(await p.evaluate(() => !document.getElementById('restoreDraft')), 'a first visit has no question');
  await p.fill('[data-f="fname"]', 'Thandi'); await p.press('[data-f="fname"]', 'Tab'); await p.waitForTimeout(300);

  await p.reload(); await p.waitForTimeout(400);
  const open = await p.evaluate(() => { const d = document.getElementById('restoreDraft'); return d && d.open ? d.innerText.replace(/\s+/g, ' ') : null; });
  ok(open && /Unsaved changes found/.test(open) && /Thandi/.test(open), 'the unsaved changes are offered back: ' + open);
  ok(await p.evaluate(() => FF.app.state.f.fname.v === ''), 'the form behind the question is blank: the last client is not shown until chosen');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const d = document.getElementById('restoreDraft'); return !!d && d.open; }), 'Escape does not close it: a choice is needed');
  await p.click('#restoreYes'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.f.fname.v === 'Thandi' && !document.getElementById('restoreDraft')), 'Restore brings the client back');

  await p.reload(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const d = document.getElementById('restoreDraft'); return !!d && d.open; }), 'still unsaved: it is offered again');
  await p.click('#restoreNew'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.f.fname.v === '' && !document.getElementById('restoreDraft')), 'Start a new Fact Find gives a blank form');
  await p.reload(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('restoreDraft') && FF.app.state.f.fname.v === ''), 'and the old draft is gone');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
