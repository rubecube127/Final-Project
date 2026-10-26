// Tests for the Growth Tracker's arithmetic, and for the promise that matters
// most about the store: it never keeps a transcript.
//
// Run with: npm test

import test from 'node:test'
import assert from 'node:assert/strict'

import { pickFocus, assessProgress } from '../pipeline/growthTracker.js'
import { toRecord } from '../storage.js'

const dimension = (key, score, extra = {}) => ({ key, score, ...extra })

/* -------------------------------------------------------------- pickFocus */

test('pickFocus picks the weakest dimension', () => {
  const focus = pickFocus([
    dimension('guidingQuestions', 4),
    dimension('elicitsReasoning', 2),
    dimension('diagnosesErrors', 3)
  ])

  assert.equal(focus.key, 'elicitsReasoning')
  assert.equal(focus.label, 'Elicits reasoning')
  assert.equal(focus.score, 2)
})

test('pickFocus breaks ties by rubric order, not by argument order', () => {
  // Representations is listed last in the rubric, guiding questions first.
  const focus = pickFocus([dimension('representations', 2), dimension('guidingQuestions', 2)])

  assert.equal(focus.key, 'guidingQuestions')
})

test('pickFocus returns null when nothing is weak', () => {
  // Inventing a weakness for a tutor who had a strong session is worse than
  // saying nothing.
  assert.equal(pickFocus([dimension('guidingQuestions', 4), dimension('elicitsReasoning', 5)]), null)
})

test('pickFocus keeps the same focus when it is still the weakest', () => {
  const first = pickFocus([dimension('guidingQuestions', 4), dimension('elicitsReasoning', 1)])
  const second = pickFocus([dimension('guidingQuestions', 4), dimension('elicitsReasoning', 2)])

  // Still the weakest after a small improvement, so it stays the focus.
  assert.equal(first.key, 'elicitsReasoning')
  assert.equal(second.key, 'elicitsReasoning')
})

test('pickFocus ignores dimensions with no score', () => {
  const focus = pickFocus([dimension('guidingQuestions', 3), dimension('elicitsReasoning', null)])

  assert.equal(focus.key, 'guidingQuestions')
})

test('pickFocus returns null when nothing was scored at all', () => {
  assert.equal(pickFocus([dimension('guidingQuestions', null)]), null)
  assert.equal(pickFocus([]), null)
})

/* ---------------------------------------------------------- assessProgress */

const lastSession = (key, score) => ({ focusKey: key, scores: [{ key, score }] })

test('assessProgress reports an improvement', () => {
  const progress = assessProgress(lastSession('elicitsReasoning', 2), [dimension('elicitsReasoning', 4)])

  assert.equal(progress.change, 'improved')
  assert.equal(progress.before, 2)
  assert.equal(progress.now, 4)
  assert.equal(progress.delta, 2)
  assert.equal(progress.label, 'Elicits reasoning')
})

test('assessProgress reports holding steady and slipping back', () => {
  assert.equal(
    assessProgress(lastSession('diagnosesErrors', 3), [dimension('diagnosesErrors', 3)]).change,
    'held'
  )
  assert.equal(
    assessProgress(lastSession('diagnosesErrors', 4), [dimension('diagnosesErrors', 2)]).change,
    'slipped'
  )
})

test('assessProgress returns null on a first session', () => {
  assert.equal(assessProgress(null, [dimension('elicitsReasoning', 4)]), null)
})

test('assessProgress returns null when the previous session set no focus', () => {
  assert.equal(assessProgress({ focusKey: null, scores: [] }, [dimension('elicitsReasoning', 4)]), null)
})

test('assessProgress says so when the focus did not come up again', () => {
  // Claiming "no change" would be wrong — the session simply never showed it.
  const progress = assessProgress(lastSession('representations', 2), [dimension('guidingQuestions', 4)])

  assert.equal(progress.change, 'not-scored')
  assert.equal(progress.now, null)
  assert.equal(progress.delta, null)
})

/* ------------------------------------------------------------ what is kept */

test('a stored record keeps scores and nothing from the transcript', () => {
  const record = toRecord({
    sessionId: 's_1',
    at: '2026-10-25T00:00:00.000Z',
    overall: { score: 3.4, label: 'Mixed', confidence: 'medium', counted: 5 },
    dimensions: [
      {
        key: 'guidingQuestions',
        label: 'Guiding questions',
        description: 'Points the student toward the next step.',
        score: 4,
        confidence: 'high',
        supported: true,
        // None of the following may survive into storage.
        evidence: 'Tutor: What do you think the first move is?',
        comment: 'Handed the next step back to the student.'
      }
    ],
    focusKey: 'guidingQuestions'
  })

  const serialised = JSON.stringify(record)

  assert.ok(!serialised.includes('What do you think the first move is'))
  assert.ok(!serialised.includes('Handed the next step back'))
  assert.equal(record.scores[0].evidence, undefined)
  assert.equal(record.scores[0].comment, undefined)

  // What it does keep.
  assert.equal(record.scores[0].score, 4)
  assert.equal(record.scores[0].confidence, 'high')
  assert.equal(record.scores[0].supported, true)
  assert.equal(record.focusKey, 'guidingQuestions')
  assert.equal(record.overall.score, 3.4)
})

test('a record with no overall score stores null rather than throwing', () => {
  const record = toRecord({ sessionId: 's_2', at: 'now', overall: null, dimensions: [], focusKey: null })

  assert.equal(record.overall, null)
  assert.deepEqual(record.scores, [])
})
