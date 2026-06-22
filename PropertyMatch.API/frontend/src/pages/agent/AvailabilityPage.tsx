import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { availabilityApi, listingsApi } from "../../api";
import type {
  AvailabilityTemplate,
  AvailabilityException,
  Listing,
} from "../../types";
import { Plus, Trash2, Save, X } from "lucide-react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [newException, setNewException] = useState<{
    from: string;
    to: string;
    type: "blocked" | "custom_hours";
    startTime: string;
    endTime: string;
    reason: string;
    listingId: string | null;
    slotDurationMinutes: number;
  }>({
    from: "",
    to: "",
    type: "blocked",
    startTime: "09:00",
    endTime: "17:00",
    reason: "",
    listingId: null,
    slotDurationMinutes: 60,
  });
  const [slotDuration, setSlotDuration] = useState(60);
  const [editingTemplateDay, setEditingTemplateDay] = useState<number | null>(
    null,
  );
  const [tempStart, setTempStart] = useState("09:00");
  const [tempEnd, setTempEnd] = useState("17:00");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: summary, isLoading } = useQuery({
    queryKey: ["availability-summary"],
    queryFn: () => availabilityApi.getSummary().then((r) => r.data),
  });

  const { data: listings } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => listingsApi.getMine().then((r) => r.data),
  });

  useEffect(() => {
    if (summary) {
      setTemplates(summary.templates);
      setExceptions(summary.exceptions);
      // Set global slot duration from first template (assuming all templates share the same)
      if (summary.templates.length > 0) {
        setSlotDuration(summary.templates[0].slotDurationMinutes);
      }
    }
  }, [summary]);

  const addTemplatesMut = useMutation({
    mutationFn: (reqs: any[]) => availabilityApi.addTemplates(reqs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-summary"] });
      showToast("Templates updated");
      setEditingTemplateDay(null);
    },
    onError: () => showToast("Failed to update templates", "error"),
  });

  const addExceptionsMut = useMutation({
    mutationFn: (reqs: any[]) => availabilityApi.addExceptions(reqs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-summary"] });
      showToast("Exception added");
      setNewException({
        from: "",
        to: "",
        type: "blocked",
        startTime: "09:00",
        endTime: "17:00",
        reason: "",
        listingId: null,
        slotDurationMinutes: 60,
      });
    },
    onError: () => showToast("Failed to add exception", "error"),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => availabilityApi.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-summary"] });
      showToast("Template deleted");
    },
    onError: () => showToast("Failed to delete template", "error"),
  });

  const deleteExceptionMut = useMutation({
    mutationFn: (id: string) => availabilityApi.deleteException(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability-summary"] });
      showToast("Exception deleted");
    },
    onError: () => showToast("Failed to delete exception", "error"),
  });

  const handleSaveTemplates = () => {
    const reqs = templates
      .filter(
        (tpl) => tpl.startTime && tpl.endTime && tpl.startTime < tpl.endTime,
      )
      .map((tpl) => ({
        dayOfWeek: tpl.dayOfWeek,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        slotDurationMinutes: slotDuration,
        validFrom: null,
        validTo: null,
        listingId: null,
      }));

    if (reqs.length === 0) {
      showToast("Please set at least one active day", "error");
      return;
    }
    addTemplatesMut.mutate(reqs);
  };

  const handleAddException = () => {
    if (!newException.from || !newException.to) {
      showToast("Select date range", "error");
      return;
    }
    addExceptionsMut.mutate([
      {
        exceptionFrom: newException.from,
        exceptionTo: newException.to,
        type: newException.type,
        startTime:
          newException.type === "custom_hours" ? newException.startTime : null,
        endTime:
          newException.type === "custom_hours" ? newException.endTime : null,
        reason: newException.reason || null,
        listingId: newException.listingId || null,
        slotDurationMinutes: newException.slotDurationMinutes,
      },
    ]);
  };

  if (isLoading)
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 className="page-title">My Availability</h1>
      <p className="page-sub">Set your weekly schedule and manage exceptions</p>

      {/* Weekly Templates (always agent-level) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>
          Weekly Schedule (applies to all listings)
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Day</div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Start</div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>End</div>
          <div></div>
          {DAYS.map((day, idx) => {
            const tpl = templates.find((t) => t.dayOfWeek === idx);
            const isEditing = editingTemplateDay === idx;
            return (
              <Fragment key={idx}>
                <span>{day}</span>
                {isEditing ? (
                  <>
                    <input
                      type="time"
                      value={tempStart}
                      onChange={(e) => setTempStart(e.target.value)}
                      style={{ padding: "4px 8px" }}
                    />
                    <input
                      type="time"
                      value={tempEnd}
                      onChange={(e) => setTempEnd(e.target.value)}
                      style={{ padding: "4px 8px" }}
                    />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const updated = templates.filter(
                            (t) => t.dayOfWeek !== idx,
                          );
                          const newTpl: AvailabilityTemplate = {
                            id: tpl?.id || "",
                            dayOfWeek: idx,
                            startTime: tempStart,
                            endTime: tempEnd,
                            slotDurationMinutes: slotDuration,
                            isActive: true,
                            createdAt:
                              tpl?.createdAt || new Date().toISOString(),
                          };
                          setTemplates([...updated, newTpl]);
                          setEditingTemplateDay(null);
                        }}
                      >
                        <Save size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingTemplateDay(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{tpl?.startTime || "—"}</span>
                    <span>{tpl?.endTime || "—"}</span>

                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingTemplateDay(idx);
                          setTempStart(tpl?.startTime || "09:00");
                          setTempEnd(tpl?.endTime || "17:00");
                        }}
                      >
                        ✏️
                      </button>
                      {tpl && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setTemplates(
                              templates.filter((t) => t.dayOfWeek !== idx),
                            );
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </>
                )}
              </Fragment>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label style={{ fontSize: "0.85rem" }}>
            Slot Duration: {slotDuration} min
          </label>
          <input
            type="range"
            min={15}
            max={120}
            step={15}
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value))}
            style={{ flex: 1, maxWidth: 200 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveTemplates}
            disabled={addTemplatesMut.isPending}
          >
            {addTemplatesMut.isPending ? (
              <span className="spinner" />
            ) : (
              "Save Schedule"
            )}
          </button>
        </div>
      </div>

      {/* Exceptions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>
          Exceptions (holidays, custom hours)
        </h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <input
            type="date"
            value={newException.from}
            onChange={(e) =>
              setNewException({ ...newException, from: e.target.value })
            }
            style={{ padding: "6px 10px" }}
          />
          <span>to</span>
          <input
            type="date"
            value={newException.to}
            onChange={(e) =>
              setNewException({ ...newException, to: e.target.value })
            }
            style={{ padding: "6px 10px" }}
          />
          <select
            value={newException.type}
            onChange={(e) =>
              setNewException({ ...newException, type: e.target.value as any })
            }
            style={{ padding: "6px 10px" }}
          >
            <option value="blocked">Blocked</option>
            <option value="custom_hours">Custom Hours</option>
          </select>
          {newException.type === "custom_hours" && (
            <>
              <input
                type="time"
                value={newException.startTime}
                onChange={(e) =>
                  setNewException({
                    ...newException,
                    startTime: e.target.value,
                  })
                }
                style={{ padding: "6px 10px" }}
              />
              <span>–</span>
              <input
                type="time"
                value={newException.endTime}
                onChange={(e) =>
                  setNewException({ ...newException, endTime: e.target.value })
                }
                style={{ padding: "6px 10px" }}
              />
            </>
          )}
          <input
            placeholder="Reason (optional)"
            value={newException.reason}
            onChange={(e) =>
              setNewException({ ...newException, reason: e.target.value })
            }
            style={{ padding: "6px 10px", flex: 1 }}
          />

          <select
            value={newException.listingId || ""}
            onChange={(e) =>
              setNewException({
                ...newException,
                listingId: e.target.value || null,
              })
            }
            style={{ padding: "6px 10px", minWidth: 150 }}
          >
            <option value="">All Listings</option>
            {listings?.map((l: Listing) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <label style={{ fontSize: "0.85rem" }}>
              Slot Duration: {newException.slotDurationMinutes} min
            </label>
            <input
              type="range"
              min={15}
              max={120}
              step={15}
              value={newException.slotDurationMinutes}
              onChange={(e) =>
                setNewException({
                  ...newException,
                  slotDurationMinutes: Number(e.target.value),
                })
              }
              style={{ flex: 1, maxWidth: 200 }}
            />
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleAddException}
            disabled={addExceptionsMut.isPending}
          >
            {addExceptionsMut.isPending ? (
              <span className="spinner" />
            ) : (
              <>
                <Plus size={14} /> Add Exception
              </>
            )}
          </button>
        </div>

        {/* Exception list */}
        {exceptions.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>No exceptions set.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {exceptions.map((ex) => (
              <div
                key={ex.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--bg-input)",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}
              >
                <div>
                  <strong>
                    {new Date(ex.exceptionFrom).toLocaleDateString()} –{" "}
                    {new Date(ex.exceptionTo).toLocaleDateString()}
                  </strong>
                  {ex.type === "blocked" ? (
                    <span style={{ marginLeft: 8, color: "var(--red)" }}>
                      🔴 Blocked
                    </span>
                  ) : (
                    <span style={{ marginLeft: 8 }}>
                      🕒 {ex.startTime} – {ex.endTime} ({ex.slotDurationMinutes}{" "}
                      min slots)
                    </span>
                  )}
                  {ex.reason && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--text-dim)",
                        fontSize: "0.85rem",
                      }}
                    >
                      ({ex.reason})
                    </span>
                  )}
                  {ex.listingId &&
                    listings?.find((l) => l.id === ex.listingId) && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.8rem",
                          color: "var(--accent)",
                        }}
                      >
                        for {listings.find((l) => l.id === ex.listingId)?.name}
                      </span>
                    )}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteExceptionMut.mutate(ex.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
