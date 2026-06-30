import { Building2 } from 'lucide-react'
import LoginForm from '../components/LoginForm'

export default function LoginPage() {
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
                <div className="card">
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
