import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { Coins, Zap, CreditCard } from 'lucide-react'

const PACKAGES = [
    { tokens: 5, label: 'Starter', desc: 'Great for trying out' },
    { tokens: 10, label: 'Standard', desc: 'Most popular' },
    { tokens: 50, label: 'Pro', desc: 'Best value' },
]

export default function TokenTopUpPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [selectedTokens, setSelectedTokens] = useState(10)
    const [customAmount, setCustomAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { data: balanceData, isLoading: balanceLoading } = useQuery({
        queryKey: ['token-balance'],
        queryFn: () => paymentsApi.getTokenBalance().then(r => r.data),
    })

    const finalAmount = customAmount ? parseInt(customAmount) : selectedTokens

    const handleTopUp = async () => {
        if (!user?.userId) return
        if (!finalAmount || finalAmount < 1) {
            setError('Please enter a valid token amount.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const { data } = await paymentsApi.createTokenCheckout(user.userId, finalAmount)
            window.location.href = data.url
        } catch (e: any) {
            setError(e.response?.data?.error ?? 'Payment setup failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title">Top Up Tokens</h1>
                    <p className="page-sub">1 token = RM 1 = 1 property listing</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/agent/listings')}>
                    ← Back
                </button>
            </div>

            {/* Current Balance */}
            <div className="card" style={{ marginBottom: 20, background: 'var(--bg-input)' }}>
                <div className="flex items-center gap-3">
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'var(--accent-dim)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Coins size={20} color="var(--accent)" />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>Current Token Balance</p>
                        {balanceLoading ? (
                            <span className="spinner" />
                        ) : (
                            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
                                {balanceData?.tokenBalance ?? 0} tokens
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Package Selection */}
            <div className="card" style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 600, marginBottom: 14, fontSize: '0.9rem' }}>
                    <Zap size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Quick Select
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    {PACKAGES.map(pkg => (
                        <div
                            key={pkg.tokens}
                            onClick={() => { setSelectedTokens(pkg.tokens); setCustomAmount('') }}
                            style={{
                                flex: 1, padding: '14px 10px', borderRadius: 10, textAlign: 'center',
                                cursor: 'pointer', border: '2px solid',
                                borderColor: selectedTokens === pkg.tokens && !customAmount
                                    ? 'var(--accent)' : 'var(--border)',
                                background: selectedTokens === pkg.tokens && !customAmount
                                    ? 'var(--accent-dim)' : 'var(--bg-input)',
                                transition: 'all 0.15s',
                            }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                                {pkg.tokens}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>tokens</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RM {pkg.tokens}</div>
                            <div style={{
                                marginTop: 6, fontSize: '0.68rem', padding: '2px 6px',
                                background: 'var(--bg-card)', borderRadius: 4,
                                color: 'var(--text-muted)', display: 'inline-block'
                            }}>
                                {pkg.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Custom Amount */}
                <div className="form-group">
                    <label className="form-label">Or enter custom amount</label>
                    <input
                        className="input"
                        type="number"
                        min={1}
                        max={1000}
                        placeholder="e.g. 25"
                        value={customAmount}
                        onChange={e => {
                            setCustomAmount(e.target.value)
                            setSelectedTokens(0)
                        }}
                    />
                </div>
            </div>

            {/* Summary */}
            <div className="card" style={{ marginBottom: 16, background: 'var(--bg-input)' }}>
                <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tokens to purchase</span>
                    <span style={{ fontWeight: 600 }}>{finalAmount || 0} tokens</span>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total amount</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                        RM {finalAmount || 0}.00
                    </span>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Balance after top up</span>
                    <span style={{ fontWeight: 600, color: 'var(--teal)' }}>
                        {(balanceData?.tokenBalance ?? 0) + (finalAmount || 0)} tokens
                    </span>
                </div>
            </div>

            {error && (
                <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>
            )}

            <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                onClick={handleTopUp}
                disabled={loading || !finalAmount || finalAmount < 1}>
                {loading
                    ? <span className="spinner" />
                    : <><CreditCard size={16} style={{ marginRight: 8 }} /> Pay RM {finalAmount || 0}.00 with Stripe</>
                }
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: 12 }}>
                🔒 Secured by Stripe · Tokens are credited instantly after payment
            </p>
        </div>
    )
}