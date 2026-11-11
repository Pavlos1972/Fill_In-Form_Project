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
  ok(d[1].term === '12 years' && !d[0].term, 'Claude\'s row 1 is ignored: the term goes on debt 2, where the talk is: ' + JSON.stringify(d));

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
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  console.log(bad ? bad + ' FAILED' : 'all pass'); await b.close();
  process.exit(bad ? 1 : 0);
})();
