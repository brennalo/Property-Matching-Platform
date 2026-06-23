import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportApi } from "../../api";
import type { Report } from "../../types";

export default function AdminReportsPage() {
    const qc = useQueryClient();
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [filter, setFilter] = useState<"" | "listing" | "agent">("");
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const { data: reports = [], isLoading } = useQuery<Report[]>({
        queryKey: ["admin-reports"],
        queryFn: () => reportApi.getAll().then((r) => r.data),
    });

    const reportStatusMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            reportApi.updateStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin-reports"] });
            showToast("Report status updated.");
        },
        onError: (e: any) =>
            showToast(e.response?.data?.message ?? "Failed to update report status.", "error"),
    });

    const filteredReports = filter
        ? reports.filter((r) => r.item === filter)
        : reports;

    const statusBadge = (status: string) =>
        status === "Reviewed" ? "badge-green" : "badge-amber";

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
                        {item === "listing" ? "Listing Reports" : item === "agent" ? "Agent Reports" : "All Reports"}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredReports.map((r) => (
                        <div
                            className="card"
                            key={r.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => setSelectedReport(r)}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span className="badge badge-red">
                                        Report - {r.item}
                                    </span>

                                    <p
                                        style={{
                                            marginTop: 8,
                                            marginBottom: 8,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {r.description}
                                    </p>

                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                        Target: {r.itemName} - From: {r.tenantName} ({r.tenantEmail}) - {" "}
                                        {new Date(r.createdAt).toLocaleString("en-MY")}
                                    </div>
                                </div>

                                <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                                    <span className={`badge ${statusBadge(r.status)}`}>
                                        {r.status}
                                    </span>

                                    {r.status !== "Reviewed" ? (
                                        <button
                                            className="btn btn-sm btn-primary"
                                            disabled={reportStatusMut.isPending}
                                            onClick={() => reportStatusMut.mutate({ id: r.id, status: "Reviewed" })}
                                        >
                                            Mark Reviewed
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-sm btn-outline"
                                            disabled={reportStatusMut.isPending}
                                            onClick={() => reportStatusMut.mutate({ id: r.id, status: "Open" })}
                                        >
                                            Reopen
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedReport && (
                <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
            )}

            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}

function ReportModal({
    report,
    onClose,
}: {
    report: Report;
    onClose: () => void;
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 650 }}
            >
                <h2 style={{ marginBottom: 8 }}>Report Details</h2>

                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
                    Type: {report.item} <br />
                    Target: {report.itemName} <br />
                    From: {report.tenantName} ({report.tenantEmail}) <br />
                    Status: {report.status} <br />
                    Submitted: {new Date(report.createdAt).toLocaleString("en-MY")}
                </div>

                <div
                    style={{
                        whiteSpace: "pre-wrap",
                        background: "var(--bg-input)",
                        padding: 14,
                        borderRadius: 8,
                        maxHeight: 360,
                        overflowY: "auto",
                    }}
                >
                    {report.description}
                </div>

                <div className="flex gap-3 mt-4">
                    <button className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
