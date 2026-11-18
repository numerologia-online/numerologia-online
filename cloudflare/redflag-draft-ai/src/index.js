/* Separate owner-only Red Flag DRAFT generator.
   Never changes paid JSON banks, product metadata, checkout, bot or users.
   Birth data is ONLY day and month, matching Red Flag's 366 combinations.
*/
const MODEL="@cf/google/gemma-4-26b-a4b-it";
const VERSION="redflag-owner-drafts-v3-no-numbers-ready-cta-20261117";
const PROOF_DIGEST="429a97ba8051a87f8e35b37a2e86259fad874d8d481ac811e77d42a3a15229d5";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const energy22=(number)=>{let n=Math.abs(Math.trunc(number));while(n>22)n=String(n).split("").reduce((sum,x)=>sum+Number(x),0);return n;};
const validDayMonth=(day,month)=>{
  if(!Number.isInteger(day)||!Number.isInteger(month)||month<1||month>12||day<1||day>31)return false;
  const date=new Date(Date.UTC(2000,month-1,day));
  return date.getUTCMonth()+1===month&&date.getUTCDate()===day;
};
async function serverProofValid(proof){
  if(typeof proof!=="string"||!/^[a-f0-9]{64}$/.test(proof))return false;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(proof));
  const raw=new Uint8Array(digest);let mismatch=0;
  for(let i=0;i<raw.length;i++)mismatch|=raw[i]^parseInt(PROOF_DIGEST.slice(i*2,i*2+2),16);
  return mismatch===0;
}
// The day and month are deliberately separate energies. For compound dates
// (23–31), keep the exact original day in addition to its reduced energy.
const ENERGY_SHADOWS={
  1:"инициатива в тени становится командованием и непереносимостью отказа",
  2:"осторожность в тени становится недоговорённостью и скрытностью",
  3:"любовь к комфорту в тени превращается в привычку получать больше, чем отдавать",
  4:"ответственность в тени превращается в контроль, правила и критику",
  5:"принципы в тени превращаются в нравоучения и желание перевоспитать",
  6:"романтичность в тени превращается в нерешительность и желание нравиться всем",
  7:"решительность в тени превращается в нетерпение, соревнование и давление",
  8:"чувство справедливости в тени превращается в вечный подсчёт, кто кому должен",
  9:"самостоятельность в тени превращается в холодную дистанцию и молчание",
  10:"лёгкость на подъём в тени становится непостоянством и игрой в удачу",
  11:"сила в тени превращается в ревность, напор и борьбу за последнее слово",
  12:"терпение в тени превращается в роль жертвы и перекладывание вины",
  13:"умение завершать в тени превращается в резкие разрывы и обнуление отношений",
  14:"мягкость в тени превращается в пассивность и бесконечное откладывание",
  15:"магнетизм в тени превращается в искушение властью, ревностью или выгодой",
  16:"смелость рушить старое в тени становится вспыльчивостью и резкими скандалами",
  17:"вдохновение в тени превращается в позёрство и любовь к чужому восхищению",
  18:"чуткость в тени превращается в подозрения, фантазии и скрытые тревоги",
  19:"яркость в тени превращается в самолюбование и потребность быть главным",
  20:"верность семье в тени превращается в осуждение и зависимость от мнения родни",
  21:"широта взглядов в тени превращается в избегание обязательств и вечное «потом»",
  22:"свобода в тени превращается в безответственность и капризы"
};
// Temporary CI-only batch access: Worker stores ONLY the SHA-256 of an
// ephemeral 64-character secret. The token itself remains in the CI runner
// and must be removed after the one-bank generation. All requests still
// produce unpublishable drafts and never access purchases or private banks.
async function ephemeralBatchProofValid(provided,expectedHash){
  if(typeof provided!=="string"||!/^[a-f0-9]{64}$/.test(provided)||
    typeof expectedHash!=="string"||!/^[a-f0-9]{64}$/.test(expectedHash))return false;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(provided));
  const bytes=new Uint8Array(digest);let mismatch=0;
  for(let i=0;i<bytes.length;i++)
    mismatch|=bytes[i]^parseInt(expectedHash.slice(i*2,i*2+2),16);
  return mismatch===0;
}
const CATEGORY_RULES={
  flags:"", // Cleared by owner request: no Red Flag instruction until a new one is provided.
  infidelity:"Тема верности, честности и соблазнов. Показывай неприглядные проявления: запасные варианты, флирт ради самооценки, размытые границы, недоговорённости. Не объявляй факт измены по дате.",
  intimacy:"Обрати внимание на эгоизм, уважение к отказу, нежность и реальную взаимность. Не придумывай подробности интимной жизни человека, никаких откровенных сексуальных сцен.",
  family:"Показывай не только достоинства, но и бытовое иждивенчество, инфантильность, пустые обещания, чрезмерный контроль. Привязывай вывод исключительно к вопросу.",
  language:"Тень общения: обиды, молчаливые наказания, обесценивание, самовлюблённость, неумение слушать. Дай живой, человеческий совет, не общий психологический трактат.",
  verdict:"Вывод без розовых очков. Честная развилка, за что мужчина может быть хорош и где женщина рискует. Внятный вердикт строго по заданному вопросу."
};
const SYSTEM=[
  "Ты пишешь ОДИН короткий ТЕСТОВЫЙ ответ для Red Flag на русском. Это нумерологическая трактовка, не реальные установленные факты о человеке.",
  "ГОЛОС: опытная нумеролог и близкая подруга. Простые разговорные слова, остро, чуть дерзко, с улыбкой. Пиши так, чтобы хотелось отправить подруге. Допустима одна меткая смешная фраза, но не клоунада и не грубость в адрес читательницы.",
  "В ПЕРВОЙ ЖЕ ФРАЗЕ дай ответ на КОНКРЕТНЫЙ вопрос. Не начинай «Этот мужчина балансирует», «Его природа», «С одной стороны», «Ему свойственно». Не пересказывай характер целиком.",
  "Нужны преимущественно ТЕНЕВЫЕ СТОРОНЫ мужчины. Не вылизывай его и не оправдывай всё страхом близости, усталостью или трудным детством. Можно прямо сказать, что в этом сочетании есть риск жадности, контроля, эгоизма, привычки юлить или бегать за чужим вниманием. Но не приписывай ему доказанные измены, насилие и конкретные реальные события.",
  "Обязательно трактуй одновременно ДВА СЛОЯ: энергетику ДНЯ рождения и энергетику МЕСЯЦА. Покажи их конкретное взаимодействие именно для данного вопроса. ВАЖНО: это только твой внутренний расчёт. Ни в одном предложении не называй энергию, аркан, число рождения, девятку, восьмёрку, «девятка-девятка», «9-9», сочетание чисел и сам принцип вычисления. Читательница видит только вывод о поведении мужчины.",
  "Для каждого вопроса и сочетания даты придумай свой сюжет и наблюдаемый пример. Не повторяй универсальные истории про мужчину, который «молчит и закрывается», «погружён в себя», «тянется к духовной близости». Женщина покупает ответы на РАЗНЫЕ вопросы, она должна узнавать новые грани.",
  "РОВНО ДВА АБЗАЦА. Первый: 75–105 слов, конкретный вывод, яркая бытовая ситуация, неприятный нюанс. Второй: 25–40 слов, обязательно мягкое, живое предложение посмотреть ДРУГОЙ УЖЕ ГОТОВЫЙ вопрос из переданного списка, с его точным названием в кавычках и естественной связью с текущей темой. Не предлагай выдуманные вопросы или ещё не готовые. Общий размер около 750–1100 знаков с пробелами. Никаких заголовков, списков, двоеточий, длинных тире, формул и шаблонных оговорок.",
  "ЗАПРЕЩЕНО: пафосная психология и абстрактная метафизика («внутренний театр», «духовная близость», «внешнее смирение», «множество эмоциональных привязанностей», «его природа», «энергетические качели», «глубокое самосозерцание»). Не пиши канцеляритом. Не используй образ «кокон», «аудит передвижений», «скрытый поиск смыслов». Пиши как реальная женщина, а не умничающий ИИ.",
  "Пример нужного градуса, НЕ для копирования: «Забота хороша, пока не превращается в службу контроля. Ты попросила совет, а он уже решил за тебя, где работать и с кем дружить. Спасибо, конечно, но начальник у тебя уже есть». Это стиль, а не готовый универсальный ответ.",
  "Не утверждай, что нумерология доказывает поведение человека. Не объясняй расчёт. Во втором абзаце обязательно направь женщину к реальному готовому вопросу из списка; например «А если хочешь разобраться, насколько он вообще уважает твои границы, загляни в „Уважает женское «нет» или начинает давить?“». Пример только про стиль перехода, выбирай нужное название из списка для конкретного случая."
].join(" ");
// Isolated experiment, never used by the customer free answer or paid answers.
// Only owner preview model gets this compact prompt.
// The existing production free and paid routes remain unchanged.
const STYLE_TEST_SYSTEM=[
  "Ты нумеролог, пишешь женщине о мужчине как умная заботливая подруга. Говори живо и прямо, без лести, пафоса и канцелярита.",
  "В первой фразе ответь ИМЕННО на заданный вопрос. Если вопрос предлагает выбор, дай ясный выбор или честную оговорку. Не заменяй ответ описанием характера и внутреннего мира мужчины.",
  "Для вывода мысленно используй теневые стороны двух чисел, дня и месяца рождения по системе 22 энергий. Это ТОЛЬКО внутренние данные. В готовом тексте НИКОГДА не называй числа, энергии, арканы, матрицу, нумерологию, девятки или способ расчёта.",
  "Опиши один конкретный риск или его отсутствие и наблюдаемые признаки поведения только по теме вопроса. Не приписывай человеку достоверные поступки по дате и не придумывай злодея там, где риск невелик.",
  "Ответ для читательницы, а не отчёт о методе. Два коротких живых абзаца, всего примерно 650–950 знаков. Без двоеточий, длинных тире, формул, навязанных переходов к другим вопросам и универсальных психологических рассуждений."
].join(" ");
// Only for the owner-facing Красные флаги test. Text agreed with the owner.
// Fast, single-pass owner-only Красные флаги quality prompt.
// No chain of AI editors: one inference, silent internal self-check.
const FLAGS_OWNER_PROMPT=[
  "Ты опытный нумеролог по системе 22 энергий Матрицы судьбы. Пишешь женщине о мужчине как внимательная подруга. Это символическая интерпретация склонностей, не достоверные факты о человеке.",
  "ВНУТРЕННЕ, не показывая ход анализа: (1) выдели сильные и теневые стороны энергии ДНЯ и МЕСЯЦА с равным весом 50/50; (2) найди их взаимодействие именно по заданному вопросу, а не общий характер; (3) выбери один наиболее показательный механизм поведения и конкретную наблюдаемую ситуацию; (4) проверь черновик на повторяющиеся клише, категоричность, лесть и соответствие вопросу. Выполни все это внутри ОДНОГО ответа, без отчёта об этапах.",
  "С первой фразы дай ясный ответ на КОНКРЕТНЫЙ вопрос. Если два полюса, покажи, к чему склоняется поведение и при каких обстоятельствах может проявиться другой полюс. Не начинай портретом личности, самооценкой или одиночеством, если вопрос не о них. Отдельные вопросы одной даты обязаны раскрывать разные поступки и реакции, а не одну историю, пересказанную другими словами.",
  "Реалистично показывай неприятную сторону, если она следует из сочетания, и её цену для женщины. Не оправдывай контроль, жестокость и пренебрежение; но и не выдумывай их там, где по трактовке риск слабый. Не объявляй по дате доказанные измены, насилие, мотивы и поступки. Избегай категоричных «он точно», «он никогда», «всегда будет». Говори о вероятных склонностях через конкретные реакции.",
  "Одна короткая узнаваемая жизненная ситуация лучше нескольких общих прилагательных. Убирай шаблоны «закрытый и мудрый», «уйдёт в себя», «особенный», «внутренний мир», «самодостаточность», «считает себя выше всех», если они не раскрывают сам вопрос. Не приписывай каждой дате желание доминировать или страх близости. Если месяц меняется, меняется механизм поведения, а не только тон.",
  "Стиль: естественная живая речь женщины к женщине, конкретно, с наблюдательностью и мягкой иронией там, где она уместна. Никаких красивостей ради красивостей, пафоса, оправданий каждого мужчины и универсальных советов. Не называй энергии, числа, арканы, матрицу и расчёты.",
  "Ответ строго из двух абзацев примерно 750–1100 символов с пробелами. Первый, основной: прямой ответ и конкретное проявление в общении/поступках. Второй, значительно короче: естественный переход к переданному доступному вопросу с его ТОЧНЫМ названием. Без списков, заголовков, двоеточий и длинных тире. Верни ТОЛЬКО готовый текст."
].join("\n\n");
// Pick a contextually related, actually available follow-up without another AI call.
// Rotate equally relevant editorial options across months to avoid the same upsell.
const FLAGS_RELATED_FOLLOWUPS=Object.freeze({
  "hero":["Щедрый мужчина", "Будет ли мужчина жить за твой счёт", "Самостоятельный мужчина"],
  "say-no":["На каком языке любви", "Будет опорой для семьи", "Пишет первым"],
  "care-or-control":["Верный или", "Будет опорой для семьи", "На каком языке любви"],
  "jealousy":["Верный или", "Пишет первым", "Какой финальный вердикт"],
  "argument":["Держит слово", "На каком языке любви", "Будет опорой для семьи"],
  "abuse-signal":["Держит слово", "Какой финальный вердикт", "Будет опорой для семьи"],
  "support-or-cause":["Будет опорой для семьи", "Щедрый мужчина", "Держит слово"],
  "apology":["Держит слово", "На каком языке любви", "Пишет первым"],
  "weak-place":["Какой финальный вердикт", "Верный или", "Будет опорой для семьи"],
  "calm-or-swings":["На каком языке любви", "Будет опорой для семьи", "Держит слово"]
});
const flagsRelatedFollowup=(titles,questionId,month)=>{
  if(!titles.length)return [];
  const patterns=FLAGS_RELATED_FOLLOWUPS[questionId]||[];
  const relevant=patterns.map(prefix=>titles.find(t=>t.startsWith(prefix))).filter(Boolean);
  return [relevant.length?relevant[(month-1)%relevant.length]:titles[0]];
};
// Detect the repetitive generic portrait that made earlier answers feel identical.
// This is a review signal, not a predefined interpretation for any energy.
const flagsGenericPortrait=(raw)=>{
  const first=draftParagraphs(normalizeDraft(raw))[0]||"";
  const templates=[
    /внутренн\w*\s+(?:мир|глубин|спокойств|ценност|ощущен)/iu,
    /глубок\w*\s+(?:раздум|пониман|чувств|мудрост|мир|избирательн)/iu,
    /(?:закрыва|закрыт|замкну|отстран|дистанцир|уходит?\s+в\s+себя)/iu,
    /(?:интеллектуальн\w*\s+превосходств|исключительност|особого\s+склада)/iu,
    /(?:самоценност|достоинств|особый\s+путь)/iu
  ];
  return templates.filter(pattern=>pattern.test(first)).length>=3;
};
const flagsOutputValid=(raw,followups)=>{
  if(typeof raw!=="string")return false;
  const answer=normalizeDraft(raw),parts=draftParagraphs(answer);
  return answer.length>=420&&answer.length<=1550&&parts.length===2
    &&parts[0].length>=275&&parts[1].length>=55
    &&!ownerHasCalculationLeak(answer)
    &&(!followups.length||followups.some(title=>parts[1].includes(title)));
};
// The owner chose a separate subject of analysis for each Красные флаги question.
// A focus directs the analysis; it never supplies a fixed answer or verdict.
const FLAGS_QUESTION_FOCUS=Object.freeze({
  "say-no": "Исследуй отношение мужчины к отказу, несогласию и праву женщины самой принимать решения. Как он ведёт себя, когда её выбор не совпадает с его желаниями?",
  "care-or-control": "Исследуй границу между заботой и стремлением распоряжаться жизнью женщины. Учитывай доверие, ревность, личную свободу, уважение к её решениям и интерес к её благополучию.",
  "hero": "Исследуй самооценку мужчины, отношение к собственным достоинствам и чужим успехам, потребность в признании и способность не ставить себя выше партнёрши.",
  "jealousy": "Исследуй доверие, отношение к вниманию других мужчин, конкуренции и неопределённости в отношениях. Как он проявляет ревность, если она возникает, и способен ли отличать реальные поводы от собственных опасений?",
  "argument": "Исследуй, как мужчина обсуждает неудобные темы, слышит возражения, выдерживает эмоциональное напряжение и возвращается к диалогу. Отличай потребность обдумать разговор от попытки наказать женщину молчанием.",
  "abuse-signal": "Исследуй, какие особенности общения и поведения могут стать ранним тревожным сигналом при знакомстве. Обращай внимание на отношение к границам, обещаниям, чужому времени и равноправию, не подменяя ответ общим портретом.",
  "support-or-cause": "Исследуй, как мужчина может проявлять себя, когда женщине тяжело и нужна помощь. Сопоставь готовность участвовать, способность замечать её состояние, действия в сложной ситуации и вероятность самому создавать лишние трудности.",
  "apology": "Исследуй способность мужчины признавать собственную неправоту после ссоры, понимать чувства партнёрши, брать ответственность за слова и поступки и исправлять ситуацию, а не просто завершать неприятный разговор.",
  "weak-place": "Исследуй, какая уязвимая сторона взаимодействия двух энергий именно в близких отношениях может со временем причинить наибольший вред паре. Объясни механизм и условия её проявления, учитывая также то, что способно её смягчить.",
  "calm-or-swings": "Исследуй эмоциональную устойчивость и предсказуемость мужчины в отношениях, его реакции на перемены, разочарования и повседневный стресс. Отличай естественные колебания настроения от повторяющихся эмоциональных качелей."
});
const OWNER_QUESTION_SYSTEM=STYLE_TEST_SYSTEM;
// Normalize formatting only for owner testing; NEVER change the customer's route.
// A genuine reply must not disappear because the model used one paragraph.
const normalizeOwnerText=(raw)=>{
  let answer=normalizeDraft(raw).replace(/[—:]/g,",").replace(/,{2,}/g,",");
  const paragraphs=answer.split(/\n\s*\n/).map(p=>p.replace(/\s+/g," ").trim()).filter(Boolean);
  if(paragraphs.length===1){
    const one=paragraphs[0];
    const matches=[...one.matchAll(/[.!?](?=\s|$)/g)].map(m=>m.index+1);
    const pivot=matches.filter(n=>n>=Math.floor(one.length*0.32)&&n<=Math.floor(one.length*0.7))
      .sort((x,y)=>Math.abs(x-one.length/2)-Math.abs(y-one.length/2))[0];
    const splitAt=pivot||one.indexOf(" ",Math.floor(one.length/2));
    if(splitAt>40&&splitAt<one.length-40)
      answer=one.slice(0,splitAt).trim()+"\n\n"+one.slice(splitAt).trim();
    else answer=one;
  }else if(paragraphs.length>2){
    answer=paragraphs.slice(0,Math.ceil(paragraphs.length/2)).join(" ")+"\n\n"+
      paragraphs.slice(Math.ceil(paragraphs.length/2)).join(" ");
  }else answer=paragraphs.join("\n\n");
  return answer;
};
// Owner drafts must never expose private calculations or turn into a
// numerology lecture. Reject and rewrite bad content instead of displaying it.
const ownerHasCalculationLeak=(s)=>hiddenCalculationLeak(s)||
 /(?:матриц\w*|нумеролог\w*|числ[аоеу]м?\s+рождения|сочетани\w*\s+(?:двух\s+)?(?:чисел|энергий)|дв[еух]\s+девятк\w*|расч[её]т\w*\s+по\s+дат)/iu.test(s);
const styleTestOK=(s)=>typeof s==="string"&&s.length>=350&&s.length<=1800&&
 s.trim().split(/\n\s*\n/).length===2&&!ownerHasCalculationLeak(s);
const draftWords=(answer)=>typeof answer==="string"?answer.trim().split(/\s+/).filter(Boolean).length:0;
const draftParagraphs=(answer)=>typeof answer==="string"?answer.trim().split(/\n\s*\n+/).filter(Boolean):[];
const normalizeDraft=(answer)=>typeof answer==="string"?answer.trim().replace(/\r\n/g,"\n").replace(/\n{3,}/g,"\n\n"):"";
// Remove accidental disclosures such as "девятка-девятка" or "9-9"
// from customer-facing prose. The actual two-energy calculation stays intact.
const hiddenCalculationLeak=(answer)=>/(?:аркан|энерг|нумеролог|девятк|восьм[её]рк|сем[её]рк|шест[её]рк|пят[её]рк|четв[её]рк|тройк|двойк|единиц|сочетани\w*\s+чисел|число\s+рождения|месяц\s+рождения|день\s+рождения|\d{1,2}\s*[-\/]\s*\d{1,2})/iu.test(answer);
const validDraft=(answer)=>{
  const normalized=normalizeDraft(answer);
  return normalized.length>=580&&normalized.length<=1420&&
    draftWords(normalized)>=80&&draftWords(normalized)<=190&&
    draftParagraphs(normalized).length===2&&!hiddenCalculationLeak(normalized);
};
const hasReadyFollowup=(answer,titles)=>{
  const paragraphs=draftParagraphs(answer);
  return paragraphs.length===2&&titles.length>0&&
    titles.some(title=>paragraphs[1].includes(title));
};
const ensureReadyFollowup=(answer,titles)=>{
  if(!titles.length||hasReadyFollowup(answer,titles))return answer;
  const paragraphs=draftParagraphs(answer);
  if(paragraphs.length!==2)return answer;
  const suffix="Хочешь проверить эту сторону мужчины ещё точнее? Посмотри «"+titles[0]+"».";
  // Preserve the author's actual answer. Add only a directly related published
  // question rather than rewriting the core interpretation.
  paragraphs[1]+=" "+suffix;
  return paragraphs.join("\n\n");
};
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/health")
      return reply(200,{ok:true,service:"numerologia-redflag-draft-ai",version:VERSION,
        ai_bound:!!env.AI,owner_drafts_only:true,live_answers_enabled:false});
    // CI-only inference bridge for creating and independently reviewing one
    // private 366-date bank. Disabled without the temporary SHA-256 secret.
    if(url.pathname==="/v1/redflag-batch-run"){
      if(!["POST","GET"].includes(request.method))return reply(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
      if(!await ephemeralBatchProofValid(
        request.headers.get("X-Numi-Redflag-Batch"),env.REDFLAG_BATCH_KEY_SHA256))
        return reply(403,{ok:false,error:"FORBIDDEN"});
      if(!env.AI)return reply(503,{ok:false,error:"AI_UNAVAILABLE"});
      if(request.method==="POST"&&!(request.headers.get("Content-Type")||"").startsWith("application/json"))
        return reply(415,{ok:false,error:"JSON_REQUIRED"});
      // GET mode exists only for verified temporary CI access. Some edge
      // configurations reject POST from build runners before it reaches Worker.
      // Keep the one-use secret in a header, never in a URL.
      let raw;
      if(request.method==="GET"){
        const encoded=url.searchParams.get("payload");
        if(typeof encoded!=="string"||encoded.length<4||encoded.length>17500||
          !/^[a-zA-Z0-9_-]+$/.test(encoded))return reply(400,{ok:false,error:"INVALID_PAYLOAD"});
        try{
          const binary=atob(encoded.replace(/-/g,"+").replace(/_/g,"/"));
          raw=new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
        }catch{return reply(400,{ok:false,error:"INVALID_PAYLOAD"});}
      }else raw=await request.text();
      if(raw.length>18000)return reply(413,{ok:false,error:"INPUT_TOO_LARGE"});
      let body;
      try{body=JSON.parse(raw)}catch{return reply(400,{ok:false,error:"INVALID_JSON"});}
      if(!body||!Array.isArray(body.messages)||body.messages.length<1||
        body.messages.length>4||body.messages.some(m=>!m||
          !["system","user","assistant"].includes(m.role)||typeof m.content!=="string"||
          m.content.length<1||m.content.length>9500)||
        !Number.isInteger(body.max_completion_tokens)||body.max_completion_tokens<50||
        body.max_completion_tokens>900||typeof body.temperature!=="number"||
        body.temperature<0||body.temperature>1.2)
        return reply(400,{ok:false,error:"INVALID_BATCH_INPUT"});
      try{
        const result=await env.AI.run(MODEL,{
          messages:body.messages,
          max_completion_tokens:body.max_completion_tokens,
          temperature:body.temperature,
          chat_template_kwargs:{enable_thinking:false}
        });
        const answer=result?.response??result?.choices?.[0]?.message?.content;
        if(typeof answer!=="string"||!answer.trim()||answer.length>7500)
          return reply(503,{ok:false,error:"MODEL_NO_TEXT"});
        return reply(200,{ok:true,response:answer});
      }catch(e){
        console.error("REDFLAG_BATCH_MODEL_ERROR",e?.name||"error");
        return reply(503,{ok:false,error:"MODEL_UNAVAILABLE"});
      }
    }
    if(request.method!=="POST"||!["/v1/draft","/v1/redflag-draft","/v1/redflag-style-test","/v1/redflag-owner-question"].includes(url.pathname))
      return reply(404,{ok:false,error:"NOT_FOUND"});
    if(!env.AI)return reply(503,{ok:false,error:"AI_UNAVAILABLE"});
    const phpOwnerProof=await serverProofValid(request.headers.get("X-Numi-Moment-Proof"));
    const ciBatchProof=phpOwnerProof?false:await ephemeralBatchProofValid(
      request.headers.get("X-Numi-Redflag-Batch"),env.REDFLAG_BATCH_KEY_SHA256);
    if(!phpOwnerProof&&!ciBatchProof)
      return reply(403,{ok:false,error:"FORBIDDEN"});
    if(!(request.headers.get("Content-Type")||"").startsWith("application/json"))
      return reply(415,{ok:false,error:"JSON_REQUIRED"});
    const raw=await request.text();
    if(raw.length>4000)return reply(413,{ok:false,error:"TOO_LARGE"});
    let input;
    try{input=JSON.parse(raw);}catch{return reply(400,{ok:false,error:"INVALID_JSON"});}
    if(!input||typeof input!=="object"
      ||!Object.hasOwn(CATEGORY_RULES,input.category)
      ||typeof input.question_id!=="string"||!/^[a-z][a-z0-9-]{1,60}$/.test(input.question_id)
      ||typeof input.title!=="string"||input.title.length<5||input.title.length>170
      ||!validDayMonth(input.day,input.month)
      ||!Array.isArray(input.followups)||input.followups.length>(input.category==="flags"?10:5)
      ||input.followups.some(title=>typeof title!=="string"||title.length>170))
      return reply(400,{ok:false,error:"INVALID_INPUT"});
    // Красные флаги: owner-only test with the exact newly approved prompt.
    // Do not pass this category through other sections' rules, editing,
    // automatic re-prompts, energy-shadow templates or forced upsells.
    if(input.category==="flags"){
      const isOwnerQuestion=url.pathname==="/v1/redflag-owner-question";
      const isStyleTrial=url.pathname==="/v1/redflag-style-test";
      if(!isOwnerQuestion&&!isStyleTrial)
        return reply(409,{ok:false,error:"FLAGS_NOT_PUBLISHED",draft_only:true,published:false});
      const followup=flagsRelatedFollowup(input.followups,input.question_id,input.month);
      const userInput=[
        "Вопрос: "+input.title,
        "Тема и отличительная грань: "+(FLAGS_QUESTION_FOCUS[input.question_id]||"Только конкретная тема этого вопроса."),
        "День рождения мужчины: "+input.day+" (энергия "+energy22(input.day)+").",
        "Месяц рождения мужчины: "+input.month+" (энергия "+energy22(input.month)+").",
        "Один проверенный доступный следующий вопрос: "+JSON.stringify(followup)
      ].join("\n");
      try{
        // One model call only; all editorial reasoning happens inside it.
        // Lightweight local validation cannot add model latency.
        const generated=await env.AI.run(MODEL,{
          messages:[{role:"system",content:FLAGS_OWNER_PROMPT},
            {role:"user",content:userInput}],
          temperature:0.79,max_completion_tokens:780,
          chat_template_kwargs:{enable_thinking:false}
        });
        const answer=normalizeDraft(generated?.response??generated?.choices?.[0]?.message?.content);
        const editorialReviewNeeded=!flagsOutputValid(answer,followup)||
          flagsGenericPortrait(answer)||
          /(?:он точно|он никогда|он всегда|он обязательно|этот мужчина точно)/iu.test(answer);
        if(answer.length<380||answer.length>2900||ownerHasCalculationLeak(answer)){
          const parts=draftParagraphs(answer);
          return reply(503,{ok:false,error:"FLAGS_GEMMA_OUTPUT_INCOMPLETE",
            diagnosis:{chars:answer.length,paragraphs:parts.length,
              first:parts[0]?.length||0,second:parts[1]?.length||0,
              leak:ownerHasCalculationLeak(answer),
              followup:followup.some(t=>parts[1]?.includes(t))}});
        }
        return reply(200,{ok:true,draft_only:true,published:false,
          editorial_review_needed:editorialReviewNeeded,
          style_test:isStyleTrial,category:input.category,question_id:input.question_id,
          date_key:input.day+"-"+input.month,answer,
          model:MODEL,style_version:"flags-owner-gemma4-single-pass-editor-20261118"});
      }catch(error){
        console.error("REDFLAG_FLAGS_GEMMA_ERROR",error?.name||"error");
        return reply(503,{ok:false,error:"FLAGS_GEMMA_UNAVAILABLE"});
      }
    }
    const styleTest=url.pathname==="/v1/redflag-style-test";
    const ownerQuestion=url.pathname==="/v1/redflag-owner-question";
    if(styleTest||ownerQuestion){
      // Isolated owner-only experiment. No customer routes, earlier answers,
      // hard-coded energy shadows, prescribed plots or sales links.
      const dayEnergy=energy22(input.day),monthEnergy=energy22(input.month);
      const questionText=[
        "Вопрос: "+input.title,
        "День рождения мужчины: "+input.day+" (энергия "+dayEnergy+").",
        "Месяц рождения мужчины: "+input.month+" (энергия "+monthEnergy+").",
        "Напиши ответ только на этот вопрос, учитывая обе энергии."
      ].join("\n");
      try{
        let answer="";
        // Numeric-only diagnosis for protected owner requests. No generated
        // prose or credentials are returned on failure.
        const checks=[];
        for(let attempt=0;attempt<2;attempt++){
          const messages=[{role:"system",content:ownerQuestion?OWNER_QUESTION_SYSTEM:STYLE_TEST_SYSTEM},
            {role:"user",content:questionText}];
          if(attempt>0){
            messages.push({role:"assistant",content:answer.slice(0,1800)});
            messages.push({role:"user",content:
              "Перепиши ответ как редактор для обычной женщины. В прежнем тексте есть служебные рассуждения о числах, энергиях или матрице либо лишняя общая психология. Полностью УБЕРИ упоминания расчёта. Первой фразой ответь именно на вопрос «"+input.title+"», далее только конкретные проявления по этой теме. Два коротких абзаца. Верни только итоговый текст."});
          }
          const generation=await env.AI.run(MODEL,{
            messages,temperature:attempt?0.65:0.82,
            max_completion_tokens:730,
            chat_template_kwargs:{enable_thinking:false}
          });
          const rawAnswer=generation?.response??
            generation?.choices?.[0]?.message?.content;
          answer=normalizeOwnerText(rawAnswer);
          checks.push({
            raw_type:typeof rawAnswer,
            raw_chars:typeof rawAnswer==="string"?rawAnswer.length:0,
            answer_chars:answer.length,
            paragraphs:answer.split(/\\n\\s*\\n/).length,
            hidden_leak:hiddenCalculationLeak(answer),
            model_keys:generation&&typeof generation==="object"?Object.keys(generation).slice(0,6):[]
          });
          if(styleTestOK(answer))
            return reply(200,{ok:true,draft_only:true,published:false,
              style_test:true,category:input.category,question_id:input.question_id,
              date_key:input.day+"-"+input.month,
              answer,style_version:"owner-reader-first-no-calculations-20261117"});
        }
        return reply(503,{ok:false,error:"STYLE_TEST_LENGTH_OR_FORMAT"+checks.map(x=>"_RAW"+x.raw_chars+"_TEXT"+x.answer_chars+"_PAR"+x.paragraphs+"_LEAK"+(x.hidden_leak?1:0)+"_TYPE"+x.raw_type.toUpperCase()+"_KEYS"+x.model_keys.join("Z").toUpperCase().replace(/[^A-Z0-9]/g,"")).join(""),checks});
      }catch(error){
        console.error("REDFLAG_STYLE_TEST_ERROR",error?.name||"error");
        return reply(503,{ok:false,error:"AI_TEMPORARILY_UNAVAILABLE"});
      }
    }
    const code=String(input.day)+"-"+String(input.month);
    const day=energy22(input.day),month=energy22(input.month);
    const combined=energy22(day+month),contrast=energy22(Math.abs(day-month)||22);
    const user=[
      "Категория: "+input.category,
      "Вопрос: "+input.title,
      "Комбинация даты (день-месяц): "+code,
      "День рождения: исходное число "+input.day+", его главная энергия "+day+". Месяц рождения: исходное число "+input.month+", его энергия "+month+".",
      "ТЕНЬ дня: "+ENERGY_SHADOWS[day]+".",
      "ТЕНЬ месяца: "+ENERGY_SHADOWS[month]+".",
      "Совместный акцент: "+combined+"; напряжение двух энергий: "+contrast+".",
      "ОСНОВА интерпретации: как тень дня и тень месяца проявятся ВМЕСТЕ именно в этом вопросе. Не бери одно число вместо двух. Сохраняй индивидуальность исходного дня "+input.day+".",
      "Особое требование категории: "+CATEGORY_RULES[input.category],
      "УЖЕ ГОТОВЫЕ и доступные на сайте вопросы для рекомендации во втором абзаце: "+JSON.stringify(input.followups),
      "Во втором абзаце обязательно порекомендуй ОДИН из этих готовых вопросов по точному названию. Не придумывай новые и не обещай будущих. Показывай только трактовку, не числа и энергии."
    ].join("\n");
    try{
      const modelResult=await env.AI.run(MODEL,{
        messages:[{role:"system",content:SYSTEM},{role:"user",content:user}],
        temperature:0.76,max_completion_tokens:630,
        chat_template_kwargs:{enable_thinking:false}
      });
      let answer=normalizeDraft(modelResult?.response??modelResult?.choices?.[0]?.message?.content);
      if(!validDraft(answer)){
        // A second pass corrects verbosity and vague style instead of exposing
        // a rambling 2000+ character essay in the owner's Red Flag accordion.
        const revision=await env.AI.run(MODEL,{
          messages:[
            {role:"system",content:SYSTEM},
            {role:"user",content:user},
            {role:"assistant",content:answer.slice(0,3500)},
            {role:"user",content:"Перепиши без потери смысла: ровно два абзаца, коротко, просто и дерзко, без заумных метафор. НИ ЕДИНОГО названия или числа энергий, арканов и принципа нумерологического расчёта, в том числе «девятка-девятка». Во втором абзаце ОБЯЗАТЕЛЬНО предложи один из уже готовых вопросов по точному названию из списка. Никаких двоеточий. Верни только готовый текст."}
          ],
          temperature:0.65,max_completion_tokens:530,
          chat_template_kwargs:{enable_thinking:false}
        });
        answer=normalizeDraft(revision?.response??revision?.choices?.[0]?.message?.content);
      }
      answer=ensureReadyFollowup(answer,input.followups);
      if(!validDraft(answer))
        return reply(503,{ok:false,error:"BAD_DRAFT"});
      return reply(200,{ok:true,draft_only:true,category:input.category,
        question_id:input.question_id,date_key:code,answer,model:MODEL,style_version:VERSION});
    }catch(error){
      console.error("REDFLAG_DRAFT_AI_ERROR",error?.name||"error");
      return reply(503,{ok:false,error:"GENERATION_UNAVAILABLE"});
    }
  }
};
