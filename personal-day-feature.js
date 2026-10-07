import { parseBirthDate } from "./numerology-core.js?v=1";
import texts from "./personal-day-data-lite.js?v=1";

const reduce22 = (value) => {
  let n = Math.abs(Number(value) || 0);
  while (n > 22) n = String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return n || 22;
};

const personalDay = ({ day, month }, date = new Date()) => {
  const yearSum = String(date.getFullYear()).split("").reduce((a, n) => a + Number(n), 0);
  const personalYear = reduce22(day + month + yearSum);
  const personalMonth = reduce22(personalYear + date.getMonth() + 1);
  return reduce22(personalMonth + date.getDate());
};

const loadPersonalDay = async (birth, date = new Date()) => {
  const day = personalDay(birth, date);
  const calendarDay = date.getDate();
  try {
    const response = await fetch(`./data/day/general/general-day-${String(day).padStart(2, "0")}.json?v=3`);
    if (!response.ok) throw new Error("personal day bank unavailable");
    const bank = await response.json();
    const entry = bank.entries?.[String(calendarDay)];
    let practical = null;
    try {
      const practicalResponse = await fetch(`./data/day/practical/practical-day-${String(day).padStart(2, "0")}.json?v=1`);
      if (practicalResponse.ok) practical = await practicalResponse.json();
    } catch {}
    const advice = practical?.entries?.[String(calendarDay)] || {};
    if (entry?.text) return { energy: day, calendarDay, text: entry.text, todayNeed: advice.todayNeed || [], todayAvoid: advice.todayAvoid || [] };
  } catch {}
  const fallback = texts[day] || texts[1];
  return { energy: day, calendarDay, text: fallback.main?.[0] || fallback.openings?.[0] || "Ваш личный текст дня готовится." };
};

const esc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paragraphs = (items = []) => items.filter(Boolean).map((text) => `<p>${esc(text)}</p>`).join("");
const bullets = (items = []) => items.filter(Boolean).map((text) => `<li>${esc(text)}</li>`).join("");
const todayLabel = () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase();

export const openPersonalDay = () => {
  const shell = document.createElement("section");
  shell.className = "personal-day-overlay personal-day-page-overlay";
  shell.innerHTML = `<div class="personal-day-card personal-day-page" role="dialog" aria-modal="true"><button class="personal-day-close" type="button" aria-label="Закрыть">×</button><p class="eyebrow">Личный прогноз</p><h2>Ваш личный расчёт дня</h2><p class="personal-day-lead">Личный разбор дня подскажет, куда направить силы, какой шаг сделать, чего избегать, к каким чувствам прислушаться и какие тайны бережно хранит для вас этот день.</p><section class="personal-day-form-panel"><p class="personal-day-form-kicker">РАССЧИТАЙТЕ СВОЙ ЛИЧНЫЙ ДЕНЬ</p><p class="personal-day-date">СЕГОДНЯ: ${todayLabel()}</p><form><label><span>Дата рождения</span><input required type="tel" inputmode="numeric" autocomplete="bday" placeholder="09.09.1986" maxlength="10"></label><button class="personal-day-submit" type="submit" disabled>Рассчитать личный день</button><p class="personal-day-error" hidden></p></form></section><section class="personal-day-result" hidden></section></div>`;
  document.body.append(shell);
  const card = shell.querySelector(".personal-day-card");
  const form = shell.querySelector("form");
  const input = shell.querySelector("input");
  const submit = shell.querySelector("button[type=submit]");
  const result = shell.querySelector(".personal-day-result");
  shell.querySelector(".personal-day-close").onclick = () => shell.remove();
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 8);
    input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
    submit.disabled = digits.length !== 8;
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const birth = parseBirthDate(input.value);
    const error = shell.querySelector(".personal-day-error");
    if (!birth) { error.hidden = false; error.textContent = "Введите дату в формате ДД.ММ.ГГГГ"; return; }
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = "Считаю ваш день…";
    const item = await loadPersonalDay(birth);
    result.hidden = false;
    result.innerHTML = `<section class="personal-day-main"><span class="personal-day-code">${item.energy} · ${item.calendarDay}</span><p class="personal-day-label">ВАШ ДЕНЬ</p>${paragraphs([item.text])}${item.todayNeed?.length ? `<section class="personal-day-advice personal-day-need"><h4><span class="personal-day-advice-icon">✓</span> Сегодня нужно</h4><ul>${bullets(item.todayNeed)}</ul></section>` : ""}${item.todayAvoid?.length ? `<section class="personal-day-advice personal-day-avoid"><h4><span class="personal-day-advice-icon">×</span> Сегодня нельзя</h4><ul>${bullets(item.todayAvoid)}</ul></section>` : ""}</section>`;
    submit.textContent = "Рассчитать личный день";
    submit.disabled = false;
  };
};
