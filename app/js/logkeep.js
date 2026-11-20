/* The conversation log kept in this browser (Fact Find 5.3).
   The lines of the Live Client Conversation used to live only in the open page's memory: a reload, a new tab or a restart lost them, and "Save log" then saved an empty file (20 November: a meeting's log was
   not saved before the next meeting, and the log saved afterwards had no lines). Now every line is also written to the browser's own database (IndexedDB) as it is heard, one record for each line, under a
   session for the page's conversation, and stays there until the log is saved or discarded (or 14 days pass). Nothing leaves the computer. The text in the lines is already scrubbed of numbers and
   e-mail addresses by the caller (unless the adviser let Claude see them), exactly as in the saved file.
   Two backends: the browser's IndexedDB and a plain in-memory twin (the tests). Every call resolves and never throws: with no storage (a private window) nothing is kept and nothing breaks. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.logkeep = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var DB = 'wr-fact-find-logs', MAX_AGE = 14 * 24 * 3600 * 1000;

  /* ---------- the browser's IndexedDB ---------- */
  function idbBackend(idb) {
    idb = idb || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    var dbp = null;
    function open() {
      if (!idb) return Promise.reject(new Error('no storage'));
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        var rq = idb.open(DB, 1);
        rq.onupgradeneeded = function () {
          var db = rq.result;
          db.createObjectStore('sessions', { keyPath: 'sid' });
          db.createObjectStore('lines', { keyPath: ['sid', 'kid'] }).createIndex('bySid', 'sid');
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error || new Error('storage refused')); };
        rq.onblocked = function () { rej(new Error('storage blocked')); };
      });
      dbp.catch(function () { dbp = null; });
      return dbp;
    }
    function run(stores, mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(stores, mode), out = {};
          fn(t, out);
          t.oncomplete = function () { res(out.v); };
          t.onerror = t.onabort = function () { rej(t.error || new Error('storage failed')); };
        });
      });
    }
    return {
      putSession: function (rec) { return run(['sessions'], 'readwrite', function (t) { t.objectStore('sessions').put(rec); }); },
      putLines: function (sid, items) { return run(['lines'], 'readwrite', function (t) { var s = t.objectStore('lines'); items.forEach(function (it) { s.put({ sid: sid, kid: it.kid, line: it.line }); }); }); },
      sessions: function () { return run(['sessions'], 'readonly', function (t, out) { var rq = t.objectStore('sessions').getAll(); rq.onsuccess = function () { out.v = rq.result || []; }; }); },
      lines: function (sid) { return run(['lines'], 'readonly', function (t, out) { var rq = t.objectStore('lines').index('bySid').getAll(IDBKeyRange.only(sid)); rq.onsuccess = function () { out.v = (rq.result || []).map(function (r) { return { kid: r.kid, line: r.line }; }); }; }); },
      count: function (sid) { return run(['lines'], 'readonly', function (t, out) { var rq = t.objectStore('lines').index('bySid').count(IDBKeyRange.only(sid)); rq.onsuccess = function () { out.v = rq.result; }; }); },
      remove: function (sid) {
        return run(['sessions', 'lines'], 'readwrite', function (t) {
          t.objectStore('sessions').delete(sid);
          var rq = t.objectStore('lines').index('bySid').openKeyCursor(IDBKeyRange.only(sid));
          rq.onsuccess = function () { var c = rq.result; if (c) { t.objectStore('lines').delete(c.primaryKey); c.continue(); } };
        });
      }
    };
  }

  /* ---------- a plain in-memory twin (used by the tests, and when there is no storage) ---------- */
  function memoryBackend() {
    var sessions = {}, lines = {};
    var clone = function (x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)); };
    return {
      putSession: function (rec) { sessions[rec.sid] = clone(rec); return Promise.resolve(); },
      putLines: function (sid, items) { lines[sid] = lines[sid] || {}; items.forEach(function (it) { lines[sid][it.kid] = clone(it.line); }); return Promise.resolve(); },
      sessions: function () { return Promise.resolve(Object.keys(sessions).map(function (k) { return clone(sessions[k]); })); },
      lines: function (sid) { return Promise.resolve(Object.keys(lines[sid] || {}).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { kid: k, line: clone(lines[sid][k]) }; })); },
      count: function (sid) { return Promise.resolve(Object.keys(lines[sid] || {}).length); },
      remove: function (sid) { delete sessions[sid]; delete lines[sid]; return Promise.resolve(); }
    };
  }

  /* ---------- the keeper ---------- */
  function create(backend) {
    var be = backend || memoryBackend(), ok = function (p, dflt) { return Promise.resolve().then(function () { return p(); }).catch(function () { return dflt; }); };
    return {
      newSid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
      /* Writes (or updates) the session record and the lines given. rec: { sid, client, startedAt, meta }. items: [{ kid, line }]. */
      save: function (rec, items) {
        rec = Object.assign({}, rec, { updatedAt: Date.now() });
        return ok(function () { return be.putSession(rec).then(function () { return items && items.length ? be.putLines(rec.sid, items) : null; }).then(function () { return true; }); }, false);
      },
      /* The sessions that still hold an unsaved log, newest first: [{ sid, client, startedAt, updatedAt, count }]. */
      list: function () {
        return ok(function () {
          return be.sessions().then(function (all) {
            return Promise.all(all.map(function (s) { return be.count(s.sid).then(function (n) { return { sid: s.sid, client: s.client || '', startedAt: s.startedAt, updatedAt: s.updatedAt, count: n }; }); }));
          }).then(function (rows) { return rows.filter(function (r) { return r.count > 0; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }); });
        }, []);
      },
      /* A whole session: { meta, client, startedAt, lines: [line, ...] } in the order the lines were heard, or null. */
      read: function (sid) {
        return ok(function () {
          return be.sessions().then(function (all) {
            var s = all.filter(function (x) { return x.sid === sid; })[0];
            if (!s) return null;
            return be.lines(sid).then(function (ls) { return { sid: sid, client: s.client || '', startedAt: s.startedAt, updatedAt: s.updatedAt, meta: s.meta || {}, lines: ls.map(function (x) { return x.line; }) }; });
          });
        }, null);
      },
      remove: function (sid) { return ok(function () { return be.remove(sid).then(function () { return true; }); }, false); },
      /* Sessions not touched for 14 days are dropped (a log nobody saved, kept in a browser, is not kept for ever). */
      purge: function (now, maxAge) {
        return ok(function () {
          return be.sessions().then(function (all) {
            var old = all.filter(function (s) { return (now || Date.now()) - (s.updatedAt || 0) > (maxAge || MAX_AGE); });
            return Promise.all(old.map(function (s) { return be.remove(s.sid); })).then(function () { return old.length; });
          });
        }, 0);
      }
    };
  }
  function available() { try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch (e) { return false; } }
  return { create: create, idbBackend: idbBackend, memoryBackend: memoryBackend, available: available, MAX_AGE: MAX_AGE };
});
