// Find the .env file, wherever the marker put it.
//
// `import 'dotenv/config'` only looks in the working directory, which breaks
// the moment someone keeps their key outside the project — including the
// course's own convention of one folder up from the project. So search
// upwards and take the first file that has the key.
//
// Import this before anything that reads process.env.

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const BACKEND_DIR = dirname(fileURLToPath(import.meta.url))

// backend/ → the project root → one above it → one above that.
// dotenv does not overwrite a variable that is already set, so the nearest
// file wins and a real environment variable beats every file.
export const SEARCHED = [
  join(BACKEND_DIR, '.env'),
  join(resolve(BACKEND_DIR, '..'), '.env'),
  join(resolve(BACKEND_DIR, '..', '..'), '.env'),
  join(resolve(BACKEND_DIR, '..', '..', '..'), '.env')
]

export const loaded = []

for (const path of SEARCHED) {
  if (!existsSync(path)) continue
  const result = dotenv.config({ path })
  if (!result.error) loaded.push(path)
}

/** Where the key came from, for the startup line and for error messages. */
export function describeEnvSearch() {
  if (loaded.length) return `Loaded environment from: ${loaded.join(', ')}`
  return `No .env file found. Looked in:\n  ${SEARCHED.join('\n  ')}`
}
