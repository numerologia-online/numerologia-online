// Детский личный день: ТОЧНАЯ формула действующего взрослого раздела.
// Важны две независимые координаты: энергия 1..22 и персональная позиция 1..31.
// Возраст влияет только на подачу текста, никогда на нумерологический результат.
const sumDigits = (number) =>
  String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);

const reduce9 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 9) n = sumDigits(n);
  return n || 9;
};

const reduceTo = (value, maximum) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > maximum) n -= maximum;
  return n || maximum;
};

const lifePathNumber = ({ day, month, year }) => {
  let n = sumDigits(day) + sumDigits(month) + sumDigits(year);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = sumDigits(n);
  return n;
};

export const calculateChildDay = ({ day, month, year }, date = new Date()) => {
  const calendarDay = date.getDate();
  const currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();
  const personalYear = reduce9(day + month + sumDigits(currentYear));
  const personalMonth = reduce9(personalYear + currentMonth);
  const personalDay = reduce9(personalMonth + calendarDay);
  const universalDay = reduce9(calendarDay + currentMonth + sumDigits(currentYear));
  const lifePath = lifePathNumber({ day, month, year });
  const energy = reduceTo(personalDay + personalMonth + universalDay + day + currentMonth, 22);
  const personalNumber = reduceTo(lifePath + day + calendarDay + sumDigits(year), 31);
  return { energy, personalNumber, calendarDay, personalYear, personalMonth, personalDay, universalDay };
};

export const getChildAgeBand = (birth, date = new Date()) => {
  const age = date.getFullYear() - birth.year
    - (date.getMonth() + 1 < birth.month ||
      (date.getMonth() + 1 === birth.month && date.getDate() < birth.day) ? 1 : 0);
  if (age < 6) return "young";
  if (age < 12) return "school";
  if (age < 18) return "teen";
  return "grown";
};

const normalizeStrings = (value) =>
  (Array.isArray(value) ? value : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());

const readReadyEntry = (bank, personalNumber) => {
  const entry = bank?.entries?.[String(personalNumber)];
  return entry?.status === "ready" && typeof entry.text === "string" && entry.text.trim() ? entry : null;
};

// Do not load 22 banks at once; one small JSON per calculated energy.
// Until the author approves an entry, the existing 22 short child texts remain visible.
const cache = new Map();
const loadEnergyBank = (energy) => {
  if (!cache.has(energy)) {
    const name = String(energy).padStart(2, "0");
    const request = fetch("./data/day/entries/child-day-" + name + ".json?v=1")
      .then((response) => {
        if (!response.ok) throw new Error("Нет детского банка для энергии " + name);
        return response.json();
      }).catch(() => null);
    cache.set(energy, request);
  }
  return cache.get(energy);
};

export const loadChildDayReading = async (birth, targetDate, legacyFallback) => {
  const calculation = calculateChildDay(birth, targetDate);
  const {energy, personalNumber} = calculation;
  const ageBand = getChildAgeBand(birth, targetDate);
  const bank = await loadEnergyBank(energy);
  const authored = readReadyEntry(bank, personalNumber);
  const legacy = legacyFallback?.entries?.[energy + "-" + personalNumber]
    || legacyFallback?.fallback?.[String(energy)] || {};
  const ageHint = authored?.ageHints?.[ageBand];
  const reading = authored ? {
    text: authored.text.trim(),
    todayNeed: normalizeStrings(authored.todayNeed),
    todayAvoid: normalizeStrings(authored.todayAvoid),
    parentAttention: normalizeStrings(authored.parentAttention),
    ageHint: typeof ageHint === "string" ? ageHint.trim() : "",
    authored: true
  } : {
    text: typeof legacy.text === "string" ? legacy.text : "Трактовка этого дня готовится.",
    todayNeed: typeof legacy.try === "string" && legacy.try.trim() ? [legacy.try.trim()] : [],
    todayAvoid: [],
    parentAttention: typeof legacy.care === "string" && legacy.care.trim() ? [legacy.care.trim()] : [],
    ageHint: "",
    authored: false
  };
  return { ...calculation, ageBand, ...reading };
};
