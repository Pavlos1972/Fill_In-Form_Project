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
  "debt": "Home Loan", "bank": "Test Bank", "accelerated": true,   // debt lines
  "life": {"lump": 500000, "monthly": 4000}, "sev": {"lump": null},
  "lsd":  {"lump": 450000, "monthly": 4000}, "ip": {"monthly": 0},
  "waiting": "1 month", "abi": 5,
  "st": "verify", "src": { ... }, "removed": false }
```

| Type | Rule |
|---|---|
| `household` | Household needs. Standalone. |
| `child` | One line per child, **name and surname**, term to age 24. Unused lines are not written. |
| `debt` | One line per debt, named as the quote names it (and the bank when the document gives it). `accelerated: true` for BrightRock. `term` in months or `"Maximum"`. An `ip.monthly` amount on a debt line is the **Instalment Protector**; the page prints "Instalment Protector" (grey) and a red **"To be ceded to the bank"** under it, and one explanation line under the quote table. |
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

`items[]` = `{ "id", "wr": true|false, "insurer", "product", "policyNo", "doc" (date of commencement), "broker", "premium", "aci", "abi", "ipAge", "benefits": {"life":"WOL","lsd":"…","ip":"…"} (the product / benefit description under the amounts, text), "cession": null|true|false, "lines": [ ... ], "cmp": {...}|null, "st", "src", "by", "removed" }`. `wr: true` = WR is the broker on record (green tick); `false` = another broker (cross). **A WR policy shows every line item exactly as the insurer lists it and is replaced by the latest schedule each year.** **Block 1 follows the Fact Find:** the page adds a skeleton item (`st: ff`) for every `risk` row and never removes one; a skill fills the details onto the item with the matching `ffKey` (policy number, DOC, product, premium from the schedule, lines); a policy the client forgot is **added to the Fact Find first** (the skill corrects the Fact Find's list) and then appears here. Totals per group (`wr`, other) and a **grand total per pillar across all policies** are computed.

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
- **Block 4, the shortfall**, per pillar, from the FNA that is not removed (the first, or the one flagged by the page): `life = fna.life.lump − (group.life.amount + personal investments)`; `sev = fna.sev.lump − group.sev.amount`; `lsd = fna.lsd.lump − group.lsd.amount`; `ip = fna.ip.monthly − group.ip.amount (p.m.)`; never below 0. **Personal investments reduce the life pillar only** (as in Paul's worked example).
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

A JSON file kept in Paul's OneDrive and loaded by the Presentation (`Open key points…`, remembered like the folder connection). `{ "app": "wr-keypoints", "schema": "0.1", "points": [ { "id", "insurer", "product", "benefit": "life|sev|lsd|ip|instalmentProtector|childCover|conversion|…", "text": "<one short sentence>", "approved": { "by": "Paul", "date": "dd/mm/yyyy" } | null } ] }`. **A point with `approved: null` never shows.** The panel shows at most four per benefit being discussed. Drafts are built from the insurers' own documents by the skill and approved by Paul once.

**As built (page 0.4):** the Presentation's **Key points…** button loads the file; the page keeps **only the approved points** in this browser (`localStorage`, key `wr-keypoints`; a point without `approved.by` and `approved.date` is dropped on loading); `schema` must start with `0.`; `insurer` is compared ignoring capitals, accents and a trailing word (`BrightRock` matches `BrightRock Life`); `product`, when filled, must also fit the quote's or policy's product; a point shows only for the insurer of the quote or policy on screen and the benefit chosen: `life`, `sev`, `lsd`, `ip`, plus `instalmentProtector` when the income protector is chosen with a debt line highlighted and `childCover` when life cover or lump sum disability is chosen with a child line highlighted. The file is never saved by the page and is not in the repository (a test fails if a `keypoints*.json` or `key-points*.json` file is committed).

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

