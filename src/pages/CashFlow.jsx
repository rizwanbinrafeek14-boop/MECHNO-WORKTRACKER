import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSAR, formatDate } from '../lib/format'
import { exportToCsv } from '../lib/csv'
import DateRangeFilter from '../components/DateRangeFilter'

const TYPES = [
  { value: 'inflow', label: 'Inflow (money in)' },
  { value: 'outflow', label: 'Outflow (money out)' },
  { value: 'expense', label: 'Daily Expense' },
  { value: 'credit_given', label: 'Credit Given (we are owed)' },
  { value: 'credit_taken', label: 'Credit Taken (we owe)' },
]

const emptyForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  type: 'inflow',
  category: '',
  amount: '',
  party_name: '',
  description: '',
}

export default function CashFlow() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cash_transactions')
      .select('*')
      .order('entry_date', { ascending: false })
    setTransactions(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('cash_transactions').insert({
      entry_date: form.entry_date,
      type: form.type,
      category: form.category || null,
      amount: Number(form.amount) || 0,
      party_name: form.party_name || null,
      description: form.description || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm)
    load()
  }

  async function toggleSettled(t) {
    await supabase.from('cash_transactions').update({ settled: !t.settled }).eq('id', t.id)
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('cash_transactions').delete().eq('id', id)
    load()
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({ ...t })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit() {
    const { error } = await supabase
      .from('cash_transactions')
      .update({
        entry_date: editForm.entry_date,
        type: editForm.type,
        category: editForm.category || null,
        amount: Number(editForm.amount) || 0,
        party_name: editForm.party_name || null,
        description: editForm.description || null,
      })
      .eq('id', editingId)
    if (error) {
      setError(error.message)
      return
    }
    cancelEdit()
    load()
  }

  const rangeFiltered = useMemo(() => {
    return transactions.filter((t) => {
      if (range.from && t.entry_date < range.from) return false
      if (range.to && t.entry_date > range.to) return false
      return true
    })
  }, [transactions, range])

  const totals = rangeFiltered.reduce(
    (acc, t) => {
      const amt = Number(t.amount) || 0
      if (t.type === 'inflow') acc.inflow += amt
      if (t.type === 'outflow') acc.outflow += amt
      if (t.type === 'expense') acc.expense += amt
      if (t.type === 'credit_given' && !t.settled) acc.creditOut += amt
      if (t.type === 'credit_taken' && !t.settled) acc.creditIn += amt
      return acc
    },
    { inflow: 0, outflow: 0, expense: 0, creditOut: 0, creditIn: 0 }
  )
  const balance = totals.inflow - totals.outflow - totals.expense

  const categoryTotals = useMemo(() => {
    const byCat = {}
    rangeFiltered.forEach((t) => {
      const cat = t.category || 'Uncategorized'
      byCat[cat] = (byCat[cat] || 0) + (Number(t.amount) || 0)
    })
    return Object.entries(byCat).sort(([, a], [, b]) => b - a)
  }, [rangeFiltered])

  const filtered = rangeFiltered.filter((t) => filter === 'all' || t.type === filter)

  return (
    <div>
      <div className="panel-header-row">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Cash Flow
        </h1>
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <div className="stat-grid">
        <StatCard label="Net Balance" value={formatSAR(balance)} />
        <StatCard label="Total Inflow" value={formatSAR(totals.inflow)} />
        <StatCard label="Total Outflow" value={formatSAR(totals.outflow)} />
        <StatCard label="Total Expenses" value={formatSAR(totals.expense)} />
        <StatCard label="Credit Owed to Us" value={formatSAR(totals.creditOut)} />
        <StatCard label="Credit We Owe" value={formatSAR(totals.creditIn)} />
      </div>

      <section className="panel">
        <h2>Totals by Category</h2>
        {categoryTotals.length === 0 ? (
          <p className="empty-note">No data for this range.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryTotals.map(([cat, amt]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{formatSAR(amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>New Entry</h2>
        <form className="inline-form grid-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Date
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              required
            />
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
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
            Party Name
            <input
              value={form.party_name}
              onChange={(e) => setForm({ ...form, party_name: e.target.value })}
              placeholder="Customer / Supplier / Person"
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Entry'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>Transactions</h2>
          <div className="row-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              className="btn-small"
              onClick={() =>
                exportToCsv('cash-transactions.csv', filtered, [
                  { label: 'Date', value: (t) => t.entry_date },
                  { label: 'Type', value: (t) => t.type },
                  { label: 'Category', value: (t) => t.category || '' },
                  { label: 'Party', value: (t) => t.party_name || '' },
                  { label: 'Amount', value: (t) => t.amount },
                  { label: 'Description', value: (t) => t.description || '' },
                  { label: 'Settled', value: (t) => (t.settled ? 'Yes' : 'No') },
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
          <p className="empty-note">No transactions.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Settled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="date"
                        value={editForm.entry_date}
                        onChange={(e) => setEditForm({ ...editForm, entry_date: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      >
                        {TYPES.map((ty) => (
                          <option key={ty.value} value={ty.value}>
                            {ty.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.party_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, party_name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </td>
                    <td>—</td>
                    <td className="actions-cell">
                      <button className="btn-small btn-success" onClick={saveEdit}>
                        Save
                      </button>
                      <button className="btn-small" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{formatDate(t.entry_date)}</td>
                    <td>
                      <span className={`badge badge-${t.type}`}>{t.type.replace('_', ' ')}</span>
                    </td>
                    <td>{t.category || '—'}</td>
                    <td>{t.party_name || '—'}</td>
                    <td>{formatSAR(t.amount)}</td>
                    <td>{t.description || '—'}</td>
                    <td>
                      {t.type.startsWith('credit_') ? (
                        <button className="btn-small" onClick={() => toggleSettled(t)}>
                          {t.settled ? 'Settled' : 'Mark Settled'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn-small" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(t.id)}>
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

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
