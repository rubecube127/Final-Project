// Stage 1 — scrub
//
// Removes personally identifying information from the raw transcript BEFORE
// any model call. Everything downstream (injection check, safeguarding, both
// LLM agents) only ever sees the scrubbed text.

// Common first names seen in tutoring sessions. The caller can pass extra
// names (for example the roster for a school) via options.names.
const DEFAULT_NAMES = [
  'Aaliyah', 'Aiden', 'Alex', 'Amara', 'Ana', 'Andre', 'Angel', 'Ava',
  'Brandon', 'Brianna', 'Camila', 'Carlos', 'Chloe', 'Daniel', 'David',
  'Diego', 'Elena', 'Elijah', 'Emily', 'Emma', 'Ethan', 'Fatima', 'Gabriel',
  'Grace', 'Hannah', 'Isabella', 'Jackson', 'Jacob', 'Jada', 'Jasmine',
  'Javier', 'Jayden', 'Jordan', 'Jose', 'Joshua', 'Kayla', 'Keisha', 'Kevin',
  'Liam', 'Lucas', 'Luis', 'Maria', 'Mateo', 'Maya', 'Mia', 'Michael',
  'Mohammed', 'Naomi', 'Nathan', 'Nia', 'Noah', 'Olivia', 'Omar', 'Priya',
  'Rachel', 'Ryan', 'Samuel', 'Sarah', 'Sofia', 'Tyler', 'Valeria', 'Wei',
  'Xavier', 'Yusuf', 'Zoe'
]

// Each rule is a regex plus the placeholder that replaces whatever it matches.
const RULES = [
  // Email addresses
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL]'],
  // Phone numbers: 555-123-4567, (555) 123 4567, +1 555 123 4567
  [/(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[PHONE]'],
  // US Social Security numbers
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]'],
  // Street addresses
  [/\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b\.?/g, '[ADDRESS]'],
  // Student ID numbers written out
  [/\b(?:student\s*(?:id|number)|id\s*number)\s*:?\s*#?\d{4,}/gi, '[STUDENT_ID]'],
  // Links, which often carry a school or family name
  [/\bhttps?:\/\/\S+/g, '[LINK]']
]

/**
 * Scrub a transcript.
 *
 * Returns { text, redactions } where redactions counts what was removed, so
 * the UI can honestly tell the tutor that the text was cleaned first.
 */
export function scrub(rawTranscript, options = {}) {
  let text = String(rawTranscript || '')
  const redactions = {}

  // 1. Pattern-based PII.
  for (const [pattern, placeholder] of RULES) {
    text = text.replace(pattern, () => {
      redactions[placeholder] = (redactions[placeholder] || 0) + 1
      return placeholder
    })
  }

  // 2. Name list. Speaker labels at the start of a line become roles so the
  //    transcript still reads as a dialogue; names elsewhere become [NAME].
  const names = [...DEFAULT_NAMES, ...(options.names || [])]
  for (const name of names) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${safe}\\b('s)?`, 'gi')
    text = text.replace(pattern, (match, possessive) => {
      redactions['[NAME]'] = (redactions['[NAME]'] || 0) + 1
      return possessive ? "[NAME]'s" : '[NAME]'
    })
  }

  return { text, redactions }
}
