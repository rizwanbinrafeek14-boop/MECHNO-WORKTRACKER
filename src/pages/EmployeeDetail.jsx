import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatSAR, formatDate } from '../lib/format'
import { exportToCsv } from '../lib/csv'

export default function EmployeeDetail() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [reports, setReports] = useState([])
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: r }, { data: q }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('daily_reports').select('*').eq('employee_id', id).order('report_date', { ascending: false }),
      supabase.from('quotations').select('*').eq('employee_id', id).order('date_sent', { ascending: false }),
    ])
    setProfile(p ?? null)
    setReports(r ?? [])
    setQuotations(q ?? [])
    setLoading(false)
  }

  if (loading) return <div className="page-loading">Loading…</div>
  if (!profile) return <div className="page-loading">Employee not found.</div>

  const accepted = quotations.filter((q) => q.status === 'accepted').length
  const rejected = quotations.filter((q) => q.status === 'rejected').length
  const pending = quotations.filter((q) => q.status === 'pending').length
  const totalValue = quotations.reduce((s, q) => s + Number(q.amount || 0), 0)
  const acceptedValue = quotations
    .filter((q) => q.status === 'accepted')
    .reduce((s, q) => s + Number(q.amount || 0), 0)

  return (
    <div>
      <Link to="/employees" className="back-link">
        ← Back to Employees
      </Link>
      <h1 className="page-title">{profile.full_name}</h1>

      <div className="stat-grid">
        <StatCard label="Total Quotations" value={quotations.length} />
        <StatCard label="Accepted" value={accepted} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Rejected" value={rejected} />
        <StatCard label="Total Quoted Value" value={formatSAR(totalValue)} />
        <StatCard label="Won Value" value={formatSAR(acceptedValue)} />
      </div>

      <section className="panel">
        <div className="panel-header-row">
          <h2>Quotation History</h2>
          <button
            className="btn-small"
            onClick={() =>
              exportToCsv(`${profile.full_name}-quotations.csv`, quotations, [
                { label: 'Customer', value: (q) => q.customer_name },
                { label: 'Item', value: (q) => q.item_description },
                { label: 'Amount', value: (q) => q.amount },
                { label: 'Date Sent', value: (q) => q.date_sent },
                { label: 'Status', value: (q) => q.status },
                { label: 'Rejection Reason', value: (q) => q.rejection_reason || '' },
              ])
            }
          >
            Export CSV
          </button>
        </div>
        {quotations.length === 0 ? (
          <p className="empty-note">No quotations yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td>{q.customer_name}</td>
                  <td>{q.item_description}</td>
                  <td>{formatSAR(q.amount)}</td>
                  <td>{formatDate(q.date_sent)}</td>
                  <td>
                    <span className={`badge badge-${q.status}`}>{q.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Daily Reports</h2>
        {reports.length === 0 ? (
          <p className="empty-note">No reports yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quotations Made</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.report_date)}</td>
                  <td>{r.quotations_made}</td>
                  <td>{r.summary}</td>
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
