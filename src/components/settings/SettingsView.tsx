import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SavedLink {
  linkId: string;
  createdAt: string;
}

interface CustomDomain {
  id: number;
  domain: string;
  dns_verified: number;
  ssl_verified: number;
  created_at: string;
}

export function SettingsView() {
  const { token, deviceCode, connectMicrosoft, connectStatus } = useAuth();
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Domain state
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingDns, setVerifyingDns] = useState<number | null>(null);
  const [verifyingSsl, setVerifyingSsl] = useState<number | null>(null);
  const [dnsResult, setDnsResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const [sslResult, setSslResult] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const [appDomain, setAppDomain] = useState("");
  const [appIp, setAppIp] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");

  // Fetch links
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

  // Fetch domains
  useEffect(() => {
    if (!token) return;
    fetchDomains();
  }, [token]);

  const fetchDomains = () => {
    fetch(`${API_BASE}/domains/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setDomains(data.domains || []);
        setAppDomain(data.appDomain || "");
        setAppIp(data.appIp || "");
        setDomainsLoading(false);
      })
      .catch(() => setDomainsLoading(false));
  };

  const getLinkUrl = (linkId: string) => {
    if (!selectedDomain) return "";
    return `https://${selectedDomain}/connect/${linkId}`;
  };

  const handleCopy = (linkId: string) => {
    const url = getLinkUrl(linkId);
    navigator.clipboard.writeText(url);
    setCopied(linkId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async () => {
    await connectMicrosoft();
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    setDomainError(null);
    try {
      const res = await fetch(`${API_BASE}/domains/add`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewDomain("");
      fetchDomains();
    } catch (err: any) {
      setDomainError(err.message);
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDns = async (domainId: number) => {
    setVerifyingDns(domainId);
    setDnsResult(null);
    try {
      const res = await fetch(`${API_BASE}/domains/verify-dns/${domainId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.verified) {
        setDnsResult({ id: domainId, msg: `DNS verified via ${data.method}`, ok: true });
        fetchDomains();
      } else {
        setDnsResult({ id: domainId, msg: data.hint || data.error || "DNS not pointing correctly yet", ok: false });
      }
    } catch {
      setDnsResult({ id: domainId, msg: "Failed to check DNS", ok: false });
    } finally {
      setVerifyingDns(null);
    }
  };

  const handleVerifySsl = async (domainId: number) => {
    setVerifyingSsl(domainId);
    setSslResult(null);
    try {
      const res = await fetch(`${API_BASE}/domains/verify-ssl/${domainId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.verified) {
        setSslResult({ id: domainId, msg: `SSL verified (${data.issuer})`, ok: true });
        fetchDomains();
      } else {
        setSslResult({ id: domainId, msg: data.error || "SSL not installed", ok: false });
      }
    } catch {
      setSslResult({ id: domainId, msg: "Failed to check SSL", ok: false });
    } finally {
      setVerifyingSsl(null);
    }
  };

  const handleDeleteDomain = async (domainId: number) => {
    await fetch(`${API_BASE}/domains/${domainId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchDomains();
  };

  const verifiedDomains = domains.filter((d) => d.dns_verified && d.ssl_verified);

  // Auto-select first verified domain
  useEffect(() => {
    if (verifiedDomains.length > 0 && !selectedDomain) {
      setSelectedDomain(verifiedDomains[0].domain);
    }
  }, [verifiedDomains.length]);

  const currentLinkId = deviceCode?.loginId;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Settings</h2>

        {/* Custom Domains section */}
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
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Custom Domains</h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Add your own domains for connection links. You'll need to configure DNS records and install SSL.
            </p>
          </div>

          <div style={{ padding: 20 }}>
            {/* Add domain form */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); setDomainError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                placeholder="yourdomain.com"
                style={{
                  flex: 1, padding: "8px 12px", fontSize: 13,
                  border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
                  background: "var(--color-bg)", color: "var(--color-text)",
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddDomain}
                disabled={addingDomain || !newDomain.trim()}
                style={{ padding: "8px 16px", fontSize: 13, flexShrink: 0 }}
              >
                {addingDomain ? "Adding..." : "Add Domain"}
              </button>
            </div>

            {domainError && (
              <div style={{ color: "var(--color-danger)", fontSize: 12, marginBottom: 12 }}>{domainError}</div>
            )}

            {/* Domain list */}
            {domainsLoading ? (
              <div style={{ textAlign: "center", padding: 12, color: "var(--color-text-muted)", fontSize: 13 }}>Loading...</div>
            ) : domains.length === 0 ? (
              <div style={{ textAlign: "center", padding: 12, color: "var(--color-text-muted)", fontSize: 13 }}>
                No custom domains added yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {domains.map((d) => (
                  <div key={d.id} style={{
                    padding: "14px 16px",
                    background: "var(--color-bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                  }}>
                    {/* Domain header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{d.domain}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: d.ssl_verified ? "#e6f4ea" : d.dns_verified ? "#fff8e1" : "#fde8e8",
                        color: d.ssl_verified ? "#1b7a3a" : d.dns_verified ? "#f9a825" : "#c62828",
                      }}>
                        {d.ssl_verified ? "Verified" : d.dns_verified ? "DNS OK" : "Pending"}
                      </span>
                      <button
                        onClick={() => handleDeleteDomain(d.id)}
                        style={{
                          marginLeft: "auto", background: "none", border: "none",
                          color: "var(--color-text-muted)", cursor: "pointer", fontSize: 16, padding: "0 4px",
                        }}
                        title="Remove domain"
                      >
                        x
                      </button>
                    </div>

                    {/* DNS instructions */}
                    {!d.dns_verified && (
                      <div style={{
                        padding: "10px 12px", marginBottom: 10,
                        background: "var(--color-bg)", borderRadius: "var(--radius-md)",
                        fontSize: 12, lineHeight: 1.6,
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>DNS Setup Required:</div>
                        <div>Add one of the following records in your domain's DNS settings:</div>

                        {appIp && (
                          <div style={{
                            fontFamily: "var(--font-mono)", marginTop: 8, padding: "6px 10px",
                            background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)",
                            fontSize: 12,
                          }}>
                            <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: 2 }}>Option 1 — A Record (recommended):</div>
                            <div><strong>Type:</strong> A</div>
                            <div><strong>Name:</strong> {d.domain.split(".")[0] === "www" ? "www" : "@"}</div>
                            <div><strong>Value:</strong> {appIp}</div>
                          </div>
                        )}

                        {appDomain && (
                          <div style={{
                            fontFamily: "var(--font-mono)", marginTop: 8, padding: "6px 10px",
                            background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)",
                            fontSize: 12,
                          }}>
                            <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: 2 }}>{appIp ? "Option 2 — CNAME:" : "CNAME Record:"}</div>
                            <div><strong>Type:</strong> CNAME</div>
                            <div><strong>Name:</strong> {d.domain.split(".")[0] === "www" ? "www" : "@"}</div>
                            <div><strong>Target:</strong> {appDomain}</div>
                          </div>
                        )}

                        {!appIp && !appDomain && (
                          <div style={{ marginTop: 6, color: "var(--color-danger)" }}>
                            Server configuration missing — APP_DOMAIN or APP_IP must be set.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!d.dns_verified && (
                        <button
                          className="btn"
                          onClick={() => handleVerifyDns(d.id)}
                          disabled={verifyingDns === d.id}
                          style={{ padding: "6px 14px", fontSize: 12 }}
                        >
                          {verifyingDns === d.id ? "Checking..." : "Check DNS"}
                        </button>
                      )}
                      {d.dns_verified && !d.ssl_verified && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleVerifySsl(d.id)}
                          disabled={verifyingSsl === d.id}
                          style={{ padding: "6px 14px", fontSize: 12 }}
                        >
                          {verifyingSsl === d.id ? "Checking..." : "Install SSL"}
                        </button>
                      )}
                      {d.dns_verified && (
                        <button
                          className="btn"
                          onClick={() => handleVerifyDns(d.id)}
                          disabled={verifyingDns === d.id}
                          style={{ padding: "6px 14px", fontSize: 12 }}
                        >
                          Re-check DNS
                        </button>
                      )}
                      {d.ssl_verified && (
                        <button
                          className="btn"
                          onClick={() => handleVerifySsl(d.id)}
                          disabled={verifyingSsl === d.id}
                          style={{ padding: "6px 14px", fontSize: 12 }}
                        >
                          Re-check SSL
                        </button>
                      )}
                    </div>

                    {/* Result messages */}
                    {dnsResult?.id === d.id && (
                      <div style={{ marginTop: 8, fontSize: 12, color: dnsResult.ok ? "#1b7a3a" : "var(--color-danger)" }}>
                        {dnsResult.msg}
                      </div>
                    )}
                    {sslResult?.id === d.id && (
                      <div style={{ marginTop: 8, fontSize: 12, color: sslResult.ok ? "#1b7a3a" : "var(--color-danger)" }}>
                        {sslResult.msg}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
            {/* Domain selector */}
            {verifiedDomains.length > 0 ? (
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)", flexShrink: 0 }}>Domain:</label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  style={{
                    flex: 1, padding: "6px 10px", fontSize: 13,
                    border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
                    background: "var(--color-bg)", color: "var(--color-text)",
                  }}
                >
                  {verifiedDomains.map((d) => (
                    <option key={d.id} value={d.domain}>{d.domain}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{
                padding: 16, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13,
                background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)", marginBottom: 16,
              }}>
                Add and verify a custom domain above to generate connection links.
              </div>
            )}

            {verifiedDomains.length === 0 ? null : loading ? (
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
                        {getLinkUrl(link.linkId)}
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
