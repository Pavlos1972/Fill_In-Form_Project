/* Release 3.9 on the real page: the BrightRock Risk Calculation follows the client's BrightRock policy (its Yearly base increase is the ACI of all four benefits, the ABI is left alone; Dread is R 500 000 or the policy's
   cover, whichever is more); a percentage typed alone gets its % when the box is left; no debts is R 0.00 with a note; and the PDF carries the note and the policy block. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  const val = id => p.evaluate(id => (document.querySelector('[data-f="' + id + '"]') || {}).value, id);
  const nav = async s => { await p.click('.nav button[data-sec="' + s + '"]'); await p.waitForTimeout(250); };
  const leave = async id => { await p.click('[data-f="' + id + '"]', { clickCount: 1 }); await p.keyboard.press('Tab'); await p.waitForTimeout(250); };
  const typeIn = async (id, t) => { await p.fill('[data-f="' + id + '"]', t); await p.keyboard.press('Tab'); await p.waitForTimeout(300); };
  const text = () => p.evaluate(() => document.getElementById('main').textContent);

  /* no BrightRock policy: no block, the ACI values are "?", Dread R 500 000 */
  await nav('calc');
  ok(!(await text()).includes('Current BrightRock policy'), 'no BrightRock policy: the policy block is not there');
  ok((await val('lc_f_aciv')) === '?' && (await val('dd_aciv')) === '?' && (await val('dd_cover')) === 'R 500 000.00', 'no policy: the ACI values are "?" and Dread is R 500 000.00');

  /* a BrightRock policy on the cover page: the block appears */
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'has_risk', 'Yes'); FF.store.addRow(FF.app.state, 'risk', { prov: 'BrightRock', spend: 'R 1 607.60' }); FF.app.redraw(); });
  await nav('calc');
  ok((await text()).includes('Current BrightRock policy'), 'a BrightRock policy is listed: the policy block shows');
  await typeIn('br_aci', '3');
  ok((await val('br_aci')) === '3%', 'the percentage typed as 3 shows 3% when the box is left');
  ok((await val('lc_f_aciv')) === '3%' && (await val('pd_f_aciv')) === '3%' && (await val('ip_aciv')) === '3%' && (await val('dd_aciv')) === '3%', 'all four ACI values show the policy\'s 3%');
  ok(await p.evaluate(() => ['lc_f_aciv', 'pd_f_aciv', 'ip_aciv', 'dd_aciv'].every(id => FF.app.state.f[id].st === 'preset')), 'they are defaults (preset), not answers');
  ok((await val('lc_wol')) === '3%' && (await val('lc_ccabi')) === '5%' && (await val('pd_hhabi')) === '5%' && (await val('ip_abiv')) === '5%' && (await val('dd_abiv')) === '3%', 'the ABI boxes keep their own values');

  /* typing over, and the % on any percentage box */
  await typeIn('ip_aciv', '6');
  ok((await val('ip_aciv')) === '6%', 'typing 6 in an ACI box gives 6%');
  await typeIn('br_aci', '4.5');
  ok((await val('lc_f_aciv')) === '4.5%' && (await val('ip_aciv')) === '6%', 'a new policy figure follows, except the box typed over');
  await typeIn('lc_ccabi', '7'); ok((await val('lc_ccabi')) === '7%', 'an ABI box takes the % too');

  /* Dread */
  await typeIn('br_dd_cover', '400000'); ok((await val('br_dd_cover')) === 'R 400 000.00' && (await val('dd_cover')) === 'R 500 000.00', 'the policy\'s cover of R 400 000 is less: Dread is R 500 000.00');
  await typeIn('br_dd_cover', '500000'); ok((await val('dd_cover')) === 'R 500 000.00', 'R 500 000 on the policy: R 500 000.00');
  await typeIn('br_dd_cover', '750000'); ok((await val('dd_cover')) === 'R 750 000.00', 'more than R 500 000 on the policy: the policy\'s amount');

  /* no debts */
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'net', 'R 42 538.00'); FF.app.redraw(); });
  await nav('calc');
  ok((await val('lc_dr')) === '' && !(await text()).includes('Client has no debts'), 'Has debts not answered: the debt repayments are empty, no note');
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'has_debts', 'No'); FF.app.redraw(); });
  await nav('calc');
  ok((await val('lc_dr')) === 'R 0.00' && (await val('pd_dr')) === 'R 0.00', 'Has debts No: the debt repayments are R 0.00 on both');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-fnote]')].filter(e => !e.hidden && /Client has no debts/.test(e.textContent)).length === 2), 'the note "Client has no debts" is under both boxes');

  /* the PDF carries the policy block, the figures and the note */
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/r39.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/r39.pdf', '-']).toString().replace(/\s+/g, ' ');
  ok(/Client has no debts/.test(raw), 'the PDF has the note "Client has no debts"');
  ok(/Current BrightRock policy/.test(raw) && /Yearly base increase on the policy/.test(raw) && /4\.5%/.test(raw) && /R 750 000\.00/.test(raw), 'the PDF has the policy block with its figures');

  /* the policy removed: the block goes and the defaults go back */
  await p.evaluate(() => { FF.store.delRow(FF.app.state, 'risk', 0); FF.app.redraw(); });
  await nav('calc');
  ok(!(await text()).includes('Current BrightRock policy') && (await val('lc_f_aciv')) === '?' && (await val('ip_aciv')) === '6%' && (await val('dd_cover')) === 'R 500 000.00', 'the policy removed: the block goes, the defaults go back to "?" and R 500 000.00, the typed 6% stays');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
