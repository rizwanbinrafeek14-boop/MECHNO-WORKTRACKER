import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/format'
import { exportToCsv } from '../lib/csv'

export default function DailyReports() {
  const { profile, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ summary: '', quotations_made: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [feedbackId, setFeedbackId] = useState(null)
  const [feedbackText, setFeedbackText] = useState('')

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

  function startEdit(r) {
    setEditingId(r.id)
    setEditForm({ summary: r.summary, quotations_made: r.quotations_made })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit(id) {
    await supabase
      .from('daily_reports')
      .update({ summary: editForm.summary, quotations_made: Number(editForm.quotations_made) || 0 })
      .eq('id', id)
    cancelEdit()
    load()
  }

  async function saveFeedback(id) {
    await supabase.from('daily_reports').update({ admin_feedback: feedbackText }).eq('id', id)
    setFeedbackId(null)
    setFeedbackText('')
    load()
  }

  const employeeOptions = isAdmin
    ? [...new Map(reports.map((r) => [r.employee_id, r.profiles?.full_name || 'Unknown'])).entries()]
    : []

  const visibleReports = reports.filter(
    (r) => employeeFilter === 'all' || r.employee_id === employeeFilter
  )

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
        <div className="panel-header-row">
          <h2>History</h2>
          <div className="row-actions">
            {isAdmin && (
              <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                <option value="all">All Employees</option>
                {employeeOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn-small"
              onClick={() =>
                exportToCsv('daily-reports.csv', visibleReports, [
                  { label: 'Date', value: (r) => r.report_date },
                  { label: 'Employee', value: (r) => r.profiles?.full_name || '' },
                  { label: 'Quotations Made', value: (r) => r.quotations_made },
                  { label: 'Summary', value: (r) => r.summary },
                  { label: 'Admin Feedback', value: (r) => r.admin_feedback || '' },
                ])
              }
            >
              Export CSV
            </button>
          </div>
        </div>
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : visibleReports.length === 0 ? (
          <p className="empty-note">No reports yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {isAdmin && <th>Employee</th>}
                <th>Quotations Made</th>
                <th>Summary</th>
                <th>Admin Feedback</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id}>
                    <td>{formatDate(r.report_date)}</td>
                    {isAdmin && <td>{r.profiles?.full_name}</td>}
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={editForm.quotations_made}
                        onChange={(e) =>
                          setEditForm({ ...editForm, quotations_made: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={editForm.summary}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                      />
                    </td>
                    <td>{r.admin_feedback || '—'}</td>
                    <td className="actions-cell">
                      <button className="btn-small btn-success" onClick={() => saveEdit(r.id)}>
                        Save
                      </button>
                      <button className="btn-small" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{formatDate(r.report_date)}</td>
                    {isAdmin && <td>{r.profiles?.full_name}</td>}
                    <td>{r.quotations_made}</td>
                    <td>{r.summary}</td>
                    <td>
                      {feedbackId === r.id ? (
                        <div className="row-actions">
                          <input
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Feedback…"
                          />
                          <button className="btn-small btn-success" onClick={() => saveFeedback(r.id)}>
                            Save
                          </button>
                          <button className="btn-small" onClick={() => setFeedbackId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        r.admin_feedback || '—'
                      )}
                    </td>
                    <td className="actions-cell">
                      {!isAdmin && (
                        <button className="btn-small" onClick={() => startEdit(r)}>
                          Edit
                        </button>
                      )}
                      {isAdmin && feedbackId !== r.id && (
                        <button
                          className="btn-small"
                          onClick={() => {
                            setFeedbackId(r.id)
                            setFeedbackText(r.admin_feedback || '')
                          }}
                        >
                          {r.admin_feedback ? 'Edit Feedback' : 'Add Feedback'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
