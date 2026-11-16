import { readProJson } from "./secure-reader.js?v=life-content-20261116";

export const loadPurposeReadings = birth => readProJson("purpose", birth);

export function getPurposeReading(bank, scope, number) {
  const result = bank?.[scope]?.[String(number)];
  if (typeof result !== "string" || !result.trim()) {
    throw new Error("Не найдена трактовка предназначения " + scope + " · " + number);
  }
  return result;
}
