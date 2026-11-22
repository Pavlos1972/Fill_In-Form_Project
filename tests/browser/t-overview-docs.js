/* The Client Overview's documents (stage 4) on the real page, with an invented client ("Test Client"; no real client data). The Anthropic call is a stand-in (window.fetch is replaced for that one address and records
   what it was asked), so no document ever leaves the machine here. Covers: reading is OFF to start with and a document is only recorded (a quote is started from the number and date in its file name, nothing leaves the page);
   documents the page cannot sort ask what they are; switching reading on asks first, and with no key says so; with a key a quote is read into amber rows with its file, the totals follow; a refused key, a failed read and a
   bad answer are told in plain words and the document is still recorded; Replace quote; a schedule fills the item it is for and never adds one; a document for something that is not in the Fact Find is not guessed. */
const { chromium } = require((process.argv[2]) + '/playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const dir = process.argv[3], out = process.argv[4];
const FFJ = { app: 'wr-fact-find', schema: '5.4', f: { fname: { v: 'Test' }, sname: { v: 'Client' }, net: { v: 'R 40 000.00' }, ip_age: { v: '65' } },
  l: { kids: [{ d: { name: 'Amy', sname: 'Client', cost: 'R 5 000.00' } }], debts: [{ d: { type: 'Home loan', prov: 'Test Bank', desc: 'Home loan', inst: 'R 12 000.00' } }],
    risk: [{ d: { prov: 'Other Insurer', spend: 'R 1 200.00', broker: 'Other broker' } }], grp: [{ d: { prov: 'Test Group', spend: '', broker: 'Other broker' } }], ret_pp: [], ret_ra: [{ d: { prov: 'Test RA Co', val: 'R 50 000.00', contrib: 'R 600.00', broker: 'Paul K' } }], inv: [] } };
const QUOTE = { insurer: 'BrightRock', number: '100000020', date: '19/11/2026', rates: 'Non-smoker rates', aci: 10, premium: 2900, disabilityAge: 65,
  lines: [{ type: 'household', life: { lump: 800000, monthly: 5000 }, lsd: { lump: 900000, monthly: 12500 }, ip: { monthly: 22500 }, abi: 5 }, { type: 'child', name: 'Amy', sname: 'Client', term: 'Age 24', life: { lump: 500000, monthly: 5000 }, lsd: { lump: 450000, monthly: 5000 }, abi: 5 },
    { type: 'debt', debt: 'Home loan', bank: 'Test Bank', life: { lump: 1200000, monthly: 12000 }, lsd: { lump: 1200000, monthly: 12000 }, ip: { monthly: 12000 }, abi: 0 }, { type: 'death', life: { lump: 600000, monthly: 7500 }, abi: 3 }, { type: 'dread', sev: { lump: 500000 }, abi: 3 }] };
const POLICY = { insurer: 'Other Insurer', product: 'Test Protector', policyNo: 'P-11', doc: '01/12/2025', premium: 1281.9, aci: 10, lines: [{ type: 'other', label: 'Life', life: { lump: 1000000 } }, { type: 'other', label: 'Dread', sev: { lump: 300000 } }] };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.__api = []; window.__reply = null;
    const real = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).indexOf('api.anthropic.com') < 0) return real(url, opt);
      const body = JSON.parse(opt.body); window.__api.push({ url: String(url), key: opt.headers['x-api-key'], type: body.messages[0].content[0].type, data: body.messages[0].content[0].source.data, prompt: body.messages[0].content[1].text });
      const r = window.__reply; if (r === 'offline') return Promise.reject(new TypeError('offline'));
      return Promise.resolve({ ok: !r || r.status < 400, status: r ? r.status : 200, json: async () => (r && r.body) || { content: [{ type: 'text', text: '{}' }] } });
    };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + dir + '/overview.html'); await p.waitForTimeout(500); await p.evaluate(() => OV.app.openAll());          // the page starts folded (See more); this test is about what is inside
  await p.evaluate(t => OV.app.fillFactFindText(t, 'ff.json'), JSON.stringify(FFJ));
  const file = (name, text) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(text || '%PDF-1.4 fake') });
  const upload = async (files, sel) => { await p.setInputFiles(sel || '#docIn', files); await p.waitForTimeout(400); };
  const st = () => p.evaluate(() => OV.app.state);
  const toast = () => p.evaluate(() => document.querySelector('#toast').textContent);
  const side = () => p.evaluate(() => document.querySelector('#docs').innerText.replace(/\s+/g, ' '));
  const calls = () => p.evaluate(() => window.__api.length);
  const reply = r => p.evaluate(r => { window.__reply = r; }, r);

  /* ---- 1. reading is ON to start with; switched off, a document is only recorded ---- */
  ok(await p.evaluate(() => document.querySelector('#aiSwitch').checked) && /no Anthropic key/.test(await p.evaluate(() => document.querySelector('#aiNote').textContent)), '1. reading is ON to start with (Paul\'s decision of 22 November), and with no key the card says so');
  await p.uncheck('#aiSwitch'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('#aiSwitch').checked) && /Off: an uploaded document is only recorded/.test(await p.evaluate(() => document.querySelector('#aiNote').textContent)), '1. switched OFF by the adviser: a document is only recorded, and the page says what that means');
  await upload([file('BR FNA - 100000001 - R2900.00 - 19.11.26.pdf'), file('BR Reduced Quote - 100000003 - R1400.00 - 04.09.26.pdf'), file('notes.pdf')]);
  const dlgText = await p.evaluate(() => { const d = document.querySelector('dialog.fdlg[open]'); return d ? d.innerText : ''; });
  ok(/What are these documents\?/.test(dlgText) && /notes\.pdf/.test(dlgText) && !/BR FNA - 100000001|BR Reduced/.test(dlgText), '1. the one the page cannot sort asks what it is (the other two are sorted by their names)');
  await p.selectOption('dialog.fdlg[open] select', 'comparative'); await p.click('dialog.fdlg[open] [data-yes]'); await p.waitForTimeout(500);
  let s = await st(), fna = s.blocks.fna.quotes[0], red = s.blocks.reduced.quotes[0];
  ok(fna && fna.number === '100000001' && fna.date === '19/11/2026' && fna.premium === null && fna.src.file.startsWith('BR FNA'), '1. the FNA quote was started from the number and date in its file name (the premium in the name is not taken)');
  ok(fna.lines.every(l => l.st === 'ff') && red && red.number === '100000003' && s.blocks.comparative.quotes.length === 1, '1. its lines still wait for the document; the reduced quote and the comparative quote are there too');
  ok(s.documents.length === 3 && (await calls()) === 0, '1. three documents recorded, and nothing was sent anywhere');
  ok(/3 documents loaded/.test(await toast()) && /BR FNA - 100000001/.test(await side()) && /recorded/.test(await side()), '1. the message and the Documents card say what was loaded: ' + (await toast()).slice(0, 90));

  /* ---- 2. switching reading on asks first; with no key it says so and only records ---- */
  await p.check('#aiSwitch'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelector('#aiSwitch').checked) && /no Anthropic key/.test(await p.evaluate(() => document.querySelector('#aiNote').textContent)), '2. switched on (after the question), the card says there is no key yet');
  await upload([file('BR Shortfall - 100000002 - R2500.00 - 20.11.26.pdf')]);
  ok((await calls()) === 0 && (await st()).blocks.shortfallQuote.quotes.length === 1 && /no Anthropic key/.test(await side()), '2. with no key the document is only recorded, and nothing is sent');

  /* ---- 3. with a key: the quote is read into amber rows with its file; the totals follow ---- */
  await p.evaluate(() => FF.lookup.saveSettings({ apiKey: 'sk-test-key', model: 'claude-test' }));
  await p.evaluate(q => { window.__reply = { status: 200, body: { content: [{ type: 'text', text: '```json\n' + JSON.stringify(q) + '\n```' }], usage: { input_tokens: 5, output_tokens: 5 } } }; }, QUOTE);
  await p.evaluate(() => OV.app.go('fna'));
  await upload([file('BR FNA - 100000020 - R2900.00 - 19.11.26.pdf', '%PDF-1.4 the quote')]);
  s = await st(); const q2 = s.blocks.fna.quotes[1];
  const api = await p.evaluate(() => window.__api);
  ok(api.length === 1 && api[0].key === 'sk-test-key' && api[0].type === 'document' && Buffer.from(api[0].data, 'base64').toString() === '%PDF-1.4 the quote' && /insurance quote/.test(api[0].prompt), '3. the document went to Anthropic as itself (base64) with the key and the quote instructions');
  ok(q2 && q2.number === '100000020' && q2.lines.length === 5 && q2.lines.every(l => l.st === 'verify' && l.by === 'page' && l.src.file.startsWith('BR FNA - 100000020')) && q2.st === 'verify', '3. read into a new quote: five lines, amber, each with its file');
  ok(await p.evaluate(() => /R3,100,000/.test(document.querySelectorAll('[data-comp^="qtot"]')[1].innerText.replace(/\s+/g, '')) || /R3,100,000/.test(document.body.innerText.replace(/\s+/g, ''))), '3. the totals follow the figures that were read');
  ok(await p.evaluate(() => document.querySelectorAll('.qcard').length) === 2 && /to check/.test(await p.evaluate(() => document.querySelectorAll('.qcard')[1].innerText)), '3. the new quote shows "to check"');
  ok(!(await st()).blocks.fna.quotes[1].lines.some(l => l.st === 'confirmed'), '3. nothing read is marked as checked');
  await p.screenshot({ path: out + '/overview-docs-read.png', fullPage: true });

  /* ---- 4. failures are told in plain words, and the document is still recorded ---- */
  const n0 = (await st()).documents.length;
  await reply({ status: 401, body: { error: { message: 'invalid x-api-key' } } });
  await upload([file('BR Reduced Quote - 100000030 - R1000.00 - 05.01.27.pdf')]);
  ok(/key was not accepted/.test(await side()) && (await st()).documents.length === n0 + 1 && (await st()).blocks.reduced.quotes.some(q => q.number === '100000030'), '4. a refused key: said in plain words; the document is recorded and a quote started from its name');
  await reply({ status: 200, body: { content: [{ type: 'text', text: 'I am sorry, I cannot read this.' }] } });
  await upload([file('BR Reduced Quote - 100000031 - R1000.00 - 05.01.27.pdf')]);
  ok(/did not give anything|could not be read/.test(await side()), '4. an answer that is not figures: said so');
  await reply('offline'); await upload([file('BR Reduced Quote - 100000032 - R1000.00 - 05.01.27.pdf')]);
  ok(/Could not reach Anthropic/.test(await side()), '4. no connection: said so');

  /* ---- 5. Replace quote: the old one is removed (with Undo), the new one takes its place ---- */
  await p.evaluate(q => { window.__reply = { status: 200, body: { content: [{ type: 'text', text: JSON.stringify(Object.assign({}, q, { number: '100000099' })) }] } }; }, QUOTE);
  await p.evaluate(() => OV.app.go('fna'));
  const oldId = await p.evaluate(() => OV.app.state.blocks.fna.quotes[1].id);
  await p.click('.qcard:nth-of-type(2) [data-replace], [data-replace$="|' + oldId + '"]'); await p.waitForTimeout(100);
  await upload([file('BR FNA - 100000099 - R3000.00 - 06.01.27.pdf')], '#docOne');
  s = await st(); const oldQ = s.blocks.fna.quotes.filter(q => q.id === oldId)[0], newQ = s.blocks.fna.quotes.filter(q => q.number === '100000099')[0];
  ok(oldQ.removed && oldQ.replacedBy === newQ.id && newQ.replaces === oldId, '5. Replace quote: the old one is removed and says what replaced it; the new one says what it replaced');
  ok(/removed\. Undo/.test(await p.evaluate(() => document.querySelector('#main').innerText.replace(/\s+/g, ' '))), '5. the old one can be brought back (Undo)');

  /* ---- 6. a schedule fills the item it is for; it never adds one; a document for something not in the Fact Find is not guessed ---- */
  await p.evaluate(p2 => { window.__reply = { status: 200, body: { content: [{ type: 'text', text: JSON.stringify(p2) }] } }; }, POLICY);
  await p.evaluate(() => OV.app.go('policies'));
  const items0 = await p.evaluate(() => OV.app.state.blocks.policies.items.length);
  await p.click('[data-upi$="|policies"]'); await p.waitForTimeout(100);
  await upload([file('Other Insurer PS - 123456789.pdf')], '#docOne');
  s = await st(); const it = s.blocks.policies.items[0];
  ok(it.product === 'Test Protector' && it.policyNo === 'P-11' && it.premium === 1281.9 && it.lines.length === 2 && it.st === 'verify' && it.src.file === 'Other Insurer PS - 123456789.pdf' && s.blocks.policies.items.length === items0, '6. the schedule filled the details of the item it was for (amber, with its file) and added no item');
  ok(/doc\.vs\.factfind|the document says R1,281\.90; the Fact Find has R1,200/.test(await p.evaluate(() => document.querySelector('#checks').textContent.replace(/\s+/g, ' '))) || /1,281\.90/.test(await p.evaluate(() => document.querySelector('#checks').textContent)), '6. the difference from the Fact Find is listed (the document wins)');
  await p.evaluate(p2 => { window.__reply = { status: 200, body: { content: [{ type: 'text', text: JSON.stringify(Object.assign({}, p2, { insurer: 'Nobody Assurance', policyNo: 'Z-9' })) }] } }; }, POLICY);
  await upload([file('Nobody Assurance Policy Schedule.pdf')]);
  ok(/not in the Fact Find/.test(await side()) && (await st()).blocks.policies.items.length === items0, '6. a schedule for an insurer that is not in the Fact Find is not guessed: it says to add it in the Fact Find first, and adds nothing');

  /* ---- 7. reading off again: nothing is sent; the switch is remembered per browser ---- */
  await p.uncheck('#aiSwitch'); const n1 = await calls();
  await upload([file('BR FNA - 100000050 - R1.00 - 07.01.27.pdf')]);
  ok((await calls()) === n1 && !(await p.evaluate(() => localStorage.getItem('wr-overview-read') === '1')), '7. switched off again: nothing is sent');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(bad ? 'FAILED ' + bad : 'ALL PASSED'); process.exit(bad ? 1 : 0);
})();
