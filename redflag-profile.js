// Shared calculation profile for the “Мужчина или Red Flag” feature.
// It deliberately keeps Matrix energies 1–22 intact. Only values above 22
// are folded by adding digits: 31 → 4, 29 → 11, 15 stays 15, 10 stays 10.

const digitSum = (value) => String(Math.abs(Math.trunc(value)))
  .split("")
  .reduce((sum, digit) => sum + Number(digit), 0);

export const reduce22 = (value) => {
  let result = Math.abs(Math.trunc(value));
  while (result > 22) result = digitSum(result);
  return result || 22;
};

export const reduce9 = (value) => {
  let result = Math.abs(Math.trunc(value));
  while (result > 9) result = digitSum(result);
  return result || 9;
};

const ageOn = (birthDate, now) => {
  let age = now.getFullYear() - birthDate.year;
  const birthdayPassed = now.getMonth() + 1 > birthDate.month
    || (now.getMonth() + 1 === birthDate.month && now.getDate() >= birthDate.day);
  if (!birthdayPassed) age -= 1;
  return age;
};

/**
 * Builds the small, reusable set of numbers that every Red Flag question may use.
 * A question chooses only the fields it needs; it must not turn all of them into
 * one generic answer.
 */
export const buildRedFlagProfile = (birthDate, now = new Date()) => {
  const dayEnergy = reduce22(birthDate.day);
  const yearEnergy = reduce22(digitSum(birthDate.year));
  const lifeEnergy = reduce22(dayEnergy + birthDate.month + yearEnergy);
  const age = ageOn(birthDate, now);
  const agePeriod = age < 20
    ? { source: "день рождения", energy: dayEnergy }
    : age < 40
      ? { source: "месяц рождения", energy: birthDate.month }
      : { source: "год рождения", energy: yearEnergy };

  const birthdayThisYear = new Date(now.getFullYear(), birthDate.month - 1, birthDate.day);
  const cycleYear = now < birthdayThisYear ? now.getFullYear() - 1 : now.getFullYear();
  const personalYear = reduce9(birthDate.day + birthDate.month + digitSum(cycleYear));
  const personalMonth = reduce9(personalYear + now.getMonth() + 1);

  return {
    dayEnergy,
    lifeEnergy,
    age,
    agePeriod,
    personalYear,
    personalMonth
  };
};
