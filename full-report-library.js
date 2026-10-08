const knowledgeUrl = (file) => `knowledge/full-report/${file}?v=1`;

let knowledgeRequest;
const sectionRequests = new Map();

const readJson = async (file) => {
  const response = await fetch(knowledgeUrl(file));
  if (!response.ok) throw new Error(`Не удалось загрузить ${file}`);
  return response.json();
};

export const loadFullReportKnowledge = () => {
  if (!knowledgeRequest) {
    knowledgeRequest = Promise.all([
      readJson("energies.json"),
      readJson("periods.json")
    ]).then(([energies, periods]) => ({ energies, periods }));
  }
  return knowledgeRequest;
};

export const loadFullReportSection = (energy) => {
  const normalizedEnergy = Number(energy);
  if (!sectionRequests.has(normalizedEnergy)) {
    sectionRequests.set(normalizedEnergy, readJson(`sections/energy-${normalizedEnergy}.json`));
  }
  return sectionRequests.get(normalizedEnergy);
};

const ageOn = (birthDate, now = new Date()) => {
  let age = now.getFullYear() - birthDate.year;
  const birthdayPassed = now.getMonth() + 1 > birthDate.month
    || (now.getMonth() + 1 === birthDate.month && now.getDate() >= birthDate.day);
  if (!birthdayPassed) age -= 1;
  return age;
};

const activePeriod = (birthDate, matrix) => {
  const age = ageOn(birthDate);
  if (age < 20) return { label: "До 20 лет", energy: matrix.left };
  if (age < 40) return { label: "С 20 до 40 лет", energy: matrix.top };
  return { label: "После 40 лет", energy: matrix.right };
};

/**
 * Builds a small first layer of the full report from the transferred library.
 * The visual matrix stays independent: this only supplies reader-facing text.
 */
export const buildFullReportPreview = (birthDate, matrix, knowledge) => {
  const centralEnergy = knowledge.energies[String(matrix.center)];
  const period = activePeriod(birthDate, matrix);
  const periodEnergy = knowledge.energies[String(period.energy)];
  const periodRule = knowledge.periods[String(period.energy)];

  return [
    {
      key: "center",
      eyebrow: `Центральная энергия ${matrix.center}`,
      title: "Главный вектор",
      paragraphs: [
        centralEnergy?.shortEssence,
        centralEnergy?.mainStrength,
        centralEnergy?.mainBlock,
        centralEnergy?.advice && `Ориентир: ${centralEnergy.advice}`
      ].filter(Boolean)
    },
    {
      key: "period",
      eyebrow: `${period.label} · энергия ${period.energy}`,
      title: "Текущий жизненный период",
      paragraphs: [
        periodRule?.focus && `Сейчас в фокусе: ${periodRule.focus}.`,
        periodRule?.advice && `Лучше: ${periodRule.advice}.`,
        periodRule?.avoid && `Не стоит: ${periodRule.avoid}.`
      ].filter(Boolean)
    }
  ];
};

const FULL_SECTION_DEFINITIONS = [
  { key: "impression", position: "personality", eyebrow: "Внешний образ", title: "Как видят вас другие" },
  { key: "trueSelf", position: "mission", eyebrow: "Суть личности", title: "Кто вы есть на самом деле" },
  { key: "growth", position: "realization", eyebrow: "Рост", title: "Как вам расти в любой сфере" },
  { key: "character", position: "personality", eyebrow: "Характер", title: "Ваш характер: сила и тень" },
  { key: "parentsPain", position: "family", eyebrow: "Родители", title: "Главная боль в теме родителей" },
  { key: "familyError", position: "karma", eyebrow: "Родовой сценарий", title: "Ошибка рода, которую вы пришли остановить" },
  { key: "trueLove", position: "relationships", eyebrow: "Любовь", title: "Что для вас настоящая любовь" },
  { key: "partner", position: "relationships", eyebrow: "Партнёр", title: "Какой партнёр вам подходит по судьбе" },
  { key: "moneyBlock", position: "moneyBlock", eyebrow: "Деньги", title: "Почему деньги могут не приходить" },
  { key: "moneyFlow", position: "moneyFlow", eyebrow: "Денежный поток", title: "Как включить свой денежный поток" },
  { key: "earning", position: "earning", eyebrow: "Заработок", title: "Где вам легче всего заработать" },
  { key: "energyLeak", position: "resource", eyebrow: "Энергия", title: "Где утекают ваши силы и энергия" },
  { key: "health", position: "resource", eyebrow: "Ресурс", title: "Ваш ресурс и здоровье" },
  { key: "lifeLesson", position: "karma", eyebrow: "Главный урок", title: "Важнейший урок вашей жизни" }
];

export const buildFullReportSections = (matrix) => {
  // Старые отчёты также вызывают функцию с базовой матрицей.
  // Для новых расчётов используем точные позиции каналов.
  const loveEntry = matrix.tail.first;
  const moneyEntry = matrix.rightSpoke.near;
  const balance = matrix.channels?.balance ?? (()=>{
    let n = loveEntry + moneyEntry;
    while(n > 22)n=String(n).split("").reduce((s,d)=>s+Number(d),0);
    return n;
  })();
  const inner = (n)=>{
    let value=n;
    while(value>22)value=String(value).split("").reduce((s,d)=>s+Number(d),0);
    return value;
  };
  const positions = {
    personality: matrix.left,
    mission: matrix.center,
    realization: matrix.corners.bottomRight,
    family: matrix.corners.topLeft,
    karma: matrix.bottom,
    relationships: loveEntry,
    moneyBlock: moneyEntry,
    moneyFlow: balance,
    earning: matrix.channels?.money.inner ?? inner(moneyEntry + balance),
    resource: matrix.center
  };

  return FULL_SECTION_DEFINITIONS.map((definition) => ({
    ...definition,
    energy: positions[definition.position]
  }));
};
