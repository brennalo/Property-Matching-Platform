import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "../../api";
import type { Feedback } from "../../types";

export default function AdminFeedbackPage() {
    const qc = useQueryClient();
    const [selected, setSelected] = useState<Feedback | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { data: feedbacks = [], isLoading } = useQuery<Feedback[]>({
        queryKey: ["admin-feedback"],
        queryFn: () => feedbackApi.getAll().then((r) => r.data),
    });

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            feedbackApi.updateStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin-feedback"] });
            showToast("Feedback status updated.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to update status.", "error"),
    });

    const statusBadge = (status: string) =>
        status === "Reviewed" ? "badge-green" : "badge-amber";

    return (
        <div>
            <h1 className="page-title">Tenant Feedback</h1>
            <p className="page-sub">View feedback submitted by tenants and update review status</p>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: 60 }}>
                    <span className="spinner" />
                </div>
            ) : feedbacks.length === 0 ? (
                <div className="empty-state">No feedback submitted yet</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {feedbacks.map((f) => (
                        <div
                            className="card"
                            key={f.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => setSelected(f)}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                        style={{
                                            marginBottom: 8,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {f.description}
                                    </p>

                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                        From: {f.tenantName} ({f.tenantEmail}) -{" "}
                                        {new Date(f.createdAt).toLocaleString("en-MY")}
                                    </div>
                                </div>

                                <div
                                    className="flex gap-2 items-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span className={`badge ${statusBadge(f.status)}`}>
                                        {f.status}
                                    </span>

                                    {f.status !== "Reviewed" && (
                                        <button
                                            className="btn btn-sm btn-primary"
                                            disabled={statusMut.isPending}
                                            onClick={() =>
                                                statusMut.mutate({ id: f.id, status: "Reviewed" })
                                            }
                                        >
                                            Mark Reviewed
                                        </button>
                                    )}

                                    {f.status === "Reviewed" && (
                                        <button
                                            className="btn btn-sm btn-outline"
                                            disabled={statusMut.isPending}
                                            onClick={() =>
                                                statusMut.mutate({ id: f.id, status: "Open" })
                                            }
                                        >
                                            Reopen
                                        </button>
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
                />
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
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
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 650 }}
            >
                <h2 style={{ marginBottom: 8 }}>Feedback Details</h2>

                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
                    From: {feedback.tenantName} ({feedback.tenantEmail}) <br />
                    Status: {feedback.status} <br />
                    Submitted: {new Date(feedback.createdAt).toLocaleString("en-MY")}
                </div>

                <div
                    style={{
                        whiteSpace: "pre-wrap",
                        background: "var(--bg-input)",
                        padding: 14,
                        borderRadius: 8,
                        maxHeight: 360,
                        overflowY: "auto",
                    }}
                >
                    {feedback.description}
                </div>

                <div className="flex gap-3 mt-4">
                    <button className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}