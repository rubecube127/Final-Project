// A short row of numbers about the run: what was removed, how much of the
// feedback is backed by a real quote, and what the model call cost.
export default function StatCards({ stats }) {
  const cards = [
    {
      label: 'Details removed',
      value: stats.redactions,
      note: 'names, emails, phone numbers'
    },
    {
      label: 'Evidence verified',
      value: stats.evidenceTotal
        ? `${stats.evidenceVerified}/${stats.evidenceTotal}`
        : '—',
      note: 'quotes found in your transcript'
    },
    {
      label: 'Tokens used',
      value: stats.totalTokens.toLocaleString(),
      note: 'across the whole run'
    },
    {
      label: 'Cost',
      value: `$${stats.costUsd.toFixed(4)}`,
      note: 'gpt-6-luna'
    }
  ]

  return (
    <section className="stat-grid">
      {cards.map((card) => (
        <div key={card.label} className="stat">
          <span className="stat-value">{card.value}</span>
          <span className="stat-label">{card.label}</span>
          <span className="stat-note">{card.note}</span>
        </div>
      ))}
    </section>
  )
}
