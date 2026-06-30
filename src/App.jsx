import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DailyReports from './pages/DailyReports'
import Quotations from './pages/Quotations'
import Suppliers from './pages/Suppliers'
import CashFlow from './pages/CashFlow'
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import Performance from './pages/Performance'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/reports" element={<DailyReports />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route
              path="/cashflow"
              element={
                <ProtectedRoute adminOnly>
                  <CashFlow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute adminOnly>
                  <Employees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <ProtectedRoute adminOnly>
                  <EmployeeDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/performance"
              element={
                <ProtectedRoute adminOnly>
                  <Performance />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
