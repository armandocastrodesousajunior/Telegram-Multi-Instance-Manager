"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { PhoneCall, Shield, LogOut, MessageCircle, Clock, BellRing, UserCheck } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Instance } from "@/components/InstanceCard";

interface TelegramProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  photo: string | null;
  totalChats?: number;
  unreadChats?: number;
  unreadMessages?: number;
}

interface ConnectionAudit {
  id: string;
  event: "CONNECT" | "DISCONNECT";
  phone: string;
  createdAt: string;
}

export default function ConnectionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [profile, setProfile] = useState<TelegramProfile | null>(null);
  const [audits, setAudits] = useState<ConnectionAudit[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth flow states
  const [phone, setPhone] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [authStep, setAuthStep] = useState<"phone" | "code" | "connected">("phone");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInstance();
  }, [id]);

  const fetchInstance = async () => {
    try {
      const data = await apiClient.get<Instance>(`/api/instances/${id}`);
      setInstance(data);
      if (data.status.toLowerCase() === "connected") {
        setAuthStep("connected");
        fetchProfile();
        fetchAudits();
      } else {
        setAuthStep("phone");
      }
      if (data.phone) {
        setPhone(data.phone);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const p = await apiClient.get<TelegramProfile>(`/api/instances/${id}/profile`);
      setProfile(p);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const fetchAudits = async () => {
    try {
      const a = await apiClient.get<ConnectionAudit[]>(`/api/instances/${id}/audit`);
      setAudits(a);
    } catch (err) {
      console.error("Failed to fetch audits", err);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setIsSubmitting(true);
    setError("");
    try {
      const res = await apiClient.post<{ phoneCodeHash: string }>(`/api/instances/${id}/auth/send-code`, {
        phone
      });
      setPhoneCodeHash(res.phoneCodeHash);
      setAuthStep("code");
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/api/instances/${id}/auth/confirm`, {
        phoneCodeHash,
        code,
        password
      });
      await fetchInstance();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this instance?")) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/instances/${id}/disconnect`);
      setProfile(null);
      setAudits([]);
      await fetchInstance();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !instance) {
    return (
      <main className="main-content">
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </main>
    );
  }

  return (
    <main className="main-content" style={{ display: "flex", flexDirection: "column" }}>
      <header className="page-header animate-fade-in">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 className="page-title">Connection</h1>
            <StatusBadge status={instance.status} />
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Connect and manage the Telegram account for {instance.name}.</p>
        </div>
        {authStep === "connected" && (
          <button 
            className="btn-danger" 
            onClick={handleDisconnect}
            disabled={isSubmitting}
          >
            <LogOut size={16} />
            {isSubmitting ? "Disconnecting..." : "Disconnect Account"}
          </button>
        )}
      </header>

      {authStep === "connected" ? (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="grid grid-cols-1" style={{ gap: "24px", gridTemplateColumns: "1fr 2fr" }}>
            {/* Left: Profile Card */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "32px 20px" }}>
              {profile?.photo ? (
                <img src={profile.photo} alt="Profile" style={{ width: "96px", height: "96px", borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255, 255, 255, 0.1)", marginBottom: "16px" }} />
              ) : (
                <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid rgba(16, 185, 129, 0.2)", marginBottom: "16px" }}>
                  <UserCheck color="var(--success-color)" size={40} />
                </div>
              )}
              <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>
                {profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Active Connection"}
              </h2>
              {profile?.username && (
                <p style={{ color: "var(--accent-primary)", fontSize: "15px", marginBottom: "8px" }}>@{profile.username}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                <PhoneCall size={14} />
                {profile?.phone ? `+${profile.phone}` : instance.phone || "Unknown Number"}
              </div>
            </div>

            {/* Right: Metrics */}
            <div className="grid grid-cols-2" style={{ gap: "24px" }}>
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", color: "var(--text-secondary)" }}>
                  <MessageCircle size={20} />
                  <span style={{ fontSize: "15px", fontWeight: 500 }}>Total Dialogs</span>
                </div>
                <div style={{ fontSize: "36px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {profile?.totalChats !== undefined ? profile.totalChats : "-"}
                </div>
              </div>
              
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", color: "var(--text-secondary)" }}>
                  <BellRing size={20} />
                  <span style={{ fontSize: "15px", fontWeight: 500 }}>Unread Messages</span>
                </div>
                <div style={{ fontSize: "36px", fontWeight: 700, color: "var(--error-color)" }}>
                  {profile?.unreadMessages !== undefined ? profile.unreadMessages : "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Audit Table */}
          <div className="glass-panel">
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} /> Connection Audit Trail
            </h3>
            
            {audits.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "20px 0" }}>No connection history found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", textAlign: "left", fontSize: "14px" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 500 }}>Event</th>
                      <th style={{ padding: "12px 16px", fontWeight: 500 }}>Date & Time</th>
                      <th style={{ padding: "12px 16px", fontWeight: 500 }}>Phone Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((audit) => (
                      <tr key={audit.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "16px" }}>
                          <span className="badge" style={{ 
                            backgroundColor: audit.event === "CONNECT" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: audit.event === "CONNECT" ? "var(--success-color)" : "var(--error-color)",
                            fontSize: "12px", fontWeight: 600 
                          }}>
                            {audit.event}
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: "var(--text-secondary)", fontSize: "14px" }}>
                          {new Date(audit.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "16px", color: "var(--text-secondary)", fontSize: "14px" }}>
                          {audit.phone ? `+${audit.phone}` : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "500px" }}>
            {error && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--error-color)", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                {error}
              </div>
            )}

            {authStep === "phone" ? (
              <form onSubmit={handleSendCode}>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    Phone Number
                  </label>
                  <div style={{ position: "relative" }}>
                    <PhoneCall size={18} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--text-secondary)" }} />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                      placeholder="+5511999999999"
                      style={{ paddingLeft: "40px" }}
                      required
                    />
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>Include country code (e.g., +55 or +1).</p>
                </div>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ width: "100%" }}
                  disabled={isSubmitting || !phone}
                >
                  {isSubmitting ? "Sending..." : "Send Authentication Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmAuth}>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    Telegram Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="input-field"
                    placeholder="12345"
                    required
                  />
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>Enter the code sent to your Telegram app.</p>
                </div>
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    2FA Password (optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    placeholder="Leave blank if not enabled"
                  />
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => setAuthStep("phone")}
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ flex: 2 }}
                    disabled={isSubmitting || !code}
                  >
                    {isSubmitting ? "Connecting..." : "Connect"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
