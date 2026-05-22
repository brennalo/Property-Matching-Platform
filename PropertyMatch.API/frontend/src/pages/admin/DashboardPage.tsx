import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Users, Building2, CalendarCheck, CreditCard, UserX, UserCheck } from 'lucide-react'

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode; color: string; sub?: string
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', lineHeight: 1 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--accent)', fontWeight: 600 }}>{payload[0].value}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => adminApi.getAnalytics().then(r => r.data),
    refetchInterval: 30_000,
  })

  const chartData = stats ? [
    { name: 'Agents',    value: stats.totalAgents,    color: '#e8a045' },
    { name: 'Tenants',   value: stats.totalUsers,     color: '#3db8a0' },
    { name: 'Listings',  value: stats.totalListings,  color: '#a78bfa' },
    { name: 'Schedules', value: stats.totalSchedules, color: '#60a5fa' },
    { name: 'Payments',  value: stats.totalPayments,  color: '#34d399' },
    { name: 'Blocked',   value: stats.blockedAgents,  color: '#e05c5c' },
  ] : []

  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: 80 }}><span className="spinner" /></div>
  )

  if (!stats) return null

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <p className="page-sub">Platform overview · refreshes every 30 seconds</p>

      <div className="grid-3 mb-6">
        <StatCard label="Total Agents" value={stats.totalAgents}
          icon={<UserCheck size={20} />} color="#e8a045" />
        <StatCard label="Registered Tenants" value={stats.totalUsers}
          icon={<Users size={20} />} color="#3db8a0" />
        <StatCard label="Total Listings" value={stats.totalListings}
          icon={<Building2 size={20} />} color="#a78bfa" />
        <StatCard label="Scheduled Viewings" value={stats.totalSchedules}
          icon={<CalendarCheck size={20} />} color="#60a5fa" />
        <StatCard label="Payments Received" value={stats.totalPayments}
          icon={<CreditCard size={20} />} color="#34d399"
          sub="Listing activation fees" />
        <StatCard label="Blocked Agents" value={stats.blockedAgents}
          icon={<UserX size={20} />} color="#e05c5c"
          sub="Non-payment or violation" />
      </div>

      {/* Bar chart */}
      <div className="card">
        <h3 style={{ marginBottom: 20, fontSize: '1rem', color: 'var(--text-muted)' }}>Platform Overview</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={36}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CUSTOM_TOOLTIP />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
