import { reduce22 } from "./redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить текстовую базу: ${path}`);
  return response.json();
};

export const loadQuestionBank = async (bankName) => {
  const bank = await loadJson(`./data/redflag/banks/${bankName}.json`);
  const textBankRequests = new Map();

  const loadTextBank = (question) => {
    if (!textBankRequests.has(question.id)) {
      const request = loadJson(`./data/redflag/${question.textFile}`).catch((error) => {
        textBankRequests.delete(question.id);
        throw error;
      });
      textBankRequests.set(question.id, request);
    }
    return textBankRequests.get(question.id);
  };

  return {
    QUESTIONS: bank.questions.map((question) => {
      if (question.textFile) {
        return {
          id: question.id,
          title: question.title,
          priceRub: question.priceRub,
          answer: async (profile) => {
            const textBank = await loadTextBank(question);
            if (textBank.questionId !== question.id || !["reduce22(day)-month", "day-month"].includes(textBank.keyRule)) {
              throw new Error(`Неверный формат текстовой базы: ${question.id}`);
            }
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
        priceRub: question.priceRub,
        answer: (profile) => {
          if (!question.variants) return { answer: "Готовим новую авторскую трактовку для этого вопроса." };
          const variant = question.variants[profile[question.aspect]] ?? Object.values(question.variants)[0];
          const answer = `${variant.answer}${question.usePeriod ? ` ${profile.periodNote}` : ""}`;
          return { verdict: variant.verdict, answer, observation: question.observation };
        }
      };
    })
  };
};

export const loadCategoryCatalog = () => loadJson("./data/redflag/catalog.json");
