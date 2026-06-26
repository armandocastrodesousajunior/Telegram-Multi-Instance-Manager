"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstanceCard, Instance } from "@/components/InstanceCard";
import { apiClient } from "@/lib/api-client";
import { Plus, BookOpen } from "lucide-react";
import Link from "next/link";
import { CreateInstanceModal } from "@/components/CreateInstanceModal";

export default function Dashboard() {
  const router = useRouter();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);

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

  const handleCreateInstance = async (name: string) => {
    try {
      const instance = await apiClient.post<Instance>("/api/instances", { name });
      setShowCreate(false);
      router.push(`/instances/${instance.id}/connection`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to create instance");
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
      </main>
    </div>
  );
}
