const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // Claude is faked: it answers with points that name the client by the first name alone and address Sitamah, the way a careless answer might
  let asked = 0;
  await ctx.route('https://api.anthropic.com/**', route => { asked++; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"points": [{"text": "Sitamah, please follow up with Sitimah for the current policy schedules, await client response.", "from": "loa"}, {"text": "Ask Valerie to contact Sitimah about medical aid.", "from": "appointment"}]}' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }) }); });
  await p.goto('http://localhost:' + srv.address().port + '/');
  const box = () => p.evaluate(() => document.querySelector('[data-f="pa_actions"]').value);
  const status = () => p.evaluate(() => document.getElementById('paStatus').textContent);
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'fname', 'Sitimah'); FF.store.setField(FF.app.state, 'sname', 'Nathoo'); FF.store.setField(FF.app.state, 'loa', 'Yes'); FF.app.redraw(); });
  await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(1300);

  // with no key: the form's own points, opening with the line to Sitamah, the client always "the client Sitimah"
  let t = await box();
  ok(t.split('\n')[0] === 'Sitamah, please action these for the client Sitimah Nathoo:', 'the box opens with the line to Sitamah: ' + JSON.stringify(t.split('\n')[0]));
  ok(/- Send the client Sitimah the LOA to sign/.test(t) && !/(?<!the client )\bSitimah\b(?! Nathoo)/.test(t.split('\n').slice(1).join('\n')), 'the points name the client with the role, never the bare name');
  ok(/^- Set up a follow-up appointment with the client Sitimah/m.test(t), 'the follow-up appointment too');

  // with a key: Claude writes the points, the form straightens them and keeps the line to Sitamah
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }));
  await p.click('#paRefresh'); await p.waitForTimeout(1500);
  t = await box();
  ok(asked >= 1, 'Claude was asked to write the points');
  ok(/Written by Claude/.test(await status()), 'the status says Claude wrote them: ' + (await status()));
  ok(t.split('\n')[0] === 'Sitamah, please action these for the client Sitimah Nathoo:', 'the line to Sitamah is still first (added by the form)');
  ok(/^- Follow up with the client Sitimah for the current policy schedules, await client response\./m.test(t), 'a point addressed to Sitamah is straightened, and the client has the role: ' + JSON.stringify(t.split('\n')[1]));
  ok(/^- Ask Valerie to contact the client Sitimah about medical aid\./m.test(t), 'the client has the role in every point');
  ok(!/^- Sitamah/m.test(t), 'no point starts with Sitamah');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
