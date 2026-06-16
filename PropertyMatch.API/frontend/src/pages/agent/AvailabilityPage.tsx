import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityApi } from "../../api";
import type { AgentAvailability } from "../../types";
import { DayPicker, DateRange } from "react-day-picker";
import { format, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Plus, Trash2, Save, Edit, X } from "lucide-react";
import "react-day-picker/dist/style.css";

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [editingSlot, setEditingSlot] = useState<AgentAvailability | null>(
    null,
  );

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["my-availability"],
    queryFn: () =>
      availabilityApi.getMine().then((r) => r.data?.availabilities || []),
  });

  const saveMut = useMutation({
    mutationFn: (payload: any[]) => availabilityApi.batchCreate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      showToast("Availability saved!");
      resetForm();
    },
    onError: () => showToast("Failed to save", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => availabilityApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      showToast("Slot deleted");
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const resetForm = () => {
    setSelectedRange(undefined);
    setStartTime("09:00");
    setEndTime("17:00");
    setReason("");
    setEditingSlot(null);
  };

  const handleAddSlots = () => {
    if (!selectedRange?.from) {
      showToast("Please select a date or range", "error");
      return;
    }
    if (!validateTimes()) return; // ← add this line
    const from = selectedRange.from;
    const to = selectedRange.to || from;
    const dates = eachDayOfInterval({ start: from, end: to });
    const newSlots = dates.map((date) => ({
      startTime,
      endTime,
      validFromDate: format(date, "yyyy-MM-dd"),
      validToDate: format(date, "yyyy-MM-dd"),
      reason: reason || undefined,
    }));
    saveMut.mutate(newSlots);
  };

  const handleEdit = (slot: AgentAvailability) => {
    setEditingSlot(slot);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setReason(slot.reason || "");

    // Pre‑select the date(s) in the calendar
    const from = parseISO(slot.validFromDate);
    const to = parseISO(slot.validToDate);
    setSelectedRange({ from, to });
  };

  const handleUpdate = () => {
    if (!editingSlot) return;
    if (!selectedRange?.from) {
      showToast("Select a new date range for the updated slot", "error");
      return;
    }

    // Validate times FIRST
    if (startTime >= endTime) {
      showToast("Start time must be before end time", "error");
      return;
    }

    if (!validateTimes()) return;
    const from = selectedRange.from;
    const to = selectedRange.to || from;
    const dates = eachDayOfInterval({ start: from, end: to });
    const updatedSlots = dates.map((date) => ({
      startTime,
      endTime,
      validFromDate: format(date, "yyyy-MM-dd"),
      validToDate: format(date, "yyyy-MM-dd"),
      reason: reason || undefined,
    }));
    deleteMut.mutate(editingSlot.id!, {
      onSuccess: () => {
        saveMut.mutate(updatedSlots);
        resetForm();
      },
    });
  };

  const validateTimes = (): boolean => {
    if (startTime >= endTime) {
      showToast("Start time must be before end time", "error");
      return false;
    }
    return true;
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">My Availability</h1>
        <p className="page-sub">
          Set your availability for specific dates or date ranges.
        </p>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Calendar and form */}
        <div className="card" style={{ flex: 1, minWidth: 350 }}>
          <h3 style={{ marginBottom: 12 }}>Add / Edit Availability</h3>
          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            style={{ marginBottom: 16 }}
          />
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">End Time</label>
                <input
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Reason (optional)</label>
              <input
                className="input"
                placeholder="e.g., Holiday, Early closing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {editingSlot ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" onClick={resetForm}>
                  <X size={14} /> Cancel
                </button>
                <button className="btn btn-primary" onClick={handleUpdate}>
                  <Save size={14} /> Update
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary w-full"
                onClick={handleAddSlots}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <Plus size={14} /> Add Slot(s)
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Existing slots list */}
        <div className="card" style={{ flex: 2, minWidth: 400 }}>
          <h3 style={{ marginBottom: 12 }}>Current Availability Slots</h3>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <span className="spinner" />
            </div>
          ) : slots.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                padding: 20,
                textAlign: "center",
              }}
            >
              No slots set.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {slots.map((slot) => {
                const from = parseISO(slot.validFromDate);
                const to = parseISO(slot.validToDate);
                const label = isSameDay(from, to)
                  ? format(from, "PPP")
                  : `${format(from, "PPP")} – ${format(to, "PPP")}`;
                return (
                  <div
                    key={slot.id}
                    style={{
                      padding: 12,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{label}</strong>
                      <span style={{ marginLeft: 12, fontFamily: "monospace" }}>
                        {slot.startTime} – {slot.endTime}
                      </span>
                      {slot.reason && (
                        <span
                          style={{
                            marginLeft: 12,
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          ({slot.reason})
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEdit(slot)}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (slot.id) deleteMut.mutate(slot.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
