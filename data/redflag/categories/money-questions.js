import { reduce22 } from "../../../redflag-profile.js?v=1";

const loadJson = async (path) => {
  // Do not allow public fallback for answer banks.
  const isAnswer = /^\.\.\/([a-z0-9-]+)\/([a-z0-9-]+)\.json(?:\?[^#]*)?$/.test(path);
  if (isAnswer) {
    const initData = window.Telegram?.WebApp?.initData || "";
    if (!initData) throw new Error("SECURE_REDFLAG_TELEGRAM_REQUIRED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("https://нумерология.online/api/redflag-content.php", {
        method: "POST", mode: "cors", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: initData, path: "./data/redflag/" + path.replace(/^\.\.\//, "").split("?")[0] }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error("SECURE_REDFLAG_HTTP_" + response.status);
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data) || data.ok === false) throw new Error("SECURE_REDFLAG_INVALID_RESPONSE");
      window.__numiRedflagSource = "secure";
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${path}`);
  return response.json();
};

// Only titles and file paths are loaded when the category opens.
// The chosen question's text bank is fetched once, on demand.
const bank = await loadJson("../banks/money-questions.json?v=34");
const textBankRequests = new Map();

const loadTextBank = (question) => {
  if (!textBankRequests.has(question.id)) {
    const request = loadJson(`../${question.textFile}`).catch((error) => {
      textBankRequests.delete(question.id); // Allow retry after network failure.
      throw error;
    });
    textBankRequests.set(question.id, request);
  }
  return textBankRequests.get(question.id);
};

export const QUESTIONS = bank.questions.map((question) => ({
  id: question.id,
  title: question.title,
  priceRub: question.priceRub,
  answer: async (profile) => {
    if (!question.textFile) {
      return { answer: "Готовим новую авторскую трактовку для этого вопроса." };
    }
    const textBank = await loadTextBank(question);
    if (textBank.questionId !== question.id || !["reduce22(day)-month", "day-month"].includes(textBank.keyRule)) {
      throw new Error(`Некорректная база ответов: ${question.id}`);
    }
    const { day, month } = profile.classic.birthDate;
    const key = `${textBank.keyRule === "day-month" ? day : reduce22(day)}-${month}`;
    const text = textBank.entries[key];
    return text
      ? { paragraphs: text.split(/\n\s*\n/).filter(Boolean) }
      : { answer: "Новая трактовка для этой даты ещё готовится." };
  }
}));
