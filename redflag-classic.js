const digitSum = (value) => String(Math.abs(Math.trunc(value))).split("").reduce((total, digit) => total + Number(digit), 0);

const reduceCycle = (value) => {
  let result = Math.abs(Math.trunc(value));
  while (result > 9) result = digitSum(result);
  return result || 9;
};

const reduceLife = (value) => {
  let result = Math.abs(Math.trunc(value));
  if (result > 33) result = digitSum(result);
  const compound = result;
  while (result > 9 && ![11, 22, 33].includes(result)) result = digitSum(result);
  return { compound, value: result };
};

const ageOn = (birthDate, now) => {
  let age = now.getFullYear() - birthDate.year;
  const birthdayPassed = now.getMonth() + 1 > birthDate.month
    || (now.getMonth() + 1 === birthDate.month && now.getDate() >= birthDate.day);
  if (!birthdayPassed) age -= 1;
  return age;
};

const personalYearFor = (birthDate, year) => reduceCycle(birthDate.day + birthDate.month + digitSum(year));

export const buildClassicProfile = (birthDate, now = new Date()) => {
  const age = ageOn(birthDate, now);
  const yearNumber = digitSum(birthDate.year);
  const life = reduceLife(birthDate.day + birthDate.month + yearNumber);
  const activePeriod = age < 20
    ? { source: "день рождения", raw: birthDate.day, value: reduceCycle(birthDate.day) }
    : age < 40
      ? { source: "месяц рождения", raw: birthDate.month, value: reduceCycle(birthDate.month) }
      : { source: "год рождения", raw: yearNumber, value: reduceCycle(yearNumber) };
  const birthdayThisYear = new Date(now.getFullYear(), birthDate.month - 1, birthDate.day);
  const cycleYear = now < birthdayThisYear ? now.getFullYear() - 1 : now.getFullYear();
  const personalYear = personalYearFor(birthDate, cycleYear);
  const personalMonth = reduceCycle(personalYear + now.getMonth() + 1);

  return {
    birthDate,
    age,
    day: { raw: birthDate.day, value: reduceCycle(birthDate.day) },
    month: { raw: birthDate.month, value: reduceCycle(birthDate.month) },
    birthYear: { raw: yearNumber, value: reduceCycle(yearNumber) },
    life,
    activePeriod,
    personalYear,
    personalMonth,
    cycleYear
  };
};
