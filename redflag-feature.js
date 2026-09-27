import { parseBirthDate } from "./numerology-core.js?v=1";
import { buildRelationshipProfile } from "./redflag-engine.js?v=1";

const home = document.querySelector("#home");
const redFlag = document.querySelector("#redflag");
const form = document.querySelector("#redflag-form");
const birthDateInput = document.querySelector("#redflag-birth-date");
const error = document.querySelector("#redflag-error");
const category = document.querySelector("#redflag-category");
const categoryToggle = document.querySelector("#redflag-category-toggle");
const categoryContent = document.querySelector("#redflag-category-content");
const readyNote = document.querySelector("#redflag-ready-note");
const questionsRoot = document.querySelector("#redflag-questions");
const backButton = document.querySelector("#back-redflag-home");

let loveContentLoading;
let questions = [];
let activeQuestionId;
let activeProfile;

const getLoveQuestions = async () => {
  loveContentLoading ??= import("./redflag-love.js?v=1");
  const content = await loveContentLoading;
  return content.LOVE_QUESTIONS;
};

const setCategoryExpanded = (expanded) => {
  categoryToggle.setAttribute("aria-expanded", String(expanded));
  categoryContent.hidden = !expanded;
  category.classList.toggle("is-open", expanded);
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
};

const createQuestion = (question, profile, opened) => {
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}${profile ? " is-calculated" : " is-preview"}`;
  article.dataset.questionId = question.id;

  if (!profile) {
    const preview = document.createElement("p");
    preview.className = "redflag-question-preview";
    preview.textContent = question.title;
    article.append(preview);
    return article;
  }

  const response = question.answer(profile);
  const button = document.createElement("button");
  button.className = "redflag-question-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", String(opened));
  button.innerHTML = `<span>${question.title}</span><b aria-hidden="true">+</b>`;

  const answer = document.createElement("div");
  answer.className = "redflag-answer";
  answer.hidden = !opened;
  answer.innerHTML = `
    <p class="redflag-verdict">${response.verdict}</p>
    <p>${response.answer}</p>
    <p class="redflag-observation"><strong>На что смотреть:</strong> ${response.observation}</p>`;

  button.addEventListener("click", () => {
    activeQuestionId = activeQuestionId === question.id ? null : question.id;
    renderQuestions();
  });

  article.append(button, answer);
  return article;
};

const renderQuestions = () => {
  questionsRoot.replaceChildren(...questions.map((question) => createQuestion(question, activeProfile, question.id === activeQuestionId)));
};

const preparePreview = async () => {
  if (!questions.length) questions = await getLoveQuestions();
  renderQuestions();
};

categoryToggle.addEventListener("click", () => {
  setCategoryExpanded(categoryContent.hidden);
});

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
    if (!questions.length) questions = await getLoveQuestions();
    activeProfile = buildRelationshipProfile(date);
    activeQuestionId = questions[0].id;
    readyNote.textContent = `Расчёт для ${birthDateInput.value} готов. Откройте вопрос — внутри будет персональный ответ.`;
    readyNote.hidden = false;
    error.hidden = true;
    setCategoryExpanded(true);
    renderQuestions();
    category.scrollIntoView({ behavior: "smooth", block: "start" });
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
  preparePreview().catch(() => showError("Не удалось подготовить список вопросов. Обновите страницу и попробуйте ещё раз."));
  window.setTimeout(() => birthDateInput.focus(), 220);
};
