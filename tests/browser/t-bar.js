const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  for (const w of [1920, 1500, 1280, 900, 700]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:' + srv.address().port + '/');
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-meeting', JSON.stringify({ acc: 725000, since: 0, beat: Date.now() })); });
    await p.reload(); await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const r = id => { const e = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(e.left), r: Math.round(e.right), y: Math.round(e.top) }; };
      const bar = document.querySelector('.top').getBoundingClientRect();
      return { bar: { l: Math.round(bar.left), r: Math.round(bar.right), h: Math.round(bar.height) }, settings: r('btnSettings'), open: r('btnOpen'), timer: r('btnTimer'), reset: r('btnTimerReset'), listen: r('btnListen'), save: r('btnSave'), pdf: r('btnPdf'), overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    const mid = (m.timer.x + m.listen.r) / 2, barMid = (m.bar.l + m.bar.r) / 2;
    console.log(w, JSON.stringify(m));
    if (w >= 1280) { ok(m.settings.y === m.pdf.y && m.settings.y === m.timer.y, w + ': all buttons on one row'); ok(m.settings.x < m.timer.x && m.timer.x < m.save.x, w + ': left, middle, right order'); ok(Math.abs(mid - barMid) < 90, w + ': middle group is near the centre (' + Math.round(mid) + ' vs ' + Math.round(barMid) + ')'); ok(m.bar.r - m.pdf.r < 30, w + ': right group reaches the right edge'); }
    ok(!m.overflowX, w + ': no sideways scroll'); ok(errs.length === 0, w + ': no errors');
    await p.screenshot({ path: shots + '/bar-' + w + '.png', clip: { x: 0, y: 0, width: w, height: 190 } });
    await p.close();
  }
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
