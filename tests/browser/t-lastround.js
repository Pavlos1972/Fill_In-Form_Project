/* The round after the Roquelle meeting: other income, Smoker back on Client info, the Day box, Refresh in one tap, the schedule boxes (grey on No, the new choice), the Duties zeros, and a Debt 3 that is never left open. */
const { chromium } = require(process.argv[2] + '/playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async (ask) => {
    const c = await b.newContext({ viewport: { width: 1500, height: 1000 } }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.argv[3] + '/index.html');
    await p.evaluate(src => { const fn = eval('(' + src + ')'); FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => Promise.resolve(fn(s, JSON.parse(u))) }; }, ask || `(s, b) => JSON.stringify({ actions: [] })`);
    return p;
  };
  const nav = (p, sec) => p.click('.nav button[data-sec="' + sec + '"]').then(() => p.waitForTimeout(250));
  const val = (p, id) => p.evaluate(id => (document.querySelector('[data-f="' + id + '"]') || {}).value, id);
  const type = async (p, id, v) => { await p.fill('[data-f="' + id + '"]', v); await p.press('[data-f="' + id + '"]', 'Tab'); await p.waitForTimeout(200); };

  // ---- income ----
  let p = await fresh();
  await nav(p, 'income');
  const labels = await p.evaluate(() => [...document.querySelectorAll('.main .f .l > span:first-child')].map(e => e.textContent.trim()));
  const at = ['Take-home net income (R p.m.)', 'Rental Income', 'Spousal Maintenance', 'Child Maintenance', 'Total Income', 'Monthly expenses / budget (R)', 'Disposable income (R)'].map(x => labels.indexOf(x));
  ok(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1])), 'Income & household shows take-home, rental, spousal maintenance, child maintenance, Total Income, expenses and Disposable income, in that order: ' + at.join(','));
  await type(p, 'net', '20000'); await type(p, 'rent', '3000'); await type(p, 'spmaint', '10000'); await type(p, 'maint', '16000'); await type(p, 'exp', '19000');
  ok((await val(p, 'tinc')) === 'R 49 000.00', 'Total Income adds the four: ' + (await val(p, 'tinc')));
  ok((await val(p, 'disp')) === 'R 30 000.00', 'Disposable income is Total Income less the expenses: ' + (await val(p, 'disp')));
  ok(await p.evaluate(() => ['tinc', 'disp'].every(id => { const e = document.querySelector('[data-f="' + id + '"]'); return e.readOnly || e.disabled; })), 'both are calculated, not typed');
  await nav(p, 'calc');
  ok(await p.evaluate(() => (document.querySelector('[data-f="ip_amt"]') || {}).value) === 'R 20 000.00', 'the BrightRock Insured amount is still the take-home net income alone: ' + (await p.evaluate(() => (document.querySelector('[data-f="ip_amt"]') || {}).value)));
  await p.screenshot({ path: process.argv[4] + '/lastround-calc.png' });
  await nav(p, 'income'); await p.screenshot({ path: process.argv[4] + '/lastround-income.png' });

  // ---- Smoker ----
  await nav(p, 'info');
  ok(await p.evaluate(() => !!document.querySelector('[data-f="smoker"]')), 'Smoker is on Client info');
  await nav(p, 'health'); ok(await p.evaluate(() => !document.querySelector('[data-f="smoker"]')), 'and not on Health');

  // ---- duties ----
  await nav(p, 'occ');
  await type(p, 'd_desk', '90'); ok((await val(p, 'd_light')) === '', '90%: the other duties stay empty');
  await type(p, 'd_trav', '10');
  ok((await val(p, 'd_supo')) === '0' && (await val(p, 'd_sups')) === '0' && (await val(p, 'd_light')) === '0' && (await val(p, 'd_mod')) === '0' && (await val(p, 'd_heavy')) === '0', 'at 100% the empty duties show 0');
  ok((await val(p, 'd_tot')) === '100%', 'the total reads 100%');
  await type(p, 'd_trav', '20'); ok((await val(p, 'd_supo')) === '', 'the total moves off 100%: the automatic zeros go');
  await type(p, 'd_trav', '10'); await p.screenshot({ path: process.argv[4] + '/lastround-duties.png', clip: { x: 0, y: 0, width: 1500, height: 1000 } });

  // ---- schedules ----
  await nav(p, 'cover');
  const sch = () => p.evaluate(() => { const blk = [...document.querySelectorAll('.block-title')].filter(e => /Request Current Policy Schedule/.test(e.textContent)); const t = blk[0]; const wrap = t && t.nextElementSibling; return { n: blk.length, text: document.body.innerText.includes('No policy schedules to request'), off: !!document.querySelector('[data-f="ps_risk"], .msb[data-msb="ps_risk"]') && !!document.querySelector('[data-msb="ps_risk"]').closest('.off, [inert]') }; });
  let s0 = await sch(); ok(!s0.text && !s0.off, 'before anything is answered the schedule box is open');
  await p.selectOption('[data-f="has_risk"]', 'No'); await p.waitForTimeout(250);
  s0 = await sch(); ok(s0.text && s0.off, 'Has personal risk cover = No: the schedule box is greyed out and says "No policy schedules to request"');
  await p.screenshot({ path: process.argv[4] + '/lastround-schedule-no.png' });
  await p.selectOption('[data-f="has_risk"]', 'Yes'); await p.waitForTimeout(250);
  ok(!(await sch()).off, 'Yes opens it again');
  await p.click('.msb[data-msb="ps_risk"]'); await p.waitForTimeout(200);
  const opts = await p.evaluate(() => [...document.querySelectorAll('.msp label')].map(l => l.textContent.trim()));
  ok(opts.includes('Client does not need to send through'), 'the new choice is in the list: ' + opts.join(' | '));
  await p.keyboard.press('Escape');
  await nav(p, 'retire'); await p.selectOption('[data-f="has_ra"]', 'No'); await p.selectOption('[data-f="has_pp"]', 'No'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.body.innerText.split('No policy schedules to request').length - 1) === 2, 'retirement annuities and pension and provident funds both grey out');
  await nav(p, 'inv'); await p.selectOption('[data-f="has_inv"]', 'No'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.body.innerText.includes('No policy schedules to request')), 'investments too');
  await nav(p, 'cover'); await p.selectOption('[data-f="has_risk"]', 'No');
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'fname', 'Thandi'); FF.store.setField(FF.app.state, 'ps_risk', FF.schema.psClient.risk); FF.app.redraw(); });       // a choice left behind in a switched-off box
  await nav(p, 'admin'); await p.waitForTimeout(900);
  ok(!/policy schedules/.test(await p.evaluate(() => document.querySelector('[data-f="pa_actions"]').value)), 'the action points leave out a schedule whose Yes/No is No');

  // ---- admin: Day box and Refresh in one tap ----
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'next_appt', '18/06/2025'); FF.store.setField(FF.app.state, 'next_time', '08:30'); FF.app.redraw(); });
  await nav(p, 'admin');
  ok(await p.evaluate(() => { const e = document.querySelector('[data-f="next_day"]'); return e.value === 'Wednesday' && e.scrollWidth <= e.clientWidth; }), 'the Day box shows Wednesday in full');
  await p.screenshot({ path: process.argv[4] + '/lastround-admin.png' });
  await p.evaluate(() => { const t = document.querySelector('[data-f="pa_actions"]'); t.value = 'Thursday 19/06/2025 at 08:30'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(/Edited by you/.test(await p.evaluate(() => document.getElementById('paStatus').textContent)), 'typing in the points makes them the adviser\'s own');
  ok(/replaces what I typed/.test(await p.evaluate(() => document.getElementById('paRefresh').textContent)), 'and the Refresh button says it replaces what was typed');
  await p.click('#paRefresh'); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ t: document.querySelector('[data-f="pa_actions"]').value, s: document.getElementById('paStatus').textContent }));
  ok(!/Thursday 19\/06\/2025/.test(after.t) && /Wednesday 18\/06\/2025 at 08:30/.test(after.t), 'one tap on Refresh writes the points again from the form: ' + JSON.stringify(after.t.split('\n').pop()));
  ok(!/Edited by you/.test(after.s), 'and the status no longer says edited: ' + after.s);

  // ---- voice: a Debt 3 is never left open ----
  p = await fresh(`(s, b) => { const t = b.newest.text; if (/other debts/.test(t)) return JSON.stringify({ actions: [{ do: 'ask', list: 'debts', row: 'new', col: 'type' }] }); if (/^No surety/.test(t)) return JSON.stringify({ actions: [{ do: 'cell', list: 'debts', row: 3, col: 'surety', value: 'No' }] }); if (/^No\\.?$/.test(t)) return JSON.stringify({ actions: [{ do: 'done', list: 'debts' }] }); return JSON.stringify({ actions: [] }); }`);
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  await p.evaluate(() => { FF.store.addRow(FF.app.state, 'debts', { type: 'Credit card', prov: 'FNB' }, 'heard'); FF.store.addRow(FF.app.state, 'debts', { type: 'Other', desc: 'Overdraft', prov: 'FNB' }, 'heard'); FF.app.redraw(); document.querySelector('.nav button[data-sec="debts"]').click(); });
  const say = t => p.evaluate(t => FF.app.voiceHear(t, 'client'), t).then(() => p.waitForTimeout(500));
  await say('No surety.');                                                                                 // Claude names row 3 by mistake: there are two debts, so nothing is opened for it
  ok(await p.evaluate(() => FF.app.state.l.debts.length) === 2, 'a value for a Debt 3 that is not there does not open one');
  await say('Do we have any other debts that we need to be discussing?');
  ok(await p.evaluate(() => FF.app.state.l.debts.length) === 3, 'asking "any other debts?" points at an empty new row');
  await say('No.');
  const rows = await p.evaluate(() => FF.app.state.l.debts.length);
  ok(rows === 2, 'after "no other debts" there are two debts and no blank Debt 3: ' + rows);


  // ---- voice: no asset value on an overdraft or a card; a child's second name is a middle name ----
  p = await fresh(`(s, b) => { const t = b.newest.text; const A = x => JSON.stringify({ actions: x });
    if (/^asset 1/.test(t)) return A([{ do: 'cell', list: 'debts', row: 1, col: 'asset', value: '30000' }]);
    if (/asset value for debt 2/.test(t)) return A([{ do: 'cell', list: 'debts', row: 2, col: 'asset', value: '50000' }]);
    if (/^it is an overdraft/.test(t)) return A([{ do: 'cell', list: 'debts', row: 2, col: 'desc', value: 'Overdraft' }]);
    if (/second name/.test(t)) return A([{ do: 'cell', list: 'kids', row: 1, col: 'sname', value: 'Dumitru' }]);
    return A([]); }`);
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  await p.evaluate(() => { const st = FF.app.state; FF.store.addRow(st, 'debts', { type: 'Credit card', prov: 'FNB' }, 'heard'); FF.store.addRow(st, 'debts', { type: 'Other', desc: 'Townhouse loan', prov: 'FNB', bal: 'R 50 000.00' }, 'heard'); FF.store.addRow(st, 'kids', { name: 'Raul' }, 'heard'); FF.app.redraw(); document.querySelector('.nav button[data-sec="debts"]').click(); });
  const say3 = t => p.evaluate(t => FF.app.voiceHear(t, 'client'), t).then(() => p.waitForTimeout(500));
  await say3('asset 1 is thirty thousand');
  ok(await p.evaluate(() => FF.app.state.l.debts[0].d.asset) === 'R 0.00', 'a credit card gets no asset value: voice leaves the R 0.00 it starts with');
  await say3('the asset value for debt 2 is fifty thousand');
  ok(await p.evaluate(() => FF.app.state.l.debts[1].d.asset) === 'R 50 000.00', 'a debt on a property (an Other that says townhouse) takes the asset value said: ' + await p.evaluate(() => FF.app.state.l.debts[1].d.asset));
  await say3('it is an overdraft');
  ok(await p.evaluate(() => FF.app.state.l.debts[1].d.asset) === 'R 0.00', 'when it turns out to be an overdraft the asset value voice put in goes back to R 0.00');
  await p.evaluate(() => document.querySelector('.nav button[data-sec="kids"]').click());
  await say3('and his second name is Dumitru');
  const kid = await p.evaluate(() => FF.app.state.l.kids[0].d);
  ok(kid.name === 'Raul Dumitru' && kid.sname === '', 'a child\'s second name follows the first name and the Surname stays empty: ' + JSON.stringify(kid));

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
