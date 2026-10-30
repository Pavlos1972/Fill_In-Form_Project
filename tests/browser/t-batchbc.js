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
  const redraw = () => p.evaluate(() => FF.app.redraw());
  const grey = id => p.evaluate(id => { const e = document.querySelector('[data-f="' + id + '"]'); return e ? !!e.closest('.off, .grey, [data-grey]') || e.disabled : 'absent'; }, id);

  // the Yes/No that opens a list
  await nav('debts');
  ok(await p.evaluate(() => !!document.querySelector('[data-f="has_debts"]')), 'Debts page has the Has debts box');
  await p.selectOption('[data-f="has_debts"]', 'No'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const a = document.querySelector('button[data-add="debts"]'); return !a || a.disabled || !!a.closest('.off, .grey, [data-grey]'); }), 'No greys the debts list');
  await p.selectOption('[data-f="has_debts"]', 'Yes'); await p.waitForTimeout(200);
  await p.click('button[data-add="debts"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => FF.app.state.l.debts.length === 1 && FF.app.state.f.has_debts.v === 'Yes'), 'a row added by hand keeps it Yes');
  const badge = () => p.evaluate(() => (document.querySelector('.nav button[data-sec="debts"]') || {}).innerText);
  console.log('INFO debts nav:', JSON.stringify(await badge()));

  // greyed boxes on the medical page
  await set('ma', 'None'); await set('will', 'No'); await redraw(); await nav('other');
  const r = []; for (const id of ['ma_prov', 'will_up', 'sti_car']) r.push([id, await grey(id)]);
  ok(r[0][1] === true && r[1][1] === true && r[2][1] === false, 'provider and will boxes are greyed under None / No, short-term car is open: ' + JSON.stringify(r));

  // bank: pick or type
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'debts', { type: 'Home loan', payer: 'Spouse', inst: 'R 9 000.00' }, 'confirmed'); FF.app.redraw(); }); await nav('debts');
  const bank = await p.evaluate(() => { const e = document.querySelector('[data-l="debts"][data-i="1"][data-k="prov"]'); return e ? { tag: e.tagName, list: e.getAttribute('list') || '', other: !!document.querySelector('[data-k="prov_other"]') } : null; });
  ok(bank && !bank.other, 'the debts bank has no Other box: ' + JSON.stringify(bank));

  // the protector leaves out a debt paid by someone else
  await set('net', 'R 40 000.00'); await p.evaluate(() => { FF.store.addRow(FF.app.state, 'debts', { type: 'Vehicle finance', payer: 'Client', inst: 'R 5 000.00' }, 'confirmed'); FF.app.redraw(); }); await nav('calc'); await p.waitForTimeout(200);
  const prot = await p.evaluate(() => ({ rows: document.querySelectorAll('.prow').length, left: (document.body.innerText.match(/Paid by someone else, left out[^\n]*/) || [''])[0], hh: (document.querySelector('[data-f="ip_hh"]') || {}).value, lcdr: (document.querySelector('[data-f="lc_dr"]') || {}).value, lcl: !!document.querySelector('[data-field="lc_hh"] label, [data-field="lc_hh"] .l') }));
  ok(prot.rows === 1 && /1 debt/.test(prot.left) && prot.hh === 'R 35 000.00' && prot.lcdr === 'R 5 000.00', 'the protector shows one client debt, a line for the left-out one, household needs R 35 000: ' + JSON.stringify(prot));
  ok(await p.evaluate(() => /Client take-home income/.test(document.body.innerText) && /Minus debt repayments paid by the client/.test(document.body.innerText)), 'the calculation page labels read right');

  // quotes: the same four answers, Request column on investment quotes
  await set('pr_inv', 'Priority: client agrees'); await set('pr_life', 'Priority: client agrees'); await redraw(); await nav('prio'); await p.waitForTimeout(200);
  await p.evaluate(() => { const a = document.querySelector('button[data-add="invq"]'); if (a) a.click(); }); await p.waitForTimeout(200);
  const inv = await p.evaluate(() => { const e = document.querySelector('[data-l="invq"][data-i="0"][data-k="req"]'); return e ? [...e.options].map(o => o.textContent).join('|') + ' =' + e.value : null; });
  ok(inv && /Cannot afford now/.test(inv) && /=Request a quote/.test(inv), 'a new investment quote row has the Request column set to Request a quote: ' + inv);

  // the retirement annuity paid-up box and the Has-questions on Retirement
  await nav('retire');
  ok(await p.evaluate(() => !!document.querySelector('[data-f="has_ra"]') && !!document.querySelector('[data-f="has_pp"]')), 'Retirement has Has retirement annuities and Has pension or provident funds');
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'ret_ra', { prov: 'Allan Gray', status: 'Paid-up' }, 'confirmed'); FF.app.redraw(); }); await nav('retire');
  ok(await p.evaluate(() => !!document.querySelector('[data-l="ret_ra"][data-k="status"]')), 'the retirement annuity has the Current or paid-up box');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await p.screenshot({ path: shots + '/batchbc.png' }).catch(() => {});
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
