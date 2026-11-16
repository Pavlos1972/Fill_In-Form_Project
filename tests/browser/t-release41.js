/* Release 4.1 on the real page: "to verify" and "not asked" on the Progress card lead to the boxes one by one; Verify All (with a question and an Undo); an appointment that has come and gone asks what happened and
   opens the date; Personal cell number and Work cell number. */
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
  const sec = () => p.evaluate(() => (document.querySelector('.nav button[aria-current="true"]') || {}).dataset.sec);
  const focused = () => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.f || (a.dataset.l ? a.dataset.l + ':' + a.dataset.i + ':' + a.dataset.k : '')) : ''; });
  const num = id => p.evaluate(id => +document.getElementById(id).textContent, id);

  /* 1. to verify: one by one, in the order of the pages */
  await p.evaluate(() => { const S = FF.app.state, st = FF.store; st.setField(S, 'fname', 'Sam', 'verify'); st.setField(S, 'gross', 'R 50 000.00', 'verify'); st.addRow(S, 'debts', { type: 'Home loan', prov: 'ABSA' }, 'verify'); st.setField(S, 'has_kids', 'Yes', 'verify'); FF.app.redraw(); });
  ok((await num('sVerify')) === 4, 'the Progress card says 4 to verify: ' + await num('sVerify'));
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok((await sec()) === 'info' && (await focused()) === 'fname', 'the first click goes to the first box to verify (Client info, First name): ' + await sec() + ' ' + await focused());
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok((await sec()) === 'income' && (await focused()) === 'gross', 'the second click goes to the next one (Income, Gross income): ' + await sec() + ' ' + await focused());
  await p.fill('[data-f="gross"]', 'R 55 000.00'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);     // verified by typing
  ok((await num('sVerify')) === 3, 'a box verified: the count drops to 3');
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok((await sec()) === 'debts' && /^debts:0:/.test(await focused()), 'then the row to verify on the Debts page: ' + await focused());
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok((await focused()) === 'has_kids', 'then Has children: ' + await sec() + ' ' + await focused());
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok((await sec()) === 'info' && (await focused()) === 'fname', 'after the last one it goes round to the first again');

  /* 2. not asked */
  await p.click('#sEmptyBox'); await p.waitForTimeout(300);
  const first = await focused(), s1 = await sec();
  ok(s1 === 'info' && !!first, 'not asked: the first empty box on the first page: ' + first);
  await p.click('#sEmptyBox'); await p.waitForTimeout(300);
  ok((await focused()) !== first, 'and the next one on the next click: ' + await focused());

  /* the other amber boxes: a box with a starting value, an advisor page, a note; the online profile is left alone */
  await p.evaluate(() => { const S = FF.app.state, st = FF.store; st.setField(S, 'ma_broker', 'Other broker', 'verify'); st.setField(S, 'pr_life', 'Priority: client agrees', 'verify'); st.setField(S, 'profile', 'Possible match', 'verify'); FF.app.redraw(); });
  ok((await num('sVerify')) === 5, 'the Progress card counts every amber box on every page (the 3 left + a Broker on record box + a Client priorities box): ' + await num('sVerify'));
  await p.click('.nav button[data-sec="other"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => /verify/i.test(document.querySelector('[data-field="ma_broker"] .badge').textContent)), 'the Broker on record box shows the amber badge');

  /* 3. Verify All: asks, can be refused, can be undone */
  answer = false; asked.length = 0; await p.click('#btnVerifyAll'); await p.waitForTimeout(300);
  ok(asked.length === 1 && /Mark all 5 answers/.test(asked[0]) && (await num('sVerify')) === 5, 'Verify All asks first, and Cancel changes nothing: ' + JSON.stringify(asked[0] || '').slice(0, 90));
  answer = true; await p.click('#btnVerifyAll'); await p.waitForTimeout(400);
  ok((await num('sVerify')) === 0 && await p.evaluate(() => FF.app.state.f.fname.st === 'confirmed' && FF.app.state.l.debts[0].st === 'confirmed' && FF.app.state.f.ma_broker.st === 'confirmed' && FF.app.state.f.pr_life.st === 'confirmed' && FF.app.state.f.profile.st === 'verify'), 'OK verifies every amber box on every page (the online profile is left for you): the count is 0');
  ok(await p.evaluate(() => /Verified 5 answers/.test(document.getElementById('toast').textContent) && !!document.querySelector('#toast .toast-undo')), 'a message with an Undo button');
  await p.click('#toast .toast-undo'); await p.waitForTimeout(300);
  ok((await num('sVerify')) === 5 && await p.evaluate(() => FF.app.state.f.fname.st === 'verify' && FF.app.state.f.pr_life.st === 'verify'), 'Undo puts them back: 5 to verify again');
  await p.click('#btnVerifyAll'); await p.waitForTimeout(300);
  await p.click('#sVerifyBox'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /Nothing is waiting to be verified/.test(document.getElementById('toast').textContent)), 'with nothing to verify, the card says so');

  /* 4. an appointment that has come and gone */
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'next_appt', '13/11/2026'); FF.store.setField(FF.app.state, 'next_time', '14:30'); FF.app.redraw(); });
  await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => /has passed\. What happened\?/.test((document.querySelector('.apptdone') || {}).textContent || '')), 'Admin: under the date, a line asks what happened to the appointment of Friday 13/11/2026 at 14:30');
  ok(await p.evaluate(() => [...document.querySelectorAll('.apptbtn')].map(x => x.textContent).join('|') === 'Completed|Did not meet with the client|Cancelled by the client|Rescheduled'), 'with four answers to choose from');
  await p.click('.apptbtn[data-appt="Did not meet with the client"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('.apptdone') && FF.app.state.f.next_appt.v === '' && FF.app.state.f.next_time.v === ''), 'the date and time are open again, and the question is gone');
  ok(await p.evaluate(() => FF.app.state.l.appts.length === 1 && FF.app.state.l.appts[0].d.outcome === 'Did not meet with the client' && FF.app.state.l.appts[0].d.date === '13/11/2026'), 'the appointment is kept under Previous appointments');
  ok(await p.evaluate(() => /Previous appointments/.test(document.getElementById('main').textContent) && document.querySelector('[data-l="appts"][data-i="0"][data-k="outcome"]').value === 'Did not meet with the client'), 'and shown on Admin');
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'next_appt', '12/12/2099'); FF.app.redraw(); });
  await p.click('.nav button[data-sec="income"]'); await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('.apptdone')), 'a date still to come asks nothing');

  /* the calendar on the Date of a previous appointment */
  await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('[data-cal="appts:0:date"]') && !!document.querySelector('[data-calpick="appts:0:date"]')), 'Previous appointments: the Date has a Calendar button');
  await p.evaluate(() => { const pk = document.querySelector('[data-calpick="appts:0:date"]'); pk.value = '2026-11-12'; pk.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.l.appts[0].d.date === '12/11/2026' && document.querySelector('[data-l="appts"][data-i="0"][data-k="date"]').value === '12/11/2026'), 'a date picked from the calendar is written as day/month/year and saved: ' + await p.evaluate(() => FF.app.state.l.appts[0].d.date));

  /* 5. phone numbers */
  await p.click('.nav button[data-sec="info"]'); await p.waitForTimeout(300);
  const labels = await p.evaluate(() => [...document.querySelectorAll('#main .f > .l > span:first-child')].map(e => e.textContent.trim()).filter(t => /number/i.test(t)));
  ok(JSON.stringify(labels.slice(labels.indexOf('Personal cell number'), labels.indexOf('Personal cell number') + 4)) === JSON.stringify(['Personal cell number', 'Work cell number', 'Work number', 'Home number']), 'Client info: Personal cell number, Work cell number, Work number, Home number: ' + labels.join(', '));
  await p.fill('[data-f="work_cell"]', '083 555 0000'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => FF.app.state.f.work_cell.v === '083 555 0000'), 'a work cell number is kept');
  ok(await p.evaluate(() => !!document.querySelector('[data-none="work_cell"]')) || (await p.evaluate(() => document.body.textContent.includes('No work cell number'))), 'with its "No work cell number" tick');

  /* 6. the PDF */
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/r41.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/r41.pdf', '-']).toString().replace(/\s+/g, ' ');
  ok(/Work cell number/.test(raw) && /Personal cell number/.test(raw) && /083 555 0000/.test(raw), 'the PDF has both cell numbers');
  ok(/Previous appointments/.test(raw) && /Did not meet with the client/.test(raw), 'the PDF lists the previous appointment and what happened');
  /* the gender follows the ID number: typed, and in a file that is opened */
  await p.fill('[data-f="idno"]', '8907045123088'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => FF.app.state.f.gender.v === 'Male' && document.querySelector('[data-f="gender"]').value === 'Male'), 'a typed ID number (digits 5123) gives Male: ' + await p.evaluate(() => FF.app.state.f.gender.v));
  await p.evaluate(() => { const s = FF.store.blank(); FF.store.setField(s, 'fname', 'Ann'); FF.store.setField(s, 'idno', '7212090148085', 'confirmed'); s.f.gender = { v: '', st: 'empty' }; FF.app.setState(FF.store.fromJSON(FF.store.toJSON(s))); });
  ok(await p.evaluate(() => FF.app.state.f.gender.v === 'Female' && FF.app.state.f.gender.st === 'confirmed'), 'a file opened with an ID number and an empty gender: Female, confirmed with the ID');

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); process.exit(bad ? 1 : 0);
})();
