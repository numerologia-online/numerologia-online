"use strict";
// Verifies Telegram's OIDC ID token without a bot token or client secret.
// This is a read-only test-login endpoint; no paid access or persisted accounts.
const crypto = require("node:crypto");
const CLIENT_ID = "8814989076";
const ORIGIN = "https://numerologia-online.github.io";
const ISSUER = "https://oauth.telegram.org";
let cached = null;
let expires = 0;

const send = (res, status, value) => res.status(status).json(value);
const fail = (res, code) => send(res, 401, { ok: false, error: code });
const decoded = (segment) => JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

module.exports = async function verifyLogin(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "METHOD" });
  if (req.headers.origin !== ORIGIN) return send(res, 403, { error: "ORIGIN" });

  try {
    const { id_token: token, nonce } = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    if (typeof token !== "string" || token.length > 12000 || typeof nonce !== "string" || nonce.length < 24 || nonce.length > 256) {
      return fail(res, "TOKEN_FORMAT");
    }
    const pieces = token.split(".");
    if (pieces.length !== 3) return fail(res, "TOKEN_PARTS");
    const [a, b, c] = pieces;
    const h = decoded(a);
    const p = decoded(b);
    if (h.alg !== "RS256" || typeof h.kid !== "string") return fail(res, "ALGORITHM");

    if (!cached || Date.now() >= expires) {
      const k = await fetch(ISSUER + "/.well-known/jwks.json", { signal: AbortSignal.timeout(8000) });
      if (!k.ok) return fail(res, "TELEGRAM_KEYS");
      cached = await k.json();
      expires = Date.now() + 300000;
    }
    let jwk = (cached.keys || []).find(x => x.kid === h.kid && x.kty === "RSA" && (!x.alg || x.alg === "RS256"));
    if (!jwk) {
      expires = 0;
      return fail(res, "UNKNOWN_KEY");
    }
    const verified = crypto.verify("RSA-SHA256", Buffer.from(a + "." + b),
      crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(c, "base64url"));
    if (!verified) return fail(res, "SIGNATURE");

    const time = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
    if (p.iss !== ISSUER || !aud.map(String).includes(CLIENT_ID)) return fail(res, "ISSUER_AUDIENCE");
    if (!Number.isFinite(p.iat) || p.iat > time + 60 ||
        !Number.isFinite(p.exp) || p.exp <= time || p.exp - p.iat > 86400) return fail(res, "TOKEN_EXPIRED");
    if (typeof p.sub !== "string" || !p.sub) return fail(res, "SUBJECT");

    // Telegram library versions may omit nonce on the returned JWT.
    // When present, require exact matching. When omitted, only accept a
    // recently issued, cryptographically verified token in test-only mode.
    if (p.nonce !== undefined && p.nonce !== nonce) return fail(res, "NONCE_MISMATCH");
    if (p.nonce === undefined && time - p.iat > 120) return fail(res, "NONCE_UNAVAILABLE");

    const rawId = p.id == null ? p.sub : p.id;
    if (!/^[0-9]{1,22}$/.test(String(rawId))) return fail(res, "SUBJECT_ID");
    const name = String(p.name || p.given_name || p.preferred_username || "Пользователь").slice(0, 80);
    return send(res, 200, { ok: true, user: { id: String(rawId), name } });
  } catch (error) {
    if (error && /timeout|fetch|network/i.test(String(error))) return send(res, 503, { ok: false, error: "TELEGRAM_NETWORK" });
    return fail(res, "INVALID_TOKEN");
  }
};
