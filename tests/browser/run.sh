#!/bin/bash
# Runs the browser checks against the app folder: every page, voice, the PDF, the checks, the layout at three widths.
# They open the real page in Chrome and print PASS or FAIL lines; this script says which scripts failed and exits non-zero if any did.
# Needs Node, Playwright (npm install -g playwright, then npx playwright install chromium) and, for the PDF check, poppler's pdftotext.
# Set CHROMIUM to the path of a Chrome/Chromium to use instead of the one Playwright installs; APP to test another copy of the app folder.
# Usage: bash tests/browser/run.sh [output folder]
HERE="$(cd "$(dirname "$0")" && pwd)"; APP="${APP:-$HERE/../../app}"; OUT="${1:-$(mktemp -d)}"; PW="$(npm root -g)"
mkdir -p "$OUT/shots"; cd "$HERE"
run() { name=$1; shift; timeout 240 node "$HERE/$name.js" "$PW" "$APP" "$@" > "$OUT/$name.txt" 2>&1; echo "exit $?" >> "$OUT/$name.txt"; }
SIMPLE="t-sched t-notes t-lastthree t-draft t-agree t-bar t-consent t-correct t-delete t-email2 t-email3 t-engine t-ip t-kids t-link t-order t-pick t-rules t-batcha t-batchbc demo-confirm demo-dobconfirm demo-dobfollow demo-fix2 demo-frag demo-ladder demo-leavenotes demo-long demo-moveon demo-notes2 demo-quick demo-sections demo-stopnotes demo-tax"
for n in $SIMPLE; do
  run "$n" "$OUT/shots" "$OUT/shots" &
  while [ "$(jobs -r | wc -l)" -ge 6 ]; do sleep 0.5; done
done
run audit-fuzz 120 &
run audit-narrow-all &
run audit-pdf "$OUT/shots" &
wait
bad=0
for f in "$OUT"/*.txt; do
  n=$(basename "$f" .txt)
  if ! grep -q '^exit 0' "$f" || grep -q '^FAIL' "$f"; then echo "FAILED: $n ($f)"; bad=$((bad+1)); fi
done
echo "$(grep -h '^PASS' "$OUT"/*.txt | wc -l) checks passed, $bad script(s) failed. Output: $OUT"
exit $bad
