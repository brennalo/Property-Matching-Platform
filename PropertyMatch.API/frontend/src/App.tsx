import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './index.css'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SearchPage from './pages/tenant/SearchPage'
import ResultsPage from './pages/tenant/ResultsPage'
import LifestylePage from './pages/tenant/LifestylePage'
import TenantSchedulesPage from './pages/tenant/SchedulesPage'
import AgentListingsPage from './pages/agent/ListingsPage'
import AgentCalendarPage from './pages/agent/CalendarPage'
import AdminDashboardPage from './pages/admin/DashboardPage'
import AdminAgentsPage from './pages/admin/AgentsPage'

import { Home, Search, Heart, Calendar, List, BarChart3, Users, LogOut, Building2 } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const tenantLinks = [
    { to: '/search', icon: <Search size={16} />, label: 'Find a Home' },
    { to: '/lifestyle', icon: <Heart size={16} />, label: 'Lifestyle Templates' },
    { to: '/my-schedules', icon: <Calendar size={16} />, label: 'My Viewings' },
  ]
  const agentLinks = [
    { to: '/agent/listings', icon: <List size={16} />, label: 'My Listings' },
    { to: '/agent/calendar', icon: <Calendar size={16} />, label: 'Viewing Calendar' },
  ]
  const adminLinks = [
    { to: '/admin/dashboard', icon: <BarChart3 size={16} />, label: 'Analytics' },
    { to: '/admin/agents', icon: <Users size={16} />, label: 'Agents' },
  ]

  const links = user?.role === 'Tenant' ? tenantLinks
    : user?.role === 'Agent' ? agentLinks
    : adminLinks

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-logo">
          <Building2 size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          PropertyMatch
        </span>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {user?.fullName}
            <span className={`badge badge-${user?.role === 'Admin' ? 'amber' : user?.role === 'Agent' ? 'green' : 'grey'}`}
              style={{ marginLeft: 8 }}>
              {user?.role}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/login') }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <nav className="sidebar">
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            {l.icon} {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'Tenant') return <Navigate to="/search" replace />
  if (user.role === 'Agent') return <Navigate to="/agent/listings" replace />
  return <Navigate to="/admin/dashboard" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<RootRedirect />} />

            {/* Tenant */}
            <Route path="/search" element={
              <ProtectedRoute roles={['Tenant']}>
                <AppShell><SearchPage /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/results" element={
              <ProtectedRoute roles={['Tenant']}>
                <AppShell><ResultsPage /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/lifestyle" element={
              <ProtectedRoute roles={['Tenant']}>
                <AppShell><LifestylePage /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/my-schedules" element={
              <ProtectedRoute roles={['Tenant']}>
                <AppShell><TenantSchedulesPage /></AppShell>
              </ProtectedRoute>
            } />

            {/* Agent */}
            <Route path="/agent/listings" element={
              <ProtectedRoute roles={['Agent']}>
                <AppShell><AgentListingsPage /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/agent/calendar" element={
              <ProtectedRoute roles={['Agent']}>
                <AppShell><AgentCalendarPage /></AppShell>
              </ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute roles={['Admin']}>
                <AppShell><AdminDashboardPage /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/admin/agents" element={
              <ProtectedRoute roles={['Admin']}>
                <AppShell><AdminAgentsPage /></AppShell>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
