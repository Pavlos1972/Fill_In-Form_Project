/* Release 4.8 on the real page: the headings of the Priorities to be Focused on box and of the Action Points are larger and bold, with room under them (a read view that a click opens for typing), follow the box when
   the form rewrites it, and are in the PDF; the text in the file stays plain. */
const { chromium } = require((process.argv[2]) + '/playwright');
const cp = require('child_process'), fs = require('fs');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => {
    const S = FF.app.state, st = FF.store, set = (id, v) => st.setField(S, id, v);
    set('fname', 'Elmer'); set('sname', 'Jonker'); set('has_risk', 'Yes');
    set('pr_life', FF.schema.PRIORITY); set('pr_rgar', FF.schema.PRIORITY); set('pr_st', FF.schema.PRIORITY);
    set('bf_fna_req', 'Request a quote'); set('bf_fna_type', 'New Business'); set('ref_sti', 'Cameron to contact client');
    set('focus', FF.actions.focusLocal(S)); set('pa_actions', FF.actions.text(FF.actions.local(S), S));
    FF.app.redraw();
  });
  const go = async id => { await p.click('.nav button[data-sec="' + id + '"]'); await p.waitForTimeout(300); };
  const look = id => p.evaluate(id => {
    const w = document.querySelector('[data-field="' + id + '"]'), rv = w && w.querySelector('.rv'), hd = rv ? [...rv.querySelectorAll('.ln.hd')] : [], pt = rv ? [...rv.querySelectorAll('.ln:not(.hd)')].find(e => e.textContent.trim()) : null;
    const cs = e => e && getComputedStyle(e);
    return {
      on: !!w && w.classList.contains('rv-on'), rvShown: !!rv && getComputedStyle(rv).display !== 'none', taShown: !!w && getComputedStyle(w.querySelector('textarea')).display !== 'none',
      heads: hd.map(e => e.textContent), big: hd.map(e => e.classList.contains('big')),
      hSize: hd[0] && parseFloat(cs(hd[0]).fontSize), hWeight: hd[0] && +cs(hd[0]).fontWeight, hMarginBottom: hd[0] && parseFloat(cs(hd[0]).marginBottom), hMarginTop: hd[1] && parseFloat(cs(hd[1]).marginTop),
      pSize: pt && parseFloat(cs(pt).fontSize), pWeight: pt && +cs(pt).fontWeight, edit: !!(w && w.querySelector('.rvedit')), text: w && w.querySelector('textarea').value
    };
  }, id);

  await go('prio');
  let f = await look('focus');
  ok(f.on && f.rvShown && !f.taShown, 'the Priorities box shows as a read view');
  ok(JSON.stringify(f.heads) === JSON.stringify(['1. Personal Risk Covers', '3. RGAR', '8. Short Term']), 'its headings are the three green areas: ' + f.heads.join(' | '));
  ok(f.big.every(Boolean), 'each heading has the larger style');
  ok(f.hSize > f.pSize * 1.1, 'a heading is larger than the points (' + f.hSize + ' px against ' + f.pSize + ' px)');
  ok(f.hWeight >= 700 && f.pWeight < 600, 'a heading is bold and a point is not (' + f.hWeight + ' / ' + f.pWeight + ')');
  ok(f.hMarginBottom >= 4 && f.hMarginTop >= 8, 'there is room under a heading (' + f.hMarginBottom + ' px) and above the next one (' + f.hMarginTop + ' px)');
  ok(f.edit, 'the box has the Edit link');
  ok(!/<|\*\*/.test(f.text), 'the text in the box is plain');
  await p.screenshot({ path: out + '/release48-priorities.png' });

  /* a click opens the plain text; typing a new area and leaving shows it as a heading */
  await p.click('[data-field="focus"] .rv'); await p.waitForTimeout(200);
  f = await look('focus');
  ok(!f.rvShown && f.taShown, 'a click opens the plain text for typing');
  await p.focus('[data-f="focus"]'); await p.keyboard.press('Control+End');
  await p.keyboard.type('\n\n4. Investment Planning\nRecommend: Request an Allan Gray quote.');
  await p.click('h2'); await p.waitForTimeout(250);
  f = await look('focus');
  ok(f.on && f.heads.includes('4. Investment Planning') && f.big.every(Boolean), 'what was typed is a heading when the box is left: ' + f.heads.join(' | '));
  ok(await p.evaluate(() => FF.app.state.focus.edited === true), 'and the box counts as typed over, as before');

  await go('admin');
  let a = await look('pa_actions');
  ok(a.on && a.rvShown && !a.taShown, 'the Action Points show as a read view');
  ok(JSON.stringify(a.heads) === JSON.stringify(['Sitamah, please action these for the client Elmer Jonker:']), 'its one heading is the opening line: ' + a.heads.join(' | '));
  ok(a.big[0] && a.hSize > a.pSize * 1.1 && a.hWeight >= 700 && a.hMarginBottom >= 4, 'it is larger and bold with room under it (' + a.hSize + ' px, ' + a.hWeight + ', ' + a.hMarginBottom + ' px)');
  ok(a.pWeight < 600, 'the points are not bold');
  await p.screenshot({ path: out + '/release48-actions.png' });

  /* the form rewrites the box (Refresh): the read view follows */
  await p.click('[data-field="pa_actions"] .rv'); await p.waitForTimeout(150);
  await p.fill('[data-f="pa_actions"]', 'typed by hand'); await p.click('h2'); await p.waitForTimeout(250);
  a = await look('pa_actions');
  ok(a.on && a.heads.length === 0, 'text typed by hand has no heading');
  await p.click('#paRefresh'); await p.waitForTimeout(1500);
  a = await look('pa_actions');
  ok(a.heads.length === 1 && /^Sitamah, please action these for the client Elmer Jonker:$/.test(a.heads[0]) && a.on, 'after Refresh the read view shows the opening line as a heading again');

  /* the PDF, read as text by the real tool */
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/release48.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/release48.pdf', '-']).toString();
  ok(/1\. Personal Risk Covers/.test(raw) && /Sitamah, please action these for the client Elmer Jonker:/.test(raw), 'the PDF has both kinds of heading');
  ok(/4\. Investment Planning/.test(raw), 'and the area that was typed in');

  /* the file keeps plain text */
  const saved = await p.evaluate(() => JSON.parse(FF.store.toJSON(FF.app.state)));
  ok(/^1\. Personal Risk Covers\n/.test(saved.f.focus.v) && !/<|\*\*/.test(saved.f.focus.v + saved.f.pa_actions.v), 'the saved file holds plain text in both boxes');

  for (const w of [1280, 800]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'at ' + w + ' wide the page does not scroll sideways'); }
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
