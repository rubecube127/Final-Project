// The feedback sandwich: two or three things that worked, the one thing to
// work on, and something concrete to try next session.
//
// The number of strengths is not fixed — the Coach is told to write three only
// when three dimensions have a verified quote behind them. Fewer means the
// session genuinely did not show more, which is more useful to a tutor than
// padding.
export default function CoachingNote({ coaching }) {
  const strengths = coaching?.strengths || []

  return (
    <section className="card">
      <h2>Your coaching note</h2>

      <div className="note strength">
        <h3>What worked</h3>
        {strengths.length === 0 ? (
          <p>No strength could be backed by a verified quote from this session.</p>
        ) : strengths.length === 1 ? (
          <p>{strengths[0]}</p>
        ) : (
          <ol className="strength-list">
            {strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="note focus">
        <h3>One thing to try next</h3>
        <p>{coaching?.focus}</p>
      </div>

      <div className="note phrase">
        <h3>A phrase to try</h3>
        <p className="phrase-text">“{coaching?.phraseToTry}”</p>
      </div>
    </section>
  )
}
