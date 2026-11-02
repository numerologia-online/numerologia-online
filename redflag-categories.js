import { loadCategoryCatalog, loadQuestionBank } from "./redflag-text-bank.js?v=20261102romance4";

const catalog = await loadCategoryCatalog();

export const REDFLAG_CATEGORIES = catalog.map((category) => ({
  ...category,
  // Public question metadata is available without Telegram login.
  // Paid answer content is fetched independently, on demand.
  load: () => loadQuestionBank(category.bank)
}));
