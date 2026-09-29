"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import { Instance } from "./InstanceCard";

import { POPULAR_LANGUAGES } from "@/lib/languages";

interface Props {
  instance: Instance;
  onClose: () => void;
  onSubmit: (id: string, name: string, language: string) => Promise<void>;
}

export function EditInstanceModal({ instance, onClose, onSubmit }: Props) {
  const [name, setName] = useState(instance.name);
  const currentLang = instance.language || "pt-BR";
  const isPredefined = POPULAR_LANGUAGES.some(l => l.code.toLowerCase() === currentLang.toLowerCase());

  const [language, setLanguage] = useState(isPredefined ? currentLang : "pt-BR");
  const [isCustomLang, setIsCustomLang] = useState(!isPredefined);
  const [customLang, setCustomLang] = useState(!isPredefined ? currentLang : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const finalLanguage = isCustomLang ? (customLang.trim() || 'pt-BR') : language;
    await onSubmit(instance.id, name, finalLanguage);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="modal glass-panel animate-slide-up" style={{ width: "420px", padding: "24px", position: "relative" }}>
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

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
              Language / Idioma
            </label>
            {!isCustomLang ? (
              <select 
                className="input-field" 
                value={language} 
                onChange={e => {
                  if (e.target.value === "__custom__") {
                    setIsCustomLang(true);
                  } else {
                    setLanguage(e.target.value);
                  }
                }}
              >
                {POPULAR_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.code})
                  </option>
                ))}
                <option value="__custom__">➕ Other / Custom language...</option>
              </select>
            ) : (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={customLang} 
                  onChange={e => setCustomLang(e.target.value)} 
                  placeholder="e.g. es-CO, fr-CA, pt-PT" 
                  autoFocus 
                  required 
                />
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setIsCustomLang(false)}
                  style={{ fontSize: "12px", whiteSpace: "nowrap", padding: "8px 12px" }}
                >
                  List
                </button>
              </div>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
              Identifies this instance in all webhook event payloads.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
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
