import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate, daysSince } from '../lib/format'
import { exportToCsv } from '../lib/csv'

const emptyForm = {
  employee_id: '',
  quotation_number: '',
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
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [followupHistory, setFollowupHistory] = useState([])

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    if (isAdmin) loadEmployees()
  }, [isAdmin])

  async function loadEmployees() {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
    setEmployees(data ?? [])
  }

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
      employee_id: (isAdmin && form.employee_id) || profile.id,
      quotation_number: form.quotation_number || null,
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
    if (expandedId === q.id) loadFollowupHistory(q.id)
    load()
  }

  async function convertToPO(q) {
    if (!window.confirm(`Create a Purchase Order from this quotation for ${q.customer_name}?`)) return
    const { error } = await supabase.from('purchase_orders').insert({
      employee_id: q.employee_id,
      quotation_id: q.id,
      po_number: q.quotation_number || null,
      customer_name: q.customer_name,
      item_description: q.item_description,
      amount: q.amount,
      date_received: new Date().toISOString().slice(0, 10),
    })
    if (error) {
      setError(error.message)
      return
    }
    await supabase.from('quotations').update({ converted_to_po: true }).eq('id', q.id)
    load()
  }

  async function loadFollowupHistory(quotationId) {
    const { data } = await supabase
      .from('quotation_followups')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('followup_date', { ascending: false })
    setFollowupHistory(data ?? [])
  }

  async function toggleHistory(q) {
    if (expandedId === q.id) {
      setExpandedId(null)
      setFollowupHistory([])
      return
    }
    setExpandedId(q.id)
    await loadFollowupHistory(q.id)
  }

  function startEdit(q) {
    setEditingId(q.id)
    setEditForm({
      employee_id: q.employee_id,
      quotation_number: q.quotation_number || '',
      customer_name: q.customer_name,
      customer_contact: q.customer_contact || '',
      item_description: q.item_description,
      amount: q.amount,
      next_follow_up_date: q.next_follow_up_date || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('quotations')
      .update({
        employee_id: editForm.employee_id,
        quotation_number: editForm.quotation_number || null,
        customer_name: editForm.customer_name,
        customer_contact: editForm.customer_contact || null,
        item_description: editForm.item_description,
        amount: Number(editForm.amount) || 0,
        next_follow_up_date: editForm.next_follow_up_date || null,
      })
      .eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    cancelEdit()
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this quotation?')) return
    await supabase.from('quotations').delete().eq('id', id)
    load()
  }

  const filtered = quotations.filter((q) => filter === 'all' || q.status === filter)
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <h1 className="page-title">Quotations</h1>

      <section className="panel">
        <h2>New Quotation</h2>
        <form className="inline-form grid-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          {isAdmin && (
            <label>
              Employee
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              >
                <option value="">Myself ({profile?.full_name})</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Quotation No.
            <input
              value={form.quotation_number}
              onChange={(e) => setForm({ ...form, quotation_number: e.target.value })}
            />
          </label>
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
          <div className="row-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="btn-small"
              onClick={() =>
                exportToCsv('quotations.csv', filtered, [
                  { label: 'Quotation No.', value: (q) => q.quotation_number || '' },
                  { label: 'Customer', value: (q) => q.customer_name },
                  { label: 'Contact', value: (q) => q.customer_contact || '' },
                  { label: 'Employee', value: (q) => q.profiles?.full_name || '' },
                  { label: 'Item', value: (q) => q.item_description },
                  { label: 'Amount', value: (q) => q.amount },
                  { label: 'Date Sent', value: (q) => q.date_sent },
                  { label: 'Status', value: (q) => q.status },
                  { label: 'Rejection Reason', value: (q) => q.rejection_reason || '' },
                ])
              }
            >
              Export CSV
            </button>
          </div>
        </div>
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">No quotations.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
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
              {filtered.map((q) =>
                editingId === q.id ? (
                  <tr key={q.id}>
                    <td>
                      <input
                        placeholder="Quotation No."
                        value={editForm.quotation_number}
                        onChange={(e) => setEditForm({ ...editForm, quotation_number: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                      />
                      <input
                        placeholder="Contact"
                        value={editForm.customer_contact}
                        onChange={(e) => setEditForm({ ...editForm, customer_contact: e.target.value })}
                      />
                    </td>
                    {isAdmin && (
                      <td>
                        <select
                          value={editForm.employee_id}
                          onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                        >
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td>
                      <input
                        value={editForm.item_description}
                        onChange={(e) => setEditForm({ ...editForm, item_description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      />
                    </td>
                    <td>{formatDate(q.date_sent)}</td>
                    <td>
                      <span className={`badge badge-${q.status}`}>{q.status}</span>
                    </td>
                    <td>
                      Next follow-up:
                      <input
                        type="date"
                        value={editForm.next_follow_up_date}
                        onChange={(e) =>
                          setEditForm({ ...editForm, next_follow_up_date: e.target.value })
                        }
                      />
                    </td>
                    <td>{q.rejection_reason || '—'}</td>
                    <td className="actions-cell">
                      <button className="btn-small btn-success" onClick={() => saveEdit(q.id)}>
                        Save
                      </button>
                      <button className="btn-small" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr
                      key={q.id}
                      className={
                        q.status === 'pending' && q.next_follow_up_date === todayStr
                          ? 'row-due-today'
                          : q.status === 'pending' && daysSince(q.date_sent) >= 3
                          ? 'row-alert'
                          : ''
                      }
                    >
                      <td>{q.quotation_number || '—'}</td>
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
                        {q.converted_to_po && (
                          <div className="muted" style={{ marginTop: 4 }}>
                            → PO created
                          </div>
                        )}
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
                        {q.status === 'accepted' && !q.converted_to_po && (
                          <button className="btn-small btn-success" onClick={() => convertToPO(q)}>
                            Convert to PO
                          </button>
                        )}
                        <button className="btn-small" onClick={() => toggleHistory(q)}>
                          {expandedId === q.id ? 'Hide History' : 'History'}
                        </button>
                        <button className="btn-small" onClick={() => startEdit(q)}>
                          Edit
                        </button>
                        {isAdmin && (
                          <button className="btn-small btn-danger" onClick={() => handleDelete(q.id)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === q.id && (
                      <tr key={`${q.id}-history`}>
                        <td colSpan={isAdmin ? 10 : 9}>
                          <div className="panel" style={{ margin: 0 }}>
                            <h2>Follow-up History — {q.customer_name}</h2>
                            {followupHistory.length === 0 ? (
                              <p className="empty-note">No follow-ups logged yet.</p>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {followupHistory.map((f) => (
                                    <tr key={f.id}>
                                      <td>{formatDate(f.followup_date)}</td>
                                      <td>{f.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
