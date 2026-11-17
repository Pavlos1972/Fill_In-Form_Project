/* Release 4.6 on the real page: the "heard" tag stays a small tag (beside "Look up online", in a list row's header, in a box), the microphone line keeps its style, and Gap cover is greyed while Medical aid is None. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => {
    const S = FF.app.state, st = FF.store, set = (id, v, s) => { S.f[id].v = v; S.f[id].st = s; };
    set('employed', 'Yes', 'confirmed'); set('employer', 'Easitape', 'confirmed');
    set('co_does', 'Technical sales: visits client sites, assesses what they use and arranges bulk packaging tape deals, also sells rubber seals and mouldings to companies selling into mines', 'heard');
    set('years', '3', 'heard'); set('bizowner', 'Yes', 'confirmed'); set('biz_name', 'Easitape consulting', 'confirmed'); set('biz_does', 'Technical sales rep consulting', 'verify');
    set('has_debts', 'Yes', 'confirmed'); st.addRow(S, 'debts', {}); S.l.debts[0].st = 'heard'; S.l.debts[0].d.type = 'Home loan';
    FF.app.redraw();
  });
  const go = async id => { await p.click('.nav button[data-sec="' + id + '"]'); await p.waitForTimeout(300); };
  const box = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);

  await go('occ');
  const lab = await box('[data-field="co_does"] > .l'), tag = await box('[data-field="co_does"] .rt > .badge.heard'), look = await box('[data-field="co_does"] .rt > .lookup');
  ok(tag && look && lab, 'the label row has "Look up online" and the heard tag');
  ok(tag.w < 80 && tag.h < 26, 'the heard tag is a small tag, not a bar (' + Math.round(tag.w) + ' x ' + Math.round(tag.h) + ' px)');
  ok(tag.r <= lab.r + 1, 'the tag does not run past the right edge of its label row');
  ok(Math.abs((tag.y + tag.h / 2) - (look.y + look.h / 2)) < 8, '"Look up online" and the tag sit on one line');
  ok(look.r <= tag.x + 1, '"Look up online" is to the left of the tag');
  const inbox = await box('[data-field="years"] .box .st .badge.heard, [data-field="years"] .badge.heard');
  const conf = await box('[data-field="employed"] .badge.confirmed');
  ok(inbox && conf && inbox.h <= conf.h + 3, 'a heard tag inside a box is the same height as a confirmed one (' + Math.round(inbox.h) + ' and ' + Math.round(conf.h) + ' px)');
  const wide = await box('[data-field="biz_does"] .rt > .badge');
  ok(wide && wide.w < 90, 'an amber verify tag beside Look up online is a tag too (' + Math.round(wide.w) + ' px)');
  await p.screenshot({ path: out + '/release46-occupation.png' });

  await go('debts');
  const head = await box('.rc-debts .rowhead'), card = await box('.rc-debts'), htag = await box('.rc-debts .rowhead .badge.heard'), x = await box('.rc-debts .rowhead .x');
  ok(head && htag && htag.w < 80, 'the heard tag in the Debt 1 header is a small tag (' + Math.round(htag.w) + ' px)');
  ok(x && x.r <= card.r + 1 && x.x >= card.x, 'the Remove button is inside the card, on the right (' + Math.round(x.r) + ' of ' + Math.round(card.r) + ')');
  ok(head.h < 40, 'the header is one line (' + Math.round(head.h) + ' px high)');
  await p.screenshot({ path: out + '/release46-debts.png' });

  const mic = await p.evaluate(() => { const e = document.getElementById('heard'); e.hidden = false; const c = getComputedStyle(e), r = e.getBoundingClientRect(); const res = { d: c.display, w: r.width, bg: c.backgroundColor }; e.hidden = true; return res; });
  ok(mic.d === 'flex' && mic.w > 400, 'the microphone line is still a full-width line (' + mic.d + ', ' + Math.round(mic.w) + ' px)');

  await go('other');
  const state = () => p.evaluate(() => ['ma', 'gap', 'gap_prov', 'gap_broker', 'n_gap', 'ma_prov', 'n_ma'].reduce((o, id) => { const w = document.querySelector('[data-field="' + id + '"]'); o[id] = w ? w.hasAttribute('inert') : null; return o; }, {}));
  await p.selectOption('[data-f="ma"]', 'Medical aid'); await p.waitForTimeout(250);
  let st = await state();
  ok(st.gap === false && st.gap_prov === false && st.gap_broker === false, 'with a medical aid the Gap cover boxes are open');
  await p.selectOption('[data-f="ma"]', 'None'); await p.waitForTimeout(300);
  st = await state();
  ok(st.gap === true && st.gap_prov === true && st.gap_broker === true, 'Medical aid None: Gap cover, its provider and its broker are greyed out');
  ok(st.ma_prov === true, 'the Medical aid boxes are greyed as before');
  ok(st.n_gap === false && st.n_ma === false, 'both notes boxes stay open');
  ok(await p.evaluate(() => document.querySelector('[data-field="gap"]').classList.contains('off')), 'the grey look is on (the "off" class)');
  const brk = await p.evaluate(() => FF.app.state.f.gap_broker.v === '' && FF.app.state.f.ma_broker.v === '');
  ok(brk, 'no default broker is left under a greyed box');
  await p.screenshot({ path: out + '/release46-medical-none.png' });
  await p.selectOption('[data-f="ma"]', 'Hospital plan'); await p.waitForTimeout(300);
  st = await state();
  ok(st.gap === false && st.gap_prov === false, 'a hospital plan opens the Gap cover boxes again');
  ok(await p.evaluate(() => FF.app.state.f.gap_broker.v === 'Other broker' && FF.app.state.f.gap_broker.st === 'preset'), 'and the gap broker default is back');
  await p.selectOption('[data-f="gap"]', 'Yes'); await p.waitForTimeout(200);
  await p.selectOption('[data-f="ma"]', 'None'); await p.waitForTimeout(300);
  const warn = await p.evaluate(() => [...document.querySelectorAll('#checks button, .checks button, [data-goto]')].map(e => e.textContent).filter(t => /gap cover details/.test(t)));
  ok(warn.length === 1, 'the Checks panel says a Yes is left under no medical aid: ' + (warn[0] || '').slice(0, 90));
  ok(await p.evaluate(() => FF.app.state.f.gap.v === 'Yes'), 'and nothing was cleared');
  const noStretch = await p.evaluate(() => [...document.querySelectorAll('.badge')].every(e => e.getBoundingClientRect().width < 140));
  ok(noStretch, 'no tag on this page is wider than 140 px');

  for (const w of [1280, 800]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'at ' + w + ' wide the page does not scroll sideways'); }
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
