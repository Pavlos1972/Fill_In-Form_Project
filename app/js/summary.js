/* The short summaries on the Client priorities page: what the client has in each area (Life, RA, RGAR, Invest, EGAR, Medical Aid, Will, Short Term), so the adviser can recommend.
   An area's summary is written only from that area's own boxes and lists (schema.panels[].sum), so it never speaks about anything else.
   Claude writes the points (voice-ai.js, summarise). Until it has, or when it cannot be reached, the page writes plain points from the same facts (local). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./schema.js'), require('./calc.js'), require('./store.js'));
  else { root.FF = root.FF || {}; root.FF.summary = factory(root.FF.util, root.FF.schema, root.FF.calc, root.FF.store); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc, store) {
  var blockOfField = {}, blockOfList = {};
  schema.sections.forEach(function (s) { s.blocks.forEach(function (b) {
    (b.fields || []).forEach(function (f) { blockOfField[f.id] = b; });
    if (b.list && !blockOfList[b.list]) blockOfList[b.list] = b;
  }); });

  /* What the form holds for one area, and nothing else: { fields: { id: value }, lists: { key: [ { col: value } ] }, totals: { label: amount } }. Boxes that do not apply (the area's quotes while it is not a priority,
     joint cover when there is no personal cover, ...) are left out, a list that applies but is empty is there as an empty list, so "none recorded" can be said. Totals are added up here (a total with nothing under it is left out).
     null for an area with no summary, or for one that does not apply to this client (Business assurance for a client who is not a business owner). */
  function areaData(state, id) {
    var P = schema.panelsById[id]; if (!P || !P.sum) return null;
    var ctx = store.ctxFor(state), out = { fields: {}, lists: {}, totals: {} };
    if (!calc.showIf(P.cond, ctx)) return null;
    P.sum.f.forEach(function (fid) {
      var f = schema.fieldsById[fid], b = blockOfField[fid];
      if (!f || (b && !calc.showIf(b.cond, ctx)) || !calc.showIf(f.cond, ctx)) return;
      var v = String(state.f[fid].v == null ? '' : state.f[fid].v).trim();
      if (v) out.fields[fid] = v;
    });
    Object.keys(P.sum.l).forEach(function (key) {
      var L = schema.lists[key], b = blockOfList[key];
      if (b && !calc.showIf(b.cond, ctx)) return;
      var cols = P.sum.l[key] || L.cols.map(function (c) { return c.k; });
      out.lists[key] = state.l[key].map(function (r) {
        var o = {};
        cols.forEach(function (k) {
          var c = L.cols.filter(function (x) { return x.k === k; })[0], v = c.calc ? calc.rowCalc(c.calc, r, ctx) : r.d[k];
          v = String(v == null ? '' : v).trim(); if (v) o[k] = v;
        });
        return o;
      }).filter(function (o) { return Object.keys(o).length; });
    });
    (P.sum.t || []).forEach(function (t) {
      var n = 0, any = false;
      t[1].forEach(function (lc) { (state.l[lc[0]] || []).forEach(function (r) { if (lc[2] && r.d[lc[2]] !== lc[3]) return; if (String(r.d[lc[1]] == null ? '' : r.d[lc[1]]).trim() !== '') { any = true; n += util.num(r.d[lc[1]]); } }); });
      if (any) out.totals[t[0]] = amt(util.money(n));
    });
    return out;
  }
  /* The same, with the boxes named by their labels, as it is sent to Claude (lists with no rows are left out; the totals go in with the facts). */
  function labelled(data) {
    var out = { facts: {}, lists: {} };
    Object.keys(data.fields).forEach(function (id) { var f = schema.fieldsById[id]; out.facts[(f.vl || f.l).replace(/^[^:]*: /, '')] = data.fields[id]; });       // vl: the label that tells the two kinds of life quote apart
    Object.keys(data.totals || {}).forEach(function (l) { out.facts[l] = data.totals[l]; });
    Object.keys(data.lists).forEach(function (key) {
      var L = schema.lists[key];
      if (!data.lists[key].length) return;                                         // a list with no rows is not mentioned: nothing asked yet is not the same as none
      out.lists[L.title] = data.lists[key].map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[L.cols.filter(function (c) { return c.k === k; })[0].l] = r[k]; }); return o; });
    });
    return out;
  }
  /* What an area held when its summary was written: a summary is out of date when this has changed. */
  function key(data) {
    var s = JSON.stringify(data), h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  }

  /* ---------- plain points, from the facts, for when Claude has not written them (yet) ---------- */
  function amt(v) { return String(v || '').replace(/\.00$/, ''); }
  function pm(v) { return v ? amt(v) + ' p.m.' : ''; }
  function parts() { return [].slice.call(arguments).filter(function (x) { return x != null && String(x).trim() !== ''; }).join(', '); }
  function total(rows, k) { return rows.reduce(function (a, r) { return a + util.num(r[k]); }, 0); }
  function money(n) { return amt(util.money(n)); }
  function lower(s) { return String(s || '').toLowerCase(); }
  var LOCAL = {
    life: function (d, L, T) {
      var out = [], risk = L.risk || [], grp = L.grp || []; T = T || {};
      if (d.has_risk === 'No') out.push('No personal risk cover in place');
      else {
        risk.forEach(function (r) { out.push('Personal risk cover: ' + parts(r.prov, pm(r.spend), r.broker, r.notes)); });
        if (d.has_risk === 'Yes' && !risk.length) out.push('Personal risk cover: yes, no policies recorded yet');
        if (d.joint) out.push('Joint life with spouse: ' + lower(d.joint));
      }
      if (d.has_group === 'No') out.push('No group risk through the employer');
      else if (d.has_group === 'Not sure') out.push('Not sure whether there is group risk');
      else if (d.has_group === 'Yes') { if (grp.length) grp.forEach(function (r) { out.push('Group risk: ' + parts(r.prov, pm(r.spend), r.broker, r.notes)); }); else out.push('Group risk through the employer: yes, no details recorded yet'); }
      (L.debts || []).filter(function (r) { return r.cl; }).forEach(function (r) { out.push('Credit life: ' + parts(r.type || r.desc, r.prov && '(' + r.prov + ')').replace(', (', ' (') + ': ' + lower(r.cl)); });
      var br = [], std = [], ins = function (v) { var a = String(v || '').split(';').map(function (x) { return x.trim(); }).filter(Boolean); return a.length ? ' from ' + a.join(', ') : ''; };
      if (d.bf_fna_req === 'Request a quote') br.push('FNA quote' + (d.bf_fna_type && d.bf_fna_type !== 'N/A' ? ' (' + lower(d.bf_fna_type) + ')' : ''));
      if (d.bf_sf_req === 'Request a quote') br.push('shortfall quote' + (d.bf_sf_type && d.bf_sf_type !== 'N/A' ? ' (' + lower(d.bf_sf_type) + ')' : ''));
      (L.bfred || []).filter(function (r) { return r.req === 'Request a quote'; }).forEach(function (r) { br.push('reduced quote' + (r.amt ? ' ' + pm(r.amt) : '')); });
      if (d.fna_req === 'Request a quote') std.push('FNA quote' + (d.fna_type && d.fna_type !== 'N/A' ? ' (' + lower(d.fna_type) + ')' : '') + ins(d.fna_ins));
      if (d.sf_req === 'Request a quote') std.push('shortfall quote' + (d.sf_type && d.sf_type !== 'N/A' ? ' (' + lower(d.sf_type) + ')' : '') + ins(d.sf_ins));
      (L.redq || []).filter(function (r) { return r.req === 'Request a quote'; }).forEach(function (r) { std.push('reduced quote' + (r.amt ? ' ' + pm(r.amt) : '') + ins(r.ins)); });
      if (d.pref_spend) out.push('Preferred monthly spend on life cover: ' + amt(d.pref_spend) + ' p.m.');
      if (br.length) out.push('BrightRock Fractured quote asked for: ' + br.join(', '));
      if (std.length) out.push('Standard quote asked for: ' + std.join(', '));
      Object.keys(T).forEach(function (l) { out.push(l + ': ' + T[l] + (/monthly/.test(l) ? ' p.m.' : '')); });
      return out;
    },
    ra: function (d, L) {
      var ra = L.ret_ra || [], pp = L.ret_pp || [], out = [];
      if (!ra.length && !pp.length) out.push('No retirement funds recorded yet');
      else {
        if (ra.length) ra.forEach(function (r) { out.push('Retirement annuity: ' + parts(r.prov, r.val && amt(r.val), pm(r.contrib), r.broker)); }); else out.push('Retirement annuity: none');
        if (pp.length) pp.forEach(function (r) { out.push((r.type || 'Pension or provident fund') + ': ' + parts(r.prov, r.val && amt(r.val), pm(r.contrib), r.broker)); }); else out.push('Pension or provident fund: none');
      }
      (L.raq || []).forEach(function (r) {
        if (r.req === 'Request a quote') out.push('RA quote asked for: ' + parts(r.ins, pm(r.monthly), r.lump && amt(r.lump) + ' lump sum'));
        else if (r.req === 'Cannot afford now') out.push('RA quote: client cannot afford it now');
        else if (r.req === 'Not interested') out.push('RA quote: client not interested');
      });
      return out;
    },
    rgar: function (d, L, T) {
      var out = []; T = T || {};
      if (!Object.keys(T).length) out.push('No retirement funds recorded yet');
      else Object.keys(T).forEach(function (l) { out.push(l + ': ' + T[l] + (/monthly/.test(l) ? ' p.m.' : '')); });
      if (d.ret_age || d.ret_net) out.push('Wants to retire' + (d.ret_age ? ' at ' + d.ret_age : '') + (d.ret_net ? ' on ' + pm(d.ret_net) + ' net, in today\'s terms' : ''));
      else out.push('Retirement age and income goal not captured yet');
      out.push('RGAR: ' + (d.rgar_req === 'Request an RGAR' ? 'requested' : d.rgar_req === 'Not required' ? 'not required' : 'not yet requested'));
      return out;
    },
    inv: function (d, L) {
      var inv = L.inv || [], out = [];
      if (!inv.length) out.push('No investments recorded');
      else {
        inv.forEach(function (r) { out.push(parts(r.type, r.prov, r.val && amt(r.val), pm(r.prem), r.broker)); });
        ['Tax-free savings', 'Endowment'].forEach(function (t) { if (!inv.some(function (r) { return r.type === t; })) out.push(t + ': none'); });
        out.push('Total invested: ' + money(total(inv, 'val')));
      }
      (L.invq || []).filter(function (r) { return r.req === 'Request a quote'; }).forEach(function (r) { out.push('Quote asked for: ' + parts(r.product, r.ins, pm(r.monthly), r.lump && amt(r.lump) + ' lump sum', r.purpose && '(' + lower(r.purpose) + ')').replace(', (', ' (')); });
      return out;
    },
    egar: function (d, L) {
      var kids = L.kids || [], out = [];
      if (!kids.length) out.push('No children recorded, so no education to plan for');
      else {
        out.push('Children: ' + kids.length);
        kids.forEach(function (r, i) { var p = parts(r.age, r.stage); if (p) out.push('Child ' + (i + 1) + ': ' + p); });
        if (total(kids, 'cost')) out.push('Education and childcare cost today: ' + money(total(kids, 'cost')) + ' p.m.');
      }
      out.push('EGAR: ' + (d.egar_req === 'Request an EGAR' ? 'requested' : d.egar_req === 'Not required' ? 'not required' : 'not yet requested'));
      return out;
    },
    med: function (d) {
      var out = [];
      if (d.ma === 'None') out.push('Medical aid: none');
      else if (d.ma) out.push(d.ma + ': ' + parts(d.ma_prov, d.ma_plan, d.ma_broker));
      if (d.gap === 'No') out.push('Gap cover: none');
      else if (d.gap === 'Yes') out.push('Gap cover: ' + parts(d.gap_prov || 'yes', d.gap_broker));
      if (!out.length) out.push('Nothing recorded yet for medical aid or gap cover');
      if (d.ref_med && d.ref_med !== 'Not required') out.push('Referral: ' + d.ref_med);
      return out;
    },
    will: function (d) {
      var out = [];
      if (d.will === 'No') out.push('No will in place');
      else if (d.will === 'Yes') {
        out.push('Has a will' + (d.will_where ? ': held with ' + (d.will_where === 'Other provider' && d.will_where_other ? d.will_where_other : d.will_where) : ''));
        if (d.will_date) out.push('Last updated: ' + d.will_date);
        if (d.will_up) out.push(d.will_up === 'Yes' ? 'Will is up to date' : 'Will is not up to date');
        if (d.will_broker) out.push('Broker on record: ' + d.will_broker);
      } else out.push('Nothing recorded yet about a will');
      if (d.ref_will && d.ref_will !== 'Not interested') out.push('Referral: ' + d.ref_will);
      return out;
    },
    st: function (d) {
      var out = [];
      if (d.sti === 'No') out.push('No short-term insurance');
      else if (d.sti === 'Handled by spouse') out.push('Short-term insurance is handled by the spouse');
      else if (d.sti === 'Yes') {
        out.push('Has short-term insurance' + (d.sti_broker ? ': ' + d.sti_broker : ''));
        var cov = [['sti_car', 'car'], ['sti_house', 'household contents'], ['sti_struct', 'structure']].filter(function (x) { return d[x[0]] === 'Yes'; }).map(function (x) { return x[1]; });
        if (cov.length) out.push('Insured: ' + cov.join(', '));
        if (d.sti_personal) out.push('Personal spend: ' + pm(d.sti_personal));
        if (d.sti_biz === 'Yes') out.push('Business insured' + (d.sti_biz_spend ? ': ' + pm(d.sti_biz_spend) : ''));
      } else out.push('Nothing recorded yet about short-term insurance');
      if (d.ref_sti) out.push('Referral: ' + d.ref_sti);
      return out;
    },
    biz: function (d, L) {
      var out = [], pol = L.bizpol || [], sh = L.shares || [];
      pol.forEach(function (r) { out.push((r.type || 'Business assurance') + ': ' + parts(r.prov, r.cover && 'cover ' + amt(r.cover), pm(r.prem), r.paid && 'paid by ' + lower(r.paid).replace(/^the /, ''), r.broker, r.notes)); });
      if (d.biz_assur === 'No') out.push('No business assurance in place');
      else if (d.biz_assur === 'Not sure') out.push('Not sure whether there is business assurance');
      else if (d.biz_assur === 'Yes' && !pol.length) out.push('Business assurance in place: yes, no policies recorded yet');
      if (d.biz_partners === 'Yes') out.push('Has partners or co-owners' + (sh.length ? ': ' + sh.map(function (r) { return [r.name, r.pct && r.pct + '%'].filter(Boolean).join(' '); }).join('; ') : '') + (d.biz_pct ? ' (client holds ' + d.biz_pct + '%)' : ''));
      else if (d.biz_partners === 'No') out.push('No partners or co-owners');
      if (d.biz_loans === 'Yes') out.push('Business loans or surety signed: yes');
      else if (d.biz_loans === 'Unsure') out.push('Business loans or surety signed: unsure');
      if (!out.length) out.push('Nothing recorded yet about business assurance');
      return out;
    }
  };
  function local(state, id) {
    var data = areaData(state, id); if (!data || !LOCAL[id]) return [];
    return LOCAL[id](data.fields, data.lists, data.totals).filter(Boolean);
  }
  /* The points to show and print for an area: Claude's, while the area still holds what it held when they were written; otherwise the page's own plain points. */
  function linesFor(state, id) {
    var data = areaData(state, id), P = schema.panelsById[id];
    if (!data) return { lines: P && P.sum && P.cond ? ['Not applicable: the client is not a business owner'] : [], by: 'form', fresh: true };
    var k = key(data), mine = state.sum && state.sum[id];
    if (mine && mine.lines && mine.lines.length && mine.key === k) return { lines: mine.lines, by: 'claude', fresh: true, at: mine.at };
    return { lines: LOCAL[id] ? LOCAL[id](data.fields, data.lists, data.totals).filter(Boolean) : [], by: 'form', fresh: false, key: k };
  }
  /* The areas whose summary is missing or out of date (all the areas asked for when force is set), and the facts to send for them: { id: { area, key, data } }
     (labelled boxes only; the page's private numbers are not among them). */
  function stale(state, ids, force) {
    var out = {};
    (ids || schema.panels.filter(function (p) { return p.sum; }).map(function (p) { return p.id; })).forEach(function (id) {
      var data = areaData(state, id); if (!data) return;
      if (linesFor(state, id).fresh && !force) return;
      out[id] = { area: schema.panelsById[id].title, key: key(data), data: labelled(data) };
    });
    return out;
  }

  return { areaData: areaData, labelled: labelled, key: key, local: local, linesFor: linesFor, stale: stale };
});
