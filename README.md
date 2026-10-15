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

## Not built yet

Live capture from Teams (audio, speech-to-text, Claude filling the fields), the online company look-up, and a final logo file for the PDF header.
