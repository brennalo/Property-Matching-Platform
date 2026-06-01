import axios from "axios";
import type {
  AuthUser,
  Listing,
  MatchedListing,
  LifestyleTemplate,
  ViewingSchedule,
  MatchRequest,
  Analytics,
  AgentDetail,
  AgentStatus,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send httpOnly cookies
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
  }) => api.post("/auth/register", data),

  login: (email: string, password: string) =>
    api.post<AuthUser>("/auth/login", { email, password }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<AuthUser>("/auth/me"),
};

// ── Listings ──────────────────────────────────────────────────────────────────
export const listingsApi = {
  getAll: () => api.get<Listing[]>("/listings"),

  getMine: () => api.get<Listing[]>("/listings/mine"),

  getById: (id: string) => api.get<Listing>(`/listings/${id}`),

  create: (data: {
    name: string;
    rooms: number;
    toilets: number;
    lat: number;
    lng: number;
    address: string;
    residencyType: string;
    price: number;
  }) => api.post<{ id: string; message: string }>("/listings", data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      rooms: number;
      toilets: number;
      lat: number;
      lng: number;
      address: string;
      residencyType: string;
      price: number;
    }>,
  ) => api.put(`/listings/${id}`, data),

  uploadImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return api.post<{ urls: string[] }>(`/listings/${id}/images`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  delete: (id: string) => api.delete(`/listings/${id}`),
};

// ── Match ─────────────────────────────────────────────────────────────────────
export const matchApi = {
  search: (req: MatchRequest) => api.post<MatchedListing[]>("/match", req),
};

// ── Lifestyle Templates ───────────────────────────────────────────────────────
export const templatesApi = {
  getAll: () => api.get<LifestyleTemplate[]>("/lifestyle-templates"),

  create: (name: string, placeTypes: string[]) =>
    api.post<LifestyleTemplate>("/lifestyle-templates", { name, placeTypes }),

  update: (id: string, name: string, placeTypes: string[]) =>
    api.put<LifestyleTemplate>(`/lifestyle-templates/${id}`, {
      name,
      placeTypes,
    }),

  delete: (id: string) => api.delete(`/lifestyle-templates/${id}`),
};

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedulesApi = {
  create: (listingId: string, scheduledAt: Date) =>
    api.post("/schedules", {
      listingId,
      scheduledAt: scheduledAt.toISOString(),
    }),

  getMine: () => api.get<ViewingSchedule[]>("/schedules/mine"),

  getAgentSchedules: () => api.get<ViewingSchedule[]>("/schedules/agent"),

  updateStatus: (listingId: string, scheduledAt: string, status: string) =>
    api.patch(
      `/schedules/${listingId}/${encodeURIComponent(scheduledAt)}`,
      JSON.stringify(status),
      {
        headers: { "Content-Type": "application/json" },
      },
    ),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  createCheckout: (listingId: string) =>
    api.post<{ checkoutUrl: string; sessionId: string }>("/payments/checkout", {
      listingId,
    }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  getAnalytics: () => api.get<Analytics>("/admin/analytics"),

  getAgents: (status?: AgentStatus) =>
    api.get<AgentDetail[]>("/admin/agents", {
      params: status ? { status } : {},
    }),

  updateAgentStatus: (agentId: string, status: AgentStatus) =>
    api.put(`/admin/agents/${agentId}/status`, { status }),

  getAllListings: () => api.get("/admin/listings"),
};

export default api;
