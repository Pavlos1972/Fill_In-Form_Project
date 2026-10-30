const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3]; const N = +process.argv[4] || 120;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:' + srv.address().port + '/');
  const res = await p.evaluate(async (N) => {
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const pick = a => a[Math.floor(rnd() * a.length)];
    const sc = FF.schema, st = FF.store, secs = sc.sections.map(s => s.id); const problems = {}; const add = (k, d) => { (problems[k] = problems[k] || []).push(d); };
    const bad = /undefined|NaN|\[object|null(?![a-z])/; const times = { render: 0, pdf: 0 };
    const WORDS = ['Zulu Holdings', 'O\'Brien & Sons', 'Ünïcode Ço', 'a'.repeat(300), '<b>x</b>', '"quoted"', '  spaced  ', '0', '-5', '1e9', 'R 1 000', '15/13/2020', '31/02/2021'];
    for (let n = 0; n < N; n++) {
      const s = st.blank(); const dens = rnd();
      Object.keys(sc.fieldsById).forEach(id => { const f = sc.fieldsById[id]; if (f.calc || rnd() > dens) return;
        let v; if (f.t === 'multi') v = f.o.filter(() => rnd() < 0.4).join('; '); else if (f.o) v = rnd() < 0.1 ? 'Not an option' : pick(f.o); else if (f.money) v = pick(['R 1 000.00', '60000', '0', '-100', 'R 99 999 999.99', 'abc', '']); else if (f.date) v = pick(['14/03/2010', '2026-10-17', '31/02/2021', 'garbage', '']); else v = pick(WORDS);
        st.setField(s, id, v); });
      Object.keys(sc.lists).forEach(k => { const rows = Math.floor(rnd() * 4); for (let i = 0; i < rows; i++) { const d = {}; sc.lists[k].cols.forEach(c => { d[c.k] = rnd() < 0.2 ? '' : c.o ? pick(c.o) : c.money ? pick(['1000', '0', '-5', 'R 2 500.00', 'x']) : c.date ? '14/03/2012' : pick(WORDS); }); const r = st.addRow(s, k, d, pick(['confirmed', 'heard', 'verify'])); if (k === 'debts' && rnd() < 0.3) r.off = true; } });
      try { FF.app.setState(s); } catch (e) { add('setState throws', e.message); continue; }
      // every page
      for (const sec of secs) { try { document.querySelector('.nav button[data-sec="' + sec + '"]').click(); const t0 = performance.now(); FF.app.redraw(); times.render += performance.now() - t0;
          const main = document.getElementById('main'); const txt = main.innerText; const inputs = [...main.querySelectorAll('input,select,textarea')].map(e => e.value).join(' ');
          const m = bad.exec(txt); if (m) add('page text shows "' + m[0] + '"', sec + ' #' + n + ': ...' + txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' '));
          const fs = [...main.querySelectorAll('[data-f]')].map(e => e.dataset.f); const dup = fs.filter((x, i) => fs.indexOf(x) !== i); if (dup.length) add('the same box drawn twice on a page', sec + ': ' + [...new Set(dup)].join(','));
          const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const did = ids.filter((x, i) => ids.indexOf(x) !== i); if (did.length) add('duplicate html id', sec + ': ' + [...new Set(did)].join(','));
          main.querySelectorAll('button').forEach(bt => { if (!bt.getAttribute('type')) add('button without a type', sec + ': ' + bt.textContent.slice(0, 30)); });
          main.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),select,textarea').forEach(e => { if (!e.closest('label') && !e.getAttribute('aria-label') && !e.closest('[data-field]') && !e.closest('td') && !e.closest('.ms')) add('a box with no label', sec + ': ' + (e.dataset.f || e.className)); });
        } catch (e) { add('a page throws', sec + ' #' + n + ': ' + e.message); } }
      // pdf, round trip, calculations
      try { const t0 = performance.now(); const doc = FF.pdf.build(s); times.pdf += performance.now() - t0; const pages = doc.getNumberOfPages(); if (pages > 40) add('PDF very long', pages + ' pages #' + n); } catch (e) { add('PDF throws', '#' + n + ': ' + e.message); }
      try { const j1 = JSON.parse(st.toJSON(s)); delete j1.modified; const back = st.fromJSON(JSON.stringify(j1)); const j2 = JSON.parse(st.toJSON(back)); delete j2.modified;
        // boxes that are not amounts or dates must come back exactly as they were saved
        const ka = Object.keys(j1.f).filter(k => !sc.fieldsById[k].money && !sc.fieldsById[k].date && JSON.stringify(j1.f[k]) !== JSON.stringify(j2.f[k])); if (ka.length) add('save then open changes a box', '#' + n + ' ' + ka.slice(0, 4).join(','));
        Object.keys(j1.l).forEach(k => { const L = sc.lists[k]; const a = j1.l[k].map(r => JSON.stringify(Object.assign({}, r, { d: Object.fromEntries(Object.keys(r.d).filter(c => !L.cols.find(x => x.k === c).money && !L.cols.find(x => x.k === c).date).map(c => [c, r.d[c]])) }))), c = j2.l[k].map(r => JSON.stringify(Object.assign({}, r, { d: Object.fromEntries(Object.keys(r.d).filter(c => !L.cols.find(x => x.k === c).money && !L.cols.find(x => x.k === c).date).map(c => [c, r.d[c]])) }))); if (JSON.stringify(a) !== JSON.stringify(c)) add('save then open changes a list', k + ' #' + n); });
        // opening again and saving again changes nothing (amounts and dates settle at the first open)
        const back2 = st.fromJSON(JSON.stringify(j2)); const j3 = JSON.parse(st.toJSON(back2)); delete j3.modified; if (JSON.stringify(j2) !== JSON.stringify(j3)) add('open and save again keeps changing the file', '#' + n);
        // an amount or date that did change: say how (the first few)
        const km = Object.keys(j1.f).filter(k => (sc.fieldsById[k].money || sc.fieldsById[k].date) && j1.f[k].v !== j2.f[k].v && j1.f[k].v !== ''); km.slice(0, 2).forEach(k => add('amount/date tidied on opening (expected for odd input)', k + ': "' + j1.f[k].v + '" -> "' + j2.f[k].v + '"'));
      } catch (e) { add('save/open throws', '#' + n + ': ' + e.message); }
      try { FF.actions.local(s); FF.actions.facts(s); sc.panels.forEach(P => FF.summary.local(s, P.id)); FF.validate.check(st.ctxFor(s)); sc.sections.forEach(x => st.counts(s, x)); } catch (e) { add('a calculation throws', '#' + n + ': ' + e.message); }
      try { sc.sections.forEach(x => { const c = st.counts(s, x); if (c.fill > c.tot) add('progress counts more filled than asked', x.id + ' ' + c.fill + '/' + c.tot); }); } catch (e) { /* counted above */ }
    }
    return { problems, times: { renderPerForm: Math.round(times.render / N), pdfPerForm: Math.round(times.pdf / N) } };
  }, N);
  console.log('forms tried:', N, '| page errors:', JSON.stringify(errs.slice(0, 5)), '| time (ms): render all pages per form ~', res.times.renderPerForm, ', PDF per form ~', res.times.pdfPerForm);
  const keys = Object.keys(res.problems); console.log(keys.length ? keys.length + ' kinds of problem:' : 'no problems found');
  keys.forEach(k => { const a = res.problems[k]; console.log('- ' + k + ' (' + a.length + '): ' + [...new Set(a)].slice(0, 4).join(' || ').slice(0, 300)); });
  await b.close(); srv.close();
});
