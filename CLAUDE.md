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
- **The Short Risk Application page (`app/short-risk.html`, added November 2026) follows the same two rules.** Its README section is kept up to date in the same commit as any change to it, and its PDF (`app/js/sr-pdf.js`, drawn from `app/js/sr-schema.js`) mirrors its page: `tests/sr-pdf.test.js` and the browser check `tests/browser/t-sr.js` must pass. What is left off its PDF is only the line of guidance under the Banking heading (`note` in `sr-schema.js`). The `complete-applications-skill` is not connected to it yet (Paul will do that).
- **The Investment Capture Sheet page (`app/capture-sheet.html`, added November 2026) follows the same two rules.** Its README section is kept up to date in the same commit as any change to it, and its **application PDF** (`app/js/cs-pdf.js`, drawn from `app/js/cs-schema.js`) mirrors its pages: `tests/cs-pdf.test.js` and the browser check `tests/browser/t-cs.js` must pass. What is left off the application PDF is only the Risk Tolerance questionnaire's 24 boxes (it has its own PDF, `app/js/cs-rt-pdf.js`, which Paul asked to be saved separately, with the client's signature, place and date left blank to be signed later); its three worked-out result boxes are printed. **The Declaration stays with the application** (Paul's decision), not after the questionnaire.
- **The Risk Tolerance questionnaire is a copy of the Risk Tolerance website's (risktolerance.netlify.app), not a link to it** (Paul agreed this because the form cannot read another website's answers): its statements, scoring, profiles and descriptions are in `app/js/cs-rt-data.js` and the firm's PDF form in `app/assets/rt-form.js`. A change to the website is made there too, and `tests/cs-store.test.js` pins the scoring. The website itself is not part of this repository and is never changed from here.
- **The questionnaire's PDF is saved separately, and meant for the client's "2. Fact Find" folder** (Paul's instruction): the Save window opens in the folder of the Fact Find that was loaded.

## Ids, versions and the change log (set by Paul Kafentzis with the skills chat, always)

- **An id never changes when only its label changes.** Skills and saved files read boxes by id. A box whose **meaning** changes gets a **new id**, and the old id is kept (marked `legacy` in `schema.js`, shown only while a file holds an answer in it) so older files and the skills still work.
- **Every release that changes the form's boxes bumps `version` in `app/js/schema.js`** (in `app/js/sr-schema.js` for the Short Risk Application, in `app/js/cs-schema.js` for the Investment Capture Sheet). A saved file carries it as `schema`.
- **`docs/FORM-CHANGES.md` is kept in the same commit:** dated, one line for each id added, removed or relabelled, each change to a sum or a tax table, and each list column added.
- A renamed label is in the PDF too (it is drawn from the schema; check it).
- **`app/js/worked.js` writes the figures the form works out into the saved file (`worked`) as the PDF prints them.** A new calculated box, list total, area total or change to the instalment protector is added there in the same commit; `tests/worked.test.js` proves the block equals the PDF text. Say in the README and in `docs/FORM-CHANGES.md` when the block changes.

## File naming (set by Paul Kafentzis, do not change unless asked)

- **The Fact Find saved as a PDF and the saved Fact Find file (.json) have the same name**, only the ending differs:
  `Fact Find (Audio to Text) - dd.mm.yy - (Name Surname)`
  for example `Fact Find (Audio to Text) - 04.11.26 - (Sitamah Nathoo)` (then `.pdf` or `.json`).
  The date is the form's *Date completed* with a two-digit year; the name and surname are in round brackets (`(New client)` until a name is entered).
  It is built by `store.pdfFileName()` in `app/js/store.js`; `store.baseFileName()` returns the same name for the .json. Save, Save as, Save PDF and Preview PDF in `app/js/ui.js` use them, also the plain-download fallback.
  Tests in `tests/app.test.js` and `tests/browser/t-settings.js` pin it. (Until 3 November 2026 the PDF said "Voice to Text" and the .json was `Fact Find - dd.mm.yyyy - Name Surname`; Paul changed both.)
- A file that is opened keeps its own name when it is saved again; only the first save of a client's file, and every PDF, get the name above.
