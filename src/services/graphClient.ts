const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string {
  const token = localStorage.getItem("appToken");
  if (!token) {
    throw new Error("Not authenticated. Please sign in.");
  }
  return token;
}

/**
 * Fetch wrapper that routes all Graph API calls through the backend proxy.
 * The backend attaches the user's Microsoft access token.
 */
export async function graphFetch(
  path: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
    accountId?: number; // for multi-account support
  } = {}
): Promise<any> {
  const token = getToken();
  const url = new URL(`${API_BASE}/api/graph/${path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  if (options.accountId) {
    url.searchParams.set("_accountId", String(options.accountId));
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (options.body && options.method && options.method !== "GET") {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), fetchOptions);

  if (res.status === 401) {
    localStorage.removeItem("appToken");
    window.location.reload();
    throw new Error("Session expired");
  }

  if (res.status === 204) {
    return undefined;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || data.error || `Graph API error: ${res.status}`);
    }
    return data;
  }

  if (!res.ok) {
    throw new Error(`Graph API error: ${res.status}`);
  }

  return res.text();
}

export function resetGraphClient(): void {
  // No client instance to reset in proxy mode
}
