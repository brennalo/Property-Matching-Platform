import { Building2, ArrowLeft } from 'lucide-react'
import LoginForm from '../components/LoginForm'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
    const navigate = useNavigate()
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg)', padding: 20,
        }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Building2 size={36} color="var(--primary)" style={{ marginBottom: 8 }} />
                    <h1 style={{ fontSize: '2rem' }}>PropertyMatch</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Sign in to your account</p>
                </div>
                <button type="button" onClick={() => navigate(-1)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                        color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: 20,
                    }}>
                    <ArrowLeft size={15} /> Back
                </button>
                <div className="card">
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
