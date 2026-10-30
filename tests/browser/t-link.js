const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  await p.click('#btnSettings'); await p.waitForTimeout(300);
  const links = await p.evaluate(() => [...document.querySelectorAll('dialog a, #setKey ~ a, .help a')].map(a => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel })));
  console.log(JSON.stringify(links), 'errors:', errs.length);
  const a = await p.$('a[href="https://platform.openai.com/api-keys"]'); await a.scrollIntoViewIfNeeded();
  await p.screenshot({ path: shots + '/settings-openai.png' });
  await b.close(); srv.close();
});
