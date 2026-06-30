"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Save } from "lucide-react";

interface InstanceSettings {
  typingEnabled: boolean;
  typingMsPerChar: number | string;
  audioActionEnabled: boolean;
  audioUseDuration: boolean;
  audioFixedSeconds: number | string;
  videoActionEnabled: boolean;
  videoUseDuration: boolean;
  videoFixedSeconds: number | string;
  photoActionEnabled: boolean;
  photoFixedSeconds: number | string;
  documentActionEnabled: boolean;
  documentFixedSeconds: number | string;
  markViewOnceAsRead: boolean;
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
    typingMsPerChar: 10,
    audioActionEnabled: true,
    audioUseDuration: true,
    audioFixedSeconds: 3,
    videoActionEnabled: true,
    videoUseDuration: true,
    videoFixedSeconds: 5,
    photoActionEnabled: true,
    photoFixedSeconds: 2,
    documentActionEnabled: true,
    documentFixedSeconds: 2,
    markViewOnceAsRead: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const data = await apiClient.get<InstanceSettings>(`/api/instances/${id}/settings`);
      setSettings({
        typingEnabled: data.typingEnabled,
        typingMsPerChar: data.typingMsPerChar,
        audioActionEnabled: data.audioActionEnabled,
        audioUseDuration: data.audioUseDuration,
        audioFixedSeconds: data.audioFixedSeconds,
        videoActionEnabled: data.videoActionEnabled,
        videoUseDuration: data.videoUseDuration,
        videoFixedSeconds: data.videoFixedSeconds,
        photoActionEnabled: data.photoActionEnabled,
        photoFixedSeconds: data.photoFixedSeconds,
        documentActionEnabled: data.documentActionEnabled,
        documentFixedSeconds: data.documentFixedSeconds,
        markViewOnceAsRead: data.markViewOnceAsRead ?? true,
      });
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
      const v = Number(settings.typingMsPerChar);
      if (isNaN(v) || v < 0 || v > 5000) errors.push("Typing MS per char must be between 0 and 5000.");
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
      typingMsPerChar: Number(settings.typingMsPerChar) || 0,
      audioFixedSeconds: Number(settings.audioFixedSeconds) || 0,
      videoFixedSeconds: Number(settings.videoFixedSeconds) || 0,
      photoFixedSeconds: Number(settings.photoFixedSeconds) || 0,
      documentFixedSeconds: Number(settings.documentFixedSeconds) || 0,
      markViewOnceAsRead: settings.markViewOnceAsRead,
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
            
            <Section title="Text Messages (Typing Simulation)">
              <Toggle 
                label="Simulate Typing" 
                description="Shows 'typing...' action before sending text messages."
                checked={settings.typingEnabled} 
                onChange={(v: boolean) => setSettings({ ...settings, typingEnabled: v })} 
              />
              {settings.typingEnabled && (
                <NumberInput 
                  label="Milliseconds per Character" 
                  value={settings.typingMsPerChar} 
                  onChange={(v: number) => setSettings({ ...settings, typingMsPerChar: v })} 
                  max={5000}
                  suffix="ms/char"
                />
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
                    label="Use real duration" 
                    description="Calculates exact wait time based on the video file duration."
                    checked={settings.videoUseDuration} 
                    onChange={(v: boolean) => setSettings({ ...settings, videoUseDuration: v })} 
                  />
                  {!settings.videoUseDuration && (
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

            <Section title="Media & Downloads">
              <Toggle 
                label="Auto-Read 'View Once' Media" 
                description="When downloading 'View Once' photos/videos/voice via the webhook media link, automatically mark them as opened/viewed in Telegram so they are destroyed."
                checked={settings.markViewOnceAsRead} 
                onChange={(v: boolean) => setSettings({ ...settings, markViewOnceAsRead: v })} 
              />
            </Section>

            <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end" }}>
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
