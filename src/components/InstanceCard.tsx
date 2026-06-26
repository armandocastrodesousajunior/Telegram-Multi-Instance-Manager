"use client";

import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export interface Instance {
  id: string;
  name: string;
  status: string;
  phone?: string;
  createdAt: string;
}

interface InstanceCardProps {
  instance: Instance;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  return (
    <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>{instance.name}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <PhoneCall size={14} />
            {instance.phone || "No phone connected"}
          </div>
        </div>
        <StatusBadge status={instance.status} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: "24px", display: "flex", flexDirection: "column" }}>
        <Link 
          href={`/instances/${instance.id}/connection`}
          className="btn-secondary"
          style={{ width: "100%", fontSize: "13px", padding: "10px", justifyContent: "center" }}
        >
          Manage Instance
          <ArrowRight size={16} style={{ marginLeft: "auto" }} />
        </Link>
      </div>
    </div>
  );
}
