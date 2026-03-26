import { useSearchParams } from "react-router-dom";

const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;

export function AdminConsentPage() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("admin_consent") === "True";
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + "/admin-consent")}`;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "var(--color-bg-secondary)",
    }}>
      <div style={{
        background: "var(--color-bg)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        padding: 40,
        maxWidth: 520,
        width: "90%",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Admin Consent</h1>

        {success ? (
          <>
            <div style={{ fontSize: 48, margin: "20px 0" }}>✅</div>
            <h2 style={{ color: "var(--color-success)", marginBottom: 12 }}>
              Successfully approved!
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              Your organization's users can now connect their Office 365 accounts.
              They can close this page and use the app.
            </p>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: 48, margin: "20px 0" }}>❌</div>
            <h2 style={{ color: "var(--color-danger)", marginBottom: 12 }}>
              Consent failed
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 16 }}>
              {errorDesc || "Something went wrong. Please try again."}
            </p>
            <a
              href={consentUrl}
              style={{
                display: "inline-block",
                padding: "10px 24px",
                background: "var(--color-primary)",
                color: "white",
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Try Again
            </a>
          </>
        ) : (
          <>
            <p style={{
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 8,
            }}>
              If your organization blocks user consent, an admin needs to
              approve this app once. After that, all users in your organization
              can connect their Office 365 accounts.
            </p>

            <p style={{
              color: "var(--color-text-muted)",
              fontSize: 13,
              marginBottom: 24,
            }}>
              This only needs to be done once per organization.
            </p>

            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Permissions requested:</h3>
            <div style={{
              textAlign: "left",
              background: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              marginBottom: 24,
              fontSize: 13,
              lineHeight: 1.8,
            }}>
              <div>✉️ Read and send mail</div>
              <div>📅 Read and write calendar</div>
              <div>👤 Read and write contacts</div>
              <div>👥 Read people list</div>
              <div>⚙️ Read mailbox settings</div>
              <div>🔑 Stay signed in</div>
            </div>

            <a
              href={consentUrl}
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: "var(--color-primary)",
                color: "white",
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Approve for your organization
            </a>

            <p style={{
              marginTop: 16,
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}>
              You must be a Global Admin or Privileged Role Administrator
            </p>
          </>
        )}
      </div>
    </div>
  );
}
