/* The Fact Find 5.5 on the real page (24 November 2026, from the Fix Skills chat for Paul: on a real review client's Fact Find the Progress card said 58 filled / 30 to verify / 20 not asked, yet every pill he looked at said CONFIRMED).
   The card counted (1) optional notes boxes, which never drew a pill, and (2) boxes, blocks and pages that a rule hides, which are not drawn at all. 5.5: the number is what can be SEEN: every counted item draws its pill (a notes box gets an amber
   one and an amber border), a hidden one is not counted, each page button says how many are on it, and the walk names the page and lands on every counted item. The invariant checked here: the Progress number equals the amber pills on
   all the pages. An invented client only. Screenshot (deviceScaleFactor 1): r12-verify. Run against 5.4 the checks FAIL. */
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:' + srv.address().port + '/index.html'); await p.waitForFunction(() => window.FF && FF.app && FF.app.state, null, { timeout: 8000 }); await p.waitForTimeout(500);
  const card = () => p.evaluate(() => +document.getElementById('sVerify').textContent);
  const toast = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
  /* an invented client with amber answers in several places */
  await p.evaluate(() => {
    const S = FF.app.state, set = (id, v, st) => FF.store.setField(S, id, v, st);
    set('fname', 'Test', 'confirmed'); set('sname', 'Client', 'confirmed'); set('has_debts', 'Yes', 'confirmed');
    set('n_info', 'A note from the file', 'verify');                    // an optional notes box on Client info
    set('cell', '082 555 0100', 'verify');                              // a plain box on Client info
    set('n_income', 'Another note', 'verify');                          // an optional notes box on Income & household
    FF.store.addRow(S, 'debts', { type: 'Home loan' }, 'verify');       // a row of a list
    set('pr_life', 'Priority: client agrees', 'verify');                // an advisor page (Client priorities)
    set('nat_other', 'Elbonian', 'verify');                             // greyed out: its rule (nationality Other) is not met
    set('marr_date', '01/01/2010', 'verify');                           // not drawn at all: its rule (a marital status that has a marriage) is not met
    FF.app.redraw();
  });
  ok(await p.evaluate(() => FF.app.state.f.nat_other.st === 'verify' && FF.app.state.f.marr_date.st === 'verify' && FF.app.state.f.nat.v !== 'Other' && !document.querySelector('[data-field="marr_date"]')), '0. set-up: two amber answers are on boxes whose rule is not met (one greyed out, one not drawn)');
  const N = await card();
  ok(N === 5, '1. the Progress card counts the five amber answers that can be acted on, not the two whose rule is not met (it says ' + N + ')');

  /* the invariant: the number equals the amber pills on all the pages */
  const ids = await p.evaluate(() => FF.schema.sections.map(s => s.id));
  let pills = 0, hiddenPill = null; const per = {};
  for (const id of ids) {
    await p.click('#nav [data-sec="' + id + '"]'); await p.waitForTimeout(80);
    const n = await p.evaluate(() => [...document.querySelectorAll('#main .badge.verify')].filter(e => e.checkVisibility() && !e.closest('.off')).length); per[id] = n; pills += n;
    if (id === 'info') hiddenPill = await p.evaluate(() => { const w = document.querySelector('[data-field="nat_other"]'); return { inDom: !!(w && w.querySelector('.badge.verify')), greyed: !!(w && w.closest('.off') || w && w.classList.contains('off')), gone: !document.querySelector('[data-field="marr_date"]') }; });
  }
  ok(hiddenPill && hiddenPill.inDom && hiddenPill.greyed && hiddenPill.gone, '2a. the greyed-out amber box is on the page but inert and grey, the other is not drawn at all (the old count included both: a number with nothing to confirm)');
  ok(pills === N, '2. the amber pills the adviser can act on, on all the pages add up to the Progress number (' + pills + ' pills, ' + N + ' counted; per page ' + JSON.stringify(per) + ')');

  /* a notes box draws its pill and an amber border */
  await p.click('#nav [data-sec="info"]'); await p.waitForTimeout(100);
  const note = await p.evaluate(() => { const w = document.querySelector('[data-field="n_info"]'), plain = document.querySelector('[data-field="cell"] input'), ta = w && w.querySelector('textarea'); return { pill: !!(w && w.querySelector('.badge.verify')), ta: ta ? getComputedStyle(ta).borderColor : '', plain: plain ? getComputedStyle(plain).borderColor : '' }; });
  ok(note.pill, '3. the notes box on Client info that waits to be verified draws an amber verify pill (it drew none before)');
  ok(note.ta && note.ta === note.plain, '4. and its border is amber like a plain box that waits (' + note.ta + ')');

  /* the page buttons carry the count */
  const chips = await p.evaluate(() => [...document.querySelectorAll('#nav [data-vcount]')].filter(e => !e.hidden).map(e => e.getAttribute('data-vcount') + '=' + e.textContent));
  ok(chips.join(',') === 'info=2 to verify,income=1 to verify,debts=1 to verify,prio=1 to verify', '5. the page buttons say how many are on each page: ' + chips.join(', '));
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav [data-vcount]')].every(e => e.hidden ? !e.checkVisibility() : e.checkVisibility())), '5b. a page with nothing to verify shows no chip at all (a hidden chip takes no room)');
  await p.screenshot({ path: out + '/r12-verify.png' });

  /* the walk: five clicks visit the five counted answers, each one drawn and named with its page */
  const seen = [];
  for (let i = 0; i < N; i++) {
    await p.click('#sVerifyBox'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => { const f = document.querySelector('.flash'); return { on: !!f, visible: !!f && f.checkVisibility(), label: (document.querySelector('#toast') || {}).textContent || '' }; });
    seen.push(r);
  }
  ok(seen.every(r => r.on && r.visible), '6. every click of "to verify" lands on a drawn, visible answer (' + seen.filter(r => r.on && r.visible).length + ' of ' + N + ')');
  ok(new Set(seen.map(r => r.label.replace(/\s*\(\d+ of \d+\)/, ''))).size === N && seen.every((r, i) => r.label.indexOf('(' + (i + 1) + ' of ' + N + ')') >= 0), '7. five clicks visit five different answers, counted one to five: ' + seen.map(r => r.label.slice(0, 60)).join(' | '));
  ok(seen.every(r => /\(page: [^)]+\)/.test(r.label)), '8. and the message names the page each one is on');

  /* confirming a notes box by its pill */
  await p.click('#nav [data-sec="info"]'); await p.waitForTimeout(100);
  await p.click('[data-field="n_info"] .badge.verify'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => FF.app.state.f.n_info.st === 'confirmed' && !document.querySelector('[data-field="n_info"] .badge')) && await card() === 4, '9. clicking the notes box\'s pill confirms it, the pill goes away and the number falls to 4');
  ok(await p.evaluate(() => { const e = document.querySelector('[data-vcount="info"]'); return e && !e.hidden && e.textContent === '1 to verify'; }), '10. and the Client info button says 1 to verify');

  /* typing into a waiting notes box confirms it too */
  await p.click('#nav [data-sec="income"]'); await p.waitForTimeout(100);
  await p.click('[data-f="n_income"]'); await p.keyboard.type(' typed'); await p.keyboard.press('Tab'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => FF.app.state.f.n_income.st === 'confirmed' && !document.querySelector('[data-field="n_income"] .badge')) && await card() === 3, '11. typing into a waiting notes box confirms it, its pill goes away and the number falls to 3');

  /* Verify All confirms what is counted and leaves the hidden box alone */
  await p.click('#btnVerifyAll'); await p.waitForTimeout(300);
  ok(await card() === 0 && await p.evaluate(() => FF.app.state.f.nat_other.st === 'verify' && ![...document.querySelectorAll('#nav [data-vcount]')].some(e => !e.hidden)), '12. Verify All brings the number to 0, hides every page count, and leaves the box that was never shown amber');

  /* when the nationality is Other the hidden box is shown, drawn and counted */
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'nat', 'Other', 'confirmed'); FF.app.redraw(); });
  await p.click('#nav [data-sec="info"]'); await p.waitForTimeout(100);
  ok(await card() === 1 && await p.evaluate(() => !!document.querySelector('[data-field="nat_other"] .badge.verify')), '13. once the nationality is Other that box is shown with its amber pill and counted');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASSED'); process.exit(bad ? 1 : 0);
});
