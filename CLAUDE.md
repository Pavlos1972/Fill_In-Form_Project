# Wealth Revolution Fact Find: notes for Claude

The README.md describes the app; this file keeps the rules that must not be lost between sessions.

## Keep README.md up to date (set by Paul Kafentzis, always)

- **Every change that a user can see or that changes how the app, the tests or the publishing work is written into `README.md` in the same commit as the change.** That means a new, moved, renamed or removed page, box, label, choice, list, check, button or setting; a changed rule or calculation; a changed file name; and a change to how the tests or the website publishing run.
- A statement the change makes untrue is **corrected or deleted**, not left beside the new one. Search the README for the old wording before finishing (page order, labels, ids, counts, file paths).
- A change is not finished, and is not offered for merging, until `npm test` passes, which includes `tests/readme.test.js` (the README's page order and the file paths in its Layout table are checked against the code).

## Keep the Fact Find PDF mirroring the form (set by Paul Kafentzis, always)

- **The PDF always shows the latest form, exactly.** Every change to what the form shows (a new, moved, renamed or removed page, heading, box, label, note, choice, default, list column, quote table or summary line, or a changed wording) is made in the PDF in the same commit as the change. The PDF is built from the form's own definition (`app/js/schema.js`) by `app/js/pdf.js`, so a box in the schema appears by itself; the parts `pdf.js` draws by hand (the priorities and quotes page, the BrightRock Risk Calculation page, the quote tables, the lists and the Admin page) must be updated by hand.
- **A change is not finished, and is not offered for merging, until the PDF has been checked against the form**: `npm test` passes, which includes `tests/pdf-mirror.test.js` (every box, heading and note of the form is in the PDF, under the same words), and so does the browser check `tests/browser/audit-pdf.js` (the text of every screen against the text of a filled PDF; run with `npm run test:browser`). A new thing on the form that neither check can see (it is not a schema box and not in the screen text those checks read) gets its own test.
- What is left off the PDF is **only** what Paul has agreed, and each is marked in the code: the public profile (LinkedIn) (`nopdf` in `schema.js`) and the Claude and OpenAI cost figures. Anything else left out is a bug.
- A PDF that was saved earlier is a picture of the form on the day it was saved: it does not change by itself. To bring one up to date, open the client's file and save the PDF again. Say so when a change would make an earlier PDF look different.

## File naming (set by Paul Kafentzis, do not change unless asked)

- **The Fact Find saved as a PDF** is always named
  `Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)`
  for example `Fact Find (Voice to Text) - 29.10.26 - (Sitamah Nathoo)`.
  The date is the form's *Date completed* with a two-digit year; the name and surname are in round brackets.
  It is built by `store.pdfFileName()` in `app/js/store.js` and used by Save PDF and Preview PDF in `app/js/ui.js`. A test in `tests/app.test.js` pins it.
- The saved Fact Find file (.json) keeps its own name, `Fact Find - dd.mm.yyyy - Name Surname` (`store.baseFileName()`).
