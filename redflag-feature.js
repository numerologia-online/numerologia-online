import { parseBirthDate } from "./numerology-core.js?v=1";
import { buildRelationshipProfile } from "./redflag-engine.js?v=1";

const home = document.querySelector("#home");
const redFlag = document.querySelector("#redflag");
const form = document.querySelector("#redflag-form");
const birthDateInput = document.querySelector("#redflag-birth-date");
const error = document.querySelector("#redflag-error");
const result = document.querySelector("#redflag-result");
const resultTitle = document.querySelector("#redflag-result-title");
const resultNote = document.querySelector("#redflag-result-note");
const questionsRoot = document.querySelector("#redflag-questions");
const backButton = document.querySelector("#back-redflag-home");

let loveContentLoading;
let activeQuestionId;

const getLoveQuestions = async () => {
  loveContentLoading ??= import("./redflag-love.js?v=1");
  const content = await loveContentLoading;
  return content.LOVE_QUESTIONS;
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
  result.hidden = true;
};

const createAnswer = (question, profile, opened) => {
  const response = question.answer(profile);
  const article = document.createElement("article");
  article.className = `redflag-question${opened ? " is-open" : ""}`;
  article.dataset.questionId = question.id;

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
    renderQuestions(questionsRoot._questions, questionsRoot._profile);
  });

  article.append(button, answer);
  return article;
};

const renderQuestions = (questions, profile) => {
  questionsRoot._questions = questions;
  questionsRoot._profile = profile;
  questionsRoot.replaceChildren(...questions.map((question) => createAnswer(question, profile, question.id === activeQuestionId)));
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
    const questions = await getLoveQuestions();
    const profile = buildRelationshipProfile(date);
    activeQuestionId = questions[0].id;
    resultTitle.textContent = `Любовь и отношения: ${birthDateInput.value}`;
    resultNote.textContent = `В этой версии — ${questions.length} вопросов. Мы смотрим на сценарий отношений, готовность к близости и личный период ${new Date().getFullYear()} года.`;
    renderQuestions(questions, profile);
    error.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
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
  window.setTimeout(() => birthDateInput.focus(), 220);
};
