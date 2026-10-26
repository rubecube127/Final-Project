// Accounts and sessions.
//
// Built on node:crypto alone — the project allows only express, cors, dotenv
// and the LLM SDK, so there is no bcrypt and no JWT library here.
//
//   passwords  scrypt with a per-user random salt; compared in constant time
//   sessions   an opaque 32-byte random token, stored server-side
//
// What this is NOT: email verification, password reset, rate limiting, or
// anything that sends mail. Nothing in this file sends an email, by design.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { getUserByEmail, getUserById, putUser, putSession, getSession, deleteSession } from './storage.js'

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 64
const SESSION_DAYS = 30
const MIN_PASSWORD = 8

/** Hash a password with a fresh salt. */
async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return { salt, hash: derived.toString('hex') }
}

/** Compare without leaking timing information. */
async function passwordMatches(password, user) {
  const { hash } = await hashPassword(password, user.salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(user.hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** The shape the browser is allowed to see. Never the hash or the salt. */
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  }
}

export function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD
}

/** Create an account. Throws an Error with a message meant for the user. */
export async function signUp({ email, password, firstName, lastName, role = 'tutor' }) {
  const cleanEmail = String(email || '').trim().toLowerCase()

  if (!validateEmail(cleanEmail)) throw new Error('Please enter a valid email address.')
  if (!validatePassword(password)) throw new Error(`Please choose a password of at least ${MIN_PASSWORD} characters.`)
  if (!String(firstName || '').trim()) throw new Error('Please enter your first name.')
  if (!String(lastName || '').trim()) throw new Error('Please enter your last name.')

  if (await getUserByEmail(cleanEmail)) {
    throw new Error('An account with that email already exists.')
  }

  const { salt, hash } = await hashPassword(password)

  const user = {
    id: `u_${randomBytes(9).toString('hex')}`,
    email: cleanEmail,
    firstName: String(firstName).trim().slice(0, 40),
    lastName: String(lastName).trim().slice(0, 40),
    role,
    salt,
    hash,
    createdAt: new Date().toISOString()
  }

  await putUser(user)
  return user
}

/** Check credentials. Returns the user, or null — never says which part was wrong. */
export async function verifyCredentials(email, password) {
  const user = await getUserByEmail(String(email || '').trim().toLowerCase())
  if (!user) return null
  return (await passwordMatches(String(password || ''), user)) ? user : null
}

/** Issue a session token. */
export async function startSession(userId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await putSession({ token, userId, expiresAt, createdAt: new Date().toISOString() })
  return { token, expiresAt }
}

/** The user behind a token, or null if it is unknown or expired. */
export async function userForToken(token) {
  if (!token) return null

  const session = await getSession(token)
  if (!session) return null

  if (new Date(session.expiresAt) < new Date()) {
    await deleteSession(token)
    return null
  }

  return (await getUserById(session.userId)) || null
}

export async function endSession(token) {
  if (token) await deleteSession(token)
}

/**
 * Change email and/or password. The current password is always required —
 * holding a session token is not enough to take over an account.
 */
export async function updateAccount(user, { currentPassword, email, newPassword }) {
  if (!(await passwordMatches(String(currentPassword || ''), user))) {
    throw new Error('That current password is not right.')
  }

  const updated = { ...user }

  if (email !== undefined && String(email).trim().toLowerCase() !== user.email) {
    const cleanEmail = String(email).trim().toLowerCase()
    if (!validateEmail(cleanEmail)) throw new Error('Please enter a valid email address.')

    const existing = await getUserByEmail(cleanEmail)
    if (existing && existing.id !== user.id) {
      throw new Error('An account with that email already exists.')
    }
    // No confirmation email is sent — this app does not send mail.
    updated.email = cleanEmail
  }

  if (newPassword) {
    if (!validatePassword(newPassword)) {
      throw new Error(`Please choose a password of at least ${MIN_PASSWORD} characters.`)
    }
    const { salt, hash } = await hashPassword(newPassword)
    updated.salt = salt
    updated.hash = hash
  }

  await putUser(updated, user.email)
  return updated
}

/** Express middleware: require a valid Bearer token. */
export async function requireAuth(request, response, next) {
  const header = request.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const user = await userForToken(token)

  if (!user) {
    return response.status(401).json({ error: 'Please sign in again.' })
  }

  request.user = user
  request.token = token
  next()
}
