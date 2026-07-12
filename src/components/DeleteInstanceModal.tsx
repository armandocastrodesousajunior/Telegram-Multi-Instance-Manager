"use client";
import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Instance } from "./InstanceCard";

interface Props {
  instance: Instance;
  onClose: () => void;
  onSubmit: (id: string) => Promise<void>;
}

export function DeleteInstanceModal({ instance, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(instance.id);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="modal glass-panel animate-slide-up" style={{ width: "400px", padding: "24px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Delete Instance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "24px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.5" }}>
            Are you sure you want to delete <strong>{instance.name}</strong>? This action cannot be undone. All related data and settings will be permanently removed.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ background: "var(--danger-color)", borderColor: "var(--danger-color)" }} disabled={loading}>
              <Trash2 size={18} />
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
