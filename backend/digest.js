// The Coordinator Digest.
//
// Not a per-session pipeline stage — it reads across every tutor's stored
// scores and answers three questions for whoever runs the campus:
//
//   1. Which tutors need a human check-in this week?
//   2. Which teaching moves are going well?
//   3. What should the next professional development session be about?
//
// The arithmetic is done here and the reasons are spelled out, so a director
// can disagree with the tool. One model call turns the numbers into something
// readable and proposes the PD theme.
//
// Note what this never touches: transcripts are not stored, so the digest sees
// only scores. There is no student data in it at all.

import { RUBRIC } from './pipeline/score.js'
import { listTutors, putTheme, getThemes } from './storage.js'
import { askJson, MODEL_NAME } from './llm.js'
import { createUsageTracker } from './pipeline/usage.js'

// A tutor at or below this on their latest session is struggling enough that a
// person should talk to them, not just a tool.
const LOW_SCORE = 2.5

// The same focus this many sessions running means the coaching is not landing.
const STUCK_AFTER = 3

/**
 * Work out everything the digest reports, from stored records alone.
 *
 * Pure, so it can be tested without a model or a filesystem. `now` is injected
 * for the same reason.
 */
export function analyse(tutors, { days = 7, now = new Date() } = {}) {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const perTutor = tutors.map((tutor) => {
    const all = tutor.sessions || []
    const recent = all.filter((session) => new Date(session.at) >= from)

    return {
      tutorId: tutor.id,
      sessionsInPeriod: recent.length,
      totalSessions: all.length,
      latest: all[all.length - 1] || null,
      trend: trendOf(all),
      stuckFocus: stuckFocus(all),
      improvement: focusImprovement(all)
    }
  })

  return {
    period: { days, from: from.toISOString(), to: now.toISOString() },
    totals: {
      tutors: tutors.length,
      sessions: perTutor.reduce((sum, t) => sum + t.sessionsInPeriod, 0)
    },
    needsCheckIn: perTutor.map(checkInReasons).filter(Boolean),
    dimensions: dimensionAverages(tutors, from),
    improvements: perTutor.filter((t) => t.improvement).map((t) => ({
      tutorId: t.tutorId,
      ...t.improvement
    })),
    quiet: perTutor
      .filter((t) => t.sessionsInPeriod === 0 && t.totalSessions > 0)
      .map((t) => t.tutorId)
  }
}

/** Why this tutor needs a person, or null if they do not. */
function checkInReasons(tutor) {
  const reasons = []

  if (tutor.latest?.overall && tutor.latest.overall.score <= LOW_SCORE) {
    reasons.push(`latest session scored ${tutor.latest.overall.score}/5`)
  }

  if (tutor.trend === 'declining') {
    reasons.push('scores have fallen over their last three sessions')
  }

  if (tutor.stuckFocus) {
    reasons.push(
      `${labelFor(tutor.stuckFocus.key)} has been their focus ${tutor.stuckFocus.runLength} sessions running`
    )
  }

  if (tutor.sessionsInPeriod === 0 && tutor.totalSessions > 0) {
    reasons.push('no sessions recorded this period')
  }

  if (!reasons.length) return null

  return {
    tutorId: tutor.tutorId,
    reasons,
    latestScore: tutor.latest?.overall?.score ?? null,
    sessionsInPeriod: tutor.sessionsInPeriod
  }
}

/** Falling, rising or flat across the last three sessions. */
function trendOf(sessions) {
  const scores = sessions
    .slice(-3)
    .map((session) => session.overall?.score)
    .filter((score) => typeof score === 'number')

  if (scores.length < 3) return 'not-enough-data'

  const falling = scores.every((score, i) => i === 0 || score < scores[i - 1])
  const rising = scores.every((score, i) => i === 0 || score > scores[i - 1])

  if (falling) return 'declining'
  if (rising) return 'improving'
  return 'flat'
}

/** The same focus set repeatedly at the end of their history. */
function stuckFocus(sessions) {
  const latest = sessions[sessions.length - 1]
  if (!latest?.focusKey) return null

  let runLength = 0
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    if (sessions[i].focusKey !== latest.focusKey) break
    runLength += 1
  }

  return runLength >= STUCK_AFTER ? { key: latest.focusKey, runLength } : null
}

/** Did their most recent focus change actually follow an improvement? */
function focusImprovement(sessions) {
  if (sessions.length < 2) return null

  const previous = sessions[sessions.length - 2]
  const latest = sessions[sessions.length - 1]
  if (!previous.focusKey) return null

  const before = previous.scores?.find((s) => s.key === previous.focusKey)?.score
  const now = latest.scores?.find((s) => s.key === previous.focusKey)?.score

  if (typeof before !== 'number' || typeof now !== 'number' || now <= before) return null

  return { key: previous.focusKey, label: labelFor(previous.focusKey), before, now }
}

/**
 * Average score per dimension across every session in the period.
 *
 * This is the number the PD theme comes from: the move the whole team is
 * weakest at is the one worth a workshop.
 */
function dimensionAverages(tutors, from) {
  const buckets = new Map(RUBRIC.map((item) => [item.key, []]))

  for (const tutor of tutors) {
    for (const session of tutor.sessions || []) {
      if (new Date(session.at) < from) continue
      for (const score of session.scores || []) {
        if (typeof score.score === 'number' && buckets.has(score.key)) {
          buckets.get(score.key).push(score.score)
        }
      }
    }
  }

  return RUBRIC.map((item) => {
    const scores = buckets.get(item.key)
    return {
      key: item.key,
      label: item.label,
      description: item.description,
      average: scores.length
        ? Number((scores.reduce((sum, n) => sum + n, 0) / scores.length).toFixed(2))
        : null,
      sampleSize: scores.length
    }
  }).sort((a, b) => (a.average ?? 99) - (b.average ?? 99))
}

function labelFor(key) {
  return RUBRIC.find((item) => item.key === key)?.label || key
}

/**
 * The ISO week a date falls in, as "2026-W43".
 *
 * Themes are grouped by week because that is the rhythm a campus runs on —
 * one digest, one theme, per week — and it keeps repeat visits to the tab from
 * filling the history with duplicates.
 */
export function isoWeekKey(date) {
  // Shift to the Thursday of this week: ISO weeks are numbered by the year
  // that Thursday falls in, which is what makes the turn of the year work.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)

  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Did the dimension a past theme targeted actually move?
 *
 * Compares the average recorded when the theme was set against that same
 * dimension's average now. This is the only honest read on whether a PD
 * session changed anything.
 */
export function themeOutcome(previousTheme, dimensionsNow) {
  if (!previousTheme?.dimensionKey) return null

  const now = dimensionsNow.find((d) => d.key === previousTheme.dimensionKey)?.average
  const before = previousTheme.dimensionAverage

  if (typeof now !== 'number' || typeof before !== 'number') {
    return { key: previousTheme.dimensionKey, label: labelFor(previousTheme.dimensionKey),
             before: before ?? null, now: now ?? null, delta: null, change: 'not-scored' }
  }

  const delta = Number((now - before).toFixed(2))

  return {
    key: previousTheme.dimensionKey,
    label: labelFor(previousTheme.dimensionKey),
    title: previousTheme.title,
    before,
    now,
    delta,
    change: delta > 0.05 ? 'improved' : delta < -0.05 ? 'slipped' : 'held'
  }
}

const SYSTEM_PROMPT = `You write a short weekly digest for the director of a maths
tutoring campus, from statistics about how their tutors are teaching.

You are given averages and counts only — no transcripts, no student data. Do
not invent any detail that is not in the numbers you were given, and do not
name a tutor in "working" or "theme".

Write:
- "summary": two sentences on the week. Factual and calm, not a pep talk.
- "working": one sentence on the teaching moves the team is doing well, by name.
- "theme": the next professional development topic, as
  {"title": "...", "why": "one sentence tied to the numbers",
   "activities": ["...", "...", "..."]} — three concrete things a 45-minute PD
  session could actually do.

Pick the theme from the weakest dimension, unless the sample for it is tiny
compared with the others, in which case say so in "why".

Reply with JSON only.`

/** Build the whole digest: numbers, then prose. */
export async function buildDigest({ days = 7 } = {}) {
  const tutors = await listTutors()
  const stats = analyse(tutors, { days })

  // Cost is reported the same way as a coaching run, so the two can be added
  // up when projecting what a term costs.
  const usage = createUsageTracker(MODEL_NAME)

  // Nothing recorded yet: say so rather than paying for a model call that has
  // nothing to summarise.
  if (!stats.totals.sessions) {
    return {
      ...stats,
      narrative: null,
      themeHistory: await getThemes(),
      previousTheme: null,
      usage: usage.total()
    }
  }

  // The weakest dimension is what the theme will be about, and what a later
  // digest will check for movement.
  const weakest = stats.dimensions.find((d) => d.average !== null) || null

  // Read the history before this run's theme is written, so "previous" means
  // the last time, not this time.
  const historyBefore = await getThemes()
  const lastTheme = historyBefore.filter((t) => t.periodKey !== isoWeekKey(new Date())).pop() || null
  const previousTheme = themeOutcome(lastTheme, stats.dimensions)

  const facts = [
    `Period: last ${days} days.`,
    `Tutors with any history: ${stats.totals.tutors}. Sessions in period: ${stats.totals.sessions}.`,
    '',
    'Average score per dimension this period (1-5, weakest first):',
    ...stats.dimensions.map(
      (d) => `- ${d.label}: ${d.average ?? 'no data'} (from ${d.sampleSize} scores) — ${d.description}`
    ),
    '',
    `Tutors flagged for a check-in: ${stats.needsCheckIn.length}.`,
    `Focus areas that improved since last session: ${
      stats.improvements.map((i) => `${i.label} ${i.before}->${i.now}`).join(', ') || 'none'
    }.`
  ].join('\n')

  const { data, usage: callUsage } = await askJson({
    system: SYSTEM_PROMPT,
    user: facts,
    maxTokens: 700
  })

  usage.add('digest', callUsage)

  const theme = {
    title: text(data.theme?.title),
    why: text(data.theme?.why),
    activities: Array.isArray(data.theme?.activities)
      ? data.theme.activities.map(text).filter(Boolean).slice(0, 3)
      : []
  }

  // Keep it, so there is a record of what was proposed and what the numbers
  // looked like when it was. Only a theme with a title is worth storing.
  if (theme.title) {
    await putTheme({
      periodKey: isoWeekKey(new Date()),
      generatedAt: new Date().toISOString(),
      title: theme.title,
      why: theme.why,
      activities: theme.activities,
      // What the theme was drawn from, so a later digest can check it moved.
      dimensionKey: weakest?.key || null,
      dimensionLabel: weakest?.label || null,
      dimensionAverage: weakest?.average ?? null,
      sampleSize: weakest?.sampleSize ?? 0,
      tutors: stats.totals.tutors,
      sessions: stats.totals.sessions
    })
  }

  return {
    ...stats,
    narrative: {
      summary: text(data.summary),
      working: text(data.working),
      theme
    },
    previousTheme,
    themeHistory: await getThemes(),
    usage: usage.total()
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}
