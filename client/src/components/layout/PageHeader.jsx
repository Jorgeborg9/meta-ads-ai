import React from 'react'

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Winner', value: 'winner' },
  { label: 'Average', value: 'average' },
  { label: 'Poor', value: 'poor' },
]

const PageHeader = ({ performanceFilter, setPerformanceFilter }) => {
  return (
    <div className="page-header">
      <div className="page-title-row">
        <div className="page-title-wrap">
          <h2 className="page-title">Performance Dashboard</h2>
        </div>
        <div className="chip-group">
          {FILTERS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`chip ${performanceFilter === chip.value ? 'active' : ''}`}
              onClick={() => setPerformanceFilter(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
