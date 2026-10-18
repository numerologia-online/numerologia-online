import { getRedFlagDateKey, assertCompleteRedFlagBank } from "../../../redflag-date-keys.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${path}`);
  return response.json();
};

const bank = await loadJson("../banks/money-questions.json?v=14");
const textBanks = await Promise.all(bank.questions.map((question) =>
  question.textFile ? loadJson(`../${question.textFile}`) : null
));

export const QUESTIONS = bank.questions.map((question, index) => ({
  id: question.id,
  title: question.title,
  answer: (profile) => {
    const textBank = textBanks[index];
    if (!textBank) return { answer: "Готовим новую авторскую трактовку для этого вопроса." };
    assertCompleteRedFlagBank(textBank, question.id);
    const { day, month } = profile.classic.birthDate;
    const key = getRedFlagDateKey({ day, month });
    const text = textBank.entries[key];
    return text
      ? { paragraphs: text.split(/\n\s*\n/).filter(Boolean) }
      : { answer: "Новая трактовка для этой даты ещё готовится." };
  }
}));
