const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  const val = id => p.evaluate(id => document.querySelector('[data-f="' + id + '"]').value, id);
  const type = async (id, v) => { await p.fill('[data-f="' + id + '"]', v); await p.press('[data-f="' + id + '"]', 'Tab'); await p.waitForTimeout(150); };
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'fname', 'Thandi'); FF.app.redraw(); });
  await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(300);

  // the date has a row of its own; the day and the time sit side by side below it; all inside the column
  const geo = await p.evaluate(() => { const r = id => document.querySelector('[data-field="' + id + '"]').getBoundingClientRect(), a = r('next_appt'), d = r('next_day'), t = r('next_time'), blk = document.querySelector('[data-field="next_appt"]').closest('.block, section, .card, div.blk') || document.body; return { sameRow: Math.abs(d.top - t.top) < 3 && a.bottom <= d.top + 1, order: d.left < t.left, widths: [a.width, d.width, t.width].map(Math.round), right: Math.round(t.right), blockRight: Math.round(blk.getBoundingClientRect().right) }; });
  ok(geo.sameRow && geo.order && geo.right <= geo.blockRight + 1, 'the date is above the day and the time, which sit side by side, inside their block ' + JSON.stringify(geo));
  ok(await p.evaluate(() => document.querySelector('[data-f="next_day"]').readOnly || document.querySelector('[data-f="next_day"]').disabled), 'the day box is calculated: it cannot be typed in');

  // the day follows the date
  ok((await val('next_day')) === '', 'no date: no day');
  await type('next_appt', '06/11/2026');
  ok((await val('next_day')) === 'Friday', 'a typed date gives its day: ' + (await val('next_day')));
  await type('next_appt', '07/11/2026'); ok((await val('next_day')) === 'Saturday', 'changing the date changes the day');
  await p.evaluate(() => { const pk = document.querySelector('[data-calpick="next_appt"]'); pk.value = '2026-11-09'; pk.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(200);
  ok((await val('next_appt')) === '09/11/2026' && (await val('next_day')) === 'Monday', 'a date picked from the calendar gives its day too: ' + (await val('next_appt')) + ' ' + (await val('next_day')));
  await type('next_appt', '06/11/2026');

  // the time is tidied to 24-hour
  for (const [typed, shown] of [['2pm', '14:00'], ['2:30 pm', '14:30'], ['14h30', '14:30'], ['9h', '09:00']]) { await type('next_time', typed); ok((await val('next_time')) === shown, 'time "' + typed + '" is shown as ' + shown + ': ' + (await val('next_time'))); }
  await type('next_time', '2:30 pm');

  // Checks (the form's date is set, so this does not depend on the day it is run: an appointment before the form's date is warned about)
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'date', '01/11/2026'); FF.app.redraw(); });
  const checks = () => p.evaluate(() => [...document.querySelectorAll('#checks button')].map(e => e.textContent));
  ok(!(await checks()).some(t => /next appointment/i.test(t)), 'a date and a time: nothing to warn about');
  await type('next_time', '');
  ok((await checks()).some(t => /Next appointment \(time\): Add the time of the next appointment/.test(t)), 'a date with no time is warned about: ' + JSON.stringify(await checks()));
  ok(await p.evaluate(() => { const w = document.querySelector('[data-warn="next_time"]'); return !w.hidden && /Add the time/.test(w.textContent); }), 'and the warning shows under the time box');
  await type('next_time', 'after lunch');
  ok((await checks()).some(t => /Time not recognised/.test(t)), 'a time that cannot be read is warned about');
  await type('next_time', '2:30 pm');

  // the action point and the PDF
  const point = await p.evaluate(() => FF.actions.local(FF.app.state).pop());
  ok(point === 'Set up a follow-up appointment with the client Thandi for Friday 06/11/2026 at 14:30.', 'the action point for the assistant: ' + point);
  const pdfText = await p.evaluate(() => { const rec = []; const d = FF.pdf.build(FF.app.state); return d.output('datauristring').length > 1000; });
  ok(pdfText, 'the PDF is made with the new boxes');

  // saved and reopened
  const json = await p.evaluate(() => FF.store.toJSON(FF.app.state));
  await p.evaluate(j => { FF.app.setState(FF.store.fromJSON(j)); }, json); await p.click('.nav button[data-sec="admin"]'); await p.waitForTimeout(300);
  ok((await val('next_appt')) === '06/11/2026' && (await val('next_time')) === '14:30' && (await val('next_day')) === 'Friday', 'saved and reopened: date, day and time are all back');
  if (out) await p.screenshot({ path: out + '/appt.png', clip: { x: 230, y: 230, width: 1000, height: 420 } });

  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close();
});
