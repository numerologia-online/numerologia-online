import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=redflag-comic-ready-366-20261110";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  // Public question metadata is available without Telegram login.
  // Paid answer content is fetched independently, on demand.
  load: () => loadQuestionBank(category.bank)
}));
