import { useEffect, useState } from 'react'
import { fetchGrowth } from '../api.js'
import { RUBRIC } from '../mockData.js'

// Everything this tutor's account has recorded, reached from the account menu.
// Scores only — transcripts are never stored, so there is nothing else to show.
export default function ProgressView({ onClose }) {
  const [growth, setGrowth] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchGrowth()
      .then((data) => { if (!cancelled) setGrowth(data) })
      .catch((problem) => { if (!cancelled) setError(problem.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  return (
    <section className="card">
      <div className="panel-head">
        <h2>My progress</h2>
        <button className="button ghost" type="button" onClick={onClose}>Back</button>
      </div>

      {loading && <p>Loading your sessions…</p>}
      {error && <p className="login-error">{error}</p>}

      {growth && growth.sessionCount === 0 && (
        <p className="hint">
          No sessions recorded yet. Coach one and it will appear here.
        </p>
      )}

      {growth && growth.sessionCount > 0 && (
        <>
          <p className="hint">
            {growth.sessionCount} session{growth.sessionCount === 1 ? '' : 's'} recorded.
            Scores only — your transcripts are never stored.
          </p>

          <div className="progress-scroll">
          <table className="progress-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Overall</th>
                {RUBRIC.map((dimension) => (
                  <th key={dimension.key} className="progress-dim">{dimension.label}</th>
                ))}
                <th>Focus set</th>
              </tr>
            </thead>
            <tbody>
              {growth.history.map((session, index) => (
                <tr key={session.at}>
                  <td>
                    {index + 1}
                    <span className="progress-date">
                      {new Date(session.at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="progress-overall">{session.overall?.score ?? '—'}</td>
                  {RUBRIC.map((dimension) => {
                    const score = session.scores?.find((s) => s.key === dimension.key)?.score
                    return <td key={dimension.key}>{score ?? '—'}</td>
                  })}
                  <td className="progress-focus">{labelFor(session.focusKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  )
}

function labelFor(key) {
  if (!key) return '—'
  return RUBRIC.find((dimension) => dimension.key === key)?.label || key
}
