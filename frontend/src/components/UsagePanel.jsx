// Tokens and cost for this run, broken down by the agent that spent them.
//
// Every stage that calls the model is listed, so the number is auditable
// rather than a single total you have to take on trust.
export default function UsagePanel({ usage }) {
  if (!usage) return null

  const fresh = Math.max(usage.inputTokens - usage.cachedTokens, 0)

  return (
    <section className="card usage-panel">
      <h2>Tokens and cost</h2>

      <div className="usage-headline">
        <div className="usage-figure">
          <span className="usage-number">{usage.totalTokens.toLocaleString()}</span>
          <span className="usage-figure-label">tokens this run</span>
        </div>
        <div className="usage-figure">
          <span className="usage-number usage-cost">${usage.costUsd.toFixed(4)}</span>
          <span className="usage-figure-label">
            cost{usage.savedUsd > 0 && <> · ${usage.savedUsd.toFixed(4)} saved by caching</>}
          </span>
        </div>
      </div>

      <ul className="usage-split">
        <li><span>Input</span><strong>{usage.inputTokens.toLocaleString()}</strong></li>
        <li><span>of which cached</span><strong>{usage.cachedTokens.toLocaleString()}</strong></li>
        <li><span>fresh input</span><strong>{fresh.toLocaleString()}</strong></li>
        <li><span>Output</span><strong>{usage.outputTokens.toLocaleString()}</strong></li>
      </ul>

      <table className="usage-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Input</th>
            <th>Cached</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          {usage.calls.map((call) => (
            <tr key={call.stage}>
              <td className="usage-stage">{STAGE_NAMES[call.stage] || call.stage}</td>
              <td>{call.inputTokens.toLocaleString()}</td>
              <td className={call.cachedTokens ? 'usage-cached' : 'usage-zero'}>
                {call.cachedTokens.toLocaleString()}
              </td>
              <td>{call.outputTokens.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="hint">
        Model {usage.model}. Stages that never reach the model — scrubbing, the
        injection check, the exact-quote check — cost nothing and are not listed.
      </p>
    </section>
  )
}

const STAGE_NAMES = {
  safeguarding: 'Safeguarding check',
  score: 'Observer (scoring)',
  maths: 'Maths claim extraction',
  verify: 'Verifier (support check)',
  coach: 'Coach (feedback)',
  digest: 'Coordinator digest'
}
