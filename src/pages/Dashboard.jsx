import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate, daysSince } from '../lib/format'

const FOLLOWUP_THRESHOLD_DAYS = 3

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [stats, setStats] = useState(null)
  const [overdue, setOverdue] = useState([])
  const [byEmployee, setByEmployee] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    let quotationsQuery = supabase.from('quotations').select('*')
    if (!isAdmin) quotationsQuery = quotationsQuery.eq('employee_id', profile.id)
    const { data: quotations } = await quotationsQuery

    const pending = (quotations ?? []).filter((q) => q.status === 'pending')
    const overdueList = pending
      .filter((q) => daysSince(q.date_sent) >= FOLLOWUP_THRESHOLD_DAYS)
      .sort((a, b) => daysSince(b.date_sent) - daysSince(a.date_sent))

    const todaysCount = (quotations ?? []).filter((q) => q.date_sent === today).length
    const accepted = (quotations ?? []).filter((q) => q.status === 'accepted').length
    const rejected = (quotations ?? []).filter((q) => q.status === 'rejected').length
    const totalValue = (quotations ?? []).reduce((sum, q) => sum + Number(q.amount || 0), 0)

    setStats({
      total: quotations?.length ?? 0,
      pending: pending.length,
      accepted,
      rejected,
      todaysCount,
      totalValue,
    })
    setOverdue(overdueList.slice(0, 10))

    if (isAdmin) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'employee')
      const rows = (profiles ?? []).map((p) => {
        const mine = (quotations ?? []).filter((q) => q.employee_id === p.id)
        return {
          id: p.id,
          name: p.full_name,
          total: mine.length,
          accepted: mine.filter((q) => q.status === 'accepted').length,
          pending: mine.filter((q) => q.status === 'pending').length,
        }
      })
      setByEmployee(rows)
    }

    setLoading(false)
  }

  if (loading || !stats) return <div className="page-loading">Loading dashboard…</div>

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-grid">
        <StatCard label="Quotations Today" value={stats.todaysCount} />
        <StatCard label="Total Quotations" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Accepted" value={stats.accepted} />
        <StatCard label="Rejected" value={stats.rejected} />
        <StatCard label="Total Quoted Value" value={formatSAR(stats.totalValue)} />
      </div>

      <section className="panel">
        <h2>Follow-ups Needed ({FOLLOWUP_THRESHOLD_DAYS}+ days, no reply)</h2>
        {overdue.length === 0 ? (
          <p className="empty-note">Nothing overdue — nice work.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Sent</th>
                <th>Days Pending</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((q) => (
                <tr key={q.id} className="row-alert">
                  <td>{q.customer_name}</td>
                  <td>{formatDate(q.date_sent)}</td>
                  <td>{daysSince(q.date_sent)} days</td>
                  <td>{formatSAR(q.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && (
        <section className="panel">
          <h2>Employee Progress</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Total Quotes</th>
                <th>Accepted</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {byEmployee.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.total}</td>
                  <td>{e.accepted}</td>
                  <td>{e.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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
