import { reduce22 } from "./redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить текстовую базу: ${path}`);
  return response.json();
};

export const loadQuestionBank = async (bankName) => {
  const bank = await loadJson(`./data/redflag/banks/${bankName}.json`);
  const questionTexts = await Promise.all(bank.questions.map((question) =>
    question.textFile ? loadJson(`./data/redflag/${question.textFile}`) : null
  ));

  return {
    QUESTIONS: bank.questions.map((question, index) => {
      const textBank = questionTexts[index];
      if (textBank) {
        if (textBank.questionId !== question.id || !["reduce22(day)-month", "day-month"].includes(textBank.keyRule)) {
          throw new Error(`Неверный формат текстовой базы: ${question.id}`);
        }
        return {
          id: question.id,
          title: question.title,
          answer: (profile) => {
            const { day, month } = profile.classic.birthDate;
            const key = `${textBank.keyRule === "day-month" ? day : reduce22(day)}-${month}`;
            const answer = textBank.entries[key];
            if (typeof answer !== "string" || !answer.trim()) {
              throw new Error(`Ответ для ${question.id} и ${key} не найден`);
            }
            return { answer };
          }
        };
      }

      return {
        id: question.id,
        title: question.title,
        answer: (profile) => {
          const variant = question.variants[profile[question.aspect]] ?? Object.values(question.variants)[0];
          const answer = `${variant.answer}${question.usePeriod ? ` ${profile.periodNote}` : ""}`;
          return { verdict: variant.verdict, answer, observation: question.observation };
        }
      };
    })
  };
};

export const loadCategoryCatalog = () => loadJson("./data/redflag/catalog.json");
