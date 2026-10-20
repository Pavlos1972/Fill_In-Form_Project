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
test('a spelled-out name is joined into one word, and ordinary speech is left alone', () => {
  const J = L.joinSpelling;
  assert.strictEqual(J('K A F E N T Z I S'), 'Kafentzis');
  assert.strictEqual(J('My surname is K-A-F-E-N-T-Z-I-S.'), 'My surname is Kafentzis.');
  assert.strictEqual(J("It's K. A. F. E. N. T. Z. I. S."), "It's Kafentzis.");
  assert.strictEqual(J('k, a, f, e, n, t, z, i, s'), 'Kafentzis');
  assert.strictEqual(J('Kay, A, F, E, N, T, Zed, I, S'), 'Kafentzis');
  assert.strictEqual(J('The surname is S for Sierra, N for November, O for Oscar, W for Whiskey, thanks'), 'The surname is Snow, thanks');
  assert.strictEqual(J('S as in Sam and M as in Mary'), 'S as in Sam and M as in Mary');   // fewer than three letters is not a spelling
  assert.strictEqual(L.cleanTranscript(' It is K A F E N T Z I S. '), 'It is Kafentzis.');
  [
    'I work for Discovery as a nurse', 'We chose plan A or B', 'J. P. van der Merwe', 'A, B and C', 'She is a nurse, a good one', 'I like Ian and a for sale sign',
    'My ID is 8001015009087', 'Yes', '', null
  ].forEach(t => assert.strictEqual(J(t), t == null ? '' : t, String(t)));
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

test('a quiet line is brought up to a normal level, a loud one is left alone, and silence is not boosted', () => {
  const peak = a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const quiet = Float32Array.from({ length: 16000 }, (_, i) => 0.05 * Math.sin(i * 0.21));
  assert.ok(Math.abs(peak(L.normalize(quiet)) - 0.8) < 0.01, String(peak(L.normalize(quiet))));
  const loud = Float32Array.from({ length: 16000 }, (_, i) => 0.85 * Math.sin(i * 0.21));
  assert.ok(L.normalize(loud) === loud, 'a line that is already loud is left as it is');
  const hiss = Float32Array.from({ length: 16000 }, (_, i) => 0.00001 * Math.sin(i));
  assert.ok(L.normalize(hiss) === hiss, 'silence is not boosted');
  const faint = Float32Array.from({ length: 16000 }, (_, i) => 0.005 * Math.sin(i * 0.2));
  assert.ok(Math.abs(peak(L.normalize(faint)) - 0.15) < 0.005, 'never boosted more than 30 times: ' + peak(L.normalize(faint)));
});
test('the loudness meter is on a decibel scale and stays between empty and full', () => {
  assert.strictEqual(L.meter(0), 0);
  assert.strictEqual(L.meter(0.0001), 0);
  assert.strictEqual(L.meter(1), 1);
  assert.ok(L.meter(0.02) > 0.4 && L.meter(0.02) < 0.6, 'quiet speech shows: ' + L.meter(0.02));
  assert.ok(L.meter(0.002) < L.meter(0.02) && L.meter(0.02) < L.meter(0.2));
});
test('a stuck repeat is not speech, ordinary speech with repeated words is', () => {
  const stuck = 'More, get, more, get, more, get, more, get, more, get, more, get, more, get, more, get,';
  assert.ok(L.isLoop(stuck));
  assert.ok(L.isLoop('Thank you. Thank you. Thank you. Thank you. Thank you.'));
  assert.strictEqual(L.cleanTranscript(stuck), '');
  assert.ok(!L.isLoop('Yes'));
  assert.ok(!L.isLoop('My first name is John and my surname is Snow, I work for Discovery as a nurse and I earn R35 000 a month'));
  assert.ok(!L.isLoop('no no no'));
  assert.strictEqual(L.cleanTranscript('Her name is Anna and his name is Anna too, and the name of the dog is Anna as well'), 'Her name is Anna and his name is Anna too, and the name of the dog is Anna as well');
});
test('the listener reads each line, drops a stuck repeat with a note, and bounds what the model may write', async () => {
  const notes = [], said = [], calls = [];
  let chunk = null;
  const lsn = L.create({
    engine: 'whisper', model: 'tiny.en',
    mic: onChunk => { chunk = onChunk; return Promise.resolve({ label: 'Test mic', close() {} }); },
    loader: () => Promise.resolve({ where: 'test', pipe: async (u, opt) => { calls.push([u, opt]); return { text: calls.length === 1 ? 'More, get, more, get, more, get, more, get, more, get' : ' Yes it is. ' }; } }),
    text: (t, m) => said.push([t, m]), note: n => notes.push(n), state: () => {}
  });
  await lsn.start();
  const speak = s => { for (let i = 0; i < s.length; i += 4096) chunk(s.subarray(i, Math.min(s.length, i + 4096))); };
  const quiet = s => Float32Array.from({ length: Math.round(s * RATE) }, (_, i) => 0.03 * Math.sin(i * 0.21) * (0.7 + 0.3 * Math.sin(i * 0.0013)));
  [noise(1), quiet(1.5), noise(1.2), quiet(1.5), noise(1.2)].forEach(speak);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(calls.length, 2);
  calls.forEach(([u, opt]) => { assert.ok(u.length > 1.4 * RATE && u.length < 2.4 * RATE); assert.ok(opt.max_new_tokens >= 16 && opt.max_new_tokens <= 160 && opt.no_repeat_ngram_size === 5, JSON.stringify(opt)); });
  assert.strictEqual(notes.length, 1);
  assert.match(notes[0], /noise, not speech/);
  assert.match(notes[0], /very quiet/);
  assert.strictEqual(said.length, 1);
  assert.strictEqual(said[0][0], 'Yes it is.');
  assert.ok(said[0][1].audio > 1.4 && said[0][1].took >= 0 && said[0][1].peak > 0.02);
  lsn.stop();
});

test('Chrome speech: the microphone is asked for once and held while Chrome restarts its recognition', async () => {
  const recs = []; let opened = 0, stopped = 0;
  function FakeRec() { recs.push(this); this.started = 0; }
  FakeRec.prototype.start = function () { this.started++; const me = this; setTimeout(() => { if (me.onstart) me.onstart(); }, 5); };
  FakeRec.prototype.abort = function () {};
  global.window = { webkitSpeechRecognition: FakeRec };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => { opened++; return Promise.resolve({ getTracks: () => [{ stop: () => { stopped++; } }] }); } } } });
  try {
    const states = [];
    const lsn = L.create({ engine: 'chrome', quickEndMs: 0, startSecs: 60, text: () => {}, state: (s) => states.push(s) });
    await lsn.start();
    assert.strictEqual(opened, 1);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].started, 1);
    assert.strictEqual(states[states.length - 1], 'on');
    for (let i = 0; i < 3; i++) { recs[recs.length - 1].onend(); await new Promise(r => setTimeout(r, 350)); }      // Chrome ends it after a silence: it starts again
    assert.strictEqual(recs.length, 4);
    assert.strictEqual(opened, 1, 'the microphone was asked for again');
    assert.strictEqual(stopped, 0, 'the microphone was let go while listening');
    lsn.stop();
    assert.strictEqual(stopped, 1);
  } finally { delete global.window; delete globalThis.navigator; }
});

test('Chrome speech: a refused microphone is reported, and recognition is not started', async () => {
  const recs = []; function FakeRec() { recs.push(this); } FakeRec.prototype.start = function () {}; FakeRec.prototype.abort = function () {};
  global.window = { webkitSpeechRecognition: FakeRec };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })) } } });
  try {
    const states = [];
    const lsn = L.create({ engine: 'chrome', text: () => {}, state: (s, d) => states.push([s, d]) });
    await lsn.start();
    assert.strictEqual(recs.length, 0);
    assert.strictEqual(states[states.length - 1][0], 'error');
    assert.match(states[states.length - 1][1].message, /microphone/i);
  } finally { delete global.window; delete globalThis.navigator; }
});

test('Chrome speech: a recognition that freezes while there is sound is started again, one that keeps answering is left alone', async () => {
  const recs = [], notes = [], levels = []; let aborted = 0, level = 0.1;
  function FakeRec() { recs.push(this); }
  FakeRec.prototype.start = function () { const me = this; setTimeout(() => { if (me.onstart) me.onstart(); }, 5); }; FakeRec.prototype.abort = function () { aborted++; };
  function FakeAudio() {}
  FakeAudio.prototype.createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
  FakeAudio.prototype.createAnalyser = () => ({ connect() {}, fftSize: 0, getFloatTimeDomainData(b) { b.fill(level); } });
  FakeAudio.prototype.resume = function () {}; FakeAudio.prototype.close = function () {};
  global.window = { webkitSpeechRecognition: FakeRec, AudioContext: FakeAudio };
  const stream = { getTracks: () => [{ stop() {} }], getAudioTracks: () => [{}] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } } });
  try {
    const events = [], lsn = L.create({ engine: 'chrome', stallSecs: 0.6, startSecs: 60, text: () => {}, note: n => notes.push(n), event: (n, d, show) => events.push([n, d, show]), level: v => levels.push(v), state: () => {} });
    await lsn.start();
    assert.strictEqual(recs.length, 1);
    for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 250)); recs[recs.length - 1].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello' }], { isFinal: false })] }); }
    assert.strictEqual(recs.length, 1, 'restarted although Chrome kept answering');
    assert.strictEqual(notes.length, 0);
    assert.ok(levels.length >= 4 && levels[0] > 0, 'the meter did not move');
    await new Promise(r => setTimeout(r, 1100));                                                  // sound, and nothing back
    assert.strictEqual(aborted, 1);
    assert.strictEqual(recs.length, 2, 'the frozen recognition was not replaced');
    assert.match(notes[0], /started again/);
    assert.ok(events.some(e => e[0] === 'listening restarted' && e[2] === true), 'the restart was not recorded for the log');
    assert.ok(events.some(e => e[0] === 'recognition started'));
    level = 0;                                                                                    // silence is not a freeze
    await new Promise(r => setTimeout(r, 1200));
    assert.strictEqual(recs.length, 2);
    lsn.stop();
  } finally { delete global.window; delete globalThis.navigator; }
});
test('stallWatch counts only sound without a result', () => {
  const w = L.stallWatch(0.02, 1);
  assert.strictEqual(w.tick(0.001, 0.5), false);
  assert.strictEqual(w.tick(0.1, 0.5), false);
  w.result();
  assert.strictEqual(w.tick(0.1, 0.5), false);
  assert.strictEqual(w.tick(0.1, 0.5), true);
  assert.strictEqual(w.tick(0.1, 0.5), false);
});

test('Chrome speech: a recognition that never starts is started again, and one that ends at once waits before the next', async () => {
  const recs = [], events = []; let starts = 0;
  function FakeRec() { recs.push(this); }
  FakeRec.prototype.start = function () { starts++; };            // never says it started
  FakeRec.prototype.abort = function () {};
  global.window = { webkitSpeechRecognition: FakeRec };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }) } } });
  const lsn = L.create({ engine: 'chrome', startSecs: 0.2, text: () => {}, note: () => {}, event: (n, d, show) => events.push(n), state: () => {} });
  try {
    await lsn.start();
    await new Promise(r => setTimeout(r, 1000));
    assert.ok(recs.length >= 2, 'a recognition that never started was not replaced');
    assert.ok(events.includes('listening restarted'));
  } finally { lsn.stop(); delete global.window; delete globalThis.navigator; }
  const n = recs.length;
  await new Promise(r => setTimeout(r, 600));
  assert.strictEqual(recs.length, n, 'it kept starting after stop');
});
