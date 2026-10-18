// Compatibility entry point. All questions now use the same JSON loader.
import { loadQuestionBank } from "../../../redflag-text-bank.js?v=5";

export const { QUESTIONS } = await loadQuestionBank("money");
