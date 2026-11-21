// Red Flag deliberately needs only day and month, with no birth-year dependence.
import { buildRelationshipProfile } from "./redflag-engine.js?v=4";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=flags-owner-preview-20261117";

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

// The regular Red Flag accordion remains the only interface for answers.
// Unfinished questions receive an on-demand AI test answer ONLY after verified
// owner authorization. Neither customer paid access nor published banks change.
const redflagDraftSections = new Set(["flags","infidelity","intimacy","family","language","verdict"]);
let ownerDraftAccess=false,ownerDraftAccessChecked=false;
const ownerDraftInScope=(question,state)=>{
  const section=[...categoryStates].find(([,entry])=>entry===state)?.[0];
  return Boolean(question.isComingSoon&&ownerDraftAccess&&redflagDraftSections.has(section));
};
async function verifyOwnerDraftAccess(){
  if(ownerDraftAccessChecked)return;
  ownerDraftAccessChecked=true;
  try{
    const response=await fetch("/redflag-ai-lab/style-test-api.php",{
      method:"GET",credentials:"same-origin",cache:"no-store",
      headers:{"Accept":"application/json"}
    });
    if(!response.ok)return;
    const data=await response.json();
    if(data?.ok!==true||data?.owner!==true||data?.draft_only!==true)return;
    ownerDraftAccess=true;
    if(redFlag.classList.contains("is-active"))renderCategories();
  }catch(_){/* Unverified users never see draft generation. */}
}
window.addEventListener("numi:account-session-changed",()=>{
  ownerDraftAccess=false;ownerDraftAccessChecked=false;
  for(const state of categoryStates.values()){
    for(const [id,response] of state.answers)
      if(response?.isDraft)state.answers.delete(id);
    state.activeQuestionId=null;
  }
  if(redFlag.classList.contains("is-active")){
    renderCategories();
    void verifyOwnerDraftAccess();
  }
});

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

// This is the same button for every visitor, not an owner-only control.
const checkManButton = form.querySelector(".redflag-submit");
const checkManLabel = checkManButton.querySelector(".redflag-submit-label");
const checkManArrow = checkManButton.querySelector(".redflag-submit-arrow");
const syncCheckManButton = () => {
  const valid = Boolean(parseRedFlagDate(birthDateInput.value));
  checkManLabel.textContent = valid ? "Проверить мужчину" : "Введите дату";
  checkManArrow.hidden = !valid;
};
syncCheckManButton();

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
const ensureAnswer = (question, state, {forceNew = false} = {}) => {
  if(question.isComingSoon&&!ownerDraftInScope(question,state))return;
  const id=question.id;
  if(state.answers.has(id)||state.answerRequests.has(id))return;
  const profile=activeProfile;
  if(!profile)return;
  state.answerErrors.delete(id);
  // The FIRST free Red Flag question is AI-generated for ALL visitors.
  // This is deliberately before owner-only test drafts and before paid access.
  // Never fall back to the three old generic teaser variants.
  if(question.isFree&&id==="say-no"&&!ownerDraftInScope(question,state)&&[...categoryStates].some(
    ([category,entry])=>category==="flags"&&entry===state)){
    const birthday=parseRedFlagDate(birthDateInput.value);
    if(!birthday){
      state.answerErrors.set(id,"Укажи дату рождения мужчины.");
      renderCategories({type:"question",id});
      return;
    }
    const dateKey=birthday.day+"-"+birthday.month;
    const task=fetch("/api/redflag-free-ai.php",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({question_id:"say-no",day:birthday.day,month:birthday.month}),
      signal:AbortSignal.timeout(100000)
    }).then(async response=>{
      const data=await response.json();
      if(!response.ok||data?.ok!==true||data?.free!==true||
        data?.ai_generated!==true||data?.question_id!=="say-no"||
        data?.date_key!==dateKey||typeof data?.answer!=="string"||
        data.answer.length<450||data.answer.length>1900)
        throw new Error("FREE_AI_UNAVAILABLE");
      const paragraphs=data.answer.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
      if(paragraphs.length!==2)throw new Error("INVALID_PARAGRAPHS");
      if(profile!==activeProfile)return;
      state.answers.set(id,{answer:data.answer,paragraphs});
    }).catch(()=>{
      if(profile===activeProfile)
        state.answerErrors.set(id,"Ответ временно не загрузился. Нажми на вопрос ещё раз.");
    }).finally(()=>{
      if(state.answerRequests.get(id)===task)state.answerRequests.delete(id);
      if(profile===activeProfile&&state.expanded&&state.activeQuestionId===id)
        renderCategories({type:"question",id});
    });
    state.answerRequests.set(id,task);
    return;
  }
  if(ownerDraftInScope(question,state)){
    const category=[...categoryStates].find(([,value])=>value===state)?.[0];
    const birth=parseRedFlagDate(birthDateInput.value);
    if(!birth){state.answerErrors.set(id,"Укажи дату рождения мужчины.");return;}
    const task=(async()=>{
      // Always request a fresh AI response for a test question. Previously
      // kept editor drafts stay safely on the server and can be opened via
      // the separate "Показать сохранённое" control.
      const response=await fetch("/redflag-ai-lab/style-test-api.php",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({category,question_id:id,day:birth.day,month:birth.month,
          ...(category==="flags"&&id==="care-or-control"?{}:{year:birth.year})}),
        signal:AbortSignal.timeout(125000)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.ok!==true)
        throw new Error(String(data?.error||"SERVICE_UNAVAILABLE"));
      if(data?.draft_only!==true||data?.category!==category||
         data?.question_id!==id||data?.date_key!==birth.day+"-"+birth.month||
         typeof data?.answer!=="string")
        throw new Error("DRAFT_UNAVAILABLE");
      if(profile!==activeProfile||!ownerDraftAccess)return;
      state.answers.set(id,{answer:data.answer,isDraft:true,isSaved:false});
    })().catch(error=>{
      if(profile===activeProfile&&ownerDraftAccess){
        const code=String(error?.message||"");
        const message=code==="WAIT_15_SECONDS"
          ?"Повторный запрос пока рано. Подожди 15 секунд и открой вопрос снова."
          :code==="INVALID_FULL_BIRTH_DATE"?"Не удалось передать дату рождения. Проверь дату."
          :code==="PROVIDER_TIMEOUT"||error?.name==="TimeoutError"
            ?"Gemini не успела ответить. Деньги не списаны. Попробуй снова."
          :code.startsWith("PROVIDER_HTTP_")
            ?"Cloud.ru вернул ошибку "+code.replace("PROVIDER_HTTP_","HTTP ")+". Деньги не списаны."
          :code==="KEY_NOT_CONFIGURED"?"Ключ Cloud.ru не настроен. Нужна проверка подключения."
          :code==="PROVIDER_NETWORK_ERROR"?"Cloud.ru сейчас недоступен по сети. Попробуй снова."
          :"ИИ-ответ не загрузился ("+(code||"SERVICE_UNAVAILABLE")+"). Деньги не списаны.";
        state.answerErrors.set(id,message);
      }
    }).finally(()=>{
      if(state.answerRequests.get(id)===task)state.answerRequests.delete(id);
      if(profile===activeProfile&&state.expanded&&state.activeQuestionId===id)
        renderCategories({type:"question",id});
    });
    state.answerRequests.set(id,task);
    return;
  }
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
const fillQuestionButton = (button, question, showExpand = false, state = null) => {
  const label = document.createElement("span");
  label.className = "redflag-question-label";
  label.textContent = question.title;
  button.append(label);
  if (question.isComingSoon) {
    const badge = document.createElement("span");
    badge.className = "redflag-question-price";
    badge.style.alignSelf = "flex-start";
    const isOwnerDraft=state!==null&&ownerDraftInScope(question,state);
    badge.textContent = isOwnerDraft ? "ИИ · тест" : "Скоро";
    button.append(badge);
    if (isOwnerDraft&&showExpand) {
      const plus=document.createElement("b");
      plus.setAttribute("aria-hidden","true");plus.textContent="+";
      button.append(plus);
    }
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

// Purely editorial first-question experiment IN the Telegram mini-app.
// Only a verified owner sees it. Customer free content is unchanged.
const ownerStyleTrialStates=new Map();
const addOwnerStyleTrial=(target)=>{
  const birth=parseRedFlagDate(birthDateInput.value);
  if(!birth)return;
  const key=birth.day+"-"+birth.month;
  const draft=ownerStyleTrialStates.get(key)||{answer:"",loading:false,error:""};
  const panel=document.createElement("section");
  panel.style.cssText="padding:14px;margin:0 0 16px;border:1px solid #cbb6c0;border-radius:14px;background:#faf5f7;";
  const header=document.createElement("p");
  header.style.cssText="margin:0 0 8px;font-weight:750;color:#6b4157;";
  header.textContent="🧪 Новый ИИ. Только для тебя, клиентам не видно.";
  const help=document.createElement("p");
  help.style.cssText="font-size:13px;margin:0 0 10px;color:#75606b;";
  help.textContent="Проверяем новую инструкцию. Ниже показан прежний клиентский ответ, его пока не меняли.";
  const go=document.createElement("button");
  go.type="button";
  go.textContent=draft.answer?"↻ Другой вариант ИИ":"✨ Проверить новую инструкцию";
  go.disabled=draft.loading;
  go.style.cssText="background:#493141;color:white;border:0;border-radius:11px;padding:10px 14px;font:600 14px/1.4 system-ui;";
  const output=document.createElement("p");
  output.setAttribute("role","status");
  output.style.cssText="margin:12px 0 0;white-space:pre-wrap;font-size:15px;line-height:1.6;";
  output.textContent=draft.loading?"ИИ готовит ответ…":draft.error||draft.answer;
  panel.append(header,help,go,output);
  target.prepend(panel);
  go.addEventListener("click",async()=>{
    const current=ownerStyleTrialStates.get(key);
    if(current?.loading)return;
    const trial={answer:current?.answer||"",loading:true,error:""};
    ownerStyleTrialStates.set(key,trial);
    go.disabled=true;
    output.textContent="ИИ готовит новый ответ…";
    try{
      const response=await fetch("/redflag-ai-lab/style-test-api.php",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({question_id:"say-no",day:birth.day,month:birth.month}),
        signal:AbortSignal.timeout(110000)
      });
      const data=await response.json();
      if(!response.ok||data?.ok!==true||data?.style_test!==true||
        data?.published!==false||data?.draft_only!==true||
        data?.question_id!=="say-no"||data?.date_key!==key||
        typeof data?.answer!=="string"||data.answer.length<420||data.answer.length>1800)
        throw new Error("STYLE_TRIAL_UNAVAILABLE");
      trial.answer=data.answer;
      output.textContent=data.answer;
      go.textContent="↻ Другой вариант ИИ";
    }catch(_){
      trial.error="Новый ИИ-ответ не получен. Попробуй ещё раз.";
      output.textContent=trial.error;
    }finally{
      trial.loading=false;go.disabled=false;
    }
  });
};

const createQuestion = (question, state) => {
  const opened = (!question.isComingSoon || ownerDraftInScope(question,state)) && state.activeQuestionId === question.id;
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}${activeProfile ? " is-calculated" : " is-preview"}`;
  article.dataset.questionId = question.id;

  if (!activeProfile) {
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "redflag-question-toggle redflag-question-preview";
    preview.disabled = Boolean(question.isComingSoon&&!ownerDraftInScope(question,state));
    fillQuestionButton(preview, question, false, state);
    preview.addEventListener("click", () => {
      const date = parseRedFlagDate(birthDateInput.value);
      if (!date) {
        showError("Введите дату рождения мужчины в формате ДД.ММ.ГГГГ.");
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
  button.disabled = Boolean(question.isComingSoon&&!ownerDraftInScope(question,state));
  button.setAttribute("aria-expanded", String(opened));
  fillQuestionButton(button, question, true, state);

  const answer = document.createElement("div");
  answer.className = "redflag-answer";
  answer.hidden = !opened;
  if (opened && response) {
    if(response.isDraft){
      const note=document.createElement("p");
      note.className="redflag-owner-ai-label";
      note.textContent=response.isSaved
        ?"📂 Сохранённый черновик. Не новый ответ ИИ. Клиентам не видно."
        :"✨ Новый ИИ-ответ для проверки. Только тебе, не опубликован.";
      note.style.cssText="margin:4px 0 12px;font:750 13px/1.5 system-ui;color:#91683b";
      const text=document.createElement("p");
      text.textContent=response.answer;
      text.style.whiteSpace="pre-wrap";
      answer.append(note,text);
      // Editing and saving are available ONLY on authenticated owner drafts.
      // Saving writes to /private and never marks a public question as ready.
      const controls=document.createElement("div");
      controls.style.cssText="margin:16px 0 8px;display:flex;gap:8px;flex-wrap:wrap;";
      const saveButton=document.createElement("button");
      saveButton.type="button";
      saveButton.textContent=response.isSaved?"✓ Сохранено":"❤️ Сохранить этот вариант";
      saveButton.disabled=Boolean(response.isSaved);
      const otherButton=document.createElement("button");
      otherButton.type="button";
      otherButton.textContent="↻ Другой вариант ИИ";
      const keptButton=document.createElement("button");
      keptButton.type="button";
      keptButton.textContent="📂 Показать сохранённое";
      const editButton=document.createElement("button");
      editButton.type="button";
      editButton.textContent="Изменить текст";
      for(const control of [saveButton,otherButton,keptButton,editButton]){
        control.style.cssText="padding:9px 11px;border-radius:10px;border:1px solid #cdbdc4;background:#fff;color:#583851;font:600 13px/1.4 system-ui;";
        controls.append(control);
      }
      const status=document.createElement("p");
      status.setAttribute("role","status");
      status.style.cssText="margin:8px 0;color:#806043;font:600 13px/1.4 system-ui;";
      answer.append(controls,status);
      const selected=()=>({
        action:"save",category:[...categoryStates].find(([,value])=>value===state)?.[0],
        question_id:question.id,
        day:parseRedFlagDate(birthDateInput.value)?.day,
        month:parseRedFlagDate(birthDateInput.value)?.month,
        answer:response.answer
      });
      saveButton.addEventListener("click",async()=>{
        saveButton.disabled=true;status.textContent="Сохраняю выбранный текст…";
        try{
          const body=selected();
          const saved=await fetch("/redflag-ai-lab/keep.php",{
            method:"POST",credentials:"same-origin",cache:"no-store",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(body)
          });
          const result=await saved.json();
          if(!saved.ok||result?.ok!==true||result?.saved!==true||
              result?.draft_only!==true||result?.published!==false)
            throw new Error("SAVE_FAILED");
          if(state.answers.get(question.id)===response){
            response.isSaved=true;
            saveButton.textContent="✓ Сохранено";
          }
          status.textContent="Сохранено для этой даты и вопроса. Покупатели пока не видят.";
        }catch(_){
          saveButton.disabled=false;status.textContent="Не сохранилось. Попробуй ещё раз.";
        }
      });
      otherButton.addEventListener("click",()=>{
        if(state.answerRequests.has(question.id))return;
        state.answers.delete(question.id);
        state.answerErrors.delete(question.id);
        ensureAnswer(question,state,{forceNew:true});
        renderCategories({type:"question",id:question.id});
      });
      keptButton.addEventListener("click",async()=>{
        if(state.answerRequests.has(question.id))return;
        keptButton.disabled=true;
        status.textContent="Проверяю сохранённый черновик…";
        try{
          const birth=parseRedFlagDate(birthDateInput.value);
          const category=[...categoryStates].find(([,entry])=>entry===state)?.[0];
          if(!birth||!category)throw Error("INVALID_SELECTION");
          const responseFromStore=await fetch("/redflag-ai-lab/keep.php",{
            method:"POST",credentials:"same-origin",cache:"no-store",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({action:"get",category,question_id:question.id,day:birth.day,month:birth.month})
          });
          const stored=await responseFromStore.json();
          if(!responseFromStore.ok||stored?.ok!==true)throw Error("KEEP_GET_FAILED");
          if(stored.saved!==true){
            status.textContent="Для этой даты сохранённого варианта нет.";
            keptButton.disabled=false;
            return;
          }
          if(stored?.draft_only!==true||stored?.published!==false||
             stored?.category!==category||stored?.question_id!==question.id||
             stored?.date_key!==birth.day+"-"+birth.month||
             typeof stored.answer!=="string")throw Error("INVALID_SAVED_DRAFT");
          if(state.activeQuestionId===question.id&&ownerDraftAccess){
            state.answers.set(question.id,{answer:stored.answer,isDraft:true,isSaved:true});
            renderCategories({type:"question",id:question.id});
          }
        }catch(_){
          status.textContent="Не удалось открыть сохранённый вариант.";
          keptButton.disabled=false;
        }
      });
      editButton.addEventListener("click",()=>{
        if(answer.querySelector(".redflag-owner-edit"))return;
        const area=document.createElement("textarea");
        area.className="redflag-owner-edit";
        area.value=response.answer;
        area.rows=10;
        area.style.cssText="display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:10px;border:1px solid #cdbdc4;border-radius:10px;font:15px/1.55 system-ui;";
        const apply=document.createElement("button");
        apply.type="button";
        apply.textContent="Применить правку";
        apply.style.cssText="padding:10px;border-radius:10px;border:1px solid #cdbdc4;background:#fff;";
        apply.addEventListener("click",()=>{
          const next=area.value.trim();
          if(next.length<300||!next.includes("\n\n")){
            status.textContent="Нужны два абзаца текста. Проверь правку.";return;
          }
          response.answer=next;response.isSaved=false;
          renderCategories({type:"question",id:question.id});
        });
        controls.after(area,apply);
        area.focus();
      });
    } else {
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
    }
    // Closed previews are available in unfinished question cards only.
  } else if (opened) {
    const waiting = document.createElement("p");
    waiting.className = "redflag-loading";
    waiting.setAttribute("role", "status");
    waiting.textContent = state.answerErrors.get(question.id)
      || (ownerDraftInScope(question,state) ? "Идёт расчёт…" :
          question.isFree ? "Загружаем ответ…" : "Проверяем доступ к ответу…");
    answer.append(waiting);
  }

  // Open immediately. Do not remove a focused button after a delayed timer:
  // mobile Safari and Telegram can scroll to the browser's abandoned focus.
  button.addEventListener("click", () => {
    button.blur();
    // Reopening an owner test must not silently show an old in-memory draft.
    // Explicitly kept drafts remain on the server, available via their button.
    if(!opened&&ownerDraftInScope(question,state)){
      state.answers.delete(question.id);
      state.answerErrors.delete(question.id);
    }
    state.activeQuestionId = opened ? null : question.id;
    renderCategories({ type: "question", id: question.id });
    if (!opened) ensureAnswer(question, state, {forceNew:ownerDraftInScope(question,state)});
  });

  article.append(button, answer);
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
    const shouldOpen = (!question.isComingSoon||ownerDraftInScope(question,state)) && state.activeQuestionId === question.id;
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

// Capture clicks on published free questions at the accordion root. Unlike
// paid and draft cards, these must work immediately without remote requests,
// even when Safari/Telegram has replaced the original card DOM.
categoriesRoot.addEventListener("click",(event)=>{
  const button=event.target.closest?.(".redflag-question-toggle");
  if(!button||!categoriesRoot.contains(button)||button.disabled)return;
  const card=button.closest(".redflag-question");
  const questionId=card?.dataset.questionId;
  if(!questionId)return;
  const entry=[...categoryStates.values()].find(state=>
    state.expanded&&state.questions?.some(question=>question.id===questionId));
  const question=entry?.questions?.find(item=>item.id===questionId);
  if(!question?.isFree||question.isComingSoon)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.blur();
  if(!activeProfile){
    const date=parseRedFlagDate(birthDateInput.value);
    if(!date){
      showError("Введите дату рождения мужчины в формате ДД.ММ.ГГГГ.");
      return;
    }
    activeProfile=buildRelationshipProfile(date);
    formattedDate=birthDateInput.value;
  }
  const shouldOpen=entry.activeQuestionId!==questionId;
  entry.activeQuestionId=shouldOpen?questionId:null;
  clearError();
  if(shouldOpen)ensureAnswer(question,entry);
  renderCategories({type:"question",id:questionId});
},true);

birthDateInput.addEventListener("input", () => {
  const digits = birthDateInput.value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  birthDateInput.value = parts.join(".");
  syncCheckManButton();
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
    // A date calculation never chooses a category for the visitor.
    // This applies equally to free, paid and owner-only AI questions.
    for (const state of categoryStates.values()) {
      state.expanded = false;
      state.activeQuestionId = null;
      state.answers.clear();
      state.answerRequests.clear();
      state.answerErrors.clear();
    }
    // An explicit question-specific deep link is a user's own choice,
    // not an automatic selection of the first ("money") category.
    const linkedCategory = requestedQuestion
      ? REDFLAG_CATEGORIES.find((category) => category.id === requestedQuestion[1])
      : null;
    if (linkedCategory) {
      const linkedState = categoryStates.get(linkedCategory.id);
      linkedState.expanded = true;
      await ensureQuestions(linkedCategory);
      const linkedQuestion = linkedState.questions
        ?.find((question) => question.id === requestedQuestion[2]);
      if (linkedQuestion) {
        linkedState.activeQuestionId = linkedQuestion.id;
        ensureAnswer(linkedQuestion, linkedState);
      }
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
  syncCheckManButton();
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
