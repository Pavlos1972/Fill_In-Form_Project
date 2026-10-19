/* Speech source for voice mode: the microphone becomes lines of text, and each line goes to FF.app.voiceHear.
   Two sources. Whisper runs on this computer: the audio never leaves it, and the speech model is downloaded once and kept in the browser.
   Chrome's own speech recognition is instant but sends the audio to Google, so it is for practice talk only, never for a client. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.listen = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var RATE = 16000;                                                       // samples a second, the rate Whisper wants
  var LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
  var MODELS = { 'tiny.en': 'onnx-community/whisper-tiny.en', 'base.en': 'onnx-community/whisper-base.en', 'small.en': 'onnx-community/whisper-small.en' };

  /* ---------- sound helpers (they need no browser, so they are tested) ---------- */
  function resample(x, from, to) {                                        // straight-line resampling
    if (from === to) return x;
    var n = Math.floor(x.length * to / from), y = new Float32Array(n), k = from / to, i, p, j, f;
    for (i = 0; i < n; i++) { p = i * k; j = Math.floor(p); f = p - j; y[i] = x[j] * (1 - f) + (j + 1 < x.length ? x[j + 1] : x[j]) * f; }
    return y;
  }
  function rms(x) { var s = 0, i; for (i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / (x.length || 1)); }
  function join(parts) {
    var n = 0, i, o, p = 0;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    o = new Float32Array(n);
    for (i = 0; i < parts.length; i++) { o.set(parts[i], p); p += parts[i].length; }
    return o;
  }
  /* Cuts a stream of sound into spoken lines: a line starts when the sound rises clearly above the room's noise and ends after a pause (0.8 s),
     or after 14 s so a long speech is still handled. push() takes sound and returns the finished lines; flush() returns what is being said now. */
  function segmenter(o) {
    o = o || {};
    var FR = Math.round(RATE * 0.03), END = Math.round((o.endMs || 800) / 30), MIN = Math.round((o.minMs || 240) / 30), MAX = Math.round((o.maxMs || 14000) / 30), PRE = Math.round((o.preMs || 300) / 30);
    var rest = new Float32Array(0), pre = [], cur = null, quiet = 0, run = 0, spoken = 0, floor = 0.003, last = 0;
    function line() { return cur && spoken >= MIN ? join(cur.slice(0, Math.min(cur.length, cur.length - quiet + 7))) : null; }   // the speech, with 0.2 s of the pause; a blip shorter than a short word is not a line
    function frame(fr) {
      var r = rms(fr), speech = r > Math.max(0.012, floor * 3.5), done = null;
      last = r;
      if (!cur) {
        if (speech) run++; else { run = 0; floor = Math.max(0.002, floor * 0.95 + r * 0.05); }
        pre.push(fr); if (pre.length > PRE + 2) pre.shift();
        if (run >= 2) { cur = pre.slice(); pre = []; quiet = 0; spoken = run; run = 0; }
      } else {
        cur.push(fr);
        if (speech) spoken++;
        quiet = speech ? 0 : quiet + 1;
        if (quiet >= END || cur.length >= MAX) { done = line(); cur = null; quiet = 0; pre = []; }
      }
      return done;
    }
    return {
      push: function (x) {
        var all = join([rest, x]), out = [], p = 0, d;
        while (p + FR <= all.length) { d = frame(all.subarray(p, p + FR)); if (d) out.push(d); p += FR; }
        rest = all.slice(p);
        return out;
      },
      flush: function () { var d = line(); cur = null; quiet = 0; pre = []; return d; },
      level: function () { return last; }
    };
  }
  /* Whisper writes things like "[BLANK_AUDIO]", "(music)" or "Thank you." when it hears only noise: those are dropped. */
  function cleanTranscript(t) {
    var s = String(t == null ? '' : t).replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || !/[a-z0-9]/i.test(s) || /^(?:you|thank you|thanks|thanks for watching|bye|bye bye)\W*$/i.test(s)) return '';
    return s;
  }

  /* ---------- the browser parts ---------- */
  /* The speech model is kept in IndexedDB, which works for a page opened from a file (the Cache API may not). */
  function modelStore() {
    var dbp = null;
    function db() {
      return dbp || (dbp = new Promise(function (ok, no) {
        var r = indexedDB.open('wr-fact-find-speech', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('f'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { no(r.error); };
      }));
    }
    return {
      match: function (key) {
        return db().then(function (d) {
          return new Promise(function (ok) {
            var q = d.transaction('f').objectStore('f').get(String(key));
            q.onsuccess = function () { ok(q.result ? new Response(q.result.buf, { headers: { 'content-type': q.result.type } }) : undefined); };
            q.onerror = function () { ok(undefined); };
          });
        }, function () { return undefined; });
      },
      put: function (key, response) {
        return response.arrayBuffer().then(function (buf) {
          return db().then(function (d) {
            return new Promise(function (ok, no) {
              var tx = d.transaction('f', 'readwrite');
              tx.objectStore('f').put({ buf: buf, type: response.headers.get('content-type') || 'application/octet-stream' }, String(key));
              tx.oncomplete = function () { ok(); };
              tx.onerror = function () { no(tx.error); };
            });
          });
        });
      }
    };
  }
  var loaded = {};                                                         // model + device -> the loading speech model, so it is loaded once
  var GPU_FLAG = 'wr-fact-find-speech-nogpu';                              // set once the graphics chip has failed on this computer: the processor is used from then on
  function gpuBlocked() { try { return localStorage.getItem(GPU_FLAG) === '1'; } catch (e) { return false; } }
  function blockGpu() { try { localStorage.setItem(GPU_FLAG, '1'); } catch (e) { /* storage unavailable */ } }
  /* Chrome may offer WebGPU and still have no graphics adapter to run it on (this laptop's): ask for the adapter before choosing. */
  function gpuUsable() {
    if (typeof navigator === 'undefined' || !navigator.gpu || !navigator.gpu.requestAdapter) return Promise.resolve(false);
    return navigator.gpu.requestAdapter().then(function (a) { return !!a; }, function () { return false; });
  }
  /* A model that fails to start is not tried again in the same page by the library (the first failure is remembered), so the graphics chip must not be tried unless it is sure to work. */
  function modelError(err) {
    var m = String(err && err.message || err);
    if (/graphics chip/.test(m)) return m;
    if (/fetch|network|offline|404|403|failed to load/i.test(m)) return 'Could not download the speech model (' + m + '). It needs the internet the first time.';
    return 'Could not start the speech model (' + m + ').';
  }
  /* -> Promise of { pipe, where }. The graphics chip is used when there is one, otherwise the processor. report(percent) says how far the one-time download is. */
  function loadWhisper(model, report, noGpu) {
    var key = model + (noGpu ? ':cpu' : '');
    if (loaded[key]) return loaded[key];
    var seen = {};
    function progress(e) {
      if (e.status !== 'progress' || !e.total) return;
      seen[e.file] = [e.loaded, e.total];
      var l = 0, t = 0; Object.keys(seen).forEach(function (k) { l += seen[k][0]; t += seen[k][1]; });
      report(Math.round(100 * l / t));
    }
    loaded[key] = Promise.all([import(LIB), noGpu || gpuBlocked() ? false : gpuUsable()]).then(function (r) {
      var m = r[0], id = MODELS[model], tries = [];
      m.env.allowLocalModels = false; m.env.useBrowserCache = false; m.env.useCustomCache = true; m.env.customCache = modelStore();
      if (r[1]) tries.push({ where: 'graphics chip', opts: { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } } });
      tries.push({ where: 'processor', opts: { device: 'wasm', dtype: 'q8' } });
      function attempt(i) {
        var opts = { progress_callback: progress }, k;
        for (k in tries[i].opts) opts[k] = tries[i].opts[k];
        return m.pipeline('automatic-speech-recognition', id, opts).then(function (pipe) { return { pipe: pipe, where: tries[i].where }; }, function (err) {
          if (tries[i].where === 'graphics chip') {                       // the library cannot start another model in this page after this failure
            blockGpu();
            throw new Error('The graphics chip could not run the speech model, so the processor will be used from now on. Press F5 to reload this page, then press Listen again. (' + String(err && err.message || err).slice(0, 160) + ')');
          }
          throw err;
        });
      }
      return attempt(0);
    });
    loaded[key].catch(function () { delete loaded[key]; });
    return loaded[key];
  }
  function micError(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Chrome did not allow the microphone. Click the camera icon at the right of the address bar, choose Allow, then press Listen again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found. Plug in the headset and press Listen again.';
    return 'Could not start listening: ' + (e && e.message || e);
  }
  /* Opens the microphone and calls onChunk(Float32Array at 16 000 a second) as sound arrives. */
  function openMic(onChunk) {
    var md = typeof navigator !== 'undefined' && navigator.mediaDevices, AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!md || !md.getUserMedia || !AC) return Promise.reject(new Error('This browser cannot use the microphone.'));
    return md.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      var ctx;
      try { ctx = new AC({ sampleRate: RATE }); } catch (e) { ctx = new AC(); }
      var src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(), track = stream.getAudioTracks()[0];
      mute.gain.value = 0;
      node.onaudioprocess = function (e) { onChunk(resample(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate, RATE)); };
      src.connect(node); node.connect(mute); mute.connect(ctx.destination);
      if (ctx.resume) ctx.resume();
      return { label: track && track.label || '', close: function () { try { node.disconnect(); src.disconnect(); } catch (e) { /* already closed */ } stream.getTracks().forEach(function (t) { t.stop(); }); if (ctx.close) ctx.close(); } };
    });
  }

  /* Whisper on this computer. h: { text(line, meta), level(0..1), note(message), error(message), progress(percent), on(info) } */
  function whisperEngine(o, h) {
    var mic = null, seg = segmenter(), queue = [], busy = false, alive = false, tr = null, noGpu = false, load = o.loader || loadWhisper, peak = 0, watch = null;
    function pump() {
      if (busy || !queue.length || !tr) return;
      busy = true;
      var u = queue.shift(), t0 = Date.now(), cur = tr;
      Promise.resolve(cur.pipe(u, { max_new_tokens: 160 })).then(function (out) {
        if (alive) h.text(cleanTranscript(out && out.text), { audio: u.length / RATE, took: (Date.now() - t0) / 1000, waiting: queue.length, where: cur.where });
      }, function (err) {
        if (cur.where === 'graphics chip' && !noGpu && alive) {                                  // the graphics chip did not cope: carry on with the processor
          noGpu = true; blockGpu(); queue.unshift(u); h.progress(null);
          return load(o.model, h.progress, true).then(function (t) { tr = t; h.on({ mic: mic && mic.label, where: t.where, model: o.model }); });
        }
        throw err;
      }).then(function () { busy = false; pump(); }, function (err) { busy = false; h.error('The speech model stopped: ' + (err && err.message || err)); });
    }
    return {
      start: function () {
        alive = true;
        return openMic(function (x) {
          var lv = rms(x); if (lv > peak) peak = lv;
          h.level(lv);                                                                           // the meter moves from the first second, even while the model is loading
          if (!tr || !alive) return;                                                             // nothing is kept while the model is still loading
          seg.push(x).forEach(function (u) { queue.push(u); });
          pump();
        }).then(function (m) {
          mic = m;
          watch = setTimeout(function () { if (alive && mic && peak < 0.0008 && h.note) h.note('No sound is reaching Chrome from "' + (m.label || 'the microphone') + '". Check that it is not muted and that it is the microphone you are using (Windows: Settings, System, Sound, Input).'); }, 7000);
          return load(o.model, h.progress, false).then(function (t) { if (!alive) return; tr = t; h.on({ mic: m.label, where: t.where, model: o.model }); }, function (err) {
            m.close(); mic = null; throw new Error(modelError(err));
          });
        });
      },
      stop: function () { alive = false; clearTimeout(watch); queue = []; seg = segmenter(); peak = 0; if (mic) mic.close(); mic = null; },
      feed: function (x) { if (tr && alive) { seg.push(x).forEach(function (u) { queue.push(u); }); h.level(seg.level()); pump(); } }       // used by the tests
    };
  }

  /* Chrome's own speech recognition: instant, but Google hears the audio. */
  function chromeEngine(o, h) {
    var SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), rec = null, wanted = false, fails = 0;
    function begin() {
      rec = new SR(); rec.lang = 'en-ZA'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = function (e) {
        var interim = '', i, r;
        for (i = e.resultIndex; i < e.results.length; i++) { r = e.results[i]; if (r.isFinal) { fails = 0; h.text(String(r[0].transcript).trim(), {}); } else interim += r[0].transcript; }
        h.interim(interim);
      };
      rec.onerror = function (e) {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wanted = false; h.error(micError({ name: 'NotAllowedError' })); }
        else if (e.error === 'audio-capture') { wanted = false; h.error(micError({ name: 'NotFoundError' })); }
        else if (e.error === 'network' && ++fails >= 3) { wanted = false; h.error("Chrome's speech service could not be reached. Check the internet connection."); }
      };
      rec.onend = function () { if (wanted) setTimeout(function () { if (wanted) { try { begin(); } catch (e) { /* already running */ } } }, 300); };   // Chrome ends it after a long silence: start again
      rec.start();
    }
    return {
      start: function () {
        if (!SR) return Promise.reject(new Error("This browser has no speech recognition. Use Chrome, or choose Whisper in Settings."));
        wanted = true; fails = 0; begin(); h.on({ mic: '', where: 'Chrome', model: '' });
        return Promise.resolve();
      },
      stop: function () { wanted = false; try { if (rec) rec.abort(); } catch (e) { /* not running */ } rec = null; }
    };
  }

  /* o: { engine: 'whisper' | 'chrome', model, text(line, meta), interim(text), level(0..1), note(message), state(name, detail) } with name off | loading | on | error. */
  function create(o) {
    var eng = null, st = 'off';
    function set(s, d) { st = s; if (o.state) o.state(s, d || {}); }
    function fail(msg) { if (eng) eng.stop(); eng = null; set('error', { message: msg }); }
    var h = {
      text: function (t, meta) { if (t && st === 'on') o.text(t, meta || {}); },
      interim: function (t) { if (o.interim && st === 'on') o.interim(t); },
      level: function (v) { if (o.level) o.level(v); },
      note: function (msg) { if (o.note) o.note(msg); },
      progress: function (pct) { if (st === 'loading' || st === 'on') set('loading', { percent: pct }); },
      on: function (info) { set('on', info); },
      error: fail
    };
    return {
      get state() { return st; },
      start: function () {
        if (eng) return Promise.resolve();
        eng = o.engine === 'chrome' ? chromeEngine(o, h) : whisperEngine(o, h);
        set('loading', { percent: null });
        return eng.start().catch(function (e) { fail(e && e.name && e.name !== 'Error' ? micError(e) : (e && e.message) || String(e)); });
      },
      stop: function () { if (eng) eng.stop(); eng = null; set('off'); },
      feed: function (x) { if (eng && eng.feed) eng.feed(x); }
    };
  }

  return { resample: resample, segmenter: segmenter, cleanTranscript: cleanTranscript, create: create, MODELS: MODELS, RATE: RATE };
});
