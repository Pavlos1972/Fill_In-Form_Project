# Project: the Client Overview (design stage, nothing built)

Started 21 November 2026. Brief relayed by the Fix Skills chat for Paul; design view by Chat 3. **No code yet: one plan goes to Paul before anything is built, and only Paul's "build" starts it.** This file is documentation only. **No client data goes into this repository, ever:** the Fix Skills chat is making its mock-ups with one real client's figures privately; every test here uses invented names and figures.

## 1. The brief (as relayed)

**Today:** Sitamah builds an Excel overview per client, Paul checks it, she saves a PDF, it is sent before the meeting and shown on screen.

**Goal, three parts**

| Part | What |
|---|---|
| 1. A Client Overview **page** in the form | Like the Fact Find and the Risk Application (left menu, tabs, an upload button per block). Opened from *Other forms*, pre-filled from the Fact Find, then filled by Sitamah's uploads or by a skill reading the client's OneDrive folder. Sitamah checks for quality only. |
| 2. A new-design **PDF** | Fresh, simple, same structure, tables. Saved in the client folder `1. Overview\<year>\` together with the overview's own JSON. Name `WR Overview - dd.mm.yy - (Surname, Name)`. Versions kept. |
| 3. A **Presentation mode** | Animated, in tabs or a map. Follows **only Paul's voice (never the client's)**; moves only when he clearly directs it ("let's talk about the house"); **never jumps around** (he says the Fact Find has jumped around); can also be clicked. Highlights a section, a pillar, a line (a child, a debt, the total income protected). A side panel shows 3 to 4 **approved** key points about the benefit being discussed (a key-points library per insurer, each point approved once by Paul). Read-only: shows exactly the information in the sent PDF. |

**Blocks, fixed order (screen and PDF):** 1 Current policies (WR-broker policies in their own block with a tick, other brokers' together with a cross; totals per group and a grand total per pillar; full line items from the schedules; WR policies refreshed yearly from the latest schedule) · 2 FNA quote · 3 Group benefits and personal investments (group risk, pension, provident, investments) · 4 Shortfall = FNA minus group benefits and personal investments, per pillar (worked out by the form) · 5 Shortfall quote (only when there is group risk) · 6 Reduced quote (fits the client's premium budget from the Fact Find) · 7 Comparative quotes from other insurers (tailored to each quote; pillars fixed) · 8 Current investments · 9 Proposed investments · 10 Goal analysis reports (RGAR / EGAR) · 11 Other: medical aid, gap, will, legacy plan, short term (from the Fact Find plus later updates).

**Columns for every risk block:** description, term, life, severe illness, disability, income protector, waiting period, ACI, ABI, monthly premium. **A BrightRock line takes two rows:** the lump sum, and the monthly figure under it labelled *Income portion* (children, household) or *Monthly instalment* (debts). **Line types:** household, child care per child (to 24), each debt (accelerated, term), death-related needs, additional expense (dread). **Totals:** total lump sum, total income protected, premium. **Each quote block has a status badge:** Not accepted / Accepted / Declined; an accepted quote later gets its policy number and start date and moves to block 1. **Review years:** last year's PDF is kept; a new FNA replaces the old; quotes are usually servicing quotes.

**Checks (amber, Paul approved):** every income-linked pillar (life, lump sum disability, income protection) must add up to the client's net income; quote children and debts must match the Fact Find; the shortfall worked out by the form vs the shortfall quote; increases that differ from his standard (ACI 10% fixed; ABI 5% children / household, 0 debts, 3% death-related and dread).

**Data rule:** the documents are the truth. After the meeting the program or skill corrects the Fact Find's policy list (premiums, forgotten policies) from the schedules / Astute, then fills the overview.

## 2. Chat 3's design view

### (a) Where it fits in the app

- **A fourth page**, `app/overview.html`, built like the Risk Application: its own files `ov-schema.js` (blocks, columns, line types, pillars, standards, check definitions), `ov-store.js` (state, saved file, calculations, migrations), `ov-ui.js`, `ov-check.js`, `ov-pdf.js`, `ov-present.js` (presentation), `css/overview.css`. Own version (starts at 0.1, becomes 1.0 when Paul accepts it). `app` key `wr-overview`; the `schema` stamp as in the other files so a skill can stop on a version it does not know.
- **Its own data file** (the overview JSON), never the Fact Find's. The Fact Find's flat boxes do not suit it (it is mostly tables): the data is `blocks` with **rows shaped like the Fact Find's list rows** (`{d: {...}, st}`), so the same statuses work (`empty / preset / verify (amber) / confirmed`; `heard` is not used here). Each row also carries `src` (the document and page it was read from) so Sitamah can check it in seconds.
- **Computed, never stored as truth:** totals, shortfall per pillar, the checks and the badge arithmetic are worked out by the page (like `worked` in the Fact Find: written to the file for readers, never read back).
- **Hand-over from the Fact Find** by extending `handover.js` (it already carries the client from the Fact Find to the applications): a fourth link in *Other forms* on every page; the Overview opens filled with the client's names, dependants (children, ages), debts, net income (`tinc` / `disp`), the Fact Find's policy list and medical aid / gap / will / short-term answers (block 11). Same one-browser, one-address limit as 5.3.
- **Block 1's line items cannot come from the Fact Find** (its policy list has headers, not the per-benefit lines of a schedule). The Fact Find seeds the policy header (insurer, type, premium, broker); the lines come from schedules (upload or skill).
- **The premium budget (block 6) is not a box in the Fact Find today** (there is *Monthly expenses / budget* and the client decision *Client needs to check their budget*). Either a new Fact Find box (a Fact Find release and a skills renewal) or an Overview-only box. Paul's choice.
- **Saving:** reuse `folders.js` with a new rule next to the Fact Find's: the client's folder → `1. Overview` → `<year>`, with the same checked write and path-length check; same stored connection. Files are named `WR Overview - dd.mm.yy - (Surname, Name)` (`.json` and `.pdf`); a new date is a new version; the standing rule "ask before replacing a file that was not the one opened" keeps a same-day second save safe.

### (b) Presentation voice discipline

- **Reuse the listener, not the Fact Find's engine.** `listen.js` already tags each line `me` (Paul's microphone) or `client` (the call's sound); the page already drops the echo of the client's line. Presentation accepts **only `me` lines**; `client` and `unclear` lines are ignored and never shown or stored.
- **A small command engine of its own (`ov-present.js`), deterministic, on this computer, no Claude call.** The Fact Find's voice index finds boxes from loose talk and sometimes asks Claude to interpret; that is the right tool for filling boxes and the wrong one for presenting. Presentation only recognises **directing phrases** (*let's talk about X*, *let's look at X*, *go to X*, *now the X*, *next*, *back*, *stay here*, *stop presenting*) followed by a **topic from a closed dictionary** built from the overview itself (blocks, pillars, line types, each child's first name, each debt's name, "the house" = household, "the bond" = the bond line…). No phrase, no move.
- **A lock:** presenting starts LOCKED (only *let's talk about…* and *stop* are heard). One clear phrase unlocks that topic; after a move there is a short cool-down in which only *back / stay* work. If the topic is ambiguous the page moves nothing and offers two small chips ("the house, or the bond?"). Clicking always works and pauses the voice for a while.
- **A visible state** at the edge of the screen (listening / locked / paused / "heard: …") that Paul can see and the client can ignore; a key to mute at once.
- **Honest risks:** (1) if the call's sound is not shared, the client's voice from the loudspeakers can reach Paul's microphone and be tagged as his; the echo drop only works when the client's line is also captured. Mitigation: a headset, the *Client Sound* bar green before presenting, and the directing-phrase rule (casual talk never moves anything). (2) Transcription arrives in chunks a few seconds after the words (the Fact Find's first line of a session once took about 13 seconds); fine for a directing phrase, to be measured on a real call; a faster speech source can be tried for this mode.

### (c) The PDF

- **Yes, the same route: jsPDF with the autotable plug-in already in the project** (`app/vendor`), drawn from `ov-schema.js` like `pdf.js` is drawn from `schema.js`. **Landscape** pages (ten columns). A cover (client, date, meeting), then one section per block in the fixed order, pillar tables with totals, the badge on each quote, a BrightRock line as two rows.
- **One view model feeds the screen, the presentation and the PDF** (`ov.view(state)`), so they cannot drift, and a test proves every figure shown in the presentation is in the PDF text (the same idea as `pdf-mirror.test.js`). **Amber checks are internal and are not printed** (the sent PDF shows only what Paul approved).
- A first spike in jsPDF with **invented** figures, before the design is locked, to see whether the Fix Skills chat's mock-up fits on a page.

### (d) Uploads per block, and what a skill writes

- **Three ways in, all ending the same way** (rows in amber `verify`, with `src`): (1) **upload per block** (pick PDFs), (2) a **skill reading the client's OneDrive folder** and writing the overview JSON, (3) typing.
- **Upload in the page:** a browser page cannot read a scanned schedule by itself. The page already calls Anthropic from the browser with Paul's key (voice and company look-up); the Messages API accepts a PDF. Each block would send the chosen PDF with a block-specific instruction and a strict row shape, and fill amber rows. **Decision for Paul: client documents then leave the computer for Anthropic.** The Fact Find sends private numbers only when sharing is switched on; this would need its own switch, off by default. Cost per document is shown like the other costs.
- **Independent checks on any reading** (cheap, deterministic): each policy's own printed total premium against the sum of its lines; pillar sums against net income; children and debts against the Fact Find.
- **What a skill writes (the contract):** only the rows (`blocks.<block>.rows[]` with their line type, pillar, amounts, `wr` tick, quote `status`, `policy_no`, `start_date`, `src`, `st: verify`) and the header (client, year, meeting date). It never writes totals, the shortfall or the checks. The contract is one short document, `docs/OVERVIEW-DATA-CONTRACT.md`, written first and shared with the Fix Skills chat (the same way the box ids are today), with the schema version in the file.
- **Sitamah's existing Excel files:** start fresh or import? A one-off import (an Excel reader is not in the project today) is probably a skill job; to decide.

### (e) Risks, and a staged build order

**Risks**

| Risk | What to do |
|---|---|
| Size: bigger than any release so far | Stages below; each ends with a merge, tests and the Fix Skills block |
| A wrong figure read from a schedule | Everything read is amber with `src`; the independent checks above; nothing auto-confirms |
| Private data | Public repository: invented data only, in tests and in docs; the overview JSON lives only in the client's folder; the upload switch is off by default |
| Presentation jumping, or the client's voice steering it | Closed phrase grammar, lock, only `me` lines, cool-down, manual pause; tested on recorded lines of both speakers |
| PDF and presentation drifting apart | One view model and a mirror test |
| Key points: compliance wording kept in a **public** repository | Library is a data file with `approved: {by, date}`; **an unapproved point never shows**; Paul decides where it lives and who drafts |
| The standing rule "never create a folder" and `1. Overview\<year>` missing | Fall back to the Save window with the reason, or Paul changes the rule for the year folder only |
| The two-row BrightRock lines and the line-type list | Paul's / the Fix Skills chat's definition of every line type and pillar before the schema is fixed |
| The Fact Find needs boxes (premium budget) | A normal Fact Find release; skills renewed from the release block |

**Staged build order** (each a release Paul says "build" and "merge" to)

1. **Contract:** `docs/OVERVIEW-DATA-CONTRACT.md` (pillars, line types, columns, standards, file layout, statuses) agreed with the Fix Skills chat and its mock-ups. No app code.
2. **Overview 0.1, the page without the PDF:** schema, store, totals, shortfall, checks, entry by typing, hand-over from the Fact Find, Open / Save of the JSON, tests with invented data. The skill chat can now write real JSON against it.
3. **Overview 0.2, the PDF and the folder:** landscape tables, `1. Overview\<year>`, file names, versions.
4. **Overview 0.3, uploads:** per-block upload (behind the switch), skill-written JSON opened in amber, quote badges, an accepted quote moving to block 1.
5. **Overview 0.4, Presentation, clicking first:** tabs or map, highlights, the side panel and the approved key-points library; then **voice** with the locked grammar, tested on recorded lines and a test call.
6. **Review years and comparative quotes:** last year's PDF kept, a new FNA replacing the old, other insurers' quotes tailored to each quote.

## 3. Questions for Paul: ANSWERED on 21 November (section 4)

1. May the page create the year folder `1. Overview\<year>` when it is missing (a change to the "never create a folder" rule, for that one folder), or must it fall back to the Save window?
2. May a document you upload in the page be read by Anthropic (switch off by default)? Or should readings come only from the skill?
3. The premium budget: a new Fact Find box, or an Overview-only box?
4. Key points: who drafts the first versions, and is a public repository acceptable for the wording? (If not, the library can stay in the client's OneDrive and be loaded by the page.)
5. Does Sitamah want her existing Excel files imported, or a fresh start?
6. Which comes first for you: the PDF (stage 3) or Presentation by clicking (stage 5)?

## 4. Decisions of 21 November (Paul, relayed by the Fix Skills chat): the full build is approved

Paul saw and corrected the mock-ups ("I'm happy with everything") and asked for **the full build, all stages one after another, a report after each stage, merge only on his word, no client data in the repository**. His brief (private: it holds real client names and figures) is the Fix Skills chat's `CLIENT-OVERVIEW-PROJECT.md` in his OneDrive skills folder, plus `BRIEF-CHAT3-BUILD.md` (not yet found there on 21 November): **read them through Microsoft 365 only and never copy a name, figure or file name from them into the repository.**

**Answers to the six questions:** (1) create the year folder `1. Overview\<year>` if it is missing, Save window as the fallback; (2) the Anthropic reading of uploads is a switch, **off by default**; (3) the premium budget is the Fact Find's existing reduced-quote request box (`amt` of `bfred` / `redq`); (4) the key-points library is **private in Paul's OneDrive, not in the repository**; (5) no import of the old Excel overviews; (6) everything is built in order. **Stage 1 is the data contract: `docs/OVERVIEW-DATA-CONTRACT.md`.**

**Paul's corrections to the mock-ups (client-free summary; they bind stages 2 to 6):**
- **Entry page:** spacious; **no horizontal scroll bar; an amount never wraps** (only words may); narrower block menu; the monthly label under the figure; an upload button per block and **Upload documents** at the top (everything at once, each document sorted into its block); **+ Add** on every block (also "Add another" for policies, FNA, shortfall, reduced quotes, comparative quotes, investments, group statements); **Remove** with **Undo** on every line that came from a document (policy, investment, group statement, goal report); **Replace quote** and **Remove quote** (the old file stays in the client folder); block 6 is called **Reduced quotes**.
- **Columns:** life cover · severe illness · lump sum disability (age under the heading, read from the quote: 65 or 70) · income protector / sickness benefit (age) · waiting period · **ACI and ABI as two columns**; quote tables have **no premium column** (the monthly premium is the bottom row); heading row and premium row in a subtle colour, **total lump sum and total income protected rows very light orange**; "Total income protected" shows N/A for severe illness; **every income protector amount shows "p.m."**; children by **name and surname**; every quote shows **"CP <number>"** (BrightRock) or **"Quote <number>"** (others).
- **Quote status** starts as **Pending client decision**; then Accepted / Not accepted / Declined / Medical decline / Pending underwriting; a big clear badge on every quote block.
- **Instalment Protector:** each debt line shows "Instalment Protector" under its income protector amount, with a short explanation under the table (wording to be approved in the key-points library) and a red **To be ceded**.
- **Block 3:** the row is just **Personal investments** and draws from block 8; columns life · severe illness · lump sum disability · income protector · waiting period · ACI · ABI · total monthly premium; group risk shows each benefit's **ending age** and who pays; pension / provident from the payslip ("POI needed" when none).
- **Block 8:** every value shows **when and where** it came from (an investment schedule with its date first, Astute only where none); **annual contribution increase on every schedule** ("Not found" if absent). **Block 9:** investment type and contribution kind chosen from the lists in the contract.
- **Every quote** gets **Compared with what you have now** (a three-row table: what you have now, this quote, the difference, per pillar and the monthly premium; no summary sentences) and, for BrightRock, **Your change moment pay-out** (a real table with a short note); both stay **on the same PDF page as the quote**, directly under it.
- **Block 1:** no group heading bars; each policy carries its own tick or cross; then the totals and a grand total per pillar.
- **PDF:** **fills the whole page** (cover edge to edge, the client's name centred, no figure cards); **much larger type** (table text about 15 px, headings 30 px, client name 66 px on the mock-up's scale) so a client can read it on screen; tables fit the page with fixed column widths; the same 11 blocks and the same level of detail as the entry screen; **navigation tabs on every page** (a Cover tab and one per block, the current one highlighted) as internal PDF links, and the PDF opens in single-page view.
- **Presentation:** fills the whole screen on every view; **no scroll bars**; a quote with several tables shows small tabs ("The quote" / "Your change moment pay-out" / "Compared with what you have now"), one at a time; the centre circle shows only the client's name, "Client overview" and the overview date; the information panel is small (three or four key points); **read-only, exactly the information in the sent PDF**; follows **only Paul's microphone**, moves only on a clear directing phrase, never jumps, can also be clicked.

## 5. Stage 2 built (21 November 2026): the entry page, Client Overview 0.1 (on the work branch, not merged)

| Part | Where |
|---|---|
| The page | `app/overview.html`, `app/css/overview.css`, `app/js/ov-schema.js` (blocks, pillars, line types, statuses, standards, file name), `ov-calc.js` (every figure the page works out), `ov-store.js` (the saved file, typing, quotes and lines, pre-fill), `ov-check.js` (checks and dots), `ov-ui.js` (the screen) |
| The other pages | Only the **Other forms** menu: a **Client Overview** link on all three (`#linkOV`); the Fact Find's carries the client on screen (`?from=factfind`), the applications' only when the Fact Find in the browser is for the same client |
| Versions | Fact Find 5.4, Risk Application 1.6, Investment Application 1.5 (display only), Client Overview 0.1; `BUILD` 5.4 |
| Tests | `tests/release-54.test.js` (22 tests, the invented "Test Client" of the brief) and `tests/browser/t-release54.js`; 837 unit tests and 1204 browser checks in all |

**Built the way the brief says:** menu of eleven blocks with dots; one block at a time; no sideways scroll bar and amounts that never wrap (checked on every block); quotes with their lines, status, totals and the "Compared with what you have now" table; blocks 1, 3 and 8 follow the Fact Find (no add or remove, a blue note); block 4 worked out by the page; checks; Fill from Fact Find (automatic from the hand-over, and a button); Save and Open of the overview's own file. **Decisions made while building:** a typed figure checks its row (a person typed it); "N/A" and "Not found" can be typed and emptied again; the page counts "changed items" in the Fact Find per item (a policy row, a child, a header box), not per box; an accepted quote that is issued (policy number and start date) is shown in block 1 and not in its quote block, and a schedule with the same policy number wins; the quote's ACI shows on every line and the ABI is typed per line.

**Not built yet (the later stages):** upload per block, Replace quote, the status flow into block 1 by upload (4); the Presentation (5); review years, comparative tailoring and the change moment pay-out guides (6; the table is already drawn when a file carries one). **Not certain:** seen only in my own screenshots at 1440 pixels wide, not on Paul's screen; the quote lines table is wide and its inputs are small on a narrow window.

## 6. Stage 3 built (21 November 2026): the PDF and saving into `1. Overview\<year>` (Client Overview page 0.2, on the work branch, not merged)

| Part | Where |
|---|---|
| The PDF | `app/js/ov-pdf.js` (jsPDF and the autotable plug-in already in the project): a blue cover, one page for each block (A4 wide, as tall as its content; a first pass on a tall scratch page measures it), a row of twelve tabs on every page with an internal link to each page, `setDisplayMode('fullpage', 'single')`, ticks and crosses and the BrightRock two-row amounts drawn by hand in the cells |
| Saving | `folders.js` / `folders-ui.js`: `RULES.overview`, `overviewCandidate`, `resolveOverview`, `ensureOverview`, `ctx.kind === 'overview'`; **the one place a page makes folders**, as Paul allowed (`1. Overview` and the year, only inside an existing client folder, after the path length is checked) |
| The page | Folders…, Preview PDF and Save PDF in the top bar; the PDF goes beside the saved file in the same year folder; the file layout's own version stays `0.1` (`schema.version`), the page's is `0.2` (`schema.pageVersion`) |
| Tests | `tests/overview-pdf.test.js` (a recording jsPDF), `tests/overview-folders.test.js` (a pretend tree), `tests/browser/t-overview-pdf.js` (the real jsPDF read back with poppler: page count and sizes, tabs and links, single-page view, the same-page rule, every figure of the screen's tables in the PDF, no split amount, no checks printed) and `tests/browser/t-overview-folders.js` (a real directory tree: the year made, both made, the year reused, an older version kept, an existing file asked about, no client folder, two places, a path too long, and the whole tree compared before and after each save) |

**Decisions made while building:** the PDF has all twelve tabs and eleven block pages always, an empty block saying so in plain words (the client sees the same structure every year); a page is as tall as its content so nothing of a quote is split onto another page; the monthly figure under a lump sum is red, as on today's Excel; the change moment pay-out note says "the policy anniversary that follows age 65" (the date of the anniversary is not in the data); a PDF made from an overview that has no figures yet shows dashes. **Not certain:** seen only in my own renderings of an invented client, not on Paul's screen or in Acrobat; the real folder search was tested over the browser's private file system and not on Paul's OneDrive; the look is mine and Paul has not yet chosen between design options (he said he wants a few "when the time is right").
