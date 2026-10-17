/* Voice mode, the part that follows meaning. When the simple on-computer rules cannot tell which question the adviser is on,
   or what the client answered, this asks Claude. Only text is sent (never audio): the last few lines of the conversation,
   the names of the form's fields, and the value in the box being discussed. ID numbers, phone numbers and email addresses
   are never sent: those fields are left out of the list, and anything that looks like one is blanked in the text. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./voice.js'));
  else { root.FF = root.FF || {}; root.FF.voiceAI = factory(root.FF.voice); }
})(typeof self !== 'undefined' ? self : this, function (V) {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages', API_VERSION = '2023-06-01';

  var SYSTEM = [
    'You assist a financial adviser who is filling in a client Fact Find form while talking to a client on a call.',
    'You receive: where the adviser currently is on the form, the sections, the fields, the last few lines of the conversation, and the newest line.',
    'Decide what the newest line means for the form. Reply with ONE JSON object and nothing else.',
    '',
    'If the newest line is from the "adviser": work out which section or field he is now asking about, even when he words it loosely',
    '("so what do you do for work?" is the Occupation field; "let\'s talk about your job" is the Occupation section).',
    'Reply {"section": "<section id or null>", "field": "<field id or null>"}. Give "field" when he asks about one specific thing, otherwise give "section" alone.',
    'Give null for both when the line is small talk or not about the form.',
    '',
    'If the newest line is from the "client": work out what it answers. Reply {"answers": [{"field": "<id>", "value": "<value>", "confirm": false}], "waiting": false}.',
    '- Normally the answer is for the field the adviser is currently on ("position.field"), but the client may also volunteer other facts. Include those fields too.',
    '- For a field with "options", value must be exactly one of the options. If none fits, leave that field out.',
    '- Amounts: digits only, for example 85000. Dates: YYYY-MM-DD. Percentages and years: a number.',
    '  Otherwise use the client\'s own words, tidied (for example "Discovery", "Underwriter"). Never add words the client did not say.',
    '- If position.current_value is set and the client agrees with it, reply with "confirm": true for that field and omit "value".',
    '- If the client disagrees and gives a different value, give the new value with "confirm": false.',
    '- If the client only says no or that is wrong, without the new value yet, reply {"answers": [], "waiting": true}.',
    '- Never invent anything. If unsure, reply {"answers": [], "waiting": false}.',
    '',
    'If the newest line has who "unclear", the page cannot tell who is speaking. The line is also often several sentences: the adviser and the client talk fluidly, interrupt and answer each other in one breath.',
    'Work through the line in order and reply {"actions": [ ... ]}. Each action is one of:',
    '  {"do":"ask","field":"<id>"}          someone asks about, or moves to, one field ("and your second name?", "what do you do for work?")',
    '  {"do":"section","section":"<id>"}    someone moves to a whole topic ("let\'s talk about your health")',
    '  {"do":"fill","field":"<id>","value":"..."}   someone states the value of a field, WHOEVER says it',
    '  {"do":"confirm","field":"<id>"}      the value already in position.current_value is agreed to ("yes, that\'s right")',
    '  {"do":"wait"}                        the value in position.current_value is rejected and the new one has not come yet',
    'Facts count from either person: the adviser saying "your first name is John" and the client saying "my surname is Peters" each fill a field.',
    'Keep the order of the line. A question about a field comes before the answer to it, so "your first name is John and your second name? oh my second name is Peters" is',
    '[fill fname John, ask sname, fill sname Peters]. A plain statement straight after a question is the answer to position.field.',
    'Give {"actions": []} for acknowledgements and small talk ("okay great", "perfect", "thank you", "I see", "mm hm", "lovely"): they ask about nothing and answer nothing.',
    'Understand meaning, not exact words, and never invent a value that was not said. The value rules above apply to every fill.'
  ].join('\n');

  /* Blank out anything that looks like an email address or a long number (ID, phone, account). */
  function scrub(t) {
    return String(t == null ? '' : t)
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
      .replace(/\d(?:[\s-]?\d){8,}/g, '[number]')
      .replace(/\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)(?:\s+(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)){8,}\b/gi, '[number]');
  }

  /* ctx: { sectionId, targetId, targetValue, recent: [{who, text}] }; text/who are the newest line. */
  function buildRequest(idx, ctx, who, text, model) {
    var fields = idx.fields.filter(function (f) { return V.PRIVATE_IDS.indexOf(f.id) < 0; }).map(function (f) {
      var o = { id: f.id, label: f.label, section: f.sec };
      if (f.options && (f.sec === ctx.sectionId || f.id === ctx.targetId)) o.options = f.options;
      return o;
    });
    var body = {
      position: { section: ctx.sectionId, field: ctx.targetId || null, current_value: ctx.targetId && ctx.targetValue ? scrub(ctx.targetValue) : null },
      sections: idx.sections.map(function (s) { return { id: s.id, title: s.title }; }),
      fields: fields,
      recent: (ctx.recent || []).map(function (l) { return { who: l.who, text: scrub(l.text) }; }),
      newest: { who: who === 'client' ? 'client' : who === 'auto' ? 'unclear' : 'adviser', text: scrub(text) }
    };
    return { model: model, max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(body) }] };
  }

  function extractJson(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }
  function textOf(resp) {
    return (resp.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ');
  }

  /* Only ids that exist and are not private get through. -> { kind: 'point', field, section } | { kind: 'answers', answers, waiting } | { kind: 'none' } */
  function normalize(raw, idx, who) {
    if (!raw || typeof raw !== 'object') return { kind: 'none' };
    var okField = function (id) { return typeof id === 'string' && idx.byId[id] && V.PRIVATE_IDS.indexOf(id) < 0; };
    if (who === 'auto') {
      var okSec = function (id) { return typeof id === 'string' && idx.sections.some(function (x) { return x.id === id; }); }, acts = [];
      if (Array.isArray(raw.actions)) raw.actions.forEach(function (a) {
        if (!a || typeof a !== 'object') return;
        if (a.do === 'ask' && okField(a.field)) acts.push({ do: 'ask', field: a.field });
        else if (a.do === 'section' && okSec(a.section)) acts.push({ do: 'section', section: a.section });
        else if (a.do === 'fill' && okField(a.field) && a.value != null && String(a.value).trim() !== '') acts.push({ do: 'fill', field: a.field, value: String(a.value).trim() });
        else if (a.do === 'confirm' && okField(a.field)) acts.push({ do: 'confirm', field: a.field });
        else if (a.do === 'wait') acts.push({ do: 'wait' });
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

  /* Sends one request and resolves to the model's text. opts: { apiKey, fetchImpl } or { ask } (a host that reaches Claude without a key). */
  function callModel(opts, req) {
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
    var req = buildRequest(opts.idx, opts.ctx || {}, opts.who, opts.text, opts.model);
    return callModel(opts, req).then(function (text) { return normalize(extractJson(text), opts.idx, opts.who); });
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

  return { decide: decide, points: points, buildRequest: buildRequest, normalize: normalize, extractJson: extractJson, scrub: scrub, SYSTEM: SYSTEM };
});
