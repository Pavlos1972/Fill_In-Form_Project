/* Version 3.2: the Current Client section on Admin: greyed out unless Referral from is Current client, full width under the Letter of Authority, Next appointment and Action Points (which keep their places),
   typed by hand, kept in the saved file when Referral from changes. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  const nav = name => p.evaluate(n => { const x = [...document.querySelectorAll('.nav button')].find(e => e.innerText.trim().startsWith(n)); if (x) x.click(); }, name);
  const box = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
  const grey = () => p.evaluate(() => { const e = document.querySelector('[data-f="cc_notes"]'); return e ? !!e.closest('[inert], .off') : 'absent'; });

  // not a current client yet
  await nav('Admin'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => /CURRENT CLIENT/i.test([...document.querySelectorAll('.block-title')].map(e => e.textContent).join('|'))), 'the section Current Client is on Admin');
  ok(await p.evaluate(() => /Current Client File Summary Notes/.test(document.body.innerText)), 'with the label Current Client File Summary Notes');
  ok(await grey() === true, 'greyed out while Referral from is empty');
  ok(await p.evaluate(() => /Only for a current client/.test(document.body.innerText)), 'and it says why');

  // the layout: Letter of Authority left, Action Points right, Current Client across the bottom
  const loa = await box('[data-f="loa"]'), pa = await box('[data-f="pa_actions"]'), cc = await box('[data-f="cc_notes"]');
  ok(loa && pa && cc && pa.l > loa.r - 5, 'the Action Points stay to the right of the Letter of Authority');
  ok(cc.t > pa.b - 5 && cc.l <= loa.l + 2 && cc.r >= pa.r - 2, 'Current Client is across the full width under both: ' + JSON.stringify({ loa, pa, cc }));
  ok(cc.b - cc.t > 180, 'the box is large (' + Math.round(cc.b - cc.t) + ' px high)');

  // set Referral from to Current client on Client info
  await nav('Client info'); await p.waitForTimeout(150);
  await p.selectOption('[data-f="ref"]', 'Current client'); await p.waitForTimeout(250);
  await nav('Admin'); await p.waitForTimeout(250);
  ok(await grey() === false, 'active when Referral from is Current client');
  await p.fill('[data-f="cc_notes"]', '- Client since 2019\n- Prefers WhatsApp'); await p.evaluate(() => document.querySelector('[data-f="cc_notes"]').dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(200);
  ok(await p.evaluate(() => FF.app.state.f.cc_notes.v === '- Client since 2019\n- Prefers WhatsApp'), 'it can be typed in and is kept on the form');
  ok(await p.evaluate(() => JSON.parse(FF.store.toJSON(FF.app.state)).f.cc_notes.v.indexOf('Prefers WhatsApp') > 0), 'and is in the saved file');

  // any other referral greys it again, and keeps the text
  await nav('Client info'); await p.waitForTimeout(150);
  await p.selectOption('[data-f="ref"]', 'Spouse'); await p.waitForTimeout(250);
  await nav('Admin'); await p.waitForTimeout(250);
  ok(await grey() === true, 'greyed out again for another referral');
  ok(await p.evaluate(() => FF.app.state.f.cc_notes.v.indexOf('Client since 2019') >= 0), 'what was typed is kept');

  // version 3.3: headings in bold in the box (a read view), plain text in the file
  await nav('Client info'); await p.waitForTimeout(150);
  await p.selectOption('[data-f="ref"]', 'Current client'); await p.waitForTimeout(250);
  await nav('Admin'); await p.waitForTimeout(250);
  const NOTES = 'STILL OPEN\n- Sep 2026 - Open: client to send Old Mutual RA statement\n\n2026 (REVIEW DONE: MAR 2026)\n- Oct 2026 - COL: Discovery, +50% loading\n\nEARLIER, STILL IMPORTANT';
  await p.evaluate(n => { const e = document.querySelector('[data-f="cc_notes"]'); e.focus(); e.value = n; e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); }, NOTES); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('[data-field="cc_notes"]').classList.contains('rv-on')), 'after typing, the box shows its read view');
  const w = await p.evaluate(() => [...document.querySelectorAll('[data-field="cc_notes"] .rv .ln')].map(e => [e.textContent, +getComputedStyle(e).fontWeight]));
  ok(w.filter(x => x[1] >= 600).map(x => x[0]).join('|') === 'STILL OPEN|2026 (REVIEW DONE: MAR 2026)|EARLIER, STILL IMPORTANT', 'the headings are bold: ' + JSON.stringify(w.filter(x => x[1] >= 600).map(x => x[0])));
  ok(w.filter(x => /^- /.test(x[0])).every(x => x[1] < 600), 'the points are not');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('[data-f="cc_notes"]')).display === 'none'), 'the plain textarea is out of the way');
  ok(await p.evaluate(n => FF.app.state.f.cc_notes.v === n && JSON.parse(FF.store.toJSON(FF.app.state)).f.cc_notes.v === n, NOTES), 'the text on the form and in the file is plain, as typed');
  await p.click('[data-field="cc_notes"] .rv'); await p.waitForTimeout(200);
  ok(await p.evaluate(n => { const t = document.querySelector('[data-f="cc_notes"]'); return getComputedStyle(t).display !== 'none' && t.value === n && document.activeElement === t; }, NOTES), 'a click opens the plain text for typing');
  await p.keyboard.type('\nCHECK AGAINST THE CLIENT FILE'); await p.evaluate(() => document.querySelector('[data-f="cc_notes"]').blur()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /CHECK AGAINST THE CLIENT FILE/.test(FF.app.state.f.cc_notes.v) && [...document.querySelectorAll('[data-field="cc_notes"] .rv .ln.hd')].some(e => e.textContent === 'CHECK AGAINST THE CLIENT FILE')), 'what was typed joins the text and shows bold when the box is left');
  await p.click('[data-rvedit="cc_notes"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('[data-f="cc_notes"]')).display !== 'none'), 'the Edit link opens it too');
  await p.evaluate(() => document.querySelector('[data-f="cc_notes"]').blur()); await p.waitForTimeout(250);

  // a skill writes into a file, which then opens with the points showing (amber)
  const opened = await p.evaluate(() => { const j = JSON.parse(FF.store.toJSON(FF.app.state)); j.f.ref = { v: 'Current client', st: 'confirmed' }; j.f.cc_notes = { v: '- A point from the skill', st: 'verify' }; FF.app.setState(FF.store.fromJSON(JSON.stringify(j))); return FF.app.state.f.cc_notes.st; });
  await nav('Admin'); await p.waitForTimeout(250);
  ok(opened === 'verify' && await p.evaluate(() => document.querySelector('[data-f="cc_notes"]').value === '- A point from the skill'), 'a file written by the skill opens with its points in the box, to verify');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close();
  process.exit(bad ? 1 : 0);
})();
