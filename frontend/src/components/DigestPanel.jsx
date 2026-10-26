import { useEffect, useState } from 'react'
import { requestDigest } from '../api.js'

// The coordinator's view: who needs a person this week, what the team is doing
// well, and what the next professional development session should cover.
//
// Fetches when the tab opens. Nothing here is per-student — the digest is built
// from stored scores, and no transcript is ever stored.
function verdict(change) {
  if (change === 'improved') return 'improved'
  if (change === 'slipped') return 'slipped back'
  return 'held steady'
}

export default function DigestPanel() {
  const [digest, setDigest] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    requestDigest(7)
      .then((data) => { if (!cancelled) setDigest(data) })
      .catch((problem) => { if (!cancelled) setError(problem.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  if (loading) return <section className="card"><p>Reading this week's sessions…</p></section>
  if (error) return <section className="card error">{error}</section>
  if (!digest) return null

  const { totals, needsCheckIn, dimensions, improvements, quiet, narrative,
          previousTheme, themeHistory = [] } = digest

  // The theme written this period is already in the history, so the list of
  // past themes excludes the most recent entry.
  const pastThemes = themeHistory.slice(0, -1).reverse()

  if (!totals.sessions) {
    return (
      <section className="card">
        <h2>Nothing to report yet</h2>
        <p className="hint">
          No sessions have been recorded in the last 7 days. Coach a session with
          a name filled in and it will show up here.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <h2>This week</h2>
        <p className="digest-summary">{narrative?.summary}</p>
        <p className="hint">
          {totals.sessions} session{totals.sessions === 1 ? '' : 's'} from{' '}
          {totals.tutors} tutor{totals.tutors === 1 ? '' : 's'}. Built from scores
          only — no transcripts are stored.
        </p>
      </section>

      <section className="card">
        <h2>Needs a check-in</h2>
        {needsCheckIn.length === 0 ? (
          <p>Nobody is flagged this week.</p>
        ) : (
          <ul className="checkin">
            {needsCheckIn.map((tutor) => (
              <li key={tutor.tutorId} className="checkin-row">
                <span className="checkin-name">{tutor.tutorId}</span>
                <ul className="checkin-reasons">
                  {tutor.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {quiet.length > 0 && (
          <p className="hint">Quiet this period: {quiet.join(', ')}.</p>
        )}
      </section>

      <section className="card">
        <h2>What's working</h2>
        <p>{narrative?.working}</p>
        {improvements.length > 0 && (
          <ul className="improvements">
            {improvements.map((item) => (
              <li key={`${item.tutorId}-${item.key}`}>
                <strong>{item.tutorId}</strong> — {item.label} {item.before}/5 → {item.now}/5
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Across the team</h2>
        <ul className="team-dims">
          {dimensions.map((dimension) => (
            <li key={dimension.key} className="team-dim">
              <span className="team-dim-label">{dimension.label}</span>
              <span className="team-dim-bar">
                <span
                  className="team-dim-fill"
                  style={{ width: `${((dimension.average || 0) / 5) * 100}%` }}
                />
              </span>
              <span className="team-dim-value">
                {dimension.average ?? '—'}
                <span className="team-dim-n"> n={dimension.sampleSize}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="hint">Weakest first. This is where the PD theme comes from.</p>
      </section>

      {previousTheme && (
        <section className={`card theme-outcome theme-${previousTheme.change}`}>
          <h2>Did the last theme land?</h2>
          <p className="theme-outcome-title">{previousTheme.title}</p>
          {previousTheme.change === 'not-scored' ? (
            <p>{previousTheme.label} has not been scored since, so there is nothing to compare.</p>
          ) : (
            <p>
              {previousTheme.label} went {previousTheme.before} → {previousTheme.now} across the team{' '}
              <span className="theme-verdict">{verdict(previousTheme.change)}</span>
            </p>
          )}
        </section>
      )}

      {narrative?.theme?.title && (
        <section className="card pd-theme">
          <h2>Suggested PD theme</h2>
          <h3 className="pd-title">{narrative.theme.title}</h3>
          <p>{narrative.theme.why}</p>
          {narrative.theme.activities.length > 0 && (
            <ul className="pd-activities">
              {narrative.theme.activities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          )}
          <p className="hint">
            Saved to this week's record, so you can see later whether it moved
            the number it came from.
          </p>
        </section>
      )}

      {pastThemes.length > 0 && (
        <section className="card">
          <h2>Past themes</h2>
          <ol className="theme-history">
            {pastThemes.map((theme) => (
              <li key={theme.periodKey} className="theme-row">
                <div className="theme-row-head">
                  <span className="theme-week">{theme.periodKey}</span>
                  <span className="theme-row-title">{theme.title}</span>
                </div>
                <p className="theme-row-meta">
                  From {theme.dimensionLabel || 'the weakest dimension'}
                  {theme.dimensionAverage !== null && <> at {theme.dimensionAverage}/5</>}
                  {' · '}{theme.sessions} session{theme.sessions === 1 ? '' : 's'} from {theme.tutors} tutor
                  {theme.tutors === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ol>
          <p className="hint">One entry per week. Reopening the digest refreshes that week rather than adding another.</p>
        </section>
      )}
    </>
  )
}
