import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api'
import type { AgentDetail, AgentStatus } from '../../types'
import { CheckCircle2, Ban, RotateCcw, Search } from 'lucide-react'

const STATUS_BADGE: Record<AgentStatus, string> = {
    Pending: 'badge-grey',
    Unapproved: 'badge-amber',
    Verified: 'badge-green',
    Blocked: 'badge-red',
}

export default function AdminAgentsPage() {
    const qc = useQueryClient()
    const [filter, setFilter] = useState<AgentStatus | ''>('')
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const { data: agents = [], isLoading } = useQuery({
        queryKey: ['admin-agents', filter],
        queryFn: () => adminApi.getAgents(filter || undefined).then(r => r.data),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: AgentStatus }) =>
            adminApi.updateAgentStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-agents'] })
            qc.invalidateQueries({ queryKey: ['analytics'] })
            showToast('Agent status updated')
        },
        onError: () => showToast('Failed to update status', 'error'),
    })

    const filtered = agents.filter(a =>
        a.fullName.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    )

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <div>
            <h1 className="page-title">Agent Management</h1>
            <p className="page-sub">Verify agent accounts and manage their access</p>

            {/* Filters */}
            <div className="flex gap-3 mb-5" style={{ flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input className="input" style={{ paddingLeft: 34 }} placeholder="Search by name or email…"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="flex gap-2">
                    {(['', 'Pending', 'Unapproved', 'Verified', 'Blocked'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)}
                            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}>
                            {s || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <p>No agents found</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(a => (
                        <AgentRow key={a.userId} agent={a}
                            onAction={(status) => updateMut.mutate({ id: a.userId, status })}
                            loading={updateMut.isPending} />
                    ))}
                </div>
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    )
}

function AgentRow({ agent: a, onAction, loading }: {
    agent: AgentDetail
    onAction: (status: AgentStatus) => void
    loading: boolean
}) {
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <div className="card">
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem',
                    color: 'var(--accent)',
                }}>
                    {a.fullName.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontWeight: 600 }}>{a.fullName}</span>
                        <span className={`badge ${STATUS_BADGE[a.status]}`}>{a.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>📧 {a.email}</span>
                        <span>📋 {a.listingCount} listing{a.listingCount !== 1 ? 's' : ''}</span>
                        <span>📅 Registered {formatDate(a.createdAt)}</span>
                        {a.verifiedAt && <span>✅ Verified {formatDate(a.verifiedAt)}</span>}
                        {a.licenseNumber && (
                            <span>🪪 License: {a.licenseNumber}</span>
                        )}

                        {a.lppehSearchUrl && (
                            <a
                                href={a.lppehSearchUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                            >
                                (Check LPPEH)
                            </a>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                    {a.status === 'Unapproved' && (
                        <>
                            <button className="btn btn-sm" style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: 'none', cursor: 'pointer' }}
                                disabled={loading}
                                onClick={() => onAction('Verified')}>
                                <CheckCircle2 size={13} /> Verify
                            </button>
                            <button className="btn btn-danger btn-sm" disabled={loading}
                                onClick={() => onAction('Blocked')}>
                                <Ban size={13} /> Reject
                            </button>
                        </>
                    )}
                    {a.status === 'Pending' && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Awaiting email verification
                        </span>
                    )}
                    {a.status === 'Verified' && (
                        <button className="btn btn-danger btn-sm" disabled={loading}
                            onClick={() => { if (confirm(`Block ${a.fullName}? Their listings will be deactivated.`)) onAction('Blocked') }}>
                            <Ban size={13} /> Block
                        </button>
                    )}
                    {a.status === 'Blocked' && (
                        <button className="btn btn-sm" style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: 'none', cursor: 'pointer' }}
                            disabled={loading}
                            onClick={() => onAction('Verified')}>
                            <RotateCcw size={13} /> Reinstate
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
