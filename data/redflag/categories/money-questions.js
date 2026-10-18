import { reduce22 } from "../../../redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${path}`);
  return response.json();
};

const bank = await loadJson("../banks/money-questions.json?v=12");
const textBanks = await Promise.all(bank.questions.map((question) =>
  question.textFile ? loadJson(`../${question.textFile}`) : null
));

export const QUESTIONS = bank.questions.map((question, index) => ({
  id: question.id,
  title: question.title,
  answer: (profile) => {
    const textBank = textBanks[index];
    if (!textBank) return { answer: "Готовим новую авторскую трактовку для этого вопроса." };
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
