// Единое правило для всех готовых авторских трактовок Red Flag:
// 366 разных дат (включая 29 февраля), ключ: реальный день-месяц.
// Никаких нумерологических расчётов для выбора готового текста.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Validate the original date as DD.MM.YYYY, without calculating any energies.
// The year is retained only to check that the entered date exists.
export const parseRedFlagBirthDate = (value) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const today = new Date();
  if (year < 1900 || year > today.getFullYear()) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
      date.getDate() !== day) return null;
  return { day, month, year };
};

export const getRedFlagDateKey = ({ day, month }) => {
  if (!Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    throw new Error("Некорректная дата рождения для Red Flag");
  }
  return `${day}-${month}`;
};

export const assertCompleteRedFlagBank = (textBank, questionId) => {
  if (textBank?.questionId !== questionId || textBank?.keyRule !== "day-month") {
    throw new Error(`Некорректное правило выбора даты: ${questionId}`);
  }

  const entries = textBank.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error(`Отсутствует JSON-база ответов: ${questionId}`);
  }

  const validKeys = new Set();
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day += 1) {
      validKeys.add(getRedFlagDateKey({ day, month }));
    }
  }

  const actualKeys = Object.keys(entries);
  if (actualKeys.length !== validKeys.size ||
      actualKeys.some((key) => !validKeys.has(key)) ||
      [...validKeys].some((key) => typeof entries[key] !== "string" || !entries[key].trim())) {
    throw new Error(`База ${questionId} должна содержать 366 заполненных дат, включая 29 февраля`);
  }

  if (new Set(actualKeys.map((key) => entries[key].trim())).size !== validKeys.size) {
    throw new Error(`В базе ${questionId} есть одинаковые трактовки для разных дат`);
  }
  return entries;
};
