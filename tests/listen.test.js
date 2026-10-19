const test = require('node:test');
const assert = require('node:assert');
const L = require('../app/js/listen.js');

const RATE = L.RATE;
/* seconds of sound: silence is low noise, speech is a tone with a little wobble */
const noise = s => Float32Array.from({ length: Math.round(s * RATE) }, (_, i) => 0.002 * Math.sin(i * 0.37) + 0.001 * Math.sin(i * 1.1));
const speech = s => Float32Array.from({ length: Math.round(s * RATE) }, (_, i) => 0.2 * Math.sin(i * 0.21) * (0.7 + 0.3 * Math.sin(i * 0.0013)));
const feed = (seg, parts) => { const out = []; parts.forEach(p => { for (let i = 0; i < p.length; i += 1600) out.push(...seg.push(p.subarray(i, Math.min(p.length, i + 1600)))); }); return out; };
const secs = u => u.length / RATE;

test('the segmenter cuts speech out of the room noise and keeps a little of the pause', () => {
  const seg = L.segmenter();
  const out = feed(seg, [noise(1), speech(1.5), noise(1.2), noise(0.5)]);
  assert.strictEqual(out.length, 1);
  assert.ok(secs(out[0]) > 1.5 && secs(out[0]) < 2.4, 'length ' + secs(out[0]));
});
test('a blip shorter than a word is not a line, and two sentences with a pause are two lines', () => {
  const seg = L.segmenter();
  assert.strictEqual(feed(seg, [noise(1), speech(0.15), noise(1.5)]).length, 0);
  const two = feed(L.segmenter(), [noise(0.5), speech(1), noise(1), speech(1.2), noise(1)]);
  assert.strictEqual(two.length, 2);
});
test('a short pause inside a sentence does not split it, and a very long speech is cut at 14 seconds', () => {
  assert.strictEqual(feed(L.segmenter(), [noise(0.5), speech(1), noise(0.4), speech(1), noise(1.2)]).length, 1);
  const long = feed(L.segmenter(), [noise(0.5), speech(20), noise(1.5)]);
  assert.ok(long.length >= 2 && secs(long[0]) <= 14.1, long.map(secs).join(','));
});
test('flush hands back a line that is still being said', () => {
  const seg = L.segmenter();
  feed(seg, [noise(0.5), speech(2)]);
  const d = seg.flush();
  assert.ok(d && secs(d) > 1.5);
  assert.strictEqual(seg.flush(), null);
});
test('resampling changes the length and keeps the shape', () => {
  const x = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i * 0.05));
  const y = L.resample(x, 48000, 16000);
  assert.strictEqual(y.length, 1600);
  assert.ok(Math.abs(y[100] - Math.sin(300 * 0.05)) < 0.02);
  assert.strictEqual(L.resample(x, 16000, 16000), x);
});
test('what Whisper writes for noise is dropped, and real words are kept', () => {
  ['[BLANK_AUDIO]', '(music)', ' Thank you. ', 'you', 'Thanks for watching!', '...', '', null, '*sigh*'].forEach(t => assert.strictEqual(L.cleanTranscript(t), '', String(t)));
  assert.strictEqual(L.cleanTranscript(' I work for Discovery. '), 'I work for Discovery.');
  assert.strictEqual(L.cleanTranscript('Yes [BLANK_AUDIO]'), 'Yes');
  assert.strictEqual(L.cleanTranscript('Thank you for the cover'), 'Thank you for the cover');
});
test('the listener runs the speech model on each line and passes the words on (stand-in model)', async () => {
  const said = [], states = [];
  const L2 = L.create({
    engine: 'whisper', model: 'tiny.en',
    loader: () => Promise.resolve({ where: 'test', pipe: async u => ({ text: u.length > 3 * RATE ? ' My first name is John Snow. ' : ' [BLANK_AUDIO] ' }) }),
    text: (t, m) => said.push([t, m.where]), state: (s, d) => states.push(s)
  });
  // no microphone in Node: the listener cannot start, and says so
  await L2.start();
  assert.strictEqual(states[states.length - 1], 'error');
});
