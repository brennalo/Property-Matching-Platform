import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { conversationsApi, reviewsApi, reportApi } from "../../api";
import type { ConversationSummaryResponse, MessageResponse } from "../../types";
import ReviewModal from "../../components/ReviewModal";
import { MessageSquare, Send } from "lucide-react";

export default function ConversationsPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    // Review modal state
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [reportTarget, setReportTarget] = useState<ConversationSummaryResponse | null>(null);
    const [reportText, setReportText] = useState("");
    const [reportFiles, setReportFiles] = useState<File[]>([]);
    const [showReportSuccess, setShowReportSuccess] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: "success" | "error";
    } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { data: convs = [] } = useQuery<ConversationSummaryResponse[]>({
        queryKey: ["conversations"],
        queryFn: () => conversationsApi.getAll().then((r) => r.data),
        refetchInterval: 10000,
    });

    const { data: messages = [] } = useQuery<MessageResponse[]>({
        queryKey: ["messages", selectedId],
        queryFn: () =>
            conversationsApi.getMessages(selectedId!).then((r) => r.data),
        enabled: !!selectedId,
        refetchInterval: 5000,
    });

    const sendMut = useMutation({
        mutationFn: (content: string) =>
            conversationsApi.sendMessage(selectedId!, content),
        onSuccess: () => {
            setDraft("");
            qc.invalidateQueries({ queryKey: ["messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["conversations"] });
        },
    });

    const reportMut = useMutation({
        mutationFn: () =>
            reportApi.submit({
                item: "agent",
                itemId: reportTarget!.agentId,
                description: reportText,
                files: reportFiles,
            }),
        onSuccess: () => {
            setShowReport(false);
            setReportTarget(null);
            setReportText("");
            setReportFiles([]);
            setShowReportSuccess(true);
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to submit report.", "error"),
    });

    const closeReportModal = () => {
        setShowReport(false);
        setReportTarget(null);
        setReportText("");
        setReportFiles([]);
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const selectedConversation = convs.find((c) => c.id === selectedId);

    return (
        <div
            style={{
                display: "flex",
                height: "calc(100vh - 60px)",
                overflow: "hidden",
            }}
        >
            {/* Conversation list */}
            <div
                style={{
                    width: 300,
                    borderRight: "1px solid var(--border)",
                    overflowY: "auto",
                    background: "var(--bg-card)",
                }}
            >
                <div
                    style={{
                        padding: "16px 16px 8px",
                        fontSize: "1rem",
                        fontWeight: 700,
                    }}
                >
                    <MessageSquare size={16} style={{ marginRight: 8 }} />
                    Conversations
                </div>
                {convs.length === 0 && (
                    <p
                        style={{
                            padding: 16,
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                        }}
                    >
                        No conversations yet.
                    </p>
                )}
                {convs.map((c: ConversationSummaryResponse) => (
                    <div
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        style={{
                            padding: "12px 16px",
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border)",
                            background:
                                selectedId === c.id ? "var(--bg-hover)" : "transparent",
                        }}
                    >
                        <div
                            style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 2 }}
                        >
                            {c.listingName}
                            {c.unreadCount > 0 && (
                                <span
                                    className="badge badge-amber"
                                    style={{ marginLeft: 8, fontSize: "0.7rem" }}
                                >
                                    {c.unreadCount}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {user?.role === "Tenant"
                                ? `Agent: ${c.agentName}`
                                : `Tenant: ${c.tenantName}`}
                        </div>
                        {c.lastMessage && (
                            <div
                                style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-muted)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 220,
                                }}
                            >
                                {c.lastMessage}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Message area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {!selectedId ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                        }}
                    >
                        Select a conversation to start messaging
                    </div>
                ) : (
                    <>
                        {/* Header with Rate Agent button */}
                        <div
                            style={{
                                padding: "12px 20px",
                                borderBottom: "1px solid var(--border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "var(--bg-card)",
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {selectedConversation?.listingName}
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    {user?.role === "Tenant"
                                        ? `Agent: ${selectedConversation?.agentName}`
                                        : `Tenant: ${selectedConversation?.tenantName}`}
                                </div>
                            </div>
                            {user?.role === "Tenant" && (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                    }}
                                >
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => setShowReviewModal(true)}
                                    >
                                        Rate Agent
                                    </button>

                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => {
                                            if (selectedConversation) {
                                                setReportTarget(selectedConversation);
                                                setShowReport(true);
                                            }
                                        }}
                                    >
                                        Report
                                    </button>
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: 20,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                            }}
                        >
                            {messages.map((m: MessageResponse) => {
                                const isMe = m.senderId === user?.userId;
                                return (
                                    <div
                                        key={m.id}
                                        style={{
                                            display: "flex",
                                            justifyContent: isMe ? "flex-end" : "flex-start",
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: "70%",
                                                padding: "10px 14px",
                                                borderRadius: 12,
                                                background: isMe ? "var(--accent)" : "var(--bg-card)",
                                                color: isMe ? "var(--text)" : "var(--text)",
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            <div>{m.content}</div>
                                            <div
                                                style={{
                                                    fontSize: "0.7rem",
                                                    opacity: 0.6,
                                                    marginTop: 4,
                                                    textAlign: isMe ? "right" : "left",
                                                }}
                                            >
                                                {new Date(m.createdAt).toLocaleTimeString("en-MY", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>
                        <div
                            style={{
                                padding: "12px 16px",
                                borderTop: "1px solid var(--border)",
                                display: "flex",
                                gap: 10,
                            }}
                        >
                            <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Type a message..."
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && draft.trim())
                                        sendMut.mutate(draft.trim());
                                }}
                            />
                            <button
                                className="btn btn-primary"
                                disabled={!draft.trim() || sendMut.isPending}
                                onClick={() => {
                                    if (draft.trim()) sendMut.mutate(draft.trim());
                                }}
                            >
                                <Send size={15} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Review Modal */}
            {showReviewModal && selectedId && (
                <ReviewModal
                    conversationId={selectedId}
                    title="Rate Agent for this conversation"
                    onClose={() => setShowReviewModal(false)}
                    onSuccess={() => {
                        qc.invalidateQueries({ queryKey: ["conversations"] });
                        showToast("Review submitted successfully!", "success");
                    }}
                />
            )}
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            {showReportSuccess && (
                <div className="modal-overlay" onClick={() => setShowReportSuccess(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✅</div>
                        <h2 style={{ marginBottom: 8 }}>Report Submitted</h2>
                        <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                            Thank you for reaching to us. Your report has been submitted to the admin team for review.
                        </p>
                        <button className="btn btn-primary" onClick={() => setShowReportSuccess(false)}>
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReport && reportTarget && (
                <div className="modal-overlay" onClick={closeReportModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 8 }}>Report Agent</h2>
                        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                            Report: {reportTarget.agentName}
                        </p>

                        <textarea
                            className="input"
                            rows={6}
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                            placeholder="Describe the issue with this agent..."
                        />

                        <div className="flex gap-3 mt-4">
                            <button className="btn btn-outline" onClick={closeReportModal}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                disabled={!reportText.trim() || reportFiles.length < 1 || reportFiles.length > 3 || reportMut.isPending}
                                onClick={() => reportMut.mutate()}
                            >
                                {reportMut.isPending ? <span className="spinner" /> : "Submit Report"}
                            </button>
                        </div>

                        <div className="form-group mt-4">
                            <label className="form-label">Evidence Images</label>
                            <input
                                className="input"
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => {
                                    const selected = Array.from(e.target.files ?? []);

                                    if (selected.length > 3) {
                                        showToast("You can upload up to 3 images only.", "error");
                                        e.target.value = "";
                                        return;
                                    }

                                    setReportFiles(selected);
                                }}
                            />

                            {reportFiles.length > 0 && (
                                <ul
                                    style={{
                                        marginTop: 8,
                                        fontSize: "0.8rem",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    {reportFiles.map((file) => (
                                        <li key={file.name}>{file.name}</li>
                                    ))}
                                </ul>
                            )}

                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                                Required. You can upload up to 3 files at once (JPG, PNG, or WebP only).
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
