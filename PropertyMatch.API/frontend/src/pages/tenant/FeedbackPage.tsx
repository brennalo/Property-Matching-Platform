import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { feedbackApi } from "../../api";
import type { Feedback } from "../../types";

export default function TenantFeedbackPage() {
    const [description, setDescription] = useState("");
    const [selected, setSelected] = useState<Feedback | null>(null);
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
        mutationFn: () => feedbackApi.submit(description),
        onSuccess: () => {
            setDescription("");
            refetch();
            showToast("Feedback submitted successfully.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to submit feedback.", "error"),
    });

    const statusBadge = (status: string) =>
        status === "Reviewed" ? "badge-green" : "badge-amber";

    return (
        <div>
            <h1 className="page-title">Feedback</h1>
            <p className="page-sub">Share your feedback with the admin team</p>

            <div className="card mb-6">
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
                    disabled={!description.trim() || submitMut.isPending}
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
                                {f.description}
                            </p>

                            <span className={`badge ${statusBadge(f.status)}`}>
                                {f.status}
                            </span>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                            Submitted: {new Date(f.createdAt).toLocaleString("en-MY")}
                        </div>
                    </div>
                ))
            )}

            {selected && (
                <FeedbackModal feedback={selected} onClose={() => setSelected(null)} />
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