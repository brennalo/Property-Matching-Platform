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
  TenantDetail,
  UserStatus,
  AvailabilityTemplate,
  AvailabilityException,
  AvailabilityTemplateRequest,
  AvailabilityExceptionRequest,
  AvailableSlot,
  BatchListingRow,
  ListingStatus,
  ImageDto,
  ScoringConfigRequest,
  ScoringConfig,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send httpOnly cookies
});

// ── Auth ────────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (
    email: string,
    password: string,
    fullName: string,
    role: string,
    licenseNumber?: string,
  ) =>
    api.post("/auth/register", {
      email,
      password,
      fullName,
      role,
      licenseNumber,
    }),

  login: (email: string, password: string) =>
    api.post<AuthUser>("/auth/login", { email, password }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<AuthUser>("/auth/me"),
};

// ── Listings ────────────────────────────────────────────────────────────────────────
export const listingsApi = {
  getAll: () => api.get<Listing[]>("/listings"),

  getMine: () => api.get<Listing[]>("/listings/mine"),

  getById: (id: string) => api.get<Listing>(`/listings/${id}`),

  updateStatus: (id: string, status: ListingStatus) =>
      api.patch(`/listings/${id}/status`, { status }),

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

  // Batch upload (XLSX)
  batchCreate: (listings: BatchListingRow[]) =>
    api.post("/listings/batch", listings),

  // Reorder images
  reorderImages: (
    id: string,
    order: Array<{ imageId: string; displayOrder: number }>,
  ) => api.put(`/listings/${id}/images/reorder`, order),

  // Update image caption
  updateImageCaption: (id: string, imageId: string, caption: string) =>
    api.put(`/listings/${id}/images/${imageId}/caption`, { caption }),

  // Delete single image
  deleteImage: (id: string, imageId: string) =>
    api.delete(`/listings/${id}/images/${imageId}`),

  delete: (id: string) => api.delete(`/listings/${id}`),
};

// ── Match ────────────────────────────────────────────────────────────────────────
export const matchApi = {
  search: (req: MatchRequest) => api.post<MatchedListing[]>("/match", req),
};

// ── Lifestyle Templates ────────────────────────────────────────────────────────────
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

// ── Schedules ──────────────────────────────────────────────────────────────────────
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

// ── Availability Template and Exception ──────────────────────────────────────────────────────────────────
export const availabilityApi = {
  // Agent endpoints
  getSummary: () =>
    api.get<{
      templates: AvailabilityTemplate[];
      exceptions: AvailabilityException[];
    }>("/availability/summary"),

  addTemplates: (
    templates: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotDurationMinutes?: number;
      validFrom?: string | null;
      validTo?: string | null;
      listingId?: string | null;
    }>,
  ) => api.post("/availability/templates", templates),

  addExceptions: (
    exceptions: Array<{
      exceptionFrom: string;
      exceptionTo: string;
      type: "blocked" | "custom_hours";
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
      listingId?: string | null;
    }>,
  ) => api.post("/availability/exceptions", exceptions),

  deleteTemplate: (id: string) => api.delete(`/availability/templates/${id}`),
  deleteException: (id: string) => api.delete(`/availability/exceptions/${id}`),

  // Tenant endpoint
  getSlots: (listingId: string, from: Date, to: Date) =>
    api.get<AvailableSlot[]>(
      `/availability/slots?listingId=${listingId}&from=${from.toISOString()}&to=${to.toISOString()}`,
    ),
};

// ── Payments ────────────────────────────────────────────────────────────────────────
export const paymentsApi = {
  // Old per-listing checkout (kept for backward compat)
  createCheckout: (listingId: string) =>
    api.post<{ checkoutUrl: string; sessionId: string }>("/payments/checkout", {
      listingId,
    }),

  // New token top-up
  createTokenCheckout: (agentId: string, tokenAmount: number) =>
    api.post<{ sessionId: string; url: string }>(
      "/payments/create-checkout-session",
      { agentId, tokenAmount },
    ),

  getTokenBalance: () =>
    api.get<{ tokenBalance: number }>("/payments/token-balance"),
};

// ── Admin ──────────────────────────────────────────────────────────────────────────
export const adminApi = {
  getAnalytics: () => api.get<Analytics>("/admin/analytics"),
  getTopListings: (top = 10) =>
    api.get(`/admin/analytics/top-listings?top=${top}`),
  getMonthlyRevenue: () => api.get("/admin/analytics/monthly-revenue"),
  getAgentPerformance: (top = 10) =>
    api.get(`/admin/analytics/agent-performance?top=${top}`),
  getListingStatus: () => api.get("/admin/analytics/listing-status"),
  getAvgPriceByType: () => api.get("/admin/analytics/avg-price-by-type"),
    getConversionRate: () => api.get("/admin/analytics/conversion-rate"),
  getTenants: (status?: UserStatus) =>
    api.get<TenantDetail[]>('/admin/tenants', { params: { status } }),

    updateTenantStatus: (id: string, status: UserStatus) =>
    api.put(`/admin/tenants/${id}/status`, { status }),

  getAgents: (status?: UserStatus) =>
    api.get<AgentDetail[]>("/admin/agents", {
      params: status ? { status } : {},
    }),

  updateAgentStatus: (agentId: string, status: UserStatus) =>
    api.put(`/admin/agents/${agentId}/status`, { status }),

  getAllListings: () => api.get("/admin/listings"),
};

export default api;

// ── Config ──────────────────────────────────────────────────────────────────────────
export const configApi = {
  getMapsKey: () => api.get<{ key: string }>("/config/maps-key"),
};

// ── Email verification ──────────────────────────────────────────────────────────────
export const authVerifyApi = {
  resend: (email: string) => api.post("/auth/resend-verification", { email }),
};

// ── Public schedule slots ────────────────────────────────────────────────────────────
export const scheduleSlotsApi = {
  getBookedSlots: (listingId: string) =>
    api.get<{ scheduledAt: string; status: string }[]>(
      `/schedules/listing/${listingId}/slots`,
    ),
};

// ── Favourites ────────────────────────────────────────────────────────────────
export const favouritesApi = {
    getAll: () => api.get('/favourites'),
    add: (listingId: string) => api.post(`/favourites/${listingId}`),
    remove: (listingId: string) => api.delete(`/favourites/${listingId}`),
    getStatus: (listingId: string) => api.get<{ saved: boolean }>(`/favourites/${listingId}/status`),
};

// ── Search History ─────────────────────────────────────────────────────────────
export const searchHistoryApi = {
    getAll: () => api.get('/search-history'),
    save: (snapshot: string) => api.post('/search-history', { snapshot }),
};

// ── View History ───────────────────────────────────────────────────────────────
export const viewHistoryApi = {
    getAll: () => api.get('/view-history'),
    track: (listingId: string) => api.post(`/view-history/${listingId}`),
};

// ── Conversations ──────────────────────────────────────────────────────────────
export const conversationsApi = {
    open: (listingId: string) =>
        api.post<{ conversationId: string }>('/conversations/open', { listingId }),
    getAll: () => api.get('/conversations'),
    getMessages: (conversationId: string) =>
        api.get(`/conversations/${conversationId}/messages`),
    sendMessage: (conversationId: string, content: string) =>
        api.post(`/conversations/${conversationId}/messages`, { content }),
};

// ── Browse (public landing page) ───────────────────────────────────────────────
export const browseApi = {
    getListings: () => api.get('/browse/listings'),
};

// ── Agent public profile ───────────────────────────────────────────────────────
export const agentApi = {
    getPublicProfile: (agentId: string) => api.get(`/agents/${agentId}/public`),
};

export const scoringConfigApi = {
    get: () => api.get<ScoringConfig>('/admin/scoring-config'),
    update: (req: ScoringConfigRequest) => api.put('/admin/scoring-config', req),
}