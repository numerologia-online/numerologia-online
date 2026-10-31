import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=20261031reg1";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  load: () => category.bank === "money"
    ? import("./data/redflag/categories/money-questions.js?v=20261030secure1")
    : loadQuestionBank(category.bank)
}));
