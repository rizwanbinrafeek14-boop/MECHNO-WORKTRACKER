import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSAR, formatDate, daysSince } from '../lib/format'
import { exportToCsv } from '../lib/csv'
import DateRangeFilter from '../components/DateRangeFilter'

const FOLLOWUP_THRESHOLD_DAYS = 3
const STATUS_COLORS = { accepted: '#16a34a', pending: '#d97706', rejected: '#dc2626' }

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [cashTransactions, setCashTransactions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState({ from: '', to: '' })

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    setLoading(true)
    let quotationsQuery = supabase.from('quotations').select('*')
    if (!isAdmin) quotationsQuery = quotationsQuery.eq('employee_id', profile.id)
    const { data: q } = await quotationsQuery
    setQuotations(q ?? [])

    if (isAdmin) {
      const [{ data: cash }, { data: emp }] = await Promise.all([
        supabase.from('cash_transactions').select('*'),
        supabase.from('profiles').select('id, full_name').eq('role', 'employee'),
      ])
      setCashTransactions(cash ?? [])
      setProfiles(emp ?? [])
    }

    setLoading(false)
  }

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (range.from && q.date_sent < range.from) return false
      if (range.to && q.date_sent > range.to) return false
      return true
    })
  }, [quotations, range])

  const filteredCash = useMemo(() => {
    return cashTransactions.filter((t) => {
      if (range.from && t.entry_date < range.from) return false
      if (range.to && t.entry_date > range.to) return false
      return true
    })
  }, [cashTransactions, range])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const pending = filteredQuotations.filter((q) => q.status === 'pending')
    const accepted = filteredQuotations.filter((q) => q.status === 'accepted').length
    const rejected = filteredQuotations.filter((q) => q.status === 'rejected').length
    const totalValue = filteredQuotations.reduce((sum, q) => sum + Number(q.amount || 0), 0)
    const todaysCount = filteredQuotations.filter((q) => q.date_sent === today).length
    return { total: filteredQuotations.length, pending: pending.length, accepted, rejected, totalValue, todaysCount }
  }, [filteredQuotations])

  const overdue = useMemo(() => {
    return filteredQuotations
      .filter((q) => q.status === 'pending' && daysSince(q.date_sent) >= FOLLOWUP_THRESHOLD_DAYS)
      .sort((a, b) => daysSince(b.date_sent) - daysSince(a.date_sent))
      .slice(0, 10)
  }, [filteredQuotations])

  const quotationsTrend = useMemo(() => {
    const byDate = {}
    filteredQuotations.forEach((q) => {
      byDate[q.date_sent] = (byDate[q.date_sent] || 0) + 1
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }, [filteredQuotations])

  const statusBreakdown = useMemo(
    () => [
      { name: 'Accepted', value: stats.accepted, key: 'accepted' },
      { name: 'Pending', value: stats.pending, key: 'pending' },
      { name: 'Rejected', value: stats.rejected, key: 'rejected' },
    ],
    [stats]
  )

  const cashTrend = useMemo(() => {
    const byDate = {}
    filteredCash.forEach((t) => {
      if (!byDate[t.entry_date]) byDate[t.entry_date] = { date: t.entry_date, inflow: 0, outflow: 0 }
      if (t.type === 'inflow') byDate[t.entry_date].inflow += Number(t.amount || 0)
      if (t.type === 'outflow' || t.type === 'expense') byDate[t.entry_date].outflow += Number(t.amount || 0)
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredCash])

  const byEmployee = useMemo(() => {
    if (!isAdmin) return []
    return profiles.map((p) => {
      const mine = filteredQuotations.filter((q) => q.employee_id === p.id)
      return {
        id: p.id,
        name: p.full_name,
        total: mine.length,
        accepted: mine.filter((q) => q.status === 'accepted').length,
        pending: mine.filter((q) => q.status === 'pending').length,
        value: mine.reduce((s, q) => s + Number(q.amount || 0), 0),
      }
    })
  }, [profiles, filteredQuotations, isAdmin])

  if (loading) return <div className="page-loading">Loading dashboard…</div>

  return (
    <div>
      <div className="panel-header-row">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Dashboard
        </h1>
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <div className="stat-grid">
        <StatCard label="Quotations Today" value={stats.todaysCount} />
        <StatCard label="Total Quotations" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Accepted" value={stats.accepted} />
        <StatCard label="Rejected" value={stats.rejected} />
        <StatCard label="Total Quoted Value" value={formatSAR(stats.totalValue)} />
      </div>

      <div className="chart-grid">
        <section className="panel">
          <h2>Quotations Sent Over Time</h2>
          {quotationsTrend.length === 0 ? (
            <p className="empty-note">No data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quotationsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="panel">
          <h2>Status Breakdown</h2>
          {stats.total === 0 ? (
            <p className="empty-note">No data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {isAdmin && (
        <section className="panel">
          <h2>Cash Flow Over Time</h2>
          {cashTrend.length === 0 ? (
            <p className="empty-note">No data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatSAR(v)} />
                <Legend />
                <Line type="monotone" dataKey="inflow" stroke="#16a34a" name="Inflow" />
                <Line type="monotone" dataKey="outflow" stroke="#dc2626" name="Outflow + Expense" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

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
          <div className="panel-header-row">
            <h2>Employee Progress</h2>
            <button
              className="btn-small"
              onClick={() =>
                exportToCsv('employee-progress.csv', byEmployee, [
                  { label: 'Employee', value: (e) => e.name },
                  { label: 'Total Quotes', value: (e) => e.total },
                  { label: 'Accepted', value: (e) => e.accepted },
                  { label: 'Pending', value: (e) => e.pending },
                  { label: 'Total Value', value: (e) => e.value },
                ])
              }
            >
              Export CSV
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Total Quotes</th>
                <th>Accepted</th>
                <th>Pending</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {byEmployee.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/employees/${e.id}`}>{e.name}</Link>
                  </td>
                  <td>{e.total}</td>
                  <td>{e.accepted}</td>
                  <td>{e.pending}</td>
                  <td>{formatSAR(e.value)}</td>
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
