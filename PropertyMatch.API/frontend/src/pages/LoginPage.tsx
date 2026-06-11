import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authVerifyApi } from '../api'
import { Building2, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [params] = useSearchParams()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Resend verification
    const [resendLoading, setResendLoading] = useState(false)
    const [resendSent, setResendSent] = useState(false)

    // Show a success banner when redirected from /api/auth/verify-email
    const justVerified = params.get('verified') === 'true'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(email, password)
            navigate('/')
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
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg)', padding: 20,
        }}>
            <div style={{ width: '100%', maxWidth: 400 }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Building2 size={36} color="var(--accent)" style={{ marginBottom: 8 }} />
                    <h1 style={{ fontSize: '2rem' }}>PropertyMatch</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Sign in to your account</p>
                </div>

                {/* Verified banner — shown after clicking the email link */}
                {justVerified && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderRadius: 'var(--radius)',
                        background: 'rgba(61,184,160,0.12)', border: '1px solid #3db8a0',
                        marginBottom: 16, fontSize: '0.875rem',
                    }}>
                        <CheckCircle2 size={18} style={{ color: '#3db8a0', flexShrink: 0 }} />
                        <span style={{ color: '#3db8a0' }}>
                            Email verified! Sign in to continue.
                        </span>
                    </div>
                )}

                <div className="card">
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

                        {/* Error — with resend option if it's a verification error */}
                        {error && (
                            <div style={{
                                padding: '10px 14px', background: 'var(--red-dim)',
                                border: '1px solid var(--red)', borderRadius: 'var(--radius)',
                                fontSize: '0.85rem', color: 'var(--red)',
                            }}>
                                <p>{error}</p>
                                {isPendingError && !resendSent && (
                                    <button type="button"
                                        style={{ marginTop: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.83rem', padding: 0 }}
                                        onClick={handleResend} disabled={resendLoading}>
                                        {resendLoading ? 'Sending…' : 'Resend verification email'}
                                    </button>
                                )}
                            </div>
                        )}

                        {resendSent && (
                            <p style={{ fontSize: '0.83rem', color: '#3db8a0' }}>
                                ✅ Verification email resent — check your inbox.
                            </p>
                        )}

                        <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
                            {loading ? <span className="spinner" /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="divider" />
                    <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        No account? <Link to="/register">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
