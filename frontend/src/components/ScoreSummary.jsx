import { RUBRIC } from '../mockData.js'

// A compact strip of every category score, placed directly under the
// transcript box so the result is visible without scrolling to the rubric.
//
// This is a summary, not a second rubric: no comments, no quotes. Clicking a
// category jumps to its full row, where the evidence is.
export default function ScoreSummary({ scores, overall }) {
  if (!scores?.length) return null

  function jumpToRubric(event) {
    event.preventDefault()
    document.getElementById('rubric')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="card score-summary">
      <div className="score-summary-head">
        <h2>Scores at a glance</h2>
        {overall && (
          <span className="score-summary-overall">
            <strong>{overall.score.toFixed(1)}</strong>
            <span className="score-summary-of"> / {overall.outOf}</span>
            <span className="score-summary-label">{overall.label}</span>
          </span>
        )}
      </div>

      <ul className="score-strip">
        {RUBRIC.map((dimension) => {
          const result = scores.find((score) => score.key === dimension.key)
          if (!result) return null

          return (
            <li key={dimension.key} className="score-chip">
              <a href="#rubric" onClick={jumpToRubric}>
                <span className="score-chip-label">{dimension.label}</span>
                <span className="score-chip-value">
                  {result.score ?? '—'}
                  <span className="score-chip-of">/5</span>
                </span>
                <span className="score-chip-dots" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= (result.score || 0) ? 'dot filled' : 'dot'} />
                  ))}
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <p className="hint">The full rubric, with the evidence behind each score, is below.</p>
    </section>
  )
}
