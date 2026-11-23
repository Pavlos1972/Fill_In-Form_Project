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
  async function clientDocuments(client) {
    var out = [], isMail = function (n) { return /\.(eml|msg)$/i.test(n) || (/\.txt$/i.test(n) && /e-?mail|brightrock|\d{6,}/i.test(n)); }, isDoc = function (n) { return /\.(pdf|png|jpe?g)$/i.test(n) || isMail(n); };                      // e-mails (BrightRock's, with the figures a quote does not print) are listed too
    for await (var re of client.handle.entries()) if (re[1].kind === 'file' && isMail(re[0])) out.push({ name: re[0], rel: [], handle: re[1] });          // an e-mail saved in the client's own folder
    async function files(dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && isDoc(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); }
    var kids = await listDirs(client.handle);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], nk = norm(k.name);
      if (/^\d+\.\s*policy schedules/.test(nk)) await files(k.handle, [k.name]);
      else if (/^\d+\.\s*astute/.test(nk)) {
        await files(k.handle, [k.name]);
        var years = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); }).sort(function (a, b) { return b.name < a.name ? -1 : 1; });
        if (years.length) await files(years[0].handle, [k.name, years[0].name]);
      } else if (/^\d+\.\s*fact find/.test(nk)) {                                                      // the Follow-Up Appointment Summary Notes of the later meetings (never the Fact Find itself, nor the transcripts)
        var fu = async function (dir, rel) { for await (var e of dir.entries()) if (e[1].kind === 'file' && isDoc(e[0]) && /follow[ _-]?up|summary[ _-]?notes/i.test(e[0])) out.push({ name: e[0], rel: rel, handle: e[1] }); };
        await fu(k.handle, [k.name]);
        var fyears = (await listDirs(k.handle)).filter(function (y) { return RULES.year.test(norm(y.name)); });
        for (var fy = 0; fy < fyears.length; fy++) await fu(fyears[fy].handle, [k.name, fyears[fy].name]);
      } else if (isStandard(k.name) && /quote|goal|rgar|egar|proposal|analysis|e-?mail|correspondence/.test(nk)) await files(k.handle, [k.name]);          // the quotes (and their change moment pay-out guides), the goal analysis reports and the proposals
      else if (!isStandard(k.name)) {
        var inner = await listDirs(k.handle);
        for (var j = 0; j < inner.length; j++) if (/comparative quotes/.test(norm(inner[j].name))) await files(inner[j].handle, [k.name, inner[j].name]);
      }
    }
    return out;
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
     (default 4) and `cap` entries looked at (default 4000), so a huge folder cannot hold the page up. Returns [{ name, rel: [folder names below the client's folder], handle }]. */
  async function viewableFiles(client, lim) {
    lim = lim || {}; var maxDepth = lim.depth || 4, cap = lim.cap || 4000, out = [], seen = 0;
    async function look(dir, rel, depth) {
      for await (var e of dir.entries()) {
        if (++seen > cap) return;
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
    listDirs: listDirs, clientSubfolder: clientSubfolder, findFiles: findFiles, viewableFiles: viewableFiles, findClients: findClients, clientFromFile: clientFromFile, dirOfFile: dirOfFile, dealCandidates: dealCandidates, resolveTarget: resolveTarget, factFindCandidates: factFindCandidates, resolveFactFind: resolveFactFind, overviewCandidate: overviewCandidate, clientDocuments: clientDocuments, resolveOverview: resolveOverview, ensureOverview: ensureOverview, relOf: relOf, labelOf: labelOf, probeFile: probeFile, makeFile: makeFile, discardEmpty: discardEmpty,
    saveHandle: saveHandle, loadHandle: loadHandle, getPaths: getPaths, setPath: setPath, permission: permission, enabled: enabled
  };
});
