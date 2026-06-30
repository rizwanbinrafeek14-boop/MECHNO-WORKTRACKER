import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/format'

export default function DailyReports() {
  const { profile, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ summary: '', quotations_made: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('daily_reports')
      .select('*, profiles(full_name)')
      .order('report_date', { ascending: false })
    if (!isAdmin) query = query.eq('employee_id', profile.id)
    const { data } = await query
    setReports(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('daily_reports').upsert(
      {
        employee_id: profile.id,
        report_date: today,
        summary: form.summary,
        quotations_made: Number(form.quotations_made) || 0,
      },
      { onConflict: 'employee_id,report_date' }
    )
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ summary: '', quotations_made: 0 })
    load()
  }

  return (
    <div>
      <h1 className="page-title">Daily Work Reports</h1>

      {!isAdmin && (
        <section className="panel">
          <h2>Today's Report</h2>
          <form className="inline-form" onSubmit={handleSubmit}>
            {error && <div className="error-banner">{error}</div>}
            <label>
              Summary of work done
              <textarea
                rows={3}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                required
              />
            </label>
            <label>
              Quotations made today
              <input
                type="number"
                min="0"
                value={form.quotations_made}
                onChange={(e) => setForm({ ...form, quotations_made: e.target.value })}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Submit / Update Today\'s Report'}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2>History</h2>
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="empty-note">No reports yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {isAdmin && <th>Employee</th>}
                <th>Quotations Made</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.report_date)}</td>
                  {isAdmin && <td>{r.profiles?.full_name}</td>}
                  <td>{r.quotations_made}</td>
                  <td>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
