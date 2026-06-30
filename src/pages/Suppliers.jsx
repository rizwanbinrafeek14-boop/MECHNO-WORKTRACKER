import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate } from '../lib/format'

const emptyForm = { name: '', sells: '', contact_phone: '', contact_email: '', location: '', notes: '' }
const emptyPurchase = { purchase_date: new Date().toISOString().slice(0, 10), item_description: '', amount: '', notes: '' }

const CATEGORY_GROUPS = [
  {
    label: null,
    items: [
      { name: 'CS', color: '#2563eb' },
      { name: 'SS', color: '#16a34a' },
      { name: 'GI', color: '#92400e' },
      { name: 'BMI', color: '#475569' },
      { name: 'Brass', color: '#b45309' },
      { name: 'Bronze', color: '#9a3412' },
      { name: 'Copper', color: '#c2410c' },
      { name: 'PVC', color: '#2563eb' },
      { name: 'CPVC', color: '#7c3aed' },
      { name: 'PPR', color: '#15803d' },
      { name: 'HDPE', color: '#9333ea' },
    ],
  },
  {
    label: 'Specialty',
    items: [
      { name: 'Electrical', color: '#c2410c' },
      { name: 'Safety Equip.', color: '#dc2626' },
      { name: 'Hardware', color: '#0d9488' },
      { name: 'Clamps', color: '#0f766e' },
      { name: 'Fasteners', color: '#7c3aed' },
      { name: 'Gaskets', color: '#9f1239' },
    ],
  },
]

export default function Suppliers() {
  const { isAdmin } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }

  async function loadPurchases(supplierId) {
    const { data } = await supabase
      .from('supplier_purchases')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('purchase_date', { ascending: false })
    setPurchases(data ?? [])
  }

  async function toggleExpand(s) {
    if (expandedId === s.id) {
      setExpandedId(null)
      setPurchases([])
      return
    }
    setExpandedId(s.id)
    setPurchaseForm(emptyPurchase)
    await loadPurchases(s.id)
  }

  async function handleAddPurchase(e, supplierId) {
    e.preventDefault()
    const { error } = await supabase.from('supplier_purchases').insert({
      supplier_id: supplierId,
      purchase_date: purchaseForm.purchase_date,
      item_description: purchaseForm.item_description,
      amount: Number(purchaseForm.amount) || 0,
      notes: purchaseForm.notes || null,
    })
    if (error) {
      setError(error.message)
      return
    }
    setPurchaseForm(emptyPurchase)
    loadPurchases(supplierId)
  }

  async function handleDeletePurchase(id, supplierId) {
    if (!window.confirm('Delete this purchase record?')) return
    await supabase.from('supplier_purchases').delete().eq('id', id)
    loadPurchases(supplierId)
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

  function startEdit(s) {
    setEditingId(s.id)
    setEditForm({ ...s })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit() {
    const { error } = await supabase
      .from('suppliers')
      .update({
        name: editForm.name,
        sells: editForm.sells,
        contact_phone: editForm.contact_phone || null,
        contact_email: editForm.contact_email || null,
        location: editForm.location || null,
        notes: editForm.notes || null,
      })
      .eq('id', editingId)
    if (error) {
      setError(error.message)
      return
    }
    cancelEdit()
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

  const categoryCounts = useMemo(() => {
    const counts = {}
    CATEGORY_GROUPS.forEach((g) =>
      g.items.forEach((c) => {
        counts[c.name] = suppliers.filter((s) => s.sells.toLowerCase().includes(c.name.toLowerCase())).length
      })
    )
    return counts
  }, [suppliers])

  function selectCategory(name) {
    setSearch((prev) => (prev === name ? '' : name))
  }

  return (
    <div>
      <h1 className="page-title">Suppliers</h1>

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

      <div className="suppliers-layout">
        <section className="panel categories-panel">
          <h2>Categories</h2>
          <ul className="category-list">
            {CATEGORY_GROUPS.map((group, gi) => (
              <li key={gi}>
                {group.label && <div className="category-group-label">{group.label}</div>}
                <ul className="category-list">
                  {group.items.map((c) => (
                    <li
                      key={c.name}
                      className={`category-item ${search === c.name ? 'category-item-active' : ''}`}
                      onClick={() => selectCategory(c.name)}
                    >
                      <span className="category-dot" style={{ background: c.color }} />
                      <span className="category-name">{c.name}</span>
                      {categoryCounts[c.name] > 0 && (
                        <span className="category-count" style={{ color: c.color }}>
                          {categoryCounts[c.name]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel directory-panel">
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id}>
                    <td>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.sells}
                        onChange={(e) => setEditForm({ ...editForm, sells: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        placeholder="Phone"
                        value={editForm.contact_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                      />
                      <input
                        placeholder="Email"
                        value={editForm.contact_email || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.location || ''}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      />
                    </td>
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
                  <>
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.sells}</td>
                      <td>
                        {s.contact_phone && <div>{s.contact_phone}</div>}
                        {s.contact_email && <div className="muted">{s.contact_email}</div>}
                      </td>
                      <td>{s.location || '—'}</td>
                      <td>{s.notes || '—'}</td>
                      <td className="actions-cell">
                        <button className="btn-small" onClick={() => toggleExpand(s)}>
                          {expandedId === s.id ? 'Hide Purchases' : 'Purchases'}
                        </button>
                        {isAdmin && (
                          <>
                            <button className="btn-small" onClick={() => startEdit(s)}>
                              Edit
                            </button>
                            <button className="btn-small btn-danger" onClick={() => handleDelete(s.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedId === s.id && (
                      <tr key={`${s.id}-expanded`}>
                        <td colSpan={6}>
                          <div className="panel" style={{ margin: 0 }}>
                            <h2>Purchase History — {s.name}</h2>
                            {isAdmin && (
                              <form
                                className="inline-form grid-form"
                                onSubmit={(e) => handleAddPurchase(e, s.id)}
                                style={{ marginBottom: 14 }}
                              >
                                <label>
                                  Date
                                  <input
                                    type="date"
                                    value={purchaseForm.purchase_date}
                                    onChange={(e) =>
                                      setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Item / Service
                                  <input
                                    value={purchaseForm.item_description}
                                    onChange={(e) =>
                                      setPurchaseForm({ ...purchaseForm, item_description: e.target.value })
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Amount (SAR)
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={purchaseForm.amount}
                                    onChange={(e) =>
                                      setPurchaseForm({ ...purchaseForm, amount: e.target.value })
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Notes
                                  <input
                                    value={purchaseForm.notes}
                                    onChange={(e) =>
                                      setPurchaseForm({ ...purchaseForm, notes: e.target.value })
                                    }
                                  />
                                </label>
                                <button type="submit">Add Purchase</button>
                              </form>
                            )}
                            {purchases.length === 0 ? (
                              <p className="empty-note">No purchases recorded.</p>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Item</th>
                                    <th>Amount</th>
                                    <th>Notes</th>
                                    {isAdmin && <th>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchases.map((p) => (
                                    <tr key={p.id}>
                                      <td>{formatDate(p.purchase_date)}</td>
                                      <td>{p.item_description}</td>
                                      <td>{formatSAR(p.amount)}</td>
                                      <td>{p.notes || '—'}</td>
                                      {isAdmin && (
                                        <td>
                                          <button
                                            className="btn-small btn-danger"
                                            onClick={() => handleDeletePurchase(p.id, s.id)}
                                          >
                                            Delete
                                          </button>
                                        </td>
                                      )}
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
    </div>
  )
}
