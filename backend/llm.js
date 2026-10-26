// Shared LLM client. Every agent in this app talks to GPT-6-luna through the
// Portkey gateway, using the key in /backend/.env. Nothing here is ever sent to
// the browser.

import OpenAI from 'openai'

import './env.js'
import { describeEnvSearch } from './env.js'

const BASE_URL = (process.env.PORTKEY_BASE_URL || 'https://api.portkey.ai/v1').replace(/\/$/, '')
export const MODEL_NAME = (process.env.MODEL_NAME || 'gpt-6-luna').trim()

/** Is a key available? Used by the server to warn at boot. */
export function hasApiKey() {
  return Boolean((process.env.PORTKEY_API_KEY || '').trim())
}

let client = null

/**
 * Build the client on first use.
 *
 * Deliberately lazy: the pure stages — scrubbing, the injection check, the
 * exact-quote check, the maths evaluator — are unit-tested without any
 * network, and they should not need an API key just to be imported.
 */
function getClient() {
  if (client) return client

  const apiKey = (process.env.PORTKEY_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error(
      `PORTKEY_API_KEY is missing.\n${describeEnvSearch()}\n` +
      'Copy backend/.env.example to backend/.env and fill it in, or keep a .env ' +
      'with PORTKEY_API_KEY in any folder above the project.'
    )
  }

  client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    defaultHeaders: { 'x-portkey-api-key': apiKey }
  })

  return client
}

/**
 * Ask the model for a single JSON object.
 *
 * The transcript is always passed as a user message wrapped in markers, and the
 * system prompt tells the model to treat that text as data. That is a second
 * line of defence behind the injectionCheck stage.
 *
 * Returns { data, usage } so the caller can hand usage to the usage stage.
 */
export async function askJson({ system, user, maxTokens = 900 }) {
  // Models occasionally answer with prose, or run past the token ceiling and
  // leave the JSON unterminated. Both are transient and both used to lose the
  // whole run, so one retry is worth the tokens. The usage of a failed attempt
  // is still counted — it was really spent.
  let spent = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 }
  let lastError

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await getClient().chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_completion_tokens: maxTokens
    })

    spent = {
      inputTokens: spent.inputTokens + (response.usage?.prompt_tokens ?? 0),
      outputTokens: spent.outputTokens + (response.usage?.completion_tokens ?? 0),
      // Input tokens served from the model's prefix cache. Billed at a
      // fraction of the normal input rate, so they are tracked separately.
      cachedTokens: spent.cachedTokens + (response.usage?.prompt_tokens_details?.cached_tokens ?? 0)
    }

    try {
      return { data: parseJson(response.choices?.[0]?.message?.content || ''), usage: spent }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

/**
 * Models sometimes wrap JSON in prose or a ```json fence. Pull out the first
 * balanced object we can find and parse that.
 */
function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model did not return JSON.')
  }

  return JSON.parse(candidate.slice(start, end + 1))
}
