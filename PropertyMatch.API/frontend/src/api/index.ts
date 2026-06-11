import axios from 'axios'
import type {
    AuthUser, Listing, MatchedListing, LifestyleTemplate,
    ViewingSchedule, MatchRequest, Analytics, AgentDetail, UserStatus
} from '../types'

const api = axios.create({
    baseURL: '/api',
    withCredentials: true, // send httpOnly cookies
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
    register: (email: string, password: string, fullName: string, role: string, licenseNumber?: string) =>
        api.post('/auth/register', { email, password, fullName, role, licenseNumber }),

    login: (email: string, password: string) =>
        api.post<AuthUser>('/auth/login', { email, password }),

    logout: () => api.post('/auth/logout'),

    me: () => api.get<AuthUser>('/auth/me'),
}

// ── Listings ──────────────────────────────────────────────────────────────────
export const listingsApi = {
    getAll: () => api.get<Listing[]>('/listings'),

    getMine: () => api.get<Listing[]>('/listings/mine'),

    getById: (id: string) => api.get<Listing>(`/listings/${id}`),

    create: (data: {
        name: string; rooms: number; toilets: number;
        lat: number; lng: number; address: string;
        residencyType: string; price: number
    }) => api.post<{ id: string; message: string }>('/listings', data),

    update: (id: string, data: Partial<{
        name: string; rooms: number; toilets: number;
        lat: number; lng: number; address: string;
        residencyType: string; price: number
    }>) => api.put(`/listings/${id}`, data),

    uploadImages: (id: string, files: File[]) => {
        const form = new FormData()
        files.forEach(f => form.append('files', f))
        return api.post<{ urls: string[] }>(`/listings/${id}/images`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    },

    delete: (id: string) => api.delete(`/listings/${id}`),
}

// ── Match ─────────────────────────────────────────────────────────────────────
export const matchApi = {
    search: (req: MatchRequest) =>
        api.post<MatchedListing[]>('/match', req),
}

// ── Lifestyle Templates ───────────────────────────────────────────────────────
export const templatesApi = {
    getAll: () => api.get<LifestyleTemplate[]>('/lifestyle-templates'),

    create: (name: string, placeTypes: string[]) =>
        api.post<LifestyleTemplate>('/lifestyle-templates', { name, placeTypes }),

    update: (id: string, name: string, placeTypes: string[]) =>
        api.put<LifestyleTemplate>(`/lifestyle-templates/${id}`, { name, placeTypes }),

    delete: (id: string) => api.delete(`/lifestyle-templates/${id}`),
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedulesApi = {
    create: (listingId: string, scheduledAt: Date) =>
        api.post('/schedules', { listingId, scheduledAt: scheduledAt.toISOString() }),

    getMine: () => api.get<ViewingSchedule[]>('/schedules/mine'),

    getAgentSchedules: () => api.get<ViewingSchedule[]>('/schedules/agent'),

    updateStatus: (listingId: string, scheduledAt: string, status: string) =>
        api.patch(`/schedules/${listingId}/${encodeURIComponent(scheduledAt)}`, JSON.stringify(status), {
            headers: { 'Content-Type': 'application/json' }
        }),
}

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
    // Old per-listing checkout (kept for backward compat)
    createCheckout: (listingId: string) =>
        api.post<{ checkoutUrl: string; sessionId: string }>('/payments/checkout', { listingId }),

    // New token top-up
    createTokenCheckout: (agentId: string, tokenAmount: number) =>
        api.post<{ sessionId: string; url: string }>('/payments/create-checkout-session', { agentId, tokenAmount }),

    getTokenBalance: () =>
        api.get<{ tokenBalance: number }>('/payments/token-balance'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
    getAnalytics: () => api.get<Analytics>('/admin/analytics'),

    getAgents: (status?: UserStatus) =>
        api.get<AgentDetail[]>('/admin/agents', { params: status ? { status } : {} }),

    updateAgentStatus: (agentId: string, status: UserStatus) =>
        api.put(`/admin/agents/${agentId}/status`, { status }),

    getAllListings: () => api.get('/admin/listings'),
}

export default api

// ── Config ────────────────────────────────────────────────────────────────────
export const configApi = {
    getMapsKey: () => api.get<{ key: string }>('/config/maps-key'),
}

// ── Email verification ────────────────────────────────────────────────────────
export const authVerifyApi = {
    resend: (email: string) =>
        api.post('/auth/resend-verification', { email }),
}

// ── Public schedule slots ─────────────────────────────────────────────────────
export const scheduleSlotsApi = {
    getBookedSlots: (listingId: string) =>
        api.get<{ scheduledAt: string; status: string }[]>(`/schedules/listing/${listingId}/slots`),
}
