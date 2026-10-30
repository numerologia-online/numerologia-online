// Secure Red Flag delivery. Never expose GITHUB_PRIVATE_TOKEN to a browser.
// Deployment refresh: activate protected Production credentials.
// Until a payment ledger is connected, only the verified Telegram owner may read answers.
import crypto from "node:crypto";

const ALLOWED_ORIGINS = new Set(["https://numerologia-online.github.io", "https://нумерология.online", "https://xn--c1adkkdfjbp1a4l.online"]);
const REPO = "numerologia-online/numi-numi-on-private";
const ALLOWED = /^data\/redflag\/(?:banks\/[a-z0-9-]+\.json|love\/published\/[0-9]{1,2}-[0-9]{1,2}\.json|[a-z0-9-]+\/[a-z0-9-]+\.json)$/;

function authenticatedTelegramUser(initData, botToken) {
  if (!initData || initData.length > 8192 || !botToken) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  const authDate = Number(p.get("auth_date"));
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(authDate)) return null;
  if (Math.abs(Date.now() / 1000 - authDate) > 3600) return null;
  const data = [...p.entries()].filter(([key]) => key !== "hash")
    .map(([key, value]) => key + "=" + value).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(data).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;
  try {
    const user = JSON.parse(p.get("user") || "{}");
    return String(user.id || "");
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  const token = process.env.GITHUB_PRIVATE_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.SITE_OWNER_TELEGRAM_ID;
  if (!token || !botToken || !ownerId) return res.status(503).json({ ok: false, error: "SERVER_NOT_CONFIGURED" });
  const userId = authenticatedTelegramUser(req.body?.init_data, botToken);
  if (!userId) return res.status(401).json({ ok: false, error: "TELEGRAM_AUTH_REQUIRED" });
  if (userId !== ownerId) return res.status(403).json({ ok: false, error: "PURCHASE_REQUIRED" });
  const path = String(req.body?.path || "").split("?")[0].replace(/^\.\//, "");
  if (!ALLOWED.test(path) || path.includes("..")) return res.status(400).json({ ok: false, error: "INVALID_PATH" });
  try {
    const response = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + path, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return res.status(502).json({ ok: false, error: "PRIVATE_CONTENT_UNAVAILABLE" });
    const body = await response.text();
    if (body.length > 5_000_000) return res.status(502).json({ ok: false, error: "CONTENT_TOO_LARGE" });
    return res.status(200).json(JSON.parse(body));
  } catch {
    return res.status(502).json({ ok: false, error: "PRIVATE_CONTENT_ERROR" });
  }
}
