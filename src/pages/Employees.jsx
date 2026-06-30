import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const emptyForm = { full_name: '', email: '', password: '' }

export default function Employees() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data ?? [])
    setLoading(false)
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function toggleRole(p) {
    const newRole = p.role === 'admin' ? 'employee' : 'admin'
    if (!window.confirm(`Change ${p.full_name}'s role to ${newRole}?`)) return
    await supabase.from('profiles').update({ role: newRole }).eq('id', p.id)
    load()
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setInfo('')
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: form,
    })
    setSaving(false)
    if (error) {
      setError(error.context?.body?.error || error.message)
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }
    setInfo(`Account created for ${form.full_name}. Share the email and password with them.`)
    setForm(emptyForm)
    load()
  }

  return (
    <div>
      <h1 className="page-title">Employees</h1>

      <section className="panel">
        <h2>Add Employee</h2>
        <p className="empty-note" style={{ marginTop: 0 }}>
          Set an email and password for the new staff member. They can sign in immediately with
          these credentials.
        </p>
        <form className="inline-form grid-form" onSubmit={handleCreate}>
          {error && <div className="error-banner">{error}</div>}
          {info && <div className="info-banner">{info}</div>}
          <label>
            Full Name
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="text"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      </section>

      <section className="panel">
        {loading ? (
          <p className="empty-note">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/employees/${p.id}`}>{p.full_name}</Link>
                  </td>
                  <td>
                    <span className={`badge badge-${p.role}`}>{p.role}</span>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.active ? 'Active' : 'Inactive'}</td>
                  <td className="actions-cell">
                    <button className="btn-small" onClick={() => toggleRole(p)}>
                      Make {p.role === 'admin' ? 'Employee' : 'Admin'}
                    </button>
                    <button className="btn-small" onClick={() => toggleActive(p)}>
                      {p.active ? 'Deactivate' : 'Activate'}
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
