import { parseBirthDate } from "./numerology-core.js?v=1";
import { buildRelationshipProfile } from "./redflag-engine.js?v=3";
import { REDFLAG_CATEGORIES } from "./redflag-categories.js?v=1";

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
  answer.innerHTML = `
    <p class="redflag-verdict">${response.verdict}</p>
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

birthDateInput.addEventListener("input", () => {
  const digits = birthDateInput.value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  birthDateInput.value = parts.join(".");
  error.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = parseBirthDate(birthDateInput.value);
  if (!date) {
    showError("Введите существующую дату в формате ДД.ММ.ГГГГ.");
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
  home.classList.remove("is-active");
  redFlag.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
  renderCategories();
  window.setTimeout(() => birthDateInput.focus(), 220);
};
