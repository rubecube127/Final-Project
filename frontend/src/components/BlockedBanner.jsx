// Shown instead of any feedback when the safeguarding stage stops the run.
//
// Drawn in solid chalk rather than the dashed outline every other card uses,
// so it reads as different in kind rather than just another section.
export default function BlockedBanner({ blockedReason }) {
  return (
    <section className="card blocked">
      <h2>Feedback paused — please read</h2>
      <p>{blockedReason.guidance}</p>

      {blockedReason.quote && (
        <>
          <p className="blocked-label">What the student said</p>
          <blockquote className="quote">{blockedReason.quote}</blockquote>
        </>
      )}

      {blockedReason.reason && <p className="blocked-why">{blockedReason.reason}</p>}
    </section>
  )
}
