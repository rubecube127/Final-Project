// Maths worth a second look.
//
// Kept well away from the coaching note and the rubric on purpose: this is a
// flag, not a score. Nothing here moved the tutor's number, and the card says
// so, because a volunteer should not read "we found a mistake" as "you were
// marked down".
export default function MathFlags({ maths }) {
  if (!maths) return null

  const { flags, checked } = maths

  // The check could not run. Say so quietly rather than showing nothing, which
  // would read as "we looked and the maths was fine".
  if (maths.failed) {
    return (
      <section className="card maths maths-clear">
        <h2>Maths check</h2>
        <p className="hint">
          The maths check could not run for this session. Nothing about the
          mathematics has been checked either way.
        </p>
      </section>
    )
  }

  // Nothing checkable in the session: say nothing at all rather than claiming
  // a clean bill of health the checker cannot give.
  if (!checked) return null

  if (!flags.length) {
    return (
      <section className="card maths maths-clear">
        <h2>Maths check</h2>
        <p>
          {checked === 1 ? '1 statement checked' : `${checked} statements checked`}, nothing to flag.
        </p>
        <p className="hint">
          Only statements that can be written as an equation are checked, so this
          is not a guarantee the whole session was correct.
        </p>
      </section>
    )
  }

  return (
    <section className="card maths">
      <h2>Worth checking</h2>
      <p className="hint">
        {checked === 1
          ? '1 statement was checked by calculation.'
          : `${checked} statements were checked by calculation.`}{' '}
        These did not affect any score — have a look and decide for yourself.
      </p>

      <ul className="maths-list">
        {/* One line can carry more than one claim, so the quote alone is not
            a unique key. */}
        {flags.map((flag, index) => (
          <li key={`${index}-${flag.quote}`} className={`maths-flag maths-${flag.verdict}`}>
            <span className="maths-verdict">
              {flag.verdict === 'incomplete' ? 'Incomplete' : 'Looks wrong'}
            </span>
            <blockquote className="quote">{flag.quote}</blockquote>
            <p className="maths-detail">{flag.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
