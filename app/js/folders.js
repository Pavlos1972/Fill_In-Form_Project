/* Saving straight into the client's folder (Risk Application 1.4, Investment Application 1.3: the deal folder's Applications folder; Fact Find 5.2: the client's "2. Fact Find" folder).
   The adviser connects two folders once (New Business and Client Files, each picked with showDirectoryPicker, the handles kept in this browser). On a first Save the page walks them READ-ONLY, never creating,
   renaming, moving or deleting a folder (the folder names belong to the complete-applications-skill):
     1. the client's folder "<Surname>, <First names>" (ignoring case, accents, punctuation and repeated spaces; the first names match by prefix, "Anna" is in "Anna Maria") in New Business (its top level, "1. ON HOLD",
        "2. Awaiting compliance from client") and in Client Files (the top level and "<first letter of the surname AS WRITTEN> - Files", so "V - Files" for Van der Merwe); when the Fact Find (or an application) that was
        loaded lies inside a connected folder, root.resolve() gives the client's folder exactly and no name is needed;
     2. inside it, the deal folder: any subfolder that holds an "Applications" folder, except the numbered standard folders ("1. Overview" ... "7. All in one Compliance") and the older unnamed folder with the client's
        own name. The old name with the client's name in it, the shorter one without it and "- (Fact Find)" all work. When there are several, they are scored on the insurer (the page's own abbr plus the aliases below),
        the product word, the kind (recurring / lump sum) and the premium; one clear winner is taken, otherwise the adviser picks;
     2b. the Fact Find (5.2) has no deal folder: it goes into the client's own "2. Fact Find" folder, which must already be there (a first meeting may not have one yet: then the Save window opens in the deepest folder found);
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
    letterSuffix: ' - Files',
    factFind: /^2\.\s*fact find$/,                                              // the client's Fact Find folder (names as normalised); the Fact Find page saves into it (5.2)
    overview: /^1\.\s*overview$/,                                               // the client's Overview folder, with a folder for each year inside it (the Client Overview page, 5.4)
    year: /^\d{4}$/
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
  function nameIs(name, want) { return want instanceof RegExp ? want.test(norm(name)) : norm(name) === norm(want); }

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
  /* The folder a saved file lies in, when that folder is the wanted one (default: an Applications folder; the Fact Find passes RULES.factFind) inside a connected folder: a PDF goes beside the saved file. */
  async function dirOfFile(roots, fileHandle, want) {
    want = want || RULES.applications;
    for (var key of ['A', 'B']) {
      if (!roots[key] || !roots[key].handle.resolve) continue;
      var parts = null; try { parts = await roots[key].handle.resolve(fileHandle); } catch (e) { parts = null; }
      if (!parts || parts.length < 2) continue;
      var dirs = parts.slice(0, -1), h = roots[key].handle;
      if (!nameIs(dirs[dirs.length - 1], want)) return null;
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
  function relOf(cand) { return cand.rel || cand.client.parts.concat([cand.name, cand.appsName]); }
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

  /* The Fact Find (5.2): the client's own "2. Fact Find" folder, directly inside the client's folder (no deal folder). A candidate looks like a deal candidate (apps is the folder to write into) so the screens are shared. */
  async function factFindCandidates(client) {
    var kids = await listDirs(client.handle), ff = kids.filter(function (k) { return RULES.factFind.test(norm(k.name)); })[0];
    return ff ? [{ name: ff.name, handle: ff.handle, apps: ff.handle, appsName: ff.name, client: client, rel: client.parts.concat([ff.name]) }] : [];
  }
  /* Returns { pick, reason: 'only' } | { ask: [candidates] } | { reason: 'names' | 'client' | 'ff', deepest } (deepest: where the Save window should open: the client's folder, or else the first connected root). */
  async function resolveFactFind(roots, info, opts) {
    opts = opts || {};
    var rootDeep = (roots.A && roots.A.handle) || (roots.B && roots.B.handle) || null;
    if (norm(info.sname) === '') return { reason: 'names', deepest: rootDeep };
    var clients = [];
    for (var i = 0; i < (opts.hints || []).length; i++) {
      var got = await clientFromFile(roots, opts.hints[i], info.sname, info.fname);
      got.forEach(function (c) { if (!clients.some(function (x) { return x.rootKey === c.rootKey && x.parts.join('/') === c.parts.join('/'); })) clients.push(c); });
    }
    if (!clients.length) clients = await findClients(roots, info.sname, info.fname);
    if (!clients.length) return { reason: 'client', deepest: rootDeep };
    var cands = [];
    for (var c = 0; c < clients.length; c++) cands = cands.concat(await factFindCandidates(clients[c]));
    if (!cands.length) return { reason: 'ff', deepest: clients[0].handle };
    return cands.length === 1 ? { pick: cands[0], reason: 'only', deepest: clients[0].handle } : { ask: cands, deepest: clients[0].handle };
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

  /* The Client Overview (5.4): `1. Overview\<year>` inside the client's folder. This is the ONE place a page creates folders (Paul, 21 November): when `1. Overview` or the year folder is missing it is made, but only
     inside a client folder that already exists, and nothing else is ever created, renamed, moved or deleted. A candidate looks like the others (apps is the folder to write into, null while it still has to be made). */
  async function overviewCandidate(client, year) {
    var kids = await listDirs(client.handle), ov = kids.filter(function (k) { return RULES.overview.test(norm(k.name)); })[0], ovName = ov ? ov.name : '1. Overview', yName = String(year), yh = null;
    if (ov) { var inner = await listDirs(ov.handle), y = inner.filter(function (k) { return norm(k.name) === norm(yName); })[0]; if (y) { yh = y.handle; yName = y.name; } }
    return { name: yName, handle: yh, apps: yh, appsName: yName, client: client, ovName: ovName, ovHandle: ov ? ov.handle : null, rel: client.parts.concat([ovName, yName]), make: !yh };
  }
  /* Returns { pick, reason: 'only' } | { ask: [candidates] } | { reason: 'names' | 'client', deepest }. Nothing is created here. */
  async function resolveOverview(roots, info, opts) {
    opts = opts || {};
    var rootDeep = (roots.A && roots.A.handle) || (roots.B && roots.B.handle) || null;
    if (norm(info.sname) === '') return { reason: 'names', deepest: rootDeep };
    var clients = [];
    for (var i = 0; i < (opts.hints || []).length; i++) {
      var got = await clientFromFile(roots, opts.hints[i], info.sname, info.fname);
      got.forEach(function (c) { if (!clients.some(function (x) { return x.rootKey === c.rootKey && x.parts.join('/') === c.parts.join('/'); })) clients.push(c); });
    }
    if (!clients.length) clients = await findClients(roots, info.sname, info.fname);
    if (!clients.length) return { reason: 'client', deepest: rootDeep };
    var cands = [];
    for (var c = 0; c < clients.length; c++) cands.push(await overviewCandidate(clients[c], info.year));
    return cands.length === 1 ? { pick: cands[0], reason: 'only', deepest: clients[0].handle } : { ask: cands, deepest: clients[0].handle };
  }
  /* Makes what is missing (`1. Overview`, then the year) inside the client's folder and returns the year folder. Only called after the path length has been checked. */
  async function ensureOverview(cand) {
    if (cand.apps) return cand.apps;
    var ov = cand.ovHandle || await cand.client.handle.getDirectoryHandle(cand.ovName, { create: true });
    return ov.getDirectoryHandle(cand.appsName, { create: true });
  }

  /* The documents the Client Overview can use, found in a client's folder (stage 4): the files of `6. Policy Schedules`, of `5. Astute` (and of its latest year folder) and of any `Comparative Quotes` folder one level down
     (the quote folders). Only reads. Returns [{ name, rel: [folder names], handle }]. */
  async function clientDocuments(client, lim) {
    var out = (lim && lim.sink) || [], isMail = function (n) { return /\.(eml|msg)$/i.test(n) || (/\.txt$/i.test(n) && /e-?mail|brightrock|\d{6,}/i.test(n)); }, isDoc = function (n) { return /\.(pdf|png|jpe?g)$/i.test(n) || isMail(n); };                      // e-mails (BrightRock's, with the figures a quote does not print) are listed too
    for await (var re of client.handle.entries()) if (re[1].kind === 'file' && isMail(re[0])) out.push({ name: re[0], rel: [], handle: re[1] });          // an e-mail saved in the client's own folder
    async function files(dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && isDoc(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); }
    var kids = await listDirs(client.handle);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], nk = norm(k.name);
      if (/^\d+\.\s*policy schedules/.test(nk)) {                                                    // the loose files and the files of its year folders (Paul keeps them in 2025, 2026, ...)
        await files(k.handle, [k.name]);
        var pys = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); }).sort(function (a, b) { return b.name < a.name ? -1 : 1; });
        for (var py = 0; py < pys.length; py++) await files(pys[py].handle, [k.name, pys[py].name]);
      }
      else if (/^\d+\.\s*astute/.test(nk)) {
        await files(k.handle, [k.name]);
        var years = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); }).sort(function (a, b) { return b.name < a.name ? -1 : 1; });
        if (years.length) await files(years[0].handle, [k.name, years[0].name]);
      } else if (/^\d+\.\s*fact find/.test(nk)) {                                                      // the Follow-Up Appointment Summary Notes of the later meetings (never the Fact Find itself, nor the transcripts)
        var fu = async function (dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && isDoc(e[0]) && /follow[ _-]?up|summary[ _-]?notes/i.test(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); };
        await fu(k.handle, [k.name]);
        var fyears = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); });
        for (var fy = 0; fy < fyears.length; fy++) await fu(fyears[fy].handle, [k.name, fyears[fy].name]);
      } else if (isStandard(k.name) && /quote|goal|rgar|egar|proposal|analysis|e-?mail|correspondence/.test(nk)) {
        await files(k.handle, [k.name]);
        if (/quote/.test(nk)) {                                                                                // a quotes folder may keep one folder for each review year ("2026 - Review"): its files are listed too
          var qrevs = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name).slice(0, 4)) || /review/.test(norm(y.name)); });
          for (var qr = 0; qr < qrevs.length; qr++) await files(qrevs[qr].handle, [k.name, qrevs[qr].name]);
        }
      }          // the quotes (and their change moment pay-out guides), the goal analysis reports and the proposals
      else if (!isStandard(k.name)) {                                                                  // a policy folder's Comparative Quotes: a folder that never answers costs its own slice of the time (1.5), not the listing
        var cq = (function (kk) { return (async function () {
          var inner = await listDirs(kk.handle);
          for (var j = 0; j < inner.length; j++) if (/comparative quotes/.test(norm(inner[j].name))) {
            await files(inner[j].handle, [kk.name, inner[j].name]);
            var revs = (await listDirs(inner[j].handle)).filter(function (y) { return RULES.year.test(norm(y.name).slice(0, 4)) || /review/.test(norm(y.name)); });                 // one folder for each review year ("2026 - Review"): its quotes are listed too
            for (var rv = 0; rv < revs.length; rv++) await files(revs[rv].handle, [kk.name, inner[j].name, revs[rv].name]);
          }
        })(); })(k);
        if (!(await within(cq, (lim && lim.perFolder) || 5000))) (out.slow = out.slow || []).push(k.name);
      }
    }
    return out;
  }

  /* The counter offer files of a client (round 1.2): in each policy (deal) folder a subfolder named exactly "Counter Offer Letter" (capitals and extra spaces ignored; also one directly in the client's folder). Only reads, no deeper than that.
     Returns [{ name, rel: [folder names], handle }] of every file in them (the page sorts them by their names); the numbered standard folders are not looked into. */
  var COUNTER_FOLDER = /^counter offer letters?$/;
  async function counterOfferDocuments(client) {
    var out = [], isDoc = function (n) { return /\.(pdf|png|jpe?g)$/i.test(n); };
    async function files(dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && isDoc(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); }
    var kids = await listDirs(client.handle);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (COUNTER_FOLDER.test(norm(k.name))) { await files(k.handle, [k.name]); continue; }
      if (isStandard(k.name)) continue;
      var inner = await listDirs(k.handle);
      for (var j = 0; j < inner.length; j++) if (COUNTER_FOLDER.test(norm(inner[j].name))) await files(inner[j].handle, [k.name, inner[j].name]);
    }
    return out;
  }

  /* Waits for p at most ms milliseconds: true when it finished (or failed) in time, false when the time ran out (p is left to finish by itself and is never waited for again). */
  function within(p, ms) { return new Promise(function (resolve) { var t = setTimeout(function () { resolve(false); }, Math.max(1, ms)); Promise.resolve(p).then(function () { clearTimeout(t); resolve(true); }, function () { clearTimeout(t); resolve(true); }); }); }
  /* ---------- the client's POLICY FOLDERS (Client Overview Studio 1.5) ----------
     Every non-standard folder of a client's folder is a policy (deal) folder, named "<Insurer Product> - <policy number> - (<status>)" (older ones "<Surname, First> - (<Insurer> - <Product> - R <amount> p.m.)").
     The name says the insurer, the product, the policy number and whether the policy is live: "(Transferred)", "(Transfered)", "(Cancelled)" and "(Lapsed)" are NOT live; "(Linked to PK)" is live (Paul is the broker on record);
     no status is live; any other word in brackets is shown and the policy is treated as live. The product decides the block: retirement annuities, investments, tax-free, endowments, living annuities and provident funds are
     CURRENT INVESTMENTS, personal covers, life and legacy plans are CURRENT POLICIES; a product the page cannot tell is left to the adviser. Only reads. */
  var FOLDER_INSURERS = (function () {
    var t = {}; Object.keys(ALIASES).forEach(function (k) { t[k] = ALIASES[k].slice(); });
    t['Ninety One'] = ['NinetyOne', 'Ninety One', '90One']; t['Alex Forbes'] = ['Alex Forbes']; t['Coronation'] = ['Coronation']; t['Glacier'] = ['Glacier']; t['Prudential'] = ['Prudential']; t['Investec'] = ['Investec']; t['Sygnia'] = ['Sygnia'];
    return t;
  })();
  var INS_KIND = { 'brightrock': 'policies', 'ninety one': 'investments', 'allan gray': 'investments', 'coronation': 'investments', 'glacier': 'investments', 'prudential': 'investments', 'investec': 'investments', 'sygnia': 'investments', 'stanlib': 'investments' };
  var INS_WORDS = (function () {                                                                  // every spelling of an insurer, longest first, with the insurer it means (the name, normalised)
    var out = []; Object.keys(FOLDER_INSURERS).forEach(function (k) { FOLDER_INSURERS[k].concat([k]).forEach(function (w) { out.push({ w: norm(w), c: norm(k) }); }); });
    return out.sort(function (a, b) { return b.w.length - a.w.length; });
  })();
  /* The insurer a text means (its normalised name), or ''. at: the text STARTS with it (a folder name); otherwise the earliest one anywhere in it. Returns { c, len } or null. */
  function insurerIn(text, at) {
    var n = norm(text), best = null;
    INS_WORDS.forEach(function (x) {
      var i = at ? (n.indexOf(x.w) === 0 ? 0 : -1) : n.search(new RegExp('(^|[^a-z0-9])' + esc(x.w) + '(?![a-z0-9])'));
      if (i < 0) return;
      if (!at) { var m = n.slice(i).indexOf(x.w); i += m; }
      if (at && /[a-z0-9]/.test(n.charAt(x.w.length))) return;
      if (!best || i < best.i || (i === best.i && x.w.length > best.len)) best = { c: x.c, len: x.w.length, i: i };
    });
    return best;
  }
  function canonInsurer(text) { var b = insurerIn(text, false); return b ? b.c : ''; }
  var STATUS_RE = [['transferred', /(^|[^a-z])transfer+ed([^a-z]|$)/], ['cancelled', /(^|[^a-z])cancel+ed([^a-z]|$)/], ['lapsed', /(^|[^a-z])lapsed([^a-z]|$)/]];
  function statusOf(text) { var n = norm(text); for (var i = 0; i < STATUS_RE.length; i++) if (STATUS_RE[i][1].test(n)) return STATUS_RE[i][0]; return ''; }
  var INV_RE = /(^|[^a-z0-9])(ra|retirement annuity|invest(ment)?s?|tfsa|tf|tax[ -]?free|endowment|living annuity|la|annuity|provident|pension|preservation|unit trusts?|ut|flexi|savings|discretionary|offshore|etf)(?![a-z0-9])/;
  var POL_RE = /(^|[^a-z0-9])(personal covers?|personal|life|legacy|covers?|protector|protection|risk|funeral|disability|income|severe|critical|dread|term|whole of life)(?![a-z0-9])/;
  /* A folder name read: { name, insurer (normalised), insurerName (as written), product, number, status ('live' | 'transferred' | 'cancelled' | 'lapsed'), linked, unknownStatus, dealStyle, kind ('policies' | 'investments' | ''), policy (does it look like a policy folder) }. */
  function parsePolicyFolder(name) {
    var raw = String(name == null ? '' : name), groups = [], rest = raw.replace(/[(\[]([^)\]]*)[)\]]/g, function (m, g) { groups.push(g); return ' '; });
    var out = { name: raw, insurer: '', insurerName: '', product: '', number: '', status: 'live', linked: false, unknownStatus: '', dealStyle: false, kind: '', policy: false }, other = [];
    groups.forEach(function (g) { var gn = norm(g); if (/linked to pk/.test(gn)) out.linked = true; else if (statusOf(gn)) out.status = statusOf(gn); else if (gn) other.push(g); });
    if (out.status === 'live' && statusOf(rest)) out.status = statusOf(rest);
    var body = rest;
    if (/linked to pk/.test(norm(rest))) out.linked = true;
    if (other.length && /^[^,]+,\s*[^()]*$/.test(rest.trim()) && !insurerIn(rest.trim(), true) && !/\d{5,}/.test(rest)) { out.dealStyle = true; body = other.shift(); }          // "<Surname, First> - (<Insurer> - <Product> - R <amount> p.m.)": the bracket holds the policy
    other = other.filter(function (g) { return !/^\s*[\d\s,.\/-]*$/.test(g); });                                         // a year or a number in brackets is not a status
    if (other.length) out.unknownStatus = other.join(', ');
    body = body.replace(/\br\s*[\d\s,]*\d(\.\d+)?\s*(p\.?\s?m\.?)?/gi, ' ');                                              // an amount is not a policy number
    var m = /(\d{5,})/.exec(body); if (m) out.number = m[1];
    var segs = (m ? body.replace(m[1], ' ') : body).split(/\s+[-–]\s+/).map(function (x) { return x.replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var first = segs[0] || '', hit = insurerIn(first, true);
    if (hit) {
      out.insurer = hit.c; out.insurerName = first.slice(0, hit.len).trim();
      out.product = (first.slice(hit.len).trim() + ' ' + segs.slice(1).join(' ')).trim();
    } else {
      var any = insurerIn(body, false); if (any) out.insurer = any.c;
      out.product = segs.join(' ');
    }
    out.product = out.product.replace(/(^|[^A-Za-z])(transfer+ed|cancel+ed|lapsed|linked to pk)(?![A-Za-z])/gi, ' ').replace(/\s+/g, ' ').trim();
    var pn = norm(out.product);
    out.kind = INV_RE.test(pn) ? 'investments' : POL_RE.test(pn) ? 'policies' : (INS_KIND[out.insurer] || '');
    out.special = /legacy/.test(pn) ? 'legacy' : /provident|pension|preservation/.test(pn) ? 'group' : '';          // these two live in another block of the overview (block 11; Group benefits), where the page has no row for a statement to fill: they are listed, not ticked, not compared
    out.policy = !!(out.insurer || out.kind || out.number);
    return out;
  }
  /* The non-standard folders of a client's folder, sorted: live policy folders, not-live ones (named, never looked into) and others (not policy folders: listed so the adviser knows). Only reads. */
  async function policyFolders(client) {
    var kids = await listDirs(client.handle), own = norm(client.parts[client.parts.length - 1]), out = { live: [], notLive: [], other: [] };
    kids.forEach(function (k) {
      if (isStandard(k.name) || norm(k.name) === own) return;
      var p = parsePolicyFolder(k.name), x = { name: k.name, handle: k.handle, p: p };
      if (!p.policy) out.other.push(x); else if (p.status !== 'live') out.notLive.push(x); else out.live.push(x);
    });
    return out;
  }
  /* The date a file name or its year folder gives: { exact: yyyymmdd or 0, year: the newest year folder on its path or 0 }; sortKey: what "newest" is compared by (the date in the name, else the year folder's year). */
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function dateKey(name, rel) {
    var n = String(name == null ? '' : name).replace(/\.[A-Za-z0-9]{2,5}$/, ''), m, d = 0, y, mo, da, ok = function (yy, mm, dd) { return yy >= 1990 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31; };
    if ((m = /(?:^|\D)((?:19|20)\d{2})[-._](\d{1,2})[-._](\d{1,2})(?!\d)/.exec(n)) && ok(+m[1], +m[2], +m[3])) d = +m[1] * 10000 + +m[2] * 100 + +m[3];
    else if ((m = /(?:^|\D)(\d{1,2})[-._ ](\d{1,2})[-._ ](\d{4}|\d{2})(?!\d)/.exec(n))) { y = +m[3]; if (y < 100) y += 2000; if (ok(y, +m[2], +m[1])) d = y * 10000 + +m[2] * 100 + +m[1]; }
    if (!d && (m = /(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/.exec(n)) && ok(+m[1], +m[2], +m[3])) d = +m[1] * 10000 + +m[2] * 100 + +m[3];
    if (!d && (m = /(?:^|\D)(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*((?:19|20)\d{2})(?!\d)/i.exec(n))) { mo = MONTHS[m[2].toLowerCase()]; da = +m[1]; if (ok(+m[3], mo, da)) d = +m[3] * 10000 + mo * 100 + da; }
    if (!d && (m = /(?:^|[^a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*['\u2019](\d{2})(?!\d)/i.exec(n))) { y = 2000 + +m[2]; if (ok(y, MONTHS[m[1].toLowerCase()], 1)) d = y * 10000 + MONTHS[m[1].toLowerCase()] * 100; }          // "Mar '25": the month, no day
    var yf = 0; (rel || []).forEach(function (r) { var mm = /^((?:19|20)\d{2})(?!\d)/.exec(norm(r)); if (mm) yf = Math.max(yf, +mm[1]); });
    return { exact: d, year: yf, sort: d || yf * 10000 };
  }
  /* Of some files, the NEWEST (by dateKey; a tie on the date goes to the one whose name says summary, schedule or statement; a tie that is still a tie is SAID and nothing is picked: tied lists them). Returns { file, tie, tied }. */
  function newestOf(files) {
    var c = (files || []).filter(function (f) { return f && f.role !== 'manual'; }).map(function (f) { var k = f.key || dateKey(f.name, f.rel); return { f: f, s: k.sort, w: /summary|schedule|statement/.test(norm(f.name)) ? 2 : 1, strong: SCHEDULE_NAME.test(norm(f.name)) }; });
    if (c.some(function (x) { return x.strong; })) c = c.filter(function (x) { return x.strong; });                  // a file whose name says schedule, summary, statement, policy ... is chosen before one that says nothing (a letter of 2026 is not a newer schedule than the schedule of 2025)
    if (!c.length) return { file: null, tie: false, tied: [] };
    c.sort(function (a, b) { return b.s - a.s || b.w - a.w; });
    var top = c[0], tied = c.filter(function (x) { return x.s === top.s && x.w === top.w; });
    var same = tied.filter(function (x, i) { return tied.findIndex(function (y) { return norm(y.f.name) === norm(x.f.name); }) === i; });                // the same file name twice (one document kept in two places) is ONE document, not a tie: the copy in the policy folder is taken
    if (tied.length > 1 && same.length === 1) { var own = tied.filter(function (x) { return !x.f.from; })[0] || tied[0]; return { file: own.f, tie: false, tied: [own.f] }; }
    return { file: tied.length > 1 ? null : top.f, tie: tied.length > 1, tied: tied.map(function (x) { return x.f; }) };
  }
  /* The date a FILE NAME carries, as a number: yyyymmdd for a day, yyyymm00 for a month, yyyy0000 for a bare year; 0 when the name has none. The folder is not looked at (dateKey's year of a folder is a different thing). A full date or "Mar '25" is dateKey's;
     added for the age rule of the quotes (round 1.7): "Mar 2026", "03.2026", "2026-03" and a bare "2026" count (a bare year that is part of a longer figure, such as "2026-5566", does not). */
  function nameDate(name) {
    var k = dateKey(name, []); if (k.exact) return k.exact;
    var n = String(name == null ? '' : name).replace(/\.[A-Za-z0-9]{2,5}$/, '').toLowerCase(), m;
    if ((m = /(?:^|[^a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*((?:19|20)\d{2})(?!\d)/.exec(n))) return +m[2] * 10000 + MONTHS[m[1]] * 100;
    if ((m = /(?:^|\D)((?:19|20)\d{2})[-\/.](0[1-9]|1[0-2])(?![\d])/.exec(n))) return +m[1] * 10000 + +m[2] * 100;
    if ((m = /(?:^|\D)(0[1-9]|1[0-2])[-\/.]((?:19|20)\d{2})(?!\d)/.exec(n))) return +m[2] * 10000 + +m[1] * 100;
    if ((m = /(?:^|[^\d])((?:19|20)\d{2})(?![\d]|[-.\/]\d)/.exec(n))) return +m[1] * 10000;
    return 0;
  }
  /* Which of the client's quote-like documents are NOT the newest of their kind (round 1.7; the rule of 1.6 and Paul's answer of 25 November, relayed 14:52).
     entries: [{ id, kind, y (the year: its folder's, else its name's, 0 when none), fy (the year of its folder, 0 when it sits in no year folder), ex (the date in its name as yyyymmdd, yyyymm00 for a month, 0 when none), no (its CP or policy number, '' when none) }];
     kind is fna, shortfallQuote, reduced, comparative, proposed, goals or cmp (a change moment pay-out guide). Returns a Map id -> the reason it is not ticked.
     (1) A kind is ruled by YEAR when one of its documents sits in a year folder (comparative quotes always): only the newest year's are ticked; a document with no year loses to a year.
     (2) A kind with NO year folder anywhere (comparative quotes apart) is ruled by the DATE IN THE NAME (nameDate: a day, a month or a bare year; two dates are compared at the COARSER precision of the pair): only the newest dated one is ticked (the same date: all of that date), a document with no date loses to a dated one; when NO document of the kind has a date, all are ticked (Paul, 25 November: "tick only the newest by the date in its name; if no date at all, keep both ticked").
     (3) A pay-out guide has no date of its own: it only follows its quote (the same number): the guide of a quote that is not ticked is not ticked, unless a ticked quote carries that number. */
  function ageQuotes(entries) {
    var older = new Map(), maxY = {}, byFolder = {}, dated = {}, list = entries || [];
    var prec = function (ex) { return ex % 100 ? 3 : (Math.floor(ex / 100) % 100 ? 2 : 1); };                // 3 a day, 2 a month, 1 a bare year
    var trunc = function (ex, p) { return p === 3 ? ex : p === 2 ? Math.floor(ex / 100) : Math.floor(ex / 10000); };
    var before = function (x, y) { var p = Math.min(prec(x), prec(y)); return trunc(x, p) < trunc(y, p); };   // x is older than y when it is so at the COARSER precision of the two: "2026" is not older than "03.03.26", and "Mar 26" is not older than "03.03.26"
    var fmt = function (ex) { var y = Math.floor(ex / 10000), m = Math.floor(ex / 100) % 100, d = ex % 100, p = function (n) { return (n < 10 ? '0' : '') + n; }; return d ? p(d) + '/' + p(m) + '/' + y : m ? p(m) + '/' + y : String(y); };
    list.forEach(function (x) {
      if (x.kind === 'cmp') return;
      if ((x.y || 0) > (maxY[x.kind] || 0)) maxY[x.kind] = x.y; if (x.fy) byFolder[x.kind] = true;
      if (x.ex) (dated[x.kind] = dated[x.kind] || []).push(x);
    });
    var ruled = function (kd) { return !!maxY[kd] && (kd === 'comparative' || byFolder[kd]); };
    list.forEach(function (x) {
      if (x.kind === 'cmp') return;
      if (ruled(x.kind)) { if ((x.y || 0) < maxY[x.kind]) older.set(x.id, x.y ? 'older year (' + x.y + '): not ticked, the newest is ' + maxY[x.kind] : 'no year found in its folder or name, and ' + maxY[x.kind] + ' exists: not ticked'); }
      else if (x.kind !== 'comparative' && dated[x.kind]) {
        if (!x.ex) older.set(x.id, 'no date in its name, and a dated one exists: not ticked');
        else {
          var newer = dated[x.kind].filter(function (y) { return before(x.ex, y.ex); });
          if (newer.length) older.set(x.id, 'older date (' + fmt(x.ex) + '): not ticked, the newest is ' + fmt(newer.reduce(function (m, y) { return y.ex > m ? y.ex : m; }, 0)));
        }
      }
    });
    var oldNo = {}, newNo = {};
    list.forEach(function (x) { if (x.kind === 'cmp' || !x.no) return; (older.has(x.id) ? oldNo : newNo)[x.no] = true; });
    list.forEach(function (x) { if (x.kind !== 'cmp' || !x.no || older.has(x.id)) return; if (oldNo[x.no] && !newNo[x.no]) older.set(x.id, 'the guide of an older quote: not ticked'); });
    return older;
  }
  var DOC_FILE = /\.(pdf|png|jpe?g)$/i;
  /* A file in a policy folder that is NOT a schedule or a statement: acceptance letters, applications, cancellations, claims, medical reports, ROA, RAR, questionnaires, e-mails, quotes and so on, the Astute report (read from its own folder). */
  var NOT_SCHEDULE = /accept|applic|cancel|claim|medical|(^|[^a-z])forms?([^a-z]|$)|change ?of ?details|plan details change|letter|premium increase|(^|[^a-z])roa([^a-z]|$)|(^|[^a-z])rar([^a-z]|$)|questionnaire|e-?mail|correspond|quote|proposal|comparative|counter|consent|invoice|receipt|(^|[^a-z])fna([^a-z]|$)|cmpo|change[ _-]?moment|follow[ _-]?up|astute|transfer|section ?14|tax ?cert|irp5|it3/;
  var SCHEDULE_NAME = /schedule|summary|s(a)?tatement|valuation|certificate|benefit|policy|annual|portfolio|(^|[^a-z])(ps|is|irr)([^a-z]|$)/;          // PS = policy schedule, IS = investment statement, IRR = investment report; "satatement" is how one real file spells it
  var SKIP_DIR = /accept|applic|cancel|claim|medical|(^|[^a-z])roa([^a-z]|$)|(^|[^a-z])rar([^a-z]|$)|questionnaire|notes|e-?mail|correspond|comparative|quotes?|counter|consent/;
  var YEAR_DIR = /^(19|20)\d{2}(?!\d)/;
  var ENTER_DIR = /schedule|statement|summary|servic|valuation|annual/;
  var REVIEW_DIR = /review/;
  /* The owner's manual (and the other long documents) is never the schedule: manual or owner always; terms, conditions, policy document, wording, contract and brochure unless the name also says schedule, summary or statement. */
  function isManual(name) { var n = norm(name); return /manual|owner/.test(n) || (/terms|conditions|policy ?document|policy ?wording|contract|brochure/.test(n) && !/schedule|summary|statement/.test(n)); }
  /* One live policy folder, read for its schedules and statements: loose files whose names say so, `Policy Schedules` and every year folder (also inside it), `Servicing` (only files whose names say schedule, summary or statement), no deeper than three folders down.
     Acceptance Letter, Applications, Cancellations, Claims, Medical Reports, ROA, RAR, Questionnaires, Notes & Emails, Comparative Quotes and Quotes are not entered. st: { stop, cap, seen, partial } is shared by the whole scan. Fills g.files and sets g.done. */
  async function walkPolicy(g, st) {
    g.quotes = g.quotes || [];
    /* A folder named Review ("2026 - Review") inside a policy folder holds the review's documents, not the policy's schedules (1.6, Paul 25 November: "the latest review documents"): every PDF in it, and in the year folders inside it, is listed in g.quotes
       (the page puts them among the other documents, where only the newest year's are ticked); none of them can be a schedule candidate whatever its name says (a "Review Summary" is not a policy summary schedule). */
    async function lookQ(dir, rel, depth) {
      for await (var e of dir.entries()) {
        if (st.partial) return;
        if (++st.seen > st.cap || Date.now() > st.stop) { st.partial = true; return; }
        if (e[1].kind === 'file') { if (DOC_FILE.test(e[0]) && !isManual(e[0])) g.quotes.push({ name: e[0], rel: rel, handle: e[1], key: dateKey(e[0], rel) }); }
        else if (e[1].kind === 'directory' && depth < 3) await lookQ(e[1], rel.concat([e[0]]), depth + 1);
      }
    }
    async function look(dir, rel, depth, strict) {
      for await (var e of dir.entries()) {
        if (st.partial) return;
        if (++st.seen > st.cap || Date.now() > st.stop) { st.partial = true; return; }
        var low = norm(e[0]);
        if (e[1].kind === 'file') {
          if (!DOC_FILE.test(e[0])) continue;
          /* A Servicing folder (like a Review folder) holds new review quotes AND paperwork about the change (letters, the signed or accepted quote, an SROA, a new schedule, the owner's manual): Paul, 25 November 14:55, "a mix". What is not a schedule candidate is
             listed among the other documents (g.quotes), where it is ticked only when its NAME says it is a quote (docs.classify). */
          var toQ = function () { if (strict && !isManual(e[0])) g.quotes.push({ name: e[0], rel: rel, handle: e[1], key: dateKey(e[0], rel) }); };
          if (NOT_SCHEDULE.test(low)) { toQ(); continue; }
          var other = g.p.insurer ? insurerIn(String(e[0]).replace(/\([^)]*\)/g, ' '), false) : null;                      // a file whose name names ANOTHER insurer than its folder is not this policy's document (an old Liberty schedule kept in a BrightRock folder)
          if (other && other.c !== g.p.insurer) { g.foreign.push(e[0]); continue; }
          if ((strict || depth === 0) && !SCHEDULE_NAME.test(low) && !isManual(e[0])) { toQ(); continue; }      // a loose file of the policy folder, or one in Servicing: a schedule candidate only when its name says what it is (the owner's manual is kept, as the last resort); in Servicing the rest is listed (g.quotes)
          g.files.push({ name: e[0], rel: rel, handle: e[1], role: isManual(e[0]) ? 'manual' : 'schedule', key: dateKey(e[0], rel) });
        } else if (e[1].kind === 'directory' && depth < 3) {
          if (REVIEW_DIR.test(low) && !/schedule|statement|valuation/.test(low)) { await lookQ(e[1], rel.concat([e[0]]), depth + 1); continue; }              // a Review folder is read by its folder: its files are review documents (g.quotes), never schedules
          if (SKIP_DIR.test(low) && !/schedule/.test(low)) continue;                              // "Acceptance Letter & Policy Schedules" holds schedules: it is entered
          if (/servic/.test(low)) await look(e[1], rel.concat([e[0]]), depth + 1, true);
          else if (YEAR_DIR.test(low) || ENTER_DIR.test(low)) await look(e[1], rel.concat([e[0]]), depth + 1, strict);
        }
      }
    }
    await look(g.handle, [g.name], 0, false);
    g.done = !st.partial;
  }
  /* The whole policy-folder reading of a client: policyFolders, then each live one walked (one after the other, within the shared limit). lim: { ms (default 15000), cap (default 2500), sink (an object the result is built in as it goes, so a caller that gives up still has what was found) }.
     Result: { groups: [{ name, rel, handle, p, files, done }], notLive: [{ name, p }], other: [name], partial, unfinished: [names not (fully) read] }. Never writes. */
  async function policyScan(client, lim) {
    lim = lim || {}; var out = lim.sink || {}, st = { stop: Date.now() + (lim.ms || 15000), cap: lim.cap || 2500, seen: 0, partial: false };
    out.groups = []; out.notLive = []; out.other = []; out.partial = false; out.unfinished = [];
    var pf = await policyFolders(client);
    out.notLive = pf.notLive.map(function (x) { return { name: x.name, p: x.p }; }); out.other = pf.other.map(function (x) { return x.name; });
    pf.live.forEach(function (x) { out.groups.push({ name: x.name, rel: [x.name], handle: x.handle, p: x.p, files: [], foreign: [], quotes: [], done: false }); });          // every live folder is named first, so one that is never reached (the limit, a folder that does not answer) is still named
    for (var i = 0; i < out.groups.length; i++) {
      if (st.partial) break;                                                                     // the limit was reached: the folders not reached are named, not guessed
      var ok = await within(walkPolicy(out.groups[i], st), Math.min(lim.perFolder || 5000, st.stop - Date.now()));          // a folder that never answers costs its own slice of the time, not the folders after it
      if (!ok) out.groups[i].done = false;
    }
    out.partial = st.partial || out.groups.some(function (g) { return !g.done; }); out.unfinished = out.groups.filter(function (g) { return !g.done; }).map(function (g) { return g.name; });
    return out;
  }
  /* The numbers compared without spaces and leading zeros. */
  function numKey(s) { return String(s == null ? '' : s).replace(/[^0-9a-z]/gi, '').toLowerCase().replace(/^0+/, ''); }
  /* The files of `6. Policy Schedules` (and its year folders) whose name or folder holds a policy's number join that policy's group (the newest of both places is the one); others stay where they are.
     files: the flat list (entries with rel); groups: policyScan's. Marks f.group (index) on every file that joined and pushes it into the group's files with from: 'Policy Schedules'. */
  function joinSchedules(files, groups) {
    (files || []).forEach(function (f) {
      var r0 = norm((f.rel || [])[0] || ''); if (!/^\d+\.\s*policy schedules/.test(r0) || f.group != null) return;
      var hay = numKey(f.name + ' ' + (f.rel || []).join(' ')), hits = [];
      groups.forEach(function (g, i) { var k = numKey(g.p && g.p.number); if (k.length >= 5 && hay.indexOf(k) >= 0) hits.push(i); });
      if (hits.length !== 1) return;                                                              // none, or two policies (a number in two places): it stays among the other documents
      f.group = hits[0]; f.role = isManual(f.name) ? 'manual' : 'schedule'; f.key = dateKey(f.name, f.rel); f.from = 'Policy Schedules';
      groups[hits[0]].files.push(f);
    });
  }
  /* Of files that are NOT in a policy folder, the newest of those that belong to ONE policy: keyOf(file) names the policy (null: not a schedule or statement, left alone). Returns { tick: Map(file -> true | false) for every keyed file, tied: [[files]] }
     (a tie on the newest, said and not guessed: none of them is ticked). */
  function keyedNewest(files, keyOf) {
    var by = {}, order = [], tick = new Map(), tied = [];
    (files || []).forEach(function (f) { var k = keyOf(f); if (k == null) return; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(f); });
    order.forEach(function (k) {
      var list = by[k]; if (list.length < 2) { tick.set(list[0], true); return; }
      var r = newestOf(list); list.forEach(function (f) { tick.set(f, r.file === f); }); if (r.tie) tied.push(r.tied);
    });
    return { tick: tick, tied: tied };
  }
  /* The three sources side by side (Studio 1.5): the policy folders (live: groups, not live: notLive), the Fact Find's current policies and investments (ff) and the latest overview (prior). ff and prior: { read, items: [{ kind: 'policies' | 'investments',
     who (the insurer or provider as written), product, no, legacy, ref }] } or null. A folder is matched to an item by the policy number, else by the insurer and the kind (the Fact Find has no numbers): one folder and one item of an insurer are a match, several are
     'maybe' (the page does not guess which is which). Each live row: { ff: 'number' | 'name' | 'maybe' | 'none' | 'unclear' | 'unknown', item, n, prior: 'number' | 'name' | 'maybe' | '' }; notLive rows say the same about their folder.
     Also ffOnly (a Fact Find item with no folder at all), ffNotLive (a Fact Find item whose only folder is not live) and priorOnly (in the last overview, in no folder and not in the Fact Find). Only compares. */
  function comparePolicies(groups, notLive, ff, prior) {
    groups = groups || []; notLive = notLive || [];
    var fitems = (ff && ff.items) || [], pitems = (prior && prior.items) || [];
    function ck(p) { return p.special === 'group' ? 'group' : p.special === 'legacy' ? 'legacy' : p.kind; }                     // the kind of item a folder is compared with: a provident or pension fund with the group block's funds, a legacy plan with block 11's
    function kindOk(it, fk) { return !fk || it.kind === fk; }
    function sameIns(it, p) { var c = canonInsurer(it.who); return !!c && c === p.insurer; }
    function claimIn(items, list, rows, byNoToo) {                                       // returns nothing; fills rows[i].{ff|prior} and the claimed set
      var claimed = new Set(), res = rows;
      list.forEach(function (f, i) {                                                     // 1. the policy number
        var k = numKey(f.p.number); if (k.length < 5) return;
        var hit = items.filter(function (it) { return !claimed.has(it) && numKey(it.no) === k && kindOk(it, ck(f.p)); });
        if (hit.length === 1) { claimed.add(hit[0]); res[i] = { how: 'number', item: hit[0], n: 1 }; }
      });
      [true, false].forEach(function (liveFirst) {                                       // 2. the insurer and the kind: live folders first, a not-live one only for an item no live folder wants
        list.forEach(function (f, i) {
          if (res[i] || f.live !== liveFirst) return;
          if (ck(f.p) === 'legacy') { var lg = items.filter(function (it) { return it.kind === 'legacy' && !claimed.has(it); }); if (lg.length) { claimed.add(lg[0]); res[i] = { how: 'name', item: lg[0], n: 1 }; } else res[i] = { how: 'none', item: null, n: 0 }; return; }
          if (!f.p.insurer) { res[i] = { how: 'unclear', item: null, n: 0 }; return; }
          var cands = items.filter(function (it) { return !claimed.has(it) && it.kind !== 'legacy' && kindOk(it, ck(f.p)) && sameIns(it, f.p); });
          var peers = list.filter(function (g, j) { return !res[j] && g.live === f.live && g.p.insurer === f.p.insurer && (!ck(g.p) || !ck(f.p) || ck(g.p) === ck(f.p)); }).length;
          if (!liveFirst && list.some(function (g, j) { return g.live && g.p.insurer === f.p.insurer && (!ck(g.p) || !ck(f.p) || ck(g.p) === ck(f.p)) && res[j] && res[j].how === 'maybe'; })) cands = [];      // a live folder of the same insurer is already unsure about it
          if (cands.length === 1 && peers === 1) { claimed.add(cands[0]); res[i] = { how: 'name', item: cands[0], n: 1 }; }
          else res[i] = { how: cands.length ? 'maybe' : 'none', item: null, n: cands.length };
        });
      });
      return claimed;
    }
    var list = groups.map(function (g) { return { p: g.p, live: true }; }).concat(notLive.map(function (x) { return { p: x.p, live: false }; }));
    var fr = [], pr = [], fclaim = claimIn(fitems, list, fr), pclaim = claimIn(pitems, list, pr);
    var rows = list.map(function (f, i) {
      var a = fr[i] || { how: 'none', item: null, n: 0 }, b = pr[i];
      return { ff: ff && ff.read ? a.how : 'unknown', item: a.item, n: a.n, prior: prior ? (b && (b.how === 'number' || b.how === 'name') ? b.how : b && b.how === 'maybe' ? 'maybe' : '') : '' };
    });
    function hasFolder(it) { return list.some(function (f) { return (numKey(f.p.number).length >= 5 && numKey(f.p.number) === numKey(it.no) && kindOk(it, ck(f.p))) || (ck(f.p) === 'legacy' ? it.kind === 'legacy' : (f.p.insurer && it.kind !== 'legacy' && sameIns(it, f.p) && kindOk(it, ck(f.p)))); }); }
    var ffOnly = ff && ff.read ? fitems.filter(function (it) { return !fclaim.has(it) && !hasFolder(it); }) : [];
    var ffNotLive = [];
    list.forEach(function (f, i) { if (!f.live && fr[i] && fr[i].item && ff && ff.read) ffNotLive.push({ item: fr[i].item, folder: notLive[i - groups.length] }); });
    var priorOnly = pitems.filter(function (it) { return !pclaim.has(it) && !hasFolder(it) && !fitems.some(function (x) { return x.kind === it.kind && (x.kind === 'legacy' || (canonInsurer(x.who) && canonInsurer(x.who) === canonInsurer(it.who))); }); });
    return { live: rows.slice(0, groups.length), notLive: rows.slice(groups.length), ffOnly: ffOnly, ffNotLive: ffNotLive, priorOnly: priorOnly };
  }

  /* The lists of several client folders (the same client in New Business and in Client Files) as ONE: a policy folder of the same name is kept once (the first: New Business is searched first), its files with it; not-live and other folders likewise.
     parts: [{ files, groups, notLive, other, partial, docsPartial, unfinished, overview }]. Every file that belongs to a group has its group index moved to the merged list. */
  function mergeClientLists(parts) {
    var out = { files: [], groups: [], notLive: [], other: [], partial: false, docsPartial: false, unfinished: [], overview: null }, seen = {}, nl = {}, ot = {}, un = {};
    (parts || []).forEach(function (one) {
      var map = {};
      (one.groups || []).forEach(function (g, i) { var k = norm(g.name); if (seen[k]) map[i] = -1; else { seen[k] = 1; map[i] = out.groups.length; out.groups.push(g); } });
      (one.files || []).forEach(function (f) { if (f.group != null) { if (map[f.group] == null || map[f.group] < 0) return; f.group = map[f.group]; } out.files.push(f); });
      (one.notLive || []).forEach(function (x) { var k = norm(x.name); if (!nl[k]) { nl[k] = 1; out.notLive.push(x); } });
      (one.other || []).forEach(function (n) { var k = norm(n); if (!ot[k]) { ot[k] = 1; out.other.push(n); } });
      (one.unfinished || []).forEach(function (n) { var k = norm(n); if (!un[k]) { un[k] = 1; out.unfinished.push(n); } });
      out.partial = out.partial || !!one.partial; out.docsPartial = out.docsPartial || !!one.docsPartial; out.overview = out.overview || one.overview || null;
    });
    return out;
  }
  /* The client's latest overview, for the comparison: the files of `1. Overview` and its newest three year folders; the newest .json is the one that is read, a PDF alone is only noticed. Only reads. Returns null (no overview folder) or { json, pdf, count } (each { name, rel, handle } or null). */
  async function latestOverview(client) {
    var kids = await listDirs(client.handle), ov = kids.filter(function (k) { return RULES.overview.test(norm(k.name)); })[0]; if (!ov) return null;
    var out = [];
    async function files(dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && /\.(json|pdf)$/i.test(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); }
    await files(ov.handle, [ov.name]);
    var years = (await listDirs(ov.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); }).sort(function (a, b) { return b.name < a.name ? -1 : 1; }).slice(0, 3);
    for (var i = 0; i < years.length; i++) await files(years[i].handle, [ov.name, years[i].name]);
    function best(re) {
      var c = out.filter(function (f) { return re.test(f.name); }).map(function (f) { return { f: f, k: dateKey(f.name, f.rel).sort }; });
      c.sort(function (a, b) { return b.k - a.k || (b.f.name < a.f.name ? -1 : 1); }); return c.length ? c[0].f : null;
    }
    return { json: best(/\.json$/i), pdf: best(/\.pdf$/i), count: out.length };
  }

  /* The folder of a client's own folder where a kind of document is kept, for "Upload from client folder" in the Client Overview Studio (0.6): the numbered standard folder whose name says so (quotes, goal analysis,
     proposals), for comparative quotes the `Comparative Quotes` folder of a deal folder, else the client's folder itself. Only reads. kind: quote | comparative | goal | proposal.
     Returns { handle, parts } (parts: the folder names from the connected folder down). */
  var DOC_KIND = { quote: [/quote/], comparative: [/quote/], goal: [/goal|rgar|egar/, /analysis/], proposal: [/proposal/, /investment/, /quote/] };          // the names of the standard folders to look for, the best first
  async function clientSubfolder(client, kind) {
    var kids = await listDirs(client.handle), parts = client.parts;
    async function comparative() {
      for (var i = 0; i < kids.length; i++) {
        if (isStandard(kids[i].name)) continue;
        var q = (await listDirs(kids[i].handle)).filter(function (d) { return /comparative quotes/.test(norm(d.name)); })[0];
        if (q) return { handle: q.handle, parts: parts.concat([kids[i].name, q.name]) };
      }
      return null;
    }
    if (kind === 'comparative') { var c = await comparative(); if (c) return c; }
    var std = null, res = DOC_KIND[kind] || [];
    for (var r = 0; r < res.length && !std; r++) std = kids.filter(function (k) { return isStandard(k.name) && res[r].test(norm(k.name)); })[0] || null;
    if (std) return { handle: std.handle, parts: parts.concat([std.name]) };
    if (kind === 'quote') { var c2 = await comparative(); if (c2) return c2; }
    return { handle: client.handle, parts: parts };
  }
  /* The files in a folder, and in the folders one level inside it, whose names match (a regular expression on the name). Only reads. Returns [{ name, handle, rel }]. */
  async function findFiles(dir, re) {
    var out = [];
    async function look(d, rel, deep) {
      for await (var e of d.entries()) {
        if (e[1].kind === 'file' && re.test(e[0])) out.push({ name: e[0], handle: e[1], rel: rel });
        else if (e[1].kind === 'directory' && deep) await look(e[1], rel.concat([e[0]]), false);
      }
    }
    await look(dir, [], true); return out;
  }

  /* Every PDF and picture in a client's folder and in the folders inside it (the View buttons of the Client Overview Studio 0.95 find a document here by its file name, number or insurer). Only reads; at most `depth` levels down
     (default 4), `cap` entries looked at (default 2500) and `ms` milliseconds (default 12000), so a huge or slow folder cannot hold the page up (0.96). Returns [{ name, rel: [folder names below the client's folder], handle }] with `.partial` true when it stopped early;
     `lim.sink` is an array the files are pushed into as they are found, so a caller that gives up still has them. */
  async function viewableFiles(client, lim) {
    lim = lim || {}; var maxDepth = lim.depth || 4, cap = lim.cap || 2500, stop = Date.now() + (lim.ms || 12000), out = lim.sink || [], seen = 0; out.partial = false;      // out.partial: the walk stopped (time or count) before it was over
    async function look(dir, rel, depth) {
      for await (var e of dir.entries()) {
        if (out.partial) return;
        if (++seen > cap || Date.now() > stop) { out.partial = true; return; }
        if (e[1].kind === 'file') { if (/\.(pdf|png|jpe?g)$/i.test(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); }
        else if (e[1].kind === 'directory' && depth < maxDepth) await look(e[1], rel.concat([e[0]]), depth + 1);
      }
    }
    await look(client.handle, [], 0); return out;
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
    isLetterFolder: isLetterFolder, isStandard: isStandard, nameIs: nameIs, insurerWords: insurerWords, productWords: productWords, numbersIn: numbersIn, hasWord: hasWord, scoreDeal: scoreDeal, chooseDeal: chooseDeal, pathCheck: pathCheck, tooLongText: tooLongText,
    comparePolicies: comparePolicies, mergeClientLists: mergeClientLists, keyedNewest: keyedNewest, parsePolicyFolder: parsePolicyFolder, policyFolders: policyFolders, policyScan: policyScan, joinSchedules: joinSchedules, latestOverview: latestOverview, dateKey: dateKey, newestOf: newestOf, ageQuotes: ageQuotes, nameDate: nameDate, isManual: isManual, isReviewDir: function (n) { return REVIEW_DIR.test(norm(n)); }, canonInsurer: canonInsurer, numKey: numKey, FOLDER_INSURERS: FOLDER_INSURERS,
    listDirs: listDirs, clientSubfolder: clientSubfolder, findFiles: findFiles, viewableFiles: viewableFiles, findClients: findClients, clientFromFile: clientFromFile, dirOfFile: dirOfFile, dealCandidates: dealCandidates, resolveTarget: resolveTarget, factFindCandidates: factFindCandidates, resolveFactFind: resolveFactFind, overviewCandidate: overviewCandidate, clientDocuments: clientDocuments, counterOfferDocuments: counterOfferDocuments, resolveOverview: resolveOverview, ensureOverview: ensureOverview, relOf: relOf, labelOf: labelOf, probeFile: probeFile, makeFile: makeFile, discardEmpty: discardEmpty,
    saveHandle: saveHandle, loadHandle: loadHandle, getPaths: getPaths, setPath: setPath, permission: permission, enabled: enabled
  };
});
