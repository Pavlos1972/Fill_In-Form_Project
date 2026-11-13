# Form changes (the Fact Find, the Short Risk Application and the Investment Capture Sheet)

A dated list of what changed in the form's boxes, newest first. **One line for each id added, removed or relabelled, each change to a sum or a tax table, and each list column added.** It is kept in the same commit as the change (see `CLAUDE.md`). Programs that read the saved file or `app/js/schema.js` (the skills) use it to see what moved.

The version is `version` in `app/js/schema.js` (the Fact Find), `app/js/sr-schema.js` (the Short Risk Application) and `app/js/cs-schema.js` (the Investment Capture Sheet); a saved file carries it as `schema`. Earlier changes are in the README and in the git history; this list starts with 3.1.

## 3.7: 13 November 2026 (Fact Find 3.6 to 3.7)

Fact Find (what the voice and the points do with the answers). **No id added, removed or relabelled. No box, choice, sum, tax table or list column changed.** Detail in the README ("Release 3.7").
- **Heard and applied:** a confirm on a line the adviser said is not applied (only the client agreeing turns a box green); a box emptied on purpose is not refilled by a later line about something else (Claude is sent `emptied`); a row number that is not a number, digits, `last` or `new` is not guessed at (it is shown in Heard but not placed); a `done` that names no section or list is dropped; an action point, Priorities line or note with an amount (100 or more) that is nowhere in the facts is dropped; the catch-up check holds to the live guards and a figure must be in the words it quotes.
- **Facts for Claude (a skill that reads the facts will see):** `notes[]` entries with `declined_area: true` (the comment of an area that is Not a priority; page text "Declined area: ..."); a schedule that shares its Notes box with another carries `shared_with` and `page_note_id` and no `note_on_this_page`; a new empty investment or retirement row is not a held policy and prints nothing; the appointment text has the real weekday of the date.
- **The reader of a spoken line:** no confirm for "still the same" as a new value; "has changed" is not an agreement; no education for "never finished school"; ex-smokers and a spouse's smoking do not fill Smoker; cancelled or unaffordable medical aid is None; the client's own ID, tax, phone and email boxes never take what is said about someone else; no row from a thought or a third party's loan; an add word must qualify the list word; no section finished or page moved by an ordinary sentence.

## 3.6: 13 November 2026 (Fact Find 3.5 to 3.6)

Fact Find (Debts, and what the voice and the points do with the answers). Detail in the README ("Release 3.6").
- **List column added, `debts.sinst`: "Spouse instalment (R p.m.)"** (money). Shown only on a debt whose Payer (`payer`) is Joint or Spouse. **A new list total: `Total spouse monthly`** (`debts.sinst`). **Sums that changed:** `Total monthly` (`debts.inst`), the instalment protector and the household needs now count only the **client's own** instalment: for a Joint debt `inst` is the client's half (the whole instalment said is split 50/50 into `inst` and `sinst`, said again it is split again, a hand-typed `sinst` is left alone); for a Spouse debt the instalment is in `sinst` and `inst` is empty. A Joint debt now counts (its half) in the client's debt repayments; before 3.6 a Joint debt was left out altogether. A file saved before 3.6 opens split the same way.
- **Choice added, `debts.cl` (Credit life with lender):** `Not sure` (the choices are now `Yes`, `No`, `Not sure`). No id changed.
- **No id added, removed or relabelled** apart from `debts.sinst`. **A skill that reads the action points** will see: credit life only for a Home loan, Vehicle finance or Personal loan with a lender that the client pays (a `Not sure` is asked again); the wording `(currently with another broker: an opportunity to quote; the client will decide)` instead of `(... a take-over)`, and only for a Broker on record box that was answered; a Joint or Spouse payer.
- **The Priorities to be Focused on box (`focus`)** is written as `Recommend:` / `Client:` / `Come back with:` for each green area (a text format change, same id); credit life is no longer in it.
- **Schedule boxes `ps_risk`, `ps_ra`, `ps_pp`, `ps_inv`:** an empty one is preset to `Draw from Astute (with signed LOA)` once the Letter of Authority (`loa`) is Yes and one of them already says Astute, for cover the client has. Group risk (`ps_grp`) has no Astute choice.
- **Amounts:** `6.500` is read as R 6 500.00 (formerly R 6.50); words in an amount box leave `disp` and `tinc` blank (formerly counted as R 0); `dnet` (Direct Net Income) takes the SARS age rebate by the age at the end of the tax year (28 February) instead of on the day of the meeting; two-digit years are read in dates (`04.11.26`); a South African ID whose 2000s birth date is in the future is a 1900s one; the education stage of a child with a future birth date is blank; a debt provider `Other` typed in the box is kept (a file saved before 3.6 still loses the old pick-list's Other).
- **Heard and applied:** the screen moves only on the adviser's words; a removed debt is removed (Claude has a `removeRow` answer) and the catch-up check may not put it back; no row is made from a passing remark; the next appointment is filled only when the talk is about it and dates count from today; Claude is sent `a_week_from_today` and `meeting_started`.

## 3.5: 13 November 2026 (Fact Find 3.4 to 3.5)

Fact Find (Client priorities and quotes needed). **No id added, removed or relabelled.** No sum, tax table or list column changed.
- **Referral box `ref_sti` (Short-term (Cameron)):** the choice `Must not contact client` is **removed**. The box now offers `Cameron to contact client` and `Not required`. An older file that holds `Must not contact client` opens with `Not required` (status kept), and the sentence `Marked "Must not contact client" in an earlier version of the form.` is added to `pr_st_cm` (the Short Term comments), after what is already there and never twice, so the recorded "do not contact" is not lost. The action points never sent anything to Cameron for that choice, so they do not change.
- **A skill that reads `ref_sti`** must expect only `Cameron to contact client`, `Not required` or empty (and read the comment for an old "do not contact").

## 3.4: 12 November 2026 (Fact Find 3.3 to 3.4)

Fact Find (Client priorities and quotes needed). **No id added, removed or relabelled.** No sum, tax table or list column changed.
- **Decision boxes `pr_life`, `pr_ra`, `pr_rgar`, `pr_inv`, `pr_egar`, `pr_med`, `pr_will`, `pr_st`:** the choice `Not a priority: client not interested` is now **`Not a priority`** (the reason is written in the comments box). An older file opens with the new words in the same place, status kept. **A skill that reads these boxes must test for the words `Not a priority`, not for the old sentence.** No choice was added; Life, RA and Invest keep their four choices, the other five areas their two.
- **Referral boxes `ref_will` and `ref_sti`:** the choice `Not interested` is now **`Not required`** (an older file opens with the new word). `ref_med` and the rest are unchanged.
- **Quote requests:** the lists `bfred`, `redq`, `raq` and `invq` (column `req`) no longer offer `Cannot afford now` and `Not interested`: every quote request is `Request a quote` or `Not required` (the FNA quote also keeps `No FNA done`). A row of an older file keeps what it says.
- **Insurer of an RA quote and an investment quote** (`raq.ins`, `invq.ins`): now Old Mutual, Momentum, Sanlam, Liberty, Discovery, Allan Gray, Stanlib, Other (BrightRock, Hollard, Assupol and Clientele are no longer offered there; any provider can still be typed). **Product of an investment quote** (`invq.product`): `Living annuity` and `Offshore` added.
- **Comments boxes `pr_*_cm`:** three rows instead of two.
- **New behaviour, no new box:** the form fills an empty decision, its comment and the area's referral or request box (`ref_med`, `ref_will`, `ref_sti`, `egar_req`) with `Not a priority` / a written reason / `Not required`, all with status `preset`, for five facts: medical aid (or hospital plan) with Broker on record `Through company`; will up to date held with `Other provider`; will up to date held with `Capital Legacy` with Broker on record `Paul K`; short-term `Yes` with Broker on record `Through company`; has children `No`. It goes again when the fact changes and nothing was touched. Once the adviser changes the decision of such an area, the area is his. Life, RA, RGAR and Invest are never decided by the form.
- **Type of quote** (`bf_fna_type`, `fna_type`, `bf_sf_type`, `sf_type` and the `type` column of `bfred` and `redq`) starts as `New Business` (Has personal risk cover `No`) or `Servicing` (a policy with Broker on record `Paul K`), `preset`, for a quote that is asked for.
- **Action points:** a referral for cover that is with another broker (`ma_broker`, `gap_broker`, `will_broker` with the will held by Capital Legacy, `sti_broker`, or short-term handled by the spouse) says `(currently with another broker: a take-over)`. `facts.referrals` gains `takeover: true` for such an entry.
- **Checks:** a warning on `disp` when the monthly amounts asked for in the RA, investment and reduced quotes are more than the Disposable income.
- **Saved file:** a new key `auto` (`{ "skip": { "<area>": true } }`, only `egar`, `med`, `will`, `st`) records the areas the adviser took over from the form. An older copy of the form ignores it.

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
