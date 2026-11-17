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
  flags:"ЭТО ИМЕННО КРАСНЫЕ ФЛАГИ. Вытаскивай на свет неприятные сценарии: давление, двойные стандарты, контроль, перекладывание вины, ревность, уход от ответственности. Улыбка допустима, оправдания плохого поведения нет. Не называй человека насильником или абьюзером по дате.",
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
    if(request.method!=="POST"||!["/v1/draft","/v1/redflag-draft"].includes(url.pathname))
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
      ||!Array.isArray(input.followups)||input.followups.length>5
      ||input.followups.some(title=>typeof title!=="string"||title.length>170))
      return reply(400,{ok:false,error:"INVALID_INPUT"});
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
