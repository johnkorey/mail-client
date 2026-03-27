import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SavedLink {
  linkId: string;
  createdAt: string;
}

export function SettingsView() {
  const { token, deviceCode, connectMicrosoft, connectStatus } = useAuth();
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch all saved links from server
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/microsoft/my-links`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLinks(data.links || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, deviceCode]);

  const handleCopy = (linkId: string) => {
    const url = `${window.location.origin}/connect/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopied(linkId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async () => {
    await connectMicrosoft();
  };

  const currentLinkId = deviceCode?.loginId;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Settings</h2>

        {/* Connection Links section */}
        <div style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          marginBottom: 24,
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg-secondary)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Connection Links</h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Share these links with anyone to let them connect their Office 365 account. Links are permanent and can be used multiple times.
            </p>
          </div>

          <div style={{ padding: 20 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--color-text-muted)" }}>
                Loading...
              </div>
            ) : links.length === 0 && !currentLinkId ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 16 }}>
                  No connection links generated yet
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={connectStatus === "generating"}
                  style={{ padding: "10px 24px" }}
                >
                  {connectStatus === "generating" ? "Generating..." : "Generate Connection Link"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {links.map((link) => (
                  <div
                    key={link.linkId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "var(--color-bg-secondary)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--color-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                        onClick={() => handleCopy(link.linkId)}
                        title="Click to copy"
                      >
                        {window.location.origin}/connect/{link.linkId}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                        Created {new Date(link.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => handleCopy(link.linkId)}
                      style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        flexShrink: 0,
                        background: copied === link.linkId ? "var(--color-success)" : undefined,
                        color: copied === link.linkId ? "white" : undefined,
                        border: copied === link.linkId ? "1px solid var(--color-success)" : undefined,
                      }}
                    >
                      {copied === link.linkId ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                ))}

                <button
                  className="btn"
                  onClick={handleGenerate}
                  disabled={connectStatus === "generating"}
                  style={{ padding: "8px 20px", alignSelf: "flex-start", marginTop: 4 }}
                >
                  {connectStatus === "generating" ? "Generating..." : "+ Generate New Link"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* App Info */}
        <div style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>About</h3>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
            <div>Mail Client — Office 365 Mail App</div>
            <div>Version 1.0.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
