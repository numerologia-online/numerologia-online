import { privateContent } from "./paid-access.js?v=20261031reg1";
export const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const connectionFields = {
  "Название": "title",
  "Основной текст": "general",
  "Деньги": "money",
  "Работа и дело": "work",
  "Отношения": "relationships",
  "Здоровье и ресурс": "health",
  "Опасность": "danger",
  "Что очень важно сделать": "do",
  "Чего категорически не делать": "dont",
  "Главный совет": "advice"
};

const requiredConnectionFields = Object.values(connectionFields);
const cache = new Map();
const emptyEnergy = (energy) => ({ energy, year: null, links: {}, missingConnections: [1, 2, 3, 4, 5, 6, 7, 8, 9] });

const compact = (lines) => lines.join("\n").trim().replace(/\n{2,}/g, " ").replace(/\s+/g, " ");

export const parseEnergyText = (text, expectedEnergy) => {
  const result = { energy: expectedEnergy, year: null, links: {}, missingConnections: [] };
  const lines = text.replace(/\r/g, "").split("\n");
  let section = null;
  let field = null;
  let buffer = [];

  const saveField = () => {
    if (!section || !field) return;
    const value = compact(buffer);
    if (section.type === "year") {
      if (field === "title") section.data.title = value;
      if (field === "text") section.data.text = value;
    }
    if (section.type === "link" && connectionFields[field]) section.data[connectionFields[field]] = value;
    buffer = [];
  };

  const saveSection = () => {
    saveField();
    if (!section) return;
    if (section.type === "year" && section.data.title && section.data.text) result.year = section.data;
    if (section.type === "link") {
      const isComplete = requiredConnectionFields.every((name) => section.data[name]);
      if (isComplete) result.links[section.connection] = section.data;
      else result.missingConnections.push(section.connection);
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      saveSection();
      field = null;
      const heading = line.slice(3).trim();
      if (heading === "Год") section = { type: "year", data: {} };
      else {
        const match = heading.match(/^Связка\s+(\d+)-(\d+)$/);
        section = match ? { type: "link", connection: Number(match[2]), data: {} } : null;
      }
      continue;
    }
    if (line.startsWith("### ")) {
      saveField();
      const heading = line.slice(4).trim();
      field = section?.type === "year" ? ({ "Название": "title", "Описание": "text" }[heading] ?? null) : heading;
      continue;
    }
    if (field) buffer.push(line);
  }
  saveSection();

  if (!result.year) throw new Error(`В энергии ${expectedEnergy} нет блока «Год» с названием и описанием.`);
  return result;
};

// Reuse the independently authored second text bank only when a pair repeats.
export const createMonthlyLinkSelector = (primaryContent, alternateContent) => {
  const seen = new Set();
  return (yearEnergy, monthEnergy) => {
    const key = `${yearEnergy}-${monthEnergy}`;
    const isRepeat = seen.has(key);
    seen.add(key);
    const source = isRepeat ? alternateContent : primaryContent;
    return source[yearEnergy]?.links[monthEnergy] ?? null;
  };
};

export const loadEnergy = (energy, variant = "even") => {
  const cacheKey = `${variant}:${energy}`;
  if (!cache.has(cacheKey)) {
    const path = variant === "odd" ? `data/year/odd/energy-${energy}.txt` : `data/year/energy-${energy}.txt`;
    const request = privateContent(path)
      .then(text => {
        if (typeof text !== "string") throw new Error("Не удалось получить текст разбора");
        return parseEnergyText(text, energy);
      })
      .catch(error => { cache.delete(cacheKey); throw error; });
    cache.set(cacheKey, request);
  }
  return cache.get(cacheKey);
};

export const loadEnergies = async (energies, variant = "even") => {
  const unique = [...new Set(energies)];
  const entries = await Promise.all(unique.map(async (energy) => [energy, await loadEnergy(energy, variant)]));
  return Object.fromEntries(entries);
};
