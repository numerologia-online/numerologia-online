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

export const loadEnergy = (energy) => {
  if (!cache.has(energy)) {
    const request = fetch(`energy-${energy}.txt`)
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Не удалось открыть энергию ${energy}.`);
        return response.text();
      })
      .then((text) => text === null ? emptyEnergy(energy) : parseEnergyText(text, energy));
    cache.set(energy, request);
  }
  return cache.get(energy);
};

export const loadEnergies = async (energies) => {
  const unique = [...new Set(energies)];
  const entries = await Promise.all(unique.map(async (energy) => [energy, await loadEnergy(energy)]));
  return Object.fromEntries(entries);
};
