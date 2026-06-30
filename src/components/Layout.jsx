import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Mechno Skill</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/reports">Daily Reports</NavLink>
          <NavLink to="/quotations">Quotations</NavLink>
          <NavLink to="/suppliers">Suppliers</NavLink>
          {isAdmin && <NavLink to="/cashflow">Cash Flow</NavLink>}
          {isAdmin && <NavLink to="/employees">Employees</NavLink>}
          {isAdmin && <NavLink to="/performance">Performance</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{profile?.full_name ?? '…'}</div>
          <div className="user-role">{profile?.role}</div>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
