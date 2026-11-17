import redflagDraftWorker from "../../redflag-draft-ai/src/index.js";
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
/* Emotional interpretation for just love-001. These are symbolic possible feelings,
   never statements of fact about a third person's private thoughts. All signals are
   grounded in the numerical profile computed above; nothing is stored or purchased. */
const LOVE001_EMOTIONAL_CORES = {
  1:"живой интерес, азарт и желание самому решать, когда приближаться; глубокая привязанность пока под вопросом",
  2:"нежность, симпатия, желание эмоционального отклика; при этом возможны колебания",
  3:"лёгкое увлечение и удовольствие от общения, которое не обязательно стало серьёзной любовью",
  4:"спокойное тепло, уважение и доверие; сильной романтической страсти может не быть",
  5:"выраженное притяжение и любопытство, но непостоянство чувств и настроя",
  6:"личная привязанность, нежность и желание заботиться; возможна путаница между любовью и привычкой",
  7:"эмоциональная дистанция и сомнения; симпатия не обязательно означает готовность сближаться",
  8:"сильное притяжение или желание обладать вниманием, но это не равнозначно бережной любви",
  9:"смешанные чувства, след прошлого и постепенное отпускание; не обещай возвращения",
  11:"яркая чувствительность, идеализация и тревожное влечение, в котором не хватает ясности",
  22:"уважение и серьёзность намерений при слабой спонтанной романтике; близость зависит от взаимности",
  33:"теплота, забота и желание быть нужным; склонность путать любовь с ролью спасателя"
};
const LOVE001_PAIR_SHADES = {
  1:"интерес оживляет знакомство, но партнёры могут соперничать за инициативу",
  2:"взаимное притяжение возможно через нежность; без ответного шага оно быстро становится ожиданием",
  3:"между ними возможна игривость, но серьёзность чувства остаётся открытой",
  4:"уважение и чувство надёжности заметнее сильной влюблённости",
  5:"химия и новизна сильнее определённости и устойчивой привязанности",
  6:"тепло и желание близости могут возникать рядом с риском привычки",
  7:"могут преобладать сомнение, настороженность и эмоциональная недоступность",
  8:"сильное притяжение может сопровождаться борьбой за внимание и самостоятельность",
  9:"чувства могут быть связаны с памятью, завершением или непроговорённым прошлым",
  11:"эмоциональный отклик может быть интенсивным, но не обязательно взаимным",
  22:"совместимость намерений может ощущаться сильнее романтического порыва",
  33:"тепло и участие могут смешиваться с ожиданием благодарности"
};
const LOVE001_CURRENT_SHADES = {
  1:"интерес может проявиться как небольшой импульс к контакту, не обещай обязательных действий",
  2:"внутренний отклик может стать мягче, но не выводи это из выдуманных сообщений",
  3:"легче флирт и общение, возможна поверхностность без глубины",
  4:"чувства скорее ровные, без бурных признаний; это также может означать слабый интерес",
  5:"интерес может вспыхивать и затухать, не делай вид, что стабильная любовь уже есть",
  6:"значимее привязанность и готовность бережно относиться, но возможна сила привычки",
  7:"важнее осмотрительность и сомнения, а не автоматическая история о скрытой любви",
  8:"влечение может выражаться через собственничество или желание ясности; это не доказательство любви",
  9:"вероятнее пересмотр отношения или охлаждение; не обещай обратного",
  11:"может быть сильный эмоциональный всплеск с неясными последствиями",
  22:"чувства проверяются готовностью к устойчивой связи, не словами о будущем",
  33:"может стать важной забота, но она не гарантирует романтической взаимности"
};
function love001EmotionalLens(v) {
  // Combine both FULL birth dates for the pair shade, not just day and month.
  const pairCode=reduceNumber(v.interaction+v.birthYearInteraction);
  // Current shade changes with BOTH personal months; it must not dominate
  // or flip the stable emotional reading as if feelings were a monthly switch.
  const currentCode=reduceNumber(v.maleMonth+v.womanMonth+v.pairMonth);
  return {
    baseline:LOVE001_EMOTIONAL_CORES[v.maleLifePath]||"чувства неочевидны, важно не приписывать мужчине любовь автоматически",
    towardHer:LOVE001_PAIR_SHADES[pairCode]||"притяжение неоднозначное, не выдавай его за доказанные чувства",
    now:LOVE001_CURRENT_SHADES[currentCode]||"нынешнее проявление может быть неоднозначным",
    emotionalCoreCode:v.maleLifePath,
    pairCode,
    currentCode
  };
}
const LOVE001_SYSTEM = [
  "ТЫ ОТВЕЧАЕШЬ ТОЛЬКО НА «Что он чувствует ко мне?», НЕ НА «Почему он так себя ведёт?». Один выразительный ответ по-русски, 125–175 слов, два коротких абзаца. Первый начинается с прямого вывода о вероятном ЧУВСТВЕ мужчины К ЭТОЙ ЖЕНЩИНЕ (симпатия, интерес, нежность, привязанность, влюблённость, физическое влечение, привычка, сомнение, равнодушие, раздражение, охлаждение и т.п.). Ни вступления, ни перечня чисел.",
  "В данных есть отдельные СИМВОЛИЧЕСКИЕ эмоциональные ориентиры: baseline, towardHer и now. Сопоставь их, выбери конкретный и логичный эмоциональный вывод. Прямо скажи, что у него может быть к ней, насколько глубоко это чувство и чего в нём может не хватать. Не соединяй несовместимые сигналы без объяснения. Если тяготение поверхностное, не называй его любовью. Если сомнений или отстранённости больше, допускай слабый интерес или его отсутствие.",
  "Разные ПОЛНЫЕ даты рождения мужчины и женщины, год рождения, жизненный путь, сочетание пары и личные месячные периоды служат основой внутреннего анализа, но НЕ темой текста. В каждом месяце учитывай изменение личного месяца ОБОИХ людей и оттенка now, без произвольного обещания перемены чувств.",
  "СТРОГО НЕ ПИШИ В ОТВЕТЕ: «ты сейчас в цикле», «у тебя период», «ваши циклы», «его личный месяц», «энергии», «кармический резонанс», «материальные вопросы», «финансовые цели», «амбиции», «работа», «обязательства», «рациональность», «контроль», «структура», «он занят своими делами». Даже если цифры связаны с этими темами, переведи их только на язык чувств К ЖЕНЩИНЕ.",
  "Запрещён универсальный сюжет: «он закрытый/сдержанный, но глубокие чувства есть». Запрещено оправдывать отсутствие интереса его страхом близости, загруженностью или потребностью в личном пространстве. Не добавляй события, свидания, переписки, лайки или его мысли как реальные факты.",
  "Первые 2 предложения о КОНКРЕТНЫХ чувствах мужчины, а не о личности женщины, нумерологии, месяце, уроках отношений или поведении. Далее одна необычная, уместная эмоциональная тонкость именно этой пары. Заверши 1 короткой проверкой по реальной взаимности, без длинных советов женщине и без стандартного «понаблюдай, проявит ли инициативу».",
  "Стиль: нумеролог-подруга, живо, спокойно, ясно, небанально. Уместны и неприятные выводы; не утешай автоматически и не приукрашивай. Не повторяй формулы и заученные обороты. Не пиши длинных тире, обращения «Ваш вопрос затрагивает», рекламных обещаний и лишних рассуждений.",
  "Это символическая нумерологическая трактовка, а не достоверное знание чужих чувств. Формулируй аккуратно без претензии на чтение мыслей. НЕ вставляй длинный дисклеймер вместо ответа."
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
    if (["/v1/redflag-draft","/v1/redflag-batch-run","/v1/redflag-style-test","/v1/redflag-owner-question"].includes(pathname)) return redflagDraftWorker.fetch(request,env);
    if (request.method === "GET" && pathname === "/health")
      return reply(200, { ok: true, service: "numi-moment-300-owner-preview", ai_bound: !!env.AI, live_answers_enabled: false, love001_cycle_version: "full-birthdate-two-person-monthly-20261117", love001_emotion_version: "direct-feelings-20261117", redflag_draft_version: "redflag-owner-drafts-v3-no-numbers-ready-cta-20261117", redflag_owner_prompt_version: "owner-minimal-live-recovery-20261117" });
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
      const emotional=love001EmotionalLens(values);
      lines.push("ВНУТРЕННИЙ ориентир для прямого ответа про ЧУВСТВА: "+JSON.stringify(emotional));
      lines.push("Эмоциональные ориентиры уже вычислены на основе обеих ПОЛНЫХ дат, их совместимости и месяца вопроса. Не рассказывай клиенту ни о расчётах, ни о жизненных целях мужчины, ни о циклах женщины. Первая фраза должна прямо отвечать на вопрос, что он К НЕЙ чувствует.");
      lines.push("Нельзя считать этот ориентир фактом об эмоциях мужчины. Смысл: дать разнообразную символическую нумерологическую трактовку, а не придумать биографию.");

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
