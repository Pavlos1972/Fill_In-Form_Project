const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const pick = () => p.evaluate(() => { const e = document.querySelector('.vm-pick'); if (!e) return null; const r = e.getBoundingClientRect(); return { opts: [...e.querySelectorAll('button')].map(x => x.textContent), on: [...e.querySelectorAll('button.on')].map(x => x.textContent), top: Math.round(r.top), h: Math.round(r.height), scrollable: e.scrollHeight > e.clientHeight + 1 }; });
  const val = id => p.evaluate(id => FF.app.state.f[id].v, id);
  const say = async t => { await p.evaluate(t => FF.app.voiceHear(t), t); await p.waitForTimeout(500); };
  await p.click('#btnVoice'); await p.waitForTimeout(300);
  await p.click('.nav button[data-sec="prio"]'); await p.waitForTimeout(300);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.main [data-field]')].filter(e => e.querySelector('.l')).map(e => e.dataset.field + ':' + e.querySelector('.l').textContent.trim()));
  ok(labels.join('|').includes('fna_req:FNA quote|fna_type:Type of quote|fna_ins:Insurer(s)|bf_sf_req:Shortfall quote|bf_sf_type:Type of quote|sf_req:Shortfall quote|sf_type:Type of quote|sf_ins:Insurer(s)'), 'new boxes sit after the FNA and shortfall quote boxes: ' + labels.slice(0, 6).join(', '));
  ok((await pick()) === null, 'nothing is open before a question');
  // the FNA type dropdown
  await say('What type of quote is the FNA quote?');
  let pk = await pick();
  ok(pk && pk.opts.join('|') === 'New Business|Servicing|N/A', 'asking opens the list with the three choices: ' + JSON.stringify(pk));
  ok(await p.evaluate(() => document.querySelector('[data-field="fna_type"]').classList.contains('voice-wait')), 'and the box glows');
  const geo = await p.evaluate(() => { const c = document.querySelector('[data-f="fna_type"]').getBoundingClientRect(), l = document.querySelector('.vm-pick').getBoundingClientRect(); return { gap: Math.round(l.top - c.bottom), sameLeft: Math.abs(l.left - c.left) < 6 }; });
  ok(geo.gap >= 0 && geo.gap < 12 && geo.sameLeft, 'the list sits right under the box: ' + JSON.stringify(geo));
  await p.screenshot({ path: shots + '/pick-fna.png', clip: { x: 0, y: 0, width: 1400, height: 520 } });
  await say('servicing');
  ok(await val('fna_type') === 'Servicing', 'answering fills the box: ' + await val('fna_type'));
  ok((await pick()) === null, 'and the list closes');
  // the insurer combobox: a long list that scrolls, filled by a click
  await say('Who is the insurer?');
  pk = await pick();
  ok(pk && pk.opts.length === 10 && pk.opts[0] === 'Old Mutual', 'the insurer list opens too (10 choices): ' + (pk && pk.opts.length));
  await p.evaluate(() => { document.querySelector('.vm-pick').scrollTop = 1000; });
  ok(await p.evaluate(() => document.querySelector('.vm-pick').scrollTop > 0), 'it scrolls when it is long (scrollable=' + (pk && pk.scrollable) + ')');
  await p.click('.vm-pick button:has-text("Sanlam")'); await p.waitForTimeout(300);
  ok(await val('fna_ins') === 'Sanlam', 'a click on a choice fills the box: ' + await val('fna_ins'));
  ok((await pick()) !== null, 'and, being a tick-box list, it stays open for another insurer');
  await p.mouse.click(5, 5); await p.waitForTimeout(200);
  // shortfall type, N/A said as words
  await say('What type of quote is the shortfall?');
  pk = await pick(); ok(pk && pk.opts.length === 3, 'the shortfall type list opens');
  ok(await p.evaluate(() => document.querySelector('[data-field="sf_type"]').classList.contains('voice-wait')), 'for the shortfall box, not the FNA one');
  await say('not applicable');
  ok(await val('sf_type') === 'N/A', 'not applicable fills N/A: ' + await val('sf_type'));
  // a click elsewhere sends the list away and it does not come back for the same box
  await say('What is the shortfall quote?');
  pk = await pick(); ok(pk && pk.opts.includes('Request a quote'), 'the shortfall request list opens: ' + JSON.stringify(pk && pk.opts));
  await p.mouse.click(900, 700); await p.waitForTimeout(200);
  ok((await pick()) === null, 'a click elsewhere closes it');
  await p.evaluate(() => { document.querySelector('.main').dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); }); await p.waitForTimeout(200);
  ok((await pick()) === null, 'and it stays closed for that box');
  await say('Request a quote');
  ok((await val('sf_req')) === 'Request a quote', 'the spoken answer still fills it: ' + await val('sf_req'));
  // reduced quotes: a row with the new column
  await say('What type of reduced quote is it?');
  pk = await pick();
  ok(pk && pk.opts.join('|') === 'New Business|Servicing|N/A', 'the reduced quote row has the Type of quote list: ' + JSON.stringify(pk));
  const heads = await p.evaluate(() => [...document.querySelectorAll('.main table th, .main .rowcard .l')].map(e => e.textContent.trim()).slice(0, 8));
  ok(heads.some(h => /Type of quote/.test(h)), 'with a Type of quote column/field: ' + heads.join(', '));
  await say('new business');
  ok(await p.evaluate(() => document.querySelector('[data-cell="redq:0:type"] select').value) === 'New Business', 'the row cell is filled');
  ok((await pick()) === null, 'and its list closes');
  // voice off closes anything open
  await say('What type of quote is the FNA quote?'); ok(!!(await pick()), 'open again after a new question');
  await p.click('#btnVoice'); await p.waitForTimeout(300);
  ok((await pick()) === null, 'turning Voice off closes it');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
