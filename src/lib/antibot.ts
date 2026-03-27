interface BrowserSignals {
  webdriver: boolean;
  pluginCount: number;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  touchSupport: boolean;
  canvasHash: string;
  webglRenderer: string;
  hasChrome: boolean;
}

interface Challenge {
  challengeId: string;
  prefix: string;
  difficulty: number;
  issuedAt: number;
}

export interface AntibotPayload {
  challengeId: string;
  nonce: number;
  fingerprint: string;
  signals: BrowserSignals;
  honeypot: Record<string, string>;
  solvedAt: number;
}

// ── Main entry point ──────────────────────────────────────────────

export async function prepareAntibotPayload(
  apiBase: string,
  linkId: string,
  honeypotValues: Record<string, string>
): Promise<AntibotPayload> {
  const challenge = await fetchChallenge(apiBase, linkId);

  // Run PoW and signal collection in parallel
  const [nonce, signals] = await Promise.all([
    solveProofOfWork(challenge.prefix, challenge.difficulty),
    collectBrowserSignals(),
  ]);

  const fingerprint = await hashFingerprint(signals);

  return {
    challengeId: challenge.challengeId,
    nonce,
    fingerprint,
    signals,
    honeypot: honeypotValues,
    solvedAt: Date.now(),
  };
}

// ── Challenge fetcher ─────────────────────────────────────────────

async function fetchChallenge(apiBase: string, linkId: string): Promise<Challenge> {
  const res = await fetch(`${apiBase}/antibot/challenge/${linkId}`);
  if (!res.ok) throw new Error("Failed to get security challenge");
  return res.json();
}

// ── Proof of Work solver ──────────────────────────────────────────

async function solveProofOfWork(prefix: string, difficulty: number): Promise<number> {
  // Bypass mode: difficulty 0 means no work needed
  if (difficulty === 0) return 0;

  const encoder = new TextEncoder();
  let nonce = 0;

  while (true) {
    const data = encoder.encode(prefix + String(nonce));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);

    if (hasLeadingZeroBits(hashArray, difficulty)) {
      return nonce;
    }
    nonce++;

    // Yield to main thread every 1000 iterations to avoid UI freeze
    if (nonce % 1000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

function hasLeadingZeroBits(buffer: Uint8Array, count: number): boolean {
  let bitsChecked = 0;
  for (let i = 0; i < buffer.length && bitsChecked < count; i++) {
    for (let bit = 7; bit >= 0 && bitsChecked < count; bit--) {
      if ((buffer[i] >> bit) & 1) return false;
      bitsChecked++;
    }
  }
  return true;
}

// ── Browser signal collection ─────────────────────────────────────

async function collectBrowserSignals(): Promise<BrowserSignals> {
  return {
    webdriver: !!navigator.webdriver,
    pluginCount: navigator.plugins?.length ?? 0,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory ?? null,
    touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    canvasHash: getCanvasFingerprint(),
    webglRenderer: getWebGLRenderer(),
    hasChrome: !!(window as any).chrome,
  };
}

// ── Canvas fingerprint ────────────────────────────────────────────

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("antibot:fp", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("antibot:fp", 4, 17);

    return simpleHash(canvas.toDataURL());
  } catch {
    return "canvas-error";
  }
}

// ── WebGL renderer ────────────────────────────────────────────────

function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";
    const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "no-debug-info";
    return (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) || "unknown";
  } catch {
    return "webgl-error";
  }
}

// ── Fingerprint hashing ──────────────────────────────────────────

async function hashFingerprint(signals: BrowserSignals): Promise<string> {
  const raw = [
    signals.canvasHash,
    signals.webglRenderer,
    signals.screenWidth,
    signals.screenHeight,
    signals.timezone,
    signals.pluginCount,
    signals.language,
    signals.platform,
    signals.colorDepth,
    signals.touchSupport,
    signals.deviceMemory,
    signals.hardwareConcurrency,
  ].join("|");

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
