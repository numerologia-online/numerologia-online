"use strict";
const crypto = require("node:crypto");
const AUTH_CLIENT_ID = "8814989076";
const PROVIDER = "https://oauth.telegram.org";
const FLOW_COOKIE = "numerologia_tg_flow";
const getConfig = () => {
  const secret = process.env.TG_CLIENT_SECRET;
  const signing = process.env.TG_SESSION_SECRET;
  const base = process.env.AUTH_BASE_URL;
  const site = process.env.SITE_RETURN_URL || "https://numerologia-online.github.io/numerologia-online/";
  if (!secret || !signing || !base || signing.length < 32) {
    throw new Error("Telegram auth environment is not configured");
  }
  const serverUrl = new URL(base);
  const siteUrl = new URL(site);
  if (serverUrl.protocol !== "https:" || siteUrl.protocol !== "https:") throw new Error("HTTPS is required");
  return { secret, signing, base: serverUrl.origin, site: siteUrl.href, siteOrigin: siteUrl.origin };
};
const nonce = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
const safeEqual = (one, two) => {
  const a = Buffer.from(String(one)), b = Buffer.from(String(two));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const signed = (payload, secret) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + signature;
};
const unpack = (packed, secret) => {
  const [body, signature, extra] = String(packed || "").split(".");
  if (!body || !signature || extra) throw new Error("Invalid login state");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(signature, expected)) throw new Error("Invalid login state signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now() / 1000) throw new Error("Login state expired");
  return payload;
};
const parseCookies = req => Object.fromEntries(
  String(req.headers.cookie || "").split(";").map(v => v.trim()).filter(v => v.includes("="))
    .map(v => {const i = v.indexOf("="); return [v.slice(0, i), v.slice(i + 1)];})
);
const noStore = res => res.setHeader("Cache-Control", "no-store, private");
const errorPage = (res, message) => {
  noStore(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(400).end('<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Не удалось войти</title><body style="font:16px system-ui;padding:30px;max-width:450px;margin:auto"><h1>Не удалось войти через Telegram</h1><p>' + message + '</p><a href="https://numerologia-online.github.io/numerologia-online/">Вернуться на сайт</a></body></html>');
};
let jwksCache = { data: null, expires: 0 };
const verifyTelegramToken = async (token, wantedNonce) => {
  const [head, body, signature, extra] = String(token || "").split(".");
  if (!head || !body || !signature || extra) throw new Error("Invalid ID token");
  const header = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported signature algorithm");
  if (jwksCache.expires < Date.now()) {
    const response = await fetch(PROVIDER + "/.well-known/jwks.json", { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Cannot load Telegram public keys");
    jwksCache = { data: await response.json(), expires: Date.now() + 10 * 60 * 1000 };
  }
  const jwk = (jwksCache.data.keys || []).find(k => k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256"));
  if (!jwk) throw new Error("Telegram signing key not found");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(head + "." + body),
    crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url"));
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!ok || payload.iss !== PROVIDER || !audience.map(String).includes(AUTH_CLIENT_ID)
    || !payload.sub || !Number.isSafeInteger(payload.id) || payload.id <= 0
    || !Number.isFinite(payload.iat) || payload.iat > now + 60
    || !Number.isFinite(payload.exp) || payload.exp <= now || payload.nonce !== wantedNonce) {
    throw new Error("Telegram ID token verification failed");
  }
  return { id: String(payload.id), name: String(payload.name || payload.given_name || "Пользователь").slice(0, 80) };
};
module.exports = { AUTH_CLIENT_ID, PROVIDER, FLOW_COOKIE, getConfig, nonce, signed, unpack, parseCookies, safeEqual, noStore, errorPage, verifyTelegramToken };
