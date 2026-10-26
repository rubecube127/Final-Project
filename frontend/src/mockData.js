// Shared UI config, plus sample data.
//
// PIPELINE_STAGES and RUBRIC are what the components render against and must
// stay in step with /backend/pipeline/score.js.
//
// mockSession and mockBlockedSession are no longer rendered — App.jsx calls
// /api/coach for real — but they are kept so the UI can be worked on offline
// without spending tokens. They match what api.js hands the components.

// The four pipeline stages the tutor sees. The scrub, injection and
// safeguarding work still happens server-side, but only these four are worth
// showing as progress.
export const PIPELINE_STAGES = [
  { key: 'scrubbed', label: 'Scrubbed' },
  { key: 'scored', label: 'Scored' },
  { key: 'evidence', label: 'Evidence checked' },
  { key: 'coached', label: 'Coached' }
]

// The rubric. Five dimensions, all about teaching moves — nothing in this app
// judges whether the mathematics itself was right.
export const RUBRIC = [
  {
    key: 'guidingQuestions',
    label: 'Guiding questions',
    description: 'Points the student toward the next step instead of supplying it.'
  },
  {
    key: 'elicitsReasoning',
    label: 'Elicits reasoning',
    description: 'Asks the student to say why, not just what.'
  },
  {
    key: 'diagnosesErrors',
    label: 'Diagnoses errors',
    description: 'Finds where the thinking slipped rather than correcting the answer.'
  },
  {
    key: 'processPraise',
    label: 'Process praise',
    description: 'Praises the effort and the method, not the student being "smart".'
  },
  {
    key: 'representations',
    label: 'Representations',
    description: 'Moves between symbols, graphs, tables and words to open up the idea.'
  }
]

// One finished session. `transcript` is already scrubbed, which is why the
// names read as [NAME].
export const mockSession = {
  blocked: false,

  transcript: [
    { id: 1, speaker: 'Tutor', text: 'Hi [NAME], last week we were on factoring. Want to pick that up?' },
    { id: 2, speaker: 'Student', text: 'Yeah. I got stuck on x^2 + 5x + 6 = 0.' },
    { id: 3, speaker: 'Tutor', text: 'Okay. What do you think the first move is?' },
    { id: 4, speaker: 'Student', text: 'Um, divide by x?' },
    { id: 5, speaker: 'Tutor', text: 'Tell me what made you reach for that one.', tags: ['Strong move'] },
    { id: 6, speaker: 'Student', text: "Because there's an x in both of the first parts." },
    { id: 7, speaker: 'Tutor', text: 'That makes sense as an instinct. We want two numbers that multiply to 6 and add to 5. What pairs multiply to 6?' },
    { id: 8, speaker: 'Student', text: '1 and 6. 2 and 3.' },
    { id: 9, speaker: 'Tutor', text: 'Good. Which of those adds to 5?' },
    { id: 10, speaker: 'Student', text: '2 and 3.' },
    { id: 11, speaker: 'Tutor', text: 'So what does that give you?' },
    { id: 12, speaker: 'Student', text: '(x + 2)(x + 3) = 0?' },
    { id: 13, speaker: 'Tutor', text: 'Yes. Now what does it mean that the whole thing equals zero?' },
    { id: 14, speaker: 'Student', text: 'I don\'t know, you set them both to zero?' },
    { id: 15, speaker: 'Tutor', text: 'Right, you do. So x = -2 and x = -3.' },
    { id: 16, speaker: 'Student', text: 'Okay. What about x^2 = 49?' },
    { id: 17, speaker: 'Tutor', text: 'Just take the square root. x = 7.' },
    { id: 18, speaker: 'Tutor', text: 'You picked up that factoring pattern much faster than last week.', tags: ['Strong move'] }
  ],

  scores: [
    {
      key: 'guidingQuestions',
      score: 4,
      comment: 'You kept handing the next step back to the student instead of taking it yourself.',
      evidence: 'Okay. What do you think the first move is?',
      verified: true
    },
    {
      key: 'elicitsReasoning',
      score: 5,
      comment: 'You asked for the thinking behind a wrong answer before saying anything about it.',
      evidence: 'Tell me what made you reach for that one.',
      verified: true
    },
    {
      key: 'diagnosesErrors',
      score: 2,
      comment: 'When the divide-by-x idea came up you moved past it rather than finding where it came from.',
      evidence: '',
      verified: false
    },
    {
      key: 'processPraise',
      score: 4,
      comment: 'Your closing praise named the work, not the student.',
      evidence: 'You picked up that factoring pattern much faster than last week.',
      verified: true
    },
    {
      key: 'representations',
      score: 1,
      comment: 'The whole session stayed in symbols. A sketch or a table could have shown what the two solutions mean.',
      evidence: '',
      verified: false
    }
  ],

  coaching: {
    strengths: [
      'You asked the student to explain a wrong idea before you reacted to it — that is the hardest habit in tutoring and you did it naturally.',
      'Your closing praise named the work rather than the student, which is the praise that makes someone check their own reasoning again next week.'
    ],
    focus: 'When an error appears, stay with it a moment longer and trace where the idea came from before moving to the correct method.',
    phraseToTry: 'Walk me back through that — where did the x on the bottom come from?'
  },

  stats: {
    redactions: 10,
    evidenceVerified: 3,
    evidenceTotal: 5,
    totalTokens: 2429,
    costUsd: 0.0097
  }
}

// The same session shape, stopped at the safeguarding stage. No scores and no
// coaching are produced when this happens.
export const mockBlockedSession = {
  blocked: true,

  blockedReason: {
    quote: 'Student: My stepdad hits me when I get stuff wrong.',
    reason: 'The student described being physically hurt at home.',
    guidance:
      'This transcript may contain a child-welfare disclosure, so no coaching feedback was produced. ' +
      'Do not reply to the student yourself about it. Contact your tutoring programme\'s safeguarding lead ' +
      'today, share what the student said in their own words, and write down the date and time.'
  },

  transcript: [
    { id: 1, speaker: 'Tutor', text: "Let's try x^2 = 49 today." },
    { id: 2, speaker: 'Student', text: 'My stepdad hits me when I get stuff wrong.', tags: ['Safeguarding'] },
    { id: 3, speaker: 'Tutor', text: 'Okay. Keep going with the square roots.' }
  ],

  scores: [],
  coaching: null,

  stats: {
    redactions: 2,
    evidenceVerified: 0,
    evidenceTotal: 0,
    totalTokens: 0,
    costUsd: 0
  }
}

// What an empty transcript box should offer as a starting point.
export const SAMPLE_TRANSCRIPT = mockSession.transcript
  .map((turn) => `${turn.speaker}: ${turn.text}`)
  .join('\n')
