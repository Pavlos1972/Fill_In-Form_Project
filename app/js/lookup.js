/* "What does the company do?" look-up, and the client's public profile. Asks Claude, with web search, for a short summary.
   The request goes straight from this browser to the Anthropic API using the API key saved in Settings.
   Written as plain fetch because this app is a static page with no build step. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.lookup = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';
  /* The look-up (company description, LinkedIn search) uses web search, which reads many pages: it is the dearest thing the form does, so Sonnet is the default (Opus costs twice as much per token, and was the default until it used up a month's credit in testing). */
  var DEFAULT_MODEL = 'claude-sonnet-5-5';
  var DEFAULT_VOICE_MODEL = 'claude-sonnet-5-5';
  var DEFAULT_TRANSCRIBE = 'gpt-4o-transcribe';                                    // OpenAI's speech-to-text, used only when Settings > Speech source is OpenAI
  var TRANSCRIBE_MODELS = [
    { id: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe (most accurate, recommended)' },
    { id: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe (cheaper, a little less accurate)' },
    { id: 'whisper-1', label: 'whisper-1 (older)' }
  ];
  var MODELS = [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable, twice the cost)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' }
  ];
  /* What the voice model list shows: the choice for reading a conversation is Sonnet (it follows the instructions about read-backs, undo and fragments; Haiku invented answers and let its own thinking leak into
     the reply in the first recorded conversation). The look-up list above keeps its own recommendation. */
  var VOICE_MODELS = [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable, highest cost)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' }
  ];
  var LOOKUP_SETTING = 2;  // a look-up model saved before this version is replaced once by the default: Opus was the default then
  var VOICE_SETTING = 2;   // a voice model saved before this version is replaced once by the default: it was picked when Haiku was on offer without a recommendation
  var SETTINGS_KEY = 'wr-fact-find-settings';

  /* What Anthropic charges, in US dollars per million tokens (platform.claude.com/docs/en/about-claude/pricing, checked October 2026), and per web search.
     Only used for the running cost in the top bar, which is an estimate: the Console has the real figure. A model that is not listed is priced as the dearest one, so the meter never reads low. */
  var PRICES = {
    'claude-opus-5-5': { input: 4, output: 20, write: 5, read: 0.2 },
    'claude-sonnet-5-5': { input: 2, output: 10, write: 2.5, read: 0.1 },
    'claude-haiku-5-5': { input: 0.1, output: 0.5, write: 0.125, read: 0.01 }
  };
  var SEARCH_USD = 0.01;
  /* The cost in US dollars of one response, from its "usage" block. */
  function costOf(model, u) {
    var p = PRICES[model] || PRICES['claude-opus-5-5'], n = function (x) { return +x > 0 && isFinite(+x) ? +x : 0; };
    u = u || {};
    return (n(u.input_tokens) * p.input + n(u.output_tokens) * p.output + n(u.cache_creation_input_tokens) * p.write + n(u.cache_read_input_tokens) * p.read) / 1e6 +
      n(u.server_tool_use && u.server_tool_use.web_search_requests) * SEARCH_USD;
  }
  /* Adds one response to a running tally ({ usd, calls, input, output, read, write, searches }) and returns what it cost. */
  function addUsage(tally, model, u) {
    var c = costOf(model, u), n = function (x) { return +x > 0 && isFinite(+x) ? +x : 0; };
    u = u || {};
    tally.usd = (tally.usd || 0) + c; tally.calls = (tally.calls || 0) + 1;
    tally.input = (tally.input || 0) + n(u.input_tokens); tally.output = (tally.output || 0) + n(u.output_tokens);
    tally.read = (tally.read || 0) + n(u.cache_read_input_tokens); tally.write = (tally.write || 0) + n(u.cache_creation_input_tokens);
    tally.searches = (tally.searches || 0) + n(u.server_tool_use && u.server_tool_use.web_search_requests);
    return c;
  }

  function getSettings() {
    try { var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { openaiKey: s.openaiKey || '', openaiModel: s.openaiModel || DEFAULT_TRANSCRIBE, apiKey: s.apiKey || '', model: s.modelSet === LOOKUP_SETTING && s.model ? s.model : DEFAULT_MODEL, voiceModel: s.voiceSet === VOICE_SETTING && s.voiceModel ? s.voiceModel : DEFAULT_VOICE_MODEL, expires: s.expires || '' }; }
    catch (e) { return { openaiKey: '', openaiModel: DEFAULT_TRANSCRIBE, apiKey: '', model: DEFAULT_MODEL, voiceModel: DEFAULT_VOICE_MODEL, expires: '' }; }
  }
  function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: String(s.openaiKey || '').trim(), openaiModel: s.openaiModel || DEFAULT_TRANSCRIBE, apiKey: String(s.apiKey || '').trim(), model: s.model || DEFAULT_MODEL, modelSet: LOOKUP_SETTING, voiceModel: s.voiceModel || DEFAULT_VOICE_MODEL, voiceSet: VOICE_SETTING, expires: String(s.expires || '').trim() })); return true; } catch (e) { return false; } }

  /* How the top bar describes the key: nothing without a key, then days left until the date typed in Settings. */
  function keyStatus(set, now) {
    if (!set.apiKey) return { level: 'none', text: '' };
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(set.expires || '');
    if (!m) return { level: 'unset', text: 'Key: add expiry date' };
    var t = now || new Date(), end = new Date(+m[1], +m[2] - 1, +m[3]), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var days = Math.round((end - today) / 86400000);
    if (days < 0) return { level: 'expired', days: days, text: 'Key expired. Renew it in Settings' };
    if (days === 0) return { level: 'soon', days: 0, text: 'Key expires today' };
    return { level: days <= 14 ? 'soon' : 'ok', days: days, text: 'Key: ' + days + (days === 1 ? ' day' : ' days') + ' left' };
  }

  /* extra: for a person, { org, role }: who they work for (or own) and their occupation, so the right person is found. Nothing else about them is sent. */
  function promptFor(name, kind, extra) {
    if (kind === 'person') return personPrompt(name, extra || {});
    var what = kind === 'business' ? 'the business' : 'the company or organisation';
    return 'Search the web for ' + what + ' called "' + name + '" (most likely in South Africa). ' +
      'In two or three plain sentences, no more than 60 words, say what it does. ' +
      'If you cannot identify it with confidence, reply exactly: Could not identify this company. ' +
      'Reply with the description only: no headings, no bullet points, no links and no citation marks.';
  }
  /* A client's public professional profile (LinkedIn and other public pages), for the adviser to check. The best match is given, with how sure it is. */
  function personPrompt(name, x) {
    var who = '"' + name + '"' + (x.org ? ', who works for, or owns, "' + x.org + '"' : '') + (x.role ? ', as ' + x.role : '');
    return 'A South African financial adviser is preparing for a meeting with a client. Search the public web, LinkedIn in particular, for the most likely public profile of the professional ' + who + ' (most likely in South Africa). ' +
      'Use only publicly available information. Match as best you can: use the employer and the occupation to choose between people with the same name, and never mix two people up. ' +
      'In at most 70 words, in plain sentences, start with "Likely match:" when the name and the employer or occupation clearly agree, or "Possible match, check it:" when only some of it agrees. ' +
      'Then say who they work for and what they do: their role, the employer and what the employer does, and for how long if it is clear. ' +
      'If nobody plausible turns up, reply exactly: No public profile found that clearly matches. ' +
      'Say nothing about family, health, money, age, address or any other personal matter. ' +
      'End with "Source: " and the web address of the page you relied on. Reply with that text only: no headings, no bullet points and no citation marks.';
  }
  function buildRequest(name, kind, model, messages, extra) {
    return {
      model: model || DEFAULT_MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: kind === 'person' ? 4 : 3, user_location: { type: 'approximate', country: 'ZA' } }],
      messages: messages || [{ role: 'user', content: promptFor(name, kind, extra) }]
    };
  }
  /* Only the model's own words, and only its answer: search calls, search results and thinking are skipped, and so is what it said to itself between searches ("That's Australian. Try South Africa once more."
     was written into a company's description in a meeting). The answer is the text after the last search. */
  function extractText(resp) {
    var out = [];
    (resp.content || []).forEach(function (b) { if (b.type === 'text') out.push(b.text); else if (b.type === 'server_tool_use' || b.type === 'web_search_tool_result' || b.type === 'tool_use') out = []; });
    return out.join(' ').replace(/\s+/g, ' ').trim();
  }
  function friendlyError(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'The API key was not accepted. Check it in Settings.';
    if (status === 403) return 'This API key is not allowed to do that. ' + msg;
    if (status === 429) return 'Too many requests just now. Wait a minute and try again.';
    if (/web.?search/i.test(msg)) return 'Web search is not switched on for this Anthropic account. ' + msg;
    return 'Anthropic said: ' + (msg || 'error ' + status);
  }

  /* Resolves to the summary text. opts: { apiKey, model, name, kind ('company' | 'business' | 'person'), org?, role?, fetchImpl } */
  function run(opts) {
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (!opts.apiKey) return Promise.reject(new Error('Add your Anthropic API key in Settings first.'));
    var messages = [{ role: 'user', content: promptFor(opts.name, opts.kind, opts) }];
    function step(n) {
      return doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(buildRequest(opts.name, opts.kind, opts.model, messages, opts))
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(friendlyError(res.status, body));
          if (body.stop_reason === 'refusal') throw new Error('Claude could not complete this look-up.');
          if (body.stop_reason === 'pause_turn' && n < 4) { messages.push({ role: 'assistant', content: body.content }); return step(n + 1); }
          var text = extractText(body);
          if (!text) throw new Error('No description came back. Try again.');
          return text;
        });
      }, function () {
        throw new Error('Could not reach Anthropic. Check the internet connection. If this keeps happening the browser may be blocking the request.');
      });
    }
    return step(0);
  }

  /* Without web search (the practice page, which reaches Claude but has no key): what Claude itself knows about a company, or "Could not identify this company."
     opts: { ask(system, user) -> text, name, kind ('company' | 'business') }. Never used for a person: a guess about a private individual is worse than no answer. */
  function runAsk(opts) {
    var what = opts.kind === 'business' ? 'business' : 'company or organisation';
    var system = 'You tell a South African financial adviser, in two or three plain sentences and no more than 60 words, what a ' + what + ' does. ' +
      'Only answer when you really know this ' + what + '; never guess from the name alone. ' +
      'Reply with ONE JSON object and nothing else: {"description": "..."}, or {"description": null} when you are not sure.';
    return Promise.resolve().then(function () { return opts.ask(system, JSON.stringify({ name: opts.name })); }).then(function (text) {
      var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}'), d = null;
      try { d = JSON.parse(s.slice(a, b + 1)).description; } catch (e) { d = null; }
      d = typeof d === 'string' ? d.replace(/\s+/g, ' ').trim() : '';
      return d || 'Could not identify this company.';
    }, function (e) { throw new Error('Could not reach Claude (' + ((e && (e.message || e.code)) || 'no connection') + ').'); });
  }
  return { DEFAULT_MODEL: DEFAULT_MODEL, DEFAULT_VOICE_MODEL: DEFAULT_VOICE_MODEL, MODELS: MODELS, VOICE_MODELS: VOICE_MODELS, TRANSCRIBE_MODELS: TRANSCRIBE_MODELS, DEFAULT_TRANSCRIBE: DEFAULT_TRANSCRIBE, PRICES: PRICES, costOf: costOf, addUsage: addUsage, getSettings: getSettings, saveSettings: saveSettings, keyStatus: keyStatus, buildRequest: buildRequest, promptFor: promptFor, extractText: extractText, run: run, runAsk: runAsk, ENDPOINT: ENDPOINT };
});
