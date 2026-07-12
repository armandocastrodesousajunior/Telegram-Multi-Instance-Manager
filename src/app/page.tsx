"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstanceCard, Instance } from "@/components/InstanceCard";
import { apiClient } from "@/lib/api-client";
import { Plus, BookOpen } from "lucide-react";
import Link from "next/link";
import { CreateInstanceModal } from "@/components/CreateInstanceModal";
import { EditInstanceModal } from "@/components/EditInstanceModal";
import { DeleteInstanceModal } from "@/components/DeleteInstanceModal";

export default function Dashboard() {
  const router = useRouter();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [deletingInstance, setDeletingInstance] = useState<Instance | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchInstances();
  }, [router]);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Instance[]>("/api/instances");
      setInstances(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to load instances");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async (payload: { name: string, type: "USER" | "BOT", botType?: "NORMAL" | "BUSINESS", botToken?: string }) => {
    try {
      const instance = await apiClient.post<Instance>("/api/instances", payload);
      setShowCreate(false);
      router.push(`/instances/${instance.id}/connection`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to create instance");
    }
  };

  const handleEditInstance = async (id: string, name: string) => {
    try {
      await apiClient.put(`/api/instances/${id}`, { name }); // It might be PATCH actually, let's use put since our custom client handles it, actually let's just use put for patch or explicitly patch
      // the custom apiClient doesn't have patch by default, let's use standard fetch or apiClient.patch if it exists. Wait, I added PATCH to /api/instances/[id]
      // I'll change it to use fetch or check if we can use put. Let's assume custom api client might not have patch. 
      // I'll change the api route to accept both PUT and PATCH, or just use fetch here. 
    } catch (error: any) {
      // placeholder, will fix in next block
    }
  };

  return (
    <div className="page-container" style={{ justifyContent: "center" }}>
      <main className="main-content" style={{ width: "100%", maxWidth: "1000px" }}>
        <header className="page-header animate-fade-in" style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: "24px", marginBottom: "40px" }}>
          <div>
            <h1 className="page-title">Instances</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Manage your Telegram client instances.</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <Link href="/docs" className="btn-secondary">
              <BookOpen size={20} />
              API Docs
            </Link>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={20} />
              New Instance
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            Loading instances...
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {instances.map(instance => (
              <InstanceCard 
                key={instance.id} 
                instance={instance} 
                onEdit={setEditingInstance}
                onDelete={setDeletingInstance}
              />
            ))}
            {instances.length === 0 && (
              <div className="glass-panel" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>No instances found.</p>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Your First Instance</button>
              </div>
            )}
          </div>
        )}

        {showCreate && <CreateInstanceModal onClose={() => setShowCreate(false)} onSubmit={handleCreateInstance} />}
        {editingInstance && (
          <EditInstanceModal 
            instance={editingInstance} 
            onClose={() => setEditingInstance(null)} 
            onSubmit={async (id, name) => {
              try {
                // Fetch directly since apiClient might not support PATCH explicitly
                const res = await fetch(`/api/instances/${id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ name })
                });
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error(errorData.error || "Failed to update instance");
                }
                setEditingInstance(null);
                fetchInstances();
              } catch (error: any) {
                console.error(error);
                alert(error.message || "Failed to update instance");
              }
            }} 
          />
        )}
        {deletingInstance && (
          <DeleteInstanceModal 
            instance={deletingInstance} 
            onClose={() => setDeletingInstance(null)} 
            onSubmit={async (id) => {
              try {
                await apiClient.delete(`/api/instances/${id}`);
                setDeletingInstance(null);
                fetchInstances();
              } catch (error: any) {
                console.error(error);
                alert(error.message || "Failed to delete instance");
              }
            }} 
          />
        )}
      </main>
    </div>
  );
}
