import { answerMoneyQuestion } from "../../../redflag-money-composer.js?v=3";
import { answerGiftPilot } from "../../../redflag-gift-pilot.js?v=5";

const bank = await fetch(new URL("../banks/money-questions.json", import.meta.url)).then((response) => response.json());

export const QUESTIONS = bank.questions.map(({ id, title }) => ({
  id,
  title,
  answer: (profile) => id === "gift" ? answerGiftPilot(profile.classic.birthDate) : answerMoneyQuestion(profile.classic, id)
}));
