import { parseBirthDate, reduce9 } from "./numerology-core.js?v=1";

const today = () => new Date();
const personalDay = ({ day, month, year }, date = today()) => {
  const yearSum = String(date.getFullYear()).split("").reduce((a, n) => a + Number(n), 0);
  const monthNumber = reduce9(day + month + yearSum);
  const dayNumber = reduce9(day + monthNumber + date.getDate());
  return { year: reduce9(day + month + yearSum), month: monthNumber, day: dayNumber };
};

const texts = {
  1: ["День первого шага", "Сегодня лучше не ждать разрешения. Выберите одно действие и сделайте его без лишних объяснений.", "Не давите на людей и не пытайтесь за один день переделать всю жизнь."],
  2: ["День настройки", "Сегодня важны разговор, мягкость и внимательное отношение к сигналам людей.", "Не копите обиду и не заставляйте других угадывать ваши желания."],
  3: ["День проявления", "Хорошо говорить, писать, показывать себя и выпускать идею наружу.", "Не распыляйтесь на десять дел и не обещайте больше, чем успеете."],
  4: ["День порядка", "День помогает разобрать документы, деньги, планы и всё, что давно откладывалось.", "Не пытайтесь ускорить результат хаотичным рывком."],
  5: ["День движения", "Меняйте маршрут, пробуйте новый формат и не держитесь за то, что стало тесным.", "Не путайте свободу с импульсивностью."],
  6: ["День отношений", "Сегодня важны близкие, честные договорённости и забота без самопожертвования.", "Не спасайте всех ценой собственного ресурса."],
  7: ["День тишины", "Полезны пауза, анализ, обучение и честный разговор с собой.", "Не уходите в холодность и бесконечное откладывание."],
  8: ["День результата", "Считайте деньги, называйте цену и принимайте решения, которые укрепляют опору.", "Не доказывайте силу через конфликт и контроль."],
  9: ["День завершения", "Закройте один старый вопрос и освободите место для следующего шага.", "Не тащите в новый день то, что уже закончилось."]
};

const open = () => {
  const shell = document.createElement("section");
  shell.className = "personal-day-overlay";
  shell.innerHTML = `<div class="personal-day-card" role="dialog" aria-modal="true"><button class="personal-day-close" type="button" aria-label="Закрыть">×</button><p class="eyebrow">Личный расчёт</p><h2>Расчёт на день</h2><form><label>Дата рождения<input required inputmode="numeric" placeholder="09.09.1986" maxlength="10"></label><button class="matrix-submit" type="submit">Рассчитать</button><p class="personal-day-error" hidden></p></form><article hidden></article></div>`;
  document.body.append(shell);
  const card = shell.querySelector(".personal-day-card");
  const form = shell.querySelector("form");
  const input = shell.querySelector("input");
  const result = shell.querySelector("article");
  shell.querySelector(".personal-day-close").onclick = () => shell.remove();
  form.onsubmit = (event) => {
    event.preventDefault();
    const birth = parseBirthDate(input.value.trim());
    if (!birth) return shell.querySelector(".personal-day-error").replaceChildren("Введите дату в формате ДД.ММ.ГГГГ");
    const number = personalDay(birth).day;
    const item = texts[number] || texts[1];
    const title = item.title;
    const good = item.openings?.[0] || item.main?.[0] || "Сегодня важно выбрать главное и действовать спокойно.";
    const avoid = item.avoid || item.main?.[1] || "Не принимайте решения на эмоциях.";
    result.hidden = false;
    result.innerHTML = `<p class="eyebrow">Сегодня ваш личный день</p><h3>${number} · ${title}</h3><p>${good}</p><p><strong>Сегодня лучше не делать:</strong> ${avoid}</p>`;
  };
};

export const openPersonalDay = open;
