"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Book, Code, Terminal, Play, MessageSquare, Image as ImageIcon, Video, FileText, Mic, Music } from "lucide-react";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("text");
  const [origin, setOrigin] = useState("https://your-domain.com");

  // Test Runner States
  const [testInstanceId, setTestInstanceId] = useState("");
  const [testApiToken, setTestApiToken] = useState("");
  const [testPayload, setTestPayload] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const endpoints = [
    { id: "text", label: "Send Text", icon: MessageSquare },
    { id: "image", label: "Send Image", icon: ImageIcon },
    { id: "video", label: "Send Video", icon: Video },
    { id: "audio", label: "Send Audio", icon: Music },
    { id: "voice", label: "Send Voice Note", icon: Mic },
    { id: "document", label: "Send Document", icon: FileText },
    { id: "smart", label: "Smart Flow", icon: Play },
  ];

  const getEndpointData = (id: string) => {
    const baseUrl = `${origin}/api/v1/[instanceId]/send/${id}`;
    const payloadFields: any[] = [
      { name: "chatId", type: "string | number", description: "The recipient's phone number, username (with @), or chat ID.", required: true },
    ];
    
    if (id === "text") {
      payloadFields.push({ name: "text", type: "string", description: "The message text to send.", required: true });
    } else if (id === "smart") {
      payloadFields.push({ name: "content", type: "string", description: "The dynamic mixed-content payload containing custom media tags (e.g. <image url='...'></image>).", required: true });
    } else {
      payloadFields.push({ name: "url", type: "string", description: `The URL of the ${id} to send.`, required: true });
      if (id !== "voice") {
        payloadFields.push({ name: "caption", type: "string", description: "Optional caption for the media.", required: false });
      }
      if (id === "image" || id === "video") {
        payloadFields.push({ name: "viewOnce", type: "boolean", description: "If true, sends the media as View-Once (self-destructs after viewing). Note: Telegram typically supports this only in 1-on-1 private chats.", required: false });
      }
    }
    
    if (id === "text" || id === "image" || id === "video" || id === "document" || id === "smart") {
      payloadFields.push({ name: "parseMode", type: "string", description: 'Format of the text/caption. Use "html" or "md" (Markdown).', required: false });
    }
    
    payloadFields.push({ name: "replyToMsgId", type: "number", description: "The ID of a message to reply to.", required: false });

    const exampleJson: any = { chatId: "@username" };
    if (id === "text") {
      exampleJson.text = "Hello <b>world</b>!";
      exampleJson.parseMode = "html";
    } else if (id === "smart") {
      exampleJson.content = "oi bb, blz, olha isso daqui\n\n<view_once_video url=\"https://example.com/video.mp4\">gostou??</view_once_video>\n\n<voice url=\"https://example.com/audio.mp3\"></voice>\n\npser bb <b>world</b>";
      exampleJson.parseMode = "html";
    } else {
      exampleJson.url = `https://example.com/file.${id === "image" ? "jpg" : id === "video" ? "mp4" : "mp3"}`;
      if (id !== "voice") exampleJson.caption = "Check this out!";
      if (id === "image" || id === "video") exampleJson.viewOnce = true;
    }

    return { baseUrl, payloadFields, exampleJson };
  };

  const currentData = getEndpointData(activeTab);

  // Initialize test payload when tab changes or origin loads
  useEffect(() => {
    setTestPayload(JSON.stringify(getEndpointData(activeTab).exampleJson, null, 2));
    setTestResponse(null);
  }, [activeTab, origin]);

  const handleTestRequest = async () => {
    if (!testInstanceId || !testApiToken) {
      alert("Instance ID and API Token are required to test.");
      return;
    }
    
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(testPayload);
    } catch (e) {
      alert("Invalid JSON payload.");
      return;
    }

    setTestLoading(true);
    setTestResponse(null);
    try {
      const res = await fetch(`${origin}/api/v1/${testInstanceId}/send/${activeTab}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${testApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsedPayload)
      });
      const data = await res.json();
      setTestResponse({ status: res.status, ok: res.ok, data });
    } catch (err: any) {
      setTestResponse({ status: "Error", ok: false, error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: "280px", margin: "20px", padding: "24px 16px", display: "flex", flexDirection: "column" }}>
        <Link href="/" className="btn-secondary" style={{ marginBottom: "32px", width: "100%", justifyContent: "flex-start" }}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
        
        <div style={{ marginBottom: "24px", paddingLeft: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", marginBottom: "16px", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
            <Book size={14} /> Documentation
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {endpoints.map((ep) => {
              const Icon = ep.icon;
              const isActive = activeTab === ep.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => setActiveTab(ep.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                    borderRadius: "8px", border: "none", background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    cursor: "pointer", fontWeight: isActive ? 500 : 400, textAlign: "left", transition: "all 0.2s ease"
                  }}
                  className="sidebar-btn"
                >
                  <Icon size={18} />
                  {ep.label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ padding: "40px 60px" }}>
        <div className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <span className="badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--success-color)", fontSize: "14px", padding: "6px 12px", borderRadius: "99px", fontWeight: "bold" }}>POST</span>
            <h1 className="page-title">{endpoints.find(e => e.id === activeTab)?.label}</h1>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "15px", color: "var(--text-secondary)", marginBottom: "40px", padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            {currentData.baseUrl}
          </div>

          <div className="grid grid-cols-2" style={{ gap: "32px" }}>
            {/* Left Column: Parameters */}
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>Headers</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px", fontSize: "14px" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 500 }}>Authorization</td>
                    <td style={{ padding: "12px 0", color: "var(--text-secondary)" }}>Bearer YOUR_API_TOKEN</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 500 }}>Content-Type</td>
                    <td style={{ padding: "12px 0", color: "var(--text-secondary)" }}>application/json</td>
                  </tr>
                </tbody>
              </table>

              <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>JSON Payload</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {currentData.payloadFields.map((field, i) => (
                  <div key={i} className="glass-card" style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{field.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--accent-color)" }}>{field.type}</span>
                      {field.required && <span className="status-badge status-error" style={{ fontSize: "10px", padding: "2px 8px" }}>Required</span>}
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                      {field.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Code Snippets & Test Runner */}
            <div>
              {/* Test Runner */}
              <div className="glass-panel" style={{ padding: 0, overflow: "hidden", marginBottom: "24px", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                  <Play size={16} /> Test it now
                </div>
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>Instance ID</label>
                      <input type="text" className="input-field" placeholder="e.g. c37cde..." value={testInstanceId} onChange={e => setTestInstanceId(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>API Token</label>
                      <input type="password" className="input-field" placeholder="Bearer Token" value={testApiToken} onChange={e => setTestApiToken(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>JSON Payload</label>
                    <textarea 
                      className="input-field" 
                      style={{ height: "120px", fontFamily: "monospace", resize: "vertical" }}
                      value={testPayload}
                      onChange={e => setTestPayload(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary" onClick={handleTestRequest} disabled={testLoading} style={{ alignSelf: "flex-start" }}>
                    <Play size={16} />
                    {testLoading ? "Sending..." : "Send Request"}
                  </button>

                  {testResponse && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: `1px solid ${testResponse.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                      <div style={{ fontSize: "12px", color: testResponse.ok ? "var(--success-color)" : "var(--error-color)", marginBottom: "8px", fontWeight: "bold" }}>
                        Response Status: {testResponse.status}
                      </div>
                      <pre style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
                        {JSON.stringify(testResponse.data || testResponse.error, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* cURL */}
              <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                  <Terminal size={16} /> cURL Example
                </div>
                <div style={{ padding: "20px", overflowX: "auto" }}>
                  <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-primary)", whiteSpace: "pre-wrap", margin: 0 }}>
{`curl -X POST "${currentData.baseUrl.replace('[instanceId]', 'YOUR_INSTANCE_ID')}" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(currentData.exampleJson, null, 2)}'`}
                  </pre>
                </div>
              </div>

              {/* Node.js */}
              <div className="glass-panel" style={{ padding: 0, overflow: "hidden", marginTop: "24px" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--glass-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                  <Code size={16} /> Node.js / Fetch Example
                </div>
                <div style={{ padding: "20px", overflowX: "auto" }}>
                  <pre style={{ fontFamily: "monospace", fontSize: "13px", color: "#61dafb", whiteSpace: "pre-wrap", margin: 0 }}>
{`const response = await fetch("${currentData.baseUrl.replace('[instanceId]', 'YOUR_INSTANCE_ID')}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${JSON.stringify(currentData.exampleJson, null, 4).replace(/\n/g, '\n  ')})
});

const data = await response.json();
console.log(data);`}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
      
      <style jsx>{`
        .sidebar-btn:hover {
          background: rgba(255,255,255,0.05) !important;
        }
      `}</style>
    </div>
  );
}
