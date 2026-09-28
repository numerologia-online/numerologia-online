import { answerMoneyQuestion } from "./redflag-money-composer.js?v=1";
import { answerGiftPilot } from "./redflag-gift-pilot.js?v=3";

const question = (id, title) => ({
  id,
  title,
  answer: (profile) => id === "gift"
    ? answerGiftPilot(profile.classic.birthDate)
    : answerMoneyQuestion(profile.classic, id)
});

export const QUESTIONS = [
  question("gift", "Дарит без повода или считает, что его присутствия уже достаточно?"),
  question("generosity", "Щедрый или будет считать каждую копейку?"),
  question("provider", "Добытчик по жизни или философ с дивана?"),
  question("courtship", "Ухаживает или ждёт, что всё случится само?"),
  question("words-or-deeds", "Красиво говорит или реально делает?"),
  question("family-load", "Семью потянет или опять всё окажется на женщине?"),
  question("solve-or-create", "Решает вопросы или сам их создаёт?"),
  question("responsibility", "Берёт ответственность или красиво скидывает её на женщину?"),
  question("resource", "Вкладывается в отношения или только пользуется чужим ресурсом?"),
  question("celebration", "На свидании он создаёт настроение или ждёт, что праздник сделают за него?")
];
