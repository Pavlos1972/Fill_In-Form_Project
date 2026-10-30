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
  const has = sel => p.evaluate(s => !!document.querySelector(s), sel);

  const order = await p.evaluate(() => [...document.querySelectorAll('.nav button[data-sec]')].map(x => x.dataset.sec).join(' '));
  ok(order === 'info occ income debts kids cover retire inv other health prio calc admin', 'the pages are in the new order: ' + order);

  await nav('info'); ok(!(await has('[data-f="smoker"]')), 'Smoker is not on Client info');
  await nav('health'); ok(await has('[data-f="smoker"]'), 'Smoker is on Health');
  await p.selectOption('[data-f="smoker"]', 'Smoker'); ok(await p.evaluate(() => FF.app.state.f.smoker.v === 'Smoker'), 'and can be answered there');

  await nav('cover'); ok(!(await has('[data-f="loa"]')), 'the LOA is not on the cover page');
  await nav('admin');
  const pos = await p.evaluate(() => { const r = id => { const e = document.querySelector('[data-f="' + id + '"]'); return e ? e.getBoundingClientRect() : null; }; const a = r('loa'), n = r('next_appt'), t = document.querySelector('[data-f="pa_actions"]'); const c = t && t.getBoundingClientRect(); return a && n && c ? { loaX: Math.round(a.left), apptX: Math.round(n.left), actX: Math.round(c.left), loaY: Math.round(a.top), apptY: Math.round(n.top) } : null; });
  ok(pos && pos.loaX === pos.apptX && pos.loaY < pos.apptY && pos.actX > pos.loaX + 200, 'the LOA is stacked above the next appointment in the narrow column, the action points are beside them: ' + JSON.stringify(pos));
  await p.selectOption('[data-f="loa"]', 'Yes'); ok(await p.evaluate(() => FF.app.state.f.loa.v === 'Yes'), 'the LOA can be answered on Admin');

  await nav('retire');
  ok((await p.evaluate(() => document.querySelectorAll('[data-f="ps_ra"], [data-msb="ps_ra"]').length)) >= 1 && !(await has('[data-f="ps_pp"], [data-msb="ps_pp"]')), 'Retirement has one schedule request');
  const heads = await p.evaluate(() => [...document.querySelectorAll('.block-title')].filter(e => /Request Current Policy Schedule/.test(e.textContent)).length);
  ok(heads === 1, 'and one heading for it: ' + heads);

  await nav('kids'); await p.selectOption('[data-f="has_kids"]', 'Yes'); await p.click('button[data-add="kids"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Childcare \(R p\.m\.\)/.test(document.body.innerText) && /Childcare costs only/.test(document.body.innerText)), 'Children shows Childcare (R p.m.) and says what goes in it');

  await nav('prio'); await p.evaluate(() => { FF.store.setField(FF.app.state, 'pr_will', 'Priority: client agrees'); FF.store.setField(FF.app.state, 'pr_st', 'Priority: client agrees'); FF.app.redraw(); }); await nav('prio'); await p.waitForTimeout(200);
  const ref = await p.evaluate(() => ['ref_will', 'ref_sti'].map(id => { const e = document.querySelector('[data-f="' + id + '"]'); return e ? [...e.options].map(o => o.textContent.trim()).filter(Boolean).join(' / ') : null; }));
  ok(ref[0] === 'Capital Legacy to contact client / Not interested' && ref[1] === 'Cameron to contact client / Must not contact client / Not interested', 'the referral choices no longer restate a box above: ' + JSON.stringify(ref));

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
