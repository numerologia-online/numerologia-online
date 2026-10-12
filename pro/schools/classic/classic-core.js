// Самостоятельная классическая школа. Никаких импортов из матрицы 22 энергий.
// Метод обучения: части даты отдельно, мастер-числа 11/22/33 не сокращаются.
const MASTERS = new Set([11, 22, 33]);
export const digits = number => String(Math.abs(Math.trunc(Number(number)))).split("").map(Number);
export const digitSum = number => digits(number).reduce((sum, n) => sum + n, 0);
export const reduceClassic = (value, preserveMasters = true) => {
  let n = Math.abs(Math.trunc(Number(value)));
  if (!Number.isFinite(n)) return NaN;
  while (n > 9) {
    if (preserveMasters && MASTERS.has(n)) return n;
    n = digitSum(n);
  }
  return n;
};
export const reductionTrace = (value, preserveMasters = true) => {
  const values = [Math.abs(Math.trunc(Number(value)))];
  while (values.at(-1) > 9 && !(preserveMasters && MASTERS.has(values.at(-1)))) {
    values.push(digitSum(values.at(-1)));
  }
  return values;
};
export const parseClassicDate = input => {
  const match = String(input).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(year,month-1,day);
  if (year < 1900 || year > new Date().getFullYear() || date.getFullYear()!==year || date.getMonth()!==month-1 || date.getDate()!==day) return null;
  return {day,month,year};
};
// Ведущий метод Life Path: сначала свести месяц, день и год отдельно, потом сумму.
export const lifePath = birth => {
  const month = reduceClassic(birth.month);
  const day = reduceClassic(birth.day);
  const yearSum = digitSum(birth.year);
  const year = reduceClassic(yearSum);
  const total = month + day + year;
  return {value:reduceClassic(total),parts:{month,day,year,yearSum,total},trace:reductionTrace(total)};
};
// День рождения как отдельное ядро: исходное число 1..31 не теряется.
export const birthdayNumber = birth => ({original:birth.day, root:reduceClassic(birth.day)});
// Годовые прогнозные циклы используют только 1..9, в отличие от основных чисел.
export const personalYear = (birth, year) => reduceClassic(reduceClassic(birth.month,false)+reduceClassic(birth.day,false)+reduceClassic(digitSum(year),false),false);
export const personalMonth = (birth, year, month) => reduceClassic(personalYear(birth,year)+month,false);
export const personalDay = (birth, year, month, day) => reduceClassic(personalMonth(birth,year,month)+day,false);

const RU = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const letterValue = (letter, alphabet) => {
  const chars = alphabet==="ru" ? RU : EN;
  const pos = chars.indexOf(String(letter).toUpperCase());
  return pos<0?null:(pos%9)+1;
};
export const analyzeName = raw => {
  const upper = String(raw||"").toUpperCase().trim();
  if (!upper || /[^A-ZА-ЯЁ\s'-]/u.test(upper)) return {error:"Введите ФИО буквами, без цифр и символов."};
  const ru = /[А-ЯЁ]/u.test(upper), en = /[A-Z]/.test(upper);
  if (ru && en) return {error:"Не смешивайте русские и латинские буквы. Выберите одну запись имени."};
  if (!ru && !en) return {error:"Введите имя и фамилию."};
  const alphabet=ru?"ru":"en";
  const vowels=ru?"АЕЁИОУЫЭЮЯ":"AEIOU";
  const letters=[...upper].filter(ch=>letterValue(ch,alphabet)!==null).map(letter=>({
    letter,number:letterValue(letter,alphabet),vowel:vowels.includes(letter)
  }));
  const total=letters.reduce((sum,x)=>sum+x.number,0);
  const heartTotal=letters.filter(x=>x.vowel).reduce((sum,x)=>sum+x.number,0);
  const outerTotal=letters.filter(x=>!x.vowel).reduce((sum,x)=>sum+x.number,0);
  return {
    alphabet,letters,total,heartTotal,outerTotal,
    expression:reduceClassic(total),
    soul:heartTotal?reduceClassic(heartTotal):null,
    personality:outerTotal?reduceClassic(outerTotal):null,
    note:ru?"Русская алфавитная таблица: А=1, Б=2, ... Ё=7, ... Я=6. Ъ и Ь учитываются в числовом значении имени.":"Латинская таблица: A=1, B=2, ... I=9, J=1. Буква Y в учебном примере считается согласной."
  };
};
export const numberMeaning = {
  1:{name:"Инициатива",emoji:"☀",plus:"Смелость, самостоятельность, первый шаг.",shadow:"Сложно просить помощь и слышать других.",tip:"Сделайте один маленький шаг к своей цели."},
  2:{name:"Сотрудничество",emoji:"♥",plus:"Чуткость, такт, умение договариваться.",shadow:"Ожидание одобрения, трудности с границами.",tip:"Скажите, что вам действительно нужно."},
  3:{name:"Творчество",emoji:"✷",plus:"Юмор, общение, лёгкость выражения.",shadow:"Распыление внимания и незаконченные идеи.",tip:"Выберите одну идею и доведите её до результата."},
  4:{name:"Порядок",emoji:"▦",plus:"Надёжность, дисциплина, умение строить основу.",shadow:"Жёсткость и страх перемен.",tip:"Оставьте в расписании немного свободного места."},
  5:{name:"Свобода",emoji:"➶",plus:"Любопытство, гибкость, смелость пробовать.",shadow:"Непостоянство и бегство от рутины.",tip:"Добавьте новое впечатление, не бросая начатое."},
  6:{name:"Забота",emoji:"❀",plus:"Тепло, ответственность, желание поддерживать.",shadow:"Спасательство и завышенные ожидания.",tip:"Поддержите близкого, но не забудьте о себе."},
  7:{name:"Поиск смысла",emoji:"✧",plus:"Наблюдательность, глубина, вдумчивость.",shadow:"Замкнутость и бесконечные сомнения.",tip:"Найдите время для тишины и одного вывода."},
  8:{name:"Результат",emoji:"◆",plus:"Управление, организованность, практичность.",shadow:"Чрезмерный контроль и работа без отдыха.",tip:"Поставьте измеримую, но посильную цель."},
  9:{name:"Щедрость",emoji:"◌",plus:"Широкий взгляд, сопереживание, умение завершать.",shadow:"Жертвенность и трудность отпускать.",tip:"Завершите одно дело и освободите место новому."},
  11:{name:"Вдохновение",emoji:"✦",plus:"Интуиция, яркие идеи, умение вдохновлять.",shadow:"Тревожность и перегрузка впечатлениями.",tip:"Запишите идею и переведите её в простое действие."},
  22:{name:"Большие проекты",emoji:"⬡",plus:"Умение превратить замысел в работающую систему.",shadow:"Страх масштаба и непосильная ответственность.",tip:"Разбейте большую задачу на три понятных шага."},
  33:{name:"Наставничество",emoji:"✺",plus:"Сострадание, поддержка и передача знаний.",shadow:"Желание спасти всех ценой собственных сил.",tip:"Помогайте так, чтобы у других оставалась самостоятельность."}
};
