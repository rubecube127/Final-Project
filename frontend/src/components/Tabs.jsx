// The two ways into the app: upload a PDF, or type the session out.
//
// Presentational only — App owns which tab is active.
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="How to add a transcript">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          type="button"
          id={`tab-${tab.key}`}
          aria-selected={tab.key === active}
          aria-controls={`panel-${tab.key}`}
          className={`tab ${tab.key === active ? 'on' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
