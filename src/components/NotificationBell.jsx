import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate, daysSince } from '../lib/format'

const FOLLOWUP_THRESHOLD_DAYS = 3

export default function NotificationBell() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [overdue, setOverdue] = useState([])
  const [feedback, setFeedback] = useState([])

  useEffect(() => {
    if (profile) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function load() {
    const [{ data: q }, { data: r }] = await Promise.all([
      supabase.from('quotations').select('*').eq('employee_id', profile.id).eq('status', 'pending'),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('employee_id', profile.id)
        .not('admin_feedback', 'is', null)
        .order('report_date', { ascending: false })
        .limit(5),
    ])
    setOverdue((q ?? []).filter((x) => daysSince(x.date_sent) >= FOLLOWUP_THRESHOLD_DAYS))
    setFeedback(r ?? [])
  }

  const count = overdue.length + feedback.length

  return (
    <div>
      <button className="notif-bell" onClick={() => setOpen((o) => !o)}>
        Notifications
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {count === 0 ? (
            <div className="notif-empty">Nothing new.</div>
          ) : (
            <>
              {overdue.map((q) => (
                <div key={`q-${q.id}`} className="notif-item">
                  Follow-up overdue: <strong>{q.customer_name}</strong> — sent {formatDate(q.date_sent)}
                </div>
              ))}
              {feedback.map((r) => (
                <div key={`r-${r.id}`} className="notif-item">
                  Admin feedback on {formatDate(r.report_date)} report: {r.admin_feedback}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
