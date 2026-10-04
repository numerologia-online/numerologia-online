const loadJson = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить текстовую базу: ${path}`);
  return response.json();
};

export const loadQuestionBank = async (bankName) => {
  const bank = await loadJson(`./data/redflag/banks/${bankName}.json`);
  return {
    QUESTIONS: bank.questions.map((question) => ({
      id: question.id,
      title: question.title,
      answer: (profile) => {
        const variant = question.variants[profile[question.aspect]] ?? Object.values(question.variants)[0];
        const answer = `${variant.answer}${question.usePeriod ? ` ${profile.periodNote}` : ""}`;
        return { verdict: variant.verdict, answer, observation: question.observation };
      }
    }))
  };
};

export const loadCategoryCatalog = () => loadJson("./data/redflag/catalog.json");
