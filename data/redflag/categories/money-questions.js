import { reduce22 } from "../../../redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${path}`);
  return response.json();
};

// Only titles and file paths are loaded when the category opens.
// The chosen question's text bank is fetched once, on demand.
const bank = await loadJson("../banks/money-questions.json?v=26");
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
