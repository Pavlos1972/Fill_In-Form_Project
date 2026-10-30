const { chromium } = require(process.argv[2] + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'); const dir = process.argv[3], out = process.argv[4];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  // a fully filled example: every block on, every box answered, a row in every list
  await p.evaluate(() => {
    const s = FF.app.state, st = FF.store, sc = FF.schema;
    Object.keys(sc.fieldsById).forEach(id => { const f = sc.fieldsById[id]; if (f.calc) return;
      let v = 'Sample ' + id; if (f.o && f.t !== 'multi') v = f.o[0]; if (f.t === 'multi') v = f.o[0]; if (f.money) v = 'R 1 000.00'; if (f.date) v = '14/03/2010'; if (id === 'idno') v = '8001015800087'; if (id === 'tax') v = '1234567890';
      if (['cell','work','home'].includes(id)) v = '0825551234'; if (/email/.test(id)) v = 'a@b.co.za'; st.setField(s, id, v); });
    ['has_risk', 'has_group', 'bizowner', 'biz_assur'].forEach(id => st.setField(s, id, 'Yes')); st.setField(s, 'marital', 'Married in community of property'); st.setField(s, 'fname', 'Thandi'); st.setField(s, 'sname', 'Dlamini'); st.setField(s, 'gender', 'Female');
    sc.panels.forEach(P => { if (P.dec) st.setField(s, P.dec, sc.PRIORITY); });
    ['fna_req', 'sf_req', 'bf_fna_req', 'bf_sf_req', 'bs_req', 'cl_req', 'km_req'].forEach(id => st.setField(s, id, 'Request a quote')); st.setField(s, 'rgar_req', 'Request an RGAR'); st.setField(s, 'egar_req', 'Request an EGAR');
    st.setField(s, 'fna_ins', 'Old Mutual; Discovery'); st.setField(s, 'sf_ins', 'Sanlam'); ['ps_risk', 'ps_grp', 'ps_ra', 'ps_pp', 'ps_inv'].forEach(id => st.setField(s, id, 'Requested from client in meeting; Other')); ['ps_risk_ot','ps_grp_ot','ps_ra_ot','ps_pp_ot','ps_inv_ot'].forEach(id => st.setField(s, id, 'Employer will send'));
    Object.keys(sc.lists).forEach(k => { const d = {}; sc.lists[k].cols.forEach(c => { d[c.k] = c.o ? c.o[0] : (c.money ? '1000' : (c.date ? '14/03/2012' : 'Sample ' + c.k)); }); d.req = d.req && /quote|Request/.test(d.req) ? d.req : d.req; if (k === 'redq' || k === 'bfred' || k === 'raq') d.req = 'Request a quote'; st.addRow(s, k, d); });
    st.addRow(s, 'debts', { type: 'Home loan', prov: 'Nedbank', inst: '10000', bal: '900000', cl: 'Yes' }); st.setField(s, 'pa_actions', '- Send the LOA\n- Set up a follow-up appointment');
    st.setField(s, 'net', 'R 60 000.00');
    FF.app.redraw();
  });
  const secs = await p.evaluate(() => FF.schema.sections.map(s => s.id));
  const expected = [];
  for (const sec of secs) {
    await p.click('.nav button[data-sec="' + sec + '"]'); await p.waitForTimeout(350);
    const items = await p.evaluate(() => {
      const seen = new Set(), out = [], vis = e => !!(e.offsetParent || e.getClientRects().length);
      const add = (kind, t) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t && !seen.has(kind + t)) { seen.add(kind + t); out.push([kind, t]); } };
      const main = document.getElementById('main');
      main.querySelectorAll('h2').forEach(e => add('page title', e.textContent));
      main.querySelectorAll('.f > span.l > span:first-child').forEach(e => { if (vis(e)) add('label', e.textContent); });
      main.querySelectorAll('.block-title').forEach(e => add('block title', e.textContent));
      main.querySelectorAll('.help').forEach(e => add('help note', e.textContent));
      main.querySelectorAll('.note').forEach(e => add('note', e.textContent));
      main.querySelectorAll('.prio > header h3').forEach(e => add('area heading', e.textContent));
      main.querySelectorAll('.sum li').forEach(e => add('summary point', e.textContent));
      main.querySelectorAll('.lh b').forEach(e => add('lane heading', e.textContent));
      main.querySelectorAll('details.sqd > summary, .brstrip b, .protector h5, .household h5').forEach(e => add('heading', e.textContent));
      main.querySelectorAll('table th').forEach(e => { if (vis(e)) add('column', e.textContent); });
      main.querySelectorAll('.rowhead b').forEach(e => add('row title', e.textContent));
      main.querySelectorAll('.sumstrip span').forEach(e => add('total', e.textContent.replace(/[R\d\s.,]+$/, '')));
      return out;
    });
    items.forEach(i => expected.push([sec].concat(i)));
  }
  const b64 = await p.evaluate(() => FF.pdf.build(FF.app.state).output('datauristring').split(',')[1]);
  fs.writeFileSync(out + '/audit.pdf', Buffer.from(b64, 'base64'));
  const raw = cp.execFileSync('pdftotext', ['-raw', out + '/audit.pdf', '-']).toString();
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const hay = norm(raw), miss = {};
  expected.forEach(([sec, kind, t]) => { const n = norm(t.replace(/\s*(calculated|calc|preset|not asked|confirmed|heard|verify)\s*$/i, '')); if (!n || hay.includes(n)) return; (miss[sec] = miss[sec] || []).push(kind + ': ' + t.slice(0, 130)); });
  Object.keys(miss).forEach(sec => { console.log('== ' + sec + ' (' + miss[sec].length + ' on the screen but not in the PDF)'); miss[sec].forEach(m => console.log('   ' + m)); });
  console.log('checked', expected.length, 'items; errors', JSON.stringify(errs));
  await b.close(); srv.close();
});
