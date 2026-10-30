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

