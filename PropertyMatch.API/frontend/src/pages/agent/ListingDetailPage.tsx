import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingsApi } from "../../api";
import type { Listing, ResidencyType, ImageDto } from "../../types";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

const RESIDENCY_TYPES: ResidencyType[] = [
  "Landed",
  "Condo",
  "Apartment",
  "Townhouse",
  "Studio",
];

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

// ── Image lightbox with zoom ──────────────────────────────────────────────────────────────────────
function ImageLightbox({
  image,
  onClose,
}: {
  image: ImageDto;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [showCaption, setShowCaption] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z - e.deltaY * 0.001, 1), 3));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="fixed inset-0 bg-black" onClick={onClose} />
      <div
        ref={containerRef}
        className="fixed inset-0 flex items-center justify-center z-300"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 z-10"
        >
          <X size={24} />
        </button>

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
            className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-2"
          >
            <ZoomOut size={20} />
          </button>
          <span className="bg-white/10 text-white rounded-lg px-4 py-2 min-w-max text-sm">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.5, 3))}
            className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-2"
          >
            <ZoomIn size={20} />
          </button>
        </div>

        {/* Caption toggle */}
        {image.caption && (
          <button
            onClick={() => setShowCaption(!showCaption)}
            className="absolute top-16 right-4 bg-white/10 hover:bg-white/20 text-white rounded-lg p-2 z-10"
          >
            {showCaption ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        )}

        {/* Image container */}
        <div className="relative w-full h-full overflow-auto flex items-center justify-center">
          <img
            src={image.url}
            alt="Zoomed"
            style={{
              objectFit: "contain",
              maxWidth: "100%",
              maxHeight: "100%",
              transform: `scale(${zoom})`,
              transition: "transform 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Caption pill at bottom */}
        {image.caption && showCaption && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm max-w-xs text-center pointer-events-none">
            {image.caption}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Image grid with drag reorder ──────────────────────────────────────────────────────────────────────
function ImageGrid({
  images,
  onReorder,
  onDeleteImage,
  onUpdateCaption,
  onZoom,
}: {
  images: ImageDto[];
  onReorder: (images: ImageDto[]) => void;
  onDeleteImage: (id: string) => void;
  onUpdateCaption: (id: string, caption: string) => void;
  onZoom: (image: ImageDto) => void;
}) {
  const [draggedItem, setDraggedItem] = useState<ImageDto | null>(null);
  const [editingCaption, setEditingCaption] = useState<{
    [key: string]: string;
  }>({});

  const handleDragStart = (e: React.DragEvent, image: ImageDto) => {
    setDraggedItem(image);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetImage: ImageDto) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetImage.id) return;

    const draggedIdx = images.findIndex((i) => i.id === draggedItem.id);
    const targetIdx = images.findIndex((i) => i.id === targetImage.id);
    const newImages = [...images];
    [newImages[draggedIdx], newImages[targetIdx]] = [
      newImages[targetIdx],
      newImages[draggedIdx],
    ];

    // Update display order
    newImages.forEach((img, idx) => {
      img.displayOrder = idx;
    });

    onReorder(newImages);
    setDraggedItem(null);
  };

  return (
    <div>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12 }}>
        Images ({images.length}/15)
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 12,
        }}
      >
        {images.map((img) => (
          <div
            key={img.id}
            draggable
            onDragStart={(e) => handleDragStart(e, img)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, img)}
            style={{
              position: "relative",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--bg-input)",
              opacity: draggedItem?.id === img.id ? 0.5 : 1,
              cursor: "grab",
            }}
          >
            {/* Image thumbnail */}
            <img
              src={img.url}
              alt={`Image ${img.displayOrder + 1}`}
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
                display: "block",
              }}
              onClick={() => onZoom(img)}
            />

            {/* Drag handle */}
            <div
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                background: "rgba(0,0,0,0.6)",
                borderRadius: 4,
                padding: 2,
                color: "white",
              }}
            >
              <GripVertical size={14} />
            </div>

            {/* Delete button */}
            <button
              onClick={() => onDeleteImage(img.id)}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "rgba(224, 92, 92, 0.8)",
                border: "none",
                borderRadius: 4,
                color: "white",
                padding: 4,
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>

            {/* Order badge */}
            <div
              style={{
                position: "absolute",
                bottom: 4,
                left: 4,
                background: "rgba(0,0,0,0.6)",
                color: "white",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              #{img.displayOrder + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Captions section */}
      {images.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--bg-input)",
            borderRadius: 8,
          }}
        >
          <h4
            style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 12 }}
          >
            Image Captions
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {images.map((img) => (
              <div key={img.id}>
                <label
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  Image #{img.displayOrder + 1} Caption (
                  {(editingCaption[img.id] || img.caption || "").length}/30
                  characters)
                </label>
                <textarea
                  value={
                    editingCaption[img.id] !== undefined
                      ? editingCaption[img.id]
                      : img.caption || ""
                  }
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 30); // enforce max 30 chars
                    setEditingCaption((c) => ({ ...c, [img.id]: value }));
                    onUpdateCaption(img.id, value);
                  }}
                  maxLength={30}
                  placeholder="e.g., Spacious living room"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: 8,
                    fontSize: "0.85rem",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentListingDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [form, setForm] = useState<ListingFormData>({
    name: "",
    rooms: "",
    toilets: "",
    lat: "",
    lng: "",
    address: "",
    residencyType: "Condo",
    price: "",
  });

  const [images, setImages] = useState<ImageDto[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [zoomedImage, setZoomedImage] = useState<ImageDto | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => (id ? listingsApi.getById(id).then((r) => r.data) : null),
    enabled: !!id,
  });

  // Populate form when listing loads
  useEffect(() => {
    if (listing) {
      setForm({
        name: listing.name,
        rooms: String(listing.rooms),
        toilets: String(listing.toilets),
        lat: String(listing.lat),
        lng: String(listing.lng),
        address: listing.address,
        residencyType: listing.residencyType,
        price: String(listing.price),
      });
      setImages(listing.images || []);
    }
  }, [listing]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateMut = useMutation({
    mutationFn: (data: ListingFormData) =>
      listingsApi.update(id!, {
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
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      showToast("Listing details updated!");
    },
    onError: () => showToast("Failed to update listing", "error"),
  });

  const uploadImagesMut = useMutation({
    mutationFn: (files: File[]) => listingsApi.uploadImages(id!, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      setUploadingFiles([]);
      showToast("Images uploaded successfully!");
    },
    onError: (e: any) =>
      showToast(e.response?.data?.message ?? "Upload failed", "error"),
  });

  const reorderImagesMut = useMutation({
    mutationFn: (newImages: ImageDto[]) =>
      listingsApi.reorderImages(
        id!,
        newImages.map((img) => ({
          imageId: img.id,
          displayOrder: img.displayOrder,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      showToast("Images reordered!");
    },
    onError: () => showToast("Failed to reorder images", "error"),
  });

  const deleteImageMut = useMutation({
    mutationFn: (imageId: string) => listingsApi.deleteImage(id!, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      showToast("Image deleted!");
    },
    onError: () => showToast("Failed to delete image", "error"),
  });

  const updateCaptionMut = useMutation({
    mutationFn: ({ imageId, caption }: { imageId: string; caption: string }) =>
      listingsApi.updateImageCaption(id!, imageId, caption),
    onError: () => showToast("Failed to update caption", "error"),
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <p>Listing not found</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => navigate("/agent/listings")}
        >
          Back to Listings
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => navigate("/agent/listings")}
      >
        <ArrowLeft size={14} /> Back to Listings
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          maxWidth: 1200,
        }}
      >
        {/* Left panel: Edit details */}
        <div className="card">
          <h2 style={{ marginBottom: 20, fontSize: "1.2rem", fontWeight: 600 }}>
            Edit Listing Details
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Property Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Skyline Residences"
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Bedrooms</label>
                <input
                  className="input"
                  type="number"
                  value={form.rooms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rooms: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Bathrooms</label>
                <input
                  className="input"
                  type="number"
                  value={form.toilets}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, toilets: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="e.g. Jalan Ampang, KL"
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lat: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lng: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Property Type</label>
              <select
                className="select"
                value={form.residencyType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    residencyType: e.target.value as ResidencyType,
                  }))
                }
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
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={() => updateMut.mutate(form)}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? (
                <span className="spinner" />
              ) : (
                <>
                  <Pencil size={14} /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right panel: Images */}
        <div className="card">
          <h2 style={{ marginBottom: 20, fontSize: "1.2rem", fontWeight: 600 }}>
            Manage Images
          </h2>

          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--border-hi)",
              borderRadius: 10,
              padding: 24,
              textAlign: "center",
              cursor: "pointer",
              background: "var(--bg-input)",
              marginBottom: 20,
            }}
          >
            <Plus
              size={28}
              style={{ margin: "0 auto 8px", color: "var(--text-muted)" }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              {uploadingFiles.length > 0
                ? `${uploadingFiles.length} file(s) selected`
                : "Click to upload images"}
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                marginTop: 4,
              }}
            >
              Max 5MB each, JPG/PNG/WebP. Total max 15 images.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const totalWillBe = images.length + files.length;
                if (totalWillBe > 15) {
                  showToast(
                    `Can only upload ${15 - images.length} more images`,
                    "error",
                  );
                  return;
                }
                setUploadingFiles(files);
              }}
            />
          </div>

          {uploadingFiles.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => uploadImagesMut.mutate(uploadingFiles)}
                disabled={uploadImagesMut.isPending}
              >
                {uploadImagesMut.isPending ? (
                  <span className="spinner" />
                ) : (
                  "Upload"
                )}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setUploadingFiles([])}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Image grid */}
          {images.length > 0 && (
            <ImageGrid
              images={images}
              onReorder={(newImages) => reorderImagesMut.mutate(newImages)}
              onDeleteImage={(imageId) => deleteImageMut.mutate(imageId)}
              onUpdateCaption={(imageId, caption) =>
                updateCaptionMut.mutate({ imageId, caption })
              }
              onZoom={setZoomedImage}
            />
          )}

          {images.length === 0 && uploadingFiles.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: "var(--text-muted)",
              }}
            >
              <p style={{ fontSize: "0.875rem" }}>
                No images yet. Upload your first image!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {zoomedImage && (
        <ImageLightbox
          image={zoomedImage}
          onClose={() => setZoomedImage(null)}
        />
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
