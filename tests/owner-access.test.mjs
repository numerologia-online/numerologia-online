import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { signed } = require("../auth-server/lib/auth.js");
const session = require("../auth-server/api/session.js");

function checkSession(token, ownerId) {
  process.env.TG_CLIENT_SECRET = "test-only-not-a-real-secret";
  process.env.TG_SESSION_SECRET = "tests-use-separate-server-only-signature-secret-1234";
  process.env.AUTH_BASE_URL = "https://example.vercel.app";
  process.env.SITE_RETURN_URL = "https://numerologia-online.github.io/numerologia-online/";
  if (ownerId === null) delete process.env.SITE_OWNER_TELEGRAM_ID;
  else process.env.SITE_OWNER_TELEGRAM_ID = ownerId;
  const output = { statusCode: 200, headers: {}, body: null };
  const res = {
    setHeader(key, value) { output.headers[key] = value; return this; },
    status(code) { output.statusCode = code; return this; },
    json(body) { output.body = body; return this; },
    end() { return this; }
  };
  session({method: "GET", headers: {origin:"https://numerologia-online.github.io", authorization:"Bearer " + token}}, res);
  return output;
}
const secret = "tests-use-separate-server-only-signature-secret-1234";
const valid = (id) => signed({id, name: "Test user", exp: Math.floor(Date.now() / 1000) + 120}, secret);

test("Verified owner's signed browser session is recognized", () => {
  const result = checkSession(valid("123456789"), "123456789");
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.owner, true);
});
test("Another signed-in visitor never receives owner status", () => {
  const result = checkSession(valid("999999999"), "123456789");
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.owner, false);
});
test("Missing owner configuration fails closed", () => {
  const result = checkSession(valid("123456789"), null);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.owner, false);
});
test("A forged browser ticket cannot impersonate the owner", () => {
  const result = checkSession("not-a-signed-ticket", "123456789");
  assert.equal(result.statusCode, 401);
});
test("Public URL and school mode cannot unlock the full report", () => {
  const code = fs.readFileSync(new URL("../pro/pro.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../pro/index.html", import.meta.url), "utf8");
  assert.match(code, /const hasPaidAccess = \(\) => verifiedOwner && !ownerSeeFree;/);
  assert.doesNotMatch(code, /const paywallPreviewMode =/);
  assert.doesNotMatch(code, /schoolClientMode \|\| \(paywallPreviewMode/);
  assert.doesNotMatch(html, /id="pro-paywall-preview"/);
});
