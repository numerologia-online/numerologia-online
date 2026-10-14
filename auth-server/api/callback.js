"use strict";
const { AUTH_CLIENT_ID, PROVIDER, FLOW_COOKIE, getConfig, signed, unpack, parseCookies, safeEqual, noStore, errorPage, verifyTelegramToken } = require("../lib/auth");
module.exports = async (req, res) => {
  noStore(res);
  res.setHeader("Set-Cookie", FLOW_COOKIE + "=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  if (req.method !== "GET") return res.status(405).end();
  try {
    const config = getConfig();
    const flow = unpack(parseCookies(req)[FLOW_COOKIE], config.signing);
    if (!req.query?.code || !req.query?.state || !safeEqual(req.query.state, flow.state)) {
      throw new Error("Login state is missing or invalid");
    }
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: AUTH_CLIENT_ID,
      code: String(req.query.code),
      redirect_uri: config.base + "/api/callback",
      code_verifier: flow.verifier
    });
    const credentials = Buffer.from(AUTH_CLIENT_ID + ":" + config.secret).toString("base64");
    const response = await fetch(PROVIDER + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + credentials },
      body: form.toString(),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error("Telegram authorization exchange failed");
    const tokens = await response.json();
    const user = await verifyTelegramToken(tokens.id_token, flow.oidcNonce);
    const issued = Math.floor(Date.now() / 1000);
    const ticket = signed({ id: user.id, name: user.name, iat: issued, exp: issued + 3600 }, config.signing);
    const site = new URL(config.site);
    site.hash = "tg_session=" + encodeURIComponent(ticket);
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Location", site.toString());
    return res.status(303).end();
  } catch (_) {
    return errorPage(res, "Подтверждение не удалось завершить. Вернитесь на сайт и попробуйте ещё раз.");
  }
};
