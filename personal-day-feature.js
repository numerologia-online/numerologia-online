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
const todayLabel = () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
const monthTitle = (date) => new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
const calendarInfo = (energy) => {
  if ([8, 17, 19].includes(energy)) return { status: "good", label: "День денег и покупок" };
  if ([1, 10, 21].includes(energy)) return { status: "good", label: "День действий и важных решений" };
  if ([2, 11, 23].includes(energy)) return { status: "good", label: "День разговоров и честного признания" };
  if ([4, 22].includes(energy)) return { status: "good", label: "День документов и порядка" };
  if ([6, 14, 20].includes(energy)) return { status: "good", label: "День встреч и отношений" };
  if ([3, 7, 9].includes(energy)) return { status: "chance", label: "День удовольствия и восстановления" };
  if ([5, 12].includes(energy)) return { status: "chance", label: "Неожиданный шанс и полезная подсказка" };
  if ([15, 16].includes(energy)) return { status: "avoid", label: "Не делайте этого на эмоциях" };
  if ([18, 24].includes(energy)) return { status: "risk", label: "Осторожно: разговоры и резкие реакции" };
  if ([13, 25].includes(energy)) return { status: "risk", label: "Осторожно: не возвращайтесь к старому" };
  if ([26, 28].includes(energy)) return { status: "risk", label: "Осторожно: покупки и крупные траты" };
  if ([27, 29].includes(energy)) return { status: "avoid", label: "Сначала успокойтесь, потом решайте" };
  return { status: "neutral", label: "" };
};
const calendarStatus = (energy) => calendarInfo(energy).status;
const monthCalendar = (birth, date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const total = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const offset = (first + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push('<span class="personal-month-empty"></span>');
  for (let day = 1; day <= total; day += 1) {
    const current = new Date(year, month, day);
    const energy = personalDay(birth, current);
    const info = calendarInfo(energy);
    const locked = day > openUntil;
    cells.push(`<button type="button" class="personal-month-day personal-month-${locked ? "locked" : info.status}" data-month-day="${day}" ${locked ? "aria-label=\"День закрыт до подписки\"" : `aria-label="День ${day}, ${esc(info.label || `личный день ${energy}`)}"`}>${day}${locked ? '<span class="personal-month-lock">•</span>' : ""}</button>`);
  }
  return `<section class="personal-month-preview">
    <div class="personal-month-heading"><div><p class="personal-month-kicker">Карта ближайших дней</p><h3>${esc(monthTitle(date))}</h3></div><span class="personal-month-mark">✦</span></div>
    <div class="personal-month-weekdays">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="personal-month-grid">${cells.join("")}</div>
    <div class="personal-month-legend"><span><i class="personal-month-dot good"></i>Хороший день</span><span><i class="personal-month-dot chance"></i>Очень важный шанс</span><span><i class="personal-month-dot risk"></i>Осторожно</span><span><i class="personal-month-dot avoid"></i>Не делайте этого</span></div>
    <button type="button" class="personal-month-open">Открыть разбор месяца <span>→</span></button>
    <section class="personal-month-details" hidden>
      <p class="personal-month-details-lead">Здесь собраны самые заметные даты месяца. Остальные дни остаются обычными и не требуют отдельного разбора.</p>
      <div class="personal-month-detail-list"></div>
    </section>
  </section>`;
};

export const openPersonalDay = () => {
  const shell = document.createElement("section");
  shell.className = "personal-day-overlay personal-day-page-overlay";
  shell.innerHTML = `<div class="personal-day-card personal-day-page" role="dialog" aria-modal="true"><button class="personal-day-close" type="button" aria-label="Закрыть">×</button><p class="eyebrow">Личный прогноз</p><h2>Ваш личный расчёт дня</h2><p class="personal-day-lead">Личный разбор дня подскажет, куда направить силы, какой шаг сделать, чего избегать, к каким чувствам прислушаться и какие тайны бережно хранит для вас этот день.</p><section class="personal-day-form-panel"><p class="personal-day-form-kicker">РАССЧИТАЙТЕ СВОЙ ЛИЧНЫЙ ДЕНЬ</p><p class="personal-day-date">Сегодня ${todayLabel()}</p><form><label><span>Дата рождения</span><input required type="tel" inputmode="numeric" autocomplete="bday" placeholder="09.09.1986" maxlength="10"></label><button class="personal-day-submit" type="submit" disabled>Рассчитать личный день</button><p class="personal-day-error" hidden></p></form></section><section class="personal-day-result" hidden></section></div>`;
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
    result.insertAdjacentHTML("beforeend", monthCalendar(birth));
    const monthDetails = result.querySelector(".personal-month-details");
    const monthList = result.querySelector(".personal-month-detail-list");
    result.querySelector(".personal-month-open")?.addEventListener("click", async (event) => {
      const opened = !monthDetails.hidden;
      monthDetails.hidden = opened;
      event.currentTarget.innerHTML = opened ? "Открыть разбор месяца <span>→</span>" : "Скрыть разбор месяца <span>↑</span>";
      if (!opened && !monthList.dataset.ready) {
        const now = new Date();
        const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(now);
        const days = await Promise.all(Array.from({ length: total }, (_, index) => {
          const day = index + 1;
          return loadPersonalDay(birth, new Date(now.getFullYear(), now.getMonth(), day)).then((item) => ({
            day, item, info: calendarInfo(item.energy)
          }));
        }));
        monthList.innerHTML = days.map(({ day, item, info }) => `
          <details class="personal-month-day-card personal-month-detail-${info.status}">
            <summary><span><strong>${day} ${monthName}</strong><em>${esc(info.label || "Личный день")}</em></span><b>+</b></summary>
            <div class="personal-month-day-content">
              <p>${esc(item.text)}</p>
              ${item.todayNeed?.length ? `<div class="personal-month-mini need"><strong>Сегодня нужно</strong><ul>${bullets(item.todayNeed)}</ul></div>` : ""}
              ${item.todayAvoid?.length ? `<div class="personal-month-mini avoid"><strong>Сегодня нельзя</strong><ul>${bullets(item.todayAvoid)}</ul></div>` : ""}
            </div>
          </details>`).join("");
        monthList.dataset.ready = "1";
      }
    });
    result.querySelectorAll("[data-month-day]:not(.personal-month-locked)").forEach((button) => button.addEventListener("click", () => {
      const chosen = new Date(new Date().getFullYear(), new Date().getMonth(), Number(button.dataset.monthDay));
      alert(`Личный день ${personalDay(birth, chosen)} уже рассчитан в вашем календаре.`);
    }));
    requestAnimationFrame(() => { card.scrollTo({ top: Math.max(0, result.offsetTop - 8), behavior: "instant" }); });
    submit.textContent = "Рассчитать личный день";
    submit.disabled = false;
  };
};
