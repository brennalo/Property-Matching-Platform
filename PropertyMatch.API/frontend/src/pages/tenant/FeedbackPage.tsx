import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { feedbackApi } from "../../api";
import type { Feedback } from "../../types";

export default function TenantFeedbackPage() {
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [selected, setSelected] = useState<Feedback | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { data: feedbacks = [], refetch } = useQuery<Feedback[]>({
        queryKey: ["my-feedback"],
        queryFn: () => feedbackApi.getMine().then((r) => r.data),
    });

    const submitMut = useMutation({
        mutationFn: () => feedbackApi.submit(subject, description),
        onSuccess: () => {
            setSubject("");
            setDescription("");
            refetch();
            setShowSuccess(true);
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to submit feedback.", "error"),
    });

    const statusBadge = (status: string) => {
        if (status === "Reviewed") return "badge-green";
        if (status === "Commented") return "badge-green";
        return "badge-amber";
    };

    // Helper functions for Date formats
    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleString("en-MY", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    return (
        <div>
            <h1 className="page-title">Feedback</h1>
            <p className="page-sub">Share your feedback with the admin team</p>

            <div className="card mb-6">
                <div className="form-group mb-4">
                    <label className="form-label">Subject</label>
                    <input
                        className="input"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Search results issue"
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Your Feedback</label>
                    <textarea
                        className="input"
                        rows={6}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write your feedback here..."
                    />
                </div>

                <button
                    className="btn btn-primary mt-4"
                    disabled={!subject.trim() || !description.trim() || submitMut.isPending}
                    onClick={() => submitMut.mutate()}
                >
                    {submitMut.isPending ? <span className="spinner" /> : "Submit Feedback"}
                </button>
            </div>

            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Feedback History</h2>

            {feedbacks.length === 0 ? (
                <div className="empty-state">No feedback submitted yet</div>
            ) : (
                feedbacks.map((f) => (
                    <div
                        className="card mb-4"
                        key={f.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelected(f)}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p
                                style={{
                                    margin: 0,
                                    flex: 1,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                }}
                            >
                                {f.subject}
                            </p>
                        </div>

                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                marginTop: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <span>
                                Submitted: {formatDate(f.createdAt)}
                            </span>

                            {(f.status === "Reviewed" || f.status === "Commented") && (
                                <span className={`badge ${statusBadge(f.status)}`}>
                                    {f.status}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            )}

            {selected && (
                <FeedbackModal feedback={selected} onClose={() => setSelected(null)} />
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            {showSuccess && (
                <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✅</div>
                        <h2 style={{ marginBottom: 8 }}>Feedback Submitted</h2>
                        <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                            Thank you for sharing your feedback. The admin team will review it soon.
                        </p>
                        <button className="btn btn-primary" onClick={() => setShowSuccess(false)}>
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function FeedbackModal({
    feedback,
    onClose,
}: {
    feedback: Feedback;
    onClose: () => void;
}) {
    const statusBadge = (status: string) => {
        {
            feedback.status === "Commented" && feedback.adminComment && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>
                        Admin Comment
                    </div>

                    <div
                        style={{
                            background: "var(--green-dim)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 16,
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.6,
                            color: "var(--text)","
                        }}
                    >
                        {feedback.adminComment}
                    </div>
                </div>
            )
        }
        if (status === "Reviewed") return "badge-green";
        if (status === "Commented") return "badge-green";
        return "badge-amber";
    };

    function formatFullDate(dateString: string) {
        const date = new Date(dateString);

        const day = date.getDate();
        const month = date.toLocaleString("en-MY", { month: "long" });
        const year = date.getFullYear();

        const time = date.toLocaleString("en-MY", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        return `${day} ${month} ${year} at ${time}`;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: 700,
                    padding: 0,
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "24px",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 16,
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                    marginBottom: 6,
                                }}
                            >
                                {feedback.subject}
                            </h2>

                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-muted)",
                                }}
                            >
                                Submitted on {formatFullDate(feedback.createdAt)}
                            </div>
                        </div>

                        {(feedback.status === "Reviewed" ||
                            feedback.status === "Commented") && (
                                <span
                                    className={`badge ${statusBadge(feedback.status)}`}
                                >
                                    {feedback.status}
                                </span>
                            )
                        }
                    </div>
                </div>

                {/* Content */}
                <div
                    style={{
                        padding: 24,
                        maxHeight: "65vh",
                        overflowY: "auto",
                    }}
                >
                    {/* Status Notice */}
                    {feedback.status === "Open" && (
                        <div
                            style={{
                                background: "rgba(245,158,11,.08)",
                                border: "1px solid rgba(245,158,11,.2)",
                                color: "#f59e0b",
                                padding: 14,
                                borderRadius: 12,
                                marginBottom: 20,
                            }}
                        >
                            ⏳ Your feedback has been submitted and is awaiting
                            review.
                        </div>
                    )}

                    {feedback.status === "Reviewed" && (
                        <div
                            style={{
                                background: "rgba(59,130,246,.08)",
                                border: "1px solid rgba(59,130,246,.2)",
                                color: "#3b82f6",
                                padding: 14,
                                borderRadius: 12,
                                marginBottom: 20,
                            }}
                        >
                            👀 An administrator has reviewed your feedback.
                        </div>
                    )}

                    {feedback.status === "Commented" && (
                        <div
                            style={{
                                background: "rgba(34,197,94,.08)",
                                border: "1px solid rgba(34,197,94,.2)",
                                color: "#22c55e",
                                padding: 14,
                                borderRadius: 12,
                                marginBottom: 20,
                            }}
                        >
                            ✅ An administrator has responded to your feedback.
                        </div>
                    )}

                    {/* Timeline */}
                    <div
                        style={{
                            marginBottom: 24,
                            padding: 16,
                            borderRadius: 12,
                            background: "var(--bg-input)",
                        }}
                    >
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 12,
                            }}
                        >
                            Status Timeline
                        </div>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                color: "var(--text-muted)",
                            }}
                        >
                            <div>✓ Feedback Submitted</div>

                            {(feedback.status === "Reviewed" ||
                                feedback.status === "Commented") && (
                                    <div>✓ Reviewed by Admin</div>
                                )}

                            {feedback.status === "Commented" && (
                                <div>✓ Admin Response Sent</div>
                            )}
                        </div>
                    </div>

                    {/* User Feedback */}
                    <div style={{ marginBottom: 20 }}>
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 10,
                            }}
                        >
                            Your Feedback
                        </div>

                        <div
                            style={{
                                background: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                borderRadius: 14,
                                padding: 16,
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.7,
                            }}
                        >
                            {feedback.description}
                        </div>
                    </div>

                    {/* Admin Comment */}
                    <div>
                        <div
                            style={{
                                fontWeight: 600,
                                marginBottom: 10,
                            }}
                        >
                            Admin Response
                        </div>

                        {feedback.adminComment ? (
                            <div
                                style={{
                                    background:
                                        "rgb(35, 34, 32)",
                                    border:
                                        "1px solid rgba(34,197,94,0.2)",
                                    borderRadius: 14,
                                    padding: 16,
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.7,
                                }}
                            >
                                {feedback.adminComment}
                            </div>
                        ) : (
                            <div
                                style={{
                                    border: "1px dashed var(--border)",
                                    borderRadius: 14,
                                    padding: 20,
                                    textAlign: "center",
                                    color: "var(--text-muted)",
                                }}
                            >
                                ⏳ No response from the admin team.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: "18px 24px",
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        className="btn btn-primary"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}