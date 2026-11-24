# The read-only snippet for "to verify" on a real Fact Find

For the Fix Skills chat (24 November 2026, Fact Find 5.4 and 5.5). It reads the Fact Find that is open in the page and **prints no values**: only the Progress number, how many amber answers it finds, and, for each one, the page, the box id, its label and how the page draws it. Nothing is changed, saved or sent.

**How to run it:** open the website's Fact Find page, open the client's saved file (Open…), then paste the snippet into the console of that page (or give it to the page through Claude in Chrome) and send the exact output back.

**How to read it** (5.4 counts all four kinds; 5.5 counts only the first two):

| Drawn as | What it means |
|---|---|
| SHOWN WITH PILL | An amber pill the adviser can see and click. Counted by every version. |
| SHOWN, NOTES BOX, NO PILL | A notes box that waits to be verified: counted by 5.4, but it drew no pill. 5.5 draws one. |
| GREYED | A box whose rule is not met, shown grey and inert with a grey pill. Counted by 5.4 only. |
| NOT DRAWN | A box, block or page a rule hides. Counted by 5.4 only. |

```js
(() => {
  const S = FF.app.state, sc = FF.schema, st = FF.store, ctx = st.ctxFor(S), sh = FF.calc.showIf, rows = [];
  sc.sections.forEach(sec => sec.blocks.forEach(b => {
    const bOn = sh(sec.cond, ctx) && sh(b.cond, ctx);
    (b.fields || []).forEach(f => {
      const c = S.f[f.id]; if (f.calc || f.id === 'profile' || !c || c.st !== 'verify' || String(c.v).trim() === '') return;
      const fOn = sh(f.cond, ctx), how = !bOn || (!fOn && !f.grey) ? 'NOT DRAWN' : !fOn ? 'GREYED' : f.t === 'area' && f.opt ? 'SHOWN, NOTES BOX, NO PILL' : 'SHOWN WITH PILL';
      rows.push([sec.title + (sec.adv ? ' [advisor page]' : ''), f.id, f.l, how]);
    });
    if (b.list) (S.l[b.list] || []).forEach((r, i) => { if (r.st === 'verify') rows.push([sec.title, b.list + ' row ' + (i + 1), sc.lists[b.list].title, bOn ? 'SHOWN WITH PILL' : 'NOT DRAWN']); });
  }));
  const by = {}; rows.forEach(r => { by[r[3]] = (by[r[3]] || 0) + 1; });
  const out = 'The Progress card says: ' + document.getElementById('sVerify').textContent + ' | amber answers found: ' + rows.length + ' | ' + JSON.stringify(by) + '\n' + rows.map(r => r.join(' | ')).join('\n');
  console.log(out); return out;
})()
```
