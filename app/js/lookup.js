/* "What does the company do?" look-up. Asks Claude, with web search, for a short summary of a company.
   The request goes straight from this browser to the Anthropic API using the API key saved in Settings.
   Written as plain fetch because this app is a static page with no build step. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.FF = root.FF || {}; root.FF.lookup = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';
  var DEFAULT_MODEL = 'claude-opus-5-5';
  var DEFAULT_VOICE_MODEL = 'claude-sonnet-5-5';
  var MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (lower cost)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (lowest cost)' }
  ];
  var SETTINGS_KEY = 'wr-fact-find-settings';

  function getSettings() {
    try { var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { apiKey: s.apiKey || '', model: s.model || DEFAULT_MODEL, voiceModel: s.voiceModel || DEFAULT_VOICE_MODEL, expires: s.expires || '' }; }
    catch (e) { return { apiKey: '', model: DEFAULT_MODEL, voiceModel: DEFAULT_VOICE_MODEL, expires: '' }; }
  }
  function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: String(s.apiKey || '').trim(), model: s.model || DEFAULT_MODEL, voiceModel: s.voiceModel || DEFAULT_VOICE_MODEL, expires: String(s.expires || '').trim() })); return true; } catch (e) { return false; } }

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

  function promptFor(name, kind) {
    var what = kind === 'business' ? 'the business' : 'the company or organisation';
    return 'Search the web for ' + what + ' called "' + name + '" (most likely in South Africa). ' +
      'In two or three plain sentences, no more than 60 words, say what it does. ' +
      'If you cannot identify it with confidence, reply exactly: Could not identify this company. ' +
      'Reply with the description only: no headings, no bullet points, no links and no citation marks.';
  }
  function buildRequest(name, kind, model, messages) {
    return {
      model: model || DEFAULT_MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'ZA' } }],
      messages: messages || [{ role: 'user', content: promptFor(name, kind) }]
    };
  }
  /* Only the model's own words: skip search calls, search results and thinking. */
  function extractText(resp) {
    return (resp.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ').replace(/\s+/g, ' ').trim();
  }
  function friendlyError(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'The API key was not accepted. Check it in Settings.';
    if (status === 403) return 'This API key is not allowed to do that. ' + msg;
    if (status === 429) return 'Too many requests just now. Wait a minute and try again.';
    if (/web.?search/i.test(msg)) return 'Web search is not switched on for this Anthropic account. ' + msg;
    return 'Anthropic said: ' + (msg || 'error ' + status);
  }

  /* Resolves to the summary text. opts: { apiKey, model, name, kind, fetchImpl } */
  function run(opts) {
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (!opts.apiKey) return Promise.reject(new Error('Add your Anthropic API key in Settings first.'));
    var messages = [{ role: 'user', content: promptFor(opts.name, opts.kind) }];
    function step(n) {
      return doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(buildRequest(opts.name, opts.kind, opts.model, messages))
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
  return { DEFAULT_MODEL: DEFAULT_MODEL, DEFAULT_VOICE_MODEL: DEFAULT_VOICE_MODEL, MODELS: MODELS, getSettings: getSettings, saveSettings: saveSettings, keyStatus: keyStatus, buildRequest: buildRequest, extractText: extractText, run: run, ENDPOINT: ENDPOINT };
});
