import { RUBRIC } from '../mockData.js'

// The right-hand rail: a standing record of what this account has run through
// the coach. Visible all the time, not only after a session, so the space is
// doing something on an empty screen too.
//
// Scores only — transcripts are never stored, so there is nothing else here.
export default function SideRail({ growth, loading }) {
  const sessions = growth?.history || []
  const latest = sessions[sessions.length - 1] || null
  const recent = sessions.slice(-5).reverse()

  return (
    <aside className="rail" aria-label="Your record">
      <h2 className="rail-title">Your record</h2>

      <div className="rail-count">
        <span className="rail-number">{loading ? '–' : sessions.length}</span>
        <span className="rail-count-label">
          transcript{sessions.length === 1 ? '' : 's'} coached
        </span>
      </div>

      {latest && (
        <div className="rail-block">
          <span className="rail-label">Latest overall</span>
          <span className="rail-value">
            {latest.overall?.score ?? '—'}
            <span className="rail-of"> / 5</span>
          </span>
          {latest.overall?.label && <span className="rail-sub">{latest.overall.label}</span>}
        </div>
      )}

      {latest?.focusKey && (
        <div className="rail-block rail-focus">
          <span className="rail-label">Working on</span>
          <span className="rail-focus-name">{labelFor(latest.focusKey)}</span>
        </div>
      )}

      {recent.length > 0 && (
        <div className="rail-block">
          <span className="rail-label">Recent sessions</span>
          <ol className="rail-list">
            {recent.map((session, index) => (
              <li key={session.at} className="rail-item">
                <span className="rail-item-n">{sessions.length - index}</span>
                <span className="rail-item-date">
                  {new Date(session.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="rail-item-score">{session.overall?.score ?? '—'}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <p className="rail-empty">
          Nothing yet. Coach a session and it will start building here.
        </p>
      )}

      <p className="rail-note">Scores only — your transcripts are never stored.</p>

      {/* The parabola from the board decoration, rehoused now that the rail
          occupies the space it used to sit in. */}
      <svg className="rail-parabola" viewBox="0 0 220 110" aria-hidden="true">
        <line className="parabola-axis" x1="6" y1="94" x2="214" y2="94" strokeWidth="3" strokeLinecap="round" />
        <path className="parabola-curve" d="M18 94 Q 110 -24, 202 94" fill="none" strokeWidth="4" strokeLinecap="round" />
        <circle className="parabola-root" cx="18" cy="94" r="7" />
        <circle className="parabola-root" cx="202" cy="94" r="7" />
      </svg>
    </aside>
  )
}

function labelFor(key) {
  return RUBRIC.find((dimension) => dimension.key === key)?.label || key
}
