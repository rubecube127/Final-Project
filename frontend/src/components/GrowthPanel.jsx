// Where this tutor is going: whether last session's focus moved, what to work
// on next, and the shape of their scores so far.
export default function GrowthPanel({ growth }) {
  if (!growth) return null

  const { sessionNumber, previousFocus, nextFocus, history } = growth

  return (
    <section className="card growth">
      <h2>Your progress</h2>
      <p className="hint">
        Session {sessionNumber} for this name. Only scores are kept — never the
        transcript.
      </p>

      {previousFocus ? (
        <div className={`growth-row growth-${previousFocus.change}`}>
          <h3>Last time's focus: {previousFocus.label}</h3>
          {previousFocus.change === 'not-scored' ? (
            <p>It did not come up this session, so there is nothing to compare yet.</p>
          ) : (
            <p>
              {previousFocus.before}/5 → {previousFocus.now}/5{' '}
              <span className="growth-verdict">{verdict(previousFocus.change)}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="growth-row">
          <h3>First tracked session</h3>
          <p>There is nothing to compare against yet. Next time there will be.</p>
        </div>
      )}

      <div className="growth-row growth-next">
        <h3>Focus for next session</h3>
        {nextFocus ? (
          <p>
            <strong>{nextFocus.label}</strong> — your lowest this session at {nextFocus.score}/5.
          </p>
        ) : (
          <p>Nothing stood out as weak this session. Keep doing what you are doing.</p>
        )}
      </div>

      {history.length > 1 && <ScoreLine scores={history} />}
    </section>
  )
}

function verdict(change) {
  if (change === 'improved') return 'improved'
  if (change === 'slipped') return 'slipped back'
  return 'held steady'
}

// A plain line of every overall score so far, newest on the right.
function ScoreLine({ scores }) {
  const width = 100
  const height = 34
  const step = width / Math.max(scores.length - 1, 1)

  const points = scores
    .map((score, index) => `${index * step},${height - (score / 5) * height}`)
    .join(' ')

  return (
    <div className="growth-chart">
      <span className="growth-chart-label">Overall score, session by session</span>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
           aria-label={`Overall scores so far: ${scores.join(', ')}`}>
        <polyline points={points} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="growth-chart-latest">{scores[scores.length - 1].toFixed(1)} / 5</span>
    </div>
  )
}
