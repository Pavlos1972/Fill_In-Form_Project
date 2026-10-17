# Wealth Revolution Fact Find

A Fact Find you fill in on screen and save as a PDF. Later steps add live capture from Teams calls.

## Use it

Open `app/index.html` in Microsoft Edge or Google Chrome. There is nothing to install.

- **Fill in** each section from the list on the left. The advisor sections are at the bottom of the list.
- **Save** keeps the client's answers as a `.json` file. **Open…** reopens one. Your work is also kept as a draft in the browser, so a closed tab does not lose it.
- **Preview PDF** and **Save PDF** make the finished Fact Find in the Wealth Revolution layout. Lists such as debts and children continue onto extra pages as needed.
- **Direct Net Income** is calculated from the gross income using the SARS tables. It is gross less PAYE and UIF, the same as TaxTim's "Take-home pay".
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

## Company look-up

The "Look up online" button next to "What does the company do?" asks Claude, with web search, for a short description. Click **Settings** and paste an Anthropic API key (from console.anthropic.com). Web search must be switched on for the Anthropic account. The key is stored only in this browser.

## Voice mode

The **Voice** button in the black bar switches voice mode on and off. Nothing else appears on screen. The form itself shows where the conversation is:

- The **section heading glows red-amber** when a topic is opened ("let's talk about your occupation").
- The **label and box glow red-amber** when the adviser's question points at them ("what is your occupation?"). The cursor is put in the box.
- When the client answers, the answer goes in and the box **glows green** for a moment. If the box already held a value and the client agrees, it is confirmed (green); if the client disagrees, the box stays red-amber until the correction is heard, then it is replaced (green).
- "Scratch that" undoes the last change. With voice off, nothing is listened to and typing works as always.

Simple wording is understood on this computer (`js/voice.js`). Looser wording and long answers are sent as text to Claude (`js/voice-ai.js`, model chosen in Settings). ID numbers, phone numbers and email addresses are never sent: those fields are left out and any long number or email in the text is blanked. Those fields are filled on this computer only.

Whatever listens (Whisper or Deepgram, to be chosen) only needs to call `FF.app.voiceHear(text, who)`, where `who` is `'me'` (the adviser) or `'client'`. For testing, press and hold the Voice button to show a hidden test line (type `client: ...` for the client's side).

## Not built yet

Live capture from Teams (audio, speech-to-text, Claude filling the fields).
