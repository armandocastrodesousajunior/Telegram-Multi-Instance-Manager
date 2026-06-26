"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Server, Webhook, ChevronLeft, ChevronRight, Eye } from "lucide-react";

type LogTab = "api" | "webhook";

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  responseStatus: number;
  success: boolean;
  createdAt: string;
  requestBody: string | null;
  responseBody: string | null;
}

interface WebhookLog {
  id: string;
  event: string;
  targetUrl: string;
  responseStatus: number | null;
  success: boolean;
  createdAt: string;
  requestPayload: string | null;
  responseBody: string | null;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function InstanceLogsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<LogTab>("api");
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Modal State
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
  }, [router]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === "api") {
        const res = await apiClient.get<{ logs: ApiLog[], pagination: PaginationData }>(`/api/instances/${id}/logs/api?page=${page}&limit=10`);
        setApiLogs(res.logs || []);
        setPagination(res.pagination);
      } else {
        const res = await apiClient.get<{ logs: WebhookLog[], pagination: PaginationData }>(`/api/instances/${id}/logs/webhooks?page=${page}&limit=10`);
        setWebhookLogs(res.logs || []);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: LogTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1); // reset to page 1 on tab switch
  };

  const openDetails = (log: any) => {
    setSelectedLog(log);
  };

  const closeDetails = () => {
    setSelectedLog(null);
  };

  const renderStatusBadge = (status: number | null, success: boolean) => {
    if (status === null) {
      return <span className="badge" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "var(--text-secondary)" }}>N/A</span>;
    }
    const color = success || (status >= 200 && status < 300) ? "var(--success-color)" : "var(--error-color)";
    const bg = success || (status >= 200 && status < 300) ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    return <span className="badge" style={{ backgroundColor: bg, color }}>{status}</span>;
  };

  return (
    <main className="main-content">
      <header className="page-header animate-fade-in">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 className="page-title">Activity Logs</h1>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Track API requests and webhook dispatches.</p>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }} className="animate-fade-in">
        <button 
          className={activeTab === "api" ? "btn-primary" : "btn-secondary"} 
          onClick={() => handleTabChange("api")}
          style={{ flex: 1, padding: "12px" }}
        >
          <Server size={18} />
          Public API Logs
        </button>
        <button 
          className={activeTab === "webhook" ? "btn-primary" : "btn-secondary"} 
          onClick={() => handleTabChange("webhook")}
          style={{ flex: 1, padding: "12px" }}
        >
          <Webhook size={18} />
          Webhook Logs
        </button>
      </div>

      <div className="glass-panel animate-fade-in" style={{ padding: "0" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>Loading logs...</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", textAlign: "left", fontSize: "14px" }}>
                    <th style={{ padding: "16px", fontWeight: 500 }}>Time</th>
                    <th style={{ padding: "16px", fontWeight: 500 }}>{activeTab === "api" ? "Endpoint" : "Event"}</th>
                    <th style={{ padding: "16px", fontWeight: 500 }}>{activeTab === "api" ? "Method" : "Target"}</th>
                    <th style={{ padding: "16px", fontWeight: 500 }}>Status</th>
                    <th style={{ padding: "16px", fontWeight: 500, textAlign: "right" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === "api" && apiLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "16px", fontSize: "14px", fontFamily: "monospace" }}>{log.endpoint}</td>
                      <td style={{ padding: "16px", fontSize: "14px" }}>{log.method}</td>
                      <td style={{ padding: "16px" }}>{renderStatusBadge(log.responseStatus, log.success)}</td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={() => openDetails(log)}>
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {activeTab === "webhook" && webhookLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "16px", fontSize: "14px", fontFamily: "monospace", color: "var(--accent-primary)" }}>{log.event}</td>
                      <td style={{ padding: "16px", fontSize: "14px" }}>{log.targetUrl}</td>
                      <td style={{ padding: "16px" }}>{renderStatusBadge(log.responseStatus, log.success)}</td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={() => openDetails(log)}>
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {((activeTab === "api" && apiLogs.length === 0) || (activeTab === "webhook" && webhookLogs.length === 0)) && (
                    <tr>
                      <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                        No logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="btn-secondary" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button 
                    className="btn-secondary" 
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: "20px"
        }}>
          <div className="glass-panel animate-slide-up" style={{ width: "100%", maxWidth: "800px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 600 }}>Log Details</h3>
              <button onClick={closeDetails} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "24px" }}>&times;</button>
            </div>
            
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "8px" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                {renderStatusBadge(selectedLog.responseStatus, selectedLog.success)}
                <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{new Date(selectedLog.createdAt).toLocaleString()}</span>
              </div>

              {activeTab === "api" ? (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>REQUEST [{selectedLog.method}]</div>
                    <div style={{ fontFamily: "monospace", fontSize: "14px", background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "8px" }}>
                      {selectedLog.endpoint}
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>REQUEST BODY</div>
                    <pre style={{ fontFamily: "monospace", fontSize: "13px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                      {selectedLog.requestBody ? JSON.stringify(JSON.parse(selectedLog.requestBody), null, 2) : "None"}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>EVENT</div>
                    <div style={{ fontFamily: "monospace", fontSize: "14px", background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "8px" }}>
                      {selectedLog.event} &rarr; {selectedLog.targetUrl}
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>PAYLOAD SENT</div>
                    <pre style={{ fontFamily: "monospace", fontSize: "13px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                      {selectedLog.requestPayload ? JSON.stringify(JSON.parse(selectedLog.requestPayload), null, 2) : "None"}
                    </pre>
                  </div>
                </>
              )}

              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>RESPONSE BODY</div>
                <pre style={{ fontFamily: "monospace", fontSize: "13px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                  {selectedLog.responseBody ? JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2) : "None"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
