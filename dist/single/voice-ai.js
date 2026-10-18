/* Voice mode, the part that follows meaning. Claude reads each line that is heard: who asked what, who stated which fact, what was corrected,
   what the client does not have, and which box each fact belongs in. Only text is sent (never audio): the last few lines of the conversation,
   the names of the form's boxes and the values already in the current section. ID numbers, phone numbers, tax numbers and email addresses
   are never sent: each one is swapped for a marker such as [N1] or [E1] (with its general shape, for example "10 digits, starts like a
   landline number"), Claude says which box gets which marker, and the real value is put back on this computer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./voice.js'));
  else { root.FF = root.FF || {}; root.FF.voiceAI = factory(root.FF.voice); }
})(typeof self !== 'undefined' ? self : this, function (V) {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages', API_VERSION = '2023-06-01';

  var SYSTEM = [
    'You are the listening brain of a Fact Find form. A financial adviser is on a call with a client and the form fills in live while they talk.',
    'You receive JSON: "position" (where the adviser is on the form now), "sections", "fields" (every box of the form), "filled" (what is already in the boxes of the current section),',
    '"lists" (the lists of rows in the current section), "recent" (the last few lines) and "newest" (the line just heard).',
    'Nobody tells you who is speaking. The adviser and the client talk fluidly: ONE line can hold the adviser asking, the client answering, a correction and a new fact.',
    'Read the whole line and work out what was ASKED, what was STATED and what was CHANGED, however loosely it was worded, then say what to do on the form.',
    'Reply with ONE JSON object and nothing else: {"actions": [ ... ]}. Put the actions in the order things were said. Each action is one of:',
    '  {"do":"ask","field":"<id>"}                  someone asks about, or moves to, one box ("do you have a work number?", "and your second name?")',
    '  {"do":"section","section":"<id>"}            someone moves to a whole topic ("let\'s talk about your health")',
    '  {"do":"fill","field":"<id>","value":"..."}   a value is stated for a box, WHOEVER says it. Add "correction":true when it replaces a value that is already in the box (see "filled")',
    '  {"do":"confirm","field":"<id>"}              the value in position.current_value is agreed to ("yes, that\'s right")',
    '  {"do":"wait"}                                the value in position.current_value is rejected and the new one has not come yet',
    '  {"do":"cmd","cmd":"undo|next|prev|nextSection|prevSection|clear|notes|notesOff"}   a request about the form itself: "scratch that" is undo, "skip" or "next question" is next,',
    '                                               "let me take some notes" is notes (add "retro":true for "note that down"), "that\'s all for the notes" is notesOff',
    '',
    'How to read the line:',
    '- Facts count whoever says them. The adviser saying "your first name is John" and the client saying "my surname is Peters" each fill a box. A full name fills the first name AND the surname.',
    '- A question about a box is an "ask" and comes before its answer: "do you have a work number? yes I do, it\'s [N2]" is [ask work, fill work [N2]]. A plain statement straight after a question answers position.field.',
    '- Corrections: people change their mind in the middle of a sentence ("oh no, I made a mistake, it\'s ...", "sorry, I mean ...", "my name is actually Jonathan"). Only the LAST version counts.',
    '  Give ONE fill with the final value, with "correction":true when it replaces something already in the box. Never join the old and the new value.',
    '- "No" boxes: boxes marked "none_box": true have a "No ..." tick box (home number, work number, personal email, work email). When the client does not have one ("I don\'t have a telephone at home", "no landline",',
    '  "I haven\'t got a work email") fill that box with the value "None". Several can be said in one line: one fill per box. Never give "None" to a box the client does give a value for.',
    '- Understand meaning, not exact words. Ignore filler, false starts and small talk. Give {"actions": []} for acknowledgements and small talk ("okay great", "thank you", "I see", "mm hm", "lovely").',
    '- Never invent a value that was not said, and never fill a box for something that is only being asked.',
    '',
    'Values:',
    '- A box with "options": the value must be exactly one of the options. If none fits, leave it out.',
    '- Amounts: digits only, for example 85000. Dates: YYYY-MM-DD. Percentages and years: a number. Names: just the name, capitalised, without "my name is" around it.',
    '  Otherwise use the client\'s own words, tidied (for example "Discovery", "Underwriter"). Never add words that were not said.',
    '',
    'Private values. ID numbers, phone numbers, tax numbers and email addresses are never shown to you. Where one was said, the line shows a marker such as [N1] (a number) or [E1] (an email address),',
    'and "private_values" says what kind each looks like, for example "10 digits, starts like a cell number". Boxes marked "private": true take ONLY a marker as their value: {"do":"fill","field":"cell","value":"[N1]"}',
    '(or "None" for a "No" box). Never write digits or an address yourself, and never put two markers in one value. A cell number is 10 digits starting 06, 07 or 08; a work or home number usually starts 01 to 05;',
    'an ID number has 13 digits. When a number is said and then corrected, use the marker of the LAST one. "filled_private" lists the private boxes that already hold a value (the values are not shown).',
    'Speech-to-text often leaves the first part of an email address outside the marker: the client says "jonathan snow at discovery dot co dot za" and the line reads "my work email is Jonathan [E1]".',
    'When the word or words right before an [E] marker are clearly the start of the address (a name, not a word like "is", "my", "email", "address", "at" or "on"), give them in front of the marker, separated by a space:',
    '{"do":"fill","field":"wemail","value":"Jonathan [E1]"}. Use only words that are really there, immediately before the marker. Otherwise give the marker alone.',
    'A plain "my email" or "email address" is the personal email (pemail); "work email" or "office email" is the work email (wemail). A plain "my number" or "cell" is the cell number, an "office" or "work" number is the work number.',
    '',
    'Some sections hold LISTS of rows: children, debts, existing policies, retirement funds, investments, partners and shareholders, quotes. "lists" describes each list in the current section: its columns, and the rows already there (row numbers start at 1).',
    'Three more actions work on lists:',
    '  {"do":"row","list":"<list id>","values":{"<column id>":"<value>", ...}}   someone introduces a NEW row and says things about it ("we have a daughter, Thandi, born 22 August 2019")',
    '  {"do":"cell","list":"<list id>","row":<row number or "last">,"col":"<column id>","value":"..."}   a value for one box of a row that is already there ("the balance on the bond is R450 000")',
    '  {"do":"ask","list":"<list id>","row":<row number, "last" or "new">,"col":"<column id>"}   someone asks about one box of a row',
    'If position.field looks like "kids.dob" with a position.row, the client\'s plain answer belongs in that box: use a "cell" action for it.',
    'Two children said in one breath are two "row" actions. Never add a row that is already in "lists" (the same child, the same loan): use "cell" for anything new about it. For a column with "options", the value must be one of them.',
    '"cell" and "ask" only work on rows that are in "lists". If the row is not there yet, add it with a "row" action and put everything said about it in its values.'
  ].join('\n');

  /* Anything private in a line (an email address, a phone / ID / account number, written or spoken) is swapped for a marker.
     generic: [number] and [email], for lines that only give context. Otherwise [N1], [E1] ... with the real values kept in the vault, and a
     short description of each, so Claude can tell a cell number from a landline or an ID without ever seeing the digits. */
  var DIGITWORD = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)';
  var PLAIN = /^(?:r|id|is|no|at|in|on|to|or|my|it|as|am|an|be|by|do|go|he|if|me|of|so|up|us|we)$/i;      // not a passport prefix: money (R450000), plain words
  function kindOf(d) {
    if (d.length === 13) return '13 digits, the length of an ID number';
    if (/^0[6-8]\d{8}$/.test(d)) return '10 digits, starts like a cell number';
    if (/^0[1-5]\d{8}$/.test(d)) return '10 digits, starts like a landline number';
    if (/^27[6-8]\d{9}$/.test(d)) return d.length + ' digits, starts like a cell number with +27';
    return d.length + ' digits';
  }
  function shield(text, generic) {
    var t = String(text == null ? '' : text), vault = {}, list = [], nN = 0, nE = 0;
    function hold(kind, raw, desc) {
      if (generic) return kind === 'E' ? '[email]' : '[number]';
      var k = kind + (kind === 'E' ? ++nE : ++nN);
      vault[k] = raw; list.push({ id: k, kind: desc });
      return '[' + k + ']';
    }
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, function (m) { return hold('E', m, 'email address'); });
    t = t.replace(/\b[\w.+-]+(?:\s+(?:dot|underscore|dash|hyphen)\s+[\w.+-]+)*\s+at\s+[\w-]+(?:\s+dot\s+[\w-]+)+\b/gi, function (m) { return hold('E', m, 'email address'); });
    t = t.replace(/\+?\d(?:[ \t-]?\d){6,}/g, function (m, off, all) {
      var d = m.replace(/\D/g, ''), before = all.slice(Math.max(0, off - 3), off);
      if (/(?:^|[^A-Za-z])[Rr]\s?$/.test(before)) return m;                                      // an amount of money ("R1 250 000")
      if (/^(?:0[1-9]|[12]\d|3[01])[ \t-](?:0[1-9]|1[0-2])[ \t-](?:19|20)\d\d$/.test(m)) return m;     // a date said as "05 03 1980"
      if (d.length >= 9 || (d.length >= 7 && d.charAt(0) === '0')) return hold('N', m, kindOf(d));
      return m;
    });
    t = t.replace(/(^|[^A-Za-z0-9])([A-Za-z]{1,2})[ \t-]?(\d(?:[ \t-]?\d){5,})(?!\d)/g, function (m, pre, letters) {         // a passport number: letters then digits
      return PLAIN.test(letters) ? m : pre + hold('N', m.slice(pre.length), 'letters then digits, like a passport number');
    });
    t = t.replace(new RegExp('\\b(?:([A-Za-z]{1,2})[\\s,-]+)?(' + DIGITWORD + '(?:[\\s,-]+' + DIGITWORD + '){5,})\\b', 'gi'), function (m, letters, run) {
      var d = V.spokenDigits(run);
      if (letters && !PLAIN.test(letters) && d.length >= 6) return hold('N', m, 'letters then digits, like a passport number');
      return d.length >= 7 ? (letters ? letters + ' ' : '') + hold('N', run, kindOf(d)) : m;
    });
    return { text: t, vault: vault, list: list };
  }
  function scrub(t) { return shield(t, true).text; }

  /* The lists of the section being talked about: their columns (private ones marked, their values never shown) and the rows already in them. */
  function listsFor(idx, ctx) {
    var out = [];
    Object.keys(idx.lists).forEach(function (key) {
      var L = idx.lists[key];
      if (L.sec !== ctx.sectionId) return;
      var cols = L.cols.map(function (id) {
        var c = idx.byId[id], o = { id: c.k, label: c.label };
        if (c.options) o.options = c.options;
        if (V.PRIVATE_IDS.indexOf(id) >= 0) o.private = true;
        return o;
      });
      var open = cols.filter(function (c) { return !c.private; });
      var rows = (ctx.listRows ? ctx.listRows(key) : []).slice(0, 10).map(function (d, i) {
        var v = {}; open.forEach(function (c) { if (d[c.id] != null && String(d[c.id]).trim() !== '') v[c.id] = scrub(d[c.id]); });
        return { n: i + 1, values: v };
      });
      out.push({ id: key, title: L.title, columns: cols, rows: rows });
    });
    return out;
  }
  /* ctx: { sectionId, targetId, targetRow, targetValue, filled: {id: value}, filledPrivate: [ids], listRows(key), recent: [{who, text}] }; text/who are the newest line.
     -> { req, vault }: the request, and the real values behind the markers in the newest line (kept here, never sent). */
  function prepare(idx, ctx, who, text, model) {
    var sh = shield(text), priv = function (id) { return V.PRIVATE_IDS.indexOf(id) >= 0; };
    var fields = idx.fields.filter(function (f) { return !f.list; }).map(function (f) {
      var o = { id: f.id, label: f.label, section: f.sec };
      if (priv(f.id)) o.private = true;
      if (f.none) o.none_box = true;
      if (f.options && (f.sec === ctx.sectionId || f.id === ctx.targetId)) o.options = f.options;
      return o;
    });
    var filled = {};
    Object.keys(ctx.filled || {}).forEach(function (id) { if (!priv(id)) filled[id] = scrub(String(ctx.filled[id])).slice(0, 120); });
    var tPriv = !!ctx.targetId && priv(ctx.targetId), body = {
      position: { section: ctx.sectionId, field: ctx.targetId || null, row: ctx.targetRow || null, current_value: ctx.targetId && !tPriv && ctx.targetValue ? scrub(ctx.targetValue) : null },
      lists: listsFor(idx, ctx),
      sections: idx.sections.map(function (x) { return { id: x.id, title: x.title }; }),
      fields: fields,
      filled: filled,
      filled_private: (ctx.filledPrivate || []).filter(priv),
      recent: (ctx.recent || []).map(function (l) { return { who: l.who, text: scrub(l.text) }; }),
      newest: { who: who === 'client' ? 'client' : who === 'auto' ? 'unclear' : 'adviser', text: sh.text }
    };
    if (tPriv) body.position.box_has_value = !!ctx.targetFilled;
    if (sh.list.length) body.private_values = sh.list;
    var vault = { _line: String(text == null ? '' : text) };                                                     // the line itself, only to check the words in front of an email marker
    Object.keys(sh.vault).forEach(function (k) { vault[k] = sh.vault[k]; });
    return { req: { model: model, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(body) }] }, vault: vault };
  }
  function buildRequest(idx, ctx, who, text, model) { return prepare(idx, ctx, who, text, model).req; }

  function extractJson(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }
  function textOf(resp) {
    return (resp.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ');
  }

  var EMAIL_LEAD = /^(?:is|are|it|its|it's|my|our|email|e-mail|mail|address|at|on|me|to|and|or|the|a|an|work|personal|private|office|business|use|using|via|send|sent|contact|reach|for|from)$/i;   // words that lead into an address but are not part of it
  var CMDS = { undo: { type: 'undo' }, next: { type: 'next' }, prev: { type: 'prev' }, nextSection: { type: 'nextSection' }, prevSection: { type: 'prevSection' }, clear: { type: 'clear' }, notesOff: { type: 'notesOff' } };
  /* Only ids that exist get through. A private box takes only a marker (swapped for the real value here) or "None".
     -> { kind: 'actions', actions } | { kind: 'point', field, section } | { kind: 'answers', answers, waiting } | { kind: 'none' } */
  function normalize(raw, idx, who, vault) {
    if (!raw || typeof raw !== 'object') return { kind: 'none' };
    var isPriv = function (id) { return V.PRIVATE_IDS.indexOf(id) >= 0; };
    var okField = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list && !isPriv(id); };
    if (who === 'auto' || Array.isArray(raw.actions)) {
      var okAny = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list; };
      var okList = function (id) { return typeof id === 'string' && idx.lists[id]; };
      var okCol = function (l, k) { return typeof k === 'string' && idx.byId[l + '.' + k]; };
      var rowRef = function (r, allowNew) { return typeof r === 'number' && r >= 1 && r <= 50 ? Math.floor(r) : (allowNew && r === 'new' ? 'new' : 'last'); };
      var okSec = function (id) { return typeof id === 'string' && idx.sections.some(function (x) { return x.id === id; }); }, acts = [];
      /* A value for box id: a marker is swapped for what was really said; a private box takes nothing else (but "None" for a "No" box). */
      var clean = function (id, v) {
        if (v == null) return null;
        var s = String(v).trim(), m = /^\[((?:N|E)\d+)\]$/.exec(s);
        if (!s) return null;
        if (m) return vault && vault[m[1]] != null ? vault[m[1]] : null;
        var pre = /^([A-Za-z][A-Za-z0-9._-]*(?:\s+[A-Za-z][A-Za-z0-9._-]*){0,2})\s+\[(E\d+)\]$/.exec(s);                  // "Jonathan [E1]": the start of the address was left outside the marker
        if (pre) {
          var raw = vault && vault[pre[2]], low = function (x) { return String(x).toLowerCase().replace(/\s+/g, ' '); };
          return raw != null && vault._line && low(vault._line).indexOf(low(pre[1] + ' ' + raw)) >= 0 && !EMAIL_LEAD.test(pre[1].split(/\s+/).pop()) ? pre[1] + ' ' + raw : null;
        }
        if (/\[(?:N|E)\d+\]|\[number\]|\[email\]/.test(s)) return null;
        if (isPriv(id)) return /^none$/i.test(s) && idx.byId[id] && idx.byId[id].none ? 'None' : null;
        return s;
      };
      if (Array.isArray(raw.actions)) raw.actions.forEach(function (a) {
        if (!a || typeof a !== 'object') return;
        var v, vals;
        if (a.do === 'ask' && okAny(a.field)) acts.push({ do: 'ask', field: a.field });
        else if (a.do === 'section' && okSec(a.section)) acts.push({ do: 'section', section: a.section });
        else if (a.do === 'fill' && okAny(a.field) && (v = clean(a.field, a.value)) != null) acts.push({ do: 'fill', field: a.field, value: v, explicit: a.correction === true });
        else if (a.do === 'confirm' && okAny(a.field)) acts.push({ do: 'confirm', field: a.field });
        else if (a.do === 'wait') acts.push({ do: 'wait' });
        else if (a.do === 'cmd' && a.cmd === 'notes') acts.push({ do: 'cmd', cmd: { type: 'notes', retro: a.retro === true, box: null } });
        else if (a.do === 'cmd' && typeof a.cmd === 'string' && CMDS.hasOwnProperty(a.cmd)) acts.push({ do: 'cmd', cmd: { type: CMDS[a.cmd].type } });
        else if (a.do === 'row' && okList(a.list) && a.values && typeof a.values === 'object') {
          vals = {}; Object.keys(a.values).forEach(function (k) { if (okCol(a.list, k) && (v = clean(a.list + '.' + k, a.values[k])) != null) vals[k] = v; });
          if (Object.keys(vals).length) acts.push({ do: 'row', list: a.list, values: vals });
        }
        else if (a.do === 'cell' && okList(a.list) && okCol(a.list, a.col) && (v = clean(a.list + '.' + a.col, a.value)) != null) acts.push({ do: 'cell', list: a.list, row: rowRef(a.row, false), col: a.col, value: v, explicit: a.correction === true });
        else if (a.do === 'ask' && okList(a.list) && okCol(a.list, a.col)) acts.push({ do: 'ask', list: a.list, row: rowRef(a.row, true), col: a.col });
      });
      else {                                                    // an answer in the older shape is still understood
        if (okField(raw.field)) acts.push({ do: 'ask', field: raw.field }); else if (okSec(raw.section)) acts.push({ do: 'section', section: raw.section });
        (Array.isArray(raw.answers) ? raw.answers : []).forEach(function (a) {
          if (a && okField(a.field) && a.confirm === true) acts.push({ do: 'confirm', field: a.field });
          else if (a && okField(a.field) && a.value != null && String(a.value).trim() !== '') acts.push({ do: 'fill', field: a.field, value: String(a.value).trim() });
        });
      }
      return acts.length ? { kind: 'actions', actions: acts } : { kind: 'none' };
    }
    if (who !== 'client') {
      var field = okField(raw.field) ? raw.field : null;
      var section = typeof raw.section === 'string' && idx.sections.some(function (s) { return s.id === raw.section; }) ? raw.section : null;
      return field || section ? { kind: 'point', field: field, section: section } : { kind: 'none' };
    }
    var answers = (Array.isArray(raw.answers) ? raw.answers : []).filter(function (a) { return a && okField(a.field) && (a.confirm === true || (a.value != null && String(a.value).trim() !== '')); })
      .map(function (a) { return { field: a.field, confirm: a.confirm === true, value: a.confirm === true ? null : String(a.value).trim() }; });
    return { kind: 'answers', answers: answers, waiting: raw.waiting === true && !answers.length };
  }

  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'the API key was not accepted';
    if (status === 429) return 'too many requests just now';
    return msg || 'error ' + status;
  }

  /* A reply that takes too long is given up on, so a slow connection never holds up the conversation (the page falls back to its own reading). */
  function callModel(opts, req) {
    var ms = opts.timeoutMs || 25000, timer, slow = new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('Claude took too long to answer')); }, ms); });
    return Promise.race([callModel0(opts, req), slow]).then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
  }
  /* Sends one request and resolves to the model's text. opts: { apiKey, fetchImpl } or { ask } (a host that reaches Claude without a key). */
  function callModel0(opts, req) {
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (opts.ask) {
      return Promise.resolve().then(function () { return opts.ask(req.system, req.messages[0].content); }).then(null, function (e) {
        throw new Error(e && e.code === 'not_granted' ? 'Claude was not allowed on this page' : (e && (e.message || e.code)) || 'no connection');
      });
    }
    if (!opts.apiKey) return Promise.reject(new Error('no API key'));
    return doFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(req)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(friendly(res.status, body));
        return textOf(body);
      });
    }, function () { throw new Error('no connection'); });
  }

  /* opts: { apiKey | ask, model, idx, who, text, ctx, fetchImpl } -> Promise of the normalized answer. */
  function decide(opts) {
    var prep = prepare(opts.idx, opts.ctx || {}, opts.who, opts.text, opts.model);
    return callModel(opts, prep.req).then(function (text) { return normalize(extractJson(text), opts.idx, opts.who, prep.vault); });
  }

  /* File notes in point form. opts: { apiKey | ask, model, text, topic, fetchImpl } -> Promise of an array of short points (maybe empty). */
  var POINTS_SYSTEM = [
    'You help a financial adviser keep file notes while on a call with a client.',
    'Turn what was said into short point-form notes: one brief point per fact, not full sentences, no "he said that" or "she mentioned".',
    'Keep names, amounts, dates and numbers exactly as said, but write spoken numbers as figures ("60", "R1.2 million", "R250 000"), and add nothing that was not said.',
    'Reply with ONE JSON object and nothing else: {"points": ["...", "..."]}. Use {"points": []} when nothing is worth noting (greetings, small talk).'
  ].join('\n');
  function points(opts) {
    var req = { model: opts.model, max_tokens: 400, system: POINTS_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ topic: opts.topic || '', said: scrub(opts.text) }) }] };
    return callModel(opts, req).then(function (text) {
      var raw = extractJson(text), list = raw && Array.isArray(raw.points) ? raw.points : [];
      return list.map(function (p) { return String(p == null ? '' : p).replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean).slice(0, 8);
    });
  }

  return { decide: decide, points: points, prepare: prepare, buildRequest: buildRequest, normalize: normalize, extractJson: extractJson, scrub: scrub, shield: shield, SYSTEM: SYSTEM };
});
