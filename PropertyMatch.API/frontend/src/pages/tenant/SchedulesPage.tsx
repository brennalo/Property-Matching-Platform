import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewsApi, schedulesApi } from "../../api";
import { MapPin, Calendar, Clock } from "lucide-react";
import type { ScheduleStatus } from "../../types";
import ReviewModal from "../../components/ReviewModal";

const statusStyle: Record<ScheduleStatus, string> = {
    Pending: "badge-amber",
    Confirmed: "badge-green",
    Cancelled: "badge-red",
};

export default function TenantSchedulesPage() {
    const qc = useQueryClient();
    const [reviewTarget, setReviewTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ["my-schedules"],
        queryFn: () => schedulesApi.getMine().then((r) => r.data),
    });

    const [toast, setToast] = useState<{
        msg: string;
        type: "success" | "error";
    } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const upcoming = schedules.filter(
        (s) => new Date(s.scheduledAt) >= new Date(),
    );
    const past = schedules.filter((s) => new Date(s.scheduledAt) < new Date());

    const formatDt = (iso: string) => {
        const d = new Date(iso);
        return {
            date: d.toLocaleDateString("en-MY", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
            }),
            time: d.toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };
    };

    const ScheduleCard = ({ s }: { s: (typeof schedules)[0] }) => {
        const { date, time } = formatDt(s.scheduledAt);
        const isPastConfirmed =
            s.status === "Confirmed" && new Date(s.scheduledAt) < new Date();

        return (
            <div
                className="card"
                style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
            >
                {/* Date block */}
                <div
                    style={{
                        background: "var(--bg-input)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        textAlign: "center",
                        flexShrink: 0,
                        minWidth: 70,
                    }}
                >
                    <div
                        style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                        }}
                    >
                        {date.split(",")[0]}
                    </div>
                    <div
                        style={{
                            fontFamily: "DM Serif Display, serif",
                            fontSize: "1.6rem",
                            lineHeight: 1,
                        }}
                    >
                        {new Date(s.scheduledAt).getDate()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {new Date(s.scheduledAt).toLocaleString("en-MY", {
                            month: "short",
                        })}
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontWeight: 600 }}>{s.listingName}</span>
                        <span className={`badge ${statusStyle[s.status]}`}>{s.status}</span>
                    </div>
                    <div
                        style={{
                            fontSize: "0.82rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                        }}
                    >
                        <span>
                            <MapPin size={12} style={{ verticalAlign: "middle" }} />{" "}
                            {s.listingAddress}
                        </span>
                        <span>
                            <Clock size={12} style={{ verticalAlign: "middle" }} /> {time}
                        </span>
                    </div>
                    {s.status === "Cancelled" && s.reason && (
                        <div
                            style={{ fontSize: "0.78rem", color: "var(--red)", marginTop: 4 }}
                        >
                            Reason: {s.reason}
                        </div>
                    )}
                    {isPastConfirmed && (
                        <button
                            className="btn btn-outline btn-sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                                setReviewTarget({ id: s.id, name: s.listingName });
                            }}
                        >
                            Rate Agent
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading)
        return (
            <div style={{ textAlign: "center", padding: 60 }}>
                <span className="spinner" />
            </div>
        );

    return (
        <div>
            <h1 className="page-title">My Viewings</h1>
            <p className="page-sub">Track all your scheduled property visits</p>

            {schedules.length === 0 ? (
                <div className="empty-state">
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>📅</div>
                    <p style={{ fontWeight: 500 }}>No viewings scheduled yet</p>
                    <p style={{ marginTop: 4 }}>
                        Find a property and book a viewing from the results page
                    </p>
                </div>
            ) : (
                <>
                    {upcoming.length > 0 && (
                        <div style={{ marginBottom: 28 }}>
                            <h2
                                style={{
                                    fontSize: "1rem",
                                    color: "var(--text-muted)",
                                    marginBottom: 12,
                                }}
                            >
                                <Calendar
                                    size={14}
                                    style={{ verticalAlign: "middle", marginRight: 6 }}
                                />
                                Upcoming ({upcoming.length})
                            </h2>
                            <div
                                style={{ display: "flex", flexDirection: "column", gap: 10 }}
                            >
                                {upcoming.map((s, i) => (
                                    <ScheduleCard key={i} s={s} />
                                ))}
                            </div>
                        </div>
                    )}

                    {past.length > 0 && (
                        <div>
                            <h2
                                style={{
                                    fontSize: "1rem",
                                    color: "var(--text-muted)",
                                    marginBottom: 12,
                                }}
                            >
                                Past Viewings ({past.length})
                            </h2>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    opacity: 0.6,
                                }}
                            >
                                {past.map((s, i) => (
                                    <ScheduleCard key={i} s={s} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {reviewTarget && (
                <ReviewModal
                    viewingScheduleId={reviewTarget.id}
                    title={`Rate Agent for ${reviewTarget.name}`}
                    onClose={() => setReviewTarget(null)}
                    onSuccess={() => {
                        qc.invalidateQueries({ queryKey: ["my-schedules"] });
                        showToast("Review submitted successfully!", "success");
                    }}
                />
            )}
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}
