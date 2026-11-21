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

## 3. Questions for Paul (his to decide)

1. May the page create the year folder `1. Overview\<year>` when it is missing (a change to the "never create a folder" rule, for that one folder), or must it fall back to the Save window?
2. May a document you upload in the page be read by Anthropic (switch off by default)? Or should readings come only from the skill?
3. The premium budget: a new Fact Find box, or an Overview-only box?
4. Key points: who drafts the first versions, and is a public repository acceptable for the wording? (If not, the library can stay in the client's OneDrive and be loaded by the page.)
5. Does Sitamah want her existing Excel files imported, or a fresh start?
6. Which comes first for you: the PDF (stage 3) or Presentation by clicking (stage 5)?
