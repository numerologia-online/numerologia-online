import { parseBirthDate } from "./numerology-core.js?v=1";
import { buildRelationshipProfile } from "./redflag-engine.js?v=3";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=3";

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

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
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
  answer.innerHTML = `
    <p class="redflag-verdict">${response.verdict}</p>
    ${scalesMarkup}
    ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    <p class="redflag-observation"><strong>На что смотреть:</strong> ${response.observation}</p>`;

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
  toggle.innerHTML = `<span><small>Блок ${index + 1} · 10 вопросов</small><strong>${category.title}</strong><em>${category.description}</em></span><b aria-hidden="true">+</b>`;
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

// Native calendar is limited to adult birth dates, without a separate age-calculation flow.
const refreshBirthDateLimit = () => {
  const today = new Date();
  const birthYear = today.getFullYear() - 18;
  const month = today.getMonth();
  // Handle leap day in the browser's local timezone.
  const day = Math.min(today.getDate(), new Date(birthYear, month + 1, 0).getDate());
  const latestBirthDate = new Date(birthYear, month, day);
  const two = (value) => String(value).padStart(2, "0");
  birthDateInput.max = [
    latestBirthDate.getFullYear(),
    two(latestBirthDate.getMonth() + 1),
    two(latestBirthDate.getDate())
  ].join("-");
};

refreshBirthDateLimit();
birthDateInput.addEventListener("input", () => {
  error.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // HTML date inputs return YYYY-MM-DD, but the shared calculator expects DD.MM.YYYY.
  const [year, month, day] = birthDateInput.value.split("-");
  const readableDate = year && month && day ? `${day}.${month}.${year}` : "";
  const date = parseBirthDate(readableDate);
  if (!date) {
    showError("Выберите дату рождения в календаре.");
    birthDateInput.focus();
    return;
  }

  try {
    activeProfile = buildRelationshipProfile(date);
    formattedDate = readableDate;
    const firstCategory = REDFLAG_CATEGORIES[0];
    const firstState = categoryStates.get(firstCategory.id);
    firstState.expanded = true;
    await ensureQuestions(firstCategory);
    if (firstState.questions && !firstState.activeQuestionId) firstState.activeQuestionId = firstState.questions[0].id;
    error.hidden = true;
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
  refreshBirthDateLimit();
  home.classList.remove("is-active");
  redFlag.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
  renderCategories();
  window.setTimeout(() => birthDateInput.focus(), 220);
};
