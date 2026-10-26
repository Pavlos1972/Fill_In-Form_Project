/* The meeting timer in the top bar: how long the meeting has run, from the first "Start" (or the first Listen) to the last "Pause".
   It counts from the clock, not from ticks, so a busy or sleeping page loses nothing, and it is kept in the browser so a reload, a crash or a closed tab does not lose it.
   A timer left running while the page was closed for more than half an hour is treated as stopped when the page was last seen (nobody meets for the night). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.timer = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var STALE = 30 * 60 * 1000;                                              // a running timer not seen for this long is taken as stopped at the last time it was seen
  var BEAT = 5000;                                                         // how often the running timer is written down

  /* 3725000 ms -> "1:02:05" */
  function format(ms) {
    var s = Math.max(0, Math.floor((+ms || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }

  /* o.now: the clock (ms); o.load(): the saved {acc, since, beat} or null; o.save(obj): write it down. Both are optional. */
  function create(o) {
    o = o || {};
    var now = o.now || Date.now, save = o.save || function () {}, st, lastBeat = 0;
    function num(v) { return isFinite(+v) && +v > 0 ? +v : 0; }
    function read() {
      var r = null; try { r = o.load ? o.load() : null; } catch (e) { r = null; }
      r = r && typeof r === 'object' ? { acc: num(r.acc), since: num(r.since), beat: num(r.beat) } : { acc: 0, since: 0, beat: 0 };
      if (r.since) { var seen = Math.max(r.beat, r.since); if (now() - seen > STALE) { r.acc += seen - r.since; r.since = 0; } }
      return r;
    }
    function write() { lastBeat = now(); st.beat = lastBeat; try { save({ acc: st.acc, since: st.since, beat: st.beat }); } catch (e) { /* storage unavailable: the timer still runs on this page */ } }
    st = read();
    var t = {
      ms: function () { return st.acc + (st.since ? Math.max(0, now() - st.since) : 0); },
      running: function () { return !!st.since; },
      fresh: function () { return !st.since && st.acc === 0; },            // never started (or reset)
      start: function () { if (!st.since) { st.since = now(); write(); } return t; },
      pause: function () { if (st.since) { st.acc += Math.max(0, now() - st.since); st.since = 0; write(); } return t; },
      toggle: function () { return t.running() ? t.pause() : t.start(); },
      reset: function () { st.acc = 0; st.since = 0; write(); return t; },
      text: function () { return format(t.ms()); },
      /* called about once a second: while running, writes the time down now and then so a crash loses little */
      tick: function () { if (st.since && now() - lastBeat >= BEAT) write(); return t; },
      snapshot: function () { return { seconds: Math.round(t.ms() / 1000), running: t.running(), text: t.text() }; }
    };
    return t;
  }

  return { create: create, format: format, STALE: STALE };
});
