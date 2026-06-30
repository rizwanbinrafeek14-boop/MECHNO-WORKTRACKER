function toISO(date) {
  return date.toISOString().slice(0, 10)
}

function presetRange(preset) {
  const now = new Date()
  const today = toISO(now)

  if (preset === 'today') return { from: today, to: today }

  if (preset === 'week') {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + 1)
    return { from: toISO(monday), to: today }
  }

  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: toISO(first), to: today }
  }

  if (preset === 'year') {
    const first = new Date(now.getFullYear(), 0, 1)
    return { from: toISO(first), to: today }
  }

  return { from: '', to: '' }
}

export default function DateRangeFilter({ range, onChange }) {
  function applyPreset(preset) {
    onChange(presetRange(preset))
  }

  return (
    <div className="date-range-filter">
      <button type="button" className="btn-small" onClick={() => applyPreset('today')}>
        Today
      </button>
      <button type="button" className="btn-small" onClick={() => applyPreset('week')}>
        This Week
      </button>
      <button type="button" className="btn-small" onClick={() => applyPreset('month')}>
        This Month
      </button>
      <button type="button" className="btn-small" onClick={() => applyPreset('year')}>
        This Year
      </button>
      <input
        type="date"
        value={range.from}
        onChange={(e) => onChange({ ...range, from: e.target.value })}
      />
      <span className="muted">to</span>
      <input
        type="date"
        value={range.to}
        onChange={(e) => onChange({ ...range, to: e.target.value })}
      />
      {(range.from || range.to) && (
        <button type="button" className="btn-small" onClick={() => onChange({ from: '', to: '' })}>
          Clear
        </button>
      )}
    </div>
  )
}
