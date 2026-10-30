/* The Fact Find PDF mirrors the form: every box, heading, note and page of the screen is in it, in the same shape. jsPDF is replaced here by a recorder that keeps every piece of text the PDF would draw. */
const test = require('node:test');
const assert = require('node:assert');
const util = require('../app/js/util.js');
const schema = require('../app/js/schema.js');
const calc = require('../app/js/calc.js');
const store = require('../app/js/store.js');
const summary = require('../app/js/summary.js');
const actions = require('../app/js/actions.js');

let rec = [];
function makeDoc() {
  const doc = { lastAutoTable: { finalY: 0 }, pages: 1 };
  ['setDrawColor', 'setLineWidth', 'line', 'setFont', 'setFontSize', 'setTextColor', 'setFillColor', 'rect', 'addImage', 'setPage'].forEach(n => { doc[n] = () => doc; });
  doc.text = s => { [].concat(s).forEach(x => rec.push(String(x))); return doc; };
  doc.getTextWidth = s => String(s).length * 1.8;
  doc.splitTextToSize = s => [String(s)];
  doc.addPage = () => { doc.pages++; return doc; };
  doc.getNumberOfPages = () => doc.pages;
  doc.autoTable = o => {
    const cell = c => (c && typeof c === 'object' ? c.content : c);
    [].concat(o.head || [], o.body || [], o.foot || []).forEach(r => r.forEach(c => rec.push(String(cell(c) == null ? '' : cell(c)))));
    doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 10 };
    return doc;
  };
  return doc;
}
global.window = { FF: { util, schema, calc, store, summary, actions, logo: { data: '', w: 1, h: 1 } }, jspdf: { jsPDF: function () { return makeDoc(); } } };
require('../app/js/pdf.js');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const pdf = state => { rec = []; global.window.FF.pdf.build(state); return norm(rec.join(' ')); };
const set = (s, id, v) => store.setField(s, id, v);

/* a form with every block on and every box answered, a row in every list */
function filled() {
  const s = store.blank();
  Object.keys(schema.fieldsById).forEach(id => {
    const f = schema.fieldsById[id]; if (f.calc) return;
    let v = 'Sample ' + id; if (f.o) v = f.o[0]; if (f.money) v = 'R 1 000.00'; if (f.date) v = '14/03/2010';
    set(s, id, v);
  });
  ['has_risk', 'has_group', 'bizowner', 'biz_assur'].forEach(id => set(s, id, 'Yes')); set(s, 'marital', 'Married in community of property'); set(s, 'fname', 'Thandi'); set(s, 'sname', 'Dlamini');
  schema.panels.forEach(P => { if (P.dec) set(s, P.dec, schema.PRIORITY); });
  ['fna_req', 'sf_req', 'bf_fna_req', 'bf_sf_req'].forEach(id => set(s, id, 'Request a quote'));
  set(s, 'fna_ins', 'Old Mutual; Discovery'); set(s, 'ps_risk', 'Requested from client in meeting; Other'); set(s, 'ps_risk_ot', 'Employer will send');
  Object.keys(schema.lists).forEach(k => { const d = {}; schema.lists[k].cols.forEach(c => { d[c.k] = c.o ? c.o[0] : (c.money ? '1000' : 'Sample ' + c.k); }); store.addRow(s, k, d); });
  return s;
}

test('every box of every page is in the PDF under the label the screen shows, except those left off on purpose', () => {
  const s = filled(), text = pdf(s), ctx = store.ctxFor(s), misses = [];
  schema.sections.forEach(sec => {
    if (!calc.showIf(sec.cond, ctx)) return;
    sec.blocks.forEach(b => {
      if (!calc.showIf(b.cond, ctx) || b.sqd) return;                                                    // the standard quote details are one table, checked below
      (b.fields || []).forEach(f => { if (!f.nopdf && calc.showIf(f.cond, ctx) && !text.includes(norm(f.sl || f.l))) misses.push(sec.id + ': ' + (f.sl || f.l)); });
    });
  });
  assert.deepStrictEqual(misses, []);
  assert.ok(schema.fieldsById.profile.nopdf);                                                              // the public profile (LinkedIn) is left off the PDF on purpose
});

test('every heading, list and note of the screen is in the PDF', () => {
  const s = filled(), text = pdf(s), ctx = store.ctxFor(s), misses = [];
  schema.sections.forEach(sec => {
    if (!calc.showIf(sec.cond, ctx)) return;
    if (!text.includes(norm(sec.title))) misses.push('page ' + sec.title);
    if (sec.intro && !text.includes(norm(sec.intro))) misses.push('intro of ' + sec.title);
    const pri = {}; sec.blocks.forEach(b => { if (b.pri) pri[b.pri] = (pri[b.pri] || 0) + (b.head ? 0 : 1); });
    sec.blocks.forEach(b => {
      if (!calc.showIf(b.cond, ctx) || b.sqd || (b.fields && b.fields.length && b.fields.every(f => f.nopdf))) return;                 // a block left off the PDF has no heading either
      if (b.help && !text.includes(norm(b.help))) misses.push('note: ' + b.help.slice(0, 60));
      if (b.title && !b.head && !(b.pri && pri[b.pri] === 1) && !text.includes(norm(b.title))) misses.push('heading ' + b.title);               // an area with one block shows no heading for it, on the screen either
    });
  });
  schema.panels.forEach(P => { if (!text.includes(norm(P.title)) || !text.includes(norm(P.sub))) misses.push('area ' + P.title); });
  assert.deepStrictEqual(misses, []);
  assert.ok(/(?:^|[^a-z])summary/.test(rec.join(' ').toLowerCase()));
});

test('the Life quotes are drawn as the screen draws them: BrightRock Fractured and Standard side by side, then the standard quote details as one table', () => {
  const s = filled(); pdf(s);
  const all = rec.join(' | ');
  ['BrightRock: Fractured', 'built on the BrightRock Risk Calculation page', 'Standard', 'FNA quote', 'Shortfall quote', 'Reduced quotes', 'Insurer(s): Old Mutual; Discovery'].forEach(x => assert.ok(all.includes(x), x));
  ['Standard quote details: what to quote', 'Cover', 'Amount (R)', 'Term / age', 'ACI', 'ABI', 'Waiting', 'Comments', 'Life cover', 'Permanent disability', 'Income protection / sickness benefit', 'Dread disease'].forEach(x => assert.ok(all.includes(x), x));
  assert.ok(!/Standard: FNA quote|BrightRock Fractured: FNA quote|Life cover: standard/.test(all));                                             // no longer one block after another
  assert.ok(all.indexOf('Client decision') < all.indexOf('Summary') && all.indexOf('Summary') < all.indexOf('BrightRock: Fractured'));       // decision and comments, then the summary, then the quotes: as on the screen
});

test('the BrightRock Risk Calculation page and the renamed pages', () => {
  const s = filled(); set(s, 'bf_fna_req', 'Request a quote'); set(s, 'bf_fna_type', 'New Business');
  const text = pdf(s), all = rec.join(' | ');
  assert.ok(all.includes('Asked for on Client priorities and quotes needed') && all.includes('BrightRock Fractured: FNA (New Business)'));
  assert.ok(text.includes(norm('CLIENT PRIORITIES AND QUOTES NEEDED')) && text.includes(norm('BRIGHTROCK RISK CALCULATION')));
  ['Risk Calculation & Quotes', 'Client priorities identified', 'Fractured Covers', 'Standard Quotes'].forEach(x => assert.ok(!all.includes(x), 'no ' + x));
  const calcPart = all.slice(all.indexOf('BRIGHTROCK RISK CALCULATION'), all.indexOf('ADMIN'));
  assert.ok(calcPart.includes('Life cover: fractured cover') && calcPart.includes('Instalment Protector') && calcPart.includes('Dread disease: fractured cover'));
  assert.ok(!/Standard quote details|Sum assured|(?:Life cover|Permanent disability|sickness benefit|Dread disease): standard/.test(calcPart));                                                                  // BrightRock only: no standard quote on this page
});

test('a client who is not a business owner, an area that is not a priority and a client with no group', () => {
  const s = filled(); set(s, 'bizowner', 'No'); set(s, 'pr_inv', schema.NOT_PRIORITY); set(s, 'has_group', 'No');
  pdf(s); const all = rec.join(' | ');
  assert.ok(all.includes('Not applicable') && all.includes(schema.panelsById.biz.condMsg) && !all.includes('Buy & Sell quote'));              // business assurance is one line
  assert.ok(all.includes('The client said this is not a priority. The quote boxes are switched off.'));
  assert.strictEqual(all.split('No Group exists for a Shortfall Quote to be compiled').length - 1, 1);                                          // the shortfall row says so once, across the two kinds
  set(s, 'bizowner', 'Yes'); pdf(s); assert.ok(rec.join(' | ').includes('Business owner'));
  set(s, 'pr_life', schema.NOT_PRIORITY); pdf(s); const off = rec.join(' | ');
  assert.ok(!off.includes('BrightRock: Fractured') && !off.includes('Standard quote details'));                                                // Life not a priority: its quotes are left out
});

test('Medical aid and Gap cover are printed side by side, with all four notes boxes in the page', () => {
  const s = filled(), text = pdf(s);
  ['Medical aid', 'Gap cover', 'Will', 'Short-term insurance'].forEach(x => assert.ok(rec.join(' | ').includes(x), x));
  ['n_ma', 'n_gap', 'n_will', 'n_sti'].forEach(id => assert.ok(text.includes(norm('Sample ' + id)), id));
});

test('the instalment protector prints which debts are protected, the total of those that are, and what is switched off', () => {
  const s = filled(); set(s, 'net', 'R 60 000.00');
  store.addRow(s, 'debts', { type: 'Credit card', prov: 'Discovery Bank', inst: 'R 5 000.00' }); store.setProtect(s, s.l.debts.length - 1, false);
  pdf(s); const all = rec.join(' | ');
  assert.ok(all.includes('Instalment Protector') && all.includes('Protected') && all.includes('Not protected') && all.includes('Total instalments protected') && all.includes('Not protected (switched off)'));
  assert.ok(all.includes('Instalment protector: ') && /\d of \d debts protected/.test(all));
  store.setProtectAll(s, true); pdf(s); assert.ok(rec.join(' | ').includes('Instalment protector: all debts protected.') && !rec.join(' | ').includes('Not protected (switched off)'));
});
