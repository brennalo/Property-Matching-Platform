import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "../../api";
import type { Feedback } from "../../types";
import { Send } from "lucide-react";

const statusBadge = (status: string) => {
    if (status === "Reviewed") return "badge-green";
    if (status === "Commented") return "badge-green";
    return "badge-amber";
};

function timeAgo(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 365) return `${days} day${days > 1 ? "s" : ""} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? "s" : ""} ago`;
}

export default function AdminFeedbackPage() {
    const qc = useQueryClient();
    const [selected, setSelected] = useState<Feedback | null>(null);
    const [filter, setFilter] = useState<"" | "open" | "reviewed" | "commented">("");
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { data: feedbacks = [], isLoading } = useQuery<Feedback[]>({
        queryKey: ["admin-feedback"],
        queryFn: () => feedbackApi.getAll().then((r) => r.data),
    });

    const filteredFeedbacks = feedbacks.filter((f) => {
        if (filter === "open") return f.status === "Open";
        if (filter === "reviewed") return f.status === "Reviewed";
        if (filter === "commented") return f.status === "Commented";
        return true;
    });

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            feedbackApi.updateStatus(id, status),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["admin-feedback"] });
            setSelected((prev) =>
                prev && prev.id === variables.id
                    ? { ...prev, status: variables.status }
                    : prev
            );
            showToast("Feedback status updated.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to update status.", "error"),
    });

    const commentMut = useMutation({
        mutationFn: ({ id, adminComment }: { id: string; adminComment: string }) =>
            feedbackApi.updateComment(id, adminComment),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["admin-feedback"] });
            setSelected((prev) =>
                prev && prev.id === variables.id
                    ? { ...prev, status: "Commented", adminComment: variables.adminComment }
                    : prev
            );
            showToast("Comment saved and feedback marked as commented.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to save comment.", "error"),
    });

    const handleReplySend = (feedbackId: string) => {
        const comment = replyDrafts[feedbackId]?.trim();
        if (!comment) return;

        commentMut.mutate({
            id: feedbackId,
            adminComment: comment,
        });

        setReplyDrafts((prev) => ({
            ...prev,
            [feedbackId]: "",
        }));
    };

    return (
        <div>
            <h1 className="page-title">Tenant Feedback</h1>
            <p className="page-sub">View feedback submitted by tenants</p>

            <div className="flex gap-2 mb-5" style={{ flexWrap: "wrap" }}>
                {(["", "open", "reviewed", "commented"] as const).map((item) => (
                    <button
                        key={item || "all"}
                        className={`btn btn-sm ${filter === item ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setFilter(item)}
                    >
                        {item === "open" ? "Unread" : item === "reviewed" ? "Reviewed" : item === "commented" ? "Commented" : "All"}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: 60 }}>
                    <span className="spinner" />
                </div>
            ) : filteredFeedbacks.length === 0 ? (
                <div className="empty-state">
                    {filter ? `No ${filter} feedback found` : "No feedback submitted yet"}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {filteredFeedbacks.map((f) => (
                        <div
                            key={f.id}
                            className="card"
                            style={{
                                cursor: "pointer",
                                padding: 22,
                                borderRadius: 18,
                            }}
                            onClick={() => setSelected(f)}
                        >
                            <div style={{ display: "flex", gap: 16 }}>
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        background: "var(--bg-input)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontFamily: "DM Serif Display, serif",
                                        fontSize: "1.1rem",
                                        color: "var(--accent)",
                                    }}
                                >
                                    {f.tenantName.charAt(0).toUpperCase()}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            <strong>{f.tenantName}</strong>
                                            <span style={{ color: "var(--text-dim)" }}><span>&bull;</span></span>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                {timeAgo(f.createdAt)}
                                            </span>
                                        </div>

                                        {(f.status === "Reviewed" || f.status === "Commented") && (
                                            <span className={`badge ${statusBadge(f.status)}`}>
                                                {f.status}
                                            </span>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            margin: "16px 0 10px",
                                            fontSize: "1.15rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {f.subject}
                                    </div>

                                    <p
                                        style={{
                                            margin: 0,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.6,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {f.description}
                                    </p>

                                    {f.status !== "Commented" && (
                                        <div
                                            style={{
                                                borderTop: "1px solid var(--border)",
                                                marginTop: 18,
                                                paddingTop: 14,
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "center",
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                className="input"
                                                value={replyDrafts[f.id] ?? ""}
                                                onChange={(e) =>
                                                    setReplyDrafts((prev) => ({
                                                        ...prev,
                                                        [f.id]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Reply feedback..."
                                                style={{ flex: 1 }}
                                            />

                                            <button
                                                className="btn btn-primary"
                                                disabled={!replyDrafts[f.id]?.trim()}
                                                onClick={() => handleReplySend(f.id)}
                                                style={{
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius: "50%",
                                                    padding: 0,
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <Send size={17} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selected && (
                <FeedbackModal
                    feedback={selected}
                    onClose={() => setSelected(null)}
                    onUpdateStatus={(status) =>
                        statusMut.mutate({ id: selected.id, status })
                    }
                    loading={statusMut.isPending}
                />
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}

function FeedbackModal({
    feedback,
    onClose,
    onUpdateStatus,
    loading,
}: {
    feedback: Feedback;
    onClose: () => void;
    onUpdateStatus: (status: string) => void;
    loading: boolean;
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 700, padding: 0, overflow: "hidden" }}
            >
                <div
                    style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 style={{ margin: 0, marginBottom: 8 }}>
                                {feedback.subject}
                            </h2>
                        </div>

                        {(feedback.status === "Reviewed" || feedback.status === "Commented") && (
                            <span className={`badge ${statusBadge(feedback.status)}`}>
                                {feedback.status}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ padding: 24, maxHeight: "60vh", overflowY: "auto" }}>
                    <div
                        style={{
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.7,
                            background: "var(--bg-input)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 16,
                        }}
                    >
                        {feedback.description}
                    </div>

                    {feedback.status === "Commented" && feedback.adminComment && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{ fontWeight: 600, marginBottom: 10 }}>
                                Admin Comment
                            </div>

                            <div
                                style={{
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 12,
                                    padding: 16,
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.6,
                                }}
                            >
                                {feedback.adminComment}
                            </div>
                        </div>
                    )}
                </div>

                <div
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    {feedback.status === "Open" && (
                        <button
                            className="btn btn-primary"
                            disabled={loading}
                            onClick={() => onUpdateStatus("Reviewed")}
                        >
                            Mark Reviewed
                        </button>
                    )}

                    <button className="btn btn-outline" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}