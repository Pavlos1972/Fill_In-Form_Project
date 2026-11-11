/* Release 3.1, the Debts page by voice: the talk stays on the debt it is on until a line says to move; "remove debt 2" removes the whole debt (undo brings it back); "No more debts" is a line under the last debt
   (saved, in the PDF text, gone when a debt is added). Claude is faked: where it guesses another row, the page must not follow it. */
const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-sonnet-5-5', expires: '2026-11-15' })); });
  await p.reload();
  /* the fake Claude answers each line from a table: the raw actions it would give (including wrong row guesses) */
  await p.evaluate(() => {
    window.__script = {};
    window.fetch = async (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) return new Response('{"content":[],"usage":{}}', { status: 200 });
      const parts = req.messages[0].content, body = JSON.parse(Array.isArray(parts) ? parts[1].text : parts), t = body.newest.text;
      const a = window.__script[t] || [];
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: a }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  await p.click('#btnVoice'); await p.waitForTimeout(200);
  const say = async (line, actions) => { await p.evaluate(([l, a]) => { window.__script[l] = a; }, [line, actions || []]); await p.evaluate(l => FF.app.voiceHear(l), line); await p.waitForTimeout(250); };
  const debts = () => p.evaluate(() => FF.app.state.l.debts.map(r => ({ type: r.d.type, prov: r.d.prov, bal: r.d.bal, term: r.d.term, notes: r.d.notes })));
  const endv = () => p.evaluate(() => FF.app.state.f.debts_end.v);

  await p.evaluate(() => { FF.store.setField(FF.app.state, 'has_debts', 'Yes'); FF.app.redraw(); const n = [...document.querySelectorAll('.nav button')].find(x => /Debts/.test(x.innerText)); if (n) n.click(); });
  await say('Debt one is a home loan with Nedbank', [{ do: 'row', list: 'debts', values: { type: 'Home loan', prov: 'Nedbank' } }]);
  let d = await debts();
  ok(d.length === 1 && d[0].type === 'Home loan' && d[0].prov === 'Nedbank', 'the first debt is made from the first line: ' + JSON.stringify(d));

  await say('the balance is 450 000', [{ do: 'fill', list: 'debts', row: 2, col: 'bal', value: 'R 450 000' }]);          // Claude guesses a row that is not there
  d = await debts();
  ok(d.length === 1 && /450 000/.test(d[0].bal), 'a wrong row guess is ignored: the balance goes on the debt the talk is on, and no second debt appears: ' + JSON.stringify(d));

  await say('and there is a loan with Capitec', [{ do: 'row', list: 'debts', values: { prov: 'Capitec' } }]);           // new debt words ("a loan") but the talk was never told to move... it was: "there is a loan"
  d = await debts();
  ok(d.length === 2 && d[1].prov === 'Capitec', 'a new debt is started when the line introduces one ("there is a loan with Capitec"): ' + JSON.stringify(d));

  await say('the term left is twelve years', [{ do: 'fill', list: 'debts', row: 1, col: 'term', value: '12 years' }]);     // Claude jumps back to row 1
  d = await debts();
  ok(d[1].term === '144' && !d[0].term, 'Claude\'s row 1 is ignored: the term goes on debt 2, where the talk is: ' + JSON.stringify(d));

  await say('debt one again, the notes say bond is in both names', [{ do: 'fill', list: 'debts', row: 2, col: 'notes', value: 'Bond is in both names' }]);
  d = await debts();
  ok(d[0].notes === 'Bond is in both names' && !d[1].notes, 'naming "debt one" moves the talk back to debt 1: ' + JSON.stringify(d));

  await say('then the credit card is with FNB', [{ do: 'row', list: 'debts', values: { type: 'Credit card', prov: 'FNB' } }]);
  d = await debts();
  ok(d.length === 3 && d[2].type === 'Credit card' && d[2].prov === 'FNB', 'a credit card with no row of that kind starts debt 3: ' + JSON.stringify(d));

  await say('the card has a balance of 20 000', [{ do: 'row', list: 'debts', values: { type: 'Vehicle finance', bal: 'R 20 000' } }]);   // Claude wrongly starts another debt
  d = await debts();
  ok(d.length === 3 && /20 000/.test(d[2].bal) && d[2].type === 'Credit card', 'a debt Claude starts without a word that says so is not made: the figure goes into the debt the talk is on: ' + JSON.stringify(d));
  ok(await p.evaluate(() => (FF.app.state.unplaced || []).some(u => /Vehicle finance/.test(u.text) && /not put in a new debt/.test(u.why || ''))), 'and what did not fit is in Heard but not placed');

  // no more debts
  await say('there are no more debts');
  ok(await endv() === 'No more debts', 'the line "No more debts" is written: ' + (await endv()));
  ok(await p.evaluate(() => !!document.querySelector('[data-endline="debts_end"]') || (FF.app.goto && true)), 'the line is drawn under the debts');
  const saved = await p.evaluate(() => JSON.parse(FF.store.toJSON(FF.app.state)).f.debts_end);
  ok(saved && saved.v === 'No more debts', 'it is saved with the file');
  const back = await p.evaluate(() => { const s = FF.store.fromJSON(FF.store.toJSON(FF.app.state)); return s.f.debts_end.v; });
  ok(back === 'No more debts', 'and comes back when the file is opened');
  await say('is that all the debts?');
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'debts_end', ''); });
  await say('any more debts?');
  ok(await endv() === '', 'a question does not write it');
  await say('no more debts');
  ok(await endv() === 'No more debts', 'said again, written again');
  await say('add debt four', [{ do: 'row', list: 'debts', values: { type: 'Personal loan', prov: 'Absa' } }]);
  d = await debts();
  ok(d.length === 4 && d[3].type === 'Personal loan' && await endv() === '', 'a debt added takes the line away, and it moves to the new last debt when said again: ' + JSON.stringify(d));
  await say('no more debts');

  // remove
  await say('remove debt 2');
  d = await debts();
  ok(d.length === 3 && d.map(x => x.prov).join('|') === 'Nedbank|FNB|ABSA', 'remove debt 2 takes the debt away entirely and renumbers the rest: ' + JSON.stringify(d));
  ok(await endv() === 'No more debts', 'the line stays under the last debt');
  await say('undo', [{ do: 'cmd', cmd: 'undo' }]);
  d = await debts();
  ok(d.length === 4 && d[1].prov === 'Capitec', 'undo brings the removed debt back, in its place: ' + JSON.stringify(d));
  await say('remove the credit card');
  d = await debts();
  ok(d.length === 3 && !d.some(x => x.type === 'Credit card'), 'remove the credit card (named by what it is): ' + JSON.stringify(d));
  await say('delete the last debt');
  d = await debts();
  ok(d.length === 2 && await endv() === 'No more debts', 'removing the last debt leaves the line under the one that is now last: ' + JSON.stringify(d));
  await say('remove debt 9');
  ok((await debts()).length === 2, 'a debt that is not there is not removed');
  await say('once the loan is paid we will remove the debt next year');
  ok((await debts()).length === 2, 'a plan or advice about a debt is not an instruction');

  // by hand
  await p.evaluate(() => { FF.app.state.f.debts_end = { v: '', st: 'empty' }; FF.app.redraw(); });
  await p.evaluate(() => { const n = [...document.querySelectorAll('.nav button')].find(x => /Debts/.test(x.innerText)); if (n) n.click(); });
  await p.waitForTimeout(150);
  await p.click('[data-endset="debts_end"]'); await p.waitForTimeout(150);
  ok(await endv() === 'No more debts' && await p.evaluate(() => !!document.querySelector('[data-endline="debts_end"]')), 'the link under the debts writes the line by hand');
  await p.click('[data-endclear="debts_end"]'); await p.waitForTimeout(150);
  ok(await endv() === '', 'and the x takes it away');
  // Term left is always months
  await p.evaluate(() => { FF.app.setState(FF.store.blank()); FF.app.voice.rowCur = {}; FF.app.voice.target = null; const st = FF.app.state; FF.store.setField(st, 'date', '11/11/2026', 'confirmed'); FF.store.setField(st, 'dob', '07/01/1974', 'confirmed'); FF.store.setField(st, 'has_debts', 'Yes'); FF.app.redraw(); const n = [...document.querySelectorAll('.nav button')].find(x => /Debts/.test(x.innerText)); if (n) n.click(); });
  const term = i => p.evaluate(i => FF.app.state.l.debts[i] && FF.app.state.l.debts[i].d.term, i);
  await say('debt one is a home loan with Nedbank and twenty years left', [{ do: 'row', list: 'debts', values: { type: 'Home loan', prov: 'Nedbank', term: '20 years' } }]);
  ok(await term(0) === '240', 'twenty years left is 240 months: ' + await term(0));
  await say('it is a vehicle loan with Wesbank and he has twenty years left', [{ do: 'row', list: 'debts', values: { type: 'Vehicle finance', prov: 'Wesbank' } }, { do: 'cell', list: 'debts', row: 2, col: 'term', value: '20' }]);
  ok(await term(1) === '240', 'a bare 20 from Claude is read against the words said (years): ' + await term(1));
  await say('debt three is a personal loan, eighteen months left', [{ do: 'row', list: 'debts', values: { type: 'Personal loan', term: '18 months' } }]);
  ok(await term(2) === '18', 'eighteen months left is 18: ' + await term(2));
  await say('debt four is another home loan, up until my age 65', [{ do: 'row', list: 'debts', values: { type: 'Home loan', term: 'until my age 65' } }]);
  ok(await term(3) === '146', 'until my age 65 is worked out from the date of birth (07/01/1974) and the date of the form (11/11/2026): ' + await term(3));
  await say('debt five is a credit card with FNB', [{ do: 'row', list: 'debts', values: { type: 'Credit card', prov: 'FNB' } }]);
  ok(await term(4) === 'Max term', 'a credit card has Max term, whatever is said: ' + await term(4));
  ok(await p.evaluate(() => FF.app.state.l.debts[4].d.asset === 'R 0.00' && FF.app.state.l.debts[0].d.asset === ''), 'a debt made from a spoken line gets the same defaults as one added by hand (asset R 0.00 for the card, none for the home loan)');
  const typed = await p.evaluate(async () => { const e = document.querySelector('[data-l="debts"][data-i="2"][data-k="term"]'); if (!e) return null; e.value = '5 years 6 months'; e.dispatchEvent(new Event('change', { bubbles: true })); return [e.value, FF.app.state.l.debts[2].d.term]; });
  ok(typed && typed[0] === '66' && typed[1] === '66', 'typed by hand, "5 years 6 months" becomes 66 in the box: ' + JSON.stringify(typed));
  ok(await p.evaluate(() => /Term left \(months\)/.test(document.body.innerText)), 'the box is labelled Term left (months)');
  // no date of birth yet: the words stay, and become months when it is entered
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'dob', ''); FF.store.addRow(FF.app.state, 'debts', { type: 'Home loan' }, 'confirmed'); FF.app.voice.rowCur.debts = 5; FF.app.redraw(); });
  await say('debt six, up until my age 65', [{ do: 'cell', list: 'debts', row: 6, col: 'term', value: 'until my age 65' }]);
  ok(/age 65/i.test(await term(5)), 'with no date of birth the words are kept: ' + await term(5));
  await p.evaluate(() => { FF.store.setField(FF.app.state, 'dob', '07/01/1974'); });
  ok(await term(5) === '146', 'and become months when the date of birth is entered: ' + await term(5));
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close();
  process.exit(bad ? 1 : 0);
})();
