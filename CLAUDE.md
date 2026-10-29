# Wealth Revolution Fact Find: notes for Claude

The README.md describes the app; this file keeps the rules that must not be lost between sessions.

## File naming (set by Paul Kafentzis, do not change unless asked)

- **The Fact Find saved as a PDF** is always named
  `Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)`
  for example `Fact Find (Voice to Text) - 29.10.26 - (Sitamah Nathoo)`.
  The date is the form's *Date completed* with a two-digit year; the name and surname are in round brackets.
  It is built by `store.pdfFileName()` in `app/js/store.js` and used by Save PDF and Preview PDF in `app/js/ui.js`. A test in `tests/app.test.js` pins it.
- The saved Fact Find file (.json) keeps its own name, `Fact Find - dd.mm.yyyy - Name Surname` (`store.baseFileName()`).
