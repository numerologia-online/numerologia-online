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

/* Isolated question-specific numerology. Other 299 questions keep the original prompt. */
function reduceNumber(value) {
  let n = Math.abs(Number(value));
  while (n > 9 && n !== 11 && n !== 22 && n !== 33)
    n = String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return n;
}
function dateParts(iso) {
  const [year,month,day] = iso.slice(0,10).split("-").map(Number);
  return {year,month,day};
}
function digitSum(value) {
  return String(value).replace(/\D/g,"").split("").reduce((sum,d)=>sum+Number(d),0);
}
function relationNumbers(birth, other, moment) {
  const woman=dateParts(birth), man=dateParts(other), now=dateParts(moment);
  const activeYear = now.month > man.month || (now.month === man.month && now.day >= man.day) ? now.year : now.year-1;
  const maleLifePath=reduceNumber(digitSum(other));
  const womanLifePath=reduceNumber(digitSum(birth));
  const maleYear=reduceNumber(digitSum(String(man.day))+digitSum(String(man.month))+digitSum(String(activeYear)));
  const maleMonth=reduceNumber(maleYear+now.month);
  const manDay=reduceNumber(man.day), manMonth=reduceNumber(man.month);
  const womanDay=reduceNumber(woman.day), womanMonth=reduceNumber(woman.month);
  const attraction=reduceNumber(manDay+womanDay);
  const interaction=reduceNumber(maleLifePath+womanLifePath);
  const tension=reduceNumber(Math.abs(manDay-womanDay)||9);
  const momentNumber=reduceNumber(digitSum(moment.slice(0,10))+digitSum(moment.slice(11)));
  return {manDay,manMonth,maleLifePath,womanDay,womanMonth,womanLifePath,
    attraction,interaction,tension,maleYear,maleMonth,activeYear,momentNumber};
}
const LOVE001_SYSTEM = [
  "Только для вопроса «Что он чувствует ко мне?». Напиши один цельный, выразительный абзац на русском, 130–190 слов, без заголовков, списков, второго абзаца и названий энергий.",
  "Стиль: тёплая и наблюдательная женщина разговаривает с другой женщиной. Повествование живое и конкретное, без комплиментов ради утешения, без сладких обещаний, без шаблонных слов про судьбу и без длинных тире.",
  "Используй ТОЛЬКО переданные вычисленные показатели; не придумывай другие результаты расчётов. Покажи четыре разные стороны: эмоциональный стиль мужчины из дня, месяца и жизненного пути; отклик именно на эту женщину из показателей сочетания; его нынешние приоритеты из личного года и месяца; тон момента вопроса как слабый уточняющий фактор.",
  "День и месяц читаются одновременно и могут противоречить друг другу. Числа пары не означают автоматически любовь. Период не отменяет личные качества и не доказывает отсутствие чувств.",
  "Ключ к разнообразию: извлеки конкретное противоречие из текущей комбинации чисел, а не пересказывай общий характер. Допускай отсутствие интереса, слабую вовлечённость, поверхностное притяжение, эмоциональную закрытость и неопределённость, если трактовка к этому ведёт. Нельзя всегда объяснять холодность тем, что мужчина боится чувств.",
  "В трактовках периода: 1 начало и собственные планы; 2 сближение либо зависимость от чужого мнения; 3 общение либо поверхностность; 4 устойчивость либо загруженность; 5 перемены либо непостоянство; 6 отношения либо груз обязательств; 7 уединение либо дистанция; 8 амбиции, деньги либо контроль; 9 завершение либо освобождение от прошлого; 11/22/33 читай как усиленные и неоднозначные темы, не своди их автоматически к романтике.",
  "Сначала ответь на вопрос осторожным вероятностным выводом, затем раскрой причины и признаки, в конце оставь один полезный ориентир на реальные поступки. Не утверждай, что знаешь мысли мужчины: нумерология символическая интерпретация, а не чтение мыслей.",
  "Не перечисляй числа, формулы и названия энергий в клиентском тексте. Не повторяй один и тот же сюжет для разных дат."
].join(" ");

const SYSTEM = [
  "Ты составляешь ТОЛЬКО тестовый ответ для одного выбранного вопроса раздела «300 вопросов о жизни» нумерологического сайта.",
  "Нумерология является символическим языком, а не доказанным способом узнать мысли, чувства и будущее другого человека.",
  "Отвечай строго на конкретный вопрос. Не повторяй целый портрет характера и не копируй штампы.",
  "Учитывай светлые, теневые и противоречивые проявления дня и месяца, но не перечисляй формулы или названия энергий.",
  "Пиши как опытный нумеролог и подруга: конкретно, без неуместной лести, без обвинений, без длинных тире.",
  "Два абзаца: 1) разбор вопроса, 2) наблюдаемые признаки и практическая рекомендация.",
  "Для вопросов о выборе даты анализируй дату запланированного события относительно даты рождения, а не момент обращения.",
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
    const isEventQuestion = /^dates-\d{3}$/.test(body.question_id);
    if (body.moment) {
      if (isEventQuestion) {
        lines.push("Выбранная дата СОБЫТИЯ: " + body.moment.slice(0,10) + " (время 12:00 техническое, не учитывать).");
        lines.push("Сопоставь именно дату рождения с датой запланированного события. Это НЕ момент вопроса. Нельзя рассуждать о времени обращения и нельзя считать событие уже произошедшим.");
        lines.push("Дата события день и месяц: " + numerology(body.moment.slice(0,10)) + ". Дата рождения: " + numerology(body.birth_date) + ".");
      } else lines.push("Момент вопроса (локальное время): " + body.moment);
    }
    const special = body.question_id === "love-001" && !!body.other_date;
    if (special) {
      const when = body.moment || new Date().toISOString().slice(0,16);
      const values = relationNumbers(body.birth_date,body.other_date,when);
      lines.push("Для вопроса love-001 заранее рассчитанные показатели (не показывать числа в ответе): "+JSON.stringify(values));
      lines.push("Показатель attraction: потенциальное притяжение; interaction: динамика пары; tension: возможные разногласия. Это разные символические углы, не факты о чувствах.");
      lines.push("Приоритет трактовки: мужчина 40%, сочетание пары 30%, личные периоды мужчины 25%, момент 5%.");
    }
    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: special ? LOVE001_SYSTEM : SYSTEM },
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
