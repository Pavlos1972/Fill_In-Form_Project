/* Release 4.0 on the real page: a Fact Find done over several meetings. "Add another meeting" under the Meeting box; Date completed follows the last meeting; the PDF lists them; a saved file opened on a later day and
   voice switched on asks whether today is another meeting (once), and a new form never asks. */
const { chromium } = require((process.argv[2]) + '/playwright');
const fs = require('fs'), cp = require('child_process');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const asked = []; let answer = true; p.on('dialog', d => { asked.push(d.message()); answer ? d.accept() : d.dismiss(); });
  await p.goto('file://' + dir + '/index.html');
  const val = id => p.evaluate(id => (document.querySelector('[data-f="' + id + '"]') || {}).value, id);
  const today = await p.evaluate(() => FF.util.todayDMY());
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'date', '12/11/2026'); FF.store.setField(FF.app.state, 'fname', 'Sam'); FF.store.setField(FF.app.state, 'sname', 'Test'); FF.app.redraw(); });
  const main = () => p.evaluate(() => document.getElementById('main').textContent);

  /* one meeting: the list is empty, with the button */
  let t = await main();
  ok(/Meetings held/.test(t) && /This is the only meeting so far/.test(t), 'one meeting: the Meetings held list says it is the only meeting so far');
  ok(await p.evaluate(() => !!document.querySelector('[data-add="meetings"]') && /Add another meeting/.test(document.querySelector('[data-add="meetings"]').textContent)), 'with the button Add another meeting');
  ok(await p.evaluate(() => { const l = [...document.querySelectorAll('#main .block-title')].map(e => e.textContent); return l.indexOf('Meeting') >= 0 && l.indexOf('Meetings held') === l.indexOf('Meeting') + 1; }), 'right under the Meeting box');

  /* add another meeting */
  await p.click('[data-add="meetings"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('.rc-meetings').length === 2), 'two meeting cards after the first press');
  ok((await val('date')) === today, 'Date completed is today, the date of the last meeting: ' + await val('date'));
  ok(await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="0"][data-k="date"]').value === '12/11/2026'), 'meeting 1 is the date it was before: 12/11/2026');
  ok(await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="0"][data-k="covered"]').value === 'Client info'), 'meeting 1\'s What was covered was written by the form: ' + await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="0"][data-k="covered"]').value));
  await p.fill('[data-l="meetings"][data-i="1"][data-k="who"]', 'Marie-Louise (spouse)'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  ok((await val('on_call')) === 'Marie-Louise (spouse)', 'who was on the call of the last meeting is Others on the call');
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'gross', 'R 50 000.00'); FF.store.setField(FF.app.state, 'ps_risk', 'Policy Schedules saved in Client File'); FF.app.redraw(); });
  ok(await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="1"][data-k="covered"]').value === 'Income & household, Personal & group risk cover'), 'meeting 2\'s What was covered follows what was answered in it: ' + await p.evaluate(() => document.querySelector('[data-l="meetings"][data-i="1"][data-k="covered"]').value));
  await p.fill('[data-l="meetings"][data-i="1"][data-k="covered"]', 'Cover, retirement and the will'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  await p.fill('[data-l="meetings"][data-i="1"][data-k="date"]', '26/11/2026'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  ok((await val('date')) === '26/11/2026', 'changing the last meeting\'s date changes Date completed');
  await p.selectOption('[data-l="meetings"][data-i="1"][data-k="type"]', 'Telephonic Meeting'); await p.waitForTimeout(300);
  ok((await val('meet')) === 'Telephonic Meeting', 'and Type of meeting');
  await p.click('[data-add="meetings"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('.rc-meetings').length === 3), 'a third meeting is one more press');

  /* the PDF */
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/r40.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/r40.pdf', '-']).toString().replace(/\s+/g, ' ');
  ok(/Meetings held/.test(raw) && /12\/11\/2026/.test(raw) && /26\/11\/2026/.test(raw) && /Cover, retirement and the will/.test(raw) && /Marie-Louise \(spouse\)/.test(raw), 'the PDF lists the meetings with their dates, who was on the call and what was covered');

  /* the question on opening a saved file */
  await p.evaluate(() => { const s = FF.store.blank(); FF.store.setField(s, 'fname', 'Ann'); FF.store.setField(s, 'sname', 'Old'); FF.store.setField(s, 'date', '12/11/2026'); FF.app.setState(FF.store.fromJSON(FF.store.toJSON(s))); });
  asked.length = 0; await p.click('#btnVoice'); await p.waitForTimeout(500);
  ok(asked.length === 1 && /last worked on 12\/11\/2026/.test(asked[0]) && /another meeting/.test(asked[0]), 'a saved file from an earlier day, voice on: the form asks whether today is another meeting: ' + JSON.stringify(asked[0] || '').slice(0, 140));
  ok(await p.evaluate(() => FF.app.state.l.meetings.length === 2) && (await p.evaluate(() => FF.app.state.f.date.v)) === today, 'OK adds today as meeting 2 and Date completed is today');
  await p.click('#btnVoice'); await p.waitForTimeout(300); asked.length = 0; await p.click('#btnVoice'); await p.waitForTimeout(400);
  ok(asked.length === 0, 'switching voice off and on again does not ask a second time');
  await p.click('#btnVoice'); await p.waitForTimeout(200);

  /* No, and a new form */
  await p.evaluate(() => { const s = FF.store.blank(); FF.store.setField(s, 'fname', 'Bob'); FF.store.setField(s, 'sname', 'Old'); FF.store.setField(s, 'date', '12/11/2026'); FF.app.setState(FF.store.fromJSON(FF.store.toJSON(s))); });
  answer = false; asked.length = 0; await p.click('#btnVoice'); await p.waitForTimeout(400);
  ok(asked.length === 1 && (await p.evaluate(() => FF.app.state.l.meetings.length)) === 0 && (await p.evaluate(() => FF.app.state.f.date.v)) === '12/11/2026', 'Cancel carries on as the same meeting: nothing is added');
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  await p.evaluate(() => { FF.app.setState(FF.store.blank()); }); asked.length = 0; await p.click('#btnVoice'); await p.waitForTimeout(400);
  ok(asked.length === 0, 'a new form (dated today) never asks');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
