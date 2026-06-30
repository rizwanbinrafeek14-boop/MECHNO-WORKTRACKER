import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatSAR } from '../lib/format'
import { exportToCsv } from '../lib/csv'
import DateRangeFilter from '../components/DateRangeFilter'

const FOLLOWUP_THRESHOLD_DAYS = 3

export default function Performance() {
  const [profiles, setProfiles] = useState([])
  const [quotations, setQuotations] = useState([])
  const [followups, setFollowups] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState({ from: '', to: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: emp }, { data: q }, { data: f }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'employee'),
      supabase.from('quotations').select('*'),
      supabase.from('quotation_followups').select('*'),
      supabase.from('daily_reports').select('*'),
    ])
    setProfiles(emp ?? [])
    setQuotations(q ?? [])
    setFollowups(f ?? [])
    setReports(r ?? [])
    setLoading(false)
  }

  const inRange = (dateStr) => {
    if (!dateStr) return false
    if (range.from && dateStr < range.from) return false
    if (range.to && dateStr > range.to) return false
    return true
  }

  const filteredQuotations = useMemo(
    () => quotations.filter((q) => !range.from && !range.to ? true : inRange(q.date_sent)),
    [quotations, range]
  )
  const filteredReports = useMemo(
    () => reports.filter((r) => !range.from && !range.to ? true : inRange(r.report_date)),
    [reports, range]
  )

  const rows = useMemo(() => {
    return profiles
      .map((p) => {
        const mine = filteredQuotations.filter((q) => q.employee_id === p.id)
        const accepted = mine.filter((q) => q.status === 'accepted')
        const rejected = mine.filter((q) => q.status === 'rejected')
        const decided = accepted.length + rejected.length
        const conversionRate = decided > 0 ? (accepted.length / decided) * 100 : null

        const myFollowups = followups.filter((f) => f.employee_id === p.id)
        const followupDelays = myFollowups
          .map((f) => {
            const q = quotations.find((qq) => qq.id === f.quotation_id)
            if (!q) return null
            const days = (new Date(f.followup_date) - new Date(q.date_sent)) / (1000 * 60 * 60 * 24)
            return days >= 0 ? days : null
          })
          .filter((d) => d !== null)
        const avgFollowupDays =
          followupDelays.length > 0
            ? followupDelays.reduce((s, d) => s + d, 0) / followupDelays.length
            : null
        const overdueCount = mine.filter((q) => {
          if (q.status !== 'pending') return false
          const days = (new Date() - new Date(q.date_sent)) / (1000 * 60 * 60 * 24)
          return days >= FOLLOWUP_THRESHOLD_DAYS
        }).length

        const myReports = filteredReports.filter((r) => r.employee_id === p.id)
        const reportDays = new Set(myReports.map((r) => r.report_date)).size

        const revenue = accepted.reduce((s, q) => s + Number(q.amount || 0), 0)

        return {
          id: p.id,
          name: p.full_name,
          total: mine.length,
          accepted: accepted.length,
          rejected: rejected.length,
          conversionRate,
          avgFollowupDays,
          overdueCount,
          reportDays,
          revenue,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }, [profiles, filteredQuotations, followups, quotations, filteredReports])

  if (loading) return <div className="page-loading">Loading performance…</div>

  return (
    <div>
      <div className="panel-header-row">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Employee Performance
        </h1>
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <section className="panel">
        <h2>Revenue Contribution (Accepted Quotations)</h2>
        {rows.every((r) => r.revenue === 0) ? (
          <p className="empty-note">No accepted quotations in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => formatSAR(v)} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h2>Performance Leaderboard</h2>
          <button
            className="btn-small"
            onClick={() =>
              exportToCsv('employee-performance.csv', rows, [
                { label: 'Employee', value: (r) => r.name },
                { label: 'Total Quotes', value: (r) => r.total },
                { label: 'Accepted', value: (r) => r.accepted },
                { label: 'Rejected', value: (r) => r.rejected },
                {
                  label: 'Conversion Rate %',
                  value: (r) => (r.conversionRate === null ? '' : r.conversionRate.toFixed(1)),
                },
                {
                  label: 'Avg Follow-up Days',
                  value: (r) => (r.avgFollowupDays === null ? '' : r.avgFollowupDays.toFixed(1)),
                },
                { label: 'Overdue Follow-ups', value: (r) => r.overdueCount },
                { label: 'Days With Report Submitted', value: (r) => r.reportDays },
                { label: 'Revenue (Accepted SAR)', value: (r) => r.revenue },
              ])
            }
          >
            Export CSV
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="empty-note">No employees yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Total Quotes</th>
                <th>Conversion Rate</th>
                <th>Avg Follow-up Speed</th>
                <th>Overdue Follow-ups</th>
                <th>Days Reported</th>
                <th>Revenue (Accepted)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.overdueCount > 0 ? 'row-alert' : ''}>
                  <td>
                    <Link to={`/employees/${r.id}`}>{r.name}</Link>
                  </td>
                  <td>{r.total}</td>
                  <td>{r.conversionRate === null ? '—' : `${r.conversionRate.toFixed(1)}%`}</td>
                  <td>{r.avgFollowupDays === null ? '—' : `${r.avgFollowupDays.toFixed(1)}d`}</td>
                  <td>{r.overdueCount}</td>
                  <td>{r.reportDays}</td>
                  <td>{formatSAR(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
