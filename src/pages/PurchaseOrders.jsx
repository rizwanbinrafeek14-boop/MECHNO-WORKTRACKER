import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate } from '../lib/format'
import { exportToCsv } from '../lib/csv'

const STATUSES = [
  { value: 'received', label: 'PO Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'PO Completed' },
]

const emptyForm = {
  po_number: '',
  customer_name: '',
  item_description: '',
  amount: '',
  date_received: new Date().toISOString().slice(0, 10),
  notes: '',
}

export default function PurchaseOrders() {
  const { profile, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('purchase_orders')
      .select('*, profiles(full_name)')
      .order('date_received', { ascending: false })
    if (!isAdmin) query = query.eq('employee_id', profile.id)
    const { data } = await query
    setOrders(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('purchase_orders').insert({
      employee_id: profile.id,
      po_number: form.po_number || null,
      customer_name: form.customer_name,
      item_description: form.item_description,
      amount: Number(form.amount) || 0,
      date_received: form.date_received,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm)
    load()
  }

  async function updateStatus(po, status) {
    const patch = { status }
    if (status === 'completed') patch.completed_date = new Date().toISOString().slice(0, 10)
    if (status !== 'completed') patch.completed_date = null
    await supabase.from('purchase_orders').update(patch).eq('id', po.id)
    load()
  }

  function startEdit(po) {
    setEditingId(po.id)
    setEditForm({
      po_number: po.po_number || '',
      customer_name: po.customer_name,
      item_description: po.item_description,
      amount: po.amount,
      notes: po.notes || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        po_number: editForm.po_number || null,
        customer_name: editForm.customer_name,
        item_description: editForm.item_description,
        amount: Number(editForm.amount) || 0,
        notes: editForm.notes || null,
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
    if (!window.confirm('Delete this purchase order?')) return
    await supabase.from('purchase_orders').delete().eq('id', id)
    load()
  }

  const filtered = orders.filter((po) => filter === 'all' || po.status === filter)

  return (
    <div>
      <h1 className="page-title">Purchase Orders</h1>

      <section className="panel">
        <h2>New Purchase Order</h2>
        <form className="inline-form grid-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            PO Number
            <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
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
            Item / Service
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
            Date Received
            <input
              type="date"
              value={form.date_received}
              onChange={(e) => setForm({ ...form, date_received: e.target.value })}
              required
            />
          </label>
          <label>
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add PO'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>Purchase Orders</h2>
          <div className="row-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              className="btn-small"
              onClick={() =>
                exportToCsv('purchase-orders.csv', filtered, [
                  { label: 'PO Number', value: (po) => po.po_number || '' },
                  { label: 'Customer', value: (po) => po.customer_name },
                  { label: 'Employee', value: (po) => po.profiles?.full_name || '' },
                  { label: 'Item', value: (po) => po.item_description },
                  { label: 'Amount', value: (po) => po.amount },
                  { label: 'Date Received', value: (po) => po.date_received },
                  { label: 'Status', value: (po) => po.status },
                  { label: 'Completed Date', value: (po) => po.completed_date || '' },
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
          <p className="empty-note">No purchase orders.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Customer</th>
                {isAdmin && <th>Employee</th>}
                <th>Item</th>
                <th>Amount</th>
                <th>Received</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) =>
                editingId === po.id ? (
                  <tr key={po.id}>
                    <td>
                      <input
                        value={editForm.po_number}
                        onChange={(e) => setEditForm({ ...editForm, po_number: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                      />
                    </td>
                    {isAdmin && <td>{po.profiles?.full_name}</td>}
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
                    <td>{formatDate(po.date_received)}</td>
                    <td>
                      <span className={`badge badge-po-${po.status}`}>
                        {STATUSES.find((s) => s.value === po.status)?.label}
                      </span>
                    </td>
                    <td>{po.completed_date ? formatDate(po.completed_date) : '—'}</td>
                    <td className="actions-cell">
                      <button className="btn-small btn-success" onClick={() => saveEdit(po.id)}>
                        Save
                      </button>
                      <button className="btn-small" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={po.id}>
                    <td>
                      {po.po_number || '—'}
                      {po.quotation_id && <div className="muted">From quotation</div>}
                    </td>
                    <td>
                      {po.customer_name}
                      {po.notes && <div className="muted">{po.notes}</div>}
                    </td>
                    {isAdmin && <td>{po.profiles?.full_name}</td>}
                    <td>{po.item_description}</td>
                    <td>{formatSAR(po.amount)}</td>
                    <td>{formatDate(po.date_received)}</td>
                    <td>
                      <span className={`badge badge-po-${po.status}`}>
                        {STATUSES.find((s) => s.value === po.status)?.label}
                      </span>
                    </td>
                    <td>{po.completed_date ? formatDate(po.completed_date) : '—'}</td>
                    <td className="actions-cell">
                      {po.status === 'received' && (
                        <button className="btn-small" onClick={() => updateStatus(po, 'in_progress')}>
                          Start
                        </button>
                      )}
                      {po.status !== 'completed' && (
                        <button
                          className="btn-small btn-success"
                          onClick={() => updateStatus(po, 'completed')}
                        >
                          Mark Completed
                        </button>
                      )}
                      {po.status === 'completed' && (
                        <button className="btn-small" onClick={() => updateStatus(po, 'received')}>
                          Reopen
                        </button>
                      )}
                      <button className="btn-small" onClick={() => startEdit(po)}>
                        Edit
                      </button>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(po.id)}>
                        Delete
                      </button>
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
