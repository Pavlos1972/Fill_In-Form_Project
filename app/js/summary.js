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

  /* What the form holds for one area, and nothing else: { fields: { id: value }, lists: { key: [ { col: value } ] } }. Boxes that do not apply (the area's quotes while it is not a priority,
     joint cover when there is no personal cover, ...) are left out, a list that applies but is empty is there as an empty list, so "none recorded" can be said. null for an area with no summary. */
  function areaData(state, id) {
    var P = schema.panelsById[id]; if (!P || !P.sum) return null;
    var ctx = store.ctxFor(state), out = { fields: {}, lists: {} };
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
    return out;
  }
  /* The same, with the boxes named by their labels, as it is sent to Claude. */
  function labelled(data) {
    var out = { facts: {}, lists: {} };
    Object.keys(data.fields).forEach(function (id) { out.facts[schema.fieldsById[id].l.replace(/^[^:]*: /, '')] = data.fields[id]; });
    Object.keys(data.lists).forEach(function (key) {
      var L = schema.lists[key];
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
  function fundLines(rows, type, label) {
    var mine = rows.filter(function (r) { return r.type === type; });
    return mine.length ? mine.map(function (r) { return label + ': ' + parts(r.prov, r.val && amt(r.val), pm(r.contrib), r.broker); }) : [label + ': none'];
  }
  var LOCAL = {
    life: function (d, L) {
      var out = [], risk = L.risk || [], grp = L.grp || [];
      if (d.has_risk === 'No') out.push('No personal risk cover in place');
      else {
        risk.forEach(function (r) { out.push('Personal risk cover: ' + parts(r.prov, pm(r.spend), r.broker, r.notes)); });
        if (d.has_risk === 'Yes' && !risk.length) out.push('Personal risk cover: yes, no policies recorded yet');
        if (d.joint) out.push('Joint life with spouse: ' + lower(d.joint));
      }
      if (d.has_group === 'No') out.push('No group risk through the employer');
      else if (d.has_group === 'Not sure') out.push('Not sure whether there is group risk');
      else if (d.has_group === 'Yes') { if (grp.length) grp.forEach(function (r) { out.push('Group risk: ' + parts(r.prov, pm(r.spend), r.broker, r.notes)); }); else out.push('Group risk through the employer: yes, no details recorded yet'); }
      (L.debts || []).filter(function (r) { return r.cl; }).forEach(function (r) { out.push('Credit life: ' + parts(r.type || r.desc, (r.prov || r.prov_other) && '(' + (r.prov || r.prov_other) + ')').replace(', (', ' (') + ': ' + lower(r.cl)); });
      var q = [];
      if (d.fna_req === 'Request a quote') q.push('FNA quote' + (d.fna_type && d.fna_type !== 'N/A' ? ' (' + lower(d.fna_type) + ')' : ''));
      if (d.sf_req === 'Request a quote') q.push('shortfall quote');
      (L.redq || []).filter(function (r) { return r.req === 'Request a quote'; }).forEach(function (r) { q.push('reduced quote' + (r.amt ? ' ' + pm(r.amt) : '')); });
      if (q.length) out.push('Quote asked for: ' + q.join(', '));
      return out;
    },
    ra: function (d, L) {
      var ret = L.ret || [], out = [];
      if (!ret.length) out.push('No retirement funds recorded');
      else ['Retirement annuity|Retirement annuity', 'Pension fund|Pension fund', 'Provident fund|Provident fund'].forEach(function (x) { var p = x.split('|'); out = out.concat(fundLines(ret, p[0], p[1])); });
      (L.raq || []).forEach(function (r) {
        if (r.req === 'Request a quote') out.push('RA quote asked for: ' + parts(r.ins, pm(r.monthly), r.lump && amt(r.lump) + ' lump sum'));
        else if (r.req === 'Cannot afford now') out.push('RA quote: client cannot afford it now');
        else if (r.req === 'Not interested') out.push('RA quote: client not interested');
      });
      return out;
    },
    rgar: function (d, L) {
      var ret = L.ret || [], out = [];
      if (!ret.length) out.push('No retirement funds recorded');
      else { out.push('Total saved across all retirement funds: ' + money(total(ret, 'val'))); out.push('Total contributions: ' + money(total(ret, 'contrib')) + ' p.m.'); }
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
      (L.invq || []).forEach(function (r) { out.push('Quote asked for: ' + parts(r.product, r.ins, pm(r.monthly), r.lump && amt(r.lump) + ' lump sum', r.purpose && '(' + lower(r.purpose) + ')').replace(', (', ' (')); });
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
    }
  };
  function local(state, id) {
    var data = areaData(state, id); if (!data || !LOCAL[id]) return [];
    return LOCAL[id](data.fields, data.lists).filter(Boolean);
  }
  /* The points to show and print for an area: Claude's, while the area still holds what it held when they were written; otherwise the page's own plain points. */
  function linesFor(state, id) {
    var data = areaData(state, id); if (!data) return { lines: [], by: 'form', fresh: true };
    var k = key(data), mine = state.sum && state.sum[id];
    if (mine && mine.lines && mine.lines.length && mine.key === k) return { lines: mine.lines, by: 'claude', fresh: true, at: mine.at };
    return { lines: LOCAL[id] ? LOCAL[id](data.fields, data.lists).filter(Boolean) : [], by: 'form', fresh: false, key: k };
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
