import { useEffect, useState, useRef } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    NavLink,
    useNavigate,
    useLocation,
} from "react-router-dom";
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AuthModalProvider } from "./hooks/useAuthModal";
import { configApi, authVerifyApi, conversationsApi } from "./api";
import { initGoogleMaps } from "./hooks/useGoogleMaps";
import VerifyEmailBanner from "./components/VerifyEmailBanner";
import "./index.css";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EmailVerifiedPage from "./pages/EmailVerifiedPage";
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
import ScoringConfigPage from "./pages/tenant/ScoringConfigPage";
import TenantFeedbackPage from "./pages/tenant/FeedbackPage";
import AdminFeedbackPage from "./pages/admin/FeedbackPage";
import AdminReportsPage from "./pages/admin/ReportsPage";
import {
    Search,
    Heart,
    Calendar,
    List,
    BarChart3,
    Users,
    LogOut,
    Building2,
    Coins,
    MessageSquare,
    Clock,
    Star,
    CalendarCheck,
    ClipboardCheck,
    LayoutDashboard,
    Building,
    Settings,
    Flag,
    ChevronDown,
    LogIn,
    UserPlus,
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
    const location = useLocation();

    useEffect(() => {
        if (user) {
            localStorage.setItem("lastPath", location.pathname);
        }
    }, [location.pathname, user]);

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

    // Pending (unverified email): only Browse/Search is accessible for tenants;
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

// ── AppShell (top nav only — no sidebar) ────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { data: convs = [] } = useQuery<Array<{ unreadCount: number }>>({
        queryKey: ["conversations"],
        queryFn: () => conversationsApi.getAll().then((r) => r.data),
        enabled: user?.role === "Tenant" || user?.role === "Agent",
        refetchInterval: 15000,
    });
    const totalUnread = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

    const tenantLinks = [
        { to: "/lifestyle", icon: <Heart size={16} />, label: "Lifestyle Templates" },
        { to: "/my-schedules", icon: <Calendar size={16} />, label: "My Viewings" },
        { to: "/favourites", icon: <Heart size={16} />, label: "Saved Listings" },
        { to: "/history", icon: <Clock size={16} />, label: "History" },
        { to: "/conversations", icon: <MessageSquare size={16} />, label: "Messages" },
        { to: "/feedback", icon: <MessageSquare size={16} />, label: "Feedback" },
        { to: "/scoring-config", icon: <Settings size={16} />, label: "Match Settings" },
    ];
    const agentLinks = [
        { to: "/agent/dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
        { to: "/agent/listings", icon: <List size={16} />, label: "My Listings" },
        { to: "/agent/availability", icon: <CalendarCheck size={16} />, label: "My Availability" },
        { to: "/agent/calendar", icon: <Clock size={16} />, label: "Viewing Calendar" },
        { to: "/agent/topup", icon: <Coins size={16} />, label: "Top Up Tokens" },
        { to: "/agent/conversations", icon: <MessageSquare size={16} />, label: "Messages" },
        { to: "/agent/analytics", icon: <BarChart3 size={16} />, label: "Listing Analytics" },
        { to: "/agent/reviews", icon: <Star size={16} />, label: "Reviews & Ratings" },
    ];
    const adminLinks = [
        { to: "/admin/dashboard", icon: <BarChart3 size={16} />, label: "Analytics" },
        { to: "/admin/agents", icon: <Users size={16} />, label: "Agents" },
        { to: "/admin/tenants", icon: <Users size={16} />, label: "Tenants" },
        { to: "/admin/feedback", icon: <MessageSquare size={16} />, label: "Feedback" },
        { to: "/admin/reports", icon: <Flag size={16} />, label: "Reports" },
    ];

    const links =
        user?.role === "Tenant" ? tenantLinks
            : user?.role === "Agent" ? agentLinks
                : user?.role === "Admin" ? adminLinks
                    : [];

    // Close the dropdown on outside click
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const homeTo = !user
        ? "/browse"
        : user.role === "Tenant" ? "/browse"
            : user.role === "Agent" ? "/agent/dashboard"
                : "/admin/dashboard";

    const initial = user?.fullName?.trim()?.[0]?.toUpperCase() ?? "?";

    return (
        <div className="app-shell">
            <header className="topbar">
                <button
                    className="topbar-logo-toggle"
                    onClick={() => navigate(homeTo)}
                    aria-label="Go to home"
                >
                    <Building2 size={20} />
                    PropertyMatch
                </button>

                {/* Public top-level nav for guests/tenants — Browse is the landing page for everyone */}
                <nav className="topbar-nav">
                    {(!user || user.role === "Tenant") && (
                        <NavLink to="/browse" className={({ isActive }) => `topbar-link${isActive ? " active" : ""}`}>
                            <Building size={15} /> Browse
                        </NavLink>
                    )}
                </nav>

                <div className="topbar-actions">
                    {!user ? (
                        <>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>
                                <LogIn size={14} /> Login
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate("/register")}>
                                <UserPlus size={14} /> Register
                            </button>
                        </>
                    ) : (
                        <div className="account-menu" ref={menuRef}>
                            <button className="account-trigger" onClick={() => setMenuOpen((o) => !o)}>
                                <span className="account-avatar">{initial}</span>
                                <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.fullName}
                                </span>
                                <ChevronDown size={14} />
                            </button>
                            {menuOpen && (
                                <div className="account-dropdown">
                                    <div style={{ padding: "6px 12px 10px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.fullName}</div>
                                        <span className={`badge badge-${user.role === "Admin" ? "amber" : user.role === "Agent" ? "green" : "blue"}`} style={{ marginTop: 4 }}>
                                            {user.role}
                                        </span>
                                    </div>
                                    {links.map((l) => {
                                        const isMessages = l.to === "/conversations" || l.to === "/agent/conversations";
                                        return (
                                            <NavLink
                                                key={l.to}
                                                to={l.to}
                                                onClick={() => setMenuOpen(false)}
                                                className={({ isActive }) => `account-dropdown-link${isActive ? " active" : ""}`}
                                            >
                                                {l.icon} {l.label}
                                                {isMessages && totalUnread > 0 && (
                                                    <span
                                                        style={{
                                                            marginLeft: "auto",
                                                            background: "var(--primary)",
                                                            color: "#fff",
                                                            borderRadius: "999px",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 700,
                                                            padding: "1px 6px",
                                                            minWidth: 18,
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        {totalUnread > 99 ? "99+" : totalUnread}
                                                    </span>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                    <div className="divider" style={{ margin: "6px 0" }} />
                                    <button
                                        className="account-dropdown-link"
                                        style={{ width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left", color: "var(--red)" }}
                                        onClick={async () => {
                                            localStorage.removeItem("lastPath");
                                            setMenuOpen(false);
                                            await logout();
                                            navigate("/browse");
                                        }}
                                    >
                                        <LogOut size={16} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Verification banner — spans full width below topbar */}
            <VerifyEmailBanner />

            <main className="main-content">{children}</main>
        </div>
    );
}

// ── Root redirect ────────────────────────────────────────────────────────

function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return null;

    // Guests land on the public Browse page now, not on a login wall.
    if (!user) return <Navigate to="/browse" replace />;

    const lastPath = localStorage.getItem("lastPath");
    if (lastPath && lastPath !== "/" && lastPath !== "/login") {
        return <Navigate to={lastPath} replace />;
    }

    if (user.role === "Tenant") return <Navigate to="/browse" replace />;
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
                    <AuthModalProvider>
                        <Routes>
                            {/* Public */}
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/email-verified" element={<EmailVerifiedPage />} />
                            <Route path="/" element={<RootRedirect />} />

                            {/* Browse is the public landing page — open to guests AND tenants.
                                It now also contains the expandable search panel
                                (previously the separate /search page). */}
                            <Route
                                path="/browse"
                                element={
                                    <AppShell>
                                        <BrowsePage />
                                    </AppShell>
                                }
                            />
                            {/* Legacy deep link — old /search route now lives inside Browse */}
                            <Route path="/search" element={<Navigate to="/browse" replace />} />

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

                            {/* Listing detail — open to guests AND tenants. Gated actions
                                (favourite, schedule, message) prompt login inside the page. */}
                            <Route
                                path="/listing/:id"
                                element={
                                    <AppShell>
                                        <ListingDetailPage />
                                    </AppShell>
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
                            <Route
                                path="/feedback"
                                element={
                                    <ProtectedRoute roles={["Tenant"]} requireVerified>
                                        <AppShell>
                                            <TenantFeedbackPage />
                                        </AppShell>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/scoring-config"
                                element={
                                    <ProtectedRoute roles={["Tenant"]} requireVerified>
                                        <AppShell>
                                            <ScoringConfigPage />
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
                            <Route
                                path="/admin/feedback"
                                element={
                                    <ProtectedRoute roles={["Admin"]}>
                                        <AppShell>
                                            <AdminFeedbackPage />
                                        </AppShell>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/admin/reports"
                                element={
                                    <ProtectedRoute roles={["Admin"]}>
                                        <AppShell>
                                            <AdminReportsPage />
                                        </AppShell>
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </AuthModalProvider>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}
