import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=4";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  load: () => category.bank === "money"
    ? import("./data/redflag/categories/money-questions.js?v=22")
    : loadQuestionBank(category.bank)
}));
