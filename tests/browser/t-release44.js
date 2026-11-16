/* Release 4.4 on the real page: the "Other forms" menu in the top bar opens with both links, closes on Escape, on a click elsewhere and once a link is chosen; the keys-and-costs table is still there. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  const open = () => p.evaluate(() => document.getElementById('otherForms').open);
  const vis = id => p.evaluate(id => document.getElementById(id).checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }), id);
  ok((await p.textContent('#otherForms summary')).trim() === 'Other forms ▾', 'one button says Other forms');
  ok(!(await open()) && !(await vis('linkSR')) && !(await vis('linkCS')), 'closed: the two links are hidden');
  await p.click('#otherForms summary'); await p.waitForTimeout(150);
  ok((await open()) && (await vis('linkSR')) && (await vis('linkCS')), 'opened: both links show');
  ok((await p.getAttribute('#linkSR', 'href')) === 'short-risk.html' && (await p.getAttribute('#linkCS', 'href')) === 'capture-sheet.html', 'they go to the Short Risk Application and the Capture Sheet');
  ok((await p.getAttribute('#linkSR', 'target')) === '_blank' && (await p.getAttribute('#linkCS', 'target')) === '_blank', 'each opens in another tab');
  const box = await p.evaluate(() => { const r = document.querySelector('.ofmenu').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, r.top >= 0]; });
  ok(box.every(Boolean), 'the menu is fully on the screen');
  await p.screenshot({ path: out + '/shots/release44-open.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await open()), 'Escape closes it');
  await p.click('#otherForms summary'); await p.waitForTimeout(100);
  await p.click('#clientName'); await p.waitForTimeout(100);
  ok(!(await open()), 'a click elsewhere closes it');
  await p.click('#otherForms summary'); await p.waitForTimeout(100);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('#linkSR')]);
  await p.waitForTimeout(150);
  ok(!(await open()), 'choosing a link closes it');
  ok(!!pop && /short-risk\.html$/.test(pop.url()), 'and the Short Risk Application opened in another tab: ' + (pop && pop.url()));
  ok(await p.evaluate(() => !!document.getElementById('svcTable')), 'the keys-and-costs table is still in the top bar');
  for (const w of [1100, 800, 390]) { await p.setViewportSize({ width: w, height: 900 }); await p.click('#otherForms summary'); await p.waitForTimeout(100);
    const r = await p.evaluate(() => { const r = document.querySelector('.ofmenu').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
    ok(r, 'at ' + w + ' wide the open menu stays on the screen'); await p.keyboard.press('Escape'); }
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
