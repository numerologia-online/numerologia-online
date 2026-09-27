export const REDFLAG_CATEGORIES = [
  { id: "money", kicker: "Деньги и щедрость", title: "Деньги и щедрость", description: "Подарки, вклад, ответственность и опора", load: () => import("./redflag-money.js?v=1") },
  { id: "love", kicker: "Любовь и отношения", title: "Любовь и отношения", description: "Инициатива, зрелость, интерес и формат близости", load: () => import("./redflag-love.js?v=2") },
  { id: "flags", kicker: "Красные флаги", title: "Красные флаги", description: "Качели, контроль, давление и границы", load: () => import("./redflag-flags.js?v=1") },
  { id: "infidelity", kicker: "Измены и флирт", title: "Измены и флирт", description: "Верность, соблазны, честность и границы", load: () => import("./redflag-infidelity.js?v=1") },
  { id: "intimacy", kicker: "Секс и близость", title: "Секс и близость", description: "Темперамент, желание, нежность и уважение", load: () => import("./redflag-intimacy.js?v=1") },
  { id: "family", kicker: "Семья и быт", title: "Семья и быт", description: "Самостоятельность, дом, планы и ответственность", load: () => import("./redflag-family.js?v=1") },
  { id: "language", kicker: "Язык любви мужчины", title: "Язык любви мужчины", description: "Как говорить, просить и быть услышанной", load: () => import("./redflag-language.js?v=1") },
  { id: "verdict", kicker: "Итоговый вердикт", title: "Итоговый вердикт", description: "Собрать наблюдения в честную картину", load: () => import("./redflag-verdict.js?v=1") }
];
