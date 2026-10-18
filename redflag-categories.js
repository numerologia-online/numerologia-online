import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=5";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  load: () => loadQuestionBank(category.bank)
}));
