// The one place the browser talks to the server.
//
// POST /api/coach returns the pipeline's own shape; the components want
// something flatter. Everything that translates between the two lives here, so
// a change to the server response touches one file rather than eight.

/**
 * Run a transcript through the coaching pipeline.
 * Throws an Error with a readable message if the request fails.
 */
/* ------------------------------------------------------------- the token */

// The session token lives in this browser. It is sent as a Bearer header on
// every call that needs an account behind it.
const TOKEN_KEY = 'squareone.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/** One place that knows how to call the API, so auth is never forgotten. */
async function call(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`

  let response
  try {
    response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('Could not reach the server. Is it running on port 3001?')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.')
    error.status = response.status
    throw error
  }

  return data
}

/* ---------------------------------------------------------------- accounts */

export const login = (email, password) =>
  call('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })

export const createAccount = (details) =>
  call('/api/auth/signup', { method: 'POST', body: details, auth: false })

export const fetchMe = () => call('/api/auth/me')

export const logout = () => call('/api/auth/logout', { method: 'POST' })

export const updateAccount = (changes) =>
  call('/api/auth/account', { method: 'PATCH', body: changes })

export const fetchGrowth = () => call('/api/growth')

/* ---------------------------------------------------------------- coaching */

/**
 * Run a transcript through the pipeline, reporting progress as it happens.
 *
 * The server streams newline-delimited JSON: one `stage` event each time a
 * stage the UI shows actually finishes, then one `result`. `onStage` is called
 * with the stage key so the progress pills can move during the run rather than
 * all at the end.
 */
export async function requestCoaching(transcript, { onStage } = {}) {
  let response
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      body: JSON.stringify({ transcript })
    })
  } catch {
    throw new Error('Could not reach the server. Is it running on port 3001?')
  }

  // Validation failures answer before the stream starts, as ordinary JSON.
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.error || 'Something went wrong.')
    error.status = response.status
    throw error
  }

  const reader = response.body?.getReader()

  // No streaming body available: fall back to reading the whole thing.
  if (!reader) {
    const text = await response.text()
    return adapt(finalEvent(text.split('\n')))
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Everything up to the last newline is complete; the remainder is a
    // partial line waiting for the next chunk.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue

      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue // a malformed line is not worth failing the whole run over
      }

      if (event.type === 'stage') onStage?.(event.stage)
      if (event.type === 'result') result = event.result
      if (event.type === 'error') throw new Error(event.error)
    }
  }

  if (!result) throw new Error('The run ended before it produced a result.')
  return adapt(result)
}

/** Pull the result out of a non-streamed body. */
function finalEvent(lines) {
  for (const line of lines.reverse()) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    if (event.type === 'result') return event.result
    if (event.type === 'error') throw new Error(event.error)
  }
  throw new Error('The run ended before it produced a result.')
}

/** Turn the server's response into the shape the components render. */
function adapt(data) {
  const flaggedLines = new Set(
    (data.injection?.findings || []).map((finding) => finding.lineNumber)
  )

  const turns = toTurns(data.scrubbedTranscript || '', {
    flaggedLines,
    safeguardingQuote: data.stopped ? data.safeguarding?.quote : null
  })

  const stats = {
    redactions: Object.values(data.redactions || {}).reduce((sum, n) => sum + n, 0),
    evidenceVerified: data.evidenceReport?.verified || 0,
    evidenceTotal: data.evidenceReport?.total || 0,
    totalTokens: data.usage?.totalTokens || 0,
    costUsd: data.usage?.costUsd || 0
  }

  // The full per-agent breakdown, for the tokens-and-cost panel.
  const usage = data.usage
    ? {
        model: data.usage.model,
        calls: data.usage.calls || [],
        inputTokens: data.usage.inputTokens || 0,
        outputTokens: data.usage.outputTokens || 0,
        cachedTokens: data.usage.cachedTokens || 0,
        totalTokens: data.usage.totalTokens || 0,
        costUsd: data.usage.costUsd || 0,
        savedUsd: data.usage.savedUsd || 0
      }
    : null

  if (data.stopped) {
    return {
      blocked: true,
      overall: null,
      // A stopped session is never scored, so nothing is tracked for it.
      growth: null,
      stagesCompleted: data.stagesCompleted || ['scrubbed'],
      blockedReason: {
        quote: data.safeguarding?.quote || '',
        reason: data.safeguarding?.reason || '',
        guidance: data.safeguarding?.guidance || ''
      },
      transcript: turns,
      scores: [],
      coaching: null,
      stats,
      usage
    }
  }

  return {
    blocked: false,
    stagesCompleted: data.stagesCompleted || [],
    transcript: turns,
    overall: data.overall || null,
    growth: data.growth || null,
    scores: (data.dimensions || []).map((dimension) => ({
      key: dimension.key,
      score: dimension.score,
      comment: dimension.comment,
      evidence: dimension.evidence,
      verified: dimension.verified,
      confidence: dimension.confidence,
      // null means the support check did not reach a verdict on this row.
      supported: dimension.supported ?? null,
      supportNote: dimension.supportNote || ''
    })),
    coaching: data.feedback || null,
    // Flags only — never folded into scores anywhere in the UI.
    maths: data.maths || null,
    stats,
    usage
  }
}

/**
 * Split the scrubbed transcript back into turns for TranscriptCard.
 *
 * A line that starts "Speaker:" becomes that speaker's turn; anything else is
 * treated as a continuation of the previous one, so wrapped lines do not each
 * become a turn of their own.
 */
function toTurns(scrubbedTranscript, { flaggedLines, safeguardingQuote }) {
  const turns = []

  scrubbedTranscript.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) return

    const lineNumber = index + 1
    const tags = []
    if (flaggedLines.has(lineNumber)) tags.push('Flagged')
    if (safeguardingQuote && line === safeguardingQuote.trim()) tags.push('Safeguarding')

    const match = line.match(/^([A-Za-z][\w .'-]{0,24}):\s*(.*)$/)

    if (match) {
      turns.push({
        id: lineNumber,
        speaker: normaliseSpeaker(match[1]),
        text: match[2],
        tags
      })
      return
    }

    // A continuation of the turn above, or a stray line before any speaker.
    const previous = turns[turns.length - 1]
    if (previous) {
      previous.text = `${previous.text} ${line}`.trim()
      previous.tags = [...new Set([...previous.tags, ...tags])]
    } else {
      turns.push({ id: lineNumber, speaker: 'Note', text: line, tags })
    }
  })

  return turns
}

// The transcript card styles "tutor" and "student" turns differently, so fold
// the common variations onto those two labels.
function normaliseSpeaker(raw) {
  const name = raw.trim().toLowerCase()
  if (name.startsWith('tutor') || name.startsWith('coach')) return 'Tutor'
  if (name.startsWith('student') || name.startsWith('pupil') || name === '[name]') return 'Student'
  return raw.trim()
}

/**
 * Fetch the coordinator digest for the last `days` days.
 * Returned as-is — the digest shape is already what the panel renders.
 */
export const requestDigest = (days = 7) => call(`/api/digest?days=${days}`)
