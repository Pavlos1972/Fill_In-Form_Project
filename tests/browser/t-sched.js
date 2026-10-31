const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const nav = s => p.click('.nav button[data-sec="' + s + '"]');
  const boxes = () => p.evaluate(() => [...document.querySelectorAll('.msb[data-msb^="ps_"]')].map(x => ({ id: x.dataset.msb, text: x.textContent.trim(), clipped: x.scrollWidth > x.clientWidth + 1 })));

  // each of the five boxes offers its own first choice
  const want = { ps_risk: 'Requested Personal Risk Covers in meeting, await client response', ps_grp: 'Requested Group Risk Covers in meeting, await client response', ps_ra: 'Requested Retirement Annuities in meeting, await client response', ps_pp: 'Requested Pension and Provident Funds in meeting, await client response', ps_inv: 'Requested Investments in meeting, await client response' };
  const home = { ps_risk: 'cover', ps_grp: 'cover', ps_ra: 'retire', ps_pp: 'retire', ps_inv: 'inv' };
  for (const id of Object.keys(want)) {
    await p.evaluate(([id, v]) => { FF.store.setField(FF.app.state, id, v); FF.app.redraw(); }, [id, want[id] + (id === 'ps_grp' ? '; Other' : '; Draw from Astute (with signed LOA)')]);
  }
  for (const sec of ['cover', 'retire', 'inv']) {
    await nav(sec); await p.waitForTimeout(200);
    const bs = await boxes();
    bs.forEach(x => ok(x.text.startsWith(want[x.id]) && !x.clipped, x.id + ' shows its own wording, and none of it is cut off: ' + x.text.slice(0, 70) + (x.clipped ? ' [CLIPPED]' : '')));
  }
  // the list shows the area's wording
  await nav('cover'); await p.click('.msb[data-msb="ps_risk"]'); await p.waitForTimeout(200);
  const list = await p.evaluate(() => [...document.querySelectorAll('.msp label')].map(l => l.textContent.trim()));
  ok(list.join('|') === '(not asked yet)|Requested Personal Risk Covers in meeting, await client response|Draw from Astute (with signed LOA)|Other', 'the open list: ' + list.join(' | '));
  ok(!list.some(x => /Requested from client in meeting/.test(x)), 'the old wording is gone');

  // an older file opens with the area's wording
  const migrated = await p.evaluate(() => { const j = JSON.parse(FF.store.toJSON(FF.store.blank())); j.f.ps_inv = { v: 'Requested from client in meeting; Other', st: 'confirmed' }; return FF.store.fromJSON(JSON.stringify(j)).f.ps_inv.v; });
  ok(migrated === 'Requested Investments in meeting, await client response; Other', 'an older file: ' + migrated);

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
