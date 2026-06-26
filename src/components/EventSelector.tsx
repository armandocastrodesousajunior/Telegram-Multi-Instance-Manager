"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface EventSelectorProps {
  selectedEvents: string[];
  onChange: (events: string[]) => void;
}

const AVAILABLE_EVENTS = [
  { id: "message", label: "New Message", description: "Triggered when a new message is received." },
  { id: "edited_message", label: "Message Edited", description: "Triggered when a message is edited." },
  { id: "typing", label: "User Typing/Action", description: "Triggered when a user is typing, recording audio, or uploading media." },
];

export function EventSelector({ selectedEvents, onChange }: EventSelectorProps) {
  const toggleEvent = (id: string) => {
    if (selectedEvents.includes(id)) {
      onChange(selectedEvents.filter(e => e !== id));
    } else {
      onChange([...selectedEvents, id]);
    }
  };

  return (
    <div className="grid grid-cols-2">
      {AVAILABLE_EVENTS.map(event => {
        const isSelected = selectedEvents.includes(event.id);
        
        return (
          <div 
            key={event.id}
            onClick={() => toggleEvent(event.id)}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${isSelected ? "var(--accent-color)" : "var(--glass-border)"}`,
              background: isSelected ? "rgba(99, 102, 241, 0.1)" : "rgba(0, 0, 0, 0.2)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              position: "relative"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: 500, color: isSelected ? "var(--accent-color)" : "var(--text-primary)" }}>
                {event.label}
              </h4>
              {isSelected && (
                <div style={{ background: "var(--accent-color)", borderRadius: "50%", padding: "2px", color: "white" }}>
                  <Check size={14} />
                </div>
              )}
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {event.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
