"use client";

import Link from "next/link";
import { ArrowRight, PhoneCall, Edit2, Trash2, Shield } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export interface Instance {
  id: string;
  name: string;
  status: string;
  phone?: string;
  type?: "USER" | "BOT";
  botType?: "NORMAL" | "BUSINESS";
  botToken?: string;
  businessConnectionId?: string;
  createdAt: string;
}

interface InstanceCardProps {
  instance: Instance;
  onEdit?: (instance: Instance) => void;
  onDelete?: (instance: Instance) => void;
}

export function InstanceCard({ instance, onEdit, onDelete }: InstanceCardProps) {
  return (
    <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      
      {/* Top Header: Status (Left) and Actions (Right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <StatusBadge status={instance.status} />
        
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {onEdit && (
            <button onClick={() => onEdit(instance)} className="icon-btn" title="Edit name" style={{ padding: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", border: "1px solid var(--glass-border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", transition: "all 0.2s" }}>
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(instance)} className="icon-btn hover-danger" title="Delete instance" style={{ padding: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", border: "1px solid var(--glass-border)", cursor: "pointer", color: "var(--text-secondary)", display: "flex", transition: "all 0.2s" }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Info: Name and Phone */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: "6px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={instance.name}>
          {instance.name}
        </h3>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
          {instance.type === 'BOT' ? (
            <>
              <Shield size={14} style={{ flexShrink: 0, color: "var(--accent-primary)" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {instance.botType === 'BUSINESS' ? 'Business Account Bot' : 'Standard Bot'}
              </span>
            </>
          ) : (
            <>
              <PhoneCall size={14} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={instance.phone || "No phone connected"}>
                {instance.phone || "No phone connected"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Footer: Manage Button */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
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
