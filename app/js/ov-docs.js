/* The Client Overview's documents (stage 4): a document is sorted into its block by its name, read (only when the adviser has switched reading on: it sends the document to Anthropic, so it is OFF until then) and
   what was read is put into the overview as rows that are amber "to check", each with the file it came from. With reading off the document is only recorded (and a quote started from the number and the date in
   its file name), and the figures are typed from it. Blocks 1, 3 and 8 follow the Fact Find: a document fills the details of an item that is already there and never adds or removes one.
   Everything read is a suggestion: nothing is ever marked "checked" here (docs/OVERVIEW-DATA-CONTRACT.md section 2). Loads in the browser (window.OV.docs) and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'), require('./ov-schema.js'), require('./ov-calc.js'), require('./ov-store.js'));
  else { root.OV = root.OV || {}; root.OV.docs = factory(root.FF.util, root.OV.schema, root.OV.calc, root.OV.store); }
})(typeof self !== 'undefined' ? self : this, function (util, schema, calc, store) {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages', API_VERSION = '2023-06-01';
  var BLOCK_LABEL = { followup: 'Follow-Up Summary Notes', policies: 'Current policies', fna: 'FNA quote', group: 'Group benefits', shortfallQuote: 'Shortfall quote', reduced: 'Reduced quote', comparative: 'Comparative quote', investments: 'Current investments', astute: 'Astute report', cmp: 'Change moment pay-out guide', proposed: 'Proposed investment', goals: 'Goal analysis report', other: 'Legacy protection plan', bremail: 'BrightRock email', counterletter: 'Counter offer letter', uwemail: 'Underwriter\'s e-mail' };
  var QUOTE_OF = { fna: 'fna', shortfallQuote: 'shortfall', reduced: 'reduced', comparative: 'comparative' };

  /* ---------- sorting a document by its name ---------- */
  function two(n) { return (n < 10 ? '0' : '') + n; }
  /* The block a file belongs to, and what its name says: the quote number (6 to 12 digits), the date (dd.mm.yy). Returns null when the name does not say. */
  /* 1.7 (Paul, 25 November 14:55: "a mix"): a Review or Servicing folder directly inside a policy folder holds new review quotes AND paperwork about the change. A document there is a quote only when its NAME says so (a quote, a proposal, FNA, shortfall, reduced, a CP number);
     never a letter, a signed or accepted copy, an SROA or ROA, a premium increase, a schedule, an application, a form, a consent or the owner's manual. */
  var PAPERWORK = /signed|accept|letter|sroa|(^|[^a-z])roa([^a-z]|$)|premium increase|manual|owner|schedule|change ?of ?details|plan details|application|cancel|consent|terms|conditions|notice|invoice|receipt|e-?mail/;
  var QUOTEISH = /quote|proposal|illustration|(^|[^a-z])fna([^a-z]|$)|shortfall|reduced|(^|[^a-z])cp[\s_#:-]*\d{6,12}/;
  function reviewSegs(dirPath) { return String(dirPath == null ? '' : dirPath).split(/\s*\\\s*/).filter(Boolean); }
  function inReviewOrServicing(dirPath) { return reviewSegs(dirPath).some(function (g) { return /review|servic/i.test(g) && !/schedule|statement|valuation/i.test(g); }); }
  /* True for a document in a Review or Servicing folder whose name says it is paperwork about a change (never a quote): the list says so. */
  function reviewPaperwork(fileName, dirPath) { var low = String(fileName == null ? '' : fileName).replace(/\.[A-Za-z0-9]{2,5}$/, '').toLowerCase(); return inReviewOrServicing(dirPath) && PAPERWORK.test(low); }
  function classify(fileName, dirPath) {
    var n = String(fileName == null ? '' : fileName).replace(/\.[A-Za-z0-9]{2,5}$/, ''), low = n.toLowerCase(), m, date = '', number = '';
    if ((m = /(\d{6,12})/.exec(n))) number = m[1];
    if ((m = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})(?!\d)/.exec(n))) { var y = +m[3]; if (y < 100) y += 2000; date = two(+m[1]) + '/' + two(+m[2]) + '/' + y; }
    var block = null, viaReview = false;
    if (/\.(eml|msg)$/i.test(String(fileName)) || (/\.txt$/i.test(String(fileName)) && /e-?mail|brightrock|\d{6,}/.test(low)) || /e-?mail/.test(low)) block = 'bremail';              // BrightRock's e-mail with the figures a quote does not print (round 4)
    else if (/cmpo|change[ _-]?moment/.test(low)) block = 'cmp';
    else if (/follow[ _-]?up|summary[ _-]?notes/.test(low)) block = 'followup';                           // the Follow-Up Appointment Summary Notes of a later meeting (2. Fact Find folder)
    else if (/rgar|egar|goal[ _-]?analysis|goal[ _-]?report|retirement goal|education goal/.test(low)) block = 'goals';
    else if (/(^|[^a-z])fna([^a-z]|$)/.test(low)) block = 'fna';
    else if (/shortfall/.test(low)) block = 'shortfallQuote';
    else if (/reduced/.test(low)) block = 'reduced';
    else if (/astute/.test(low)) block = 'astute';
    else if (/group|funds ?at ?work|benefit statement|membership certificate|certificate|provident|pension|preservation/.test(low)) block = 'group';          // a provident, pension or preservation fund statement is a group-block document (Paul, 25 November)
    else if (/(optimal|tax[ _-]?free|retirement annuity|endowment|unit trust|living annuity|investment).*(quote|proposal|illustration)|(quote|proposal|illustration).*(optimal|tax[ _-]?free|retirement annuity|endowment|living annuity)/.test(low)) block = 'proposed';
    else if (/(momentum|sanlam|discovery|liberty|old mutual|hollard|assupol|metropolitan|absa|bidvest|clientele).*(quote|proposal|illustration)|comparative/.test(low)) block = 'comparative';
    else if (/schedule|policy|(^|[^a-z])ps([^a-z]|$)/.test(low)) block = 'policies';
    else if (/(liberty|momentum|sanlam|discovery|old mutual|hollard|assupol|metropolitan|clientele|bidvest|generali|santam).*(protector|lifestyle|life plan|life cover|plan|cover|benefit)/.test(low)) block = 'policies';          // an insurer's product name
    else if (/investment|s(a)?tatement|(^|[^a-z])(ra|irr|is)([^a-z]|$)|retirement annuity|tax.?free|endowment|unit trust|fund value/.test(low)) block = 'investments';          // "satatement" is how one real file spells it; IRR is an investment report, IS an investment statement
    if (!block && dirPath) {                                                                                 // the name does not say: the folder it sits in does (6. Policy Schedules, the Astute folder)
      var dl = String(dirPath).toLowerCase();
      if (/polic(y|ies)[ _-]*schedule|(^|[^a-z])schedules?([^a-z]|$)/.test(dl)) block = 'policies'; else if (/astute/.test(dl)) block = 'astute';
    }
    if (dirPath && (block === 'investments' || block === 'policies')) {                                       // round 1.5: a quote is never a CURRENT investment or policy because its name has no "quote" in it: a file inside a folder called Comparative Quotes, Quotes or Quotes (Accepted) stays a quote
      var segs = String(dirPath).split(/\s*\\\s*/);
      if (segs.some(function (g) { return /^(\d+\.\s*)?comparative quotes?(\s*\(.*\))?$/i.test(g.trim()); })) block = 'comparative';
      else if (segs.some(function (g) { return /^(\d+\.\s*)?(accepted )?quotes?(\s*\(.*\))?$/i.test(g.trim()); })) block = block === 'investments' ? 'proposed' : 'comparative';
      /* (a Review or Servicing folder: handled below, 1.7) */
    }
    if (dirPath && inReviewOrServicing(dirPath)) {                                                              // 1.6 and 1.7: a document in a folder named Review or Servicing
      var rsegs = reviewSegs(dirPath);
      if (PAPERWORK.test(low)) block = null;                                                                  // never a quote: a letter, a signed or accepted copy, an SROA, a schedule, the owner's manual ...
      else if (rsegs.length > 1 && !/^\d+\.\s/.test(rsegs[0].trim()) && QUOTEISH.test(low) && (!block || block === 'investments' || block === 'policies')) block = 'comparative';          // directly inside a policy folder: its name says it is a quote, so it is a quote (of the policy's review)
      else if (block === 'investments' || block === 'policies') { block = 'comparative'; viaReview = true; }          // its name says investment or policy and nothing says quote: listed as a comparative quote by its folder, NOT ticked (an RA Review, a Review Valuation)
    }
    return block ? { block: block, number: number, date: date, label: BLOCK_LABEL[block], viaReview: viaReview } : null;          // viaReview: it is a comparative quote only because it sits in a Review folder (its name says investment or policy): listed as one, NOT ticked (1.6)
  }
  /* The items of an overview (this one, or a saved one read from its .json) the policy folders are compared with: current policies (block 1), current investments (block 6), the provident and pension funds of the group block (kind 'group') and the legacy protection plan of
     block 11 (kind 'legacy', only once the Fact Find says the client has one). A folder's statement goes to the block of the item it is compared with (Paul, 25 November). Returns [{ kind: 'policies' | 'investments' | 'group' | 'legacy', who, product, no, ref }]. */
  function comparableItems(st) {
    var B = (st && st.blocks) || {}, out = [], list = function (b) { return (B[b] && B[b].items) || []; };
    list('policies').forEach(function (i) { if (i && !i.removed) out.push({ kind: 'policies', who: String(i.insurer || ''), product: String(i.product || ''), no: String(i.policyNo || ''), ref: i }); });
    list('investments').forEach(function (i) { if (i && !i.removed) out.push({ kind: 'investments', who: String(i.provider || ''), product: String(i.product || ''), no: String(i.policyNo || ''), ref: i }); });
    list('group').forEach(function (i) { if (i && !i.removed && /provident|pension/.test(String(i.kind || ''))) out.push({ kind: 'group', who: String(i.provider || ''), product: String(i.kind || ''), no: '', ref: i }); });                       // a provident or pension fund: a statement goes to the group block
    list('other').forEach(function (i) { if (i && i.key === 'legacy' && (String(i.company || '').trim() || i.wr)) out.push({ kind: 'legacy', who: String(i.company || ''), product: 'legacy', no: String(i.policyNo || ''), ref: i }); });          // the legacy protection plan of block 11, once the Fact Find says the client has one
    return out;
  }

  /* ---------- reading with Claude (only when switched on) ---------- */
  var RULES = 'Answer with ONE JSON object and nothing else. Amounts are plain numbers in rand (no R, no spaces, no commas); percentages are plain numbers (10 means 10%); dates are dd/mm/yyyy. Copy only what the document says: if you cannot find ' +
    'a figure, write null, never a guess. Write "N/A" only where the document marks a cell as not applicable. Do not add, work out or round anything.';
  var LINE = '{ "type": "household" | "child" | "debt" | "death" | "dread" | "other", "label": "text", "term": "text as printed", "name": "child first name", "sname": "child surname", "debt": "debt name as printed", "bank": "bank", "accelerated": true | false | null, ' +
    '"life": { "lump": n, "monthly": n }, "sev": { "lump": n }, "lsd": { "lump": n, "monthly": n }, "ip": { "monthly": n }, "waiting": "text as printed", "abi": n | "Not found" }';
  var SPECS = {
    quote: 'This is an insurance quote (BrightRock or another insurer). Return { "insurer": "text", "number": "the quote or CP number as printed", "date": "dd/mm/yyyy", "rates": "e.g. Non-smoker rates", "aci": n (the yearly premium increase as a number), "aciText": "the yearly premium increase EXACTLY as the quote words it, for example 7.5% + age rater, or CPI + 2%; null when the quote only gives a figure", "premium": n (the total monthly premium), ' +
      '"abi": n (only when the quote prints ONE annual benefit increase for the whole quote), "servicing": true | false (true when the quote is for a policy the client already has, a review or servicing quote; false for new business), "disabilityAge": n (the age lump sum disability and the income protector run to), "lines": [ ' + LINE + ' ], "printedTotals": { "life": { "lump": n, "monthly": n }, "sev": { "lump": n }, "lsd": { "lump": n, "monthly": n }, "ip": { "monthly": n } } }. ' +
      'Each need (household, each child, each debt, death-related needs, additional expense needs / dread) is one line; the monthly figure printed under a lump sum is "monthly". A child line has the child\'s name and surname; a debt line the debt\'s name and the bank. ' +
      'For a household, child or death-related line give the lump sum in life.lump and, in life.monthly, the INCOME PORTION p.m. printed with it (0 when the lump sum is 0). For a debt line give the debt cover in life.lump and the debt\'s MONTHLY INSTALMENT in life.monthly. The additional expense needs (dread) line has ONLY a severe illness amount, in sev.lump: leave its life cover empty. ' +
      'A debt line has ONE instalment: give it in life.monthly AND, when the quote prints it, in lsd.monthly too (the same figure). For another insurer\'s quote whose ACI wording is long, also give "aciPoints": ONE to THREE very short points (at most 40 characters each); never a paragraph. ' +
      'Never copy a figure from anywhere but the quote; write null for a figure the quote does not print. ' +
      'EVERY need line (household, each child, each debt, death-related needs, additional expense needs / dread) says whether its cover is ACCELERATED ("accelerated": true: it is paid out of, and reduces, the life cover) or STANDALONE ("accelerated": false: a separate benefit on top of the life cover); BrightRock prints it in brackets after the need\'s name, for example HOUSEHOLD (Standalone), CHILD CARE - name (Standalone), DEATH RELATED NEEDS (WOL - Standalone), ADDITIONAL EXPENSE NEEDS (DREAD) (Standalone): copy it exactly; when the quote does not say, write null. ' +
      'EVERY line has its own "abi": the annual benefit increase (annual base increase) of that need, as a number. BrightRock prints it for each need, or once for the whole quote: when it is printed once, copy it onto every line it covers (and also give it as "abi" of the quote). ' +
      'When the quote prints no annual benefit increase for a line, write "Not found" in that line\'s "abi", never null. Severe illness has an amount only on the lines where the quote gives one (the additional expense needs line); leave it null on the others. ' +
      'For a quote that does not list needs separately (other insurers), give one line of type "other" for each benefit with its label. printedTotals is only what the document itself prints as totals; leave it null if it prints none. ' +
      'A quote\'s own Underwriting terms grid (additional charge, exclusions) is never read here: loadings and exclusion numbers come from the insurer\'s counter offer letter only.',
    policy: 'This is a policy schedule from ANY insurer. Return { "insurer": "text", "product": "text", "policyNo": "text", "doc": "dd/mm/yyyy (date of commencement)", "premium": n (monthly), "aci": n, "aciText": "the yearly premium increase exactly as the schedule words it, or null when it only gives a figure", "abi": n, "ipAge": n, "benefits": { "life": "...", "sev": "...", "lsd": "...", "ip": "..." }, "lines": [ ' + LINE + ' ] }. ' +
      '"aciPoints" is the yearly premium increase in ONE to THREE very short points, at most 40 characters each, the gist only (for example "Reviewed yearly after year 1", "Extra cover priced pro rata"); NEVER a paragraph; null when the schedule only gives a percentage. ' +
      'The four "benefits" are a very short description of each benefit, read from the schedule, for ANY insurer: ONE or TWO short lines each (about 60 characters), no amounts, null for a benefit the policy does not have. ' +
      'Life cover: whole of life or term, and to what age. Severe illness: the product name and type (for example Living Lifestyle Plus), standalone or accelerated, a top-up and an extended option if there are any, whole of life. ' +
      'Lump sum disability: the product name (for example Absolute Protector Plus), OOD (own occupation) or AOD/OD, accelerated or standalone, to what age (for example 65). ' +
      'Income protector: for example payable for the first 24 months, or after 24 months to age 65, with the waiting period. Say only what the schedule says. ' +
      'The need-by-need lines (types household, child, debt, death, dread) belong ONLY to a BrightRock policy: for a BrightRock policy give one line for each need. For EVERY OTHER insurer (Liberty, Discovery, Old Mutual, Momentum, Sanlam, Hollard ...) a policy is ONE row with its benefits: give exactly ONE line of type "other", labelled with the product name, whose "life", "sev", "lsd" and "ip" cells hold the amounts of that policy\'s benefits (the lump sums, and the income protector a month). ' +
      'NEVER use the types household, child, debt, death or dread for a policy that is not BrightRock, whatever the schedule lists.',
    group: 'This is a group risk benefit statement or a pension / provident fund statement. Return { "provider": "text", "statementDate": "dd/mm/yyyy", "basis": "e.g. 1.5 x insurance salary", "paidBy": "employer" | "employee" | "both" | null, "monthlyCost": n, "ipWaiting": "text", "aci": n, "abi": n, ' +
      '"life": { "amount": n, "endAge": "age or Whole of life as printed" }, "sev": { "amount": n, "endAge": "..." }, "lsd": { "amount": n, "endAge": "..." }, "ip": { "amount": n (a month), "endAge": "..." }, "value": n (fund value), "employer": n (a month), "employee": n (a month) }. ' +
      'Write "Not found" in endAge when the statement does not give the age a benefit ends.',
    investment: 'This is an investment or retirement annuity statement or schedule. Return { "provider": "text", "product": "text", "policyNo": "text", "valueDate": "dd/mm/yyyy", "valueKind": "schedule", "gross": n (fund value), "penalty": n (Section 14 transfer penalty), "returnRate": n (since inception), "aci": n (the yearly contribution increase; write "Not found" if the schedule does not give it), "monthly": n (the monthly premium or contribution) }.',
    astute: 'This is an Astute report. Return { "reportDate": "dd/mm/yyyy", "investments": [ { "provider": "text", "product": "text", "policyNo": "text", "gross": n, "monthly": n, "page": n } ], ' +
      '"policies": [ { "insurer": "text", "product": "text", "policyNo": "text", "doc": "dd/mm/yyyy (date of commencement)", "premium": n (monthly), "life": n (life cover amount), "sev": n (severe illness amount), "lsd": n (lump sum disability amount), "ip": n (income protector, a month), "waiting": "text as printed", ' +
      '"aci": n, "aciText": "the yearly premium increase as the report words it, or null", "abi": n, "ipAge": n, "benefits": { "life": "...", "sev": "...", "lsd": "...", "ip": "..." }, "page": n } ], ' +
      '"group": [ { "provider": "text", "kind": "risk" | "pension" | "provident", "life": { "amount": n, "endAge": "age or Whole of life as printed" }, "sev": { "amount": n, "endAge": "..." }, "lsd": { "amount": n, "endAge": "..." }, "ip": { "amount": n (a month), "endAge": "..." }, "value": n (fund value), "employer": n (a month), "employee": n (a month), "page": n } ] } ' +
      'with every investment and retirement annuity, every risk policy of the client (life cover, severe illness, lump sum disability and income protector: the cover amounts the report prints for each policy) and every group risk, pension or provident fund benefit in it. ' +
      '"page" is the page of THIS PDF file on which that item is listed (the first page of the file is 1), or null when you cannot tell. Copy only what the report prints; write null for anything it does not.',
    proposal: 'This is a quote or proposal for an investment (a retirement annuity, a tax-free investment, an endowment, unit trusts, a Section 14 or pension / provident fund transfer, a living annuity). Return { "provider": "text", "type": "Tax-free investment" | "Retirement annuity (RA)" | "Endowment" | "Unit trusts (open-ended)" | "Section 14 transfer" | "Pension / provident fund transfer", "number": "the quote number as printed", ' +
      '"contribution": "lump" | "monthly" | "both" | "transfer", "lump": n (a lump sum), "monthly": n (the monthly premium), "boostPct": n (the boost or bonus on the contribution as a percentage, only if printed), "netInvested": n (the net amount invested after charges and boost, only if printed), "aci": n (the yearly contribution increase) }.',
    goal: 'This is a Retirement Goal Analysis Report (RGAR) or an Education Goal Analysis Report (EGAR). Return { "kind": "rgar" | "egar", "note": "a short reason, only if the report says it could not be done or is not applicable, else null", "currentValuePm": n (the current value in rand a month, gross), "futureValuePm": n (the future value in rand a month, gross), "aci": n, "premium": n (the monthly premium) }.',
    ffnotes: 'These are the notes a South African financial adviser typed on a Fact Find about a client\'s medical aid, gap cover, will (the legacy protection plan may be mentioned there) and short-term insurance. Return { "items": { "medical": { "company": "text", "product": "text", "premium": n (a month) }, "gap": { ... }, "will": { ... }, "legacy": { ... }, "shortterm": { ... } } }. ' +
      'Copy ONLY what the notes say about each cover (the company or insurer, the product or plan, the monthly premium as a number); write null for anything they do not say, and leave a cover out when the notes say nothing about it. Never guess.',
    bremail: 'This is an e-mail from BrightRock (or a copy of one) about quotes it prepared for a client. Return { "quotes": [ { "number": "the CP or quote number the e-mail names for that quote, as printed", "kind": "fna" | "shortfall" | "reduced" | null, "deathIncomePortion": n (the income portion per month of the death-related needs of THAT quote, a plain number), "note": "text or null" } ] }. ' +
      'Give one entry for every quote the e-mail states a death-related income portion for; copy the figure exactly as the e-mail states it; write null when the e-mail does not give it for a quote; never work anything out and never guess.',
    followup: 'These are Follow-Up Appointment Summary Notes written after a later meeting with a client of a South African financial adviser. Return { "date": "dd/mm/yyyy (the date of the meeting or of the notes)", "items": { "medical": "...", "gap": "...", "will": "...", "legacy": "...", "shortterm": "..." } }. ' +
      'Each item is ONE short sentence (up to about 160 characters) saying what has progressed or is still outstanding for that cover since the Fact Find, in the notes\' own words, for example: Capital Legacy to call to amend the will; everything sent to Cameron, feedback awaited; short-term R 2,539 p.m. split. ' +
      'medical = medical aid, gap = gap cover, will = the will, legacy = the legacy protection plan, shortterm = short-term insurance. Write null for an item the notes say nothing about. Never guess, never copy anything that is not about that item.',
    counterletter: 'This is an insurer\'s COUNTER OFFER LETTER, sent after underwriting when the client accepted a quote and the insurer came back with loadings or exclusions (for BrightRock the file is called "<Name>\'s cover terms (Cover Proposal <original number> <revised number>)"). ' +
      'Return { "originalNumber": "the original Cover Proposal or quote number as printed", "revisedNumber": "the revised Cover Proposal or quote number as printed", "origPremium": n (the original monthly premium), "revPremium": n (the revised monthly premium), "startDate": "dd/mm/yyyy (the revised policy start date)", ' +
      '"expires": "dd/mm/yyyy (the date the revised proposal expires) or null", "termsPage": n (the page of THIS PDF file that holds the grid of underwriting terms, the first page of the file is 1), "exclusionsPage": n (the page of THIS PDF file that lists the cover exclusions) or null, ' +
      '"cells": [ { "need": "needs" | "dread", "column": "recover" | "permanent" | "death", "decision": "the decision as printed, for example Accepted, Declined", "loading": n (the premium loading in percent, or null when there is none), "exclusions": [ "the exclusion numbers printed in that cell, as printed, for example 4*" ], "reduced": true | false } ], ' +
      '"exclusions": [ { "no": "the exclusion number as printed, for example 4*", "type": "the type as printed, for example Medical", "what": "what it means, copied in the insurer\'s own words", "page": n } ], "notes": "anything else the letter says about a declined or reduced cover or a condition, in one or two short sentences, or null" }. ' +
      'The grid\'s ROWS are the need groups: "needs" = cover for household, childcare, healthcare, debt and death-related needs; "dread" = cover for additional expense needs. Its three COLUMN GROUPS are: "recover" = cover that you can recover from; "permanent" = cover that is permanent; "death" = cover that is caused by death. ' +
      'Give one cell for each row and column group the letter prints. Copy every number exactly as printed; write null for anything the letter does not print; never work anything out and never guess. ' +
      'The text of a BrightRock PDF can show the two letters "ti" as odd characters (for example "underwri?ng"): write them as "ti". The exclusion number (for example 4*) can be printed in the middle of the paragraph that explains the exclusion: it is never part of the wording, leave it out of "what". ' +
      'Read the loadings, the exclusion numbers and the premiums from THIS letter only.',
    uwemail: 'This is an e-mail (or a copy of one) from an insurer\'s underwriters to a financial adviser, explaining why underwriting added a loading to the premium, or an exclusion to the cover, of a client\'s quote. Return { "subject": "the subject line", "from": "the sender\'s name as printed", "date": "dd/mm/yyyy (the date the e-mail was sent)", ' +
      '"numbers": [ "every CP or quote number the e-mail names, as printed" ], "reason": "the underwriters\' reason for the loading or loadings, in ONE or two short sentences in their own words (for example: raised blood pressure at the medical)", "kind": "medical" | "occupational" | "other" | null }. ' +
      'A BrightRock reply states the reason in ONE paragraph that starts "Our decision is based on the information we received -" and ends before "Here\'s a summary of the terms we offered": return exactly those reasons, without the lead-in; when there is no such paragraph write null for the reason. ' +
      'Write null for anything the e-mail does not say. Copy the reason as the e-mail states it; never work anything out, never guess, and never copy the client\'s ID number, telephone number or e-mail address.',
    cmp: 'This is a BrightRock change moment pay-out guide. Return { "number": "the CP number", "activationDate": "dd/mm/yyyy", "reason": "BrightRock\'s reason, only if it gives no pay-out, else null", "rows": [ { "key": "total" | "retirement" | "childcare" | "child", "name": "child first name", "sname": "child surname", "today": n, "projected": n, "payoutDate": "dd/mm/yyyy" or null } ] }.'
  };
  var SPEC_OF = { fna: 'quote', shortfallQuote: 'quote', reduced: 'quote', comparative: 'quote', policies: 'policy', group: 'group', investments: 'investment', astute: 'astute', cmp: 'cmp', proposed: 'proposal', goals: 'goal', other: 'policy', followup: 'followup', ffnotes: 'ffnotes', bremail: 'bremail', counterletter: 'counterletter', uwemail: 'uwemail' };
  /* What the Fact Find says about the client's debts and children, for the reading of a quote (the quote often prints no bank or the debt's name): Claude is asked to name each debt line from it. '' when there is nothing. */
  function factNote(state) {
    var f = state && state.factFind && state.factFind.facts; if (!f) return '';
    var debts = (f.debts || []).map(function (d) { return '- ' + [d.desc || d.type, d.prov ? 'bank: ' + d.prov : '', calc.isNum(d.bal) ? 'balance R' + d.bal : '', calc.isNum(d.inst) ? 'instalment R' + d.inst + ' a month' : ''].filter(Boolean).join(', '); });
    var kids = (f.children || []).map(function (c) { return '- ' + [c.name, c.sname].filter(Boolean).join(' '); });
    if (!debts.length && !kids.length) return '';
    return 'The adviser\'s Fact Find for this client lists these debts and children. Match each debt line and child line of the quote to one of them and use their names (and the bank of a debt) where the quote does not print them; do not invent a line the quote does not have.\n' +
      (debts.length ? 'Debts:\n' + debts.join('\n') + '\n' : '') + (kids.length ? 'Children:\n' + kids.join('\n') : '');
  }
  function promptFor(block, ctx) {
    return 'You read insurance documents for a South African financial adviser. ' + RULES + '\n\n' + SPECS[SPEC_OF[block]] + (ctx && ctx.clientNote ? '\n\n' + ctx.clientNote : '');
  }
  /* The first JSON object in the reply (the model may fence it). */
  function parseReply(text) {
    var t = String(text || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Claude did not give anything that could be read.');
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error('Claude\'s answer could not be read as figures. Try again, or type them in.'); }
  }
  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'The API key was not accepted. Check it in the Fact Find\'s Settings.';
    if (status === 413 || /too large|too many pages/i.test(msg)) return 'That document is too big for Claude to read. Type the figures in instead.';
    if (status === 429) return 'Too many requests just now. Wait a minute and try again.';
    return 'Anthropic said: ' + (msg || 'error ' + status);
  }
  /* o: { apiKey, model, fetch, mediaType, base64, block, ctx } -> resolves { data, usage } */
  function readWithClaude(o) {
    var doFetch = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (!o.apiKey) return Promise.reject(new Error('Add your Anthropic API key in the Fact Find\'s Settings first.'));
    if (!SPEC_OF[o.block]) return Promise.reject(new Error('That kind of document cannot be read here.'));
    var kind = /^image\//.test(o.mediaType) ? 'image' : 'document';
    var content = o.base64 ? [{ type: kind, source: { type: 'base64', media_type: o.mediaType || 'application/pdf', data: o.base64 } }, { type: 'text', text: promptFor(o.block, o.ctx) }]
      : [{ type: 'text', text: promptFor(o.block, o.ctx) + (o.text ? '\n\n' + (o.textLabel || 'THE NOTES') + ':\n' + o.text : '') }];                    // the Fact Find's notes are sent as text, no document
    var body = { model: o.model, max_tokens: 8000, messages: [{ role: 'user', content: content }] };
    return doFetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': o.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(friendly(res.status, j));
        if (j.stop_reason === 'refusal') throw new Error('Claude could not read this document.');
        var text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join(' ');
        return { data: parseReply(text), usage: j.usage || null };
      });
    }, function () { throw new Error('Could not reach Anthropic. Check the internet connection.'); });
  }

  /* ---------- putting what was read into the overview ---------- */
  function today() { return schema.todayDMY(); }
  function srcOf(kind, file, date) { return { kind: kind, file: String(file || ''), page: null, date: date || today() }; }
  function n(v) { return store.parseCell(v == null ? '' : (typeof v === 'number' ? String(v) : v), 'money'); }
  function s(v) { return v == null || v === '' ? null : String(v).trim() || null; }
  function dmy(v) { var t = s(v); if (!t) return null; var d = util.parseDate(t); return d ? util.formatDate(d) : t; }
  /* A line as the document gave it: only the known cells, as numbers; anything else is dropped. */
  function line(l, src, o) {
    o = o || {};
    l = l && typeof l === 'object' ? l : {};
    var t = schema.lineTypesById[l.type] ? l.type : 'other', out = store.newLine(t, { label: s(l.label) || schema.lineTypesById[t].l });
    if (s(l.term)) out.term = s(l.term);
    if (t === 'child') { out.name = s(l.name) || ''; out.sname = s(l.sname) || ''; }
    if (t === 'debt') { out.debt = s(l.debt) || ''; out.bank = s(l.bank) || ''; }
    if (['household', 'child', 'debt', 'death', 'dread'].indexOf(t) >= 0) out.accelerated = l.accelerated === true || /^accelerated$/i.test(String(l.accelerated || '')) ? true : l.accelerated === false || /^stand ?alone$/i.test(String(l.accelerated || '')) ? false : null;          // every need line, as the quote prints it in brackets (round 4, fault 11)
    [['life', ['lump', 'monthly']], ['sev', ['lump']], ['lsd', ['lump', 'monthly']], ['ip', ['monthly']]].forEach(function (p) {
      if (out[p[0]] === 'N/A') return;
      var c = l[p[0]]; if (c === 'N/A') { out[p[0]] = 'N/A'; return; }
      if (c && typeof c === 'object') p[1].forEach(function (k) { if (c[k] !== undefined) out[p[0]][k] = n(c[k]); });
    });
    if (t === 'child') out.waiting = 'N/A';                                                                    // Paul's rule (22 November): child care never has a waiting period, whatever the document says
    else if (out.waiting !== 'N/A' && s(l.waiting)) out.waiting = s(l.waiting);
    var hasAbi = function (v) { return v !== undefined && v !== null && v !== ''; };
    if (hasAbi(l.abi)) out.abi = n(l.abi); else if (hasAbi(o.abi)) out.abi = n(o.abi); else if (o.quote) out.abi = 'Not found';        // a quote's line always has an ABI; one the quote does not print says so
    if (o.quote && t !== 'dread' && out.sev !== 'N/A' && !calc.isNum(out.sev.lump)) out.sev = 'N/A';          // severe illness is N/A on every line except where the quote has an amount (the additional expense line IS that amount)
    if (o.quote && t !== 'other') {                                                                          // a BrightRock need line: the figures the quote has to give are there, or the box says "Not found" (Paul, 23 November: never an empty box)
      calc.settleLine(out);                                                                                  // dread: no life cover; a lump sum of 0 gives an income portion of 0
      (schema.FIGURES[t] || []).forEach(function (r) { var c = out[r[0]]; if (c && typeof c === 'object' && (c[r[1]] === null || c[r[1]] === undefined || c[r[1]] === '')) c[r[1]] = 'Not found'; });
    }
    out.st = 'verify'; out.by = 'page'; out.src = src; return out;
  }
  function pillarsOf(c) {
    var o = {}; schema.PILLARS.forEach(function (p) { var v = c && c[p.id]; if (v && typeof v === 'object') { o[p.id] = {}; p.keys.forEach(function (k) { if (v[k] !== undefined) o[p.id][k] = n(v[k]); }); } });
    return Object.keys(o).length ? o : null;
  }
  function logDoc(state, file, block, how) {
    state.documents = state.documents || []; state.documents.push({ id: store.uid('d'), file: String(file || ''), block: block, how: how, at: new Date().toISOString() });
  }
  function qkey(num) { return String(num == null ? '' : num).replace(/\D/g, ''); }
  /* The quote of this block with this number (the digits are compared), not removed. quoteRead: it holds figures from a document (not only the Fact Find's lines). */
  function quoteIn(state, block, num) {
    var k = qkey(num); if (!k) return null;
    return calc.quotes(state, block).filter(function (x) { return qkey(x.number) === k; })[0] || null;
  }
  function quoteRead(q) { return calc.activeLines(q).some(function (l) { return l.st === 'verify' || l.st === 'confirmed'; }); }
  function findQuoteByNumber(state, num) {
    var k = qkey(num), hit = null; if (!k) return null;
    calc.allQuotes(state).forEach(function (q) { if (qkey(q.number) === k) hit = q; });
    return hit;
  }

  /* The Fact Find's children and debts against a quote that was read: a debt line the quote gives without its name or bank (or a child line without a surname) gets them from the matching Fact Find row (matched by name, then by the
     instalment or the balance). Only empty text boxes are filled: what the quote printed is never replaced, and no amount is invented. */
  function enrich(state, q) {
    var f = state && state.factFind && state.factFind.facts; if (!f) return 0;
    var lines = calc.activeLines(q), n2 = 0;
    calc.matchChildren(lines, f.children || []).pairs.forEach(function (p) { if (!s(p.line.sname) && s(p.ff.sname)) { p.line.sname = s(p.ff.sname); n2++; } });
    calc.matchDebts(lines, f.debts || []).pairs.forEach(function (p) {
      if (!s(p.line.debt) && (s(p.ff.desc) || s(p.ff.type))) { p.line.debt = s(p.ff.desc) || s(p.ff.type); n2++; }
      if (!s(p.line.bank) && s(p.ff.prov)) { p.line.bank = s(p.ff.prov); n2++; }
    });
    return n2;
  }
  /* A quote. data: what was read (or, with reading off, { number, date } from the file name). o: { replaces: id } */
  function applyQuote(state, block, data, file, o) {
    o = o || {}; data = data || {};
    var rt1 = o.counterOf ? store.findQuote(state, o.counterOf) : null; if (/bright/i.test(s(data.insurer) || (rt1 && rt1.insurer) || '')) glyphs(data);
    var kind = QUOTE_OF[block], src = srcOf('quote', file), q = store.newQuote(state, kind), read = !!(data.lines && data.lines.length);
    if (s(data.insurer)) q.insurer = s(data.insurer);
    q.number = s(data.number) || ''; q.date = dmy(data.date); if (s(data.rates)) q.rates = s(data.rates);
    if (data.aci !== undefined) q.aci = n(data.aci);
    if (s(data.aciText)) q.aciText = s(data.aciText);
    if (Array.isArray(data.aciPoints)) { var qp = data.aciPoints.map(s).filter(Boolean).slice(0, 3); if (qp.length) q.aciPoints = qp; }
    if (data.premium !== undefined && !o.nameOnly) q.premium = n(data.premium);
    if (data.servicing === true || data.servicing === false) q.servicing = data.servicing;
    if (data.disabilityAge !== undefined && calc.isNum(n(data.disabilityAge))) q.disabilityAge = n(data.disabilityAge);
    if (read) q.lines = data.lines.map(function (l) { return line(l, src, { quote: true, abi: data.abi }); });
    if (!s(data.aciText) && read) { var lw = data.lines.filter(function (l) { return l && s(l.aciText); })[0]; if (lw) q.aciText = s(lw.aciText); }          // the ACI words belong to the quote: the lines show the same
    if (read) enrich(state, q);
    if (data.printedTotals && typeof data.printedTotals === 'object') q.printedTotals = pillarsOf(data.printedTotals);
    q.st = 'verify'; q.by = 'page'; q.src = src; q.status = 'pending';
    if (o.counterOf) { q.counterOf = o.counterOf; q.uw = null; q.offer = q.offer || {}; if (!read) q.lines = []; var rt0 = store.findQuote(state, o.counterOf); if (rt0 && !s(data.insurer)) q.insurer = rt0.insurer; }                 // a counter offer quote (round 1.2): the same kind and block as the quote the client accepted, no lines of the Fact Find
    var place = null;
    if (o.replaces) {
      var old = store.findQuote(state, o.replaces);
      if (old) {
        if (old.counterOf) { q.counterOf = old.counterOf; q.offer = JSON.parse(JSON.stringify(old.offer || {})); q.terms = JSON.parse(JSON.stringify(old.terms || { loadings: [], exclusions: [] })); q.uw = null; if (!read) q.lines = []; place = old; }       // a counter offer that is replaced stays a counter offer, with its letter and terms
        calc.allQuotes(state).forEach(function (x) { if (x.counterOf === old.id) x.counterOf = q.id; });                                          // and the counter offers of a quote that is replaced follow the new quote
        old.removed = true; old.replacedBy = q.id; q.replaces = old.id;
      }
    }
    var same = o.replaces ? null : quoteIn(state, block, q.number);
    if (same && !!o.counterOf !== !!same.counterOf) same = null;                                          // a counter offer is never merged into an ordinary quote (or the other way round)                                         // the same number in the same block (not the quote that is being replaced): ONE quote, never two (Paul, 23 November)
    if (same) {
      if (!read && quoteRead(same)) return { quote: same, read: false, duplicate: same, merged: 'kept' };   // only a name and a number: what was read is never replaced by it
      var keep = { id: same.id, status: same.status, uw: same.uw, second: same.second, counterOf: same.counterOf, offer: same.offer, terms: same.terms, repl: same.repl, policyNo: same.policyNo, startDate: same.startDate, cmp: same.cmp, replaces: same.replaces, replacedBy: same.replacedBy };          // the adviser's choices (status, underwriting, terms, replacements) are never lost to a second reading
      Object.keys(same).forEach(function (k) { delete same[k]; }); Object.assign(same, q, keep); notePrinted(same); calc.alignPremiums(state);
      return { quote: same, read: read, duplicate: same, merged: 'again' };
    }
    var dup = findQuoteByNumber(state, q.number);                                                           // a quote with this number (not removed) is already there: the caller says so
    var arr = state.blocks[schema.blockOfQuote[kind]].quotes; if (place && arr.indexOf(place) >= 0) arr.splice(arr.indexOf(place) + 1, 0, q); else arr.push(q);          // a replaced counter offer keeps its place: replacing the older one never makes the replacement the live one
    notePrinted(q); calc.alignPremiums(state);
    return { quote: q, read: read, duplicate: dup || null };
  }
  /* A policy schedule fills the details of one item of block 1. Returns the item, or null when none matches (the schedule is for a policy that is not in the Fact Find). */
  function matchItem(items, data, getName) {
    var pn = qkey(data.policyNo || ''), hits = items.filter(function (i) { return !i.removed; });
    var byNo = pn ? hits.filter(function (i) { return qkey(i.policyNo) === pn; }) : [];
    if (byNo.length === 1) return byNo[0];
    var who = calc.norm(getName(data)), byName = who ? hits.filter(function (i) { var m = calc.norm(getName(i)); return m && (m === who || who.indexOf(m) >= 0 || m.indexOf(who) >= 0); }) : [];
    if (byName.length <= 1) return byName.length ? byName[0] : null;
    /* more than one policy of this insurer (two Liberty policies): the policy number, then the premium (the Fact Find's monthly spend against the schedule's), then the one no document has filled yet */
    var prem = n(data.premium), byPrem = calc.isNum(prem) ? byName.filter(function (i) { return calc.isNum(i.premium) && Math.abs(i.premium - prem) <= 1; }) : [];
    if (byPrem.length === 1) return byPrem[0];
    var pool = byPrem.length ? byPrem : byName, open = pool.filter(function (i) { return i.st === 'ff' || i.st === 'empty' || (i.src && i.src.kind === 'astute' && i.st !== 'confirmed'); });          // a policy only Astute has filled is still open to its schedule
    if (byPrem.length > 1 && open.length >= 1) return open[0];                                              // the same premium twice: the first one nothing has filled yet
    return { ambiguous: byName };
  }
  function applyPolicy(state, item, data, file) {
    var src = srcOf('schedule', file);
    ['insurer', 'product', 'policyNo'].forEach(function (k) { if (s(data[k])) item[k] = s(data[k]); });
    if (dmy(data.doc)) item.doc = dmy(data.doc);
    ['premium', 'aci', 'abi'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
    if (s(data.aciText)) item.aciText = s(data.aciText);
    if (Array.isArray(data.aciPoints)) { var ip = data.aciPoints.map(s).filter(Boolean).slice(0, 3); if (ip.length) item.aciPoints = ip; }
    if (data.ipAge !== undefined && calc.isNum(n(data.ipAge))) item.ipAge = n(data.ipAge);
    if (data.benefits && typeof data.benefits === 'object') { item.benefits = item.benefits || {}; ['life', 'sev', 'lsd', 'ip'].forEach(function (k) { if (s(data.benefits[k])) item.benefits[k] = s(data.benefits[k]); }); }
    if (data.lines && data.lines.length) item.lines = data.lines.map(function (l) { return line(l, src); });
    store.flattenPolicyLines(item);                                                                         // the need-by-need lines are for a BrightRock policy only: any other insurer's policy is one row with its benefits
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  /* The legacy protection plan of block 11 (the only item there that takes a document): read like a policy schedule, put in the item's own boxes. */
  function applyOther(state, item, data, file) {
    var src = srcOf('schedule', file), b = (data && data.benefits) || {};
    if (s(data.insurer)) item.company = s(data.insurer); if (s(data.product)) item.product = s(data.product); if (s(data.policyNo)) item.policyNo = s(data.policyNo);
    if (data.premium !== undefined && data.premium !== null) item.premium = n(data.premium);
    var note = [b.life, b.lsd, b.ip].filter(Boolean).join(' / '); if (note) item.note = note;
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  /* The Follow-Up Appointment Summary Notes of a later meeting (round 2, 23 November): what each cover of block 11 has progressed since the Fact Find is added to that item's note, with where it came from, "(Summary Notes dd/mm)".
     Nothing is overwritten: the Fact Find's part of the note stays in front. Returns { filled: [item names], date }. */
  function applyFollowUp(state, data, file, fileDate) {
    data = data || {}; var items = data.items && typeof data.items === 'object' ? data.items : {}, d = dmy(data.date) || fileDate || '', tag = ' (Summary Notes' + (d ? ' ' + dm(d) : '') + ')', src = srcOf('followup', file, d || undefined), out = [];
    state.blocks.other.items.forEach(function (it) {
      var t = s(items[it.key]); if (!t) return;
      t = t.replace(/\s*\(Summary Notes[^)]*\)\s*$/i, '');
      var base = s(it.note);
      if (base && base.indexOf(t) >= 0) return;                                                         // the same words are there already
      it.note = (base ? base + ' \u00b7 ' : '') + t + tag; it.st = 'verify'; it.by = 'page'; it.src = src; out.push(it.key);
    });
    return { filled: out, date: d };
  }
  /* The Fact Find's notes of the four covers as one text (only these four notes boxes leave the machine: no ID, phone or e-mail). '' when there is nothing. */
  function factNotesText(state) {
    var od = state && state.factFind && state.factFind.facts && state.factFind.facts.otherDetail; if (!od) return '';
    var rows = [['Medical aid', od.ma && od.ma.note], ['Gap cover', od.gap && od.gap.note], ['Will and legacy protection plan', od.will && od.will.note], ['Short-term insurance', od.shortterm && od.shortterm.note]];
    return rows.filter(function (r) { return s(r[1]); }).map(function (r) { return r[0] + ': ' + s(r[1]); }).join('\n');
  }
  /* What the notes said goes into the boxes that are still EMPTY (company, product, premium); nothing typed or read before is overwritten, the status stays as it is (from the Fact Find, to be checked). Returns the keys filled. */
  function applyNotesRead(state, data) {
    var items = data && data.items && typeof data.items === 'object' ? data.items : {}, out = [];
    state.blocks.other.items.forEach(function (it) {
      var d = items[it.key]; if (!d || typeof d !== 'object') return; var did = false;
      ['company', 'product'].forEach(function (k) { if (!s(it[k]) && s(d[k])) { it[k] = s(d[k]); did = true; } });
      var pr = n(d.premium); if (!calc.isNum(it.premium) && calc.isNum(pr)) { it.premium = pr; did = true; }
      if (did) out.push(it.key);
    });
    return out;
  }

  /* ---------- the BrightRock e-mail (round 4, 23 November) ---------- */
  /* The death-related income portion of a BrightRock quote is often only in BrightRock's e-mail. The page takes the e-mail as a saved file (.eml, .msg, .txt, or a PDF) found in the client's folder, or as text pasted into a quote.
     Only the text of that one e-mail is sent to Claude, which is asked for the CP numbers it names and the death-related income portion of each. */
  function decodeQP(t) {
    return String(t).replace(/=\r?\n/g, '').replace(/(=[0-9A-Fa-f]{2})+/g, function (m) {
      try { return decodeURIComponent(m.replace(/=/g, '%')); } catch (e) { return m.replace(/=([0-9A-Fa-f]{2})/g, function (x, h) { return String.fromCharCode(parseInt(h, 16)); }); }
    });
  }
  function b64text(t) {
    try { var bin = atob(String(t).replace(/[^A-Za-z0-9+\/=]/g, '')); try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; } } catch (e) { return ''; }
  }
  function stripHtml(h) {
    return String(h).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, function (m, c) { return String.fromCharCode(+c); }).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  }
  function mimePart(raw) {
    var i = raw.search(/\r?\n\r?\n/), head = i < 0 ? '' : raw.slice(0, i), body = i < 0 ? raw : raw.slice(i).replace(/^\r?\n\r?\n/, '');
    var hdr = head.replace(/\r?\n[ \t]+/g, ' '), type = ((/^content-type:\s*([^;\r\n]+)/im.exec(hdr) || [])[1] || '').trim().toLowerCase(), enc = ((/^content-transfer-encoding:\s*(\S+)/im.exec(hdr) || [])[1] || '').toLowerCase(), bnd = (/boundary="?([^";\r\n]+)"?/i.exec(hdr) || [])[1];
    if (/^multipart\//.test(type) && bnd) return body.split('--' + bnd).slice(1).filter(function (p) { return !/^--/.test(p.trim()); }).map(mimePart).filter(Boolean).join('\n');
    if (type && !/^text\//.test(type)) return '';
    var t = enc === 'quoted-printable' ? decodeQP(body) : enc === 'base64' ? b64text(body) : body;
    return /html/.test(type) ? stripHtml(t) : t;
  }
  /* The readable text of an e-mail saved as text (.eml, .txt) or pasted: headers kept as Subject / From / Date, MIME parts decoded (quoted-printable, base64), HTML turned into text. At most 60,000 characters. */
  function emailText(raw) {
    raw = String(raw == null ? '' : raw);
    var isMime = /^(received|from|subject|date|mime-version|content-type|message-id|to):/im.test(raw.slice(0, 3000)), out;
    if (isMime) {
      var cut = raw.search(/\r?\n\r?\n/), head = (cut < 0 ? raw : raw.slice(0, cut)).replace(/\r?\n[ \t]+/g, ' '), hv = function (h) { var m = new RegExp('^' + h + ':\\s*(.+)$', 'im').exec(head); return m ? m[1].trim() : ''; };
      out = ['Subject: ' + hv('subject'), 'From: ' + hv('from'), 'Date: ' + hv('date'), '', mimePart(raw)].join('\n');
    } else out = /<\/?(html|body|div|p|br)[\s>]/i.test(raw) ? stripHtml(raw) : raw;
    out = out.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return out.length > 60000 ? out.slice(0, 60000) : out;
  }
  /* The readable text of an Outlook message (.msg: a compound file that keeps the text as UTF-16 or 8-bit strings): the runs of readable characters, once each. At most 60,000 characters. bytes: a Uint8Array. */
  function msgText(bytes) {
    var out = [], seen = {}, n = bytes.length, i, run = '', add = function (t) { t = t.replace(/[ \t]+/g, ' ').trim(); if (t.replace(/\s/g, '').length >= 6 && !seen[t]) { seen[t] = 1; out.push(t); } };
    for (i = 0; i + 1 < n; i += 2) {
      var c = bytes[i] | (bytes[i + 1] << 8);
      if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13 || (c >= 160 && c <= 255) || c === 0x2018 || c === 0x2019 || c === 0x201C || c === 0x201D || c === 0x2013 || c === 0x2014 || c === 0x20AC) run += String.fromCharCode(c);
      else { add(run); run = ''; }
    }
    add(run); run = '';
    for (i = 0; i < n; i++) { var b = bytes[i]; if ((b >= 32 && b < 127) || b === 10 || b === 13 || b === 9) run += String.fromCharCode(b); else { if (run.length >= 12) add(run); run = ''; } }
    if (run.length >= 12) add(run);
    var text = out.join('\n');
    return text.length > 60000 ? text.slice(0, 60000) : text;
  }
  function brightQuotes(state) { return calc.allQuotes(state).filter(function (q) { return q.kind !== 'comparative' && /bright/i.test(q.insurer || ''); }); }
  /* What the e-mail said goes into the death-related line of the quote it names (by CP number; an unnumbered figure goes to the quote the e-mail was pasted into): the income portion p.m., only where the quote printed none; a figure a quote
     printed, or a person typed, is never replaced. The line says where the figure came from (via). Returns { filled: [quotes], unmatched: [numbers], nofigure }. */
  function applyBrEmail(state, data, file, o) {
    o = o || {};
    var res = { filled: [], unmatched: [], nofigure: 0 }, list = data && Array.isArray(data.quotes) ? data.quotes : [], date = o.date || today(), all = brightQuotes(state);
    list.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var v = n(e.deathIncomePortion); if (!calc.isNum(v)) { res.nofigure++; return; }
      var num = qkey(e.number), qs = num ? all.filter(function (q) { return qkey(q.number) === num; }) : [];
      if (!qs.length && o.quote && (!num || list.length === 1)) qs = [o.quote];
      if (!qs.length) { res.unmatched.push(num || 'a quote'); return; }
      qs.forEach(function (q) {
        var line = calc.activeLines(q).filter(function (l) { return l.type === 'death'; })[0];
        if (!line) { res.unmatched.push((num || q.number || 'a quote') + ' (no death-related line)'); return; }
        var cur = line.life && typeof line.life === 'object' ? line.life.monthly : null;
        if (calc.isNum(cur)) return;                                                                          // the quote printed it, or a person typed it: kept
        if (!line.life || typeof line.life !== 'object') line.life = { lump: null, monthly: null };
        line.life.monthly = v; line.via = line.via || {}; line.via['life.monthly'] = 'from the BrightRock email' + (date ? ' ' + dm(date) : '');
        if (res.filled.indexOf(q) < 0) res.filled.push(q);
      });
    });
    return res;
  }
  /* The date of an Astute report goes into the overview's header (Client details: Astute report date): the date the report says, else the date in its file name; a later one replaces an earlier one. Returns the date set, or null. */
  function setAstuteDate(state, data, nameDate) {
    var d = dmy(data && data.reportDate) || nameDate || null; if (!d) return null;
    var key = function (v) { var m = /(\d{1,2})\D(\d{1,2})\D(\d{2,4})/.exec(String(v || '')); return m ? (+m[3]) * 10000 + (+m[2]) * 100 + (+m[1]) : 0; };
    if (state.header.astuteDate && key(state.header.astuteDate) >= key(d)) return null;
    state.header.astuteDate = d; return d;
  }
  /* "dd/mm/yyyy" as "dd/mm" for the source tag of a note. */
  function dm(v) { var m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/.exec(String(v || '')); return m ? two(+m[1]) + '/' + two(+m[2]) : String(v || ''); }
  function applyGroup(state, item, data, file) {
    var src = srcOf('group', file);
    if (item.kind === 'risk') {
      ['statementDate'].forEach(function (k) { if (dmy(data[k])) item[k] = dmy(data[k]); });
      ['basis', 'ipWaiting'].forEach(function (k) { if (s(data[k])) item[k] = s(data[k]); });
      if (['employer', 'employee', 'both'].indexOf(data.paidBy) >= 0) item.paidBy = data.paidBy;
      ['monthlyCost', 'aci', 'abi'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
      schema.PILLARS.forEach(function (p) { var c = data[p.id]; if (c && typeof c === 'object') { item[p.id] = item[p.id] || { amount: null, endAge: null }; if (c.amount !== undefined) item[p.id].amount = n(c.amount); if (c.endAge !== undefined && c.endAge !== null && c.endAge !== '') item[p.id].endAge = String(c.endAge).trim(); } });
    } else {
      ['value', 'employer', 'employee', 'aci'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
      if (s(data.note)) item.note = s(data.note);
    }
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  function applyInvestment(state, item, data, file, o) {
    o = o || {}; var src = srcOf(o.kind === 'astute' ? 'astute' : 'schedule', file);
    if (s(data.product)) item.product = s(data.product); if (s(data.policyNo)) item.policyNo = s(data.policyNo);
    if (dmy(data.valueDate)) item.valueDate = dmy(data.valueDate);
    ['gross', 'penalty', 'returnRate', 'aci', 'monthly'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) item[k] = n(data[k]); });
    item.valueSource = { kind: o.kind === 'astute' ? 'astute' : 'schedule', date: dmy(data.valueDate) || (o.date || null), file: String(file || ''), page: o.kind === 'astute' && parseInt(o.page, 10) >= 1 ? parseInt(o.page, 10) : null };
    item.st = 'verify'; item.by = 'page'; item.src = src; return item;
  }
  /* dd/mm/yyyy as a number that sorts (0 when it is not a date). */
  function dateKey(v) { var m = /(\d{1,2})\D(\d{1,2})\D(\d{2,4})/.exec(String(v || '')); if (!m) return 0; var y = +m[3]; if (y < 100) y += 2000; return y * 10000 + (+m[2]) * 100 + (+m[1]); }
  /* Where an Astute value came from: the report, its date and (best effort) the page of the PDF it is listed on. */
  function astuteSrc(file, date, page) { var o = srcOf('astute', file, date || undefined), pg = parseInt(page, 10); o.page = pg >= 1 && pg < 2000 ? pg : null; return o; }
  function newerAstute(item, date) { var cur = item && item.src && item.src.kind === 'astute' ? item.src.date : (item && item.valueSource && item.valueSource.kind === 'astute' ? item.valueSource.date : null); return !!cur && !!date && dateKey(cur) > dateKey(date); }
  var blankBox = function (v) { return v === null || v === undefined || v === ''; };
  /* An Astute report is the fallback for a policy the Fact Find lists and no schedule has been read for (Paul, 24 November, round 1.1): the newest Astute report fills the row's EMPTY boxes (product, policy number, DOC, premium, ACI, ABI,
     descriptions) and its cover as ONE line (life cover, severe illness, lump sum disability, income protector, waiting period); the row says "Astute dd/mm/yyyy". A schedule ALWAYS wins: a policy whose schedule was read is left alone, a schedule read
     later replaces what Astute filled, and nothing a person typed or checked is touched. Only policies already in the Fact Find are filled (never added). Returns { filled: [names], unmatched: [names], skipped: [names] }. */
  function applyAstutePolicies(state, data, file, date) {
    var res = { filled: [], unmatched: [], skipped: [] }, list = data && Array.isArray(data.policies) ? data.policies : [], items = state.blocks.policies.items;
    list.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var ins = s(r.insurer || r.provider), label = [ins, s(r.policyNo)].filter(Boolean).join(' ') || s(r.product) || 'a policy';
      var hit = matchItem(items, { policyNo: r.policyNo, premium: r.premium, insurer: ins }, function (x) { return x.insurer; });
      if (!hit || hit.ambiguous) { res.unmatched.push(label + (hit && hit.ambiguous ? ' (more than one policy of this insurer could be it)' : '')); return; }
      if (hit.src && hit.src.kind === 'schedule') { res.skipped.push(label + ' (its schedule was read)'); return; }
      if (hit.st === 'confirmed' && hit.by === 'person') { res.skipped.push(label + ' (checked by hand)'); return; }
      if (newerAstute(hit, date)) { res.skipped.push(label + ' (an Astute report of a later date was read)'); return; }
      var did = 0, put = function (k, v) { if (!blankBox(v) && blankBox(hit[k])) { hit[k] = v; did++; } };
      put('product', s(r.product)); put('policyNo', s(r.policyNo)); put('doc', dmy(r.doc)); put('premium', n(r.premium)); put('aci', n(r.aci)); put('aciText', s(r.aciText)); put('abi', n(r.abi)); put('ipAge', n(r.ipAge));
      if (r.benefits && typeof r.benefits === 'object') { hit.benefits = hit.benefits || {}; ['life', 'sev', 'lsd', 'ip'].forEach(function (k) { if (s(r.benefits[k]) && !s(hit.benefits[k])) { hit.benefits[k] = s(r.benefits[k]); did++; } }); }
      var amounts = { life: n(r.life), sev: n(r.sev), lsd: n(r.lsd), ip: n(r.ip) }, any = ['life', 'sev', 'lsd', 'ip'].some(function (k) { return calc.isNum(amounts[k]); });
      var own = calc.activeLines(hit).some(function (l) { return l.by === 'person' || ((l.st === 'verify' || l.st === 'confirmed') && !(l.src && l.src.kind === 'astute')); });          // a line a schedule gave, or that a person typed in or checked (also an Astute line he corrected): kept
      if (any && !own) {
        var src = astuteSrc(file, date, r.page);
        hit.lines = [line({ type: 'other', label: s(r.product) || hit.product || 'Cover', life: { lump: amounts.life }, sev: { lump: amounts.sev }, lsd: { lump: amounts.lsd }, ip: { monthly: amounts.ip }, waiting: s(r.waiting) }, src)];
        did++;
      }
      if (!did) { res.skipped.push(label + ' (nothing new in the report)'); return; }
      hit.src = astuteSrc(file, date, r.page); hit.st = 'verify'; hit.by = 'page'; res.filled.push(label);
    });
    return res;
  }
  /* The same fallback for group benefits: only the empty boxes of an item the Fact Find lists whose statement has not been read. */
  function applyAstuteGroup(state, data, file, date) {
    var res = { filled: [], unmatched: [], skipped: [] }, list = data && Array.isArray(data.group) ? data.group : [];
    list.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var kind = ['risk', 'pension', 'provident'].indexOf(r.kind) >= 0 ? r.kind : null, label = s(r.provider) || 'a group benefit';
      var hit = matchItem(state.blocks.group.items.filter(function (g) { return !kind || g.kind === kind; }), { policyNo: '', premium: null, provider: s(r.provider) }, function (x) { return x.provider; });
      if (!hit || hit.ambiguous) { res.unmatched.push(label + (hit && hit.ambiguous ? ' (more than one item could be it)' : '')); return; }
      if (hit.src && hit.src.kind === 'group') { res.skipped.push(label + ' (its statement was read)'); return; }
      if (hit.st === 'confirmed' && hit.by === 'person') { res.skipped.push(label + ' (checked by hand)'); return; }
      if (newerAstute(hit, date)) { res.skipped.push(label + ' (an Astute report of a later date was read)'); return; }
      var did = 0;
      if (hit.kind === 'risk') schema.PILLARS.forEach(function (p) {
        var c = r[p.id]; if (!c || typeof c !== 'object') return; hit[p.id] = hit[p.id] || { amount: null, endAge: null };
        if (blankBox(hit[p.id].amount) && calc.isNum(n(c.amount))) { hit[p.id].amount = n(c.amount); did++; }
        if (blankBox(hit[p.id].endAge) && s(c.endAge)) { hit[p.id].endAge = String(c.endAge).trim(); did++; }
      });
      else ['value', 'employer', 'employee'].forEach(function (k) { if (blankBox(hit[k]) && calc.isNum(n(r[k]))) { hit[k] = n(r[k]); did++; } });
      if (!did) { res.skipped.push(label + ' (nothing new in the report)'); return; }
      hit.src = astuteSrc(file, date, r.page); hit.st = 'verify'; hit.by = 'page'; res.filled.push(label);
    });
    return res;
  }
  /* An Astute report fills the value of each investment it lists that matches one of the Fact Find's; a value from an investment schedule is never replaced by Astute (schedules first). It is also the fallback for the current policies
     and group benefits that have no schedule or statement (applyAstutePolicies, applyAstuteGroup). Returns { filled, unmatched (investments), policies, group }. */
  function applyAstute(state, data, file) {
    var res = { filled: 0, unmatched: [], policies: null, group: null }, date = dmy(data.reportDate);
    (data.investments || []).forEach(function (r) {
      var hit = matchItem(state.blocks.investments.items, r, function (x) { return x.provider; });
      if (!hit || hit.ambiguous) { res.unmatched.push(r.provider || r.product || 'an investment'); return; }
      if (hit.valueSource && hit.valueSource.kind === 'schedule' && (hit.st === 'verify' || hit.st === 'confirmed')) return;
      if (newerAstute(hit, date)) return;
      applyInvestment(state, hit, { product: hit.product, valueDate: date, gross: r.gross, monthly: r.monthly, policyNo: r.policyNo }, file, { kind: 'astute', date: date, page: r.page }); res.filled++;
    });
    res.policies = applyAstutePolicies(state, data, file, date); res.group = applyAstuteGroup(state, data, file, date);
    return res;
  }
  function applyCmp(state, data, file) {
    var q = findQuoteByNumber(state, data.number); if (!q) return null;
    var rows = (data.rows || []).map(function (r) { return { key: ['total', 'retirement', 'childcare', 'child'].indexOf(r.key) >= 0 ? r.key : 'total', name: s(r.name) || undefined, sname: s(r.sname) || undefined, today: n(r.today), projected: n(r.projected), payoutDate: dmy(r.payoutDate) }; });
    q.cmp = { number: s(data.number) || q.number, activationDate: dmy(data.activationDate), reason: s(data.reason), rows: rows, st: 'verify', by: 'page', src: srcOf('cmp', file) };
    return q;
  }

  /* A proposed investment (block 9). A row from the Fact Find (the same provider, and the same type when the document says one) that no document has filled yet is filled in; otherwise a new row is added.
     Returns { item, matched }. Nothing is checked here: everything is amber. */
  function applyProposed(state, data, file) {
    data = data || {}; var src = srcOf('proposal', file), items = state.blocks.proposed.items, who = calc.norm(s(data.provider) || '');
    var type = null; schema.PROPOSED_TYPES.forEach(function (t) { if (calc.norm(t) === calc.norm(s(data.type) || '')) type = t; });
    var hit = items.filter(function (i) {
      var m = calc.norm(i.provider || ''); return !i.removed && (i.st === 'ff' || i.st === 'empty') && who && m && (m.indexOf(who) >= 0 || who.indexOf(m) >= 0) && (!type || i.type === type);
    })[0] || null, it = hit || store.newProposed();
    if (type) it.type = type; if (s(data.provider)) it.provider = s(data.provider); if (s(data.number)) it.quote = s(data.number);
    ['lump', 'monthly', 'boostPct', 'netInvested', 'aci'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) it[k] = n(data[k]); });
    if (['lump', 'monthly', 'both', 'transfer'].indexOf(data.contribution) >= 0) it.contribution = data.contribution;
    else if (calc.isNum(it.lump) && calc.isNum(it.monthly) && it.lump && it.monthly) it.contribution = 'both'; else if (calc.isNum(it.lump) && it.lump) it.contribution = 'lump'; else if (calc.isNum(it.monthly) && it.monthly) it.contribution = 'monthly';
    it.st = 'verify'; it.by = 'page'; it.src = src; if (!hit) items.push(it);
    return { item: it, matched: !!hit };
  }
  /* A goal analysis report (block 10): the RGAR or the EGAR row (made when it is not there) gets the report's figures. Returns { item, wasRequested }. */
  function applyGoal(state, data, file) {
    data = data || {}; var src = srcOf('goal', file), kind = /egar|education/i.test(String(data.kind || '')) ? 'egar' : 'rgar', items = state.blocks.goals.items;
    var it = items.filter(function (g) { return g.kind === kind && !g.removed; })[0], was = it ? !!it.requested : false;
    if (!it) { it = { id: 'goal-' + kind, kind: kind, requested: true, note: '', currentValuePm: null, futureValuePm: null, aci: null, premium: null, st: 'empty', src: null, by: 'page', removed: false }; items.push(it); }
    ['currentValuePm', 'futureValuePm', 'aci', 'premium'].forEach(function (k) { if (data[k] !== undefined && data[k] !== null) it[k] = n(data[k]); });
    it.requested = true; if (s(data.note)) it.note = s(data.note); else if (!was) it.note = '';
    it.st = 'verify'; it.by = 'page'; it.src = src; return { item: it, wasRequested: was };
  }
  /* ---------- counter offers (round 1.2) ---------- */
  /* Round 1.3 (24 November, from the Fix Skills chat's test on a real BrightRock letter; the page itself has not been seen to meet either fault, these are safety nets). BrightRock's PDF font draws the two letters "ti" as the private
     characters U+E000 and U+E001 (the text of those PDFs reads "underwri?ng"): a reading of a BrightRock document that copies them is put right. Only BrightRock's: another insurer's font may use these code points for something else. */
  function glyphs(v) {
    if (typeof v === 'string') return v.replace(/[\uE000\uE001]/g, 'ti');
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = glyphs(v[i]); return v; }
    if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { v[k] = glyphs(v[k]); }); return v; }
    return v;
  }
  function counterRole(fileName) {
    var raw = String(fileName == null ? '' : fileName), low = raw.replace(/\.[A-Za-z0-9]{2,5}$/, '').toLowerCase(), numbers = (raw.match(/\d{6,12}/g) || []);
    var role = /consent to release|confidential information/.test(low) ? 'consent' : /(^|[ _\-(])signed\s*\)?$/.test(low) ? 'signed' : /cover terms|counter[ _-]?offer|offer letter|terms letter|underwriting terms/.test(low) ? 'letter' : /cover proposal|proposal|quote/.test(low) ? 'quote' : 'other';
    return { role: role, numbers: numbers };
  }
  /* The counter offer a letter belongs to: the one of this quote chain with the revised number, else a new one with no lines yet. */
  function counterFor(state, root, number, file) {
    var all = calc.counterOffers(state, root), key = qkey(number); if (key && key === qkey(root.number)) key = '';          // a revised number that is the original's is no number: it must never make a copy of the original
    var have = key ? all.filter(function (c) { return qkey(c.number) === key; })[0] || (file ? all.filter(function (c) { return c.offer && c.offer.letter === file; })[0] : null) || null : (file ? all.filter(function (c) { return c.offer && c.offer.letter === file; })[0] || (all.filter(function (c) { return !qkey(c.number); }).length === 1 ? all.filter(function (c) { return !qkey(c.number); })[0] : null) : null);          // a letter with no number belongs to the counter offer that holds this file, else to the only one with no number
    return have || store.addCounterOffer(state, 'blocks.' + schema.blockOfQuote[root.kind] + '.quotes.' + state.blocks[schema.blockOfQuote[root.kind]].quotes.indexOf(root), { number: key ? s(number) : '' });
  }
  function sameRow(a, b, kind) { return kind === 'loadings' ? a.need === b.need && a.column === b.column : s(a.no) && s(b.no) ? calc.norm(a.no) === calc.norm(b.no) : calc.norm(a.what) === calc.norm(b.what); }
  /* A counter offer letter, read: the terms (loadings by need group and column group, exclusions as the insurer numbers them) go into the counter offer's terms, amber until the adviser has checked them; the premiums, dates and the file go into
     its `offer`. A row the adviser has checked is never replaced by a second reading. root: the quote the client accepted. Returns { quote, loadings, exclusions }. */
  function applyCounterLetter(state, root, data, file, o) {
    o = o || {}; data = data || {};
    if (/bright/i.test(s(root && root.insurer) || s(o.insurer) || '')) glyphs(data);
    var src = function (page) { var x = srcOf('counteroffer', file); x.page = calc.isNum(n(page)) ? n(page) : null; return x; };
    var c = counterFor(state, root, data.revisedNumber || o.number, String(file || '')), off = c.offer = c.offer && typeof c.offer === 'object' ? c.offer : {};
    off.letter = String(file || ''); off.originalNumber = s(data.originalNumber) || off.originalNumber || null; off.revisedNumber = s(data.revisedNumber) || off.revisedNumber || null;
    if (data.origPremium !== undefined) off.origPremium = n(data.origPremium); if (data.revPremium !== undefined) off.revPremium = n(data.revPremium);
    off.expires = dmy(data.expires) || off.expires || null; off.notes = s(data.notes) || off.notes || null; off.readAt = today();
    if (o.signed) off.signed = String(o.signed);
    if (!s(c.number) && s(data.revisedNumber) && qkey(data.revisedNumber) !== qkey(root.number)) c.number = s(data.revisedNumber);
    off.startDate = dmy(data.startDate) || off.startDate || null;                                          // the date the letter proposes: the start date of the policy is typed when the insurer has issued it
    if (!calc.isNum(c.premium) && calc.isNum(off.revPremium)) { /* the counter offer quote prints the loaded premium; until it is read the letter's revised premium is shown (calc.counterPremium) */ }
    var t = c.terms = c.terms && typeof c.terms === 'object' ? c.terms : { loadings: [], exclusions: [] };
    var made = { loadings: 0, exclusions: 0, updated: 0 }, cells = Array.isArray(data.cells) ? data.cells : [];          // a second reading works IN PLACE: a row is found again by its need and column (loading) or its number (exclusion); an amber row gets the new figures and keeps what was typed in it, a checked row is never touched, nothing is dropped
    cells.forEach(function (cell) {
      if (!cell || !schema.needGroupById[cell.need] || !schema.columnGroupById[cell.column]) return;
      var pct = n(cell.loading); if (!calc.isNum(pct) || !(pct > 0)) return;
      var row = { benefit: schema.cellOf(cell.need, cell.column).benefit, pct: pct, kind: null, reason: '', need: cell.need, column: cell.column, st: 'verify', by: 'page', src: src(data.termsPage) };
      var have = t.loadings.filter(function (x) { return x && x.need === row.need && x.column === row.column; })[0];
      if (!have) { t.loadings.push(row); made.loadings++; }
      else if (have.st === 'verify' && have.by !== 'person' && have.pct !== pct) { have.pct = pct; have.src = row.src; made.updated++; }
    });
    (Array.isArray(data.exclusions) ? data.exclusions : []).forEach(function (e) {
      if (!e || (!s(e.no) && !s(e.what))) return;
      var no = s(e.no), applies = [];
      cells.forEach(function (cell) { if (cell && schema.needGroupById[cell.need] && schema.columnGroupById[cell.column] && Array.isArray(cell.exclusions) && no && cell.exclusions.some(function (x) { return calc.norm(x) === calc.norm(no); })) applies.push({ need: cell.need, column: cell.column }); });
      var row = { no: no, benefit: schema.cellsBenefit(applies), what: calc.ownNumberOut(s(e.what), no) || '', why: s(e.type) || '', applies: applies, st: 'verify', by: 'page', src: src(e.page || data.exclusionsPage), page: calc.isNum(n(e.page)) ? n(e.page) : null };
      var hv = t.exclusions.filter(function (x) { return sameRow(x, row, 'exclusions'); })[0];
      if (!hv) { t.exclusions.push(row); made.exclusions++; }
      else if (hv.st === 'verify' && hv.by !== 'person') { var was = JSON.stringify([hv.applies, hv.benefit, hv.page]); hv.applies = applies; hv.benefit = row.benefit; hv.page = row.page; hv.src = row.src; if (row.what && hv.by !== 'person') hv.what = row.what; if (JSON.stringify([hv.applies, hv.benefit, hv.page]) !== was) made.updated++; }          // an amber row nobody has typed in takes the cleaned wording (a row of an earlier reading had the number in it); what a person typed stays
    });
    c.st = c.st === 'empty' ? 'verify' : c.st; c.by = 'page'; if (!c.src) c.src = src(null);
    calc.alignPremiums(state);
    return { quote: c, loadings: made.loadings, exclusions: made.exclusions, updated: made.updated };
  }
  /* The underwriter's e-mail, read (round 1.3, contract revision o): ONE reason for the loadings goes into the counter offer's terms.reason with where it came from (the e-mail's subject, sender and date, and the file), amber until the adviser ticks Terms
     checked. The e-mail must name this counter offer's chain (a CP number of the counter offer, the original or the revised proposal) when it names any number; one that names only other quotes fills nothing. A reason a person typed or checked is never
     replaced. o.quote: the counter offer the e-mail was added to. Returns { set, kept, mismatch: [numbers], noReason, noQuote }. */
  function applyUwEmail(state, data, file, o) {
    o = o || {}; data = data || {};
    var res = { set: false, kept: false, mismatch: null, noReason: false, noQuote: false }, c = o.quote && o.quote.counterOf ? o.quote : null;
    if (!c) { res.noQuote = true; return res; }
    var reason = s(data.reason); if (!reason) { res.noReason = true; return res; }
    var nums = (Array.isArray(data.numbers) ? data.numbers : []).map(qkey).filter(Boolean);
    if (nums.length) {
      var root = calc.parentOf(state, c), off = c.offer || {}, mine = [c.number, root && root.number, off.revisedNumber, off.originalNumber].map(qkey).filter(Boolean);
      if (!nums.some(function (x) { return mine.indexOf(x) >= 0; })) { res.mismatch = nums; return res; }
    }
    var t = c.terms = c.terms && typeof c.terms === 'object' ? c.terms : { loadings: [], exclusions: [] }, cur = t.reason;
    if (cur && typeof cur === 'object' && s(cur.text) && (cur.by === 'person' || cur.st === 'confirmed')) { res.kept = true; return res; }
    var src = srcOf('uwemail', file); src.date = dmy(data.date) || null; src.subject = s(data.subject); src.sender = s(data.from);
    t.reason = { text: reason, kind: schema.loadingKindLabel[data.kind] ? data.kind : null, src: src, st: 'verify', by: 'page' };
    res.set = true; return res;
  }
  /* The underwriters' reply read WITHOUT Claude when it has the wording of a real BrightRock reply (the Fix Skills chat, 25 November, from real replies in Paul's Outlook): the reasons are ONE paragraph that starts "Our decision is based on the
     information we received -" and ends before "Here's a summary of the terms we offered"; the subject carries both Cover Proposal numbers (nothing else); the headers give the subject, sender and date. The text never leaves this computer.
     Returns { reason, subject, from, date, numbers, kind } or null when the reply has no such paragraph (an older reply says "Unfortunately the original terms we have offered will..." and gives no reason). */
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function mailDate(v) {
    var t = String(v || ''), a = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t); if (a) return two(+a[1]) + '/' + two(+a[2]) + '/' + a[3];
    var b = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(t); return b && MONTHS[b[2].toLowerCase()] ? two(+b[1]) + '/' + two(MONTHS[b[2].toLowerCase()]) + '/' + b[3] : null;
  }
  function uwReasonLocal(text, rawText) {
    var texts = [text, rawText].map(function (x) { return String(x == null ? '' : x).replace(/\r/g, ''); }).filter(Boolean), reason = '', i;
    for (i = 0; i < texts.length && !reason; i++) {                                                            // the readable text first, then the text as it came (a pasted Outlook reply has its quoted headers lower down and the readable text would take its first paragraph for headers)
      var m = /our decision is based on the information we received\s*[-–—:]?\s*([\s\S]*?)(?=\n[ \t]*\n|here\S{0,8}s\s+a summary|a summary of the terms|$)/i.exec(texts[i]);
      reason = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    }
    if (!reason || reason.length > 600) return null;                                                           // nothing, or a run-on that swallowed the grid and the thread: not a reason
    var head = function (h) { var re = new RegExp('^' + h + ':[ \\t]*(.*)$', 'gim'), x, j; for (j = 0; j < texts.length; j++) { re.lastIndex = 0; while ((x = re.exec(texts[j]))) { var v = x[1].trim(); if (v) return v; } } return ''; };
    var nums = [], re2 = /cover proposal:?\s*((?:\d{6,12}[\s,]*)+)/gi, k; texts.forEach(function (t) { re2.lastIndex = 0; while ((k = re2.exec(t))) (k[1].match(/\d{6,12}/g) || []).forEach(function (n) { if (nums.indexOf(n) < 0) nums.push(n); }); });
    return { reason: reason, subject: head('subject') || null, from: head('from') || null, date: mailDate(head('date') || head('sent')), numbers: nums, kind: null };
  }
  /* A counter offer quote that has just been read printed its own premium: it is kept in offer.quotePremium (alignPremiums then makes the letter's figure the one used, and premiumWarning compares the two). */
  function notePrinted(c) { if (c && c.counterOf && c.offer && typeof c.offer === 'object' && calc.isNum(c.premium)) c.offer.quotePremium = c.premium; }
  /* What was read has nothing in it (a document that is not the kind said, a scan that could not be read): the caller says so and only records the document. */
  function isEmptyRead(block, data) {
    if (!data || typeof data !== 'object') return true;
    var has = function (v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !isFinite(v)); };
    var kind = SPEC_OF[block];
    if (kind === 'quote') return !(data.lines && data.lines.length) && !has(data.premium);
    if (kind === 'proposal') return !has(data.lump) && !has(data.monthly) && !has(data.netInvested);
    if (kind === 'goal') return !has(data.currentValuePm) && !has(data.futureValuePm) && !has(data.premium);
    if (kind === 'cmp') return !(data.rows && data.rows.length) && !has(data.reason);
    if (kind === 'ffnotes') return !(data.items && typeof data.items === 'object' && Object.keys(data.items).some(function (k) { var d = data.items[k]; return d && typeof d === 'object' && (has(d.company) || has(d.product) || has(d.premium)); }));
    if (kind === 'followup') return !(data.items && typeof data.items === 'object' && Object.keys(data.items).some(function (k) { return has(data.items[k]); }));
    if (kind === 'astute') return !(data.investments && data.investments.length) && !(data.policies && data.policies.length) && !(data.group && data.group.length) && !has(data.reportDate);
    if (kind === 'counterletter') return !(data.cells && data.cells.length) && !(data.exclusions && data.exclusions.length) && !has(data.revPremium) && !has(data.origPremium);
    if (kind === 'uwemail') return !has(data.reason);
    if (kind === 'bremail') return !(data.quotes && data.quotes.some && data.quotes.some(function (e) { return e && calc.isNum(n(e.deathIncomePortion)); }));
    return !Object.keys(data).some(function (k) { return has(data[k]) && typeof data[k] !== 'object'; }) && !Object.keys(data).some(function (k) { var v = data[k]; return v && typeof v === 'object' && Object.keys(v).some(function (j) { return has(v[j]); }); });
  }

  return { comparableItems: comparableItems, glyphs: glyphs, applyUwEmail: applyUwEmail, uwReasonLocal: uwReasonLocal, classify: classify, reviewPaperwork: reviewPaperwork, promptFor: promptFor, parseReply: parseReply, readWithClaude: readWithClaude, applyQuote: applyQuote, counterRole: counterRole, applyCounterLetter: applyCounterLetter, enrich: enrich, factNote: factNote, applyPolicy: applyPolicy, applyOther: applyOther, applyFollowUp: applyFollowUp, dm: dm, factNotesText: factNotesText, applyNotesRead: applyNotesRead, emailText: emailText, msgText: msgText, applyBrEmail: applyBrEmail, setAstuteDate: setAstuteDate, brightQuotes: brightQuotes, applyGroup: applyGroup, applyInvestment: applyInvestment, applyAstute: applyAstute, applyAstutePolicies: applyAstutePolicies, applyAstuteGroup: applyAstuteGroup, astuteSrc: astuteSrc, applyProposed: applyProposed, applyGoal: applyGoal, isEmptyRead: isEmptyRead,
    applyCmp: applyCmp, matchItem: matchItem, logDoc: logDoc, findQuoteByNumber: findQuoteByNumber, quoteIn: quoteIn, quoteRead: quoteRead, SPEC_OF: SPEC_OF, BLOCK_LABEL: BLOCK_LABEL, QUOTE_OF: QUOTE_OF, ENDPOINT: ENDPOINT };
});
