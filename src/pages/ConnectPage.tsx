import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export function ConnectPage() {
  const {
    user,
    logout,
    connectMicrosoft,
    deviceCode,
    connectStatus,
    connectError,
  } = useAuth();

  const [copied, setCopied] = useState(false);

  const connectLink = deviceCode
    ? `${window.location.origin}/connect/${deviceCode.loginId}`
    : "";

  const handleCopyLink = () => {
    if (connectLink) {
      navigator.clipboard.writeText(connectLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-logo">📧</div>
        <h1>Welcome, {user?.displayName}!</h1>
        <p style={{ marginBottom: 24 }}>
          Connect your Office 365 account to start managing your email, calendar, and contacts.
        </p>

        {(connectStatus === "idle" || connectStatus === "error") && (
          <div>
            <button
              className="btn btn-primary"
              onClick={connectMicrosoft}
              style={{ padding: "12px 32px", fontSize: 15 }}
            >
              Generate link to connect to Office 365
            </button>

            {connectStatus === "error" && (
              <p style={{ color: "var(--color-danger)", marginTop: 12, fontSize: 13 }}>
                {connectError || "Something went wrong. Please try again."}
              </p>
            )}
          </div>
        )}

        {connectStatus === "generating" && (
          <div>
            <div className="loading-spinner" />
            <p style={{ marginTop: 12, color: "var(--color-text-secondary)" }}>
              Generating your connection link...
            </p>
          </div>
        )}

        {connectStatus === "waiting" && deviceCode && (
          <div>
            <p style={{ marginBottom: 16, color: "var(--color-text-secondary)", fontSize: 13 }}>
              Your connection link is ready. Copy it and open it in a browser where your Office 365 email is signed in.
            </p>

            {/* Link display */}
            <div
              style={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                marginBottom: 16,
                wordBreak: "break-all",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-primary)",
                userSelect: "all",
                cursor: "pointer",
              }}
              onClick={handleCopyLink}
              title="Click to copy"
            >
              {connectLink}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCopyLink}
              style={{ padding: "10px 24px", marginBottom: 20 }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <div style={{ marginTop: 16 }}>
              <div className="loading-spinner" style={{ padding: 8 }} />
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Waiting for you to sign in from the link...
              </p>
            </div>
          </div>
        )}

        {connectStatus === "completed" && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--color-success)" }}>
              Account connected successfully!
            </p>
            <p style={{ marginTop: 8, color: "var(--color-text-secondary)" }}>
              Loading your mail...
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <button className="btn" onClick={logout} style={{ fontSize: 12 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
