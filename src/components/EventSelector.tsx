"use client";

import { useMemo } from "react";
import { 
  MessageSquare, 
  Activity, 
  PhoneCall, 
  Check, 
  CheckCheck, 
  Sparkles,
  ShieldAlert
} from "lucide-react";

interface EventSelectorProps {
  selectedEvents: string[];
  onChange: (events: string[]) => void;
  instanceType?: "USER" | "BOT";
}

interface EventItem {
  id: string;
  label: string;
  description: string;
  userOnly?: boolean;
}

interface EventCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
  events: EventItem[];
}

const CATEGORIES: EventCategory[] = [
  {
    id: "messages",
    name: "Mensagens (Messages)",
    icon: MessageSquare,
    color: "#60a5fa",
    badgeBg: "rgba(59, 130, 246, 0.12)",
    badgeBorder: "rgba(59, 130, 246, 0.25)",
    description: "Eventos relacionados à chegada, edição e remoção de mensagens.",
    events: [
      { id: "message", label: "Nova Mensagem", description: "Disparado quando uma nova mensagem é recebida no chat." },
      { id: "edited_message", label: "Mensagem Editada", description: "Disparado quando um usuário altera o texto ou mídia de uma mensagem." },
      { id: "deleted_message", label: "Mensagem Deletada", description: "Disparado quando uma mensagem é apagada por um dos participantes." },
    ]
  },
  {
    id: "actions",
    name: "Ações de Chat & Digitação",
    icon: Activity,
    color: "#34d399",
    badgeBg: "rgba(16, 185, 129, 0.12)",
    badgeBorder: "rgba(16, 185, 129, 0.25)",
    description: "Notificações em tempo real sobre o que o lead está fazendo no chat.",
    events: [
      { id: "chat.typing", label: "Digitando...", description: "O usuário começou a digitar uma mensagem no chat.", userOnly: true },
      { id: "chat.recording_audio", label: "Gravando Áudio", description: "O usuário está gravando uma mensagem de voz.", userOnly: true },
      { id: "chat.uploading_photo", label: "Enviando Foto", description: "O usuário está enviando uma imagem.", userOnly: true },
      { id: "chat.uploading_video", label: "Enviando Vídeo", description: "O usuário está gravando ou enviando um vídeo.", userOnly: true },
      { id: "chat.uploading_document", label: "Enviando Documento", description: "O usuário está anexando um arquivo/documento.", userOnly: true },
    ]
  },
  {
    id: "calls",
    name: "Ligações & Vídeo Chamadas",
    icon: PhoneCall,
    color: "#a78bfa",
    badgeBg: "rgba(139, 92, 246, 0.12)",
    badgeBorder: "rgba(139, 92, 246, 0.25)",
    description: "Telemetria completa de chamadas automatizadas, atendimentos e retenção de vídeo.",
    events: [
      { id: "call.ringing", label: "Chamando / Tocando", description: "O telefone do lead começou a tocar na outra ponta.", userOnly: true },
      { id: "call.accepted", label: "Chamada Atendida", description: "O lead atendeu a chamada (momento zero da transmissão).", userOnly: true },
      { id: "call.completed", label: "Chamada Completa (100%)", description: "O lead assistiu o vídeo inteiro até o final.", userOnly: true },
      { id: "call.abandoned", label: "Chamada Abandonada", description: "O lead desligou a chamada antes do término do vídeo.", userOnly: true },
      { id: "call.declined", label: "Chamada Recusada", description: "O lead rejeitou ativamente ou estava ocupado.", userOnly: true },
      { id: "call.missed", label: "Chamada Não Atendida", description: "Tocou até o tempo limite e o lead não atendeu.", userOnly: true },
      { id: "call.ended", label: "Métricas Finais (Consolidado)", description: "Evento completo com duração em segundos, retenção % e quem desligou.", userOnly: true },
    ]
  }
];

export function EventSelector({ selectedEvents, onChange, instanceType = "USER" }: EventSelectorProps) {
  const isBot = instanceType === "BOT";

  // Todos os eventos válidos para esse tipo de instância
  const validEventIds = useMemo(() => {
    return CATEGORIES.flatMap(cat => 
      cat.events
        .filter(ev => !(isBot && ev.userOnly))
        .map(ev => ev.id)
    );
  }, [isBot]);

  const hasAllEventsSelected = useMemo(() => {
    if (selectedEvents.includes("*")) return true;
    return validEventIds.length > 0 && validEventIds.every(id => selectedEvents.includes(id));
  }, [selectedEvents, validEventIds]);

  // Alterna o master "Todos os Eventos"
  const toggleSelectAll = () => {
    if (hasAllEventsSelected) {
      onChange([]);
    } else {
      onChange(validEventIds);
    }
  };

  // Alterna um evento específico
  const toggleEvent = (id: string, disabled?: boolean) => {
    if (disabled) return;
    
    // Se '*' estava selecionado, expande para a lista explícita antes de alternar
    let current = selectedEvents.includes("*") ? [...validEventIds] : [...selectedEvents];
    
    if (current.includes(id)) {
      onChange(current.filter(e => e !== id));
    } else {
      onChange([...current, id]);
    }
  };

  // Alterna todos os eventos de uma categoria específica
  const toggleCategory = (category: EventCategory) => {
    const availableCategoryIds = category.events
      .filter(ev => !(isBot && ev.userOnly))
      .map(ev => ev.id);

    if (availableCategoryIds.length === 0) return;

    let current = selectedEvents.includes("*") ? [...validEventIds] : [...selectedEvents];
    const allSelected = availableCategoryIds.every(id => current.includes(id));

    if (allSelected) {
      // Desmarca todos da categoria
      onChange(current.filter(id => !availableCategoryIds.includes(id)));
    } else {
      // Adiciona os que faltam
      const toAdd = availableCategoryIds.filter(id => !current.includes(id));
      onChange([...current, ...toAdd]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Barra Global: Ativar / Desativar Todos */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          background: hasAllEventsSelected ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.03)",
          border: hasAllEventsSelected ? "1px solid rgba(99, 102, 241, 0.35)" : "1px solid var(--glass-border)",
          borderRadius: "12px",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: hasAllEventsSelected ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: hasAllEventsSelected ? "#818cf8" : "var(--text-secondary)"
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Todos os Eventos
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {selectedEvents.includes("*") || hasAllEventsSelected 
                ? `Todos os ${validEventIds.length} eventos disponíveis ativados` 
                : `${selectedEvents.filter(e => validEventIds.includes(e)).length} de ${validEventIds.length} selecionados`}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSelectAll}
          className={hasAllEventsSelected ? "btn-primary" : "btn-secondary"}
          style={{ padding: "8px 16px", fontSize: "13px", height: "auto" }}
        >
          {hasAllEventsSelected ? "Desmarcar Todos" : "Selecionar Todos"}
        </button>
      </div>

      {/* Categorias de Eventos */}
      {CATEGORIES.map(category => {
        const Icon = category.icon;
        const availableCategoryEvents = category.events.filter(ev => !(isBot && ev.userOnly));
        const categoryIds = availableCategoryEvents.map(e => e.id);
        const selectedInCategoryCount = categoryIds.filter(id => 
          selectedEvents.includes("*") || selectedEvents.includes(id)
        ).length;
        const isCategoryAllSelected = categoryIds.length > 0 && selectedInCategoryCount === categoryIds.length;
        const isCategoryDisabled = availableCategoryEvents.length === 0;

        return (
          <div 
            key={category.id}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--glass-border)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              opacity: isCategoryDisabled ? 0.6 : 1
            }}
          >
            {/* Cabeçalho da Categoria */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: category.badgeBg,
                    border: `1px solid ${category.badgeBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: category.color
                  }}
                >
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                      {category.name}
                    </h3>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "1px 7px",
                        borderRadius: "10px",
                        background: selectedInCategoryCount > 0 ? category.badgeBg : "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${selectedInCategoryCount > 0 ? category.badgeBorder : "var(--glass-border)"}`,
                        color: selectedInCategoryCount > 0 ? category.color : "var(--text-secondary)"
                      }}
                    >
                      {selectedInCategoryCount} / {categoryIds.length}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                    {category.description}
                  </p>
                </div>
              </div>

              {!isCategoryDisabled && (
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    color: isCategoryAllSelected ? category.color : "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <CheckCheck size={14} />
                  <span>{isCategoryAllSelected ? "Desmarcar Grupo" : "Selecionar Grupo"}</span>
                </button>
              )}
            </div>

            {/* Aviso se a categoria inteira for incompatível com Bot */}
            {isCategoryDisabled && (
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  padding: "10px 14px", 
                  background: "rgba(245, 158, 11, 0.08)", 
                  border: "1px solid rgba(245, 158, 11, 0.2)", 
                  borderRadius: "8px", 
                  color: "#fbbf24", 
                  fontSize: "12px" 
                }}
              >
                <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                <span>Esta categoria é exclusiva para instâncias com contas pessoais nativas do Telegram (USER).</span>
              </div>
            )}

            {/* Grid de Cards dos Eventos */}
            {!isCategoryDisabled && (
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                  gap: "10px" 
                }}
              >
                {category.events.map(event => {
                  const isSelected = selectedEvents.includes("*") || selectedEvents.includes(event.id);
                  const disabled = isBot && event.userOnly;

                  return (
                    <div
                      key={event.id}
                      onClick={() => toggleEvent(event.id, disabled)}
                      title={disabled ? "Exclusivo para instâncias USER (não disponível para bots)" : ""}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${isSelected ? "rgba(99, 102, 241, 0.4)" : "var(--glass-border)"}`,
                        background: disabled 
                          ? "rgba(0, 0, 0, 0.3)" 
                          : isSelected 
                            ? "rgba(99, 102, 241, 0.12)" 
                            : "rgba(0, 0, 0, 0.2)",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.45 : 1,
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        position: "relative"
                      }}
                      onMouseEnter={e => {
                        if (!disabled && !isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      }}
                      onMouseLeave={e => {
                        if (!disabled && !isSelected) e.currentTarget.style.background = "rgba(0, 0, 0, 0.2)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                          <span 
                            style={{ 
                              fontSize: "13px", 
                              fontWeight: 600, 
                              color: isSelected ? "#a5b4fc" : "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {event.label}
                          </span>
                        </div>

                        {/* Checkbox estilizado */}
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "5px",
                            border: `1px solid ${isSelected ? "var(--accent-color, #6366f1)" : "var(--glass-border)"}`,
                            background: isSelected ? "var(--accent-color, #6366f1)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            flexShrink: 0
                          }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: isSelected ? "#818cf8" : "var(--text-secondary)",
                            background: "rgba(255, 255, 255, 0.05)",
                            padding: "1px 5px",
                            borderRadius: "4px"
                          }}
                        >
                          {event.id}
                        </span>
                      </div>

                      <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                        {event.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
