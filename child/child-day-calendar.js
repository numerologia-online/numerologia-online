import { calculateChildDay } from "./child-day-engine.js?v=1";

// Base for the child's month calendar: same date calculation as the adult day.
// Unlike adult finance/risk categories, every child marker needs an approved child-specific rule.
export const buildChildMonth = (birth, selectedDate, markers = {}) => {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day);
    const result = calculateChildDay(birth, date);
    const marker = markers?.entries?.[result.energy + "-" + result.personalNumber];
    const type = ["support", "opportunity", "attention"].includes(marker?.category)
      ? marker.category : "neutral";
    days.push({
      day,
      energy: result.energy,
      personalNumber: result.personalNumber,
      type,
      note: type !== "neutral" && typeof marker?.note === "string" ? marker.note : ""
    });
  }
  return { year, month: month + 1, days };
};
