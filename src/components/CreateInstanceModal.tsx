"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (data: { name: string, type: "USER" | "BOT", botType?: "NORMAL" | "BUSINESS", botToken?: string }) => Promise<void>;
}

export function CreateInstanceModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"USER" | "BOT">("USER");
  const [botType, setBotType] = useState<"NORMAL" | "BUSINESS">("NORMAL");
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, type, botType: type === "BOT" ? botType : undefined, botToken: type === "BOT" ? botToken : undefined } as any);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="modal glass-panel animate-slide-up" style={{ width: "400px", padding: "24px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Create Instance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Instance Name</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Support Account" required />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Instance Type</label>
            <select className="input-field" value={type} onChange={e => setType(e.target.value as any)}>
              <option value="USER">Native Telegram Account (User)</option>
              <option value="BOT">Telegram Bot API</option>
            </select>
          </div>

          {type === "BOT" && (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Bot Type</label>
                <select className="input-field" value={botType} onChange={e => setBotType(e.target.value as any)}>
                  <option value="NORMAL">Standard Bot</option>
                  <option value="BUSINESS">Business Account Bot</option>
                </select>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Bot Token</label>
                <input type="text" className="input-field" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" required />
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <Save size={18} />
              {loading ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
