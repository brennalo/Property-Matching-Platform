import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api'
import type { UserRole } from '../types'
import { Building2, Mail, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        email: '', password: '', confirmPassword: '',
        fullName: '', role: 'Tenant' as UserRole,
        licenseNumber: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match')
            return
        }
        if (form.password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (form.role === 'Agent' && !form.licenseNumber.trim()) {
            setError('License number is required for agent registration')
            return
        }

        if (form.role === 'Agent' && !/^(REN|E|REA|PEA|PPM|PM|PV|V)\d+$/.test(form.licenseNumber.trim().toUpperCase()))
        {
            setError('Invalid license format. Example: REN80928 or REA8294')
            return
        }

        setLoading(true)
        try {
            await authApi.register(
                form.email, form.password, form.fullName, form.role,
                form.role === 'Agent' ? form.licenseNumber || undefined : undefined
            )
            setSuccess(true)
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    // ── Success screen ────────────────────────────────────────────────────────
    if (success) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--bg)', padding: 24,
            }}>
                <div style={{
                    maxWidth: 440, width: '100%',
                    background: 'var(--bg-card)', borderRadius: 16,
                    border: '1px solid var(--border)', padding: '40px 36px',
                    textAlign: 'center',
                }}>
                    <CheckCircle2 size={52} style={{ color: '#3db8a0', marginBottom: 16 }} />
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Check your email</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 8 }}>
                        We sent a verification link to
                    </p>
                    <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 20 }}>{form.email}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 28 }}>
                        Click the link in the email to activate your account.
                        {form.role === 'Agent' && (
                            <> Your license number format has been recorded. After email verification, your account will be reviewed by an admin before you can post listings.</>
                        )}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setSuccess(false)}>
                            Wrong email?
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Register form ─────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg)', padding: 24,
        }}>
            <div style={{
                maxWidth: 460, width: '100%',
                background: 'var(--bg-card)', borderRadius: 16,
                border: '1px solid var(--border)', padding: '40px 36px',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: 'var(--accent)' }}>
                        <Building2 size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                        PropertyMatch
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
                        Create your account
                    </p>
                </div>

                {/* Role toggle */}
                <div style={{
                    display: 'flex', gap: 0, marginBottom: 24,
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
                }}>
                    {(['Tenant', 'Agent'] as UserRole[]).map(r => (
                        <button key={r} type="button"
                            onClick={() => update('role', r)}
                            style={{
                                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                                fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
                                background: form.role === r ? 'var(--accent)' : 'transparent',
                                color: form.role === r ? '#0f0f0e' : 'var(--text-muted)',
                                transition: 'all 0.15s',
                            }}>
                            {r === 'Tenant' ? '🏠 Tenant' : '🏢 Agent'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="input" type="text" required value={form.fullName}
                                onChange={e => update('fullName', e.target.value)}
                                placeholder="Your full name" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="input" type="email" required value={form.email}
                                onChange={e => update('email', e.target.value)}
                                placeholder="you@example.com" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input className="input" type="password" required value={form.password}
                                onChange={e => update('password', e.target.value)}
                                placeholder="At least 8 characters" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <input className="input" type="password" required value={form.confirmPassword}
                                onChange={e => update('confirmPassword', e.target.value)}
                                placeholder="Repeat your password" />
                        </div>

                        {/* License number — agents only */}
                        {form.role === 'Agent' && (
                            <div className="form-group">
                                <label className="form-label">
                                    Real Estate License No.
                                    <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6, fontSize: '0.78rem' }}>(required)</span>
                                </label>
                                <input className="input" type="text" required={form.role === 'Agent'} value={form.licenseNumber}
                                    onChange={e => update('licenseNumber', e.target.value.toUpperCase().replace(/\s/g, ''))}
                                    placeholder="e.g. REN80928 or REA8294" />
                            </div>
                        )}

                        {error && (
                            <div style={{
                                padding: '10px 14px', background: 'var(--red-dim)',
                                border: '1px solid var(--red)', borderRadius: 'var(--radius)',
                                color: 'var(--red)', fontSize: '0.85rem',
                            }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                            disabled={loading}>
                            {loading
                                ? <><span className="spinner" /> Creating account…</>
                                : <><Mail size={15} /> Create Account</>}
                        </button>
                    </div>
                </form>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                </p>
            </div>
        </div>
    )
}
