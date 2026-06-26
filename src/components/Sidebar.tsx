"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ArrowLeft, Settings, Webhook, ActivitySquare, Server, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const params = useParams();
  const id = params?.id as string;

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const navItems = [
    { name: "Connection", href: `/instances/${id}/connection`, icon: PhoneCall },
    { name: "Webhooks", href: `/instances/${id}/webhooks`, icon: Webhook },
    { name: "Settings", href: `/instances/${id}/settings`, icon: Settings },
    { name: "Logs", href: `/instances/${id}/logs`, icon: ActivitySquare },
  ];

  if (!mounted) return null;

  return (
    <aside style={{
      width: "260px",
      borderRight: "1px solid var(--glass-border)",
      background: "var(--bg-color)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 0",
      height: "100vh",
      position: "sticky",
      top: 0
    }}>
      <div style={{ padding: "0 24px", marginBottom: "40px" }}>
        <Link href="/" style={{
          display: "flex", 
          alignItems: "center", 
          gap: "10px", 
          fontSize: "15px", 
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: "24px",
          transition: "color 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <ArrowLeft size={18} />
          Back to Instances
        </Link>
        <h1 style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "10px", 
          fontSize: "18px", 
          fontWeight: 600 
        }}>
          <Server size={20} color="var(--accent-color)" />
          Instance Menu
        </h1>
      </div>

      <nav style={{ flex: 1, padding: "0 12px" }}>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link 
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: isActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "var(--glass-bg)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <item.icon size={20} color={isActive ? "var(--accent-color)" : "currentColor"} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>


    </aside>
  );
}
