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
  const [openUpwards, setOpenUpwards] = useState(false);
  const [maxListHeight, setMaxListHeight] = useState(130);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const selectedDisplay = useMemo(() => getLanguageDisplay(value), [value]);

  // Cálculo inteligente de espaço para abrir para cima ou para baixo sem encostar na tela
  useEffect(() => {
    function calculatePosition() {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Se o espaço abaixo for menor que 230px e houver mais espaço em cima, abre para cima
        const shouldOpenUp = spaceBelow < 230 && spaceAbove > spaceBelow;
        setOpenUpwards(shouldOpenUp);

        // Ajusta a altura máxima da lista para garantir que caiba com folga no viewport
        const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
        const calculatedMax = Math.min(140, Math.max(90, Math.floor(availableSpace - 110)));
        setMaxListHeight(calculatedMax);
      }
    }

    if (isOpen) {
      calculatePosition();
      window.addEventListener("resize", calculatePosition);
      return () => window.removeEventListener("resize", calculatePosition);
    }
  }, [isOpen]);

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
    <div style={{ marginBottom: "16px" }} ref={containerRef}>
      {label && (
        <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}

      {/* Wrapper do botão com posicionamento relativo isolado (evita que a descrição empurre o dropdown) */}
      <div style={{ position: "relative" }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
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
                width: "26px",
                height: "26px",
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
              <Globe size={14} />
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

        {/* Menu Dropdown com Busca Inteligente */}
        {isOpen && (
          <div
            style={{
              position: "absolute",
              ...(openUpwards ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
              left: 0,
              width: "100%",
              background: "#121218",
              border: "1px solid var(--glass-border)",
              borderRadius: "10px",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)",
              zIndex: 200,
              overflow: "hidden",
              animation: "fadeIn 0.15s ease forwards"
            }}
          >
            {!isManualInput ? (
              <>
                {/* Campo de Busca Compacto */}
                <div
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--glass-border)",
                    background: "rgba(255, 255, 255, 0.02)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <Search size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
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
                      fontSize: "12px"
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Lista com Rolagem Otimizada */}
                <div
                  style={{
                    maxHeight: `${maxListHeight}px`,
                    overflowY: "auto",
                    padding: "4px"
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
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: "none",
                            background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                            color: isSelected ? "#a5b4fc" : "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "12px",
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
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <span
                              style={{
                                padding: "1px 5px",
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
                          {isSelected && <Check size={13} style={{ color: "#818cf8", flexShrink: 0, marginLeft: "6px" }} />}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: "10px 8px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
                      Nenhum idioma encontrado.
                    </div>
                  )}

                  {/* Opção Rápida para o termo digitado */}
                  {search.trim() && !exactMatchExists && (
                    <button
                      type="button"
                      onClick={() => handleSelect(search.trim())}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 8px",
                        marginTop: "2px",
                        borderRadius: "6px",
                        border: "1px dashed rgba(99, 102, 241, 0.4)",
                        background: "rgba(99, 102, 241, 0.08)",
                        color: "#a5b4fc",
                        cursor: "pointer",
                        fontSize: "12px",
                        textAlign: "left"
                      }}
                    >
                      <Plus size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Usar código: <strong>{search.trim()}</strong>
                      </span>
                    </button>
                  )}
                </div>

                {/* Rodapé Compacto */}
                <div
                  style={{
                    padding: "6px 8px",
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
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 4px",
                      borderRadius: "4px"
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}
                  >
                    <Plus size={12} />
                    <span>Digitar código personalizado</span>
                  </button>
                </div>
              </>
            ) : (
              /* Modo Entrada Manual Compacto */
              <div style={{ padding: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Código Personalizado
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualInput(false)}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "11px" }}
                  >
                    Voltar à lista
                  </button>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
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
                    style={{ fontSize: "12px", padding: "6px 10px" }}
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmManual()}
                    className="btn-primary"
                    style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
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

      {description && (
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", display: "block" }}>
          {description}
        </span>
      )}
    </div>
  );
}
