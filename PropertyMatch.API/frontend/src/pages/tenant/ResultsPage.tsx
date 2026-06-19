import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchedListing } from "../../types";
import {
  ArrowLeft,
  Clock,
  Bed,
  Bath,
  MapPin,
  ChevronRight,
} from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const r = 26,
    cx = 32,
    cy = 32,
    stroke = 4;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#3db8a0" : score >= 40 ? "#e8a045" : "#e05c5c";

  return (
    <div className="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="score-ring-label" style={{ color }}>
        {score.toFixed(0)}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<MatchedListing[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("matchResults");
    if (!raw) {
      navigate("/search");
      return;
    }
    setResults(JSON.parse(raw));
  }, []);

  const formatPrice = (p: number) => `RM ${p.toLocaleString()}/mo`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/search")}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Matched Properties
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            {results.length} results · ranked by lifestyle fit
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <p>
            No properties matched your criteria. Try broadening your search.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map((r, i) => (
            <div
              key={`${r.listing.id}-${i}`}
              className="card"
              onClick={() => navigate(`/listing/${r.listing.id}`)}
              style={{ cursor: "pointer", transition: "all 0.15s" }}
            >
              <div className="flex gap-4 items-center">
                {/* Rank badge */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: i === 0 ? "var(--accent)" : "var(--bg-input)",
                    color: i === 0 ? "#0f0f0e" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  {i + 1}
                </div>

                {/* Image */}
                {r.listing.images && r.listing.images.length > 0 ? (
                  <img
                    src={r.listing.images[0].url}
                    alt={r.listing.name}
                    style={{
                      width: 80,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 60,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                    }}
                  >
                    🏠
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {r.listing.name}
                    </span>
                  </div>
                  <div
                    className="flex gap-3 mt-1"
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    <span>
                      <Bed size={12} style={{ verticalAlign: "middle" }} />{" "}
                      {r.listing.rooms}
                    </span>
                    <span>
                      <Bath size={12} style={{ verticalAlign: "middle" }} />{" "}
                      {r.listing.toilets}
                    </span>
                    <span>
                      <MapPin size={12} style={{ verticalAlign: "middle" }} />{" "}
                      {r.listing.address.split(",").slice(-2).join(",").trim()}
                    </span>
                    {r.commuteMinutes && (
                      <span>
                        <Clock size={12} style={{ verticalAlign: "middle" }} />{" "}
                        {r.commuteMinutes} min
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: "var(--accent)",
                      fontFamily: "DM Serif Display, serif",
                      fontSize: "1rem",
                      marginTop: 4,
                    }}
                  >
                    {formatPrice(r.listing.price)}
                  </div>
                </div>

                {/* Score ring + chevron */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <ScoreRing score={r.totalScore} />
                  <ChevronRight
                    size={16}
                    style={{ color: "var(--text-dim)" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
