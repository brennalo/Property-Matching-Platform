import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { Building2 } from 'lucide-react'
import type { UserRole } from '../types'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'Tenant' as UserRole })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      setSuccess((data as any).message)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Building2 size={36} color="var(--accent)" style={{ marginBottom: 8 }} />
          <h1 style={{ fontSize: '2rem' }}>Create Account</h1>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={form.fullName}
                onChange={e => update('fullName', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={e => update('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={form.password}
                onChange={e => update('password', e.target.value)} required minLength={8} />
            </div>

            {/* Role selector as styled toggle */}
            <div className="form-group">
              <label className="form-label">I am a</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['Tenant', 'Agent'] as UserRole[]).map(r => (
                  <button key={r} type="button"
                    onClick={() => update('role', r)}
                    style={{
                      padding: '10px', borderRadius: 'var(--radius)',
                      border: `2px solid ${form.role === r ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.role === r ? 'rgba(232,160,69,0.1)' : 'var(--bg-input)',
                      color: form.role === r ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                      transition: 'all 0.15s'
                    }}>
                    {r === 'Tenant' ? '🏠 Tenant' : '🏢 Agent'}
                  </button>
                ))}
              </div>
              {form.role === 'Agent' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Agent accounts require admin verification before posting listings.
                </p>
              )}
            </div>

            {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>{error}</p>}
            {success && <p style={{ color: 'var(--teal)', fontSize: '0.85rem' }}>{success}</p>}

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
