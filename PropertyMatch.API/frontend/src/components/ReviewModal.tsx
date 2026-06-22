import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { reviewsApi } from "../api";

interface ReviewModalProps {
  viewingScheduleId?: string;
  conversationId?: string;
  title: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReviewModal({
  viewingScheduleId,
  conversationId,
  title,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingReview, setExistingReview] = useState<any>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Fetch existing review when modal opens
  useEffect(() => {
    const fetchReview = async () => {
      if (!viewingScheduleId && !conversationId) return;
      try {
        const params: any = {};
        if (viewingScheduleId) params.viewingScheduleId = viewingScheduleId;
        if (conversationId) params.conversationId = conversationId;
        const res = await reviewsApi.getBySource(params);
        setExistingReview(res.data);
        setRating(res.data.rating);
        setReviewText(res.data.reviewText || "");
      } catch (e: any) {
        // 404 means no review yet – that's fine
        if (e.response?.status !== 404) {
          setError("Failed to load existing review.");
        }
      } finally {
        setIsLoadingExisting(false);
      }
    };
    fetchReview();
  }, [viewingScheduleId, conversationId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (existingReview) {
        // Update existing review
        await reviewsApi.update(existingReview.id, { rating, reviewText });
      } else {
        // Create new review
        await reviewsApi.create({
          rating,
          reviewText,
          viewingScheduleId,
          conversationId,
        });
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          style={{ maxWidth: 450, textAlign: "center", padding: 30 }}
        >
          <span className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 450 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          {existingReview
            ? "Update your rating and review."
            : "Share your experience with the agent."}
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onMouseEnter={() => setHoverRating(num)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(num)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <Star
                size={28}
                fill={(hoverRating || rating) >= num ? "var(--accent)" : "none"}
                color="var(--accent)"
              />
            </button>
          ))}
        </div>

        <textarea
          className="input"
          placeholder="Write your review (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={4}
          style={{ width: "100%", marginBottom: 12 }}
        />

        {error && (
          <p
            style={{
              color: "var(--red)",
              fontSize: "0.85rem",
              marginBottom: 12,
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={rating === 0 || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <span className="spinner" />
            ) : existingReview ? (
              "Update Review"
            ) : (
              "Submit Review"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
