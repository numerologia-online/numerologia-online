/**
 * Совместимость - чистые расчёты, отдельно от авторских текстов и интерфейса.
 * Матрица каждого человека строится существующим ядром сайта.
 * Схема парной матрицы и 13 позиций сохранена из присланного архива.
 */
import { calculateMatrix, reduce22 } from "./numerology-core.js?v=1";

const join = (a, b) => reduce22(Number(a) + Number(b));
const segment = (a, b) => {
  const middle = join(a, b);
  return { nearA: join(a, middle), middle, nearB: join(b, middle) };
};

const personal = (date) => {
  const matrix = calculateMatrix(date);
  const { left, top, right, bottom, center, corners } = matrix;
  const basePoints = {
    left, top, right, bottom, center,
    topLeft: corners.topLeft,
    topRight: corners.topRight,
    bottomRight: corners.bottomRight,
    bottomLeft: corners.bottomLeft
  };
  const internalLines = {
    topVertical: segment(top, center),
    bottomVertical: segment(bottom, center),
    leftHorizontal: segment(left, center),
    rightHorizontal: segment(right, center)
  };
  const lineageLines = {
    maleLine: {
      from: corners.topLeft,
      innerFrom: join(corners.topLeft, center),
      center,
      innerTo: join(corners.bottomRight, center),
      to: corners.bottomRight
    },
    femaleLine: {
      from: corners.bottomLeft,
      innerFrom: join(corners.bottomLeft, center),
      center,
      innerTo: join(corners.topRight, center),
      to: corners.topRight
    }
  };
  const searchSky = join(top, bottom);
  const searchEarth = join(left, right);
  const searchResult = join(searchSky, searchEarth);
  const socialMale = join(corners.topLeft, corners.bottomRight);
  const socialFemale = join(corners.topRight, corners.bottomLeft);
  const socialResult = join(socialMale, socialFemale);
  const spiritualHarmony = join(searchResult, socialResult);
  return {
    basePoints, internalLines, lineageLines,
    lower: {
      searchSky, searchEarth, searchResult,
      socialMale, socialFemale, socialResult,
      spiritualHarmony,
      planetary: join(spiritualHarmony, socialResult)
    }
  };
};
const combineObject = (a, b) => Object.fromEntries(
  Object.keys(a).map((key) => [key, join(a[key], b[key])])
);

export const COMPATIBILITY_TOPICS = Object.freeze([
  { key: "pairEssence", title: "Что между вами на самом деле" },
  { key: "meetingMeaning", title: "Зачем вы встретились" },
  { key: "attraction", title: "Почему тянет друг к другу" },
  { key: "emotions", title: "Как вы чувствуете друг друга" },
  { key: "realLife", title: "Совместимость в обычной жизни" },
  { key: "sex", title: "Страсть и близость" },
  { key: "money", title: "Деньги вдвоём" },
  { key: "conflict", title: "Из-за чего ссоритесь" },
  { key: "lesson", title: "Чему учите друг друга" },
  { key: "swings", title: "Любовь или эмоциональные качели" },
  { key: "future", title: "Есть ли у отношений будущее" },
  { key: "actions", title: "Как вывести отношения в плюс" },
  { key: "honestFinal", title: "Честный итог: что делать дальше" }
]);

export const calculateCompatibility = (dateA, dateB) => {
  const a = personal(dateA);
  const b = personal(dateB);
  const points = combineObject(a.basePoints, b.basePoints);
  const lower = combineObject(a.lower, b.lower);
  const internal = Object.fromEntries(Object.keys(a.internalLines).map(
    (key) => [key, combineObject(a.internalLines[key], b.internalLines[key])]
  ));
  const lineage = Object.fromEntries(Object.keys(a.lineageLines).map(
    (key) => [key, combineObject(a.lineageLines[key], b.lineageLines[key])]
  ));
  const positions = {
    pairEssence: points.center,
    meetingMeaning: points.top,
    attraction: points.bottomLeft,
    emotions: join(points.topLeft, points.topRight),
    realLife: points.bottom,
    sex: join(points.bottomLeft, points.bottomRight),
    money: internal.rightHorizontal.middle,
    conflict: internal.bottomVertical.nearA,
    lesson: join(lineage.maleLine.innerFrom, lineage.femaleLine.innerTo),
    swings: join(points.bottomLeft, internal.bottomVertical.middle),
    future: join(points.right, lower.socialResult),
    actions: points.center,
    honestFinal: points.center
  };
  return COMPATIBILITY_TOPICS.map(({ key, title }) => ({ key, title, energy: positions[key] }));
};
