import { getRedFlagDateKey, assertCompleteRedFlagBank } from "./redflag-date-keys.js?v=2";

const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить текстовую базу: ${path}`);
  return response.json();
};

// The money block used to have a separate loader with a different date rule.
// Now all authored texts follow the same exact-date JSON format.
export const loadQuestionBank = async (bankName) => {
  const bankFile = bankName === "money" ? "money-questions.json?v=14" : `${bankName}.json`;
  const bank = await loadJson(`./data/redflag/banks/${bankFile}`);
  const questionTexts = await Promise.all(bank.questions.map((question) =>
    question.textFile ? loadJson(`./data/redflag/${question.textFile}`) : null
  ));

  return {
    QUESTIONS: bank.questions.map((question, index) => {
      const textBank = questionTexts[index];
      if (textBank) {
        // Validate ONCE when loading each question, not on every user's click.
        const entries = assertCompleteRedFlagBank(textBank, question.id);
        return {
          id: question.id,
          title: question.title,
          answer: (profile) => {
            const key = getRedFlagDateKey(profile.birthDate);
            const text = entries[key];
            if (typeof text !== "string" || !text.trim()) {
              throw new Error(`Ответ для ${question.id} и ${key} не найден`);
            }
            return { paragraphs: text.split(/\n\s*\n/).filter(Boolean) };
          }
        };
      }

      // No approximation: until 366 authored readings exist, do not present
      // one of three generic old variants as a personalised interpretation.
      return {
        id: question.id,
        title: question.title,
        answer: () => ({ answer: "Готовим новую авторскую трактовку для этого вопроса." })
      };
    })
  };
};

export const loadCategoryCatalog = () => loadJson("./data/redflag/catalog.json");
