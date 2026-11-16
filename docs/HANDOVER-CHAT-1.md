# Handover of Chat 1: the Wealth Revolution Fact Find

Written on 16 November 2026 by the Claude Code session that built versions 3.1 to 4.5 with Paul, for the new session called **"Fact Find Audio to Text Form - Chat 2"**. Read `CLAUDE.md` first (short, the rules and the release routine); this file is the long version: the whole story of Chat 1, so nothing is lost.

**How this file was made, and what that means for how far to trust it.** The early part of Chat 1 was lost when its context was compacted. This file was rebuilt from: the repository (`git log` of `main`, `docs/FORM-CHANGES.md`, `README.md`, `CLAUDE.md`, `docs/HANDOVER-release-3.1.md`, the tests), the list of pull requests 1 to 76 and their descriptions (a digest was made by a helper and is cited where used), the summary Chat 1 kept of its own later part (releases 3.8 to 4.5), and what Paul said, which is quoted where it is known word for word. Section 9 lists what could **not** be recovered. Where a statement comes from memory of the later part of the chat rather than from the repository, it is marked *(from the chat)*. The repository is the proof for anything about code; this file is the proof only for what Paul said and why.

The clone this was written in is a **shallow clone: its history starts at pull request 16 (27 October 2026)**. Pull requests 1 to 15 exist on GitHub (titles are in section 3) but their commits are not in the local history.

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
| **The clients** | The people in the meetings. Real client data never goes into tests, commits or the README: use invented names. (The repository already holds a few meeting labels, such as "the Edwin Joubert meeting" and "client Sasson"; they are labels of recorded meetings, nothing else about those people is kept.) |

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
| **The BrightRock ACI is the Yearly premium increase, not the base increase** | After the first build of 3.9 used the wrong figure: *"Hold on - the example of Alex Sasson ... his ACI is 10% not 3% ... His ABI is 3% ... Did you confuse things a little, I think?"* (He was right.) | 3.9: `br_aci` = Yearly premium increase (10.0% on the example); the Yearly base increase (3.0%) is the ABI and is never filled from the policy. |
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
| **Yes to standard tables too** | When asked whether the BrightRock follow-the-policy rules should also reach the standard quote tables: *"Yes, standard tables too"* (the ACI/percent rules were applied to the standard quotes' percentage boxes; the standard quotes are not part of the one-ACI rule). | 3.9 |

Earlier decisions (before 3.8) are in the pull request descriptions and in the version table (section 2): the three-group top bar, the Client priorities page, one "no" (Not a priority), automatic Not a priority only where a fact makes the area pointless, the meeting file names, the standing PDF rule, Broker on record everywhere defaulting to Other broker, numbered priorities 1 to 8, the Priorities to be Focused on box, and so on.

---
