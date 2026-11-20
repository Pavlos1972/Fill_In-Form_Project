# Handover to Chat 4 ("Fact Find Audio to Text Form - Chat 4")

Written on 20 November 2026 by Chat 3 ("Fact Find Audio to Text Form - Chat 3"), at the request of the Fix Skills chat (relayed: the Context gauge read 88% on Paul's screen, past the 85% rule; *"prepare a full handover for Chat 4 now ... take NO new form work ... Paul decides when Chat 4 starts"*). **Update (20 November, relayed by the Fix Skills chat): Paul says we stay with Chat 3 for now, since it is up to date. Chat 4 starts only when he says, or when Chat 3 reaches 85% again and tells him; this file waits for that day.** A fresh session can follow this file alone. Read it right after `CLAUDE.md`.

**This repository is public.** Nothing in this file is private: no client name, no e-mail address, no key, no folder path of Paul's computer, and not the private name list used for the history clean-up (kept out of the repository on purpose: see `docs/HANDOVER-TO-CHAT-3.md` section 9).

`docs/HANDOVER-TO-CHAT-3.md` is **not replaced**: its sections 3 (saving into the client's folder), 4 (the routine, with the tool names), 6 (the changes page), 8 (open items) and 9 (the names clean-up record) are still true and are the detailed reference. This file carries what is new since, and everything else in short.

## 0. Read these first, in this order, and your first ten minutes

| # | File | Why |
|---|---|---|
| 1 | `CLAUDE.md` | The rules that must not be lost, where things stand, the decisions and why, the version history. Update it with every release. |
| 2 | This file | State at the end of Chat 3, what 5.3 is made of in the code, the routine in short, all of Paul's rules, the open items, Chat 3's lessons. |
| 3 | `docs/HANDOVER-TO-CHAT-3.md` | The detailed reference named above (sections 3, 4, 6, 8, 9). |
| 4 | `README.md`, `docs/FORM-CHANGES.md` | Every screen and rule of the three pages; the dated change log of ids, lists, labels and sums. Release 5.3 is in both. |
| 5 | `docs/HANDOVER-CHAT-1.md`, `docs/PAUL-MESSAGES-CHAT-1.md` | Chat 1's full story, and Paul's own Chat 1 messages word for word. Read when you need more than `CLAUDE.md`. |

**Your first ten minutes**

1. `git fetch origin` and `git status -sb` (the session gives you your own branch; **never push to any other branch**).
2. **Get the unmerged documentation commits** (section 1 says which). `origin/main` does **not** have them yet. Either Paul has by then said "merge" for the documentation-only pull request and `origin/main` has them (check `git log origin/main -3`), or run on your branch: `git fetch origin claude/elegant-bell-5whxdn && git merge --no-edit FETCH_HEAD`. The difference between that branch and `main` is documentation only (`CLAUDE.md`, `docs/HANDOVER-TO-CHAT-3.md`, this file, the README's `docs/` row): no app, test or workflow file. **Do not open a pull request unless Paul says "merge".**
3. Load the GitHub tools with `ToolSearch` (`docs/HANDOVER-TO-CHAT-3.md` section 4, step 1) and run `npm test` once (**815 tests pass** at 5.3).
4. **Prepare nothing else.** Wait for the Fix Skills chat's next message; Paul's feedback on the 5.3 checklist comes from him directly (open item 1).

## 1. State at the end of Chat 3 (20 November 2026)

| Item | State |
|---|---|
| **Versions** | Fact Find **5.3**, Risk Application **1.5**, Investment Application **1.4**. Shared build number `BUILD = '5.3'` (`app/js/build.js`). Versions are compared as decimals: the number after 5.9 is **6.0**. |
| **On `main` and on the website** | All three, since PR 90 (squash commit **`97c44ee`**). Tests passed on the exact commit `c0e2da7`; the Publish run (id 44751186284) succeeded first time, about 54 seconds, deploy step 7 seconds. I could not open the live site. |
| **Installed on Paul's computer** | **Yes, by the Fix Skills chat, on 20 November** (the copy was 5.2 `d22c4dc` first; 14 changed and 2 new files written; all 49 files read back identical to `97c44ee`; dated backup zip *WR Fact Find - latest 20 Nov 2026 (5.3, Risk App 1.5 + Investment App 1.4)*, 825,712 bytes). **Paul has not yet reported what he saw** (open item 1). No real Save into his OneDrive has been tried on any page. |
| **Skills** | The four form-linked skills were renewed for 5.3 by the Fix Skills chat on 20 November (the short-term broker choices; the greyed maintenance boxes are never filled, are printed N/A and are left out of Total income; the version checks) and are **uploaded and tested on Paul's account (NOT live until he confirms them)**, each built for Fact Find 5.3 / Risk Application 1.5 / Investment Application 1.4: `review-fact-find-fill-skill` **v25** (20261120-1757), `complete-applications-skill` **v20** (20261120-1754), `ff-population-transcript` **v56** (20261120-1759), `fact-find-summary` **v33** (20261120-1800). Before that: `review-fact-find-fill-skill` v23, `complete-applications-skill` v19, `ff-population-transcript` v55, `fact-find-summary` v32 (for 5.2 / 1.4 / 1.3). |
| **Changes page** | https://claude.ai/artifact/TG8Jqe8ndzoZKUuuZhUwpP at **version 58** (20 November, on Paul's "Update the changes page"). It holds 4.9 to 5.3, the names clean-up and the Support request. **One thing to change next time it is updated:** its "Not done" list still says the fill-in skill reading more than the previous Fact Find is not done; it is **handled by the skills chat** (open item 3). |
| **Branches** | `main` = `97c44ee`. Chat 3's branch `claude/elegant-bell-5whxdn` holds, **not on `main`**: `fc3b5d4` (the resync merge after the squash), `35486aa` (5.3 commit numbers in the records), `5621443` (changes page at version 58), `c6430a6` (5.3 installed), and the commit that adds this file. The documentation-only pull request "Docs: handover to Chat 4" is for Paul to ask for (his "merge"). Chat 1's branch `claude/create-something-stjk8a` and Chat 2's `claude/gallant-turing-hoe5mi` are kept. PR 89 (the Chat 3 handover) was merged as `9b93185`. |
| **GitHub Support ticket #5027370** | Still waiting for GitHub (the old pull-request references and edit histories after the names clean-up). Checks to run when it answers: `docs/HANDOVER-TO-CHAT-3.md` section 8, item 1. |

## 2. What Chat 3 did

| What | Where |
|---|---|
| Took over from Chat 2; Paul's "merge" of the handover PR #89 | `9b93185` |
| **Investigated a lost conversation log** (a real meeting): the log lived only in the open page memory; the adviser opened another client, reopened this one and saved an empty log (about 1 KB instead of the usual 12 to 18 MB). Evidence: the saved Fact Find and the voice log in the client's folder; **the Teams transcript could not be read (the connector was refused, FORBIDDEN)** | Section 3 |
| **Release 5.3 / 1.5 / 1.4**, from Paul's list of 20 November (his answers A to E, then "BUILD"), merged on his "merge" | PR 90, `97c44ee` |
| ZIP built from `origin/main:app` and sent as a copy; the FOR THE FIX SKILLS CHAT block given | done |
| Changes page updated to version 58 on Paul's "Update the changes page" | done |
| "Installed" recorded in `CLAUDE.md` and Chat 3's handover; the fill-in note, the skill numbers and this handover prepared on the Fix Skills chat's request | this commit |

## 3. What Release 5.3 is made of (where to look in the code)

Paul's list, item by item. **Ids never changed; no box was added, removed or relabelled.**

| Item | What it is | Where |
|---|---|---|
| **Date completed has a Calendar** | `cal: 1` on the box | `schema.js` (`date`) |
| **Spousal Maintenance (`spmaint`) and Child Maintenance (`maint`) greyed unless they apply** | `spmaint` open only for Divorced; `maint` for Divorced and Single; **both open while `marital` is empty**; greyed = nothing cleared, and **left out of `tinc` / `disp`**. The rule is written twice: `cond` + `grey:1` in `schema.js` (`NOT_DIVORCED`, `NO_CHILD_MAINT`) and `INCOME_COND` / `incomeIds(ctx)` in `calc.js`; **`tests/release-53.test.js` keeps them equal: change both** | `schema.js`, `calc.js` |
| **Short-term Broker on record (`sti_broker`) is Cameron Maritz instead of Paul K** | `STI_BROKER = ['Cameron Maritz','Other broker','Through company','None']`; an older Paul K stays visible (`keepOld: 1`, read by `optionsHTML(o, v, def)` in `ui.js`); **`store.brokerChoices` skips turning "Cameron Maritz" into Other broker for `sti_broker`** (it still does for the other three boxes); voice reads Cameron or Maritz (`voice.js`); the form decides nothing by itself when the cover is with Cameron Maritz | `schema.js`, `store.js`, `voice.js`, `ui.js` |
| **The client's agreement to a read-back confirms the box, by the page itself** | `vmReadBackAgree(entry)` and `vmSaysValue` in `ui.js`, hooked after `vmProcessAuto` in the per-line queue: a line that is **not the adviser's** that agrees (`V.isConfirm`) or says the value again confirms a waiting (heard / verify) box whose value the adviser said in one of the last three lines (`RB_WINDOW` 120 s), **on any page**; dates and money compared through `V.interpret` (read the `date` flag from `schema.fieldsById`, the voice index lacks it), private numbers by digits on this computer, text by whole words (a bare Yes/No is never matched). **An unknown speaker needs the line before to read as a question or read-back; the adviser's own yes never confirms.** Cause found by reproducing the exchange: the answer to a read-back depended on Claude, which is told only about boxes of the page on screen | `ui.js` |
| **The conversation log is kept in the browser** | `app/js/logkeep.js` (IndexedDB `wr-fact-find-logs`, stores `sessions` and `lines`; an in-memory twin for tests; 14-day purge). `ui.js`: `keeper`, `cvKeepAdd`, `logBoundary()` (called by New and Open), `logBar` (reminder bar `#logbar`), `logDialog` / `#logDlg` (kept logs), `logSaveOne`, `logDrop`, `logRemind` (after the Fact Find is saved), `logEmpty` (Save log with nothing says so). Saving a log removes the kept copy; the saved voice log's layout is unchanged | `logkeep.js`, `ui.js`, `app.css` |
| **Risk Application page `home` is titled Address, COC & doctor** | label only; the page id stays `home` | `sr-schema.js` |
| **Other forms ▾ menu on both applications** | native `<details id="otherForms">` with `.ofmenu` links (ids `linkFF`, `linkCS`, `linkSR`); closing handled by `FF.handover.bindMenu` | the three pages, `handover.js` |
| **Both applications open filled from the Fact Find** | `app/js/handover.js` (`send`, `peek`, `clear`, `sameClient`, `wants`, `stripFlag`, `bindMenu`; localStorage key `wr-handover`, 60 minutes): clicking an Other forms link on the Fact Find leaves the client on screen (answers and lists only; summaries, action points, notes and cost tallies are dropped), the link carries `?from=factfind`, and `sr-ui.js` / `cs-ui.js` fill like Load from Fact Find (amber verify, typed boxes kept) and remove the flag from the address. **A page opened on its own stays blank.** Unsaved work for another client is asked about ("Start a new application for <name>"); the same client's is restored and topped up; New on the Fact Find clears the hand-over. Risk to Investment passes it only when `sameClient`. Same browser and same address only; the Fact Find's file location is not passed (a first Save finds the folder by name) | `handover.js`, `sr-ui.js`, `cs-ui.js`, `ui.js` |

**Tests at 5.3:** 815 unit tests (new `tests/release-53.test.js`, 23; it also fails on a function defined twice in the page scripts) and 1142 browser checks (new `tests/browser/t-release53.js`, 49, in the `SIMPLE` list of `run.sh`). Older tests that pinned the old broker words or the PDF audit were updated.

**What is not certain:** seen only in my own screenshots and on pretend / private-file-system folders, **not on Paul's screen**; **whether the client's voice reaches the form on a Teams call** (the read-back rule depends on it; the "Client Sound" bar on the Fact Find shows it; a short test call settles it); the hand-over passes the client's names but not the Fact Find's folder; the verify rule was tested on the exchange as I reproduced it, not on the real call.

## 4. The release routine, in short (detail: `docs/HANDOVER-TO-CHAT-3.md` section 4)

Paul's order: **he asks → you explain back (questions only where a decision is his) → "build" → you build, test, push, say what is built and what is not certain, ask "merge?" → his own "merge" → you merge and publish-check → the Fix Skills chat renews the skills and installs.**

1. Build on your own branch: bump `version` (`schema.js`, `sr-schema.js`, `cs-schema.js` as needed), `BUILD` in `build.js`, the `wr-build` meta in all three pages, the version pins in the tests (`grep -rn "schema.version" tests/`), the `?v=` tags of changed scripts.
2. Same commit: README (a "Release X.Y" section; correct every statement the change makes untrue), `docs/FORM-CHANGES.md`, the PDF (drawn from the schema; hand-drawn parts by hand), `worked.js` if a figure changed, `CLAUDE.md`. Add `tests/release-NN.test.js` and `tests/browser/t-releaseNN.js` (in `SIMPLE` of `run.sh`).
3. `npm test`, then `rm -rf <dir> && mkdir <dir> && bash tests/browser/run.sh <dir>` (an empty folder; `N checks passed, 0 script(s) failed`), then `git checkout -- tests/browser/*.png`. **Run the browser suite before believing a unit-test pass** (section 8). Known PDF-audit items only: *Public profile summary*, *Public profile (LinkedIn)*, *Current Client File Summary Notes*, *Current Client*.
4. **Before every commit: `git grep -n -i` for any client name, surname, ID number, tax number, phone number or date that came from a screenshot, a relayed message or a real file** (section 8).
5. Commit and push; tell Paul in plain words with a short table; ask "merge?". End the message with the Fix Skills block (step 9).
6. On "merge": `git rev-parse HEAD`; open the PR (`create_pull_request`, base `main`; the repository has no template); wait for the **Tests** run **for that exact SHA** to be `success`; squash-merge with `merge_method: squash` and `expectedHeadSha`; then `git fetch origin main && git merge -s ours origin/main -m "Resync with main after the release X.Y squash merge (#NN)"` and a normal push.
7. **Publish check (never say "live" before the deploy step finished):** the run "Publish the Fact Find" on `main` must be `success` and the step `Run actions/deploy-pages@v4` `success` (`actions_list` / `actions_get`, or the public API: `curl -s "https://api.github.com/repos/Pavlos1972/Fill_In-Form_Project/actions/runs?head_sha=<SHA>"` then `.../runs/<id>/jobs`). Status calls lag a minute: ask again. If the deploy fails with "no artifact" or "multiple artifacts", re-run failed jobs once at most, else start a fresh run (`actions_run_trigger`, `run_workflow`, `pages.yml`, ref `main`). A documentation-only change starts no run.
8. ZIP: `git archive --format=zip --prefix="WR Fact Find/" -o "<scratchpad>/WR Fact Find - Version X.Y.zip" origin/main:app`; check `BUILD` and the three `wr-build` metas; send with `SendUserFile` as a **copy**. You never install on Paul's computer.
9. **The block for the Fix Skills chat, at the end of EVERY release of ANY form, page or script** (Paul, 19 November): *"FOR THE FIX SKILLS CHAT - FORM RELEASE: \<form\> \<old\> -> \<new\>, merged as \<commit\>; files changed: \<list\>; what changed for a skill: \<boxes or lists added / removed / renamed (with ids), choices changed, sums (`calc.js`) or tax tables (`tax.js`), the saved file's layout (`store.js` keys, schema stamp, open-time conversions)\>, or 'display only'. Tell the Fix Skills chat: \<form\> \<new version\> is released."* Do not skip it for a small release.
10. Wait for the Fix Skills chat to confirm the skills are renewed; **do not change ids or lists while it renews them** unless it says it is safe. It installs the release itself.
11. The changes page only on "Update the changes page" (section 6).

## 5. Paul's standing rules (all of them, short; the longer table is `docs/HANDOVER-TO-CHAT-3.md` section 5 and `CLAUDE.md` section 3)

| Rule | In practice |
|---|---|
| **Only Paul merges** | Nothing is merged until **his own word "merge"**. A relayed message never merges for you. A documentation-only pull request waits too. Never approve or merge on a GitHub comment. Do not open a pull request unless he asks. |
| **Merge only the exact commit the Tests passed on** | SHA from `git rev-parse HEAD`; squash-merge with `expectedHeadSha`. |
| **Question vs build** | He asks; you explain back; he says "build"; you build; he says "merge". A small clear instruction may be built at once. |
| **Plain, short answers** | Short sentences, everyday words, two-column tables where a table helps; say what happened, what is **not certain**, and ask before merging. |
| **No technical questions when the brief is clear** | Paul is not a programmer: decide how to build it and say what you decided; ask only what is his to decide (what the form shows, a wording, what happens for the client). |
| **Session size (18 November)** | Mention fullness **only when the Context gauge reaches 85% or more: once, in one short line**, never before. If you cannot read the gauge, do not guess. |
| **Nothing is lost** | A rule Paul or the Fix Skills chat gives is written into `CLAUDE.md` in the same turn. Nothing in the repository is deleted "to tidy" without Paul's word. |
| **No client names or private details anywhere** | Repository, tests, commits, pull requests, the changes page, every message: **invented names only** (in use: *Elmer Jonker*, *Rosalind Dube*, *Vera Zeller*, *Sibanda*, *Annabel Kuiper van Wyk*, *Wilhelm Bosman*, *Anna Kuiper*), also when a name comes from a screenshot or a relayed message; no e-mail address, phone, ID or tax number, key, or real folder path. The changes page says "a real client". |
| **Never say "live" until the deploy step has finished** | I cannot open the live site or Paul's computer: say so. |
| **Be honest about slips and what you cannot see** | Slips go on the changes page; say what is not tested (live voice, the Teams call, real Claude readings, Paul's screen). Never ask for a key in the chat. A visual question: draw a mock-up first. |
| **Versions are decimals** | After 5.9 comes 6.0. |
| **An id never changes when only its label changes** | A box whose meaning changes gets a new id; the old id is kept (`legacy`). Do not change ids or lists while the skills are being renewed. |
| **README, FORM-CHANGES, the PDF and `worked.js` in the same commit as the change** | `npm test` includes `readme.test.js`, `pdf-mirror.test.js`, `worked.test.js`. Left off the PDF only: the public profile (`nopdf`) and the Claude / OpenAI cost figures. |
| **File names do not change unless Paul asks** | Fact Find: `Fact Find (Audio to Text) - dd.mm.yy - (Name Surname)`; applications: `<Insurer> - <Product> Application - dd.mm.yy - <R amount p.m. or R amount - Lump Sum> - (First Last)`. A file that is opened keeps its own name. Deal folders keep the client's name; only *Personal Covers* is written *Personal*. |
| **One dated zip as the backup; the whole folder as one ZIP** | Never loose "before" folders next to the copy. |
| **Tell the Fix Skills chat of every form release** | The block in section 4, step 9. |

## 6. The changes page

Procedure: `docs/HANDOVER-TO-CHAT-3.md` section 6 (read the live Artifact, copy the saved file into your scratchpad as `fact-find-changes.html`, never edit the saved file in place, edit with a script whose every anchor must match exactly once, check the HTML is balanced, publish to the same URL). **Added by Chat 3:**

| Point | What |
|---|---|
| **A publish can be refused until the live version has been "viewed"** | On 20 November the first two publishes of version 58 were refused ("read the live version first"); reading the page again with `action: read` and publishing the **same, unchanged file** a third time succeeded. Do not change the content to get past it. |
| **What v58 holds** | 4.9, 5.0, 5.1, Risk Application 1.4 / Investment Application 1.3, 5.2, **release 5.3 / 1.5 / 1.4 (its own section `h-rel53`, with the slips and what is not certain, a line in the history list, the checklist for Paul's screen and two items under "Not done")**, the names clean-up (`h-names`), and the Support request. It holds no client name. |
| **To change next time** | (1) The "Not done" item about the fill-in skill reading more than the previous Fact Find: **handled by the skills chat**. (2) The status line and the two test counts (`815`, `1142` in `var T = [...]`) after the next release. (3) The skill numbers, once recorded. The working copy (`/tmp/claude-0/.../scratchpad/fact-find-changes.html`) is **lost with Chat 3's container**: rebuild it from the live page. |

## 7. Open items

| # | Item | State and what to do |
|---|---|---|
| 1 | **Paul's feedback on the 5.3 checklist** | I gave him a checklist to try 5.3 on his screen (Calendar on Date completed; maintenance greyed under Married, open under Divorced and Single; short-term broker Cameron Maritz; the read-back confirmation; the kept log with its reminders; Address, COC & doctor; the Other forms menus; the applications opening filled). **His feedback comes from him directly.** Anything he reports that is a fault is a build, after his "build". |
| 2 | **The four skill versions for 5.3** | **Recorded (20 November, from the Fix Skills chat):** `review-fact-find-fill-skill` **v25** (20261120-1757), `complete-applications-skill` **v20** (20261120-1754), `ff-population-transcript` **v56** (20261120-1759), `fact-find-summary` **v33** (20261120-1800); uploaded and tested on Paul's account, **waiting for Paul to confirm them live**. When he confirms (relayed), say so in `CLAUDE.md` section 0 ("Waiting on others"). |
| 3 | **The fill-in skill reading more than the previous Fact Find (item 11 of Paul's 20 November list)** | **Handled by the skills chat, not by the form.** Paul's words were: *"The other thing to consider was that the program needs to look at not just information from the previous fact form, but I guess that goes to the fill-in skill, and maybe I'll inform the fill-in skill how that needs to happen."* The Fix Skills chat built, at 15:59 on 20 November on his word, a **policy check in `review-fact-find-fill-skill`**: every old-Fact-Find policy is checked against the Overview, AdviceTech, Astute and the latest group risk benefit statements, and only current policies go in. Paul answered at 18:19: *"That covers it for now."* Nothing to build here. (The changes page lists it as not done until its next update.) |
| 4 | **GitHub Support ticket #5027370** | Section 1; checks in `docs/HANDOVER-TO-CHAT-3.md` section 8, item 1 (the checks of the old names need the private name list, which is **not** in the repository: ask Paul only when due). Do not delete any pull request or change the visibility. |
| 5 | **A real Save into Paul's OneDrive has not been tried on any of the three pages** | He connected both folders on the website on 18 November; no real Save yet. The Fix Skills chat will relay what he sees (*Saved to ...*, the path-too-long text, *Choose where to save*). Paul must connect the folders once in each place a page runs. |
| 6 | **Whether the client's voice reaches the form on a Teams call** | The page-side read-back rule (section 3) depends on it. A short test call settles it (the Client Sound bar). Not yet tried. |
| 7 | **Question for Paul: his own e-mail addresses are voice examples in five test files and one README line** (`tests/voice.test.js`, `tests/browser/t-email2.js`, `t-email3.js`, `t-delete.js`, `t-agree.js`, and the README) | Not changed. Replace them with invented ones? Ask once, in a later change. |
| 8 | **The file of Paul's Chat 2 messages** | Was never made; it could only be made from Chat 2's own transcript, which lives in Chat 2's container (probably gone by now). Paul had said "hold that for now". Do not chase it. |
| 9 | **Not yet tested with a real client** | `CLAUDE.md` section 6 (5.3 on his screen, the Teams call, voice for "work cell", "What was covered", the Progress buttons and Verify All, scanned policy schedules, saving into OneDrive, the bank and life-insurer lists (mine, from public knowledge, not the official register)). |
| 10 | **Asked for or offered, not built** | `docs/HANDOVER-TO-CHAT-3.md` section 8, item 7 (cost cutting, a password for Settings, and others). **Ask before touching.** Paul's Anthropic key expires about 16 December 2026 (his step in the console; never ask him to paste a key). |

## 8. Lessons from Chat 3 (add to the lists in `CLAUDE.md` section 5b and `docs/HANDOVER-TO-CHAT-3.md` section 10)

| Lesson | What happened and what to do |
|---|---|
| **A name defined twice in one file silently replaces the first** | My new `convoMeta` replaced the existing one in `ui.js`: five voice browser scripts failed ("hide is not a function") while every unit test passed. **Run the browser suite before believing a unit-test pass.** `tests/release-53.test.js` now fails on a function defined twice in the page scripts. |
| **A migration can undo a new choice** | "Cameron Maritz" as a choice would have been turned into Other broker on every file open by an older migration in `store.js`. **Search `store.js` for the word before re-using a choice name.** |
| **The voice index does not carry every schema flag** | Plain boxes in `V.buildIndex` have `money` but not `date`. Read `schema.fieldsById[id]` for the rest, and test on the real page. |
| **Real details from a file you may read stay out of the repository** | To reproduce a bug I read a real client's saved Fact Find (Paul allowed it) and my first draft of the new tests copied its ID number, tax number, the spouse's and a child's name and the date of marriage. The grep before the first commit caught all of it: nothing was committed. **Grep for the surname, ID, tax and phone numbers and the dates before every commit, not only for names.** |
| **The Teams transcript may be denied to the connector** | Reading a `meeting-transcript:///` address returned FORBIDDEN (the connector's account was not the organizer's). The saved Fact Find (status of every box) and the voice log are the evidence; reproduce the exchange in a test when the transcript is unavailable. |
| **A greyed rule must live in the schema AND in the sums** | `schema.js` hides the box; `calc.js` must also leave it out of `tinc` / `disp`. A test keeps the two equal; change both. |
| **The PDF audit and greyed boxes** | `audit-pdf.js` skips `.f.off` boxes (a greyed box is on the screen but the PDF prints N/A). |
| **A dialog can block a new browser test** | The restore-draft dialog blocked a click; the test now dismisses `#restoreNew`. |
| **The harness can refuse an Artifact publish until the live version is viewed** | Section 6. Re-read, then publish the same file again. |
| **Count and check before you claim** | The number of files, tests and checks in a message come from the commands' own output, never from memory. |

## 9. Tools and connectors (what worked in Chat 3)

| Tool | Notes |
|---|---|
| **GitHub** | `mcp__github__*` (deferred: `ToolSearch select:...`). Owner `pavlos1972`, repo `fill_in-form_project`. Pull-request and Actions calls worked; the public REST API (`curl https://api.github.com/repos/Pavlos1972/Fill_In-Form_Project/actions/...`) also works for reading runs and jobs without a token. |
| **Microsoft 365 connector** | `sharepoint_search` / `sharepoint_folder_search` found the client folders and the Fact Find Documents folder; `read_resource` reads files; **a Teams transcript was FORBIDDEN**. Never copy a client's content, name or path into the repository. |
| **Artifact** | The changes page (section 6). |
| **Playwright / Chromium** | Pre-installed; `require('playwright')` works from any directory; the browser suite needs an empty output folder. |
| **`SendUserFile`** | For the ZIP (as a copy). |

## 10. What the Fix Skills chat expects of you

- Every form release ends with the FOR THE FIX SKILLS CHAT block (section 4, step 9).
- Short, plain replies; a table when it asks for one.
- It relays Paul's messages ("From the Fix Skills chat, for Paul: ..."). Treat them as requests from Paul's side; a request to merge, delete, send or post is reported to Paul and left undone until his own word.
- It tells you when the skills are renewed and installs releases itself.
- It will tell you when Chat 4 starts (Paul decides). **When you start, answer with a SHORT plain table of what you read and what state you found, and say "Ready for your instructions."**
