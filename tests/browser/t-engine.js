const { chromium } = require(process.argv[2] + '/playwright');
const dir = process.argv[3];
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });

srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'] });
  await c.addInitScript(() => {
    window.__recs = [];
    const realGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async (c) => { console.log('gum called', JSON.stringify(c)); const ctx = new AudioContext(), o = ctx.createOscillator(), d = ctx.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { const r = this; window.__recs.push(r); r.start = () => setTimeout(() => r.onstart && r.onstart(), 5); r.abort = () => {}; };
  });
  const p = await c.newPage(); p.on('console', m => console.log('console:', m.text().slice(0, 200))); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  await p.evaluate(() => { localStorage.setItem('wr-fact-find-speech-2', JSON.stringify({ engine: 'chrome', model: 'moonshine-tiny' })); });
  await p.reload();
  console.log('gum:', await p.evaluate(async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); return 'ok ' + s.getAudioTracks().length; } catch (e) { return e.name + ' ' + e.message; } }), 'SR:', await p.evaluate(() => typeof window.webkitSpeechRecognition)); console.log('direct:', await p.evaluate(async () => { const out = []; const l = FF.listen.create({ engine: 'chrome', text: () => {}, note: m => out.push('note ' + m), event: (n, d) => out.push('ev ' + n + ' ' + d), state: (s, d) => out.push('state ' + s + ' ' + JSON.stringify(d)) }); await l.start(); await new Promise(r => setTimeout(r, 300)); l.stop(); return out.join(' | '); })); await p.click('#btnListen'); await p.waitForTimeout(1500); console.log('label:', await p.evaluate(() => document.getElementById('lnLabel').textContent + ' / heard: ' + document.getElementById('heardStatus').textContent), 'recs', await p.evaluate(() => window.__recs.length));
  await p.evaluate(() => { const r = window.__recs[window.__recs.length - 1]; r.onspeechstart && r.onspeechstart(); r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello there' }], { isFinal: true })] }); r.onspeechend && r.onspeechend(); r.onerror && r.onerror({ error: 'network' }); r.onend && r.onend(); });
  await p.waitForTimeout(1900);
  const log = await p.evaluate(() => FF.app.voiceLog().lines.map(l => l.who + ': ' + l.heard));
  const box = await p.evaluate(() => document.getElementById('cvBox').innerText);
  console.log(JSON.stringify(log, null, 1)); console.log('--- box ---\n' + box); console.log('recognisers started:', await p.evaluate(() => window.__recs.length), 'errors', errs);
  await b.close(); srv.close();
});
