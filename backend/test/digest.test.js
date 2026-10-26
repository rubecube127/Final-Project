// Tests for the digest's arithmetic. The prose is a model call and is not
// tested here; everything a director would act on is computed below.

import test from 'node:test'
import assert from 'node:assert/strict'

import { analyse, isoWeekKey, themeOutcome } from '../digest.js'

const NOW = new Date('2026-10-25T12:00:00.000Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

const session = (at, score, focusKey, scores = []) => ({ at, overall: { score }, focusKey, scores })
const tutor = (id, sessions) => ({ id, sessions })

const run = (tutors, days = 7) => analyse(tutors, { days, now: NOW })

/* ------------------------------------------------------------- check-ins */

test('a tutor whose latest session is low is flagged', () => {
  const result = run([tutor('A', [session(daysAgo(1), 2.0, 'guidingQuestions')])])

  assert.equal(result.needsCheckIn.length, 1)
  assert.equal(result.needsCheckIn[0].tutorId, 'A')
  assert.match(result.needsCheckIn[0].reasons.join(' '), /scored 2\/5/)
})

test('a tutor whose scores are falling is flagged', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(3), 4.4, 'representations'),
      session(daysAgo(2), 4.0, 'representations'),
      session(daysAgo(1), 3.6, 'representations')
    ])
  ])

  // Every score is well above the low-score line, so the trend is the signal.
  assert.equal(result.needsCheckIn.length, 1)
  assert.match(result.needsCheckIn[0].reasons.join(' '), /fallen over their last three/)
})

test('a tutor stuck on the same focus three sessions running is flagged', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(3), 3.8, 'diagnosesErrors'),
      session(daysAgo(2), 3.9, 'diagnosesErrors'),
      session(daysAgo(1), 3.8, 'diagnosesErrors')
    ])
  ])

  assert.match(result.needsCheckIn[0].reasons.join(' '), /Diagnoses errors has been their focus 3 sessions/)
})

test('a tutor who has gone quiet is flagged and listed', () => {
  const result = run([tutor('A', [session(daysAgo(30), 4.5, null)])])

  assert.match(result.needsCheckIn[0].reasons.join(' '), /no sessions recorded this period/)
  assert.deepEqual(result.quiet, ['A'])
})

test('a steady, strong tutor is not flagged', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(3), 4.2, 'representations'),
      session(daysAgo(2), 4.4, 'representations'),
      session(daysAgo(1), 4.6, 'guidingQuestions')
    ])
  ])

  assert.deepEqual(result.needsCheckIn, [])
  assert.deepEqual(result.quiet, [])
})

test('two sessions are not enough to call a trend', () => {
  const result = run([
    tutor('A', [session(daysAgo(2), 4.6, 'representations'), session(daysAgo(1), 4.2, 'representations')])
  ])

  assert.deepEqual(result.needsCheckIn, [])
})

/* ------------------------------------------------- team-wide dimensions */

test('dimension averages come back weakest first, with sample sizes', () => {
  const result = run([
    tutor('A', [session(daysAgo(1), 3, 'x', [{ key: 'guidingQuestions', score: 5 }, { key: 'representations', score: 1 }])]),
    tutor('B', [session(daysAgo(2), 3, 'x', [{ key: 'guidingQuestions', score: 3 }, { key: 'representations', score: 2 }])])
  ])

  const scored = result.dimensions.filter((d) => d.average !== null)

  assert.equal(scored[0].key, 'representations')
  assert.equal(scored[0].average, 1.5)
  assert.equal(scored[0].sampleSize, 2)
  assert.equal(scored[scored.length - 1].key, 'guidingQuestions')
  assert.equal(scored[scored.length - 1].average, 4)
})

test('dimension averages ignore sessions outside the period', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(30), 1, 'x', [{ key: 'guidingQuestions', score: 1 }]),
      session(daysAgo(1), 5, 'x', [{ key: 'guidingQuestions', score: 5 }])
    ])
  ])

  const guiding = result.dimensions.find((d) => d.key === 'guidingQuestions')
  assert.equal(guiding.average, 5)
  assert.equal(guiding.sampleSize, 1)
})

test('a dimension nobody was scored on reports no data, not zero', () => {
  const result = run([tutor('A', [session(daysAgo(1), 4, 'x', [{ key: 'guidingQuestions', score: 4 }])])])

  const untouched = result.dimensions.find((d) => d.key === 'representations')
  assert.equal(untouched.average, null)
  assert.equal(untouched.sampleSize, 0)
})

/* --------------------------------------------------------- improvements */

test('an improvement on the previous focus is reported', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(2), 3.0, 'representations', [{ key: 'representations', score: 2 }]),
      session(daysAgo(1), 3.8, 'guidingQuestions', [{ key: 'representations', score: 4 }])
    ])
  ])

  assert.equal(result.improvements.length, 1)
  assert.deepEqual(result.improvements[0], {
    tutorId: 'A',
    key: 'representations',
    label: 'Representations',
    before: 2,
    now: 4
  })
})

test('a focus that did not move is not reported as an improvement', () => {
  const result = run([
    tutor('A', [
      session(daysAgo(2), 3.0, 'representations', [{ key: 'representations', score: 3 }]),
      session(daysAgo(1), 3.0, 'representations', [{ key: 'representations', score: 3 }])
    ])
  ])

  assert.deepEqual(result.improvements, [])
})

/* ---------------------------------------------------------------- totals */

test('totals count only sessions inside the period', () => {
  const result = run([
    tutor('A', [session(daysAgo(1), 4, null), session(daysAgo(20), 4, null)]),
    tutor('B', [session(daysAgo(3), 4, null)])
  ])

  assert.equal(result.totals.tutors, 2)
  assert.equal(result.totals.sessions, 2)
})

test('an empty roster produces an empty digest rather than throwing', () => {
  const result = run([])

  assert.equal(result.totals.tutors, 0)
  assert.equal(result.totals.sessions, 0)
  assert.deepEqual(result.needsCheckIn, [])
})

/* ------------------------------------------------------- PD theme history */

test('isoWeekKey groups a week together and rolls at the week boundary', () => {
  // 2026-10-25 is a Sunday — the end of ISO week 43; the 26th starts week 44.
  assert.equal(isoWeekKey(new Date('2026-10-20')), '2026-W43')
  assert.equal(isoWeekKey(new Date('2026-10-25')), '2026-W43')
  assert.equal(isoWeekKey(new Date('2026-10-26')), '2026-W44')
})

test('isoWeekKey handles the turn of the year', () => {
  // ISO weeks belong to the year their Thursday falls in.
  assert.equal(isoWeekKey(new Date('2026-01-01')), '2026-W01')
  assert.equal(isoWeekKey(new Date('2025-12-29')), '2026-W01')
})

test('week keys sort chronologically as plain strings', () => {
  const keys = ['2026-W10', '2026-W02', '2025-W51', '2026-W01']
  assert.deepEqual([...keys].sort((a, b) => a.localeCompare(b)),
    ['2025-W51', '2026-W01', '2026-W02', '2026-W10'])
})

test('themeOutcome reports movement on the dimension a theme targeted', () => {
  const outcome = themeOutcome(
    { dimensionKey: 'representations', dimensionAverage: 2.5, title: 'Two representations' },
    [{ key: 'representations', average: 3.4 }]
  )

  assert.equal(outcome.change, 'improved')
  assert.equal(outcome.delta, 0.9)
  assert.equal(outcome.label, 'Representations')
  assert.equal(outcome.title, 'Two representations')
})

test('themeOutcome treats a tiny wobble as holding steady', () => {
  // Averages drift by a few hundredths as sessions land; that is not progress.
  const outcome = themeOutcome(
    { dimensionKey: 'representations', dimensionAverage: 2.5 },
    [{ key: 'representations', average: 2.53 }]
  )

  assert.equal(outcome.change, 'held')
})

test('themeOutcome reports a slip', () => {
  const outcome = themeOutcome(
    { dimensionKey: 'diagnosesErrors', dimensionAverage: 3.2 },
    [{ key: 'diagnosesErrors', average: 2.6 }]
  )

  assert.equal(outcome.change, 'slipped')
  assert.equal(outcome.delta, -0.6)
})

test('themeOutcome says so when the dimension has not been scored since', () => {
  const outcome = themeOutcome(
    { dimensionKey: 'representations', dimensionAverage: 2.5 },
    [{ key: 'representations', average: null }]
  )

  assert.equal(outcome.change, 'not-scored')
  assert.equal(outcome.delta, null)
})

test('themeOutcome returns null with no previous theme', () => {
  assert.equal(themeOutcome(null, [{ key: 'representations', average: 3 }]), null)
  assert.equal(themeOutcome({ dimensionKey: null }, []), null)
})
