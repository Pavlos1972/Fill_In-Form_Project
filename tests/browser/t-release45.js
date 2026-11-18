/* Release 4.5 on the real page: each meeting held is one line (date, day, type, others, covered); the list folds and stays shut or open as left; the day follows the date. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => {
    const S = FF.app.state, st = FF.store; st.addRow(S, 'meetings', {});            // the first press makes the meeting so far meeting 1 and adds the next
    const a = S.l.meetings[0].d, c = S.l.meetings[1].d;
    a.date = '14/10/2026'; a.type = 'Teams Meeting'; a.who = 'Annabel Kuiper van Wyk'; a.covered = 'Client info';
    c.date = '28/10/2026'; c.type = 'Teams Meeting'; c.who = 'Annabel Kuiper van Wyk';
    FF.app.redraw();
  });
  await p.waitForTimeout(300);
  ok(!!(await p.$('details.fold[data-fold="meetings"]')), 'the meetings held are in a folding block');
  ok(await p.evaluate(() => document.querySelector('details.fold').open), 'open at first');
  ok((await p.$$('.rc-meetings')).length === 2, 'two meetings, two rows');
  const tops = await p.evaluate(() => [...document.querySelectorAll('.rc-meetings')].map(r => [...r.querySelectorAll('input,select')].map(e => Math.round(e.getBoundingClientRect().top))));
  ok(tops.every(t => t.length >= 5 && Math.max(...t) - Math.min(...t) < 6), 'each meeting is one line of boxes: ' + JSON.stringify(tops));
  const h = await p.evaluate(() => Math.round(document.querySelector('.rc-meetings').getBoundingClientRect().height));
  ok(h < 90, 'a meeting row is short (' + h + ' px)');
  const dayOf = () => p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="0"][data-k="day"]').value);
  ok((await dayOf()) === 'Wednesday', 'the day shows: ' + await dayOf());
  await p.fill('[data-l="meetings"][data-i="0"][data-k="date"]', '16/11/2026'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  ok((await dayOf()) === 'Monday', 'the day follows the date: ' + await dayOf());
  ok(await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="0"][data-k="day"]').readOnly), 'the day cannot be typed over');
  const sum = await p.textContent('details.fold > summary');
  ok(/Meetings held/.test(sum) && /2 meetings/.test(sum), 'the heading line says how many: ' + sum.trim());
  await p.screenshot({ path: out + '/shots/release45-open.png' });
  await p.click('details.fold > summary'); await p.waitForTimeout(150);
  ok(!(await p.evaluate(() => document.querySelector('details.fold').open)), 'a click on the heading folds it');
  await p.evaluate(() => FF.app.redraw()); await p.waitForTimeout(150);
  ok(!(await p.evaluate(() => document.querySelector('details.fold').open)), 'and it stays shut after the page is redrawn');
  await p.click('details.fold > summary'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelector('details.fold').open), 'and opens again');
  await p.setViewportSize({ width: 800, height: 900 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'at 800 wide the page does not scroll sideways');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
