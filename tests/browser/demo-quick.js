const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(() => {
    localStorage.setItem('wr-fact-find-settings', JSON.stringify({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', voiceModel: 'claude-haiku-5-5', expires: '2026-11-15' }));
  });
  await p.reload();
  // Claude stand-in: answers after 2.5 s; what it says is set per test through window.__say
  await p.evaluate(() => {
    window.__log = []; window.__say = null; window.__delay = 2500;
    window.fetch = (url, init) => {
      const req = JSON.parse(init.body);
      if (req.max_tokens === 0) { window.__log.push('warm ' + JSON.stringify(req.thinking)); return Promise.resolve(new Response('{"content":[],"usage":{"cache_creation_input_tokens":6000}}', { status: 200 })); }
      const newest = JSON.parse(req.messages[0].content[1].text).newest.text;
      window.__log.push('ask ' + newest.slice(0, 40) + ' thinking=' + JSON.stringify(req.thinking));
      const acts = typeof window.__say === 'function' ? window.__say(newest) : [];
      return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ actions: acts }) }], usage: { input_tokens: 1500, output_tokens: 60, cache_read_input_tokens: 5900 } }), { status: 200, headers: { 'content-type': 'application/json' } })), window.__delay));
    };
  });
  const val = id => p.evaluate(i => FF.app.state.f[i].v + ' [' + FF.app.state.f[i].st + ']', id);
  const sleep = ms => p.waitForTimeout(ms);
  await p.click('#btnVoice'); await sleep(300);
  console.log('0 warm-up on switching Voice on:', await p.evaluate(() => window.__log.join(' | ')));

  console.log('1 clear answer, Claude agrees');
  await p.evaluate(() => { window.__say = () => [{ do: 'ask', field: 'consent' }, { do: 'fill', field: 'consent', value: 'Yes' }]; });
  const t0 = Date.now(); await p.evaluate(() => { window.__t = FF.app.voiceHear("Can you please consent to that please? Yes, I'm happy for you to record this conversation."); });
  await sleep(150); console.log('   150 ms after the words: consent =', await val('consent'), '(Claude not yet answered)');
  await sleep(3000); console.log('   after Claude agreed: consent =', await val('consent'));

  console.log('2 clear answer, Claude reads it differently (says No)');
  await p.evaluate(() => { window.__say = () => [{ do: 'fill', field: 'consent', value: 'No', correction: true }]; FF.app.state.f.consent = { v: '', st: 'empty' }; FF.app.redraw(); });
  await p.evaluate(() => { FF.app.voiceHear("Can you please consent to that please? Yes, I am happy for you to record this."); });
  await sleep(150); const early = await val('consent');
  await sleep(3000); console.log('   at once:', early, '| after Claude:', await val('consent'));

  console.log('3 two clear answers back to back (the first is still being checked)');
  await p.evaluate(() => { FF.app.state.f.fname = { v: '', st: 'empty' }; FF.app.state.f.sname = { v: '', st: 'empty' }; window.__say = line => /John/.test(line) ? [{ do: 'fill', field: 'fname', value: 'John' }, { do: 'fill', field: 'sname', value: 'Snow' }] : [{ do: 'fill', field: 'occ', value: 'Nurse' }]; FF.app.redraw(); });
  await p.evaluate(() => { FF.app.voiceHear("My first name is John and my surname is Snow"); });
  await sleep(100); console.log('   after "John Snow":', await val('fname'), await val('sname'));
  await p.evaluate(() => { FF.app.voice.target = 'occ'; FF.app.voice.answered = false; window.__t = FF.app.voiceHear("I am a nurse"); });
  await sleep(150); console.log('   after the second line, 250 ms in:', await val('occ'));
  await sleep(6500);

  console.log('4 a typed correction made meanwhile is not undone when Claude disagrees');
  await p.evaluate(() => { FF.app.state.f.consent = { v: '', st: 'empty' }; window.__say = () => [{ do: 'fill', field: 'consent', value: 'No' }]; });
  await p.evaluate(() => { FF.app.voiceHear("Can you please consent to that please? Yes, I am happy for you to record this."); });
  await sleep(200); await p.evaluate(() => { FF.store.setField(FF.app.state, 'consent', 'Yes, typed by hand', 'confirmed'); });
  await sleep(3200); console.log('   consent =', await val('consent'));

  console.log('5 a line the page is not sure of waits for Claude, and the quick lane is closed behind it');
  await p.evaluate(() => { FF.app.state.f.occ = { v: '', st: 'empty' }; FF.app.state.f.fname = { v: '', st: 'empty' }; window.__say = line => /nurse|work/.test(line) ? [{ do: 'fill', field: 'occ', value: 'Software developer' }] : [{ do: 'fill', field: 'fname', value: 'Mary' }]; });
  await p.evaluate(() => { FF.app.voiceHear("these days I earn my living working on software for a medical aid"); });
  await sleep(150); console.log('   at once: occ =', await val('occ'), '(waiting for Claude)');
  await p.evaluate(() => { FF.app.voiceHear("My first name is Mary"); });
  await sleep(150); console.log('   the line behind it: fname =', await val('fname'), '(waits its turn)');
  await sleep(6500); console.log('   after both answers: occ =', await val('occ'), '| fname =', await val('fname'));

  console.log('6 settings: the switch is there and Off waits for Claude');
  await p.click('#btnSettings'); console.log('   select present:', await p.evaluate(() => !!document.querySelector('#setQuick')), 'value', await p.evaluate(() => document.querySelector('#setQuick').value));
  await p.selectOption('#setQuick', '0'); await p.click('#setSave');
  await p.evaluate(() => { FF.app.state.f.consent = { v: '', st: 'empty' }; window.__say = () => [{ do: 'fill', field: 'consent', value: 'Yes' }]; FF.app.redraw(); FF.app.voiceHear("Can you please consent to that please? Yes, I am happy for you to record this."); });
  await sleep(150); console.log('   Off, 150 ms in: consent =', await val('consent'));
  await sleep(3000); console.log('   Off, after Claude: consent =', await val('consent'));
  console.log('7 requests sent:', await p.evaluate(() => window.__log.join('\n     ')));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
