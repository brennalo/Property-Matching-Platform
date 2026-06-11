import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../api'
import type { AuthUser } from '../types'

interface AuthContextType {
    user: AuthUser | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)

    const refetch = async () => {
        try {
            const { data } = await authApi.me()
            setUser(data as AuthUser)
        } catch {
            setUser(null)
        }
    }

    useEffect(() => {
        refetch().finally(() => setLoading(false))
    }, [])

    const login = async (email: string, password: string) => {
        const { data } = await authApi.login(email, password)
        setUser(data as AuthUser)
    }

    const logout = async () => {
        await authApi.logout()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refetch }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be inside AuthProvider')
    return ctx
}
