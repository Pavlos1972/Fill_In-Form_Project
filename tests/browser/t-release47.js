/* Release 4.7 on the real page: the Health box h_dia is called "High blood sugar" on the screen and in the PDF, the word diabetes is nowhere on any page, and a file saved by 4.6 opens with its answer. */
const { chromium } = require((process.argv[2]) + '/playwright');
const cp = require('child_process'), fs = require('fs');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  const go = async id => { await p.click('.nav button[data-sec="' + id + '"]'); await p.waitForTimeout(250); };

  await go('health');
  const label = await p.evaluate(() => { const w = document.querySelector('[data-field="h_dia"]'); return w ? w.querySelector('.l').textContent.replace(/\s+/g, ' ').trim() : null; });
  ok(label && /^High blood sugar/.test(label), 'the Health box is labelled: ' + label);
  ok(!/diabet/i.test(label || ''), 'the label does not say diabetes');
  const labels = await p.evaluate(() => [...document.querySelectorAll('.f > .l')].map(e => e.firstElementChild.textContent.trim()).filter(t => /^(General health|High |Other health)/.test(t)));
  ok(JSON.stringify(labels) === JSON.stringify(['General health good', 'High blood sugar', 'High cholesterol', 'High blood pressure', 'High BMI', 'Other health issues']), 'the Health boxes, in order: ' + labels.join(' | '));
  const opts = await p.evaluate(() => [...document.querySelector('[data-f="h_dia"]').options].map(o => o.value).filter(Boolean));
  ok(JSON.stringify(opts) === JSON.stringify(['Yes', 'No']), 'the answers are Yes and No: ' + opts.join(','));
  await p.selectOption('[data-f="h_dia"]', 'Yes'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => FF.app.state.f.h_dia.v === 'Yes' && FF.app.state.f.h_dia.st === 'confirmed'), 'choosing Yes saves Yes in h_dia (confirmed)');
  await p.screenshot({ path: out + '/release47-health.png' });

  /* the word is on no page: visit every page of the form and read all its text */
  const secs = await p.evaluate(() => FF.schema.sections.map(s => s.id));
  let seen = 0, hits = [];
  for (const id of secs) { const btn = await p.$('.nav button[data-sec="' + id + '"]'); if (!btn) continue; await btn.click(); await p.waitForTimeout(150); seen++; const t = await p.evaluate(() => document.body.innerText); if (/diabet/i.test(t)) hits.push(id); }
  ok(seen >= 13 && hits.length === 0, 'the word diabetes is on none of the ' + seen + ' pages' + (hits.length ? ' (found on ' + hits.join(', ') + ')' : ''));

  /* the PDF, read as text by the real tool */
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/release47.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/release47.pdf', '-']).toString();
  ok(/High blood sugar/.test(raw), 'the PDF prints High blood sugar');
  ok(!/diabet/i.test(raw), 'the PDF does not say diabetes');
  ok(/High blood sugar[\s\S]{0,80}Yes/.test(raw) || /Yes[\s\S]{0,40}High blood sugar/.test(raw), 'and the answer given (Yes) is with it');

  /* a file saved by 4.6 opens with its answers */
  const file = await p.evaluate(() => { const j = JSON.parse(FF.store.toJSON(FF.store.blank())); j.schema = '4.6'; j.f.h_dia = { v: 'Yes', st: 'confirmed' }; j.f.h_chol = { v: 'No', st: 'heard' }; return JSON.stringify(j); });
  const opened = await p.evaluate(f => { FF.app.setState(FF.store.fromJSON(f)); return { dia: FF.app.state.f.h_dia, chol: FF.app.state.f.h_chol }; }, file);
  ok(opened.dia.v === 'Yes' && opened.dia.st === 'confirmed' && opened.chol.v === 'No' && opened.chol.st === 'heard', 'an older file opens with its answers and statuses');
  await go('health');
  ok(await p.evaluate(() => document.querySelector('[data-f="h_dia"]').value) === 'Yes', 'and the box shows the answer from the file');
  const saved = await p.evaluate(() => ({ file: JSON.parse(FF.store.toJSON(FF.app.state)), version: FF.schema.version }));
  ok(saved.file.f.h_dia && saved.file.f.h_dia.v === 'Yes' && saved.file.schema === saved.version, 'and it is saved back as Yes under the same id h_dia, as version ' + saved.version);

  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the page does not scroll sideways');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
