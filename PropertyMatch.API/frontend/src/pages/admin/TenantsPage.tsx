import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api'
import type { TenantDetail, UserStatus } from '../../types'
import { Ban, RotateCcw, Search } from 'lucide-react'

const STATUS_BADGE: Record<UserStatus, string> = {
    Pending: 'badge-amber',
    Unapproved: 'badge-red',
    Verified: 'badge-green',
    Blocked: 'badge-red',
}

export default function AdminTenantsPage() {
    const qc = useQueryClient()
    const [filter, setFilter] = useState<UserStatus | ''>('')
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const { data: tenants = [], isLoading } = useQuery({
        queryKey: ['admin-tenants', filter],
        queryFn: () => adminApi.getTenants(filter || undefined).then(r => r.data),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
            adminApi.updateTenantStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-tenants'] })
            qc.invalidateQueries({ queryKey: ['analytics'] })
            showToast('Tenant status updated')
        },
        onError: () => showToast('Failed to update tenant status', 'error'),
    })

    const filtered = tenants.filter(t =>
        t.fullName.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div>
            <h1 className="page-title">Tenant Management</h1>
            <p className="page-sub">View tenant activity and manage tenant access</p>

            <div className="flex gap-3 mb-5" style={{ flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                        className="input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    {(['', 'Pending', 'Verified', 'Blocked'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}
                        >
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state"><p>No tenants found</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(t => (
                        <TenantRow
                            key={t.userId}
                            tenant={t}
                            loading={updateMut.isPending}
                            onAction={(status) => updateMut.mutate({ id: t.userId, status })}
                        />
                    ))}
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    )
}

function TenantRow({ tenant: t, loading, onAction }: {
    tenant: TenantDetail
    loading: boolean
    onAction: (status: UserStatus) => void
}) {
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

    const activityText = t.lastViewingAt
        ? formatDate(t.lastViewingAt)
        : 'No viewing scheduled yet'

    return (
        <div className="card">
            <div className="flex items-center gap-4">
                <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontFamily: 'DM Serif Display, serif',
                    fontSize: '1.1rem', color: 'var(--accent)',
                }}>
                    {t.fullName.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontWeight: 600 }}>{t.fullName}</span>
                        <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>📧 {t.email}</span>
                        <span>📅 Joined {formatDate(t.createdAt)}</span>
                        <span>👁️ {t.totalViewings} viewing{t.totalViewings !== 1 ? 's' : ''}</span>
                        <span>⏳ Pending {t.pendingViewings}</span>
                        <span>✅ Confirmed {t.confirmedViewings}</span>
                        <span>❌ Cancelled {t.cancelledViewings}</span>
                        <span>🕒 Last Viewing: {activityText}</span>
                    </div>
                </div>

                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                    {t.status === 'Pending' && (
                        <button
                            className="btn btn-success btn-sm"
                            disabled={loading}
                            onClick={() => {
                                if (confirm(`Verify ${t.fullName}?`)) {
                                    onAction('Verified')
                                }
                            }}
                        >
                            Verify
                        </button>
                    )}

                    {t.status !== 'Blocked' ? (
                        <button
                            className="btn btn-danger btn-sm"
                            disabled={loading}
                            onClick={() => {
                                if (confirm(`Block ${t.fullName}? They will not be able to login.`)) {
                                    onAction('Blocked')
                                }
                            }}
                        >
                            <Ban size={13} /> Block
                        </button>
                    ) : (
                        <button
                            className="btn btn-sm"
                            disabled={loading}
                            onClick={() => onAction('Verified')}
                        >
                            <RotateCcw size={13} /> Reactivate
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}