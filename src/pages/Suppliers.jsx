import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyForm = { name: '', sells: '', contact_phone: '', contact_email: '', location: '', notes: '' }

export default function Suppliers() {
  const { isAdmin } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('suppliers').insert(form)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm(emptyForm)
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this supplier?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    load()
  }

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.sells.toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <h1 className="page-title">Suppliers</h1>

      {isAdmin && (
        <section className="panel">
          <h2>Add Supplier</h2>
          <form className="inline-form grid-form" onSubmit={handleCreate}>
            {error && <div className="error-banner">{error}</div>}
            <label>
              Supplier Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              What They Sell
              <input value={form.sells} onChange={(e) => setForm({ ...form, sells: e.target.value })} required />
            </label>
            <label>
              Phone
              <input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </label>
            <label>
              Location
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label>
              Notes
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add Supplier'}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-header-row">
          <h2>Supplier Directory</h2>
          <input
            className="search-input"
            placeholder="Search by name, product, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">No suppliers found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sells</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Notes</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.sells}</td>
                  <td>
                    {s.contact_phone && <div>{s.contact_phone}</div>}
                    {s.contact_email && <div className="muted">{s.contact_email}</div>}
                  </td>
                  <td>{s.location || '—'}</td>
                  <td>{s.notes || '—'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(s.id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
