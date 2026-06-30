import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Employees() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div>
      <h1 className="page-title">Employees</h1>
      <p className="empty-note">
        New staff create their own account on the Login screen's "create account" flow, then
        appear here. Promote them to admin or deactivate access as needed.
      </p>
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
                  <td>{p.full_name}</td>
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
