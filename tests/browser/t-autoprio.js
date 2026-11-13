/* Version 3.4 on the real page: the automatic Not a priority (what it looks like, the preset tag, the reworded red line, going again, the adviser taking an area over), the suggestion lines and their buttons,
   the one "no", and an older file opened. */
const { chromium } = require(process.argv[2] + '/playwright');
const fs = require('fs'), path = require('path');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const fresh = async () => {
    const c = await b.newContext({ viewport: { width: 1500, height: 1100 } }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + process.argv[3] + '/index.html'); await p.waitForTimeout(300);
    return p;
  };
  const setF = (p, o) => p.evaluate(o => { Object.keys(o).forEach(k => FF.store.setField(FF.app.state, k, o[k])); FF.app.redraw(); }, o);
  const go = (p, sec) => p.click('.nav button[data-sec="' + sec + '"]').then(() => p.waitForTimeout(300));
  const st = (p, id) => p.evaluate(id => FF.app.state.f[id], id);
  const val = (p, id) => p.evaluate(id => (document.querySelector('[data-f="' + id + '"]') || {}).value, id);
  const area = (p, id, q) => p.evaluate(([id, q]) => { const a = document.querySelector('[data-prio="' + id + '"]'); return a ? (q === 'class' ? a.className : q === 'chip' ? a.querySelector('.chip').textContent : q === 'warn' ? ((a.querySelector('.note.warn') || {}).textContent || '') : q === 'sug' ? ((a.querySelector('[data-sug-line]') || {}).innerText || '').replace(/\s+/g, ' ') : '') : null; }, [id, q]);

  // 1. medical aid through the company is decided by the form
  let p = await fresh();
  await setF(p, { ma: 'Medical aid', ma_prov: 'Discovery Health', ma_broker: 'Through company', gap: 'No' });
  await go(p, 'prio');
  ok(await area(p, 'med', 'class') && /\bp2\b/.test(await area(p, 'med', 'class')) && await area(p, 'med', 'chip') === 'Not a priority', 'the Medical Aid area is red and says Not a priority, nobody having touched it');
  ok(await val(p, 'pr_med') === 'Not a priority', 'the decision box reads just "Not a priority": ' + await val(p, 'pr_med'));
  ok(/Medical aid is paid through the client's company/.test(await val(p, 'pr_med_cm')), 'the comment is written: ' + (await val(p, 'pr_med_cm')).slice(0, 70));
  ok(await val(p, 'ref_med') === 'Not required', 'the referral to Valerie is Not required');
  ok((await p.evaluate(() => ['pr_med', 'pr_med_cm', 'ref_med'].every(id => document.querySelector('[data-field="' + id + '"], [data-f="' + id + '"]').closest('.f').className.indexOf('s-preset') >= 0))), 'all three carry the grey preset tag');
  ok(/^Set from the earlier pages\. Change the decision if the client wants it\./.test(await area(p, 'med', 'warn')), 'the red line says the form set it, not the client: ' + await area(p, 'med', 'warn'));
  ok(await area(p, 'med', 'sug') === '', 'no suggestion line when the form has decided');
  ok(await p.evaluate(() => document.querySelector('[data-f="pr_med_cm"]').rows >= 3), 'the comment box has room for a written reason');
  const opts = await p.evaluate(() => [...document.querySelector('[data-f="pr_med"]').options].map(o => o.textContent.trim()).filter(Boolean).join(' | '));
  ok(opts === 'Priority: client agrees | Not a priority', 'the decision has two choices, no new ones: ' + opts);

  // 2. the fact changes: it goes; the adviser takes over: it stays
  await go(p, 'other'); await p.selectOption('[data-f="ma_broker"]', 'Paul K'); await p.waitForTimeout(200); await go(p, 'prio');
  ok(await val(p, 'pr_med') === '' && await val(p, 'pr_med_cm') === '' && await val(p, 'ref_med') === '', 'with the broker changed to Paul K the decision, the comment and the referral all go');
  await go(p, 'other'); await p.selectOption('[data-f="ma_broker"]', 'Through company'); await p.waitForTimeout(200); await go(p, 'prio');
  ok(await val(p, 'pr_med') === 'Not a priority', 'and come back when the fact does');
  await p.selectOption('[data-f="pr_med"]', 'Priority: client agrees'); await p.waitForTimeout(250);
  ok(await area(p, 'med', 'chip') === 'Priority' && (await st(p, 'pr_med')).st === 'confirmed', 'the adviser chose Priority: it is green and his');
  await go(p, 'other'); await p.selectOption('[data-f="ma_broker"]', 'Other broker'); await p.selectOption('[data-f="ma_broker"]', 'Through company'); await p.waitForTimeout(200); await go(p, 'prio');
  ok(await val(p, 'pr_med') === 'Priority: client agrees', 'the form never sets that area again');

  // 3. a typed "not a priority" says the old thing; Life is never decided by the form
  await p.selectOption('[data-f="pr_will"]', 'Not a priority'); await p.waitForTimeout(250);
  ok(/The client said this is not a priority/.test(await area(p, 'will', 'warn')), 'a "no" chosen by the adviser keeps the old red line');
  ok((await val(p, 'pr_life')) === '', 'Life is not decided by the form');

  // 4. suggestion lines
  p = await fresh();
  await setF(p, { sti: 'Yes', sti_broker: 'Other broker', ma: 'Medical aid', ma_broker: 'Other broker', will: 'Yes', will_up: 'Yes', will_where: 'Capital Legacy', will_broker: 'Other broker' });
  await go(p, 'prio');
  ok(/Short-term is with the client's own broker\. If the client is open to a quote, Cameron can be asked\. Cameron to contact client/.test(await area(p, 'st', 'sug')), 'short-term with another broker: the line and its button: ' + await area(p, 'st', 'sug'));
  ok(/Medical aid is privately paid and with another broker/.test(await area(p, 'med', 'sug')) && /Capital Legacy and can take over as brokers/.test(await area(p, 'will', 'sug')), 'medical aid and the will have their lines');
  ok(await val(p, 'pr_st') === '' && (await area(p, 'st', 'class')).indexOf('p1') < 0, 'a suggestion stores nothing: the area is not green');
  await p.click('[data-sug="st"]'); await p.waitForTimeout(300);
  ok(await val(p, 'pr_st') === 'Priority: client agrees' && await val(p, 'ref_sti') === 'Cameron to contact client' && /open to a quote from Cameron/.test(await val(p, 'pr_st_cm')), 'the button sets Priority, the referral and the comment');
  ok(await area(p, 'st', 'chip') === 'Priority' && await area(p, 'st', 'sug') === '' && (await st(p, 'pr_st')).st === 'confirmed', 'the area is green and the line is gone');
  await go(p, 'admin'); await p.waitForTimeout(300);
  await go(p, 'prio');

  // 5. the take-over reaches the action points (the local wording, with no Claude key)
  const lines = await p.evaluate(() => FF.actions.local(FF.app.state));
  ok(lines.some(l => /Ask Cameron to contact .* about short-term insurance \(currently with another broker: a take-over\)\./.test(l)), 'the point for Sitamah says it is a take-over: ' + (lines.find(l => /Cameron/.test(l)) || 'none'));

  // 6. no children, EGAR; an older file opens with the outcomes and the new words
  p = await fresh();
  await setF(p, { has_kids: 'No', pr_ra: 'Not a priority: client not interested' });
  await go(p, 'prio');
  ok(await val(p, 'pr_egar') === 'Not a priority' && /No children recorded/.test(await val(p, 'pr_egar_cm')) && await val(p, 'egar_req') === 'Not required', 'EGAR: no children is a NO with its comment');
  const file = await p.evaluate(() => { const j = JSON.parse(FF.store.toJSON(FF.app.state)); j.f.pr_ra = { v: 'Not a priority: client not interested', st: 'confirmed' }; j.f.pr_egar = { v: '', st: 'empty' }; j.f.pr_egar_cm = { v: '', st: 'empty' }; j.f.egar_req = { v: '', st: 'empty' }; delete j.auto; return JSON.stringify(j); });
  await p.evaluate(txt => { const s = FF.store.fromJSON(txt); FF.app.setState ? FF.app.setState(s) : null; }, file);
  const reopened = await p.evaluate(txt => { const s = FF.store.fromJSON(txt); return [s.f.pr_ra.v, s.f.pr_egar.v, s.f.pr_egar.st, s.f.egar_req.v]; }, file);
  ok(reopened.join('|') === 'Not a priority|Not a priority|preset|Not required', 'an older file opens with the new words and the outcome in the empty decision: ' + reopened.join('|'));
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
