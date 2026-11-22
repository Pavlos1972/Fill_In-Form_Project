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

## 7. Stage 4 built (21 November 2026): documents, statuses, add / remove / replace (Client Overview page 0.3, on the work branch, not merged)

| Part | Where |
|---|---|
| Documents | `app/js/ov-docs.js`: sorting a document by its file name (`classify`), the instructions for each kind (`promptFor`), the Anthropic call (`readWithClaude`, only when switched on), and what is put where (`applyQuote`, `applyPolicy`, `applyGroup`, `applyInvestment`, `applyAstute`, `applyCmp`, `matchItem`, `logDoc`) |
| The page | Upload documents…, Read client folder…, a Documents card with the reading switch and the list; Upload a … quote…, Replace quote…, and an Upload button on each policy, group item and investment; the saved file's `documents` log (contract revision c) |
| Folders | `clientDocuments` in `folders.js` and `clientFiles` in `folders-ui.js` (read only) |
| Tests | `tests/overview-docs.test.js` (a stand-in for the Anthropic call), `tests/browser/t-overview-docs.js` (the real page, `window.fetch` replaced for the one address) and the Read client folder checks in `tests/browser/t-overview-folders.js` (a real directory tree) |

**Decisions made while building:** reading is a **switch, off until turned on** (Paul's answer 2), kept per browser, and turning it on asks first; the key is the one in the Fact Find's Settings (same browser and address); a document is read one at a time; **everything read is `verify` and `by: "page"`, never `confirmed`**; with reading off a quote is started from the number and the date in the file name and a premium in a file name is never taken; a document that does not match an item of blocks 1, 3 or 8 is **not guessed**; Astute never replaces a schedule's value (schedules first); a quote with a number that is already there is pointed out. **Not certain:** the real Anthropic call has not been made (the tests replace it; a real PDF has not been read, so the quality of the readings is unknown and the instructions in `ov-docs.js` will need Paul's and the Fix Skills chat's corrections after the first real documents); a very large PDF may be refused by Anthropic (said in plain words); the change moment pay-out guide can be read but had no typing screen at stage 4 (built in stage 6: section 9).

## 8. Stage 5 built (21 November 2026): the Presentation (Client Overview page 0.4, on the work branch, not merged)

| Part | Where |
|---|---|
| Without a screen (tested alone) | `app/js/ov-pres.js`: the tabs, the map's short figures, the closed list of topics built from the overview (`topics`), the command grammar (`parse`), the decision (`decide`), the engine (`createEngine`) and the key-points library (`parseKeyPoints`, `pointsFor`, `benefitsFor`) |
| On the screen | `app/js/ov-present.js` and `app/css/present.css`: the overlay opened by **Present**, the map, the tabs, one view for each block (the same words and figures as the PDF), the quote tabs, the highlights, the key-points panel, the voice button |
| Tests | `tests/overview-present.test.js` (grammar, topics, engine, key points, wiring) and `tests/browser/t-overview-present.js` (the real page: no scroll bar at three sizes, read-only, highlights, key points, **every block's figures equal to the PDF page's**, the voice through a stand-in for the listener) |

**Decisions made while building:**
- **One set of figures.** The Presentation draws its tables from `ov-calc.js` as the PDF does; the browser test reads every block's figures (all quotes, all quote tabs, every policy's lines) and the PDF page's with poppler and fails on any difference in either direction.
- **No scroll bar, ever:** each view is drawn at a fixed 1,240-pixel width and scaled to fit the stage (never above 150%); the smallest view is drawn at 70% of its size on a 1280x720 screen, 91% on 1600x900 and 112% on 1920x1080.
- **The voice, in the words of the brief:** *locked until a command phrase* is built as "a line must START with a command phrase" (a fixed list of leads), so ordinary talk, and a client's words, cannot move anything; **there is no separate unlock word**. The listener is started with the **call sound off**, so the only audio is Paul's microphone. **The local speech models and Chrome's recognition do not tag who spoke** (only the OpenAI call mode does), so a line with no tag is taken as the adviser's and a line tagged `client` (or anything else) is dropped before it is read. **No spoken line is kept anywhere** (a test checks the engine holds none). **The voice never calls Claude.**
- **After a move a 2.5 second cool-down; after any click the voice waits 8 seconds** (the line under the top bar says which). A name that fits two things at the same strength (for example *investments*, or *the loan* with two loans) **moves nothing and offers buttons** (the brief says two; up to four are offered when more tie). A benefit or a line asked for on a page that does not have it **does not jump to another page**: it says so.
- **Quotes:** one button for each quote of a block with several; **the pay-out tab appears only for a quote that has a pay-out** (as the PDF prints it only then); the comparison tab is always there.
- **Key points:** at most four approved points; only for the insurer of the quote or policy on screen and the benefit chosen; none are shown before a benefit is chosen. The library is Paul's private file, loaded once and kept in this browser; **it is not in the repository** (a test fails if a key-points file is committed).

**Not certain:** seen only in my own screenshots, not on Paul's screen or a projector; **the voice has not been tried with a real microphone or a real speech model** (the browser test replaces the listener, so what it proves is the routing, the rules and the screen, not how well the speech engine hears "let's talk about the shortfall"); **a line the speech engine mis-hears as another command phrase would move the screen** (the cool-down limits the harm, and a click always works); the local engines cannot tell Paul's voice from a client in the room, so the lead-in phrase is the only protection against the client saying *"go to the next one"*; Chrome's recognition (if chosen in the Fact Find's settings) sends the sound to Google, and the Presentation says so; **the look is mine and Paul has not yet seen it**; the key-points file layout is as agreed in the contract but no real library has been built or loaded; **printing or sharing the Presentation is not part of it** (the PDF is what the client keeps).

## 9. Stage 6 built (21 November 2026): pay-out typing, comparative quotes, review years (Client Overview page 0.5, on the work branch, not merged)

| Part | Where |
|---|---|
| The pay-out | `ov-store.js` (`newCmp`, `addCmp`, `removeCmp`, `addCmpChild`, `removeCmpRow`), `ov-ui.js` (`cmpHTML(owner, path)`: an editor under a BrightRock quote and under one of our BrightRock policies), `ov-pdf.js` and `ov-present.js` (a policy's pay-out under its lines), `ov-check.js` (`cmp.match`) |
| Comparative quotes | `newQuote` starts one `Cover` line, whole of life; "+ Other line" first; a blue note |
| A review year | `store.startReview(old, today)`, the **New review year…** button and `newReview()` in `ov-ui.js`, the `review.carried` check, the side card line, `header.previous` |
| Tests | `tests/overview-review.test.js` and `tests/browser/t-overview-review.js` (the real page, the PDF through poppler, the Presentation, a saved overview opened and a review started from it) |

**Decisions made while building (all of them are defaults for Paul to correct; the brief gave only the headings "review years, comparative quotes, change moment pay-out guides"):**
- **The pay-out is typed on the page, not only read.** It is offered for an insurer called BrightRock (a quote) or one of our BrightRock policies; the rows are the guide's (total, retirement, childcare, each child); a guide the insurer did not produce is a reason typed in.
- **A review year starts from the overview on screen, not from a chosen file** (open last year's overview first). **It refuses while there are unsaved changes**, so last year's file is certain to be kept; the new file has its own date and so its own name, and its year folder follows the date. What carries over is policies (our issued quotes included), group benefits, investments, the goal reports asked for and the other cover, **all marked "to check" and "from last year's overview"** (a check counts them until a document replaces them or a person types a figure); what does not: quotes (the new FNA replaces last year's), proposals, the documents list, the meeting and Astute dates, and last year's pay-out guides (their projected values change every year).
- **"Last year's PDF kept"** is the existing rule that a new date is a new file name; nothing overwrites last year's PDF.
- **A servicing quote already shows today's figures only** (the lines table has no before-and-after); nothing new was built for it.
- **Comparative quotes:** one whole-of-life line to start with (replaced when a document is read); the user adds "Other line" rows and describes them; no change to totals, PDF or Presentation (they already draw any line type).

**Not certain:** seen only in my own screenshots, not on Paul's screen; **whether the carried-over rule is what Paul means by a review year** (for example whether last year's FNA should stay visible for comparison, or whether the Fact Find should be re-read first) is a guess to be corrected; the pay-out editor was tested with typed figures, not with a real "BR CMPO" guide; a BrightRock policy that came from an issued quote keeps the quote's pay-out only while the quote exists (a review drops it); the comparative quote's single starting line is my choice, and a quote that prints several amounts per benefit is typed with more lines.

## 10. Paul's changes of 22 November (Client Overview Studio 0.6, on the work branch)

Paul looked at the page on his screen and asked, through the Fix Skills chat: (1) the new name; (2) reading on by default (**this replaces his answer 2 of 21 November**, "off by default"); (3) three ways to fill blocks 2, 5, 6, 7, 9 and 10; (4) the menu dots explained, and the Shortfall dot green only when the FNA has figures. His note: "Today Paul's FNA upload filled nothing": with reading off, an upload was only recorded.

| Part | Where |
|---|---|
| Name | `overview.html` (title, h1), `ov-ui.js` (the tab title), the Other forms link of the other three pages |
| Reading | `ov-ui.js` `aiOn()` (on unless the stored switch is `0`); `ov-docs.js` new kinds `proposal` and `goal` (prompts, `applyProposed`, `applyGoal`, `isEmptyRead`, classification by file name, the quote's `servicing`) |
| Client folder | `folders.js` `clientSubfolder` and `findFiles` (read only), `folders-ui.js` `clientFolder`, `ov-ui.js` `fromClientFolder`, `readGuide`, `reconcile`, the `data-upc` buttons |
| Matching with the Fact Find | `ov-check.js`: the child by first name when the surname differs, the bank of a debt, a proposal against the Fact Find's request; `problems[].line`; `ov-ui.js` `lineFlag` (the amber mark and hover on the line) |
| Dots | `ov-check.js` `dots`, `dotText`, `LEGEND`; `ov-ui.js` `drawNav` (hover text, the legend), `overview.css` |
| Tests | `tests/overview-studio.test.js`, `tests/browser/t-overview-studio.js` (a real folder tree in the browser's private file system, the Anthropic call replaced by a stand-in that answers by kind of document) |

**Decisions made while building (defaults for Paul to correct):**
- **Where the file window opens:** the client's numbered folder whose name says *quote*, *goal* / *RGAR* / *EGAR* / *analysis* or *proposal* (then *investment*); for comparative quotes the deal folder's `Comparative Quotes`; else the client's folder. **I do not know the real folder names beyond those the code already used (`1. Overview`, `2. Fact Find`, `5. Astute`, `6. Policy Schedules`, `Comparative Quotes`): if Paul's quotes live in a folder with another name, tell me the name and it is one table in `folders.js` (`DOC_KIND`).**
- **The pay-out guide is looked for only beside the quote that was picked** (the folder the file window opened in, and one level inside it), by "CMPO" or "change moment" in the name AND the same CP number as a digit run; only for a BrightRock quote that was read; if none is found the page says so.
- **Reading "fills EVERY box"** is as good as the instructions in `ov-docs.js`; **the real Anthropic call has still never been made**, so what a real BrightRock FNA gives is untested. When a reading finds nothing the page says so and only records the document.
- **The Fact Find comparison keeps the document's value and flags the difference** (it does not adopt the Fact Find's value), as Paul said: never silently overwrite.
- **The browser may need one more click** to open its file window if finding the folder took long: a small "Choose" window then asks for it.
- **"Client Overview" stays in the Presentation's centre and in the PDF** (the client-facing words); only the page's own heading, tab and menu links are Studio.

**Not certain:** seen only in my own screenshots; the real file window opening in a real OneDrive folder (`startIn` with a connected folder handle) is untried here; the folder names above are a guess; the real reading quality is unknown.

## 11. Paul's changes after using Studio 0.6 on his own screen (22 November, second batch; Client Overview Studio 0.7, on the work branch)

Relayed by the Fix Skills chat with Paul's "GO" (twenty-one items) and, in the middle of the build, one more line from Paul himself: the monthly figure under a BrightRock lump sum, *Income portion*, must read **Income portion p.m.** (per month). Built as asked; **the saved file gains keys and loses none (contract revision f)**.

| Part | Where |
|---|---|
| See more / See less | `ov-ui.js` (`openSet`, `isOpen`, `seeBtn`; the summary tables of blocks 1, 8 and 9 draw each row in its own `<tbody data-comp>` so the open detail under it is never redrawn while typing; the detail is a `<tbody class="dtl">`); `overview.css` |
| Lines read from the quote | `ov-ui.js` `lineHTML` / `linesTable` (no × column and no add buttons for a quote; a policy keeps both; a quote with no active lines still offers the add buttons) |
| % and R in the boxes | `ov-ui.js` `dispIn` (the parsing already understood both) |
| ACI in the quote's words | `aciText` (`ov-store.js` `newQuote`, `ov-docs.js` prompts and `applyQuote` / `applyPolicy`), `ov-calc.js` `fmtAci`; screen, PDF and Presentation |
| Child care waiting N/A | `ov-store.js` `newLine`, `normLine`; `ov-docs.js` `line()` |
| Checks panel | `ov-check.js` `docLines`, `qTitle`; `ov-ui.js` `drawChecks` (the long list folded under *All N individual checks*) |
| Undo notices | `ov-ui.js` `recent`, `fresh`, `markRemoved`, `sweepNotices` (10 seconds) |
| Block 11 | `ov-ui.js` `badgeHTML` (*from Fact Find*), `otherBlock` (upload for the legacy plan only); `ov-docs.js` `applyOther`; `ov-check.js` `dots` (amber until confirmed) |
| Pages left out | `ov-calc.js` `pageShown` / `pageWhy`; `ov-store.js` `quotesAsked` (`factFind.facts.asked`); `ov-pdf.js` `pagesOf`, `tabRow`; `ov-pres.js` `shownOrder`, `topics`, `mapFigures`; `ov-present.js` |
| PDF cover and empty pages | `ov-pdf.js` `cover` (white, a blue strip), `groupPage`, `investmentsPage` |
| Presentation design | `css/present.css` (white, the Wealth Revolution blue, orange accents), the logo in the bar |
| Tests | `tests/overview-seemore.test.js`, `tests/browser/t-overview-seemore.js`; the older Overview browser tests call `OV.app.openAll()` once (the page itself starts folded) |

**Decisions made while building (my readings, for Paul to correct):**
- **"Quotes are read from the document and not editable"** is read as: no add and no remove of lines; the boxes still take typing, so a misread figure can be corrected (the page never marks a typed or read figure as checked on its own).
- **A quote with nothing in it yet** (started by hand, no lines) still offers the add buttons, so a hand-typed quote is not a dead end; a policy keeps its add and remove buttons (Paul spoke of quotes).
- **"Shortfall quote requested" / "comparative requested in the Fact Find"** are read from the Fact Find's boxes: a shortfall quote is asked for when `bf_sf_req` or `sf_req` says *Request a quote*; a comparative quote when the standard lane asks for one (`fna_req`, `sf_req` or a row of `redq`). A quote that is already in the overview also makes its page show.
- **A goal analysis page** is there when a report was asked for (or has figures); **a proposed investments page** when there is at least one.
- **"Always the full policies and quotes" in the Presentation** is read as: nothing of the screen's folding reaches it (it already showed every quote's lines in full, and a policy's lines when it is clicked).
- **A document that was just read opens its item** (a quote just added opens too), so it can be checked at once; everything else starts folded.
- **The Checks panel's lines** count a quote's rows still amber, and the differences from the Fact Find or from Paul's standards; the full list of checks is one click away.
- **Not certain:** all of it is seen only in my own screenshots, not on Paul's screen; the white Presentation has not been seen on a projector; the ACI wording depends on how well the real reading copies it (the Anthropic call has still never been made on a real document).
