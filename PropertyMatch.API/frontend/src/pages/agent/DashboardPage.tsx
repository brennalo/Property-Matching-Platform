import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api";
import {
  Building2,
  CreditCard,
  CalendarCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  PlusCircle,
  DollarSign,
  Coins,
} from "lucide-react";

interface DashboardData {
  profile: {
    fullName: string;
    email: string;
    status: string;
    tokenBalance: number;
  };
  listings: {
    active: number;
    pendingPayment: number;
    draft: number;
    inactive: number;
  };
  appointments: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
  };
  upcomingViewings: Array<{
    listingId: string;
    listingName: string;
    scheduledAt: string;
    status: string;
    tenantName: string;
  }>;
  topListings: Array<{
    listingId: string;
    listingName: string;
    appointmentCount: number;
  }>;
  pendingPayments: Array<{
    id: string;
    name: string;
    price: number;
    createdAt: string;
  }>;
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          flexShrink: 0,
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: "1.8rem",
            fontFamily: "DM Serif Display, serif",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function AgentDashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["agent-dashboard"],
    queryFn: () =>
      api.get("/agent/dashboard").then((r: { data: DashboardData }) => r.data), // ← type added
    refetchInterval: 30000,
  });

  if (isLoading)
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  if (!data) return <div>Failed to load dashboard</div>;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-MY", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <h1 className="page-title">Agent Dashboard</h1>
      <p className="page-sub">Welcome back, {data.profile.fullName}!</p>

      {/* Quick Stats */}
      <div className="grid-3 mb-6">
        <StatCard
          label="Active Listings"
          value={data.listings.active}
          icon={<Building2 size={20} />}
          color="#3db8a0"
        />
        <StatCard
          label="Pending Payment"
          value={data.listings.pendingPayment}
          icon={<DollarSign size={20} />}
          color="#e8a045"
        />
        <StatCard
          label="Upcoming Viewings"
          value={data.upcomingViewings.length}
          icon={<CalendarCheck size={20} />}
          color="#60a5fa"
        />
        <StatCard
          label="Total Appointments"
          value={data.appointments.total}
          icon={<Clock size={20} />}
          color="#a78bfa"
        />
        <StatCard
          label="Confirmed"
          value={data.appointments.confirmed}
          icon={<CheckCircle size={20} />}
          color="#34d399"
        />
        <StatCard
          label="Pending Confirmation"
          value={data.appointments.pending}
          icon={<AlertCircle size={20} />}
          color="#e8a045"
        />
      </div>

      <div className="grid-2 mb-6">
        {/* Pending Payment Reminders */}
        <div className="card">
          <h3
            style={{
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CreditCard size={18} /> Pending Payment Listings
          </h3>
          {data.pendingPayments.length === 0 ? (
            <p style={{ color: "var(--text-dim)" }}>
              No pending payments. Great job!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.pendingPayments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 10,
                    background: "var(--bg-input)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--accent)" }}>
                    RM {p.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                    Created {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                  <Link
                    to={`/agent/listings/${p.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 8, display: "inline-block" }}
                  >
                    Pay Now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Performing Listings */}
        <div className="card">
          <h3
            style={{
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <TrendingUp size={18} /> Most Requested Properties
          </h3>
          {data.topListings.length === 0 ? (
            <p style={{ color: "var(--text-dim)" }}>
              No appointments yet. Share your listings!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.topListings.map((t) => (
                <div
                  key={t.listingId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{t.listingName}</span>
                  <span className="badge badge-amber">
                    {t.appointmentCount} viewing
                    {t.appointmentCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Viewings */}
      <div className="card mb-6">
        <h3 style={{ marginBottom: 12 }}>📅 Upcoming Viewings (Next 7 Days)</h3>
        {data.upcomingViewings.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            No viewings scheduled. Promote your listings!
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Property
                  </th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Tenant</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Date & Time
                  </th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingViewings.map((v, idx) => (
                  <tr
                    key={idx}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "8px" }}>{v.listingName}</td>
                    <td style={{ padding: "8px" }}>{v.tenantName}</td>
                    <td style={{ padding: "8px" }}>
                      {formatDate(v.scheduledAt)}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <span
                        className={`badge ${v.status === "Confirmed" ? "badge-green" : v.status === "Cancelled" ? "badge-red" : "badge-amber"}`}
                      >
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>⚡ Quick Actions</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/agent/listings/new" className="btn btn-primary">
            <PlusCircle size={14} /> New Listing
          </Link>
          <Link to="/agent/availability" className="btn btn-outline">
            <CalendarCheck size={14} /> Set Availability
          </Link>
          <Link to="/agent/listings" className="btn btn-outline">
            <Building2 size={14} /> Manage Listings
          </Link>
          <Link to="/agent/calendar" className="btn btn-outline">
            <Clock size={14} /> View Calendar
          </Link>
          <Link to="/agent/topup" className="btn btn-outline">
            <Coins size={14} /> Top Up Tokens
          </Link>
        </div>
      </div>
    </div>
  );
}
