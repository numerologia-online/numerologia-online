/* Separate owner-only Red Flag DRAFT generator.
   Never changes paid JSON banks, product metadata, checkout, bot or users.
   Birth data is ONLY day and month, matching Red Flag's 366 combinations.
*/
const MODEL="@cf/google/gemma-4-26b-a4b-it";
const VERSION="redflag-owner-drafts-v1-20261117";
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
const CATEGORY_RULES={
  flags:"Опиши возможный риск конкретно и с обеими сторонами проявления, без необоснованных обвинений в насилии, манипуляции или диагнозов. Не оправдывай плохое поведение.",
  infidelity:"Объясни символические тенденции в границах, верности или флирте. Не называй человека изменщиком по дате и не обещай верность.",
  intimacy:"Обсуди уважение, внимание, темперамент и согласие без откровенных сексуальных деталей или выдуманных фактов из чужой интимной жизни.",
  family:"Оцени поведенческие тенденции в быту и семейных решениях, не приписывая человеку конкретную биографию.",
  language:"Расскажи, как может проявляться общение и внимание, не сводя все вопросы к одному портрету молчаливого мужчины.",
  verdict:"Дай ясный условный итог по заданному вопросу, не объявляй человека однозначно плохим или хорошим."
};
const SYSTEM=[
  "Ты пишешь ОДИН ЧЕРНОВОЙ ответ для вопроса «Мужчина или Red Flag» на русском. Это не публикация, только проверка автором.",
  "Прямой ответ на ТОЧНЫЙ вопрос в ПЕРВОМ предложении. Не начинай с характеристик личности, общих энергий, фразы «этот мужчина может» или вступления.",
  "Трактуй одновременно день и месяц рождения мужчины: это две разные энергии, и одна может усиливать или сдерживать другую. Числа выше 22 сводятся суммой цифр; 11, 15 и 22 сохраняются. Год рождения здесь отсутствует. Не придумывай личные годы, возраст, события, фактические мысли или поступки.",
  "Конкретный ответ с неоднозначностью и теневой стороной. Нельзя автоматически оправдывать мужчину, но нельзя заранее обвинять его в плохом. Уместны неловкие, неприятные выводы, если это следует из сочетания. Разным парам день+месяц нужны РАЗНЫЕ трактовки.",
  "Текст должен отличаться по сюжету ОТ ДРУГИХ ВОПРОСОВ той же даты: вопрос о щедрости не про верность; вопрос о границах не про романтику. Не повторяй универсальный сюжет про страх близости, загруженность или закрытость.",
  "Первый абзац: 110–155 слов по сути вопроса, одна-две наблюдаемые иллюстрации в условном наклонении. Второй абзац: 35–65 слов, один честный практический ориентир ИЛИ мягкое предложение проверить другой конкретный вопрос из предоставленных вариантов. Ровно два абзаца, пустая строка между ними.",
  "Пиши живо, как опытный нумеролог и подруга. Никаких чисел, имён энергий, формул, заголовков, шаблонных вступлений, длинных тире, обилия кавычек, комплиментов ради утешения. Не копируй чужой текст.",
  "Нумерология является символической интерпретацией, а не доказательством характера, измены или действий мужчины. Нужна полезная трактовка, а не дисклеймер вместо ответа."
].join(" ");
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/health")
      return reply(200,{ok:true,service:"numerologia-redflag-draft-ai",version:VERSION,
        ai_bound:!!env.AI,owner_drafts_only:true,live_answers_enabled:false});
    if(request.method!=="POST"||!["/v1/draft","/v1/redflag-draft"].includes(url.pathname))
      return reply(404,{ok:false,error:"NOT_FOUND"});
    if(!env.AI)return reply(503,{ok:false,error:"AI_UNAVAILABLE"});
    if(!await serverProofValid(request.headers.get("X-Numi-Moment-Proof")))
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
      "День: "+day+"; месяц: "+month+"; совместный акцент: "+combined+"; напряжение: "+contrast+".",
      "Учитывай ИМЕННО эту комбинацию, включая обе светлые и теневые стороны, не делай ответ по одному числу.",
      "Особое требование категории: "+CATEGORY_RULES[input.category],
      "Для мягкой рекомендации можно использовать ТОЛЬКО эти вопросы: "+JSON.stringify(input.followups),
      "Если другие вопросы не подходят к теме, закончи наблюдаемой рекомендацией вместо продажи."
    ].join("\n");
    try{
      const modelResult=await env.AI.run(MODEL,{
        messages:[{role:"system",content:SYSTEM},{role:"user",content:user}],
        temperature:0.72,max_completion_tokens:850,
        chat_template_kwargs:{enable_thinking:false}
      });
      const answer=modelResult?.response??modelResult?.choices?.[0]?.message?.content;
      if(typeof answer!=="string"||answer.trim().length<380||answer.length>5200)
        return reply(503,{ok:false,error:"BAD_DRAFT"});
      return reply(200,{ok:true,draft_only:true,category:input.category,
        question_id:input.question_id,date_key:code,answer:answer.trim(),model:MODEL});
    }catch(error){
      console.error("REDFLAG_DRAFT_AI_ERROR",error?.name||"error");
      return reply(503,{ok:false,error:"GENERATION_UNAVAILABLE"});
    }
  }
};
