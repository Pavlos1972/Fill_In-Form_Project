const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const nav = sec => p.click('.nav button[data-sec="' + sec + '"]');
  const set = (id, v) => p.evaluate(([id, v]) => FF.store.setField(FF.app.state, id, v), [id, v]);

  // 1. a schedule request under each retirement list
  await nav('retire');
  const order = await p.evaluate(() => [...document.querySelectorAll('.block-title')].map(e => e.textContent.trim()).filter(t => /Retirement annuities|Pension and provident|Request Current/.test(t)));
  ok(order.join('|') === 'Retirement annuities|Request Current Policy Schedule(s)|Pension and provident funds|Request Current Policy Schedule(s)', 'a schedule request sits under each retirement list: ' + order.join(' | '));

  // 2-4. the notes under the BrightRock quotes
  await set('pr_life', 'Priority: client agrees'); await set('has_group', 'Yes'); await p.evaluate(() => FF.app.redraw()); await nav('prio'); await p.waitForTimeout(200);
  const notes = await p.evaluate(() => [...document.querySelectorAll('.lc.br .blocknote')].map(e => e.textContent));
  ok(notes.join('|') === 'BR FNA Quote based on Fact Find|BR Shortfall Quote based on BR NA minus Group Risk|BR Reduced Quote based on Shortfall Quote', 'the three BrightRock notes are under their blocks: ' + JSON.stringify(notes));
  ok(await p.evaluate(() => document.querySelectorAll('.lc.std .blocknote').length === 0), 'the standard side has no note');
  ok(await p.evaluate(() => { const n = document.querySelector('.lc.br .blocknote'), f = document.querySelector('.lc.br [data-f="bf_fna_req"]'); return n && f && n.getBoundingClientRect().top > f.getBoundingClientRect().bottom - 2; }), 'the FNA note is below the boxes');
  await set('has_group', 'No'); await p.evaluate(() => FF.app.redraw()); await nav('prio');
  ok(await p.evaluate(() => ![...document.querySelectorAll('.blocknote')].some(e => /BR Shortfall Quote based on BR NA/.test(e.textContent))), 'with no group risk the shortfall block, and its note, go');

  // 5. the action points
  await set('has_group', 'Yes'); await set('fname', 'Thandi'); await set('bf_fna_req', 'Request a quote'); await p.evaluate(() => FF.app.redraw()); await nav('admin'); await p.waitForTimeout(900);
  const pa = await p.evaluate(() => document.querySelector('[data-f="pa_actions"]').value);
  ok(/BrightRock Fractured FNA quote.*BR FNA Quote based on Fact Find/.test(pa) && !/Shortfall Quote based|Reduced Quote based/.test(pa), 'the action points state the FNA basis and only that one: ' + pa.replace(/\n/g, ' | ').slice(0, 160));

  // 6. waiting period
  await nav('calc'); ok(await p.evaluate(() => document.querySelector('[data-f="ip_wait"]').value === '1 month'), 'the waiting period starts at 1 month');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
