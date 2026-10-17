// Separate analytics Worker. Does not replace or modify the Telegram bot Worker.
// Cloudflare D1 binding: DB. Secrets: ADMIN_TOKEN and BOT_INGEST_TOKEN.
const SITE_ORIGINS = new Set(["https://numerologia-online.github.io"]);
const PUBLIC_EVENTS = new Set([
  "page_view", "redflag_open", "redflag_category_open", "redflag_question_open",
  "redflag_share_click", "redflag_save_click", "pdf_download", "telegram_link_click"
]);
const SERVER_EVENTS = new Set(["bot_start", "bot_button", "bot_active", "payment_success"]);
const MAX_BODY_BYTES = 2048;

function cors(origin) {
  return SITE_ORIGINS.has(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  } : {};
}
function response(obj, status = 200, origin = "") {
  return new Response(JSON.stringify(obj), {
    status, headers: {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...cors(origin)}
  });
}
function clean(value, max = 80) {
  return typeof value === "string" && new RegExp("^[a-zA-Z0-9_.:/-]{1,80}$").test(value) ? value.slice(0,max) : "";
}
function title(value) {
  // Only public predefined question/category labels, not visitor answers.
  return typeof value === "string" ? value.replace(/[<>\u0000-\u001F]/g,"").slice(0,120) : "";
}
function isAuthorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const auth = request.headers.get("Authorization") || "";
  // ADMIN_TOKEN and BOT_INGEST_TOKEN must be long random, server-only secrets.
  // The token is a long high-entropy secret, never embedded in site assets.
  return auth.startsWith("Bearer ") && auth.slice(7) === secret;
}
async function readSmallJson(request) {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) throw new Error("TOO_LARGE");
  return JSON.parse(body);
}
async function insertEvent(env, data, type, paid = false) {
  const name = clean(data.event, 50);
  const isValid = paid ? SERVER_EVENTS.has(name) : PUBLIC_EVENTS.has(name);
  if (!isValid) return false;
  const item = clean(data.item || "", 80);
  const section = clean(data.section || "", 80);
  const label = title(data.label || "");
  const source = clean(data.source || "direct", 80);
  const session = clean(data.session || "", 80);
  const eventId = paid ? clean(data.event_id || "", 80) : "";
  const amount = paid && name === "payment_success" && Number.isSafeInteger(data.amount_kopecks)
    && data.amount_kopecks >= 0 && data.amount_kopecks <= 100000000 ? data.amount_kopecks : 0;
  if (name === "payment_success" && (!eventId || !amount)) return false;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO analytics_events (event, item, label, section, source, session, amount_kopecks, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(name,item,label,section,source,session,amount,eventId || null).run();
  return true;
}
async function overview(env, days) {
  const period = days === 7 || days === 90 ? days : 30;
  const since = "-" + period + " days";
  const sql = {
    counts: "SELECT event, COUNT(*) AS total, COUNT(DISTINCT NULLIF(session,'')) AS sessions FROM analytics_events WHERE created_at >= datetime('now', ?) GROUP BY event ORDER BY total DESC",
    questions: "SELECT item, MAX(label) AS label, COUNT(*) AS opens, COUNT(DISTINCT NULLIF(session,'')) AS sessions FROM analytics_events WHERE created_at >= datetime('now', ?) AND event = 'redflag_question_open' AND item != '' GROUP BY item ORDER BY opens DESC LIMIT 30",
    categories: "SELECT item, MAX(label) AS label, COUNT(*) AS opens FROM analytics_events WHERE created_at >= datetime('now', ?) AND event = 'redflag_category_open' AND item != '' GROUP BY item ORDER BY opens DESC LIMIT 30",
    shares: "SELECT item, MAX(label) AS label, COUNT(*) AS total FROM analytics_events WHERE created_at >= datetime('now', ?) AND event = 'redflag_share_click' AND item != '' GROUP BY item ORDER BY total DESC LIMIT 30",
    sources: "SELECT source, COUNT(*) AS visits FROM analytics_events WHERE created_at >= datetime('now', ?) AND event = 'page_view' GROUP BY source ORDER BY visits DESC LIMIT 15",
    sections: "SELECT section, COUNT(*) AS visits FROM analytics_events WHERE created_at >= datetime('now', ?) AND event = 'page_view' GROUP BY section ORDER BY visits DESC LIMIT 15",
    trend: "SELECT substr(created_at,1,10) AS date, SUM(CASE WHEN event='page_view' THEN 1 ELSE 0 END) AS visits, SUM(CASE WHEN event='redflag_question_open' THEN 1 ELSE 0 END) AS questions FROM analytics_events WHERE created_at >= datetime('now', ?) GROUP BY substr(created_at,1,10) ORDER BY date",
    payments: "SELECT COUNT(*) AS orders, COALESCE(SUM(amount_kopecks),0) AS revenue_kopecks FROM analytics_events WHERE created_at >= datetime('now', ?) AND event='payment_success'"
  };
  const out = {};
  for (const [key,query] of Object.entries(sql)) {
    const result = await env.DB.prepare(query).bind(since).all();
    out[key] = key === "payments" ? (result.results[0] || {orders:0,revenue_kopecks:0}) : result.results;
  }
  return {period, collected_at:new Date().toISOString(), ...out};
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {status:204,headers:cors(origin)});
    }
    if (!env.DB) return response({error:"DATABASE_NOT_CONFIGURED"},503,origin);
    try {
      if (request.method === "POST" && url.pathname === "/api/event") {
        if (!SITE_ORIGINS.has(origin)) return response({error:"FORBIDDEN_ORIGIN"},403,origin);
        const data = await readSmallJson(request);
        const ok = await insertEvent(env, data, false);
        return response(ok ? {ok:true} : {error:"INVALID_EVENT"}, ok ? 202 : 400, origin);
      }
      if (request.method === "POST" && url.pathname === "/api/server-event") {
        if (!isAuthorized(request, env.BOT_INGEST_TOKEN)) return response({error:"UNAUTHORIZED"},401);
        const data = await readSmallJson(request);
        const ok = await insertEvent(env, data, true);
        return response(ok ? {ok:true} : {error:"INVALID_EVENT"}, ok ? 202 : 400);
      }
      if (request.method === "GET" && url.pathname === "/api/overview") {
        if (!isAuthorized(request, env.ADMIN_TOKEN)) return response({error:"UNAUTHORIZED"},401,origin);
        if (origin && !SITE_ORIGINS.has(origin)) return response({error:"FORBIDDEN_ORIGIN"},403,origin);
        return response(await overview(env, Number(url.searchParams.get("days"))),200,origin);
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return response({ok:true,service:"owner-analytics"});
      }
      return response({error:"NOT_FOUND"},404,origin);
    } catch (error) {
      const badInput = error instanceof SyntaxError || error.message === "TOO_LARGE";
      return response({error:badInput ? "BAD_REQUEST" : "INTERNAL_ERROR"},badInput ? 400 : 500,origin);
    }
  },
  async scheduled(_event, env) {
    // Keep 13 months only; no individual birthdates, IPs or message texts are stored.
    await env.DB.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now','-13 months')").run();
  }
};
