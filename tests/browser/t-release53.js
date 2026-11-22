/* Release 5.3 on the real pages (Fact Find 5.3, Risk Application 1.5, Investment Application 1.4):
   1. Date completed has a Calendar. 2. Spousal / Child Maintenance greyed unless divorced (single too, for Child Maintenance). 3. Short-term broker: Cameron Maritz, not Paul K.
   4. The client's yes (or the same value said again) after the adviser reads a value back confirms the box, on any page, with and without Claude: the Date of marriage left at "verify" in a real meeting.
   5. The conversation log is kept in the browser (real IndexedDB), offered back after a reload, and Save log with nothing says so.
   6. The Risk Application opens as Address, COC & doctor; both applications have the Other forms menu and open filled from the Fact Find (and ask before replacing another client's unsaved work). */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], out = process.argv[4];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = []; const watch = p => { p.on('pageerror', e => errs.push(e.message)); return p; };
  const fresh = async (opts) => { const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } }); return { ctx, p: watch(await ctx.newPage()) }; };
  const set = (p, id, v, st) => p.evaluate(([id, v, st]) => { FF.store.setField(FF.app.state, id, v, st || 'confirmed'); FF.app.redraw(); }, [id, v, st]);

  /* ---- 1 to 3: the boxes ---- */
  {
    const { p } = await fresh();
    await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !!document.querySelector('[data-cal="date"]') && !!document.querySelector('[data-calpick="date"]')), '1. Date completed has a Calendar button and its picker');
    await p.evaluate(() => { const pk = document.querySelector('[data-calpick="date"]'); pk.value = '2026-12-04'; pk.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => FF.app.state.f.date.v) === '04/12/2026', '1. a date picked from the calendar is written as day/month/year: ' + await p.evaluate(() => FF.app.state.f.date.v));
    await p.screenshot({ path: out + '/release53-date.png' });

    await p.click('.nav button[data-sec="income"]'); await p.waitForTimeout(250);
    const off = id => p.evaluate(id => { const e = document.querySelector('[data-field="' + id + '"]'); return !!e && (e.hasAttribute('inert') || e.classList.contains('off')); }, id);
    ok(!(await off('spmaint')) && !(await off('maint')), '2. marital status not answered: both maintenance boxes are open');
    for (const [st, sp, ch] of [['Divorced', false, false], ['Single', true, false], ['Married in community of property', true, true], ['Civil union', true, true], ['Life partner', true, true], ['Widowed', true, true]]) {
      await set(p, 'marital', st); await p.waitForTimeout(150);
      ok((await off('spmaint')) === sp && (await off('maint')) === ch, '2. ' + st + ': Spousal Maintenance ' + (sp ? 'greyed' : 'open') + ', Child Maintenance ' + (ch ? 'greyed' : 'open'));
    }
    await set(p, 'marital', 'Married out of community (with accrual)'); await set(p, 'maint', 'R 2 000.00'); await set(p, 'net', 'R 50 000.00'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => FF.app.state.f.tinc.v !== undefined) && await p.evaluate(() => FF.calc.field('tinc', FF.store.ctxFor(FF.app.state))) === 'R 50 000.00', '2. a greyed Child Maintenance is left out of Total Income (R 50 000.00)');
    await p.screenshot({ path: out + '/release53-maintenance.png' });

    await set(p, 'sti', 'Yes'); await p.click('.nav button[data-sec="other"]'); await p.waitForTimeout(250);
    const opts = await p.evaluate(() => [...document.querySelectorAll('[data-field="sti_broker"] select option')].map(o => o.textContent.trim()).filter(Boolean));
    ok(JSON.stringify(opts) === JSON.stringify(['Cameron Maritz', 'Other broker', 'Through company', 'None']), '3. short-term Broker on record: ' + JSON.stringify(opts));
    const wopts = await p.evaluate(() => { const e = document.querySelector('[data-field="will_broker"] select'); return e ? [...e.options].map(o => o.textContent.trim()).filter(Boolean) : null; });
    ok(await set(p, 'will', 'Yes').then(() => p.waitForTimeout(150)).then(() => p.evaluate(() => [...document.querySelector('[data-field="will_broker"] select').options].map(o => o.textContent.trim()).filter(Boolean).indexOf('Paul K') >= 0)), '3. the Will broker still offers Paul K');
    await set(p, 'sti_broker', 'Paul K', 'heard'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const s = document.querySelector('[data-field="sti_broker"] select'); return s.options[s.selectedIndex].textContent.trim(); }) === 'Paul K', '3. an older file\'s Paul K is still shown (nothing is hidden or cleared)');
    await set(p, 'sti_broker', 'Cameron Maritz', 'confirmed'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const s = document.querySelector('[data-field="sti_broker"] select'); return s.options[s.selectedIndex].textContent.trim(); }) === 'Cameron Maritz', '3. Cameron Maritz can be chosen');
    await p.screenshot({ path: out + '/release53-shortterm.png' });
  }

  /* ---- 4: the client agrees to a read-back (no Claude key: this computer's own reading, plus the new rule) ---- */
  const exchange = async (name, lines, expect, startSec) => {
    const { ctx, p } = await fresh();
    await p.goto('file://' + dir + '/index.html');
    await set(p, 'marital', 'Married out of community (with accrual)');
    await p.click('.nav button[data-sec="' + (startSec || 'income') + '"]'); await p.waitForTimeout(200);
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    for (const [txt, w] of lines) { await p.evaluate(([t, w]) => FF.app.voiceHear(t, w), [txt, w]); await p.waitForTimeout(150); }
    const st = await p.evaluate(() => FF.app.state.f.marr_date.st);
    ok(st === expect, '4. ' + name + ' -> ' + expect + ' (' + st + ')'); await ctx.close();
  };
  const ASK = ['when did you get married?', 'me'], SAY = ['the fourteenth of March 2010', 'client'], BACK = ['so 14 March 2010, is that right?', 'me'];
  await exchange('client says yes after the read-back', [ASK, SAY, BACK, ['yes', 'client']], 'confirmed');
  await exchange('the same, with the screen on another page', [ASK, SAY, BACK, ['yes', 'client']], 'confirmed', 'cover');
  await exchange('client says "that\'s right"', [ASK, SAY, BACK, ['that\'s right', 'client']], 'confirmed');
  await exchange('client says the date again', [ASK, SAY, ['so that is 14 March 2010?', 'me'], ['14th of March 2010', 'client']], 'confirmed');
  await exchange('one microphone: read-back, then yes', [['when did you get married?'], ['the fourteenth of March 2010'], ['so 14 March 2010, is that correct?'], ['yes']], 'confirmed');
  await exchange('the adviser says yes himself', [ASK, SAY, BACK, ['yes', 'me']], 'verify');
  await exchange('one microphone: no read-back, then yes', [['when did you get married?'], ['the fourteenth of March 2010'], ['okay lovely'], ['yes']], 'verify');
  await exchange('the client says yes to a different question', [ASK, SAY, ['do you have any children?', 'me'], ['yes', 'client']], 'verify');
  await exchange('the client says the date again with no read-back before it', [ASK, SAY, ['mm hm', 'me'], ['14th of March 2010', 'client']], 'verify');
  {  // with Claude: it answers nothing to the "yes" (the case that left the box amber)
    const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } }), p = watch(await ctx.newPage());
    await p.goto('file://' + dir + '/index.html');
    await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-12-31' })); });
    await p.reload(); await p.waitForTimeout(300);
    await p.evaluate(() => {
      window.fetch = async (url, init) => {
        const req = JSON.parse(init.body);
        if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
        return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: [] }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
    });
    await set(p, 'marital', 'Married out of community (with accrual)'); await set(p, 'marr_date', '14/03/2010', 'verify');
    await p.click('.nav button[data-sec="cover"]'); await p.waitForTimeout(200);
    await p.click('#btnVoice'); await p.waitForTimeout(250);
    for (const [txt, w] of [BACK, ['yes', 'client']]) { await p.evaluate(([t, w]) => FF.app.voiceHear(t, w), [txt, w]); await p.waitForTimeout(400); }
    ok(await p.evaluate(() => FF.app.state.f.marr_date.st) === 'confirmed', '4. with Claude answering nothing, the client\'s yes still turns the Date of marriage green');
    await ctx.close();
  }
  {  // money and a name read back, and a private number compared on this computer
    const { ctx, p } = await fresh();
    await p.goto('file://' + dir + '/index.html');
    await set(p, 'exp', 'R 38 000.00', 'verify'); await set(p, 'sp_name', 'Marius Zeller', 'verify'); await set(p, 'marital', 'Married out of community (with accrual)');
    await p.click('.nav button[data-sec="admin"]'); await p.click('#btnVoice'); await p.waitForTimeout(250);
    for (const [txt, w] of [['so your monthly expenses are 38 000 rand, correct?', 'me'], ['yes', 'client'], ['and your husband is Marius Zeller, is that right?', 'me'], ['yes that is right', 'client']]) { await p.evaluate(([t, w]) => FF.app.voiceHear(t, w), [txt, w]); await p.waitForTimeout(200); }
    ok(await p.evaluate(() => [FF.app.state.f.exp.st, FF.app.state.f.sp_name.st].join()) === 'confirmed,confirmed', '4. an amount and a name read back and agreed turn green: ' + await p.evaluate(() => [FF.app.state.f.exp.st, FF.app.state.f.sp_name.st].join()));
    await ctx.close();
  }

  /* ---- 5: the conversation log is kept in the browser ---- */
  {
    const { ctx, p } = await fresh();
    await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('cvSave').click()); await p.waitForTimeout(400);
    ok(/Nothing to save/.test(await p.evaluate(() => { const t = document.getElementById('toast'); return t.hidden ? '' : t.textContent; })), '5. Save log with no lines says so');
    await set(p, 'fname', 'Anna', 'confirmed'); await set(p, 'sname', 'Kuiper', 'confirmed');
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    for (const [t, w] of [['what is your occupation?', 'me'], ['I am a teacher', 'client'], ['do you have any children?', 'me'], ['yes two', 'client']]) { await p.evaluate(([t, w]) => FF.app.voiceHear(t, w), [t, w]); await p.waitForTimeout(150); }
    ok(await p.evaluate(() => FF.app.voiceLog().lines.length) >= 4, '5. the log holds the lines heard');
    await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await p.waitForTimeout(600);
    const kept = await p.evaluate(async () => { const k = FF.logkeep.create(FF.logkeep.idbBackend()); const rows = await k.list(), one = rows[0] && await k.read(rows[0].sid); return { n: rows.length, lines: one && one.lines.length, client: one && one.client }; });
    ok(kept.n === 1 && kept.lines >= 4 && kept.client === 'Anna Kuiper', '5. the lines are kept in the browser, with the client: ' + JSON.stringify(kept));
    await p.reload(); await p.waitForTimeout(800);
    const bar = await p.evaluate(() => { const e = document.getElementById('logbar'); return e && !e.hidden ? e.textContent : ''; });
    ok(/has not been saved/.test(bar) && /Anna Kuiper/.test(bar), '5. after a reload the page says the log was not saved: ' + bar.slice(0, 100));
    await p.evaluate(() => document.getElementById('cvSave').click()); await p.waitForTimeout(500);
    const dlg = await p.evaluate(() => { const d = document.getElementById('logDlg'); return d && d.open ? d.textContent : ''; });
    ok(/Anna Kuiper/.test(dlg) && /Save log/.test(dlg) && /Throw away/.test(dlg), '5. Save log with nothing heard offers the kept log');
    await p.screenshot({ path: out + '/release53-logdialog.png' });
    p.on('dialog', d => d.accept());
    await p.evaluate(() => document.querySelector('[data-logdrop]').click()); await p.waitForTimeout(600);
    ok(await p.evaluate(async () => (await FF.logkeep.create(FF.logkeep.idbBackend()).list()).length) === 0, '5. throwing it away removes it');
    // a new client: the log of the one being left is kept and the reminder shows
    await p.evaluate(() => { const nb = document.getElementById('restoreNew'); if (nb) nb.click(); }); await p.evaluate(() => { const d = document.getElementById('logDlg'); if (d && d.open) d.close(); }); await p.waitForTimeout(200);
    await p.click('#btnVoice'); await p.waitForTimeout(200);
    await set(p, 'fname', 'Piet', 'confirmed'); await set(p, 'sname', 'Botha', 'confirmed');
    for (const [t, w] of [['what is your occupation?', 'me'], ['I am an engineer', 'client']]) { await p.evaluate(([t, w]) => FF.app.voiceHear(t, w), [t, w]); await p.waitForTimeout(150); }
    await p.evaluate(() => document.getElementById('btnNew').click()); await p.waitForTimeout(800);
    const bar2 = await p.evaluate(() => { const e = document.getElementById('logbar'); return e && !e.hidden ? e.textContent : ''; });
    ok(/Piet Botha/.test(bar2) && /has not been saved/.test(bar2), '5. starting a new client reminds that the last conversation log was not saved: ' + bar2.slice(0, 100));
    await ctx.close();
  }

  /* ---- 6: the two applications ---- */
  {
    const { ctx, p: ff } = await fresh();
    await ff.goto('file://' + dir + '/index.html');
    await ff.evaluate(() => {
      const S = FF.app.state, st = (id, v, s) => FF.store.setField(S, id, v, s || 'confirmed');
      st('fname', 'Anna Maria'); st('sname', 'Kuiper'); st('idno', '9001015800088'); st('cell', '082 555 0101'); st('pemail', 'anna.kuiper@example.com');
      st('marital', 'Married out of community (with accrual)'); st('marr_date', '14/03/2010'); st('occ', 'Teacher'); st('tax', '1234567890');
      FF.store.addRow(S, 'kids', { name: 'Thandi', sname: 'Kuiper', dob: '29/04/2015' }); FF.app.redraw();
    });
    await ff.click('#otherForms summary');
    const [sr] = await Promise.all([ctx.waitForEvent('page'), ff.click('#linkSR')]);
    watch(sr); await sr.waitForLoadState(); await sr.waitForTimeout(600);
    const v = await sr.evaluate(() => { const s = SR.app.state; return { fname: s.f.fname, sname: s.f.sname, idno: s.f.idno.v, cell: s.f.cell.v, email: s.f.email.v, kids: s.l.kids.length, from: s.from && s.from.name, search: location.search }; });
    ok(v.fname.v === 'Anna Maria' && v.sname.v === 'Kuiper' && v.idno === '9001015800088' && v.cell === '082 555 0101' && v.email === 'anna.kuiper@example.com' && v.kids === 1, '6. the Risk Application opens filled from the Fact Find, no file needed: ' + JSON.stringify([v.fname.v, v.sname.v, v.kids]));
    ok(v.fname.st === 'verify' && /Fact Find/.test(v.from || '') && v.search === '', '6. loaded boxes are amber verify, the source is named, and the address is tidied');
    await sr.screenshot({ path: out + '/release53-sr.png' });
    const navTitles = await sr.evaluate(() => [...document.querySelectorAll('#nav button')].map(x => x.querySelector('span').textContent));
    ok(navTitles[1] === 'Address, COC & doctor' && !navTitles.some(t => /Home COC/.test(t)), '6. the second page is Address, COC & doctor: ' + JSON.stringify(navTitles));
    ok(await sr.evaluate(() => [...document.querySelectorAll('#otherForms .ofmenu a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()).join('|')) === 'Fact Find ↗|Investment Application ↗|Client Overview Studio ↗', '6. Risk Application: Other forms lists Fact Find, Investment Application and Client Overview');
    await sr.click('#otherForms summary'); ok(await sr.evaluate(() => document.getElementById('otherForms').open), '6. the menu opens');
    await sr.keyboard.press('Escape'); ok(!(await sr.evaluate(() => document.getElementById('otherForms').open)), '6. Escape closes it');
    await sr.click('#otherForms summary');
    const [cs] = await Promise.all([ctx.waitForEvent('page'), sr.click('#linkCS')]);
    watch(cs); await cs.waitForLoadState(); await cs.waitForTimeout(600);
    const c = await cs.evaluate(() => { const s = CS.app.state; return { fname: s.f.fname, sname: s.f.sname, idno: s.f.idno.v, occ: s.f.occupation.v, tax: s.f.tax_no.v }; });
    ok(c.fname.v === 'Anna Maria' && c.sname.v === 'Kuiper' && c.idno === '9001015800088' && c.occ === 'Teacher' && c.tax === '1234567890' && c.fname.st === 'verify', '6. the Investment Application opens filled too (also from the Risk Application\'s menu)');
    ok(await cs.evaluate(() => [...document.querySelectorAll('#otherForms .ofmenu a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()).join('|')) === 'Fact Find ↗|Risk Application ↗|Client Overview Studio ↗', '6. Investment Application: Other forms lists Fact Find, Risk Application and Client Overview');
    await cs.screenshot({ path: out + '/release53-cs.png' });
    const direct = watch(await ctx.newPage()); await direct.goto('file://' + dir + '/short-risk.html'); await direct.waitForTimeout(500);
    ok((await direct.evaluate(() => SR.app.state.f.fname.v)) === '', '6. a page opened on its own stays blank');
    // another client's unsaved work is asked about
    const other = watch(await ctx.newPage()); await other.goto('file://' + dir + '/short-risk.html'); await other.waitForTimeout(300);
    await other.evaluate(() => {
      localStorage.setItem('wr-short-risk-draft', JSON.stringify({ app: 'wr-short-risk', schema: '1.5', f: { fname: { v: 'Piet', st: 'confirmed' }, sname: { v: 'Botha', st: 'confirmed' } }, l: {} }));
      localStorage.setItem('wr-short-risk-draft-file', ''); localStorage.setItem('wr-short-risk-draft-dirty', '1');
    });
    await other.goto('file://' + dir + '/short-risk.html?from=factfind'); await other.waitForTimeout(700);
    const q = await other.evaluate(() => { const d = document.getElementById('restoreDraft'); return d && d.open ? d.textContent : ''; });
    ok(/Anna Maria Kuiper/.test(q) && /Piet Botha/.test(q) && /Start a new application for Anna Maria Kuiper/.test(q), '6. unsaved work for another client is asked about, not replaced: ' + q.slice(0, 120));
    await other.screenshot({ path: out + '/release53-ask.png' });
    await other.click('#restoreNew'); await other.waitForTimeout(500);
    ok((await other.evaluate(() => SR.app.state.f.sname.v)) === 'Kuiper', '6. choosing the Fact Find\'s client fills the new application');
    await ff.bringToFront(); ff.on('dialog', d => d.accept()); await ff.evaluate(() => document.getElementById('btnNew').click()); await ff.waitForTimeout(300);
    ok(await ff.evaluate(() => localStorage.getItem('wr-handover') === null), '6. a new Fact Find forgets the hand-over');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(bad ? 'FAILED ' + bad : 'ALL PASSED');
  process.exit(bad ? 1 : 0);
})();
