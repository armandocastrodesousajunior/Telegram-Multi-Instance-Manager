"use client";

interface StatusBadgeProps {
  status: "active" | "stopped" | "error" | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let statusClass = "status-stopped";
  let label = status.toUpperCase();

  if (status.toLowerCase() === "active" || status.toLowerCase() === "connected") {
    statusClass = "status-active";
    label = "ACTIVE";
  } else if (status.toLowerCase() === "error") {
    statusClass = "status-error";
  }

  return (
    <span className={`status-badge ${statusClass}`}>
      {label}
    </span>
  );
}
