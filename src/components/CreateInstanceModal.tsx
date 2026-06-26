"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function CreateInstanceModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(name);
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
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Instance Name</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Support Bot" required />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
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
