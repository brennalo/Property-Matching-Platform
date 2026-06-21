import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { configApi, authVerifyApi } from "./api";
import { initGoogleMaps } from "./hooks/useGoogleMaps";
import VerifyEmailBanner from "./components/VerifyEmailBanner";
import "./index.css";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EmailVerifiedPage from "./pages/EmailVerifiedPage";
import SearchPage from "./pages/tenant/SearchPage";
import ResultsPage from "./pages/tenant/ResultsPage";
import ListingDetailPage from "./pages/tenant/ListingDetailPage";
import LifestylePage from "./pages/tenant/LifestylePage";
import TenantSchedulesPage from "./pages/tenant/SchedulesPage";
import AgentListingsPage from "./pages/agent/ListingsPage";
import AgentListingDetailPage from "./pages/agent/ListingDetailPage";
import AgentAvailabilityPage from "./pages/agent/AvailabilityPage";
import AgentCalendarPage from "./pages/agent/CalendarPage";
import AgentDashboardPage from "./pages/agent/DashboardPage";
import AdminDashboardPage from "./pages/admin/DashboardPage";
import AdminAgentsPage from "./pages/admin/AgentsPage";
import TokenTopUpPage from "./pages/agent/TokenTopUpPage";
import PaymentSuccessPage from "./pages/agent/PaymentSuccessPage";
import PaymentCancelPage from "./pages/agent/PaymentCancelPage";
import AdminTenantsPage from "./pages/admin/TenantsPage";
import BrowsePage from "./pages/BrowsePage";
import FavouritesPage from "./pages/tenant/FavouritesPage";
import HistoryPage from "./pages/tenant/HistoryPage";
import ConversationsPage from "./pages/tenant/ConversationsPage";
import AgentConversationsPage from "./pages/agent/ConversationsPage";

import {
  Search,
  Heart,
  Calendar,
  List,
  BarChart3,
  Users,
  LogOut,
  Building2,
  Menu,
  Coins,
  MessageSquare,
  Clock,
  Star,
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
} from "lucide-react";
import AgentReviewsPage from "./pages/agent/ReviewsPage";
import AgentAnalyticsPage from "./pages/agent/AgentAnalytics";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Loads the Google Maps script ONCE after fetching the key from the backend.
function GoogleMapsBootstrap() {
  const { data } = useQuery({
    queryKey: ["maps-key"],
    queryFn: () => configApi.getMapsKey().then((r) => r.data),
    staleTime: Infinity,
    retry: 3,
  });
  useEffect(() => {
    if (data?.key) initGoogleMaps(data.key);
  }, [data?.key]);
  return null;
}

// ── ProtectedRoute ────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: string[];
  requireVerified?: boolean; // default true for most pages
}

function ProtectedRoute({
  children,
  roles,
  requireVerified = true,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <span className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  // Blocked users: always bounce to login
  if (user.status === "Blocked") return <Navigate to="/login" replace />;

  // Pending (unverified email): only SearchPage is accessible for tenants;
  // for agents, all pages require verification.
  if (requireVerified && user.status === "Pending") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: "center",
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: "40px 36px",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 10 }}>
            Verify your email first
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              marginBottom: 20,
            }}
          >
            Check your inbox for the verification link we sent when you
            registered. You need to verify your email before accessing this
            page.
          </p>
          <ResendFromBlockedPage email={user.email} />
        </div>
      </div>
    );
  }

  return children;
}

// Small inline helper to resend from the blocked page
function ResendFromBlockedPage({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      <button
        className="btn btn-outline"
        disabled={sent || loading}
        onClick={async () => {
          setLoading(true);
          try {
            await authVerifyApi.resend(email);
          } catch {
            /* always success */
          }
          setLoading(false);
          setSent(true);
        }}
      >
        {sent ? (
          "✅ Email sent"
        ) : loading ? (
          <span className="spinner" />
        ) : (
          "Resend verification link"
        )}
      </button>
      <a href="/login" className="btn btn-ghost">
        Sign out
      </a>
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tenantLinks = [
    { to: "/search", icon: <Search size={16} />, label: "Find a Home" },
    {
      to: "/lifestyle",
      icon: <Heart size={16} />,
      label: "Lifestyle Templates",
    },
    { to: "/my-schedules", icon: <Calendar size={16} />, label: "My Viewings" },
    { to: "/favourites", icon: <Heart size={16} />, label: "Saved Listings" },
    { to: "/history", icon: <Clock size={16} />, label: "History" },
    {
      to: "/conversations",
      icon: <MessageSquare size={16} />,
      label: "Messages",
    },
  ];
  const agentLinks = [
    {
      to: "/agent/dashboard",
      icon: <LayoutDashboard size={16} />,
      label: "Dashboard",
    },
    { to: "/agent/listings", icon: <List size={16} />, label: "My Listings" },
    {
      to: "/agent/availability",
      icon: <CalendarCheck size={16} />,
      label: "My Availability",
    },
    {
      to: "/agent/calendar",
      icon: <Clock size={16} />,
      label: "Viewing Calendar",
    },
    {
      to: "/agent/topup",
      icon: <Coins size={16} />,
      label: "Top Up Tokens",
    },
    {
      to: "/agent/conversations",
      icon: <MessageSquare size={16} />,
      label: "Messages",
    },
    {
      to: "/agent/analytics",
      icon: <BarChart3 size={16} />,
      label: "Listing Analytics",
    },
    {
      to: "/agent/reviews",
      icon: <Star size={16} />,
      label: "Reviews & Ratings",
    },
  ];
  const adminLinks = [
    {
      to: "/admin/dashboard",
      icon: <BarChart3 size={16} />,
      label: "Analytics",
    },
    { to: "/admin/agents", icon: <Users size={16} />, label: "Agents" },
    { to: "/admin/tenants", icon: <Users size={16} />, label: "Tenants" },
  ];

  const links =
    user?.role === "Tenant"
      ? tenantLinks
      : user?.role === "Agent"
        ? agentLinks
        : adminLinks;

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="topbar-logo-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--accent)",
            fontSize: "1.1rem",
            fontWeight: 600,
            padding: 0,
          }}
        >
          <Building2 size={18} />
          PropertyMatch
        </button>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {user?.fullName}
            <span
              className={`badge badge-${user?.role === "Admin" ? "amber" : user?.role === "Agent" ? "green" : "grey"}`}
              style={{ marginLeft: 8 }}
            >
              {user?.role}
            </span>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Verification banner — spans full width below topbar */}
      <VerifyEmailBanner />

      {/* Sidebar drawer overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            {l.icon} {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}

// ── Root redirect ────────────────────────────────────────────────────────

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Tenant") return <Navigate to="/search" replace />;
  if (user.role === "Agent") return <Navigate to="/agent/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

// ── App ──────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleMapsBootstrap />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/email-verified" element={<EmailVerifiedPage />} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/browse" element={<BrowsePage />} />
            {/* Tenant — SearchPage accessible even when Pending */}
            <Route
              path="/search"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified={false}>
                  <AppShell>
                    <SearchPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/results"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified={false}>
                  <AppShell>
                    <ResultsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/listing/:id"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified={false}>
                  <AppShell>
                    <ListingDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Tenant — require verified for booking/lifestyle */}
            <Route
              path="/lifestyle"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified>
                  <AppShell>
                    <LifestylePage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-schedules"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified>
                  <AppShell>
                    <TenantSchedulesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/favourites"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified>
                  <AppShell>
                    <FavouritesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified>
                  <AppShell>
                    <HistoryPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conversations"
              element={
                <ProtectedRoute roles={["Tenant"]} requireVerified>
                  <AppShell>
                    <ConversationsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Agent — all require verified */}
            <Route
              path="/agent/listings"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentListingsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/listings/:id"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentListingDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/availability"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentAvailabilityPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/conversations"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentConversationsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/calendar"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentCalendarPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/dashboard"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentDashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/topup"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <TokenTopUpPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/agent/analytics"
              element={
                <ProtectedRoute roles={["Agent"]}>
                  <AppShell>
                    <AgentAnalyticsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/payment-cancel" element={<PaymentCancelPage />} />
            <Route
              path="/agent/reviews"
              element={
                <ProtectedRoute roles={["Agent"]} requireVerified>
                  <AppShell>
                    <AgentReviewsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={["Admin"]}>
                  <AppShell>
                    <AdminDashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agents"
              element={
                <ProtectedRoute roles={["Admin"]}>
                  <AppShell>
                    <AdminAgentsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tenants"
              element={
                <ProtectedRoute roles={["Admin"]}>
                  <AppShell>
                    <AdminTenantsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
