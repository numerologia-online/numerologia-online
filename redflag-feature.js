// Red Flag deliberately needs only day and month, with no birth-year dependence.
import { buildRelationshipProfile } from "./redflag-engine.js?v=4";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=69";

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

let activeProfile;
let formattedDate;

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
const REDFLAG_SITE_URL = "https://numerologia-online.github.io/numerologia-online/?view=redflag";
const REDFLAG_BOT_URL = "https://t.me/Numerologiaonline_bot";
const REDFLAG_SAVE_URL = "https://numerologia-online-bot.tankraft431.workers.dev/api/save-redflag";
const REDFLAG_TICKET_URL = "https://xn--c1adkkdfjbp1a4l.online/api/redflag-save.php";
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
      window.location.assign(preparedBotLink);
      return;
    }
    const signedData = window.Telegram?.WebApp?.initData;
    if (report.length > 3800) {
      showFeedback("is-error",
        "⚠️ Не удалось сохранить",
        "Этот ответ слишком длинный для одного сообщения Telegram.");
      return;
    }

    if (typeof signedData !== "string" || !signedData) {
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
          throw new Error("TICKET_CREATE_FAILED");
        }
        preparedBotLink = REDFLAG_BOT_URL + "?start=" + encodeURIComponent(data.ticket);
        save.textContent = "🤖 Открыть бота с ответом";
        save.disabled = false;
        showFeedback("is-success", "❤️ Ссылка на ответ готова",
          "Если Telegram не открылся, нажми кнопку ещё раз. В новом боте нажми «Начать», и тебе придёт именно этот ответ.");
        window.location.assign(preparedBotLink);
      } catch {
        save.disabled = false;
        showFeedback("is-error", "Не удалось подготовить сохранение",
          "Ответ остаётся на странице. Проверь интернет и нажми «Сохранить» ещё раз.");
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
const ensureAnswer = (question, state) => {
  const id = question.id;
  if (state.answers.has(id) || state.answerRequests.has(id)) return;
  const profile = activeProfile;
  if (!profile) return;
  state.answerErrors.delete(id);
  const request = Promise.resolve().then(() => question.answer(profile));
  state.answerRequests.set(id, request);
  void request.then((response) => {
    if (profile === activeProfile) state.answers.set(id, response);
  }, () => {
    if (profile === activeProfile) state.answerErrors.set(id, "Не удалось загрузить ответ. Закрой и открой вопрос ещё раз.");
  }).finally(() => {
    if (state.answerRequests.get(id) === request) state.answerRequests.delete(id);
    if (profile === activeProfile && state.expanded && state.activeQuestionId === id) renderCategories();
  });
};

// Keep pricing in compact question metadata; never fetch the large answer JSON here.
const fillQuestionButton = (button, question, showExpand = false) => {
  const label = document.createElement("span");
  label.className = "redflag-question-label";
  label.textContent = question.title;
  button.append(label);
  if (Number.isInteger(question.priceRub)) {
    const price = document.createElement("span");
    price.className = "redflag-question-price";
    price.textContent = question.priceRub + " ₽";
    button.append(price);
  }
  if (showExpand) {
    const plus = document.createElement("b");
    plus.setAttribute("aria-hidden", "true");
    plus.textContent = "+";
    button.append(plus);
  }
};

const createQuestion = (question, state) => {
  const opened = state.activeQuestionId === question.id;
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}${activeProfile ? " is-calculated" : " is-preview"}`;
  article.dataset.questionId = question.id;

  if (!activeProfile) {
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "redflag-question-toggle redflag-question-preview";
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
      renderCategories();
      ensureAnswer(question, state);
    });
    article.append(preview);
    return article;
  }

  const response = state.answers.get(question.id);
  const button = document.createElement("button");
  button.className = "redflag-question-toggle";
  button.type = "button";
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
    addRedFlagShare(answer, formatRedFlagMessage(question, response, formattedDate));
  } else if (opened) {
    const waiting = document.createElement("p");
    waiting.className = "redflag-loading";
    waiting.textContent = state.answerErrors.get(question.id) || "Открываю ответ…";
    answer.append(waiting);
  }

  button.addEventListener("click", () => {
    state.activeQuestionId = opened ? null : question.id;
    renderCategories();
    if (!opened) ensureAnswer(question, state);
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
  toggle.innerHTML = `<span><small class="redflag-category-index">Блок ${index + 1} · 10 вопросов</small><strong>${category.title}</strong>${category.id === "intimacy" ? '<span class="redflag-age-label" aria-label="Для взрослых, 18 плюс">18+</span>' : ""}<small class="redflag-category-count">10 вопросов</small><em>${category.description}</em></span><b aria-hidden="true">+</b>`;
  toggle.addEventListener("click", () => {
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
    const target = linkedQuestion
      ? [...categoriesRoot.querySelectorAll("[data-question-id]")].find((item) => item.dataset.questionId === linkedQuestion.id)
      : null;
    (target || categoriesRoot).scrollIntoView({ behavior: "smooth", block: "center" });
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

  // A broadcast deep link opens the exact named question, not just the section.
  // Date input remains optional until the question is actually requested.
  const category = requestedQuestion
    ? REDFLAG_CATEGORIES.find((item) => item.id === requestedQuestion[1])
    : null;
  if (category) {
    const state = categoryStates.get(category.id);
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
