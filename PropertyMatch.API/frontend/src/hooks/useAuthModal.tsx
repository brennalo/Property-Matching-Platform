import { createContext, useContext, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'

interface OpenOptions {
    intentMessage?: string
    redirectTo?: string
}

interface AuthModalContextType {
    open: (opts?: OpenOptions) => void
    close: () => void
}

const AuthModalContext = createContext<AuthModalContextType | null>(null)

export function AuthModalProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false)
    const [opts, setOpts] = useState<OpenOptions>({})
    const navigate = useNavigate()

    const open = (o: OpenOptions = {}) => { setOpts(o); setVisible(true) }
    const close = () => setVisible(false)

    return (
        <AuthModalContext.Provider value={{ open, close }}>
            {children}
            {visible && (
                <div className="modal-overlay" onClick={close}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <h2 style={{ fontSize: '1.2rem' }}>Sign in</h2>
                            <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
                        </div>
                        <LoginForm
                            intentMessage={opts.intentMessage}
                            redirectTo={opts.redirectTo}
                            onSuccess={close}
                            onSwitchToRegister={() => { close(); navigate('/register') }}
                        />
                    </div>
                </div>
            )}
        </AuthModalContext.Provider>
    )
}

export const useAuthModal = () => {
    const ctx = useContext(AuthModalContext)
    if (!ctx) throw new Error('useAuthModal must be inside AuthModalProvider')
    return ctx
}
