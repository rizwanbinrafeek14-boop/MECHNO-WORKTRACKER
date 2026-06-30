import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate, daysSince } from '../lib/format'

const emptyForm = {
  customer_name: '',
  customer_contact: '',
  item_description: '',
  amount: '',
  date_sent: new Date().toISOString().slice(0, 10),
  next_follow_up_date: '',
}

export default function Quotations() {
  const { profile, isAdmin } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('quotations')
      .select('*, profiles(full_name)')
      .order('date_sent', { ascending: false })
    if (!isAdmin) query = query.eq('employee_id', profile.id)
    const { data } = await query
    setQuotations(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('quotations').insert({
      employee_id: profile.id,
      customer_name: form.customer_name,
      customer_contact: form.customer_contact || null,
      item_description: form.item_description,
      amount: Number(form.amount) || 0,
      date_sent: form.date_sent,
      next_follow_up_date: form.next_follow_up_date || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm)
    load()
  }

  async function updateStatus(q, status) {
    let rejection_reason = q.rejection_reason
    if (status === 'rejected') {
      rejection_reason = window.prompt('Reason the quotation was not accepted:', q.rejection_reason || '')
      if (rejection_reason === null) return
    }
    await supabase.from('quotations').update({ status, rejection_reason }).eq('id', q.id)
    load()
  }

  async function logFollowUp(q) {
    const notes = window.prompt('Follow-up notes (what was discussed):')
    if (notes === null) return
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('quotation_followups').insert({
      quotation_id: q.id,
      employee_id: q.employee_id,
      followup_date: today,
      notes,
    })
    await supabase.from('quotations').update({ last_followed_up_at: today }).eq('id', q.id)
    load()
  }

  const filtered = quotations.filter((q) => filter === 'all' || q.status === filter)

  return (
    <div>
      <h1 className="page-title">Quotations</h1>

      <section className="panel">
        <h2>New Quotation</h2>
        <form className="inline-form grid-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Customer Name
            <input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              required
            />
          </label>
          <label>
            Customer Contact
            <input
              value={form.customer_contact}
              onChange={(e) => setForm({ ...form, customer_contact: e.target.value })}
            />
          </label>
          <label>
            Item / Service Quoted
            <input
              value={form.item_description}
              onChange={(e) => setForm({ ...form, item_description: e.target.value })}
              required
            />
          </label>
          <label>
            Amount (SAR)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </label>
          <label>
            Date Sent
            <input
              type="date"
              value={form.date_sent}
              onChange={(e) => setForm({ ...form, date_sent: e.target.value })}
              required
            />
          </label>
          <label>
            Next Follow-up Date
            <input
              type="date"
              value={form.next_follow_up_date}
              onChange={(e) => setForm({ ...form, next_follow_up_date: e.target.value })}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Quotation'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>All Quotations</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">No quotations.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                {isAdmin && <th>Employee</th>}
                <th>Item</th>
                <th>Amount</th>
                <th>Sent</th>
                <th>Status</th>
                <th>Days Pending</th>
                <th>Reason (if rejected)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  className={
                    q.status === 'pending' && daysSince(q.date_sent) >= 3 ? 'row-alert' : ''
                  }
                >
                  <td>
                    {q.customer_name}
                    {q.customer_contact && <div className="muted">{q.customer_contact}</div>}
                  </td>
                  {isAdmin && <td>{q.profiles?.full_name}</td>}
                  <td>{q.item_description}</td>
                  <td>{formatSAR(q.amount)}</td>
                  <td>{formatDate(q.date_sent)}</td>
                  <td>
                    <span className={`badge badge-${q.status}`}>{q.status}</span>
                  </td>
                  <td>{q.status === 'pending' ? `${daysSince(q.date_sent)}d` : '—'}</td>
                  <td>{q.rejection_reason || '—'}</td>
                  <td className="actions-cell">
                    {q.status === 'pending' && (
                      <>
                        <button className="btn-small" onClick={() => logFollowUp(q)}>
                          Log Follow-up
                        </button>
                        <button
                          className="btn-small btn-success"
                          onClick={() => updateStatus(q, 'accepted')}
                        >
                          Accepted
                        </button>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => updateStatus(q, 'rejected')}
                        >
                          Rejected
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
