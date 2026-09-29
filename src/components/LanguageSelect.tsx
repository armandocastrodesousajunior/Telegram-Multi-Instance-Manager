"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Globe, Search, ChevronDown, Check, Plus, X } from "lucide-react";
import { POPULAR_LANGUAGES, getLanguageDisplay } from "@/lib/languages";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
}

export function LanguageSelect({
  value,
  onChange,
  label = "Idioma de Comunicação",
  description = "Identifica o idioma desta instância no payload de todos os webhooks."
}: LanguageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const selectedDisplay = useMemo(() => getLanguageDisplay(value), [value]);

  // Fecha dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsManualInput(false);
        setSearch("");
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setIsManualInput(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      // Auto-focus no campo de busca ao abrir
      setTimeout(() => {
        if (!isManualInput) searchInputRef.current?.focus();
        else manualInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isManualInput]);

  // Filtragem dos idiomas na busca
  const filteredLanguages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return POPULAR_LANGUAGES;
    return POPULAR_LANGUAGES.filter(
      l => l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)
    );
  }, [search]);

  // Checa se o que foi digitado já existe exatamente
  const exactMatchExists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return POPULAR_LANGUAGES.some(l => l.code.toLowerCase() === q);
  }, [search]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch("");
    setIsManualInput(false);
  };

  const handleConfirmManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      onChange(code);
      setIsOpen(false);
      setIsManualInput(false);
      setSearch("");
      setManualCode("");
    }
  };

  return (
    <div style={{ position: "relative", marginBottom: "16px" }} ref={containerRef}>
      {label && (
        <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}

      {/* Botão Gatilho / Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "rgba(255, 255, 255, 0.04)",
          border: isOpen ? "1px solid var(--accent-color, #6366f1)" : "1px solid var(--glass-border)",
          borderRadius: "8px",
          cursor: "pointer",
          color: "var(--text-primary)",
          fontSize: "14px",
          transition: "all 0.2s ease",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#818cf8",
              flexShrink: 0
            }}
          >
            <Globe size={15} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
              {selectedDisplay.code}
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedDisplay.label}
            </span>
          </div>
        </div>

        <ChevronDown
          size={16}
          style={{
            color: "var(--text-secondary)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            marginLeft: "8px"
          }}
        />
      </button>

      {description && (
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
          {description}
        </span>
      )}

      {/* Menu Dropdown com Busca */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "100%",
            background: "#121218",
            border: "1px solid var(--glass-border)",
            borderRadius: "10px",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)",
            zIndex: 150,
            overflow: "hidden",
            animation: "fadeIn 0.15s ease forwards"
          }}
        >
          {!isManualInput ? (
            <>
              {/* Campo de Busca */}
              <div
                style={{
                  padding: "10px",
                  borderBottom: "1px solid var(--glass-border)",
                  background: "rgba(255, 255, 255, 0.02)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Search size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar idioma ou código (ex: es, pt-BR)..."
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: "13px"
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Lista com Rolagem */}
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "6px"
                }}
              >
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map(item => {
                    const isSelected = item.code.toLowerCase() === value.trim().toLowerCase();
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelect(item.code)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "none",
                          background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                          color: isSelected ? "#a5b4fc" : "var(--text-primary)",
                          cursor: "pointer",
                          fontSize: "13px",
                          textAlign: "left",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isSelected ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.06)",
                              border: isSelected ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid var(--glass-border)",
                              fontSize: "11px",
                              fontWeight: 600,
                              fontFamily: "monospace",
                              color: isSelected ? "#818cf8" : "var(--text-secondary)",
                              flexShrink: 0
                            }}
                          >
                            {item.code}
                          </span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </span>
                        </div>
                        {isSelected && <Check size={14} style={{ color: "#818cf8", flexShrink: 0, marginLeft: "8px" }} />}
                      </button>
                    );
                  })
                ) : (
                  <div style={{ padding: "14px 10px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
                    Nenhum idioma pré-definido encontrado.
                  </div>
                )}

                {/* Opção de Usar o que foi digitado se não for um match exato */}
                {search.trim() && !exactMatchExists && (
                  <button
                    type="button"
                    onClick={() => handleSelect(search.trim())}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      marginTop: "4px",
                      borderRadius: "6px",
                      border: "1px dashed rgba(99, 102, 241, 0.4)",
                      background: "rgba(99, 102, 241, 0.08)",
                      color: "#a5b4fc",
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "left"
                    }}
                  >
                    <Plus size={14} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Usar código personalizado: <strong>{search.trim()}</strong>
                    </span>
                  </button>
                )}
              </div>

              {/* Rodapé: Botão para inserir código personalizado */}
              <div
                style={{
                  padding: "8px 10px",
                  borderTop: "1px solid var(--glass-border)",
                  background: "rgba(255, 255, 255, 0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsManualInput(true);
                    setManualCode(value || "");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 6px",
                    borderRadius: "4px"
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}
                >
                  <Plus size={13} />
                  <span>Digitar código personalizado</span>
                </button>
              </div>
            </>
          ) : (
            /* Modo Entrada Manual */
            <div style={{ padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Código Personalizado
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualInput(false)}
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px" }}
                >
                  Voltar à lista
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  ref={manualInputRef}
                  type="text"
                  className="input-field"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Ex: es-MX, pt-AO, fr-CA"
                  onKeyDown={e => {
                    if (e.key === "Enter") handleConfirmManual();
                  }}
                  style={{ fontSize: "13px", padding: "8px 12px" }}
                />
                <button
                  type="button"
                  onClick={() => handleConfirmManual()}
                  className="btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
                  disabled={!manualCode.trim()}
                >
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
