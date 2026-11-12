/* The Risk Tolerance questionnaire's questions, answers, scoring and profiles, exactly as the Wealth Revolution Risk Tolerance website (risktolerance.netlify.app) has them, so the questionnaire can be completed
   inside the form. 18 statements are answered from Strongly disagree to Strongly agree (six of them count the other way round), five questions ask about capacity for loss, the total is out of 90 and gives one of five profiles. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(globalThis);
  else { root.CS = root.CS || {}; root.CS.rtdata = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const SCALE = ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'];

  const STATEMENTS = [
    'For me, part of investing is experiencing the ups and downs.',
    'I feel stressed when making important financial decisions.',
    "It's important for me to take financial risks.",
    'I believe that I generally take bigger investment risks with money than other people.',
    'I always overreact to unexpected bad financial news.',
    'I would still consider making risky investments even if I had made significant losses in the past.',
    'I worry about things going wrong with my financial decisions.',
    'To avoid the possibility of losing money on my investments, I would rather not make a financial decision.',
    "To get higher long-term returns, I'm happy to risk a short-term fall in the value of my investments.",
    'Others would say that I like taking risks with my money.',
    'I feel fairly relaxed about uncertainty regarding risky investments.',
    'When I consider the risks of investing, I feel quite anxious.',
    'I expect my investments to sometimes go down in value as well as up.',
    'I would be happy to tolerate fluctuations in the value of my investments to get a better return in the future.',
    'When I make an investment decision, I usually feel concerned.',
    'Seeing my investments go up and down in value is part of investing money.',
    'I would get a thrill from making risky investments with my money.',
    'I would accept fluctuations in the value of my investments for the potential to gain a return above inflation.',
  ];

  // Statements where agreeing means LOWER risk tolerance. The PDF's radio values
  // for these already run 5..1 left to right, matching this.
  const REVERSED = new Set([2, 5, 7, 8, 12, 15]);

  const CATEGORIES = [
    { name: 'Conservative', min: 18, max: 37,
      description: 'A conservative investor requires stable investment growth or a high level of income. The primary investment goal is capital protection. This is suitable for an investor with an investment horizon of at least two years.' },
    { name: 'Cautious', min: 38, max: 47,
      description: 'A cautious investor requires stable growth in his/her investment and is uncomfortable when investment values decline. The investor may require a moderate level of income and is likely to have an investment horizon of at least two years. The primary investment goal is capital protection.' },
    { name: 'Moderate', min: 48, max: 57,
      description: 'A moderate investor invests for the longer term and requires minimal or no additional income. This is suitable for an investor with an investment horizon of at least three years. The investor can tolerate fluctuations in the value of his or her investments from time to time. The primary investment goal is capital growth.' },
    { name: 'Moderately aggressive', min: 58, max: 67,
      description: 'A moderately aggressive investor invests for the long term and requires minimal or no additional income. This is suitable for an investor with an investment horizon of at least five years. Typically, this investor is prepared to accept more risk than a moderate investor but does not want full exposure to equities. The primary investment goal is capital growth.' },
    { name: 'Aggressive', min: 68, max: 90,
      description: 'An aggressive investor invests for the long term and seeks the highest possible growth. This is suitable for an investor with an investment horizon of at least five years. Typically, the investor is prepared to accept substantial fluctuation in the value of his or her investment. The primary investment goal is long-term capital growth.' },
  ];

  const CAPACITY = [
    { field: 'cap_1', title: 'Emergency funds',
      question: 'If emergency funds were required, would this investment be considered as a source for such emergency funds?',
      options: [
        'There is no alternative - funds would need to be drawn from this investment.',
        'If necessary, withdrawal of funds from this investment would be considered.',
        'Other savings/investments are held that could be used in an emergency.',
      ] },
    { field: 'cap_2', title: 'Income | Question 1',
      question: 'How long do you intend to hold this investment before you draw a regular income?',
      options: ['Less than 5 years', '5-10 years', '10 years plus', 'No fixed term'] },
    { field: 'cap_3', title: 'Income | Question 2',
      question: 'What would the financial impact be if the income from this investment were to fall below your required level?',
      options: [
        'It would have a significant impact. A decrease in income is not affordable and would cause financial difficulties.',
        'It would cause a re-assessment of financial priorities and possible reductions in expenditure.',
        'The impact would not be significant as other assets are held for income generation.',
      ] },
    { field: 'cap_4', title: 'Growth | Question 1',
      question: 'How long do you intend to hold this investment before you require any capital drawdowns?',
      options: ['Less than 5 years', '5-10 years', '10 years plus', 'No fixed term'] },
    { field: 'cap_5', title: 'Growth | Question 2',
      question: 'What would the financial impact be if the value of this investment were to fall below expectations?',
      options: [
        'It would have a significant impact. I cannot afford this investment to not meet my goals.',
        'It would cause a re-assessment of financial priorities and possible reductions in lifestyle.',
        'The impact would not be significant as other assets are held to maintain my lifestyle.',
      ] },
  ];

  const TIME_ZONE = 'Africa/Johannesburg';

  /** choice: 0 = Strongly disagree ... 4 = Strongly agree */
  function scoreFor(questionNo, choice) {
    return REVERSED.has(questionNo) ? 5 - choice : choice + 1;
  }

  function totalScore(statementChoices) {
    return statementChoices.reduce((sum, c, i) => sum + scoreFor(i + 1, c), 0);
  }

  function categoryFor(score) {
    return CATEGORIES.find((c) => score >= c.min && score <= c.max) || null;
  }

  function formatParts(date) {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
    return parts;
  }

  /** "22/10/2026" in South African time */
  function formatDate(date) {
    const p = formatParts(date);
    return `${p.day}/${p.month}/${p.year}`;
  }

  /** "22/10/2026 14:31:05 SAST" */
  function formatTimestamp(date) {
    const p = formatParts(date);
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second} SAST`;
  }

  /** "RT-20261022-143105-7K3Q" */
  function makeReference(date) {
    const p = formatParts(date);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const rnd = new Uint8Array(4);
    root.crypto.getRandomValues(rnd);
    const suffix = Array.from(rnd, (b) => alphabet[b % alphabet.length]).join('');
    return `RT-${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}-${suffix}`;
  }


  /* a statement's answer given as its words: -1 when not answered */
  function choiceOf(words) { return SCALE.indexOf(words); }
  function capacityOf(i, words) { return CAPACITY[i].options.indexOf(words); }
  function sameAnswers(list) { return list.every(function (c) { return c >= 0; }); }

  return { SCALE: SCALE, STATEMENTS: STATEMENTS, REVERSED: REVERSED, CATEGORIES: CATEGORIES, CAPACITY: CAPACITY, scoreFor: scoreFor, totalScore: totalScore, categoryFor: categoryFor,
    formatDate: formatDate, formatTimestamp: formatTimestamp, makeReference: makeReference, choiceOf: choiceOf, capacityOf: capacityOf, sameAnswers: sameAnswers };
});
