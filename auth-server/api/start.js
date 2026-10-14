"use strict";
const crypto = require("node:crypto");
const { AUTH_CLIENT_ID, PROVIDER, FLOW_COOKIE, getConfig, nonce, signed, noStore, errorPage } = require("../lib/auth");
module.exports = async (req, res) => {
  noStore(res);
  if (req.method !== "GET") return res.status(405).end();
  try {
    const config = getConfig();
    const verifier = nonce(32), state = nonce(), oidcNonce = nonce();
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const flow = signed({ verifier, state, oidcNonce, exp: Math.floor(Date.now() / 1000) + 600 }, config.signing);
    res.setHeader("Set-Cookie", FLOW_COOKIE + "=" + flow + "; Path=/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax");
    const redirect = new URL(PROVIDER + "/auth");
    redirect.searchParams.set("client_id", AUTH_CLIENT_ID);
    redirect.searchParams.set("redirect_uri", config.base + "/api/callback");
    redirect.searchParams.set("response_type", "code");
    redirect.searchParams.set("scope", "openid profile");
    redirect.searchParams.set("state", state);
    redirect.searchParams.set("nonce", oidcNonce);
    redirect.searchParams.set("code_challenge", challenge);
    redirect.searchParams.set("code_challenge_method", "S256");
    res.setHeader("Location", redirect.href);
    return res.status(302).end();
  } catch (e) {
    return errorPage(res, "Сервис входа пока настраивается. Попробуйте позднее.");
  }
};
