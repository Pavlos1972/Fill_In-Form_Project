/* Moving between the three pages (Fact Find 5.3, Risk Application 1.5, Investment Application 1.4).
   1. The client's Fact Find goes with the adviser. Clicking Risk Application or Investment Application in the Fact Find's "Other forms" menu leaves what is on the Fact Find screen (saved or not) in this
      browser for an hour, and the page that opens (its link carries ?from=factfind) fills itself from it, exactly as "Load from Fact Find" does from a file: amber "verify", typed boxes never overwritten.
      Only what the two applications read is kept (the answers and the lists, not the cost tallies, summaries, action points or notes the Fact Find also holds); it is removed after an hour, and when a
      new Fact Find is started. It works inside one browser at one web address: the website, or the copy on the computer, each on their own.
   2. The "Other forms" menu of every page closes when a link is chosen, on a click elsewhere and on Escape. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.handover = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var KEY = 'wr-handover', MAX = 60 * 60 * 1000, DROP = ['worked', 'sum', 'claude', 'openai', 'unplaced', 'pa', 'focus', 'auto', 'covered'];
  function store(win) { try { return (win || (typeof window !== 'undefined' ? window : null)).localStorage; } catch (e) { return null; } }
  function nm(x) { return String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }     // capitals, accents and repeated spaces do not matter
  /* What the two applications read from a Fact Find file: the answers and the lists, nothing else. */
  function slim(text) {
    var j = JSON.parse(text);
    DROP.forEach(function (k) { delete j[k]; });
    if (j.f) ['cc_notes', 'pa_actions', 'focus'].forEach(function (k) { delete j.f[k]; });
    return JSON.stringify(j);
  }
  /* The Fact Find leaves its client for the page that is about to open. name: what the Fact Find would call its file. Returns true when it was left. */
  function send(factFindJson, name, win) {
    var ls = store(win); if (!ls) return false;
    try {
      var slimmed = slim(factFindJson), j = JSON.parse(slimmed), ff = function (id) { return j.f && j.f[id] && j.f[id].v ? String(j.f[id].v).trim() : ''; };
      if (!ff('fname') && !ff('sname')) { ls.removeItem(KEY); return false; }                          // nothing about a client yet: nothing to hand over
      ls.setItem(KEY, JSON.stringify({ at: Date.now(), name: String(name || ''), who: { fname: ff('fname'), sname: ff('sname') }, text: slimmed }));
      return true;
    } catch (e) { return false; }
  }
  /* The hand-over, when there is a fresh one: { at, name, who: { fname, sname }, text } or null. A stale one is removed. */
  function peek(win, now) {
    var ls = store(win); if (!ls) return null;
    try {
      var r = JSON.parse(ls.getItem(KEY) || 'null');
      if (!r || !r.text) return null;
      if ((now || Date.now()) - r.at > MAX) { ls.removeItem(KEY); return null; }
      return r;
    } catch (e) { return null; }
  }
  function clear(win) { var ls = store(win); try { if (ls) ls.removeItem(KEY); } catch (e) { /* storage unavailable */ } }
  /* Is the page's own client the hand-over's? The surname is the same, and the first names agree as far as the shorter list goes (Anna is in Anna Maria). A page with no surname yet is not the same client. */
  function sameClient(who, fname, sname) {
    if (!who) return false;
    var a = nm(who.fname), b = nm(fname), s1 = nm(who.sname), s2 = nm(sname);
    return s1 !== '' && s1 === s2 && (a === b || a.indexOf(b + ' ') === 0 || b.indexOf(a + ' ') === 0);
  }
  function wants(win) { try { return /[?&]from=factfind(?:&|$)/.test((win || window).location.search); } catch (e) { return false; } }
  function stripFlag(win) {
    try { var w = win || window; if (wants(w) && w.history && w.history.replaceState) w.history.replaceState(null, '', w.location.pathname + w.location.search.replace(/([?&])from=factfind&?/, '$1').replace(/[?&]$/, '') + w.location.hash); } catch (e) { /* the address stays as it is */ }
  }
  /* The "Other forms" menu: a native <details id="otherForms"> with its links in .ofmenu. */
  function bindMenu(doc) {
    doc = doc || document;
    var close = function () { var d = doc.getElementById('otherForms'); if (d && d.open) d.open = false; };
    doc.addEventListener('click', function (e) {
      var d = doc.getElementById('otherForms'); if (!d || !d.open) return;
      var t = e.target; if (!d.contains(t) || (t.closest && t.closest('.ofmenu a'))) close();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  return { send: send, peek: peek, clear: clear, sameClient: sameClient, wants: wants, stripFlag: stripFlag, bindMenu: bindMenu, slim: slim, KEY: KEY, MAX: MAX };
});
