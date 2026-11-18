/* Saving straight into the client's Applications folder (Risk Application 1.4, Investment Application 1.3).
   The adviser connects two folders once (New Business and Client Files, each picked with showDirectoryPicker, the handles kept in this browser). On a first Save the page walks them READ-ONLY, never creating,
   renaming, moving or deleting a folder (the folder names belong to the complete-applications-skill):
     1. the client's folder "<Surname>, <First names>" (ignoring case, accents, punctuation and repeated spaces; the first names match by prefix, "Anna" is in "Anna Maria") in New Business (its top level, "1. ON HOLD",
        "2. Awaiting compliance from client") and in Client Files (the top level and "<first letter of the surname AS WRITTEN> - Files", so "V - Files" for Van der Merwe); when the Fact Find (or an application) that was
        loaded lies inside a connected folder, root.resolve() gives the client's folder exactly and no name is needed;
     2. inside it, the deal folder: any subfolder that holds an "Applications" folder, except the numbered standard folders ("1. Overview" ... "7. All in one Compliance") and the older unnamed folder with the client's
        own name. The old name with the client's name in it, the shorter one without it and "- (Fact Find)" all work. When there are several, they are scored on the insurer (the page's own abbr plus the aliases below),
        the product word, the kind (recurring / lump sum) and the premium; one clear winner is taken, otherwise the adviser picks;
     3. before writing, the Windows path limit: root path (typed once by the adviser) + the folders + the file name + 7 (Chrome's ".crswap") must not pass 259 characters, or nothing is written.
   Everything here is plain logic that can be tested without a browser; the screens are in folders-ui.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.folders = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var MAX_PATH = 259, SWAP = 7;
  var RULES = {
    applications: 'Applications',
    standard: /^\d+\.\s/,                                                      // the numbered standard folders in a client's folder
    holdA: [/^1\.\s*on hold/, /^2\.\s*awaiting compliance/],                   // the two folders in New Business that also hold clients (names as normalised)
    letterSuffix: ' - Files'
  };
  /* How an insurer is written in a folder name: the page's own abbr first (OM, BR), then these older or longer spellings. Tell the skill's owner when a spelling is missing: this is the only table to change. */
  var ALIASES = {
    'Old Mutual': ['OM', 'Old Mutual'], 'Brightrock': ['BR', 'BrightRock'], 'BrightRock': ['BR', 'BrightRock'], 'Discovery': ['DISC', 'Disc', 'Discovery'], 'Momentum': ['Momentum', 'MOM'],
    'Liberty': ['Liberty', 'LIB'], 'Sanlam': ['Sanlam', 'SAN'], 'Stanlib': ['Stanlib'], 'Allan Gray': ['Allan Gray', 'AG'], 'Hollard Life': ['Hollard'], 'Absa Life': ['Absa'], 'Assupol': ['Assupol'],
    'Clientele': ['Clientele'], 'Metropolitan': ['Metropolitan', 'Metlife'], 'PPS': ['PPS'], '1Life': ['1Life']
  };
  var STOP = { cover: 1, covers: 1, life: 1, and: 1, the: 1, for: 1, plan: 1, application: 1, of: 1, to: 1, in: 1 };

  /* ---------- names ---------- */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  }
  function tokens(s) { return norm(s).split(/[^a-z0-9']+/).filter(Boolean); }
  function clientFolderName(sname, fname) { return String(sname || '').trim() + ', ' + String(fname || '').trim(); }
  function parseClient(name) {
    var i = String(name).indexOf(',');
    return i > 0 ? { sname: name.slice(0, i).trim(), fname: name.slice(i + 1).trim() } : null;
  }
  /* "Kuiper, Annabel" is the client Kuiper / Annabel Maria: the surname is the same, the first names agree as far as the shorter list goes. */
  function clientMatches(folderName, sname, fname) {
    var p = parseClient(folderName); if (!p || norm(sname) === '') return false;
    if (norm(p.sname) !== norm(sname)) return false;
    var a = tokens(p.fname), b = tokens(fname);
    if (!a.length || !b.length) return a.length === b.length;
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function letterOf(sname) { var m = /[a-z]/.exec(norm(sname)); return m ? m[0].toUpperCase() : ''; }
  function letterFolder(sname) { var l = letterOf(sname); return l ? l + RULES.letterSuffix : ''; }
  function isLetterFolder(name) { return /^[a-z] - files$/.test(norm(name)); }
  function isStandard(name) { return RULES.standard.test(String(name)); }

  /* ---------- scoring the deal folders ---------- */
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hasWord(n, w) { w = norm(w); return w !== '' && new RegExp('(^|[^a-z0-9])' + esc(w) + '(?![a-z0-9])').test(n); }
  function insurerWords(name, abbr) {
    var out = []; function add(x) { if (x && out.map(norm).indexOf(norm(x)) < 0) out.push(x); }
    if (abbr && abbr[name]) add(abbr[name]);
    (ALIASES[name] || []).forEach(add); add(name);
    return out;
  }
  function allAliases() { var s = {}; Object.keys(ALIASES).forEach(function (k) { ALIASES[k].concat([k]).forEach(function (w) { s[norm(w)] = k; }); }); return s; }
  function productWords(text) {
    return tokens(text).filter(function (w) { return w.length >= 2 && !STOP[w]; });
  }
  function numbersIn(name) {
    var out = [], re = /r\s*([0-9][0-9\s,]*(?:\.[0-9]{1,2})?)/g, m, s = norm(name);
    while ((m = re.exec(s))) { var v = parseFloat(m[1].replace(/[\s,]/g, '')); if (!isNaN(v)) out.push(v); }
    return out;
  }
  /* info: { insurers: [spellings], products: [words], kinds: [words], premium: number }. Insurer 3, product 3, premium 2, kind 1. conflict: the folder names another insurer and not this one. */
  function scoreDeal(name, info) {
    var n = norm(name), ins = (info.insurers || []).filter(Boolean), score = 0, r = { insurer: false, product: false, premium: false, kind: false, conflict: false };
    if (ins.length && ins.some(function (w) { return hasWord(n, w); })) { r.insurer = true; score += 3; }
    if ((info.products || []).some(function (w) { return hasWord(n, w); })) { r.product = true; score += 3; }
    if ((info.kinds || []).some(function (w) { return hasWord(n, w); })) { r.kind = true; score += 1; }
    if (info.premium > 0 && numbersIn(name).some(function (v) { return Math.abs(v - info.premium) < 0.005; })) { r.premium = true; score += 2; }
    if (ins.length && !r.insurer) {
      var own = {}; ins.forEach(function (w) { own[norm(w)] = 1; });
      var al = allAliases();
      r.conflict = Object.keys(al).some(function (w) { return !own[w] && hasWord(n, w); });
    }
    r.score = score;
    return r;
  }
  /* cands: [{ name, ... }]. Returns { pick, reason } (reason 'only' or 'best'), { ask: [candidates best first] } or { none: true }. */
  function chooseDeal(cands, info) {
    if (!cands.length) return { none: true };
    var sc = cands.map(function (c) { var r = scoreDeal(c.name, info); return { c: c, r: r }; });
    if (sc.length === 1) return sc[0].r.conflict ? { ask: [sc[0].c] } : { pick: sc[0].c, reason: 'only' };
    sc.sort(function (a, b) { return b.r.score - a.r.score || (a.c.name < b.c.name ? -1 : 1); });
    if (sc[0].r.score >= 3 && sc[0].r.score - sc[1].r.score >= 2 && !sc[0].r.conflict) return { pick: sc[0].c, reason: 'best' };
    return { ask: sc.map(function (x) { return x.c; }) };
  }

  /* ---------- the Windows path limit ---------- */
  /* rootPath: the folder's Windows path as the adviser typed it; rel: the folder names below it; the file name. Chrome writes "<file>.crswap" first, so that is the path that must fit. */
  function pathCheck(rootPath, rel, fileName) {
    var rp = String(rootPath || '').trim().replace(/[\\\/]+$/, '');
    if (!rp) return { known: false, ok: true };
    var full = rp + '\\' + rel.concat([fileName]).join('\\'), swap = full.length + SWAP, over = Math.max(0, swap - MAX_PATH);
    var longest = rel.map(function (n) { return { name: n, len: n.length }; }).sort(function (a, b) { return b.len - a.len; })[0] || null;
    return { known: true, ok: over === 0, length: full.length, swap: swap, over: over, rootLen: rp.length, fileLen: fileName.length, longest: longest };
  }
  function tooLongText(chk, fileName) {
    return 'The path to this file would be ' + chk.over + ' characters too long for Windows (it allows ' + (MAX_PATH + 1) + ' in all, and Chrome needs 7 more to write a file): the connected folder is ' + chk.rootLen +
      ' characters, the file name ' + chk.fileLen + (chk.longest ? ', and the longest folder name is ' + chk.longest.len + ' ("' + chk.longest.name + '")' : '') + '. Nothing was written there. Shorten a folder name by at least ' + chk.over + ' characters, or save somewhere with a shorter path.';
  }

  /* ---------- walking the folders (handles from the File System Access API) ---------- */
  async function listDirs(dir) {
    var out = [];
    for await (var e of dir.entries()) if (e[1].kind === 'directory') out.push({ name: e[0], handle: e[1] });
    return out;
  }
  /* roots: { A: { handle, path }, B: { handle, path } } (either may be missing). Every folder that matches the client, in every place, with where it was found. */
  async function findClients(roots, sname, fname) {
    var found = [];
    function scanInto(rootKey, kids, parts) {
      kids.forEach(function (k) { if (clientMatches(k.name, sname, fname)) found.push({ rootKey: rootKey, parts: parts.concat([k.name]), handle: k.handle }); });
    }
    if (roots.A) {
      var top = await listDirs(roots.A.handle); scanInto('A', top, []);
      for (var i = 0; i < RULES.holdA.length; i++) {
        var h = top.filter(function (k) { return RULES.holdA[i].test(norm(k.name)); })[0];
        if (h) scanInto('A', await listDirs(h.handle), [h.name]);
      }
    }
    if (roots.B) {
      var topB = await listDirs(roots.B.handle); scanInto('B', topB, []);
      var want = norm(letterFolder(sname)), lf = topB.filter(function (k) { return norm(k.name) === want; })[0];
      if (lf) scanInto('B', await listDirs(lf.handle), [lf.name]);
      if (!found.some(function (f) { return f.rootKey === 'B'; })) {                      // last resort: the other letter folders
        var others = topB.filter(function (k) { return isLetterFolder(k.name) && k !== lf; });
        for (var j = 0; j < others.length; j++) scanInto('B', await listDirs(others[j].handle), [others[j].name]);
      }
    }
    return found;
  }
  /* The client's folder from a file that lies inside a connected folder (the Fact Find that was loaded): root.resolve() gives its path, and the client is the folder on it whose name matches. */
  async function clientFromFile(roots, fileHandle, sname, fname) {
    var out = [];
    for (var key of ['A', 'B']) {
      if (!roots[key] || !roots[key].handle.resolve) continue;
      var parts = null; try { parts = await roots[key].handle.resolve(fileHandle); } catch (e) { parts = null; }
      if (!parts || parts.length < 2) continue;
      var dirs = parts.slice(0, -1), idx = -1;
      for (var i = 0; i < dirs.length; i++) if (clientMatches(dirs[i], sname, fname)) { idx = i; break; }
      if (idx < 0) continue;
      var h = roots[key].handle;
      for (var j = 0; j <= idx; j++) h = await h.getDirectoryHandle(dirs[j]);
      out.push({ rootKey: key, parts: dirs.slice(0, idx + 1), handle: h });
    }
    return out;
  }
  /* The folder a saved file lies in, when that is an Applications folder inside a connected folder: a PDF goes beside the saved file. */
  async function dirOfFile(roots, fileHandle) {
    for (var key of ['A', 'B']) {
      if (!roots[key] || !roots[key].handle.resolve) continue;
      var parts = null; try { parts = await roots[key].handle.resolve(fileHandle); } catch (e) { parts = null; }
      if (!parts || parts.length < 2) continue;
      var dirs = parts.slice(0, -1), h = roots[key].handle;
      if (norm(dirs[dirs.length - 1]) !== norm(RULES.applications)) return null;
      for (var j = 0; j < dirs.length; j++) h = await h.getDirectoryHandle(dirs[j]);
      return { rootKey: key, parts: dirs, handle: h };
    }
    return null;
  }
  async function dealCandidates(client, sname, fname) {
    var kids = await listDirs(client.handle), out = [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (isStandard(k.name) || norm(k.name) === norm(clientFolderName(sname, fname)) || norm(k.name) === norm(client.parts[client.parts.length - 1])) continue;
      var inner = await listDirs(k.handle), apps = inner.filter(function (x) { return norm(x.name) === norm(RULES.applications); })[0];
      if (apps) out.push({ name: k.name, handle: k.handle, apps: apps.handle, appsName: apps.name, client: client });
    }
    return out;
  }
  function relOf(cand) { return cand.client.parts.concat([cand.name, cand.appsName]); }
  function labelOf(cand) { return relOf(cand).join(' \\ '); }
  /* The whole search. opts.hints: file handles (the loaded Fact Find, a loaded application) that may lie inside a connected folder.
     Returns { pick: candidate, reason } | { ask: [candidates] } | { reason: 'client' | 'deal' | 'names', deepest }. */
  async function resolveTarget(roots, info, opts) {
    opts = opts || {};
    if (norm(info.sname) === '') return { reason: 'names' };
    var clients = [];
    for (var i = 0; i < (opts.hints || []).length; i++) {
      var got = await clientFromFile(roots, opts.hints[i], info.sname, info.fname);
      got.forEach(function (c) { if (!clients.some(function (x) { return x.rootKey === c.rootKey && x.parts.join('/') === c.parts.join('/'); })) clients.push(c); });
    }
    if (!clients.length) clients = await findClients(roots, info.sname, info.fname);
    if (!clients.length) return { reason: 'client' };
    var cands = [];
    for (var c = 0; c < clients.length; c++) cands = cands.concat(await dealCandidates(clients[c], info.sname, info.fname));
    if (!cands.length) return { reason: 'deal', deepest: clients[0].handle };
    var choice = chooseDeal(cands, info);
    choice.deepest = clients[0].handle;
    return choice;
  }

  /* ---------- the file ---------- */
  async function probeFile(apps, name, openedHandle) {
    var existing = null;
    try { existing = await apps.getFileHandle(name); } catch (e) { if (!e || e.name !== 'NotFoundError') throw e; }
    if (!existing) return { exists: false, same: false };
    var same = false; try { same = !!(openedHandle && await existing.isSameEntry(openedHandle)); } catch (e) { same = false; }
    return { exists: true, same: same, handle: existing };
  }
  async function makeFile(apps, name) { return apps.getFileHandle(name, { create: true }); }
  /* After a failed write: an EMPTY file that this same save created is removed (never a folder, never a file with content, never a file the page did not create). */
  async function discardEmpty(apps, name) {
    try { var f = await (await apps.getFileHandle(name)).getFile(); if (f.size === 0) { await apps.removeEntry(name); return true; } } catch (e) { /* best effort */ }
    return false;
  }

  /* ---------- what the browser keeps: the two handles (IndexedDB) and the two paths the adviser typed (localStorage) ---------- */
  var DB = 'wr-folders', STORE = 'roots', PATHS = 'wr-folders-paths';
  function idb(fn) {
    return new Promise(function (resolve) {
      if (typeof indexedDB === 'undefined') return resolve(null);
      try {
        var o = indexedDB.open(DB, 1);
        o.onupgradeneeded = function () { o.result.createObjectStore(STORE); };
        o.onerror = function () { resolve(null); };
        o.onsuccess = function () { try { fn(o.result.transaction(STORE, 'readwrite').objectStore(STORE), resolve); } catch (e) { resolve(null); } };
      } catch (e) { resolve(null); }
    });
  }
  function saveHandle(key, handle) { return idb(function (st, done) { var r = handle ? st.put(handle, key) : st.delete(key); r.onsuccess = function () { done(true); }; r.onerror = function () { done(null); }; }); }
  function loadHandle(key) { return idb(function (st, done) { var r = st.get(key); r.onsuccess = function () { done(r.result || null); }; r.onerror = function () { done(null); }; }); }
  function getPaths() { try { return JSON.parse(localStorage.getItem(PATHS) || '{}') || {}; } catch (e) { return {}; } }
  function setPath(key, value) { try { var p = getPaths(); p[key] = String(value || '').trim(); localStorage.setItem(PATHS, JSON.stringify(p)); } catch (e) { /* kept for this visit only */ } }
  /* The state of one connected folder: 'granted', 'prompt' or 'denied'. With request true and a click behind it, the browser is asked. */
  async function permission(handle, request) {
    var o = { mode: 'readwrite' };
    try {
      var q = handle.queryPermission ? await handle.queryPermission(o) : 'granted';
      if (q === 'granted' || !request) return q;
      return await handle.requestPermission(o);
    } catch (e) { return 'denied'; }
  }
  function enabled() { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; }

  return {
    MAX_PATH: MAX_PATH, SWAP: SWAP, RULES: RULES, ALIASES: ALIASES, norm: norm, tokens: tokens, clientFolderName: clientFolderName, parseClient: parseClient, clientMatches: clientMatches, letterOf: letterOf, letterFolder: letterFolder,
    isLetterFolder: isLetterFolder, isStandard: isStandard, insurerWords: insurerWords, productWords: productWords, numbersIn: numbersIn, hasWord: hasWord, scoreDeal: scoreDeal, chooseDeal: chooseDeal, pathCheck: pathCheck, tooLongText: tooLongText,
    listDirs: listDirs, findClients: findClients, clientFromFile: clientFromFile, dirOfFile: dirOfFile, dealCandidates: dealCandidates, resolveTarget: resolveTarget, relOf: relOf, labelOf: labelOf, probeFile: probeFile, makeFile: makeFile, discardEmpty: discardEmpty,
    saveHandle: saveHandle, loadHandle: loadHandle, getPaths: getPaths, setPath: setPath, permission: permission, enabled: enabled
  };
});
