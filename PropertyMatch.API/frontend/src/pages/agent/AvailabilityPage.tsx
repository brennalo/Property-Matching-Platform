import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityApi } from "../../api";
import type { AgentAvailability } from "../../types";
import { Plus, Trash2, Save } from "lucide-react";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_OF_WEEK_MAP: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

interface TimeSlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [newSlots, setNewSlots] = useState<TimeSlot[]>([]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: availability, isLoading } = useQuery({
    queryKey: ["my-availability"],
    queryFn: () =>
      availabilityApi.getMine().then((r) => r.data?.availabilities || []),
  });

  useEffect(() => {
    if (availability) {
      setSlots(
        availability.map((a) => ({
          id: a.id,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      );
    }
  }, [availability]);

  const createMut = useMutation({
    mutationFn: (slotsToCreate: TimeSlot[]) =>
      availabilityApi.batchCreate(
        slotsToCreate.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      setNewSlots([]);
      showToast("Availability updated!");
    },
    onError: () => showToast("Failed to save availability", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => availabilityApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      showToast("Slot deleted!");
    },
    onError: () => showToast("Failed to delete slot", "error"),
  });

  const addNewSlot = (dayOfWeek: number) => {
    setNewSlots((prev) => [
      ...prev,
      {
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:00",
      },
    ]);
  };

  const updateNewSlot = (index: number, field: string, value: string) => {
    setNewSlots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeNewSlot = (index: number) => {
    setNewSlots((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">My Availability</h1>
        <p className="page-sub">
          Set your available time slots for tenant viewings
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Current slots by day */}
        {DAYS.map((day, dayIdx) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === dayIdx);
          const newDaySlots = newSlots.filter((s) => s.dayOfWeek === dayIdx);

          return (
            <div key={day} className="card">
              <div style={{ marginBottom: 16 }}>
                <h3
                  style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}
                >
                  {day}
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {daySlots.length + newDaySlots.length} slot(s)
                </p>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* Existing slots */}
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontFamily: "monospace", fontWeight: 500 }}>
                      {slot.startTime} — {slot.endTime}
                    </span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => slot.id && deleteMut.mutate(slot.id)}
                      disabled={deleteMut.isPending}
                      style={{ marginLeft: "auto" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* New unsaved slots */}
                {newDaySlots.map((slot, idx) => {
                  const actualIdx = newSlots.indexOf(slot);
                  return (
                    <div
                      key={actualIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 10,
                        background: "rgba(61, 184, 160, 0.1)",
                        borderRadius: 8,
                        border: "1px solid rgba(61, 184, 160, 0.3)",
                      }}
                    >
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          updateNewSlot(actualIdx, "startTime", e.target.value)
                        }
                        style={{
                          padding: "6px 10px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text)",
                          fontSize: "0.85rem",
                        }}
                      />
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) =>
                          updateNewSlot(actualIdx, "endTime", e.target.value)
                        }
                        style={{
                          padding: "6px 10px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text)",
                          fontSize: "0.85rem",
                        }}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeNewSlot(actualIdx)}
                        style={{ marginLeft: "auto" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* Add slot button */}
                <button
                  className="btn btn-outline"
                  onClick={() => addNewSlot(dayIdx)}
                  style={{
                    justifyContent: "center",
                    marginTop:
                      daySlots.length > 0 || newDaySlots.length > 0 ? 4 : 0,
                  }}
                >
                  <Plus size={14} /> Add Slot
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      {newSlots.length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 24,
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            paddingTop: 16,
          }}
        >
          <button
            className="btn btn-outline"
            onClick={() => setNewSlots([])}
            disabled={createMut.isPending}
          >
            Discard
          </button>
          <button
            className="btn btn-primary"
            onClick={() => createMut.mutate(newSlots)}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? (
              <span className="spinner" />
            ) : (
              <>
                <Save size={14} /> Save Changes
              </>
            )}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
