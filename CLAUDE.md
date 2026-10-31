# Wealth Revolution Fact Find: notes for Claude

The README.md describes the app; this file keeps the rules that must not be lost between sessions.

## Keep README.md up to date (set by Paul Kafentzis, always)

- **Every change that a user can see or that changes how the app, the tests or the publishing work is written into `README.md` in the same commit as the change.** That means a new, moved, renamed or removed page, box, label, choice, list, check, button or setting; a changed rule or calculation; a changed file name; and a change to how the tests or the website publishing run.
- A statement the change makes untrue is **corrected or deleted**, not left beside the new one. Search the README for the old wording before finishing (page order, labels, ids, counts, file paths).
- A change is not finished, and is not offered for merging, until `npm test` passes, which includes `tests/readme.test.js` (the README's page order and the file paths in its Layout table are checked against the code).

## File naming (set by Paul Kafentzis, do not change unless asked)

- **The Fact Find saved as a PDF** is always named
  `Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)`
  for example `Fact Find (Voice to Text) - 29.10.26 - (Sitamah Nathoo)`.
  The date is the form's *Date completed* with a two-digit year; the name and surname are in round brackets.
  It is built by `store.pdfFileName()` in `app/js/store.js` and used by Save PDF and Preview PDF in `app/js/ui.js`. A test in `tests/app.test.js` pins it.
- The saved Fact Find file (.json) keeps its own name, `Fact Find - dd.mm.yyyy - Name Surname` (`store.baseFileName()`).
