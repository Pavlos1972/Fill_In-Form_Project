# Fact Find v2.0 – Revision Analysis (for live-capture)

Source reviewed: `WR Fact Find v2.0 – July 2026` (21 pages, 417 form fields:
230 text boxes, 187 dropdowns). Status: **proposal – nothing has been changed yet.**

## 1. Guiding principles for the revision

1. **One field = one spoken answer.** If a client cannot answer it in a sentence, it is not a live field.
2. **Separate three kinds of content** (currently mixed on the same pages):
   - **A – Client facts** (said by the client in the meeting) → filled live.
   - **B – Calculated** (totals, household income, 100% check) → computed by the software, never spoken.
   - **C – Advisor decisions** (quotes requested, who must call the client, ACI/ABI choices, RGAR/EGAR) → filled by you, on screen, after or during the meeting.
3. **Blank means "not asked yet".** Today "N/A", "0.00" and defaults like "No" are pre-filled everywhere, so neither you nor the software can tell *"client said none"* from *"never asked"*.
4. **Closed lists where the answer is a choice; free text only where it is a name or number.**
5. **Lists that grow** (debts, investments, children) instead of fixed numbered blocks.
6. **Every risky value** (ID, tax no., phone, email, DOB, amounts) is flagged "verify" until you tick it.

## 2. Changes at a glance

| Section (current pages) | Action | Result |
|---|---|---|
| Client Info (1) | Tidy, add consent, remove duplicate | 17 → ~16 fields |
| Income & Marital (2) | Clarify income wording, add spouse income | add 2–3 |
| Occupation / Duties (2–3) | Replace 7 % boxes with a suggested split you confirm | 8 → 3 + confirm |
| Current: Risk / Retirement (4) | Simplify dropdowns, add monthly contribution to pension/provident | change |
| Current: Investments (5) | Growing list, **add monthly premium p.m.**, **remove Bank Savings** | change |
| Current: Medical / Gap / Will / Short-term (6–7) | Keep; simplify dropdowns | change |
| Client Needs (8–13) | Move to **advisor-only** (Tier C) | not captured live |
| Health (14) | Keep Yes/No + notes; remove default "No" | keep |
| Debts (15–17) | **Growing list**, 8 fields per row | 80+ → 1 table |
| Children (18) | **Growing list**, stage auto-derived from DOB | 36 → 1 table |
| Risk Calculation (19–21) | Advisor-only; fix errors and "??" placeholders | not captured live |

## 3. Q2 – Do we need the dropdown boxes with info? (my feedback)

**Short answer: keep dropdowns, but fewer, cleaner, and only where the client's answer is a choice. Of the 187 dropdowns, about half are not client answers at all.**

### 3.1 Where dropdowns help the live software (keep)
A closed list is *good* for AI: it picks one value instead of guessing text, and it can map slang ("Disc" → Discovery, "my bond" → Home Loan, "we're married COP" → Married in Community of Property). Keep for:
- ID/Passport, Nationality, Smoker, Marital status, Education
- Employed Yes/No, Business owner Yes/No, Full-time/Contract
- Provider lists (insurers, banks, investment houses, medical schemes, gap cover)
- Debt type, Owner, Payer, Credit life, Surety
- Health Yes/No questions
- Child gender

### 3.2 Dropdowns that are really *your* decisions (move to advisor-only, Tier C)
About 55 dropdowns on pages 8–13 and 19–21 (e.g. *"Request BR FNA Quote as per FF"*, *"Valerie to contact client for M/A & Gap Cover"*, *"Cameron must not contact client"*, ACI/ABI, waiting period). The client does not say these. Leave them out of the live capture and keep them in a separate **"Advisor actions"** panel that you complete after the call.

### 3.3 Dropdowns that mix several things (simplify)
| Field | Problem | Better |
|---|---|---|
| `risk_personal` | existence + "joint with spouse" + "See Notes" in one list | Yes / No + "Joint with spouse" tick + notes |
| `ra_exist`, `pf_exist` | "has one / several / none / client to check / see notes" | Yes / No / Not sure + count |
| `risk_schedule`, `ra_sched`, `pf_sched`, `inv*_sched`, `risk_group_schedule` | These are **follow-up tasks** ("Client to send through", "Draw an Astute Report") | One "Documents to request" checklist per client |
| `will_status` | 7 mixed statuses incl. provider | Has will Y/N + updated Y/N + where held |
| `*_broker` (7 fields) | repeated "Paul K / Another / N/A" | One consistent list: *Paul K / Other broker / Company / None* |

### 3.4 Items to remove from every list
- **"N/A"** and **"See Notes"**: replace with *blank = not asked*, *No/None = client said none*, and a notes box.
- The pre-selected defaults: `High Cholesterol = No`, `Smoker = N/A`, `Term = Other`, `ACI = Fixed`, `ABI 3% / 5%`, `Dread Disease R500 000`, `Income Protection age 65`, `"??"` in the ACI value boxes. These get saved silently if nobody touches them. Defaults for *advisor* fields are fine, but they must be visibly marked "default", and never on client-fact fields.

### 3.5 Provider lists
Keep, but make them **"pick or type"** so any insurer not on the list can be added. Suggest adding commonly met providers that are missing from the lists (to be confirmed by you), e.g. Hollard, Assupol, Clientele, Capital Legacy, Outsurance Life. The long medical-scheme and gap-cover lists are fine.

## 4. Section-by-section analysis

### Page 1 – Client Info
- **Duplicate:** "Client ID or Passport" (a dropdown) and "Client ID / Passport Number". Keep the type (ID/Passport) and the number as two clearly labelled fields.
- `Date Completed`: auto-fill with the meeting date.
- `Advisor`, `Type of Meeting`: pre-set (Paul Kafentzis, Teams Meeting) – fine, they are not spoken.
- `Referral From`: keep (matches your Referral / D&R Marketing rule).
- Add **"Client consented to recording/AI transcription" Yes/No + time** at the very top (POPIA). This should be the first thing asked in every call.
- Split **Client Name & Surname** into two (first name, surname) – better for spelling checks.
- **Verify-flag fields:** ID/Passport number, DOB, tax number, cell, work number, both emails, surname.
- **"Highest Education" + "Education / Other"**: keep, merge into one dropdown + free text only when "Other".

### Page 2 – Income, Marital, Occupation
- **Income wording is ambiguous:** *Gross*, *Direct Net*, *Take Home Net*, *Monthly Budget*, *Disposable*. Spoken answers will not distinguish "direct net" from "take-home". Recommend asking only: **Gross monthly income, Take-home (net) monthly income, Monthly expenses/budget** – `Disposable` calculated. Confirm what "Direct Net" means to you; if it matters, I'll write the question for it.
- **Missing: spouse take-home income.** Your Risk Calculation uses *Household Net Income*, but there is no field for the spouse's income. Add *Spouse gross* and *Spouse take-home*.
- **Marital status:** 9 options is fine, the AI will map them. Spouse fields (name, DOB, smoker, occupation, contact) should appear only when status ≠ Single.
- **Business Owner = Yes** should open the Business Assurance questions only then (now just a note).
- **Layout bugs:** the italic note "If Business Owner = Yes…" overlaps *Shareholding %* (p.2); same for "Additional personal covers…" (p.4).
- `Employed / Name of Company` and `Business Owner / Name of Company` each have a dropdown + a text box: fine, but the "What does the company do?" fields are repeated twice; keep one per role.

### Page 3 – Occupational duties
- Seven % boxes that must total 100% are hard to get by voice. Better flow: client describes the job → the software **proposes the split** → you confirm or edit; the total checks itself. Keep your existing % fields and "Brief description".

### Page 4 – Current: Risk covers, Retirement
- Keep: provider, broker on record, **monthly spend (R p.m.)**.
- **Add:** *Group risk*: "employer provides Y/N". *Pension/Provident*: **monthly contribution** (currently only provider, administrator and value).
- **Add (optional, your call):** cover amounts as stated by client (life / disability / dread disease / income protection). At present only the spend is captured, and amounts come later from the Astute report. A verbal amount helps the FNA conversation.
- **Multiple policies:** the form has "Cover 2", "Cover 3" only. Convert to the same *growing list* as investments.

### Pages 5 – Investments
- **Add monthly premium (R p.m.)** to each investment, and keep *Estimated current value* and *Lump sum*. Proposed row: **Type · Provider · Current value (R) · Monthly contribution (R p.m.) · Broker on record · Statement to request (ticked in Documents checklist)**.
- Make it a **growing list** (not three fixed blocks).
- The investment type list: Unit Trust, Tax-Free Savings, Endowment, Offshore, Share Portfolio, Other – fine. Consider adding *Living Annuity* and *Preservation Fund* (not an RA) if you meet them.
- The "Provider / Other" pair (dropdown + extra text box) becomes a single pick-or-type field.

### Q3 – Bank Savings: agreed, remove
Remove the whole Bank Savings block (Bank savings Y/N, Type, Lump sum, Monthly, Notes). One small consideration for you: an FNA often needs to know if the client holds an **emergency fund / cash buffer**. If you want that, keep a *single* line "Emergency / cash savings (R)" in the Investments list rather than a whole block. Otherwise it goes completely.

### Pages 6–7 – Medical aid, Gap cover, Will, Short-term
- Keep. Each already has the same shape (has it? provider/plan, broker). Simplify dropdowns per 3.3 and drop N/A.
- Short-term: the four Yes/No types (Car, Household, Structural, Business) are fine for live capture.
- `Medical Aid Plan`: free text – needs verify flag (plan names are often misheard).

### Pages 8–13 – Client Needs → advisor-only (Tier C)
These are **your outcomes**, not client answers (which quotes to request, who must call, FNA/shortfall/reduced quotes, RGAR/EGAR, preferred spend). Keep them in the PDF but fill them yourself, either on screen after the call or via quick buttons. Two exceptions worth capturing from the client's mouth: **retirement age** and **preferred monthly spend / lump sum amounts**. Business Assurance (p.13) appears only if Business Owner = Yes.

### Page 14 – Health
- Keep 6 Yes/No + notes. Remove the pre-set "No" for cholesterol. All six: blank until asked. The software should **never** infer "No" from silence on health.

### Pages 15–17 – Debts (Q5) → one growing list
Current: 10 fixed blocks × (provider + other + type + owner + payer + term + monthly + liability + asset + 2 description boxes + notes + credit life + surety) ≈ 150 fields, mostly empty.

Proposed single row per debt:

| Field | Type | Notes |
|---|---|---|
| Provider / Bank | pick-or-type | Nedbank, FNB, Investec, Standard Bank, ABSA, Discovery Bank, Capitec, Wesbank, other |
| Type | pick | Home Loan, Vehicle Finance, Credit Card, Personal Loan, Revolving Credit, Other |
| Description | one text | Merge the two description boxes (e.g. "House", "4x4") |
| Owner | pick | **Client / Spouse / Joint / Business** (instead of Mr/Mrs – safer, and neutral) |
| Payer | pick | same list |
| Remaining term | text | e.g. "17 years" (store months) |
| Monthly instalment (R) | number | verify flag |
| Outstanding balance (R) | number | verify flag |
| Asset value (R) | number | optional; verify flag |
| Credit life with lender | Yes / No | |
| Surety signed | Yes / No / Unsure | |
| Notes | text | |

Totals (monthly, liabilities, assets) are calculated. Software adds a new row each time the client names another debt.

### Page 18 – Children (Q5) → growing list
Row: **Name & surname · Date of birth · Gender · Monthly cost (R)**. **Education stage is calculated from DOB** (not spoken), and can be overridden. Add "number of children" as the opening question. Total childcare cost calculated. Gender is optional if you do not use it.

### Pages 19–21 – Risk Calculation → advisor-only, and several errors
- **"Life Cover (WOL) ABI" and "Childcare ABI"** appear on the *Permanent Disability* page (p.20) as a copy-paste of the Life page.
- `pd_term` and `pd_aci` list "Fixed / CPI / Other" – term and escalation share one list, which looks wrong.
- `lc_f_aci = Fixed` with `??` value, `dd_aci = Fixed` with `??`: placeholders left in.
- `Dread Disease R500 000`, `Waiting period 1 month`, `IP age 65`: pre-set values saved silently.
- The note "Auto-calculated: Take Home Net minus Childcare minus Debt" confirms this is a Tier B/C calculation.

## 5. Other additions I recommend (please accept / reject)
1. **Consent/POPIA tick** at the top (recording + AI processing). *Strongly recommended.*
2. **Spouse income** fields (needed for household calculations).
3. **Documents to request** checklist (replaces the many "send through / Astute report" dropdowns).
4. **Pension/Provident monthly contribution**.
5. **Optional:** other dependants (e.g. parents), property ownership, existing cover *amounts* (verbal).
6. **Question order**: the form should follow the order you ask. Current tab order (Client Info → Occupation → Current → Needs → Health → Debts → Children) may not match your meeting flow; confirm yours.
7. **"Not asked / Not applicable / None"** as the three explicit states for every field.

## 6. Proposed structure and field counts

| Tier | Contents | Fields now | Proposed |
|---|---|---|---|
| A – Spoken live | Client info, income, occupation, existing covers, medical, will, short-term, health, debts, children | ~190 (many unused) | ~95 base + lists |
| B – Calculated | Disposable income, duty %, totals, household income, education stage | ~25 | ~20 |
| C – Advisor | Needs, quotes, actions, risk calculation | ~200 | kept as is, tidied |
| Removed | Bank savings (6), duplicate ID (1), fixed debt/child blocks (replaced by lists) | | – |

## 7. Technical consequence (important)
The current PDF has a **fixed** number of boxes, so it cannot "grow" a debt or child. Two options:

- **Option 1 (recommended):** the app holds the data and **generates the filled PDF itself** in your layout and branding. The lists grow and continue on an extra page when needed.
- **Option 2:** keep your Acrobat form unchanged and fill it. Debts stay limited to 10, children to 6, investments to 3, and nothing changes in the layout bugs above.

Option 1 lets the revision above work fully; Option 2 is quicker but keeps today's limits.

## 8. Decisions needed from you
1. Approve the **three tiers** (A live / B calculated / C advisor-only)?
2. Remove all "N/A" and "See Notes", and all silent defaults on client-fact fields?
3. Bank Savings: remove completely, or keep one "Emergency / cash savings" line?
4. Debts and children as growing lists, with **Client / Spouse / Joint / Business** replacing Mr / Mrs?
5. What does **"Direct Net Income"** mean to you vs "Take Home Net"?
6. Add **spouse income**, **pension/provident contribution**, and **consent tick**?
7. Add **existing cover amounts** (verbal) – yes or no?
8. **Option 1 or Option 2** for the PDF output?
9. What is the usual **order** you ask the questions in?
