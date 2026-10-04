import { buildRedFlagProfile } from "../../redflag-profile.js?v=1";

const GIFT_TRAITS = {
  1: { style: "direct", giving: 7, display: 4, regularity: 5 },
  2: { style: "quiet", giving: 4, display: 1, regularity: 6 },
  3: { style: "showy", giving: 7, display: 8, regularity: 4 },
  4: { style: "practical", giving: 5, display: 3, regularity: 8 },
  5: { style: "spontaneous", giving: 7, display: 4, regularity: 2 },
  6: { style: "caring", giving: 7, display: 3, regularity: 7 },
  7: { style: "thoughtful", giving: 3, display: 1, regularity: 6 },
  8: { style: "showy", giving: 6, display: 8, regularity: 5 },
  9: { style: "meaningful", giving: 6, display: 2, regularity: 5 },
  10: { style: "spontaneous", giving: 5, display: 4, regularity: 3 },
  11: { style: "direct", giving: 7, display: 5, regularity: 5 },
  12: { style: "quiet", giving: 3, display: 1, regularity: 4 },
  13: { style: "direct", giving: 4, display: 3, regularity: 5 },
  14: { style: "practical", giving: 5, display: 2, regularity: 7 },
  15: { style: "showy", giving: 8, display: 9, regularity: 4 },
  16: { style: "spontaneous", giving: 4, display: 5, regularity: 2 },
  17: { style: "showy", giving: 6, display: 7, regularity: 4 },
  18: { style: "quiet", giving: 4, display: 4, regularity: 3 },
  19: { style: "showy", giving: 8, display: 8, regularity: 6 },
  20: { style: "caring", giving: 5, display: 3, regularity: 7 },
  21: { style: "spontaneous", giving: 7, display: 6, regularity: 6 },
  22: { style: "spontaneous", giving: 6, display: 4, regularity: 2 }
};

const copy = await fetch(new URL("./banks/gift-copy.json", import.meta.url)).then((response) => response.json());
const clamp = (value) => Math.max(0, Math.min(10, Math.round(value)));
const weighted = (day, life, period, key) => clamp(day[key] * 0.5 + life[key] * 0.3 + period[key] * 0.2);

const periodNote = (profile) => {
  const { personalMonth, dayEnergy, lifeEnergy, agePeriod } = profile;
  const theme = [1, 3, 5].includes(personalMonth) ? "momentum" : [2, 6].includes(personalMonth) ? "closeness" : [4, 8].includes(personalMonth) ? "reality" : "reflection";
  const notes = copy.periodNotes[theme];
  return notes[(dayEnergy * 19 + lifeEnergy * 7 + agePeriod.energy * 13 + personalMonth * 3) % notes.length];
};

export const answerGiftPilot = (birthDate, now = new Date()) => {
  const profile = buildRedFlagProfile(birthDate, now);
  const day = GIFT_TRAITS[profile.dayEnergy];
  const life = GIFT_TRAITS[profile.lifeEnergy];
  const period = GIFT_TRAITS[profile.agePeriod.energy];
  const selected = copy.answers[day.style];
  return {
    profile,
    scales: [
      { label: copy.scales.giving, value: weighted(day, life, period, "giving") },
      { label: copy.scales.display, value: weighted(day, life, period, "display") }
    ],
    regularity: weighted(day, life, period, "regularity"),
    verdict: selected.verdict,
    paragraphs: [...selected.paragraphs, periodNote(profile)],
    observation: selected.observation
  };
};
