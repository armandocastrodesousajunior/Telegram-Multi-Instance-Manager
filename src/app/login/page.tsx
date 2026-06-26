"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Server, Lock } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const existing = localStorage.getItem("token");
    if (existing) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Assuming a generic login endpoint, or if we just set the token directly.
      // Often you might POST to /api/auth/login, but if it's token-based statically:
      // Let's assume we validate it or just save it.
      // We will just save it and verify on dashboard.
      localStorage.setItem("token", token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "rgba(99, 102, 241, 0.1)",
            color: "var(--accent-color)",
            marginBottom: "16px"
          }}>
            <Server size={32} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Welcome Back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Enter your access token to continue.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Access Token</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input 
                type="password"
                className="input-field"
                placeholder="Paste your token here..."
                style={{ paddingLeft: "42px" }}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--error-color)", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: "100%", marginTop: "8px" }}
            disabled={loading || !token}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
