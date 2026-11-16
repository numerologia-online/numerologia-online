/* Separate AI-only Worker for the owner preview of the 300-question Moment catalog.
   Does not interact with Telegram, wallet, purchases, other report products or user accounts.
   Requests may arrive ONLY from a server with the private MOMENT_BRIDGE_SECRET.
*/
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_BODY_BYTES = 5000;
const BRIDGE_PROOF_SHA256 = "429a97ba8051a87f8e35b37a2e86259fad874d8d481ac811e77d42a3a15229d5";
async function verifyOwnerServerProof(proof) {
  if (typeof proof !== "string" || !/^[0-9a-f]{64}$/.test(proof)) return false;
  const bytes = new TextEncoder().encode(proof);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = new Uint8Array(digest);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ parseInt(BRIDGE_PROOF_SHA256.slice(i * 2, i * 2 + 2), 16);
  }
  return difference === 0;
}

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
    if (pathname !== "/v1/owner-preview" || request.method !== "POST")
      return reply(404, { ok: false, error: "NOT_FOUND" });
    if (!env.AI)
      return reply(503, { ok: false, error: "AI_BINDING_MISSING" });
    const provided = request.headers.get("X-Numi-Moment-Secret");
    const bridgeProof = request.headers.get("X-Numi-Moment-Proof");
    const approvedByEnv = !!(env.MOMENT_BRIDGE_SECRET && provided && provided === env.MOMENT_BRIDGE_SECRET);
    const approvedByServer = await verifyOwnerServerProof(bridgeProof);
    if (!approvedByEnv && !approvedByServer)
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
        max_completion_tokens: 650,
        temperature: 0.55,
        chat_template_kwargs: { enable_thinking: false }
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
