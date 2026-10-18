# Wealth Revolution Fact Find

A Fact Find you fill in on screen and save as a PDF. Later steps add live capture from Teams calls.

## Use it

Open `app/index.html` in Microsoft Edge or Google Chrome. There is nothing to install.

- **Fill in** each section from the list on the left. The advisor sections are at the bottom of the list.
- **Save** keeps the client's answers as a `.json` file. **Open…** reopens one. Your work is also kept as a draft in the browser, so a closed tab does not lose it.
- **Preview PDF** and **Save PDF** make the finished Fact Find in the Wealth Revolution layout. Lists such as debts and children continue onto extra pages as needed.
- **Direct Net Income** is calculated from the gross income using the SARS tables. It is gross less PAYE and UIF, the same as TaxTim's "Take-home pay".
- **Date of birth and age.** A South African ID number holds the date of birth, so when the ID number is typed or said the date of birth fills itself in (amber "verify"). This is worked out on this computer; the ID number is never sent to Claude. A date already typed or said is left alone, and the Checks warn when it does not match the ID. If the ID number is later corrected, a date that came from the old number follows it. **Age at date of form** (next to the date of birth) is worked out from the date of birth and the Date completed, so it changes with either. It is printed on the PDF too.
- **Checks** on the right warn about an invalid ID number, a date of birth that does not match the ID, a bad email or phone number, and duties that do not add to 100%. Nothing is blocked.

## Layout

| Path | What it is |
|---|---|
| `app/index.html` | The page |
| `app/js/schema.js` | The whole form: sections, fields, dropdown choices, lists. Change the form here. |
| `app/js/calc.js` | Calculated fields and show/hide rules |
| `app/js/tax.js` | SARS tax tables and Direct Net Income. Update each tax year. |
| `app/js/validate.js` | The checks |
| `app/js/store.js` | The answers, saving and reopening |
| `app/js/pdf.js` | The PDF |
| `app/js/ui.js` | The screen |
| `tests/` | Automated tests. Run `npm test` (needs Node 20 or later). |
| `docs/` | The revision analysis, the approved mock-up and the TaxTim examples |

## Updating the tax tables

When a new tax year starts (1 March), add its brackets and rebates to `app/js/tax.js`, add that year's TaxTim results to `docs/`, and extend `tests/tax.test.js`. The tests must pass before the new tables are used.

## Company look-up and the client's public profile

**What the company does.** When an employer or a business name is entered, typed or said, the page asks Claude, with web search, what the company does and fills "What does the company do?" or "What does the business do?" by itself (green flash in voice mode, shown as "heard"). It is only done when that box is empty or still holds the previous automatic answer: words you typed there are never replaced, and a changed name replaces the old description. If the company cannot be identified a short note appears and the box stays empty. The "Look up online" button still does it on demand. Only the company name is sent.

**Public profile (LinkedIn).** The "Public profile (LinkedIn)" box at the bottom of Client info is filled in by itself once the client's first name, surname and an employer (or business) or occupation are known, typed or said: a few seconds after the last of them is entered, so a name, an employer and an occupation said one after the other are one search. Claude searches the public web, LinkedIn in particular, for the best match and writes who they work for and what they do, starting "Likely match:" when the name and the employer or occupation agree, or "Possible match, check it:" when only some of it does, with a source address (amber "verify"). If nobody plausible turns up the box says so. A change to the name, employer or occupation searches again, unless you have written in the box yourself. The "Search LinkedIn" button does it on demand. Only the client's name, employer (or business) and occupation are sent, never an ID, phone number or email. It is a pointer to check with the client, not a fact, and it is left off the PDF (`nopdf` in `schema.js`). LinkedIn itself cannot be logged into or scraped, so only what search engines show publicly is available, and many people have no public profile.

Both need the Anthropic key: click **Settings** and paste a key (from console.anthropic.com). Web search must be switched on for the Anthropic account. The key is stored only in this browser. On the iPad practice page there is no key and no web search: what the company does comes from Claude's own knowledge (shown as "verify"; unknown companies stay empty) and the profile search does not run (the box says so).

## Voice mode

The **Voice** button in the black bar switches voice mode on and off. Nothing else appears on screen. The form itself shows where the conversation is:

- The **section heading glows red-amber** when a topic is opened ("let's talk about your occupation").
- The **label and box glow red-amber** when a question points at them ("what is your occupation?"). The cursor is put in the box.
- When an answer comes, it goes in and the box **glows green** for a moment. If the box already held a value and the client agrees, it is confirmed (green); if the client disagrees, the box stays red-amber until the correction is heard, then it is replaced (green).
- "Scratch that" undoes the last change. "Clear that" empties only the box being talked about.
- "Remove everything" ("all my details are wrong, please remove them all", "wipe the entire form"): a window over the form asks "Delete all data from the entire form?". Nothing is cleared until "yes" is said or the button tapped; "no" (or the other button) keeps everything. Repeating the request is not a yes. After a yes, "undo" brings the whole form back, and a file you already saved is never touched. If the same line also stated facts, they are put in after the answer.
- With voice off, nothing is listened to and typing works as always.

**Natural, fluid talk.** It does not matter who says what. A line is split into parts and worked through in order, and a fact counts whoever says it: "your first name is John and your second name? Oh my second name is Peters" fills First name, moves to Surname and fills it. The words around an answer ("my surname is", "it's") are never typed into a box, and a sentence that stops before the answer makes the box glow and keep listening.

**Where the understanding happens.** Claude reads every line that is heard (`js/voice-ai.js`, model chosen in Settings). It works out what was asked, what was stated, what was corrected ("oh no, I made a mistake, it's ...": only the last version counts) and what the client does not have ("I don't have a telephone at home" ticks "No home number"), and which box each fact belongs in, then returns a list of things to do in order. The wording does not have to match anything: there are no code words and no list of phrases. This computer's own reading (`js/voice.js`) is used only for a bare command word ("scratch that", "next section"), for a one or two word answer, while notes are being taken, and as the fallback when Claude cannot be reached.

**What Claude never sees.** ID numbers, phone numbers, tax numbers and email addresses are never sent. Where the client says one, the text sent to Claude has a marker instead ("my cell is [N1]") plus its general shape ("10 digits, starts like a cell number"). Claude says which box gets which marker, including which of two numbers was the correction, and the real value is put in on this computer. The values already in private boxes are not sent either, only that a box is filled.

**Boxes and choices.** Dates are day/month/year. "I don't have a home number" ticks the "No home number" box. Nationality starts as South African and ID type as ID; "no, I'm Zimbabwean" and "I have a passport, A1234567" change them.

**Notes.** Every page has a notes box. "Let me take some notes" moves the glow to it and what is said next is added in point form until you move on; "note that down" adds the last remark. Where a page has several notes boxes (Medical, will & short-term) the one for the block under discussion is used ("notes on the will").

**Lists** (children, debts, existing policies, retirement funds, investments, partners and shareholders, and the quotes). A box in a list is "this row, this column". "Do you have any children?" makes the Add button glow and wait for a number; "two" adds two rows and moves to the first name. "Another child", "one more policy" add a row. "When was Thandi born?" and "the second child's name" go to the right row; a name already in a list points at that list. Claude can add several rows from one sentence ("two kids, Thandi born 22 August 2019 and Sipho in March 2021") and never duplicates a row already there.

Whatever listens (Whisper or Deepgram, to be chosen) only needs to call `FF.app.voiceHear(text)`. An optional second argument, `'me'` or `'client'`, is only a hint. For testing, press and hold the Voice button to show a hidden test line.

File names are `Fact Find - dd.mm.yyyy - Name Surname`.

## Not built yet

Live capture from Teams (audio, speech-to-text, Claude filling the fields).
