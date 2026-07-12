"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Plus, Save, ArrowLeft, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { EventSelector } from "@/components/EventSelector";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  name: string;
  active: boolean;
  includeOutgoing: boolean;
}

export default function InstanceWebhooksPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [instanceData, setInstanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formIncludeOutgoing, setFormIncludeOutgoing] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchInstance();
    fetchWebhooks();
  }, [id, router]);

  const fetchInstance = async () => {
    try {
      const data = await apiClient.get<any>(`/api/instances/${id}`);
      setInstanceData(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Webhook[]>(`/api/instances/${id}/webhooks`);
      setWebhooks(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingId(webhook.id);
    setFormName(webhook.name || "");
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setFormIncludeOutgoing(webhook.includeOutgoing ?? true);
    setShowForm(true);
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    try {
      await apiClient.delete(`/api/instances/${id}/webhooks/${webhookId}`);
      fetchWebhooks();
    } catch (error: any) {
      alert(error.message || "Failed to delete webhook");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formEvents.length === 0) {
      return alert("Select at least one event");
    }
    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/instances/${id}/webhooks/${editingId}`, {
          name: formName,
          url: formUrl,
          events: formEvents,
          includeOutgoing: formIncludeOutgoing
        });
      } else {
        await apiClient.post(`/api/instances/${id}/webhooks`, {
          name: formName,
          url: formUrl,
          events: formEvents,
          includeOutgoing: formIncludeOutgoing
        });
      }
      setShowForm(false);
      setEditingId(null);
      fetchWebhooks();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  const openNewForm = () => {
    setEditingId(null);
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
    setFormIncludeOutgoing(true);
    setShowForm(true);
  };

  return (
    <main className="main-content">
      <header className="page-header animate-fade-in">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 className="page-title">Webhooks</h1>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Set up where to send events for this instance.</p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={openNewForm}>
            <Plus size={18} />
            New Webhook
          </button>
        )}
      </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Loading webhooks...</div>
        ) : (
          <>
            {!showForm && webhooks.length > 0 && (
              <div className="grid grid-cols-1" style={{ gap: "16px", maxWidth: "70%", margin: "0 auto" }}>
                {webhooks.map((wh) => (
                  <div key={wh.id} className="glass-card animate-slide-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>{wh.name || "Unnamed Webhook"}</h3>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>{wh.url}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {wh.events.slice(0, 3).map(ev => (
                          <span key={ev} className="badge" style={{ backgroundColor: "rgba(99, 102, 241, 0.1)", color: "var(--accent-primary)" }}>
                            {ev}
                          </span>
                        ))}
                        {wh.events.length > 3 && (
                          <span className="badge" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>+{wh.events.length - 3} more</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn-secondary" style={{ padding: "8px" }} onClick={() => handleEdit(wh)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-danger" style={{ padding: "8px" }} onClick={() => handleDelete(wh.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!showForm && webhooks.length === 0 && (
              <div className="glass-panel" style={{ maxWidth: "70%", margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>No webhooks configured.</p>
                <button className="btn-primary" onClick={openNewForm}>Add First Webhook</button>
              </div>
            )}

            {showForm && (
              <form className="glass-panel animate-slide-up" style={{ maxWidth: "70%", margin: "0 auto" }} onSubmit={handleSave}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 600 }}>{editingId ? "Edit Webhook" : "New Webhook"}</h3>
                </div>

                <div className="grid grid-cols-2" style={{ gap: "20px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Webhook Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={formName} 
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. My CRM"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>Webhook URL</label>
                    <input 
                      type="url" 
                      className="input-field" 
                      value={formUrl} 
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://your-domain.com/webhook"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "16px" }}>Subscribed Events</label>
                  <EventSelector 
                    selectedEvents={formEvents} 
                    onChange={(events) => setFormEvents(events)} 
                    instanceType={instanceData?.type}
                  />
                </div>

                <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={formIncludeOutgoing} 
                      onChange={(e) => setFormIncludeOutgoing(e.target.checked)} 
                    />
                    <span className="slider round"></span>
                  </label>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>Incluir Mensagens Enviadas por Mim</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Se desativado, recebe apenas as mensagens enviadas pelo lead.</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--glass-border)", paddingTop: "24px" }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    <Save size={18} />
                    {saving ? "Saving..." : "Save Webhook"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
    </main>
  );
}
