/* The screens and the flow of saving into the client's folder (Risk Application 1.4, Investment Application 1.3, Fact Find 5.2). The logic is in folders.js; this file connects it to the page:
   Folders… (connect New Business and Client Files once, and type each one's Windows path once), the list the adviser picks from when more than one folder fits, and FF.foldersUI.open(), which a page's Save calls
   for a first save: it finds the folder and hands back a file handle to write to, or falls back to the normal Save window with the reason. It never renames, moves or deletes a folder, and creates one only for the Client Overview:
   its `1. Overview` and year folders, inside a client folder that exists (Paul, 21 November). */
(function () {
  var F = FF.folders;
  var LABEL = { A: 'New Business', B: 'Client Files' };
  var roots = {}, loaded = null, cache = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function abort() { var e = new Error('The adviser has to click again.'); e.name = 'AbortError'; return e; }
  function load() {
    if (loaded) return loaded;
    loaded = Promise.all([F.loadHandle('A'), F.loadHandle('B')]).then(function (hs) {
      ['A', 'B'].forEach(function (k, i) { if (hs[i]) roots[k] = { handle: hs[i] }; });
      return roots;
    });
    return loaded;
  }
  function withPaths() { var p = F.getPaths(), out = {}; Object.keys(roots).forEach(function (k) { out[k] = { handle: roots[k].handle, path: p[k] || '' }; }); return out; }
  function init(cb) { load().then(function () { if (cb) cb(); }); }

  /* ---------- Folders…: connect the two folders, once ---------- */
  function connect() {
    return load().then(function () {
      return new Promise(function (resolve) {
        var dlg = document.createElement('dialog'); dlg.className = 'fdlg';
        function row(k) {
          return '<div class="frow" data-key="' + k + '"><div class="fhead"><b>' + LABEL[k] + '</b><span class="fstat" data-stat></span><button type="button" class="btn small" data-pick>Choose folder&hellip;</button></div>' +
            '<label class="fpath"><span>Windows path of this folder (typed once, so the page can warn before a path is too long)</span><input type="text" data-path value="' + esc(F.getPaths()[k] || '') + '" placeholder="e.g. C:\\Users\\&lt;you&gt;\\&hellip;\\' + LABEL[k] + '" autocomplete="off"><small data-pathnote></small></label></div>';
        }
        dlg.innerHTML = '<h3>Connect your client folders</h3><p>Pick the two folders once. After that, Save goes straight into the client&rsquo;s folder: an application into its deal folder&rsquo;s <i>Applications</i> folder, a Fact Find into the client&rsquo;s <i>2. Fact Find</i> folder. The page only looks, and writes the file: it never renames, moves or deletes a folder, and the only folders it makes are the Client Overview\u2019s <i>1. Overview</i> and year folders, inside the client\u2019s folder. ' +
          'Chrome may ask you to Allow again now and then, and each place this page is opened from (the website, the copy on this computer) needs its own one-time connection.</p>' + row('A') + row('B') +
          '<div class="fbtns"><button type="button" class="btn small" data-done>Done</button></div>';
        document.body.appendChild(dlg);
        function paint() {
          ['A', 'B'].forEach(function (k) {
            var r = dlg.querySelector('[data-key="' + k + '"]'), st = r.querySelector('[data-stat]'), inp = r.querySelector('[data-path]'), note = r.querySelector('[data-pathnote]'), v = inp.value.trim();
            st.textContent = roots[k] ? 'Connected: ' + roots[k].handle.name : 'Not connected';
            st.className = 'fstat ' + (roots[k] ? 'ok' : 'no');
            note.textContent = v === '' ? 'Not typed yet: the path length is not checked.' : /^[A-Za-z]:\\/.test(v) ? v.replace(/[\\\/]+$/, '').length + ' characters.' : 'A Windows path starts like C:\\ …';
            note.className = v === '' || !/^[A-Za-z]:\\/.test(v) ? 'warn' : '';
          });
        }
        dlg.addEventListener('click', function (e) {
          var pick = e.target.closest('[data-pick]');
          if (pick) {
            var k = pick.closest('[data-key]').getAttribute('data-key');
            window.showDirectoryPicker({ id: 'wr-folder-' + k.toLowerCase(), mode: 'readwrite' }).then(function (h) {
              roots[k] = { handle: h }; F.saveHandle(k, h); paint();
            }).catch(function (err) { if (err && err.name !== 'AbortError') { var st = dlg.querySelector('[data-key="' + k + '"] [data-stat]'); st.textContent = 'Chrome would not open that folder: ' + err.message; st.className = 'fstat no'; } });
          }
          if (e.target.closest('[data-done]')) dlg.close();
        });
        dlg.addEventListener('input', function (e) { var inp = e.target.closest('[data-path]'); if (inp) { F.setPath(inp.closest('[data-key]').getAttribute('data-key'), inp.value); paint(); } });
        dlg.addEventListener('close', function () { dlg.remove(); resolve(); });
        paint(); dlg.showModal();
      });
    });
  }

  /* ---------- which folder? ---------- */
  function ask(intro, cands) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>Which folder?</h3><p>' + esc(intro) + '</p><div class="flist">' + cands.map(function (c, i) {
        return '<label><input type="radio" name="fpick" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(F.labelOf(c)) + '</span></label>';
      }).join('') + '</div><div class="fbtns"><button type="button" class="btn ghost small" data-no>Choose where to save instead</button><button type="button" class="btn small" data-yes>Save here</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-yes]')) end(cands[+dlg.querySelector('input[name="fpick"]:checked').value]);
        if (e.target.closest('[data-no]')) end(null);
      });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end(null); });
      dlg.showModal();
    });
  }
  /* A yes / no question as a dialog (not window.confirm, which leaves the page without a fresh click for the Save window that may follow a No). */
  function yesNo(title, lines, yes, no) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog'), done = false; dlg.className = 'fdlg';
      dlg.innerHTML = '<h3>' + esc(title) + '</h3>' + lines.map(function (l) { return '<p class="fline">' + esc(l) + '</p>'; }).join('') +
        '<div class="fbtns"><button type="button" class="btn ghost small" data-no>' + esc(no) + '</button><button type="button" class="btn small" data-yes>' + esc(yes) + '</button></div>';
      document.body.appendChild(dlg);
      function end(v) { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); }
      dlg.addEventListener('click', function (e) { if (e.target.closest('[data-yes]')) end(true); if (e.target.closest('[data-no]')) end(false); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); end(false); });
      dlg.showModal();
    });
  }
  function toastButton(text, label, fn) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = text + ' ';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'toastbtn'; b.textContent = label; b.onclick = function () { t.hidden = true; fn(); };
    t.appendChild(b); t.hidden = false;
    clearTimeout(t._fx); t._fx = setTimeout(function () { t.hidden = true; }, 30000);
  }
  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) { var t = setTimeout(function () { reject(new Error('looking through the folders took too long')); }, ms); p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); }); });
  }
  function keyOf(info) { return JSON.stringify([info.kind || '', F.norm(info.sname), F.norm(info.fname), (info.insurers || [])[0] || '', (info.products || []).join(' '), (info.kinds || []).join(' '), info.premium || 0]); }

  /* ---------- the flow of a first Save ----------
     ctx: { kind: 'factfind' for the Fact Find (its "2. Fact Find" folder, no deal folder), info, name, hints: [file handles], sibling: the saved file (a PDF goes beside it), openedHandle, picker(startIn), toast(text, ms), retry(), startedAt }
     Resolves { handle, folder: { label, apps, name, created, key } | null }; rejects AbortError when the adviser has been told to click again. */
  async function open(ctx) {
    var started = ctx.startedAt || Date.now(), activation = started, key = keyOf(ctx.info), ff = ctx.kind === 'factfind', ov = ctx.kind === 'overview', made = false;
    async function fallback(reason, deepest, needsClick) {
      if (reason) ctx.toast(reason, 20000);
      if (reason && (needsClick || Date.now() - activation > 3000)) {                       // the browser's Save window needs a fresh click: a slow search or a prompt has used this one up
        toastButton(reason, 'Choose where to save', function () { ctx.retry(); });
        throw abort();
      }
      return { handle: await ctx.picker(deepest || null), folder: null };
    }
    await load();
    var all = withPaths(), keys = Object.keys(all);
    if (!F.enabled() || !keys.length) return { handle: await ctx.picker(null), folder: null };            // not connected: the normal Save window
    var liveRoots = {};
    for (var i = 0; i < keys.length; i++) {
      var st = await F.permission(all[keys[i]].handle, true);
      if (st === 'granted') liveRoots[keys[i]] = all[keys[i]];
    }
    if (!Object.keys(liveRoots).length) return fallback('Chrome has not given this page access to your client folders. Click Folders… and choose them again, and Allow when Chrome asks.', null, true);
    var cand = null, rootKey = null, rel = null, apps = null, label = '', cached = cache[key];
    try {
      if (ctx.sibling) {                                                                         // a PDF beside the saved file
        var sib = await F.dirOfFile(liveRoots, ctx.sibling, ov ? F.RULES.year : ff ? F.RULES.factFind : undefined);
        if (sib) { apps = sib.handle; rootKey = sib.rootKey; rel = sib.parts; label = sib.parts.join(' \\ '); }
      }
      if (!apps) {
        var res = cached ? { pick: cached, reason: 'cached' } : await withTimeout(ov ? F.resolveOverview(liveRoots, ctx.info, { hints: ctx.hints || [] }) : ff ? F.resolveFactFind(liveRoots, ctx.info, { hints: ctx.hints || [] }) : F.resolveTarget(liveRoots, ctx.info, { hints: ctx.hints || [] }), 25000);
        if (res.reason === 'names') return fallback('Fill in the client\u2019s names first, so the page can find the client\u2019s folder. Choose where to save instead.', res.deepest || null);
        if (res.reason === 'client') return fallback('No folder named \u201c' + F.clientFolderName(ctx.info.sname, ctx.info.fname) + '\u201d was found in your connected folders. Choose where to save instead.', res.deepest || null);
        if (res.reason === 'ff') return fallback('The client\u2019s folder has no \u201c2. Fact Find\u201d folder yet, and this page never creates a folder. Choose where to save instead.', res.deepest);
        if (res.reason === 'deal') return fallback('The client\u2019s folder has no deal folder with an Applications folder in it. Choose where to save instead.', res.deepest);
        if (res.ask) {
          var chosen = await ask(ov ? 'The client has a folder in more than one place. Pick the right one (nothing is saved or created until you do).' : ff ? 'More than one \u201c2. Fact Find\u201d folder could be this client\u2019s. Pick the right one (nothing is saved until you do).' : 'More than one folder could be this application\u2019s. Pick the right one (nothing is saved until you do).', res.ask);
          activation = Date.now();
          if (!chosen) return fallback('', res.deepest);
          cand = chosen;
        } else {
          cand = res.pick;
          if (res.reason === 'best' && !cache[key + '|ok']) {
            var yes = await yesNo('Save to this folder?', [F.labelOf(cand)], 'Save here', 'Choose where to save instead'); activation = Date.now();
            if (!yes) return fallback('', cand.apps);
          }
        }
        cache[key] = cand; cache[key + '|ok'] = true;
        apps = cand.apps; rootKey = cand.client.rootKey; rel = F.relOf(cand); label = F.labelOf(cand);
      }
      var chk = F.pathCheck((all[rootKey] || {}).path, rel, ctx.name);
      if (chk.known && !chk.ok) return fallback(F.tooLongText(chk, ctx.name), apps || (cand && cand.client && cand.client.handle));
      if (ov && !apps) { apps = await F.ensureOverview(cand); made = true; cand.apps = apps; }                  // the one folder this page makes: 1. Overview and the year, inside the client's folder, after the path length is known to fit
      var probe = await F.probeFile(apps, ctx.name, ctx.openedHandle), handle, created = false;
      if (probe.exists && !probe.same) {
        var rep = await yesNo('Replace the existing file?', ['A file with this name is already in ' + label + ':', ctx.name], 'Replace it', 'Keep it and choose where to save'); activation = Date.now();
        if (!rep) return fallback('The existing file was kept. Choose another folder or name.', apps);
      }
      if (probe.exists) handle = probe.handle; else { handle = await F.makeFile(apps, ctx.name); created = true; }
      return { handle: handle, folder: { label: label + (made ? ' (the folder was made)' : ''), apps: apps, name: ctx.name, created: created, key: key, unchecked: !chk.known, madeFolder: made } };
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      delete cache[key]; delete cache[key + '|ok'];
      return fallback('Could not look through your client folders (' + (e && e.message ? e.message : 'unknown') + '). Choose where to save instead.', null);
    }
  }
  /* A write into the folder failed: an empty file this save created is removed, and the folder is looked for again next time. */
  function failed(folder) { if (!folder) return Promise.resolve(false); delete cache[folder.key]; delete cache[folder.key + '|ok']; return folder.created ? F.discardEmpty(folder.apps, folder.name) : Promise.resolve(false); }
  /* How long each step of a folder search may take before the page says so instead of waiting for ever (milliseconds; Client Overview Studio 0.96: the search had no limit, and a permission question Chrome was still waiting on, or a slow OneDrive
     folder, left "Looking for the client's folder..." on the screen for good). The tests make them short. */
  var TIMEOUTS = { permission: 45000, find: 45000, list: 60000, walk: 15000, stopLink: 8000, askAgain: 4000, askNext: 3000, queryWait: 1200, autoPick: 2500 };
  var SLOW = { slow: true };
  function race(p, ms) { return new Promise(function (resolve, reject) { var t = setTimeout(function () { resolve(SLOW); }, ms); Promise.resolve(p).then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); }); }); }
  /* One connected folder's state, asked for NOW (in the click's own turn): 'granted', 'prompt' or 'denied'; fail(text) hears why Chrome refused (Client Overview Studio 0.97). */
  function whyText(e) { return ((e && e.name) || 'Error') + (e && e.message ? ': ' + e.message : ''); }
  function queryRoot(h, fail) {
    try { return Promise.resolve(h.queryPermission ? h.queryPermission({ mode: 'readwrite' }) : 'granted').catch(function (e) { if (fail) fail(whyText(e)); return 'denied'; }); }
    catch (e) { if (fail) fail(whyText(e)); return Promise.resolve('denied'); }
  }
  function requestRoot(h, fail) {
    try { return Promise.resolve(h.requestPermission({ mode: 'readwrite' })).catch(function (e) { if (fail) fail(whyText(e)); return 'denied'; }); }
    catch (e) { if (fail) fail(whyText(e)); return Promise.resolve('denied'); }
  }
  var PERM_WORD = { asking: 'checking', prompt: 'waiting for your answer', granted: 'allowed', denied: 'not allowed', slow: 'no answer' };
  /* The connected folders Chrome lets this page read. 0.97: every folder is asked about at the same moment, so a folder that is already open never waits behind one Chrome is still asking about; with ask true (a click behind it) a folder that
     is not open is then asked for, one after the other as before. opts.early: resolves as soon as ONE folder is open ({ live, rest } where rest is a promise of the final set); otherwise when every folder has answered.
     opts.onPerm(states, why) hears each folder's state as it changes ({ 'New Business': 'allowed', ... }; why: what Chrome said when it refused).
     Resolves { live, rest, why } or { reason: 'connect' | 'access' | 'slow-find' | 'slow-permission', why }. */
  async function liveRoots(ask, say, opts) {
    var T = TIMEOUTS, early = !!(opts && opts.early); say('permission');
    var o = await race(load(), T.find); if (o === SLOW) return { reason: 'slow-find' };
    var all = withPaths(), keys = Object.keys(all);
    if (!F.enabled() || !keys.length) return { reason: 'connect' };
    var live = {}, st = {}, why = {}, last = null, deadline = Date.now() + T.permission, left = function () { return Math.max(1, deadline - Date.now()); };      // one limit for all the questions together
    function tell() { if (opts && opts.onPerm) { var sv = {}; keys.forEach(function (k) { sv[LABEL[k]] = PERM_WORD[st[k]] || st[k]; }); opts.onPerm(sv, why); } }
    var queries = keys.map(function (k) { st[k] = 'asking'; return race(queryRoot(all[k].handle, function (t) { why[k] = t; }), left()); });
    tell();
    var WAIT = { wait: true };
    var asks = keys.map(function (k, i) {
      var q = queries[i], quick = Promise.race([q, new Promise(function (r) { setTimeout(function () { r(WAIT); }, T.queryWait || 1200); })]);
      return quick.then(function (first) {
        if (first === SLOW || first === 'granted') return first;
        if (!ask) return first === WAIT ? q : first;
        /* Chrome says "not yet", or has not answered "is this folder open?" at all (Client Overview Studio 0.98: on Paul's screen both folders stayed at "checking" and, because the question was only asked after that answer, it was never asked):
           the question is asked now, while the click is still fresh, and whichever answer comes first counts. */
        if (first !== WAIT) { st[k] = 'prompt'; tell(); }
        var gate = first === WAIT || !last ? Promise.resolve() : Promise.race([last, new Promise(function (r) { setTimeout(r, T.askNext || 3000); })]);          // the next folder is asked after this one has answered, or after a few seconds, so a question Chrome never shows cannot hold the next one back
        var mine = gate.then(function () { return race(requestRoot(all[k].handle, function (t) { why[k] = t; }), left()); });
        last = mine.then(function () {}, function () {});
        return first === WAIT ? Promise.race([q.then(function (x) { return x === 'granted' ? x : mine; }), mine]) : mine;
      }).then(function (q) { q = q === SLOW ? 'slow' : q; st[k] = q; if (q === 'granted') live[k] = all[k]; tell(); return q; });
    });
    var finished = Promise.all(asks), firstOpen = new Promise(function (res) { asks.forEach(function (p) { p.then(function (q) { if (q === 'granted') res(); }); }); });
    await (early ? Promise.race([firstOpen, finished]) : finished);
    if (Object.keys(live).length) return { live: Object.assign({}, live), rest: finished.then(function () { return Object.assign({}, live); }), why: why };
    return { reason: keys.some(function (k) { return st[k] === 'slow'; }) ? 'slow-permission' : 'access', why: why };
  }
  /* The client's folders in the folders that are open; when there are none there and some folders are still being asked about, those are waited for (up to the permission limit) and searched too.
     Resolves { clients, skipped } (skipped: the folders that were not open, by name) or { slow: true }. */
  async function findInOpen(r, info, say) {
    var T = TIMEOUTS; say('find');
    var clients = await race(F.findClients(r.live, info.sname, info.fname), T.find);
    if (clients === SLOW) return { slow: true };
    var final = r.live;
    if (!clients.length && r.rest) {
      say('permission'); var fin = await race(r.rest, T.permission);
      if (fin !== SLOW) {
        final = fin; var more = {};
        Object.keys(fin).forEach(function (k) { if (!r.live[k]) more[k] = fin[k]; });
        if (Object.keys(more).length) { say('find'); var extra = await race(F.findClients(more, info.sname, info.fname), T.find); if (extra === SLOW) return { slow: true }; clients = extra; }
      }
    }
    return { clients: clients, skipped: Object.keys(withPaths()).filter(function (k) { return !final[k]; }).map(function (k) { return LABEL[k]; }) };
  }
  /* The documents of the client's folder for the Client Overview's "Load from client folder": the connected folders are searched for the client, as for a Save, and the files that can be read are listed. Reads only.
     opts.onStage(stage) hears 'permission', 'find' and 'list' as the search goes on; opts.onPerm(states, why) hears what Chrome says about each folder. The list opens as soon as ONE connected folder is open (0.97).
     Resolves { label, files: [{ name, rel, handle }], skipped } or { reason: 'connect' | 'access' | 'names' | 'client' | 'slow-permission' | 'slow-find' | 'slow-list', why, skipped }. */
  async function clientFiles(info, opts) {
    var say = (opts && opts.onStage) || function () {}, T = TIMEOUTS, r = await liveRoots(true, say, { early: true, onPerm: opts && opts.onPerm });
    if (r.reason) return { reason: r.reason, why: r.why };
    if (F.norm(info.sname) === '') return { reason: 'names' };
    var f = await findInOpen(r, info, say);
    if (f.slow) return { reason: 'slow-find' };
    var clients = f.clients;
    if (!clients.length) return { reason: 'client', skipped: f.skipped };
    say('list'); var files = [];
    for (var c = 0; c < clients.length; c++) { var fs = await race(F.clientDocuments(clients[c]), T.list); if (fs === SLOW) return { reason: 'slow-list' }; files = files.concat(fs); }
    return { label: clients[0].parts.join(' \\ '), files: files, skipped: f.skipped };
  }
  /* The adviser picks the client's OWN folder in the browser's folder window (a click behind it): choosing it is the permission, so Chrome asks nothing else. For when Chrome will not ask about the connected folders. No starting folder is passed (a stored folder is the thing Chrome may not be answering about): Chrome opens the window where it was last used. Resolves { label, files, picked: true } or { reason: 'cancelled' | 'unsupported' | 'error' | 'slow-list', why }. */
  async function pickClientFolder() {
    if (!F.enabled()) return { reason: 'unsupported' };
    var opts = { id: 'wr-client-folder', mode: 'read' };                                       // no starting folder is passed: a stored folder is the very thing Chrome may not be answering about; Chrome opens the window where it was last used for this id
    var h; try { h = await window.showDirectoryPicker(opts); } catch (e) { return e && e.name === 'AbortError' ? { reason: 'cancelled' } : { reason: 'error', why: whyText(e) }; }
    var files = await race(F.clientDocuments({ handle: h, parts: [h.name] }), TIMEOUTS.list);
    if (files === SLOW) return { reason: 'slow-list' };
    return { label: h.name, files: files, picked: true };
  }
  /* The client's subfolder for a kind of document, for "Upload from client folder" (Client Overview Studio 0.6): the connected folders are searched for the client, as for a Save, and the folder where that kind of
     document is kept (or the client's folder) is returned so the file window can open in it. Reads only. Resolves { handle, label, several } or { reason: 'connect' | 'access' | 'names' | 'client' | 'slow-permission' | 'slow-find' | 'slow-list', why, skipped }. */
  async function clientFolder(info, kind, opts) {
    var say = (opts && opts.onStage) || function () {}, T = TIMEOUTS, r = await liveRoots(true, say, { early: true, onPerm: opts && opts.onPerm });
    if (r.reason) return { reason: r.reason, why: r.why };
    if (F.norm(info.sname) === '') return { reason: 'names' };
    var f = await findInOpen(r, info, say);
    if (f.slow) return { reason: 'slow-find' };
    var clients = f.clients;
    if (!clients.length) return { reason: 'client', skipped: f.skipped };
    say('list'); var sub = await race(F.clientSubfolder(clients[0], kind), T.list);
    if (sub === SLOW) return { reason: 'slow-list' };
    return { handle: sub.handle, label: sub.parts.join(' \\ '), several: clients.length > 1 };
  }
  /* A small file kept at the top of a connected folder (the Presentation's key-points library, `wr-keypoints.json`): New Business first, then Client Files. Reads only. The browser is asked for a folder's permission
     only when ask is true (a click is behind it); otherwise only a folder that is already open to this page is read. Resolves { text, from } or null. */
  async function rootFile(name, ask) {
    await load();
    var all = withPaths(), keys = Object.keys(all);
    if (!F.enabled() || !keys.length) return null;
    for (var i = 0; i < keys.length; i++) {
      var h = all[keys[i]].handle;
      var q = await race(F.permission(h, !!ask), TIMEOUTS.permission); if (q === SLOW) return null;                      // a question Chrome is still waiting on never holds the page up
      if (q !== 'granted') continue;
      try { var f = await (await h.getFileHandle(name)).getFile(); return { text: await f.text(), from: LABEL[keys[i]] }; } catch (e) { /* not in this folder */ }
    }
    return null;
  }
  /* The client's files for the View buttons (Client Overview Studio 0.95): the connected folders are searched for the client, as for a Save, and the PDFs and pictures under the client's folder are listed. Reads only; kept for the visit
     (forgetIndex or a new client starts again). The browser is asked for a folder's permission only when opts.ask is true (a click is behind it). **0.96: the walk stops after TIMEOUTS.walk milliseconds** and hands back what it found with
     partial: true. Resolves { label, files: [{ name, rel, handle }], partial } or { reason: 'connect' | 'access' | 'names' | 'client' | 'slow-permission' | 'slow-find' }. */
  var idxCache = {};
  async function clientIndex(info, opts) {
    var ask = opts === true || !!(opts && opts.ask), say = (opts && opts.onStage) || function () {}, T = TIMEOUTS, r = await liveRoots(ask, say, { early: true, onPerm: opts && opts.onPerm });
    if (r.reason) return { reason: r.reason, why: r.why };
    if (F.norm(info.sname) === '') return { reason: 'names' };
    var key = F.norm(info.sname) + '|' + F.norm(info.fname);
    if (idxCache[key]) return idxCache[key];
    var fi = await findInOpen(r, info, say);
    if (fi.slow) return { reason: 'slow-find' };
    var clients = fi.clients;
    if (!clients.length) return { reason: 'client', skipped: fi.skipped };
    say('walk'); var files = [], partial = false;
    for (var c = 0; c < clients.length; c++) {
      var sink = [], one = await race(F.viewableFiles(clients[c], { sink: sink, ms: T.walk }), T.walk + 2000);
      files = files.concat(one === SLOW ? sink : one); if (one === SLOW || one.partial) partial = true;
    }
    return (idxCache[key] = { label: clients[0].parts.join(' \\ '), files: files, partial: partial });
  }
  function forgetIndex() { idxCache = {}; }
  function forget() { cache = {}; idxCache = {}; }
  function metaHTML(lastFolder) {
    var k = Object.keys(roots), line = !F.enabled() ? '' : k.length ? 'Folders connected: ' + k.map(function (x) { return LABEL[x]; }).join(', ') + '.' : 'Folders not connected: Save asks where to save. Click <b>Folders&hellip;</b> to connect them.';
    return (lastFolder ? '<div>Saved in <b>' + esc(lastFolder) + '</b></div>' : '') + (line ? '<div class="fnote">' + line + '</div>' : '');
  }

  FF.foldersUI = { init: init, connect: connect, open: open, clientFiles: clientFiles, clientFolder: clientFolder, pickClientFolder: pickClientFolder, clientIndex: clientIndex, forgetIndex: forgetIndex, timeouts: TIMEOUTS, rootFile: rootFile, failed: failed, forget: forget, metaHTML: metaHTML, ask: ask, connected: function () { return Object.keys(roots); } };
})();
