"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import { Instance } from "./InstanceCard";
import { LanguageSelect } from "./LanguageSelect";

interface Props {
  instance: Instance;
  onClose: () => void;
  onSubmit: (id: string, name: string, language: string) => Promise<void>;
}

export function EditInstanceModal({ instance, onClose, onSubmit }: Props) {
  const [name, setName] = useState(instance.name);
  const [language, setLanguage] = useState(instance.language || "pt-BR");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(instance.id, name, language);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px", boxSizing: "border-box" }}>
      <div className="modal glass-panel animate-slide-up" style={{ width: "420px", maxWidth: "100%", padding: "24px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Edit Instance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Instance Name</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Support Bot" required />
          </div>

          <LanguageSelect 
            value={language} 
            onChange={setLanguage} 
            label="Language / Idioma" 
            description="Identifies this instance in all webhook event payloads." 
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <Save size={18} />
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
