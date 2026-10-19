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

  /* Private values (ID, tax and phone numbers, email addresses) are swapped for markers before a line leaves this computer. When sharing is switched on in Settings (the Anthropic account behind
     the key is covered by the agreement the firm needs for client details), they are sent as they are and Claude fills, checks and edits those boxes itself. Off unless switched on. */
  var share = false;
  function setShare(on) { share = !!on; }
  function sharing() { return share; }

  var SYSTEM = [
    'You are the listening brain of a Fact Find form. A financial adviser is on a call with a client and the form fills in live while they talk.',
    'You receive JSON: "position" (where the adviser is on the form now), "sections", "fields" (every box of the whole form, with its section), "filled" (what is already in the boxes of the form),',
    '"lists" (every list of rows in the form, with its section, its columns and the rows already there), "recent" (the last few lines) and "newest" (the line just heard).',
    'The JSON can arrive in two parts one after the other (the first holds "sections" and "fields"): read the two together as one.',
    'When "note" is present it says what the page has already done for the newest line (for example that it already moved to a section): do not do that again, do the rest of the line.',
    'Nobody tells you who is speaking. The adviser and the client talk fluidly: ONE line can hold the adviser asking, the client answering, a correction and a new fact.',
    'Read the whole line and work out what was ASKED, what was STATED and what was CHANGED, however loosely it was worded, then say what to do on the form.',
    'Reply with ONE JSON object and nothing else: {"actions": [ ... ]}. Put the actions in the order things were said. Each action is one of:',
    '  {"do":"ask","field":"<id>"}                  someone asks about, or moves to, one box ("do you have a work number?", "and your second name?")',
    '  {"do":"section","section":"<id>"}            someone moves to a whole topic ("let\'s talk about your health")',
    '  {"do":"fill","field":"<id>","value":"..."}   a value is stated for a box, WHOEVER says it. Add "correction":true when it replaces a value that is already in the box (see "filled")',
    '  {"do":"confirm","field":"<id>"}              the client agrees to a value on the form ("yes, that\'s right"): see "Confirming" below',
    '  {"do":"wait"}                                the value in position.current_value is rejected and the new one has not come yet',
    '  {"do":"cmd","cmd":"undo|next|prev|nextSection|prevSection|clear|clearAll|notes|notesOff"}   a request about the form itself: "scratch that" is undo, "skip" or "next question" is next,',
    '                                               "let me take some notes" is notes (add "retro":true for "note that down"), "that\'s all for the notes" is notesOff,',
    '                                               "clear that" is clear (only the box being talked about), and clearAll is for wanting EVERYTHING on the whole form removed',
    '                                               ("all my details are wrong, remove them all", "wipe the entire form", "start again from scratch"). For clearAll give just that one action:',
    '                                               the page asks "are you sure?" before anything is cleared. A wrong value in ONE box is not clearAll: that is a correction or "wait".',
    '  {"do":"note","text":"- ...\n- ..."}           something for the notes box, WHOEVER says it (see "Notes" below)',
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
    '- One line can move to another part of the form and carry on there: "let\'s talk about your investments. Do you have a tax free? Yes, an Old Mutual one, R3400 a month" is [section, row]. Everything said after the move',
    '  belongs to the boxes and lists of THAT section, which are all described in "fields" and "lists" whichever section is open now. Give every action of the line in one reply. Never stop after the "section" action.',
    '',
    'Notes. "let me take some notes", "I\'d like to make a couple of notes about ...", "note that down" start the notes (cmd notes). The notes box takes what you give it in "note" actions, so when the line holds the thing to be noted, ALSO give it:',
    '"I\'d like to make a couple of notes about the Old Mutual tax free. The client told me it is for his son\'s university fees when he turns 18" is',
    '[{"do":"cmd","cmd":"notes"}, {"do":"note","text":"- Old Mutual tax free: for his son\'s university fees\n- To be used when the son turns 18"}]. Never stop at the notes command when more was said.',
    'Write the note in short points, one per line, each starting with "- ", with every fact that was said (names, amounts, ages, reasons, dates) and nothing that was not. Leave out the adviser\'s questions, small talk, and any ID, phone or tax number or email address.',
    '"Note that down" on its own, with nothing new in the line, is {"do":"cmd","cmd":"notes","retro":true} with no "note" action: the page takes the last thing said. Someone saying "make a note that he smokes" is [cmd notes, note "- Smokes"].',
    '',
    'Confirming. "awaiting_confirmation" lists the boxes (and rows of lists) that were filled by voice and still wait for the client to agree; a box with "private": true is listed without its value.',
    'When the client agrees to what is on the form ("yes", "that\'s right", "correct", "exactly", "yes it is") in answer to a value that was read back or a question such as "is that right?", give one',
    '{"do":"confirm","field":"<id>"} for EVERY listed box that the read-back or question covered: "so that\'s John Snow?" "yes" confirms the first name and the surname; "is your cell still [N1]?" "yes" confirms the cell number.',
    'For a row of a list use {"do":"confirm","list":"<list id>","row":<row number>}. A bare "yes" with nothing read back confirms position.field, only when that box is listed.',
    'Never confirm a box nobody talked about, and never confirm what the client said no to or changed: a different value is a fill with "correction":true, and a "no" without the new value is "wait".',
    'A mere acknowledgement ("okay", "mm hm", "I see", "great") is not agreement: it asks for nothing to be confirmed.',
    '',
    'Values:',
    '- A box with "options": the value must be exactly one of the options. If none fits, leave it out.',
    '- Amounts: digits only, for example 85000. Dates: YYYY-MM-DD. Percentages and years: a number. Names: just the name, capitalised, without "my name is" around it.',
    '  Otherwise use the client\'s own words, tidied (for example "Discovery", "Underwriter"). Never add words that were not said.',
    '',
    'Private values. ID numbers, phone numbers, tax numbers and email addresses are never shown to you. Where one was said, the line shows a marker such as [N1] (a number) or [E1] (an email address),',
    'and "private_values" says what kind each looks like, for example "10 digits, starts like a cell number". Boxes marked "private": true take ONLY a marker as their value: {"do":"fill","field":"cell","value":"[N1]"}',
    '(or "None" for a "No" box). Never write digits or an address yourself, and never put two markers in one value. A cell number is 10 digits starting 06, 07 or 08; a work or home number usually starts 01 to 05;',
    'an ID number has 13 digits; a tax number is often 10 digits but a number said right after "tax number" is the tax number whatever its length. When a number is said and then corrected, use the marker of the LAST one. "filled_private" lists the private boxes that already hold a value (the values are not shown).',
    'Speech-to-text often leaves the first part of an email address outside the marker: the client says "jonathan snow at discovery dot co dot za" and the line reads "my work email is Jonathan [E1]".',
    'When the word or words right before an [E] marker are clearly the start of the address (a name, not a word like "is", "my", "email", "address", "at" or "on"), give them in front of the marker, separated by a space:',
    '{"do":"fill","field":"wemail","value":"Jonathan [E1]"}. Use only words that are really there, immediately before the marker. Otherwise give the marker alone.',
    'A plain "my email" or "email address" is the personal email (pemail); "work email" or "office email" is the work email (wemail). A plain "my number" or "cell" is the cell number, an "office" or "work" number is the work number.',
    '',
    'Some sections hold LISTS of rows: children, debts, existing policies, retirement funds, investments, partners and shareholders, quotes. "lists" describes every list of the form: its section, its columns, and the rows already there (row numbers start at 1).',
    'Three more actions work on lists:',
    '  {"do":"row","list":"<list id>","values":{"<column id>":"<value>", ...}}   someone introduces a NEW row and says things about it ("we have a daughter, Thandi, born 22 August 2019")',
    '  {"do":"cell","list":"<list id>","row":<row number or "last">,"col":"<column id>","value":"..."}   a value for one box of a row that is already there ("the balance on the bond is R450 000")',
    '  {"do":"ask","list":"<list id>","row":<row number, "last" or "new">,"col":"<column id>"}   someone asks about one box of a row',
    'If position.field looks like "kids.dob" with a position.row, the client\'s plain answer belongs in that box: use a "cell" action for it.',
    'Two children said in one breath are two "row" actions. Never add a row that is already in "lists" (the same child, the same loan): use "cell" for anything new about it. For a column with "options", the value must be one of them.',
    '"cell" and "ask" only work on rows that are in "lists". If the row is not there yet, add it with a "row" action and put everything said about it in its values.'
  ].join('\n');
  /* Added to the instructions while sharing is on: it replaces what is said above about markers and private boxes. */
  var SHARE_NOTE = [
    '',
    'SHARING IS ON for this session. ID numbers, phone numbers, tax numbers and email addresses are NOT hidden from you: they appear in the line, in "filled" and in "awaiting_confirmation" exactly as they are, and there are no [N1] or [E1] markers and no "private" boxes.',
    'Ignore everything above about markers. Give the real value in "value": digits for a number (a cell number written like 082 454 1751, an ID number as 13 plain digits, a tax number as 10 plain digits) and the address for an email. Spoken digits ("zero eight two four five four ...") are written as digits.',
    'A spoken edit of a number that is already in a box ("add an 8 to the end", "put a zero in front", "the last digit is 8", "it ends in 98", "remove the last digit") is ONE fill with the complete new number and "correction":true.',
    'When the adviser reads a number back and asks the client to confirm it ("is that correct?", "can you confirm your ID number?") that is only an "ask": never confirm it until the client agrees in a later line. A number the client simply states is a fill, never a confirm.'
  ].join('\n');

  /* Anything private in a line (an email address, a phone / ID / account number, written or spoken) is swapped for a marker.
     generic: [number] and [email], for lines that only give context. Otherwise [N1], [E1] ... with the real values kept in the vault, and a
     short description of each, so Claude can tell a cell number from a landline or an ID without ever seeing the digits. */
  var DIGITWORD = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)';
  var PLAIN = /^(?:r|id|is|no|at|in|on|to|or|my|it|as|am|an|be|by|do|go|he|if|me|of|so|up|us|we)$/i;      // not a passport prefix: money (R450000), plain words
  var NUMBER_CUE = /\b(?:tax|sars|reference|number|account|id|passport|phone|cell|mobile|telephone|landline|policy)\b[^.!?]*$/i;       // words that say the digits just after them are a private number
  function kindOf(d) {
    if (d.length === 13) return '13 digits, the length of an ID number';
    if (/^0[6-8]\d{8}$/.test(d)) return '10 digits, starts like a cell number';
    if (/^0[1-5]\d{8}$/.test(d)) return '10 digits, starts like a landline number';
    if (/^27[6-8]\d{9}$/.test(d)) return d.length + ' digits, starts like a cell number with +27';
    return d.length + ' digits';
  }
  function shield(text, generic) {
    if (share) return { text: String(text == null ? '' : text), vault: {}, list: [] };                    // sharing is on: nothing is hidden
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
      var d = m.replace(/\D/g, ''), before = all.slice(Math.max(0, off - 3), off), lead = all.slice(Math.max(0, off - 50), off);
      if (/(?:^|[^A-Za-z])[Rr]\s?$/.test(before)) return m;                                      // an amount of money ("R1 250 000")
      if (/^(?:0[1-9]|[12]\d|3[01])[ \t-](?:0[1-9]|1[0-2])[ \t-](?:19|20)\d\d$/.test(m)) return m;     // a date said as "05 03 1980"
      if (d.length >= 9 || (d.length >= 7 && d.charAt(0) === '0')) return hold('N', m, kindOf(d));
      if (d.length <= 12 && NUMBER_CUE.test(lead) && !/[A-Za-z]-?$/.test(before)) return hold('N', m, kindOf(d));                   // "my tax number is 554-7259": a shorter number, but said as a number
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

  /* Every list of the form, whichever section is open (a line can move to another section and carry on there): the section it is in, its columns
     (private ones marked, their values never shown) and the rows already in it. */
  function listsFor(idx, ctx) {
    var out = [];
    Object.keys(idx.lists).forEach(function (key) {
      var L = idx.lists[key];
      var cols = L.cols.map(function (id) {
        var c = idx.byId[id], o = { id: c.k, label: c.label };
        if (c.options) o.options = c.options;
        if (!share && V.PRIVATE_IDS.indexOf(id) >= 0) o.private = true;
        return o;
      });
      var open = cols.filter(function (c) { return !c.private; });
      var rows = (ctx.listRows ? ctx.listRows(key) : []).slice(0, 10).map(function (d, i) {
        var v = {}; open.forEach(function (c) { if (d[c.id] != null && String(d[c.id]).trim() !== '') v[c.id] = scrub(d[c.id]); });
        return { n: i + 1, values: v };
      });
      out.push({ id: key, section: L.sec, title: L.title, columns: cols, rows: rows });
    });
    return out;
  }
  /* Left to itself the model thinks before it answers, which takes seconds for a short JSON reply. Where the model allows it, thinking is switched off for these requests:
     Haiku 5.5 takes "disabled", Sonnet 5.5 takes "between_tools" (its way of saying no thinking), and Opus 5.5 cannot switch it off (low effort keeps it short). */
  function thinkingFor(model) { return model === 'claude-haiku-5-5' ? { type: 'disabled' } : model === 'claude-sonnet-5-5' ? { type: 'between_tools' } : null; }
  function withThinking(req) { var t = thinkingFor(req.model); if (t) req.thinking = t; return req; }
  /* ctx: { sectionId, targetId, targetRow, targetValue, filled: {id: value}, filledPrivate: [ids], listRows(key), recent: [{who, text}] }; text/who are the newest line.
     -> { req, vault }: the request, and the real values behind the markers in the newest line (kept here, never sent). */
  function prepare(idx, ctx, who, text, model) {
    var sh = shield(text), priv = function (id) { return !share && V.PRIVATE_IDS.indexOf(id) >= 0; };
    var fields = idx.fields.filter(function (f) { return !f.list; }).map(function (f) {
      var o = { id: f.id, label: f.label, section: f.sec };
      if (priv(f.id)) o.private = true;
      if (f.none) o.none_box = true;
      if (f.options) o.options = f.options;
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
    var awaiting = (ctx.awaiting || []).slice(0, 16).map(function (a) {
      var o = a.list ? { list: a.list, row: a.row } : { id: a.id };
      if (a.label) o.label = a.label;
      if (a.private) o.private = true; else if (a.value != null) o.value = scrub(String(a.value)).slice(0, 80);
      return o;
    });
    if (awaiting.length) body.awaiting_confirmation = awaiting;
    if (ctx.note) body.note = String(ctx.note);
    if (tPriv) body.position.box_has_value = !!ctx.targetFilled;
    if (sh.list.length) body.private_values = sh.list;
    var vault = { _line: String(text == null ? '' : text), _sent: sh.text, _held: ctx.privateHeld || {} };                                      // the line itself (to check the words in front of an email marker), what was sent (to recover a number that was sent unshielded) and the values already in the private boxes waiting to be confirmed (to check a read-back against; never sent)
    Object.keys(sh.vault).forEach(function (k) { vault[k] = sh.vault[k]; });
    var rest = {}; Object.keys(body).forEach(function (k) { if (k !== 'sections' && k !== 'fields') rest[k] = body[k]; });
    return { req: withThinking({ model: model, max_tokens: 900, output_config: { effort: 'low' }, system: share ? SYSTEM + '\n' + SHARE_NOTE : SYSTEM, messages: [{ role: 'user', content: JSON.stringify(body) }] }), vault: vault,        // low effort and no thinking: the models think before answering unless told otherwise (Sonnet 5.5 at high), which is slow and billed as output
      parts: [JSON.stringify({ sections: body.sections, fields: body.fields }), JSON.stringify(rest)] };        // the same JSON in two pieces: what never changes during a conversation, and what does
  }
  /* The request as sent with a key. The instructions and the form's boxes never change during a conversation, so Anthropic is asked to remember them
     for an hour (a call can pause for longer than the usual five minutes): each line is then answered sooner and for less. (A host that reaches Claude without a key gets the plain request.) */
  function cachedRequest(prep) {
    return Object.assign({}, prep.req, { messages: [{ role: 'user', content: [{ type: 'text', text: prep.parts[0], cache_control: { type: 'ephemeral', ttl: '1h' } }, { type: 'text', text: prep.parts[1] }] }] });
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
  var CMDS = { undo: { type: 'undo' }, next: { type: 'next' }, prev: { type: 'prev' }, nextSection: { type: 'nextSection' }, prevSection: { type: 'prevSection' }, clear: { type: 'clear' }, clearAll: { type: 'clearAll' }, notesOff: { type: 'notesOff' } };
  /* Only ids that exist get through. A private box takes only a marker (swapped for the real value here) or "None".
     -> { kind: 'actions', actions } | { kind: 'point', field, section } | { kind: 'answers', answers, waiting } | { kind: 'none' } */
  function normalize(raw, idx, who, vault) {
    if (!raw || typeof raw !== 'object') return { kind: 'none' };
    var isPriv = function (id) { return !share && V.PRIVATE_IDS.indexOf(id) >= 0; };
    var okField = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list && !isPriv(id); };
    if (who === 'auto' || Array.isArray(raw.actions)) {
      var okAny = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list; };
      var okList = function (id) { return typeof id === 'string' && idx.lists[id]; };
      var okCol = function (l, k) { return typeof k === 'string' && idx.byId[l + '.' + k]; };
      var rowRef = function (r, allowNew) { return typeof r === 'number' && r >= 1 && r <= 50 ? Math.floor(r) : (allowNew && r === 'new' ? 'new' : 'last'); };
      /* A "yes" to a private box is accepted unless a number was read back that is not the one in the box: then it is not agreement with what is there. */
      var agreeable = function (id) {
        var held = isPriv(id) && vault && vault._held && vault._held[id];
        if (!held) return true;
        var said = Object.keys(vault).filter(function (k) { return /^N\d+$/.test(k); });
        return !said.length || said.some(function (k) { return String(vault[k]).replace(/\D/g, '') === String(held).replace(/\D/g, ''); });
      };
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
        if (isPriv(id)) {
          if (/^none$/i.test(s) && idx.byId[id] && idx.byId[id].none) return 'None';
          return /^[\d\s\-+().]{5,}$/.test(s) && vault && vault._sent && vault._sent.indexOf(s) >= 0 ? s : null;     // digits are taken only if they went out in the line as plain text (nothing was hidden): then the model really saw them
        }
        return s;
      };
      if (Array.isArray(raw.actions)) raw.actions.forEach(function (a) {
        if (!a || typeof a !== 'object') return;
        var v, vals;
        if (a.do === 'ask' && okAny(a.field)) acts.push({ do: 'ask', field: a.field });
        else if (a.do === 'section' && okSec(a.section)) acts.push({ do: 'section', section: a.section });
        else if (a.do === 'fill' && okAny(a.field) && (v = clean(a.field, a.value)) != null) acts.push({ do: 'fill', field: a.field, value: v, explicit: a.correction === true });
        else if (a.do === 'confirm' && okAny(a.field)) { if (agreeable(a.field)) acts.push({ do: 'confirm', field: a.field }); }
        else if (a.do === 'confirm' && okList(a.list)) acts.push({ do: 'confirm', list: a.list, row: rowRef(a.row, false) });
        else if (a.do === 'note' && typeof a.text === 'string' && (v = a.text.replace(/\[((?:N|E)\d+)\]/g, function (m, k) { return vault && vault[k] != null ? vault[k] : ''; }).replace(/[ \t]+\n/g, '\n').trim())) acts.push({ do: 'note', text: v, ready: true });   // the points Claude wrote for the notes box (a number or address that was held back is put back here, on this computer)
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
    function send(r) {
      return doFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(r)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok && res.status === 400 && r.thinking && /thinking/i.test(friendly(res.status, body))) { var r2 = Object.assign({}, r); delete r2.thinking; return send(r2); }      // the model did not accept the thinking setting: ask again without it
          if (!res.ok) throw new Error(friendly(res.status, body));
          return textOf(body);
        });
      }, function () { throw new Error('no connection'); });
    }
    return send(req);
  }

  /* Asks Claude to read the unchanging part of the request now (nothing is written back), so the first real line finds it remembered and is answered at once.
     The request is the real one with an empty line in place of the conversation: the same model, effort and thinking, so it lands in the same place in the memory. */
  function warm(opts) {
    if (!opts.apiKey) return Promise.resolve(false);
    var prep = prepare(opts.idx, { sectionId: 'info', recent: [], listRows: function () { return []; } }, 'auto', '', opts.model), r = cachedRequest(prep);
    r.messages[0].content[1].text = '{"warming_up":true}'; r.max_tokens = 0;
    return callModel(opts, r).then(function () { return true; }, function () { return false; });
  }
  /* A clear answer can be put on the form before Claude has read the line, and Claude then checks it. This compares what was put there (local) with what Claude says:
     agree is true unless Claude fills one of those boxes with a different value, or puts the same value in another box (a number said for the work phone, not the cell). Claude saying nothing
     about a box is not a disagreement: the box keeps what was heard, still amber to be confirmed. (Taking it back made a cell number vanish whenever Claude had nothing to add.)
     rest is what Claude says besides (those fills left out, as they are already done). When Claude reads the line differently, rest is all of Claude's answer: the page takes its own fills back first. */
  function reconcile(local, claude, idx) {
    var norm = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ''); };
    var mine = {}, theirs = {};
    local.forEach(function (a) {
      if (a.do !== 'fill' || !a.res) return;
      mine[a.field] = norm(a.res.value);
      (a.res.extra || []).forEach(function (x) { mine[x.id] = norm(x.value); });
    });
    claude.forEach(function (a) {
      if (a.do !== 'fill') return;
      var f = idx.byId[a.field], x = f ? V.interpret(f, a.value) : null;
      theirs[a.field] = norm(x && !x.error ? x.value : a.value);
    });
    var ids = Object.keys(mine);
    var agree = ids.every(function (id) { return theirs[id] === undefined || theirs[id] === mine[id]; }) &&
      !Object.keys(theirs).some(function (id) { return mine[id] === undefined && ids.some(function (m) { return mine[m] === theirs[id]; }); });
    return { agree: agree, rest: agree ? claude.filter(function (a) { return !(a.do === 'fill' && mine[a.field] !== undefined && theirs[a.field] === mine[a.field]); }) : claude };
  }

  /* opts: { apiKey | ask, model, idx, who, text, ctx, fetchImpl } -> Promise of the normalized answer. */
  function decide(opts) {
    var prep = prepare(opts.idx, opts.ctx || {}, opts.who, opts.text, opts.model);
    return callModel(opts, opts.ask ? prep.req : cachedRequest(prep)).then(function (text) { return normalize(extractJson(text), opts.idx, opts.who, prep.vault); });
  }

  /* File notes in point form. opts: { apiKey | ask, model, text, topic, fetchImpl } -> Promise of an array of short points (maybe empty). */
  var POINTS_SYSTEM = [
    'You help a financial adviser keep file notes while on a call with a client.',
    'Turn what was said into short point-form notes: one brief point per fact, not full sentences, no "he said that" or "she mentioned".',
    'Keep names, amounts, dates and numbers exactly as said, but write spoken numbers as figures ("60", "R1.2 million", "R250 000"), and add nothing that was not said.',
    'Reply with ONE JSON object and nothing else: {"points": ["...", "..."]}. Use {"points": []} when nothing is worth noting (greetings, small talk).'
  ].join('\n');
  function points(opts) {
    var req = withThinking({ model: opts.model, max_tokens: 400, output_config: { effort: 'low' }, system: POINTS_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ topic: opts.topic || '', said: scrub(opts.text) }) }] });
    return callModel(opts, req).then(function (text) {
      var raw = extractJson(text), list = raw && Array.isArray(raw.points) ? raw.points : [];
      return list.map(function (p) { return String(p == null ? '' : p).replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean).slice(0, 8);
    });
  }

  return { decide: decide, points: points, warm: warm, reconcile: reconcile, setShare: setShare, sharing: sharing, thinkingFor: thinkingFor, prepare: prepare, buildRequest: buildRequest, cachedRequest: cachedRequest, normalize: normalize, extractJson: extractJson, scrub: scrub, shield: shield, SYSTEM: SYSTEM };
});
