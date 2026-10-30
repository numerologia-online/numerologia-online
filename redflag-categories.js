import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=41";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  load: () => category.bank === "money"
    ? import("./data/redflag/categories/money-questions.js?v=38")
    : loadQuestionBank(category.bank)
}));
