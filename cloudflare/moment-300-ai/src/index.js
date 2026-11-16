/* Separate AI-only Worker for the owner preview of the 300-question Moment catalog.
   Does not interact with Telegram, wallet, purchases, other report products or user accounts.
   Requests may arrive ONLY from a server with the private MOMENT_BRIDGE_SECRET.
*/
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_BODY_BYTES = 5000;
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, private, max-age=0",
  "X-Content-Type-Options": "nosniff"
};
function reply(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: HEADERS });
}
function validIsoDate(value) {
  if (typeof value !== "string" || !/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
}
function validMoment(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || !/^(19|20)\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return validIsoDate(value.slice(0, 10));
}
function numerology(dayDate) {
  const [, m, d] = dayDate.split("-").map(Number);
  let day = d;
  while (day > 22) day = String(day).split("").reduce((sum, x) => sum + Number(x), 0);
  return "день " + day + ", месяц " + m;
}
const SYSTEM = [
  "Ты составляешь ТОЛЬКО тестовый ответ для одного выбранного вопроса раздела «300 вопросов о жизни» нумерологического сайта.",
  "Нумерология является символическим языком, а не доказанным способом узнать мысли, чувства и будущее другого человека.",
  "Отвечай строго на конкретный вопрос. Не повторяй целый портрет характера и не копируй штампы.",
  "Учитывай светлые, теневые и противоречивые проявления дня и месяца, но не перечисляй формулы или названия энергий.",
  "Пиши как опытный нумеролог и подруга: конкретно, без неуместной лести, без обвинений, без длинных тире.",
  "Два абзаца: 1) разбор вопроса, 2) наблюдаемые признаки и практическая рекомендация.",
  "Не выдавай интерпретацию за знание фактов, особенно о чужих чувствах. Не обещай медицинских или финансовых результатов.",
  "Ответ на русском, ориентир 110–180 слов. Без вступления и без заключительной рекламы."
].join(" ");
export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (request.method === "GET" && pathname === "/health")
      return reply(200, { ok: true, service: "numi-moment-300-owner-preview", ai_bound: !!env.AI, live_answers_enabled: false });
    // One-off authenticated self-test: the caller must be able to read THIS Worker
    // through the Cloudflare API. No public/free-form AI prompt is accepted here.
    if (pathname === "/_internal/ai-smoke-check" && request.method === "POST") {
      const bearer = request.headers.get("Authorization") || "";
      if (!/^Bearer [A-Za-z0-9_-]{30,150}$/.test(bearer))
        return reply(403, { ok: false, error: "ADMIN_AUTH_REQUIRED" });
      try {
        const verification = await fetch(
          "https://api.cloudflare.com/client/v4/accounts/de77758c4b3efd26fef26ab600cb02a2/workers/scripts/numerologia-300-ai",
          { headers: { Authorization: bearer }, redirect: "manual" }
        );
        if (verification.status !== 200)
          return reply(403, { ok: false, error: "ADMIN_ACCOUNT_ACCESS_REQUIRED" });
        if (!env.AI) return reply(503, { ok: false, error: "AI_BINDING_MISSING" });
        const result = await env.AI.run(MODEL, {
          messages: [{ role: "user", content: "Ответь по-русски одним предложением: что такое любовь?" }],
          max_completion_tokens: 140,
          chat_template_kwargs: { enable_thinking: false }
        });
        const value = result?.response ?? result?.choices?.[0]?.message?.content;
        const length = typeof value === "string" ? value.length : 0;
        if (length < 20) return reply(503, { ok: false, error: "MODEL_OUTPUT_EMPTY", keys: Object.keys(result || {}).slice(0, 8) });
        return reply(200, { ok: true, model: MODEL, text_length: length, test_only: true });
      } catch (err) {
        return reply(503, { ok: false, error: "MODEL_CALL_FAILED", type: String(err?.name || "unknown") });
      }
    }
    if (pathname !== "/v1/owner-preview" || request.method !== "POST")
      return reply(404, { ok: false, error: "NOT_FOUND" });
    if (!env.MOMENT_BRIDGE_SECRET || !env.AI)
      return reply(503, { ok: false, error: "WORKER_NOT_CONFIGURED" });
    const provided = request.headers.get("X-Numi-Moment-Secret");
    if (!provided || provided !== env.MOMENT_BRIDGE_SECRET)
      return reply(403, { ok: false, error: "FORBIDDEN" });
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json"))
      return reply(415, { ok: false, error: "JSON_REQUIRED" });
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: "TOO_LARGE" });
    let body;
    try { body = JSON.parse(bodyText); } catch { return reply(400, { ok: false, error: "INVALID_JSON" }); }
    if (!body || typeof body !== "object" ||
        typeof body.question_id !== "string" || !/^[a-z]+-\d{3}$/.test(body.question_id) ||
        typeof body.title !== "string" || body.title.length < 5 || body.title.length > 180 ||
        !validIsoDate(body.birth_date) ||
        (body.other_date !== null && body.other_date !== undefined && !validIsoDate(body.other_date)) ||
        !validMoment(body.moment))
      return reply(400, { ok: false, error: "INVALID_INPUT" });
    const lines = [
      "ID: " + body.question_id,
      "Вопрос: " + body.title,
      "Спрашивающий: " + body.birth_date + " (" + numerology(body.birth_date) + ")"
    ];
    if (body.other_date) lines.push("Другой человек: " + body.other_date + " (" + numerology(body.other_date) + ")");
    if (body.moment) lines.push("Момент вопроса (локальное время): " + body.moment);
    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: lines.join("\n") }
        ],
        max_tokens: 650,
        temperature: 0.55
      });
      const answer = result?.response ?? result?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || answer.trim().length < 70 || answer.length > 7000)
        return reply(503, { ok: false, error: "MODEL_OUTPUT_NOT_READY" });
      return reply(200, {
        ok: true, test: true, question_id: body.question_id,
        answer: answer.trim(), model: MODEL
      });
    } catch (error) {
      console.error("MOMENT_AI_ERROR", error?.name || "unknown");
      return reply(503, { ok: false, error: "MODEL_UNAVAILABLE" });
    }
  }
};
