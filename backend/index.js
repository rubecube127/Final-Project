// Express server for Tutor Coach.
//
// The browser only ever calls /api/*. The Portkey key is read from .env here
// and never leaves this process.

import './env.js'
import { describeEnvSearch } from './env.js'
import express from 'express'
import cors from 'cors'
import { runCoachPipeline } from './pipeline/index.js'
import { buildDigest } from './digest.js'
import {
  signUp, verifyCredentials, startSession, endSession,
  updateAccount, publicUser, requireAuth
} from './auth.js'
import { getUserByEmail, getSessions } from './storage.js'
import { pickFocus, assessProgress } from './pipeline/growthTracker.js'
import { MODEL_NAME, hasApiKey } from './llm.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)

// One tutoring session's worth of text. Below the minimum there is nothing to
// coach; above the maximum it is not one session, and four model calls over it
// would be slow and expensive.
const MIN_CHARS = 20
const MAX_CHARS = 20000

app.use(cors())
// Transcripts are long but not unbounded.
app.use(express.json({ limit: '1mb' }))

// Simple liveness check, handy when the Vite proxy seems not to connect.
app.get('/api/health', (request, response) => {
  response.json({ ok: true, model: MODEL_NAME })
})

/* ------------------------------------------------------------ accounts */

app.post('/api/auth/signup', async (request, response) => {
  const { email, password, firstName, lastName } = request.body || {}

  try {
    const user = await signUp({ email, password, firstName, lastName })
    const session = await startSession(user.id)
    response.status(201).json({ user: publicUser(user), ...session })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body || {}
  const user = await verifyCredentials(email, password)

  // Deliberately one message for both cases: saying which part was wrong tells
  // an attacker whether an address has an account.
  if (!user) {
    return response.status(401).json({ error: 'That email and password do not match an account.' })
  }

  const session = await startSession(user.id)
  response.json({ user: publicUser(user), ...session })
})

app.post('/api/auth/logout', requireAuth, async (request, response) => {
  await endSession(request.token)
  response.json({ ok: true })
})

app.get('/api/auth/me', requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user) })
})

app.patch('/api/auth/account', requireAuth, async (request, response) => {
  const { currentPassword, email, newPassword } = request.body || {}

  try {
    const updated = await updateAccount(request.user, { currentPassword, email, newPassword })
    response.json({ user: publicUser(updated) })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

/** A tutor's own history, for the progress view in the account menu. */
app.get('/api/growth', requireAuth, async (request, response) => {
  const sessions = await getSessions(request.user.id)
  const latest = sessions[sessions.length - 1] || null

  response.json({
    sessionCount: sessions.length,
    history: sessions.map((session) => ({
      at: session.at,
      overall: session.overall,
      focusKey: session.focusKey,
      scores: session.scores
    })),
    currentFocus: latest?.focusKey
      ? pickFocus((latest.scores || []).map((s) => ({ key: s.key, score: s.score })))
      : null
  })
})

/* -------------------------------------------------------------- coaching */

// The one real endpoint: run a transcript through the coaching pipeline.
app.post('/api/coach', requireAuth, async (request, response) => {
  const { transcript, names } = request.body || {}

  if (typeof transcript !== 'string' || transcript.trim().length < MIN_CHARS) {
    return response.status(400).json({
      error: `Please paste a session transcript of at least ${MIN_CHARS} characters.`
    })
  }

  // An unbounded transcript means an unbounded prompt, across four model calls.
  // A whole PDF pasted by accident should be refused, not quietly billed for.
  if (transcript.length > MAX_CHARS) {
    return response.status(400).json({
      error:
        `That transcript is ${transcript.length.toLocaleString()} characters, and the limit is ` +
        `${MAX_CHARS.toLocaleString()}. Please send one session at a time.`
    })
  }

  // The run takes the better part of a minute, so stages are streamed as
  // newline-delimited JSON rather than held back until the end. Without this
  // the progress pills sit on the first stage and then all finish at once,
  // which tells the tutor nothing about how far along they are.
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders?.()

  const send = (event) => response.write(`${JSON.stringify(event)}\n`)

  try {
    const result = await runCoachPipeline(transcript, {
      names: Array.isArray(names) ? names : [],
      // Identity comes from the signed-in account, never from the request
      // body — that is the whole point of having accounts.
      tutorId: request.user.id,
      sessionId: `s_${Date.now().toString(36)}`,
      onStage: (stage) => send({ type: 'stage', stage })
    })

    send({ type: 'result', result })
    response.end()
  } catch (error) {
    // Log the detail server-side; send the tutor something readable. The
    // headers are already out, so the error travels in the stream rather than
    // as a status code.
    console.error('[/api/coach]', error)
    send({
      type: 'error',
      error: 'The coaching model could not be reached. Please try again in a moment.'
    })
    response.end()
  }
})

// The coordinator digest: one summary across every tutor's stored scores.
// Read-only, and it never touches a transcript — none are stored.
app.get('/api/digest', requireAuth, async (request, response) => {
  if (request.user.role !== 'coordinator') {
    return response.status(403).json({
      error: 'The digest is for coordinators. It shows every tutor\'s scores, so it is not open to all accounts.'
    })
  }

  const days = Number(request.query.days)
  const window = Number.isFinite(days) && days > 0 && days <= 365 ? Math.round(days) : 7

  try {
    response.json(await buildDigest({ days: window }))
  } catch (error) {
    console.error('[/api/digest]', error)
    response.status(502).json({ error: 'Could not build the digest. Please try again.' })
  }
})

// A known account so the app can be tried without signing up first.
// Created only if it is missing, and no email is ever sent anywhere.
async function ensureTestAccount() {
  const email = 'testtest@gmail.com'
  if (await getUserByEmail(email)) return

  await signUp({
    email,
    password: 'testpassword',
    firstName: 'Test',
    lastName: 'Account',
    // Coordinator, so the digest can be seen while testing.
    role: 'coordinator'
  })
  console.log(`Created the test account: ${email}`)
}

await ensureTestAccount()

app.listen(PORT, () => {
  console.log(`Square One server listening on http://localhost:${PORT} (model: ${MODEL_NAME})`)

  // Better to say this at boot than to have the first coaching run fail.
  if (!hasApiKey()) {
    console.warn(`\n⚠  ${describeEnvSearch()}\n   Coaching will fail until PORTKEY_API_KEY is set.\n`)
  } else {
    console.log(describeEnvSearch())
  }
})
