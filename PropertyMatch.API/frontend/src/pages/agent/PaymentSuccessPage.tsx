import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

export default function PaymentSuccessPage() {
    const navigate = useNavigate()

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg)', padding: 24
        }}>
            <div style={{
                maxWidth: 440, width: '100%', textAlign: 'center',
                background: 'var(--bg-card)', borderRadius: 16,
                border: '1px solid var(--border)', padding: '40px 36px'
            }}>
                <CheckCircle2 size={52} color="var(--teal)" style={{ marginBottom: 16 }} />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>Payment Successful!</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                    Your tokens have been credited to your account. You can now upload property listings.
                </p>
                <div className="flex gap-3" style={{ justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={() => navigate('/agent/topup')}>
                        Top Up More
                    </button>
                    <button className="btn btn-outline" onClick={() => navigate('/agent/listings')}>
                        My Listings
                    </button>
                </div>
            </div>
        </div>
    )
}