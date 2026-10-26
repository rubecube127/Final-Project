// Pipeline orchestrator.
//
// Runs the seven stages in order and returns one result object for the route.
// The order matters: nothing reaches a model until scrub has run, and nothing
// is coached until the safeguarding check has passed.

import { scrub } from './scrub.js'
import { injectionCheck } from './injectionCheck.js'
import { safeguardingCheck } from './safeguarding.js'
import { score, overallScore } from './score.js'
import { verifyEvidence, verifySupport } from './verifyEvidence.js'
import { coach } from './coach.js'
import { createUsageTracker } from './usage.js'
import { trackGrowth } from './growthTracker.js'
import { mathCheck } from './mathCheck.js'
import { MODEL_NAME } from '../llm.js'

export async function runCoachPipeline(rawTranscript, options = {}) {
  const usage = createUsageTracker(MODEL_NAME)

  // Called as each stage the UI shows actually finishes. The route turns these
  // into a stream so the pills move in real time instead of all at the end.
  const reached = (stage) => options.onStage?.(stage)

  // 1. scrub — PII out before any model sees the text.
  const scrubbed = scrub(rawTranscript, { names: options.names })
  reached('scrubbed')

  // 2. injectionCheck — flag instruction-like text inside the transcript.
  const injection = injectionCheck(scrubbed.text)

  // 3. safeguarding — a welfare disclosure stops coaching entirely.
  const safeguarding = await safeguardingCheck(scrubbed.text)
  usage.add('safeguarding', safeguarding.usage)

  if (safeguarding.concern) {
    return {
      stopped: true,
      reason: 'safeguarding',
      // Only the scrub stage completed; nothing after it ran.
      stagesCompleted: ['scrubbed'],
      scrubbedTranscript: scrubbed.text,
      safeguarding: {
        quote: safeguarding.quote,
        reason: safeguarding.reason,
        guidance:
          'This transcript may contain a child-welfare disclosure, so no coaching feedback was produced. ' +
          'Do not reply to the student yourself about it. Contact your tutoring programme\'s safeguarding lead ' +
          'today, share what the student said in their own words, and write down the date and time.'
      },
      redactions: scrubbed.redactions,
      injection,
      usage: usage.total()
    }
  }

  // 4. score — rubric scores with quoted evidence.
  //    The maths check runs alongside it: the two never read each other, which
  //    is the point — a maths slip must not move a teaching score.
  const [scored, maths] = await Promise.all([
    score(scrubbed.text),
    mathCheck(scrubbed.text)
  ])
  usage.add('score', scored.usage)
  usage.add('maths', maths.usage)
  reached('scored')

  // 5a. verifyEvidence — every quote must be in the scrubbed transcript.
  const verified = verifyEvidence(scored.dimensions, scrubbed.text)

  // 5b. verifySupport — and it must actually back up the score it was cited
  //     for. Only quotes that survive both checks are shown as evidence.
  const supported = await verifySupport(verified.dimensions)
  usage.add('verify', supported.usage)
  reached('evidence')

  // The formal teaching score, once the rows it averages have been checked.
  const overall = overallScore(supported.dimensions)

  // 8. growthTracker — record the scores and work out the next focus. Runs
  //    before the coach so the coaching note can speak to it.
  const growth = await trackGrowth({
    tutorId: options.tutorId,
    sessionId: options.sessionId,
    overall,
    dimensions: supported.dimensions
  })

  // 6. coach — one strength, one focus, one phrase to try.
  const feedback = await coach(supported.dimensions, growth)
  usage.add('coach', feedback.usage)
  reached('coached')

  // 7. usage — totals for the whole request.
  return {
    stopped: false,
    stagesCompleted: ['scrubbed', 'scored', 'evidence', 'coached'],
    scrubbedTranscript: scrubbed.text,
    overall,
    growth,
    // Flags only. Deliberately not part of `overall` or any rubric row.
    maths: { flags: maths.flags, checked: maths.checked, failed: maths.failed || false },
    dimensions: supported.dimensions,
    evidenceReport: verified.report,
    supportReport: supported.report,
    feedback: {
      strengths: feedback.strengths,
      focus: feedback.focus,
      phraseToTry: feedback.phraseToTry
    },
    redactions: scrubbed.redactions,
    injection,
    usage: usage.total()
  }
}
