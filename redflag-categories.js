import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=42";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  load: () => category.bank === "money"
    ? import("./data/redflag/categories/money-questions.js?v=39")
    : loadQuestionBank(category.bank)
}));
