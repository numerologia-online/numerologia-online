// Access policy for the public preview of the annual calculation.
// The report is organized by calendar months, even when the personal year changes on a birthday.
// This is an interface rule, NOT a secure substitute for a server-side paid entitlement.
export const freeYearMonthLimit = (reportYear, now = new Date()) => {
  const requested = Number(reportYear);
  if (!Number.isInteger(requested) || !(now instanceof Date) || Number.isNaN(now.getTime())) return 0;
  const currentYear = now.getFullYear();
  if (requested < currentYear) return 12;
  if (requested > currentYear) return 0;
  return now.getMonth(); // Oct -> 9 (through September), Nov -> 10 (through October).
};
export const isFreeYearMonth = (reportYear, calendarMonth, now = new Date()) =>
  Number.isInteger(calendarMonth) && calendarMonth >= 1 &&
  calendarMonth <= freeYearMonthLimit(reportYear, now);
