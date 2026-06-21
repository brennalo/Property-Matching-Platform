import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  schedulesApi,
  availabilityApi,
  favouritesApi,
  agentApi,
  conversationsApi,
  viewHistoryApi,
  listingsApi,
} from "../../api";
import type {
  MatchedListing,
  ModeCommuteResult,
  TransitStep,
  BookedSlot,
  PlaceLocation,
  ImageDto,
} from "../../types";
import {
  getPlaceTypeColor,
  getPlaceTypeLabel,
  ScheduleStatus,
} from "../../types";
import {
  ArrowLeft,
  Bed,
  Heart,
  Bath,
  MapPin,
  Clock,
  ExternalLink,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Navigation,
  X,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
} from "lucide-react";

// ── Google Maps ready state ───────────────────────────────────────────────────
declare global {
  interface Window {
    google: any;
    __gmapsReady: boolean;
  }
}

function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.__gmapsReady);
  useEffect(() => {
    if (window.__gmapsReady) return;
    const iv = setInterval(() => {
      if (window.__gmapsReady) {
        clearInterval(iv);
        setReady(true);
      }
    }, 150);
    return () => clearInterval(iv);
  }, []);
  return ready;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.82rem",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value.toFixed(0)}</span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--bg-input)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: color,
            borderRadius: 99,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 36,
    cx = 44,
    cy = 44,
    stroke = 5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#3db8a0" : score >= 40 ? "#e8a045" : "#e05c5c";
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "DM Serif Display, serif",
            fontSize: "1.4rem",
            color,
            lineHeight: 1,
          }}
        >
          {score.toFixed(0)}
        </span>
        <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>
          score
        </span>
      </div>
    </div>
  );
}

// ── Enhanced Image Gallery with zoom, lightbox and captions ───────────────────
function ImageGallery({ images, name }: { images: ImageDto[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const [zoomedIdx, setZoomedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showCaption, setShowCaption] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!images.length) {
    return (
      <div
        style={{
          height: 320,
          background: "var(--bg-input)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "5rem",
        }}
      >
        🏠
      </div>
    );
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z - e.deltaY * 0.001, 1), 3));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedIdx(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentImage = images[idx];
  const zoomedImage = zoomedIdx !== null ? images[zoomedIdx] : null;

  return (
    <>
      {/* Main gallery */}
      <div style={{ borderRadius: 14, overflow: "hidden", background: "#000" }}>
        <div style={{ position: "relative" }}>
          <img
            src={currentImage.url}
            alt={name}
            style={{
              width: "100%",
              height: 340,
              objectFit: "cover",
              display: "block",
              cursor: "pointer",
            }}
            onClick={() => {
              setZoomedIdx(idx);
              setZoom(1);
              setShowCaption(true);
            }}
          />

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() =>
                  setIdx((i) => (i - 1 + images.length) % images.length)
                }
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(0,0,0,0.55)",
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(0,0,0,0.55)",
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={18} />
              </button>

              {/* Dot indicators */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 6,
                }}
              >
                {images.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setIdx(i)}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: i === idx ? "#fff" : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: 8,
              background: "rgba(0,0,0,0.8)",
            }}
          >
            {images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt=""
                onClick={() => setIdx(i)}
                style={{
                  width: 64,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 6,
                  cursor: "pointer",
                  border:
                    i === idx
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                  opacity: i === idx ? 1 : 0.6,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox for zoomed image */}
      {zoomedImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setZoomedIdx(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setZoomedIdx(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              cursor: "pointer",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <X size={24} />
          </button>

          {/* Zoom controls */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 12,
              zIndex: 10,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => Math.max(z - 0.5, 1));
              }}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ZoomOut size={20} />
            </button>
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "white",
                fontSize: "0.85rem",
                minWidth: 60,
                textAlign: "center",
              }}
            >
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => Math.min(z + 0.5, 3));
              }}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ZoomIn size={20} />
            </button>
          </div>

          {/* Caption toggle */}
          {zoomedImage.caption && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCaption(!showCaption);
              }}
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              {showCaption ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          )}

          {/* Zoomed image container */}
          <div
            ref={containerRef}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
          >
            <img
              src={zoomedImage.url}
              alt="Zoomed"
              style={{
                objectFit: "contain",
                maxWidth: "100%",
                maxHeight: "100%",
                transform: `scale(${zoom})`,
                transition: "transform 0.2s ease",
              }}
            />
          </div>

          {/* Caption pill */}
          {zoomedImage.caption && showCaption && (
            <div
              style={{
                position: "absolute",
                bottom: 100,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.8)",
                color: "white",
                padding: "12px 20px",
                borderRadius: 999,
                fontSize: "0.9rem",
                maxWidth: 300,
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              {zoomedImage.caption}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Transit itinerary ─────────────────────────────────────────────────────────
function mergeWalkSteps(steps: TransitStep[]): TransitStep[] {
  const merged: TransitStep[] = [];
  for (const step of steps) {
    const prev = merged[merged.length - 1];
    if (step.type === "WALK" && prev?.type === "WALK") {
      merged[merged.length - 1] = {
        ...prev,
        durationMinutes: prev.durationMinutes + step.durationMinutes,
        distanceKm:
          Math.round((prev.distanceKm + step.distanceKm) * 1000) / 1000,
        polylineEncoded: null,
      };
    } else {
      merged.push(step);
    }
  }
  return merged;
}

function TransitItinerary({ steps: rawSteps }: { steps: TransitStep[] }) {
  const steps = mergeWalkSteps(rawSteps);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((step, i) => {
        const isTransit = step.type === "TRANSIT";
        const lineColor = step.lineColor
          ? `#${step.lineColor.replace("#", "")}`
          : "#4285F4";
        const textColor = step.lineTextColor
          ? `#${step.lineTextColor.replace("#", "")}`
          : "#fff";
        const isLast = i === steps.length - 1;

        return (
          <div key={i} style={{ display: "flex", gap: 0 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 40,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isTransit ? lineColor : "var(--border-hi)",
                  border: "2px solid var(--bg-card)",
                  zIndex: 1,
                  marginTop: i === 0 ? 4 : 0,
                }}
              />
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    width: 3,
                    minHeight: 40,
                    background: isTransit ? lineColor : "transparent",
                    borderLeft: isTransit
                      ? "none"
                      : "3px dotted var(--border-hi)",
                    marginLeft: isTransit ? 0 : -0.5,
                  }}
                />
              )}
            </div>

            <div
              style={{
                flex: 1,
                paddingLeft: 12,
                paddingBottom: isLast ? 0 : 4,
              }}
            >
              {isTransit ? (
                <div style={{ marginBottom: 8 }}>
                  {step.departureStop && (
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        marginBottom: 6,
                      }}
                    >
                      {step.departureStop}
                    </div>
                  )}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginBottom: 6,
                      border: `1px solid ${lineColor}30`,
                    }}
                  >
                    <span
                      style={{
                        background: lineColor,
                        color: textColor,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}
                    >
                      {step.vehicleIcon ?? "🚌"} {step.lineName ?? "—"}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      {step.headSign && (
                        <span
                          style={{ fontSize: "0.82rem", color: "var(--text)" }}
                        >
                          {step.headSign}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-dim)",
                        }}
                      >
                        {step.durationMinutes} min
                        {step.numStops != null
                          ? ` · ${step.numStops} stop${step.numStops === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  {step.arrivalStop && (
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "var(--text)",
                      }}
                    >
                      {step.arrivalStop}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>🚶 Walk</span>
                  <span style={{ color: "var(--text-dim)" }}>
                    {step.durationMinutes > 0
                      ? `${step.durationMinutes} min`
                      : "About 1 min"}
                    {step.distanceKm > 0
                      ? ` · ${(step.distanceKm * 1000).toFixed(0)} m`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lifestyle places map ─────────────────────────────────────────────────────
function LifestyleMapCard({
  listingLat,
  listingLng,
  lifestylePlaces,
  mapsReady,
}: {
  listingLat: number;
  listingLng: number;
  lifestylePlaces: Record<string, PlaceLocation[]>;
  mapsReady: boolean;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(Object.keys(lifestylePlaces)),
  );

  const lifestyleCounts = Object.fromEntries(
    Object.entries(lifestylePlaces).map(([type, places]) => [
      type,
      places.length,
    ]),
  );

  const allPlaces = Object.entries(lifestylePlaces).flatMap(([type, places]) =>
    places.map((p) => ({ ...p, type })),
  );

  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapDivRef.current, {
      center: { lat: listingLat, lng: listingLng },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    new window.google.maps.Marker({
      position: { lat: listingLat, lng: listingLng },
      map: mapRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#e8a045",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
      label: { text: "🏠", fontSize: "16px" },
      title: "This property",
      zIndex: 100,
    });
    new window.google.maps.Circle({
      map: mapRef.current,
      center: { lat: listingLat, lng: listingLng },
      radius: 800,
      strokeColor: "#e8a045",
      strokeOpacity: 0.4,
      strokeWeight: 1,
      fillColor: "#e8a045",
      fillOpacity: 0.04,
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    allPlaces
      .filter((p) => activeTypes.has(p.type))
      .forEach((p) => {
        const color = getPlaceTypeColor(p.type);
        const marker = new window.google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: mapRef.current,
          title: p.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: "#fff",
            strokeWeight: 1.5,
          },
          zIndex: 50,
        });
        const iw = new window.google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;font-size:13px;padding:2px 4px"><strong>${p.name}</strong><br/><span style="color:#666">${getPlaceTypeLabel(p.type)}</span></div>`,
        });
        marker.addListener("click", () => iw.open(mapRef.current, marker));
        markersRef.current.push(marker);
      });
  }, [mapsReady, activeTypes, allPlaces.length]);

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const categories = Object.entries(lifestyleCounts);

  return (
    <div className="card">
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12 }}>
        Nearby Places (within 800m)
      </h3>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}
      >
        {categories.map(([type, count]) => {
          const color = getPlaceTypeColor(type);
          const label = getPlaceTypeLabel(type);
          const isActive = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 99,
                fontSize: "0.75rem",
                cursor: "pointer",
                border: `1.5px solid ${isActive ? color : "var(--border)"}`,
                background: isActive ? `${color}18` : "transparent",
                color: isActive ? color : "var(--text-dim)",
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isActive ? color : "var(--border)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {label} <span style={{ fontWeight: 700 }}>{count}</span>
            </button>
          );
        })}
      </div>
      {mapsReady ? (
        <div
          ref={mapDivRef}
          style={{
            width: "100%",
            height: 320,
            borderRadius: 10,
            border: "1px solid var(--border)",
          }}
        />
      ) : (
        <div
          style={{
            height: 320,
            background: "var(--bg-input)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          <span className="spinner" style={{ marginRight: 8 }} /> Loading map…
        </div>
      )}
      <p
        style={{ fontSize: "0.74rem", color: "var(--text-dim)", marginTop: 8 }}
      >
        Click any marker for its name. Toggle categories above to show/hide.
      </p>
    </div>
  );
}

// ── Route map ─────────────────────────────────────────────────────────────────
const MODE_COLORS: Record<string, string> = {
  Driving: "#4285F4",
  Transit: "#0F9D58",
  Walking: "#F4B400",
  Bicycling: "#DB4437",
};
const MODE_ICONS: Record<string, string> = {
  Driving: "🚗",
  Transit: "🚇",
  Walking: "🚶",
  Bicycling: "🚲",
};

function RouteMap({
  listingLat,
  listingLng,
  workplaceLat,
  workplaceLng,
  commuteRoutes,
  mapsReady,
}: {
  listingLat: number;
  listingLng: number;
  workplaceLat: number;
  workplaceLng: number;
  commuteRoutes: ModeCommuteResult[];
  mapsReady: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const polylineRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const [activeMode, setActiveMode] = useState<string>(
    commuteRoutes[0]?.mode ?? "Driving",
  );
  const [showItinerary, setShowItinerary] = useState(false);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: listingLat, lng: listingLng },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapInstance.current) return;
    const map = mapInstance.current;

    polylineRef.current.forEach((p) => p.setMap(null));
    polylineRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const route = commuteRoutes.find((r) => r.mode === activeMode);
    const color = MODE_COLORS[activeMode] ?? "#4285F4";
    const bounds = new window.google.maps.LatLngBounds();

    const mHome = new window.google.maps.Marker({
      position: { lat: listingLat, lng: listingLng },
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
      label: { text: "🏠", fontSize: "16px" },
      zIndex: 10,
    });
    const mWork = new window.google.maps.Marker({
      position: { lat: workplaceLat, lng: workplaceLng },
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#e05c5c",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
      label: { text: "💼", fontSize: "16px" },
      zIndex: 10,
    });
    markersRef.current = [mHome, mWork];
    bounds.extend({ lat: listingLat, lng: listingLng });
    bounds.extend({ lat: workplaceLat, lng: workplaceLng });

    if (route?.transitSteps?.length) {
      for (const step of route.transitSteps) {
        if (!step.polylineEncoded) continue;
        const segColor =
          step.type === "TRANSIT" && step.lineColor
            ? `#${step.lineColor.replace("#", "")}`
            : step.type === "TRANSIT"
              ? color
              : "#9e9b95";

        const path = window.google.maps.geometry.encoding.decodePath(
          step.polylineEncoded,
        );
        path.forEach((pt: any) => bounds.extend(pt));

        if (step.type === "WALK") {
          polylineRef.current.push(
            new window.google.maps.Polyline({
              path,
              geodesic: true,
              strokeOpacity: 0,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, scale: 3 },
                  offset: "0",
                  repeat: "15px",
                },
              ],
              strokeColor: segColor,
              map,
            }),
          );
        } else {
          polylineRef.current.push(
            new window.google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: segColor,
              strokeOpacity: 0.9,
              strokeWeight: 5,
              map,
            }),
          );
        }
      }
    } else if (route?.encodedPolyline) {
      const path = window.google.maps.geometry.encoding.decodePath(
        route.encodedPolyline,
      );
      path.forEach((pt: any) => bounds.extend(pt));
      polylineRef.current.push(
        new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map,
        }),
      );
    } else {
      polylineRef.current.push(
        new window.google.maps.Polyline({
          path: [
            { lat: listingLat, lng: listingLng },
            { lat: workplaceLat, lng: workplaceLng },
          ],
          geodesic: true,
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, scale: 4 },
              offset: "0",
              repeat: "20px",
            },
          ],
          strokeColor: color,
          map,
        }),
      );
    }

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [mapsReady, activeMode, commuteRoutes]);

  const activeRoute = commuteRoutes.find((r) => r.mode === activeMode);
  const hasTransitSteps =
    activeRoute?.transitSteps && activeRoute.transitSteps.length > 0;

  return (
    <div>
      <div
        style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}
      >
        {commuteRoutes.map((r) => (
          <button
            key={r.mode}
            type="button"
            onClick={() => {
              setActiveMode(r.mode);
              setShowItinerary(false);
            }}
            className={`btn btn-sm ${activeMode === r.mode ? "btn-primary" : "btn-outline"}`}
          >
            {MODE_ICONS[r.mode]} {r.mode}
            <span
              style={{ fontWeight: 400, fontSize: "0.75rem", opacity: 0.85 }}
            >
              · {r.durationMinutes} min
            </span>
          </button>
        ))}
      </div>

      {mapsReady ? (
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: 360,
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        />
      ) : (
        <div
          style={{
            height: 360,
            background: "var(--bg-input)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          <span className="spinner" style={{ marginRight: 8 }} /> Loading map…
        </div>
      )}

      {activeRoute && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "var(--bg-input)",
            borderRadius: 8,
            display: "flex",
            gap: 16,
            fontSize: "0.83rem",
            color: "var(--text-muted)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>
            <Clock
              size={13}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            <strong style={{ color: "var(--text)" }}>
              {activeRoute.durationMinutes} min
            </strong>
          </span>
          <span>
            <Navigation
              size={13}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            <strong style={{ color: "var(--text)" }}>
              {activeRoute.distanceKm} km
            </strong>
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {MODE_ICONS[activeRoute.mode]} {activeRoute.mode}
            {hasTransitSteps && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                onClick={() => setShowItinerary((v) => !v)}
              >
                {showItinerary ? "Hide steps" : "Show steps"}
              </button>
            )}
            {!activeRoute.encodedPolyline && !hasTransitSteps && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                (approximate)
              </span>
            )}
          </span>
        </div>
      )}

      {showItinerary && hasTransitSteps && (
        <div
          style={{
            marginTop: 12,
            padding: "16px 18px",
            background: "var(--bg-input)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-dim)",
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontWeight: 600,
            }}
          >
            Transit Itinerary
          </p>
          <TransitItinerary steps={activeRoute!.transitSteps!} />
        </div>
      )}
    </div>
  );
}

// ── Calendar picker ─────────────────────────────────────────────────────────
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const h = i + 8;
  return {
    value: `${String(h).padStart(2, "0")}:00`,
    label: h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`,
  };
});

// ── Schedule modal ─────────────────────────────────────────────────────────
function ScheduleModal({
  listingId,
  listingName,
  agentId,
  onClose,
}: {
  listingId: string;
  listingName: string;
  agentId: string;
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const fromDate = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    return new Date(Date.UTC(year, month, 1));
  }, [viewDate]);

  const toDate = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    // Last day of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));
  }, [viewDate]);

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [
      "available-slots",
      listingId,
      fromDate.toISOString(),
      toDate.toISOString(),
    ],
    queryFn: async () => {
      const res = await availabilityApi.getSlots(listingId, fromDate, toDate);
      return res.data;
    },
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !!listingId,
  });

  const slotsByDate = useMemo(() => {
    const map: Record<string, typeof slots> = {};
    slots.forEach((slot) => {
      const dateKey = slot.date.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(slot);
    });
    return map;
  }, [slots]);

  const now = new Date();
  const todayStr = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  )
    .toISOString()
    .split("T")[0];

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const rows: Array<Array<{ day: number; dateStr: string; status: string }>> =
      [];
    let currentRow: Array<{ day: number; dateStr: string; status: string }> =
      [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      currentRow.push({ day: 0, dateStr: "", status: "empty" });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(Date.UTC(year, month, day));
      const dateStr = dateObj.toISOString().split("T")[0];
      const isPast = dateStr < todayStr;

      let status: string;
      if (isPast) {
        status = "past";
      } else {
        const daySlots = slotsByDate[dateStr] || [];
        if (daySlots.length === 0) {
          status = "unavailable";
        } else {
          const bookedCount = daySlots.filter((s) => s.isBooked).length;
          if (bookedCount === daySlots.length) {
            status = "fully-booked";
          } else if (bookedCount === 0) {
            status = "available";
          } else {
            status = "partially-booked";
          }
        }
      }

      currentRow.push({ day, dateStr, status });
      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    }

    while (currentRow.length < 7 && currentRow.length > 0) {
      currentRow.push({ day: 0, dateStr: "", status: "empty" });
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }, [viewDate, slotsByDate, todayStr]);

  const goPrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDate("");
    setSelectedTime("");
  };

  const goNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDate("");
    setSelectedTime("");
  };

  const handleDateClick = (dateStr: string, status: string) => {
    if (
      status === "unavailable" ||
      status === "past" ||
      status === "fully-booked"
    )
      return;
    setSelectedDate(dateStr);
    setSelectedTime("");
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    setError("");
    try {
      await schedulesApi.create(
        listingId,
        new Date(`${selectedDate}T${selectedTime}:00`),
      );
      setSuccess(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "var(--teal)";
      case "partially-booked":
        return "var(--accent)";
      case "fully-booked":
        return "var(--red)";
      case "past":
        return "var(--text-dim)";
      default:
        return "var(--bg-input)";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Available";
      case "partially-booked":
        return "Partially booked";
      case "fully-booked":
        return "Fully booked";
      case "past":
        return "Past";
      default:
        return "Unavailable";
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <h2 style={{ fontSize: "1.1rem" }}>Schedule a Viewing</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            marginBottom: 20,
          }}
        >
          {listingName}
        </p>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle2
              size={48}
              style={{ color: "var(--accent)", marginBottom: 12 }}
            />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Viewing Scheduled!
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              {new Date(`${selectedDate}T${selectedTime}`).toLocaleString(
                "en-MY",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </p>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.8rem",
                marginTop: 8,
              }}
            >
              The agent will confirm shortly.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : slotsLoading ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <span className="spinner" />
          </div>
        ) : (
          <>
            {/* Month Navigation */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={goPrevMonth}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                {viewDate.toLocaleDateString("en-MY", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={goNextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                  textAlign: "center",
                  fontSize: "0.7rem",
                  color: "var(--text-dim)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              {calendarData.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 4,
                  }}
                >
                  {row.map((cell, colIdx) => {
                    if (cell.status === "empty") {
                      return <div key={colIdx} />;
                    }
                    const isSelected = selectedDate === cell.dateStr;
                    const canClick =
                      cell.status === "available" ||
                      cell.status === "partially-booked";
                    return (
                      <div
                        key={colIdx}
                        onClick={() =>
                          handleDateClick(cell.dateStr, cell.status)
                        }
                        style={{
                          aspectRatio: "1",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 6,
                          background: isSelected
                            ? "var(--accent)"
                            : cell.status === "past"
                              ? "var(--bg-input)"
                              : "transparent",
                          color: isSelected
                            ? "#0f0f0e"
                            : cell.status === "past"
                              ? "var(--text-dim)"
                              : "var(--text)",
                          cursor: canClick ? "pointer" : "default",
                          fontSize: "0.85rem",
                          fontWeight: isSelected ? 700 : 400,
                          position: "relative",
                          border: isSelected
                            ? "2px solid var(--accent)"
                            : "2px solid transparent",
                        }}
                      >
                        <span>{cell.day}</span>
                        {cell.status !== "empty" &&
                          cell.status !== "past" &&
                          cell.status !== "unavailable" && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 4,
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: getStatusColor(cell.status),
                              }}
                            />
                          )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: "0.7rem",
                color: "var(--text-dim)",
                marginBottom: 16,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--teal)",
                    display: "inline-block",
                  }}
                />
                Available
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                Partially booked
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--red)",
                    display: "inline-block",
                  }}
                />
                Fully booked
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--bg-input)",
                    display: "inline-block",
                  }}
                />
                Unavailable
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--text-dim)",
                    display: "inline-block",
                  }}
                />
                Past
              </span>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div style={{ marginBottom: 16 }}>
                <label
                  className="form-label"
                  style={{ marginBottom: 8, display: "block" }}
                >
                  Select a Time
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(slotsByDate[selectedDate] || [])
                    .filter((slot) => !slot.isBooked)
                    .map((slot) => (
                      <button
                        key={`${slot.startTime}-${slot.endTime}`}
                        className={`btn btn-sm ${selectedTime === slot.startTime ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setSelectedTime(slot.startTime)}
                      >
                        {slot.startTime} – {slot.endTime}
                      </button>
                    ))}
                </div>
                {slotsByDate[selectedDate]?.filter((s) => !s.isBooked)
                  .length === 0 && (
                  <p
                    style={{
                      color: "var(--red)",
                      fontSize: "0.8rem",
                      marginTop: 8,
                    }}
                  >
                    No free slots on this day.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: "0.85rem",
                  marginTop: 10,
                }}
              >
                {error}
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 14,
              }}
            >
              <button className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBook}
                disabled={!selectedDate || !selectedTime || loading}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <CalendarPlus size={14} /> Confirm Booking
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [result, setResult] = useState<MatchedListing | null>(null);
  const [workplaceLat, setWorkplaceLat] = useState<number | null>(null);
  const [workplaceLng, setWorkplaceLng] = useState<number | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const mapsReady = useGoogleMaps();

  useEffect(() => {
    const raw = sessionStorage.getItem("matchResults");
    const reqRaw = sessionStorage.getItem("matchReq");
    if (raw && id) {
      const results: MatchedListing[] = JSON.parse(raw);
      const found = results.find((r) => r.listing.id === id);
      if (found) {
        setResult(found);
        if (reqRaw) {
          const req = JSON.parse(reqRaw);
          setWorkplaceLat(req.workplaceLat ?? null);
          setWorkplaceLng(req.workplaceLng ?? null);
        }
        return;
      }
    }
    if (id) {
      listingsApi
        .getById(id)
        .then((res) => {
          setResult({
            listing: res.data,
            totalScore: 0,
            numericScore: 0,
            commuteScore: 0,
            lifestyleScore: 0,
            commuteMinutes: null,
            commuteRoutes: [],
            lifestylePlaces: {},
          });
        })
        .catch(() => navigate("/search"));
    }
  }, [id, navigate]);

  // ── ALL hooks must be here, before any early return ──
  const listingId = result?.listing?.id;
  const agentId = result?.listing?.agentId;

  useEffect(() => {
    if (listingId) {
      viewHistoryApi.track(listingId);
    }
  }, [listingId]);

  const { data: favStatus } = useQuery({
    queryKey: ["fav-status", listingId],
    queryFn: () => favouritesApi.getStatus(listingId!).then((r) => r.data),
    enabled: !!listingId,
  });
  const toggleFav = useMutation({
    mutationFn: () =>
      favStatus?.saved
        ? favouritesApi.remove(listingId!)
        : favouritesApi.add(listingId!),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["fav-status", listingId] }),
  });
  const enquireMut = useMutation({
    mutationFn: () => conversationsApi.open(listingId!),
    onSuccess: () => navigate("/conversations"),
  });
  const { data: agentProfile } = useQuery({
    queryKey: ["agent-public", agentId],
    queryFn: () => agentApi.getPublicProfile(agentId!).then((r) => r.data),
    enabled: !!agentId,
  });

  // ── early return AFTER all hooks ──
  if (!result) return null;

  const { listing } = result;
  const hasRoutes =
    result.commuteRoutes.length > 0 && workplaceLat && workplaceLng;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => navigate("/results")}
      >
        <ArrowLeft size={14} /> Back to Results
      </button>

      {/* Use enhanced gallery with images (ImageDto[]) instead of imageUrls */}
      <ImageGallery images={listing.images} name={listing.name} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "1.6rem",
                    fontFamily: "DM Serif Display, serif",
                    marginBottom: 4,
                  }}
                >
                  {listing.name}
                </h1>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.88rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MapPin size={14} /> {listing.address}
                </p>
              </div>
              <ScoreRing score={result.totalScore} />
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="badge badge-grey">
                <Bed size={12} /> {listing.rooms} bed
              </span>
              <span className="badge badge-grey">
                <Bath size={12} /> {listing.toilets} bath
              </span>
              <span className="badge badge-grey">{listing.residencyType}</span>
              {result.commuteMinutes && (
                <span className="badge badge-grey">
                  <Clock size={12} /> {result.commuteMinutes} min
                </span>
              )}
            </div>
            <div
              style={{
                color: "var(--accent)",
                fontFamily: "DM Serif Display, serif",
                fontSize: "2rem",
                marginTop: 12,
              }}
            >
              RM {listing.price.toLocaleString()}/mo
            </div>
          </div>

          <div className="card">
            <h3
              style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 14 }}
            >
              Match Score Breakdown
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ScoreBar
                label="Numeric match (40%)"
                value={result.numericScore}
                color="#3db8a0"
              />
              <ScoreBar
                label="Commute score (30%)"
                value={result.commuteScore}
                color="#e8a045"
              />
              <ScoreBar
                label="Lifestyle score (30%)"
                value={result.lifestyleScore}
                color="#a78bfa"
              />
              <div
                style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}
              >
                <ScoreBar
                  label="Overall score"
                  value={result.totalScore}
                  color="var(--text)"
                />
              </div>
            </div>
          </div>

          {Object.keys(result.lifestylePlaces).length > 0 && (
            <LifestyleMapCard
              listingLat={listing.lat}
              listingLng={listing.lng}
              lifestylePlaces={result.lifestylePlaces}
              mapsReady={mapsReady}
            />
          )}

          {hasRoutes && (
            <div className="card">
              <h3
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                🗺️ Commute Route
              </h3>
              <RouteMap
                listingLat={listing.lat}
                listingLng={listing.lng}
                workplaceLat={workplaceLat!}
                workplaceLng={workplaceLng!}
                commuteRoutes={result.commuteRoutes}
                mapsReady={mapsReady}
              />
            </div>
          )}
        </div>

        {/* Right sticky column */}
        <div style={{ position: "sticky", top: 80 }}>
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              Interested?
            </h3>
            <>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Book a viewing with the agent.
              </p>
              <button
                className="btn btn-primary w-full"
                style={{ justifyContent: "center" }}
                onClick={() => setShowSchedule(true)}
              >
                <CalendarPlus size={14} /> Schedule a Viewing
              </button>
            </>

            <div className="card" style={{ padding: 20, marginTop: 24 }}>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 12,
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                }}
              >
                LISTED BY
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                    {agentProfile?.fullName}
                  </div>
                  {agentProfile?.licenseNumber && (
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      License: {agentProfile.licenseNumber}
                    </div>
                  )}
                  {agentProfile?.contactNo && (
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      Contact: {agentProfile.contactNo}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className={`btn ${favStatus?.saved ? "btn-primary" : "btn-outline"}`}
                    onClick={() => toggleFav.mutate()}
                    title={
                      favStatus?.saved ? "Remove from saved" : "Save listing"
                    }
                  >
                    <Heart
                      size={15}
                      fill={favStatus?.saved ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => enquireMut.mutate()}
                    disabled={enquireMut.isPending}
                  >
                    {enquireMut.isPending ? (
                      <span className="spinner" />
                    ) : (
                      "Enquire More"
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: "0.83rem",
                color: "var(--text-muted)",
              }}
            >
              {[
                ["Listed by", listing.agentName],
                ["Type", listing.residencyType],
                ["Bedrooms", String(listing.rooms)],
                ["Bathrooms", String(listing.toilets)],
                ...(result.commuteMinutes
                  ? [["Best commute", `${result.commuteMinutes} min`]]
                  : []),
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{k}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {result.commuteRoutes.length > 0 && (
              <>
                <div className="divider" />
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Commute by mode
                </p>
                {result.commuteRoutes.map((r) => (
                  <div
                    key={r.mode}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      {MODE_ICONS[r.mode]} {r.mode}
                    </span>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>
                      {r.durationMinutes} min · {r.distanceKm} km
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal
          listingId={listing.id}
          listingName={listing.name}
          agentId={listing.agentId}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  );
}
