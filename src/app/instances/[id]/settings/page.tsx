"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Save, Trash2, Eye, EyeOff, Copy, RefreshCw } from "lucide-react";

interface InstanceSettings {
  typingEnabled: boolean;
  typingUseDuration: boolean;
  typingFixedSeconds: number | string;
  typingMsPerChar: number | string;
  audioActionEnabled: boolean;
  audioUseDuration: boolean;
  audioFixedSeconds: number | string;
  videoActionEnabled: boolean;
  videoUseDuration: boolean;
  videoFixedSeconds: number | string;
  downloadVideoFirst: boolean;
  photoActionEnabled: boolean;
  photoFixedSeconds: number | string;
  documentActionEnabled: boolean;
  documentFixedSeconds: number | string;
  markViewOnceAsRead: boolean;
  splitMessagesEnabled: boolean;
  mediaCacheEnabled: boolean;
  viewOnceTtlSeconds: number;
  botSelfDestructMode: string;
  botSelfDestructTimer: number;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--glass-border)" }}>
    <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>{title}</h3>
    <div className="grid grid-cols-2" style={{ gap: "24px" }}>
      {children}
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange, description }: any) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", gridColumn: "1 / -1" }}>
    <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", position: "relative" }}>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)}
        style={{
          appearance: "none",
          width: "40px", height: "20px",
          background: checked ? "var(--success-color)" : "rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          position: "relative",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      />
      <div style={{
        position: "absolute",
        width: "16px", height: "16px",
        borderRadius: "50%",
        background: "#fff",
        top: "2px",
        left: checked ? "22px" : "2px",
        transition: "all 0.2s",
        pointerEvents: "none"
      }} />
    </label>
    <div>
      <div style={{ fontSize: "14px", fontWeight: 500 }}>{label}</div>
      {description && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{description}</div>}
    </div>
  </div>
);

const NumberInput = ({ label, value, onChange, min = 0, max = 60, suffix = "" }: any) => (
  <div>
    <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "8px", color: "var(--text-secondary)" }}>
      {label}
    </label>
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input 
        type="number" 
        className="input-field" 
        value={value} 
        onChange={(e) => onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
        min={min}
        max={max}
        style={{ paddingRight: suffix ? "40px" : "16px" }}
      />
      {suffix && <span style={{ position: "absolute", right: "16px", fontSize: "13px", color: "var(--text-secondary)", pointerEvents: "none" }}>{suffix}</span>}
    </div>
  </div>
);

export default function InstanceSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [settings, setSettings] = useState<InstanceSettings>({
    typingEnabled: true,
    typingUseDuration: true,
    typingFixedSeconds: 5,
    typingMsPerChar: 10,
    audioActionEnabled: true,
    audioUseDuration: true,
    audioFixedSeconds: 3,
    videoActionEnabled: true,
    videoUseDuration: true,
    videoFixedSeconds: 5,
    downloadVideoFirst: true,
    photoActionEnabled: true,
    photoFixedSeconds: 2,
    documentActionEnabled: true,
    documentFixedSeconds: 2,
    markViewOnceAsRead: true,
    splitMessagesEnabled: true,
    mediaCacheEnabled: true,
    viewOnceTtlSeconds: 2147483647,
    botSelfDestructMode: "AFTER_SEND",
    botSelfDestructTimer: 60,
    elevenLabsApiKey: "",
    elevenLabsVoiceId: "",
    elevenLabsModelId: "eleven_multilingual_v2",
  });
  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);
  const [elevenLabsModels, setElevenLabsModels] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [instanceData, setInstanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instanceToken, setInstanceToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchSettings();
  }, [id, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [data, instanceData] = await Promise.all([
        apiClient.get<InstanceSettings>(`/api/instances/${id}/settings`),
        apiClient.get<any>(`/api/instances/${id}`)
      ]);
      setSettings({
        typingEnabled: data.typingEnabled,
        typingUseDuration: data.typingUseDuration ?? true,
        typingFixedSeconds: data.typingFixedSeconds ?? 5,
        typingMsPerChar: data.typingMsPerChar,
        audioActionEnabled: data.audioActionEnabled,
        audioUseDuration: data.audioUseDuration,
        audioFixedSeconds: data.audioFixedSeconds,
        videoActionEnabled: data.videoActionEnabled,
        videoUseDuration: data.videoUseDuration,
        videoFixedSeconds: data.videoFixedSeconds,
        downloadVideoFirst: data.downloadVideoFirst ?? true,
        photoActionEnabled: data.photoActionEnabled,
        photoFixedSeconds: data.photoFixedSeconds,
        documentActionEnabled: data.documentActionEnabled,
        documentFixedSeconds: data.documentFixedSeconds,
        markViewOnceAsRead: data.markViewOnceAsRead ?? true,
        splitMessagesEnabled: data.splitMessagesEnabled ?? true,
        mediaCacheEnabled: data.mediaCacheEnabled ?? true,
        viewOnceTtlSeconds: data.viewOnceTtlSeconds ?? 2147483647,
        botSelfDestructMode: data.botSelfDestructMode ?? "AFTER_SEND",
        botSelfDestructTimer: data.botSelfDestructTimer ?? 60,
        elevenLabsApiKey: data.elevenLabsApiKey ?? "",
        elevenLabsVoiceId: data.elevenLabsVoiceId ?? "",
        elevenLabsModelId: data.elevenLabsModelId ?? "eleven_multilingual_v2",
      });
      setInstanceData(instanceData);
      setInstanceToken(instanceData.token || "");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = [];
    if (settings.typingEnabled) {
      if (!settings.typingUseDuration) {
        const v = Number(settings.typingFixedSeconds);
        if (isNaN(v) || v < 0 || v > 60) errors.push("Typing fixed wait time must be between 0 and 60 seconds.");
      } else {
        const v = Number(settings.typingMsPerChar);
        if (isNaN(v) || v < 0 || v > 5000) errors.push("Typing MS per char must be between 0 and 5000.");
      }
    }
    if (settings.audioActionEnabled && !settings.audioUseDuration) {
      const v = Number(settings.audioFixedSeconds);
      if (isNaN(v) || v < 0 || v > 60) errors.push("Audio wait time must be between 0 and 60 seconds.");
    }
    if (settings.videoActionEnabled && !settings.videoUseDuration) {
      const v = Number(settings.videoFixedSeconds);
      if (isNaN(v) || v < 0 || v > 60) errors.push("Video wait time must be between 0 and 60 seconds.");
    }
    if (settings.photoActionEnabled) {
      const v = Number(settings.photoFixedSeconds);
      if (isNaN(v) || v < 0 || v > 60) errors.push("Photo wait time must be between 0 and 60 seconds.");
    }
    if (settings.documentActionEnabled) {
      const v = Number(settings.documentFixedSeconds);
      if (isNaN(v) || v < 0 || v > 60) errors.push("Document wait time must be between 0 and 60 seconds.");
    }

    if (errors.length > 0) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return;
    }

    const payload = {
      ...settings,
      typingFixedSeconds: Number(settings.typingFixedSeconds) || 0,
      typingMsPerChar: Number(settings.typingMsPerChar) || 0,
      audioFixedSeconds: Number(settings.audioFixedSeconds) || 0,
      videoFixedSeconds: Number(settings.videoFixedSeconds) || 0,
      downloadVideoFirst: settings.downloadVideoFirst,
      photoFixedSeconds: Number(settings.photoFixedSeconds) || 0,
      documentFixedSeconds: Number(settings.documentFixedSeconds) || 0,
      markViewOnceAsRead: settings.markViewOnceAsRead,
      splitMessagesEnabled: settings.splitMessagesEnabled,
      mediaCacheEnabled: settings.mediaCacheEnabled,
      viewOnceTtlSeconds: Number(settings.viewOnceTtlSeconds),
      botSelfDestructMode: settings.botSelfDestructMode,
      botSelfDestructTimer: Number(settings.botSelfDestructTimer) || 0,
      elevenLabsApiKey: settings.elevenLabsApiKey,
      elevenLabsVoiceId: settings.elevenLabsVoiceId,
      elevenLabsModelId: settings.elevenLabsModelId,
    };

    try {
      setSaving(true);
      await apiClient.put(`/api/instances/${id}/settings`, payload);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetCache = async () => {
    if (!confirm("Are you sure you want to clear the media cache? This will force the server to download all media again on the next send.")) return;
    try {
      const res = await apiClient.delete(`/api/instances/${id}/cache`);
      alert(`Cache cleared successfully! (${(res as any).count} items deleted)`);
    } catch (error) {
      console.error(error);
      alert("Failed to clear cache");
    }
  };

  const fetchElevenLabsData = async () => {
    if (!settings.elevenLabsApiKey) return;
    try {
      setLoadingVoices(true);
      
      const [voicesRes, modelsRes] = await Promise.all([
        fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': settings.elevenLabsApiKey } }),
        fetch('https://api.elevenlabs.io/v1/models', { headers: { 'xi-api-key': settings.elevenLabsApiKey } })
      ]);

      if (voicesRes.ok && modelsRes.ok) {
        const voicesData = await voicesRes.json();
        const modelsData = await modelsRes.json();
        setElevenLabsVoices(voicesData.voices);
        // Only keep models that support Text-to-Speech
        setElevenLabsModels(modelsData.filter((m: any) => m.can_do_text_to_speech));
      } else {
        alert("Falha ao buscar dados. Verifique a API Key.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar dados da ElevenLabs.");
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(instanceToken);
    alert('Token copiado!');
  };

  const handleRevokeToken = async () => {
    if (!confirm('Tem certeza de que deseja revogar este token? Qualquer automação usando-o irá parar de funcionar imediatamente.')) return;
    setRevoking(true);
    try {
      const res = await apiClient.post<any>(`/api/instances/${id}/token`);
      setInstanceToken(res.token);
      alert('Token revogado e gerado novamente com sucesso.');
    } catch (err) {
      console.error(err);
      alert('Falha ao revogar token');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <main className="main-content">
      <header className="page-header animate-fade-in">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 className="page-title">Instance Settings</h1>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Configure typing behaviors and media upload actions before sending messages.</p>
        </div>
      </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Loading settings...</div>
        ) : (
          <form className="glass-panel animate-fade-in" style={{ maxWidth: "70%", margin: "0 auto" }} onSubmit={handleSave}>
            
            <Section title="Token de Acesso da Instância">
              <div style={{ gridColumn: "1 / -1", marginBottom: "8px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Este token permite enviar mensagens via API <b>apenas por esta instância</b>. Ao utilizá-lo no Header <code>Authorization: Bearer [token]</code>, as automações ganham acesso apenas às rotas desta instância, aumentando a segurança em relação ao token administrativo global.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                  <div style={{ flex: 1, fontFamily: "monospace", fontSize: "14px", letterSpacing: "1px" }}>
                    {showToken ? instanceToken : "••••••••-••••-••••-••••-••••••••••••"}
                  </div>
                  <button type="button" className="btn-secondary" style={{ padding: "8px" }} onClick={() => setShowToken(!showToken)} title={showToken ? "Esconder" : "Mostrar"}>
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="btn-secondary" style={{ padding: "8px" }} onClick={handleCopyToken} title="Copiar Token">
                    <Copy size={16} />
                  </button>
                  <button type="button" className="btn-secondary" style={{ padding: "8px", color: "var(--danger-color)" }} onClick={handleRevokeToken} disabled={revoking} title="Revogar e Gerar Novo">
                    <RefreshCw size={16} className={revoking ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Text Messages (Typing Simulation)">
              <Toggle 
                label="Simulate Typing" 
                description="Shows 'typing...' action before sending text messages."
                checked={settings.typingEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, typingEnabled: v })} 
              />
              {settings.typingEnabled && (
                <>
                  <Toggle 
                    label="Use real duration (calc)" 
                    description="Calculates exact wait time based on message length."
                    checked={settings.typingUseDuration} 
                    onChange={(v: boolean) => setSettings({ ...settings, typingUseDuration: v })} 
                  />
                  {settings.typingUseDuration ? (
                    <NumberInput 
                      label="Milliseconds per Character" 
                      value={settings.typingMsPerChar} 
                      onChange={(v: number) => setSettings({ ...settings, typingMsPerChar: v })} 
                      max={5000}
                      suffix="ms/char"
                    />
                  ) : (
                    <NumberInput 
                      label="Fixed wait time" 
                      value={settings.typingFixedSeconds} 
                      onChange={(v: number) => setSettings({ ...settings, typingFixedSeconds: v })} 
                      suffix="sec"
                    />
                  )}
                </>
              )}
            </Section>

            <Section title="Audio & Voice Notes">
              <Toggle 
                label="Simulate Recording Audio" 
                description="Shows 'recording audio...' action before sending audio/voice files."
                checked={settings.audioActionEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, audioActionEnabled: v })} 
              />
              {settings.audioActionEnabled && (
                <>
                  <Toggle 
                    label="Use real duration" 
                    description="Calculates exact wait time based on the audio file duration."
                    checked={settings.audioUseDuration} 
                    onChange={(v: boolean) => setSettings({ ...settings, audioUseDuration: v })} 
                  />
                  {!settings.audioUseDuration && (
                    <NumberInput 
                      label="Fixed wait time" 
                      value={settings.audioFixedSeconds} 
                      onChange={(v: number) => setSettings({ ...settings, audioFixedSeconds: v })} 
                      suffix="sec"
                    />
                  )}
                </>
              )}
            </Section>

            <Section title="Videos">
              <Toggle 
                label="Simulate Recording Video" 
                description="Shows 'recording video...' action before sending video files."
                checked={settings.videoActionEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, videoActionEnabled: v })} 
              />
              {settings.videoActionEnabled && (
                <>
                  <Toggle 
                    label="Baixar Vídeo no Servidor" 
                    description="Permite calcular Duração Real exata e evita falhas em vídeos gigantes no Telegram. Se desmarcado, envia apenas o link."
                    checked={settings.downloadVideoFirst} 
                    onChange={(v: boolean) => setSettings({ ...settings, downloadVideoFirst: v })} 
                  />
                  {settings.downloadVideoFirst && (
                    <Toggle 
                      label="Use real duration" 
                      description="Calculates exact wait time based on the video file duration."
                      checked={settings.videoUseDuration} 
                      onChange={(v: boolean) => setSettings({ ...settings, videoUseDuration: v })} 
                    />
                  )}
                  {(!settings.videoUseDuration || !settings.downloadVideoFirst) && (
                    <NumberInput 
                      label="Fixed wait time" 
                      value={settings.videoFixedSeconds} 
                      onChange={(v: number) => setSettings({ ...settings, videoFixedSeconds: v })} 
                      suffix="sec"
                    />
                  )}
                </>
              )}
            </Section>

            <Section title="Photos & Images">
              <Toggle 
                label="Simulate Sending Photo" 
                description="Shows 'sending photo...' action before uploading an image."
                checked={settings.photoActionEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, photoActionEnabled: v })} 
              />
              {settings.photoActionEnabled && (
                <NumberInput 
                  label="Fixed wait time" 
                  value={settings.photoFixedSeconds} 
                  onChange={(v: number) => setSettings({ ...settings, photoFixedSeconds: v })} 
                  suffix="sec"
                />
              )}
            </Section>

            <Section title="Documents & Files">
              <Toggle 
                label="Simulate Uploading Document" 
                description="Shows 'sending file...' action before uploading a document."
                checked={settings.documentActionEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, documentActionEnabled: v })} 
              />
              {settings.documentActionEnabled && (
                <NumberInput 
                  label="Fixed wait time" 
                  value={settings.documentFixedSeconds} 
                  onChange={(v: number) => setSettings({ ...settings, documentFixedSeconds: v })} 
                  suffix="sec"
                />
              )}
            </Section>

            <Section title="Comportamento de Texto">
              <Toggle 
                label="Fracionar Mensagens por Quebra de Linha" 
                description="Se enviar um texto longo com dupla quebra de linha (\n\n), o sistema vai dividir e enviar em múltiplos balões, simulando um humano digitando."
                checked={settings.splitMessagesEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, splitMessagesEnabled: v })} 
              />
            </Section>

            <Section title="Media & Downloads">
              <div style={{ gridColumn: "1 / -1", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <Toggle 
                    label="Cache em Nuvem (Zero-Upload)" 
                    description="Salva o ID das mídias enviadas no banco de dados por 24h. Envia instantaneamente sem precisar baixar ou fazer upload novamente para o Telegram."
                    checked={settings.mediaCacheEnabled} 
                    onChange={(v: boolean) => setSettings({ ...settings, mediaCacheEnabled: v })} 
                  />
                </div>
                <button type="button" onClick={handleResetCache} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Trash2 size={16} />
                  Reset Cache
                </button>
              </div>
              <Toggle 
                label="Auto-Read 'View Once' Media" 
                description="When downloading 'View Once' photos/videos/voice via the webhook media link, automatically mark them as opened/viewed in Telegram so they are destroyed."
                checked={settings.markViewOnceAsRead} 
                onChange={(v: boolean) => setSettings({ ...settings, markViewOnceAsRead: v })} 
              />
              <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "8px", color: "var(--text-secondary)" }}>
                  Duração da Mídia de Visualização Única (View Once) [Somente GramJS/Native]
                </label>
                <select 
                  className="input-field" 
                  value={settings.viewOnceTtlSeconds} 
                  onChange={(e) => setSettings({ ...settings, viewOnceTtlSeconds: Number(e.target.value) })}
                  disabled={instanceData?.type === 'BOT'}
                  style={{ opacity: instanceData?.type === 'BOT' ? 0.5 : 1 }}
                >
                  <option value={2147483647}>Padrão: Destruir ao Fechar (Infinito)</option>
                  <option value={30}>30 Segundos</option>
                  <option value={60}>60 Segundos (1 Minuto)</option>
                  <option value={15}>15 Segundos</option>
                  <option value={5}>5 Segundos</option>
                </select>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  {instanceData?.type === 'BOT' 
                    ? "Incompatível com Bot API. Use o painel abaixo de Auto-Destruição para Bots."
                    : "Define o comportamento ao enviar um arquivo com `viewOnce: true`. O padrão destrói o arquivo assim que o usuário fecha a tela."}
                </div>
              </div>
            </Section>

            <Section title="Voice AI (ElevenLabs TTS)">
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  ElevenLabs API Key
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input 
                    type="password"
                    className="input-field"
                    placeholder="Insert your API key here..."
                    value={settings.elevenLabsApiKey}
                    onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-secondary" onClick={fetchElevenLabsData} disabled={!settings.elevenLabsApiKey || loadingVoices}>
                    {loadingVoices ? "Loading..." : "Load Data"}
                  </button>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                  Used by the `/send/voice-ai` route and `&lt;voice_ai&gt;` tag in the Smart Route.
                </p>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
                    Selected Voice
                  </label>
                  <select 
                    className="input-field"
                    value={settings.elevenLabsVoiceId}
                    onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                  >
                    <option value="">Select a voice...</option>
                    {elevenLabsVoices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
                    AI Model
                  </label>
                  <select 
                    className="input-field"
                    value={settings.elevenLabsModelId}
                    onChange={(e) => setSettings({ ...settings, elevenLabsModelId: e.target.value })}
                  >
                    <option value="">Select a model...</option>
                    {elevenLabsModels.length > 0 ? (
                      elevenLabsModels.map((m) => (
                        <option key={m.model_id} value={m.model_id}>{m.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="eleven_multilingual_v2">Eleven Multilingual v2 (Recommended)</option>
                        <option value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Fastest)</option>
                        <option value="eleven_monolingual_v1">Eleven Monolingual v1</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </Section>

            {instanceData?.type === 'BOT' && (
              <Section title="Auto-Destruição para Bots (Fallback)">
                <div style={{ gridColumn: "1 / -1", marginBottom: "8px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "8px", color: "var(--text-secondary)" }}>
                    Gatilho de Destruição
                  </label>
                  <select 
                    className="input-field" 
                    value={settings.botSelfDestructMode} 
                    onChange={(e) => setSettings({ ...settings, botSelfDestructMode: e.target.value })}
                  >
                    <option value="AFTER_SEND">Destruir depois do Envio</option>
                    <option value="AFTER_REPLY">Destruir depois da Resposta do Usuário</option>
                  </select>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Bots não suportam visualização única nativa. Se uma mídia for enviada como view once, esta regra será aplicada.
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                  <NumberInput 
                    label="Tempo de Espera (Timer)" 
                    value={settings.botSelfDestructTimer} 
                    onChange={(v: number) => setSettings({ ...settings, botSelfDestructTimer: v })} 
                    suffix="sec"
                    min={0}
                    max={86400}
                  />
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {settings.botSelfDestructMode === 'AFTER_SEND' 
                      ? "A mídia será destruída após esse tempo." 
                      : "Após o usuário enviar a resposta, a mídia será destruída após esse tempo (use 0 para imediato)."}
                  </div>
                </div>
              </Section>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "40px" }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={18} />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
    </main>
  );
}
