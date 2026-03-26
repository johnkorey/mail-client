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
        <div className="login-logo">🔗</div>

        {status === "loading" && (
          <div>
            <h1>Connecting...</h1>
            <div className="loading-spinner" />
          </div>
        )}

        {status === "ready" && info && (
          <div>
            <h1>Connect Office 365</h1>
            <p style={{ marginBottom: 24, color: "var(--color-text-secondary)" }}>
              Click the button below to sign in with your Office 365 account and connect it to Mail Client.
            </p>

            {/* Code display */}
            <div
              style={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>
                Your verification code:
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: 6,
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {info.userCode}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleLogin}
              style={{ padding: "14px 32px", fontSize: 16, width: "100%", justifyContent: "center" }}
            >
              Login with Office 365
            </button>

            <p style={{ marginTop: 16, fontSize: 12, color: "var(--color-text-muted)" }}>
              A new window will open. Sign in with your Office 365 email to connect your account.
            </p>
          </div>
        )}

        {status === "signing_in" && (
          <div>
            <h1>Signing in...</h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
              Complete the sign-in in the Microsoft window that opened.
            </p>
            <div className="loading-spinner" />
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--color-text-muted)" }}>
              This page will update automatically once you're signed in.
            </p>
          </div>
        )}

        {status === "done" && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1>Connected!</h1>
            <p style={{ color: "var(--color-success)", fontWeight: 600 }}>
              Your Office 365 account has been connected successfully.
            </p>
            <p style={{ marginTop: 12, color: "var(--color-text-secondary)", fontSize: 13 }}>
              You can close this window and return to the Mail Client app.
            </p>
          </div>
        )}

        {status === "error" && (
          <div>
            <h1>Connection Failed</h1>
            <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>
              {error || "This connection link has expired or is invalid."}
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              Please go back to the Mail Client app and generate a new link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
