import { parseBirthDate } from "./numerology-core.js?v=1";
import { buildRelationshipProfile } from "./redflag-engine.js?v=3";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=11";

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
  activeQuestionId: null
}]));

let activeProfile;
let formattedDate;

// Share the exact currently calculated answer, not a second calculation.
// The server route reuses the verified sender used by "Личный расчёт дня".
const REDFLAG_SITE_URL = "https://numerologia-online.github.io/numerologia-online/?view=redflag";
const REDFLAG_BOT_URL = "https://t.me/Numerologiaonline_bot";
const REDFLAG_SAVE_URL = "https://numerologia-online-bot.tankraft431.workers.dev/api/save-redflag";
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

const addRedFlagShare = (answer, report) => {
  const controls = document.createElement("section");
  controls.className = "personal-day-share redflag-share";
  controls.setAttribute("aria-label", "Сохранить и поделиться ответом");
  controls.innerHTML = '<p class="personal-day-share-title">Сохрани этот ответ ❤️</p>'
    + '<button type="button" class="personal-day-share-save">📩 Отправить расчёт в Telegram</button>'
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

  save.addEventListener("click", async () => {
    const signedData = window.Telegram?.WebApp?.initData;
    if (typeof signedData !== "string" || !signedData) {
      showFeedback("is-error",
        "⚠️ Сообщение не отправлено",
        "Чтобы сохранять расчёты в Telegram, откройте наш сайт через Telegram-бота.",
        true);
      return;
    }
    if (report.length > 3800) {
      showFeedback("is-error",
        "⚠️ Не удалось отправить",
        "Этот ответ слишком длинный для одного сообщения Telegram.");
      return;
    }

    save.disabled = true;
    showFeedback("is-pending", "Отправляем расчёт…", "Пожалуйста, подождите.");
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
      save.textContent = "✓ Сохранено в Telegram";
      showFeedback("is-success",
        "✅ Расчёт сохранён!",
        "Ваш ответ уже в переписке с нашим Telegram-ботом ❤️");
    } catch (error) {
      save.disabled = false;
      const reconnectErrors = new Set([
        "INIT_DATA_MISSING", "INIT_DATA_FORMAT", "SESSION_EXPIRED",
        "SIGNATURE_MISMATCH", "USER_NOT_PRESENT", "BOT_CHAT_UNAVAILABLE",
        "ORIGIN_NOT_ALLOWED"
      ]);
      if (reconnectErrors.has(error?.message)) {
        showFeedback("is-error",
          "⚠️ Сообщение не отправлено",
          "Откройте наш сайт через Telegram-бота и повторите отправку.",
          true);
      } else {
        showFeedback("is-error",
          "⚠️ Не удалось отправить",
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

const createQuestion = (question, state) => {
  const opened = state.activeQuestionId === question.id;
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}${activeProfile ? " is-calculated" : " is-preview"}`;

  if (!activeProfile) {
    const preview = document.createElement("p");
    preview.className = "redflag-question-preview";
    preview.textContent = question.title;
    article.append(preview);
    return article;
  }

  const response = question.answer(activeProfile);
  const button = document.createElement("button");
  button.className = "redflag-question-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", String(opened));
  button.innerHTML = `<span>${question.title}</span><b aria-hidden="true">+</b>`;

  const answer = document.createElement("div");
  answer.className = "redflag-answer";
  answer.hidden = !opened;
  const paragraphs = response.paragraphs ?? [response.answer];
  const scales = (response.scales ?? []).map(({ label, value }) => ({
    label,
    value: Math.max(0, Math.min(10, Math.round(Number(value) || 0)))
  }));
  const scalesMarkup = scales.length ? `
    <div class="redflag-scales" aria-label="Шкалы ответа">
      ${scales.map(({ label, value }) => `
        <div class="redflag-scale">
          <div class="redflag-scale-label"><span>${label}</span><strong>${value}/10</strong></div>
          <div class="redflag-scale-track" aria-hidden="true"><i style="width: ${value * 10}%"></i></div>
        </div>`).join("")}
    </div>` : "";
  const verdictMarkup = response.verdict
    ? `<p class="redflag-verdict">${response.verdict}</p>` : "";
  const observationMarkup = response.observation
    ? `<p class="redflag-observation"><strong>На что смотреть:</strong> ${response.observation}</p>` : "";
  answer.innerHTML = `
    ${verdictMarkup}
    ${scalesMarkup}
    ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    ${observationMarkup}`;
  if (opened) addRedFlagShare(answer, formatRedFlagMessage(question, response, formattedDate));

  button.addEventListener("click", () => {
    state.activeQuestionId = opened ? null : question.id;
    renderCategories();
  });

  article.append(button, answer);
  return article;
};

const ensureQuestions = async (category) => {
  const state = categoryStates.get(category.id);
  if (state.questions || state.loading) return;

  state.loading = true;
  renderCategories();
  try {
    const content = await category.load();
    state.questions = content.QUESTIONS;
  } finally {
    state.loading = false;
    renderCategories();
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
  toggle.innerHTML = `<span><small class="redflag-category-index">Блок ${index + 1} · 10 вопросов</small><strong>${category.title}</strong><small class="redflag-category-count">10 вопросов</small><em>${category.description}</em></span><b aria-hidden="true">+</b>`;
  toggle.addEventListener("click", () => {
    if (!activeProfile) {
      showError(parseBirthDate(birthDateInput.value)
        ? "Нажмите «Проверить мужчину», чтобы открыть вопросы."
        : "Введите дату рождения мужчины.");
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    state.expanded = !state.expanded;
    renderCategories();
    if (state.expanded) ensureQuestions(category);
  });
  section.append(toggle);

  if (!state.expanded) return section;

  const content = document.createElement("div");
  content.className = "redflag-category-content";

  if (state.loading) {
    const loading = document.createElement("p");
    loading.className = "redflag-loading";
    loading.textContent = "Открываю вопросы…";
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

const renderCategories = () => {
  categoriesRoot.replaceChildren(...REDFLAG_CATEGORIES.map(createCategory));
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
      state.expanded = false;
      state.activeQuestionId = null;
    }
    renderCategories();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = parseBirthDate(birthDateInput.value);
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
    const firstCategory = REDFLAG_CATEGORIES[0];
    const firstState = categoryStates.get(firstCategory.id);
    firstState.expanded = true;
    await ensureQuestions(firstCategory);
    // After every calculation, let the visitor choose which question to open.
    for (const state of categoryStates.values()) state.activeQuestionId = null;
    clearError();
    renderCategories();
    categoriesRoot.scrollIntoView({ behavior: "smooth", block: "start" });
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
  window.setTimeout(() => birthDateInput.focus(), 220);
};
