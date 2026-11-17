// Red Flag deliberately needs only day and month, with no birth-year dependence.
import { buildRelationshipProfile } from "./redflag-engine.js?v=4";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=flags-description-20261117";

// Paid content is rendered as text; do not interpret author-controlled paragraphs as HTML.
const escapeMarkup = value => String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]);

const home = document.querySelector("#home");
const redFlag = document.querySelector("#redflag");
const form = document.querySelector("#redflag-form");
const birthDateInput = document.querySelector("#redflag-birth-date");
const error = document.querySelector("#redflag-error");
const categoriesRoot = document.querySelector("#redflag-categories");
const backButton = document.querySelector("#back-redflag-home");

const categoryStates = new Map(REDFLAG_CATEGORIES.map((category) => [category.id, {
  expanded: false,
  loading: false,
  questions: null,
  activeQuestionId: null,
  answers: new Map(),
  answerRequests: new Map(),
  answerErrors: new Map()
}]));

// A single visible category also means a single expanded answer.
const collapseOtherCategories = (keepId) => {
  categoryStates.forEach((state, id) => {
    if (id === keepId) return;
    state.expanded = false;
    state.activeQuestionId = null;
  });
};

let activeProfile;
let formattedDate;

// Only the owner can see unpublished AI drafts INSIDE the regular Red Flag cards.
// The existing customer catalog, paid wallet and approved answer path are untouched.
const redflagDraftSections = new Set(["flags","infidelity","intimacy","family","language","verdict"]);
let ownerDraftAccess = false;
let ownerDraftAccessChecked = false;
const ownerDraftCache = new Map();
const ownerDraftBusy = new Set();
const ownerDraftFailures = new Map();
const ownerDraftKey = (category,id,day,month) =>
  category+"|"+id+"|"+day+"-"+month;

async function verifyOwnerDraftAccess() {
  if(ownerDraftAccessChecked)return;
  ownerDraftAccessChecked=true;
  try {
    const response=await fetch("/redflag-ai-lab/draft.php",{
      method:"GET",credentials:"same-origin",cache:"no-store",
      headers:{"Accept":"application/json"}
    });
    if(!response.ok)return;
    const result=await response.json();
    if(result?.ok!==true||result?.owner!==true||result?.draft_only!==true)return;
    ownerDraftAccess=true;
    if(redFlag.classList.contains("is-active"))renderCategories();
  }catch(_){/* Do not expose or enable drafts without owner verification. */}
}
window.addEventListener("numi:account-session-changed",()=>{
  ownerDraftAccess=false;ownerDraftAccessChecked=false;
  ownerDraftCache.clear();ownerDraftFailures.clear();ownerDraftBusy.clear();
  if(redFlag.classList.contains("is-active")) {
    renderCategories();
    void verifyOwnerDraftAccess();
  }
});
const appendOwnerDraftPanel = (article,question,state) => {
  if(!ownerDraftAccess||!activeProfile||!question.isComingSoon)return;
  const category=[...categoryStates].find(([,value])=>value===state)?.[0];
  if(!redflagDraftSections.has(category))return;
  const panel=document.createElement("details");
  panel.className="redflag-owner-ai";
  panel.style.cssText="margin:8px 12px 13px;padding:11px 12px;border:1px dashed #c8b798;border-radius:12px;background:#faf7f0;color:#204b3e;";
  const summary=document.createElement("summary");
  summary.textContent="✨ Создать ИИ-черновик (только владелец)";
  summary.style.cssText="font:700 14px/1.4 system-ui;cursor:pointer;";
  const controls=document.createElement("div");
  controls.style.cssText="padding-top:12px;display:flex;flex-wrap:wrap;gap:8px;";
  const one=document.createElement("button"),five=document.createElement("button");
  for(const [button,label] of [[one,"1 дата"],[five,"5 дат подряд"]]){
    button.type="button";
    button.textContent=label;
    button.style.cssText="padding:10px 12px;border:1px solid #bbc9bb;border-radius:10px;background:#fff;color:#184232;font:700 13px system-ui;cursor:pointer;";
    controls.append(button);
  }
  const status=document.createElement("p");
  status.setAttribute("role","status");status.style.cssText="margin:10px 0;font:13px/1.4 system-ui;color:#51645a";
  const results=document.createElement("div");
  const current=(day,month)=>ownerDraftCache.get(ownerDraftKey(category,question.id,day,month));
  const draw=()=>{
    results.replaceChildren();
    const input=parseRedFlagDate(birthDateInput.value);
    if(!input)return;
    const list=[...ownerDraftCache.values()].filter(item=>item.category===category&&item.question_id===question.id);
    for(const item of list){
      const heading=document.createElement("strong");
      heading.textContent="Дата "+item.date_key;
      heading.style.cssText="display:block;margin:13px 0 7px;font:750 14px system-ui;";
      const text=document.createElement("p");
      text.textContent=item.answer;
      text.style.cssText="white-space:pre-wrap;font:15px/1.55 system-ui;margin:0 0 12px;";
      results.append(heading,text);
    }
    if(list.length){
      const download=document.createElement("button");
      download.type="button";download.textContent="Скачать черновики JSON";
      download.style.cssText="margin-top:10px;padding:9px;border:1px solid #bda681;border-radius:10px;background:white;color:#234a39;";
      download.addEventListener("click",()=>{
        const data={schemaVersion:2,section:category,questionId:question.id,question:question.title,
          status:"draft",keyRule:"day-month",
          entries:Object.fromEntries(list.map(x=>[x.date_key,x.answer]))};
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"}));
        const link=document.createElement("a");link.href=url;
        link.download="redflag-draft-"+category+"-"+question.id+".json";
        document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
      });
      results.append(download);
    }
  };
  const generate=async(count)=>{
    const input=parseRedFlagDate(birthDateInput.value);
    if(!input){status.textContent="Сначала укажи дату рождения мужчины.";return;}
    const key=category+"|"+question.id;
    if(ownerDraftBusy.has(key))return;
    ownerDraftBusy.add(key);one.disabled=true;five.disabled=true;
    ownerDraftFailures.delete(key);
    let done=0;
    try{
      for(let i=0;i<count;i++){
        const date=new Date(Date.UTC(2000,input.month-1,input.day+i));
        const day=date.getUTCDate(),month=date.getUTCMonth()+1,date_key=day+"-"+month;
        status.textContent="Идёт расчёт "+(i+1)+" из "+count+" ("+date_key+")…";
        if(!current(day,month)){
          const response=await fetch("/redflag-ai-lab/draft.php",{
            method:"POST",credentials:"same-origin",cache:"no-store",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({category,question_id:question.id,day,month})
          });
          const data=await response.json();
          if(!response.ok||data.ok!==true||data.draft_only!==true
             ||data.category!==category||data.question_id!==question.id
             ||data.date_key!==date_key||typeof data.answer!=="string")
            throw new Error("ИИ не вернул черновик: "+String(data.error||response.status));
          ownerDraftCache.set(ownerDraftKey(category,question.id,day,month),data);
        }
        done++;
        draw();
      }
      status.textContent="Готово: "+done+" черновиков. Это не опубликованные ответы.";
    }catch(e){
      const message="Получено "+done+" из "+count+". "+String(e?.message||"Ошибка связи");
      ownerDraftFailures.set(key,message);
      status.textContent=message;
    }finally{
      ownerDraftBusy.delete(key);one.disabled=false;five.disabled=false;
    }
  };
  one.addEventListener("click",()=>void generate(1));
  five.addEventListener("click",()=>void generate(5));
  draw();
  panel.append(summary,controls,status,results);
  article.append(panel);
};


// One consistent deep link for Telegram mini-app question buttons.
// Example: ?view=redflag&question=love:honest-or-disappear
const deepLinkParams = new URLSearchParams(window.location.search);
const requestedQuestion = deepLinkParams.get("view") === "redflag"
  ? /^([a-z0-9-]+):([a-z0-9-]+)$/.exec(deepLinkParams.get("question") || "")
  : null;

const parseRedFlagDate = (value) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > new Date().getFullYear()) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { day, month, year };
};

// Share the exact currently calculated answer, not a second calculation.
// The server route reuses the verified sender used by "Личный расчёт дня".
const REDFLAG_SITE_URL = "https://xn----8sbhhqijddjgdebdz2c2o.xn--p1ai/?view=redflag";
const REDFLAG_BOT_URL = "https://t.me/Numerologiaonline_bot";
const REDFLAG_SAVE_URL = "/api/numi-save-answer.php";
const REDFLAG_TICKET_URL = "/api/redflag-save.php";
// The same ticket flow works both inside Telegram and in an ordinary browser.
const REDFLAG_SAVE_VIA_TICKET = true;
const formatRedFlagMessage = (question, response, dateOfBirth) => {
  const paragraphs = response.paragraphs ?? [response.answer];
  const parts = [
    "🚩 Мужчина или Red Flag",
    "Вопрос: " + question.title,
    "Дата рождения мужчины: " + dateOfBirth,
    ""
  ];
  if (response.verdict) parts.push(String(response.verdict).trim(), "");
  if (response.scales?.length) {
    parts.push(...response.scales.map(({ label, value }) =>
      String(label) + ": " + Math.max(0, Math.min(10, Math.round(Number(value) || 0))) + "/10"), "");
  }
  parts.push(...paragraphs.filter(text => typeof text === "string" && text.trim()).map(text => text.trim()));
  if (response.observation) parts.push("", "На что смотреть: " + response.observation);
  parts.push("", "✨ Нумерология Онлайн", "🌐 Сайт: " + REDFLAG_SITE_URL, "🤖 Бот: " + REDFLAG_BOT_URL);
  return parts.join("\n");
};

// Open verified Telegram ticket via Telegram API when available, else a normal link.
const openRedFlagTicket = (url) => {
  if (typeof window.Telegram?.WebApp?.openTelegramLink === "function") {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.location.assign(url);
  }
};

const addRedFlagShare = (answer, report) => {
  const controls = document.createElement("section");
  controls.className = "personal-day-share redflag-share";
  controls.setAttribute("aria-label", "Сохранить и поделиться ответом");
  const openedFromBot = Boolean(window.Telegram?.WebApp?.initData);
  controls.innerHTML = '<p class="personal-day-share-title">Не потеряй свой ответ ❤️</p>'
    + '<p class="personal-day-share-status">Чтобы не потерять разбор, сохрани его в нашем Telegram-боте. Сможешь перечитать в любой момент.</p>'
    + '<button type="button" class="personal-day-share-save">'
    + (openedFromBot ? '❤️ Сохранить ответ в Telegram' : '❤️ Сохранить мой ответ')
    + '</button>'
    + '<button type="button" class="personal-day-share-send">💌 Поделиться с подругой</button>'
    + '<div class="redflag-save-feedback" role="status" aria-live="polite" aria-atomic="true" hidden></div>';
  answer.append(controls);

  const save = controls.querySelector(".personal-day-share-save");
  const share = controls.querySelector(".personal-day-share-send");
  const feedback = controls.querySelector(".redflag-save-feedback");

  // Only show an extra bot link when browser delivery is impossible.
  // Success must follow a real {ok: true} response from the server.
  const showFeedback = (type, title, description, withBotLink = false) => {
    const heading = document.createElement("strong");
    heading.className = "redflag-save-feedback-title";
    heading.textContent = title;
    const detail = document.createElement("p");
    detail.textContent = description;
    feedback.className = "redflag-save-feedback " + type;
    feedback.replaceChildren(heading, detail);
    if (withBotLink) {
      const link = document.createElement("a");
      link.className = "redflag-save-feedback-link";
      link.href = REDFLAG_BOT_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Открыть Telegram-бота →";
      feedback.append(link);
    }
    feedback.hidden = false;
  };

  let preparedBotLink = null;
  save.addEventListener("click", async () => {
    if (preparedBotLink) {
      openRedFlagTicket(preparedBotLink);
      return;
    }
    const signedData = window.Telegram?.WebApp?.initData;
    if (report.length > 3800) {
      showFeedback("is-error",
        "⚠️ Не удалось сохранить",
        "Этот ответ слишком длинный для одного сообщения Telegram.");
      return;
    }

    if (REDFLAG_SAVE_VIA_TICKET || typeof signedData !== "string" || !signedData) {
      save.disabled = true;
      showFeedback("is-pending", "Готовим ссылку для сохранения…", "Ответ остаётся на этой странице. Подожди немного.");
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 14000);
        let response;
        try {
          response = await fetch(REDFLAG_TICKET_URL, {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create", text: report }),
            signal: controller.signal
          });
        } finally {
          window.clearTimeout(timer);
        }
        const data = await response.json();
        if (!response.ok || data?.ok !== true || !/^r_[A-Za-z0-9_-]{32}$/.test(data?.ticket || "")) {
          throw new Error("TICKET_CREATE_FAILED_" + String(data?.error || response.status).replace(/[^A-Z0-9_]/g, "").slice(0,50));
        }
        preparedBotLink = REDFLAG_BOT_URL + "?start=" + encodeURIComponent(data.ticket);
        save.textContent = "🤖 Открыть бота с ответом";
        save.disabled = false;
        showFeedback("is-success", "❤️ Твой ответ отправлен!",
          "Если сообщение не пришло, открой нашего Telegram-бота по кнопке выше и нажми «Начать».");
        openRedFlagTicket(preparedBotLink);
      } catch (error) {
        save.disabled = false;
        const code = String(error?.message || "NETWORK_ERROR").replace(/[^A-Za-z0-9_]/g, "").slice(0,65) || "NETWORK_ERROR";
        showFeedback("is-error", "Не удалось подготовить сохранение",
          "Ответ остаётся на странице. Код: " + code + ".");
      }
      return;
    }

    save.disabled = true;
    showFeedback("is-pending", "Сохраняем ответ…", "Пожалуйста, подождите.");
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 14000);
      let response;
      try {
        response = await fetch(REDFLAG_SAVE_URL, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: signedData, text: report }),
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timer);
      }
      const data = await response.json();
      if (!response.ok || data?.ok !== true) throw new Error(data?.error || "DELIVERY_FAILED");
      save.textContent = "✓ Ответ сохранён";
      showFeedback("is-success",
        "✅ Ответ сохранён в боте!",
        "Ты сможешь перечитать его в любой момент ❤️");
    } catch (error) {
      save.disabled = false;
      const reconnectErrors = new Set([
        "INIT_DATA_MISSING", "INIT_DATA_FORMAT", "SESSION_EXPIRED",
        "SIGNATURE_MISMATCH", "USER_NOT_PRESENT", "BOT_CHAT_UNAVAILABLE",
        "ORIGIN_NOT_ALLOWED"
      ]);
      if (reconnectErrors.has(error?.message)) {
        showFeedback("is-error",
          "⚠️ Не удалось сохранить",
          "Открой сайт через нашего Telegram-бота и попробуй снова.",
          true);
      } else {
        showFeedback("is-error",
          "⚠️ Не удалось сохранить",
          "Попробуйте ещё раз.");
      }
    }
  });

  share.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Мужчина или Red Flag", text: report });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const shareLink = "https://t.me/share/url?url=" + encodeURIComponent(REDFLAG_SITE_URL)
      + "&text=" + encodeURIComponent(report);
    if (typeof window.Telegram?.WebApp?.openTelegramLink === "function") {
      window.Telegram.WebApp.openTelegramLink(shareLink);
    } else {
      window.location.assign(shareLink);
    }
  });
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
  birthDateInput.setAttribute("aria-invalid", "true");
};

const clearError = () => {
  error.hidden = true;
  birthDateInput.removeAttribute("aria-invalid");
};

// Resolve only the opened question. Cache its result for this calculated date.
// Paid questions are opened IN PLACE; never send the reader into a cart.
// Publication state comes from the approved material catalogue, not a per-section switch.
const ensureAnswer = (question, state) => {
  if(question.isComingSoon)return;
  const id=question.id;
  if(state.answers.has(id)||state.answerRequests.has(id))return;
  const profile=activeProfile;
  if(!profile)return;
  state.answerErrors.delete(id);
  if(!question.isFree){
    const category=[...categoryStates].find(([,value])=>value===state)?.[0];
    const item={product_code:"redflag_question",category,question_id:id,
      birth_date:birthDateInput.value.split(".").reverse().join("-")};
    const article=[...categoriesRoot.querySelectorAll(".redflag-question")]
      .find(node=>node.dataset.questionId===id);
    const target=article?.querySelector(".redflag-answer");
    if(!category||!target){state.answerErrors.set(id,"Не удалось проверить вопрос. Откройте его ещё раз.");return;}
    const task=import("./wallet-client.js?v=fast-redflag-owner-20261117").then(({showInlinePurchase})=>
      showInlinePurchase(item,target,(material)=>{
        if(activeProfile!==profile)return;
        const paragraphs=(material.sections||[]).flatMap(section=>(section.paragraphs||[])
          .flatMap(text=>String(text).split(/\n\s*\n/).map(part=>part.trim()).filter(Boolean)));
        if(!paragraphs.length){
          state.answerErrors.set(id,"Материал пока недоступен.");
          if(target.isConnected) target.textContent="Материал пока недоступен.";
          return;
        }
        state.answers.set(id,{answer:paragraphs.join("\n"),paragraphs});
        renderCategories({type:"question",id});
      }));
    state.answerRequests.set(id,task);
    void task.catch(()=>{
      if(profile===activeProfile){
        state.answerErrors.set(id,"Не удалось загрузить ответ. Попробуйте ещё раз.");
        if(target.isConnected) target.textContent="Не удалось загрузить ответ. Попробуйте ещё раз.";
      }
    }).finally(()=>{if(state.answerRequests.get(id)===task)state.answerRequests.delete(id);});
    return;
  }
  // First question in each published category remains genuinely free.
  const task=Promise.resolve().then(()=>question.answer(profile));
  state.answerRequests.set(id,task);
  void task.then(response=>{
    if(profile===activeProfile)state.answers.set(id,response);
  },()=>{
    if(profile===activeProfile)state.answerErrors.set(id,"Не удалось загрузить ответ. Откройте вопрос ещё раз.");
  }).finally(()=>{
    if(state.answerRequests.get(id)===task)state.answerRequests.delete(id);
    if(profile===activeProfile&&state.expanded&&state.activeQuestionId===id)
      renderCategories({type:"question",id});
  });
};

// Prices are explicit pairs: keep the agreed 39/19 and 79/39 rounding.
// Do not infer club status from a badge, email, or local storage.
let activeClubMember=null; // null = guest / status not yet verified.
async function refreshClubPrices(){
  let next=null;
  try{
    const response=await fetch("/api/numi-account.php",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"wallet_status"})
    });
    if(response.ok){
      const data=await response.json();
      if(data.ok===true&&typeof data.club_active==="boolean")next=data.club_active;
    }
  }catch(_){/* A missing session must never advertise membership as active. */}
  activeClubMember=next;
  // Update the existing small price badges in place; preserve expanded questions.
  categoriesRoot.querySelectorAll(".redflag-price-pair").forEach(pair=>{
    const regular=pair.querySelector(".redflag-question-price");
    const caption=pair.querySelector(".redflag-subscription-price span");
    if(caption)caption.textContent=activeClubMember===true?"Ваша цена":"По подписке";
    if(regular&&regular.dataset.regular)regular.textContent=
      (activeClubMember===true?"Обычно ":"")+regular.dataset.regular+" ₽";
  });
}
window.addEventListener("numi:wallet-updated",()=>{void refreshClubPrices();});
window.addEventListener("numi:account-session-changed",()=>{void refreshClubPrices();});
void refreshClubPrices();

const REDFLAG_PRICE_PAIRS = {
  10: { regular: 20, subscription: 10 },
  29: { regular: 39, subscription: 19 },
  49: { regular: 79, subscription: 39 }
};
const priceStyles = document.createElement("style");
priceStyles.id = "redflag-subscription-prices-20261102";
priceStyles.textContent = `
  #redflag .redflag-price-pair {
    display: flex; flex: 0 0 auto; flex-direction: column;
    align-items: flex-end; gap: 5px; max-width: 110px;
  }
  #redflag .redflag-price-pair .redflag-question-price {
    display: block; padding: 6px 10px; font-size: 14px;
    line-height: 1.1; font-weight: 750;
  }
  #redflag .redflag-price-pair .redflag-subscription-price {
    display: flex; flex-direction: column; align-items: center;
    gap: 2px; padding: 5px 8px; border: 1px solid #943c65;
    border-radius: 14px; background: #943c65; color: #fff;
    box-shadow: 0 3px 8px rgba(148,60,101,.2);
    font-size: 10px; font-weight: 750; line-height: 1.15;
    white-space: nowrap;
  }
  #redflag .redflag-subscription-price strong {
    color: inherit; font-size: 16px; font-weight: 900; line-height: 1;
  }
  @media (max-width: 360px) {
    #redflag .redflag-price-pair { max-width: 88px; }
    #redflag .redflag-price-pair .redflag-subscription-price { padding: 6px 7px; }
  }
`;
document.head.append(priceStyles);

// Render both rates without fetching paid answer content.
const fillQuestionButton = (button, question, showExpand = false) => {
  const label = document.createElement("span");
  label.className = "redflag-question-label";
  label.textContent = question.title;
  button.append(label);
  if (question.isComingSoon) {
    const badge = document.createElement("span");
    badge.className = "redflag-question-price";
    badge.style.alignSelf = "flex-start";
    badge.textContent = "Скоро";
    button.append(badge);
    return;
  }
  if (question.isFree) {
    const free = document.createElement("span");
    free.className = "redflag-question-price is-free";
    free.textContent = "БЕСПЛАТНО";
    button.append(free);
  } else if (Number.isInteger(question.priceRub)) {
    const rates = REDFLAG_PRICE_PAIRS[question.priceRub];
    const pair = document.createElement("span");
    pair.className = "redflag-price-pair";
    const price = document.createElement("span");
    price.className = "redflag-question-price";
    price.dataset.regular = String(rates ? rates.regular : question.priceRub);
    price.textContent = (activeClubMember===true ? "Обычно " : "")+
      price.dataset.regular+" ₽";
    pair.append(price);
    if (rates) {
      const subscription = document.createElement("span");
      subscription.className = "redflag-subscription-price";
      const caption = document.createElement("span");
      caption.textContent = activeClubMember===true ? "Ваша цена" : "По подписке";
      const amount = document.createElement("strong");
      amount.textContent = rates.subscription + " ₽";
      subscription.append(caption, amount);
      pair.append(subscription);
    }
    button.append(pair);
  }
  if (showExpand) {
    const plus = document.createElement("b");
    plus.setAttribute("aria-hidden", "true");
    plus.textContent = "+";
    button.append(plus);
  }
};

const createQuestion = (question, state) => {
  const opened = !question.isComingSoon && state.activeQuestionId === question.id;
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}${activeProfile ? " is-calculated" : " is-preview"}`;
  article.dataset.questionId = question.id;

  if (!activeProfile) {
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "redflag-question-toggle redflag-question-preview";
    preview.disabled = Boolean(question.isComingSoon);
    fillQuestionButton(preview, question);
    preview.addEventListener("click", () => {
      const date = parseRedFlagDate(birthDateInput.value);
      if (!date) {
        showError("Введите дату рождения мужчины в формате ДД.ММ.ГГГГ.");
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      activeProfile = buildRelationshipProfile(date);
      formattedDate = birthDateInput.value;
      state.activeQuestionId = question.id;
      clearError();
      renderCategories({ type: "question", id: question.id });
      ensureAnswer(question, state);
    });
    article.append(preview);
    return article;
  }

  const response = state.answers.get(question.id);
  const button = document.createElement("button");
  button.className = "redflag-question-toggle";
  button.type = "button";
  button.disabled = Boolean(question.isComingSoon);
  button.setAttribute("aria-expanded", String(opened));
  fillQuestionButton(button, question, true);

  const answer = document.createElement("div");
  answer.className = "redflag-answer";
  answer.hidden = !opened;
  if (opened && response) {
    const paragraphs = response.paragraphs ?? [response.answer];
    const scales = (response.scales ?? []).map(({ label, value }) => ({
      label,
      value: Math.max(0, Math.min(10, Math.round(Number(value) || 0)))
    }));
    const scalesMarkup = scales.length ? `
    <div class="redflag-scales" aria-label="Шкалы ответа">
      ${scales.map(({ label, value }) => `
        <div class="redflag-scale">
          <div class="redflag-scale-label"><span>${escapeMarkup(label)}</span><strong>${value}/10</strong></div>
          <div class="redflag-scale-track" aria-hidden="true"><i style="width: ${value * 10}%"></i></div>
        </div>`).join("")}
    </div>` : "";
    const verdictMarkup = response.verdict
      ? `<p class="redflag-verdict">${escapeMarkup(response.verdict)}</p>` : "";
    const observationMarkup = response.observation
      ? `<p class="redflag-observation"><strong>На что смотреть:</strong> ${escapeMarkup(response.observation)}</p>` : "";
    answer.innerHTML = `
    ${verdictMarkup}
    ${scalesMarkup}
    ${paragraphs.map((paragraph) => `<p>${escapeMarkup(paragraph)}</p>`).join("")}
    ${observationMarkup}`;
    addRedFlagShare(answer, formatRedFlagMessage(question, response, formattedDate));
  } else if (opened) {
    const waiting = document.createElement("p");
    waiting.className = "redflag-loading";
    waiting.setAttribute("role", "status");
    waiting.textContent = state.answerErrors.get(question.id)
      || (question.isFree ? "Загружаем ответ…" : "Проверяем доступ к ответу…");
    answer.append(waiting);
  }

  // Open immediately. Do not remove a focused button after a delayed timer:
  // mobile Safari and Telegram can scroll to the browser's abandoned focus.
  button.addEventListener("click", () => {
    button.blur();
    state.activeQuestionId = opened ? null : question.id;
    renderCategories({ type: "question", id: question.id });
    if (!opened) ensureAnswer(question, state);
  });

  article.append(button, answer);
  appendOwnerDraftPanel(article,question,state);
  return article;
};

const ensureQuestions = async (category) => {
  const state = categoryStates.get(category.id);
  if (state.questions || state.loading) return;

  state.loading = true;
  renderCategories({ type: "category", id: category.id });
  try {
    const content = await category.load();
    // Only published catalog items exist. Never invent a separate paid
    // question or a price inside the accordion.
    state.questions = content.QUESTIONS.map((question, index) => ({
      ...question, isFree: index === 0,
      priceRub: index === 0 ? 0 : question.priceRub,
      isComingSoon: question.status !== "ready"
    }));
  } finally {
    state.loading = false;
    renderCategories({ type: "category", id: category.id });
  }
};

const createCategory = (category, index) => {
  const state = categoryStates.get(category.id);
  const section = document.createElement("section");
  section.className = `redflag-category${state.expanded ? " is-open" : ""}`;

  const toggle = document.createElement("button");
  toggle.className = "redflag-category-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(state.expanded));
  const questionCount = state.questions?.length ?? category.questionCount;
  toggle.innerHTML = `<span><small class="redflag-category-index">Блок ${index + 1} · ${questionCount} вопросов</small><strong>${category.title}</strong>${category.id === "intimacy" ? '<span class="redflag-age-label" aria-label="Для взрослых, 18 плюс">18+</span>' : ""}<small class="redflag-category-count">${questionCount} вопросов</small><em>${category.description}</em></span><b aria-hidden="true">+</b>`;
  toggle.addEventListener("click", () => {
    const opening = !state.expanded;
    if (opening) collapseOtherCategories(category.id);
    state.expanded = opening;
    if (!opening) state.activeQuestionId = null;
    toggle.blur();
    renderCategories({ type: "category", id: category.id });
    if (opening) ensureQuestions(category);
  });
  section.append(toggle);

  if (!state.expanded) return section;

  const content = document.createElement("div");
  content.className = "redflag-category-content";

  if (state.loading) {
    const loading = document.createElement("p");
    loading.className = "redflag-loading";
    loading.textContent = ""; 
    loading.classList.add("redflag-loading-dots");
    loading.setAttribute("aria-label", "Загрузка вопросов");
    content.append(loading);
  } else if (state.questions) {
    if (activeProfile) {
      const note = document.createElement("p");
      note.className = "redflag-ready-note";
      note.textContent = `Расчёт для ${formattedDate} готов. Откройте вопрос — внутри будет персональный ответ.`;
      content.append(note);
    }

    const questions = document.createElement("div");
    questions.className = "redflag-questions";
    questions.setAttribute("aria-label", `Вопросы: ${category.title}`);
    questions.append(...state.questions.map((question) => createQuestion(question, state)));
    content.append(questions);
  }

  section.append(content);
  return section;
};

// Only the tapped question (and the previously opened one) is updated.
// Rebuilding the whole accordion destroys mobile Safari's scroll anchor.
const repaintOnlyQuestions = (questionId) => {
  const index = REDFLAG_CATEGORIES.findIndex(category => {
    const state = categoryStates.get(category.id);
    return state.expanded && state.questions?.some(question => question.id === questionId);
  });
  if (index < 0) return false;
  const category = REDFLAG_CATEGORIES[index];
  const state = categoryStates.get(category.id);
  const cards = [...categoriesRoot.children[index].querySelectorAll(".redflag-question")];
  if (cards.length !== state.questions.length) return false;
  const records = new Map(state.questions.map(question => [question.id, question]));
  if (!cards.every(card => records.has(card.dataset.questionId))) return false;
  // Keep the existing article nodes. Replacing a tapped card removes Safari's
  // scroll anchor, which can jump the page when a longer answer opens.
  for (const card of cards) {
    const question = records.get(card.dataset.questionId);
    const shouldOpen = !question.isComingSoon && state.activeQuestionId === question.id;
    if (question.id === questionId || card.classList.contains("is-open") !== shouldOpen) {
      const updated = createQuestion(question, state);
      card.className = updated.className;
      card.replaceChildren(...updated.childNodes);
    }
  }
  return true;
};
const renderCategories = (anchor = null) => {
  // Anchor to the exact card the person tapped, not the page bottom.
  // Correct only actual layout movement; never scroll to an answer automatically.
  const index = anchor?.type === "category"
    ? REDFLAG_CATEGORIES.findIndex(category => category.id === anchor.id)
    : -1;
  const anchorNode = anchor?.type === "question"
    ? [...categoriesRoot.querySelectorAll(".redflag-question")]
        .find(card => card.dataset.questionId === anchor.id)
    : (index >= 0 ? categoriesRoot.children[index]?.querySelector(".redflag-category-toggle") : null);
  const beforeTop = anchorNode?.getBoundingClientRect().top;
  const preserve = Number.isFinite(beforeTop)
    && beforeTop > -100 && beforeTop < window.innerHeight + 100;
  const stabilize = () => {
    if (!preserve || !anchorNode?.isConnected) return;
    const difference = anchorNode.getBoundingClientRect().top - beforeTop;
    if (Math.abs(difference) > 1)
      window.scrollTo({ top: Math.max(0, window.scrollY + difference), behavior: "instant" });
  };
  if (categoriesRoot.children.length !== REDFLAG_CATEGORIES.length) {
    categoriesRoot.replaceChildren(...REDFLAG_CATEGORIES.map(createCategory));
    stabilize();
    return;
  }
  if (anchor?.type === "question" && repaintOnlyQuestions(anchor.id)) {
    stabilize();
    return;
  }
  REDFLAG_CATEGORIES.forEach((category, index) => {
    const element = categoriesRoot.children[index];
    const state = categoryStates.get(category.id);
    const needsUpdate = element.classList.contains("is-open") !== state.expanded
      || (anchor?.type === "category" && anchor.id === category.id)
      || (anchor?.type === "question" && state.questions?.some((q) => q.id === anchor.id))
      || (anchor === null && state.expanded);
    if (needsUpdate) element.replaceWith(createCategory(category, index));
  });
  // A category replacement may change the node identity; use its new heading.
  if (anchor?.type === "category" && preserve) {
    const heading = categoriesRoot.children[index]?.querySelector(".redflag-category-toggle");
    if (heading) {
      const difference = heading.getBoundingClientRect().top - beforeTop;
      if (Math.abs(difference) > 1)
        window.scrollTo({ top: Math.max(0, window.scrollY + difference), behavior: "instant" });
    }
  } else stabilize();
};

birthDateInput.addEventListener("input", () => {
  const digits = birthDateInput.value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  birthDateInput.value = parts.join(".");
  clearError();
  if (activeProfile) {
    activeProfile = undefined;
    formattedDate = undefined;
    for (const state of categoryStates.values()) {
      state.activeQuestionId = null;
      state.answers.clear();
      state.answerRequests.clear();
      state.answerErrors.clear();
    }
    renderCategories();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = parseRedFlagDate(birthDateInput.value);
  if (!date) {
    showError(birthDateInput.value.trim()
      ? "Введите существующую дату в формате ДД.ММ.ГГГГ."
      : "Введите дату рождения мужчины.");
    birthDateInput.focus();
    return;
  }

  try {
    activeProfile = buildRelationshipProfile(date);
    formattedDate = birthDateInput.value;
    for (const state of categoryStates.values()) {
      state.answers.clear();
      state.answerRequests.clear();
      state.answerErrors.clear();
    }
    const linkedCategory = requestedQuestion
      ? REDFLAG_CATEGORIES.find((category) => category.id === requestedQuestion[1])
      : null;
    const firstCategory = linkedCategory || REDFLAG_CATEGORIES[0];
    const firstState = categoryStates.get(firstCategory.id);
    collapseOtherCategories(firstCategory.id);
    firstState.expanded = true;
    await ensureQuestions(firstCategory);
    for (const state of categoryStates.values()) state.activeQuestionId = null;
    // Keep a directly linked question selected after the date is entered.
    const linkedQuestion = linkedCategory
      ? firstState.questions?.find((question) => question.id === requestedQuestion[2])
      : null;
    if (linkedQuestion) {
      firstState.activeQuestionId = linkedQuestion.id;
      ensureAnswer(linkedQuestion, firstState);
    }
    clearError();
    renderCategories();
  } catch {
    showError("Не удалось подготовить вопросы. Обновите страницу и попробуйте ещё раз.");
  }
});

backButton.addEventListener("click", () => {
  redFlag.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

export const openRedFlag = () => {
  home.classList.remove("is-active");
  redFlag.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
  renderCategories();
  void verifyOwnerDraftAccess();

  // A broadcast deep link opens the exact named question, not just the section.
  // Date input remains optional until the question is actually requested.
  const category = requestedQuestion
    ? REDFLAG_CATEGORIES.find((item) => item.id === requestedQuestion[1])
    : null;
  if (category) {
    const state = categoryStates.get(category.id);
    collapseOtherCategories(category.id);
    state.expanded = true;
    renderCategories();
    void ensureQuestions(category).then(() => {
      const question = state.questions?.find((item) => item.id === requestedQuestion[2]);
      if (!question) return;
      state.activeQuestionId = question.id;
      renderCategories();
      const article = [...categoriesRoot.querySelectorAll("[data-question-id]")]
        .find((item) => item.dataset.questionId === question.id);
      article?.scrollIntoView({ behavior: "smooth", block: "center" });
    }).catch(() => { /* The normal category UI still permits manual selection. */ });
  } else {
    window.setTimeout(() => birthDateInput.focus(), 220);
  }
};
