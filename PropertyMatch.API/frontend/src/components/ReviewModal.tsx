import React, { useState } from "react";
import { Star } from "lucide-react";

export default function ReviewModal({
  onClose,
  onSubmit,
  loading,
  title = "Rate Your Experience",
}: {
  onClose: () => void;
  onSubmit: (rating: number, reviewText: string) => void;
  loading: boolean;
  title?: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

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
          Share your experience with the agent.
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

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={rating === 0 || loading}
            onClick={() => onSubmit(rating, reviewText)}
          >
            {loading ? <span className="spinner" /> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
