# Form changes (the Fact Find, the Short Risk Application and the Investment Capture Sheet)

A dated list of what changed in the form's boxes, newest first. **One line for each id added, removed or relabelled, each change to a sum or a tax table, and each list column added.** It is kept in the same commit as the change (see `CLAUDE.md`). Programs that read the saved file or `app/js/schema.js` (the skills) use it to see what moved.

The version is `version` in `app/js/schema.js` (the Fact Find), `app/js/sr-schema.js` (the Short Risk Application) and `app/js/cs-schema.js` (the Investment Capture Sheet); a saved file carries it as `schema`. Earlier changes are in the README and in the git history; this list starts with 3.1.

## Investment Capture Sheet 1.0: 12 November 2026 (new page, `app/capture-sheet.html`)

A new page for investment applications at any insurer, made from the Old Mutual sheet *Application Details for Finalisor*, with the Risk Tolerance questionnaire. **No Fact Find box changed.** The saved file is `app` = `wr-capture-sheet`, `schema` = `1.0`. Ids added (all new; nothing is shared with the other two forms):
- Boxes, by section:
  - Product & policy details (product): `provider`, `product`, `product_name`, `contrib_type`, `amount`, `start_date`, `deferred`, `replace`, `old_policy`, `date`
  - Personal details (personal): `title`, `fname`, `sname`, `idno`, `birth_country`, `nationality`, `language`, `marital`, `marital_date`, `marital_contract`, `tax_no`, `foreign_tax`, `foreign_tax_no`
  - Contact details (contact): `tel_h`, `tel_w`, `cell`, `email`, `postal`, `postal_code`, `residential`, `residential_code`
  - Employment details (work): `occupation`, `position`, `industry`
  - Education (education): `qualification`, `edu_other`
  - Bank details (bank): `bank`, `branch_code`, `acc_type`, `acc_holder`, `acc_no`
  - Source of funds & income (funds): `src_funds`, `src_income`, `known_years`, `known_months`, `known_days`, `funds_raised`, `own_knowledge`, `origin`
  - Risk tolerance questionnaire (risk): `rt_understand`, `rt_s1 to rt_s18`, `rt_c1 to rt_c5`
  - Result of the questionnaire (risk_result): `risk_profile`, `risk_score`, `risk_ref`
  - lists: benef (name, sname, cell, id, relation, pct)
- The questionnaire (`rt_understand`, `rt_s1` to `rt_s18`, `rt_c1` to `rt_c5`) holds the choice as its words (*Strongly disagree* to *Strongly agree*; the capacity answers in full). **The three result boxes (`risk_profile`, `risk_score`, `risk_ref`) are worked out, never typed**: the score and profile once the 18 statements are answered, the reference once all 23 are answered (a new one when an answer changes).
- Scoring is the Risk Tolerance website's: statements 2, 5, 7, 8, 12 and 15 count the other way round; total out of 90; Conservative 18-37, Cautious 38-47, Moderate 48-57, Moderately aggressive 58-67, Aggressive 68-90.
- No sum or tax table changed. Lists: `benef` (name, sname, cell, id, relation, pct); the shares must total 100%.
- The Declaration (`declare`, no boxes) is on the **Source of funds** page; the questionnaire is the **Risk tolerance** page after it. Order of the application's PDF: Source of funds, Declaration, Result of the questionnaire, then the signature line.

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
