// The Investment Capture Sheet page in a real browser: the pages and boxes, Old Mutual's product names, beneficiaries, Load from Fact Find and Load from Short Risk file, the Risk Tolerance questionnaire (answered on the page,
// worked out as it goes, its own PDF with a blank signature block saved in the Fact Find's folder), saving, opening, the unsaved-work question, the application's PDF (its text against the text of the screen) and the layout on a phone.
const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const dir = process.argv[3], shots = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'capture-sheet.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const ffStore = require(path.join(dir, 'js/store.js')), srStore = require(path.join(dir, 'js/sr-store.js'));
function factFindText() {
  const f = ffStore.blank();
  ffStore.setField(f, 'fname', 'Anna Maria'); ffStore.setField(f, 'sname', 'Kuiper'); ffStore.setField(f, 'idno', '8001015009087'); ffStore.setField(f, 'cell', '0821234567'); ffStore.setField(f, 'pemail', 'anna@example.com'); ffStore.setField(f, 'occ', 'Engineer');
  return ffStore.toJSON(f);
}
function shortRiskText() {
  const f = srStore.blank();
  srStore.setField(f, 'street_no', '12'); srStore.setField(f, 'street', 'Example Street'); srStore.setField(f, 'suburb', 'Fourways'); srStore.setField(f, 'city', 'Johannesburg'); srStore.setField(f, 'postal', '2191');
  srStore.setField(f, 'acc_holder', 'A M Kuiper'); srStore.setField(f, 'bank', 'Nedbank'); srStore.setField(f, 'branch_code', '198765'); srStore.setField(f, 'acc_type', 'Cheque'); srStore.setField(f, 'acc_no', '1234567890');
  srStore.addRow(f, 'benef', { name: 'Piet van der Merwe', id: '', relation: 'Spouse', pct: '60' }); srStore.addRow(f, 'benef', { name: 'Mia Kuiper', id: '', relation: 'Child', pct: '40' });
  return srStore.toJSON(f);
}
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const url = 'http://localhost:' + srv.address().port + '/';
  await p.goto(url); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => CS.app.state);
  const val = sel => p.evaluate(s => document.querySelector(s).value, sel);
  const type = async (id, v) => { await p.fill('[data-f="' + id + '"]', v); await p.press('[data-f="' + id + '"]', 'Tab'); await p.waitForTimeout(80); };
  const pick = async (id, v) => {
    const sel = '[data-f="' + id + '"]';
    if (await p.evaluate(s => document.querySelector(s).tagName === 'SELECT', sel)) await p.selectOption(sel, v); else { await p.fill(sel, v); await p.press(sel, 'Tab'); }
    await p.waitForTimeout(80);
  };
  const page = n => p.click('.nav button[data-page="' + n + '"]').then(() => p.waitForTimeout(150));
  const toast = () => p.evaluate(() => document.querySelector('#toast').textContent);
  const checks = () => p.evaluate(() => document.querySelector('#checks').innerText.replace(/\s+/g, ' '));
  const rt = (id, v) => p.evaluate(([i, w]) => { document.querySelector('[data-rt="' + i + '"][data-v="' + w.replace(/"/g, '\\"') + '"]').click(); }, [id, v]);
  const scale = ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'];

  // 1. the page
  ok(await p.title() === 'Investment Capture Sheet', 'the page is called Investment Capture Sheet: ' + await p.title());
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav button')].map(x => x.querySelector('span').textContent).join('|')) === 'Product & client|Contact & work|Beneficiaries & bank|Source of funds|Risk tolerance', 'five pages in the list on the left');
  ok(await p.evaluate(() => !document.querySelector('#btnVoice, #btnListen, #btnTimer, #btnSettings')), 'no voice, listen, meeting or settings buttons: this page needs no voice and no keys');
  ok(/Version 1\.0/.test(await p.evaluate(() => document.querySelector('#verLine').textContent)), 'the top says the version');
  ok(await p.evaluate(() => [...document.querySelectorAll('.top a.btn')].map(a => a.getAttribute('href')).join('|')) === 'index.html|short-risk.html', 'links to the Fact Find and the Short Risk Application in the top bar');
  ok(await p.evaluate(() => ['btnLoad', 'btnLoadSR'].map(i => document.getElementById(i).textContent.replace(/\s+/g, ' ').trim()).join('|')) === 'Load from Fact Find…|Load from Short Risk file…', 'two Load buttons');
  ok(await p.evaluate(() => document.querySelector('[data-f="date"]').value === FF.util.todayDMY()), 'the date of application starts as today');

  // 2. product, Old Mutual's names, the file name
  ok(await p.evaluate(() => [...document.querySelector('[data-f="product"]').options].map(o => o.textContent.trim()).filter(Boolean).join('|')) === 'Retirement Annuity|Tax-Free Investment|Endowment / Flexible Investment Plan|Living Annuity|Other', 'Product type offers the five investments');
  const names = () => p.evaluate(() => [...document.querySelectorAll('#dl-product_name option')].map(o => o.value));
  ok((await names()).length === 0, 'no product names are suggested before an insurer is chosen');
  await pick('provider', 'Old Mutual');
  ok((await names()).length === 8 && (await names()).includes('OM Tax Free recurring') && (await names()).includes('OM Flexi Investment Plan'), 'Old Mutual: its own eight product names are suggested: ' + (await names()).length);
  await type('product_name', 'Some other plan'); ok(await val('[data-f="product_name"]') === 'Some other plan', 'and any other name can still be typed');
  await pick('provider', 'Sanlam'); ok((await names()).length === 0, 'Sanlam: no list is suggested');
  await pick('provider', 'Old Mutual'); await pick('product', 'Tax-Free Investment'); await type('product_name', 'OM Tax Free recurring'); await pick('contrib_type', 'Recurring (monthly)');
  await type('amount', '2500'); ok(await val('[data-f="amount"]') === 'R 2 500.00', 'the amount is shown as Rand: ' + await val('[data-f="amount"]'));
  await type('start_date', '2026-12-01'); ok(await val('[data-f="start_date"]') === '01/12/2026', 'a date is shown day/month/year');
  await type('date', '12/11/2026'); await pick('replace', 'No'); await pick('deferred', 'No');
  await type('fname', 'Anna'); await type('sname', 'Kuiper');
  ok(await p.evaluate(() => document.querySelector('#meta .fn').textContent) === 'OM Capture Sheet - 12.11.26 - (Anna Kuiper)', 'the card says the name the files will be saved under: ' + await p.evaluate(() => document.querySelector('#meta .fn').textContent));
  ok(await p.evaluate(() => document.querySelector('#clientName').textContent) === 'Anna Kuiper', 'the client\'s name is at the top');
  ok(await p.evaluate(() => document.querySelector('[data-f="old_policy"]').disabled) , 'the old policy number is greyed out while nothing is replaced');
  await pick('replace', 'Yes'); ok(await p.evaluate(() => !document.querySelector('[data-f="old_policy"]').disabled), 'and opens when the policy is replaced'); await pick('replace', 'No');
  await pick('marital', 'Married'); ok(await p.evaluate(() => !document.querySelector('[data-f="marital_contract"]').disabled), 'Married opens the marriage boxes');
  await pick('marital', 'Single'); ok(await p.evaluate(() => document.querySelector('[data-f="marital_contract"]').disabled), 'Single greys them out again');

  // 3. wrong answers are said at the box and in the Checks
  await page('contact'); await type('cell', '12345'); await type('email', 'nope'); await type('postal_code', '21');
  const c3 = await checks();
  ok(/does not look like a phone number/.test(c3) && /e-mail address/.test(c3) && /four digits/.test(c3), 'a short phone number, a bad e-mail address and a short postal code are flagged');
  await type('cell', '082 123 4567'); await type('email', 'anna@example.com'); await type('postal_code', '2125');

  // 4. Load from Fact Find, then Load from Short Risk file
  await p.setInputFiles('#ffIn', { name: 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json', mimeType: 'application/json', buffer: Buffer.from(factFindText()) }); await p.waitForTimeout(300);
  let s = await st();
  ok(s.f.idno.v === '8001015009087' && s.f.idno.st === 'verify' && s.f.occupation.v === 'Engineer' && s.f.fname.v === 'Anna' && s.f.fname.st === 'confirmed', 'Load from Fact Find fills the ID number and occupation in amber and keeps the name that was typed');
  ok(/Loaded \d+ box/.test(await toast()) && /Left as typed/.test(await toast()), 'the message says what was loaded and what was left as typed: ' + await toast());
  await p.setInputFiles('#srIn', { name: 'Sanlam - Personal Covers Application - (Anna Kuiper).json', mimeType: 'application/json', buffer: Buffer.from(shortRiskText()) }); await p.waitForTimeout(300);
  s = await st();
  ok(s.f.residential.v === '12 Example Street, Fourways, Johannesburg' && s.f.residential_code.v === '2191' && s.f.bank.v === 'Nedbank' && s.f.acc_no.v === '1234567890' && s.f.acc_holder.st === 'verify', 'Load from Short Risk file fills the home address, bank details (amber)');
  ok(s.l.benef.length === 2 && s.l.benef[0].d.name === 'Piet' && s.l.benef[0].d.sname === 'van der Merwe' && s.l.benef[0].st === 'verify', 'and the beneficiaries, with van der Merwe kept whole: ' + JSON.stringify(s.l.benef.map(r => r.d.sname)));
  ok(/Loaded \d+ boxes? and 2 beneficiaries from the Short Risk Application/.test(await toast()), 'the message: ' + await toast());
  await p.setInputFiles('#srIn', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(factFindText()) }); await p.waitForTimeout(200);
  ok(/not a Wealth Revolution Short Risk Application/.test(await toast()), 'a Fact Find given to Load from Short Risk file is refused: ' + await toast());
  ok(await p.evaluate(() => !document.querySelector('#btnAgree').hidden && +document.querySelector('#sVerify').textContent >= 10), 'the Progress card counts what is to verify: ' + await p.evaluate(() => document.querySelector('#sVerify').textContent));
  await p.click('#btnAgree'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => +document.querySelector('#sVerify').textContent === 0), 'Agree all loaded details clears them');

  // 5. beneficiaries
  await page('bank');
  ok(await p.evaluate(() => /100%/.test(document.querySelector('[data-sum="benef"]').innerText) && document.querySelector('[data-sum="benef"]').classList.contains('ok')), 'the shares loaded (60% and 40%) add up to 100%');
  await p.click('[data-add="benef"]'); await p.waitForTimeout(100);
  await p.fill('[data-l="benef|2|name"]', 'Extra'); await p.fill('[data-l="benef|2|pct"]', '10'); await p.press('[data-l="benef|2|pct"]', 'Tab');
  ok(/add up to 110%/.test(await checks()), 'a third beneficiary makes 110%: flagged');
  await p.click('[data-del="benef|2"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => CS.app.state.l.benef.length) === 2 && !/add up to/.test(await checks()), 'and taking them away puts it right');

  // 6. the Declaration stays with the application: on Source of funds
  await page('funds');
  await type('src_funds', 'Salary savings'); await type('src_income', 'Salary'); await type('known_years', '6'); await type('funds_raised', 'Monthly salary'); await pick('own_knowledge', 'Yes');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec]')].map(e => e.getAttribute('data-sec')).join('|')) === 'funds|declare', 'the Source of funds page holds Source of funds & income and the Declaration');
  ok(await p.evaluate(() => document.querySelector('[data-sec="declare"] .block-title').textContent) === 'Declaration', 'with the heading Declaration');

  // 7. the Risk tolerance page
  await page('risk');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec]')].map(e => e.getAttribute('data-sec')).join('|')) === 'risk|risk_result', 'the Risk tolerance page: the questionnaire and its result');
  ok(await p.evaluate(() => document.querySelector('.rtwho').innerText.replace(/\s+/g, ' ')) === 'Client Anna Kuiper Financial Planner Paul Kafentzis Date 12/11/2026', 'the client\'s name, the planner and the date come from the form: ' + await p.evaluate(() => document.querySelector('.rtwho').innerText.replace(/\s+/g, ' ')));
  ok(await p.evaluate(() => document.querySelectorAll('.rttable tbody tr').length === 18 && document.querySelectorAll('.rtcap').length === 5), '18 statements and 5 capacity questions on the page');
  ok(await p.evaluate(() => !document.querySelector('canvas, [data-sig]')), 'no signature pad: the client signs the PDF later');
  ok(await p.evaluate(() => /to answer/.test(document.querySelector('[data-tier]').textContent) && +document.querySelector('[data-tier]').textContent.replace(/\D/g, '') === 24), 'the page shows its 24 boxes to answer');
  ok(await p.evaluate(() => /0 of 18 statements answered/.test(document.querySelector('[data-rtscore]').innerText)), 'no score yet: ' + await p.evaluate(() => document.querySelector('[data-rtscore]').innerText.replace(/\s+/g, ' ')));
  await p.click('[data-rtpdf="save"]'); await p.waitForTimeout(400);
  ok(/Answer all 18 statements and the 5 capacity questions first \(0 of 23 so far\)/.test(await toast()), 'the questionnaire\'s PDF is refused until it is answered, with the reason: ' + await toast());
  await rt('rt_understand', 'Confirmed');
  for (let i = 1; i <= 17; i++) await rt('rt_s' + i, scale[(i - 1) % 3 + 1]);
  ok(await p.evaluate(() => /17 of 18 statements answered/.test(document.querySelector('[data-rtscore]').innerText)), '17 answered: still no score');
  await rt('rt_s18', scale[(18 - 1) % 3 + 1]);
  ok(await p.evaluate(() => /^52\b/.test(document.querySelector('[data-rtscore] .big b').textContent) && document.querySelector('[data-rtscore] .bands .on').innerText.replace(/\s+/g, ' ') === 'Moderate 48-57' && /A moderate investor/.test(document.querySelector('[data-rtscore] p').textContent)), 'all 18 answered: the score 52, the Moderate profile highlighted and its description');
  ok(await p.evaluate(() => CS.app.state.f.risk_score.v === '52' && CS.app.state.f.risk_profile.v === 'Moderate' && CS.app.state.f.risk_ref.v === ''), 'the result boxes follow: score and profile, no reference yet');
  await rt('rt_s1', 'Disagree');
  ok(await p.evaluate(() => CS.app.state.f.rt_s1.v === '' && CS.app.state.f.risk_score.v === '' && /17 of 18/.test(document.querySelector('[data-rtscore]').innerText)), 'clicking the chosen answer again takes it back, and the score goes until it is answered again');
  await rt('rt_s1', 'Disagree');
  ok(await p.evaluate(() => CS.app.state.f.risk_score.v === '52'), 'answered again: the score is back');
  for (let i = 1; i <= 5; i++) await rt('rt_c' + i, await p.evaluate(n => CS.schema.rt.CAPACITY[n - 1].options[1], i));
  s = await st();
  ok(/^RT-\d{8}-\d{6}-[A-Z2-9]{4}$/.test(s.f.risk_ref.v) && s.f.risk_score.v === '52', 'all 23 answered: a reference is made: ' + s.f.risk_ref.v);
  ok(await val('[data-f="risk_profile"]') === 'Moderate' && await val('[data-f="risk_score"]') === '52' && await val('[data-f="risk_ref"]') === s.f.risk_ref.v && await p.evaluate(() => document.querySelector('[data-f="risk_score"]').readOnly), 'the three result boxes show it and cannot be typed over');
  ok(await p.evaluate(() => document.querySelector('[data-tier]').textContent === 'complete') && await p.evaluate(() => !!document.querySelector('.nav button[data-page="risk"] .ck')), 'the page and its tick in the list say complete');
  ok(/Complete\. Nothing is missing/.test(await checks()) || !/Risk tolerance:/.test(await checks()), 'and the Checks no longer list it');
  const ref1 = s.f.risk_ref.v; await rt('rt_s2', 'Strongly agree'); await p.waitForTimeout(50);
  ok((await st()).f.risk_ref.v !== ref1, 'changing an answer gives a new reference');
  await rt('rt_s2', 'Neither');
  ok(await p.evaluate(() => document.querySelector('.rtfile').innerText.includes('Risk Tolerance - 12.11.26 - (Anna Kuiper).pdf') && /blank signature block and date/.test(document.querySelector('.rtfile').innerText)), 'the page says the questionnaire PDF\'s own file name, and that its signature block and date are blank');
  await p.screenshot({ path: shots + '/cs-risk.png', fullPage: true });

  // 8. saving the application, and the questionnaire's PDF in the Fact Find's folder
  const fake = () => p.evaluate(() => {
    window.__file = { text: '' }; window.__sug = []; window.__start = [];
    const handle = { name: 'saved.json', requestPermission: () => Promise.resolve('granted'),
      createWritable: () => Promise.resolve({ write: blob => { window.__file.type = blob.type; return blob.arrayBuffer().then(ab => { window.__file.pending = new TextDecoder('latin1').decode(ab); window.__file.size = blob.size; window.__file.head = new TextDecoder('latin1').decode(ab.slice(0, 5)); }); }, close: () => { window.__file.text = window.__file.pending; return Promise.resolve(); } }),
      getFile: () => Promise.resolve({ text: () => Promise.resolve(window.__file.text) }) };
    window.showSaveFilePicker = o => { window.__sug.push(o && o.suggestedName); window.__start.push(o && o.startIn); return Promise.resolve(handle); };
  });
  await fake(); await p.click('#btnSave'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => window.__sug[0]) === 'OM Capture Sheet - 12.11.26 - (Anna Kuiper).json', 'Save suggests the application file name: ' + await p.evaluate(() => window.__sug[0]));
  ok(await p.evaluate(() => { const j = JSON.parse(window.__file.text); return j.app === 'wr-capture-sheet' && j.schema === '1.0' && j.f.rt_s3.v === 'Agree' && j.f.risk_score.v === '52' && j.l.benef.length === 2; }), 'the saved file holds every box, the questionnaire\'s answers, the result and the list');
  ok(await p.evaluate(() => localStorage.getItem('wr-capture-sheet-draft') === null && localStorage.getItem('wr-capture-sheet-draft-dirty') === '0'), 'after a save that is read back the draft is gone from the browser');
  const saved = await p.evaluate(() => window.__file.text);
  // the Fact Find the client was loaded from: its folder is where the questionnaire's PDF is offered
  await p.evaluate(txt => {
    window.__ffh = { name: 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json', kind: 'file', getFile: () => Promise.resolve(new File([txt], 'Fact Find (Audio to Text) - 10.11.26 - (Anna Kuiper).json', { type: 'application/json' })) };
    window.showOpenFilePicker = () => Promise.resolve([window.__ffh]);
  }, factFindText());
  await page('contact'); await p.click('#btnLoad'); await p.waitForTimeout(400);
  await page('risk'); await fake(); await p.click('[data-rtpdf="save"]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__sug[0]) === 'Risk Tolerance - 12.11.26 - (Anna Kuiper).pdf', 'Save questionnaire PDF suggests its own name: ' + await p.evaluate(() => window.__sug[0]));
  ok(await p.evaluate(() => window.__start[0] === window.__ffh), 'and the Save window opens in the folder of the Fact Find that was loaded (the client\'s "2. Fact Find" folder)');
  ok(await p.evaluate(() => window.__file.type === 'application/pdf' && window.__file.head === '%PDF-' && window.__file.size > 50000), 'what is written is a PDF (' + await p.evaluate(() => window.__file.size) + ' bytes), not the application\'s file');
  await fake(); await p.click('#btnPdf'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window.__sug[0]) === 'OM Capture Sheet - 12.11.26 - (Anna Kuiper).pdf' && await p.evaluate(() => window.__start[0] !== window.__ffh), 'Save PDF (the application) is a different file, with the application\'s name');

  // 9. the questionnaire's PDF and the application's PDF, read as text
  const pdfText = async b64 => { const f = path.join(os.tmpdir(), 'cs-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.pdf'); fs.writeFileSync(f, Buffer.from(b64, 'base64')); let t = ''; try { t = cp.execFileSync('pdftotext', ['-raw', f, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { t = ''; } fs.unlinkSync(f); return t; };
  const rtB64 = await p.evaluate(async () => { const r = await CS.rtpdf.build(CS.app.state); let s = ''; const u = r.bytes; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); });
  const rtTxt = await pdfText(rtB64), rtN = norm(rtTxt);
  ok(rtN.length > 500, 'the questionnaire\'s PDF can be read as text');
  ok(rtN.includes('annakuiper') && rtN.includes('paulkafentzis') && rtN.includes('12112026') && rtN.includes('rt' + (await st()).f.risk_ref.v.slice(3).replace(/\W/g, '').toLowerCase()), 'it carries the client, the planner, the date and the reference');
  ok(/Client Signature/.test(rtTxt) && /Signed at/.test(rtTxt) && /\bDate\b/.test(rtTxt), 'it has the Client Signature, Signed at and Date boxes');
  ok(!/Signed electronically|completion record|Electronic signature/i.test(rtTxt), 'and nothing says it was signed: the client signs it later');
  ok(/Moderate/.test(rtTxt) && /Strongly\s+Disagree/i.test(rtTxt), 'it has the profile and the questionnaire\'s statements');

  const ref = (await st()).f.risk_ref.v;
  const appB64 = await p.evaluate(() => CS.app.makePdf().output('datauristring').split(',')[1]);
  const txt = norm(await pdfText(appB64));
  ok(txt.length > 200, 'the application\'s PDF can be read as text');
  const screen = [];
  for (const pg of ['product', 'contact', 'bank', 'funds']) {
    await page(pg);
    screen.push(...await p.evaluate(() => [...document.querySelectorAll('.block-title, .f:not(.off) > span.l > span:first-child, .rowhead b')].map(e => e.textContent.trim())));
  }
  const missing = screen.filter(x => x && !txt.includes(norm(x.replace(/\d+$/, '').trim() || x)) && !/^(Beneficiary)\s*\d*$/i.test(x));
  ok(missing.length === 0, 'every heading and label on the first four screens is in the application\'s PDF' + (missing.length ? ': missing ' + missing.join(' | ') : ' (' + screen.length + ' texts)'));
  ok((await p.evaluate(() => CS.schema.rt.STATEMENTS.slice(0, 4))).every(q => !txt.includes(norm(q))), 'the questionnaire\'s statements are not in the application\'s PDF');
  const answers = ['Kuiper', 'OldMutual', 'Tax-Free Investment', 'OM Tax Free recurring', 'R 2 500.00', '1234567890', 'Nedbank', 'van der Merwe', '60%', '8001015009087', ref, 'Moderate', 'Resultofthequestionnaire', 'Declaration'].filter(x => !txt.includes(norm(x)));
  ok(answers.length === 0, 'the answers on the screen, the result and the Declaration are in the application\'s PDF' + (answers.length ? ': missing ' + answers.join(' | ') : ''));
  ok(await p.evaluate(() => CS.app.makePdf().getNumberOfPages()) <= 2, 'the application\'s PDF is one or two pages: ' + await p.evaluate(() => CS.app.makePdf().getNumberOfPages()));

  // 10. a new application, then opening the saved one
  await p.click('#btnNew'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => CS.app.state.f.fname.v === '' && CS.app.state.l.benef.length === 0 && CS.app.state.f.rt_s1.v === ''), 'New gives a blank application');
  await p.setInputFiles('#fileIn', { name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(saved) }); await p.waitForTimeout(300);
  s = await st();
  ok(s.f.fname.v === 'Anna' && s.f.rt_s3.v === 'Agree' && s.f.rt_c3.v !== '' && s.f.risk_ref.v !== '' && s.l.benef.length === 2, 'Open brings the whole application back, with the questionnaire\'s answers and result');
  await page('risk');
  ok(await p.evaluate(() => /^52\b/.test(document.querySelector('[data-rtscore] .big b').textContent) && document.querySelectorAll('.rtopt[aria-pressed="true"]').length === 18 && document.querySelectorAll('.rtchoice[aria-pressed="true"]').length === 6), 'and the page shows them: the score, 18 statements and the 5 questions plus the confirmation marked');
  await p.setInputFiles('#fileIn', { name: 'ff.json', mimeType: 'application/json', buffer: Buffer.from(factFindText()) }); await p.waitForTimeout(300);
  ok(/./.test(await toast()) && (await st()).f.fname.v === 'Anna', 'a Fact Find given to Open is refused and the application stays: ' + await toast());

  // 11. unsaved work is offered back, never shown on a blank form until chosen
  await page('product'); await type('product_name', 'OM Flexi Investment Plan');
  await p.reload(); await p.waitForTimeout(400);
  const q = await p.evaluate(() => { const dl = document.getElementById('restoreDraft'); return dl && dl.open ? dl.innerText.replace(/\s+/g, ' ') : null; });
  ok(q && /Unsaved changes found/.test(q) && /Anna Kuiper/.test(q), 'the unsaved changes are offered back: ' + q);
  ok(await p.evaluate(() => CS.app.state.f.fname.v === ''), 'the form behind the question is blank');
  await p.click('#restoreYes'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => CS.app.state.f.product_name.v === 'OM Flexi Investment Plan' && CS.app.state.f.rt_s3.v === 'Agree'), 'Restore brings the application back, the questionnaire\'s answers too');
  await p.reload(); await p.waitForTimeout(400); await p.click('#restoreNew'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('restoreDraft') && CS.app.state.f.fname.v === ''), 'Start a new application gives a blank form and the old draft is gone');

  // 12. the layout on a phone and at a narrow window
  for (const w of [390, 700, 1000]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    for (const pg of ['product', 'contact', 'bank', 'funds', 'risk']) { await page(pg); }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 1, 'at ' + w + ' px wide there is no sideways scrolling (' + over + ' px over)');
  }
  await p.setViewportSize({ width: 1400, height: 1000 });
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
});
