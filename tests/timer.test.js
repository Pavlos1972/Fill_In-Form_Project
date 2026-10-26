const test = require('node:test');
const assert = require('node:assert');
const T = require('../app/js/timer.js');

const clock = (t0) => { let t = t0 || 1e12; const c = () => t; c.add = ms => { t += ms; }; return c; };
const disk = () => { let v = null; return { load: () => v, save: o => { v = JSON.parse(JSON.stringify(o)); }, get: () => v, set: x => { v = x; } }; };

test('time is shown as hours:minutes:seconds', () => {
  assert.strictEqual(T.format(0), '0:00:00');
  assert.strictEqual(T.format(59999), '0:00:59');
  assert.strictEqual(T.format(61000), '0:01:01');
  assert.strictEqual(T.format(3725000), '1:02:05');
  assert.strictEqual(T.format(36000000), '10:00:00');
  assert.strictEqual(T.format(-5), '0:00:00');
  assert.strictEqual(T.format(NaN), '0:00:00');
});

test('start, pause and start again add up; pausing is not counted', () => {
  const now = clock(), t = T.create({ now });
  assert.ok(t.fresh());
  t.start(); now.add(90000);
  assert.strictEqual(t.text(), '0:01:30');
  assert.ok(t.running() && !t.fresh());
  t.pause(); now.add(600000);
  assert.strictEqual(t.text(), '0:01:30', 'a pause was counted');
  t.toggle(); now.add(30000);
  assert.strictEqual(t.text(), '0:02:00');
  t.start(); now.add(1000);                                              // starting a running timer changes nothing
  assert.strictEqual(t.text(), '0:02:01');
});

test('reset goes back to zero and a never-started timer is fresh', () => {
  const now = clock(), t = T.create({ now });
  t.start(); now.add(5000); t.reset();
  assert.strictEqual(t.text(), '0:00:00');
  assert.ok(!t.running() && t.fresh());
});

test('the time survives a reload: a running timer keeps counting, a paused one stays put', () => {
  const now = clock(), d = disk();
  const a = T.create({ now, load: d.load, save: d.save });
  a.start(); now.add(120000); a.tick();                                   // two minutes in, then the page is closed for one minute
  now.add(60000);
  const b = T.create({ now, load: d.load, save: d.save });
  assert.ok(b.running());
  assert.strictEqual(b.text(), '0:03:00');
  b.pause(); now.add(500000);
  const c = T.create({ now, load: d.load, save: d.save });
  assert.ok(!c.running());
  assert.strictEqual(c.text(), '0:03:00');
});

test('a timer left running while the page was closed for hours stops at the last time it was seen', () => {
  const now = clock(), d = disk();
  const a = T.create({ now, load: d.load, save: d.save });
  a.start(); now.add(600000); a.tick();                                   // ten minutes, last written now
  now.add(5 * 3600000);                                                   // the laptop is shut until the afternoon
  const b = T.create({ now, load: d.load, save: d.save });
  assert.ok(!b.running(), 'still running after the night');
  assert.strictEqual(b.text(), '0:10:00');
});

test('the running time is written down about every five seconds, not on every tick', () => {
  const now = clock(); let writes = 0;
  const t = T.create({ now, save: () => { writes++; } });
  t.start();                                                             // 1 write
  for (let i = 0; i < 12; i++) { now.add(1000); t.tick(); }               // 12 seconds
  assert.ok(writes >= 2 && writes <= 4, 'writes: ' + writes);
});

test('bad or missing saved data and a storage that fails do not stop the timer', () => {
  const now = clock();
  assert.strictEqual(T.create({ now, load: () => 'rubbish' }).text(), '0:00:00');
  assert.strictEqual(T.create({ now, load: () => { throw new Error('no storage'); } }).text(), '0:00:00');
  assert.strictEqual(T.create({ now, load: () => ({ acc: -4, since: 'x' }) }).text(), '0:00:00');
  const t = T.create({ now, save: () => { throw new Error('full'); } });
  t.start(); now.add(2000);
  assert.strictEqual(t.text(), '0:00:02');
  assert.deepStrictEqual(t.snapshot(), { seconds: 2, running: true, text: '0:00:02' });
});
