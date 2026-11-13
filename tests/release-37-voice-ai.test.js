/* Release 3.7, the layer between Claude and the form: strict row numbers, rejected answers shown, "done" must name something, a figure must be in the words it came from,
   a point with an amount nobody gave is dropped, and Claude is told which boxes were emptied on purpose. */
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../app/js/schema.js');
const V = require('../app/js/voice.js');
const AI = require('../app/js/voice-ai.js');
const A = require('../app/js/actions.js');
const store = require('../app/js/store.js');
const idx = V.buildIndex(schema);

test('a row number is a number, digits, "last" or "new"; anything else is not guessed at and is shown', () => {
  const n = raw => AI.normalize(raw, idx, 'auto', {});
  assert.strictEqual(n({ actions: [{ do: 'cell', list: 'debts', row: '2', col: 'bal', value: '5000' }] }).actions[0].row, 2);
  assert.strictEqual(n({ actions: [{ do: 'cell', list: 'debts', col: 'bal', value: '5000' }] }).actions[0].row, 'last');
  ['second', 0, 2.5, {}, 'two'].forEach(row => { const r = n({ actions: [{ do: 'cell', list: 'debts', row, col: 'bal', value: '5000' }] }); assert.ok(!r.actions && r.unplaced && /does not make sense/.test(r.unplaced[0].text), JSON.stringify(row)); });
  assert.ok(!n({ actions: [{ do: 'empty', list: 'debts', row: 0, col: 'bal' }] }).actions, 'an empty with a bad row empties nothing');
});

test('"done" that names no section and no list is dropped', () => {
  const r = AI.normalize({ actions: [{ do: 'done' }, { do: 'done', section: 'debts' }] }, idx, 'auto', {});
  assert.deepStrictEqual(r.actions.map(a => a.section), ['debts']);
});

test('the catch-up check drops a figure that is not in the words it quotes', () => {
  const tr = [{ who: 'client', text: 'The balance is about 450 000 and I pay 6 500 a month' }];
  const keep = AI.verifySaid({ kind: 'actions', actions: [{ do: 'fill', field: 'x', value: 'R 450 000.00', said: 'The balance is about 450 000' }] }, tr);
  assert.strictEqual(keep.kind, 'actions');
  const drop = AI.verifySaid({ kind: 'actions', actions: [{ do: 'fill', field: 'x', value: 'R 900 000.00', said: 'The balance is about 450 000' }] }, tr);
  assert.strictEqual(drop.kind, 'none'); assert.match(drop.dropped[0], /not said/);
});

test('an action point or a focus line with an amount that is nowhere in the facts is dropped', async () => {
  const s = store.blank(); store.setField(s, 'fname', 'Edwin'); store.setField(s, 'pr_life', schema.PRIORITY); store.setField(s, 'bf_fna_req', 'Request a quote'); store.setField(s, 'bf_fna_type', 'New Business'); store.setField(s, 'pref_spend', 'R 2 500.00');
  const f = A.facts(s);
  const out = await AI.actionPoints({ ask: () => Promise.resolve('{"points": [{"text": "Note for the life quotes that the client Edwin prefers to spend R 2 500 p.m.", "from": "spend"}, {"text": "Request a quote for R 9 999 p.m.", "from": "quotes"}]}'), model: 'm', facts: f });
  assert.deepStrictEqual(out.filter(p => /2 500|9 999/.test(p)), ['Note for the life quotes that the client Edwin prefers to spend R 2 500 p.m.']);
  const focus = A.focusFacts(s);
  const by = await AI.focusPoints({ ask: () => Promise.resolve('{"areas": {"1": {"recommend": "Needs analysis, then a reduced quote at R 2 500 p.m.", "client": "Agrees; wants R 12 345", "back": ["Review"]}}}'), model: 'm', facts: focus });
  assert.strictEqual(by[1].recommend, 'Needs analysis, then a reduced quote at R 2 500 p.m.'); assert.strictEqual(by[1].client, '', 'the line with an invented amount is left out');
});

test('Claude is told which boxes were emptied on purpose', () => {
  const req = AI.buildRequest(idx, { sectionId: 'debts', recent: [], emptied: ['debts row 2 bal', 'fname'] }, 'auto', 'the balance is 5000', 'm');
  const body = JSON.parse(req.messages[0].content);
  assert.deepStrictEqual(body.emptied, ['debts row 2 bal', 'fname']);
  assert.match(AI.SYSTEM, /"emptied"[\s\S]*emptied ON PURPOSE/);
  assert.ok(!('emptied' in JSON.parse(AI.buildRequest(idx, { sectionId: 'debts', recent: [] }, 'auto', 'x', 'm').messages[0].content)));
});
