const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const ANTIBOT_BYPASS = process.env.ANTIBOT_BYPASS === "true";
const POW_DIFFICULTY = parseInt(process.env.POW_DIFFICULTY || "18", 10);
const MIN_SOLVE_TIME_MS = 2000;
const CHALLENGE_TTL_MS = 120_000;
const FINGERPRINT_WINDOW_MS = 3600_000;
const FINGERPRINT_MAX_SESSIONS = 5;

// ── In-memory stores ──────────────────────────────────────────────

const challenges = new Map();
const fingerprintLog = new Map();

// ── Rate Limiters ─────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
  keyGenerator: (req) => req.ip,
});

const startSessionLimiter = rateLimit({
  windowMs: 600_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many connection attempts. Please try again later." },
  keyGenerator: (req) => req.ip,
});

const pollingLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
  keyGenerator: (req) => req.ip,
});

// ── Bot User-Agent blocklist ──────────────────────────────────────

const BOT_UA_PATTERNS = [
  // Search engine bots
  /googlebot/i, /bingbot/i, /baiduspider/i, /yandexbot/i,
  /slurp/i, /duckduckbot/i, /applebot/i,
  // Social media bots
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /pinterest/i, /embedly/i, /showyoubot/i, /outbrain/i,
  // HTTP libraries
  /scrapy/i, /python-requests/i, /python-urllib/i, /aiohttp/i,
  /axios/i, /node-fetch/i, /undici/i, /got\//i, /superagent/i,
  /java\//i, /okhttp/i, /apache-httpclient/i,
  /go-http-client/i, /php\//i, /ruby/i, /perl/i,
  // CLI tools
  /curl/i, /wget/i, /httpie/i, /postman/i, /insomnia/i,
  // Headless / automation
  /headlesschrome/i, /phantomjs/i, /slimerjs/i,
  /selenium/i, /webdriver/i, /puppeteer/i, /playwright/i,
  // Generic bots
  /bot\b/i, /spider/i, /crawl/i,
];

// ── Header Validation ─────────────────────────────────────────────

function validateHeadersLight(req, res, next) {
  if (ANTIBOT_BYPASS) return next();

  const ua = req.headers["user-agent"];
  if (!ua || ua.trim() === "") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function validateHeadersStrict(req, res, next) {
  if (ANTIBOT_BYPASS) return next();

  const ua = req.headers["user-agent"];
  if (!ua || ua.trim() === "") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const accept = req.headers["accept"];
  const acceptLang = req.headers["accept-language"];
  const acceptEnc = req.headers["accept-encoding"];

  if (!accept || !acceptLang || !acceptEnc) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// ── Challenge Generation ──────────────────────────────────────────

function generateChallenge(req, res) {
  if (ANTIBOT_BYPASS) {
    return res.json({
      challengeId: "bypass",
      prefix: "0000",
      difficulty: 0,
      issuedAt: Date.now(),
    });
  }

  const linkId = req.params.linkId;
  const challengeId = crypto.randomUUID();
  const prefix = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now();

  challenges.set(challengeId, {
    prefix,
    difficulty: POW_DIFFICULTY,
    issuedAt,
    linkId,
    used: false,
  });

  res.json({ challengeId, prefix, difficulty: POW_DIFFICULTY, issuedAt });
}

// ── Proof of Work Verification ────────────────────────────────────

function hasLeadingZeroBits(buffer, count) {
  let bitsChecked = 0;
  for (let i = 0; i < buffer.length && bitsChecked < count; i++) {
    for (let bit = 7; bit >= 0 && bitsChecked < count; bit--) {
      if ((buffer[i] >> bit) & 1) return false;
      bitsChecked++;
    }
  }
  return true;
}

// ── Full Antibot Validation Middleware ─────────────────────────────

function validateAntibot(req, res, next) {
  if (ANTIBOT_BYPASS) return next();

  const { antibot } = req.body || {};
  if (!antibot) {
    return res.status(403).json({ error: "Security verification required" });
  }

  const { challengeId, nonce, fingerprint, signals, honeypot, solvedAt } = antibot;

  // 1. Validate challenge exists, unused, correct link, not expired
  const challenge = challenges.get(challengeId);
  if (!challenge) {
    return res.status(403).json({ error: "Invalid or expired challenge" });
  }
  if (challenge.used) {
    return res.status(403).json({ error: "Challenge already used" });
  }
  if (challenge.linkId !== req.params.linkId) {
    return res.status(403).json({ error: "Challenge mismatch" });
  }
  if (Date.now() - challenge.issuedAt > CHALLENGE_TTL_MS) {
    challenges.delete(challengeId);
    return res.status(403).json({ error: "Challenge expired" });
  }

  // 2. Verify Proof of Work
  if (typeof nonce !== "number") {
    return res.status(403).json({ error: "Invalid proof of work" });
  }
  const hash = crypto
    .createHash("sha256")
    .update(challenge.prefix + String(nonce))
    .digest();

  if (!hasLeadingZeroBits(hash, challenge.difficulty)) {
    return res.status(403).json({ error: "Invalid proof of work" });
  }

  // 3. Timing analysis
  if (typeof solvedAt === "number" && solvedAt - challenge.issuedAt < MIN_SOLVE_TIME_MS) {
    return res.status(403).json({ error: "Verification failed" });
  }

  // 4. Honeypot check
  if (honeypot && typeof honeypot === "object") {
    const filled = Object.values(honeypot).some(
      (v) => v !== "" && v !== undefined && v !== null
    );
    if (filled) {
      return res.status(403).json({ error: "Verification failed" });
    }
  }

  // 5. Headless browser signal check
  if (signals && typeof signals === "object") {
    if (signals.webdriver === true) {
      return res.status(403).json({ error: "Automated browsers not allowed" });
    }
  }

  // 6. Fingerprint rate limiting
  if (fingerprint && typeof fingerprint === "string") {
    const now = Date.now();
    let timestamps = fingerprintLog.get(fingerprint) || [];
    timestamps = timestamps.filter((t) => now - t < FINGERPRINT_WINDOW_MS);
    timestamps.push(now);
    fingerprintLog.set(fingerprint, timestamps);

    if (timestamps.length > FINGERPRINT_MAX_SESSIONS) {
      return res.status(429).json({ error: "Too many connection attempts from this device" });
    }
  }

  // Mark challenge as used (single-use)
  challenge.used = true;

  next();
}

// ── Cleanup ───────────────────────────────────────────────────────

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (now - c.issuedAt > CHALLENGE_TTL_MS) challenges.delete(id);
  }
  for (const [fp, timestamps] of fingerprintLog) {
    const filtered = timestamps.filter((t) => now - t < FINGERPRINT_WINDOW_MS);
    if (filtered.length === 0) fingerprintLog.delete(fp);
    else fingerprintLog.set(fp, filtered);
  }
}

// ── Exports ───────────────────────────────────────────────────────

module.exports = {
  generalLimiter,
  startSessionLimiter,
  pollingLimiter,
  validateHeadersLight,
  validateHeadersStrict,
  generateChallenge,
  validateAntibot,
  cleanupExpiredChallenges,
};
