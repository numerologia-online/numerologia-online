import { answerMoneyQuestion } from "../../../redflag-money-composer.js?v=3";
import { answerGiftPilot } from "../../../redflag-gift-pilot.js?v=5";
import { answerGenerosityLayers } from "../generosity-layers-composer.js?v=1";

const bank = await fetch(new URL("../banks/money-questions.json", import.meta.url)).then((response) => response.json());

export const QUESTIONS = bank.questions.map(({ id, title }) => ({
  id,
  title,
  answer: (profile) => id === "gift"
    ? answerGiftPilot(profile.classic.birthDate)
    : id === "generosity"
      ? answerGenerosityLayers(profile.matrix)
      : answerMoneyQuestion(profile.classic, id)
}));
