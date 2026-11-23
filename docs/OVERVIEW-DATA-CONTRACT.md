# Client Overview: the data contract (version 0.1, revision b of 21 November: all seven points confirmed by the Fix Skills chat)

Written 21 November 2026 by Chat 3 (stage 1 of the Client Overview build). **This is what the Overview page (`app/overview.html`), the PDF, the Presentation and the filling skill all agree on: the saved file's layout, the fixed lists, who writes what, and what is computed.** The skill is built against this file; the page is built from it. A change to it is a change to `schema` and is announced in the release block.

**No client data in this document, ever (the repository is public).** Every name and figure below is invented. Paul's private brief and the real examples live only in his OneDrive.

## 1. The file and where it goes

| Item | Rule |
|---|---|
| **Saved file** | JSON, `app: "wr-overview"`, `schema: "0.1"`. One file per client per overview (per year). |
| **Name** | `WR Overview - dd.mm.yy - (Surname, Name).json` and, beside it, the same name with `.pdf`. The date is the overview date (`header.overviewDate`). Built by one function in `ov-store.js` (`fileName`) that the skill copies. A file that is opened keeps its own name when saved again; a new date is a new version; older versions stay. |
| **Place** | The client's folder, `1. Overview\<year>\` (the year of the overview date). The client's folder is found as the other pages find it (New Business, then Client Files). Both files go together. |
| **Creating folders (Paul's answer 1, 21 Nov)** | The page may create `<year>` (and `1. Overview` if it is missing) **inside an existing client folder**, and nothing else. It never creates a client folder; it never renames, moves or deletes a folder. This is the single exception to the standing "never create a folder" rule of `folders.js`. If it cannot, the normal Save window opens in the deepest folder found, with the reason. Same checked write and path-length check as the other pages. |
| **A second save on the same day** | Asks before replacing a file that was not the one opened (the existing rule). |

## 2. Conventions (every block)

| Convention | Rule |
|---|---|
| **Money** | A JSON number in rand, two decimals at most (`1034800`, `637.85`). Never a string, never formatted, no "R". |
| **Percent** | A number: `10` means 10%. |
| **Dates** | `dd/mm/yyyy` text, as the Fact Find stores dates. |
| **A figure the document does not give** | `null` (nothing known yet: shown grey, "waiting for document"). |
| **Not applicable by rule** | The string `"N/A"` (for example the death-related line's disability cells). |
| **Looked for and not on the document** | The string `"Not found"` (for example an investment's annual contribution increase). Only these two strings are allowed in a figure cell. |
| **A cell the document prints as empty or R0 on a line that exists** | `0`. |
| **Row** | `{ "id", "d": {...fields...}, "st", "src", "removed" }`; `id` is a stable unique text, never reused; lines and policies carry their fields directly as listed below. |
| **`st` (status)** | `empty` (nothing yet) · `ff` (from the Fact Find, waiting for a document: amber) · `verify` (read from a document, to be checked: amber) · `confirmed` (checked by Sitamah or Paul: green). **A skill writes `verify` only; it never writes `confirmed`.** The page sets `ff` and `confirmed`. |
| **`src`** | Where the row came from: `{ "kind": "factfind" \| "schedule" \| "quote" \| "group" \| "astute" \| "cmp" \| "typed", "file": "<file name only, no path>", "page": 3, "date": "dd/mm/yyyy" }`. Required on every row a skill writes. |
| **`removed`** | `true` hides the row everywhere and excludes it from every total, but keeps it so **Undo** works. Remove = set it; Undo = clear it. A skill removes a row this way, never by deleting it. **Only quotes, proposed investments and goal reports can be removed**: current policies (block 1), group benefits (block 3) and current investments (block 8) are added and removed **only in the Fact Find**, and the overview follows it. |
| **`ffKey`** | On every item of blocks 1, 3 and 8: the text that ties it to its Fact Find row: `<list>:<provider, lower case, no accents, single spaces>:<n>` (`n` counts rows of the same provider in that list, from 1), for example `risk:test insurer:1`, `ret_ra:test insurer:1`, `inv:test provider:2`. The lists are `risk`, `grp`, `ret_pp`, `ret_ra`, `inv`. A skill fills details onto the item that has the `ffKey`; it never invents one. |
| **Written by** | Every row and quote also carries `by: "page" \| "skill" \| "person"`. |

## 3. Top-level layout

```
{
  "app": "wr-overview", "schema": "0.1",
  "created": "<ISO>", "modified": "<ISO>",
  "header":  { ... },                 // section 4
  "documents": [ { "id": "...", "file": "<file name only>", "block": "fna", "how": "read" | "name", "at": "<ISO>" } ],   // the documents loaded (by the page or by the skill), file names only, newest last
  "factFind": { "file": "<name>", "schema": "5.3", "readAt": "<ISO>", "changed": 0, "facts": { ... } },   // a link; "facts" is the snapshot the page took of what it uses (section 11), so a later change can be told
  "settings": { "standards": { ... }, "tolerance": 1.00 },     // section 10
  "blocks": {
    "policies":   { "items": [ ... ] },                         // 1
    "fna":        { "quotes": [ ... ] },                        // 2
    "group":      { "items": [ ... ] },                         // 3
    "shortfallQuote": { "quotes": [ ... ] },                    // 5   (block 4 is computed)
    "reduced":    { "quotes": [ ... ] },                        // 6
    "comparative":{ "quotes": [ ... ] },                        // 7
    "investments":{ "items": [ ... ] },                         // 8
    "proposed":   { "items": [ ... ] },                         // 9
    "goals":      { "items": [ ... ] },                         // 10
    "other":      { "items": [ ... ] }                          // 11
  },
  "computed": { ... }                 // written for readers at every save, NEVER read back
}
```

A file may leave any block empty (`items: []` / `quotes: []`). Unknown extra keys are kept and ignored. A page that finds a `schema` higher than it knows opens the file read-only and says so; **a skill that finds a `schema` it does not know stops and says so.**

## 4. Header

`fname`, `sname`, `dob`, `broker` (the adviser's name as on the Fact Find), `previous` (revision d: `{ "date", "file" }` of the overview this one is the review of, or null), `overviewDate`, `meetingDate`, `astuteDate`, `netIncome` (R p.m.), `grossIncome` (R p.m.), `disabilityAge` (65 or 70, the Fact Find's `ip_age`; a quote may carry its own, section 7), `sevRequest` (the Fact Find's default R500,000), `premiumBudget` (R p.m. for block 6, section 11), `year`. All except the names are `null` until known.

## 5. The pillars and the columns (fixed)

| Pillar id | On screen and PDF | Cells |
|---|---|---|
| `life` | Life cover | `lump`, `monthly` |
| `sev` | Severe illness | `lump` |
| `lsd` | Lump sum disability (Age 65, or the age read from the quote, printed under the heading) | `lump`, `monthly` |
| `ip` | Income protector / sickness benefit (Age 65 / 70) | `monthly` (printed with "p.m.") |

Every risk table has the columns **description, term, life, severe illness, lump sum disability, income protector, waiting period, ACI, ABI**. A **quote** table has no premium column: the monthly premium is the bottom row. A **current policy** keeps its own premium column. A BrightRock line takes **two rows**: the lump sum, and under it the monthly figure labelled **"Income portion"** (child, household) or **"Monthly instalment"** (debt); the page draws the labels, the data is just `lump` and `monthly`.

## 6. A line (inside a quote or a current policy)

```
{ "id": "...", "type": "household|child|debt|death|dread|other",
  "label": "Child care", "term": "Age 24",
  "name": "Ava", "sname": "Test",            // child lines
  "debt": "Home Loan", "bank": "Test Bank", "accelerated": true,   // debt lines: true accelerated, false standalone, null not known
  "life": {"lump": 500000, "monthly": 4000}, "sev": {"lump": null},
  "lsd":  {"lump": 450000, "monthly": 4000}, "ip": {"monthly": 0},
  "waiting": "1 month", "abi": 5,
  "st": "verify", "src": { ... }, "removed": false }
```

| Type | Rule |
|---|---|
| `household` | Household needs. Standalone. |
| `child` | One line per child, **name and surname**, term to age 24. Unused lines are not written. |
| `debt` | One line per debt, named as the quote names it (and the bank when the document gives it). `accelerated`: **`true` = the debt cover is ACCELERATED (paid out of the life cover), `false` = STANDALONE (a separate benefit on top), `null` or absent = not known** (revision h: a new debt line starts as `null`; before it a new line started as `true`, so an older file's `true` may not have been confirmed). `term` in months or `"Maximum"`. An `ip.monthly` amount on a debt line is the **Instalment Protector**; the page prints "Instalment Protector" (grey) and a red **"To be ceded to the bank"** under it, and one explanation line under the quote table. |
| `death` | Death-related needs. `lsd`, `ip` and `waiting` are `"N/A"`. |
| `dread` | Additional expense needs (dread). `lsd`, `ip` and `waiting` are `"N/A"`. |
| `other` | Free line (other insurers, the current policies' benefit lines): `label` says what it is; it still sits under the four fixed pillars. |

A whole pillar cell may be the string `"N/A"` instead of an object (as the `death` and `dread` lines do for `lsd` and `ip`). `term` and `waiting` are text exactly as the document gives them. `abi` is a number per line; `aci` is on the quote or policy (section 7), a line may carry its own `aci` only when the document does.

## 7. The blocks

### Quotes (blocks 2, 5, 6, 7)

```
{ "id": "...", "kind": "fna|shortfall|reduced|comparative",
  "insurer": "BrightRock", "number": "100000001",     // printed "CP <number>" for BrightRock, "Quote <number>" for others
  "date": "dd/mm/yyyy", "rates": "Non-smoker rates", "servicing": true,
  "status": "pending",                                 // see below
  "disabilityAge": 65, "aci": 10, "premium": 2500.00,  // the quote's own total monthly premium
  "printedTotals": { "lump": ..., "income": ... },     // only if the document prints them: used to catch printing errors
  "lines": [ ... ], "cmp": { ... },                    // section 8
  "policyNo": null, "startDate": null,                 // set when accepted and issued
  "replaces": null, "replacedBy": null,
  "st": "verify", "src": { ... }, "by": "skill", "removed": false }
```

- **Several of the same kind** are allowed in every quote block (extra FNA, extra reduced quotes, several comparative quotes). Each has its own table, status, change moment pay-out and comparison.
- **`status`**: `pending` = "Pending client decision" (the start), `accepted` = "Accepted", `notaccepted` = "Not accepted", `declined` = "Declined", `medical` = "Medical decline", `underwriting` = "Pending underwriting". The page sets it; a skill may set `pending` or `underwriting` only.
- **An accepted quote that is issued** (`policyNo` and `startDate` filled, different from the CP number) is **shown in block 1** as a current WR policy (green tick) and no longer in its quote block; its data stays in one place (no copy). A schedule row with the same `policyNo` supersedes it (the schedule's figures win).
- **Replace quote** = the new quote carries `replaces: <old id>`, the old one gets `removed: true, replacedBy: <new id>`. **Review years:** the new FNA replaces last year's; servicing quotes show today's figures only (no before-and-after per line).
- **Comparative quotes (block 7)** are tailored to what the insurer prints (often one whole-of-life amount per pillar as `type: "other"` lines); the four pillars and the left-hand descriptions stay fixed.
- **Reduced quote (block 6)** is requested against `header.premiumBudget`; block 5 (shortfall quote) exists only when block 3 holds group risk.

### Block 1, current policies

`items[]` = `{ "id", "wr": true|false, "insurer", "product", "policyNo", "doc" (date of commencement), "broker", "premium", "aci", "abi", "ipAge", "benefits": {"life":"WOL","lsd":"…","ip":"…"} (the product / benefit description under the amounts, text), "cession": null|true|false, "lines": [ ... ], "cmp": {...}|null, "st", "src", "by", "removed" }`. `wr: true` = WR is the broker on record (green tick); `false` = another broker (cross). **A WR policy shows every line item exactly as the insurer lists it and is replaced by the latest schedule each year.** **(Revision i, 23 November: that is for a BrightRock policy in force. A policy of ANY OTHER insurer is ONE row with its benefits: exactly one line of type `other`, labelled with the product, whose `life`, `sev`, `lsd` and `ip` cells hold the policy's benefit amounts; the line types `household`, `child`, `debt`, `death` and `dread` are for BrightRock only, and the page puts such lines into one `other` line when it opens a file.)** **Block 1 follows the Fact Find:** the page adds a skeleton item (`st: ff`) for every `risk` row and never removes one; a skill fills the details onto the item with the matching `ffKey` (policy number, DOC, product, premium from the schedule, lines); a policy the client forgot is **added to the Fact Find first** (the skill corrects the Fact Find's list) and then appears here. Totals per group (`wr`, other) and a **grand total per pillar across all policies** are computed.

### Block 3, group benefits and personal investments

`items[]`, each `kind: "risk" | "pension" | "provident"`:
- `risk` (a group risk statement): `provider`, `statementDate`, `life`, `sev`, `lsd`, `ip` each `{ "amount": n|null, "endAge": 65|"Whole of life"|null }`, `ipWaiting`, `aci`, `abi`, `monthlyCost`, `paidBy: "employer"|"employee"|"both"`, `basis` (text such as "1.5 × insurance salary"). **Always read each benefit's ending age; if the statement does not have the benefit, write `"Not found"`.**
- `pension` / `provident`: `provider`, `value`, `employer`, `employee` (R p.m., from the payslip), `aci`; waiting and ABI are `"N/A"`; `"POI needed"` is written in `note` when there is no payslip on file.
- **Block 3 follows the Fact Find** the same way: `risk` items from the `grp` list, `pension` / `provident` items from `ret_pp` (each with its `ffKey`); added and removed only there.
- **Personal investments is a computed row**: the sum of block 8's gross values (every investment, retirement annuities included), with their total monthly contributions.

### Block 8, current investments

`items[]` = `{ "id", "wr": bool, "provider", "product", "policyNo", "valueDate", "valueSource": {"kind":"schedule"|"astute","date","file"}, "gross", "penalty" (Section 14 transfer penalty, number|null|"N/A"), "returnRate" (since inception), "aci" (number|"Not found"), "monthly", "st", "src", "by", "removed" }`. **Look for the investment schedule first and use Astute only where none is on file; every value shows its date and source.** **Block 8 follows the Fact Find:** one item for every `ret_ra` and `inv` row (each with its `ffKey`), added and removed only there. Net value (gross − penalty) and the total are computed.

### Block 9, proposed investments

`items[]` = `{ "id", "type": "Tax-free investment"|"Retirement annuity (RA)"|"Endowment"|"Unit trusts (open-ended)"|"Section 14 transfer"|"Pension / provident fund transfer", "provider", "quote", "contribution": "lump"|"monthly"|"both"|"transfer", "lump", "monthly", "boostPct", "netInvested", "aci", "st", "src", "by", "removed" }`. `boostPct` and `netInvested` are **read from the quote, not worked out by the page**.

### Block 10, goal analysis reports

`items[]` = `{ "id", "kind": "rgar"|"egar", "requested": bool, "note", "currentValuePm", "futureValuePm", "aci", "premium", "st", "src", "by", "removed" }`. Not requested: `requested: false` and the note "Client did not request for at this time".

### Block 11, other

`items[]` with `key` in `medical`, `gap`, `will`, `legacy`, `shortterm`: `{ "key", "company", "product", "policyNo", "wr": bool, "note", "premium", "st", "src", "by" }`. From the Fact Find first, then later updates (for example a referral called the client): the note is free text.

## 8. Change moment pay-out (under every BrightRock quote, and under a current WR BrightRock policy whose guide is on file)

```
"cmp": { "number": "<CP number>", "activationDate": "dd/mm/yyyy", "reason": null,
  "rows": [ {"key":"total","today":45000,"projected":108000,"payoutDate":null},
            {"key":"retirement","today":36000,"projected":92000,"payoutDate":"31/12/2046"},
            {"key":"childcare","today":..}, {"key":"child","name":"Ava","sname":"Test","today":..,"projected":..,"payoutDate":".."} ],
  "src": { "kind": "cmp", "file": "...", "page": 1, "date": "..." } }
```
Matched to its quote by CP number. If the insurer gives no pay-out, `rows: []` and `reason` carries the insurer's reason. The page prints the standing note about how it pays (to be approved with the key points).

## 9. What the page computes (a skill never writes these; they are rebuilt at every save into `computed`, and never read back)

- **Quote totals:** total lump sum per pillar, total income protected per pillar (severe illness: `"N/A"`), from the lines that are not `removed` (not from `printedTotals`).
- **Block 1 totals:** per pillar for the WR group, for the other-broker group, and the grand total.
- **Block 4, the shortfall**, per pillar, from the FNA that is not removed (the first, or the one flagged by the page): `life = fna.life.lump − (group.life.amount + personal investments)`; `sev = fna.sev.lump − group.sev.amount`; `lsd = fna.lsd.lump − group.lsd.amount`; `ip = fna.ip.monthly − group.ip.amount (p.m.)`; never below 0. **Personal investments reduce the life pillar only** (as in Paul's worked example). **The current personal policies of block 1 are NOT counted** (they are being replaced; Paul, 22 November: the shortfall has the group risk and the personal investments only).
- **"Compared with what you have now"** for every quote: three rows (what you have now = the grand totals of block 1; this quote; the difference) per pillar plus the monthly premium.
- **The checks** (section 10).

## 10. Checks (amber, internal, never printed) and the standards

`settings.standards` (Paul's standard settings): `aci: 10` (fixed), `abi: { child: 5, household: 5, debt: 0, death: 3, dread: 3 }`. `settings.tolerance: 1.00` (rand).

| Check id | What it flags |
|---|---|
| `fna.income` | On an FNA quote, the total income protected of `life`, `lsd` and `ip` differs from `header.netIncome` by more than the tolerance. (A shortfall or reduced quote is deliberately below net income: not checked here.) |
| `quote.children` | A child line's monthly figure differs from the Fact Find's childcare amount for that child (matched by name and surname), or a child is missing or extra. |
| `quote.debts` | A debt line's name or instalment differs from the Fact Find's debts, or a debt is missing or extra. |
| `shortfall.match` | The form's shortfall (section 9) differs from the shortfall quote's lump sums (life, lsd, sev) or income protector. |
| `standards` | A line's ACI or ABI differs from the standards (ACI 10% fixed; ABI by line type). |
| `totals.printed` | A document's printed totals differ from the sum of its lines (the document has an error). |
| `age` | A quote's disability age differs from `header.disabilityAge`. |
| `doc.vs.factfind` | A figure taken from a document differs from the Fact Find's (the document wins; the difference is listed so the Fact Find can be corrected). |
| `gaps` | A group benefit has no ending age, an investment has no annual contribution increase, a payslip is needed, a change moment pay-out is missing for a BrightRock quote. |

Each check result is `{ id, severity: "amber", where, message }`. Checks never block saving or printing.

## 11. Pre-fill from the Fact Find (the page does this; it is not the skill's job)

Automatic on first open (and a **Fill from Fact Find** button), using the hand-over of 5.3; the overview links to the client's Fact Find (`factFind`), it keeps no loose copy. Rows made from the Fact Find get `st: "ff"` and `src.kind: "factfind"` and **show amber "from Fact Find, waiting for document"**. **Documents beat the Fact Find:** when a schedule or quote supplies a figure it replaces the `ff` one and a difference is listed (`doc.vs.factfind`). Later Fact Find changes show "Fact Find changed: n items" and apply only where no document has been loaded; a document figure is never overwritten silently. Not in the Fact Find (ending ages, ACI/ABI, line items, waiting periods): left grey, `null`.

| Overview field | Fact Find source (ids of 5.3) |
|---|---|
| header names, `dob`, `grossIncome`, `netIncome`, `disabilityAge` | `fname`, `sname`, `dob`, `gross`, `net`, `ip_age` |
| `premiumBudget` (block 6) | the reduced-quote request: `amt` of the `bfred` rows (BrightRock Fractured; `req` = Request a quote; `type` New Business or Servicing); `redq` rows for other insurers (Paul's answer 3) |
| children | list `kids`: `name`, `sname`, `dob`, `cost` (childcare R p.m.) |
| debts | list `debts`: `type`, `prov`, `desc`, `bal`, `inst`, `term` |
| block 1 skeleton rows | list `risk`: `prov`, `spend`, `broker` (`broker` = Paul K is a tick, any other a cross) |
| block 3 provider | list `grp`: `prov`, `spend`, `broker`; lists `ret_pp` (pension and provident: `type`, `prov`, `val`, `contrib`) |
| block 8 | lists `ret_ra` (`prov`, `val`, `contrib`, `broker`) and `inv` (`type`, `prov`, `val`, `prem`, `broker`) |
| block 9 | lists `raq` and `invq` (what the client asked to be quoted) |
| block 10 | `rgar_req`, `egar_req` |
| block 11 | `ma`, `gap`, `will`, `sti` with their notes and broker boxes |

**`factFind.facts`** (written by the page when it reads the Fact Find; a skill may leave it alone) holds exactly what the page used, so that "Fact Find changed: n items" can be told later: `header` (`fname`, `sname`, `dob`, `gross`, `net`, `ipAge`, `date`, `sevRequest`, `premiumBudget`), `children[]` (`name`, `sname`, `dob`, `cost`), `debts[]` (`type`, `prov`, `desc`, `bal`, `inst`, `term`), `risk[]`, `grp[]`, `ret_pp[]`, `ret_ra[]`, `inv[]` (each row with its `ffKey` and the list's columns), `raq[]`, `invq[]`, `rgar`, `egar` (true when requested), `other` (`ma`, `gap`, `will`, `shortterm`: provider, broker and notes as the Fact Find has them).

## 12. What the filling skill writes, and how

- **It writes:** the header (names, dates), and rows in the blocks above with `st: "verify"`, `by: "skill"` and a `src` on every row. It may write the whole file ("full fill" from the client's folder) **or only changed items** (add or replace one quote with `replaces`, remove a quote, a proposed investment or a goal report by setting `removed: true`, fill the details of one policy, group item or investment), leaving every other row untouched. **It never adds or removes an item of blocks 1, 3 or 8 on its own: those follow the Fact Find** (it corrects the Fact Find first, then the item appears and it fills it).
- **It never writes:** `computed`, totals, the shortfall, the checks, `confirmed`, the `ff` status, or any other row's content. It never deletes a row.
- **Before it writes:** it corrects the Fact Find's own lists (policies, premiums, forgotten policies; Paul's documents-are-the-truth rule), then fills the overview from the corrected Fact Find and the schedules, quotes, group statements and Astute. **The documents are the truth, not the meeting.** The overview figures win over a file name's figures (a premium in a file name may differ by cents).
- **It stops** on a `schema` it does not know; on a file that is not `app: "wr-overview"`.
- **Document sources** (where to look): schedules and group statements in `6. Policy Schedules`; quotes in the client's quote folder; Astute in `5. Astute\<year>`; change moment guides beside the quotes.

## 13. The key-points library (private, not in the repository: Paul's answer 4)

A JSON file named **`wr-keypoints.json`**, kept by Paul **at the top of the New Business folder (or, failing that, the Client Files folder) that he connected with Folders…**: **the Presentation finds and reads it by itself** (reads only; nothing to load or click). `{ "app": "wr-keypoints", "schema": "0.1", "points": [ { "id", "insurer", "product", "benefit": "<a key from the list below>", "section": "insured" | "children" (optional), "text": "<one short sentence, at most 200 characters>", "source": "<the page of the client's own quote the fact comes from, e.g. BrightRock quote, p. 3: at most 120 characters>", "approved": { "by": "Paul", "date": "dd/mm/yyyy" } | null } ] }`. **A point with `approved: null`, or with no `source`, never shows, and neither does one whose text or source is too long (each is counted and the top bar says so).** **Every fact must come from the client's own BrightRock quote and be checked against brightrock.co.za before it is written here** (Paul, 22 November): the `source` is printed on the card as a small *Source:* line. **At most EIGHT cards show at once** (Severe illness has up to seven). Drafts are built from the insurers' own documents by the skill and approved by Paul once.

**Where it is read (Studio 0.8, Presentation round):** `FF.foldersUI.rootFile('wr-keypoints.json', ask)` (`js/folders-ui.js`): New Business first, then Client Files; the browser is asked for a folder's permission only when nothing is kept in this browser yet (the click on Present allows it), otherwise only a folder that is already open to the page is read. A copy of the approved points is kept in this browser (`localStorage`, key `wr-keypoints`) and used when the folder cannot be read; a newer file replaces it; a file that cannot be read (not JSON, wrong `app`, a `schema` that does not start with `0.`) is said so in the Presentation's top bar and the copy stays. There is **no Key points button and no file chooser.**

**How the cards show:** the points are cards that slide in one after another on the right of a quote or a policy's lines when a column or a line is highlighted and the **Key points: on / off** switch is on. **Severe illness has two sections with blue banners, *The life insured* and *The children*** (the card's `section`; when it is missing the key decides: `sevChild`, `sevChildExtra`, `sevChildClaim`, `rareChildhood`, `childCare` and `childCover` are the children's, every other key the life insured's). **ACI is not in the library:** the page builds the one card *Premiums rise <x>% a year, plus the age adjuster.* from the client's own quote (`aci` / `aciText`; the age adjuster is named only when the quote's words name one; source *This quote, CP n*), and a library point with the benefit `aci` is never shown. **Until the checked library is found, a BrightRock quote shows placeholder cards in the same layout** (text starting *Placeholder:*, source *BrightRock quote, page to come*; they state no fact); nothing shows for another insurer; with a library that has nothing for a column, nothing shows (no placeholder).

**Which points show:** `insurer` is compared ignoring capitals, accents and a trailing word (`BrightRock` matches `BrightRock Life`); **an empty `insurer` (or `All`) is for every insurer**; `product`, when filled, must also fit the quote's or policy's product. **`benefit` keys** (compared without capitals, spaces or dashes), so that the skill can draft each point under the right one:

| Highlighted | Benefit keys asked for (one card of each in turn, then the next of each) |
|---|---|
| column **Life cover** / **Lump sum disability** / **ABI** | `life` / `lsd` / `abi` |
| column **ACI** | none: the page's own card from the quote |
| column **Severe illness** | the life insured: `sev`, `sevUpTo200` (the up to 200% extender), `sevAdvanced` (the advanced option), `traumaIQ` (Trauma IQ); the children: `sevChild` (10% doubling to 20% with child care cover, max R200,000), `sevChildExtra` (extra conditions for children), `sevChildClaim` (what a child's claim also pays) |
| column **Income protector** | `ip`, `ipClaimRoutes` (the two ways to claim: predefined / clinical conditions, or booked off by a doctor for illness or accident), `ipWaiting` (the waiting period) |
| a **child** line | `childCare`, `traumaIQ`, `rareChildhood` (children's rare childhood diseases), and the older `childCover` |
| a **debt** line | `debt`, then `debtAccelerated` when the line's `accelerated` is true or `debtStandalone` when it is false (neither when it is not known), then the older `instalmentProtector` when the line has an income protector amount |
| a household / death-related / additional expense (dread) line | `household` / `death` / `dread` |

A line and a column together: the line's keys first. The older keys `instalmentProtector`, `childCover` and `conversion` stay valid. The file is never saved by the page and is not in the repository (a test fails if a `keypoints*.json`, `key-points*.json` or `keypoints*.js` file is committed).

## 14. The seven points: CONFIRMED by the Fix Skills chat on 21 November (revision b)

1. `computed.shortfall`: personal investments reduce **life only** (as in the worked example), not disability.
2. Tolerance of R1.00 on the net-income check (a quote showed R1 above the Fact Find).
3. The year-folder rule in section 1 (create `<year>`, and `1. Overview` if missing, inside an existing client folder).
4. Broker tick: the Fact Find's `broker = Paul K` is "WR is the broker".
5. Which `bfred` / `redq` row is the premium budget when there are several (taken: the first with `req = Request a quote` and `type` Servicing, else New Business).
6. `boostPct` and `netInvested` are read from the quote and not computed.
7. A skill may rely on `0` for an empty printed cell and `null` for "could not read".

## 15. A tiny invented example (a quote with one line of each type; the figures are chosen only so the totals add up)

```
{ "id":"q1","kind":"fna","insurer":"BrightRock","number":"100000001","date":"01/12/2026","servicing":false,
  "status":"pending","disabilityAge":65,"aci":10,"premium":2500.00,"st":"verify","by":"skill",
  "src":{"kind":"quote","file":"BR FNA - 100000001","page":1,"date":"01/12/2026"},
  "lines":[
   {"id":"l1","type":"household","label":"Household","term":"Earlier of retirement (Age 70) or death","life":{"lump":800000,"monthly":10000},"sev":{"lump":null},"lsd":{"lump":900000,"monthly":17000},"ip":{"monthly":21000},"waiting":"1 month","abi":5},
   {"id":"l2","type":"child","label":"Child care","name":"Ava","sname":"Test","term":"Age 24","life":{"lump":500000,"monthly":4000},"lsd":{"lump":450000,"monthly":4000},"ip":{"monthly":0},"abi":5},
   {"id":"l3","type":"debt","label":"Debt","debt":"Home Loan","bank":"Test Bank","accelerated":true,"term":"Maximum","life":{"lump":1200000,"monthly":9000},"lsd":{"lump":1200000,"monthly":9000},"ip":{"monthly":9000},"abi":0},
   {"id":"l4","type":"death","label":"Death related needs","term":"On my death","life":{"lump":600000,"monthly":7000},"lsd":"N/A","ip":"N/A","waiting":"N/A","abi":3},
   {"id":"l5","type":"dread","label":"Additional expense needs (dread)","term":"Whole of life","sev":{"lump":500000},"lsd":"N/A","ip":"N/A","waiting":"N/A","abi":3} ] }
```
With `header.netIncome = 30000` the page works out: life monthly 10,000 + 4,000 + 9,000 + 7,000 = 30,000; lump sum disability monthly 17,000 + 4,000 + 9,000 = 30,000; income protector 21,000 + 0 + 9,000 = 30,000 (the three income-linked pillars add up, so `fna.income` stays quiet); total lump sum life 3,100,000; severe illness 500,000.

## 16. Revision b (21 November, from Paul's build brief and the confirmations): what changed since the first draft

All additive to `schema: "0.1"`; nothing a skill already wrote breaks.

| Change | Where |
|---|---|
| Blocks 1, 3 and 8 follow the Fact Find (no add or remove in the overview); every item has an `ffKey` | sections 2 and 7 |
| `factFind.facts`: the snapshot of the Fact Find's facts the page uses | sections 3 and 11 |
| Only quotes, proposed investments and goal reports can be removed (`removed: true`); quotes keep Replace, Remove (with Undo), Add new, Add another | sections 2, 7, 12 |
| The debt label is **"To be ceded to the bank"**; the first column of a quote is headed **Need** | section 6 |
| `computed` also holds the shortfall and the comparison tables; the Presentation and the PDF read the same view | section 9 |
| **Revision c (stage 4):** the top-level `documents` log (file names only; `how` is `read` when the page had Claude read it, `name` when it was only recorded); a quote may carry `productName` and `benefits` (shown when it is issued as a policy in block 1); the page's reading of documents is a switch that is OFF until the adviser turns it on, and what it reads is `st: "verify"`, `by: "page"` with the `src` of the file, exactly as a skill's rows | sections 3 and 7 |
| **Revision d (stage 6, page 0.5; the layout version `schema` stays `"0.1"`):** (1) **`cmp.st`** (`empty` when the page started the table, `verify` when read from a document, `confirmed` when typed) and **`cmp.by`**; typing in a pay-out checks the pay-out, not its quote; `src.kind` is `typed` for a typed one; **a policy item may carry `cmp`** (one of our BrightRock policies whose guide is on file) and the PDF and Presentation print it under the policy; a skill that fills a pay-out sets `st: "verify"`, `by: "skill"`. (2) **`header.previous`** = `{ "date": "dd/mm/yyyy", "file": "<overview file name, no path>" }` or null. (3) **A review year** starts from the previous overview: policies (an issued WR quote becomes a plain policy item, `derived`/`fromQuote` removed), group items, investments, goal reports (figures emptied) and other cover are carried with `st: "verify"`, `by: "page"` and `src: { "kind": "previous", "file", "date" }`; the four quote blocks, `proposed` and `documents` start empty; `header.meetingDate` and `astuteDate` are null; `factFind` and `settings` are kept; **the previous file is never changed**. The check `review.carried` says how many carried items still wait; `cmp.match` flags a pay-out whose CP number is not its quote's. (4) **A comparative quote starts with one `other` line** (`label: "Cover"`, `term: "Whole of life"`), replaced when a document is read; the four pillars and the totals stay fixed. |
| **Revision e (22 November, Client Overview Studio 0.6; the layout version `schema` stays `"0.1"` and NO key is added, removed or renamed):** (1) `documents[].block` may now also be `proposed` or `goals`; (2) `src.kind` may now also be `proposal` or `goal` (a proposed investment or a goal analysis report read from a document); (3) a page reading now sets a quote's **`servicing`** (true for a review / servicing quote, false for new business) when the document says; (4) reading a goal analysis report sets that report's `requested: true` (the document exists), and the row keeps `st: "verify"`; (5) a quote read through **Upload from client folder** can carry `cmp` from the BR CMPO guide of the same CP number (as in revision d, `cmp.st: "verify"`, `src.kind: "cmp"`); (6) the Fact Find comparison is made by the page's checks (not stored): a child whose surname differs from the Fact Find, a debt whose bank differs, a proposal whose lump sum or premium differs from the Fact Find's request now raise an amber check on the line (`problems[].line` is the id of the line; it is in `computed`'s checks list only for readers). **The reading switch is a browser setting (ON by default), not part of the file.** A skill that fills the file is unaffected: it should keep writing `verify`/`skill` rows and the same shapes. |
| **Revision f (22 November, second batch, Client Overview Studio 0.7; the layout version `schema` stays `"0.1"`; keys are ADDED, none removed or renamed):** (1) **`aciText`** (string or `null`) on a **quote** and on a **policy** item: the ACI exactly as the document words it (each insurer has its own terms; BrightRock prints e.g. `7.5% + age rater`); `aci` stays the number (a figure the checks compare with the standard); **when `aciText` is `null` the page, the PDF and the Presentation show `aci` followed by `fixed` (e.g. `10% fixed`)**; the filling skill writes the words in `aciText` and the figure in `aci`; (2) **`factFind.facts.asked`** = `{ sf: bool, comparative: bool }`: the Fact Find asks for a shortfall quote (`bf_sf_req` or `sf_req` is *Request a quote*) and for a comparative quote (the standard lane: `fna_req` or `sf_req` is *Request a quote*, or a row of the reduced quotes list `redq` is); written by Fill from Fact Find (a file made before has no `asked`, which reads as *not asked*); (3) **a child care line's `waiting` is `"N/A"` by default** (opened files too); a document or a skill that gives a waiting period for a child line wins; (4) **which pages the PDF and the Presentation have**: the Shortfall quote page needs group risk AND (`asked.sf` or a shortfall quote); the Comparative quotes page needs `asked.comparative` or a comparative quote; the Proposed investments page needs at least one proposed investment; the Goal analysis reports page needs a report that is `requested` or has figures; the other pages are always there (display only; nothing is saved about it); (5) block 11: an item of `other` may now be filled from a document (only the legacy protection plan has an upload), reading it like a policy schedule (`company`, `product`, `policyNo`, `premium`, `note`), `st: "verify"`, `src.kind: "schedule"`; (6) the label of the monthly figure under a lump sum is now `Income portion p.m.` (display only); the screen's See more / See less is not saved | sections 3, 7, 9 and 11 |
| **Revision g (22 November, third batch, Client Overview Studio 0.8; the layout version `schema` stays `"0.1"`; ONE key is added, none removed or renamed):** (1) **`match`** on a quote line: `"factfind"` when the page checked the line itself because the Fact Find and the quote agree (a child or a debt line, name / bank / amount) with nothing flagged; such a line is `st: "confirmed"`, `by: "page"`; **a person's typing in the line removes `match`** (`by: "person"`); a filling skill may write the same for a line it matched; (2) **what reading a quote writes now:** **every line has an `abi`** (a number; the line's own, or the one the quote prints once; **`"Not found"` when the quote prints none**, never empty); **`sev` is `"N/A"` on every line except where the quote has an amount** (a number stays); **a child care line's `waiting` is ALWAYS `"N/A"`** (Paul's rule beats the document; opened files too); a debt line the quote gives without its `debt` name or `bank` gets them from the matching row of the Fact Find (`factFind.facts.debts`: matched by name, then by the instalment or the balance), a child line without `sname` its surname; text the quote printed is never replaced; (3) the lines show the quote's `aciText` (the words) or `NN% fixed`; a file whose LINES carry `aciText` shows the first one as the quote's; (4) **the change moment pay-out is read by the page for every BrightRock quote** (FNA, shortfall, reduced, servicing) from the guide `BR CMPO - <CP number>` in the client's folder (`quote.cmp`, `st: "verify"`, `src.kind: "cmp"`); a skill does the same; (5) display only: no block numbers on the screen, the bar under a block's name while a document is read, Back / Next that skip a page that does not apply, the reading switch and the Anthropic key in Settings (kept in the browser like the Fact Find's) | sections 3, 6, 7 and 11 |
| **Revision j (23 November, Client Overview Studio 0.91, Paul's second round after he tested 0.9 on a real client; the layout version `schema` stays `"0.1"` and NO key is added, removed or renamed: values are added to existing keys, and one key inside `factFind.facts`):** (1) **`benefits` of a policy item gains `sev`** (severe illness) next to `life`, `lsd` and `ip`: each of the four is a **very short description of that benefit read from the schedule, for ANY insurer** (one or two short lines, no amounts; life cover: whole of life or term and to what age; severe illness: the product name and type, standalone or accelerated, top-up and extended option, whole of life; lump sum disability: the product name, OOD or AOD/OD, accelerated or standalone, to what age; income protector: for example payable for the first 24 months, or after 24 months to age 65, with the waiting period); the entry screen, the PDF and the Presentation print each in small grey type under its amount; a skill that reads a schedule writes all four. (2) **`match` on a line can now also be `"quote"`** (it was only `"factfind"`): a line that is IN a quote and was read by the page (`by` `"page"`) is confirmed (`st` `"confirmed"`) because the quote is the document, whether or not the Fact Find has anything like it (household needs, death-related needs, additional expense needs, the plain benefit lines); a child or a debt line is still held to the Fact Find (`match` `"factfind"` when they agree; one that differs or is only in the quote stays `"verify"` with its reason); a person's typing removes `match` as before; the quote's own row `st` becomes `"confirmed"` when all its lines are and nothing at all is flagged for it. (3) **`src.kind` of a block 11 item can be `"followup"`** (the Follow-Up Appointment Summary Notes of a later meeting; `file` = the notes' file name, `date` = the notes' date) besides `"factfind"`, `"schedule"` and the others. (4) **The note of a block 11 item (`blocks.other.items[].note`) is text made of parts, each part ending with where it came from: `(Fact Find dd/mm)` for what the Fact Find asked and answered, `(Summary Notes dd/mm)` for progress read from the client's newest Follow-Up Summary Notes dated after the Fact Find; the parts are joined with ` \u00b7 ` and the Fact Find's part stays in front.** The Fact Find fills each item's own boxes too: `company` (the medical aid provider, the gap cover provider, where the will is held, Capital Legacy for the legacy protection plan), `product` (the medical aid plan), `wr`, `premium` (short-term: the total personal spend), and the note holds the answers (for example *Has short-term insurance; broker Cameron Maritz; covers car, household contents*), the Fact Find's own notes of that area and the referral answer (`ref_will`, `ref_sti`). **The legacy protection plan is filled from the Fact Find as well** (there is no box of its own in the Fact Find: the page uses where the will is held and the Will (Capital Legacy) referral). A skill that fills block 11 writes notes the same way (each part with its source and date). (5) **`factFind.facts.otherDetail`** (new, inside `facts`): `{ ma: { note }, gap: { note }, will: { note, ref }, shortterm: { note, car, house, struct, biz, bizSpend, ref } }`, the Fact Find's notes and answers behind block 11; **ignored when only one of two readings has it**. (6) Screen-only: until the search of a block has finished its menu bar is neutral (a grey dot and *Waiting to search the client folder*, then *Searching the client folder…*); only then is it green (found) or red with its comment; the *What was loaded* pop-up is gone (what needs a look is a folded line of the Checks panel); a policy that was just read stays closed; the Presentation's tables make a figure smaller instead of running into the next column. |
| **Revision i (23 November, Client Overview Studio 0.9; the layout version `schema` stays `"0.1"` and NO key is added, removed or renamed):** (1) **a policy of an insurer other than BrightRock is ONE line of type `other`** (label = the product; the four pillar cells hold the benefits): the page converts need-line types on such a policy when it opens a file and when a schedule is read (each benefit added up, `term`, `waiting` and `abi` from the first line that has one; the totals do not change); a skill that fills block 1 writes one `other` line for such a policy and the need-by-need lines only for BrightRock; (2) **a quote is in its block once per number** (the digits of `number` compared): the page reads a second document of the same CP into the same quote (keeping `id`, `status`, `policyNo`, `startDate`, `cmp`) and drops an extra copy when it opens a file (the copy with `cmp`, else with more read lines, stays; `replacedBy` links are pointed at it); a skill must not write a quote twice; (3) the change moment pay-out's `rows` come only from the guide: the page adds and removes no row by hand (the layout is unchanged); (4) the red dot and the comment under a block's name, and the Presentation's full-screen mode, are screen-only. |
| **Revision h (22 November, the Presentation round of Client Overview Studio 0.8; the layout version `schema` stays `"0.1"` and ONE key is added inside `factFind.facts`: `answers`; the existing `accelerated` on a debt line now means something):** (1) **`accelerated` on a debt line: `true` accelerated, `false` standalone, `null` not known**; a new debt line starts as `null` (it started as `true`); the entry screen has a choice under the debt's name; **a reading of a quote asks for it** (a quote that does not say gives `null`); the PDF and the Presentation print *Accelerated* or *Standalone* under the debt's name (nothing when it is not known); a skill writes the same; (2) **`factFind.facts.answers`** (an object, filled by Fill from Fact Find): `hasRisk`, `hasGroup`, `hasRa`, `hasPp`, `hasInv` (the Fact Find's *Has ...* answers, text or empty), `raqReqs` (the *req* answer of every row of the retirement annuity quote list, text), `refSti` (the short-term referral box *Short-term (Cameron)*); the Presentation chooses the one sentence for an area of its Overview page from these and the blocks (section 11 and the wording table in `js/ov-pres.js`); **an older overview without `answers` simply says *This was not discussed in our last meeting.* until it is filled from the Fact Find again**, and its absence is not counted as a change in the Fact Find; (3) the key-points file now carries a `source` and an optional `section` per point and is read as section 13 says; (4) the Presentation has no voice; display only otherwise | sections 6, 7 and 13 |

