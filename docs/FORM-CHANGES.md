# Form changes (the Fact Find and the Short Risk Application)

A dated list of what changed in the form's boxes, newest first. **One line for each id added, removed or relabelled, each change to a sum or a tax table, and each list column added.** It is kept in the same commit as the change (see `CLAUDE.md`). Programs that read the saved file or `app/js/schema.js` (the skills) use it to see what moved.

The version is `version` in `app/js/schema.js` (the Fact Find) and `app/js/sr-schema.js` (the Short Risk Application); a saved file carries it as `schema`. Earlier changes are in the README and in the git history; this list starts with 3.1.

## 3.3: 12 November 2026 (Fact Find 3.2 to 3.3)

Fact Find:
- **No id added, removed or relabelled.** No sum, tax table, list column or choice changed. The saved file is unchanged: `cc_notes` is still `{ "v": "<plain text>", "st": "verify" }`.
- **Display and PDF change** for `cc_notes` (Current Client File Summary Notes): a heading line is shown bold in the box (a read view; the plain text opens on a click, on **Edit** or on Enter) and printed bold in the PDF. A heading line is a line with no lower-case letters, at least four characters, not starting with "- " (`util.isHeadingLine`). The skill writes plain text only.

## 3.2: 11 November 2026 (Fact Find 3.1 to 3.2)

Fact Find, ids:
- **Added** `cc_notes`: **Current Client File Summary Notes** (Admin, section **Current Client**; optional; a large text box). The section is active only when `ref` (Referral from) is "Current client", greyed out otherwise. A skill writes the summary of the client's AdviceTech Basic Info notes into it in the saved file, as points, with status `verify`; never filled by voice, never read for the action points, printed in the PDF only while active.
- **Relabelled / removed**: none. **Sums, tax tables, list columns, choices**: no change.

## 3.1: 11 November 2026 (Fact Find 3.0 to 3.1, Short Risk Application 1.1 to 1.2)

Fact Find, ids:
- **Added** `spmaint`: label **Spousal Maintenance** (Income & household): money an ex-spouse or ex-partner pays the client each month. It is a new id because the meaning of the box that used to be **Spousal Income** (`spinc`, what the spouse earns) changed.
- **Kept, now legacy** `spinc`: label **Spouse’s income (earlier form)**. Shown only while a file holds an answer in it; still added into Total Income (`tinc`); never filled by voice.
- **Relabelled** `maint`: **Child Maintenance Income** to **Child Maintenance**. Same meaning, same id.
- **Added** `on_call`: **Others on the call** (Client info, Meeting; optional; in the PDF).
- **Added** `debts_end`: **No more debts** (Debts; optional; shown as a line under the last debt, saved, printed in the PDF only when it holds the words; cleared when a debt is added).
- **Relabelled** `term` (Debts list column): **Term left** to **Term left (months)**. Same id. It now always holds a number of months ("20 years" is stored as 240, an age as the months to that age from the date of birth); a file saved with years or months in words opens with months. "Max term" stays for a credit card and revolving credit.
- **Choices changed** in the five schedule boxes (`ps_risk`, `ps_grp`, `ps_ra`, `ps_pp`, `ps_inv`; ids unchanged): **added** "Policy Schedules saved in Client File"; **removed** "Client does not need to send through" (a file that holds it opens with the added choice); the order is now the area's "Requested ... in meeting, await client response", Policy Schedules saved in Client File, Draw from Astute (with signed LOA) (not in `ps_grp`), Other.
- **Removed** (ids): none.

Fact Find, sums, tables and lists:
- **Sum changed**: Total Income (`tinc`) is now net + `rent` + `spmaint` + `spinc` (legacy) + `maint` (was net + `rent` + `spinc` + `maint`, where `spinc` meant what the spouse earns).
- **Tax tables**: no change. **List columns added**: none.
- **Defaults** (presets, only in empty boxes): Debts `term` = "Max term" for Credit card and Revolving credit (goes again when the type is another); Debts `asset` = "R 0.00" for every debt that is not on a property; `edu_notes` = "N/A" when `edu` is Matric; `employer` = "N/A" when `employed` is No.

Saved file:
- **New top-level key `worked`**: the figures the form works out, as the PDF prints them (version 1 of that block). Not an answer; never read back; rebuilt at every save. Described in the README ("the saved file also holds the worked-out figures").

Short Risk Application (1.1 to 1.2):
- No id added, removed or relabelled. A file saved by version 1.0 opens with **Owner of the policy** (`owner`) set to **The client** (an empty Owner's full names, or the client's own name), or to **Another person** with that name in `ow_fn` and its status verify.
