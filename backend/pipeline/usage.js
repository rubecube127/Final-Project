// Stage 7 — usage
//
// Adds up tokens across every model call in one request and turns them into a
// dollar figure, so the program can see what coaching a session costs.

const PRICE_INPUT = Number(process.env.PRICE_INPUT_PER_MTOK || 1.25)
const PRICE_OUTPUT = Number(process.env.PRICE_OUTPUT_PER_MTOK || 10)

// Cached input is billed at a fraction of fresh input. Caching only happens
// when a call's static prefix is long enough — see the note in score.js.
const PRICE_CACHED = Number(process.env.PRICE_CACHED_PER_MTOK || PRICE_INPUT / 10)

/**
 * Collects usage from each stage, then reports the total.
 *
 * Used as: const tracker = createUsageTracker(); tracker.add('score', usage)
 */
export function createUsageTracker(model) {
  const calls = []

  return {
    add(stage, usage) {
      if (!usage) return
      // A stage that short-circuited before reaching the model (the
      // safeguarding phrase list, say) is not a call worth reporting.
      if (!usage.inputTokens && !usage.outputTokens) return
      calls.push({
        stage,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        cachedTokens: usage.cachedTokens || 0
      })
    },

    total() {
      const inputTokens = calls.reduce((sum, c) => sum + c.inputTokens, 0)
      const outputTokens = calls.reduce((sum, c) => sum + c.outputTokens, 0)
      const cachedTokens = calls.reduce((sum, c) => sum + c.cachedTokens, 0)

      // Cached tokens are part of inputTokens, not on top of it, so the fresh
      // input is what is left after taking them out.
      const freshTokens = Math.max(inputTokens - cachedTokens, 0)

      // Prices are quoted per 1,000,000 tokens.
      const costUsd =
        (freshTokens / 1e6) * PRICE_INPUT +
        (cachedTokens / 1e6) * PRICE_CACHED +
        (outputTokens / 1e6) * PRICE_OUTPUT

      // What the same call would have cost with no cache, so the saving is
      // visible rather than asserted.
      const uncachedUsd =
        (inputTokens / 1e6) * PRICE_INPUT + (outputTokens / 1e6) * PRICE_OUTPUT

      return {
        model,
        calls,
        inputTokens,
        outputTokens,
        cachedTokens,
        totalTokens: inputTokens + outputTokens,
        // Fractions of a cent are noise; four decimals is plenty.
        costUsd: Number(costUsd.toFixed(4)),
        savedUsd: Number((uncachedUsd - costUsd).toFixed(4))
      }
    }
  }
}
