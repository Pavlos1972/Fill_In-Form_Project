const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'); const dir = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const rows = [];
  for (const w of [420, 800, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:' + srv.address().port + '/');
    await p.evaluate(() => { const s = FF.app.state, st = FF.store, sc = FF.schema;
      Object.keys(sc.fieldsById).forEach(id => { const f = sc.fieldsById[id]; if (f.calc) return; st.setField(s, id, f.t === 'multi' ? f.o.slice(0, 2).join('; ') : f.o ? f.o[0] : f.money ? 'R 12 345.00' : f.date ? '14/03/2010' : 'Sample text for ' + id); });
      ['has_risk', 'has_group', 'bizowner', 'biz_assur'].forEach(id => st.setField(s, id, 'Yes')); st.setField(s, 'marital', 'Married in community of property'); sc.panels.forEach(P => P.dec && st.setField(s, P.dec, sc.PRIORITY)); st.setField(s, 'net', 'R 60 000.00');
      Object.keys(sc.lists).forEach(k => { const d = {}; sc.lists[k].cols.forEach(c => { d[c.k] = c.o ? c.o[0] : c.money ? '12345' : 'Sample ' + c.k + ' with a long value to wrap'; }); st.addRow(s, k, d); st.addRow(s, k, d); }); FF.app.redraw(); });
    const secs = await p.evaluate(() => FF.schema.sections.map(s => s.id));
    for (const sec of secs) { await p.click('.nav button[data-sec="' + sec + '"]'); await p.waitForTimeout(120);
      const m = await p.evaluate(() => { const de = document.documentElement; const wide = [...document.querySelectorAll('#main *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && r.width > 0 && !e.closest('.tablewrap') && !e.closest('.msp') && getComputedStyle(e).position !== 'fixed'; }).length; return { sw: de.scrollWidth, iw: window.innerWidth, wide }; });
      rows.push([w, sec, m.sw <= m.iw + 1 && m.wide === 0, m.sw + '/' + m.iw + ' wide:' + m.wide]); }
    if (errs.length) rows.push([w, 'ERRORS', false, errs.slice(0, 2).join(';')]);
    await p.close();
  }
  const badRows = rows.filter(r => !r[2]); console.log('checked', rows.length, 'page/width combinations; problems:', badRows.length); badRows.forEach(r => console.log(JSON.stringify(r)));
  await b.close(); srv.close();
});
