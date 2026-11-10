// The Short Risk Application page in a real browser: the boxes and their links, children and beneficiaries added and taken away, Load from Fact Find, saving, opening, the unsaved-work question,
// the PDF (one page for two children and two beneficiaries; its text against the text of the screen) and the layout on a phone.
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'short-risk.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const ffStore = require(path.join(dir, 'js/store.js'));
function factFindText() {
  const f = ffStore.blank();
  ffStore.setField(f, 'fname', 'Anna Maria'); ffStore.setField(f, 'sname', 'Kuiper'); ffStore.setField(f, 'idno', '8001015009087'); ffStore.setField(f, 'cell', '0821234567'); ffStore.setField(f, 'pemail', 'anna@example.com');
  ffStore.addRow(f, 'kids'); ffStore.setCell(f, 'kids', 0, 'name', 'Mia'); ffStore.setCell(f, 'kids', 0, 'sname', 'Kuiper');
  ffStore.addRow(f, 'kids'); ffStore.setCell(f, 'kids', 1, 'name', 'Piet'); ffStore.setCell(f, 'kids', 1, 'sname', 'Kuiper');
  return ffStore.toJSON(f);
}
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const url = 'http://localhost:' + srv.address().port + '/';
  await p.goto(url); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => SR.app.state);
  const val = sel => p.evaluate(s => document.querySelector(s).value, sel);
  const type = async (id, v) => { await p.fill('[data-f="' + id + '"]', v); await p.press('[data-f="' + id + '"]', 'Tab'); await p.waitForTimeout(80); };
  const pick = async (id, v) => {                                                              // a list of choices is a drop-down, or a box with a list when another answer may be typed
    const sel = '[data-f="' + id + '"]';
    if (await p.evaluate(s => document.querySelector(s).tagName === 'SELECT', sel)) await p.selectOption(sel, v); else { await p.fill(sel, v); await p.press(sel, 'Tab'); }
    await p.waitForTimeout(80);
  };
  const page = n => p.click('.nav button[data-page="' + n + '"]').then(() => p.waitForTimeout(150));
  const toast = () => p.evaluate(() => document.querySelector('#toast').textContent);
  const checks = () => p.evaluate(() => document.querySelector('#checks').innerText.replace(/\s+/g, ' '));

  // 1. the page
  ok(await p.title() === 'Short Risk Application', 'the page is called Short Risk Application: ' + await p.title());
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav button')].map(x => x.querySelector('span').textContent).join('|')) === 'Cover & client|Home & doctor|Banking|Family|Declarations', 'five pages in the list on the left');
  ok(await p.evaluate(() => !document.getElementById('restoreDraft')), 'a first visit has no question');
  ok(await p.evaluate(() => !document.querySelector('#btnVoice, #btnListen, #btnTimer, #btnSettings')), 'no voice, listen, meeting or settings buttons: this page needs no voice and no keys');
  ok(await p.evaluate(() => +document.querySelector('#sEmpty').textContent === SR.store.counts(SR.app.state).left && +document.querySelector('#sEmpty').textContent > 0), 'the Progress card counts the boxes still to answer');
  ok(await p.evaluate(() => document.querySelector('[data-f="date"]').value === FF.util.todayDMY()), 'the date of application starts as today');

  // 2. linked boxes and the file name
  await pick('product', 'Personal Covers');
  ok(await val('[data-f="lines"]') === 'Personal', 'Cover lines follows the Product type');
  await pick('product', 'Keyman Cover');
  ok(await val('[data-f="lines"]') === 'Business', 'and follows it again when the product changes');
  await pick('product', 'Personal Covers'); await pick('insurer', 'Old Mutual');
  await type('premium', '1500'); ok(await val('[data-f="premium"]') === 'R 1 500.00', 'the premium is shown as Rand: ' + await val('[data-f="premium"]'));
  await type('fname', 'Anna'); await type('sname', 'Kuiper'); await type('date', '2026-11-20');
  ok(await val('[data-f="date"]') === '20/11/2026', 'a date is shown day/month/year');
  ok(await p.evaluate(() => document.querySelector('#meta .fn').textContent) === 'OM - Personal Covers Application - 20.11.26 - R 1,500.00 p.m. - (Anna Kuiper)', 'the card says the name the files will be saved under: ' + await p.evaluate(() => document.querySelector('#meta .fn').textContent));
  ok(await p.evaluate(() => document.querySelector('#clientName').textContent) === 'Anna Kuiper', 'the client\'s name is at the top');

  // 3. the old policy boxes wait for "replace"
  await page('decl');
  ok(await p.evaluate(() => document.querySelector('[data-f="old_company"]').disabled && document.querySelector('[data-field="old_company"]').classList.contains('off')), 'the old policy boxes are greyed out while the policy is not replaced');
  await pick('replace', 'Yes');
  ok(await p.evaluate(() => !document.querySelector('[data-f="old_company"]').disabled), 'and open when it is');
  await type('old_company', 'Momentum'); await pick('replace', 'No');
  ok(await val('[data-f="old_company"]') === '' && await p.evaluate(() => document.querySelector('[data-f="old_company"]').disabled), 'No clears them again');

  // 4. wrong answers are said at the box and in the Checks
  await page('bank'); await type('debit_date', '12');
  ok(/10th to the 14th/.test(await checks()) && await p.evaluate(() => document.querySelector('[data-field="debit_date"]').classList.contains('has-bad')), 'a debit date of the 12th is refused in the Checks and at the box');
  await type('debit_date', '25');
  ok(!/10th to the 14th/.test(await checks()), 'the 25th is accepted');
  await type('branch_code', '25'); ok(/branch code is six digits/i.test(await checks()), 'a short branch code is flagged'); await type('branch_code', '250655');
  await p.click('#checks button:has-text("branch code")').catch(() => {});

  // 5. children and beneficiaries: add and take away
  await page('family');
  await p.click('[data-add="kids"]'); await p.click('[data-add="kids"]'); await p.click('[data-add="kids"]'); await p.waitForTimeout(100);
  const kidName = i => '[data-l="kids|' + i + '|name"]';
  for (let i = 0; i < 3; i++) { await p.fill(kidName(i), ['Mia Kuiper', 'Piet Kuiper', 'Zoe Kuiper'][i]); await p.press(kidName(i), 'Tab'); }
  ok(await p.evaluate(() => document.querySelectorAll('[data-row^="kids|"]').length) === 3, 'three children added');
  await p.click('[data-del="kids|1"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-row^="kids|"] [data-l$="|name"]')].map(e => e.value).join(',')) === 'Mia Kuiper,Zoe Kuiper', 'the second child is taken away');
  ok(await p.evaluate(() => SR.app.state.l.kids.length) === 2, 'and out of the saved data');
  await p.click('[data-add="benef"]'); await p.click('[data-add="benef"]'); await p.waitForTimeout(100);
  const ben = (i, c) => '[data-l="benef|' + i + '|' + c + '"]';
  await p.fill(ben(0, 'name'), 'Jan Kuiper'); await p.fill(ben(0, 'relation'), 'Spouse'); await p.fill(ben(0, 'pct'), '60'); await p.press(ben(0, 'pct'), 'Tab');
  await p.fill(ben(1, 'name'), 'Mia Kuiper'); await p.fill(ben(1, 'relation'), 'Child'); await p.fill(ben(1, 'pct'), '30'); await p.press(ben(1, 'pct'), 'Tab');
  ok(await val(ben(0, 'pct')) === '60%', 'a share is shown as a percentage: ' + await val(ben(0, 'pct')));
  ok(await p.evaluate(() => /90%/.test(document.querySelector('[data-sum="benef"]').innerText) && document.querySelector('[data-sum="benef"]').classList.contains('bad')) && /add up to 90%/.test(await checks()), 'shares of 60% and 30% are flagged: they must add up to 100%');
  await p.fill(ben(1, 'pct'), '40'); await p.press(ben(1, 'pct'), 'Tab');
  ok(await p.evaluate(() => document.querySelector('[data-sum="benef"]').classList.contains('ok')) && !/add up to/.test(await checks()), '60% and 40% are accepted');

  // 6. Load from Fact Find
  await p.setInputFiles('#ffIn', { name: 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json', mimeType: 'application/json', buffer: Buffer.from(factFindText()) });
  await p.waitForTimeout(300);
  let s = await st();
  ok(s.f.idno.v === '8001015009087' && s.f.idno.st === 'verify' && s.f.cell.v === '0821234567' && s.f.email.v === 'anna@example.com', 'Load from Fact Find fills the ID number, cell and e-mail, each marked to verify');
  ok(s.f.fname.v === 'Anna' && s.f.sname.v === 'Kuiper' && s.f.fname.st === 'confirmed', 'a name that was already typed is not overwritten');
  ok(s.l.kids.map(r => r.d.name).join(',') === 'Mia Kuiper,Zoe Kuiper,Piet Kuiper' && s.l.kids[2].st === 'verify', 'the children are added (Mia was already there) and Piet is marked to verify');
  ok(/Loaded \d+ box/.test(await toast()) && /Left as typed: Full names\./.test(await toast()), 'the message says what was loaded and what was left as typed: ' + await toast());
  ok(await p.evaluate(() => document.querySelector('#meta').innerText.indexOf('Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json') >= 0), 'the card says where the details came from');
  ok(await p.evaluate(() => !document.querySelector('#btnAgree').hidden) && +await p.evaluate(() => document.querySelector('#sVerify').textContent) === 4, 'the Progress card counts what is to verify (ID number, cell, e-mail, Piet): ' + await p.evaluate(() => document.querySelector('#sVerify').textContent));
  await p.click('[data-row="kids|2"] .badge.verify'); await p.waitForTimeout(100);
  ok((await st()).l.kids[2].st === 'confirmed', 'clicking the amber tag agrees one child');
  await page('client'); await p.click('[data-field="idno"] .badge.verify'); await p.waitForTimeout(100);
  ok((await st()).f.idno.st === 'confirmed', 'clicking the amber tag agrees one box');
  await p.click('#btnAgree'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => +document.querySelector('#sVerify').textContent === 0 && document.querySelector('#btnAgree').hidden), 'Agree all loaded details clears the rest');
  await p.setInputFiles('#ffIn', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'wr-short-risk' })) }); await p.waitForTimeout(200);
  ok(/not a Wealth Revolution Fact Find/.test(await toast()), 'a file that is not a Fact Find is refused: ' + await toast());

  // 7. fill the rest, then save
  const rest = { quote: 'Q-1', owner: 'Anna Kuiper', street_no: '5', street: 'Main Road', suburb: 'Sandton', city: 'Johannesburg', postal: '2196', acc_holder: 'A Kuiper', acc_no: '62012345678', title: 'Mrs' };
  for (const k of Object.keys(rest)) { await page(await p.evaluate(id => SR.schema.pageOf[SR.schema.sectionOf[id]], k)); if (k === 'title') await p.fill('[data-f="title"]', 'Mrs'), await p.press('[data-f="title"]', 'Tab'); else await type(k, rest[k]); }
  await page('bank'); await pick('bank', 'FNB'); await pick('acc_type', 'Cheque');
  await page('client'); await pick('ownerpays', 'Yes');
  await page('decl'); await pick('insolvent', 'No'); await pick('debt_review', 'No'); await pick('debt_help', 'No'); await pick('replace', 'No');
  await page('client'); await pick('lines', 'Personal');
  ok(/Complete\. Nothing is missing/.test(await checks()), 'a complete application: the Checks say so: ' + await checks());
  ok(await p.evaluate(() => +document.querySelector('#sEmpty').textContent) === 0, 'and nothing is left to answer');
  await p.screenshot({ path: shots + '/sr-complete.png' });

  const fake = () => p.evaluate(() => {
    window.__file = { text: '' }; window.__sug = [];
    const handle = { name: 'saved.json', requestPermission: () => Promise.resolve('granted'),
      createWritable: () => Promise.resolve({ write: blob => blob.text().then(t => { window.__file.pending = t; window.__file.size = blob.size; }), close: () => { window.__file.text = window.__file.pending; return Promise.resolve(); } }),
      getFile: () => Promise.resolve({ text: () => Promise.resolve(window.__file.text) }) };
    window.showSaveFilePicker = o => { window.__sug.push(o && o.suggestedName); return Promise.resolve(handle); };
  });
  const draft = () => p.evaluate(() => ({ json: localStorage.getItem('wr-short-risk-draft'), dirty: localStorage.getItem('wr-short-risk-draft-dirty') }));
  let d = await draft(); ok(d.dirty === '1' && /Kuiper/.test(d.json || ''), 'unsaved work is kept as a draft in the browser');
  await fake(); await p.click('#btnSave'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => window.__sug[0]) === 'OM - Personal Covers Application - 20.11.26 - R 1,500.00 p.m. - (Anna Kuiper).json', 'Save suggests the application file name: ' + await p.evaluate(() => window.__sug[0]));
  d = await draft(); ok(d.json === null && d.dirty === '0', 'after a save that is read back the draft (and the banking details) are gone from the browser');
  ok(await p.evaluate(() => { const j = JSON.parse(window.__file.text); return j.app === 'wr-short-risk' && j.f.acc_no.v === '62012345678' && j.l.kids.length === 3 && j.l.benef.length === 2; }), 'the saved file holds every box and both lists');
  ok(/saved \d/.test(await p.evaluate(() => document.querySelector('#saveState').textContent)), 'the top says when it was saved: ' + await p.evaluate(() => document.querySelector('#saveState').textContent));
  const saved = await p.evaluate(() => window.__file.text);
  await fake(); await p.click('#btnPdf'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__sug[0]) === 'OM - Personal Covers Application - 20.11.26 - R 1,500.00 p.m. - (Anna Kuiper).pdf', 'Save PDF suggests the same name ending .pdf: ' + await p.evaluate(() => window.__sug[0]));

  // 8. the PDF: its text against the text of every page of the screen
  const b64 = await p.evaluate(() => SR.app.makePdf().output('datauristring').split(',')[1]);
  const pdfFile = path.join(os.tmpdir(), 'sr-' + process.pid + '.pdf'); fs.writeFileSync(pdfFile, Buffer.from(b64, 'base64'));
  let txt = ''; try { txt = norm(cp.execFileSync('pdftotext', ['-raw', pdfFile, '-'], { encoding: 'utf8' })); } catch (e) { txt = ''; }
  ok(txt.length > 200, 'the PDF can be read as text');
  const screen = [];
  for (const pg of ['client', 'home', 'bank', 'family', 'decl']) {
    await page(pg);
    screen.push(...await p.evaluate(() => [...document.querySelectorAll('.block-title, .f:not(.off) > span.l > span:first-child, .rowhead b')].map(e => e.textContent.trim())));
  }
  const missing = screen.filter(x => x && !txt.includes(norm(x.replace(/\d+$/, '').trim() || x)) && !/^(Child|Beneficiary)\s*\d*$/i.test(x));
  ok(missing.length === 0, 'every heading and label on the five screens is in the PDF' + (missing.length ? ': missing ' + missing.join(' | ') : ' (' + screen.length + ' texts)'));
  const answers = ['Kuiper', 'OldMutual', 'Personal Covers', '62012345678', 'FNB', 'Zoe Kuiper', 'Jan Kuiper', 'Spouse', '60%', '8001015009087', 'R 1 500.00'].filter(x => !txt.includes(norm(x)));
  ok(answers.length === 0, 'the answers on the screen are in the PDF' + (answers.length ? ': missing ' + answers.join(' | ') : ''));
  ok(await p.evaluate(() => SR.app.makePdf().getNumberOfPages()) === 1, 'two children and two beneficiaries (here three children and two beneficiaries) fit one page: ' + await p.evaluate(() => SR.app.makePdf().getNumberOfPages()) + ' page(s)');
  ok(await p.evaluate(() => { const s = SR.app.state; for (let i = 0; i < 8; i++) SR.store.addRow(s, 'kids', { name: 'Extra Child ' + i, id: '' }); const n = SR.app.makePdf().getNumberOfPages(); s.l.kids.splice(3, 8); return n === 2; }), 'with many more children the PDF grows to a second page');
  fs.unlinkSync(pdfFile);

  // 9. a new application, then opening the saved one
  await p.evaluate(() => { window.__done = 0; });
  await p.click('#btnNew'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => SR.app.state.f.fname.v === '' && SR.app.state.l.kids.length === 0), 'New gives a blank application');
  await p.setInputFiles('#fileIn', { name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(saved) }); await p.waitForTimeout(300);
  s = await st();
  ok(s.f.fname.v === 'Anna' && s.f.acc_no.v === '62012345678' && s.l.kids.length === 3 && s.l.benef.length === 2 && s.f.idno.st === 'confirmed', 'Open brings the whole application back, statuses included');
  await p.setInputFiles('#fileIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(factFindText()) }); await p.waitForTimeout(300);
  ok(/not a Wealth Revolution Short Risk Application/.test(await toast()) && (await st()).f.fname.v === 'Anna', 'a Fact Find file given to Open is refused and the application stays: ' + await toast());

  // 10. unsaved work is offered back, never shown on a blank form until chosen
  await page('client'); await type('owner', 'Changed owner');
  await p.reload(); await p.waitForTimeout(400);
  const q = await p.evaluate(() => { const dl = document.getElementById('restoreDraft'); return dl && dl.open ? dl.innerText.replace(/\s+/g, ' ') : null; });
  ok(q && /Unsaved changes found/.test(q) && /Anna Kuiper/.test(q), 'the unsaved changes are offered back: ' + q);
  ok(await p.evaluate(() => SR.app.state.f.fname.v === ''), 'the form behind the question is blank');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => { const dl = document.getElementById('restoreDraft'); return !!dl && dl.open; }), 'Escape does not close it: a choice is needed');
  await p.click('#restoreYes'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => SR.app.state.f.owner.v === 'Changed owner' && SR.app.state.l.kids.length === 3), 'Restore brings the application back');
  await p.reload(); await p.waitForTimeout(400); await p.click('#restoreNew'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('restoreDraft') && SR.app.state.f.fname.v === ''), 'Start a new application gives a blank form and the old draft is gone');

  // 11. the layout on a phone and at a narrow window
  for (const w of [390, 700, 1000]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    for (const pg of ['client', 'bank', 'family']) { await page(pg); }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 1, 'at ' + w + ' px wide there is no sideways scrolling (' + over + ' px over)');
  }
  await p.setViewportSize({ width: 1400, height: 1000 });
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
