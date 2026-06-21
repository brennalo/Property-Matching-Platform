import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { conversationsApi, reviewsApi } from "../../api";
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

  const submitReview = useMutation({
    mutationFn: ({
      rating,
      reviewText,
      conversationId,
    }: {
      rating: number;
      reviewText: string;
      conversationId: string;
    }) => reviewsApi.create({ rating, reviewText, conversationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setShowReviewModal(false);
      setReviewLoading(false);
      showToast("Review submitted successfully!", "success");
    },
    onError: (error: any) => {
      setReviewLoading(false);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to submit review";
      showToast(message, "error");
    },
  });

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
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowReviewModal(true)}
                >
                  Rate Agent
                </button>
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
                        color: isMe ? "#0f0f0e" : "var(--text)",
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
          title="Rate Agent for this conversation"
          onClose={() => setShowReviewModal(false)}
          onSubmit={(rating, reviewText) => {
            setReviewLoading(true);
            submitReview.mutate({
              rating,
              reviewText,
              conversationId: selectedId,
            });
          }}
          loading={reviewLoading}
        />
      )}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
