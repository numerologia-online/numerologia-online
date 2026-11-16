/** Список вопросов о паре; пользователь сам решает, какой ответ раскрыть. */
import { parseBirthDate } from "./numerology-core.js?v=1";
import { calculateCompatibility } from "./compatibility-engine.js?v=1";
import { openSharedOffer } from "./shared-offer.js?v=report-annual-20261109";
import { createCompatibilityPdfController } from "./compatibility-pdf.js?v=compatibility-cards-20261116";
import { walletRequest, walletOwnerMaterial, walletMaterial } from "./wallet-client.js?v=owner-material-20261116";

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
const pdfButtons = [...document.querySelectorAll("#compatibility .compatibility-pdf-button")];
let currentReport = null;
const pdf = createCompatibilityPdfController({
  buttons: pdfButtons,
  getBank: (_energy, report) => report.readings
});

async function recognizePurchasedReport({item, topics}) {
  let material = await walletOwnerMaterial(item).catch(() => null);
  if (!material) {
    const quote = await walletRequest("wallet_quote", {item});
    const resource = "pair:" + item.birth_date + ":" + item.partner_birth_date;
    if (quote.owned !== true || quote.product_code !== item.product_code || quote.resource_id !== resource ||
        !/^[a-f0-9-]{36}$/i.test(String(quote.entitlement_id || ""))) return null;
    material = await walletMaterial(quote.entitlement_id);
  }
  if (material.sections?.length !== topics.length) return null;
  return Object.fromEntries(topics.map((topic, index) => {
    const {title, paragraphs} = material.sections[index];
    if ((title !== topic.title && title !== topic.key) || !Array.isArray(paragraphs) ||
        paragraphs.length < 2 || paragraphs.some(text => typeof text !== "string" || !text.trim())) {
      throw new Error("Ответы не соответствуют вашему расчёту");
    }
    const [lead, ...body] = paragraphs;
    return [topic.key, {lead, text: body.join("\n\n")}];
  }));
}

function setReadings(report, readings) {
  if (!readings && report.readings) clearSelection();
  report.readings = readings;
  pdf.setReport(readings ? report : null);
  topicsRoot.querySelectorAll(".compatibility-topic").forEach((card, index) => {
    const {title, key} = report.topics[index];
    const unlocked = Boolean(readings?.[key]);
    const button = card.querySelector(".compatibility-topic-toggle");
    card.classList.toggle("is-locked", index !== 0 && !unlocked);
    card.classList.toggle("is-purchased", index !== 0 && unlocked);
    button.querySelector(".compatibility-topic-icon").textContent = index === 0 || unlocked ? "+" : "🔒";
    const label = index === 0 ? "Открыть бесплатный ответ: " : unlocked ? "Открыть ответ: " : "Открыть варианты покупки: ";
    button.setAttribute("aria-label", label + title);
  });
}

function refreshPurchasedCompatibility() {
  const report = currentReport;
  if (!report) return;
  const check = recognizePurchasedReport(report).catch(() => null).then(readings => {
    if (currentReport === report && report.accessCheck === check) {
      report.accessCheck = null;
      setReadings(report, readings);
    }
  });
  report.accessCheck = check;
}
window.addEventListener("numi:wallet-updated", () => refreshPurchasedCompatibility());
window.addEventListener("numi:account-logged-out", () => {
  if (!currentReport) return;
  currentReport.accessCheck = null;
  setReadings(currentReport, null);
});

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

const offer = Object.freeze({
  product: "полную совместимость",
  title: "Откройте все 13 ответов",
  oncePrice: 990,
  memberPrice: 490,
  clubMonthly: 490
});
const showOffer = ({item}) => {
  openSharedOffer({...offer, subject: item}).catch(error => {
    console.error("Окно покупки:", error);
    alert("Не удалось открыть варианты доступа. Проверьте интернет и попробуйте снова.");
  });
};
pdfButtons.forEach(button => {
  button.addEventListener("click", async () => {
    const report = currentReport;
    if (!report) return;
    await report.accessCheck;
    if (report !== currentReport) return;
    if (report.readings) await pdf.download();
    else showOffer(report);
  });
});

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

const showTopic = async (report, topic, article, isFree) => {
  if (!isFree) await report.accessCheck;
  if (report !== currentReport) return;
  const paidCopy = report.readings?.[topic.key];
  if (!isFree && !paidCopy) {
    showOffer(report);
    return;
  }
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
    const copy = paidCopy ?? (await getBank(topic.energy))[topic.key];
    if (token !== requestNumber || selected !== topic.key) return;
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

const renderTopics = (report) => {
  requestNumber++;
  selected = null;
  const list = document.createDocumentFragment();
  for (const [index, topic] of report.topics.entries()) {
    const card = document.createElement("article");
    card.className = "compatibility-topic " + (index === 0 ? "is-free" : "is-locked");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compatibility-topic-toggle";
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span class="compatibility-topic-index">${String(index + 1).padStart(2, "0")}</span><span class="compatibility-topic-title"></span><span class="compatibility-topic-icon" aria-hidden="true">+</span>`;
    button.querySelector(".compatibility-topic-title").textContent = topic.title;
    button.querySelector(".compatibility-topic-icon").textContent = index === 0 ? "+" : "🔒";
    button.setAttribute("aria-label", index === 0 ? "Открыть бесплатный ответ: " + topic.title : "Открыть варианты покупки: " + topic.title);
    const body = document.createElement("div");
    body.className = "compatibility-topic-body";
    body.hidden = true;
    button.addEventListener("click", () => showTopic(report, topic, card, index === 0));
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
  currentReport = {
    topics: calculateCompatibility(first, second),
    dateA: aField.value,
    dateB: bField.value,
    item: {
      product_code: "compatibility_full",
      birth_date: aField.value.split(".").reverse().join("-"),
      partner_birth_date: bField.value.split(".").reverse().join("-")
    },
    readings: null,
    accessCheck: null
  };
  renderTopics(currentReport);
  pdf.setReport(null);
  summary.textContent = `Расчёт для ${currentReport.dateA} и ${currentReport.dateB} готов. Выбирайте любой вопрос, чтобы прочитать свой разбор.`;
  result.hidden = false;
  error.hidden = true;
  void refreshPurchasedCompatibility();
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
