import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { login, authError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📧</div>
        <h1>Mail Client</h1>
        <p>Sign in to manage your Office 365 email</p>

        <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                padding: "10px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
              }}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
              }}
            />
          </div>

          {(error || authError) && (
            <div style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 12 }}>
              {error || authError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "10px", justifyContent: "center" }}
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
