import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { listingsApi, paymentsApi } from "../../api";
import type {
  Listing,
  ResidencyType,
  BatchListingRow,
  ListingStatus,
} from "../../types";
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
  Coins,
  Sparkles,
  MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const RESIDENCY_TYPES: ResidencyType[] = [
  "Landed",
  "Condo",
  "Apartment",
  "Townhouse",
  "Studio",
  "MasterRoom",
  "SharedRoom",
];

// ──────────────────────────────────────────────────────────────
// 1. Status Badge
// ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Listing["status"] }) {
  const map: Record<string, string> = {
    Active: "badge-green",
    PendingPayment: "badge-amber",
    Draft: "badge-grey",
    Inactive: "badge-red",
    Booked: "badge-amber",
  };
  const icons: Record<string, React.ReactNode> = {
    Active: <CheckCircle2 size={11} />,
    PendingPayment: <CreditCard size={11} />,
    Draft: <Clock size={11} />,
    Inactive: <Ban size={11} />,
    Booked: <Ban size={11} />,
  };
  return (
    <span className={`badge ${map[status] ?? "badge-grey"}`}>
      {icons[status]}{" "}
      {status === "PendingPayment" ? "Pending (Legacy)" : status}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// 2. Listing Form Modal (UPDATED with Map Picker)
// ──────────────────────────────────────────────────────────────

// Helper: reverse geocode
function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat, lng } },
      (results: any[], status: string) => {
        resolve(
          status === "OK" && results[0] ? results[0].formatted_address : "",
        );
      },
    );
  });
}

// Helper: Google Maps ready hook
function useGoogleMapsReady() {
  const [ready, setReady] = useState(!!(window as any).__gmapsReady);
  useEffect(() => {
    if ((window as any).__gmapsReady) return;
    const iv = setInterval(() => {
      if ((window as any).__gmapsReady) {
        clearInterval(iv);
        setReady(true);
      }
    }, 150);
    return () => clearInterval(iv);
  }, []);
  return ready;
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
  description: string;
  amenities: string;
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
  const mapsReady = useGoogleMapsReady();

  // ── Form state (non-location) ──
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    rooms: initial?.rooms?.toString() ?? "",
    toilets: initial?.toilets?.toString() ?? "",
    residencyType: initial?.residencyType ?? ("Condo" as ResidencyType),
    price: initial?.price?.toString() ?? "",
    description: initial?.description ?? "",
    amenities: initial?.amenities ?? "",
  });

  // ── Location state ──
  const [location, setLocation] = useState<{
    address: string;
    lat: number | null;
    lng: number | null;
  }>({
    address: initial?.address ?? "",
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
  });

  // ── Refs for map and autocomplete ──
  const mapDivRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  const COMMON_AMENITIES = [
    "Air Conditioner",
    "Bed",
    "Fridge",
    "Water Heater",
    "Washing Machine",
    "WiFi",
    "TV",
    "Microwave",
    "Wardrobe",
    "Sofa",
  ];

  const initialAmenities = form.amenities
    ? form.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    initialAmenities.filter((a) => COMMON_AMENITIES.includes(a)),
  );
  const [customAmenities, setCustomAmenities] = useState<string[]>(
    initialAmenities.filter((a) => !COMMON_AMENITIES.includes(a)),
  );
  const [customInput, setCustomInput] = useState("");

  const toggleAmenity = (item: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item],
    );
  };

  const addCustomAmenity = () => {
    const trimmed = customInput.trim();
    if (trimmed && !customAmenities.includes(trimmed)) {
      setCustomAmenities((prev) => [...prev, trimmed]);
      setCustomInput("");
    }
  };

  // Keep form.amenities in sync whenever selections change
  const syncAmenities = (selected: string[], custom: string[]) => {
    const combined = [...selected, ...custom].join(", ");
    updateForm("amenities", combined);
  };

  const removeCustomAmenity = (item: string) => {
    setCustomAmenities((prev) => prev.filter((a) => a !== item));
  };
  useEffect(() => {
    syncAmenities(selectedAmenities, customAmenities);
  }, [selectedAmenities, customAmenities]);

  // ── AI Description Generator ──
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const handleGenerateDescription = async () => {
    if (!form.name || !location.address || !form.price) {
      setGenError("Fill in name, address, and price first.");
      return;
    }
    setGenerating(true);
    setGenError("");
    try {
      const { data } = await listingsApi.generateDescription({
        name: form.name,
        rooms: parseInt(form.rooms) || 0,
        toilets: parseInt(form.toilets) || 0,
        address: location.address,
        residencyType: form.residencyType,
        price: parseFloat(form.price) || 0,
        extraDetails: form.description.trim() || undefined,
      });
      setForm((f) => ({ ...f, description: data.description }));
    } catch (e: any) {
      setGenError(
        e.response?.data?.message ?? "Failed to generate description.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const updateForm = (k: keyof typeof form, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const coordsSet = location.lat != null && location.lng != null;

  // ── Initialise map and autocomplete ──
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current) return;

    const center =
      location.lat && location.lng
        ? { lat: location.lat, lng: location.lng }
        : { lat: 3.1478, lng: 101.6953 };

    const map = new (window as any).google.maps.Map(mapDivRef.current, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    });
    mapRef.current = map;

    if (location.lat && location.lng) {
      markerRef.current = new (window as any).google.maps.Marker({
        position: center,
        map,
        draggable: true,
      });
    }

    map.addListener("click", async (e: any) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (markerRef.current) {
        markerRef.current.setPosition(e.latLng);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: e.latLng,
          map,
          draggable: true,
        });
      }
      const addr = await reverseGeocode(lat, lng);
      setLocation({ address: addr, lat, lng });
      if (addressInputRef.current) addressInputRef.current.value = addr;
    });

    // Drag end listener
    markerRef.current?.addListener("dragend", async () => {
      const pos = markerRef.current?.getPosition();
      if (!pos) return;
      const lat = pos.lat();
      const lng = pos.lng();
      const addr = await reverseGeocode(lat, lng);
      setLocation({ address: addr, lat, lng });
      if (addressInputRef.current) addressInputRef.current.value = addr;
    });

    // Autocomplete
    if (addressInputRef.current) {
      const ac = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          componentRestrictions: { country: "my" },
          fields: ["formatted_address", "geometry"],
        },
      );
      autocompleteRef.current = ac;
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr =
          place.formatted_address ?? addressInputRef.current?.value ?? "";
        setLocation({ address: addr, lat, lng });
        const pos = { lat, lng };
        if (markerRef.current) {
          markerRef.current.setPosition(pos);
        } else {
          markerRef.current = new window.google.maps.Marker({
            position: pos,
            map,
            draggable: true,
          });
        }
        map.panTo(pos);
        map.setZoom(16);
      });
    }

    setTimeout(() => window.google.maps.event.trigger(map, "resize"), 100);

    return () => {
      autocompleteRef.current = null;
    };
  }, [mapsReady]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 20 }}>
          {initial ? "Edit Listing" : "New Listing"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Property Name */}
          <div className="form-group">
            <label className="form-label">Property Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="e.g. Skyline Residences Unit 12A"
            />
          </div>

          {/* Rooms / Toilets */}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Bedrooms</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.rooms}
                onChange={(e) => updateForm("rooms", e.target.value)}
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
                onChange={(e) => updateForm("toilets", e.target.value)}
              />
            </div>
          </div>

          {/* ── LOCATION PICKER ── */}
          <div className="form-group">
            <label className="form-label">Address / Location</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  ref={addressInputRef}
                  className="input"
                  type="text"
                  autoComplete="off"
                  placeholder={
                    mapsReady ? "Search for an address…" : "Loading maps…"
                  }
                  defaultValue={location.address}
                  onInput={() => {
                    if (location.lat != null) {
                      setLocation((loc) => ({ ...loc, lat: null, lng: null }));
                    }
                  }}
                  style={{ paddingRight: coordsSet ? 34 : undefined }}
                />
                {coordsSet && (
                  <CheckCircle2
                    size={16}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--accent)",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>
            {coordsSet && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--accent)",
                  marginTop: 5,
                }}
              >
                ✓ Location confirmed · {location.lat!.toFixed(5)},{" "}
                {location.lng!.toFixed(5)}
              </p>
            )}
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                marginTop: 5,
              }}
            >
              Type an address and select from the dropdown, or click directly on
              the map below.
            </p>
          </div>

          {/* ── MAP ── */}
          <div
            ref={mapDivRef}
            style={{
              width: "100%",
              height: 280,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-input)",
              marginTop: 4,
            }}
          />

          {/* Residency Type */}
          <div className="form-group">
            <label className="form-label">Property Type</label>
            <select
              className="select"
              value={form.residencyType}
              onChange={(e) => updateForm("residencyType", e.target.value)}
            >
              {RESIDENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="form-group">
            <label className="form-label">Monthly Rent (RM)</label>
            <input
              className="input"
              type="number"
              min={0}
              step={50}
              value={form.price}
              onChange={(e) => updateForm("price", e.target.value)}
              placeholder="e.g. 2500"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Amenities</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {COMMON_AMENITIES.map((item) => (
                <label
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    borderColor: selectedAmenities.includes(item)
                      ? "var(--accent)"
                      : "var(--border)",
                    background: selectedAmenities.includes(item)
                      ? "var(--accent-dim)"
                      : "var(--bg-input)",
                    color: selectedAmenities.includes(item)
                      ? "var(--accent)"
                      : "var(--text-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(item)}
                    onChange={() => toggleAmenity(item)}
                    style={{ display: "none" }}
                  />
                  {item}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomAmenity();
                  }
                }}
                placeholder="Add custom amenity (e.g. Balcony) and press Enter"
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={addCustomAmenity}
              >
                Add
              </button>
            </div>

            {customAmenities.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {customAmenities.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      fontSize: "0.78rem",
                    }}
                  >
                    {item}
                    <span
                      onClick={() => removeCustomAmenity(item)}
                      style={{ cursor: "pointer", fontWeight: 700 }}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Description + AI */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 6 }}
            >
              <label className="form-label" style={{ margin: 0 }}>
                Description (type notes, then click Generate to expand)
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleGenerateDescription}
                disabled={generating}
              >
                {generating ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <Sparkles size={13} /> Generate with AI
                  </>
                )}
              </button>
            </div>
            <textarea
              className="input"
              rows={4}
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Type any details you want included (e.g. near LRT, renovated kitchen), then click 'Generate with AI' to expand into a full description or click 'Generate with AI' for suggestions"
            />
            {genError && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: "0.8rem",
                  marginTop: 6,
                  marginBottom: 0,
                }}
              >
                {genError}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const data: ListingFormData = {
                  name: form.name,
                  rooms: form.rooms,
                  toilets: form.toilets,
                  lat: location.lat?.toString() ?? "",
                  lng: location.lng?.toString() ?? "",
                  address: location.address,
                  residencyType: form.residencyType,
                  price: form.price,
                  description: form.description,
                  amenities: form.amenities,
                };
                onSave(data);
              }}
              disabled={
                !form.name ||
                !location.address ||
                !form.price ||
                loading ||
                !coordsSet
              }
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 3. Image Upload Modal
// ──────────────────────────────────────────────────────────────
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
      let errorMessage = "Upload failed";
      if (e.response?.data) {
        errorMessage =
          e.response.data.message ||
          e.response.data.title ||
          e.response.data.error ||
          "Upload failed";
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
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
                  : "Click to select images (JPG, PNG, WebP · max 20MB each)"}
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

// ──────────────────────────────────────────────────────────────
// 4. Batch Upload Modal
// ──────────────────────────────────────────────────────────────
function BatchUploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [imageTarget, setImageTarget] = useState<Listing | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Excel file handling ────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      // const listings: BatchListingRow[] = json.map((row) => ({
      //   PropertyName: row["PropertyName"] || row["Property Name"] || "",
      //   Bedrooms: parseInt(row["Bedrooms"] || "0"),
      //   Bathrooms: parseInt(row["Bathrooms"] || "0"),
      //   Toilets: parseInt(row["Toilets"] || "0"),
      //   Address: row["Address"] || "",
      //   Price: parseFloat(row["Price"] || "0"),
      //   Type: row["Type"] || "Condo",
      //   Latitude: parseFloat(row["Latitude"] || row["Lat"] || "0"),
      //   Longitude: parseFloat(row["Longitude"] || row["Lng"] || "0"),
      //   Description: row["Description"] || "",
      //   Amenities: row["Amenities"] || "",
      // }));

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
        Amenities: row["Amenities"] || "",
      }));

      setLoading(true);
      const res = await listingsApi.batchCreate(listings);
      setResult(res.data);
      setCreatedIds(res.data.createdIds || []);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "Upload failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Listings");
    worksheet.columns = [
      { header: "PropertyName", key: "PropertyName", width: 25 },
      { header: "Bedrooms", key: "Bedrooms", width: 10 },
      { header: "Bathrooms", key: "Bathrooms", width: 10 },
      { header: "Toilets", key: "Toilets", width: 10 },
      { header: "Address", key: "Address", width: 40 },
      { header: "Price", key: "Price", width: 15 },
      { header: "Type", key: "Type", width: 15 },
      { header: "Latitude", key: "Latitude", width: 15 },
      { header: "Longitude", key: "Longitude", width: 15 },
      { header: "Description", key: "Description", width: 40 },
      { header: "Amenities", key: "Amenities", width: 30 },
    ];
    worksheet.addRow({
      PropertyName: "Example Property",
      Bedrooms: 3,
      Bathrooms: 2,
      Toilets: 2,
      Address: "Jalan Ampang, KL",
      Price: 2500,
      Type: "Condo",
      Latitude: 3.1478,
      Longitude: 101.6953,
      Description: "A nice condominium with pool and gym",
      Amenities: "Air conditioner, Bed, Fridge",
    });

    const allowedTypes = [
      "Landed",
      "Condo",
      "Apartment",
      "Townhouse",
      "Studio",
      "MasterRoom",
      "SharedRoom",
    ];
    for (let row = 2; row <= 100; row++) {
      const cell = worksheet.getCell(`G${row}`);
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`"${allowedTypes.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Property Type",
        error: "Please select from the dropdown list.",
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "batch_listings_template.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── ZIP upload handling ────────────────────────────────
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    try {
      const res = await listingsApi.batchZipUpload(formData);
      setResult(res.data);
      setCreatedIds(res.data.createdIds || []);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e: any) {
      showToast(e.response?.data?.message ?? "ZIP upload failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadZipTemplate = async () => {
    try {
      const res = await api.get("/listings/batch-template-zip", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "batch_template.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("Failed to download ZIP template", "error");
    }
  };

  // ── Query for created listings ──
  const { data: newListings } = useQuery({
    queryKey: ["batch-listings", createdIds],
    queryFn: () =>
      Promise.all(
        createdIds.map((id) => listingsApi.getById(id).then((r) => r.data)),
      ),
    enabled: createdIds.length > 0,
    staleTime: 60000,
  });

  // ── Render ──
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
          Import multiple listings from an Excel file or a ZIP archive.
        </p>

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
          ⚠️ <strong>Images not supported in plain Excel batch mode.</strong>{" "}
          Upload images individually after import.
          <br />
          ⚠️ <strong>Amenities</strong> should be comma‑separated (e.g., "Air
          conditioner, Bed, Fridge").
          <br />
          ⚠️ For images, use the <strong>ZIP upload</strong> (Excel + images
          folder) below.
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

            {newListings && newListings.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "left" }}>
                <h4 style={{ marginBottom: 8 }}>
                  Add images to your listings:
                </h4>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {newListings.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--bg-input)",
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{l.name}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setImageTarget(l)}
                      >
                        <ImagePlus size={14} /> Add Images
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-outline"
                  style={{ marginTop: 12 }}
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            )}
            {(!newListings || newListings.length === 0) && (
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Excel upload section */}
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
            <div className="flex gap-3" style={{ marginBottom: 20 }}>
              <button className="btn btn-outline" onClick={downloadTemplate}>
                Download Excel Template
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

            <div
              style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}
            >
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                <strong>Or upload a ZIP with Excel + images:</strong>
              </p>
              <div className="flex gap-3">
                <button
                  className="btn btn-outline"
                  onClick={downloadZipTemplate}
                >
                  Download ZIP Template
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => document.getElementById("zip-upload")?.click()}
                >
                  Upload ZIP
                </button>
                <input
                  id="zip-upload"
                  type="file"
                  accept=".zip"
                  style={{ display: "none" }}
                  onChange={handleZipUpload}
                />
              </div>
            </div>
          </>
        )}

        {imageTarget && (
          <ImageUploadModal
            listing={imageTarget}
            onClose={() => {
              setImageTarget(null);
              qc.invalidateQueries({
                queryKey: ["batch-listings", createdIds],
              });
            }}
          />
        )}

        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 5. Main Agent Listings Page
// ──────────────────────────────────────────────────────────────
export default function AgentListingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
    setTimeout(() => setToast(null), 10000);
  };

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => listingsApi.getMine().then((r) => r.data),
  });

  const { data: balanceData } = useQuery({
    queryKey: ["token-balance"],
    queryFn: () => paymentsApi.getTokenBalance().then((r) => r.data),
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
        description: data.description,
        amenities: data.amenities || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setShowForm(false);
      showToast("Listing created and is now active!");
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
        description: data.description || undefined,
        amenities: data.amenities || undefined,
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

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ListingStatus }) =>
      listingsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      showToast("Listing status updated!");
    },
    onError: (e: any) =>
      showToast(
        e.response?.data?.message ?? "Failed to update status",
        "error",
      ),
  });

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get("payment");

  const { user } = useAuth();

  const canCreateListing = user?.status === "Verified";

  const getApprovalMessage = () => {
    if (user?.status === "Pending")
      return "Please verify your email before creating listings.";
    if (user?.status === "Unapproved")
      return "Your account is awaiting admin approval. You cannot create listings yet.";
    if (user?.status === "Blocked")
      return "Your account has been blocked. You cannot create listings.";
    return "Only verified agents can create listings.";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">My Listings</h1>
          <p className="page-sub">Manage your property listings</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate("/agent/topup")}
          >
            <Coins size={14} /> {balanceData?.tokenBalance ?? 0} tokens
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              if (!canCreateListing) {
                showToast(getApprovalMessage(), "error");
                return;
              }
              setShowBatch(true);
            }}
          >
            <Download size={15} /> Batch Import
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!canCreateListing) {
                showToast(getApprovalMessage(), "error");
                return;
              }
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
            onClick={() => {
              if (!canCreateListing) {
                showToast(getApprovalMessage(), "error");
                return;
              }
              setShowForm(true);
            }}
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
                  {l.status === "Active" && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        statusMut.mutate({ id: l.id, status: "Booked" })
                      }
                    >
                      Mark as Booked
                    </button>
                  )}
                  {l.status === "Booked" && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() =>
                        statusMut.mutate({ id: l.id, status: "Active" })
                      }
                    >
                      Mark as Active
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (!canCreateListing) {
                        showToast(getApprovalMessage(), "error");
                        return;
                      }
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
