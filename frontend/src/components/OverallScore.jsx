// The formal teaching score for the session: the mean of the rubric rows,
// with the confidence the report as a whole deserves.
export default function OverallScore({ overall }) {
  if (!overall) return null

  return (
    <section className="card overall">
      <div className="overall-figure">
        <span className="overall-score">{overall.score.toFixed(1)}</span>
        <span className="overall-of">/ {overall.outOf}</span>
      </div>

      <div className="overall-body">
        <h2>{overall.label}</h2>
        <p className="overall-note">
          Averaged across {overall.counted} of {overall.total} rubric dimensions.
        </p>
        <p className={`confidence confidence-${overall.confidence}`}>
          {overall.confidence} confidence
        </p>
      </div>
    </section>
  )
}
