/* Voice mode, the part that follows meaning. Claude reads each line that is heard: who asked what, who stated which fact, what was corrected,
   what the client does not have, and which box each fact belongs in. Only text is sent (never audio): the last few lines of the conversation,
   the names of the form's boxes and the values already in the current section. ID numbers, phone numbers, tax numbers and email addresses
   are never sent: each one is swapped for a marker such as [N1] or [E1] (with its general shape, for example "10 digits, starts like a
   landline number"), Claude says which box gets which marker, and the real value is put back on this computer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./voice.js'));
  else { root.FF = root.FF || {}; root.FF.voiceAI = factory(root.FF.voice); }
})(typeof self !== 'undefined' ? self : this, function (V) {
  var ENDPOINT = 'https://api.anthropic.com/v1/messages', API_VERSION = '2023-06-01';

  /* Private values (ID, tax and phone numbers, email addresses) are swapped for markers before a line leaves this computer. When sharing is switched on in Settings (the Anthropic account behind
     the key is covered by the agreement the firm needs for client details), they are sent as they are and Claude fills, checks and edits those boxes itself. Off unless switched on. */
  var share = false;
  function setShare(on) { share = !!on; }
  function sharing() { return share; }

  var SYSTEM = [
    'You are the listening brain of a Fact Find form. A financial adviser is on a call with a client and the form fills in live while they talk.',
    'You receive JSON: "position" (where the adviser is on the form now), "sections", "fields" (every box of the whole form, with its section), "filled" (what is already in the boxes of the form),',
    '"lists" (every list of rows in the form, with its section, its columns and the rows already there), "recent" (the last few lines) and "newest" (the line just heard).',
    'The JSON can arrive in two parts one after the other (the first holds "sections" and "fields"): read the two together as one.',
    'When "note" is present it says what the page has already done for the newest line (for example that it already moved to a section): do not do that again, do the rest of the line.',
    'Nobody tells you who is speaking. The adviser and the client talk fluidly: ONE line can hold the adviser asking, the client answering, a correction and a new fact.',
    'Read the whole line and work out what was ASKED, what was STATED and what was CHANGED, however loosely it was worded, then say what to do on the form.',
    'Reply with ONE JSON object and nothing else, with no words before or after it and never a second object (do not correct yourself afterwards): {"actions": [ ... ]} (and "unplaced", see "Facts with no box" below). Put the actions in the order things were said. Each action is one of:',
    '  {"do":"ask","field":"<id>"}                  someone asks about, or moves to, one box ("do you have a work number?", "and your second name?")',
    '  {"do":"section","section":"<id>"}            someone moves to a whole topic ("let\'s talk about your health")',
    '  {"do":"fill","field":"<id>","value":"..."}   a value is stated for a box, WHOEVER says it. Add "correction":true when it replaces a value that is already in the box (see "filled")',
    '  {"do":"confirm","field":"<id>"}              the client agrees to a value on the form ("yes, that\'s right"): see "Confirming" below',
    '  {"do":"empty","field":"<id>"}                one box is to be emptied ("delete his name", "scratch the surname", "remove the occupation"); for a box of a row: {"do":"empty","list":"<list id>","row":<row number>,"col":"<column id>"}',
    '  {"do":"wait"}                                nothing to fill yet: the value in position.current_value was rejected, or the line stopped before the value ("my surname is spelled ...")',
    '  {"do":"cmd","cmd":"undo|next|prev|nextSection|prevSection|clear|clearAll|confirmAll|notes|notesOff"}   a request about the form itself: "scratch that" is undo, "skip" or "next question" is next,',
    '                                               "let me take some notes" or "let me make a note of this" is notes (add "retro":true for "note that down"), "that\'s all for the notes", "I\'ve noted that, I\'ve completed those notes" is notesOff,',
    '                                               "clear that", "delete that", "remove it" and "we need to delete that" are clear (only the box being talked about: position.field, or the box just read back), and clearAll is for wanting EVERYTHING on the whole form removed',
    '                                               ("all my details are wrong, remove them all", "wipe the entire form", "start again from scratch"). For clearAll give just that one action:',
    '                                               the page asks "are you sure?" before anything is cleared. A wrong value in ONE box is not clearAll: that is a correction or "wait".',
    '                                               confirmAll is for the adviser saying in words that ALL the answers on the whole form are verified or correct ("everything is fine, all the answers are verified", "I think we can verify all the answers"):',
    '                                               it marks every answer still waiting for the client as agreed, in every section. Give it only for those words, never for a "yes" to one read-back (that is "confirm").',
    '  {"do":"note","text":"- ...\n- ..."}           something for the notes box, WHOEVER says it (see "Notes" below)',
    '  {"do":"done","section":"<id>"}               a section is finished: the adviser says so, or the client has no more to add (see "Sections that are finished" below); for one list only: {"do":"done","list":"<list id>"}',
    '',
    'How to read the line:',
    '- Facts count whoever says them. The adviser saying "your first name is John" and the client saying "my surname is Peters" each fill a box. A full name fills the first name AND the surname.',
    '- A question about a box is an "ask" and comes before its answer: "do you have a work number? yes I do, it\'s [N2]" is [ask work, fill work [N2]]. A plain statement straight after a question answers position.field.',
    '- Corrections: people change their mind in the middle of a sentence ("oh no, I made a mistake, it\'s ...", "sorry, I mean ...", "my name is actually Jonathan"). Only the LAST version counts.',
    '  Give ONE fill with the final value, with "correction":true when it replaces something already in the box. Never join the old and the new value.',
    '- "No" boxes: boxes marked "none_box": true have a "No ..." tick box (home number, work number, personal email, work email). When the client does not have one ("I don\'t have a telephone at home", "no landline",',
    '  "I haven\'t got a work email") fill that box with the value "None". Several can be said in one line: one fill per box. Never give "None" to a box the client does give a value for.',
    '- Understand meaning, not exact words. Ignore filler, false starts and small talk. Give {"actions": []} for acknowledgements and small talk ("okay great", "thank you", "I see", "mm hm", "lovely"), but not for a section being finished (see "Sections that are finished" below).',
    '- Never invent a value that was not said, and never fill a box for something that is only being asked.',
    '- Only the newest line asks for something. Never repeat a fill for a value that is already in "filled" unless the newest line says it again as the answer to the box being asked about.',
    '- Only give "undo" or "clear" when the newest line asks for it in words ("scratch that", "undo", "clear that", "delete that", "delete the ..."). A correction is a fill with "correction":true, never an undo, and a comment or an unclear line asks for nothing.',
    '- Being addressed by name ("And Vanessa, are you a smoker?", "Paul, can I ask...") does not state a first name: fill the name boxes only when a name is given as the answer to a name question, or in "my name is ..." / "your name is ...".',
    '- Speech recognition garbles South African speech: "I know" is often "no" (read it from the question just asked); "$", "random" or "ren" mean rand; a figure split by a pause ("9000. 600") is one figure (9600); bank and company names come out wrong ("absent", "apps", "absolute" for Absa; "tax fee" for tax free): use the conversation to decide.',
    '- An amount in the past tense is not what the box holds now: "I used to put about 2000 a month" is the old figure, so fill nothing for the current monthly amount until the client says what it is now (0 if he says he has stopped).',
    '- "heard_alternatives" (when present) are other wordings the speech recogniser considered for the newest line; "newest" is its best guess and the right words are often in one of them ("broken record" or "Brokers on record"). Use them to work out what was really said, but fill nothing that only an alternative says unless it fits the question being asked.',
    '- Speech recognition garbles names and South African terms: "pt1 limited" is (Pty) Ltd, "chair holding" is shareholding, "University" is annuity, "text number" is tax number, "cold well" is wealth. When the line holds a word that sounds like a name already in "filled" (for example "confesses" or "offenses" for Kafentzis), use the spelling in "filled".',
    '- A box of a list ("debts", "kids", "risk" and so on, position.field such as "debts.prov") is only ever filled with a "cell" action (or a new row with "row"), never with "fill" and never with a field id like "debts.prov".',
    '- The form works out "Direct Net Income" (dnet) and "Disposable income" (disp) itself. When the adviser reads such a figure out ("according to the SARS calculator your direct net income is 291 757") it is not something the client said and it is not the take-home pay: give {"actions": []}. Take-home pay (net) is only what the client says they actually receive.',
    '- Money left over: "I am left with 90 000 after all my expenses" is NOT the expenses. When "filled" holds the take-home pay (net), the expenses (exp) are net minus that amount (net 290 000 minus 90 000 is 200 000): fill exp with the result. When net is not on the form yet, put it in "unplaced" instead.',
    '- Remarks about the form or the software itself ("that\'s a definite error", "the program ...", "it did not look up the company", "testing") are not facts, answers or questions: give {"actions": []}.',
    '- One line can move to another part of the form and carry on there: "let\'s talk about your investments. Do you have a tax free? Yes, an Old Mutual one, R3400 a month" is [section, row]. Everything said after the move',
    '  belongs to the boxes and lists of THAT section, which are all described in "fields" and "lists" whichever section is open now. Give every action of the line in one reply. Never stop after the "section" action.',
    '- Fragments. Speech arrives in pieces: a line can be only the start of a thought, or only the value that completes the line before it. Always read "newest" together with "recent", "position" and "filled".',
    '  A line that announces something and stops before saying it ("my surname is spelled", "let me spell it for you", "it\'s", "my number is", "give me a second") holds no value yet. Give {"do":"wait"} or an empty list,',
    '  and never fill a box with the announcing word itself ("spelled", "number", "second", "yes I do", "okay"). The next line then holds the value: a bare name, a spelled name, digits, a date, a yes.',
    '  When that next line answers the question or the announcement before it, fill that box with it, even if it is a single word ("Kafentzis" after "what is your surname?" or "my surname is spelled").',
    '  If the box already holds a wrong value left by an earlier fragment, fill it again with "correction":true. A name spelled out letter by letter ("K A F E N T Z I S") is one word: Kafentzis.',
    '- When unsure what a line means, work it out from the conversation: what was just asked (position.field), the last lines, and what is in "filled". Prefer waiting (an empty list) to guessing, and never put a word that is not a value into a box.',
    '',
    'Client priorities. The page "Client priorities and quotes needed" holds the areas the adviser recommends to the client: Life, RA, RGAR, Invest, EGAR, Medical Aid, Will and Short Term. Each has a decision box (ids pr_life, pr_ra, pr_rgar, pr_inv, pr_egar, pr_med, pr_will, pr_st)',
    'and a comments box (the same id with _cm on the end). The adviser raising an area ("I would recommend life cover", "what about a retirement annuity?", "we should look at your will") is an "ask" for its decision box.',
    'The client agreeing ("yes", "definitely", "go ahead", "that makes sense", "please do") fills the decision box with the option that starts "Priority"; the client declining ("not now", "I\'m not interested", "I already have that", "no thanks") fills it with the option that starts "Not a priority".',
    'For Life, RA and Invest (pr_life, pr_ra, pr_inv) there are two more options, both for a client who has not decided: "Client not sure, needs to think about it" ("I\'m not sure", "let me think about it", "I need to speak to my wife first", "maybe later, I\'ll come back to you")',
    'and "Client needs to check their budget" ("I need to check my budget", "let me see what I can afford", "I\'ll have to look at my budget first"). The reason goes in the comments box. The other areas have only the two options: leave their decision box empty when the client is undecided and put the reason in the comments.',
    'The reason or instruction that comes with it ("I can\'t afford it at the moment", "revisit in six months", "Valerie must call him on Monday") goes into that area\'s comments box (the _cm id) as a short note in the speaker\'s words, tidied; a decision and its reason in one line are two fills.',
    'The comments boxes hold reasons and instructions only: a fact about what the client has (a policy, a fund, a will) belongs in the boxes of the earlier pages, never in these.',
    'Life quotes come in two kinds, and every FNA, shortfall and reduced quote is one or the other. A "BrightRock Fractured" quote (boxes bf_fna_req, bf_fna_type, bf_sf_req, bf_sf_type and the list "bfred") is a needs-based quote from BrightRock alone, built on the BrightRock Risk Calculation page: it has no insurer box.',
    'A "Standard" quote (fna_req, fna_type, fna_ins, sf_req, sf_type, sf_ins and the list "redq") is the ordinary quote, asked of one or more insurers (any insurer, BrightRock too): the insurers are a tick-box box (fna_ins, sf_ins) whose "value" is every insurer named, joined with "; ", and a reduced quote row has one insurer.',
    'The words decide the kind: "fractured", "a fractured quote", "the BrightRock fractured FNA" mean BrightRock Fractured; "standard", or any insurer other than BrightRock named for a quote ("an FNA with Old Mutual and Discovery"), mean Standard. BrightRock named with "standard" is Standard (insurer "BrightRock (standard)"). When the line does not say which kind ("an FNA quote"), prefer the Standard box, and give {"do":"ask"} for the kind only when the line really leaves it open between the two.',
    'The standard quote details (lc_sa, lc_term, lc_aci ... for life cover; pd_ ... for permanent disability; ips_ ... for income protection; dds_ ... for dread disease) belong to a Standard quote: what to ask for. The fractured needs calculation boxes (lc_f_aci, pd_f_aci, ip_, dd_ ...) belong to the BrightRock Risk Calculation page.',
    '',
    'More rules from real meetings:',
    '- A box or column marked "free": true takes any value as said when none of its "options" fits (a bank such as FNB for a provider, a medical scheme that is not in the list): give the name as said. Never use "Other" to hide a name that was said.',
    '- "off" (when present) lists the boxes, and the lists ("list:<id>"), that are switched off on the form now, for example the quotes of an area the client said was not a priority. Give nothing for them,',
    '  unless the same reply first sets that area\'s decision box (pr_...) to "Priority: client agrees" because the line says it is a priority.',
    '- When the words fit more than one option and do not tell them apart ("out of community" fits both "...with accrual" and "...no accrual"), do not pick one: give {"do":"ask","field":"<id>"} so the adviser asks which. Never choose between options the client did not distinguish.',
    '- A name the client says about themselves is spelled exactly as it is in the CLIENT\'s own line, even when the adviser\'s lines spell it differently: the adviser and the client are on different microphones and the same name is heard in different spellings. Never change the client\'s spelling to match the adviser\'s.',
    '- A range is not a value: "between 30 and 40", "around 3 or 4" fill nothing. Wait for the figure that is settled ("okay, let\'s say 35").',
    '- A lone word from the adviser that answers nothing ("Okay", "Chai", "Childcare", "Wow") is noise: give {"actions": []}, and never add it to a text box.',
    '- "Years in this occupation" (years) takes the length as said ("since February 2022", "about four years", "18 months"): the page works out the number of years.',
    '',
    'Sections that are finished. The adviser works through the form section by section, so listen for a section being finished. It is NOT small talk, and it is not an answer to the box that was asked about before:',
    '- The adviser says so ("that concludes the debts", "that is the debts done", "we are done with the income", "that covers the health questions", "that is everything for this section", "we are done here"): give {"do":"done","section":"<id of that section, else position.section>"}.',
    '- The adviser asks whether there is MORE ("do you have any more debts?", "any other children?", "any other policies?", "is there anything else you want to tell me about your health?", "is that everything?") and the client declines ("no", "no, that\'s all", "nothing else", "that is everything", "just those"):',
    '  the "no" answers the question about more, so the list or section is finished: fill nothing, give {"do":"done","section":"<id>"} when the list is the whole section (debts, children, investments) or the question was about the whole section, and {"do":"done","list":"<list id>"} when the section holds several lists',
    '  (personal policies and group policies, retirement annuities and pension funds): that list is finished but the section is not. A question about a box that exists ("any other health issues?" is the box h_oth) is an "ask" for that box: its answer is that box\'s, not the end of a section.',
    '- A part of a page that holds several topics (the will on the page of medical aid, will and short-term insurance) can be finished without the page being finished: "that is the will done" gives nothing. The page is finished only when it is named ("that concludes the medical, will and short-term section") or the adviser says the section or the page is done.',
    '- One line can finish a section and go on: "that concludes the debts, let\'s talk about the children" is [done debts, section kids]; give the "done" first. A "done" that is only an acknowledgement, or only the client saying their own debts are paid off, is not a "done".',
    '- "position.concluded" (when present) lists the sections already finished. The client or adviser adding something to one of them ("oh wait, there is one more debt, a car loan with Wesbank", "I forgot, I also have a policy with Sanlam") reopens it: give a "section" action for it and the row or the fills. A bare "no", "okay" or "that\'s all" after a section was finished is small talk: give {"actions": []}.',
    '- "Okay, that\'s the notes done, now the children" is [notesOff, section kids]. While notes are being taken (see below) any wording that says the notes are finished ("I\'ve noted that, I\'ve completed those notes", "that\'s everything I wanted to note", "okay, that\'s the notes") is notesOff and is never itself noted.',
    '',
    'Policy schedules. The boxes ps_risk, ps_grp, ps_ra, ps_pp and ps_inv ("Request Current Policy Schedule(s)" for the personal risk policies, group risk, retirement annuities, pension and provident funds, investments) are tick-box boxes (marked "multi": true):',
    'they take one or more of their options, given joined with "; " ("Requested from client in meeting; Draw from Astute (with signed LOA)"), and are empty while it has not been asked. "The client will send them" is "Requested from client in meeting";',
    '"we will get them from Astute", "through Astute" is "Draw from Astute (with signed LOA)" (group risk has no Astute option); something else ("her employer will email it") is "Other", with the words in the box ps_..._ot (ps_risk_ot, ps_grp_ot and so on).',
    'Only ever give the options that were said; a later "and Astute as well" adds to what is there. "Can we send you a LOA to sign?" is the box loa (Yes, No, Not now: "not now", "maybe later" is "Not now").',
    '',
    'Facts with no box. When the newest line states a fact about the client\'s situation that belongs on the form (an amount, a name, a date, a product, a plan, a reason) but you cannot put it in any box or list column of "fields" and "lists" (there is no such box, or you cannot tell which one),',
    'add it to the reply as {"actions": [...], "unplaced": [{"text": "short point in plain words, the figures as said", "section": "<id of the section it belongs in, if you can tell>"}]} so the adviser can see it. Give one entry per fact.',
    'Never put in "unplaced" small talk, a question, an acknowledgement, a remark about the software, something you already gave as an action, or a value that is already in "filled". Leave "unplaced" out when there is nothing.',
    '',
    'Notes. "let me take some notes", "I\'d like to make a couple of notes about ...", "note that down" start the notes (cmd notes). The notes box takes what you give it in "note" actions, so when the line holds the thing to be noted, ALSO give it:',
    '"I\'d like to make a couple of notes about the Old Mutual tax free. The client told me it is for his son\'s university fees when he turns 18" is',
    '[{"do":"cmd","cmd":"notes"}, {"do":"note","text":"- Old Mutual tax free: for his son\'s university fees\n- To be used when the son turns 18"}]. Never stop at the notes command when more was said.',
    'Start the notes only when someone says they want to take, make or add notes, or to note something down. "In the notes", "scratch the notes" and "delete the notes" are not requests to start them.',
    'Write the note in short points, one per line, each starting with "- ", with every fact that was said (names, amounts, ages, reasons, dates) and nothing that was not. Leave out the adviser\'s questions, small talk, and any ID, phone or tax number or email address.',
    '"Note that down" on its own, with nothing new in the line, is {"do":"cmd","cmd":"notes","retro":true} with no "note" action: the page takes the last thing said. Someone saying "make a note that he smokes" is [cmd notes, note "- Smokes"].',
    '',
    'Confirming. "awaiting_confirmation" lists the boxes (and rows of lists) that were filled by voice and still wait for the client to agree; a box with "private": true is listed without its value.',
    'When the client agrees to what is on the form ("yes", "that\'s right", "correct", "exactly", "yes it is") in answer to a value that was read back or a question such as "is that right?", give one',
    '{"do":"confirm","field":"<id>"} for EVERY listed box that the read-back or question covered: "so that\'s John Snow?" "yes" confirms the first name and the surname; "is your cell still [N1]?" "yes" confirms the cell number.',
    'For a row of a list use {"do":"confirm","list":"<list id>","row":<row number>}. A bare "yes" confirms only what the line just before it (see "recent") read back or asked about: "is that right?", "so that\'s R950 000?", "I\'m assuming the owner is Mister, right?".',
    'A "yes", "yeah" or "uh huh" that answers nothing read back (the client acknowledging what the adviser said, or while the adviser writes) confirms nothing: give {"actions": []}.',
    'The adviser repeating a value the client has just given ("950 000. Perfect.", "so R3000 a month") is an echo, not agreement and not a new fact: give {"actions": []}. Only the client\'s own yes confirms.',
    'Never confirm a box nobody talked about, and never confirm what the client said no to or changed: a different value is a fill with "correction":true, and a "no" without the new value is "wait".',
    'A read-back is NOT agreement. When the adviser says a value back and asks whether it is right ("I just want to confirm you said R150 000, correct?", "her name is Vicky Zachos, right?", "so your cell is [N1], is that correct?"),',
    'even if no question mark was written, the line is only {"do":"ask","field":"<id>"} for that box: never confirm in the same line. The client agrees in a LATER line ("yes", "that\'s right"), and that line is the confirm.',
    'A mere acknowledgement ("okay", "mm hm", "I see", "great") is not agreement: it asks for nothing to be confirmed.',
    'The client saying in a statement that something on the form is correct, with no value in it ("my personal email address is also correct", "the cell number is right", "my surname is fine"), IS agreement: confirm the box it names, and for "that\'s all correct" the boxes the read-back covered.',
    '',
    'Values:',
    '- A box with "options": the value must be exactly one of the options. If none fits, leave it out.',
    '- Amounts: digits only, for example 85000. Dates: YYYY-MM-DD. Percentages and years: a number. Names: just the name, capitalised, without "my name is" around it.',
    '  Otherwise use the client\'s own words, tidied (for example "Discovery", "Underwriter"). Never add words that were not said.',
    '',
    'Private values. ID numbers, phone numbers, tax numbers and email addresses are never shown to you. Where one was said, the line shows a marker such as [N1] (a number) or [E1] (an email address),',
    'and "private_values" says what kind each looks like, for example "10 digits, starts like a cell number". Boxes marked "private": true take ONLY a marker as their value: {"do":"fill","field":"cell","value":"[N1]"}',
    '(or "None" for a "No" box). Never write digits or an address yourself, and never put two markers in one value. A cell number is 10 digits starting 06, 07 or 08; a work or home number usually starts 01 to 05;',
    'an ID number has 13 digits; a tax number is often 10 digits but a number said right after "tax number" is the tax number whatever its length. When a number is said and then corrected, use the marker of the LAST one. "filled_private" lists the private boxes that already hold a value (the values are not shown).',
    'Speech-to-text often leaves the first part of an email address outside the marker: the client says "jonathan snow at discovery dot co dot za" and the line reads "my work email is Jonathan [E1]".',
    'When the word or words right before an [E] marker are clearly the start of the address (a name, not a word like "is", "my", "email", "address", "at" or "on"), give them in front of the marker, separated by a space:',
    '{"do":"fill","field":"wemail","value":"Jonathan [E1]"}. Use only words that are really there, immediately before the marker. Otherwise give the marker alone.',
    'A plain "my email" or "email address" is the personal email (pemail); "work email" or "office email" is the work email (wemail). A plain "my number" or "cell" is the cell number, an "office" or "work" number is the work number.',
    '',
    'Some sections hold LISTS of rows: children, debts, existing personal and group policies, retirement annuities, pension and provident funds, investments, business assurance policies, partners and shareholders, quotes. "lists" describes every list of the form: its section, its columns, and the rows already there (row numbers start at 1).',
    'Three more actions work on lists:',
    '  {"do":"row","list":"<list id>","values":{"<column id>":"<value>", ...}}   someone introduces a NEW row and says things about it ("we have a daughter, Thandi, born 22 August 2019")',
    '  {"do":"cell","list":"<list id>","row":<row number or "last">,"col":"<column id>","value":"..."}   a value for one box of a row that is already there ("the balance on the bond is R450 000")',
    '  {"do":"ask","list":"<list id>","row":<row number, "last" or "new">,"col":"<column id>"}   someone asks about one box of a row',
    'If position.field looks like "kids.dob" with a position.row, the client\'s plain answer belongs in that box: use a "cell" action for it.',
    'On a row of the partners and shareholders list (position.field "shares.name" and so on) the ID number, cell number and shareholding said about that person belong to the row ("cell" actions, col id, cell, pct), never to the client\'s own boxes (idno, cell, tax, biz_pct).',
    'Two children said in one breath are two "row" actions. Never add a row that is already in "lists" (the same child, the same loan): use "cell" for anything new about it. For a column with "options", the value must be one of them.',
    '"cell" and "ask" only work on rows that are in "lists". If the row is not there yet, add it with a "row" action and put everything said about it in its values.'
  ].join('\n');
  /* Added to the instructions while sharing is on: it replaces what is said above about markers and private boxes. */
  var SHARE_NOTE = [
    '',
    'SHARING IS ON for this session. ID numbers, phone numbers, tax numbers and email addresses are NOT hidden from you: they appear in the line, in "filled" and in "awaiting_confirmation" exactly as they are, and there are no [N1] or [E1] markers and no "private" boxes.',
    'Ignore everything above about markers. Give the real value in "value": digits for a number (a cell number written like 082 454 1751, an ID number as 13 plain digits, a tax number as 10 plain digits) and the address for an email. Spoken digits ("zero eight two four five four ...") are written as digits.',
    'A spoken edit of a number that is already in a box ("add an 8 to the end", "put a zero in front", "the last digit is 8", "it ends in 98", "remove the last digit") is ONE fill with the complete new number and "correction":true.',
    'When the adviser reads a number back and asks the client to confirm it ("is that correct?", "can you confirm your ID number?") that is only an "ask": never confirm it until the client agrees in a later line. A number the client simply states is a fill, never a confirm.'
  ].join('\n');

  /* Anything private in a line (an email address, a phone / ID / account number, written or spoken) is swapped for a marker.
     generic: [number] and [email], for lines that only give context. Otherwise [N1], [E1] ... with the real values kept in the vault, and a
     short description of each, so Claude can tell a cell number from a landline or an ID without ever seeing the digits. */
  var DIGITWORD = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)';
  var PLAIN = /^(?:r|id|is|no|at|in|on|to|or|my|it|as|am|an|be|by|do|go|he|if|me|of|so|up|us|we)$/i;      // not a passport prefix: money (R450000), plain words
  var NUMBER_CUE = /\b(?:tax|sars|reference|number|account|id|passport|phone|cell|mobile|telephone|landline|policy)\b[^.!?]*$/i;       // words that say the digits just after them are a private number
  function kindOf(d) {
    if (d.length === 13) return '13 digits, the length of an ID number';
    if (/^0[6-8]\d{8}$/.test(d)) return '10 digits, starts like a cell number';
    if (/^0[1-5]\d{8}$/.test(d)) return '10 digits, starts like a landline number';
    if (/^27[6-8]\d{9}$/.test(d)) return d.length + ' digits, starts like a cell number with +27';
    return d.length + ' digits';
  }
  function shield(text, generic) {
    if (share) return { text: String(text == null ? '' : text), vault: {}, list: [] };                    // sharing is on: nothing is hidden
    var t = String(text == null ? '' : text), vault = {}, list = [], nN = 0, nE = 0;
    function hold(kind, raw, desc) {
      if (generic) return kind === 'E' ? '[email]' : '[number]';
      var k = kind + (kind === 'E' ? ++nE : ++nN);
      vault[k] = raw; list.push({ id: k, kind: desc });
      return '[' + k + ']';
    }
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, function (m) { return hold('E', m, 'email address'); });
    t = t.replace(/\b[\w.+-]+(?:\s+(?:dot|underscore|dash|hyphen)\s+[\w.+-]+)*\s+at\s+[\w-]+(?:\s+dot\s+[\w-]+)+\b/gi, function (m) { return hold('E', m, 'email address'); });
    t = t.replace(/\+?\d(?:[ \t-]?\d){6,}/g, function (m, off, all) {
      var d = m.replace(/\D/g, ''), before = all.slice(Math.max(0, off - 3), off), lead = all.slice(Math.max(0, off - 50), off);
      if (/(?:^|[^A-Za-z])[Rr]\s?$/.test(before)) return m;                                      // an amount of money ("R1 250 000")
      if (/^(?:0[1-9]|[12]\d|3[01])[ \t-](?:0[1-9]|1[0-2])[ \t-](?:19|20)\d\d$/.test(m)) return m;     // a date said as "05 03 1980"
      if (d.length >= 9 || (d.length >= 7 && d.charAt(0) === '0')) return hold('N', m, kindOf(d));
      if (d.length <= 12 && NUMBER_CUE.test(lead) && !/[A-Za-z]-?$/.test(before)) return hold('N', m, kindOf(d));                   // "my tax number is 554-7259": a shorter number, but said as a number
      return m;
    });
    t = t.replace(/(^|[^A-Za-z0-9])([A-Za-z]{1,2})[ \t-]?(\d(?:[ \t-]?\d){5,})(?!\d)/g, function (m, pre, letters) {         // a passport number: letters then digits
      return PLAIN.test(letters) ? m : pre + hold('N', m.slice(pre.length), 'letters then digits, like a passport number');
    });
    t = t.replace(new RegExp('\\b(?:([A-Za-z]{1,2})[\\s,-]+)?(' + DIGITWORD + '(?:[\\s,-]+' + DIGITWORD + '){5,})\\b', 'gi'), function (m, letters, run) {
      var d = V.spokenDigits(run);
      if (letters && !PLAIN.test(letters) && d.length >= 6) return hold('N', m, 'letters then digits, like a passport number');
      return d.length >= 7 ? (letters ? letters + ' ' : '') + hold('N', run, kindOf(d)) : m;
    });
    return { text: t, vault: vault, list: list };
  }
  function scrub(t) { return shield(t, true).text; }

  /* Every list of the form, whichever section is open (a line can move to another section and carry on there): the section it is in, its columns
     (private ones marked, their values never shown) and the rows already in it. */
  function listsFor(idx, ctx) {
    var out = [];
    Object.keys(idx.lists).forEach(function (key) {
      var L = idx.lists[key];
      var cols = L.cols.map(function (id) {
        var c = idx.byId[id], o = { id: c.k, label: c.label };
        if (c.options) o.options = c.options;
        if (c.options && c.free) o.free = true;
        if (!share && V.PRIVATE_IDS.indexOf(id) >= 0) o.private = true;
        return o;
      });
      var open = cols.filter(function (c) { return !c.private; });
      var rows = (ctx.listRows ? ctx.listRows(key) : []).slice(0, 10).map(function (d, i) {
        var v = {}; open.forEach(function (c) { if (d[c.id] != null && String(d[c.id]).trim() !== '') v[c.id] = scrub(d[c.id]); });
        return { n: i + 1, values: v };
      });
      out.push({ id: key, section: L.sec, title: L.title, columns: cols, rows: rows });
    });
    return out;
  }
  /* Left to itself the model thinks before it answers, which takes seconds for a short JSON reply. Where the model allows it, thinking is switched off for these requests:
     Haiku 5.5 takes "disabled", Sonnet 5.5 takes "between_tools" (its way of saying no thinking), and Opus 5.5 cannot switch it off (low effort keeps it short). */
  function thinkingFor(model) { return model === 'claude-haiku-5-5' ? { type: 'disabled' } : model === 'claude-sonnet-5-5' ? { type: 'between_tools' } : null; }
  function withThinking(req) { var t = thinkingFor(req.model); if (t) req.thinking = t; return req; }
  /* ctx: { sectionId, targetId, targetRow, targetValue, filled: {id: value}, filledPrivate: [ids], listRows(key), recent: [{who, text}] }; text/who are the newest line.
     -> { req, vault }: the request, and the real values behind the markers in the newest line (kept here, never sent). */
  function prepare(idx, ctx, who, text, model) {
    var sh = shield(text), priv = function (id) { return !share && V.PRIVATE_IDS.indexOf(id) >= 0; };
    var fields = idx.fields.filter(function (f) { return !f.list; }).map(function (f) {
      var o = { id: f.id, label: f.label, section: f.sec };
      if (priv(f.id)) o.private = true;
      if (f.none) o.none_box = true;
      if (f.options) o.options = f.options;
      if (f.options && f.free) o.free = true;
      if (f.multi) o.multi = true;
      return o;
    });
    var filled = {};
    Object.keys(ctx.filled || {}).forEach(function (id) { if (!priv(id)) filled[id] = scrub(String(ctx.filled[id])).slice(0, 120); });
    var tPriv = !!ctx.targetId && priv(ctx.targetId), body = {
      position: { section: ctx.sectionId, field: ctx.targetId || null, row: ctx.targetRow || null, current_value: ctx.targetId && !tPriv && ctx.targetValue ? scrub(ctx.targetValue) : null },
      lists: listsFor(idx, ctx),
      sections: idx.sections.map(function (x) { return { id: x.id, title: x.title }; }),
      fields: fields,
      filled: filled,
      filled_private: (ctx.filledPrivate || []).filter(priv),
      recent: (ctx.recent || []).map(function (l) { return { who: l.who, text: scrub(l.text) }; }),
      newest: { who: who === 'client' ? 'client' : who === 'auto' ? 'unclear' : 'adviser', text: sh.text }
    };
    var alts = (ctx.alternatives || []).slice(0, 2).map(function (x) { return scrub(String(x)).slice(0, 300); }).filter(function (x) { return x && x !== sh.text; });
    if (alts.length) body.heard_alternatives = alts;                  // what else the speech recogniser thought it heard for the newest line (numbers and addresses hidden the same way)
    var awaiting = (ctx.awaiting || []).slice(0, 16).map(function (a) {
      var o = a.list ? { list: a.list, row: a.row } : { id: a.id };
      if (a.label) o.label = a.label;
      if (a.private) o.private = true; else if (a.value != null) o.value = scrub(String(a.value)).slice(0, 80);
      return o;
    });
    if (awaiting.length) body.awaiting_confirmation = awaiting;
    var off = Object.keys(ctx.hidden || {}); if (off.length) body.off = off;                      // the boxes (and "list:<id>") switched off on the form now: kept out of "fields", which never changes, so it can be remembered
    if (ctx.note) body.note = String(ctx.note);
    if (tPriv) body.position.box_has_value = !!ctx.targetFilled;
    if (ctx.concluded && ctx.concluded.length) body.position.concluded = ctx.concluded.slice(0, 14);                  // the sections the adviser has already said are finished
    if (sh.list.length) body.private_values = sh.list;
    var vault = { _line: String(text == null ? '' : text), _sent: sh.text, _held: ctx.privateHeld || {} };                                      // the line itself (to check the words in front of an email marker), what was sent (to recover a number that was sent unshielded) and the values already in the private boxes waiting to be confirmed (to check a read-back against; never sent)
    Object.keys(sh.vault).forEach(function (k) { vault[k] = sh.vault[k]; });
    var rest = {}; Object.keys(body).forEach(function (k) { if (k !== 'sections' && k !== 'fields') rest[k] = body[k]; });
    return { req: withThinking({ model: model, max_tokens: 900, output_config: { effort: 'low' }, system: share ? SYSTEM + '\n' + SHARE_NOTE : SYSTEM, messages: [{ role: 'user', content: JSON.stringify(body) }] }), vault: vault,        // low effort and no thinking: the models think before answering unless told otherwise (Sonnet 5.5 at high), which is slow and billed as output
      parts: [JSON.stringify({ sections: body.sections, fields: body.fields }), JSON.stringify(rest)] };        // the same JSON in two pieces: what never changes during a conversation, and what does
  }
  /* The request as sent with a key. The instructions and the form's boxes never change during a conversation, so Anthropic is asked to remember them
     for an hour (a call can pause for longer than the usual five minutes): each line is then answered sooner and for less. (A host that reaches Claude without a key gets the plain request.) */
  function cachedRequest(prep) {
    return Object.assign({}, prep.req, { messages: [{ role: 'user', content: [{ type: 'text', text: prep.parts[0], cache_control: { type: 'ephemeral', ttl: '1h' } }, { type: 'text', text: prep.parts[1] }] }] });
  }
  function buildRequest(idx, ctx, who, text, model) { return prepare(idx, ctx, who, text, model).req; }

  /* The model sometimes writes an answer, then "Wait, correcting that" and a second answer. The whole span is tried first; failing that, every complete {...} in the reply is tried and the LAST one that holds
     "actions" wins (the correction), else the last one that parses. */
  function extractJson(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* more than one object, or text between them */ }
    var found = [], depth = 0, start = -1, inStr = false, esc = false, i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { if (depth > 0) inStr = true; }
      else if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}' && depth > 0) { depth--; if (depth === 0) { try { found.push(JSON.parse(s.slice(start, i + 1))); } catch (e2) { /* not an answer */ } } }
    }
    var withActions = found.filter(function (o) { return o && typeof o === 'object' && Array.isArray(o.actions); });
    return withActions.length ? withActions[withActions.length - 1] : (found.length ? found[found.length - 1] : null);
  }
  function textOf(resp) {
    return (resp.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ');
  }

  var EMAIL_LEAD = /^(?:is|are|it|its|it's|my|our|email|e-mail|mail|address|at|on|me|to|and|or|the|a|an|work|personal|private|office|business|use|using|via|send|sent|contact|reach|for|from)$/i;   // words that lead into an address but are not part of it
  var CMDS = { undo: { type: 'undo' }, next: { type: 'next' }, prev: { type: 'prev' }, nextSection: { type: 'nextSection' }, prevSection: { type: 'prevSection' }, clear: { type: 'clear' }, clearAll: { type: 'clearAll' }, notesOff: { type: 'notesOff' }, confirmAll: { type: 'confirmAll' } };
  /* "unplaced": facts the model heard but could not put in a box. Markers are swapped for the real values (they stay on this computer). -> [{ text, section }] */
  function unplacedOf(raw, idx, vault) {
    if (!raw || !Array.isArray(raw.unplaced)) return [];
    var out = [];
    raw.unplaced.forEach(function (u) {
      var t = u && typeof u === 'object' ? u.text : (typeof u === 'string' ? u : '');
      if (typeof t !== 'string') return;
      t = t.replace(/\[((?:N|E)\d+)\]/g, function (m, k) { return vault && vault[k] != null ? vault[k] : ''; }).replace(/\s+/g, ' ').trim().slice(0, 240);
      if (t.length < 3) return;
      var sec = u && typeof u === 'object' && typeof u.section === 'string' && idx.sections.some(function (x) { return x.id === u.section; }) ? u.section : null;
      out.push({ text: t, section: sec });
    });
    return out.slice(0, 6);
  }
  /* Only ids that exist get through. A private box takes only a marker (swapped for the real value here) or "None".
     -> { kind: 'actions', actions } | { kind: 'point', field, section } | { kind: 'answers', answers, waiting } | { kind: 'none' } */
  function normalize(raw, idx, who, vault) {
    if (!raw || typeof raw !== 'object') return { kind: 'none' };
    var isPriv = function (id) { return !share && V.PRIVATE_IDS.indexOf(id) >= 0; };
    var okField = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list && !isPriv(id); };
    if (who === 'auto' || Array.isArray(raw.actions)) {
      var okAny = function (id) { return typeof id === 'string' && idx.byId[id] && !idx.byId[id].list; };
      var okList = function (id) { return typeof id === 'string' && idx.lists[id]; };
      var okCol = function (l, k) { return typeof k === 'string' && idx.byId[l + '.' + k]; };
      var rowRef = function (r, allowNew) { return typeof r === 'number' && r >= 1 && r <= 50 ? Math.floor(r) : (allowNew && r === 'new' ? 'new' : 'last'); };
      /* A "yes" to a private box is accepted unless a number was read back that is not the one in the box: then it is not agreement with what is there. */
      var agreeable = function (id) {
        var held = isPriv(id) && vault && vault._held && vault._held[id];
        if (!held) return true;
        var said = Object.keys(vault).filter(function (k) { return /^N\d+$/.test(k); });
        return !said.length || said.some(function (k) { return String(vault[k]).replace(/\D/g, '') === String(held).replace(/\D/g, ''); });
      };
      var okSec = function (id) { return typeof id === 'string' && idx.sections.some(function (x) { return x.id === id; }); }, acts = [];
      /* A value for box id: a marker is swapped for what was really said; a private box takes nothing else (but "None" for a "No" box). */
      var clean = function (id, v) {
        if (v == null) return null;
        var s = String(v).trim(), m = /^\[((?:N|E)\d+)\]$/.exec(s);
        if (!s) return null;
        if (m) return vault && vault[m[1]] != null ? vault[m[1]] : null;
        var pre = /^([A-Za-z][A-Za-z0-9._-]*(?:\s+[A-Za-z][A-Za-z0-9._-]*){0,2})\s+\[(E\d+)\]$/.exec(s);                  // "Jonathan [E1]": the start of the address was left outside the marker
        if (pre) {
          var raw = vault && vault[pre[2]], low = function (x) { return String(x).toLowerCase().replace(/\s+/g, ' '); };
          return raw != null && vault._line && low(vault._line).indexOf(low(pre[1] + ' ' + raw)) >= 0 && !EMAIL_LEAD.test(pre[1].split(/\s+/).pop()) ? pre[1] + ' ' + raw : null;
        }
        if (/\[(?:N|E)\d+\]|\[number\]|\[email\]/.test(s)) return null;
        if (id === 'years' && V.yearsValue) return V.yearsValue(s);                                        // "since February 2022" is 4.7 years, not 2022
        if (isPriv(id)) {
          if (/^none$/i.test(s) && idx.byId[id] && idx.byId[id].none) return 'None';
          return /^[\d\s\-+().]{5,}$/.test(s) && vault && vault._sent && vault._sent.indexOf(s) >= 0 ? s : null;     // digits are taken only if they went out in the line as plain text (nothing was hidden): then the model really saw them
        }
        return s;
      };
      /* A box of a list written as a plain box: {"do":"fill","list":"debts","row":1,"col":"prov"} or {"do":"fill","field":"debts.prov"} (the form of position.field). Both mean the "cell" action. */
      var listForm = function (a) {
        if (!a || typeof a !== 'object') return a;
        var m = typeof a.field === 'string' ? /^(\w+)\.(\w+)$/.exec(a.field) : null, list = a.list || (m && okList(m[1]) ? m[1] : null), col = a.col || (m && m[2]) || null;
        if (!list || !okList(list) || !col || !okCol(list, col) || (a.do !== 'fill' && a.do !== 'ask' && a.do !== 'empty' && a.do !== 'confirm')) return a;
        var b = { do: a.do === 'fill' ? 'cell' : a.do, list: list, col: col, row: a.row == null ? 'last' : a.row };
        if (a.value != null) b.value = a.value;
        if (a.correction === true) b.correction = true;
        return b;
      };
      if (Array.isArray(raw.actions)) raw.actions.map(listForm).forEach(function (a) {
        if (!a || typeof a !== 'object') return;
        var v, vals;
        if (a.do === 'ask' && okAny(a.field)) acts.push({ do: 'ask', field: a.field });
        else if (a.do === 'section' && okSec(a.section)) acts.push({ do: 'section', section: a.section });
        else if (a.do === 'fill' && okAny(a.field) && (v = clean(a.field, a.value)) != null) acts.push({ do: 'fill', field: a.field, value: v, explicit: a.correction === true });
        else if (a.do === 'confirm' && okAny(a.field)) { if (agreeable(a.field)) acts.push({ do: 'confirm', field: a.field }); }
        else if (a.do === 'confirm' && okList(a.list)) acts.push({ do: 'confirm', list: a.list, row: rowRef(a.row, false) });
        else if (a.do === 'note' && typeof a.text === 'string' && (v = a.text.replace(/\[((?:N|E)\d+)\]/g, function (m, k) { return vault && vault[k] != null ? vault[k] : ''; }).replace(/[ \t]+\n/g, '\n').trim())) acts.push({ do: 'note', text: v, ready: true });   // the points Claude wrote for the notes box (a number or address that was held back is put back here, on this computer)
        else if (a.do === 'fill' && okAny(a.field) && typeof a.value === 'string' && !a.value.trim()) acts.push({ do: 'empty', field: a.field });                      // an empty value, or "empty": one box is to be emptied ("delete his name")
        else if (a.do === 'empty' && okAny(a.field)) acts.push({ do: 'empty', field: a.field });
        else if ((a.do === 'cell' || a.do === 'empty') && okList(a.list) && okCol(a.list, a.col) && (a.do === 'empty' || (typeof a.value === 'string' && !a.value.trim()))) acts.push({ do: 'empty', list: a.list, row: rowRef(a.row, false), col: a.col });
        else if (a.do === 'wait') acts.push({ do: 'wait' });
        else if (a.do === 'done' && (okSec(a.section) || okList(a.list) || (a.section == null && a.list == null))) acts.push({ do: 'done', section: okSec(a.section) ? a.section : null, list: okList(a.list) ? a.list : null, via: 'claude' });       // a section (or one list of it) is finished
        else if (a.do === 'cmd' && a.cmd === 'notes') acts.push({ do: 'cmd', cmd: { type: 'notes', retro: a.retro === true, box: null } });
        else if (a.do === 'cmd' && typeof a.cmd === 'string' && CMDS.hasOwnProperty(a.cmd)) acts.push({ do: 'cmd', cmd: { type: CMDS[a.cmd].type } });
        else if (a.do === 'row' && okList(a.list) && a.values && typeof a.values === 'object') {
          vals = {}; Object.keys(a.values).forEach(function (k) { if (okCol(a.list, k) && (v = clean(a.list + '.' + k, a.values[k])) != null) vals[k] = v; });
          if (Object.keys(vals).length) acts.push({ do: 'row', list: a.list, values: vals });
        }
        else if (a.do === 'cell' && okList(a.list) && okCol(a.list, a.col) && (v = clean(a.list + '.' + a.col, a.value)) != null) acts.push({ do: 'cell', list: a.list, row: rowRef(a.row, false), col: a.col, value: v, explicit: a.correction === true });
        else if (a.do === 'ask' && okList(a.list) && okCol(a.list, a.col)) acts.push({ do: 'ask', list: a.list, row: rowRef(a.row, true), col: a.col });
      });
      else {                                                    // an answer in the older shape is still understood
        if (okField(raw.field)) acts.push({ do: 'ask', field: raw.field }); else if (okSec(raw.section)) acts.push({ do: 'section', section: raw.section });
        (Array.isArray(raw.answers) ? raw.answers : []).forEach(function (a) {
          if (a && okField(a.field) && a.confirm === true) acts.push({ do: 'confirm', field: a.field });
          else if (a && okField(a.field) && a.value != null && String(a.value).trim() !== '') acts.push({ do: 'fill', field: a.field, value: String(a.value).trim() });
        });
      }
      var gone = unplacedOf(raw, idx, vault), res = acts.length ? { kind: 'actions', actions: acts } : { kind: 'none' };
      if (gone.length) res.unplaced = gone;                                                    // only when there is something, so every other answer keeps its shape
      return res;
    }
    if (who !== 'client') {
      var field = okField(raw.field) ? raw.field : null;
      var section = typeof raw.section === 'string' && idx.sections.some(function (s) { return s.id === raw.section; }) ? raw.section : null;
      return field || section ? { kind: 'point', field: field, section: section } : { kind: 'none' };
    }
    var answers = (Array.isArray(raw.answers) ? raw.answers : []).filter(function (a) { return a && okField(a.field) && (a.confirm === true || (a.value != null && String(a.value).trim() !== '')); })
      .map(function (a) { return { field: a.field, confirm: a.confirm === true, value: a.confirm === true ? null : String(a.value).trim() }; });
    return { kind: 'answers', answers: answers, waiting: raw.waiting === true && !answers.length };
  }

  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : '';
    if (status === 401) return 'the API key was not accepted';
    if (status === 429) return 'too many requests just now';
    return msg || 'error ' + status;
  }

  /* A reply that takes too long is given up on, so a slow connection never holds up the conversation (the page falls back to its own reading). */
  function callModel(opts, req) {
    var ms = opts.timeoutMs || 25000, timer, hedge, slow = new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('Claude took too long to answer')); }, ms); });
    var first = callModel0(opts, req), answer = first;
    if (opts.hedgeMs) {                                            // an occasional call takes 6 to 9 seconds where most take 1 to 2: after hedgeMs a second request is sent and the first answer back is used
      answer = new Promise(function (resolve, reject) {
        var open = 1, done = false, win = function (v) { if (!done) { done = true; resolve(v); } }, lose = function (e) { open--; if (open <= 0 && !done) reject(e); };
        first.then(win, lose);
        hedge = setTimeout(function () { open++; callModel0(opts, req).then(win, lose); }, opts.hedgeMs);
      });
    }
    return Promise.race([answer, slow]).then(function (v) { clearTimeout(timer); clearTimeout(hedge); return v; }, function (e) { clearTimeout(timer); clearTimeout(hedge); throw e; });
  }
  /* Sends one request and resolves to the model's text. opts: { apiKey, fetchImpl } or { ask } (a host that reaches Claude without a key). */
  function callModel0(opts, req) {
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    if (opts.ask) {
      return Promise.resolve().then(function () { return opts.ask(req.system, req.messages[0].content); }).then(null, function (e) {
        throw new Error(e && e.code === 'not_granted' ? 'Claude was not allowed on this page' : (e && (e.message || e.code)) || 'no connection');
      });
    }
    if (!opts.apiKey) return Promise.reject(new Error('no API key'));
    function send(r) {
      return doFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(r)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok && res.status === 400 && r.thinking && /thinking/i.test(friendly(res.status, body))) { var r2 = Object.assign({}, r); delete r2.thinking; return send(r2); }      // the model did not accept the thinking setting: ask again without it
          if (!res.ok) throw new Error(friendly(res.status, body));
          return textOf(body);
        });
      }, function () { throw new Error('no connection'); });
    }
    return send(req);
  }

  /* Asks Claude to read the unchanging part of the request now (nothing is written back), so the first real line finds it remembered and is answered at once.
     The request is the real one with an empty line in place of the conversation: the same model, effort and thinking, so it lands in the same place in the memory. */
  function warm(opts) {
    if (!opts.apiKey) return Promise.resolve(false);
    var prep = prepare(opts.idx, { sectionId: 'info', recent: [], listRows: function () { return []; } }, 'auto', '', opts.model), r = cachedRequest(prep);
    r.messages[0].content[1].text = '{"warming_up":true}'; r.max_tokens = 0;
    return callModel(opts, r).then(function () { return true; }, function () { return false; });
  }
  /* A clear answer can be put on the form before Claude has read the line, and Claude then checks it. This compares what was put there (local) with what Claude says:
     agree is true unless Claude fills one of those boxes with a different value, or puts the same value in another box (a number said for the work phone, not the cell). Claude saying nothing
     about a box is not a disagreement: the box keeps what was heard, still amber to be confirmed. Claude saying "wait" is: the line was not a value yet. (Taking it back made a cell number vanish whenever Claude had nothing to add.)
     rest is what Claude says besides (those fills left out, as they are already done). When Claude reads the line differently, rest is all of Claude's answer: the page takes its own fills back first. */
  function reconcile(local, claude, idx) {
    var norm = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ''); };
    var mine = {}, theirs = {};
    local.forEach(function (a) {
      if (a.do !== 'fill' || !a.res) return;
      mine[a.field] = norm(a.res.value);
      (a.res.extra || []).forEach(function (x) { mine[x.id] = norm(x.value); });
    });
    claude.forEach(function (a) {
      if (a.do !== 'fill') return;
      var f = idx.byId[a.field], x = f ? V.interpret(f, a.value) : null;
      theirs[a.field] = norm(x && !x.error ? x.value : a.value);
    });
    var ids = Object.keys(mine), retract = ids.length > 0 && claude.some(function (a) { return a.do === 'wait'; });        // Claude says there is nothing to fill yet: what the page put in was a guess
    var agree = !retract && ids.every(function (id) { return theirs[id] === undefined || theirs[id] === mine[id]; }) &&
      !Object.keys(theirs).some(function (id) { return mine[id] === undefined && ids.some(function (m) { return mine[m] === theirs[id]; }); });
    return { agree: agree, rest: agree ? claude.filter(function (a) { return !(a.do === 'fill' && mine[a.field] !== undefined && theirs[a.field] === mine[a.field]); }) : claude };
  }

  /* opts: { apiKey | ask, model, idx, who, text, ctx, fetchImpl } -> Promise of the normalized answer. */
  function decide(opts) {
    var prep = prepare(opts.idx, opts.ctx || {}, opts.who, opts.text, opts.model);
    return callModel(opts, opts.ask ? prep.req : cachedRequest(prep)).then(function (text) { return normalize(extractJson(text), opts.idx, opts.who, prep.vault); });
  }

  /* The catch-up check: the whole conversation (or the part since a section was entered) read again against the form as it is now, to find what was said and never reached a box.
     Only boxes that are empty are ever filled from it; anything else it finds is handed back as "unplaced" for the adviser. */
  var SWEEP_SYSTEM = [
    'You check a Fact Find form against the conversation it was filled from. A financial adviser spoke with a client; the form was filled live while they talked, and some of what was said never reached a box.',
    'You receive JSON: "sections", "fields" (every box of the form with its section; boxes with "options" take exactly one of them), "filled" (what is in the boxes now), "lists" (every list of rows, with its columns and the rows there now),',
    '"transcript" (the conversation in order: "who" is "adviser", "client" or "unclear"; nobody is labelled reliably, so read each line for what it says), "focus" (a section id, or null for the whole form),',
    '"notes" (what is already written in the notes box of each section) and "listed" (facts already offered to the adviser as "heard but not placed").',
    'Find every FACT in the transcript that belongs in a box that is EMPTY now (not in "filled"), and give it. Reply with ONE JSON object and nothing else:',
    '{"actions": [ ... ], "unplaced": [ ... ]}. Each action is one of:',
    '  {"do":"fill","field":"<id>","value":"..."}                                   a value for a box that is empty now',
    '  {"do":"cell","list":"<list id>","row":<row number>,"col":"<column id>","value":"..."}   a value for an empty box of a row that is already in "lists"',
    '  {"do":"row","list":"<list id>","values":{"<column id>":"<value>", ...}}     a person or item that was talked about but has NO row in "lists" (a child, a loan, a policy)',
    'Rules:',
    '- Facts count whoever says them. When "focus" is a section id, give only facts for the boxes and lists of that section; when it is null, the whole form.',
    '- Only the LAST version of a fact counts: when something is corrected ("sorry, it is 61 449, not 61 000"), give the final value. Speech recognition garbles South African speech ("tax fee" is tax free, "absent" is Absa, "random" is rand); use the conversation to decide.',
    '- A fact that is already in "notes" or in "listed" is never reported again, neither as an action nor in "unplaced". Report each fact once, even when it was said, corrected and said again.',
    '- Money left over: "I am left with 90 000 after all my expenses" is NOT the expenses. When "filled" holds the take-home pay (net) and exp is empty, fill exp with net minus that amount; otherwise report the fact in "unplaced".',
    '- The form works out "Direct Net Income" (dnet) and "Disposable income" (disp) itself: a figure the adviser reads out from the calculator is not a fact about the client and is not the take-home pay.',
    '- Never fill a box that already has a value in "filled" (even if the conversation says something different: then put that in "unplaced" as {"text":"<Box label>: the conversation says <value>, the form has <value>","section":"<id>"}). Never invent a value that was not said.',
    '- Give nothing for a question, an acknowledgement, small talk, a remark about the software, or a value that was only being asked about and not answered. An amount in the past tense is not what the box holds now.',
    '- A box of "fields" marked "private" is not here: do not give ID, tax, phone or email values. A line shows [number] or [email] where one was said; ignore those.',
    '- Values: a box with "options" takes exactly one of them (leave it out if none fits); amounts are digits only (85000); dates are YYYY-MM-DD; names are just the name, capitalised; otherwise the client\'s own words, tidied.',
    '- "unplaced": facts about the client\'s situation that belong on the form but fit no box or column at all (or that you cannot place), as {"text":"short point in plain words, figures as said","section":"<section id if you can tell>"}. One entry per fact; leave the list out when there is none.',
    '- "fields" and "lists" hold only what is showing on the form now. A box or list that is not there is switched off (for example the quotes of an area the client said was not a priority): give nothing for it and do not put it in "unplaced".',
    '- An offer or suggestion the client did not take up is not a fact: "Valerie can call you" followed by "I don\'t think so" requests nothing. Do not fill a referral, a quote or a request box from what the adviser proposed unless the client agreed to it.',
    '- Do not report in "unplaced" a fact that a box in "filled" already holds (a priority decision, a request for an analysis, a retirement age). Report each fact once.',
    '- The "comments" boxes of the Client priorities page (labels ending "comments (the reason, or your instructions)") hold a reason or an instruction in a short sentence, never a fragment: leave them empty unless the reason was clearly given.',
    '- A box or column marked "free": true takes any value as said when none of its options fits. Use "Other" only when a name was said that is not among the options; when no name was said, leave the box empty. A range ("between 30 and 40") is not a value.',
    '- Be careful rather than generous: a fact you are not sure of goes in "unplaced" (or nowhere), not in a box. When there is nothing to add reply {"actions": []}.'
  ].join('\n');
  /* opts: { idx, transcript: [{who, text}], filled: {id: value}, listRows(key), focus: section id | null, model }. -> the request (nothing private leaves: lines are scrubbed, private boxes are not listed). */
  function sweepRequest(opts) {
    var idx = opts.idx, priv = function (id) { return !share && V.PRIVATE_IDS.indexOf(id) >= 0; };
    var hid = opts.hidden || {};
    var fields = idx.fields.filter(function (f) { return !f.list && !priv(f.id) && !hid[f.id]; }).map(function (f) {
      var o = { id: f.id, label: f.label, section: f.sec }; if (f.options) o.options = f.options; if (f.options && f.free) o.free = true; if (f.multi) o.multi = true; return o;
    });
    var filled = {}; Object.keys(opts.filled || {}).forEach(function (id) { if (!priv(id)) filled[id] = scrub(String(opts.filled[id])).slice(0, 160); });
    var body = {
      focus: opts.focus || null,
      sections: idx.sections.map(function (x) { return { id: x.id, title: x.title }; }),
      fields: fields, filled: filled, lists: listsFor(idx, opts).filter(function (l) { return !hid['list:' + l.id]; }),
      notes: opts.notes || {}, listed: (opts.listed || []).slice(0, 40),
      transcript: (opts.transcript || []).map(function (l) { return { who: l.who === 'adviser' || l.who === 'client' ? l.who : 'unclear', text: scrub(l.text).slice(0, 500) }; })
    };
    return withThinking({ model: opts.model, max_tokens: 6000, output_config: { effort: 'medium' }, system: SWEEP_SYSTEM, messages: [{ role: 'user', content: JSON.stringify(body) }] });
  }
  function sweep(opts) {
    var o = Object.assign({}, opts, { timeoutMs: opts.timeoutMs || 120000 });
    return callModel(o, sweepRequest(opts)).then(function (text) { return normalize(extractJson(text), opts.idx, 'auto', { _line: '', _sent: '', _held: {} }); });
  }

  /* File notes in point form. opts: { apiKey | ask, model, text, topic, fetchImpl } -> Promise of an array of short points (maybe empty). */
  var POINTS_SYSTEM = [
    'You help a financial adviser keep file notes while on a call with a client.',
    'Turn what was said into short point-form notes: one brief point per fact, not full sentences, no "he said that" or "she mentioned".',
    'Keep names, amounts, dates and numbers exactly as said, but write spoken numbers as figures ("60", "R1.2 million", "R250 000"), and add nothing that was not said.',
    'Reply with ONE JSON object and nothing else: {"points": ["...", "..."]}. Use {"points": []} when nothing is worth noting (greetings, small talk).'
  ].join('\n');
  function points(opts) {
    var req = withThinking({ model: opts.model, max_tokens: 400, output_config: { effort: 'low' }, system: POINTS_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ topic: opts.topic || '', said: scrub(opts.text) }) }] });
    return callModel(opts, req).then(function (text) {
      var raw = extractJson(text), list = raw && Array.isArray(raw.points) ? raw.points : [];
      return list.map(function (p) { return String(p == null ? '' : p).replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean).slice(0, 8);
    });
  }

  /* The summaries on the Client priorities page. Claude is given, for each area, only what the form holds about that one area, and writes a few short points about what the client HAS there.
     opts: { apiKey | ask, model, areas: { id: { area, data: { facts, lists } } }, fetchImpl } -> Promise of { id: [points] } for the areas asked about (an area it did not answer is left out). */
  var SUMMARY_SYSTEM = [
    'You help a financial adviser who is meeting a client. The Fact Find form has a page of areas (Personal Risk Covers, which is life cover, disability, dread disease and income protection; Retirement Planning, which is retirement annuities; RGAR; Investment Planning, which is investments; EGAR; Medical Aid; Will; Short Term) where the adviser recommends what the client should do.',
    'For each area you receive JSON "areas": { "<id>": { "area": "<name>", "data": { "facts": { "<box>": "<value>" }, "lists": { "<list>": [ { "<column>": "<value>" } ] } } } }. The areas are Personal Risk Covers, Retirement Planning, RGAR, Investment Planning, EGAR, Medical Aid, Will, Short Term and Business assurance (for a business owner).',
    'Write a very brief point-form summary of what the client HAS in that area, so the adviser can see at a glance what is in place and what is missing before advising.',
    'Rules:',
    '- Use only the data given for that area. Never mention anything that is not in it and never bring in another area: no income, family, health or marital details unless they are in that area\'s data.',
    '- Do not advise or recommend. Only say what the client has, or plainly that something is not in place ("No group risk", "No will in place").',
    '- 2 to 6 short points, each under 14 words. Keep names, amounts, dates and numbers exactly as given. Say "No ..." or "none" only when the data itself says so: a fact whose answer is No or None means there is none.',
    '- Anything that is not in the data has not been asked or recorded yet: say nothing about it, and never write "No ... in place" or "none recorded" because something is missing. A list that is not in the data simply has no rows yet.',
    '- If the data is empty, the one point is "Nothing recorded yet".',
    '- "Credit life" is reported against each debt that was asked about; "Quote asked for" or "RGAR"/"EGAR requested" only when the data says so. A life quote is either "BrightRock Fractured" or "Standard" (with its insurers): keep the two kinds apart and name which.',
    '- A fact whose label starts with "Total" was added up by the form: give it exactly as it is, as one point (for Life: the total debt to be covered, the monthly debt repayments and the childcare cost per month). Never add figures up yourself and never leave such a total out.',
    '- Business assurance: say which policies the client already has (buy & sell, contingent liability, keyman, other) with the insurer and the cover amount, and whether there are partners or co-owners and business loans or surety, when the data says so.',
    'Reply with ONE JSON object and nothing else: {"areas": {"<id>": ["point", "point"]}} with an entry for every area you were sent.'
  ].join('\n');
  function scrubData(x) {
    if (typeof x === 'string') return scrub(x);
    if (Array.isArray(x)) return x.map(scrubData);
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = scrubData(x[k]); }); return o; }
    return x;
  }
  function summarise(opts) {
    var ids = Object.keys(opts.areas || {}), body = {};
    ids.forEach(function (id) { body[id] = { area: opts.areas[id].area, data: scrubData(opts.areas[id].data) }; });
    var req = withThinking({ model: opts.model, max_tokens: 1800, output_config: { effort: 'low' }, system: SUMMARY_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ areas: body }) }] });
    return callModel(opts, req).then(function (text) {
      var raw = extractJson(text), got = raw && raw.areas && typeof raw.areas === 'object' ? raw.areas : {}, out = {};
      ids.forEach(function (id) {
        var list = Array.isArray(got[id]) ? got[id] : [];
        list = list.map(function (p) { return String(p == null ? '' : p).replace(/^[\s\-•*]+/, '').replace(/\s+/g, ' ').trim().slice(0, 200); }).filter(Boolean).slice(0, 8);
        if (list.length) out[id] = list;
      });
      return out;
    });
  }

  /* The action points for the personal assistant (Admin page). Claude is given only what the form holds for them (actions.js, facts) and writes short points for Sitamah Nathoo, the adviser's personal assistant.
     opts: { apiKey | ask, model, facts, fetchImpl } -> Promise of an array of points (maybe empty). */
  var ACTIONS_SYSTEM = [
    'You help a financial adviser, Paul Kafentzis. After a meeting with a client you write the action points for his personal assistant, Sitamah Nathoo, who does what is needed next.',
    'You receive JSON "facts" taken from the client\'s Fact Find: "client" (first name), "letter_of_authority" (the answer to "Can we send you a LOA to sign?": Yes, No, Not now or not asked yet),',
    '"schedules" (for each kind of policy the client has: what it is, who it is with ("held"), and how the current policy schedule is to be got ("requested": "Requested from client in meeting", "Draw from Astute (with signed LOA)", "Other" with the words in "other", or "not asked yet")),',
    '"credit_life" (debts with credit life through the lender: "Yes", or "not asked yet" when it is not known), "quotes" (quotes and analyses the adviser must have requested), "referrals" (who must contact the client), "undecided" (areas where the client needs time),',
    '"instructions" (the adviser\'s own notes on an area) and "appointment" (the date of the next appointment, empty when none is set).',
    'Write the points Sitamah must act on, and nothing else:',
    '- Information still to get from the client: the current policy schedules, and the LOA. "Requested from client in meeting": follow up with the client for them. "Draw from Astute (with signed LOA)": draw them from Astute once the signed LOA is back; when the LOA is "No" there will be no signed LOA, so ask the client for the schedules directly. "Other": say what the arrangement is.',
    '  "not asked yet": ask the client how the schedules will be provided. Letter of authority "Yes": send it to the client to sign; "Not now": do not send it yet, raise it again later. Credit life "Yes": ask the client for the credit life details with that lender; "not asked yet": ask whether there is credit life on that debt.',
    '- New quotes: one point for each quote or analysis in "quotes", with what is needed (type, insurer, amounts as given). A life quote has a "kind": "BrightRock Fractured" (the quote is from BrightRock alone: say "BrightRock Fractured") or "Standard" (say "standard", and name every insurer in "insurers": one point can cover several insurers). Contact: one point for each "referrals" entry, asking that person to contact the client about it.',
    '- Anything in "undecided" or "instructions" that needs action (follow up after the client has checked the budget, an instruction from the adviser). Leave out an instruction that is only a remark.',
    '- Last, the follow-up appointment: set one up for the date in "appointment", or say the date is still to be agreed when it is empty.',
    'Rules: every point is a clear, complete action in plain words, starting with a verb, one action each, in point form. Use only the facts given: never invent a name, a date, an amount or a task. Use the client\'s first name, never "he", "she", "his" or "her".',
    'Keep names, amounts and dates exactly as given. Leave out anything that is not an action for the assistant: no summary of what the client has, no advice, no repeating of the form. Where the facts hold nothing for a kind of point, write nothing for it.',
    'Keep the order above (LOA and schedules, credit life, quotes, referrals, follow-ups, then the appointment). Reply with ONE JSON object and nothing else: {"points": ["...", "..."]}.'
  ].join('\n');
  function actionPoints(opts) {
    var req = withThinking({ model: opts.model, max_tokens: 1400, output_config: { effort: 'low' }, system: ACTIONS_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ facts: scrubData(opts.facts) }) }] });
    return callModel(opts, req).then(function (text) {
      var raw = extractJson(text), list = raw && Array.isArray(raw.points) ? raw.points : [];
      return list.map(function (p) { return String(p == null ? '' : p).replace(/^[\s\-•*]+/, '').replace(/\s+/g, ' ').trim().slice(0, 300); }).filter(Boolean).slice(0, 40);
    });
  }

  return { actionPoints: actionPoints, ACTIONS_SYSTEM: ACTIONS_SYSTEM, summarise: summarise, SUMMARY_SYSTEM: SUMMARY_SYSTEM, decide: decide, sweep: sweep, sweepRequest: sweepRequest, SWEEP_SYSTEM: SWEEP_SYSTEM, points: points, warm: warm, reconcile: reconcile, setShare: setShare, sharing: sharing, thinkingFor: thinkingFor, prepare: prepare, buildRequest: buildRequest, cachedRequest: cachedRequest, normalize: normalize, extractJson: extractJson, scrub: scrub, shield: shield, SYSTEM: SYSTEM };
});
