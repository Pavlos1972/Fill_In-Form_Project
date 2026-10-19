/* Speech source for voice mode: the microphone becomes lines of text, and each line goes to FF.app.voiceHear.
   Two sources. Whisper runs on this computer: the audio never leaves it, and the speech model is downloaded once and kept in the browser.
   Chrome's own speech recognition is instant but sends the audio to Google, so it is for practice talk only, never for a client. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.listen = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var RATE = 16000;                                                       // samples a second, the rate Whisper wants
  var LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
  /* The speech models on offer. Whisper reads the sound in blocks of 30 seconds whatever the length of the line, which is slow on a computer with no graphics chip;
     Moonshine reads only as much sound as there is, so a short answer comes back in a fraction of the time. */
  var MODELS = {
    'moonshine-tiny': { repo: 'onnx-community/moonshine-tiny-ONNX', kind: 'moonshine', label: 'Moonshine Tiny', menu: 'Moonshine Tiny (fastest, recommended)' },
    'moonshine-base': { repo: 'onnx-community/moonshine-base-ONNX', kind: 'moonshine', label: 'Moonshine Base', menu: 'Moonshine Base (more accurate, slower)' },
    'tiny.en': { repo: 'onnx-community/whisper-tiny.en', kind: 'whisper', label: 'Whisper Tiny', menu: 'Whisper Tiny (slow without a graphics chip)' },
    'base.en': { repo: 'onnx-community/whisper-base.en', kind: 'whisper', label: 'Whisper Base', menu: 'Whisper Base (more accurate, slower still)' },
    'small.en': { repo: 'onnx-community/whisper-small.en', kind: 'whisper', label: 'Whisper Small', menu: 'Whisper Small (most accurate, slowest)' }
  };
  var DEFAULT_MODEL = 'moonshine-tiny';
  /* How each kind of model is read: on the graphics chip, and on the processor (the forms tried in turn: 'q8' and 'q4' are smaller, 'fp32' is the full size). */
  var KINDS = {
    whisper: { gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, cpu: ['q8'] },
    moonshine: { gpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, cpu: [{ encoder_model: 'fp32', decoder_model_merged: 'q8' }, { encoder_model: 'fp32', decoder_model_merged: 'q4' }, 'fp32'] }
  };

  /* ---------- sound helpers (they need no browser, so they are tested) ---------- */
  function resample(x, from, to) {                                        // straight-line resampling
    if (from === to) return x;
    var n = Math.floor(x.length * to / from), y = new Float32Array(n), k = from / to, i, p, j, f;
    for (i = 0; i < n; i++) { p = i * k; j = Math.floor(p); f = p - j; y[i] = x[j] * (1 - f) + (j + 1 < x.length ? x[j + 1] : x[j]) * f; }
    return y;
  }
  function rms(x) { var s = 0, i; for (i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / (x.length || 1)); }
  function peakOf(x) { var p = 0, i, a; for (i = 0; i < x.length; i++) { a = x[i] < 0 ? -x[i] : x[i]; if (a > p) p = a; } return p; }
  /* A quiet microphone (a laptop's built-in one often is) gives Whisper too little to work with, and it then makes words up. A line is brought up to a normal level first, never by more than 30 times. */
  function normalize(x) {
    var p = peakOf(x), g = Math.min(30, 0.8 / (p || 1)), y, i;
    if (p < 0.0001 || g < 1.05) return x;
    y = new Float32Array(x.length);
    for (i = 0; i < x.length; i++) y[i] = x[i] * g;
    return y;
  }
  /* The loudness meter: 0 to 1, on a decibel scale so that quiet speech still moves it (-60 dB is empty, -10 dB is full). */
  function meter(r) { return r > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(r) + 60) / 50)) : 0; }
  function join(parts) {
    var n = 0, i, o, p = 0;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    o = new Float32Array(n);
    for (i = 0; i < parts.length; i++) { o.set(parts[i], p); p += parts[i].length; }
    return o;
  }
  /* Cuts a stream of sound into spoken lines: a line starts when the sound rises clearly above the room's noise and ends after a pause (0.6 s),
     or after 14 s so a long speech is still handled. push() takes sound and returns the finished lines; flush() returns what is being said now. */
  function segmenter(o) {
    o = o || {};
    var FR = Math.round(RATE * 0.03), END = Math.round((o.endMs || 600) / 30), MIN = Math.round((o.minMs || 240) / 30), MAX = Math.round((o.maxMs || 14000) / 30), PRE = Math.round((o.preMs || 300) / 30);
    var rest = new Float32Array(0), pre = [], cur = null, quiet = 0, run = 0, spoken = 0, floor = 0.003, last = 0;
    function line() { return cur && spoken >= MIN ? join(cur.slice(0, Math.min(cur.length, cur.length - quiet + 7))) : null; }   // the speech, with 0.2 s of the pause; a blip shorter than a short word is not a line
    function frame(fr) {
      var r = rms(fr), speech = r > Math.max(0.008, floor * 3.5), done = null;
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
  /* When Whisper is given noise it can get stuck repeating itself ("more, get, more, get, ..."): a few words said over and over is not speech. */
  function isLoop(t) {
    var w = String(t == null ? '' : t).toLowerCase().match(/[a-z0-9']+/g) || [], seen = {}, n = 0;
    if (w.length < 6) return false;
    w.forEach(function (x) { if (!seen[x]) { seen[x] = 1; n++; } });
    return n / w.length <= 0.4 || /\b(\w+(?:\W+\w+){0,3})(?:\W+\1\b){3,}/i.test(String(t));
  }
  /* A name spelled out ("K A F E N T Z I S", "K-A-F-E-N-T-Z-I-S", "Kay, A, F, E, N, T, Zed, I, S" or "K for Kilo, A for Alpha") is joined into one word.
     A speech model gets an unusual surname wrong whenever it is said as a word, but spelled letters come out reliably. At least four letters in a row (three with "for"), so "J. P. van der Merwe" and "plan A or B" are left alone. */
  var LETTER_NAMES = { kay: 'k', jay: 'j', zed: 'z', zee: 'z', aitch: 'h', ess: 's', eff: 'f', gee: 'g', dee: 'd', bee: 'b', pee: 'p', vee: 'v', cue: 'q' };
  function joinSpelling(t) {
    var s = String(t == null ? '' : t), word = function (l) { return l.charAt(0).toUpperCase() + l.slice(1); },
      pair = '[a-z]\\s+(?:for|as in|like)\\s+[a-z]+', tok = '(?:' + Object.keys(LETTER_NAMES).join('|') + '|[a-z])';
    s = s.replace(new RegExp('(?<![a-z\'])' + pair + '(?:[\\s.,;-]+(?:and\\s+)?' + pair + '){2,}', 'gi'), function (m) {          // "K for Kilo, A for Alpha": each word must start with its letter
      var ps = m.match(new RegExp(pair, 'gi')), ok = ps.every(function (p) { return p.charAt(0).toLowerCase() === p.replace(/^[a-z]\s+(?:for|as in|like)\s+/i, '').charAt(0).toLowerCase(); });
      return ok ? word(ps.map(function (p) { return p.charAt(0); }).join('').toLowerCase()) : m;
    });
    return s.replace(new RegExp('(?<![a-z\'])' + tok + '(?:[\\s.,-]+' + tok + '){3,}(?![a-z\'])', 'gi'), function (m) {
      return word(m.split(/[\s.,-]+/).map(function (x) { var k = x.toLowerCase(); return LETTER_NAMES[k] || k; }).join(''));
    });
  }
  /* Whisper writes things like "[BLANK_AUDIO]", "(music)" or "Thank you." when it hears only noise: those are dropped, and so is a line that is only a loop. */
  function cleanTranscript(t) {
    var s = String(t == null ? '' : t).replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || !/[a-z0-9]/i.test(s) || /^(?:you|thank you|thanks|thanks for watching|bye|bye bye)\W*$/i.test(s) || isLoop(s)) return '';
    return joinSpelling(s);
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
    function read(key) {
      return db().then(function (d) {
        return new Promise(function (ok) {
          var q = d.transaction('f').objectStore('f').get(String(key));
          q.onsuccess = function () { ok(q.result || undefined); };
          q.onerror = function () { ok(undefined); };
        });
      }, function () { return undefined; });
    }
    function write(key, buf, type) {
      return db().then(function (d) {
        return new Promise(function (ok, no) {
          var tx = d.transaction('f', 'readwrite');
          tx.objectStore('f').put({ buf: buf, type: type || 'application/octet-stream' }, String(key));
          tx.oncomplete = function () { ok(); };
          tx.onerror = function () { no(tx.error); };
        });
      });
    }
    return {
      read: read, write: write,
      match: function (key) { return read(key).then(function (r) { return r ? new Response(r.buf, { headers: { 'content-type': r.type } }) : undefined; }); },
      put: function (key, response) { return response.arrayBuffer().then(function (buf) { return write(key, buf, response.headers.get('content-type')); }); }
    };
  }
  /* The speech model runs in a worker, so reading a sentence never freezes the page or loses what the microphone hears meanwhile.
     The worker is made from this text (a page opened from a file cannot start a worker from another file). It cannot reach the model's
     storage itself, so it asks the page for stored files and hands it new ones. */
  function workerBody() {
    var pend = {}, seq = 0, pipe = null;
    function ask(msg) { return new Promise(function (ok) { msg.id = ++seq; pend[msg.id] = ok; postMessage(msg); }); }
    self.onmessage = function (e) {
      var m = e.data, f;
      if (m.t === 'reply') { f = pend[m.id]; delete pend[m.id]; if (f) f(m); }
      else if (m.t === 'load') {
        import(m.lib).then(function (lib) {
          var o = { progress_callback: function (p) { postMessage({ t: 'progress', status: p.status, file: p.file, loaded: p.loaded, total: p.total }); } }, k;
          lib.env.allowLocalModels = false; lib.env.useBrowserCache = false; lib.env.useCustomCache = true;
          lib.env.customCache = {
            match: function (key) { return ask({ t: 'cacheGet', key: key }).then(function (r) { return r.buf ? new Response(r.buf, { headers: { 'content-type': r.type } }) : undefined; }); },
            put: function (key, response) { return response.arrayBuffer().then(function (buf) { return ask({ t: 'cachePut', key: key, buf: buf, type: response.headers.get('content-type') }); }).then(function () { /* stored */ }); }
          };
          for (k in m.opts) o[k] = m.opts[k];
          return lib.pipeline('automatic-speech-recognition', m.model, o);
        }).then(function (p) { pipe = p; postMessage({ t: 'ready' }); }, function (err) { postMessage({ t: 'failed', message: String(err && err.message || err) }); });
      } else if (m.t === 'run') {
        pipe(m.audio, m.opts).then(function (out) { postMessage({ t: 'result', n: m.n, text: out && out.text || '' }); }, function (err) { postMessage({ t: 'fault', n: m.n, message: String(err && err.message || err) }); });
      }
    };
  }
  /* -> Promise of { pipe(audio, options) -> Promise of { text }, close() } once the model is ready in a new worker. */
  function startWorker(lib, id, opts, progress, store) {
    return new Promise(function (ok, no) {
      var w, pend = {}, seq = 0, ready = false, dead = '';
      try { w = new Worker(URL.createObjectURL(new Blob(['(' + workerBody.toString() + ')()'], { type: 'text/javascript' }))); } catch (e) { no(e); return; }
      function fail(msg) {
        dead = msg || 'the speech worker stopped';
        Object.keys(pend).forEach(function (n) { pend[n].no(new Error(dead)); });
        pend = {};
        if (!ready) { try { w.terminate(); } catch (e) { /* gone */ } no(new Error(dead)); }
      }
      w.onerror = function (e) { if (e.preventDefault) e.preventDefault(); fail(e.message); };
      w.onmessage = function (e) {
        var m = e.data, p;
        function reply(r) { r.t = 'reply'; r.id = m.id; w.postMessage(r); }
        if (m.t === 'progress') progress(m);
        else if (m.t === 'cacheGet') store.read(m.key).then(function (r) { reply(r ? { buf: r.buf, type: r.type } : {}); }, function () { reply({}); });
        else if (m.t === 'cachePut') store.write(m.key, m.buf, m.type).then(function () { reply({}); }, function () { reply({}); });
        else if (m.t === 'ready') {
          ready = true;
          ok({ close: function () { w.terminate(); }, pipe: function (audio, o) {
            return new Promise(function (okr, nor) {
              if (dead) { nor(new Error(dead)); return; }
              var n = ++seq; pend[n] = { ok: okr, no: nor };
              w.postMessage({ t: 'run', n: n, audio: audio, opts: o });
            });
          } });
        } else if (m.t === 'failed') fail(m.message);
        else if (m.t === 'result' || m.t === 'fault') { p = pend[m.n]; delete pend[m.n]; if (p) { if (m.t === 'result') p.ok({ text: m.text }); else p.no(new Error(m.message)); } }
      };
      w.postMessage({ t: 'load', lib: lib, model: id, opts: opts });
    });
  }
  /* The same, on the page itself (when a worker cannot be started): it works, but the page is busy while a sentence is read. */
  function startOnPage(lib, id, opts, progress, store) {
    return import(lib).then(function (m) {
      var o = { progress_callback: progress }, k;
      m.env.allowLocalModels = false; m.env.useBrowserCache = false; m.env.useCustomCache = true; m.env.customCache = store;
      for (k in opts) o[k] = opts[k];
      return m.pipeline('automatic-speech-recognition', id, o);
    }).then(function (pipe) { return { pipe: pipe, close: function () { /* nothing to stop */ } }; });
  }
  var loaded = {};                                                         // model + device -> the loading speech model, so it is loaded once
  var GPU_FLAG = 'wr-fact-find-speech-nogpu';                              // set once the graphics chip has failed on this computer for a kind of model: the processor is used from then on
  function gpuBlocked(kind) { try { return localStorage.getItem(GPU_FLAG + '-' + kind) === '1'; } catch (e) { return false; } }
  function blockGpu(kind) { try { localStorage.setItem(GPU_FLAG + '-' + kind, '1'); } catch (e) { /* storage unavailable */ } }
  /* Chrome may offer WebGPU and still have no graphics adapter to run it on (this laptop's): ask for the adapter before choosing.
     -> Promise of { ok, note }: note says what was found, so the page can show why the processor is used. */
  function gpuUsable() {
    if (typeof navigator === 'undefined' || !navigator.gpu || !navigator.gpu.requestAdapter) return Promise.resolve({ ok: false, note: 'Chrome has no WebGPU on this page' + (typeof isSecureContext !== 'undefined' && !isSecureContext ? ' (it is not a secure page)' : '') });
    return navigator.gpu.requestAdapter().then(function (a) {
      var i = a && a.info || {};
      return a ? { ok: true, note: [i.vendor, i.architecture, i.description].filter(Boolean).join(' ') } : { ok: false, note: 'Chrome has WebGPU but found no graphics adapter for it' };
    }, function (e) { return { ok: false, note: 'WebGPU failed: ' + String(e && e.message || e).slice(0, 80) }; });
  }
  function isNetwork(err) { return /fetch|network|offline|ERR_|internet/i.test(String(err && err.message || err)); }
  function modelError(err) {
    var m = String(err && err.message || err);
    if (isNetwork(err) || /404|403/.test(m)) return 'Could not download the speech model (' + m + '). It needs the internet the first time.';
    return 'Could not start the speech model (' + m + ').';
  }
  /* -> Promise of { pipe, where, model, why }. The graphics chip is used when there is one, otherwise the processor. report(percent) says how far the one-time download is.
     A failed attempt on the graphics chip is followed at once by one on the processor, in a new worker. A model that cannot start at all is replaced by Whisper Tiny.
     lib is the speech library's address (changed only by tests). */
  function loadSpeech(model, report, noGpu, lib) {
    var key = model + (noGpu ? ':cpu' : '') + (lib || '');
    if (loaded[key]) return loaded[key];
    var seen = {}, store = modelStore(), url = lib || LIB, m = MODELS[model] || MODELS[DEFAULT_MODEL], kind = KINDS[m.kind];
    function progress(e) {
      if (e.status !== 'progress' || !e.total) return;
      seen[e.file] = [e.loaded, e.total];
      var l = 0, t = 0; Object.keys(seen).forEach(function (k) { l += seen[k][0]; t += seen[k][1]; });
      report(Math.round(100 * l / t));
    }
    /* In a worker; when that cannot be done, on the page itself (which works, but is busy while a line is read). */
    function start(repo, opts) {
      return startWorker(url, repo, opts, progress, store).catch(function (err) { return startOnPage(url, repo, opts, progress, store).catch(function () { throw err; }); });
    }
    /* The processor: the ways of reading the model are tried in turn until one starts (not every smaller form is published for every model). */
    function processor(mm, kk) {
      var ladder = kk.cpu.slice();
      function next() {
        return start(mm.repo, { device: 'wasm', dtype: ladder.shift() }).then(function (e) { return { pipe: e.pipe, where: 'processor' }; }, function (err) {
          if (!ladder.length || isNetwork(err)) throw err;
          return next();
        });
      }
      return next();
    }
    function chosen(mm, kk, gpu) {
      if (!gpu) return processor(mm, kk);
      return start(mm.repo, { device: 'webgpu', dtype: kk.gpu }).then(function (e) { return { pipe: e.pipe, where: 'graphics chip' }; }, function () { blockGpu(mm.kind); return processor(mm, kk); });
    }
    loaded[key] = (noGpu || gpuBlocked(m.kind) ? Promise.resolve({ ok: false, note: 'the graphics chip did not work earlier' }) : gpuUsable()).then(function (g) {
      var gpu = g.ok, why = gpu ? '' : g.note + ', so this is slower';
      return chosen(m, kind, gpu).then(function (t) { t.model = m.label; t.why = t.where === 'processor' ? why : ''; return t; }, function (err) {
        if (m.kind === 'whisper' || isNetwork(err)) throw err;
        var w = MODELS['tiny.en'];                                                  // the model could not start: Whisper Tiny instead, and the page says so
        return chosen(w, KINDS.whisper, gpu).then(function (t) { t.model = w.label + ' (' + m.label + ' could not start: ' + String(err && err.message || err).slice(0, 120) + ')'; t.why = t.where === 'processor' ? why : ''; return t; });
      });
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

  function label(id) { return (MODELS[id] || MODELS[DEFAULT_MODEL]).label; }
  /* The speech model on this computer. h: { text(line, meta), level(0..1), note(message), error(message), progress(percent), on(info) } */
  function whisperEngine(o, h) {
    var mic = null, seg = segmenter(), queue = [], busy = false, alive = false, tr = null, noGpu = false, load = o.loader || loadSpeech, peak = 0, watch = null;
    function pump() {
      if (busy || !queue.length || !tr) return;
      busy = true;
      var u = queue.shift(), t0 = Date.now(), cur = tr, secs = u.length / RATE, pk = peakOf(u);
      if (h.reading) h.reading(secs);
      Promise.resolve(cur.pipe(normalize(u), { max_new_tokens: Math.min(160, Math.round(secs * 8) + 16), no_repeat_ngram_size: 5 })).then(function (out) {
        if (!alive) return;
        var raw = out && out.text, text = cleanTranscript(raw);
        if (text) h.text(text, { audio: secs, took: (Date.now() - t0) / 1000, waiting: queue.length, where: cur.where, peak: pk });
        else if (isLoop(raw) && h.note) h.note('That sounded like noise, not speech, so it was ignored (the loudest sound was ' + Math.round(pk * 100) + '% of full level' + (pk < 0.05 ? ': the microphone is very quiet, so turn its input volume up in Windows, Settings, System, Sound, Input, or move closer' : '') + ').');
      }, function (err) {
        if (cur.where === 'graphics chip' && !noGpu && alive) {                                  // the graphics chip did not cope: carry on with the processor
          noGpu = true; blockGpu((MODELS[o.model] || MODELS[DEFAULT_MODEL]).kind); queue.unshift(u); h.progress(null);
          return load(o.model, h.progress, true, o.lib).then(function (t) { tr = t; h.on({ mic: mic && mic.label, where: t.where, model: t.model || label(o.model), why: t.why }); });
        }
        throw err;
      }).then(function () { busy = false; pump(); }, function (err) { busy = false; h.error('The speech model stopped: ' + (err && err.message || err)); });
    }
    return {
      start: function () {
        alive = true;
        return (o.mic || openMic)(function (x) {
          var lv = rms(x); if (lv > peak) peak = lv;
          h.level(meter(lv));                                                                    // the meter moves from the first second, even while the model is loading
          if (!tr || !alive) return;                                                             // nothing is kept while the model is still loading
          seg.push(x).forEach(function (u) { queue.push(u); });
          pump();
        }).then(function (m) {
          mic = m;
          watch = setTimeout(function () { if (alive && mic && peak < 0.0008 && h.note) h.note('No sound is reaching Chrome from "' + (m.label || 'the microphone') + '". Check that it is not muted and that it is the microphone you are using (Windows: Settings, System, Sound, Input).'); }, 7000);
          return load(o.model, h.progress, false, o.lib).then(function (t) { if (!alive) return; tr = t; h.on({ mic: m.label, where: t.where, model: t.model || label(o.model), why: t.why }); }, function (err) {
            m.close(); mic = null; throw new Error(modelError(err));
          });
        });
      },
      stop: function () { alive = false; clearTimeout(watch); queue = []; seg = segmenter(); peak = 0; if (mic) mic.close(); mic = null; },
      feed: function (x) { if (tr && alive) { seg.push(x).forEach(function (u) { queue.push(u); }); h.level(meter(seg.level())); pump(); } }       // used by the tests
    };
  }

  /* Chrome's own speech recognition: instant, but Google hears the audio. */
  function chromeEngine(o, h) {
    var SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition), rec = null, wanted = false, fails = 0;
    function begin() {
      rec = new SR(); rec.lang = 'en-ZA'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = function (e) {
        var interim = '', i, r;
        for (i = e.resultIndex; i < e.results.length; i++) { r = e.results[i]; if (r.isFinal) { fails = 0; h.text(joinSpelling(String(r[0].transcript).trim()), {}); } else interim += r[0].transcript; }
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

  /* o: { engine: 'whisper' | 'chrome', model, text(line, meta), interim(text), reading(seconds of speech), level(0..1), note(message), state(name, detail) } with name off | loading | on | error. */
  function create(o) {
    var eng = null, st = 'off';
    function set(s, d) { st = s; if (o.state) o.state(s, d || {}); }
    function fail(msg) { if (eng) eng.stop(); eng = null; set('error', { message: msg }); }
    var h = {
      text: function (t, meta) { if (t && st === 'on') o.text(t, meta || {}); },
      interim: function (t) { if (o.interim && st === 'on') o.interim(t); },
      level: function (v) { if (o.level) o.level(v); },
      note: function (msg) { if (o.note) o.note(msg); },
      reading: function (secs) { if (o.reading && st === 'on') o.reading(secs); },
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

  return { resample: resample, segmenter: segmenter, cleanTranscript: cleanTranscript, joinSpelling: joinSpelling, isLoop: isLoop, normalize: normalize, meter: meter, create: create, MODELS: MODELS, DEFAULT_MODEL: DEFAULT_MODEL, RATE: RATE };
});
