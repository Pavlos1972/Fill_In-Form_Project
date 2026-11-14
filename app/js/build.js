/* The copy check (3.8). Every page checks, when it opens, that it is one whole copy of the Fact Find: every script and style file comes from the page's own folder (not from another folder, such as an older copy kept
   next to it) and the page's own build number (the meta tag "wr-build") is the build of the scripts. When it is not, a red bar across the top says so, so a mixed copy is never used for a client without knowing.
   This happened on 13 November 2026: OneDrive rewrote the page links to point at the backup folders next to the copy, and the form ran on a mix of older scripts for most of a day. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.build = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var BUILD = '3.9';
  function dirOf(u) { return String(u).replace(/[?#].*$/, '').replace(/[^\/]*$/, ''); }
  /* info: { pageUrl, urls: [every script and stylesheet address, as the browser resolved them], meta: the page's wr-build } -> { ok, problems: [], build } */
  function check(info) {
    var problems = [], dir = dirOf(info.pageUrl || ''), n = 0;
    (info.urls || []).forEach(function (u) {
      u = String(u || ''); if (!u || /^(?:data|blob|about|javascript):/i.test(u)) return;
      n++;
      if (u.indexOf(dir) !== 0) problems.push('a file is loaded from another folder: ' + decodeURIComponentSafe(u).replace(/[?#].*$/, ''));
    });
    var meta = String(info.meta == null ? '' : info.meta).trim();
    if (!meta) problems.push('the page does not say which build it is');
    else if (meta !== BUILD) problems.push('the page is build ' + meta + ' but its scripts are build ' + BUILD);
    return { ok: !problems.length, problems: problems, build: BUILD, files: n };
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function banner(res) {
    var d = document, b = d.createElement('div');
    b.id = 'buildBanner'; b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00020;color:#fff;padding:10px 16px;font:600 14px/1.4 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    b.textContent = 'Mixed versions: this copy of the Fact Find is not one whole copy, so do not use it for a client. Ask for it to be installed again. ' + res.problems.slice(0, 3).join(' · ');
    (d.body || d.documentElement).appendChild(b);
  }
  /* Called by the small script at the foot of each page. */
  function run(urls, pageUrl, meta) {
    var res = check({ urls: urls, pageUrl: pageUrl, meta: meta });
    api.result = res;
    if (!res.ok) banner(res);
    return res;
  }
  var api = { BUILD: BUILD, check: check, run: run, result: null };
  return api;
});
