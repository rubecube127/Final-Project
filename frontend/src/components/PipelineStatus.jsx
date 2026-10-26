import { PIPELINE_STAGES } from '../mockData.js'

// Four pills showing how far a transcript got through the pipeline.
//
// `completed` is the list of stage keys the server reports as finished, so
// these are not guesses: a safeguarding stop really does report only
// "Scrubbed". Progress is not streamed, so while a request is in flight the
// first unfinished stage is shown as active and the rest stay pending.
export default function PipelineStatus({ completed = [], busy = false }) {
  const done = new Set(completed)
  const firstUnfinished = PIPELINE_STAGES.findIndex((stage) => !done.has(stage.key))

  return (
    <ol className="pipeline" aria-label="Pipeline progress" aria-busy={busy}>
      {PIPELINE_STAGES.map((stage, index) => (
        <li key={stage.key} className={`pill ${stateFor(stage, index)}`}>
          {stage.label}
        </li>
      ))}
    </ol>
  )

  function stateFor(stage, index) {
    if (done.has(stage.key)) return 'done'
    if (busy && index === firstUnfinished) return 'active'
    return 'pending'
  }
}
