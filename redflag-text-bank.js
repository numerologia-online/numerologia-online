import { reduce22 } from "./redflag-profile.js?v=1";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить текстовую базу: ${path}`);
  return response.json();
};

export const loadQuestionBank = async (bankName) => {
  const bankVersion = bankName === "love" ? "?v=2" : bankName === "intimacy" ? "?v=2" : bankName === "family" ? "?v=2" : bankName === "language" ? "?v=2" : bankName === "flags" ? "?v=2" : "";
  const bank = await loadJson(`./data/redflag/banks/${bankName}.json${bankVersion}`);
  const textBankRequests = new Map();

  // Load approved full-length love answers for the explicitly approved dates only.
  // All other dates keep their previous lookup or variant-based answer.
  const publishedLoveDates = new Set(["31-1", "1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "8-2", "9-2", "10-2", "11-2", "12-2", "13-2", "15-2", "16-2", "17-2", "18-2", "23-2", "24-2", "25-2", "26-2", "27-2", "28-2", "29-2"]);
  const publishedLoveRequests = new Map();

  const loadPublishedLoveAnswer = async (question, profile) => {
    if (bankName !== "love") return null;
    const { day, month } = profile.classic.birthDate;
    const dateKey = `${day}-${month}`;
    if (!publishedLoveDates.has(dateKey)) return null;

    if (!publishedLoveRequests.has(dateKey)) {
      const request = loadJson(`./data/redflag/love/published/${dateKey}.json?v=1`)
        .catch((error) => {
          publishedLoveRequests.delete(dateKey);
          throw error;
        });
      publishedLoveRequests.set(dateKey, request);
    }

    const published = await publishedLoveRequests.get(dateKey);
    if (published.schemaVersion !== 1 || published.dateKey !== dateKey) {
      throw new Error("Неверный формат опубликованных трактовок: " + dateKey);
    }
    const answer = published.entries?.[question.id];
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("Нет утверждённой трактовки: " + question.id + " / " + dateKey);
    }
    return { answer };
  };

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
            const published = await loadPublishedLoveAnswer(question, profile);
            if (published) return published;
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
        answer: async (profile) => {
          const published = await loadPublishedLoveAnswer(question, profile);
          if (published) return published;
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
