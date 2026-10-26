// Dev tool: fill the growth store with a week of plausible scores, so the
// coordinator digest has something to show in a demo.
//
//   npm run seed            add the demo sessions
//   npm run seed -- --clear remove them again
//
// Writes scores only — the same shape the pipeline writes, and with no
// transcript text, because transcripts are never stored. Makes no model calls,
// so it needs no API key and costs nothing.
//
// Every record it writes has a sessionId beginning "seed_", and --clear removes
// exactly those. A real tutor who happens to share a name with a demo one is
// left alone.

import { addSession, removeSessionsWhere } from '../storage.js'
import { RUBRIC } from '../pipeline/score.js'

const KEYS = RUBRIC.map((dimension) => dimension.key)
const SEED_PREFIX = 'seed_'

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

/** One session record. `values` lines up with the rubric order. */
function record(at, values, focusKey) {
  const mean = values.reduce((sum, n) => sum + n, 0) / values.length

  return {
    sessionId: `${SEED_PREFIX}${Math.random().toString(36).slice(2, 10)}`,
    at,
    overall: {
      score: Number(mean.toFixed(1)),
      label: 'seeded',
      confidence: 'medium'
    },
    scores: KEYS.map((key, index) => ({
      key,
      score: values[index],
      confidence: 'medium',
      supported: true
    })),
    focusKey
  }
}

// Four tutors, each shaped to exercise one of the digest's flagging rules.
// Values are in rubric order: guiding questions, elicits reasoning, diagnoses
// errors, process praise, representations.
const DEMO = [
  {
    tutorId: 'A. Chen',
    note: 'improving — should not be flagged',
    sessions: [
      [daysAgo(6), [2, 3, 2, 4, 1], 'representations'],
      [daysAgo(2), [4, 4, 3, 4, 3], 'diagnosesErrors']
    ]
  },
  {
    tutorId: 'B. Okafor',
    note: 'declining across three sessions',
    sessions: [
      [daysAgo(5), [4, 4, 4, 4, 3], 'representations'],
      [daysAgo(3), [3, 3, 3, 4, 2], 'representations'],
      [daysAgo(1), [2, 2, 3, 3, 2], 'representations']
    ]
  },
  {
    tutorId: 'C. Ramirez',
    note: 'solid overall, but stuck on the same focus — the case a scores-only dashboard misses',
    sessions: [
      [daysAgo(6), [4, 4, 2, 4, 3], 'diagnosesErrors'],
      [daysAgo(4), [4, 5, 2, 4, 3], 'diagnosesErrors'],
      [daysAgo(1), [5, 4, 2, 5, 3], 'diagnosesErrors']
    ]
  },
  {
    tutorId: 'D. Novak',
    note: 'gone quiet — last seen a month ago',
    sessions: [[daysAgo(31), [4, 4, 4, 5, 4], 'representations']]
  }
]

async function seed() {
  let count = 0

  for (const tutor of DEMO) {
    for (const [at, values, focusKey] of tutor.sessions) {
      await addSession(tutor.tutorId, record(at, values, focusKey))
      count += 1
    }
    console.log(`  ${tutor.tutorId} — ${tutor.note}`)
  }

  console.log(`\nSeeded ${count} sessions across ${DEMO.length} tutors.`)
  console.log('Open the Coordinator digest tab to see them, then `npm run seed -- --clear`.')
}

async function clear() {
  const removed = await removeSessionsWhere((session) =>
    String(session.sessionId || '').startsWith(SEED_PREFIX)
  )

  console.log(`Removed ${removed} seeded session${removed === 1 ? '' : 's'}. Real records untouched.`)
}

await (process.argv.includes('--clear') ? clear() : seed())
