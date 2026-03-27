import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ConnectInfo {
  userCode: string;
  verificationUri: string;
  message: string;
  status: string;
}

export function ConnectLinkPage() {
  const { loginId } = useParams<{ loginId: string }>();
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signing_in" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Fetch connection info
  useEffect(() => {
    if (!loginId) return;

    fetch(`${API_BASE}/microsoft/connect-info/${loginId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Connection link expired or invalid");
        return res.json();
      })
      .then((data) => {
        setInfo(data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [loginId]);

  // Poll for completion after user clicks login
  useEffect(() => {
    if (status !== "signing_in" || !loginId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/microsoft/connect-status/${loginId}`);
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
  }, [status, loginId]);

  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (info?.userCode) {
      navigator.clipboard.writeText(info.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogin = () => {
    if (!info) return;
    // Open Microsoft's device login with the code pre-filled
    const url = `${info.verificationUri}?otc=${info.userCode}`;
    window.open(url, "_blank");
    setStatus("signing_in");
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="loading-spinner" />
            <p style={{ marginTop: 16, color: "var(--color-text-muted)" }}>Loading...</p>
          </div>
        )}

        {status === "ready" && info && (
          <div>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--color-bg-active)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 28,
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
              padding: "24px",
              marginBottom: 20,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                Your Code
              </div>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: 8,
                color: "var(--color-primary)",
                fontFamily: "var(--font-mono)",
                marginBottom: 12,
              }}>
                {info.userCode}
              </div>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: "6px 20px",
                  fontSize: 13,
                  background: copied ? "var(--color-success)" : "var(--color-bg)",
                  color: copied ? "white" : "var(--color-text)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              marginBottom: 20,
              padding: "16px",
              background: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.8,
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
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--color-bg-active)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 28,
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
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#e6f4ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 28,
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8, color: "var(--color-success)" }}>Account connected</h1>
            <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Your Office 365 account has been connected successfully. You can close this page.
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#fde8e8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 28,
            }}>
              !
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "var(--color-danger)", marginBottom: 16, lineHeight: 1.6 }}>
              {error || "This connection link has expired or is invalid."}
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              Go back to the app and generate a new connection link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
