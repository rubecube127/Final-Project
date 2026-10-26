// The scrubbed transcript, shown back to the tutor as a dialogue.
//
// Redaction placeholders like [NAME] are highlighted so it is obvious what the
// model actually saw. A turn may carry tags, which are drawn as small chalk
// labels beside the speaker.
export default function TranscriptCard({ turns }) {
  return (
    <section className="card">
      {/* Closed by default: it is the longest block on the page and it is
          reference, not feedback. Open it to check a quote in context. */}
      <details className="transcript-details">
        <summary>
          <span className="transcript-summary-title">What the model read</span>
          <span className="transcript-count">{turns.length} turns</span>
        </summary>

        <p className="hint">
          This is the scrubbed copy. Highlighted placeholders are where personal
          details were removed.
        </p>
        <ol className="turns">
        {turns.map((turn) => (
          <li key={turn.id} className={`turn ${turn.speaker.toLowerCase()}`}>
            <div className="turn-head">
              <span className="turn-speaker">{turn.speaker}</span>
              {(turn.tags || []).map((tag) => (
                <span key={tag} className={`turn-tag ${tagClass(tag)}`}>{tag}</span>
              ))}
            </div>
            <p className="turn-text">{highlightRedactions(turn.text)}</p>
          </li>
        ))}
        </ol>
      </details>
    </section>
  )
}

// A safeguarding tag needs to read differently from a praise tag.
function tagClass(tag) {
  return tag.toLowerCase() === 'safeguarding' ? 'alarm' : 'good'
}

// Wrap every [PLACEHOLDER] in a span so it stands out from the tutor's words.
function highlightRedactions(text) {
  return text.split(/(\[[A-Z_]+\])/g).map((piece, index) =>
    /^\[[A-Z_]+\]$/.test(piece)
      ? <span key={index} className="redaction">{piece}</span>
      : piece
  )
}
