import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportApi } from "../../api";
import type { Report } from "../../types";

const statusBadge = (status: string) => {
    if (status === "Reviewed") return "badge-green";
    if (status === "Rejected") return "badge-red";
    return "badge-amber";
};

const typeBadge = (type: string) => {
    if (type === "agent") return "badge-blue";
    if (type === "listing") return "badge-purple";
    return "badge-amber";
};

function getInitials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function timeAgo(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 365) return `${days} day${days > 1 ? "s" : ""} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? "s" : ""} ago`;
}

export default function AdminReportsPage() {
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [filter, setFilter] = useState<"" | "listing" | "agent">("");
    const qc = useQueryClient();
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            reportApi.updateStatus(id, status),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["admin-reports"] });
            setSelectedReport((prev) =>
                prev && prev.id === variables.id
                    ? { ...prev, status: variables.status }
                    : prev
            );
            showToast("Report status updated.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to update report.", "error"),
    });

    const blockAgentMut = useMutation({
        mutationFn: (id: string) => reportApi.blockAgent(id),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: ["admin-reports"] });
            setSelectedReport((prev) =>
                prev && prev.id === id
                    ? { ...prev, status: "Reviewed" }
                    : prev
            );
            showToast("Agent blocked and report marked as reviewed.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to block agent.", "error"),
    });

    const { data: reports = [], isLoading } = useQuery<Report[]>({
        queryKey: ["admin-reports"],
        queryFn: () => reportApi.getAll().then((r) => r.data),
    });

    const filteredReports = filter
        ? reports.filter((r) => r.item === filter)
        : reports;

    return (
        <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-sub">Monitor reports submitted against listings and agents</p>

            <div className="flex gap-2 mb-5" style={{ flexWrap: "wrap" }}>
                {(["", "listing", "agent"] as const).map((item) => (
                    <button
                        key={item || "all"}
                        className={`btn btn-sm ${filter === item ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setFilter(item)}
                    >
                        {item === "listing"
                            ? "Listing Reports"
                            : item === "agent"
                                ? "Agent Reports"
                                : "All Reports"}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: 60 }}>
                    <span className="spinner" />
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="empty-state">No reports submitted yet</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {filteredReports.map((r) => (
                        <div
                            key={r.id}
                            className="card"
                            style={{
                                cursor: "pointer",
                                padding: 22,
                                borderRadius: 18,
                            }}
                            onClick={() => setSelectedReport(r)}
                        >
                            <div style={{ display: "flex", gap: 16 }}>
                                <div
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        background: "var(--bg-input)",
                                        color: "var(--accent)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: 700,
                                        fontSize: "1rem",
                                    }}
                                >
                                    {getInitials(r.tenantName)}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            <strong>{r.tenantName}</strong>
                                            <span style={{ color: "var(--text-muted)" }}><span>&bull;</span></span>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                {timeAgo(r.createdAt)}
                                            </span>
                                            <span className={`badge ${typeBadge(r.item)}`}>
                                                {r.item.toUpperCase()}
                                            </span>
                                            {r.status !== "Open" && (
                                                <span className={`badge ${statusBadge(r.status)}`}>
                                                    {r.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            margin: "16px 0 10px",
                                            fontSize: "1.15rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {r.itemName}
                                    </div>

                                    <p
                                        style={{
                                            margin: 0,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.6,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {r.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedReport && (
                <ReportModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                    onReject={() =>
                        statusMut.mutate({ id: selectedReport.id, status: "Rejected" })
                    }
                    onMarkReviewed={() =>
                        statusMut.mutate({ id: selectedReport.id, status: "Reviewed" })
                    }
                    onBlockAgent={() => blockAgentMut.mutate(selectedReport.id)}
                    loading={statusMut.isPending || blockAgentMut.isPending}
                />
            )}
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}

function ReportModal({
    report,
    onClose,
    onReject,
    onMarkReviewed,
    onBlockAgent,
    loading,
}: {
    report: Report;
    onClose: () => void;
    onReject: () => void;
    onMarkReviewed: () => void;
    onBlockAgent: () => void;
    loading: boolean;
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 720, padding: 0, overflow: "hidden" }}
            >
                <div
                    style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 style={{ margin: 0, marginBottom: 8 }}>
                                Report Details
                            </h2>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                From: {report.tenantName} ({report.tenantEmail}) <span>&bull;</span>{" "}
                                {timeAgo(report.createdAt)}
                            </div>
                        </div>

                        {report.status !== "Open" && (
                            <span className={`badge ${statusBadge(report.status)}`}>
                                {report.status}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ padding: 24, maxHeight: "65vh", overflowY: "auto" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 16,
                            marginBottom: 24,
                        }}
                    >
                        <InfoCard label="Report Type" value={report.item.toUpperCase()} />
                        <InfoCard label="Reported Target" value={report.itemName} />
                        <InfoCard label="Reporter" value={report.tenantName} />
                        <InfoCard label="Email" value={report.tenantEmail} />
                    </div>

                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 10 }}>
                            Description
                        </div>

                        <div
                            style={{
                                background: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                borderRadius: 12,
                                padding: 16,
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.7,
                            }}
                        >
                            {report.description}
                        </div>
                    </div>

                    <div style={{ marginTop: 18 }}>
                        <div style={{ fontWeight: 600, marginBottom: 10 }}>
                            Evidence Images
                        </div>

                        {report.evidenceImageUrls?.length > 0 ? (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {report.evidenceImageUrls.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer">
                                        <img
                                            src={url}
                                            alt="Report evidence"
                                            style={{
                                                width: 130,
                                                height: 95,
                                                objectFit: "cover",
                                                borderRadius: 8,
                                                border: "1px solid var(--border)",
                                            }}
                                        />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: "var(--text-muted)" }}>
                                No evidence image uploaded.
                            </p>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                    }}
                >
                    {report.status === "Open" ? (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                                className="btn btn-outline"
                                disabled={loading}
                                onClick={onReject}
                            >
                                Reject Report
                            </button>

                            {report.item === "listing" && (
                                <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={onMarkReviewed}
                                >
                                    Mark as Reviewed
                                </button>
                            )}

                            {report.item === "agent" && (
                                <button
                                    className="btn btn-danger"
                                    disabled={loading}
                                    onClick={onBlockAgent}
                                >
                                    Block Agent
                                </button>
                            )}
                        </div>
                    ) : (
                        <div />
                    )}

                    <button className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div
            style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
            }}
        >
            <div
                style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                }}
            >
                {label}
            </div>

            <div style={{ fontWeight: 500, wordBreak: "break-word" }}>
                {value}
            </div>
        </div>
    );
}