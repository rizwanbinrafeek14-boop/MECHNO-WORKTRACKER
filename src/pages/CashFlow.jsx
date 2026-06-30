import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatSAR, formatDate } from '../lib/format'

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

  const totals = transactions.reduce(
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

  const filtered = transactions.filter((t) => filter === 'all' || t.type === filter)

  return (
    <div>
      <h1 className="page-title">Cash Flow</h1>

      <div className="stat-grid">
        <StatCard label="Net Balance" value={formatSAR(balance)} />
        <StatCard label="Total Inflow" value={formatSAR(totals.inflow)} />
        <StatCard label="Total Outflow" value={formatSAR(totals.outflow)} />
        <StatCard label="Total Expenses" value={formatSAR(totals.expense)} />
        <StatCard label="Credit Owed to Us" value={formatSAR(totals.creditOut)} />
        <StatCard label="Credit We Owe" value={formatSAR(totals.creditIn)} />
      </div>

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
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
              {filtered.map((t) => (
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
                  <td>
                    <button className="btn-small btn-danger" onClick={() => handleDelete(t.id)}>
                      Delete
                    </button>
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

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
