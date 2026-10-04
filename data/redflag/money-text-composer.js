const copy = await fetch(new URL("./banks/money-copy.json", import.meta.url)).then((response) => response.json());

const clean = (value) => value.replace(/\s+/g, " ").trim();
const join = (...values) => values.filter(Boolean).join(" ");
const selectEnergy = (profile) => copy.energy[profile.activePeriod.value] ?? copy.energy[profile.life.value] ?? copy.energy[4];
const currentNote = (profile) => copy.monthNote[profile.personalMonth] ?? copy.defaultMonthNote;
const lifeLesson = (profile) => copy.lifeLesson[profile.life.value] ?? copy.lifeLesson[4];
const dayModifier = (profile) => copy.dayModifier[profile.day.raw] ?? "";

const parts = {
  gift: (energy, profile) => [energy.gift, join(energy.shadow, dayModifier(profile)), currentNote(profile)],
  generosity: (energy, profile) => [energy.money, join(energy.shadow, lifeLesson(profile)), currentNote(profile)],
  provider: (energy, profile) => [energy.work, join(lifeLesson(profile), energy.shadow), currentNote(profile)],
  courtship: (energy, profile) => [energy.gift, join(energy.care, energy.shadow), currentNote(profile)],
  "words-or-deeds": (energy, profile) => [energy.work, join(lifeLesson(profile), energy.shadow), currentNote(profile)],
  "family-load": (energy, profile) => [energy.care, join(energy.money, lifeLesson(profile)), currentNote(profile)],
  "solve-or-create": (energy, profile) => [energy.work, join(energy.shadow, lifeLesson(profile)), currentNote(profile)],
  responsibility: (energy, profile) => [energy.care, join(lifeLesson(profile), energy.shadow), currentNote(profile)],
  resource: (energy, profile) => [energy.care, join(energy.money, energy.shadow), currentNote(profile)],
  celebration: (energy, profile) => [energy.gift, join(energy.care, dayModifier(profile)), currentNote(profile)]
};

export const answerMoneyQuestion = (profile, questionId) => {
  const energy = selectEnergy(profile);
  const meta = copy.questions[questionId] ?? copy.questions.gift;
  const paragraphs = (parts[questionId] ?? parts.gift)(energy, profile).map(clean).filter(Boolean);
  return { verdict: meta.verdict, paragraphs, observation: meta.observation };
};
