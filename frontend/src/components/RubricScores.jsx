import { RUBRIC } from '../mockData.js'

// The five rubric rows. Each shows a score out of five, a one-line comment,
// and the quote it rests on — or an honest note when no quote survived the
// evidence check.
export default function RubricScores({ scores }) {
  const verified = scores.filter((score) => score.verified).length
  const unsupported = scores.filter((score) => score.supported === false).length

  return (
    <section className="card" id="rubric">
      <h2>Rubric</h2>
      <ul className="rubric">
        {RUBRIC.map((dimension) => {
          const result = scores.find((score) => score.key === dimension.key)
          if (!result) return null

          return (
            <li key={dimension.key} className="rubric-row">
              <div className="rubric-head">
                <span className="rubric-label">{dimension.label}</span>
                <div className="rubric-marks">
                  {result.confidence && (
                    <span className={`confidence confidence-${result.confidence}`}>
                      {result.confidence}
                    </span>
                  )}
                  <ScoreDots score={result.score} />
                </div>
              </div>
              <p className="rubric-description">{dimension.description}</p>
              <p className="rubric-comment">{result.comment}</p>

              {result.verified && result.evidence ? (
                <>
                  <blockquote
                    className={`quote ${result.supported === false ? 'quote-weak' : ''}`}
                  >
                    {result.evidence}
                  </blockquote>
                  {result.supported === false && (
                    <p className="unsupported">
                      That line is really in your transcript, but it does not show
                      this{result.supportNote ? ` — ${result.supportNote}` : '.'}
                    </p>
                  )}
                </>
              ) : (
                <p className="unverified">No line from the transcript backed this up.</p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="hint">
        {verified} of {scores.length} quotes were checked word-for-word against
        your transcript{unsupported > 0 && `, and ${unsupported} of those did not back up its score`}.
      </p>
    </section>
  )
}

// Five chalk ticks, filled to the score.
function ScoreDots({ score }) {
  if (!score) return <span className="score-na">not scored</span>

  return (
    <span className="dots" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= score ? 'dot filled' : 'dot'} />
      ))}
    </span>
  )
}
