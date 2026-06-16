// frontend/src/pages/admin/DashboardPage.tsx
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Users,
  Building2,
  CalendarCheck,
  CreditCard,
  UserX,
  UserCheck,
  DollarSign,
  TrendingUp,
} from "lucide-react";

// Types for analytics data
interface TopListing {
  listingId: string;
  listingName: string;
  agentName: string;
  appointmentCount: number;
}

interface MonthlyRevenue {
  year: number;
  month: number;
  total: number;
}

interface AgentPerformance {
  agentName: string;
  listingCount: number;
  appointmentCount: number;
  revenue: number;
}

interface ListingStatusItem {
  status: string;
  count: number;
}

interface AvgPriceItem {
  type: string;
  avgPrice: number;
  count: number;
}

interface ConversionRate {
  totalListings: number;
  paidListings: number;
  conversionRate: number;
}

// Stat card component
function StatCard({ label, value, icon, color, sub }: any) {
  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "flex-start", gap: 16 }}
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
            fontFamily: "DM Serif Display, serif",
            fontSize: "2rem",
            lineHeight: 1,
          }}
        >
          {value.toLocaleString()}
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-dim)",
              marginTop: 2,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const dataPoint = payload[0].payload;
  const dataName = dataPoint?.name ?? label ?? dataPoint?.type;
  const dataValue = payload[0].value;
  const dataKey = payload[0].dataKey;

  // Determine the label based on the dataKey
  let valueLabel = "Value";
  if (dataKey === "revenue") valueLabel = "Revenue (RM)";
  else if (dataKey === "price") valueLabel = "Average Rent (RM)";
  else if (dataKey === "value") valueLabel = "Count";
  else if (dataKey === "appointmentCount") valueLabel = "Appointments";
  else if (dataKey === "count") valueLabel = "Listings";

  const isCurrency = dataKey === "revenue" || dataKey === "price";
  const formattedValue = isCurrency
    ? `RM ${Number(dataValue).toLocaleString()}`
    : Number(dataValue).toLocaleString();

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 16px",
        fontSize: "0.85rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        minWidth: "160px",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--accent)",
          marginBottom: 6,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 4,
        }}
      >
        {dataName}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "baseline",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>{valueLabel}:</span>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>
          {formattedValue}
        </span>
      </div>
      {/* Extra info for the price bar chart (active listings count) */}
      {dataPoint?.count !== undefined && dataKey === "price" && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 6,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Active Listings:</span>
          <span style={{ fontWeight: 500, color: "var(--text)" }}>
            {dataPoint.count}
          </span>
        </div>
      )}
    </div>
  );
};

export default function AdminDashboardPage() {
  // Basic analytics (existing)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => adminApi.getAnalytics().then((r) => r.data),
    refetchInterval: 30000,
  });

  // New analytics
  const { data: topListings } = useQuery<TopListing[]>({
    queryKey: ["topListings"],
    queryFn: () => adminApi.getTopListings(5).then((r) => r.data),
  });

  const { data: revenue } = useQuery<MonthlyRevenue[]>({
    queryKey: ["monthlyRevenue"],
    queryFn: () => adminApi.getMonthlyRevenue().then((r) => r.data),
  });

  const { data: agents } = useQuery<AgentPerformance[]>({
    queryKey: ["agentPerformance"],
    queryFn: () => adminApi.getAgentPerformance(5).then((r) => r.data),
  });

  const { data: listingStatus } = useQuery<ListingStatusItem[]>({
    queryKey: ["listingStatus"],
    queryFn: () => adminApi.getListingStatus().then((r) => r.data),
  });

  const { data: avgPriceByType } = useQuery<AvgPriceItem[]>({
    queryKey: ["avgPriceByType"],
    queryFn: () => adminApi.getAvgPriceByType().then((r) => r.data),
  });

  const { data: conversion } = useQuery<ConversionRate>({
    queryKey: ["conversionRate"],
    queryFn: () => adminApi.getConversionRate().then((r) => r.data),
  });

  if (statsLoading)
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <span className="spinner" />
      </div>
    );
  if (!stats) return null;

  // Prepare data for charts
  const revenueData =
    revenue?.map((r: MonthlyRevenue) => ({
      name: `${r.year}-${r.month}`,
      revenue: r.total,
    })) ?? [];
  const statusData =
    listingStatus?.map((s: ListingStatusItem) => ({
      name: s.status,
      value: s.count,
    })) ?? [];
  const priceData =
    avgPriceByType?.map((p: AvgPriceItem) => ({
      type: p.type,
      price: p.avgPrice,
      count: p.count,
    })) ?? [];

  const COLORS = ["#3db8a0", "#e8a045", "#a78bfa", "#60a5fa", "#e05c5c"];

  return (
    <div>
      <h1 className="page-title">Analytics Dashboard</h1>
      <p className="page-sub">Platform overview with advanced metrics</p>

      {/* Existing KPI cards */}
      <div className="grid-3 mb-6">
        <StatCard
          label="Total Agents"
          value={stats.totalAgents}
          icon={<UserCheck size={20} />}
          color="#e8a045"
        />
        <StatCard
          label="Registered Tenants"
          value={stats.totalUsers}
          icon={<Users size={20} />}
          color="#3db8a0"
        />
        <StatCard
          label="Total Listings"
          value={stats.totalListings}
          icon={<Building2 size={20} />}
          color="#a78bfa"
        />
        <StatCard
          label="Scheduled Viewings"
          value={stats.totalSchedules}
          icon={<CalendarCheck size={20} />}
          color="#60a5fa"
        />
        <StatCard
          label="Payments Received"
          value={stats.totalPayments}
          icon={<CreditCard size={20} />}
          color="#34d399"
          sub="Listing activation fees"
        />
        <StatCard
          label="Blocked Agents"
          value={stats.blockedAgents}
          icon={<UserX size={20} />}
          color="#e05c5c"
        />
      </div>

      {/* Conversion Rate KPI card */}
      <div
        className="card mb-6"
        style={{
          background: "linear-gradient(135deg, var(--accent) 0%, #2d8a76 100%)",
          color: "#0f0f0e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <TrendingUp size={32} />
          <div>
            <div
              style={{
                fontFamily: "DM Serif Display, serif",
                fontSize: "2rem",
                lineHeight: 1,
              }}
            >
              {conversion ? conversion.conversionRate.toFixed(1) : "—"}%
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
              Payment Conversion Rate
            </div>
            <div style={{ fontSize: "0.75rem" }}>
              {conversion
                ? `${conversion.paidListings} / ${conversion.totalListings} listings activated`
                : "Loading..."}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-6">
        {/* Monthly Revenue Chart */}
        <div className="card">
          <h3>Monthly Revenue (RM)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueData}>
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)" }} />
              <YAxis tick={{ fill: "var(--text-muted)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Listing Status Pie Chart */}
        <div className="card">
          <h3>Listing Status Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {statusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2 mb-6">
        {/* Top Listings by Appointments */}
        <div className="card">
          <h3>Most Requested Properties</h3>
          {topListings?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 4px" }}>
                      Property
                    </th>
                    <th style={{ textAlign: "left", padding: "8px 4px" }}>
                      Agent
                    </th>
                    <th style={{ textAlign: "right", padding: "8px 4px" }}>
                      Appointments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topListings?.map((item: TopListing, idx: number) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "8px 4px" }}>{item.listingName}</td>
                      <td style={{ padding: "8px 4px" }}>{item.agentName}</td>
                      <td style={{ textAlign: "right", padding: "8px 4px" }}>
                        {item.appointmentCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No data yet</p>
          )}
        </div>

        {/* Average Price by Property Type */}
        <div className="card">
          <h3>Average Monthly Rent (by Type)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priceData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tick={{ fill: "var(--text-muted)" }} />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ fill: "var(--text-muted)" }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(0,0,0,0.05)" }}
              />
              <Bar dataKey="price" fill="var(--accent)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="card">
        <h3>Top Performing Agents</h3>
        {agents?.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Agent</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>
                    Active Listings
                  </th>
                  <th style={{ textAlign: "right", padding: "8px" }}>
                    Total Appointments
                  </th>
                  <th style={{ textAlign: "right", padding: "8px" }}>
                    Revenue (RM)
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents?.map((agent: AgentPerformance, idx: number) => (
                  <tr
                    key={idx}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "8px" }}>{agent.agentName}</td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {agent.listingCount}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {agent.appointmentCount}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      RM {agent.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No agent data yet</p>
        )}
      </div>
    </div>
  );
}
