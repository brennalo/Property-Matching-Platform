import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingsApi, paymentsApi } from "../../api";
import type { Listing, ResidencyType, BatchListingRow } from "../../types";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  ImagePlus,
  CheckCircle2,
  Clock,
  Ban,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";

const RESIDENCY_TYPES: ResidencyType[] = [
  "Landed",
  "Condo",
  "Apartment",
  "Townhouse",
  "Studio",
];

function StatusBadge({ status }: { status: Listing["status"] }) {
  const map: Record<string, string> = {
    Active: "badge-green",
    PendingPayment: "badge-amber",
    Draft: "badge-grey",
    Inactive: "badge-red",
  };
  const icons: Record<string, React.ReactNode> = {
    Active: <CheckCircle2 size={11} />,
    PendingPayment: <CreditCard size={11} />,
    Draft: <Clock size={11} />,
    Inactive: <Ban size={11} />,
  };
  return (
    <span className={`badge ${map[status] ?? "badge-grey"}`}>
      {icons[status]}{" "}
      {status === "PendingPayment" ? "Awaiting Payment" : status}
    </span>
  );
}

interface ListingFormData {
  name: string;
  rooms: string;
  toilets: string;
  lat: string;
  lng: string;
  address: string;
  residencyType: ResidencyType;
  price: string;
}

function ListingFormModal({
  initial,
  onSave,
  onClose,
  loading,
}: {
  initial?: Listing;
  onSave: (data: ListingFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ListingFormData>({
    name: initial?.name ?? "",
    rooms: initial?.rooms?.toString() ?? "",
    toilets: initial?.toilets?.toString() ?? "",
    lat: initial?.lat?.toString() ?? "",
    lng: initial?.lng?.toString() ?? "",
    address: initial?.address ?? "",
    residencyType: initial?.residencyType ?? "Condo",
    price: initial?.price?.toString() ?? "",
  });
  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 20 }}>
          {initial ? "Edit Listing" : "New Listing"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Property Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="e.g. Skyline Residences Unit 12A"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Bedrooms</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.rooms}
                onChange={(e) => upd("rooms", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bathrooms</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.toilets}
                onChange={(e) => upd("toilets", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => upd("address", e.target.value)}
              placeholder="e.g. Jalan Ampang, 50450 Kuala Lumpur"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => upd("lat", e.target.value)}
                placeholder="e.g. 3.1478"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => upd("lng", e.target.value)}
                placeholder="e.g. 101.6953"
              />
            </div>
          </div>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--text-dim)",
              marginTop: -8,
            }}
          >
            💡 Right-click on Google Maps → "What's here?" to get coordinates
          </p>

          <div className="form-group">
            <label className="form-label">Property Type</label>
            <select
              className="select"
              value={form.residencyType}
              onChange={(e) => upd("residencyType", e.target.value)}
            >
              {RESIDENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Rent (RM)</label>
            <input
              className="input"
              type="number"
              min={0}
              step={50}
              value={form.price}
              onChange={(e) => upd("price", e.target.value)}
              placeholder="e.g. 2500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(form)}
            disabled={!form.name || !form.address || !form.price || loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : initial ? (
              "Save Changes"
            ) : (
              "Create Listing"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageUploadModal({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    setError("");
    try {
      await listingsApi.uploadImages(listing.id, files);
      setSuccess(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 6 }}>Upload Images</h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            marginBottom: 20,
          }}
        >
          {listing.name}
        </p>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
            <p>Images uploaded successfully!</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                border: "2px dashed var(--border-hi)",
                borderRadius: 10,
                padding: "32px",
                textAlign: "center",
                cursor: "pointer",
                background: "var(--bg-input)",
              }}
              onClick={() => document.getElementById("img-upload")?.click()}
            >
              <ImagePlus
                size={28}
                color="var(--text-muted)"
                style={{ marginBottom: 8 }}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {files.length > 0
                  ? `${files.length} file(s) selected`
                  : "Click to select images (JPG, PNG, WebP · max 5MB each)"}
              </p>
              <input
                id="img-upload"
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </div>

            {files.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "4px 10px",
                      background: "var(--bg-input)",
                      borderRadius: 6,
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {f.name}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: "0.85rem",
                  marginTop: 8,
                }}
              >
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <button className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!files.length || loading}
              >
                {loading ? <span className="spinner" /> : "Upload"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BatchUploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      // Map XLSX columns to BatchListingRequest
      const listings: BatchListingRow[] = json.map((row) => ({
        PropertyName: row["PropertyName"] || row["Property Name"] || "",
        Bedrooms: parseInt(row["Bedrooms"] || row["Bedrooms"] || "0"),
        Bathrooms: parseInt(row["Bathrooms"] || row["Bathrooms"] || "0"),
        Toilets: parseInt(row["Toilets"] || row["Toilets"] || "0"),
        Address: row["Address"] || "",
        Price: parseFloat(row["Price"] || "0"),
        Type: row["Type"] || "Condo",
        Latitude: parseFloat(row["Latitude"] || row["Lat"] || "0"),
        Longitude: parseFloat(row["Longitude"] || row["Lng"] || "0"),
        Description: row["Description"] || "",
      }));

      setFiles([file]);
    } catch (e: any) {
      showToast("Failed to parse Excel file", "error");
    }
  };

  const handleUpload = async () => {
    if (!files.length) return;

    try {
      const data = await files[0].arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      const listings: BatchListingRow[] = json.map((row) => ({
        PropertyName: row["PropertyName"] || row["Property Name"] || "",
        Bedrooms: parseInt(row["Bedrooms"] || "0"),
        Bathrooms: parseInt(row["Bathrooms"] || "0"),
        Toilets: parseInt(row["Toilets"] || "0"),
        Address: row["Address"] || "",
        Price: parseFloat(row["Price"] || "0"),
        Type: row["Type"] || "Condo",
        Latitude: parseFloat(row["Latitude"] || row["Lat"] || "0"),
        Longitude: parseFloat(row["Longitude"] || row["Lng"] || "0"),
        Description: row["Description"] || "",
      }));

      setLoading(true);
      const res = await listingsApi.batchCreate(listings);
      setResult(res.data);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Upload failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        PropertyName: "Example Property",
        Bedrooms: 3,
        Bathrooms: 2,
        Toilets: 2,
        Address: "Jalan Ampang, KL",
        Price: 2500,
        Type: "Condo",
        Latitude: 3.1478,
        Longitude: 101.6953,
        Description: "Nice property",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Listings");
    XLSX.writeFile(wb, "batch_listings_template.xlsx");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 6 }}>Batch Upload Listings</h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            marginBottom: 20,
          }}
        >
          Import multiple listings from an Excel file
        </p>

        {/* Warning banner */}
        <div
          style={{
            background: "rgba(232, 160, 69, 0.1)",
            border: "1px solid rgba(232, 160, 69, 0.3)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            fontSize: "0.85rem",
            color: "var(--accent)",
          }}
        >
          ⚠️ <strong>Images not supported in batch mode.</strong> Upload images
          individually after importing listings using the listing detail page.
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Import Complete!</p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: 12,
              }}
            >
              {result?.successCount} successful, {result?.failureCount} failed
            </p>
            {result?.errors && result.errors.length > 0 && (
              <div
                style={{
                  textAlign: "left",
                  background: "var(--bg-input)",
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: "0.8rem",
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {result.errors.map((err: string, i: number) => (
                  <div key={i} style={{ color: "var(--red)", marginBottom: 4 }}>
                    {err}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                border: "2px dashed var(--border-hi)",
                borderRadius: 10,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                background: "var(--bg-input)",
                marginBottom: 16,
              }}
              onClick={() => document.getElementById("batch-upload")?.click()}
            >
              <Download
                size={28}
                style={{ margin: "0 auto 8px", color: "var(--text-muted)" }}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {files.length > 0
                  ? files[0].name
                  : "Click to select Excel file"}
              </p>
              <input
                id="batch-upload"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex gap-3">
              <button className="btn btn-outline" onClick={downloadTemplate}>
                Download Template
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!files.length || loading}
                style={{ flex: 1 }}
              >
                {loading ? <span className="spinner" /> : "Upload & Import"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AgentListingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [editTarget, setEditTarget] = useState<Listing | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => listingsApi.getMine().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: ListingFormData) =>
      listingsApi.create({
        name: data.name,
        rooms: parseInt(data.rooms),
        toilets: parseInt(data.toilets),
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lng),
        address: data.address,
        residencyType: data.residencyType,
        price: parseFloat(data.price),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setShowForm(false);
      showToast("Listing created! Proceed to payment to activate it.");
    },
    onError: (e: any) =>
      showToast(
        e.response?.data?.message ?? "Failed to create listing",
        "error",
      ),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListingFormData }) =>
      listingsApi.update(id, {
        name: data.name,
        rooms: parseInt(data.rooms),
        toilets: parseInt(data.toilets),
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lng),
        address: data.address,
        residencyType: data.residencyType,
        price: parseFloat(data.price),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setEditTarget(null);
      showToast("Listing updated!");
    },
    onError: () => showToast("Failed to update listing", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => listingsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      showToast("Listing deleted");
    },
    onError: () => showToast("Failed to delete", "error"),
  });

  const handlePayment = async (listingId: string) => {
    setPayLoading(listingId);
    try {
      const { data } = await paymentsApi.createCheckout(listingId);
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Payment setup failed", "error");
    } finally {
      setPayLoading(null);
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get("payment");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">My Listings</h1>
          <p className="page-sub">Manage your property listings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowBatch(true)}
          >
            <Download size={15} /> Batch Import
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setEditTarget(null);
            }}
          >
            <Plus size={15} /> New Listing
          </button>
        </div>
      </div>

      {paymentStatus === "success" && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--teal-dim)",
            border: "1px solid var(--teal)",
            borderRadius: "var(--radius)",
            color: "var(--teal)",
            marginBottom: 16,
            fontSize: "0.875rem",
          }}
        >
          ✅ Payment successful! Your listing is now active.
        </div>
      )}
      {paymentStatus === "cancelled" && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius)",
            color: "var(--red)",
            marginBottom: 16,
            fontSize: "0.875rem",
          }}
        >
          ❌ Payment was cancelled. Your listing remains inactive.
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏢</div>
          <p style={{ fontWeight: 500 }}>No listings yet</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => setShowForm(true)}
          >
            <Plus size={15} /> Create Your First Listing
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listings.map((l) => (
            <div
              key={l.id}
              className="card"
              onClick={() => navigate(`/agent/listings/${l.id}`)}
              style={{ cursor: "pointer" }}
            >
              <div className="flex gap-4 items-start">
                {l.images && l.images.length > 0 ? (
                  <img
                    src={l.images[0].url}
                    alt={l.name}
                    style={{
                      width: 100,
                      height: 72,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 100,
                      height: 72,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2rem",
                      position: "relative",
                    }}
                  >
                    🏠
                    <span
                      className="badge badge-grey"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        fontSize: "0.7rem",
                      }}
                    >
                      No Photos
                    </span>
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 600 }}>{l.name}</span>
                    <StatusBadge status={l.status} />
                  </div>
                  <div
                    style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                  >
                    {l.rooms} bed · {l.toilets} bath · {l.residencyType} ·{" "}
                    {l.address}
                  </div>
                  <div
                    style={{
                      color: "var(--accent)",
                      fontFamily: "DM Serif Display, serif",
                      marginTop: 4,
                    }}
                  >
                    RM {l.price.toLocaleString()}/mo
                  </div>
                </div>

                <div
                  className="flex gap-2"
                  style={{
                    flexShrink: 0,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {l.status === "PendingPayment" && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePayment(l.id)}
                      disabled={payLoading === l.id}
                    >
                      {payLoading === l.id ? (
                        <span className="spinner" />
                      ) : (
                        <>
                          <CreditCard size={13} /> Pay to Activate
                        </>
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditTarget(l);
                      setShowForm(true);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (confirm(`Delete "${l.name}"?`))
                        deleteMut.mutate(l.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ListingFormModal
          initial={editTarget ?? undefined}
          onSave={(data) =>
            editTarget
              ? updateMut.mutate({ id: editTarget.id, data })
              : createMut.mutate(data)
          }
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          loading={createMut.isPending || updateMut.isPending}
        />
      )}

      {showBatch && <BatchUploadModal onClose={() => setShowBatch(false)} />}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
