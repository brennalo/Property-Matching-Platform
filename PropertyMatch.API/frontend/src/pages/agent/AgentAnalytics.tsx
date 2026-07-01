import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentApi } from "../../api";
import {
  Eye,
  CalendarCheck,
  CheckCircle,
  Clock,
  Ban,
  Search,
  TrendingUp,
} from "lucide-react";

export default function AgentAnalyticsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: analytics = [], isLoading } = useQuery({
    queryKey: ["agent-listing-analytics"],
    queryFn: () => agentApi.getListingAnalytics().then((r) => r.data ?? []),
  });

  const filteredAnalytics = analytics.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <div className="empty-state">
        <p>No listings found. Create your first listing to see analytics.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Listing Analytics</h1>
      <p className="page-sub">
        View performance metrics for each of your properties
      </p>

      {/* ── Explanation Card ── */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
        }}
      >
        <h4 style={{ fontSize: "0.9rem", marginBottom: 6 }}>
          📊 How to read these metrics
        </h4>
        <ul
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            margin: 0,
            paddingLeft: 20,
          }}
        >
          <li>
            <strong>Views</strong> – Number of times tenants viewed your
            listing.
          </li>
          <li>
            <strong>Bookings</strong> – Total viewing requests (Pending +
            Confirmed + Cancelled).
          </li>
          <li>
            <strong>Confirmed</strong> – Viewings that were approved by you.
          </li>
          <li>
            <strong>Pending</strong> – Viewings waiting for your response.
          </li>
          <li>
            <strong>Cancelled</strong> – Viewings that were cancelled (by either
            party).
          </li>
          <li>
            <strong>Interest Rate</strong> –{" "}
            <strong>(Bookings ÷ Views) × 100</strong>. Shows what percentage of
            views resulted in a booking request. Higher = more engaging listing
            (good photos, description, price).
          </li>
          <li>
            <strong>Booking Success</strong> –{" "}
            <strong>(Confirmed ÷ Views) × 100</strong>. Shows what percentage of
            views resulted in a confirmed viewing. Higher = effective listing +
            responsive agent.
          </li>
        </ul>
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-dim)",
            }}
          />
          <input
            className="input"
            type="text"
            placeholder="Search by property name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <span
          style={{
            fontSize: "0.78rem",
            color: "var(--text-dim)",
            marginTop: 4,
            display: "block",
          }}
        >
          {filteredAnalytics.length} of {analytics.length} listings shown
        </span>
      </div>

      {/* ── Analytics Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "10px 8px" }}>
                Listing
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <Eye size={16} /> Views
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <CalendarCheck size={16} /> Bookings
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <CheckCircle size={16} /> Confirmed
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <Clock size={16} /> Pending
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <Ban size={16} /> Cancelled
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <TrendingUp size={16} /> Interest Rate
              </th>
              <th style={{ textAlign: "center", padding: "10px 8px" }}>
                <CheckCircle size={16} /> Booking Success
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAnalytics.map((item) => {
              const interestRate =
                item.viewCount > 0
                  ? ((item.bookingCount / item.viewCount) * 100).toFixed(1)
                  : "0.0";

              const successRate =
                item.viewCount > 0
                  ? ((item.confirmedCount / item.viewCount) * 100).toFixed(1)
                  : "0.0";

              return (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 8px", fontWeight: 500 }}>
                    {item.name}
                  </td>
                  <td style={{ textAlign: "center", padding: "10px 8px" }}>
                    {item.viewCount}
                  </td>
                  <td style={{ textAlign: "center", padding: "10px 8px" }}>
                    {item.bookingCount}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      color: "var(--teal)",
                    }}
                  >
                    {item.confirmedCount}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      color: "var(--accent)",
                    }}
                  >
                    {item.pendingCount}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      color: "var(--red)",
                    }}
                  >
                    {item.cancelledCount}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      fontWeight: 600,
                      color:
                        interestRate === "0.0"
                          ? "var(--text-dim)"
                          : "var(--text)",
                    }}
                  >
                    {interestRate}%
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "10px 8px",
                      fontWeight: 600,
                      color:
                        successRate === "0.0"
                          ? "var(--text-dim)"
                          : "var(--teal)",
                    }}
                  >
                    {successRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
