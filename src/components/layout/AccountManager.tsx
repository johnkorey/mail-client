import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";

interface AccountManagerProps {
  onClose: () => void;
}

export function AccountManager({ onClose }: AccountManagerProps) {
  const {
    microsoftAccounts,
    activeAccountId,
    setActiveAccountId,
    connectMicrosoft,
    disconnectMicrosoft,
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
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 520, width: "90%" }}>
        <div className="modal-header">
          <h2>Manage Accounts</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Connected accounts list */}
          <div className="sidebar-section-label" style={{ padding: "0 0 8px" }}>
            Connected Accounts ({microsoftAccounts.length})
          </div>

          {microsoftAccounts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {microsoftAccounts.map((acct) => (
                <div
                  key={acct.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: activeAccountId === acct.id
                      ? "var(--color-bg-active)"
                      : "var(--color-bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    border: activeAccountId === acct.id
                      ? "1px solid var(--color-primary)"
                      : "1px solid transparent",
                  }}
                  onClick={() => setActiveAccountId(acct.id)}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {acct.displayName?.charAt(0)?.toUpperCase() || "M"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {acct.displayName || "Office 365"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {acct.username}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {activeAccountId === acct.id && (
                      <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 600 }}>
                        Active
                      </span>
                    )}
                    <button
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectMicrosoft(acct.id);
                      }}
                      style={{
                        fontSize: 12,
                        color: "var(--color-danger)",
                        border: "1px solid var(--color-danger)",
                        padding: "4px 12px",
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 13,
                background: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-md)",
                marginBottom: 16,
              }}
            >
              No accounts connected yet
            </div>
          )}

          {/* Add account section */}
          <div
            style={{
              borderTop: "1px solid var(--color-border)",
              paddingTop: 16,
            }}
          >
            <div className="sidebar-section-label" style={{ padding: "0 0 12px" }}>
              Add Office 365 Account
            </div>

            {(connectStatus === "idle" || connectStatus === "error" || connectStatus === "completed") && (
              <div>
                <button
                  className="btn btn-primary"
                  onClick={connectMicrosoft}
                  style={{ padding: "10px 24px", width: "100%", justifyContent: "center" }}
                >
                  Generate Connection Link
                </button>

                {connectStatus === "error" && (
                  <p
                    style={{
                      color: "var(--color-danger)",
                      marginTop: 10,
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    {connectError || "Something went wrong. Please try again."}
                  </p>
                )}
              </div>
            )}

            {connectStatus === "generating" && (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div className="loading-spinner" />
                <p
                  style={{
                    marginTop: 10,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  Generating your connection link...
                </p>
              </div>
            )}

            {connectStatus === "waiting" && deviceCode && (
              <div>
                <p
                  style={{
                    marginBottom: 12,
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  Copy this link and open it in a browser where your Office 365
                  email is signed in:
                </p>

                <div
                  style={{
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 14px",
                    marginBottom: 12,
                    wordBreak: "break-all",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
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
                  style={{
                    padding: "8px 20px",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>

                <div
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                  }}
                >
                  <div className="loading-spinner" style={{ padding: 6 }} />
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Waiting for you to sign in from the link...
                  </p>
                </div>
              </div>
            )}

            {connectStatus === "completed" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-success)",
                  }}
                >
                  Account connected successfully!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
