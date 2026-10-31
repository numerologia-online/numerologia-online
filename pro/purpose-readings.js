// A separate authored interpretation bank for the four kinds of purpose.
// Never mutate knowledge/full-report/energies.json or the approved 14 readings.
const purposeScopes = ["personal", "social", "general", "planetary"];
let request;
export function loadPurposeReadings() {
  if (!request) {
    request = Promise.all(purposeScopes.map(async scope => {
      const response = await fetch("pro/purpose/" + scope + ".json?v=1");
      if (!response.ok) throw new Error("Не удалось загрузить тексты предназначения");
      const data = await response.json();
      if (data.schema !== "purpose-reading-v1" || data.scope !== scope) {
        throw new Error("Неверный формат базы предназначения: " + scope);
      }
      const readings = data.readings || {};
      if (Object.keys(readings).length !== 22 ||
          Array.from({length:22}, (_, i) => i + 1).some(n => !readings[String(n)])) {
        throw new Error("Неполная база предназначения: " + scope);
      }
      return [scope, readings];
    })).then(parts => Object.fromEntries(parts)).catch(error => {
      request = null;
      throw error;
    });
  }
  return request;
}
export function getPurposeReading(bank, scope, number) {
  const result = bank?.[scope]?.[String(number)];
  if (typeof result !== "string" || !result.trim()) {
    throw new Error("Не найдена трактовка предназначения " + scope + " · " + number);
  }
  return result;
}
