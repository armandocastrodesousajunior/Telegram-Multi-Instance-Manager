"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Server, 
  Webhook, 
  Search, 
  Eye, 
  RotateCcw, 
  Trash2, 
  X, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Activity
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface UnifiedLog {
  id: string;
  type: "API" | "WEBHOOK";
  level: "ERROR" | "ALERT" | "INFO";
  instanceId: string;
  instanceName: string;
  endpointOrEvent: string;
  methodOrTarget: string;
  status: number | null;
  success: boolean;
  requestPayload: any;
  responseBody: any;
  createdAt: string;
  retryInfo?: {
    isRetry?: boolean;
    attempt?: number;
    maxRetries?: number;
    delayMs?: number;
    recovered?: boolean;
    message?: string;
  };
}

interface LogStats {
  totalLogs: number;
  apiCount: number;
  webhookCount: number;
  globalErrors: number;
  globalWebhooksRetried: number;
}

interface InstanceOption {
  id: string;
  name: string;
}

export default function SystemLogsPage() {
  const router = useRouter();

  // Estados principais
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [stats, setStats] = useState<LogStats>({
    totalLogs: 0,
    apiCount: 0,
    webhookCount: 0,
    globalErrors: 0,
    globalWebhooksRetried: 0
  });
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedType, setSelectedType] = useState<"all" | "api" | "webhook">("all");
  const [selectedLevel, setSelectedLevel] = useState<"all" | "error" | "alert" | "info">("all");
  const [selectedInstance, setSelectedInstance] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Paginação
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Auto-refresh (a cada 6 segundos)
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Modal de Detalhes
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Debounce do input de busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
  }, [router]);

  // Busca dos logs
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        type: selectedType,
        level: selectedLevel,
        instanceId: selectedInstance,
        search: debouncedSearch
      });

      const res = await apiClient.get<{
        logs: UnifiedLog[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
        stats: LogStats;
        instances: InstanceOption[];
      }>(`/api/logs?${queryParams.toString()}`);

      setLogs(res.logs || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
      if (res.stats) setStats(res.stats);
      if (res.instances) setInstances(res.instances);
    } catch (err: any) {
      console.error("Falha ao buscar logs do sistema:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, limit, selectedType, selectedLevel, selectedInstance, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Intervalo de auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Limpar logs
  const handleClearLogs = async () => {
    const msg = selectedInstance !== "all" 
      ? "Deseja realmente limpar os logs desta instância específica?" 
      : "Deseja realmente limpar TODOS os logs do sistema?";

    if (!confirm(msg)) return;

    try {
      setLoading(true);
      await fetch(`/api/logs?instanceId=${selectedInstance}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        }
      });
      fetchLogs();
    } catch (err: any) {
      alert("Erro ao limpar logs: " + err.message);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const renderStatusBadge = (log: UnifiedLog) => {
    if (log.retryInfo?.isRetry && !log.retryInfo.recovered) {
      return (
        <span 
          className="badge" 
          style={{ 
            backgroundColor: "rgba(245, 158, 11, 0.15)", 
            color: "var(--warning-color)", 
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <RotateCcw size={12} className="animate-spin" style={{ animationDuration: "3s" }} />
          Retry {log.retryInfo.attempt}/{log.retryInfo.maxRetries}
        </span>
      );
    }

    if (log.retryInfo?.recovered) {
      return (
        <span 
          className="badge" 
          style={{ 
            backgroundColor: "rgba(16, 185, 129, 0.15)", 
            color: "var(--success-color)", 
            border: "1px solid rgba(16, 185, 129, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <CheckCircle2 size={12} />
          Recuperado ({log.retryInfo.attempt}ª)
        </span>
      );
    }

    if (log.status === null || log.status === 0) {
      return (
        <span className="badge" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", color: "var(--text-secondary)" }}>
          {log.success ? "OK" : "FALHA"}
        </span>
      );
    }

    const isOk = log.success && log.status >= 200 && log.status < 300;
    const isWarn = log.status >= 400 && log.status < 500;
    const isErr = log.status >= 500 || !log.success;

    let bg = "rgba(16, 185, 129, 0.15)";
    let color = "var(--success-color)";
    let border = "1px solid rgba(16, 185, 129, 0.3)";

    if (isWarn) {
      bg = "rgba(245, 158, 11, 0.15)";
      color = "var(--warning-color)";
      border = "1px solid rgba(245, 158, 11, 0.3)";
    } else if (isErr) {
      bg = "rgba(239, 68, 68, 0.15)";
      color = "var(--error-color)";
      border = "1px solid rgba(239, 68, 68, 0.3)";
    }

    return (
      <span className="badge" style={{ backgroundColor: bg, color, border, fontWeight: 600 }}>
        {log.status} {log.status === 429 ? "Rate Limit" : log.status === 500 ? "Error" : isOk ? "OK" : ""}
      </span>
    );
  };

  const renderLevelBadge = (level: "ERROR" | "ALERT" | "INFO") => {
    switch (level) {
      case "ERROR":
        return (
          <span 
            className="badge" 
            style={{ 
              backgroundColor: "rgba(239, 68, 68, 0.15)", 
              color: "var(--error-color)", 
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <AlertCircle size={12} />
            Erro
          </span>
        );
      case "ALERT":
        return (
          <span 
            className="badge" 
            style={{ 
              backgroundColor: "rgba(245, 158, 11, 0.15)", 
              color: "var(--warning-color)", 
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <AlertTriangle size={12} />
            Alerta / Retry
          </span>
        );
      case "INFO":
        return (
          <span 
            className="badge" 
            style={{ 
              backgroundColor: "rgba(16, 185, 129, 0.15)", 
              color: "var(--success-color)", 
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <CheckCircle2 size={12} />
            Sucesso
          </span>
        );
    }
  };

  return (
    <div className="page-container" style={{ justifyContent: "center" }}>
      <main className="main-content" style={{ width: "100%", maxWidth: "1280px" }}>
        
        {/* Header com Navegação */}
        <header className="page-header animate-fade-in" style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: "24px", marginBottom: "28px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Link href="/" className="btn-secondary" style={{ padding: "8px 14px", fontSize: "13px" }}>
                <ArrowLeft size={16} />
                Voltar ao Início
              </Link>
              <h1 className="page-title" style={{ fontSize: "26px", margin: 0 }}>
                Logs do Sistema
              </h1>
            </div>
            <p style={{ color: "var(--text-secondary)", marginTop: "4px", fontSize: "14px" }}>
              Histórico unificado de requisições de API, disparos de webhooks, erros e retentativas de todas as instâncias.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button 
              className={`btn-secondary ${autoRefresh ? "active" : ""}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                fontSize: "13px",
                borderColor: autoRefresh ? "var(--success-color)" : "var(--glass-border)",
                color: autoRefresh ? "var(--success-color)" : "inherit"
              }}
              title="Atualiza automaticamente a cada 6 segundos"
            >
              <Activity size={16} />
              {autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
            </button>

            <button 
              className="btn-secondary" 
              onClick={() => fetchLogs()} 
              disabled={loading}
              style={{ fontSize: "13px" }}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>

            <button 
              className="btn-danger" 
              onClick={handleClearLogs}
              style={{ fontSize: "13px", padding: "8px 14px" }}
              title="Limpar logs selecionados"
            >
              <Trash2 size={16} />
              Limpar Logs
            </button>
          </div>
        </header>

        {/* Cards de Métricas / Estatísticas */}
        <div 
          className="animate-fade-in" 
          style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "16px", 
            marginBottom: "28px" 
          }}
        >
          <div className="glass-card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
              <span>Total de Registros</span>
              <Activity size={18} style={{ color: "var(--accent-primary)" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px" }}>
              {totalCount.toLocaleString()}
            </div>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              padding: "18px", 
              cursor: "pointer", 
              borderColor: selectedLevel === "error" ? "var(--error-color)" : "var(--glass-border)" 
            }}
            onClick={() => { setSelectedLevel(selectedLevel === "error" ? "all" : "error"); setPage(1); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--error-color)", fontSize: "13px" }}>
              <span>Erros Críticos</span>
              <AlertCircle size={18} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px", color: "var(--error-color)" }}>
              {stats.globalErrors.toLocaleString()}
            </div>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              padding: "18px", 
              cursor: "pointer", 
              borderColor: selectedLevel === "alert" ? "var(--warning-color)" : "var(--glass-border)" 
            }}
            onClick={() => { setSelectedLevel(selectedLevel === "alert" ? "all" : "alert"); setPage(1); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--warning-color)", fontSize: "13px" }}>
              <span>Alertas & Retries</span>
              <RotateCcw size={18} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px", color: "var(--warning-color)" }}>
              {stats.globalWebhooksRetried.toLocaleString()}
            </div>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              padding: "18px", 
              cursor: "pointer", 
              borderColor: selectedType === "api" ? "var(--accent-primary)" : "var(--glass-border)" 
            }}
            onClick={() => { setSelectedType(selectedType === "api" ? "all" : "api"); setPage(1); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
              <span>Requisições de API</span>
              <Server size={18} style={{ color: "var(--accent-primary)" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px" }}>
              {stats.apiCount.toLocaleString()}
            </div>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              padding: "18px", 
              cursor: "pointer", 
              borderColor: selectedType === "webhook" ? "#a855f7" : "var(--glass-border)" 
            }}
            onClick={() => { setSelectedType(selectedType === "webhook" ? "all" : "webhook"); setPage(1); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
              <span>Disparos de Webhook</span>
              <Webhook size={18} style={{ color: "#a855f7" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px" }}>
              {stats.webhookCount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Seção de Filtros em Cliques */}
        <div className="glass-panel animate-fade-in" style={{ padding: "20px", marginBottom: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Linha 1: Filtro de Tipos e Níveis com Botões de Clique Rápido */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center", justifyContent: "space-between" }}>
              
              {/* Filtro de Tipo */}
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>
                  Tipo de Log
                </div>
                <div style={{ display: "inline-flex", background: "rgba(0, 0, 0, 0.3)", borderRadius: "8px", padding: "4px", border: "1px solid var(--glass-border)" }}>
                  <button 
                    onClick={() => { setSelectedType("all"); setPage(1); }}
                    style={{
                      background: selectedType === "all" ? "var(--accent-color)" : "transparent",
                      color: selectedType === "all" ? "#000" : "var(--text-secondary)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => { setSelectedType("api"); setPage(1); }}
                    style={{
                      background: selectedType === "api" ? "var(--accent-color)" : "transparent",
                      color: selectedType === "api" ? "#000" : "var(--text-secondary)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <Server size={14} />
                    API
                  </button>
                  <button 
                    onClick={() => { setSelectedType("webhook"); setPage(1); }}
                    style={{
                      background: selectedType === "webhook" ? "var(--accent-color)" : "transparent",
                      color: selectedType === "webhook" ? "#000" : "var(--text-secondary)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <Webhook size={14} />
                    Webhooks
                  </button>
                </div>
              </div>

              {/* Filtro de Nível */}
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>
                  Status / Nível
                </div>
                <div style={{ display: "inline-flex", background: "rgba(0, 0, 0, 0.3)", borderRadius: "8px", padding: "4px", border: "1px solid var(--glass-border)" }}>
                  <button 
                    onClick={() => { setSelectedLevel("all"); setPage(1); }}
                    style={{
                      background: selectedLevel === "all" ? "var(--accent-color)" : "transparent",
                      color: selectedLevel === "all" ? "#000" : "var(--text-secondary)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => { setSelectedLevel("error"); setPage(1); }}
                    style={{
                      background: selectedLevel === "error" ? "rgba(239, 68, 68, 0.85)" : "transparent",
                      color: selectedLevel === "error" ? "#fff" : "var(--error-color)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <AlertCircle size={14} />
                    Apenas Erros
                  </button>
                  <button 
                    onClick={() => { setSelectedLevel("alert"); setPage(1); }}
                    style={{
                      background: selectedLevel === "alert" ? "rgba(245, 158, 11, 0.85)" : "transparent",
                      color: selectedLevel === "alert" ? "#fff" : "var(--warning-color)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <AlertTriangle size={14} />
                    Alertas & Retries
                  </button>
                  <button 
                    onClick={() => { setSelectedLevel("info"); setPage(1); }}
                    style={{
                      background: selectedLevel === "info" ? "rgba(16, 185, 129, 0.85)" : "transparent",
                      color: selectedLevel === "info" ? "#fff" : "var(--success-color)",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Sucessos
                  </button>
                </div>
              </div>

              {/* Seletor de Instância */}
              <div style={{ flex: "1 1 200px", maxWidth: "320px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>
                  Instância
                </div>
                <select 
                  className="input-field" 
                  value={selectedInstance}
                  onChange={(e) => { setSelectedInstance(e.target.value); setPage(1); }}
                  style={{ height: "38px", padding: "6px 12px", fontSize: "13px" }}
                >
                  <option value="all">🌐 Todas as Instâncias ({instances.length})</option>
                  {instances.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Barra de Busca Textual */}
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "14px", top: "12px", color: "var(--text-secondary)" }} />
              <input 
                type="text"
                placeholder="Buscar por endpoint, URL de webhook, evento, mensagem de erro, status ou payload..."
                className="input-field"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "40px", fontSize: "14px" }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  style={{ position: "absolute", right: "12px", top: "10px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="glass-panel animate-fade-in" style={{ padding: "0", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
              Carregando registros de logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
              <Filter size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
              Nenhum log encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", textAlign: "left", fontSize: "13px" }}>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Data / Hora</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Tipo</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Nível</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Instância</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Ação / Endpoint / Destino</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500 }}>Status</th>
                      <th style={{ padding: "14px 18px", fontWeight: 500, textAlign: "right" }}>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr 
                        key={log.id} 
                        style={{ 
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          transition: "background-color 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {/* Data e Hora */}
                        <td style={{ padding: "14px 18px", fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>

                        {/* Tipo */}
                        <td style={{ padding: "14px 18px" }}>
                          {log.type === "API" ? (
                            <span 
                              className="badge" 
                              style={{ 
                                backgroundColor: "rgba(59, 130, 246, 0.15)", 
                                color: "#60a5fa", 
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <Server size={11} /> API
                            </span>
                          ) : (
                            <span 
                              className="badge" 
                              style={{ 
                                backgroundColor: "rgba(168, 85, 247, 0.15)", 
                                color: "#c084fc", 
                                border: "1px solid rgba(168, 85, 247, 0.3)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <Webhook size={11} /> Webhook
                            </span>
                          )}
                        </td>

                        {/* Nível */}
                        <td style={{ padding: "14px 18px" }}>
                          {renderLevelBadge(log.level)}
                        </td>

                        {/* Nome da Instância */}
                        <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {log.instanceName}
                        </td>

                        {/* Endpoint / Destino */}
                        <td style={{ padding: "14px 18px", fontSize: "13px", maxWidth: "340px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {log.type === "API" && (
                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.08)" }}>
                                {log.methodOrTarget}
                              </span>
                            )}
                            <span 
                              style={{ 
                                fontFamily: "monospace", 
                                color: log.type === "WEBHOOK" ? "var(--text-primary)" : "var(--accent-hover)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}
                              title={log.type === "WEBHOOK" ? `${log.endpointOrEvent} ➔ ${log.methodOrTarget}` : log.endpointOrEvent}
                            >
                              {log.type === "WEBHOOK" ? (
                                <>
                                  <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>{log.endpointOrEvent}</span>
                                  <span style={{ color: "var(--text-secondary)", margin: "0 6px" }}>➔</span>
                                  <span>{log.methodOrTarget}</span>
                                </>
                              ) : (
                                log.endpointOrEvent
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                          {renderStatusBadge(log)}
                        </td>

                        {/* Ação Visualizar */}
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye size={13} /> Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Controles de Paginação */}
              <div 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "16px 20px", 
                  borderTop: "1px solid var(--glass-border)",
                  flexWrap: "wrap",
                  gap: "12px"
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span>
                    Exibindo <strong>{(page - 1) * limit + 1}</strong> a <strong>{Math.min(page * limit, totalCount)}</strong> de <strong>{totalCount}</strong> logs
                  </span>
                  <select 
                    value={limit} 
                    onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                    className="input-field"
                    style={{ width: "90px", height: "30px", padding: "2px 8px", fontSize: "12px" }}
                  >
                    <option value={15}>15 / pág</option>
                    <option value={25}>25 / pág</option>
                    <option value={50}>50 / pág</option>
                    <option value={100}>100 / pág</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button 
                    className="btn-secondary" 
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "0 8px" }}>
                    Página {page} de {totalPages}
                  </span>
                  <button 
                    className="btn-secondary" 
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </main>

      {/* Modal de Detalhes Completo */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div 
            className="modal-content animate-fade-in" 
            style={{ maxWidth: "800px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "18px", fontWeight: "700" }}>
                    Detalhes do Log #{selectedLog.id.substring(0, 8)}
                  </span>
                  {renderLevelBadge(selectedLog.level)}
                  {renderStatusBadge(selectedLog)}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Instância: <strong>{selectedLog.instanceName}</strong> ({selectedLog.instanceId}) • {new Date(selectedLog.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="btn-secondary" 
                style={{ padding: "6px", borderRadius: "50%" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner Especial de Alerta / Retry */}
            {selectedLog.retryInfo?.isRetry && (
              <div 
                style={{ 
                  background: selectedLog.retryInfo.recovered ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", 
                  border: `1px solid ${selectedLog.retryInfo.recovered ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`, 
                  borderRadius: "10px", 
                  padding: "16px", 
                  marginBottom: "20px" 
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: selectedLog.retryInfo.recovered ? "var(--success-color)" : "var(--warning-color)", marginBottom: "4px" }}>
                  <RotateCcw size={16} />
                  {selectedLog.retryInfo.recovered ? "Recuperação com Sucesso após Retry" : "Alerta de Tentativa de Retentativa (Backoff Exponencial)"}
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                  {selectedLog.retryInfo.message || `Tentativa ${selectedLog.retryInfo.attempt}/${selectedLog.retryInfo.maxRetries} com delay de ${selectedLog.retryInfo.delayMs}ms.`}
                </p>
              </div>
            )}

            {/* Metadados Técnicos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div className="glass-card" style={{ padding: "12px 16px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Tipo de Operação:</span>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px" }}>
                  {selectedLog.type === "API" ? `Requisição API (${selectedLog.methodOrTarget})` : `Disparo de Webhook (${selectedLog.endpointOrEvent})`}
                </div>
              </div>

              <div className="glass-card" style={{ padding: "12px 16px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {selectedLog.type === "API" ? "Endpoint:" : "URL de Destino:"}
                </span>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px", fontFamily: "monospace", overflowWrap: "anywhere" }}>
                  {selectedLog.type === "API" ? selectedLog.endpointOrEvent : selectedLog.methodOrTarget}
                </div>
              </div>
            </div>

            {/* Payload da Requisição */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  Payload da Requisição (Input)
                </span>
                {selectedLog.requestPayload && (
                  <button 
                    className="btn-secondary" 
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => copyToClipboard(JSON.stringify(selectedLog.requestPayload, null, 2), "req")}
                  >
                    {copiedKey === "req" ? <Check size={12} color="var(--success-color)" /> : <Copy size={12} />}
                    {copiedKey === "req" ? "Copiado!" : "Copiar JSON"}
                  </button>
                )}
              </div>
              <pre 
                style={{ 
                  background: "#08080a", 
                  padding: "16px", 
                  borderRadius: "8px", 
                  border: "1px solid var(--glass-border)", 
                  fontSize: "12px", 
                  overflowX: "auto", 
                  maxHeight: "240px", 
                  color: "#d4d4d8",
                  fontFamily: "monospace" 
                }}
              >
                {selectedLog.requestPayload ? JSON.stringify(selectedLog.requestPayload, null, 2) : "// Nenhum payload enviado"}
              </pre>
            </div>

            {/* Resposta do Sistema / Erro Retornado */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  Resposta / Erro Retornado (Output)
                </span>
                {selectedLog.responseBody && (
                  <button 
                    className="btn-secondary" 
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => copyToClipboard(JSON.stringify(selectedLog.responseBody, null, 2), "res")}
                  >
                    {copiedKey === "res" ? <Check size={12} color="var(--success-color)" /> : <Copy size={12} />}
                    {copiedKey === "res" ? "Copiado!" : "Copiar JSON"}
                  </button>
                )}
              </div>
              <pre 
                style={{ 
                  background: "#08080a", 
                  padding: "16px", 
                  borderRadius: "8px", 
                  border: "1px solid var(--glass-border)", 
                  fontSize: "12px", 
                  overflowX: "auto", 
                  maxHeight: "240px", 
                  color: selectedLog.level === "ERROR" ? "#fca5a5" : "#86efac",
                  fontFamily: "monospace" 
                }}
              >
                {selectedLog.responseBody ? JSON.stringify(selectedLog.responseBody, null, 2) : "// Nenhuma resposta registrada"}
              </pre>
            </div>

            {/* Rodapé do Modal */}
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--glass-border)", paddingTop: "16px" }}>
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
