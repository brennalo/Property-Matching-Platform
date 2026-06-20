import { useState } from 'react'
import { authVerifyApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import { Mail, X } from 'lucide-react'

/**
 * Shown inside the AppShell for users whose email is not yet verified.
 * Lets them resend the verification email without logging out.
 */
export default function VerifyEmailBanner() {
    const { user } = useAuth()
    const [dismissed, setDismissed] = useState(false)
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)

    // Only show for Pending users — hide for Verified/Blocked/Admin
    if (!user || user.status !== 'Pending' || dismissed) return null

    const handleResend = async () => {
        setLoading(true)
        try {
            await authVerifyApi.resend(user.email)
            setSent(true)
        } catch {
            // silently fail — backend always returns 200
            setSent(true)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            width: '100%',
            background: 'linear-gradient(90deg, rgba(232,160,69,0.15) 0%, rgba(232,160,69,0.08) 100%)',
            borderBottom: '1px solid rgba(232,160,69,0.3)',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.85rem',
            flexShrink: 0,   // don't grow to fill remaining height
        }}>
            <Mail size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />

            <span style={{ flex: 1, color: 'var(--text-muted)' }}>
                {sent
                    ? '✅ Verification email sent — check your inbox (and spam folder).'
                    : <>
                        <strong style={{ color: 'var(--accent)' }}>Verify your email</strong> to unlock all features.
                        A link was sent to <strong>{user.email}</strong>.
                    </>
                }
            </span>

            {!sent && (
                <button
                    className="btn btn-outline btn-sm"
                    style={{ flexShrink: 0, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    onClick={handleResend}
                    disabled={loading}
                >
                    {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Resend link'}
                </button>
            )}

            <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0, color: 'var(--text-dim)' }}
                onClick={() => setDismissed(true)}
                title="Dismiss"
            >
                <X size={14} />
            </button>
        </div>
    )
}
