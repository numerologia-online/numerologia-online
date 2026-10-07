import { parseBirthDate, reduce9 } from "./numerology-core.js?v=1";
import texts from "./personal-day-data-lite.js?v=1";

const personalDay = ({ day, month }, date = new Date()) => {
  const yearSum = String(date.getFullYear()).split("").reduce((a, n) => a + Number(n), 0);
  const personalYear = reduce9(day + month + yearSum);
  const personalMonth = reduce9(personalYear + date.getMonth() + 1);
  return reduce9(personalMonth + date.getDate());
};

const publicDay = (date = new Date()) => reduce9(String(date.getFullYear()).split("").reduce((sum, digit) => sum + Number(digit), 0) + date.getMonth() + 1 + date.getDate());
const loadGeneralDay = async () => {\n  const today = new Date();\n  const day = publicDay(today);\n  const calendarDay = today.getDate();\n  try {\n    const response = await fetch(`./data/day/general/general-day-${String(day).padStart(2, "0")}.json?v=1`);\n    if (!response.ok) throw new Error("day bank unavailable");\n    const bank = await response.json();\n    const entry = bank.entries?.[String(calendarDay)];\n    if (entry?.text) return { energy: day, title: `День ${day}`, openings: [entry.text] };\n  } catch {}\n  return texts[day] || texts[1];\n};
const esc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paragraphs = (items = []) => items.filter(Boolean).map((text) => `<p>${esc(text)}</p>`).join("");
const todayLabel = () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase();

export const openPersonalDay = () => {
  const general = texts[publicDay()] || texts[1];
  const shell = document.createElement("section");
  shell.className = "personal-day-overlay personal-day-page-overlay";
  shell.innerHTML = `<div class="personal-day-card personal-day-page" role="dialog" aria-modal="true"><button class="personal-day-close" type="button" aria-label="Закрыть">×</button><p class="eyebrow">Персональный прогноз</p><h2>Расчёт на день</h2><p class="personal-day-lead">Введите дату рождения, чтобы увидеть энергию личного дня и практические подсказки.</p><section class="personal-day-general"><p class="personal-day-date">СЕГОДНЯ: ${todayLabel()}</p><h3>${esc(general.title)}</h3>${paragraphs(general.openings || [])}</section><section class="personal-day-form-panel"><p class="personal-day-form-kicker">ЭТО ОБЩИЙ ФОН. РАССЧИТАЙТЕ ЛИЧНЫЙ ДЕНЬ</p><form><label><span class="sr-only">Дата рождения</span><input required type="tel" inputmode="numeric" autocomplete="bday" placeholder="09.09.1986" maxlength="10"></label><button class="personal-day-submit" type="submit" disabled>Рассчитать личный день</button><p class="personal-day-error" hidden></p></form></section><section class="personal-day-result" hidden></section></div>`;
  document.body.append(shell);
  const card = shell.querySelector(".personal-day-card"), form = shell.querySelector("form"), input = shell.querySelector("input"), submit = shell.querySelector("button[type=submit]"), result = shell.querySelector(".personal-day-result");
  shell.querySelector(".personal-day-close").onclick = () => shell.remove();
  input.addEventListener("input", () => { const digits = input.value.replace(/\D/g, "").slice(0, 8); input.value = [digits.slice(0,2), digits.slice(2,4), digits.slice(4,8)].filter(Boolean).join("."); submit.disabled = digits.length !== 8; });
  form.onsubmit = (event) => { event.preventDefault(); const birth = parseBirthDate(input.value); const error = shell.querySelector(".personal-day-error"); if (!birth) { error.hidden = false; error.textContent = "Введите дату в формате ДД.ММ.ГГГГ"; return; } error.hidden = true; const item = texts[personalDay(birth)] || texts[1]; result.hidden = false; result.innerHTML = `<section class="personal-day-main"><p class="personal-day-date">ВАШ ЛИЧНЫЙ ДЕНЬ</p><h3>${item.energy}. ${esc(item.title)}</h3>${paragraphs(item.main || item.openings)}${item.money?.length ? `<h4>Деньги</h4>${paragraphs(item.money)}` : ""}${item.love?.length ? `<h4>Отношения</h4>${paragraphs(item.love)}` : ""}${item.actions?.length ? `<h4>Сегодня важно сделать</h4>${paragraphs(item.actions)}` : ""}${item.avoid?.length ? `<h4>Сегодня лучше не делать</h4>${paragraphs(item.avoid)}` : ""}${item.questions?.length ? `<h4>Вопрос дня</h4>${paragraphs(item.questions)}` : ""}</section>`; card.scrollTop = card.scrollHeight; };
};
