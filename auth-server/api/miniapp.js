"use strict";
// Telegram Mini App authentication using Telegram's public Ed25519 signature.
// No bot token and no other secret is stored in the frontend or this backend.
const crypto = require("node:crypto");
const BOT_ID = "8814989076";
const ALLOWED_ORIGIN = "https://numerologia-online.github.io";
const TELEGRAM_PUB_HEX = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
const DER_ED25519_PREFIX = "302a300506032b6570032100";
const publicKey = crypto.createPublicKey({
  key: Buffer.concat([Buffer.from(DER_ED25519_PREFIX, "hex"), Buffer.from(TELEGRAM_PUB_HEX, "hex")]),
  format: "der", type: "spki"
});

function reply(res, code, body) {
  res.status(code).json(body);
}

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return reply(res, 405, { ok: false, error: "METHOD" });
  if (req.headers.origin !== ALLOWED_ORIGIN) return reply(res, 403, { ok: false, error: "ORIGIN" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const data = body && body.init_data;
    if (typeof data !== "string" || data.length === 0 || data.length > 16000) {
      return reply(res, 400, { ok: false, error: "DATA_FORMAT" });
    }

    const params = new URLSearchParams(data);
    // Duplicate fields make signature and application semantics ambiguous.
    if ([...params.keys()].length !== new Set(params.keys()).size) {
      return reply(res, 401, { ok: false, error: "DUPLICATES" });
    }
    const signature = params.get("signature");
    const issued = Number(params.get("auth_date"));
    const now = Math.floor(Date.now() / 1000);
    if (!signature || !/^[A-Za-z0-9_-]{86}$/.test(signature)) {
      return reply(res, 401, { ok: false, error: "SIGNATURE_MISSING" });
    }
    if (!Number.isInteger(issued) || issued > now + 60 || now - issued > 86400) {
      return reply(res, 401, { ok: false, error: "EXPIRED" });
    }

    const fields = [...params.entries()]
      .filter(([key]) => key !== "signature" && key !== "hash")
      .sort(([one], [two]) => one < two ? -1 : one > two ? 1 : 0)
      .map(([key, value]) => key + "=" + value);
    const signed = BOT_ID + ":WebAppData\n" + fields.join("\n");
    const valid = crypto.verify(null, Buffer.from(signed, "utf8"), publicKey, Buffer.from(signature, "base64url"));
    if (!valid) return reply(res, 401, { ok: false, error: "SIGNATURE_INVALID" });

    const raw = params.get("user");
    if (!raw) return reply(res, 401, { ok: false, error: "USER_MISSING" });
    const account = JSON.parse(raw);
    if (!Number.isSafeInteger(account.id) || account.id <= 0) {
      return reply(res, 401, { ok: false, error: "USER_INVALID" });
    }
    const name = [account.first_name, account.last_name]
      .filter(value => typeof value === "string" && value.length > 0).join(" ")
      || (typeof account.username === "string" && account.username)
      || "Пользователь";
    // Note: no paid permissions or purchases are granted by this endpoint.
    return reply(res, 200, {
      ok: true,
      user: { id: String(account.id), name: String(name).slice(0, 80) }
    });
  } catch (_) {
    return reply(res, 401, { ok: false, error: "DATA_INVALID" });
  }
};
