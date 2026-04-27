import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface UserInfo {
  id: number;
  username: string;
  email: string;
  displayName: string;
}

interface MsAccount {
  id: number;
  username: string;
  displayName: string;
}

interface DeviceCodeInfo {
  loginId: string;
  userCode: string;
  verificationUri: string;
  message: string;
}

interface AuthState {
  // App auth
  isLoggedIn: boolean;
  authChecking: boolean;
  user: UserInfo | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;

  // Microsoft connection
  microsoftConnected: boolean;
  microsoftAccounts: MsAccount[];
  activeAccountId: number | null;
  setActiveAccountId: (id: number | null) => void;
  connectMicrosoft: (theme?: string) => Promise<void>;
  disconnectMicrosoft: (accountId?: number) => Promise<void>;

  // Device code state
  deviceCode: DeviceCodeInfo | null;
  connectStatus: "idle" | "generating" | "waiting" | "completed" | "error";
  connectError: string | null;

  // Auth error
  authError: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("appToken"));
  const [user, setUser] = useState<UserInfo | null>(null);
  // Becomes false once we've either verified the stored token or confirmed
  // there is none. Prevents the LoginPage from flashing while /auth/me runs.
  const [authChecking, setAuthChecking] = useState<boolean>(() => !!localStorage.getItem("appToken"));
  const [microsoftAccounts, setMicrosoftAccounts] = useState<MsAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(() => {
    const savedLinkId = localStorage.getItem("connectLinkId");
    return savedLinkId ? { loginId: savedLinkId, userCode: "", verificationUri: "", message: "" } : null;
  });
  const [connectStatus, setConnectStatus] = useState<AuthState["connectStatus"]>(() => {
    return localStorage.getItem("connectLinkId") ? "waiting" : "idle";
  });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isLoggedIn = !!token && !!user;
  const microsoftConnected = microsoftAccounts.length > 0;

  // Verify existing token on mount
  useEffect(() => {
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setMicrosoftAccounts(data.microsoftAccounts || []);
        if (data.microsoftAccounts?.length > 0 && !activeAccountId) {
          setActiveAccountId(data.microsoftAccounts[0].id);
        }
      })
      .catch(() => {
        localStorage.removeItem("appToken");
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setAuthError(null);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error);
      throw new Error(data.error);
    }
    localStorage.setItem("appToken", data.token);
    setToken(data.token);
    setUser(data.user);
    setMicrosoftAccounts(data.microsoftAccounts || []);
    if (data.microsoftAccounts?.length > 0) {
      setActiveAccountId(data.microsoftAccounts[0].id);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("appToken");
    localStorage.removeItem("connectLinkId");
    setToken(null);
    setUser(null);
    setMicrosoftAccounts([]);
    setActiveAccountId(null);
    setDeviceCode(null);
    setConnectStatus("idle");
  }, []);

  const connectMicrosoft = useCallback(async (theme?: string) => {
    if (!token) return;
    setConnectStatus("generating");
    setConnectError(null);

    try {
      const res = await fetch(`${API_BASE}/microsoft/connect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme || "dropbox" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setConnectError(data.error);
        setConnectStatus("error");
        return;
      }

      // Server now returns a persistent linkId (no device code yet)
      localStorage.setItem("connectLinkId", data.linkId);
      setDeviceCode({
        loginId: data.linkId,
        userCode: "",
        verificationUri: "",
        message: "",
      });
      setConnectStatus("waiting");

      // Poll for any completed connections through this link
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API_BASE}/microsoft/poll/${data.linkId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pollData = await pollRes.json();

          if (pollData.status === "completed") {
            const newAccount: MsAccount = pollData.msAccount;
            setMicrosoftAccounts((prev) => {
              const exists = prev.find((a) => a.id === newAccount.id);
              if (exists) return prev.map((a) => a.id === newAccount.id ? newAccount : a);
              return [...prev, newAccount];
            });
            setActiveAccountId(newAccount.id);
            // Don't clear the link — keep polling for more connections
            setConnectStatus("completed");
          }
        } catch {
          // Network error, keep polling
        }
      }, 3000);

      // Stop polling after 24 hours
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 24 * 60 * 60 * 1000);
    } catch (error: any) {
      setConnectError(error.message);
      setConnectStatus("error");
    }
  }, [token]);

  const disconnectMicrosoft = useCallback(async (accountId?: number) => {
    if (!token) return;
    await fetch(`${API_BASE}/microsoft/disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId }),
    });
    if (accountId) {
      setMicrosoftAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setActiveAccountId((prev) => prev === accountId ? null : prev);
    } else {
      setMicrosoftAccounts([]);
      setActiveAccountId(null);
    }
    setConnectStatus("idle");
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        authChecking,
        user,
        token,
        login,
        logout,
        microsoftConnected,
        microsoftAccounts,
        activeAccountId,
        setActiveAccountId,
        connectMicrosoft,
        disconnectMicrosoft,
        deviceCode,
        connectStatus,
        connectError,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
