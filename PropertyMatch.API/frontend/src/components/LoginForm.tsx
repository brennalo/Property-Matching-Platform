import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authVerifyApi } from '../api'
import { CheckCircle2 } from 'lucide-react'

interface LoginFormProps {
    /** Called right after a successful login (e.g. close the modal). */
    onSuccess?: () => void
    /** Where to send the user after login. Defaults to role-based redirect via "/". */
    redirectTo?: string
    /** Optional contextual message shown above the form, e.g. why login is required. */
    intentMessage?: string
    onSwitchToRegister?: () => void
}

export default function LoginForm({ onSuccess, redirectTo, intentMessage, onSwitchToRegister }: LoginFormProps) {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [params] = useSearchParams()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const [resendLoading, setResendLoading] = useState(false)
    const [resendSent, setResendSent] = useState(false)

    const justVerified = params.get('verified') === 'true'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(email, password)
            if (onSuccess) onSuccess()
            navigate(redirectTo || '/')
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (!email) { setError('Enter your email address above first.'); return }
        setResendLoading(true)
        try {
            await authVerifyApi.resend(email)
            setResendSent(true)
            setError('')
        } catch {
            setResendSent(true)
        } finally {
            setResendLoading(false)
        }
    }

    const isPendingError = error.toLowerCase().includes('verify')

    return (
        <div>
            {intentMessage && (
                <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius)',
                    background: 'var(--primary-dim)', color: 'var(--primary)',
                    fontSize: '0.85rem', marginBottom: 16,
                }}>
                    {intentMessage}
                </div>
            )}

            {justVerified && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius)',
                    background: 'var(--green-dim)', border: '1px solid var(--green)',
                    marginBottom: 16, fontSize: '0.875rem',
                }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--green-hi)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--green-hi)' }}>Email verified! Sign in to continue.</span>
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="input" type="email" value={email}
                        onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="input" type="password" value={password}
                        onChange={e => setPassword(e.target.value)} required />
                </div>

                {error && (
                    <div style={{
                        padding: '10px 14px', background: 'var(--red-dim)',
                        border: '1px solid var(--red)', borderRadius: 'var(--radius)',
                        fontSize: '0.85rem', color: 'var(--red)',
                    }}>
                        <p>{error}</p>
                        {isPendingError && !resendSent && (
                            <button type="button"
                                style={{ marginTop: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.83rem', padding: 0 }}
                                onClick={handleResend} disabled={resendLoading}>
                                {resendLoading ? 'Sending…' : 'Resend verification email'}
                            </button>
                        )}
                    </div>
                )}

                {resendSent && (
                    <p style={{ fontSize: '0.83rem', color: 'var(--green-hi)' }}>
                        ✅ Verification email resent — check your inbox.
                    </p>
                )}

                <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Sign In'}
                </button>
            </form>

            <div className="divider" />
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                No account?{' '}
                {onSwitchToRegister
                    ? <button type="button" onClick={onSwitchToRegister}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                        Register here
                    </button>
                    : <a href="/register">Register here</a>}
            </p>
        </div>
    )
}
