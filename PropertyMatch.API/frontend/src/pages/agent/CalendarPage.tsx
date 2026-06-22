import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedulesApi } from "../../api";
import type { ViewingSchedule, ScheduleStatus } from "../../types";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";

function CalendarGrid({
  year,
  month,
  schedules,
  onDayClick,
  selectedDay,
}: {
  year: number;
  month: number;
  schedules: ViewingSchedule[];
  onDayClick: (d: number) => void;
  selectedDay: number | null;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const scheduledDays = new Set(
    schedules.map((s) => new Date(s.scheduledAt).getDate()),
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 4,
          marginBottom: 8,
        }}
      >
        {dayLabels.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "0.72rem",
              color: "var(--text-dim)",
              fontWeight: 600,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 4,
        }}
      >
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday =
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;
          const hasSchedule = scheduledDays.has(day);
          const isSelected = selectedDay === day;

          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              style={{
                aspectRatio: "1",
                border: "none",
                borderRadius: 8,
                fontFamily: "inherit",
                fontSize: "0.85rem",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.12s",
                background: isSelected
                  ? "var(--accent)"
                  : isToday
                    ? "rgba(232,160,69,0.15)"
                    : "var(--bg-input)",
                color: isSelected
                  ? "#0f0f0e"
                  : isToday
                    ? "var(--accent)"
                    : "var(--text)",
                fontWeight: isToday || isSelected ? 700 : 400,
                outline:
                  isToday && !isSelected ? "1.5px solid var(--accent)" : "none",
              }}
            >
              {day}
              {hasSchedule && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 3,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isSelected ? "#0f0f0e" : "var(--teal)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AgentCalendarPage() {
  const qc = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate(),
  );
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState<{
    listingId: string;
    scheduledAt: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["agent-schedules"],
    queryFn: () => schedulesApi.getAgentSchedules().then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: ({
      listingId,
      scheduledAt,
      status,
      reason,
    }: {
      listingId: string;
      scheduledAt: string;
      status: ScheduleStatus;
      reason?: string;
    }) => schedulesApi.updateStatus(listingId, scheduledAt, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-schedules"] });
      showToast("Schedule updated");
      setCancelModal(null);
      setCancelReason("");
    },
    onError: () => showToast("Failed to update", "error"),
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleString("en-MY", {
    month: "long",
    year: "numeric",
  });

  const monthSchedules = schedules.filter((s) => {
    const d = new Date(s.scheduledAt);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  const daySchedules = selectedDay
    ? monthSchedules.filter(
        (s) => new Date(s.scheduledAt).getDate() === selectedDay,
      )
    : [];

  const statusColor: Record<ScheduleStatus, string> = {
    Pending: "var(--accent)",
    Confirmed: "var(--teal)",
    Cancelled: "var(--red)",
  };

  return (
    <div>
      <h1 className="page-title">Viewing Calendar</h1>
      <p className="page-sub">Manage all scheduled property viewings</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Calendar */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                fontFamily: "DM Serif Display, serif",
                fontSize: "1.1rem",
              }}
            >
              {monthName}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <span className="spinner" />
            </div>
          ) : (
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              schedules={monthSchedules}
              onDayClick={setSelectedDay}
              selectedDay={selectedDay}
            />
          )}

          <div
            className="flex gap-4 mt-4"
            style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
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
              Has viewings
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
              Today
            </span>
          </div>
        </div>

        {/* Day schedule panel */}
        <div className="card" style={{ position: "sticky", top: 80 }}>
          <h3 style={{ marginBottom: 14, fontSize: "0.95rem" }}>
            {selectedDay
              ? `${selectedDay} ${new Date(viewYear, viewMonth).toLocaleString("en-MY", { month: "long" })} ${viewYear}`
              : "Select a day"}
          </h3>

          {daySchedules.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>
              {selectedDay
                ? "No viewings scheduled for this day."
                : "Click a day on the calendar."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {daySchedules.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-input)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    borderLeft: `3px solid ${statusColor[s.status]}`,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                      fontSize: "0.9rem",
                    }}
                  >
                    {s.listingName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      marginBottom: 6,
                    }}
                  >
                    🕐{" "}
                    {new Date(s.scheduledAt).toLocaleTimeString("en-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}👤 {s.tenantName}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor[s.status]}22`,
                        color: statusColor[s.status],
                        fontSize: "0.72rem",
                      }}
                    >
                      {s.status}
                    </span>
                    {s.status === "Pending" && (
                      <>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: "var(--teal-dim)",
                            color: "var(--teal)",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            updateMut.mutate({
                              listingId: s.listingId,
                              scheduledAt: s.scheduledAt,
                              status: "Confirmed",
                            })
                          }
                        >
                          <Check size={12} /> Confirm
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setCancelModal({
                              listingId: s.listingId,
                              scheduledAt: s.scheduledAt,
                            });
                            setCancelReason("");
                          }}
                        >
                          <X size={12} /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                  {s.reason && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-dim)",
                        marginTop: 4,
                      }}
                    >
                      Reason: {s.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div
            className="modal"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 12 }}>Cancel Viewing</h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: 12,
              }}
            >
              Please provide a reason for cancelling.
            </p>
            <textarea
              className="input"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Agent unavailable, property already rented..."
              rows={3}
              style={{ width: "100%", marginBottom: 12 }}
            />
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="btn btn-outline"
                onClick={() => setCancelModal(null)}
              >
                Go Back
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (!cancelReason.trim()) {
                    showToast(
                      "Please enter a reason for cancellation",
                      "error",
                    );
                    return;
                  }
                  updateMut.mutate({
                    listingId: cancelModal.listingId,
                    scheduledAt: cancelModal.scheduledAt,
                    status: "Cancelled",
                    reason: cancelReason.trim(),
                  });
                }}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? (
                  <span className="spinner" />
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
