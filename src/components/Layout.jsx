import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import logo from '../assets/logo.png'
import NotificationBell from './NotificationBell'

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-topbar-toggle"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        ☰
      </button>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <img src={logo} alt="Mechno Skill" className="brand-logo" />
          Mechno Skill
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        {!isAdmin && <NotificationBell />}
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/reports">Daily Reports</NavLink>
          <NavLink to="/quotations">Quotations</NavLink>
          <NavLink to="/purchase-orders">Purchase Orders</NavLink>
          <NavLink to="/suppliers">Suppliers</NavLink>
          <NavLink to="/cashflow">Cash Flow</NavLink>
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
