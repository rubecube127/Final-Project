// The box the tutor types or pastes a session into.
//
// It is also reused to show the text pulled out of an uploaded PDF, so the
// tutor can correct it before sending — hence the overridable label and the
// optional example button.
export default function TranscriptInput({
  value,
  onChange,
  onSubmit,
  onLoadExample,
  busy,
  label = 'Session transcript',
  submitLabel = 'Get feedback'
}) {
  function handleSubmit(event) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <label className="label" htmlFor="transcript">{label}</label>
      <textarea
        id="transcript"
        className="textarea"
        rows={12}
        placeholder={'Tutor: What do you think the first step is?\nStudent: ...'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="hint">
        Names, emails, phone numbers and addresses are removed before anything
        is sent to the model.
      </p>
      <div className="actions">
        <button className="button primary" type="submit" disabled={busy || !value.trim()}>
          {busy ? 'Reading the session…' : submitLabel}
        </button>
        {onLoadExample && (
          <button className="button ghost" type="button" onClick={onLoadExample} disabled={busy}>
            Load example
          </button>
        )}
      </div>
    </form>
  )
}
