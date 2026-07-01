import React from "react";
import { useQuery } from "@tanstack/react-query";
import { reviewsApi } from "../../api";
import { Star } from "lucide-react";
import type { ReviewResponse } from "../../types";

export default function AgentReviewsPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["agent-reviews"],
        queryFn: () => reviewsApi.getAgentReviews().then((r) => r.data),
    });

    if (isLoading)
        return (
            <div style={{ textAlign: "center", padding: 60 }}>
                <span className="spinner" />
            </div>
        );
    if (!data) return null;

    return (
        <div>
            <h1 className="page-title">My Reviews</h1>
            <p className="page-sub">See what tenants say about your service</p>

            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        style={{
                            fontSize: "2.5rem",
                            fontFamily: "DM Serif Display, serif",
                        }}
                    >
                        {data.averageRating.toFixed(1)}
                    </div>
                    <div>
                        <div style={{ display: "flex", gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star
                                    key={i}
                                    size={18}
                                    fill={
                                        i <= Math.round(data.averageRating)
                                            ? "var(--accent)"
                                            : "none"
                                    }
                                    color="#ea580c"
                                />
                            ))}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            {data.totalReviews} review{data.totalReviews !== 1 ? "s" : ""}
                        </div>
                    </div>
                </div>
            </div>

            {data.reviews.length === 0 ? (
                <div className="empty-state">No reviews yet.</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.reviews.map((r: ReviewResponse) => (
                        <div key={r.id} className="card">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>{r.listingName}</div>
                                    <div
                                        style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                                    >
                                        by {r.agentName} (tenant)
                                    </div>
                                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Star
                                                key={i}
                                                size={14}
                                                fill={i <= r.rating ? "var(--accent)" : "none"}
                                                color="#ea580c"
                                            />
                                        ))}
                                    </div>
                                    {r.reviewText && (
                                        <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
                                            {r.reviewText}
                                        </p>
                                    )}
                                </div>
                                <span
                                    className="badge badge-grey"
                                    style={{ fontSize: "0.7rem" }}
                                >
                                    {r.source}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: "0.7rem",
                                    color: "var(--text-dim)",
                                    marginTop: 8,
                                }}
                            >
                                {new Date(r.createdAt).toLocaleDateString("en-MY", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
