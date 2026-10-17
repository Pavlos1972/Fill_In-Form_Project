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
    '- Never invent anything. If unsure, reply {"answers": [], "waiting": false}.'
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
      newest: { who: who === 'client' ? 'client' : 'adviser', text: scrub(text) }
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

  /* opts: { apiKey, model, idx, who, text, ctx, fetchImpl } -> Promise of the normalized answer. */
  function decide(opts) {
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (!opts.apiKey) return Promise.reject(new Error('no API key'));
    var req = buildRequest(opts.idx, opts.ctx || {}, opts.who, opts.text, opts.model);
    return doFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(req)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(friendly(res.status, body));
        return normalize(extractJson(textOf(body)), opts.idx, opts.who);
      });
    }, function () { throw new Error('no connection'); });
  }

  return { decide: decide, buildRequest: buildRequest, normalize: normalize, extractJson: extractJson, scrub: scrub, SYSTEM: SYSTEM };
});
