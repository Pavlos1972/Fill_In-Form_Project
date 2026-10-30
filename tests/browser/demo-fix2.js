const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-haiku-5-5', expires: '2026-11-15' })); });
  await p.reload();
  await p.evaluate(() => {
    window.__say = null; window.__asked = [];
    window.fetch = (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) return Promise.resolve(new Response('{"content":[],"usage":{}}', { status: 200 }));
      const newest = JSON.parse(req.messages[0].content[1].text).newest.text;
      window.__asked.push(newest);
      const acts = typeof window.__say === 'function' ? window.__say(newest) : [];
      return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: acts }) }], usage: { input_tokens: 1500, output_tokens: 60 } }), { status: 200, headers: { 'content-type': 'application/json' } })), 400));
    };
  });
  const val = id => p.evaluate(i => FF.app.state.f[i].v + ' [' + FF.app.state.f[i].st + ']', id);
  const sleep = ms => p.waitForTimeout(ms);
  const set = (id, v, st) => p.evaluate(([i, v, st]) => { FF.app.state.f[i] = { v, st }; FF.app.redraw(); }, [id, v, st]);
  const target = (id, answered) => p.evaluate(([i, a]) => { FF.app.voice.target = i; FF.app.voice.answered = a; FF.app.voice.lastNum = i; }, [id, answered]);
  await p.click('#btnVoice'); await sleep(300);

  console.log('1 edit a held number by speaking');
  const cases = [
    ['thanks you need an add an 8 to the end of nine please', 'tax', '123456789', '1234567898'],
    ['add a zero at the front', 'tax', '123456789', '0123456789'],
    ['put a 0 in front', 'tax', '123456789', '0123456789'],
    ['the last digit is 8', 'tax', '123456789', '1234567898'],
    ['it ends in 98', 'tax', '123456789', '1234567898'],
    ['the last two digits are nine eight', 'tax', '12345678', '1234567898'],
    ['change the last digit to 5', 'tax', '1234567898', '1234567895'],
    ['remove the last digit', 'tax', '12345678989', '1234567898'],
    ['delete the last two digits', 'tax', '123456789801', '1234567898'],
    ['add an 8 to the end', 'cell', '082 454 175', '082 454 1758'],
    ['add a 6 at the end', 'idno', '721209526808', '7212095268086'],
  ];
  for (const [line, id, start, want] of cases) {
    await set(id, start, 'verify'); await target(id, true);
    await p.evaluate(l => { window.__say = () => []; FF.app.voiceHear(l); }, line);
    await sleep(700);
    const got = await val(id); const ok = got.replace(/\s/g, '').startsWith(want.replace(/\s/g, '') + '[');
    console.log('   ' + (ok ? 'ok  ' : 'FAIL') + ' "' + line + '": ' + start + ' -> ' + got);
  }
  console.log('   asked Claude for an edit:', await p.evaluate(() => window.__asked.length), '(0 expected)');
  await set('tax', '', 'empty'); await target('tax', false);
  await p.evaluate(() => { FF.app.voice.lastNum = null; window.__say = () => []; FF.app.voiceHear('add an 8 to the end'); }); await sleep(700);
  console.log('   nothing held: tax =', JSON.stringify(await val('tax')));

  console.log('2 Claude must not confirm what the same line just put in the box');
  await set('cell', '', 'empty'); await target('cell', false);
  await p.evaluate(() => { window.__say = () => [{ do: 'confirm', field: 'cell' }]; FF.app.voiceHear("it's 0 8 2 4 5 4 1 7 5 1"); });
  await sleep(150); const q = await val('cell'); await sleep(900); console.log('   at once:', q, '| after Claude said confirm:', await val('cell'));
  await p.evaluate(() => { window.__say = () => [{ do: 'confirm', field: 'cell' }]; FF.app.voiceHear('yes that is right'); }); await sleep(900);
  console.log('   then the client says "yes that is right":', await val('cell'));

  console.log('3 an ordinary line is not mistaken for an edit');
  await set('fname', '', 'empty'); await target('fname', false);
  await p.evaluate(() => { window.__say = () => [{ do: 'fill', field: 'fname', value: 'Paul' }]; FF.app.voiceHear('my name is Paul and I like to add sugar to the end of my day'); }); await sleep(900);
  console.log('   fname =', await val('fname'), '| asked Claude:', await p.evaluate(() => window.__asked.length));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
