import { useState, useEffect, useRef } from "react";
import { X, ZoomIn, ZoomOut, Eye, EyeOff } from "lucide-react";
import type { ImageDto } from "../types";

export function ImageLightbox({
  image,
  onClose,
}: {
  image: ImageDto;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [showCaption, setShowCaption] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const initialPinchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  // ── Double-tap ──
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setZoom((prev) => (prev > 1 ? 1 : 1.5));
    if (zoom > 1) setPosition({ x: 0, y: 0 });
  };

  // ── Pinch ──
  const handlePinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      initialPinchDistance.current = distance;
      initialZoom.current = zoom;
    }
  };

  const handlePinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      const rawScale = distance / initialPinchDistance.current;
      const dampenedScale = 1 + (rawScale - 1) * 0.5;
      const newZoom = Math.min(
        Math.max(initialZoom.current * dampenedScale, 1),
        3,
      );
      setZoom(newZoom);
    }
  };

  const handlePinchEnd = () => {
    initialPinchDistance.current = null;
  };

  // ── Pan (mouse) ──
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const onMouseUp = () => setIsDragging(false);

  // ── Pan (touch drag) ──
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragStart, setTouchDragStart] = useState({ x: 0, y: 0 });
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });

  const handleTouchDragStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || zoom <= 1) return;
    const touch = e.touches[0];
    setIsTouchDragging(true);
    setTouchStartPos({ x: position.x, y: position.y });
    setTouchDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchDragMove = (e: React.TouchEvent) => {
    if (!isTouchDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touchStartPos.x + (touch.clientX - touchDragStart.x),
      y: touchStartPos.y + (touch.clientY - touchDragStart.y),
    });
  };

  const handleTouchDragEnd = () => {
    setIsTouchDragging(false);
  };

  // ── Combined touch handler ──
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap(e);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      handleTouchDragStart(e);
    } else {
      handlePinchStart(e);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      handlePinchMove(e);
    } else if (e.touches.length === 1) {
      handleTouchDragMove(e);
    }
  };

  const onTouchEnd = () => {
    handlePinchEnd();
    handleTouchDragEnd();
  };

  // ── Reset pan when zoom becomes 1 ──
  useEffect(() => {
    if (zoom === 1) setPosition({ x: 0, y: 0 });
  }, [zoom]);

  // ── Keyboard close ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ── Wheel zoom with passive: false ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.05 : -0.05;
      setZoom((z) => Math.min(Math.max(z + delta, 0.5), 3));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* ── Close button (top-right) ── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
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

      {/* ── Caption toggle (top-left) ── */}
      {image.caption && (
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

      {/* ── Image container with gestures ── */}
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
          touchAction: "none",
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={handleTouchDragEnd}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "100%",
            minHeight: "100%",
            transform: `translate(${position.x}px, ${position.y}px)`,
            transition:
              isDragging || isTouchDragging ? "none" : "transform 0.2s ease",
          }}
        >
          <img
            src={image.url}
            alt="Zoomed"
            style={{
              maxWidth: zoom <= 1 ? "100%" : "none",
              maxHeight: zoom <= 1 ? "100%" : "none",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.2s ease",
              userSelect: "none",
              pointerEvents: "none",
            }}
            draggable={false}
            onDoubleClick={handleDoubleTap}
          />
        </div>
      </div>

      {/* ── Zoom controls (bottom center) ── */}
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
            setZoom((z) => Math.max(z - 0.1, 0.5));
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
            setZoom((z) => Math.min(z + 0.1, 3));
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

      {/* ── Caption pill ── */}
      {image.caption && showCaption && (
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
          {image.caption}
        </div>
      )}
    </div>
  );
}
