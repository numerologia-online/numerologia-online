/** Список вопросов о паре; пользователь сам решает, какой ответ раскрыть. */
import { parseBirthDate } from "./numerology-core.js?v=1";
import { calculateCompatibility } from "./compatibility-engine.js?v=1";

const home = document.querySelector("#home");
const page = document.querySelector("#compatibility");
const form = document.querySelector("#compatibility-form");
const aField = document.querySelector("#compatibility-date-a");
const bField = document.querySelector("#compatibility-date-b");
const error = document.querySelector("#compatibility-error");
const summary = document.querySelector("#compatibility-summary");
const topicsRoot = document.querySelector("#compatibility-topics");
const result = document.querySelector("#compatibility-result");
const back = document.querySelector("#back-compatibility-home");

const cache = new Map();
const getBank = (energy) => {
  if (!Number.isInteger(energy) || energy < 1 || energy > 22) return Promise.reject(new Error("Нет энергии для расчёта"));
  if (cache.has(energy)) return cache.get(energy);
  const promise = fetch(`./data/compatibility/deep/energy-${energy}.json?v=1`)
    .then(response => {
      if (!response.ok) throw new Error(`Данные энергии ${energy} недоступны`);
      return response.json();
    })
    .then(data => {
      if (data.energy !== energy || !data.blocks) throw new Error("Некорректные данные");
      return data.blocks;
    })
    .catch(reason => { cache.delete(energy); throw reason; });
  cache.set(energy, promise);
  return promise;
};

const formatInput = (input) => {
  const digits = input.value.replace(/\D/g, "").slice(0, 8);
  input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
  error.hidden = true;
};
aField.addEventListener("input", () => formatInput(aField));
bField.addEventListener("input", () => formatInput(bField));

let requestNumber = 0;
let selected = null;
const clearSelection = () => {
  selected = null;
  for (const item of topicsRoot.querySelectorAll(".compatibility-topic")) {
    item.classList.remove("is-open");
    item.querySelector(".compatibility-topic-toggle").setAttribute("aria-expanded", "false");
    item.querySelector(".compatibility-topic-body").hidden = true;
  }
};

const addParagraphs = (target, content) => {
  target.replaceChildren();
  for (const paragraph of content.trim().split(/\n\s*\n/)) {
    if (!paragraph.trim()) continue;
    const p = document.createElement("p");
    p.textContent = paragraph.trim();
    target.append(p);
  }
};

const showTopic = async (topic, article) => {
  const body = article.querySelector(".compatibility-topic-body");
  const button = article.querySelector(".compatibility-topic-toggle");
  if (selected === topic.key) { clearSelection(); return; }
  clearSelection();
  selected = topic.key;
  article.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
  body.hidden = false;
  body.textContent = "Открываю ваш разбор…";
  const token = ++requestNumber;
  try {
    const blocks = await getBank(topic.energy);
    if (token !== requestNumber || selected !== topic.key) return;
    const copy = blocks[topic.key];
    if (!copy?.text || !copy?.lead) throw new Error("Нет полного текста для вопроса");
    body.replaceChildren();
    const lead = document.createElement("p");
    lead.className = "compatibility-topic-lead";
    lead.textContent = copy.lead;
    body.append(lead);
    const description = document.createElement("div");
    addParagraphs(description, copy.text);
    body.append(description);
  } catch {
    if (token !== requestNumber || selected !== topic.key) return;
    body.textContent = "Не удалось загрузить текст. Нажмите на вопрос ещё раз, чтобы повторить.";
  }
};

const renderTopics = (topics) => {
  requestNumber++;
  selected = null;
  const list = document.createDocumentFragment();
  for (const [index, topic] of topics.entries()) {
    const card = document.createElement("article");
    card.className = "compatibility-topic";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compatibility-topic-toggle";
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span class="compatibility-topic-index">${String(index + 1).padStart(2, "0")}</span><span class="compatibility-topic-title"></span><span class="compatibility-topic-icon" aria-hidden="true">+</span>`;
    button.querySelector(".compatibility-topic-title").textContent = topic.title;
    const body = document.createElement("div");
    body.className = "compatibility-topic-body";
    body.hidden = true;
    button.addEventListener("click", () => showTopic(topic, card));
    card.append(button, body);
    list.append(card);
  }
  topicsRoot.replaceChildren(list);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const first = parseBirthDate(aField.value);
  const second = parseBirthDate(bField.value);
  if (!first || !second) {
    error.textContent = "Проверьте обе даты рождения в формате ДД.ММ.ГГГГ.";
    error.hidden = false;
    return;
  }
  const topics = calculateCompatibility(first, second);
  renderTopics(topics);
  summary.textContent = `Расчёт для ${aField.value} и ${bField.value} готов. Выбирайте любой вопрос, чтобы прочитать свой разбор.`;
  result.hidden = false;
  error.hidden = true;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

back.addEventListener("click", () => {
  page.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

export const openCompatibility = () => {
  home.classList.remove("is-active");
  page.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
};
