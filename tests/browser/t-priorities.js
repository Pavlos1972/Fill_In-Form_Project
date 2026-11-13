/* The numbered priority areas, the Priorities to be Focused on box (empty, filling, Refresh in one tap, Claude's version), and Broker on record starting as Other broker. */
const { chromium } = require(process.argv[2] + '/playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async (ask) => {
    const c = await b.newContext({ viewport: { width: 1500, height: 1100 } }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.argv[3] + '/index.html');
    await p.evaluate(src => { const fn = eval('(' + src + ')'); window.__asked = []; FF.voiceBackend = { available: true, warm: () => Promise.resolve(), ask: (s, u) => { window.__asked.push(JSON.parse(u)); return Promise.resolve(fn(s, JSON.parse(u))); } }; }, ask || `(s, b) => JSON.stringify({ areas: {} })`);
    return p;
  };
  const nav = (p, sec) => p.click('.nav button[data-sec="' + sec + '"]').then(() => p.waitForTimeout(250));
  const val = (p, id) => p.evaluate(id => (document.querySelector('[data-f="' + id + '"]') || {}).value, id);

  // ---- numbered areas and the box at the top ----
  let p = await fresh();
  await nav(p, 'prio');
  const heads = await p.evaluate(() => [...document.querySelectorAll('.prio > header h3')].map(e => e.textContent.trim()));
  ok(heads.slice(0, 8).join(' | ') === '1. Personal Risk Covers | 2. Retirement Planning | 3. RGAR | 4. Investment Planning | 5. EGAR | 6. Medical Aid | 7. Will | 8. Short Term', 'the eight areas are numbered 1 to 8: ' + heads.join(' | '));
  ok(heads[8] === 'Business assurance', 'Business assurance has no number');
  const pos = await p.evaluate(() => { const t = [...document.querySelectorAll('.block-title')].find(e => /Priorities to be Focused on/.test(e.textContent)), a = document.querySelector('.prio'); return t && a ? t.getBoundingClientRect().top < a.getBoundingClientRect().top : null; });
  ok(pos === true, 'the Priorities to be Focused on box is above the first area');
  ok((await val(p, 'focus')) === '' && /No priority is green yet/.test(await p.evaluate(() => document.getElementById('focusStatus').textContent)), 'it is empty at first, and says why');

  // ---- it fills as priorities turn green ----
  await p.selectOption('[data-f="pr_life"]', 'Priority: client agrees'); await p.waitForTimeout(250);
  await p.selectOption('[data-f="bf_fna_req"]', 'Request a quote');
  await p.selectOption('[data-f="pr_med"]', 'Priority: client agrees');
  await p.selectOption('[data-f="pr_will"]', 'Not a priority');
  await p.selectOption('[data-f="pr_inv"]', 'Client not sure, needs to think about it');
  await p.waitForTimeout(2000);
  let t = await val(p, 'focus');
  ok(/^1\. Personal Risk Covers\n- Request a BrightRock Fractured FNA quote/.test(t) && /\n\n6\. Medical Aid\n/.test(t), 'only the green areas are in it, with their numbers: ' + JSON.stringify(t.slice(0, 120)));
  ok(!/Will|Investment/.test(t), 'the red and the yellow areas are not');
  ok(/Plain points from the green priorities/.test(await p.evaluate(() => document.getElementById('focusStatus').textContent)), 'with no Anthropic key the plain points stay, and the status says so');
  await p.screenshot({ path: process.argv[4] + '/priorities-focus.png', clip: { x: 0, y: 100, width: 1500, height: 760 } });
  await p.selectOption('[data-f="pr_life"]', 'Not a priority'); await p.selectOption('[data-f="pr_med"]', 'Not a priority'); await p.waitForTimeout(2000);
  ok((await val(p, 'focus')) === '', 'when no priority is green the box is empty again');

  // ---- typed over, then Refresh in one tap, with Claude's points ----
  p = await fresh(`(s, b) => JSON.stringify({ areas: { 1: ['Get the BrightRock FNA for the client Thandi', 'Replace the old Liberty cover'] } })`);
  await p.evaluate(() => { FF.lookup.saveSettings({ apiKey: '', model: 'claude-sonnet-5-5', voiceModel: 'claude-sonnet-5-5' }); FF.store.setField(FF.app.state, 'fname', 'Thandi'); FF.app.redraw(); });
  await nav(p, 'prio');
  await p.selectOption('[data-f="pr_life"]', 'Priority: client agrees'); await p.waitForTimeout(2500);
  t = await val(p, 'focus');
  ok(/^1\. Personal Risk Covers\n- Get the BrightRock FNA for the client Thandi\n- Replace the old Liberty cover$/.test(t), 'Claude\'s points go under the heading the form puts in: ' + JSON.stringify(t));
  ok(await p.evaluate(() => window.__asked.length >= 1 && /^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day \d\d\/\d\d\/\d{4}$/.test(window.__asked[window.__asked.length - 1].today)), 'the request to Claude carries today\'s date: ' + (await p.evaluate(() => (window.__asked[window.__asked.length - 1] || {}).today)));
  ok(/Written by Claude/.test(await p.evaluate(() => document.getElementById('focusStatus').textContent)), 'the status says Claude wrote them');
  await p.evaluate(() => { const ta = document.querySelector('[data-f="focus"]'); ta.value = 'My own words'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(/Edited by you/.test(await p.evaluate(() => document.getElementById('focusStatus').textContent)) && /replaces what I typed/.test(await p.evaluate(() => document.getElementById('focusRefresh').textContent)), 'typing in it makes the points yours, and Refresh says it replaces them');
  await p.selectOption('[data-f="pr_med"]', 'Priority: client agrees'); await p.waitForTimeout(2000);
  ok((await val(p, 'focus')) === 'My own words', 'what you typed is left alone when the form changes');
  await p.click('#focusRefresh'); await p.waitForTimeout(2500);
  t = await val(p, 'focus');
  ok(/^1\. Personal Risk Covers\n/.test(t) && /\n\n6\. Medical Aid\n/.test(t) && !/My own words/.test(t), 'one tap on Refresh writes it again over what was typed: ' + JSON.stringify(t.slice(0, 80)));

  // ---- Broker on record ----
  p = await fresh();
  await nav(p, 'cover'); await p.selectOption('[data-f="has_risk"]', 'Yes'); await p.click('button[data-add="risk"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector('[data-l="risk"][data-i="0"][data-k="broker"]').value) === 'Other broker', 'a new policy row starts with Broker on record = Other broker');
  await p.selectOption('[data-l="risk"][data-i="0"][data-k="broker"]', 'Paul K'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => FF.app.state.l.risk[0].d.broker) === 'Paul K', 'and it can be changed');
  await nav(p, 'other');
  const boxes = ['ma_broker', 'gap_broker', 'will_broker', 'sti_broker'];
  ok((await Promise.all(boxes.map(id => val(p, id)))).every(v => v === 'Other broker'), 'the four boxes in Medical, will & short-term start as Other broker, before any answer is given');
  await p.selectOption('[data-f="ma"]', 'Medical aid'); await p.selectOption('[data-f="gap"]', 'Yes'); await p.selectOption('[data-f="will"]', 'Yes'); await p.selectOption('[data-f="sti"]', 'Yes'); await p.waitForTimeout(300);
  ok((await Promise.all(boxes.map(id => val(p, id)))).every(v => v === 'Other broker'), 'and they stay Other broker when the answers above them open the boxes');
  const labels = await p.evaluate(() => [...document.querySelectorAll('.main .f .l > span:first-child')].map(e => e.textContent.trim()).filter(x => /broker/i.test(x)));
  ok(labels.length === 4 && labels.every(x => x === 'Broker on record'), 'all four are labelled Broker on record: ' + labels.join(' | '));
  await p.selectOption('[data-f="will_broker"]', 'Through company'); await p.selectOption('[data-f="ma"]', 'None'); await p.waitForTimeout(250);
  ok((await val(p, 'ma_broker')) === '' && (await val(p, 'will_broker')) === 'Through company', 'None takes the untouched default away; a chosen broker stays');
  await p.screenshot({ path: process.argv[4] + '/priorities-broker.png' });
  // ---- a file saved before these rules existed (the Roquelle file) ----
  p = await fresh();
  const json = await p.evaluate(() => {
    const s = FF.store.blank(), set = (id, v, st) => { s.f[id] = { v, st: st || 'heard' }; };
    set('fname', 'Roquelle'); set('d_desk', '90'); set('d_trav', '10'); set('pr_life', FF.schema.PRIORITY, 'confirmed'); set('pr_med', FF.schema.PRIORITY, 'confirmed'); set('has_risk', 'Yes'); set('has_inv', 'Yes'); set('ma', 'Medical aid'); set('pr_life_cm', 'First priority: relook at the risk covers');
    s.l.risk = [{ d: { prov: 'Liberty', spend: 'R 2 231.35', broker: '', notes: '' }, st: 'heard' }];
    s.l.inv = [{ d: { type: 'Other', prov: 'FNB', val: 'R 11 000.00', prem: 'R 200.00', broker: '' }, st: 'confirmed' }];
    const o = JSON.parse(FF.store.toJSON(s)); delete o.focus; return JSON.stringify(o);
  });
  await p.evaluate(j => { FF.app.setState(FF.store.fromJSON(j)); }, json);
  await nav(p, 'occ');
  ok((await Promise.all(['d_desk', 'd_supo', 'd_trav', 'd_sups', 'd_light', 'd_mod', 'd_heavy'].map(id => val(p, id)))).join(',') === '90,0,10,0,0,0,0', 'an older file opens with 0 in the empty duties when the others add up to 100%');
  await nav(p, 'prio'); await p.waitForTimeout(2200);
  t = await val(p, 'focus');
  ok(/^1\. Personal Risk Covers\n/.test(t) && /\n\n6\. Medical Aid\n/.test(t), 'on arriving at the priorities page the box writes itself for the green areas, with no Refresh and no change: ' + JSON.stringify(t.slice(0, 60)));
  ok(await p.evaluate(() => FF.app.state.l.risk[0].d.broker === 'Other broker' && FF.app.state.l.inv[0].d.broker === 'Other broker' && FF.app.state.f.ma_broker.v === 'Other broker'), 'and the empty Broker on record in its policy rows, and in the Medical aid box, are Other broker');

  // ---- Lump Sum Disability on the BrightRock Risk Calculation page ----
  p = await fresh();
  await p.evaluate(() => { const s = FF.app.state; FF.store.setField(s, 'net', 'R 20 000.00'); FF.store.addRow(s, 'kids', { name: 'A', cost: 'R 5 950.00' }, 'confirmed'); FF.store.addRow(s, 'kids', { name: 'B', cost: 'R 5 150.00' }, 'confirmed'); FF.store.addRow(s, 'debts', { type: 'Credit card', inst: 'R 2 000.00', payer: 'Client' }, 'confirmed'); FF.store.addRow(s, 'debts', { type: 'Revolving credit', inst: 'R 700.00', payer: 'Client' }, 'confirmed'); FF.app.redraw(); });
  await nav(p, 'calc');
  const titles = await p.evaluate(() => [...document.querySelectorAll('.main .block-title')].map(e => e.textContent.trim()));
  ok(titles.includes('Lump Sum Disability: fractured cover') && !titles.some(t => /^Permanent disability: fractured/.test(t)), 'the block is called Lump Sum Disability: fractured cover: ' + titles.join(' | '));
  ok(!/same household income needed as the Life cover/.test(await p.evaluate(() => document.body.innerText)), 'and no longer says it is built on the Life cover');
  const pdv = await p.evaluate(() => ['pd_hh', 'pd_cc', 'pd_dr', 'pd_need', 'pd_hhabi', 'pd_ccabi'].map(id => (document.querySelector('[data-f="' + id + '"]') || {}).value));
  ok(pdv.join(' | ') === 'R 20 000.00 | R 11 100.00 | R 2 700.00 | R 6 200.00 | 5% | 5%', 'it shows its own four figures and the two ABIs: ' + pdv.join(' | '));
  ok(await p.evaluate(() => ['pd_hh', 'pd_cc', 'pd_dr', 'pd_need'].every(id => { const e = document.querySelector('[data-f="' + id + '"]'); return e && (e.readOnly || e.disabled); })), 'the four sums cannot be typed over');
  await p.screenshot({ path: process.argv[4] + '/priorities-lumpsum.png', clip: { x: 0, y: 100, width: 1500, height: 800 } });

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
