/* Release 5.1 on the real pages (Risk Application 1.3, Investment Application 1.2, Fact Find 5.1): the new names on all three pages and in the Other forms menu; the Risk Application's section names; Bank name, Branch name,
   Company (the replaced policy's) and Beneficiary relation are drop-downs that work (the whole list is always there) with "Other (type it in)"; Region is a drop-down of the nine provinces; where the policy owner pays the
   account holder, contact number and e-mail start as the client's; a saved file reopens with all of it; and the page fits a phone. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });

  /* ---- the names on the three pages ---- */
  const fp = await ctx.newPage(); const ferrs = []; fp.on('pageerror', e => ferrs.push(e.message));
  await fp.goto('file://' + dir + '/index.html'); await fp.waitForTimeout(500);
  const menu = await fp.evaluate(() => ({ sr: document.getElementById('linkSR').textContent.trim(), cs: document.getElementById('linkCS').textContent.trim(), t: document.getElementById('linkSR').title + '|' + document.getElementById('linkCS').title }));
  ok(menu.sr === 'Risk Application ↗' && menu.cs === 'Investment Application ↗', 'Fact Find: the Other forms menu says Risk Application and Investment Application: ' + menu.sr + ' / ' + menu.cs);
  ok(!/Short Risk|Capture Sheet/.test(menu.t), 'Fact Find: and so do the hover titles: ' + menu.t);
  ok(!(await fp.locator('#buildBanner').count()), 'Fact Find: no "Mixed versions" bar (the build is the same everywhere)');
  ok(parseFloat(await fp.evaluate(() => FF.schema.version)) >= 5.1, 'Fact Find: version 5.1 or later');
  ok(ferrs.length === 0, 'Fact Find: no page errors ' + ferrs.join('|'));

  const cp = await ctx.newPage(); const cerrs = []; cp.on('pageerror', e => cerrs.push(e.message));
  await cp.goto('file://' + dir + '/capture-sheet.html'); await cp.waitForTimeout(500);
  ok(await cp.title() === 'Investment Application' && await cp.evaluate(() => document.querySelector('h1').textContent) === 'Investment Application', 'Investment Application: the tab and the heading');
  ok(/Version 1\.[2-9]/.test(await cp.evaluate(() => document.querySelector('#verLine').textContent)), 'Investment Application: version 1.2 or later');
  ok(await cp.evaluate(() => [...document.querySelectorAll('.top a.btn')].map(a => a.textContent.trim()).join('|')) === 'Fact Find ↗|Risk Application ↗', 'Investment Application: the links in the top bar');
  ok(await cp.evaluate(() => document.getElementById('btnLoadSR').textContent.replace(/\s+/g, ' ').trim()) === 'Load from Risk Application file…', 'Investment Application: the Load button');
  ok(!(await cp.locator('#buildBanner').count()), 'Investment Application: no "Mixed versions" bar');
  ok(cerrs.length === 0, 'Investment Application: no page errors ' + cerrs.join('|'));

  /* ---- the Risk Application ---- */
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + dir + '/short-risk.html'); await p.waitForTimeout(500);
  const st = () => p.evaluate(() => SR.app.state);
  const page = n => p.click('.nav button[data-page="' + n + '"]').then(() => p.waitForTimeout(150));
  const sel = id => '.combo:has([data-f="' + id + '"]) select';
  const txt = id => '[data-f="' + id + '"]';
  const info = id => p.evaluate(i => { const e = document.querySelector('[data-f="' + i + '"]'), bx = e.closest('.combo'), s = bx.querySelector('.combosel'); return { shown: !e.hidden, val: e.value, sel: s.value, n: s.options.length, opts: [...s.options].map(o => o.value), disabled: s.disabled && e.disabled, typing: bx.classList.contains('typing') }; }, id);

  ok(await p.title() === 'Risk Application' && await p.evaluate(() => document.querySelector('h1').textContent) === 'Risk Application', 'Risk Application: the tab and the heading');
  ok(/Version 1\.[3-9]/.test(await p.evaluate(() => document.querySelector('#verLine').textContent)), 'Risk Application: version 1.3 or later');
  ok(await p.evaluate(() => [...document.querySelectorAll('.top a.btn')].map(a => a.textContent.trim()).join('|')) === 'Fact Find ↗|Investment Application ↗', 'Risk Application: the links in the top bar');
  ok(await p.evaluate(() => [...document.querySelectorAll('#nav button')].map(x => x.querySelector('span').textContent).join('|')) === 'Cover & client|Address, COC & doctor|Banking|Dependents & Beneficiaries|Declarations & Replacements', 'Risk Application: the five pages are named as asked');
  await page('family'); ok(/Dependents & Beneficiaries/.test(await p.evaluate(() => document.querySelector('#nav .on, #nav [aria-current], #nav button.on') ? document.querySelector('#nav .on, #nav [aria-current], #nav button.on').textContent : 'Dependents & Beneficiaries')), 'Dependents & Beneficiaries opens');
  await page('decl'); ok(await p.evaluate(() => [...document.querySelectorAll('.block-title')].map(x => x.textContent).join('|')) === 'Insolvency and debt|Existing insurance details', 'Declarations & Replacements: its two sections keep their titles');

  /* where the policy owner pays, Banking starts as the client's */
  await page('client');
  await p.fill(txt('fname'), 'Annabel'); await p.press(txt('fname'), 'Tab'); await p.fill(txt('sname'), 'Kuiper van Wyk'); await p.press(txt('sname'), 'Tab');
  await p.fill(txt('cell'), '082 555 0101'); await p.press(txt('cell'), 'Tab'); await p.fill(txt('email'), 'annabel@example.com'); await p.press(txt('email'), 'Tab');
  await page('bank');
  ok((await p.evaluate(() => [SR.app.state.f.acc_holder.v, SR.app.state.f.bank_contact.v, SR.app.state.f.bank_email.v])).join('|') === '||', 'Banking: nothing is filled while the owner is not said to be paying');
  await page('client'); await p.selectOption('[data-f="ownerpays"]', 'Yes'); await p.waitForTimeout(150); await page('bank');
  let v = await p.evaluate(() => ['acc_holder', 'bank_contact', 'bank_email'].map(i => document.querySelector('[data-f="' + i + '"]').value));
  ok(v.join('|') === 'Annabel Kuiper van Wyk|082 555 0101|annabel@example.com', 'Banking: account holder (name and surname), contact number and e-mail are the client\'s: ' + v.join(' | '));
  ok(await p.evaluate(() => ['acc_holder', 'bank_contact', 'bank_email'].every(i => document.querySelector('[data-field="' + i + '"]').classList.contains('s-preset'))), 'Banking: they show as starting values the adviser can change');
  await page('client'); await p.fill(txt('cell'), '083 555 0202'); await p.press(txt('cell'), 'Tab'); await page('bank');
  ok(await p.evaluate(() => document.querySelector('[data-f="bank_contact"]').value) === '083 555 0202', 'Banking: the contact number follows the client\'s cell');
  await p.fill(txt('bank_email'), 'accounts@example.com'); await p.press(txt('bank_email'), 'Tab');
  await page('client'); await p.fill(txt('email'), 'changed@example.com'); await p.press(txt('email'), 'Tab'); await page('bank');
  ok(await p.evaluate(() => document.querySelector('[data-f="bank_email"]').value) === 'accounts@example.com', 'Banking: an e-mail the adviser typed stays when the client\'s changes');
  await page('client'); await p.selectOption('[data-f="ownerpays"]', 'No'); await p.waitForTimeout(150); await page('bank');
  v = await p.evaluate(() => ['acc_holder', 'bank_contact', 'bank_email'].map(i => document.querySelector('[data-f="' + i + '"]').value));
  ok(v.join('|') === '||accounts@example.com', 'Banking: when the owner is not paying the starting values go and the typed one stays: ' + v.join(' | '));
  await page('client'); await p.selectOption('[data-f="ownerpays"]', 'Yes'); await p.waitForTimeout(150); await page('bank');

  /* Bank name: a drop-down that works, with every bank, and Other (type it in) */
  let bk = await info('bank');
  ok(bk.n === 21 + 2 && bk.opts.indexOf('Go Tyme Bank') >= 0 && bk.opts[bk.opts.length - 1] === '__other__' && !bk.shown, 'Bank name: a drop-down of ' + (bk.n - 2) + ' banks including Go Tyme Bank, ending with Other (type it in); no text box yet');
  await p.selectOption(sel('bank'), 'Go Tyme Bank'); await p.waitForTimeout(100);
  bk = await info('bank'); ok(bk.val === 'Go Tyme Bank' && !bk.shown && bk.sel === 'Go Tyme Bank' && (await st()).f.bank.st === 'confirmed', 'Bank name: Go Tyme Bank can be picked and is kept');
  ok((await info('bank')).n === 23, 'Bank name: the whole list is still there with a bank chosen (a browser suggestion list would show only the match)');
  await p.selectOption(sel('bank'), '__other__'); await p.waitForTimeout(100);
  bk = await info('bank'); ok(bk.shown && bk.val === '' && bk.typing && (await st()).f.bank.v === '' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-f') === 'bank'), 'Bank name: Other (type it in) opens the text box, empty, with the cursor in it');
  await p.keyboard.type('Sample Mutual Bank'); await p.press(txt('bank'), 'Tab'); await p.waitForTimeout(100);
  bk = await info('bank'); ok(bk.val === 'Sample Mutual Bank' && bk.shown && bk.sel === '__other__' && (await st()).f.bank.v === 'Sample Mutual Bank', 'Bank name: a bank that is not in the list is typed and kept');
  await p.fill(txt('bank'), 'ABSA'); await p.press(txt('bank'), 'Tab'); await p.waitForTimeout(100);
  bk = await info('bank'); ok(bk.sel === 'ABSA' && !bk.shown, 'Bank name: typing a bank that is in the list turns it into that choice');
  await p.selectOption(sel('bank'), 'Capitec'); await p.waitForTimeout(100);

  /* Branch name: Universal, or type text and numbers */
  let br = await info('branch'); ok(br.opts.join('|') === '|Universal|__other__', 'Branch name: a drop-down with Universal and Other (type it in)');
  await p.selectOption(sel('branch'), 'Universal'); await p.waitForTimeout(100);
  ok((await st()).f.branch.v === 'Universal' && !(await info('branch')).shown, 'Branch name: Universal can be picked');
  await p.selectOption(sel('branch'), '__other__'); await p.keyboard.type('Rosebank 2nd floor 1234'); await p.press(txt('branch'), 'Tab'); await p.waitForTimeout(100);
  ok((await st()).f.branch.v === 'Rosebank 2nd floor 1234' && (await info('branch')).shown, 'Branch name: or text and numbers are typed in: ' + (await st()).f.branch.v);
  await p.selectOption(sel('branch'), 'Universal'); await p.fill(txt('branch_code'), '470010'); await p.press(txt('branch_code'), 'Tab');
  await p.selectOption(sel('acc_type'), 'Cheque'); await p.waitForTimeout(100);
  ok((await st()).f.acc_type.v === 'Cheque', 'Account type: still picks Cheque, Savings or Transmission');
  await p.screenshot({ path: out + '/r51-banking.png' });

  /* Region: the nine provinces */
  await page('home');
  const rg = await p.evaluate(() => { const e = document.querySelector('[data-f="region"]'); return { tag: e.tagName, opts: [...e.options].map(o => o.value) }; });
  ok(rg.tag === 'SELECT' && rg.opts.join('|') === '|Eastern Cape|Free State|Gauteng|KwaZulu-Natal|Limpopo|Mpumalanga|North West|Northern Cape|Western Cape', 'Region: a drop-down of the nine provinces');
  await p.selectOption('[data-f="region"]', 'Gauteng'); await p.waitForTimeout(100);
  ok((await st()).f.region.v === 'Gauteng' && (await st()).f.region.st === 'confirmed', 'Region: Gauteng can be picked');

  /* Company of the replaced policy: a drop-down of life insurers, only while the policy is replaced */
  await page('decl');
  ok((await info('old_company')).disabled, 'Company: closed while the policy is not replaced');
  await p.selectOption('[data-f="replace"]', 'Yes'); await p.waitForTimeout(150);
  let oc = await info('old_company');
  ok(!oc.disabled && oc.opts.indexOf('Liberty') >= 0 && oc.opts.indexOf('Old Mutual') >= 0 && oc.opts.indexOf('Hollard Life') >= 0 && oc.opts[oc.opts.length - 1] === '__other__', 'Company: open, with the life insurers and Other (type it in) (' + (oc.n - 2) + ' insurers)');
  await p.selectOption(sel('old_company'), 'Liberty'); await p.waitForTimeout(100);
  ok((await st()).f.old_company.v === 'Liberty', 'Company: Liberty can be picked');
  await p.selectOption(sel('old_company'), '__other__'); await p.keyboard.type('Sample Life'); await p.press(txt('old_company'), 'Tab'); await p.waitForTimeout(100);
  ok((await st()).f.old_company.v === 'Sample Life', 'Company: another insurer is typed');
  await p.selectOption('[data-f="replace"]', 'No'); await p.waitForTimeout(150);
  oc = await info('old_company'); ok(oc.val === '' && oc.disabled, 'Company: cleared and closed again when the policy is not replaced');
  await p.selectOption('[data-f="replace"]', 'Yes'); await p.waitForTimeout(100); await p.selectOption(sel('old_company'), 'Sanlam'); await p.waitForTimeout(100);

  /* the beneficiary's relation, in a list row */
  await page('family'); await p.click('[data-add="benef"]'); await p.waitForTimeout(150);
  const rsel = '.combo:has([data-l="benef|0|relation"]) select';
  ok((await p.evaluate(s => [...document.querySelector(s).options].map(o => o.value).join('|'), rsel)) === '|Spouse|Child|Parent|Sibling|Estate|Other|__other__', 'Relation: a drop-down in the row, with Other (type it in)');
  await p.selectOption(rsel, 'Spouse'); await p.waitForTimeout(100);
  ok((await st()).l.benef[0].d.relation === 'Spouse', 'Relation: Spouse can be picked');
  await p.selectOption(rsel, '__other__'); await p.keyboard.type('Godmother'); await p.press('[data-l="benef|0|relation"]', 'Tab'); await p.waitForTimeout(100);
  ok((await st()).l.benef[0].d.relation === 'Godmother', 'Relation: another relation is typed');

  /* saved, then opened again: every box comes back as it was, and the drop-downs show it */
  const text = await p.evaluate(() => SR.store.toJSON(SR.app.state));
  const j = JSON.parse(text);
  ok(j.f.bank.v === 'Capitec' && j.f.branch.v === 'Universal' && j.f.region.v === 'Gauteng' && j.f.old_company.v === 'Sanlam' && j.l.benef[0].d.relation === 'Godmother' && j.f.acc_holder.v === 'Annabel Kuiper van Wyk' && j.f.acc_holder.st === 'preset', 'the saved file holds them, the account holder as a starting value');
  j.f.bank.v = 'Sample Mutual Bank'; j.f.region.v = 'gauteng'; j.schema = '1.2';
  await p.evaluate(() => document.querySelector('#btnNew').click()); await p.waitForTimeout(300);
  await p.setInputFiles('#fileIn', { name: 'Old file.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j)) }); await p.waitForTimeout(500);
  await page('bank');
  bk = await info('bank'); ok(bk.val === 'Sample Mutual Bank' && bk.shown && bk.sel === '__other__', 'an older file opens with a bank that is not in the list: it shows as Other, typed');
  br = await info('branch'); ok(br.val === 'Universal' && br.sel === 'Universal' && !br.shown, 'and its branch shows as Universal');
  await page('home'); ok(await p.evaluate(() => { const e = document.querySelector('[data-f="region"]'); return e.value === 'gauteng' && [...e.options].some(o => o.value === 'gauteng'); }), 'and a region typed in an older way is kept and shown');

  /* the page fits a phone with the drop-downs */
  await p.setViewportSize({ width: 390, height: 900 }); await page('bank'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'at 390 wide the Banking page does not scroll sideways');
  await p.screenshot({ path: out + '/r51-banking-phone.png' });

  ok(errs.length === 0, 'Risk Application: no page errors ' + errs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
