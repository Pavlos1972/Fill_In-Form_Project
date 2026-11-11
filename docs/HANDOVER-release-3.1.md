# Handover note: release 3.1 (working note, delete after the merge)

Written 11 November 2026 so work can resume if the session's context runs out. Branch: `claude/create-something-stjk8a`. Everything below is ONE release; Paul approved it ("make all the changes together"). Ask Paul before merging to `main`.

## Scope (all agreed by Paul)
1. Debts: Term left starts as **Max term** for Credit card and Revolving credit.
2. Debts: Asset value starts as **R 0.00** for every type except Home loan (Vehicle finance too). Typed values never overwritten.
3. Highest education = Matric: Qualification details starts as **N/A**.
4. Employed = No: Employer starts as **N/A**.
5. Labels: **Spousal Maintenance** (NEW id `spmaint`, meaning = money an ex-spouse pays the client; the old `spinc` stays, shown only when an old file holds a value) and **Child Maintenance** (id `maint` kept).
6. Action Points for the Personal Assistant read ALL notes (Notes boxes, Priorities to be Focused on, list-row notes, Health notes, BrightRock comments, "heard but not placed" items), decide what Sitamah must do, no duplicates, nothing skipped (coverage check). Paul's own tasks go on her list, worded as something she can do.
7. Debt behaviour by voice: stay on one debt until told; "remove debt 2" removes it (undo available); "No more debts" line under the last debt (saved, in the PDF, goes when a debt is added).
8. Seven voice fixes: (1) a rounder figure never replaces an agreed exact one; (2) take-home above gross refused + "overheads" is expenses; (3) catch-up sweep fills need quoted words found in the transcript; (4) amounts in unplaced notes must have been said; (5) bank/provider needs a resembling word in the line; (6) a spouse's medical aid is Yes + note, not None; (7) bar when the meeting timer runs with Listen off.
9. Spouse on the call: a "Who is on the call" box; Claude told two people are on the client's side; action points name the person addressed.
10. Short Risk: files saved by version 1.0 open with Owner = The client (typed name: client's own name -> The client, other name -> Another person with the name in Owner's full names).
11. Saved file: new top-level key `worked` (new `app/js/worked.js`, written by `store.toJSON` on a copy of the state, never read back, rebuilt at every save): the calculated boxes, per-row worked boxes (kids age/stage), list totals, area totals, instalment protector (per debt: label, provider, instalment, protected; total; household needs), `taxYear`, `at`. Same strings as the PDF; hidden boxes left out. Test: block equals the PDF text.
12. Rules from the skills chat: never change an id for a label change; a MEANING change gets a NEW id; `schema` version in schema.js and in the file bumped (3.0 -> 3.1; Short Risk 1.1 -> 1.2); `docs/FORM-CHANGES.md` dated changelog; renamed labels also in the PDF; README and CLAUDE.md updated.
13. After the merge: build the installable copy (ZIP), tell Paul which files go into Company - Paul\Claude\Fact Find Documents\WR Fact Find - ZIP\WR Fact Find (js\schema.js, calc.js, tax.js and the rest), and give a 5-line summary for the skills chat (new version, ids added/removed/relabelled, shape of `worked`).

## Status
(update as you go) nothing built yet.

## Notes
- Tests: `npm test`; browser suite `bash tests/browser/run.sh <outdir>` then `git checkout -- tests/browser/*.png`.
- Pushing the work branch: it carries merge commits from earlier squash merges; before the PR run `git merge -s ours origin/main` if main moved, then push normally (no force).
