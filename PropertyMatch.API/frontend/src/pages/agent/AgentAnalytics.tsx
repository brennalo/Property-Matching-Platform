import React from "react";
import { useQuery } from "@tanstack/react-query";
import { agentApi } from "../../api";
import { Eye, CalendarCheck, CheckCircle, Clock, Ban } from "lucide-react";

export default function AgentAnalyticsPage() {
    const { data: analytics = [], isLoading } = useQuery({
        queryKey: ["agent-listing-analytics"],
        queryFn: () => agentApi.getListingAnalytics().then((r) => r.data ?? []),
    });

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
                                Conversion
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {analytics.map((item) => {
                            const conversion =
                                item.viewCount > 0
                                    ? ((item.bookingCount / item.viewCount) * 100).toFixed(1)
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
                                        }}
                                    >
                                        {conversion}%
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
