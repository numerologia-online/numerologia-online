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
  // Personal YEARS turn over on each person's birthday, never on January 1.
  const yearCycle = person => {
    const activeYear = now.month > person.month ||
      (now.month === person.month && now.day >= person.day) ? now.year : now.year-1;
    return {
      activeYear,
      year:reduceNumber(digitSum(String(person.day))+digitSum(String(person.month))+digitSum(String(activeYear)))
    };
  };
  const maleCycle=yearCycle(man), femaleCycle=yearCycle(woman);
  // Personal MONTHS change with the calendar month, within that person's active year.
  // This is the same year + calendar-month method previously used for the man;
  // now it applies equally to the woman.
  const maleMonth=reduceNumber(maleCycle.year+now.month);
  const femaleMonth=reduceNumber(femaleCycle.year+now.month);
  const maleLifePath=reduceNumber(digitSum(other));
  const womanLifePath=reduceNumber(digitSum(birth));
  // Same day and month with a different year is a different full birth-date.
  // Preserve year-derived numerology and actual age instead of classifying
  // everyone born on (say) October 31 by day/month alone.
  const maleBirthYearCode=reduceNumber(digitSum(String(man.year)));
  const womanBirthYearCode=reduceNumber(digitSum(String(woman.year)));
  const yearsOld=person=>now.year-person.year-
    ((now.month<person.month||(now.month===person.month&&now.day<person.day))?1:0);
  const maleAge=yearsOld(man), womanAge=yearsOld(woman);
  const maleAgeCycle=reduceNumber(maleAge);
  const womanAgeCycle=reduceNumber(womanAge);
  const birthYearInteraction=reduceNumber(maleBirthYearCode+womanBirthYearCode);
  const manDay=reduceNumber(man.day), manMonth=reduceNumber(man.month);
  const womanDay=reduceNumber(woman.day), womanMonth=reduceNumber(woman.month);
  const attraction=reduceNumber(manDay+womanDay);
  const interaction=reduceNumber(maleLifePath+womanLifePath);
  const tension=reduceNumber(Math.abs(manDay-womanDay)||9);
  const momentNumber=reduceNumber(digitSum(moment.slice(0,10))+digitSum(moment.slice(11)));
  const cycleMonth=String(now.year)+"-"+String(now.month).padStart(2,"0");
  const pairMonth=reduceNumber(maleMonth+femaleMonth);
  return {manDay,manMonth,maleLifePath,maleBirthYearCode,maleAge,maleAgeCycle,
    womanDay,womanMonth,womanLifePath,womanBirthYearCode,womanAge,womanAgeCycle,
    birthYearInteraction,attraction,interaction,tension,maleYear:maleCycle.year,maleMonth,
    womanYear:femaleCycle.year,womanMonth:femaleMonth,pairMonth,cycleMonth,
    activeYear:maleCycle.activeYear,womanActiveYear:femaleCycle.activeYear,momentNumber};
}
const LOVE001_SYSTEM = [
  "Только для вопроса «Что он чувствует ко мне?». Напиши один цельный, выразительный абзац на русском, 130–190 слов, без заголовков, списков, второго абзаца и названий энергий.",
  "Стиль: тёплая и наблюдательная женщина разговаривает с другой женщиной. Повествование живое и конкретное, без комплиментов ради утешения, без сладких обещаний, без шаблонных слов про судьбу и без длинных тире.",
  "Используй ТОЛЬКО переданные вычисленные показатели, не придумывай другие результаты расчётов или события отношений. Эмоциональный стиль мужчины выводи из дня, месяца, ПОЛНОЙ даты рождения (maleLifePath и maleBirthYearCode) и возрастного этапа (maleAgeCycle); потенциальную динамику конкретной пары — из сочетания ПОЛНЫХ дат рождения (включая womanLifePath, womanBirthYearCode и birthYearInteraction). Ни один показатель сам по себе не доказывает любовь.",
  "ОБЯЗАТЕЛЬНО учитывай ОБА личных годовых цикла (maleYear и womanYear) и ОБА личных месячных цикла (maleMonth и womanMonth). Год каждого человека начинается в его день рождения; месяц меняется с календарным месяцем. pairMonth показывает совместное настроение периода. Сопоставь нынешние потребности женщины с доступностью и направленностью мужчины. Числа месяца не подменяют характер и не гарантируют перемену чувств.",
  "Особенно важно: ответ на ЭТУ пару дат в ДРУГОМ календарном месяце должен получить содержательно иной акцент по текущим циклам, если месячные числа изменились. Не делай изменения искусственными: показывай, что в этот месяц может усиливаться или ослабевать именно в его проявлении чувств. Не просто меняй одно слово или название месяца. Разные годы рождения при одинаковом дне и месяце обязательно сравнивай через жизненный путь, код года рождения и возрастной цикл: один только день рождения не задаёт одинаковый ответ всем людям.",
  "День и месяц рождения читаются вместе, в том числе при противоречиях. Не сочиняй скрытое желание любви при любом охлаждении. Возможны отсутствие интереса, недостаток вовлечённости, поверхностное притяжение, нерешительность и дистанция. Ни хорошее, ни плохое не приписывай человеку автоматически.",
  "В трактовках ЛИЧНОГО месяца: 1 собственные планы или начало; 2 сближение либо зависимость; 3 общение либо поверхностность; 4 устойчивость либо загруженность; 5 перемены либо непостоянство; 6 отношения либо обязательства; 7 внутренняя работа либо дистанция; 8 амбиции, деньги либо контроль; 9 завершение либо отпускание прошлого; 11/22/33 усиленные неоднозначные темы. Для мужчины и женщины сравнивай значения, а не вставляй одну заготовленную фразу.",
  "Сразу ответь на вопрос вероятностным выводом. Основной объём посвяти взаимодействию конкретных людей СЕЙЧАС и месячному контексту, а не общему психологическому портрету. Заверши одним проверяемым ориентиром на реальные поступки. Не утверждай, что знаешь мысли мужчины: нумерология является символической интерпретацией.",
  "Не выдумывай лайки, просмотры сторис, переписки, встречи, измены и общую биографию, если пользователь не сообщил таких фактов. Избегай универсального сюжета «он закрытый, но чувства есть» и оправдания любого отсутствия инициативы. Возраст и числовой код рождения не равны зрелости, верности или способности любить; это только дополнительные условные акценты, а не факты о человеке.",
  "Не перечисляй формулы, значения чисел и названия энергий в тексте для клиента. Не обещай, что чувства непременно появятся или исчезнут к следующему месяцу."
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
      return reply(200, { ok: true, service: "numi-moment-300-owner-preview", ai_bound: !!env.AI, live_answers_enabled: false, love001_cycle_version: "full-birthdate-two-person-monthly-20261117" });
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
      lines.push("Цикл текущего календарного месяца: "+values.cycleMonth+". Мужчина: личный год "+values.maleYear+", личный месяц "+values.maleMonth+". Женщина: личный год "+values.womanYear+", личный месяц "+values.womanMonth+". Месячный фон пары: "+values.pairMonth+".");
      lines.push("Различия по ПОЛНОЙ дате рождения: мужчина — жизненный путь "+values.maleLifePath+", код года рождения "+values.maleBirthYearCode+", возраст "+values.maleAge+", возрастной цикл "+values.maleAgeCycle+"; женщина — жизненный путь "+values.womanLifePath+", код года рождения "+values.womanBirthYearCode+", возраст "+values.womanAge+", возрастной цикл "+values.womanAgeCycle+"; взаимосвязь кодов года рождения "+values.birthYearInteraction+". Не своди людей, родившихся в один день и месяц разных лет, к одному характеру.");
      lines.push("Показатель attraction: потенциальное притяжение; interaction: динамика пары; tension: возможные разногласия. Это символические углы, не факты о чувствах.");
      lines.push("Приоритет трактовки: исходные качества мужчины 30%, сочетание пары 25%, годовые и месячные циклы ОБОИХ 40%, момент 5%. Важно показать особенности именно месяца "+values.cycleMonth+" без выдуманных действий и обещаний.");
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
