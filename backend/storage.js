// A tiny JSON-file store for growth tracking.
//
// Deliberately not a database: the project is limited to express, cors, dotenv
// and the LLM SDK, so this uses node:fs and nothing else.
//
// WHAT IS STORED: a tutor's scores per session, and which dimension was their
// focus. WHAT IS NEVER STORED: the transcript, or any quote from it. Quotes are
// verbatim student and tutor speech, so keeping them would undo the point of
// the scrub stage. `toRecord` below is the only thing that writes, and it
// copies fields one by one rather than spreading, so a new field on the
// pipeline result cannot leak into the file by accident.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(HERE, 'data')
const DATA_FILE = join(DATA_DIR, 'growth.json')

const EMPTY = { tutors: {}, users: {}, sessions: {}, themes: {} }

// All writes go through this chain, so two requests landing at once cannot
// read-modify-write over each other.
let queue = Promise.resolve()

/** Read the whole store. Returns an empty store if the file is not there yet. */
async function load() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY)
    throw error
  }
}

/** Write the store, via a temp file so a crash cannot leave half a file. */
async function save(store) {
  await mkdir(DATA_DIR, { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  await writeFile(temporary, JSON.stringify(store, null, 2), 'utf8')
  await rename(temporary, DATA_FILE)
}

/**
 * Build the record for one session.
 *
 * Exported so a test can assert that nothing transcript-shaped survives it.
 */
export function toRecord({ sessionId, at, overall, dimensions, focusKey }) {
  return {
    sessionId,
    at,
    overall: overall
      ? { score: overall.score, label: overall.label, confidence: overall.confidence }
      : null,
    // One entry per dimension: the number, how sure the model was, and whether
    // the quote stood up. No quote, no comment, no transcript.
    scores: dimensions.map((dimension) => ({
      key: dimension.key,
      score: dimension.score,
      confidence: dimension.confidence,
      supported: dimension.supported ?? null
    })),
    focusKey: focusKey || null
  }
}

/** Every session recorded for one tutor, oldest first. */
export async function getSessions(tutorId) {
  const store = await load()
  return store.tutors[tutorId]?.sessions || []
}

/** Append a session record for a tutor and return it. */
export async function addSession(tutorId, record) {
  queue = queue.then(async () => {
    const store = await load()
    const tutor = store.tutors[tutorId] || { id: tutorId, sessions: [] }
    tutor.sessions.push(record)
    store.tutors[tutorId] = tutor
    await save(store)
  })

  await queue
  return record
}

/**
 * Drop every session matching a predicate, and any tutor left with none.
 *
 * Exists so the seed script can remove exactly what it added without touching
 * real records. Takes a predicate rather than a list of names so the caller
 * cannot accidentally delete a real tutor who shares a name with a demo one.
 */
export async function removeSessionsWhere(predicate) {
  let removed = 0

  queue = queue.then(async () => {
    const store = await load()

    for (const [id, tutor] of Object.entries(store.tutors)) {
      const kept = (tutor.sessions || []).filter((session) => !predicate(session))
      removed += (tutor.sessions || []).length - kept.length

      if (kept.length) {
        tutor.sessions = kept
      } else {
        delete store.tutors[id]
      }
    }

    await save(store)
  })

  await queue
  return removed
}

/* ---------------------------------------------------------- PD themes */

/**
 * Record the professional-development theme a digest proposed.
 *
 * Keyed by period (an ISO week), so opening the digest five times in a week
 * leaves one entry, refreshed, rather than five. The numbers behind the theme
 * can still move as more sessions land, which is why this upserts rather than
 * refusing a second write.
 */
export async function putTheme(theme) {
  queue = queue.then(async () => {
    const store = await load()
    store.themes = store.themes || {}
    store.themes[theme.periodKey] = theme
    await save(store)
  })

  await queue
  return theme
}

/** Every theme ever proposed, oldest first. */
export async function getThemes() {
  const store = await load()
  return Object.values(store.themes || {}).sort((a, b) => a.periodKey.localeCompare(b.periodKey))
}

/* ------------------------------------------------------------- accounts */

/**
 * Save a user. `previousEmail` is passed when the email changed, so the old
 * key is removed rather than leaving two records for one person.
 *
 * Users are keyed by id; email is an index into that, kept lowercase.
 */
export async function putUser(user, previousEmail = null) {
  queue = queue.then(async () => {
    const store = await load()
    store.users = store.users || {}

    if (previousEmail && previousEmail !== user.email) {
      delete store.users[previousEmail]
    }

    store.users[user.email] = user
    await save(store)
  })

  await queue
  return user
}

export async function getUserByEmail(email) {
  const store = await load()
  return store.users?.[email] || null
}

export async function getUserById(id) {
  const store = await load()
  return Object.values(store.users || {}).find((user) => user.id === id) || null
}

/* ------------------------------------------------------------- sessions */

export async function putSession(session) {
  queue = queue.then(async () => {
    const store = await load()
    store.sessions = store.sessions || {}
    store.sessions[session.token] = session
    await save(store)
  })

  await queue
  return session
}

export async function getSession(token) {
  const store = await load()
  return store.sessions?.[token] || null
}

export async function deleteSession(token) {
  queue = queue.then(async () => {
    const store = await load()
    if (store.sessions) delete store.sessions[token]
    await save(store)
  })

  await queue
}

/** Every tutor with at least one session. Used by the coordinator digest. */
export async function listTutors() {
  const store = await load()
  return Object.values(store.tutors)
}
