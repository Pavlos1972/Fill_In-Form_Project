/* The "View" buttons and the document window of the Client Overview Studio (0.95, Paul 23 November: a View button on every document-backed item, on the entry screen and in the Presentation, that opens the source PDF from the
   client's folder INSIDE the page). Two halves:
   (1) which file belongs to an item, found from what the overview already holds (the file name `src.file` that every item read from a document carries; the pay-out guide's own `cmp.src.file`; a quote's CP number, a policy's number
       and insurer when no name is held) and matched against the list of the client's files: pure, no screen, tested in Node;
   (2) the buttons and the window: a large window over the screen with zoom and Close (Esc closes), the PDF drawn by pdf.js (loaded only when a document is opened; the browser's own viewer if pdf.js cannot open it), in the
       Presentation inside the full-screen element so the client sees nothing of Chrome. Nothing is added to the saved file: the file names it holds are all the page needs. Loads in the browser (window.OV.view) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ov-schema.js'), require('./ov-calc.js'));
  else { root.OV = root.OV || {}; root.OV.view = factory(root.OV.schema, root.OV.calc); }
})(typeof self !== 'undefined' ? self : this, function (schema, calc) {
  var VIEWABLE = /\.(pdf|png|jpe?g)$/i, IMAGE = /\.(png|jpe?g)$/i;
  var LABEL = { schedule: 'View policy schedule', quote: 'View quote', statement: 'View statement', guide: 'View guide', report: 'View report', letter: 'View letter' };
  var TITLE = { schedule: 'Policy schedule', quote: 'Quote', statement: 'Statement', guide: 'Change moment pay-out guide', report: 'Goal analysis report' };
  var BLOCK_ROLE = { policies: 'schedule', fna: 'quote', shortfallQuote: 'quote', reduced: 'quote', comparative: 'quote', svFna: 'quote', svShortfall: 'quote', svReduced: 'quote', svIncrease: 'quote', svReduction: 'quote', group: 'statement', investments: 'statement', proposed: 'quote', goals: 'report', other: 'schedule' };
  /* A BrightRock policy is shown by its POLICY SUMMARY SCHEDULE, never by the long owner's manual (about 78 pages): a file whose name says one of these words is never opened for it. (The file names are my guess: one table.) */
  var MANUAL = /manual|owner|terms|conditions|policy ?document|policy ?wording|contract|brochure/i;
  var STOP = { the: 1, and: 1, life: 1, insurance: 1, assurance: 1, limited: 1, ltd: 1, pty: 1, company: 1, group: 1, investments: 1, investment: 1, holdings: 1, financial: 1, services: 1, policy: 1, cover: 1 };
  var ALIAS = { brightrock: ['br'], 'bright rock': ['br'], 'old mutual': ['om'], oldmutual: ['om'], discovery: ['disc'], liberty: ['lib'], sanlam: ['san'], momentum: ['mom'], metropolitan: ['met'] };

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function alnum(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function words(s) { return norm(s).split(' ').filter(function (w) { return w.length >= 3 && !STOP[w]; }); }
  function whoInfo(who) { var n = norm(who), has = Object.prototype.hasOwnProperty; return { ws: words(who), al: (has.call(ALIAS, n) && ALIAS[n]) || (has.call(ALIAS, n.split(' ')[0]) && ALIAS[n.split(' ')[0]]) || [] }; }
  function hitN(padded, wi) {                                                                    // does the (padded, normalised) file name name this insurer or provider (its words, or the short name the folders use)
    var i;
    for (i = 0; i < wi.ws.length; i++) if (padded.indexOf(wi.ws[i]) >= 0) return true;
    for (i = 0; i < wi.al.length; i++) if (padded.indexOf(' ' + wi.al[i] + ' ') >= 0) return true;
    return false;
  }
  function hit(name, who) { return hitN(' ' + norm(name) + ' ', whoInfo(who)); }
  /* What the page needs to know about a file name, worked out once and kept on the file (0.96: a page of 40 buttons over 4,000 files took 283 ms for every redraw). */
  function K(f) {
    if (f._k) return f._k;
    var nm = String(f.name == null ? '' : f.name), n = norm(nm);
    return (f._k = { low: nm.toLowerCase(), n: n, p: ' ' + n + ' ', a: alnum(nm), manual: MANUAL.test(nm), ok: VIEWABLE.test(nm), rel: norm((f.rel || []).join(' ')), runs: strip(nm).match(/\d{4,}/g) || [] });
  }
  function hasNum(name, num) { var d = alnum(num); return d.length >= 4 && alnum(name).indexOf(d) >= 0; }
  /* A number in a file name that is not this item's: another policy's or quote's (dates and bare years do not count). A file that carries one is never offered for an item whose own number is not in it. */
  function strip(name) { return String(name == null ? '' : name).replace(/\b\d{1,2}[.\-\/ ]\d{1,2}[.\-\/ ](?:\d{4}|\d{2})\b/g, ' ').replace(/\b(?:19|20)\d\d\b/g, ' '); }
  function foreign(name, num) { var own = alnum(num), runs = strip(name).match(/\d{4,}/g) || []; return !!own && runs.some(function (r) { return own.indexOf(r) < 0; }); }
  /* Every file name the overview itself already holds for another item (the file an item was read from): a search never hands one item another item's file. */
  function takenBy(state, path) {
    var t = {}, add = function (f) { if (f) t[String(f).toLowerCase()] = true; };
    Object.keys((state && state.blocks) || {}).forEach(function (b) {
      ['items', 'quotes'].forEach(function (l) {
        var list = state.blocks[b] && state.blocks[b][l]; if (!Array.isArray(list)) return;
        list.forEach(function (o, i) {
          if (!o || o.removed) return; var p = 'blocks.' + b + '.' + l + '.' + i;
          if (p !== path) { add(o.src && o.src.file); add(o.valueSource && o.valueSource.file); }
          if (o.cmp && p + '.cmp' !== path) add(o.cmp.src && o.cmp.src.file);
          if (o.offer && o.offer.letter && p + '.letter' !== path) add(o.offer.letter);                       // the counter offer letter belongs to its counter offer, never to another item
        });
      });
    });
    return t;
  }

  /* ---------- 1. which file belongs to an item ---------- */
  /* The thing to open for the item at `path` ("blocks.fna.quotes.0", "blocks.policies.items.1", "...quotes.0.cmp" for a pay-out guide): its role, the file name the overview holds, and what a search can use. null when the item has no such document. */
  function refFor(state, path) {
    var m = /^blocks\.([A-Za-z]+)\.(items|quotes)\.(\d+)(\.cmp|\.letter)?$/.exec(String(path || '')); if (!m || !state || !state.blocks) return null;
    var block = m[1], list = state.blocks[block] && state.blocks[block][m[2]], o = list && list[+m[3]]; if (!o || o.removed || (m[4] === '.cmp' && !o.cmp) || (m[4] === '.letter' && !(o.offer && o.offer.letter))) return null;
    var role = m[4] === '.cmp' ? 'guide' : m[4] === '.letter' ? 'letter' : BLOCK_ROLE[block]; if (!role) return null;
    var src = o.src || {}, ref = { path: String(path), block: block, role: role, name: '', number: '', policyNo: '', insurer: '', product: '', kind: '', bright: false, required: false, label: '' };
    if (role === 'schedule') {
      ref.name = src.kind === 'schedule' || src.kind === 'astute' ? String(src.file || '') : '';
      if (src.kind === 'astute') { ref.astute = true; ref.page = parseInt(src.page, 10) >= 1 ? parseInt(src.page, 10) : null; }          // round 1.1: the row's figures came from the Astute report
      if (block === 'other') { ref.insurer = String(o.company || ''); ref.product = String(o.product || ''); ref.policyNo = String(o.policyNo || ''); ref.label = ref.insurer || 'the legacy protection plan'; }
      else { ref.insurer = String(o.insurer || ''); ref.product = String(o.product || ''); ref.policyNo = String(o.policyNo || ''); ref.required = true; ref.label = [ref.insurer || 'Policy', ref.policyNo].filter(Boolean).join(' '); }
      ref.bright = /bright/i.test(ref.insurer) && block !== 'other';
    } else if (role === 'quote') {
      ref.name = src.kind === 'quote' || src.kind === 'proposal' ? String(src.file || '') : '';
      if (block === 'proposed') { ref.number = String(o.quote || ''); ref.insurer = String(o.provider || ''); ref.label = [o.type, o.provider].filter(Boolean).join(' '); }
      else { ref.number = String(o.number || ''); ref.insurer = String(o.insurer || ''); ref.required = true; ref.label = [o.insurer, ({ fna: 'FNA', shortfall: 'shortfall quote', reduced: 'reduced quote', comparative: 'quote' })[o.kind], o.number].filter(Boolean).join(' '); }
    } else if (role === 'letter') {
      ref.name = String(o.offer.letter); ref.number = String(o.number || ''); ref.insurer = String(o.insurer || ''); ref.required = true; ref.label = 'the counter offer letter of ' + (o.number || 'this counter offer');
    } else if (role === 'guide') {
      var cs = o.cmp.src || {}; ref.name = String(cs.file || ''); ref.number = String(o.cmp.number || o.number || ''); ref.insurer = String(o.insurer || ''); ref.label = 'the change moment pay-out of ' + (o.number || o.policyNo || o.insurer || 'this quote');
    } else if (role === 'statement') {
      var vs = o.valueSource || {};
      ref.name = String(src.kind === 'group' || src.kind === 'schedule' || src.kind === 'astute' ? (vs.file || src.file || '') : (vs.file || '')); ref.insurer = String(o.provider || ''); ref.product = String(o.product || ''); ref.policyNo = String(o.policyNo || '');
      ref.label = [o.provider, o.product].filter(Boolean).join(' ') || 'this item';
      if ((vs.kind || src.kind) === 'astute') { ref.astute = true; ref.page = parseInt(vs.page || src.page, 10) >= 1 ? parseInt(vs.page || src.page, 10) : null; }
    } else if (role === 'report') {
      ref.name = src.kind === 'goal' ? String(src.file || '') : ''; ref.kind = o.kind === 'egar' ? 'egar' : 'rgar'; ref.label = ref.kind === 'rgar' ? 'the retirement goal analysis report' : 'the education goal analysis report';
    }
    ref.show = !!ref.name || ref.required;
    return ref;
  }

  var WHAT = { schedule: 'policy schedule', quote: 'quote', statement: 'statement', guide: 'change moment pay-out guide', report: 'goal analysis report', letter: 'counter offer letter' };
  /* Which of the client's files (pool: [{ name, rel, handle }]) is this item's. Returns { file, how } or { reason, text }. The file name the overview holds wins; with no name (or a name that is gone) the number or insurer in the file name decides. */
  function pick(ref, pool, taken) {
    taken = taken || {}; pool = pool || [];
    var files = [], i;
    for (i = 0; i < pool.length; i++) if (pool[i] && K(pool[i]).ok) files.push(pool[i]);
    var lowName = String(ref.name || '').toLowerCase(), exact = ref.name ? files.filter(function (f) { return K(f).low === lowName; }) : [];
    var sawManual = null;
    if (exact.length > 1) exact = sameName(exact, ref);                                         // round 1.5: two policy folders may both hold "Policy Schedule.pdf": the one in THIS item's folder (its policy number, else its insurer) is the right one
    if (exact.length) {
      if (ref.bright && ref.role === 'schedule' && K(exact[0]).manual) sawManual = exact[0].name;
      else return { file: exact[0], how: 'name' };
    }
    var best = null, score = 0, dp = alnum(ref.policyNo), dn = alnum(ref.number), wIns = whoInfo(ref.insurer), wProd = ref.product ? whoInfo(ref.product) : null;
    var hasP = function (k) { return dp.length >= 4 && k.a.indexOf(dp) >= 0; }, hasN = function (k) { return dn.length >= 4 && k.a.indexOf(dn) >= 0; };
    files.forEach(function (f) {
      var k = K(f), n = k.n, s = 0, manual = k.manual;
      if (taken[k.low]) return;                                                                  // another item's own file
      if (ref.role === 'schedule') {
        if (ref.bright && manual) { if ((hasP(k) || hitN(k.p, wIns)) && !sawManual) sawManual = f.name; return; }
        var num = hasP(k), who = hitN(k.p, wIns);
        if (!num && !who) return;
        if (!num && dp && k.runs.some(function (r) { return dp.indexOf(r) < 0; })) return;       // another policy's schedule
        s = (num ? 6 : 0) + (who ? 3 : 0) + (/summary/.test(n) ? (ref.bright ? 5 : 2) : 0) + (/schedule/.test(n) ? 2 : 0) + (/policy schedules/.test(k.rel) ? 1 : 0) - (manual ? 3 : 0);
        if (ref.bright && !/summary|schedule/.test(n) && !num) return;
        if (s < 5) return;
      } else if (ref.role === 'quote') {
        if (!hasN(k) || /cmpo|pay ?out/.test(n)) return;
        s = 5 + (/fna|shortfall|reduced|quote/.test(n) ? 2 : 0) + (hitN(k.p, wIns) ? 1 : 0);
      } else if (ref.role === 'letter') {
        if (!hasN(k) || !/cover terms|counter ?offer|terms/.test(n)) return;
        s = 8;
      } else if (ref.role === 'guide') {
        if (!hasN(k) || !/cmpo|pay ?out|change moment/.test(n)) return;
        s = 8;
      } else if (ref.role === 'statement') {
        if (!hasP(k)) return;                                                                    // a statement is only found again by its policy number: a provider's name alone is not enough to show a client's document
        s = 6 + (hitN(k.p, wIns) ? 4 : 0) + (/statement|benefit|schedule|astute|valuation|fund|summary/.test(n) ? 2 : 0) + (wProd && hitN(k.p, wProd) ? 2 : 0) - (manual ? 3 : 0);
      } else if (ref.role === 'report') {
        var kindRe = ref.kind === 'egar' ? /egar|education/ : /rgar|retirement/;
        if (!kindRe.test(n)) return;
        s = 4 + (/report|analysis|goal/.test(n) ? 2 : 0);
      }
      if (s > score) { score = s; best = f; }
    });
    if (best) return { file: best, how: 'search' };
    if (sawManual) return { reason: 'manual', text: 'Only the owner’s manual (“' + sawManual + '”) was found for this BrightRock policy, not its policy summary schedule, so nothing is opened.' };
    return { reason: 'missing', text: ref.name ? 'The file “' + ref.name + '” is not in the client’s folder any more (it may have been renamed or moved).' : 'No ' + WHAT[ref.role] + ' for ' + ref.label + ' was found in the client’s folder.' };
  }
  /* Several files with the same name (in different folders): those whose folders carry the item's policy number, else those whose folders name its insurer; with neither, they stay as they were. */
  /* The year of the folder a file sits in ("2026 - Review", "2025"): 0 when no folder says. */
  function folderYear(f) { var y = 0; ((f && f.rel) || []).forEach(function (r) { var m = /^((?:19|20)\d{2})(?!\d)/.exec(String(r).trim()); if (m) y = Math.max(y, +m[1]); }); return y; }
  function sameName(list, ref) {
    var dp = alnum(ref.policyNo), byNo = dp.length >= 4 ? list.filter(function (f) { return alnum((f.rel || []).join(' ')).indexOf(dp) >= 0; }) : [];
    var wi = whoInfo(ref.insurer), byWho = (wi.ws.length || wi.al.length) ? list.filter(function (f) { return hitN(' ' + K(f).rel + ' ', wi); }) : [];
    var cand = byNo.length ? byNo : byWho.length ? byWho : list, top = 0;
    cand.forEach(function (f) { top = Math.max(top, folderYear(f)); });                                // round 1.6: the saved file holds the NAME only; when one name is in two year folders ("FNA Quote.pdf" in 2024 - Review and 2026 - Review) the newest year's file is the one the load ticked
    return top ? cand.filter(function (f) { return folderYear(f) === top; }) : cand;
  }
  var REASONS = {
    connect: 'The client’s folders are not connected, so the page cannot open the file. Use More → Folders… to connect them.',
    access: 'Chrome has not been given permission to read the client’s folders in this visit. Click to open it: Chrome will ask.',
    names: 'Type the client’s first names and surname first, so the page can find the client’s folder.',
    client: 'The client’s folder was not found in the connected folders.',
    'slow-permission': 'Chrome did not get an answer to its permission question in time. Look next to the address bar for “Edit files?” and click Allow, then click again.',
    'slow-find': 'Looking through your client folders took too long (OneDrive may still be fetching the folder lists). Try again in a minute.',
    'slow-list': 'Reading the client’s folders took too long (OneDrive may still be fetching them). Try again in a minute.'
  };

  /* ---------- 2. the buttons ---------- */
  var vs = { key: '', idx: null, err: null, loading: null, cache: {}, stateRef: null };          // what is known about the client's files, for this visit (idx: { label, files, partial, seeded })
  function app() { return typeof window !== 'undefined' && window.OV && window.OV.app && window.OV.app.state ? window.OV.app : null; }
  function fu() { return typeof window !== 'undefined' && window.FF && window.FF.foldersUI && window.FF.foldersUI.clientIndex ? window.FF.foldersUI : null; }
  function info() { var a = app(), h = a && a.state.header || {}; return { sname: h.sname || '', fname: h.fname || '' }; }
  function keyOf() { var i = info(); return norm(i.sname) + '|' + norm(i.fname); }
  function sameClient() {
    var k = keyOf(), a = app();
    if (vs.key !== k) { vs.key = k; vs.idx = null; vs.err = null; vs.loading = null; vs.cache = {}; }
    if (a && vs.stateRef !== a.state) { vs.stateRef = a.state; vs.cache = {}; }
  }
  function forget() { vs.idx = null; vs.err = null; vs.loading = null; vs.key = ''; vs.cache = {}; if (fu() && fu().forgetIndex) fu().forgetIndex(); }
  function setIdx(idx) { vs.idx = idx; vs.err = null; vs.cache = {}; }
  function invalidate() { vs.cache = {}; }                                                          // the overview changed (a load, a fill): which file is whose has to be worked out again
  function connected() { var f = fu(); return !!f && (!f.connected || f.connected().length > 0); }

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sig(ref) { return [ref.role, ref.name, ref.number, ref.policyNo, ref.insurer, ref.product, ref.kind, ref.bright ? 1 : 0].join('|'); }
  /* The state of one item's button right now, from what is known: { ok, text }. Until the client's files have been listed it is "ok" (a click looks for the file); a list that covers only some folders (a Load's, or a walk cut short)
     never greys a button, because the file may be in a folder it did not look in. */
  function statusOf(ref) {
    if (!connected()) return { ok: false, code: 'connect', text: REASONS.connect };
    if (vs.err === 'client' || vs.err === 'names') return { ok: false, code: vs.err, text: REASONS[vs.err] };
    var neutral = { ok: true, text: vs.err === 'access' ? REASONS.access : (ref.name ? 'Opens “' + ref.name + '” from the client’s folder' : 'Opens the ' + WHAT[ref.role] + ' from the client’s folder') };
    if (!vs.idx) return neutral;
    var key = sig(ref); if (vs.cache[key]) return vs.cache[key];
    var r = pick(ref, vs.idx.files, takenBy(app().state, ref.path));
    return (vs.cache[key] = r.file ? { ok: true, text: (ref.astute ? 'Astute report' : TITLE[ref.role]) + ': ' + r.file.name + ' (opens inside the page)' } : vs.idx.partial ? neutral : { ok: false, code: r.reason, text: r.text });
  }
  /* The HTML of a View button (mode: 'studio' or 'pres'). '' when the item has no document. */
  function button(state, path, mode) {
    var ref = refFor(state, path); if (!ref || !ref.show) return '';
    return '<button type="button" class="dvbtn' + (mode === 'pres' ? ' dvp' : '') + '" data-vw="' + esc(path) + '" data-vm="' + (mode === 'pres' ? 'pres' : 'studio') + '" title="' + esc(statusOf(ref).text) + '">' + ICON + esc(ref.astute ? 'View Astute report' : LABEL[ref.role]) + '</button>';
  }
  /* Brings every button on the screen in line with what is known (a greyed button with its reason in Studio; no button at all in the Presentation). Asked for after every draw, so it is done at most about 8 times a second.
     It never lists the client's folder: 0.95 did, by itself, as soon as a button was on the screen, and a search of a big OneDrive folder behind the adviser's back could hold up "Load from client folder". */
  var paintT = null;
  function paint() { if (typeof document === 'undefined' || paintT) return; paintT = setTimeout(function () { paintT = null; paintNow(); }, 120); }
  function paintNow() {
    if (typeof document === 'undefined') return;
    var a = app(); if (!a) return; sameClient(); vs.paints = (vs.paints || 0) + 1;
    [].forEach.call(document.querySelectorAll('.dvbtn[data-vw]'), function (b) {
      var ref = refFor(a.state, b.getAttribute('data-vw')), pres = b.getAttribute('data-vm') === 'pres';
      if (!ref) { b.hidden = true; return; }
      var st = statusOf(ref); b.title = st.text;
      if (pres) { b.hidden = !st.ok; b.disabled = false; } else { b.hidden = false; b.disabled = !st.ok; b.classList.toggle('off', !st.ok); }
    });
  }
  /* Lists the client's files for the buttons WITHOUT asking Chrome anything. Started by a click (the Presentation opens), never by the page by itself; stops after the walk's time limit (folders-ui TIMEOUTS.walk). */
  function warm() {
    var f = fu(); if (!f) return Promise.resolve(null); sameClient();
    if (vs.loading) return vs.loading;
    if (vs.idx && !vs.idx.seeded) return Promise.resolve(vs.idx);
    if (!connected()) return Promise.resolve(null);
    var key = vs.key;
    vs.loading = f.clientIndex(info(), { ask: false }).then(function (idx) {
      if (vs.key !== key) return null; vs.loading = null;
      if (idx && idx.reason) { if (/^(connect|access|names|client)$/.test(idx.reason)) { vs.err = idx.reason; vs.idx = null; } vs.cache = {}; } else setIdx(idx);
      paintNow(); return idx;
    }, function () { vs.loading = null; vs.err = 'error'; return null; });
    return vs.loading;
  }
  /* The files a "Load from client folder" has just listed: the buttons use them at once, with no second walk of the folder. That list covers only the folders the page reads documents from, so a file that is not in it is looked
     for in the whole client folder when its button is clicked. */
  function seed(label, files) {
    sameClient(); if (vs.idx && !vs.idx.seeded && !vs.idx.partial) return;
    setIdx({ label: label, files: files || [], partial: true, seeded: true }); paint();
  }

  /* ---------- the window ---------- */
  var cur = null;                                                                                 // the open window (one at a time)
  var ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5, 3], PDFJS = 'vendor/pdf.min.js?v=20261124d', WORKER = 'vendor/pdf.worker.min.js?v=20261124d', FONTS = 'vendor/pdfjs-fonts/';          // the fonts pdf.js draws a document with when it does not carry its own (Helvetica, Times, Courier, Symbol)
  var loading = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = PDFJS; s.onload = function () { if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; res(window.pdfjsLib); } else rej(new Error('pdf.js did not start')); };
      s.onerror = function () { rej(new Error('pdf.js could not be loaded')); }; document.head.appendChild(s);
    });
    loading.catch(function () { loading = null; });
    return loading;
  }
  function host() { return document.fullscreenElement || document.webkitFullscreenElement || document.body; }

  function show(o) {
    if (cur) cur.close();
    var el = document.createElement('div'); el.className = 'dvo' + (o.mode === 'pres' ? ' dvpres' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.title);
    el.innerHTML = '<div class="dvwin"><div class="dvbar"><div class="dvttl"><b class="dvt"></b><span class="dvs"></span></div><div class="dvact">' +
      '<button type="button" class="dvib" data-z="out" aria-label="Zoom out" title="Zoom out (minus key)">&minus;</button><button type="button" class="dvib dvpct" data-z="fit" title="Fit to the width of the window (0)">100%</button>' +
      '<button type="button" class="dvib" data-z="in" aria-label="Zoom in" title="Zoom in (plus key)">+</button><button type="button" class="dvib dvclose" data-z="close" title="Close (Esc)">Close &#10005;</button></div></div>' +
      '<div class="dvpaper" tabindex="-1" role="document"><div class="dvmsg">Opening&hellip;</div></div></div>';
    var paper = el.querySelector('.dvpaper'), pct = el.querySelector('.dvpct'), t = el.querySelector('.dvt'), sub = el.querySelector('.dvs');
    t.textContent = o.title; sub.textContent = o.sub || '';
    var ctl = { el: el, alive: true, zi: ZOOMS.indexOf(1), pdf: null, pages: [], obs: null, blobUrl: null, opener: o.opener, native: false, ref: o.ref || null };
    var scrollY = window.scrollY, mainEl = document.getElementById('main'), mainTop = mainEl ? mainEl.scrollTop : 0;
    ctl.setSub = function (s) { sub.textContent = s || ''; }; ctl.setTitle = function (s) { t.textContent = s; el.setAttribute('aria-label', s); };
    ctl.say = function (text) { var m = paper.querySelector('.dvmsg'); if (m && !m.classList.contains('bad')) m.textContent = text; };
    ctl.message = function (text, bad) { paper.innerHTML = ''; var d = document.createElement('div'); d.className = 'dvmsg' + (bad ? ' bad' : ''); d.textContent = text; paper.appendChild(d); el.classList.add('nodoc'); };
    ctl.close = function () {
      if (!ctl.alive) return; ctl.alive = false; cur = null;
      try { if (ctl.obs) ctl.obs.disconnect(); ctl.pages.forEach(function (p) { if (p.task) try { p.task.cancel(); } catch (e) { /* done */ } }); if (ctl.pdf) ctl.pdf.destroy(); } catch (e) { /* closing */ }
      if (ctl.blobUrl) URL.revokeObjectURL(ctl.blobUrl);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); el.remove();
      if (mainEl) mainEl.scrollTop = mainTop; window.scrollTo(window.scrollX, scrollY);                // exactly where he was
      if (ctl.opener && document.contains(ctl.opener) && !ctl.opener.hidden && !ctl.opener.disabled) try { ctl.opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
    };
    function setZoom(i) {
      if (!ctl.pdf && !ctl.img) return; var n = Math.max(0, Math.min(ZOOMS.length - 1, i)); if (n === ctl.zi) return;
      var ratio = paper.scrollHeight ? (paper.scrollTop + paper.clientHeight / 2) / paper.scrollHeight : 0, rx = paper.scrollWidth ? (paper.scrollLeft + paper.clientWidth / 2) / paper.scrollWidth : 0;
      ctl.zi = n; layout(); paper.scrollTop = Math.max(0, ratio * paper.scrollHeight - paper.clientHeight / 2); paper.scrollLeft = Math.max(0, rx * paper.scrollWidth - paper.clientWidth / 2);
    }
    function label() { pct.textContent = Math.round(ZOOMS[ctl.zi] * 100) + '%'; el.querySelector('[data-z="out"]').disabled = ctl.zi <= 0; el.querySelector('[data-z="in"]').disabled = ctl.zi >= ZOOMS.length - 1; }
    ctl.zoomBy = function (d) { setZoom(ctl.zi + d); }; ctl.zoomFit = function () { setZoom(ZOOMS.indexOf(1)); };
    function avail() { return Math.max(200, paper.clientWidth - 36); }
    function layout() {                                                                          // sizes of every page at this zoom; the visible ones are drawn again
      label(); var w = avail() * ZOOMS[ctl.zi];
      if (ctl.img) { ctl.img.style.width = w + 'px'; return; }
      ctl.pages.forEach(function (p) {
        if (p.task) { try { p.task.cancel(); } catch (e) { /* done */ } p.task = null; }
        p.scale = w / p.w; p.div.style.width = Math.round(w) + 'px'; p.div.style.height = Math.round(p.h * p.scale) + 'px'; p.done = false; if (p.canvas) { p.canvas.remove(); p.canvas = null; }
        if (p.vis) draw(p);
      });
    }
    function draw(p) {
      if (p.done || p.task || !ctl.alive) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2), vp = p.pdfPage.getViewport({ scale: p.scale * dpr }); while (vp.width * vp.height > 16e6 && dpr > 1) { dpr = Math.max(1, dpr - .5); vp = p.pdfPage.getViewport({ scale: p.scale * dpr }); }
      var c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.style.width = '100%'; c.style.height = '100%';
      var task = p.pdfPage.render({ canvasContext: c.getContext('2d'), viewport: vp }); p.task = task;
      task.promise.then(function () { p.task = null; if (!ctl.alive || p.canvas) return; p.canvas = c; p.done = true; p.div.appendChild(c); p.div.classList.add('rd'); }, function () { p.task = null; });
    }
    ctl.showImage = function (file) {
      paper.innerHTML = ''; var img = document.createElement('img'); img.className = 'dvimg'; ctl.blobUrl = URL.createObjectURL(file); img.src = ctl.blobUrl; img.alt = o.title; ctl.img = img; paper.appendChild(img); el.classList.remove('nodoc'); layout();
    };
    ctl.showNative = function (file) {                                                          // pdf.js could not open it (a password, a damaged file): the browser's own viewer in the same window
      paper.innerHTML = ''; ctl.native = true; el.classList.add('native'); el.classList.remove('nodoc');
      ctl.blobUrl = URL.createObjectURL(new Blob([file], { type: 'application/pdf' })); var f = document.createElement('iframe'); f.className = 'dvframe'; f.title = o.title; f.src = ctl.blobUrl; paper.appendChild(f);
    };
    ctl.showPdf = function (pdf) {
      ctl.pdf = pdf; paper.innerHTML = ''; el.classList.remove('nodoc'); ctl.pages = [];
      var n = pdf.numPages, made = [];
      for (var i = 1; i <= n; i++) made.push(pdf.getPage(i));
      return Promise.all(made).then(function (pgs) {
        if (!ctl.alive) return;
        ctl.obs = new IntersectionObserver(function (es) { es.forEach(function (e) { var p = e.target.__p; p.vis = e.isIntersecting; if (p.vis) draw(p); }); }, { root: paper, rootMargin: '900px 0px' });
        pgs.forEach(function (pg, k) {
          var vp = pg.getViewport({ scale: 1 }), d = document.createElement('div'); d.className = 'dvpage'; d.setAttribute('data-n', k + 1);
          var p = { div: d, pdfPage: pg, w: vp.width, h: vp.height, scale: 1, vis: false, done: false, task: null, canvas: null }; d.__p = p; ctl.pages.push(p); paper.appendChild(d); ctl.obs.observe(d);
        });
        layout(); paper.focus({ preventScroll: true });
        var pg = ctl.ref && parseInt(ctl.ref.page, 10);                                                       // an Astute report opens at the page where the item is listed (best effort: the page the reading gave, kept inside the file)
        if (pg >= 1 && pg <= ctl.pages.length) {
          var goPage = function () { if (ctl.alive) paper.scrollTop += ctl.pages[pg - 1].div.getBoundingClientRect().top - paper.getBoundingClientRect().top - 8; };          // done again one frame later: the scroll bar appearing changes the page sizes
          goPage(); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { goPage(); requestAnimationFrame(goPage); });
          ctl.setSub('Astute report: page ' + pg);
        }
      });
    };
    function onKey(ev) {
      if (!ctl.alive) return;
      var k = ev.key;
      if (k === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); ctl.close(); return; }
      if (k === 'Tab') {                                                                         // the focus stays inside the window: the buttons, then round again
        var bs = [].slice.call(el.querySelectorAll('button:not(:disabled)')), at = bs.indexOf(document.activeElement), last = bs.length - 1;
        if (bs.length && (!el.contains(document.activeElement) || document.activeElement === paper || (ev.shiftKey && at === 0) || (!ev.shiftKey && at === last))) {
          ev.preventDefault(); bs[ev.shiftKey ? (at <= 0 || document.activeElement === paper ? last : 0) : 0].focus();
        }
        ev.stopImmediatePropagation(); return;
      }
      if (!ctl.native && (k === '+' || k === '=' )) { ev.preventDefault(); ctl.zoomBy(1); } else if (!ctl.native && (k === '-' || k === '_')) { ev.preventDefault(); ctl.zoomBy(-1); } else if (!ctl.native && k === '0') { ev.preventDefault(); ctl.zoomFit(); }
      if (k !== 'Enter' && k !== ' ') ev.stopImmediatePropagation();                              // nothing behind the window (the Presentation's arrow keys) hears a key meant for it; the keys still scroll the document
    }
    function onResize() { if (ctl.alive && (ctl.pdf || ctl.img)) layout(); }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]'); if (b) { var z = b.getAttribute('data-z'); if (z === 'close') ctl.close(); else if (z === 'in') ctl.zoomBy(1); else if (z === 'out') ctl.zoomBy(-1); else ctl.zoomFit(); return; }
      if (e.target === el) ctl.close();
    });
    el.addEventListener('wheel', function (e) {
      var inPaper = paper.contains(e.target);
      if (e.ctrlKey && !ctl.native && inPaper) { e.preventDefault(); ctl.zoomBy(e.deltaY < 0 ? 1 : -1); return; }                 // Ctrl + wheel zooms the document, not the page behind it
      if (!inPaper) e.preventDefault();                                                                                              // a wheel over the dark edge or the bar never moves the screen behind
    }, { passive: false });
    host().appendChild(el); window.addEventListener('keydown', onKey, true); window.addEventListener('resize', onResize);
    el.querySelector('[data-z="in"]').disabled = true; el.querySelector('[data-z="out"]').disabled = true;
    el.classList.add('nodoc'); paper.focus({ preventScroll: true }); cur = ctl; return ctl;
  }

  /* ---------- opening a file ---------- */
  function readFile(ctl, file, name, ref) {
    ctl.setTitle((ref && ref.astute ? 'Astute report' : TITLE[ref ? ref.role : 'quote']) + ': ' + name);
    if (IMAGE.test(name)) { ctl.showImage(file); return Promise.resolve(); }
    return file.arrayBuffer().then(function (buf) {
      return loadPdfJs().then(function (lib) {
        return lib.getDocument({ data: new Uint8Array(buf.slice(0)), standardFontDataUrl: FONTS }).promise.then(function (pdf) {
          if (!ctl.alive) { pdf.destroy(); return; }
          if (ref && ref.bright && ref.role === 'schedule' && !ref.astute && pdf.numPages > 30) ctl.setSub('This file has ' + pdf.numPages + ' pages: it may be the owner’s manual, not the policy summary schedule');
          return ctl.showPdf(pdf);
        });
      }).catch(function () { if (ctl.alive) ctl.showNative(new Blob([buf], { type: 'application/pdf' })); });
    });
  }
  function resolve(ref, ask, say) {
    var f = fu(); sameClient();
    if (!f) return Promise.resolve({ reason: 'connect', text: REASONS.connect });
    var taken = takenBy(app() && app().state, ref.path);
    function answer(idx) {
      var r = pick(ref, idx.files, taken); if (r.file) return r;
      if (idx.partial) return { reason: 'partial', text: 'The client’s folder is big: its list was cut short, and ' + (ref.name ? '“' + ref.name + '”' : 'the ' + WHAT[ref.role]) + ' was not in what was found. Open it from your own folder instead.' };
      return { reason: r.reason, text: r.text };
    }
    if (vs.idx) { var r0 = pick(ref, vs.idx.files, taken); if (r0.file) return Promise.resolve(r0); if (!vs.idx.seeded) return Promise.resolve(answer(vs.idx)); }   // a list from a Load covers only some folders: look in the whole folder
    return f.clientIndex(info(), { ask: !!ask, onStage: say }).then(function (idx) {
      if (idx && idx.reason) { if (/^(connect|access|names|client)$/.test(idx.reason)) { vs.err = idx.reason; vs.idx = null; vs.cache = {}; } return { reason: idx.reason, text: REASONS[idx.reason] || 'The client’s folder could not be read.' }; }
      setIdx(idx); return answer(idx);
    }, function (e) { return { reason: 'error', text: 'Could not look through the client’s folders (' + (e && e.message ? e.message : 'unknown error') + ').' }; });
  }
  /* A click on a View button (path of the item, the button, 'studio' or 'pres'). The window opens at once ("Opening...") so the click is answered while the folder is searched and Chrome asks for permission. */
  function open(path, opener, mode) {
    var a = app(); if (!a) return Promise.resolve();
    var ref = refFor(a.state, path); if (!ref) return Promise.resolve();
    var ctl = show({ title: TITLE[ref.role], sub: mode === 'pres' ? '' : 'Opened from the client’s folder · Close (or Esc) brings you back to where you were', mode: mode, opener: opener, ref: ref });
    var again = false, STAGE = { permission: 'Waiting for Chrome’s permission question (look next to the address bar)…', find: 'Looking for the client’s folder…', walk: 'Looking through the client’s folder…' }, t0 = Date.now(), base = 'Opening…';
    var tick = setInterval(function () { if (!ctl.alive) return clearInterval(tick); ctl.say(base + ' ' + Math.round((Date.now() - t0) / 1000) + ' s'); }, 1000);
    function attempt() {
      return resolve(ref, true, function (st) { base = STAGE[st] || 'Opening…'; if (ctl.alive) ctl.say(base); }).then(function (r) {
        if (!ctl.alive) return;
        if (r.reason) { ctl.message(r.text, true); ctl.setSub(''); ctl.setTitle(TITLE[ref.role] + ': not opened'); paint(); return; }
        return r.file.handle.getFile().then(function (file) { paint(); return readFile(ctl, file, r.file.name, ref); }, function (e) {
          if (!again) { again = true; forget(); sameClient(); return attempt(); }                  // the folder changed since it was listed: look once more
          ctl.message('The file “' + r.file.name + '” could not be opened (' + (e && e.message ? e.message : 'unknown error') + ').', true);
        });
      });
    }
    return attempt().catch(function (e) { if (ctl.alive) ctl.message('The document could not be opened (' + (e && e.message ? e.message : 'unknown error') + ').', true); }).then(function () { clearInterval(tick); });
  }

  return {
    VIEWABLE: VIEWABLE, LABEL: LABEL, TITLE: TITLE, MANUAL: MANUAL, ZOOMS: ZOOMS, REASONS: REASONS, norm: norm, hit: hit, hasNum: hasNum, foreign: foreign, takenBy: takenBy, refFor: refFor, pick: pick, statusOf: statusOf, button: button, paint: paint, paintNow: paintNow, warm: warm, ensure: warm, seed: seed, invalidate: invalidate, forget: forget,
    open: open, show: show, loadPdfJs: loadPdfJs, state: vs, current: function () { return cur; }
  };
});
