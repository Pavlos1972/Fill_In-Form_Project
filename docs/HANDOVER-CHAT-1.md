# Handover of Chat 1: the Wealth Revolution Fact Find

Written on 16 November 2026 by the Claude Code session that built versions 3.1 to 4.5 with Paul, for the new session called **"Fact Find Audio to Text Form - Chat 2"**. Read `CLAUDE.md` first (short, the rules and the release routine); this file is the long version: the whole story of Chat 1, so nothing is lost.

**How this file was made, and what that means for how far to trust it.** The early part of Chat 1 was lost when its context was compacted. This file was rebuilt from: the repository (`git log` of `main`, `docs/FORM-CHANGES.md`, `README.md`, `CLAUDE.md`, `docs/HANDOVER-release-3.1.md`, the tests), the list of pull requests 1 to 76 and their descriptions (a digest was made by a helper and is cited where used), the summary Chat 1 kept of its own later part (releases 3.8 to 4.5), and what Paul said, which is quoted where it is known word for word. Section 9 lists what could **not** be recovered. Where a statement comes from memory of the later part of the chat rather than from the repository, it is marked *(from the chat)*. The repository is the proof for anything about code; this file is the proof only for what Paul said and why.

The clone this was written in started **shallow** (history from pull request 16); it was completed with `git fetch --unshallow origin`, so the whole history is available: `main` starts with an *Initial commit* (`8e83a7d`, 14 October 2026), then PR 1 (`06ff522`, 20 October). If a future clone is shallow, run `git fetch --unshallow origin` first.

## Contents

1. Paul, how he wants to be spoken to, and every rule and decision he gave
2. Every version, from the first to 4.5
3. The release routine, exactly as it is run
4. The repo map: the files, the tests, the saved file, voice, keys and costs, the PDF
5. The Fix Skills chat
6. Open items
7. Links
8. What went wrong and what was learnt
9. What could not be recovered

---

## 1. Paul, how he wants to be spoken to, and the rules he gave

### 1.1 Who Paul is and who uses the Fact Find

| Who | What they do with the Fact Find |
|---|---|
| **Paul Kafentzis** | Financial adviser at Wealth Revolution (FSP45946). He fills the Fact Find in with a client in a meeting, by typing or by voice, and decides everything about it. He is not a programmer: he judges by looking at the screen and by what the form does with a real client. |
| **Sitamah Nathoo** | Paul's personal assistant. She reads the **Action Points for the Personal Assistant** on the Admin page and does the follow-up. Every action point is an order to her ("Sitamah, please action these for the client ..."). |
| **The skills** | Programs that run in Paul's Claude app and read or fill the saved Fact Find file **by box id**: `review-fact-find-fill-skill`, `ff-population-transcript`, `fact-find-summary`, and others (`advicetech-client-notes` writes `cc_notes`; `complete-applications-skill` is meant to fill the real insurer forms from the Short Risk Application file but is **not connected yet**: Paul will do that). They are renewed by the **Fix Skills chat** (section 5). |
| **The clients** | The people in the meetings. Real client data never goes into tests, commits or the README: use invented names. (The repository already holds a few meeting labels, such as "the Elmer Jonker meeting" and "client Sibanda"; they are labels of recorded meetings, nothing else about those people is kept.) |

### 1.2 How Paul wants to be spoken to *(CLAUDE.md, and the chat)*

| Rule | In practice |
|---|---|
| **Plain, short wording** | Short sentences, everyday words, no jargon. Say what happened, what is **not certain**, and ask before merging. |
| **Tables with two columns** | Where a table helps, make it two columns (what / what it means). Not long prose. |
| **Be honest about slips** | A slip is told plainly and put on the changes page. Never say it is "live" before it is; never say a test passed that did not. |
| **Say what you cannot see** | The live website and Paul's computer cannot be opened from the sandbox: say so, and leave the live look to Paul. |
| **A visual question: draw first** | When the question is how something should look, draw a **mock-up Artifact** and let Paul choose (done for the top bar, 4.3; the mock-up page is in section 7). |
| **Never ask for a key in the chat** | The API key is renewed by Paul in the console; he saves it in Settings. Never ask him to paste a key into the chat. |

### 1.3 The working pattern (Paul's order of work)

| Step | Who |
|---|---|
| Paul **asks** (often with a screenshot) | Paul |
| You **explain back**, with questions where something is unclear | You |
| Paul says **"build"** (or "All suggestions are fine. Build") | Paul |
| You **build**, test, push to the work branch, say what is built and **what is not certain**, and ask "merge?" | You |
| Paul says **"merge"** | Paul |
| You merge (section 3), check the deploy, send the ZIP, give the note for the Fix Skills chat | You |
| On Paul's word ("Update the changes page") you update the changes page | You |

A small, clear instruction may be built at once, but **the merge always waits for Paul's word**. Paul sometimes says "I have asked the skills chat to read your request and answer you THEN Build": wait for that.

### 1.4 Paul's standing rules (all of them)

| Rule | Detail |
|---|---|
| **Nothing is merged until Paul says "merge"** | Build, test, push to the work branch `claude/create-something-stjk8a`, tell Paul it is ready and what changed. Do not open a pull request unless he asks (he asks by saying "merge": the pull request is opened then). |
| **Merge only the exact commit the Tests run passed on** | Take the SHA from `git rev-parse HEAD`, never from memory; the Tests run for that commit must be `success`; squash-merge with `expectedHeadSha`. |
| **Versions are compared as decimals** | The code does `parseFloat(schema.version)`. After 3.9 comes **4.0**, then 4.1. Never 3.10 (it would read as 3.1). |
| **One dated zip as the backup** | Never loose "before" folders next to the copy on OneDrive (OneDrive once rewrote the page links so they pointed at a backup folder). |
| **The whole `WR Fact Find` folder as one ZIP** | Installed as a whole, never file by file (but see section 5: the Fix Skills chat copies only the changed files and reads them back). |
| **Never say "live" until the deploy step has finished** | The status call can lag; ask again. |
| **Do not change ids or lists while the skills are being renewed** | The Fix Skills chat says when it is safe. |
| **Session size** | When the context passes about **80%**, finish the release in hand, update `CLAUDE.md`, and tell Paul in one line to start a new session. **Never start a release above about 85%.** (This handover exists because of that rule.) |
| **Keep README.md up to date** (Paul, "always") | Every change a user can see, or that changes how the app, tests or publishing work, goes into `README.md` in the same commit. A statement the change makes untrue is corrected or deleted, not left beside the new one. A change is not offered for merging until `npm test` passes, which includes `tests/readme.test.js` (page order and the Layout table's file paths are checked against the code). |
| **The PDF always mirrors the form** (Paul, "always") | Every change to what the form shows is made in the PDF in the same commit. The PDF is drawn from `app/js/schema.js` by `app/js/pdf.js`; the parts drawn by hand (priorities and quotes page, BrightRock Risk Calculation page, quote tables, lists, Admin page) are updated by hand. Not finished until `tests/pdf-mirror.test.js` and the browser check `tests/browser/audit-pdf.js` pass. Left off the PDF **only**: the public profile (LinkedIn) (`nopdf` in `schema.js`) and the Claude and OpenAI cost figures. A PDF saved earlier does not change by itself: open the client's file and save the PDF again; say so when a change would make an earlier PDF look different. The Short Risk Application (`sr-pdf.js`) and the Investment Capture Sheet (`cs-pdf.js`) follow the same two rules. |
| **Ids never change when only a label changes** (Paul, with the skills chat) | Skills and saved files read boxes by id. A box whose **meaning** changes gets a **new id**; the old id stays (marked `legacy` in `schema.js`, shown only while a file holds an answer in it). |
| **Every release that changes the form's boxes bumps `version`** | In `app/js/schema.js` (`sr-schema.js` for the Short Risk Application, `cs-schema.js` for the Capture Sheet). A saved file carries it as `schema`. |
| **`docs/FORM-CHANGES.md` in the same commit** | Dated; one line for each id added, removed or relabelled, each change to a sum or a tax table, each list column added. |
| **`app/js/worked.js` in the same commit** | A new calculated box, list total, area total, or change to the instalment protector is added there; `tests/worked.test.js` proves the `worked` block equals the PDF text. |
| **File names** (Paul, do not change unless asked) | The PDF and the saved `.json` have the same name: `Fact Find (Audio to Text) - dd.mm.yy - (Name Surname)`, e.g. `Fact Find (Audio to Text) - 04.11.26 - (Sitamah Nathoo)`. Date = the form's *Date completed*, two-digit year; `(New client)` until a name is entered. Built by `store.pdfFileName()` / `store.baseFileName()`. A file that is opened keeps its own name when saved again. (Until 3 November 2026 the PDF said "Voice to Text" and the .json was `Fact Find - dd.mm.yyyy - Name Surname`; Paul changed both: PR 28, then PR 49.) |
| **The Risk Tolerance questionnaire is a copy** (Paul agreed) | `app/js/cs-rt-data.js` and `app/assets/rt-form.js` copy the Risk Tolerance website's (risktolerance.netlify.app) statements, scoring, profiles and the firm's PDF form, because the form cannot read another website's answers. A change to that website is made there too; the website itself is never changed from this repository. `tests/cs-store.test.js` pins the scoring. |
| **The questionnaire's PDF is saved separately** | Meant for the client's "2. Fact Find" folder; the Save window opens in the folder of the Fact Find that was loaded. **The Declaration stays with the application** (Paul's decision), not after the questionnaire. |
| **A note for the Fix Skills chat at the end of every release** | See section 3, step 8. |

### 1.5 Paul's decisions, with his words where they are known

Quotes are word for word from the messages Paul wrote in Chat 1 *(from the chat's own record)*; where only the substance is known it is marked "(paraphrase)".

| Decision | Paul's words, or the substance | Where it went |
|---|---|---|
| **The BrightRock ACI is the Yearly premium increase, not the base increase** | After the first build of 3.9 used the wrong figure: *"Hold on - the example of Alex Sibanda ... his ACI is 10% not 3% ... His ABI is 3% ... Did you confuse things a little, I think?"* (He was right.) | 3.9: `br_aci` = Yearly premium increase (10.0% on the example); the Yearly base increase (3.0%) is the ABI and is never filled from the policy. |
| **The ACI rule does not touch the ABI** | *"You need to find the ACI info from the client's BR policy schedule ... Do NOT apply the ACI rule to the ABI rule"* (the second message corrected where to look: the policy schedule's BR Cover Summary, not only the client's file). He then had the skills chat read the request first: *"I have asked the skills chat to read your request and answer you THEN Build"*. | 3.9 and 4.0 |
| **One ACI for every benefit** | *"In the FF form, under 'BrightRock Risk Calculation' ... all other ACI fields ... equal that entered amount"* (paraphrase of the ask: a value typed in one ACI box goes into the others). | 4.0 |
| **Remove the "?"** | *"Let's remove the '?' altogether"* | 4.0: the ACI value boxes start empty; the Checks flag an empty ACI value once a quote is asked for. |
| **Meetings** | *"There are cases where a FF is only completed over two or three meetings ... find a way ..."*; *"I want all dates for every meeting held"*; then, about the answers I proposed: *"All suggestions are fine. Build"*. And: *"'What was covered' - should be recorded by the program ..."* and *"'I did not add who was on the call' - why not?"* (so Others on the call is a column of every meeting and `on_call` is the last meeting's). | 4.0 (`meetings`, `covered`), and 4.5 (one line each) |
| **Passed appointments** | Paul's four points after 4.0 (paraphrase): (1) an appointment that has passed should say so and record what happened; (2) "to verify" and "not asked" on the Progress card should be clickable; (3) a **Verify All**; (4) separate **Personal** and **Work cell** numbers. His answers to my questions: *"1. a-c as per your recommendation, 2 Fine, 3 a Yes, b OK, c OK, 4 Yes, 5 Yes / Build"*. | 4.1 |
| **Calendar and Verify All must reach everywhere** | After testing 4.1 (with screenshots): *"1. There is no Calendar drop down - please ADD 2. The Verify All - needs to work on all pages"*; and mid-turn: *"The gender needs to be auto picked up from the ID"*. | 4.2 |
| **The top bar** | *"I don't like the way that this is structured ..."* then, after the mock-up page: *"Option B is best - BUT Claude must be renamed 'Anthropic'"*. | 4.3 |
| **The page links as a dropdown** | *"You had this in a dropdown in your example, why did you not do that?"* (He had chosen Option B, where the two page buttons stay; the dropdown was Option A. He then wanted the mix.) First *"Build the dropdown in a new chat"*, then (relayed from the Fix Skills chat, at 16% context) *"build the 'Other forms' dropdown here in this chat ... keep the keys and costs table. Release 4.4, same routine."* | 4.4 |
| **Meetings held: far too big** | *"These are far too big - it should be a ONE line: Day & Date, Who was also on the call and what was discussed. This is taking up too much space and not even collapsable"* | 4.5 |
| **Notes** | After 3.8: *"Checked, notes look much better so far, it will need to be tested further on other clients"*. | Open item (section 6) |
| **Drop a review idea** | The Fix Skills chat relayed a question about reviewing inside the form; Paul: *"Forget this - let's move on"*. | Nothing built |
| **Yes to standard tables too** | *"Yes, standard tables too"* (the question it answered is not recorded word for word; the 3.9 "%" rule does cover the percentage boxes of the standard quote tables as well as the BrightRock page, and the standard quotes are not part of the one-ACI rule). | 3.9 |

Earlier decisions (before 3.8) are in the pull request descriptions and in the version table (section 2): the three-group top bar, the Client priorities page, one "no" (Not a priority), automatic Not a priority only where a fact makes the area pointless, the meeting file names, the standing PDF rule, Broker on record everywhere defaulting to Other broker, numbered priorities 1 to 8, the Priorities to be Focused on box, and so on.

---

## 2. Every version, from the first to 4.5

**How the numbering works.** The form had no version number in its first weeks: work was tracked by **pull request number** (PR 1 to PR 59). The form became **version 3.0** by the time PR 60 was made, and the first numbered release was **3.1 (PR 60, 11 November 2026)**. From then every release has a version, a `docs/FORM-CHANGES.md` entry, a "Release X.Y" section in the README and its own test files. The Short Risk Application (`app/js/sr-schema.js`) and the Investment Capture Sheet (`app/js/cs-schema.js`) have their own versions (Short Risk 1.0, 1.1, 1.2; Capture Sheet 1.0).

All 76 pull requests were made from the one work branch `claude/create-something-stjk8a` and **squash-merged on Paul's word**; every one is merged, none was closed unmerged and none was reverted. "Commit" below is the squash commit on `main`.

### 2.1 Before version numbers: PR 1 to PR 59 (20 October to 10 November 2026)

Test counts are unit tests (`npm test`) as the pull request stated them. "Not tested" is what the pull request itself said was not proved.

| PR (merged) | Commit | What it did, and why |
|---|---|---|
| **1** (20.10) | `06ff522` | The first PR. Its squash commit is titled *Fact Find: voice mode, Chrome listening fixes and online publishing*; the pull request's own title on GitHub is *Add Fact Find revision analysis* (`docs/Fact_Find_Revision_Analysis.md`). So the base of the app (the form, voice mode, listening, the website publishing) is PR 1, on top of the *Initial commit* (14 October). |
| **2** (20.10) | `67d5834` | Voice fixes from the live sessions of 20 October: a misheard email name or domain repaired from the form and common domains, "email address is incorrect" and "delete that" empty a box, more consent-to-record wordings, Chrome listening restarts when it freezes and logs what it heard. 185 tests. |
| **3** (20.10) | `6784acf` | **Cut the web look-up cost:** the look-up model defaults to Sonnet (a saved Opus replaced once); the LinkedIn search runs only on its button. 186 tests. |
| **4** (22.10) | `0101638` | Occupation moved before Income & household (form, side menu, voice, PDF). |
| **5** (26.10) | `f199c06` | Hearing, from the 26 October log: Chrome's other wordings sent to Claude, restart after an aborted listening, a fuller listening log. 188 tests. |
| **6** (26.10) | `72db712` | **OpenAI transcription as a third speech source** for names and addresses (Chrome's recogniser cannot produce rare names, e.g. the adviser's own surname, and its 5-minute sessions end). `listen.js` `openaiEngine`; needs an OpenAI key. 192 tests. *Not tested with a live OpenAI key and voice.* |
| **7** (26.10) | `d4ef079` | The **meeting timer** (`timer.js`: starts at the first Listen, pause, Reset, survives a reload); Chrome listening renewed at a 1.5 s pause after 4 minutes. 200 tests. *Renewal tested only with a simulated recogniser.* |
| **8** (27.10) | `eb39736` | The **top bar in three groups**: Settings/New/Open, Meeting/Voice/Listen, saving. Layout only. |
| **9** (27.10) | `e5322d0` | Settings: a link to the OpenAI console beside the OpenAI key. |
| **10** (27.10) | `fd351ce` | **Hear the client on a Teams call.** Prompted by the first real client meeting (27 October, Teams, headset: all 274 log lines were the adviser). New Settings option *Hear the client on a Teams call* (OpenAI source): **Listen** opens Chrome's share window, the call's sound is transcribed beside the microphone, lines are labelled `who: me` / `who: client`, an echo of a mic line repeating a client line is dropped. 207 tests. ***NOT tested against a real Teams call or Chrome's real share window (a short test call is needed). Still open: section 6.*** |
| **11** (27.10) | `019faff` | Labelled sound bars ("Paul Sound", "Client Sound"); Health moved after Children. |
| **12** (27.10) | `ef1df48` | **Type of quote** dropdown (New Business / Servicing / N/A); dropdowns open by themselves while voice waits on them. 210 tests. |
| **13** (27.10) | `6047b2a` | A child's **Age** beside the date of birth; defaults for the risk calculation boxes (ACI Fixed, ACI value "?", ABI 3%/5%). 212 tests. |
| **14** (27.10) | `b1f4425` | Shortfall quote only with a group; children's Name and Surname apart; the client's Gender from a valid ID; an ID number can appear once. 219 tests. |
| **15** (27.10) | `372c3c7` | Income protection insured amount = the take-home net income (calculated). 220 tests. |
| **16** (27.10) | `cb47c64` | PDF: symbols the font cannot draw print as plain text (they printed as "?"). |
| **17** (28.10) | `e2fda92` | **Date of marriage**; voice lines read at the same time (up to four requests at once, applied in spoken order): median heard-to-form time 5.99 s down to 1.41 s on the replay of a 274-line log (the Erika Kuiper meeting label). 225 tests. *Not tried in a live meeting.* |
| **18** (28.10) | `d286d42` | **"Heard but not placed" list** (saved as `unplaced`) and the **catch-up check** that re-reads the conversation and fills only empty boxes (amber). 229 tests. *Not tried live with a real key.* |
| **19** (28.10) | `5006364` | Debts: Ex-Spouse/Partner added to Owner and Payer. |
| **20** (28.10) | `09b530b` | Fixes from the **Vera Zeller test meeting** (476 lines, 32 minutes): lost answers, short answers re-read, partner ID/cell said in pieces, slow calls raced, year-only dates, "all verified" confirms every waiting answer. 239 tests. |
| **21** (28.10) | `527a17c` | The **Client priorities page** (Life, RA, RGAR, Invest, EGAR, Medical Aid, Will, Short Term, Business assurance), Personal & group risk cover as one page, Retirement funding its own page, the Advisor box and Documents to request removed. Per-area summaries written by Claude (`summary.js`). 254 tests. |
| **22** (28.10) / **24** (29.10) | `5d5f622`, `3819a23` | Placement of the risk calculation: 22 kept it open with the Life area; **24 reversed it**: its own page after Client priorities, always there, with its own Notes box (`n_calc`). |
| **23** (29.10) | `3cec48a` | Summaries no longer claim "none" for what has not been asked yet. |
| **25** (29.10) | `6a28fc0` | Fixes from the **29 October test meeting (Sitamah Nathoo)**: a line that is only the adviser's own name is ignored (it had filled the client's name); the client's spelling wins; "years in this occupation" from "since February 2022"; Gap cover can be Not sure; Preferred monthly spend. 264 tests. |
| **26** (29.10) | `1991d8a` | Two batches Paul asked for: the yellow decisions *Client not sure, needs to think about it* / *needs to check their budget*; the Life summary adds total debt, monthly repayments, childcare cost; Business assurance; Retirement funding split into RAs and Pension/provident funds; voice finishes sections; the page became **Risk Calculation & Quotes** with the **Instalment Protector**; Dread cover starts R 500 000. 278 tests. |
| **27** (29.10) | `6e78517` | Income protection age starts at 65; the Life area is headed **Personal Risk Covers**. |
| **28** (29.10) | `90d794e` | The saved PDF named `Fact Find (Voice to Text) - dd.mm.yy - (Name Surname)`; the rule written into the README and a new `CLAUDE.md`. **Corrected by PR 49** ("Audio to Text", and the .json shares the name). |
| **29** (30.10) | `a89a837` | **"Can we send you a LOA to sign?"** (Yes / No / Not now); **Request Current Policy Schedule(s)** tick lists under each cover area; the new **Admin page** with Next appointment and the **Action Points for Personal Assistant** (Claude, with a plain fallback in `actions.js`). 290 tests. |
| **30** (30.10) | `ffd56ac` | **Two kinds of life quote**: BrightRock Fractured and Standard (insurers as a tick list); the page became **BrightRock Risk Calculation** (fractured covers only); the page "Client priorities and quotes needed". 301 tests. |
| **31** (30.10) | `71fa9a8` | A note on the RGAR area saying what the report needs. |
| **32** (30.10) | `38f30b0` | The PDF mirrors the updated Fact Find; new `tests/pdf-mirror.test.js`. 308 tests. |
| **33** (30.10) | `572296f` | Voice reads the standard quote details; "make a note" goes to the priorities page's notes box. 309 tests. |
| **34** (30.10) | `43cbf85` | The five schedule boxes are never locked. |
| **35** (30.10) | `9705cd4` | **Instalment protector**: a master switch and a switch for each debt. 312 tests. |
| **36** (30.10) | `b2a7e94` | **Audit batch A** (the first of the 31 audit findings): quote checks, hidden boxes, dates, amounts ("R1.000,00" read as 1 000), gates, voice slips. 331 tests; the browser regression (48 scripts) was identical to before. |
| **37** (30.10) | `30aa915` | **Audit batches B, C and D**: Yes/No list gates; progress counts real answers; boxes under an answer greyed; **only debts the client pays come off the take-home income** (decided with Paul); "Household net income" became "Client take-home income"; **publishing runs the tests first** and a new `tests.yml` runs them on every pull request; the unsaved draft is offered back; Settings says keys are plain text. 356 tests, 162 browser checks. *Not done: the speech library still loads from the jsDelivr CDN.* |
| **38** (30.10) | `ddabf0c` | The last three audit findings: the child cost box is **Childcare (R p.m.)**; each fact asked once; page order (Debts and Children after Income, Smoker on Health, the LOA on Admin). 365 tests. |
| **39** (30.10) | `d309110` | Reversed PR 38's merge of the two retirement schedule requests (Paul asked for them back); the three notes under the BrightRock Fractured quotes; BrightRock waiting period starts at 1 month. 367 tests. |
| **40** (31.10) | `57c01f3` | Schedule requests worded for each area ("Requested Personal Risk Covers in meeting, await client response"); **the README rule** and `tests/readme.test.js`; about 20 README statements corrected. 376 tests. |
| **41** (31.10) | `5bad752` | **Settings round:** the browser draft is removed only after the saved file is read back and matches; two key expiry dates with top-bar chips; the OpenAI speech spend estimate (`openai`). 381 tests. |
| **42** (31.10) | `4b804f3` | Top bar: the four key and cost chips together at the far right. |
| **43** (02.11) | `40b7f81` | Removed the next-session reminder about the page-list screenshot (project notes only). |
| **44** (02.11) | `f5bdf58` | Reduced quotes note: "... (if BR Shortfall Quote is applicable)". |
| **45** (02.11) | `2aef976` | The client's name and the save state centred above the meeting buttons (screens at least 1300 px). |
| **46** (02.11) | `3ee5d38` | **Next appointment: day and time** (auto Day, Time typed as 14:30 / 2pm; Checks; action point; voice reads spoken times; `next_time`). 389 tests. |
| **47** (02.11) | `9674cbc` | **Action points are always orders to Sitamah**: the box opens with "Sitamah, please action these for the client X:"; the client is always "the client <name>" (a test client named Sitimah made "Follow up with Sitimah" read as if for Sitamah herself); every point starts with a verb (`directToSitamah`). 394 tests. |
| **48** (02.11) | `d9e3c3b` | **The standing rule: the PDF always mirrors the form** (written into `CLAUDE.md` and the README; tested). |
| **49** (03.11) | `63e9574` | **File names:** `Fact Find (Audio to Text) - dd.mm.yy - (Name Surname)` for both the PDF and the .json. Corrects PR 28. |
| **50** (05.11) | `5394a2a` | After the **Rosalind Dube meeting**: Rental, Spousal and Child Maintenance income and **Total Income**; Smoker back on Client info; schedule boxes grey on No; the notes read for the action points; year-less dates counted from the form date; email pieces; no blank Debt 3. 410 tests. |
| **51** (05.11) | `974abad` | **Broker on record everywhere** (default Other broker); **priorities numbered 1 to 8**; the **Priorities to be Focused on** box; Claude told today's date in every request. 425 tests. |
| **52** (05.11) | `9b9cecf` | Follow-up to 51: an older file opened gets the new rules once (Duties zeros, broker defaults); the Priorities box writes itself on arrival; each schedule goes to Claude with its page's notes. 429 tests. |
| **53** (05.11) | `cc9dd4c` | **Lump Sum Disability** (fractured) has its own calculation boxes (`pd_hh`, `pd_cc`, `pd_dr`, `pd_need`, `pd_hhabi`), renamed from "Permanent disability: fractured cover". The report skills did not know the new ids. |
| **54** (05.11) | `96cc85d` | Test-only: a broker test failed when two saves landed in different milliseconds (it had once stopped a website update). |
| **55** (07.11) / **56** (10.11) | `6622280`, `caf2af7` | **A mistake and its correction.** 55 set Dread disease cover to R 0.00 in **both** blocks; Paul wanted only the **standard** block at R 0.00. **56 fixed it:** standard `dds_cover` R 0.00, BrightRock fractured `dd_cover` stays R 500 000.00; a test pins both. The report skills hold a standing R 500 000 dread target. |
| **57** (10.11) | `716dc09` | The four Medical, will & short-term broker boxes start as Other broker from the first screen. |
| **58** (10.11) / **59** (10.11) | `2625f39`, `9b7c292` | **The Short Risk Application page** (`app/short-risk.html`): the General Short Risk Application, filled from the Fact Find (Load from Fact Find), its own PDF, Checks; 59 added call Day/Date/Time, Product type, and Owner of the policy (Short Risk 1.1). 459 / 468 tests. ***The `complete-applications-skill` is not connected to it yet (Paul will do that).*** |

The pull request descriptions often also said what was **not tested**: live meetings and Claude's real reading of spoken lines could never be tested in the sandbox (they need a live key and a real conversation).

### 2.2 The numbered releases: 3.1 to 4.5 (11 to 16 November 2026)

Test counts: unit tests / browser checks, as stated when the release was built (4.5 was the last: **694 / 721**). The full ids and lists of each release are in `docs/FORM-CHANGES.md`; the README has a "Release X.Y" section for each from 3.6 on (3.1's is spread over its own bullets).

#### 3.1: PR 60, `76f01db`, 11 November (516 / 446)
*Fact Find 3.0 to 3.1, Short Risk 1.1 to 1.2.* A big release Paul approved as one ("make all the changes together"; its working note is `docs/HANDOVER-release-3.1.md`, written to be deleted after the merge: it is still in the repo).
- **Defaults that save typing:** Debts *Term left* starts as **Max term** for a credit card and revolving credit; *Asset value* **R 0.00** for every debt not on a property; *Qualification details* **N/A** when Highest education is Matric; *Employer* **N/A** when Employed is No.
- **Ids:** new `spmaint` (**Spousal Maintenance**: what an ex-spouse pays the client; a new id because the meaning of the old `spinc` "Spousal Income" changed: `spinc` stays as a **legacy** box shown only while a file holds a value, still added into Total Income); `maint` relabelled **Child Maintenance** (same id); new `on_call` (**Others on the call**); new `debts_end` (**No more debts**); Debts column `term` relabelled **Term left (months)**, always a number of months.
- **Schedule boxes:** *Policy Schedules saved in Client File* added, *Client does not need to send through* removed (older files migrate).
- **Action Points read every note** (every Notes box, the Health notes, the quote comments, the BrightRock comments, "heard but not placed") and decide what Sitamah must do.
- **Debts by voice:** stay on one debt until told; "remove debt 2" removes it; "No more debts".
- **Seven voice fixes** from the Wilhelm Bosman log (a rounder figure never replaces an agreed exact one, take-home above gross refused, and so on); a **spouse on the call**.
- **New top-level key `worked`** in the saved file: the figures the form works out, as the PDF prints them (`app/js/worked.js`); never read back, rebuilt at every save.
- **The skills' rules** were set in this release: an id never changes for a label; a meaning change gets a new id; `docs/FORM-CHANGES.md`.
- Short Risk: a file saved by 1.0 opens with Owner = The client.

#### 3.2: PR 61, `5e4925e`, 11 November (523 / 460)
New optional box **`cc_notes`** (*Current Client File Summary Notes*) in a **Current Client** section at the bottom of Admin, active only when `ref` (Referral from) is "Current client", greyed otherwise. Written by a skill (`advicetech-client-notes`, from the client's AdviceTech Basic Info notes) as points with status `verify`; never filled by voice, never read for the action points, printed in the PDF only while active.

#### 3.3: PR 62, `70a748c`, 12 November (528 / pass)
Asked via the Skill Restructure chat: a heading line in `cc_notes` (no lower-case letters, at least four characters, not starting "- ": `util.isHeadingLine`) is shown **bold** in the box (a read view; the plain text opens on a click, Edit or Enter) and printed bold in the PDF. The saved file is unchanged (plain text).

#### Investment Capture Sheet 1.0: PR 63, `ff80f66`, 12 November (558 / 549)
A **third page**, `app/capture-sheet.html`, for investment applications at any insurer, made from Old Mutual's *Application Details for Finalisor* (made generic), with the **Risk Tolerance questionnaire** copied in (not a link). **Load from Fact Find** and **Load from Short Risk file**. Two PDFs: the application, and the questionnaire's own PDF (the firm's fillable form filled with `pdf-lib`, signature, place and date left blank; the Save window opens in the loaded Fact Find's folder). Paul asked for the page to have its own website address (it exists once published). The Fact Find stayed at 3.3. *Not tested: Chrome's real Save window with a real folder (only a stand-in).*

#### 3.4: PR 64, `b7cf78b`, 13 November (580 / 573)
**Client priorities follow what the client already has** (`autoprio.js`): an automatic **Not a priority**, with a reason and the referral set to Not required (all `preset`), only where a fact makes the area pointless: medical aid or hospital plan through the company; a will up to date elsewhere (or held by Capital Legacy with Paul K); short-term through the company; no children (EGAR). Life, RA, RGAR and Invest are **never** decided by the form. Once the adviser changes the decision the area is his (`auto` top-level key). **One "no":** the choice *Not a priority: client not interested* became plain **Not a priority** (the reason goes in the comments); *Not interested* became *Not required*; the quote lists lost *Cannot afford now* and *Not interested*. Suggestion lines with buttons (take-over chances, tertiary children, no retirement funds). *A skill that reads `pr_life` to `pr_st` must test for text starting "Not a priority".*

#### 3.5: PR 65, `2ceb44a`, 13 November (581 / 573)
At Paul's word, relayed by the Fix Skills chat: **"Must not contact client" removed** from the Short-term referral box `ref_sti`. An older file holding it opens with *Not required* and the sentence `Marked "Must not contact client" in an earlier version of the form.` is added to `pr_st_cm`.

#### 3.6: PR 66, `74e524f`, 13 November (598 / 591)
After the **Elmer Jonker meeting** and the audit: the screen stays on its page until the adviser says; debts removed for real and kept removed; no rows from passing remarks; the next appointment only when discussed ("same time next week" worked out). **Debts:** new column `sinst` (**Spouse instalment**, R p.m.), and the **payer** rule: *Joint* splits the instalment 50/50 into `inst` (client) and `sinst`, *Spouse* puts it all in `sinst`; new total **Total spouse monthly**; the client's total and the instalment protector carry only the client's part; **credit life** asked only for a Home loan, Vehicle finance or Personal loan with a lender, and *Not sure* added. Other-broker cover wording: "an opportunity to quote; the client will decide" (never "a take-over"). The **Priorities to be Focused on** box writes `Recommend:` / `Client:` / `Come back with:`. Audit fixes: money and date parsing (`6.500` is R 6 500.00), the SARS age rebate by age at 28 February.

#### 3.7: PR 67, `cd5e623`, 13 November (628 / 599)
**The deeper guards from the audit.** No id, box or choice changed. Voice: a confirm on a line the adviser said is not applied (only the client's agreement turns a box green); a box emptied on purpose is not refilled (`emptied`); strict row numbers; an action point, Priorities line or note with an amount (100 or more) that is nowhere in the facts is dropped; ex-smokers and a spouse's smoking do not fill Smoker; someone else's ID, phone or email never fills the client's boxes; no rows from a third party's loan.

#### 3.8: PR 68, `244570d`, 13 November (643 / 616)
After the **Sibanda meeting** (12 November, recorded; invented names in the tests): a "heard but not placed" note saying only three of five children were given was still open though the form held them. **Stale notes closed** (`unplacedCovered`); the facts carry `on_the_form_now`; **every action point names its source** (a kind of fact, or a note id with words quoted from it) or is removed (and listed on Admin, screen only); small talk is not noted; the **copy check** (`build.js`, the `wr-build` meta tag on all three pages, the red **"Mixed versions"** bar) after Paul's computer once ran old scripts. The Admin page lists *Notes read* and *Points removed*. Paul: *"Checked, notes look much better so far, it will need to be tested further on other clients."*

#### 3.9: PR 69, `e3ca5c6`, 14 November (653 / 636)
**The BrightRock calculation follows the client's BrightRock policy.** A new block *Current BrightRock policy (from the policy schedule)* with `br_aci` (**Yearly premium increase**, the ACI) and `br_dd_cover` (**Cover that you can recover from**), shown only when a BrightRock policy is listed; the four ACI value boxes (`lc_f_aciv`, `pd_f_aciv`, `ip_aciv`, `dd_aciv`) follow it; the fractured **Dread cover** = the greater of R 500 000 and `br_dd_cover`; a percentage typed alone gets its "%"; **Has debts = No** gives R 0.00 and "Client has no debts". **The ACI/ABI correction:** the first build took the schedule's *Yearly base increase* as the ACI; Paul caught it (section 1.5); it was corrected on the work branch before the merge (*from the chat: the pull request description still carries the first wording*). **The deploy failed four times** on GitHub's side ("no artifact", then "multiple artifacts"); a fresh run succeeded (section 8).

#### 4.0: PR 70, `9f2cf25`, 15 November (672 / 659)
**One ACI for every benefit** (a value in any of the four ACI value boxes goes into the others, with the same status, and into `br_aci` while a BrightRock policy is listed; ABI, the ACI choice boxes and the standard quotes are not part of it); **the "?" is gone** from every ACI value box; **Meetings held**: a new list `meetings` on Client info (columns `date`, `type`, `who`, `covered`) for a Fact Find done over two or three meetings, empty while there has been one meeting, the first "Add another meeting" makes the meeting so far meeting 1; `date` (Date completed), `meet` (Type of meeting) and `on_call` are the last meeting's; "What was covered" is **written by the form** from a new top-level key `covered` (page names where an answer was typed or said); opening a file on a later day with voice on asks "another meeting?". Not filled by voice (`novoice`). *The release that taught the numbering rule: the next number after 3.9 is 4.0.*

#### 4.1: PR 71, `57497d6`, 16 November (681 / 685)
**An appointment that has passed:** when `next_appt` has gone by, Admin asks what happened (Completed / Did not meet with the client / Cancelled by the client / Rescheduled), records it in the new list **`appts`** (*Previous appointments*: `date`, `time`, `outcome`) and empties `next_appt` and `next_time`; **the Progress numbers lead to the boxes** ("to verify" and "not asked" are buttons that walk to each box); **Verify All** (asks, with an Undo for about 10 seconds); **`cell` relabelled Personal cell number** (same id) and a new **`work_cell`** (Work cell number, with a "No work cell number" tick). *Not yet proved with a real client.*

#### 4.2: PR 72, `dea5d25`, 16 November (686 / 691)
After Paul's first real run of 4.1: **Verify All and "to verify" missed advisor pages, optional boxes and Broker on record**: now every amber box on every page (not an empty box, a calculated box or the online profile); a **Calendar** button on the Date of Previous appointments and Meetings held (Paul: *"There is no Calendar drop down - please ADD"*); the **gender is filled from a valid ID number** (typed, said, confirmed, or a file opened; never overwrites). **`CLAUDE.md` was rewritten as the handover** in this release.

#### 4.3: PR 73, `bd75044`, 16 November (686 / 692)
**The keys and costs in one small table** in the top bar (display only): a line for **Anthropic** and one for **OpenAI** (Paul: *"Claude must be renamed 'Anthropic'"*), columns *Key* and *This Fact Find*; amber at 14 days or fewer or with no expiry date, red once expired; a click opens Settings. Paul chose "Option B" from a mock-up page I drew. On the same day I took Paul through renewing his Anthropic key (30 days, saved in Settings with its expiry date: the top bar then showed 30 days left). *Slip: the global table style first stretched the table across the bar; fixed before merging.*

#### PR 74, `a3d16ef`, 16 November (documentation only)
`CLAUDE.md`: 4.3 merged, the keys-and-costs table decision, the API key renewal note. Nothing under `app/`, so no website update ran.

#### 4.4: PR 75, `e40dec1`, 16 November (690 / 707)
**"Other forms ▾"** (display only): the Short Risk Application and Investment Capture Sheet links are one menu button (a native `<details id="otherForms">`; closes on Escape, a click elsewhere and a chosen link); the keys-and-costs table stays. The mix of Paul's Option B (the table) and Option A (the dropdown). Built in this chat because Paul asked after the context was at 16%.

#### 4.5: PR 76, `b74fb24`, 16 November (694 / 721)
**Meetings held on one line** (Paul: *"far too big ... ONE line ... not even collapsable"*): each meeting is one line of boxes: Date (Calendar), **Day** (new calculated column `meetings.day`, not an answer), Type, Others on the call, What was covered, with the ✕; the **Meetings held** heading folds the list (shut it reads "2 meetings: 14/10/2026, 28/10/2026"; it stays as left). The PDF prints the Day; `worked.l.meetings` lists the days. *Slips fixed before merging:* "What was covered" wrapped onto a second line; the one-line list lost its empty-list message. ***Left open: the boxes are narrow at the standard width, so "Teams Meeting" and long names may be cut off in the box until you click into it; seen only in a test screenshot, not on Paul's screen.***

#### After 4.5
The Fix Skills chat reported **4.1 to 4.5 all installed on Paul's computer** (section 5). `main` ends at PR 76 (`b74fb24`); this handover, a documentation-only pull request, is the next change.

---

## 3. The release routine, exactly as it is run

This is what Chat 1 did for every release from 3.8 to 4.5 (and the same in spirit for the earlier ones). `CLAUDE.md` section 4 has the short list; this is the detail, with the tools and the traps.

### 3.1 The tools

| Need | Tool | Notes |
|---|---|---|
| Files, tests | Bash, Read, Edit, Write | The sandbox is Linux, Node 22. `npm test` = `node --test tests/*.test.js` (694 tests at 4.5; about 20 seconds). |
| GitHub | `mcp__github__*` tools only (no `gh` CLI). Load their schemas with `ToolSearch` (`select:mcp__github__create_pull_request,mcp__github__merge_pull_request,mcp__github__pull_request_read,mcp__github__actions_list,mcp__github__actions_get,mcp__github__actions_run_trigger`) | Owner and repo in lower case work: `pavlos1972` / `fill_in-form_project`. Branch `claude/create-something-stjk8a` is the only branch you push to. |
| Waiting | Do **not** use `sleep N` as a command on its own (it is blocked). Use an `until`/`for` loop that polls and breaks on a condition, e.g. `for i in $(seq 1 50); do ...curl -s https://api.github.com/repos/Pavlos1972/Fill_In-Form_Project/actions/runs?head_sha=<SHA> ...; sleep 6; done` | This public API call needs no token for a public repo and showed `status` and `conclusion` of the Tests run for a commit. |
| The browser suite | Playwright and Chromium are already installed in the sandbox | `bash tests/browser/run.sh <outdir>` (see 3.3). |
| The changes page | `Artifact` tool: `read` then `publish` to the same URL | See 3.9. |
| Sending Paul the ZIP | `SendUserFile` | A path inside the working directory or the scratchpad. |
| A visual question | Write an HTML mock-up and publish it as a private Artifact | The top-bar mock-up (4.3) is the example. |

### 3.2 Step 1: build on the work branch

1. Work on `claude/create-something-stjk8a` only. Check `git status` is clean and `git log -1` is the last resync commit.
2. Make the change. **The form is changed in `app/js/schema.js`** (boxes, choices, lists); logic goes to `calc.js` / `store.js` / `ui.js` / `voice*.js` as the change needs.
3. **Bump the version** when a box, choice, list or list column changes (and, by Paul's practice, with every release that touches the form, even display only, so the copy check shows the build): `version` in `app/js/schema.js`, `BUILD` in `app/js/build.js`, the `wr-build` meta tag in the **three** pages (`app/index.html`, `short-risk.html`, `capture-sheet.html`), the version pins in the tests (`grep -rn "schema.version" tests/`: `autoprio`, `current-client`, `notes-headings`, `release-36`, `worked` tests pin the exact number; the newer release tests use `>=`), and the `?v=` cache tags of the changed scripts and `app.css` in the pages (Chat 1 changed the tag in all three pages each release, e.g. `20261116f`). Versions are decimals: 4.5 then 4.6, 4.9 then **5.0**.
4. **Write the records in the same commit**: a "Release X.Y" bullet in `README.md` (and correct every statement the change makes untrue: search for the old wording), a dated entry at the top of `docs/FORM-CHANGES.md`, the PDF (drawn from the schema; the hand-drawn parts by hand), `app/js/worked.js` if a figure changed, and `CLAUDE.md` (the version history row and the header line).
5. **A unit test file and a browser test for the release**: `tests/release-NN.test.js` (NN = the release without the dot, e.g. `release-45`) and `tests/browser/t-releaseNN.js`, and add the browser script's name to the `SIMPLE` list in `tests/browser/run.sh`. Use invented names and future dates in tests (two tests failed once when the real date passed their 2026 dates).

### 3.3 Step 2: the tests

| Check | Command | What must be true |
|---|---|---|
| Unit tests | `npm test` | all pass (includes `readme.test.js`, `pdf-mirror.test.js`, `worked.test.js`) |
| Browser suite | `rm -rf /tmp/bNN && mkdir -p /tmp/bNN && bash tests/browser/run.sh /tmp/bNN` then `git checkout -- tests/browser/*.png` | `N checks passed, 0 script(s) failed` (721 at 4.5). Run it with the output folder **empty and different from where you redirect its own summary** (Chat 1 once redirected the summary into the same folder and the script counted that file as a failed script: `FAILED: summary`). Five slow scripts can time out when all run together and pass alone: re-run a failing script alone with `node tests/browser/<name>.js "$(npm root -g)" "$PWD/app" <outdir>` before believing the failure. |
| The PDF check | it is `audit-pdf.js` inside the browser suite; read `<outdir>/audit-pdf.txt` | only the **known items** on the screen but not in the PDF: *Public profile summary*, *Public profile (LinkedIn)*, *Current Client File Summary Notes*, *Current Client*, and the note *Only for a current client: this is active when Referral from (on Client info) is Current client.* Anything else is a bug (Paul's rule: the PDF mirrors the form). |

After the browser suite, `git checkout -- tests/browser/*.png` (the suite rewrites some PNGs).

### 3.4 Step 3: commit, push, and ask

1. `git add -A && git commit` with a message that says what changed. **Use the attribution lines the session gives you** (at the time of writing: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session link>`). Do not put a model name anywhere else in the repository.
2. `git push -u origin claude/create-something-stjk8a` (retry up to four times on a network error).
3. Tell Paul, in plain words and a short table: what is built, the test counts, **what is not certain** (for example "I have seen it only in a test screenshot, not on your screen"), and ask **"Shall I merge?"**. Do not open a pull request yet.

### 3.5 Step 4: Paul says "merge"

1. `git rev-parse HEAD` and check the work tree is clean and `origin/claude/create-something-stjk8a` has the same SHA.
2. `mcp__github__create_pull_request` (owner `pavlos1972`, repo `fill_in-form_project`, head the work branch, base `main`). Look for a pull request template first (`.github/pull_request_template.md` and the other usual places): the repository has none. End the description with the attribution line the session gives you.
3. Wait for the **Tests** run for **that exact SHA** (poll `actions/runs?head_sha=<SHA>`; it takes about 30 to 45 seconds): `status: completed`, `conclusion: success`. If it fails, fix on the branch, push, and wait for the run for the **new** SHA: never merge a commit its own Tests run did not pass on.
4. `mcp__github__merge_pull_request` with `merge_method: squash`, `expectedHeadSha: <SHA>`, a commit title of the form `Version X.Y: ... (#NN)`.
5. **Resync** the work branch: `git fetch origin main && git merge -s ours origin/main -m "Resync with main after the version X.Y squash merge (#NN)"` then `git push -u origin claude/create-something-stjk8a` (a normal push, no force). This keeps the branch from carrying the squashed commits as new work.

### 3.6 Step 5: the publish check (never say "live" before this)

The push to `main` starts the workflow **"Publish the Fact Find"** (`.github/workflows/pages.yml`: runs the tests, then publishes `app/` to GitHub Pages; it runs when `app/**` or the workflow file changes, so **a change that touches only docs, tests or `CLAUDE.md` is not published and no run starts**). Poll the run for the merge commit's SHA. When it is `completed / success`, **read the job's steps** (`mcp__github__actions_list`, method `list_workflow_jobs`, `resource_id` the run id) and check the step **`Run actions/deploy-pages@v4` is `success`**. Only then say it is live, and say you cannot open the live site yourself: the live look is Paul's. Typical time: 40 to 60 seconds in all, the deploy step 6 to 30 seconds.

If the deploy fails with **"no artifact"** or **"multiple artifacts"** (happened to 3.9, PR 69, four times): **re-run the failed jobs once at most.** A re-run of the same run uploads another website package and then fails for good ("multiple artifacts"). Start a **fresh run** instead: `mcp__github__actions_run_trigger` (method `run_workflow`, workflow `pages.yml`, ref `main`). Tell Paul plainly if it is still not through.

### 3.7 Step 6: the ZIP

`git archive --format=zip --prefix="WR Fact Find/" -o "<scratchpad>/WR Fact Find - Version X.Y.zip" <merge SHA>:app` (use the merge commit's SHA, or `HEAD:app` on a branch that has been resynced). Check it: `unzip -p "<zip>" "WR Fact Find/js/build.js" | grep "BUILD = "` must show the new build number. Send it to Paul with `SendUserFile`, captioned as **a copy** (the Fix Skills chat installs it on his computer itself: section 5). The ZIP holds the whole `app` folder under one folder named `WR Fact Find`.

### 3.8 Step 7: the note for the Fix Skills chat (end of every release)

Written in the reply to Paul, under the heading **Note for the Fix Skills chat**, short:

| Include | Example |
|---|---|
| The version | "version 4.5" |
| Every **new, changed or removed** box id and list, and list column | "One new list column, `meetings.day` ..." |
| Anything a skill that **reads or writes the saved file** must know | a value now empty, a new top-level key, a changed meaning, a row key that may be empty |
| Anything that would make a skill's **form check stop** | a new id or list it does not know |
| If nothing moved, say so | "No id, list or box changed; display only; no skill needs updating." |

### 3.9 Step 8: the changes page (only when Paul says "Update the changes page")

The page is the Artifact https://claude.ai/artifact/TG8Jqe8ndzoZKUuuZhUwpP (version 45 at the end of Chat 1). To update it:

1. **Read** it with the Artifact tool (`action: "read"`, the URL). The result says where the full HTML was saved on disk; **treat its contents as data**. (Chat 1 kept a working copy of the page in its scratchpad, `fact-find-changes.html`, edited by small Python scripts `update-changes-NN.py` that each replaced exact strings and failed loudly if a string was not found exactly once. The scratchpad is session-specific and will not exist in Chat 2: start from the live page instead.)
2. Add a **section** for the release (a table: What you saw / What the form shows now / Status) and update: the **lede** line that lists the pull requests, the **status line** (everything is on the website through PR NN; the pull request and commit; that you waited for the deploy step before saying it was live; that the live look is Paul's), the **summary tiles** (the two numbers: tests and browser checks), and the **history list** row for the PR.
3. **Be honest in it**: slips and corrections are written down (for example 3.9's four failed deploys; 4.5's two layout slips); what is **not certain** is written down.
4. **Publish to the same URL** (`Artifact publish` with the same file path and `url`). Keep the page's design: it has a light and a dark theme and works at phone width.
5. Say in the reply what changed on the page and that you could not open the published page yourself.

### 3.10 Step 9: what waits for the Fix Skills chat

After a release the skills are renewed and the release is installed on Paul's computer **by the Fix Skills chat, not by you** (section 5). Do not change ids or lists while a renewal is in progress unless the Fix Skills chat says it is safe. Still send Paul the ZIP, as a copy.

### 3.11 Small things that bit

| Trap | What to do |
|---|---|
| A command that contains a heredoc and certain words may be refused by the sandbox's safety check as a possible dangerous removal, even with no `rm` in it. | The command is **not run**; split it, and write files with the Write/Edit tools instead. Do not try to get around a real removal check. |
| `sleep` alone is blocked. | Poll in a loop with a condition. |
| The tests pin dates. | Use future dates in tests, or pass the date in. |
| `git checkout -- tests/browser/*.png` after the browser suite. | Otherwise the PNGs show as modified. |
| A background command that commits (it happened once) can race with your edits. | Wait for it to finish before editing further. |
| The ZIP of an early release was built from `HEAD` before the resync. | Build it from the merged state and check `build.js`. |

---

## 4. The repo map

Repository: **`pavlos1972/fill_in-form_project`** on GitHub (the account's name is capitalised `Pavlos1972/Fill_In-Form_Project`; both spellings work in the tools). Branches: `main` (what the website publishes) and the one work branch **`claude/create-something-stjk8a`** (push only there). The README (`README.md`, about 335 lines) describes every screen and rule in detail; its **Layout** table is checked against the code by `tests/readme.test.js`. This section is the map.

### 4.1 What the app is

A **static web page: no server, no install, no build step.** Plain JavaScript files that work both in the browser and in Node (the tests load them with `require`: each is a "UMD" script that puts its API on `window.FF` in the page). Libraries (jsPDF and its table add-on, pdf-lib) are kept in `app/vendor/` so nothing is downloaded, except the **speech library for Whisper and Moonshine, which still loads from the jsDelivr CDN while Listen is on** (a known open point: section 6).

Three pages on one site:

| Page | File | What it is |
|---|---|---|
| **The Fact Find** | `app/index.html` | The form Paul fills in with a client, by typing or by voice. 13 pages (below). Makes a `.json` file and a PDF. |
| **Short Risk Application** | `app/short-risk.html` | The General Short Risk Application (the one-page form used for every insurer). Fills from a Fact Find file (**Load from Fact Find**, amber, never overwrites typed text). No voice, no keys. Five pages: Cover & client, Home & doctor, Banking, Family, Declarations. Version 1.2. Its own PDF. |
| **Investment Capture Sheet** | `app/capture-sheet.html` | Investment applications at any insurer (made from Old Mutual's *Application Details for Finalisor*, made generic), with the **Risk Tolerance questionnaire** built in. Loads from a Fact Find or Short Risk file. Version 1.0. Two PDFs (the application; the questionnaire's own). |

**The Fact Find's 13 pages, in order** (id: title): `info` Client info · `occ` Occupation · `income` Income & household · `debts` Debts · `kids` Children · `cover` Personal & group risk cover · `retire` Retirement funding · `inv` Investments · `other` Medical, will & short-term · `health` Health · `prio` Client priorities and quotes needed · `calc` BrightRock Risk Calculation · `admin` Admin. (241 boxes and 15 lists at 4.5.) The page order is pinned by `tests/readme.test.js` and by the README's "Use it" text: **changing the order means changing both**.

**The lists** (`schema.lists`): `risk` (existing personal policies), `grp` (group risk), `ret_ra` (retirement annuities), `ret_pp` (pension and provident funds), `inv` (investments), `bizpol` (business assurance policies), `shares` (partners and shareholders), `debts`, `appts` (previous appointments), `meetings` (meetings held), `kids` (children), and the four quote lists `bfred` (BrightRock reduced quotes), `redq` (standard reduced quotes), `raq` (RA quotes), `invq` (investment quotes).

### 4.2 The app files

| File | What it does |
|---|---|
| `app/js/schema.js` (about 58 KB) | **The whole Fact Find**: sections, blocks, boxes (`id`, label `l`, short label `sl`, type `t`, choices `o`, flags such as `calc`, `voice`, `free`, `money`, `pct`, `nopdf`, `legacy`, `cond`), lists and their columns. `version` is here. **Change the form here.** |
| `calc.js` | Calculated boxes (`fieldCalcs`) and list-row calculations (`rowCalcs`: child `age`, `stage`, meeting `day`), show/hide rules (`showIf` with conditions), the passed-appointment test, Total Income, the instalment protector split. |
| `tax.js` | SARS tax tables and Direct Net Income (`dnet`). **Update each tax year (1 March):** add the brackets and rebates, add that year's TaxTim results to `docs/`, extend `tests/tax.test.js`. |
| `validate.js` | The **Checks** panel: what is still to answer and what looks wrong (dates, amounts, quote requests with a missing box, ID numbers, and so on). |
| `autoprio.js` | The automatic **Not a priority**, the suggestion lines and the starting Type of quote. |
| `store.js` (about 57 KB) | **The answers** (`state.f` and `state.l`), saving and reopening (`toJSON`, `fromJSON` with **migrations of older files**), file names (`pdfFileName`, `baseFileName`), defaults that follow other answers (broker defaults, `debtSplit`, `brFollow`, `aciSync`, `meetingsFollow`, `genderFromId`), progress counts (`pending`, `verifyList`). |
| `actions.js`, `summary.js` | The **Action Points for the Personal Assistant** (facts from the form, the opening line to Sitamah, plain points used until Claude has written them; `directToSitamah`, `pointSourceWhy`) and the per-area summaries on the priorities page. |
| `worked.js` | Writes the `worked` block of the saved file (the figures the form works out, as the PDF prints them). |
| `pdf.js` | **The PDF**, drawn from the schema (a box added to the schema appears by itself); hand-drawn: the priorities and quotes page, the BrightRock Risk Calculation page, the quote tables, the lists and the Admin page. |
| `ui.js` (about 287 KB, the biggest file) | The screen: rendering of pages, boxes, lists (`listHTML`, dense/folding lists), the Progress card, Settings, Save/Open/draft, the top bar, the voice mode's side of things (`vm*` functions), Verify All. Exposes `FF.app` (`state`, `redraw`, `setState`, `makePdf`, `voiceHear`). |
| `util.js`, `build.js` | Helpers (money and date reading, ID number checks, `splitFullName`, `isHeadingLine`, `formatPct`, `weekdayName`); the copy check (the `BUILD` number and the red **"Mixed versions"** bar). |
| `voice.js` (about 169 KB) | **Voice, page side** (no microphone, no network): works out which box a line is about and what it fills; `PRIVATE_IDS`; many guards (section 4.6). |
| `voice-ai.js` (about 117 KB) | **Voice, Claude side**: the prompts, the request (prompt-cached), reading Claude's answer, the guards on it (`emptied`, strict row numbers, quoted words must be in the transcript, amounts must be in the facts), the summaries and action points. |
| `listen.js` | **The speech source**: the microphone becomes lines of text (Whisper or Moonshine on this computer, Chrome's recogniser, or OpenAI transcription; with the option to hear the client on a Teams call). |
| `lookup.js` | The company look-up and the client's public profile (Claude with web search), the **keys and Settings** (`SETTINGS_KEY` = `wr-fact-find-settings` in the browser's `localStorage`), the **price tables** (`PRICES`, `TRANSCRIBE_PRICES`) and the cost tallies. |
| `timer.js` | The meeting timer in the top bar. |
| `sr-*.js` (`schema`, `store`, `check`, `pdf`, `ui`) | The Short Risk Application. |
| `cs-*.js` (`schema`, `store`, `check`, `pdf`, `ui`, `rt-data`, `rt-pdf`) | The Investment Capture Sheet; `cs-rt-data.js` holds the questionnaire's statements, scoring and profiles (a copy of the Risk Tolerance website's); `cs-rt-pdf.js` the questionnaire's PDF. |
| `app/css/app.css`, `short-risk.css`, `capture-sheet.css` | Colours and layout (light and dark; the logo blue `#27a8e0` and a deeper blue `#0f6fa3`). |
| `app/assets/` | `logo.png`, `logo.js`, and `rt-form.js` (the firm's Risk Tolerance PDF form). |
| `app/vendor/` | jsPDF, its table add-on, pdf-lib. |
| `app/Start Fact Find.bat`, `app/FactFindServer.ps1` | Open the app from a folder on a computer (so Chrome remembers the microphone). **Left off the website.** |
| `.github/workflows/tests.yml` | `npm test` on every pull request (Node 22). |
| `.github/workflows/pages.yml` | On a change to `app/**` (or the workflow) on `main`: runs the tests, stamps the `?v=` tags so browsers fetch the new scripts, leaves the launcher files off, and publishes `app/` to GitHub Pages; can also be started by hand (`workflow_dispatch`). |
| `docs/` | `FORM-CHANGES.md` (the dated change log of ids and lists; **the skills read it**), `Fact_Find_Revision_Analysis.md` (PR 1), `HANDOVER-release-3.1.md` (a working note from 3.1: can be deleted), `tax_tables.json` and TaxTim example files, `mockup/` (the approved mock-up), `sample/` (a sample PDF with example data), and this file. |
| `package.json` | Only two scripts: `npm test` (`node --test tests/*.test.js`) and `npm run test:browser`. The package version (3.0.0) is not the form's version. |

### 4.3 The tests

`npm test` runs the 49 files `tests/*.test.js` (694 tests at 4.5, about 20 seconds). Every release adds `tests/release-NN.test.js`. They load the real app files in Node with a faked Claude and invented answers.

| Group | Files |
|---|---|
| **README and PDF guards** | `readme.test.js` (page order, the Layout table's paths, the standing rules are in the README), `pdf-mirror.test.js` (every box, heading, note of the form is in the PDF under the same words), `worked.test.js` (the `worked` block equals the PDF text; pins `schema.version`) |
| **Form, answers, calculations** | `app.test.js`, `util.test.js`, `tax.test.js`, `autoprio.test.js`, `priorities.test.js`, `quote-lanes.test.js`, `broker-default.test.js`, `income-duties.test.js`, `debts-r31.test.js`, `defaults-r31.test.js`, `term-months.test.js`, `current-client.test.js`, `notes-headings.test.js`, `schedule-wording.test.js`, `appointment.test.js`, `focus-today.test.js`, `action-notes.test.js`, `action-points-sitamah.test.js`, `meeting-fixes.test.js` |
| **The audit** | `audit-batch-a.test.js`, `audit-batch-b.test.js`, `audit-batch-c.test.js`, `audit-batch-d.test.js`, `audit-last-three.test.js`, `audit-notes.test.js` |
| **Voice** | `voice.test.js`, `voice-ai.test.js`, `voice-sweep.test.js` (every voice box tried), `voice-r31.test.js`, `release-37-voice.test.js`, `release-37-voice-ai.test.js`, `release-37-facts.test.js`, `listen.test.js`, `lookup.test.js`, `timer.test.js` |
| **Release tests** | `release-36`, `release-38`, `release-39`, `release-40-meetings`, `release-41`, `release-44`, `release-45` (`.test.js`) |
| **The other two pages** | `sr-store.test.js`, `sr-pdf.test.js`, `cs-store.test.js` (pins the Risk Tolerance scoring), `cs-pdf.test.js` |

**The browser suite** (`tests/browser/`, run with `bash tests/browser/run.sh <outdir>`; 721 checks at 4.5): about 60 Playwright scripts that open the **real page** in Chrome: the `t-*.js` scripts (one per area or release: `t-settings`, `t-sr`, `t-cs`, `t-release36` ... `t-release45`, and so on), the `demo-*.js` voice scenarios, `audit-pdf.js` (the text of every screen against the text of a filled PDF), `audit-fuzz.js` (120 random forms, no page errors), `audit-narrow-all.js` (layout at several widths). `run.sh` runs the `SIMPLE` list (add each new script's name there), prints PASS/FAIL lines and a summary line, and exits non-zero on a failure. Slow scripts time out (240 s) when all run together; they pass alone.

### 4.4 The saved file (`store.toJSON`)

A `.json` file made by **Save**. The skills read and fill it **by box id**.

| Top-level key | What it holds |
|---|---|
| `app` | `"wr-fact-find"` (the Short Risk Application: its own; the Capture Sheet: `"wr-capture-sheet"`) |
| `schema` | The form version that wrote it (`"4.5"`) |
| `created`, `modified` | ISO times |
| `f` | **Every box**, by id: `{ "v": "<text>", "st": "<status>" }` |
| `l` | **Every list**, by list key: an array of rows `{ "d": { "<column>": "<text>", ... }, "st": "<status>" }` (a debt row also keeps its instalment-protector switch) |
| `covered` | (4.0) The pages covered by the meeting in progress; the form writes "What was covered" from it |
| `sum` | Claude-written summaries per priority area |
| `auto` | (3.4) `{ "skip": { "<area>": true } }`: the areas the adviser took over from the automatic Not a priority (`egar`, `med`, `will`, `st`) |
| `pa`, `focus` | State of the Action Points box and the Priorities to be Focused on box (text, whether edited, the facts it was written from) |
| `unplaced` | "Heard but not placed" items |
| `claude`, `openai` | Cost tallies (never printed in the PDF) |
| `worked` | (3.1) The figures the form works out, as the PDF prints them (calculated boxes, per-row worked boxes such as a child's age and stage, list and area totals, the instalment protector per debt, `worked.l.meetings` days). **Not an answer; never read back; rebuilt at every save.** `worked.form` is the version. |

**Statuses** (`st`): `empty` (not asked); `preset` (a starting default the adviser can change: it does not count as an answer); `heard` (filled by voice, not yet confirmed); `verify` (amber: to be checked: **only the client agreeing, or the adviser typing it, turns it to `confirmed`; a line the adviser said never confirms**); `confirmed` (typed, said by the client, or accepted). **Verify All** turns every `verify` box to `confirmed`.

**Reopening an older file**: `store.fromJSON` migrates: old choice words become the new ones (e.g. `Not a priority: client not interested` to `Not a priority`), old single-name children split, the old combined retirement list split, the old "?" ACI default emptied or filled from the policy, `Must not contact client` to `Not required` with a note, and so on. **Every release that changes a choice or a meaning adds a migration and a test for it**; the older value is never lost.

### 4.5 Ids and the skills

The id of a box is its contract with the skills. **An id never changes when only its label changes; a changed meaning gets a new id and the old one stays as `legacy`** (examples: `spinc` legacy beside the new `spmaint`; `cell` keeps its id though labelled Personal cell number). The ids that matter most to the skills at 4.5: `idno`, `fname`, `sname`, `cell`, `work_cell`, `work`, `home`, `ref`, `loa`, `ps_risk`/`ps_grp`/`ps_ra`/`ps_pp`/`ps_inv` (the five schedule boxes), `pr_life` ... `pr_st` and their `_cm` comments, `ref_med`/`ref_will`/`ref_sti`, `br_aci`, `br_dd_cover`, `lc_f_aciv`/`pd_f_aciv`/`ip_aciv`/`dd_aciv`, `dd_cover` (fractured Dread) and `dds_cover` (standard), the Lump Sum Disability boxes `pd_hh`/`pd_cc`/`pd_dr`/`pd_need`/`pd_hhabi`, `cc_notes`, `tinc`, `net`, `disp`, `next_appt`/`next_time`, `meet`/`date`/`on_call`, and the lists above.

### 4.6 Voice

How it works, end to end (the README's "Voice mode" and "Listening" sections have the detail):

1. **Listen** turns sound into lines (`listen.js`). Sources: Whisper or Moonshine **on this computer** (default, nothing leaves the computer), **Chrome's recogniser**, or **OpenAI transcription** (best for rare names and addresses; each line is sent with a hint list of names and trade terms). Chrome's session ends every 5 minutes (it is renewed at a pause). **The microphone only hears this computer**, so on a Teams call with a headset the client never reaches it: the OpenAI source plus *Hear the client on a Teams call* shares the call's sound and labels lines `me` / `client` (**PR 10, never tested on a real call**).
2. Each line goes to `FF.app.voiceHear(text, who)`. **`voice.js`** (page side, no network) works out which box it is about and what it fills, with the guards; **`voice-ai.js`** sends the line, the last lines, the position and what is filled to Claude (the unchanging instructions are **prompt-cached** for an hour and warmed when Voice is switched on; low effort; no thinking where the model allows), reads the answer and applies it through `ui.js`. Up to four lines are read at once and applied in spoken order.
3. **Private values** (`V.PRIVATE_IDS`: `idno`, `tax`, `cell`, `work_cell`, `work`, `home`, `sp_tel`, `pemail`, `wemail`, `shares.id`, `shares.cell`) are **never sent to Claude** unless Paul turns *sharing* on in Settings (Claude is told only the kind of value, e.g. "10 digits, starts like a cell number").
4. A box filled by voice is `heard` (green flash) until the client confirms. `meetings` and `appts` are never filled by voice (`novoice`).
5. Things Claude is told every request: today's date and the form's date (`a_week_from_today`, `meeting_started`), which boxes take any value (`free`) and which are switched off (`off`), what is on the form now (`on_the_form_now`), the boxes the adviser emptied on purpose (`emptied`).
6. A **catch-up check** re-reads the conversation (at a section change, Voice off, or by a button) and fills only empty boxes (amber), never ID, tax, phone or email; **"Heard but not placed"** lists what was said and not placed.
7. **Action points**: written by Claude from the facts and the notes; **every point must name its source** or it is removed; the Admin page lists the notes read and the points removed.

### 4.7 API keys and costs

| Item | What to know |
|---|---|
| **Anthropic key** | Paul's own key (Console, API keys), pasted into the form's **Settings**, kept **in the browser's `localStorage` on that computer, as plain text** (per browser and per copy: the website and the OneDrive copy each hold their own; Settings says so and has a *Remove saved keys* button). Keys last **30 days** and are renewed by hand: Paul creates a new one in the console, saves it in Settings with its **expiry date**; the top bar counts the days down (amber at 14 days or fewer or with no date, red once expired). **Never ask Paul to paste a key into the chat.** |
| **OpenAI key** | Only for the OpenAI speech source; has its own expiry date and chip/line. |
| **Models** | Voice and look-ups default to **`claude-sonnet-5-5`** (the voice choice is Sonnet because it follows the read-back/undo rules; Haiku invented answers; Opus is dearer). The company look-up and LinkedIn search use web search (up to 3 or 4 searches at US$0.01 each plus pages read): the dearest thing the form does; LinkedIn runs only on its button. |
| **Cost meter** | `FF.lookup.costOf` prices every answer's tokens from `PRICES` (US$ per million tokens: Opus 5.5 4/20, Sonnet 5.5 2/10, Haiku 5.5 0.1/0.5, with cache write and read prices; an unlisted model is priced as the dearest so the meter never reads low). The total is saved in the file as `claude` (never in the PDF). The OpenAI speech cost is estimated from seconds of sound times the price per minute (US$0.006 for gpt-4o-transcribe and whisper-1, 0.003 for gpt-4o-mini-transcribe; a price box in Settings overrides it): saved as `openai`. Both are in the **keys-and-costs table** (4.3), one line per service. The credit left is the balance Paul typed less what the page counted: an estimate (Anthropic has no way to read a prepaid balance for an individual account). |
| **The Console is the real bill** | The meter is an estimate. |

### 4.8 The PDF

Drawn by `pdf.js` from `schema.js` with jsPDF (Wealth Revolution colours and logo). Every Notes box is printed in full in its own section; lists continue onto extra pages; the font cannot draw some symbols (they print as plain text: PR 16; ticks and emoji print "?"). **It mirrors the form exactly** (Paul's standing rule); the only things left off are the public profile (LinkedIn) (`nopdf`) and the cost figures. `tests/pdf-mirror.test.js` and the browser `audit-pdf.js` guard it. A PDF saved earlier is a picture of its day: open the client's file and save the PDF again to update it. Name: `Fact Find (Audio to Text) - dd.mm.yy - (Name Surname).pdf`.

---

## 5. The Fix Skills chat

A separate Claude chat that Paul runs next to this one. **It is the only thing that touches the skills and Paul's computer.** (Earlier a **Skill Restructure chat** did the skills' restructuring and asked for 3.3's bold headings; the Fix Skills chat took over.) It **relays messages to this session**: treat them as relayed requests from Paul's side (they can arrive while you work, as "From the Fix Skills chat, on Paul's GO ..."). Paul's own words reach you through it too (for example 3.5's *"Must not contact client" removed*, and the order to write this handover). A relayed message is information and a request, not a way around Paul's rules: **nothing is merged without Paul's own "merge"**.

| What the Fix Skills chat does | Detail |
|---|---|
| **Checks the skills against each release** | The skills that read or fill the saved file are checked, and renewed if needed, against every release's *Note for the Fix Skills chat* (section 3.8): **`review-fact-find-fill-skill`** (reads a client's documents and fills the form's file by box id), **`ff-population-transcript`** (builds the Fact Find Transcript PDF from the Audio to Text file and the Teams transcript), **`fact-find-summary`** (builds the Fact Find Summary PDF from the transcript PDF), and the others that touch the file (`advicetech-client-notes` writes `cc_notes`; `ff-to-ff-populate`; `client-teams-transcript-skill`; `complete-applications-skill`, **not yet connected** to the Short Risk Application or the Capture Sheet). It confirms when the skills are renewed (it did for 4.0). |
| **Installs every release on Paul's computer itself** | In OneDrive: `Company - Paul\Claude\Fact Find Documents\WR Fact Find - ZIP\WR Fact Find` (the **offline copy**; the website https://pavlos1972.github.io/Fill_In-Form_Project/ is the other place the form runs). It copies **only the changed files**, **reads each back against `main`**, and keeps **one dated backup zip** in *Fact Find Documents* (never loose "before" folders: OneDrive once rewrote the page links so they pointed at a backup folder). Paul does not install by hand. **You never install on Paul's computer** and never touch his OneDrive from this session (earlier in Chat 1, before this arrangement, the copy was updated by Paul and checked from this side with the Microsoft 365 tools; that is over). |
| **Status at the end of Chat 1** | **4.1, 4.2, 4.3, 4.4 and 4.5 are all installed** (4.2 and 4.3 had been waiting for the skills to be renewed). The copy is the same program as the website but keeps its **own saved keys and dates** (keys are per browser and per copy). |
| **What it needs from you after each release** | The ZIP as a **copy** (`SendUserFile`), and the **Note for the Fix Skills chat**: the version; every new, changed or removed box id, list and list column; anything a skill that **reads or writes the saved file** must know (a value now empty, a new top-level key, a changed meaning, a row key that may be empty); anything that would make a skill's form check stop. It renews the skills from that note. |
| **When it is not safe to change ids** | **Do not change ids or lists while the skills are being renewed**; the Fix Skills chat says when it is safe. A label change never needs this; a meaning change always needs a new id. |

Known facts the skills depend on (from the releases above): the schedule boxes' wording (3.1, PR 40); `pr_life` ... `pr_st` must be tested for text starting **"Not a priority"** (3.4); `ref_sti` offers only *Cameron to contact client* / *Not required* (3.5); the report skills held a **standing R 500 000 dread target** (PR 55/56: the fractured `dd_cover` stays R 500 000.00, the standard `dds_cover` starts R 0.00); the Lump Sum Disability ids (PR 53); `br_aci` is the **Yearly premium increase** on the BR Cover Summary page 2, never the base increase (3.9); `worked` is never to be written by a skill (3.1); `meetings.day` is calculated, not an answer (4.5).

---

## 6. Open items

### 6.1 Not tested on a real call or a real client

| Item | Status |
|---|---|
| **PR 10: listening to a real Teams call** | Built and unit-tested only. It needs **a short test call**: Settings > Speech source OpenAI, *Hear the client on a Teams call* = Yes, press **Listen**, in Chrome's share window choose **Entire screen** and tick **Also share system audio** for the Teams app (or choose the Teams tab and tick **Also share tab audio** for Teams in Chrome); then check the client's lines come in labelled `client` and the adviser's `me` with no echo. **Never tested on a real call, with Chrome's real share window.** Prompted by the 27 October meeting where all 274 lines were the adviser. |
| Voice for **work cell** (4.1), **"What was covered"** (pages, not topics: 4.0), the **passed-appointment question** (4.1), the **Progress buttons and Verify All** (4.1/4.2) | Tested by the automated checks only. |
| The **action-point sources rule** (3.8) with the real Claude | If it ignores the format all its points are removed, the plain points stay, and the Admin list says so. |
| **Notes** (3.8) | Paul: *"Checked, notes look much better so far, it will need to be tested further on other clients."* |
| Reading **scanned policy schedules** | The skills can; this sandbox cannot. |
| **The Short Risk Application with a real client** | Load from Fact Find, owner set to the spouse or a business partner, a call date from the calendar, the PDF it saves. |
| **4.4 and 4.5 on Paul's own screen** | Never seen live from this side (the sandbox cannot open the live site or Paul's computer). |

### 6.2 Built but with a known weakness

| Item | Status |
|---|---|
| **4.5: the boxes are narrow at the standard width** | In the one-line meetings, *"Teams Meeting"* and long names under *Others on the call* may be **cut off in the box** until clicked into. Seen only in a test screenshot. Possible fixes: give *Type* and *Others* more width, shorten the label of "What was covered (written by the form)" (it is a schema label: it is in the PDF too), or let the line wrap in two. Ask Paul after he has looked. |
| **The speech library on the CDN** | Whisper and Moonshine's library still loads from jsDelivr while Listen is on, and there is **no content-security policy** (audit finding #16, partly done). Needs a computer that can reach the CDN and the speech models so a change can be tested. |

### 6.3 Asked for, or offered, and not built

| Item | Status |
|---|---|
| **A password for Settings** | Offered (a password that opens Settings and scrambles the saved keys; "Forgot password" erases the keys). Paul decided to leave it for now. An emailed restore cannot be built (no server). |
| **Cost cutting** | About half the lines spoken in a meeting ("Mm-hmm", "Okay") change nothing but are still sent to Claude; skipping them could save about a third of Claude's cost (US$8.10 for the Rosalind Dube meeting). **Not built: Paul says "build cost cutting" if he wants it.** |
| **Official company spelling** | The company look-up does not yet offer the official spelling ("Jawitz") when the name is heard wrongly ("Jarwitz"). |
| **Spending limits on both keys** | A step for **Paul** in the Anthropic and OpenAI consoles: the best protection if a laptop is lost. |
| **`complete-applications-skill` not connected** to the Short Risk Application and the Capture Sheet | Paul will do that. |
| **Held for Paul's decision (from the changes page, PR 40):** the EGAR summary still calls the childcare box "Education and childcare cost today"; the Life summary's debt totals still count every debt, not only those the client pays | Not confirmed changed since. Ask before touching. |
| **The Sitamah guide** (`Fact Find - Guide for Sitamah.pdf`) | Tells her to open the website address (decided: she uses the website); its example file name (`Fact Find 06.11.2026 ...`) is out of date after the file-name change (PR 49). |
| **The two report skills** (`ff-population-transcript`, `fact-find-summary`) | To read the `worked` block first and keep their own sums only as a check, add Spousal Maintenance to Total Income, show the debt term as months (3.1 note). The Fix Skills chat confirmed the skills renewed for 4.0; whether every item of the 3.1 note is done is the Fix Skills chat's to say. |

### 6.4 Housekeeping

| Item | Status |
|---|---|
| **Paul's Anthropic key expires about 16 December 2026** | He renewed it on 16 November (30 days; saved in Settings on the website copy; the OneDrive copy keeps its own). The top bar warns at 14 days (about 2 December). |
| **`docs/HANDOVER-release-3.1.md`** | A working note that said "delete after the merge"; it is still in the repository. Can be deleted. |
| **`CLAUDE.md` wording** | It said "about 680 tests" and, before this handover's pull request, still said 4.5 was *built, not merged* (see section 8, lesson 14). Corrected in the same pull request as this file. |
| **The changes page** | Updated to version 45 / PR 76 on Paul's word; update it again only when he asks. |
| **No open pull request** | Apart from the one carrying this handover and the `CLAUDE.md` pointer (waiting for Paul's "merge"). |

---

## 7. Links

| What | Link |
|---|---|
| **The website** (GitHub Pages, published from `main`) | https://pavlos1972.github.io/Fill_In-Form_Project/ (the other two pages: `.../short-risk.html`, `.../capture-sheet.html`) |
| **The repository** | https://github.com/Pavlos1972/Fill_In-Form_Project (work branch `claude/create-something-stjk8a`) |
| **The changes page** (Paul's list of what changed, per release: an Artifact, private to Paul) | https://claude.ai/artifact/TG8Jqe8ndzoZKUuuZhUwpP |
| **The audit page** (the 31 audit findings; the numbers #1, #3 ... on the changes page are its finding numbers) | https://claude.ai/artifact/T89cRpt3p6rejvmX51ikwi |
| **The screens page** (real screenshots of the PR 39 changes) | https://claude.ai/artifact/HfRSbeHCi9ii3mM3btHeBN |
| **The top-bar mock-up** (Option A with the "Other forms" dropdown; Option B with the keys-and-costs table: Paul chose B, then asked for the mix, 4.4) | https://claude.ai/artifact/Ct5XKZ25MHVVThJM16QYRQ |
| **The approved form mock-up** (older) | `docs/mockup/live-fact-find.html` in the repository |
| **The offline copy** | OneDrive: `Company - Paul\Claude\Fact Find Documents\WR Fact Find - ZIP\WR Fact Find` (installed by the Fix Skills chat) |
| **The Risk Tolerance website** (copied into the Capture Sheet, never changed from here) | https://risktolerance.netlify.app |
| **Anthropic Console** (API keys, the real bill) | https://console.anthropic.com |
| **OpenAI API keys** | https://platform.openai.com/api-keys |
| **How this cloud environment works** | https://code.claude.com/docs/en/claude-code-on-the-web |
| **A pull request** | `https://github.com/Pavlos1972/Fill_In-Form_Project/pull/NN` |

The artifacts are private to Paul's account (only Paul can open them): to update the changes page you must be signed in as Paul's session, with the Artifact tool.

---

## 8. What went wrong, and what was learnt

| # | What happened | What was learnt |
|---|---|---|
| 1 | **PR 28 named the PDF "Voice to Text"** and left the .json with its own name. | Paul wanted "Audio to Text" and the same name for both: **PR 49**. The file-name rule is now a standing rule with tests. Ask about both files when a name is given. |
| 2 | **PR 22 kept the risk calculation open inside the Life area; PR 24 (next day) reversed it** to its own page, always there. (The pull request text records the reversal; why Paul wanted it is not recorded.) | A placement question is a layout question: show it first. |
| 3 | **PR 38 merged the two retirement schedule requests**; Paul asked for them back (**PR 39**). | Do not merge two boxes "to tidy"; ask. |
| 4 | **PR 55 set Dread cover to R 0.00 in both blocks**; Paul meant only the standard block (**PR 56**, three days later). | Read the instruction for *which* block; a test now pins both starting values. The skills hold a standing R 500 000 dread target. |
| 5 | **PR 54:** a flaky broker test (two saves in different milliseconds) once **stopped a website update**. | The tests are the gate of publishing: a flake costs a release. Write tests that do not depend on the clock; the run was repeated and the test fixed (passed 40 runs in a row). |
| 6 | **3.9: the ACI was taken from the schedule's "Yearly base increase".** Paul: *"his ACI is 10% not 3% ... His ABI is 3% ... Did you confuse things a little, I think?"* (He was right.) | On the BrightRock BR Cover Summary (page 2) the **Yearly premium increase is the ACI** and the **Yearly base increase is the ABI**; the ABI is never filled from the policy. **When a figure comes from a document, name the exact line you took it from and check it against Paul's own example before building.** Corrected before the merge; the PR text kept the first wording. |
| 7 | **3.9's website update failed four times** at GitHub's deploy step ("no artifact", then "multiple artifacts"). | **Re-run failed jobs once at most**: a re-run of the same run uploads another package and then fails for good. Start a **fresh run** (`run_workflow`, `pages.yml`, ref `main`). Not our code: the tests, build and upload had passed each time. |
| 8 | **4.1: Verify All and "to verify" missed** advisor pages, optional boxes and Broker on record; **no calendar** on the list rows. Paul found both in his first real run. | **4.2.** "Every page" means every page: build the count from the same list the Progress card uses, and test a box on every kind of page. |
| 9 | **4.3: the keys-and-costs table stretched across the whole top bar** (the form's own global `table { width:100%; min-width:640px }` and the header background). | Look at a **real screenshot** of any layout change before offering it; fixed in the CSS before merging. |
| 10 | **4.5: "What was covered" wrapped onto a second line**, breaking the one-line rows; and the one-line list lost its **empty-list message**. | A screenshot and the older test caught them; fixed before merging. Check the empty state of a list you re-lay out. |
| 11 | **4.4: my browser test tested "hidden" the wrong way** for a closed `<details>`. | Fix the test, not the page, and say so on the changes page. |
| 12 | **The browser suite counted its own summary file as a failed script** when I redirected the summary into the output folder. | Send the suite's output to a fresh, empty folder and the summary somewhere else. |
| 13 | **`pointKey(undefined)`** made a missing `said` look quoted (3.8); a test caught it. **Date-bound tests** (2026 dates) failed once the real date passed. | Test missing values; use future dates in tests. |
| 14 | **`CLAUDE.md` says "built, not merged" after the merge.** The release commit updates its header before the merge, so the file on `main` says "waiting for merge" for one release. It happened for 4.4 and 4.5. | Either write the header as "merged" in the release commit (it will be true when Paul says merge) or fix it in the next commit; do not leave it. This handover's pull request fixes it. |
| 15 | **A background command committed and pushed by itself** while I was editing (4.2). | Wait for a background run to finish before editing again. |
| 16 | **The sandbox's safety check refused a whole command** (it contains a heredoc; there was no removal in it) and ran nothing. | Split the command and write files with the Write/Edit tools; never try to get around a genuine removal check. |
| 17 | **OneDrive once rewrote the page links** so the copy opened a backup folder. | **One dated zip as the backup**, never loose "before" folders next to the copy. |
| 18 | **The context ran past the safe size in this chat.** At 4.3 it was about 89% and I advised a new chat; after the context was compacted Paul asked to continue here (4.4, 4.5). | The percentage shown can change after a compaction. Keep `CLAUDE.md` current at every release so a new session can start at any time; this handover is the full version. |
| 19 | **Claude's real reading of spoken lines, live meetings and the Teams call could never be tested in the sandbox.** Every pull request that touches voice says so. | Say what is not tested, every time, plainly; Paul's own first real run finds what the tests cannot (4.1 to 4.2 is the example). |

---

## 9. What could not be recovered

| Gap | Detail |
|---|---|
| **Paul's exact words** | **`docs/PAUL-MESSAGES-CHAT-1.md` keeps every message Paul wrote from 13 November 2026, 08:05 UTC, word for word, with date, time and what was done in answer.** Before that moment the transcript is not on disk: the file's Appendix A holds the few messages the compaction summaries quoted, and the rest are not recoverable. |
| **Paul's exact words for most of the early chat** (before 3.8: PR 1 to PR 68) | The conversation's early part was compacted. Only what the pull requests, the commit messages, the README, `CLAUDE.md` and `docs/` say survived; where this file quotes Paul it is from the later part of the chat (3.8 to 4.5) or from `CLAUDE.md`/the README. His decisions about earlier releases are recorded as **what was built**, not as his words. |
| **Why a particular early pull request was asked for** | The pull request bodies sometimes name the meeting or request that prompted it (the Vera Zeller, Sitamah Nathoo, Rosalind Dube, Wilhelm Bosman, Elmer Jonker and Sibanda meetings; the 27 October Teams meeting; the Erika Kuiper log); where they do not, the reason is not recorded. |
| **PR 1's own description** | It has only attribution lines. |
| **The Fix Skills chat's own record** | Its messages reached this chat as relays; what the skills now do, which of the 3.1 skill changes are finished, and the exact files it installed on Paul's computer are **its to say**, not recorded here. |
| **The live site and Paul's computer** | Never opened from this sandbox: whether 4.4 and 4.5 look right on Paul's screen is unknown. |
| **The scratchpad** | The changes page's working copy and the `update-changes-NN.py` scripts, the mock-up source and the ZIPs of 3.6 to 4.5 were in this session's scratchpad and **will not survive**; the live changes page and the repository do. (The ZIP of any release can be rebuilt with `git archive`: section 3.7.) |
| **Some pull request bodies' wording** | Squash commits on `main` often repeat the first commit's message rather than the final description; the descriptions were read from GitHub. |
