import { reduce22 } from "../../../redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${path}`);
  return response.json();
};

const bank = await loadJson("../banks/money-questions.json");
const textBanks = await Promise.all(bank.questions.map((question) =>
  question.textFile ? loadJson(`../${question.textFile}`) : null
));

export const QUESTIONS = bank.questions.map((question, index) => ({
  id: question.id,
  title: question.title,
  answer: (profile) => {
    const textBank = textBanks[index];
    if (!textBank) return { answer: "Готовим новую авторскую трактовку для этого вопроса." };
    if (textBank.questionId !== question.id || textBank.keyRule !== "reduce22(day)-month") {
      throw new Error(`Некорректная база ответов: ${question.id}`);
    }
    const { day, month } = profile.classic.birthDate;
    const key = `${reduce22(day)}-${month}`;
    return { answer: textBank.entries[key] ?? "Новая трактовка для этой даты ещё готовится." };
  }
}));
