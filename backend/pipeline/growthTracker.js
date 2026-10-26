// Stage 8 — the Growth Tracker
//
// Keeps one tutor's scores across sessions so coaching can build on the last
// session instead of starting cold each time. Two questions:
//
//   1. Did the focus we set last time actually move?
//   2. What should the focus be now?
//
// Deliberately arithmetic rather than a model call. "Your score for Guiding
// questions went 2 → 4" is a fact about stored numbers; asking a model to
// restate it would add cost, latency and a chance of getting it wrong. The
// Coach turns these facts into prose.

import { RUBRIC } from './score.js'
import { getSessions, addSession, toRecord } from '../storage.js'

// Below this, a dimension is worth making the focus.
const STRONG_ENOUGH = 4

/**
 * Record this session and work out where the tutor is going.
 *
 * Returns null when no tutor was identified — the app still works without
 * sign-in, it just cannot track progress.
 */
export async function trackGrowth({ tutorId, sessionId, overall, dimensions }) {
  if (!tutorId) return null

  const history = await getSessions(tutorId)
  const previous = history[history.length - 1] || null

  const progress = assessProgress(previous, dimensions)
  const nextFocus = pickFocus(dimensions)

  await addSession(
    tutorId,
    toRecord({
      sessionId,
      at: new Date().toISOString(),
      overall,
      dimensions,
      focusKey: nextFocus?.key
    })
  )

  return {
    tutorId,
    sessionNumber: history.length + 1,
    previousFocus: progress,
    nextFocus,
    // Just enough history to draw a line. Numbers only.
    history: [...history, { overall }]
      .map((session) => session.overall?.score ?? null)
      .filter((score) => score !== null)
  }
}

/**
 * Did last session's focus improve?
 *
 * Returns null for a tutor's first session, or when the previous session never
 * set a focus.
 */
export function assessProgress(previousSession, dimensions) {
  const focusKey = previousSession?.focusKey
  if (!focusKey) return null

  const before = previousSession.scores?.find((s) => s.key === focusKey)?.score ?? null
  const now = dimensions.find((d) => d.key === focusKey)?.score ?? null
  const label = labelFor(focusKey)

  // The dimension never came up this session, so there is nothing to compare.
  if (before === null || now === null) {
    return { key: focusKey, label, before, now, delta: null, change: 'not-scored' }
  }

  const delta = now - before

  return {
    key: focusKey,
    label,
    before,
    now,
    delta,
    change: delta > 0 ? 'improved' : delta < 0 ? 'slipped' : 'held'
  }
}

/**
 * Pick the next focus: the weakest dimension.
 *
 * Ties break by rubric order, which puts the more foundational moves first.
 * If the previous focus is still the weakest it stays the focus — one session
 * is rarely enough to move a habit, and rotating away from it would be worse
 * coaching than repeating it.
 *
 * Returns null when everything is already strong; there is no value in
 * inventing a weakness.
 */
export function pickFocus(dimensions) {
  const scored = dimensions.filter((d) => typeof d.score === 'number')
  if (!scored.length) return null

  const inRubricOrder = RUBRIC.map((item) => scored.find((d) => d.key === item.key)).filter(Boolean)

  const weakest = inRubricOrder.reduce((lowest, dimension) =>
    dimension.score < lowest.score ? dimension : lowest
  )

  if (weakest.score >= STRONG_ENOUGH) return null

  return {
    key: weakest.key,
    label: labelFor(weakest.key),
    score: weakest.score
  }
}

function labelFor(key) {
  return RUBRIC.find((item) => item.key === key)?.label || key
}
