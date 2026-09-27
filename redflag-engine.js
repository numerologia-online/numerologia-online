import { calculateMatrix, calculatePersonalYear } from "./numerology-core.js?v=1";

const includes = (values, value) => values.includes(value);

const initiativeMode = (value) => {
  if (includes([1, 4, 7, 8, 11, 15, 19, 21], value)) return "direct";
  if (includes([2, 6, 9, 12, 14, 18, 20, 22], value)) return "careful";
  return "wave";
};

const affectionMode = (value) => {
  if (includes([3, 6, 17, 19, 21], value)) return "warm";
  if (includes([2, 7, 9, 12, 14], value)) return "reserved";
  return "intense";
};

const commitmentMode = (value) => {
  if (includes([4, 6, 8, 11, 15, 20], value)) return "steady";
  if (includes([2, 7, 9, 12, 18], value)) return "guarded";
  return "restless";
};

const communicationMode = (value) => {
  if (includes([1, 3, 4, 8, 11, 17, 19, 21], value)) return "clear";
  if (includes([2, 6, 9, 12, 14, 18, 20], value)) return "quiet";
  return "avoidant";
};

const periodNotes = {
  1: "Сейчас он больше занят началом нового и проверкой собственной самостоятельности.",
  2: "Сейчас ему важнее чувство безопасности, чем быстрые решения.",
  3: "Сейчас он легче идёт в знакомство, игру и проявление чувств.",
  4: "Сейчас он лучше реагирует на ясность, порядок и реальные договорённости.",
  5: "Сейчас ему особенно трудно переносить ощущение, что его ограничивают.",
  6: "Сейчас тема выбора, близости и ответственности выходит на первый план.",
  7: "Сейчас ему нужно больше личного пространства для собственных выводов.",
  8: "Сейчас он сильнее сфокусирован на результате, статусе и материальной опоре.",
  9: "Сейчас он завершает старые истории; обещания стоит проверять особенно внимательно."
};

export const buildRelationshipProfile = (birthDate) => {
  const matrix = calculateMatrix(birthDate);
  const personalYear = calculatePersonalYear(birthDate);

  return {
    matrix,
    personalYear,
    periodNote: periodNotes[personalYear],
    initiative: initiativeMode(matrix.left),
    affection: affectionMode(matrix.center),
    commitment: commitmentMode(matrix.bottom),
    communication: communicationMode(matrix.top),
    support: commitmentMode(matrix.corners.bottomRight)
  };
};
