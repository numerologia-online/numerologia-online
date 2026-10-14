"use strict";
const { getConfig, unpack, noStore } = require("../lib/auth");
module.exports = (req, res) => {
  noStore(res);
  let allowed;
  try {
    allowed = getConfig().siteOrigin;
  } catch (_) {
    return res.status(503).json({ error: "Not configured" });
  }
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();
  try {
    const value = String(req.headers.authorization || "").match(/^Bearer ([A-Za-z0-9_.-]+)$/);
    if (!value) return res.status(401).json({ error: "Not signed in" });
    const payload = unpack(value[1], getConfig().signing);
    if (!payload.id || !payload.name) return res.status(401).json({ error: "Invalid session" });
    return res.status(200).json({ user: { id: payload.id, name: payload.name } });
  } catch (_) {
    return res.status(401).json({ error: "Session expired" });
  }
};
